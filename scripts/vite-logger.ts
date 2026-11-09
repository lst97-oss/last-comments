// The dev tools' output (Vite and Nitro) in the same format and settings as the server's logs. Vite's known lines get
// an event name and fields (vite.url scope=local url=...). Anything else prints as its own text under its component.
// Nitro reports through consola, so routeConsola sends that output through the same writer. Sourcemap warnings about
// dependency files are not actionable, so they log at debug, as Payload's Vite plugin already suppresses them.
import { consola, type LogObject } from 'consola'
import type { LogErrorOptions, LogOptions, Logger as ViteLogger } from 'vite'
import { type LogLevel, writeLogLine } from '../src/server/observability/logger.ts'

const ANSI = /\x1b\[[0-9;]*m/g

// A multi-line message becomes one line per entry, without colour codes or blank lines.
function plainLines(text: string): string[] {
  return text
    .split('\n')
    .map((line) => line.replace(ANSI, '').trim())
    .filter((line) => line !== '')
}

type ViteLine = { message: string; level?: LogLevel; fields: Record<string, unknown> }

type Rule = {
  pattern: RegExp
  event: string
  level?: LogLevel
  fields?: (match: RegExpMatchArray) => Record<string, unknown>
}

// Paths print relative to the project, so a line stays short.
function displayPath(file: string): string {
  const root = `${process.cwd()}/`
  return file.startsWith(root) ? file.slice(root.length) : file
}

// Vite's wording, mapped to event names. The first matching rule wins.
const RULES: readonly Rule[] = [
  {
    pattern: /^VITE v(\S+)\s+ready in (\d+) ms$/,
    event: 'vite.ready',
    fields: (m) => ({ version: m[1] ?? '', readyInMs: Number(m[2]) }),
  },
  {
    pattern: /^➜\s+(Local|Network):\s+(\S+)$/,
    event: 'vite.url',
    fields: (m) => ({ scope: (m[1] ?? '').toLowerCase(), url: m[2] ?? '' }),
  },
  {
    pattern: /^page reload (.+?)(?: \((.+)\))?$/,
    event: 'vite.reload',
    fields: (m) => ({ file: displayPath(m[1] ?? ''), reason: m[2] }),
  },
  { pattern: /^hmr update (.+)$/, event: 'vite.hmr', fields: (m) => ({ file: displayPath(m[1] ?? '') }) },
  {
    pattern: /^Sourcemap for "(.+?)" points to /,
    event: 'vite.sourcemap',
    level: 'debug',
    fields: (m) => ({ file: displayPath(m[1] ?? '') }),
  },
  { pattern: /^Failed to load source map/, event: 'vite.sourcemap', level: 'debug' },
  {
    pattern: /^(press h \+ enter to show help|➜\s+Network: use --host to expose)$/,
    event: 'vite.hint',
    level: 'debug',
  },
]

// One Vite line, classified. A line no rule matches keeps its text as the message.
export function classifyViteLine(text: string): ViteLine {
  const line = text.replace(ANSI, '').trim()
  for (const rule of RULES) {
    const match = line.match(rule.pattern)
    if (match) return { message: rule.event, level: rule.level, fields: rule.fields?.(match) ?? {} }
  }
  return { message: line, fields: {} }
}

// consola's types, reduced to the four levels this repo logs at.
export function consolaLevel(type: string): LogLevel {
  if (type === 'fatal' || type === 'error' || type === 'fail') return 'error'
  if (type === 'warn') return 'warn'
  if (type === 'debug' || type === 'trace' || type === 'verbose') return 'debug'
  return 'info'
}

// Nitro's emulation banner and route notes go through consola's reporter. Replacing it sends them through writeLogLine.
export function routeConsola(): void {
  consola.setReporters([
    {
      log(logObj: LogObject) {
        const level = consolaLevel(logObj.type)
        for (const line of plainLines(logObj.args.map(String).join(' '))) {
          writeLogLine(level, line, { component: logObj.tag || 'nitro' })
        }
      },
    },
  ])
}

// The env-runner package (the dev server's Vercel emulation) reports through console.warn. A missing OIDC token is
// normal when local work uses no Vercel services, so that notice logs at debug and stays out of the default output.
// An expired or malformed token points to a real problem, so it stays a warning.
export function classifyEnvRunnerLine(text: string): {
  level: LogLevel
  message: string
  fields: Record<string, unknown>
} {
  const line = text
    .replace(ANSI, '')
    .replace(/^\[env-runner\]\s*/, '')
    .trim()
  if (line.startsWith('VERCEL_OIDC_TOKEN is not set')) {
    return { level: 'debug', message: 'vercel.oidc_token.missing', fields: { hint: 'vercel env pull' } }
  }
  const expired = line.match(/^VERCEL_OIDC_TOKEN expired at (\S+?)\.? /)
  if (expired) {
    return {
      level: 'warn',
      message: 'vercel.oidc_token.expired',
      fields: { expiredAt: expired[1] ?? '', hint: 'vercel env pull' },
    }
  }
  if (line.startsWith('VERCEL_OIDC_TOKEN is malformed')) {
    return { level: 'warn', message: 'vercel.oidc_token.malformed', fields: { hint: 'vercel env pull' } }
  }
  return { level: 'warn', message: line, fields: {} }
}

// Wraps console.warn once. env-runner lines go through the same writer; every other warning is passed on unchanged.
export function routeEnvRunnerWarnings(): void {
  const original = console.warn
  if ((original as unknown as { routed?: boolean }).routed) return
  const routed = (...args: unknown[]): void => {
    const text = args.map(String).join(' ')
    if (!text.replace(ANSI, '').startsWith('[env-runner]')) {
      original(...args)
      return
    }
    const line = classifyEnvRunnerLine(text)
    writeLogLine(line.level, line.message, { component: 'env-runner', ...line.fields })
  }
  Object.assign(routed, { routed: true })
  console.warn = routed as typeof console.warn
}

// The one call a dev config makes: Nitro's consola output and env-runner's warnings both go through the same writer.
export function routeDevToolLogs(): void {
  routeConsola()
  routeEnvRunnerWarnings()
}

// Vite's Logger interface, writing through the same writer as the server.
export function viteLogger(): ViteLogger {
  const warnedOnce = new Set<string>()
  const errorsLogged = new WeakSet<object>()
  let warned = false

  function writeEntry(level: LogLevel, line: string, options?: LogOptions, extra: Record<string, unknown> = {}): void {
    const classified = classifyViteLine(line)
    const fields: Record<string, unknown> = { component: 'vite', ...classified.fields, ...extra }
    if (options?.environment) fields.env = options.environment.replace(ANSI, '').replace(/[()]/g, '')
    writeLogLine(classified.level ?? level, classified.message, fields)
  }

  // A warning or error is one entry: its first line is the message and the rest is its trace block. Info lines
  // (the banner, the URLs) stay one entry per line.
  function emit(level: LogLevel, text: string, options?: LogOptions): void {
    const [first, ...rest] = plainLines(text)
    if (first === undefined) return
    if ((level === 'warn' || level === 'error') && rest.length > 0) {
      writeEntry(level, first, options, { stack: rest.join('\n') })
      return
    }
    for (const line of plainLines(text)) writeEntry(level, line, options)
  }

  return {
    info: (message, options) => emit('info', message, options),
    warn: (message, options) => {
      warned = true
      emit('warn', message, options)
    },
    warnOnce: (message, options) => {
      if (warnedOnce.has(message)) return
      warnedOnce.add(message)
      warned = true
      emit('warn', message, options)
    },
    error: (message, options?: LogErrorOptions) => {
      if (options?.error) errorsLogged.add(options.error)
      emit('error', message, options)
    },
    clearScreen: () => {},
    hasErrorLogged: (error) => errorsLogged.has(error),
    get hasWarned() {
      return warned
    },
  }
}
