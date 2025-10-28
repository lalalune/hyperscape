# Multi-stage Docker build for Asset Forge Frontend
# Builds the Vite app and serves it with Node.js

# Stage 1: Build the frontend
FROM node:20-slim AS builder
WORKDIR /app

# Install build dependencies
RUN apt-get update && apt-get install -y \
    ca-certificates \
    && rm -rf /var/lib/apt/lists/*

# Accept build arguments (Railway passes all env vars as build args)
ARG VITE_PUBLIC_PRIVY_APP_ID
ARG VITE_API_URL
ARG VITE_CDN_URL
ARG VITE_GENERATION_API_URL
ARG VITE_PIPELINE_POLL_INTERVAL_MS
ARG VITE_DEBUG_PIPELINE

# Make them available as environment variables during build
ENV VITE_PUBLIC_PRIVY_APP_ID=${VITE_PUBLIC_PRIVY_APP_ID}
ENV VITE_API_URL=${VITE_API_URL}
ENV VITE_CDN_URL=${VITE_CDN_URL}
ENV VITE_GENERATION_API_URL=${VITE_GENERATION_API_URL}
ENV VITE_PIPELINE_POLL_INTERVAL_MS=${VITE_PIPELINE_POLL_INTERVAL_MS}
ENV VITE_DEBUG_PIPELINE=${VITE_DEBUG_PIPELINE}

# Copy package files
COPY package.json ./

# Install dependencies
RUN npm install

# Copy source code
COPY . .

# Debug: Show environment variables
RUN echo "Build-time env vars:" && \
    echo "VITE_PUBLIC_PRIVY_APP_ID: ${VITE_PUBLIC_PRIVY_APP_ID:+set}" && \
    echo "VITE_API_URL: ${VITE_API_URL:+set}" && \
    echo "VITE_CDN_URL: ${VITE_CDN_URL:+set}"

# Build the application
RUN npm run build

# Verify dist directory was created
RUN ls -la dist/ && echo "Build successful - dist directory created"

# Stage 2: Production image
FROM node:20-slim AS runner
WORKDIR /app

# Install runtime dependencies
RUN apt-get update && apt-get install -y \
    ca-certificates \
    && rm -rf /var/lib/apt/lists/*

# Create non-root user for security
RUN groupadd --system --gid 1001 nodejs && \
    useradd --system --uid 1001 --gid nodejs appuser

# Copy built assets from builder
COPY --from=builder --chown=appuser:nodejs /app/dist ./dist
COPY --chown=appuser:nodejs server.mjs ./

# Verify dist directory exists
RUN ls -la dist/ && echo "Dist directory ready for deployment"

# Switch to non-root user
USER appuser

# Expose port (Railway will assign via PORT env var)
EXPOSE 8080

# Environment variables
ENV NODE_ENV=production

# Start the server
CMD ["node", "server.mjs"]
