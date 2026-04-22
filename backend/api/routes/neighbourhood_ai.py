"""
Neighbourhood AI Query API — NLP → OpenStreetMap POI / OSRM routing.
"""
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import Optional
import httpx
import json
import os

router = APIRouter(prefix="/api/neighbourhood-ai", tags=["Neighbourhood AI"])

GEMINI_API_KEY = os.getenv("GEMINI_API_KEY", "")
GEMINI_URL = "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent"

# ─── OSM amenity tag mapping ────────────────────────────────────────────────
OSM_CATEGORY_MAP = {
    "hospital": {"type": "node", "key": "amenity", "value": "hospital", "emoji": "🏥"},
    "clinic": {"type": "node", "key": "amenity", "value": "clinic", "emoji": "🏥"},
    "pharmacy": {"type": "node", "key": "amenity", "value": "pharmacy", "emoji": "💊"},
    "school": {"type": "node", "key": "amenity", "value": "school", "emoji": "🏫"},
    "college": {"type": "node", "key": "amenity", "value": "college", "emoji": "🏛️"},
    "supermarket": {"type": "node", "key": "shop", "value": "supermarket", "emoji": "🛒"},
    "grocery": {"type": "node", "key": "shop", "value": "convenience", "emoji": "🛒"},
    "restaurant": {"type": "node", "key": "amenity", "value": "restaurant", "emoji": "🍽️"},
    "cafe": {"type": "node", "key": "amenity", "value": "cafe", "emoji": "☕"},
    "park": {"type": "node", "key": "leisure", "value": "park", "emoji": "🌳"},
    "gym": {"type": "node", "key": "leisure", "value": "fitness_centre", "emoji": "💪"},
    "bank": {"type": "node", "key": "amenity", "value": "bank", "emoji": "🏦"},
    "atm": {"type": "node", "key": "amenity", "value": "atm", "emoji": "🏧"},
    "metro": {"type": "node", "key": "railway", "value": "station", "emoji": "🚊"},
    "bus_stop": {"type": "node", "key": "highway", "value": "bus_stop", "emoji": "🚌"},
    "petrol": {"type": "node", "key": "amenity", "value": "fuel", "emoji": "⛽"},
    "police": {"type": "node", "key": "amenity", "value": "police", "emoji": "🚔"},
    "mall": {"type": "node", "key": "shop", "value": "mall", "emoji": "🏬"},
}


class AIQueryRequest(BaseModel):
    query: str
    lat: float
    lng: float
    property_address: str
    radius_m: Optional[int] = 5000


class POIResult(BaseModel):
    name: str
    lat: float
    lng: float
    distance_m: Optional[float] = None
    category: str
    emoji: str


class RouteResult(BaseModel):
    polyline: list  # list of [lat, lng]
    distance_km: float
    duration_min: float
    destination_name: str
    destination_lat: float
    destination_lng: float


class AIQueryResponse(BaseModel):
    intent: str  # "amenity_search" | "distance_query" | "unknown"
    category: Optional[str] = None
    emoji: Optional[str] = None
    pois: list = []
    route: Optional[dict] = None
    summary: str
    raw_query: str


async def parse_intent_with_gemini(query: str, property_address: str) -> dict:
    """Use Ollama to classify the query and extract key info."""
    prompt = f"""You are an AI assistant for a real estate app. A user selected their property at: "{property_address}".

They asked: "{query}"

Classify this query and respond with ONLY valid JSON, no markdown, no explanation.

If user wants to find nearby places/amenities:
{{"intent": "amenity_search", "category": "<one of: hospital, clinic, pharmacy, school, college, supermarket, grocery, restaurant, cafe, park, gym, bank, atm, metro, bus_stop, petrol, police, mall>", "place_name": null}}

If user wants to know distance/route to a specific place:
{{"intent": "distance_query", "category": null, "place_name": "<exact place name to geocode>"}}

If unclear:
{{"intent": "unknown", "category": null, "place_name": null}}

Respond with ONLY JSON."""
    try:
        result = await call_llm_json(prompt, model=MODEL_FAST)
        if not isinstance(result, dict):
            return _fallback_intent(query)
        return result
    except Exception:
        return _fallback_intent(query)


