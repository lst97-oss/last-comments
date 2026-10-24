import type { ApiKeyScope } from '@/lib/api-key-scopes'
import { type AccessOperation, anonymousAllowed, type SiteAccess } from '@/lib/site-access'
import type { SessionPrincipal } from '@/server/auth/principal'
import { resolveSessionPrincipal } from '@/server/auth/resolve'
import { HttpError } from '@/server/http/errors'
import { hasServiceKey, requireServiceKey } from '@/server/modules/api-keys/infrastructure/api-key-repository'
import {
  assertSiteOrigin,
  getSiteAccess,
  requireAllowedOrigin,
} from '@/server/modules/comments/infrastructure/comment-repository'

// Set by the host proxy so each visitor gets their own rate-limit budget. It is
// honoured only on a verified key: a browser cannot rotate it to dodge a limit.
const CLIENT_ID_HEADER = 'x-lc-client'
const CLIENT_ID_PATTERN = /^[A-Za-z0-9_-]{16,128}$/

export type CommentCaller = {
  // The signed-in visitor. Null for anonymous visitors and for every key call:
  // a key acts for an anonymous visitor, never as a user.
  principal: SessionPrincipal | null
  // Origin to echo in CORS headers. Key callers are server-to-server: none.
  responseOrigin: string | null
  clientId?: string
  keyId?: string
}

// The rate-limit identifiers a caller contributes. Spread into publishCommentOperation.
export function operationIdentity(caller: CommentCaller): { clientId?: string; keyId?: string } {
  return {
    ...(caller.clientId === undefined ? {} : { clientId: caller.clientId }),
    ...(caller.keyId === undefined ? {} : { keyId: caller.keyId }),
  }
}

export type CallerDeps = {
  hasKey: (request: Request) => boolean
  requireKey: (request: Request, scope: ApiKeyScope, siteKey: string) => Promise<{ id: string }>
  siteAccess: (siteKey: string) => Promise<{ access: SiteAccess; gatewayOnly: boolean } | null>
  assertOrigin: (siteKey: string, origin: string | null) => Promise<string | null>
  requireOrigin: (siteKey: string, origin: string | null) => Promise<string>
  resolveSession: (request: Request) => Promise<SessionPrincipal | null>
}

const defaultCallerDeps: CallerDeps = {
  hasKey: hasServiceKey,
  requireKey: requireServiceKey,
  siteAccess: getSiteAccess,
  assertOrigin: assertSiteOrigin,
  requireOrigin: requireAllowedOrigin,
  resolveSession: resolveSessionPrincipal,
}

// Reads tolerate a missing Origin (browsers omit it on same-origin GET); writes
// never do. Sessions are resolved on writes always and on reads only when a
// cookie is present, as the routes did before this resolver existed.
export async function resolveCommentCaller(
  request: Request,
  siteKey: string,
  operation: AccessOperation,
  deps: CallerDeps = defaultCallerDeps,
): Promise<CommentCaller> {
  if (deps.hasKey(request)) {
    const key = await deps.requireKey(request, operation === 'read' ? 'comments:read' : 'comments:write', siteKey)
    const clientId = request.headers.get(CLIENT_ID_HEADER)?.trim()
    return {
      principal: null,
      responseOrigin: null,
      keyId: key.id,
      ...(clientId && CLIENT_ID_PATTERN.test(clientId) ? { clientId } : {}),
    }
  }

  const site = await deps.siteAccess(siteKey)
  if (site?.gatewayOnly) {
    throw new HttpError(403, 'FORBIDDEN', 'This site accepts comments only through its host')
  }

  const origin = request.headers.get('origin')
  const responseOrigin =
    operation === 'read' ? await deps.assertOrigin(siteKey, origin) : await deps.requireOrigin(siteKey, origin)
  const principal = operation === 'write' || request.headers.get('cookie') ? await deps.resolveSession(request) : null

  if (!principal && !anonymousAllowed(site?.access ?? 'open', operation)) {
    throw new HttpError(
      401,
      'UNAUTHENTICATED',
      operation === 'read' ? 'Sign in to view comments on this site' : 'Sign in to comment on this site',
    )
  }
  return { principal, responseOrigin }
}
