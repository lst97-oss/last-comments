// The emoji a reaction may use. Fixed in code for v1: the server validates against this list and publishes
// it in the settings document, so the widget draws exactly what the server accepts. Matched exactly: a heart
// without its variation selector is a different string and is refused.
export const REACTION_EMOJIS = ['👍', '❤️', '😄', '🎉', '😮', '👀'] as const

export type ReactionEmoji = (typeof REACTION_EMOJIS)[number]

export type ReactionSummary = { emoji: ReactionEmoji; count: number; viewerReacted: boolean }

export type ReactionRow = { emoji: string; count: number; viewerReacted: boolean }

// Counts in the allowlist's order. An emoji nobody used is omitted, and one that has since left the
// allowlist is dropped from the response but stays in the table.
export function toReactionSummaries(rows: ReactionRow[]): ReactionSummary[] {
  const summaries: ReactionSummary[] = []
  for (const emoji of REACTION_EMOJIS) {
    const row = rows.find((candidate) => candidate.emoji === emoji)
    if (row && row.count > 0) summaries.push({ emoji, count: row.count, viewerReacted: row.viewerReacted })
  }
  return summaries
}
