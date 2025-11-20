-- Clear all user and character data from Hyperscape database
-- This will cascade to all related tables due to foreign key constraints

-- Disable triggers temporarily to avoid any issues
SET session_replication_role = replica;

-- Delete all data from tables with CASCADE relationships
-- Order matters: delete children before parents to avoid FK violations

-- Clear player-specific data (all have CASCADE DELETE from characters)
TRUNCATE TABLE player_deaths CASCADE;
TRUNCATE TABLE npc_kills CASCADE;
TRUNCATE TABLE chunk_activity CASCADE;
TRUNCATE TABLE player_sessions CASCADE;
TRUNCATE TABLE equipment CASCADE;
TRUNCATE TABLE inventory CASCADE;

-- Clear characters (main player data)
TRUNCATE TABLE characters CASCADE;

-- Clear users (account data)
TRUNCATE TABLE users CASCADE;

-- Re-enable triggers
SET session_replication_role = DEFAULT;

-- Verify tables are empty
SELECT 'users' as table_name, COUNT(*) as count FROM users
UNION ALL
SELECT 'characters', COUNT(*) FROM characters
UNION ALL
SELECT 'inventory', COUNT(*) FROM inventory
UNION ALL
SELECT 'equipment', COUNT(*) FROM equipment
UNION ALL
SELECT 'player_sessions', COUNT(*) FROM player_sessions
UNION ALL
SELECT 'chunk_activity', COUNT(*) FROM chunk_activity
UNION ALL
SELECT 'npc_kills', COUNT(*) FROM npc_kills
UNION ALL
SELECT 'player_deaths', COUNT(*) FROM player_deaths;
