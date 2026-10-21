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

// Provider-neutral replacement for authClient.useSession: with the built-in
// provider it wraps the better-auth session; otherwise it probes
// GET /api/session, which resolves through every enabled provider (proxy
// headers arrive on the fetch automatically; OIDC bearer users hold no
// dashboard session, so the probe correctly reports signed-out).
async function fetchSessionPrincipal(): Promise<SessionPrincipalClient | null> {
  const response = await fetch('/api/session', { headers: { accept: 'application/json' } })
  if (!response.ok) return null
  const body = (await response.json()) as { data?: { principal?: SessionPrincipalClient | null } }
  return body.data?.principal ?? null
}

export function useSessionPrincipal(): { principal: SessionPrincipalClient | null; isPending: boolean } {
  const providers = useAuthProviders()
  const betterAuthOn = !providers || providers.includes('better-auth')
  const { data: session, isPending: sessionPending } = authClient.useSession()
  const probe = useQuery({
    queryKey: ['session-principal'],
    queryFn: fetchSessionPrincipal,
    staleTime: 60_000,
    retry: false,
    // The probe only answers for providers that do not own a client session;
    // until the provider list resolves the better-auth branch is in charge.
    enabled: !betterAuthOn,
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
      isPending: sessionPending,
    }
  }
  return { principal: probe.data ?? null, isPending: probe.isPending }
}
