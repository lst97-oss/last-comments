'use client'

import { useQuery } from '@tanstack/react-query'
import { createFileRoute, Link } from '@tanstack/react-router'
import {
  Blocks,
  CircleCheck,
  CircleDashed,
  CircleSlash,
  KeyRound,
  Network,
  Settings as SettingsIcon,
  ShieldAlert,
  ShieldCheck,
  Timer,
  TriangleAlert,
  Infinity as UnlimitedIcon,
  UserPlus,
  Users,
  UserX,
} from 'lucide-react'
import { AdminQueryError } from '@/components/admin/admin-query-error'
import { SettingRow, SettingState, type SettingView } from '@/components/admin/setting-state'
import { setTourHidden, useTourHidden } from '@/components/admin/tour-preference'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Checkbox } from '@/components/ui/checkbox'
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from '@/components/ui/empty'
import { Field, FieldContent, FieldDescription, FieldLabel } from '@/components/ui/field'
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

// What each instance setting shows: the state word and icon say what is set, the meaning says what it does.
const VIEWS = {
  autoProvisionOn: {
    tone: 'info',
    icon: UserPlus,
    state: 'On',
    meaning: 'A first external sign-in creates an account.',
  },
  autoProvisionOff: {
    tone: 'neutral',
    icon: UserX,
    state: 'Off',
    meaning: 'Only existing accounts can sign in. Unknown external sign-ins are refused.',
  },
  bootstrapSet: {
    tone: 'success',
    icon: ShieldCheck,
    state: 'Set',
    meaning: 'Only AUTH_BOOTSTRAP_EMAIL can claim the first admin slot.',
  },
  bootstrapUnset: {
    tone: 'neutral',
    icon: CircleDashed,
    state: 'Not set',
    meaning: 'On a new instance, the first external sign-in claims the admin slot.',
  },
  oidcConfigured: {
    tone: 'success',
    icon: KeyRound,
    state: 'Configured',
    meaning: 'Tokens from the configured issuer are accepted.',
  },
  oidcMissing: {
    tone: 'neutral',
    icon: CircleDashed,
    state: 'Not configured',
    meaning: 'OIDC tokens are refused until the JWKS URL, issuer and audience are all set.',
  },
  proxyTrusted: {
    tone: 'info',
    icon: Network,
    state: 'Trusted',
    meaning: 'Identity headers are read only from the proxy CIDR below.',
  },
  proxyOff: {
    tone: 'neutral',
    icon: CircleSlash,
    state: 'Off',
    meaning: 'Proxy identity headers are ignored.',
  },
  verificationRequired: {
    tone: 'success',
    icon: ShieldCheck,
    state: 'Required',
    meaning: 'Every commenter passes Turnstile, signed in or not.',
  },
  verificationBypassed: {
    tone: 'warning',
    icon: ShieldAlert,
    state: 'Bypassed',
    meaning: 'Posts go through without a token. Local development only.',
  },
} satisfies Record<string, SettingView>

// A key or secret is a problem only while the check it feeds is required: then a missing value fails closed.
function secretView(
  set: boolean,
  required: boolean,
  copy: { set: string; missing: string; notRequired?: string },
): SettingView {
  if (set) return { tone: 'success', icon: CircleCheck, state: 'Set', meaning: copy.set }
  if (required) return { tone: 'warning', icon: TriangleAlert, state: 'Missing', meaning: copy.missing }
  return { tone: 'neutral', icon: CircleDashed, state: 'Missing', meaning: copy.notRequired ?? copy.missing }
}

function editWindowView(minutes: number): SettingView {
  if (minutes === 0) {
    return { tone: 'warning', icon: UnlimitedIcon, state: 'Unlimited', meaning: 'Guest edit keys never expire.' }
  }
  return {
    tone: 'success',
    icon: Timer,
    state: `${minutes} min`,
    meaning: `Guest edit keys work for ${minutes} minutes after posting.`,
  }
}

