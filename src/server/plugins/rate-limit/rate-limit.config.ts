import { z } from 'zod'

import type { CommentOperation } from '@/server/plugins/comment-plugins'

// Per-operation budgets; the HMAC secret comes from the environment.

export const rateLimits: Record<CommentOperation, { count: number; windowSeconds: number }> = {
  'comment.create': { count: 5, windowSeconds: 600 },
  'comment.edit': { count: 20, windowSeconds: 600 },
  'comment.delete': { count: 20, windowSeconds: 600 },
  'comment.vote': { count: 60, windowSeconds: 60 },
}

const rateLimitEnvSchema = z.object({
  BETTER_AUTH_SECRET: z.preprocess(
    (value) => (typeof value === 'string' && value.trim() === '' ? undefined : value),
    z.string().min(32).optional(),
  ),
})

export function getRateLimitPluginSettings(source: Record<string, string | undefined> = Bun.env) {
  const env = rateLimitEnvSchema.parse(source)
  return { secret: env.BETTER_AUTH_SECRET }
}
