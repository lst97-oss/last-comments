import { HttpStatus } from '@lst97-oss/last-httprism'

import { toHttpError } from '@/server/http/errors'

const INTERNAL_ERROR_MESSAGE = 'Something went wrong. Please try again.'

function mergeHeaders(init?: { headers?: HeadersInit }): Headers {
  const headers = new Headers({ 'cache-control': 'no-store' })
  if (init?.headers) {
    for (const [key, value] of new Headers(init.headers)) {
      headers.set(key, value)
    }
  }
  return headers
}

export function ok<T>(data: T, init?: { status?: number; headers?: HeadersInit }): Response {
  return Response.json({ data }, { status: init?.status ?? HttpStatus.OK.code, headers: mergeHeaders(init) })
}

export function fail(error: unknown, init?: { headers?: HeadersInit }): Response {
  const httpError = toHttpError(error)
  const canExposeMessage =
    httpError.status < 500 ||
    ([HttpStatus.NOT_IMPLEMENTED.code, HttpStatus.SERVICE_UNAVAILABLE.code].includes(httpError.status) &&
      httpError.expose)
  const message = canExposeMessage ? httpError.message : INTERNAL_ERROR_MESSAGE
  const headers = new Headers(httpError.headers)
  if (init?.headers) {
    new Headers(init.headers).forEach((value, key) => {
      headers.set(key, value)
    })
  }
  return Response.json(
    { error: { code: httpError.code, message } },
    { status: httpError.status, headers: mergeHeaders({ headers }) },
  )
}
