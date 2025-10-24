# Neon PostgreSQL Database Setup

Asset Forge now uses **Neon PostgreSQL** with Drizzle ORM for scalable, serverless database hosting.

## 🗄️ Database Information

- **Project Name**: asset-forge
- **Project ID**: spring-darkness-74772296
- **Region**: AWS US East 2 (Ohio)
- **Database**: neondb
- **Provider**: Neon (serverless PostgreSQL)

## 📋 Tables

The database includes 9 tables:

1. **users** - User accounts with Privy authentication
2. **teams** - Team collaboration and grouping
3. **projects** - Asset generation projects
4. **assets** - Generated 3D assets and metadata
5. **voice_profiles** - ElevenLabs voice profiles for NPCs
6. **generation_history** - Audit log for API usage
7. **api_keys** - Encrypted user API keys
8. **sessions** - User session tracking
9. **admin_whitelist** - Admin access control

## 🔧 Setup

### 1. Environment Variables

Add your Neon connection string to `.env.local`:

```bash
DATABASE_URL="postgresql://neondb_owner:npg_rniBc5XR3GJo@ep-polished-rain-ae7cc6gt-pooler.c-2.us-east-2.aws.neon.tech/neondb?channel_binding=require&sslmode=require"
```

### 2. Test Connection

```bash
bun run db:test
```

## 🚀 Usage

### Using Drizzle ORM

```javascript
import { db } from './server/db/index-neon.mjs'
import { users, projects, assets } from './server/db/schema-pg.mjs'
import { eq } from 'drizzle-orm'

// Select all users
const allUsers = await db.select().from(users)

// Select with conditions
const user = await db.select()
  .from(users)
  .where(eq(users.email, 'user@example.com'))

// Insert
await db.insert(users).values({
  id: 'user-123',
  name: 'John Doe',
  email: 'john@example.com'
})

// Update
await db.update(users)
  .set({ name: 'Jane Doe' })
  .where(eq(users.id, 'user-123'))

// Delete
await db.delete(users)
  .where(eq(users.id, 'user-123'))
```

### Using Raw SQL

```javascript
import { sql } from './server/db/index-neon.mjs'

// Raw SQL query with tagged templates
const result = await sql`
  SELECT * FROM users 
  WHERE created_at > ${new Date('2024-01-01')}
`

// Parameters are automatically escaped
const userId = 'user-123'
const user = await sql`
  SELECT * FROM users WHERE id = ${userId}
`
```

## 📦 Migrations

### Generate Migration

After modifying `schema-pg.mjs`:

```bash
bun run db:generate
```

This creates SQL migration files in `server/db/migrations-pg/`

### Apply Migrations

To push schema changes to Neon:

```bash
bun run db:push
```

Or apply migrations manually through Neon MCP or Drizzle Studio.

### Drizzle Studio

Launch the database GUI:

```bash
bun run db:studio
```

## 🔄 Migration from SQLite

The original SQLite database is preserved in `server/db/index.mjs` and `server/db/schema.mjs`. To migrate data:

1. Export data from SQLite
2. Transform timestamp columns (unixepoch → ISO timestamps)
3. Import into Neon using Drizzle

## 🌐 Neon Features

### Branching

Neon supports database branching for development:

```bash
# Create a development branch
neon branches create --name dev

# Get connection string for branch
neon connection-string --branch dev
```

### Autoscaling

Neon automatically scales compute resources based on load.

### Instant Restore

Point-in-time recovery is available for all branches.

## 📚 Resources

- [Neon Documentation](https://neon.tech/docs)
- [Drizzle ORM Documentation](https://orm.drizzle.team)
- [Drizzle + Neon Guide](https://neon.tech/docs/guides/drizzle)

## 🔐 Security

- Connection uses SSL/TLS with channel binding
- API keys are encrypted before storage
- All queries are parameterized to prevent SQL injection
- Privy handles authentication (no passwords stored)

## 💡 Tips

- Use `.env.local` for local development (not committed to git)
- Use Vercel environment variables for production
- Monitor database usage in Neon console
- Set up read replicas for high-traffic applications
- Use database branches for staging/preview deployments

