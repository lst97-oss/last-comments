import { z } from 'zod'

// Response mirrors. The API returns ad-hoc object literals, so there is no
// runtime schema to reuse — every schema below carries a `shortcut:` comment
// naming the function it mirrors, and the two must be updated together.

// shortcut: mirror of ok() in src/server/http/response.ts
export const envelope = <T extends z.ZodType>(payload: T) => z.strictObject({ data: payload })

// shortcut: mirror of fail() in src/server/http/response.ts
export const apiErrorSchema = z
  .strictObject({
    error: z.strictObject({
      code: z.string().describe('Machine-readable error code, e.g. SITE_NOT_FOUND'),
      message: z.string().describe('Human-readable error message'),
    }),
  })
  .meta({ id: 'ApiError' })

// shortcut: mirror of the comment row in src/server/db/schema.ts (comments)
// plus the authorRole / avatarUrl / editKey fields the handlers add.
export const commentSchema = z
  .strictObject({
    id: z.uuid(),
    pageId: z.uuid(),
    parentId: z.uuid().nullable(),
    userId: z.string().nullable(),
    authorName: z.string(),
    bodyMarkdown: z.string(),
    status: z.enum(['visible', 'hidden', 'deleted']),
    pinnedAt: z.iso.datetime().nullable(),
    pinnedByUserId: z.string().nullable(),
    editedAt: z.iso.datetime().nullable(),
    deletedAt: z.iso.datetime().nullable(),
    createdAt: z.iso.datetime(),
    updatedAt: z.iso.datetime(),
    authorRole: z.enum(['admin', 'moderator']).nullable(),
    avatarUrl: z.string().nullable().optional(),
    editKey: z
      .string()
      .optional()
      .describe('One-time key for editing this comment as a guest. Returned only on creation.'),
  })
  .meta({ id: 'Comment' })

// shortcut: mirror of the select list in listPageComments()
// (src/server/modules/comments/infrastructure/comment-repository.ts)
export const commentListItemSchema = z
  .strictObject({
    id: z.uuid(),
    pageId: z.uuid(),
    parentId: z.uuid().nullable(),
    userId: z.string().nullable(),
    authorName: z.string(),
    avatarUrl: z.string().nullable(),
    bodyMarkdown: z.string(),
    status: z.enum(['visible', 'hidden', 'deleted']),
    pinnedAt: z.iso.datetime().nullable(),
    createdAt: z.iso.datetime(),
    editedAt: z.iso.datetime().nullable(),
    authorRole: z.enum(['admin', 'moderator']).nullable(),
    score: z.number().int().describe('Sum of the votes on this comment'),
    viewerVote: z.union([z.literal(-1), z.literal(1)]).nullable(),
  })
  .meta({ id: 'CommentListItem' })

// shortcut: mirror of CommentVoteSummary in comment-repository.ts
export const voteSummarySchema = z
  .strictObject({
    score: z.number().int(),
    viewerVote: z.union([z.literal(-1), z.literal(1)]).nullable(),
  })
  .meta({ id: 'VoteSummary' })

// shortcut: mirror of ModerationComment in comment-repository.ts
export const moderationCommentSchema = z
  .strictObject({
    id: z.uuid(),
    pageId: z.uuid(),
    pageUrl: z.string(),
    pageLocked: z.boolean(),
    parentId: z.uuid().nullable(),
    userId: z.string().nullable(),
    userBlocked: z.boolean(),
    authorName: z.string(),
    bodyMarkdown: z.string(),
    status: z.enum(['visible', 'hidden', 'deleted']),
    pinnedAt: z.iso.datetime().nullable(),
    createdAt: z.iso.datetime(),
    score: z.number().int(),
    viewerVote: z.union([z.literal(-1), z.literal(1)]).nullable(),
    authorRole: z.enum(['admin', 'moderator']).nullable(),
  })
  .meta({ id: 'ModerationComment' })

