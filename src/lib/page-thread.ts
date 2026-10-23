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
  deleted: number
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

// One hidden or deleted comment on the Hidden & removed list.
export type TakedownRow = {
  id: string
  pageId: string
  pageTitle: string | null
  canonicalUrl: string
  authorName: string
  bodyMarkdown: string
  status: 'visible' | 'hidden' | 'deleted'
  createdAt: string
}

// One server-paged slice of the takedowns, with the total across all pages.
export type TakedownPage = { takedowns: TakedownRow[]; total: number }

export function embedSnippet(siteKey: string, page: PageSummary): string {
  const parts = [`site: '${siteKey}'`, `url: '${page.canonicalUrl}'`]
  if (page.pageKey) parts.push(`pageKey: '${page.pageKey}'`)
  return `{ ${parts.join(', ')} }`
}
