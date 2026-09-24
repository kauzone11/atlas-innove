FROM node:22-alpine AS dependencies

WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

FROM dependencies AS builder

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
# The production image also runs the explicit, idempotent demo seed during deployment.
COPY --from=builder /app/src/lib/db.ts ./src/lib/db.ts
COPY --from=builder /app/src/demo/fixtures/index.ts ./src/demo/fixtures/index.ts
COPY package.json package-lock.json ./

RUN chown -R nextjs:nodejs /app
USER nextjs

EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 CMD wget -qO- http://127.0.0.1:3000/api/health || exit 1

CMD ["npm", "start"]