def _fallback_intent(query: str) -> dict:
    """Simple keyword fallback when no Gemini key."""
    q = query.lower()
    for cat in OSM_CATEGORY_MAP:
        if cat in q:
            return {"intent": "amenity_search", "category": cat, "place_name": None}
    if any(w in q for w in ["how far", "distance", "route", "way to", "reach"]):
        words = query.split()
        # Extract likely place name after "to" or "from"
        place = query
        for kw in ["to", "from", "reach", "nearest"]:
            if kw in q:
                idx = q.split().index(kw)
                place = " ".join(words[idx + 1:])
                break
        return {"intent": "distance_query", "category": None, "place_name": place}
    return {"intent": "unknown", "category": None, "place_name": None}


async def _run_overpass(lat: float, lng: float, key: str, value: str, radius_m: int) -> list:
    """Raw Overpass query — node + way + relation."""
    query = f"""[out:json][timeout:25];
(
  node["{key}"="{value}"](around:{radius_m},{lat},{lng});
  way["{key}"="{value}"](around:{radius_m},{lat},{lng});
  relation["{key}"="{value}"](around:{radius_m},{lat},{lng});
);
out center 25;"""
    async with httpx.AsyncClient(
        timeout=30.0,
        headers={"User-Agent": "GrihaAI/1.0"},
    ) as client:
        # Try primary, fallback to backup endpoint
        for endpoint in [
            "https://overpass-api.de/api/interpreter",
            "https://overpass.kumi.systems/api/interpreter",
        ]:
            try:
                resp = await client.post(endpoint, data={"data": query})
                resp.raise_for_status()
                return resp.json().get("elements", [])
            except Exception:
                continue
    return []


async def fetch_overpass_pois(lat: float, lng: float, category: str, radius_m: int) -> list:
    """Query Overpass API for POIs in radius. Auto-retries with 2x radius if empty."""
    from math import radians, sin, cos, sqrt, atan2

    cat_info = OSM_CATEGORY_MAP.get(category, {"key": "amenity", "value": category, "emoji": "📍"})
    key = cat_info["key"]
    value = cat_info["value"]

    # Try requested radius, then 2x, then 4x
    elements = []
    for attempt_radius in [radius_m, radius_m * 2, radius_m * 4]:
        elements = await _run_overpass(lat, lng, key, value, attempt_radius)
        if elements:
            break

    results = []
    R = 6371000
    for element in elements[:25]:
        el_lat = element.get("lat") or (element.get("center") or {}).get("lat")
        el_lng = element.get("lon") or (element.get("center") or {}).get("lon")
        if not el_lat or not el_lng:
            continue
        name = (element.get("tags") or {}).get("name") or value.replace("_", " ").title()
        dlat = radians(el_lat - lat)
        dlng = radians(el_lng - lng)
        a = sin(dlat / 2) ** 2 + cos(radians(lat)) * cos(radians(el_lat)) * sin(dlng / 2) ** 2
        dist = R * 2 * atan2(sqrt(a), sqrt(1 - a))
        results.append({
            "name": name,
            "lat": el_lat,
            "lng": el_lng,
            "distance_m": round(dist),
            "category": category,
            "emoji": cat_info.get("emoji", "📍"),
        })

    results.sort(key=lambda x: x["distance_m"])
    return results


async def geocode_place(place_name: str, near_lat: float, near_lng: float) -> Optional[dict]:
    """Geocode a place name using Nominatim."""
    async with httpx.AsyncClient(timeout=10.0, headers={"User-Agent": "GrihaAI/1.0"}) as client:
        resp = await client.get(
            "https://nominatim.openstreetmap.org/search",
            params={"q": place_name, "format": "json", "limit": 1, "countrycodes": "in"},
        )
        resp.raise_for_status()
        data = resp.json()
        if data:
            return {"lat": float(data[0]["lat"]), "lng": float(data[0]["lon"]), "name": data[0].get("display_name", place_name)}
    return None


