import type { CommentPlugin } from '@/server/plugins/comment-plugins'
import { filterPlugin } from '@/server/plugins/filter/filter.plugin'
import { resolveClientIp } from '@/server/plugins/rate-limit/client-ip'
import { getRateLimitPluginSettings } from '@/server/plugins/rate-limit/rate-limit.config'
import { createRateLimitPlugin } from '@/server/plugins/rate-limit/rate-limit.plugin'
import { turnstilePlugin } from '@/server/plugins/turnstile/turnstile.plugin'

// The filter plugin never throws (advisory hide-for-review), so its position
// is irrelevant to the validate-order; it sits last for readability.
export const installedCommentPlugins = [
  turnstilePlugin,
  // The guest identity is the client IP, and `x-real-ip` is only believed
  // when the request came from a trusted ingress — otherwise a direct client
  // could rotate the header to dodge the limit.
  createRateLimitPlugin((request) =>
    resolveClientIp(request, { trustedCidrs: getRateLimitPluginSettings().trustedProxyCidrs }),
  ),
  filterPlugin,
] satisfies readonly CommentPlugin[]
