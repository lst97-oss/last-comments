# last-comments

Self-hosted comment threads for any page: a Payload CMS admin for content, a TanStack Start site with docs and blog, and a Bun/Drizzle comments service with Better Auth, a moderation dashboard, publisher API keys, and a server plugin system. Payload owns `/admin`; comments, sites, votes, API keys and auth sessions live in a separate business database.

## Quickstart (Docker Compose)

```bash
cp .env.example .env   # fill PAYLOAD_SECRET and BETTER_AUTH_SECRET
bun run stack:up       # Postgres 18 + migrations + app + plugin worker
```

Open <http://localhost:3000/create-admin-user> to create the first business admin, then sign in at `/moderation` to register a site and its allowed origins. Open `/admin` to create the first Payload admin user.

`compose.yaml` starts `postgres:18`, a one-shot migration service, the app on `:3000`, and the plugin outbox worker. Turnstile defaults to Cloudflare's public testing keys, which work on any hostname including localhost; replace both keys in `.env` for production. See [Self-hosting](/docs/self-hosting) for production settings, backups and upgrades.

## Local development

```bash
bun install
cp .env.example .env   # fill PAYLOAD_SECRET and BETTER_AUTH_SECRET
bun run db:up          # Postgres 18 on 127.0.0.1:5434
bun run db:migrate
bun run db:business:migrate
bun run generate:types
bun run generate:importmap
bun run generate-routes
bun run dev            # http://localhost:3000
```

`bun run db:up` starts only the Compose Postgres service, reusing the `last-comments-pgdata` volume. `bun run stack:up` runs the whole stack. For Google sign-in, register `http://localhost:3000/api/auth/callback/google` as the OAuth redirect URI. Public email/password registration stays disabled; the first account creates the instance admin, and later users sign in with Google or a configured provider.

Existing databases are not promoted during migration. To recover a failed first setup or grant the first instance admin manually:

```bash
bun run db:business:grant-admin -- user@example.com
```

Auth providers are configured in `src/server/auth/auth.config.ts` (`better-auth`, `oidc-jwt`, `header`, or a chain such as `['better-auth', 'oidc-jwt']`). `AUTH_PROVIDERS` overrides the file per environment; endpoint identity and secrets stay in `.env`. See [Identity](/docs/identity) and [Auth providers](/docs/auth).

## Public comments API

`GET|POST /api/comments` takes a `site` plus the absolute page `url`; register the page origin as an allowed origin for that site first. Guests provide a display name and, when verification is enabled, a Turnstile token. Responses include vote `score`, the signed-in viewer's `viewerVote`, and the author's site role as `authorRole` (`admin` | `moderator` | `null`).

- `PUT /api/comments/vote` casts or switches a vote; `DELETE /api/comments/vote?site=…&commentId=…` clears it. Voting needs a session through the first-party deployment or a same-origin proxy.
- Signed-in authors may edit their own comments at any time via `PATCH /api/comments/:id`. Guests receive a one-time `editKey` in the create response and may use it within the guest edit window (`comment-policy.config.ts`, default 10 minutes; `0` = unlimited). Expired guest edits fail with 403 `EDIT_WINDOW_EXPIRED`.
- Delete stays session-only via `DELETE /api/comments/:id?site=…`.
- Page threads are normally created by their first comment. A publisher can register them with `POST /api/admin/pages` (`{ site, url, pageKey?, title? }`, idempotent). A `pageKey` follows the thread when its URL changes. The URL must use one of the site's allowed origins, otherwise `400 PAGE_ORIGIN_NOT_ALLOWED`.
- Callers are members of the site or a site key holding `pages:write`; `pages:read` lists a site's threads. Instance keys keep `sites:*`.

Run `bun run plugins:work` as a separate process to deliver plugin events unless the Compose `worker` service is running.

## Moderation dashboard

