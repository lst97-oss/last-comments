import { describe, expect, test } from 'bun:test'

import { HttpError } from '@/server/http/errors'
import {
  createPrettySink,
  formatLogLine,
  getLoggerSettings,
  serializeError,
  shouldUseColors,
} from '@/server/observability/logger-format'

const TIME = '2026-10-16T12:34:56.789Z'
const ESC = ''
const RED_ERROR = '[31mERROR[0m'

describe('formatLogLine', () => {
  test('pretty line has level tag, message, and key=value with no escapes when colors off', () => {
    const line = formatLogLine('info', 'hello', { requestId: 'r1' }, { colors: false, time: TIME })
    expect(line).toContain('INFO')
    expect(line).toContain('hello')
    expect(line).toContain('requestId=r1')
    expect(line).not.toContain(ESC)
  })

  test('colors wrap the error level tag', () => {
    const line = formatLogLine('error', 'boom', {}, { colors: true, time: TIME })
    expect(line).toContain(RED_ERROR)
  })

  test('child fields merge with child winning', () => {
    const lines: string[] = []
    const sink = createPrettySink({
      colors: false,
      writer: (line) => lines.push(line),
      now: () => new Date(TIME),
    })
    sink.child({ requestId: 'r1' }).child({ requestId: 'r2', extra: 1 }).warn('slow', { latencyMs: 9 })
    expect(lines.length).toBe(1)
    const line: string = lines[0] ?? ''
    expect(line).toContain('WARN')
    expect(line).toContain('requestId=r2')
    expect(line).toContain('extra=1')
    expect(line).toContain('latencyMs=9')
  })
})

describe('serializeError', () => {
  test('HttpError keeps code, status, and message with nested cause', () => {
    const serialized: unknown = serializeError(new HttpError(503, 'RATE_LIMIT_UNAVAILABLE', 'x'))
    expect(serialized).toMatchObject({ code: 'RATE_LIMIT_UNAVAILABLE', status: 503, message: 'x' })
    const nested: unknown = serializeError(new Error('outer', { cause: new Error('inner') }))
    expect(nested).toMatchObject({ cause: { message: 'inner' } })
  })

  test('error trace renders as a second-line block', () => {
    const line = formatLogLine('error', 'boom', { error: new Error('trace-me') }, { colors: false, time: TIME })
    const [first, second] = line.split('\n')
    expect(first ?? '').toContain('ERROR')
    expect(first ?? '').toContain('boom')
    expect(second ?? '').toContain('trace-me')
  })

  test('circular cause does not throw', () => {
    const loop = new Error('loop')
    loop.cause = loop
    const serialized: unknown = serializeError(loop)
    expect(serialized).toMatchObject({ cause: '[circular]' })
  })
})

describe('getLoggerSettings', () => {
  test('pretty on, verbose off, and color auto by default', () => {
    expect(getLoggerSettings({})).toEqual({ pretty: true, verbose: false, color: 'auto' })
    expect(getLoggerSettings({ LOG_PRETTY: 'false', LOG_VERBOSE: 'true', LOG_COLOR: 'always' })).toEqual({
      pretty: false,
      verbose: true,
      color: 'always',
    })
  })

  test('unknown values fall back to defaults', () => {
    expect(getLoggerSettings({ LOG_PRETTY: 'maybe', LOG_VERBOSE: 'maybe', LOG_COLOR: 'rainbow' })).toEqual({
      pretty: true,
      verbose: false,
      color: 'auto',
    })
  })

  test('debug lines are dropped unless verbose', () => {
    const lines: string[] = []
    createPrettySink({ colors: false, writer: (line) => lines.push(line), now: () => new Date(TIME) }).debug('quiet')
    expect(lines).toEqual([])
    createPrettySink({
      colors: false,
      verbose: true,
      writer: (line) => lines.push(line),
      now: () => new Date(TIME),
    }).debug('loud')
    expect(lines.length).toBe(1)
  })
})

describe('shouldUseColors', () => {
  test('NO_COLOR and dumb TERM disable colors', () => {
    expect(shouldUseColors({ NO_COLOR: '1' })).toBe(false)
    expect(shouldUseColors({ TERM: 'dumb' })).toBe(false)
  })
})
