import { describe, expect, test } from 'bun:test'

import { HttpError } from '@/server/http/errors'
import { withContext } from '@/server/http/with-context'
import { type Logger } from '@/server/observability/logger'

function recordingLogger(calls: Array<{ level: string; message: string; fields?: Record<string, unknown> }>): Logger {
  const make = (extra: Record<string, unknown>): Logger => ({
    debug: (message, fields) => calls.push({ level: 'debug', message, fields: { ...extra, ...fields } }),
    info: (message, fields) => calls.push({ level: 'info', message, fields: { ...extra, ...fields } }),
    warn: (message, fields) => calls.push({ level: 'warn', message, fields: { ...extra, ...fields } }),
    error: (message, fields) => calls.push({ level: 'error', message, fields: { ...extra, ...fields } }),
    child: (fields) => make({ ...extra, ...fields }),
  })
  return make({})
}

function request(id?: string): { request: Request } {
  const headers: Record<string, string> = id ? { 'x-request-id': id } : {}
  return { request: new Request('http://localhost/api/ready', { headers }) }
}

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

describe('withContext', () => {
  test('echoes inbound id and wraps result in data envelope', async () => {
    const calls: Array<{ level: string; message: string; fields?: Record<string, unknown> }> = []
    const handler = withContext(async (ctx) => ({ id: ctx.requestId }), { logger: recordingLogger(calls) })
    const res = await handler(request('probe-1'))
    expect(res.status).toBe(200)
    expect(res.headers.get('x-request-id')).toBe('probe-1')
    expect(await res.json()).toEqual({ data: { id: 'probe-1' } })
    const start = calls.find((c) => c.message === 'request.start')
    const complete = calls.find((c) => c.message === 'request.complete')
    expect(start?.fields).toMatchObject({ requestId: 'probe-1', method: 'GET', path: '/api/ready' })
    expect(complete?.fields).toMatchObject({ requestId: 'probe-1', status: 200 })
    expect(typeof complete?.fields?.latencyMs).toBe('number')
  })

  test('generates uuid when header absent', async () => {
    const calls: Array<{ level: string; message: string; fields?: Record<string, unknown> }> = []
    const handler = withContext(async (ctx) => ({ id: ctx.requestId }), { logger: recordingLogger(calls) })
    const res = await handler(request())
    const echoed = res.headers.get('x-request-id')
    expect(echoed).toMatch(uuidPattern)
    expect(await res.json()).toEqual({ data: { id: echoed } })
  })

  test('handler throw maps to fail status with echoed id', async () => {
    const calls: Array<{ level: string; message: string; fields?: Record<string, unknown> }> = []
    const handler = withContext(
      async () => {
        throw new HttpError(400, 'BAD_REQUEST', 'bad input')
      },
      { logger: recordingLogger(calls) },
    )
    const res = await handler(request('probe-9'))
    expect(res.status).toBe(400)
    expect(res.headers.get('x-request-id')).toBe('probe-9')
    expect(await res.json()).toEqual({ error: { code: 'BAD_REQUEST', message: 'bad input' } })
    expect(calls.find((c) => c.message === 'request.rejected')?.fields).toMatchObject({
      requestId: 'probe-9',
      code: 'BAD_REQUEST',
      status: 400,
    })
    expect(calls.find((c) => c.message === 'request.rejected')?.level).toBe('info')
    expect(calls.find((c) => c.message === 'request.rejected')?.fields).not.toHaveProperty('message')
  })

  test('unexpected errors log safe diagnostics without the exception message', async () => {
    const calls: Array<{ level: string; message: string; fields?: Record<string, unknown> }> = []
    const handler = withContext(
      async () => {
        throw new Error('postgres://business:private@db')
      },
      { logger: recordingLogger(calls) },
    )
    const res = await handler(request('probe-10'))
    expect(res.status).toBe(500)
    expect(calls.find((c) => c.message === 'request.error')?.fields).toMatchObject({
      requestId: 'probe-10',
      code: 'INTERNAL_ERROR',
      status: 500,
      errorName: 'Error',
    })
    expect(calls.find((c) => c.message === 'request.error')?.fields).not.toHaveProperty('message')
  })

  test('maps database connectivity failures to a safe 503 response', async () => {
    const calls: Array<{ level: string; message: string; fields?: Record<string, unknown> }> = []
    const handler = withContext(
      async () => {
        throw Object.assign(new Error('postgres://business:private@db'), { code: '08006' })
      },
      { logger: recordingLogger(calls) },
    )
    const response = await handler(request('db-request'))
    expect(response.status).toBe(503)
    expect(await response.json()).toEqual({
      error: { code: 'DATABASE_UNAVAILABLE', message: 'The database is temporarily unavailable. Please try again.' },
    })
    expect(calls.find((c) => c.message === 'request.error')?.fields).toMatchObject({
      requestId: 'db-request',
      databaseCode: '08006',
    })
    expect(calls.find((c) => c.message === 'request.error')?.fields).not.toHaveProperty('message')
  })

  test('preserves library response body, status, and cookies while adding the request id', async () => {
    const nativeResponse = new Response('{"message":"unauthorized"}', {
      status: 401,
      headers: { 'content-type': 'application/json', 'set-cookie': 'session=abc; HttpOnly' },
    })
    const handler = withContext(async () => nativeResponse)
    const response = await handler(request('auth-request'))
    expect(response.status).toBe(401)
    expect(response.headers.get('content-type')).toBe('application/json')
    expect(response.headers.get('set-cookie')).toBe('session=abc; HttpOnly')
    expect(response.headers.get('x-request-id')).toBe('auth-request')
    expect(await response.text()).toBe('{"message":"unauthorized"}')
  })
})
