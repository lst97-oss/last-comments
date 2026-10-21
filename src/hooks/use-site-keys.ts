'use client'

import { useMutation, useQuery } from '@tanstack/react-query'
import { useState } from 'react'

import type { ApiKeyScope } from '@/lib/api-key-scopes'
import { readApiData } from '@/lib/api-response'
import { type PluginKey, scopesOfKey } from '@/lib/site-keys'

export function useSiteKeys() {
  const [drafts, setDrafts] = useState<Record<string, ApiKeyScope[]>>({})
  const [deleteTarget, setDeleteTarget] = useState<PluginKey | null>(null)

  // Key reads/writes go through the provider-neutral /api/admin/api-keys
  // wrapper (the plugin's own /api-key/* endpoints need a better-auth
  // session cookie, which external providers never set).
  const keysQuery = useQuery({
    queryKey: ['admin-api-keys'],
    queryFn: async () => {
      const response = await fetch('/api/admin/api-keys', { headers: { accept: 'application/json' } })
      const { keys: listed } = await readApiData<{ keys: PluginKey[] }>(response)
      return listed
    },
    retry: false,
  })

  const keys = keysQuery.data ?? []

  const patchMutation = useMutation({
    mutationFn: async ({ key, body }: { key: PluginKey; body: { scopes?: ApiKeyScope[]; enabled?: boolean } }) => {
      const siteKey = key.metadata?.siteKey ?? ''
      const response = await fetch('/api/admin/api-keys', {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ keyId: key.id, ...(siteKey ? { siteKey } : {}), ...body }),
      })
      await readApiData<{ updated: boolean }>(response)
    },
    onSettled: () => keysQuery.refetch(),
  })

  const deleteMutation = useMutation({
    mutationFn: async (key: PluginKey) => {
      // Mirror patchKey's scope binding so the server can confirm the key
      // belongs to this scope before deleting.
      const siteKey = key.metadata?.siteKey ?? ''
      const params = new URLSearchParams({ keyId: key.id, ...(siteKey ? { siteKey } : {}) })
      const response = await fetch(`/api/admin/api-keys?${params}`, { method: 'DELETE' })
      await readApiData<{ deleted: boolean }>(response)
      return key
    },
    onSuccess: (key) => {
      setDrafts((prev) => {
        const next = { ...prev }
        delete next[key.id]
        return next
      })
    },
    onSettled: () => keysQuery.refetch(),
  })

  const failure = patchMutation.error ?? deleteMutation.error ?? keysQuery.error
  const error = failure instanceof Error ? failure.message : ''

  function toggleScope(key: PluginKey, scope: ApiKeyScope) {
    setDrafts((prev) => {
      const draft = prev[key.id] ?? scopesOfKey(key)
      return {
        ...prev,
        [key.id]: draft.includes(scope) ? draft.filter((item) => item !== scope) : [...draft, scope],
      }
    })
  }

  function saveScopes(key: PluginKey) {
    patchMutation.mutate({ key, body: { scopes: drafts[key.id] ?? scopesOfKey(key) } })
  }

  function toggleEnabled(key: PluginKey) {
    patchMutation.mutate({ key, body: { enabled: !key.enabled } })
  }

  function confirmDelete() {
    if (!deleteTarget) return
    deleteMutation.mutate(deleteTarget, { onSuccess: () => setDeleteTarget(null) })
  }

  return {
    keys,
    loading: keysQuery.isPending,
    error,
    clearError: () => {
      patchMutation.reset()
      deleteMutation.reset()
    },
    drafts,
    toggleScope,
    saveScopes,
    toggleEnabled,
    deleting: deleteMutation.isPending,
    patching: patchMutation.isPending,
    deleteTarget,
    requestDelete: setDeleteTarget,
    cancelDelete: () => setDeleteTarget(null),
    confirmDelete,
    refresh: () => keysQuery.refetch(),
  }
}
