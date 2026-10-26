import { eq } from 'drizzle-orm'

import { getBusinessDb } from '@/server/db/business-sql'
import { siteOrigins } from '@/server/db/schema'
import { ErrorCode, HttpError } from '@/server/http/errors'
import { getRequestLogger, type Logger } from '@/server/observability/logger'
import type { CommentPlugin } from '@/server/plugins/comment-plugins'
import { getTurnstilePluginSettings } from '@/server/plugins/turnstile/turnstile.config'

const SITEVERIFY_URL = 'https://challenges.cloudflare.com/turnstile/v0/siteverify'
type Fetcher = (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>
// Hostnames of a site's registered origins. The token's hostname must be one
// of them: the client-supplied pageUrl proves nothing, because a script can
// mint a token on its own page and name any URL it likes.
type RegisteredHostnames = (siteId: string) => Promise<readonly string[]>

async function loadRegisteredHostnames(siteId: string): Promise<string[]> {
  const rows = await getBusinessDb()
    .select({ origin: siteOrigins.origin })
    .from(siteOrigins)
    .where(eq(siteOrigins.siteId, siteId))
  return rows.flatMap(({ origin }) => {
    try {
      return [new URL(origin).hostname]
    } catch {
      return []
    }
  })
}

// Cloudflare's published testing secrets (`1x…`, `2x…`, `3x…`, zeros, `AA`).
// shortcut: only these dummy keys bypass the hostname check — a production
// secret keeps it.
const TEST_SECRET_PATTERN = /^[123]x0+AA$/

function isTestSecret(secret: string): boolean {
  return TEST_SECRET_PATTERN.test(secret)
}

function unavailable(logger: Logger, reason: string): HttpError {
  logger.warn('turnstile.unavailable', { reason })
  return new HttpError(
    ErrorCode.COMMENT_VERIFICATION_UNAVAILABLE.status,
    ErrorCode.COMMENT_VERIFICATION_UNAVAILABLE.code,
    'Comment verification is temporarily unavailable',
    {
      expose: true,
    },
  )
}

function invalid(): HttpError {
  return new HttpError(
    ErrorCode.COMMENT_VERIFICATION_FAILED.status,
    ErrorCode.COMMENT_VERIFICATION_FAILED.code,
    'Comment verification failed',
  )
}

export function createTurnstilePlugin({
  secretKey = getTurnstilePluginSettings().secretKey,
  verificationRequired = getTurnstilePluginSettings().verificationRequired,
  fetcher = fetch,
  logger = getRequestLogger().child({ plugin: 'turnstile' }),
  registeredHostnames = loadRegisteredHostnames,
}: {
  secretKey?: string
  verificationRequired?: boolean
  fetcher?: Fetcher
  logger?: Logger
  registeredHostnames?: RegisteredHostnames
} = {}): CommentPlugin {
  return {
    id: 'turnstile',
    apiVersion: 1,
    verificationProvider: true,
    async validateComment(input, signal) {
      // Every commenter is verified: a signed-in session is not a substitute
      // for the challenge, so a spam account cannot skip it.
      // `verificationRequired: false` in turnstile.config.ts is the
      // local-development bypass: commenters post without a token. With it on,
      // a missing secret still fails closed below.
      if (!verificationRequired) return
      const secret = secretKey?.trim()
      if (!secret) throw unavailable(logger, 'secret_missing')
      if (!input.verificationToken) throw invalid()

      let response: Response
      try {
        response = await fetcher(SITEVERIFY_URL, {
          method: 'POST',
          headers: { 'content-type': 'application/x-www-form-urlencoded' },
          body: new URLSearchParams({ secret, response: input.verificationToken }),
          signal,
        })
      } catch {
        throw unavailable(logger, 'siteverify_request_failed')
      }
      if (!response.ok) throw unavailable(logger, 'siteverify_http_error')

      let result: unknown
      try {
        result = await response.json()
      } catch {
        throw unavailable(logger, 'siteverify_invalid_json')
      }
      if (!result || typeof result !== 'object' || !('success' in result)) {
        throw unavailable(logger, 'siteverify_malformed_response')
      }
      if (typeof result.success !== 'boolean') throw unavailable(logger, 'siteverify_malformed_response')
      if (result.success !== true) throw invalid()
      if (!('hostname' in result) || typeof result.hostname !== 'string') {
        throw unavailable(logger, 'siteverify_missing_hostname')
      }

      // The testing secrets validate any token and always answer with the
      // hostname `example.com`; Cloudflare documents them as working on any
      // domain, so the hostname check cannot apply to them.
      if (isTestSecret(secret)) return
      let hostnames: readonly string[]
      try {
        hostnames = await registeredHostnames(input.siteId)
      } catch {
        throw unavailable(logger, 'site_origins_unavailable')
      }
      if (!hostnames.includes(result.hostname)) throw invalid()
    },
  }
}

export const turnstilePlugin = createTurnstilePlugin()