`/moderation` → Pages → *View comments* renders a thread with `@lst97-oss/last-comments-widgets` (`/react` entry plus its scoped stylesheet): markdown bodies, `hidden`/`deleted` badges, nested replies, pinned comments first, and the moderation row. Only rendering and the composer come from the package; every action still posts to this repo's `/api/moderation`.

The moderator composer posts through `{ target: 'comment-create', site, pageId, parentId?, bodyMarkdown }`. It skips the public origin, guest-name and Turnstile gates because the session is the verification, while remaining site-scoped: unknown `pageId` → 404 `PAGE_NOT_FOUND`, hidden/deleted parent → 404 `PARENT_NOT_FOUND`, locked page → 409 `PAGE_LOCKED`. Bodies are capped at 10,000 characters (`COMMENT_BODY_LIMIT` in `src/lib/comment-schema.ts`), counted before trimming and passed to the widget as `bodyLimit`.

## Plugin system

Plugins are trusted server-side TypeScript modules, statically imported in `src/server/plugins/config.ts`. Installing a package does not activate it, and the host never downloads code at runtime.

```ts
import { createRateLimitPlugin } from '@/server/plugins/rate-limit/rate-limit.plugin'
import { turnstilePlugin } from '@/server/plugins/turnstile/turnstile.plugin'
import { discordPlugin } from '@example/last-comments-plugin-discord'

export const installedCommentPlugins = [
  turnstilePlugin,
  createRateLimitPlugin((request) => request.headers.get('x-real-ip')),
  discordPlugin,
] satisfies readonly CommentPlugin[]
```

Capabilities: `validateComment` (ordered, five-second timeout), `beforeOperation` (public create/edit/delete/vote boundaries), `screenComment` (advisory hide-for-review), `events` + `handleEvent` (transactional outbox delivered by `plugins:work`), and `migrations` (run by `db:business:migrate` only for installed plugins). Handlers must be idempotent and honor the abort signal. Plugin DDL never runs at app startup.

### Rate limiting

The `rate-limit` plugin is enabled by default and allows creates 5/10 minutes, edits and deletes 20/10 minutes, and votes 60/minute per site and requester. Signed-in requests use the Better Auth user ID; guests use a keyed HMAC of the resolved client IP, keyed by `BETTER_AUTH_SECRET`; the raw IP is not stored. The default resolver reads `x-real-ip`, so a trusted ingress must overwrite that header. DB errors fail closed with 503; over-limit responses include `Retry-After`.

To remove it, delete it from `installedCommentPlugins` and deploy after running the normal business migrations. Its table and data remain; `bun run db:business:plugins:uninstall rate-limit` explicitly drops them.

### Turnstile verification

Turnstile is enabled by default and verifies guest tokens server-side. Set `TURNSTILE_SECRET_KEY` in the environment and the public site key in `TURNSTILE_SITE_KEY` (or `turnstile.config.ts`, which wins). The consuming site renders the widget and sends the token as `verificationToken`; signed-in comments skip verification. Missing/invalid tokens fail with 403, unavailable verification fails closed with 503.

Local development can use Cloudflare's testing keys:

```bash
TURNSTILE_SITE_KEY=1x00000000000000000000AA
TURNSTILE_SECRET_KEY=1x0000000000000000000000000000000AA
```

### Filter screening

The `filter` plugin is installed but **off by default** (`enabled: false` in `filter.config.ts`). Enabling it holds violations for review as `hidden` instead of rejecting the write. It combines a local `bad-words` engine with an optional OpenRouter LLM decider; `OPENROUTER_API_KEY` is required only for the LLM engine, and failures resolve through `failOpen`.

## Scripts

