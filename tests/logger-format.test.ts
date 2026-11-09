import { describe, expect, test } from 'bun:test'

import { formatJson, formatPretty, type LogEntry } from '@/server/observability/logger-format'

const plain = { color: false }
const entry: LogEntry = {
  level: 'info',
  message: 'channel.worker.status',
  fields: { component: 'channel-worker', uptimeMs: 19, queue: [], note: 'two words' },
  time: new Date(2026, 10, 3, 14, 32, 45, 657),
}

describe('formatPretty', () => {
  test('reads as time, level, component, message, then key=value', () => {
    expect(formatPretty(entry, plain)).toBe(
      '14:32:45.657 INFO  [channel-worker] channel.worker.status uptimeMs=19 queue=[] note="two words"',
    )
  })

  test('adds colour only when asked', () => {
    expect(formatPretty(entry, { color: true })).toContain('\x1b[1m')
    expect(formatPretty(entry, plain)).not.toContain('\x1b')
  })

  test('a list of records gets one indented row per record', () => {
    const withRows: LogEntry = {
      ...entry,
      fields: { component: 'channel-worker', facts: [{ label: 'VAPID keys', value: 'configured' }] },
    }
    expect(formatPretty(withRows, plain).split('\n')).toEqual([
      expect.stringContaining('channel.worker.status'),
      '  facts',
      '    label="VAPID keys" value=configured',
    ])
  })

  test('a plain record gets one indented name: value line per entry', () => {
    const withRecord: LogEntry = {
      ...entry,
      fields: {
        component: 'channel-worker',
        facts: { 'VAPID keys': 'configured', Subject: 'mailto:owner@example.com' },
      },
    }
    expect(formatPretty(withRecord, plain).split('\n')).toEqual([
      expect.stringContaining('channel.worker.status'),
      '  facts',
      '    VAPID keys: configured',
      '    Subject: mailto:owner@example.com',
    ])
  })

  test('an empty object stays inline', () => {
    const empty: LogEntry = { ...entry, fields: { component: 'channel-worker', facts: {} } }
    expect(formatPretty(empty, plain)).toBe('14:32:45.657 INFO  [channel-worker] channel.worker.status facts={}')
  })

  test('an error gets its fields as a block, with the trace below', () => {
    const error = { name: 'Error', message: 'trace-me', stack: 'Error: trace-me\n    at run (x.ts:1:1)' }
    const lines = formatPretty({ ...entry, level: 'error', fields: { error } }, plain).split('\n')
    expect(lines).toContain('  error')
    expect(lines).toContain('    message: trace-me')
    expect(lines.some((line) => line.startsWith('    stack:'))).toBe(false)
    expect(lines.join('\n')).toContain('Error: trace-me')
  })

  test('an error keeps its code and status in the block', () => {
    const error = { name: 'Error', message: 'limited', code: 'RATE_LIMITED', status: 429 }
    const lines = formatPretty({ ...entry, fields: { error } }, plain).split('\n')
    expect(lines).toContain('    code: RATE_LIMITED')
    expect(lines).toContain('    status: 429')
  })

  test('a redacted error, which keeps only its name, prints no trace line', () => {
    const lines = formatPretty({ ...entry, level: 'error', fields: { error: { name: 'Error' } } }, plain).split('\n')
    expect(lines).toEqual([expect.stringContaining('ERROR'), '  error', '    name: Error'])
  })

  test('a top-level stack string prints as the trace block, not inline', () => {
    const lines = formatPretty({ ...entry, level: 'error', fields: { stack: 'first\nsecond' } }, plain).split('\n')
    expect(lines).toEqual([expect.stringContaining('ERROR'), 'first', 'second'])
  })

  test('a long cell is cut so the block stays readable', () => {
    const lines = formatPretty({ ...entry, fields: { detail: { note: 'a'.repeat(400) } } }, plain).split('\n')
    expect(lines[2]?.endsWith('…')).toBe(true)
    expect((lines[2] ?? '').length).toBeLessThan(200)
  })

  test('a line break inside a block cell is escaped onto one line', () => {
    const lines = formatPretty({ ...entry, fields: { detail: { note: 'a\nb' } } }, plain).split('\n')
    expect(lines[2]).toBe('    note: "a\\nb"')
  })
})

describe('formatJson', () => {
  test('keeps the JSON line shape and writes the error fields as given', () => {
    const line = JSON.parse(
      formatJson({
        level: 'error',
        message: 'boom',
        fields: { component: 'x', error: { name: 'Error', message: 'inner' } },
        time: new Date(0),
      }),
    )
    expect(line).toMatchObject({ level: 'error', msg: 'boom', component: 'x', error: { message: 'inner' } })
    expect(line.time).toBe('1970-01-01T00:00:00.000Z')
  })

  test('a field named level, msg or time cannot replace the fixed keys', () => {
    const line = JSON.parse(
      formatJson({
        level: 'info',
        message: 'real',
        fields: { level: 'gold', msg: 'user text', time: 'x' },
        time: new Date(0),
      }),
    )
    expect(line).toMatchObject({ level: 'info', msg: 'real', time: '1970-01-01T00:00:00.000Z' })
  })
})
