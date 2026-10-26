'use client'

import { Link, useRouterState } from '@tanstack/react-router'
import { cn } from 'cn'
import { ChevronDown, Menu, Moon, Sun, X } from 'lucide-react'
import { useTheme } from 'next-themes'
import { useState } from 'react'

import { AuthButton } from '@/components/layout/auth-button'
import { DASHBOARD_MENU, isActivePath, NAV } from '@/components/layout/nav-items'
import { Button } from '@/components/ui/button'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible'
import { Sheet, SheetClose, SheetContent, SheetTitle, SheetTrigger } from '@/components/ui/sheet'

export function MobileNav() {
  const pathname = useRouterState({ select: (state) => state.location.pathname })
  const { resolvedTheme, setTheme } = useTheme()
  const [open, setOpen] = useState(false)
  const close = () => setOpen(false)

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger
        aria-label="Open menu"
        className="inline-flex size-9 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors outline-none hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
      >
        <Menu aria-hidden className="size-4" />
      </SheetTrigger>
      <SheetContent
        side="full"
        showCloseButton={false}
        className="w-full max-w-none gap-0 bg-background p-0 text-foreground"
      >
        <div className="flex h-14 shrink-0 items-center gap-2 border-b border-border px-4">
          <Link to="/" onClick={close} className="inline-flex items-center gap-2 text-sm font-semibold tracking-tight">
            <img src="/favicon/favicon.ico" alt="" className="size-5" />
            LAST-COMMENTS
          </Link>
          <span className="ml-auto flex items-center gap-1">
            <Button
              aria-label="Toggle theme"
              onClick={() => setTheme(resolvedTheme === 'dark' ? 'light' : 'dark')}
              size="icon-sm"
              variant="ghost"
            >
              <Sun aria-hidden className="block size-4 fill-current dark:hidden" />
              <Moon aria-hidden className="hidden size-4 dark:block" />
            </Button>
            <SheetClose render={<Button size="icon-sm" variant="ghost" />}>
              <X aria-hidden />
              <span className="sr-only">Close</span>
            </SheetClose>
          </span>
        </div>

        <SheetTitle className="sr-only">Menu</SheetTitle>

        <nav aria-label="Mobile" className="flex-1 overflow-y-auto overscroll-contain">
          {NAV.map((item) => {
            const active = isActivePath(pathname, item.to)
            return (
              <Link
                key={item.to}
                to={item.to}
                onClick={close}
                aria-current={active ? 'page' : undefined}
                className={cn(
                  'block border-b border-border px-4 py-4 font-mono text-base tracking-[0.08em] uppercase transition-colors',
                  active ? 'bg-muted text-foreground' : 'text-muted-foreground hover:text-foreground',
                )}
              >
                {item.label}
              </Link>
            )
          })}

          <div className="border-b border-border">
            <Collapsible defaultOpen>
              <CollapsibleTrigger className="group flex w-full items-center justify-between px-4 py-4 font-mono text-base tracking-[0.08em] uppercase text-foreground">
                Dashboard
                <ChevronDown
                  aria-hidden
                  className="size-4 shrink-0 transition-transform duration-200 group-data-[panel-open]:rotate-180"
                />
              </CollapsibleTrigger>
              <CollapsibleContent>
                {DASHBOARD_MENU.map((item) => (
                  <Link
                    key={item.to}
                    to={item.to}
                    {...('search' in item ? { search: item.search } : {})}
                    onClick={close}
                    className="block py-3 pr-4 pl-8 font-mono text-xs tracking-[0.08em] uppercase text-muted-foreground transition-colors hover:text-foreground"
                  >
                    {item.label}
                  </Link>
                ))}
              </CollapsibleContent>
            </Collapsible>
          </div>
        </nav>

        <div className="shrink-0 border-t border-border p-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
          <AuthButton className="ml-0 h-11 w-full" size="lg" />
        </div>
      </SheetContent>
    </Sheet>
  )
}
