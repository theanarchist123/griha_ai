from beanie import Document, Link
from pydantic import Field
from datetime import datetime
from typing import List, Optional
from database.models.user import User

class SearchProfile(Document):
    user: Link[User]
    intent: str = Field(..., description="'rent' or 'buy'")
    city: str
    localities: List[str] = Field(default_factory=list)
    budget_min: Optional[int] = None
    budget_max: int
    size: str = Field(..., description="e.g. '2 BHK'")
    must_haves: List[str] = Field(default_factory=list)
    deal_breakers: List[str] = Field(default_factory=list)
    commute_destination: Optional[str] = None
    commute_time: Optional[int] = None
    active: bool = Field(default=True)
    updated_at: datetime = Field(default_factory=datetime.utcnow)

    class Settings:
        name = "search_profiles"
        indexes = [
            "user",
            "city",
        ]
