import { describe, expect, test } from 'bun:test'
import { ApiError } from '@lst97-oss/last-notifications-widgets/server'

import type { CommentPluginEvent } from '@/server/plugins/comment-plugins'
import {
  classifyEvent,
  createNotificationsPlugin,
  subscribedEventTypes,
} from '@/server/plugins/notifications/notifications.plugin'
import {
  getNotificationsPluginSettings,
  type ResolvedNotificationsConfig,
} from '@/server/plugins/notifications/notifications.config'
import type { NotificationsRepository } from '@/server/plugins/notifications/notifications.repository'

const ALL_ON = { created: true, heldForReview: true, hidden: true, deleted: true, pageReacted: true }
const DEFAULTS = { created: true, heldForReview: true, hidden: true, deleted: true, pageReacted: false }

const settings = (over: Partial<ResolvedNotificationsConfig> = {}): ResolvedNotificationsConfig => ({
  enabled: true,
  missing: [],
  baseUrl: 'http://notify.test',
  publicUrl: 'http://notify.test',
  appKey: 'app-1',
  apiKey: 'lnk_test_0123456789abcdef',
  events: DEFAULTS,
  reactionWindowMinutes: 30,
  channels: ['inapp'],
  ...over,
})

function event(type: CommentPluginEvent['type'], payload: Record<string, unknown>, id = 'evt-1'): CommentPluginEvent {
  return {
    id,
    siteId: 'site-1',
    type,
    apiVersion: 1,
    aggregateId: 'agg-1',
    occurredAt: '2026-10-29T12:05:00.000Z',
    payload,
    signal: new AbortController().signal,
  }
}

const repository = (over: Partial<NotificationsRepository> = {}): NotificationsRepository => ({
  loadRecipients: async () => [
    { userId: 'site-admin', email: 'site@x.test' },
    { userId: 'instance-admin', email: 'root@x.test' },
  ],
  loadCommentContext: async () => ({
    pageId: 'page-1',
    pageUrl: 'https://blog.test/post',
    authorName: 'Guest',
    bodyMarkdown: 'Nice **post**!',
    status: 'visible',
  }),
  loadModerationActor: async () => null,
  loadSiteKey: async () => 'site-key-1',
  hasEarlierReactionNotice: async () => false,
  ...over,
})

function recordingClient() {
  const published: Array<{ recipientKey: string; dedupeKey?: string; type: string; email?: string }> = []
  return {
    published,
    client: {
      publish: async (input: { recipientKey: string; dedupeKey?: string; type: string; email?: string }) => {
        published.push(input)
        return { id: 'n', duplicate: false, channels: ['inapp'] as const }
      },
      mintRecipientToken: async () => ({ token: 'lrt_x', expiresAt: '' }),
      setContact: async () => ({}),
      setPreference: async () => ({}),
    } as never,
  }
}

describe('subscribed event types', () => {
  test('the defaults subscribe to created, held, hidden and deleted, but not reactions', () => {
    expect([...subscribedEventTypes(DEFAULTS)].sort()).toEqual([
      'comment.created',
      'comment.deleted',
      'comment.edited',
      'comment.hidden',
    ])
    expect(subscribedEventTypes(DEFAULTS)).not.toContain('page.reacted')
  })

  test('turning every event off subscribes to nothing', () => {
    expect(
      subscribedEventTypes({
        ...ALL_ON,
        created: false,
        heldForReview: false,
        hidden: false,
        deleted: false,
        pageReacted: false,
      }),
    ).toEqual([])
  })
})

describe('classifying events', () => {
  test('an auto-hidden create is held for review, not a plain create', () => {
    expect(classifyEvent(event('comment.created', { autoHidden: true }), ALL_ON)).toBe('held')
    expect(classifyEvent(event('comment.created', {}), ALL_ON)).toBe('created')
  })

  test('an edit notifies only when it hides the comment', () => {
    expect(classifyEvent(event('comment.edited', { autoHidden: true }), ALL_ON)).toBe('held')
    expect(classifyEvent(event('comment.edited', {}), ALL_ON)).toBeNull()
  })

  test('a switched-off kind classifies to nothing', () => {
    expect(classifyEvent(event('comment.deleted', {}), { ...ALL_ON, deleted: false })).toBeNull()
    expect(classifyEvent(event('page.reacted', {}), DEFAULTS)).toBeNull()
  })
})

