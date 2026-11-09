# Graph Report - last-comments  (2026-11-04)

## Corpus Check
- 492 files · ~224,930 words
- Verdict: corpus is large enough that graph structure adds value.
- Unclassified: 16 file(s) not represented in the graph (top: (none) 6, .css 4, .ttf 2)

## Summary
- 2882 nodes · 8511 edges · 159 communities (133 shown, 26 thin omitted)
- Extraction: 98% EXTRACTED · 2% INFERRED · 0% AMBIGUOUS · INFERRED: 188 edges (avg confidence: 0.86)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `6a73470f`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- oidc-jwt.ts
- HttpError
- recent-view.tsx
- schema.ts
- _admin.moderation.tsx
- sites-view.tsx
- Admin Page Routes
- _admin.settings.tsx
- health-handler.ts
- compose.yaml
- ref_bun_test
- comment-reactions.ts
- src/server AGENTS.md
- withContext
- Notifications Plugin Config
- OpenAPI Registry
- image-prep.ts
- vite.config.ts
- _payload.tsx
- errors.ts
- sidebar.tsx
- OpenRouter Filter Client
- vite-logger.ts
- comment-repository.ts
- blog-seo.ts
- business-sql.ts
- Fonts & OG Artwork
- admin-sidebar.tsx
- _admin.moderation.tsx
- about.tsx
- reactions.ts
- pages-view.tsx
- Filter Decider Evaluation
- API Key Library
- api-key-repository.ts
- settings.ts
- filter.config.ts
- filter.plugin.ts
- notifications.config.ts
- business-auth.ts
- rate-limit.plugin.ts
- logger-format.ts
- dropdown-menu.tsx
- comment-plugins.ts
- api.auth.$.ts
- comment-writes.ts
- post-card.tsx
- landing-framework-section.tsx
- Key permissions table
- Theming Docs
- toast.tsx
- comment-schemas.ts
- Self-Hosting & CD Docs
- Widget Props Docs
- payload.config.ts
- Moderation Route & Origins
- comment-plugins.ts
- Client Library Docs
- admin-repository.ts
- migrate
- alert-dialog.tsx
- Plugin Contract Docs
- Site Access Help
- turnstile.plugin.ts
- header-provider.ts
- Badges & Empty States
- API Keys Docs
- Filter Decider Docs
- Angular Widget Docs
- Moderation Widget Docs
- Auth Button
- environment
- Notifications Plugin Docs
- Plugin Docs & Events
- Seed Scripts Docs
- env
- x-app-environment
- Empty State Components
- Page Deletion & Reactions
- site-schema.ts
- @lst97-oss/last-comments-widgets package
- check
- docs.$.tsx
- mobile-nav.tsx
- with
- logger.ts
- compose.yaml
- registered-origins.ts
- Badge Variants
- Pending Buttons & Mutations
- Chart Panels
- Leaderboards
- Admin Screen State
- Boot Contract Rules
- app
- Leaderboard Component
- Payload Shutdown Hooks
- worker
- Markdown Docs
- Design Guidance
- steps
- sitemap[.]xml.ts
- ci.yml
- Archivo Black Font
- Access Levels Changelog
- use-mobile.ts
- env
- better-auth provider (email/password plus Google OAuth)
- turnstile.config.ts
- Admin CSS Generator
- comment-caller.test.ts
- router.tsx
- x-app-service
- Button
- cd.yml
- Admin Notifications Changelog
- deploy
- Visitor Headers & Budgets
- landing-framework-section.tsx
- Image Filter Pipeline
- React Compiler annotation mode
- Comment Scopes & Gateway
- steps
- API Key Docs
- CSS & Tailwind Design
- Security Policy
- Admin Grant Docs
- Idle DB Connections
- Same-Origin TLS
- Permitted Origin Threads
- Turnstile Commenters
- Error Content Codes
- Signed-In Fallback
- Mobile-First Design
- docker
- index.ts
- Bad-Words Semantics
- workflow_run
- decider-prompt.ts
- env
- env
- CLAUDE.md
- .claude/CLAUDE.md
- auth.config.ts
- site-users.ts
- @lst97-oss/last-comments-widgets package
- formatClockTime
- resolve.ts
- Access levels (open, login, private)
- payload-config-hooks.test.ts
- admin-users.integration.test.ts
- AdminQueryError
- Per-site comment length limit

## God Nodes (most connected - your core abstractions)
1. `HttpError` - 129 edges
2. `getBusinessDb()` - 85 edges
3. `Button()` - 69 edges
4. `withContext()` - 69 edges
5. `ErrorCode` - 47 edges
6. `SitesView()` - 45 edges
7. `RecentView()` - 41 edges
8. `sites` - 41 edges
9. `Card()` - 39 edges
10. `CardHeader()` - 35 edges

## Surprising Connections (you probably didn't know these)
- `Moderation Dashboard Story` --semantically_similar_to--> `Moderation Screen`  [INFERRED] [semantically similar]
  scripts/seeds/introducing-last-comments.md → .agents/skills/admin-design-structure/rules/screens.md
- `React Compiler annotation mode` --references--> `SitesView()`  [EXTRACTED]
  .agents/skills/react-admin-patterns/rules/react-compiler.md → src/components/admin/sites-view.tsx
- `Guest edit window (comment-policy.config.ts, default 10 minutes)` --conceptually_related_to--> `Anonymous edit window (anonEditWindowMinutes, default 10)`  [AMBIGUOUS]
  README.md → content/docs/identity.mdx
- `Per-request ordering: rate-limit, Turnstile, filter, persist` --references--> `installedCommentPlugins manifest`  [AMBIGUOUS]
  src/server/plugins/filter/README.md → content/docs/plugins.mdx
- `Credentialed CORS for registered origins` --semantically_similar_to--> `Credentialed CORS for registered origins (install guide)`  [INFERRED] [semantically similar]
  CHANGELOG.md → content/docs/install.mdx

