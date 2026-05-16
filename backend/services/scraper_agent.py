"""
Live web scraper agent for Griha AI.

Architecture:
1. PRIMARY: Scrape MagicBricks search results page for the requested
   {bhk} in {locality}, {city} and parse real listing cards
   (title, price, society, carpet area, bathrooms, furnishing, image,
   listing URL).
2. FILTER: Keep only listings whose title/society mentions the requested
   locality and the requested BHK.
3. FALLBACK: DuckDuckGo web search across major property portals,
   extracting details from each listing page.
4. The agent NEVER fabricates listings via an LLM. The LLM is only used
   (optionally) to enrich descriptive content of REAL listings already
   captured from the web.
"""

import asyncio
import hashlib
import json
import random
import re
from typing import Any, Optional
from urllib.parse import parse_qs, quote, unquote, urljoin, urlparse

import httpx
from bs4 import BeautifulSoup
from fastapi import WebSocket

from database.models.property import Property
from services.gemini_extractor import GeminiExtractor
from services.gemini_property_content import GeminiPropertyContentService


# ---------------------------------------------------------------------------
# Constants
# ---------------------------------------------------------------------------

PROPERTY_DOMAINS = (
    "magicbricks.com",
    "99acres.com",
    "nobroker.in",
    "housing.com",
    "commonfloor.com",
    "proptiger.com",
    "squareyards.com",
)

USER_AGENTS = [
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36",
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 14_5) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Safari/605.1.15",
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:127.0) Gecko/20100101 Firefox/127.0",
    "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36",
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 14_5) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36",
]


