"""
Pipeline API — save properties to stages, move between stages.

All requests require ?clerk_id=<clerk_user_id> query param.
Stages: shortlisted | underReview | negotiating | offerMade
"""
from datetime import datetime
from typing import List, Optional, Literal

from bson import ObjectId
from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel

from database.models.pipeline import PipelineEntry
from database.models.property import Property

router = APIRouter(prefix="/api/pipeline", tags=["Pipeline"])

PipelineStage = Literal["shortlisted", "underReview", "negotiating", "offerMade"]
VALID_STAGES = {"shortlisted", "underReview", "negotiating", "offerMade"}


# ─── Request / Response models ────────────────────────────────────────────────

class SaveRequest(BaseModel):
    property_id: str
    stage: PipelineStage = "shortlisted"
    notes: Optional[str] = None


class MoveRequest(BaseModel):
    stage: PipelineStage


class PipelineEntryOut(BaseModel):
    entry_id: str
    property_id: str
    stage: str
    notes: Optional[str]
    created_at: str
    # Embedded property snapshot for fast rendering
    property: Optional[dict] = None


# ─── Helper ───────────────────────────────────────────────────────────────────

def _serialize_entry(entry: PipelineEntry, prop_data: Optional[dict] = None) -> dict:
    return {
        "entry_id": str(entry.id),
        "property_id": entry.property_id,
        "stage": entry.stage,
        "notes": entry.notes,
        "created_at": entry.created_at.isoformat(),
        "property": prop_data,
    }


async def _fetch_property_snapshot(property_id: str) -> Optional[dict]:
    """Return a lightweight property dict for pipeline card rendering."""
    prop = None
    if ObjectId.is_valid(property_id):
        prop = await Property.get(ObjectId(property_id))
    if not prop:
        prop = await Property.find_one(Property.external_id == property_id)
    if not prop:
        return None
    return {
        "id": str(prop.id),
        "title": prop.title,
        "apartment_name": prop.apartment_name,
        "locality": prop.locality,
        "city": prop.city,
        "price": prop.price,
        "bhk": prop.bhk,
        "images": prop.images[:1],
        "source_platform": prop.source_platform,
        "ai_card_summary": prop.ai_card_summary,
    }


# ─── Endpoints ────────────────────────────────────────────────────────────────

@router.get("/")
async def get_pipeline(clerk_id: str = Query(..., description="Clerk user ID")):
    """Return all pipeline entries for a user, grouped by stage."""
    entries = await PipelineEntry.find(PipelineEntry.clerk_id == clerk_id).sort("-created_at").to_list()

    grouped: dict[str, list] = {
        "shortlisted": [],
        "underReview": [],
        "negotiating": [],
        "offerMade": [],
    }

    for entry in entries:
        prop_data = await _fetch_property_snapshot(entry.property_id)
        serialized = _serialize_entry(entry, prop_data)
        stage = entry.stage if entry.stage in grouped else "shortlisted"
        grouped[stage].append(serialized)

    return {"status": "success", "data": grouped}


@router.post("/save")
async def save_to_pipeline(req: SaveRequest, clerk_id: str = Query(...)):
    """Save a property to the pipeline. Upserts if already saved."""
    existing = await PipelineEntry.find_one(
        PipelineEntry.clerk_id == clerk_id,
        PipelineEntry.property_id == req.property_id,
    )
    if existing:
        # Move to new stage if different
        existing.stage = req.stage
        if req.notes is not None:
            existing.notes = req.notes
        existing.updated_at = datetime.utcnow()
        await existing.save()
        prop_data = await _fetch_property_snapshot(existing.property_id)
        return {"status": "success", "action": "updated", "entry": _serialize_entry(existing, prop_data)}

    entry = PipelineEntry(
        clerk_id=clerk_id,
        property_id=req.property_id,
        stage=req.stage,
        notes=req.notes,
    )
    await entry.insert()
    prop_data = await _fetch_property_snapshot(entry.property_id)
    return {"status": "success", "action": "created", "entry": _serialize_entry(entry, prop_data)}


@router.patch("/{entry_id}/stage")
async def move_stage(entry_id: str, req: MoveRequest, clerk_id: str = Query(...)):
    """Move an entry to a different pipeline stage."""
    if not ObjectId.is_valid(entry_id):
        raise HTTPException(status_code=400, detail="Invalid entry_id")

    entry = await PipelineEntry.get(ObjectId(entry_id))
    if not entry or entry.clerk_id != clerk_id:
        raise HTTPException(status_code=404, detail="Entry not found")

    entry.stage = req.stage
    entry.updated_at = datetime.utcnow()
    await entry.save()
    return {"status": "success", "entry": _serialize_entry(entry)}


@router.delete("/{entry_id}")
async def remove_from_pipeline(entry_id: str, clerk_id: str = Query(...)):
    """Remove a property from the pipeline."""
    if not ObjectId.is_valid(entry_id):
        raise HTTPException(status_code=400, detail="Invalid entry_id")

    entry = await PipelineEntry.get(ObjectId(entry_id))
    if not entry or entry.clerk_id != clerk_id:
        raise HTTPException(status_code=404, detail="Entry not found")

    await entry.delete()
    return {"status": "success", "message": "Removed from pipeline"}


@router.get("/check/{property_id}")
async def check_saved(property_id: str, clerk_id: str = Query(...)):
    """Check if a property is already saved and which stage."""
    entry = await PipelineEntry.find_one(
        PipelineEntry.clerk_id == clerk_id,
        PipelineEntry.property_id == property_id,
    )
    if entry:
        return {"saved": True, "stage": entry.stage, "entry_id": str(entry.id)}
    return {"saved": False, "stage": None, "entry_id": None}
