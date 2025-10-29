-- Migration: Add multi-chain support to admin whitelist
-- This migration adds chain_type column to support both Ethereum and Solana wallets

-- Add chain_type column
ALTER TABLE admin_whitelist
ADD COLUMN IF NOT EXISTS chain_type VARCHAR(20) DEFAULT 'ethereum';

-- Update constraint to ensure chain_type is valid
ALTER TABLE admin_whitelist
DROP CONSTRAINT IF EXISTS admin_whitelist_chain_type_check;

ALTER TABLE admin_whitelist
ADD CONSTRAINT admin_whitelist_chain_type_check CHECK (chain_type IN ('ethereum', 'solana'));

-- Update unique constraint to include chain_type
-- This allows the same address on different chains
ALTER TABLE admin_whitelist
DROP CONSTRAINT IF EXISTS admin_whitelist_wallet_address_key;

ALTER TABLE admin_whitelist
ADD CONSTRAINT admin_whitelist_wallet_chain_unique UNIQUE (wallet_address, chain_type);

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_admin_whitelist_chain ON admin_whitelist(chain_type);

-- Add comments
COMMENT ON COLUMN admin_whitelist.chain_type IS 'Blockchain type: ethereum or solana';
COMMENT ON CONSTRAINT admin_whitelist_wallet_chain_unique ON admin_whitelist IS 'Ensures wallet address is unique per chain';
