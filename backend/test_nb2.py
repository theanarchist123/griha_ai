import asyncio, sys, os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from services.scraper_agent import ScraperAgent

class FakeWS:
    async def send_text(self, text): pass

async def test():
    agent = ScraperAgent(FakeWS())
    res, url = await agent._scrape_nobroker('Malad East', 'Mumbai', 3)
    print(f'Found {len(res)} results from url {url}')
    if res:
        for item in res[:2]:
            print(f" - {item['title']}: {item['price']}")

asyncio.run(test())
