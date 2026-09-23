import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import { loginRequest } from '../lib/auth'
import { loadAuthSession, saveAuthSession } from '../lib/storage'
import type { AuthSession, User } from '../types'
import { useSettings } from './SettingsContext'

type AuthContextValue = {
  user: User | null
  token: string | null
  isAuthenticated: boolean
  login: (email: string, password: string) => Promise<void>
  logout: () => void
}

const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const { settings } = useSettings()
  const [session, setSession] = useState<AuthSession | null>(() => loadAuthSession())

  const login = useCallback(
    async (email: string, password: string) => {
      const next = await loginRequest(email, password, settings.apiBaseUrl)
      setSession(next)
      saveAuthSession(next)
    },
    [settings.apiBaseUrl],
  )

  const logout = useCallback(() => {
    setSession(null)
    saveAuthSession(null)
  }, [])

  const value = useMemo(
    () => ({
      user: session?.user ?? null,
      token: session?.token ?? null,
      isAuthenticated: Boolean(session?.token),
      login,
      logout,
    }),
    [session, login, logout],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
