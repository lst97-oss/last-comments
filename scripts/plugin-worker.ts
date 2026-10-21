import { closeBusinessSql } from '@/server/db/business-sql'
import { getRequestLogger } from '@/server/observability/logger'
import { deliverPendingPluginEvents } from '@/server/plugins/plugin-delivery'

const logger = getRequestLogger().child({ component: 'plugin-worker' })
let stopping = false
process.on('SIGINT', () => {
  stopping = true
})
process.on('SIGTERM', () => {
  stopping = true
})

while (!stopping) {
  try {
    await deliverPendingPluginEvents()
  } catch {
    logger.error('plugin.worker.poll_failed')
  }
  if (!stopping) await Bun.sleep(1_000)
}

await closeBusinessSql()
