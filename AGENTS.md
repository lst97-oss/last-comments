# Project guidelines

Self-hosted comment threads built on Payload v4 (`4.0.0-beta.2`) + TanStack Start (RSC, Nitro), with a separate Bun/Drizzle comments and auth service. The blog, docs, moderation dashboard and demo seeds are first-class app content here; keep the boot contract below intact when extending them.

## Load-bearing wiring — do not "simplify"

- `vite.config.ts` plugin order is the boot contract: `tailwindcss → clientModuleResolution → wrapCjsForClient → ssrStripDistStyleImports → reactDomServerInRsc → payloadDevTransforms → viteRsc({ serverHandler: false }) → reactStartRscVitePlugin() → tanstackStart({ rsc: { enabled: true }, importProtection }) → viteReact({ compiler }) → nitro()`. `serverHandler: false` is required — the default RSC handler 500s every request ("Invalid server handler entry"). `vendor/payload-tanstack-vite/*` is the RSC-independent subset because the full `payloadPlugin` wrapper 404s every route on this TanStack line; re-copy that directory after any `@payloadcms/tanstack-start` bump, and never switch to `withPayload()` without proving `/admin` still routes 200.
- `src/routes/_payload.tsx` uses `payloadLayoutRoute` with `loadLayoutData` and `createServerFunctionClient`; preserve the lazy component preload when wrapping it for admin CSS cleanup. `RootProvider` and `TanStackRouterAdapter` are no longer public exports.
- `src/routes/__root.tsx` MUST wrap with `withPayloadRoot` — it hands `<html>` to Payload's shell on `/admin` so `data-theme`/`dir`/`lang` rules match. A hand-rolled shell leaves ~60 admin rules unmatchable.
- `src/router.tsx` MUST keep `payloadParseSearch`/`payloadStringifySearch` — TanStack's default serializer JSON-quotes values (`?depth=%221%22`) and Payload ignores them, so admin pagination silently stops working.
- `src/lib/payload/server-fns.ts` MUST return `handleServerFunctions` result as-is. Re-wrapping in `toSerializable` strips RSC elements (`$$typeof` is a Symbol) and hangs relationship drawers / form-state on a spinner.
- `src/server/security/payload-server-url.ts` rejects loopback origins in production. The Docker build stage is production, so it exports a non-loopback `PAYLOAD_PUBLIC_SERVER_URL` for that one `RUN` layer only. Never relax the guard to make a build pass.
- `payload.config.ts` disables `llmInstructions` and `users.authorship` to avoid unused schema columns. It uses `push: false` + `prodMigrations`; schema changes go through committed migrations (`bun run payload migrate:create` → `bun run db:migrate`), never dev auto-push.
- Admin CSS needs a real `<link>` (`src/routes/_payload.tsx` component-rendered `<link>` + `scripts/assets/generate-payload-admin-css.ts` output). RSC-injected styles do not exist on first paint.

## Project skills

Read the matching skill before writing admin React or admin UI — they carry
the rules that are easy to get wrong and hard to notice.
- `.agents/skills/react-admin-patterns/` — server state through `useQuery`,
  writes through `useMutation`, what may be an effect, keys and memoization,
  the `'use memo'` placement, and the shared admin component catalogue.
  Read it before touching `src/routes/**`, `src/components/admin/**`,
  `src/hooks/**` or `src/lib/business-auth-client.ts`.
- `.agents/skills/admin-design-structure/` — the screen skeleton, section
  order and grids, the four chart panels and their empty states, the
  leaderboard layout, badges and controls. Read it before designing or
  restyling an admin screen.
- `.agents/skills/shadcn/` — the vendored shadcn/ui component docs and
  composition rules.

## Conventions

