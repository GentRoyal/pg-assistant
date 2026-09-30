import { useCallback, useEffect, useRef, useState } from 'react'
import { RefreshCw, Trash2, Upload } from 'lucide-react'
import {
  deleteAdminDocument,
  fetchAdminDocuments,
  replaceAdminDocument,
  uploadAdminDocument,
} from '../../lib/adminApi'
import { useAdminApiOptions } from '../../hooks/useAdminApiOptions'
import type { AdminDocument } from '../../types'
import { ADMIN_DOC_ACCEPT } from '../../types'
import { Button } from '../../components/ui/Button'
import { Modal } from '../../components/ui/Modal'

function formatBytes(n: number) {
  if (n < 1024) return `${n} B`
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`
  return `${(n / (1024 * 1024)).toFixed(1)} MB`
}

function StatusPill({ status }: { status: AdminDocument['status'] }) {
  const styles =
    status === 'ready'
      ? 'bg-emerald-50 text-emerald-700'
      : status === 'processing'
        ? 'bg-sky-50 text-sky-700'
        : 'bg-red-50 text-red-700'
  return (
    <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold capitalize ${styles}`}>
      {status}
    </span>
  )
}

/** The server's reason for a failure, or a note such as skipped scanned pages. */
function DocNote({ doc }: { doc: AdminDocument }) {
  if (!doc.error) return null
  const tone = doc.status === 'failed' ? 'text-[var(--ui-danger)]' : 'text-[var(--ui-muted)]'
  return <p className={`mt-0.5 max-w-md text-xs ${tone}`}>{doc.error}</p>
}

function DocActions({
  doc,
  busy,
  onReplace,
  onDelete,
}: {
  doc: AdminDocument
  busy: boolean
  onReplace: () => void
  onDelete: () => void
}) {
  return (
    <div className="flex flex-wrap gap-1.5">
      <Button
        variant="secondary"
        className="!min-h-8 !px-2.5 !py-1 !text-xs"
        disabled={busy}
        onClick={onReplace}
      >
        Update
      </Button>
      <Button
        variant="ghost"
        className="!min-h-8 !px-2 !py-1 !text-[var(--ui-danger)]"
        disabled={busy}
        aria-label={`Delete ${doc.title}`}
        onClick={onDelete}
      >
        <Trash2 size={14} />
      </Button>
    </div>
  )
}

