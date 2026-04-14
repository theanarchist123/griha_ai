from beanie import Document
from pydantic import Field
from datetime import datetime
from typing import Optional

class User(Document):
    clerk_id: str = Field(..., description="Unique Clerk user ID")
    email: str
    name: str
    plan: str = Field(default="free", description="free or pro")
    created_at: datetime = Field(default_factory=datetime.utcnow)

    class Settings:
        name = "users"
        indexes = [
            "clerk_id",
            "email",
        ]
