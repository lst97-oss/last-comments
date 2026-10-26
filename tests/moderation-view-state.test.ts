import { describe, expect, test } from 'bun:test'

import { INITIAL_MODERATION_VIEW, type ModerationViewState, moderationViewReducer } from '@/lib/moderation-view-state'

const paged: ModerationViewState = { siteOverride: 'blog', recentDays: 30, takedownPage: 3 }

describe('moderationViewReducer', () => {
  test('starts on no override, a 7-day window and the first takedown page', () => {
    expect(INITIAL_MODERATION_VIEW).toEqual({ siteOverride: null, recentDays: 7, takedownPage: 0 })
  })

  test('switching or creating a site returns the takedown list to its first page', () => {
    const expected = { siteOverride: 'docs', recentDays: 30, takedownPage: 0 }
    expect(moderationViewReducer(paged, { type: 'switchSite', site: 'docs' })).toEqual(expected)
    expect(moderationViewReducer(paged, { type: 'siteCreated', site: 'docs' })).toEqual(expected)
  })

  test('deleting the active site drops the override and the page', () => {
    expect(moderationViewReducer(paged, { type: 'siteCleared' })).toEqual({
      siteOverride: null,
      recentDays: 30,
      takedownPage: 0,
    })
  })

  test('a new window keeps the site and returns to the first page', () => {
    expect(moderationViewReducer(paged, { type: 'recentDays', days: 90 })).toEqual({
      siteOverride: 'blog',
      recentDays: 90,
      takedownPage: 0,
    })
  })

  test('paging keeps the site and the window', () => {
    expect(moderationViewReducer(paged, { type: 'takedownPage', page: 5 })).toEqual({
      siteOverride: 'blog',
      recentDays: 30,
      takedownPage: 5,
    })
  })
})
