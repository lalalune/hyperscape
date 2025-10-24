# Asset Forge - Fly.io Dockerfile
# Simplified single-stage build

FROM node:22-alpine

WORKDIR /app

# Install build dependencies for native modules
RUN apk add --no-cache python3 make g++

# Copy package files
COPY package.json ./

# Install all dependencies with legacy-peer-deps to handle React 19
RUN npm install --legacy-peer-deps

# Copy source code
COPY . .

# Build frontend (if build script exists)
RUN npm run build || echo "No build needed"

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