## Import Cycles
- 3-file cycle: `src/server/plugins/comment-plugins.ts -> src/server/plugins/config.ts -> src/server/plugins/notifications/notifications.plugin.ts -> src/server/plugins/comment-plugins.ts`

## Hyperedges (group relationships)
- **Shared Admin Panel Family** — _agents_skills_admin_design_structure_skill_statcard, _agents_skills_admin_design_structure_rules_charts_comment_activity_panel, _agents_skills_admin_design_structure_rules_charts_comment_status_pie, _agents_skills_admin_design_structure_rules_charts_votes_panel, _agents_skills_admin_design_structure_rules_charts_visible_rate_panel, _agents_skills_admin_design_structure_rules_leaderboards_leaderboard [EXTRACTED 1.00]
- **Image build, publish and production deploy** — _github_workflows_ci_docker, _github_workflows_ci_ghcr_image, _github_workflows_cd, _github_workflows_cd_deploy, dockerfile, compose [EXTRACTED 1.00]
- **Compose services sharing YAML anchors** — compose_app_environment, compose_app_service, compose_migrate, compose_app, compose_worker [EXTRACTED 1.00]
- **Failure-mode policy across comment plugins (fail-closed Turnstile and rate limit, fail-open filter by default)** — content_docs_plugins_turnstile_plugin, readme_rate_limit_plugin, content_docs_plugins_filter_plugin, content_docs_plugins_fail_open_closed_policy [EXTRACTED 1.00]
- **Effects that must stay (external synchronization)** — src_components_blog_blog_markdown, src_components_landing_landing_code_block, src_components_blog_mermaid_diagram, src_hooks_use_window_event, src_hooks_use_blog_thread, src_routes__payload [EXTRACTED 1.00]
- **Business Slice Layer Model** — src_server_agents_layer_direction, src_server_readme_request_flow, src_server_agents_health_reference_slice, src_server_agents_new_module_recipe, src_server_agents_response_envelope [EXTRACTED 1.00]
- **themeVars object shared by React, Angular, plain HTML and the read-only viewer** — content_docs_theming_themevars, content_docs_widgets_react_themevars_prop, content_docs_widgets_angular_signal_inputs, content_docs_widgets_html_mount_comments_api, content_docs_widgets_viewer_shared_theme_tokens [EXTRACTED 1.00]
- **Per-request comment write pipeline (rate-limit, Turnstile, filter, persist)** — content_docs_plugins_turnstile_plugin, readme_rate_limit_plugin, content_docs_plugins_filter_plugin, src_server_plugins_filter_readme_request_ordering [INFERRED 0.85]

## Communities (159 total, 26 thin omitted)

### Community 0 - "oidc-jwt.ts"
Cohesion: 0.14
Nodes (16): base64UrlDecode(), clearOidcCache(), extractBearer(), hashForAlg(), importJwk(), Jwk, JwksDocument, loadJwks() (+8 more)

### Community 1 - "HttpError"
Cohesion: 0.20
Nodes (26): Route, pageRef(), Route, Route, Route, Route, resolveSessionPrincipal(), applyCors() (+18 more)

### Community 2 - "recent-view.tsx"
Cohesion: 0.07
Nodes (67): ApiKeyRow(), Checklist(), ChecklistGroup, ChecklistItem, PermissionPicker(), scopeGroups(), SiteSettings, RangeToggle() (+59 more)

### Community 3 - "schema.ts"
Cohesion: 0.08
Nodes (34): email, BusinessDb, ExternalIdentityInput, account, accountRelations, commentReactions, commentStatus, externalIdentities (+26 more)

### Community 4 - "_admin.moderation.tsx"
Cohesion: 0.09
Nodes (44): AccountTextField(), PasswordLoginForm(), siteExample(), ApiKeyCreateDialog(), PageCreateDialog(), PageForm, pageFormSchema(), pageUrlFrom() (+36 more)

### Community 5 - "sites-view.tsx"
Cohesion: 0.09
Nodes (68): AdminLogin(), DashboardAccessDenied(), Hint(), PagesView(), ACTIVITY_CONFIG, CommentActivityPanel(), CommentStatusPie(), ModerationActionCount (+60 more)

### Community 6 - "Admin Page Routes"
Cohesion: 0.15
Nodes (36): requirePageDetailAccess(), Route, requirePageAccess(), Route, requireSiteCreator(), requireSiteReader(), Route, requireSiteWriter() (+28 more)

### Community 7 - "_admin.settings.tsx"
Cohesion: 0.12
Nodes (22): ICON_TONE, SettingRow(), SettingState(), SettingTone, SettingView, TINT, readHidden(), setTourHidden() (+14 more)

### Community 8 - "health-handler.ts"
Cohesion: 0.17
Nodes (12): DbProbe, getHealth(), GetHealthDeps, buildHealthReport(), buildLiveReport(), HealthCheckState, HealthReport, LiveReport (+4 more)

### Community 9 - "compose.yaml"
Cohesion: 0.07
Nodes (28): .bun-version, cd.yml production deploy workflow, Readiness wait on /api/ready, Production .env composed from GitHub secrets, cd deploy job, GitHub production environment, Deploy over Tailscale SSH, ci.yml workflow (+20 more)

### Community 10 - "ref_bun_test"
Cohesion: 0.08
Nodes (49): getBusinessDb(), toBunSqlUrl(), siteMemberships, siteOrigins, sites, listRegisteredOrigins(), db(), now (+41 more)

### Community 11 - "comment-reactions.ts"
Cohesion: 0.14
Nodes (29): pages, normalizePageKey(), normalizePageUrl(), toReactionSummaries(), SWITCH_COPY, scrubCommentEventText(), pageMatch(), resolvePage() (+21 more)

### Community 12 - "src/server AGENTS.md"
Cohesion: 0.07
Nodes (35): Turnstile testing keys (Compose defaults), Introducing last-comments Blog Post, Architecture Flowchart, Payload CMS vs Business Postgres Split, Guest Edit Keys and Unlimited Author Edits, One Widget, Four Frameworks, Comment Plugin System, Publisher API (pages:write) (+27 more)

