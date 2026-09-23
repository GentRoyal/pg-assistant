import { SendHorizontal } from 'lucide-react'
import { useEffect, useRef, useState, type FormEvent, type KeyboardEvent } from 'react'
import { Button } from '../ui/Button'

type Props = {
  disabled?: boolean
  onSend: (value: string) => void
}

export function ChatInput({ disabled, onSend }: Props) {
  const [value, setValue] = useState('')
  const ref = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    // Avoid auto-opening the keyboard on phones/tablets
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

  const submit = () => {
    const next = value.trim()
    if (!next || disabled) return
    onSend(next)
    setValue('')
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
      className="mx-auto flex w-full max-w-3xl items-end gap-2 rounded-2xl border border-[var(--ui-line)] bg-[var(--ui-soft)] p-1.5 sm:bg-white sm:p-2 sm:shadow-sm"
      aria-label="Ask a question"
    >
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
        placeholder="Ask about registration, exams, thesis…"
        className="max-h-40 min-h-[44px] flex-1 resize-none border-0 bg-transparent px-3 py-2.5 text-[16px] leading-snug text-[var(--ui-ink)] outline-none placeholder:text-[var(--ui-muted)] disabled:opacity-60 sm:text-[15px]"
      />
      <Button
        type="submit"
        disabled={disabled || !value.trim()}
        aria-label="Send message"
        className="!mb-0.5 !min-h-11 !min-w-11 !shrink-0 !rounded-xl !px-0"
      >
        <SendHorizontal size={18} aria-hidden />
      </Button>
    </form>
  )
}
