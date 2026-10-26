import { and, asc, eq, inArray, lte, ne, notExists, sql } from 'drizzle-orm'

import { getBusinessDb } from '@/server/db/business-sql'
import { pluginDeliveries, pluginEvents } from '@/server/db/schema'
import { getRequestLogger } from '@/server/observability/logger'
import { type CommentEventType, getCommentPlugins } from '@/server/plugins/comment-plugins'

const MAX_ATTEMPTS = 8
const DELIVERY_LEASE_MS = 60_000
const HANDLER_TIMEOUT_MS = 30_000
const BATCH_SIZE = 20
// Delivered events stay this long for audit, then go with their delivery rows.
const EVENT_RETENTION_MS = 30 * 86_400_000
const logger = getRequestLogger().child({ component: 'plugin-delivery' })

export function getPluginRetryDelayMs(attempt: number): number {
  return Math.min(1_000 * 2 ** Math.max(0, attempt - 1), 3_600_000)
}

// Outbox rows are written only for plugins with an event subscription and a handler.
export function hasOutboxSubscribers(plugins = getCommentPlugins()): boolean {
  return plugins.some((plugin) => Boolean(plugin.handleEvent) && (plugin.events?.length ?? 0) > 0)
}

export async function deliverPendingPluginEvents(db = getBusinessDb(), now = new Date()): Promise<number> {
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
  for (const delivery of claimed) {
    const event = eventById.get(delivery.eventId)
    if (!event) continue
    processed += 1
    const plugin = getCommentPlugins().find((candidate) => candidate.id === delivery.pluginId)
    const eventType = event.eventType as CommentEventType
    try {
      if (!plugin?.handleEvent || !plugin.events?.includes(eventType)) {
        throw new Error('PLUGIN_NOT_REGISTERED')
      }
      const controller = new AbortController()
      let timer: ReturnType<typeof setTimeout> | undefined
      try {
        await Promise.race([
          plugin.handleEvent({
            id: event.id,
            siteId: event.siteId,
            type: eventType,
            apiVersion: 1,
            aggregateId: event.aggregateId,
            occurredAt: event.occurredAt.toISOString(),
            payload: event.payload,
            signal: controller.signal,
          }),
          new Promise<never>((_, reject) => {
            timer = setTimeout(() => {
              controller.abort()
              reject(new Error('PLUGIN_HANDLER_TIMEOUT'))
            }, HANDLER_TIMEOUT_MS)
          }),
        ])
      } finally {
        if (timer) clearTimeout(timer)
      }
      await db
        .update(pluginDeliveries)
        .set({ status: 'delivered', deliveredAt: new Date(), lastError: null })
        .where(eq(pluginDeliveries.id, delivery.deliveryId))
    } catch (error) {
      const missingPlugin = error instanceof Error && error.message === 'PLUGIN_NOT_REGISTERED'
      const exhausted = delivery.attempts >= MAX_ATTEMPTS
      const status = missingPlugin || exhausted ? 'dead_letter' : 'pending'
      const lastError = missingPlugin ? 'PLUGIN_NOT_REGISTERED' : 'PLUGIN_HANDLER_ERROR'
      await db
        .update(pluginDeliveries)
        .set({
          status,
          nextAttemptAt: new Date(now.getTime() + getPluginRetryDelayMs(delivery.attempts)),
          lastError,
        })
        .where(eq(pluginDeliveries.id, delivery.deliveryId))
      logger.warn('plugin.delivery.failed', {
        pluginId: delivery.pluginId,
        eventType,
        attempt: delivery.attempts,
        status,
        code: lastError,
      })
    }
  }
  return processed
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
