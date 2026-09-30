import { motion } from 'framer-motion'
import { useState, type FormEvent } from 'react'
import { Link, Navigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { homePathForRole } from '../lib/auth'
import { Button } from '../components/ui/Button'

export function SignUpPage() {
  const { isAuthenticated, role, register } = useAuth()
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  if (isAuthenticated && role) {
    return <Navigate to={homePathForRole(role)} replace />
  }

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setError(null)

    if (name.trim().length < 2) {
      setError('Please enter your full name.')
      return
    }
    if (password !== confirm) {
      setError('Passwords do not match.')
      return
    }

    setLoading(true)
    try {
      await register(name.trim(), email, password)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not create account.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex min-h-dvh items-center justify-center overflow-y-auto bg-[radial-gradient(ellipse_at_top,_#e8eef8_0%,_var(--ui-canvas)_55%)] px-4 py-10">
      <motion.div
        className="w-full max-w-md rounded-3xl border border-[var(--ui-line)] bg-white p-7 shadow-sm sm:p-8"
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
      >
        <div className="flex flex-col items-center text-center">
          <img src="/ui-logo.png" alt="" width={56} height={56} className="object-contain" />
          <p className="mt-3 text-[10px] font-semibold uppercase tracking-[0.14em] text-[var(--ui-gold-deep)]">
            University of Ibadan
          </p>
          <h1 className="mt-1 text-2xl font-bold tracking-tight text-[var(--ui-navy)]">
            PG Assistant
          </h1>
          <p className="mt-2 text-sm text-[var(--ui-muted)]">Create your student account</p>
        </div>

        <form className="mt-7 space-y-4" onSubmit={onSubmit} noValidate>
          <div>
            <label htmlFor="name" className="mb-1.5 block text-sm font-semibold text-[var(--ui-navy)]">
              Full name
            </label>
            <input
              id="name"
              type="text"
              autoComplete="name"
              required
              placeholder="Your name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full rounded-xl border border-[var(--ui-line)] bg-[var(--ui-soft)] px-3 py-2.5 outline-none placeholder:text-[var(--ui-muted)]/70 focus:border-[var(--ui-navy)]"
            />
          </div>
          <div>
            <label htmlFor="email" className="mb-1.5 block text-sm font-semibold text-[var(--ui-navy)]">
              Email
            </label>
            <input
              id="email"
              type="email"
              autoComplete="email"
              required
              placeholder="you@ui.edu.ng"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full rounded-xl border border-[var(--ui-line)] bg-[var(--ui-soft)] px-3 py-2.5 outline-none placeholder:text-[var(--ui-muted)]/70 focus:border-[var(--ui-navy)]"
            />
          </div>
          <div>
            <label
              htmlFor="password"
              className="mb-1.5 block text-sm font-semibold text-[var(--ui-navy)]"
            >
              Password
            </label>
            <input
              id="password"
              type="password"
              autoComplete="new-password"
              required
              minLength={8}
              placeholder="At least 8 characters"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full rounded-xl border border-[var(--ui-line)] bg-[var(--ui-soft)] px-3 py-2.5 outline-none placeholder:text-[var(--ui-muted)]/70 focus:border-[var(--ui-navy)]"
            />
          </div>
          <div>
            <label
              htmlFor="confirm"
              className="mb-1.5 block text-sm font-semibold text-[var(--ui-navy)]"
            >
              Confirm password
            </label>
            <input
              id="confirm"
              type="password"
              autoComplete="new-password"
              required
              minLength={8}
              placeholder="Re-enter password"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              className="w-full rounded-xl border border-[var(--ui-line)] bg-[var(--ui-soft)] px-3 py-2.5 outline-none placeholder:text-[var(--ui-muted)]/70 focus:border-[var(--ui-navy)]"
            />
          </div>

          {error ? (
            <p role="alert" className="text-sm text-[var(--ui-danger)]">
              {error}
            </p>
          ) : null}

          <Button type="submit" className="w-full !min-h-11" disabled={loading}>
            {loading ? 'Creating account…' : 'Create account'}
          </Button>
        </form>

        <p className="mt-6 text-center text-sm text-[var(--ui-muted)]">
          Already have an account?{' '}
          <Link
            to="/login"
            className="font-semibold text-[var(--ui-navy)] underline-offset-2 hover:underline"
          >
            Sign in
          </Link>
        </p>
      </motion.div>
    </div>
  )
}
