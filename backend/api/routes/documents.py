"""
Documents API Routes — Real file upload + Gemini analysis pipeline.
"""
import os
import uuid
from fastapi import APIRouter, HTTPException, UploadFile, File, Form, Query
from pydantic import BaseModel
from typing import Optional, List
from bson import ObjectId
from database.models.document import DocumentModel
from database.models.user import User
from services.contract_agent import ContractAgent

router = APIRouter(prefix="/api/documents", tags=["Documents"])
contract_agent = ContractAgent()

# Local upload directory for files (Cloudinary fallback)
UPLOAD_DIR = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(__file__))), "uploads")
os.makedirs(UPLOAD_DIR, exist_ok=True)


class AskQuestionRequest(BaseModel):
    question: str
    clerk_id: Optional[str] = None


@router.post("/upload")
async def upload_document(
    file: UploadFile = File(...),
    document_type: str = Form(default="rent_agreement"),
    clerk_id: Optional[str] = Form(default=None),
    property_id: Optional[str] = Form(default=None),
):
    """Upload a document, extract text, and run AI analysis."""
    if not file.filename:
        raise HTTPException(400, "No file provided")

    # Read file bytes
    file_bytes = await file.read()
    if not file_bytes:
        raise HTTPException(400, "Empty file")

    # Save locally (Cloudinary fallback)
    ext = os.path.splitext(file.filename)[1]
    stored_name = f"{uuid.uuid4().hex}{ext}"
    stored_path = os.path.join(UPLOAD_DIR, stored_name)
    with open(stored_path, "wb") as f:
        f.write(file_bytes)

    local_url = f"/uploads/{stored_name}"

    # Run the analysis pipeline
    try:
        analysis = await contract_agent.analyze_document(
            file_bytes=file_bytes,
            filename=file.filename,
            doc_type=document_type,
            user_id=clerk_id,
            property_id=property_id,
        )
    except Exception as e:
        analysis = {
            "status": "error",
            "message": f"Analysis failed: {str(e)}",
            "extracted_text": "",
            "clause_analysis": [],
            "ai_summary": "Document uploaded but analysis failed.",
            "extracted_data": {},
        }

    # Resolve user
    user_ref = None
    if clerk_id:
        user = await User.find_one(User.clerk_id == clerk_id)
        if user:
            user_ref = user.id

    # Save to MongoDB
    doc = DocumentModel(
        user=user_ref,
        property=ObjectId(property_id) if property_id and ObjectId.is_valid(property_id) else None,
        document_type=document_type,
        cloudinary_url=local_url,
        filename=file.filename,
        ai_summary=analysis.get("ai_summary", ""),
        extracted_text=analysis.get("extracted_text", ""),
        extracted_data=analysis.get("extracted_data", {}),
        clause_analysis=analysis.get("clause_analysis", []),
    )
    await doc.insert()

    return {
        "status": "success",
        "document_id": str(doc.id),
        "filename": file.filename,
        "ai_summary": doc.ai_summary,
        "clause_analysis": doc.clause_analysis,
        "extracted_data": doc.extracted_data,
    }


@router.get("/")
async def list_documents(
    clerk_id: Optional[str] = Query(default=None),
):
    """List all documents for a user."""
    if clerk_id:
        user = await User.find_one(User.clerk_id == clerk_id)
        if user:
            docs = await DocumentModel.find(DocumentModel.user == user.id).to_list(length=100)
        else:
            docs = []
    else:
        # Return all documents if no user filter (for demo)
        docs = await DocumentModel.find().to_list(length=100)

    result = []
    for doc in docs:
        high_risk = sum(1 for c in (doc.clause_analysis or []) if c.get("risk_level") == "high")
        caution = sum(1 for c in (doc.clause_analysis or []) if c.get("risk_level") == "caution")

        result.append({
            "id": str(doc.id),
            "document_type": doc.document_type,
            "filename": doc.filename,
            "ai_summary": doc.ai_summary,
            "clause_count": len(doc.clause_analysis or []),
            "high_risk_clauses": high_risk,
            "caution_clauses": caution,
            "extracted_data": doc.extracted_data,
            "uploaded_at": doc.uploaded_at.isoformat() if doc.uploaded_at else None,
            "property_id": str(doc.property) if doc.property else None,
            "url": doc.cloudinary_url,
        })

    return {"status": "success", "data": result}


@router.get("/{document_id}")
async def get_document(document_id: str):
    """Get a document with its full clause analysis."""
    if not ObjectId.is_valid(document_id):
        raise HTTPException(400, "Invalid document ID")

    doc = await DocumentModel.get(ObjectId(document_id))
    if not doc:
        raise HTTPException(404, "Document not found")

    return {
        "status": "success",
        "data": {
            "id": str(doc.id),
            "document_type": doc.document_type,
            "filename": doc.filename,
            "ai_summary": doc.ai_summary,
            "extracted_text": doc.extracted_text,
            "extracted_data": doc.extracted_data,
            "clause_analysis": doc.clause_analysis,
            "url": doc.cloudinary_url,
            "uploaded_at": doc.uploaded_at.isoformat() if doc.uploaded_at else None,
        },
    }


@router.post("/ask")
async def ask_documents(req: AskQuestionRequest):
    """Ask a natural language question about user's documents."""
    # Get user's documents
    docs = []
    if req.clerk_id:
        user = await User.find_one(User.clerk_id == req.clerk_id)
        if user:
            docs = await DocumentModel.find(DocumentModel.user == user.id).to_list(length=20)
    
    if not docs:
        # Fallback: use all documents (for demo)
        docs = await DocumentModel.find().to_list(length=20)

    if not docs:
        return {
            "status": "success",
            "answer": "No documents found. Please upload some documents first.",
            "sources": [],
        }

    result = await contract_agent.ask_question(req.question, docs)
    return {
        "status": "success",
        "answer": result.get("answer", "Could not find an answer."),
        "sources": result.get("sources", []),
    }
