import logging
from fastapi import APIRouter, HTTPException
from services.ticket_tailor import fetch_from_tt, post_to_tt
from pydantic import BaseModel
from typing import List, Optional
from collections import defaultdict

router = APIRouter(prefix="/orders", tags=["Orders"])
logger = logging.getLogger(__name__)


class OrderItem(BaseModel):
    ticket_type_id: str
    quantity: int = 1


class OrderCreate(BaseModel):
    event_id: str
    buyer_email: str
    buyer_name: str
    phone: Optional[str] = None
    items: List[OrderItem]


def _fetch_all_issued_tickets() -> list:
    """Fetch ALL issued tickets from Ticket Tailor, handling pagination."""
    all_tickets = []
    params = {"limit": 100}

    while True:
        data = fetch_from_tt("/issued_tickets", params=params)
        tickets = data.get("data") or []
        all_tickets.extend(tickets)

        # Check for more pages
        links = data.get("links") or {}
        next_url = links.get("next")
        if not next_url or len(tickets) == 0:
            break

        # Use the last ticket ID as starting_after for next page
        last_id = tickets[-1].get("id")
        if last_id:
            params["starting_after"] = last_id
        else:
            break

    return all_tickets


@router.get("/")
def list_orders():
    """
    Returns all orders from Ticket Tailor's /issued_tickets API,
    grouped by (email + event_id) to reconstruct orders.
    """
    try:
        tickets = _fetch_all_issued_tickets()

        # Fetch events and series to map event_id to event_name
        events_resp = fetch_from_tt("/events")
        all_events = events_resp.get("data", [])
        
        series_resp = fetch_from_tt("/event_series")
        all_series = {s["id"]: s for s in series_resp.get("data", [])}
        
        event_map = {}
        for e in all_events:
            series = all_series.get(e.get("event_series_id"), {})
            # Prefer series name, fallback to event name, then default
            event_map[e["id"]] = series.get("name") or e.get("name") or "Unknown Event"

        # Group tickets by email + event_id to form "orders"
        order_groups = defaultdict(list)
        for t in tickets:
            email = t.get("email") or "unknown"
            event_id = t.get("event_id") or "unknown"
            key = f"{email}|{event_id}"
            order_groups[key].append(t)

        transformed = []
        for key, group_tickets in order_groups.items():
            email_key, event_id = key.split("|", 1)
            first = group_tickets[0]

            
            # If TT masks PII as ****, try to extract from our custom reference field
            # Format: "Name|Email"
            buyer_name = first.get("full_name") or "Guest"
            buyer_email = email_key

            # Check if we need to unmask
            if "****" in buyer_name or "****" in buyer_email:
                for t in group_tickets:
                    ref = t.get("reference")
                    if ref and "|" in ref:
                        try:
                            ref_name, ref_email = ref.split("|", 1)
                            if ref_name and "****" in buyer_name:
                                buyer_name = ref_name
                            if ref_email and "****" in buyer_email:
                                buyer_email = ref_email
                            break # Found it
                        except Exception:
                            pass

            # Calculate total price from listed_price of each ticket
            total = 0
            for t in group_tickets:
                price = t.get("listed_price")
                if price and isinstance(price, (int, float)):
                    total += int(price)

            # Use the earliest created_at as the order date
            created_timestamps = [t.get("created_at", 0) for t in group_tickets]
            earliest_ts = min(created_timestamps) if created_timestamps else 0

            # Build issued_tickets array in the format the frontend expects
            issued_tickets = []
            for t in group_tickets:
                t_name = t.get("full_name") or "Guest"
                t_email = t.get("email") or ""
                # Unmask individual ticket info too if possible
                ref = t.get("reference")
                if ("****" in t_name or "****" in t_email) and ref and "|" in ref:
                    try:
                        rn, re = ref.split("|", 1)
                        if "****" in t_name: t_name = rn
                        if "****" in t_email: t_email = re
                    except: pass

                issued_tickets.append({
                    "id": t.get("id", ""),
                    "description": t.get("description", "Ticket"),
                    "barcode": t.get("barcode") or t.get("id", ""),
                    "checked_in": t.get("checked_in", "false"),
                    "status": t.get("status", "valid"),
                    "full_name": t_name,
                    "email": t_email,
                    "ticket_type_id": t.get("ticket_type_id", ""),
                })

            # Determine source (free vs paid)
            source = "free" if total == 0 else "stripe"

            transformed.append({
                "id": f"{event_id}_{buyer_email}",  # Composite ID
                "buyer_name": buyer_name,
                "buyer_email": buyer_email,
                "phone": "",
                "event_id": event_id,
                "event_name": event_map.get(event_id, "Unknown Event"),
                "total": total,
                "source": source,
                "status": "confirmed",
                "created_at": earliest_ts,
                "stripe_session_id": "",
                "issued_tickets": issued_tickets,
                "items": [],
            })

        # Sort newest first
        transformed.sort(key=lambda o: o.get("created_at", 0), reverse=True)

        return {"data": transformed}

    except Exception as e:
        import traceback
        traceback.print_exc()
        logger.error(f"Failed to fetch orders from TT: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/")
def create_order(order: OrderCreate):
    """Creates issued tickets directly via TT API and requests email confirmation."""
    try:
        issued_tickets = []
        for item in order.items:
            payload = {
                "event_id": order.event_id,
                "ticket_type_id": item.ticket_type_id,
                "full_name": order.buyer_name,
                "email": order.buyer_email,
                "send_email": "true",
            }
            if order.phone:
                payload["phone"] = order.phone

            for _ in range(item.quantity):
                data = post_to_tt("/issued_tickets", payload)
                issued_tickets.append(data)

        return {"data": issued_tickets}
    except Exception as e:
        import requests
        if isinstance(e, requests.HTTPError) and e.response is not None:
            raise HTTPException(
                status_code=400,
                detail=f"Ticket Tailor API Error: {e.response.json().get('message', str(e))}"
            )
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/{order_id}")
def get_order(order_id: str):
    try:
        return fetch_from_tt(f"/issued_tickets/{order_id}")
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
