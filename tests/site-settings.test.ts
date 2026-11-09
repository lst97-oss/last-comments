import { describe, expect, test } from 'bun:test'

import { COMMENT_BODY_LIMIT } from '@/lib/comment-schema'
import { REACTION_EMOJIS } from '@/server/modules/comments/domain/reactions'
import { buildPublicSiteSettings, SITE_SETTINGS_VERSION } from '@/server/modules/comments/domain/site-settings'

const reactionsOff = { pageReactionsEnabled: false, commentReactionsEnabled: false }

describe('buildPublicSiteSettings', () => {
  test('a site with no override gets the ceiling as its limit', () => {
    const settings = buildPublicSiteSettings(
      { access: 'open', bodyLimit: null, votesEnabled: true, ...reactionsOff },
      { anonWindowMinutes: 10, turnstileSiteKey: '0x-public' },
    )
    expect(settings).toEqual({
      version: SITE_SETTINGS_VERSION,
      access: 'open',
      bodyLimit: COMMENT_BODY_LIMIT,
      anonEditWindowMinutes: 10,
      turnstileSiteKey: '0x-public',
      features: { votes: true, pageReactions: [], commentReactions: [] },
    })
  })

  test('a stored limit is reported as stored, and a limit above the ceiling is capped', () => {
    const lower = buildPublicSiteSettings(
      { access: 'login', bodyLimit: 500, votesEnabled: true, ...reactionsOff },
      { anonWindowMinutes: 0, turnstileSiteKey: undefined },
    )
    expect(lower.bodyLimit).toBe(500)
    expect(lower.access).toBe('login')
    const capped = buildPublicSiteSettings(
      { access: 'private', bodyLimit: COMMENT_BODY_LIMIT + 1, votesEnabled: true, ...reactionsOff },
      { anonWindowMinutes: 0, turnstileSiteKey: undefined },
    )
    expect(capped.bodyLimit).toBe(COMMENT_BODY_LIMIT)
  })

  test('the vote switch is carried as a feature flag, off as well as on', () => {
    const off = buildPublicSiteSettings(
      { access: 'open', bodyLimit: null, votesEnabled: false, ...reactionsOff },
      { anonWindowMinutes: 10, turnstileSiteKey: undefined },
    )
    expect(off.features).toEqual({ votes: false, pageReactions: [], commentReactions: [] })
  })

  test('each reaction switch publishes the emoji set on its own, and an off switch publishes none', () => {
    const policy = { anonWindowMinutes: 10, turnstileSiteKey: undefined }
    const base = { access: 'open' as const, bodyLimit: null, votesEnabled: true }

    const pageOnly = buildPublicSiteSettings(
      { ...base, pageReactionsEnabled: true, commentReactionsEnabled: false },
      policy,
    )
    expect(pageOnly.features).toEqual({ votes: true, pageReactions: [...REACTION_EMOJIS], commentReactions: [] })

    const commentOnly = buildPublicSiteSettings(
      { ...base, pageReactionsEnabled: false, commentReactionsEnabled: true },
      policy,
    )
    expect(commentOnly.features).toEqual({ votes: true, pageReactions: [], commentReactions: [...REACTION_EMOJIS] })
  })

  test('a missing Turnstile key is null, not undefined, so the document is always the same shape', () => {
    const settings = buildPublicSiteSettings(
      { access: 'open', bodyLimit: null, votesEnabled: true, ...reactionsOff },
      { anonWindowMinutes: 10, turnstileSiteKey: undefined },
    )
    expect(settings.turnstileSiteKey).toBeNull()
    expect(Object.keys(settings).sort()).toEqual([
      'access',
      'anonEditWindowMinutes',
      'bodyLimit',
      'features',
      'turnstileSiteKey',
      'version',
    ])
  })
})