- Runtime is Bun (`Bun.env`, Web APIs). Aliases: `@/*` → `src/*`, `@payload-config` → `payload.config.ts`. `.bun-version` is the version source; keep the Dockerfile `ARG` default and CI `bun-version-file` aligned with it.
- Data layer: TanStack Query (`useQuery` for server state, `useMutation` for writes; provider auto-supplied by `setupRouterSsrQueryIntegration` in `src/router.tsx` — never add an explicit `QueryClientProvider`), TanStack Form (`useForm` + `form.Field` colocated per route; `formOptions` + `createServerValidate` from `@tanstack/react-form-start` only for server-validated forms), TanStack Store (`createStore` at feature module scope + `useStore`/`useSelector`; seed per-request via loader, never mutate module-scope state on the server). Reach for Query for server state, Form for user input, Store for client UI state — in that order. Admin screens use plain `useQuery` with local pending branches — there is no route-level `<Suspense>` boundary, so `useSuspenseQuery` would suspend without a fallback.
- Styling: Tailwind v4 (`src/styles/app.css` imported by the root shell; granular `theme.css` + `utilities.css`, preflight excluded so the shared shell never resets admin element styles). DESIGN.md is the styling authority (including its §17 shadcn rules): semantic tokens over hardcoded colours, neutral-by-default, status colours with purpose, Tailwind-first/CSS-when-clearer. shadcn registry components live in `src/components/ui/` (`base-nova`, neutral, lucide) — use them before hand-rolling primitives, add via `bunx shadcn add <name>`, mount shared providers (e.g. `<Toaster />`) once in the root shell. Palette lives in `app.css` (`:root`/`.dark` values, `@theme inline` mappings) — reuse tokens, never duplicate them. `app.css` header carries the CLI's `@import "tailwindcss"` detection needle (granular imports are equivalent for v4).
- Shell providers are fixed: `ThemeProvider` (`next-themes`, class mode) + Base-UI `Toaster` in `__root.tsx`; site toast is `toast.add()` from `@/components/ui/toast` — never `sonner`. Registry ships only exercised components (button/toast baseline); unused `bunx shadcn add` drops get deleted with their deps, never kept "for later". `shadcn` npm dep stays: it ships the `shadcn/tailwind.css` keyframes/variants `app.css` imports.
- Style (Biome): 2-space, 120 cols, single quotes, JSX double, semicolons as-needed, trailing commas. Linter covers `src/server/**` (recommended preset) plus `src/routes/**`, `src/components/admin/**`, `src/hooks/**`, `src/lib/**` (hook/key rules: `useExhaustiveDependencies`, `useHookAtTopLevel`, `noArrayIndexKey`, …); formatter skips `src/styles`, `src/migrations`, `vendor`, `routeTree.gen.ts`, `*.json`.
- Tests mirror the module basename under `tests/`, never co-located. Fakes are injected ports (`fetcher = fetch`), never `mock.module`.
- Changes to generated files are forbidden: `payload-types.ts`, `src/payload-import-map.ts`, `src/routeTree.gen.ts`, `src/styles/payload-admin-generated.css`, `public/scalar/` — regenerate via the matching script.
- Product docs live in `content/docs/` and are compiled by Fumadocs. Keep user-facing docs aligned with routes, API payloads, plugin defaults and the Compose stack.
- Runtime topology: `compose.yaml` runs Postgres 18, a one-shot migration service, the app and the plugin worker. The app image is built from the `runner` stage; migration/ops scripts must stay in that stage. Turnstile uses Cloudflare's hosted service — Compose defaults to its public testing keys.
- `migrate:create` trap: the CLI emits `MigrateUpArgs`/`MigrateDownArgs` as value imports, which crashes `migrate` with "does not provide an export named 'MigrateDownArgs'". Split to `import { sql }` + `import type { MigrateDownArgs, MigrateUpArgs }`, narrow handlers to `{ db }`.

## Verification before declaring done

- `bun run typecheck` clean (`bun check`, Bun 1.4.3+ native).
- `bun run check:biome` clean; `biome lint src/server` clean; imports organized.
- `bun run format` applied (formatter covers everything except `*.json`, `src/styles`, `src/migrations`, `vendor`, `routeTree.gen.ts`).
- After route changes: `bun run generate-routes`, then `bun run dev` + `bun run smoke` — `/` 200, `/admin` login redirect, `/api/users/me` 200 `{"user":null}`, `/api/live` 200 live, `/api/ready` 200|503 with report.
- Docker changes: `docker compose config` clean, then `bun run stack:up`; check `/`, `/docs`, `/api/live` and `/api/ready`, and `docker compose down`.
- Never read exit codes off pipelines (`cmd | tail; echo $?` reports `tail`). Capture first, read second.
