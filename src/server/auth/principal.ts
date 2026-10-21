import type { ApiKeyScope } from '@/lib/api-key-scopes'

// Provider-neutral identity resolved for every request. Routes and guards
// consume only this shape — never better-auth sessions, OIDC claims, or proxy
// headers directly. Adding a provider means producing a Principal, not
// touching callers.
export type PrincipalCredential =
  | { kind: 'session'; provider: string }
  | { kind: 'service-key'; keyId: string; siteKey: string | null; scopes: ApiKeyScope[] }
  | { kind: 'external'; provider: string; subject: string }

export type Principal = {
  userId: string
  email: string | null
  displayName: string | null
  credential: PrincipalCredential
}

export type SessionPrincipal = Omit<Principal, 'credential'> & {
  credential: Extract<PrincipalCredential, { kind: 'session' } | { kind: 'external' }>
  image?: string | null
}

export type SessionAdapter = {
  name: string
  resolveSession: (request: Request) => Promise<SessionPrincipal | null>
}
