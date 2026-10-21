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
}) {
  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) {
          form.reset()
          onReset?.()
        }
        onOpenChange(next)
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        <form
          onSubmit={(event) => {
            event.preventDefault()
            void form.handleSubmit()
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
            <form.Subscribe
              selector={(state) => [state.canSubmit, state.isSubmitting]}
              children={([canSubmit, isSubmitting]) => (
                <Button type="submit" disabled={!canSubmit || isSubmitting}>
                  {isSubmitting && <Spinner data-icon="inline-start" />}
                  {isSubmitting ? (pendingLabel ?? 'Saving…') : submitLabel}
                </Button>
              )}
            />
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
