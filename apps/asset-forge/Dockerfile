# Multi-stage Docker build for Asset Forge Frontend
# Builds the Vite app and serves it with Node.js

# Stage 1: Build the frontend
FROM node:20-slim AS builder
WORKDIR /app

# Install build dependencies
RUN apt-get update && apt-get install -y \
    ca-certificates \
    && rm -rf /var/lib/apt/lists/*

# Copy package files
COPY package.json ./

# Install dependencies
RUN npm install

# Copy source code
COPY . .

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
