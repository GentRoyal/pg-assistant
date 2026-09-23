import { Paperclip, SendHorizontal, X, FileText, Image as ImageIcon } from 'lucide-react'
import { useEffect, useId, useRef, useState, type FormEvent, type KeyboardEvent } from 'react'
import {
  ATTACHMENT_ACCEPT,
  ATTACHMENT_MAX_BYTES,
  ATTACHMENT_MAX_FILES,
} from '../../types'
import { Button } from '../ui/Button'

type Props = {
  disabled?: boolean
  /** Hide extra attachment hint line (empty chat — keep first screen scroll-free) */
  compact?: boolean
  onSend: (value: string, files: File[]) => void
}

function formatSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function isAllowedFile(file: File) {
  const name = file.name.toLowerCase()
  const okExt =
    name.endsWith('.pdf') ||
    name.endsWith('.doc') ||
    name.endsWith('.docx') ||
    name.endsWith('.txt') ||
    name.endsWith('.png') ||
    name.endsWith('.jpg') ||
    name.endsWith('.jpeg') ||
    name.endsWith('.webp')
  const okMime =
    !file.type ||
    file.type === 'application/pdf' ||
    file.type.startsWith('image/') ||
    file.type === 'text/plain' ||
    file.type.includes('word') ||
    file.type.includes('document')
  return okExt || okMime
}

