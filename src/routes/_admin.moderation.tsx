import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { createFileRoute, redirect } from '@tanstack/react-router'
import { useState } from 'react'
import { AdminQueryError } from '@/components/admin/admin-query-error'
import { PagesView } from '@/components/admin/pages-view'
import { RecentView, TAKEDOWN_PAGE_SIZE } from '@/components/admin/recent-view'
import { SiteKeyCreateDialog } from '@/components/admin/site-key-dialog'
import { SitesView } from '@/components/admin/sites-view'
import { UsersView } from '@/components/admin/users-view'
import { Button } from '@/components/ui/button'
import { Card, CardAction, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Field, FieldLabel } from '@/components/ui/field'
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Spinner } from '@/components/ui/spinner'
import { toast } from '@/components/ui/toast'
import { asModerationView, type ModerationView } from '@/lib/admin-format'
import { ADMIN_SITES_QUERY_KEY, fetchAdminSites } from '@/lib/admin-sites'
import { describeApiError, readApiData } from '@/lib/api-response'
import { BusinessRouteError } from '@/lib/business-route-error'
import { type PageSummary, type TakedownPage } from '@/lib/page-thread'
import { setupStatusServerFn } from '@/lib/setup-status'
import { type Site } from '@/lib/site-keys'
import { type EditSiteValues, type SiteForm } from '@/lib/site-schema'

export const Route = createFileRoute('/_admin/moderation')({
  validateSearch: (search: Record<string, unknown>) => ({
    view: asModerationView(search.view),
  }),
  beforeLoad: async () => {
    const { setupAvailable } = await setupStatusServerFn()
    if (setupAvailable) throw redirect({ to: '/create-admin-user' })
  },
  component: ModerationPage,
  errorComponent: BusinessRouteError,
})

