import { describe, expect, test } from 'bun:test'

import type { Logger } from '@/server/observability/logger'
import { applyVerdictThreshold, createFilterPlugin } from '@/server/plugins/filter/filter.plugin'
import type { ResolvedFilterConfig } from '@/server/plugins/filter/filter.config'
import type { ChatSender } from '@/server/plugins/filter/openrouter-client'

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
      baseUrl: 'https://openrouter.ai/api/v1',
      timeoutMs: 2000,
      maxTokens: 400,
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

describe('filter threshold rule', () => {
  const sets = { enabledText: new Set(['spam_scam']), enabledImage: new Set(['sexual_explicit']), hideThreshold: 0.7 }
  const signals = (category: string, flagged: boolean, confidence: number) => ({ category, flagged, confidence })

  test('hides on an enabled signal at or above threshold', () => {
    const { triggered } = applyVerdictThreshold(
      { decision: 'allow', textSignals: [signals('spam_scam', true, 0.7)], imageSignals: [] },
      sets,
    )
    expect(triggered).toEqual(['spam_scam'])
  })

  test('ignores below-threshold and unflagged signals', () => {
    const { triggered } = applyVerdictThreshold(
      {
        decision: 'hide',
        textSignals: [signals('spam_scam', true, 0.69), signals('spam_scam', false, 0.99)],
        imageSignals: [],
      },
      sets,
    )
    expect(triggered).toEqual([])
  })

  test('drops disabled-category rows and never hides on benign', () => {
    const { triggered } = applyVerdictThreshold(
      {
        decision: 'hide',
        textSignals: [signals('harassment_hate', true, 0.99)],
        imageSignals: [{ category: 'benign', flagged: true, confidence: 0.99 }],
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
      chatSender: async () => ((senderCalled = true), verdictJson()),
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
      chatSender: async () => ((senderCalled = true), verdictJson()),
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

  test('subset proof: harassment verdict hides under the full set but allows under spam-only', async () => {
    const harassment: ChatSender = async () =>
      verdictJson({
        decision: 'hide',
        needsReview: true,
        triggeredCategories: ['harassment_hate'],
        textSignals: [{ category: 'harassment_hate', flagged: true, confidence: 0.91, rationale: 'targeted insult' }],
        overallConfidence: 0.91,
        reasons: ['Targeted insult'],
      })
    const full = createFilterPlugin({
      loadConfig: () => config({ badwordsEnabled: false }),
      chatSender: harassment,
      logger: silentLogger(),
    })
    const narrow = createFilterPlugin({
      loadConfig: () =>
        config({
          badwordsEnabled: false,
          enabledText: ['spam_scam'],
          enabledTextSet: new Set(['spam_scam']),
        }),
      chatSender: harassment,
      logger: silentLogger(),
    })
    // The narrow schema contract rejects the foreign category outright, so the
    // decider errors and the plugin fails open to allow.
    const fullVerdict = await full.screenComment!(
      { ...input, bodyMarkdown: 'You are worthless' },
      new AbortController().signal,
    )
    expect(fullVerdict.decision).toBe('hide')
    expect(fullVerdict.triggeredCategories).toEqual(['harassment_hate'])
    const narrowVerdict = await narrow.screenComment!(
      { ...input, bodyMarkdown: 'You are worthless' },
      new AbortController().signal,
    )
    expect(narrowVerdict.decision).toBe('allow')
  })

  test('LLM outage fails open by default and holds for review when closed', async () => {
    const failing: ChatSender = async () => {
      throw new TypeError('down')
    }
    const open = createFilterPlugin({
      loadConfig: () => config({ badwordsEnabled: false, failOpen: true }),
      chatSender: failing,
      logger: silentLogger(),
    })
    await expect(open.screenComment!(input, new AbortController().signal)).resolves.toMatchObject({ decision: 'allow' })
    const closed = createFilterPlugin({
      loadConfig: () => config({ badwordsEnabled: false, failOpen: false }),
      chatSender: failing,
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
      chatSender: async () => ((senderCalled = true), verdictJson()),
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
      chatSender: async () => ((senderCalled = true), verdictJson()),
      logger: silentLogger(),
    })
    await expect(plugin.screenComment!(input, new AbortController().signal)).resolves.toMatchObject({
      decision: 'allow',
    })
    expect(senderCalled).toBe(false)
  })
})
