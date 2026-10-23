import { createFileRoute } from '@tanstack/react-router'

import { getBusinessAuth, isRegisteredAuthOrigin } from '@/server/auth/business-auth'
import { isBetterAuthEnabled } from '@/server/auth/provider-config'
import { applyCors } from '@/server/http/cors'
import { HttpError } from '@/server/http/errors'
import { withContext } from '@/server/http/with-context'
import { selfHostScalarPage } from '@/server/openapi/reference'

const AUTH_METHODS = 'GET, POST, OPTIONS'

// Better Auth's open-api plugin renders its reference page with the Scalar
// CDN script; the response is rewritten to the self-hosted bundle.
async function handleAuth(request: Request): Promise<Response> {
  if (!isBetterAuthEnabled()) {
    throw new HttpError(
      404,
      'AUTH_PROVIDER_DISABLED',
      'The built-in login endpoints are disabled (AUTH_PROVIDERS does not include better-auth). Sign in via the configured identity provider instead.',
    )
  }
  return selfHostScalarPage(await getBusinessAuth().handler(request))
}

// Only a registered site origin may read an auth response with the session
// cookie. Anything else gets no CORS headers, and the browser blocks the read.
async function allowedOrigin(request: Request): Promise<string | null> {
  const origin = request.headers.get('origin')
  if (!origin) return null
  return (await isRegisteredAuthOrigin(origin)) ? origin : null
}

// Rebuilds the response before adding headers: some handler responses (redirects)
// are immutable, and the Set-Cookie headers must survive the copy.
function withCors(response: Response, origin: string | null): Response {
  const copy = new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers: new Headers(response.headers),
  })
  return applyCors(copy, origin, AUTH_METHODS)
}

// CORS wraps withContext rather than sitting inside it, so error responses
// (for example `Invalid callbackURL`) carry the headers too and the widget can
// show the server's message.
async function respondWithCors(request: Request, respond: () => Promise<Response>): Promise<Response> {
  return withCors(await respond(), await allowedOrigin(request))
}

export const Route = createFileRoute('/api/auth/$')({
  server: {
    handlers: {
      GET: ({ request }) => respondWithCors(request, () => withContext(() => handleAuth(request))({ request })),
      POST: ({ request }) => respondWithCors(request, () => withContext(() => handleAuth(request))({ request })),
      OPTIONS: async ({ request }) => withCors(new Response(null, { status: 204 }), await allowedOrigin(request)),
    },
  },
})
