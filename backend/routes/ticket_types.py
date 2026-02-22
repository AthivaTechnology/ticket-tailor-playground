from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import Optional
from services.ticket_tailor import fetch_from_tt, post_to_tt, delete_from_tt

router = APIRouter(prefix="/ticket_types", tags=["Ticket Types"])

class TicketTypeCreate(BaseModel):
    name: str
    price: float
    quantity: int
    max_per_order: int
    event_id: str
    group_id: Optional[str] = None

@router.get("/")
def list_ticket_types(event_id: str = None):
    try:
        if event_id:
            event = fetch_from_tt(f"/events/{event_id}")
            return {"data": event.get("ticket_types", [])}
        else:
            events = fetch_from_tt("/events")
            all_tickets = []
            for ev in events.get("data", []):
                for tt in ev.get("ticket_types", []):
                    # Check if ticket is explicitly bound to specific occurrences
                    if "event_ids" in tt and tt["event_ids"]:
                        if ev.get("id") in tt["event_ids"]:
                             # Duplicate tt to avoid reference mutation issues
                             tt_copy = dict(tt)
                             tt_copy["event_id"] = ev.get("id")
                             tt_copy["group_id"] = tt.get("group_id") # Expose Group ID for UI
                             all_tickets.append(tt_copy)
                    else:
                        tt_copy = dict(tt)
                        tt_copy["event_id"] = ev.get("id")
                        tt_copy["group_id"] = tt.get("group_id") # Expose Group ID for UI
                        all_tickets.append(tt_copy)
            
            # Deduplicate by ID to prevent tickets appearing multiple times if unbound
            seen_ids = set()
            unique_tickets = []
            for tt in all_tickets:
               if tt["id"] not in seen_ids:
                   seen_ids.add(tt["id"])
                   unique_tickets.append(tt)
            
            return {"data": unique_tickets}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/")
def create_ticket_type(tt: TicketTypeCreate):
    try:
        # 1. Fetch the event to get the Event Series ID
        event = fetch_from_tt(f"/events/{tt.event_id}")
        series_id = event.get("event_series_id")
        
        if not series_id:
            raise Exception("Cannot create ticket type: Event does not belong to a Series")

        # 2. Add to event series, but restrict to the specific event occurrence
        # TT expects price in integer cents (e.g. 10.00 -> 1000)
        payload = {
            "name": tt.name,
            "price": int(tt.price * 100),
            "quantity": tt.quantity,
            "max_per_order": tt.max_per_order,
            "event_ids": tt.event_id # Restricts ticket to this specific occurrence, averting bleed to other batches
        }
        
        if tt.group_id:
            try:
                # Ticket Tailor explicitly requires groupId as an integer without the 'tg_' prefix
                cleaned_id = tt.group_id.replace('tg_', '')
                payload["groupId"] = int(cleaned_id)
            except ValueError:
                pass # Fallback to unbound if parsing fails

        data = post_to_tt(f"/event_series/{series_id}/ticket_types", payload)
        return data
    except Exception as e:
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))

@router.delete("/{ticket_id}")
def delete_ticket_type(ticket_id: str, event_id: str):
    try:
        # 1. Fetch the event to resolve the Series ID
        event = fetch_from_tt(f"/events/{event_id}")
        series_id = event.get("event_series_id")
        
        if not series_id:
             raise Exception("Cannot resolve event series binding for deletion.")
             
        # 2. Issue the delete command against the master series
        data = delete_from_tt(f"/event_series/{series_id}/ticket_types/{ticket_id}")
        return data
    except Exception as e:
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))
