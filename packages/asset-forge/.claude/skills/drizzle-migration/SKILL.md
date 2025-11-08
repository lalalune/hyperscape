---
name: drizzle-migration
description: Execute the proper Drizzle Kit workflow for database schema migrations. Use this when the user asks to create a database migration, update the database schema, or when schema changes need to be applied to the database. This skill ensures type-safe, auto-generated migrations from TypeScript schemas.
allowed-tools: Bash(bun run db:generate:*), Bash(bun run db:migrate:*), Bash(cat:*), Bash(ls:*), Bash(git add:*), Read, Edit
---

# Drizzle Kit Migration Workflow

This skill guides you through the proper workflow for creating and applying database migrations using Drizzle Kit.

## When to Use This Skill

Use this skill when:
- User requests to create a database migration
- User has modified TypeScript schema files in `server/db/schema/`
- User asks to apply schema changes to the database
- User wants to update database tables, columns, or constraints

## Workflow Steps

### Step 1: Verify Schema Changes

First, check what schema files exist and what changes were made:

```bash
ls -la server/db/schema/
```

If the user hasn't mentioned what they changed, ask them or read the relevant schema file.

### Step 2: Auto-Generate Migration

Run Drizzle Kit to auto-generate the SQL migration from TypeScript schema:

```bash
bun run db:generate
```

This will:
- Compare TypeScript schema to current database state
- Generate a new SQL migration file in `server/db/migrations/`
- Update the migration journal at `server/db/migrations/meta/_journal.json`

### Step 3: Review Generated SQL

**IMPORTANT**: Always review the generated SQL before applying it to catch any unexpected changes:

```bash
# Find the latest migration file
ls -lt server/db/migrations/*.sql | head -1

# Read it to verify
cat server/db/migrations/XXXX_migration_name.sql
```

Show the user the generated SQL and explain what changes will be made.

### Step 4: Apply Migration to Database

If the generated SQL looks correct, apply it:

```bash
bun run db:migrate
```

This will:
- Execute all pending migrations in order
- Update the `__drizzle_migrations` tracking table
- Report success or any errors

### Step 5: Commit Changes

After successful migration, commit both the schema and migration files:

```bash
git add server/db/schema/ server/db/migrations/
```

Then let the user create the commit or ask if they want you to create one.

## Common Scenarios

### New Table

```typescript
// server/db/schema/example.schema.ts
export const examples = pgTable('examples', {
  id: uuid('id').defaultRandom().primaryKey(),
  name: varchar('name', { length: 255 }).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
})
```

Then run: `bun run db:generate` → `bun run db:migrate`

### Add Column to Existing Table

```typescript
// Add to existing table schema
export const teams = pgTable('teams', {
  // ... existing columns
  slug: varchar('slug', { length: 255 }).unique(), // NEW COLUMN
})
```

Then run: `bun run db:generate` → `bun run db:migrate`

### Add Index

```typescript
export const teams = pgTable('teams', {
  // ... columns
}, (table) => ({
  nameIndex: index('idx_teams_name').on(table.name), // NEW INDEX
}))
```

Then run: `bun run db:generate` → `bun run db:migrate`

## Troubleshooting

### "relation already exists"

The table already exists in the database. Options:
1. Use `bun run db:push` to sync schema directly (dev only)
2. Delete the migration file if it's a duplicate
3. Manually mark as applied in `__drizzle_migrations` table

### Generated migration looks wrong

The schema doesn't match database state:
1. Run `bun run db:push` to align database with current schema
2. Then generate fresh migration for new changes

### Can't connect to database

Check DATABASE_URL environment variable:
```bash
cat .env | grep DATABASE_URL
```

## Important Reminders

✅ **DO:**
- Always review generated SQL before applying
- Commit migration files to version control
- Test migrations on dev database first
- Use `bun run db:generate` + `bun run db:migrate` for production

❌ **DON'T:**
- Don't edit applied migration files (create new one instead)
- Don't use `db:push` in production (use migrations)
- Don't skip reviewing the generated SQL
- Don't delete migration files that have been applied

## Available Commands

- `bun run db:generate` - Auto-generate SQL migration from schema changes
- `bun run db:migrate` - Apply pending migrations to database
- `bun run db:push` - Push schema directly (dev only, skips migrations)
- `bun run db:studio` - Launch Drizzle Studio visual DB editor
