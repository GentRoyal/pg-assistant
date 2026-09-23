import { useState, type ReactNode } from 'react'
import { NavLink } from 'react-router-dom'
import {
  Cable,
  Database,
  Settings2,
  UserRound,
  X,
} from 'lucide-react'
import { Button } from '../components/ui/Button'
import { Modal } from '../components/ui/Modal'
import { useAuth } from '../context/AuthContext'
import { useChat } from '../context/ChatContext'
import { useSettings } from '../context/SettingsContext'
import { DEMO_AUTH } from '../lib/auth'
import type { AppSettings } from '../types'

type SectionId = 'general' | 'account' | 'connection' | 'data'

const SECTIONS: Array<{ id: SectionId; label: string; icon: typeof Settings2 }> = [
  { id: 'general', label: 'General', icon: Settings2 },
  { id: 'account', label: 'Account', icon: UserRound },
  { id: 'connection', label: 'Connection', icon: Cable },
  { id: 'data', label: 'Data controls', icon: Database },
]

function Toggle({
  checked,
  onChange,
  label,
}: {
  checked: boolean
  onChange: (next: boolean) => void
  label: string
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onClick={() => onChange(!checked)}
      className={`relative h-6 w-11 shrink-0 rounded-full transition-colors ${
        checked ? 'bg-[var(--ui-navy)]' : 'bg-[#c5cad3]'
      }`}
    >
      <span
        className={`absolute top-0.5 left-0.5 size-5 rounded-full bg-white shadow transition-transform ${
          checked ? 'translate-x-5' : 'translate-x-0'
        }`}
      />
    </button>
  )
}

function SettingRow({
  title,
  description,
  control,
}: {
  title: string
  description?: string
  control: ReactNode
}) {
  return (
    <div className="flex items-start justify-between gap-4 border-b border-[var(--ui-line)] py-4 last:border-b-0">
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium text-[var(--ui-ink)]">{title}</p>
        {description ? (
          <p className="mt-0.5 text-xs leading-relaxed text-[var(--ui-muted)]">{description}</p>
        ) : null}
      </div>
      <div className="shrink-0 pt-0.5">{control}</div>
    </div>
  )
}

