import { describe, expect, test } from 'bun:test'

import { canCreateInitialAdmin } from '@/server/modules/admin/domain/initial-setup'

describe('initial admin setup', () => {
  test('is available only on a completely empty business auth database', () => {
    expect(canCreateInitialAdmin(0, 0)).toBe(true)
    expect(canCreateInitialAdmin(1, 0)).toBe(false)
    expect(canCreateInitialAdmin(0, 1)).toBe(false)
  })
})
