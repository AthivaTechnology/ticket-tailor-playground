import os
import json
import uuid
import stripe
import math
import logging
import requests as http_requests
from datetime import datetime, timezone
from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel
from typing import List, Optional
from dotenv import load_dotenv
from services.ticket_tailor import post_to_tt, fetch_from_tt
from services.email_service import send_ticket_confirmation

load_dotenv()

logger = logging.getLogger(__name__)

stripe.api_key = os.getenv("STRIPE_SECRET_KEY", "")
STRIPE_WEBHOOK_SECRET = os.getenv("STRIPE_WEBHOOK_SECRET", "")
FRONTEND_URL = os.getenv("FRONTEND_URL", "http://localhost:5173")

# ── Stripe Connect Config ──────────────────────────────────────────────────────
STRIPE_CONNECTED_ACCOUNT = os.getenv("STRIPE_CONNECTED_ACCOUNT", "")
PLATFORM_FEE_PERCENT = float(os.getenv("PLATFORM_FEE_PERCENT", "10"))

# ── Pending orders file (when TT billing blocks ticket creation) ───────────────
PENDING_ORDERS_FILE = os.path.join(os.path.dirname(__file__), "..", "data", "pending_orders.json")

def _load_pending_orders() -> list:
    try:
        with open(PENDING_ORDERS_FILE, "r") as f:
            return json.load(f)
    except Exception:
        return []

def _save_pending_orders(orders: list):
    try:
        os.makedirs(os.path.dirname(PENDING_ORDERS_FILE), exist_ok=True)
        with open(PENDING_ORDERS_FILE, "w") as f:
            json.dump(orders, f, indent=2)
    except Exception as e:
        logger.error(f"Failed to save pending orders: {e}")

def _store_pending_order(event_id, buyer_name, buyer_email, phone, items, amount_total, stripe_session_id):
    orders = _load_pending_orders()
    orders.append({
        "id": str(uuid.uuid4()),
        "stripe_session_id": stripe_session_id,
        "event_id": event_id,
        "buyer_name": buyer_name,
        "buyer_email": buyer_email,
        "phone": phone,
        "items": items,
        "amount_total": amount_total,
        "status": "pending",
        "error": "TT billing not configured",
        "created_at": datetime.now(timezone.utc).isoformat(),
    })
    _save_pending_orders(orders)
    logger.warning(f"[Pending] Order saved for {buyer_email} — retry after TT billing setup")



# ── Stripe Connect Config ──────────────────────────────────────────────────────
# The merchant's connected account that receives funds minus the platform fee.
STRIPE_CONNECTED_ACCOUNT = os.getenv("STRIPE_CONNECTED_ACCOUNT", "")

# Percentage the PLATFORM keeps from each transaction (e.g. 10 = 10%).
# The remaining amount goes to the connected merchant account.
PLATFORM_FEE_PERCENT = float(os.getenv("PLATFORM_FEE_PERCENT", "10"))

router = APIRouter(prefix="/payments", tags=["Payments"])


# ─────────────────────────────────────────────────────────────────────────────
# Request Models
# ─────────────────────────────────────────────────────────────────────────────

class CheckoutItem(BaseModel):
    ticket_type_id: str
    quantity: int
    name: str        # Display name on Stripe checkout
    price: int       # Price in smallest currency unit (paise for INR, cents for USD)


class CreateCheckoutSessionRequest(BaseModel):
    event_id: str
    buyer_name: str
    buyer_email: str
    phone: Optional[str] = None
    items: List[CheckoutItem]
    currency: str = "usd"
    event_name: Optional[str] = ""


# ─────────────────────────────────────────────────────────────────────────────
# Helper — calculate platform application fee
# ─────────────────────────────────────────────────────────────────────────────

def calculate_application_fee(total_amount_smallest_unit: int) -> int:
    """
    Returns the platform's application_fee_amount in the smallest currency unit.
    e.g. total=10000 cents ($100), fee=10% → returns 1000 cents ($10)

    The remainder (₹90) is automatically transferred to the connected account.
    Stripe's own processing fees are deducted on top of this by Stripe itself.
    """
    fee = math.ceil(total_amount_smallest_unit * (PLATFORM_FEE_PERCENT / 100))
    return fee


# ─────────────────────────────────────────────────────────────────────────────
# POST /payments/create-checkout-session
# ─────────────────────────────────────────────────────────────────────────────

