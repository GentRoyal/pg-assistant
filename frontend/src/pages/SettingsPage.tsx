import { ArrowLeft } from 'lucide-react'
import { NavLink } from 'react-router-dom'
import { Button } from '../components/ui/Button'
import { useAuth } from '../context/AuthContext'
import { useChat } from '../context/ChatContext'
import { useSettings } from '../context/SettingsContext'
import { Modal } from '../components/ui/Modal'
import { useState } from 'react'
import { UiLogo } from '../components/brand/UiLogo'
import { DEMO_AUTH } from '../lib/auth'

export function SettingsPage() {
  const { settings, updateSettings, resetSettings } = useSettings()
  const { user, logout } = useAuth()
  const { clearAll } = useChat()
  const [confirmClear, setConfirmClear] = useState(false)

  return (
    <div className="h-dvh overflow-y-auto bg-[var(--ui-canvas)]">
      <div
        className="mx-auto w-full max-w-2xl px-4 py-8"
        style={{
          paddingTop: 'max(2rem, env(safe-area-inset-top))',
          paddingBottom: 'max(2rem, env(safe-area-inset-bottom))',
        }}
      >
        <NavLink
          to="/"
          className="inline-flex items-center gap-2 text-sm font-semibold text-[var(--ui-navy)]"
        >
          <ArrowLeft size={16} aria-hidden />
          Back to chat
        </NavLink>

        <div className="mt-6 flex items-center gap-3">
          <UiLogo size={48} />
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-[var(--ui-navy)]">Settings</h1>
            <p className="text-sm text-[var(--ui-muted)]">Display, sources, and API connection</p>
          </div>
        </div>

        <section className="mt-8 space-y-3 rounded-2xl border border-[var(--ui-line)] bg-white p-5 shadow-sm">
          <h2 className="text-base font-semibold text-[var(--ui-navy)]">Account (demo auth)</h2>
          <p className="text-sm text-[var(--ui-ink)]">
            {user?.name} · {user?.email}
          </p>
          <p className="text-xs text-[var(--ui-muted)]">
            Fake auth is active for demos. When backend ships{' '}
            <code className="rounded bg-[var(--ui-soft)] px-1">POST /auth/login</code>, the UI will
            prefer that response. Demo pair: {DEMO_AUTH.email} / {DEMO_AUTH.password}
          </p>
          <Button variant="secondary" onClick={logout}>
            Sign out
          </Button>
        </section>

        <section className="mt-4 space-y-4 rounded-2xl border border-[var(--ui-line)] bg-white p-5 shadow-sm">
          <h2 className="text-base font-semibold text-[var(--ui-navy)]">Answer extras</h2>
          {(
            [
              ['showSources', 'Show source citations'],
              ['showChunks', 'Show retrieved chunk text'],
              ['showConfidence', 'Show confidence / match strength'],
            ] as const
          ).map(([key, label]) => (
            <label key={key} className="flex cursor-pointer items-center justify-between gap-4 text-sm">
              <span>{label}</span>
              <input
                type="checkbox"
                className="size-4 accent-[var(--ui-navy)]"
                checked={settings[key]}
                onChange={(e) => updateSettings({ [key]: e.target.checked })}
              />
            </label>
          ))}
        </section>

        <section className="mt-4 space-y-4 rounded-2xl border border-[var(--ui-line)] bg-white p-5 shadow-sm">
          <h2 className="text-base font-semibold text-[var(--ui-navy)]">API connection</h2>
          <label className="block text-sm">
            <span className="mb-1.5 block font-semibold text-[var(--ui-navy)]">Base URL</span>
            <input
              type="url"
              value={settings.apiBaseUrl}
              onChange={(e) => updateSettings({ apiBaseUrl: e.target.value })}
              placeholder="http://localhost:8000"
              className="w-full rounded-xl border border-[var(--ui-line)] bg-[var(--ui-soft)] px-3 py-2.5 outline-none focus:border-[var(--ui-navy)]"
            />
          </label>
          <label className="flex cursor-pointer items-center justify-between gap-4 text-sm">
            <span>
              Use mock API
              <span className="mt-0.5 block text-xs text-[var(--ui-muted)]">
                Keep on until <code className="rounded bg-[var(--ui-soft)] px-1">POST /ask</code> is ready.
              </span>
            </span>
            <input
              type="checkbox"
              className="size-4 accent-[var(--ui-navy)]"
              checked={settings.useMockApi}
              onChange={(e) => updateSettings({ useMockApi: e.target.checked })}
            />
          </label>
          <p className="text-xs text-[var(--ui-muted)]">
            Expected: <code>POST /ask</code> → <code>{`{ answer, sources[], confidence? }`}</code>
          </p>
        </section>

        <section className="mt-4 space-y-4 rounded-2xl border border-[var(--ui-line)] bg-white p-5 shadow-sm">
          <h2 className="text-base font-semibold text-[var(--ui-navy)]">Disclaimer</h2>
          <label className="flex cursor-pointer items-center justify-between gap-4 text-sm">
            <span>Show disclaimer banner again</span>
            <input
              type="checkbox"
              className="size-4 accent-[var(--ui-navy)]"
              checked={!settings.disclaimerAccepted}
              onChange={(e) => updateSettings({ disclaimerAccepted: !e.target.checked })}
            />
          </label>
        </section>

        <section className="mt-4 flex flex-wrap gap-3">
          <Button variant="secondary" onClick={resetSettings}>
            Reset settings
          </Button>
          <Button variant="danger" onClick={() => setConfirmClear(true)}>
            Clear all chat history
          </Button>
        </section>

        <Modal open={confirmClear} title="Clear chat history?" onClose={() => setConfirmClear(false)}>
          <p className="text-sm text-[var(--ui-muted)]">
            This removes every conversation stored in this browser. It cannot be undone.
          </p>
          <div className="mt-5 flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setConfirmClear(false)}>
              Cancel
            </Button>
            <Button
              variant="danger"
              onClick={() => {
                clearAll()
                setConfirmClear(false)
              }}
            >
              Clear history
            </Button>
          </div>
        </Modal>
      </div>
    </div>
  )
}
