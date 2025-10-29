# Railway Deployment Configuration

## Service Architecture

```
┌─────────────────────┐         ┌──────────────────────┐
│   Asset Forge       │ ───────>│   API Service        │
│   (Frontend)        │ internal│   (Backend)          │
│   Port: 8080        │ network │   Port: 3004         │
└─────────────────────┘         └──────────────────────┘
                                          │
                                          ├─────────────┐
                                          v             v
                                ┌──────────────────┐  ┌──────────────────┐
                                │   PostgreSQL     │  │   Qdrant         │
                                │   (Database)     │  │   (Vector DB)    │
                                │   Port: 5432     │  │   Port: 6333     │
                                └──────────────────┘  └──────────────────┘
```

## Required Environment Variables

### API Service (striking-forgiveness)

**Service Internal Address:** `striking-forgiveness.railway.internal:3004`

Set these in Railway Dashboard → API Service → Variables:

```bash
# Server Configuration
NODE_ENV=production
PORT=3004

# CORS Configuration (allow frontend)
FRONTEND_URL=https://frontend-production-f53f.up.railway.app
ALLOWED_ORIGINS=https://frontend-production-f53f.up.railway.app

# Database (Auto-injected by Railway when PostgreSQL is attached)
# DATABASE_URL=${{Postgres.DATABASE_URL}}

# Qdrant Vector Database (for embeddings and semantic search)
QDRANT_URL=http://qdrant.railway.internal:6333
QDRANT_COLLECTION=game_content

# Required API Keys
OPENAI_API_KEY=sk-proj-your-actual-key
MESHY_API_KEY=msy_your-actual-key
ELEVENLABS_API_KEY=sk_your-actual-key
AI_GATEWAY_API_KEY=vck_your-actual-key

# Privy Authentication
PRIVY_APP_ID=cmhbfhcm1003ml80cu47k4h2m
PRIVY_APP_SECRET=your-privy-secret

# Meshy Configuration
MESHY_POLL_INTERVAL_MS=5000
MESHY_TIMEOUT_MS=300000
MESHY_MODEL_DEFAULT=meshy-5
```

---

### Frontend Service (asset-forge)

**Service Public URL:** `https://frontend-production-f53f.up.railway.app`

Set these in Railway Dashboard → Frontend Service → Variables:

```bash
# Build-time variables (required for Vite)
VITE_PUBLIC_PRIVY_APP_ID=cmhbfhcm1003ml80cu47k4h2m

# API Configuration - USE INTERNAL RAILWAY ADDRESS
VITE_API_URL=http://striking-forgiveness.railway.internal:3004
VITE_CDN_URL=http://striking-forgiveness.railway.internal:3004
VITE_GENERATION_API_URL=http://striking-forgiveness.railway.internal:3004/api

# Runtime configuration
PORT=8080
NODE_ENV=production
```

---

## Deployment Steps

### 1. API Service Deployment

```bash
cd apps/api
railway up
```

### 2. Frontend Service Deployment

```bash
cd apps/asset-forge
railway up
```

### 3. Verify Deployment

**Test API Health:**
```bash
curl https://striking-forgiveness-production.up.railway.app/api/health
```

Expected response:
```json
{
  "status": "healthy",
  "timestamp": "2025-10-29T05:00:00.000Z",
  "uptime": 123.45,
  "environment": "production"
}
```

**Test Frontend:**
```bash
curl https://frontend-production-f53f.up.railway.app
```

Should return the built React app.

---

## Railway Private Networking

Railway's private networking enables fast, secure communication between services within the same project using IPv6-only internal DNS.

### Configuration Requirements

**Server Configuration:**
- ✅ API server listens on `::` (IPv6) in production
- ✅ Supports dual-stack (IPv4 + IPv6) connections
- ✅ Configured automatically via `NODE_ENV=production`

**Internal Service URLs:**
```bash
# Format: servicename.railway.internal
API: http://striking-forgiveness.railway.internal:3004
Qdrant: http://qdrant.railway.internal:6333
Frontend: http://jubilant-mercy.railway.internal:8080
```

### When to use Internal URLs (`*.railway.internal`)
- ✅ Frontend → API communication (within Railway)
- ✅ API → Qdrant communication (embeddings)
- ✅ Service-to-service communication
- ✅ Database connections (auto-configured)

**Benefits:**
- Faster (no external network routing)
- Free (no egress charges)
- More secure (not exposed to internet)
- IPv6-only for optimal performance

### When to use External URLs
- ✅ User browser → Frontend
- ✅ User browser → API (direct calls from client-side)
- ✅ External webhooks
- ✅ Third-party integrations (Meshy, OpenAI, etc.)

**Important:** Private networking is NOT available during build phase and cannot communicate across different projects/environments.

---

## Troubleshooting

### API Returns 502 "Connection Refused"

**Symptoms:**
```json
{
  "status": "error",
  "code": 502,
  "message": "Application failed to respond",
  "upstreamErrors": "[...connection refused...]"
}
```

**Common Causes:**
1. Missing environment variables (especially API keys)
2. Database not attached or `DATABASE_URL` missing
3. Wrong start command in `railway.json`
4. Port mismatch (ensure app listens on `process.env.PORT`)

**Debug Steps:**
```bash
# Check service logs
railway logs

# Check environment variables
railway variables

# Verify service is running
railway status
```

### Frontend Can't Connect to API

**Symptoms:**
- CORS errors in browser console
- Network timeout errors
- 404 on API endpoints

**Solution:**
- Ensure `VITE_API_URL` uses **internal Railway address**: `http://striking-forgiveness.railway.internal:3004`
- Verify CORS is configured in API to allow frontend URL
- Check API health endpoint is responding

---

## Current Status

### ✅ Fixed Issues
1. Database connection error (callback → Promise)
2. API response format (projects endpoint)
3. Migration idempotency (IF NOT EXISTS)
4. Railway start command

### 🔧 Configuration Needed
1. Set `VITE_API_URL=http://striking-forgiveness.railway.internal:3004` in Frontend service
2. Verify all API keys are set in API service
3. Ensure PostgreSQL is attached to API service
4. Redeploy both services after setting environment variables

---

## Quick Commands

```bash
# Link to Railway project
railway link

# Deploy API
cd apps/api && railway up

# Deploy Frontend
cd apps/asset-forge && railway up

# Check logs
railway logs --tail

# Check variables
railway variables

# Open Railway dashboard
railway open
```
