import { KeyRound, LayoutDashboard, Settings, ShieldCheck } from 'lucide-react'

export const NAV = [
  { to: '/blog', label: 'Blog' },
  { to: '/docs/$', label: 'Docs' },
  { to: '/about', label: 'About' },
] as const

export const DASHBOARD_MENU = [
  {
    to: '/dashboard',
    label: 'Overview',
    description: 'Site stats, threads and recent activity.',
    icon: LayoutDashboard,
  },
  {
    to: '/moderation',
    label: 'Moderation',
    description: 'Review hidden comments, hide, restore, pin and lock.',
    icon: ShieldCheck,
    search: { view: 'pages' } as const,
  },
  {
    to: '/api-keys',
    label: 'API keys',
    description: 'Site-bound publisher keys for threads and embeds.',
    icon: KeyRound,
  },
  {
    to: '/settings',
    label: 'Settings',
    description: 'Providers, plugins and the instance snapshot.',
    icon: Settings,
  },
] as const

export function isActivePath(pathname: string, to: string): boolean {
  if (to === '/blog') return pathname === '/blog' || pathname === '/blog/' || pathname.startsWith('/blog/')
  if (to === '/docs/$') return pathname === '/docs' || pathname.startsWith('/docs/')
  return pathname === to || pathname.startsWith(`${to}/`)
}

export function isDashboardActive(pathname: string): boolean {
  return ['/dashboard', '/moderation', '/api-keys', '/settings'].some(
    (to) => pathname === to || pathname.startsWith(`${to}/`),
  )
}
