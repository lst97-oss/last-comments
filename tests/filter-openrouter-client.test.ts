import { describe, expect, test } from 'bun:test'

import { callDecider, DeciderError, type ChatSender } from '@/server/plugins/filter/openrouter-client'

const openrouter = {
  model: 'perplexity/pplx-decider-v1.2',
  baseUrl: 'https://openrouter.ai/api/v1',
  timeoutMs: 2000,
  maxTokens: 400,
  apiKey: 'sk-or-test',
}

const baseInput = {
  systemPrompt: 'system',
  userText: 'author: Ada\nbody: hello',
  imageDataUrls: [] as string[],
  enabledText: ['spam_scam'] as const,
  enabledImage: [] as const,
  schemaName: 'last_comments_filter_verdict_t1_i0_x',
  schema: {} as Record<string, unknown>,
}

function verdictJson(overrides: Record<string, unknown> = {}) {
  return JSON.stringify({
    decision: 'allow',
    needsReview: false,
    triggeredCategories: [],
    textSignals: [],
    imageSignals: [],
    overallConfidence: 0.2,
    reasons: [],
    ...overrides,
  })
}

describe('openrouter decider client', () => {
  test('parses a verdict through the injected sender and asserts the request shape', async () => {
    let seen: unknown
    const sender: ChatSender = async (request) => {
      seen = request
      return verdictJson()
    }
    const verdict = await callDecider({ ...baseInput, enabledText: ['spam_scam'], enabledImage: [] }, openrouter, {
      sender,
    })
    expect(verdict.decision).toBe('allow')
    const sent = seen as { model: string; schemaName: string; imageDataUrls: string[]; maxTokens: number }
    expect(sent.model).toBe('perplexity/pplx-decider-v1.2')
    expect(sent.schemaName).toBe('last_comments_filter_verdict_t1_i0_x')
    expect(sent.imageDataUrls).toEqual([])
    expect(sent.maxTokens).toBe(400)
  })

  test('missing key fails before any sender runs', async () => {
    let called = false
    await expect(
      callDecider(
        baseInput,
        { ...openrouter, apiKey: undefined },
        { sender: async () => ((called = true), verdictJson()) },
      ),
    ).rejects.toMatchObject({ name: 'DeciderError', reason: 'missing_key' })
    expect(called).toBe(false)
  })

  test('timeout maps to DeciderError', async () => {
    const sender: ChatSender = () => new Promise(() => {})
    await expect(callDecider(baseInput, { ...openrouter, timeoutMs: 20 }, { sender })).rejects.toMatchObject({
      name: 'DeciderError',
      reason: 'timeout',
    })
  }, 5000)

  test('non-JSON and schema-violating content map to DeciderError', async () => {
    await expect(callDecider(baseInput, openrouter, { sender: async () => 'not json' })).rejects.toMatchObject({
      reason: 'malformed',
    })
    await expect(
      callDecider(baseInput, openrouter, { sender: async () => JSON.stringify({ decision: 'hide' }) }),
    ).rejects.toMatchObject({ reason: 'schema' })
    await expect(callDecider(baseInput, openrouter, { sender: async () => null })).rejects.toMatchObject({
      reason: 'malformed',
    })
  })

  test('sender failures surface as http DeciderError', async () => {
    const sender: ChatSender = async () => {
      throw new TypeError('down')
    }
    const error = await callDecider(baseInput, openrouter, { sender }).catch((cause) => cause)
    expect(error).toBeInstanceOf(DeciderError)
    expect((error as DeciderError).reason).toBe('http')
  })
})
