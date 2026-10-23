# Graph Report - last-comments  (2026-10-23)

## Corpus Check
- 440 files · ~222,894 words
- Verdict: corpus is large enough that graph structure adds value.
- Unclassified: 17 file(s) not represented in the graph (top: .css 5, (none) 5, .ttf 2)

## Summary
- 2357 nodes · 6473 edges · 139 communities (115 shown, 24 thin omitted)
- Extraction: 97% EXTRACTED · 3% INFERRED · 0% AMBIGUOUS · INFERRED: 187 edges (avg confidence: 0.85)
- Token cost: 0 input · 0 output

## Community Hubs (Navigation)
- Admin Forms & Dialogs
- Recent Activity UI
- Validation Schemas
- Admin Dashboard Screens
- Moderation & Auth Guards
- Payload & Site Shell
- Admin Auth UI
- Blog Rendering & Widgets
- Paging & Thread Badges
- Server Plugin Docs
- Runtime Dependencies
- Admin API Routes
- Demo Seed Scripts
- External Identity Providers
- Public API Routes
- Business DB Schema & Tests
- Vite & RSC Build Plugins
- Biome Lint Config
- Project Config & Manifest
- Comments API & Principals
- NPM Scripts
- Structured Logging
- OpenRouter Decider Client
- Payload CMS Config & Seeds
- API Keys & Scopes
- Navigation Dropdowns
- Health Probes
- OG Image Rendering
- Docs Site (Fumadocs)
- Filter Decider Eval
- Landing Page & OG Meta
- Filter Configuration
- Auth Provider Config
- shadcn components.json
- Site Header & Mobile Nav
- Auth & OpenAPI Endpoints
- Sidebar & Sheet Primitives
- API Key Management UI
- TypeScript Config
- Business DB Scripts
- Blog Cards & Landing Content
- Plugin Configuration Layer
- Filter Plugin Engine
- Admin Sidebar Navigation
- Integration Test Helpers
- Build Dev Dependencies
- Doc Icon Tree
- Business Auth Setup
- Turnstile Configuration
- Sitemap Generation
- Comment Creation & Plugin Contract
- Widget Markdown & Moderation
- Widget Client Helpers
- Confirm Dialog Primitives
- Auth File Configuration
- API Security & Docs
- Router & Root Provider
- Admin Design System Docs
- React Admin Data Rules
- shadcn Registry & MCP
- Chat UI Primitives
- CI/CD Pipelines
- Widget Theming Tokens
- Widget Framework Ports
- Admin Interaction Patterns
- Design System Color QA
- Business Auth Client
- Chart Primitives
- Blog Server Functions
- Admin User Tests
- Empty States & Query Keys
- Leaderboard Component
- Design System Showcase
- Authentication Providers
- Bad-Words Screening
- MDX Components
- Server Architecture Rules
- Server Env & URL Guard
- Decider Prompt Builder
- Filter Plugin Design
- Form & Input Primitives
- Widget Errors & Identity
- Widget Package Distribution
- Payload Shutdown Lifecycle
- Dual Database Architecture
- Blog SEO & JSON-LD
- Client IP Resolution
- Admin Shared Components
- Stat Cards & Panels
- Payload Boot Contract
- Showcase Coverage Script
- Architecture Blog Post
- Progress & Leaderboard UI
- Design Tokens & Visual Language
- Landing Hero ASCII Art
- Plugin Event Delivery
- robots.txt
- Turnstile Screening Order
- Rate-Limit Plugin
- Font Licenses
- React Admin Skill Docs
- React Compiler Mode
- Semantic Token System
- shadcn Composition Traps
- Mermaid & Skeleton UI
- OG Artwork Layers
- Filename Sanitizer
- shadcn CLI Workflow
- Vendored Vite Type Defs
- Admin CSS Generator
- Smoke Script
- Time Formatting
- shadcn Init & Presets
- Plugin Contract Docs
- shadcn Project Info
- Overlay Component Rules
- RSC ReactDOM Plugin
- Comment Deletion
- shadcn Logo Assets
- Toggle & Accordion Rules
- Favicon Assets
- Dev Start Script
- First-Admin Setup
- Control Height Rules
- Mobile Navigation Panel
- CSS Architecture Rules
- Blog Theme Inheritance
- Per-Page OG Cards
- Mobile-First Rules
- Script Reference

## God Nodes (most connected - your core abstractions)
1. `HttpError` - 90 edges
2. `Button()` - 63 edges
3. `@tanstack/react-router` - 61 edges
4. `react` - 58 edges
5. `withContext()` - 57 edges
6. `getBusinessDb()` - 50 edges
7. `cn` - 43 edges
8. `RecentView()` - 41 edges
9. `lucide-react` - 38 edges
10. `Card()` - 37 edges

## Surprising Connections (you probably didn't know these)
- `Same-Origin Credential Rule` --semantically_similar_to--> `Same-Origin API Proxy`  [INFERRED] [semantically similar]
  public/llms.txt → content/docs/install.mdx
- `data / error Envelope` --semantically_similar_to--> `API Response Envelope`  [INFERRED] [semantically similar]
  public/llms.txt → content/docs/api-reference.mdx
- `Moderation Dashboard Story` --semantically_similar_to--> `Moderation Screen`  [INFERRED] [semantically similar]
  scripts/seeds/introducing-last-comments.md → .agents/skills/admin-design-structure/rules/screens.md
- `Vendored Payload TanStack Vite README` --semantically_similar_to--> `Dual-Runtime Bun/Node Safety`  [INFERRED] [semantically similar]
  vendor/payload-tanstack-vite/README.md → src/server/AGENTS.md
