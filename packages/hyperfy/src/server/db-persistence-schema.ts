import { sqliteTable, text, real, integer, primaryKey } from 'drizzle-orm/sqlite-core';
import { sql } from 'drizzle-orm';

// Players table
export const players = sqliteTable('players', {
  id: text('id').primaryKey(),
  username: text('username').unique().notNull(),
  createdAt: text('created_at').default(sql`CURRENT_TIMESTAMP`),
  lastSeen: text('last_seen').default(sql`CURRENT_TIMESTAMP`)
});

// Player world state table
export const playerWorldState = sqliteTable('player_world_state', {
  playerId: text('player_id').references(() => players.id),
  worldId: text('world_id').notNull(),
  positionX: real('position_x'),
  positionY: real('position_y'),
  positionZ: real('position_z'),
  rotationY: real('rotation_y'),
  health: integer('health'),
  lastUpdated: text('last_updated').default(sql`CURRENT_TIMESTAMP`)
}, (table) => ({
  pk: primaryKey({ columns: [table.playerId, table.worldId] })
}));

// UGC app storage table
export const ugcAppStorage = sqliteTable('ugc_app_storage', {
  appId: text('app_id').notNull(),
  worldId: text('world_id').notNull(),
  key: text('key').notNull(),
  value: text('value'), // JSON serialized
  playerId: text('player_id').references(() => players.id), // NULL for world-wide data
  createdAt: text('created_at').default(sql`CURRENT_TIMESTAMP`),
  updatedAt: text('updated_at').default(sql`CURRENT_TIMESTAMP`)
});

// World state table
export const worldState = sqliteTable('world_state', {
  worldId: text('world_id').primaryKey(),
  state: text('state'), // JSON serialized world state
  lastReset: text('last_reset'),
  createdAt: text('created_at').default(sql`CURRENT_TIMESTAMP`),
  updatedAt: text('updated_at').default(sql`CURRENT_TIMESTAMP`)
});

// Player sessions table
export const playerSessions = sqliteTable('player_sessions', {
  id: text('id').primaryKey(),
  playerId: text('player_id').references(() => players.id),
  worldId: text('world_id'),
  startTime: text('start_time').default(sql`CURRENT_TIMESTAMP`),
  endTime: text('end_time'),
  duration: integer('duration') // seconds
});

// RPG Player Stats table (legacy name for compatibility)
export const rpgPlayerStats = sqliteTable('player_skills', {
  playerId: text('player_id').references(() => players.id),
  worldId: text('world_id').notNull(),
  skillType: text('skill_type').notNull(),
  level: integer('level').default(1),
  experience: integer('experience').default(0),
  updatedAt: text('updated_at').default(sql`CURRENT_TIMESTAMP`)
}, (table) => ({
  pk: primaryKey({ columns: [table.playerId, table.worldId, table.skillType] })
}));

// Alias for consistency
export const playerSkills = rpgPlayerStats;

// RPG Player Inventory table (legacy name for compatibility)
export const rpgPlayerInventory = sqliteTable('player_inventory', {
  playerId: text('player_id').references(() => players.id),
  worldId: text('world_id').notNull(),
  slot: integer('slot').notNull(),
  itemId: integer('item_id').notNull(),
  quantity: integer('quantity').default(1),
  metadata: text('metadata') // JSON for item-specific data
}, (table) => ({
  pk: primaryKey({ columns: [table.playerId, table.worldId, table.slot] })
}));

// Alias for consistency
export const playerInventory = rpgPlayerInventory;

// Player Equipment table
export const playerEquipment = sqliteTable('player_equipment', {
  playerId: text('player_id').references(() => players.id),
  worldId: text('world_id').notNull(),
  slot: text('slot').notNull(), // head, cape, neck, weapon, body, shield, legs, hands, feet, ring, ammo
  itemId: integer('item_id').notNull(),
  metadata: text('metadata') // JSON for item-specific data
}, (table) => ({
  pk: primaryKey({ columns: [table.playerId, table.worldId, table.slot] })
}));

// Player Bank table
export const playerBank = sqliteTable('player_bank', {
  playerId: text('player_id').references(() => players.id),
  worldId: text('world_id').notNull(),
  itemId: integer('item_id').notNull(),
  quantity: integer('quantity').default(0)
}, (table) => ({
  pk: primaryKey({ columns: [table.playerId, table.worldId, table.itemId] })
}));

// Player Quests table
export const playerQuests = sqliteTable('player_quests', {
  playerId: text('player_id').references(() => players.id),
  worldId: text('world_id').notNull(),
  questId: text('quest_id').notNull(),
  status: text('status').default('not_started'), // not_started, started, completed, failed
  progress: text('progress'), // JSON for quest-specific progress data
  updatedAt: text('updated_at').default(sql`CURRENT_TIMESTAMP`)
}, (table) => ({
  pk: primaryKey({ columns: [table.playerId, table.worldId, table.questId] })
}));

