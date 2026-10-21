import { createFileRoute, notFound } from '@tanstack/react-router'
import { createServerFn } from '@tanstack/react-start'
import { useFumadocsLoader } from 'fumadocs-core/source/client'
import { DocsLayout } from 'fumadocs-ui/layouts/docs'
import { DocsBody, DocsDescription, DocsPage, DocsTitle } from 'fumadocs-ui/layouts/docs/page'
import { Suspense, use, useMemo } from 'react'
import { DocsMobileBar } from '@/components/docs/docs-mobile-bar'
import { DocsVersionSwitch } from '@/components/docs/docs-version-switch'
import { getMDXComponents } from '@/components/docs/mdx-components'
import { withDocTreeIcons } from '@/lib/docs/icons'
import { baseOptions } from '@/lib/docs/layout-shared'
import { serializeDocsPageTree } from '@/lib/docs/page-tree'
import { docs, source } from '@/lib/docs/source'
import '@/styles/docs.css'

export const Route = createFileRoute('/docs/$')({
  component: Page,
  loader: async ({ params }) => {
    const slugs = params._splat?.split('/') ?? []
    const data = await serverLoader({ data: slugs })
    await docs.getPage(data.path)?.preload()
    return data
  },
  head: ({ loaderData }) => {
    const image = loaderData?.baseUrl ? `${loaderData.baseUrl.replace(/\/+$/, '')}/og-image.png` : '/og-image.png'
    return {
      meta: [
        { title: loaderData?.title ? `${loaderData.title} · Last Comments` : 'Docs · Last Comments' },
        {
          name: 'description',
          content: loaderData?.description ?? 'Widget guides and API reference for Last Comments.',
        },
        { property: 'og:type', content: 'article' },
        ...(loaderData?.canonical ? [{ property: 'og:url', content: loaderData.canonical }] : []),
        ...(loaderData?.title ? [{ property: 'og:title', content: `${loaderData.title} · Last Comments` }] : []),
        { property: 'og:image', content: image },
        { name: 'twitter:image', content: image },
      ],
      links: loaderData?.canonical ? [{ rel: 'canonical', href: loaderData.canonical }] : [],
    }
  },
})

// Hoisted so the MDX component map and the layout options keep a stable
// identity across renders.
const MDX_COMPONENTS = getMDXComponents()
const DOCS_LAYOUT_OPTIONS = baseOptions()
const DOCS_LAYOUT_SLOTS = { header: DocsMobileBar }
const DOCS_SIDEBAR = { banner: <DocsVersionSwitch /> }

const serverLoader = createServerFn({ method: 'GET' })
  .validator((slugs: string[]) => slugs)
  .handler(async ({ data: slugs }) => {
    const page = source.getPage(slugs)
    if (!page) throw notFound()
    const { getServerEnv } = await import('@/server/env')
    const baseUrl = getServerEnv().PAYLOAD_PUBLIC_SERVER_URL.replace(/\/+$/, '')

    return {
      path: page.path,
      title: page.data.title ?? 'Docs',
      description: page.data.description ?? 'Widget guides and API reference for Last Comments.',
      pageTree: serializeDocsPageTree(source.pageTree),
      baseUrl,
      canonical: `${baseUrl}/docs${slugs.length > 0 ? `/${slugs.join('/')}` : ''}`,
    }
  })

function Content({ path }: { path: string }) {
  const page = docs.getPage(path)
  if (!page) throw new Error(`unknown page: ${path}`)

  const { toc } = use(page.load())
  const MDX = page.body

  return (
    <DocsPage toc={toc}>
      <DocsTitle>{page.title}</DocsTitle>
      <DocsDescription>{page.description}</DocsDescription>
      <DocsBody>
        <MDX components={MDX_COMPONENTS} />
      </DocsBody>
    </DocsPage>
  )
}

function Page() {
  const { path, pageTree } = useFumadocsLoader(Route.useLoaderData())
  // Icon names arrive as strings (the only form that survives serialization);
  // resolve them to lucide elements for the sidebar renderer.
  const tree = useMemo(() => withDocTreeIcons(pageTree), [pageTree])

  return (
    // Reserve the shared SiteHeader's height inside the docs grid: the grid
    // derives every sticky top (`--fd-docs-row-1/2/3`) from
    // `--fd-banner-height`, so without this the sidebar sticks at viewport
    // top 0 and slides underneath the header. Keep in sync with
    // `SiteHeader` (`h-14`).
    <div className="[--fd-banner-height:3.5rem]">
      <DocsLayout {...DOCS_LAYOUT_OPTIONS} tree={tree} slots={DOCS_LAYOUT_SLOTS} sidebar={DOCS_SIDEBAR}>
        <Suspense>
          <Content path={path} />
        </Suspense>
      </DocsLayout>
    </div>
  )
}
