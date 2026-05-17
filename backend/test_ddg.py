import sys
import os
import asyncio
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from services.scraper_agent import ScraperAgent

class FakeWS:
    async def send_text(self, text): pass

async def test():
    agent = ScraperAgent(FakeWS())
    res = await agent._ddg_search('3 BHK rent in Malad East Mumbai site:magicbricks.com OR site:nobroker.in OR site:housing.com')
    print(f"Found {len(res)} results")
    if res:
        for item in res:
            print(f" - {item['title']} : {item['url']}")

asyncio.run(test())
