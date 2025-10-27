# Asset Forge API

Express.js API server for Asset Forge application. Handles asset generation, content creation, voice synthesis, manifest management, and admin operations.

## 🚀 Quick Start

```bash
# Install dependencies
bun install

# Development (local)
bun run dev

# Production (Railway)
bun run start
```

## 📦 Deployment

### Production (Railway)

- **API URL**: https://dairy-queen-production.up.railway.app
- **Database**: PostgreSQL on Railway
- **Deploy**: Auto-deploys from `main` branch via GitHub integration

### Environment Variables

Required environment variables (set in Railway dashboard):

```bash
# Database (Railway provides DATABASE_URL automatically)
DATABASE_URL=postgresql://...

# Optional: API Keys for services
OPENAI_API_KEY=sk-...
ANTHROPIC_API_KEY=sk-ant-...
ELEVENLABS_API_KEY=...

# Optional: Custom manifest path
MANIFESTS_PATH=/app/assets/world/manifests
```

## 📁 Project Structure

```
apps/api/
├── server/
│   ├── api.mjs                 # Main Express server
│   ├── routes/                 # API route handlers
│   │   ├── manifests.mjs       # Hyperscape manifests (items, mobs, npcs)
│   │   ├── preview-manifests.mjs  # User/team manifest editing
│   │   ├── admin-approvals.mjs    # Admin submission approvals
│   │   ├── ai-context.mjs         # AI context management
│   │   └── ...
│   ├── database/
│   │   ├── db.mjs              # PostgreSQL connection pool
│   │   └── schema.sql          # Complete database schema
│   └── scripts/
│       ├── migrate-manifests-to-postgres.mjs  # One-time migration
│       └── seed-preview-manifests.mjs         # Older seeding script
├── database/
│   └── schema.sql              # Database schema (copy)
├── package.json
└── README.md                   # This file
```

## 🗄️ Database Migration

**IMPORTANT**: All manifests must be migrated to PostgreSQL for Railway deployment.

### Run Migration

```bash
cd apps/api
bun run migrate:manifests
```

This migrates all manifest files (`items.json`, `mobs.json`, `npcs.json`) from the filesystem into the `preview_manifests` table, including all GLB model references.

**Documentation**:
- [Quick Start Guide](./MIGRATION-QUICKSTART.md)
- [Full Migration Documentation](./MANIFEST-MIGRATION.md)

### Why Migration is Needed

The API package build doesn't work when served from the root filesystem on Railway. All manifest data (including GLB references) must be stored in PostgreSQL for reliable access.

## 🛠️ Available Scripts

```bash
# Development
bun run dev              # Start dev server (port from API_PORT or 3001)

# Production
bun run start            # Start production server

# Database
bun run migrate:manifests  # Migrate manifests to PostgreSQL (one-time)
bun run seed:manifests     # Alternative seeding (older method)

# Assets
bun run assets:audit       # Audit asset files
bun run assets:normalize   # Normalize asset structure

# Utilities
bun run count:lines        # Count lines of code
bun run typecheck          # TypeScript type checking
```

## 📡 API Endpoints

### Manifests (Hyperscape Original)

```
GET  /api/manifests           # List all manifests
GET  /api/manifests/:type     # Get manifest (items, mobs, npcs)
GET  /api/manifests/:type/:id # Get specific item
POST /api/manifests/:type     # Update manifest (dev only)
```

### Preview Manifests (User/Team Editing)

```
GET  /api/preview-manifests           # Get user's preview manifests
GET  /api/preview-manifests/:type     # Get specific type
POST /api/preview-manifests/:type     # Create/update preview manifest
POST /api/preview-manifests/:type/item  # Add item to manifest
PUT  /api/preview-manifests/:type/item/:id  # Update item
DELETE /api/preview-manifests/:type/item/:id  # Remove item
```

### Submissions & Approvals

```
POST /api/preview-manifests/:type/submit  # Submit item for approval
GET  /api/admin/submissions               # List all submissions (admin)
POST /api/admin/submissions/:id/approve   # Approve submission (admin)
POST /api/admin/submissions/:id/reject    # Reject submission (admin)
```

### AI Context

```
GET  /api/ai-context/preferences      # Get AI context settings
PUT  /api/ai-context/preferences      # Update AI context settings
GET  /api/ai-context/manifests/:type  # Get context-aware manifests
```

### Assets, Voice, Content Generation

See route files in `/server/routes/` for complete endpoint documentation.

## 🔍 Testing

```bash
# Health check
curl https://dairy-queen-production.up.railway.app/health

# Test manifests endpoint
curl https://dairy-queen-production.up.railway.app/api/manifests/items

# Verify database source
curl https://dairy-queen-production.up.railway.app/api/manifests/items | jq '.source'
# Should return: "preview-manifests-db"
```

## 🏗️ Development

### Local PostgreSQL Setup

```bash
# Start PostgreSQL (Docker)
docker run --name asset-forge-db \
  -e POSTGRES_USER=asset_forge \
  -e POSTGRES_PASSWORD=asset_forge_dev_password_2024 \
  -e POSTGRES_DB=asset_forge \
  -p 5433:5432 \
  -d postgres:15

# Apply schema
psql postgresql://asset_forge:asset_forge_dev_password_2024@localhost:5433/asset_forge \
  < database/schema.sql

# Run migration
bun run migrate:manifests
```

### Adding New Routes

1. Create route file in `server/routes/`
2. Import in `server/api.mjs`
3. Mount with `app.use('/api/your-route', yourRouter)`
4. Document endpoints in this README

### Database Changes

1. Update `database/schema.sql`
2. Create migration script in `server/scripts/`
3. Test locally before deploying
4. Document in migration docs

## 📚 Related Documentation

- [Asset Forge Frontend](../asset-forge/README.md)
- [Database Schema](./database/schema.sql)
- [Manifest Migration](./MANIFEST-MIGRATION.md)
- [Railway Deployment](https://railway.app)

## 🐛 Troubleshooting

### "Connection refused" errors

**Problem**: Can't connect to PostgreSQL

**Solution**: 
```bash
# Check DATABASE_URL
echo $DATABASE_URL

# Railway logs
railway logs

# Test connection
psql $DATABASE_URL -c "SELECT NOW()"
```

### Manifests return 404

**Problem**: Manifest data not in database

**Solution**: Run migration:
```bash
bun run migrate:manifests
```

### API returns wrong source

**Problem**: Returns `"source": "hyperscape-server-filesystem"`

**Solution**: Migration incomplete. Verify:
```bash
psql $DATABASE_URL -c "SELECT * FROM preview_manifests WHERE is_original=true"
```

## 🔐 Security

- All routes use Privy authentication (frontend handles JWT)
- Admin routes check user role
- Database uses connection pooling with timeouts
- API keys stored as environment variables
- CORS configured for frontend domain

## 📊 Performance

- Connection pool: max 20 connections
- Query timeout: 2 seconds
- Idle timeout: 30 seconds
- Manifest caching: handled by frontend

## 📝 Notes

- Original JSON manifest files preserved as backups
- GLB files referenced but not stored in database
- System user (privy_user_id='system') owns original manifests
- User edits create separate preview manifests

