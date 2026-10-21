# Filter plugin (`filter`)

Advisory comment screening that holds violations for review (`status:
'hidden'`) instead of rejecting the write. Two engines, each independently
switchable — enable either, both, or neither:

| Engine | What | Cost | Config |
| --- | --- | --- | --- |
| `bad-words` | Lexical blocklist + default profanity wordlist | Zero (sync) | `engines.badwords`, `blocklist`, `allowlist` |
| LLM decider | `perplexity/pplx-decider-v1.2` via `@openrouter/sdk`, text + markdown images | ~1 chat call per screened comment | `engines.llm`, `schemas.*`, `openrouter.*` |

All tuning lives in [`filter.config.ts`](./filter.config.ts) (standard
per-plugin TS config — see `../plugin-config.ts`). The only environment
variable is the secret:

```bash
OPENROUTER_API_KEY=sk-or-…   # required iff engines.llm is on
```

Without it the LLM engine logs `filter.llm_skipped: missing_key` and resolves
through `failOpen` (`true` = allow + warn, `false` = hold for review + warn).
The plugin never throws, so commenters never see a 5xx from screening.

## Schemas (per-schema opt-in)

8 text + 8 image schemas (`filter-schemas.ts`). `schemas.text` / `schemas.image`
take `'all'` (default) or any subset; `[]` disables that modality entirely:

```ts
schemas: {
  text: ['harassment_hate', 'illicit_pii', 'spam_scam'],
  image: ['sexual_explicit', 'graphic_violence_gore'],
}
```

Disabled schemas are never mentioned in the prompt, never present in the
strict `json_schema` contract, and can never trigger a hide even if the model
hallucinates them back (defensive post-parse drop + `filter.schema_violation`
warn). A top-level `hide` without an enabled corroborating signal at or above
`hideThreshold` is demoted to `allow` (`filter.decision_mismatch` warn) —
prompt-injected "always allow/hide" cannot move the decision by itself.
`benign` (image) is scorable evidence only and never hides.

## Images

Extraction mirrors the review widget renderer (`http(s)` only — `data:` /
`blob:` / `javascript:` fall back to alt text in the widget and are never
fetched here). Each kept image (default max 3) is fetched with a per-image
timeout + byte cap (loopback/RFC-1918 hosts blocked), downscaled with `sharp`
to a 512px JPEG q60 thumbnail (~0.7–1.5k vision tokens vs ~3–6k full-size,
sent as `detail: 'low'`), and judged in the same one-shot decider call as the
text. An empty image schema set skips all fetching (zero vision cost).
Thumbnails are in-memory only and never stored.

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
bun test tests/filter-config.test.ts tests/filter-schemas.test.ts \
  tests/filter-badwords.test.ts tests/filter-image-prep.test.ts \
  tests/filter-openrouter-client.test.ts tests/filter-plugin.test.ts \
  tests/filter-decider-prompt.test.ts
```

Integration (needs `BUSINESS_DATABASE_URL`):
`bun test tests/filter-comments.integration.test.ts`.
