import { describe, expect, test } from 'bun:test'

import { REACTION_EMOJIS, toReactionSummaries } from '@/server/modules/comments/domain/reactions'
import { reactionEmojiSchema } from '@/server/modules/comments/http/comment-schemas'

describe('reaction emoji', () => {
  test('the allowlist is matched exactly, so a heart without its variation selector is refused', () => {
    const accepts = (emoji: string) => reactionEmojiSchema.safeParse(emoji).success
    expect(accepts('👍')).toBe(true)
    expect(accepts('❤️')).toBe(true)
    expect(accepts('❤')).toBe(false)
    expect(accepts('🙂')).toBe(false)
    expect(accepts('')).toBe(false)
  })

  test('summaries follow the allowlist order, omit emoji nobody used, and drop emoji no longer allowed', () => {
    const summaries = toReactionSummaries([
      { emoji: '🎉', count: 1, viewerReacted: false },
      { emoji: '👍', count: 3, viewerReacted: true },
      { emoji: '🙂', count: 9, viewerReacted: false },
    ])
    expect(summaries).toEqual([
      { emoji: '👍', count: 3, viewerReacted: true },
      { emoji: '🎉', count: 1, viewerReacted: false },
    ])
    expect(toReactionSummaries([])).toEqual([])
    expect(REACTION_EMOJIS.length).toBeGreaterThanOrEqual(5)
  })
})
