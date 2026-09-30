import { motion } from 'framer-motion'
import { useState, type FormEvent } from 'react'
import { Navigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { ADMIN_DEMO, STUDENT_DEMO, homePathForRole } from '../lib/auth'
import { Button } from '../components/ui/Button'

export function LoginPage() {
  const { isAuthenticated, role, login } = useAuth()
  const [email, setEmail] = useState(STUDENT_DEMO.email)
  const [password, setPassword] = useState(STUDENT_DEMO.password)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  if (isAuthenticated && role) {
    return <Navigate to={homePathForRole(role)} replace />
  }

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setError(null)
    setLoading(true)
    try {
      await login(email, password)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Sign-in failed.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex min-h-dvh items-center justify-center bg-[var(--ui-canvas)] px-4 py-10">
      <motion.div
        className="w-full max-w-md rounded-3xl border border-[var(--ui-line)] bg-white p-7 shadow-sm sm:p-8"
        initial={{ opacity: 0, y: 14 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35 }}
      >
        <div className="flex items-center gap-3">
          <img src="/ui-logo.png" alt="" width={52} height={52} className="object-contain" />
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-[var(--ui-gold-deep)]">
              University of Ibadan
            </p>
            <h1 className="text-xl font-bold tracking-tight text-[var(--ui-navy)]">PG Assistant</h1>
          </div>
        </div>

        <div className="mt-5 rounded-xl border border-dashed border-[var(--ui-navy)]/25 bg-[var(--ui-soft)] px-3 py-2.5 text-xs text-[var(--ui-muted)]">
          <span className="font-semibold text-[var(--ui-navy)]">Role-based demo auth</span> — students
          open the chatbot; admins open the console. Real{' '}
          <code className="rounded bg-white px-1">POST /auth/login</code> will replace this when ready.
        </div>

        <h2 className="mt-5 text-lg font-semibold text-[var(--ui-navy)]">Sign in to continue</h2>
        <p className="mt-1 text-sm text-[var(--ui-muted)]">
          Choose a student or admin demo account below.
        </p>

        <div className="mt-4 grid grid-cols-2 gap-2">
          <button
            type="button"
            className="rounded-xl border border-[var(--ui-line)] bg-[var(--ui-soft)] px-3 py-2.5 text-left text-xs transition hover:border-[var(--ui-navy)]/30"
            onClick={() => {
              setEmail(STUDENT_DEMO.email)
              setPassword(STUDENT_DEMO.password)
            }}
          >
            <span className="block font-semibold text-[var(--ui-navy)]">Student</span>
            <span className="text-[var(--ui-muted)]">Chat assistant</span>
          </button>
          <button
            type="button"
            className="rounded-xl border border-[var(--ui-line)] bg-[var(--ui-soft)] px-3 py-2.5 text-left text-xs transition hover:border-[var(--ui-navy)]/30"
            onClick={() => {
              setEmail(ADMIN_DEMO.email)
              setPassword(ADMIN_DEMO.password)
            }}
          >
            <span className="block font-semibold text-[var(--ui-navy)]">Admin</span>
            <span className="text-[var(--ui-muted)]">Dashboard & docs</span>
          </button>
        </div>

        <form className="mt-5 space-y-4" onSubmit={onSubmit} noValidate>
          <div>
            <label htmlFor="email" className="mb-1.5 block text-sm font-semibold text-[var(--ui-navy)]">
              Email
            </label>
            <input
              id="email"
              type="email"
              autoComplete="username"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full rounded-xl border border-[var(--ui-line)] bg-[var(--ui-soft)] px-3 py-2.5 outline-none focus:border-[var(--ui-navy)]"
            />
          </div>
          <div>
            <label htmlFor="password" className="mb-1.5 block text-sm font-semibold text-[var(--ui-navy)]">
              Password
            </label>
            <input
              id="password"
              type="password"
              autoComplete="current-password"
              required
              minLength={6}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full rounded-xl border border-[var(--ui-line)] bg-[var(--ui-soft)] px-3 py-2.5 outline-none focus:border-[var(--ui-navy)]"
            />
          </div>

          {error ? (
            <p role="alert" className="text-sm text-[var(--ui-danger)]">
              {error}
            </p>
          ) : null}

          <Button type="submit" className="w-full !min-h-11" disabled={loading}>
            {loading ? 'Signing in…' : 'Sign in'}
          </Button>
        </form>

        <div className="mt-4 space-y-1 text-center text-xs text-[var(--ui-muted)]">
          <p>
            Student: <strong>{STUDENT_DEMO.email}</strong> / <strong>{STUDENT_DEMO.password}</strong>
          </p>
          <p>
            Admin: <strong>{ADMIN_DEMO.email}</strong> / <strong>{ADMIN_DEMO.password}</strong>
          </p>
        </div>
      </motion.div>
    </div>
  )
}
