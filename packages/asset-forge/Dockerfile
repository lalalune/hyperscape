# Asset Forge - Fly.io Dockerfile
# Production deployment with Node.js

FROM node:22-alpine

WORKDIR /app

# Install build dependencies for native modules (if needed)
RUN apk add --no-cache python3 make g++

# Copy package files
COPY package.json package-lock.json* ./

# Install ALL dependencies (dev dependencies needed for build)
RUN npm ci || npm install

# Copy all source code
COPY . .

# Build frontend
RUN npm run build

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

# Start application using the start script from package.json
CMD ["npm", "run", "start"]
