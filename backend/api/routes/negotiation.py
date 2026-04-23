"""
Negotiation API Routes — Real Gemini-powered multi-turn negotiation.
"""
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import Optional, List
from bson import ObjectId
from database.models.property import Property
from database.models.negotiation import Negotiation
from database.models.user import User
from services.negotiation_agent import NegotiationAgent

router = APIRouter(prefix="/api/negotiation", tags=["Negotiation"])
negotiation_agent = NegotiationAgent()


def _prop_id(ref):
    """Safely extract ObjectId from a Beanie Link or plain id."""
    from beanie.odm.fields import Link
    if isinstance(ref, Link):
        return ref.ref.id
    return ref


class NegotiationStartRequest(BaseModel):
    property_id: str
    clerk_id: Optional[str] = None
    user_max_price: int
    tone: str = "balanced"
    broker_contact: Optional[str] = None


class BrokerResponseRequest(BaseModel):
    broker_message: str


class SettingsUpdateRequest(BaseModel):
    tone: Optional[str] = None
    user_max_price: Optional[int] = None


@router.post("/start")
async def start_negotiation(req: NegotiationStartRequest):
    """Start a new negotiation for a property."""
    prop = None
    if ObjectId.is_valid(req.property_id):
        prop = await Property.get(ObjectId(req.property_id))
    if not prop:
        prop = await Property.find_one(Property.external_id == req.property_id)
        
    if not prop:
        raise HTTPException(404, "Property not found")

    # Check for existing active negotiation on this property
    existing = await Negotiation.find_one({
        "property": prop.id,
        "status": {"$in": ["active", "waiting_for_broker", "paused"]},
    })
    if existing:
        return {
            "status": "success",
            "message": "Existing negotiation found",
            "negotiation_id": str(existing.id),
            "data": _serialize_negotiation(existing, prop),
        }

    # Resolve user
    user_id = None
    if req.clerk_id:
        user = await User.find_one(User.clerk_id == req.clerk_id)
        if user:
            user_id = user.id

    try:
        neg = await negotiation_agent.start_negotiation(
            prop=prop,
            user_max_price=req.user_max_price,
            tone=req.tone,
            user_id=user_id,
            broker_contact=req.broker_contact,
        )
    except Exception as e:
        raise HTTPException(500, f"Failed to start negotiation: {str(e)}")

    return {
        "status": "success",
        "negotiation_id": str(neg.id),
        "data": _serialize_negotiation(neg, prop),
    }


@router.get("/{negotiation_id}")
async def get_negotiation(negotiation_id: str):
    """Fetch a negotiation by its ID."""
    if not ObjectId.is_valid(negotiation_id):
        raise HTTPException(400, "Invalid negotiation ID")

    neg = await Negotiation.get(ObjectId(negotiation_id))
    if not neg:
        raise HTTPException(404, "Negotiation not found")

    prop = await Property.get(_prop_id(neg.property))
    strategy = None
    if prop:
        strategy = await negotiation_agent.get_strategy_dashboard(neg, prop)

    return {
        "status": "success",
        "data": _serialize_negotiation(neg, prop),
        "strategy": strategy,
    }


@router.get("/property/{property_id}")
async def get_negotiation_by_property(property_id: str):
    """Fetch negotiation by property ID."""
    prop = None
    if ObjectId.is_valid(property_id):
        prop = await Property.get(ObjectId(property_id))
    if not prop:
        prop = await Property.find_one(Property.external_id == property_id)
        
    if not prop:
        raise HTTPException(404, "Property not found")

    neg = await Negotiation.find_one(Negotiation.property == prop.id)
    if not neg:
        return {"status": "not_found", "data": None}

    strategy = await negotiation_agent.get_strategy_dashboard(neg, prop)

    return {
        "status": "success",
        "data": _serialize_negotiation(neg, prop),
        "strategy": strategy,
    }


