import { describe, expect, test } from 'bun:test'

import {
  activeSchemaName,
  activeVerdictJsonSchema,
  buildActiveVerdictSchema,
} from '@/server/plugins/filter/filter-schemas'

const fullText = ['spam_scam', 'harassment_hate'] as const
const fullImage = ['sexual_explicit', 'benign'] as const

function verdict(overrides: Record<string, unknown> = {}) {
  return {
    decision: 'allow',
    needsReview: false,
    triggeredCategories: [],
    textSignals: [],
    imageSignals: [],
    overallConfidence: 0.1,
    reasons: [],
    ...overrides,
  }
}

describe('filter schemas', () => {
  test('active schema accepts rows for enabled categories', () => {
    const schema = buildActiveVerdictSchema([...fullText], [...fullImage])
    const parsed = schema.safeParse(
      verdict({
        decision: 'hide',
        needsReview: true,
        triggeredCategories: ['spam_scam'],
        textSignals: [{ category: 'spam_scam', flagged: true, confidence: 0.9, rationale: 'bulk promo' }],
        overallConfidence: 0.9,
        reasons: ['Bulk promotion'],
      }),
    )
    expect(parsed.success).toBe(true)
  })

  test('active schema rejects rows for disabled categories', () => {
    const schema = buildActiveVerdictSchema(['spam_scam'], ['sexual_explicit'])
    const parsed = schema.safeParse(
      verdict({
        textSignals: [{ category: 'harassment_hate', flagged: true, confidence: 0.9, rationale: 'insult' }],
      }),
    )
    expect(parsed.success).toBe(false)
  })

  test('empty text set forbids every text signal', () => {
    const schema = buildActiveVerdictSchema([], ['sexual_explicit'])
    expect(
      schema.safeParse(
        verdict({ textSignals: [{ category: 'spam_scam', flagged: true, confidence: 1, rationale: 'x' }] }),
      ).success,
    ).toBe(false)
    expect(schema.safeParse(verdict()).success).toBe(true)
  })

  test('schema names are stable per set and distinct across sets', () => {
    const a = activeSchemaName(['spam_scam'], ['sexual_explicit'])
    expect(activeSchemaName(['spam_scam'], ['sexual_explicit'])).toBe(a)
    expect(activeSchemaName(['harassment_hate'], ['sexual_explicit'])).not.toBe(a)
    expect(a.length).toBeLessThanOrEqual(64)
    expect(a).toMatch(/^[a-zA-Z0-9_-]+$/)
  })

  test('JSON schema export is a plain object for the SDK', () => {
    const json = activeVerdictJsonSchema(['spam_scam'], [])
    expect(typeof json).toBe('object')
    expect(json).not.toBeNull()
    expect(JSON.stringify(json).length).toBeGreaterThan(100)
  })
})
