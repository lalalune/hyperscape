-- Migration: Add bank placeholders support (OSRS-style slot reservation)
--
-- Phase 3 of bank reorganization:
-- 1. Create bank_placeholders table for reserved item slots
-- 2. Add alwaysSetPlaceholder setting to characters table
--
-- Placeholders allow players to:
-- - Reserve slots for items when they're withdrawn
-- - Items automatically return to their reserved slot on deposit
-- - Toggle "always set placeholder" behavior

-- Step 1: Create bank_placeholders table
-- Stores reserved slots for items that have been withdrawn
CREATE TABLE IF NOT EXISTS "bank_placeholders" (
  "id" SERIAL PRIMARY KEY,
  "playerId" TEXT NOT NULL REFERENCES "characters"("id") ON DELETE CASCADE,
  "tabIndex" INTEGER NOT NULL DEFAULT 0,
  "slot" INTEGER NOT NULL,
  "itemId" TEXT NOT NULL,
  "createdAt" BIGINT NOT NULL DEFAULT (EXTRACT(EPOCH FROM NOW()) * 1000)::BIGINT,
  CONSTRAINT "bank_placeholders_player_tab_slot_unique" UNIQUE ("playerId", "tabIndex", "slot")
);

-- Step 2: Add indexes for efficient queries
CREATE INDEX IF NOT EXISTS "idx_bank_placeholders_player" ON "bank_placeholders" ("playerId");
CREATE INDEX IF NOT EXISTS "idx_bank_placeholders_player_item" ON "bank_placeholders" ("playerId", "itemId");

-- Step 3: Add alwaysSetPlaceholder setting to characters
-- Uses integer (0/1) for boolean compatibility with SQLite
ALTER TABLE "characters" ADD COLUMN IF NOT EXISTS "alwaysSetPlaceholder" INTEGER DEFAULT 0 NOT NULL;
