import { z } from 'zod'

import { definePluginConfig, loadPluginConfig } from '@/server/plugins/plugin-config'

// Instance-wide auth tuning. This file — not `.env` — is the source of truth
// for policy (which providers exist, auto-provisioning, proxy wiring, OIDC
// claim mapping). Secrets and endpoint identity stay in the environment:
// IdP URLs/issuer/audience, Google credentials, and session secrets.
//
// Escape hatch: `AUTH_PROVIDERS` set in the environment overrides the file
// below (per-environment provider sets + the two route tests that toggle it
// at runtime). Every other key is file-canonical; stale env entries are
// simply unread.

const providerNameSchema = z.enum(['better-auth', 'oidc-jwt', 'header'])
export type AuthConfigProviderName = z.infer<typeof providerNameSchema>

export const authFileSchema = z.strictObject({
  providers: providerNameSchema.array().min(1).default(['better-auth']),
  autoProvision: z.boolean().default(true),
  // Restricts instance-admin bootstrap to this address on first login.
  // Empty/absent = any verified first login may claim the slot.
  bootstrapEmail: z
    .string()
    .trim()
    .toLowerCase()
    .max(254)
    .optional()
    .transform((value) => (value && value.length > 0 ? value : undefined)),
  // Reverse-proxy SSO. Only enable behind a proxy you control; requests not
  // arriving from `proxyCidr` are ignored.
  header: z
    .strictObject({
      trustProxy: z.boolean().default(false),
      proxyCidr: z.string().trim().min(1).default('*'),
      userHeader: z.string().trim().min(1).default('x-forwarded-user'),
      emailHeader: z.string().trim().min(1).default('x-forwarded-email'),
      nameHeader: z.string().trim().min(1).default('x-forwarded-name'),
    })
    // Full literal so partial file inputs (`{ providers: [...] }`) still
    // resolve: field defaults alone don't cover a missing object.
    .default({
      trustProxy: false,
      proxyCidr: '*',
      userHeader: 'x-forwarded-user',
      emailHeader: 'x-forwarded-email',
      nameHeader: 'x-forwarded-name',
    }),
  oidc: z
    .strictObject({
      emailClaim: z.string().trim().min(1).default('email'),
      clockSkewSeconds: z.number().int().min(0).max(600).default(60),
    })
    .default({ emailClaim: 'email', clockSkewSeconds: 60 }),
})
export type AuthFileConfig = z.infer<typeof authFileSchema>

function parseProvidersOverride(raw: string | undefined): AuthConfigProviderName[] | undefined {
  if (raw === undefined || raw.trim() === '') return undefined
  const names = raw
    .split(',')
    .map((name) => name.trim().toLowerCase())
    .filter((name) => name.length > 0)
  const parsed = providerNameSchema.array().min(1).safeParse(names)
  if (!parsed.success) throw new Error(`Unknown AUTH_PROVIDERS override: ${raw}`)
  return parsed.data
}

export type ResolvedAuthConfig = {
  providers: AuthConfigProviderName[]
  autoProvision: boolean
  bootstrapEmail: string | undefined
  header: { trustProxy: boolean; proxyCidr: string; userHeader: string; emailHeader: string; nameHeader: string }
  oidc: { emailClaim: string; clockSkewSeconds: number }
}

export const authConfigDef = definePluginConfig({
  id: 'auth',
  fileSchema: authFileSchema,
  defaults: {
    providers: ['better-auth'],
    autoProvision: true,
    bootstrapEmail: undefined,
    header: {
      trustProxy: false,
      proxyCidr: '*',
      userHeader: 'x-forwarded-user',
      emailHeader: 'x-forwarded-email',
      nameHeader: 'x-forwarded-name',
    },
    oidc: { emailClaim: 'email', clockSkewSeconds: 60 },
  } satisfies AuthFileConfig,
  resolve: (file, env): ResolvedAuthConfig => ({
    providers: parseProvidersOverride(env.AUTH_PROVIDERS) ?? [...file.providers],
    autoProvision: file.autoProvision,
    bootstrapEmail: file.bootstrapEmail,
    header: { ...file.header },
    oidc: { ...file.oidc },
  }),
})

export const authConfig: AuthFileConfig = authConfigDef.defaults

export function getAuthConfig(overrides: { file?: unknown; env?: Record<string, string | undefined> } = {}) {
  return loadPluginConfig(authConfigDef, { file: overrides.file ?? authConfig, env: overrides.env })
}