@router.post("/{negotiation_id}/respond")
async def simulate_broker_response(negotiation_id: str, req: BrokerResponseRequest):
    """Process a broker response and generate AI counter-offer."""
    if not ObjectId.is_valid(negotiation_id):
        raise HTTPException(400, "Invalid negotiation ID")

    try:
        result = await negotiation_agent.process_broker_response(
            negotiation_id=negotiation_id,
            broker_message=req.broker_message,
        )
    except Exception as e:
        raise HTTPException(500, f"Failed to process response: {str(e)}")

    # Fetch updated negotiation
    neg = await Negotiation.get(ObjectId(negotiation_id))
    prop = await Property.get(_prop_id(neg.property)) if neg else None

    return {
        "status": "success",
        "result": result,
        "data": _serialize_negotiation(neg, prop) if neg else None,
    }


@router.patch("/{negotiation_id}/settings")
async def update_negotiation_settings(negotiation_id: str, req: SettingsUpdateRequest):
    """Update negotiation tone or max price."""
    if not ObjectId.is_valid(negotiation_id):
        raise HTTPException(400, "Invalid negotiation ID")

    neg = await Negotiation.get(ObjectId(negotiation_id))
    if not neg:
        raise HTTPException(404, "Negotiation not found")

    if req.tone:
        neg.tone = req.tone
    if req.user_max_price:
        neg.user_max_price = req.user_max_price
    await neg.save()

    return {"status": "success", "message": "Settings updated"}


def _serialize_negotiation(neg: Negotiation, prop: Optional[Property] = None) -> dict:
    """Serialize negotiation for API response."""
    messages = []
    for m in (neg.messages or []):
        messages.append({
            "role": m.role,
            "content": m.content,
            "timestamp": m.timestamp.isoformat() if m.timestamp else None,
            "approved_by_user": m.approved_by_user,
        })

    result = {
        "id": str(neg.id),
        "property_id": str(neg.property) if neg.property else None,
        "status": neg.status,
        "user_max_price": neg.user_max_price,
        "tone": neg.tone,
        "current_offer": neg.current_offer,
        "broker_contact": neg.broker_contact,
        "messages": messages,
        "fair_value_min": neg.market_fair_value_min,
        "fair_value_max": neg.market_fair_value_max,
        "turn_count": neg.turn_count,
        "created_at": neg.created_at.isoformat() if neg.created_at else None,
    }

    if prop:
        result["property"] = {
            "id": str(prop.id),
            "title": prop.title,
            "apartment_name": prop.apartment_name,
            "bhk": prop.bhk,
            "locality": prop.locality,
            "city": prop.city,
            "address": prop.address,
            "price": prop.price,
            "images": prop.images[:3],
            "days_listed": prop.listed_days_ago,
        }

    return result


from fastapi import Form, Request

@router.post("/twilio/webhook")
async def twilio_webhook(request: Request):
    """Webhook for Twilio incoming WhatsApp messages."""
    form_data = await request.form()
    from_number = form_data.get("From", "")
    message_body = form_data.get("Body", "")
    
    if not message_body or not from_number:
        return {"status": "ignored"}
        
    # Strip whatsapp: prefix if present
    clean_number = from_number.replace("whatsapp:", "")
    
    # Find active negotiation with this broker contact
    # In a real app we'd map this more durably, but this works for demo
    neg = await Negotiation.find_one({
        "broker_contact": clean_number,
        "status": {"$in": ["active", "waiting_for_broker"]}
    })
    
    if not neg:
        print(f"Received WhatsApp from {clean_number} but no active negotiation found.")
        return {"status": "no_active_negotiation"}
        
    try:
        await negotiation_agent.process_broker_response(
            negotiation_id=str(neg.id),
            broker_message=message_body
        )
        return {"status": "success"}
    except Exception as e:
        print(f"Twilio webhook processing error: {e}")
        return {"status": "error"}

