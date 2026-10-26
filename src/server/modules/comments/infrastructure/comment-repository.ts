// The comment repository, split by use case. Importers keep using this path; the modules below
// hold the implementation, and only names that were already public are re-exported here.

export type { SitePage } from '@/server/modules/comments/infrastructure/comment-pages'
export { upsertPage } from '@/server/modules/comments/infrastructure/comment-pages'
export { listPageComments } from '@/server/modules/comments/infrastructure/comment-reads'
export {
  assertAnySiteOrigin,
  assertCommentFitsSite,
  assertSiteOrigin,
  assertWithinBodyLimit,
  getPageCanonicalUrl,
  getPublicSiteSettingsRow,
  getSiteAccess,
  getSiteId,
  requireAllowedOrigin,
} from '@/server/modules/comments/infrastructure/comment-sites'
export type { CommentVoteSummary, VoteValue } from '@/server/modules/comments/infrastructure/comment-types'
export { castCommentVote, clearCommentVote } from '@/server/modules/comments/infrastructure/comment-votes'
export type { PersistedComment } from '@/server/modules/comments/infrastructure/comment-writes'
export {
  deleteOwnComment,
  editOwnComment,
  persistComment,
  prepareCommentCreation,
} from '@/server/modules/comments/infrastructure/comment-writes'
export {
  deletePage,
  setCommentStatus,
  setPageLocked,
  setUserBlocked,
} from '@/server/modules/comments/infrastructure/moderation-actions'
export type {
  ModerationComment,
  ModerationPageSummary,
  ModerationTakedown,
  RecentAuthorRollup,
  RecentPreviewComment,
  SiteUser,
  UserCommentHistoryItem,
} from '@/server/modules/comments/infrastructure/moderation-queries'
export {
  attachOrigins,
  listModerationComments,
  listModerationPages,
  listModerationSites,
  listModerationTakedowns,
  listSiteUsers,
  listUserComments,
} from '@/server/modules/comments/infrastructure/moderation-queries'
export type {
  PageThreadDetail,
  PageThreadStats,
  SiteDashboardStats,
} from '@/server/modules/comments/infrastructure/stats-queries'
export { getPageThread, getSiteStats } from '@/server/modules/comments/infrastructure/stats-queries'
