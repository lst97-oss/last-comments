import { useQuery } from '@tanstack/react-query'
import { createFileRoute } from '@tanstack/react-router'
import { KeyRound } from 'lucide-react'
import { useState } from 'react'

import { AdminLoginForm } from '@/components/admin/admin-login'
import { AdminQueryError } from '@/components/admin/admin-query-error'
import { AdminTourButton } from '@/components/admin/admin-tour-button'
import { API_KEYS_TOUR } from '@/components/admin/admin-tours'
import { ApiKeyCreateDialog } from '@/components/admin/api-key-dialog'
import { ApiKeyRow } from '@/components/admin/api-key-row'
import { ConfirmDeleteDialog } from '@/components/admin/confirm-delete-dialog'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from '@/components/ui/empty'
import { ItemGroup } from '@/components/ui/item'
import { Spinner } from '@/components/ui/spinner'
import { useApiKeys } from '@/hooks/use-api-keys'
import { ADMIN_SITES_QUERY_KEY, fetchAdminSites } from '@/lib/admin-sites'
import { scopesEqual, scopesOfKey } from '@/lib/api-keys'
import { describeApiError } from '@/lib/api-response'
import { BusinessRouteError } from '@/lib/business-route-error'

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
    setDraftScopes,
    saveScopes,
    toggleEnabled,
    deleteTarget,
    requestDelete,
    cancelDelete,
    confirmDelete,
    deleting,
    patching,
    refresh: refreshKeys,
  } = useApiKeys()
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
  const instanceKeys = keys.filter((key) => !key.metadata?.site)
  const siteApiKeys = keys.filter((key) => key.metadata?.site)

  return (
    <>
      <main className="mx-auto grid w-full max-w-3xl gap-6 text-foreground">
        <header data-tour="api-keys-intro" className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="text-sm text-muted-foreground">Last Comments</p>
            <h1 className="mt-1 text-3xl font-semibold tracking-tight">API keys</h1>
            <p className="mt-2 text-sm text-muted-foreground">
              Server-to-server keys with least-privilege permissions. Secrets are shown once at creation.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <AdminTourButton tour={API_KEYS_TOUR} />
            <Button
              type="button"
              data-tour="api-keys-create"
              onClick={openCreate}
              disabled={loading || failure.needsSignIn}
            >
              Create API key
            </Button>
          </div>
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
            <Card data-tour="api-keys-list">
              <CardHeader>
                <CardTitle>API keys</CardTitle>
                <CardDescription>
                  {siteApiKeys.length === 0
                    ? 'No API keys yet.'
                    : `${siteApiKeys.length} ${siteApiKeys.length === 1 ? 'API key' : 'API keys'}, each bound to one site.`}
                </CardDescription>
              </CardHeader>
              <CardContent>
                {siteApiKeys.length === 0 ? (
                  <Empty>
                    <EmptyHeader>
                      <EmptyMedia variant="icon">
                        <KeyRound />
                      </EmptyMedia>
                      <EmptyTitle>No API keys yet</EmptyTitle>
                      <EmptyDescription>
                        Create your first API key: pick a site, choose what it needs, then copy the secret.
                      </EmptyDescription>
                    </EmptyHeader>
                  </Empty>
                ) : (
                  <ItemGroup>
                    {siteApiKeys.map((key) => {
                      const current = scopesOfKey(key)
                      const draft = drafts[key.id] ?? current
                      return (
                        <ApiKeyRow
                          key={key.id}
                          apiKey={key}
                          site={sites.find((item) => item.key === key.metadata?.site)}
                          draft={draft}
                          canSave={!scopesEqual(draft, current)}
                          idPrefix={`key-${key.id}`}
                          pending={patching}
                          onChangeScopes={(scopes) => setDraftScopes(key, scopes)}
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

            {instanceKeys.length > 0 && (
              <Card data-tour="api-keys-instance">
                <CardHeader>
                  <CardTitle>Instance API keys</CardTitle>
                  <CardDescription>Not bound to a site. These keys create and manage sites.</CardDescription>
                </CardHeader>
                <CardContent>
                  <ItemGroup>
                    {instanceKeys.map((key) => (
                      <ApiKeyRow
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

      <ApiKeyCreateDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        sites={manageableSites}
        onCreated={() => void refreshKeys()}
      />

      <ConfirmDeleteDialog
        open={deleteTarget !== null}
        title={`Delete ${deleteTarget?.name ?? deleteTarget?.id}?`}
        description="Anything using this key, such as your server or proxy, stops working immediately. This cannot be undone."
        confirmLabel="Delete API key"
        pendingLabel="Deleting…"
        pending={deleting}
        onOpenChange={(open) => !open && cancelDelete()}
        onConfirm={() => void confirmDelete()}
      />
    </>
  )
}
