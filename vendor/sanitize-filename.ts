type Replacement = string | ((substring: string, ...args: unknown[]) => string)

const encoder = new TextEncoder()
const illegalRe = /[\/\?<>\\:\*\|"]/g
const controlRe = /[\x00-\x1f\x80-\x9f]/g
const reservedRe = /^\.+$/
const windowsReservedRe = /^(con|prn|aux|nul|com[0-9]|lpt[0-9])(\..*)?$/i

function replaceMatches(value: string, pattern: RegExp, replacement: Replacement): string {
  if (typeof replacement === 'string') {
    return value.replace(pattern, replacement)
  }

  return value.replace(pattern, (...args) => {
    const [substring, ...rest] = args
    return replacement(substring, ...rest)
  })
}

function truncateUtf8(value: string, byteLength: number): string {
  let currentByteLength = 0
  let end = 0

  for (const segment of value) {
    const segmentByteLength = encoder.encode(segment).length
    if (currentByteLength + segmentByteLength > byteLength) {
      break
    }
    currentByteLength += segmentByteLength
    end += segment.length
  }

  return value.slice(0, end)
}

function sanitize(input: string, replacement: Replacement): string {
  if (typeof input !== 'string') {
    throw new Error('Input must be string')
  }

  let sanitized = replaceMatches(input, illegalRe, replacement)
  sanitized = replaceMatches(sanitized, controlRe, replacement)
  sanitized = replaceMatches(sanitized, reservedRe, replacement)
  sanitized = replaceMatches(sanitized, windowsReservedRe, replacement)

  let end = sanitized.length
  while (end > 0 && (sanitized[end - 1] === '.' || sanitized[end - 1] === ' ')) {
    end -= 1
  }

  if (end < sanitized.length) {
    sanitized = sanitized.slice(0, end) + replacement
  }

  return truncateUtf8(sanitized, 255)
}

export default function sanitizeFilename(input: string, options?: { replacement?: Replacement }): string {
  const replacement = options?.replacement ?? ''
  const output = sanitize(input, replacement)
  return replacement === '' ? output : sanitize(output, '')
}
