import config from '@payload-config'
import { getPayload } from 'payload'

// Idempotent blog seeder: upserts scripts/seeds/*.md into the `posts`
// collection by `slug`. Re-running updates the same row — never duplicates.
// Usage: bun run db:seed [--dry-run]
const DRY_RUN = Bun.argv.includes('--dry-run')

const POSTS = [
  {
    slug: 'introducing-last-comments',
    title: 'Introducing last-comments: self-hosted comments for any site',
    description:
      'What last-comments is, what ships in the box, how threads flow from embed to moderation, and where the project is headed.',
    file: 'introducing-last-comments.md',
    tags: [{ value: 'announcement' }, { value: 'self-hosted' }, { value: 'comments' }],
    authorName: 'last-comments',
  },
] as const

const seedsDir = import.meta.dir

async function loadBody(file: string): Promise<string> {
  const path = `${seedsDir}/${file}`
  const content = await Bun.file(path).text()
  if (!content.trim()) throw new Error(`Seed body is empty: ${path}`)
  return content
}

if (DRY_RUN) {
  for (const post of POSTS) {
    const body = await loadBody(post.file)
    console.log(
      `[dry-run] would upsert slug=${post.slug} title=${JSON.stringify(post.title)} body=${body.length} chars`,
    )
  }
  process.exit(0)
}

const payload = await getPayload({ config })
try {
  for (const post of POSTS) {
    const content = await loadBody(post.file)
    const existing = await payload.find({
      collection: 'posts',
      overrideAccess: true,
      limit: 1,
      where: { slug: { equals: post.slug } },
    })
    const data = {
      title: post.title,
      slug: post.slug,
      description: post.description,
      content,
      status: 'published' as const,
      publishedAt: new Date().toISOString(),
      tags: [...post.tags],
      authorName: post.authorName,
    }
    const row = existing.docs[0]
    if (row) {
      await payload.update({ collection: 'posts', id: row.id, overrideAccess: true, data })
      console.log(`Updated post slug=${post.slug} id=${row.id}`)
    } else {
      const created = await payload.create({ collection: 'posts', overrideAccess: true, data })
      console.log(`Created post slug=${post.slug} id=${created.id}`)
    }
  }
} finally {
  await payload.db?.destroy?.()
}
