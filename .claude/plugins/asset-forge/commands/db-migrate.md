---
description: Manage Drizzle database migrations for asset-forge
---

# Asset-Forge Database Migrations

Managing PostgreSQL database with **Drizzle ORM** (ADR-0004).

## What would you like to do?

1. **Generate new migration** - Create migration from schema changes
   ```bash
   cd packages/asset-forge && bun run drizzle-kit generate:pg
   ```

2. **Apply migrations** - Run pending migrations
   ```bash
   cd packages/asset-forge && bun run drizzle-kit migrate
   ```

3. **Check migration status** - See which migrations have been applied

4. **Rollback last migration** - Undo most recent migration (careful!)

I'll use Deepwiki to research Drizzle ORM best practices and ensure:
- Type-safe schema definitions
- Proper foreign key relationships
- ACID transaction integrity
- Migration safety

Which operation would you like to perform?
