/**
 * Client dep-optimizer config used by `withPayload`. Kept separate from the
 * SSR/RSC externalization config (`./external.ts`) so each concern stays small.
 */
/**
 * Packages we know contain Node-only code or top-level side effects requiring
 * Node APIs. Excluding them from the client optimizer prevents Vite from
 * walking into their main entries and trying to bundle server-only imports
 * for the browser.
 */
export declare const optimizeDepsExcludeDefaults: string[];
/**
 * Transitive dependencies of `@payloadcms/ui` and `payload` that need to be
 * pre-bundled for the client. Vite's auto-discovery doesn't reliably pick
 * these up because their parent packages are in `optimizeDeps.exclude`, so we
 * list them explicitly using the `parent > child` syntax.
 *
 * Each entry below fixes a specific late-discovery re-optimization: without it,
 * Vite discovers the dep *after* its initial crawl, forcing a full dep
 * re-optimization mid-session that 404s in-flight `.vite/deps/*` chunks and
 * remounts the admin (dropping client state). This is why the list can't simply
 * be deleted — it is the "complete first pass" for the admin's dep graph.
 */
export declare const optimizeDepsIncludeDefaults: string[];
//# sourceMappingURL=optimizeDeps.d.ts.map