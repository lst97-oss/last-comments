import { closeBusinessSql, getBusinessSql } from '@/server/db/business-sql'
import { assertLocalBusinessTarget } from './business-target'

// Refreshes the local business database: drops every schema the business migrations own, then applies
// the migrations from empty. It deletes all business data, so it runs only against a local database
// and only with --confirm. Usage: bun run db:business:reset -- --confirm
if (!Bun.argv.includes('--confirm')) {
  console.error('This deletes every business record in the local database. Re-run with --confirm.')
  process.exit(1)
}
assertLocalBusinessTarget()

// The migrator's journal lives in the drizzle schemas, so they go with the data. Left behind, the
// migrations would look applied and nothing would be created.
const DROPS = [
  'DROP SCHEMA IF EXISTS public CASCADE',
  'CREATE SCHEMA public',
  'DROP SCHEMA IF EXISTS drizzle CASCADE',
  'DROP SCHEMA IF EXISTS drizzle_rate_limit CASCADE',
  'DROP SCHEMA IF EXISTS comment_rate_limit CASCADE',
]

const sql = getBusinessSql()
try {
  await sql.begin(async (tx) => {
    for (const statement of DROPS) await tx.unsafe(statement)
  })
  console.log('business schemas dropped')
} finally {
  await closeBusinessSql()
}

const migrate = Bun.spawn(['bun', new URL('./migrate-business.ts', import.meta.url).pathname], {
  stdout: 'inherit',
  stderr: 'inherit',
})
const code = await migrate.exited
if (code !== 0) throw new Error(`migrations failed with exit code ${code}`)
console.log('business database refreshed')
