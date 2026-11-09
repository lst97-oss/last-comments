// Presentation only: what an admin reads in the bell. Deleted and hidden notices carry no comment text.

export type NotificationKind = 'created' | 'held' | 'hidden' | 'deleted' | 'reacted'

export type FormattedNotification = {
  type: string
  title: string
  body: string
  priority: -1 | 0 | 1
  data: Record<string, unknown>
}

const EXCERPT_LENGTH = 140

// Markdown punctuation is dropped so the excerpt reads as one plain line in the bell.
export function excerpt(markdown: string, max = EXCERPT_LENGTH): string {
  const plain = markdown
    .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
    .replace(/[`*_#>[\]()~|]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
  return plain.length > max ? `${plain.slice(0, max - 1)}…` : plain
}

// The thread page reads its site from the query; a link without it shows "missing its site".
export function moderationUrl(pageId: string, siteKey: string): string {
  return `/moderation/${pageId}?site=${encodeURIComponent(siteKey)}`
}

export type FormatInput = {
  kind: NotificationKind
  siteKey: string
  pageId: string
  pageUrl: string
  commentId?: string
  siteId: string
  authorName?: string
  bodyMarkdown?: string
  reasons?: readonly string[]
  emoji?: string
}

export function formatNotification(input: FormatInput): FormattedNotification {
  const data = {
    url: moderationUrl(input.pageId, input.siteKey),
    siteId: input.siteId,
    pageId: input.pageId,
    ...(input.commentId ? { commentId: input.commentId } : {}),
  }
  const author = input.authorName ?? 'Someone'
  switch (input.kind) {
    case 'created':
      return {
        type: 'comment.created',
        title: `New comment on ${input.pageUrl}`,
        body: `${author}: ${excerpt(input.bodyMarkdown ?? '')}`,
        priority: 0,
        data,
      }
    case 'held': {
      const why = input.reasons && input.reasons.length > 0 ? ` (${input.reasons.join(', ')})` : ''
      return {
        type: 'comment.held',
        title: `Comment held for review${why}`,
        body: `${author}: ${excerpt(input.bodyMarkdown ?? '')}`,
        priority: 1,
        data,
      }
    }
    case 'hidden':
      return { type: 'comment.hidden', title: `Comment hidden on ${input.pageUrl}`, body: '', priority: 0, data }
    case 'deleted':
      return { type: 'comment.deleted', title: `Comment deleted on ${input.pageUrl}`, body: '', priority: 0, data }
    case 'reacted':
      return {
        type: 'page.reacted',
        title: `New reaction on ${input.pageUrl}`,
        body: input.emoji ?? '',
        priority: -1,
        data,
      }
  }
}