// shortcut: mirror of ModerationPageSummary in comment-repository.ts
export const moderationPageSummarySchema = z
  .strictObject({
    id: z.uuid(),
    canonicalUrl: z.string(),
    pageKey: z.string().nullable(),
    title: z.string().nullable(),
    isLocked: z.boolean(),
    total: z.number().int(),
    visible: z.number().int(),
    hidden: z.number().int(),
    latestAt: z.iso.datetime().nullable(),
    latest: z
      .strictObject({
        id: z.uuid(),
        authorName: z.string(),
        bodyMarkdown: z.string(),
        status: z.enum(['visible', 'hidden', 'deleted']),
        createdAt: z.iso.datetime(),
      })
      .nullable(),
    recent: z.strictObject({
      windowDays: z.number().int(),
      count: z.number().int(),
      totalAuthors: z.number().int(),
      authors: z.array(z.strictObject({ authorName: z.string(), count: z.number().int() })),
      preview: z.array(
        z.strictObject({
          id: z.uuid(),
          authorName: z.string(),
          bodyMarkdown: z.string(),
          status: z.enum(['visible', 'hidden', 'deleted']),
          createdAt: z.iso.datetime(),
        }),
      ),
    }),
  })
  .meta({ id: 'ModerationPageSummary' })

// shortcut: mirror of listModerationSites() in comment-repository.ts
export const moderationSiteSchema = z
  .strictObject({
    id: z.uuid(),
    key: z.string(),
    name: z.string(),
    role: z.enum(['admin', 'moderator']),
    origins: z.array(z.string()),
  })
  .meta({ id: 'ModerationSite' })

// shortcut: mirror of the GET /api/moderation payload
export const moderationListSchema = z.strictObject({
  sites: z.array(moderationSiteSchema),
  pages: z.array(moderationPageSummarySchema).optional(),
  comments: z.array(moderationCommentSchema).optional(),
  total: z.number().int().optional(),
  isInstanceAdmin: z.boolean(),
})

// shortcut: mirror of setPageLocked() in comment-repository.ts
export const moderationPageResultSchema = z
  .strictObject({
    id: z.uuid(),
    canonicalUrl: z.string(),
    isLocked: z.boolean(),
  })
  .meta({ id: 'ModerationPageResult' })

// shortcut: mirror of SiteUser in comment-repository.ts
export const siteUserSchema = z
  .strictObject({
    userId: z.string(),
    name: z.string(),
    email: z.string(),
    createdAt: z.iso.datetime(),
    role: z.enum(['admin', 'moderator']).nullable(),
    commentsTotal: z.number().int(),
    lastCommentAt: z.iso.datetime().nullable(),
    blocked: z.boolean(),
    blockedReason: z.string().nullable(),
    blockedAt: z.iso.datetime().nullable(),
  })
  .meta({ id: 'SiteUser' })

// shortcut: mirror of UserCommentHistoryItem in comment-repository.ts
export const userCommentHistoryItemSchema = z
  .strictObject({
    id: z.uuid(),
    pageId: z.uuid(),
    pageTitle: z.string().nullable(),
    canonicalUrl: z.string(),
    bodyMarkdown: z.string(),
    status: z.enum(['visible', 'hidden', 'deleted']),
    createdAt: z.iso.datetime(),
  })
  .meta({ id: 'UserCommentHistoryItem' })

// shortcut: mirror of InstanceSettings in
// src/server/modules/admin/infrastructure/settings.ts
export const instanceSettingsSchema = z
  .strictObject({
    plugins: z.array(
      z.strictObject({
        id: z.string(),
        apiVersion: z.number().int(),
        enabled: z.boolean(),
        detail: z.string(),
        events: z.array(z.string()),
        capabilities: z.strictObject({
          validateComment: z.boolean(),
          beforeOperation: z.boolean(),
          handleEvent: z.boolean(),
        }),
      }),
    ),
    auth: z.strictObject({
      providers: z.array(z.enum(['better-auth', 'oidc-jwt', 'header'])),
      autoProvision: z.boolean(),
      bootstrapEmailSet: z.boolean(),
      oidc: z.strictObject({
        configured: z.boolean(),
        jwksUrlSet: z.boolean(),
        issuerSet: z.boolean(),
        audienceSet: z.boolean(),
      }),
      header: z.strictObject({
        trustProxy: z.boolean(),
        cidr: z.string(),
        userHeader: z.string(),
        emailHeader: z.string(),
        nameHeader: z.string(),
      }),
    }),
    comments: z.strictObject({
      verificationRequired: z.boolean(),
      turnstileSecretConfigured: z.boolean(),
      turnstileSiteKeyConfigured: z.boolean(),
      anonEditWindowMinutes: z.number().int(),
    }),
    rateLimit: z.strictObject({
      secretConfigured: z.boolean(),
      limits: z.array(
        z.strictObject({
          operation: z.string(),
          count: z.number().int(),
          windowSeconds: z.number().int(),
        }),
      ),
    }),
  })
  .meta({ id: 'InstanceSettings' })