- `Image Thumbnail Preparation` --semantically_similar_to--> `OFL JetBrains Mono License File`  [AMBIGUOUS] [semantically similar]
  src/server/plugins/filter/README.md → src/server/seo/fonts/OFL-JetBrains-Mono.txt

## Import Cycles
- 5-file cycle: `src/server/auth/business-auth.ts -> src/server/modules/admin/infrastructure/admin-repository.ts -> src/server/modules/comments/infrastructure/comment-repository.ts -> src/server/http/route-guards.ts -> src/server/auth/resolve.ts -> src/server/auth/business-auth.ts`

## Hyperedges (group relationships)
- **Built-in comment plugin trio** — content_docs_plugins_turnstile_plugin, content_docs_plugins_rate_limit_plugin, content_docs_plugins_filter_plugin, content_docs_plugins_comment_plugin_contract [EXTRACTED 1.00]
- **Four widget ports on one shared client** — content_docs_widgets_react_comments_component, content_docs_widgets_vue_comments_component, content_docs_widgets_angular_lc_comments, content_docs_widgets_html_mount_comments, content_docs_client_client_api [EXTRACTED 1.00]
- **Self-host deployment topology** — content_docs_self_hosting_compose_stack, compose_migrate_service, compose_app_service, compose_worker_service, compose_tunnel_service, content_docs_self_hosting_cd_pipeline [EXTRACTED 1.00]
- **shadcn Critical Rules** — _agents_skills_shadcn_skill_critical_rules, _agents_skills_shadcn_rules_styling_semantic_colors, _agents_skills_shadcn_rules_forms_field_group, _agents_skills_shadcn_rules_composition_items_inside_groups, _agents_skills_shadcn_rules_icons_data_icon_attribute, _agents_skills_shadcn_rules_base_vs_radix_aschild_vs_render, _agents_skills_shadcn_rules_chat_messagescroller [EXTRACTED 1.00]
- **CI to Production Deploy Pipeline** — _github_workflows_ci_check_job, _github_workflows_ci_docker_job, _github_workflows_ci_ghcr_publish, _github_workflows_cd_deploy_job, _github_workflows_cd_compose_up, _github_workflows_cd_readiness_gate [EXTRACTED 1.00]
- **DESIGN.md to Design System Page Flow** — _agents_skills_shadcn_design_system_design_md, _agents_skills_shadcn_design_system_style_picking, _agents_skills_shadcn_design_system_role_mapping, _agents_skills_shadcn_design_system_type_scale_utilities, _agents_skills_shadcn_design_system_control_heights, _agents_skills_shadcn_design_system_page_page_outline, _agents_skills_shadcn_design_system_page_state_matrix, _agents_skills_shadcn_design_system_page_color_pair [EXTRACTED 1.00]
- **Shared Admin Panel Family** — _agents_skills_admin_design_structure_skill_statcard, _agents_skills_admin_design_structure_rules_charts_comment_activity_panel, _agents_skills_admin_design_structure_rules_charts_comment_status_pie, _agents_skills_admin_design_structure_rules_charts_votes_panel, _agents_skills_admin_design_structure_rules_charts_visible_rate_panel, _agents_skills_admin_design_structure_rules_leaderboards_leaderboard [EXTRACTED 1.00]
- **Comment Screening Pipeline Order** — src_server_plugins_rate_limit_readme_rate_limit_plugin, src_server_plugins_turnstile_readme_turnstile_plugin, src_server_plugins_filter_readme_filter_plugin, src_server_plugins_filter_readme_screening_order [EXTRACTED 1.00]
- **Business Slice Layer Model** — src_server_agents_layer_direction, src_server_readme_request_flow, src_server_agents_health_reference_slice, src_server_agents_new_module_recipe, src_server_agents_response_envelope [EXTRACTED 1.00]
- **shadcn/ui Brand Asset Family** — _agents_skills_shadcn_assets_shadcn_logo_mark, _agents_skills_shadcn_assets_shadcn_app_icon_tile, _agents_skills_shadcn_assets_shadcn_small_icon_variant [INFERRED 0.85]
- **Theme-Paired ASCII Hero Artwork (dark + light files swapped by theme)** — public_assets_ascii_magic_comment_dark_asciicommentheroart, public_assets_ascii_magic_comment_light_asciicommentheroart, public_assets_ascii_magic_comment_dark_themetokeninkramp [INFERRED 0.95]
- **Conversation Motif in the Hero Art (comment bubble, typing dots, reply bubble)** — public_assets_ascii_magic_comment_dark_asciicommentheroart, public_assets_ascii_magic_comment_dark_typingindicator, public_assets_ascii_magic_comment_dark_replybubble, public_assets_ascii_magic_comment_light_nestedthreadmetaphor [INFERRED 0.90]
- **Pixel-Art Visual Language of the OG Background** — src_server_seo_og_artwork_background, src_server_seo_og_artwork_speech_bubble_motif, src_server_seo_og_artwork_stacked_bubble_layering, src_server_seo_og_artwork_pixel_dust_corners, src_server_seo_og_artwork_blueprint_grid [EXTRACTED 1.00]

## Communities (139 total, 24 thin omitted)

### Community 0 - "Admin Forms & Dialogs"
Cohesion: 0.08
Nodes (57): cn, @tanstack/react-form, AccountTextField(), AdminFormApi, PageCreateDialog(), PageForm, pageFormSchema(), pageUrlFrom() (+49 more)

### Community 1 - "Recent Activity UI"
Cohesion: 0.07
Nodes (57): @base-ui/react, class-variance-authority, RangeToggle(), RECENT_WINDOWS, RecentStatusBadge(), RecentView(), threadPreviewExcerpt(), windowOptionLabel() (+49 more)

