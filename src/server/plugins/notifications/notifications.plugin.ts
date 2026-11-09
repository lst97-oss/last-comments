import {
  ApiError,
  createNotificationsClient,
  type NotificationsClient,
} from '@lst97-oss/last-notifications-widgets/server'

import {
  type CommentEventType,
  type CommentPlugin,
  type CommentPluginEvent,
  PluginFailure,
} from '@/server/plugins/comment-plugins'
import {
  getNotificationsPluginSettings,
  type NotificationEventKind,
  type ResolvedNotificationsConfig,
} from '@/server/plugins/notifications/notifications.config'
import { formatNotification, type NotificationKind } from '@/server/plugins/notifications/notifications.format'
import {
  createNotificationsRepository,
  type NotificationsRepository,
  type Recipient,
} from '@/server/plugins/notifications/notifications.repository'

type Events = Record<NotificationEventKind, boolean>

// Only the event types an enabled kind needs are subscribed, so a disabled event writes no outbox row.
export function subscribedEventTypes(events: Events): CommentEventType[] {
  const types = new Set<CommentEventType>()
  if (events.created || events.heldForReview) types.add('comment.created')
  if (events.heldForReview) types.add('comment.edited')
  if (events.hidden) types.add('comment.hidden')
  if (events.deleted) types.add('comment.deleted')
  if (events.pageReacted) types.add('page.reacted')
  return [...types]
}

// The admin notice an event should produce, or null when that kind is switched off. Auto-hides arrive as
// comment.created / comment.edited with autoHidden set, so they are held-for-review, not hidden.
export function classifyEvent(event: CommentPluginEvent, events: Events): NotificationKind | null {
  const { payload } = event
  switch (event.type) {
    case 'comment.created':
      if (payload.autoHidden === true) return events.heldForReview ? 'held' : null
      return events.created ? 'created' : null
    case 'comment.edited':
      return payload.autoHidden === true && events.heldForReview ? 'held' : null
    case 'comment.hidden':
      return events.hidden ? 'hidden' : null
    case 'comment.deleted':
      return events.deleted ? 'deleted' : null
    case 'page.reacted':
      return events.pageReacted ? 'reacted' : null
    default:
      return null
  }
}

export type NotificationsPluginDeps = {
  settings?: ResolvedNotificationsConfig
  client?: NotificationsClient
  repository?: NotificationsRepository
}

// Built on first use, so a misconfigured key never fails the process at import.
function clientFor(settings: ResolvedNotificationsConfig): NotificationsClient | undefined {
  const { baseUrl, appKey, apiKey } = settings
  if (!settings.enabled || !baseUrl || !appKey || !apiKey) return undefined
  return createNotificationsClient({ baseUrl, appKey, apiKey })
}

export function createNotificationsPlugin(deps: NotificationsPluginDeps = {}): CommentPlugin {
  const settings = deps.settings ?? getNotificationsPluginSettings()
  const repository = deps.repository ?? createNotificationsRepository()
  let client = deps.client
  const events = settings.enabled ? subscribedEventTypes(settings.events) : []

  return {
    id: 'notifications',
    apiVersion: 1,
    events,
    async handleEvent(event) {
      const kind = classifyEvent(event, settings.events)
      if (!kind) return
      client ??= clientFor(settings)
      const publisher = client
      if (!publisher) return

      const payload = event.payload
      const commentId = typeof payload.commentId === 'string' ? payload.commentId : undefined
      let pageId: string
      let pageUrl: string
      let authorName: string | undefined
      let bodyMarkdown: string | undefined
      // A reaction is one notice per admin per page per window. Only the first reaction in a window sends it: a
      // later one skips the publish calls, which the server would drop as duplicates anyway.
      const occurredAt = new Date(event.occurredAt)
      const windowMs = settings.reactionWindowMinutes * 60_000
      const bucket = Math.floor(occurredAt.getTime() / windowMs)
      if (kind === 'reacted') {
        if (typeof payload.pageId !== 'string' || typeof payload.pageUrl !== 'string') return
        pageId = payload.pageId
        pageUrl = payload.pageUrl
        const earlier = await repository.hasEarlierReactionNotice(
          event.siteId,
          pageId,
          new Date(bucket * windowMs),
          occurredAt,
        )
        if (earlier) return
      } else {
        if (!commentId) return
        const context = await repository.loadCommentContext(commentId)
        if (!context) return
        // A created or held notice carries the comment's text. A comment deleted before its event was sent
        // must not send that text, so the notice is dropped.
        if (context.status === 'deleted' && (kind === 'created' || kind === 'held')) return
        ;({ pageId, pageUrl, authorName, bodyMarkdown } = context)
      }

      // The actor is excluded: nobody is notified about their own action. Author and guest deletes always carry
      // a userId key (null for a guest). Moderator events never do, so only they read the actor from the audit log.
      let actor: string | null = null
      if ('userId' in payload) actor = typeof payload.userId === 'string' ? payload.userId : null
      else if (commentId && (kind === 'hidden' || kind === 'deleted'))
        actor = await repository.loadModerationActor(commentId)
      const recipients = (await repository.loadRecipients(event.siteId)).filter((r) => r.userId !== actor)
      if (recipients.length === 0) return
      const siteKey = await repository.loadSiteKey(event.siteId)
      if (!siteKey) return

      const reasons = Array.isArray(payload.reasons)
        ? payload.reasons.filter((reason): reason is string => typeof reason === 'string')
        : undefined
      const formatted = formatNotification({
        kind,
        siteKey,
        pageId,
        pageUrl,
        siteId: event.siteId,
        ...(commentId ? { commentId } : {}),
        ...(authorName ? { authorName } : {}),
        ...(bodyMarkdown ? { bodyMarkdown } : {}),
        ...(reasons ? { reasons } : {}),
        ...(typeof payload.emoji === 'string' ? { emoji: payload.emoji } : {}),
      })

      // A reaction is one notice per admin per page per window: its key buckets the time, so a burst of
      // reactions is one notification and a retry of the same event is a duplicate. Other events key on
      // the stored event id, so each event notifies once per recipient.
      const keyFor = (recipient: Recipient) =>
        kind === 'reacted' ? `page.reacted:${pageId}:${recipient.userId}:${bucket}` : `${event.id}:${recipient.userId}`

      const results = await Promise.allSettled(
        recipients.map((recipient) =>
          publisher.publish({
            recipientKey: recipient.userId,
            type: formatted.type,
            title: formatted.title,
            body: formatted.body,
            priority: formatted.priority,
            data: formatted.data,
            channels: settings.channels,
            dedupeKey: keyFor(recipient),
            ...(settings.channels.includes('email') && recipient.email ? { email: recipient.email } : {}),
          }),
        ),
      )
      // Any failure makes the outbox retry the whole event; the dedupe keys make the retry safe. The first upstream code
      // is kept, and the failure is permanent only when every reason is one a retry cannot fix (a wrong key).
      const failures: unknown[] = results.flatMap((result) => (result.status === 'rejected' ? [result.reason] : []))
      if (failures.length === 0) return
      const first = failures[0]
      const permanent = failures.every((reason) => reason instanceof ApiError && !reason.retryable)
      throw new PluginFailure(
        first instanceof ApiError ? first.code : 'PUBLISH_FAILED',
        `notifications: ${failures.length} of ${results.length} publishes failed`,
        !permanent,
      )
    },
  }
}

export const notificationsPlugin = createNotificationsPlugin()
