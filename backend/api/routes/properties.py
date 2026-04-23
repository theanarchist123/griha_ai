import re
from typing import Optional

from fastapi import APIRouter, HTTPException
from database.models.property import Property
from bson import ObjectId
from services.gemini_property_content import GeminiPropertyContentService

router = APIRouter(prefix="/api/properties", tags=["Properties"])
content_service = GeminiPropertyContentService()


def _normalize_location(location: Optional[str]) -> Optional[str]:
    if not location:
        return None
    parts = [part.strip() for part in location.split(",") if part.strip()]
    return parts[0] if parts else None


def _build_location_clause(location: Optional[str]) -> Optional[dict]:
    if not location:
        return None

    raw = location.strip()
    if not raw:
        return None

    # Use the locality (first part before comma) as the primary search term.
    # Don't split "Mumbai" or "West" individually — they're too broad.
    parts = [p.strip() for p in raw.split(",") if p.strip()]
    locality = parts[0] if parts else raw

    or_conditions: list[dict] = []
    # Match against the locality name (most specific)
    pattern = re.escape(locality)
    for field in ("locality", "city", "address", "apartment_name"):
        or_conditions.append({field: {"$regex": pattern, "$options": "i"}})

    return {"$or": or_conditions} if or_conditions else None


def _real_listings_guard() -> list[dict]:
    return [
        {"is_fake": {"$ne": True}},
        {"external_id": {"$not": {"$regex": r"^scraped-", "$options": "i"}}},
        {"source_url": {"$not": {"$regex": r"example\\.com", "$options": "i"}}},
    ]


async def _enrich_missing_card_content(properties: list[Property], limit: int = 6) -> None:
    pending = [prop for prop in properties if not prop.ai_card_summary][:limit]
    for prop in pending:
        try:
            await content_service.enrich_property(prop)
        except Exception:
            continue

@router.get("/")
async def list_properties(
    location: Optional[str] = None,
    bhk: Optional[str] = None,
    min_price: Optional[int] = None,
    max_price: Optional[int] = None,
):
    query = {}
    location_clause = _build_location_clause(location)
    if location_clause:
        query.update(location_clause)
    if bhk and bhk != "Any BHK":
        query["bhk"] = {"$regex": bhk.split()[0], "$options": "i"}
    if min_price is not None or max_price is not None:
        price_query = {}
        if min_price is not None:
            price_query["$gte"] = min_price
        if max_price is not None and max_price > 0:
            price_query["$lte"] = max_price
        if price_query:
            query["price"] = price_query

    conditions = _real_listings_guard()
    if query:
        conditions.append(query)

    final_query = {"$and": conditions} if len(conditions) > 1 else conditions[0]
    properties = await Property.find(final_query).to_list()
    await _enrich_missing_card_content(properties)
    return {"status": "success", "data": properties}

@router.get("/search")
async def search_properties(
    location: Optional[str] = None,
    bhk: Optional[str] = None,
    gated: bool = False,
    pet: bool = False,
    parking: bool = False,
):
    conditions = _real_listings_guard()
    location_clause = _build_location_clause(location)
    if location_clause:
        conditions.append(location_clause)
    base_conditions = list(conditions)

    requested_bhk = bhk if bhk and bhk != "Any BHK" else None
    if bhk and bhk != "Any BHK":
        conditions.append({"bhk": {"$regex": bhk.split()[0], "$options": "i"}})

    if gated:
        conditions.append({"amenities": {"$elemMatch": {"$regex": "gated", "$options": "i"}}})
    if pet:
        conditions.append({"amenities": {"$elemMatch": {"$regex": "pet", "$options": "i"}}})
    if parking:
        conditions.append({"amenities": {"$elemMatch": {"$regex": "parking", "$options": "i"}}})

    query = {}
    if len(conditions) == 1:
        query = conditions[0]
    elif len(conditions) > 1:
        query = {"$and": conditions}

    search_query = Property.find(query)
    if bhk and bhk != "Any BHK":
        search_query = search_query.sort([("price", -1)])

    results = await search_query.to_list()

    fallback_applied = False
    # If no exact BHK inventory exists for the location, gracefully fallback
    # to location-level results so users still see available listings.
    if requested_bhk and not results:
        fallback_query = {}
        if len(base_conditions) == 1:
            fallback_query = base_conditions[0]
        elif len(base_conditions) > 1:
            fallback_query = {"$and": base_conditions}

        results = await Property.find(fallback_query).sort([("price", -1)]).to_list()
        fallback_applied = True

    await _enrich_missing_card_content(results)
    return {
        "status": "success",
        "results": results,
        "meta": {
            "requested_bhk": requested_bhk,
            "fallback_applied": fallback_applied,
        },
    }

@router.get("/{property_id}")
async def get_property(property_id: str):
    prop = None
    if ObjectId.is_valid(property_id):
        prop = await Property.get(ObjectId(property_id))
    if not prop:
        prop = await Property.find_one(Property.external_id == property_id)

    if not prop:
        raise HTTPException(status_code=404, detail="Property not found")

    if not prop.ai_detail_overview or not prop.ai_card_summary:
        try:
            prop = await content_service.enrich_property(prop)
        except Exception:
            # Even if save fails, return factual generated content in this response.
            try:
                generated = await content_service.generate_content(prop)
                for key, value in generated.items():
                    setattr(prop, key, value)
            except Exception:
                pass
        
    return {"status": "success", "data": prop}