### Community 13 - "withContext"
Cohesion: 0.12
Nodes (19): Route, Route, Route, Route, Route, Route, Route, robotsTxtResponse() (+11 more)

### Community 14 - "Notifications Plugin Config"
Cohesion: 0.11
Nodes (19): CommentPluginEvent, NotificationEventKind, excerpt(), FormatInput, formatNotification(), FormattedNotification, moderationUrl(), NotificationKind (+11 more)

### Community 15 - "OpenAPI Registry"
Cohesion: 0.08
Nodes (40): errorResponse(), json(), ok(), ReactionSummaries, registry, serviceKey, sessionCookie, sessionOrServiceKey (+32 more)

### Community 16 - "image-prep.ts"
Cohesion: 0.13
Nodes (19): ALLOWED_PORTS, BLOCKED_V4, extractImageUrls(), fetchAndShrink(), Fetcher, fetchPublic(), HostResolver, ImagePrepSettings (+11 more)

### Community 18 - "_payload.tsx"
Cohesion: 0.14
Nodes (10): adminRenderServerFn, payloadLayoutServerFn, payloadServerFn, payloadServerFunctionClient, Route, Route, layout, PayloadLayout() (+2 more)

### Community 19 - "errors.ts"
Cohesion: 0.11
Nodes (23): Route, Route, Route, applyPublicCors(), databaseUnavailableCodes, ErrorCode, getDatabaseErrorCode(), toHttpError() (+15 more)

### Community 20 - "sidebar.tsx"
Cohesion: 0.19
Nodes (12): SidebarContext, SidebarContextProps, SidebarInput(), SidebarMenuButton(), sidebarMenuButtonVariants, SidebarMenuSkeleton(), SidebarRail(), useSidebar() (+4 more)

### Community 21 - "OpenRouter Filter Client"
Cohesion: 0.12
Nodes (17): ResolvedFilterConfig, callDecider(), CallDeciderInput, createFetchSender(), DeciderError, DeciderQuestion, DeciderReason, DeciderRequest (+9 more)

### Community 22 - "vite-logger.ts"
Cohesion: 0.18
Nodes (13): classifyEnvRunnerLine(), classifyViteLine(), consolaLevel(), plainLines(), routeConsola(), routeDevToolLogs(), routeEnvRunnerWarnings(), Rule (+5 more)

### Community 23 - "comment-repository.ts"
Cohesion: 0.09
Nodes (46): Route, comments, userBlocks, votes, editModerationCommentData(), listCommentReactions(), listPageComments(), getPageCanonicalUrl() (+38 more)

### Community 24 - "blog-seo.ts"
Cohesion: 0.45
Nodes (9): absoluteCoverUrl(), absoluteUrl(), buildBlogPostingJsonLd(), postCanonicalUrl(), postSeoDescription(), SeoPostLike, stripMarkdownToText(), BlogPostPage() (+1 more)

### Community 25 - "business-sql.ts"
Cohesion: 0.07
Nodes (29): assertLocalBusinessTarget(), LOCAL_HOSTS, DROPS, migrate, sql, Case, cases, main() (+21 more)

### Community 26 - "Fonts & OG Artwork"
Cohesion: 0.12
Nodes (21): Per-page social share cards (/og), OG_FRAMEWORKS, og-artwork.webp, fitWithEllipsis(), measureText(), normalizeText(), renderTextPaths(), TextPathOptions (+13 more)

### Community 27 - "admin-sidebar.tsx"
Cohesion: 0.18
Nodes (21): ADMIN_NAV, AdminNavGroup, AdminNavItem, AdminSidebar(), MODERATION_SUBS, ModerationNav(), SiteSwitcher(), ThemeToggle() (+13 more)

### Community 28 - "_admin.moderation.tsx"
Cohesion: 0.06
Nodes (48): AdminLoginForm(), ExternalLoginNotice(), AdminTourButton(), anchorFor(), isOnPage(), startAdminTour(), AdminTour, AdminTourAction (+40 more)

### Community 29 - "about.tsx"
Cohesion: 0.19
Nodes (17): AboutContent(), PRINCIPLES, GithubIcon(), LandingRail(), OG_IMAGE_HEIGHT, OG_IMAGE_ROUTE, OG_IMAGE_WIDTH, ogImageAlt() (+9 more)

### Community 30 - "reactions.ts"
Cohesion: 0.19
Nodes (11): Fixed reaction emoji set, COMMENT_BODY_LIMIT, SiteAccess, REACTION_EMOJIS, ReactionEmoji, ReactionRow, ReactionSummary, PublicSiteSettings (+3 more)

### Community 31 - "pages-view.tsx"
Cohesion: 0.34
Nodes (11): PageNumber, pageNumbers(), Pager(), Pagination(), PaginationContent(), PaginationEllipsis(), PaginationItem(), PaginationLink() (+3 more)

### Community 32 - "Filter Decider Evaluation"
Cohesion: 0.08
Nodes (20): ambiguous, CASES, Category, confidenceFor(), config, elapsed, enabled, EvalCase (+12 more)

### Community 33 - "API Key Library"
Cohesion: 0.11
Nodes (24): API_KEY_EXPIRY_OPTIONS, API_KEY_FEATURES, API_KEY_GUIDE_PATH, API_KEY_GUIDE_SITE_SECTION, ApiKeyExpiry, apiKeyExpirySchema, ApiKeyFeature, ApiKeyForm (+16 more)

### Community 34 - "api-key-repository.ts"
Cohesion: 0.13
Nodes (25): requireManagedKey(), requireScopeManager(), requireSiteAdminId(), Route, HttpError, requireDashboardUser(), assertValidScopeSet(), boundSiteKeyOf() (+17 more)

### Community 35 - "settings.ts"
Cohesion: 0.17
Nodes (21): getAuthConfig(), AuthProviderName, AuthSelection, getAuthSelection(), getHeaderProviderSettings(), getOidcSettings(), HeaderProviderSettings, isBetterAuthEnabled() (+13 more)

