import { z } from 'zod'

// Lazy + dual-runtime (Bun/Node) — Payload keeps using DATABASE_URL.

const businessEnvSchema = z.object({
  BUSINESS_DATABASE_URL: z.string().min(1, 'BUSINESS_DATABASE_URL is required'),
})

export function getBusinessEnv(
  source: Record<string, string | undefined> = typeof Bun !== 'undefined' ? Bun.env : process.env,
) {
  const parsed = businessEnvSchema.parse(source)
  return { connectionString: parsed.BUSINESS_DATABASE_URL }
}
