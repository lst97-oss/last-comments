import { z } from 'zod'

// .env files ship these blank, so an empty string must mean "not configured"
// instead of failing validation (which would 500 every blog page).
const optionalString = z
  .string()
  .transform((value) => (value.length > 0 ? value : undefined))
  .optional()

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PAYLOAD_SECRET: z.string().min(1, 'PAYLOAD_SECRET is required'),
  DATABASE_URL: z.string().min(1, 'DATABASE_URL is required'),
  PAYLOAD_PUBLIC_SERVER_URL: z.string().min(1, 'PAYLOAD_PUBLIC_SERVER_URL is required'),
  // Blog comments are optional: without these the pages render a configuration
  // notice instead of the widget, and publishing skips thread registration.
  // (The Turnstile site key moved to `turnstile.config.ts` — public, not a secret.)
  BLOG_SITE_KEY: optionalString,
})

export type ServerEnv = z.infer<typeof envSchema>

let cached: ServerEnv | null = null

export function getServerEnv(): ServerEnv {
  if (cached) return cached
  // The Payload CLI (generate:types, migrate:create) runs under Node, not
  // Bun — so this must work in both runtimes. Prefer Bun.env when present.
  const source = typeof Bun !== 'undefined' ? Bun.env : process.env
  cached = envSchema.parse(source)
  return cached
}
