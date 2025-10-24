# Asset Forge - Fly.io Deployment Guide

Complete guide for deploying Asset Forge to Fly.io with Tigris S3 storage, Postgres (pgvector), and Redis.

## 📋 Table of Contents

1. [Prerequisites](#prerequisites)
2. [Infrastructure Setup](#infrastructure-setup)
3. [Environment Configuration](#environment-configuration)
4. [Database Setup](#database-setup)
5. [Asset Migration](#asset-migration)
6. [Deployment](#deployment)
7. [Verification](#verification)
8. [Troubleshooting](#troubleshooting)

---

## Prerequisites

### Required Tools

```bash
# Install Fly.io CLI
curl -L https://fly.io/install.sh | sh

# Verify installation
fly version

# Login to Fly.io
fly auth login
```

### Required Accounts

- Fly.io account (https://fly.io/app/sign-up)
- OpenAI API key (https://platform.openai.com/api-keys)
- Meshy.ai API key (https://www.meshy.ai/)
- ElevenLabs API key (https://elevenlabs.io/)
- Privy App ID (https://dashboard.privy.io/) - optional

---

## Infrastructure Setup

### 1. Create Fly.io App

```bash
cd packages/asset-forge

# Create app (will prompt for app name and region)
fly apps create asset-forge

# Choose region closest to your users
# Recommended: sjc (San Jose) or iad (Virginia)
```

### 2. Create Tigris S3 Storage

```bash
# Create Tigris bucket
fly storage create

# Example output:
# Your Tigris project (hyperscape-assets) is ready.
#
# Set the following secrets on your target app:
# AWS_ACCESS_KEY_ID: tid_xxx
# AWS_SECRET_ACCESS_KEY: tsec_xxx
# AWS_ENDPOINT_URL_S3: https://fly.storage.tigris.dev
# BUCKET_NAME: hyperscape-assets
```

**Save these credentials** - you'll need them for the next steps.

### 3. Create Postgres Database with pgvector

```bash
# Create Postgres cluster
fly postgres create

# Prompts:
# - Choose app name: asset-forge-db
# - Choose region: (same as your app)
# - Choose VM size: shared-cpu-1x (256MB) for development
# - Choose volume size: 10GB for development

# Attach database to your app
fly postgres attach asset-forge-db --app asset-forge

# This sets DATABASE_URL automatically
```

### 4. Create Redis Instance

```bash
# Create Redis (Upstash)
fly redis create

# Prompts:
# - Choose app name: asset-forge-redis
# - Choose region: (same as your app)
# - Choose plan: Free (256MB) for development

# This will output REDIS_URL - save it for later
```

---

## Environment Configuration

### 1. Set Secrets

Set all sensitive environment variables as Fly.io secrets:

```bash
# Tigris S3 credentials (from step 2)
fly secrets set \
  AWS_ACCESS_KEY_ID=tid_xxx \
  AWS_SECRET_ACCESS_KEY=tsec_xxx \
  AWS_ENDPOINT_URL_S3=https://fly.storage.tigris.dev \
  BUCKET_NAME=hyperscape-assets

# Database connection (automatically set by postgres attach)
# Verify with: fly secrets list

# Redis connection
fly secrets set REDIS_URL=redis://default:password@fly-redis-xxx.upstash.io

# AI Service API Keys
fly secrets set \
  OPENAI_API_KEY=sk-xxx \
  MESHY_API_KEY=msy_xxx \
  ELEVENLABS_API_KEY=sk_xxx

# Optional: Privy Authentication
fly secrets set VITE_PUBLIC_PRIVY_APP_ID=your_privy_app_id

# Optional: CDN URL (if using external CDN)
fly secrets set PUBLIC_CDN_URL=https://your-cdn-domain.com
```

### 2. Configure fly.toml

The `fly.toml` file is already configured. Review and adjust if needed:

```toml
app = "asset-forge"
primary_region = "sjc"  # Change to your region

[build]
  [build.args]
    NODE_VERSION = "22"

[env]
  NODE_ENV = "production"
  API_PORT = "3004"
  PORT = "8080"

[[mounts]]
  source = "asset_storage"
  destination = "/app/gdd-assets"
  initial_size = "10gb"

# ... rest of config
```

---

## Database Setup

### 1. Enable pgvector Extension

```bash
# Connect to database
fly postgres connect -a asset-forge-db

# In psql prompt:
CREATE EXTENSION IF NOT EXISTS vector;

# Verify
SELECT extversion FROM pg_extension WHERE extname = 'vector';

# Exit
\q
```

### 2. Run Database Migrations

```bash
# Install dependencies first
npm install

# Run migrations (create tables)
# TODO: Add migration command once drizzle-kit is configured
# npm run db:migrate
```

**For now, manually create tables:**

```bash
# Connect to database
fly postgres connect -a asset-forge-db

# Copy and paste SQL from server/db/schema.mjs
# (Convert Drizzle schema to SQL or use drizzle-kit push)
```

---

## Asset Migration

### 1. Sync Local Assets to Tigris

First, set up local environment variables for the sync script:

```bash
# Create .env file in packages/asset-forge/
cat > .env << EOF
AWS_ACCESS_KEY_ID=tid_xxx
AWS_SECRET_ACCESS_KEY=tsec_xxx
AWS_ENDPOINT_URL_S3=https://fly.storage.tigris.dev
BUCKET_NAME=hyperscape-assets
PUBLIC_CDN_URL=https://your-cdn-domain.com  # Optional
EOF
```

### 2. Run Sync Script

```bash
# Dry run first (see what will be uploaded)
node scripts/sync-to-tigris.mjs --dry-run

# Upload all assets
node scripts/sync-to-tigris.mjs

# Or upload specific prefix
node scripts/sync-to-tigris.mjs --prefix=models/sword-

# Force re-upload all files
node scripts/sync-to-tigris.mjs --force
```

### 3. Verify Upload

```bash
# List files in bucket
fly storage list --bucket hyperscape-assets

# Or use AWS CLI
aws s3 ls s3://hyperscape-assets/ \
  --endpoint-url https://fly.storage.tigris.dev \
  --profile tigris
```

---

## Deployment

### 1. Deploy Application

```bash
# Deploy to Fly.io
fly deploy

# This will:
# 1. Build Docker image from Dockerfile
# 2. Push image to Fly.io registry
# 3. Create and start VM
# 4. Run health checks
```

### 2. Monitor Deployment

```bash
# Check deployment status
fly status

# View logs
fly logs

# Open app in browser
fly open
```

### 3. Scale (Optional)

```bash
# Scale to multiple machines
fly scale count 2

# Scale VM resources
fly scale vm shared-cpu-2x --memory 512

# Check current scaling
fly scale show
```

---

## Verification

### 1. Test Health Endpoint

```bash
# Test health check
curl https://asset-forge.fly.dev/api/health

# Expected response:
# {
#   "status": "ok",
#   "database": "connected",
#   "redis": "connected",
#   "storage": "connected"
# }
```

### 2. Test Asset Loading

```bash
# Test loading an asset from Tigris/CDN
curl https://your-cdn-domain.com/models/sword-bronze/sword-bronze.glb

# Or direct from Tigris
curl https://hyperscape-assets.fly.storage.tigris.dev/models/sword-bronze/sword-bronze.glb
```

### 3. Test API Endpoints

```bash
# Test asset generation endpoint
curl -X POST https://asset-forge.fly.dev/api/generate \
  -H "Content-Type: application/json" \
  -d '{
    "prompt": "A medieval steel sword",
    "category": "weapon",
    "stylePreset": "realistic"
  }'
```

### 4. Check Database Connection

```bash
# SSH into running machine
fly ssh console

# Inside machine:
node -e "
import db from '/app/server/db/index.mjs';
await db.test();
"
```

---

## Troubleshooting

### Database Connection Issues

```bash
# Check database status
fly postgres status -a asset-forge-db

# Check connection string
fly secrets list | grep DATABASE

# Connect manually
fly postgres connect -a asset-forge-db
```

### Redis Connection Issues

```bash
# Check Redis status
fly redis status -a asset-forge-redis

# Test connection
redis-cli -u $REDIS_URL ping
```

### Storage Issues

```bash
# Check bucket access
fly storage list --bucket hyperscape-assets

# Test upload
echo "test" | fly storage put test.txt --bucket hyperscape-assets

# Test download
fly storage get test.txt --bucket hyperscape-assets
```

### Application Errors

```bash
# View real-time logs
fly logs

# View specific machine logs
fly logs --instance <instance-id>

# SSH into machine
fly ssh console

# Check disk usage
df -h

# Check mounted volume
ls -la /app/gdd-assets
```

### Performance Issues

```bash
# Check metrics
fly dashboard metrics

# Scale up
fly scale vm shared-cpu-2x --memory 1gb

# Add more machines
fly scale count 2

# Check database performance
fly postgres db list -a asset-forge-db
```

---

## Maintenance

### Backup Database

```bash
# Create database snapshot
fly postgres snapshot -a asset-forge-db

# List snapshots
fly postgres snapshots -a asset-forge-db
```

### Update Application

```bash
# Deploy new version
fly deploy

# Rollback if needed
fly releases
fly releases rollback <version>
```

### Monitor Costs

```bash
# Check billing
fly dashboard billing

# View resource usage
fly dashboard metrics
```

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│                         Fly.io Infrastructure                │
├─────────────────────────────────────────────────────────────┤
│                                                               │
│  ┌──────────────┐         ┌──────────────┐                  │
│  │  Asset Forge │◄────────┤  User CDN    │                  │
│  │  Frontend    │         │ (Your Domain)│                  │
│  │  (Vite SPA)  │         └──────────────┘                  │
│  └──────┬───────┘                                            │
│         │                                                     │
│         ▼                                                     │
│  ┌──────────────┐         ┌──────────────┐                  │
│  │  API Server  │◄────────┤  Redis       │                  │
│  │  (Express)   │         │  (Upstash)   │                  │
│  └──────┬───────┘         └──────────────┘                  │
│         │                                                     │
│         ├──────────────────────┬───────────────────┐         │
│         ▼                      ▼                   ▼         │
│  ┌──────────────┐      ┌──────────────┐   ┌──────────────┐ │
│  │  Postgres    │      │  Tigris S3   │   │  OpenAI      │ │
│  │  (pgvector)  │      │  Storage     │   │  Meshy.ai    │ │
│  │              │      │              │   │  ElevenLabs  │ │
│  └──────────────┘      └──────────────┘   └──────────────┘ │
│                                ▲                             │
│                                │                             │
│                         ┌──────┴──────┐                      │
│                         │  CDN Origin │                      │
│                         │  (Pull)     │                      │
│                         └─────────────┘                      │
└─────────────────────────────────────────────────────────────┘
```

---

## Next Steps

After successful deployment:

1. ✅ Configure CDN to pull from Tigris as origin
2. ✅ Set up monitoring and alerts
3. ✅ Configure automatic backups
4. ✅ Set up CI/CD pipeline
5. ✅ Configure custom domain
6. ✅ Enable SSL/TLS
7. ✅ Set up logging aggregation

---

## Support

- Fly.io Docs: https://fly.io/docs
- Tigris Docs: https://www.tigrisdata.com/docs/
- Community: https://community.fly.io

## License

MIT
