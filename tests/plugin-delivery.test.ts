import { describe, expect, test } from 'bun:test'

import { PluginFailure } from '@/server/plugins/comment-plugins'
import {
  getPluginRetryDelayMs,
  hasOutboxSubscribers,
  PERMANENT_RETRY_DELAY_MS,
  planRetry,
} from '@/server/plugins/plugin-delivery'

describe('getPluginRetryDelayMs', () => {
  test('uses bounded exponential retry delays', () => {
    expect([1, 2, 3, 30].map(getPluginRetryDelayMs)).toEqual([1_000, 2_000, 4_000, 3_600_000])
  })
})

describe('planRetry', () => {
  test('a transient failure retries on the bounded schedule, then dead-letters after the last attempt', () => {
    expect(planRetry(new Error('boom'), 1)).toEqual({
      status: 'pending',
      lastError: 'PLUGIN_HANDLER_ERROR',
      delayMs: 1_000,
    })
    expect(planRetry(new Error('boom'), 8)).toMatchObject({ status: 'dead_letter', lastError: 'PLUGIN_HANDLER_ERROR' })
  })

  test('a permanent failure keeps its code and retries slowly, not on the fast schedule', () => {
    expect(planRetry(new PluginFailure('APP_NOT_FOUND', 'refused', false), 1)).toEqual({
      status: 'pending',
      lastError: 'APP_NOT_FOUND',
      delayMs: PERMANENT_RETRY_DELAY_MS,
    })
    expect(planRetry(new PluginFailure('APP_NOT_FOUND', 'refused', false), 8)).toMatchObject({
      status: 'dead_letter',
      lastError: 'APP_NOT_FOUND',
    })
  })

  test('a retryable PluginFailure follows the transient schedule', () => {
    expect(planRetry(new PluginFailure('PUBLISH_FAILED', 'down', true), 2)).toEqual({
      status: 'pending',
      lastError: 'PLUGIN_HANDLER_ERROR',
      delayMs: 2_000,
    })
  })

  test('a missing plugin dead-letters at once', () => {
    expect(planRetry(new Error('PLUGIN_NOT_REGISTERED'), 1)).toMatchObject({
      status: 'dead_letter',
      lastError: 'PLUGIN_NOT_REGISTERED',
    })
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
