from beanie import Document
from pydantic import Field
from datetime import datetime
from typing import Optional, Literal


PipelineStage = Literal["shortlisted", "underReview", "negotiating", "offerMade"]


class PipelineEntry(Document):
    clerk_id: str
    property_id: str
    stage: PipelineStage = "shortlisted"
    notes: Optional[str] = None
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)

    class Settings:
        name = "pipeline_entries"
        indexes = ["clerk_id", "property_id"]
