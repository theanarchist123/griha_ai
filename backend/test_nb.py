import sys
import os
import asyncio
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from services.scraper_agent import ScraperAgent

class FakeWS:
    async def send_text(self, text): pass

async def test():
    agent = ScraperAgent(FakeWS())
    res, url = await agent._scrape_nobroker("Malad East", "Mumbai", 3)
    print(f"Found {len(res)} results")
    if res:
        for item in res[:3]:
            print(f" - {item['title']}: {item['price']} ({item['size_sqft']} sqft)")
            print(f"   {item['source_url']}")

asyncio.run(test())
