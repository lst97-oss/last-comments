import { describe, expect, test } from 'bun:test'

import { getBusinessEnv } from '@/server/config/business-env'

describe('getBusinessEnv', () => {
  test('uses the dedicated business database URL', () => {
    expect(getBusinessEnv({ BUSINESS_DATABASE_URL: 'postgres://business/db' })).toEqual({
      connectionString: 'postgres://business/db',
    })
  })

  test('does not fall back to the Payload database URL', () => {
    expect(() => getBusinessEnv({ DATABASE_URL: 'postgres://payload/db' })).toThrow()
  })
})
