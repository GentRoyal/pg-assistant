# Admin API contract (frontend handoff)

The React admin console (`frontend/src/lib/adminApi.ts`) talks to these endpoints when
`USE_MOCK_ADMIN` is set to `false`. Until then it uses in-browser stub data so the demo
works without the backend.

All admin routes require `Authorization: Bearer <token>` from a user with `role: "admin"`.
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

`role` must be `"student"` or `"admin"` (`"staff"` is accepted and mapped to admin on the client).

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

`status`: `"ready"` | `"processing"` | `"failed"`

### `POST /admin/documents` (multipart)

| Field | Type | Notes |
| --- | --- | --- |
| `file` | PDF file | Required. `application/pdf` |
| `title` | string | Optional; default from filename |
| `documentType` | string | Optional |
| `academicLevel` | string | Optional |

Returns the created `AdminDocument` object (same shape as list items).

### `PUT /admin/documents/{id}` (multipart)

Same fields as upload. Replaces the file and re-queues ingestion. Returns updated document.

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

---

## Switching the frontend off stubs

1. Implement the routes above (and real login roles).
2. In `frontend/src/lib/adminApi.ts`, set:

```ts
export const USE_MOCK_ADMIN = false
```

3. Rebuild / restart Vite. The amber “Stub APIs” banner disappears when live.

Student chat (`POST /chat`, `GET /health`) already hits the real API and does **not** use this flag.
