import { z } from 'zod'
import type { ResolvedFilterConfig } from '@/server/plugins/filter/filter.config'
import { buildActiveVerdictSchema, type ImageCategory, type TextCategory } from '@/server/plugins/filter/filter-schemas'

// OpenRouter decider transport. Primary path is the official `@openrouter/sdk`
// (`chat.send`, non-streaming); a same-signature raw-`fetch` fallback covers a
// missing SDK install or an SDK-level rejection. Both paths send the identical
// strict-`json_schema` payload and return the parsed active verdict — callers
// never branch on transport.
//
// Verified SDK shapes (@openrouter/sdk 1.4.25, Speakeasy): `new OpenRouter({
// apiKey })`, `client.chat.send({ chatRequest: { model, messages,
// temperature, topP, maxTokens, responseFormat, stream: false } })` resolving
// to a `Result` union (`{ ok: true, value } | { ok: false, error }`).
// Everything below the `ChatSender` boundary is defensive unknown-handling so
// an SDK/API drift degrades to `DeciderError`, never to a misread verdict.

export type DeciderReason = 'timeout' | 'http' | 'malformed' | 'schema' | 'missing_key' | 'sdk_unsupported'

export class DeciderError extends Error {
  reason: DeciderReason
  constructor(reason: DeciderReason, message: string) {
    super(message)
    this.name = 'DeciderError'
    this.reason = reason
  }
}

export type DeciderChatRequest = {
  model: string
  systemPrompt: string
  userText: string
  imageDataUrls: string[]
  maxTokens: number
  schemaName: string
  schema: Record<string, unknown>
}

export type ChatSender = (request: DeciderChatRequest) => Promise<string | null>

function isOkResult(value: unknown): value is { value: unknown } {
  return typeof value === 'object' && value !== null && (value as { ok?: unknown }).ok === true
}

const chatResultSchema = z.object({
  choices: z.array(z.object({ message: z.object({ content: z.string().nullable() }) })).min(1),
})

function stripFences(raw: string): string {
  const trimmed = raw.trim()
  if (!trimmed.startsWith('```')) return trimmed
  return trimmed
    .replace(/^```[a-zA-Z]*\n?/, '')
    .replace(/\n?```$/, '')
    .trim()
}

function createSdkSender(apiKey: string): ChatSender {
  return async (request) => {
    let OpenRouterClass: new (options: {
      apiKey: string
    }) => {
      chat: { send: (args: unknown) => Promise<unknown> }
    }
    try {
      // Dynamic import: a missing install degrades to the fetch fallback
      // instead of crashing the plugin host at module load.
      const sdk = (await import('@openrouter/sdk')) as unknown as {
        OpenRouter: new (options: { apiKey: string }) => { chat: { send: (args: unknown) => Promise<unknown> } }
      }
      OpenRouterClass = sdk.OpenRouter
    } catch {
      throw new DeciderError('sdk_unsupported', 'OpenRouter SDK is not installed')
    }
    const client = new OpenRouterClass({ apiKey })
    let result: unknown
    try {
      result = await client.chat.send({
        appTitle: 'last-comments filter',
        chatRequest: {
          model: request.model,
          messages: [
            { role: 'system', content: request.systemPrompt },
            {
              role: 'user',
              content: [
                { type: 'text', text: request.userText },
                ...request.imageDataUrls.map((url) => ({
                  type: 'image_url',
                  imageUrl: { url, detail: 'low' },
                })),
              ],
            },
          ],
          temperature: 0,
          topP: 0.1,
          maxTokens: request.maxTokens,
          responseFormat: {
            type: 'json_schema',
            jsonSchema: { name: request.schemaName, strict: true, schema: request.schema },
          },
          stream: false,
        },
      })
    } catch (cause) {
      throw new DeciderError(
        'http',
        `OpenRouter SDK request failed: ${cause instanceof Error ? cause.message : String(cause)}`,
      )
    }
    if (!isOkResult(result)) throw new DeciderError('http', 'OpenRouter SDK returned an error result')
    const parsed = chatResultSchema.safeParse(result.value)
    if (!parsed.success) throw new DeciderError('malformed', 'OpenRouter SDK response shape was unrecognised')
    const content = parsed.data.choices[0].message.content
    if (content === null || content.trim() === '') throw new DeciderError('malformed', 'Decider returned no content')
    return content
  }
}

