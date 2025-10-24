/**
 * Integration Test Setup
 *
 * Sets up test environment with in-memory database and test utilities
 */

import { beforeAll, afterAll, beforeEach, afterEach } from '@playwright/test'
import Database from 'better-sqlite3'
import { drizzle } from 'drizzle-orm/better-sqlite3'
import * as schema from '../../server/db/schema.mjs'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

// Test database instance
let testDb = null
let testSqlite = null

/**
 * Initialize test database with in-memory SQLite
 */
export function initTestDatabase() {
  // Create in-memory database
  testSqlite = new Database(':memory:')

  // Enable SQLite optimizations
  testSqlite.pragma('journal_mode = MEMORY')
  testSqlite.pragma('synchronous = OFF')
  testSqlite.pragma('foreign_keys = ON')

  // Initialize schema
  testSqlite.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      email TEXT,
      name TEXT NOT NULL,
      avatar TEXT,
      privy_user_id TEXT UNIQUE,
      farcaster_fid TEXT,
      wallet_address TEXT,
      role TEXT NOT NULL DEFAULT 'user',
      team_id TEXT,
      created_at INTEGER NOT NULL DEFAULT (unixepoch()),
      last_login_at INTEGER,
      is_active INTEGER NOT NULL DEFAULT 1,
      FOREIGN KEY (team_id) REFERENCES teams(id) ON DELETE SET NULL
    );

    CREATE TABLE IF NOT EXISTS teams (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      description TEXT,
      invite_code TEXT UNIQUE NOT NULL,
      owner_id TEXT NOT NULL,
      max_members INTEGER NOT NULL DEFAULT 10,
      member_count INTEGER NOT NULL DEFAULT 1,
      is_active INTEGER NOT NULL DEFAULT 1,
      created_at INTEGER NOT NULL DEFAULT (unixepoch()),
      updated_at INTEGER NOT NULL DEFAULT (unixepoch()),
      FOREIGN KEY (owner_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS projects (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      team_id TEXT,
      name TEXT NOT NULL,
      description TEXT,
      type TEXT NOT NULL,
      game_style TEXT,
      game_type TEXT,
      art_direction TEXT,
      tags TEXT,
      thumbnail TEXT,
      asset_count INTEGER NOT NULL DEFAULT 0,
      is_public INTEGER NOT NULL DEFAULT 0,
      created_at INTEGER NOT NULL DEFAULT (unixepoch()),
      updated_at INTEGER NOT NULL DEFAULT (unixepoch()),
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY (team_id) REFERENCES teams(id) ON DELETE SET NULL
    );

    CREATE TABLE IF NOT EXISTS assets (
      id TEXT PRIMARY KEY,
      project_id TEXT NOT NULL,
      user_id TEXT NOT NULL,
      name TEXT NOT NULL,
      description TEXT,
      type TEXT NOT NULL,
      category TEXT,
      glb_path TEXT,
      thumbnail_path TEXT,
      concept_art_path TEXT,
      prompt TEXT,
      meshy_task_id TEXT,
      generation_settings TEXT,
      vertex_count INTEGER,
      triangle_count INTEGER,
      file_size INTEGER,
      properties TEXT,
      tags TEXT,
      status TEXT NOT NULL DEFAULT 'pending',
      created_at INTEGER NOT NULL DEFAULT (unixepoch()),
      updated_at INTEGER NOT NULL DEFAULT (unixepoch()),
      FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS voice_profiles (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      project_id TEXT,
      name TEXT NOT NULL,
      description TEXT,
      elevenlabs_voice_id TEXT NOT NULL,
      voice_name TEXT,
      voice_settings TEXT,
      audio_clips TEXT,
      total_clips INTEGER NOT NULL DEFAULT 0,
      created_at INTEGER NOT NULL DEFAULT (unixepoch()),
      updated_at INTEGER NOT NULL DEFAULT (unixepoch()),
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE SET NULL
    );

    CREATE TABLE IF NOT EXISTS generation_history (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      asset_id TEXT,
      generation_type TEXT NOT NULL,
      provider TEXT NOT NULL,
      prompt TEXT,
      settings TEXT,
      status TEXT NOT NULL,
      error_message TEXT,
      credits_used INTEGER NOT NULL DEFAULT 1,
      started_at INTEGER NOT NULL DEFAULT (unixepoch()),
      completed_at INTEGER,
      duration INTEGER,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY (asset_id) REFERENCES assets(id) ON DELETE SET NULL
    );

    CREATE TABLE IF NOT EXISTS api_keys (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      provider TEXT NOT NULL,
      encrypted_key TEXT NOT NULL,
      is_active INTEGER NOT NULL DEFAULT 1,
      last_used_at INTEGER,
      created_at INTEGER NOT NULL DEFAULT (unixepoch()),
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS sessions (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      token TEXT NOT NULL UNIQUE,
      ip_address TEXT,
      user_agent TEXT,
      expires_at INTEGER NOT NULL,
      created_at INTEGER NOT NULL DEFAULT (unixepoch()),
      last_activity_at INTEGER NOT NULL DEFAULT (unixepoch()),
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS admin_whitelist (
      id TEXT PRIMARY KEY,
      wallet_address TEXT NOT NULL UNIQUE,
      added_by TEXT,
      reason TEXT,
      is_active INTEGER NOT NULL DEFAULT 1,
      created_at INTEGER NOT NULL DEFAULT (unixepoch()),
      expires_at INTEGER,
      FOREIGN KEY (added_by) REFERENCES users(id) ON DELETE SET NULL
    );
  `)

  // Create indexes
  testSqlite.exec(`
    CREATE INDEX IF NOT EXISTS idx_users_privy ON users(privy_user_id);
    CREATE INDEX IF NOT EXISTS idx_users_wallet ON users(wallet_address);
    CREATE INDEX IF NOT EXISTS idx_teams_invite_code ON teams(invite_code);
    CREATE INDEX IF NOT EXISTS idx_projects_user ON projects(user_id);
    CREATE INDEX IF NOT EXISTS idx_assets_project ON assets(project_id);
    CREATE INDEX IF NOT EXISTS idx_sessions_token ON sessions(token);
    CREATE INDEX IF NOT EXISTS idx_admin_whitelist_wallet ON admin_whitelist(wallet_address);
  `)

  testDb = drizzle(testSqlite, { schema })

  return testDb
}

/**
 * Clear all test data
 */
export function clearTestDatabase() {
  if (!testSqlite) return

  testSqlite.exec(`
    DELETE FROM generation_history;
    DELETE FROM voice_profiles;
    DELETE FROM assets;
    DELETE FROM projects;
    DELETE FROM api_keys;
    DELETE FROM sessions;
    DELETE FROM admin_whitelist;
    DELETE FROM users WHERE team_id IS NOT NULL;
    DELETE FROM teams;
    DELETE FROM users;
  `)
}

/**
 * Close test database connection
 */
export function closeTestDatabase() {
  if (testSqlite) {
    testSqlite.close()
    testSqlite = null
    testDb = null
  }
}

/**
 * Get test database instance
 */
export function getTestDb() {
  return testDb
}

/**
 * Get test SQLite instance
 */
export function getTestSqlite() {
  return testSqlite
}

// Export for use in tests
export { testDb, testSqlite }
