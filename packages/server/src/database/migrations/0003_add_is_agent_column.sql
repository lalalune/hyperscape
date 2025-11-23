-- Migration: Add isAgent flag to characters table
-- Description: Adds support for distinguishing between human-controlled and AI agent characters

ALTER TABLE characters ADD COLUMN IF NOT EXISTS "isAgent" integer DEFAULT 0 NOT NULL;

-- Create index on isAgent for filtering agent characters (idempotent)
CREATE INDEX IF NOT EXISTS idx_characters_is_agent ON characters("isAgent");
