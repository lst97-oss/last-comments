import { afterEach, describe, expect, spyOn, test } from 'bun:test'

import { createLogger, getRequestLogger, type Logger } from '@/server/observability/logger'

const SETTINGS = ['LOG_LEVEL', 'LOG_FORMAT', 'LOG_COLOR', 'NO_COLOR'] as const

function recordingSink(calls: Array<{ level: string; message: string; fields?: Record<string, unknown> }>): Logger {
  const make = (extra: Record<string, unknown>): Logger => ({
    debug: (message, fields) => calls.push({ level: 'debug', message, fields: { ...extra, ...fields } }),
    info: (message, fields) => calls.push({ level: 'info', message, fields: { ...extra, ...fields } }),
    warn: (message, fields) => calls.push({ level: 'warn', message, fields: { ...extra, ...fields } }),
    error: (message, fields) => calls.push({ level: 'error', message, fields: { ...extra, ...fields } }),
    child: (fields) => make({ ...extra, ...fields }),
  })
  return make({})
}

describe('createLogger', () => {
  test('forwards message and merged fields to sink', () => {
    const calls: Array<{ level: string; message: string; fields?: Record<string, unknown> }> = []
    const logger = createLogger({ sink: recordingSink(calls), baseFields: { service: 'api' } })
    logger.info('hello', { requestId: 'r1' })
    expect(calls).toEqual([{ level: 'info', message: 'hello', fields: { service: 'api', requestId: 'r1' } }])
  })

  test('child fields merge with child winning', () => {
    const calls: Array<{ level: string; message: string; fields?: Record<string, unknown> }> = []
    const logger = createLogger({ sink: recordingSink(calls), baseFields: { service: 'api' } })
    const child = logger.child({ requestId: 'r1' }).child({ requestId: 'r2', extra: 1 })
    child.warn('slow', { latencyMs: 9 })
    expect(calls).toEqual([
      { level: 'warn', message: 'slow', fields: { service: 'api', requestId: 'r2', extra: 1, latencyMs: 9 } },
    ])
  })
})

describe('redact', () => {
  afterEach(() => {
    for (const name of SETTINGS) delete process.env[name]
  })

  test('the policy runs on every line before it is formatted', () => {
    process.env.LOG_FORMAT = 'json'
    const info = spyOn(console, 'info').mockImplementation(() => {})
    const redact = (fields: Record<string, unknown>) => ({ ...fields, apiKey: '[redacted]' })
    createLogger({ redact }).info('loaded', { apiKey: 'secret-value', route: '/x' })
    const line = JSON.parse(String(info.mock.calls[0]?.[0]))
    expect(line).toMatchObject({ apiKey: '[redacted]', route: '/x' })
    expect(JSON.stringify(line)).not.toContain('secret-value')
    info.mockRestore()
  })
})

describe('getRequestLogger', () => {
  test('returns the same instance across calls', () => {
    expect(getRequestLogger()).toBe(getRequestLogger())
  })
})

describe('getRequestLogger redaction', () => {
  afterEach(() => {
    for (const name of SETTINGS) delete process.env[name]
  })

  test('redacts secret-named and message-named fields', () => {
    process.env.LOG_FORMAT = 'json'
    const info = spyOn(console, 'info').mockImplementation(() => {})
    getRequestLogger().info('chat.turn', { apiKey: 'secret-value', message: 'hello there' })
    const serialized = String(info.mock.calls[0]?.[0])
    expect(serialized).not.toContain('secret-value')
    expect(serialized).not.toContain('hello there')
    info.mockRestore()
  })

  test('masks an email address inside any string value', () => {
    process.env.LOG_FORMAT = 'json'
    const warn = spyOn(console, 'warn').mockImplementation(() => {})
    getRequestLogger().warn('contact.lookup', { detail: 'Key (email)=(ada@example.com) already exists' })
    expect(String(warn.mock.calls[0]?.[0])).not.toContain('ada@example.com')
    warn.mockRestore()
  })
})

describe('console output', () => {
  afterEach(() => {
    for (const name of SETTINGS) delete process.env[name]
  })

  test('the default floor is info, so debug stays quiet', () => {
    const debug = spyOn(console, 'debug').mockImplementation(() => {})
    const info = spyOn(console, 'info').mockImplementation(() => {})
    createLogger().debug('quiet')
    createLogger().info('loud')
    expect(debug).not.toHaveBeenCalled()
    expect(info).toHaveBeenCalledTimes(1)
    debug.mockRestore()
    info.mockRestore()
  })

  test('LOG_LEVEL=debug writes debug lines', () => {
    process.env.LOG_LEVEL = 'debug'
    const debug = spyOn(console, 'debug').mockImplementation(() => {})
    createLogger().debug('visible')
    expect(debug).toHaveBeenCalledTimes(1)
    debug.mockRestore()
  })

  test('LOG_FORMAT=json writes one JSON object per line', () => {
    process.env.LOG_FORMAT = 'json'
    const info = spyOn(console, 'info').mockImplementation(() => {})
    createLogger().info('hello', { a: 1 })
    expect(() => JSON.parse(String(info.mock.calls[0]?.[0]))).not.toThrow()
    info.mockRestore()
  })

  test('LOG_FORMAT=pretty writes the readable line even when not on a terminal', () => {
    process.env.LOG_FORMAT = 'pretty'
    const info = spyOn(console, 'info').mockImplementation(() => {})
    createLogger().info('hello', { a: 1 })
    expect(() => JSON.parse(String(info.mock.calls[0]?.[0]))).toThrow()
    expect(String(info.mock.calls[0]?.[0])).toContain('INFO  hello a=1')
    info.mockRestore()
  })

  test('LOG_COLOR=always colours a pretty line, and never does not', () => {
    process.env.LOG_FORMAT = 'pretty'
    const info = spyOn(console, 'info').mockImplementation(() => {})
    process.env.LOG_COLOR = 'always'
    createLogger().info('coloured')
    process.env.LOG_COLOR = 'never'
    createLogger().info('plain')
    expect(String(info.mock.calls[0]?.[0])).toContain('\x1b[')
    expect(String(info.mock.calls[1]?.[0])).not.toContain('\x1b')
    info.mockRestore()
  })
})
