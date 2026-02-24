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

@router.get("/public")
def list_public_events():
    """
    Returns a flat list of upcoming event occurrences enriched with their
    parent Event Series data (name, description, images, venue, tickets).

    This is the primary endpoint for the user-facing events page.
    It merges: Event Series master data + individual event occurrences.
    """
    try:
        # 1. Fetch all event series
        series_resp = fetch_from_tt("/event_series")
        all_series = series_resp.get("data", [])

        # 2. Fetch all event occurrences
        events_resp = fetch_from_tt("/events")
        all_events = events_resp.get("data", [])

        # 3. Build a lookup map: series_id -> series data
        series_map = {s["id"]: s for s in all_series}

        # 4. Enrich each occurrence with its parent series data
        enriched = []
        for event in all_events:
            series_id = event.get("event_series_id")
            series = series_map.get(series_id, {})

            # Only include published series
            if series.get("status") not in ("published",):
                continue

            enriched.append({
                # Core occurrence fields
                "id": event.get("id"),
                "event_series_id": series_id,
                "start": event.get("start"),
                "end": event.get("end"),
                "status": event.get("status", series.get("status", "unknown")),
                # Inherited from series
                "name": series.get("name", event.get("name", "Untitled Event")),
                "description": series.get("description", ""),
                "images": series.get("images", {}),
                "venue": series.get("venue", {}),
                "online_event": series.get("online_event", "false"),
                "checkout_url": event.get("checkout_url") or series.get("checkout_url", ""),
                "ticket_types": event.get("ticket_types") or series.get("default_ticket_types", []),
            })

        # Sort by start date ascending
        enriched.sort(key=lambda e: (e.get("start") or {}).get("iso", ""))

        return {"data": enriched}

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


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
                    series_payload["venue"] = event.venue_name
                if event.venue_postcode:
                    series_payload["postal_code"] = event.venue_postcode
                if event.venue_country:
                    series_payload["country"] = event.venue_country.strip().upper()[:2]
            else:
                # Store zoom/meet link as venue_name as workaround
                if event.venue_name:
                    series_payload["venue"] = event.venue_name

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
