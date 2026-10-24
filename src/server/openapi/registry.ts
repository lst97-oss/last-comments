import { OpenAPIRegistry, OpenApiGeneratorV31 } from '@asteasolutions/zod-to-openapi'
import { z } from 'zod'
import { initialAdminSchema } from '@/lib/site-schema'
import { adminSiteSchema, siteKeyParamSchema, siteUpdateSchema } from '@/server/modules/admin/http/admin-schemas'
import { createBodySchema, deleteQuerySchema, scopesBodySchema } from '@/server/modules/api-keys/http/api-key-schemas'
import {
  actionSchema,
  commentBodySchema,
  commentIdSchema,
  editBodySchema,
  listQuerySchema,
  pageBodySchema,
  pageDeleteQuerySchema,
  pagesQuerySchema,
  searchSchema,
  siteQuerySchema,
  statsQuerySchema,
  takedownsQuerySchema,
  userCommentsQuerySchema,
  usersQuerySchema,
  voteBodySchema,
  voteSearchSchema,
} from '@/server/modules/comments/http/comment-schemas'
import {
  adminSiteCreatedSchema,
  adminSiteListItemSchema,
  apiErrorSchema,
  apiKeyCreatedSchema,
  apiKeyListItemSchema,
  authProvidersSchema,
  commentListItemSchema,
  commentSchema,
  deletedResultSchema,
  envelope,
  healthReportSchema,
  initialAdminUserSchema,
  instanceSettingsSchema,
  liveReportSchema,
  moderationListSchema,
  moderationPageResultSchema,
  moderationPageSummarySchema,
  moderationTakedownSchema,
  pageDeletedSchema,
  pageThreadStatsSchema,
  sessionPrincipalSchema,
  siteDashboardStatsSchema,
  sitePageSchema,
  siteUserSchema,
  updatedResultSchema,
  userBlockResultSchema,
  userCommentHistoryItemSchema,
  voteSummarySchema,
} from '@/server/openapi/response-schemas'

// The business API spec. Request schemas are the very ones the routes
// validate with (src/server/modules/**/http/*-schemas.ts), so the document
// cannot drift from the implementation.

const registry = new OpenAPIRegistry()

// The response schemas carry their component id in `.meta({ id })`, so they
// land in `components.schemas` as $refs without patching Zod globally.
const Comment = commentSchema
const ApiError = apiErrorSchema
const CommentListItem = commentListItemSchema
const VoteSummary = voteSummarySchema
const ModerationPageSummary = moderationPageSummarySchema
const SiteDashboardStats = siteDashboardStatsSchema
const PageThreadStats = pageThreadStatsSchema
const ApiKey = apiKeyCreatedSchema
const ApiKeyListItem = apiKeyListItemSchema
const SessionPrincipal = sessionPrincipalSchema
const AuthProviders = authProvidersSchema
const User = initialAdminUserSchema
const SiteUser = siteUserSchema
const UserCommentHistoryItem = userCommentHistoryItemSchema
const InstanceSettings = instanceSettingsSchema
const LiveReport = liveReportSchema
const HealthReport = healthReportSchema

const json = (schema: z.ZodType) => ({ 'application/json': { schema } })
const errorResponse = (description: string) => ({ description, content: json(ApiError) })
const ok = <T extends z.ZodType>(payload: T) => ({ description: 'Success', content: json(envelope(payload)) })

const sessionCookie = {
  sessionCookie: [],
}
const serviceKey = {
  serviceKey: [],
}
const sessionOrServiceKey = [sessionCookie, serviceKey]

registry.registerComponent('securitySchemes', 'sessionCookie', {
  type: 'apiKey',
  in: 'cookie',
  name: 'better-auth.session_token',
  description:
    'Better Auth session cookie. Under HTTPS the cookie is prefixed with `__Secure-`, so the browser sends `__Secure-better-auth.session_token`.',
})

registry.registerComponent('securitySchemes', 'serviceKey', {
  type: 'http',
  scheme: 'bearer',
  description:
    'Service API key (`lck_…`). Send it as `Authorization: Bearer lck_…` or as the `x-api-key` header. Instance keys manage sites; site keys are bound to one site.',
})

