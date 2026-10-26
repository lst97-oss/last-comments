import { pluginDeliveries, pluginEvents } from '@/server/db/schema'
import type { Db } from '@/server/modules/comments/infrastructure/comment-types'
import { type CommentEventType, getCommentPlugins, subscribedPlugins } from '@/server/plugins/comment-plugins'

export async function enqueuePluginEvent(
  tx: Parameters<Parameters<Db['transaction']>[0]>[0],
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
