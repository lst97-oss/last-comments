import { createFileRoute } from '@tanstack/react-router'

import { getBusinessAuth } from '@/server/auth/business-auth'
import { isBetterAuthEnabled } from '@/server/auth/provider-config'
import { HttpError } from '@/server/http/errors'
import { withContext } from '@/server/http/with-context'
import { selfHostScalarPage } from '@/server/openapi/reference'

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

export const Route = createFileRoute('/api/auth/$')({
  server: {
    handlers: {
      GET: ({ request }) => withContext(() => handleAuth(request))({ request }),
      POST: ({ request }) => withContext(() => handleAuth(request))({ request }),
    },
  },
})
