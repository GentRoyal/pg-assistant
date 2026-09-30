import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import {
  askQuestion,
  ApiError,
  deleteAllConversationsRequest,
  deleteConversationRequest,
  fetchConversationMessages,
  listConversations,
  renameConversationRequest,
  type ServerConversation,
} from '../lib/api'
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

/**
 * The server holds each student's chats; this browser keeps a cached copy so
 * the list shows instantly. Chats not yet answered exist only here.
 */
function mergeWithServer(local: Conversation[], server: ServerConversation[]): Conversation[] {
  const cached = new Map(local.filter((c) => c.serverId).map((c) => [c.serverId, c]))
  const fromServer = server.map((s): Conversation => {
    const hit = cached.get(s.id)
    if (hit) return { ...hit, title: s.title || hit.title, updatedAt: s.updated_at }
    return {
      id: s.id,
      serverId: s.id,
      title: s.title || 'Untitled chat',
      createdAt: s.created_at,
      updatedAt: s.updated_at,
      messages: [],
    }
  })
  return [...local.filter((c) => !c.serverId), ...fromServer]
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

  const apiBaseUrl = settings.apiBaseUrl
  const serverOptions = useMemo(() => ({ apiBaseUrl, token: token ?? undefined }), [apiBaseUrl, token])

  const updateConversations = useCallback(
    (update: (list: Conversation[]) => Conversation[]) => {
      setConversations((list) => {
        const next = update(list)
        saveConversations(userId, next)
        return next
      })
    },
    [userId],
  )

  const loadMessages = useCallback(
    async (serverId: string) => {
      try {
        const messages = await fetchConversationMessages(serverId, serverOptions)
        updateConversations((list) =>
          list.map((c) =>
            c.serverId === serverId
              ? {
                  ...c,
                  messages: messages.map(
                    (m): ChatMessage => ({
                      ...m,
                      id: uid(),
                      sources: m.sources ? mapSources(m.sources) : undefined,
                    }),
                  ),
                }
              : c,
          ),
        )
      } catch (err) {
        console.error('Could not load the chat:', err)
      }
    },
    [serverOptions, updateConversations],
  )

  // Fetch the chat list from the server, so it follows the student to any device
  useEffect(() => {
    if (!token) return
    let cancelled = false
    listConversations(serverOptions)
      .then((server) => {
        if (cancelled) return
        const merged = mergeWithServer(loadConversations(userId), server)
        setConversations(merged)
        saveConversations(userId, merged)

        const active = merged.find((c) => c.id === loadActiveId(userId))
        if (active?.serverId && active.messages.length === 0) void loadMessages(active.serverId)
      })
      .catch((err) => console.error('Could not load chats:', err))
    return () => {
      cancelled = true
    }
  }, [loadMessages, serverOptions, token, userId])

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
      const conversation = conversations.find((c) => c.id === id)
      if (!conversation) return
      setActiveId(id)
      saveActiveId(userId, id)
      // Refresh from the server: the chat may have continued on another device
      if (conversation.serverId && !isSending) void loadMessages(conversation.serverId)
    },
    [conversations, isSending, loadMessages, userId],
  )

  const deleteConversation = useCallback(
    (id: string) => {
      const serverId = conversations.find((c) => c.id === id)?.serverId
      const next = conversations.filter((c) => c.id !== id)
      const nextActive = activeId === id ? (next[0]?.id ?? null) : activeId
      persist(next, nextActive)
      if (serverId) {
        deleteConversationRequest(serverId, serverOptions).catch((err) =>
          console.error('Could not delete the chat on the server:', err),
        )
      }
    },
    [activeId, conversations, persist, serverOptions],
  )

  const renameConversation = useCallback(
    (id: string, title: string) => {
      const trimmed = title.trim().replace(/\s+/g, ' ')
      const conversation = conversations.find((c) => c.id === id)
      if (!conversation || !trimmed || trimmed === conversation.title) return

      persist(
        conversations.map((c) => (c.id === id ? { ...c, title: trimmed } : c)),
        activeId,
      )
      if (conversation.serverId) {
        renameConversationRequest(conversation.serverId, trimmed, serverOptions).catch((err) =>
          console.error('Could not rename the chat on the server:', err),
        )
      }
    },
    [activeId, conversations, persist, serverOptions],
  )

  const clearAll = useCallback(() => {
    persist([], null)
    if (token) {
      deleteAllConversationsRequest(serverOptions).catch((err) =>
        console.error('Could not clear chats on the server:', err),
      )
    }
  }, [persist, serverOptions, token])

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
