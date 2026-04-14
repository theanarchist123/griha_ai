from beanie import Document, Link
from pydantic import Field
from datetime import datetime
from typing import List, Dict, Any, Optional
from database.models.user import User
from database.models.property import Property

class DocumentModel(Document):
    user: Link[User]
    property: Optional[Link[Property]] = None
    document_type: str = Field(..., description="rent_agreement, sale_deed, legal_report, receipt, photo")
    cloudinary_url: str
    filename: str
    ai_summary: Optional[str] = None
    extracted_text: Optional[str] = None
    extracted_data: Dict[str, Any] = Field(default_factory=dict)
    clause_analysis: List[Dict[str, Any]] = Field(default_factory=list)
    redline_url: Optional[str] = None
    
    # Optional embedding for user-specific RAG over documents
    embedding: Optional[List[float]] = None
    
    uploaded_at: datetime = Field(default_factory=datetime.utcnow)

    class Settings:
        name = "documents"
        indexes = [
            "user",
            "document_type",
        ]
