# Using the Local Hyperscape Database

This skill explains how to interact with the Hyperscape PostgreSQL database running in Docker.

## Database Configuration

**Connection Details:**
- **Host**: localhost
- **Port**: 5432
- **Database**: hyperscape
- **User**: hyperscape
- **Password**: hyperscape_dev
- **Docker Container**: hyperscape-postgres
- **Image**: postgres:16-alpine

**Configuration File**: `/Users/home/hyperscape/packages/server/drizzle.config.ts`

## Docker Container Management

### Check if PostgreSQL is Running

```bash
docker ps --filter "name=hyperscape-postgres"
```

Expected output:
```
CONTAINER ID   IMAGE                PORTS
328f98d1a3f6   postgres:16-alpine   0.0.0.0:5432->5432/tcp
```

### Start PostgreSQL Container

If the container exists but is stopped:
```bash
docker start hyperscape-postgres
```

### View PostgreSQL Logs

```bash
docker logs hyperscape-postgres
```

## Running SQL Commands

### Method 1: Using Docker Exec (Recommended)

**Interactive psql shell:**
```bash
docker exec -it hyperscape-postgres psql -U hyperscape -d hyperscape
```

**Single SQL command:**
```bash
docker exec -i hyperscape-postgres psql -U hyperscape -d hyperscape -c "SELECT * FROM users;"
```

**Run SQL file:**
```bash
cat /path/to/file.sql | docker exec -i hyperscape-postgres psql -U hyperscape -d hyperscape
```

### Method 2: Using Drizzle Kit

**From server package:**
```bash
cd /Users/home/hyperscape/packages/server
bunx drizzle-kit studio  # Opens visual database browser
bunx drizzle-kit push    # Push schema changes to DB
bunx drizzle-kit introspect  # Inspect current schema
```

## Common Database Operations

### Clear All User Data

**File**: `/Users/home/hyperscape/clear-users.sql`

```bash
cat /Users/home/hyperscape/clear-users.sql | docker exec -i hyperscape-postgres psql -U hyperscape -d hyperscape
```

This truncates:
- users
- characters
- inventory
- equipment
- player_sessions
- chunk_activity
- npc_kills
- player_deaths

### Inspect Table Contents

**List all tables:**
```bash
docker exec -i hyperscape-postgres psql -U hyperscape -d hyperscape -c "\dt"
```

**Count rows in all tables:**
```bash
docker exec -i hyperscape-postgres psql -U hyperscape -d hyperscape -c "
SELECT
  schemaname,
  tablename,
  (SELECT COUNT(*) FROM pg_catalog.pg_class c WHERE c.relname = tablename) as count
FROM pg_tables
WHERE schemaname = 'public'
ORDER BY tablename;
"
```

**View specific table:**
```bash
# View all users
docker exec -i hyperscape-postgres psql -U hyperscape -d hyperscape -c "SELECT * FROM users;"

# View all characters
docker exec -i hyperscape-postgres psql -U hyperscape -d hyperscape -c "SELECT * FROM characters;"

# View character with specific ID
docker exec -i hyperscape-postgres psql -U hyperscape -d hyperscape -c "SELECT * FROM characters WHERE id = 'character_id_here';"
```

### Query Character Data

**Get characters for an account:**
```bash
docker exec -i hyperscape-postgres psql -U hyperscape -d hyperscape -c "
SELECT c.id, c.name, c.avatar, u.privy_user_id
FROM characters c
JOIN users u ON c.account_id = u.id
WHERE u.privy_user_id = 'privy_user_id_here';
"
```

**Check avatar assignments:**
```bash
docker exec -i hyperscape-postgres psql -U hyperscape -d hyperscape -c "
SELECT id, name, avatar, created_at
FROM characters
ORDER BY created_at DESC
LIMIT 10;
"
```

## Schema Management

### View Table Schema

```bash
docker exec -i hyperscape-postgres psql -U hyperscape -d hyperscape -c "\d+ characters"
```

### Generate Migration

After modifying `/Users/home/hyperscape/packages/server/src/database/schema/`:

```bash
cd /Users/home/hyperscape/packages/server
bunx drizzle-kit generate
bunx drizzle-kit push  # Apply to database
```

## Database Schema Files

**Location**: `/Users/home/hyperscape/packages/server/src/database/schema/`

