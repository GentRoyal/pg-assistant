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
  title: string
  createdAt: string
  updatedAt: string
  messages: ChatMessage[]
}

export type AskRequest = {
  question: string
  conversation_id?: string
  files?: File[]
}

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
}

export type AppSettings = {
  apiBaseUrl: string
  useMockApi: boolean
  showSources: boolean
  showChunks: boolean
  showConfidence: boolean
  disclaimerAccepted: boolean
}

/** Allowed upload types for the chat composer */
export const ATTACHMENT_ACCEPT =
  '.pdf,.doc,.docx,.txt,.png,.jpg,.jpeg,.webp,application/pdf,image/png,image/jpeg,image/webp,text/plain'

export const ATTACHMENT_MAX_FILES = 5
export const ATTACHMENT_MAX_BYTES = 10 * 1024 * 1024 // 10 MB
