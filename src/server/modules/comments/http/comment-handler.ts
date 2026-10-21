import { createComment } from '@/server/modules/comments/application/create-comment'
import { deleteComment } from '@/server/modules/comments/application/delete-comment'
import { editComment } from '@/server/modules/comments/application/edit-comment'
import {
  deleteOwnComment,
  editOwnComment,
  persistComment,
  prepareCommentCreation,
} from '@/server/modules/comments/infrastructure/comment-repository'
import { EMPTY_SCREENING, publishCommentScreening, publishCommentValidation } from '@/server/plugins/comment-plugins'

export function createCommentData(input: Parameters<typeof createComment>[0]) {
  return createComment(input, {
    prepare: prepareCommentCreation,
    validate: publishCommentValidation,
    screen: publishCommentScreening,
    persist: persistComment,
  })
}

// Edits are re-screened so a clean comment edited into a violation re-enters
// review. Screening runs before the transaction (never hold a transaction
// open during LLM network I/O) with degraded context — the edit path has no
// site/page lookup yet, and only the new body matters.
export async function editCommentData(
  input: Parameters<typeof editComment>[0],
  options: { skipScreening?: boolean } = {},
) {
  const screening = options.skipScreening
    ? EMPTY_SCREENING
    : await publishCommentScreening({
        siteId: '',
        pageUrl: '',
        userId: input.userId,
        authorName: '',
        bodyMarkdown: input.bodyMarkdown,
      })
  return editComment(input, { edit: (data) => editOwnComment(data, screening) })
}

// Dashboard posts, including anonymous ones: the instance-admin session is the
// verification, so guest verification (Turnstile) is skipped like the other
// moderation writes. Screening is skipped for the same reason — moderator
// writes are trusted and must never auto-hide themselves.
export function createModerationCommentData(input: Parameters<typeof createComment>[0]) {
  return createComment(input, {
    prepare: prepareCommentCreation,
    validate: async () => {},
    persist: persistComment,
  })
}

export function editModerationCommentData(input: Parameters<typeof editComment>[0]) {
  return editCommentData(input, { skipScreening: true })
}

export function deleteCommentData(input: Parameters<typeof deleteComment>[0]) {
  return deleteComment(input, { delete: deleteOwnComment })
}
