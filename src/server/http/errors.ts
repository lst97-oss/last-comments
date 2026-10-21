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
    return new HttpError(503, 'DATABASE_UNAVAILABLE', 'The database is temporarily unavailable. Please try again.', {
      expose: true,
    })
  }
  const message = error instanceof Error ? error.message : 'Unknown error'
  return new HttpError(500, 'INTERNAL_ERROR', message, { expose: false })
}
