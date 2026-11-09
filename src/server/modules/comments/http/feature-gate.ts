import { ErrorCode, HttpError } from '@/server/http/errors'
import { SWITCH_COPY } from '@/server/modules/comments/domain/switch-copy'
import { getSiteContext } from '@/server/modules/comments/infrastructure/comment-sites'

// The acts a site switch can refuse, and the column on the site row that holds each switch.
export type SwitchedFeature = keyof typeof SWITCH_COPY

const FLAG = {
  votes: 'votesEnabled',
  commentReactions: 'commentReactionsEnabled',
  pageReactions: 'pageReactionsEnabled',
} as const

// Checked before the session, so a visitor on a site with the switch off is told that rather than asked to
// sign in. A gateway-only site takes no browser writes, and its keys cannot act for a user, so a write there
// is refused whatever the switch says. An unknown site passes here and fails at the origin check.
export async function assertFeatureOpen(
  siteKey: string,
  feature: SwitchedFeature,
  access: 'read' | 'write',
): Promise<void> {
  const site = await getSiteContext(siteKey, null)
  if (!site) return
  const copy = SWITCH_COPY[feature]
  if (access === 'write' && site.gatewayOnly)
    throw new HttpError(ErrorCode.FORBIDDEN.status, ErrorCode.FORBIDDEN.code, copy.browsers)
  if (!site[FLAG[feature]])
    throw new HttpError(ErrorCode.FEATURE_DISABLED.status, ErrorCode.FEATURE_DISABLED.code, copy.off)
}
