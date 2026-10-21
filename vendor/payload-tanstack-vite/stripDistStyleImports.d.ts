import type { PluginOption } from 'vite';
/**
 * Stops Vite (and the underlying Node ESM loader) from trying to load
 * SCSS/CSS/LESS during SSR/RSC when the importer lives inside a built
 * `dist/` directory or when the specifier is a bare package name.
 *
 * We do this two ways, because either layer can fail:
 *
 * 1. `resolveId` redirects style specifiers to a virtual empty module —
 *    handles cases where Vite asks us to resolve them.
 * 2. `transform` strips top-level `import './x.css'` statements out of any
 *    JS/TS file living under `node_modules/.../dist/` for non-client envs.
 *    This is the bulletproof path for prod-packed `@payloadcms/ui` (and
 *    similar) dependencies that get pre-bundled by Vite's SSR/RSC dep
 *    optimizer (esbuild). Esbuild preserves `.css` import statements as-is,
 *    and Node's native ESM loader then crashes with
 *    `Unknown file extension ".css"`. Removing them at the source avoids
 *    that entirely.
 */
export declare function ssrStripDistStyleImports(): PluginOption;
//# sourceMappingURL=stripDistStyleImports.d.ts.map