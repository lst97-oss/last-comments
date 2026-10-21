import { describe, expect, test } from 'bun:test'

import { screenBadwords, type BadwordsFilter } from '@/server/plugins/filter/badwords-screen'

// Injected fake: no `bad-words` install needed for these unit tests.
function fakeFilter(profane: readonly string[] = []): BadwordsFilter {
  const lower = new Set(profane.map((word) => word.toLowerCase()))
  const removed = new Set<string>()
  return {
    // Blocklist entries are matched as substrings by screenBadwords itself;
    // this fake only needs the default-list token behaviour.
    isProfane: (text: string) => lower.has(text.toLowerCase()) && !removed.has(text.toLowerCase()),
    addWords: () => {},
    removeWords: (...words: string[]) => {
      for (const word of words) removed.add(word.toLowerCase())
    },
  }
}

describe('bad-words screening', () => {
  test('flags default-listed profanity per token', () => {
    const result = screenBadwords('hello damn world', { blocklist: [], allowlist: [], filter: fakeFilter(['damn']) })
    expect(result.flagged).toBe(true)
    expect(result.matchedTerms).toEqual(['d***'])
  })

  test('clean text is allowed', () => {
    const result = screenBadwords('A thoughtful reply about the post.', {
      blocklist: [],
      allowlist: [],
      filter: fakeFilter(['damn']),
    })
    expect(result).toEqual({ flagged: false, matchedTerms: [] })
  })

  test('custom blocklist entries match as case-insensitive substrings', () => {
    const filter = fakeFilter()
    const result = screenBadwords('Visit CryptoGiveaway now', { blocklist: ['cryptogiveaway'], allowlist: [], filter })
    expect(result.flagged).toBe(true)
    expect(result.matchedTerms).toEqual(['c***'])
  })

  test('allowlist exempts exact tokens from the default list', () => {
    const filter = fakeFilter(['scunthorpe'])
    const result = screenBadwords('I live in Scunthorpe', { blocklist: [], allowlist: ['scunthorpe'], filter })
    expect(result.flagged).toBe(false)
  })

  test('matched terms are redacted to first-letter form', () => {
    const result = screenBadwords('damn', { blocklist: ['secret-phrase'], allowlist: [], filter: fakeFilter(['damn']) })
    for (const term of result.matchedTerms) {
      expect(term).toMatch(/^[a-z]\*\*\*$/)
      expect(term).not.toContain('damn')
      expect(term).not.toContain('secret-phrase')
    }
  })
})
