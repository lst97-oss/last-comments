import type { PluginOption } from 'vite';
/**
 * Client-side module resolution:
 * 1. Stubs RSC modules (`@payloadcms/.../rsc`) with no-op components so the
 *    Vite optimizer never tries to bundle their server implementations.
 * 2. Redirects bare `payload` imports made from user code (outside of
 *    `node_modules` and our own packages) to `payload/shared`. The main
 *    `payload` entry has top-level side effects requiring Node.js APIs.
 * 3. Resolves `/client` subpath exports for `@payloadcms/plugin-*` and
 *    `@payloadcms/storage-*` packages when normal Vite resolution fails in
 *    monorepo dev (no `dist/` built yet).
 */
export declare function clientModuleResolution(): PluginOption;
//# sourceMappingURL=clientModuleResolution.d.ts.map