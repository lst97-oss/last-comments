import { formatClockTime } from '@/lib/time'
import type { Logger, LogLevel } from '@/server/observability/logger'

export type PrettySinkOptions = {
  colors?: boolean
  writer?: (line: string, level: LogLevel) => void
  now?: () => Date
  maxStackLines?: number
}

function clockTimeOf(iso: string): string {
  try {
    return formatClockTime(new Date(iso))
  } catch {
    return iso.slice(11, 23)
  }
}
const RESET = '[0m'
const DIM = '[2m'
const LEVEL_COLORS: Record<LogLevel, string> = {
  debug: '[90m',
  info: '[36m',
  warn: '[33m',
  error: '[31m',
}

const TRACE_KEYS = ['error', 'err', 'cause', 'failure'] as const

function defaultEnv(): Record<string, string | undefined> {
  try {
    if (typeof Bun !== 'undefined') return Bun.env
  } catch {}
  try {
    const env = globalThis.process?.env
    if (env) return env
  } catch {}
  return {}
}

export function shouldUseColors(env?: Record<string, string | undefined>): boolean {
  try {
    const source = env ?? defaultEnv()
    const noColor = source.NO_COLOR
    if (noColor !== undefined && noColor.trim() !== '') return false
    if (source.TERM === 'dumb') return false
    return globalThis.process?.stdout?.isTTY === true
  } catch {
    return false
  }
}

export function resolveColorEnabled(
  mode: 'auto' | 'always' | 'never',
  env?: Record<string, string | undefined>,
): boolean {
  if (mode === 'always') return true
  if (mode === 'never') return false
  return shouldUseColors(env)
}

export type LoggerSettings = { pretty: boolean; verbose: boolean; color: 'auto' | 'always' | 'never' }

function parseFlag(value: string | undefined, defaultValue: boolean): boolean {
  if (value === undefined || value.trim() === '') return defaultValue
  const normalized = value.trim().toLowerCase()
  if (['true', '1', 'yes', 'on'].includes(normalized)) return true
  if (['false', '0', 'no', 'off'].includes(normalized)) return false
  return defaultValue
}

function parseColor(value: string | undefined): 'auto' | 'always' | 'never' {
  const normalized = value?.trim().toLowerCase()
  if (normalized === 'always' || normalized === 'never' || normalized === 'auto') return normalized
  return 'auto'
}

export function getLoggerSettings(source?: Record<string, string | undefined>): LoggerSettings {
  const env = source ?? defaultEnv()
  return {
    pretty: parseFlag(env.LOG_PRETTY, true),
    verbose: parseFlag(env.LOG_VERBOSE, false),
    color: parseColor(env.LOG_COLOR),
  }
}

export function serializeError(value: unknown, seen: Set<unknown> = new Set(), depth = 0): unknown {
  if (value instanceof Error) {
    if (seen.has(value)) return '[circular]'
    seen.add(value)
    const code = 'code' in value ? value.code : undefined
    const status = 'status' in value ? value.status : undefined
    const stack = typeof value.stack === 'string' ? value.stack : undefined
    const rawCause = 'cause' in value ? value.cause : undefined
    const result: Record<string, unknown> = {
      name: value.name || 'Error',
      message: value.message,
    }
    if (code !== undefined) result.code = code
    if (status !== undefined) result.status = status
    if (stack !== undefined) result.stack = stack
    if (rawCause !== undefined) {
      result.cause = depth < 3 ? serializeError(rawCause, seen, depth + 1) : '[max depth]'
    }
    return result
  }
  if (Array.isArray(value)) {
    if (seen.has(value)) return '[circular]'
    seen.add(value)
    return value.map((item) => serializeError(item, seen, depth))
  }
  if (value !== null && typeof value === 'object') {
    if (seen.has(value)) return '[circular]'
    seen.add(value)
    const out: Record<string, unknown> = {}
    for (const [key, item] of Object.entries(value)) {
      out[key] = serializeError(item, seen, depth)
    }
    return out
  }
  return value
}

