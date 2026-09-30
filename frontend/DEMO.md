# Demo walkthrough — PG Assistant

Frontend-ready demo for the University of Ibadan postgraduate regulation assistant
(Generative AI course group project).

## Start

```bash
cd frontend
cp .env.example .env   # if needed
npm install
npm run dev
```

Open http://localhost:5173

Optional: run the FastAPI service so student chat answers from real RAG
(`VITE_API_BASE_URL`, default `http://localhost:8000`). Admin screens work offline on stubs.

## Accounts

| Role | Email | Password | Lands on |
| --- | --- | --- | --- |
| Student | `student@ui.edu.ng` | `demo1234` | Chat (`/`) |
| Admin | `admin@ui.edu.ng` | `admin1234` | Admin console (`/admin`) |

Any other valid email + password (≥6 chars) also signs in as a **student** (local demo).

## Student path (≈2 min)

1. Sign in as the student.
2. Ask something about PG rules, e.g. *“What is the minimum CGPA for graduation?”*
3. Expand **Sources** on the answer when the API returns citations.
4. Open the sidebar — chats are **per account on this device** only.
5. Start a **New chat**, then check **Settings** → Test connection.

Sign out. Student history stays under that user id in `localStorage`.

## Admin path (≈3 min)

1. Sign in as the admin → Overview KPIs + trend + recent activity.
2. **Documents** — upload / update / delete PDFs (stub: changes stay in-memory for the session).
3. **Reports** — switch Query log / Document usage; filter, paginate, **Export CSV**.
4. Note the amber **Stub APIs** banner — flip `USE_MOCK_ADMIN` when the backend matches `ADMIN_API.md`.

## What is real vs stub

| Area | Status |
| --- | --- |
| Student `POST /chat` | Real API (or fails gracefully if API is down) |
| Demo login | Local fallback; tries `POST /auth/login` first |
| Admin dashboard / docs / reports | Stub until `USE_MOCK_ADMIN = false` |
| Chat history | Browser `localStorage`, keyed by user id |

## Handoff docs

- [`ADMIN_API.md`](./ADMIN_API.md) — backend contract for admin routes
- [`README.md`](./README.md) — setup, chat contract, deploy notes
