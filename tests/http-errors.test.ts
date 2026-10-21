import { describe, expect, test } from 'bun:test'

import { HttpError, toHttpError } from '@/server/http/errors'

describe('HttpError', () => {
  test('4xx exposes message by default', () => {
    const err = new HttpError(400, 'BAD_REQUEST', 'bad input')
    expect(err.status).toBe(400)
    expect(err.code).toBe('BAD_REQUEST')
    expect(err.message).toBe('bad input')
    expect(err.expose).toBe(true)
  })

  test('500 hides message by default', () => {
    const err = new HttpError(500, 'INTERNAL_ERROR', 'secret detail')
    expect(err.expose).toBe(false)
  })

  test('explicit expose overrides default', () => {
    const err = new HttpError(500, 'INTERNAL_ERROR', 'shown', { expose: true })
    expect(err.expose).toBe(true)
  })
})

describe('toHttpError', () => {
  test('passes HttpError through by identity', () => {
    const err = new HttpError(404, 'NOT_FOUND', 'missing')
    expect(toHttpError(err)).toBe(err)
  })

  test('maps unknown Error to 500 INTERNAL_ERROR without leaking message on wire contract', () => {
    const mapped = toHttpError(new Error('db password=secret'))
    expect(mapped.status).toBe(500)
    expect(mapped.code).toBe('INTERNAL_ERROR')
    expect(mapped.expose).toBe(false)
  })

  test('maps non-Error input to 500', () => {
    const mapped = toHttpError('boom')
    expect(mapped.status).toBe(500)
    expect(mapped.code).toBe('INTERNAL_ERROR')
  })

  test('maps known PostgreSQL connection failures to 503 without exposing driver details', () => {
    const mapped = toHttpError(
      Object.assign(new Error('connection refused at postgres://user:secret@db'), { code: '08006' }),
    )
    expect(mapped.status).toBe(503)
    expect(mapped.code).toBe('DATABASE_UNAVAILABLE')
    expect(mapped.message).toBe('The database is temporarily unavailable. Please try again.')
    expect(mapped.expose).toBe(true)
  })

  test('leaves unknown database failures as internal errors', () => {
    const mapped = toHttpError(Object.assign(new Error('constraint detail'), { code: '23505' }))
    expect(mapped.status).toBe(500)
    expect(mapped.code).toBe('INTERNAL_ERROR')
    expect(mapped.expose).toBe(false)
  })
})
