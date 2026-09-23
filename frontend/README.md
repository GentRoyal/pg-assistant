# UI Academic Regulation Assistant — Frontend

React (Vite + TypeScript + Tailwind) chat UI for the University of Ibadan postgraduate regulation RAG assistant.

## Features

- Open chat (no login)
- ChatGPT-style history sidebar + settings
- File attachments (PDF, Word, TXT, images) with drag-and-drop
- Answers with **sources**, **chunk text**, and **confidence**
- Academic disclaimer banner
- University of Ibadan inspired **indigo + gold** branding
- Mock API mode for local demos without the Python backend

## Quick start

```bash
cd frontend
cp .env.example .env
npm install
npm run dev
```

Open http://localhost:5173

## Backend contract (for your teammate)

`POST /ask`

```json
{
  "question": "How do I register for postgraduate courses?",
  "conversation_id": "optional-uuid"
}
```

Response:

```json
{
  "answer": "...",
  "confidence": 0.86,
  "sources": [
    {
      "document_title": "Postgraduate Handbook",
      "section": "Registration Procedures",
      "page": 18,
      "chunk_text": "...",
      "score": 0.91
    }
  ]
}
```

With attachments, the same endpoint accepts **multipart/form-data**:
- `question` (string)
- `conversation_id` (optional)
- `files` (one or more files)

Set `VITE_USE_MOCK_API=false` and `VITE_API_BASE_URL=http://localhost:8000` when the API is live.

## Deploy

- **Local:** `npm run dev` / `npm run build && npm run preview`
- **Vercel:** import the repo, set Root Directory to `frontend`, build `npm run build`, output `dist`
- **GitHub Pages:** build and publish `dist` (set Vite `base` if needed)
