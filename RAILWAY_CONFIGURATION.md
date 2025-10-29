# Railway Configuration Guide

**Last Updated:** 2025-10-29
**Builder:** RAILPACK v0.9.2
**Node Version:** 22.21.1

## Overview

This document describes the Railway deployment configuration for all services in the Asset Forge system.

---

## Service Configuration Summary

| Service | Builder | Node Version | Start Command | Health Check |
|---------|---------|--------------|---------------|--------------|
| **API Backend** | RAILPACK | 22 | `node scripts/startup.mjs` | `/api/health` |
| **Frontend** | RAILPACK | 20 | `node server.mjs` | `/` |
| **PostgreSQL** | Railway Managed | N/A | Auto-managed | Auto-managed |
| **Qdrant** | Not Deployed | N/A | N/A | N/A |

---

## Backend API Configuration

### File: `apps/api/railway.json`

```json
{
  "$schema": "https://railway.app/railway.schema.json",
  "build": {
    "builder": "RAILPACK"
  },
  "deploy": {
    "startCommand": "node scripts/startup.mjs",
    "restartPolicyType": "ON_FAILURE",
    "restartPolicyMaxRetries": 10,
    "healthcheckPath": "/api/health",
    "healthcheckTimeout": 300
  }
}
```

### File: `apps/api/package.json`

```json
{
  "engines": {
    "node": "22"
  }
}
```

### Startup Sequence

**Script:** `scripts/startup.mjs`

1. **Check DATABASE_URL** - Verify database connection is available
2. **Run Database Setup** - Execute `scripts/setup-railway-database.mjs`
3. **Run Migrations** - Execute `scripts/run-migrations.mjs`
4. **Migrate Manifests** - Execute `scripts/migrate-manifests-to-postgres.mjs`
5. **Start API Server** - Launch `server/api.mjs` with IPv6 support

**Features:**
- ✅ Non-blocking startup (continues even if DB setup fails)
- ✅ Comprehensive logging
- ✅ Graceful error handling
- ✅ Signal handling (SIGTERM, SIGINT)

---

## Frontend Configuration

### File: `apps/asset-forge/railway.json`

```json
{
  "$schema": "https://railway.app/railway.schema.json",
  "build": {
    "builder": "RAILPACK",
    "buildCommand": "npm run build"
  },
  "deploy": {
    "startCommand": "node server.mjs",
    "restartPolicyType": "ON_FAILURE",
    "restartPolicyMaxRetries": 10,
    "healthcheckPath": "/",
    "healthcheckTimeout": 300
  }
}
```

### File: `apps/asset-forge/package.json`

```json
{
  "engines": {
    "node": "20"
  },
  "scripts": {
    "build": "vite build"
  }
}
```

### Build & Deploy Sequence

1. **Install Dependencies** - `npm install` (auto-detected by RAILPACK)
2. **Build Vite App** - `npm run build` (creates `dist/` directory)
3. **Start Server** - `node server.mjs` (serves static files from `dist/`)

**Features:**
- ✅ IPv6 support (`::` binding in production)
- ✅ SPA routing fallback (serves `index.html` for all routes)
- ✅ Security: Directory traversal protection
- ✅ Caching: HTML no-cache, assets 1-year cache

---

## RAILPACK Builder Details

### What is RAILPACK?

RAILPACK is Railway's default builder that automatically detects and builds your application based on:
- `package.json` presence → Node.js app
- `engines.node` field → Specific Node version
- `scripts.build` → Build command (if defined)

### Advantages over Nixpacks

1. **Faster builds** - Optimized for Node.js workloads
2. **Better caching** - Layer caching for dependencies
3. **Auto-detection** - No configuration needed for simple apps
4. **Active development** - Railway's primary focus

### Version Detection

RAILPACK uses the following priority for Node version:
1. `package.json` → `engines.node` field ✅ **HIGHEST PRIORITY**
2. `.nvmrc` file
3. `.node-version` file
4. Default (latest LTS)

**Our Configuration:**
- **API:** `"node": "22"` → Uses Node 22.x
- **Frontend:** `"node": "20"` → Uses Node 20.x

---

## Environment Variables

### Required for API Backend

```bash
# Node Environment
NODE_ENV=production

# Database (Auto-configured by Railway)
DATABASE_URL=${{Postgres.DATABASE_URL}}

# API Keys
OPENAI_API_KEY=sk-proj-...
MESHY_API_KEY=msy_...
ANTHROPIC_API_KEY=sk-ant-...

# CORS Configuration
FRONTEND_URL=https://frontend-production-f53f.up.railway.app
ALLOWED_ORIGINS=https://frontend-production-f53f.up.railway.app

# Image Server URL (for Meshy callbacks)
IMAGE_SERVER_URL=https://striking-forgiveness-production.up.railway.app

# Feature Flags
ENABLE_GPT4_ENHANCEMENT=true
ENABLE_RETEXTURING=true
ENABLE_RIGGING=true
```

### Required for Frontend

```bash
# Node Environment
NODE_ENV=production

# API Connection (Railway Internal Network)
VITE_API_URL=http://striking-forgiveness.railway.internal:3004
VITE_CDN_URL=http://striking-forgiveness.railway.internal:3004
VITE_GENERATION_API_URL=http://striking-forgiveness.railway.internal:3004/api

# Authentication
VITE_PUBLIC_PRIVY_APP_ID=cmhbfhcm1003ml80cu47k4h2m
```

