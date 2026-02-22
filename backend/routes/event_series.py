from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import Optional
from services.ticket_tailor import fetch_from_tt, post_to_tt, put_to_tt, delete_from_tt

router = APIRouter(prefix="/event_series", tags=["Event Series"])

class EventSeriesCreate(BaseModel):
    name: str

class TicketGroupCreate(BaseModel):
    name: str

class BundleCreate(BaseModel):
    name: str
    price: float
    description: Optional[str] = None
    ticket_types: dict[str, int]  # Mapping of ticket_type_id to quantity

@router.get("/")
def list_event_series():
    try:
        data = fetch_from_tt("/event_series")
        return data
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/{series_id}")
def get_event_series(series_id: str):
    try:
        data = fetch_from_tt(f"/event_series/{series_id}")
        return data
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/")
def create_event_series(series: EventSeriesCreate):
    try:
        # Ticket Tailor's actual create endpoint might differ, but we build the abstraction
        data = post_to_tt("/event_series", {"name": series.name})
        return data
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.put("/{series_id}")
def update_event_series(series_id: str, series: EventSeriesCreate):
    try:
        data = put_to_tt(f"/event_series/{series_id}", {"name": series.name})
        return data
    except Exception as e:
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/{series_id}/ticket_groups")
def create_ticket_group(series_id: str, group: TicketGroupCreate):
    try:
        data = post_to_tt(f"/event_series/{series_id}/ticket_groups", {"name": group.name})
        return data
    except Exception as e:
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))

@router.delete("/{series_id}/ticket_groups/{group_id}")
def delete_ticket_group(series_id: str, group_id: str):
    try:
        data = delete_from_tt(f"/event_series/{series_id}/ticket_groups/{group_id}")
        return data
    except Exception as e:
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/{series_id}/publish")
def publish_event_series(series_id: str):
    try:
        data = post_to_tt(f"/event_series/{series_id}/status", {"status": "published"})
        return data
    except Exception as e:
        import traceback
        import requests
        traceback.print_exc()
        if isinstance(e, requests.HTTPError) and e.response is not None:
            err_data = e.response.json()
            if err_data.get("error_code") == "VALIDATION_ERROR" and "what it was before" in err_data.get("message", ""):
                # It's already published, just return success
                return {"status": "already_published"}
            raise HTTPException(status_code=400, detail=f"Ticket Tailor API Error: {err_data.get('message', str(e))}")
            
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/{series_id}/unpublish")
def unpublish_event_series(series_id: str):
    try:
        data = post_to_tt(f"/event_series/{series_id}/status", {"status": "draft"})
        return data
    except Exception as e:
        import traceback
        import requests
        traceback.print_exc()
        if isinstance(e, requests.HTTPError) and e.response is not None:
            err_data = e.response.json()
            if err_data.get("error_code") == "VALIDATION_ERROR" and "what it was before" in err_data.get("message", ""):
                # It's already draft, just return success
                return {"status": "already_draft"}
            raise HTTPException(status_code=400, detail=f"Ticket Tailor API Error: {err_data.get('message', str(e))}")
            
        raise HTTPException(status_code=500, detail=str(e))

@router.delete("/{series_id}")
def delete_event_series(series_id: str):
    try:
        data = delete_from_tt(f"/event_series/{series_id}")
        return data
    except Exception as e:
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/{series_id}/bundles")
def list_bundles(series_id: str):
    try:
        return fetch_from_tt(f"/event_series/{series_id}/bundles")
    except Exception as e:
        import requests as req
        if isinstance(e, req.HTTPError) and e.response.status_code == 404:
            return {"data": []}
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/{series_id}/bundles/availability")
def list_bundles_with_availability(series_id: str):
    """
    Returns all bundles for the series, enriched with live availability
    calculated from included ticket inventory.
    
    For each bundle:
      - is_available: True if all included tickets have sufficient queantity
      - max_quantity: min(floor(ticket.quantity / required_qty)) across all included tickets
    """
    try:
        import math

        # 1. Fetch all bundles for this series (embedded in the series object)
        try:
            series_obj = fetch_from_tt(f"/event_series/{series_id}")
            bundles = series_obj.get("bundles", [])
        except Exception:
            return {"data": []}

        if not bundles:
            return {"data": []}

        # 2. Build a map of ticket_type_id -> available quantity from this series' events
        tt_inventory: dict[str, int] = {}
        try:
            events_resp = fetch_from_tt(f"/event_series/{series_id}/events")
            for event in events_resp.get("data", []):
                for tt in event.get("ticket_types", []):
                    tid = tt["id"]
                    # "quantity" field in TT = current remaining stock
                    qty_remaining = tt.get("quantity", 0)
                    # Aggregate across all occurrences (cumulate available stock)
                    tt_inventory[tid] = tt_inventory.get(tid, 0) + qty_remaining
        except Exception:
            pass  # fall back to marking all as unknown availability

        # Also check series-level default ticket types
        try:
            series_resp = fetch_from_tt(f"/event_series/{series_id}")
            for tt in series_resp.get("default_ticket_types", []):
                tid = tt["id"]
                if tid not in tt_inventory:
                    tt_inventory[tid] = tt.get("quantity", 0)
        except Exception:
            pass

        # 3. Enrich each bundle with availability computations
        enriched = []
        for bundle in bundles:
            included_tickets = bundle.get("ticket_types", [])  # [{id, quantity}]

            min_purchasable = None
            all_available = True

            for included in included_tickets:
                tid = included["id"]
                required_qty = included.get("quantity", 1)

                stock = tt_inventory.get(tid)

                if stock is None:
                    # We don't have inventory data for this ticket — be conservative
                    all_available = False
                    purchasable_for_this = 0
                else:
                    if required_qty > 0:
                        purchasable_for_this = math.floor(stock / required_qty)
                    else:
                        purchasable_for_this = 0

                    if purchasable_for_this == 0:
                        all_available = False

                if min_purchasable is None:
                    min_purchasable = purchasable_for_this
                else:
                    min_purchasable = min(min_purchasable, purchasable_for_this)

            if not included_tickets:
                # A bundle with no tickets configured is treated as unavailable
                all_available = False
                min_purchasable = 0

            enriched.append({
                **bundle,
                "is_available": all_available,
                "max_quantity": min_purchasable if min_purchasable is not None else 0,
                "ticket_inventory": {
                    inc["id"]: tt_inventory.get(inc["id"]) for inc in included_tickets
                }
            })

        return {"data": enriched}

    except Exception as e:
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/{series_id}/bundles")
def create_bundle(series_id: str, bundle: BundleCreate):
    try:
        payload = {
            "name": bundle.name,
            "price": int(bundle.price),  # TT expects integer cents
            "description": bundle.description or "No description provided.",  # TT strictly rejects empty and whitespace-only strings
        }
            
        for tid, qty in bundle.ticket_types.items():
            payload[f"ticket_type_ids[{tid}]"] = qty
            
        data = post_to_tt(f"/event_series/{series_id}/bundles", payload)
        return data
    except Exception as e:
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))

@router.delete("/{series_id}/bundles/{bundle_id}")
def delete_bundle(series_id: str, bundle_id: str):
    try:
        data = delete_from_tt(f"/event_series/{series_id}/bundles/{bundle_id}")
        return data
    except Exception as e:
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))
