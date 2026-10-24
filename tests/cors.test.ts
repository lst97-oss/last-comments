import { describe, expect, test } from 'bun:test'

import { applyCors } from '@/server/http/cors'

describe('applyCors', () => {
  test('echoes the validated origin and allows credentials, never a wildcard', () => {
    const response = applyCors(new Response(null), 'https://www.lst97.dev', 'GET, POST, OPTIONS')

    expect(response.headers.get('access-control-allow-origin')).toBe('https://www.lst97.dev')
    expect(response.headers.get('access-control-allow-credentials')).toBe('true')
    expect(response.headers.get('access-control-allow-methods')).toBe('GET, POST, OPTIONS')
    expect(response.headers.get('access-control-allow-headers')).toBe('content-type')
    expect(response.headers.get('vary')).toBe('Origin')
  })

  test('sends no CORS headers when the origin is not allowed', () => {
    const response = applyCors(new Response(null), null, 'GET, POST, OPTIONS')

    expect(response.headers.get('access-control-allow-origin')).toBeNull()
    expect(response.headers.get('access-control-allow-credentials')).toBeNull()
  })
})
