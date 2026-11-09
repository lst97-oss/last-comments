// Pure formatting for log events. Nothing here reads the environment or redacts: logger.ts and the dev tools decide the
// format and colour, and the fields arrive already redacted (see redact.ts). Keep this file identical in every repo
// that logs the same way.
import type { LogLevel } from './logger-settings.ts'

// One log event as the writers see it. The logger builds it; the formatters only read it.
export type LogEntry = { level: LogLevel; message: string; fields: Record<string, unknown>; time: Date }

// The JSON line that log shippers parse. Fixed keys come last, so a field named level, msg or time cannot win.
export function formatJson(entry: LogEntry): string {
  return JSON.stringify({
    ...entry.fields,
    level: entry.level,
    msg: entry.message,
    time: entry.time.toISOString(),
  })
}

type Style = 'bold' | 'dim' | 'gray' | 'green' | 'yellow' | 'red'
const SGR: Record<Style, string> = { bold: '1', dim: '2', gray: '90', green: '32', yellow: '33', red: '31' }
const LEVEL_LABEL: Record<LogLevel, { text: string; style: Style }> = {
  debug: { text: 'DEBUG', style: 'gray' },
  info: { text: 'INFO ', style: 'green' },
  warn: { text: 'WARN ', style: 'yellow' },
  error: { text: 'ERROR', style: 'red' },
}

// Block cells are cut so one long value (a SQL statement in an error message) cannot wrap the layout.
// The trace block keeps the full text.
const MAX_CELL_CHARS = 160
const MAX_STACK_LINES = 30
// Fields that may hold an error. The first one that is an object is the error the trace block shows.
const TRACE_KEYS = ['error', 'err', 'cause', 'failure'] as const

function formatTime(time: Date): string {
  const pad = (value: number, width = 2) => String(value).padStart(width, '0')
  return `${pad(time.getHours())}:${pad(time.getMinutes())}:${pad(time.getSeconds())}.${pad(time.getMilliseconds(), 3)}`
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value) && Object.keys(value).length > 0
}

function isRecordList(value: unknown): value is Record<string, unknown>[] {
  return Array.isArray(value) && value.length > 0 && value.every(isRecord)
}

function errorKey(fields: Record<string, unknown>): (typeof TRACE_KEYS)[number] | undefined {
  return TRACE_KEYS.find((name) => typeof fields[name] === 'object' && fields[name] !== null)
}

// Strings stay bare unless they hold a space, '=' or a quote, so the end of each `key=value` is visible.
function quoteIfNeeded(text: string): string {
  return text === '' || /[\s="]/.test(text) ? JSON.stringify(text) : text
}

// Scalars on the header line. Objects become compact JSON.
function inlineValue(value: unknown): string {
  if (typeof value === 'string') return quoteIfNeeded(value)
  if (typeof value === 'object' && value !== null) return JSON.stringify(value)
  return String(value)
}

// One block line per cell: a line break is escaped, and a long value is cut. A `name: value` line already separates
// the two, so a plain string is not quoted here.
function cellValue(value: unknown): string {
  const text = typeof value === 'string' ? (value.includes('\n') ? JSON.stringify(value) : value) : inlineValue(value)
  return text.length > MAX_CELL_CHARS ? `${text.slice(0, MAX_CELL_CHARS)}…` : text
}

// A cell inside a `key=value` row: strings get quotes when the row would be ambiguous.
function rowValue(value: unknown): string {
  const text = cellValue(value)
  return typeof value === 'string' && !value.includes('\n') ? quoteIfNeeded(text) : text
}

// The trace block shows the top-level stack. A nested cause would repeat its own stack, so it is dropped.
function withoutStack(value: unknown): unknown {
  if (!isRecord(value) || !('stack' in value)) return value
  return Object.fromEntries(Object.entries(value).filter(([name]) => name !== 'stack'))
}

function stackLines(stack: string, maxLines: number): string {
  return stack
    .split('\n')
    .filter((line) => line.trim() !== '')
    .slice(0, maxLines)
    .join('\n')
}

// An error with no stack and no message (a redacted one, which keeps only its name) gets no trace line.
function traceBlockFor(
  fields: Record<string, unknown>,
  key: (typeof TRACE_KEYS)[number] | undefined,
  maxLines: number,
): string | null {
  if (key !== undefined) {
    const error = fields[key] as Record<string, unknown>
    if (typeof error.stack === 'string' && error.stack.trim() !== '') return stackLines(error.stack, maxLines)
    if (typeof error.message === 'string') return `${String(error.name ?? 'Error')}: ${error.message}`
    return null
  }
  if (typeof fields.stack === 'string' && fields.stack.trim() !== '') return stackLines(fields.stack, maxLines)
  return null
}

// One line a person can scan: time, level, component, message, then key=value. Records get indented blocks:
// a list of records (queue rows) gets one line per record, a plain record (plugin facts) gets `name: value` lines,
// and the error gets its fields as a block with its stack below.
export function formatPretty(entry: LogEntry, options: { color: boolean; maxStackLines?: number }): string {
  const paint = (style: Style, text: string) => (options.color ? `\x1b[${SGR[style]}m${text}\x1b[0m` : text)
  const { component, ...rest } = entry.fields
  const level = LEVEL_LABEL[entry.level]
  const header = [
    paint('dim', formatTime(entry.time)),
    paint(level.style, level.text),
    component === undefined ? '' : paint('dim', `[${String(component)}]`),
    paint('bold', entry.message),
  ].filter(Boolean)
  const traced = errorKey(rest)
  const inline: string[] = []
  const blocks: string[] = []
  for (const [key, value] of Object.entries(rest)) {
    if (value === undefined) continue
    // A top-level stack string is shown as the trace block below, not repeated inline.
    if (key === 'stack' && traced === undefined && typeof value === 'string') continue
    if (key === traced && isRecord(value)) {
      blocks.push(`  ${paint('dim', key)}`)
      for (const [name, cell] of Object.entries(value)) {
        if (name !== 'stack') blocks.push(`    ${paint('dim', name)}: ${cellValue(withoutStack(cell))}`)
      }
    } else if (isRecordList(value)) {
      blocks.push(`  ${paint('dim', key)}`)
      for (const record of value) {
        const cells = Object.entries(record).map(([name, cell]) => `${paint('dim', name)}=${rowValue(cell)}`)
        blocks.push(`    ${cells.join(' ')}`)
      }
    } else if (isRecord(value)) {
      blocks.push(`  ${paint('dim', key)}`)
      for (const [name, cell] of Object.entries(value)) blocks.push(`    ${paint('dim', name)}: ${cellValue(cell)}`)
    } else {
      inline.push(`${paint('dim', key)}=${inlineValue(value)}`)
    }
  }
  const lines = [[...header, ...inline].join(' '), ...blocks]
  const trace = traceBlockFor(rest, traced, options.maxStackLines ?? MAX_STACK_LINES)
  if (trace !== null) lines.push(paint('dim', trace))
  return lines.join('\n')
}
