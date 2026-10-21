# Vendored Payload TanStack Vite workarounds

Copied from `@payloadcms/tanstack-start@4.0.0-beta.2` on 2026-10-18:
`dist/withPayload/workarounds/*`, `dist/withPayload/importProtection.*`,
and `dist/withPayload/config/{external,optimizeDeps}.*`.

The full `withPayload` wrapper previously broke routing on this TanStack line.
Keep these individual plugins in `vite.config.ts` with Start owning the RSC
server handler (`serverHandler: false`). Recheck `/`, `/admin`, and API routes
before replacing this wiring with the wrapper.

Local adaptation: `clientModuleResolution.js` uses Bun file/URL APIs instead
of `node:fs` / `node:path`. `importProtection.js` retains `node:module` for the
complete builtin-module list. Keep these adaptations when refreshing from the
installed adapter after every Payload bump.
