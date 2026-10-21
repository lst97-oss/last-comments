'use client'

import { AdminLogin } from '@/components/admin/admin-login'
import { AdminSidebar } from '@/components/admin/admin-sidebar'
import { Separator } from '@/components/ui/separator'
import { SidebarInset, SidebarProvider, SidebarTrigger } from '@/components/ui/sidebar'
import { Spinner } from '@/components/ui/spinner'
import { useSessionPrincipal } from '@/lib/business-auth-client'

export function DashboardShell({ children }: { children: React.ReactNode }) {
  const { principal, isPending } = useSessionPrincipal()

  if (isPending) {
    return (
      <div className="grid min-h-svh place-items-center bg-background">
        <p aria-live="polite" className="flex items-center gap-2 text-sm text-muted-foreground">
          <Spinner data-icon="inline-start" />
          Loading…
        </p>
      </div>
    )
  }

  if (!principal) {
    return <AdminLogin />
  }

  return (
    <SidebarProvider defaultOpen={true}>
      <AdminSidebar />
      <SidebarInset>
        <header className="flex h-12 shrink-0 items-center gap-2 border-b px-4">
          <SidebarTrigger />
          <Separator orientation="vertical" className="h-4" />
          <span className="text-sm font-medium">Admin dashboard</span>
        </header>
        <div className="flex flex-1 flex-col gap-4 p-4 md:p-6">{children}</div>
      </SidebarInset>
    </SidebarProvider>
  )
}
