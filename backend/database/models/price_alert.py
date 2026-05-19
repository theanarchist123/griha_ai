from beanie import Document, Link
from pydantic import Field
from datetime import datetime
from typing import Optional, List
from database.models.user import User


class PriceAlert(Document):
    """A user-defined price drop alert for a property or a search query."""

    # Who created this alert
    clerk_id: str = Field(..., description="Clerk user ID who owns this alert")

    # What they are watching (property-specific alert)
    property_id: Optional[str] = None        # MongoDB _id of the Property doc
    property_title: Optional[str] = None     # Human-readable label for display
    property_locality: Optional[str] = None
    property_bhk: Optional[str] = None
    property_image: Optional[str] = None     # First image URL for the card

    # Threshold
    target_price: float = Field(..., description="Alert fires when price drops to or below this")
    original_price: float = Field(..., description="Price at time of alert creation")

    # Search-query alert (alternative to property-specific)
    search_locality: Optional[str] = None
    search_bhk: Optional[str] = None

    # Status
    is_active: bool = True
    triggered: bool = False
    triggered_at: Optional[datetime] = None
    triggered_price: Optional[float] = None  # What the price was when triggered

    # History of price snapshots  [{price, checked_at}, ...]
    price_history: List[dict] = Field(default_factory=list)

    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)

    class Settings:
        name = "price_alerts"
        indexes = [
            "clerk_id",
            "property_id",
            "is_active",
        ]
