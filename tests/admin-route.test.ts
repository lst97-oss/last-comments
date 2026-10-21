import { isNotFound, isRedirect } from '@tanstack/react-router'
import { describe, expect, test } from 'bun:test'

import {
  buildAdminRenderParams,
  buildAdminRenderRequest,
  getAdminRenderIntent,
  parseAdminSearchParams,
  resolveAdminRenderResult,
} from '@/lib/payload/admin-route'

describe('parseAdminSearchParams', () => {
  test('parses query string into a record', () => {
    expect(parseAdminSearchParams('?depth=1&draft=false')).toEqual({ depth: '1', draft: 'false' })
  })

  test('empty string yields an empty record', () => {
    expect(parseAdminSearchParams('')).toEqual({})
  })

  test('last duplicate key wins', () => {
    expect(parseAdminSearchParams('?a=1&a=2')).toEqual({ a: '2' })
  })
})

describe('buildAdminRenderParams', () => {
  test('empty segments yield no splat param', () => {
    expect(buildAdminRenderParams([])).toEqual({})
  })

  test('non-empty segments forward as splat', () => {
    expect(buildAdminRenderParams(['collections', 'users'])).toEqual({ segments: ['collections', 'users'] })
  })
})

describe('buildAdminRenderRequest', () => {
  test('composes search and segments', () => {
    expect(buildAdminRenderRequest('?depth=1', ['collections'])).toEqual({
      search: { depth: '1' },
      segments: ['collections'],
    })
  })
})

describe('getAdminRenderIntent', () => {
  test('null intent renders', () => {
    expect(getAdminRenderIntent(null)).toEqual({ type: 'render' })
  })

  test('notFound intent maps through', () => {
    expect(getAdminRenderIntent({ type: 'notFound' })).toEqual({ type: 'not-found' })
  })

  test('redirect intent with url maps through', () => {
    expect(getAdminRenderIntent({ type: 'redirect', url: '/admin/login' })).toEqual({
      type: 'redirect',
      url: '/admin/login',
    })
  })

  test('redirect intent without url falls back to render', () => {
    expect(getAdminRenderIntent({ type: 'redirect' })).toEqual({ type: 'render' })
  })
})

describe('resolveAdminRenderResult', () => {
  test('render intent returns the result untouched', () => {
    const result = { element: 'tree', intent: null }
    expect(resolveAdminRenderResult(result)).toBe(result)
  })

  test('redirect intent throws a router redirect', () => {
    try {
      resolveAdminRenderResult({ element: null, intent: { type: 'redirect', url: '/admin/login' } })
      throw new Error('did not throw')
    } catch (thrown) {
      expect(isRedirect(thrown)).toBe(true)
    }
  })

  test('notFound intent throws a router notFound', () => {
    try {
      resolveAdminRenderResult({ element: 'payload', intent: { type: 'notFound' } })
      throw new Error('did not throw')
    } catch (thrown) {
      expect(isNotFound(thrown)).toBe(true)
    }
  })
})
