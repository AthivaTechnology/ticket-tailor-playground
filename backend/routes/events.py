from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import Optional
from services.ticket_tailor import fetch_from_tt, post_to_tt

router = APIRouter(prefix="/events", tags=["Events"])

class EventCreate(BaseModel):
    name: str
    description: Optional[str] = ""
    venue_name: Optional[str] = ""
    venue_postcode: Optional[str] = ""
    venue_country: Optional[str] = ""
    start: str  # ISO string from frontend
    end: str    # ISO string from frontend
    online_event: Optional[bool] = False
    private: Optional[bool] = False
    event_series_id: Optional[str] = None

@router.get("/")
def list_events():
    try:
        return fetch_from_tt("/events")
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/")
def create_event(event: EventCreate):
    try:
        from datetime import datetime
        start_dt = datetime.fromisoformat(event.start.replace('Z', '+00:00'))
        end_dt = datetime.fromisoformat(event.end.replace('Z', '+00:00'))

        series_id = event.event_series_id

        # 1. Create Event Series if not provided
        if not series_id:
            series_payload = {
                "name": event.name,
                "description": event.description,
                "online_event": "true" if event.online_event else "false",
                "private": "true" if event.private else "false"
            }
            if not event.online_event:
                if event.venue_name:
                    series_payload["venue_name"] = event.venue_name
                if event.venue_postcode:
                    series_payload["venue_postcode"] = event.venue_postcode
                if event.venue_country:
                    series_payload["venue_country"] = event.venue_country
            else:
                # Store zoom/meet link as venue_name as workaround
                if event.venue_name:
                    series_payload["venue_name"] = event.venue_name

            series_data = post_to_tt("/event_series", series_payload)
            series_id = series_data.get("id")

        if not series_id:
            raise Exception("Failed to identify or create event series")

        # 2. Create Event Occurrence within the Series
        occurrence_payload = {
            "start_date": start_dt.strftime("%Y-%m-%d"),
            "start_time": start_dt.strftime("%H:%M:%S"),
            "end_date": end_dt.strftime("%Y-%m-%d"),
            "end_time": end_dt.strftime("%H:%M:%S")
        }
        
        event_data = post_to_tt(f"/event_series/{series_id}/events", occurrence_payload)
        return event_data

    except Exception as e:
        import traceback
        traceback.print_exc()
        import requests
        if isinstance(e, requests.exceptions.HTTPError):
            raise HTTPException(status_code=400, detail=e.response.text)
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/{event_id}")
def get_event(event_id: str):
    try:
        return fetch_from_tt(f"/events/{event_id}")
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/{event_id}/tickets")
def get_event_tickets(event_id: str):
    try:
        event = fetch_from_tt(f"/events/{event_id}")
        
        # 1. Attempt to resolve explicitly bound tickets first
        tickets = event.get("ticket_types", [])
        
        # 2. If the active batch has no explicit overrides, inherit the Master Series inventory
        if not tickets:
            series_id = event.get("event_series_id")
            if series_id:
                series = fetch_from_tt(f"/event_series/{series_id}")
                tickets = series.get("default_ticket_types", [])

        # Filter strictly out tickets explicitly assigned to OTHER specific events (preventing cross-contamination)
        filtered_tickets = []
        for t in tickets:
             if t.get("event_ids"):
                 if event_id in t.get("event_ids"):
                     filtered_tickets.append(t)
             else:
                 filtered_tickets.append(t)

        return {"data": filtered_tickets, "groups": series.get("default_ticket_groups", []) if 'series' in locals() else []}
    except Exception as e:
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))

@router.put("/{event_id}")
def update_event(event_id: str, event: EventCreate):
    try:
        from datetime import datetime
        # 1. Fetch the event to get its linked Event Series
        event_data = fetch_from_tt(f"/events/{event_id}")
        series_id = event_data.get("event_series_id")
        
        if not series_id:
            raise Exception("Cannot update event: No Event Series linked.")

        # 2. Update the Event Series (handles Name/Description)
        series_payload = {
            "name": event.name,
            "description": event.description
        }
        from services.ticket_tailor import put_to_tt
        put_to_tt(f"/event_series/{series_id}", series_payload)

        # Note: Ticket Tailor API docs don't directly mention updating occurrences. 
        # In a real scenario, you would update the occurrence using its specific endpoints or just rely on the Series.
        # For our usecase, changing the series name/description is sufficient as a starting point.
        
        return {"status": "success", "message": "Event Series updated successfully"}
    except Exception as e:
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))

@router.delete("/{event_id}")
def delete_event(event_id: str):
    try:
        # 1. Fetch the event to get its linked Event Series
        event_data = fetch_from_tt(f"/events/{event_id}")
        series_id = event_data.get("event_series_id")
        
        if not series_id:
            raise Exception("Cannot delete event: No Event Series linked.")

        # 2. Delete the entire Event Series (which deletes the event occurrence)
        from services.ticket_tailor import delete_from_tt
        response = delete_from_tt(f"/event_series/{series_id}")
        return response
    except Exception as e:
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))
