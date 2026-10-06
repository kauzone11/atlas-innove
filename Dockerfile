FROM node:22-alpine AS dependencies

WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

FROM dependencies AS builder

ARG APP_BASE_URL
ENV APP_BASE_URL=$APP_BASE_URL
COPY prisma ./prisma
RUN npx prisma generate
COPY . .
RUN npm run build

FROM node:22-alpine AS runner

WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000

RUN addgroup --system --gid 1001 nodejs && adduser --system --uid 1001 nextjs

COPY --from=dependencies /app/node_modules ./node_modules
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/public ./public
COPY --from=builder /app/prisma ./prisma
RUN npx prisma generate
# The production image runs migrations and the explicit, idempotent demo seed before serving traffic.
COPY --from=builder /app/src/lib/db.ts ./src/lib/db.ts
COPY --from=builder /app/src/demo/fixtures/index.ts ./src/demo/fixtures/index.ts
# Explicit maintenance uses the same authorization-safe tombstone cleanup without loading application routes.
COPY --from=builder /app/scripts/media-cleanup.ts ./scripts/media-cleanup.ts
COPY --from=builder /app/src/lib/media/cleanup.ts /app/src/lib/media/presentation.ts /app/src/lib/media/types.ts /app/src/lib/media/errors.ts ./src/lib/media/
COPY --from=builder /app/src/lib/storage/client.ts /app/src/lib/storage/config.ts ./src/lib/storage/
COPY --from=builder /app/src/lib/network/locking.ts ./src/lib/network/locking.ts
COPY --from=builder /app/src/lib/errors.ts ./src/lib/errors.ts
COPY --from=builder /app/tsconfig.json ./tsconfig.json
COPY package.json package-lock.json ./

RUN chown -R nextjs:nodejs /app
USER nextjs

EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 CMD wget -qO- http://127.0.0.1:3000/api/health || exit 1

CMD ["sh", "-c", "npx prisma migrate deploy && npm run db:seed:demo && npm start"]
