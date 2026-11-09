import { resolveBodyLimit } from '@/lib/comment-schema'
import type { SiteAccess } from '@/lib/site-access'
import { REACTION_EMOJIS, type ReactionEmoji } from '@/server/modules/comments/domain/reactions'

// The public settings document a widget reads. Everything here is policy the
// server enforces anyway, or a public key the widget must send, so none of it is
// secret. Keep this list short: anything else stays off the public surface.
export const SITE_SETTINGS_VERSION = 1

export type PublicSiteSettings = {
  version: typeof SITE_SETTINGS_VERSION
  access: SiteAccess
  bodyLimit: number
  anonEditWindowMinutes: number
  turnstileSiteKey: string | null
  // Feature switches the widget applies. The server enforces them too. The reaction
  // lists are the emoji a switch allows, so an off switch sends an empty list.
  features: { votes: boolean; pageReactions: ReactionEmoji[]; commentReactions: ReactionEmoji[] }
}

// Pure so the rules (a null limit resolves to the ceiling, a missing key is null)
// are testable without a database. The caller supplies the stored row and the
// instance policy.
export function buildPublicSiteSettings(
  site: {
    access: SiteAccess
    bodyLimit: number | null
    votesEnabled: boolean
    pageReactionsEnabled: boolean
    commentReactionsEnabled: boolean
  },
  policy: { anonWindowMinutes: number; turnstileSiteKey: string | undefined },
): PublicSiteSettings {
  return {
    version: SITE_SETTINGS_VERSION,
    access: site.access,
    bodyLimit: resolveBodyLimit(site.bodyLimit),
    anonEditWindowMinutes: policy.anonWindowMinutes,
    turnstileSiteKey: policy.turnstileSiteKey ?? null,
    features: {
      votes: site.votesEnabled,
      pageReactions: site.pageReactionsEnabled ? [...REACTION_EMOJIS] : [],
      commentReactions: site.commentReactionsEnabled ? [...REACTION_EMOJIS] : [],
    },
  }
}