Key files:
- `users.ts` - User accounts (Privy authentication)
- `characters.ts` - Player characters (name, avatar, wallet)
- `inventory.ts` - Player inventory items
- `equipment.ts` - Equipped items
- `skills.ts` - Skill levels and XP
- `sessions.ts` - Player login sessions
- `activity.ts` - Chunk activity tracking
- `combat.ts` - NPC kills and player deaths

## Drizzle ORM Client

**Location**: `/Users/home/hyperscape/packages/server/src/database/client.ts`

**Usage in code:**
```typescript
import { db } from './database/client.js';
import { characters, users } from './database/schema/index.js';
import { eq } from 'drizzle-orm';

// Query characters
const userCharacters = await db
  .select()
  .from(characters)
  .where(eq(characters.accountId, accountId));

// Insert character
const newCharacter = await db
  .insert(characters)
  .values({
    id: characterId,
    accountId: accountId,
    name: 'Adventurer',
    avatar: 'asset://avatar-male-01.vrm',
  })
  .returning();
```

## Character Repository

**Location**: `/Users/home/hyperscape/packages/server/src/database/repositories/CharacterRepository.ts`

High-level API for character operations:
```typescript
import { CharacterRepository } from './database/repositories/CharacterRepository.js';

const repo = new CharacterRepository();

// Get characters for account
const characters = await repo.getCharacters(accountId);

// Create character
await repo.createCharacter({
  id: characterId,
  accountId: accountId,
  name: 'Adventurer',
  avatar: 'asset://avatar-male-01.vrm',
  wallet: walletAddress,
});

// Update character
await repo.updateCharacter(characterId, {
  name: 'New Name',
  avatar: 'asset://avatar-female-01.vrm',
});
```

## Debugging Database Issues

### Check Character Creation

```bash
# View recent characters with all fields
docker exec -i hyperscape-postgres psql -U hyperscape -d hyperscape -c "
SELECT
  id,
  name,
  avatar,
  wallet,
  account_id,
  created_at
FROM characters
ORDER BY created_at DESC
LIMIT 5;
"
```

### Verify Avatar Field Not Null

```bash
docker exec -i hyperscape-postgres psql -U hyperscape -d hyperscape -c "
SELECT id, name, avatar
FROM characters
WHERE avatar IS NULL OR avatar = '';
"
```

### Check Database Connectivity

```bash
# From Node.js code (packages/server/src/database/client.ts)
docker exec -i hyperscape-postgres psql -U hyperscape -d hyperscape -c "SELECT version();"
```

## Important Notes

1. **PostgreSQL is in Docker** - Don't use system psql, always use `docker exec`
2. **Environment Variables** - Server reads DATABASE_URL from `.env` file
3. **Connection Pooling** - Drizzle client handles connection pooling automatically
4. **Schema Changes** - Always run `bunx drizzle-kit generate` after schema changes
5. **Cascade Deletes** - Many tables have foreign key constraints with CASCADE
6. **Avatar Storage** - Avatars use `asset://` protocol for in-game, `http://localhost:8080/` for preview

## Troubleshooting

### "Connection refused" errors

```bash
# Check if PostgreSQL container is running
docker ps | grep postgres

# If not running, start it
docker start hyperscape-postgres

# Check logs for errors
docker logs hyperscape-postgres --tail 50
```

### "Database does not exist" errors

```bash
# Recreate database
docker exec -i hyperscape-postgres psql -U hyperscape -c "CREATE DATABASE hyperscape;"

# Run migrations
cd /Users/home/hyperscape/packages/server
bunx drizzle-kit push
```

### Schema out of sync

```bash
cd /Users/home/hyperscape/packages/server
bunx drizzle-kit introspect  # See current schema
bunx drizzle-kit generate    # Generate migration
bunx drizzle-kit push        # Apply migration
```

## Visual Database Browser

**Drizzle Studio** (recommended):
```bash
cd /Users/home/hyperscape/packages/server
bunx drizzle-kit studio
```

Opens at `http://localhost:4983` with visual table browser, query builder, and data editor.

## Related Files

- Database config: `packages/server/drizzle.config.ts`
- Schema definitions: `packages/server/src/database/schema/`
- ORM client: `packages/server/src/database/client.ts`
- Repositories: `packages/server/src/database/repositories/`
- Clear script: `/Users/home/hyperscape/clear-users.sql`
- Environment: `/Users/home/hyperscape/.env`
