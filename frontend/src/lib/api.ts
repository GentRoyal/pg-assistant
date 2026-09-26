import type {
  ApiCitation,
  AskRequest,
  AskResponse,
  ChatApiResponse,
  HealthResponse,
} from '../types'

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

/** FastAPI puts the useful text in `detail`, which may be a string or a validation array. */
async function readError(res: Response): Promise<string> {
  const text = await res.text().catch(() => '')
  if (!text) return `The assistant could not answer right now (HTTP ${res.status}).`

  try {
    const body = JSON.parse(text) as { detail?: unknown }
    const detail = body.detail
    if (typeof detail === 'string') return detail
    if (Array.isArray(detail)) {
      return detail
        .map((item) => (item as { msg?: string }).msg ?? JSON.stringify(item))
        .join('; ')
    }
  } catch {
    // not JSON, fall through to the raw text
  }

  return text
}

function pageOf(citation: ApiCitation) {
  return citation.page_start ?? undefined
}

function mapCitations(citations: ApiCitation[] = []): AskResponse['sources'] {
  return citations.map((citation) => ({
    document_title: citation.title || citation.source || 'Regulation document',
    section: citation.section_title ?? undefined,
    page: pageOf(citation) ?? undefined,
    chunk_text: citation.content ?? '',
    score: citation.similarity ?? undefined,
  }))
}

/**
 * The API reports per-chunk similarity, not a calibrated answer confidence.
 * The strongest match is the closest honest proxy we have.
 */
function confidenceFrom(citations: ApiCitation[] = []) {
  const scores = citations
    .map((citation) => citation.similarity)
    .filter((score): score is number => typeof score === 'number')

  return scores.length ? Math.max(...scores) : undefined
}

export function toAskResponse(data: ChatApiResponse): AskResponse {
  return {
    answer: data.answer,
    sources: mapCitations(data.citations),
    confidence: confidenceFrom(data.citations),
    conversation_id: data.conversation_id,
    llm: data.llm,
    searchQuery: data.search_query,
    latencyMs: data.latency_ms,
  }
}

export async function askQuestion(
  payload: AskRequest,
  options: { apiBaseUrl?: string; token?: string },
): Promise<AskResponse> {
  const files = payload.files ?? []

  if (files.length > 0) {
    throw new ApiError(
      'This assistant answers from the ingested regulation documents only — it cannot read attachments yet. Ask your question without the file, or have the document ingested first.',
      400,
    )
  }

  const base = resolveApiBase(options.apiBaseUrl)
  const headers: Record<string, string> = {}
  if (options.token) headers.Authorization = `Bearer ${options.token}`

  const body: Record<string, unknown> = { question: payload.question }
  if (payload.conversation_id) body.conversation_id = payload.conversation_id
  if (payload.llmProvider && payload.llmProvider !== 'default') {
    body.llm_provider = payload.llmProvider
  }
  if (payload.llmModel?.trim()) body.llm_model = payload.llmModel.trim()

  let res: Response
  try {
    res = await fetch(`${base}/chat`, {
      method: 'POST',
      headers: { ...headers, 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
  } catch {
    throw new ApiError(
      `Could not reach the API at ${base}. Check that it is running (uvicorn api.main:app --port 8000) and that the base URL in Settings is correct.`,
      0,
    )
  }

  if (!res.ok) throw new ApiError(await readError(res), res.status)

  return toAskResponse((await res.json()) as ChatApiResponse)
}

export async function checkHealth(apiBaseUrl?: string): Promise<HealthResponse> {
  const base = resolveApiBase(apiBaseUrl)

  let res: Response
  try {
    res = await fetch(`${base}/health`)
  } catch {
    throw new ApiError(`Could not reach the API at ${base}.`, 0)
  }

  if (!res.ok) throw new ApiError(await readError(res), res.status)
  return (await res.json()) as HealthResponse
}