export function SettingsPage() {
  const { settings, updateSettings, resetSettings } = useSettings()
  const { user, logout } = useAuth()
  const { clearAll } = useChat()
  const [section, setSection] = useState<SectionId>('general')
  const [confirmClear, setConfirmClear] = useState(false)

  const toggleSetting = (key: keyof AppSettings, value: boolean) => {
    updateSettings({ [key]: value })
  }

  return (
    <div className="flex h-dvh items-stretch justify-center bg-black/40 p-0 sm:items-center sm:p-6">
      <div
        className="flex h-full w-full max-w-3xl flex-col overflow-hidden bg-white sm:h-[min(640px,90dvh)] sm:rounded-2xl sm:border sm:border-[var(--ui-line)] sm:shadow-2xl"
        role="dialog"
        aria-labelledby="settings-title"
      >
        <header className="flex shrink-0 items-center justify-between border-b border-[var(--ui-line)] px-4 py-3 sm:px-5">
          <h1 id="settings-title" className="text-base font-semibold text-[var(--ui-ink)]">
            Settings
          </h1>
          <NavLink
            to="/"
            className="flex size-9 items-center justify-center rounded-lg text-[var(--ui-muted)] hover:bg-[var(--ui-soft)] hover:text-[var(--ui-navy)]"
            aria-label="Close settings"
          >
            <X size={18} />
          </NavLink>
        </header>

        <div className="flex min-h-0 flex-1 flex-col sm:flex-row">
          {/* Category nav — ChatGPT style */}
          <nav
            className="flex shrink-0 gap-1 overflow-x-auto border-b border-[var(--ui-line)] p-2 sm:w-48 sm:flex-col sm:overflow-visible sm:border-b-0 sm:border-r sm:p-3"
            aria-label="Settings categories"
          >
            {SECTIONS.map(({ id, label, icon: Icon }) => {
              const active = section === id
              return (
                <button
                  key={id}
                  type="button"
                  onClick={() => setSection(id)}
                  className={`flex min-h-10 shrink-0 items-center gap-2 rounded-lg px-3 py-2 text-left text-sm transition ${
                    active
                      ? 'bg-[var(--ui-soft)] font-medium text-[var(--ui-navy)]'
                      : 'text-[var(--ui-muted)] hover:bg-[var(--ui-soft)]/70 hover:text-[var(--ui-ink)]'
                  }`}
                >
                  <Icon size={16} aria-hidden />
                  {label}
                </button>
              )
            })}
          </nav>

          {/* Content panel */}
          <div className="chat-scroll min-h-0 flex-1 overflow-y-auto px-4 py-2 sm:px-6 sm:py-3">
            {section === 'general' ? (
              <div>
                <h2 className="pb-1 pt-2 text-sm font-semibold text-[var(--ui-ink)]">General</h2>
                <SettingRow
                  title="Show source citations"
                  description="Display document sources under assistant answers."
                  control={
                    <Toggle
                      label="Show source citations"
                      checked={settings.showSources}
                      onChange={(v) => toggleSetting('showSources', v)}
                    />
                  }
                />
                <SettingRow
                  title="Show retrieved chunk text"
                  description="Include the quoted regulation excerpt inside each source."
                  control={
                    <Toggle
                      label="Show retrieved chunk text"
                      checked={settings.showChunks}
                      onChange={(v) => toggleSetting('showChunks', v)}
                    />
                  }
                />
                <SettingRow
                  title="Show confidence"
                  description="Show match strength for each answer when available."
                  control={
                    <Toggle
                      label="Show confidence"
                      checked={settings.showConfidence}
                      onChange={(v) => toggleSetting('showConfidence', v)}
                    />
                  }
                />
                <SettingRow
                  title="Show disclaimer banner"
                  description="Show the study-aid reminder at the top of an active chat."
                  control={
                    <Toggle
                      label="Show disclaimer banner"
                      checked={!settings.disclaimerAccepted}
                      onChange={(v) => updateSettings({ disclaimerAccepted: !v })}
                    />
                  }
                />
              </div>
            ) : null}

            {section === 'account' ? (
              <div>
                <h2 className="pb-1 pt-2 text-sm font-semibold text-[var(--ui-ink)]">Account</h2>
                <div className="border-b border-[var(--ui-line)] py-4">
                  <p className="text-sm font-medium text-[var(--ui-ink)]">{user?.name}</p>
                  <p className="mt-0.5 text-xs text-[var(--ui-muted)]">{user?.email}</p>
                  {user?.role === 'demo' ? (
                    <p className="mt-2 inline-flex rounded-full bg-[var(--ui-soft)] px-2.5 py-0.5 text-[11px] font-semibold text-[var(--ui-navy)]">
                      Demo session
                    </p>
                  ) : null}
                </div>
                <div className="border-b border-[var(--ui-line)] py-4">
                  <p className="text-sm font-medium text-[var(--ui-ink)]">Demo auth layer</p>
                  <p className="mt-0.5 text-xs leading-relaxed text-[var(--ui-muted)]">
                    Local fake sign-in for UI demos. Prefers real{' '}
                    <code className="rounded bg-[var(--ui-soft)] px-1">POST /auth/login</code> when
                    available. Demo: {DEMO_AUTH.email} / {DEMO_AUTH.password}
                  </p>
                </div>
                <div className="flex justify-end py-4">
                  <Button variant="secondary" onClick={logout}>
                    Sign out
                  </Button>
                </div>
              </div>
            ) : null}

            {section === 'connection' ? (
              <div>
                <h2 className="pb-1 pt-2 text-sm font-semibold text-[var(--ui-ink)]">Connection</h2>
                <div className="border-b border-[var(--ui-line)] py-4">
                  <p className="text-sm font-medium text-[var(--ui-ink)]">API base URL</p>
                  <p className="mt-0.5 text-xs text-[var(--ui-muted)]">
                    Backend root used for ask and auth requests.
                  </p>
                  <input
                    type="url"
                    value={settings.apiBaseUrl}
                    onChange={(e) => updateSettings({ apiBaseUrl: e.target.value })}
                    placeholder="http://localhost:8000"
                    className="mt-3 w-full rounded-xl border border-[var(--ui-line)] bg-[var(--ui-soft)] px-3 py-2.5 text-sm outline-none focus:border-[var(--ui-navy)]"
                  />
                </div>
                <SettingRow
                  title="Use mock API"
                  description="Keep on until POST /ask is ready. Mock mode returns demo answers."
                  control={
                    <Toggle
                      label="Use mock API"
                      checked={settings.useMockApi}
                      onChange={(v) => toggleSetting('useMockApi', v)}
                    />
                  }
                />
                <p className="py-3 text-xs text-[var(--ui-muted)]">
                  Contract: <code>POST /ask</code> →{' '}
                  <code>{`{ answer, sources[], confidence? }`}</code>. With files, use multipart
                  field <code>files</code>.
                </p>
              </div>
            ) : null}

            {section === 'data' ? (
              <div>
                <h2 className="pb-1 pt-2 text-sm font-semibold text-[var(--ui-ink)]">Data controls</h2>
                <SettingRow
                  title="Reset settings"
                  description="Restore toggles and API defaults. Does not delete chat history."
                  control={
                    <Button variant="secondary" className="!min-h-9 !py-1.5" onClick={resetSettings}>
                      Reset
                    </Button>
                  }
                />
                <SettingRow
                  title="Clear chat history"
                  description="Delete every conversation stored in this browser. Cannot be undone."
                  control={
                    <Button
                      variant="danger"
                      className="!min-h-9 !py-1.5"
                      onClick={() => setConfirmClear(true)}
                    >
                      Clear
                    </Button>
                  }
                />
              </div>
            ) : null}
          </div>
        </div>
      </div>

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
  )
}