### Community 2 - "Validation Schemas"
Cohesion: 0.05
Nodes (63): zod, COMMENT_BODY_LIMIT, commentBodyMarkdown, initialAdminSchema, RenameSiteForm, renameSiteSchema, siteFormSchema, siteNameSchema (+55 more)

### Community 3 - "Admin Dashboard Screens"
Cohesion: 0.14
Nodes (50): AdminLogin(), PagesView(), SitesView(), ACTIVITY_CONFIG, CommentActivityPanel(), CommentStatusPie(), ModerationActionCount, ModerationActivityCard() (+42 more)

### Community 4 - "Moderation & Auth Guards"
Cohesion: 0.08
Nodes (57): requireInstanceAdmin(), requireSiteModerator(), Route, HttpError, editComment(), EditCommentData, EditCommentDeps, normalizePageKey() (+49 more)

### Community 5 - "Payload & Site Shell"
Cohesion: 0.06
Nodes (40): @payloadcms/tanstack-start, @payloadcms/ui, @tanstack/react-start, COPYRIGHT_YEAR, SiteFooter(), ToastAction(), ToastClose(), ToastContent() (+32 more)

### Community 6 - "Admin Auth UI"
Cohesion: 0.12
Nodes (39): react, @tanstack/react-query, AdminLoginForm(), ExternalLoginNotice(), PasswordLoginForm(), AdminFailure, AdminQueryError(), DashboardShell() (+31 more)

### Community 7 - "Blog Rendering & Widgets"
Cohesion: 0.09
Nodes (42): @lst97-oss/last-comments-widgets, mermaid, shiki, BlogMarkdown(), BlogComments(), BlogMarkdownScope(), MermaidDiagram(), render() (+34 more)

### Community 8 - "Paging & Thread Badges"
Cohesion: 0.11
Nodes (36): lucide-react, Hint(), PageNumber, pageNumbers(), Pager(), SkeletonCards(), ThreadKeyBadge(), ThreadStatusBadge() (+28 more)

### Community 9 - "Server Plugin Docs"
Cohesion: 0.06
Nodes (44): Filter Plugin Decisions-API Engine, Per-Plugin Folder Layout, Rate-Limit Plugin, Self-Host Compose Stack, Turnstile Covers Every Commenter, Typed TS Plugin Configuration, app Compose Service, Bring-Your-Own Postgres Topology (+36 more)

### Community 10 - "Runtime Dependencies"
Cohesion: 0.04
Nodes (46): dependencies, @asteasolutions/zod-to-openapi, bad-words, @base-ui/react, better-auth, @better-auth/api-key, @better-auth/drizzle-adapter, class-variance-authority (+38 more)

### Community 11 - "Admin API Routes"
Cohesion: 0.15
Nodes (37): @tanstack/react-router, requirePageDetailAccess(), Route, requirePageAccess(), Route, requireSiteCreator(), requireSiteReader(), Route (+29 more)

### Community 12 - "Demo Seed Scripts"
Cohesion: 0.08
Nodes (30): Seeds README, DRY_RUN, origins, serverUrl, siteKey, db, DEMO_COMMENTS, DRY_RUN (+22 more)

### Community 13 - "External Identity Providers"
Cohesion: 0.09
Nodes (26): BusinessDb, ExternalIdentityInput, linkOrProvisionExternalUser(), maybeBootstrapInstanceAdmin(), HeaderDeps, resolveHeaderSession(), base64UrlDecode(), clearOidcCache() (+18 more)

### Community 14 - "Public API Routes"
Cohesion: 0.13
Nodes (23): Route, Route, Route, Route, Route, databaseUnavailableCodes, getDatabaseErrorCode(), toHttpError() (+15 more)

### Community 15 - "Business DB Schema & Tests"
Cohesion: 0.16
Nodes (28): apikey, moderationEvents, siteMemberships, sites, db(), now, twoDaysAgo, yesterday (+20 more)

### Community 16 - "Vite & RSC Build Plugins"
Cohesion: 0.08
Nodes (19): @tailwindcss/vite, unwasm, @vitejs/plugin-react, @vitejs/plugin-rsc, clientModuleResolution(), payloadDevTransforms(), buildBundledPackages, buildExternalPackages (+11 more)

### Community 17 - "Biome Lint Config"
Cohesion: 0.06
Nodes (32): source, assist, actions, enabled, includes, noRenderReturnValue, noVoidElementsWithChildren, useExhaustiveDependencies (+24 more)

### Community 18 - "Project Config & Manifest"
Cohesion: 0.06
Nodes (29): imports, #vendor/*, license, name, private, type, @asteasolutions/zod-to-openapi, @better-auth/drizzle-adapter (+21 more)

### Community 19 - "Comments API & Principals"
Cohesion: 0.19
Nodes (22): Route, Route, Route, Route, Principal, adapters, getSessionAdapters(), resolvePrincipal() (+14 more)

### Community 20 - "NPM Scripts"
Cohesion: 0.07
Nodes (30): scripts, build, check, db:business:generate, db:business:grant-admin, db:business:migrate, db:business:plugins:uninstall, db:migrate (+22 more)

### Community 21 - "Structured Logging"
Cohesion: 0.16
Nodes (23): consoleWriter(), createLogger(), createPrettySink(), defaultEnv(), formatLogLine(), getLoggerSettings(), LEVEL_COLORS, LoggerSettings (+15 more)

### Community 22 - "OpenRouter Decider Client"
Cohesion: 0.11
Nodes (19): @openrouter/sdk, ResolvedFilterConfig, callDecider(), CallDeciderInput, createFetchSender(), createSdkSender(), DeciderError, DeciderQuestion (+11 more)

### Community 23 - "Payload CMS Config & Seeds"
Cohesion: 0.09
Nodes (9): env, payload, @payloadcms/db-postgres, @payloadcms/richtext-lexical, Idempotent Seed Upsert, DRY_RUN, POSTS, migrations (+1 more)

