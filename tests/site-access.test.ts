import { describe, expect, test } from 'bun:test'

import { anonymousAllowed, SITE_ACCESS_LEVELS } from '@/lib/site-access'

describe('site access policy', () => {
  test('open lets anyone read and write, as before this setting existed', () => {
    expect(anonymousAllowed('open', 'read')).toBe(true)
    expect(anonymousAllowed('open', 'write')).toBe(true)
  })

  test('login lets anyone read but needs a credential to write', () => {
    expect(anonymousAllowed('login', 'read')).toBe(true)
    expect(anonymousAllowed('login', 'write')).toBe(false)
  })

  test('private needs a credential for both reading and writing', () => {
    expect(anonymousAllowed('private', 'read')).toBe(false)
    expect(anonymousAllowed('private', 'write')).toBe(false)
  })

  test('the closed set is exactly the three levels the database check allows', () => {
    expect(SITE_ACCESS_LEVELS).toEqual(['open', 'login', 'private'])
  })
})
