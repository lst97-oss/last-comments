import { describe, expect, test } from 'bun:test'

import { getBusinessAuth } from '@/server/auth/business-auth'

describe('business auth sign-in', () => {
  test('refuses a password sign-in without a Turnstile token before the password is checked', async () => {
    const response = await getBusinessAuth().handler(
      new Request('http://localhost:3000/api/auth/sign-in/email', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ email: 'admin@example.com', password: 'not-the-password' }),
      }),
    )
    expect(response.status).toBe(400)
    await expect(response.json()).resolves.toMatchObject({ code: 'MISSING_RESPONSE' })
  })
})
