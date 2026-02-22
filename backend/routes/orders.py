from fastapi import APIRouter, HTTPException
from services.ticket_tailor import fetch_from_tt, post_to_tt
from pydantic import BaseModel

router = APIRouter(prefix="/orders", tags=["Orders"])

class OrderCreate(BaseModel):
    event_id: str
    ticket_type_id: str
    buyer_email: str
    buyer_name: str
    quantity: int = 1
    # Other payload for checkout

@router.get("/")
def list_orders():
    try:
        return fetch_from_tt("/orders")
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/")
def create_order(order: OrderCreate):
    try:
        # Ticket Tailor doesn't allow POST /orders directly.
        # It allows POST /issued_tickets to generate an order/ticket.
        issued_tickets = []
        payload = {
            "event_id": order.event_id,
            "ticket_type_id": order.ticket_type_id,
            "full_name": order.buyer_name,
            "email": order.buyer_email,
            # we could also pass custom_questions or notes if we had discount codes
        }
        
        for _ in range(order.quantity):
            data = post_to_tt("/issued_tickets", payload)
            issued_tickets.append(data)
            
        return {"data": issued_tickets}
    except Exception as e:
        import requests
        if isinstance(e, requests.HTTPError) and e.response is not None:
             raise HTTPException(status_code=400, detail=f"Ticket Tailor API Error: {e.response.json().get('message', str(e))}")
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/{order_id}")
def get_order(order_id: str):
    try:
        return fetch_from_tt(f"/orders/{order_id}")
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
