"""
Negotiation Agent — Multi-turn Gemini-powered negotiation state machine.
Handles market research, opening offers, response analysis, counter-offers,
and deal closure. Supports Twilio WhatsApp integration.
"""
import json
import math
import traceback
from datetime import datetime
from typing import Optional, Dict, Any, List

import google.generativeai as genai
from config import settings
from database.models.property import Property
from database.models.negotiation import Negotiation, Message
from services.activity_logger import log_activity


# ───────────────── State machine states ─────────────────
STATE_RESEARCH = "research"
STATE_OPENING = "craft_opening"
STATE_WAITING = "waiting_for_broker"
STATE_ANALYZING = "analyzing_response"
STATE_COUNTERING = "countering"
STATE_CLOSED_WON = "closed_won"
STATE_CLOSED_LOST = "closed_lost"
STATE_ESCALATED = "escalated_to_user"


class NegotiationAgent:
    """
    Gemini-powered negotiation engine with state persistence.
    Each negotiation is a multi-turn conversation stored in MongoDB.
    """

    def __init__(self):
        if settings.gemini_api_key:
            genai.configure(api_key=settings.gemini_api_key)
        self.model_pro = genai.GenerativeModel("gemini-3-flash-preview")
        self.model_flash = genai.GenerativeModel("gemini-3-flash-preview")

    # ──────────────── Phase 1: Market Research ────────────────

    async def research_market(self, prop: Property) -> Dict[str, Any]:
        """
        Query MongoDB for comparable properties and compute fair value range.
        """
        comparables = await Property.find(
            Property.locality == prop.locality,
            Property.bhk == prop.bhk,
            Property.is_fake == False,
            Property.price >= prop.price * 0.7,
            Property.price <= prop.price * 1.3,
        ).to_list(length=20)

        if len(comparables) < 2:
            # Broaden: same city + BHK
            comparables = await Property.find(
                Property.city == prop.city,
                Property.bhk == prop.bhk,
                Property.is_fake == False,
                Property.price >= prop.price * 0.6,
                Property.price <= prop.price * 1.4,
            ).to_list(length=30)

        prices = [c.price for c in comparables if c.price > 0]

        if prices:
            avg_price = sum(prices) / len(prices)
            min_price = min(prices)
            max_price = max(prices)
            fair_min = int(min(avg_price * 0.9, prop.price * 0.82))
            fair_max = int(min(avg_price * 1.05, prop.price * 0.95))
        else:
            # Fallback: use the property price itself
            fair_min = int(prop.price * 0.82)
            fair_max = int(prop.price * 0.93)
            avg_price = prop.price
            min_price = prop.price
            max_price = prop.price

        return {
            "comparable_count": len(comparables),
            "avg_price": int(avg_price),
            "min_price": int(min_price),
            "max_price": int(max_price),
            "fair_value_min": fair_min,
            "fair_value_max": fair_max,
            "recommended_opening": int(prop.price * 0.87),
            "listed_price": int(prop.price),
            "days_on_market": prop.listed_days_ago,
            "photo_red_flags": prop.photo_red_flags,
        }

    # ──────────────── Phase 2: Craft Opening ────────────────

    async def craft_opening_message(
        self,
        prop: Property,
        market_data: Dict[str, Any],
        user_max_price: int,
        tone: str = "balanced",
    ) -> str:
        """Generate the opening negotiation message using Gemini Pro."""
        opening_offer = market_data["recommended_opening"]
        leverage_points = []
        if market_data["days_on_market"] > 10:
            leverage_points.append(f"Property has been listed for {market_data['days_on_market']} days")
        if market_data["photo_red_flags"]:
            leverage_points.append(f"Photo issues: {', '.join(market_data['photo_red_flags'][:2])}")
        if market_data["comparable_count"] > 3:
            leverage_points.append(f"{market_data['comparable_count']} similar properties in same locality")

        tone_instruction = {
            "aggressive": "Be direct and firm. Mention competing properties and price mismatches. Push hard for the best deal.",
            "balanced": "Be professional and reasonable. Show genuine interest while presenting data-backed reasoning for the counter-offer.",
            "polite": "Be warm and respectful. Express strong interest and gently suggest a more competitive price based on market data.",
        }.get(tone, "Be professional and reasonable.")

        prompt = f"""You are a professional Indian real estate negotiator. Write an opening message to a property broker/owner.

Property: {prop.bhk}, {prop.locality}, {prop.city}
Listed Price: ₹{int(prop.price):,}/month
Our Opening Offer: ₹{opening_offer:,}/month
Fair Market Range: ₹{market_data['fair_value_min']:,} - ₹{market_data['fair_value_max']:,}/month
Comparable Properties: {market_data['comparable_count']} in same area
Average Market Price: ₹{market_data['avg_price']:,}/month

Leverage Points:
{chr(10).join(f"- {lp}" for lp in leverage_points) if leverage_points else "- None specific"}

Tone: {tone_instruction}

Write a natural, conversational message (3-5 sentences). Include:
1. Express interest in the property
2. Reference market data to justify the offer
3. State the opening offer amount clearly
4. Leave room for negotiation

Do NOT use any markdown formatting. Write as a plain WhatsApp/SMS message.
"""
        try:
            response = self.model_pro.generate_content(prompt)
            return response.text.strip()
        except Exception as e:
            print(f"[NegotiationAgent] Gemini error in opening: {e}")
            return (
                f"Hi, I'm reaching out regarding the {prop.bhk} at {prop.locality}. "
                f"My client is very interested. Based on comparable rentals in the area "
                f"(₹{market_data['fair_value_min']:,}-₹{market_data['fair_value_max']:,} range), "
                f"would you consider ₹{opening_offer:,}/month?"
            )

    # ──────────────── Phase 3: Analyze Broker Response ────────────────

    async def analyze_broker_response(
        self,
        broker_message: str,
        negotiation: Negotiation,
        prop: Property,
    ) -> Dict[str, Any]:
        """Analyze the broker's response using Gemini Flash."""
        messages_context = "\n".join(
            [f"{'Agent' if m.role == 'agent' else 'Broker'}: {m.content}" for m in negotiation.messages[-6:]]
        )

        prompt = f"""Analyze this real estate broker's response in a negotiation:

Property: {prop.bhk}, {prop.locality}, ₹{int(prop.price):,}/month listed
User's maximum budget: ₹{negotiation.user_max_price:,}/month
Current offer: ₹{negotiation.current_offer or 0:,}/month

Conversation so far:
{messages_context}

Latest broker message: "{broker_message}"

Analyze and respond in this EXACT JSON format:
{{
    "price_offered": <integer price if broker mentioned one, else null>,
    "broker_sentiment": "willing" or "firm" or "hostile",
    "broker_flexibility": "high" or "medium" or "low",
    "recommended_action": "counter" or "agree" or "walk_away" or "escalate_to_user",
    "reasoning": "Brief explanation of your analysis",
    "key_points": ["List of key takeaways from the broker's message"]
}}

Return ONLY valid JSON, no markdown.
"""
        try:
            response = self.model_flash.generate_content(prompt)
            text = response.text.strip()
            if text.startswith("```"):
                text = text.split("\n", 1)[1] if "\n" in text else text
                if text.endswith("```"):
                    text = text[:-3]
                text = text.strip()
                if text.startswith("json"):
                    text = text[4:].strip()
            return json.loads(text)
        except Exception as e:
            print(f"[NegotiationAgent] Analysis parse error: {e}")
            return {
                "price_offered": None,
                "broker_sentiment": "firm",
                "broker_flexibility": "medium",
                "recommended_action": "counter",
                "reasoning": "Could not analyze response automatically. Continuing with counter-offer.",
                "key_points": [broker_message[:100]],
            }

    # ──────────────── Phase 4: Craft Counter-Offer ────────────────

    async def craft_counter_offer(
        self,
        negotiation: Negotiation,
        prop: Property,
        analysis: Dict[str, Any],
        tone: str = "balanced",
    ) -> Dict[str, Any]:
        """Generate the next counter-offer with decreasing step sizes."""
        current_offer = negotiation.current_offer or int(prop.price * 0.87)
        user_max = negotiation.user_max_price
        turn_count = negotiation.turn_count or 0

        # Decreasing step size: start big, get smaller as we approach max
        remaining_budget = user_max - current_offer
        step_factor = max(0.15, 0.5 - (turn_count * 0.1))
        step = int(remaining_budget * step_factor)
        new_offer = min(current_offer + step, user_max)

        # If broker offered a specific price, react to it
        broker_price = analysis.get("price_offered")
        if broker_price and isinstance(broker_price, (int, float)):
            if broker_price <= user_max:
                # Broker is within budget — we can close or counter slightly lower
                midpoint = int((broker_price + current_offer) / 2)
                new_offer = max(midpoint, current_offer + 1000)
                if broker_price <= current_offer + 2000:
                    new_offer = broker_price  # Accept

        new_offer = min(new_offer, user_max)

        messages_context = "\n".join(
            [f"{'Agent' if m.role == 'agent' else 'Broker'}: {m.content}" for m in negotiation.messages[-4:]]
        )

        tone_map = {
            "aggressive": "Be assertive. Reference competing options and market data.",
            "balanced": "Be professional. Acknowledge the broker's position while firmly presenting your offer.",
            "polite": "Be respectful and collaborative. Show willingness to find middle ground.",
        }

        prompt = f"""Write a counter-offer message in a real estate negotiation.

Property: {prop.bhk}, {prop.locality}
Listed: ₹{int(prop.price):,}/month
Previous offer: ₹{current_offer:,}/month
New offer: ₹{new_offer:,}/month
Broker's sentiment: {analysis.get('broker_sentiment', 'unknown')}

Recent messages:
{messages_context}

Tone: {tone_map.get(tone, tone_map['balanced'])}

Write a natural response (2-4 sentences). Reference the broker's last message. State the new offer clearly. No markdown.
"""
        try:
            response = self.model_pro.generate_content(prompt)
            message_text = response.text.strip()
        except Exception:
            message_text = (
                f"I appreciate your response. After further consideration, we'd like to offer ₹{new_offer:,}/month. "
                f"This reflects current market conditions and our client's genuine interest in the property."
            )

        return {
            "message": message_text,
            "new_offer": new_offer,
            "should_close": new_offer >= user_max or (broker_price and broker_price <= user_max),
        }

    # ──────────────── Phase 5: Full Negotiation Flow ────────────────

    async def start_negotiation(
        self,
        prop: Property,
        user_max_price: int,
        tone: str = "balanced",
        user_id: Optional[str] = None,
        broker_contact: Optional[str] = None,
    ) -> Negotiation:
        """Initialize a new negotiation — research + craft opening."""
        # Market research
        market_data = await self.research_market(prop)

        # Craft opening
        opening_msg = await self.craft_opening_message(prop, market_data, user_max_price, tone)
        opening_offer = market_data["recommended_opening"]

        # Create the opening message object
        opening_message = Message(
            role="agent",
            content=opening_msg,
            timestamp=datetime.utcnow(),
            approved_by_user=False,
        )

        # Create negotiation document
        negotiation = Negotiation(
            user=user_id,
            property=prop.id,
            status="active",
            user_max_price=user_max_price,
            tone=tone,
            current_offer=opening_offer,
            broker_contact=broker_contact,
            messages=[opening_message],
            market_fair_value_min=market_data["fair_value_min"],
            market_fair_value_max=market_data["fair_value_max"],
            langgraph_state={
                "market_data": market_data,
                "state": STATE_WAITING,
                "analysis_history": [],
            },
            turn_count=1,
            created_at=datetime.utcnow(),
        )
        await negotiation.insert()

        # Log activity
        await log_activity(
            user_id=None,
            activity_type="negotiation",
            text=f"Opening offer sent — ₹{opening_offer:,}/month",
            property_name=f"{prop.bhk}, {prop.locality}",
            property_id=str(prop.id),
            action_label="View Thread",
            action_href=f"/negotiate/{prop.id}",
        )

        # Send actual WhatsApp message if contact provided
        if broker_contact and broker_contact != "unknown":
            await self._send_whatsapp(broker_contact, opening_msg)

        return negotiation

    async def _send_whatsapp(self, to_number: str, message: str):
        """Send an actual WhatsApp message via Twilio."""
        if not settings.twilio_account_sid or not settings.twilio_auth_token or not settings.twilio_whatsapp_from:
            print("[NegotiationAgent] Twilio credentials missing, skipping WhatsApp sending.")
            return

        try:
            from twilio.rest import Client
            client = Client(settings.twilio_account_sid, settings.twilio_auth_token)
            
            # Twilio WhatsApp numbers must be prefixed with 'whatsapp:'
            to_formatted = f"whatsapp:{to_number}" if not to_number.startswith("whatsapp:") else to_number
            from_formatted = f"whatsapp:{settings.twilio_whatsapp_from}" if not settings.twilio_whatsapp_from.startswith("whatsapp:") else settings.twilio_whatsapp_from
            
            message_instance = client.messages.create(
                from_=from_formatted,
                body=message,
                to=to_formatted
            )
            print(f"[NegotiationAgent] WhatsApp sent: {message_instance.sid}")
        except Exception as e:
            print(f"[NegotiationAgent] Twilio WhatsApp error: {e}")

    async def process_broker_response(
        self,
        negotiation_id: str,
        broker_message: str,
    ) -> Dict[str, Any]:
        """Process an incoming broker message and generate a response."""
        from bson import ObjectId

        neg = await Negotiation.get(ObjectId(negotiation_id))
        if not neg:
            return {"error": "Negotiation not found"}

        prop = await Property.get(neg.property)
        if not prop:
            return {"error": "Property not found"}

        # Add broker message
        broker_msg = Message(
            role="broker",
            content=broker_message,
            timestamp=datetime.utcnow(),
        )
        neg.messages.append(broker_msg)
        neg.turn_count += 1

        # Analyze the response
        analysis = await self.analyze_broker_response(broker_message, neg, prop)

        action = analysis.get("recommended_action", "counter")

        # Auto-escalate after 6 turns
        if neg.turn_count > 6:
            action = "escalate_to_user"

        result = {"analysis": analysis, "action": action}
        message_to_send = None

        if action == "counter":
            # Generate counter-offer
            counter = await self.craft_counter_offer(neg, prop, analysis, neg.tone)
            message_to_send = counter["message"]
            neg.current_offer = counter["new_offer"]
            neg.status = "active"
            result["new_offer"] = counter["new_offer"]

            if counter.get("should_close"):
                neg.status = "closed_won"
                result["action"] = "closed"

        elif action == "agree":
            # Accept broker's offer
            broker_price = analysis.get("price_offered") or neg.current_offer
            message_to_send = f"We have a deal! ₹{broker_price:,}/month works for us. Let's proceed with the paperwork."
            neg.current_offer = broker_price
            neg.status = "closed_won"
            result["action"] = "closed"

        elif action == "walk_away":
            message_to_send = "Thank you for your time, but we're unable to meet at this price point. We'll keep looking. Best wishes."
            neg.status = "closed_lost"

        elif action == "escalate_to_user":
            escalate_msg = Message(
                role="agent",
                content=f"[System] Negotiation requires your input. The broker's latest position and our analysis suggest the following options are available. Please review and decide.",
                timestamp=datetime.utcnow(),
            )
            neg.messages.append(escalate_msg)
            neg.status = "paused"
            result["agent_message"] = escalate_msg.content
        
        if message_to_send:
            agent_msg = Message(
                role="agent",
                content=message_to_send,
                timestamp=datetime.utcnow(),
            )
            neg.messages.append(agent_msg)
            result["agent_message"] = message_to_send
            
            # Send via Twilio
            if neg.broker_contact and neg.broker_contact != "unknown":
                await self._send_whatsapp(neg.broker_contact, message_to_send)


        # Save the updated state
        state = neg.langgraph_state or {}
        state["state"] = neg.status
        if "analysis_history" not in state:
            state["analysis_history"] = []
        state["analysis_history"].append(analysis)
        neg.langgraph_state = state
        await neg.save()

        # Log activity
        await log_activity(
            user_id=None,
            activity_type="negotiation",
            text=f"Broker responded — {analysis.get('broker_sentiment', 'unknown')} sentiment",
            property_name=f"{prop.bhk}, {prop.locality}",
            property_id=str(prop.id),
            action_label="Review",
            action_href=f"/negotiate/{prop.id}",
        )

        return result

    async def get_strategy_dashboard(self, negotiation: Negotiation, prop: Property) -> Dict[str, Any]:
        """Generate a real-time strategy dashboard for the frontend."""
        state = negotiation.langgraph_state or {}
        market_data = state.get("market_data", {})
        analysis_history = state.get("analysis_history", [])

        # Sentiment trend
        sentiments = [a.get("broker_sentiment", "unknown") for a in analysis_history]
        sentiment_trend = "improving" if sentiments and sentiments[-1] == "willing" else "stable" if not sentiments else "uncertain"

        # Leverage points
        leverage = []
        if prop.listed_days_ago > 10:
            leverage.append(f"Property listed for {prop.listed_days_ago} days — broker may be eager")
        if market_data.get("comparable_count", 0) > 3:
            leverage.append(f"{market_data['comparable_count']} comparable properties give you options")
        if prop.photo_red_flags:
            leverage.append(f"Photo issues detected — use as negotiation leverage")
        if negotiation.turn_count > 3:
            leverage.append("Multiple rounds of negotiation — broker is engaged")

        # Progress percentage
        if negotiation.market_fair_value_min and negotiation.market_fair_value_max:
            total_range = prop.price - negotiation.market_fair_value_min
            current_gap = (negotiation.current_offer or prop.price) - negotiation.market_fair_value_min
            progress = min(100, int((current_gap / max(total_range, 1)) * 100))
        else:
            progress = 50

        return {
            "fair_value_min": negotiation.market_fair_value_min or int(prop.price * 0.82),
            "fair_value_max": negotiation.market_fair_value_max or int(prop.price * 0.93),
            "comparable_count": market_data.get("comparable_count", 0),
            "recommended_opening": market_data.get("recommended_opening", int(prop.price * 0.87)),
            "sentiment_trend": sentiment_trend,
            "leverage_points": leverage,
            "progress_percent": progress,
            "turn_count": negotiation.turn_count,
        }
