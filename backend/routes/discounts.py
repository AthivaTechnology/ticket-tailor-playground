import os
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import Optional
from services.ticket_tailor import fetch_from_tt, post_to_tt, delete_from_tt, put_to_tt

router = APIRouter(prefix="/discounts", tags=["Discounts"])

class DiscountCreate(BaseModel):
    code: str
    percentage: float
    ticket_type_ids: Optional[list[str]] = []

class DiscountUpdate(BaseModel):
    code: Optional[str] = None
    percentage: Optional[float] = None

@router.get("/")
def list_discounts():
    try:
        return fetch_from_tt("/discounts")
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/")
def create_discount(discount: DiscountCreate):
    try:
        payload = {
            "name": discount.code,
            "code": discount.code,
            "type": "percentage",
            "price_percent": int(discount.percentage)
        }
        
        # Ticket Tailor natively handles form arrays if key ends with []
        # UPDATE: For discounts, it actually expects a comma-separated string of IDs
        if discount.ticket_type_ids:
            payload["ticket_type_ids"] = ",".join(discount.ticket_type_ids)
            
        data = post_to_tt("/discounts", payload)
        return data
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.put("/{discount_id}")
def update_discount(discount_id: str, discount: DiscountUpdate):
    """
    Ticket Tailor does NOT support updating discounts in place.
    Strategy: fetch the old discount, delete it, recreate with new values.
    """
    try:
        # 1. Fetch the existing discount to preserve ticket_type_ids
        old = fetch_from_tt(f"/discounts/{discount_id}")

        # 2. Delete old discount
        delete_from_tt(f"/discounts/{discount_id}")

        # 3. Rebuild payload with updated fields
        new_code = discount.code or old.get("code", "")
        new_pct = discount.percentage if discount.percentage is not None else old.get("face_value_percentage", 0)

        payload = {
            "name": new_code,
            "code": new_code,
            "type": "percentage",
            "price_percent": int(new_pct),
        }

        # Re-attach ticket types if the old one had them
        existing_tt_ids = [t["id"] for t in (old.get("ticket_types") or []) if isinstance(t, dict)]
        if existing_tt_ids:
            payload["ticket_type_ids"] = ",".join(existing_tt_ids)

        data = post_to_tt("/discounts", payload)
        return data
    except Exception as e:
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))


@router.delete("/{discount_id}")
def delete_discount(discount_id: str):
    try:
        data = delete_from_tt(f"/discounts/{discount_id}")
        return data
    except Exception as e:
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))

