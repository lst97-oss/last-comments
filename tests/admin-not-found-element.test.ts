import { describe, expect, test } from 'bun:test'

import { adminNotFoundElement } from '@/lib/payload/admin-not-found-element'

describe('adminNotFoundElement', () => {
  test('non-object data yields no element', () => {
    expect(adminNotFoundElement(null)).toBeUndefined()
    expect(adminNotFoundElement(undefined)).toBeUndefined()
    expect(adminNotFoundElement('element')).toBeUndefined()
  })

  test('missing element key yields no element', () => {
    expect(adminNotFoundElement({})).toBeUndefined()
  })

  test('null element yields no element', () => {
    expect(adminNotFoundElement({ element: null })).toBeUndefined()
  })

  test('forwarded element is returned as-is', () => {
    const element = 'forwarded-tree'
    expect(adminNotFoundElement({ element })).toBe(element)
  })

  test('falsy-but-legal children are preserved, not treated as absent', () => {
    expect(adminNotFoundElement({ element: 0 })).toBe(0)
    expect(adminNotFoundElement({ element: '' })).toBe('')
  })
})
