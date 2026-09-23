import type { AppSettings, Conversation } from '../types'

const KEYS = {
  conversations: 'ui-ara.conversations',
  settings: 'ui-ara.settings',
  activeId: 'ui-ara.activeConversationId',
} as const

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

export const defaultSettings = (): AppSettings => ({
  apiBaseUrl: import.meta.env.VITE_API_BASE_URL?.replace(/\/$/, '') || 'http://localhost:8000',
  useMockApi: String(import.meta.env.VITE_USE_MOCK_API ?? 'true') === 'true',
  showSources: true,
  showChunks: true,
  showConfidence: true,
  disclaimerAccepted: false,
})

export function loadSettings(): AppSettings {
  try {
    const raw = localStorage.getItem(KEYS.settings)
    if (!raw) return defaultSettings()
    return { ...defaultSettings(), ...(JSON.parse(raw) as Partial<AppSettings>) }
  } catch {
    return defaultSettings()
  }
}

export function saveSettings(settings: AppSettings) {
  localStorage.setItem(KEYS.settings, JSON.stringify(settings))
}
