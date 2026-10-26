import { useMutation } from '@tanstack/react-query'

import { toast } from '@/components/ui/toast'
import { readApiData } from '@/lib/api-response'
import { type PageSummary } from '@/lib/page-thread'

type PageLock = { page: PageSummary; locked: boolean; undo?: boolean }

// Locks or unlocks a page. A lock is reversible, so its success toast offers Undo; the undo itself does not
// offer another. `refresh` reloads whatever list or thread the caller shows.
export function usePageLock(site: string, refresh: () => Promise<unknown>) {
  const lockMutation = useMutation({
    mutationFn: async ({ page, locked }: PageLock) => {
      const response = await fetch('/api/moderation', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ site, target: 'page', pageId: page.id, locked }),
      })
      await readApiData<Record<string, unknown>>(response)
    },
    onSuccess: async (_result, { page, locked, undo }) => {
      await refresh()
      const toastId = toast.add({
        title: locked ? 'Page locked' : 'Page unlocked',
        description: page.title ?? page.canonicalUrl,
        type: 'success',
        actionProps: undo
          ? undefined
          : {
              children: 'Undo',
              onClick: () => {
                toast.close(toastId)
                lockMutation.mutate({ page, locked: !locked, undo: true })
              },
            },
      })
    },
    onError: (cause, { locked }) =>
      toast.add({
        title: locked ? 'Could not lock page' : 'Could not unlock page',
        description: cause instanceof Error ? cause.message : 'Please try again.',
        type: 'error',
      }),
  })
  return lockMutation
}
