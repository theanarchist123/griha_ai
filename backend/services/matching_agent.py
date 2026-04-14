"""
Matching Agent — Gemini-powered property-user scoring.
Filters properties by hard criteria (city, budget, BHK) then
uses Gemini for intelligent matching with preference breakdown.
"""
import json
import traceback
from datetime import datetime
from typing import Optional, Dict, Any, List

import google.generativeai as genai
from config import settings
from database.models.property import Property
from database.models.match import Match
from database.models.search_profile import SearchProfile
from database.models.user import User
from services.activity_logger import log_activity


class MatchingAgent:
    """
    AI scoring agent that matches properties to user preferences.
    """

    def __init__(self):
        if settings.gemini_api_key:
            genai.configure(api_key=settings.gemini_api_key)
        self.model = genai.GenerativeModel("gemini-3-flash-preview")

    async def run_matching(self, user_id: str, profile: SearchProfile) -> List[Match]:
        """
        Run full matching pipeline for a user:
        1. Hard filter via MongoDB
        2. AI scoring via Gemini
        3. Store results
        """
        # Phase 1: Hard MongoDB filter
        candidates = await self._hard_filter(profile)
        if not candidates:
            return []

        # Phase 2: AI scoring
        matches = []
        # Process in batches of 5
        for i in range(0, len(candidates), 5):
            batch = candidates[i:i + 5]
            batch_matches = await self._score_batch(batch, profile, user_id)
            matches.extend(batch_matches)

        # Sort by match score descending
        matches.sort(key=lambda m: m.match_score, reverse=True)

        # Log top match
        if matches:
            top = matches[0]
            prop = await Property.get(top.property)
            if prop:
                await log_activity(
                    user_id=user_id,
                    activity_type="match",
                    text=f"New {top.match_score}% match found",
                    property_name=f"{prop.bhk}, {prop.locality}",
                    property_id=str(prop.id),
                    action_label="View",
                    action_href=f"/property/{prop.id}",
                )

        return matches

    async def _hard_filter(self, profile: SearchProfile) -> List[Property]:
        """Apply hard filter criteria via MongoDB queries."""
        query_filters = [
            Property.is_fake == False,
            Property.price <= (profile.budget_max or 999999),
        ]

        if profile.budget_min:
            query_filters.append(Property.price >= profile.budget_min)

        # City filter
        if profile.city:
            query_filters.append(Property.city == profile.city)

        # BHK filter
        if profile.size:
            query_filters.append(Property.bhk == profile.size)

        candidates = await Property.find(*query_filters).to_list(length=50)
        return candidates

    async def _score_batch(
        self,
        properties: List[Property],
        profile: SearchProfile,
        user_id: str,
    ) -> List[Match]:
        """Score a batch of properties using Gemini."""
        props_context = []
        for p in properties:
            props_context.append({
                "id": str(p.id),
                "title": p.title,
                "apartment": p.apartment_name,
                "locality": p.locality,
                "city": p.city,
                "price": p.price,
                "bhk": p.bhk,
                "size_sqft": p.size_sqft,
                "floor": p.floor,
                "furnishing": p.furnished_status,
                "amenities": p.amenities[:8],
                "days_listed": p.listed_days_ago,
                "photo_red_flags": p.photo_red_flags[:3],
                "legal_status": p.legal_status,
            })

        user_prefs = {
            "intent": profile.intent,
            "budget_min": profile.budget_min,
            "budget_max": profile.budget_max,
            "preferred_localities": profile.localities,
            "bhk": profile.size,
            "must_haves": profile.must_haves,
            "deal_breakers": profile.deal_breakers,
            "commute_destination": profile.commute_destination,
        }

        prompt = f"""Score these properties against the user's preferences.

USER PREFERENCES:
{json.dumps(user_prefs, indent=2)}

PROPERTIES:
{json.dumps(props_context, indent=2)}

For each property, provide:
- match_score: 0-100 integer
- breakdown: object with boolean for each preference (budget_fit, location_match, bhk_match, amenities_match, legal_ok, etc.)
- ai_insight: One specific sentence about why this property matches or doesn't
- recommended_action: "shortlist", "review", "skip", or "strong_match"

Return JSON array:
[
    {{
        "property_id": "id_string",
        "match_score": 85,
        "breakdown": {{"budget_fit": true, "location_match": true, "bhk_match": true, "amenities_match": false}},
        "ai_insight": "Specific insight about this match",
        "recommended_action": "shortlist"
    }}
]

Return ONLY valid JSON. No markdown.
"""
        try:
            response = self.model.generate_content(prompt)
            raw = response.text.strip()
            if raw.startswith("```"):
                raw = raw.split("\n", 1)[1] if "\n" in raw else raw
                if raw.endswith("```"):
                    raw = raw[:-3]
                raw = raw.strip()
                if raw.startswith("json"):
                    raw = raw[4:].strip()
            scores = json.loads(raw)
        except Exception as e:
            print(f"[MatchingAgent] Scoring error: {e}")
            traceback.print_exc()
            # Fallback: basic algorithmic scoring
            scores = []
            for p in properties:
                score = 70
                if profile.budget_max and p.price <= profile.budget_max:
                    score += 10
                if any(loc.lower() in p.locality.lower() for loc in profile.localities):
                    score += 10
                if p.legal_status == "clean":
                    score += 5
                scores.append({
                    "property_id": str(p.id),
                    "match_score": min(score, 100),
                    "breakdown": {"budget_fit": p.price <= (profile.budget_max or 999999)},
                    "ai_insight": f"{p.bhk} in {p.locality} at ₹{int(p.price):,}/mo.",
                    "recommended_action": "review",
                })

        # Store matches
        matches = []
        for s in scores:
            if not isinstance(s, dict):
                continue
            try:
                # Check if match already exists
                from bson import ObjectId
                prop_id = s.get("property_id", "")
                if not ObjectId.is_valid(prop_id):
                    continue

                existing = await Match.find_one(
                    Match.user == user_id,
                    Match.property == ObjectId(prop_id),
                )
                if existing:
                    # Update score
                    existing.match_score = s.get("match_score", 70)
                    existing.ai_insight = s.get("ai_insight", "")
                    existing.match_breakdown = s.get("breakdown", {})
                    existing.recommended_action = s.get("recommended_action", "review")
                    await existing.save()
                    matches.append(existing)
                else:
                    match = Match(
                        user=user_id,
                        property=ObjectId(prop_id),
                        match_score=s.get("match_score", 70),
                        match_breakdown=s.get("breakdown", {}),
                        ai_insight=s.get("ai_insight", ""),
                        recommended_action=s.get("recommended_action", "review"),
                        status="new",
                        created_at=datetime.utcnow(),
                    )
                    await match.insert()
                    matches.append(match)
            except Exception as e:
                print(f"[MatchingAgent] Match save error: {e}")
                continue

        return matches
