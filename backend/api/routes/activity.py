"""
Activity Feed API Routes — Real activity log from MongoDB.
"""
from fastapi import APIRouter, HTTPException, Query
from typing import Optional
from database.models.activity_log import ActivityLog

router = APIRouter(prefix="/api/activity", tags=["Activity"])


@router.get("/")
async def get_activity_feed(
    clerk_id: Optional[str] = Query(default=None),
    type_filter: Optional[str] = Query(default=None),
    limit: int = Query(default=30, le=100),
):
    """Fetch the activity feed, optionally filtered by user and type."""
    query_filters = []

    if clerk_id:
        # Include user-specific and system activities
        query_filters.append(
            {"$or": [{"user_id": clerk_id}, {"user_id": None}]}
        )
    
    if type_filter and type_filter != "all":
        query_filters.append({"type": type_filter})

    if query_filters:
        from motor.motor_asyncio import AsyncIOMotorClient
        # Use Beanie's find with raw filter
        activities = await ActivityLog.find(
            *[ActivityLog.type == type_filter] if type_filter and type_filter != "all" else []
        ).sort(-ActivityLog.created_at).to_list(length=limit)
    else:
        activities = await ActivityLog.find().sort(
            -ActivityLog.created_at
        ).to_list(length=limit)

    result = []
    for act in activities:
        result.append({
            "id": str(act.id),
            "type": act.type,
            "text": act.text,
            "property_name": act.property_name,
            "property_id": act.property_id,
            "action_label": act.action_label,
            "action_href": act.action_href,
            "timestamp": _relative_time(act.created_at),
            "created_at": act.created_at.isoformat() if act.created_at else None,
        })

    return {"status": "success", "data": result}


def _relative_time(dt) -> str:
    """Convert datetime to relative time string."""
    from datetime import datetime
    if not dt:
        return "Just now"
    
    now = datetime.utcnow()
    diff = now - dt
    seconds = diff.total_seconds()

    if seconds < 60:
        return "Just now"
    elif seconds < 3600:
        mins = int(seconds / 60)
        return f"{mins} min{'s' if mins > 1 else ''} ago"
    elif seconds < 86400:
        hours = int(seconds / 3600)
        return f"{hours} hr{'s' if hours > 1 else ''} ago"
    elif seconds < 604800:
        days = int(seconds / 86400)
        return f"{days} day{'s' if days > 1 else ''} ago"
    else:
        return dt.strftime("%b %d, %Y")
