import { z } from 'zod'

import type { CommentOperation } from '@/server/plugins/comment-plugins'
import { DEFAULT_TRUSTED_PROXY_CIDRS } from '@/server/plugins/rate-limit/client-ip'

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
  RATE_LIMIT_TRUSTED_PROXY_CIDR: z.string().optional(),
})

// Comma-separated CIDRs of the ingress allowed to speak for the client, or
// "*" to trust every source. Unset falls back to the built-in loopback and
// private-network defaults.
export function parseTrustedProxyCidrs(value: string | undefined): string[] {
  const list = (value ?? '')
    .split(',')
    .map((entry) => entry.trim())
    .filter(Boolean)
  return list.length > 0 ? list : [...DEFAULT_TRUSTED_PROXY_CIDRS]
}

export function getRateLimitPluginSettings(source: Record<string, string | undefined> = Bun.env) {
  const env = rateLimitEnvSchema.parse(source)
  return {
    secret: env.BETTER_AUTH_SECRET,
    trustedProxyCidrs: parseTrustedProxyCidrs(env.RATE_LIMIT_TRUSTED_PROXY_CIDR),
  }
}
