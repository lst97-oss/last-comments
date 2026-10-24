import { describe, expect, test } from 'bun:test'

import { getPluginRetryDelayMs, hasOutboxSubscribers } from '@/server/plugins/plugin-delivery'

describe('getPluginRetryDelayMs', () => {
  test('uses bounded exponential retry delays', () => {
    expect([1, 2, 3, 30].map(getPluginRetryDelayMs)).toEqual([1_000, 2_000, 4_000, 3_600_000])
  })
})

describe('hasOutboxSubscribers', () => {
  test('needs a plugin that both lists an event and handles it', () => {
    expect(hasOutboxSubscribers([{ id: 'turnstile', apiVersion: 1 }])).toBe(false)
    expect(hasOutboxSubscribers([{ id: 'audit', apiVersion: 1, events: ['comment.created'] }])).toBe(false)
    expect(
      hasOutboxSubscribers([{ id: 'audit', apiVersion: 1, events: ['comment.created'], handleEvent: async () => {} }]),
    ).toBe(true)
  })
})
