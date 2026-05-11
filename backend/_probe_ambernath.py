import asyncio, httpx, re
from bs4 import BeautifulSoup

async def probe():
    headers = {'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/125.0.0.0 Safari/537.36'}
    urls = [
        'https://www.magicbricks.com/3-bhk-flats-for-rent-in-ambernath-mumbai-pppfr',
        'https://www.magicbricks.com/3-bhk-flats-for-rent-in-ambernath-pppfr',
    ]
    for url in urls:
        print(f"\nURL: {url}")
        async with httpx.AsyncClient(timeout=20, follow_redirects=True, headers=headers) as c:
            r = await c.get(url)
        print(f"  status: {r.status_code}  len: {len(r.text)}")
        soup = BeautifulSoup(r.text, 'lxml')
        cards = soup.select('.mb-srp__card')
        print(f"  cards: {len(cards)}")
        txt = soup.get_text(' ', strip=True)[:5000].lower()
        print(f"  'ambernath' in page text: {'ambernath' in txt}")
        for card in cards[:3]:
            title = card.select_one('.mb-srp__card--title')
            t = title.get_text(' ', strip=True) if title else 'no title'
            print(f"    -> {t}")

asyncio.run(probe())