registry.registerPath({
  method: 'get',
  path: '/api/comments',
  tags: ['comments'],
  summary: 'List the comments of one page',
  description:
    'Returns the visible comments of a page, oldest first, with the score and the viewer vote. Pass `url` or `pageKey` — the list endpoint returns no total, so it pages by row offset.',
  request: { query: searchSchema },
  responses: {
    200: ok(z.strictObject({ comments: z.array(CommentListItem) })),
    400: errorResponse('Invalid query parameters'),
    403: errorResponse('The site origin is not registered'),
    503: errorResponse('The database is temporarily unavailable'),
  },
})

registry.registerPath({
  method: 'post',
  path: '/api/comments',
  tags: ['comments'],
  summary: 'Post a comment or a reply',
  description:
    'Every post carries a Turnstile `verificationToken`; guests also post with `authorName`, signed-in authors post with their session and may leave the name out. Pass `parentId` to reply.',
  request: { body: { content: json(commentBodySchema) } },
  responses: {
    200: ok(z.strictObject({ comment: Comment })),
    400: errorResponse('Invalid body'),
    403: errorResponse('The site origin is not registered, or the guest name is missing'),
    404: errorResponse('The reply target does not exist'),
    409: errorResponse('The page is locked, or the verification failed'),
    503: errorResponse('The database is temporarily unavailable'),
  },
})

registry.registerPath({
  method: 'patch',
  path: '/api/comments/{commentId}',
  tags: ['comments'],
  summary: 'Edit your own comment',
  description:
    'Signed-in authors may edit at any time. Guests must send the `editKey` they received when posting, and only inside the anonymous edit window.',
  request: {
    params: z.strictObject({ commentId: commentIdSchema }),
    body: { content: json(editBodySchema) },
  },
  security: [sessionCookie],
  responses: {
    200: ok(z.strictObject({ comment: Comment })),
    400: errorResponse('Invalid body'),
    401: errorResponse('No session and no edit key'),
    403: errorResponse('The edit window has expired, or the author is blocked'),
    404: errorResponse('The comment does not exist'),
    409: errorResponse('The page is locked'),
    503: errorResponse('The database is temporarily unavailable'),
  },
})

registry.registerPath({
  method: 'delete',
  path: '/api/comments/{commentId}',
  tags: ['comments'],
  summary: 'Delete your own comment',
  description: 'Soft-deletes the comment: the row stays and can be restored by a moderator.',
  request: {
    params: z.strictObject({ commentId: commentIdSchema }),
    query: siteQuerySchema,
  },
  security: [sessionCookie],
  responses: {
    200: ok(z.strictObject({ comment: Comment })),
    401: errorResponse('No session'),
    403: errorResponse('The author is blocked'),
    404: errorResponse('The comment does not exist'),
    503: errorResponse('The database is temporarily unavailable'),
  },
})

registry.registerPath({
  method: 'put',
  path: '/api/comments/vote',
  tags: ['votes'],
  summary: 'Cast a vote on a comment',
  description: 'A vote is `1` (up) or `-1` (down). It replaces the viewer previous vote on that comment.',
  request: { body: { content: json(voteBodySchema) } },
  security: [sessionCookie],
  responses: {
    200: ok(z.strictObject({ vote: VoteSummary })),
    400: errorResponse('Invalid body'),
    401: errorResponse('No session'),
    403: errorResponse('The voter is blocked on this site'),
    404: errorResponse('The comment does not exist'),
    409: errorResponse('The page is locked'),
    503: errorResponse('The database is temporarily unavailable'),
  },
})

registry.registerPath({
  method: 'delete',
  path: '/api/comments/vote',
  tags: ['votes'],
  summary: 'Clear your vote on a comment',
  request: { query: voteSearchSchema },
  security: [sessionCookie],
  responses: {
    200: ok(z.strictObject({ vote: VoteSummary })),
    400: errorResponse('Invalid query parameters'),
    401: errorResponse('No session'),
    403: errorResponse('The voter is blocked on this site'),
    404: errorResponse('The comment does not exist'),
    409: errorResponse('The page is locked'),
    503: errorResponse('The database is temporarily unavailable'),
  },
})

