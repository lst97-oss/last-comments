import { closeBusinessSql, getBusinessSql } from '@/server/db/business-sql'
import {
  getSiteId,
  getSiteStats,
  listModerationComments,
  listModerationTakedowns,
  listPageComments,
  listSiteUsers,
} from '@/server/modules/comments/infrastructure/comment-repository'
import { assertLocalBusinessTarget } from '../business-target'
import { BENCH_SITE_KEY } from './load-fixture'

// Read-only timing of the comment queries the DB plan will change. Run after
// `bun run db:seed:load`. It calls the repository functions themselves, so the
// numbers are what the app pays, not a hand-copied approximation of the SQL.
// Usage: bun run db:bench:comments [--runs=7]
const RUNS = Number(Bun.argv.find((arg) => arg.startsWith('--runs='))?.slice('--runs='.length) ?? 7)
const HOT_URL = 'https://bench.invalid/hot'
const SMALL_URL = 'https://bench.invalid/page-1'

assertLocalBusinessTarget()
const sql = getBusinessSql()

type Case = { name: string; run: (siteId: string) => Promise<unknown> }

const cases: Case[] = [
  {
    name: 'public list, hot thread, first page',
    run: () => listPageComments(BENCH_SITE_KEY, HOT_URL, { limit: 20, offset: 0 }),
  },
  {
    name: 'public list, hot thread, deep offset 60000',
    run: () => listPageComments(BENCH_SITE_KEY, HOT_URL, { limit: 20, offset: 60_000 }),
  },
  {
    name: 'public list, small thread',
    run: () => listPageComments(BENCH_SITE_KEY, SMALL_URL, { limit: 20, offset: 0 }),
  },
  {
    name: 'moderation, newest 50',
    run: (siteId) => listModerationComments(siteId, { limit: 50, offset: 0 }),
  },
  {
    name: 'moderation, hidden only',
    run: (siteId) => listModerationComments(siteId, { status: 'hidden', limit: 50, offset: 0 }),
  },
  {
    name: 'takedowns, all time',
    run: (siteId) => listModerationTakedowns(siteId, { recentDays: 0, limit: 50, offset: 0 }),
  },
  { name: 'site stats, 90 days', run: (siteId) => getSiteStats(siteId, 90) },
  { name: 'users tab, first 50', run: (siteId) => listSiteUsers(siteId, { limit: 50, offset: 0 }) },
]

function time(fn: () => Promise<unknown>): Promise<number> {
  const started = performance.now()
  return fn().then(() => performance.now() - started)
}

async function main() {
  const siteId = await getSiteId(BENCH_SITE_KEY).catch(() => {
    throw new Error(`${BENCH_SITE_KEY} is missing; run bun run db:seed:load first`)
  })

  console.log(`runs per case: ${RUNS} (one warm-up run is discarded)`)
  console.log('case'.padEnd(46) + 'min ms'.padStart(10) + 'median ms'.padStart(12))
  for (const testCase of cases) {
    await testCase.run(siteId) // warm-up
    const samples: number[] = []
    for (let run = 0; run < RUNS; run += 1) samples.push(await time(() => testCase.run(siteId)))
    samples.sort((a, b) => a - b)
    const median = samples[Math.floor(samples.length / 2)]!
    console.log(testCase.name.padEnd(46) + samples[0]!.toFixed(1).padStart(10) + median.toFixed(1).padStart(12))
  }

  // Cumulative since the last statistics reset, so read it as a usage snapshot.
  const usage = await sql`
    select relname, indexrelname, idx_scan::int as scans
    from pg_stat_user_indexes
    where relname in ('comments', 'votes', 'pages')
    order by relname, indexrelname
  `
  console.log('\nindex usage (cumulative since stats reset):')
  for (const row of usage) console.log(`  ${row.relname}.${row.indexrelname}: ${row.scans}`)
}

try {
  await main()
} catch (error) {
  console.error(error instanceof Error ? error.message : error)
  process.exitCode = 1
} finally {
  await closeBusinessSql()
}