// shortcut: mirror of the POST /api/moderation "user" branch
export const userBlockResultSchema = z
  .strictObject({
    userId: z.string(),
    blocked: z.boolean(),
  })
  .meta({ id: 'UserBlockResult' })

// shortcut: mirror of the DELETE /api/admin/sites response
export const deletedResultSchema = z.strictObject({ deleted: z.literal(true) })

// shortcut: mirror of the PATCH /api/admin/api-keys response
export const updatedResultSchema = z.strictObject({ updated: z.literal(true) })

// shortcut: mirror of listAdminSites() in admin-repository.ts
export const adminSiteListItemSchema = z
  .strictObject({
    id: z.uuid(),
    key: z.string(),
    name: z.string(),
    origins: z.array(z.string()),
  })
  .meta({ id: 'AdminSite' })

// shortcut: mirror of createAdminSite() / renameAdminSite() in admin-repository.ts
export const adminSiteCreatedSchema = z
  .strictObject({
    id: z.uuid(),
    key: z.string(),
    name: z.string(),
  })
  .meta({ id: 'AdminSiteCreated' })

// shortcut: mirror of the pages table row (src/server/db/schema.ts)
export const sitePageSchema = z
  .strictObject({
    id: z.uuid(),
    canonicalUrl: z.string(),
    pageKey: z.string().nullable(),
    title: z.string().nullable(),
    isLocked: z.boolean(),
  })
  .meta({ id: 'SitePage' })

// shortcut: mirror of SiteDashboardStats in comment-repository.ts
export const siteDashboardStatsSchema = z
  .strictObject({
    totals: z.strictObject({
      comments: z.number().int(),
      visible: z.number().int(),
      hidden: z.number().int(),
      deleted: z.number().int(),
      pages: z.number().int(),
      votesUp: z.number().int(),
      votesDown: z.number().int(),
      blockedUsers: z.number().int(),
    }),
    window: z.strictObject({
      days: z.number().int(),
      start: z.string(),
      comments: z.number().int(),
      votesUp: z.number().int(),
      votesDown: z.number().int(),
    }),
    series: z.array(
      z.strictObject({
        day: z.string(),
        comments: z.number().int(),
        visible: z.number().int(),
        hidden: z.number().int(),
        votesUp: z.number().int(),
        votesDown: z.number().int(),
      }),
    ),
    topPages: z.array(
      z.strictObject({
        pageId: z.uuid(),
        title: z.string().nullable(),
        canonicalUrl: z.string(),
        total: z.number().int(),
      }),
    ),
    moderationActions: z.array(
      z.strictObject({
        action: z.string(),
        count: z.number().int(),
      }),
    ),
  })
  .meta({ id: 'SiteDashboardStats' })

// shortcut: mirror of PageThreadStats in comment-repository.ts
export const pageThreadStatsSchema = z
  .strictObject({
    totals: z.strictObject({
      comments: z.number().int(),
      visible: z.number().int(),
      hidden: z.number().int(),
      deleted: z.number().int(),
      votesUp: z.number().int(),
      votesDown: z.number().int(),
      replies: z.number().int(),
      pinned: z.number().int(),
      participants: z.number().int(),
    }),
    window: z.strictObject({
      days: z.number().int(),
      start: z.string(),
      comments: z.number().int(),
      votesUp: z.number().int(),
      votesDown: z.number().int(),
    }),
    series: z.array(
      z.strictObject({
        day: z.string(),
        comments: z.number().int(),
        visible: z.number().int(),
        hidden: z.number().int(),
        votesUp: z.number().int(),
        votesDown: z.number().int(),
      }),
    ),
    topAuthors: z.array(
      z.strictObject({
        authorName: z.string(),
        total: z.number().int(),
      }),
    ),
    moderationActions: z.array(
      z.strictObject({
        action: z.string(),
        count: z.number().int(),
      }),
    ),
    firstAt: z.iso.datetime().nullable(),
  })
  .meta({ id: 'PageThreadStats' })

