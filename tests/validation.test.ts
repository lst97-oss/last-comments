import { describe, expect, test } from 'bun:test'
import { z } from 'zod'

import { HttpError } from '@/server/http/errors'
import { parseJsonBody, parseSearchParams, parseWith } from '@/server/http/validation'

const schema = z.object({ name: z.string().min(1), age: z.number().int().nonnegative() })

describe('parseWith', () => {
  test('returns the parsed value for valid input', () => {
    expect(parseWith(schema, { name: 'ada', age: 36 })).toEqual({ name: 'ada', age: 36 })
  })

  test('throws 400 VALIDATION_ERROR with path-qualified messages', () => {
    try {
      parseWith(schema, { name: '', age: -1 })
      throw new Error('did not throw')
    } catch (error) {
      expect(error).toBeInstanceOf(HttpError)
      const http = error as HttpError
      expect(http.status).toBe(400)
      expect(http.code).toBe('VALIDATION_ERROR')
      expect(http.expose).toBe(true)
      expect(http.message).toContain('name:')
      expect(http.message).toContain('age:')
    }
  })

  test('missing fields name the absent path', () => {
    try {
      parseWith(schema, {})
      throw new Error('did not throw')
    } catch (error) {
      expect((error as HttpError).status).toBe(400)
      expect((error as HttpError).message).toContain('name:')
    }
  })
})

describe('parseJsonBody', () => {
  test('parses a valid JSON body', async () => {
    const req = new Request('http://localhost/api/x', {
      method: 'POST',
      body: JSON.stringify({ name: 'ada', age: 36 }),
      headers: { 'content-type': 'application/json' },
    })
    expect(await parseJsonBody(req, schema)).toEqual({ name: 'ada', age: 36 })
  })

  test('malformed JSON is 400 MALFORMED_JSON', async () => {
    const req = new Request('http://localhost/api/x', {
      method: 'POST',
      body: 'not-json{',
      headers: { 'content-type': 'application/json' },
    })
    try {
      await parseJsonBody(req, schema)
      throw new Error('did not throw')
    } catch (error) {
      expect(error).toBeInstanceOf(HttpError)
      expect((error as HttpError).status).toBe(400)
      expect((error as HttpError).code).toBe('MALFORMED_JSON')
    }
  })

  test('schema failure is 400 VALIDATION_ERROR', async () => {
    const req = new Request('http://localhost/api/x', {
      method: 'POST',
      body: JSON.stringify({ name: '' }),
      headers: { 'content-type': 'application/json' },
    })
    try {
      await parseJsonBody(req, schema)
      throw new Error('did not throw')
    } catch (error) {
      expect((error as HttpError).code).toBe('VALIDATION_ERROR')
    }
  })

  test('rejects non-JSON media types', async () => {
    const req = new Request('http://localhost/api/x', {
      method: 'POST',
      body: '{}',
      headers: { 'content-type': 'text/plain' },
    })
    await expect(parseJsonBody(req, schema)).rejects.toMatchObject({ status: 415, code: 'UNSUPPORTED_MEDIA_TYPE' })
  })

  test('rejects bodies over 128 KiB without trusting Content-Length', async () => {
    const req = new Request('http://localhost/api/x', {
      method: 'POST',
      body: JSON.stringify({ name: 'a'.repeat(128 * 1024), age: 1 }),
      headers: { 'content-type': 'application/json' },
    })
    await expect(parseJsonBody(req, schema)).rejects.toMatchObject({ status: 413, code: 'BODY_TOO_LARGE' })
  })
})

describe('parseSearchParams', () => {
  const paging = z.object({ page: z.coerce.number().int().min(1).default(1), q: z.string().optional() })

  test('coerces query strings to typed values', () => {
    expect(parseSearchParams('http://localhost/api/x?page=3&q=hi', paging)).toEqual({ page: 3, q: 'hi' })
  })

  test('defaults apply when params are absent', () => {
    expect(parseSearchParams('http://localhost/api/x', paging)).toEqual({ page: 1 })
  })

  test('invalid values are 400 VALIDATION_ERROR', () => {
    try {
      parseSearchParams('http://localhost/api/x?page=zero', paging)
      throw new Error('did not throw')
    } catch (error) {
      expect((error as HttpError).status).toBe(400)
      expect((error as HttpError).code).toBe('VALIDATION_ERROR')
    }
  })

  test('duplicate query parameters are rejected', () => {
    expect(() => parseSearchParams('http://localhost/api/x?page=2&page=3', paging)).toThrow(
      expect.objectContaining({ status: 400, code: 'VALIDATION_ERROR' }),
    )
  })
})
