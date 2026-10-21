# src/server — business backend kernel

## Role / pipeline position

Business logic lives here, DDD-style, behind thin TanStack Start route adapters in `src/routes/api.*.ts` (routes extract data fns, wrap with `withContext`; route-level authn/authz helpers live in the route file). Sibling `payload.config.ts` + `src/lib/payload/` own the CMS; this tree owns everything else.

Module map — `http/`: `errors.ts` (`HttpError`, `toHttpError`), `response.ts` (`ok`/`fail` envelope), `with-context.ts` (requestId, logging; passes through handler-built `Response`s), `route-guards.ts` (shared authn/authz primitives), `cors.ts` (`applyCors` preflight), `validation.ts` (`parseWith` zod → 400 `VALIDATION_ERROR`); `observability/logger.ts` (structured console, sink-injectable); `db/business-sql.ts` (lazy Bun SQL + Drizzle seam); `config/business-env.ts` (lazy connection string); `env.ts` (required boot env, dual-runtime); `security/payload-server-url.ts` (loopback guard); `modules/<name>/{domain,application,infrastructure,http}` (one bounded context per dir; `health` is the reference slice: live liveness + ready readiness).

## Invariants

- Layer direction: `http → application → domain`; ports (e.g. `DbProbe`) are declared in `application`, implemented in `infrastructure`. Domain stays pure.
- Envelope is fixed: `ok()` → `{ data }`, `fail()` → `{ error: { code, message } }`, `cache-control: no-store` default. Never hand-roll `Response.json` in modules.
- `HttpError.expose` defaults to `status < 500`: 5xx wire messages are generic; the real message goes to logs only.
- `withContext` never throws and always echoes `x-request-id` (inbound header or `crypto.randomUUID()`). Handler-built `Response`s pass through (ready's 200|503 preserved); plain data gets the `ok()` envelope.
- Input validation uses `parseWith(schema, input)` only (`validation.ts` also holds `parseJsonBody`, `parseSearchParams`) — zod failures throw `HttpError(400, 'VALIDATION_ERROR', '<path>: <message>; …')` (`expose: true`). Malformed JSON bodies are 400 `MALFORMED_JSON`. Each list route owns its `limit`/`offset` schema (limit 1–100, offset ≥ 0, enforced not clamped). No per-module 400 mapping.
- Liveness vs readiness: `/api/live` never touches I/O (always 200 when the process is alive); `/api/ready` is the DB-backed probe (503 when degraded). Liveness checks must never probe the DB — a DB outage must not kill-loop the container.
- Probes/adapters never reject: failures resolve to `{ ok: false, ... }` so use cases need no try/catch of their own.
- Dual-runtime: `env.ts` + `config/business-env.ts` (Payload Node-CLI graph) stay Bun/Node-safe (`typeof Bun` guards); `db/business-sql.ts` is Bun-only — never import it from that graph.
- `getServerEnv()` gains no new required keys; business config resolves lazily via `getBusinessEnv()` (`BUSINESS_DATABASE_URL`).
- One shared client: new modules reuse `getBusinessSql()` / `getBusinessDb()`; no per-module pools, env parsing, or migration runners (business tables never go through Payload `prodMigrations`).
- Tests mirror the basename under `tests/`, inject fakes via deps params, never `mock.module`. TDD red → green per slice.
- Do-not-"fix" seams: `health` is unauthenticated by design.
- No Hono, no npm extraction (a second app promotes the kernel to a `packages/server-kit` workspace first).

## Conventions

- New-module recipe: `domain/` types + pure fns → `application/` use case with deps param → `infrastructure/` adapters → `http/` split of `getXData` (data) + `handleXGet` (`ok`-wrapped) → route `GET: (ctx) => withContext(async () => getXData())(ctx)`, keeping the literal `server:` key.
- Log events: `request.start { requestId, method, path }`, `request.complete { requestId, status, latencyMs }`, `request.error { requestId, code, status }`; scope via `logger.child({ requestId })`.
- Units: `latencyMs` numbers, `uptimeSeconds` integers; probe timeout 2000 ms (`DB_PROBE_TIMEOUT_MS`).
- Style: 2-space, 120 cols, single quotes, semicolons as-needed (Biome); lazy singletons, no import-time side effects.