registry.registerPath({
  method: 'get',
  path: '/api/moderation',
  tags: ['moderation'],
  summary: 'List sites, threads and comments for the moderation dashboard',
  description:
    'Without `site` it returns the sites the moderator belongs to. With `site` it adds that site pages, comments and the total comment count.',
  request: { query: listQuerySchema },
  security: [sessionCookie],
  responses: {
    200: ok(moderationListSchema),
    401: errorResponse('No session'),
    403: errorResponse('Not a moderator of that site'),
    503: errorResponse('The database is temporarily unavailable'),
  },
})

registry.registerPath({
  method: 'post',
  path: '/api/moderation',
  tags: ['moderation'],
  summary: 'Run a moderation action',
  description:
    'The `target` field selects the action: hide, restore, delete, pin or unpin a comment; lock or unlock a page; block or unblock a user; post a comment as a moderator; edit a comment; cast or clear a vote.',
  request: { body: { content: json(actionSchema) } },
  security: [sessionCookie],
  responses: {
    200: ok(
      z.union([
        z.strictObject({ comment: Comment }),
        z.strictObject({ vote: VoteSummary }),
        z.strictObject({ page: moderationPageResultSchema }),
        userBlockResultSchema,
      ]),
    ),
    400: errorResponse('Invalid body'),
    401: errorResponse('No session'),
    403: errorResponse('Not a moderator of that site'),
    404: errorResponse('The comment or page does not exist'),
    409: errorResponse('The page is locked'),
    503: errorResponse('The database is temporarily unavailable'),
  },
})

registry.registerPath({
  method: 'get',
  path: '/api/admin/sites',
  tags: ['sites'],
  summary: 'List the sites you may see with their allowed origins',
  description:
    'Instance admins see every site; a site member sees only the sites they belong to. A service key with the `sites:read` scope is instance-level and sees every site.',
  request: {},
  security: sessionOrServiceKey,
  responses: {
    200: ok(z.strictObject({ sites: z.array(adminSiteListItemSchema) })),
    401: errorResponse('No session'),
    503: errorResponse('The database is temporarily unavailable'),
  },
})

registry.registerPath({
  method: 'post',
  path: '/api/admin/sites',
  tags: ['sites'],
  summary: 'Create a site with its first allowed origin',
  description:
    'The site key is generated by the server from the name. Only the instance admin (or a service key with the `sites:create` scope) may create sites.',
  request: { body: { content: json(adminSiteSchema) } },
  security: sessionOrServiceKey,
  responses: {
    200: ok(z.strictObject({ site: adminSiteCreatedSchema })),
    400: errorResponse('Invalid body'),
    401: errorResponse('No session'),
    403: errorResponse('Not the instance admin'),
    409: errorResponse('A site with this key already exists'),
    503: errorResponse('The database is temporarily unavailable'),
  },
})

registry.registerPath({
  method: 'patch',
  path: '/api/admin/sites/{siteKey}',
  tags: ['sites'],
  summary: 'Update a site (name, comment length limit, access level and gateway mode)',
  request: {
    params: z.strictObject({ siteKey: siteKeyParamSchema }),
    body: { content: json(siteUpdateSchema) },
  },
  security: sessionOrServiceKey,
  responses: {
    200: ok(z.strictObject({ site: adminSiteCreatedSchema })),
    400: errorResponse('Invalid body, or no field to update was given'),
    401: errorResponse('No session'),
    403: errorResponse('Not an admin of that site'),
    404: errorResponse('The site does not exist'),
    503: errorResponse('The database is temporarily unavailable'),
  },
})

registry.registerPath({
  method: 'delete',
  path: '/api/admin/sites/{siteKey}',
  tags: ['sites'],
  summary: 'Delete a site',
  description: 'Cascades to the pages, comments, origins, memberships and API keys of that site.',
  request: { params: z.strictObject({ siteKey: siteKeyParamSchema }) },
  security: sessionOrServiceKey,
  responses: {
    200: ok(deletedResultSchema),
    401: errorResponse('No session'),
    403: errorResponse('Not an admin of that site'),
    404: errorResponse('The site does not exist'),
    503: errorResponse('The database is temporarily unavailable'),
  },
})

