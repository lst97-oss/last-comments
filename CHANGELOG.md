# Changelog

## Unreleased

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

## v0.2.0

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
