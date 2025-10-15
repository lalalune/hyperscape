# Production-ready Dockerfile for Cloudflare deployment
FROM oven/bun:1-slim

WORKDIR /app

# Install system dependencies including curl for healthcheck
RUN apt-get update && apt-get install -y \
    curl \
    ca-certificates \
    && rm -rf /var/lib/apt/lists/*

# Copy package files
COPY package.json bun.lockb* ./

# Install dependencies
RUN bun install --frozen-lockfile

# Copy source code
COPY . .

# Build the server
RUN bun run build

# Set environment
ENV NODE_ENV=production

# Expose WebSocket port
EXPOSE 5555

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD curl -f http://localhost:5555/status || exit 1

# Run the server
CMD ["bun", "dist/index.js"]
