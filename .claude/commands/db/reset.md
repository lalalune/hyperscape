---
description: Reset database (DANGER - deletes all data)
allowed-tools: [Bash]
---

# Reset Database

**⚠️ DANGER: This deletes ALL database data!**

Only use in development when you need a completely clean slate.

## Reset Database

```bash
!`cd /Users/home/hyperscape-5/packages/asset-forge && echo "⚠️  WARNING: This will DELETE ALL DATA!" && echo "Deleting database files..." && rm -f server/db/asset-forge.db server/db/asset-forge.db-shm server/db/asset-forge.db-wal && echo "✓ Database deleted" && echo "Creating fresh database from migrations..." && bun run db:migrate && echo -e "\n✅ Fresh database created" && echo && echo "Database reset complete - all data lost"`
```

## What This Does

1. **Deletes** SQLite database files
2. **Removes** WAL and SHM files
3. **Recreates** database from migrations
4. **Results** in empty database with current schema

## After Reset

- All data is permanently lost
- Schema matches migration files
- Ready for fresh test data
- All tables exist but are empty

## When to Use

Use database reset when:
- Schema is corrupted
- Migration history is broken
- Testing fresh install
- Clearing test data
- Starting over in development

## Production Warning

**NEVER run this on production databases!**

This command is for development only.

## See Also

- `/db/studio` - Inspect database before reset
- `/db/migrate` - Apply migrations only (safer)
- `/ops/clean` - Clean project files
