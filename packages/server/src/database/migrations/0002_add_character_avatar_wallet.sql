-- Migration: Add avatar and wallet fields to characters table
-- Description: Adds support for storing VRM avatar URLs and wallet addresses for characters

ALTER TABLE characters ADD COLUMN IF NOT EXISTS avatar text;
ALTER TABLE characters ADD COLUMN IF NOT EXISTS wallet text;

-- Create index on wallet for lookups (idempotent)
CREATE INDEX IF NOT EXISTS idx_characters_wallet ON characters(wallet);
