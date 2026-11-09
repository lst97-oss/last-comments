import configPromise from '@payload-config'
import { createServerFn } from '@tanstack/react-start'

// The admin route factories (`payloadAdminIndexRoute` / `payloadAdminSplatRoute`) own redirect, not-found and render
// handling on the client. This returns the raw `loadAdminPage` result: the client renders `rscPayload.page`, not
// `rscPayload` itself. Rendering the object is what reports "Objects are not valid as a React child".
export const adminRenderServerFn = createServerFn({ method: 'GET', strict: false })
  .validator((input: { _splat: string; search: Record<string, string | string[]> }) => input)
  .handler(async ({ data }) => {
    // Keep the generated server-component map out of the browser graph. The
    // RSC client build must not evaluate Payload's server-only imports.
    const [{ loadAdminPage }, { getPayloadImportMap }] = await Promise.all([
      import('@payloadcms/tanstack-start/server'),
      import('@/lib/payload/import-map'),
    ])
    return loadAdminPage({
      config: await configPromise,
      importMap: getPayloadImportMap(),
      search: data.search,
      splat: data._splat,
    })
  })
