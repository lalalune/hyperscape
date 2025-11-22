-- Migration: Add wallet to users table and attackStyle to characters table
-- Description: Adds HD wallet support for user accounts and combat style persistence for characters
-- Created: 2025-11-22

-- Add wallet column to users table for Privy HD wallet (index 0)
-- This stores the main embedded wallet address for each user account
ALTER TABLE users ADD COLUMN IF NOT EXISTS wallet text;

-- Create index on wallet for fast lookups (idempotent)
CREATE INDEX IF NOT EXISTS idx_users_wallet ON users(wallet);

-- Add attack style column to characters table (idempotent)
-- This persists the player's preferred combat style across sessions
ALTER TABLE characters ADD COLUMN IF NOT EXISTS "attackStyle" text DEFAULT 'accurate';

-- Create index on attack style for quick lookups (idempotent)
CREATE INDEX IF NOT EXISTS idx_characters_attack_style ON characters("attackStyle");
