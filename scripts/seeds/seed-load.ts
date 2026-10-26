import { closeBusinessSql, getBusinessSql } from '@/server/db/business-sql'
import { assertLocalBusinessTarget } from '../business-target'
import { BENCH_SITE_KEY, BENCH_USER_COUNT } from './load-fixture'

// Dev-only load fixture for the comment query benchmark: one site with roughly
// 275k comments, 140k votes and 500 users. One busy thread is deliberately large,
// because deep offset paging and the moderation lists read it the way a real
// busy thread would be read. Local business database only.
// Usage: bun run db:seed:load            (add the fixture)
//        bun run db:seed:load -- --reset (remove it again)
const RESET = Bun.argv.includes('--reset')
const BENCH_ORIGIN = 'https://bench.invalid'

const THREADS = [
  { slug: 'hot', roots: 30_000, total: 80_000 },
  ...Array.from({ length: 39 }, (_, index) => ({ slug: `page-${index + 1}`, roots: 2_000, total: 5_000 })),
]

assertLocalBusinessTarget()
const sql = getBusinessSql()

try {
  await sql.begin(async (tx) => {
    if (RESET) {
      await tx`delete from sites where key = ${BENCH_SITE_KEY}`
      await tx`delete from "user" where email like '%@bench.invalid'`
      console.log('fixture removed')
      return
    }
    const [existing] = await tx`select id from sites where key = ${BENCH_SITE_KEY}`
    if (existing) throw new Error(`${BENCH_SITE_KEY} already exists; run with --reset first`)

    await tx`
      insert into "user" (id, name, email)
      select 'bench-user-' || g::text, 'Bench user ' || g::text, 'bench-' || g::text || '@bench.invalid'
      from generate_series(0, ${BENCH_USER_COUNT - 1}::int) g
    `
    const [site] = await tx`insert into sites (key, name) values (${BENCH_SITE_KEY}, 'Benchmark site') returning id`
    await tx`insert into site_origins (site_id, origin) values (${site.id}, ${BENCH_ORIGIN})`

    for (const thread of THREADS) {
      const prefix = `bench-${thread.slug}-`
      const [page] = await tx`
        insert into pages (site_id, canonical_url, title)
        values (${site.id}, ${`${BENCH_ORIGIN}/${thread.slug}`}, ${`Bench ${thread.slug}`})
        returning id
      `
      // Roots first, then replies whose parent is a root on the same page (the
      // composite parent FK requires it). Ids are derived from the row number, so
      // a reply can name its parent without a lookup.
      await tx`
        insert into comments (id, site_id, page_id, parent_id, user_id, author_name, body_markdown, status, deleted_at, created_at, updated_at)
        select id, ${site.id}::uuid, ${page.id}::uuid, null, user_id, author_name, body_markdown, status,
          case when status = 'deleted' then created_at end, created_at, created_at
        from (
          select md5(${prefix}::text || g::text)::uuid as id,
            case when random() < 0.3 then 'bench-user-' || floor(random() * 500)::int::text end as user_id,
            'Bench ' || g::text as author_name,
            'Bench comment ' || g::text || ' with some **markdown** and \`code\`.' as body_markdown,
            (case when random() < 0.03 then 'hidden' when random() < 0.02 then 'deleted' else 'visible' end)::comment_status as status,
            now() - random() * interval '365 days' as created_at
          from generate_series(1, ${thread.roots}::int) g
        ) roots
      `
      await tx`
        insert into comments (id, site_id, page_id, parent_id, user_id, author_name, body_markdown, status, deleted_at, created_at, updated_at)
        select id, ${site.id}::uuid, ${page.id}::uuid, parent_id, user_id, author_name, body_markdown, status,
          case when status = 'deleted' then created_at end, created_at, created_at
        from (
          select md5(${prefix}::text || g::text)::uuid as id,
            md5(${prefix}::text || (1 + (g - 1) % ${thread.roots}::int)::text)::uuid as parent_id,
            case when random() < 0.3 then 'bench-user-' || floor(random() * 500)::int::text end as user_id,
            'Bench ' || g::text as author_name,
            'Bench reply ' || g::text || ' with some **markdown**.' as body_markdown,
            (case when random() < 0.03 then 'hidden' when random() < 0.02 then 'deleted' else 'visible' end)::comment_status as status,
            now() - random() * interval '365 days' as created_at
          from generate_series(${thread.roots + 1}::int, ${thread.total}::int) g
        ) replies
      `
    }

    await tx`
      insert into votes (comment_id, user_id, value)
      select c.id, 'bench-user-' || floor(random() * 500)::int::text,
        case when random() < 0.7 then 1 else -1 end
      from comments c
      join pages p on p.id = c.page_id
      where p.site_id = ${site.id}::uuid and random() < 0.5
      on conflict do nothing
    `

    // A bulk load leaves no planner statistics, and the plan then misjudges the thread. Analyze so the
    // benchmark reads a database that autovacuum would have analyzed.
    for (const table of ['sites', 'pages', 'comments', 'votes', 'site_memberships', '"user"']) {
      await tx.unsafe(`analyze ${table}`)
    }
    const [counts] = await tx`
      select
        (select count(*)::int from pages p where p.site_id = ${site.id}::uuid) as pages,
        (select count(*)::int from comments c join pages p on p.id = c.page_id where p.site_id = ${site.id}::uuid) as comments,
        (select count(*)::int from votes v join comments c on c.id = v.comment_id join pages p on p.id = c.page_id
          where p.site_id = ${site.id}::uuid) as votes
    `
    console.log(`fixture ${BENCH_SITE_KEY}: ${counts.pages} pages, ${counts.comments} comments, ${counts.votes} votes`)
  })
} catch (error) {
  console.error(error instanceof Error ? error.message : error)
  process.exitCode = 1
} finally {
  await closeBusinessSql()
}
