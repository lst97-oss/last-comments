// Payload logs through pino. Its default prints coloured pino-pretty text, so in a container its lines and ours were
// two formats. This destination takes pino's JSON lines and writes them through writeLogLine, so Payload's output
// has the same settings and format as the rest of the process. No pino import is needed: pino's destination is any
// object with a write method.
import { type LogLevel, writeLogLine } from './logger.ts'

// pino's numeric levels: trace 10, debug 20, info 30, warn 40, error 50, fatal 60.
export function levelFromPino(level: unknown): LogLevel {
  const numeric = Number(level)
  if (!Number.isFinite(numeric)) return 'info'
  if (numeric >= 50) return 'error'
  if (numeric >= 40) return 'warn'
  if (numeric >= 30) return 'info'
  return 'debug'
}

// Keys pino writes on every line. We write the time and the component ourselves, and the rest is noise here.
const PINO_KEYS = new Set(['level', 'time', 'pid', 'hostname', 'name', 'msg', 'v'])

function parseRecord(line: string): Record<string, unknown> | null {
  try {
    const parsed: unknown = JSON.parse(line)
    return typeof parsed === 'object' && parsed !== null && !Array.isArray(parsed)
      ? (parsed as Record<string, unknown>)
      : null
  } catch {
    return null
  }
}

export type PayloadLogDestination = { write: (chunk: string) => void }

// A project's redaction policy, the same one its app logger uses (see createLogger's `redact`).
type Redact = (fields: Record<string, unknown>) => Record<string, unknown>

// pino calls write with one JSON line at a time. A line that is not JSON is written as plain text.
export function payloadLogDestination(redact: Redact = (fields) => fields): PayloadLogDestination {
  return {
    write(chunk) {
      for (const line of chunk.split('\n')) {
        if (line.trim() === '') continue
        const record = parseRecord(line)
        if (record === null) {
          writeLogLine('info', line, redact({ component: 'payload' }))
          continue
        }
        const fields = Object.fromEntries(Object.entries(record).filter(([key]) => !PINO_KEYS.has(key)))
        writeLogLine(
          levelFromPino(record.level),
          String(record.msg ?? ''),
          redact({ component: String(record.name ?? 'payload'), ...fields }),
        )
      }
    },
  }
}

// The `logger` option for Payload's buildConfig. pino filters nothing here: the LOG_LEVEL check in writeLogLine decides,
// so every setting is still read in one place. Payload itself still honours DISABLE_LOGGING.
export function payloadLoggerConfig(redact?: Redact) {
  return { options: { name: 'payload', level: 'trace' }, destination: payloadLogDestination(redact) }
}
