from beanie import Document, Link
from pydantic import Field
from datetime import datetime
from typing import Dict, Any, Optional
from database.models.property import Property

class LegalReport(Document):
    property: Link[Property]
    rera: Dict[str, Any] = Field(default_factory=dict, description="status, number, complaints")
    encumbrance: Dict[str, Any] = Field(default_factory=dict, description="status, details")
    property_tax: Dict[str, Any] = Field(default_factory=dict, description="status, details")
    builder_track_record: Dict[str, Any] = Field(default_factory=dict, description="status, details")
    overall_risk: str = Field(default="clean", description="clean, caution, high_risk")
    plain_english_summary: Optional[str] = None
    generated_at: datetime = Field(default_factory=datetime.utcnow)

    class Settings:
        name = "legal_reports"
        indexes = [
            "property",
            "overall_risk"
        ]
