import { describe, expect, test } from 'bun:test'

import { formatClockTime } from '@/lib/time'

describe('formatClockTime', () => {
  test('renders zero-padded local HH:MM:SS.mmm', () => {
    const date = new Date(2026, 9, 16, 3, 5, 7, 42)
    expect(formatClockTime(date)).toBe('03:05:07.042')
  })
})
