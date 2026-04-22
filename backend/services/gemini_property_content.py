import json
from datetime import datetime
from typing import Any

from services.ai_client import call_llm_json, call_llm, MODEL_SMART, MODEL_FAST
from config import settings
from database.models.property import Property


class GeminiPropertyContentService:
	def __init__(self):
		self._enabled = True
		self._model_name = MODEL_SMART

	def _build_fallback(self, prop: Property, retrieval_notes: list[str]) -> dict[str, Any]:
		locality = prop.locality or "the selected locality"
		project_name = prop.apartment_name or prop.title or "the selected project"
		watchouts = list(prop.photo_red_flags or [])
		if not watchouts:
			watchouts.append("Verify brokerage, maintenance, and lock-in clauses in the source listing before finalizing.")

		availability = f" Around {prop.total_flats_available}+ flats are listed in this project." if prop.total_flats_available else ""
		card_summary = (
			f"{prop.bhk} in {project_name}, {locality} at approximately INR {int(prop.price):,}/month."
			f"{availability} Source: {prop.source_platform}."
		)

		highlights: list[str] = []
		if prop.size_sqft:
			highlights.append(f"Approx. {prop.size_sqft} sqft carpet/super built-up area")
		if prop.bathrooms:
			highlights.append(f"Bathrooms reported: {prop.bathrooms}")
		if prop.balconies:
			highlights.append(f"Balconies reported: {prop.balconies}")
		if prop.furnished_status:
			highlights.append(f"Furnishing: {prop.furnished_status}")
		if prop.floor:
			highlights.append(f"Floor info: {prop.floor}")
		if prop.amenities:
			highlights.append(f"Amenities mentioned: {', '.join(prop.amenities[:4])}")
		if not highlights:
			highlights.append("Primary details available from listing title, location, and rent")

		description = (prop.description or "").strip()
		if description:
			detail_overview = (
				f"This listing is a {prop.bhk} home in {locality} with an asking rent of INR {int(prop.price):,} per month. "
				f"Listing notes mention: {description[:420]}"
			)
		else:
			detail_overview = (
				f"This listing is a {prop.bhk} home in {locality}. "
				f"Asking rent is around INR {int(prop.price):,} per month. "
				"Verify maintenance, brokerage terms, and agreement clauses before moving forward."
			)

		location_insights = " ".join(retrieval_notes) if retrieval_notes else (
			f"Comparable rental context is limited in {locality}; validate with nearby listings before finalizing."
		)

		return {
			"card_summary": card_summary[:220],
			"detail_overview": detail_overview[:1200],
			"location_insights": location_insights,
			"investment_outlook": (
				"For rental decisions, compare this ask with at least 5 nearby active listings and"
				" evaluate total monthly outflow including maintenance and deposits."
			),
			"negotiation_tips": (
				"Use time-on-market, furnishing quality, and comparable rents in the same micro-market"
				" to negotiate lower rent or better lock-in terms."
			),
			"highlights": highlights[:5],
			"watchouts": watchouts[:4],
		}

	async def _get_retrieval_context(self, prop: Property) -> list[str]:
		try:
			if not prop.locality:
				return []

			price_floor = max(0, float(prop.price) * 0.7)
			price_cap = float(prop.price) * 1.3

			query = {
				"$and": [
					{"_id": {"$ne": prop.id}},
					{"locality": {"$regex": prop.locality, "$options": "i"}},
					{"is_fake": {"$ne": True}},
					{"price": {"$gte": price_floor, "$lte": price_cap}},
				]
			}
			if prop.bhk:
				query["$and"].append({"bhk": {"$regex": prop.bhk.split()[0], "$options": "i"}})

			peers = await Property.find(query).sort([("price", -1)]).limit(6).to_list()
			if not peers:
				return []

			prices = [float(p.price) for p in peers if p.price is not None]
			avg_price = sum(prices) / len(prices) if prices else 0
			min_price = min(prices) if prices else 0
			max_price = max(prices) if prices else 0

			notes = [
				f"Nearby comparable listings in {prop.locality} show a rent band of INR {int(min_price):,} to INR {int(max_price):,}.",
				f"Average comparable ask is around INR {int(avg_price):,} per month from {len(peers)} listings.",
			]

			if prop.price > avg_price and avg_price > 0:
				notes.append("Current listing appears above local average; negotiation leverage may exist.")
			elif avg_price > 0:
				notes.append("Current listing is at or below local average; verify condition and hidden charges quickly.")

			return notes
		except Exception:
			return []

	async def _call_gemini(self, prompt: str) -> dict[str, Any] | None:
		try:
			return await call_llm_json(prompt, model=MODEL_SMART)
		except Exception:
			return None

	def _coerce_payload(self, payload: dict[str, Any], fallback: dict[str, Any]) -> dict[str, Any]:
		card_summary = str(payload.get("card_summary") or fallback["card_summary"]).strip()[:220]
		detail_overview = str(payload.get("detail_overview") or fallback["detail_overview"]).strip()[:1200]
		location_insights = str(payload.get("location_insights") or fallback["location_insights"]).strip()[:1200]
		investment_outlook = str(payload.get("investment_outlook") or fallback["investment_outlook"]).strip()[:1200]
		negotiation_tips = str(payload.get("negotiation_tips") or fallback["negotiation_tips"]).strip()[:1200]

		highlights_raw = payload.get("highlights") if isinstance(payload.get("highlights"), list) else []
		watchouts_raw = payload.get("watchouts") if isinstance(payload.get("watchouts"), list) else []

		highlights = [str(x).strip() for x in highlights_raw if str(x).strip()][:5] or fallback["highlights"]
		watchouts = [str(x).strip() for x in watchouts_raw if str(x).strip()][:5] or fallback["watchouts"]

		return {
			"ai_card_summary": card_summary,
			"ai_detail_overview": detail_overview,
			"ai_location_insights": location_insights,
			"ai_investment_outlook": investment_outlook,
			"ai_negotiation_tips": negotiation_tips,
			"ai_highlights": highlights,
			"ai_watchouts": watchouts,
			"ai_last_generated_at": datetime.utcnow(),
		}

	async def generate_content(self, prop: Property) -> dict[str, Any]:
		retrieval_notes = await self._get_retrieval_context(prop)
		fallback = self._build_fallback(prop, retrieval_notes)

		if not self._enabled:
			return self._coerce_payload(fallback, fallback)

		prompt_payload = {
			"property": {
				"title": prop.title,
				"apartment_name": prop.apartment_name,
				"total_flats_available": prop.total_flats_available,
				"address": prop.address,
				"locality": prop.locality,
				"city": prop.city,
				"price_inr_monthly": prop.price,
				"bhk": prop.bhk,
				"size_sqft": prop.size_sqft,
				"bathrooms": prop.bathrooms,
				"balconies": prop.balconies,
				"floor": prop.floor,
				"furnished_status": prop.furnished_status,
				"amenities": prop.amenities,
				"description": prop.description,
				"source_platform": prop.source_platform,
				"source_url": prop.source_url,
				"listed_days_ago": prop.listed_days_ago,
			},
			"retrieval_context": retrieval_notes,
			"constraints": {
				"do_not_hallucinate": True,
				"unknown_fields_must_be_not_available": True,
				"focus": ["factual details", "location context", "negotiation utility"],
			},
			"output_schema": {
				"card_summary": "string <=220 chars",
				"detail_overview": "string",
				"location_insights": "string",
				"investment_outlook": "string",
				"negotiation_tips": "string",
				"highlights": ["string"],
				"watchouts": ["string"],
			},
		}

		prompt = (
			"You are a factual real-estate analyst. Use only provided JSON data. "
			"Never invent amenities, legal approvals, landmarks, or pricing facts. "
			"If something is unknown, say it is not available. "
			"Write concise, actionable content for a property card and details page.\n\n"
			f"INPUT_JSON:\n{json.dumps(prompt_payload, ensure_ascii=True)}\n\n"
			"Return strict JSON only with keys: card_summary, detail_overview, location_insights, "
			"investment_outlook, negotiation_tips, highlights, watchouts."
		)

		try:
			llm_payload = await self._call_gemini(prompt)
		except Exception:
			llm_payload = None
		if not llm_payload:
			return self._coerce_payload(fallback, fallback)

		return self._coerce_payload(llm_payload, fallback)

	async def enrich_property(self, prop: Property) -> Property:
		content = await self.generate_content(prop)
		for key, value in content.items():
			setattr(prop, key, value)
		await prop.save()
		return prop

	async def enrich_recent(self, properties: list[Property]) -> None:
		for prop in properties:
			try:
				await self.enrich_property(prop)
			except Exception:
				# Enrichment should never block scraping success.
				continue

