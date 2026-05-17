"""Quick test: does the SSR parser find listings from MagicBricks?"""
import asyncio
import sys
import os

# Add backend to path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from services.scraper_agent import ScraperAgent


class FakeWS:
    async def send_text(self, text):
        import json
        data = json.loads(text)
        print(f"  [{data.get('progress', 0)}%] {data.get('status', '')}")


async def main():
    agent = ScraperAgent(FakeWS())
    listings, url = await agent._scrape_magicbricks("Malad East", "Mumbai", 3)
    print(f"\n=== Got {len(listings)} listings from {url} ===")
    for i, l in enumerate(listings[:5]):
        print(f"\n--- Listing {i+1} ---")
        print(f"  Title: {l['title']}")
        print(f"  Price: {l['price']}")
        print(f"  Society: {l['society_name']}")
        print(f"  Sqft: {l['size_sqft']}")
        print(f"  Baths: {l['bathrooms']}")
        print(f"  URL: {l['source_url'][:80]}")


asyncio.run(main())
