import { useQuery } from '@tanstack/react-query'
import { createFileRoute } from '@tanstack/react-router'
import { KeyRound } from 'lucide-react'
import { useState } from 'react'

import { AdminLoginForm } from '@/components/admin/admin-login'
import { AdminQueryError } from '@/components/admin/admin-query-error'
import { ConfirmDeleteDialog } from '@/components/admin/confirm-delete-dialog'
import { SiteKeyCreateDialog } from '@/components/admin/site-key-dialog'
import { SiteKeyRow } from '@/components/admin/site-key-row'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from '@/components/ui/empty'
import { ItemGroup } from '@/components/ui/item'
import { Spinner } from '@/components/ui/spinner'
import { useSiteKeys } from '@/hooks/use-site-keys'
import { ADMIN_SITES_QUERY_KEY, fetchAdminSites } from '@/lib/admin-sites'
import { describeApiError } from '@/lib/api-response'
import { BusinessRouteError } from '@/lib/business-route-error'
import { scopesEqual, scopesOfKey } from '@/lib/site-keys'

export const Route = createFileRoute('/_admin/api-keys')({
  component: ApiKeysPage,
  errorComponent: BusinessRouteError,
})

function ApiKeysPage() {
  const {
    keys,
    loading: keysLoading,
    error: keysError,
    clearError,
    drafts,
    toggleScope,
    saveScopes,
    toggleEnabled,
    deleteTarget,
    requestDelete,
    cancelDelete,
    confirmDelete,
    deleting,
    patching,
    refresh: refreshKeys,
  } = useSiteKeys()
  const [createOpen, setCreateOpen] = useState(false)

  const sitesQuery = useQuery({
    queryKey: ADMIN_SITES_QUERY_KEY,
    queryFn: fetchAdminSites,
    retry: false,
  })
  const sites = sitesQuery.data?.sites ?? []
  const isInstanceAdmin = sitesQuery.data?.isInstanceAdmin ?? false
  const failure = describeApiError(sitesQuery.error, 'Could not load sites')

  const loading = sitesQuery.isPending || keysLoading
  const errorMessage = keysError || (sitesQuery.error ? failure.message : '')

  function openCreate() {
    clearError()
    setCreateOpen(true)
  }

  const manageableSites = sites.filter((site) => isInstanceAdmin || site.role === 'admin')
  const adminKeys = keys.filter((key) => !key.metadata?.siteKey)
  const siteKeys = keys.filter((key) => key.metadata?.siteKey)

  return (
    <>
      <main className="mx-auto grid w-full max-w-3xl gap-6 text-foreground">
        <header className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="text-sm text-muted-foreground">Last Comments</p>
            <h1 className="mt-1 text-3xl font-semibold tracking-tight">API keys</h1>
            <p className="mt-2 text-sm text-muted-foreground">
              Server-to-server keys with least-privilege permissions. Secrets are shown once at creation.
            </p>
          </div>
          <Button type="button" onClick={openCreate} disabled={loading || failure.needsSignIn}>
            Create key
          </Button>
        </header>

        {loading ? (
          <p aria-live="polite" className="flex items-center gap-2 text-sm text-muted-foreground">
            <Spinner data-icon="inline-start" />
            Loading API keys…
          </p>
        ) : failure.needsSignIn ? (
          <AdminLoginForm onSignedIn={() => void sitesQuery.refetch()} />
        ) : (
          <>
            {errorMessage && <AdminQueryError body={errorMessage} />}
            <Card>
              <CardHeader>
                <CardTitle>Site keys</CardTitle>
                <CardDescription>
                  {siteKeys.length === 0
                    ? 'No site keys yet.'
                    : `${siteKeys.length} ${siteKeys.length === 1 ? 'key' : 'keys'}, each bound to one site.`}
                </CardDescription>
              </CardHeader>
              <CardContent>
                {siteKeys.length === 0 ? (
                  <Empty>
                    <EmptyHeader>
                      <EmptyMedia variant="icon">
                        <KeyRound />
                      </EmptyMedia>
                      <EmptyTitle>No site keys yet</EmptyTitle>
                      <EmptyDescription>
                        Create your first site key — pick a site, choose permissions, copy the secret.
                      </EmptyDescription>
                    </EmptyHeader>
                  </Empty>
                ) : (
                  <ItemGroup>
                    {siteKeys.map((key) => {
                      const current = scopesOfKey(key)
                      const draft = drafts[key.id] ?? current
                      return (
                        <SiteKeyRow
                          key={key.id}
                          apiKey={key}
                          draft={draft}
                          canSave={!scopesEqual(draft, current)}
                          idPrefix={`key-${key.id}`}
                          pending={patching}
                          onToggleScope={(scope) => toggleScope(key, scope)}
                          onSave={() => saveScopes(key)}
                          onToggleEnabled={() => toggleEnabled(key)}
                          onRequestDelete={() => requestDelete(key)}
                        />
                      )
                    })}
                  </ItemGroup>
                )}
              </CardContent>
            </Card>

            {adminKeys.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle>Admin keys</CardTitle>
                  <CardDescription>Unbound keys that manage sites themselves.</CardDescription>
                </CardHeader>
                <CardContent>
                  <ItemGroup>
                    {adminKeys.map((key) => (
                      <SiteKeyRow
                        key={key.id}
                        apiKey={key}
                        draft={scopesOfKey(key)}
                        canSave={false}
                        showScopes={false}
                        idPrefix={`key-${key.id}`}
                        pending={patching}
                        onToggleEnabled={() => toggleEnabled(key)}
                        onRequestDelete={() => requestDelete(key)}
                      />
                    ))}
                  </ItemGroup>
                </CardContent>
              </Card>
            )}
          </>
        )}
      </main>

      <SiteKeyCreateDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        sites={manageableSites}
        onCreated={() => void refreshKeys()}
      />

      <ConfirmDeleteDialog
        open={deleteTarget !== null}
        title={`Delete ${deleteTarget?.name ?? deleteTarget?.id}?`}
        description="Any embed using this key stops working immediately. This cannot be undone."
        confirmLabel="Delete key"
        pendingLabel="Deleting…"
        pending={deleting}
        onOpenChange={(open) => !open && cancelDelete()}
        onConfirm={() => void confirmDelete()}
      />
    </>
  )
}
