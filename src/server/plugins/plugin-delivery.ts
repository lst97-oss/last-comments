import { and, asc, eq, inArray, lte, sql } from 'drizzle-orm'

import { getBusinessDb } from '@/server/db/business-sql'
import { pluginDeliveries, pluginEvents } from '@/server/db/schema'
import { getRequestLogger } from '@/server/observability/logger'
import { type CommentEventType, getCommentPlugins } from '@/server/plugins/comment-plugins'

const MAX_ATTEMPTS = 8
const DELIVERY_LEASE_MS = 60_000
const HANDLER_TIMEOUT_MS = 30_000
const logger = getRequestLogger().child({ component: 'plugin-delivery' })

export function getPluginRetryDelayMs(attempt: number): number {
  return Math.min(1_000 * 2 ** Math.max(0, attempt - 1), 3_600_000)
}

export async function deliverPendingPluginEvents(db = getBusinessDb(), now = new Date()): Promise<number> {
  const due = await db
    .select({
      deliveryId: pluginDeliveries.id,
      pluginId: pluginDeliveries.pluginId,
      attempts: pluginDeliveries.attempts,
      eventId: pluginEvents.id,
      siteId: pluginEvents.siteId,
      eventType: pluginEvents.eventType,
      apiVersion: pluginEvents.apiVersion,
      aggregateId: pluginEvents.aggregateId,
      payload: pluginEvents.payload,
      occurredAt: pluginEvents.occurredAt,
    })
    .from(pluginDeliveries)
    .innerJoin(pluginEvents, eq(pluginDeliveries.eventId, pluginEvents.id))
    .where(and(inArray(pluginDeliveries.status, ['pending', 'processing']), lte(pluginDeliveries.nextAttemptAt, now)))
    .orderBy(asc(pluginDeliveries.nextAttemptAt))
    .limit(20)

  let processed = 0
  for (const delivery of due) {
    const [claimed] = await db
      .update(pluginDeliveries)
      .set({
        status: 'processing',
        attempts: sql`${pluginDeliveries.attempts} + 1`,
        nextAttemptAt: new Date(now.getTime() + DELIVERY_LEASE_MS),
      })
      .where(
        and(
          eq(pluginDeliveries.id, delivery.deliveryId),
          inArray(pluginDeliveries.status, ['pending', 'processing']),
          lte(pluginDeliveries.nextAttemptAt, now),
        ),
      )
      .returning({ attempts: pluginDeliveries.attempts })
    if (!claimed) continue

    processed += 1
    const plugin = getCommentPlugins().find((candidate) => candidate.id === delivery.pluginId)
    const eventType = delivery.eventType as CommentEventType
    try {
      if (!plugin?.handleEvent || !plugin.events?.includes(eventType)) {
        throw new Error('PLUGIN_NOT_REGISTERED')
      }
      const controller = new AbortController()
      let timer: ReturnType<typeof setTimeout> | undefined
      try {
        await Promise.race([
          plugin.handleEvent({
            id: delivery.eventId,
            siteId: delivery.siteId,
            type: eventType,
            apiVersion: 1,
            aggregateId: delivery.aggregateId,
            occurredAt: delivery.occurredAt.toISOString(),
            payload: delivery.payload,
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
      const exhausted = claimed.attempts >= MAX_ATTEMPTS
      const status = missingPlugin || exhausted ? 'dead_letter' : 'pending'
      const lastError = missingPlugin ? 'PLUGIN_NOT_REGISTERED' : 'PLUGIN_HANDLER_ERROR'
      await db
        .update(pluginDeliveries)
        .set({
          status,
          nextAttemptAt: new Date(now.getTime() + getPluginRetryDelayMs(claimed.attempts)),
          lastError,
        })
        .where(eq(pluginDeliveries.id, delivery.deliveryId))
      logger.warn('plugin.delivery.failed', {
        pluginId: delivery.pluginId,
        eventType,
        attempt: claimed.attempts,
        status,
        code: lastError,
      })
    }
  }
  return processed
}
