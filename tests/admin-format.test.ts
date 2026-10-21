import { describe, expect, test } from 'bun:test'

import { asModerationView, authorInitials, timeAgo } from '@/lib/admin-format'

describe('asModerationView', () => {
  test('narrow the moderation tab, falling back to pages', () => {
    expect(asModerationView('pages')).toBe('pages')
    expect(asModerationView('recent')).toBe('recent')
    expect(asModerationView('users')).toBe('users')
    expect(asModerationView('sites')).toBe('sites')
    expect(asModerationView('admin-users')).toBe('pages')
    expect(asModerationView(undefined)).toBe('pages')
  })
})

describe('timeAgo', () => {
  test('renders relative buckets for recent timestamps', () => {
    const now = Date.now()
    expect(timeAgo(new Date(now - 3_000).toISOString())).toBe('just now')
    expect(timeAgo(new Date(now - 45_000).toISOString())).toBe('45s ago')
    expect(timeAgo(new Date(now - 5 * 60_000).toISOString())).toBe('5m ago')
    expect(timeAgo(new Date(now - 3 * 3_600_000).toISOString())).toBe('3h ago')
    expect(timeAgo(new Date(now - 2 * 86_400_000).toISOString())).toBe('2d ago')
  })

  test('clamps future drift and falls back for missing or invalid input', () => {
    expect(timeAgo(new Date(Date.now() + 60_000).toISOString())).toBe('just now')
    expect(timeAgo(null)).toBe('—')
    expect(timeAgo('not-a-date')).toBe('not-a-date')
  })
})

describe('authorInitials', () => {
  test('takes the first letters of the first two words', () => {
    expect(authorInitials('Ada Lovelace')).toBe('AL')
    expect(authorInitials('plato')).toBe('PL')
    expect(authorInitials('  Grace   Hopper  ')).toBe('GH')
    expect(authorInitials('')).toBe('?')
  })
})