### Community 24 - "API Keys & Scopes"
Cohesion: 0.16
Nodes (23): requireManagedKey(), requireScopeManager(), requireSiteAdminId(), Route, getBusinessAuth(), assertValidScopeSet(), BusinessDb, deleteServiceKey() (+15 more)

### Community 25 - "Navigation Dropdowns"
Cohesion: 0.15
Nodes (16): SiteSwitcher(), UserMenu(), DocsVersionSwitch(), DashboardMenu(), DropdownMenu(), DropdownMenuContent(), DropdownMenuGroup(), DropdownMenuItem() (+8 more)

### Community 26 - "Health Probes"
Cohesion: 0.16
Nodes (12): Route, DbProbe, getHealth(), GetHealthDeps, buildHealthReport(), buildLiveReport(), HealthCheckState, HealthReport (+4 more)

### Community 27 - "OG Image Rendering"
Cohesion: 0.14
Nodes (18): fontkit, OG_FRAMEWORKS, fitWithEllipsis(), measureText(), normalizeText(), renderTextPaths(), TextPathOptions, wrapText() (+10 more)

### Community 28 - "Docs Site (Fumadocs)"
Cohesion: 0.12
Nodes (17): fumadocs-core, fumadocs-mdx, fumadocs-ui, DocsMobileBar(), PRINCIPLES, baseOptions(), docs, source (+9 more)

### Community 29 - "Filter Decider Eval"
Cohesion: 0.08
Nodes (20): ambiguous, CASES, Category, confidenceFor(), config, elapsed, enabled, EvalCase (+12 more)

### Community 30 - "Landing Page & OG Meta"
Cohesion: 0.21
Nodes (18): AboutContent(), GithubIcon(), LandingRail(), OG_IMAGE_HEIGHT, OG_IMAGE_ROUTE, OG_IMAGE_WIDTH, ogImageAlt(), ogImageQuery() (+10 more)

### Community 31 - "Filter Configuration"
Cohesion: 0.15
Nodes (19): filterConfig, filterConfigDef, resolveApiKey(), ALL_IMAGE_CATEGORIES, ALL_TEXT_CATEGORIES, FilterFileConfig, filterFileSchema, IMAGE_SCHEMA_DESCRIPTIONS (+11 more)

### Community 32 - "Auth Provider Config"
Cohesion: 0.18
Nodes (19): getAuthConfig(), AuthProviderName, AuthSelection, getAuthSelection(), getHeaderProviderSettings(), getOidcSettings(), isBetterAuthEnabled(), oidcEnvSchema (+11 more)

### Community 33 - "shadcn components.json"
Cohesion: 0.09
Nodes (21): aliases, components, hooks, lib, ui, utils, iconLibrary, menuAccent (+13 more)

### Community 34 - "Site Header & Mobile Nav"
Cohesion: 0.22
Nodes (16): MobileNav(), DASHBOARD_MENU, isActivePath(), isDashboardActive(), NAV, SiteHeader(), Collapsible(), CollapsibleContent() (+8 more)

### Community 35 - "Auth & OpenAPI Endpoints"
Cohesion: 0.20
Nodes (15): better-auth, handleAuth(), Route, Route, Route, installedOpenApiPlugins, openApiDocsEnabled, apiReferenceResponse() (+7 more)

### Community 36 - "Sidebar & Sheet Primitives"
Cohesion: 0.18
Nodes (14): SheetDescription(), SheetHeader(), Sidebar(), SidebarContext, SidebarContextProps, SidebarMenuButton(), sidebarMenuButtonVariants, SidebarRail() (+6 more)

### Community 37 - "API Key Management UI"
Cohesion: 0.17
Nodes (17): useSiteKeys(), confirmDelete(), saveScopes(), toggleEnabled(), toggleScope(), API_KEY_SCOPES, ApiKeyScope, KeyForm (+9 more)

### Community 38 - "TypeScript Config"
Cohesion: 0.10
Nodes (20): compilerOptions, allowImportingTsExtensions, jsx, lib, module, moduleResolution, noEmit, noFallthroughCasesInSwitch (+12 more)

### Community 39 - "Business DB Scripts"
Cohesion: 0.18
Nodes (12): drizzle-orm, email, businessEnvSchema, getBusinessEnv(), closeBusinessSql(), getBusinessDb(), getBusinessSql(), toBunSqlUrl() (+4 more)

### Community 40 - "Blog Cards & Landing Content"
Cohesion: 0.18
Nodes (13): PostCard(), PostRow(), ReadMore(), formatPostDate(), PostMeta(), FEATURES, LandingContent(), FieldSeparator() (+5 more)

### Community 41 - "Plugin Configuration Layer"
Cohesion: 0.16
Nodes (15): CommentOperation, installedCommentPlugins, filterPlugin, DEFAULT_TRUSTED_PROXY_CIDRS, getRateLimitPluginSettings(), parseTrustedProxyCidrs(), rateLimitEnvSchema, rateLimits (+7 more)

### Community 42 - "Filter Plugin Engine"
Cohesion: 0.18
Nodes (14): sharp, applyVerdictThreshold(), screenWithDecider(), siteHostOf(), unavailable(), extractImageUrls(), fetchAndShrink(), Fetcher (+6 more)

### Community 43 - "Admin Sidebar Navigation"
Cohesion: 0.18
Nodes (18): ADMIN_NAV, AdminNavGroup, AdminNavItem, AdminSidebar(), MatchRouteFn, MODERATION_SUBS, ModerationNav(), useModerationView() (+10 more)

### Community 44 - "Integration Test Helpers"
Cohesion: 0.14
Nodes (10): createAdminSite(), createComment(), input, db, hideScreening, createTestComment(), createPage, createSite() (+2 more)

