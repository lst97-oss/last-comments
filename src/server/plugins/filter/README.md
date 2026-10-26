# Filter plugin (`filter`)

Advisory comment screening that holds violations for review (`status:
'hidden'`) instead of rejecting the write. Two engines, each independently
switchable — enable either, both, or neither:

| Engine      | What                                                                       | Cost                                | Config                                       |
| ----------- | -------------------------------------------------------------------------- | ----------------------------------- | -------------------------------------------- |
| `bad-words` | Lexical blocklist + default profanity wordlist                             | Zero (sync)                         | `engines.badwords`, `blocklist`, `allowlist` |
| LLM decider | `perplexity/pplx-decider-v1.2` via the OpenRouter **Decisions API**, text + markdown images | ~1 decisions call per screened comment | `engines.llm`, `schemas.*`, `openrouter.*`   |

All tuning lives in [`filter.config.ts`](./filter.config.ts) (standard
per-plugin TS config — see `../plugin-config.ts`). Both engines are on by
default; the only environment variable is the secret:

```bash
OPENROUTER_API_KEY=sk-or-…   # required iff engines.llm is on
```

Without it the LLM engine logs `filter.llm_skipped: missing_key` and resolves
through `failOpen` (`true` = allow + warn, `false` = hold for review + warn).
The plugin never throws, so commenters never see a 5xx from screening.

## Decider transport

`pplx-decider-v1.2` is a Decisions model (`text+image -> decisions`): it does
not generate chat completions, and OpenRouter rejects `/chat/completions` for
it with a 400. The plugin posts to `/api/alpha/decisions` (SDK
`client.alpha.decisions.create`, raw-`fetch` fallback) with `state` = prompt
text + 512px image thumbnails, and one `noul` question per enabled category
(`text:<category>`, `image:<index>:<category>`) whose answer is the calibrated
probability of a violation. `hideThreshold` compares against that probability;
`benign` is asked but can never hide. Answers are required for every question —
a missing answer is a `schema` error, which resolves through `failOpen`.

## Schemas (per-schema opt-in)

8 text + 8 image schemas (`filter-schemas.ts`). `schemas.text` / `schemas.image`
take `'all'` (default) or any subset; `[]` disables that modality entirely:

```ts
schemas: {
  text: ['harassment_hate', 'illicit_pii', 'spam_scam'],
  image: ['sexual_explicit', 'graphic_violence_gore'],
}
```

Disabled schemas are never asked, and `applyVerdictThreshold` drops any
signal whose category is not enabled, so a drifted answer can never trigger a
hide. `benign` (image) is scorable evidence only and never hides.

Question rules carry the measured exclusions: a brief emoji acknowledgement is
not `low_quality`, a reference link is not `spam_scam`/`link_abuse`, and
credential or one-time-code requests — including comments claiming to be an
admin or support — are `illicit_pii`. Malware links and commands such as
`curl … | bash` are `link_abuse`.

## Images

Extraction mirrors the review widget renderer (`http(s)` only — `data:` /
`blob:` / `javascript:` fall back to alt text in the widget and are never
fetched here). Each kept image (default max 3) is fetched with a per-image
timeout + byte cap, downscaled with `sharp` to a 512px JPEG q60 thumbnail, and
sent as an `image_url` part in the same one-shot decisions request (with
`detail: 'low'`). An empty image schema set skips all fetching (zero vision
cost). Thumbnails are in-memory only and never stored.

The fetch is a server-side request to a commenter's URL, so it is guarded per
hop: only ports 80 and 443 are used; every address the host resolves to must be
public (loopback, private, link-local and cloud-metadata, carrier-grade NAT,
unique-local, multicast and reserved ranges are refused, IPv4-mapped and 6to4
forms included); redirects are followed one checked hop at a time (at most
three); and the body is read only up to the byte cap. The DNS check and the
connection are two steps, so a name that changes its answer in between is a
remaining gap (see `shortcut:` in `image-prep.ts`).

**Data leaves the instance.** When the LLM engine is on, the author name, the
comment text, the site host and the image thumbnails are sent to OpenRouter for
every screened comment. Turn `engines.llm` off, or leave `OPENROUTER_API_KEY`
unset, if that data must stay on your server.

## What a hit does

- Create/reply/edit persists with `status: 'hidden'`: invisible to
  `listPageComments` (public thread), visible in `GET /api/moderation` review.
- The `comment.created` / `comment.edited` outbox payload gains
  `{ autoHidden: true, reasons, triggeredCategories }` for future consumers.
- No `moderationEvents` row: that table requires a human `actorUserId` FK and
  auto-hide has no actor. Reason strings name only enabled schemas, e.g.
  `auto.hide: harassment_hate(0.91)` is stored in the outbox payload.
- Edits only promote `visible → hidden`, never unhide. Moderator dashboard
  writes (`comment-create`, `comment-edit` via `/api/moderation`) skip
  screening entirely — trusted paths must never auto-hide themselves.
- Ordering per request: rate-limit → Turnstile → filter → persist, so
  rejected spam never spends LLM budget.

## `bad-words` semantics

`blocklist` entries are case-insensitive substring matches; `allowlist`
entries exempt exact tokens and are removed from the default wordlist (fixes
false positives like code identifiers without forking the library). The
default list is checked per unicode token. Matches are redacted (`s***`) in
logs. Multi-word blocklist phrases match as substrings; single tokens also
match via the wordlist path.

## Verification

```bash
bun test tests/filter-config.test.ts tests/filter-badwords.test.ts \
  tests/filter-image-prep.test.ts tests/filter-openrouter-client.test.ts \
  tests/filter-plugin.test.ts tests/filter-decider-prompt.test.ts
```

Integration (needs `BUSINESS_DATABASE_URL`):
`bun test tests/filter-comments.integration.test.ts`.

Live decider eval (paid; fractions of a cent per run) posts the labeled cases
in `scripts/eval-filter-decider.ts` — all 8 text + 8 image schemas across
text, emoji, and mixed text+image, plus phishing, admin/support impersonation,
credential/OTP theft, malware links, and benign security controls — through
the real Decisions transport and prints per-schema coverage plus a
precision/recall sweep:

```bash
bun run eval:filter
```
