const INTERNAL_ERROR_MESSAGE = 'Something went wrong. Please try again.'

export class ApiRequestError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly code: string,
    readonly requestId?: string,
  ) {
    super(message)
    this.name = 'ApiRequestError'
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function fallbackMessage(status: number): string {
  if (status === 401) return 'Sign in to continue.'
  if (status === 403) return 'You do not have permission to do that.'
  if (status === 404) return 'The requested resource was not found.'
  if (status === 409) return 'This change conflicts with the current state. Refresh and try again.'
  if (status === 413) return 'The request is too large.'
  if (status === 415) return 'The request format is not supported.'
  if (status === 429) return 'Too many requests. Please try again shortly.'
  if (status === 503) return 'The service is temporarily unavailable. Please try again.'
  return status >= 500 ? INTERNAL_ERROR_MESSAGE : 'Request failed. Please check the information and try again.'
}

export async function readApiData<T>(response: Response): Promise<T> {
  let payload: unknown
  try {
    payload = await response.json()
  } catch {
    payload = undefined
  }

  const requestId = response.headers.get('x-request-id') ?? undefined
  if (!response.ok) {
    const error = isRecord(payload) && isRecord(payload.error) ? payload.error : undefined
    const code = typeof error?.code === 'string' ? error.code : response.status >= 500 ? 'INTERNAL_ERROR' : 'HTTP_ERROR'
    const canUseServerMessage = response.status < 500 || response.status === 503
    const message =
      canUseServerMessage && typeof error?.message === 'string' ? error.message : fallbackMessage(response.status)
    throw new ApiRequestError(message, response.status, code, requestId)
  }

  if (isRecord(payload) && Object.hasOwn(payload, 'data')) return payload.data as T
  throw new ApiRequestError(
    'The server returned an invalid response. Please try again.',
    response.status,
    'INVALID_RESPONSE',
    requestId,
  )
}

export function isUnauthenticatedError(error: unknown): error is ApiRequestError {
  return error instanceof ApiRequestError && (error.status === 401 || error.code === 'UNAUTHENTICATED')
}

export function describeApiError(cause: unknown, fallbackMessage: string) {
  const request = cause instanceof ApiRequestError ? cause : null
  return {
    message: request?.message ?? (cause instanceof Error ? cause.message : fallbackMessage),
    needsSignIn: isUnauthenticatedError(cause),
    forbidden: request?.status === 403,
    requestId: request && request.status >= 500 ? (request.requestId ?? '') : '',
  }
}