function ModerationPage() {
  // The React Compiler compiles this component (annotation mode, client bundle).
  'use memo'
  const { view } = Route.useSearch()
  const navigate = Route.useNavigate()
  const queryClient = useQueryClient()
  const [siteOverride, setSiteOverride] = useState<string | null>(null)
  const [recentDays, setRecentDays] = useState(7)
  const [takedownPage, setTakedownPage] = useState(0)
  const [createOpen, setCreateOpen] = useState(false)
  const [keyPrompt, setKeyPrompt] = useState<{ key: string; name: string } | null>(null)

  const sitesQuery = useQuery({
    queryKey: ADMIN_SITES_QUERY_KEY,
    queryFn: fetchAdminSites,
    retry: false,
  })
  const allSitesQuery = useQuery({
    queryKey: ['admin-all-sites'],
    queryFn: async () => {
      const response = await fetch('/api/admin/sites')
      const data = await readApiData<{ sites: Site[] }>(response)
      return data.sites
    },
    retry: false,
  })
  const sites = sitesQuery.data?.sites ?? []
  const allSites = allSitesQuery.data ?? []

  const site =
    siteOverride !== null && sites.some((item) => item.key === siteOverride) ? siteOverride : (sites[0]?.key ?? '')

  const pagesQuery = useQuery({
    queryKey: ['admin-pages', site, recentDays],
    queryFn: async () => {
      const response = await fetch(
        `/api/admin/pages?site=${encodeURIComponent(site)}&recentDays=${recentDays}&preview=3`,
      )
      const data = await readApiData<{ pages: PageSummary[] }>(response)
      return data.pages
    },
    enabled: site !== '',
    retry: false,
  })
  const pages = pagesQuery.data ?? []

  // Hidden and deleted comments, one page at a time. Only the Recent tab shows
  // them, so the query waits for that view.
  const takedownsQuery = useQuery({
    queryKey: ['admin-takedowns', site, recentDays, takedownPage],
    queryFn: async () => {
      const response = await fetch(
        `/api/admin/takedowns?site=${encodeURIComponent(site)}&recentDays=${recentDays}&limit=${TAKEDOWN_PAGE_SIZE}&offset=${takedownPage * TAKEDOWN_PAGE_SIZE}`,
      )
      return readApiData<TakedownPage>(response)
    },
    enabled: site !== '' && view === 'recent',
    retry: false,
  })

  const queryError = sitesQuery.error ?? allSitesQuery.error ?? pagesQuery.error
  const failure = describeApiError(queryError, 'Could not load moderation data')

  // Site mutations report through toasts: the page-level banner sits behind
  // the open dialog, so inline errors would be invisible.
  function reportFailure(title: string, cause: unknown) {
    toast.add({
      title,
      description: cause instanceof Error ? cause.message : 'Please try again.',
      type: 'error',
    })
  }

  const createSiteMutation = useMutation({
    mutationFn: async (values: SiteForm) => {
      const response = await fetch('/api/admin/sites', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(values),
      })
      const result = await readApiData<{ site: Site }>(response)
      return result.site
    },
    onSuccess: async (created) => {
      setCreateOpen(false)
      setSiteOverride(created.key)
      setKeyPrompt(created)
      await Promise.all([sitesQuery.refetch(), allSitesQuery.refetch()])
      toast.add({
        title: 'Site created',
        description: `${created.name} · key ${created.key}`,
        type: 'success',
      })
    },
    onError: (cause) => reportFailure('Could not create site', cause),
  })

  const editSiteMutation = useMutation({
    mutationFn: async ({ siteKey, ...values }: { siteKey: string } & EditSiteValues) => {
      const response = await fetch(`/api/admin/sites/${encodeURIComponent(siteKey)}`, {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(values),
      })
      const result = await readApiData<{ site: Site }>(response)
      return result.site
    },
    onSuccess: async (updated) => {
      await Promise.all([sitesQuery.refetch(), allSitesQuery.refetch()])
      toast.add({ title: 'Site updated', description: updated.name, type: 'success' })
    },
    onError: (cause) => reportFailure('Could not update site', cause),
  })

  const deletePageMutation = useMutation({
    mutationFn: async (page: PageSummary) => {
      const response = await fetch(`/api/admin/pages/${encodeURIComponent(page.id)}?site=${encodeURIComponent(site)}`, {
        method: 'DELETE',
      })
      return readApiData<{ deleted: boolean; comments: number; replies: number; votes: number }>(response)
    },
    onSuccess: async (result, page) => {
      await pagesQuery.refetch()
      toast.add({
        title: 'Page deleted',
        description: `${page.canonicalUrl} · ${result.comments} comments removed`,
        type: 'success',
      })
    },
    onError: (cause) => reportFailure('Could not delete page', cause),
  })

  const deleteSiteMutation = useMutation({
    mutationFn: async (siteKey: string) => {
      const response = await fetch(`/api/admin/sites/${encodeURIComponent(siteKey)}`, { method: 'DELETE' })
      await readApiData<{ deleted: boolean }>(response)
      return siteKey
    },
    onSuccess: async (siteKey) => {
      if (siteKey === site) setSiteOverride(null)
      await Promise.all([sitesQuery.refetch(), allSitesQuery.refetch()])
      toast.add({ title: 'Site deleted', description: siteKey, type: 'success' })
    },
    onError: (cause) => reportFailure('Could not delete site', cause),
  })

  const actMutation = useMutation({
    mutationFn: async (action: Record<string, string | boolean>) => {
      const response = await fetch('/api/moderation', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ site, ...action }),
      })
      await readApiData<Record<string, unknown>>(response)
    },
    onSuccess: async () => {
      await Promise.all([pagesQuery.refetch(), queryClient.invalidateQueries({ queryKey: ['admin-takedowns'] })])
    },
    onError: (cause) => reportFailure('Moderation action failed', cause),
  })

  function switchSite(next: string) {
    setSiteOverride(next)
    setTakedownPage(0)
  }

  return (
    <>
      <main className="mx-auto flex w-full max-w-5xl flex-col gap-6 text-foreground">
        <header className="flex flex-wrap items-end justify-between gap-4 border-b border-border pb-5">
          <div>
            <p className="text-sm text-muted-foreground">Last Comments</p>
            <h1 className="text-3xl font-semibold tracking-tight">Moderation</h1>
          </div>
          {sites.length > 0 && (
            <Field orientation="horizontal">
              <FieldLabel htmlFor="moderation-site" className="text-muted-foreground">
                Site
              </FieldLabel>
              <Select value={site || null} onValueChange={(value) => value && switchSite(value)}>
                <SelectTrigger id="moderation-site" className="min-w-48">
                  <SelectValue placeholder="Select a site" />
                </SelectTrigger>
                <SelectContent>
                  <SelectGroup>
                    {sites.map((item) => (
                      <SelectItem key={item.id} value={item.key}>
                        {item.name}
                      </SelectItem>
                    ))}
                  </SelectGroup>
                </SelectContent>
              </Select>
            </Field>
          )}
        </header>

        <SiteKeyCreateDialog
          key={keyPrompt?.key ?? 'pending'}
          open={keyPrompt !== null}
          onOpenChange={(open) => !open && setKeyPrompt(null)}
          fixedSite={keyPrompt ?? undefined}
          onCreated={() => void pagesQuery.refetch()}
        />

        {queryError ? (
          <AdminQueryError
            failure={failure}
            forbiddenTitle="Moderation is restricted to administrators."
            onRetry={
              failure.forbidden
                ? undefined
                : () => {
                    // Retry whichever request failed, not just the site list.
                    if (sitesQuery.error) void sitesQuery.refetch()
                    if (allSitesQuery.error) void allSitesQuery.refetch()
                    if (pagesQuery.error) void pagesQuery.refetch()
                  }
            }
            onSignedIn={() => void sitesQuery.refetch()}
          />
        ) : sitesQuery.isPending ? (
          <p aria-live="polite" className="flex items-center gap-2 text-sm text-muted-foreground">
            <Spinner data-icon="inline-start" />
            Loading comments…
          </p>
        ) : (
          <ViewContent
            view={view}
            sites={sites}
            allSites={allSites}
            site={site}
            pages={pages}
            recentDays={recentDays}
            onRecentDays={(days) => {
              setRecentDays(days)
              setTakedownPage(0)
            }}
            takedowns={takedownsQuery.data}
            takedownPage={takedownPage}
            takedownsFailed={takedownsQuery.isError}
            onTakedownPage={setTakedownPage}
            createOpen={createOpen}
            onCreateOpen={setCreateOpen}
            onCreateSite={(values) =>
              createSiteMutation.mutateAsync(values).then(
                () => true,
                () => false,
              )
            }
            onEditSite={(siteKey, values) =>
              editSiteMutation.mutateAsync({ siteKey, ...values }).then(
                () => true,
                () => false,
              )
            }
            onDeleteSite={(siteKey) =>
              deleteSiteMutation.mutateAsync(siteKey).then(
                () => true,
                () => false,
              )
            }
            onRefreshPages={() => void pagesQuery.refetch()}
            onAct={(action) => actMutation.mutateAsync(action).catch(() => undefined)}
            onDeletePage={(page) =>
              deletePageMutation.mutateAsync(page).then(
                () => true,
                () => false,
              )
            }
            onNavigateView={(next) => void navigate({ to: '/moderation', search: { view: next } })}
          />
        )}
      </main>
    </>
  )
}

