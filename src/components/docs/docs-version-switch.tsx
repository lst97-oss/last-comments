'use client'

import { cn } from 'cn'
import { Check, ChevronsUpDown } from 'lucide-react'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { currentDocVersion, docVersions } from '@/lib/docs/versions'

export function DocsVersionSwitch() {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        aria-label={`Docs version ${currentDocVersion.version}`}
        className="flex w-full items-center gap-2 rounded-lg border border-border bg-background px-3 py-2 text-left outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
      >
        <span className="flex min-w-0 flex-1 flex-col">
          <span className="truncate text-sm font-semibold">{currentDocVersion.label}</span>
          <span className="truncate text-xs text-muted-foreground">{currentDocVersion.version}</span>
        </span>
        <ChevronsUpDown aria-hidden className="size-4 shrink-0 text-muted-foreground" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" side="bottom" className="w-(--anchor-width)">
        {docVersions.map((entry) => {
          const current = entry.version === currentDocVersion.version
          return (
            <DropdownMenuItem
              key={entry.version}
              render={<a href={entry.href} />}
              className={cn('flex-col items-start gap-0.5 py-2', current && 'font-semibold')}
            >
              <span className="flex w-full items-center justify-between gap-2">
                <span className="text-sm">{entry.label}</span>
                {current ? <Check aria-hidden className="size-4 shrink-0" /> : null}
              </span>
              <span className="text-xs text-muted-foreground">{entry.version}</span>
            </DropdownMenuItem>
          )
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
