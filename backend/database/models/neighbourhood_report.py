from beanie import Document
from pydantic import Field
from datetime import datetime
from typing import List, Dict, Any

class NeighbourhoodReport(Document):
    locality: str
    city: str
    commute_data: Dict[str, Any] = Field(default_factory=dict)
    amenities: List[Dict[str, Any]] = Field(default_factory=list)
    flood_risk: str = Field(default="Low")
    aqi_score: int = 50
    noise_level: str = "Low"
    price_trend: List[Dict[str, Any]] = Field(default_factory=list) # 12 months array
    resident_sentiment: Dict[str, Any] = Field(default_factory=dict)
    livability_scores: Dict[str, Any] = Field(default_factory=dict)
    cached_at: datetime = Field(default_factory=datetime.utcnow)
    expires_at: datetime

    class Settings:
        name = "neighbourhood_reports"
        indexes = [
            "locality",
            "city",
            "expires_at"
        ]
