---
description: Generate and apply Drizzle database migrations for asset-forge
allowed-tools: [Bash, Read, Grep]
argument-hint: [generate|apply|review|all]
---

# Database Migration Workflow

Comprehensive Drizzle migration workflow for asset-forge. This command provides a safe, guided process for managing database schema changes with Drizzle ORM.

## Usage

- `/migrate` or `/migrate all` - Full workflow (generate, review, apply) [RECOMMENDED]
- `/migrate generate` - Generate migration from schema changes only
- `/migrate apply` - Apply pending migrations only
- `/migrate review` - Review latest migration SQL before applying

## Generate Migration

Create a new migration from schema changes in @packages/asset-forge/server/db/schema/:

```bash
!`cd /Users/home/hyperscape-5/packages/asset-forge && echo "=== Generating Migration ===" && bun run db:generate 2>&1 || (echo -e "\n❌ ERROR: Migration generation failed" && echo "Common causes:" && echo "  - TypeScript syntax errors in schema files" && echo "  - Circular dependencies between tables" && echo "  - Invalid foreign key references" && echo "Run /check-types to identify TypeScript errors" && exit 1)`
```

## Review Latest Migration

View the SQL before applying (ALWAYS review before applying!):

```bash
!`cd /Users/home/hyperscape-5/packages/asset-forge && LATEST=$(ls -t server/db/migrations/*.sql 2>/dev/null | head -1); if [ -n "$LATEST" ]; then echo "=== Latest Migration: $(basename $LATEST) ===" && echo && cat "$LATEST" && echo && echo "=== Review Checklist ===" && echo "- [ ] SQL statements look correct" && echo "- [ ] No unintended DROP statements" && echo "- [ ] Foreign keys reference existing tables" && echo "- [ ] Indexes are properly named" && echo && echo "Apply with: /migrate apply"; else echo "❌ No migrations found - run /migrate generate first"; fi`
```

## Apply Migrations

Run pending migrations against the database (ensure you reviewed the SQL first!):

```bash
!`cd /Users/home/hyperscape-5/packages/asset-forge && echo "=== Applying Migrations ===" && echo "Database: $DATABASE_URL" && bun run db:migrate 2>&1 && echo -e "\n✅ Migrations applied successfully" || (echo -e "\n❌ ERROR: Migration failed" && echo "Troubleshooting:" && echo "  1. Check DATABASE_URL in .env file" && echo "  2. Verify database file permissions" && echo "  3. Review migration SQL for conflicts" && echo "  4. Check if migration was already applied" && echo "  5. Use /db/studio to inspect database state" && exit 1)`
```

## Full Workflow (Recommended)

Generate, review, and apply in one guided workflow:

```bash
!`cd /Users/home/hyperscape-5/packages/asset-forge && echo "=== Database Migration Workflow ===" && echo && echo "[1/4] Generating migration from schema..." && bun run db:generate 2>&1 || (echo "❌ Generation failed - check schema" && exit 1) && echo -e "\n✅ Migration generated\n" && echo "[2/4] Latest migration SQL:" && echo "─────────────────────────────────────" && LATEST=$(ls -t server/db/migrations/*.sql | head -1) && cat "$LATEST" && echo "─────────────────────────────────────" && echo && echo "[3/4] Review checklist:" && echo "  - SQL statements look correct" && echo "  - No unintended DROP/DELETE statements" && echo "  - Foreign keys valid" && echo "  - Indexes properly named" && echo && echo "[4/4] Applying migration to database..." && bun run db:migrate 2>&1 && echo -e "\n✅ Migration workflow complete!" && echo && echo "Verify with: /db/studio" || (echo "❌ Migration failed" && exit 1)`
```

## Schema Files

- @packages/asset-forge/server/db/schema/index.ts - Main schema exports
- @packages/asset-forge/server/db/schema/teams.schema.ts - Teams and projects
- @packages/asset-forge/server/db/schema/rigging.schema.ts - Rigging configurations

## Important Notes

- Always review generated SQL before applying
- Migrations are irreversible - ensure backups exist
- Schema changes must be committed with migration files
- Use `/db/studio` to inspect database after migrations
- Run `/check-types` after schema changes to verify TypeScript types

## Error Handling

If generation fails:
1. Check schema syntax in TypeScript files
2. Verify no circular dependencies between tables
3. Ensure foreign key references are valid
4. Run `/check-types` to find TypeScript errors

If migration fails:
1. Check database file permissions
2. Verify DATABASE_URL in .env
3. Review migration SQL for conflicts
4. Consider rolling back or creating a fix migration

## See Also

- `/db/studio` - Visual database browser
- `/db/reset` - Reset database (DESTRUCTIVE)
- `/analyze-schema` - Analyze schema structure
