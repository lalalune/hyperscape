import { sqliteTable, text, real, integer, primaryKey } from 'drizzle-orm/sqlite-core';
import { sql } from 'drizzle-orm';

// Core players table - minimal user info
export const players = sqliteTable('players', {
  id: text('id').primaryKey(),
  username: text('username').unique().notNull(),
  createdAt: text('created_at').default(sql`CURRENT_TIMESTAMP`),
  lastSeen: text('last_seen').default(sql`CURRENT_TIMESTAMP`)
});

// Generic player state per world - stores any serialized player data
export const playerStates = sqliteTable('player_states', {
  playerId: text('player_id').references(() => players.id),
  worldId: text('world_id').notNull(),
  position: text('position').notNull(), // JSON {x, y, z}
  rotation: text('rotation').notNull(), // JSON {x, y, z, w}
  state: text('state'), // JSON - any custom player state data
  metadata: text('metadata'), // JSON - any additional metadata
  lastUpdated: integer('last_updated', { mode: 'timestamp' })
    .notNull()
    .default(sql`(unixepoch())`)
}, (table) => ({
  pk: primaryKey({ columns: [table.playerId, table.worldId] })
}));

// Generic entity states - stores any entity in the world
export const entityStates = sqliteTable('entity_states', {
  id: text('id').primaryKey(),
  entityId: text('entity_id').notNull(),
  worldId: text('world_id').notNull(),
  playerId: text('player_id'), // if this entity belongs to a player
  position: text('position').notNull(), // JSON
  rotation: text('rotation').notNull(), // JSON
  components: text('components').notNull(), // JSON - serialized components
  metadata: text('metadata'), // JSON - type, name, custom data
  lastUpdated: integer('last_updated', { mode: 'timestamp' })
    .notNull()
    .default(sql`(unixepoch())`)
});

// Generic world state - stores any world-level data
export const worldState = sqliteTable('world_state', {
  worldId: text('world_id').primaryKey(),
  state: text('state'), // JSON - any serialized world state
  metadata: text('metadata'), // JSON - version, settings, etc
  lastReset: text('last_reset'),
  createdAt: text('created_at').default(sql`CURRENT_TIMESTAMP`),
  updatedAt: text('updated_at').default(sql`CURRENT_TIMESTAMP`)
});

// UGC app storage - allows apps to store their own data
export const ugcAppStorage = sqliteTable('ugc_app_storage', {
  appId: text('app_id').notNull(),
  worldId: text('world_id').notNull(),
  key: text('key').notNull(),
  value: text('value'), // JSON - app-specific data
  playerId: text('player_id').references(() => players.id), // NULL for world-wide data
  createdAt: text('created_at').default(sql`CURRENT_TIMESTAMP`),
  updatedAt: text('updated_at').default(sql`CURRENT_TIMESTAMP`)
});

// Player sessions for tracking playtime
export const playerSessions = sqliteTable('player_sessions', {
  id: text('id').primaryKey(),
  playerId: text('player_id').references(() => players.id),
  worldId: text('world_id'),
  startTime: text('start_time').default(sql`CURRENT_TIMESTAMP`),
  endTime: text('end_time'),
  duration: integer('duration') // seconds
});

// Node states for world building/construction
export const nodeStates = sqliteTable('node_states', {
  id: text('id').primaryKey(),
  nodeId: text('node_id').notNull(),
  worldId: text('world_id').notNull(),
  parentId: text('parent_id'),
  position: text('position').notNull(), // JSON
  rotation: text('rotation').notNull(), // JSON
  scale: text('scale').notNull(), // JSON
  properties: text('properties').notNull(), // JSON - any node-specific properties
  metadata: text('metadata'), // JSON
  lastUpdated: integer('last_updated', { mode: 'timestamp' })
    .notNull()
    .default(sql`(unixepoch())`)
});

// Type exports
export type Player = typeof players.$inferSelect;
export type PlayerState = typeof playerStates.$inferSelect;
export type EntityState = typeof entityStates.$inferSelect;
export type WorldState = typeof worldState.$inferSelect;
export type UgcAppStorage = typeof ugcAppStorage.$inferSelect;
export type PlayerSession = typeof playerSessions.$inferSelect;
export type NodeState = typeof nodeStates.$inferSelect;

// Legacy aliases for compatibility
export const playerWorldState = playerStates;
export type PlayerWorldState = PlayerState;
