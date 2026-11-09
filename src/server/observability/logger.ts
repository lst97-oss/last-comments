// The logger contract and the console writer. Settings come from logger-settings.ts and formatting from
// logger-format.ts, so this file only decides where a line goes. Every log line in the process, including the
// dev tools and Payload's, goes through writeLogLine.
import { formatJson, formatPretty, type LogEntry } from './logger-format.ts'
import { type LogLevel, levelAtLeast, resolveLogSettings } from './logger-settings.ts'
import { sanitizeLogFields } from './redact.ts'

export type { LogLevel } from './logger-settings.ts'

export type Logger = Record<LogLevel, (message: string, fields?: Record<string, unknown>) => void> & {
  child: (fields: Record<string, unknown>) => Logger
}

type LogWriter = (level: LogLevel, message: string, fields: Record<string, unknown>) => void

function makeLogger(write: LogWriter, base: Record<string, unknown>): Logger {
  const logger: Logger = {
    debug: (message, fields) => write('debug', message, { ...base, ...fields }),
    info: (message, fields) => write('info', message, { ...base, ...fields }),
    warn: (message, fields) => write('warn', message, { ...base, ...fields }),
    error: (message, fields) => write('error', message, { ...base, ...fields }),
    child: (fields) => makeLogger(write, { ...base, ...fields }),
  }
  return logger
}

// Settings are read on every line, so a change to the environment takes effect without a restart.
export function writeLogLine(level: LogLevel, message: string, fields: Record<string, unknown>): void {
  const settings = resolveLogSettings(process.env, Boolean(process.stdout.isTTY))
  if (!levelAtLeast(level, settings.level)) return
  const entry: LogEntry = { level, message, fields, time: new Date() }
  console[level](settings.format === 'pretty' ? formatPretty(entry, { color: settings.color }) : formatJson(entry))
}

export type LogFields = Record<string, unknown>

// `redact` is a project's policy for what may leave the process: it runs on every line before formatting, so both
// formats see the same redaction. A project without a policy passes nothing.
export function createLogger(options?: {
  sink?: Logger
  baseFields?: LogFields
  redact?: (fields: LogFields) => LogFields
}): Logger {
  const base = options?.baseFields ?? {}
  if (options?.sink) {
    const sink = options.sink
    return makeLogger((level, message, fields) => sink[level](message, fields), base)
  }
  const redact = options?.redact ?? ((fields: LogFields) => fields)
  return makeLogger((level, message, fields) => writeLogLine(level, message, redact(fields)), base)
}

let requestLogger: Logger | null = null

// The shared logger for requests and workers. Its redaction policy (redact.ts) runs on every line.
export function getRequestLogger(): Logger {
  if (!requestLogger) {
    requestLogger = createLogger({ redact: sanitizeLogFields })
  }
  return requestLogger
}
