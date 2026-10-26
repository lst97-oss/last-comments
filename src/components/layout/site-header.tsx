'use client'

import { Link, useRouterState } from '@tanstack/react-router'
import { cn } from 'cn'
import { ChevronDown } from 'lucide-react'

import { AuthButton } from '@/components/layout/auth-button'
import { MobileNav } from '@/components/layout/mobile-nav'
import { DASHBOARD_MENU, isActivePath, isDashboardActive, NAV } from '@/components/layout/nav-items'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'

function DashboardMenu({ pathname }: { pathname: string }) {
  const active = isDashboardActive(pathname)
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        aria-label="Dashboard menu"
        className={cn(
          'flex shrink-0 items-center gap-1 rounded-md px-2.5 py-1.5 text-sm transition-colors outline-none hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring data-popup-open:text-foreground',
          active ? 'text-foreground' : 'text-muted-foreground',
        )}
      >
        Dashboard
        <ChevronDown aria-hidden className="size-3.5 transition-transform duration-200 data-popup-open:rotate-180" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" sideOffset={8} className="w-80 p-2">
        {DASHBOARD_MENU.map((item) => {
          const itemActive = pathname === item.to || pathname.startsWith(`${item.to}/`)
          const Icon = item.icon
          return (
            <DropdownMenuItem
              key={item.to}
              render={
                'search' in item ? (
                  <Link to={item.to} search={item.search} aria-current={itemActive ? 'page' : undefined} />
                ) : (
                  <Link to={item.to} aria-current={itemActive ? 'page' : undefined} />
                )
              }
              className={cn('items-start gap-3 p-3', itemActive && 'bg-accent')}
            >
              <span className="flex size-9 shrink-0 items-center justify-center rounded-md border border-border">
                <Icon aria-hidden className="size-4" />
              </span>
              <span className="flex min-w-0 flex-col gap-0.5">
                <span className="text-sm font-semibold">{item.label}</span>
                <span className="text-xs text-muted-foreground">{item.description}</span>
              </span>
            </DropdownMenuItem>
          )
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

export function SiteHeader() {
  const pathname = useRouterState({ select: (state) => state.location.pathname })
  return (
    <header className="sticky top-0 z-40 border-b border-border bg-background/80 backdrop-blur">
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:absolute focus:top-2 focus:left-2 focus:z-50 focus:rounded-md focus:bg-primary focus:px-3 focus:py-1.5 focus:text-sm focus:text-primary-foreground"
      >
        Skip to content
      </a>
      <div className="mx-auto flex h-14 w-full max-w-5xl items-center gap-4 px-4 md:gap-8">
        <Link
          to="/"
          className="inline-flex shrink-0 items-center gap-2 text-sm font-semibold tracking-tight focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
        >
          <img src="/favicon/favicon.ico" alt="" className="size-8" />
          LAST-COMMENTS
        </Link>
        <nav aria-label="Primary" className="hidden min-w-0 flex-1 items-center gap-1 md:flex">
          {NAV.map((item) => {
            const active = isActivePath(pathname, item.to)
            return (
              <Link
                key={item.to}
                to={item.to}
                aria-current={active ? 'page' : undefined}
                className={cn(
                  'shrink-0 rounded-md px-2.5 py-1.5 text-sm transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring',
                  active ? 'text-foreground' : 'text-muted-foreground hover:text-foreground',
                )}
              >
                {item.label}
              </Link>
            )
          })}
          <DashboardMenu pathname={pathname} />
        </nav>
        <span className="hidden md:contents">
          <AuthButton />
        </span>
        <span className="ml-auto md:hidden">
          <MobileNav />
        </span>
      </div>
    </header>
  )
}
