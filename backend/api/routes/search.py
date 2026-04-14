from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel
from typing import List, Optional, Dict, Any
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

@router.post("/profile")
async def save_search_profile(req: ProfileCreateRequest):
    user = await User.find_one(User.clerk_id == req.clerk_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not synced yet. Please sync first.")

    # Deactivate existing active profile
    active_profile = await SearchProfile.find_one(SearchProfile.user_id == user.id, SearchProfile.is_active == True)
    if active_profile:
        active_profile.is_active = False
        await active_profile.save()

    new_profile = SearchProfile(
        user_id=user.id,
        user_status=req.user_status,
        property_type=req.property_type,
        budget={"min": req.budget_min, "max": req.budget_max},
        locations=req.locations,
        bhk=req.bhk,
        timeline=req.timeline,
        purpose=req.purpose,
        must_haves=req.must_haves,
        deal_breakers=req.deal_breakers,
        amenities=req.amenities,
        ai_summary=req.ai_summary,
        is_active=True
    )
    
    await new_profile.insert()
    
    user.onboarding_completed = True
    await user.save()

    return {"status": "success", "message": "Search profile saved", "profile_id": str(new_profile.id)}