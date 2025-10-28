# Multi-stage Docker build for Asset Forge API Server
# Uses Node.js runtime for @hono/node-server compatibility

# Stage 1: Base image with dependencies
FROM node:20-slim AS base
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
RUN npm install --omit=dev

# Stage 3: Production image
FROM base AS runner
WORKDIR /app

# Create non-root user for security
RUN groupadd --system --gid 1001 nodejs
RUN useradd --system --uid 1001 apiserver

# Copy dependencies from deps stage
COPY --from=deps /app/node_modules ./node_modules

# Copy application code
COPY --chown=apiserver:nodejs . .

# Create directories for runtime data
RUN mkdir -p gdd-assets temp-images && \
    chown -R apiserver:nodejs gdd-assets temp-images

# Switch to non-root user
USER apiserver

# Expose API port (Railway will assign actual port via PORT env var)
EXPOSE 3004

# Railway handles healthchecks via railway.json configuration
# No need for Docker HEALTHCHECK instruction

# Environment variables
ENV NODE_ENV=production
# PORT is set by Railway and will be used by the server

# Start the server
CMD ["node", "scripts/startup.mjs"]
