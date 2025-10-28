# Asset Forge API - Deployment Guide

## 🚀 Recommended Deployment: Railway.app

This guide walks you through deploying the Asset Forge API to Railway with PostgreSQL.

## Prerequisites

- Railway account: https://railway.app
- GitHub repository (for auto-deployment)
- Environment variables from `.env`

## Quick Start (Railway CLI)

### 1. Install Railway CLI

```bash
npm install -g @railway/cli
# or
brew install railway
```

### 2. Login to Railway

```bash
railway login
```

### 3. Initialize Project

```bash
# From the apps/api directory
cd apps/api
railway init
```

Select "Create new project" when prompted.

### 4. Add PostgreSQL Database

```bash
railway add --database postgresql
```

This provisions a PostgreSQL instance with automatic connection string.

### 5. Enable pgvector Extension

```bash
# Connect to Railway PostgreSQL
railway run psql $DATABASE_URL

# In psql:
CREATE EXTENSION IF NOT EXISTS vector;
\q
```

### 6. Set Environment Variables

```bash
# Set each variable from your .env file
railway variables set NODE_ENV=production
railway variables set PORT=3004
railway variables set FRONTEND_URL=https://your-frontend-url.com
railway variables set OPENAI_API_KEY=sk-proj-...
railway variables set MESHY_API_KEY=msy_...
railway variables set ELEVENLABS_API_KEY=...
railway variables set PRIVY_APP_ID=...
railway variables set PRIVY_APP_SECRET=...

# Database URL is automatically set by Railway
# Available as ${{Postgres.DATABASE_URL}}
```

### 7. Deploy

```bash
railway up
```

Your API will be deployed and accessible at a Railway-provided domain.

### 8. Run Database Migrations

```bash
# After first deployment
railway run npm run migrate:manifests
railway run npm run seed:manifests
```

## Alternative: GitHub Integration

### 1. Connect Repository

1. Go to Railway Dashboard: https://railway.app/dashboard
2. Click "New Project" → "Deploy from GitHub repo"
3. Select your repository
4. Choose `apps/api` as the root directory

### 2. Configure Build

Railway auto-detects Node.js and uses:
- **Build Command:** `npm install`
- **Start Command:** `npm start` (runs `node server/api.mjs`)

### 3. Add PostgreSQL

1. In your project, click "+ New"
2. Select "Database" → "PostgreSQL"
3. Railway automatically connects it

### 4. Set Environment Variables

In Railway Dashboard → Variables tab, add all environment variables from `.env`.

Database URL will be available as `${{Postgres.DATABASE_URL}}`.

### 5. Deploy

Push to your main branch - Railway auto-deploys on every commit.

## Database Configuration

### Connection String Format

Railway provides `DATABASE_URL` in this format:
```
postgresql://user:password@host:port/database
```

Update `server/database/db.mjs` to use `DATABASE_URL` if provided:

```javascript
const connectionString = process.env.DATABASE_URL ||
  `postgresql://${process.env.DB_USER}:${process.env.DB_PASSWORD}@${process.env.DB_HOST}:${process.env.DB_PORT}/${process.env.DB_NAME}`
