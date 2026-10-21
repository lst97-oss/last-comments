'use client'

import { Comments, type CommentsProps, CommentsTheme } from '@lst97-oss/last-comments-widgets/react'
import type { ReactNode } from 'react'

import { useWidgetTheme } from '@/hooks/use-widget-theme'

export function BlogComments(props: Omit<CommentsProps, 'theme'>) {
  const theme = useWidgetTheme()
  return <Comments {...props} theme={theme} />
}

export function BlogMarkdownScope({ className, children }: { className: string; children: ReactNode }) {
  const theme = useWidgetTheme()
  return (
    <CommentsTheme className={className} theme={theme}>
      {children}
    </CommentsTheme>
  )
}