registry.registerPath({
  method: 'get',
  path: '/api/admin/pages',
  tags: ['pages'],
  summary: 'List the registered threads of a site',
  request: { query: pagesQuerySchema },
  security: sessionOrServiceKey,
  responses: {
    200: ok(z.strictObject({ pages: z.array(ModerationPageSummary) })),
    401: errorResponse('No session'),
    403: errorResponse('Not a member of that site'),
    404: errorResponse('The site does not exist'),
    503: errorResponse('The database is temporarily unavailable'),
  },
})

registry.registerPath({
  method: 'get',
  path: '/api/admin/takedowns',
  tags: ['moderation'],
  summary: 'List the hidden and deleted comments of a site',
  description: 'Newest first. `recentDays` bounds the window by comment date; 0 means all time.',
  request: { query: takedownsQuerySchema },
  security: [sessionCookie],
  responses: {
    200: ok(z.strictObject({ takedowns: z.array(moderationTakedownSchema), total: z.number().int() })),
    401: errorResponse('No session'),
    403: errorResponse('Not a moderator of that site'),
    404: errorResponse('The site does not exist'),
    503: errorResponse('The database is temporarily unavailable'),
  },
})

registry.registerPath({
  method: 'post',
  path: '/api/admin/pages',
  tags: ['pages'],
  summary: 'Register a page thread up front',
  description:
    'Lets a publishing pipeline claim a page key before the first comment lands. It is idempotent for the same site and URL.',
  request: { body: { content: json(pageBodySchema) } },
  security: sessionOrServiceKey,
  responses: {
    200: ok(z.strictObject({ page: sitePageSchema })),
    400: errorResponse('Invalid body'),
    401: errorResponse('No session'),
    403: errorResponse('Not a member of that site'),
    404: errorResponse('The site does not exist'),
    409: errorResponse('The page key belongs to another page'),
    503: errorResponse('The database is temporarily unavailable'),
  },
})

registry.registerPath({
  method: 'delete',
  path: '/api/admin/pages/{pageId}',
  tags: ['pages'],
  summary: 'Delete a page permanently, with its comments, replies and votes',
  description:
    'Permanent and audited. The page, every comment and reply on it, and their votes are removed in one transaction. The site’s blocks, verifications, memberships and origins are kept. The audit row keeps the page URL. Deleting a page that does not exist returns 404 PAGE_NOT_FOUND.',
  request: { params: z.strictObject({ pageId: commentIdSchema }), query: siteQuerySchema },
  security: sessionOrServiceKey,
  responses: {
    200: ok(pageDeletedSchema),
    400: errorResponse('Invalid query parameters'),
    401: errorResponse('No session'),
    403: errorResponse('Not a site admin (sessions) or a pages:delete key bound to another site'),
    404: errorResponse('The page does not exist on this site'),
  },
})

registry.registerPath({
  method: 'delete',
  path: '/api/admin/pages',
  tags: ['pages'],
  summary: 'Delete a page by its pageKey or URL, permanently',
  description:
    'Same effect as deleting by pageId. Give exactly one of pageKey (the stable key a publisher registered) or url (the page’s canonical URL). Use pageKey for a CMS, where the key outlives slug changes.',
  request: { query: pageDeleteQuerySchema },
  security: sessionOrServiceKey,
  responses: {
    200: ok(pageDeletedSchema),
    400: errorResponse('Invalid query, or neither or both of pageKey and url'),
    401: errorResponse('No session'),
    403: errorResponse('Not a site admin (sessions) or a pages:delete key bound to another site'),
    404: errorResponse('The page does not exist on this site'),
  },
})

registry.registerPath({
  method: 'get',
  path: '/api/admin/pages/{pageId}',
  tags: ['pages'],
  summary: 'Read one page thread with its own totals, trend and activity',
  description:
    'Returns the thread of one page: its summary, the comment totals, a zero-filled daily series, the top authors and the moderation actions of the page and its comments.',
  request: { params: z.strictObject({ pageId: commentIdSchema }), query: statsQuerySchema },
  security: sessionOrServiceKey,
  responses: {
    200: ok(
      z.strictObject({
        siteName: z.string(),
        bodyLimit: z.number().int(),
        page: ModerationPageSummary,
        stats: PageThreadStats,
      }),
    ),
    400: errorResponse('Invalid query parameters'),
    401: errorResponse('No session'),
    403: errorResponse('Not a member of that site'),
    404: errorResponse('The site or the page does not exist'),
    503: errorResponse('The database is temporarily unavailable'),
  },
})

