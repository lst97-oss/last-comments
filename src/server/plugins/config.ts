import type { CommentPlugin } from '@/server/plugins/comment-plugins'
import { filterPlugin } from '@/server/plugins/filter/filter.plugin'
import { createRateLimitPlugin } from '@/server/plugins/rate-limit/rate-limit.plugin'
import { turnstilePlugin } from '@/server/plugins/turnstile/turnstile.plugin'

// The filter plugin never throws (advisory hide-for-review), so its position
// is irrelevant to the validate-order; it sits last for readability.
export const installedCommentPlugins = [
  turnstilePlugin,
  createRateLimitPlugin((request) => request.headers.get('x-real-ip')),
  filterPlugin,
] satisfies readonly CommentPlugin[]
