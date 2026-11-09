import { closeBusinessSql, getBusinessDb } from '@/server/db/business-sql'
import { getRequestLogger } from '@/server/observability/logger'
import { type CommentPlugin, getCommentPlugins } from '@/server/plugins/comment-plugins'
import {
  BATCH_SIZE,
  countPluginQueue,
  DELIVERY_LEASE_MS,
  deliverPendingPluginEvents,
  HANDLER_TIMEOUT_MS,
  hasOutboxSubscribers,
  MAX_ATTEMPTS,
  purgeDeliveredPluginEvents,
} from '@/server/plugins/plugin-delivery'

const logger = getRequestLogger().child({ component: 'plugin-worker' })
// Without a subscribing plugin the outbox never fills, so a 1s poll only keeps
// Neon's compute awake: drain leftovers once, then wait for a signal instead.
const polling = hasOutboxSubscribers()
const POLL_MS = 1_000
const IDLE_MS = 2 ** 31 - 1 // setTimeout's maximum delay
const MAX_BACKOFF_MS = 60_000
let stopping = false
// Aborted by a stop signal: the send in flight finishes, the unsent rest of the batch is handed back.
const stopController = new AbortController()
let wake = () => {}
let stoppedAt = 0
const stop = (signal: string) => {
  stoppedAt = performance.now()
  logger.info('shutdown.signal', { signal })
  stopping = true
  stopController.abort()
  wake()
}
process.on('SIGINT', () => stop('SIGINT'))
process.on('SIGTERM', () => stop('SIGTERM'))

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
// The status line is one count query, so it runs every five minutes. The first one runs after the first pass.
const STATUS_EVERY_MS = 300_000
let lastStatus = 0
const startedAt = Date.now()
// Deliveries this process handled since the last status line.
let handled = 0
// Consecutive failed passes. Each one waits longer, so an outage logs once per backoff step, not once a second.
let failures = 0
// Each failed pass waits twice as long as the one before, up to a minute.
const backoffMs = (failedPasses: number) => Math.min(POLL_MS * 2 ** failedPasses, MAX_BACKOFF_MS)

// Which hooks a plugin implements, so the startup line shows what it does without reading its source.
const HOOKS = ['validateComment', 'screenComment', 'beforeOperation', 'handleEvent'] as const
function hooksOf(plugin: CommentPlugin): string[] {
  return HOOKS.filter((hook) => typeof plugin[hook] === 'function')
}

logger.info('plugin.worker.started', {
  polling,
  pollMs: POLL_MS,
  batchSize: BATCH_SIZE,
  maxAttempts: MAX_ATTEMPTS,
  handlerTimeoutMs: HANDLER_TIMEOUT_MS,
  leaseMs: DELIVERY_LEASE_MS,
  purgeEveryMs: PURGE_EVERY_MS,
  statusEveryMs: STATUS_EVERY_MS,
})
// One line per installed plugin. Every plugin loads in the app too; only `handleEvent` runs here.
for (const plugin of getCommentPlugins()) {
  logger.info('plugin.loaded', { id: plugin.id, events: plugin.events ?? [], hooks: hooksOf(plugin) })
}

while (!stopping) {
  try {
    handled += await deliverPendingPluginEvents(getBusinessDb(), new Date(), stopController.signal)
    failures = 0
    if (Date.now() - lastPurge >= PURGE_EVERY_MS) {
      lastPurge = Date.now()
      await purgeDeliveredPluginEvents()
    }
    if (Date.now() - lastStatus >= STATUS_EVERY_MS) {
      lastStatus = Date.now()
      logger.info('plugin.worker.status', {
        uptimeMs: Date.now() - startedAt,
        handledSinceLast: handled,
        queue: await countPluginQueue(),
      })
      handled = 0
    }
  } catch (error) {
    failures += 1
    logger.error('plugin.worker.poll_failed', { failures, retryInMs: backoffMs(failures), error })
  }
  const pauseMs = failures > 0 ? backoffMs(failures) : polling ? POLL_MS : IDLE_MS
  if (!stopping) await pause(pauseMs)
}

logger.info('plugin.worker.stopped')
await closeBusinessSql()
logger.info('shutdown.drained', { durationMs: Math.round(performance.now() - stoppedAt) })
logger.info('shutdown.exit', { code: 0 })