function createFetchSender(apiKey: string, baseUrl: string, fetcher: typeof fetch): ChatSender {
  return async (request) => {
    let response: Response
    try {
      response = await fetcher(`${baseUrl}/chat/completions`, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          authorization: `Bearer ${apiKey}`,
          'x-title': 'last-comments filter',
        },
        body: JSON.stringify({
          model: request.model,
          messages: [
            { role: 'system', content: request.systemPrompt },
            {
              role: 'user',
              content: [
                { type: 'text', text: request.userText },
                ...request.imageDataUrls.map((url) => ({ type: 'image_url', image_url: { url, detail: 'low' } })),
              ],
            },
          ],
          temperature: 0,
          top_p: 0.1,
          max_tokens: request.maxTokens,
          response_format: {
            type: 'json_schema',
            json_schema: { name: request.schemaName, strict: true, schema: request.schema },
          },
          stream: false,
        }),
      })
    } catch (cause) {
      throw new DeciderError(
        'http',
        `OpenRouter fetch failed: ${cause instanceof Error ? cause.message : String(cause)}`,
      )
    }
    if (!response.ok) throw new DeciderError('http', `OpenRouter HTTP ${response.status}`)
    let json: unknown
    try {
      json = await response.json()
    } catch {
      throw new DeciderError('malformed', 'OpenRouter response was not JSON')
    }
    const parsed = chatResultSchema.safeParse(json)
    if (!parsed.success) throw new DeciderError('malformed', 'OpenRouter response shape was unrecognised')
    const content = parsed.data.choices[0].message.content
    if (content === null || content.trim() === '') throw new DeciderError('malformed', 'Decider returned no content')
    return content
  }
}

export type CallDeciderInput = {
  systemPrompt: string
  userText: string
  imageDataUrls: string[]
  enabledText: readonly TextCategory[]
  enabledImage: readonly ImageCategory[]
  schemaName: string
  schema: Record<string, unknown>
}

export async function callDecider(
  input: CallDeciderInput,
  settings: ResolvedFilterConfig['openrouter'],
  deps: { sender?: ChatSender; fetcher?: typeof fetch } = {},
): Promise<z.infer<ReturnType<typeof buildActiveVerdictSchema>>> {
  const { apiKey, model, baseUrl, timeoutMs, maxTokens } = settings
  if (!apiKey) throw new DeciderError('missing_key', 'OPENROUTER_API_KEY is not configured')

  const chatRequest: DeciderChatRequest = {
    model,
    systemPrompt: input.systemPrompt,
    userText: input.userText,
    imageDataUrls: input.imageDataUrls,
    maxTokens,
    schemaName: input.schemaName,
    schema: input.schema,
  }

  const run = async (): Promise<string | null> => {
    if (deps.sender) return deps.sender(chatRequest)
    try {
      return await createSdkSender(apiKey)(chatRequest)
    } catch (error) {
      if (error instanceof DeciderError && error.reason === 'sdk_unsupported') {
        return createFetchSender(apiKey, baseUrl, deps.fetcher ?? fetch)(chatRequest)
      }
      throw error
    }
  }

  let content: string | null
  try {
    content = await Promise.race([
      run(),
      new Promise<never>((_, reject) => {
        setTimeout(() => reject(new DeciderError('timeout', `Decider timed out after ${timeoutMs}ms`)), timeoutMs)
      }),
    ])
  } catch (error) {
    if (error instanceof DeciderError) throw error
    throw new DeciderError('http', error instanceof Error ? error.message : String(error))
  }
  if (content === null || content.trim() === '') throw new DeciderError('malformed', 'Decider returned no content')

  let json: unknown
  try {
    json = JSON.parse(stripFences(content))
  } catch {
    throw new DeciderError('malformed', 'Decider content was not JSON')
  }
  const verdict = buildActiveVerdictSchema(input.enabledText, input.enabledImage).safeParse(json)
  if (!verdict.success) throw new DeciderError('schema', 'Decider verdict failed schema validation')
  return verdict.data
}
