#!/bin/bash
# Asset Forge API - Railway Deployment Script
# Run this script to complete the deployment

set -e  # Exit on error

echo "🚀 Asset Forge API - Railway Deployment"
echo "========================================"
echo ""

# Check if logged in
echo "✓ Checking Railway CLI login..."
railway whoami || {
    echo "❌ Not logged in to Railway"
    echo "Run: railway login"
    exit 1
}

echo "✓ Railway CLI is logged in"
echo ""

# Project should already be initialized
echo "📦 Current Railway project:"
railway status
echo ""

# Step 1: Add PostgreSQL database
echo "Step 1: Adding PostgreSQL database..."
echo "---------------------------------------"
echo "Please run manually in a separate terminal:"
echo ""
echo "  cd /Users/home/hyperscape-4/apps/api"
echo "  railway add"
echo ""
echo "Then select:"
echo "  - Database"
echo "  - PostgreSQL"
echo ""
read -p "Press Enter once PostgreSQL is added..."

# Step 2: Set environment variables
echo ""
echo "Step 2: Setting environment variables..."
echo "---------------------------------------"

# Read from .env file
if [ -f ".env" ]; then
    echo "Reading from .env file..."

    # Required variables
    OPENAI_API_KEY=$(grep "^OPENAI_API_KEY=" .env | cut -d '=' -f2)
    MESHY_API_KEY=$(grep "^MESHY_API_KEY=" .env | cut -d '=' -f2)
    PRIVY_APP_ID=$(grep "^PRIVY_APP_ID=" .env | cut -d '=' -f2)
    PRIVY_APP_SECRET=$(grep "^PRIVY_APP_SECRET=" .env | cut -d '=' -f2)
    OPENROUTER_API_KEY=$(grep "^OPENROUTER_API_KEY=" .env | cut -d '=' -f2)

    # Set Railway environment variables
    echo "Setting NODE_ENV..."
    railway variables set NODE_ENV=production

    echo "Setting PORT..."
    railway variables set PORT=3004

    echo "Setting FRONTEND_URL (update this!)..."
    railway variables set FRONTEND_URL=http://localhost:3000

    if [ -n "$OPENAI_API_KEY" ]; then
        echo "Setting OPENAI_API_KEY..."
        railway variables set OPENAI_API_KEY="$OPENAI_API_KEY"
    fi

    if [ -n "$MESHY_API_KEY" ]; then
        echo "Setting MESHY_API_KEY..."
        railway variables set MESHY_API_KEY="$MESHY_API_KEY"
    fi

    if [ -n "$PRIVY_APP_ID" ]; then
        echo "Setting PRIVY_APP_ID..."
        railway variables set PRIVY_APP_ID="$PRIVY_APP_ID"
    fi

    if [ -n "$PRIVY_APP_SECRET" ]; then
        echo "Setting PRIVY_APP_SECRET..."
        railway variables set PRIVY_APP_SECRET="$PRIVY_APP_SECRET"
    fi

    if [ -n "$OPENROUTER_API_KEY" ]; then
        echo "Setting OPENROUTER_API_KEY..."
        railway variables set OPENROUTER_API_KEY="$OPENROUTER_API_KEY"
    fi

    # Meshy configuration
    echo "Setting Meshy configuration..."
    railway variables set MESHY_POLL_INTERVAL_MS=5000
    railway variables set MESHY_TIMEOUT_MS=300000
    railway variables set MESHY_MODEL_DEFAULT=meshy-5

    # Feature flags
    echo "Setting feature flags..."
    railway variables set ENABLE_GPT4_ENHANCEMENT=true
    railway variables set ENABLE_RETEXTURING=true
    railway variables set ENABLE_RIGGING=true

    # Logging
    railway variables set DEBUG=false
    railway variables set LOG_LEVEL=info

    echo "✓ Environment variables set"
else
    echo "⚠️  .env file not found"
    echo "Please set variables manually:"
    echo "  railway variables set NODE_ENV=production"
    echo "  railway variables set OPENAI_API_KEY=..."
    echo "  # etc..."
fi

echo ""
echo "Step 3: Deploying application..."
echo "---------------------------------------"
railway up

echo ""
echo "Step 4: Enabling pgvector extension..."
echo "---------------------------------------"
echo "Running SQL command..."
railway run psql \$DATABASE_URL -c "CREATE EXTENSION IF NOT EXISTS vector;"

echo ""
echo "Step 5: Running database migrations..."
echo "---------------------------------------"
railway run npm run migrate:manifests
railway run npm run seed:manifests

echo ""
echo "✅ Deployment complete!"
echo "======================"
echo ""
echo "Your API is now live at:"
railway domain
echo ""
echo "Test it:"
echo "  curl https://\$(railway domain)/api/health"
echo ""
echo "View logs:"
echo "  railway logs -f"
echo ""
