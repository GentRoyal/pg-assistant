import { ArrowLeft } from 'lucide-react'
import { NavLink } from 'react-router-dom'
import { Button } from '../components/ui/Button'
import { useChat } from '../context/ChatContext'
import { useSettings } from '../context/SettingsContext'
import { Modal } from '../components/ui/Modal'
import { useState } from 'react'
import { UiLogo } from '../components/brand/UiLogo'
import { checkHealth } from '../lib/api'
import { LLM_PROVIDERS, type LlmProvider } from '../types'

type ConnectionState =
  | { kind: 'idle' }
  | { kind: 'checking' }
  | { kind: 'ok'; embedding: string; providers: string[] }
  | { kind: 'error'; message: string }

export function SettingsPage() {
  const { settings, updateSettings, resetSettings } = useSettings()
  const { clearAll } = useChat()
  const [confirmClear, setConfirmClear] = useState(false)
  const [connection, setConnection] = useState<ConnectionState>({ kind: 'idle' })

  async function testConnection() {
    setConnection({ kind: 'checking' })
    try {
      const health = await checkHealth(settings.apiBaseUrl)
      setConnection({
        kind: 'ok',
        embedding: health.embedding,
        providers: health.llm_providers ?? [],
      })
    } catch (error) {
      setConnection({
        kind: 'error',
        message: error instanceof Error ? error.message : 'Could not reach the API.',
      })
    }
  }

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

        <section className="mt-8 space-y-4 rounded-2xl border border-[var(--ui-line)] bg-white p-5 shadow-sm">
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
                Answers from canned demo responses instead of the real backend.
              </span>
            </span>
            <input
              type="checkbox"
              className="size-4 accent-[var(--ui-navy)]"
              checked={settings.useMockApi}
              onChange={(e) => updateSettings({ useMockApi: e.target.checked })}
            />
          </label>

          <div className="flex flex-wrap items-center gap-3">
            <Button
              variant="secondary"
              onClick={testConnection}
              disabled={connection.kind === 'checking'}
            >
              {connection.kind === 'checking' ? 'Checking…' : 'Test connection'}
            </Button>

            {connection.kind === 'ok' && (
              <span className="text-xs text-emerald-700">
                Connected · embeddings {connection.embedding}
              </span>
            )}
            {connection.kind === 'error' && (
              <span className="text-xs text-red-700">{connection.message}</span>
            )}
          </div>

          <p className="text-xs text-[var(--ui-muted)]">
            Calls <code>POST /chat</code> → <code>{`{ answer, citations[], conversation_id }`}</code>
          </p>
        </section>

        <section className="mt-4 space-y-4 rounded-2xl border border-[var(--ui-line)] bg-white p-5 shadow-sm">
          <h2 className="text-base font-semibold text-[var(--ui-navy)]">Answering model</h2>

          <label className="block text-sm">
            <span className="mb-1.5 block font-semibold text-[var(--ui-navy)]">Provider</span>
            <select
              value={settings.llmProvider}
              onChange={(e) => updateSettings({ llmProvider: e.target.value as LlmProvider })}
              className="w-full rounded-xl border border-[var(--ui-line)] bg-[var(--ui-soft)] px-3 py-2.5 outline-none focus:border-[var(--ui-navy)]"
            >
              {LLM_PROVIDERS.map((provider) => (
                <option key={provider.value} value={provider.value}>
                  {provider.label} — {provider.hint}
                </option>
              ))}
            </select>
          </label>

          <label className="block text-sm">
            <span className="mb-1.5 block font-semibold text-[var(--ui-navy)]">
              Model <span className="font-normal text-[var(--ui-muted)]">(optional)</span>
            </span>
            <input
              type="text"
              value={settings.llmModel}
              onChange={(e) => updateSettings({ llmModel: e.target.value })}
              placeholder="leave empty for the provider default"
              className="w-full rounded-xl border border-[var(--ui-line)] bg-[var(--ui-soft)] px-3 py-2.5 outline-none focus:border-[var(--ui-navy)]"
            />
          </label>

          <p className="text-xs text-[var(--ui-muted)]">
            The API keys live on the server, not in this browser. Retrieval always uses the
            server's embedding model regardless of this setting.
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
