import { migrate } from 'drizzle-orm/bun-sql/migrator'

import { closeBusinessSql, getBusinessDb } from '@/server/db/business-sql'
import { getCommentPlugins } from '@/server/plugins/comment-plugins'

try {
  const db = getBusinessDb()
  await migrate(db, { migrationsFolder: 'drizzle/business' })
  for (const plugin of getCommentPlugins()) {
    if (plugin.migrations) {
      await migrate(db, {
        migrationsFolder: plugin.migrations.folder,
        migrationsSchema: plugin.migrations.schema,
      })
    }
  }
} finally {
  await closeBusinessSql()
}
