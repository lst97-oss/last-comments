import { relations, sql } from 'drizzle-orm'
import {
  type AnyPgColumn,
  boolean,
  check,
  foreignKey,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  primaryKey,
  smallint,
  text,
  timestamp,
  unique,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core'

import type { SiteAccess } from '@/lib/site-access'
import { COMMENT_EVENT_TYPES, MODERATION_ACTIONS, MODERATION_TARGET_TYPES } from '@/server/db/vocabularies'

// `in (...)` over a closed vocabulary. CHECK constraints take literals only, so the
// values are quoted here; they are constants from vocabularies.ts, never input.
function oneOf(column: AnyPgColumn, values: readonly string[]) {
  return sql`${column} in (${sql.raw(values.map((value) => `'${value}'`).join(', '))})`
}

// Every updated_at moves on any drizzle update, so no write has to set it by hand.
const updatedAt = () =>
  timestamp('updated_at', { withTimezone: true })
    .defaultNow()
    .notNull()
    .$onUpdate(() => new Date())

export const user = pgTable('user', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  email: text('email').notNull().unique(),
  emailVerified: boolean('email_verified').default(false).notNull(),
  image: text('image'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: updatedAt(),
})

export const session = pgTable(
  'session',
  {
    id: text('id').primaryKey(),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
    token: text('token').notNull().unique(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: updatedAt(),
    ipAddress: text('ip_address'),
    userAgent: text('user_agent'),
    userId: text('user_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
  },
  (table) => [index('session_user_id_idx').on(table.userId)],
)

export const account = pgTable(
  'account',
  {
    id: text('id').primaryKey(),
    accountId: text('account_id').notNull(),
    providerId: text('provider_id').notNull(),
    userId: text('user_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    accessToken: text('access_token'),
    refreshToken: text('refresh_token'),
    idToken: text('id_token'),
    accessTokenExpiresAt: timestamp('access_token_expires_at', { withTimezone: true }),
    refreshTokenExpiresAt: timestamp('refresh_token_expires_at', { withTimezone: true }),
    scope: text('scope'),
    password: text('password'),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: updatedAt(),
  },
  (table) => [
    index('account_user_id_idx').on(table.userId),
    uniqueIndex('account_provider_account_uq').on(table.providerId, table.accountId),
  ],
)

export const verification = pgTable(
  'verification',
  {
    id: text('id').primaryKey(),
    identifier: text('identifier').notNull(),
    value: text('value').notNull(),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: updatedAt(),
  },
  (table) => [index('verification_identifier_idx').on(table.identifier)],
)

// admin manages the site; member can comment and nothing else.
export const siteRole = pgEnum('site_role', ['admin', 'member'])
export const commentStatus = pgEnum('comment_status', ['visible', 'hidden', 'deleted'])
export const pluginDeliveryStatus = pgEnum('plugin_delivery_status', [
  'pending',
  'processing',
  'delivered',
  'dead_letter',
])

// Better Auth API-key plugin table ("apikey"). Permissions use the plugin's map
// ({ sites: ['create'], … }). Site tenancy is NOT stored here: it lives in api_key_sites.
export const apikey = pgTable(
  'apikey',
  {
    id: text('id').primaryKey(),
    configId: text('config_id').notNull().default('default'),
    name: text('name'),
    start: text('start'),
    referenceId: text('reference_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    prefix: text('prefix'),
    key: text('key').notNull().unique(),
    refillInterval: integer('refill_interval'),
    refillAmount: integer('refill_amount'),
    lastRefillAt: timestamp('last_refill_at', { withTimezone: true }),
    enabled: boolean('enabled').default(true),
    rateLimitEnabled: boolean('rate_limit_enabled').default(true),
    rateLimitTimeWindow: integer('rate_limit_time_window'),
    rateLimitMax: integer('rate_limit_max'),
    requestCount: integer('request_count').default(0),
    remaining: integer('remaining'),
    lastRequest: timestamp('last_request', { withTimezone: true }),
    expiresAt: timestamp('expires_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: updatedAt(),
    permissions: text('permissions'),
    metadata: jsonb('metadata'),
  },
  (table) => [index('apikey_config_id_idx').on(table.configId), index('apikey_reference_id_idx').on(table.referenceId)],
)

export const sites = pgTable(
  'sites',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    key: text('key').notNull().unique(),
    name: text('name').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    // Comment length cap for this site, in characters. Null means the default
    // (10,000, the server's ceiling); a site can only lower it.
    bodyLimit: integer('body_limit'),
    // Visitor policy: open | login | private (see src/lib/site-access.ts).
    access: text('access').$type<SiteAccess>().notNull().default('open'),
    // Transport policy: when true, only a site-bound service key is accepted,
    // so a browser or curl caller with a registered Origin is refused.
    gatewayOnly: boolean('gateway_only').notNull().default(false),
    // Voting switch: when off, the service refuses votes and the widget hides the arrows.
    votesEnabled: boolean('votes_enabled').notNull().default(true),
  },
  (table) => [
    check('sites_body_limit_check', sql`${table.bodyLimit} is null or ${table.bodyLimit} between 1 and 10000`),
    check('sites_access_check', sql`${table.access} in ('open', 'login', 'private')`),
  ],
)

// The one site a site-bound API key belongs to. It replaces the JSON binding the plugin's
// metadata used to carry: the database cascades a site's keys away, and a binding is one indexed read.
export const apiKeySites = pgTable(
  'api_key_sites',
  {
    apiKeyId: text('api_key_id')
      .primaryKey()
      .references(() => apikey.id, { onDelete: 'cascade' }),
    siteId: uuid('site_id')
      .notNull()
      .references(() => sites.id, { onDelete: 'cascade' }),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [index('api_key_sites_site_id_idx').on(table.siteId)],
)

export const siteOrigins = pgTable(
  'site_origins',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    siteId: uuid('site_id')
      .notNull()
      .references(() => sites.id, { onDelete: 'cascade' }),
    origin: text('origin').notNull(),
  },
  (table) => [uniqueIndex('site_origins_site_origin_uq').on(table.siteId, table.origin)],
)

export const siteMemberships = pgTable(
  'site_memberships',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    siteId: uuid('site_id')
      .notNull()
      .references(() => sites.id, { onDelete: 'cascade' }),
    userId: text('user_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    role: siteRole('role').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex('site_memberships_site_user_uq').on(table.siteId, table.userId),
    index('site_memberships_user_id_idx').on(table.userId),
  ],
)

export const instanceAdmins = pgTable(
  'instance_admins',
  {
    slot: integer('slot').primaryKey().default(1),
    userId: text('user_id')
      .notNull()
      .unique()
      .references(() => user.id, { onDelete: 'cascade' }),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [check('instance_admins_singleton_check', sql`${table.slot} = 1`)],
)

export const pages = pgTable(
  'pages',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    siteId: uuid('site_id')
      .notNull()
      .references(() => sites.id, { onDelete: 'cascade' }),
    canonicalUrl: text('canonical_url').notNull(),
    pageKey: text('page_key'),
    title: text('title'),
    isLocked: boolean('is_locked').default(false).notNull(),
    lockedAt: timestamp('locked_at', { withTimezone: true }),
    lockedByUserId: text('locked_by_user_id').references(() => user.id, { onDelete: 'set null' }),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: updatedAt(),
  },
  (table) => [
    uniqueIndex('pages_site_url_uq').on(table.siteId, table.canonicalUrl),
    // Target of comments' composite foreign key: a comment's site is its page's site.
    uniqueIndex('pages_id_site_uq').on(table.id, table.siteId),
    uniqueIndex('pages_site_pagekey_uq')
      .on(table.siteId, table.pageKey)
      .where(sql`${table.pageKey} is not null`),
  ],
)

export const comments = pgTable(
  'comments',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    // Denormalised from the page, so every site-level query filters this one column.
    // The composite foreign key below makes a comment under another site's page impossible.
    siteId: uuid('site_id').notNull(),
    pageId: uuid('page_id').notNull(),
    parentId: uuid('parent_id'),
    userId: text('user_id').references(() => user.id, { onDelete: 'set null' }),
    authorName: text('author_name').notNull(),
    bodyMarkdown: text('body_markdown').notNull(),
    status: commentStatus('status').default('visible').notNull(),
    pinnedAt: timestamp('pinned_at', { withTimezone: true }),
    pinnedByUserId: text('pinned_by_user_id').references(() => user.id, { onDelete: 'set null' }),
    // SHA-256 of a bearer edit key issued once to guest authors at create time.
    editKeyHash: text('edit_key_hash'),
    editedAt: timestamp('edited_at', { withTimezone: true }),
    // Set exactly when status is 'deleted' (see the CHECK below).
    deletedAt: timestamp('deleted_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: updatedAt(),
  },
  (table) => [
    foreignKey({
      columns: [table.parentId, table.pageId],
      foreignColumns: [table.id, table.pageId],
      name: 'comments_parent_same_page_fk',
    }).onDelete('restrict'),
    foreignKey({
      columns: [table.pageId, table.siteId],
      foreignColumns: [pages.id, pages.siteId],
      name: 'comments_page_same_site_fk',
    }).onDelete('cascade'),
    unique('comments_id_page_uq').on(table.id, table.pageId),
    check('comments_deleted_state_check', sql`(${table.status} = 'deleted') = (${table.deletedAt} is not null)`),
    index('comments_page_created_idx').on(table.pageId, table.createdAt, table.id),
    index('comments_parent_created_idx').on(table.parentId, table.createdAt, table.id),
    index('comments_site_created_idx').on(table.siteId, table.createdAt.desc(), table.id.desc()),
    // Hidden and deleted rows only: the moderation takedown list and the thread counts read them.
    index('comments_site_takedown_idx')
      .on(table.siteId, table.createdAt.desc(), table.id.desc())
      .where(sql`${table.status} <> 'visible'`),
    index('comments_user_created_idx').on(table.userId, table.createdAt.desc()),
  ],
)

// One vote per (comment, user): the key is the identity, so there is no surrogate id.
export const votes = pgTable(
  'votes',
  {
    commentId: uuid('comment_id')
      .notNull()
      .references(() => comments.id, { onDelete: 'cascade' }),
    userId: text('user_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    value: smallint('value').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.commentId, table.userId] }),
    index('votes_user_id_idx').on(table.userId),
    check('votes_value_check', sql`${table.value} in (-1, 1)`),
  ],
)

export const userBlocks = pgTable(
  'user_blocks',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    siteId: uuid('site_id')
      .notNull()
      .references(() => sites.id, { onDelete: 'cascade' }),
    userId: text('user_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    createdByUserId: text('created_by_user_id')
      .notNull()
      .references(() => user.id, { onDelete: 'restrict' }),
    expiresAt: timestamp('expires_at', { withTimezone: true }),
    reason: text('reason'),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex('user_blocks_site_user_uq').on(table.siteId, table.userId),
    index('user_blocks_expires_at_idx').on(table.expiresAt),
  ],
)

export const verifiedUsers = pgTable(
  'verified_users',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    siteId: uuid('site_id')
      .notNull()
      .references(() => sites.id, { onDelete: 'cascade' }),
    userId: text('user_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    verifiedByUserId: text('verified_by_user_id')
      .notNull()
      .references(() => user.id, { onDelete: 'restrict' }),
    verifiedAt: timestamp('verified_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [uniqueIndex('verified_users_site_user_uq').on(table.siteId, table.userId)],
)

export const moderationEvents = pgTable(
  'moderation_events',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    siteId: uuid('site_id')
      .notNull()
      .references(() => sites.id, { onDelete: 'cascade' }),
    actorUserId: text('actor_user_id')
      .notNull()
      .references(() => user.id, { onDelete: 'restrict' }),
    action: text('action').notNull(),
    targetType: text('target_type').notNull(),
    targetId: text('target_id').notNull(),
    reason: text('reason'),
    occurredAt: timestamp('occurred_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index('moderation_events_site_time_idx').on(table.siteId, table.occurredAt),
    check('moderation_events_action_check', oneOf(table.action, MODERATION_ACTIONS)),
    check('moderation_events_target_check', oneOf(table.targetType, MODERATION_TARGET_TYPES)),
  ],
)

export const pluginEvents = pgTable(
  'plugin_events',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    siteId: uuid('site_id')
      .notNull()
      .references(() => sites.id, { onDelete: 'cascade' }),
    eventType: text('event_type').notNull(),
    apiVersion: integer('api_version').default(1).notNull(),
    aggregateId: text('aggregate_id').notNull(),
    payload: jsonb('payload').$type<Record<string, unknown>>().notNull(),
    occurredAt: timestamp('occurred_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index('plugin_events_site_time_idx').on(table.siteId, table.occurredAt),
    check('plugin_events_type_check', oneOf(table.eventType, COMMENT_EVENT_TYPES)),
  ],
)

export const pluginDeliveries = pgTable(
  'plugin_deliveries',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    eventId: uuid('event_id')
      .notNull()
      .references(() => pluginEvents.id, { onDelete: 'cascade' }),
    pluginId: text('plugin_id').notNull(),
    status: pluginDeliveryStatus('status').default('pending').notNull(),
    attempts: integer('attempts').default(0).notNull(),
    nextAttemptAt: timestamp('next_attempt_at', { withTimezone: true }).defaultNow().notNull(),
    deliveredAt: timestamp('delivered_at', { withTimezone: true }),
    lastError: text('last_error'),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex('plugin_deliveries_event_plugin_uq').on(table.eventId, table.pluginId),
    // The delivery worker reads only unfinished rows, so the index holds only those.
    index('plugin_deliveries_due_idx')
      .on(table.nextAttemptAt)
      .where(sql`${table.status} in ('pending', 'processing')`),
  ],
)

// Federated login link: (provider, subject) → canonical user.id. better-auth
// keeps its own `account` link table; external providers (oidc-jwt, header)
// map here so siteMemberships/votes/comments keep joining on user.id.
export const externalIdentities = pgTable(
  'external_identities',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    provider: text('provider').notNull(),
    subject: text('subject').notNull(),
    userId: text('user_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    email: text('email'),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex('external_identities_provider_subject_uq').on(table.provider, table.subject),
    index('external_identities_user_id_idx').on(table.userId),
  ],
)

export const userRelations = relations(user, ({ many }) => ({
  sessions: many(session),
  accounts: many(account),
  externalIdentities: many(externalIdentities),
}))

export const sessionRelations = relations(session, ({ one }) => ({
  user: one(user, { fields: [session.userId], references: [user.id] }),
}))

export const accountRelations = relations(account, ({ one }) => ({
  user: one(user, { fields: [account.userId], references: [user.id] }),
}))

export const externalIdentitiesRelations = relations(externalIdentities, ({ one }) => ({
  user: one(user, { fields: [externalIdentities.userId], references: [user.id] }),
}))
