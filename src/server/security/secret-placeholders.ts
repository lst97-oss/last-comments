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
