# syntax=docker/dockerfile:1

# Keep in sync with .bun-version.
ARG BUN_VERSION=1.4.3

FROM oven/bun:${BUN_VERSION}-slim AS base
WORKDIR /app

FROM base AS deps
COPY package.json bun.lock ./
RUN --mount=type=cache,target=/root/.bun/install/cache,sharing=locked bun install --frozen-lockfile

FROM base AS prod-deps
COPY package.json bun.lock ./
RUN --mount=type=cache,target=/root/.bun/install/cache,sharing=locked bun install --frozen-lockfile --production

FROM base AS build
COPY --link --from=deps /app/node_modules ./node_modules
COPY . .
ENV NITRO_PRESET=bun \
  NODE_ENV=production
# Dummy values exist only for this RUN layer; nothing is baked into the image.
RUN export PAYLOAD_SECRET=build-only-dummy-secret-override-at-runtime-1234567890 \
  && export DATABASE_URL=postgres://buildonly:buildonly@127.0.0.1:5432/buildonly \
  && export PAYLOAD_PUBLIC_SERVER_URL=https://example.com \
  && export PAYLOAD_BUNX_FLAGS=--bun \
  && export PAYLOAD_CLI_ARGS=--disable-transpile \
  && bun run build

FROM base AS runner
WORKDIR /app

ENV HOST=0.0.0.0 \
    PORT=3000 \
    NODE_ENV=production

COPY --link --from=prod-deps /app/node_modules ./node_modules
COPY --link package.json bun.lock ./
COPY --link --from=build --chown=1000:1000 /app/.output ./.output
COPY --link --chown=1000:1000 payload.config.ts tsconfig.json ./
COPY --link --chown=1000:1000 src ./src
# Runtime migration and maintenance entrypoints.
COPY --link --chown=1000:1000 drizzle ./drizzle
COPY --link --chown=1000:1000 scripts/grant-business-admin.ts scripts/migrate-business.ts scripts/plugin-worker.ts scripts/uninstall-business-plugin.ts ./scripts/
COPY --link --from=build --chown=1000:1000 /app/src/payload-import-map.ts ./src/payload-import-map.ts
COPY --link --from=build --chown=1000:1000 /app/payload-types.ts ./payload-types.ts
RUN mkdir -p /app/media && chown 1000:1000 /app/media

USER bun

EXPOSE 3000

STOPSIGNAL SIGTERM

HEALTHCHECK --interval=30s --timeout=5s --start-period=30s --retries=3 \
  CMD bun -e "const r = await fetch('http://127.0.0.1:3000/api/live'); process.exit(r.ok ? 0 : 1)"

CMD ["bun", ".output/server/index.mjs"]
