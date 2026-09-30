import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import { askQuestion, ApiError } from '../lib/api'
import {
  loadActiveId,
  loadConversations,
  saveActiveId,
  saveConversations,
} from '../lib/storage'
import type { ChatMessage, Conversation, MessageAttachment, SourceChunk } from '../types'
import { useAuth } from './AuthContext'
import { useSettings } from './SettingsContext'

function uid() {
  return crypto.randomUUID()
}

function titleFromQuestion(q: string, files: File[]) {
  const t = q.trim().replace(/\s+/g, ' ')
  if (t) return t.length > 42 ? `${t.slice(0, 42)}…` : t
  if (files[0]) return `Attachment: ${files[0].name}`
  return 'New chat'
}

function toMessageAttachments(files: File[]): MessageAttachment[] {
  return files.map((f) => ({
    id: uid(),
    name: f.name,
    size: f.size,
    type: f.type || 'application/octet-stream',
  }))
}

const UNAVAILABLE_REPLY =
  'The assistant is unavailable at the moment. Please try again in a little while.'

function friendlyError(err: unknown) {
  if (typeof navigator !== 'undefined' && !navigator.onLine) {
    return 'You appear to be offline. Check your internet connection and try again.'
  }
  if (!(err instanceof ApiError)) return UNAVAILABLE_REPLY
  if (err.status === 401) return 'Your session has ended. Please sign in again.'
  if (err.status === 400 || err.status === 429) return err.message
  if (err.status === 422) return 'That question is too long. Please shorten it and try again.'
  return UNAVAILABLE_REPLY
}

function mapSources(
  sources: Array<{
    document_title: string
    section?: string
    page?: number
    chunk_text: string
    score?: number
  }>,
): SourceChunk[] {
  return sources.map((s) => ({
    id: uid(),
    documentTitle: s.document_title,
    section: s.section,
    page: s.page,
    chunkText: s.chunk_text,
    score: s.score,
  }))
}

type ChatContextValue = {
  conversations: Conversation[]
  activeConversation: Conversation | null
  isSending: boolean
  createConversation: () => void
  selectConversation: (id: string) => void
  deleteConversation: (id: string) => void
  renameConversation: (id: string, title: string) => void
  sendMessage: (question: string, files?: File[]) => Promise<void>
  clearAll: () => void
}

const ChatContext = createContext<ChatContextValue | null>(null)

