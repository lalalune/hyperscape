# Asset Forge - Fly.io Dockerfile
# Multi-stage build for optimized production deployment

# Build stage
FROM node:22-alpine AS builder

WORKDIR /app

# Copy package files
COPY package*.json bun.lockb ./

# Install dependencies (use npm for Fly.io compatibility)
RUN npm install --production=false

# Copy source code
COPY . .

# Build frontend
RUN npm run build

# Production stage
FROM node:22-alpine

WORKDIR /app

# Install production dependencies only
COPY package*.json ./
RUN npm install --production

# Copy built assets from builder
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/server ./server
COPY --from=builder /app/scripts ./scripts

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
CMD ["npm", "run", "start"]
