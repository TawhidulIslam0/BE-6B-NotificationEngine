# Notification Engine Demo

React/Vite frontend for the BE-6B Notification Engine backend.

## Run

```powershell
npm install
Copy-Item .env.example .env
npm run dev
```

The frontend expects the backend at `http://localhost:3000`. Set
`VITE_API_BASE_URL` in `.env` for a deployed backend.

The available pages are Dashboard, Send Test Event, Analytics, DLQ, and
Preferences.
