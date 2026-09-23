export type User = {
  id: string
  name: string
  email: string
  role: 'student' | 'staff' | 'demo'
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

/** 'default' leaves the choice to the server's LLM_PROVIDER setting */
export type LlmProvider = 'default' | 'local' | 'gemini' | 'openai'

export const LLM_PROVIDERS: Array<{ value: LlmProvider; label: string; hint: string }> = [
  { value: 'default', label: 'Server default', hint: 'Whatever the API is configured with' },
  { value: 'local', label: 'Local (Ollama)', hint: 'Free, needs Ollama running' },
  { value: 'gemini', label: 'Gemini', hint: 'Free tier, needs a key on the server' },
  { value: 'openai', label: 'OpenAI', hint: 'Paid, needs a key on the server' },
]

export type AskRequest = {
  question: string
  /** Server-side conversation id, not the local one */
  conversation_id?: string | null
  files?: File[]
  llmProvider?: LlmProvider
  llmModel?: string
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

/** Normalised shape the UI consumes, whether it came from the API or the mock */
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
  llm_providers: string[]
}

export type AppSettings = {
  apiBaseUrl: string
  /** True once the user edits the base URL by hand; until then the build-time env wins */
  apiBaseUrlEdited: boolean
  useMockApi: boolean
  showSources: boolean
  showChunks: boolean
  showConfidence: boolean
  disclaimerAccepted: boolean
  llmProvider: LlmProvider
  llmModel: string
}

/** Allowed upload types for the chat composer */
export const ATTACHMENT_ACCEPT =
  '.pdf,.doc,.docx,.txt,.png,.jpg,.jpeg,.webp,application/pdf,image/png,image/jpeg,image/webp,text/plain'

export const ATTACHMENT_MAX_FILES = 5
export const ATTACHMENT_MAX_BYTES = 10 * 1024 * 1024 // 10 MB
