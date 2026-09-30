import type {
  AdminDocument,
  DashboardStats,
  Paginated,
  ReportDocumentRow,
  ReportQueryRow,
} from '../types'
import { resolveApiBase, ApiError, notifySessionExpired } from './api'

/**
 * HANDOFF FLAG for the backend engineer.
 * - `true`  → frontend uses local demo data (current state)
 * - `false` → frontend calls the real admin endpoints in ADMIN_API.md
 *
 * Flip this only after auth + admin routes match the contract.
 */
export const USE_MOCK_ADMIN = false

const now = Date.now()
const day = 24 * 60 * 60 * 1000

function isoDaysAgo(n: number, hour = 10) {
  const d = new Date(now - n * day)
  d.setHours(hour, 15, 0, 0)
  return d.toISOString()
}

let documents: AdminDocument[] = [
  {
    id: 'doc-1',
    title: 'Postgraduate Handbook',
    fileName: 'pg-handbook.pdf',
    documentType: 'Handbook',
    academicLevel: 'Postgraduate',
    pages: 186,
    chunks: 412,
    status: 'ready',
    uploadedAt: isoDaysAgo(40),
    updatedAt: isoDaysAgo(12),
    sizeBytes: 4_200_000,
  },
  {
    id: 'doc-2',
    title: 'Examination Regulations',
    fileName: 'exam-regulations.pdf',
    documentType: 'Regulation',
    academicLevel: 'All',
    pages: 64,
    chunks: 148,
    status: 'ready',
    uploadedAt: isoDaysAgo(35),
    updatedAt: isoDaysAgo(8),
    sizeBytes: 1_850_000,
  },
  {
    id: 'doc-3',
    title: 'Manual of Style',
    fileName: 'MANUAL_OF_STYLE.pdf',
    documentType: 'Guide',
    academicLevel: 'Postgraduate',
    pages: 92,
    chunks: 210,
    status: 'ready',
    uploadedAt: isoDaysAgo(28),
    updatedAt: isoDaysAgo(5),
    sizeBytes: 2_400_000,
  },
  {
    id: 'doc-4',
    title: 'Registration Procedures',
    fileName: 'registration-procedures.pdf',
    documentType: 'Procedure',
    academicLevel: 'Postgraduate',
    pages: 38,
    chunks: 96,
    status: 'processing',
    uploadedAt: isoDaysAgo(0, 9),
    updatedAt: isoDaysAgo(0, 9),
    sizeBytes: 980_000,
  },
  {
    id: 'doc-5',
    title: 'Student Disciplinary Regulations',
    fileName: 'disciplinary.pdf',
    documentType: 'Regulation',
    academicLevel: 'All',
    pages: 44,
    chunks: 0,
    status: 'failed',
    uploadedAt: isoDaysAgo(2),
    updatedAt: isoDaysAgo(2),
    sizeBytes: 1_100_000,
  },
]

