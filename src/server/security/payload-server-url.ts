import type { ServerEnv } from '@/server/env'

const INVALID_LOOPBACK_PRODUCTION_MESSAGE =
  'PAYLOAD_PUBLIC_SERVER_URL cannot be a loopback origin in production. Set it to your public HTTPS origin (e.g. https://example.com). Local dev may use http://localhost:PORT.'

const LOOPBACK_HOSTS = new Set(['localhost', '127.0.0.1', '::1', '0.0.0.0'])

export class PayloadServerUrlError extends Error {
  constructor(message: string, options?: { cause?: unknown }) {
    super(message, options)
    this.name = 'PayloadServerUrlError'
  }
}

export function resolvePayloadServerUrl(env: ServerEnv): string {
  const raw = env.PAYLOAD_PUBLIC_SERVER_URL?.trim()
  if (!raw) {
    throw new PayloadServerUrlError('PAYLOAD_PUBLIC_SERVER_URL is not set')
  }

  let url: URL
  try {
    url = new URL(raw)
  } catch (error) {
    throw new PayloadServerUrlError(
      `PAYLOAD_PUBLIC_SERVER_URL is not a valid absolute URL: ${raw}`,
      error instanceof Error ? { cause: error } : undefined,
    )
  }

  if (env.NODE_ENV === 'production') {
    if (url.hostname === 'localhost' || LOOPBACK_HOSTS.has(url.hostname)) {
      throw new PayloadServerUrlError(INVALID_LOOPBACK_PRODUCTION_MESSAGE)
    }
  }

  return url.origin
}