export function AdminDocumentsPage() {
  const apiOpts = useAdminApiOptions()
  const [docs, setDocs] = useState<AdminDocument[]>([])
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [deleteId, setDeleteId] = useState<string | null>(null)
  const [replaceId, setReplaceId] = useState<string | null>(null)
  const uploadRef = useRef<HTMLInputElement>(null)
  const replaceRef = useRef<HTMLInputElement>(null)

  const reload = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      setDocs(await fetchAdminDocuments(apiOpts))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load documents.')
    } finally {
      setLoading(false)
    }
  }, [apiOpts])

  useEffect(() => {
    void reload()
  }, [reload])

  // Uploads are processed on the server; refresh quietly until none are still processing.
  const processing = docs.some((d) => d.status === 'processing')
  useEffect(() => {
    if (!processing) return
    const timer = window.setInterval(() => {
      fetchAdminDocuments(apiOpts)
        .then(setDocs)
        .catch(() => undefined)
    }, 5000)
    return () => window.clearInterval(timer)
  }, [processing, apiOpts])

  const onUpload = async (files: FileList | null) => {
    const file = files?.[0]
    if (!file) return
    if (!file.name.toLowerCase().endsWith('.pdf')) {
      setError('Please upload a PDF document.')
      return
    }
    setBusy(true)
    setError(null)
    try {
      await uploadAdminDocument(file, apiOpts)
      await reload()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Upload failed.')
    } finally {
      setBusy(false)
      if (uploadRef.current) uploadRef.current.value = ''
    }
  }

  const onReplace = async (files: FileList | null) => {
    const file = files?.[0]
    if (!file || !replaceId) return
    setBusy(true)
    setError(null)
    try {
      await replaceAdminDocument(replaceId, file, apiOpts)
      setReplaceId(null)
      await reload()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Update failed.')
    } finally {
      setBusy(false)
      if (replaceRef.current) replaceRef.current.value = ''
    }
  }

  const confirmDelete = async () => {
    if (!deleteId) return
    setBusy(true)
    try {
      await deleteAdminDocument(deleteId, apiOpts)
      setDeleteId(null)
      await reload()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Delete failed.')
    } finally {
      setBusy(false)
    }
  }

  const startReplace = (id: string) => {
    setReplaceId(id)
    replaceRef.current?.click()
  }

  return (
    <div className="mx-auto max-w-6xl space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-[var(--ui-navy)] sm:text-2xl">
            Documents
          </h1>
          <p className="mt-1 text-sm text-[var(--ui-muted)]">
            Upload, replace, or remove regulation PDFs in the knowledge base.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="secondary" onClick={() => void reload()} disabled={busy || loading}>
            <RefreshCw size={14} aria-hidden />
            Refresh
          </Button>
          <input
            ref={uploadRef}
            type="file"
            accept={ADMIN_DOC_ACCEPT}
            className="sr-only"
            onChange={(e) => void onUpload(e.target.files)}
          />
          <Button onClick={() => uploadRef.current?.click()} disabled={busy}>
            <Upload size={14} aria-hidden />
            Upload PDF
          </Button>
        </div>
      </div>

      {error ? (
        <p role="alert" className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </p>
      ) : null}

      <div className="overflow-hidden rounded-2xl border border-[var(--ui-line)] bg-white shadow-sm">
        {loading ? (
          <p className="px-4 py-10 text-center text-sm text-[var(--ui-muted)]">Loading documents…</p>
        ) : docs.length === 0 ? (
          <div className="px-4 py-12 text-center">
            <p className="text-sm font-medium text-[var(--ui-navy)]">No documents yet</p>
            <p className="mt-1 text-sm text-[var(--ui-muted)]">
              Upload the first handbook PDF to seed the knowledge base.
            </p>
            <Button className="mt-4" onClick={() => uploadRef.current?.click()} disabled={busy}>
              <Upload size={14} aria-hidden />
              Upload PDF
            </Button>
          </div>
        ) : (
          <>
            {/* Mobile cards */}
            <ul className="divide-y divide-[var(--ui-line)] md:hidden">
              {docs.map((doc) => (
                <li key={doc.id} className="space-y-2 px-4 py-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="font-medium text-[var(--ui-ink)]">{doc.title}</p>
                      <p className="text-xs text-[var(--ui-muted)]">
                        {doc.fileName} · {formatBytes(doc.sizeBytes)}
                      </p>
                      <DocNote doc={doc} />
                    </div>
                    <StatusPill status={doc.status} />
                  </div>
                  <p className="text-xs text-[var(--ui-muted)]">
                    {doc.documentType} · {doc.pages || '—'} pages · {doc.chunks || '—'} chunks ·{' '}
                    {new Date(doc.updatedAt).toLocaleDateString()}
                  </p>
                  <DocActions
                    doc={doc}
                    busy={busy}
                    onReplace={() => startReplace(doc.id)}
                    onDelete={() => setDeleteId(doc.id)}
                  />
                </li>
              ))}
            </ul>

            <div className="hidden overflow-x-auto md:block">
              <table className="min-w-full text-left text-sm">
                <thead className="bg-[var(--ui-soft)] text-xs uppercase tracking-wide text-[var(--ui-muted)]">
                  <tr>
                    <th className="px-4 py-3 font-semibold">Document</th>
                    <th className="px-4 py-3 font-semibold">Type</th>
                    <th className="px-4 py-3 font-semibold">Pages</th>
                    <th className="px-4 py-3 font-semibold">Chunks</th>
                    <th className="px-4 py-3 font-semibold">Status</th>
                    <th className="px-4 py-3 font-semibold">Updated</th>
                    <th className="px-4 py-3 font-semibold">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {docs.map((doc) => (
                    <tr key={doc.id} className="border-t border-[var(--ui-line)]">
                      <td className="px-4 py-3">
                        <p className="font-medium text-[var(--ui-ink)]">{doc.title}</p>
                        <p className="text-xs text-[var(--ui-muted)]">
                          {doc.fileName} · {formatBytes(doc.sizeBytes)}
                        </p>
                        <DocNote doc={doc} />
                      </td>
                      <td className="px-4 py-3 text-[var(--ui-muted)]">{doc.documentType}</td>
                      <td className="px-4 py-3">{doc.pages || '—'}</td>
                      <td className="px-4 py-3">{doc.chunks || '—'}</td>
                      <td className="px-4 py-3">
                        <StatusPill status={doc.status} />
                      </td>
                      <td className="px-4 py-3 text-xs text-[var(--ui-muted)]">
                        {new Date(doc.updatedAt).toLocaleDateString()}
                      </td>
                      <td className="px-4 py-3">
                        <DocActions
                          doc={doc}
                          busy={busy}
                          onReplace={() => startReplace(doc.id)}
                          onDelete={() => setDeleteId(doc.id)}
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>

      <input
        ref={replaceRef}
        type="file"
        accept={ADMIN_DOC_ACCEPT}
        className="sr-only"
        onChange={(e) => void onReplace(e.target.files)}
      />

      <Modal
        open={Boolean(deleteId)}
        title="Delete document?"
        onClose={() => setDeleteId(null)}
      >
        <p className="text-sm text-[var(--ui-muted)]">
          This removes the document from the assistant’s knowledge base. This cannot be undone.
        </p>
        <div className="mt-5 flex justify-end gap-2">
          <Button variant="secondary" onClick={() => setDeleteId(null)}>
            Cancel
          </Button>
          <Button variant="danger" disabled={busy} onClick={() => void confirmDelete()}>
            Delete
          </Button>
        </div>
      </Modal>
    </div>
  )
}
