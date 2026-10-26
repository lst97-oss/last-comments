import { resolveBetterAuthSession } from '@/server/auth/business-auth'
import { resolveHeaderSession } from '@/server/auth/header-provider'
import { resolveOidcSession } from '@/server/auth/oidc-jwt'
import type { Principal, SessionAdapter, SessionPrincipal } from '@/server/auth/principal'
import { getAuthSelection } from '@/server/auth/provider-config'

export type { Principal, SessionPrincipal }

// Chain order follows AUTH_PROVIDERS (default ["better-auth"]): first
// non-null session wins. Unknown names are ignored so a typo degrades to
// the remaining providers instead of locking everyone out.
const adapters: Record<string, SessionAdapter> = {
  'better-auth': { name: 'better-auth', resolveSession: (request) => resolveBetterAuthSession(request) },
  'oidc-jwt': { name: 'oidc-jwt', resolveSession: (request) => resolveOidcSession(request) },
  header: { name: 'header', resolveSession: (request) => resolveHeaderSession(request) },
}

export function getSessionAdapters(authFile?: unknown): SessionAdapter[] {
  const { providers } = getAuthSelection(authFile)
  return providers.map((name) => adapters[name]).filter((adapter): adapter is SessionAdapter => Boolean(adapter))
}

export async function resolveSessionPrincipal(request: Request): Promise<SessionPrincipal | null> {
  for (const adapter of getSessionAdapters()) {
    const principal = await adapter.resolveSession(request)
    if (principal) return principal
  }
  return null
}
