import { closeBusinessSql } from '@/server/db/business-sql'
import { getRequestLogger } from '@/server/observability/logger'
import {
  deliverPendingPluginEvents,
  hasOutboxSubscribers,
  purgeDeliveredPluginEvents,
} from '@/server/plugins/plugin-delivery'

const logger = getRequestLogger().child({ component: 'plugin-worker' })
// Without a subscribing plugin the outbox never fills, so a 1s poll only keeps
// Neon's compute awake: drain leftovers once, then wait for a signal instead.
const polling = hasOutboxSubscribers()
const IDLE_MS = 2 ** 31 - 1 // setTimeout's maximum delay
let stopping = false
let wake = () => {}
const stop = () => {
  stopping = true
  wake()
}
process.on('SIGINT', stop)
process.on('SIGTERM', stop)

// Sleeps for `ms`, or returns early when a stop signal arrives.
function pause(ms: number): Promise<void> {
  return new Promise((resolve) => {
    const timer = setTimeout(resolve, ms)
    wake = () => {
      clearTimeout(timer)
      resolve()
    }
  })
}

// Retention runs at most hourly, and only as part of a delivery pass, so no second scheduler is needed.
const PURGE_EVERY_MS = 3_600_000
let lastPurge = 0

while (!stopping) {
  try {
    await deliverPendingPluginEvents()
    if (Date.now() - lastPurge >= PURGE_EVERY_MS) {
      lastPurge = Date.now()
      await purgeDeliveredPluginEvents()
    }
  } catch {
    logger.error('plugin.worker.poll_failed')
  }
  if (!stopping) await pause(polling ? 1_000 : IDLE_MS)
}

await closeBusinessSql()
