import { describe, expect, test } from 'bun:test'

import { getPluginRetryDelayMs } from '@/server/plugins/plugin-delivery'

describe('getPluginRetryDelayMs', () => {
  test('uses bounded exponential retry delays', () => {
    expect([1, 2, 3, 30].map(getPluginRetryDelayMs)).toEqual([1_000, 2_000, 4_000, 3_600_000])
  })
})
