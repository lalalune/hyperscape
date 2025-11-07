# Railway Deployment Guide
## PostgreSQL for Asset Forge (Simplified)

---

## 🎯 **Deployment Strategy**

For Phase 1, we **only need PostgreSQL**. Skip the full Supabase stack.

### **Why Skip Full Supabase?**

| Supabase Service | Do We Need It? | Why Not? |
|---|---|---|
| Postgres | ✅ **YES** | Our database |
| Supabase Studio | 🟡 **OPTIONAL** | Nice for DB management |
| Gotrue Auth | ❌ **NO** | We use Privy JWT instead |
| PostgREST | ❌ **NO** | We have Elysia API |
| Realtime | ❌ **NO** | Not needed yet |
| Storage | ❌ **NO** | Using local files for now |
| Kong Gateway | ❌ **NO** | Direct Elysia access |

---

## 📦 **Option 1: PostgreSQL Only (Recommended)**

### **Step 1: Deploy PostgreSQL on Railway**

1. Go to Railway dashboard
2. Click **"New Project"**
3. Click **"Add Service"** → **"Database"** → **"PostgreSQL"**
4. Railway will auto-provision a PostgreSQL instance

### **Step 2: Get DATABASE_URL**

1. Click on the PostgreSQL service
2. Go to **"Variables"** tab
3. Copy the **`DATABASE_URL`** value

It will look like:
```
postgresql://postgres:PASSWORD@containers-us-west-X.railway.app:PORT/railway
```

### **Step 3: Configure Local Environment**

Create `packages/asset-forge/.env`:

```bash
# PostgreSQL (from Railway)
DATABASE_URL=postgresql://postgres:PASSWORD@containers-us-west-X.railway.app:PORT/railway

# Privy (your existing auth)
PRIVY_APP_ID=your_privy_app_id
PRIVY_APP_SECRET=your_privy_app_secret

# AI Services (your existing keys)
MESHY_API_KEY=your_meshy_api_key
OPENAI_API_KEY=your_openai_api_key

# Server config
API_PORT=3004
NODE_ENV=production
```

### **Step 4: Run Migrations**

```bash
cd packages/asset-forge

# Test connection
bun server/db/db.ts

# Run migration
bun run db:migrate
```

**Expected output:**
```
[Database] ✓ Connected to PostgreSQL at 2025-11-06...
[Migrations] Running migrations...
[Migrations] ✓ Migrations completed successfully
```

### **Step 5: Verify Tables**

Option A - Using `psql`:
```bash
psql $DATABASE_URL -c "\dt"
```

Option B - Using Drizzle Studio:
```bash
bun run db:studio
# Opens at http://localhost:4983
```

**Expected tables:**
- users
- admin_whitelist
- projects
- assets
- activity_log

---

## 📦 **Option 2: Postgres + Supabase Studio (Visual DB)**

If you want a visual database manager (like phpMyAdmin for Postgres):

### **Deploy Full Stack**

1. Use the Railway Supabase template you showed
2. **Configure required variables:**

#### **Supabase Studio Variables**

Generate JWT keys at: https://supabase.com/docs/guides/self-hosting/docker#generate-api-keys

```bash
# 1. Generate a random string (32+ chars)
AUTH_JWT_SECRET=your_super_secret_jwt_key_at_least_32_characters_long

# 2. Go to: https://supabase.com/docs/guides/self-hosting/docker#api-keys
# Use the JWT Secret Generator

# 3. Generate ANON key (role: anon)
SUPABASE_ANON_KEY=eyJhbGc...

# 4. Generate SERVICE key (role: service_role)
SUPABASE_SERVICE_KEY=eyJhbGc...
```

#### **Gotrue Auth Variable**

```bash
GOTRUE_SITE_URL=http://localhost:5173
# Or your production URL
```

### **Access Supabase Studio**

1. After deployment, click on **Kong** service
2. Copy the public URL (e.g., `https://kong-production.up.railway.app`)
3. Open in browser
4. Login with Studio credentials
5. Navigate to **Table Editor** to see your tables

### **Connect Our API to Postgres**

In `.env`:
```bash
# Use the Postgres service's DATABASE_URL
DATABASE_URL=${{Postgres.POSTGRES_URL}}

# Keep using Privy (not Supabase Auth!)
PRIVY_APP_ID=your_privy_app_id
PRIVY_APP_SECRET=your_privy_app_secret
```

---

## 🔐 **Important: We Use Privy, Not Supabase Auth**

### **Authentication Flow**

```
┌─────────────┐
│   Frontend  │
│   (React)   │
└──────┬──────┘
       │ Privy JWT
       ▼
┌─────────────┐
│   Elysia    │────────┐
│   API       │        │ Direct SQL
└─────────────┘        │
                       ▼
              ┌─────────────┐
              │  PostgreSQL │
              │  (Railway)  │
              └─────────────┘

❌ NOT USED:
   - Supabase Auth (Gotrue)
   - PostgREST
   - Supabase Client SDK
```

**We only use:**
- ✅ PostgreSQL database
- ✅ Supabase Studio (optional, for visual DB management)

---

## 🚀 **Deployment to Railway (API Server)**

### **Step 1: Prepare for Deployment**

Create `packages/asset-forge/railway.json`:

```json
{
  "$schema": "https://railway.app/railway.schema.json",
  "build": {
    "builder": "NIXPACKS"
  },
  "deploy": {
    "startCommand": "bun run start",
    "restartPolicyType": "ON_FAILURE",
    "restartPolicyMaxRetries": 10
  }
}
```

