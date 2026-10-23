# `src/server/` — business backend

This is where the app's own backend lives: HTTP plumbing, database access, and one folder per business area (`modules/`). Payload CMS (`payload.config.ts`, `src/lib/payload/`) remains its own system. Better Auth and comment business data use `BUSINESS_DATABASE_URL`, a separate PostgreSQL database accessed through the Bun-native Drizzle client. Never point that setting at Payload's `DATABASE_URL`.

```
src/server/
├── http/               Response envelope + errors + request wrapper + zod validation
├── observability/      Structured logger
├── db/                 Business Postgres client and Drizzle schema (Bun-native)
├── config/             Business env (connection string resolution)
├── env.ts              Required boot env (Payload + database + origin)
├── security/           Production origin guard
├── plugins/            Plugin contracts, Zod config, structured logging, and event delivery
└── modules/
    ├── comments/       Public comments, moderation, and URL rules
    ├── admin/          First-admin setup and site creation
    └── health/         Reference slice: live (no I/O) + ready (DB probe) → application → infrastructure → http
```

## How a request flows

```
route (src/routes/api.*.ts)  thin adapter, no logic
  └─ withContext()            request-id, logs, error mapping
       └─ getXData()          module's data function
            └─ use case       application/ — orchestrates, takes deps as params
                 ├─ domain/   pure types + functions, no I/O
                 └─ infrastructure/  database, external services
```

Health is the worked example: `domain/health.ts` builds the report (`buildLiveReport` for liveness, `buildHealthReport` for readiness), `application/get-health.ts` runs the probe, `infrastructure/db-probe.ts` pings Postgres, `http/health-handler.ts` wraps it in the envelope. `/api/live` never touches the DB (liveness); `/api/ready` is the DB-backed probe (readiness, 503 when degraded).

## Rules of thumb

- **One shared client.** Need Postgres? Call `getBusinessSql()` (raw SQL) or `getBusinessDb()` (Drizzle). Never open your own pool.
- **One shared envelope.** Return data with `ok()`, failures with `fail()` / `HttpError`. Clients always see `{ data }` or `{ error: { code, message } }`. Handlers that already build a `Response` (ready: 200|503) pass through `withContext` untouched.
- **Errors stay typed.** `HttpError(status, code, message)`; 5xx messages are hidden from the wire automatically (`expose` defaults to `status < 500`).
- **Validation is shared.** Parse untrusted input with `parseWith(schema, input)` (`http/validation.ts`) — zod failures throw `HttpError(400, 'VALIDATION_ERROR', '<path>: <message>; …')`. Bodies go through `parseJsonBody(request, schema)` (malformed JSON → 400 `MALFORMED_JSON`); query strings through `parseSearchParams(url, schema)` with coercible fields, each list route owning its `limit`/`offset` schema. Never hand-roll 400 mapping per module.

## Adding a new business area

Copy the health slice layer by layer (`modules/health/` → `modules/<name>/`): domain types first, then the use case, then infrastructure, then the `getXData` / `handleXGet` split, finally the route file. The per-directory `AGENTS.md` next to this file has the exact recipe and the invariants reviewers will check.

## Comments, auth, and plugins

`src/server/db/schema.ts` owns the business/auth schema and `drizzle/business/` its generated migrations. Better Auth provides the first admin with email/password and Google OAuth for later accounts; comment identity can be anonymous. The event outbox is committed in the same transaction as business changes. Run `bun run plugins:work` as a separate process to deliver it.

Deploy-installed plugin packages are statically imported in `plugins/config.ts` and must satisfy the versioned `CommentPlugin` contract from `plugins/comment-plugins.ts`. The host never downloads code at runtime; install trusted packages with Bun and keep their secrets in environment variables. Plugins must make event handlers idempotent. Turnstile or other anti-spam providers implement `verificationProvider` plus `validateComment`; with `verificationRequired` on (the default in `plugins/turnstile/turnstile.config.ts`), posts fail closed if no such provider is installed, and provider validation (Turnstile siteverify) runs for every post — guests and signed-in authors alike — so an unconfigured provider fails closed with `COMMENT_VERIFICATION_UNAVAILABLE`. `verificationRequired: false` skips that validation entirely, which is the local-development bypass for posting.

New plugins follow the per-plugin TS config standard (`plugins/plugin-config.ts`): non-secret tuning in a typed `<id>.config.ts` next to the implementation, secrets only from env. The `filter` plugin (`plugins/filter/`, advisory hide-for-review via `bad-words` + OpenRouter `pplx-decider-v1.2`) is the reference adopter — see its README. Its contract addition, `screenComment` + `publishCommentScreening`, OR-merges `hide` verdicts and never throws: screening failures resolve through the plugin's `failOpen` setting, so writers never see a 5xx from screening.

## Deliberately not here (yet)

- **No server-kernel package.** The widget package is published separately; this kernel stays internal until a second app needs it.
- **No Hono.** TanStack Start route handlers plus this kernel are the only HTTP layer.
