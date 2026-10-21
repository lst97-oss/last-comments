import configPromise from '@payload-config'
import { createServerFn } from '@tanstack/react-start'
import { buildAdminRenderParams } from '@/lib/payload/admin-route'

export const adminRenderServerFn = createServerFn({ method: 'GET', strict: false })
  .validator((input: { segments: string[]; search: Record<string, string | string[]> }) => input)
  .handler(async ({ data }): Promise<unknown> => {
    // Keep the generated server-component map out of the browser graph. The
    // RSC client build must not evaluate Payload's server-only imports.
    const [{ loadAdminPage }, { getPayloadImportMap }] = await Promise.all([
      import('@payloadcms/tanstack-start/server'),
      import('@/lib/payload/import-map'),
    ])
    const result = await loadAdminPage({
      config: await configPromise,
      importMap: getPayloadImportMap(),
      search: data.search,
      splat: buildAdminRenderParams(data.segments).segments?.join('/'),
    })

    if ('_redirect' in result) {
      return { intent: { type: 'redirect', url: result._redirect }, element: null }
    }

    if ('_notFound' in result) {
      return { intent: { type: 'notFound' }, element: result.rscPayload ?? null }
    }

    return {
      element: result.rscPayload,
      intent: null,
      metadata: result.metadata,
      routeKey: result.routeKey,
    }
  })
