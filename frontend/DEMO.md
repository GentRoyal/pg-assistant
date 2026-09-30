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

The FastAPI service must be running (`VITE_API_BASE_URL`, default `http://localhost:8000`):
sign-in, chat and the admin console all use it.

## Accounts

| Role | How to get one | Lands on |
| --- | --- | --- |
| Student | **Sign up** on the sign-in page (password of 8+ characters) | Chat (`/`) |
| Admin | `python scripts/create_admin.py you@ui.edu.ng` on the backend | Admin console (`/admin`) |

## Student path (≈2 min)

1. Sign up as a student, or sign in.
2. Ask something about PG rules, e.g. *“What is the minimum CGPA for graduation?”*
3. Expand **Sources** on the answer when the API returns citations.
4. Open the sidebar — chats are **per account on this device** only.
5. Start a **New chat**, then check **Settings** → Test connection.

Sign out. Student history stays under that user id in `localStorage`.

## Admin path (≈3 min)

1. Sign in as the admin → Overview KPIs + trend + recent activity.
2. **Documents** — upload a text PDF: it shows **processing**, then **ready** with its page and
   chunk counts. Scanned PDFs are marked **failed** with a note: they need OCR, which runs
   only in the local ingestion script. **Update** replaces a file; the bin deletes it.
3. **Reports** — switch Query log / Document usage; filter, paginate, **Export CSV**.

## What runs where

| Area | Status |
| --- | --- |
| Sign-in, sign-up, sign-out | Real API (`/auth/*`) |
| Student `POST /chat` | Real API, requires sign-in |
| Admin dashboard / docs / reports | Real API (`/admin/*`), admins only |
| Chat history | Browser `localStorage`, keyed by user id |

## Handoff docs

- [`ADMIN_API.md`](./ADMIN_API.md) — backend contract for admin routes
- [`README.md`](./README.md) — setup, chat contract, deploy notes
