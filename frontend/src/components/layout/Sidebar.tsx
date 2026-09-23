import { MessageSquarePlus, Settings, Trash2 } from 'lucide-react'
import { NavLink } from 'react-router-dom'
import { useChat } from '../../context/ChatContext'
import { Button } from '../ui/Button'

type Props = {
  open: boolean
  onClose: () => void
}

export function Sidebar({ open, onClose }: Props) {
  const {
    conversations,
    activeConversation,
    createConversation,
    selectConversation,
    deleteConversation,
  } = useChat()

  const closeIfMobile = () => {
    if (window.matchMedia('(max-width: 1023px)').matches) onClose()
  }

  return (
    <>
      {open ? (
        <button
          type="button"
          className="fixed inset-0 z-40 bg-black/40 lg:hidden"
          aria-label="Close sidebar"
          onClick={onClose}
        />
      ) : null}

      <aside
        className={`flex h-full shrink-0 flex-col bg-[var(--ui-navy)] text-white transition-[width,transform] duration-300 ease-out ${
          open
            ? 'fixed inset-y-0 left-0 z-50 w-[min(288px,86vw)] translate-x-0 lg:static lg:z-auto lg:w-[272px]'
            : 'fixed inset-y-0 left-0 z-50 w-[min(288px,86vw)] -translate-x-full lg:static lg:z-auto lg:w-0 lg:translate-x-0 lg:overflow-hidden lg:border-0'
        }`}
        style={{ paddingBottom: open ? 'env(safe-area-inset-bottom)' : undefined }}
        aria-label="Chat history"
        inert={!open ? true : undefined}
      >
        <div className="flex min-w-[272px] flex-1 flex-col">
          <div
            className="flex items-center gap-3 border-b border-white/10 px-4 py-4"
            style={{ paddingTop: 'max(1rem, env(safe-area-inset-top))' }}
          >
            <img
              src="/ui-logo.png"
              alt=""
              width={44}
              height={44}
              className="shrink-0 rounded-lg bg-white object-contain p-0.5"
            />
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold tracking-tight">PG Assistant</p>
              <p className="truncate text-[11px] font-medium text-[var(--ui-gold)]">University of Ibadan</p>
            </div>
          </div>

          <div className="p-3">
            <Button
              variant="accent"
              className="w-full min-h-11"
              onClick={() => {
                createConversation()
                closeIfMobile()
              }}
            >
              <MessageSquarePlus size={16} aria-hidden />
              New chat
            </Button>
          </div>

          <nav className="chat-scroll flex-1 overflow-y-auto px-2 pb-3" aria-label="Previous chats">
            {conversations.length === 0 ? (
              <p className="px-3 py-6 text-sm text-white/70">Your chats will appear here.</p>
            ) : (
              <ul className="space-y-1">
                {conversations.map((c) => {
                  const active = activeConversation?.id === c.id
                  return (
                    <li key={c.id} className="group relative">
                      <button
                        type="button"
                        onClick={() => {
                          selectConversation(c.id)
                          closeIfMobile()
                        }}
                        className={`w-full rounded-xl px-3 py-2.5 pr-11 text-left text-sm transition ${
                          active ? 'bg-white/15 text-white' : 'text-white/80 hover:bg-white/10'
                        }`}
                      >
                        <span className="line-clamp-2">{c.title}</span>
                      </button>
                      <button
                        type="button"
                        className="absolute right-1.5 top-1/2 flex size-9 -translate-y-1/2 items-center justify-center rounded-lg text-white/70 transition hover:bg-white/10 hover:text-white"
                        aria-label={`Delete chat ${c.title}`}
                        onClick={() => deleteConversation(c.id)}
                      >
                        <Trash2 size={15} />
                      </button>
                    </li>
                  )
                })}
              </ul>
            )}
          </nav>

          <div className="border-t border-white/10 p-3">
            <NavLink
              to="/settings"
              onClick={closeIfMobile}
              className={({ isActive }) =>
                `flex min-h-11 items-center gap-2 rounded-xl px-3 py-2.5 text-sm font-medium transition hover:bg-white/10 ${
                  isActive ? 'bg-white/15' : 'text-white/85'
                }`
              }
            >
              <Settings size={16} aria-hidden />
              Settings
            </NavLink>
          </div>
        </div>
      </aside>
    </>
  )
}