```

### Enable pgvector

Connect to your database and enable the extension:

```bash
railway run psql $DATABASE_URL -c "CREATE EXTENSION IF NOT EXISTS vector;"
```

## File Storage Options

### Option 1: Railway Volumes (Simple)

For persistent file storage on Railway:

1. Add a volume in Railway Dashboard
2. Mount at `/app/storage`
3. Update paths in code:

```javascript
const STORAGE_BASE = process.env.RAILWAY_VOLUME_MOUNT_PATH || './storage'
const ASSETS_DIR = path.join(STORAGE_BASE, 'assets')
const TEMP_DIR = path.join(STORAGE_BASE, 'temp')
```

**Pricing:** $0.25/GB/month

**Limitations:**
- Files deleted on redeploy without volume
- Single deployment per volume (no horizontal scaling)
- Small downtime on redeploys

### Option 2: Cloudflare R2 (Recommended for Scale)

For scalable, zero-egress storage:

1. Create R2 bucket at https://dash.cloudflare.com/
2. Generate R2 API tokens
3. Add environment variables:

```bash
railway variables set R2_ACCOUNT_ID=...
railway variables set R2_ACCESS_KEY_ID=...
railway variables set R2_SECRET_ACCESS_KEY=...
railway variables set R2_BUCKET_NAME=asset-forge-assets
railway variables set R2_PUBLIC_URL=https://pub-xxxxx.r2.dev
```

4. Install S3 client:

```bash
npm install @aws-sdk/client-s3
```

See `docs/R2_INTEGRATION.md` for implementation details.

## Custom Domain

1. Go to Railway Dashboard → Settings
2. Click "Generate Domain" for a Railway subdomain
3. Or add your custom domain:
   - Add CNAME record: `api.yourdomain.com` → `your-project.railway.app`
   - Add domain in Railway settings
   - Railway automatically provisions SSL

## Environment Variables Reference

### Required

```env
NODE_ENV=production
PORT=3004
FRONTEND_URL=https://your-frontend.vercel.app
OPENAI_API_KEY=sk-proj-...
MESHY_API_KEY=msy_...
PRIVY_APP_ID=...
PRIVY_APP_SECRET=...
```

### Database (Auto-configured)

```env
DATABASE_URL=${{Postgres.DATABASE_URL}}
```

Or manually:
```env
DB_HOST=${{Postgres.HOST}}
DB_PORT=${{Postgres.PORT}}
DB_NAME=${{Postgres.DATABASE}}
DB_USER=${{Postgres.USER}}
DB_PASSWORD=${{Postgres.PASSWORD}}
```

### Optional

```env
ELEVENLABS_API_KEY=...
ANTHROPIC_API_KEY=...
OPENROUTER_API_KEY=...
AI_GATEWAY_API_KEY=...
IMAGE_SERVER_URL=https://your-api.railway.app
DEBUG=false
LOG_LEVEL=info
```

## Monitoring & Logs

### View Logs

```bash
# Live logs
railway logs

# Follow logs
railway logs -f
```

Or view in Railway Dashboard → Deployments → Logs

### Monitor Resources

Railway Dashboard shows:
- CPU usage
- Memory usage
- Network traffic
- Database connections

## Troubleshooting

### Build Fails

Check `nixpacks.toml` or `railway.json` configuration. Railway uses Nixpacks to detect Node.js automatically.

### Database Connection Error

Verify:
1. PostgreSQL service is running
2. `DATABASE_URL` environment variable is set
3. pgvector extension is enabled
4. Network access is allowed

### Static Files Not Serving

Check:
1. Files exist in deployment
2. Paths are correct (use absolute paths)
3. Railway volumes are properly mounted

### Out of Memory

Upgrade Railway plan or optimize:
- Reduce concurrent connections
- Implement caching
- Use connection pooling

## Costs

### Railway Pricing (2025)

- **Starter Plan:** $5/month
  - 512MB RAM, 1GB storage
  - $0.000231/GB-hour for additional resources

- **Pro Plan:** $20/month
  - Higher limits, priority support

- **PostgreSQL:** Included in resource usage
- **Volumes:** $0.25/GB/month
- **Bandwidth:** First 100GB free, then $0.10/GB

### Estimated Monthly Cost

- **Small project:** $5-20/month (Starter + database)
- **Medium project:** $20-50/month (Pro + database + volumes)
- **Large project:** $50-100/month (Pro + R2 storage + high traffic)

## Next Steps

1. Deploy to Railway using one of the methods above
2. Run database migrations
3. Test all API endpoints
4. Update frontend `VITE_API_URL`
5. Configure custom domain (optional)
6. Set up monitoring/alerting
7. Consider migrating to R2 storage for scale

## Support

- Railway Docs: https://docs.railway.app
- Railway Discord: https://discord.gg/railway
- Asset Forge Issues: (your repo issues link)
