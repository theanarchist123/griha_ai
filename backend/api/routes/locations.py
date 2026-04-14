from typing import List, Optional

import httpx
from fastapi import APIRouter, HTTPException, Query

router = APIRouter(prefix="/api/locations", tags=["Locations"])

NOMINATIM_SEARCH_URL = "https://nominatim.openstreetmap.org/search"
NOMINATIM_REVERSE_URL = "https://nominatim.openstreetmap.org/reverse"
USER_AGENT = "griha-ai-locations/1.0"

FALLBACK_LOCATIONS = [
    "Mumbai, Maharashtra",
    "Andheri West, Mumbai",
    "Bandra West, Mumbai",
    "Powai, Mumbai",
    "Bangalore, Karnataka",
    "Koramangala, Bangalore",
    "Delhi, NCR",
    "Pune, Maharashtra",
]


def _format_location(item: dict) -> Optional[str]:
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

    if locality and city:
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

@router.get("/autocomplete", response_model=List[str])
async def autocomplete_locations(q: str = Query(..., min_length=1)):
    """Returns top location suggestions for the search query."""
    normalized_query = q.strip()
    if not normalized_query:
        return []

    suggestions: List[str] = []
    try:
        params = {
            "q": normalized_query,
            "format": "jsonv2",
            "addressdetails": 1,
            "limit": 10,
            "countrycodes": "in",
        }

        async with httpx.AsyncClient(timeout=4.0, headers={"User-Agent": USER_AGENT}) as client:
            response = await client.get(NOMINATIM_SEARCH_URL, params=params)
            response.raise_for_status()
            payload = response.json()

        if isinstance(payload, list):
            for item in payload:
                if not isinstance(item, dict):
                    continue
                formatted = _format_location(item)
                if formatted and formatted not in suggestions:
                    suggestions.append(formatted)
                if len(suggestions) >= 10:
                    break
    except Exception:
        query_l = normalized_query.lower()
        suggestions = [name for name in FALLBACK_LOCATIONS if query_l in name.lower()][:10]

    return suggestions


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

        async with httpx.AsyncClient(timeout=4.0, headers={"User-Agent": USER_AGENT}) as client:
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
