// Values that shipped as defaults in earlier compose files, or that a copied example leaves behind. A
// production instance must not start with one: the secret is public if the repository is.
const PLACEHOLDER_SECRET = /local-compose-|change-me/i

// Secrets that sign or key the instance need at least this many characters in production.
export const MIN_PRODUCTION_SECRET_LENGTH = 32

export function isPlaceholderSecret(value: string): boolean {
  return PLACEHOLDER_SECRET.test(value)
}

// The reason a production secret is refused, or null when it is acceptable.
export function productionSecretProblem(value: string): string | null {
  if (value.length < MIN_PRODUCTION_SECRET_LENGTH) {
    return `must be at least ${MIN_PRODUCTION_SECRET_LENGTH} characters in production`
  }
  if (isPlaceholderSecret(value)) return 'is a placeholder value and must be replaced in production'
  return null
}

// Cloudflare's published Turnstile testing keys (`1x…AA`, `2x…AB`, `3x…FF` shapes). They pass or fail on any host,
// so a production instance using one has no bot check. Real keys start with `0x4`.
const TURNSTILE_TEST_KEY = /^[123]x0{6,}[A-Z]{2}$/

// The reason a production Turnstile key is refused, or null when it is a real key.
export function productionTurnstileKeyProblem(value: string): string | null {
  return TURNSTILE_TEST_KEY.test(value)
    ? "is one of Cloudflare's Turnstile testing keys; replace it in production"
    : null
}
