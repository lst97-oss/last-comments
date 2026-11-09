import { and, asc, count, eq, inArray, lte, ne, notExists, sql } from 'drizzle-orm'

import { getBusinessDb } from '@/server/db/business-sql'
import { pluginDeliveries, pluginEvents } from '@/server/db/schema'
import { getRequestLogger } from '@/server/observability/logger'
import { type CommentEventType, getCommentPlugins, PluginFailure } from '@/server/plugins/comment-plugins'
import { withTimeout } from '@/server/plugins/with-timeout'

export const MAX_ATTEMPTS = 8
export const HANDLER_TIMEOUT_MS = 30_000
export const BATCH_SIZE = 20
// A claim must outlive a full batch of sends, which run one after another. A shorter lease lets a second
// worker claim rows this worker is still sending, so they go out twice.
export const DELIVERY_LEASE_MS = BATCH_SIZE * HANDLER_TIMEOUT_MS + 60_000
// Delivered events stay this long for audit, then go with their delivery rows.
const EVENT_RETENTION_MS = 30 * 86_400_000
const logger = getRequestLogger().child({ component: 'plugin-delivery' })

export function getPluginRetryDelayMs(attempt: number): number {
  return Math.min(1_000 * 2 ** Math.max(0, attempt - 1), 3_600_000)
}

// A permanent failure (a wrong key) is retried slowly: a fixed configuration is still picked up, without a fast loop.
export const PERMANENT_RETRY_DELAY_MS = 15 * 60_000

// What a failed handler does next: the status, the code kept on the row, and the wait before the next attempt.
export function planRetry(
  error: unknown,
  attempts: number,
): { status: 'pending' | 'dead_letter'; lastError: string; delayMs: number } {
  const exhausted = attempts >= MAX_ATTEMPTS
  if (error instanceof Error && error.message === 'PLUGIN_NOT_REGISTERED') {
    return { status: 'dead_letter', lastError: 'PLUGIN_NOT_REGISTERED', delayMs: getPluginRetryDelayMs(attempts) }
  }
  if (error instanceof PluginFailure && !error.retryable) {
    return {
      status: exhausted ? 'dead_letter' : 'pending',
      lastError: error.code,
      delayMs: PERMANENT_RETRY_DELAY_MS,
    }
  }
  return {
    status: exhausted ? 'dead_letter' : 'pending',
    lastError: 'PLUGIN_HANDLER_ERROR',
    delayMs: getPluginRetryDelayMs(attempts),
  }
}

// Outbox rows are written only for plugins with an event subscription and a handler.
export function hasOutboxSubscribers(plugins = getCommentPlugins()): boolean {
  return plugins.some((plugin) => Boolean(plugin.handleEvent) && (plugin.events?.length ?? 0) > 0)
}

