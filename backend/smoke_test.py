"""
Smoke test for the live scraper agent.
Tests: gemini research → image search → persist.

Usage:
  python smoke_test.py search      # Test Gemini research (no DB needed)
  python smoke_test.py full        # Full workflow with DB persistence
"""
import asyncio
import json
import sys
import os

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))


class FakeWebSocket:
    """Mock WebSocket that prints updates."""
    async def send_text(self, data: str):
        parsed = json.loads(data)
        progress = parsed.get("progress", 0)
        status = parsed.get("status", "")
        found = parsed.get("found_count", 0)
        print(f"  [{progress:3d}%] found={found} | {status}")


async def test_gemini_research():
    """Test Gemini property research (primary data source)."""
    from services.gemini_extractor import GeminiExtractor

    extractor = GeminiExtractor()

    location = "Bandra West, Mumbai"
    bhk = "2 BHK"

    print(f"\n{'='*60}")
    print(f"  Testing Gemini Research: '{bhk}' in '{location}'")
    print(f"{'='*60}\n")

    locality = location.split(",")[0].strip()
    city = location.split(",")[1].strip() if "," in location else "Mumbai"

    results = await extractor.research_properties(
        locality=locality, city=city, bhk=bhk, count=8
    )

    print(f"\n  RESULT: {len(results)} properties found\n")

    for i, prop in enumerate(results):
        name = prop.get("society_name", "?")
        rent = prop.get("approximate_rent", 0)
        size = prop.get("typical_size_sqft", "N/A")
        furnish = prop.get("furnishing", "N/A")
        amenities = prop.get("amenities", [])
        desc = (prop.get("description") or "")[:100]

        print(f"  {i+1}. {name}")
        print(f"     Rent: ₹{rent:,.0f}/mo | Size: {size} sqft | {furnish}")
        print(f"     Amenities: {', '.join(amenities[:4])}")
        if desc:
            print(f"     {desc}")
        print()

    return results


async def test_full_workflow():
    """Test the full workflow with DB persistence."""
    from database.connection import init_db
    from services.scraper_agent import ScraperAgent

    print(f"\n{'='*60}")
    print(f"  Testing Full Workflow (with DB)")
    print(f"{'='*60}\n")

    await init_db()

    ws = FakeWebSocket()
    agent = ScraperAgent(ws)

    await agent.run_scrape_workflow("Bandra West, Mumbai", "2 BHK")

    from database.models.property import Property
    props = await Property.find(
        {"locality": {"$regex": "Bandra", "$options": "i"}}
    ).to_list()

    print(f"\n{'='*60}")
    print(f"  RESULT: {len(props)} properties in DB for Bandra")
    print(f"{'='*60}\n")
    for p in props[:8]:
        print(f"  {p.title}")
        print(f"    Price: ₹{p.price:,.0f}/mo | BHK: {p.bhk} | Platform: {p.source_platform}")
        print(f"    Images: {len(p.images)} | Apartment: {p.apartment_name}")
        print()


async def main():
    mode = sys.argv[1] if len(sys.argv) > 1 else "search"

    if mode == "search":
        await test_gemini_research()
    elif mode == "full":
        await test_full_workflow()
    else:
        print("Usage: python smoke_test.py [search|full]")


if __name__ == "__main__":
    asyncio.run(main())