type ViewContentProps = {
  view: ModerationView
  sites: Site[]
  allSites: Site[]
  site: string
  pages: PageSummary[]
  recentDays: number
  onRecentDays: (days: number) => void
  takedowns: TakedownPage | undefined
  takedownPage: number
  takedownsFailed: boolean
  onTakedownPage: (page: number) => void
  createOpen: boolean
  onCreateOpen: (open: boolean) => void
  onCreateSite: (values: SiteForm) => Promise<boolean>
  onEditSite: (siteKey: string, values: EditSiteValues) => Promise<boolean>
  onDeletePage: (page: PageSummary) => Promise<boolean>
  onDeleteSite: (siteKey: string) => Promise<boolean>
  onRefreshPages: () => void
  onAct: (action: Record<string, string | boolean>) => Promise<void>
  onNavigateView: (view: ModerationView) => void
}

function ViewContent(props: ViewContentProps) {
  const { view, sites, site } = props
  if (sites.length === 0 && view !== 'sites') {
    return (
      <Card>
        <CardHeader>
          <CardTitle>No sites yet</CardTitle>
          <CardDescription>Create your first site to start moderating comments.</CardDescription>
          <CardAction>
            <Button onClick={() => void props.onNavigateView('sites')}>Go to Sites</Button>
          </CardAction>
        </CardHeader>
      </Card>
    )
  }
  return (
    <>
      {view === 'sites' ? (
        <SitesView {...props} />
      ) : view === 'recent' ? (
        <RecentView {...props} />
      ) : view === 'users' ? (
        // Keyed by site: switching sites resets the search, the filter and
        // the page cursors instead of carrying them over to the new site.
        <UsersView key={site} site={site} />
      ) : (
        // Keyed by site: switching sites resets the search box and the page
        // cursor instead of carrying them over to the new site's rows.
        <PagesView key={site} {...props} />
      )}
    </>
  )
}
