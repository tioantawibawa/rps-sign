# syntax=docker/dockerfile:1

# ----- Base with pnpm -----
FROM node:20-bookworm-slim AS base
ENV PNPM_HOME=/pnpm
ENV PATH=$PNPM_HOME:$PATH
RUN corepack enable && corepack prepare pnpm@9.15.9 --activate
WORKDIR /app
# Force a flat (hoisted) node_modules so `.prisma` and `@prisma` live at the
# top level and can be copied into the runtime image. pnpm's default symlinked
# layout hides them inside the .pnpm store, breaking the runner COPY steps.
RUN printf 'node-linker=hoisted\n' > /app/.npmrc

# ----- Dependencies -----
FROM base AS deps
COPY package.json pnpm-lock.yaml* ./
RUN pnpm install --frozen-lockfile || pnpm install

# ----- Builder -----
FROM base AS builder
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN pnpm exec prisma generate
ENV NEXT_TELEMETRY_DISABLED=1
# Emit the standalone server bundle for a minimal runtime image.
ENV BUILD_STANDALONE=1
# A dummy DATABASE_URL lets `next build` collect page data without a live DB.
ENV DATABASE_URL=postgresql://user:pass@localhost:5432/db?schema=public
ENV AUTH_SECRET=build-time-placeholder-secret-string-32b
RUN pnpm build

# ----- Runner (production) -----
FROM node:20-bookworm-slim AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

# LibreOffice (headless) for DOCX -> PDF conversion + fonts for stamping.
RUN apt-get update \
  && apt-get install -y --no-install-recommends \
     libreoffice-writer-nogui fonts-liberation fonts-dejavu-core ca-certificates \
  && rm -rf /var/lib/apt/lists/*

RUN groupadd --system --gid 1001 nodejs \
  && useradd --system --uid 1001 --gid nodejs nextjs

# Next.js standalone output.
COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static
# Prisma schema + engines for runtime.
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=builder /app/node_modules/@prisma ./node_modules/@prisma
# Argon2 native bindings. Next.js standalone tracing misses @node-rs's
# dynamically-required platform binary package, so the password hash/verify
# throws at runtime and every login fails. Copy the whole scope explicitly.
COPY --from=builder /app/node_modules/@node-rs ./node_modules/@node-rs

RUN mkdir -p /app/.storage && chown -R nextjs:nodejs /app/.storage
USER nextjs
EXPOSE 3000
ENV PORT=3000 HOSTNAME=0.0.0.0
CMD ["node", "server.js"]
