from beanie import Document, Link
from pydantic import Field
from datetime import datetime
from typing import Dict, Optional
from database.models.user import User
from database.models.property import Property

class Match(Document):
    user: Link[User]
    property: Link[Property]
    match_score: int
    match_breakdown: Dict[str, bool] = Field(default_factory=dict)
    ai_insight: str
    recommended_action: str
    status: str = Field(default="new", description="new, shortlisted, visited, rejected, negotiating, closed")
    digest_sent: bool = False
    created_at: datetime = Field(default_factory=datetime.utcnow)

    class Settings:
        name = "matches"
        indexes = [
            "user",
            "status",
            "match_score",
        ]