### Community 36 - "filter.config.ts"
Cohesion: 0.14
Nodes (21): Filter comment plugin (advisory hide-for-review), OpenRouter Decisions API decider, Per-plugin folder shape (<id>.plugin.ts, <id>.config.ts, README.md), Filter screening, filterConfigDef, resolveApiKey(), ALL_IMAGE_CATEGORIES, ALL_TEXT_CATEGORIES (+13 more)

### Community 37 - "filter.plugin.ts"
Cohesion: 0.19
Nodes (11): BadwordsFilter, BadwordsScreenResult, redact(), screenBadwords(), tokensOf(), applyVerdictThreshold(), createFilterPlugin(), loadBadwordsFilter() (+3 more)

### Community 38 - "notifications.config.ts"
Cohesion: 0.25
Nodes (10): eventsFromEnv(), eventsSchema, nonEmpty(), NOTIFICATION_CHANNEL_NAMES, NOTIFICATION_EVENT_KINDS, NotificationChannelName, notificationsConfigDef, NotificationsFileConfig (+2 more)

### Community 39 - "business-auth.ts"
Cohesion: 0.17
Nodes (12): businessApiKeyPlugin(), businessAuthEnvSchema, getBusinessAuthSettings(), optionalOAuthCredential, createBusinessAuth(), getBusinessAuth(), getBusinessSession(), getBusinessSetupAuth() (+4 more)

### Community 40 - "rate-limit.plugin.ts"
Cohesion: 0.15
Nodes (18): Rate-limit trusted ingress header rules, Plugin system, CommentOperation, installedCommentPlugins, filterPlugin, getRateLimitPluginSettings(), KEY_BUCKET_MULTIPLIER, parseTrustedProxyCidrs() (+10 more)

### Community 41 - "logger-format.ts"
Cohesion: 0.18
Nodes (19): cellValue(), errorKey(), formatPretty(), formatTime(), inlineValue(), isRecord(), isRecordList(), LEVEL_LABEL (+11 more)

### Community 42 - "dropdown-menu.tsx"
Cohesion: 0.15
Nodes (12): UserMenu(), DocsVersionSwitch(), DropdownMenu(), DropdownMenuContent(), DropdownMenuGroup(), DropdownMenuItem(), DropdownMenuLabel(), DropdownMenuSeparator() (+4 more)

### Community 43 - "comment-plugins.ts"
Cohesion: 0.17
Nodes (12): CommentCreationContext, CreateCommentData, CreateCommentDeps, CommentOperationInput, CommentPlugin, CommentValidationInput, EMPTY_SCREENING, SCREENING_TIMEOUT_MS (+4 more)

### Community 44 - "api.auth.$.ts"
Cohesion: 0.22
Nodes (16): allowedOrigin(), handleAuth(), respondWithCors(), Route, withCors(), Route, Route, isRegisteredAuthOrigin() (+8 more)

### Community 45 - "comment-writes.ts"
Cohesion: 0.14
Nodes (29): resolveBodyLimit(), getSiteRole(), MembershipRole, createComment(), createCommentData(), createModerationCommentData(), deleteCommentData(), editCommentData() (+21 more)

### Community 46 - "post-card.tsx"
Cohesion: 0.32
Nodes (7): PostCard(), PostRow(), ReadMore(), formatPostDate(), PostMeta(), BlogPostSummary, basePost

### Community 47 - "landing-framework-section.tsx"
Cohesion: 0.17
Nodes (23): AngularIcon(), HtmlIcon(), Icon(), ReactIcon(), VueIcon(), LandingCodeBlock(), FEATURES, LandingContent() (+15 more)

### Community 48 - "Key permissions table"
Cohesion: 0.12
Nodes (17): Deleted comments keep their place in the thread, Guest delete with edit key, comments:read (Show comments on pages), comments:write (Post comments for visitors), Relay guest edit key (editKey, x-lc-edit-key), Instance key (sites:* permissions), pages:read, pages:write (+9 more)

### Community 49 - "Theming Docs"
Cohesion: 0.14
Nodes (15): CSS variables mapping (kebab-case and --lc- prefix), Layout and control theme keys, Theming docs page, Plain HTML data-lc-theme-var attributes, Native CSS @scope scoping, Shape and typography theme keys, Status theme keys, Shared style hooks (.lc-* classes) (+7 more)

### Community 50 - "toast.tsx"
Cohesion: 0.12
Nodes (20): DiagramResult, DiagramStatus, LOADING, COPYRIGHT_YEAR, SiteFooter(), Toast(), ToastAction(), ToastClose() (+12 more)

### Community 51 - "comment-schemas.ts"
Cohesion: 0.08
Nodes (23): commentBodyMarkdown, actionSchema, commentBodySchema, commentIdSchema, commentReactionSchema, editBodySchema, editKeyHeaderSchema, listQuerySchema (+15 more)

### Community 52 - "Self-Hosting & CD Docs"
Cohesion: 0.21
Nodes (8): Composer posts through /api/moderation, settings policy prop, Admin endpoints (/api/admin), Comment endpoints (/api/comments family), Moderation endpoint (/api/moderation), llms.txt site overview, Liveness and readiness probes (/api/live, /api/ready), Response envelope ({data} or {error})

### Community 53 - "Widget Props Docs"
Cohesion: 0.13
Nodes (18): data-lc-* attribute table, dist/vanilla styles.css and index.js, marked importmap entry, Plain HTML widget docs page, data-lc-turnstile options, actionMode prop, anonEditWindowMinutes prop, bodyLimit prop (+10 more)

### Community 54 - "payload.config.ts"
Cohesion: 0.09
Nodes (23): Blog-thread ensure effect, Legitimate effects that must not be fixed, Payload 4.0.0-beta.2 upgrade and schema guard, env, Adding a Payload collection, DRY_RUN, POSTS, BlogThreadOptions (+15 more)

