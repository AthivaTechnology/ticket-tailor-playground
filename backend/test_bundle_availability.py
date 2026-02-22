import os, requests, math
from dotenv import load_dotenv

load_dotenv('e:/Ticket-Tailor/backend/.env')
BASE_URL = 'https://api.tickettailor.com/v1'
AUTH = (os.getenv('TICKET_TAILOR_API_KEY', ''), '')

res = requests.get(f'{BASE_URL}/event_series', auth=AUTH)
sid = res.json()['data'][0]['id']
print('Series:', sid)

bundles_resp = requests.get(f'{BASE_URL}/event_series/{sid}/bundles', auth=AUTH)
bundles = bundles_resp.json().get('data', [])
print(f'Found {len(bundles)} bundles')

# Build inventory map
tt_inventory = {}
events_resp = requests.get(f'{BASE_URL}/event_series/{sid}/events', auth=AUTH).json()
for event in events_resp.get('data', []):
    for tt in event.get('ticket_types', []):
        tid = tt['id']
        qty = tt.get('quantity', 0)
        tt_inventory[tid] = tt_inventory.get(tid, 0) + qty

print('Ticket inventory:', tt_inventory)

if not bundles:
    print('No bundles — creating a test bundle...')
    tt_ids = list(tt_inventory.keys())[:2]
    p = {'name': 'Avail Test', 'price': 5000, 'description': 'Test'}
    p[f'ticket_type_ids[{tt_ids[0]}]'] = 1
    b = requests.post(f'{BASE_URL}/event_series/{sid}/bundles', auth=AUTH, data=p)
    bundles = [b.json()]
    print('Created:', b.json().get('id'))

for bundle in bundles:
    included = bundle.get('ticket_types', [])
    min_purchasable = None
    all_available = True
    for inc in included:
        tid = inc['id']
        req_qty = inc.get('quantity', 1)
        stock = tt_inventory.get(tid)
        if stock is None:
            all_available = False
            p4t = 0
        else:
            if req_qty > 0:
                p4t = math.floor(stock / req_qty)
            else:
                p4t = 0
            if p4t == 0:
                all_available = False
        min_purchasable = p4t if min_purchasable is None else min(min_purchasable, p4t)

    name = bundle['name']
    print(f'Bundle: {name} | is_available={all_available} | max_quantity={min_purchasable}')
    for inc in included:
        tid = inc['id']
        stock_val = tt_inventory.get(tid, 'N/A')
        print(f'  Ticket {tid} x{inc["quantity"]} -> Stock: {stock_val}')
