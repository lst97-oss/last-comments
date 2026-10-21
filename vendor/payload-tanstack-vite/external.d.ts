/**
 * SSR/RSC externalization config used by `withPayload`. Kept separate from the
 * client optimizer config (`./optimizeDeps.ts`) so each concern stays small.
 */
/**
 * Packages externalized during dev serve (`ssr.external`). Node's loader resolves
 * their CJS/UMD directly; letting Vite's dev SSR transform touch them can break
 * fragile UMD wrappers (e.g. `pluralize`, whose `this`-based global assignment
 * throws when transformed rather than required).
 *
 * Safe here whoever declared the entry: Node resolves from the importing package,
 * so pnpm's isolated layout never applies. The build is stricter — see
 * {@link buildBundledPackages}.
 */
export declare const ssrExternalPackages: string[];
/**
 * Entries of {@link ssrExternalPackages} that must bundle in the production build.
 *
 * Externalizing only works for specifiers resolvable from the project root. These
 * are leaf deps of Payload packages, so under pnpm they live in `.pnpm/…` and a bare
 * specifier in a root-resolved chunk is invisible — `ERR_MODULE_NOT_FOUND` at
 * runtime, or a build-time resolve failure under Nitro's re-bundle pass.
 *
 * `pluralize` also needs forcing back via `noExternal` (see `withPayload`); the
 * storage leaves don't, since their adapters are already `noExternal`.
 */
export declare const buildBundledPackages: string[];
/**
 * External packages for the production `vite build` only (not dev serve).
 *
 * Externalizes the `@payloadcms/*` package boundaries — plus `payload` — so each
 * resolves its own transitive Node deps (`pino`, `drizzle-orm`, `libsql`, …) from
 * its own `node_modules` at runtime. Externalizing only the leaf deps breaks under
 * pnpm: a leaf imported by bundled code becomes an unresolvable bare specifier from
 * `dist/`, since pnpm does not hoist it; see {@link buildBundledPackages}.
 *
 * Kept out of dev's `ssr.external` on purpose: the monorepo resolves these to
 * TypeScript source (`.ts` imported via `.js` specifiers), which only Vite's
 * transform can resolve — an externalized copy would hit Node's raw resolver and
 * fail on the `.js`→`.ts` mismatch.
 */
export declare const buildExternalPackages: string[];
export declare const payloadNoExternalPatterns: Array<RegExp | string>;
//# sourceMappingURL=external.d.ts.map