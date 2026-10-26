# Seeds

Idempotent development / demo content for the `last-comments` Payload database.

## Layout

- `introducing-last-comments.md` — source of truth for the "Introducing last-comments" blog post body (Markdown, GitHub-flavored). Edit this file, then re-run the seeder.
- `seed-posts.ts` — Bun runner that upserts the markdown into the `posts` collection via the Payload local API (lookup by `slug`, `create` or `update`). Requires the CMS database env (`PAYLOAD_SECRET`, `DATABASE_URL`, `PAYLOAD_PUBLIC_SERVER_URL`).
- `seed-blog-site.ts` — Bun runner that ensures the `BLOG_SITE_KEY` site and its allowed origins exist in the business database, then registers one comment thread per published post (same `upsertPage` entry point as the publish hook). Requires `BLOG_SITE_KEY`, `PAYLOAD_PUBLIC_SERVER_URL`, and `BUSINESS_DATABASE_URL`.
- `seed-demo-comments.ts` — Bun runner that adds a six-comment guest thread (three top-level, three replies) to the "Introducing last-comments" thread. Every row carries a fixed id, so re-running inserts nothing. Requires the blog site to exist (run `seed-blog-site.ts` first) plus `BLOG_SITE_KEY` and `PAYLOAD_PUBLIC_SERVER_URL`.

## Usage

From `last-comments/`:

```bash
# Upsert the intro post (published, slug: introducing-last-comments)
bun run db:seed

# Recreate the blog comment site + threads (recovery for an empty business DB,
# which otherwise shows "Comments are unavailable on this page / Origin is not allowed")
bun run db:seed:blog-site

# Add the demo comment thread to the intro post
bun run db:seed:demo-comments
```

The seeder is idempotent: re-running updates the same row instead of creating duplicates. Publishing uses `publishedAt: now`, so the post appears on `/blog` immediately (`publishedWhere()` requires `status: published` + past date).

## Notes

- This folder holds demo blog content for local development and screenshots; it is not part of the production bootstrap.
- Cover images are not seeded (nullable `cover` relation). Set one from `/admin` if needed.
- The post body exercises the blog renderer: fenced `mermaid` diagrams render via `MermaidDiagram`, other fenced blocks highlight via Shiki (https://shiki.style/).

## Load fixture and query benchmark

`seed-load.ts` builds a local-only `bench-site` (about 275k comments, 137k votes, 500 users) and runs `ANALYZE` on the tables afterwards, so the planner sees realistic statistics. `bench-comments.ts` times the repository read paths against it. Both refuse any database that is not on loopback, through `scripts/business-target.ts`. Remove the fixture with `bun run db:seed:load -- --reset`.
