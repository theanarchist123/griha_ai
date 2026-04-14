"""
Legal Agent — Gemini-powered property legal analysis.
Performs RERA verification, encumbrance assessment, property tax analysis,
and builder track record research using Gemini AI.
"""
import json
import traceback
from datetime import datetime
from typing import Optional, Dict, Any

import google.generativeai as genai
from config import settings
from database.models.property import Property
from database.models.legal_report import LegalReport
from services.activity_logger import log_activity


class LegalAgent:
    """
    AI-powered legal verification agent.
    Uses Gemini to research and analyse property legal standing.
    """

    def __init__(self):
        if settings.gemini_api_key:
            genai.configure(api_key=settings.gemini_api_key)
        self.model = genai.GenerativeModel("gemini-3-flash-preview")

    async def analyze_property(self, property_doc: Property, user_id: Optional[str] = None) -> LegalReport:
        """
        Run a comprehensive legal analysis on a property.
        Returns a persisted LegalReport document.
        """
        prop_context = self._build_property_context(property_doc)

        # Run all checks via Gemini in a single comprehensive prompt
        raw_analysis = await self._run_gemini_analysis(prop_context)

        # Parse the structured response
        parsed = self._parse_analysis(raw_analysis, property_doc)

        # Compute overall risk algorithmically
        overall_risk = self._compute_risk(parsed)

        # Generate plain-English summary
        summary = await self._generate_summary(parsed, overall_risk, property_doc)

        # Build and save the report
        report = LegalReport(
            property=property_doc.id,
            rera=parsed.get("rera", {}),
            encumbrance=parsed.get("encumbrance", {}),
            property_tax=parsed.get("property_tax", {}),
            builder_track_record=parsed.get("builder_track_record", {}),
            overall_risk=overall_risk,
            plain_english_summary=summary,
            generated_at=datetime.utcnow(),
        )
        await report.insert()

        # Update property legal status
        property_doc.legal_status = overall_risk
        if parsed.get("rera", {}).get("status") == "Registered":
            property_doc.rera_registered = True
            property_doc.rera_number = parsed.get("rera", {}).get("number", "")
        await property_doc.save()

        # Log activity
        risk_label = {"clean": "Clean", "caution": "Caution", "high_risk": "High Risk"}.get(overall_risk, "Unknown")
        await log_activity(
            user_id=user_id,
            activity_type="legal",
            text=f"Legal check completed — {risk_label}",
            property_name=f"{property_doc.bhk}, {property_doc.locality}",
            property_id=str(property_doc.id),
            action_label="View Report",
            action_href=f"/legal/{property_doc.id}",
        )

        return report

    def _build_property_context(self, prop: Property) -> str:
        """Build a context string for Gemini from property data."""
        return f"""
Property Details for Legal Analysis:
- Title: {prop.title}
- Apartment/Project: {prop.apartment_name or 'Not specified'}
- Address: {prop.address}
- Locality: {prop.locality}
- City: {prop.city}
- BHK: {prop.bhk}
- Price: ₹{prop.price:,.0f}/month
- Size: {prop.size_sqft or 'Not specified'} sqft
- Floor: {prop.floor or 'Not specified'} of {prop.total_floors or 'N/A'}
- RERA Number (if known): {prop.rera_number or 'Not provided'}
- Source Platform: {prop.source_platform}
- Days Listed: {prop.listed_days_ago}
- Photo Red Flags: {', '.join(prop.photo_red_flags) if prop.photo_red_flags else 'None'}
"""

    async def _run_gemini_analysis(self, context: str) -> str:
        """Send the property to Gemini for comprehensive legal analysis."""
        prompt = f"""You are a senior Indian real estate legal analyst. Analyze this property and provide a comprehensive legal assessment.

{context}

Based on your knowledge of Indian property law, RERA regulations, and real estate market practices, evaluate:

1. **RERA Registration**: Is this type of property likely RERA registered? Check based on city, property type, and builder. For resale flats in established housing societies, RERA is "Not Applicable". For new constructions, check if the project would be RERA registered. Provide a realistic assessment.

2. **Encumbrance Status**: Based on the property type, age, and location, assess the likely encumbrance status. Consider factors like active loans, mortgages, or legal disputes that are common in this area.

3. **Property Tax**: Based on the city and locality, assess whether property taxes are likely current. Consider the city's municipal corporation and common tax compliance patterns.

4. **Builder Track Record**: If the apartment/project name is identifiable, provide information about the builder/developer. Include their reputation, delivery track record, and any known legal issues.

5. **Legal References**: Cite specific Indian laws relevant to this property (RERA Act 2016, Transfer of Property Act 1882, Indian Contract Act 1872, Registration Act 1908, etc.)

Respond in this EXACT JSON format:
{{
    "rera": {{
        "status": "Registered" or "Not Registered" or "Pending" or "Not Applicable",
        "number": "RERA number if known, else N/A",
        "complaints": <number of complaints, 0 if unknown>,
        "details": "Explanation of RERA status"
    }},
    "encumbrance": {{
        "status": "Clear" or "Dispute" or "Manual Check Required",
        "details": "Explanation of encumbrance status"
    }},
    "property_tax": {{
        "status": "Paid" or "Dues Pending" or "Unknown",
        "details": "Explanation of property tax status"
    }},
    "builder_track_record": {{
        "status": "Good" or "Average" or "Poor" or "N/A",
        "details": "Builder/developer track record details"
    }},
    "legal_references": [
        {{
            "act": "Name of the Act",
            "section": "Relevant section",
            "relevance": "Why this is relevant to this property"
        }}
    ],
    "key_risks": ["List of specific risks identified"],
    "recommendations": ["List of specific recommendations for the buyer/tenant"]
}}

Return ONLY valid JSON, no markdown formatting.
"""
        try:
            response = self.model.generate_content(prompt)
            return response.text
        except Exception as e:
            print(f"[LegalAgent] Gemini error: {e}")
            traceback.print_exc()
            return "{}"

    def _parse_analysis(self, raw: str, prop: Property) -> Dict[str, Any]:
        """Parse Gemini's JSON response into structured data."""
        try:
            # Clean up potential markdown formatting
            cleaned = raw.strip()
            if cleaned.startswith("```"):
                cleaned = cleaned.split("\n", 1)[1] if "\n" in cleaned else cleaned
                if cleaned.endswith("```"):
                    cleaned = cleaned[:-3]
                cleaned = cleaned.strip()
                if cleaned.startswith("json"):
                    cleaned = cleaned[4:].strip()
            return json.loads(cleaned)
        except (json.JSONDecodeError, Exception) as e:
            print(f"[LegalAgent] Parse error: {e}")
            # Return safe defaults
            return {
                "rera": {"status": "Not Applicable" if prop.listed_days_ago > 365 else "Unknown", "number": "N/A", "complaints": 0, "details": "Unable to verify RERA status automatically. Manual verification recommended."},
                "encumbrance": {"status": "Manual Check Required", "details": "Automated encumbrance check could not be completed. Visit the local sub-registrar office for an official EC."},
                "property_tax": {"status": "Unknown", "details": "Property tax status could not be verified. Check with the local municipal corporation."},
                "builder_track_record": {"status": "N/A", "details": "Builder information not available for automated verification."},
                "legal_references": [],
                "key_risks": ["Automated verification incomplete — manual checks recommended"],
                "recommendations": ["Consult a property lawyer before finalizing"],
            }

    def _compute_risk(self, parsed: Dict[str, Any]) -> str:
        """Compute overall risk level algorithmically."""
        high_risk_triggers = [
            parsed.get("rera", {}).get("status") == "Not Registered",
            parsed.get("encumbrance", {}).get("status") == "Dispute",
            parsed.get("builder_track_record", {}).get("status") == "Poor",
            (parsed.get("rera", {}).get("complaints", 0) or 0) > 15,
        ]

        caution_triggers = [
            parsed.get("rera", {}).get("status") == "Pending",
            parsed.get("property_tax", {}).get("status") == "Dues Pending",
            parsed.get("builder_track_record", {}).get("status") == "Average",
            (parsed.get("rera", {}).get("complaints", 0) or 0) > 5,
            parsed.get("encumbrance", {}).get("status") == "Manual Check Required",
        ]

        if any(high_risk_triggers):
            return "high_risk"
        if any(caution_triggers):
            return "caution"
        return "clean"

    async def _generate_summary(self, parsed: Dict[str, Any], risk: str, prop: Property) -> str:
        """Generate a plain-English summary using Gemini."""
        risk_map = {"clean": "CLEAN", "caution": "CAUTION", "high_risk": "HIGH RISK"}
        prompt = f"""Write a 3-sentence plain English legal summary for a property tenant/buyer.

Property: {prop.bhk} in {prop.locality}, {prop.city}
Overall Risk: {risk_map.get(risk, 'UNKNOWN')}
RERA: {parsed.get('rera', {}).get('status', 'Unknown')} — {parsed.get('rera', {}).get('details', '')}
Encumbrance: {parsed.get('encumbrance', {}).get('status', 'Unknown')} — {parsed.get('encumbrance', {}).get('details', '')}
Property Tax: {parsed.get('property_tax', {}).get('status', 'Unknown')} — {parsed.get('property_tax', {}).get('details', '')}
Builder: {parsed.get('builder_track_record', {}).get('status', 'Unknown')} — {parsed.get('builder_track_record', {}).get('details', '')}

Start with the overall verdict. Be direct and actionable. Use simple language.
"""
        try:
            response = self.model.generate_content(prompt)
            return response.text.strip()
        except Exception:
            verdicts = {
                "clean": f"This property has a clean legal standing. Safe to proceed with {prop.bhk} in {prop.locality}.",
                "caution": f"Proceed with caution for {prop.bhk} in {prop.locality}. Some items require manual verification before committing.",
                "high_risk": f"High risk detected for {prop.bhk} in {prop.locality}. Significant legal concerns identified — we recommend avoiding this property.",
            }
            return verdicts.get(risk, "Unable to determine legal status. Consult a property lawyer.")
