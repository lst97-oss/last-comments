import config from '@payload-config'
import { eq } from 'drizzle-orm'
import { getPayload } from 'payload'

import { closeBusinessSql, getBusinessDb } from '@/server/db/business-sql'
import { siteOrigins, sites } from '@/server/db/schema'
import { upsertPage } from '@/server/modules/comments/infrastructure/comment-repository'

// Idempotent blog-site seeder: recreates the `BLOG_SITE_KEY` site, its allowed
// origins, and one comment thread per published post. Re-running updates the
// same rows — never duplicates. Recovery for an empty business database, which
// otherwise surfaces as 403 ORIGIN_NOT_ALLOWED ("Origin is not allowed") on
// every comment request that carries an Origin header.
// Usage: bun run db:seed:blog-site [--dry-run]
const DRY_RUN = Bun.argv.includes('--dry-run')

const siteKey = (process.env.BLOG_SITE_KEY ?? '').trim()
const serverUrl = (process.env.PAYLOAD_PUBLIC_SERVER_URL ?? '').trim()
if (!siteKey) throw new Error('BLOG_SITE_KEY is not set')
if (!serverUrl) throw new Error('PAYLOAD_PUBLIC_SERVER_URL is not set')

// Browsers send Origin on cross-origin reads and on every POST, so the origin
// the blog is actually served from must be allow-listed. Local dev flips
// between `localhost` and `127.0.0.1`, which are the same loopback interface —
// register both twins so either URL works.
function blogSiteOrigins(url: string): string[] {
  const origin = new URL(url).origin
  const twin = origin.includes('localhost') ? origin.replace('localhost', '127.0.0.1') : null
  return twin && twin !== origin ? [origin, twin] : [origin]
}

const origins = blogSiteOrigins(serverUrl)

const payload = await getPayload({ config })
try {
  const { docs } = await payload.find({
    collection: 'posts',
    depth: 0,
    limit: 100,
    where: { and: [{ status: { equals: 'published' } }, { publishedAt: { less_than_equal: new Date() } }] },
  })
  const posts = docs.map((doc) => doc as unknown as { slug: string; title: string })

  if (DRY_RUN) {
    console.log(`[dry-run] would ensure site key=${JSON.stringify(siteKey)} origins=${JSON.stringify(origins)}`)
    for (const post of posts) console.log(`[dry-run] would ensure thread pageKey=${post.slug}`)
    process.exit(0)
  }

  const db = getBusinessDb()
  await db.insert(sites).values({ key: siteKey, name: 'Last Comments Blog' }).onConflictDoNothing()
  const [site] = await db.select({ id: sites.id }).from(sites).where(eq(sites.key, siteKey))
  if (!site) throw new Error(`Site row missing after upsert: ${siteKey}`)
  for (const origin of origins) {
    await db.insert(siteOrigins).values({ siteId: site.id, origin }).onConflictDoNothing()
    console.log(`Ensured origin ${origin} for site ${siteKey}`)
  }

  for (const post of posts) {
    // Same entry point as the publish hook and the page-side safety net, so
    // seeded threads are identical to runtime-created ones.
    const page = await upsertPage(siteKey, {
      url: `${serverUrl.replace(/\/$/, '')}/blog/${post.slug}`,
      pageKey: post.slug,
      title: post.title,
    })
    console.log(`Ensured thread pageKey=${post.slug} id=${page.id}`)
  }
} finally {
  await payload.db?.destroy?.()
  await closeBusinessSql()
}
