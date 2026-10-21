import type { PluginOption } from 'vite';
/**
 * Dev-time transforms:
 * - Replaces `process.cwd()` with `"/"` in client code (non-SSR, non-prebundled)
 * - Injects Vite HMR + React Refresh preamble into SSR-rendered HTML (dev only)
 *
 * The preamble is injected just before `</head>`, *after* everything React
 * renders into the head. React 19 treats `<meta>`/`<link>`/`<style>`/`<title>`
 * as hoistable resources it matches by key (position-tolerant), but a
 * non-hoistable inline `<script type="module">` placed *before* React's first
 * rendered head node makes hydration position-match that script against a
 * `<style>`/`<meta>` and throw — discarding the whole tree client-side, which
 * aborts in-flight server-function fetches and intermittently breaks drawers,
 * forms, and navigation. Appending after React's head content keeps the
 * preamble out of that positional comparison while still running before the
 * body's app-entry module.
 */
export declare function payloadDevTransforms(): PluginOption;
//# sourceMappingURL=devTransforms.d.ts.map