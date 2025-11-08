---
description: Launch Drizzle Studio for visual database inspection
allowed-tools: [Bash]
---

# Drizzle Studio

Launch Drizzle Studio to visually inspect and edit the SQLite database.

## Start Studio

```bash
!`cd /Users/home/hyperscape-5/packages/asset-forge && echo "Starting Drizzle Studio..." && echo "Access at: http://localhost:4983" && echo "Press Ctrl+C to stop" && bun run db:studio`
```

## Access

- **URL**: http://localhost:4983
- **Default Port**: 4983

## Features

Drizzle Studio provides:

### 1. Browse Tables
- View all tables in schema
- See relationships visually
- Inspect table structure

### 2. Edit Data
- Insert new rows directly
- Update existing records
- Delete data (be careful!)

### 3. View Schema
- Column types and constraints
- Indexes and keys
- Foreign key relationships

### 4. Run Queries
- Execute SQL queries
- View query results
- Export data

### 5. Monitor Migrations
- See applied migrations
- Check migration history
- Verify schema state

## Common Tasks

### View Teams Table

1. Open http://localhost:4983
2. Click "teams" table
3. View all team records

### Add Test Data

1. Select table
2. Click "Add Row"
3. Fill in fields
4. Save

### Check Relationships

1. Select table with foreign key
2. Click on FK column
3. Jump to related record

## Database Location

```bash
!`cd /Users/home/hyperscape-5/packages/asset-forge && echo "Database file:" && ls -lh server/db/asset-forge.db 2>/dev/null || echo "Database not created yet - run migrations first"`
```

## Troubleshooting

### Port Already in Use

If port 4983 is in use:

```bash
!`lsof -ti:4983 | xargs kill -9 2>/dev/null && echo "Killed process on port 4983" || echo "Port 4983 is free"`
```

### Database Not Found

If database doesn't exist:

```bash
!`cd /Users/home/hyperscape-5/packages/asset-forge && echo "Creating database with migrations..." && bun run db:migrate`
```

### Studio Won't Start

Check Drizzle Kit installation:

```bash
!`cd /Users/home/hyperscape-5/packages/asset-forge && bun x drizzle-kit --version`
```

## Configuration

Studio uses configuration from:
- @packages/asset-forge/drizzle.config.ts

```typescript
export default {
  schema: "./server/db/schema/index.ts",
  driver: "better-sqlite",
  dbCredentials: {
    url: process.env.DATABASE_URL || "./server/db/asset-forge.db"
  }
}
```

## See Also

- `/db/migrate` - Database migrations
- `/analyze-schema` - Analyze schema structure
- @packages/asset-forge/drizzle.config.ts - Drizzle configuration
- @packages/asset-forge/server/db/schema/ - Schema definitions
