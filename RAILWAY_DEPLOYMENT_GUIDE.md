# Railway Deployment Guide

## 🚀 Current Deployment

### Services
- **Frontend (asset-forge)**: `frontend-production-f53f.up.railway.app`
- **Backend (API)**: `striking-forgiveness-production.up.railway.app`
- **Database**: PostgreSQL (auto-provisioned by Railway)

---

## 📋 Step-by-Step Setup

### 1. Database Schema Initialization

The database schema needs to be initialized **once** when you first deploy:

```bash
# Connect to your API service in Railway
cd apps/api

# Run the database setup script
railway run node scripts/setup-railway-database.mjs
```

This script will:
- ✅ Test database connection
- ✅ Check for existing schema
- ✅ Apply the complete schema from `apps/api/database/schema.sql`
- ✅ Verify all tables were created
- ✅ Show database statistics

**Tables Created:**
- `users` - User accounts and authentication
- `teams` & `team_members` - Team collaboration
- `preview_manifests` - Working manifests for users/teams
- `manifest_submissions` - Submitted items for approval
- `api_keys` - User API keys for external services
- `admin_whitelist` - Admin access control
- `npcs`, `quests`, `lore_entries` - Game content
- `voice_generations`, `voice_manifests` - Voice generation
- And many more...

---

### 2. Backend (API) Environment Variables

Go to **Railway Dashboard** → **striking-forgiveness-production** → **Variables**

```bash
# =====================================================
# REQUIRED: Server Configuration
# =====================================================
NODE_ENV=production
PORT=3004

# Frontend URL (for CORS)
FRONTEND_URL=https://frontend-production-f53f.up.railway.app

# Image Server URL (for Meshy.ai callbacks)
IMAGE_SERVER_URL=https://striking-forgiveness-production.up.railway.app

# =====================================================
# DATABASE (Auto-configured by Railway)
# =====================================================
# Railway automatically provides DATABASE_URL when you attach PostgreSQL
# No action needed - Railway injects this automatically

# =====================================================
# REQUIRED: AI Provider Keys
# =====================================================
OPENAI_API_KEY=sk-proj-...
MESHY_API_KEY=msy_...
ELEVENLABS_API_KEY=sk_...

# =====================================================
# REQUIRED: Authentication
# =====================================================
PRIVY_APP_ID=cmh5ag8yp004hl80drzj9i0g8
PRIVY_APP_SECRET=5H55iFZ3g2hEKP5EvTok5LZdJnfhGu1UXo3uAiGBBXLbAeaXvJ1edUEFKgNaDYWBcxfSqqc2XnPuz8iU3gjbFbw9

# =====================================================
# OPTIONAL: Additional AI Providers
# =====================================================
AI_GATEWAY_API_KEY=vck_...
ANTHROPIC_API_KEY=
OPENROUTER_API_KEY=sk-or-v1-...

# =====================================================
# OPTIONAL: Storage (Vercel Blob)
# =====================================================
BLOB_READ_WRITE_TOKEN=vercel_blob_rw_...

# =====================================================
# Meshy Configuration
# =====================================================
MESHY_POLL_INTERVAL_MS=5000
MESHY_TIMEOUT_MS=900000
MESHY_TIMEOUT_STANDARD_MS=600000
MESHY_TIMEOUT_HIGH_MS=1200000
MESHY_TIMEOUT_ULTRA_MS=1800000
MESHY_MODEL_STANDARD=meshy-5
MESHY_MODEL_HIGH=meshy-5
MESHY_MODEL_ULTRA=meshy-5
MESHY_MODEL_DEFAULT=meshy-5

# =====================================================
# Security
# =====================================================
JWT_SECRET=hyper
ENCRYPTION_KEY=L64o6TdnGxHCgTQzAUFsF+WElRimsNOYun4ijIyL0U0=

# =====================================================
# Feature Flags
# =====================================================
ENABLE_GPT4_ENHANCEMENT=true
ENABLE_RETEXTURING=true
ENABLE_RIGGING=true
```

---

### 3. Frontend (asset-forge) Environment Variables

Go to **Railway Dashboard** → **frontend-production-f53f** → **Variables**

**CRITICAL**: The frontend must point to the correct backend URL!

```bash
# =====================================================
# REQUIRED: API Connection
# =====================================================
VITE_API_URL=https://striking-forgiveness-production.up.railway.app
VITE_CDN_URL=https://striking-forgiveness-production.up.railway.app

# =====================================================
# REQUIRED: Authentication
# =====================================================
VITE_PUBLIC_PRIVY_APP_ID=cmh5ag8yp004hl80drzj9i0g8

# =====================================================
# OPTIONAL: AI Provider Keys (for client-side features)
# =====================================================
OPENAI_API_KEY=sk-proj-...
ANTHROPIC_API_KEY=
MESHY_API_KEY=msy_...
ELEVENLABS_API_KEY=sk_...

# =====================================================
# OPTIONAL: Vercel Integration
# =====================================================
BLOB_READ_WRITE_TOKEN=vercel_blob_rw_...
AI_GATEWAY_API_KEY=vck_...
```

---

## 🔧 Fixing the Connection Issue

### Problem
Your `apps/asset-forge/.env.local` currently has:
```bash
VITE_API_URL="https://dairy-queen-production.up.railway.app"
```

But the actual backend is at:
```bash
https://striking-forgiveness-production.up.railway.app
```

