# Asset Forge - Fly.io Dockerfile
# Multi-stage build for optimized production deployment using Bun

# Build stage
FROM oven/bun:1 AS builder

WORKDIR /app

# Copy package files
COPY package.json ./

# Install dependencies
RUN bun install --frozen-lockfile

# Copy source code
COPY . .

# Build frontend
RUN bun run build

# Production stage - use Node.js for better compatibility
FROM node:22-alpine

WORKDIR /app

# Copy package.json and install production dependencies with npm
COPY package.json ./
RUN npm install --omit=dev

# Copy built assets from builder
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/server ./server
COPY --from=builder /app/scripts ./scripts
COPY --from=builder /app/src ./src

# Create directory for asset storage
RUN mkdir -p /app/gdd-assets /app/temp-images

# Set environment
ENV NODE_ENV=production
ENV PORT=8080

# Expose port (Fly.io will map this internally)
EXPOSE 8080

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
  CMD node -e "require('http').get('http://localhost:8080/api/health', (r) => {process.exit(r.statusCode === 200 ? 0 : 1)})"

# Start application
CMD ["node", "--experimental-strip-types", "server/api.mjs"]
