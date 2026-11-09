import { and, desc, eq, gte, lt } from 'drizzle-orm'

import { getBusinessDb } from '@/server/db/business-sql'
import {
  comments,
  instanceAdmins,
  moderationEvents,
  pages,
  pluginEvents,
  siteMemberships,
  sites,
  user,
} from '@/server/db/schema'
import type { Db } from '@/server/modules/comments/infrastructure/comment-types'

export type Recipient = { userId: string; email: string | null }

export type CommentContext = {
  pageId: string
  pageUrl: string
  authorName: string
  bodyMarkdown: string
  status: 'visible' | 'hidden' | 'deleted'
}

// The plugin's database reads, behind a port so its tests pass fakes.
export type NotificationsRepository = {
  // Everyone who administers the site: its site admins plus the instance admin, once each.
  loadRecipients(siteId: string): Promise<Recipient[]>
  loadCommentContext(commentId: string): Promise<CommentContext | null>
  // The moderator who last acted on a comment, from the audit log (moderator events carry no actor).
  loadModerationActor(commentId: string): Promise<string | null>
  // The site's public key, which the moderation links name in their query.
  loadSiteKey(siteId: string): Promise<string | null>
  // Whether a page reaction event for this page, in [from, before), is already in the outbox.
  hasEarlierReactionNotice(siteId: string, pageId: string, from: Date, before: Date): Promise<boolean>
}

export function createNotificationsRepository(db: () => Db = getBusinessDb): NotificationsRepository {
  return {
    async loadRecipients(siteId) {
      const siteAdmins = await db()
        .select({ userId: siteMemberships.userId, email: user.email })
        .from(siteMemberships)
        .innerJoin(user, eq(user.id, siteMemberships.userId))
        .where(and(eq(siteMemberships.siteId, siteId), eq(siteMemberships.role, 'admin')))
      const instance = await db()
        .select({ userId: instanceAdmins.userId, email: user.email })
        .from(instanceAdmins)
        .innerJoin(user, eq(user.id, instanceAdmins.userId))
      const byUser = new Map<string, Recipient>()
      for (const row of [...siteAdmins, ...instance]) {
        if (!byUser.has(row.userId)) byUser.set(row.userId, { userId: row.userId, email: row.email })
      }
      return [...byUser.values()]
    },

    async loadCommentContext(commentId) {
      const [row] = await db()
        .select({
          pageId: comments.pageId,
          pageUrl: pages.canonicalUrl,
          authorName: comments.authorName,
          bodyMarkdown: comments.bodyMarkdown,
          status: comments.status,
        })
        .from(comments)
        .innerJoin(pages, eq(pages.id, comments.pageId))
        .where(eq(comments.id, commentId))
        .limit(1)
      return row ?? null
    },

    async loadSiteKey(siteId) {
      const [row] = await db().select({ key: sites.key }).from(sites).where(eq(sites.id, siteId)).limit(1)
      return row?.key ?? null
    },

    async loadModerationActor(commentId) {
      const [row] = await db()
        .select({ actor: moderationEvents.actorUserId })
        .from(moderationEvents)
        .where(and(eq(moderationEvents.targetType, 'comment'), eq(moderationEvents.targetId, commentId)))
        .orderBy(desc(moderationEvents.occurredAt))
        .limit(1)
      return row?.actor ?? null
    },

    async hasEarlierReactionNotice(siteId, pageId, from, before) {
      const [row] = await db()
        .select({ id: pluginEvents.id })
        .from(pluginEvents)
        .where(
          and(
            eq(pluginEvents.siteId, siteId),
            eq(pluginEvents.eventType, 'page.reacted'),
            eq(pluginEvents.aggregateId, pageId),
            gte(pluginEvents.occurredAt, from),
            lt(pluginEvents.occurredAt, before),
          ),
        )
        .limit(1)
      return row !== undefined
    },
  }
}
