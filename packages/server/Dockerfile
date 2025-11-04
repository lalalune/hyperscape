# Monorepo-aware Dockerfile for Hyperscape Server
# IMPORTANT: This Dockerfile must be built from the MONOREPO ROOT, not from packages/server
# Build command: docker build -f packages/server/Dockerfile .

FROM oven/bun:1-slim AS builder

WORKDIR /app

# Install system dependencies
RUN apt-get update && apt-get install -y \
    curl \
    ca-certificates \
    git \
    && rm -rf /var/lib/apt/lists/*

# Copy root workspace configuration files first
COPY package.json ./
COPY bun.lock ./
COPY turbo.json ./

# Copy workspace packages needed for build (shared is a dependency of server)
COPY packages/shared ./packages/shared
COPY packages/server ./packages/server

# Install ALL workspace dependencies
RUN bun install --frozen-lockfile

# Build shared package first (server depends on it)
RUN cd packages/shared && bun run build

# Build server package
RUN cd packages/server && bun run build

# Production stage - smaller final image
FROM oven/bun:1-slim

WORKDIR /app

# Install runtime dependencies
RUN apt-get update && apt-get install -y \
    curl \
    ca-certificates \
    && rm -rf /var/lib/apt/lists/*

# Copy built server from builder stage
COPY --from=builder /app/packages/server/dist ./dist
COPY --from=builder /app/packages/server/world ./world
COPY --from=builder /app/packages/server/package.json ./package.json

# Copy built shared package (runtime dependency)
COPY --from=builder /app/packages/shared/dist ./node_modules/@hyperscape/shared/dist
COPY --from=builder /app/packages/shared/package.json ./node_modules/@hyperscape/shared/package.json

# Copy all node_modules from builder
COPY --from=builder /app/node_modules ./node_modules

# Set environment
ENV NODE_ENV=production

# Expose WebSocket port
EXPOSE 5555

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD curl -f http://localhost:5555/status || exit 1

# Run the server
CMD ["bun", "dist/index.js"]
