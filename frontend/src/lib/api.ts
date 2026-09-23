import type { AskRequest, AskResponse } from '../types'

const DEFAULT_API = import.meta.env.VITE_API_BASE_URL?.replace(/\/$/, '') ?? ''

export function resolveApiBase(override?: string) {
  const base = (override ?? DEFAULT_API).replace(/\/$/, '')
  return base || '/api'
}

export class ApiError extends Error {
  status: number

  constructor(message: string, status = 500) {
    super(message)
    this.name = 'ApiError'
    this.status = status
  }
}

export async function askQuestion(
  payload: AskRequest,
  options: { apiBaseUrl?: string; useMock?: boolean },
): Promise<AskResponse> {
  if (options.useMock) {
    const { mockAsk } = await import('./mockAnswers')
    return mockAsk(payload.question)
  }

  const base = resolveApiBase(options.apiBaseUrl)
  const res = await fetch(`${base}/ask`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })

  if (!res.ok) {
    const text = await res.text().catch(() => '')
    throw new ApiError(text || 'The assistant could not answer right now.', res.status)
  }

  return (await res.json()) as AskResponse
}
