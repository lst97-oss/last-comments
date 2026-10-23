import { createFileRoute, Outlet } from '@tanstack/react-router'
import { DashboardShell } from '@/components/admin/dashboard-shell'

// Pathless layout for the admin pages. The sidebar mounts here once, so its
// state (open groups, collapsed rail) survives navigation between pages.
export const Route = createFileRoute('/_admin')({
  component: AdminLayout,
})

function AdminLayout() {
  return (
    <DashboardShell>
      <Outlet />
    </DashboardShell>
  )
}
