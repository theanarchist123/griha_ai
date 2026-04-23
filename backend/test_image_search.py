"""Test DDG image search and Google Custom Search API."""
import httpx
import re
import json

# === Test 1: DDG Image Search (free, no API key) ===
print("=" * 50)
print("TEST 1: DuckDuckGo Image Search")
print("=" * 50)

query = "Hiranandani Gardens Powai Mumbai apartment building"
headers = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36"
}

try:
    with httpx.Client(headers=headers, follow_redirects=True, timeout=15.0) as c:
        r = c.get("https://duckduckgo.com/", params={"q": query})
        vqd_match = re.search(r"vqd=['\"]([^'\"]+)", r.text)
        if not vqd_match:
            vqd_match = re.search(r"vqd=([^&\"'\s]+)", r.text)
        
        if vqd_match:
            vqd = vqd_match.group(1)
            print(f"  VQD token: {vqd[:30]}...")
            
            img_url = "https://duckduckgo.com/i.js"
            params = {
                "l": "us-en",
                "o": "json", 
                "q": query,
                "vqd": vqd,
                "f": ",,,,,",
                "p": "1",
            }
            r2 = c.get(img_url, params=params)
            print(f"  Status: {r2.status_code}")
            
            if r2.status_code == 200:
                data = r2.json()
                results = data.get("results", [])
                print(f"  Found {len(results)} images!")
                for i, img in enumerate(results[:5]):
                    print(f"    [{i+1}] {img.get('image', '')[:120]}")
                    print(f"        Title: {img.get('title', '')[:80]}")
            else:
                print(f"  Response: {r2.text[:200]}")
        else:
            print("  No VQD token found. DDG may have changed format.")
            print(f"  Page snippet: {r.text[:300]}")
except Exception as e:
    print(f"  DDG test failed: {e}")

# === Test 2: Google Custom Search API ===
print("\n" + "=" * 50)
print("TEST 2: Google Custom Search API (key only, no CX)")
print("=" * 50)

api_key = "AIzaSyCitP6muV7l5lOP8CJQjYDLYC56ZbkGvZA"

try:
    r = httpx.get(
        "https://www.googleapis.com/customsearch/v1",
        params={"key": api_key, "q": "test"},
        timeout=10.0,
    )
    print(f"  Status: {r.status_code}")
    data = r.json()
    err = data.get("error", {})
    if r.status_code == 403:
        print(f"  KEY INVALID or disabled: {err.get('message', '')}")
    elif r.status_code == 400:
        print(f"  KEY VALID! Error = {err.get('message', '')} (expected - needs CX)")
    elif r.status_code == 200:
        print(f"  KEY WORKS! Got results.")
    else:
        print(f"  Status {r.status_code}: {err.get('message', '')}")
except Exception as e:
    print(f"  Google test failed: {e}")
