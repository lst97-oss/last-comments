import { and, eq } from 'drizzle-orm'

import { closeBusinessSql, getBusinessDb } from '@/server/db/business-sql'
import { comments, pages } from '@/server/db/schema'
import { getSiteId, upsertPage } from '@/server/modules/comments/infrastructure/comment-repository'

// Idempotent demo-comment seeder: adds a small guest thread to the seeded
// "Introducing last-comments" post. Every row carries a fixed id, so a second
// run hits the primary key and changes nothing — it never duplicates.
// Requires the blog site to exist (bun run db:seed:blog-site).
// Usage: bun run db:seed:demo-comments [--dry-run]
const DRY_RUN = Bun.argv.includes('--dry-run')

const siteKey = (process.env.BLOG_SITE_KEY ?? '').trim()
const serverUrl = (process.env.PAYLOAD_PUBLIC_SERVER_URL ?? '').trim()
if (!siteKey) throw new Error('BLOG_SITE_KEY is not set')
if (!serverUrl) throw new Error('PAYLOAD_PUBLIC_SERVER_URL is not set')

const POST_SLUG = 'introducing-last-comments'
const POST_TITLE = 'Introducing last-comments: self-hosted comments for any site'
const postUrl = `${serverUrl.replace(/\/$/, '')}/blog/${POST_SLUG}`

const HOUR = 3_600_000

// Fixed ids make the seed idempotent; `parentId` wires the replies.
const DEMO_COMMENTS = [
  {
    id: '1af6b708-ddb8-4f5d-bfd2-e09e7e06be77',
    parentId: null,
    authorName: 'Ada',
    hoursAgo: 30,
    bodyMarkdown: [
      'Moved my blog over to this. The thing I kept waiting for was **comments that live next to the data** —',
      'no third-party script, no cookie banner for a comment box. The `POST /api/comments` shape is small',
      'enough to read in one sitting.',
    ].join(' '),
  },
  {
    id: '37462545-0f3c-481f-bca8-70d620556082',
    parentId: '1af6b708-ddb8-4f5d-bfd2-e09e7e06be77',
    authorName: 'Ben',
    hoursAgo: 29,
    bodyMarkdown: [
      'Same here. The publisher key with `pages:write` is the part that sold me: the thread is registered',
      'when the post publishes, so the first reader never owns the thread.',
    ].join(' '),
  },
  {
    id: 'a23365f3-7f22-4b83-b3b0-cf6aa70afbb1',
    parentId: null,
    authorName: 'Chidi',
    hoursAgo: 22,
    bodyMarkdown: 'Does the moderation dashboard cover several sites? I run a docs site and a blog on one instance.',
  },
  {
    id: 'a8707861-cc79-4299-bf48-8b9a9bcf3fc1',
    parentId: 'a23365f3-7f22-4b83-b3b0-cf6aa70afbb1',
    authorName: 'Dara',
    hoursAgo: 6,
    bodyMarkdown: [
      'Yes — sites are rows in the business database and `/moderation` scopes to the site key.',
      'Instance keys keep `sites:*` for the admin API.',
    ].join(' '),
  },
  {
    id: 'd93a2fed-ef18-41be-9fd3-1a6c272437f6',
    parentId: 'a8707861-cc79-4299-bf48-8b9a9bcf3fc1',
    authorName: 'Erin',
    hoursAgo: 5,
    bodyMarkdown: 'Worth adding to the docs then — I only found the site scoping in the README.',
  },
  {
    id: '97485151-317a-4cab-a7c7-c36e67b43fc9',
    parentId: null,
    authorName: 'Fat',
    hoursAgo: 2,
    bodyMarkdown: [
      'Ran the whole thing on a Raspberry Pi behind a tunnel:',
      '',
      '```bash',
      'bun run db:migrate',
      'bun run db:business:migrate',
      'bun run dev',
      '```',
      '',
      'Everyone posts with a Turnstile token, signed-in authors can edit any time, and it all lands in one',
      'Postgres database.',
    ].join('\n'),
  },
] as const

const db = getBusinessDb()
try {
  // The site is the seed's anchor: fail with the fix, not a 404 stack.
  const siteId = await getSiteId(siteKey, db).catch(() => {
    throw new Error(
      `Site ${siteKey} is not in the business database — run bun run db:seed:blog-site first (BLOG_SITE_KEY=${siteKey})`,
    )
  })
  if (DRY_RUN) {
    const [existing] = await db
      .select({ id: pages.id, canonicalUrl: pages.canonicalUrl })
      .from(pages)
      .where(and(eq(pages.siteId, siteId), eq(pages.pageKey, POST_SLUG)))
      .limit(1)
    console.log(
      `[dry-run] would ensure thread pageKey=${POST_SLUG} url=${postUrl} (${existing ? `exists ${existing.id}` : 'missing'})`,
    )
    for (const comment of DEMO_COMMENTS) {
      console.log(`[dry-run] would insert comment ${comment.id} by ${comment.authorName}`)
    }
    process.exit(0)
  }

  // Same entry point as the publish hook and the blog-site seeder, so the
  // seeded thread is identical to a runtime-created one.
  const page = await upsertPage(siteKey, { url: postUrl, pageKey: POST_SLUG, title: POST_TITLE }, db)
  const now = Date.now()
  const inserted = await db
    .insert(comments)
    .values(
      DEMO_COMMENTS.map((comment) => ({
        id: comment.id,
        siteId,
        pageId: page.id,
        parentId: comment.parentId,
        userId: null,
        authorName: comment.authorName,
        bodyMarkdown: comment.bodyMarkdown,
        status: 'visible' as const,
        editKeyHash: null,
        createdAt: new Date(now - comment.hoursAgo * HOUR),
        updatedAt: new Date(now - comment.hoursAgo * HOUR),
      })),
    )
    .onConflictDoNothing()
    .returning({ id: comments.id })

  console.log(`Seeded ${inserted.length} demo comment(s) on pageKey=${POST_SLUG} (page ${page.id})`)
  for (const comment of DEMO_COMMENTS) {
    const firstLine = comment.bodyMarkdown.split('\n')[0] ?? ''
    console.log(` - ${comment.authorName}: ${firstLine.slice(0, 70)}`)
  }
} finally {
  await closeBusinessSql()
}
