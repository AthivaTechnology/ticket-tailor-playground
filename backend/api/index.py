import sys
import os

sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from dotenv import load_dotenv
from routes import event_series, events, ticket_types, discounts, orders, check_ins, payments

load_dotenv()

app = FastAPI(title="Ticket Tailor Event Management API")

origins = os.getenv("CORS_ORIGINS", "*").split(",")

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(event_series.router)
app.include_router(events.router)
app.include_router(ticket_types.router)
app.include_router(discounts.router)
app.include_router(orders.router)
app.include_router(check_ins.router)
app.include_router(payments.router)

@app.get("/")
def read_root():
    return {"message": "Welcome to Ticket Tailor EMS Backend"}
