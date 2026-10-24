import { sql } from 'drizzle-orm'

import { getBusinessDb } from '@/server/db/business-sql'
import { HttpError } from '@/server/http/errors'
import { getRequestLogger, type Logger } from '@/server/observability/logger'
import type { CommentOperation, CommentPlugin } from '@/server/plugins/comment-plugins'
import { getRateLimitPluginSettings, rateLimits } from '@/server/plugins/rate-limit/rate-limit.config'

export type ClientIpResolver = (request: Request) => string | null
export type RateLimitWindow = {
  siteKey: string
  identityHash: string
  operation: CommentOperation
  windowStart: number
  now: number
  retentionSeconds: number
}
export type RateLimitStore = (window: RateLimitWindow) => Promise<number>

async function requesterHash(
  secret: string | undefined,
  identifiers: { userId: string | null; clientId?: string; keyId?: string },
  request: Request,
  resolveClientIp: ClientIpResolver,
) {
  // A proxied visitor has no user id and the proxy's own IP, so the verified
  // clientId separates one visitor's budget from another's. A key without a
  // clientId is bucketed by the key, not by an IP that may be shared.
  const { userId, clientId, keyId } = identifiers
  const clientIp = userId || clientId || keyId ? null : resolveClientIp(request)
  const identity = userId
    ? `user:${userId}`
    : clientId
      ? `client:${clientId}`
      : keyId
        ? `key:${keyId}`
        : clientIp
          ? `ip:${clientIp}`
          : null
  if (!identity || !secret) {
    throw new HttpError(503, 'RATE_LIMIT_UNAVAILABLE', 'Comment operations are temporarily unavailable', {
      expose: true,
    })
  }
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  )
  const digest = await crypto.subtle.sign(
    'HMAC',
    key,
    new TextEncoder().encode(`last-comments-rate-limit:v1:${identity}`),
  )
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, '0')).join('')
}

async function incrementRateLimitWindow({
  siteKey,
  identityHash,
  operation,
  windowStart,
  now,
  retentionSeconds,
}: RateLimitWindow) {
  try {
    const [row] = (await getBusinessDb().execute(sql`
      WITH expired AS (
        DELETE FROM comment_rate_limit.rate_limit_windows WHERE window_start < ${now - retentionSeconds}
      )
      INSERT INTO comment_rate_limit.rate_limit_windows (site_key, identity_hash, operation, window_start, count)
      VALUES (${siteKey}, ${identityHash}, ${operation}, ${windowStart}, 1)
      ON CONFLICT (site_key, identity_hash, operation, window_start)
      DO UPDATE SET count = comment_rate_limit.rate_limit_windows.count + 1
      RETURNING count
    `)) as { count: number }[]
    const count = Number(row?.count)
    if (!count) throw new Error('Rate-limit store did not return a count')
    return count
  } catch {
    throw new HttpError(503, 'RATE_LIMIT_UNAVAILABLE', 'Comment operations are temporarily unavailable', {
      expose: true,
    })
  }
}

export function createRateLimitPlugin(
  resolveClientIp: ClientIpResolver,
  increment: RateLimitStore = incrementRateLimitWindow,
  logger: Logger = getRequestLogger().child({ plugin: 'rate-limit' }),
  limits: Record<CommentOperation, { count: number; windowSeconds: number }> = rateLimits,
): CommentPlugin {
  const { secret } = getRateLimitPluginSettings()
  // A row is only read while its window is open. Keep one extra window of
  // headroom for clock skew; retaining a fixed day multiplies live rows by
  // 60/600s per identity for no benefit.
  const retentionSeconds = 2 * Math.max(...Object.values(limits).map((limit) => limit.windowSeconds))
  let missingSecretLogged = false
  return {
    id: 'rate-limit',
    apiVersion: 1,
    migrations: { folder: 'drizzle/plugins/rate-limit', schema: 'drizzle_rate_limit' },
    async beforeOperation({ operation, siteKey, userId, clientId, keyId, request }) {
      const { count, windowSeconds } = limits[operation]
      const now = Math.floor(Date.now() / 1000)
      const windowStart = Math.floor(now / windowSeconds) * windowSeconds
      if (!secret && !missingSecretLogged) {
        missingSecretLogged = true
        logger.error('rate_limit.secret_missing')
      }
      const identityHash = await requesterHash(secret, { userId, clientId, keyId }, request, resolveClientIp)
      let used: number
      try {
        used = await increment({ siteKey, identityHash, operation, windowStart, now, retentionSeconds })
      } catch {
        logger.error('rate_limit.storage_unavailable', { operation })
        throw new HttpError(503, 'RATE_LIMIT_UNAVAILABLE', 'Comment operations are temporarily unavailable', {
          expose: true,
        })
      }
      if (used > count) {
        throw new HttpError(429, 'RATE_LIMITED', 'Too many comment operations', {
          headers: { 'retry-after': String(Math.max(1, windowStart + windowSeconds - now)) },
        })
      }
    },
  }
}