const querySeed: ReportQueryRow[] = [
  {
    id: 'q1',
    askedAt: isoDaysAgo(0, 11),
    studentEmail: 'student@ui.edu.ng',
    question: 'How do I complete postgraduate course registration?',
    status: 'answered',
    latencyMs: 1240,
    topSource: 'Postgraduate Handbook',
  },
  {
    id: 'q2',
    askedAt: isoDaysAgo(0, 10),
    studentEmail: 'adeola.b@ui.edu.ng',
    question: 'What makes me eligible to sit an examination?',
    status: 'answered',
    latencyMs: 980,
    topSource: 'Examination Regulations',
  },
  {
    id: 'q3',
    askedAt: isoDaysAgo(1, 16),
    studentEmail: 'chidi.o@ui.edu.ng',
    question: 'What is the weather in Ibadan today?',
    status: 'weak',
    latencyMs: 720,
    topSource: '—',
  },
  {
    id: 'q4',
    askedAt: isoDaysAgo(1, 14),
    studentEmail: 'student@ui.edu.ng',
    question: 'Thesis supervision requirements for MSc?',
    status: 'answered',
    latencyMs: 1510,
    topSource: 'Postgraduate Handbook',
  },
  {
    id: 'q5',
    askedAt: isoDaysAgo(2, 9),
    studentEmail: 'fatima.s@ui.edu.ng',
    question: 'Manual of style photo rules',
    status: 'answered',
    latencyMs: 1105,
    topSource: 'Manual of Style',
  },
  {
    id: 'q6',
    askedAt: isoDaysAgo(3, 13),
    studentEmail: 'kemi.a@ui.edu.ng',
    question: 'Can I defer my examinations?',
    status: 'answered',
    latencyMs: 1320,
    topSource: 'Examination Regulations',
  },
  {
    id: 'q7',
    askedAt: isoDaysAgo(4, 15),
    studentEmail: 'tunde.m@ui.edu.ng',
    question: 'Disciplinary process for examination malpractice',
    status: 'error',
    latencyMs: 0,
    topSource: '—',
  },
  {
    id: 'q8',
    askedAt: isoDaysAgo(5, 11),
    studentEmail: 'student@ui.edu.ng',
    question: 'Registration fee clearance steps',
    status: 'answered',
    latencyMs: 890,
    topSource: 'Registration Procedures',
  },
  {
    id: 'q9',
    askedAt: isoDaysAgo(6, 17),
    studentEmail: 'nneka.e@ui.edu.ng',
    question: 'How many credit units for coursework?',
    status: 'weak',
    latencyMs: 1400,
    topSource: 'Postgraduate Handbook',
  },
  {
    id: 'q10',
    askedAt: isoDaysAgo(7, 12),
    studentEmail: 'ibrahim.y@ui.edu.ng',
    question: 'Format for thesis abstract',
    status: 'answered',
    latencyMs: 1020,
    topSource: 'Manual of Style',
  },
  {
    id: 'q11',
    askedAt: isoDaysAgo(8, 10),
    studentEmail: 'student@ui.edu.ng',
    question: 'Late registration penalties',
    status: 'answered',
    latencyMs: 1180,
    topSource: 'Registration Procedures',
  },
  {
    id: 'q12',
    askedAt: isoDaysAgo(9, 14),
    studentEmail: 'grace.w@ui.edu.ng',
    question: 'Who approves my supervisor?',
    status: 'answered',
    latencyMs: 1340,
    topSource: 'Postgraduate Handbook',
  },
]

function delay(ms = 350) {
  return new Promise((r) => setTimeout(r, ms))
}

async function readError(res: Response) {
  const text = await res.text().catch(() => '')
  try {
    const body = JSON.parse(text) as { detail?: string }
    if (typeof body.detail === 'string') return body.detail
  } catch {
    /* raw */
  }
  return text || `Request failed (HTTP ${res.status})`
}

async function apiFetch(
  path: string,
  options: { method?: string; token?: string; body?: BodyInit; apiBaseUrl?: string } = {},
) {
  const base = resolveApiBase(options.apiBaseUrl)
  const headers: Record<string, string> = {}
  if (options.token) headers.Authorization = `Bearer ${options.token}`
  if (options.body && !(options.body instanceof FormData)) {
    headers['Content-Type'] = 'application/json'
  }
  const res = await fetch(`${base}${path}`, {
    method: options.method ?? 'GET',
    headers,
    body: options.body,
  })
  if (res.status === 401) notifySessionExpired()
  if (!res.ok) throw new ApiError(await readError(res), res.status)
  if (res.status === 204) return null
  return res.json()
}

export type AdminApiOptions = {
  token?: string
  apiBaseUrl?: string
}

