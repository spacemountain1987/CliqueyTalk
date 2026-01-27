FROM node:20-bookworm-slim AS base

WORKDIR /usr/src/app

# Required for audio processing features.
RUN apt-get update \
	&& apt-get install -y --no-install-recommends ffmpeg \
	&& rm -rf /var/lib/apt/lists/*

FROM base AS deps
COPY package.json package-lock.json ./
RUN npm ci

FROM base AS builder
COPY --from=deps /usr/src/app/node_modules ./node_modules
COPY . .
RUN npm run build

FROM base AS runner
ENV NODE_ENV=production

# Install only production deps for runtime.
COPY package.json package-lock.json ./
RUN npm ci --omit=dev

COPY --from=builder /usr/src/app/public ./public
COPY --from=builder /usr/src/app/.next ./.next
COPY --from=builder /usr/src/app/next.config.mjs ./next.config.mjs

RUN chown -R node:node /usr/src/app
USER node

# Cloud Run/App Hosting provides PORT (typically 8080).
EXPOSE 8080
CMD ["sh", "-c", "npm start -- -p ${PORT:-8080}"]
