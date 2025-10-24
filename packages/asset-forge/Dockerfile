# Asset Forge - Fly.io Dockerfile
# Using Bun for fast builds and runtime

FROM oven/bun:1-alpine

WORKDIR /app

# Copy package files
COPY package.json bun.lock* ./

# Install dependencies
RUN bun install --frozen-lockfile --production

# Copy source code
COPY . .

# Build frontend
RUN bun run build || echo "No build needed"

# Create directory for asset storage
RUN mkdir -p /app/gdd-assets /app/temp-images

# Set environment
ENV NODE_ENV=production
ENV PORT=8080

# Expose port (Fly.io will map this internally)
EXPOSE 8080

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:8080/api/health || exit 1

# Start application with Bun
CMD ["bun", "run", "server/api.mjs"]
