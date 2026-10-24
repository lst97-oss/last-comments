# Changelog

## v0.2.1

Per-site comment length limits, permanent page deletion, and credentialed CORS for registered origins. Runs against `@lst97-oss/last-comments-widgets` 0.5.0.

- **Per-site comment length limit.** A site can set its own maximum (1 to 10,000 characters) with `PATCH /api/admin/sites/{siteKey}` (`bodyLimit`; `null` resets to the default). The default is 10,000, which is also the ceiling, so a site can lower it but never raise it. Public and moderator comments, and their edits, over the limit are refused with `400 COMMENT_TOO_LONG`. The check runs before plugin screening, so an oversized body is never sent to a model. The dashboard's Edit site sets the limit, and the thread composer counts against it. Migration `0006_sites_body_limit` adds a nullable column with a check constraint, so existing sites keep the default.
- **Permanent page deletion.** `DELETE /api/admin/pages/{pageId}?site=` and `DELETE /api/admin/pages?site=&pageKey=` (or `&url=`) remove a page with its comments, replies and votes in one transaction. The site's blocks, verifications, memberships and origins are kept. Each delete writes a `page.delete` audit row that keeps the URL, and a `page.deleted` event for plugins. A repeat delete is `404 PAGE_NOT_FOUND`. Deleting needs a new `pages:delete` scope (separate from `pages:write`, so existing write keys cannot delete) or a site-admin session. The dashboard gets a Delete control on each page, behind a confirmation.
- **Atomic site deletion.** Deleting a site now removes its API keys and its rate-limit windows in the same transaction as the site, so a failure cannot leave orphan keys. A structured `site.deleted` log line records the page, comment and key counts.
- **Google sign-in links to the existing account.** A Google sign-in links to the account with the same email even when that account's local email is unverified (the first admin signs up with a password). Password sign-up stays closed.
- **Credentialed CORS for registered origins.** `/api/auth/*` and `/api/comments` send `Access-Control-Allow-Credentials` to origins a site has registered, echoing the exact origin. Registered origins are also trusted for OAuth `callbackURL`s, so a sign-in returns the reader to the page they started on. A failed origin lookup keeps the last good list, so an outage narrows trust rather than widening it. Same-registrable-domain embeds now work directly; a different registrable domain still needs a same-origin proxy.

## v0.2.0

Moderation dashboard overhaul, filter Decisions API, external-Postgres Compose, per-page social cards, and the Bun 1.4.4 toolchain.

- Fix the filter plugin's LLM engine: `perplexity/pplx-decider-v1.2` is a Decisions model (`text+image -> decisions`) and OpenRouter rejects `/chat/completions` for it, so every screened comment silently failed open and only `bad-words` ever hid anything. The decider now posts to `/api/alpha/decisions` (`client.alpha.decisions.create`, raw-`fetch` fallback) with the prompt text and image thumbnails as `state` and one `noul` question per enabled text/image category; answers are calibrated violation probabilities and `hideThreshold` compares against them. Text and image thumbnails ride in the same one-shot call, disabled schemas are never asked, and every question must be answered (a missing answer resolves through `failOpen`). `maxTokens` and the strict-JSON-schema builder are gone; `openrouter.baseUrl` now defaults to the OpenRouter origin.

- The moderation dashboard's "Hidden & removed" list is actionable: every hidden and deleted comment carries a **Restore** button (the session is the verification, so it goes through the same `POST /api/moderation` `restore` the thread view uses), the rows stack on narrow screens instead of squeezing the badge and the button onto one line, and the list is client-paged. The Recent tab's window toggle gains an **ALL** option: `recentDays=0` drops the window's lower bound, so the threads and the takedowns cover every comment.

- Permission hardening on the admin API: `GET /api/admin/sites` returns only the caller's own sites (instance admins still see every site, service keys stay instance-level), the user directory `/api/admin/users` is limited to instance and site admins so a site moderator no longer reads other people's emails, and the OpenAPI reference documents both rules. The rate-limit plugin buckets guests on the request's socket peer and trusts the ingress client IP header only from a trusted ingress (loopback and private networks by default, `RATE_LIMIT_TRUSTED_PROXY_CIDR` widens it), so a direct client can no longer rotate the header to dodge the limit. The header is `x-real-ip`, or `CF-Connecting-IP` behind Cloudflare (a Tunnel needs no extra setup). A service key is recognised by its `lck_` prefix, so an OIDC bearer token reaches the session providers instead of failing key verification.

- Turnstile now covers every commenter: the server verifies the token for signed-in posts too (the plugin no longer skips validation when the request carries a session), and a missing verification provider fails closed for everyone instead of only for guests. The widgets render the challenge for every identity — guests and signed-in authors alike — and block the submit until the token arrives. Moderator dashboard writes keep their own path: the session is the verification there, so no challenge is required.