### Solution

**Option 1: Update Railway Variables (Recommended)**
1. Go to Railway Dashboard → frontend-production-f53f → Variables
2. Find `VITE_API_URL`
3. Change to: `https://striking-forgiveness-production.up.railway.app`
4. Redeploy the frontend service

**Option 2: Update Local .env and Push**
1. Edit `apps/asset-forge/.env.local`:
   ```bash
   VITE_API_URL="https://striking-forgiveness-production.up.railway.app"
   VITE_CDN_URL="https://striking-forgiveness-production.up.railway.app"
   ```
2. Commit and push to trigger Railway auto-deploy

---

## 🗄️ Database Operations

### Initialize Schema (First Time Only)
```bash
cd apps/api
railway run node scripts/setup-railway-database.mjs
```

### Run Migrations (After Schema Exists)
```bash
railway run node server/scripts/migrate-manifests-to-postgres.mjs
```

### View Database Tables
```bash
railway run psql $DATABASE_URL -c "\dt"
```

### Check Table Contents
```bash
# Check preview_manifests
railway run psql $DATABASE_URL -c "SELECT manifest_type, jsonb_array_length(content) as items FROM preview_manifests"

# Check users
railway run psql $DATABASE_URL -c "SELECT id, privy_user_id, email, role FROM users"
```

### Connect to Database Directly
```bash
railway run psql $DATABASE_URL
```

---

## 🧪 Testing the Deployment

### 1. Test Backend Health
```bash
curl https://striking-forgiveness-production.up.railway.app/api/health
```

Expected response:
```json
{
  "status": "ok",
  "timestamp": "2025-01-28T10:30:00.000Z"
}
```

### 2. Test Database Connection
```bash
curl https://striking-forgiveness-production.up.railway.app/api/manifests
```

Should return list of available manifest types.

### 3. Test Frontend
Visit: `https://frontend-production-f53f.up.railway.app`

Check browser console for:
- ✅ No CORS errors
- ✅ Successful API requests to `striking-forgiveness-production.up.railway.app`
- ✅ Authentication working

---

## 🐛 Troubleshooting

### Issue: "Cannot find package 'elevenlabs'"
**Status**: ✅ **FIXED** - Updated imports to `@elevenlabs/elevenlabs-js`

Files fixed:
- `apps/api/server/services/MusicService.mjs:16`
- `apps/api/server/services/SoundEffectsService.mjs:17`
- `apps/api/server/services/VoiceGenerationService.mjs:15`

### Issue: Frontend can't connect to backend
**Cause**: Wrong `VITE_API_URL` in environment variables

**Fix**:
1. Update Railway frontend variables
2. Set `VITE_API_URL=https://striking-forgiveness-production.up.railway.app`
3. Redeploy

### Issue: Database schema missing
**Fix**:
```bash
railway run node scripts/setup-railway-database.mjs
```

### Issue: CORS errors
**Fix**: Ensure backend has correct `FRONTEND_URL`:
```bash
FRONTEND_URL=https://frontend-production-f53f.up.railway.app
```

---

## 📝 Deployment Checklist

- [ ] PostgreSQL service attached to API in Railway
- [ ] Database schema initialized (`setup-railway-database.mjs`)
- [ ] Backend environment variables configured
- [ ] Frontend environment variables configured
- [ ] `VITE_API_URL` points to correct backend URL
- [ ] API keys added (OpenAI, Meshy, ElevenLabs, Privy)
- [ ] CORS configured with frontend URL
- [ ] Health check endpoint working
- [ ] Manifests migration run
- [ ] Frontend can connect to backend
- [ ] Authentication working

---

## 🔄 Updating After Changes

### Backend Code Changes
```bash
# Commit changes
git add .
git commit -m "fix: update service imports"

# Push to trigger Railway deploy
git push origin main
```

### Frontend Code Changes
Same as above - Railway auto-deploys on push.

### Environment Variable Changes
1. Update in Railway Dashboard → Variables
2. Service automatically restarts

---

## 📊 Monitoring

### View Logs
```bash
# Backend logs
railway logs --service striking-forgiveness-production

# Frontend logs
railway logs --service frontend-production-f53f
```

### Check Database Size
```bash
railway run psql $DATABASE_URL -c "
SELECT
  pg_size_pretty(pg_database_size(current_database())) as size,
  (SELECT count(*) FROM preview_manifests) as manifests,
  (SELECT count(*) FROM users) as users
"
```

---

## 🎯 Next Steps

1. **Initialize Database Schema**
   ```bash
   railway run node scripts/setup-railway-database.mjs
   ```

2. **Update Frontend Variables**
   - Set `VITE_API_URL` to backend URL
   - Redeploy frontend

3. **Run Migrations**
   ```bash
   railway run node server/scripts/migrate-manifests-to-postgres.mjs
   ```

4. **Test Everything**
   - Visit frontend URL
   - Check browser console
   - Test API endpoints
   - Verify authentication

---

## 🆘 Getting Help

If deployment fails:
1. Check Railway logs: `railway logs`
2. Verify environment variables are set
3. Test database connection
4. Check API health endpoint
5. Review browser console for errors

**Common Issues:**
- Missing `DATABASE_URL` → Attach PostgreSQL service
- CORS errors → Check `FRONTEND_URL` in backend
- 404 on API calls → Wrong `VITE_API_URL` in frontend
- Import errors → Check package.json dependencies
