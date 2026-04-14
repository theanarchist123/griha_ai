"""
Unified activity logger — all agents write here.
"""
from datetime import datetime
from typing import Optional
from database.models.activity_log import ActivityLog


async def log_activity(
    user_id: Optional[str],
    activity_type: str,
    text: str,
    property_name: Optional[str] = None,
    property_id: Optional[str] = None,
    action_label: Optional[str] = None,
    action_href: Optional[str] = None,
):
    """Write a single activity log entry to MongoDB."""
    entry = ActivityLog(
        user_id=user_id,
        type=activity_type,
        text=text,
        property_name=property_name,
        property_id=property_id,
        action_label=action_label,
        action_href=action_href,
        created_at=datetime.utcnow(),
    )
    await entry.insert()
    return entry
