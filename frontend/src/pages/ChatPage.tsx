import { useEffect, useRef, useState } from 'react'
import { PanelLeft, Settings } from 'lucide-react'
import { NavLink } from 'react-router-dom'
import { ChatInput } from '../components/chat/ChatInput'
import { DisclaimerBanner } from '../components/chat/DisclaimerBanner'
import { EmptyState } from '../components/chat/EmptyState'
import { MessageBubble } from '../components/chat/MessageBubble'
import { Sidebar } from '../components/layout/Sidebar'
import { Button } from '../components/ui/Button'
import { useChat } from '../context/ChatContext'
import { loadDesktopSidebarOpen, saveDesktopSidebarOpen } from '../lib/storage'

const DESKTOP_MQ = '(min-width: 1024px)'

function initialSidebarOpen() {
  if (typeof window === 'undefined') return true
  return window.matchMedia(DESKTOP_MQ).matches ? loadDesktopSidebarOpen() : false
}

export function ChatPage() {
  const { activeConversation, isSending, sendMessage } = useChat()
  const [sidebarOpen, setSidebarOpen] = useState(initialSidebarOpen)
  const bottomRef = useRef<HTMLDivElement>(null)
  const composerRef = useRef<HTMLDivElement>(null)
  const messages = activeConversation?.messages ?? []

  useEffect(() => {
    const mq = window.matchMedia(DESKTOP_MQ)
    const onChange = () => {
      if (mq.matches) setSidebarOpen(loadDesktopSidebarOpen())
      else setSidebarOpen(false)
    }
    mq.addEventListener('change', onChange)
    return () => mq.removeEventListener('change', onChange)
  }, [])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' })
  }, [messages.length, isSending])

  useEffect(() => {
    const vv = window.visualViewport
    if (!vv) return

    const sync = () => {
      const inset = Math.max(0, window.innerHeight - vv.height - vv.offsetTop)
      if (composerRef.current) {
        composerRef.current.style.paddingBottom = inset > 0 ? `${inset}px` : ''
      }
    }

    vv.addEventListener('resize', sync)
    vv.addEventListener('scroll', sync)
    sync()
    return () => {
      vv.removeEventListener('resize', sync)
      vv.removeEventListener('scroll', sync)
    }
  }, [])

  const setOpen = (open: boolean) => {
    setSidebarOpen(open)
    if (window.matchMedia(DESKTOP_MQ).matches) saveDesktopSidebarOpen(open)
  }

  const toggleSidebar = () => setOpen(!sidebarOpen)

  return (
    <div className="flex h-dvh max-h-dvh overflow-hidden bg-[var(--ui-canvas)]">
      <Sidebar open={sidebarOpen} onClose={() => setOpen(false)} />

      <div className="flex min-w-0 flex-1 flex-col">
        <header
          className="z-20 flex shrink-0 items-center gap-2 border-b border-[var(--ui-line)] bg-white px-3 py-2.5 md:px-4"
          style={{ paddingTop: 'max(0.625rem, env(safe-area-inset-top))' }}
        >
          <Button
            variant="secondary"
            className="!min-h-11 !min-w-11 !shrink-0 !px-0"
            onClick={toggleSidebar}
            aria-label={sidebarOpen ? 'Collapse sidebar' : 'Expand sidebar'}
            aria-expanded={sidebarOpen}
            title={sidebarOpen ? 'Collapse sidebar' : 'Expand sidebar'}
          >
            <PanelLeft size={18} />
          </Button>

          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold tracking-tight text-[var(--ui-navy)]">
              {activeConversation?.title ?? 'New chat'}
            </p>
            <p className="truncate text-xs text-[var(--ui-muted)]">University of Ibadan</p>
          </div>

          <NavLink to="/settings" className="hidden sm:block" aria-label="Settings">
            <Button variant="secondary" className="!min-h-11 !gap-1.5 !px-3">
              <Settings size={16} aria-hidden />
              <span className="hidden md:inline">Settings</span>
            </Button>
          </NavLink>
        </header>

        <main
          className={`min-h-0 flex-1 overscroll-contain px-3 md:px-6 ${
            messages.length === 0
              ? 'flex flex-col overflow-hidden py-3'
              : 'chat-scroll overflow-y-auto py-4'
          }`}
          aria-live="polite"
        >
          {messages.length === 0 ? (
            <div className="flex min-h-0 flex-1 flex-col">
              <EmptyState onPick={(q) => void sendMessage(q)} />
            </div>
          ) : (
            <>
              <DisclaimerBanner />
              <div className="mx-auto flex w-full max-w-3xl flex-col gap-3.5 pb-2">
                {messages.map((m) => (
                  <MessageBubble key={m.id} message={m} />
                ))}
                {isSending ? (
                  <div className="flex items-center gap-2 text-sm text-[var(--ui-muted)]" role="status">
                    <span className="inline-flex gap-1" aria-hidden>
                      <span className="size-1.5 animate-pulse rounded-full bg-[var(--ui-navy)]" />
                      <span className="size-1.5 animate-pulse rounded-full bg-[var(--ui-navy)] [animation-delay:120ms]" />
                      <span className="size-1.5 animate-pulse rounded-full bg-[var(--ui-navy)] [animation-delay:240ms]" />
                    </span>
                    Thinking…
                  </div>
                ) : null}
                <div ref={bottomRef} />
              </div>
            </>
          )}
        </main>

        <div
          ref={composerRef}
          className="shrink-0 border-t border-[var(--ui-line)] bg-white px-3 pt-3 md:px-6"
          style={{ paddingBottom: 'max(0.75rem, env(safe-area-inset-bottom))' }}
        >
          <ChatInput
            disabled={isSending}
            compact={messages.length === 0}
            onSend={(q, files) => void sendMessage(q, files)}
          />
          <p className="mx-auto mt-2 max-w-3xl px-1 text-center text-[11px] leading-snug text-[var(--ui-muted)]">
            Study aid only — not an official UI ruling. Confirm with your department or Postgraduate
            College.
          </p>
        </div>
      </div>
    </div>
  )
}
