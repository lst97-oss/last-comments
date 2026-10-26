// @ts-nocheck — vendored Payload TanStack workaround plugins (see vendor/payload-tanstack-vite/README.md).

import tailwindcss from '@tailwindcss/vite'
import { tanstackStart } from '@tanstack/react-start/plugin/vite'
import { reactStartRscVitePlugin } from '@tanstack/react-start-rsc/plugin/vite'
import viteReact from '@vitejs/plugin-react'
import viteRsc from '@vitejs/plugin-rsc'
import { fumadocsMdx } from 'fumadocs-mdx/vite'
import { nitro } from 'nitro/vite'
import { unwasm } from 'unwasm/plugin'
import { defineConfig } from 'vite'
import { clientModuleResolution } from '#vendor/payload-tanstack-vite/clientModuleResolution.js'
import { payloadDevTransforms } from '#vendor/payload-tanstack-vite/devTransforms.js'
import { payloadNoExternalPatterns, ssrExternalPackages } from '#vendor/payload-tanstack-vite/external.js'
import {
  defaultImportProtectionIgnoreImporters,
  onImportProtectionViolation,
  serverOnlyClientSpecifiers,
} from '#vendor/payload-tanstack-vite/importProtection.js'
import { optimizeDepsExcludeDefaults, optimizeDepsIncludeDefaults } from '#vendor/payload-tanstack-vite/optimizeDeps.js'
import { reactDomServerInRsc } from '#vendor/payload-tanstack-vite/reactDomServerInRsc.js'
import { ssrStripDistStyleImports } from '#vendor/payload-tanstack-vite/stripDistStyleImports.js'
import { wrapCjsForClient } from '#vendor/payload-tanstack-vite/wrapCjsForClient.js'

// Vite bundles this config to node_modules/.vite-temp and imports the bundle,
// so import.meta.dir/dirname point at the temp dir — not the project root.
// Resolve aliases from the dev server working directory (project root) instead.
const projectDirectory = Bun.cwd
const projectPath = (relativePath: string) => `${projectDirectory}/${relativePath.replace(/^\.\//, '')}`

const PRIVATE_NO_STORE = { 'cache-control': 'private, no-store' }

// The Fumadocs packages reach `node:fs/promises` and `react-dom/server` for
// their server-only helpers, and the docs collection module that pulls them
// in also belongs to the client graph (the route renders the MDX body). They
// only touch those modules on paths the client never calls, so the imports
// are allowed.
function allowFumadocsRuntime(violation) {
  if (typeof violation?.importer === 'string' && violation.importer.includes('fumadocs-')) return false
  return onImportProtectionViolation(violation)
}

// Minimal hardening headers for admin + API surfaces. No CSP: Payload admin
// ships inline scripts that a static policy would break. HSTS only in
// production — dev runs over plain http://localhost.
const PRIVATE_SECURITY_HEADERS =
  Bun.env.NODE_ENV === 'production'
    ? {
        'referrer-policy': 'same-origin',
        'strict-transport-security': 'max-age=31536000; includeSubDomains',
        'x-content-type-options': 'nosniff',
      }
    : {
        'referrer-policy': 'same-origin',
        'x-content-type-options': 'nosniff',
      }

export default defineConfig({
  resolve: {
    alias: [
      {
        find: '@payload-config',
        replacement: projectPath('./payload.config.ts'),
      },
      {
        find: '@payloadcms/ui/scss/app.scss',
        replacement: projectPath('./node_modules/@payloadcms/ui/dist/css/app.css'),
      },
      {
        find: 'sanitize-filename',
        replacement: projectPath('./vendor/sanitize-filename.ts'),
      },
    ],
    dedupe: ['react', 'react-dom', 'scheduler', '@payloadcms/ui'],
    tsconfigPaths: true,
  },
  environments: {
    ssr: {
      resolve: {
        noExternal: payloadNoExternalPatterns,
      },
    },
  },
  optimizeDeps: {
    exclude: [...optimizeDepsExcludeDefaults, '@tanstack/start-server-core'],
    include: [...optimizeDepsIncludeDefaults],
  },
  ssr: {
    external: [...ssrExternalPackages],
    noExternal: payloadNoExternalPatterns,
  },
  plugins: [
    // Fumadocs MDX compiles the content/docs collection; it must run before
    // the Tailwind plugin so the MDX transform sees the source files.
    fumadocsMdx(),
    tailwindcss(),
    // shiki ships its regex engine as a wasm asset under the `unwasm` export
    // condition; without this plugin the bundler parses the binary as a module.
    unwasm({}),
    clientModuleResolution(),
    wrapCjsForClient(),
    ssrStripDistStyleImports(),
    reactDomServerInRsc(),
    payloadDevTransforms(),
    // serverHandler:false — Start owns dev server entry; default 500s otherwise
    viteRsc({ serverHandler: false }),
    reactStartRscVitePlugin(),
    tanstackStart({
      rsc: { enabled: true },
      importProtection: {
        client: {
          excludeFiles: [],
          specifiers: serverOnlyClientSpecifiers,
        },
        ignoreImporters: [...defaultImportProtectionIgnoreImporters],
        include: ['**/*'],
        mockAccess: 'warn',
        onViolation: allowFumadocsRuntime,
        server: { files: [] },
      },
    }),
    // React Compiler (OXC, client-only): annotation mode compiles only 'use memo' files.
    viteReact({ compiler: { target: '19', compilationMode: 'annotation' } }),
    nitro({
      plugins: ['./src/plugins/payload-shutdown.ts'],
      preset: Bun.env.NITRO_PRESET ?? 'vercel',
      routeRules: {
        '/admin/**': { headers: { ...PRIVATE_NO_STORE, ...PRIVATE_SECURITY_HEADERS } },
        '/_payload/**': { headers: { ...PRIVATE_NO_STORE, ...PRIVATE_SECURITY_HEADERS } },
        // The public site settings are the one cacheable API document. This exact rule
        // must match CACHE_CONTROL in src/routes/api.comments.settings.ts, or the platform
        // header wins and widgets re-read the policy on every page view.
        '/api/comments/settings': {
          headers: { ...PRIVATE_SECURITY_HEADERS, 'cache-control': 'public, max-age=60, stale-while-revalidate=300' },
        },
        '/api/**': { headers: { ...PRIVATE_NO_STORE, ...PRIVATE_SECURITY_HEADERS } },
      },
    }),
  ],
})
