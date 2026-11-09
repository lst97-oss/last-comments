# notifications plugin

Tells the site's admins, in their dashboard bell, when a comment is posted, held for review, hidden, deleted, or when a page gets a reaction. The bell and the delivery are the notifications server's (`last-notifications`); this plugin only decides what to send and to whom.

## Events

Each kind is a switch. Defaults: `created`, `heldForReview`, `hidden`, `deleted` on; `pageReacted` off (reactions are frequent).

| Kind | Fires on | Notifies |
|---|---|---|
| `created` | a new comment that the filter did not hold | every admin except the author |
| `heldForReview` | a comment the filter held (on create or edit) | every admin except the author |
| `hidden` | a moderator hides a comment | every admin except the moderator (the audit log names them) |
| `deleted` | a comment is deleted by its author or a moderator | every admin except the actor; no comment text |
| `pageReacted` | a new page reaction (repeats of the same reaction emit nothing) | every admin except the reactor, at most once per page per window |

## Configuration

- `NOTIFICATIONS_URL`: server URL the plugin posts to (server to server), for example `http://localhost:3002`.
- `NOTIFICATIONS_PUBLIC_URL`: the address the admin's browser calls. Defaults to `NOTIFICATIONS_URL`.
- `NOTIFICATIONS_APP_KEY`: the app's key on the notifications server.
- `NOTIFICATIONS_API_KEY`: an app API key (`lnk_…`) with `notifications:create` and `tokens:create`. Server-side only.
- `NOTIFICATIONS_EVENTS`: optional, for example `created,deleted,pageReacted`. Lists the kinds to turn on and turns every other kind off.
- Defaults that are not env: `reactionWindowMinutes` (30) and `channels` (`['inapp']`), in `notifications.config.ts`.

The plugin stays off until the server URL, app key and `lnk_` key are present. Settings → Plugins shows what is missing.

## Operations

- Delivery runs from the outbox in the plugin worker: `bun run plugins:work` (the compose `worker` service). Without the worker, notices queue and arrive late.
- A failed publish is retried by the outbox after backoff. A transient failure (network, timeout, 5xx, 429) follows the normal schedule. A permanent one (a wrong app or API key) is retried every 15 minutes and records its code (for example `APP_NOT_FOUND`) on the delivery row. Each notice has a dedupe key, so a retry never duplicates a notice.
- The admin bell reads two endpoints, both for dashboard admins only. `/api/notifications-config` returns the app key and public address, with no upstream call, so a notification-server outage cannot hide the bell. `/api/notifications-token` mints a recipient token with the API key, and the bell calls it through the widget's `tokenUrl`. A transient failure answers `503 NOTIFICATIONS_UNAVAILABLE` with `Retry-After`. A permanent one answers `501 NOTIFICATIONS_NOT_CONFIGURED`, which stops the bell's retries. The upstream detail is logged as `notifications.token.mint_failed` (with its `code`, `retryable` and `requestId`) and never reaches the browser. The request id is sent upstream, so both logs share one id.

## Code map

- `notifications.config.ts` reads the env and the defaults.
- `notifications.plugin.ts` classifies events, picks recipients, builds dedupe keys, publishes through the SDK.
- `notifications.format.ts` writes the copy and the priority.
- `notifications.repository.ts` reads recipients, comment context and the moderator actor.
