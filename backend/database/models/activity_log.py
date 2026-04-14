from beanie import Document, Link
from pydantic import Field
from datetime import datetime
from typing import Optional
from database.models.user import User


class ActivityLog(Document):
    user_id: Optional[str] = None  # clerk_id for easy frontend lookup
    type: str = Field(..., description="match, negotiation, legal, document, alert, system")
    text: str
    property_name: Optional[str] = None
    property_id: Optional[str] = None
    action_label: Optional[str] = None
    action_href: Optional[str] = None
    created_at: datetime = Field(default_factory=datetime.utcnow)

    class Settings:
        name = "activity_logs"
        indexes = [
            "user_id",
            "type",
            "created_at",
        ]