### Community 45 - "Build Dev Dependencies"
Cohesion: 0.12
Nodes (17): devDependencies, @biomejs/biome, bun-types, drizzle-kit, nitro, oxc-transform-react, @tanstack/router-cli, @types/fontkit (+9 more)

### Community 46 - "Doc Icon Tree"
Cohesion: 0.18
Nodes (12): DOC_ICONS, DocIconName, iconNameOf(), IconNode, resolveDocIcon(), withDocTreeIcons(), copyNode(), nodeName() (+4 more)

### Community 47 - "Business Auth Setup"
Cohesion: 0.17
Nodes (13): businessApiKeyPlugin(), businessAuthEnvSchema, getBusinessAuthSettings(), optionalOAuthCredential, createBusinessAuth(), getBusinessSession(), getBusinessSetupAuth(), resolveBetterAuthSession() (+5 more)

### Community 48 - "Turnstile Configuration"
Cohesion: 0.15
Nodes (12): readSecret(), readSiteKey(), ResolvedTurnstileConfig, turnstileConfig, turnstileConfigDef, TurnstileFileConfig, turnstileFileSchema, createTurnstilePlugin() (+4 more)

### Community 49 - "Sitemap Generation"
Cohesion: 0.30
Nodes (12): absoluteSiteUrl(), buildSitemapXml(), docsSitemapUrls(), escapeXml(), normalizeOrigin(), postsSitemapUrls(), SitemapChangefreq, SitemapUrl (+4 more)

### Community 50 - "Comment Creation & Plugin Contract"
Cohesion: 0.16
Nodes (12): CommentCreationContext, CreateCommentData, CreateCommentDeps, CommentEventType, CommentOperationInput, CommentPlugin, CommentPluginEvent, CommentValidationInput (+4 more)

### Community 51 - "Widget Markdown & Moderation"
Cohesion: 0.13
Nodes (15): Moderation Restore Action, renderMarkdown / safeUrl, Body Limit Character Counter, Composer Toolbar and Preview, GitHub-Flavored Markdown Renderer, safeUrl Link Restriction, Shiki Lazy Syntax Highlighting, Admin Badge + Coloured Name (+7 more)

### Community 52 - "Widget Client Helpers"
Cohesion: 0.15
Nodes (15): Bring-Your-Own fetchImpl, Framework-Free Client API, buildCommentTree, isEditWindowOpen / canModerate, Session and Sign-In Helpers, Thread Window Paging Helpers, IntersectionObserver Lazy Loading, Reddit-Style Relative Timestamps (+7 more)

### Community 53 - "Confirm Dialog Primitives"
Cohesion: 0.30
Nodes (11): ConfirmDeleteDialog(), AlertDialog(), AlertDialogAction(), AlertDialogCancel(), AlertDialogContent(), AlertDialogDescription(), AlertDialogFooter(), AlertDialogHeader() (+3 more)

### Community 54 - "Auth File Configuration"
Cohesion: 0.14
Nodes (13): authConfig, authConfigDef, AuthConfigProviderName, AuthFileConfig, authFileSchema, parseProvidersOverride(), providerNameSchema, ResolvedAuthConfig (+5 more)

### Community 55 - "API Security & Docs"
Cohesion: 0.18
Nodes (14): Admin API Permission Hardening, Business Kernel Response Envelope, Live vs Ready Health Probes, Auth Reference Visibility, API Response Envelope, OpenAPI Server Plugin, Documented HTTP Path Table, Scalar API References (+6 more)

### Community 56 - "Router & Root Provider"
Cohesion: 0.21
Nodes (8): react-dom, @tanstack/react-router-ssr-query, getContext(), SiteError(), getRouter(), Register, @tanstack/react-router, renderThrowingRoute()

### Community 57 - "Admin Design System Docs"
Cohesion: 0.18
Nodes (12): Admin Badges and Empty States Rule Doc, Admin Charts Rule Doc, Admin Leaderboards Rule Doc, renderLabel Slot, Admin Screens Rule Doc, Dashboard Screen, DashboardShell, Thread Detail Screen (+4 more)

### Community 58 - "React Admin Data Rules"
Cohesion: 0.15
Nodes (5): Pending Button Spinner and Disabled State, Session Principal Probe Query, Pending State Disables Its Control, Failure Reported Where Admin Looks, AdminQueryError

### Community 59 - "shadcn Registry & MCP"
Cohesion: 0.21
Nodes (13): shadcn build Command, shadcn search Command, shadcn MCP Server, components.json Registry Configuration, shadcn MCP Registry Tools, Registry Address Schemes, Built Registry, GitHub Source Registry (+5 more)

### Community 60 - "Chat UI Primitives"
Cohesion: 0.22
Nodes (8): Attachment, Bubble Surface, Marker, Message Row, MessageScroller, Message Scroller Hooks, Full Card Composition, shimmer and scroll-fade Utilities

### Community 61 - "CI/CD Pipelines"
Cohesion: 0.22
Nodes (13): Remote docker compose up, CD Production Deploy Job, Production .env Composition, Public Site Check, /api/ready Readiness Gate, Tailscale Connect Step, CI Check Job, CI Compose Stack Smoke (+5 more)

### Community 62 - "Widget Theming Tokens"
Cohesion: 0.18
Nodes (13): themeVars to CSS Variables, CommentsTheme Theme Root, Theme CSS Variables, data-lc-theme-var Attributes, Native CSS @scope Isolation, Shared Style Hooks, Theme Key Catalogue, themeVars Configuration Object (+5 more)

