import type { AppSettings, AuthSession, Conversation } from '../types'

const KEYS = {
  settings: 'ui-ara.settings',
  sidebarOpen: 'ui-ara.sidebarOpenDesktop',
  auth: 'ui-ara.authSession',
} as const

function conversationKey(userId: string) {
  return `ui-ara.conversations.${userId}`
}

function activeIdKey(userId: string) {
  return `ui-ara.activeConversationId.${userId}`
}

export function loadAuthSession(): AuthSession | null {
  try {
    const raw = localStorage.getItem(KEYS.auth)
    if (!raw) return null
    const session = JSON.parse(raw) as AuthSession
    // Migrate older demo role → student
    if ((session.user as { role?: string }).role === 'demo') {
      session.user.role = 'student'
    }
    if ((session.user as { role?: string }).role === 'staff') {
      session.user.role = 'admin'
    }
    return session
  } catch {
    return null
  }
}

export function saveAuthSession(session: AuthSession | null) {
  if (!session) localStorage.removeItem(KEYS.auth)
  else localStorage.setItem(KEYS.auth, JSON.stringify(session))
}

export function loadDesktopSidebarOpen(): boolean {
  const raw = localStorage.getItem(KEYS.sidebarOpen)
  if (raw === null) return true
  return raw === 'true'
}

export function saveDesktopSidebarOpen(open: boolean) {
  localStorage.setItem(KEYS.sidebarOpen, String(open))
}

/** Per-student conversation store (prep for server sync). */
export function loadConversations(userId: string): Conversation[] {
  try {
    const raw = localStorage.getItem(conversationKey(userId))
    if (raw) return JSON.parse(raw) as Conversation[]

    // One-time migrate from legacy global key into this user's store
    const legacy = localStorage.getItem('ui-ara.conversations')
    if (legacy) {
      const parsed = JSON.parse(legacy) as Conversation[]
      saveConversations(userId, parsed)
      return parsed
    }
    return []
  } catch {
    return []
  }
}

export function saveConversations(userId: string, conversations: Conversation[]) {
  localStorage.setItem(conversationKey(userId), JSON.stringify(conversations))
}

export function loadActiveId(userId: string): string | null {
  return localStorage.getItem(activeIdKey(userId)) ?? localStorage.getItem('ui-ara.activeConversationId')
}

export function saveActiveId(userId: string, id: string | null) {
  const key = activeIdKey(userId)
  if (!id) localStorage.removeItem(key)
  else localStorage.setItem(key, id)
}

export function envApiBaseUrl() {
  return import.meta.env.VITE_API_BASE_URL?.replace(/\/$/, '') || 'http://localhost:8000'
}

export const defaultSettings = (): AppSettings => ({
  apiBaseUrl: envApiBaseUrl(),
  apiBaseUrlEdited: false,
  showSources: true,
  showConfidence: true,
  disclaimerAccepted: false,
})

export function loadSettings(): AppSettings {
  try {
    const raw = localStorage.getItem(KEYS.settings)
    if (!raw) return defaultSettings()

    const saved = JSON.parse(raw) as Partial<AppSettings>
    const merged = { ...defaultSettings(), ...saved }

    if (!saved.apiBaseUrlEdited) merged.apiBaseUrl = envApiBaseUrl()

    return merged
  } catch {
    return defaultSettings()
  }
}

export function saveSettings(settings: AppSettings) {
  localStorage.setItem(KEYS.settings, JSON.stringify(settings))
}
