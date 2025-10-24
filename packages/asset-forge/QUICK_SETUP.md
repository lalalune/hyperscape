# Asset Forge - Quick Setup Guide

## ✅ Environment Status

Your `.env` file is already configured with:
- ✅ **Tigris S3** - AWS credentials configured
- ✅ **Postgres** - Database URL configured
- ✅ **Privy Auth** - App ID and Secret configured
- ✅ **AI Services** - OpenAI, Meshy, ElevenLabs keys configured
- ⏳ **Redis** - Needs to be created

## 🚀 Next Steps

### 1. Create Redis Instance

```bash
# Login to Fly.io (opens browser)
flyctl auth login

# Create Redis instance
flyctl redis create

# Follow prompts:
# - App name: asset-forge-redis
# - Region: sjc (or your preferred region)
# - Plan: Free tier is fine for development

# Copy the REDIS_URL from the output
# Example: redis://default:xxxxx@fly-redis-xxx.upstash.io
```

### 2. Add Redis URL to .env

Edit `packages/asset-forge/.env` and uncomment/update the Redis URL:

```bash
# Change this:
# REDIS_URL="redis://default:password@fly-redis-xxx.upstash.io"

# To this (with your actual URL):
REDIS_URL="redis://default:your-password@fly-redis-xxx.upstash.io"
```

### 3. Test the Server

```bash
cd packages/asset-forge

# Start the API server
npm run dev:api

# Should see:
# ✅ Privy authentication initialized
# ✅ Voice services initialized
# ✅ API Server running on http://localhost:5555
```

### 4. Test Infrastructure

```bash
# Health check
curl http://localhost:5555/api/health

# Should return:
# {"status":"healthy","timestamp":"...","services":{"meshy":true,"openai":true,"elevenlabs":true}}
```

## 📊 Current Environment Variables

Your `.env` has:
- `DATABASE_URL` - ✅ Configured
- `AWS_ACCESS_KEY_ID` - ✅ Configured
- `AWS_SECRET_ACCESS_KEY` - ✅ Configured
- `AWS_ENDPOINT_URL_S3` - ✅ Configured
- `BUCKET_NAME` - ✅ Configured
- `PRIVY_APP_ID` - ✅ Configured
- `PRIVY_APP_SECRET` - ✅ Configured
- `OPENAI_API_KEY` - ✅ Configured
- `MESHY_API_KEY` - ✅ Configured
- `ELEVENLABS_API_KEY` - ✅ Configured
- `REDIS_URL` - ⏳ Pending (add after `flyctl redis create`)

## 🗄️ Database Setup (Optional)

If you want to use the full database features:

```bash
# Install Fly.io Postgres CLI tools
brew install postgresql

# Connect to database
flyctl postgres connect -a <your-postgres-app-name>

# Enable pgvector extension
CREATE EXTENSION IF NOT EXISTS vector;

# Verify
SELECT extversion FROM pg_extension WHERE extname = 'vector';
```

## 📦 Sync Assets to Tigris (Optional)

Once Redis is set up, you can sync local assets to Tigris:

```bash
# Dry run to see what will upload
node scripts/sync-to-tigris.mjs --dry-run

# Upload assets
node scripts/sync-to-tigris.mjs

# Upload specific category
node scripts/sync-to-tigris.mjs --prefix=models/sword-
```

## 🔥 Deployment to Fly.io

Full deployment guide: See [FLY_IO_DEPLOYMENT.md](FLY_IO_DEPLOYMENT.md)

Quick deploy:
```bash
# From packages/asset-forge/
flyctl deploy
```

## ✅ Verification Checklist

- [x] Fly CLI installed and in PATH
- [x] All AI service keys configured
- [x] Tigris S3 credentials configured
- [x] Postgres database URL configured
- [x] Privy authentication configured
- [ ] Redis created and URL added to .env
- [ ] Server starts without errors
- [ ] Health check returns success

## 🆘 Troubleshooting

### Fly CLI not found
```bash
# Reload shell
source ~/.zshrc

# Or use full path
/Users/home/.fly/bin/flyctl version
```

### Redis connection fails
- Make sure REDIS_URL is uncommented in .env
- Check Redis is running: `flyctl redis status`
- Server will still work without Redis (graceful degradation)

### Database connection fails
- Check DATABASE_URL in .env
- Verify Postgres is running: `flyctl postgres status`
- Use direct connection for migrations (DATABASE_URL_DIRECT)

---

**Status:** Almost ready! Just need to create Redis and add the URL to `.env`

Next command to run:
```bash
flyctl auth login && flyctl redis create
```
