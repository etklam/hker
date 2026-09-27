FROM node:24-alpine AS builder
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1
ENV NPM_CONFIG_UPDATE_NOTIFIER=false
COPY package*.json ./
RUN npm ci --no-audit --no-fund
COPY . .
RUN npm run build && npm run ops:build && npm prune --omit=dev --no-audit --no-fund

FROM node:24-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production NEXT_TELEMETRY_DISABLED=1 PORT=3000 HOSTNAME=0.0.0.0
COPY --from=builder --chown=node:node /app/.next/standalone ./
COPY --from=builder --chown=node:node /app/node_modules ./node_modules
COPY --from=builder --chown=node:node /app/.next/static ./.next/static
COPY --from=builder --chown=node:node /app/public ./public
COPY --from=builder --chown=node:node /app/.ops ./ops
COPY --from=builder --chown=node:node /app/drizzle ./drizzle
COPY --chown=node:node scripts/runtime-env.cjs scripts/start.cjs scripts/telegram-ops.mjs ./ops/
ARG HKER_COMMIT=unknown
ARG HKER_TREE_SHA256=unknown
ARG HKER_LOCKFILE_SHA256=unknown
ARG HKER_MIGRATION_SHA256=unknown
LABEL org.opencontainers.image.revision=$HKER_COMMIT \
      io.hker.source.tree.sha256=$HKER_TREE_SHA256 \
      io.hker.lockfile.sha256=$HKER_LOCKFILE_SHA256 \
      io.hker.migrations.sha256=$HKER_MIGRATION_SHA256
USER node
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s CMD node -e "fetch('http://127.0.0.1:3000/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
CMD ["node", "ops/start.cjs"]
