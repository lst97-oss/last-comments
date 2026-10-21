import { describe, expect, test } from 'bun:test'

import { filterConfigDef } from '@/server/plugins/filter/filter.config'
import { ALL_IMAGE_CATEGORIES, ALL_TEXT_CATEGORIES } from '@/server/plugins/filter/filter-schemas'
import { loadPluginConfig } from '@/server/plugins/plugin-config'

function resolve(file: unknown, env: Record<string, string | undefined> = {}) {
  return loadPluginConfig(filterConfigDef, { file, env })
}

describe('filter config standard', () => {
  test('disabled plugin resolves both engines off and keeps every schema', () => {
    const config = resolve({ ...filterConfigDef.defaults, enabled: false })
    expect(config.enabled).toBe(false)
    expect(config.badwordsEnabled).toBe(false)
    expect(config.llmEnabled).toBe(false)
    expect(config.enabledText).toEqual([...ALL_TEXT_CATEGORIES])
    expect(config.enabledImage).toEqual([...ALL_IMAGE_CATEGORIES])
    expect(config.hideThreshold).toBe(0.7)
    expect(config.failOpen).toBe(true)
    expect(config.openrouter.model).toBe('perplexity/pplx-decider-v1.2')
    expect(config.openrouter.apiKey).toBeUndefined()
  })

  test('resolves the secret from the environment, never from the file', () => {
    const config = resolve(filterConfigDef.defaults, { OPENROUTER_API_KEY: 'sk-or-test' })
    expect(config.openrouter.apiKey).toBe('sk-or-test')
    expect(resolve(filterConfigDef.defaults, { OPENROUTER_API_KEY: '  ' }).openrouter.apiKey).toBeUndefined()
    expect(resolve(filterConfigDef.defaults, {}).openrouter.apiKey).toBeUndefined()
  })

  test('accepts explicit schema subsets and dedupes them', () => {
    const config = resolve({
      ...filterConfigDef.defaults,
      enabled: true,
      schemas: { text: ['spam_scam', 'spam_scam', 'harassment_hate'], image: ['sexual_explicit'] },
    })
    expect(config.enabledText).toEqual(['spam_scam', 'harassment_hate'])
    expect(config.enabledImage).toEqual(['sexual_explicit'])
    expect(config.enabledTextSet.has('spam_scam')).toBe(true)
    expect(config.enabledTextSet.has('illicit_pii')).toBe(false)
  })

  test('empty sets disable that modality without touching the engine switch', () => {
    const config = resolve({ ...filterConfigDef.defaults, enabled: true, schemas: { text: ['spam_scam'], image: [] } })
    expect(config.llmEnabled).toBe(true)
    expect(config.enabledText).toEqual(['spam_scam'])
    expect(config.enabledImage).toEqual([])
  })

  test('rejects unknown schema names with the valid values', () => {
    expect(() =>
      resolve({ ...filterConfigDef.defaults, schemas: { text: ['harasment_hate'], image: 'all' } }),
    ).toThrow()
  })

  test('rejects out-of-range thresholds and timeouts', () => {
    expect(() => resolve({ ...filterConfigDef.defaults, hideThreshold: 1.5 })).toThrow()
    expect(() => resolve({ ...filterConfigDef.defaults, hideThreshold: -0.1 })).toThrow()
    expect(() =>
      resolve({ ...filterConfigDef.defaults, openrouter: { ...filterConfigDef.defaults.openrouter, timeoutMs: 0 } }),
    ).toThrow()
  })

  test('master off forces both engines off regardless of engine flags', () => {
    const config = resolve({ ...filterConfigDef.defaults, enabled: false })
    expect(config.badwordsEnabled).toBe(false)
    expect(config.llmEnabled).toBe(false)
  })
})
