import { describe, expect, test } from 'bun:test'
import { isRange, rangeCopy } from '@/lib/admin-format'
import { statsQuerySchema } from '@/server/modules/comments/http/comment-schemas'

describe('dashboard stats range', () => {
  test('days maps each range to its typed value and defaults to 30', () => {
    expect(statsQuerySchema.parse({ site: 'docs', days: '7' }).days).toBe(7)
    expect(statsQuerySchema.parse({ site: 'docs', days: '90' }).days).toBe(90)
    expect(statsQuerySchema.parse({ site: 'docs', days: 'all' }).days).toBe('all')
    expect(statsQuerySchema.parse({ site: 'docs' }).days).toBe(30)
  })

  test('days rejects values outside the ranges', () => {
    expect(() => statsQuerySchema.parse({ site: 'docs', days: '365' })).toThrow()
  })

  test('isRange accepts the toggle values only', () => {
    expect(isRange('all')).toBe(true)
    expect(isRange('30')).toBe(true)
    expect(isRange('365')).toBe(false)
  })

  test('rangeCopy reads all time and so far for all', () => {
    expect(rangeCopy('all')).toEqual({ period: 'all time', within: 'so far' })
    expect(rangeCopy('7')).toEqual({ period: 'last 7 days', within: 'in the last 7 days' })
  })
})
