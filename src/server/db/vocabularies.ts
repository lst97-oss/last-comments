// Closed vocabularies stored as text. schema.ts turns each tuple into a CHECK constraint,
// and the TypeScript unions are derived from the same tuples, so the two cannot drift apart.
// This module imports nothing: drizzle-kit loads the schema, and so must anything it reaches.

export const MODERATION_ACTIONS = [
  'hide',
  'restore',
  'delete',
  'pin',
  'unpin',
  'page.lock',
  'page.unlock',
  'page.delete',
  'user.block',
  'user.unblock',
] as const
export type ModerationAction = (typeof MODERATION_ACTIONS)[number]

export const MODERATION_TARGET_TYPES = ['comment', 'page', 'user'] as const
export type ModerationTargetType = (typeof MODERATION_TARGET_TYPES)[number]

export const COMMENT_EVENT_TYPES = [
  'comment.created',
  'comment.edited',
  'comment.hidden',
  'comment.deleted',
  'comment.restored',
  'comment.pinned',
  'comment.voted',
  'page.locked',
  'page.unlocked',
  'page.deleted',
  'user.blocked',
  'user.unblocked',
  'user.verified',
  'user.unverified',
] as const
export type CommentEventType = (typeof COMMENT_EVENT_TYPES)[number]