- Social share cards are rendered per page: the new pixel-art artwork (`src/server/seo/og-artwork.webp`) is the background of `/og`, and every page's `og:image`/`twitter:image` now points at that route with its own title and description (`Last Comments · Self-hosted comments for any site`, `About Last Comments · …`, `Blog · Last Comments`, each docs page, and a post without a cover). The card draws the title (Archivo Black), the description (JetBrains Mono) and a bottom-left framework strip — `React · Vue · Angular · HTML` — as SVG paths, so the server image needs no system fonts. Blog posts keep their cover as the share image. Favicon and manifest applied: `public/favicon/` is linked from the root route (16x16, 32x32, `favicon.ico`, apple-touch-icon) and `public/site.webmanifest` lists the same icon set with the site name, scope and colors.

- Add the self-host stack: `compose.yaml` runs PostgreSQL 18, one-shot Payload/business migrations, the app and the plugin worker, with Cloudflare Turnstile testing keys by default. Add `bun run stack:up` / `stack:down`, an init hook that creates the business database, and a self-hosting guide. The Dockerfile now builds a shared production-dependency stage, keeps the migration maintenance scripts and `drizzle/` in the runner, and generates the route tree in the build so a clean checkout no longer depends on local ignored files. CI now uses PostgreSQL 18 and adds a full Compose build/smoke job. Refresh the README, AGENTS/DESIGN guidance and stale docs; restore the production rate-limit budgets; keep the filter plugin opt-in (`enabled: false`).

- Mobile navigation rebuilt as a full-screen panel in the shape of the reference design: a brand bar carrying the theme toggle and the close button, a hairline-separated list of uppercase mono entries (the active one on a muted band), the Dashboard group expandable with its children nested underneath, and a pinned footer with the auth CTA (full-width Sign in while signed out, account plus sign-out otherwise). The panel replaces the old right-side sheet — the mobile header keeps only the brand and the menu button. `Sheet` gained a `side="full"` variant; the shared nav data and the auth button moved to `src/components/layout/nav-items.ts` and `src/components/layout/auth-button.tsx`.

- Landing art: the ASCII comment animation sits centered in the landing page's left rail, under the CTAs. `public/assets/ascii-magic-comment-{light,dark}.webp` are the source GIF baked per theme: the frames are cropped to their ink bounds, resized to 760px, re-encoded as animated WebP (45 frames, ~330 KB each) and mapped onto a background → foreground ramp built from the `--background`/`--foreground` tokens in `src/styles/app.css` — so the artwork's own background is the page background in both themes instead of a black rectangle. The page swaps the two files with the theme.

- The blog post page follows the app theme: the widget scope and the comment widget are client islands that read the theme from `<html>` (the class next-themes owns) and hand it to the widget, so a manual toggle flips the post body and the comments instead of leaving them on the OS preference. The widget surface is transparent in both themes — the host page owns the background.

- Guest verification works locally with Cloudflare's testing keys: `TURNSTILE_SITE_KEY` joins `TURNSTILE_SECRET_KEY` in the environment (the file config's `siteKey` still wins), and the plugin skips the hostname check for Cloudflare's testing secrets — Siteverify answers those with the hostname `example.com` on every domain, localhost included.
- Demo comment thread for the seeded blog post: `bun run db:seed:demo-comments` adds six guest comments (three top-level, three replies) to the "Introducing last-comments" thread; fixed row ids keep re-runs idempotent.
- Landing page: the left rail's bottom row now carries a GitHub icon link (the octocat mark, hand-drawn in `components/landing/framework-icons.tsx` — the icon set dropped brand glyphs) next to the theme toggle. The repository URL moved to `src/lib/site-links.ts`, shared with the docs sidebar.

- One shared header everywhere: `SiteHeader` (brand `LAST-COMMENTS`, Blog/Docs plus a Dashboard dropdown menu with rich Overview/Moderation/API-keys/Settings items, session-aware auth — Sign in renders only while signed out, otherwise the account name with sign-out) mounts on landing, blog and docs; the landing segmented nav, rail brand and custom docs header were removed so the brand appears once. Below `md` the links move into the full-screen mobile navigation while the brand stays visible. Fumadocs keeps a brand-less mobile bar (sidebar trigger + search). The docs grid reserves the header height via `--fd-banner-height` so the sticky sidebar slides below it instead of underneath. Wider brand-to-menu gap; the desktop nav scrolls horizontally instead of clipping on narrow screens.
- Docs sidebar gains a version switcher (`lib/docs/versions.ts` config: Latest 0.2.0 today, beta/archive entries commented out).
- Docs sidebar icons: every page declares `icon:` in frontmatter (the Widgets folder in `meta.json`); names travel through the page-tree serializer as strings and resolve to lucide elements client-side (`lib/docs/icons.ts` allowlist), since elements can't cross the server boundary.
- Move instance tuning out of `.env` into typed TS config files: new `src/server/auth/auth.config.ts` (providers, auto-provisioning, bootstrap email, proxy wiring, OIDC claim mapping), `verificationRequired` + public site key in `turnstile.config.ts`, guest edit window in new `comment-policy.config.ts`. Secrets and endpoint identity (connection strings, origins, `TURNSTILE_SECRET_KEY`, OIDC URLs, `OPENROUTER_API_KEY`) stay in env; `AUTH_PROVIDERS` still overrides the file when set. Drops the legacy unread `COMMENT_EDIT_WINDOW_MINUTES`. `.env.example` shrinks to secrets/URLs only.
- Give every comment plugin a dedicated folder with the same shape (`<id>.plugin.ts` + `<id>.config.ts` + `README.md`): `turnstile/` and `rate-limit/` split out of root files; `filter/filter-plugin.ts` renamed to `filter/filter.plugin.ts`. Root keeps only the contract, registry, config standard, and outbox worker.

