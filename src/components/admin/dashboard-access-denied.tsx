'use client'

import { useMutation } from '@tanstack/react-query'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { signOut } from '@/lib/business-auth-client'

// Shown to a signed-in account that may comment but may not use the dashboard: a member, or an
// account with no site role. The server decides this (`dashboard` from /api/session); this screen only
// explains it.
export function DashboardAccessDenied() {
  const signOutMutation = useMutation({ mutationFn: signOut })

  return (
    <div className="grid min-h-svh place-items-center bg-background p-4">
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle>Admins only</CardTitle>
          <CardDescription>
            The dashboard is for site admins and the instance admin. Members can comment on a site, but they cannot
            manage it. Ask an admin of the site if you need access.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button
            type="button"
            variant="outline"
            disabled={signOutMutation.isPending}
            onClick={() => signOutMutation.mutate()}
          >
            Sign out
          </Button>
        </CardContent>
      </Card>
    </div>
  )
}
