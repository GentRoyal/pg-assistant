import type { AuthSession, User } from '../types'
import { resolveApiBase, ApiError } from './api'

/** Demo credentials for the fake auth layer (until backend /auth is live). */
export const DEMO_AUTH = {
  email: 'student@ui.edu.ng',
  password: 'demo1234',
  user: {
    id: 'demo-student-001',
    name: 'Demo Student',
    email: 'student@ui.edu.ng',
    role: 'demo' as const,
  },
}

function fakeToken() {
  return `demo.${btoa(`${Date.now()}.${crypto.randomUUID()}`)}.pg-assistant`
}

function nameFromEmail(email: string) {
  const local = email.split('@')[0] ?? 'Student'
  return local
    .replace(/[._-]+/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase())
}

/**
 * Fake auth layer:
 * 1) Tries real `POST /auth/login` if the backend is up
 * 2) Falls back to local demo auth so the UI can showcase gated access
 */
export async function loginRequest(
  email: string,
  password: string,
  apiBaseUrl?: string,
): Promise<AuthSession> {
  const trimmedEmail = email.trim().toLowerCase()
  const trimmedPassword = password

  if (!trimmedEmail.includes('@') || trimmedPassword.length < 6) {
    throw new ApiError('Use a valid email and a password with at least 6 characters.', 400)
  }

  // Attempt real backend first (for when teammate ships auth)
  try {
    const base = resolveApiBase(apiBaseUrl)
    const res = await fetch(`${base}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: trimmedEmail, password: trimmedPassword }),
    })
    if (res.ok) {
      const data = (await res.json()) as { token: string; user: User }
      return { token: data.token, user: data.user }
    }
  } catch {
    // Backend unreachable — continue with demo auth
  }

  // Fake auth: accept demo pair, or any plausible student email
  const isDemoPair =
    trimmedEmail === DEMO_AUTH.email && trimmedPassword === DEMO_AUTH.password
  const looksLikeUiMail = trimmedEmail.endsWith('@ui.edu.ng') || trimmedEmail.includes('@')

  if (!isDemoPair && !looksLikeUiMail) {
    throw new ApiError('Sign-in failed. Try the demo account or a valid email.', 401)
  }

  await new Promise((r) => setTimeout(r, 450))

  const user: User = isDemoPair
    ? DEMO_AUTH.user
    : {
        id: crypto.randomUUID(),
        name: nameFromEmail(trimmedEmail),
        email: trimmedEmail,
        role: 'student',
      }

  return {
    token: fakeToken(),
    user,
  }
}
