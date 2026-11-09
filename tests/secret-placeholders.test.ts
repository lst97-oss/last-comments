import { describe, expect, test } from 'bun:test'

import { parseServerEnv } from '@/server/env'
import {
  isPlaceholderSecret,
  productionSecretProblem,
  productionTurnstileKeyProblem,
} from '@/server/security/secret-placeholders'

const strong = 'k7Qp2mZ9xR4vT8wL1nB6cY3hJ5sD0fGq8'
const turnstileTestSecret = '1x0000000000000000000000000000000AA'
const turnstileRealSecret = '0x4AAAAAAAAbCdEfGhIjKlMn'

describe('placeholder secrets', () => {
  test('flags the shipped compose literals and copied change-me values', () => {
    expect(isPlaceholderSecret('local-compose-payload-secret-change-me-32-chars')).toBe(true)
    expect(isPlaceholderSecret('please-change-me-to-something-random-1234')).toBe(true)
    expect(isPlaceholderSecret(strong)).toBe(false)
  })

  test('production needs 32+ characters and a non-placeholder value', () => {
    expect(productionSecretProblem('short')).toContain('at least 32')
    expect(productionSecretProblem('local-compose-' + 'x'.repeat(40))).toContain('placeholder')
    expect(productionSecretProblem(strong)).toBeNull()
  })

  test('production refuses Cloudflare Turnstile testing keys and accepts real ones', () => {
    expect(productionTurnstileKeyProblem('1x00000000000000000000AA')).toContain('testing key')
    expect(productionTurnstileKeyProblem(turnstileTestSecret)).toContain('testing key')
    expect(productionTurnstileKeyProblem('3x00000000000000000000FF')).toContain('testing key')
    expect(productionTurnstileKeyProblem(turnstileRealSecret)).toBeNull()
  })

  test('the env parser refuses a Turnstile testing key in production only', () => {
    const base = {
      DATABASE_URL: 'postgres://user:pass@127.0.0.1:5432/app',
      PAYLOAD_PUBLIC_SERVER_URL: 'https://comments.example',
      PAYLOAD_SECRET: strong,
    }
    expect(() =>
      parseServerEnv({ ...base, NODE_ENV: 'production', TURNSTILE_SECRET_KEY: turnstileTestSecret }),
    ).toThrow(/TURNSTILE_SECRET_KEY/)
    expect(
      parseServerEnv({ ...base, NODE_ENV: 'production', TURNSTILE_SECRET_KEY: turnstileRealSecret })
        .TURNSTILE_SECRET_KEY,
    ).toBe(turnstileRealSecret)
    expect(
      parseServerEnv({ ...base, NODE_ENV: 'development', TURNSTILE_SECRET_KEY: turnstileTestSecret }).NODE_ENV,
    ).toBe('development')
  })

  test('the env parser refuses a placeholder PAYLOAD_SECRET in production only', () => {
    const base = {
      DATABASE_URL: 'postgres://user:pass@127.0.0.1:5432/app',
      PAYLOAD_PUBLIC_SERVER_URL: 'https://comments.example',
    }
    expect(() =>
      parseServerEnv({
        ...base,
        NODE_ENV: 'production',
        PAYLOAD_SECRET: 'local-compose-payload-secret-change-me-32-chars',
      }),
    ).toThrow()
    expect(parseServerEnv({ ...base, NODE_ENV: 'production', PAYLOAD_SECRET: strong }).PAYLOAD_SECRET).toBe(strong)
    expect(
      parseServerEnv({
        ...base,
        NODE_ENV: 'development',
        PAYLOAD_SECRET: 'local-compose-payload-secret-change-me-32-chars',
      }).NODE_ENV,
    ).toBe('development')
  })
})
