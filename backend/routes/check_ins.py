from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from services.ticket_tailor import fetch_from_tt, post_to_tt

router = APIRouter(prefix="/check_ins", tags=["Check-ins"])

class CheckInCreate(BaseModel):
    ticket_id: str

@router.get("/{ticket_id}")
def get_ticket_status(ticket_id: str):
    try:
        # 1. Fetch the ticket
        if ticket_id.startswith("it_"):
            ticket_data = fetch_from_tt(f"/issued_tickets/{ticket_id}")
        else:
            response = fetch_from_tt(f"/issued_tickets?barcode={ticket_id}")
            results = response.get("data", [])
            if not results:
                raise HTTPException(status_code=404, detail="Barcode not found.")
            ticket_data = results[0]

        # 2. Fetch the parent order to get the actual Buyer Name and Email
        # (Ticket Tailor masks attendee info with **** if not explicitly collected per ticket)
        order_id = ticket_data.get("order_id")
        buyer_name = None
        buyer_email = None
        
        if order_id:
            try:
                order_data = fetch_from_tt(f"/orders/{order_id}")
                buyer_name = order_data.get("buyer_name")
                buyer_email = order_data.get("buyer_email")
            except Exception as e:
                print(f"Warning: Failed to fetch parent order {order_id} for details", e)

        # Inject the real buyer details so the scanner UI can display them
        current_name = ticket_data.get("full_name")
        if not current_name or current_name == "****":
            ticket_data["full_name"] = buyer_name if buyer_name else "Guest Attendee"
            
        current_email = ticket_data.get("email")
        if not current_email or current_email == "****":
            ticket_data["email"] = buyer_email if buyer_email else "No Email Provided"

        return ticket_data
    except HTTPException:
        raise
    except Exception as e:
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=404, detail="Ticket not found or invalid.")

@router.post("/")
def check_in_attendee(check_in: CheckInCreate):
    try:
        # Ticket Tailor uses POST /check_ins with form data
        end_point = "/check_ins"
        payload = {
            "issued_ticket_id": check_in.ticket_id,
            "quantity": 1
        }
        data = post_to_tt(end_point, payload)
        return {"success": True, "data": data}
    except Exception as e:
        error_msg = str(e)
        if "Ticket is already checked in" in error_msg or "already" in error_msg.lower():
            raise HTTPException(status_code=400, detail="Ticket is already checked in.")
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=error_msg)
