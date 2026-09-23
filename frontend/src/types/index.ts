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
