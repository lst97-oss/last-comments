import { afterEach, describe, expect, spyOn, test } from 'bun:test'

import { levelFromPino, payloadLogDestination } from '@/server/observability/payload-logger'
import { sanitizeLogFields } from '@/server/observability/redact'

const SETTINGS = ['LOG_LEVEL', 'LOG_FORMAT', 'LOG_COLOR', 'NO_COLOR'] as const

// One line as pino writes it, with the keys pino adds to every record.
function pinoLine(fields: Record<string, unknown>): string {
  return `${JSON.stringify({ v: 1, level: 40, time: 1, pid: 2, hostname: 'h', name: 'payload', msg: 'No email', ...fields })}\n`
}

afterEach(() => {
  for (const name of SETTINGS) delete process.env[name]
})

describe('levelFromPino', () => {
  test('maps pino levels onto ours, and a missing level to info', () => {
    expect(levelFromPino(10)).toBe('debug')
    expect(levelFromPino(20)).toBe('debug')
    expect(levelFromPino(30)).toBe('info')
    expect(levelFromPino(40)).toBe('warn')
    expect(levelFromPino(50)).toBe('error')
    expect(levelFromPino(60)).toBe('error')
    expect(levelFromPino(undefined)).toBe('info')
  })
})

describe('payloadLogDestination', () => {
  test('writes a pino warning in our format, without pino keys', () => {
    process.env.LOG_FORMAT = 'pretty'
    process.env.LOG_COLOR = 'never'
    const warn = spyOn(console, 'warn').mockImplementation(() => {})
    payloadLogDestination().write(pinoLine({ msg: 'No email adapter provided' }))
    expect(String(warn.mock.calls[0]?.[0])).toMatch(
      /^\d{2}:\d{2}:\d{2}\.\d{3} WARN  \[payload\] No email adapter provided$/,
    )
    warn.mockRestore()
  })

  test('pino fields carry through, and a fatal line is an error', () => {
    process.env.LOG_FORMAT = 'pretty'
    process.env.LOG_COLOR = 'never'
    const error = spyOn(console, 'error').mockImplementation(() => {})
    payloadLogDestination().write(pinoLine({ level: 60, msg: 'boom', attempt: 2 }))
    expect(String(error.mock.calls[0]?.[0])).toContain('ERROR [payload] boom attempt=2')
    error.mockRestore()
  })

  test('a line that is not JSON is written as plain text', () => {
    process.env.LOG_FORMAT = 'pretty'
    process.env.LOG_COLOR = 'never'
    const info = spyOn(console, 'info').mockImplementation(() => {})
    payloadLogDestination().write('plain text\n')
    expect(String(info.mock.calls[0]?.[0])).toContain('INFO  [payload] plain text')
    info.mockRestore()
  })

  test('several lines in one chunk each become a line', () => {
    process.env.LOG_FORMAT = 'pretty'
    process.env.LOG_COLOR = 'never'
    const warn = spyOn(console, 'warn').mockImplementation(() => {})
    payloadLogDestination().write(pinoLine({ msg: 'first' }) + pinoLine({ msg: 'second' }))
    expect(warn).toHaveBeenCalledTimes(2)
    warn.mockRestore()
  })

  test('a pino error stack that repeats the message is redacted with it', () => {
    process.env.LOG_FORMAT = 'json'
    const error = spyOn(console, 'error').mockImplementation(() => {})
    const message = 'duplicate key value (email)=(ada@example.com)'
    const err = { type: 'Error', message, stack: `Error: ${message}\n    at insert (db.ts:1:1)` }
    payloadLogDestination(sanitizeLogFields).write(pinoLine({ level: 50, msg: 'save failed', err }))
    const serialized = String(error.mock.calls[0]?.[0])
    expect(serialized).not.toContain('ada@example.com')
    expect(JSON.parse(serialized)).toMatchObject({
      msg: 'save failed',
      err: { message: '[redacted]', stack: '[redacted]' },
    })
    error.mockRestore()
  })

  test('LOG_LEVEL filters Payload lines too', () => {
    process.env.LOG_LEVEL = 'error'
    const warn = spyOn(console, 'warn').mockImplementation(() => {})
    payloadLogDestination().write(pinoLine({}))
    expect(warn).not.toHaveBeenCalled()
    warn.mockRestore()
  })
})
