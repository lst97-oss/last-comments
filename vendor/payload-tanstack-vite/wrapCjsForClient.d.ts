import type { PluginOption } from 'vite';
/**
 * Wraps CJS `node_modules` files in ESM-compatible code when served to the
 * client.
 *
 * Packages in `optimizeDeps.exclude` (like `payload`, `@payloadcms/ui`) import
 * CJS dependencies that Vite serves via raw `/@fs/` URLs, bypassing
 * pre-bundling. The browser fails to parse them because they use
 * `module.exports` / `exports.X` syntax.
 *
 * This plugin detects CJS patterns in the transform phase and wraps them with
 * a CommonJS-like runtime shim so the browser can execute them as ESM.
 */
export declare function wrapCjsForClient(): PluginOption;
//# sourceMappingURL=wrapCjsForClient.d.ts.map