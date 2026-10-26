import { z } from 'zod'

import { ErrorCode, HttpError } from '@/server/http/errors'

// Shared zod → 400 mapper so every module reports validation failures the
// same way: HttpError(400, 'VALIDATION_ERROR', '<path>: <message>; …').
// Throwing (not returning) keeps use cases free of result-union plumbing —
// withContext maps it to { error: { code, message } } with status 400.
export function parseWith<T>(schema: z.ZodType<T>, input: unknown): T {
  try {
    return schema.parse(input)
  } catch (error) {
    if (error instanceof z.ZodError) {
      throw new HttpError(
        ErrorCode.VALIDATION_ERROR.status,
        ErrorCode.VALIDATION_ERROR.code,
        fromZodIssues(error.issues),
      )
    }
    throw error
  }
}

const MAX_JSON_BODY_BYTES = 128 * 1024

export async function parseJsonBody<T>(request: Request, schema: z.ZodType<T>): Promise<T> {
  const contentType = request.headers.get('content-type')?.split(';', 1)[0]?.trim().toLowerCase()
  if (contentType !== 'application/json' && !contentType?.endsWith('+json')) {
    throw new HttpError(
      ErrorCode.UNSUPPORTED_MEDIA_TYPE.status,
      ErrorCode.UNSUPPORTED_MEDIA_TYPE.code,
      'Content-Type must be application/json',
    )
  }
  const contentLength = Number(request.headers.get('content-length'))
  if (Number.isFinite(contentLength) && contentLength > MAX_JSON_BODY_BYTES) {
    throw new HttpError(ErrorCode.BODY_TOO_LARGE.status, ErrorCode.BODY_TOO_LARGE.code, 'request body exceeds 128 KiB')
  }

  let json: unknown
  try {
    if (!request.body) throw new Error('missing body')
    const reader = request.body.getReader()
    const chunks: Uint8Array[] = []
    let size = 0
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      size += value.byteLength
      if (size > MAX_JSON_BODY_BYTES) {
        void reader.cancel().catch(() => undefined)
        throw new HttpError(
          ErrorCode.BODY_TOO_LARGE.status,
          ErrorCode.BODY_TOO_LARGE.code,
          'request body exceeds 128 KiB',
        )
      }
      chunks.push(value)
    }
    const bytes = new Uint8Array(size)
    let offset = 0
    for (const chunk of chunks) {
      bytes.set(chunk, offset)
      offset += chunk.byteLength
    }
    json = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes))
  } catch (error) {
    if (error instanceof HttpError) throw error
    throw new HttpError(
      ErrorCode.MALFORMED_JSON.status,
      ErrorCode.MALFORMED_JSON.code,
      'request body is not valid JSON',
    )
  }
  return parseWith(schema, json)
}

export function parseSearchParams<T>(url: string, schema: z.ZodType<T>): T {
  let params: URLSearchParams
  try {
    params = new URL(url).searchParams
  } catch {
    throw new HttpError(
      ErrorCode.VALIDATION_ERROR.status,
      ErrorCode.VALIDATION_ERROR.code,
      'url: request URL is not valid',
    )
  }
  const entries = [...params]
  if (new Set(entries.map(([key]) => key)).size !== entries.length) {
    throw new HttpError(
      ErrorCode.VALIDATION_ERROR.status,
      ErrorCode.VALIDATION_ERROR.code,
      'query: duplicate parameters are not allowed',
    )
  }
  return parseWith(schema, Object.fromEntries(entries))
}

function fromZodIssues(issues: z.ZodError['issues']): string {
  if (issues.length === 0) return 'invalid input'
  return issues
    .map((issue) => {
      const path = issue.path.length > 0 ? issue.path.join('.') : 'value'
      return `${path}: ${issue.message}`
    })
    .join('; ')
}