### Community 55 - "Moderation Route & Origins"
Cohesion: 0.20
Nodes (12): originServerFn, envSchema, optionalString, parseServerEnv(), ServerEnv, LOOPBACK_HOSTS, PayloadServerUrlError, resolvePayloadServerUrl() (+4 more)

### Community 56 - "comment-plugins.ts"
Cohesion: 0.10
Nodes (23): Plugin worker waits when nothing subscribes, HOOKS, logger, polling, startedAt, stop(), stopController, wake() (+15 more)

### Community 57 - "Client Library Docs"
Cohesion: 0.15
Nodes (15): Bring-Your-Own fetchImpl, Framework-Free Client API, buildCommentTree, describeError Copy Mapper, isEditWindowOpen / canModerate, Session and Sign-In Helpers, renderMarkdown / safeUrl, themeVars to CSS Variables (+7 more)

### Community 58 - "admin-repository.ts"
Cohesion: 0.12
Nodes (16): Route, apikey, apiKeySites, canCreateInitialAdmin(), createAdminSite(), deleteAdminSite(), updateAdminSite(), createSite() (+8 more)

### Community 59 - "migrate"
Cohesion: 0.11
Nodes (20): condition, app, TUNNEL_TOKEN, disable, command, extra_hosts, healthcheck, image (+12 more)

### Community 60 - "alert-dialog.tsx"
Cohesion: 0.26
Nodes (12): ConfirmDeleteDialog(), AlertDialog(), AlertDialogAction(), AlertDialogCancel(), AlertDialogContent(), AlertDialogDescription(), AlertDialogFooter(), AlertDialogHeader() (+4 more)

### Community 61 - "Plugin Contract Docs"
Cohesion: 0.22
Nodes (10): CommentPlugin contract, installedCommentPlugins manifest, Plugin system docs page, Plugin migrations (db:business:migrate), screenComment hook, Turnstile plugin, validateComment hook, Writing a plugin (rate-limit and Turnstile reference pair) (+2 more)

### Community 62 - "Site Access Help"
Cohesion: 0.34
Nodes (11): SERVER_NOTES, SiteAccessHelp(), Sheet(), SheetContent(), SheetDescription(), SheetHeader(), SheetOverlay(), SheetPortal() (+3 more)

### Community 63 - "turnstile.plugin.ts"
Cohesion: 0.17
Nodes (8): Turnstile verification, createTurnstilePlugin(), Fetcher, invalid(), loadRegisteredHostnames(), RegisteredHostnames, unavailable(), input

### Community 64 - "header-provider.ts"
Cohesion: 0.23
Nodes (12): RFC-1918, linkOrProvisionExternalUser(), maybeBootstrapInstanceAdmin(), HeaderDeps, resolveHeaderSession(), isProxySourceAllowed(), normalizeAddress(), peerAddress() (+4 more)

### Community 65 - "Badges & Empty States"
Cohesion: 0.18
Nodes (12): Admin Badges and Empty States Rule Doc, Admin Charts Rule Doc, Admin Leaderboards Rule Doc, renderLabel Slot, Admin Screens Rule Doc, Dashboard Screen, DashboardShell, Thread Detail Screen (+4 more)

### Community 66 - "API Keys Docs"
Cohesion: 0.17
Nodes (13): API keys and permissions guide, Scalar API references (/api/reference, /api/auth/reference), Caller kinds: instance admin, site admin, service key, Auth providers guide, Provider selection (first match wins, AUTH_PROVIDERS override), Roles: instance admin, site admin, member, Service keys (lck_ publisher keys), Identity and sign-in page (+5 more)

### Community 67 - "Filter Decider Docs"
Cohesion: 0.11
Nodes (17): bad-words engine, Filter plugin (hold-for-review screening), Image schemas (8 categories, incl. benign evidence-only), LLM decider engine (OpenRouter pplx-decider-v1.2), Text schemas (8 categories, per-schema opt-in), bad-words engine (lexical blocklist), Live decider eval (bun run eval:filter), OpenRouter Decisions API transport (/api/alpha/decisions) (+9 more)

### Community 68 - "Angular Widget Docs"
Cohesion: 0.19
Nodes (15): Self-hosting docs page, lc-comment-viewer selector, lc-comments selector (LcCommentsComponent), Angular widget docs page, Angular signal inputs (bound with [name]), (signIn) output, lc-vote-buttons and lcTurnstile directive, React other exports (CommentViewer, VoteButtons, CommentsTheme, WidgetTheme) (+7 more)

### Community 69 - "Moderation Widget Docs"
Cohesion: 0.18
Nodes (12): (moderated) output, Author role badges (Admin and Member), Inline moderation controls (viewerRole admin), Moderator identity and anonymous posts, onModerated callback across frameworks, Inline moderation docs page, Permanent page delete, pageId addresses the thread directly (+4 more)

### Community 70 - "Auth Button"
Cohesion: 0.16
Nodes (16): DashboardShell(), SidebarInset(), SidebarProvider(), SidebarTrigger(), TooltipProvider(), authClient, AuthProviderName, fetchSessionState() (+8 more)

### Community 71 - "environment"
Cohesion: 0.35
Nodes (19): environment, BETTER_AUTH_SECRET, BETTER_AUTH_URL, BUSINESS_DATABASE_URL, DATABASE_URL, HOST, LOG_COLOR, LOG_FORMAT (+11 more)

### Community 72 - "Notifications Plugin Docs"
Cohesion: 0.15
Nodes (11): /api/notifications-token endpoint, Code map of the four notifications modules, NOTIFICATIONS_* environment configuration, created event kind, deleted event kind, hidden event kind, pageReacted event kind, last-notifications server (bell and delivery) (+3 more)

### Community 73 - "Plugin Docs & Events"
Cohesion: 0.14
Nodes (13): Business events (events and handleEvent), plugins:work outbox worker, app service (Nitro server on port 3000), Business database (BUSINESS_DATABASE_URL), 0.3.0 requires a new empty business database, Cloudflare tunnel client IP headers, Docker Compose stack, migrate service (one-shot migrations) (+5 more)

