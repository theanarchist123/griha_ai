from duckduckgo_search import DDGS

results = list(DDGS().images("Hiranandani Gardens Powai Mumbai apartment building", max_results=5))
print(f"Found {len(results)} images")
for r in results:
    print(f"  -> {r['image'][:120]}")
    print(f"     Title: {r.get('title', '')[:80]}")