export async function fetchDashboardStats(options: AdminApiOptions = {}): Promise<DashboardStats> {
  if (!USE_MOCK_ADMIN) {
    return (await apiFetch('/admin/stats', options)) as DashboardStats
  }
  await delay()
  const ready = documents.filter((d) => d.status === 'ready')
  return {
    totalDocuments: documents.length,
    totalChunks: ready.reduce((sum, d) => sum + d.chunks, 0),
    totalPages: ready.reduce((sum, d) => sum + d.pages, 0),
    questionsToday: 18,
    questionsWeek: 146,
    activeStudents: 42,
    conversations: 87,
    avgLatencyMs: 1180,
    weakRetrievalRate: 0.11,
    systemStatus: documents.some((d) => d.status === 'failed') ? 'degraded' : 'ok',
    questionsTrend: [22, 28, 19, 31, 26, 34, 18],
    topDocuments: [
      { title: 'Postgraduate Handbook', hits: 64 },
      { title: 'Examination Regulations', hits: 41 },
      { title: 'Manual of Style', hits: 29 },
      { title: 'Registration Procedures', hits: 22 },
    ],
    recentActivity: [
      {
        id: 'a1',
        label: 'Registration Procedures uploaded — still processing',
        at: isoDaysAgo(0, 9),
        tone: 'info',
      },
      {
        id: 'a2',
        label: 'Student asked about exam eligibility',
        at: isoDaysAgo(0, 10),
        tone: 'success',
      },
      {
        id: 'a3',
        label: 'Disciplinary Regulations failed to upload',
        at: isoDaysAgo(2),
        tone: 'warn',
      },
      {
        id: 'a4',
        label: 'Manual of Style updated successfully',
        at: isoDaysAgo(5),
        tone: 'success',
      },
    ],
  }
}

export async function fetchAdminDocuments(options: AdminApiOptions = {}): Promise<AdminDocument[]> {
  if (!USE_MOCK_ADMIN) {
    return (await apiFetch('/admin/documents', options)) as AdminDocument[]
  }
  await delay()
  return [...documents].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
}

export async function uploadAdminDocument(
  file: File,
  options: AdminApiOptions = {},
): Promise<AdminDocument> {
  if (!USE_MOCK_ADMIN) {
    const form = new FormData()
    form.append('file', file)
    return (await apiFetch('/admin/documents', {
      ...options,
      method: 'POST',
      body: form,
    })) as AdminDocument
  }
  await delay(700)
  const doc: AdminDocument = {
    id: crypto.randomUUID(),
    title: file.name.replace(/\.pdf$/i, '').replace(/[_-]+/g, ' '),
    fileName: file.name,
    documentType: 'Upload',
    academicLevel: 'Postgraduate',
    pages: 0,
    chunks: 0,
    status: 'processing',
    uploadedAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    sizeBytes: file.size,
  }
  documents = [doc, ...documents]
  return doc
}

export async function replaceAdminDocument(
  id: string,
  file: File,
  options: AdminApiOptions = {},
): Promise<AdminDocument> {
  if (!USE_MOCK_ADMIN) {
    const form = new FormData()
    form.append('file', file)
    return (await apiFetch(`/admin/documents/${id}`, {
      ...options,
      method: 'PUT',
      body: form,
    })) as AdminDocument
  }
  await delay(600)
  const idx = documents.findIndex((d) => d.id === id)
  if (idx < 0) throw new Error('Document not found')
  const current = documents[idx]
  const next: AdminDocument = {
    ...current,
    fileName: file.name,
    sizeBytes: file.size,
    status: 'processing',
    pages: 0,
    chunks: 0,
    updatedAt: new Date().toISOString(),
  }
  documents = documents.map((d) => (d.id === id ? next : d))
  return next
}

export async function deleteAdminDocument(id: string, options: AdminApiOptions = {}): Promise<void> {
  if (!USE_MOCK_ADMIN) {
    await apiFetch(`/admin/documents/${id}`, { ...options, method: 'DELETE' })
    return
  }
  await delay(400)
  documents = documents.filter((d) => d.id !== id)
}

export type QueryReportFilters = {
  status?: 'all' | 'answered' | 'weak' | 'error'
  q?: string
  from?: string
  to?: string
  page?: number
  pageSize?: number
}

function filterQueries(filters: QueryReportFilters) {
  let rows = [...querySeed]
  if (filters.status && filters.status !== 'all') {
    rows = rows.filter((r) => r.status === filters.status)
  }
  if (filters.q?.trim()) {
    const needle = filters.q.trim().toLowerCase()
    rows = rows.filter(
      (r) =>
        r.question.toLowerCase().includes(needle) ||
        r.studentEmail.toLowerCase().includes(needle) ||
        r.topSource.toLowerCase().includes(needle),
    )
  }
  if (filters.from) {
    const from = new Date(filters.from).getTime()
    rows = rows.filter((r) => new Date(r.askedAt).getTime() >= from)
  }
  if (filters.to) {
    const to = new Date(filters.to).getTime() + day
    rows = rows.filter((r) => new Date(r.askedAt).getTime() <= to)
  }
  rows.sort((a, b) => b.askedAt.localeCompare(a.askedAt))
  return rows
}

