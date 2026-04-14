from beanie import Document
from pydantic import Field
from datetime import datetime
from typing import List, Optional

class LegalCorpus(Document):
    chunk_text: str
    source_act: str
    section_reference: str
    state: Optional[str] = None
    embedding: List[float] = Field(default_factory=list)
    ingested_at: datetime = Field(default_factory=datetime.utcnow)

    class Settings:
        name = "legal_corpus"
        indexes = [
            "source_act"
        ]

class NeighbourhoodReview(Document):
    review_text: str
    locality: str
    city: str
    source_platform: str
    embedding: List[float] = Field(default_factory=list)
    scraped_at: datetime = Field(default_factory=datetime.utcnow)

    class Settings:
        name = "neighbourhood_reviews"
        indexes = [
            "locality",
            "city"
        ]
