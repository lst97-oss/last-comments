'use client'

import type { ReactFormExtendedApi } from '@tanstack/react-form'

import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Spinner } from '@/components/ui/spinner'

export type AdminFormApi<TData> = ReactFormExtendedApi<TData, any, any, any, any, any, any, any, any, any, any, any>

export function FormDialog<TData extends Record<string, unknown>>({
  open,
  onOpenChange,
  title,
  description,
  error,
  submitLabel,
  pendingLabel,
  form,
  children,
  onReset,
  footerSlot,
  cancelLabel = 'Cancel',
  contentClassName,
  onConfirm,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: string
  description: React.ReactNode
  error?: string
  submitLabel: string
  pendingLabel?: string
  form: AdminFormApi<TData>
  children: React.ReactNode
  onReset?: () => void
  footerSlot?: React.ReactNode
  cancelLabel?: string
  contentClassName?: string
  // Replaces the form submit: the single button confirms and the form is not sent again (Enter included).
  onConfirm?: () => void
}) {
  function handleOpenChange(next: boolean) {
    if (!next) {
      form.reset()
      onReset?.()
    }
    onOpenChange(next)
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className={contentClassName}>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        <form
          onSubmit={(event) => {
            event.preventDefault()
            if (onConfirm) onConfirm()
            else void form.handleSubmit()
          }}
        >
          {children}
          {error ? (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          ) : null}
          <DialogFooter className="mt-4">
            {footerSlot}
            {onConfirm ? (
              <Button type="submit">{submitLabel}</Button>
            ) : (
              <>
                <Button type="button" variant="outline" onClick={() => handleOpenChange(false)}>
                  {cancelLabel}
                </Button>
                <form.Subscribe
                  selector={(state) => [state.canSubmit, state.isSubmitting]}
                  children={([canSubmit, isSubmitting]) => (
                    <Button type="submit" disabled={!canSubmit || isSubmitting}>
                      {isSubmitting && <Spinner data-icon="inline-start" />}
                      {isSubmitting ? (pendingLabel ?? 'Saving…') : submitLabel}
                    </Button>
                  )}
                />
              </>
            )}
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
