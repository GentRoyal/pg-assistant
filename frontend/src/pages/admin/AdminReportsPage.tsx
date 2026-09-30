import { useEffect, useMemo, useState } from 'react'
import { Download } from 'lucide-react'
import {
  fetchAllDocumentReportRows,
  fetchAllQueryReportRows,
  fetchDocumentReport,
  fetchQueryReport,
} from '../../lib/adminApi'
import { useAdminApiOptions } from '../../hooks/useAdminApiOptions'
import { downloadCsv, toCsv } from '../../lib/csv'
import type { Paginated, ReportDocumentRow, ReportQueryRow } from '../../types'
import { Button } from '../../components/ui/Button'

type Tab = 'queries' | 'documents'

function Pagination({
  page,
  pageSize,
  total,
  onPage,
}: {
  page: number
  pageSize: number
  total: number
  onPage: (p: number) => void
}) {
  const pages = Math.max(1, Math.ceil(total / pageSize))
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 border-t border-[var(--ui-line)] px-4 py-3">
      <p className="text-xs text-[var(--ui-muted)]">
        Showing {(page - 1) * pageSize + (total ? 1 : 0)}–
        {Math.min(page * pageSize, total)} of {total}
      </p>
      <div className="flex gap-2">
        <Button
          variant="secondary"
          className="!min-h-8 !px-3 !py-1 !text-xs"
          disabled={page <= 1}
          onClick={() => onPage(page - 1)}
        >
          Previous
        </Button>
        <span className="self-center text-xs text-[var(--ui-muted)]">
          Page {page} / {pages}
        </span>
        <Button
          variant="secondary"
          className="!min-h-8 !px-3 !py-1 !text-xs"
          disabled={page >= pages}
          onClick={() => onPage(page + 1)}
        >
          Next
        </Button>
      </div>
    </div>
  )
}

