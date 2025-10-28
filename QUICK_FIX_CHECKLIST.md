# 🚀 Quick Fix Checklist for Railway Deployment

## ✅ Issues Fixed

1. **ElevenLabs Import Error** - FIXED ✅
   - Changed `import { ElevenLabsClient } from 'elevenlabs'`
   - To: `import { ElevenLabsClient } from '@elevenlabs/elevenlabs-js'`
   - Files updated:
     - `apps/api/server/services/MusicService.mjs:16`
     - `apps/api/server/services/SoundEffectsService.mjs:17`
     - `apps/api/server/services/VoiceGenerationService.mjs:15`

## 🔧 Required Actions

### 1. Initialize Database Schema (⚠️ CRITICAL)

Your Railway PostgreSQL database needs the schema initialized:

```bash
# Connect to API service
cd apps/api

# Run setup script (only needed ONCE)
railway run node scripts/setup-railway-database.mjs
```

**What this does:**
- Creates all 30+ database tables
- Sets up indexes and foreign keys
- Creates triggers for auto-updating timestamps
- Verifies everything was created correctly

### 2. Fix Frontend → Backend Connection (⚠️ CRITICAL)

Your frontend is pointing to the **wrong backend URL**:

**Current (WRONG):**
```
VITE_API_URL=https://dairy-queen-production.up.railway.app
```

**Should be:**
```
VITE_API_URL=https://striking-forgiveness-production.up.railway.app
```

**How to fix:**

#### Option A: Railway Dashboard (Recommended)
1. Go to: Railway Dashboard → `frontend-production-f53f` → Variables
2. Find: `VITE_API_URL`
3. Change to: `https://striking-forgiveness-production.up.railway.app`
4. Also update: `VITE_CDN_URL` to same URL
5. Click "Redeploy"

#### Option B: Update .env file and push
1. Edit `apps/asset-forge/.env.local`:
   ```bash
   VITE_API_URL="https://striking-forgiveness-production.up.railway.app"
   VITE_CDN_URL="https://striking-forgiveness-production.up.railway.app"
   ```
2. Commit and push:
   ```bash
   git add apps/asset-forge/.env.local
   git commit -m "fix: update API URL to correct backend"
   git push origin main
   ```

### 3. Verify Backend Environment Variables

Check Railway → `striking-forgiveness-production` → Variables has:

**Required:**
```bash
DATABASE_URL                    # Auto-injected by Railway
FRONTEND_URL=https://frontend-production-f53f.up.railway.app
OPENAI_API_KEY=sk-proj-...
MESHY_API_KEY=msy_...
ELEVENLABS_API_KEY=sk_...
PRIVY_APP_ID=cmh5ag8yp004hl80drzj9i0g8
PRIVY_APP_SECRET=5H55iFZ3g2hEKP5...
```

---

## 🧪 Testing

### After Database Initialization

```bash
# Test database connection and schema
railway run node scripts/test-railway-connection.mjs
```

Expected output:
```
✅ Connected to: railway
✅ Found 30+ tables
✅ users
✅ preview_manifests
✅ manifest_submissions
✅ teams
✅ api_keys
```

### After Fixing Frontend URL

1. Visit: `https://frontend-production-f53f.up.railway.app`
2. Open browser console (F12)
3. Check for:
   - ✅ No CORS errors
   - ✅ API requests going to `striking-forgiveness-production.up.railway.app`
   - ✅ Responses coming back successfully

### Test Backend Directly

```bash
# Health check
curl https://striking-forgiveness-production.up.railway.app/api/health

# Should return:
# {"status":"ok","timestamp":"2025-01-28T..."}
```

---

## 📝 Complete Deployment Steps

### 1️⃣ Database Setup (ONE TIME)
```bash
railway run node scripts/setup-railway-database.mjs
```

### 2️⃣ Run Migrations (AFTER SCHEMA)
```bash
railway run node server/scripts/migrate-manifests-to-postgres.mjs
```

### 3️⃣ Update Frontend Variables
- Set `VITE_API_URL` to backend URL in Railway dashboard
- Redeploy frontend

### 4️⃣ Push Fixed Code
```bash
git add .
git commit -m "fix: correct ElevenLabs imports"
git push origin main
```

### 5️⃣ Verify Everything
```bash
# Backend logs
railway logs --service striking-forgiveness-production

# Frontend logs
railway logs --service frontend-production-f53f

# Test database
railway run node scripts/test-railway-connection.mjs
```

---

## 🚨 Quick Troubleshooting

| Problem | Solution |
|---------|----------|
| "Cannot find package 'elevenlabs'" | Fixed! Push code to deploy |
| Frontend 404 errors | Update `VITE_API_URL` in frontend variables |
| CORS errors | Set `FRONTEND_URL` in backend variables |
| Database errors | Run `setup-railway-database.mjs` |
| "Table doesn't exist" | Run database setup script |

---

## 📚 Full Documentation

See `RAILWAY_DEPLOYMENT_GUIDE.md` for complete details.

---

## ✅ Final Checklist

- [ ] Database schema initialized
- [ ] Test script passes (`test-railway-connection.mjs`)
- [ ] Frontend `VITE_API_URL` points to correct backend
- [ ] Backend `FRONTEND_URL` points to correct frontend
- [ ] Code pushed and deployed
- [ ] Frontend loads without errors
- [ ] API requests succeed
- [ ] Authentication working

---

## 🎯 Quick Commands Reference

```bash
# Initialize database schema (first time only)
railway run node scripts/setup-railway-database.mjs

# Test database connection
railway run node scripts/test-railway-connection.mjs

# Migrate manifests to database
railway run node server/scripts/migrate-manifests-to-postgres.mjs

# View logs
railway logs

# Check database
railway run psql $DATABASE_URL -c "\dt"

# Deploy changes
git push origin main
```

---

**Current Status:**
- ✅ ElevenLabs import errors fixed
- ⚠️ Database schema needs initialization
- ⚠️ Frontend URL needs updating

**Next Action:**
Run the database setup script!
