#!/bin/bash
# Configure CORS for Hyperscape R2 asset buckets
#
# Prerequisites:
#   - Wrangler CLI installed: npm install -g wrangler
#   - Logged in to Cloudflare: wrangler login
#
# Usage:
#   ./scripts/configure-r2-cors.sh [production|staging]

set -e

ENV="${1:-production}"

if [ "$ENV" = "production" ]; then
  BUCKET="hyperscape-assets"
elif [ "$ENV" = "staging" ]; then
  BUCKET="hyperscape-assets-staging"
else
  echo "Usage: $0 [production|staging]"
  exit 1
fi

echo "Configuring CORS for R2 bucket: $BUCKET"

# Create CORS configuration JSON (wrangler R2 API format)
CORS_CONFIG=$(cat <<'EOF'
{
  "rules": [
    {
      "allowed": {
        "origins": [
          "https://hyperscape.gg",
          "https://www.hyperscape.gg",
          "https://hyperbet.win",
          "https://www.hyperbet.win",
          "https://hyperscape.bet",
          "https://www.hyperscape.bet",
          "https://hyperscape-production.up.railway.app",
          "https://*.hyperscape.pages.dev",
          "https://*.hyperscape-betting.pages.dev",
          "http://localhost:3333",
          "http://localhost:5555",
          "http://127.0.0.1:3333",
          "http://127.0.0.1:5555"
        ],
        "methods": ["GET", "HEAD"],
        "headers": ["*"]
      },
      "exposed": ["Content-Length", "Content-Type", "ETag"],
      "maxAge": 86400
    }
  ]
}
EOF
)

# Write to temp file (wrangler requires a file)
TEMP_FILE=$(mktemp)
echo "$CORS_CONFIG" > "$TEMP_FILE"

# Apply CORS configuration
echo "Applying CORS configuration..."
wrangler r2 bucket cors set "$BUCKET" --file "$TEMP_FILE"

# Clean up
rm "$TEMP_FILE"

echo "CORS configured successfully for $BUCKET"
echo ""
echo "Allowed origins:"
echo "  - https://hyperscape.gg"
echo "  - https://www.hyperscape.gg"
echo "  - https://hyperbet.win"
echo "  - https://www.hyperbet.win"
echo "  - https://hyperscape.bet"
echo "  - https://www.hyperscape.bet"
echo "  - https://hyperscape-production.up.railway.app"
echo "  - https://*.hyperscape.pages.dev"
echo "  - https://*.hyperscape-betting.pages.dev"
echo "  - http://localhost:*"