| Script | Purpose |
|---|---|
| `dev` | Vite dev server on `:3000` |
| `build` | Generate routes, Scalar, admin CSS, types and import map, then `vite build` |
| `start` | Run the Nitro output for the active preset |
| `generate:types` / `generate:importmap` | Regenerate `payload-types.ts` / `src/payload-import-map.ts` |
| `generate-routes` | Regenerate `src/routeTree.gen.ts` |
| `generate:payload-admin-css` | Regenerate `src/styles/payload-admin-generated.css` (also runs in `build`) |
| `db:up` / `db:down` | Start/stop the Compose Postgres service |
| `db:migrate` | Apply Payload migrations (`src/migrations/`) |
| `db:business:migrate` | Apply core business migrations and installed-plugin migrations |
| `db:business:plugins:uninstall <id>` | Drop a supported plugin's data and migration history |
| `db:business:grant-admin` | Grant instance admin to an existing business account |
| `plugins:work` | Deliver plugin outbox events |
| `stack:up` / `stack:down` | Build/start or stop the full Compose stack |
| `smoke` | Boot-contract check against a running server |
| `typecheck` | `bun check` (Bun's native checker) |

## Structure

```
compose.yaml                 Postgres 18, migrations, app and plugin worker
Dockerfile                   multi-stage Bun image (prod deps, generated build, ops scripts)
payload.config.ts            Payload collections: users, media, posts
src/routes/                  site, blog, docs, Payload admin shell, comments/auth/moderation APIs
src/server/                  business kernel: modules, db, auth, plugins, health, security
src/lib/payload/             Payload admin bridge for TanStack Start
src/migrations/              Payload migrations
drizzle/                     business + plugin migrations
content/docs/                product documentation (Fumadocs MDX)
tests/                       unit and integration suites
vendor/                      vendored RSC-independent Payload Vite plugins
scripts/                     smoke, migrations, plugin worker, assets, docker init
.github/workflows/ci.yml     typecheck + Biome + migrations + tests + build/smoke + Docker Compose smoke
.bun-version                 single Bun version source (Dockerfile ARG + CI)
```

## Adding a frontend feature

TanStack add-ons can be installed with `bunx @tanstack/cli add <addon>`, but review every touched file: this repo depends on the Payload/Nitro wiring (`vite.config.ts` plugin order, `withPayloadRoot`, `payloadParseSearch`/`payloadStringifySearch`, `src/plugins/payload-shutdown.ts`). Hand-built routes are the common path:

```bash
# add src/routes/<name>.tsx
bun run generate-routes
bun run typecheck && bun test
bun run dev
```

Use `@/` imports only. Server work belongs in `createServerFn` handlers under `src/lib/`. Query already has its provider via `setupRouterSsrQueryIntegration` in `src/router.tsx`; never add an explicit `QueryClientProvider`.

## Adding a Payload collection

Payload currently owns `users`, `media` and `posts`. For a new collection:

1. Add it to `payload.config.ts` with fields, `admin.useAsTitle` and `access`.
2. Create a migration — never dev auto-push (`push: false`):
   ```bash
   bun run payload migrate:create   # split value/type imports per AGENTS.md trap
   bun run db:migrate
   bun run generate:types
   ```
3. Verify in `/admin` and extend the integration tests.

Business tables that Payload never owns belong in `src/server/modules/<name>/` on `getBusinessSql()` / `getBusinessDb()`, with migrations under `drizzle/` (see `src/server/README.md`).

Payload requires `PAYLOAD_SECRET`, `DATABASE_URL` and `PAYLOAD_PUBLIC_SERVER_URL` (loopback is rejected when `NODE_ENV=production`). Comments/auth use `BUSINESS_DATABASE_URL` and the `BETTER_AUTH_*` / Google settings. `.env.example` is the complete local reference.

## Deploy

- Vercel: default Nitro preset. Run `db:migrate` and `db:business:migrate` before rollout and run `plugins:work` as a separate worker.
- Docker/Compose: `bun run stack:up`. The image includes the admin-grant and plugin worker entrypoints plus the business migration script. Set `NODE_ENV=production`, a public HTTPS `PAYLOAD_PUBLIC_SERVER_URL`/`BETTER_AUTH_URL`, real secrets and real Turnstile keys. Use a reverse proxy that overwrites `x-real-ip`, and back up the `last-comments-pgdata` volume. See [Self-hosting](/docs/self-hosting).