### Community 74 - "Seed Scripts Docs"
Cohesion: 0.20
Nodes (11): Continuous deployment workflow (cd.yml), GitHub production environment secrets, bench-comments.ts read-path benchmark, Blog site recovery for an empty business DB, introducing-last-comments.md source post, Seeds README (idempotent demo content), publishedWhere visibility rule, seed-blog-site.ts blog site seeder (+3 more)

### Community 75 - "env"
Cohesion: 0.11
Nodes (18): BETTER_AUTH_SECRET, BLOG_PUBLISHER_API_KEY, BLOG_SITE_KEY, BUSINESS_DATABASE_URL, CLOUDFLARE_TUNNEL_TOKEN, DATABASE_URL, GHCR_TOKEN, GHCR_USER (+10 more)

### Community 76 - "x-app-environment"
Cohesion: 0.12
Nodes (16): x-app-environment, BETTER_AUTH_SECRET, BETTER_AUTH_URL, BUSINESS_DATABASE_URL, DATABASE_URL, HOST, LOG_COLOR, LOG_FORMAT (+8 more)

### Community 77 - "Empty State Components"
Cohesion: 0.18
Nodes (10): Empty State Component Family, Empty State Copy Table, CommentStatusPie, Leaderboard Empty Node Prop, threadLabel Fallback, Header Site and Range Controls, ADMIN_SITES_QUERY_KEY, setupRouterSsrQueryIntegration (+2 more)

### Community 78 - "Page Deletion & Reactions"
Cohesion: 0.18
Nodes (11): Permanent page deletion, Reaction rate-limit budgets, Reaction API routes, pages:delete, /api/admin/api-keys routes, /api/admin/pages routes, /api/admin/sites routes, GET /api/comments (+3 more)

### Community 79 - "site-schema.ts"
Cohesion: 0.10
Nodes (21): API_KEY_SCOPES, siteBodyLimitSchema, AccessOperation, anonymousAllowed(), SITE_ACCESS_LEVELS, bodyLimitFieldSchema, EditSiteForm, editSiteSchema (+13 more)

### Community 80 - "@lst97-oss/last-comments-widgets package"
Cohesion: 0.20
Nodes (11): API key error codes, API reference page, ORIGIN_NOT_ALLOWED (403), Request error codes, Documentation home page, Go deeper cards (install, self-hosting, theming, client, API), Registered origins can call the API directly, Widget picker cards (React, Vue, Angular, plain HTML) (+3 more)

### Community 81 - "check"
Cohesion: 0.17
Nodes (13): image, options, ports, runs-on, services, timeout-minutes, services, check (+5 more)

### Community 82 - "docs.$.tsx"
Cohesion: 0.06
Nodes (32): DocsMobileBar(), DocsMdxComponents, getMDXComponents(), MdxLink(), MDXProvidedComponents, useMDXComponents, DOC_ICONS, DocIconName (+24 more)

### Community 83 - "mobile-nav.tsx"
Cohesion: 0.33
Nodes (12): AuthButton(), MobileNav(), DASHBOARD_MENU, isActivePath(), isDashboardActive(), NAV, DashboardMenu(), SiteHeader() (+4 more)

### Community 84 - "with"
Cohesion: 0.17
Nodes (12): with, build-args, bun-version-file, cache-from, cache-to, context, load, password (+4 more)

### Community 85 - "logger.ts"
Cohesion: 0.09
Nodes (27): registeredOrigins, createLogger(), formatJson(), getRequestLogger(), LogFields, Logger, LogWriter, makeLogger() (+19 more)

### Community 86 - "compose.yaml"
Cohesion: 0.20
Nodes (9): Self-host Compose stack, name, name, volumes, media, x-app-service, extra_hosts, image (+1 more)

### Community 87 - "registered-origins.ts"
Cohesion: 0.28
Nodes (6): createRegisteredOrigins(), list(), refresh(), RegisteredOrigins, RegisteredOriginsOptions, RegisteredOriginSource

### Community 88 - "Badge Variants"
Cohesion: 0.22
Nodes (6): ThreadStatusBadge / ThreadKeyBadge, AccountTextField, Shared Admin Component Catalogue, ConfirmDeleteDialog, Hint, thread-status-badge.tsx Exports

### Community 90 - "Chart Panels"
Cohesion: 0.25
Nodes (6): CommentActivityPanel, VisibleRatePanel, VotesPanel, Shared Four Stat Card Slots, StatCard, stats-panels.tsx Exports

### Community 91 - "Leaderboards"
Cohesion: 0.25
Nodes (6): Leaderboard Component, LeaderboardItem Type, Leaderboard (admin design summary), Leaderboard (shared component doc), Biome Lint Enforcement Scope, Admin Change Verification Gates

### Community 92 - "Admin Screen State"
Cohesion: 0.22
Nodes (4): Moderation Screen, Dialog-Owned Mutation, FormDialog, Moderation Dashboard Story

### Community 93 - "Boot Contract Rules"
Cohesion: 0.22
Nodes (8): Admin CSS Real <link> Contract, Generated Files Are Script-Owned, migrate:create Value-Import Trap, Payload Migration Workflow (push:false), payloadParseSearch / payloadStringifySearch, handleServerFunctions RSC Passthrough, Vendored RSC-independent Payload Vite plugins, withPayloadRoot Admin Shell

### Community 94 - "app"
Cohesion: 0.18
Nodes (11): build, extra_hosts, image, ports, restart, stop_grace_period, volumes, BUN_VERSION (+3 more)

### Community 95 - "Leaderboard Component"
Cohesion: 0.44
Nodes (7): Leaderboard(), LeaderboardItem, Progress(), ProgressIndicator(), ProgressLabel(), ProgressTrack(), ProgressValue()

