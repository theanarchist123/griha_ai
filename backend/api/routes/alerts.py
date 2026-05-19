"""
Price Drop Alerts API Routes
Supports: create, list, delete, and check alerts against current property prices.
"""
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime

from database.models.price_alert import PriceAlert
from database.models.property import Property

router = APIRouter(prefix="/api/alerts", tags=["Price Drop Alerts"])


# ── Request / Response Schemas ──────────────────────────────────────────

class CreateAlertRequest(BaseModel):
    clerk_id: str
    target_price: float
    original_price: float

    # Property-specific alert
    property_id: Optional[str] = None
    property_title: Optional[str] = None
    property_locality: Optional[str] = None
    property_bhk: Optional[str] = None
    property_image: Optional[str] = None

    # OR search-query alert
    search_locality: Optional[str] = None
    search_bhk: Optional[str] = None


class AlertOut(BaseModel):
    id: str
    clerk_id: str
    property_id: Optional[str]
    property_title: Optional[str]
    property_locality: Optional[str]
    property_bhk: Optional[str]
    property_image: Optional[str]
    search_locality: Optional[str]
    search_bhk: Optional[str]
    target_price: float
    original_price: float
    is_active: bool
    triggered: bool
    triggered_at: Optional[str]
    triggered_price: Optional[float]
    price_history: List[dict]
    created_at: str
    updated_at: str

    # Computed UI fields
    savings_amount: float          # original - target
    savings_pct: float             # % drop
    label: str                     # display title


def _to_alert_out(alert: PriceAlert) -> AlertOut:
    savings = max(0.0, alert.original_price - alert.target_price)
    pct = round((savings / alert.original_price) * 100, 1) if alert.original_price > 0 else 0.0

    # Build a human-readable label
    if alert.property_title:
        label = alert.property_title
    elif alert.property_locality and alert.property_bhk:
        label = f"{alert.property_bhk} in {alert.property_locality}"
    elif alert.search_locality and alert.search_bhk:
        label = f"{alert.search_bhk} in {alert.search_locality}"
    elif alert.search_locality:
        label = f"Any flat in {alert.search_locality}"
    else:
        label = "Price Alert"

    return AlertOut(
        id=str(alert.id),
        clerk_id=alert.clerk_id,
        property_id=alert.property_id,
        property_title=alert.property_title,
        property_locality=alert.property_locality,
        property_bhk=alert.property_bhk,
        property_image=alert.property_image,
        search_locality=alert.search_locality,
        search_bhk=alert.search_bhk,
        target_price=alert.target_price,
        original_price=alert.original_price,
        is_active=alert.is_active,
        triggered=alert.triggered,
        triggered_at=alert.triggered_at.isoformat() if alert.triggered_at else None,
        triggered_price=alert.triggered_price,
        price_history=alert.price_history[-10:],   # last 10 datapoints for sparkline
        created_at=alert.created_at.isoformat(),
        updated_at=alert.updated_at.isoformat(),
        savings_amount=savings,
        savings_pct=pct,
        label=label,
    )


# ── Endpoints ────────────────────────────────────────────────────────────

@router.post("/", response_model=dict)
async def create_alert(req: CreateAlertRequest):
    """Create a new price drop alert."""

    if req.target_price <= 0:
        raise HTTPException(400, "target_price must be greater than 0")
    if req.original_price <= 0:
        raise HTTPException(400, "original_price must be greater than 0")
    if req.target_price >= req.original_price:
        raise HTTPException(400, "target_price must be less than original_price")
    if not req.property_id and not req.search_locality:
        raise HTTPException(400, "Either property_id or search_locality is required")

    # Prevent duplicates: same user + same property
    if req.property_id:
        existing = await PriceAlert.find_one(
            PriceAlert.clerk_id == req.clerk_id,
            PriceAlert.property_id == req.property_id,
            PriceAlert.is_active == True,
        )
        if existing:
            raise HTTPException(409, "You already have an active alert for this property")

    alert = PriceAlert(
        clerk_id=req.clerk_id,
        target_price=req.target_price,
        original_price=req.original_price,
        property_id=req.property_id,
        property_title=req.property_title,
        property_locality=req.property_locality,
        property_bhk=req.property_bhk,
        property_image=req.property_image,
        search_locality=req.search_locality,
        search_bhk=req.search_bhk,
        price_history=[{"price": req.original_price, "checked_at": datetime.utcnow().isoformat()}],
    )
    await alert.insert()

    return {"status": "success", "data": _to_alert_out(alert).model_dump()}


@router.get("/{clerk_id}", response_model=dict)
async def list_alerts(clerk_id: str, include_triggered: bool = False):
    """List all active (and optionally triggered) alerts for a user."""
    query = [PriceAlert.clerk_id == clerk_id]
    if not include_triggered:
        query.append(PriceAlert.is_active == True)

    alerts = await PriceAlert.find(*query).sort("-created_at").to_list()

    return {
        "status": "success",
        "data": [_to_alert_out(a).model_dump() for a in alerts],
        "counts": {
            "active": sum(1 for a in alerts if a.is_active and not a.triggered),
            "triggered": sum(1 for a in alerts if a.triggered),
        },
    }


@router.delete("/{alert_id}", response_model=dict)
async def delete_alert(alert_id: str, clerk_id: str):
    """Soft-delete (deactivate) an alert. Pass clerk_id as query param for auth."""
    alert = await PriceAlert.get(alert_id)
    if not alert:
        raise HTTPException(404, "Alert not found")
    if alert.clerk_id != clerk_id:
        raise HTTPException(403, "Not your alert")

    alert.is_active = False
    alert.updated_at = datetime.utcnow()
    await alert.save()
    return {"status": "success", "message": "Alert deactivated"}


@router.post("/{clerk_id}/check", response_model=dict)
async def check_alerts(clerk_id: str):
    """
    Check all active alerts for a user against the latest property prices in DB.
    Returns triggered alert IDs and summary stats.
    Intended to be called by the frontend on dashboard load.
    """
    active_alerts = await PriceAlert.find(
        PriceAlert.clerk_id == clerk_id,
        PriceAlert.is_active == True,
        PriceAlert.triggered == False,
    ).to_list()

    if not active_alerts:
        return {"status": "success", "triggered_count": 0, "checked": 0}

    newly_triggered: List[str] = []
    now = datetime.utcnow()

    for alert in active_alerts:
        current_price: Optional[float] = None

        if alert.property_id:
            # Look up property in DB
            try:
                prop = await Property.get(alert.property_id)
                if prop:
                    current_price = prop.price
            except Exception:
                # If doc not found, skip
                pass
        elif alert.search_locality:
            # Find cheapest matching property
            query = {"city": alert.search_locality}
            if alert.search_bhk:
                query["bhk"] = alert.search_bhk  # type: ignore[assignment]
            cheapest = (
                await Property.find(
                    Property.locality == alert.search_locality,
                    Property.is_fake == False,
                )
                .sort("price")
                .first_or_none()
            )
            if cheapest:
                current_price = cheapest.price

        if current_price is None:
            continue

        # Record price snapshot
        snapshot = {"price": current_price, "checked_at": now.isoformat()}
        alert.price_history.append(snapshot)
        alert.updated_at = now

        # Check if alert threshold met
        if current_price <= alert.target_price:
            alert.triggered = True
            alert.triggered_at = now
            alert.triggered_price = current_price
            alert.is_active = False
            newly_triggered.append(str(alert.id))

        await alert.save()

    return {
        "status": "success",
        "checked": len(active_alerts),
        "triggered_count": len(newly_triggered),
        "triggered_alert_ids": newly_triggered,
    }
