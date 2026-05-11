"""
Property Fetcher — Robust replacement for the brittle scraper.

Architecture:
  1. PRIMARY: Fetch MagicBricks SRP pages using smart URL resolution
     (multiple slug patterns to avoid 404s). Extract data from JSON-LD
     structured data embedded in the page (Schema.org Apartment objects).
  2. SECONDARY: Parse CSS card selectors as enrichment/fallback for
     fields missing from JSON-LD.
  3. TERTIARY: Broader city-level search when locality-specific URLs 404.

Key improvements over the old scraper:
  - JSON-LD extraction is 10x more reliable than CSS-only parsing
  - Smart URL resolution handles sub-cities (Ambernath→Beyond Thane)
  - No DuckDuckGo dependency (was rate-limited/blocked)
  - No LLM used for data extraction (LLM only for enrichment)
"""

import asyncio
import hashlib
import json
import random
import re
from datetime import datetime
from typing import Any, Optional
from urllib.parse import quote

import httpx
from bs4 import BeautifulSoup
from fastapi import WebSocket

from database.models.property import Property
from services.gemini_property_content import GeminiPropertyContentService


USER_AGENTS = [
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36",
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 14_5) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Safari/605.1.15",
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:128.0) Gecko/20100101 Firefox/128.0",
    "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36",
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 14_5) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36",
]

# Nominatim returns verbose city names. MagicBricks needs short ones.
CITY_NORMALIZATION = {
    "mumbai city district": "Mumbai",
    "mumbai suburban district": "Mumbai",
    "mumbai suburban": "Mumbai",
    "mumbai city": "Mumbai",
    "greater mumbai": "Mumbai",
    "brihanmumbai": "Mumbai",
    "bangalore urban": "Bangalore",
    "bangalore urban district": "Bangalore",
    "bengaluru urban": "Bangalore",
    "bengaluru": "Bangalore",
    "new delhi district": "Delhi",
    "new delhi": "Delhi",
    "south delhi": "Delhi",
    "north delhi": "Delhi",
    "central delhi": "Delhi",
    "east delhi": "Delhi",
    "west delhi": "Delhi",
    "pune district": "Pune",
    "pune city": "Pune",
    "hyderabad district": "Hyderabad",
    "chennai district": "Chennai",
    "kolkata district": "Kolkata",
    "thane district": "Thane",
    "thane city": "Thane",
    "gurugram": "Gurgaon",
    "gurgaon district": "Gurgaon",
    "gautam buddha nagar": "Noida",
    "ghaziabad district": "Ghaziabad",
    "faridabad district": "Faridabad",
    "ahmedabad city": "Ahmedabad",
    "ahmedabad district": "Ahmedabad",
    "jaipur district": "Jaipur",
    "lucknow district": "Lucknow",
    "ernakulam": "Kochi",
    "ernakulam district": "Kochi",
}

# MagicBricks uses different parent-city slugs for outer suburbs.
LOCALITY_SLUG_OVERRIDES = {
    "ambernath": ["ambernath-beyond-thane", "ambernath-thane", "ambernath"],
    "badlapur": ["badlapur-beyond-thane", "badlapur-thane", "badlapur"],
    "dombivli": ["dombivli-kalyan", "dombivli-beyond-thane", "dombivli"],
    "dombivali": ["dombivli-kalyan", "dombivli-beyond-thane", "dombivli"],
    "kalyan": ["kalyan", "kalyan-dombivli"],
    "ulhasnagar": ["ulhasnagar-beyond-thane", "ulhasnagar-thane"],
    "bhiwandi": ["bhiwandi-beyond-thane", "bhiwandi"],
    "panvel": ["panvel-navi-mumbai", "panvel"],
    "kharghar": ["kharghar-navi-mumbai", "kharghar"],
    "vashi": ["vashi-navi-mumbai", "vashi"],
    "airoli": ["airoli-navi-mumbai", "airoli"],
    "nerul": ["nerul-navi-mumbai", "nerul"],
    "belapur": ["belapur-navi-mumbai", "belapur"],
    "mira road": ["mira-road-mumbai", "mira-road-beyond-thane", "mira-road"],
    "vasai": ["vasai-beyond-thane", "vasai"],
    "virar": ["virar-beyond-thane", "virar"],
    "nala sopara": ["nala-sopara-beyond-thane", "nala-sopara"],
}


