import { describe, expect, test } from 'bun:test'

import { HttpError } from '@/server/http/errors'
import { fail, ok } from '@/server/http/response'

describe('ok', () => {
  test('wraps data with 200 and no-store', async () => {
    const res = ok({ status: 'ok' })
    expect(res.status).toBe(200)
    expect(res.headers.get('cache-control')).toBe('no-store')
    expect(await res.json()).toEqual({ data: { status: 'ok' } })
  })

  test('explicit status and caller cache-control wins', async () => {
    const res = ok({ status: 'degraded' }, { status: 503, headers: { 'cache-control': 'max-age=60' } })
    expect(res.status).toBe(503)
    expect(res.headers.get('cache-control')).toBe('max-age=60')
    expect(await res.json()).toEqual({ data: { status: 'degraded' } })
  })
})

describe('fail', () => {
  test('HttpError 400 exposes message', async () => {
    const res = fail(new HttpError(400, 'BAD_REQUEST', 'bad input'))
    expect(res.status).toBe(400)
    expect(await res.json()).toEqual({ error: { code: 'BAD_REQUEST', message: 'bad input' } })
  })

  test('preserves response headers attached to an HttpError', () => {
    const res = fail(new HttpError(429, 'RATE_LIMITED', 'slow down', { headers: { 'retry-after': '12' } }))
    expect(res.status).toBe(429)
    expect(res.headers.get('retry-after')).toBe('12')
  })

  test('plain Error maps to 500 generic message', async () => {
    const res = fail(new Error('db password=secret'))
    expect(res.status).toBe(500)
    expect(await res.json()).toEqual({
      error: { code: 'INTERNAL_ERROR', message: 'Something went wrong. Please try again.' },
    })
  })

  test('never exposes a 500 message even when explicitly requested', async () => {
    const res = fail(new HttpError(500, 'INTERNAL_ERROR', 'secret database details', { expose: true }))
    expect(res.status).toBe(500)
    expect(await res.json()).toEqual({
      error: { code: 'INTERNAL_ERROR', message: 'Something went wrong. Please try again.' },
    })
  })

  test('exposes an explicitly safe service-unavailable message', async () => {
    const res = fail(new HttpError(503, 'SERVICE_UNAVAILABLE', 'Please retry shortly', { expose: true }))
    expect(res.status).toBe(503)
    expect(await res.json()).toEqual({ error: { code: 'SERVICE_UNAVAILABLE', message: 'Please retry shortly' } })
  })
})
