# The Bridge — Feedback-as-a-Service (FaaS)

Monorepo with:

- `server/` — DB + API (the “brain”)
- `admin/` — Management dashboard (the “hub”)
- `widget/` — Pluggable React/Tailwind client widget

## Quick start (local)

1) Start the API + DB

- `npm -w server run dev`

The server runs on `http://localhost:4000` and uses SQLite at `server/dev.db`.

2) Start the Admin dashboard

- `npm -w admin run dev`

Set `admin/.env` from `admin/.env.example` if needed.

3) Create an Application + API key

Open the Admin app → **App Management** → create an internal app (e.g. “Sales CRM”).

4) Test the Widget

Set `widget/.env` from `widget/.env.example` using the `appId` + `apiKey` from step 3, then:

- `npm -w widget run dev`

## CORS

The server enables CORS and allows the `x-api-key` header. Configure allowed origins via `server/.env`:

- `CORS_ORIGINS=*` (dev)
- or `CORS_ORIGINS=https://property-portal.com,https://sales-crm.com` (prod)
