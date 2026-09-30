# UI Academic Regulation Assistant — Frontend

React (Vite + TypeScript + Tailwind) chat UI for the University of Ibadan postgraduate regulation RAG assistant.

## Features

- Accounts: **students** sign up and land on chat; **admins** land on the console
- Student chatbot with per-user saved conversations
- Admin console: analytics dashboard, documents CRUD, reports (filters + pagination + CSV export)
- Source citations and confidence display
- University of Ibadan inspired branding

## Quick start

```bash
cd frontend
cp .env.example .env
npm install
npm run dev
```

Open http://localhost:5173

Students create an account with **Sign up**. Admin accounts are created by the backend
script `scripts/create_admin.py` (see the root README). Sign-in, chat and the admin console
all use the real API; the endpoints are listed in [`ADMIN_API.md`](./ADMIN_API.md).

## Backend contract

The app talks to the FastAPI service in `../api`.

`POST /chat`

```json
{
  "question": "How do I register for postgraduate courses?",
  "conversation_id": "uuid returned by a previous reply, omit on the first message"
}
```

Response:

```json
{
  "conversation_id": "uuid",
  "question": "...",
  "search_query": "the follow-up rewritten as a standalone question",
  "answer": "...",
  "citations": [
    {
      "index": 1,
      "chunk_id": "uuid",
      "source": "MANUAL_OF_STYLE.pdf",
      "title": "Manual Of Style",
      "section_title": "1.5. Photographs",
      "page_start": 6,
      "page_end": 6,
      "similarity": 0.78,
      "content": "..."
    }
  ],
  "llm": "local/llama3.2",
  "latency_ms": 1240
}
```

`src/lib/api.ts` maps this onto the `AskResponse` shape the components use, so
`citations` becomes `sources` and `confidence` is taken from the strongest
similarity score. Note that similarity is a retrieval score, not a calibrated
confidence in the answer.

Conversation ids are owned by the server. The local conversation `id` is only a
key for this browser; `serverId` holds the id the API assigned, and it is sent
back on every follow-up so the assistant keeps its context.

Each student's chats live on the server, so they follow the student to any
device. The browser keeps a cached copy so the sidebar shows instantly, then
refreshes it from `GET /conversations` after sign-in. A chat's messages are
fetched when it is opened. A chat that has not been answered yet exists only
in the browser.

Other endpoints (all need the signed-in user except `/health`):

- `GET /health` — used by **Test connection** in Settings
- `GET /conversations` — the signed-in user's chats, most recently active first
- `GET /conversations/{id}` — one chat and its messages
- `PATCH /conversations/{id}` — rename (`{"title": "..."}`)
- `DELETE /conversations/{id}` — delete one chat
- `DELETE /conversations` — delete all the user's chats (**Clear history**)
- `POST /retrieve` — search only, no LLM needed (admins only)

### Auth

Sign-in is real: `lib/auth.ts` calls `POST /auth/login` and `POST /auth/register`,
and every request sends `Authorization: Bearer <token>`. Students sign up
themselves; admin accounts are created on the server with
`scripts/create_admin.py`. A 401 from the API ends the session.

### Attachments

Not supported by the backend. The assistant answers from documents that have
been ingested into Supabase, so files attached in the composer are rejected with
an explanatory message.

Set `VITE_API_BASE_URL=http://localhost:8000` when running the API locally (see
`.env.example`). It can also be changed at runtime in Settings.

## Deploy

Two separate services:

| Service | Hosts | Runs |
| --- | --- | --- |
| Vercel | this `frontend/` | the static build from `npm run build` |
| Render | the repo root | `uvicorn api.main:app --host 0.0.0.0 --port $PORT` |

### Vercel

Set in the project's environment variables:

```
VITE_API_BASE_URL=https://<your-api>.onrender.com
```

`VITE_API_BASE_URL` is inlined at build time, so changing it requires a
redeploy. It must point at the **API**, not at the frontend's own URL — pointing
it at the Vercel domain is what produces
`Could not reach the API at https://<frontend>.vercel.app`.

The `server.proxy` block in `vite.config.ts` is the **dev server only**. It does
not exist in a production build, so `/api/...` paths are not proxied on Vercel.
The deployed app talks to the API host directly; CORS is open on the API.

### Render

Use `render.yaml` at the repo root, or configure by hand:

- Build: `pip install -r requirements-api.txt`
- Start: `uvicorn api.main:app --host 0.0.0.0 --port $PORT`
- Health check: `/health`

Binding `0.0.0.0` and `$PORT` is required; a hardcoded `--port 8000` is not
reachable on Render.

Do **not** run the frontend on Render with `npm run dev`. The Vite dev server
answers every path with `index.html`, so `/health` and `/chat` return the SPA
instead of the API, and nothing ever reaches FastAPI.

### Memory

With `EMBEDDING_PROVIDER=local` the API process measures about **400 MB** RSS
(torch plus bge-small), which does not fit Render's 512 MB free instance. Either
run a paid instance and install the full `requirements.txt`, or set
`EMBEDDING_PROVIDER=openai` with `EMBEDDING_DIMENSIONS=384` so torch is never
imported. Switching embedding models means re-ingesting every document, because
vectors from different models are not comparable.
