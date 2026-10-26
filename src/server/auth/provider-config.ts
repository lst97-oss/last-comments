import { z } from 'zod'

import { getAuthConfig } from '@/server/auth/auth.config'

export type AuthProviderName = 'better-auth' | 'oidc-jwt' | 'header'

export type AuthSelection = {
  providers: AuthProviderName[]
  autoProvision: boolean
  bootstrapEmail: string | undefined
}

export function getAuthSelection(file?: unknown): AuthSelection {
  const config = getAuthConfig({ file })
  return {
    providers: config.providers as AuthProviderName[],
    autoProvision: config.autoProvision,
    bootstrapEmail: config.bootstrapEmail,
  }
}

export function isBetterAuthEnabled(file?: unknown): boolean {
  return getAuthSelection(file).providers.includes('better-auth')
}

// Endpoint identity (JWKS URL, issuer, audience) stays in env — it differs
// per deployment and is secret-adjacent. Claim mapping comes from the file.
const oidcEnvSchema = z.object({
  AUTH_OIDC_JWKS_URL: z.string().url(),
  AUTH_OIDC_ISSUER: z.string().min(1),
  AUTH_OIDC_AUDIENCE: z.string().min(1),
})

export type OidcSettings = {
  AUTH_OIDC_JWKS_URL: string
  AUTH_OIDC_ISSUER: string
  AUTH_OIDC_AUDIENCE: string
  AUTH_OIDC_EMAIL_CLAIM: string
  AUTH_OIDC_CLOCK_SKEW_SECONDS: number
}

function defaultEnv(): Record<string, string | undefined> {
  return typeof Bun !== 'undefined' ? Bun.env : process.env
}

export function getOidcSettings(file?: unknown, env: Record<string, string | undefined> = defaultEnv()): OidcSettings {
  const config = getAuthConfig({ file, env })
  const parsed = oidcEnvSchema.parse({
    AUTH_OIDC_JWKS_URL: env.AUTH_OIDC_JWKS_URL,
    AUTH_OIDC_ISSUER: env.AUTH_OIDC_ISSUER,
    AUTH_OIDC_AUDIENCE: env.AUTH_OIDC_AUDIENCE,
  })
  return {
    ...parsed,
    AUTH_OIDC_EMAIL_CLAIM: config.oidc.emailClaim,
    AUTH_OIDC_CLOCK_SKEW_SECONDS: config.oidc.clockSkewSeconds,
  }
}

export type HeaderProviderSettings = {
  AUTH_TRUST_PROXY: boolean
  AUTH_PROXY_CIDR: string
  AUTH_HEADER_USER: string
  AUTH_HEADER_EMAIL: string
  AUTH_HEADER_NAME: string
  AUTH_LINK_BY_EMAIL: boolean
}

export function getHeaderProviderSettings(file?: unknown): HeaderProviderSettings {
  const config = getAuthConfig({ file })
  return {
    AUTH_TRUST_PROXY: config.header.trustProxy,
    AUTH_PROXY_CIDR: config.header.proxyCidr,
    AUTH_HEADER_USER: config.header.userHeader,
    AUTH_HEADER_EMAIL: config.header.emailHeader,
    AUTH_HEADER_NAME: config.header.nameHeader,
    AUTH_LINK_BY_EMAIL: config.header.linkByEmail,
  }
}
