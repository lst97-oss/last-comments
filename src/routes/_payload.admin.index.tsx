import { createFileRoute } from '@tanstack/react-router'
import { AdminNotFound } from '@/lib/payload/admin-not-found'
import { adminRenderServerFn } from '@/lib/payload/admin-render'
import { type AdminRenderResult, parseAdminSearchParams, resolveAdminRenderResult } from '@/lib/payload/admin-route'

export const Route = createFileRoute('/_payload/admin/')({
  validateSearch: (search: Record<string, unknown>) => search,
  loaderDeps: ({ search }) => ({ searchKey: JSON.stringify(search) }),
  notFoundComponent: AdminNotFound,
  loader: async ({ location }) => {
    const result = (await adminRenderServerFn({
      data: { search: parseAdminSearchParams(location.searchStr), segments: [] },
    })) as AdminRenderResult
    return resolveAdminRenderResult(result)
  },
  component: AdminIndex,
})

function AdminIndex() {
  const data = Route.useLoaderData()
  return <>{data.element}</>
}
