import { z } from 'zod'
import type { ResolvedFilterConfig } from '@/server/plugins/filter/filter.config'
import type { ImageCategory, TextCategory } from '@/server/plugins/filter/filter-schemas'

// OpenRouter Decisions transport for `perplexity/pplx-decider-v1.2`. This
// model is served only by `/api/alpha/decisions` (`text+image -> decisions`):
// it reads a `state` and returns one calibrated probability per question, it
// is not OpenAI-compatible, and `/chat/completions` rejects it with a 400.
// One `fetch` call carries the request, with no retries: the caller's timeout is
// the whole budget. The answer is checked with zod, so API drift degrades to a
// `DeciderError`, never to a misread verdict.

export type DeciderReason = 'timeout' | 'http' | 'malformed' | 'schema' | 'missing_key'

export class DeciderError extends Error {
  reason: DeciderReason
  constructor(reason: DeciderReason, message: string) {
    super(message)
    this.name = 'DeciderError'
    this.reason = reason
  }
}

export type DeciderQuestion = {
  type: 'noul'
  instructions: string
  criteria: { true: string; false: string }
}

export type DeciderStatePart = string | { type: 'image_url'; image_url: { url: string; detail: 'low' } }

export type DeciderRequest = {
  model: string
  state: DeciderStatePart[]
  questions: Record<string, DeciderQuestion>
}

export type DeciderSender = (request: DeciderRequest) => Promise<unknown>

export type DeciderSignal = { category: TextCategory | ImageCategory; confidence: number }
export type DeciderVerdict = { textSignals: DeciderSignal[]; imageSignals: DeciderSignal[] }

const decisionsResponseSchema = z.object({
  answers: z.record(z.string(), z.object({ type: z.string(), noul: z.number().min(0).max(1) })),
})

function createFetchSender(apiKey: string, baseUrl: string, fetcher: typeof fetch): DeciderSender {
  return async (request) => {
    let response: Response
    try {
      response = await fetcher(`${baseUrl.replace(/\/$/, '')}/api/alpha/decisions`, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          authorization: `Bearer ${apiKey}`,
          'x-title': 'last-comments filter',
        },
        body: JSON.stringify(request),
      })
    } catch (cause) {
      throw new DeciderError(
        'http',
        `OpenRouter fetch failed: ${cause instanceof Error ? cause.message : String(cause)}`,
      )
    }
    if (!response.ok) throw new DeciderError('http', `OpenRouter HTTP ${response.status}`)
    try {
      return await response.json()
    } catch {
      throw new DeciderError('malformed', 'OpenRouter response was not JSON')
    }
  }
}

export type CallDeciderInput = {
  state: string
  questions: Record<string, DeciderQuestion>
  imageDataUrls: readonly string[]
}

export async function callDecider(
  input: CallDeciderInput,
  settings: ResolvedFilterConfig['openrouter'],
  deps: { sender?: DeciderSender; fetcher?: typeof fetch } = {},
): Promise<DeciderVerdict> {
  const { apiKey, model, baseUrl, timeoutMs } = settings
  if (!apiKey) throw new DeciderError('missing_key', 'OPENROUTER_API_KEY is not configured')

  const request: DeciderRequest = {
    model,
    state: [
      input.state,
      ...input.imageDataUrls.map((url): DeciderStatePart => ({ type: 'image_url', image_url: { url, detail: 'low' } })),
    ],
    questions: input.questions,
  }

  const sender = deps.sender ?? createFetchSender(apiKey, baseUrl, deps.fetcher ?? fetch)

  const timeout = Promise.withResolvers<never>()
  const timer = setTimeout(
    () => timeout.reject(new DeciderError('timeout', `Decider timed out after ${timeoutMs}ms`)),
    timeoutMs,
  )
  let response: unknown
  try {
    response = await Promise.race([sender(request), timeout.promise])
  } catch (error) {
    if (error instanceof DeciderError) throw error
    throw new DeciderError('http', error instanceof Error ? error.message : String(error))
  } finally {
    clearTimeout(timer)
  }

  const parsed = decisionsResponseSchema.safeParse(response)
  if (!parsed.success) throw new DeciderError('malformed', 'OpenRouter response shape was unrecognised')

  const answers = new Map(Object.entries(parsed.data.answers).map(([key, answer]) => [key, answer.noul]))
  const verdict: DeciderVerdict = { textSignals: [], imageSignals: [] }
  for (const key of Object.keys(input.questions)) {
    const confidence = answers.get(key)
    if (confidence === undefined) throw new DeciderError('schema', `Decider omitted the answer for ${key}`)
    if (key.startsWith('text:')) {
      verdict.textSignals.push({ category: key.slice('text:'.length) as TextCategory, confidence })
    } else {
      // Keys are `image:<index>:<category>`; only the category drives the verdict.
      verdict.imageSignals.push({ category: key.slice(key.lastIndexOf(':') + 1) as ImageCategory, confidence })
    }
  }
  return verdict
}
