-- Migration: Add admin whitelist table and team_leader role support
-- This migration adds:
-- 1. admin_whitelist table for tracking admin wallet addresses (reference only, not enforced)
-- 2. Role validation constraint to support admin, team_leader, and member roles

-- =====================================================
-- ADMIN WHITELIST TABLE
-- =====================================================
-- This table is for admin reference only - it does NOT control access
-- Admins use this to track which wallets should have admin privileges

CREATE TABLE IF NOT EXISTS admin_whitelist (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  wallet_address VARCHAR(255) UNIQUE NOT NULL,
  added_by UUID REFERENCES users(id) ON DELETE SET NULL,
  reason TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_admin_whitelist_wallet ON admin_whitelist(wallet_address);
CREATE INDEX IF NOT EXISTS idx_admin_whitelist_added_by ON admin_whitelist(added_by);

-- Add trigger for updated_at
DROP TRIGGER IF EXISTS update_admin_whitelist_updated_at ON admin_whitelist;
CREATE TRIGGER update_admin_whitelist_updated_at BEFORE UPDATE ON admin_whitelist
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- =====================================================
-- ROLE VALIDATION
-- =====================================================
-- Add check constraint to users table to ensure only valid roles are used
-- Valid roles: admin, team_leader, member

ALTER TABLE users
DROP CONSTRAINT IF EXISTS users_role_check;

ALTER TABLE users
ADD CONSTRAINT users_role_check CHECK (role IN ('admin', 'team_leader', 'member'));

-- =====================================================
-- TEAM APPROVAL STATUS
-- =====================================================
-- Add approval status to teams table for team leader promotion workflow

ALTER TABLE teams
ADD COLUMN IF NOT EXISTS approval_status VARCHAR(50) DEFAULT 'pending';

ALTER TABLE teams
ADD COLUMN IF NOT EXISTS approved_at TIMESTAMP WITH TIME ZONE;

ALTER TABLE teams
ADD COLUMN IF NOT EXISTS approved_by UUID REFERENCES users(id) ON DELETE SET NULL;

ALTER TABLE teams
ADD CONSTRAINT teams_approval_status_check CHECK (approval_status IN ('pending', 'approved', 'rejected'));

CREATE INDEX IF NOT EXISTS idx_teams_approval_status ON teams(approval_status);

-- =====================================================
-- COMMENTS
-- =====================================================

COMMENT ON TABLE admin_whitelist IS 'Admin reference list for tracking admin wallet addresses - NOT enforced by system';
COMMENT ON COLUMN admin_whitelist.wallet_address IS 'Ethereum wallet address (0x...)';
COMMENT ON COLUMN admin_whitelist.reason IS 'Optional reason for whitelisting';

COMMENT ON COLUMN users.role IS 'User role: admin (full access), team_leader (elevated permissions), member (default)';
COMMENT ON COLUMN teams.approval_status IS 'Team approval status for team leader promotion workflow';
