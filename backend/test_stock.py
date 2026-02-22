import os, requests
from dotenv import load_dotenv

load_dotenv('e:/Ticket-Tailor/backend/.env')
BASE_URL = 'https://api.tickettailor.com/v1'
AUTH = (os.getenv('TICKET_TAILOR_API_KEY', ''), '')
sid = 'es_2082962'

res = requests.get(f'{BASE_URL}/event_series/{sid}', auth=AUTH).json()
for tt in res.get('default_ticket_types', []):
    print(f"Ticket {tt['id']} ({tt['name']}) - Stock: {tt.get('quantity')}, Max/Order: {tt.get('max_per_order')}")

for b in res.get('bundles', []):
    print(f"Bundle {b['id']} ({b['name']}) - Status: {b['status']}")
    for tt in b.get('ticket_types', []):
        print(f"  - Includes {tt['quantity']} of {tt['id']}")
