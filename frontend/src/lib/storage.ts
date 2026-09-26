import type { AppSettings, AuthSession, Conversation } from '../types'

const KEYS = {
  conversations: 'ui-ara.conversations',
  settings: 'ui-ara.settings',
  activeId: 'ui-ara.activeConversationId',
  sidebarOpen: 'ui-ara.sidebarOpenDesktop',
  auth: 'ui-ara.authSession',
} as const

export function loadAuthSession(): AuthSession | null {
  try {
    const raw = localStorage.getItem(KEYS.auth)
    return raw ? (JSON.parse(raw) as AuthSession) : null
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

export function loadConversations(): Conversation[] {
  try {
    const raw = localStorage.getItem(KEYS.conversations)
    return raw ? (JSON.parse(raw) as Conversation[]) : []
  } catch {
    return []
  }
}

export function saveConversations(conversations: Conversation[]) {
  localStorage.setItem(KEYS.conversations, JSON.stringify(conversations))
}

export function loadActiveId(): string | null {
  return localStorage.getItem(KEYS.activeId)
}

export function saveActiveId(id: string | null) {
  if (!id) localStorage.removeItem(KEYS.activeId)
  else localStorage.setItem(KEYS.activeId, id)
}

export function envApiBaseUrl() {
  return import.meta.env.VITE_API_BASE_URL?.replace(/\/$/, '') || 'http://localhost:8000'
}

export const defaultSettings = (): AppSettings => ({
  apiBaseUrl: envApiBaseUrl(),
  apiBaseUrlEdited: false,
  showSources: true,
  showChunks: true,
  showConfidence: true,
  disclaimerAccepted: false,
  llmProvider: 'default',
  llmModel: '',
})

export function loadSettings(): AppSettings {
  try {
    const raw = localStorage.getItem(KEYS.settings)
    if (!raw) return defaultSettings()

    const saved = JSON.parse(raw) as Partial<AppSettings>
    const merged = { ...defaultSettings(), ...saved }

    // A redeploy must be able to change the API URL. Without this, a value
    // cached in the browser from an earlier build wins forever.
    if (!saved.apiBaseUrlEdited) merged.apiBaseUrl = envApiBaseUrl()

    return merged
  } catch {
    return defaultSettings()
  }
}

export function saveSettings(settings: AppSettings) {
  localStorage.setItem(KEYS.settings, JSON.stringify(settings))
}
