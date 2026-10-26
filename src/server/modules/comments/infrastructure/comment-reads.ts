import { and, asc, eq, inArray, sql } from 'drizzle-orm'
import { getBusinessDb } from '@/server/db/business-sql'
import { comments, pages, siteMemberships, sites, user } from '@/server/db/schema'
import type { MembershipRole } from '@/server/http/route-guards'
import { normalizePageKey, normalizePageUrl } from '@/server/modules/comments/domain/comment'
import type { Db, VoteValue } from '@/server/modules/comments/infrastructure/comment-types'

// The public thread, one query per page of the flat list. The page is resolved inside the statement, so
// the comment read walks the page's (page_id, created_at, id) index and stops at the limit. Joining the
// site and page into the outer query made the planner sort the whole thread for every page. Score and
// the viewer's vote are indexed correlated reads, and a deleted row is redacted in SQL: its place and its
// replies stay, while the body, author, votes and edit time never leave the database.
export async function listPageComments(
  siteKey: string,
  pageUrl: string,
  options: { limit: number; offset: number; viewerUserId?: string | null; pageKey?: string },
  db: Db = getBusinessDb(),
) {
  const normalizedKey = options.pageKey === undefined ? undefined : normalizePageKey(options.pageKey)
  const pageFilter =
    normalizedKey === undefined ? eq(pages.canonicalUrl, normalizePageUrl(pageUrl)) : eq(pages.pageKey, normalizedKey)
  const pageOfSite = db
    .select({ id: pages.id })
    .from(pages)
    .innerJoin(sites, eq(pages.siteId, sites.id))
    .where(and(eq(sites.key, siteKey), pageFilter))
    .limit(1)
  const deleted = sql`${comments.status} = 'deleted'`

  return db
    .select({
      id: comments.id,
      pageId: comments.pageId,
      parentId: comments.parentId,
      userId: sql<string | null>`case when ${deleted} then null else ${comments.userId} end`,
      authorName: sql<string>`case when ${deleted} then '' else ${comments.authorName} end`,
      avatarUrl: sql<string | null>`case when ${deleted} then null else ${user.image} end`,
      bodyMarkdown: sql<string>`case when ${deleted} then '' else ${comments.bodyMarkdown} end`,
      status: comments.status,
      pinnedAt: sql<Date | null>`case when ${deleted} then null else ${comments.pinnedAt} end`,
      createdAt: comments.createdAt,
      editedAt: sql<Date | null>`case when ${deleted} then null else ${comments.editedAt} end`,
      // A signed-in author without an admin row is a member; a guest keeps null. Deleted rows stay redacted.
      authorRole: sql<MembershipRole | null>`case when ${deleted} then null else coalesce(${siteMemberships.role}, case when ${comments.userId} is not null then 'member'::site_role end) end`,
      score: sql<number>`case when ${deleted} then 0 else (select coalesce(sum(v.value), 0)::int from votes v where v.comment_id = ${comments.id}) end`,
      viewerVote: sql<VoteValue | null>`case when ${deleted} then null else (select v.value::int from votes v where v.comment_id = ${comments.id} and v.user_id = ${options.viewerUserId ?? null}) end`,
    })
    .from(comments)
    .leftJoin(user, eq(comments.userId, user.id))
    .leftJoin(
      siteMemberships,
      and(eq(comments.userId, siteMemberships.userId), eq(siteMemberships.siteId, comments.siteId)),
    )
    .where(and(eq(comments.pageId, sql`(${pageOfSite})`), inArray(comments.status, ['visible', 'deleted'])))
    .orderBy(asc(comments.createdAt), asc(comments.id))
    .limit(options.limit)
    .offset(options.offset)
}