### Community 96 - "Payload Shutdown Hooks"
Cohesion: 0.29
Nodes (7): cachedPayloads(), countFailures(), Destroyable, destroyCachedPayloads(), drainAll(), logger, payloadShutdownPlugin()

### Community 97 - "worker"
Cohesion: 0.20
Nodes (10): depends_on, migrate, condition, worker, command, depends_on, extra_hosts, image (+2 more)

### Community 98 - "Markdown Docs"
Cohesion: 0.32
Nodes (7): Framework peer dependencies, Markdown rendering page, codeHighlight flag (data-lc-no-code-highlight), GitHub-flavored markdown renderer, Math (KaTeX) and Mermaid diagrams (opt-in renderers), renderMarkdown and safeUrl exports, Shiki syntax highlighting (React widget)

### Community 99 - "Design Guidance"
Cohesion: 0.29
Nodes (8): Accessible Interaction States, cn() and CVA Variant Pattern, Component Variant Architecture, Dark Mode Through The Same Tokens, Semantic Design Token Palette, shadcn Registry Primitives, Status Colour Semantics, WCAG AA Contrast Requirements

### Community 100 - "steps"
Cohesion: 0.20
Nodes (10): steps, name, run, uses, with, oauth-client-id, oauth-secret, ping (+2 more)

### Community 101 - "sitemap[.]xml.ts"
Cohesion: 0.23
Nodes (15): ALLOWED_PATHS, buildRobotsTxt(), DISALLOWED_PATHS, absoluteSiteUrl(), buildSitemapXml(), docsSitemapUrls(), escapeXml(), normalizeOrigin() (+7 more)

### Community 102 - "ci.yml"
Cohesion: 0.20
Nodes (9): concurrency, cancel-in-progress, group, jobs, name, on, pull_request, push (+1 more)

### Community 103 - "Archivo Black Font"
Cohesion: 0.43
Nodes (6): OFL Archivo Black License File, Archivo Black Font, Archivo Black Copyright Notice, SIL Open Font License 1.1, OFL JetBrains Mono License File, JetBrains Mono Font

### Community 104 - "Access Levels Changelog"
Cohesion: 0.29
Nodes (7): Per-site access levels (open, login, private), Business baseline migrations (fresh database required), Per-site page and comment reaction switches, sites.votes_enabled voting switch, API error codes (server-only), FEATURE_DISABLED (403), drizzle/business/0006_reactions.sql

### Community 105 - "use-mobile.ts"
Cohesion: 0.47
Nodes (3): getSnapshot(), subscribe(), useIsMobile()

### Community 106 - "env"
Cohesion: 0.29
Nodes (10): env, env, BETTER_AUTH_SECRET, BETTER_AUTH_URL, BUSINESS_DATABASE_URL, DATABASE_URL, PAYLOAD_BUNX_FLAGS, PAYLOAD_CLI_ARGS (+2 more)

### Community 107 - "better-auth provider (email/password plus Google OAuth)"
Cohesion: 0.20
Nodes (12): .env.example, Google sign-in links to existing account by email, better-auth provider (email/password plus Google OAuth), bootstrapEmail (first admin address), First admin setup (/create-admin-user), Google sign-in links existing account by email, header provider (reverse-proxy SSO), External identity mapping (external_identities) (+4 more)

### Community 108 - "turnstile.config.ts"
Cohesion: 0.16
Nodes (12): commentPolicyConfig, commentPolicyConfigDef, CommentPolicyFileConfig, commentPolicyFileSchema, definePluginConfig(), readSecret(), readSiteKey(), ResolvedTurnstileConfig (+4 more)

### Community 109 - "Admin CSS Generator"
Cohesion: 0.47
Nodes (5): collect(), main(), ROOTS, SKIPPED, toSpecifier()

### Community 110 - "comment-caller.test.ts"
Cohesion: 0.20
Nodes (6): CallerDeps, CallerSiteContext, CommentCaller, defaultCallerDeps, requestOrigin(), visitor

### Community 111 - "router.tsx"
Cohesion: 0.19
Nodes (7): getContext(), SiteError(), SiteNotFound(), getRouter(), Register, @tanstack/react-router, renderThrowingRoute()

### Community 112 - "x-app-service"
Cohesion: 0.53
Nodes (6): env_file, path, required, env_file, env_file, env_file

### Community 113 - "Button"
Cohesion: 0.13
Nodes (29): AdminFailure, AdminQueryError(), AdminFormApi, FormDialog(), SharePostDialog(), ThreadComments(), Alert(), AlertDescription() (+21 more)

### Community 114 - "cd.yml"
Cohesion: 0.22
Nodes (8): concurrency, cancel-in-progress, group, jobs, name, permissions, contents, packages

### Community 115 - "Admin Notifications Changelog"
Cohesion: 0.40
Nodes (5): Admin notifications (dashboard bell), Dashboard admin bell (notifications token), drizzle/business/0007_plugin_events_page_reacted.sql, Admin notifications plugin, notifications plugin folder

### Community 116 - "deploy"
Cohesion: 0.22
Nodes (9): env, environment, if, runs-on, timeout-minutes, PUBLIC_URL, name, url (+1 more)

### Community 117 - "Visitor Headers & Budgets"
Cohesion: 0.50
Nodes (5): Key-wide rate budget (50x visitor budget), x-lc-client verified visitor header, x-api-key and Authorization Bearer key headers, x-lc-client per-visitor header (API keys guide), x-lc-client (proxy visitor identity, auth guide)

### Community 118 - "landing-framework-section.tsx"
Cohesion: 0.11
Nodes (25): AdminNotificationBell(), BellConfig, readConfig(), BlogMarkdown(), BlogComments(), BlogMarkdownScope(), MermaidDiagram(), render() (+17 more)

### Community 121 - "React Compiler annotation mode"
Cohesion: 0.17
Nodes (9): Data Fetching Rule Doc, Mutations Rule Doc, React Compiler and use memo rules, 'use memo' function directive, Rendering Rule Doc, Shared Components Rule Doc, React Admin Patterns Skill, src/components/ui (vendored shadcn/Base UI) (+1 more)

