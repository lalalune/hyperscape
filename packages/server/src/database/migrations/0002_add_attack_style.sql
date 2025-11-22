-- Add attack style column to characters table
-- This persists the player's preferred combat style across sessions
ALTER TABLE characters ADD COLUMN IF NOT EXISTS "attackStyle" TEXT DEFAULT 'accurate';

-- Add index for quick lookups (optional but recommended)
CREATE INDEX IF NOT EXISTS idx_characters_attack_style ON characters("attackStyle");