describe('the plugin', () => {
  test('a disabled plugin subscribes to nothing and publishes nothing', async () => {
    const plugin = createNotificationsPlugin({ settings: settings({ enabled: false }), repository: repository() })
    expect(plugin.events).toEqual([])
  })

  test('a new comment notifies every admin except its author', async () => {
    const { client, published } = recordingClient()
    const plugin = createNotificationsPlugin({ settings: settings(), client, repository: repository() })
    await plugin.handleEvent?.(event('comment.created', { commentId: 'c-1', userId: 'site-admin' }))
    expect(published.map((p) => p.recipientKey)).toEqual(['instance-admin'])
    expect(published[0]).toMatchObject({ type: 'comment.created', dedupeKey: 'evt-1:instance-admin' })
  })

  test('a moderator hide tells the other admins, using the audit log for the actor', async () => {
    const { client, published } = recordingClient()
    const plugin = createNotificationsPlugin({
      settings: settings(),
      client,
      repository: repository({ loadModerationActor: async () => 'instance-admin' }),
    })
    await plugin.handleEvent?.(event('comment.hidden', { commentId: 'c-1', action: 'hide' }))
    expect(published.map((p) => p.recipientKey)).toEqual(['site-admin'])
  })

  test('a reaction is one notice per admin per window, keyed by the time bucket', async () => {
    const { client, published } = recordingClient()
    const plugin = createNotificationsPlugin({
      settings: settings({ events: { ...DEFAULTS, pageReacted: true } }),
      client,
      repository: repository(),
    })
    const reaction = event('page.reacted', { pageId: 'page-1', pageUrl: '/post', userId: 'reactor', emoji: '👍' })
    await plugin.handleEvent?.(reaction)
    await plugin.handleEvent?.({ ...reaction, id: 'evt-2' })
    expect(published.map((p) => p.dedupeKey)).toEqual([
      'page.reacted:page-1:site-admin:' + Math.floor(Date.parse(reaction.occurredAt) / (30 * 60_000)),
      'page.reacted:page-1:instance-admin:' + Math.floor(Date.parse(reaction.occurredAt) / (30 * 60_000)),
      'page.reacted:page-1:site-admin:' + Math.floor(Date.parse(reaction.occurredAt) / (30 * 60_000)),
      'page.reacted:page-1:instance-admin:' + Math.floor(Date.parse(reaction.occurredAt) / (30 * 60_000)),
    ])
  })

  test('a guest delete is not credited to the moderator who last acted on the comment', async () => {
    const { client, published } = recordingClient()
    const plugin = createNotificationsPlugin({
      settings: settings(),
      client,
      repository: repository({ loadModerationActor: async () => 'instance-admin' }),
    })
    await plugin.handleEvent?.(event('comment.deleted', { commentId: 'c-1', action: 'delete', userId: null }))
    expect(published.map((p) => p.recipientKey).sort()).toEqual(['instance-admin', 'site-admin'])
  })

  test('a deleted comment sends no created notice, so its text never goes out', async () => {
    const { client, published } = recordingClient()
    const deleted = repository({
      loadCommentContext: async () => ({
        pageId: 'page-1',
        pageUrl: 'https://blog.test/post',
        authorName: 'Guest',
        bodyMarkdown: 'words the author removed',
        status: 'deleted',
      }),
    })
    const plugin = createNotificationsPlugin({ settings: settings(), client, repository: deleted })
    await plugin.handleEvent?.(event('comment.created', { commentId: 'c-1', userId: 'site-admin' }))
    expect(published).toEqual([])
    // The deletion itself still notifies, and its notice carries no text.
    await plugin.handleEvent?.(event('comment.deleted', { commentId: 'c-1', action: 'delete', userId: 'guest' }))
    expect(published.map((p) => p.type)).toEqual(['comment.deleted', 'comment.deleted'])
  })

  test('a reaction after an earlier one in the same window sends nothing', async () => {
    const { client, published } = recordingClient()
    const plugin = createNotificationsPlugin({
      settings: settings({ events: { ...DEFAULTS, pageReacted: true } }),
      client,
      repository: repository({ hasEarlierReactionNotice: async () => true }),
    })
    await plugin.handleEvent?.(
      event('page.reacted', { pageId: 'page-1', pageUrl: '/post', userId: 'reactor', emoji: '👍' }),
    )
    expect(published).toEqual([])
  })

  test('the earlier-reaction check looks back to the start of the reaction window', async () => {
    const looked: Array<{ siteId: string; pageId: string; from: Date; before: Date }> = []
    const { client } = recordingClient()
    const plugin = createNotificationsPlugin({
      settings: settings({ events: { ...DEFAULTS, pageReacted: true } }),
      client,
      repository: repository({
        hasEarlierReactionNotice: async (siteId, pageId, from, before) => {
          looked.push({ siteId, pageId, from, before })
          return false
        },
      }),
    })
    await plugin.handleEvent?.(
      event('page.reacted', { pageId: 'page-1', pageUrl: '/post', userId: 'reactor', emoji: '👍' }),
    )
    // The event is at 12:05 and the window is 30 minutes, so the window opened at 12:00.
    expect(looked).toEqual([
      {
        siteId: 'site-1',
        pageId: 'page-1',
        from: new Date('2026-10-29T12:00:00.000Z'),
        before: new Date('2026-10-29T12:05:00.000Z'),
      },
    ])
  })

  test('a failed publish throws, so the outbox retries the whole event', async () => {
    const failing = {
      publish: async () => {
        throw new Error('down')
      },
    } as never
    const plugin = createNotificationsPlugin({ settings: settings(), client: failing, repository: repository() })
    await expect(plugin.handleEvent?.(event('comment.created', { commentId: 'c-1' }))).rejects.toThrow(
      'publishes failed',
    )
  })

  test('a publish refused for a wrong key is permanent and keeps the upstream code', async () => {
    const refused = {
      publish: async () => {
        throw new ApiError('APP_NOT_FOUND', 'App was not found', 404)
      },
    } as never
    const plugin = createNotificationsPlugin({ settings: settings(), client: refused, repository: repository() })
    await expect(plugin.handleEvent?.(event('comment.created', { commentId: 'c-1' }))).rejects.toMatchObject({
      code: 'APP_NOT_FOUND',
      retryable: false,
    })
  })

  test('email is attached per recipient only when the email channel is on', async () => {
    const { client, published } = recordingClient()
    const plugin = createNotificationsPlugin({
      settings: settings({ channels: ['inapp', 'email'] }),
      client,
      repository: repository(),
    })
    await plugin.handleEvent?.(event('comment.created', { commentId: 'c-1', userId: 'site-admin' }))
    expect(published[0]).toMatchObject({ recipientKey: 'instance-admin', email: 'root@x.test' })
  })
})