registry.registerPath({
  method: 'get',
  path: '/api/admin/stats',
  tags: ['stats'],
  summary: 'Dashboard totals, trend, top threads and moderation activity',
  request: { query: statsQuerySchema },
  security: sessionOrServiceKey,
  responses: {
    200: ok(z.strictObject({ stats: SiteDashboardStats })),
    400: errorResponse('Invalid query parameters'),
    401: errorResponse('No session'),
    403: errorResponse('Not a member of that site'),
    404: errorResponse('The site does not exist'),
    503: errorResponse('The database is temporarily unavailable'),
  },
})

registry.registerPath({
  method: 'get',
  path: '/api/admin/users',
  tags: ['users'],
  summary: 'List the user directory of a site',
  description:
    'Everyone relevant to one site — commenters, site members and actively blocked users — newest registration first. Guests never appear. Session-only: names and emails are never served to service keys, and site moderators are excluded — only instance admins and site admins may read the directory.',
  request: { query: usersQuerySchema },
  security: [sessionCookie],
  responses: {
    200: ok(z.strictObject({ users: z.array(SiteUser), total: z.number().int() })),
    400: errorResponse('Invalid query parameters'),
    401: errorResponse('No session'),
    403: errorResponse('Not an admin of that site'),
    404: errorResponse('The site does not exist'),
    503: errorResponse('The database is temporarily unavailable'),
  },
})

registry.registerPath({
  method: 'get',
  path: '/api/admin/users/{userId}/comments',
  tags: ['users'],
  summary: "Read one user's comment history on a site",
  description:
    'Every comment one user posted on one site, newest first, hidden and deleted rows included. Powers the user history drawer. Session-only.',
  request: {
    params: z.strictObject({ userId: z.string().describe('The user id') }),
    query: userCommentsQuerySchema,
  },
  security: [sessionCookie],
  responses: {
    200: ok(z.strictObject({ comments: z.array(UserCommentHistoryItem), total: z.number().int() })),
    400: errorResponse('Invalid query parameters'),
    401: errorResponse('No session'),
    403: errorResponse('Not a member of that site'),
    404: errorResponse('The site does not exist'),
    503: errorResponse('The database is temporarily unavailable'),
  },
})

registry.registerPath({
  method: 'get',
  path: '/api/admin/settings',
  tags: ['settings'],
  summary: 'Read the read-only instance settings snapshot',
  description:
    'Plugin status, auth providers and comment settings for the Settings page. Booleans and names only — secrets never leave the server. Instance admins only, session-only.',
  request: {},
  security: [sessionCookie],
  responses: {
    200: ok(InstanceSettings),
    401: errorResponse('No session'),
    403: errorResponse('Not an administrator'),
    503: errorResponse('The database is temporarily unavailable'),
  },
})

registry.registerPath({
  method: 'get',
  path: '/api/admin/api-keys',
  tags: ['api-keys'],
  summary: 'List your own API keys with scopes and site bindings',
  security: [sessionCookie],
  responses: {
    200: ok(z.strictObject({ keys: z.array(ApiKeyListItem) })),
    401: errorResponse('No session'),
    503: errorResponse('The database is temporarily unavailable'),
  },
})

registry.registerPath({
  method: 'post',
  path: '/api/admin/api-keys',
  tags: ['api-keys'],
  summary: 'Issue a service API key',
  description:
    'Instance keys (no `siteKey`) manage sites. Site keys bind to exactly one site and manage its threads. The plaintext `key` is returned once.',
  request: { body: { content: json(createBodySchema) } },
  security: [sessionCookie],
  responses: {
    200: ok(z.strictObject({ key: ApiKey })),
    400: errorResponse('Invalid body or scope set'),
    401: errorResponse('No session'),
    403: errorResponse('Not an admin of that site'),
    404: errorResponse('The site does not exist'),
    503: errorResponse('The database is temporarily unavailable'),
  },
})

