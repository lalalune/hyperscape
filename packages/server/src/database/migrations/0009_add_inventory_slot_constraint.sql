-- Migration: Add unique constraint on inventory (playerId, slotIndex)
-- This prevents duplicate items being assigned to the same inventory slot.
-- First, clean up any existing duplicates by keeping the row with the highest id (most recent).

-- Step 1: Delete duplicate inventory entries (keep the one with highest id for each playerId/slotIndex)
DELETE FROM inventory
WHERE id NOT IN (
  SELECT MAX(id)
  FROM inventory
  WHERE "slotIndex" >= 0
  GROUP BY "playerId", "slotIndex"
)
AND "slotIndex" >= 0;

-- Step 2: Add unique constraint on (playerId, slotIndex) for valid slots (>= 0)
-- Using a partial unique index since slotIndex = -1 means "unassigned"
CREATE UNIQUE INDEX IF NOT EXISTS "inventory_player_slot_unique"
ON inventory ("playerId", "slotIndex")
WHERE "slotIndex" >= 0;
