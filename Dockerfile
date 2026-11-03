# Multi-Stage Production Dockerfile for ZeroDrain Agent Monorepo
# Compatible with Railway, Fly.io, Koyeb, Render, and AWS AppRunner

FROM node:20-alpine AS builder

WORKDIR /app

# Copy package manifests
COPY package.json ./
COPY apps/agent-core/package.json ./apps/agent-core/
COPY apps/trader-ui/package.json ./apps/trader-ui/

# Install dependencies
RUN npm install

# Copy source code
COPY . .

# Build frontend UI production bundle
RUN npm run build:ui

# --- Production Runner ---
FROM node:20-alpine AS runner

WORKDIR /app
ENV NODE_ENV=production

COPY package.json ./
COPY apps/agent-core ./apps/agent-core
COPY --from=builder /app/apps/trader-ui/dist ./apps/trader-ui/dist

WORKDIR /app/apps/agent-core
RUN npm install --omit=dev

EXPOSE 4000
ENV PORT=4000

CMD ["node", "server.js"]
