import { describe, expect, test } from 'bun:test'

import { formatPostDate } from '@/components/blog/post-meta'

describe('formatPostDate', () => {
  test('uses a fixed locale so SSR and hydration always agree', () => {
    // Must not depend on the runtime default locale: the date renders during
    // SSR and hydrates on the client, where the visitor's locale may differ.
    expect(formatPostDate('2026-10-19T12:00:00.000Z')).toBe('Oct 19, 2026')
  })

  test('returns null for missing or invalid input', () => {
    expect(formatPostDate(null)).toBeNull()
    expect(formatPostDate('not-a-date')).toBeNull()
  })
})