### Community 63 - "Widget Framework Ports"
Cohesion: 0.17
Nodes (13): LcCommentsComponent (lc-comments), moderated Output, Angular Signal Inputs, signIn Output, lcTurnstile Directive, onModerated Callback, Comments Component (React), CommentsTheme Root (+5 more)

### Community 64 - "Admin Interaction Patterns"
Cohesion: 0.18
Nodes (6): Moderation Screen, Dialog-Owned Mutation, FormDialog, Blog Thread Ensure Effect, Legitimate Effect Register, Moderation Dashboard Story

### Community 65 - "Design System Color QA"
Cohesion: 0.24
Nodes (6): ColorPair(), contrast(), luminance(), toHex(), toRgb(), defaultStates

### Community 66 - "Business Auth Client"
Cohesion: 0.29
Nodes (10): @better-auth/api-key, AuthButton(), authClient, AuthProviderName, fetchSessionPrincipal(), getAuthProviders(), SessionPrincipalClient, signOut() (+2 more)

### Community 67 - "Chart Primitives"
Cohesion: 0.20
Nodes (11): recharts, ChartConfig, ChartContext, ChartContextProps, ChartLegendContent(), ChartStyle(), getPayloadConfigFromPayload(), INITIAL_DIMENSION (+3 more)

### Community 68 - "Blog Server Functions"
Cohesion: 0.35
Nodes (11): BlogCommentConfig, BlogPost, blogPostServerFn, commentConfig(), ensureBlogThreadServerFn, getBlogPayload(), listBlogPostsServerFn, PostDoc (+3 more)

### Community 69 - "Admin User Tests"
Cohesion: 0.20
Nodes (10): user, db, DirectoryIds, insertUser(), listHistory, listUsers, readSettings, setupDirectory() (+2 more)

### Community 70 - "Empty States & Query Keys"
Cohesion: 0.18
Nodes (10): Empty State Component Family, Empty State Copy Table, CommentStatusPie, Leaderboard Empty Node Prop, threadLabel Fallback, Header Site and Range Controls, ADMIN_SITES_QUERY_KEY, setupRouterSsrQueryIntegration (+2 more)

### Community 71 - "Leaderboard Component"
Cohesion: 0.20
Nodes (6): Leaderboard Component, LeaderboardItem Type, Leaderboard (admin design summary), Leaderboard (shared component doc), Biome Lint Enforcement Scope, Admin Change Verification Gates

### Community 72 - "Design System Showcase"
Cohesion: 0.24
Nodes (9): DESIGN.md Brand Spec, ColorPair Contrast Measurement, Component Tiers and Block Anatomy, Rendered Do/Don't Pairs, Design System Edge Cases, Design System Foundations, Design System Page Outline, Showcase Helpers Bundle (+1 more)

### Community 73 - "Authentication Providers"
Cohesion: 0.20
Nodes (10): auth.config.ts Configuration, better-auth Provider, First-Admin Bootstrap, header Reverse-Proxy SSO Provider, External Identity Mapping, oidc-jwt Provider, Service Keys (lck_*), First Users Setup (+2 more)

### Community 74 - "Bad-Words Screening"
Cohesion: 0.27
Nodes (8): bad-words, BadwordsFilter, BadwordsScreenResult, redact(), screenBadwords(), tokensOf(), createFilterPlugin(), loadBadwordsFilter()

### Community 75 - "MDX Components"
Cohesion: 0.22
Nodes (8): DocsMdxComponents, getMDXComponents(), MdxLink(), MDXProvidedComponents, useMDXComponents, Anchor, AnchorComponent, AnchorProps

### Community 76 - "Server Architecture Rules"
Cohesion: 0.29
Nodes (8): src/server AGENTS.md, Health Reference Slice, HttpError.expose Default, Structured Log Event Names, New-Module Recipe, parseWith Validation, withContext Request Wrapper, Request Flow Through Layers

### Community 77 - "Server Env & URL Guard"
Cohesion: 0.29
Nodes (6): envSchema, optionalString, ServerEnv, LOOPBACK_HOSTS, PayloadServerUrlError, resolvePayloadServerUrl()

### Community 78 - "Decider Prompt Builder"
Cohesion: 0.29
Nodes (9): buildQuestions(), buildStateText(), buildUserText(), DECIDER_PROMPT_VERSION, DeciderUserInput, noul(), PREAMBLE, TEXT_QUESTION_RULES (+1 more)

### Community 79 - "Filter Plugin Design"
Cohesion: 0.31
Nodes (9): Filter Plugin README, bad-words Engine, blocklist / allowlist Semantics, OpenRouter Decisions Transport (pplx-decider-v1.2), Filter Plugin, Image Thumbnail Preparation, Live Decider Eval (eval:filter), LLM Decider Engine (+1 more)

### Community 80 - "Form & Input Primitives"
Cohesion: 0.20
Nodes (7): Button Loading via Spinner, FieldGroup and Field Form Layout, FieldSet and FieldLegend Grouping, InputGroup Composition, data-invalid and aria-invalid Validation, data-icon Attribute, cn() Conditional Classes

### Community 81 - "Widget Errors & Identity"
Cohesion: 0.22
Nodes (10): describeError Copy Mapper, data-lc-error Styling Attributes, ApiError Code Catalog, Unified Error Block, Anonymous Edit Window, Guest Comments (credentials omit), Comment-as Identity Control, API-Started OAuth Fallback (+2 more)

### Community 82 - "Widget Package Distribution"
Cohesion: 0.20
Nodes (8): Four Native Widget Ports, Same-Origin API Requirement, last-comments-widgets Package, Subpath Entry Points, Widget Install Flow, Page Origin Registration, Runtime Requirements (ES2025, @scope), Same-Origin API Proxy

