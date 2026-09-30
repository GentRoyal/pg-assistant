export type UserRole = 'student' | 'admin'

export type User = {
  id: string
  name: string
  email: string
  role: UserRole
}

export type AuthSession = {
  token: string
  user: User
}

export type MessageAttachment = {
  id: string
  name: string
  size: number
  type: string
}

export type SourceChunk = {
  id: string
  documentTitle: string
  section?: string
  page?: number
  chunkText: string
  score?: number
}

export type ChatRole = 'user' | 'assistant' | 'system'

export type ChatMessage = {
  id: string
  role: ChatRole
  content: string
  createdAt: string
  attachments?: MessageAttachment[]
  sources?: SourceChunk[]
  confidence?: number
  isError?: boolean
}

export type Conversation = {
  id: string
  /** Id assigned by the API on the first reply; null until then */
  serverId?: string | null
  title: string
  createdAt: string
  updatedAt: string
  messages: ChatMessage[]
}

export type AskRequest = {
  question: string
  /** Server-side conversation id, not the local one */
  conversation_id?: string | null
  files?: File[]
}

/** Raw citation as returned by POST /chat */
export type ApiCitation = {
  index: number
  chunk_id?: string | null
  source?: string | null
  title?: string | null
  section_title?: string | null
  page_start?: number | null
  page_end?: number | null
  similarity?: number | null
  content?: string | null
}

/** Raw body of POST /chat */
export type ChatApiResponse = {
  conversation_id: string
  question: string
  search_query: string
  answer: string
  citations: ApiCitation[]
  llm: string
  latency_ms: number
}

/** Normalised shape the UI consumes */
export type AskResponse = {
  answer: string
  sources: Array<{
    document_title: string
    section?: string
    page?: number
    chunk_text: string
    score?: number
  }>
  confidence?: number
  conversation_id?: string
  llm?: string
  searchQuery?: string
  latencyMs?: number
}

export type HealthResponse = {
  status: string
  embedding: string
  embedding_dimensions: number
  embedding_ready?: boolean
  embedding_error?: string | null
  embedding_mismatch?: string | null
  llm?: string
}

export type AppSettings = {
  apiBaseUrl: string
  /** True once the user edits the base URL by hand; until then the build-time env wins */
  apiBaseUrlEdited: boolean
  showSources: boolean
  showConfidence: boolean
  disclaimerAccepted: boolean
}

/** Admin document inventory */
export type DocumentStatus = 'ready' | 'processing' | 'failed'

export type AdminDocument = {
  id: string
  title: string
  fileName: string
  documentType: string
  academicLevel: string
  pages: number
  chunks: number
  status: DocumentStatus
  uploadedAt: string
  updatedAt: string
  sizeBytes: number
}

export type DashboardStats = {
  totalDocuments: number
  totalChunks: number
  totalPages: number
  questionsToday: number
  questionsWeek: number
  activeStudents: number
  conversations: number
  avgLatencyMs: number
  weakRetrievalRate: number
  systemStatus: 'ok' | 'degraded' | 'offline'
  questionsTrend: number[]
  topDocuments: Array<{ title: string; hits: number }>
  recentActivity: Array<{ id: string; label: string; at: string; tone: 'info' | 'success' | 'warn' }>
}

export type ReportQueryRow = {
  id: string
  askedAt: string
  studentEmail: string
  question: string
  status: 'answered' | 'weak' | 'error'
  latencyMs: number
  topSource: string
}

export type ReportDocumentRow = {
  id: string
  title: string
  documentType: string
  hits: number
  lastCitedAt: string
  status: DocumentStatus
}

export type Paginated<T> = {
  items: T[]
  total: number
  page: number
  pageSize: number
}

/** Allowed upload types for the chat composer */
export const ATTACHMENT_ACCEPT =
  '.pdf,.doc,.docx,.txt,.png,.jpg,.jpeg,.webp,application/pdf,image/png,image/jpeg,image/webp,text/plain'

export const ATTACHMENT_MAX_FILES = 5
export const ATTACHMENT_MAX_BYTES = 10 * 1024 * 1024 // 10 MB

export const ADMIN_DOC_ACCEPT = '.pdf,application/pdf'
