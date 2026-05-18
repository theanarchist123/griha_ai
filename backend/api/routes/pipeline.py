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

import logging
logger = logging.getLogger(__name__)

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


class BatchCheckRequest(BaseModel):
    property_ids: List[str]


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
    try:
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
    except Exception as e:
        logger.warning(f"Failed to fetch property snapshot for {property_id}: {e}")
        return None


# ─── Endpoints ────────────────────────────────────────────────────────────────

@router.get("/")
async def get_pipeline(clerk_id: str = Query(..., description="Clerk user ID")):
    """Return all pipeline entries for a user, grouped by stage."""
    try:
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
    except Exception as e:
        logger.error(f"Pipeline GET failed: {e}")
        return {"status": "success", "data": {"shortlisted": [], "underReview": [], "negotiating": [], "offerMade": []}}


@router.post("/save")
async def save_to_pipeline(req: SaveRequest, clerk_id: str = Query(...)):
    """Save a property to the pipeline. Upserts if already saved."""
    try:
        existing = await PipelineEntry.find_one(
            PipelineEntry.clerk_id == clerk_id,
            PipelineEntry.property_id == req.property_id,
        )
        if existing:
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
    except Exception as e:
        logger.error(f"Pipeline save failed: {e}")
        raise HTTPException(status_code=503, detail="Database temporarily unavailable. Please try again.")


@router.patch("/{entry_id}/stage")
async def move_stage(entry_id: str, req: MoveRequest, clerk_id: str = Query(...)):
    """Move an entry to a different pipeline stage."""
    if not ObjectId.is_valid(entry_id):
        raise HTTPException(status_code=400, detail="Invalid entry_id")

    try:
        entry = await PipelineEntry.get(ObjectId(entry_id))
        if not entry or entry.clerk_id != clerk_id:
            raise HTTPException(status_code=404, detail="Entry not found")

        entry.stage = req.stage
        entry.updated_at = datetime.utcnow()
        await entry.save()
        return {"status": "success", "entry": _serialize_entry(entry)}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Pipeline move_stage failed: {e}")
        raise HTTPException(status_code=503, detail="Database temporarily unavailable.")


@router.delete("/{entry_id}")
async def remove_from_pipeline(entry_id: str, clerk_id: str = Query(...)):
    """Remove a property from the pipeline."""
    if not ObjectId.is_valid(entry_id):
        raise HTTPException(status_code=400, detail="Invalid entry_id")

    try:
        entry = await PipelineEntry.get(ObjectId(entry_id))
        if not entry or entry.clerk_id != clerk_id:
            raise HTTPException(status_code=404, detail="Entry not found")

        await entry.delete()
        return {"status": "success", "message": "Removed from pipeline"}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Pipeline delete failed: {e}")
        raise HTTPException(status_code=503, detail="Database temporarily unavailable.")


@router.post("/check-batch")
async def check_saved_batch(req: BatchCheckRequest, clerk_id: str = Query(...)):
    """
    Batch check which property IDs are already saved.
    Returns a dict of { property_id: { saved, stage, entry_id } }.
    One DB query instead of N queries from N card components.
    """
    result = {pid: {"saved": False, "stage": None, "entry_id": None} for pid in req.property_ids}
    if not req.property_ids:
        return {"status": "success", "data": result}

    try:
        entries = await PipelineEntry.find(
            PipelineEntry.clerk_id == clerk_id,
            {"property_id": {"$in": req.property_ids}},
        ).to_list()

        for entry in entries:
            if entry.property_id in result:
                result[entry.property_id] = {
                    "saved": True,
                    "stage": entry.stage,
                    "entry_id": str(entry.id),
                }

        return {"status": "success", "data": result}
    except Exception as e:
        logger.error(f"Pipeline batch-check failed: {e}")
        # Graceful degradation: return all as unsaved rather than crashing
        return {"status": "success", "data": result}


@router.get("/check/{property_id}")
async def check_saved(property_id: str, clerk_id: str = Query(...)):
    """Check if a property is already saved and which stage."""
    try:
        entry = await PipelineEntry.find_one(
            PipelineEntry.clerk_id == clerk_id,
            PipelineEntry.property_id == property_id,
        )
        if entry:
            return {"saved": True, "stage": entry.stage, "entry_id": str(entry.id)}
        return {"saved": False, "stage": None, "entry_id": None}
    except Exception as e:
        logger.error(f"Pipeline check_saved failed for {property_id}: {e}")
        # Return unsaved gracefully - don't crash the whole page
        return {"saved": False, "stage": None, "entry_id": None}