### Community 83 - "Payload Shutdown Lifecycle"
Cohesion: 0.36
Nodes (7): nitro, armProcessHandlers(), cachedPayloads(), Destroyable, destroyCachedPayloads(), drainAll(), payloadShutdownPlugin()

### Community 84 - "Dual Database Architecture"
Cohesion: 0.29
Nodes (6): Payload CMS vs Business Postgres Split, business-sql.ts Client Seam, BUSINESS_DATABASE_URL Separation, Vendored Payload TanStack Vite README, Vendored clientModuleResolution Plugin, Vendored importProtection Plugin

### Community 85 - "Blog SEO & JSON-LD"
Cohesion: 0.47
Nodes (8): absoluteCoverUrl(), absoluteUrl(), buildBlogPostingJsonLd(), postCanonicalUrl(), postSeoDescription(), SeoPostLike, stripMarkdownToText(), Route

### Community 86 - "Client IP Resolution"
Cohesion: 0.42
Nodes (6): isProxySourceAllowed(), normalizeAddress(), isTrustedProxy(), peerAddress(), resolveClientIp(), RFC-1918

### Community 87 - "Admin Shared Components"
Cohesion: 0.22
Nodes (6): ThreadStatusBadge / ThreadKeyBadge, AccountTextField, Shared Admin Component Catalogue, ConfirmDeleteDialog, Hint, thread-status-badge.tsx Exports

### Community 88 - "Stat Cards & Panels"
Cohesion: 0.25
Nodes (6): CommentActivityPanel, VisibleRatePanel, VotesPanel, Shared Four Stat Card Slots, StatCard, stats-panels.tsx Exports

### Community 89 - "Payload Boot Contract"
Cohesion: 0.22
Nodes (8): Admin CSS Real <link> Contract, Generated Files Are Script-Owned, migrate:create Value-Import Trap, Payload Migration Workflow (push:false), payloadParseSearch / payloadStringifySearch, handleServerFunctions RSC Passthrough, Vendored RSC-independent Payload Vite plugins, withPayloadRoot Admin Shell

### Community 90 - "Showcase Coverage Script"
Cohesion: 0.22
Nodes (6): components, missing, source, [uiArg, ...roots], uiDir, walk()

### Community 91 - "Architecture Blog Post"
Cohesion: 0.31
Nodes (7): Introducing last-comments Blog Post, Architecture Flowchart, Guest Edit Keys and Unlimited Author Edits, One Widget, Four Frameworks, Comment Plugin System, Publisher API (pages:write), Five-Step Publisher Workflow

### Community 92 - "Progress & Leaderboard UI"
Cohesion: 0.44
Nodes (7): Leaderboard(), LeaderboardItem, Progress(), ProgressIndicator(), ProgressLabel(), ProgressTrack(), ProgressValue()

### Community 93 - "Design Tokens & Visual Language"
Cohesion: 0.29
Nodes (8): ASCII Landing Comment Animation, Accessible Interaction States, cn() and CVA Variant Pattern, Component Variant Architecture, Semantic Design Token Palette, shadcn Registry Primitives, Status Colour Semantics, WCAG AA Contrast Requirements

### Community 94 - "Landing Hero ASCII Art"
Cohesion: 0.36
Nodes (7): ASCII-Magic Comment Thread Hero Art (Dark): two overlapping speech bubbles rendered as ASCII glyph cells, white ink on black background, 760x555 animated WebP (45 frames @70ms, infinite loop), 45-Frame Looping Glyph Drift (frame set drifts from frame 0 and returns by frame 44), Trailing Reply Bubble (Second, Smaller Speech Bubble), Three-Dot Typing Indicator Inside the Comment Bubble, ASCII-Magic Comment Thread Hero Art (Light): same two-bubble ASCII composition as black ink on white, ASCII-Magic Character-Cell Rendering (glyph grid resolves to solid shapes at display size), Nested Comment Thread Metaphor (main comment + attached reply)

### Community 95 - "Plugin Event Delivery"
Cohesion: 0.39
Nodes (5): logger, getCommentPlugins(), deliverPendingPluginEvents(), getPluginRetryDelayMs(), logger

### Community 96 - "robots.txt"
Cohesion: 0.39
Nodes (5): ALLOWED_PATHS, buildRobotsTxt(), DISALLOWED_PATHS, robotsTxtResponse(), Route

### Community 97 - "Turnstile Screening Order"
Cohesion: 0.36
Nodes (6): Turnstile Plugin README, getTurnstilePluginSettings, Cloudflare Turnstile Testing Keys, Turnstile Plugin, verificationRequired Setting, Per-Plugin TS Config Standard

### Community 98 - "Rate-Limit Plugin"
Cohesion: 0.43
Nodes (6): Rate-Limit Plugin README, client-ip.ts Resolution, HMAC-Hashed Requester Identity, Rate-Limit Plugin, comment_rate_limit Schema, RATE_LIMIT_TRUSTED_PROXY_CIDR

### Community 99 - "Font Licenses"
Cohesion: 0.43
Nodes (6): OFL Archivo Black License File, Archivo Black Font, Archivo Black Copyright Notice, SIL Open Font License 1.1, OFL JetBrains Mono License File, JetBrains Mono Font

### Community 100 - "React Admin Skill Docs"
Cohesion: 0.29
Nodes (7): Data Fetching Rule Doc, Mutations Rule Doc, React Compiler Rule Doc, Rendering Rule Doc, Shared Components Rule Doc, State and Effects Rule Doc, React Admin Patterns Skill

### Community 101 - "React Compiler Mode"
Cohesion: 0.29
Nodes (3): react-doctor Suppression Documents Compiler Scope, Annotated File Scope, Function-Level 'use memo' Directive

