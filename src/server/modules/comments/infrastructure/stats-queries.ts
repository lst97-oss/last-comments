import { and, count, desc, eq, gt, gte, inArray, isNull, or, sql } from 'drizzle-orm'
import { resolveBodyLimit } from '@/lib/comment-schema'
import { getBusinessDb } from '@/server/db/business-sql'
import { comments, moderationEvents, pages, sites, userBlocks, votes } from '@/server/db/schema'
import { ErrorCode, HttpError } from '@/server/http/errors'
import type { Db } from '@/server/modules/comments/infrastructure/comment-types'
import type { ModerationPageSummary } from '@/server/modules/comments/infrastructure/moderation-queries'
import { listModerationPages } from '@/server/modules/comments/infrastructure/moderation-queries'

export type SiteDashboardStats = {
  totals: {
    comments: number
    visible: number
    hidden: number
    deleted: number
    pages: number
    votesUp: number
    votesDown: number
    blockedUsers: number
  }
  window: { days: number; start: string; comments: number; votesUp: number; votesDown: number }
  series: {
    day: string
    comments: number
    visible: number
    hidden: number
    votesUp: number
    votesDown: number
  }[]
  topPages: { pageId: string; title: string | null; canonicalUrl: string; total: number }[]
  moderationActions: { action: string; count: number }[]
}

export async function getSiteStats(
  siteId: string,
  days: 7 | 30 | 90,
  db: Db = getBusinessDb(),
): Promise<SiteDashboardStats> {
  // UTC midnight of the first day in the window; the series spine uses the
  // same boundary so the top-pages and moderation counts line up with it.
  const now = new Date()
  const windowStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - (days - 1)))

  const [commentTotals, pageTotals, voteTotals, blockTotals, topPages, moderationActions] = await Promise.all([
    db
      .select({
        comments: count(comments.id),
        visible: sql<number>`count(*) filter (where ${comments.status} = 'visible')`,
        hidden: sql<number>`count(*) filter (where ${comments.status} = 'hidden')`,
        deleted: sql<number>`count(*) filter (where ${comments.status} = 'deleted')`,
      })
      .from(comments)
      .where(eq(comments.siteId, siteId)),
    db.select({ pages: count() }).from(pages).where(eq(pages.siteId, siteId)),
    db
      .select({
        votesUp: sql<number>`count(*) filter (where ${votes.value} = 1)`,
        votesDown: sql<number>`count(*) filter (where ${votes.value} = -1)`,
      })
      .from(votes)
      .innerJoin(comments, eq(votes.commentId, comments.id))
      .where(eq(comments.siteId, siteId)),
    db
      .select({ blockedUsers: count() })
      .from(userBlocks)
      .where(and(eq(userBlocks.siteId, siteId), or(isNull(userBlocks.expiresAt), gt(userBlocks.expiresAt, now)))),
    db
      .select({
        pageId: pages.id,
        title: pages.title,
        canonicalUrl: pages.canonicalUrl,
        total: count(comments.id),
      })
      .from(comments)
      .innerJoin(pages, eq(comments.pageId, pages.id))
      .where(
        and(
          eq(comments.siteId, siteId),
          gte(comments.createdAt, windowStart),
          inArray(comments.status, ['visible', 'hidden']),
        ),
      )
      .groupBy(pages.id, pages.title, pages.canonicalUrl)
      .orderBy(desc(count(comments.id)))
      .limit(5),
    db
      .select({ action: moderationEvents.action, count: count() })
      .from(moderationEvents)
      .where(and(eq(moderationEvents.siteId, siteId), gte(moderationEvents.occurredAt, windowStart)))
      .groupBy(moderationEvents.action)
      .orderBy(desc(count())),
  ])

  const seriesRows = await db.execute<{
    day: string
    comments: number
    visible: number
    hidden: number
    votesUp: number
    votesDown: number
  }>(sql`
    with days as (
      select generate_series(
        date_trunc('day', now() - ((${days} - 1) * interval '1 day')),
        date_trunc('day', now()),
        interval '1 day'
      ) as day
    ),
    comment_days as (
      select date_trunc('day', c.created_at) as day,
        count(*)::int as comments,
        count(*) filter (where c.status = 'visible')::int as visible,
        count(*) filter (where c.status = 'hidden')::int as hidden
      from comments c
      where c.site_id = ${siteId} and c.created_at >= (select min(day) from days)
      group by 1
    ),
    vote_days as (
      select date_trunc('day', v.created_at) as day,
        count(*) filter (where v.value = 1)::int as up,
        count(*) filter (where v.value = -1)::int as down
      from votes v
      join comments c on c.id = v.comment_id
      where c.site_id = ${siteId} and v.created_at >= (select min(day) from days)
      group by 1
    )
    select to_char(days.day, 'YYYY-MM-DD') as day,
      coalesce(comment_days.comments, 0)::int as comments,
      coalesce(comment_days.visible, 0)::int as visible,
      coalesce(comment_days.hidden, 0)::int as hidden,
      coalesce(vote_days.up, 0)::int as "votesUp",
      coalesce(vote_days.down, 0)::int as "votesDown"
    from days
    left join comment_days on comment_days.day = days.day
    left join vote_days on vote_days.day = days.day
    order by days.day
  `)

  const series = seriesRows.map((row) => ({
    day: row.day,
    comments: Number(row.comments),
    visible: Number(row.visible),
    hidden: Number(row.hidden),
    votesUp: Number(row.votesUp),
    votesDown: Number(row.votesDown),
  }))

  const commentTotalsRow = commentTotals[0]
  return {
    totals: {
      comments: Number(commentTotalsRow?.comments ?? 0),
      visible: Number(commentTotalsRow?.visible ?? 0),
      hidden: Number(commentTotalsRow?.hidden ?? 0),
      deleted: Number(commentTotalsRow?.deleted ?? 0),
      pages: Number(pageTotals[0]?.pages ?? 0),
      votesUp: Number(voteTotals[0]?.votesUp ?? 0),
      votesDown: Number(voteTotals[0]?.votesDown ?? 0),
      blockedUsers: Number(blockTotals[0]?.blockedUsers ?? 0),
    },
    window: {
      days,
      start: series[0]?.day ?? windowStart.toISOString().slice(0, 10),
      comments: series.reduce((sum, row) => sum + row.comments, 0),
      votesUp: series.reduce((sum, row) => sum + row.votesUp, 0),
      votesDown: series.reduce((sum, row) => sum + row.votesDown, 0),
    },
    series,
    topPages: topPages.map((row) => ({
      pageId: row.pageId,
      title: row.title,
      canonicalUrl: row.canonicalUrl,
      total: Number(row.total),
    })),
    moderationActions: moderationActions.map((row) => ({
      action: row.action,
      count: Number(row.count),
    })),
  }
}

