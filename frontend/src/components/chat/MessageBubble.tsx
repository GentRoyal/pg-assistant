import { motion } from 'framer-motion'
import { BookOpen, ChevronDown, ChevronUp, FileText, Image as ImageIcon } from 'lucide-react'
import { useState } from 'react'
import Markdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import type { ChatMessage, SourceChunk } from '../../types'
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

type SourceDocument = { title: string; pages: number[] }

/**
 * The API cites chunks, but students only need to know which documents were
 * used. Collapse chunks into one entry per document, and map each chunk's
 * citation number to its document's number so the answer still matches the list.
 */
function groupByDocument(sources: SourceChunk[]) {
  const documents: SourceDocument[] = []
  const documentForChunk: number[] = []

  for (const source of sources) {
    let index = documents.findIndex((doc) => doc.title === source.documentTitle)
    if (index === -1) {
      documents.push({ title: source.documentTitle, pages: [] })
      index = documents.length - 1
    }
    const pages = documents[index].pages
    if (typeof source.page === 'number' && !pages.includes(source.page)) pages.push(source.page)
    documentForChunk.push(index + 1)
  }

  for (const doc of documents) doc.pages.sort((a, b) => a - b)
  return { documents, documentForChunk }
}

const CITATION = /\[(\d+(?:\s*,\s*\d+)*)\]/g

function renumberCitations(content: string, documentForChunk: number[]) {
  const renumbered = content.replace(CITATION, (match, group: string) => {
    const numbers = group
      .split(',')
      .map((part) => documentForChunk[Number(part.trim()) - 1])
      .filter((number): number is number => typeof number === 'number')
    const unique = [...new Set(numbers)]
    return unique.length ? `[${unique.join(', ')}]` : match
  })
  // Two chunks from one document read as "[1][1]"; show it once.
  return renumbered.replace(/(\[[\d, ]+\])(?:\s*\1)+/g, '$1')
}

export function MessageBubble({ message }: { message: ChatMessage }) {
  const { settings } = useSettings()
  const [openSources, setOpenSources] = useState(false)
  const isUser = message.role === 'user'
  const hasSources = Boolean(message.sources?.length)
  const { documents, documentForChunk } = groupByDocument(message.sources ?? [])
  const content = hasSources ? renumberCitations(message.content, documentForChunk) : message.content
  const hasAttachments = Boolean(message.attachments?.length)

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
            <span className="text-xs font-semibold text-[var(--ui-navy)]">PG Assistant</span>
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
          isUser || message.isError ? (
            <div className="prose-answer break-words text-[0.95rem]">{message.content}</div>
          ) : (
            // Answers are markdown; react-markdown ignores raw HTML, so nothing from
            // the model is injected into the page.
            <div className="markdown-answer break-words text-[0.95rem]">
              <Markdown remarkPlugins={[remarkGfm]}>{content}</Markdown>
            </div>
          )
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
                Sources ({documents.length})
              </span>
              {openSources ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
            </button>

            {openSources ? (
              <ol className="mt-2 space-y-1.5">
                {documents.map((doc, index) => (
                  <li
                    key={doc.title}
                    className="rounded-xl border border-[var(--ui-line)] bg-[var(--ui-soft)] px-3 py-2 text-sm"
                  >
                    <span className="break-words font-semibold text-[var(--ui-navy)]">
                      {index + 1}. {doc.title}
                    </span>
                    {doc.pages.length ? (
                      <span className="text-[var(--ui-muted)]">
                        {' '}
                        · {doc.pages.length > 1 ? 'pp.' : 'p.'} {doc.pages.join(', ')}
                      </span>
                    ) : null}
                  </li>
                ))}
              </ol>
            ) : null}
          </div>
        ) : null}

        {!isUser && settings.showSources && !hasSources && !message.isError ? (
          <p className="mt-3 text-xs text-[var(--ui-muted)]">Sources: none</p>
        ) : null}
      </div>
    </motion.article>
  )
}
