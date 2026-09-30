import { useEffect, useState } from 'react'
import { Activity, Files, MessageSquare, Users, Zap } from 'lucide-react'
import { fetchDashboardStats } from '../../lib/adminApi'
import type { DashboardStats } from '../../types'

function formatNumber(n: number) {
  return new Intl.NumberFormat('en-NG').format(n)
}

function SparkBars({ values }: { values: number[] }) {
  const max = Math.max(...values, 1)
  return (
    <div className="flex h-16 items-end gap-1.5" aria-hidden>
      {values.map((v, i) => (
        <div
          key={i}
          className="flex-1 rounded-t-md bg-[var(--ui-navy)]/85"
          style={{ height: `${Math.max(12, (v / max) * 100)}%` }}
        />
      ))}
    </div>
  )
}

function KpiCard({
  label,
  value,
  hint,
  icon: Icon,
}: {
  label: string
  value: string
  hint: string
  icon: typeof Files
}) {
  return (
    <div className="rounded-2xl border border-[var(--ui-line)] bg-white p-4 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-[var(--ui-muted)]">{label}</p>
          <p className="mt-2 text-2xl font-bold tracking-tight text-[var(--ui-navy)]">{value}</p>
          <p className="mt-1 text-xs text-[var(--ui-muted)]">{hint}</p>
        </div>
        <span className="flex size-10 items-center justify-center rounded-xl bg-[var(--ui-soft)] text-[var(--ui-navy)]">
          <Icon size={18} aria-hidden />
        </span>
      </div>
    </div>
  )
}

export function AdminDashboardPage() {
  const [stats, setStats] = useState<DashboardStats | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let alive = true
    fetchDashboardStats()
      .then((data) => {
        if (alive) setStats(data)
      })
      .finally(() => {
        if (alive) setLoading(false)
      })
    return () => {
      alive = false
    }
  }, [])

  if (loading || !stats) {
    return <p className="text-sm text-[var(--ui-muted)]">Loading analytics…</p>
  }

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <div>
        <h1 className="text-xl font-bold tracking-tight text-[var(--ui-navy)] sm:text-2xl">
          Overview
        </h1>
        <p className="mt-1 text-sm text-[var(--ui-muted)]">
          Premium analytics for documents, student activity, and retrieval health.
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard
          label="Documents"
          value={formatNumber(stats.totalDocuments)}
          hint={`${formatNumber(stats.totalChunks)} chunks · ${formatNumber(stats.totalPages)} pages`}
          icon={Files}
        />
        <KpiCard
          label="Questions (7d)"
          value={formatNumber(stats.questionsWeek)}
          hint={`${formatNumber(stats.questionsToday)} today`}
          icon={MessageSquare}
        />
        <KpiCard
          label="Active students"
          value={formatNumber(stats.activeStudents)}
          hint={`${formatNumber(stats.conversations)} conversations`}
          icon={Users}
        />
        <KpiCard
          label="Avg latency"
          value={`${(stats.avgLatencyMs / 1000).toFixed(1)}s`}
          hint={`${Math.round(stats.weakRetrievalRate * 100)}% weak retrieval`}
          icon={Zap}
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-5">
        <section className="rounded-2xl border border-[var(--ui-line)] bg-white p-5 shadow-sm lg:col-span-3">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <h2 className="text-sm font-semibold text-[var(--ui-navy)]">Questions this week</h2>
              <p className="text-xs text-[var(--ui-muted)]">Daily volume across student chats</p>
            </div>
            <span
              className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${
                stats.systemStatus === 'ok'
                  ? 'bg-emerald-50 text-emerald-700'
                  : 'bg-amber-50 text-amber-800'
              }`}
            >
              System {stats.systemStatus}
            </span>
          </div>
          <SparkBars values={stats.questionsTrend} />
          <div className="mt-3 flex justify-between text-[11px] text-[var(--ui-muted)]">
            <span>Mon</span>
            <span>Tue</span>
            <span>Wed</span>
            <span>Thu</span>
            <span>Fri</span>
            <span>Sat</span>
            <span>Sun</span>
          </div>
        </section>

        <section className="rounded-2xl border border-[var(--ui-line)] bg-white p-5 shadow-sm lg:col-span-2">
          <h2 className="text-sm font-semibold text-[var(--ui-navy)]">Top cited documents</h2>
          <p className="mt-0.5 text-xs text-[var(--ui-muted)]">Most used sources in answers</p>
          <ul className="mt-4 space-y-3">
            {stats.topDocuments.map((doc) => (
              <li key={doc.title} className="flex items-center justify-between gap-3 text-sm">
                <span className="min-w-0 truncate font-medium text-[var(--ui-ink)]">{doc.title}</span>
                <span className="shrink-0 rounded-full bg-[var(--ui-soft)] px-2 py-0.5 text-xs font-semibold text-[var(--ui-navy)]">
                  {doc.hits}
                </span>
              </li>
            ))}
          </ul>
        </section>
      </div>

      <section className="rounded-2xl border border-[var(--ui-line)] bg-white p-5 shadow-sm">
        <div className="mb-3 flex items-center gap-2">
          <Activity size={16} className="text-[var(--ui-navy)]" aria-hidden />
          <h2 className="text-sm font-semibold text-[var(--ui-navy)]">Recent activity</h2>
        </div>
        <ul className="divide-y divide-[var(--ui-line)]">
          {stats.recentActivity.map((item) => (
            <li key={item.id} className="flex items-start justify-between gap-3 py-3 text-sm">
              <div className="min-w-0">
                <p className="font-medium text-[var(--ui-ink)]">{item.label}</p>
                <p className="mt-0.5 text-xs text-[var(--ui-muted)]">
                  {new Date(item.at).toLocaleString()}
                </p>
              </div>
              <span
                className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${
                  item.tone === 'success'
                    ? 'bg-emerald-50 text-emerald-700'
                    : item.tone === 'warn'
                      ? 'bg-amber-50 text-amber-800'
                      : 'bg-[var(--ui-soft)] text-[var(--ui-navy)]'
                }`}
              >
                {item.tone}
              </span>
            </li>
          ))}
        </ul>
      </section>
    </div>
  )
}
