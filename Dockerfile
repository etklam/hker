# Stage 1: Build
FROM node:20-alpine AS builder
WORKDIR /app

# CapRover injects app env vars as build args
ARG DATABASE_URL
ARG AUTH_SESSION_SECRET
ARG APP_BASE_URL
ARG AUTH_SESSION_COOKIE_NAME
ARG AUTH_SESSION_TTL_DAYS

ENV DATABASE_URL=$DATABASE_URL
ENV AUTH_SESSION_SECRET=$AUTH_SESSION_SECRET
ENV APP_BASE_URL=$APP_BASE_URL
ENV AUTH_SESSION_COOKIE_NAME=$AUTH_SESSION_COOKIE_NAME
ENV AUTH_SESSION_TTL_DAYS=$AUTH_SESSION_TTL_DAYS

COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

# Stage 2: Runtime
FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/public ./public
EXPOSE 3000
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"
CMD ["node", "server.js"]
