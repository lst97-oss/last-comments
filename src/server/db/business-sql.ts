import { SQL } from 'bun'
import { drizzle } from 'drizzle-orm/bun-sql'

import { getBusinessEnv } from '@/server/config/business-env'
import * as schema from '@/server/db/schema'

// Lazy business Postgres client on Bun's native SQL driver — see AGENTS.md.
// Bun-only: never import from the Payload Node-CLI graph. Drizzle factory
// path verified against installed drizzle-orm@0.45.2 ("./bun-sql" export).

let sql: SQL | null = null

export function getBusinessSql(): SQL {
  if (!sql) {
    sql = new SQL(getBusinessEnv().connectionString)
  }
  return sql
}

export async function closeBusinessSql(): Promise<void> {
  if (!sql) return
  const closing = sql
  sql = null
  await closing.close()
}

export function getBusinessDb() {
  return drizzle(getBusinessSql(), { schema })
}