registry.registerPath({
  method: 'patch',
  path: '/api/admin/api-keys',
  tags: ['api-keys'],
  summary: 'Change the scopes or the enabled flag of an API key',
  request: { body: { content: json(scopesBodySchema) } },
  security: [sessionCookie],
  responses: {
    200: ok(updatedResultSchema),
    400: errorResponse('Invalid body or scope set'),
    401: errorResponse('No session'),
    403: errorResponse('Not the owner of that key'),
    404: errorResponse('The key does not exist'),
    503: errorResponse('The database is temporarily unavailable'),
  },
})

registry.registerPath({
  method: 'delete',
  path: '/api/admin/api-keys',
  tags: ['api-keys'],
  summary: 'Delete one of your API keys',
  description: 'The key must belong to the given scope; callers need to own the key or be the instance admin.',
  request: { query: deleteQuerySchema },
  security: [sessionCookie],
  responses: {
    200: ok(deletedResultSchema),
    400: errorResponse('Invalid query parameters'),
    401: errorResponse('No session'),
    403: errorResponse('Not the owner of that key'),
    404: errorResponse('The key does not exist'),
    503: errorResponse('The database is temporarily unavailable'),
  },
})

registry.registerPath({
  method: 'get',
  path: '/api/session',
  tags: ['session'],
  summary: 'Resolve the current session through every enabled auth provider',
  description:
    'Provider-neutral session probe for the dashboard UI. Anonymous callers get `{ principal: null }`, never a 401.',
  request: {},
  responses: {
    200: ok(z.strictObject({ principal: SessionPrincipal.nullable() })),
  },
})

registry.registerPath({
  method: 'get',
  path: '/api/auth-providers',
  tags: ['session'],
  summary: 'List the enabled interactive-login providers',
  description: 'Public, no secrets — the sign-in UI renders the matching form from this list.',
  request: {},
  responses: {
    200: ok(AuthProviders),
  },
})

registry.registerPath({
  method: 'get',
  path: '/api/initial-admin',
  tags: ['setup'],
  summary: 'Check whether the initial admin setup is still available',
  request: {},
  responses: {
    200: ok(z.strictObject({ available: z.boolean() })),
    503: errorResponse('The database is temporarily unavailable'),
  },
})

registry.registerPath({
  method: 'post',
  path: '/api/initial-admin',
  tags: ['setup'],
  summary: 'Create the first instance admin',
  description: 'Only available while no user and no instance admin exist.',
  request: { body: { content: json(initialAdminSchema) } },
  responses: {
    200: ok(z.strictObject({ user: User })),
    400: errorResponse('Invalid body'),
    403: errorResponse('The request origin is not the application origin'),
    409: errorResponse('The setup has already been used'),
    503: errorResponse('The database is temporarily unavailable'),
  },
})

registry.registerPath({
  method: 'get',
  path: '/api/live',
  tags: ['health'],
  summary: 'Liveness probe',
  description: 'Answers as long as the process is alive. It never touches the database.',
  request: {},
  responses: {
    200: ok(LiveReport),
  },
})

registry.registerPath({
  method: 'get',
  path: '/api/ready',
  tags: ['health'],
  summary: 'Readiness probe',
  description: 'Probes the database. Answers 503 with the report when the database is degraded.',
  request: {},
  responses: {
    200: ok(HealthReport),
    503: {
      description: 'The database is degraded',
      content: json(HealthReport),
    },
  },
})

export function buildOpenApiDocument(serverUrl: string) {
  return new OpenApiGeneratorV31(registry.definitions).generateDocument({
    openapi: '3.1.0',
    info: {
      version: '1.0.0',
      title: 'Last Comments API',
      description:
        'The comment, moderation and publisher API of a Last Comments server. Successful responses are wrapped in `{ "data": ... }`, failures answer `{ "error": { "code": "...", "message": "..." } }`. The authentication endpoints are documented separately on the auth reference page.',
    },
    servers: [{ url: serverUrl }],
  })
}
