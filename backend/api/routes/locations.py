from typing import List, Optional

import httpx
from fastapi import APIRouter, HTTPException, Query

router = APIRouter(prefix="/api/locations", tags=["Locations"])

NOMINATIM_SEARCH_URL = "https://nominatim.openstreetmap.org/search"
NOMINATIM_REVERSE_URL = "https://nominatim.openstreetmap.org/reverse"
USER_AGENT = "griha-ai-locations/1.0"

# Comprehensive Indian localities for instant local matching.
# Nominatim supplements these; if Nominatim fails, these still work.
LOCAL_LOCATIONS = [
    # Mumbai
    "Andheri East, Mumbai", "Andheri West, Mumbai", "Bandra East, Mumbai",
    "Bandra West, Mumbai", "Borivali East, Mumbai", "Borivali West, Mumbai",
    "Chembur, Mumbai", "Colaba, Mumbai", "Dadar, Mumbai", "Dahisar, Mumbai",
    "Dombivli, Mumbai", "Ghatkopar East, Mumbai", "Ghatkopar West, Mumbai",
    "Goregaon East, Mumbai", "Goregaon West, Mumbai", "Jogeshwari, Mumbai",
    "Juhu, Mumbai", "Kalyan, Mumbai", "Kandivali East, Mumbai",
    "Kandivali West, Mumbai", "Khar West, Mumbai", "Lower Parel, Mumbai",
    "Mahim, Mumbai", "Malad East, Mumbai", "Malad West, Mumbai",
    "Mira Road, Mumbai", "Mulund, Mumbai", "Navi Mumbai, Maharashtra",
    "Panvel, Navi Mumbai", "Kharghar, Navi Mumbai", "Vashi, Navi Mumbai",
    "Powai, Mumbai", "Santacruz, Mumbai", "Thane West, Thane",
    "Thane East, Thane", "Thane, Maharashtra", "Versova, Mumbai",
    "Vikhroli, Mumbai", "Virar, Mumbai", "Worli, Mumbai",
    "Ambernath, Thane", "Badlapur, Thane", "Ulhasnagar, Thane",
    "Bhiwandi, Thane", "Airoli, Navi Mumbai", "Nerul, Navi Mumbai",
    "Belapur, Navi Mumbai", "Vasai, Mumbai", "Nala Sopara, Mumbai",
    "Kurla, Mumbai", "Sion, Mumbai", "Wadala, Mumbai", "Prabhadevi, Mumbai",
    "Matunga, Mumbai", "Girgaon, Mumbai", "Fort, Mumbai", "Tardeo, Mumbai",
    # Bangalore
    "Koramangala, Bangalore", "Indiranagar, Bangalore", "HSR Layout, Bangalore",
    "Whitefield, Bangalore", "Electronic City, Bangalore", "Marathahalli, Bangalore",
    "JP Nagar, Bangalore", "Jayanagar, Bangalore", "BTM Layout, Bangalore",
    "Hebbal, Bangalore", "Yelahanka, Bangalore", "Sarjapur Road, Bangalore",
    "Bannerghatta Road, Bangalore", "Rajajinagar, Bangalore",
    "Malleshwaram, Bangalore", "Bangalore, Karnataka",
    # Delhi NCR
    "Connaught Place, Delhi", "Dwarka, Delhi", "Saket, Delhi",
    "Vasant Kunj, Delhi", "Lajpat Nagar, Delhi", "Rohini, Delhi",
    "Noida, Uttar Pradesh", "Gurgaon, Haryana", "Greater Noida, Uttar Pradesh",
    "Ghaziabad, Uttar Pradesh", "Faridabad, Haryana", "Delhi, NCR",
    # Pune
    "Kothrud, Pune", "Hinjewadi, Pune", "Wakad, Pune", "Baner, Pune",
    "Viman Nagar, Pune", "Koregaon Park, Pune", "Hadapsar, Pune",
    "Kharadi, Pune", "Pimple Saudagar, Pune", "Aundh, Pune",
    "Pune, Maharashtra",
    # Hyderabad
    "Gachibowli, Hyderabad", "HITEC City, Hyderabad", "Kondapur, Hyderabad",
    "Madhapur, Hyderabad", "Banjara Hills, Hyderabad", "Jubilee Hills, Hyderabad",
    "Kukatpally, Hyderabad", "Miyapur, Hyderabad", "Hyderabad, Telangana",
    # Chennai
    "T Nagar, Chennai", "Anna Nagar, Chennai", "Adyar, Chennai",
    "Velachery, Chennai", "OMR, Chennai", "Porur, Chennai",
    "Tambaram, Chennai", "Chennai, Tamil Nadu",
    # Kolkata
    "Salt Lake, Kolkata", "New Town, Kolkata", "Park Street, Kolkata",
    "Howrah, Kolkata", "Kolkata, West Bengal",
    # Others
    "Ahmedabad, Gujarat", "Jaipur, Rajasthan", "Lucknow, Uttar Pradesh",
    "Chandigarh, Punjab", "Indore, Madhya Pradesh", "Kochi, Kerala",
    "Thiruvananthapuram, Kerala", "Coimbatore, Tamil Nadu",
    "Visakhapatnam, Andhra Pradesh", "Bhopal, Madhya Pradesh",
    "Nagpur, Maharashtra", "Nashik, Maharashtra",
]

import re