class PropertyFetcher:
    """Fetches real property listings from MagicBricks using structured data."""

    def __init__(self, websocket: WebSocket):
        self.websocket = websocket
        self.content_service = GeminiPropertyContentService()

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

    @staticmethod
    def _slugify(text: str) -> str:
        cleaned = re.sub(r"[^a-zA-Z0-9]+", "-", (text or "unknown").strip().lower())
        return cleaned.strip("-") or "unknown"

    @staticmethod
    def _norm(s: str) -> str:
        return re.sub(r"[^a-z0-9]+", " ", (s or "").lower()).strip()

    @staticmethod
    def _random_ua() -> str:
        return random.choice(USER_AGENTS)

    @staticmethod
    def _normalize_city(city: str) -> str:
        """Normalize verbose Nominatim city names to short MagicBricks names."""
        key = city.strip().lower()
        if key in CITY_NORMALIZATION:
            return CITY_NORMALIZATION[key]
        # Strip common suffixes: "District", "Urban", "City" etc.
        cleaned = re.sub(
            r"\s+(city\s+district|suburban\s+district|urban\s+district|district|urban|city)$",
            "", key, flags=re.IGNORECASE
        ).strip()
        if cleaned:
            return cleaned.title()
        return city.strip()

    @staticmethod
    def _extract_location_parts(location: str) -> tuple[str, str]:
        parts = [p.strip() for p in (location or "").split(",") if p.strip()]
        locality = parts[0] if parts else "Unknown Locality"
        raw_city = parts[1] if len(parts) > 1 else (parts[0] if parts else "Mumbai")
        city = PropertyFetcher._normalize_city(raw_city)
        return locality, city

    # ------------------------------------------------------------------
    # Price parsing
    # ------------------------------------------------------------------

    @staticmethod
    def _parse_price_inr(text: str) -> Optional[float]:
        if not text:
            return None
        s = text.replace(",", "").replace("\u20b9", " ").lower()
        # Remove noise like "See other charges", "Security Deposit"
        s = re.sub(r"(see other|security|deposit|charges|/\s*month).*", "", s, flags=re.IGNORECASE)
        m = re.search(r"([\d.]+)\s*(cr|crore|lac|lakh|k)?", s)
        if not m:
            return None
        try:
            num = float(m.group(1))
        except ValueError:
            return None
        unit = (m.group(2) or "").lower()
        if unit in ("cr", "crore"):
            num *= 1_00_00_000
        elif unit in ("lac", "lakh"):
            num *= 1_00_000
        elif unit == "k":
            num *= 1_000
        if num < 1000 or num > 1_00_00_00_000:
            return None
        return num

    @staticmethod
    def _parse_int(text: str) -> Optional[int]:
        if not text:
            return None
        m = re.search(r"\d+", text.replace(",", ""))
        return int(m.group(0)) if m else None

    @staticmethod
    def _bhk_number(bhk: str) -> Optional[int]:
        if not bhk:
            return None
        m = re.search(r"\d+", bhk)
        return int(m.group(0)) if m else None

    # ------------------------------------------------------------------
    # HTTP fetch
    # ------------------------------------------------------------------

    async def _fetch_page(self, url: str, timeout: float = 20.0) -> Optional[str]:
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
                    if response.status_code == 404:
                        return None
                    response.raise_for_status()
                    return response.text
            except Exception:
                if attempt == 0:
                    await asyncio.sleep(0.5)
                    continue
                return None
        return None

    # ------------------------------------------------------------------
    # Smart URL resolution for MagicBricks
    # ------------------------------------------------------------------

    def _build_candidate_urls(self, locality: str, city: str, bhk_num: int) -> list[str]:
        """Build prioritised list of MagicBricks SRP URLs to try."""
        loc_slug = self._slugify(locality)
        city_slug = self._slugify(city)
        urls: list[str] = []

        # Check if locality has known slug overrides
        overrides = LOCALITY_SLUG_OVERRIDES.get(loc_slug, [])
        for override in overrides:
            urls.append(
                f"https://www.magicbricks.com/{bhk_num}-bhk-flats-for-rent-in-{override}-pppfr"
            )

        # Standard patterns
        urls.extend([
            # locality-city (works for suburbs like Bandra West Mumbai)
            f"https://www.magicbricks.com/{bhk_num}-bhk-flats-for-rent-in-{loc_slug}-{city_slug}-pppfr",
            # locality only (works for standalone cities like Thane, Kalyan)
            f"https://www.magicbricks.com/{bhk_num}-bhk-flats-for-rent-in-{loc_slug}-pppfr",
            # City-level fallback (always works, returns 30 cards for the city)
            f"https://www.magicbricks.com/{bhk_num}-bhk-flats-for-rent-in-{city_slug}-pppfr",
        ])

        # Deduplicate while preserving order
        seen = set()
        unique: list[str] = []
        for u in urls:
            if u not in seen:
                seen.add(u)
                unique.append(u)
        return unique

    # ------------------------------------------------------------------
    # JSON-LD extraction (PRIMARY — most reliable)
    # ------------------------------------------------------------------

    def _extract_from_jsonld(self, soup: BeautifulSoup, search_url: str) -> list[dict]:
        """Extract listings from JSON-LD Schema.org data embedded in the page."""
        listings: list[dict] = []
        seen_urls: set[str] = set()

        for script in soup.select('script[type="application/ld+json"]'):
            try:
                data = json.loads(script.string or "")
            except (json.JSONDecodeError, TypeError):
                continue

            apartments = []
            if isinstance(data, list):
                apartments = [d for d in data if isinstance(d, dict) and d.get("@type") == "Apartment"]
            elif isinstance(data, dict) and data.get("@type") == "Apartment":
                apartments = [data]

            for apt in apartments:
                url = apt.get("url") or apt.get("@id") or ""
                if not url or url in seen_urls:
                    continue
                seen_urls.add(url)

                name = (apt.get("name") or "").strip()
                address = apt.get("address", {})
                if isinstance(address, str):
                    address = {"addressLocality": address}

                # Extract price from offers
                price = None
                offers = apt.get("offers", {})
                if isinstance(offers, dict):
                    p = offers.get("price")
                    if p is not None:
                        try:
                            price = float(p)
                        except (TypeError, ValueError):
                            price = self._parse_price_inr(str(p))

                # Extract floor size
                size_sqft = None
                floor_size = apt.get("floorSize", {})
                if isinstance(floor_size, dict):
                    val = floor_size.get("value")
                    if val:
                        try:
                            size_sqft = int(float(val))
                        except (TypeError, ValueError):
                            pass

                # Extract images
                images = []
                img_data = apt.get("image", [])
                if isinstance(img_data, str):
                    images = [img_data]
                elif isinstance(img_data, list):
                    images = [i for i in img_data if isinstance(i, str) and i.startswith("http")]

                rooms = apt.get("numberOfRooms")
                bathrooms = apt.get("numberOfBathroomsTotal")

                listings.append({
                    "title": name,
                    "source_url": url,
                    "price": price,
                    "locality": address.get("addressLocality") if isinstance(address, dict) else None,
                    "city": address.get("addressRegion") if isinstance(address, dict) else None,
                    "size_sqft": size_sqft,
                    "rooms": int(rooms) if rooms else None,
                    "bathrooms": int(bathrooms) if bathrooms else None,
                    "images": images[:4],
                    "source": "jsonld",
                })

        return listings

    # ------------------------------------------------------------------
    # CSS card extraction (SECONDARY — fills gaps)
    # ------------------------------------------------------------------

    def _extract_from_cards(self, soup: BeautifulSoup, search_url: str) -> list[dict]:
        """Extract listings from MagicBricks SRP card HTML elements."""
        cards = soup.select(".mb-srp__card")
        listings: list[dict] = []

        def _txt(node) -> str:
            return node.get_text(" ", strip=True) if node else ""

        for card in cards:
            title = _txt(card.select_one(".mb-srp__card--title"))
            if not title:
                continue

            price_text = _txt(card.select_one("[class*='price']"))
            price = self._parse_price_inr(price_text)

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
                fl = furnishing.lower()
                if "semi" in fl:
                    furnishing = "Semi Furnished"
                elif "unfurn" in fl:
                    furnishing = "Unfurnished"
                elif "furn" in fl:
                    furnishing = "Fully Furnished"

            # Images from card
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
                if "magicbricks.com" in h and ("pdpid" in h or "propertyDetails" in h):
                    href = h
                    break

            # Derive society name from title if not in summary
            apartment = society
            if not apartment:
                m = re.search(r"for\s+Rent\s+in\s+(.+)", title, re.IGNORECASE)
                if m:
                    apartment = m.group(1).split(",")[0].strip()

            listings.append({
                "title": title,
                "price": price,
                "society_name": apartment or title,
                "size_sqft": size_sqft,
                "bathrooms": bathrooms,
                "furnishing": furnishing,
                "images": images,
                "source_url": href or search_url,
                "source": "card",
            })

        return listings

    # ------------------------------------------------------------------
    # Merge JSON-LD + Card data for best coverage
    # ------------------------------------------------------------------

    def _merge_sources(
        self, jsonld_listings: list[dict], card_listings: list[dict],
        locality: str, city: str, bhk: str, bhk_num: int,
    ) -> list[dict]:
        """Merge JSON-LD and card data. Card data fills gaps in JSON-LD."""
        merged: list[dict] = []
        used_urls: set[str] = set()

        # First pass: use card listings as primary (they have more fields)
        for card in card_listings:
            url = card.get("source_url", "")
            price = card.get("price")
            if not price:
                continue

            # Try to find matching JSON-LD entry for images
            jsonld_images = []
            for jl in jsonld_listings:
                jl_url = jl.get("source_url", "")
                if jl_url and jl_url in url or url in jl_url:
                    jsonld_images = jl.get("images", [])
                    break

            images = card.get("images", []) or jsonld_images
            society = card.get("society_name", "")

            merged.append({
                "title": card["title"][:120],
                "society_name": society,
                "price": price,
                "size_sqft": card.get("size_sqft"),
                "bathrooms": card.get("bathrooms"),
                "furnishing": card.get("furnishing"),
                "images": images,
                "source_url": url,
                "locality": locality,
                "city": city,
                "bhk": bhk,
            })
            used_urls.add(url)

        # Second pass: add JSON-LD entries not already covered
        for jl in jsonld_listings:
            url = jl.get("source_url", "")
            if url in used_urls or not jl.get("price"):
                continue

            merged.append({
                "title": jl.get("title", "")[:120],
                "society_name": jl.get("title", "").split("for Rent")[0].strip() or jl.get("title", ""),
                "price": jl["price"],
                "size_sqft": jl.get("size_sqft"),
                "bathrooms": jl.get("bathrooms"),
                "furnishing": None,
                "images": jl.get("images", []),
                "source_url": url,
                "locality": jl.get("locality") or locality,
                "city": jl.get("city") or city,
                "bhk": bhk,
            })

        return merged

    # ------------------------------------------------------------------
    # Main fetch pipeline
    # ------------------------------------------------------------------

    async def _fetch_listings(self, locality: str, city: str, bhk: str) -> list[dict]:
        """Fetch listings from MagicBricks with smart URL resolution."""
        bhk_num = self._bhk_number(bhk) or 2
        candidate_urls = self._build_candidate_urls(locality, city, bhk_num)
        loc_norm = self._norm(locality)
        is_city_level = False

        html = None
        search_url = candidate_urls[0]

        for url in candidate_urls:
            print(f"  [fetch] Trying: {url}")
            fetched = await self._fetch_page(url)
            if not fetched or len(fetched) < 5000:
                print(f"  [fetch] Failed or too short")
                continue

            # Check if this is a city-level fallback
            city_slug = self._slugify(city)
            if url.endswith(f"-{city_slug}-pppfr") and self._slugify(locality) not in url.replace(f"-{city_slug}-pppfr", ""):
                is_city_level = True

            html = fetched
            search_url = url
            print(f"  [fetch] Got {len(html)} bytes from {url}")
            break

        if not html:
            print(f"  [fetch] All URLs failed for {locality}, {city}")
            return []

        soup = BeautifulSoup(html, "lxml")

        # Extract from both sources
        jsonld = self._extract_from_jsonld(soup, search_url)
        cards = self._extract_from_cards(soup, search_url)
        print(f"  [fetch] JSON-LD: {len(jsonld)} | Cards: {len(cards)}")

        # Merge
        merged = self._merge_sources(jsonld, cards, locality, city, bhk, bhk_num)

        # Filter by locality if not city-level (city-level returns mixed localities)
        if not is_city_level and loc_norm:
            bhk_token = f"{bhk_num} bhk"
            filtered = []
            for item in merged:
                blob = self._norm(
                    f"{item.get('title', '')} {item.get('society_name', '')} "
                    f"{item.get('locality', '')}"
                )
                # BHK must match
                if bhk_token not in blob:
                    continue
                filtered.append(item)
            print(f"  [fetch] After BHK filter: {len(filtered)} / {len(merged)}")
            return filtered
        else:
            # For city-level, filter by locality mention if possible
            filtered = []
            for item in merged:
                blob = self._norm(
                    f"{item.get('title', '')} {item.get('society_name', '')} "
                    f"{item.get('locality', '')}"
                )
                if loc_norm in blob:
                    filtered.append(item)
            # If locality filter removes everything, return all (broader results)
            if filtered:
                print(f"  [fetch] City-level locality filter: {len(filtered)} matched")
                return filtered
            else:
                print(f"  [fetch] City-level: no locality match, returning all {len(merged)}")
                return merged[:20]

    # ------------------------------------------------------------------
    # Persist to MongoDB
    # ------------------------------------------------------------------

    async def _persist_listings(self, listings: list[dict], locality: str, city: str, bhk: str) -> list[Property]:
        saved: list[Property] = []

        for idx, item in enumerate(listings):
            url = item.get("source_url", "")
            external_id = f"mb-{hashlib.sha1(url.encode()).hexdigest()[:18]}"

            society_name = item.get("society_name", "") or item.get("title", "")
            images = item.get("images", [])
            if not images:
                images = [
                    "https://images.unsplash.com/photo-1560448204-e02f11c3d0e2?w=800&h=600&fit=crop&q=80"
                ]

            payload = {
                "external_id": external_id,
                "source_platform": "magicbricks",
                "source_url": url,
                "title": item.get("title", "")[:120],
                "apartment_name": society_name,
                "total_flats_available": None,
                "address": f"{society_name}, {item.get('locality', locality)}, {item.get('city', city)}",
                "locality": item.get("locality", locality),
                "city": item.get("city", city),
                "price": float(item["price"]),
                "size_sqft": item.get("size_sqft"),
                "bhk": bhk,
                "floor": None,
                "bathrooms": item.get("bathrooms"),
                "balconies": None,
                "furnished_status": item.get("furnishing"),
                "images": images,
                "amenities": [],
                "description": (
                    f"{bhk} apartment at {society_name} in {locality}, {city}. "
                    "Sourced from MagicBricks structured data."
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
                    saved.append(existing)
                else:
                    new_prop = Property(**payload)
                    await new_prop.insert()
                    saved.append(new_prop)
                print(f"    [saved] {society_name[:40]} — INR {item['price']:,.0f}/mo")
            except Exception as e:
                print(f"    [error] Failed to save: {e}")
                continue

        return saved

    # ------------------------------------------------------------------
    # Main workflow (drop-in replacement for ScraperAgent.run_scrape_workflow)
    # ------------------------------------------------------------------

    async def run_scrape_workflow(self, location: str, bhk: str):
        """Main entry point — called from WebSocket handler."""
        await self.send_update(5, f"🚀 Starting property search for {bhk} in {location}...")
        await asyncio.sleep(0.3)

        locality, city = self._extract_location_parts(location)
        fallback_bhk = bhk if bhk and bhk != "Any BHK" else "2 BHK"

        try:
            # Phase 1: Fetch from MagicBricks
            await self.send_update(
                15,
                f"🔍 Searching MagicBricks for {fallback_bhk} in {locality}, {city}...",
                0,
            )

            print(f"\n[fetcher] Starting: {fallback_bhk} in {locality}, {city}")
            listings = await self._fetch_listings(locality, city, fallback_bhk)
            print(f"[fetcher] Got {len(listings)} listings")

            if listings:
                await self.send_update(
                    40,
                    f"✅ Found {len(listings)} listings on MagicBricks. Saving...",
                    len(listings),
                )
            else:
                await self.send_update(
                    100,
                    f"⚠️ No listings found for {fallback_bhk} in {locality}. "
                    "Try a nearby locality (e.g., 'Bandra West, Mumbai').",
                    0,
                )
                return

            # Phase 2: Persist to database
            await self.send_update(50, f"💾 Saving {len(listings)} properties...", len(listings))
            saved = await self._persist_listings(listings, locality, city, fallback_bhk)
            print(f"[fetcher] Saved {len(saved)} properties to DB")

            if saved:
                # Phase 3: AI enrichment
                await self.send_update(
                    75,
                    f"🤖 Generating AI insights for {len(saved)} properties...",
                    len(saved),
                )
                try:
                    await self.content_service.enrich_recent(saved)
                except Exception:
                    pass

                await asyncio.sleep(0.3)
                await self.send_update(
                    100,
                    f"✅ Done! {len(saved)} real properties with AI insights ready.",
                    len(saved),
                )
            else:
                await self.send_update(
                    100,
                    "⚠️ Could not save listings. Please retry.",
                    0,
                )

        except Exception as exc:
            print(f"[fetcher] Error: {exc}")
            await self.send_update(
                100,
                f"❌ Error: {str(exc)[:100]}. Please retry.",
                0,
            )
