# Multi-stage Dockerfile for Hyperscape Game Server
# Builds the server with all dependencies and creates a lean runtime image

# ============================================================================
# Stage 1: Builder - Install dependencies and build packages
# ============================================================================
FROM oven/bun:1.1.38-alpine AS builder

WORKDIR /app

# Copy package files for dependency installation
COPY package.json bun.lockb ./
COPY packages/physx-js-webidl/package.json ./packages/physx-js-webidl/
COPY packages/shared/package.json ./packages/shared/
COPY packages/server/package.json ./packages/server/

# Install dependencies (frozen lockfile for reproducibility)
RUN bun install --frozen-lockfile

# Copy source code
COPY packages/physx-js-webidl ./packages/physx-js-webidl
COPY packages/shared ./packages/shared
COPY packages/server ./packages/server
COPY turbo.json ./

# Build packages in correct order
# 1. PhysX (copies prebuilt files)
WORKDIR /app/packages/physx-js-webidl
RUN bun run build

# 2. Shared (core engine)
WORKDIR /app/packages/shared
RUN bun run build

# 3. Server (game server)
WORKDIR /app/packages/server
RUN bun run build

# ============================================================================
# Stage 2: Runtime - Minimal production image
# ============================================================================
FROM oven/bun:1.1.38-alpine AS runtime

WORKDIR /app

# Install production dependencies only
COPY package.json bun.lockb ./
COPY packages/physx-js-webidl/package.json ./packages/physx-js-webidl/
COPY packages/shared/package.json ./packages/shared/
COPY packages/server/package.json ./packages/server/
RUN bun install --frozen-lockfile --production

# Copy built artifacts from builder
COPY --from=builder /app/packages/physx-js-webidl/dist ./packages/physx-js-webidl/dist
COPY --from=builder /app/packages/shared/dist ./packages/shared/dist
COPY --from=builder /app/packages/shared/build ./packages/shared/build
COPY --from=builder /app/packages/server/dist ./packages/server/dist
COPY --from=builder /app/packages/server/world ./packages/server/world

# Copy server source files needed at runtime
COPY --from=builder /app/packages/server/src ./packages/server/src

# Set working directory to server
WORKDIR /app/packages/server

# Expose WebSocket port
EXPOSE 5555

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=10s --retries=3 \
  CMD bun run -e "fetch('http://localhost:5555/health').then(r => r.ok ? process.exit(0) : process.exit(1)).catch(() => process.exit(1))"

# Run the server
CMD ["bun", "run", "start"]
