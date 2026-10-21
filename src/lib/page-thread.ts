// Dates cross the wire as strings, so this client copy stays separate from
// the server types.

export const PAGE_LIST_LIMIT = 100

export type PageSummary = {
  id: string
  canonicalUrl: string
  pageKey: string | null
  title: string | null
  isLocked: boolean
  total: number
  visible: number
  hidden: number
  latestAt: string | null
  latest: {
    id: string
    authorName: string
    bodyMarkdown: string
    status: 'visible' | 'hidden' | 'deleted'
    createdAt: string
  } | null
  recent: {
    windowDays: number
    count: number
    totalAuthors: number
    authors: { authorName: string; count: number }[]
    preview: {
      id: string
      authorName: string
      bodyMarkdown: string
      status: 'visible' | 'hidden' | 'deleted'
      createdAt: string
    }[]
  }
}

export function embedSnippet(siteKey: string, page: PageSummary): string {
  const parts = [`site: '${siteKey}'`, `url: '${page.canonicalUrl}'`]
  if (page.pageKey) parts.push(`pageKey: '${page.pageKey}'`)
  return `{ ${parts.join(', ')} }`
}
