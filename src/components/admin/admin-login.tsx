'use client'

import { Turnstile, type TurnstileInstance } from '@marsidev/react-turnstile'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useRef, useState } from 'react'

import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Field, FieldGroup, FieldLabel } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { Spinner } from '@/components/ui/spinner'
import { authClient, useAuthProviders } from '@/lib/business-auth-client'
import { turnstileSiteKeyServerFn } from '@/lib/turnstile-site-key'

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

const VERIFICATION_UNAVAILABLE = 'Sign-in verification is unavailable right now. Reload the page and try again.'

function PasswordLoginForm({ onSignedIn }: { onSignedIn?: () => void }) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [captchaToken, setCaptchaToken] = useState('')
  const [error, setError] = useState('')
  const [signingIn, setSigningIn] = useState(false)
  const queryClient = useQueryClient()
  const turnstile = useRef<TurnstileInstance | undefined>(undefined)
  const siteKeyQuery = useQuery({
    queryKey: ['turnstile-site-key'],
    queryFn: () => turnstileSiteKeyServerFn(),
    staleTime: Infinity,
    retry: false,
  })
  const siteKey = siteKeyQuery.data?.siteKey ?? null
  // With no widget the form cannot be submitted, so the reason is shown instead of a dead button.
  const verificationUnavailable = siteKeyQuery.isError || (siteKeyQuery.isSuccess && siteKey === null)

  async function signIn(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError('')
    setSigningIn(true)
    try {
      const result = await authClient.signIn.email({
        email,
        password,
        fetchOptions: { headers: { 'x-captcha-response': captchaToken } },
      })
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
      // A Turnstile token is good for one check, so each attempt needs a fresh one.
      setCaptchaToken('')
      turnstile.current?.reset()
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
      {siteKey && (
        <Turnstile
          ref={turnstile}
          siteKey={siteKey}
          onSuccess={setCaptchaToken}
          onExpire={() => setCaptchaToken('')}
          onError={() => setError(VERIFICATION_UNAVAILABLE)}
        />
      )}
      {(error || verificationUnavailable) && (
        <Alert variant="destructive">
          <AlertDescription>{error || VERIFICATION_UNAVAILABLE}</AlertDescription>
        </Alert>
      )}
      <Button type="submit" disabled={signingIn || !captchaToken}>
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
