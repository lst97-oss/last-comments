// The one logging contract for this repo family. Every service and dev tool reads its settings here.
//   LOG_LEVEL   debug | info | warn | error     default info; debug stays quiet unless asked for
//   LOG_FORMAT  auto | pretty | json            default auto: pretty on a terminal, json anywhere else
//   LOG_COLOR   auto | always | never           default auto: colour on a terminal, off under NO_COLOR or TERM=dumb
// An unset or unrecognised value takes its default. Dev scripts pass pretty and always explicitly, because
// a dev server runs requests in a worker thread, which never reports a terminal.

export type LogLevel = 'debug' | 'info' | 'warn' | 'error'
export type LogFormat = 'pretty' | 'json'
export type LogSettings = { level: LogLevel; format: LogFormat; color: boolean }

const LEVEL_ORDER: Record<LogLevel, number> = { debug: 10, info: 20, warn: 30, error: 40 }
const LEVELS = Object.keys(LEVEL_ORDER) as LogLevel[]

// True when a line at `level` should be written under the `floor` set by LOG_LEVEL.
export function levelAtLeast(level: LogLevel, floor: LogLevel): boolean {
  return LEVEL_ORDER[level] >= LEVEL_ORDER[floor]
}

function choose<T extends string>(value: string | undefined, allowed: readonly T[]): T | undefined {
  const normalized = value?.trim().toLowerCase()
  return allowed.find((item) => item === normalized)
}

// `stdoutIsTerminal` is passed in, not read here, so the rules stay a pure function a test can drive.
export function resolveLogSettings(env: Record<string, string | undefined>, stdoutIsTerminal: boolean): LogSettings {
  const level = choose(env.LOG_LEVEL, LEVELS) ?? 'info'
  const formatMode = choose(env.LOG_FORMAT, ['auto', 'pretty', 'json'] as const) ?? 'auto'
  const colorMode = choose(env.LOG_COLOR, ['auto', 'always', 'never'] as const) ?? 'auto'
  const format: LogFormat = formatMode === 'auto' ? (stdoutIsTerminal ? 'pretty' : 'json') : formatMode
  const color =
    colorMode === 'always' || (colorMode === 'auto' && stdoutIsTerminal && !env.NO_COLOR && env.TERM !== 'dumb')
  return { level, format, color }
}