// World entities table
export const worldEntities = sqliteTable('world_entities', {
  id: text('id').primaryKey(),
  worldId: text('world_id').notNull(),
  entityType: text('entity_type').notNull(),
  position: text('position').notNull(), // JSON
  properties: text('properties'), // JSON
  createdAt: text('created_at').default(sql`CURRENT_TIMESTAMP`),
  updatedAt: text('updated_at').default(sql`CURRENT_TIMESTAMP`)
});

// World items table (ground items)
export const worldItems = sqliteTable('world_items', {
  id: text('id').primaryKey(),
  worldId: text('world_id').notNull(),
  itemId: integer('item_id').notNull(),
  position: text('position').notNull(), // JSON
  quantity: integer('quantity').default(1),
  droppedBy: text('dropped_by'),
  privateFor: text('private_for'), // player_id for private drops
  expiresAt: text('expires_at'),
  createdAt: text('created_at').default(sql`CURRENT_TIMESTAMP`)
});

// Alias for legacy name
export const rpgWorldItems = worldItems;

// Grand Exchange offers table
export const grandExchangeOffers = sqliteTable('grand_exchange_offers', {
  id: text('id').primaryKey(),
  worldId: text('world_id').notNull(),
  playerId: text('player_id').references(() => players.id),
  itemId: integer('item_id').notNull(),
  offerType: text('offer_type').notNull(), // buy or sell
  price: integer('price').notNull(),
  quantity: integer('quantity').notNull(),
  remainingQuantity: integer('remaining_quantity').notNull(),
  status: text('status').default('active'), // active, completed, cancelled
  createdAt: text('created_at').default(sql`CURRENT_TIMESTAMP`),
  updatedAt: text('updated_at').default(sql`CURRENT_TIMESTAMP`)
});

// Market history table
export const marketHistory = sqliteTable('market_history', {
  id: text('id').primaryKey(),
  worldId: text('world_id').notNull(),
  itemId: integer('item_id').notNull(),
  price: integer('price').notNull(),
  quantity: integer('quantity').notNull(),
  transactionType: text('transaction_type').notNull(), // buy or sell
  buyerId: text('buyer_id').references(() => players.id),
  sellerId: text('seller_id').references(() => players.id),
  createdAt: text('created_at').default(sql`CURRENT_TIMESTAMP`)
});

// Entity state table
export const entityStates = sqliteTable('entity_states', {
  id: text('id').primaryKey(),
  entityId: text('entity_id').notNull(),
  worldId: text('world_id').notNull(),
  playerId: text('player_id'),
  position: text('position').notNull(), // JSON
  rotation: text('rotation').notNull(), // JSON
  components: text('components').notNull(), // JSON
  metadata: text('metadata'), // JSON
  lastUpdated: integer('last_updated', { mode: 'timestamp' })
    .notNull()
    .default(sql`(unixepoch())`)
});

// Node state table
export const nodeStates = sqliteTable('node_states', {
  id: text('id').primaryKey(),
  nodeId: text('node_id').notNull(),
  worldId: text('world_id').notNull(),
  parentId: text('parent_id'),
  position: text('position').notNull(), // JSON
  rotation: text('rotation').notNull(), // JSON
  scale: text('scale').notNull(), // JSON
  properties: text('properties').notNull(), // JSON
  metadata: text('metadata'), // JSON
  lastUpdated: integer('last_updated', { mode: 'timestamp' })
    .notNull()
    .default(sql`(unixepoch())`)
});

// Player state table
export const playerStates = sqliteTable('player_states', {
  id: text('id').primaryKey(),
  playerId: text('player_id').notNull(),
  worldId: text('world_id').notNull(),
  username: text('username').notNull(),
  avatarUrl: text('avatar_url'),
  position: text('position').notNull(), // JSON
  rotation: text('rotation').notNull(), // JSON
  state: text('state'), // JSON - custom player state
  metadata: text('metadata'), // JSON
  lastSeen: integer('last_seen', { mode: 'timestamp' })
    .notNull()
    .default(sql`(unixepoch())`)
});

// Type exports
export type Player = typeof players.$inferSelect;
export type PlayerWorldState = typeof playerWorldState.$inferSelect;
export type UgcAppStorage = typeof ugcAppStorage.$inferSelect;
export type WorldState = typeof worldState.$inferSelect;
export type PlayerSession = typeof playerSessions.$inferSelect;
export type PlayerSkill = typeof playerSkills.$inferSelect;
export type PlayerInventory = typeof playerInventory.$inferSelect;
export type PlayerEquipment = typeof playerEquipment.$inferSelect;
export type PlayerBank = typeof playerBank.$inferSelect;
export type PlayerQuest = typeof playerQuests.$inferSelect;
export type WorldEntity = typeof worldEntities.$inferSelect;
export type WorldItem = typeof worldItems.$inferSelect;
export type GrandExchangeOffer = typeof grandExchangeOffers.$inferSelect;
export type MarketHistory = typeof marketHistory.$inferSelect;
export type EntityState = typeof entityStates.$inferSelect;
export type NodeState = typeof nodeStates.$inferSelect;
export type PlayerState = typeof playerStates.$inferSelect;
