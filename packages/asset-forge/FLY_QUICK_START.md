# Asset Forge - Fly.io Quick Start

**⏱️ Get deployed in 15-20 minutes**

This is a condensed version of the full deployment guide. For detailed instructions, see [FLY_DEPLOYMENT_CHECKLIST.md](FLY_DEPLOYMENT_CHECKLIST.md).

## Prerequisites

- Fly.io account: https://fly.io/app/sign-up
- OpenAI API key: https://platform.openai.com/api-keys
- Meshy.ai API key: https://www.meshy.ai/

## Quick Deployment

### 1. Install Fly.io CLI

```bash
curl -L https://fly.io/install.sh | sh
fly auth login
```

### 2. Setup Environment

```bash
cd packages/asset-forge

# Copy and configure .env
cp .env.example .env

# Generate secrets
echo "JWT_SECRET=$(openssl rand -base64 32)" >> .env
echo "ENCRYPTION_KEY=$(openssl rand -base64 32)" >> .env

# Edit .env and add:
# - OPENAI_API_KEY=sk-...
# - MESHY_API_KEY=msy_...
# - ELEVENLABS_API_KEY=sk_... (optional)
```

### 3. Create Infrastructure (One Command Each)

```bash
# Create app
fly apps create asset-forge

# Create Tigris S3
fly storage create
# Save the credentials shown!

# Create Postgres
fly postgres create
# App name: asset-forge-db
# Region: same as your app
# VM: shared-cpu-1x (256MB)
# Volume: 10GB

# Attach database
fly postgres attach asset-forge-db --app asset-forge

# Enable pgvector
fly postgres connect -a asset-forge-db
# In psql: CREATE EXTENSION IF NOT EXISTS vector;
# Then: \q

# Create Redis
fly redis create
# App name: asset-forge-redis
# Region: same as your app
# Save the REDIS_URL shown!
```

### 4. Set Secrets (Automated)

```bash
# Update .env with Tigris credentials from step 3
# Update .env with Redis URL from step 3

# Run automated setup
chmod +x scripts/fly-setup-secrets.sh
./scripts/fly-setup-secrets.sh
```

**OR manually:**

```bash
fly secrets set \
  OPENAI_API_KEY="sk-..." \
  MESHY_API_KEY="msy_..." \
  JWT_SECRET="<from .env>" \
  ENCRYPTION_KEY="<from .env>" \
  AWS_ACCESS_KEY_ID="tid_..." \
  AWS_SECRET_ACCESS_KEY="tsec_..." \
  AWS_ENDPOINT_URL_S3="https://fly.storage.tigris.dev" \
  BUCKET_NAME="your-bucket-name" \
  REDIS_URL="redis://..." \
  --app asset-forge
```

### 5. Run Migrations

```bash
node scripts/migrate-db.mjs
```

### 6. Deploy

```bash
fly deploy
```

### 7. Verify

```bash
# Check status
fly status

# Test health endpoint
curl https://asset-forge.fly.dev/api/health

# View logs
fly logs
```

## ✅ Done!

Your Asset Forge instance is now live at: **https://asset-forge.fly.dev**

## Common Commands

```bash
# View logs
fly logs

# SSH into container
fly ssh console

# Restart app
fly apps restart asset-forge

# Scale resources
fly scale vm shared-cpu-2x --memory 4096

# Update secrets
fly secrets set KEY=value --app asset-forge

# Redeploy
fly deploy
```

## Troubleshooting

### Build fails
```bash
fly logs
# Check for missing dependencies or build errors
```

### Database connection issues
```bash
fly secrets list
# Verify DATABASE_URL is set
```

### Redis connection issues
```bash
fly secrets list | grep REDIS
# Verify REDIS_URL is set correctly
```

### Test infrastructure connections
```bash
# Test Tigris
node scripts/test-tigris-connection.mjs

# Test Redis
node scripts/test-redis.mjs

# Test database
npm run db:test
```

## Next Steps

- ✅ Generate your first asset via the UI
- ✅ Set up monitoring: `fly dashboard`
- ✅ Configure custom domain: `fly certs create yourdomain.com`
- ✅ Set up autoscaling: `fly autoscale set min=1 max=3`
- ✅ Review full docs: [FLY_IO_DEPLOYMENT.md](FLY_IO_DEPLOYMENT.md)

## Support

- **Full Guide**: [FLY_DEPLOYMENT_CHECKLIST.md](FLY_DEPLOYMENT_CHECKLIST.md)
- **Infrastructure**: [INFRASTRUCTURE_SETUP_COMPLETE.md](INFRASTRUCTURE_SETUP_COMPLETE.md)
- **Fly.io Docs**: https://fly.io/docs
