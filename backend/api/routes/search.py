from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import List, Optional, Dict, Any
from datetime import datetime
from database.models.search_profile import SearchProfile
from database.models.user import User

router = APIRouter(prefix="/api/search", tags=["Search"])


class ProfileCreateRequest(BaseModel):
    clerk_id: str
    user_status: str
    property_type: str
    budget_min: int
    budget_max: int
    locations: List[str]
    bhk: List[int]
    timeline: str
    purpose: str
    must_haves: List[str] = []
    deal_breakers: List[str] = []
    amenities: Dict[str, Any] = {}
    ai_summary: Optional[str] = None


def _derive_intent(purpose: str, user_status: str) -> str:
    """Map onboarding purpose/status to 'rent' or 'buy'."""
    combined = f"{purpose} {user_status}".lower()
    if any(w in combined for w in ("buy", "purchase", "invest", "owner")):
        return "buy"
    return "rent"


def _derive_city(locations: List[str]) -> str:
    """Extract city from the first location string (e.g. 'Bandra West, Mumbai' → 'Mumbai')."""
    if not locations:
        return "Mumbai"
    parts = [p.strip() for p in locations[0].split(",") if p.strip()]
    return parts[-1] if len(parts) > 1 else parts[0]


def _derive_size(bhk_list: List[int]) -> str:
    """Convert [2] → '2 BHK'. Falls back to '2 BHK' if empty."""
    if not bhk_list:
        return "2 BHK"
    return f"{bhk_list[0]} BHK"


@router.post("/profile")
async def save_search_profile(req: ProfileCreateRequest):
    user = await User.find_one(User.clerk_id == req.clerk_id)
    if not user:
        raise HTTPException(
            status_code=404,
            detail="User not synced yet. Please sync first.",
        )

    # Deactivate any existing active profile
    # NOTE: SearchProfile model uses `user` (Link) and `active` (bool).
    active_profile = await SearchProfile.find_one(
        SearchProfile.user == user.id,
        SearchProfile.active == True,
    )
    if active_profile:
        active_profile.active = False
        await active_profile.save()

    intent = _derive_intent(req.purpose, req.user_status)
    city = _derive_city(req.locations)
    size = _derive_size(req.bhk)

    new_profile = SearchProfile(
        user=user.id,            # Link[User] — pass the ObjectId
        intent=intent,
        city=city,
        localities=req.locations,
        budget_min=req.budget_min,
        budget_max=req.budget_max,
        size=size,
        must_haves=req.must_haves,
        deal_breakers=req.deal_breakers,
        commute_destination=None,
        commute_time=None,
        active=True,
        updated_at=datetime.utcnow(),
    )

    await new_profile.insert()

    user.onboarding_completed = True
    await user.save()

    return {
        "status": "success",
        "message": "Search profile saved",
        "profile_id": str(new_profile.id),
    }