Create a database migration with proper naming, structure, and rollback support.

## What This Does

1. Detects ORM/migration tool (Prisma, TypeORM, Alembic, etc.)
2. Generates migration with descriptive name
3. Creates both up and down migrations
4. Opens migration file for editing

## Usage

```bash
/migration-create "add user role column"
/migration-create "create posts table"
```

## Instructions

```bash
MIGRATION_NAME="$*"

if [ -z "$MIGRATION_NAME" ]; then
  echo "❌ Usage: /migration-create <description>"
  exit 1
fi

# Convert to snake_case
SNAKE_CASE=$(echo "$MIGRATION_NAME" | tr '[:upper:]' '[:lower:]' | tr ' ' '_')

echo "📦 Creating migration: $SNAKE_CASE"

# Detect migration tool and create migration
if [ -f "prisma/schema.prisma" ]; then
  npx prisma migrate dev --name $SNAKE_CASE --create-only
  echo "✅ Prisma migration created"

elif [ -f "ormconfig.json" ] || [ -d "typeorm" ]; then
  npx typeorm migration:create -n ${SNAKE_CASE}
  echo "✅ TypeORM migration created"

elif [ -f "alembic.ini" ]; then
  alembic revision -m "$MIGRATION_NAME"
  echo "✅ Alembic migration created"

elif [ -d "db/migrate" ]; then
  # Rails
  rails generate migration $SNAKE_CASE
  echo "✅ Rails migration created"

elif [ -d "migrations" ]; then
  # Generic - create template
  TIMESTAMP=$(date +"%Y%m%d%H%M%S")
  FILENAME="migrations/${TIMESTAMP}_${SNAKE_CASE}.sql"

  cat > $FILENAME << 'EOF'
-- Migration: $MIGRATION_NAME
-- Created: $(date)

-- Up Migration
-- Write your schema changes here

-- Down Migration (for rollback)
-- Write rollback logic here
EOF

  echo "✅ Migration file created: $FILENAME"
  ${EDITOR:-vim} $FILENAME
else
  echo "❌ No migration tool detected"
  exit 1
fi

echo ""
echo "Next steps:"
echo "  1. Edit the migration file"
echo "  2. Review the changes"
echo "  3. Run: /migration-run"
```