class ScraperAgent:
    def __init__(self, websocket: WebSocket):
        self.websocket = websocket
        self.content_service = GeminiPropertyContentService()
        self.extractor = GeminiExtractor()

    # ------------------------------------------------------------------
    # WebSocket helpers
    # ------------------------------------------------------------------

    async def send_update(self, progress: int, status: str, found_count: int = 0):
        try:
            await self.websocket.send_text(json.dumps({
                "progress": progress,
                "status": status,
                "found_count": found_count,
            }))
        except Exception:
            pass

    # ------------------------------------------------------------------
    # Text helpers
    # ------------------------------------------------------------------

    def _slugify(self, text: str) -> str:
        cleaned = re.sub(r"[^a-zA-Z0-9]+", "-", (text or "unknown").strip().lower())
        return cleaned.strip("-") or "unknown"

    def _random_ua(self) -> str:
        return random.choice(USER_AGENTS)

    def _extract_location_parts(self, location: str) -> tuple[str, str]:
        parts = [p.strip() for p in (location or "").split(",") if p.strip()]
        locality = parts[0] if parts else "Unknown Locality"
        city = parts[1] if len(parts) > 1 else (parts[0] if parts else "Mumbai")
        return locality, city

    def _extract_platform(self, source_url: str) -> str:
        host = (urlparse(source_url).netloc or "").lower()
        for domain in PROPERTY_DOMAINS:
            short = domain.split(".")[0]
            if short in host:
                return short
        return "web"

    # ------------------------------------------------------------------
    # HTTP helpers
    # ------------------------------------------------------------------

    async def _fetch_page(self, url: str, timeout: float = 12.0) -> Optional[str]:
        headers = {
            "User-Agent": self._random_ua(),
            "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
            "Accept-Language": "en-US,en;q=0.9,hi;q=0.8",
            "Accept-Encoding": "gzip, deflate",
            "DNT": "1",
        }
        for attempt in range(2):
            try:
                verify = attempt == 0
                async with httpx.AsyncClient(
                    timeout=timeout, follow_redirects=True, headers=headers, verify=verify
                ) as client:
                    response = await client.get(url)
                    response.raise_for_status()
                    return response.text
            except Exception:
                if attempt == 0:
                    await asyncio.sleep(0.5)
                    continue
                return None
        return None

    # ------------------------------------------------------------------
    # Image extraction from HTML
    # ------------------------------------------------------------------

    def _extract_images_from_html(self, soup: BeautifulSoup, source_url: str, limit: int = 4) -> list[str]:
        images: list[str] = []
        seen: set[str] = set()

        def _add(url: str):
            if url in seen or not url.startswith("http"):
                return
            low = url.lower()
            skip = ["logo", "icon", "favicon", "sprite", "pixel", "tracking",
                     "ad.", "ads.", "banner", "badge", "avatar", "1x1", ".svg", ".gif"]
            if any(p in low for p in skip):
                return
            seen.add(url)
            images.append(url)

        # og:image
        for sel, attr in [
            ('meta[property="og:image"]', "content"),
            ('meta[name="twitter:image"]', "content"),
        ]:
            node = soup.select_one(sel)
            if node and (node.get(attr) or "").strip():
                _add(urljoin(source_url, node[attr].strip()))

        # JSON-LD
        for script in soup.select('script[type="application/ld+json"]'):
            payload = script.string or ""
            try:
                data = json.loads(payload)
                self._collect_images(data, source_url, _add)
            except Exception:
                pass

        # <img> tags
        for img in soup.select("img[src]"):
            src = (img.get("src") or "").strip()
            if not src:
                continue
            _add(urljoin(source_url, src))
            if len(images) >= limit:
                break

        # Lazy-loaded
        if len(images) < limit:
            for img in soup.select("img[data-src], img[data-original], img[data-lazy-src]"):
                for attr in ["data-src", "data-original", "data-lazy-src"]:
                    val = (img.get(attr) or "").strip()
                    if val:
                        _add(urljoin(source_url, val))
                        break
                if len(images) >= limit:
                    break

        return images[:limit]

    def _collect_images(self, node: Any, base: str, add_fn):
        if isinstance(node, list):
            for child in node:
                self._collect_images(child, base, add_fn)
            return
        if not isinstance(node, dict):
            return
        image = node.get("image")
        if isinstance(image, str) and image.strip():
            add_fn(urljoin(base, image.strip()))
        elif isinstance(image, list):
            for v in image:
                if isinstance(v, str) and v.strip():
                    add_fn(urljoin(base, v.strip()))
                elif isinstance(v, dict) and v.get("url"):
                    add_fn(urljoin(base, v["url"].strip()))
        elif isinstance(image, dict) and image.get("url"):
            add_fn(urljoin(base, image["url"].strip()))
        for val in node.values():
            if isinstance(val, (dict, list)):
                self._collect_images(val, base, add_fn)

    # ------------------------------------------------------------------
    # Try to find images for a specific society
    # ------------------------------------------------------------------

    async def _find_images_for_society(self, society_name: str, locality: str, city: str) -> list[str]:
        """Try to scrape real images for a society from property sites."""
        slug = self._slugify(society_name)
        loc_slug = self._slugify(locality)
        city_slug = self._slugify(city)

        # URLs to try for finding images of this specific society
        urls_to_try = [
            f"https://www.magicbricks.com/{slug}-in-{loc_slug}-{city_slug}-overview",
            f"https://www.magicbricks.com/{slug}-{loc_slug}-{city_slug}",
            f"https://housing.com/in/buy/{slug}-{loc_slug}-{city_slug}",
            f"https://www.99acres.com/{slug}-{loc_slug}-{city_slug}",
        ]

        for url in urls_to_try:
            try:
                html = await self._fetch_page(url, timeout=8.0)
                if html and len(html) > 1000:
                    soup = BeautifulSoup(html, "lxml")
                    imgs = self._extract_images_from_html(soup, url, limit=3)
                    if imgs:
                        print(f"    [img] Found {len(imgs)} images from {urlparse(url).netloc}")
                        return imgs
            except Exception:
                continue
            await asyncio.sleep(0.2)

        return []

    # ------------------------------------------------------------------
    # DuckDuckGo fallback for additional listings
    # ------------------------------------------------------------------

    async def _ddg_search(self, query: str) -> list[dict]:
        """Search DDG for property listings."""
        url = "https://html.duckduckgo.com/html/"
        headers = {
            "User-Agent": self._random_ua(),
            "Accept": "text/html,application/xhtml+xml",
            "Content-Type": "application/x-www-form-urlencoded",
            "Origin": "https://html.duckduckgo.com",
            "Referer": "https://html.duckduckgo.com/",
        }

        for attempt in range(2):
            try:
                verify = attempt == 0
                async with httpx.AsyncClient(
                    timeout=12.0, follow_redirects=True, verify=verify
                ) as client:
                    response = await client.post(url, data={"q": query, "b": ""}, headers=headers)
                    response.raise_for_status()
                    text = response.text
                    if "please try again" in text.lower() or "robot" in text.lower():
                        await asyncio.sleep(1.5)
                        headers["User-Agent"] = self._random_ua()
                        continue
                    return self._parse_ddg_results(text)
            except Exception:
                await asyncio.sleep(0.8)
                headers["User-Agent"] = self._random_ua()
                continue
        return []

    def _parse_ddg_results(self, html: str) -> list[dict]:
        if not html:
            return []
        soup = BeautifulSoup(html, "lxml")
        rows: list[dict] = []
        seen: set[str] = set()

        for anchor in soup.select("a[href]"):
            href = anchor.get("href") or ""
            if not href:
                continue
            # Resolve DDG redirect
            parsed = urlparse(href)
            if "duckduckgo.com" in (parsed.netloc or "") and parsed.path.startswith("/l/"):
                target = parse_qs(parsed.query).get("uddg", [None])[0]
                if target:
                    href = unquote(target)

            host = (urlparse(href).netloc or "").lower()
            if not any(d in host for d in PROPERTY_DOMAINS):
                continue
            if href in seen:
                continue
            title = anchor.get_text(" ", strip=True)
            if len(title) < 5:
                continue
            rows.append({"title": title, "url": href, "snippet": ""})
            seen.add(href)
            if len(rows) >= 8:
                break
        return rows

    # ------------------------------------------------------------------
    # Price / number parsing helpers
    # ------------------------------------------------------------------

    def _parse_price_inr(self, text: str) -> Optional[float]:
        """Parse strings like '₹ 2 Lac', '₹ 1.3 Cr', '₹ 80,000', 'Rs. 75,000 / month'."""
        if not text:
            return None
        s = text.replace(",", "").replace("\u20b9", " ").lower()
        m = re.search(r"([\d.]+)\s*(cr|crore|lac|lakh|k)?", s)
        if not m:
            return None
        try:
            num = float(m.group(1))
        except ValueError:
            return None
        unit = (m.group(2) or "").lower()
        if unit in ("cr", "crore"):
            num *= 1_00_00_000  # 10,000,000
        elif unit in ("lac", "lakh"):
            num *= 1_00_000     # 100,000
        elif unit == "k":
            num *= 1_000
        if num < 1000 or num > 1_00_00_00_000:
            return None
        return num

    def _parse_int(self, text: str) -> Optional[int]:
        if not text:
            return None
        m = re.search(r"\d+", text.replace(",", ""))
        return int(m.group(0)) if m else None

    def _bhk_number(self, bhk: str) -> Optional[int]:
        if not bhk:
            return None
        m = re.search(r"\d+", bhk)
        return int(m.group(0)) if m else None

    # ------------------------------------------------------------------
    # MagicBricks SRP scraper
    # ------------------------------------------------------------------

    async def _scrape_magicbricks(
        self, locality: str, city: str, bhk_num: int
    ) -> tuple[list[dict], str]:
        """Scrape MagicBricks rent search results for the given filters.

        Returns (listings, search_url). Each listing is a dict with raw fields
        extracted directly from the search results card — NOT generated by AI.

        We prefer MagicBricks' locality-canonical URL (e.g.
        ``/2-bhk-flats-for-rent-in-bandra-west-mumbai-pppfr``) because the
        generic ``/property-for-rent/...?localty=`` query-string parameter is
        ignored by the site and returns city-wide results.
        """
        loc_slug = self._slugify(locality)
        city_slug = self._slugify(city)

        # Build a prioritised list of URLs to attempt.
        # We stop at the first one that returns a parseable page.
        candidate_urls = [
            # 1. Canonical locality-in-city slug (works for suburbs like Bandra West, Powai)
            (
                f"https://www.magicbricks.com/{bhk_num}-bhk-flats-for-rent-in-"
                f"{loc_slug}-{city_slug}-pppfr"
            ),
            # 2. Locality treated as a standalone city (works for Ambernath, Thane, etc.)
            (
                f"https://www.magicbricks.com/{bhk_num}-bhk-flats-for-rent-in-"
                f"{loc_slug}-pppfr"
            ),
            # 3. SRP query-string with locality as the cityName
            (
                "https://www.magicbricks.com/property-for-rent/residential-real-estate"
                f"?bedroom={bhk_num}"
                "&proptype=Multistorey-Apartment,Builder-Floor-Apartment"
                f"&cityName={quote(locality)}&Locality={quote(locality.replace(' ', '-'))}"
            ),
            # 4. SRP query-string with original city + locality filter (broad fallback)
            (
                "https://www.magicbricks.com/property-for-rent/residential-real-estate"
                f"?bedroom={bhk_num}"
                "&proptype=Multistorey-Apartment,Builder-Floor-Apartment"
                f"&cityName={quote(city)}&Locality={quote(locality.replace(' ', '-'))}"
            ),
        ]

        def _norm(s: str) -> str:
            return re.sub(r"[^a-z0-9]+", " ", (s or "").lower()).strip()

        loc_norm = _norm(locality)

        html = None
        search_url = candidate_urls[0]
        for url in candidate_urls:
            fetched = await self._fetch_page(url, timeout=20.0)
            if not fetched or len(fetched) < 5000:
                continue
            # Quick check: does this page mention the locality at all?
            soup_check = BeautifulSoup(fetched, "lxml")
            page_text_norm = _norm(soup_check.get_text(" ", strip=True)[:8000])
            if loc_norm and loc_norm not in page_text_norm:
                continue
            html = fetched
            search_url = url
            break

        if not html:
            # Last resort: use whatever came back from the first URL even if locality
            # wasn't detected in the preview text (avoids empty result when MB's
            # page text is JS-rendered and only partially visible).
            for url in candidate_urls:
                fetched = await self._fetch_page(url, timeout=20.0)
                if fetched and len(fetched) >= 5000:
                    html = fetched
                    search_url = url
                    break

        if not html:
            return [], search_url

        soup = BeautifulSoup(html, "lxml")
        cards = soup.select(".mb-srp__card")
        listings: list[dict] = []

        def _txt(node) -> str:
            return node.get_text(" ", strip=True) if node else ""

        # ── Strategy A: JS-rendered .mb-srp__card divs (works in browser) ──
        for card in cards:
            title = _txt(card.select_one(".mb-srp__card--title"))
            if not title:
                continue

            price_text = _txt(card.select_one("[class*='price']"))
            price = self._parse_price_inr(price_text)
            if not price:
                continue

            society = _txt(
                card.select_one('[data-summary="society"] .mb-srp__card__summary--value')
            ) or None
            ca_text = _txt(
                card.select_one('[data-summary="carpet-area"] .mb-srp__card__summary--value')
            )
            size_sqft = self._parse_int(ca_text)
            bath_text = _txt(
                card.select_one('[data-summary="bathroom"] .mb-srp__card__summary--value')
            )
            bathrooms = self._parse_int(bath_text)
            furnishing = _txt(
                card.select_one('[data-summary="furnishing"] .mb-srp__card__summary--value')
            ) or None
            if furnishing:
                furn_l = furnishing.lower()
                if "semi" in furn_l:
                    furnishing = "Semi Furnished"
                elif "unfurn" in furn_l:
                    furnishing = "Unfurnished"
                elif "furn" in furn_l:
                    furnishing = "Fully Furnished"

            # Image — skip placeholder data: URIs
            images: list[str] = []
            for img in card.select("img"):
                src = (img.get("src") or img.get("data-src") or "").strip()
                if src.startswith("http") and ("staticmb" in src or "/Photo_" in src):
                    images.append(src)
                    break
            # PDP link
            href = ""
            for a in card.select("a[href]"):
                h = a.get("href") or ""
                if "magicbricks.com" in h and "pdpid" in h:
                    href = h
                    break

            # Derive a society/apartment name if MagicBricks didn't give one:
            # title format -> "<BHK> Flat  for Rent in <Society>, <Locality>, <City>"
            apartment = society
            if not apartment:
                m = re.search(r"for\s+Rent\s+in\s+(.+)", title, re.IGNORECASE)
                if m:
                    apartment = m.group(1).split(",")[0].strip()

            full_text = _txt(card)

            listings.append({
                "title": title,
                "price": price,
                "society_name": apartment or title,
                "size_sqft": size_sqft,
                "bathrooms": bathrooms,
                "furnishing": furnishing,
                "images": images,
                "source_url": href or search_url,
                "card_text": full_text,
            })

        # ── Strategy B: SSR/SEO fallback (httpx from server IPs) ──────────
        # MagicBricks renders cards via JavaScript. From datacenter IPs,
        # httpx only gets server-rendered HTML where each listing appears as
        # an <h2> heading + description paragraph with price, sqft, etc.
        if not listings:
            print("  [phase1] No .mb-srp__card found — trying SSR/SEO parser")
            # Find all h2 headings that look like listing titles
            for h2 in soup.select("h2"):
                h2_text = _txt(h2)
                if "BHK" not in h2_text or "Rent" not in h2_text:
                    continue

                # Collect text from the siblings until the next h2
                desc_parts: list[str] = []
                sibling = h2.find_next_sibling()
                while sibling and sibling.name != "h2":
                    desc_parts.append(_txt(sibling))
                    sibling = sibling.find_next_sibling()
                desc_blob = " ".join(desc_parts)

                if not desc_blob or len(desc_blob) < 30:
                    continue

                # Extract price: "₹1.7 Lac", "₹70,000", "₹2.9 Lac"
                price = self._parse_price_inr(desc_blob)
                if not price:
                    continue

                # Extract carpet area: "carpet area of 1830 sqft" or "1830 sqft"
                sqft_m = re.search(r"(?:carpet\s+area\s+of\s+)?(\d[\d,]*)\s*sq\s*ft", desc_blob, re.IGNORECASE)
                size_sqft = int(sqft_m.group(1).replace(",", "")) if sqft_m else None

                # Bathrooms: "5 bathrooms" or "3 bathrooms"
                bath_m = re.search(r"(\d+)\s*bath", desc_blob, re.IGNORECASE)
                bathrooms = int(bath_m.group(1)) if bath_m else None

                # Furnishing
                furnishing = None
                desc_lower = desc_blob.lower()
                if "semi" in desc_lower and "furnish" in desc_lower:
                    furnishing = "Semi Furnished"
                elif "unfurnish" in desc_lower:
                    furnishing = "Unfurnished"
                elif "fully" in desc_lower and "furnish" in desc_lower:
                    furnishing = "Fully Furnished"
                elif "furnished" in desc_lower:
                    furnishing = "Furnished"

                # Society name: check the link right after h2
                society = None
                h2_link = h2.find("a")
                if h2_link:
                    society = _txt(h2_link)

                # View Property link
                source_url = search_url
                # Look for "View Property" or "propertyDetails" links
                view_link = None
                sib = h2.find_next_sibling()
                while sib and sib.name != "h2":
                    for a in (sib.select("a[href]") if hasattr(sib, "select") else []):
                        href_val = a.get("href", "")
                        if "propertyDetails" in href_val or "pdpid" in href_val:
                            view_link = href_val
                            break
                    if view_link:
                        break
                    sib = sib.find_next_sibling()
                if view_link:
                    source_url = view_link

                # Build title from h2
                title = h2_text

                apartment = society
                if not apartment:
                    m_apt = re.search(r"for\s+Rent\s+in\s+(.+)", title, re.IGNORECASE)
                    if m_apt:
                        apartment = m_apt.group(1).split(",")[0].strip()

                listings.append({
                    "title": title,
                    "price": price,
                    "society_name": apartment or title,
                    "size_sqft": size_sqft,
                    "bathrooms": bathrooms,
                    "furnishing": furnishing,
                    "images": [],
                    "source_url": source_url,
                    "card_text": desc_blob[:500],
                })

            print(f"  [phase1] SSR parser found {len(listings)} listings")

        return listings, search_url

    # ------------------------------------------------------------------
    # Persistence: scrape REAL listings then save to DB
    # ------------------------------------------------------------------

    async def _persist_properties(self, location: str, bhk: str) -> list[Property]:
        locality, city = self._extract_location_parts(location)
        fallback_bhk = bhk if bhk and bhk != "Any BHK" else "2 BHK"
        bhk_num = self._bhk_number(fallback_bhk) or 2

        saved_properties: list[Property] = []

        # ================================================================
        # PHASE 1: Live scrape MagicBricks (PRIMARY — real listings)
        # ================================================================
        await self.send_update(
            10,
            f"🔍 Searching MagicBricks for {fallback_bhk} in {locality}, {city}...",
            0,
        )

        print(f"\n  [phase1] Scraping MagicBricks: {fallback_bhk} in {locality}, {city}...")
        try:
            mb_listings, mb_search_url = await self._scrape_magicbricks(
                locality=locality, city=city, bhk_num=bhk_num
            )
        except Exception as exc:
            print(f"  [phase1] MagicBricks scrape failed: {exc}")
            mb_listings, mb_search_url = [], ""
        print(f"  [phase1] MagicBricks returned {len(mb_listings)} cards (pre-filter)")

        # Filter: must mention requested BHK and the requested locality.
        # MagicBricks SRP often broadens results, so we filter client-side.
        def _norm(s: str) -> str:
            return re.sub(r"[^a-z0-9]+", " ", (s or "").lower()).strip()

        loc_norm = _norm(locality)
        loc_words = [w for w in loc_norm.split() if len(w) > 2]
        bhk_token = f"{bhk_num} bhk"
        filtered = []
        for item in mb_listings:
            blob = _norm(
                f"{item.get('title','')} {item.get('society_name','')} "
                f"{item.get('card_text','')}"
            )
            if bhk_token not in blob:
                continue
            if loc_words and not any(w in blob for w in loc_words):
                continue
            filtered.append(item)
        print(
            f"  [phase1] After locality+BHK filter: {len(filtered)} listings"
            f" (locality={locality!r}, bhk={fallback_bhk!r})"
        )

        if filtered:
            await self.send_update(
                40,
                f"✅ Found {len(filtered)} real listings on MagicBricks. Saving...",
                len(filtered),
            )
        else:
            await self.send_update(
                25,
                f"No MagicBricks matches for {fallback_bhk} in {locality}. Trying web search...",
                0,
            )

        for idx, item in enumerate(filtered):
            society_name = item["society_name"]
            pct = 40 + int((idx / max(len(filtered), 1)) * 25)
            await self.send_update(
                pct,
                f"💾 Saving {society_name}... ({idx+1}/{len(filtered)})",
                len(saved_properties),
            )

            images = item.get("images") or []
            # Try to enrich with more images from the PDP / society pages
            if len(images) < 2:
                extra = await self._find_images_for_society(society_name, locality, city)
                images = (images + extra)[:4]
            if not images:
                # Last-resort generic photo so the UI doesn't break
                images = [
                    "https://images.unsplash.com/photo-1560448204-e02f11c3d0e2?w=800&h=600&fit=crop&q=80"
                ]

            external_id = f"mb-{hashlib.sha1(item['source_url'].encode()).hexdigest()[:18]}"

            payload = {
                "external_id": external_id,
                "source_platform": "magicbricks",
                "source_url": item["source_url"],
                "title": item["title"][:120],
                "apartment_name": society_name,
                "total_flats_available": None,
                "address": f"{society_name}, {locality}, {city}",
                "locality": locality,
                "city": city,
                "price": float(item["price"]),
                "size_sqft": item.get("size_sqft"),
                "bhk": fallback_bhk,
                "floor": None,
                "bathrooms": item.get("bathrooms"),
                "balconies": None,
                "furnished_status": item.get("furnishing"),
                "images": images,
                "amenities": [],
                "description": (
                    f"{fallback_bhk} apartment at {society_name} in {locality}, {city}. "
                    "Sourced live from MagicBricks search results."
                ),
                "listed_days_ago": 0,
                "is_fake": False,
                "fake_confidence": 0.0,
                "photo_red_flags": [],
                "legal_status": "unknown",
                "rera_registered": False,
                "rera_number": None,
            }

            try:
                existing = await Property.find_one(Property.external_id == external_id)
                if existing:
                    for key, value in payload.items():
                        setattr(existing, key, value)
                    await existing.save()
                    saved_properties.append(existing)
                else:
                    new_prop = Property(**payload)
                    await new_prop.insert()
                    saved_properties.append(new_prop)
                print(f"    [saved] {society_name} — ₹{item['price']:,.0f}/mo")
            except Exception as e:
                print(f"    [error] Failed to save {society_name}: {e}")
                continue

        # ================================================================
        # PHASE 3: DDG web search for additional listings (BONUS)
        # ================================================================
        if len(saved_properties) < 5:
            await self.send_update(
                70,
                f"🌐 Searching web for more listings in {locality}...",
                len(saved_properties),
            )

            try:
                ddg_query = f"{fallback_bhk} flat for rent in {locality} {city}"
                ddg_results = await self._ddg_search(ddg_query)
                print(f"  [phase3] DDG returned {len(ddg_results)} results")

                for item in ddg_results[:5]:
                    try:
                        html = await self._fetch_page(item["url"])
                        if not html:
                            continue
                        soup = BeautifulSoup(html, "lxml")
                        page_text = soup.get_text(" ", strip=True)[:5000]
                        page_title = soup.title.get_text(" ", strip=True) if soup.title else ""

                        extracted = await self.extractor.extract_property_from_page(
                            page_text=page_text,
                            page_title=page_title,
                            source_url=item["url"],
                            search_title=item.get("title", ""),
                            fallback_bhk=fallback_bhk,
                            locality=locality,
                            city=city,
                        )

                        if extracted and extracted.get("price"):
                            ext_id = f"live-{hashlib.sha1(item['url'].encode()).hexdigest()[:18]}"
                            page_images = self._extract_images_from_html(soup, item["url"])

                            prop_payload = {
                                "external_id": ext_id,
                                "source_platform": self._extract_platform(item["url"]),
                                "source_url": item["url"],
                                "title": extracted.get("project_name") or item.get("title", "")[:80],
                                "apartment_name": extracted.get("project_name"),
                                "total_flats_available": None,
                                "address": f"{extracted.get('project_name') or locality}, {locality}, {city}",
                                "locality": locality,
                                "city": city,
                                "price": float(extracted["price"]),
                                "size_sqft": extracted.get("size_sqft"),
                                "bhk": extracted.get("bhk") or fallback_bhk,
                                "floor": extracted.get("floor"),
                                "bathrooms": extracted.get("bathrooms"),
                                "balconies": extracted.get("balconies"),
                                "furnished_status": extracted.get("furnished_status"),
                                "images": page_images or [
                                    "https://images.unsplash.com/photo-1560448204-e02f11c3d0e2?w=800&h=600&fit=crop&q=80"
                                ],
                                "amenities": extracted.get("amenities") or [],
                                "description": extracted.get("description") or "",
                                "listed_days_ago": 0,
                                "is_fake": False,
                                "fake_confidence": 0.0,
                                "photo_red_flags": [],
                                "legal_status": "unknown",
                                "rera_registered": False,
                                "rera_number": None,
                            }

                            existing = await Property.find_one(Property.external_id == ext_id)
                            if not existing:
                                new_prop = Property(**prop_payload)
                                await new_prop.insert()
                                saved_properties.append(new_prop)

                    except Exception:
                        continue
                    await asyncio.sleep(0.3)

            except Exception as e:
                print(f"  [phase3] DDG search failed: {e}")

        return saved_properties

    # ------------------------------------------------------------------
    # Main workflow
    # ------------------------------------------------------------------

    async def run_scrape_workflow(self, location: str, bhk: str):
        await self.send_update(5, f"🚀 Starting live property search for {bhk} in {location}...")
        await asyncio.sleep(0.3)

        try:
            live_records = await self._persist_properties(location, bhk)
            live_saved = len(live_records)

            if live_saved > 0:
                await self.send_update(
                    85,
                    f"🤖 Generating AI insights for {live_saved} properties...",
                    live_saved,
                )
                try:
                    await self.content_service.enrich_recent(live_records)
                except Exception:
                    pass

                await asyncio.sleep(0.3)
                await self.send_update(
                    100,
                    f"✅ Done! {live_saved} real properties with AI insights ready on your dashboard.",
                    live_saved,
                )
            else:
                await self.send_update(
                    100,
                    "⚠️ Could not find listings. Try a different locality (e.g., 'Bandra West, Mumbai').",
                    0,
                )

        except Exception as exc:
            print(f"  [error] Scraping workflow failed: {exc}")
            await self.send_update(
                100,
                f"❌ Error: {str(exc)[:100]}. Please retry.",
                0,
            )
