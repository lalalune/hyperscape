# Railway Setup Guide - Asset Forge
## Bun + Elysia + Drizzle + Postgres Template

---

## 🚀 Quick Setup

### 1. Deploy Railway Template

Use the **thecodebrew/bun-elysia-drizzle-base** template on Railway.

This will create:
- **Server** service (Bun + Elysia)
- **Postgres** service (with SSL)

---

## 📝 Environment Variables Setup

### Step 1: Get DATABASE_URL from Railway

1. Go to Railway Dashboard
2. Click on the **Postgres** service
3. Go to **Variables** tab
4. Copy the **`DATABASE_URL`** or **`DATABASE_PUBLIC_URL`**
   - Should look like: `postgresql://postgres:PASSWORD@HOST:PORT/railway`

### Step 2: Update Local .env

Update `packages/asset-forge/.env`:

```bash
# =================================
# DATABASE (Railway PostgreSQL)
# =================================
DATABASE_URL=postgresql://postgres:PASSWORD@HOST:PORT/railway

# =================================
# AUTHENTICATION (Privy)
# =================================
PRIVY_APP_ID=your_privy_app_id
PRIVY_APP_SECRET=your_privy_app_secret

# =================================
# AI SERVICES
# =================================
MESHY_API_KEY=your_meshy_api_key
OPENAI_API_KEY=your_openai_api_key

# =================================
# SERVER CONFIGURATION
# =================================
API_PORT=3004
NODE_ENV=development
FRONTEND_URL=http://localhost:5173
IMAGE_SERVER_URL=http://localhost:3004
```

---

## 🗄️ Database Setup

### Step 1: Run Migrations

```bash
cd packages/asset-forge
bun run db:migrate
```

This creates 5 tables:
- `users` - User profiles and authentication
- `admin_whitelist` - Admin access control
- `activity_log` - Audit trail
- `projects` - Asset organization
- `assets` - 3D asset metadata

### Step 2: Verify Tables

```bash
# Option 1: Drizzle Studio
bun run db:studio
# Opens at http://localhost:4983

# Option 2: Direct SQL
bun server/db/db.ts
```

### Step 3: Seed Initial Admin

Add your wallet address to the admin whitelist:

```sql
INSERT INTO admin_whitelist (wallet_address, reason)
VALUES ('0xYourWalletAddress', 'Initial admin');
```

---

## 🧪 Testing

### Test Database Connection

```bash
bun test-connection.ts
```

Expected output:
```
✅ Connection successful!
PostgreSQL version: PostgreSQL 15.x...
```

### Test API Endpoints

```bash
# Start backend
bun run dev:backend

# Test health endpoint
curl http://localhost:3004/api/health
# → {"status":"healthy","timestamp":"..."}

# Test authenticated endpoint (need Privy JWT)
curl http://localhost:3004/api/users/me \
  -H "Authorization: Bearer YOUR_PRIVY_JWT"
# → {"id":"...","role":"member",...}
```

---

## 📊 Database Management

### Drizzle Studio

Visual database editor:

```bash
bun run db:studio
```

Opens at: http://localhost:4983

Features:
- View/edit data visually
- Browse tables and relationships
- Execute SQL queries
- Manage schema

### Generate New Migration

After schema changes:

```bash
bun run db:generate
```

This creates a new SQL migration file in `server/db/migrations/`.

---

## 🔐 Required API Keys

### 1. Privy (Authentication)

**Get from**: https://dashboard.privy.io

1. Select your app
2. Go to Settings → Basics
3. Copy **App ID** and **App Secret**

```bash
PRIVY_APP_ID=clp...
PRIVY_APP_SECRET=...
```

### 2. Meshy AI (3D Generation)

**Get from**: https://www.meshy.ai

1. Login → API Keys
2. Create new key or copy existing

```bash
MESHY_API_KEY=msy_...
```

### 3. OpenAI (GPT-4 Vision)

**Get from**: https://platform.openai.com/api-keys

1. Create new secret key
2. Copy immediately (only shown once!)

```bash
OPENAI_API_KEY=sk-proj-...
```

---

## 🏗️ Architecture