async def fetch_osrm_route(from_lat: float, from_lng: float, to_lat: float, to_lng: float) -> Optional[dict]:
    """Get route from OSRM public API."""
    url = f"http://router.project-osrm.org/route/v1/driving/{from_lng},{from_lat};{to_lng},{to_lat}"
    async with httpx.AsyncClient(timeout=15.0) as client:
        resp = await client.get(url, params={"overview": "full", "geometries": "geojson"})
        resp.raise_for_status()
        data = resp.json()

    route = data.get("routes", [{}])[0]
    geometry = route.get("geometry", {})
    coords = geometry.get("coordinates", [])
    # OSRM returns [lng, lat] — flip to [lat, lng] for Leaflet
    polyline = [[c[1], c[0]] for c in coords]
    distance_km = round(route.get("distance", 0) / 1000, 2)
    duration_min = round(route.get("duration", 0) / 60, 1)
    return {"polyline": polyline, "distance_km": distance_km, "duration_min": duration_min}


@router.post("/query")
async def ai_neighbourhood_query(req: AIQueryRequest):
    """Process natural language neighbourhood query."""
    try:
        intent_data = await parse_intent_with_gemini(req.query, req.property_address)
    except Exception:
        intent_data = _fallback_intent(req.query)

    intent = intent_data.get("intent", "unknown")
    category = intent_data.get("category")
    place_name = intent_data.get("place_name")

    # ── Amenity search ──────────────────────────────────────────────────────
    if intent == "amenity_search" and category:
        try:
            pois = await fetch_overpass_pois(req.lat, req.lng, category, req.radius_m)
        except Exception as e:
            pois = []

        cat_info = OSM_CATEGORY_MAP.get(category, {"emoji": "📍"})
        count = len(pois)
        radius_km = req.radius_m / 1000
        if count > 0:
            closest = pois[0]
            summary = (
                f"Found {count} {category.replace('_', ' ')}(s) within {radius_km:.0f}km of your property. "
                f"Nearest: {closest['name']} — {closest['distance_m']}m away."
            )
        else:
            summary = f"No {category.replace('_', ' ')}s found within {radius_km:.0f}km. Try increasing search radius."

        return {
            "intent": "amenity_search",
            "category": category,
            "emoji": cat_info.get("emoji", "📍"),
            "pois": pois,
            "route": None,
            "summary": summary,
            "raw_query": req.query,
        }

    # ── Distance / routing query ─────────────────────────────────────────────
    if intent == "distance_query" and place_name:
        dest = await geocode_place(place_name, req.lat, req.lng)
        if not dest:
            return {
                "intent": "distance_query",
                "category": None,
                "emoji": "📍",
                "pois": [],
                "route": None,
                "summary": f"Could not locate '{place_name}'. Try a more specific name.",
                "raw_query": req.query,
            }

        try:
            route_data = await fetch_osrm_route(req.lat, req.lng, dest["lat"], dest["lng"])
        except Exception:
            route_data = None

        if route_data:
            route = {**route_data, "destination_name": dest["name"][:60], "destination_lat": dest["lat"], "destination_lng": dest["lng"]}
            summary = (
                f"Route to {place_name}: {route_data['distance_km']} km by road, "
                f"approximately {route_data['duration_min']} minutes by car."
            )
        else:
            route = {"polyline": [], "distance_km": 0, "duration_min": 0, "destination_name": dest["name"][:60], "destination_lat": dest["lat"], "destination_lng": dest["lng"]}
            summary = f"Located {place_name} on the map. Could not calculate driving route."

        return {
            "intent": "distance_query",
            "category": "route",
            "emoji": "🗺️",
            "pois": [{"name": place_name, "lat": dest["lat"], "lng": dest["lng"], "distance_m": None, "category": "destination", "emoji": "📍"}],
            "route": route,
            "summary": summary,
            "raw_query": req.query,
        }

    # ── Unknown ──────────────────────────────────────────────────────────────
    return {
        "intent": "unknown",
        "category": None,
        "emoji": "🤔",
        "pois": [],
        "route": None,
        "summary": "I didn't quite understand that. Try asking about nearby hospitals, supermarkets, parks, or distance to a specific place.",
        "raw_query": req.query,
    }