export async function fetchQueryReport(
  filters: QueryReportFilters = {},
  options: AdminApiOptions = {},
): Promise<Paginated<ReportQueryRow>> {
  const page = filters.page ?? 1
  const pageSize = filters.pageSize ?? 5

  if (!USE_MOCK_ADMIN) {
    const params = new URLSearchParams()
    if (filters.status && filters.status !== 'all') params.set('status', filters.status)
    if (filters.q) params.set('q', filters.q)
    if (filters.from) params.set('from', filters.from)
    if (filters.to) params.set('to', filters.to)
    params.set('page', String(page))
    params.set('page_size', String(pageSize))
    return (await apiFetch(`/admin/reports/queries?${params}`, options)) as Paginated<ReportQueryRow>
  }

  await delay()
  const rows = filterQueries(filters)
  const total = rows.length
  const start = (page - 1) * pageSize
  return { items: rows.slice(start, start + pageSize), total, page, pageSize }
}

/** All filtered query rows (for CSV export). */
export async function fetchAllQueryReportRows(
  filters: Omit<QueryReportFilters, 'page' | 'pageSize'> = {},
  options: AdminApiOptions = {},
): Promise<ReportQueryRow[]> {
  if (!USE_MOCK_ADMIN) {
    const data = await fetchQueryReport({ ...filters, page: 1, pageSize: 10_000 }, options)
    return data.items
  }
  await delay(200)
  return filterQueries(filters)
}

export type DocumentReportFilters = {
  status?: 'all' | DocumentStatusLike
  q?: string
  page?: number
  pageSize?: number
}

type DocumentStatusLike = 'ready' | 'processing' | 'failed'

function filterDocumentRows(filters: DocumentReportFilters) {
  const hitMap: Record<string, number> = {
    'Postgraduate Handbook': 64,
    'Examination Regulations': 41,
    'Manual of Style': 29,
    'Registration Procedures': 22,
    'Student Disciplinary Regulations': 3,
  }

  let rows: ReportDocumentRow[] = documents.map((d) => ({
    id: d.id,
    title: d.title,
    documentType: d.documentType,
    hits: hitMap[d.title] ?? 0,
    lastCitedAt: d.updatedAt,
    status: d.status,
  }))

  if (filters.status && filters.status !== 'all') {
    rows = rows.filter((r) => r.status === filters.status)
  }
  if (filters.q?.trim()) {
    const needle = filters.q.trim().toLowerCase()
    rows = rows.filter(
      (r) =>
        r.title.toLowerCase().includes(needle) || r.documentType.toLowerCase().includes(needle),
    )
  }
  rows.sort((a, b) => b.hits - a.hits)
  return rows
}

export async function fetchDocumentReport(
  filters: DocumentReportFilters = {},
  options: AdminApiOptions = {},
): Promise<Paginated<ReportDocumentRow>> {
  const page = filters.page ?? 1
  const pageSize = filters.pageSize ?? 5

  if (!USE_MOCK_ADMIN) {
    const params = new URLSearchParams()
    if (filters.status && filters.status !== 'all') params.set('status', filters.status)
    if (filters.q) params.set('q', filters.q)
    params.set('page', String(page))
    params.set('page_size', String(pageSize))
    return (await apiFetch(`/admin/reports/documents?${params}`, options)) as Paginated<ReportDocumentRow>
  }

  await delay()
  const rows = filterDocumentRows(filters)
  const total = rows.length
  const start = (page - 1) * pageSize
  return { items: rows.slice(start, start + pageSize), total, page, pageSize }
}

export async function fetchAllDocumentReportRows(
  filters: Omit<DocumentReportFilters, 'page' | 'pageSize'> = {},
  options: AdminApiOptions = {},
): Promise<ReportDocumentRow[]> {
  if (!USE_MOCK_ADMIN) {
    const data = await fetchDocumentReport({ ...filters, page: 1, pageSize: 10_000 }, options)
    return data.items
  }
  await delay(200)
  return filterDocumentRows(filters)
}
