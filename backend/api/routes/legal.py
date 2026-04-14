"""
Legal API Routes — Real Gemini-powered legal analysis.
"""
from fastapi import APIRouter, HTTPException, BackgroundTasks
from pydantic import BaseModel
from typing import Optional
from bson import ObjectId
from database.models.property import Property
from database.models.legal_report import LegalReport
from services.legal_agent import LegalAgent

router = APIRouter(prefix="/api/legal", tags=["Legal"])
legal_agent = LegalAgent()


class LegalAnalyzeRequest(BaseModel):
    property_id: str
    user_id: Optional[str] = None


@router.post("/analyze")
async def analyze_property_legal(req: LegalAnalyzeRequest, background_tasks: BackgroundTasks):
    """Trigger legal analysis for a property. Returns immediately, runs in background."""
    if not ObjectId.is_valid(req.property_id):
        raise HTTPException(400, "Invalid property ID")

    prop = await Property.get(ObjectId(req.property_id))
    if not prop:
        raise HTTPException(404, "Property not found")

    # Check if report already exists
    existing = await LegalReport.find_one(LegalReport.property == prop.id)
    if existing:
        return {
            "status": "success",
            "message": "Legal report already exists",
            "report_id": str(existing.id),
        }

    # Run analysis in background
    async def _run_analysis():
        try:
            await legal_agent.analyze_property(prop, req.user_id)
        except Exception as e:
            print(f"[LegalRoute] Background analysis error: {e}")

    background_tasks.add_task(_run_analysis)

    return {
        "status": "in_progress",
        "message": "Legal analysis started. Check back in a few seconds.",
        "property_id": req.property_id,
    }


@router.get("/report/{property_id}")
async def get_legal_report(property_id: str):
    """Fetch the legal report for a property. Generates on-demand if missing."""
    if not ObjectId.is_valid(property_id):
        raise HTTPException(400, "Invalid property ID")

    # Try to find existing report
    prop = await Property.get(ObjectId(property_id))
    if not prop:
        raise HTTPException(404, "Property not found")

    report = await LegalReport.find_one(LegalReport.property == prop.id)

    if not report:
        # Generate on-demand
        try:
            report = await legal_agent.analyze_property(prop)
        except Exception as e:
            raise HTTPException(500, f"Legal analysis failed: {str(e)}")

    # Build response
    return {
        "status": "success",
        "data": {
            "id": str(report.id),
            "property_id": property_id,
            "rera": report.rera,
            "encumbrance": report.encumbrance,
            "property_tax": report.property_tax,
            "builder_track_record": report.builder_track_record,
            "overall_risk": report.overall_risk,
            "summary": report.plain_english_summary,
            "generated_at": report.generated_at.isoformat() if report.generated_at else None,
            # Include property info for the frontend
            "property": {
                "bhk": prop.bhk,
                "locality": prop.locality,
                "city": prop.city,
                "address": prop.address,
                "price": prop.price,
                "apartment_name": prop.apartment_name,
            },
        },
    }
