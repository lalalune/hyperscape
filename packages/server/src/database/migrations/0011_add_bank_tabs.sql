-- Migration: Add bank tabs support (OSRS-style bank organization)
--
-- Phase 2 of bank reorganization:
-- 1. Add tabIndex column to bank_storage
-- 2. Create bank_tabs table for custom tab metadata
-- 3. Update unique constraint to include tabIndex

-- Step 1: Add tabIndex column to bank_storage (default 0 = main tab)
ALTER TABLE "bank_storage" ADD COLUMN IF NOT EXISTS "tabIndex" INTEGER DEFAULT 0 NOT NULL;

-- Step 2: Drop old unique constraint (playerId, slot)
ALTER TABLE "bank_storage" DROP CONSTRAINT IF EXISTS "bank_storage_playerId_slot_unique";

-- Step 3: Add new unique constraint (playerId, tabIndex, slot)
ALTER TABLE "bank_storage" ADD CONSTRAINT "bank_storage_playerId_tabIndex_slot_unique"
  UNIQUE ("playerId", "tabIndex", "slot");

-- Step 4: Add index for efficient tab queries
CREATE INDEX IF NOT EXISTS "idx_bank_storage_player_tab" ON "bank_storage" ("playerId", "tabIndex");

-- Step 5: Create bank_tabs table for custom tab configuration
CREATE TABLE IF NOT EXISTS "bank_tabs" (
  "id" SERIAL PRIMARY KEY,
  "playerId" TEXT NOT NULL REFERENCES "characters"("id") ON DELETE CASCADE,
  "tabIndex" INTEGER NOT NULL,
  "iconItemId" TEXT,
  "createdAt" BIGINT NOT NULL DEFAULT (EXTRACT(EPOCH FROM NOW()) * 1000)::BIGINT,
  CONSTRAINT "bank_tabs_playerId_tabIndex_unique" UNIQUE ("playerId", "tabIndex")
);

-- Step 6: Add index for efficient tab lookups by player
CREATE INDEX IF NOT EXISTS "idx_bank_tabs_player" ON "bank_tabs" ("playerId");
