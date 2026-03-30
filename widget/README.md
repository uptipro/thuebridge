# Feedback Widget (Pluggable Client)

A React + Tailwind floating action button (FAB) that opens a modal feedback form and POSTs to the Feedback Hub API.

## What it sends

On submit, it posts to `POST /api/v1/report` with:

- `appId` (prop)
- `module` (dropdown)
- `description` (textarea)
- `impactLevel` (radio: Losing Leads / Delaying Follow-ups / Just Annoying)
- `metadata` (auto-captured):
  - `url` (`window.location.href`)
  - `userAgent` (`navigator.userAgent`)
  - `timestamp` (ISO)
  - optional `leadId` or `propertyId` depending on module

The request includes `x-api-key` header.

## Integrate into another app

This widget is designed to be copy/pasted or imported as a library.

**Copy/paste approach**

- Copy `src/FeedbackWidget.tsx` into your host app
- Ensure your host app has Tailwind enabled
- Render:

```tsx
<FeedbackWidget
  appId="YOUR_APP_ID"
  apiKey="YOUR_API_KEY"
  apiBaseUrl="https://feedback-hub.yourdomain.com"
/>
```

## Local dev

Create `widget/.env` from `.env.example` and run:

- `npm -w widget run dev`

The demo page reads `VITE_API_BASE_URL`, `VITE_APP_ID`, and `VITE_API_KEY`.
