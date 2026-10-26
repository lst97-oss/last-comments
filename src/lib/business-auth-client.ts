'use client'

import { apiKeyClient } from '@better-auth/api-key/client'
import { useQuery } from '@tanstack/react-query'
import { createAuthClient } from 'better-auth/react'

export const authClient = createAuthClient({
  plugins: [apiKeyClient()],
})

export async function signOut(): Promise<void> {
  const providers = await getAuthProviders()
  if (providers.includes('better-auth')) {
    await authClient.signOut()
  }
  // External providers own their sessions (IdP, proxy) — there is nothing
  // app-side to clear, so every path ends with a reload.
  window.location.href = '/'
}

export type AuthProviderName = 'better-auth' | 'oidc-jwt' | 'header'

// Which interactive-login providers the server has enabled (AUTH_PROVIDERS).
// Public data.
export function getAuthProviders(): Promise<AuthProviderName[]> {
  return fetch('/api/auth-providers', { headers: { accept: 'application/json' } })
    .then(async (response) => {
      if (!response.ok) return ['better-auth'] as AuthProviderName[]
      const body = (await response.json()) as { data?: { providers?: unknown } }
      const providers = body.data?.providers
      if (!Array.isArray(providers) || providers.length === 0) return ['better-auth'] as AuthProviderName[]
      return providers.filter(
        (name): name is AuthProviderName => name === 'better-auth' || name === 'oidc-jwt' || name === 'header',
      )
    })
    .catch(() => ['better-auth'] as AuthProviderName[])
}

export function useAuthProviders(): AuthProviderName[] | null {
  const providers = useQuery({
    queryKey: ['auth-providers'],
    queryFn: getAuthProviders,
    staleTime: Infinity,
    gcTime: Infinity,
    retry: false,
  })
  return providers.data ?? null
}

export type SessionPrincipalClient = {
  userId: string
  email: string | null
  displayName: string | null
  provider: AuthProviderName
}

// The server's answer to GET /api/session: who is signed in, and whether that identity may use the
// dashboard. Only admins may (the instance admin, or an admin of a site).
type SessionState = { principal: SessionPrincipalClient | null; dashboard: boolean }

// Provider-neutral replacement for authClient.useSession. GET /api/session resolves through every enabled
// provider (proxy headers arrive on the fetch automatically; OIDC bearer users hold no dashboard session,
// so the probe correctly reports signed-out). A failed probe fails closed: no principal, no dashboard.
async function fetchSessionState(): Promise<SessionState> {
  const response = await fetch('/api/session', { headers: { accept: 'application/json' } })
  if (!response.ok) return { principal: null, dashboard: false }
  const body = (await response.json()) as {
    data?: { principal?: SessionPrincipalClient | null; dashboard?: boolean }
  }
  return { principal: body.data?.principal ?? null, dashboard: body.data?.dashboard === true }
}

export function useSessionPrincipal(): {
  principal: SessionPrincipalClient | null
  dashboard: boolean
  isPending: boolean
} {
  const providers = useAuthProviders()
  const betterAuthOn = !providers || providers.includes('better-auth')
  const { data: session, isPending: sessionPending } = authClient.useSession()
  // Every signed-in identity is probed, including the better-auth one: only the server knows whether that
  // account administers a site. Other providers have no client session, so they are probed unconditionally.
  // Until the provider list resolves, the better-auth branch is in charge.
  const probe = useQuery({
    queryKey: ['session-state', session?.user.id ?? null],
    queryFn: fetchSessionState,
    staleTime: 60_000,
    retry: false,
    enabled: !betterAuthOn || Boolean(session),
  })
  if (betterAuthOn) {
    return {
      principal: session
        ? {
            userId: session.user.id,
            email: session.user.email,
            displayName: session.user.name,
            provider: 'better-auth' as const,
          }
        : null,
      dashboard: session ? probe.data?.dashboard === true : false,
      isPending: sessionPending || (Boolean(session) && probe.isPending),
    }
  }
  return {
    principal: probe.data?.principal ?? null,
    dashboard: probe.data?.dashboard === true,
    isPending: probe.isPending,
  }
}
