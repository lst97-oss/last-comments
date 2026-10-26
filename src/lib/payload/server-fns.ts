import configPromise from '@payload-config'
import { createServerFunctionClient } from '@payloadcms/tanstack-start/client'
import { loadLayoutData } from '@payloadcms/tanstack-start/layouts'
import { handleServerFunctions } from '@payloadcms/tanstack-start/server'
import { createServerFn } from '@tanstack/react-start'

// Payload server functions shared by all admin routes — config + importMap
// injection point. Runs on the server via TanStack Start's wire format,
// NOT Next 'use server' actions.
export const payloadServerFn = createServerFn({ method: 'POST', strict: false })
  .validator((input: { name: string; args: Record<string, unknown> }) => input)
  .handler(async ({ data }): Promise<Response> => {
    const { getPayloadImportMap } = await import('@/lib/payload/import-map')
    const result = await handleServerFunctions({
      args: data.args,
      config: configPromise,
      importMap: getPayloadImportMap(),
      name: data.name,
    })
    // `handleServerFunctions` already runs the adapter's `transformResult`
    // (`serializeForRsc`), which converts React elements into RSC handles.
    // Wrapping that in `toSerializable` a second time strips every element
    // back out (`$$typeof` is a Symbol), so handlers that return rendered
    // trees — `render-document` for the relationship "Create New" drawer,
    // `form-state`, `render-list` — arrive with their payload missing and the
    // UI hangs on its spinner. Return the already-serialized value as-is.
    return result
  })

export const payloadLayoutServerFn = createServerFn({ method: 'GET', strict: false }).handler(async () => {
  const { getPayloadImportMap } = await import('@/lib/payload/import-map')
  return loadLayoutData({ config: await configPromise, importMap: getPayloadImportMap() })
})

export const payloadServerFunctionClient = createServerFunctionClient({ runServerFn: payloadServerFn })
