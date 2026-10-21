import { payloadParseSearch, payloadStringifySearch } from '@payloadcms/tanstack-start/shared'
import { createRouter as createTanStackRouter } from '@tanstack/react-router'
import { setupRouterSsrQueryIntegration } from '@tanstack/react-router-ssr-query'
import { getContext } from '@/integrations/tanstack-query/root-provider'
import { SiteError } from '@/lib/site-error'
import { SiteNotFound } from '@/lib/site-not-found'
import { routeTree } from '@/routeTree.gen'

export function getRouter() {
  const context = getContext()
  const router = createTanStackRouter({
    routeTree,
    context,
    defaultNotFoundComponent: SiteNotFound,
    defaultErrorComponent: SiteError,
    parseSearch: payloadParseSearch,
    stringifySearch: payloadStringifySearch,
  })

  setupRouterSsrQueryIntegration({ router, queryClient: context.queryClient })

  return router
}

declare module '@tanstack/react-router' {
  interface Register {
    router: ReturnType<typeof getRouter>
  }
}
