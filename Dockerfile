# Bike configurator image. Run exactly ONE container of it: carts, stock and
# idempotency keys live in process memory (see scripts/deploy.sh).

# --- deps: install from the lockfile only, so this layer caches well ---
FROM node:22-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

# --- build ---
FROM node:22-alpine AS build
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
ENV NEXT_TELEMETRY_DISABLED=1
RUN npm run build

# --- runtime ---
FROM node:22-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    PORT=3000 \
    HOSTNAME=0.0.0.0
# node_modules is copied whole: next.config.ts is loaded at start and the
# build tooling it names lives in devDependencies.
COPY --from=build --chown=node:node /app/node_modules ./node_modules
COPY --from=build --chown=node:node /app/.next ./.next
COPY --from=build --chown=node:node /app/public ./public
COPY --from=build --chown=node:node /app/data ./data
COPY --from=build --chown=node:node /app/package.json /app/next.config.ts /app/tsconfig.json ./
USER node
EXPOSE 3000
HEALTHCHECK --interval=10s --timeout=3s --start-period=20s --retries=3 \
  CMD wget -q -O /dev/null "http://127.0.0.1:${PORT}/api/health" || exit 1
CMD ["npm", "start"]
