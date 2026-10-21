'use client'

import { useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'

import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Field, FieldGroup, FieldLabel } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { Spinner } from '@/components/ui/spinner'
import { authClient, useAuthProviders } from '@/lib/business-auth-client'

export function AdminLoginForm({ onSignedIn }: { onSignedIn?: () => void }) {
  const providers = useAuthProviders()
  // While the provider list loads, keep the previous behavior (built-in
  // form) to avoid flashing the SSO notice on standard deploys.
  if (providers && !providers.includes('better-auth')) return <ExternalLoginNotice providers={providers} />
  return <PasswordLoginForm onSignedIn={onSignedIn} />
}

function ExternalLoginNotice({ providers }: { providers: string[] }) {
  return (
    <div className="grid max-w-sm gap-3">
      <p className="text-sm text-muted-foreground">
        Built-in sign-in is disabled on this instance (AUTH_PROVIDERS={providers.join(', ') || 'none'}). Sign in through
        your organization&apos;s identity provider instead — API clients authenticate with a Bearer token from that
        provider.
      </p>
      <Button type="button" onClick={() => window.location.reload()}>
        I&apos;ve signed in — retry
      </Button>
    </div>
  )
}

function PasswordLoginForm({ onSignedIn }: { onSignedIn?: () => void }) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [signingIn, setSigningIn] = useState(false)
  const queryClient = useQueryClient()

  async function signIn(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError('')
    setSigningIn(true)
    try {
      const result = await authClient.signIn.email({ email, password })
      if (result.error) {
        setError('Sign-in failed. Check your credentials and try again.')
        return
      }
      // The session probe caches the signed-out principal; drop it so the
      // next read sees the session the sign-in just created.
      await queryClient.invalidateQueries({ queryKey: ['session-principal'] })
      if (onSignedIn) onSignedIn()
      else window.location.reload()
    } catch {
      setError('Sign-in could not be completed. Please try again.')
    } finally {
      setSigningIn(false)
    }
  }

  return (
    <form className="grid max-w-sm gap-3" onSubmit={(event) => void signIn(event)}>
      <FieldGroup>
        <Field>
          <FieldLabel htmlFor="admin-login-email">Email</FieldLabel>
          <Input
            id="admin-login-email"
            type="email"
            autoComplete="username"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            required
          />
        </Field>
        <Field>
          <FieldLabel htmlFor="admin-login-password">Password</FieldLabel>
          <Input
            id="admin-login-password"
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            required
          />
        </Field>
      </FieldGroup>
      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}
      <Button type="submit" disabled={signingIn}>
        {signingIn && <Spinner data-icon="inline-start" />}
        {signingIn ? 'Signing in…' : 'Sign in'}
      </Button>
    </form>
  )
}

export function AdminLogin() {
  return (
    <div className="grid min-h-svh place-items-center bg-background p-4">
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle>Last Comments</CardTitle>
          <CardDescription>Sign in to access the admin dashboard</CardDescription>
        </CardHeader>
        <CardContent>
          <AdminLoginForm />
        </CardContent>
      </Card>
    </div>
  )
}