function SettingsPage() {
  const hideTour = useTourHidden()
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
                                <SettingState tone="success" icon={CircleCheck}>
                                  Enabled
                                </SettingState>
                              ) : (
                                <SettingState tone="neutral" icon={CircleSlash}>
                                  Disabled
                                </SettingState>
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
                  <dl className="flex flex-col gap-3 text-sm">
                    <SettingRow
                      label="Auto-provision external users"
                      view={settings.auth.autoProvision ? VIEWS.autoProvisionOn : VIEWS.autoProvisionOff}
                    />
                    <SettingRow
                      label="Bootstrap email pinned"
                      view={settings.auth.bootstrapEmailSet ? VIEWS.bootstrapSet : VIEWS.bootstrapUnset}
                    />
                  </dl>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>External providers</CardTitle>
                  <CardDescription>Enterprise login wiring. Secrets are never shown here.</CardDescription>
                </CardHeader>
                <CardContent className="flex flex-col gap-3 text-sm">
                  <dl>
                    <SettingRow
                      label="OIDC JWT"
                      view={settings.auth.oidc.configured ? VIEWS.oidcConfigured : VIEWS.oidcMissing}
                    />
                  </dl>
                  <ul className="flex flex-col gap-1 text-xs text-muted-foreground">
                    <li>JWKS URL: {settings.auth.oidc.jwksUrlSet ? 'set' : 'missing'}</li>
                    <li>Issuer: {settings.auth.oidc.issuerSet ? 'set' : 'missing'}</li>
                    <li>Audience: {settings.auth.oidc.audienceSet ? 'set' : 'missing'}</li>
                  </ul>
                  <Separator />
                  <dl>
                    <SettingRow
                      label="Reverse-proxy SSO"
                      view={settings.auth.header.trustProxy ? VIEWS.proxyTrusted : VIEWS.proxyOff}
                    />
                  </dl>
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
                <CardContent>
                  <dl className="flex flex-col gap-3 text-sm">
                    <SettingRow
                      label="Verification required"
                      view={
                        settings.comments.verificationRequired ? VIEWS.verificationRequired : VIEWS.verificationBypassed
                      }
                    />
                    <SettingRow
                      label="Turnstile secret"
                      view={secretView(
                        settings.comments.turnstileSecretConfigured,
                        settings.comments.verificationRequired,
                        {
                          set: 'Tokens are checked with Cloudflare Siteverify.',
                          missing: 'Posts fail closed until TURNSTILE_SECRET_KEY is set.',
                          notRequired: 'Not needed while verification is bypassed.',
                        },
                      )}
                    />
                    <SettingRow
                      label="Turnstile site key"
                      view={secretView(
                        settings.comments.turnstileSiteKeyConfigured,
                        settings.comments.verificationRequired,
                        {
                          set: 'The widget can show the challenge.',
                          missing: 'Widgets cannot show the challenge until TURNSTILE_SITE_KEY is set.',
                          notRequired: 'Not needed while verification is bypassed.',
                        },
                      )}
                    />
                  </dl>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Rate limits</CardTitle>
                  <CardDescription>Per-operation quotas, keyed by user or IP.</CardDescription>
                </CardHeader>
                <CardContent className="flex flex-col gap-3">
                  <dl className="text-sm">
                    <SettingRow
                      label="Quota store (HMAC secret)"
                      view={secretView(settings.rateLimit.secretConfigured, true, {
                        set: 'Quotas are enforced per operation and identity.',
                        missing: 'Comment operations fail closed until BETTER_AUTH_SECRET is set.',
                      })}
                    />
                  </dl>
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
                  <dl className="text-sm">
                    <SettingRow
                      label="Guest edit window"
                      view={editWindowView(settings.comments.anonEditWindowMinutes)}
                    />
                  </dl>
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

            <section aria-label="This browser">
              <Card>
                <CardHeader>
                  <CardTitle>This browser</CardTitle>
                  <CardDescription>Stored in this browser only. Other browsers keep their own choice.</CardDescription>
                </CardHeader>
                <CardContent>
                  <Field orientation="horizontal">
                    <Checkbox
                      id="hide-tour-button"
                      checked={hideTour}
                      onCheckedChange={(checked) => setTourHidden(checked === true)}
                    />
                    <FieldContent>
                      <FieldLabel htmlFor="hide-tour-button">Hide the Take a tour button</FieldLabel>
                      <FieldDescription>
                        Removes the guided tour button from Moderation and API keys in this browser. Clear this box to
                        bring it back.
                      </FieldDescription>
                    </FieldContent>
                  </Field>
                </CardContent>
              </Card>
            </section>
          </>
        )}
      </main>
    </>
  )
}
