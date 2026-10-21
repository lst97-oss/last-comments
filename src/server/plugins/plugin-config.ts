import type { z } from 'zod'

// A config leaf that must resolve from the environment. The TS file carries
// the marker, never the secret itself.
export type SecretRef = { readonly brand: 'plugin-config-secret'; envVar: string }

export function secretFromEnv(envVar: string): SecretRef {
  return { brand: 'plugin-config-secret', envVar }
}

export function isSecretRef(value: unknown): value is SecretRef {
  return (
    typeof value === 'object' &&
    value !== null &&
    (value as { brand?: unknown }).brand === 'plugin-config-secret' &&
    typeof (value as { envVar?: unknown }).envVar === 'string'
  )
}

export type PluginConfigDef<TFile, TResolved> = {
  id: string
  fileSchema: z.ZodType<TFile>
  defaults: TFile
  resolve: (file: TFile, env: Record<string, string | undefined>) => TResolved
}

export function definePluginConfig<TFile, TResolved>(
  def: PluginConfigDef<TFile, TResolved>,
): PluginConfigDef<TFile, TResolved> {
  return def
}

function defaultEnv(): Record<string, string | undefined> {
  // Dual-runtime: the Payload Node CLI graph has no Bun global.
  const source =
    typeof Bun !== 'undefined'
      ? (Bun.env as Record<string, string | undefined>)
      : (process.env as Record<string, string | undefined>)
  return source
}

export function loadPluginConfig<TFile, TResolved>(
  def: PluginConfigDef<TFile, TResolved>,
  overrides: { file?: unknown; env?: Record<string, string | undefined> } = {},
): TResolved {
  const file = def.fileSchema.parse(overrides.file ?? def.defaults)
  return def.resolve(file, overrides.env ?? defaultEnv())
}
