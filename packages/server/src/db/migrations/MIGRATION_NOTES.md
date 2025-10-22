# Migration 0001: Add manifest_voice_profiles Table

## Overview
This migration adds the `manifest_voice_profiles` table to support voice assignments for NPCs and Mobs in the game manifests.

## Migration Details

### File: `0001_add_manifest_voice_profiles.sql`

Creates a new table with the following structure:

**Columns:**
- `id` (text, PK) - Unique profile ID, auto-generated UUID
- `manifestType` (text, NOT NULL) - Entity type: 'npcs' or 'mobs'
- `entityId` (text, NOT NULL) - ID from the manifest
- `entityName` (text, NOT NULL) - Name from the manifest
- `voiceId` (text, NOT NULL) - ElevenLabs voice ID
- `voiceName` (text, NOT NULL) - ElevenLabs voice name
- `settings` (text, NOT NULL) - Voice settings as JSON string
- `sampleClips` (text, DEFAULT '[]') - Array of sample clips as JSON string
- `assignedAt` (timestamp, DEFAULT now()) - When voice was first assigned
- `updatedAt` (timestamp, DEFAULT now()) - Last update timestamp

**Constraints:**
- UNIQUE constraint on (manifestType, entityId) - ensures one voice per entity

**Indexes:**
- `idx_manifest_voice_type` on `manifestType` - for filtering by entity type
- `idx_manifest_voice_entity` on `entityId` - for fast entity lookups

## How to Run

The migration will run automatically when the server starts via the `initializeDatabase()` function in `/packages/server/src/db/client.ts`.

To manually run migrations:
```bash
cd packages/server
bun run dev  # Migrations run automatically on server start
```

## Database Compatibility

- **Database System**: PostgreSQL
- **Drizzle ORM Version**: 0.44.6
- **Drizzle Kit Version**: 0.31.5

## Verification

After the migration runs, you can verify the table exists:

```sql
-- Check table exists
SELECT table_name
FROM information_schema.tables
WHERE table_schema = 'public'
AND table_name = 'manifest_voice_profiles';

-- Check columns
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns
WHERE table_name = 'manifest_voice_profiles'
ORDER BY ordinal_position;

-- Check indexes
SELECT indexname, indexdef
FROM pg_indexes
WHERE tablename = 'manifest_voice_profiles';

-- Check constraints
SELECT conname, contype
FROM pg_constraint
WHERE conrelid = 'manifest_voice_profiles'::regclass;
```

## Rollback

To rollback this migration manually:

```sql
DROP INDEX IF EXISTS idx_manifest_voice_entity;
DROP INDEX IF EXISTS idx_manifest_voice_type;
DROP TABLE IF EXISTS manifest_voice_profiles;
```

## Related Files

- Schema definition: `/packages/server/src/db/schema.ts`
- Specification: `/packages/asset-forge/VOICE_API_SPEC.md`
- Migration tracker: `/packages/server/src/db/migrations/meta/_journal.json`

## Notes

- Uses `text` type for JSON data instead of `JSONB` for consistency with existing schema tables
- Uses `text` type for UUID instead of PostgreSQL's native `uuid` type (consistent with other tables like `users`, `characters`)
- Column names use camelCase convention matching the existing schema style
- The `gen_random_uuid()` function is a PostgreSQL built-in (available in PostgreSQL 13+)
