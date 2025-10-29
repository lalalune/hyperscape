#!/bin/bash
set -e

echo "🚀 Asset Forge API - Railway Startup"
echo "===================================="

# Run migrations if DATABASE_URL is set
if [ ! -z "$DATABASE_URL" ]; then
  echo "✅ DATABASE_URL detected - running migrations"
  node scripts/run-migrations.mjs || echo "⚠️  Migrations failed (continuing anyway)"
else
  echo "⚠️  DATABASE_URL not set - skipping migrations"
fi

echo "===================================="
echo "🚀 Starting API Server..."
echo "===================================="

# Execute server (replaces this process)
exec node server/api.mjs