describe('notification settings', () => {
  test('nothing is enabled without a server URL, app key and lnk_ key', () => {
    const resolved = getNotificationsPluginSettings({ env: { NOTIFICATIONS_API_KEY: 'rtk_wrong' } })
    expect(resolved.enabled).toBe(false)
    expect(resolved.missing).toEqual(expect.arrayContaining(['NOTIFICATIONS_URL', 'NOTIFICATIONS_APP_KEY']))
  })

  test('NOTIFICATIONS_EVENTS turns on only the listed kinds', () => {
    const resolved = getNotificationsPluginSettings({
      env: {
        NOTIFICATIONS_URL: 'http://n.test',
        NOTIFICATIONS_APP_KEY: 'app-1',
        NOTIFICATIONS_API_KEY: 'lnk_key',
        NOTIFICATIONS_EVENTS: 'deleted, pageReacted',
      },
    })
    expect(resolved.enabled).toBe(true)
    expect(resolved.events).toEqual({
      created: false,
      heldForReview: false,
      hidden: false,
      deleted: true,
      pageReacted: true,
    })
  })

  test('the public URL defaults to the server URL', () => {
    const resolved = getNotificationsPluginSettings({
      env: { NOTIFICATIONS_URL: 'http://n.test', NOTIFICATIONS_APP_KEY: 'a', NOTIFICATIONS_API_KEY: 'lnk_k' },
    })
    expect(resolved.publicUrl).toBe('http://n.test')
  })
})
