import type { ApiKeyScope } from '@/lib/api-key-scopes'
import { type AccessOperation, anonymousAllowed, type SiteAccess } from '@/lib/site-access'
import type { SessionPrincipal } from '@/server/auth/principal'
import { resolveSessionPrincipal } from '@/server/auth/resolve'
import { ErrorCode, HttpError } from '@/server/http/errors'
import { hasServiceKey, requireServiceKey } from '@/server/modules/api-keys/infrastructure/api-key-repository'
import { getSiteContext } from '@/server/modules/comments/infrastructure/comment-sites'

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

// What the caller needs from the site, from one read. `originRegistered` is only meaningful
// when a browser sent an Origin; the caller decides what a missing or unknown site means.
export type CallerSiteContext = { access: SiteAccess; gatewayOnly: boolean; originRegistered: boolean }

export type CallerDeps = {
  hasKey: (request: Request) => boolean
  requireKey: (request: Request, scope: ApiKeyScope, siteKey: string) => Promise<{ id: string }>
  siteContext: (siteKey: string, origin: string | null) => Promise<CallerSiteContext | null>
  resolveSession: (request: Request) => Promise<SessionPrincipal | null>
}

const defaultCallerDeps: CallerDeps = {
  hasKey: hasServiceKey,
  requireKey: requireServiceKey,
  siteContext: getSiteContext,
  resolveSession: resolveSessionPrincipal,
}

// The browser's Origin, normalized. Absent is null; a value that is not an origin is refused.
function requestOrigin(value: string | null): string | null {
  if (!value) return null
  try {
    return new URL(value).origin
  } catch {
    throw new HttpError(ErrorCode.ORIGIN_NOT_ALLOWED.status, ErrorCode.ORIGIN_NOT_ALLOWED.code, 'Origin is not allowed')
  }
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

  const origin = requestOrigin(request.headers.get('origin'))
  const site = await deps.siteContext(siteKey, origin)
  if (site?.gatewayOnly) {
    throw new HttpError(
      ErrorCode.FORBIDDEN.status,
      ErrorCode.FORBIDDEN.code,
      'This site accepts comments only through its host',
    )
  }
  if ((operation === 'write' && origin === null) || (origin !== null && !site?.originRegistered)) {
    throw new HttpError(ErrorCode.ORIGIN_NOT_ALLOWED.status, ErrorCode.ORIGIN_NOT_ALLOWED.code, 'Origin is not allowed')
  }

  const principal = operation === 'write' || request.headers.get('cookie') ? await deps.resolveSession(request) : null

  if (!principal && !anonymousAllowed(site?.access ?? 'open', operation)) {
    throw new HttpError(
      ErrorCode.UNAUTHENTICATED.status,
      ErrorCode.UNAUTHENTICATED.code,
      operation === 'read' ? 'Sign in to view comments on this site' : 'Sign in to comment on this site',
    )
  }
  return { principal, responseOrigin: origin }
}
