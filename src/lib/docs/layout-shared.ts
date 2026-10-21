import type { BaseLayoutProps } from 'fumadocs-ui/layouts/shared'

import { GITHUB_URL } from '@/lib/site-links'

export function baseOptions(): BaseLayoutProps {
  return {
    nav: {
      title: 'LAST-COMMENTS',
      url: '/',
    },
    githubUrl: GITHUB_URL,
    // No sidebar shortcuts: `links` render above the page tree, and every
    // docs page already links from the tree — an entry here would duplicate
    // it (as `/docs/api-reference` once did). The blog links back to docs
    // where needed.
  }
}
