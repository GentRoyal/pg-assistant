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
  options: { apiBaseUrl?: string; useMock?: boolean; token?: string },
): Promise<AskResponse> {
  const files = payload.files ?? []

  if (options.useMock) {
    const { mockAsk } = await import('./mockAnswers')
    return mockAsk(payload.question, files)
  }

  const base = resolveApiBase(options.apiBaseUrl)
  const headers: Record<string, string> = {}
  if (options.token) headers.Authorization = `Bearer ${options.token}`

  let res: Response
  if (files.length > 0) {
    const form = new FormData()
    form.append('question', payload.question)
    if (payload.conversation_id) form.append('conversation_id', payload.conversation_id)
    for (const file of files) form.append('files', file)

    res = await fetch(`${base}/ask`, {
      method: 'POST',
      headers,
      body: form,
    })
  } else {
    res = await fetch(`${base}/ask`, {
      method: 'POST',
      headers: { ...headers, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        question: payload.question,
        conversation_id: payload.conversation_id,
      }),
    })
  }

  if (!res.ok) {
    const text = await res.text().catch(() => '')
    throw new ApiError(text || 'The assistant could not answer right now.', res.status)
  }

  return (await res.json()) as AskResponse
}
