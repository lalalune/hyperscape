#!/bin/bash
#
# Fly.io Secrets Setup Script for Asset Forge
# This script helps you configure all required secrets for Fly.io deployment
#
# Usage:
#   1. Copy .env.example to .env and fill in your values
#   2. Run: ./scripts/fly-setup-secrets.sh
#

set -e

echo "========================================="
echo "Asset Forge - Fly.io Secrets Setup"
echo "========================================="
echo ""

# Check if flyctl is installed
if ! command -v fly &> /dev/null; then
    echo "❌ Error: flyctl is not installed"
    echo "Install it with: curl -L https://fly.io/install.sh | sh"
    exit 1
fi

# Check if user is logged in
if ! fly auth whoami &> /dev/null; then
    echo "❌ Error: Not logged in to Fly.io"
    echo "Run: fly auth login"
    exit 1
fi

echo "✅ flyctl is installed and you are logged in"
echo ""

# Check if .env file exists
if [ ! -f .env ]; then
    echo "❌ Error: .env file not found"
    echo "Copy .env.example to .env and fill in your values:"
    echo "  cp .env.example .env"
    exit 1
fi

echo "✅ Found .env file"
echo ""

# Load .env file
export $(cat .env | grep -v '^#' | xargs)

# Confirm app name
APP_NAME="${FLY_APP_NAME:-asset-forge}"
echo "📱 App name: $APP_NAME"
echo ""
read -p "Is this correct? (y/n) " -n 1 -r
echo
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo "Update FLY_APP_NAME in your .env file"
    exit 1
fi

echo ""
echo "Setting up secrets..."
echo ""

# Required secrets check
REQUIRED_SECRETS=(
    "OPENAI_API_KEY"
    "MESHY_API_KEY"
    "JWT_SECRET"
    "ENCRYPTION_KEY"
)

MISSING_SECRETS=()
for secret in "${REQUIRED_SECRETS[@]}"; do
    if [ -z "${!secret}" ]; then
        MISSING_SECRETS+=("$secret")
    fi
done

if [ ${#MISSING_SECRETS[@]} -gt 0 ]; then
    echo "❌ Missing required secrets in .env:"
    for secret in "${MISSING_SECRETS[@]}"; do
        echo "   - $secret"
    done
    echo ""
    echo "Generate JWT_SECRET and ENCRYPTION_KEY with:"
    echo "  openssl rand -base64 32"
    exit 1
fi

echo "✅ All required secrets found"
echo ""

# Set secrets in batches to avoid command length limits

# 1. AI Services
echo "Setting AI service secrets..."
fly secrets set \
  OPENAI_API_KEY="$OPENAI_API_KEY" \
  MESHY_API_KEY="$MESHY_API_KEY" \
  --app "$APP_NAME"

# 2. Security
echo "Setting security secrets..."
fly secrets set \
  JWT_SECRET="$JWT_SECRET" \
  ENCRYPTION_KEY="$ENCRYPTION_KEY" \
  --app "$APP_NAME"

# 3. Optional: ElevenLabs
if [ -n "$ELEVENLABS_API_KEY" ]; then
    echo "Setting ElevenLabs API key..."
    fly secrets set ELEVENLABS_API_KEY="$ELEVENLABS_API_KEY" --app "$APP_NAME"
fi

# 4. Optional: Privy
if [ -n "$PRIVY_APP_ID" ] && [ -n "$PRIVY_APP_SECRET" ]; then
    echo "Setting Privy credentials..."
    fly secrets set \
      PRIVY_APP_ID="$PRIVY_APP_ID" \
      PRIVY_APP_SECRET="$PRIVY_APP_SECRET" \
      VITE_PUBLIC_PRIVY_APP_ID="$PRIVY_APP_ID" \
      --app "$APP_NAME"
fi

# 5. Optional: Blob Storage (Vercel Blob)
if [ -n "$BLOB_READ_WRITE_TOKEN" ]; then
    echo "Setting blob storage token..."
    fly secrets set \
      BLOB_READ_WRITE_TOKEN="$BLOB_READ_WRITE_TOKEN" \
      USE_BLOB_STORAGE="true" \
      --app "$APP_NAME"
fi

# 6. Optional: CDN URL
if [ -n "$VITE_CDN_URL" ]; then
    echo "Setting CDN URL..."
    fly secrets set VITE_CDN_URL="$VITE_CDN_URL" --app "$APP_NAME"
fi

# 7. Optional: Cron secret
if [ -n "$CRON_SECRET" ]; then
    echo "Setting cron secret..."
    fly secrets set CRON_SECRET="$CRON_SECRET" --app "$APP_NAME"
fi

# 8. Optional: Frontend URL
if [ -n "$FRONTEND_URL" ]; then
    echo "Setting frontend URL..."
    fly secrets set FRONTEND_URL="$FRONTEND_URL" --app "$APP_NAME"
fi

echo ""
echo "========================================="
echo "✅ Secrets setup complete!"
echo "========================================="
echo ""

# Show all secrets (names only, not values)
echo "Current secrets:"
fly secrets list --app "$APP_NAME"

echo ""
echo "Next steps:"
echo "1. Create Tigris storage:    fly storage create"
echo "2. Create Postgres database: fly postgres create"
echo "3. Create Redis instance:    fly redis create"
echo "4. Attach database:          fly postgres attach <db-name> --app $APP_NAME"
echo "5. Enable pgvector:          fly postgres connect -a <db-name>"
echo "                             CREATE EXTENSION IF NOT EXISTS vector;"
echo "6. Run migrations:           node scripts/migrate-db.mjs"
echo "7. Deploy:                   fly deploy"
echo ""
