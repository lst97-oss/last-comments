import { withPayloadRoot } from '@payloadcms/tanstack-start/client'
import type { QueryClient } from '@tanstack/react-query'
import { createRootRouteWithContext, HeadContent, Scripts, useRouterState } from '@tanstack/react-router'
import { RootProvider } from 'fumadocs-ui/provider/tanstack'
import { ThemeProvider } from 'next-themes'
import { SiteFooter } from '@/components/layout/site-footer'
import { SiteHeader } from '@/components/layout/site-header'
import { Toaster } from '@/components/ui/toast'
import '@/styles/app.css'

interface MyRouterContext {
  queryClient: QueryClient
}

export const Route = createRootRouteWithContext<MyRouterContext>()({
  head: () => ({
    meta: [
      {
        charSet: 'utf-8',
      },
      {
        name: 'viewport',
        content: 'width=device-width, initial-scale=1, viewport-fit=cover',
      },
      { name: 'theme-color', content: '#ffffff' },
      { property: 'og:site_name', content: 'Last Comments' },
      { property: 'og:locale', content: 'en_US' },
      { name: 'twitter:card', content: 'summary_large_image' },
    ],
    scripts: [],
    links: [
      { rel: 'icon', type: 'image/svg+xml', href: '/favicon.svg' },
      { rel: 'manifest', href: '/site.webmanifest' },
    ],
  }),
  shellComponent: withPayloadRoot(RootDocument),
})

function RootDocument({ children }: { children: React.ReactNode }) {
  // Payload owns the `/admin` DOM; other surfaces render their own shells.
  const pathname = useRouterState({ select: (state) => state.location.pathname })
  const isPublic =
    pathname === '/' ||
    pathname === '/about' ||
    pathname === '/blog' ||
    pathname === '/blog/' ||
    pathname.startsWith('/blog/')
  const isBlog = pathname === '/blog' || pathname === '/blog/' || pathname.startsWith('/blog/')
  // next-themes owns `.dark`, so Fumadocs theming stays off.
  const isDocs = pathname === '/docs' || pathname.startsWith('/docs/')
  return (
    <html lang="en" dir="ltr" data-public-ui="" suppressHydrationWarning>
      <head>
        <HeadContent />
        {/* Keep Shiki blocks readable when JavaScript never runs. */}
        <noscript>
          <style>{`.lc-codeblock pre[data-shiki='pending'] { animation: none !important; background-color: transparent !important; }`}</style>
        </noscript>
      </head>
      <body>
        <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
          {isDocs ? (
            <RootProvider theme={{ enabled: false }}>
              <SiteHeader />
              {children}
            </RootProvider>
          ) : isPublic ? (
            <div className="flex min-h-svh flex-col">
              <SiteHeader />
              <div id="main-content" className="flex flex-1 flex-col">
                {children}
              </div>
              {isBlog && <SiteFooter />}
            </div>
          ) : (
            children
          )}
          <Toaster />
        </ThemeProvider>
        <Scripts />
      </body>
    </html>
  )
}
