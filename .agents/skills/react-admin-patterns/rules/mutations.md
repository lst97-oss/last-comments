# Mutations

Every write in the admin app is a `useMutation`. The mutation owns the
invalidation, the pending state and the error, so no call site can forget
one of them.

## Correct

```tsx
const deleteSiteMutation = useMutation({
  mutationFn: async (siteKey: string) => {
    const response = await fetch(`/api/admin/sites/${encodeURIComponent(siteKey)}`, { method: 'DELETE' })
    await readApiData<{ deleted: boolean }>(response)
    return siteKey
  },
  onSuccess: async (siteKey) => {
    if (siteKey === site) setSiteOverride(null)
    await Promise.all([sitesQuery.refetch(), allSitesQuery.refetch()])
    toast.add({ title: 'Site deleted', description: siteKey, type: 'success' })
  },
  onError: (cause) => reportFailure('Could not delete site', cause),
})
```

## Incorrect

```tsx
// ✗ manual fetch + manual refetch: the cache is stale if the refetch is
//   forgotten, and two concurrent writes can interleave their refetches
async function deleteSite(siteKey: string) {
  const response = await fetch(`/api/admin/sites/${siteKey}`, { method: 'DELETE' })
  await readApiData<{ deleted: boolean }>(response)
  await sitesQuery.refetch()
}
```

## Rules

### The mutation owns the invalidation

Put the refetch in `onSuccess` / `onSettled`, not at the call site. When a
mutation is triggered from two places, only the mutation-level invalidation
is guaranteed to run in both.

### Pending state disables its own control

```tsx
<Button type="button" variant="outline" disabled={lockMutation.isPending} onClick={…}>
  {lockMutation.isPending ? <Spinner data-icon="inline-start" /> : <Lock data-icon="inline-start" />}
  {page.isLocked ? 'Unlock' : 'Lock'}
</Button>
```

A double click on an un-disabled control fires two requests: a lock toggle
flips the page twice, and the second one undoes the first. The `disabled`
prop plus the spinner is the fix — not a debounce.

For list rows, thread the pending flag down to the row
(`<SiteKeyRow pending={patching} …>`) so only the affected row is inert.

### A failed write keeps the dialog open

The mutation returns a value the caller checks:

```tsx
onSubmit: async ({ value }) => {
  if (!renameTarget) return
  // The dialog stays open when the rename failed, so the admin can retry.
  if (await onRenameSite(renameTarget.key, value.name)) setRenameTarget(null)
},
```

Returning `false` on failure (`.then(() => true, () => false)`) keeps the
promise resolving so the form's submit handler does not throw, while still
telling the caller whether the write succeeded.

### Report failures in the place the admin is looking

- **Behind a dialog** (create site, rename site, create key) → a toast.
  The page-level banner is covered by the open dialog.
- **On the page** (lock a thread, delete a key row) → the inline banner or
  the row's own error.

`reportFailure` in `moderation.tsx` is the toast helper; `actionError` in
`moderation_.$pageId.tsx` is the inline variant.

### `useMutation` vs `mutate` vs `mutateAsync`

- `mutate(payload)` — fire and forget; the mutation's own `onSuccess` /
  `onError` do the rest. Default choice.
- `mutateAsync(payload)` — returns a promise; use it when the caller must
  know the outcome (the "keep the dialog open" pattern above). Always
  `.catch()` it, or a rejected mutation becomes an unhandled rejection.
- `mutate(payload, { onSuccess })` — per-call callbacks for one-off extras
  (e.g. `setDeleteTarget(null)`).

### Dialog-owned mutations live in the dialog

A create dialog owns its own form and its own mutation; the parent only
learns about the result through `onCreated()`. The mutation's `onSuccess`
runs `form.reset()`, closes the dialog and calls `onCreated()`.
