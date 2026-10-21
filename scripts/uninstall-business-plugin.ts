import { sql } from 'drizzle-orm'

import { closeBusinessSql, getBusinessDb } from '@/server/db/business-sql'

const pluginId = Bun.argv[2]
if (pluginId !== 'rate-limit') {
  throw new Error('Usage: bun scripts/uninstall-business-plugin.ts rate-limit')
}

try {
  const db = getBusinessDb()
  await db.execute(sql`DROP SCHEMA IF EXISTS comment_rate_limit CASCADE`)
  await db.execute(sql`DROP SCHEMA IF EXISTS drizzle_rate_limit CASCADE`)
} finally {
  await closeBusinessSql()
}
