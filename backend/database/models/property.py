from beanie import Document
from pydantic import Field
from datetime import datetime
from typing import List, Optional

class Property(Document):
    external_id: str
    source_platform: str
    source_url: str
    title: str
    apartment_name: Optional[str] = None
    total_flats_available: Optional[int] = None
    address: str
    locality: str
    city: str
    price: float
    size_sqft: Optional[int] = None
    bhk: str
    floor: Optional[str] = None
    total_floors: Optional[str] = None
    bathrooms: Optional[int] = None
    balconies: Optional[int] = None
    furnished_status: Optional[str] = None
    images: List[str] = Field(default_factory=list)
    amenities: List[str] = Field(default_factory=list)
    description: Optional[str] = None
    ai_card_summary: Optional[str] = None
    ai_detail_overview: Optional[str] = None
    ai_location_insights: Optional[str] = None
    ai_investment_outlook: Optional[str] = None
    ai_negotiation_tips: Optional[str] = None
    ai_highlights: List[str] = Field(default_factory=list)
    ai_watchouts: List[str] = Field(default_factory=list)
    ai_last_generated_at: Optional[datetime] = None
    listed_days_ago: int = 0
    is_fake: bool = False
    fake_confidence: float = 0.0
    photo_red_flags: List[str] = Field(default_factory=list)
    legal_status: str = Field(default="unknown") # clean, caution, high_risk
    rera_registered: bool = False
    rera_number: Optional[str] = None
    
    # 768-dimensional float array for Gemini embedding-001
    embedding: Optional[List[float]] = None
    
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)

    class Settings:
        name = "properties"
        indexes = [
            "city",
            "locality",
            "price",
            "bhk",
            "is_fake"
            # Note: Vector search index is created manually in ATLAS UI
        ]
