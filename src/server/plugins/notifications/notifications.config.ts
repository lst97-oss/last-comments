import { z } from 'zod'

import { definePluginConfig, loadPluginConfig } from '@/server/plugins/plugin-config'

// Which admin events notify, and how. Env wins for the event list: NOTIFICATIONS_EVENTS names the events
// to turn on, and every other event is off. The secret stays in NOTIFICATIONS_API_KEY.
export const NOTIFICATION_EVENT_KINDS = ['created', 'heldForReview', 'hidden', 'deleted', 'pageReacted'] as const
export type NotificationEventKind = (typeof NOTIFICATION_EVENT_KINDS)[number]

const NOTIFICATION_CHANNEL_NAMES = ['inapp', 'email'] as const
export type NotificationChannelName = (typeof NOTIFICATION_CHANNEL_NAMES)[number]

const eventsSchema = z.strictObject({
  created: z.boolean(),
  heldForReview: z.boolean(),
  hidden: z.boolean(),
  deleted: z.boolean(),
  pageReacted: z.boolean(),
})

export const notificationsFileSchema = z.strictObject({
  events: eventsSchema.default({ created: true, heldForReview: true, hidden: true, deleted: true, pageReacted: false }),
  reactionWindowMinutes: z.number().int().min(1).max(1440).default(30),
  channels: z.array(z.enum(NOTIFICATION_CHANNEL_NAMES)).min(1).default(['inapp']),
})
export type NotificationsFileConfig = z.infer<typeof notificationsFileSchema>

export type ResolvedNotificationsConfig = {
  // Enabled only with the server URL, app key and API key present, and at least one event on.
  enabled: boolean
  missing: string[]
  baseUrl: string | undefined
  publicUrl: string | undefined
  appKey: string | undefined
  apiKey: string | undefined
  events: Record<NotificationEventKind, boolean>
  reactionWindowMinutes: number
  // Non-empty: the widget's publish type takes at least one channel, and the file schema enforces the same.
  channels: [NotificationChannelName, ...NotificationChannelName[]]
}

function nonEmpty(value: string | undefined): string | undefined {
  const trimmed = value?.trim()
  return trimmed ? trimmed : undefined
}

// NOTIFICATIONS_EVENTS=created,deleted: the listed kinds on, every other kind off. Unknown names are ignored.
function eventsFromEnv(raw: string | undefined): Record<NotificationEventKind, boolean> | null {
  const names =
    nonEmpty(raw)
      ?.split(',')
      .map((name) => name.trim()) ?? []
  if (names.length === 0) return null
  return Object.fromEntries(NOTIFICATION_EVENT_KINDS.map((kind) => [kind, names.includes(kind)])) as Record<
    NotificationEventKind,
    boolean
  >
}

// The schema already requires one channel; this only gives the list the non-empty type the SDK expects.
function oneOrMore<T>(list: T[], fallback: [T, ...T[]]): [T, ...T[]] {
  const [first, ...rest] = list
  return first === undefined ? fallback : [first, ...rest]
}

export const notificationsConfigDef = definePluginConfig({
  id: 'notifications',
  fileSchema: notificationsFileSchema,
  defaults: {
    events: { created: true, heldForReview: true, hidden: true, deleted: true, pageReacted: false },
    reactionWindowMinutes: 30,
    channels: ['inapp'],
  } satisfies NotificationsFileConfig,
  resolve: (file, env): ResolvedNotificationsConfig => {
    const baseUrl = nonEmpty(env.NOTIFICATIONS_URL)
    const appKey = nonEmpty(env.NOTIFICATIONS_APP_KEY)
    const apiKey = nonEmpty(env.NOTIFICATIONS_API_KEY)
    // An API key that is not an app key (lnk_…) disables the plugin rather than failing boot.
    const missing = [
      ...(baseUrl ? [] : ['NOTIFICATIONS_URL']),
      ...(appKey ? [] : ['NOTIFICATIONS_APP_KEY']),
      ...(apiKey?.startsWith('lnk_') ? [] : ['NOTIFICATIONS_API_KEY (must start with lnk_)']),
    ]
    const events = eventsFromEnv(env.NOTIFICATIONS_EVENTS) ?? file.events
    return {
      enabled: missing.length === 0 && Object.values(events).some(Boolean),
      missing,
      baseUrl,
      publicUrl: nonEmpty(env.NOTIFICATIONS_PUBLIC_URL) ?? baseUrl,
      appKey,
      apiKey,
      events,
      reactionWindowMinutes: file.reactionWindowMinutes,
      channels: oneOrMore(file.channels, ['inapp']),
    }
  },
})

export function getNotificationsPluginSettings(
  overrides: { file?: unknown; env?: Record<string, string | undefined> } = {},
): ResolvedNotificationsConfig {
  return loadPluginConfig(notificationsConfigDef, {
    file: overrides.file ?? notificationsConfigDef.defaults,
    env: overrides.env,
  })
}
