import { z } from 'zod'

import { definePluginConfig, loadPluginConfig, secretFromEnv } from '@/server/plugins/plugin-config'

// Turnstile policy; the secret stays in TURNSTILE_SECRET_KEY.

export const turnstileFileSchema = z.strictObject({
  verificationRequired: z.boolean().default(true),
  siteKey: z
    .string()
    .trim()
    .max(500)
    .optional()
    .transform((value) => (value && value.length > 0 ? value : undefined)),
  secretKey: z
    .custom<unknown>((value) => value === undefined || typeof value === 'string' || typeof value === 'object')
    .optional(),
})
export type TurnstileFileConfig = z.infer<typeof turnstileFileSchema>

export type ResolvedTurnstileConfig = {
  secretKey: string | undefined
  verificationRequired: boolean
  siteKey: string | undefined
}

function readSecret(value: unknown, env: Record<string, string | undefined>): string | undefined {
  const raw = typeof value === 'string' ? value : env.TURNSTILE_SECRET_KEY
  return typeof raw === 'string' && raw.trim() !== '' ? raw : undefined
}

function readSiteKey(file: string | undefined, env: Record<string, string | undefined>): string | undefined {
  if (file) return file
  const raw = env.TURNSTILE_SITE_KEY?.trim()
  return raw ? raw : undefined
}

export const turnstileConfigDef = definePluginConfig({
  id: 'turnstile',
  fileSchema: turnstileFileSchema,
  defaults: {
    verificationRequired: true,
    siteKey: undefined,
    secretKey: secretFromEnv('TURNSTILE_SECRET_KEY'),
  } satisfies TurnstileFileConfig,
  resolve: (file, env): ResolvedTurnstileConfig => ({
    secretKey: readSecret(file.secretKey, env),
    verificationRequired: file.verificationRequired,
    siteKey: readSiteKey(file.siteKey, env),
  }),
})

// Set `verificationRequired: false` only for local guest posting without tokens.
export const turnstileConfig: TurnstileFileConfig = turnstileConfigDef.defaults

export function getTurnstilePluginSettings(
  overrides: { file?: unknown; env?: Record<string, string | undefined> } = {},
) {
  return loadPluginConfig(turnstileConfigDef, { file: overrides.file ?? turnstileConfig, env: overrides.env })
}