### Community 123 - "steps"
Cohesion: 0.29
Nodes (8): steps, steps, LAST_COMMENTS_IMAGE, env, if, name, run, uses

### Community 139 - "docker"
Cohesion: 0.25
Nodes (8): needs, permissions, runs-on, timeout-minutes, docker, permissions, contents, packages

### Community 143 - "workflow_run"
Cohesion: 0.33
Nodes (6): on, workflow_dispatch, workflow_run, branches, types, workflows

### Community 144 - "decider-prompt.ts"
Cohesion: 0.26
Nodes (10): buildQuestions(), buildStateText(), buildUserText(), DECIDER_PROMPT_VERSION, DeciderUserInput, noul(), PREAMBLE, TEXT_QUESTION_RULES (+2 more)

### Community 145 - "env"
Cohesion: 0.50
Nodes (5): env, POSTGRES_DB, POSTGRES_PASSWORD, POSTGRES_USER, env

### Community 146 - "env"
Cohesion: 0.50
Nodes (4): env, APP_PORT, DEPLOY_SHA, IMAGE

### Community 149 - "auth.config.ts"
Cohesion: 0.20
Nodes (10): Typed TS instance config files, Auth configuration reference (file keys and env keys), authConfig, authConfigDef, AuthConfigProviderName, AuthFileConfig, authFileSchema, parseProvidersOverride() (+2 more)

### Community 150 - "site-users.ts"
Cohesion: 0.15
Nodes (13): INITIAL_MODERATION_VIEW, ModerationViewAction, moderationViewReducer(), ModerationViewState, INITIAL_USER_DIRECTORY, InstanceSettings, UserCommentHistoryItem, UserDirectoryAction (+5 more)

### Community 151 - "@lst97-oss/last-comments-widgets package"
Cohesion: 0.22
Nodes (9): Success and failure response envelope, Errors page, data-lc-error and data-error-code styling hooks, describeError helper, Single error block rendered by every widget, Package entry points, Quick start (Comments component embed), @lst97-oss/last-comments-widgets package (+1 more)

### Community 152 - "formatClockTime"
Cohesion: 0.70
Nodes (3): formatClockTime(), pad2(), pad3()

### Community 153 - "resolve.ts"
Cohesion: 0.33
Nodes (6): Principal, PrincipalCredential, SessionAdapter, SessionPrincipal, adapters, getSessionAdapters()

### Community 154 - "Access levels (open, login, private)"
Cohesion: 0.29
Nodes (7): Credentialed CORS for registered origins, Access levels (open, login, private), Session cookie scope (sibling subdomain only), Sign-in card on login and private sites, Reaching the API: same vs different registrable domain, Credentialed CORS for registered origins (install guide), /api/moderation is same-origin only

### Community 156 - "admin-users.integration.test.ts"
Cohesion: 0.29
Nodes (7): db, DirectoryIds, insertUser(), listHistory, listUsers, readSettings, setupDirectory()

### Community 157 - "AdminQueryError"
Cohesion: 0.40
Nodes (3): Session Principal Probe Query, Failure Reported Where Admin Looks, AdminQueryError

### Community 158 - "Per-site comment length limit"
Cohesion: 0.40
Nodes (5): Per-site comment length limit, GET /api/comments/settings public policy, GET /api/comments/settings, bodyLimit (default 10,000, counted before trimming), Composer toolbar and Write/Preview toggle

## Ambiguous Edges - Review These
- `RATE_LIMIT_TRUSTED_PROXY_CIDR` → `Layer Direction http → application → domain`  [AMBIGUOUS]
  src/server/plugins/rate-limit/README.md · relation: conceptually_related_to
- `Anonymous edit window (anonEditWindowMinutes, default 10)` → `Guest edit window (comment-policy.config.ts, default 10 minutes)`  [AMBIGUOUS]
  README.md · relation: conceptually_related_to
- `installedCommentPlugins manifest` → `Per-request ordering: rate-limit, Turnstile, filter, persist`  [AMBIGUOUS]
  src/server/plugins/filter/README.md · relation: references

## Knowledge Gaps
- **145 isolated node(s):** `RFC-1918`, `drizzle/business/0006_reactions.sql`, `Per-site access levels (open, login, private)`, `API error codes (server-only)`, `Google sign-in links to existing account by email` (+140 more)
  These have ≤1 connection - possible missing edges or undocumented components. (Counts symbols only; 890 node(s) total have ≤1 connection when file, concept and rationale nodes are included.)
- **26 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `Rate-limit plugin` connect `Plugin Contract Docs` to `rate-limit.plugin.ts`, `Plugin Docs & Events`?**
  _High betweenness centrality (0.137) - this node is a cross-community bridge._
- **What connects `RFC-1918`, `drizzle/business/0006_reactions.sql`, `Per-site access levels (open, login, private)` to the rest of the system?**
  _145 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `oidc-jwt.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.14285714285714285 - nodes in this community are weakly interconnected._
- **Why does `Plugin system docs page` connect `Plugin Contract Docs` to `Plugin Docs & Events`, `Angular Widget Docs`?**
  _High betweenness centrality (0.078) - this node is a cross-community bridge._
- **Should `recent-view.tsx` be split into smaller, more focused modules?**
  _Cohesion score 0.06641184902054467 - nodes in this community are weakly interconnected._

### Low-confidence Hints
_AMBIGUOUS edges — the extractor was unsure. Verify before acting on these._

- **What is the exact relationship between `RATE_LIMIT_TRUSTED_PROXY_CIDR` and `Layer Direction http → application → domain`?**
  _Edge tagged AMBIGUOUS (relation: conceptually_related_to) - confidence is low._
- **What is the exact relationship between `Anonymous edit window (anonEditWindowMinutes, default 10)` and `Guest edit window (comment-policy.config.ts, default 10 minutes)`?**
  _Edge tagged AMBIGUOUS (relation: conceptually_related_to) - confidence is low._