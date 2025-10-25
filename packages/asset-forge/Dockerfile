# Asset Forge - Fly.io Dockerfile
# Production deployment with Bun

# Build stage
FROM oven/bun:1-alpine AS builder

WORKDIR /app

# Install build dependencies for native modules
RUN apk add --no-cache python3 make g++ wget

# Copy package files
COPY package.json ./

# Install ALL dependencies (dev dependencies needed for build)
RUN bun install

# Copy source code
COPY . .

# Build frontend with Bun
RUN bun run build

# Production stage
FROM oven/bun:1-alpine

WORKDIR /app

# Install runtime dependencies and wget for health checks
RUN apk add --no-cache wget python3 make g++

# Copy package files
COPY package.json ./

# Install production dependencies only
RUN bun install --production

# Copy built assets from builder
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/server ./server
COPY --from=builder /app/public ./public
COPY --from=builder /app/scripts ./scripts
COPY --from=builder /app/src ./src

# Create directories for asset storage
RUN mkdir -p /app/gdd-assets /app/temp-images

# Set environment variables
ENV NODE_ENV=production
ENV PORT=8080

# Expose port
EXPOSE 8080

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:8080/api/health || exit 1

# Start application with Bun
CMD ["bun", "run", "start"]
