/** Escape a CSV cell and wrap in quotes when needed. */
function cell(value: string | number | null | undefined) {
  const raw = value == null ? '' : String(value)
  if (/[",\n\r]/.test(raw)) return `"${raw.replace(/"/g, '""')}"`
  return raw
}

/** Build a CSV string from headers + row objects. */
export function toCsv(headers: string[], rows: Array<Record<string, string | number | null | undefined>>) {
  const lines = [headers.map(cell).join(',')]
  for (const row of rows) {
    lines.push(headers.map((h) => cell(row[h])).join(','))
  }
  return `${lines.join('\n')}\n`
}

/** Trigger a browser download for a CSV string. */
export function downloadCsv(filename: string, csv: string) {
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}
