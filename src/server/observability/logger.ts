import { createPrettySink, getLoggerSettings, normalizeLogFields } from '@/server/observability/logger-format'

export type LogLevel = 'debug' | 'info' | 'warn' | 'error'

export type Logger = Record<LogLevel, (message: string, fields?: Record<string, unknown>) => void> & {
  child: (fields: Record<string, unknown>) => Logger
}

type LogWriter = (level: LogLevel, message: string, fields: Record<string, unknown>) => void

function makeLogger(write: LogWriter, base: Record<string, unknown>, verbose: boolean): Logger {
  const noop = (_message: string, _fields?: Record<string, unknown>): void => undefined
  const logger: Logger = {
    debug: verbose ? (message, fields) => write('debug', message, { ...base, ...fields }) : noop,
    info: (message, fields) => write('info', message, { ...base, ...fields }),
    warn: (message, fields) => write('warn', message, { ...base, ...fields }),
    error: (message, fields) => write('error', message, { ...base, ...fields }),
    child: (fields) => makeLogger(write, { ...base, ...fields }, verbose),
  }
  return logger
}

function consoleWriter(level: LogLevel, message: string, fields: Record<string, unknown>): void {
  console[level](JSON.stringify({ level, msg: message, ...normalizeLogFields(fields), time: new Date().toISOString() }))
}

export function createLogger(options?: {
  sink?: Logger
  baseFields?: Record<string, unknown>
  format?: 'json' | 'pretty' | 'auto'
  verbose?: boolean
}): Logger {
  const base = options?.baseFields ?? {}
  const verbose = options?.verbose ?? getLoggerSettings().verbose
  if (options?.sink) {
    const sink = options.sink
    return makeLogger((level, message, fields) => sink[level](message, fields), base, verbose)
  }
  const format = options?.format ?? 'auto'
  const pretty = format === 'pretty' || (format === 'auto' && getLoggerSettings().pretty)
  if (pretty) {
    const sink = createPrettySink({ verbose })
    return makeLogger((level, message, fields) => sink[level](message, fields), base, verbose)
  }
  return makeLogger(consoleWriter, base, verbose)
}

let requestLogger: Logger | null = null

export function getRequestLogger(): Logger {
  if (!requestLogger) {
    requestLogger = createLogger()
  }
  return requestLogger
}
