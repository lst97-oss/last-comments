import { z } from 'zod'

import { isSecretRef, type SecretRef } from '@/server/plugins/plugin-config'

// Canonical decider schemas for the filter plugin. These two enums are the
// universe of what the OpenRouter decider may score; `filter.config.ts`
// selects the enabled subset (any subset, including empty per modality).
// Adding a schema = one enum entry + one description row + tests — config
// accepts it automatically.

export const textCategorySchema = z.enum([
  'spam_scam',
  'harassment_hate',
  'sexual_explicit',
  'violence_threat',
  'self_harm',
  'illicit_pii',
  'link_abuse',
  'low_quality',
])
export type TextCategory = z.infer<typeof textCategorySchema>
export const ALL_TEXT_CATEGORIES: readonly TextCategory[] = textCategorySchema.options

export const imageCategorySchema = z.enum([
  'sexual_explicit',
  'graphic_violence_gore',
  'hate_symbol',
  'harassment_bullying',
  'spam_scam_image',
  'self_harm_image',
  'illegal_activity',
  'benign',
])
export type ImageCategory = z.infer<typeof imageCategorySchema>
export const ALL_IMAGE_CATEGORIES: readonly ImageCategory[] = imageCategorySchema.options

export const TEXT_SCHEMA_DESCRIPTIONS: Record<TextCategory, string> = {
  spam_scam: 'bulk, link-farm, crypto/giveaway, SEO junk, or unsolicited promotion',
  harassment_hate: 'insult, threat, slur, protected-class hate, or abuse adjacent to doxxing',
  sexual_explicit: 'pornographic detail, solicitation, or minor-safety content (always hide)',
  violence_threat: 'credible threat of violence or instructions facilitating wrongdoing',
  self_harm: 'encouragement or instructions for self-harm (hide; never repeat the method)',
  illicit_pii: 'doxxing, credentials, private contact details, or payment secrets',
  link_abuse: 'misleading URLs, phishing lures, or redirect chains in markdown links',
  low_quality:
    'gibberish, test spam ("asdf"), copy-paste flood, or a flood of repeated emoji (a brief reply with one or a few emoji is normal)',
}

export const IMAGE_SCHEMA_DESCRIPTIONS: Record<ImageCategory, string> = {
  sexual_explicit: 'pornographic or sexually explicit imagery (always hide)',
  graphic_violence_gore: 'graphic violence, gore, or injury imagery',
  hate_symbol: 'hate symbols, extremist flags, or supremacist iconography',
  harassment_bullying: 'memes or edits targeting a person for bullying',
  spam_scam_image: 'QR-to-scam codes, fake captchas, or ad overlays',
  self_harm_image: 'imagery depicting or encouraging self-harm',
  illegal_activity: 'imagery depicting criminal activity',
  benign: 'ordinary screenshots, avatars, diagrams, or product photos (informational only)',
}

// The file-level config shape. `schemas.text/image` accept the literal
// `'all'` (default) or an explicit subset; `[]` disables that modality.
// Secrets are markers here — resolved from env by `filter.config.ts`.
const schemaSetSchema = <T extends string>(options: readonly T[]) =>
  z.union([z.literal('all'), z.array(z.enum(options as unknown as [T, ...T[]]))])

export const filterFileSchema = z.strictObject({
  enabled: z.boolean(),
  engines: z.strictObject({ badwords: z.boolean(), llm: z.boolean() }),
  schemas: z.strictObject({
    text: schemaSetSchema(ALL_TEXT_CATEGORIES),
    image: schemaSetSchema(ALL_IMAGE_CATEGORIES),
  }),
  hideThreshold: z.number().min(0).max(1),
  failOpen: z.boolean(),
  openrouter: z.strictObject({
    model: z.string().min(1).max(200),
    baseUrl: z.string().min(1).max(500),
    timeoutMs: z.number().int().positive(),
    apiKey: z.custom<SecretRef | string>((value) => typeof value === 'string' || isSecretRef(value)).optional(),
  }),
  images: z.strictObject({
    maxImages: z.number().int().min(0).max(10),
    timeoutMs: z.number().int().positive(),
    maxBytes: z.number().int().positive(),
    longestEdge: z.number().int().min(128).max(1024),
    quality: z.number().int().min(30).max(90),
  }),
  blocklist: z.array(z.string().min(1).max(120)),
  allowlist: z.array(z.string().min(1).max(120)),
})
export type FilterFileConfig = z.infer<typeof filterFileSchema>

export function normalizeSchemaSet<T extends string>(value: 'all' | readonly T[], all: readonly T[]): T[] {
  if (value === 'all') return [...all]
  const seen = new Set<T>()
  for (const entry of value) {
    if (!all.includes(entry)) throw new Error(`Unknown filter schema: ${entry}. Valid: ${all.join(', ')}`)
    seen.add(entry)
  }
  return [...seen]
}
