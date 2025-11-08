---
description: Generate and apply database migrations
allowed-tools: [Bash, Read]
argument-hint: [generate|apply|both]
---

# Database Migrations

Manage Drizzle database migrations. Alias for `/migrate` command.

## Generate Migration

```bash
!`cd /Users/home/hyperscape-5/packages/asset-forge && echo "=== Generating Migration ===" && bun run db:generate 2>&1 || (echo "❌ Generation failed - check schema syntax" && exit 1)`
```

## Apply Migrations

```bash
!`cd /Users/home/hyperscape-5/packages/asset-forge && echo "=== Applying Migrations ===" && bun run db:migrate 2>&1 && echo "✅ Migrations applied" || (echo "❌ Migration failed" && exit 1)`
```

## Full Workflow (Generate + Apply)

```bash
!`cd /Users/home/hyperscape-5/packages/asset-forge && echo "=== Database Migration Workflow ===" && bun run db:generate && echo "✓ Generated" && bun run db:migrate && echo "✓ Applied" && echo -e "\n✅ Complete"`
```

## View Latest Migration

```bash
!`cd /Users/home/hyperscape-5/packages/asset-forge && LATEST=$(ls -t server/db/migrations/*.sql 2>/dev/null | head -1) && if [ -n "$LATEST" ]; then echo "=== Latest Migration ===" && cat "$LATEST"; else echo "No migrations found"; fi`
```

## Schema Files

- @packages/asset-forge/server/db/schema/index.ts
- @packages/asset-forge/server/db/schema/teams.schema.ts
- @packages/asset-forge/server/db/schema/rigging.schema.ts
- @packages/asset-forge/server/db/schema/assets.schema.ts

**Always review generated SQL before applying migrations.**

## See Also

- `/migrate` - Full migration workflow (recommended)
- `/db/studio` - Visual database browser
- `/analyze-schema` - Analyze schema structure