### Community 102 - "Semantic Token System"
Cohesion: 0.38
Nodes (6): Class-based Dark Mode, OKLCH Color Format, Global --radius Scale, Focus Treatment Mapping, DESIGN.md Role to shadcn Variable Mapping, type-* Utility Scale

### Community 103 - "shadcn Composition Traps"
Cohesion: 0.29
Nodes (5): Showcase Known Traps, asChild vs render Composition, nativeButton False for Non-button Render, Base Select items Prop, Slider Scalar vs Array Values

### Community 104 - "Mermaid & Skeleton UI"
Cohesion: 0.33
Nodes (4): next-themes, DiagramStatus, SidebarMenuSkeleton(), Skeleton()

### Community 105 - "OG Artwork Layers"
Cohesion: 0.52
Nodes (7): OG Artwork Background Layer, Faint Blueprint Grid Overlay, Light Monochrome Palette (near-white with black/grey accents), Pixel Dust Scatter in Top-Left and Bottom-Left Corners, Pixel-Art Speech Bubble Motif, Stacked Grey Bubble Behind Primary Bubble, Reserved Left-Column Text Zone

### Community 106 - "Filename Sanitizer"
Cohesion: 0.43
Nodes (6): encoder, replaceMatches(), Replacement, sanitize(), sanitizeFilename(), truncateUtf8()

### Community 107 - "shadcn CLI Workflow"
Cohesion: 0.33
Nodes (5): shadcn/ui Agent Interface Metadata, shadcn add Command, shadcn docs Command, add dry-run / diff / view Previews, shadcn/ui

### Community 109 - "Admin CSS Generator"
Cohesion: 0.47
Nodes (5): collect(), main(), ROOTS, SKIPPED, toSpecifier()

### Community 110 - "Smoke Script"
Cohesion: 0.33
Nodes (3): base, Check, checks

### Community 111 - "Time Formatting"
Cohesion: 0.53
Nodes (4): formatClockTime(), pad2(), pad3(), clockTimeOf()

### Community 112 - "shadcn Init & Presets"
Cohesion: 0.50
Nodes (4): shadcn apply Command, shadcn init Command, shadcn Presets, shadcn Project Templates

### Community 113 - "Plugin Contract Docs"
Cohesion: 0.60
Nodes (4): src/server README, CommentPlugin Contract, Transactional Event Outbox, screenComment / publishCommentScreening

### Community 117 - "Comment Deletion"
Cohesion: 0.50
Nodes (3): deleteComment(), DeleteCommentData, DeleteCommentDeps

### Community 121 - "Favicon Assets"
Cohesion: 1.00
Nodes (3): Speech Bubble Android/PWA Chrome Icons (192x192, 512x512), Speech Bubble Apple Touch Icon (180x180, iOS home screen), Pixel-Art Dual Speech Bubble Browser Favicon (16x16, 32x32)

## Ambiguous Edges - Review These
- `Layer Direction http → application → domain` → `RATE_LIMIT_TRUSTED_PROXY_CIDR`  [AMBIGUOUS]
  src/server/plugins/rate-limit/README.md · relation: conceptually_related_to
- `Image Thumbnail Preparation` → `OFL JetBrains Mono License File`  [AMBIGUOUS]
  src/server/plugins/filter/README.md · relation: semantically_similar_to

## Knowledge Gaps
- **131 isolated node(s):** `@fontsource-variable/geist`, `@payloadcms/drizzle`, `@payloadcms/translations`, `@scalar/api-reference`, `@tanstack/react-form-start` (+126 more)
  These have ≤1 connection - possible missing edges or undocumented components. (Counts symbols only; 742 node(s) total have ≤1 connection when file, concept and rationale nodes are included.)
- **24 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `@tanstack/react-router` connect `Admin API Routes` to `Admin Forms & Dialogs`, `Recent Activity UI`, `Admin Dashboard Screens`, `Moderation & Auth Guards`, `Payload & Site Shell`, `Admin Auth UI`, `Paging & Thread Badges`, `Public API Routes`, `Project Config & Manifest`, `Comments API & Principals`, `API Keys & Scopes`, `Health Probes`, `Docs Site (Fumadocs)`, `Landing Page & OG Meta`, `Site Header & Mobile Nav`, `Auth & OpenAPI Endpoints`, `Blog Cards & Landing Content`, `Admin Sidebar Navigation`, `Sitemap Generation`, `Router & Root Provider`, `Business Auth Client`, `robots.txt`?**
  _High betweenness centrality (0.154) - this node is a cross-community bridge._
- **What connects `@fontsource-variable/geist`, `@payloadcms/drizzle`, `@payloadcms/translations` to the rest of the system?**
  _131 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `Admin Forms & Dialogs` be split into smaller, more focused modules?**
  _Cohesion score 0.07530022719896137 - nodes in this community are weakly interconnected._
- **Why does `Introducing last-comments Blog Post` connect `Architecture Blog Post` to `Admin Interaction Patterns`, `Dual Database Architecture`, `Demo Seed Scripts`, `Payload CMS Config & Seeds`?**
  _High betweenness centrality (0.086) - this node is a cross-community bridge._
- **Should `Recent Activity UI` be split into smaller, more focused modules?**
  _Cohesion score 0.07423423423423424 - nodes in this community are weakly interconnected._

### Low-confidence Hints
_AMBIGUOUS edges — the extractor was unsure. Verify before acting on these._

- **What is the exact relationship between `Layer Direction http → application → domain` and `RATE_LIMIT_TRUSTED_PROXY_CIDR`?**
  _Edge tagged AMBIGUOUS (relation: conceptually_related_to) - confidence is low._
- **What is the exact relationship between `Image Thumbnail Preparation` and `OFL JetBrains Mono License File`?**
  _Edge tagged AMBIGUOUS (relation: semantically_similar_to) - confidence is low._