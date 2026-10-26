'use client'

import { Link, useLocation, useMatchRoute, useNavigate } from '@tanstack/react-router'
import {
  ChevronRight,
  ChevronsUpDown,
  House,
  KeyRound,
  LayoutDashboard,
  LogOut,
  type LucideIcon,
  Moon,
  Settings,
  ShieldCheck,
  Sun,
} from 'lucide-react'
import { useTheme } from 'next-themes'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
  useSidebar,
} from '@/components/ui/sidebar'
import { asModerationView, type ModerationView } from '@/lib/admin-format'
import { signOut, useSessionPrincipal } from '@/lib/business-auth-client'

function useModerationView(): ModerationView {
  // Route-agnostic: the sidebar renders on every dashboard page, so read the
  // raw location search instead of useSearch({ from }) which throws outside
  // the /moderation match ("Could not find an active match").
  const { searchStr } = useLocation()
  const view = new URLSearchParams(searchStr).get('view')
  return asModerationView(view)
}

type AdminNavItem = {
  to: string
  label: string
  icon: LucideIcon
}

type AdminNavGroup = {
  group: string
  items: AdminNavItem[]
}

const ADMIN_NAV: AdminNavGroup[] = [
  {
    group: 'Overview',
    items: [{ to: '/dashboard', label: 'Dashboard', icon: LayoutDashboard }],
  },
  {
    group: 'Manage',
    items: [
      { to: '/moderation', label: 'Moderation', icon: ShieldCheck },
      { to: '/api-keys', label: 'API keys', icon: KeyRound },
    ],
  },
]

function SiteSwitcher() {
  const { isMobile } = useSidebar()
  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <DropdownMenu>
          <DropdownMenuTrigger
            render={
              <SidebarMenuButton
                size="lg"
                className="data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground"
              />
            }
          >
            <img src="/favicon/favicon.ico" alt="" aria-hidden className="size-8 shrink-0" />
            <span className="grid flex-1 text-left text-sm leading-tight">
              <span className="truncate font-medium">Last Comments</span>
              <span className="truncate text-xs text-muted-foreground">Admin</span>
            </span>
            <ChevronsUpDown className="ml-auto" />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" side={isMobile ? 'bottom' : 'right'} sideOffset={4}>
            <DropdownMenuItem>
              <Link to="/" className="flex w-full items-center gap-2">
                <House />
                Back to site
              </Link>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </SidebarMenuItem>
    </SidebarMenu>
  )
}

// Icons and labels swap on the `dark` class, as the site's own toggles do, so nothing depends on client-only state.
function ThemeToggle() {
  const { resolvedTheme, setTheme } = useTheme()
  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <SidebarMenuButton tooltip="Switch theme" onClick={() => setTheme(resolvedTheme === 'dark' ? 'light' : 'dark')}>
          <Sun className="hidden dark:block" />
          <Moon className="block dark:hidden" />
          <span className="dark:hidden">Switch to dark mode</span>
          <span className="hidden dark:inline">Switch to light mode</span>
        </SidebarMenuButton>
      </SidebarMenuItem>
    </SidebarMenu>
  )
}

function UserMenu() {
  const navigate = useNavigate()
  const { isMobile } = useSidebar()
  const { principal } = useSessionPrincipal()
  const email = principal?.email ?? ''
  const name = principal?.displayName || email || 'Admin'
  const initials = name
    .split(/[\s@._-]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join('')

  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <DropdownMenu>
          <DropdownMenuTrigger
            render={
              <SidebarMenuButton
                size="lg"
                className="data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground"
              />
            }
          >
            <Avatar size="sm">
              <AvatarFallback>{initials || 'A'}</AvatarFallback>
            </Avatar>
            <span className="grid flex-1 text-left text-sm leading-tight">
              <span className="truncate font-medium">{name}</span>
              <span className="truncate text-xs text-muted-foreground">{email}</span>
            </span>
            <ChevronsUpDown className="ml-auto size-4" />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" side={isMobile ? 'bottom' : 'right'} sideOffset={4}>
            <DropdownMenuGroup>
              <DropdownMenuLabel>
                <span className="grid gap-0.5">
                  <span className="truncate font-medium">{name}</span>
                  <span className="truncate font-normal text-muted-foreground">{email}</span>
                </span>
              </DropdownMenuLabel>
            </DropdownMenuGroup>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => void navigate({ to: '/settings' })}>
              <Settings />
              Settings
            </DropdownMenuItem>
            {principal?.provider === 'better-auth' ? (
              <DropdownMenuItem variant="destructive" onClick={() => void signOut()}>
                <LogOut />
                Log out
              </DropdownMenuItem>
            ) : (
              <DropdownMenuLabel className="font-normal text-muted-foreground">
                Signed in via single sign-on — sign out at your identity provider.
              </DropdownMenuLabel>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      </SidebarMenuItem>
    </SidebarMenu>
  )
}

export function AdminSidebar() {
  const matchRoute = useMatchRoute()

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader>
        <SiteSwitcher />
      </SidebarHeader>
      <SidebarContent>
        {ADMIN_NAV.map((section) => (
          <SidebarGroup key={section.group}>
            <SidebarGroupLabel>{section.group}</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {section.items.map((item) => {
                  if (item.to === '/moderation') return <ModerationNav key={item.to} />
                  const Icon = item.icon
                  const isActive = Boolean(matchRoute({ to: item.to, fuzzy: item.to !== '/dashboard' }))
                  return (
                    <SidebarMenuItem key={item.to}>
                      <SidebarMenuButton
                        render={<Link to={item.to} activeProps={{ 'data-active': true }} />}
                        tooltip={item.label}
                        isActive={isActive}
                      >
                        <Icon />
                        <span>{item.label}</span>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  )
                })}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        ))}
      </SidebarContent>
      <SidebarFooter>
        <ThemeToggle />
        <UserMenu />
      </SidebarFooter>
    </Sidebar>
  )
}

const MODERATION_SUBS: { view: ModerationView; label: string }[] = [
  { view: 'pages', label: 'Pages' },
  { view: 'recent', label: 'Recent' },
  { view: 'users', label: 'Users' },
  { view: 'sites', label: 'Sites' },
]

function ModerationNav() {
  const search = useModerationView()
  // Read the target path from useLocation, not useMatchRoute: matchRoute reads
  // the previous page while a navigation is pending, so a group that mounts
  // mid-navigation (e.g. from Dashboard) started collapsed. The thread detail
  // route (/moderation/$pageId) stays under the same entry.
  const { pathname } = useLocation()
  const isActive = pathname === '/moderation' || pathname.startsWith('/moderation/')
  return (
    <Collapsible defaultOpen={isActive} className="group/collapsible">
      <SidebarMenuItem>
        <CollapsibleTrigger render={<SidebarMenuButton tooltip="Moderation" isActive={isActive} />}>
          <ShieldCheck />
          <span>Moderation</span>
          <ChevronRight className="ml-auto transition-transform duration-200 group-data-open/collapsible:rotate-90" />
        </CollapsibleTrigger>
        <CollapsibleContent>
          <SidebarMenuSub>
            {MODERATION_SUBS.map((sub) => (
              <SidebarMenuSubItem key={sub.view}>
                <SidebarMenuSubButton
                  render={<Link to="/moderation" search={{ view: sub.view }} />}
                  isActive={isActive && search === sub.view}
                >
                  <span>{sub.label}</span>
                </SidebarMenuSubButton>
              </SidebarMenuSubItem>
            ))}
          </SidebarMenuSub>
        </CollapsibleContent>
      </SidebarMenuItem>
    </Collapsible>
  )
}
