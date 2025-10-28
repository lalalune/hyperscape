# Multi-stage Docker build for Asset Forge API Server
# Uses Bun runtime for optimal performance

# Stage 1: Base image with dependencies
FROM oven/bun:1 AS base
WORKDIR /app

# Install system dependencies
RUN apt-get update && apt-get install -y \
    ca-certificates \
    && rm -rf /var/lib/apt/lists/*

# Stage 2: Dependencies
FROM base AS deps
WORKDIR /app

# Copy package files
COPY package.json ./

# Install dependencies
RUN bun install --frozen-lockfile --production

# Stage 3: Production image
FROM base AS runner
WORKDIR /app

# Create non-root user for security
RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 apiserver

# Copy dependencies from deps stage
COPY --from=deps /app/node_modules ./node_modules

# Copy application code
COPY --chown=apiserver:nodejs . .

# Create directories for runtime data
RUN mkdir -p gdd-assets temp-images && \
    chown -R apiserver:nodejs gdd-assets temp-images

# Run database setup and migrations (as root before switching users)
RUN node scripts/setup-railway-database.mjs || true && \
    node server/scripts/migrate-manifests-to-postgres.mjs || true

# Switch to non-root user
USER apiserver

# Expose API port (Railway will assign actual port via PORT env var)
EXPOSE 3004

# Railway handles healthchecks via railway.json configuration
# No need for Docker HEALTHCHECK instruction

# Environment variables
ENV NODE_ENV=production
# API_PORT is set by Railway's PORT environment variable

# Start the server
CMD ["bun", "run", "start"]
