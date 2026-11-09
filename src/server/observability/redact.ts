// This project's log policy: what may leave the process in a log line. Its logger applies it to every line (see
// logger.ts). Secrets, tokens and message bodies (chat text, contact messages) are redacted by key name at any depth.
// An error keeps only its name, because its message can carry user content. A stack repeats that message on its
// first line, so it is redacted by key too (Payload's pino errors arrive as plain `err` objects, not Error instances).
const REDACTED_KEY = /password|secret|token|api[-_]?key|authorization|message|content|stack/i
// Keys cannot cover every place an address appears (a database error quotes one inside a plain string), so any email
// address in any string value is masked too.
const EMAIL = /[\w.+-]+@[\w-]+(\.[\w-]+)+/g
const MAX_DEPTH = 3
const MAX_ITEMS = 20

function sanitize(value: unknown, depth = 0): unknown {
  if (depth > MAX_DEPTH) return '[truncated]'
  if (value instanceof Error) return { name: value.name }
  if (Array.isArray(value)) return value.slice(0, MAX_ITEMS).map((item) => sanitize(item, depth + 1))
  if (typeof value === 'object' && value !== null) {
    const output: Record<string, unknown> = {}
    for (const [key, item] of Object.entries(value)) {
      output[key] = REDACTED_KEY.test(key) ? '[redacted]' : sanitize(item, depth + 1)
    }
    return output
  }
  return typeof value === 'string' ? value.replace(EMAIL, '[email]') : value
}

// One log line's fields, sanitized. The result is always a record.
export function sanitizeLogFields(fields: Record<string, unknown>): Record<string, unknown> {
  const safe = sanitize(fields)
  return typeof safe === 'object' && safe !== null && !Array.isArray(safe) ? (safe as Record<string, unknown>) : {}
}
