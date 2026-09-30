import { NavLink, Outlet, Navigate } from 'react-router-dom'
import {
  FileStack,
  LayoutDashboard,
  LogOut,
  LineChart,
  PanelLeft,
} from 'lucide-react'
import { useState } from 'react'
import { useAuth } from '../../context/AuthContext'
import { USE_MOCK_ADMIN } from '../../lib/adminApi'
import { Button } from '../ui/Button'

const NAV = [
  { to: '/admin', label: 'Overview', icon: LayoutDashboard, end: true },
  { to: '/admin/documents', label: 'Documents', icon: FileStack, end: false },
  { to: '/admin/reports', label: 'Reports', icon: LineChart, end: false },
]

export function AdminLayout() {
  const { user, logout, isAdmin } = useAuth()
  const [open, setOpen] = useState(false)

  if (!isAdmin) return <Navigate to="/" replace />

  return (
    <div className="flex h-dvh overflow-hidden bg-[var(--ui-canvas)]">
      {open ? (
        <button
          type="button"
          className="fixed inset-0 z-40 bg-black/40 lg:hidden"
          aria-label="Close menu"
          onClick={() => setOpen(false)}
        />
      ) : null}

      <aside
        className={`fixed inset-y-0 left-0 z-50 flex w-[260px] flex-col bg-[var(--ui-navy)] text-white transition-transform lg:static lg:translate-x-0 ${
          open ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="flex items-center gap-3 border-b border-white/10 px-4 py-4">
          <img
            src="/ui-logo.png"
            alt=""
            width={40}
            height={40}
            className="rounded-lg bg-white object-contain p-0.5"
          />
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold">PG Admin</p>
            <p className="truncate text-[11px] text-[var(--ui-gold)]">Console</p>
          </div>
        </div>

        <nav className="flex-1 space-y-1 p-3" aria-label="Admin">
          {NAV.map(({ to, label, icon: Icon, end }) => (
            <NavLink
              key={to}
              to={to}
              end={end}
              onClick={() => setOpen(false)}
              className={({ isActive }) =>
                `flex min-h-11 items-center gap-2 rounded-xl px-3 text-sm font-medium transition ${
                  isActive ? 'bg-white/15 text-white' : 'text-white/75 hover:bg-white/10'
                }`
              }
            >
              <Icon size={16} aria-hidden />
              {label}
            </NavLink>
          ))}
        </nav>

        <div className="border-t border-white/10 p-3">
          <p className="truncate text-sm font-medium">{user?.name}</p>
          <p className="truncate text-xs text-white/55">{user?.email}</p>
          <Button
            variant="ghost"
            className="mt-2 !h-auto !min-h-0 !gap-1.5 !px-0 !py-1 !text-[var(--ui-gold)] hover:!bg-transparent"
            onClick={logout}
          >
            <LogOut size={14} aria-hidden />
            Sign out
          </Button>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex shrink-0 items-center gap-2 border-b border-[var(--ui-line)] bg-white px-3 py-2.5 md:px-5">
          <Button
            variant="secondary"
            className="!min-h-10 !min-w-10 !px-0 lg:hidden"
            onClick={() => setOpen(true)}
            aria-label="Open menu"
          >
            <PanelLeft size={18} />
          </Button>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold text-[var(--ui-navy)]">Admin Console</p>
            <p className="text-xs text-[var(--ui-muted)]">University of Ibadan · PG Assistant</p>
          </div>
          {USE_MOCK_ADMIN ? (
            <span className="rounded-full bg-amber-50 px-2.5 py-1 text-[11px] font-semibold text-amber-800">
              Stub APIs
            </span>
          ) : (
            <span className="hidden rounded-full bg-emerald-50 px-2.5 py-1 text-[11px] font-semibold text-emerald-700 sm:inline">
              Live APIs
            </span>
          )}
        </header>

        {USE_MOCK_ADMIN ? (
          <div
            role="status"
            className="shrink-0 border-b border-amber-200 bg-amber-50 px-4 py-2 text-xs text-amber-900 md:px-6"
          >
            Admin console is running on <strong>local stub data</strong>. Flip{' '}
            <code className="rounded bg-white/80 px-1">USE_MOCK_ADMIN</code> to{' '}
            <code className="rounded bg-white/80 px-1">false</code> in{' '}
            <code className="rounded bg-white/80 px-1">src/lib/adminApi.ts</code> once backend
            routes in <code className="rounded bg-white/80 px-1">ADMIN_API.md</code> are ready.
          </div>
        ) : null}

        <main className="chat-scroll min-h-0 flex-1 overflow-y-auto p-4 md:p-6">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
