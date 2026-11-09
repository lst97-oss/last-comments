import { describe, expect, test } from 'bun:test'

import { levelAtLeast, resolveLogSettings } from '@/server/observability/logger-settings'

describe('resolveLogSettings', () => {
  test('a terminal gets pretty, coloured lines at info', () => {
    expect(resolveLogSettings({}, true)).toEqual({ level: 'info', format: 'pretty', color: true })
  })

  test('anywhere else gets JSON without colour', () => {
    expect(resolveLogSettings({}, false)).toEqual({ level: 'info', format: 'json', color: false })
  })

  test('explicit values win over the terminal', () => {
    expect(resolveLogSettings({ LOG_FORMAT: 'json', LOG_COLOR: 'always', LOG_LEVEL: 'debug' }, true)).toEqual({
      level: 'debug',
      format: 'json',
      color: true,
    })
    expect(resolveLogSettings({ LOG_FORMAT: 'pretty', LOG_COLOR: 'never' }, false)).toEqual({
      level: 'info',
      format: 'pretty',
      color: false,
    })
  })

  test('auto colour respects NO_COLOR and TERM=dumb, but an empty NO_COLOR does not', () => {
    expect(resolveLogSettings({ NO_COLOR: '1' }, true).color).toBe(false)
    expect(resolveLogSettings({ TERM: 'dumb' }, true).color).toBe(false)
    expect(resolveLogSettings({ NO_COLOR: '' }, true).color).toBe(true)
  })

  test('unknown or blank values take the defaults, and names are case-insensitive', () => {
    expect(resolveLogSettings({ LOG_LEVEL: 'loud', LOG_FORMAT: 'xml', LOG_COLOR: 'rainbow' }, false)).toEqual({
      level: 'info',
      format: 'json',
      color: false,
    })
    expect(resolveLogSettings({ LOG_FORMAT: '   ' }, true).format).toBe('pretty')
    expect(resolveLogSettings({ LOG_LEVEL: 'DEBUG' }, false).level).toBe('debug')
  })
})

describe('levelAtLeast', () => {
  test('orders debug, info, warn and error', () => {
    expect(levelAtLeast('debug', 'info')).toBe(false)
    expect(levelAtLeast('info', 'info')).toBe(true)
    expect(levelAtLeast('error', 'warn')).toBe(true)
    expect(levelAtLeast('warn', 'error')).toBe(false)
  })
})