```
┌─────────────────────────────────────────┐
│         React Frontend (Vite)           │
│         http://localhost:5173           │
└──────────────┬──────────────────────────┘
               │ Privy JWT
               ▼
┌─────────────────────────────────────────┐
│    Elysia API Server (Bun)              │
│    http://localhost:3004                │
│                                         │
│  • JWT verification (Privy SDK)         │
│  • 5-minute user caching                │
│  • Drizzle ORM                          │
└──────────────┬──────────────────────────┘
               │ SQL queries
               ▼
┌─────────────────────────────────────────┐
│   PostgreSQL (Railway)                  │
│   • 5 core tables                       │
│   • SSL enabled                         │
│   • Connection pooling                  │
└─────────────────────────────────────────┘
```

**Key Points:**
- ✅ Privy handles all authentication
- ✅ No external file storage needed (local `gdd-assets/`)
- ✅ Simple Postgres database (no Supabase complexity)
- ✅ Bun-native stack (22x faster than Node)

---

## 📁 Project Structure

```
packages/asset-forge/
├── .env                          # Environment variables
├── server/
│   ├── db/
│   │   ├── schema/               # Drizzle table definitions
│   │   │   ├── users.schema.ts
│   │   │   ├── projects.schema.ts
│   │   │   └── assets.schema.ts
│   │   ├── migrations/           # SQL migration files
│   │   ├── db.ts                 # Database connection
│   │   └── migrate.ts            # Migration runner
│   ├── middleware/
│   │   └── privyAuth.ts          # JWT authentication
│   ├── services/
│   │   └── UserService.ts        # User CRUD + caching
│   └── routes/
│       ├── users.ts              # User endpoints
│       └── admin.ts              # Admin endpoints
├── drizzle.config.ts             # Drizzle configuration
└── package.json                  # Scripts and dependencies
```

---

## 🚀 Deployment to Railway

### Option 1: Connect GitHub Repo

1. Push code to GitHub
2. In Railway, create new project
3. Select "Deploy from GitHub repo"
4. Choose your repository
5. Add environment variables
6. Deploy!

### Option 2: Railway CLI

```bash
# Install Railway CLI
npm i -g @railway/cli

# Login
railway login

# Link to project
railway link

# Deploy
railway up
```

---

## ✅ Verification Checklist

Before going live:

- [ ] Database migrations ran successfully
- [ ] All 5 tables exist in Postgres
- [ ] Drizzle Studio can connect
- [ ] Admin wallet added to whitelist
- [ ] Privy authentication works
- [ ] Health endpoint returns 200
- [ ] User creation works on first login
- [ ] User caching reduces DB queries
- [ ] Asset upload/metadata storage works

---

## 🆘 Troubleshooting

### "Can't connect to database"

**Check:**
```bash
# Verify DATABASE_URL format
echo $DATABASE_URL
# Should start with: postgresql://

# Test connection
bun test-connection.ts
```

### "Password authentication failed"

**Fix:**
- Get fresh DATABASE_URL from Railway
- Make sure you're using `DATABASE_PUBLIC_URL` for local development
- Verify username is `postgres` (not `supabase_admin`)

### "Privy verification failed"

**Check:**
```bash
# Verify both keys are set
echo $PRIVY_APP_ID
echo $PRIVY_APP_SECRET

# Match your Privy dashboard
```

### "Migration failed"

**Check:**
- Is DATABASE_URL set correctly?
- Does `server/db/migrations/meta/_journal.json` exist?
- Run `bun run db:generate` first if schema changed

---

## 📚 Useful Commands

```bash
# Database
bun run db:generate       # Generate migration from schema
bun run db:migrate        # Run pending migrations
bun run db:studio         # Open Drizzle Studio
bun run db:push           # Push schema directly (dev only)

# Development
bun run dev               # Start frontend + backend
bun run dev:backend       # Backend only
bun run dev:frontend      # Frontend only

# Testing
bun test-connection.ts    # Test DB connection
curl localhost:3004/api/health  # Test API
```

---

**Last Updated**: 2025-11-06
**Stack**: Bun + Elysia + Drizzle + Postgres
**Template**: thecodebrew/bun-elysia-drizzle-base
