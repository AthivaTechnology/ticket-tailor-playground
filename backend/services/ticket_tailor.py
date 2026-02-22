import os
import requests
from dotenv import load_dotenv

load_dotenv()

TICKET_TAILOR_API_KEY = os.getenv("TICKET_TAILOR_API_KEY", "")
BASE_URL = os.getenv("TICKET_TAILOR_BASE_URL", "https://api.tickettailor.com/v1")

def get_headers():
    return {
        "Accept": "application/json",
        "Content-Type": "application/json"
    }

def get_auth():
    return (TICKET_TAILOR_API_KEY, "")

def fetch_from_tt(endpoint: str, params: dict = None):
    url = f"{BASE_URL}{endpoint}"
    response = requests.get(url, headers=get_headers(), auth=get_auth(), params=params)
    response.raise_for_status()
    return response.json()

def post_to_tt(endpoint: str, data: dict):
    url = f"{BASE_URL}{endpoint}"
    # Ticket Tailor uses form data for POST requests usually, but let's check their docs or just send json
    # Many TT endpoints accept form-urlencoded. Let's send as json first, then fallback to data if needed.
    # Actually, TT standard API uses form-urlencoded for POST.
    headers = {"Accept": "application/json"}
    response = requests.post(url, headers=headers, auth=get_auth(), data=data)
    response.raise_for_status()
    return response.json()

def put_to_tt(endpoint: str, data: dict):
    url = f"{BASE_URL}{endpoint}"
    headers = {"Accept": "application/json"}
    response = requests.post(url, headers=headers, auth=get_auth(), data=data) # TT Docs assert Updates are often POST to the entity URL rather than actual PUT
    response.raise_for_status()
    return response.json()

def delete_from_tt(endpoint: str):
    url = f"{BASE_URL}{endpoint}"
    headers = {"Accept": "application/json"}
    response = requests.delete(url, headers=headers, auth=get_auth())
    response.raise_for_status()
    return response.json()
