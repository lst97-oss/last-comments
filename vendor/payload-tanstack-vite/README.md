# Vendored Payload TanStack Vite workarounds

Copied from `@payloadcms/tanstack-start@4.0.0-beta.4` on 2026-10-26:
`dist/withPayload/workarounds/*`, `dist/withPayload/importProtection.*`,
and `dist/withPayload/config/{external,optimizeDeps}.*`. The previous copy was
beta.2 (2026-10-18); beta.4 changed `external.js` (dev and build externals,
the `serverExternalPackages` boundaries) and `importProtection.js` (the
`@payloadcms/tanstack-start/routes` server-only specifier, which the API route
now imports).

The full `withPayload` wrapper previously broke routing on this TanStack line.
Keep these individual plugins in `vite.config.ts` with Start owning the RSC
server handler (`serverHandler: false`). Recheck `/`, `/admin`, and API routes
before replacing this wiring with the wrapper. `stubPrettierInClient` is only
wired into the upstream wrapper, so it is not vendored here.

Local adaptations, kept on every refresh from the installed adapter:

- `clientModuleResolution.js` uses Bun file/URL APIs instead of `node:fs` /
  `node:path`.
- `importProtection.js` starts with a comment that notes it retains `node:module`
  for the complete builtin-module list.
- `external.js` keeps the leaf packages the beta.2 list externalized and beta.4
  dropped (`drizzle-kit`, `sharp`, `require-in-the-middle`,
  `json-schema-to-typescript`, `pino`, `graphql`, `libsql`) in
  `ssrExternalPackages`. `sharp` must stay external: the app loads it for its
  OG images.