export async function deliverPendingPluginEvents(
  db = getBusinessDb(),
  now = new Date(),
  stop?: AbortSignal,
): Promise<number> {
  // One locked claim per batch: SKIP LOCKED means two workers never take the same row, and the lease
  // (next_attempt_at) moves forward in the same write. A crashed worker's rows come due again.
  const claimed = await db
    .update(pluginDeliveries)
    .set({
      status: 'processing',
      attempts: sql`${pluginDeliveries.attempts} + 1`,
      nextAttemptAt: new Date(now.getTime() + DELIVERY_LEASE_MS),
    })
    .where(
      inArray(
        pluginDeliveries.id,
        db
          .select({ id: pluginDeliveries.id })
          .from(pluginDeliveries)
          .where(
            and(inArray(pluginDeliveries.status, ['pending', 'processing']), lte(pluginDeliveries.nextAttemptAt, now)),
          )
          .orderBy(asc(pluginDeliveries.nextAttemptAt))
          .limit(BATCH_SIZE)
          .for('update', { skipLocked: true }),
      ),
    )
    .returning({
      deliveryId: pluginDeliveries.id,
      pluginId: pluginDeliveries.pluginId,
      attempts: pluginDeliveries.attempts,
      eventId: pluginDeliveries.eventId,
    })
  if (claimed.length === 0) return 0

  const events = await db
    .select()
    .from(pluginEvents)
    .where(
      inArray(
        pluginEvents.id,
        claimed.map((delivery) => delivery.eventId),
      ),
    )
  const eventById = new Map(events.map((event) => [event.id, event]))

  let processed = 0
  for (const [index, delivery] of claimed.entries()) {
    if (stop?.aborted) {
      // Shutdown: hand the unsent rest of the claim back now, not after the lease runs out. The claim
      // counted as an attempt that never ran, so undo that too.
      await db
        .update(pluginDeliveries)
        .set({ status: 'pending', nextAttemptAt: now, attempts: sql`${pluginDeliveries.attempts} - 1` })
        .where(
          inArray(
            pluginDeliveries.id,
            claimed.slice(index).map((row) => row.deliveryId),
          ),
        )
      logger.info('shutdown.handed_back', { count: claimed.length - index })
      break
    }
    const event = eventById.get(delivery.eventId)
    if (!event) continue
    processed += 1
    const plugin = getCommentPlugins().find((candidate) => candidate.id === delivery.pluginId)
    const eventType = event.eventType as CommentEventType
    try {
      if (!plugin?.handleEvent || !plugin.events?.includes(eventType)) {
        throw new Error('PLUGIN_NOT_REGISTERED')
      }
      const handleEvent = plugin.handleEvent.bind(plugin)
      await withTimeout(
        HANDLER_TIMEOUT_MS,
        (signal) =>
          handleEvent({
            id: event.id,
            siteId: event.siteId,
            type: eventType,
            apiVersion: 1,
            aggregateId: event.aggregateId,
            occurredAt: event.occurredAt.toISOString(),
            payload: event.payload,
            signal,
          }),
        () => new Error('PLUGIN_HANDLER_TIMEOUT'),
      )
      await db
        .update(pluginDeliveries)
        .set({ status: 'delivered', deliveredAt: new Date(), lastError: null })
        .where(eq(pluginDeliveries.id, delivery.deliveryId))
    } catch (error) {
      const plan = planRetry(error, delivery.attempts)
      await db
        .update(pluginDeliveries)
        .set({
          status: plan.status,
          nextAttemptAt: new Date(now.getTime() + plan.delayMs),
          lastError: plan.lastError,
        })
        .where(eq(pluginDeliveries.id, delivery.deliveryId))
      logger.warn('plugin.delivery.failed', {
        pluginId: delivery.pluginId,
        eventType,
        attempt: delivery.attempts,
        status: plan.status,
        code: plan.lastError,
      })
    }
  }
  return processed
}

// Rows the worker still owes or has parked, per plugin and status, for the worker's status line.
// shortcut: unindexed count over plugin_deliveries on each status line, fine while the table is small; add a partial index on status when it grows.
export function countPluginQueue(db = getBusinessDb()) {
  return db
    .select({ pluginId: pluginDeliveries.pluginId, status: pluginDeliveries.status, count: count() })
    .from(pluginDeliveries)
    .where(inArray(pluginDeliveries.status, ['pending', 'processing', 'dead_letter']))
    .groupBy(pluginDeliveries.pluginId, pluginDeliveries.status)
}

// Removes events whose every delivery finished, once they are older than the retention window.
// Events with a pending or dead-letter delivery stay, so a retry or an investigation still has them.
export async function purgeDeliveredPluginEvents(db = getBusinessDb(), now = new Date()): Promise<number> {
  const removed = await db
    .delete(pluginEvents)
    .where(
      and(
        lte(pluginEvents.occurredAt, new Date(now.getTime() - EVENT_RETENTION_MS)),
        notExists(
          db
            .select({ id: pluginDeliveries.id })
            .from(pluginDeliveries)
            .where(and(eq(pluginDeliveries.eventId, pluginEvents.id), ne(pluginDeliveries.status, 'delivered'))),
        ),
      ),
    )
    .returning({ id: pluginEvents.id })
  return removed.length
}
