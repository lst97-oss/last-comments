import { createFileRoute } from '@tanstack/react-router'
import { AdminNotFound } from '@/lib/payload/admin-not-found'
import { adminRenderServerFn } from '@/lib/payload/admin-render'
import { type AdminRenderResult, buildAdminRenderRequest, resolveAdminRenderResult } from '@/lib/payload/admin-route'

export const Route = createFileRoute('/_payload/admin/$')({
  validateSearch: (search: Record<string, unknown>) => search,
  loaderDeps: ({ search }) => ({ searchKey: JSON.stringify(search) }),
  loader: async ({ location, params }) => {
    const segments = (params._splat ?? '').split('/').filter(Boolean)
    const result = (await adminRenderServerFn({
      data: buildAdminRenderRequest(location.searchStr, segments),
    })) as AdminRenderResult
    return resolveAdminRenderResult(result)
  },
  notFoundComponent: AdminNotFound,
  component: AdminSplat,
})

function AdminSplat() {
  const data = Route.useLoaderData()
  return <>{data.element}</>
}
