-- Migration: Add avatar and wallet fields to characters table
-- Description: Adds support for storing VRM avatar URLs and wallet addresses for characters

ALTER TABLE characters ADD COLUMN avatar text;
ALTER TABLE characters ADD COLUMN wallet text;

-- Create index on wallet for lookups
CREATE INDEX idx_characters_wallet ON characters(wallet);