export function ChatProvider({ children }: { children: ReactNode }) {
  const { token, user } = useAuth()
  const userId = user?.id ?? 'anonymous'
  const { settings } = useSettings()
  const [conversations, setConversations] = useState<Conversation[]>(() => loadConversations(userId))
  const [activeId, setActiveId] = useState<string | null>(() => loadActiveId(userId))
  const [isSending, setIsSending] = useState(false)

  // Reload this student's chats when the signed-in user changes
  useEffect(() => {
    setConversations(loadConversations(userId))
    setActiveId(loadActiveId(userId))
    setIsSending(false)
  }, [userId])

  const persist = useCallback(
    (next: Conversation[], nextActive: string | null) => {
      setConversations(next)
      setActiveId(nextActive)
      saveConversations(userId, next)
      saveActiveId(userId, nextActive)
    },
    [userId],
  )

  const createConversation = useCallback(() => {
    const now = new Date().toISOString()
    const conversation: Conversation = {
      id: uid(),
      serverId: null,
      title: 'New chat',
      createdAt: now,
      updatedAt: now,
      messages: [],
    }
    persist([conversation, ...conversations], conversation.id)
  }, [conversations, persist])

  const selectConversation = useCallback(
    (id: string) => {
      if (conversations.some((c) => c.id === id)) {
        setActiveId(id)
        saveActiveId(userId, id)
      }
    },
    [conversations, userId],
  )

  const deleteConversation = useCallback(
    (id: string) => {
      const next = conversations.filter((c) => c.id !== id)
      const nextActive = activeId === id ? (next[0]?.id ?? null) : activeId
      persist(next, nextActive)
    },
    [activeId, conversations, persist],
  )

  const renameConversation = useCallback(
    (id: string, title: string) => {
      const next = conversations.map((c) =>
        c.id === id ? { ...c, title: title.trim() || c.title, updatedAt: new Date().toISOString() } : c,
      )
      persist(next, activeId)
    },
    [activeId, conversations, persist],
  )

  const clearAll = useCallback(() => {
    persist([], null)
  }, [persist])

  const sendMessage = useCallback(
    async (question: string, files: File[] = []) => {
      const trimmed = question.trim()
      if ((!trimmed && files.length === 0) || isSending) return

      let list = conversations
      let currentId = activeId

      if (!currentId) {
        const now = new Date().toISOString()
        const created: Conversation = {
          id: uid(),
          serverId: null,
          title: titleFromQuestion(trimmed, files),
          createdAt: now,
          updatedAt: now,
          messages: [],
        }
        list = [created, ...list]
        currentId = created.id
      }

      const attachments = toMessageAttachments(files)
      const userMsg: ChatMessage = {
        id: uid(),
        role: 'user',
        content: trimmed || (files.length ? 'Please review the attached file(s).' : ''),
        createdAt: new Date().toISOString(),
        attachments: attachments.length ? attachments : undefined,
      }

      list = list.map((c) => {
        if (c.id !== currentId) return c
        const isFirst = c.messages.length === 0
        return {
          ...c,
          title: isFirst ? titleFromQuestion(trimmed, files) : c.title,
          updatedAt: new Date().toISOString(),
          messages: [...c.messages, userMsg],
        }
      })

      persist(list, currentId)
      setIsSending(true)

      const serverId = list.find((c) => c.id === currentId)?.serverId ?? null

      try {
        const data = await askQuestion(
          {
            question: trimmed || 'Please review the attached file(s) in light of UI academic regulations.',
            conversation_id: serverId,
            files,
          },
          {
            apiBaseUrl: settings.apiBaseUrl,
            token: token ?? undefined,
          },
        )

        const assistantMsg: ChatMessage = {
          id: uid(),
          role: 'assistant',
          content: data.answer,
          createdAt: new Date().toISOString(),
          sources: mapSources(data.sources ?? []),
          confidence: data.confidence,
        }

        const next = list.map((c) =>
          c.id === currentId
            ? {
                ...c,
                serverId: data.conversation_id ?? c.serverId ?? null,
                updatedAt: new Date().toISOString(),
                messages: [...c.messages, assistantMsg],
              }
            : c,
        )
        persist(next, currentId)
      } catch (err) {
        console.error('Chat request failed:', err)
        const message = friendlyError(err)
        const errorMsg: ChatMessage = {
          id: uid(),
          role: 'assistant',
          content: message,
          createdAt: new Date().toISOString(),
          isError: true,
        }
        const next = list.map((c) =>
          c.id === currentId
            ? {
                ...c,
                updatedAt: new Date().toISOString(),
                messages: [...c.messages, errorMsg],
              }
            : c,
        )
        persist(next, currentId)
      } finally {
        setIsSending(false)
      }
    },
    [activeId, conversations, isSending, persist, settings.apiBaseUrl, token],
  )

  const activeConversation = useMemo(
    () => conversations.find((c) => c.id === activeId) ?? null,
    [activeId, conversations],
  )

  const value = useMemo(
    () => ({
      conversations,
      activeConversation,
      isSending,
      createConversation,
      selectConversation,
      deleteConversation,
      renameConversation,
      sendMessage,
      clearAll,
    }),
    [
      conversations,
      activeConversation,
      isSending,
      createConversation,
      selectConversation,
      deleteConversation,
      renameConversation,
      sendMessage,
      clearAll,
    ],
  )

  return <ChatContext.Provider value={value}>{children}</ChatContext.Provider>
}

export function useChat() {
  const ctx = useContext(ChatContext)
  if (!ctx) throw new Error('useChat must be used within ChatProvider')
  return ctx
}