# Nominatim returns verbose city names. Normalize to short ones.
_CITY_MAP = {
    "mumbai city district": "Mumbai", "mumbai suburban district": "Mumbai",
    "mumbai suburban": "Mumbai", "mumbai city": "Mumbai",
    "greater mumbai": "Mumbai", "brihanmumbai": "Mumbai",
    "bangalore urban": "Bangalore", "bangalore urban district": "Bangalore",
    "bengaluru urban": "Bangalore", "bengaluru": "Bangalore",
    "new delhi district": "Delhi", "new delhi": "Delhi",
    "south delhi": "Delhi", "north delhi": "Delhi",
    "central delhi": "Delhi", "east delhi": "Delhi", "west delhi": "Delhi",
    "pune district": "Pune", "pune city": "Pune",
    "hyderabad district": "Hyderabad", "chennai district": "Chennai",
    "kolkata district": "Kolkata", "thane district": "Thane",
    "thane city": "Thane", "gurugram": "Gurgaon",
    "gurgaon district": "Gurgaon", "gautam buddha nagar": "Noida",
    "ernakulam": "Kochi", "ernakulam district": "Kochi",
}


def _normalize_city(city: str) -> str:
    key = city.strip().lower()
    if key in _CITY_MAP:
        return _CITY_MAP[key]
    cleaned = re.sub(
        r"\s+(city\s+district|suburban\s+district|urban\s+district|district|urban|city)$",
        "", key, flags=re.IGNORECASE
    ).strip()
    return cleaned.title() if cleaned else city.strip()


def _format_location(item: dict) -> Optional[str]:
    """Extract a concise 'Locality, City' string from a Nominatim result."""
    address = item.get("address", {}) or {}
    locality = (
        address.get("suburb")
        or address.get("neighbourhood")
        or address.get("city_district")
        or address.get("town")
        or address.get("city")
        or address.get("village")
    )
    city = address.get("city") or address.get("town") or address.get("state_district") or address.get("state")

    # Normalize verbose Nominatim city names
    city = _normalize_city(city) if city else city

    if locality and city and locality != city:
        return f"{locality}, {city}"
    if locality:
        return str(locality)
    if city:
        return str(city)

    display_name = item.get("display_name")
    if isinstance(display_name, str) and display_name.strip():
        parts = [part.strip() for part in display_name.split(",") if part.strip()]
        return ", ".join(parts[:2]) if parts else display_name.strip()

    return None


def _local_match(query: str, limit: int = 10) -> List[str]:
    """Instant fuzzy match against built-in locality list."""
    q = query.lower().strip()
    if not q:
        return []

    # Exact-prefix matches first, then substring matches
    prefix: List[str] = []
    substring: List[str] = []
    for loc in LOCAL_LOCATIONS:
        low = loc.lower()
        # Match on locality part (before comma) primarily
        locality_part = low.split(",")[0].strip()
        if locality_part.startswith(q):
            prefix.append(loc)
        elif q in low:
            substring.append(loc)
        if len(prefix) + len(substring) >= limit * 2:
            break

    combined = prefix + substring
    # Deduplicate preserving order
    seen: set[str] = set()
    result: List[str] = []
    for item in combined:
        if item not in seen:
            seen.add(item)
            result.append(item)
        if len(result) >= limit:
            break
    return result


@router.get("/autocomplete", response_model=List[str])
async def autocomplete_locations(q: str = Query(..., min_length=1)):
    """Returns top location suggestions. Local list first, Nominatim supplements."""
    normalized_query = q.strip()
    if not normalized_query:
        return []

    # Step 1: Instant local matches (always fast, never fails)
    local_results = _local_match(normalized_query, limit=10)

    # Step 2: Try Nominatim for broader/uncommon locations
    nominatim_results: List[str] = []
    try:
        params = {
            "q": normalized_query,
            "format": "jsonv2",
            "addressdetails": 1,
            "limit": 8,
            "countrycodes": "in",
        }
        async with httpx.AsyncClient(timeout=6.0, headers={"User-Agent": USER_AGENT}) as client:
            response = await client.get(NOMINATIM_SEARCH_URL, params=params)
            response.raise_for_status()
            payload = response.json()

        if isinstance(payload, list):
            for item in payload:
                if not isinstance(item, dict):
                    continue
                formatted = _format_location(item)
                if formatted:
                    nominatim_results.append(formatted)
    except Exception:
        pass  # Local results handle it

    # Step 3: Merge — local first, then Nominatim extras
    seen: set[str] = set()
    merged: List[str] = []
    for item in local_results + nominatim_results:
        key = item.lower().strip()
        if key not in seen:
            seen.add(key)
            merged.append(item)
        if len(merged) >= 10:
            break

    return merged


@router.get("/reverse")
async def reverse_geocode_location(
    lat: float = Query(..., ge=-90, le=90),
    lon: float = Query(..., ge=-180, le=180),
):
    """Returns a concise locality string for a latitude/longitude pair."""
    try:
        params = {
            "lat": lat,
            "lon": lon,
            "format": "jsonv2",
            "addressdetails": 1,
            "zoom": 14,
        }

        async with httpx.AsyncClient(timeout=6.0, headers={"User-Agent": USER_AGENT}) as client:
            response = await client.get(NOMINATIM_REVERSE_URL, params=params)
            response.raise_for_status()
            payload = response.json()

        if not isinstance(payload, dict):
            raise ValueError("Unexpected reverse geocode payload")

        formatted = _format_location(payload)
        if not formatted:
            raise ValueError("Could not resolve locality")

        return {"location": formatted}
    except Exception as exc:
        raise HTTPException(status_code=502, detail="Unable to resolve current location") from exc
