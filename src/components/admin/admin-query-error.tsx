'use client'

import { TriangleAlert } from 'lucide-react'

import { AdminLoginForm } from '@/components/admin/admin-login'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'

export type AdminFailure = {
  message: string
  needsSignIn: boolean
  forbidden: boolean
  requestId: string
}

export function AdminQueryError({
  failure,
  forbiddenTitle,
  title,
  body,
  needsSignIn,
  onRetry,
  onSignedIn,
  extraAction,
}: {
  failure?: AdminFailure
  forbiddenTitle?: string
  title?: string
  body?: string
  needsSignIn?: boolean
  onRetry?: () => void
  onSignedIn?: () => void
  extraAction?: React.ReactNode
}) {
  const headline =
    title ?? (failure ? (failure.forbidden && forbiddenTitle ? forbiddenTitle : failure.message) : undefined)
  const description = body ?? (failure?.requestId ? `Reference: ${failure.requestId}` : undefined)
  const signIn = needsSignIn ?? failure?.needsSignIn ?? false
  const hasActions = Boolean(onRetry || extraAction)
  return (
    <Alert variant="destructive">
      <TriangleAlert />
      {headline ? <AlertTitle>{headline}</AlertTitle> : null}
      {description ? <AlertDescription>{description}</AlertDescription> : null}
      {signIn ? (
        <AdminLoginForm onSignedIn={onSignedIn} />
      ) : hasActions ? (
        <div className="mt-3 flex flex-wrap gap-2">
          {onRetry ? (
            <Button variant="outline" onClick={onRetry}>
              Retry
            </Button>
          ) : null}
          {extraAction}
        </div>
      ) : null}
    </Alert>
  )
}
