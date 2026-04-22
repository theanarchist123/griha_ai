"""
Contract & Document Analysis Agent — OCR + Gemini clause analysis pipeline.
Handles document text extraction, clause splitting, risk analysis, 
summary generation, and natural language Q&A over documents.
"""
import json
import traceback
import os
import tempfile
from datetime import datetime
from typing import Optional, Dict, Any, List

from services.ai_client import call_llm, call_llm_json, MODEL_PRO, MODEL_SMART, MODEL_FAST
from config import settings
from database.models.document import DocumentModel
from services.activity_logger import log_activity


class ContractAgent:
    """
    Document intelligence pipeline:
    1. Extract text (PyMuPDF primary, OCR.space fallback)
    2. Split into clauses via Gemini
    3. Analyze each clause for risk
    4. Generate summary
    5. Q&A over document content
    """

    def __init__(self):
        pass  # ai_client handles auth

    # ──────────────── Text Extraction ────────────────

    async def extract_text(self, file_bytes: bytes, filename: str) -> str:
        """Extract text from a PDF or image file."""
        ext = os.path.splitext(filename)[1].lower()

        if ext == ".pdf":
            text = self._extract_pdf_text(file_bytes)
            if len(text.strip()) > 200:
                return text
            # Fallback to OCR if PDF is scanned
            return await self._ocr_extract(file_bytes, filename)
        elif ext in (".jpg", ".jpeg", ".png", ".webp"):
            return await self._ocr_extract(file_bytes, filename)
        else:
            return ""

    def _extract_pdf_text(self, file_bytes: bytes) -> str:
        """Use PyMuPDF for text-based PDF extraction."""
        try:
            import fitz  # PyMuPDF
            doc = fitz.open(stream=file_bytes, filetype="pdf")
            text_parts = []
            for page in doc:
                text_parts.append(page.get_text())
            doc.close()
            return "\n".join(text_parts)
        except Exception as e:
            print(f"[ContractAgent] PyMuPDF error: {e}")
            return ""

    async def _ocr_extract(self, file_bytes: bytes, filename: str) -> str:
        """Use OCR.space free API or Gemini Vision for OCR."""
        # Try OCR.space first if key available
        if settings.ocr_space_api_key:
            try:
                import httpx
                async with httpx.AsyncClient(timeout=30) as client:
                    response = await client.post(
                        "https://api.ocr.space/parse/image",
                        files={"file": (filename, file_bytes)},
                        data={
                            "apikey": settings.ocr_space_api_key,
                            "language": "eng",
                            "isTable": "false",
                            "detectOrientation": "true",
                        },
                    )
                    result = response.json()
                    if result.get("ParsedResults"):
                        return result["ParsedResults"][0].get("ParsedText", "")
            except Exception as e:
                print(f"[ContractAgent] OCR.space error: {e}")

        # Fallback: use LLM Vision to extract text
        try:
            import PIL.Image
            import io
            img = PIL.Image.open(io.BytesIO(file_bytes))
            # LLM vision not directly supported in Ollama streaming — skip
            return ""
        except Exception as e:
            print(f"[ContractAgent] Vision OCR error: {e}")
            return ""

    # ──────────────── Clause Splitting ────────────────

    async def split_into_clauses(self, text: str) -> List[Dict[str, Any]]:
        """Split document text into numbered clauses via Gemini."""
        prompt = f"""Split this legal document into individual clauses. Identify each clause with its number and heading.

Document Text:
{text[:8000]}

Return a JSON array where each item has:
- "clause_number": integer
- "heading": string (clause title if any, else "")
- "text": string (verbatim clause text)

Return ONLY valid JSON array. No markdown formatting.
"""
        try:
            result = await call_llm_json(prompt, model=MODEL_FAST)
            clauses = result if isinstance(result, list) else []
            return clauses
        except Exception as e:
            print(f"[ContractAgent] Clause splitting error: {e}")
            # Fallback: treat whole text as one clause
            return [{"clause_number": 1, "heading": "Full Document", "text": text[:5000]}]

    # ──────────────── Clause Analysis ────────────────

    async def analyze_clauses(self, clauses: List[Dict[str, Any]], doc_type: str) -> List[Dict[str, Any]]:
        """Analyze each clause for risk using Gemini."""
        analyzed = []
        
        # Batch clauses for efficiency (max 5 per call)
        for i in range(0, len(clauses), 5):
            batch = clauses[i:i + 5]
            batch_text = "\n\n".join(
                [f"Clause {c['clause_number']}: {c.get('heading', '')}\n{c['text']}" for c in batch]
            )

            prompt = f"""You are an Indian real estate legal expert. Analyze these clauses from a {doc_type}.

{batch_text}

For each clause, provide:
1. Risk level: "standard" (green), "caution" (amber), or "high" (red)
2. Plain English meaning (1-2 sentences)
3. Specific problem if risky (1 sentence, or empty if standard)
4. Recommended corrected wording if risky (1 sentence, or empty if standard)
5. Relevant Indian law section

Return a JSON array:
[
    {{
        "clause_number": <int>,
        "heading": "clause heading",
        "text": "original clause text",
        "risk_level": "standard" or "caution" or "high",
        "meaning": "Plain English explanation",
        "problem": "Specific issue if any",
        "recommendation": "Corrected wording if needed",
        "law_reference": "Relevant Act and Section"
    }}
]

Return ONLY valid JSON. No markdown.
"""
            try:
                result = await call_llm_json(prompt, model=MODEL_PRO)
                if isinstance(result, list):
                    analyzed.extend(result)
            except Exception as e:
                print(f"[ContractAgent] Clause analysis batch error: {e}")
                # Add unanalyzed clauses as standard
                for c in batch:
                    analyzed.append({
                        **c,
                        "risk_level": "standard",
                        "meaning": "Could not analyze this clause automatically.",
                        "problem": "",
                        "recommendation": "",
                        "law_reference": "",
                    })

        return analyzed

    # ──────────────── AI Summary ────────────────

    async def generate_summary(self, text: str, doc_type: str, clause_analysis: List[Dict]) -> str:
        """Generate a one-paragraph AI summary of the document."""
        high_risk_count = sum(1 for c in clause_analysis if c.get("risk_level") == "high")
        caution_count = sum(1 for c in clause_analysis if c.get("risk_level") == "caution")

        prompt = f"""Summarize this {doc_type} in 2-3 sentences for a property tenant/buyer.

Document excerpt:
{text[:3000]}

Analysis results: {high_risk_count} high-risk clauses, {caution_count} caution clauses found.

Be specific about key terms (rent amount, deposit, lock-in period, escalation clause, etc.)
"""
        try:
            return await call_llm(prompt, model=MODEL_FAST)
        except Exception:
            return f"Document analyzed: {len(clause_analysis)} clauses found. {high_risk_count} high-risk, {caution_count} caution items."

    # ──────────────── Full Analysis Pipeline ────────────────

    async def analyze_document(
        self,
        file_bytes: bytes,
        filename: str,
        doc_type: str,
        user_id: Optional[str] = None,
        property_id: Optional[str] = None,
    ) -> Dict[str, Any]:
        """Run the full document analysis pipeline."""
        # 1. Extract text
        extracted_text = await self.extract_text(file_bytes, filename)
        if not extracted_text.strip():
            return {
                "status": "error",
                "message": "Could not extract text from the document. Please ensure it's a readable PDF or image.",
            }

        # 2. Split into clauses
        clauses = await self.split_into_clauses(extracted_text)

        # 3. Analyze clauses
        clause_analysis = await self.analyze_clauses(clauses, doc_type)

        # 4. Generate summary
        summary = await self.generate_summary(extracted_text, doc_type, clause_analysis)

        # 5. Extract key data points
        extracted_data = await self._extract_key_data(extracted_text, doc_type)

        # Log activity
        high_risk = sum(1 for c in clause_analysis if c.get("risk_level") == "high")
        activity_text = f"Document analyzed — {filename}"
        if high_risk > 0:
            activity_text += f" — {high_risk} risky clause{'s' if high_risk > 1 else ''} found"

        await log_activity(
            user_id=user_id,
            activity_type="document",
            text=activity_text,
            property_id=property_id,
            action_label="View Analysis",
            action_href="/documents",
        )

        return {
            "status": "success",
            "extracted_text": extracted_text,
            "clauses": clauses,
            "clause_analysis": clause_analysis,
            "ai_summary": summary,
            "extracted_data": extracted_data,
        }

    async def _extract_key_data(self, text: str, doc_type: str) -> Dict[str, Any]:
        """Extract structured key data from document text."""
        prompt = f"""Extract key data points from this {doc_type}:

{text[:4000]}

Return JSON with relevant fields:
{{
    "parties": ["Party 1 name", "Party 2 name"],
    "rent_amount": <int or null>,
    "deposit_amount": <int or null>,
    "lock_in_months": <int or null>,
    "agreement_duration_months": <int or null>,
    "escalation_percent": <float or null>,
    "property_address": "address string or null",
    "start_date": "date string or null",
    "maintenance_amount": <int or null>,
    "special_conditions": ["list of notable conditions"]
}}

Return ONLY valid JSON. Use null for unknown fields.
"""
        try:
            result = await call_llm_json(prompt, model=MODEL_FAST)
            return result if isinstance(result, dict) else {}
        except Exception:
            return {}

    # ──────────────── Document Q&A ────────────────

    async def ask_question(self, question: str, documents: List[DocumentModel]) -> Dict[str, Any]:
        """Answer a natural language question about user's documents."""
        # Build context from all user documents
        context_parts = []
        for doc in documents:
            if doc.extracted_text:
                context_parts.append(f"--- {doc.filename} ({doc.document_type}) ---\n{doc.extracted_text[:2000]}")
            elif doc.ai_summary:
                context_parts.append(f"--- {doc.filename} ({doc.document_type}) ---\n{doc.ai_summary}")

        if not context_parts:
            return {
                "answer": "I don't have any analyzed documents to search through. Please upload and analyze documents first.",
                "sources": [],
            }

        context = "\n\n".join(context_parts[:5])  # Limit context size

        prompt = f"""You are a helpful real estate legal assistant. Answer the user's question based ONLY on their documents.

User's Documents:
{context}

Question: {question}

Provide a clear, specific answer. Reference the specific document and clause where you found the information.
If the answer is not in the documents, say so clearly.
"""
        try:
            return {"answer": await call_llm(prompt, model=MODEL_SMART), "sources": sources}
        except Exception as e:
            print(f"[ContractAgent] Q&A error: {e}")
            return {
                "answer": "I encountered an error while searching your documents. Please try again.",
                "sources": [],
            }
