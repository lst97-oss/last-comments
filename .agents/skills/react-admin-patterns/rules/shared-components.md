# Shared admin components

The admin app has one component catalogue. Check it before writing markup —
duplication between `dashboard.tsx` and `moderation_.$pageId.tsx` is what
this catalogue now prevents.

## The catalogue

All under `src/components/admin/`.

### `admin-query-error.tsx` — `AdminQueryError`

The destructive banner for a failed request. Owns the headline pick, the
request-reference line, the sign-in branch and the retry button.

```tsx
<AdminQueryError
  failure={failure}                                  // describeApiError() result
  forbiddenTitle="The dashboard is restricted to administrators."
  onRetry={…}                                        // refetch the queries that failed
  onSignedIn={() => void sitesQuery.refetch()}
  extraAction={<Button variant="ghost" …>Back to Pages</Button>}
/>
```

- `failure` comes from `describeApiError(error, fallback)` in
  `src/lib/api-response.ts` — never hand-build the message.
- Pass `onRetry` only for the queries that actually failed; a retry that
  refetches an unrelated query hides the real error.
- A forbidden failure gets **no** retry button (there is nothing to retry).
- `title` / `body` override the derived headline and reference line.

### `account-field.tsx` — `AccountTextField`

One text input bound to a TanStack Form field, with the `invalid`,
`aria-invalid`, `required`, blur and length wiring done once.

```tsx
<AccountTextField
  form={form}
  name="name"
  id="site-name"
  label="Name"
  autoComplete="name"
  maxLength={120}
/>
```

Use it for plain text/email/password inputs. A field with bespoke markup
(path + origin prefix, a scope `FieldSet`) keeps its own JSX.

### `form-dialog.tsx` — `FormDialog`

Dialog + form + one submit button + one error slot. Closing it resets the
form and clears the error, so a reopened dialog never shows stale state.

```tsx
<FormDialog
  open={open}
  onOpenChange={onOpenChange}
  title="Create site"
  description="…"
  error={error}
  submitLabel="Create site"
  pendingLabel="Creating…"
  form={form}
  onReset={() => setError('')}
>
  <FieldGroup>…</FieldGroup>
</FormDialog>
```

The submit button reads `form.Subscribe` for `canSubmit` / `isSubmitting` and
shows a `Spinner` while submitting. The dialog body is the form's fields.

### `stats-panels.tsx` — the dashboard/thread panels

| Export | Renders |
|---|---|
| `StatCard` | title, description, value, footnote, optional action |
| `CommentActivityPanel` | visible/hidden per day (area chart) |
| `CommentStatusPie` | visible/hidden/deleted (pie chart) |
| `VotesPanel` | upvotes/downvotes per day (bar chart) |
| `VisibleRatePanel` | the radial visible-rate gauge |
| `ModerationActivityCard` | the action/count table — `scopeCopy` is `'site'` or `'thread'` |
| `SkeletonCards` | the loading placeholder grid |

Titles, Empty copy and `aria-label`s are identical on both screens by
construction — that is the point of the shared component. When a screen
needs different copy, pass it in as a prop (e.g. `emptyTitle` /
`emptyDescription` on `CommentStatusPie`).

### `leaderboard.tsx` — `Leaderboard`

A ranked name + value + bar list. The name sits on its own line above a
full-width bar, so a long name never eats the bar's space.

```tsx
<Leaderboard
  items={topPages.map((page) => ({ key: page.pageId, label: threadLabel(page.title, page.canonicalUrl), value: page.total }))}
  renderLabel={(item) => <Link to="/moderation/$pageId" params={{ pageId: item.key }} search={{ site }}>{item.label}</Link>}
  ariaValueText={(item) => `${item.label}, ${item.value} comments`}
  empty={<Empty>…</Empty>}
/>
```

`ariaValueText` matters: Base UI's `Progress` announces the bar as a
*percentage*, while the visible value is a raw count. Without the override a
screen reader says "45%" where the screen shows "12 comments".

### `range-toggle.tsx` — `RangeToggle`

The 7/30/90-day switch, using the shared `RANGES` / `Range` from
`src/lib/admin-format.ts`. Both the dashboard and the thread detail use it,
so the two screens cannot drift.

### `thread-status-badge.tsx` — `ThreadStatusBadge` / `ThreadKeyBadge`

`Locked`/`Open` and the page-key/`URL only` badges. Used in the pages list,
the recent list, the thread header and the thread meta card.

### `hint.tsx` — `Hint`

A tooltip wrapper for an icon button. The tooltip text is part of the UX
contract — copy it verbatim when moving a control.

### `confirm-delete-dialog.tsx` — `ConfirmDeleteDialog`

The destructive confirmation with `confirmLabel` / `pendingLabel` / `pending`.

## When to add a new shared component

Add one when **two screens need the same markup**. Not one screen, not
three near-identical ones — two, with the differences expressible as props.

The seam belongs in `src/components/admin/` (a React component) or
`src/lib/` (a pure helper), never inline in a route file.

## Data shapes

Shared display helpers live in `src/lib/admin-format.ts`:
`RANGES`, `Range`, `ModerationView`, `asModerationView`, `ACTION_LABELS`,
`threadLabel`, `formatDay`, `timeAgo`, `authorInitials`.

The site list is read through `src/lib/admin-sites.ts`
(`ADMIN_SITES_QUERY_KEY`, `fetchAdminSites`), and the page-thread shape
through `src/lib/page-thread.ts` (`PageSummary`, `PAGE_LIST_LIMIT`,
`embedSnippet`).
