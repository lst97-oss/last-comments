import { defineMessageCodes, HttpStatus } from '@lst97-oss/last-httprism'

// Table messages are defaults for readers of ErrorCode; HTTP responses keep the
// per-callsite message passed to HttpError.
export const ErrorCode = defineMessageCodes({
  ADMIN_SIGNUP_FAILED: { status: HttpStatus.BAD_REQUEST.code, message: 'Could not create the initial admin account.' },
  API_KEY_NOT_FOUND: { status: HttpStatus.NOT_FOUND.code, message: 'API key was not found.' },
  AUTHOR_NAME_REQUIRED: {
    status: HttpStatus.BAD_REQUEST.code,
    message: 'A display name is required for guest comments.',
  },
  AUTH_PROVIDER_DISABLED: { status: HttpStatus.NOT_FOUND.code, message: 'The built-in login endpoints are disabled.' },
  BODY_TOO_LARGE: { status: HttpStatus.CONTENT_TOO_LARGE.code, message: 'Request body exceeds the configured limit.' },
  COMMENT_NOT_FOUND: { status: HttpStatus.NOT_FOUND.code, message: 'Comment was not found.' },
  COMMENT_PLUGIN_UNAVAILABLE: {
    status: HttpStatus.SERVICE_UNAVAILABLE.code,
    message: 'Comment operations are temporarily unavailable.',
  },
  COMMENT_TOO_LONG: {
    status: HttpStatus.BAD_REQUEST.code,
    message: 'Comments on this site are limited to the configured maximum length.',
  },
  COMMENT_VERIFICATION_FAILED: { status: HttpStatus.FORBIDDEN.code, message: 'Comment verification failed.' },
  COMMENT_VERIFICATION_UNAVAILABLE: {
    status: HttpStatus.SERVICE_UNAVAILABLE.code,
    message: 'Comment verification is temporarily unavailable.',
  },
  DATABASE_UNAVAILABLE: {
    status: HttpStatus.SERVICE_UNAVAILABLE.code,
    message: 'The database is temporarily unavailable. Please try again.',
  },
  EDIT_WINDOW_EXPIRED: { status: HttpStatus.FORBIDDEN.code, message: 'The edit window for this comment has expired.' },
  FEATURE_DISABLED: { status: HttpStatus.FORBIDDEN.code, message: 'This feature is disabled for this site.' },
  INVALID_API_KEY: { status: HttpStatus.UNAUTHORIZED.code, message: 'API key is invalid, revoked, or expired.' },
  INVALID_PAGE_KEY: {
    status: HttpStatus.BAD_REQUEST.code,
    message: 'Page key must be a lowercase slug like this-is-test.',
  },
  INVALID_PAGE_URL: { status: HttpStatus.BAD_REQUEST.code, message: 'Page URL must be an absolute HTTP URL.' },
  INVALID_SCOPE_SET: { status: HttpStatus.BAD_REQUEST.code, message: 'Scope set is not valid for this key type.' },
  MALFORMED_JSON: { status: HttpStatus.BAD_REQUEST.code, message: 'Request body is not valid JSON.' },
  NOTHING_TO_UPDATE: { status: HttpStatus.BAD_REQUEST.code, message: 'Pass scopes and/or enabled.' },
  OG_RENDER_BUSY: { status: HttpStatus.SERVICE_UNAVAILABLE.code, message: 'Image rendering is busy, retry shortly.' },
  OPENAPI_DISABLED: { status: HttpStatus.NOT_FOUND.code, message: 'OpenAPI docs are disabled.' },
  PAGE_KEY_MISMATCH: { status: HttpStatus.CONFLICT.code, message: 'This page key belongs to a different thread.' },
  PAGE_LOCKED: { status: HttpStatus.CONFLICT.code, message: 'Comments are disabled for this page.' },
  PAGE_NOT_FOUND: { status: HttpStatus.NOT_FOUND.code, message: 'Page was not found.' },
  PAGE_ORIGIN_NOT_ALLOWED: {
    status: HttpStatus.BAD_REQUEST.code,
    message: 'Page URL must use an allowed site origin.',
  },
  PAGE_UNAVAILABLE: { status: HttpStatus.INTERNAL_SERVER_ERROR.code, message: 'Page is unavailable.' },
  PARENT_NOT_FOUND: { status: HttpStatus.NOT_FOUND.code, message: 'Reply target was not found.' },
  RATE_LIMITED: { status: HttpStatus.TOO_MANY_REQUESTS.code, message: 'Too many comment operations.' },
  RATE_LIMIT_UNAVAILABLE: {
    status: HttpStatus.SERVICE_UNAVAILABLE.code,
    message: 'Comment operations are temporarily unavailable.',
  },
  SETUP_UNAVAILABLE: { status: HttpStatus.CONFLICT.code, message: 'Initial admin setup has already been used.' },
  SITE_KEY_EXISTS: { status: HttpStatus.CONFLICT.code, message: 'A site with this key already exists.' },
  SITE_NOT_FOUND: { status: HttpStatus.NOT_FOUND.code, message: 'Site was not found.' },
  UNAUTHENTICATED: { status: HttpStatus.UNAUTHORIZED.code, message: 'Authentication is required.' },
  USER_BLOCKED: { status: HttpStatus.FORBIDDEN.code, message: 'You are blocked from commenting on this site.' },
  VALIDATION_ERROR: { status: HttpStatus.BAD_REQUEST.code, message: 'Request validation failed.' },
})

export class HttpError extends Error {
  status: number
  code: string
  expose: boolean
  headers: HeadersInit | undefined

  constructor(status: number, code: string, message: string, options?: { expose?: boolean; headers?: HeadersInit }) {
    super(message)
    this.status = status
    this.code = code
    this.expose = options?.expose ?? status < 500
    this.headers = options?.headers
  }
}

const databaseUnavailableCodes = new Set([
  '08000',
  '08001',
  '08003',
  '08004',
  '08006',
  '08007',
  '57P01',
  '57P02',
  '57P03',
  '53300',
])

function getDatabaseErrorCode(error: unknown): string | undefined {
  if (typeof error !== 'object' || error === null || !('code' in error)) return
  const code = error.code
  return typeof code === 'string' ? code : undefined
}

export function toHttpError(error: unknown): HttpError {
  if (error instanceof HttpError) return error
  if (databaseUnavailableCodes.has(getDatabaseErrorCode(error) ?? '')) {
    return new HttpError(
      ErrorCode.DATABASE_UNAVAILABLE.status,
      ErrorCode.DATABASE_UNAVAILABLE.code,
      'The database is temporarily unavailable. Please try again.',
      { expose: true },
    )
  }
  const message = error instanceof Error ? error.message : 'Unknown error'
  return new HttpError(ErrorCode.INTERNAL_ERROR.status, ErrorCode.INTERNAL_ERROR.code, message, { expose: false })
}