export type PageThreadStats = {
  totals: {
    comments: number
    visible: number
    hidden: number
    deleted: number
    votesUp: number
    votesDown: number
    replies: number
    pinned: number
    participants: number
  }
  window: { days: number; start: string; comments: number; votesUp: number; votesDown: number }
  series: {
    day: string
    comments: number
    visible: number
    hidden: number
    votesUp: number
    votesDown: number
  }[]
  topAuthors: { authorName: string; total: number }[]
  moderationActions: { action: string; count: number }[]
  firstAt: Date | null
}

export type PageThreadDetail = {
  siteName: string
  // The effective comment limit for this site (the stored value, or the default).
  bodyLimit: number
  page: ModerationPageSummary
  stats: PageThreadStats
}

// One thread of one site: the page summary plus its own aggregates. The
// page is always addressed inside the site, so a page id from another site
// is a 404 here and never leaks its rows.
export async function getPageThread(
  siteId: string,
  pageId: string,
  days: 7 | 30 | 90,
  db: Db = getBusinessDb(),
): Promise<PageThreadDetail> {
  const [site] = await db
    .select({ name: sites.name, bodyLimit: sites.bodyLimit })
    .from(sites)
    .where(eq(sites.id, siteId))
    .limit(1)
  if (!site) throw new HttpError(ErrorCode.SITE_NOT_FOUND.status, ErrorCode.SITE_NOT_FOUND.code, 'Site was not found')

  const [page] = await listModerationPages(siteId, { pageId }, db)
  if (!page) throw new HttpError(ErrorCode.PAGE_NOT_FOUND.status, ErrorCode.PAGE_NOT_FOUND.code, 'Page was not found')

  const now = new Date()
  const windowStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - (days - 1)))

  const [totalRows, voteRows, topAuthors, moderationActions] = await Promise.all([
    db
      .select({
        comments: count(comments.id),
        visible: sql<number>`count(*) filter (where ${comments.status} = 'visible')`,
        hidden: sql<number>`count(*) filter (where ${comments.status} = 'hidden')`,
        deleted: sql<number>`count(*) filter (where ${comments.status} = 'deleted')`,
        replies: sql<number>`count(*) filter (where ${comments.parentId} is not null)`,
        pinned: sql<number>`count(*) filter (where ${comments.pinnedAt} is not null)`,
        // A guest has no user id, so the author name identifies them.
        participants: sql<number>`count(distinct coalesce(${comments.userId}, 'guest:' || ${comments.authorName}))`,
        firstAt: sql<Date | null>`min(${comments.createdAt})`,
      })
      .from(comments)
      .where(eq(comments.pageId, pageId)),
    db
      .select({
        votesUp: sql<number>`count(*) filter (where ${votes.value} = 1)`,
        votesDown: sql<number>`count(*) filter (where ${votes.value} = -1)`,
      })
      .from(votes)
      .innerJoin(comments, eq(votes.commentId, comments.id))
      .where(eq(comments.pageId, pageId)),
    db
      .select({ authorName: comments.authorName, total: count(comments.id) })
      .from(comments)
      .where(
        and(
          eq(comments.pageId, pageId),
          inArray(comments.status, ['visible', 'hidden']),
          gte(comments.createdAt, windowStart),
        ),
      )
      .groupBy(comments.authorName)
      .orderBy(desc(count(comments.id)))
      .limit(5),
    // Page events plus the events of the thread's own comments. User blocks
    // are not page-attributable, so they never appear here.
    db
      .select({ action: moderationEvents.action, count: count() })
      .from(moderationEvents)
      .where(
        and(
          eq(moderationEvents.siteId, siteId),
          gte(moderationEvents.occurredAt, windowStart),
          sql`(${moderationEvents.targetType} = 'page' and ${moderationEvents.targetId} = ${pageId}) or (${moderationEvents.targetType} = 'comment' and ${moderationEvents.targetId} in (select ${comments.id}::text from ${comments} where ${comments.pageId} = ${pageId}))`,
        ),
      )
      .groupBy(moderationEvents.action)
      .orderBy(desc(count())),
  ])

  // The same day spine as the site stats, narrowed to this page.
  const seriesRows = await db.execute<{
    day: string
    comments: number
    visible: number
    hidden: number
    votesUp: number
    votesDown: number
  }>(sql`
    with days as (
      select generate_series(
        date_trunc('day', now() - ((${days} - 1) * interval '1 day')),
        date_trunc('day', now()),
        interval '1 day'
      ) as day
    ),
    comment_days as (
      select date_trunc('day', c.created_at) as day,
        count(*)::int as comments,
        count(*) filter (where c.status = 'visible')::int as visible,
        count(*) filter (where c.status = 'hidden')::int as hidden
      from comments c
      where c.page_id = ${pageId} and c.created_at >= (select min(day) from days)
      group by 1
    ),
    vote_days as (
      select date_trunc('day', v.created_at) as day,
        count(*) filter (where v.value = 1)::int as up,
        count(*) filter (where v.value = -1)::int as down
      from votes v
      join comments c on c.id = v.comment_id
      where c.page_id = ${pageId} and v.created_at >= (select min(day) from days)
      group by 1
    )
    select to_char(days.day, 'YYYY-MM-DD') as day,
      coalesce(comment_days.comments, 0)::int as comments,
      coalesce(comment_days.visible, 0)::int as visible,
      coalesce(comment_days.hidden, 0)::int as hidden,
      coalesce(vote_days.up, 0)::int as "votesUp",
      coalesce(vote_days.down, 0)::int as "votesDown"
    from days
    left join comment_days on comment_days.day = days.day
    left join vote_days on vote_days.day = days.day
    order by days.day
  `)

  const series = seriesRows.map((row) => ({
    day: row.day,
    comments: Number(row.comments),
    visible: Number(row.visible),
    hidden: Number(row.hidden),
    votesUp: Number(row.votesUp),
    votesDown: Number(row.votesDown),
  }))

  const totals = totalRows[0]
  return {
    siteName: site.name,
    bodyLimit: resolveBodyLimit(site.bodyLimit),
    page,
    stats: {
      totals: {
        comments: Number(totals?.comments ?? 0),
        visible: Number(totals?.visible ?? 0),
        hidden: Number(totals?.hidden ?? 0),
        deleted: Number(totals?.deleted ?? 0),
        votesUp: Number(voteRows[0]?.votesUp ?? 0),
        votesDown: Number(voteRows[0]?.votesDown ?? 0),
        replies: Number(totals?.replies ?? 0),
        pinned: Number(totals?.pinned ?? 0),
        participants: Number(totals?.participants ?? 0),
      },
      window: {
        days,
        start: series[0]?.day ?? windowStart.toISOString().slice(0, 10),
        comments: series.reduce((sum, row) => sum + row.comments, 0),
        votesUp: series.reduce((sum, row) => sum + row.votesUp, 0),
        votesDown: series.reduce((sum, row) => sum + row.votesDown, 0),
      },
      series,
      topAuthors: topAuthors.map((row) => ({
        authorName: row.authorName,
        total: Number(row.total),
      })),
      moderationActions: moderationActions.map((row) => ({
        action: row.action,
        count: Number(row.count),
      })),
      firstAt: totals?.firstAt ?? null,
    },
  }
}
