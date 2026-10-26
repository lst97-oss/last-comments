import { and, eq } from 'drizzle-orm'
import { getBusinessDb } from '@/server/db/business-sql'
import { pages, siteOrigins } from '@/server/db/schema'
import { ErrorCode, HttpError } from '@/server/http/errors'
import { normalizePageKey, normalizePageUrl } from '@/server/modules/comments/domain/comment'
import { getSiteId } from '@/server/modules/comments/infrastructure/comment-sites'
import type { Db, Transaction } from '@/server/modules/comments/infrastructure/comment-types'

// Thread identity lives here so comment creation and the publisher API
// (POST /api/admin/pages) cannot drift: a slug names the thread and the URL
// follows it, while URL-only threads stay bound to their exact URL.
export async function resolvePage(
  tx: Transaction,
  input: { siteId: string; pageUrl: string; pageKey?: string; title?: string },
): Promise<string> {
  const { siteId, pageUrl, pageKey } = input
  const title = input.title?.trim() || null
  let pageId: string
  if (pageKey === undefined) {
    await tx
      .insert(pages)
      .values({ siteId, canonicalUrl: pageUrl, title })
      .onConflictDoNothing({ target: [pages.siteId, pages.canonicalUrl] })
    const [urlPage] = await tx
      .select({ id: pages.id })
      .from(pages)
      .where(and(eq(pages.siteId, siteId), eq(pages.canonicalUrl, pageUrl)))
      .limit(1)
    pageId = urlPage.id
  } else {
    const [keyThread] = await tx
      .select({ id: pages.id })
      .from(pages)
      .where(and(eq(pages.siteId, siteId), eq(pages.pageKey, pageKey)))
      .limit(1)
    const [urlThread] = await tx
      .select({ id: pages.id, pageKey: pages.pageKey })
      .from(pages)
      .where(and(eq(pages.siteId, siteId), eq(pages.canonicalUrl, pageUrl)))
      .limit(1)
    if (keyThread && urlThread && keyThread.id !== urlThread.id) {
      throw new HttpError(
        ErrorCode.PAGE_KEY_MISMATCH.status,
        ErrorCode.PAGE_KEY_MISMATCH.code,
        'This page key belongs to a different thread',
      )
    }
    if (keyThread && urlThread) {
      if (title !== null) {
        await tx.update(pages).set({ title }).where(eq(pages.id, keyThread.id))
      }
      pageId = keyThread.id
    } else if (keyThread) {
      // Known slug on a new URL — the page moved; the thread keeps its id.
      await tx
        .update(pages)
        .set({ canonicalUrl: pageUrl, ...(title !== null ? { title } : {}) })
        .where(eq(pages.id, keyThread.id))
      pageId = keyThread.id
    } else if (urlThread) {
      // Existing URL thread gaining its first slug — claim it, never merge threads.
      if (urlThread.pageKey !== null) {
        throw new HttpError(
          ErrorCode.PAGE_KEY_MISMATCH.status,
          ErrorCode.PAGE_KEY_MISMATCH.code,
          'This URL already belongs to a different page key',
        )
      }
      await tx
        .update(pages)
        .set({ pageKey, ...(title !== null ? { title } : {}) })
        .where(eq(pages.id, urlThread.id))
      pageId = urlThread.id
    } else {
      const [inserted] = await tx
        .insert(pages)
        .values({ siteId, canonicalUrl: pageUrl, pageKey, title })
        .returning({ id: pages.id })
      pageId = inserted.id
    }
  }
  return pageId
}

export type SitePage = {
  id: string
  canonicalUrl: string
  pageKey: string | null
  title: string | null
  isLocked: boolean
}

// Publisher entry point (POST /api/admin/pages): registering the same thread
// twice is idempotent — same slug + URL, or the same URL, returns the same
// thread id — and conflicts keep the comment path's PAGE_KEY_MISMATCH codes.
export async function upsertPage(
  siteKey: string,
  input: { url: string; pageKey?: string; title?: string },
  db: Db = getBusinessDb(),
): Promise<SitePage> {
  const siteId = await getSiteId(siteKey, db)
  const pageUrl = normalizePageUrl(input.url)
  // Pages belong to the site's own origins: the dashboard shows the allowed
  // origin read-only and the comment API only accepts callers from them.
  const allowed = await db
    .select({ origin: siteOrigins.origin })
    .from(siteOrigins)
    .where(eq(siteOrigins.siteId, siteId))
  const urlOrigin = new URL(pageUrl).origin
  if (!allowed.some((row) => row.origin === urlOrigin)) {
    const list = allowed.map((row) => row.origin).join(', ') || 'none configured'
    throw new HttpError(
      ErrorCode.PAGE_ORIGIN_NOT_ALLOWED.status,
      ErrorCode.PAGE_ORIGIN_NOT_ALLOWED.code,
      `Page URL must use an allowed site origin: ${list}`,
    )
  }
  const pageKey = input.pageKey === undefined ? undefined : normalizePageKey(input.pageKey)
  const pageId = await db.transaction((tx) =>
    resolvePage(tx, { siteId, pageUrl, pageKey, ...(input.title === undefined ? {} : { title: input.title }) }),
  )
  const [page] = await db
    .select({
      id: pages.id,
      canonicalUrl: pages.canonicalUrl,
      pageKey: pages.pageKey,
      title: pages.title,
      isLocked: pages.isLocked,
    })
    .from(pages)
    .where(and(eq(pages.siteId, siteId), eq(pages.id, pageId)))
    .limit(1)
  if (!page)
    throw new HttpError(ErrorCode.PAGE_UNAVAILABLE.status, ErrorCode.PAGE_UNAVAILABLE.code, 'Page is unavailable')
  return page
}
