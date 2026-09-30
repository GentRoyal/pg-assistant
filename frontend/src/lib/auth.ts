import type { AuthSession, User, UserRole } from '../types'
import { resolveApiBase, ApiError } from './api'

function normalizeRole(role: unknown): UserRole {
  if (role === 'admin' || role === 'staff') return 'admin'
  return 'student'
}

async function readDetail(res: Response, fallback: string) {
  try {
    const body = (await res.json()) as { detail?: unknown }
    if (typeof body.detail === 'string') return body.detail
  } catch {
    /* not JSON */
  }
  return fallback
}

async function authRequest(path: string, body: unknown, apiBaseUrl?: string): Promise<AuthSession> {
  const base = resolveApiBase(apiBaseUrl)
  let res: Response
  try {
    res = await fetch(`${base}${path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
  } catch {
    throw new ApiError('Could not reach the server. Check your connection and try again.', 0)
  }

  if (!res.ok) {
    const fallback =
      res.status === 429
        ? 'Too many attempts. Please wait a minute and try again.'
        : 'Sign-in failed. Please try again.'
    throw new ApiError(await readDetail(res, fallback), res.status)
  }

  const data = (await res.json()) as { token: string; user: User }
  return { token: data.token, user: { ...data.user, role: normalizeRole(data.user.role) } }
}

export async function loginRequest(
  email: string,
  password: string,
  apiBaseUrl?: string,
): Promise<AuthSession> {
  const trimmedEmail = email.trim().toLowerCase()
  if (!trimmedEmail.includes('@') || !password) {
    throw new ApiError('Enter your email and password.', 400)
  }
  return authRequest('/auth/login', { email: trimmedEmail, password }, apiBaseUrl)
}

/** Students sign themselves up; admin accounts are created on the server. */
export async function registerRequest(
  name: string,
  email: string,
  password: string,
  apiBaseUrl?: string,
): Promise<AuthSession> {
  const trimmedName = name.trim()
  const trimmedEmail = email.trim().toLowerCase()

  if (trimmedName.length < 2) {
    throw new ApiError('Please enter your full name.', 400)
  }
  if (!trimmedEmail.includes('@') || password.length < 8) {
    throw new ApiError('Use a valid email and a password with at least 8 characters.', 400)
  }
  return authRequest(
    '/auth/register',
    { name: trimmedName, email: trimmedEmail, password },
    apiBaseUrl,
  )
}

/** Ends the session on the server too; the local session is cleared either way. */
export async function logoutRequest(token: string, apiBaseUrl?: string) {
  try {
    await fetch(`${resolveApiBase(apiBaseUrl)}/auth/logout`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
    })
  } catch {
    /* offline: the token simply expires */
  }
}

export function homePathForRole(role: UserRole) {
  return role === 'admin' ? '/admin' : '/'
}
