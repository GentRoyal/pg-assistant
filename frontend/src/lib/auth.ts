import type { AuthSession, User, UserRole } from '../types'
import { resolveApiBase, ApiError } from './api'

export const STUDENT_DEMO = {
  email: 'student@ui.edu.ng',
  password: 'demo1234',
  user: {
    id: 'demo-student-001',
    name: 'Demo Student',
    email: 'student@ui.edu.ng',
    role: 'student' as const,
  },
}

export const ADMIN_DEMO = {
  email: 'admin@ui.edu.ng',
  password: 'admin1234',
  user: {
    id: 'demo-admin-001',
    name: 'Demo Admin',
    email: 'admin@ui.edu.ng',
    role: 'admin' as const,
  },
}

/** @deprecated use STUDENT_DEMO — kept for older copy */
export const DEMO_AUTH = STUDENT_DEMO

function fakeToken(role: UserRole) {
  return `demo.${role}.${btoa(`${Date.now()}.${crypto.randomUUID()}`)}.pg-assistant`
}

function nameFromEmail(email: string) {
  const local = email.split('@')[0] ?? 'Student'
  return local
    .replace(/[._-]+/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase())
}

function normalizeRole(role: unknown): UserRole {
  if (role === 'admin' || role === 'staff') return 'admin'
  return 'student'
}

/**
 * Auth layer:
 * 1) Tries real `POST /auth/login` if the backend is up
 * 2) Falls back to local demo auth (student + admin) for Phase A demos
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

  try {
    const base = resolveApiBase(apiBaseUrl)
    const res = await fetch(`${base}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: trimmedEmail, password: trimmedPassword }),
    })
    if (res.ok) {
      const data = (await res.json()) as { token: string; user: User }
      return {
        token: data.token,
        user: { ...data.user, role: normalizeRole(data.user.role) },
      }
    }
  } catch {
    // Backend unreachable — continue with demo auth
  }

  const isStudent =
    trimmedEmail === STUDENT_DEMO.email && trimmedPassword === STUDENT_DEMO.password
  const isAdmin = trimmedEmail === ADMIN_DEMO.email && trimmedPassword === ADMIN_DEMO.password

  if (!isStudent && !isAdmin) {
    if (!trimmedEmail.includes('@')) {
      throw new ApiError('Sign-in failed. Check your email and password.', 401)
    }
    await new Promise((r) => setTimeout(r, 400))
    const user: User = {
      id: crypto.randomUUID(),
      name: nameFromEmail(trimmedEmail),
      email: trimmedEmail,
      role: 'student',
    }
    return { token: fakeToken('student'), user }
  }

  await new Promise((r) => setTimeout(r, 450))
  const user = isAdmin ? ADMIN_DEMO.user : STUDENT_DEMO.user
  return { token: fakeToken(user.role), user }
}

/**
 * Student registration:
 * 1) Tries `POST /auth/register` when available
 * 2) Falls back to a local student session
 */
export async function registerRequest(
  name: string,
  email: string,
  password: string,
  apiBaseUrl?: string,
): Promise<AuthSession> {
  const trimmedName = name.trim()
  const trimmedEmail = email.trim().toLowerCase()
  const trimmedPassword = password

  if (trimmedName.length < 2) {
    throw new ApiError('Please enter your full name.', 400)
  }
  if (!trimmedEmail.includes('@') || trimmedPassword.length < 6) {
    throw new ApiError('Use a valid email and a password with at least 6 characters.', 400)
  }
  if (
    trimmedEmail === ADMIN_DEMO.email ||
    trimmedEmail === STUDENT_DEMO.email
  ) {
    throw new ApiError('That email is already in use. Sign in instead.', 409)
  }

  try {
    const base = resolveApiBase(apiBaseUrl)
    const res = await fetch(`${base}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: trimmedName,
        email: trimmedEmail,
        password: trimmedPassword,
      }),
    })
    if (res.ok) {
      const data = (await res.json()) as { token: string; user: User }
      return {
        token: data.token,
        user: { ...data.user, role: normalizeRole(data.user.role) },
      }
    }
    if (res.status === 409) {
      throw new ApiError('That email is already in use. Sign in instead.', 409)
    }
  } catch (err) {
    if (err instanceof ApiError) throw err
    // Backend unreachable — local student account
  }

  await new Promise((r) => setTimeout(r, 450))
  const user: User = {
    id: crypto.randomUUID(),
    name: trimmedName,
    email: trimmedEmail,
    role: 'student',
  }
  return { token: fakeToken('student'), user }
}

export function homePathForRole(role: UserRole) {
  return role === 'admin' ? '/admin' : '/'
}
