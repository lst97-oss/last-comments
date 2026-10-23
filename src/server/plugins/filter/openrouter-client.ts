import { z } from 'zod'
import type { ResolvedFilterConfig } from '@/server/plugins/filter/filter.config'
import type { ImageCategory, TextCategory } from '@/server/plugins/filter/filter-schemas'

// OpenRouter Decisions transport for `perplexity/pplx-decider-v1.2`. This
// model is served only by `/api/alpha/decisions` (`text+image -> decisions`):
// it reads a `state` and returns one calibrated probability per question, it
// is not OpenAI-compatible, and `/chat/completions` rejects it with a 400.
// Primary path is the official `@openrouter/sdk` (`client.alpha.decisions.
// create`, response already unwrapped); a same-body raw-`fetch` fallback
// covers a missing SDK install. Callers never branch on transport.
//
// Verified SDK shapes (@openrouter/sdk 1.5.3, Speakeasy):
// `new OpenRouter({ apiKey })`, `client.alpha.decisions.create({
// decisionsRequest }, { serverURL })` resolving to `DecisionsResponse`.
// Everything below the `DeciderSender` boundary is defensive unknown handling
// so SDK/API drift degrades to `DeciderError`, never to a misread verdict.

export type DeciderReason = 'timeout' | 'http' | 'malformed' | 'schema' | 'missing_key' | 'sdk_unsupported'

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

function createSdkSender(apiKey: string, baseUrl: string): DeciderSender {
  return async (request) => {
    let client: {
      alpha: { decisions: { create: (args: unknown, options?: unknown) => Promise<unknown> } }
    }
    try {
      // Dynamic import: a missing install degrades to the fetch fallback
      // instead of crashing the plugin host at module load.
      const sdk = (await import('@openrouter/sdk')) as unknown as {
        OpenRouter: new (options: { apiKey: string }) => typeof client
      }
      client = new sdk.OpenRouter({ apiKey })
    } catch {
      throw new DeciderError('sdk_unsupported', 'OpenRouter SDK is not installed')
    }
    if (typeof client.alpha?.decisions?.create !== 'function') {
      throw new DeciderError('sdk_unsupported', 'OpenRouter SDK has no decisions client')
    }
    try {
      return await client.alpha.decisions.create({ decisionsRequest: request }, { serverURL: baseUrl })
    } catch (cause) {
      throw new DeciderError(
        'http',
        `OpenRouter SDK request failed: ${cause instanceof Error ? cause.message : String(cause)}`,
      )
    }
  }
}

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

  const run = async (): Promise<unknown> => {
    if (deps.sender) return deps.sender(request)
    try {
      return await createSdkSender(apiKey, baseUrl)(request)
    } catch (error) {
      if (error instanceof DeciderError && error.reason === 'sdk_unsupported') {
        return createFetchSender(apiKey, baseUrl, deps.fetcher ?? fetch)(request)
      }
      throw error
    }
  }

  const timeout = Promise.withResolvers<never>()
  const timer = setTimeout(
    () => timeout.reject(new DeciderError('timeout', `Decider timed out after ${timeoutMs}ms`)),
    timeoutMs,
  )
  let response: unknown
  try {
    response = await Promise.race([run(), timeout.promise])
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
