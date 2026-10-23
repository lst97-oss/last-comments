import { describe, expect, test } from 'bun:test'

import type { Logger } from '@/server/observability/logger'
import type { ResolvedFilterConfig } from '@/server/plugins/filter/filter.config'
import { applyVerdictThreshold, createFilterPlugin } from '@/server/plugins/filter/filter.plugin'
import type { DeciderRequest, DeciderSender } from '@/server/plugins/filter/openrouter-client'

function silentLogger(): Logger {
  const logger = {} as Logger
  logger.debug = () => undefined
  logger.info = () => undefined
  logger.warn = () => undefined
  logger.error = () => undefined
  logger.child = () => logger
  return logger
}

function config(overrides: Partial<ResolvedFilterConfig> = {}): ResolvedFilterConfig {
  return {
    enabled: true,
    badwordsEnabled: true,
    llmEnabled: true,
    enabledText: ['spam_scam', 'harassment_hate'],
    enabledImage: ['sexual_explicit'],
    enabledTextSet: new Set(['spam_scam', 'harassment_hate']),
    enabledImageSet: new Set(['sexual_explicit']),
    hideThreshold: 0.7,
    failOpen: true,
    openrouter: {
      model: 'perplexity/pplx-decider-v1.2',
      baseUrl: 'https://openrouter.ai',
      timeoutMs: 2000,
      apiKey: 'sk-or-test',
    },
    images: { maxImages: 3, timeoutMs: 4000, maxBytes: 2_000_000, longestEdge: 512, quality: 60 },
    blocklist: [],
    allowlist: [],
    ...overrides,
  }
}

const input = {
  siteId: 'site-1',
  pageUrl: 'https://example.com/post',
  userId: null as string | null,
  authorName: 'Guest',
  bodyMarkdown: 'A perfectly fine comment.',
}

// Decisions answer every question the client asked; the mock never invents
// categories, which is what the real endpoint guarantees.
function decider(probability: (key: string) => number): DeciderSender {
  return async (request: DeciderRequest) => ({
    answers: Object.fromEntries(
      Object.keys(request.questions).map((key) => [key, { type: 'noul', noul: probability(key) }]),
    ),
  })
}

describe('filter threshold rule', () => {
  const sets = { enabledText: new Set(['spam_scam']), enabledImage: new Set(['sexual_explicit']), hideThreshold: 0.7 }
  const signal = (category: string, confidence: number) => ({ category, confidence })

  test('hides on an enabled signal at or above threshold', () => {
    const triggered = applyVerdictThreshold({ textSignals: [signal('spam_scam', 0.7)], imageSignals: [] }, sets)
    expect(triggered).toEqual(['spam_scam'])
  })

  test('ignores below-threshold signals', () => {
    const triggered = applyVerdictThreshold({ textSignals: [signal('spam_scam', 0.69)], imageSignals: [] }, sets)
    expect(triggered).toEqual([])
  })

  test('drops disabled-category rows and never hides on benign', () => {
    const triggered = applyVerdictThreshold(
      {
        textSignals: [signal('harassment_hate', 0.99)],
        imageSignals: [signal('benign', 0.99)],
      },
      sets,
    )
    expect(triggered).toEqual([])
  })
})

