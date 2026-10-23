import { describe, expect, test } from 'bun:test'

import { callDecider, DeciderError, type DeciderSender } from '@/server/plugins/filter/openrouter-client'

// Only config leaves the transport reads; the decisions endpoint ignores the
// old chat knobs.
const openrouter = {
  model: 'perplexity/pplx-decider-v1.2',
  baseUrl: 'https://openrouter.ai',
  timeoutMs: 2000,
  apiKey: 'sk-or-test',
}

const questions = {
  'text:spam_scam': {
    type: 'noul' as const,
    instructions: 'Is this spam?',
    criteria: { true: 'spam', false: 'not spam' },
  },
}

const baseInput = { state: 'author: Ada\nbody: hello', questions, imageDataUrls: [] as string[] }

function answers(values: Record<string, number>) {
  return { answers: Object.fromEntries(Object.entries(values).map(([key, noul]) => [key, { type: 'noul', noul }])) }
}

describe('openrouter decisions client', () => {
  test('sends state plus typed questions and maps answers to signals', async () => {
    let seen: unknown
    const sender: DeciderSender = async (request) => {
      seen = request
      return answers({ 'text:spam_scam': 0.93 })
    }
    const verdict = await callDecider(baseInput, openrouter, { sender })
    expect(verdict).toEqual({ textSignals: [{ category: 'spam_scam', confidence: 0.93 }], imageSignals: [] })
    const sent = seen as { model: string; state: unknown[]; questions: unknown }
    expect(sent.model).toBe('perplexity/pplx-decider-v1.2')
    expect(sent.questions).toEqual(questions)
    expect(sent.state).toEqual([baseInput.state])
  })

  test('appends thumbnails as image parts in state', async () => {
    let seen: unknown
    const sender: DeciderSender = async (request) => {
      seen = request
      return answers({ 'text:spam_scam': 0.1 })
    }
    await callDecider({ ...baseInput, imageDataUrls: ['data:image/jpeg;base64,AAA'] }, openrouter, { sender })
    const sent = seen as { state: unknown[] }
    expect(sent.state[1]).toEqual({
      type: 'image_url',
      image_url: { url: 'data:image/jpeg;base64,AAA', detail: 'low' },
    })
  })

  test('image keys are keyed per image and reduced to their category', async () => {
    const imageQuestions = {
      'image:0:sexual_explicit': {
        type: 'noul' as const,
        instructions: 'First image explicit?',
        criteria: { true: 'yes', false: 'no' },
      },
      'image:1:sexual_explicit': {
        type: 'noul' as const,
        instructions: 'Second image explicit?',
        criteria: { true: 'yes', false: 'no' },
      },
    }
    const sender: DeciderSender = async () =>
      answers({ 'image:0:sexual_explicit': 0.02, 'image:1:sexual_explicit': 0.88 })
    const verdict = await callDecider(
      { ...baseInput, questions: imageQuestions, imageDataUrls: ['data:image/jpeg;base64,AAA'] },
      openrouter,
      { sender },
    )
    expect(verdict.imageSignals).toEqual([
      { category: 'sexual_explicit', confidence: 0.02 },
      { category: 'sexual_explicit', confidence: 0.88 },
    ])
  })

  test('missing key fails before any sender runs', async () => {
    let called = false
    await expect(
      callDecider(
        baseInput,
        { ...openrouter, apiKey: undefined },
        { sender: async () => ((called = true), answers({ 'text:spam_scam': 0.5 })) },
      ),
    ).rejects.toMatchObject({ name: 'DeciderError', reason: 'missing_key' })
    expect(called).toBe(false)
  })

  test('timeout maps to DeciderError', async () => {
    const sender: DeciderSender = () => new Promise(() => {})
    await expect(callDecider(baseInput, { ...openrouter, timeoutMs: 20 }, { sender })).rejects.toMatchObject({
      name: 'DeciderError',
      reason: 'timeout',
    })
  }, 5000)

  test('unrecognised responses and missing answers map to DeciderError', async () => {
    await expect(callDecider(baseInput, openrouter, { sender: async () => 'not json' })).rejects.toMatchObject({
      reason: 'malformed',
    })
    await expect(
      callDecider(baseInput, openrouter, { sender: async () => answers({ 'text:other': 0.9 }) }),
    ).rejects.toMatchObject({ reason: 'schema' })
    await expect(
      callDecider(baseInput, openrouter, { sender: async () => answers({ 'text:spam_scam': 1.5 }) }),
    ).rejects.toMatchObject({ reason: 'malformed' })
  })

  test('sender failures surface as http DeciderError', async () => {
    const sender: DeciderSender = async () => {
      throw new TypeError('down')
    }
    const error = await callDecider(baseInput, openrouter, { sender }).catch((cause) => cause)
    expect(error).toBeInstanceOf(DeciderError)
    expect((error as DeciderError).reason).toBe('http')
  })
})
