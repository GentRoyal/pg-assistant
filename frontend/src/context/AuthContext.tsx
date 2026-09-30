import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import { SESSION_EXPIRED_EVENT } from '../lib/api'
import { loginRequest, logoutRequest, registerRequest } from '../lib/auth'
import { loadAuthSession, saveAuthSession } from '../lib/storage'
import type { AuthSession, User, UserRole } from '../types'
import { useSettings } from './SettingsContext'

type AuthContextValue = {
  user: User | null
  token: string | null
  isAuthenticated: boolean
  isAdmin: boolean
  isStudent: boolean
  role: UserRole | null
  login: (email: string, password: string) => Promise<User>
  register: (name: string, email: string, password: string) => Promise<User>
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
      return next.user
    },
    [settings.apiBaseUrl],
  )

  const register = useCallback(
    async (name: string, email: string, password: string) => {
      const next = await registerRequest(name, email, password, settings.apiBaseUrl)
      setSession(next)
      saveAuthSession(next)
      return next.user
    },
    [settings.apiBaseUrl],
  )

  const logout = useCallback(() => {
    if (session?.token) void logoutRequest(session.token, settings.apiBaseUrl)
    setSession(null)
    saveAuthSession(null)
  }, [session, settings.apiBaseUrl])

  // The API rejected the token (expired or revoked): drop it so the app returns to sign-in.
  useEffect(() => {
    const expire = () => {
      setSession(null)
      saveAuthSession(null)
    }
    window.addEventListener(SESSION_EXPIRED_EVENT, expire)
    return () => window.removeEventListener(SESSION_EXPIRED_EVENT, expire)
  }, [])

  const value = useMemo(
    () => ({
      user: session?.user ?? null,
      token: session?.token ?? null,
      isAuthenticated: Boolean(session?.token),
      isAdmin: session?.user.role === 'admin',
      isStudent: session?.user.role === 'student',
      role: session?.user.role ?? null,
      login,
      register,
      logout,
    }),
    [session, login, register, logout],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