export function normalizeLogFields(fields: Record<string, unknown>): Record<string, unknown> {
  const copy: Record<string, unknown> = { ...fields }
  for (const [key, value] of Object.entries(copy)) {
    if (value instanceof Error) copy[key] = serializeError(value)
  }
  return copy
}

function prettyValue(value: unknown): string {
  if (typeof value === 'string') return value
  try {
    return JSON.stringify(serializeError(value)) ?? String(value)
  } catch {
    return String(value)
  }
}

function stackBlockFor(fields: Record<string, unknown>, maxStackLines: number): string | null {
  for (const key of TRACE_KEYS) {
    const value = fields[key]
    if (value !== null && typeof value === 'object') {
      const stack = 'stack' in value ? value.stack : undefined
      if (typeof stack === 'string' && stack.trim() !== '') {
        return stack
          .split('\n')
          .filter((line) => line.trim() !== '')
          .slice(0, maxStackLines)
          .join('\n')
      }
      const name = 'name' in value && typeof value.name === 'string' ? value.name : 'Error'
      const message = 'message' in value && typeof value.message === 'string' ? value.message : prettyValue(value)
      return `${name}: ${message}`
    }
  }
  const direct = fields.stack
  if (typeof direct === 'string' && direct.trim() !== '') {
    return direct
      .split('\n')
      .filter((line) => line.trim() !== '')
      .slice(0, maxStackLines)
      .join('\n')
  }
  return null
}

export function formatLogLine(
  level: LogLevel,
  message: string,
  fields: Record<string, unknown>,
  opts: { colors: boolean; time: string; maxStackLines?: number },
): string {
  const normalized = normalizeLogFields(fields)
  const timeDisplay = clockTimeOf(opts.time)
  const plainTag = level.toUpperCase().padEnd(5)
  const levelTag = opts.colors ? `${LEVEL_COLORS[level]}${plainTag}${RESET}` : plainTag
  const timePart = opts.colors ? `${DIM}${timeDisplay}${RESET}` : timeDisplay
  const entries = Object.entries(normalized)
  const fieldPart =
    entries.length === 0 ? '' : ` ${entries.map(([key, value]) => `${key}=${prettyValue(value)}`).join(' ')}`
  const trace = stackBlockFor(normalized, opts.maxStackLines ?? 30)
  const tracePart = trace === null ? '' : `\n${opts.colors ? `${DIM}${trace}${RESET}` : trace}`
  return `${timePart} ${levelTag} ${message}${fieldPart}${tracePart}`
}

export function createPrettySink(options?: PrettySinkOptions & { verbose?: boolean }): Logger {
  const settings = getLoggerSettings()
  const colors = options?.colors ?? resolveColorEnabled(settings.color)
  const writer = options?.writer ?? ((line: string, level: LogLevel) => console[level](line))
  const now = options?.now ?? (() => new Date())
  const maxStackLines = options?.maxStackLines ?? 30
  const verbose = options?.verbose ?? settings.verbose
  const make = (base: Record<string, unknown>): Logger => {
    const emit = (level: LogLevel, message: string, fields?: Record<string, unknown>): void => {
      if (level === 'debug' && !verbose) return
      try {
        const merged = normalizeLogFields({ ...base, ...fields })
        const line = formatLogLine(level, message, merged, { colors, time: now().toISOString(), maxStackLines })
        try {
          writer(line, level)
        } catch {
          console[level](message)
        }
      } catch {
        try {
          console[level](message)
        } catch {
          // Logging must never break the request path.
        }
      }
    }
    return {
      debug: (message, fields) => emit('debug', message, fields),
      info: (message, fields) => emit('info', message, fields),
      warn: (message, fields) => emit('warn', message, fields),
      error: (message, fields) => emit('error', message, fields),
      child: (extra) => make({ ...base, ...extra }),
    }
  }
  return make({})
}
