# Ticket Tailor Event Management System

This project is a full-stack Event Management System that acts as an interface leveraging the Ticket Tailor API. It features a React + Vite frontend focused on a premium aesthetic and a FastAPI backend that securely relays requests.

## How It Works

### Architecture
1. **React Frontend (`frontend/`)**: Built with Vite and Tailwind CSS. It communicates *only* with our FastAPI backend. It never talks directly to the Ticket Tailor API, which keeps API keys hidden from the browser.
2. **FastAPI Backend (`backend/`)**: Acts as a secure proxy and business logic layer. It receives requests from the React app, formats them, attaches the `TICKET_TAILOR_API_KEY`, and sends them to `https://api.tickettailor.com/v1/`.
3. **Ticket Tailor API**: The source of truth for all events, ticket types, discounts, and orders.

### Module Breakdown
- **Event Series (`/admin/event-series`)**: High-level grouping for recurring events (e.g., "React Bootcamp 2026").
- **Events (`/admin/events`)**: Specific occurrences (e.g., "Batch 1").
- **Ticket Types (`/admin/tickets`)**: Pricing and availability definitions attached to Events.
- **Discounts (`/admin/discounts`)**: Coupon codes applied at checkout.
- **Orders & Check-ins (`/admin/orders`)**: Viewing purchases and checking in attendees.
- **User Public Pages (`/events`, `/checkout`, `/ticket-success`)**: Beautiful, high-converting interfaces for end-users to discover events, buy tickets securely, and view their digital ticket.

---

## Tailwind CSS Implementation

The frontend employs a premium, modern design aesthetic leveraging **Tailwind CSS**.

### 1. Theming & Configuration
In `tailwind.config.js`, we extended the default theme:
- Added a `brand` color palette (teal/cyan hues `14b8a6`) for vibrant primary actions.
- Defined a `dark` color palette (`0f172a`) to enforce a sleek true-dark mode foundation.
- Configured fonts to use `Inter` for optimal readability.

### 2. Glassmorphism & Custom Layers
In `src/index.css`, we utilized Tailwind's `@layer` directives to build reusable, premium component classes:
- **`glass-card`**: Uses `bg-white/5` and `backdrop-blur-xl` to create a frosted glass effect that sits beautifully on top of the dark radial gradient background. Includes hover states that boost the blur and add a subtle glowing shadow (`shadow-brand-500/20`).
- **`btn-primary`**: A vibrant gradient button (`bg-gradient-to-r from-brand-500 to-brand-400`) with translation animations (`hover:-translate-y-1`) that make the interface feel alive and interactive.

### 3. Utility Classes in Components
Components aggressively use utility classes to avoid writing custom CSS:
- Grid and flex layouts (`grid-cols-1 md:grid-cols-2`, `flex justify-between items-center`).
- Spacing and typography (`text-3xl font-bold`, `p-6 mb-4`).
- Interactive micro-animations (`transition-all duration-300`, `group-hover:translate-x-1`).

---

## Running the Project Locally

### 1. Run the Backend
```bash
cd backend
python -m venv venv
.\venv\Scripts\activate
pip install -r requirements.txt # (or pip install fastapi uvicorn requests python-dotenv pydantic)

# Add your API Key
# Edit backend/.env and set TICKET_TAILOR_API_KEY=your_key

uvicorn main:app --reload
# Backend runs at http://localhost:8000
```

### 2. Run the Frontend
```bash
cd frontend
npm install
npm run dev
# Frontend runs typically at http://localhost:5173
```