### **Step 2: Add nixpacks.toml**

Create `packages/asset-forge/nixpacks.toml`:

```toml
[phases.setup]
nixPkgs = ['bun']

[phases.install]
cmds = ['bun install']

[phases.build]
cmds = ['bun run build']

[start]
cmd = 'bun run start'
```

### **Step 3: Deploy to Railway**

1. **Create new service:**
   - Railway Dashboard → **"New Service"**
   - Select **"GitHub Repo"**
   - Choose your repo
   - Set **Root Directory:** `packages/asset-forge`

2. **Set Environment Variables:**
   ```
   DATABASE_URL=${{Postgres.DATABASE_URL}}
   PRIVY_APP_ID=your_privy_app_id
   PRIVY_APP_SECRET=your_privy_app_secret
   MESHY_API_KEY=your_meshy_api_key
   OPENAI_API_KEY=your_openai_api_key
   NODE_ENV=production
   API_PORT=3004
   ```

3. **Run Migration (one-time):**
   ```bash
   # In Railway service settings, add one-time command:
   bun run db:migrate
   ```

### **Step 4: Test Deployment**

```bash
# Get your Railway URL
RAILWAY_URL=https://your-service.up.railway.app

# Test health check
curl $RAILWAY_URL/api/health

# Test user endpoint (with valid Privy JWT)
curl $RAILWAY_URL/api/users/me \
  -H "Authorization: Bearer YOUR_PRIVY_JWT"
```

---

## 📊 **Database Initialization**

### **First-Time Setup**

After migration, optionally seed admin user:

```sql
-- Connect via psql or Supabase Studio
-- Add your wallet to admin whitelist

INSERT INTO admin_whitelist (wallet_address, reason)
VALUES ('0xYourWalletAddress', 'Initial admin setup');
```

Now when you login with that wallet via Privy, you'll be auto-promoted to admin!

---

## 🔍 **Monitoring & Debugging**

### **Check Database Connection**

```bash
# From your deployed Railway service
curl https://your-api.railway.app/api/health
```

### **View Database**

**Option 1: Supabase Studio**
- Navigate to Kong URL
- Login
- View tables, data, logs

**Option 2: Railway Console**
```bash
# Click on Postgres service
# Go to "Query" tab
# Run SQL:
SELECT * FROM users LIMIT 10;
```

**Option 3: Local Drizzle Studio**
```bash
# Point to production DB
DATABASE_URL=postgresql://... bun run db:studio
```

### **Check Logs**

```bash
# Railway Dashboard
# Click on your API service
# Go to "Deployments" tab
# Click latest deployment
# View logs
```

---

## ⚠️ **Common Issues**

### **Issue: Can't connect to database**

**Check:**
```bash
# Test connection string
psql "$DATABASE_URL" -c "SELECT version();"
```

**Fix:**
- Ensure DATABASE_URL has correct password
- Check Railway network settings
- Verify Postgres service is running

### **Issue: Migration fails**

**Error:** `relation "users" already exists`

**Fix:**
```bash
# Drop all tables (⚠️ destroys data!)
psql "$DATABASE_URL" -c "DROP SCHEMA public CASCADE; CREATE SCHEMA public;"

# Re-run migration
bun run db:migrate
```

### **Issue: JWT verification fails**

**Check:**
```typescript
// Ensure using PRIVY keys, not Supabase
PRIVY_APP_ID=clxxxxx...
PRIVY_APP_SECRET=xxxx...

// NOT:
AUTH_JWT_SECRET=... (this is for Supabase Auth)
```

---

## ✅ **Deployment Checklist**

- [ ] PostgreSQL deployed on Railway
- [ ] DATABASE_URL copied to local `.env`
- [ ] Migration ran successfully (`bun run db:migrate`)
- [ ] Tables visible in Studio/psql
- [ ] Admin wallet added to whitelist
- [ ] API service deployed on Railway
- [ ] Environment variables set in Railway
- [ ] Health check endpoint working
- [ ] `/api/users/me` endpoint tested with JWT
- [ ] Admin endpoints tested (if admin user)

---

## 🎉 **Success Criteria**

You're ready when:

```bash
# 1. Database connection works
curl https://your-api.railway.app/api/health
# → {"status":"healthy"}

# 2. User creation works (with valid Privy JWT)
curl https://your-api.railway.app/api/users/me \
  -H "Authorization: Bearer VALID_JWT"
# → {"id":"...", "role":"member",...}

# 3. Admin routes work (with admin JWT)
curl https://your-api.railway.app/api/admin/stats \
  -H "Authorization: Bearer ADMIN_JWT"
# → {"users":1,"assets":0,...}
```

---

## 📚 **Next Steps After Deployment**

1. **Frontend Integration**
   - Update API base URL to Railway URL
   - Test login flow with Privy
   - Verify user profile loads

2. **Asset Linking**
   - Start linking existing assets to database
   - Add project assignment
   - Track ownership

3. **Monitoring**
   - Setup error tracking (Sentry)
   - Monitor database performance
   - Track API usage

---

## 🆘 **Need Help?**

**Railway Docs:**
- https://docs.railway.app/
- https://docs.railway.app/guides/postgresql

**Our Docs:**
- `PHASE1_IMPLEMENTATION_SUMMARY.md`
- `.env.example`

**Supabase Studio (if using):**
- https://supabase.com/docs/guides/self-hosting