describe('filter plugin orchestration', () => {
  test('disabled plugin allows without running any engine', async () => {
    let senderCalled = false
    let wordsCreated = false
    const plugin = createFilterPlugin({
      loadConfig: () => config({ enabled: false }),
      createWordFilter: async () => ((wordsCreated = true), null),
      deciderSender: async () => ((senderCalled = true), { answers: {} }),
      logger: silentLogger(),
    })
    const verdict = await plugin.screenComment!(input, new AbortController().signal)
    expect(verdict).toEqual({ decision: 'allow', reasons: [], triggeredCategories: [], detail: expect.anything() })
    expect(senderCalled).toBe(false)
    expect(wordsCreated).toBe(false)
  })

  test('bad-words hit hides without any LLM traffic', async () => {
    let senderCalled = false
    const plugin = createFilterPlugin({
      loadConfig: () => config({ llmEnabled: false, blocklist: ['cryptogiveaway'] }),
      // Fake word filter: the default list is empty, the blocklist is matched
      // as a substring by screenBadwords itself.
      createWordFilter: async () => ({ isProfane: () => false, addWords: () => {}, removeWords: () => {} }),
      deciderSender: async () => ((senderCalled = true), { answers: {} }),
      logger: silentLogger(),
    })
    const verdict = await plugin.screenComment!(
      { ...input, bodyMarkdown: 'Visit CryptoGiveaway now' },
      new AbortController().signal,
    )
    expect(verdict.decision).toBe('hide')
    expect(verdict.triggeredCategories).toEqual(['lexical'])
    expect(senderCalled).toBe(false)
  })

  test('subset proof: harassment hides under the full set but is never asked under spam-only', async () => {
    let asked: string[] = []
    const sender = decider((key) => {
      if (key === 'text:harassment_hate') return 0.91
      return 0.02
    })
    const tracking: DeciderSender = async (request) => {
      asked = Object.keys(request.questions)
      return sender(request)
    }
    const full = createFilterPlugin({
      loadConfig: () => config({ badwordsEnabled: false }),
      deciderSender: tracking,
      logger: silentLogger(),
    })
    const narrow = createFilterPlugin({
      loadConfig: () =>
        config({
          badwordsEnabled: false,
          enabledText: ['spam_scam'],
          enabledTextSet: new Set(['spam_scam']),
        }),
      deciderSender: tracking,
      logger: silentLogger(),
    })
    const fullVerdict = await full.screenComment!(
      { ...input, bodyMarkdown: 'You are worthless' },
      new AbortController().signal,
    )
    expect(fullVerdict.decision).toBe('hide')
    expect(fullVerdict.triggeredCategories).toEqual(['harassment_hate'])
    expect(asked).toContain('text:harassment_hate')

    const narrowVerdict = await narrow.screenComment!(
      { ...input, bodyMarkdown: 'You are worthless' },
      new AbortController().signal,
    )
    expect(narrowVerdict.decision).toBe('allow')
    expect(asked).not.toContain('text:harassment_hate')
  })

  test('LLM outage fails open by default and holds for review when closed', async () => {
    const failing: DeciderSender = async () => {
      throw new TypeError('down')
    }
    const open = createFilterPlugin({
      loadConfig: () => config({ badwordsEnabled: false, failOpen: true }),
      deciderSender: failing,
      logger: silentLogger(),
    })
    await expect(open.screenComment!(input, new AbortController().signal)).resolves.toMatchObject({ decision: 'allow' })
    const closed = createFilterPlugin({
      loadConfig: () => config({ badwordsEnabled: false, failOpen: false }),
      deciderSender: failing,
      logger: silentLogger(),
    })
    const verdict = await closed.screenComment!(input, new AbortController().signal)
    expect(verdict.decision).toBe('hide')
    expect(verdict.triggeredCategories).toEqual(['unavailable'])
  })

  test('missing key skips the LLM and fails open', async () => {
    let senderCalled = false
    const plugin = createFilterPlugin({
      loadConfig: () => config({ badwordsEnabled: false, openrouter: { ...config().openrouter, apiKey: undefined } }),
      deciderSender: async () => ((senderCalled = true), { answers: {} }),
      logger: silentLogger(),
    })
    await expect(plugin.screenComment!(input, new AbortController().signal)).resolves.toMatchObject({
      decision: 'allow',
    })
    expect(senderCalled).toBe(false)
  })

  test('empty schema sets skip the LLM call', async () => {
    let senderCalled = false
    const plugin = createFilterPlugin({
      loadConfig: () =>
        config({
          badwordsEnabled: false,
          enabledText: [],
          enabledImage: [],
          enabledTextSet: new Set<string>(),
          enabledImageSet: new Set<string>(),
        }),
      deciderSender: async () => ((senderCalled = true), { answers: {} }),
      logger: silentLogger(),
    })
    await expect(plugin.screenComment!(input, new AbortController().signal)).resolves.toMatchObject({
      decision: 'allow',
    })
    expect(senderCalled).toBe(false)
  })

  test('image-only config with no images skips the LLM call instead of asking nothing', async () => {
    let senderCalled = false
    const plugin = createFilterPlugin({
      loadConfig: () =>
        config({
          badwordsEnabled: false,
          enabledText: [],
          enabledImage: ['sexual_explicit'],
          enabledTextSet: new Set<string>(),
        }),
      deciderSender: async () => ((senderCalled = true), { answers: {} }),
      logger: silentLogger(),
    })
    await expect(plugin.screenComment!(input, new AbortController().signal)).resolves.toMatchObject({
      decision: 'allow',
    })
    expect(senderCalled).toBe(false)
  })
})
