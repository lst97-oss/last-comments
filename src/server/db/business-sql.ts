import { SQL } from 'bun'
import { drizzle } from 'drizzle-orm/bun-sql'

import { getBusinessEnv } from '@/server/config/business-env'
import * as schema from '@/server/db/schema'

// Lazy business Postgres client on Bun's native SQL driver — see AGENTS.md.
// Bun-only: never import from the Payload Node-CLI graph. Drizzle factory
// path verified against installed drizzle-orm@0.45.2 ("./bun-sql" export).

// node-postgres reads `sslmode=no-verify` as "TLS, skip certificate checks";
// Bun SQL rejects that value and spells the same mode `require`. Rewriting it
// keeps one URL valid for Payload's pg pool and this Bun client alike.
const NO_VERIFY_SSL_MODE = /([?&])sslmode=no-verify(?=&|#|$)/gi

export function toBunSqlUrl(connectionString: string): string {
  return connectionString.replace(NO_VERIFY_SSL_MODE, '$1sslmode=require')
}

let sql: SQL | null = null

export function getBusinessSql(): SQL {
  if (!sql) {
    // Bun keeps idle connections open forever, and each one holds a Postgres backend on Neon.
    sql = new SQL(toBunSqlUrl(getBusinessEnv().connectionString), { idleTimeout: 60 })
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
