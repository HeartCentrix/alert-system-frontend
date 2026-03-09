# TM Alert — Frontend
### React + Vite + Tailwind CSS

---

## Quick Start

```bash
cd tm_alert_frontend
cp .env.example .env
npm install
npm run dev
```

Open: **http://localhost:3000**

The dev server proxies `/api` to `http://localhost:8000` automatically.

---

## Project Structure

```
src/
├── main.jsx                 # Entry point, React Query setup, Toaster
├── App.jsx                  # Router, protected routes
├── index.css                # Tailwind + global design tokens
├── pages/
│   ├── LoginPage.jsx        # Auth
│   ├── DashboardPage.jsx    # Stats, locations, activity chart
│   ├── NewNotificationPage.jsx  # 5-step wizard
│   ├── NotificationsPage.jsx    # List + detail with delivery tracker
│   ├── PeoplePage.jsx       # User management + CSV import
│   ├── OtherPages.jsx       # Groups, Locations, Templates, Incidents
│   ├── IncomingPage.jsx     # SMS replies from employees
│   └── SettingsPage.jsx     # Profile + password change
├── components/layout/
│   └── AppLayout.jsx        # Sidebar + top bar
├── services/
│   └── api.js               # All Axios API calls, token refresh
├── store/
│   └── authStore.js         # Zustand auth state
└── utils/
    └── helpers.js           # formatters, color maps, constants
```

---

## Key Features

- **Dark dashboard** modeled after the AlertMedia UI you referenced
- **5-step notification wizard** — incident type → message → recipients → channels → review
- **Live delivery tracking** — real-time delivery logs with donut chart for safety responses
- **People management** — search, filter, create, edit, delete, bulk CSV import
- **Groups** — static and dynamic group management
- **Locations** — site management with Google Maps links
- **Templates** — reusable messages by category
- **Incidents** — severity-coded incident tracker
- **Incoming messages** — employee SMS replies auto-refresh every 10s
- **JWT auth** — access + refresh token, auto-renewal on 401

---

## Build for Production

```bash
npm run build
# Output in /dist — deploy to any static host (Vercel, Netlify, S3+CloudFront)
```

For Vercel:
```bash
vercel --prod
# Set: VITE_API_URL=https://your-backend.railway.app/api/v1
```

---

## Design System

- **Font**: Syne (display/headings) + DM Sans (body)
- **Theme**: Dark surface palette — `surface-950` base, `surface-900` cards
- **Colors**: `primary-600` blue actions, `danger-600` red alerts, status badge system
- **Components**: `.btn-primary`, `.btn-danger`, `.btn-ghost`, `.card`, `.badge-*`, `.input`, `.label`

---

Built by HeartCentrix
