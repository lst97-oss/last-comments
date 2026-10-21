import { describe, expect, test } from 'bun:test'

import { ApiRequestError, isUnauthenticatedError, readApiData } from '@/lib/api-response'

describe('readApiData', () => {
  test('returns null when null is a valid data value', async () => {
    const result = await readApiData(new Response('{"data":null}', { headers: { 'content-type': 'application/json' } }))
    expect(result).toBeNull()
  })

  test('preserves safe API error details and the request reference', async () => {
    const response = new Response('{"error":{"code":"UNAUTHENTICATED","message":"Sign in to continue"}}', {
      status: 401,
      headers: { 'content-type': 'application/json', 'x-request-id': 'request-1' },
    })
    await expect(readApiData(response)).rejects.toMatchObject({
      name: 'ApiRequestError',
      status: 401,
      code: 'UNAUTHENTICATED',
      requestId: 'request-1',
      message: 'Sign in to continue',
    })
  })

  test('does not display internal server response text', async () => {
    const response = new Response('postgres://business:private@db failed', {
      status: 500,
      headers: { 'x-request-id': 'request-2' },
    })
    await expect(readApiData(response)).rejects.toMatchObject({
      status: 500,
      code: 'INTERNAL_ERROR',
      requestId: 'request-2',
      message: 'Something went wrong. Please try again.',
    })
  })

  test('uses a stable message for malformed non-JSON error responses', async () => {
    const response = new Response('<html>upstream error</html>', { status: 502 })
    await expect(readApiData(response)).rejects.toMatchObject({
      status: 502,
      message: 'Something went wrong. Please try again.',
    })
  })

  test('rejects successful responses without the data envelope', async () => {
    await expect(readApiData(new Response('{}'))).rejects.toBeInstanceOf(ApiRequestError)
  })
})

describe('isUnauthenticatedError', () => {
  test('uses the stable status and code instead of message wording', () => {
    expect(isUnauthenticatedError(new ApiRequestError('Authentication required', 401, 'UNAUTHENTICATED'))).toBe(true)
    expect(isUnauthenticatedError(new ApiRequestError('Sign in to continue', 403, 'FORBIDDEN'))).toBe(false)
  })
})
