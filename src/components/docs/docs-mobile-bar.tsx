'use client'

import { cn } from 'cn'
import { useDocsLayout } from 'fumadocs-ui/layouts/docs'
import { SidebarIcon } from 'lucide-react'
import type { ComponentProps } from 'react'

// Grid/sticky/height classes mirror the default fumadocs header (including the
// row-height hook: the grid pins the row to 0px by default, which would clip
// this bar the same way).
export function DocsMobileBar(props: ComponentProps<'header'>) {
  const { slots } = useDocsLayout()
  const SidebarTrigger = slots.sidebar.trigger
  const SearchTrigger = typeof slots.searchTrigger === 'object' ? slots.searchTrigger.sm : undefined
  return (
    <header
      {...props}
      className={cn(
        '[grid-area:header] sticky top-(--fd-docs-row-1) z-30 flex items-center gap-2 border-b backdrop-blur-sm transition-colors bg-fd-background/80 h-(--fd-header-height) px-4 md:hidden max-md:layout:[--fd-header-height:--spacing(14)]',
        props.className,
      )}
    >
      <SidebarTrigger className="shrink-0 p-2" aria-label="Toggle sidebar">
        <SidebarIcon aria-hidden />
      </SidebarTrigger>
      <div className="flex-1" />
      {SearchTrigger ? <SearchTrigger hideIfDisabled className="shrink-0 p-2" /> : null}
    </header>
  )
}
