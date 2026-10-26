import { createFileRoute } from '@tanstack/react-router'
import { applyPublicCors } from '@/server/http/cors'
import { ErrorCode, HttpError } from '@/server/http/errors'
import { ok } from '@/server/http/response'
import { parseSearchParams } from '@/server/http/validation'
import { withContext } from '@/server/http/with-context'
import { buildPublicSiteSettings } from '@/server/modules/comments/domain/site-settings'
import { siteQuerySchema } from '@/server/modules/comments/http/comment-schemas'
import { getPublicSiteSettingsRow } from '@/server/modules/comments/infrastructure/comment-repository'
import { getCommentEditSettings } from '@/server/plugins/comment-policy.config'
import { getTurnstilePluginSettings } from '@/server/plugins/turnstile/turnstile.config'

// Fresh within a minute, then served stale for five while it revalidates. A policy
// change in the dashboard reaches widgets within about a minute.
const CACHE_CONTROL = 'public, max-age=60, stale-while-revalidate=300'

// Read-only and public: a widget reads its site's policy before the visitor types.
// The Nitro route rule for this exact path (vite.config.ts) stamps the cache header
// on every status, so an error here can also be cached for the same minute. That is
// acceptable: a widget that gets an error falls back to its built-in defaults.
export const Route = createFileRoute('/api/comments/settings')({
  server: {
    handlers: {
      GET: async (ctx) => {
        const response = await withContext(async () => {
          const { site } = parseSearchParams(ctx.request.url, siteQuerySchema)
          const row = await getPublicSiteSettingsRow(site)
          if (!row)
            throw new HttpError(ErrorCode.SITE_NOT_FOUND.status, ErrorCode.SITE_NOT_FOUND.code, 'Site was not found')
          const settings = buildPublicSiteSettings(row, {
            anonWindowMinutes: getCommentEditSettings().anonWindowMinutes,
            turnstileSiteKey: getTurnstilePluginSettings().siteKey,
          })
          return ok({ settings }, { headers: { 'cache-control': CACHE_CONTROL } })
        })(ctx)
        return applyPublicCors(response)
      },
    },
  },
})
