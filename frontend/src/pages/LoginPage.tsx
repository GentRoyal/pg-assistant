import { motion } from 'framer-motion'
import { useState, type FormEvent } from 'react'
import { Navigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { DEMO_AUTH } from '../lib/auth'
import { Button } from '../components/ui/Button'

export function LoginPage() {
  const { isAuthenticated, login } = useAuth()
  const [email, setEmail] = useState(DEMO_AUTH.email)
  const [password, setPassword] = useState(DEMO_AUTH.password)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  if (isAuthenticated) return <Navigate to="/" replace />

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
          <span className="font-semibold text-[var(--ui-navy)]">Demo auth layer</span> — local fake
          sign-in for UI demos. Swaps to real <code className="rounded bg-white px-1">POST /auth/login</code>{' '}
          when the backend is ready.
        </div>

        <h2 className="mt-5 text-lg font-semibold text-[var(--ui-navy)]">Sign in to continue</h2>
        <p className="mt-1 text-sm text-[var(--ui-muted)]">
          Access chat history and ask about postgraduate regulations.
        </p>

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

        <p className="mt-4 text-center text-xs text-[var(--ui-muted)]">
          Demo: <strong>{DEMO_AUTH.email}</strong> / <strong>{DEMO_AUTH.password}</strong>
        </p>
      </motion.div>
    </div>
  )
}
