'use client'

import { useQuery } from '@tanstack/react-query'
import { createFileRoute, Link } from '@tanstack/react-router'
import { Blocks, KeyRound, Settings as SettingsIcon, ShieldCheck, Users } from 'lucide-react'
import { AdminQueryError } from '@/components/admin/admin-query-error'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from '@/components/ui/empty'
import { Separator } from '@/components/ui/separator'
import { Spinner } from '@/components/ui/spinner'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { describeApiError, readApiData } from '@/lib/api-response'
import { BusinessRouteError } from '@/lib/business-route-error'
import { type InstanceSettings } from '@/lib/site-users'

export const Route = createFileRoute('/_admin/settings')({
  component: SettingsPage,
  errorComponent: BusinessRouteError,
})

function SettingsPage() {
  const settingsQuery = useQuery({
    queryKey: ['admin-settings'],
    queryFn: async () => {
      const response = await fetch('/api/admin/settings')
      return readApiData<InstanceSettings>(response)
    },
    retry: false,
  })
  const settings = settingsQuery.data ?? null
  const failure = describeApiError(settingsQuery.error, 'Could not load settings')

  return (
    <>
      <main className="mx-auto flex w-full max-w-5xl flex-col gap-6 text-foreground">
        <header className="border-b border-border pb-5">
          <p className="text-sm text-muted-foreground">Last Comments</p>
          <h1 className="text-3xl font-semibold tracking-tight">Settings</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Plugin status and instance configuration. Values come from the environment — redeploy to change them.
          </p>
        </header>

        {settingsQuery.error ? (
          <AdminQueryError
            failure={failure}
            forbiddenTitle="Settings are restricted to administrators."
            onRetry={failure.forbidden ? undefined : () => void settingsQuery.refetch()}
          />
        ) : settingsQuery.isPending || !settings ? (
          <p aria-live="polite" className="flex items-center gap-2 text-sm text-muted-foreground">
            <Spinner data-icon="inline-start" />
            Loading settings…
          </p>
        ) : (
          <>
            <section aria-label="Comment plugins">
              <Card>
                <CardHeader>
                  <CardTitle>Comment plugins</CardTitle>
                  <CardDescription>
                    {settings.plugins.filter((plugin) => plugin.enabled).length} of {settings.plugins.length} enabled ·
                    validation and quota hooks for every comment operation.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {settings.plugins.length === 0 ? (
                    <Empty>
                      <EmptyHeader>
                        <EmptyMedia variant="icon">
                          <Blocks />
                        </EmptyMedia>
                        <EmptyTitle>No plugins installed</EmptyTitle>
                        <EmptyDescription>Plugins register in code — none are installed.</EmptyDescription>
                      </EmptyHeader>
                    </Empty>
                  ) : (
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Plugin</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead>Detail</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {settings.plugins.map((plugin) => (
                          <TableRow key={plugin.id}>
                            <TableCell>
                              <div className="flex flex-col">
                                <span className="font-medium">{plugin.id}</span>
                                <span className="text-xs text-muted-foreground">API v{plugin.apiVersion}</span>
                              </div>
                            </TableCell>
                            <TableCell>
                              {plugin.enabled ? (
                                <Badge variant="secondary">Enabled</Badge>
                              ) : (
                                <Badge variant="outline">Disabled</Badge>
                              )}
                            </TableCell>
                            <TableCell className="max-w-md text-xs text-muted-foreground">{plugin.detail}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  )}
                </CardContent>
              </Card>
            </section>

            <section aria-label="Authentication" className="grid gap-4 lg:grid-cols-2">
              <Card>
                <CardHeader>
                  <CardTitle>Sign-in providers</CardTitle>
                  <CardDescription>Which login paths this instance accepts (AUTH_PROVIDERS).</CardDescription>
                </CardHeader>
                <CardContent className="flex flex-col gap-3">
                  <div className="flex flex-wrap gap-2">
                    {settings.auth.providers.map((provider) => (
                      <Badge key={provider} variant="secondary">
                        {provider}
                      </Badge>
                    ))}
                  </div>
                  <Separator />
                  <dl className="flex flex-col gap-2 text-sm">
                    <div className="flex items-center justify-between gap-3">
                      <dt className="text-muted-foreground">Auto-provision external users</dt>
                      <dd>
                        {settings.auth.autoProvision ? (
                          <Badge variant="secondary">On</Badge>
                        ) : (
                          <Badge variant="outline">Off</Badge>
                        )}
                      </dd>
                    </div>
                    <div className="flex items-center justify-between gap-3">
                      <dt className="text-muted-foreground">Bootstrap email pinned</dt>
                      <dd>
                        {settings.auth.bootstrapEmailSet ? (
                          <Badge variant="secondary">Set</Badge>
                        ) : (
                          <Badge variant="outline">Not set</Badge>
                        )}
                      </dd>
                    </div>
                  </dl>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>External providers</CardTitle>
                  <CardDescription>Enterprise login wiring. Secrets are never shown here.</CardDescription>
                </CardHeader>
                <CardContent className="flex flex-col gap-3 text-sm">
                  <div className="flex items-center justify-between gap-3">
                    <span className="font-medium">OIDC JWT</span>
                    {settings.auth.oidc.configured ? (
                      <Badge variant="secondary">Configured</Badge>
                    ) : (
                      <Badge variant="outline">Not configured</Badge>
                    )}
                  </div>
                  <ul className="flex flex-col gap-1 text-xs text-muted-foreground">
                    <li>JWKS URL: {settings.auth.oidc.jwksUrlSet ? 'set' : 'missing'}</li>
                    <li>Issuer: {settings.auth.oidc.issuerSet ? 'set' : 'missing'}</li>
                    <li>Audience: {settings.auth.oidc.audienceSet ? 'set' : 'missing'}</li>
                  </ul>
                  <Separator />
                  <div className="flex items-center justify-between gap-3">
                    <span className="font-medium">Reverse-proxy SSO</span>
                    {settings.auth.header.trustProxy ? (
                      <Badge variant="secondary">Trusted</Badge>
                    ) : (
                      <Badge variant="outline">Off</Badge>
                    )}
                  </div>
                  {settings.auth.header.trustProxy && (
                    <ul className="flex flex-col gap-1 text-xs text-muted-foreground">
                      <li>
                        Proxy CIDR: <code>{settings.auth.header.cidr}</code>
                      </li>
                      <li>
                        Headers: <code>{settings.auth.header.userHeader}</code>,{' '}
                        <code>{settings.auth.header.emailHeader}</code>, <code>{settings.auth.header.nameHeader}</code>
                      </li>
                    </ul>
                  )}
                </CardContent>
              </Card>
            </section>

            <section aria-label="Comments and verification" className="grid gap-4 lg:grid-cols-2">
              <Card>
                <CardHeader>
                  <CardTitle>Comment verification</CardTitle>
                  <CardDescription>Turnstile checks every commenter.</CardDescription>
                </CardHeader>
                <CardContent className="flex flex-col gap-2 text-sm">
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-muted-foreground">Verification required</span>
                    {settings.comments.verificationRequired ? (
                      <Badge variant="secondary">Required</Badge>
                    ) : (
                      <Badge variant="outline">Bypassed</Badge>
                    )}
                  </div>
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-muted-foreground">Turnstile secret</span>
                    {settings.comments.turnstileSecretConfigured ? (
                      <Badge variant="secondary">Set</Badge>
                    ) : (
                      <Badge variant="outline">Missing</Badge>
                    )}
                  </div>
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-muted-foreground">Turnstile site key</span>
                    {settings.comments.turnstileSiteKeyConfigured ? (
                      <Badge variant="secondary">Set</Badge>
                    ) : (
                      <Badge variant="outline">Missing</Badge>
                    )}
                  </div>
                  {!settings.comments.verificationRequired && (
                    <p className="text-xs text-muted-foreground">
                      The bypass is for local development only — everyone posts without a token while it is off.
                    </p>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Rate limits</CardTitle>
                  <CardDescription>Per-operation quotas, keyed by user or IP.</CardDescription>
                </CardHeader>
                <CardContent className="flex flex-col gap-3">
                  <div className="flex items-center justify-between gap-3 text-sm">
                    <span className="text-muted-foreground">Quota store (HMAC secret)</span>
                    {settings.rateLimit.secretConfigured ? (
                      <Badge variant="secondary">Set</Badge>
                    ) : (
                      <Badge variant="outline">Missing</Badge>
                    )}
                  </div>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Operation</TableHead>
                        <TableHead className="text-right">Quota</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {settings.rateLimit.limits.map((limit) => (
                        <TableRow key={limit.operation}>
                          <TableCell className="text-xs">
                            <code>{limit.operation}</code>
                          </TableCell>
                          <TableCell className="text-right text-xs text-muted-foreground tabular-nums">
                            {limit.count} / {limit.windowSeconds}s
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                  <p className="text-xs text-muted-foreground">
                    Guest edit window:{' '}
                    {settings.comments.anonEditWindowMinutes === 0
                      ? 'unlimited'
                      : `${settings.comments.anonEditWindowMinutes} minutes`}
                    .
                  </p>
                </CardContent>
              </Card>
            </section>

            <section aria-label="Admin actions">
              <Card>
                <CardHeader>
                  <CardTitle>Admin actions</CardTitle>
                  <CardDescription>Things an admin can do from here. Secrets rotate outside this page.</CardDescription>
                </CardHeader>
                <CardContent className="flex flex-wrap gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    render={<Link to="/moderation" search={{ view: 'users' }} />}
                  >
                    <Users data-icon="inline-start" />
                    Manage users
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    render={<Link to="/moderation" search={{ view: 'pages' }} />}
                  >
                    <ShieldCheck data-icon="inline-start" />
                    Moderate threads
                  </Button>
                  <Button type="button" variant="outline" size="sm" render={<Link to="/api-keys" />}>
                    <KeyRound data-icon="inline-start" />
                    Manage API keys
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    render={<Link to="/moderation" search={{ view: 'sites' }} />}
                  >
                    <SettingsIcon data-icon="inline-start" />
                    Manage sites
                  </Button>
                </CardContent>
              </Card>
            </section>
          </>
        )}
      </main>
    </>
  )
}
