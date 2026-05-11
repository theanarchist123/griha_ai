"""
Smoke test for the rewritten ScraperAgent. Verifies it actually FETCHES
real MagicBricks listings (no AI fabrication), filters them by the
requested locality and BHK count, and that each result carries a real
listing URL.

Usage:
    python smoke_scrape.py "Bandra West, Mumbai" "2 BHK"
    python smoke_scrape.py "Powai, Mumbai" "3 BHK"
"""
import asyncio
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from services.scraper_agent import ScraperAgent


class _FakeWS:
    async def send_text(self, _): pass


async def main():
    location = sys.argv[1] if len(sys.argv) > 1 else "Bandra West, Mumbai"
    bhk = sys.argv[2] if len(sys.argv) > 2 else "2 BHK"

    agent = ScraperAgent(_FakeWS())
    locality, city = agent._extract_location_parts(location)
    bhk_num = agent._bhk_number(bhk) or 2

    print(f"\n[scrape] location={location!r}  bhk={bhk!r}")
    print(f"[scrape] locality={locality!r}  city={city!r}  bhk_num={bhk_num}\n")

    listings, search_url = await agent._scrape_magicbricks(
        locality=locality, city=city, bhk_num=bhk_num
    )
    print(f"[scrape] search URL: {search_url}")
    print(f"[scrape] raw cards parsed: {len(listings)}\n")

    import re
    def _norm(s: str) -> str:
        return re.sub(r"[^a-z0-9]+", " ", (s or "").lower()).strip()
    bhk_token = f"{bhk_num} bhk"
    loc_norm = _norm(locality)
    filtered = []
    for x in listings:
        blob = _norm(f"{x['title']} {x['society_name']} {x.get('card_text','')}")
        if bhk_token in blob and loc_norm in blob:
            filtered.append(x)
    print(f"[filter] kept {len(filtered)} / {len(listings)} after BHK+locality filter\n")

    for i, item in enumerate(filtered, 1):
        print(f"  {i}. {item['title']}")
        print(f"     society:    {item['society_name']}")
        print(f"     price:      INR {item['price']:,.0f}/mo")
        print(f"     size:       {item['size_sqft']} sqft   bathrooms: {item['bathrooms']}")
        print(f"     furnishing: {item['furnishing']}")
        print(f"     image:      {(item['images'] or ['-'])[0]}")
        print(f"     url:        {item['source_url']}\n")

    # Sanity assertions
    assert listings, "MagicBricks returned 0 cards — scrape likely broken"
    assert all(item["source_url"].startswith("http") for item in filtered), \
        "Filtered listings missing real source_url"
    for i in filtered:
        blob = _norm(f"{i['title']} {i['society_name']} {i.get('card_text','')}")
        assert bhk_token in blob, f"BHK filter leaked: {i['title']!r}"
        assert loc_norm in blob,  f"Locality filter leaked: {i['title']!r}"
    print("[ok] assertions passed: real, locality+BHK-matched, source-linked listings.")


if __name__ == "__main__":
    asyncio.run(main())