export function ChatInput({ disabled, compact = false, onSend }: Props) {
  const [value, setValue] = useState('')
  const [files, setFiles] = useState<File[]>([])
  const [error, setError] = useState<string | null>(null)
  const [dragging, setDragging] = useState(false)
  const [focused, setFocused] = useState(false)
  const ref = useRef<HTMLTextAreaElement>(null)
  const fileRef = useRef<HTMLInputElement>(null)
  const inputId = useId()

  useEffect(() => {
    const narrow = window.matchMedia('(max-width: 1023px)').matches
    const coarse = window.matchMedia('(pointer: coarse)').matches
    if (!narrow && !coarse) ref.current?.focus()
  }, [])

  useEffect(() => {
    const el = ref.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = `${Math.min(el.scrollHeight, 160)}px`
  }, [value])

  const addFiles = (incoming: FileList | File[]) => {
    const list = Array.from(incoming)
    setError(null)
    setFiles((prev) => {
      const next = [...prev]
      for (const file of list) {
        if (next.length >= ATTACHMENT_MAX_FILES) {
          setError(`You can attach up to ${ATTACHMENT_MAX_FILES} files.`)
          break
        }
        if (!isAllowedFile(file)) {
          setError(`“${file.name}” isn’t a supported type. Use PDF, Word, TXT, or images.`)
          continue
        }
        if (file.size > ATTACHMENT_MAX_BYTES) {
          setError(`“${file.name}” is larger than 10 MB.`)
          continue
        }
        if (next.some((f) => f.name === file.name && f.size === file.size)) continue
        next.push(file)
      }
      return next
    })
  }

  const removeFile = (index: number) => {
    setFiles((prev) => prev.filter((_, i) => i !== index))
    setError(null)
  }

  const canSend = Boolean(value.trim() || files.length) && !disabled

  const submit = () => {
    if (!canSend) return
    onSend(value.trim(), files)
    setValue('')
    setFiles([])
    setError(null)
    if (fileRef.current) fileRef.current.value = ''
  }

  const onSubmit = (e: FormEvent) => {
    e.preventDefault()
    submit()
  }

  const onKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      submit()
    }
  }

  return (
    <form
      onSubmit={onSubmit}
      onDragEnter={(e) => {
        e.preventDefault()
        setDragging(true)
      }}
      onDragOver={(e) => {
        e.preventDefault()
        setDragging(true)
      }}
      onDragLeave={(e) => {
        e.preventDefault()
        if (e.currentTarget === e.target) setDragging(false)
      }}
      onDrop={(e) => {
        e.preventDefault()
        setDragging(false)
        if (e.dataTransfer.files?.length) addFiles(e.dataTransfer.files)
      }}
      className={`mx-auto w-full max-w-3xl rounded-2xl border bg-[var(--ui-soft)] p-1.5 transition-[border-color,box-shadow] sm:bg-white sm:p-2 sm:shadow-sm ${
        dragging
          ? 'border-[var(--ui-navy)] shadow-[0_0_0_3px_color-mix(in_srgb,var(--ui-navy)_12%,transparent)]'
          : focused
            ? 'border-[color-mix(in_srgb,var(--ui-navy)_35%,var(--ui-line))] shadow-[0_0_0_3px_color-mix(in_srgb,var(--ui-navy)_8%,transparent)]'
            : 'border-[var(--ui-line)]'
      }`}
      aria-label="Ask a question"
    >
      {files.length > 0 ? (
        <ul className="mb-1.5 flex flex-wrap gap-2 px-1 pt-1" aria-label="Attachments">
          {files.map((file, index) => {
            const isImage = file.type.startsWith('image/')
            return (
              <li
                key={`${file.name}-${file.size}-${index}`}
                className="flex max-w-full items-center gap-2 rounded-xl border border-[var(--ui-line)] bg-white px-2.5 py-1.5 text-xs text-[var(--ui-navy)]"
              >
                {isImage ? <ImageIcon size={14} aria-hidden /> : <FileText size={14} aria-hidden />}
                <span className="min-w-0 truncate font-medium">{file.name}</span>
                <span className="shrink-0 text-[var(--ui-muted)]">{formatSize(file.size)}</span>
                <button
                  type="button"
                  className="flex size-7 shrink-0 items-center justify-center rounded-lg text-[var(--ui-muted)] hover:bg-[var(--ui-soft)] hover:text-[var(--ui-navy)]"
                  aria-label={`Remove ${file.name}`}
                  onClick={() => removeFile(index)}
                >
                  <X size={14} />
                </button>
              </li>
            )
          })}
        </ul>
      ) : null}

      {error ? (
        <p role="alert" className="px-2 pb-1 text-xs text-[var(--ui-danger)]">
          {error}
        </p>
      ) : null}

      <div className="flex items-end gap-1.5">
        <input
          ref={fileRef}
          id={inputId}
          type="file"
          className="sr-only"
          accept={ATTACHMENT_ACCEPT}
          multiple
          disabled={disabled}
          onChange={(e) => {
            if (e.target.files?.length) addFiles(e.target.files)
            e.target.value = ''
          }}
        />
        <Button
          type="button"
          variant="ghost"
          disabled={disabled || files.length >= ATTACHMENT_MAX_FILES}
          className="!mb-0.5 !min-h-11 !min-w-11 !shrink-0 !px-0"
          aria-label="Attach files"
          title="Attach PDF, Word, TXT, or images"
          onClick={() => fileRef.current?.click()}
        >
          <Paperclip size={18} aria-hidden />
        </Button>

        <label htmlFor="chat-input" className="sr-only">
          Ask about academic regulations
        </label>
        <textarea
          id="chat-input"
          ref={ref}
          rows={1}
          value={value}
          disabled={disabled}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={onKeyDown}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          placeholder={
            files.length
              ? 'Add a question about your attachment…'
              : 'Ask about registration, exams, thesis…'
          }
          className="max-h-40 min-h-[44px] flex-1 resize-none border-0 bg-transparent px-2 py-2.5 text-[16px] leading-snug text-[var(--ui-ink)] outline-none ring-0 placeholder:text-[var(--ui-muted)] focus:outline-none focus:ring-0 focus-visible:outline-none disabled:opacity-60 sm:px-3 sm:text-[15px]"
        />
        <Button
          type="submit"
          disabled={!canSend}
          aria-label="Send message"
          className="!mb-0.5 !min-h-11 !min-w-11 !shrink-0 !rounded-xl !px-0"
        >
          <SendHorizontal size={18} aria-hidden />
        </Button>
      </div>
      {!compact ? (
        <p className="px-2 pb-0.5 pt-1 text-[11px] text-[var(--ui-muted)]">
          Attachments: PDF, Word, TXT, images · max {ATTACHMENT_MAX_FILES} files · 10 MB each
        </p>
      ) : null}
    </form>
  )
}
