"""
Gemini-powered property research and extraction.
Now uses Ollama Cloud via centralised ai_client.
"""
import json
import re
from typing import Any, Optional

from services.ai_client import call_llm_json, call_llm, MODEL_SMART, MODEL_FAST


class GeminiExtractor:
    """Uses Ollama for property research and extraction."""

    # ------------------------------------------------------------------
    # PRIMARY: Research real properties
    # ------------------------------------------------------------------

    async def research_properties(
        self,
        locality: str,
        city: str,
        bhk: str,
        count: int = 8,
    ) -> list[dict]:
        prompt = f"""You are an Indian real estate data researcher.

List exactly {count} REAL residential apartment societies/complexes in {locality}, {city}, India
that commonly have {bhk} apartments available for rent.

REQUIREMENTS:
- Use ONLY real, existing society/complex names. Do NOT invent names.
- Provide current approximate monthly rent in INR.
- Use realistic market prices for {locality}, {city} in 2024-2025.
- Include a mix of price ranges (budget, mid-range, premium).

Return as a JSON array. Each object MUST have ALL these keys:
[
  {{
    "society_name": "Exact real society/complex name",
    "approximate_rent": 35000,
    "typical_size_sqft": 850,
    "furnishing": "Semi Furnished",
    "floor": "8th of 20",
    "bathrooms": 2,
    "balconies": 1,
    "amenities": ["Swimming Pool", "Gym", "Parking"],
    "description": "One or two sentence description of the society and its exact location in {locality}."
  }}
]

IMPORTANT:
- society_name MUST be the real name (e.g., "Hiranandani Gardens", "Oberoi Splendor", "Lodha Palava")
- approximate_rent must be a NUMBER (not string), in INR
- amenities must be an array of 3-6 strings
- Return ONLY the JSON array, no explanation"""

        result = await call_llm_json(prompt, model=MODEL_SMART)
        if not isinstance(result, list):
            return []

        cleaned: list[dict] = []
        for item in result:
            if not isinstance(item, dict):
                continue
            name = item.get("society_name")
            rent = item.get("approximate_rent")
            if not name or not rent:
                continue
            try:
                rent = float(rent)
                if rent < 2000 or rent > 10_000_000:
                    continue
            except (TypeError, ValueError):
                continue

            name = str(name).strip().strip('"').strip("'")
            name = re.sub(r"^(?:in|at|near|of)\s+", "", name, flags=re.IGNORECASE).strip()
            if len(name) < 3:
                continue

            cleaned.append({
                "society_name": name,
                "approximate_rent": rent,
                "typical_size_sqft": int(item.get("typical_size_sqft") or 0) or None,
                "furnishing": item.get("furnishing") if item.get("furnishing") in (
                    "Fully Furnished", "Semi Furnished", "Unfurnished"
                ) else "Semi Furnished",
                "floor": str(item.get("floor", "")) if item.get("floor") else None,
                "bathrooms": int(item.get("bathrooms") or 0) or None,
                "balconies": int(item.get("balconies") or 0) or None,
                "amenities": [str(a).strip() for a in (item.get("amenities") or []) if str(a).strip()][:6],
                "description": str(item.get("description", ""))[:500] or None,
            })

        return cleaned[:count]

    # ------------------------------------------------------------------
    # SECONDARY: Extract from raw web page text
    # ------------------------------------------------------------------

    async def extract_property_from_page(
        self,
        page_text: str,
        page_title: str,
        source_url: str,
        search_title: str = "",
        search_snippet: str = "",
        fallback_bhk: str = "2 BHK",
        locality: str = "",
        city: str = "",
    ) -> Optional[dict]:
        trimmed = page_text[:5000]
        prompt = f"""Extract property listing details from this web page content.

Page Title: {page_title}
Search Title: {search_title}
URL: {source_url}
Context: Looking for {fallback_bhk} in {locality}, {city}

Page Content (first 5000 chars):
{trimmed}

Return STRICT JSON:
{{
  "price": <monthly rent as number in INR or null>,
  "project_name": <apartment/society name string or null>,
  "bhk": <string like "2 BHK" or null>,
  "size_sqft": <number or null>,
  "floor": <string like "5th of 12" or null>,
  "bathrooms": <number or null>,
  "balconies": <number or null>,
  "furnished_status": <"Fully Furnished"|"Semi Furnished"|"Unfurnished" or null>,
  "description": <brief factual description max 300 chars or null>,
  "amenities": <array of up to 6 strings or []>,
  "images": <array of image URLs found in content or []>
}}

Rules:
- project_name is the apartment/society/complex name. NOT the locality.
- price must be the MONTHLY RENT, not sale price.
- Return ONLY JSON."""

        result = await call_llm_json(prompt, model=MODEL_FAST)
        if not isinstance(result, dict):
            return None
        return self._clean_extraction(result)

    async def extract_from_snippet(
        self,
        search_title: str,
        search_snippet: str,
        source_url: str,
        fallback_bhk: str,
        locality: str,
    ) -> Optional[dict]:
        prompt = f"""Extract property listing data from this search result.

Title: {search_title}
Snippet: {search_snippet}
URL: {source_url}
Context: Looking for {fallback_bhk} in {locality}

Return STRICT JSON:
{{
  "price": <monthly rent number in INR or null>,
  "project_name": <apartment/society name or null>,
  "bhk": <string like "2 BHK" or null>,
  "description": <string max 200 chars or null>
}}

Return ONLY JSON."""

        result = await call_llm_json(prompt, model=MODEL_FAST)
        if not result or not isinstance(result, dict):
            return None

        price = result.get("price")
        if price is not None:
            try:
                price = float(price)
                if price <= 0:
                    price = None
            except (TypeError, ValueError):
                price = None

        project_name = result.get("project_name")
        if isinstance(project_name, str):
            project_name = project_name.strip() or None
        else:
            project_name = None

        return {
            "price": price,
            "project_name": project_name,
            "bhk": result.get("bhk") if isinstance(result.get("bhk"), str) else None,
            "description": str(result["description"])[:300] if result.get("description") else None,
        }

    # ------------------------------------------------------------------

    def _clean_extraction(self, result: dict) -> dict:
        price = result.get("price")
        if price is not None:
            try:
                price = float(price)
                if price <= 0:
                    price = None
            except (TypeError, ValueError):
                price = None

        project_name = result.get("project_name")
        if isinstance(project_name, str):
            project_name = project_name.strip().strip('"').strip("'")
            project_name = re.sub(r"^(?:in|at|near|of)\s+", "", project_name, flags=re.IGNORECASE).strip()
            project_name = project_name.split(",")[0].strip()
            if len(project_name) < 3:
                project_name = None
            if project_name:
                lowered = project_name.lower()
                rejects = ["flat", "apartment", "property", "listing", "rent", "available", "verified", "null", "none", "n/a"]
                if any(lowered == r for r in rejects):
                    project_name = None
        else:
            project_name = None

        images = result.get("images") or []
        if isinstance(images, list):
            images = [
                img for img in images
                if isinstance(img, str) and img.startswith("http")
                and not any(skip in img.lower() for skip in ["logo", "icon", "favicon", "sprite", "ad.", "pixel"])
            ]
        else:
            images = []

        amenities = result.get("amenities") or []
        if not isinstance(amenities, list):
            amenities = []
        amenities = [str(a).strip() for a in amenities if str(a).strip()][:10]

        return {
            "price": price,
            "project_name": project_name,
            "bhk": result.get("bhk") if isinstance(result.get("bhk"), str) else None,
            "size_sqft": int(result["size_sqft"]) if result.get("size_sqft") else None,
            "floor": result.get("floor") if isinstance(result.get("floor"), str) else None,
            "bathrooms": int(result["bathrooms"]) if result.get("bathrooms") else None,
            "balconies": int(result["balconies"]) if result.get("balconies") else None,
            "furnished_status": result.get("furnished_status") if result.get("furnished_status") in (
                "Fully Furnished", "Semi Furnished", "Unfurnished"
            ) else None,
            "description": str(result["description"])[:500] if result.get("description") else None,
            "amenities": amenities,
            "images": images[:5],
        }