- Add the `filter` comment plugin (advisory hide-for-review): `bad-words` lexical engine + OpenRouter `perplexity/pplx-decider-v1.2` decider via `@openrouter/sdk` (text + markdown-image thumbnails shrunk with `sharp` to 512px JPEG q60). Either engine, both, or neither (default off); 8 text + 8 image schemas each subsettable. Hits persist as `hidden` for the moderation queue; the plugin never throws (fail-open default). Tuning lives in `src/server/plugins/filter/filter.config.ts` per the new per-plugin TS config standard (`src/server/plugins/plugin-config.ts`); only `OPENROUTER_API_KEY` stays in env.

- Rebuild `/` as a better-auth-style landing page: fixed left hero rail (brand, announcement, headline, CTAs, theme toggle) beside a scrolling right column with segmented nav, README intro, package-manager install tabs, a six-card feature grid, the framework embed snippet, and latest posts. The landing draws its own chrome, so the shared `SiteHeader`/`SiteFooter` now render on `/blog*` only. Adds the `tabs` and `code-block` shadcn primitives to the registry.
- Upgrade Payload to `4.0.0-beta.2` and compatible TanStack Start/Router versions.
- Use the new admin layout/provider helpers and refresh the vendored Vite workarounds.
- Remove unused Sharp; disable authorship and LLM instructions to preserve the existing Payload schema.

## v0.1.0

Bare Payload v4 + TanStack Start, hardened to a boot contract.

### Backend kernel (`src/server/`)

- `{ data }` / `{ error: { code, message } }` envelope (`ok`/`fail`, `cache-control: no-store` default).
- `HttpError(status, code, message)` — 5xx messages hidden on the wire (`expose` defaults to `status < 500`).
- `withContext` — request-id echo, structured start/complete/error logs, never-throws; handler-built `Response`s (ready 503) pass through.
- zod helpers — `parseWith`, `parseJsonBody` (400 `MALFORMED_JSON`), `parseSearchParams` (list routes own their `limit`/`offset` schemas).
- Bun-native Postgres (`getBusinessSql` / `getBusinessDb` Drizzle seam), lazy `BUSINESS_DATABASE_URL` config, production loopback guard.
- Health reference slice — `/api/live` (no I/O, always 200) vs `/api/ready` (DB probe, 503 when degraded).
- Graceful shutdown — Nitro close hook + SIGINT/SIGTERM traps drain payload cache + business pool.

### Shell & UI

- Better Auth (email/password + Google) on the business database; instance-admin gates, site memberships, and the api-key plugin for server-to-server keys (`sites:*` instance keys, `pages:*` site-bound keys).
- Comment pager in the moderation dashboard plus the site/page/key management views.
- Rate-limit plugin (per-site, per-requester; `x-real-ip` by default) with `Retry-After` and fail-closed 503 when its store is unreachable.
- `withPayloadRoot` shell with `ThemeProvider` (class mode) + Base-UI `Toaster` (`toast.add()`, never sonner).
- `SiteNotFound` (404) + `SiteError` (loader throws, with recovery actions); favicon + `robots.txt` (admin/api disallowed).
- Placeholder `/` exercises button + toast; shadcn registry baseline (base-nova, neutral, lucide) — unused drops deleted with their deps.

### Ops

- `compose.yaml` local Postgres (`bun run db:up`), `scripts/smoke.ts` boot contract, CI (typecheck + biome + migrate + test + node-server build + live smoke).
- Dockerfile `HEALTHCHECK` on `/api/live`, minimal security headers (no CSP — Payload inline scripts; HSTS prod-only), `scripts/start.ts` preset-resolving entry.
- `.bun-version` single source (Dockerfile `ARG` + CI `bun-version-file`); `bun.lock` tracked for frozen installs.

### Docs

- README collection recipe, frontend paths (Query/Form/Store), structure map; `src/server/README.md` + `AGENTS.md` kernel contract; root `AGENTS.md` boot contract + verification checklist.

### Deliberately not included

Collections beyond `users`, i18n (en-only until ≥2 locales), OpenAPI, metrics, email/storage/RAG/chat.
