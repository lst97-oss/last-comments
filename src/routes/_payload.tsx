import { payloadLayoutRoute } from '@payloadcms/tanstack-start/client'
import { createFileRoute } from '@tanstack/react-router'
import React from 'react'
import { payloadLayoutServerFn, payloadServerFunctionClient } from '@/lib/payload/server-fns'
import payloadAdminCss from '@/styles/payload-admin.css?url'

const layout = payloadLayoutRoute({ load: payloadLayoutServerFn, serverFunction: payloadServerFunctionClient })
const AdminLayout = layout.component

export const Route = createFileRoute('/_payload')({
  ...layout,
  // Keep preload inside the route expression so Start's splitter retains the wrapper.
  component: Object.assign(PayloadLayout, { preload: AdminLayout.preload }),
  head: () => ({
    meta: [{ charSet: 'utf-8' }, { name: 'viewport', content: 'width=device-width, initial-scale=1' }],
  }),
})

function PayloadLayout() {
  useAdminStyleCleanup()
  return (
    <>
      {/* Component-rendered so React 19 hoists it on mount (SSR + client
      nav) and removes it on unmount. The route `head()` link is NOT used:
      TanStack never removes route head links on leave, so the admin sheet
      kept styling the public site after back-navigation. */}
      <link rel="stylesheet" href={payloadAdminCss} precedence="default" />
      <AdminLayout />
    </>
  )
}

// The component-rendered admin sheet above self-removes on unmount (React 19
// hoisted resource). What remains: Vite's injected <style> tags for Payload
// package paths plus RSC-injected Payload <link> tags (data-rsc-css-href) —
// TanStack never removes those on leave. Drop them by identity. Sub-route
// switches inside /admin keep this layout mounted, so no flash there.
function useAdminStyleCleanup() {
  React.useEffect(() => {
    return () => {
      document.querySelectorAll('link[rel="stylesheet"]').forEach((el) => {
        const href = el.getAttribute('href') ?? ''
        if (href.includes('@payloadcms')) el.remove()
      })
      document.querySelectorAll('style').forEach((el) => {
        const devId = el.getAttribute('data-vite-dev-id') ?? ''
        const text = el.textContent ?? ''
        if (devId.includes('@payloadcms') || text.startsWith('@layer payload-default, payload;')) el.remove()
      })
    }
  }, [])
}
