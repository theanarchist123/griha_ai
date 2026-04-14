from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel, Field
from typing import Optional, List
from database.models.user import User

router = APIRouter(prefix="/api/auth", tags=["Auth"])

class UserSyncRequest(BaseModel):
    clerk_id: str
    email: str
    first_name: Optional[str] = None
    last_name: Optional[str] = None
    phone: Optional[str] = None

@router.post("/sync-user")
async def sync_user(req: UserSyncRequest):
    """
    Called by Next.js Clerk webhook or frontend after login.
    Creates or updates the user in MongoDB.
    """
    user = await User.find_one(User.clerk_id == req.clerk_id)
    
    if user:
        # Update existing
        user.email = req.email
        user.first_name = req.first_name
        user.last_name = req.last_name
        if req.phone:
            user.phone = req.phone
        await user.save()
        return {"status": "updated", "user": str(user.id)}
    else:
        # Create new
        new_user = User(
            clerk_id=req.clerk_id,
            email=req.email,
            first_name=req.first_name,
            last_name=req.last_name,
            phone=req.phone
        )
        await new_user.insert()
        return {"status": "created", "user": str(new_user.id)}