export function AdminReportsPage() {
  const apiOpts = useAdminApiOptions()
  const [tab, setTab] = useState<Tab>('queries')
  const [q, setQ] = useState('')
  const [status, setStatus] = useState('all')
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(5)
  const [loading, setLoading] = useState(true)
  const [exporting, setExporting] = useState(false)
  const [queryData, setQueryData] = useState<Paginated<ReportQueryRow> | null>(null)
  const [docData, setDocData] = useState<Paginated<ReportDocumentRow> | null>(null)

  const filtersKey = useMemo(
    () => JSON.stringify({ tab, q, status, from, to, page, pageSize }),
    [tab, q, status, from, to, page, pageSize],
  )

  useEffect(() => {
    let alive = true
    setLoading(true)
    const run = async () => {
      if (tab === 'queries') {
        const data = await fetchQueryReport(
          {
            q,
            status: status as 'all' | 'answered' | 'weak' | 'error',
            from: from || undefined,
            to: to || undefined,
            page,
            pageSize,
          },
          apiOpts,
        )
        if (alive) setQueryData(data)
      } else {
        const data = await fetchDocumentReport(
          {
            q,
            status: status as 'all' | 'ready' | 'processing' | 'failed',
            page,
            pageSize,
          },
          apiOpts,
        )
        if (alive) setDocData(data)
      }
    }
    void run().finally(() => {
      if (alive) setLoading(false)
    })
    return () => {
      alive = false
    }
  }, [filtersKey, tab, q, status, from, to, page, pageSize, apiOpts])

  const resetFilters = () => {
    setQ('')
    setStatus('all')
    setFrom('')
    setTo('')
    setPage(1)
  }

  const onExport = async () => {
    setExporting(true)
    try {
      if (tab === 'queries') {
        const rows = await fetchAllQueryReportRows(
          {
            q,
            status: status as 'all' | 'answered' | 'weak' | 'error',
            from: from || undefined,
            to: to || undefined,
          },
          apiOpts,
        )
        const csv = toCsv(
          ['askedAt', 'studentEmail', 'question', 'status', 'latencyMs', 'topSource'],
          rows.map((r) => ({
            askedAt: r.askedAt,
            studentEmail: r.studentEmail,
            question: r.question,
            status: r.status,
            latencyMs: r.latencyMs,
            topSource: r.topSource,
          })),
        )
        downloadCsv(`pg-assistant-query-report-${Date.now()}.csv`, csv)
      } else {
        const rows = await fetchAllDocumentReportRows(
          {
            q,
            status: status as 'all' | 'ready' | 'processing' | 'failed',
          },
          apiOpts,
        )
        const csv = toCsv(
          ['title', 'documentType', 'hits', 'status', 'lastCitedAt'],
          rows.map((r) => ({
            title: r.title,
            documentType: r.documentType,
            hits: r.hits,
            status: r.status,
            lastCitedAt: r.lastCitedAt,
          })),
        )
        downloadCsv(`pg-assistant-document-report-${Date.now()}.csv`, csv)
      }
    } finally {
      setExporting(false)
    }
  }

  return (
    <div className="mx-auto max-w-6xl space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-[var(--ui-navy)] sm:text-2xl">Reports</h1>
          <p className="mt-1 text-sm text-[var(--ui-muted)]">
            Filterable, paginated reports for queries and document usage.
          </p>
        </div>
        <Button
          variant="secondary"
          className="!min-h-10"
          disabled={exporting || loading}
          onClick={() => void onExport()}
        >
          <Download size={14} aria-hidden />
          {exporting ? 'Exporting…' : 'Export CSV'}
        </Button>
      </div>

      <div className="flex flex-wrap gap-2">
        {(
          [
            ['queries', 'Query log'],
            ['documents', 'Document usage'],
          ] as const
        ).map(([id, label]) => (
          <button
            key={id}
            type="button"
            onClick={() => {
              setTab(id)
              setStatus('all')
              setPage(1)
            }}
            className={`rounded-full px-3.5 py-1.5 text-sm font-medium transition ${
              tab === id
                ? 'bg-[var(--ui-navy)] text-white'
                : 'bg-white text-[var(--ui-navy)] ring-1 ring-[var(--ui-line)] hover:bg-[var(--ui-soft)]'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      <section className="rounded-2xl border border-[var(--ui-line)] bg-white p-4 shadow-sm">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          <label className="block text-xs font-semibold text-[var(--ui-navy)] lg:col-span-2">
            Search
            <input
              value={q}
              onChange={(e) => {
                setQ(e.target.value)
                setPage(1)
              }}
              placeholder={tab === 'queries' ? 'Question, student, source…' : 'Title or type…'}
              className="mt-1 w-full rounded-xl border border-[var(--ui-line)] bg-[var(--ui-soft)] px-3 py-2 text-sm outline-none focus:border-[var(--ui-navy)]"
            />
          </label>
          <label className="block text-xs font-semibold text-[var(--ui-navy)]">
            Status
            <select
              value={status}
              onChange={(e) => {
                setStatus(e.target.value)
                setPage(1)
              }}
              className="mt-1 w-full rounded-xl border border-[var(--ui-line)] bg-[var(--ui-soft)] px-3 py-2 text-sm outline-none focus:border-[var(--ui-navy)]"
            >
              <option value="all">All</option>
              {tab === 'queries' ? (
                <>
                  <option value="answered">Answered</option>
                  <option value="weak">Weak</option>
                  <option value="error">Error</option>
                </>
              ) : (
                <>
                  <option value="ready">Ready</option>
                  <option value="processing">Processing</option>
                  <option value="failed">Failed</option>
                </>
              )}
            </select>
          </label>
          {tab === 'queries' ? (
            <>
              <label className="block text-xs font-semibold text-[var(--ui-navy)]">
                From
                <input
                  type="date"
                  value={from}
                  onChange={(e) => {
                    setFrom(e.target.value)
                    setPage(1)
                  }}
                  className="mt-1 w-full rounded-xl border border-[var(--ui-line)] bg-[var(--ui-soft)] px-3 py-2 text-sm outline-none focus:border-[var(--ui-navy)]"
                />
              </label>
              <label className="block text-xs font-semibold text-[var(--ui-navy)]">
                To
                <input
                  type="date"
                  value={to}
                  onChange={(e) => {
                    setTo(e.target.value)
                    setPage(1)
                  }}
                  className="mt-1 w-full rounded-xl border border-[var(--ui-line)] bg-[var(--ui-soft)] px-3 py-2 text-sm outline-none focus:border-[var(--ui-navy)]"
                />
              </label>
            </>
          ) : (
            <label className="block text-xs font-semibold text-[var(--ui-navy)]">
              Page size
              <select
                value={pageSize}
                onChange={(e) => {
                  setPageSize(Number(e.target.value))
                  setPage(1)
                }}
                className="mt-1 w-full rounded-xl border border-[var(--ui-line)] bg-[var(--ui-soft)] px-3 py-2 text-sm outline-none focus:border-[var(--ui-navy)]"
              >
                <option value={5}>5</option>
                <option value={10}>10</option>
              </select>
            </label>
          )}
        </div>
        <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
          {tab === 'queries' ? (
            <label className="text-xs font-semibold text-[var(--ui-navy)]">
              Page size{' '}
              <select
                value={pageSize}
                onChange={(e) => {
                  setPageSize(Number(e.target.value))
                  setPage(1)
                }}
                className="ml-2 rounded-lg border border-[var(--ui-line)] bg-[var(--ui-soft)] px-2 py-1"
              >
                <option value={5}>5</option>
                <option value={10}>10</option>
              </select>
            </label>
          ) : (
            <span />
          )}
          <Button variant="secondary" className="!min-h-8 !text-xs" onClick={resetFilters}>
            Reset filters
          </Button>
        </div>
      </section>

      <div className="overflow-hidden rounded-2xl border border-[var(--ui-line)] bg-white shadow-sm">
        {loading ? (
          <p className="px-4 py-10 text-center text-sm text-[var(--ui-muted)]">Loading report…</p>
        ) : tab === 'queries' && queryData ? (
          <>
            {/* Mobile cards */}
            <ul className="divide-y divide-[var(--ui-line)] md:hidden">
              {queryData.items.length === 0 ? (
                <li className="px-4 py-8 text-center text-sm text-[var(--ui-muted)]">
                  No rows match these filters.
                </li>
              ) : (
                queryData.items.map((row) => (
                  <li key={row.id} className="space-y-1 px-4 py-3">
                    <p className="text-sm font-medium text-[var(--ui-ink)]">{row.question}</p>
                    <p className="text-xs text-[var(--ui-muted)]">{row.studentEmail}</p>
                    <div className="flex flex-wrap gap-2 text-xs">
                      <span className="capitalize">{row.status}</span>
                      <span>·</span>
                      <span>{row.latencyMs ? `${row.latencyMs} ms` : '—'}</span>
                      <span>·</span>
                      <span>{row.topSource}</span>
                    </div>
                  </li>
                ))
              )}
            </ul>

            <div className="hidden overflow-x-auto md:block">
              <table className="min-w-full text-left text-sm">
                <thead className="bg-[var(--ui-soft)] text-xs uppercase tracking-wide text-[var(--ui-muted)]">
                  <tr>
                    <th className="px-4 py-3 font-semibold">When</th>
                    <th className="px-4 py-3 font-semibold">Student</th>
                    <th className="px-4 py-3 font-semibold">Question</th>
                    <th className="px-4 py-3 font-semibold">Status</th>
                    <th className="px-4 py-3 font-semibold">Latency</th>
                    <th className="px-4 py-3 font-semibold">Top source</th>
                  </tr>
                </thead>
                <tbody>
                  {queryData.items.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="px-4 py-8 text-center text-[var(--ui-muted)]">
                        No rows match these filters.
                      </td>
                    </tr>
                  ) : (
                    queryData.items.map((row) => (
                      <tr key={row.id} className="border-t border-[var(--ui-line)]">
                        <td className="whitespace-nowrap px-4 py-3 text-xs text-[var(--ui-muted)]">
                          {new Date(row.askedAt).toLocaleString()}
                        </td>
                        <td className="px-4 py-3 text-xs">{row.studentEmail}</td>
                        <td className="max-w-[280px] truncate px-4 py-3 font-medium">{row.question}</td>
                        <td className="px-4 py-3">
                          <span
                            className={`rounded-full px-2 py-0.5 text-[11px] font-semibold capitalize ${
                              row.status === 'answered'
                                ? 'bg-emerald-50 text-emerald-700'
                                : row.status === 'weak'
                                  ? 'bg-amber-50 text-amber-800'
                                  : 'bg-red-50 text-red-700'
                            }`}
                          >
                            {row.status}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-xs">
                          {row.latencyMs ? `${row.latencyMs} ms` : '—'}
                        </td>
                        <td className="px-4 py-3 text-xs text-[var(--ui-muted)]">{row.topSource}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
            <Pagination
              page={queryData.page}
              pageSize={queryData.pageSize}
              total={queryData.total}
              onPage={setPage}
            />
          </>
        ) : docData ? (
          <>
            <ul className="divide-y divide-[var(--ui-line)] md:hidden">
              {docData.items.length === 0 ? (
                <li className="px-4 py-8 text-center text-sm text-[var(--ui-muted)]">
                  No rows match these filters.
                </li>
              ) : (
                docData.items.map((row) => (
                  <li key={row.id} className="px-4 py-3">
                    <p className="font-medium text-[var(--ui-ink)]">{row.title}</p>
                    <p className="mt-1 text-xs text-[var(--ui-muted)]">
                      {row.documentType} · {row.hits} hits · {row.status}
                    </p>
                  </li>
                ))
              )}
            </ul>
            <div className="hidden overflow-x-auto md:block">
              <table className="min-w-full text-left text-sm">
                <thead className="bg-[var(--ui-soft)] text-xs uppercase tracking-wide text-[var(--ui-muted)]">
                  <tr>
                    <th className="px-4 py-3 font-semibold">Document</th>
                    <th className="px-4 py-3 font-semibold">Type</th>
                    <th className="px-4 py-3 font-semibold">Hits</th>
                    <th className="px-4 py-3 font-semibold">Status</th>
                    <th className="px-4 py-3 font-semibold">Last cited</th>
                  </tr>
                </thead>
                <tbody>
                  {docData.items.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="px-4 py-8 text-center text-[var(--ui-muted)]">
                        No rows match these filters.
                      </td>
                    </tr>
                  ) : (
                    docData.items.map((row) => (
                      <tr key={row.id} className="border-t border-[var(--ui-line)]">
                        <td className="px-4 py-3 font-medium">{row.title}</td>
                        <td className="px-4 py-3 text-[var(--ui-muted)]">{row.documentType}</td>
                        <td className="px-4 py-3">{row.hits}</td>
                        <td className="px-4 py-3 capitalize">{row.status}</td>
                        <td className="px-4 py-3 text-xs text-[var(--ui-muted)]">
                          {row.lastCitedAt ? new Date(row.lastCitedAt).toLocaleDateString() : '—'}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
            <Pagination
              page={docData.page}
              pageSize={docData.pageSize}
              total={docData.total}
              onPage={setPage}
            />
          </>
        ) : null}
      </div>
    </div>
  )
}
