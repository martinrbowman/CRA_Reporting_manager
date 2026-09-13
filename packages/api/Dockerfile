FROM node:22-alpine AS base
ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
RUN corepack enable

# ── Builder ──────────────────────────────────────────────────────────────────
FROM base AS builder
WORKDIR /app

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml tsconfig.base.json ./
COPY packages/shared/package.json ./packages/shared/
COPY packages/api/package.json    ./packages/api/

RUN pnpm install --frozen-lockfile

COPY packages/shared/ ./packages/shared/
COPY packages/api/    ./packages/api/

RUN pnpm --filter @cra/shared build && \
    pnpm --filter @cra/api build

# ── Runtime ──────────────────────────────────────────────────────────────────
FROM node:22-alpine AS runtime
ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
ENV NODE_ENV=production
RUN corepack enable
RUN apk add --no-cache postgresql-client

WORKDIR /app

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY packages/shared/package.json ./packages/shared/
COPY packages/api/package.json    ./packages/api/

RUN pnpm install --frozen-lockfile --prod

COPY --from=builder /app/packages/shared/dist ./packages/shared/dist
COPY --from=builder /app/packages/api/dist    ./packages/api/dist
COPY packages/api/src/db/migrations ./packages/api/dist/db/migrations

EXPOSE 3001

# Migrate, then seed (idempotent — see db/seed.ts), then start.
CMD ["sh", "-c", "node packages/api/dist/db/migrate.js && node packages/api/dist/db/seed.js && node packages/api/dist/index.js"]
