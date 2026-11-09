import { and, eq, inArray, type SQL } from 'drizzle-orm'
import { pluginDeliveries, pluginEvents } from '@/server/db/schema'
import type { Db } from '@/server/modules/comments/infrastructure/comment-types'
import { type CommentEventType, getCommentPlugins, subscribedPlugins } from '@/server/plugins/comment-plugins'

type OutboxTransaction = Parameters<Parameters<Db['transaction']>[0]>[0]

export async function enqueuePluginEvent(
  tx: OutboxTransaction,
  event: { siteId: string; type: CommentEventType; aggregateId: string; payload: Record<string, unknown> },
) {
  const plugins = subscribedPlugins(event.type, getCommentPlugins())
  if (plugins.length === 0) return
  const [stored] = await tx
    .insert(pluginEvents)
    .values({ siteId: event.siteId, eventType: event.type, aggregateId: event.aggregateId, payload: event.payload })
    .returning({ id: pluginEvents.id })
  await tx.insert(pluginDeliveries).values(plugins.map((plugin) => ({ eventId: stored.id, pluginId: plugin.id })))
}

// Strips the text a removed comment left in the event log. Its created and edited events carry the body and
// the author name; the rows stay, so delivery and audit still see that the event happened.
export async function scrubCommentEventText(tx: OutboxTransaction, aggregateIds: SQL) {
  const events = await tx
    .select({ id: pluginEvents.id, payload: pluginEvents.payload })
    .from(pluginEvents)
    .where(and(aggregateIds, inArray(pluginEvents.eventType, ['comment.created', 'comment.edited'])))
  // Done in code, not with a jsonb operator: the driver stores these payloads as JSON strings, which jsonb
  // operators reject, and the object read back here is what the rest of the outbox already works with.
  // shortcut: one UPDATE per event, so deleting a page with thousands of comments runs thousands of queries.
  // Batch these once a page delete takes more than a few seconds.
  for (const event of events) {
    const { bodyMarkdown: _bodyMarkdown, authorName: _authorName, ...rest } = event.payload
    await tx.update(pluginEvents).set({ payload: rest }).where(eq(pluginEvents.id, event.id))
  }
}
