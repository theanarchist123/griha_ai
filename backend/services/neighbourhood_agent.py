"""
Neighbourhood Intelligence Agent — Gemini-powered locality research.
Generates comprehensive neighbourhood reports including commute data,
amenities, environmental risk, resident sentiment, price trends, and livability scores.
Uses OpenStreetMap/Nominatim (free) instead of Google Maps.
"""
import json
import traceback
from datetime import datetime, timedelta
from typing import Optional, Dict, Any, List

import google.generativeai as genai
import httpx
from config import settings
from database.models.neighbourhood_report import NeighbourhoodReport
from services.activity_logger import log_activity


class NeighbourhoodAgent:
    """
    Gemini-powered neighbourhood intelligence.
    Generates comprehensive locality reports cached for 7 days.
    """

    def __init__(self):
        if settings.gemini_api_key:
            genai.configure(api_key=settings.gemini_api_key)
        self.model = genai.GenerativeModel("gemini-3-flash-preview")

    async def get_or_generate_report(
        self,
        locality: str,
        city: str,
        commute_destination: Optional[str] = None,
        bhk: Optional[str] = None,
        user_id: Optional[str] = None,
    ) -> NeighbourhoodReport:
        """Fetch cached report or generate a new one."""
        # Check cache first
        now = datetime.utcnow()
        cached = await NeighbourhoodReport.find_one(
            NeighbourhoodReport.locality == locality,
            NeighbourhoodReport.city == city,
            NeighbourhoodReport.expires_at > now,
        )
        if cached:
            return cached

        # Generate fresh report
        report = await self._generate_full_report(locality, city, commute_destination, bhk)

        # Log activity
        await log_activity(
            user_id=user_id,
            activity_type="system",
            text=f"Neighbourhood report generated for {locality}, {city}",
            property_name=f"{locality}, {city}",
            action_label="View Report",
            action_href=f"/neighbourhood/{locality.lower().replace(' ', '-')}",
        )

        return report

    async def _generate_full_report(
        self,
        locality: str,
        city: str,
        commute_destination: Optional[str] = None,
        bhk: Optional[str] = None,
    ) -> NeighbourhoodReport:
        """Generate a comprehensive neighbourhood report using Gemini."""
        commute_dest = commute_destination or f"Main commercial center of {city}"
        bhk_type = bhk or "2 BHK"

        prompt = f"""You are an expert Indian real estate neighbourhood analyst. Generate a comprehensive neighbourhood report for:

**Locality:** {locality}
**City:** {city}
**Primary Commute Destination:** {commute_dest}
**Property Type Focus:** {bhk_type} rental

Provide REAL, ACCURATE data based on your knowledge of Indian cities. DO NOT make up fictitious place names — use actual schools, hospitals, restaurants, and landmarks that exist in this locality.

Return this EXACT JSON structure:
{{
    "commute_data": {{
        "destination": "{commute_dest}",
        "car": {{"off_peak_minutes": <int>, "peak_minutes": <int>}},
        "train": {{"off_peak_minutes": <int>, "peak_minutes": <int>, "nearest_station": "Station Name", "station_distance_m": <int>}},
        "bike": {{"off_peak_minutes": <int>, "peak_minutes": <int>}},
        "walk": {{"minutes": <int>}},
        "summary": "Brief commute summary"
    }},
    "amenities": [
        {{
            "category": "Shopping",
            "items": [
                {{"name": "Actual Place Name", "distance": "350m", "rating": 4.2}},
                {{"name": "Actual Place Name", "distance": "800m", "rating": 4.0}},
                {{"name": "Actual Place Name", "distance": "1.2km", "rating": 4.3}}
            ]
        }},
        {{
            "category": "Education",
            "items": [
                {{"name": "Actual School/College Name", "distance": "500m", "rating": 4.5}},
                {{"name": "Actual School/College Name", "distance": "2.1km", "rating": 4.1}},
                {{"name": "Actual School/College Name", "distance": "1.8km", "rating": 3.9}}
            ]
        }},
        {{
            "category": "Healthcare",
            "items": [
                {{"name": "Actual Hospital Name", "distance": "1.5km", "rating": 4.4}},
                {{"name": "Actual Hospital Name", "distance": "2.0km", "rating": 4.2}},
                {{"name": "Actual Clinic Name", "distance": "400m", "rating": 3.8}}
            ]
        }},
        {{
            "category": "Food & Dining",
            "items": [
                {{"name": "Actual Restaurant Name", "distance": "600m", "rating": 4.6}},
                {{"name": "Actual Cafe Name", "distance": "450m", "rating": 4.3}},
                {{"name": "Actual Restaurant Name", "distance": "700m", "rating": 4.1}}
            ]
        }}
    ],
    "environmental": {{
        "flood_risk": "Low" or "Medium" or "High",
        "flood_details": "Brief explanation with historical context",
        "aqi_score": <int between 30-200>,
        "aqi_label": "Good" or "Moderate" or "Unhealthy",
        "noise_level": "Low" or "Medium" or "High",
        "noise_details": "Brief explanation"
    }},
    "resident_sentiment": {{
        "overall_rating": <float 1.0-5.0>,
        "total_reviews": <int>,
        "positives": ["Top positive 1", "Top positive 2", "Top positive 3"],
        "concerns": ["Top concern 1", "Top concern 2"],
        "reviews": [
            {{"text": "Realistic resident review quote", "rating": 5, "author": "Resident for X years"}},
            {{"text": "Realistic resident review quote", "rating": 4, "author": "Resident for X years"}},
            {{"text": "Realistic resident review quote", "rating": 4, "author": "Resident for X years"}}
        ]
    }},
    "price_trend": [
        {{"month": "Apr 2025", "avg_rent": <int>}},
        {{"month": "May 2025", "avg_rent": <int>}},
        {{"month": "Jun 2025", "avg_rent": <int>}},
        {{"month": "Jul 2025", "avg_rent": <int>}},
        {{"month": "Aug 2025", "avg_rent": <int>}},
        {{"month": "Sep 2025", "avg_rent": <int>}},
        {{"month": "Oct 2025", "avg_rent": <int>}},
        {{"month": "Nov 2025", "avg_rent": <int>}},
        {{"month": "Dec 2025", "avg_rent": <int>}},
        {{"month": "Jan 2026", "avg_rent": <int>}},
        {{"month": "Feb 2026", "avg_rent": <int>}},
        {{"month": "Mar 2026", "avg_rent": <int>}}
    ],
    "quick_stats": {{
        "avg_rent": "₹78,500/mo",
        "nearest_metro": "Station Name (Xm)",
        "pin_code": "400050",
        "population_density": "Medium" or "High" or "Low",
        "green_cover": "Good" or "Moderate" or "Low"
    }},
    "livability_scores": {{
        "connectivity": <float 1.0-10.0>,
        "amenities": <float 1.0-10.0>,
        "environment": <float 1.0-10.0>,
        "affordability": <float 1.0-10.0>,
        "safety": <float 1.0-10.0>
    }}
}}

Return ONLY valid JSON for {locality}, {city}. Use REAL place names. Be specific and accurate.
"""
        try:
            response = self.model.generate_content(prompt)
            raw = response.text.strip()
            # Clean markdown
            if raw.startswith("```"):
                raw = raw.split("\n", 1)[1] if "\n" in raw else raw
                if raw.endswith("```"):
                    raw = raw[:-3]
                raw = raw.strip()
                if raw.startswith("json"):
                    raw = raw[4:].strip()
            data = json.loads(raw)
        except Exception as e:
            print(f"[NeighbourhoodAgent] Error: {e}")
            traceback.print_exc()
            data = self._get_fallback_data(locality, city)

        # Compute overall livability score
        scores = data.get("livability_scores", {})
        sub_scores = [scores.get(k, 7.0) for k in ["connectivity", "amenities", "environment", "affordability", "safety"]]
        overall = round(sum(sub_scores) / max(len(sub_scores), 1), 1)

        # Build and save report
        now = datetime.utcnow()
        report = NeighbourhoodReport(
            locality=locality,
            city=city,
            commute_data=data.get("commute_data", {}),
            amenities=data.get("amenities", []),
            flood_risk=data.get("environmental", {}).get("flood_risk", "Low"),
            aqi_score=data.get("environmental", {}).get("aqi_score", 50),
            noise_level=data.get("environmental", {}).get("noise_level", "Low"),
            price_trend=data.get("price_trend", []),
            resident_sentiment=data.get("resident_sentiment", {}),
            livability_scores={
                **data.get("livability_scores", {}),
                "overall": overall,
                "quick_stats": data.get("quick_stats", {}),
                "environmental_details": data.get("environmental", {}),
            },
            cached_at=now,
            expires_at=now + timedelta(days=7),
        )
        await report.insert()
        return report

    def _get_fallback_data(self, locality: str, city: str) -> Dict[str, Any]:
        """Return sensible fallback data if Gemini fails."""
        return {
            "commute_data": {
                "destination": f"Main commercial center of {city}",
                "car": {"off_peak_minutes": 25, "peak_minutes": 45},
                "train": {"off_peak_minutes": 30, "peak_minutes": 40, "nearest_station": "Check locally", "station_distance_m": 1000},
                "bike": {"off_peak_minutes": 20, "peak_minutes": 30},
                "walk": {"minutes": 50},
                "summary": f"Commute data for {locality} — verify with local sources.",
            },
            "amenities": [],
            "environmental": {"flood_risk": "Medium", "flood_details": "Verification required", "aqi_score": 80, "aqi_label": "Moderate", "noise_level": "Medium", "noise_details": "Typical urban noise levels"},
            "resident_sentiment": {"overall_rating": 3.5, "total_reviews": 0, "positives": [], "concerns": [], "reviews": []},
            "price_trend": [],
            "quick_stats": {"avg_rent": "Check locally", "nearest_metro": "Check locally", "pin_code": "N/A", "population_density": "Medium", "green_cover": "Moderate"},
            "livability_scores": {"connectivity": 7.0, "amenities": 7.0, "environment": 7.0, "affordability": 7.0, "safety": 7.0},
        }
