Build optimized Docker image with multi-stage builds and security scanning.

## Instructions

```bash
IMAGE_NAME=${1:-app}
TAG=${2:-latest}

echo "🐳 Building Docker image: $IMAGE_NAME:$TAG"

# Create optimized Dockerfile if it doesn't exist
if [ ! -f "Dockerfile" ]; then
  cat > Dockerfile << 'EOF'
# Multi-stage build
FROM node:18-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM node:18-alpine
WORKDIR /app
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules ./node_modules
COPY package*.json ./
USER node
EXPOSE 3000
CMD ["node", "dist/index.js"]
EOF
  echo "✅ Created Dockerfile"
fi

# Build image
docker build -t $IMAGE_NAME:$TAG .

if [ $? -eq 0 ]; then
  echo "✅ Image built successfully"

  # Scan for vulnerabilities
  if command -v trivy &> /dev/null; then
    echo "🔍 Scanning for vulnerabilities..."
    trivy image $IMAGE_NAME:$TAG
  fi

  # Show image size
  SIZE=$(docker images $IMAGE_NAME:$TAG --format "{{.Size}}")
  echo "Image size: $SIZE"

  echo ""
  echo "Next steps:"
  echo "  • Test: docker run -p 3000:3000 $IMAGE_NAME:$TAG"
  echo "  • Push: docker push $IMAGE_NAME:$TAG"
fi
```
