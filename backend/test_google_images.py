"""Test Google Custom Search API with real CX."""
import httpx

API_KEY = "AIzaSyCitP6muV7l5lOP8CJQjYDLYC56ZbkGvZA"
CX = "6776a554dd51d480c"

query = "Hiranandani Gardens Powai Mumbai apartment building exterior"

r = httpx.get(
    "https://www.googleapis.com/customsearch/v1",
    params={
        "key": API_KEY,
        "cx": CX,
        "q": query,
        "searchType": "image",
        "num": 5,
        "imgType": "photo",
        "safe": "active",
    },
    timeout=15.0,
)

print(f"Status: {r.status_code}")
data = r.json()

if "error" in data:
    print(f"ERROR: {data['error']['message']}")
elif "items" in data:
    print(f"Found {len(data['items'])} images!\n")
    for i, item in enumerate(data["items"]):
        print(f"[{i+1}] {item['link'][:120]}")
        print(f"     Title: {item['title'][:80]}")
else:
    print("No items in response")
    print(data)
