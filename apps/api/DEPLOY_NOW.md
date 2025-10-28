# Deploy Asset Forge API to Railway - Quick Guide

Your Railway project is **already created**:
- **Project:** asset-forge-api
- **URL:** https://railway.com/project/9b2d2d33-417d-48ae-8ced-781c62f003b6

## ⚡ Quick Deploy (5 minutes)

### Option 1: Use Railway Dashboard (Easiest)

1. **Open your project:** https://railway.com/project/9b2d2d33-417d-48ae-8ced-781c62f003b6

2. **Add PostgreSQL:**
   - Click "+ New" button
   - Select "Database" → "PostgreSQL"
   - Wait ~30 seconds for provisioning

3. **Add API Service:**
   - Click "+ New" button
   - Select "GitHub Repo" or "Empty Service"
   - If GitHub: Select your repository, set root directory to `apps/api`
   - If Empty: We'll deploy via CLI

4. **Set Environment Variables:**
   - Click on your API service
   - Go to "Variables" tab
   - Click "Raw Editor"
   - Paste this (replace with your actual values):

```env
NODE_ENV=production
PORT=3004
FRONTEND_URL=http://localhost:3000
OPENAI_API_KEY=YOUR_OPENAI_API_KEY_HERE
MESHY_API_KEY=YOUR_MESHY_API_KEY_HERE
PRIVY_APP_ID=YOUR_PRIVY_APP_ID_HERE
PRIVY_APP_SECRET=YOUR_PRIVY_APP_SECRET_HERE
OPENROUTER_API_KEY=YOUR_OPENROUTER_API_KEY_HERE
MESHY_POLL_INTERVAL_MS=5000
MESHY_TIMEOUT_MS=300000
MESHY_MODEL_DEFAULT=meshy-5
ENABLE_GPT4_ENHANCEMENT=true
ENABLE_RETEXTURING=true
ENABLE_RIGGING=true
DEBUG=false
LOG_LEVEL=info
```

5. **Deploy:**
   - If GitHub: Push to main branch (auto-deploys)
   - If CLI: See Option 2 below

---

### Option 2: Use CLI (From Terminal)

Since your Railway project is initialized, complete these steps:

```bash
cd /Users/home/hyperscape-4/apps/api

# 1. Add PostgreSQL (interactive - will prompt you)
railway add
# Select: Database → PostgreSQL

# 2. Deploy the app
railway up

# 3. Enable pgvector extension
railway run psql '$DATABASE_URL' -c "CREATE EXTENSION IF NOT EXISTS vector;"

# 4. Run migrations
railway run npm run migrate:manifests
railway run npm run seed:manifests

# 5. Get your app URL
railway domain

# 6. Test it
curl https://$(railway domain)/api/health
```

---

### Option 3: Use the Deploy Script

I created a script for you:

```bash
cd /Users/home/hyperscape-4/apps/api
./deploy-railway.sh
```

This will walk you through the process step-by-step.

---

## 🔧 After Deployment

### 1. Enable pgvector Extension

```bash
railway run psql '$DATABASE_URL' -c "CREATE EXTENSION IF NOT EXISTS vector;"
```

### 2. Run Database Migrations

```bash
railway run npm run migrate:manifests
railway run npm run seed:manifests
```

### 3. Get Your API URL

```bash
railway domain
```

### 4. Test Your API

```bash
# Get your domain first
RAILWAY_DOMAIN=$(railway domain)

# Test health endpoint
curl https://$RAILWAY_DOMAIN/api/health

# Should return:
# {"status":"healthy","timestamp":"...","uptime":...,"environment":"production"}
```

### 5. Update Frontend URL

Update your environment variable with the actual frontend URL:

```bash
railway variables set FRONTEND_URL=https://your-frontend-domain.com
```

### 6. View Logs

```bash
# Live logs
railway logs -f

# Or in dashboard
# https://railway.com/project/9b2d2d33-417d-48ae-8ced-781c62f003b6
```

---

## ⚠️ Important Notes

1. **DATABASE_URL** is automatically set by Railway when you add PostgreSQL
2. **Don't commit** your `.env` file - use Railway environment variables
3. **Update FRONTEND_URL** with your actual frontend domain
4. **Generate domain** in Railway dashboard → Settings → Domains
5. **Custom domain** can be added after deployment

---

## 📊 What's Deployed

- **Hono API Server** on Node.js 22.x
- **PostgreSQL** with pgvector extension
- **41 API endpoints** fully operational
- **Auto-SSL** with Railway domain
- **Environment variables** from Railway dashboard

---

## 🐛 Troubleshooting

### Build Fails
```bash
railway logs
```

### Database Connection Issues
```bash
# Check if PostgreSQL is running
railway status

# Verify DATABASE_URL is set
railway variables
```

### Can't Access API
```bash
# Get deployment URL
railway domain

# Check if service is running
railway status
```

---

## 📞 Need Help?

- **Railway Dashboard:** https://railway.com/project/9b2d2d33-417d-48ae-8ced-781c62f003b6
- **Railway Docs:** https://docs.railway.app
- **Railway Discord:** https://discord.gg/railway
- **Deployment Checklist:** See `DEPLOYMENT_CHECKLIST.md`

---

## ✅ Success Checklist

- [ ] PostgreSQL added to project
- [ ] All environment variables set
- [ ] App deployed successfully
- [ ] pgvector extension enabled
- [ ] Migrations completed
- [ ] Health endpoint returns 200 OK
- [ ] Frontend URL updated
- [ ] Domain configured (optional)

**Your project is ready to deploy! Choose an option above and get started.** 🚀
