import type { PluginOption } from 'vite';
/**
 * Provides a working `react-dom/server` inside the RSC environment.
 *
 * Payload's version-diff converters (`@payloadcms/richtext-lexical`'s
 * `field/Diff/converters/*` and `@payloadcms/ui`'s `Version/RenderFieldsToDiff`)
 * call `renderToStaticMarkup` while rendering a Server Component. In the RSC
 * environment Vite activates the `react-server` export condition, under which
 * every `react-dom/server*` subpath resolves to `server.react-server.js` — a
 * stub that throws `react-dom/server is not supported in React Server
 * Components`. Force-resolving past the condition isn't enough either: the
 * static renderer reads the *client* React internals
 * (`__CLIENT_INTERNALS_DO_NOT_USE_OR_WARN_USERS_THEY_CANNOT_UPGRADE`), which
 * the `react-server` build of `react` doesn't expose.
 *
 * So we pre-bundle a self-contained `react-dom/server` with client React
 * inlined (esbuild, deliberately WITHOUT the `react-server` condition) and
 * redirect `react-dom/server` to it in the RSC graph only. The bundle is fully
 * self-contained, so the RSC environment's `react-server` condition can't
 * reach into it. JSX elements created by the RSC-graph React stay renderable
 * because React identifies elements via a process-global `Symbol.for(...)`.
 *
 * Delete this once `react-dom/server` (or an equivalent static renderer) is
 * usable from the `react-server` condition without a separate bundle.
 */
export declare function reactDomServerInRsc(): PluginOption;
//# sourceMappingURL=reactDomServerInRsc.d.ts.map