import { motion } from 'framer-motion'
import { BookOpen, ChevronDown, ChevronUp, FileText, Image as ImageIcon } from 'lucide-react'
import { useEffect, useState } from 'react'
import type { ChatMessage } from '../../types'
import { useSettings } from '../../context/SettingsContext'

function ConfidenceBadge({ value }: { value: number }) {
  const pct = Math.round(value * 100)
  const label = pct >= 75 ? 'Strong match' : pct >= 45 ? 'Moderate match' : 'Weak match'
  return (
    <span className="inline-flex items-center rounded-full bg-[var(--ui-soft)] px-2.5 py-0.5 text-xs font-semibold text-[var(--ui-navy-mid)]">
      {label} · {pct}%
    </span>
  )
}

function formatSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function usePreferCollapsedSources() {
  const [collapsed, setCollapsed] = useState(false)
  useEffect(() => {
    const mq = window.matchMedia('(max-width: 639px)')
    const sync = () => setCollapsed(mq.matches)
    sync()
    mq.addEventListener('change', sync)
    return () => mq.removeEventListener('change', sync)
  }, [])
  return collapsed
}

export function MessageBubble({ message }: { message: ChatMessage }) {
  const { settings } = useSettings()
  const preferCollapsed = usePreferCollapsedSources()
  const [openSources, setOpenSources] = useState(!preferCollapsed)
  const isUser = message.role === 'user'
  const hasSources = Boolean(message.sources?.length)
  const hasAttachments = Boolean(message.attachments?.length)

  useEffect(() => {
    setOpenSources(!preferCollapsed)
  }, [preferCollapsed, message.id])

  return (
    <motion.article
      layout
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25 }}
      className={`flex ${isUser ? 'justify-end' : 'justify-start'}`}
      aria-label={isUser ? 'Your message' : 'Assistant message'}
    >
      <div
        className={`max-w-[min(100%,40rem)] rounded-2xl px-3.5 py-3 sm:px-4 ${
          isUser
            ? 'bg-[var(--ui-navy)] text-white'
            : message.isError
              ? 'border border-red-200 bg-red-50 text-[var(--ui-danger)]'
              : 'border border-[var(--ui-line)] bg-white text-[var(--ui-ink)] shadow-sm'
        }`}
      >
        {!isUser && !message.isError ? (
          <div className="mb-2 flex items-center gap-2">
            <img src="/ui-logo.png" alt="" width={20} height={20} className="rounded-sm object-contain" />
            <span className="text-xs font-semibold text-[var(--ui-navy)]">UI Assistant</span>
          </div>
        ) : null}

        {hasAttachments ? (
          <ul className="mb-2 flex flex-wrap gap-1.5" aria-label="Attached files">
            {message.attachments!.map((file) => {
              const isImage = file.type.startsWith('image/')
              return (
                <li
                  key={file.id}
                  className={`inline-flex max-w-full items-center gap-1.5 rounded-lg px-2 py-1 text-xs ${
                    isUser ? 'bg-white/15 text-white' : 'bg-[var(--ui-soft)] text-[var(--ui-navy)]'
                  }`}
                >
                  {isImage ? <ImageIcon size={12} aria-hidden /> : <FileText size={12} aria-hidden />}
                  <span className="truncate font-medium">{file.name}</span>
                  <span className={isUser ? 'text-white/70' : 'text-[var(--ui-muted)]'}>
                    {formatSize(file.size)}
                  </span>
                </li>
              )
            })}
          </ul>
        ) : null}

        {message.content ? (
          <div className="prose-answer break-words text-[0.95rem]">{message.content}</div>
        ) : null}

        {!isUser && !message.isError && settings.showConfidence && typeof message.confidence === 'number' ? (
          <div className="mt-3">
            <ConfidenceBadge value={message.confidence} />
          </div>
        ) : null}

        {!isUser && settings.showSources && hasSources ? (
          <div className="mt-3 border-t border-[var(--ui-line)] pt-3">
            <button
              type="button"
              className="flex min-h-10 w-full items-center justify-between gap-2 text-left text-sm font-semibold text-[var(--ui-navy)]"
              onClick={() => setOpenSources((v) => !v)}
              aria-expanded={openSources}
            >
              <span className="inline-flex items-center gap-2">
                <BookOpen size={16} aria-hidden />
                Sources ({message.sources!.length})
              </span>
              {openSources ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
            </button>

            {openSources ? (
              <ul className="mt-2 space-y-2">
                {message.sources!.map((source, index) => (
                  <li
                    key={source.id}
                    className="rounded-xl border border-[var(--ui-line)] bg-[var(--ui-soft)] px-3 py-2.5 text-sm"
                  >
                    <p className="break-words font-semibold text-[var(--ui-navy)]">
                      {index + 1}. {source.documentTitle}
                      {source.section ? ` · ${source.section}` : ''}
                      {typeof source.page === 'number' ? ` · p. ${source.page}` : ''}
                    </p>
                    {typeof source.score === 'number' ? (
                      <p className="mt-0.5 text-xs text-[var(--ui-muted)]">
                        Relevance: {source.score.toFixed(2)}
                      </p>
                    ) : null}
                    {settings.showChunks ? (
                      <p className="mt-1.5 break-words text-[var(--ui-muted)]">
                        &ldquo;{source.chunkText}&rdquo;
                      </p>
                    ) : null}
                  </li>
                ))}
              </ul>
            ) : null}
          </div>
        ) : null}

        {!isUser && settings.showSources && !hasSources && !message.isError ? (
          <p className="mt-3 text-xs text-[var(--ui-muted)]">No supporting regulation chunks were returned.</p>
        ) : null}
      </div>
    </motion.article>
  )
}