// shortcut: mirror of the apikey row (src/server/db/schema.ts) plus the
// plaintext `key` the create endpoint returns once.
export const apiKeyCreatedSchema = z
  .strictObject({
    id: z.string(),
    configId: z.string(),
    name: z.string().nullable(),
    start: z.string().nullable(),
    prefix: z.string().nullable(),
    key: z.string().describe('The full API key. Only returned on creation.'),
    enabled: z.boolean(),
    expiresAt: z.iso.datetime().nullable(),
    referenceId: z.string(),
    requestCount: z.number().int(),
    rateLimitEnabled: z.boolean(),
    rateLimitMax: z.number().nullable(),
    rateLimitTimeWindow: z.number().nullable(),
    remaining: z.number().nullable(),
    refillAmount: z.number().nullable(),
    refillInterval: z.number().nullable(),
    lastRefillAt: z.iso.datetime().nullable(),
    lastRequest: z.iso.datetime().nullable(),
    permissions: z.record(z.string(), z.array(z.string())).nullable(),
    metadata: z.record(z.string(), z.unknown()).nullable(),
    createdAt: z.iso.datetime(),
    updatedAt: z.iso.datetime(),
  })
  .meta({ id: 'ApiKey' })

// shortcut: mirror of toPluginKey() in
// src/server/modules/api-keys/infrastructure/api-key-repository.ts
export const apiKeyListItemSchema = z
  .strictObject({
    id: z.string(),
    name: z.string().nullable(),
    start: z.string().nullable(),
    prefix: z.string().nullable(),
    enabled: z.boolean(),
    expiresAt: z.iso.datetime().nullable(),
    createdAt: z.iso.datetime(),
    metadata: z.strictObject({ siteKey: z.string() }).nullable(),
    permissions: z.record(z.string(), z.array(z.string())).nullable(),
  })
  .meta({ id: 'ApiKeyListItem' })

// shortcut: mirror of the user row (src/server/db/schema.ts)
export const initialAdminUserSchema = z
  .strictObject({
    id: z.string(),
    name: z.string(),
    email: z.email(),
    emailVerified: z.boolean(),
    image: z.string().nullable(),
    createdAt: z.iso.datetime(),
    updatedAt: z.iso.datetime(),
  })
  .meta({ id: 'User' })

// shortcut: mirror of GET /api/session (src/server/auth/resolve.ts principal)
export const sessionPrincipalSchema = z
  .strictObject({
    userId: z.string(),
    email: z.string().nullable(),
    displayName: z.string().nullable(),
    provider: z.enum(['better-auth', 'oidc-jwt', 'header']),
  })
  .meta({ id: 'SessionPrincipal' })

// shortcut: mirror of GET /api/auth-providers (src/server/auth/provider-config.ts)
export const authProvidersSchema = z
  .strictObject({ providers: z.array(z.enum(['better-auth', 'oidc-jwt', 'header'])) })
  .meta({ id: 'AuthProviders' })

// shortcut: mirror of LiveReport in src/server/modules/health/domain/health.ts
export const liveReportSchema = z
  .strictObject({
    status: z.literal('live'),
    timestamp: z.iso.datetime(),
    uptimeSeconds: z.number(),
  })
  .meta({ id: 'LiveReport' })

// shortcut: mirror of HealthReport in src/server/modules/health/domain/health.ts
export const healthReportSchema = z
  .strictObject({
    status: z.enum(['ok', 'degraded']),
    timestamp: z.iso.datetime(),
    uptimeSeconds: z.number(),
    checks: z.strictObject({
      database: z.strictObject({
        ok: z.boolean(),
        latencyMs: z.number(),
      }),
    }),
  })
  .meta({ id: 'HealthReport' })
