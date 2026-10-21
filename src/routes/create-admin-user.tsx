import { useForm } from '@tanstack/react-form'
import { useMutation } from '@tanstack/react-query'
import { createFileRoute, redirect, useNavigate } from '@tanstack/react-router'
import { useState } from 'react'
import { z } from 'zod'

import { AccountTextField } from '@/components/admin/account-field'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { FieldGroup } from '@/components/ui/field'
import { Spinner } from '@/components/ui/spinner'
import { ApiRequestError, readApiData } from '@/lib/api-response'
import { BusinessRouteError } from '@/lib/business-route-error'
import { setupStatusServerFn } from '@/lib/setup-status'
import { initialAdminSchema } from '@/lib/site-schema'

export const Route = createFileRoute('/create-admin-user')({
  // Setup must stay reachable without a session, so this page skips
  // DashboardShell (which would render the sign-in form for anonymous users)
  // and bounces to the dashboard once the first admin exists.
  beforeLoad: async () => {
    const { setupAvailable } = await setupStatusServerFn()
    if (!setupAvailable) throw redirect({ to: '/moderation', search: { view: 'pages' } })
  },
  component: CreateAdminUserPage,
  errorComponent: BusinessRouteError,
})

// The confirm field is client-only; name/email/password reuse the server schema
// so the copy and the rules cannot drift.
const adminFormSchema = initialAdminSchema
  .extend({ confirmPassword: z.string().min(1, 'Retype your password') })
  .refine((data) => data.password === data.confirmPassword, {
    message: 'Passwords do not match',
    path: ['confirmPassword'],
  })

type AdminForm = z.infer<typeof adminFormSchema>

function CreateAdminUserPage() {
  const navigate = useNavigate()
  // The message and its request reference always travel together.
  const [failure, setFailure] = useState<{ message: string; requestId: string } | null>(null)

  const createMutation = useMutation({
    mutationFn: async (value: AdminForm) => {
      await readApiData(
        await fetch('/api/initial-admin', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ name: value.name, email: value.email, password: value.password }),
        }),
      )
    },
    onSuccess: async () => {
      await navigate({ to: '/moderation', search: { view: 'pages' } })
    },
    onError: (cause) => {
      setFailure({
        message: cause instanceof Error ? cause.message : 'Could not create the admin account',
        requestId: cause instanceof ApiRequestError && cause.status >= 500 ? (cause.requestId ?? '') : '',
      })
    },
  })

  const form = useForm({
    defaultValues: { name: '', email: '', password: '', confirmPassword: '' } as AdminForm,
    validators: { onChange: adminFormSchema },
    onSubmit: async ({ value }) => {
      setFailure(null)
      await createMutation.mutateAsync(value).catch(() => undefined)
    },
  })

  return (
    <main className="mx-auto grid min-h-svh w-full max-w-lg content-center gap-6 p-4 text-foreground">
      <header>
        <p className="text-sm text-muted-foreground">Last Comments</p>
        <h1 className="mt-1 text-3xl font-semibold tracking-tight">Create admin account</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          The first account can manage this instance and create comment sites.
        </p>
      </header>

      <Card>
        <CardHeader>
          <CardTitle>Account</CardTitle>
          <CardDescription>Email and password sign-in for this instance.</CardDescription>
        </CardHeader>
        <CardContent>
          <form
            onSubmit={(event) => {
              event.preventDefault()
              void form.handleSubmit()
            }}
          >
            <FieldGroup>
              <AccountTextField
                form={form}
                name="name"
                id="admin-name"
                label="Name"
                autoComplete="name"
                maxLength={120}
              />
              <AccountTextField
                form={form}
                name="email"
                id="admin-email"
                label="Email"
                type="email"
                autoComplete="email"
                maxLength={255}
              />
              <AccountTextField
                form={form}
                name="password"
                id="admin-password"
                label="Password"
                type="password"
                autoComplete="new-password"
                minLength={12}
                maxLength={128}
                description="Use at least 12 characters."
              />
              <AccountTextField
                form={form}
                name="confirmPassword"
                id="admin-confirm-password"
                label="Retype password"
                type="password"
                autoComplete="new-password"
                minLength={12}
                maxLength={128}
                validators={{ onChangeListenTo: ['password'] }}
              />
            </FieldGroup>
            {failure && (
              <Alert variant="destructive" className="mt-4">
                <AlertDescription>
                  {failure.message}
                  {failure.requestId && <span className="mt-1 block text-xs">Reference: {failure.requestId}</span>}
                </AlertDescription>
              </Alert>
            )}
            <form.Subscribe
              selector={(state) => [state.canSubmit, state.isSubmitting]}
              children={([canSubmit, isSubmitting]) => (
                <Button type="submit" disabled={!canSubmit || isSubmitting} className="mt-4">
                  {isSubmitting && <Spinner data-icon="inline-start" />}
                  {isSubmitting ? 'Creating account…' : 'Create admin account'}
                </Button>
              )}
            />
          </form>
        </CardContent>
      </Card>
    </main>
  )
}
