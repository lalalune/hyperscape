-- Bootstrap Admin Wallets
-- This script adds the initial admin wallet addresses to the whitelist
-- Run this manually in Railway PostgreSQL console or via migration

-- Ensure the admin_whitelist table has the chain_type column
-- (This is handled by migration 004_add_multi_chain_whitelist.sql)

-- Insert initial admin wallet addresses
-- These users will be automatically promoted to admin role when they connect

INSERT INTO admin_whitelist (wallet_address, chain_type, reason, added_by)
VALUES
  ('0xD7E531862A05dA2d5C77023893d76126BFF7d9Ef', 'ethereum', 'Founding team - Initial bootstrap', NULL),
  ('0xddfcd8957dfc987a14faf11b61e74097b9cf8c7f', 'ethereum', 'Founding team - Initial bootstrap', NULL),
  ('0x9e89Ee79E5695C47521f8d81954f3566f271f848', 'ethereum', 'Founding team - Initial bootstrap', NULL)
ON CONFLICT (wallet_address, chain_type) DO NOTHING;

-- Verify insertion
SELECT
  wallet_address,
  chain_type,
  reason,
  created_at
FROM admin_whitelist
ORDER BY created_at DESC;
