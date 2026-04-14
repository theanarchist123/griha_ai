"""
Preferences API Routes — Fetch and update user search profiles.
"""
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import Optional, List, Dict, Any
from database.models.user import User
from database.models.search_profile import SearchProfile

router = APIRouter(prefix="/api/preferences", tags=["Preferences"])


class PreferencesUpdateRequest(BaseModel):
    locations: Optional[List[str]] = None
    budget_min: Optional[int] = None
    budget_max: Optional[int] = None
    bhk: Optional[str] = None
    must_haves: Optional[List[str]] = None
    deal_breakers: Optional[List[str]] = None
    commute_destination: Optional[str] = None
    notification_settings: Optional[Dict[str, bool]] = None


@router.get("/{clerk_id}")
async def get_preferences(clerk_id: str):
    """Fetch the active search profile for a user."""
    user = await User.find_one(User.clerk_id == clerk_id)
    if not user:
        raise HTTPException(404, "User not found")

    profile = await SearchProfile.find_one(
        SearchProfile.user == user.id,
        SearchProfile.active == True,
    )

    if not profile:
        return {"status": "not_found", "data": None}

    return {
        "status": "success",
        "data": {
            "id": str(profile.id),
            "intent": profile.intent,
            "city": profile.city,
            "localities": profile.localities,
            "budget_min": profile.budget_min,
            "budget_max": profile.budget_max,
            "bhk": profile.size,
            "must_haves": profile.must_haves,
            "deal_breakers": profile.deal_breakers,
            "commute_destination": profile.commute_destination,
            "commute_time": profile.commute_time,
            "updated_at": profile.updated_at.isoformat() if profile.updated_at else None,
        },
    }


@router.put("/{clerk_id}")
async def update_preferences(clerk_id: str, req: PreferencesUpdateRequest):
    """Update the active search profile for a user."""
    user = await User.find_one(User.clerk_id == clerk_id)
    if not user:
        raise HTTPException(404, "User not found")

    profile = await SearchProfile.find_one(
        SearchProfile.user == user.id,
        SearchProfile.active == True,
    )

    if not profile:
        raise HTTPException(404, "No active search profile found")

    # Update fields
    from datetime import datetime

    if req.locations is not None:
        profile.localities = req.locations
    if req.budget_min is not None:
        profile.budget_min = req.budget_min
    if req.budget_max is not None:
        profile.budget_max = req.budget_max
    if req.bhk is not None:
        profile.size = req.bhk
    if req.must_haves is not None:
        profile.must_haves = req.must_haves
    if req.deal_breakers is not None:
        profile.deal_breakers = req.deal_breakers
    if req.commute_destination is not None:
        profile.commute_destination = req.commute_destination

    profile.updated_at = datetime.utcnow()
    await profile.save()

    return {
        "status": "success",
        "message": "Preferences updated",
        "data": {
            "id": str(profile.id),
            "localities": profile.localities,
            "budget_min": profile.budget_min,
            "budget_max": profile.budget_max,
            "bhk": profile.size,
            "must_haves": profile.must_haves,
            "deal_breakers": profile.deal_breakers,
            "commute_destination": profile.commute_destination,
        },
    }
