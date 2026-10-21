import { describe, expect, test } from 'bun:test'

import { normalizePageKey, normalizePageUrl } from '@/server/modules/comments/domain/comment'

describe('normalizePageKey', () => {
  test('lowercases and trims valid slugs', () => {
    expect(normalizePageKey('  This-Is-Test ')).toBe('this-is-test')
  })

  test('rejects blanks, bad characters, and overlong slugs', () => {
    expect(() => normalizePageKey('')).toThrow()
    expect(() => normalizePageKey('has space')).toThrow()
    expect(() => normalizePageKey('under_score')).toThrow()
    expect(() => normalizePageKey(`${'a'.repeat(121)}`)).toThrow()
  })
})

describe('normalizePageUrl', () => {
  test('normalizes host and removes fragment while retaining meaningful query', () => {
    expect(normalizePageUrl('HTTPS://Example.COM/post?q=1#section')).toBe('https://example.com/post?q=1')
  })

  test('rejects non-http URLs and embedded credentials', () => {
    expect(() => normalizePageUrl('javascript:alert(1)')).toThrow()
    expect(() => normalizePageUrl('https://user:pass@example.com/post')).toThrow()
  })
})
