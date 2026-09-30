# Auth and admin API

The React app (`frontend/src/lib/auth.ts`, `frontend/src/lib/adminApi.ts`) calls these
endpoints, implemented in `api/auth.py` and `api/admin.py`.

All admin routes require `Authorization: Bearer <token>` from a user with `role: "admin"`
(`401` without a valid session, `403` for a student). `POST /chat` and the conversation
routes require any signed-in user.
JSON responses use **camelCase** field names matching the TypeScript types in
`frontend/src/types/index.ts`.

Base URL: same as chat API (`VITE_API_BASE_URL`).

---

## Auth

### `POST /auth/login`

```json
{ "email": "admin@ui.edu.ng", "password": "••••••••" }
```

```json
{
  "token": "jwt-or-opaque-token",
  "user": {
    "id": "uuid",
    "name": "Demo Admin",
    "email": "admin@ui.edu.ng",
    "role": "admin"
  }
}
```

`role` is `"student"` or `"admin"`. Wrong email or password → `401`. Sign-in and sign-up are
rate limited per IP (`429`). Sessions last 7 days (`AUTH_SESSION_DAYS`).

### `POST /auth/register`

```json
{ "name": "Ada Okafor", "email": "ada@ui.edu.ng", "password": "at least 8 characters" }
```

Same response as login. Always creates a **student**; `409` if the email is taken. Admin
accounts are created with `scripts/create_admin.py`.

### `POST /auth/logout`

Ends the session for the bearer token. `204`.

### `GET /auth/me`

The signed-in user (`id`, `name`, `email`, `role`), or `401`.

---

## Dashboard

### `GET /admin/stats`

```json
{
  "totalDocuments": 5,
  "totalChunks": 866,
  "totalPages": 380,
  "questionsToday": 18,
  "questionsWeek": 146,
  "activeStudents": 42,
  "conversations": 87,
  "avgLatencyMs": 1180,
  "weakRetrievalRate": 0.11,
  "systemStatus": "ok",
  "questionsTrend": [22, 28, 19, 31, 26, 34, 18],
  "topDocuments": [{ "title": "Postgraduate Handbook", "hits": 64 }],
  "recentActivity": [
    {
      "id": "a1",
      "label": "Registration Procedures uploaded — processing",
      "at": "2026-09-30T09:00:00.000Z",
      "tone": "info"
    }
  ]
}
```

- `systemStatus`: `"ok"` | `"degraded"`
- `recentActivity[].tone`: `"info"` | `"success"` | `"warn"`
- `questionsTrend`: exactly 7 integers (Mon→Sun)

---

## Documents

### `GET /admin/documents`

```json
[
  {
    "id": "uuid",
    "title": "Postgraduate Handbook",
    "fileName": "pg-handbook.pdf",
    "documentType": "Handbook",
    "academicLevel": "Postgraduate",
    "pages": 186,
    "chunks": 412,
    "status": "ready",
    "uploadedAt": "2026-08-20T10:00:00.000Z",
    "updatedAt": "2026-09-18T10:00:00.000Z",
    "sizeBytes": 4200000
  }
]
```

`status`: `"ready"` | `"processing"` | `"failed"`. Each item also has `error`: why processing
failed, or a note such as `"3 scanned page(s) were skipped."`, else `null`.

Tags are stored lowercase and shown title-cased; an empty level is shown as `"All"`.

### `POST /admin/documents` (multipart)

| Field | Type | Notes |
| --- | --- | --- |
| `file` | PDF file | Required. `application/pdf` |
| `title` | string | Optional; default from filename |
| `documentType` | string | Optional |
| `academicLevel` | string | Optional |

Returns the created `AdminDocument` object (same shape as list items) with `status:
"processing"`. The server then extracts, chunks and embeds the PDF in the background; poll
`GET /admin/documents` until it is `ready` or `failed`.

- `400` not a PDF · `409` a document with the same file name exists · `413` over 50 MB
  (`MAX_UPLOAD_MB`).
- The server does not run OCR. A PDF whose pages are mostly scanned images is marked
  `failed`; ingest it with `scripts/ingest_documents.py` on a machine with OCR installed.
- The original file is not kept; only its text chunks are stored.

### `PUT /admin/documents/{id}` (multipart)

Same fields as upload, all optional. With a `file`, replaces it and re-processes; without one,
updates only the title and tags. `409` while the document is still processing. Returns the
updated document.

### `DELETE /admin/documents/{id}`

`204 No Content` on success.

---

## Reports

### `GET /admin/reports/queries`

Query params:

| Param | Type | Notes |
| --- | --- | --- |
| `q` | string | Search question / email / source |
| `status` | string | `answered` \| `weak` \| `error` (omit = all) |
| `from` | `YYYY-MM-DD` | Inclusive start |
| `to` | `YYYY-MM-DD` | Inclusive end |
| `page` | int | Default `1` |
| `page_size` | int | Default `5` |

```json
{
  "items": [
    {
      "id": "q1",
      "askedAt": "2026-09-30T10:15:00.000Z",
      "studentEmail": "student@ui.edu.ng",
      "question": "What is the minimum CGPA for graduation?",
      "status": "answered",
      "latencyMs": 1120,
      "topSource": "Postgraduate Handbook"
    }
  ],
  "total": 42,
  "page": 1,
  "pageSize": 5
}
```

CSV export on the frontend requests a large `page_size` (up to 10000) with the same filters.

### `GET /admin/reports/documents`

Query params: `q`, `status` (`ready` \| `processing` \| `failed`), `page`, `page_size`.

```json
{
  "items": [
    {
      "id": "doc-1",
      "title": "Postgraduate Handbook",
      "documentType": "Handbook",
      "hits": 64,
      "lastCitedAt": "2026-09-18T10:00:00.000Z",
      "status": "ready"
    }
  ],
  "total": 5,
  "page": 1,
  "pageSize": 5
}
```

`lastCitedAt` is `null` for a document that has never been cited. `hits` counts the questions
whose answer cited the document.
