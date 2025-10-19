# Lightweight nginx-based CDN for serving static game assets
# Supports local development and can be deployed to any environment
FROM nginx:alpine

# Install basic tools for health checks
RUN apk add --no-cache curl

# Copy nginx configuration
COPY nginx.conf /etc/nginx/nginx.conf
COPY default.conf /etc/nginx/conf.d/default.conf

# Create assets directory
RUN mkdir -p /usr/share/nginx/html/assets

# Expose HTTP port (use reverse proxy for HTTPS in production)
EXPOSE 8088

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD curl -f http://localhost:8088/health || exit 1

# Run nginx
CMD ["nginx", "-g", "daemon off;"]

