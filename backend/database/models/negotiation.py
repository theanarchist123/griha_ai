from beanie import Document, Link
from pydantic import Field
from datetime import datetime
from typing import List, Dict, Optional, Any
from database.models.user import User
from database.models.property import Property

from pydantic import BaseModel, Field

class Message(BaseModel):
    role: str = Field(..., description="'agent' or 'broker' or 'user'")
    content: str
    timestamp: datetime = Field(default_factory=datetime.utcnow)
    approved_by_user: bool = False

class Negotiation(Document):
    user: Optional[Link[User]] = None
    property: Link[Property]
    status: str = Field(default="active", description="active, paused, waiting_for_broker, closed_won, closed_lost")
    user_max_price: int
    tone: str = Field(default="balanced", description="aggressive, balanced, polite")
    current_offer: Optional[int] = None
    broker_contact: Optional[str] = None
    messages: List[Message] = Field(default_factory=list)
    market_fair_value_min: Optional[int] = None
    market_fair_value_max: Optional[int] = None
    langgraph_state: Optional[Dict[str, Any]] = None # JSON object for resuming graph
    turn_count: int = 0
    created_at: datetime = Field(default_factory=datetime.utcnow)

    class Settings:
        name = "negotiations"
        indexes = [
            "user",
            "property",
            "status",
        ]
