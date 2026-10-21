# Screens

## Dashboard (`/dashboard`)

Site-wide totals for the selected site and range.

```
header      "Last Comments" / "Dashboard"  + site Select + RangeToggle
Summary     Total comments · Threads · Net votes · Awaiting review
Trends      Comment activity (area, 2 cols) · Comment status (pie)
Breakdown   Votes (bar) · Top threads (leaderboard) · Visible rate (gauge)
            Moderation activity (table, full width)
```

The dashboard is the only screen with a "Top threads" leaderboard, and its
rows link to `/moderation/$pageId?site=…`.

## Moderation (`/moderation`)

Three tabs, switched by `?view=pages|recent|sites` and a `ToggleGroup` in
the sidebar. The tab state lives in the URL so a link is shareable.

**Pages** — the searchable, client-paged list of page threads. Each row
shows the page title + URL, the thread badge, the comment counts, the lock
badge, a "View comments" link to the thread detail, and a lock/unlock
button.

**Recent** — one card per thread with updates in the selected window
(24H / 7D / 30D), the author avatars, and an accordion with the newest
updates.

**Sites** — the sites table with the role badge, the key with a copy
button, the allowed origin, and rename/delete. "Create site" opens the
shared `FormDialog`; a successful create chains into the site-key dialog.

## Thread detail (`/moderation/$pageId?site=…`)

One thread, everything the moderator needs about it.

```
breadcrumb  Pages / <title>
header      site name · "Thread" / title + URL + lock badge + key badge
            + RangeToggle + Lock button + copy-embed + open-page
Summary     Total comments · Participants · Net votes · Awaiting review
Trends      Comment activity (area, 2 cols) · Comment status (pie)
Breakdown   Votes (bar) · Top authors (leaderboard) · Visible rate (gauge)
Thread      Thread meta card · Moderation activity (table)
Comments    the comments widget
```

The "Thread" and "Moderation activity" cards sit in a `lg:grid-cols-2`
section; the other rows are `lg:grid-cols-3`.

**The `site` search param is mandatory.** A thread link without a site has
nothing to resolve and renders "This thread link is missing its site." —
never a cross-site fallback.

## The shell

`DashboardShell` (`src/components/admin/dashboard-shell.tsx`) provides the
sidebar, the top bar and the main column. It gates on the session: while
the principal is pending it shows a spinner, and with no principal it
renders the sign-in form. Every admin screen uses it, so the gate is in one
place.

The sidebar's own moderation tab state comes from the raw location search
(`useLocation`), not `useSearch({ from })` — the sidebar renders on every
dashboard page, and `useSearch` throws outside a matching route.

## The page switch resets local state

The pages list keeps a search box and a page cursor. Switching sites must
clear both, or the new site's rows are filtered by the old site's search:

```tsx
// Keyed by site: switching sites resets the search box and the page
// cursor instead of carrying them over to the new site's rows.
<PagesView key={site} {...props} />
```

`key` is the idiomatic reset — it remounts the component with fresh state.
The alternative (an effect that resets on site change) is the anti-pattern
this rule replaces.