---

## Health Checks

### API Backend Health Check

**Endpoint:** `GET /api/health`

**Response (Healthy):**
```json
{
  "status": "healthy",
  "database": "connected",
  "timestamp": "2025-10-29T18:34:44.716Z",
  "uptime": 123.45,
  "environment": "production"
}
```

**Response (Degraded):**
```json
{
  "status": "degraded",
  "database": "disconnected",
  "timestamp": "2025-10-29T18:34:44.716Z",
  "uptime": 123.45,
  "environment": "production"
}
```

**Status Codes:**
- `200` - Service healthy, database connected
- `503` - Service degraded, database disconnected

### Frontend Health Check

**Endpoint:** `GET /`

**Response:** HTML content (index.html)

**Status Codes:**
- `200` - Service healthy
- `502` - Service not responding

---

## Deployment Workflow

### 1. Commit Changes

```bash
git add .
git commit -m "fix: update Railway configuration"
git push
```

### 2. Railway Auto-Deploy

Railway automatically:
1. Detects push to `main` branch
2. Pulls latest code
3. Runs RAILPACK builder
4. Executes build commands
5. Starts services with configured commands
6. Performs health checks

### 3. Monitor Deployment

**Check Logs:**
- API: Look for "✅ SERVER STARTED SUCCESSFULLY"
- Frontend: Look for "✅ Dist directory verified"
- Database: Look for "✅ Connected successfully"

**Check Health:**
```bash
# API Health
curl https://striking-forgiveness-production.up.railway.app/api/health

# Frontend
curl https://frontend-production-f53f.up.railway.app/
```

---

## Troubleshooting

### Build Failures

**Symptom:** Build fails during `npm install`

**Solutions:**
1. Check `package.json` for invalid dependencies
2. Verify Node version is compatible
3. Check for conflicting peer dependencies
4. Review Railway build logs

### Connection Refused (502)

**Symptom:** Service shows 502 "connection refused"

**Common Causes:**
1. ❌ Missing build command (Frontend only)
2. ❌ Server not binding to correct host (should be `::` for Railway)
3. ❌ Wrong port (should use `process.env.PORT`)
4. ❌ Server crashed on startup

**Solutions:**
1. Check `railway.json` has `buildCommand` (frontend)
2. Verify server binds to `::` or `0.0.0.0`
3. Use `PORT` environment variable
4. Check startup logs for errors

### Database Connection Errors

**Symptom:** "Connection timeout" or "Connection refused"

**Solutions:**
1. Verify `DATABASE_URL` is set
2. Check PostgreSQL service is running
3. Increase `connectionTimeoutMillis` (currently 10s)
4. Verify internal network connectivity

### Health Check Failures

**Symptom:** Railway marks service as unhealthy

**Solutions:**
1. Verify health endpoint responds within 300s
2. Check database connectivity
3. Review server logs for errors
4. Test health endpoint manually

---

## Best Practices

### 1. Use Railway Internal Network

✅ **DO:**
```bash
VITE_API_URL=http://striking-forgiveness.railway.internal:3004
```

❌ **DON'T:**
```bash
VITE_API_URL=http://localhost:3004  # Won't work in production
VITE_API_URL=https://striking-forgiveness-production.up.railway.app  # Slower, costs egress
```

### 2. Set Explicit Node Versions

✅ **DO:**
```json
{
  "engines": {
    "node": "22"
  }
}
```

❌ **DON'T:**
- Rely on default Node version
- Use wildcard versions like `"node": "*"`

### 3. Use IPv6 for Server Binding

✅ **DO:**
```javascript
const hostname = process.env.NODE_ENV === 'production' ? '::' : '0.0.0.0'
server.listen(PORT, hostname)
```

❌ **DON'T:**
```javascript
server.listen(PORT, '0.0.0.0')  // Works but not optimal
server.listen(PORT, 'localhost')  // Won't work on Railway
```

### 4. Implement Health Checks

✅ **DO:**
- Check database connectivity
- Return appropriate status codes
- Include useful debug information

❌ **DON'T:**
- Return only static "OK" response
- Ignore database connection status
- Use health check for heavy operations

### 5. Handle Graceful Shutdown

✅ **DO:**
```javascript
process.on('SIGTERM', async () => {
  await closeConnections()
  process.exit(0)
})
```

❌ **DON'T:**
- Ignore shutdown signals
- Force exit without cleanup
- Leave connections open

---

## Migration from Nixpacks

If you were previously using Nixpacks:

1. **Remove `nixpacks.toml`** ✅ Already done
2. **Add `railway.json`** ✅ Already configured
3. **Set `engines.node` in package.json** ✅ Already set
4. **Update `builder` to `RAILPACK`** ✅ Already updated
5. **Test deployment**

---

## Related Documentation

- [RAILWAY_ENV_VARIABLES.md](./RAILWAY_ENV_VARIABLES.md) - Environment variables guide
- [FRONTEND_DEPLOYMENT_FIX.md](./FRONTEND_DEPLOYMENT_FIX.md) - Frontend 502 fix
- [apps/api/CLEANUP_SUMMARY.md](./apps/api/CLEANUP_SUMMARY.md) - API directory cleanup

---

**Configuration Status:** ✅ **COMPLETE**
**Builder:** RAILPACK v0.9.2
**Ready to Deploy:** Yes