@router.post("/create-checkout-session")
def create_checkout_session(body: CreateCheckoutSessionRequest):
    """
    Creates a Stripe Checkout Session using Stripe Connect.

    Money flow:
      Customer pays total  →  Stripe deducts its own fee
      Platform keeps application_fee_amount  →  Rest goes to connected account

    Returns { url, session_id, total, platform_fee, merchant_receives }
    """
    if not stripe.api_key or "REPLACE" in stripe.api_key:
        raise HTTPException(
            status_code=500,
            detail="Stripe secret key is not configured. Add STRIPE_SECRET_KEY to .env"
        )

    if not STRIPE_CONNECTED_ACCOUNT:
        raise HTTPException(
            status_code=500,
            detail="Stripe Connect account not configured. Add STRIPE_CONNECTED_ACCOUNT to .env"
        )

    # Build Stripe line_items
    line_items = []
    for item in body.items:
        if item.quantity <= 0:
            continue
        line_items.append({
            "price_data": {
                "currency": body.currency,
                "product_data": {
                    "name": item.name,
                    "description": f"Ticket for {body.event_name}" if body.event_name else "Event Ticket",
                },
                "unit_amount": item.price,
            },
            "quantity": item.quantity,
        })

    if not line_items:
        raise HTTPException(status_code=400, detail="No valid ticket items selected.")

    total = sum(i.price * i.quantity for i in body.items if i.quantity > 0)

    # Store all order data in Stripe session metadata (string-only values)
    metadata = {
        "event_id": body.event_id,
        "buyer_name": body.buyer_name,
        "buyer_email": body.buyer_email,
        "phone": body.phone or "",
        "items": json.dumps([
            {"ticket_type_id": i.ticket_type_id, "quantity": i.quantity}
            for i in body.items if i.quantity > 0
        ]),
        "connected_account": STRIPE_CONNECTED_ACCOUNT,
    }

    try:
        # ── Free tickets — skip Stripe entirely ──────────────────────────────
        if total == 0:
            return {
                "url": f"{FRONTEND_URL}/payment/success?free=true",
                "free": True,
                "metadata": metadata,
            }

        # ── Calculate platform fee and what merchant receives ─────────────────
        application_fee = calculate_application_fee(total)
        merchant_receives = total - application_fee

        logger.info(
            f"Creating Stripe Connect session | total={total} "
            f"platform_fee={application_fee} ({PLATFORM_FEE_PERCENT}%) "
            f"merchant_receives={merchant_receives} "
            f"connected_account={STRIPE_CONNECTED_ACCOUNT}"
        )

        # ── Create Stripe Checkout Session with Connect destination charge ────
        session = stripe.checkout.Session.create(
            payment_method_types=["card"],
            line_items=line_items,
            mode="payment",
            customer_email=body.buyer_email,
            success_url=f"{FRONTEND_URL}/payment/success?session_id={{CHECKOUT_SESSION_ID}}",
            cancel_url=f"{FRONTEND_URL}/payment/cancel",
            metadata=metadata,
            billing_address_collection="auto",

            # ── Stripe Connect: destination charge ───────────────────────────
            # Stripe collects payment on behalf of the platform, then
            # transfers (total - application_fee_amount) to the connected account.
            payment_intent_data={
                "application_fee_amount": application_fee,  # Platform keeps this
                "transfer_data": {
                    "destination": STRIPE_CONNECTED_ACCOUNT,  # Merchant receives rest
                },
            },
        )

        return {
            "url": session.url,
            "session_id": session.id,
            "total": total,
            "platform_fee": application_fee,
            "merchant_receives": merchant_receives,
            "currency": body.currency,
        }

    except stripe.StripeError as e:
        logger.error(f"Stripe error creating session: {e}")
        raise HTTPException(status_code=400, detail=f"Stripe error: {str(e)}")
    except Exception as e:
        logger.error(f"Unexpected error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


# ─────────────────────────────────────────────────────────────────────────────
# POST /payments/create-free-order
# ─────────────────────────────────────────────────────────────────────────────

class FreeOrderRequest(BaseModel):
    event_id: str
    buyer_name: str
    buyer_email: str
    phone: Optional[str] = None
    items: List[CheckoutItem]


@router.post("/create-free-order")
def create_free_order(body: FreeOrderRequest):
    """
    Directly creates Ticket Tailor issued_tickets for free (₹0) orders.
    No Stripe session or Connect charge needed.
    """
    issued_tickets = []
    try:
        for item in body.items:
            if item.quantity <= 0:
                continue
            payload = {
                "event_id": body.event_id,
                "ticket_type_id": item.ticket_type_id,
                "full_name": body.buyer_name,
                "email": body.buyer_email,
                "send_email": "true",
                "reference": f"{body.buyer_name}|{body.buyer_email}",
            }
            if body.phone:
                payload["phone"] = body.phone

            for _ in range(item.quantity):
                data = post_to_tt("/issued_tickets", payload)
                issued_tickets.append(data)


        # Send confirmation email via our own SMTP service
        try:
            event_data = fetch_from_tt(f"/events/{body.event_id}")
            event_name  = event_data.get("name", "Your Event")
            start_iso   = (event_data.get("start") or {}).get("formatted", "")
            venue_obj   = event_data.get("venue") or {}
            event_venue = venue_obj.get("name", "") or ("Online Event" if event_data.get("online_event") == "true" else "TBA")
        except Exception:
            event_name, start_iso, event_venue = "Your Event", "", "TBA"

        ticket_objs = [
            {
                "id": t.get("id", ""),
                "barcode": t.get("barcode") or t.get("id", ""),
                "ticket_type_name": "Free Ticket",
            }
            for t in issued_tickets
        ]
        send_ticket_confirmation(
            buyer_email=body.buyer_email,
            buyer_name=body.buyer_name,
            event_name=event_name,
            event_date=start_iso,
            event_venue=event_venue,
            tickets=ticket_objs,
            amount_total=0,
            source="free",
        )

        return {"success": True, "issued_tickets": issued_tickets}


    except http_requests.HTTPError as e:
        logger.error(f"Ticket Tailor API error: {e}")
        raise HTTPException(
            status_code=400,
            detail=str(e)
        )
    except Exception as e:
        logger.error(f"Free order creation failed (unexpected): {e}")
        raise HTTPException(status_code=500, detail=str(e))



# ─────────────────────────────────────────────────────────────────────────────
# GET /payments/debug-test?event_id=xxx&ticket_type_id=xxx
# ─────────────────────────────────────────────────────────────────────────────

@router.get("/debug-test")
def debug_test(event_id: str = "", ticket_type_id: str = ""):
    """
    Debug endpoint — validates that the given event_id and ticket_type_id
    exist and are usable in Ticket Tailor. Helps diagnose 500 errors.
    
    Usage: GET /payments/debug-test?event_id=ev_xxx&ticket_type_id=tt_xxx
    """
    results = {}

    # Check the event exists
    if event_id:
        try:
            event_data = fetch_from_tt(f"/events/{event_id}")
            results["event"] = {
                "ok": True,
                "id": event_data.get("id"),
                "name": event_data.get("name"),
                "status": event_data.get("status"),
                "start": event_data.get("start", {}).get("iso"),
            }
        except Exception as e:
            results["event"] = {"ok": False, "error": str(e)}

    # Check the ticket type exists under this event
    if event_id and ticket_type_id:
        try:
            tickets_data = fetch_from_tt(f"/events/{event_id}/tickets")
            all_ticket_ids = [t.get("id") for t in (tickets_data.get("data") or [])]
            found = any(t == ticket_type_id for t in all_ticket_ids)
            results["ticket_type"] = {
                "ok": found,
                "ticket_type_id_checked": ticket_type_id,
                "available_ticket_ids": all_ticket_ids,
            }
        except Exception as e:
            results["ticket_type"] = {"ok": False, "error": str(e)}

    return results


# ─────────────────────────────────────────────────────────────────────────────
# POST /payments/webhook
# ─────────────────────────────────────────────────────────────────────────────

@router.post("/webhook")
async def stripe_webhook(request: Request):
    """
    Stripe sends checkout.session.completed events here after a successful payment.
    CRITICAL: reads raw bytes — do NOT use Body() or JSON parsing.
    """
    payload = await request.body()
    sig_header = request.headers.get("stripe-signature", "")

    # ── Verify Stripe signature ───────────────────────────────────────────────
    if not STRIPE_WEBHOOK_SECRET or "REPLACE" in STRIPE_WEBHOOK_SECRET:
        logger.warning("STRIPE_WEBHOOK_SECRET not set — skipping verification (unsafe!)")
        try:
            event = json.loads(payload)
        except Exception:
            raise HTTPException(status_code=400, detail="Invalid webhook payload")
    else:
        try:
            event = stripe.Webhook.construct_event(payload, sig_header, STRIPE_WEBHOOK_SECRET)
        except stripe.errors.SignatureVerificationError:
            logger.error("Stripe webhook signature verification FAILED.")
            raise HTTPException(status_code=400, detail="Invalid Stripe signature")
        except Exception as e:
            raise HTTPException(status_code=400, detail=str(e))

    # ── Handle: checkout.session.completed ───────────────────────────────────
    if event["type"] == "checkout.session.completed":
        session   = event["data"]["object"]
        metadata  = session.get("metadata", {})
        session_id = session.get("id", "")

        event_id    = metadata.get("event_id")
        buyer_name  = metadata.get("buyer_name")
        buyer_email = metadata.get("buyer_email")
        phone       = metadata.get("phone", "")
        items_json  = metadata.get("items", "[]")
        amount_total = session.get("amount_total", 0)

        logger.info(
            f"[Webhook] checkout.session.completed | "
            f"session={session_id} event={event_id} buyer={buyer_email} total={amount_total}"
        )

        try:
            items = json.loads(items_json)
        except json.JSONDecodeError:
            logger.error("Could not parse items JSON from Stripe session metadata")
            return {"received": True}

        # ── Create Ticket Tailor issued tickets ───────────────────────────────
        all_created = True
        issued_ticket_objects = []   # collect for email
        for item in items:
            ticket_type_id = item.get("ticket_type_id")
            quantity       = item.get("quantity", 1)
            item_name      = item.get("name", "Ticket")

            payload_tt = {
                "event_id": event_id,
                "ticket_type_id": ticket_type_id,
                "full_name": buyer_name,
                "email": buyer_email,
                "send_email": "true",
                "reference": f"{buyer_name}|{buyer_email}",
            }
            if phone:
                payload_tt["phone"] = phone

            for _ in range(quantity):
                try:
                    result = post_to_tt("/issued_tickets", payload_tt)
                    logger.info(f"[Webhook] ✅ Issued ticket: {result.get('id','?')} → {buyer_email}")
                    issued_ticket_objects.append({
                        "id": result.get("id", ""),
                        "barcode": result.get("barcode") or result.get("id", ""),
                        "ticket_type_name": item_name,
                    })
                except Exception as e:
                    all_created = False
                    logger.error(f"[Webhook] ❌ Failed to create ticket {ticket_type_id}: {e}")

        # ── Send confirmation email if all tickets were created ─────────────
        if all_created:
            # ── Send confirmation email via our own SMTP service ──────────────
            try:
                event_data = fetch_from_tt(f"/events/{event_id}")
                event_name  = event_data.get("name", "Your Event")
                start_iso   = (event_data.get("start") or {}).get("formatted", "")
                venue_obj   = event_data.get("venue") or {}
                event_venue = venue_obj.get("name", "") or ("Online Event" if event_data.get("online_event") == "true" else "TBA")
            except Exception:
                event_name  = metadata.get("event_name", "Your Event")
                start_iso   = ""
                event_venue = ""

            send_ticket_confirmation(
                buyer_email=buyer_email,
                buyer_name=buyer_name,
                event_name=event_name,
                event_date=start_iso,
                event_venue=event_venue,
                tickets=issued_ticket_objects,
                amount_total=amount_total,
                source="stripe",
            )

        # ── If TT creation failed, save order locally so admin can retry ──────
        if not all_created:
            _store_pending_order(
                event_id=event_id,
                buyer_name=buyer_name,
                buyer_email=buyer_email,
                phone=phone,
                items=items,
                amount_total=amount_total,
                stripe_session_id=session_id,
            )
            logger.warning(
                f"[Webhook] Order saved to pending_orders.json — "
                "set up TT billing then use /payments/pending-orders to retry."
            )

    # Always return 200 to Stripe
    return {"received": True}


# ─────────────────────────────────────────────────────────────────────────────
# GET /payments/pending-orders  — Admin: view orders that failed TT creation
# POST /payments/pending-orders/{order_id}/retry — Admin: retry TT creation
# ─────────────────────────────────────────────────────────────────────────────

@router.get("/pending-orders")
def get_pending_orders():
    """Returns all locally-stored pending orders (Stripe paid but TT ticket not yet created)."""
    orders = _load_pending_orders()
    return {"data": orders, "count": len(orders)}


@router.post("/pending-orders/{order_id}/retry")
def retry_pending_order(order_id: str):
    """Retries creating the TT issued_ticket for a pending order."""
    orders = _load_pending_orders()
    order = next((o for o in orders if o["id"] == order_id), None)
    if not order:
        raise HTTPException(status_code=404, detail="Pending order not found")

    issued = []
    errors = []
    for item in order.get("items", []):
        ticket_type_id = item.get("ticket_type_id")
        quantity = item.get("quantity", 1)
        payload_tt = {
            "event_id": order["event_id"],
            "ticket_type_id": ticket_type_id,
            "full_name": order["buyer_name"],
            "email": order["buyer_email"],
        }
        if order.get("phone"):
            payload_tt["phone"] = order["phone"]

        for _ in range(quantity):
            try:
                result = post_to_tt("/issued_tickets", payload_tt)
                issued.append(result.get("id", "?"))
            except Exception as e:
                errors.append(str(e))

    if not errors:
        # Remove from pending list on full success
        orders = [o for o in orders if o["id"] != order_id]
        _save_pending_orders(orders)
        return {"success": True, "issued_ticket_ids": issued}
    else:
        # Update error message in place
        for o in orders:
            if o["id"] == order_id:
                o["error"] = " | ".join(errors)
        _save_pending_orders(orders)
        raise HTTPException(status_code=400, detail=" | ".join(errors))
