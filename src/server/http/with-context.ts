import { toHttpError } from '@/server/http/errors'
import { fail, ok } from '@/server/http/response'
import { getRequestLogger, type Logger } from '@/server/observability/logger'

export type RequestContext = { requestId: string; logger: Logger; startedAt: number }

export type ContextHandler<T = unknown> = (ctx: RequestContext) => Promise<T>

export type StartRouteCtx = { request: Request }

function safeLog(write: () => void): void {
  try {
    write()
  } catch {
    // Logging must never break the request path.
  }
}

function safeErrorFields(error: unknown): Record<string, unknown> {
  if (!(error instanceof Error)) return { errorName: typeof error }
  const fields: Record<string, unknown> = { errorName: error.name }
  if ('code' in error && typeof error.code === 'string' && /^[0-9A-Z]{5}$/.test(error.code)) {
    fields.databaseCode = error.code
  }
  return fields
}

function genericFailureResponse(requestId?: string): Response {
  const headers = new Headers({
    'cache-control': 'no-store',
    'content-type': 'application/json; charset=utf-8',
  })
  if (requestId) headers.set('x-request-id', requestId)
  return new Response(
    JSON.stringify({ error: { code: 'INTERNAL_ERROR', message: 'Something went wrong. Please try again.' } }),
    {
      status: 500,
      headers,
    },
  )
}

export function withContext<T>(
  handler: ContextHandler<T>,
  options?: { logger?: Logger },
): (ctx: StartRouteCtx) => Promise<Response> {
  return async ({ request }: StartRouteCtx): Promise<Response> => {
    let requestId: string
    try {
      const inbound = request.headers.get('x-request-id')
      requestId = inbound && inbound.length > 0 ? inbound : crypto.randomUUID()
    } catch {
      requestId = `fallback-${Date.now()}`
    }

    try {
      const logger = (options?.logger ?? getRequestLogger()).child({ requestId })
      const startedAt = Date.now()

      let path = '/'
      try {
        path = new URL(request.url).pathname
      } catch {}
      safeLog(() => logger.info('request.start', { requestId, method: request.method, path }))

      try {
        const result = await handler({ requestId, logger, startedAt })
        // Handlers that already build a Response (ready: 200|503) pass
        // through — only plain data gets the ok() envelope.
        const response = result instanceof Response ? result : ok(result)
        response.headers.set('x-request-id', requestId)
        safeLog(() =>
          logger.info('request.complete', {
            requestId,
            status: response.status,
            latencyMs: Date.now() - startedAt,
          }),
        )
        return response
      } catch (error) {
        const httpError = toHttpError(error)
        const fields = {
          requestId,
          method: request.method,
          path,
          code: httpError.code,
          status: httpError.status,
          ...(httpError.status >= 500 ? safeErrorFields(error) : {}),
        }
        if (httpError.status >= 500) safeLog(() => logger.error('request.error', fields))
        else safeLog(() => logger.info('request.rejected', fields))
        try {
          const response = fail(httpError)
          response.headers.set('x-request-id', requestId)
          return response
        } catch {
          return genericFailureResponse(requestId)
        }
      }
    } catch {
      return genericFailureResponse(requestId)
    }
  }
}
