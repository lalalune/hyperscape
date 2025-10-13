import { pgTable, text, integer, bigint, real, timestamp, serial, unique, index } from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';

// Config table for system settings
export const config = pgTable('config', {
  key: text('key').primaryKey(),
  value: text('value'),
});

// Users table for authentication
export const users = pgTable('users', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  roles: text('roles').notNull(),
  createdAt: text('createdAt').notNull(),
  avatar: text('avatar'),
  privyUserId: text('privyUserId').unique(),
  farcasterFid: text('farcasterFid'),
}, (table) => ({
  privyIdx: index('idx_users_privy').on(table.privyUserId),
  farcasterIdx: index('idx_users_farcaster').on(table.farcasterFid),
}));

// Entities table for world objects
export const entities = pgTable('entities', {
  id: text('id').primaryKey(),
  data: text('data').notNull(),
  createdAt: timestamp('createdAt', { withTimezone: false }).defaultNow(),
  updatedAt: timestamp('updatedAt', { withTimezone: false }).defaultNow(),
});

// Characters table - the main player data store
export const characters = pgTable('characters', {
  id: text('id').primaryKey(),
  accountId: text('accountId').notNull(),
  name: text('name').notNull(),
  createdAt: bigint('createdAt', { mode: 'number' }).default(sql`(EXTRACT(EPOCH FROM NOW()) * 1000)::BIGINT`),
  
  // Combat stats
  combatLevel: integer('combatLevel').default(1),
  attackLevel: integer('attackLevel').default(1),
  strengthLevel: integer('strengthLevel').default(1),
  defenseLevel: integer('defenseLevel').default(1),
  constitutionLevel: integer('constitutionLevel').default(10),
  rangedLevel: integer('rangedLevel').default(1),
  
  // Gathering skills
  woodcuttingLevel: integer('woodcuttingLevel').default(1),
  fishingLevel: integer('fishingLevel').default(1),
  firemakingLevel: integer('firemakingLevel').default(1),
  cookingLevel: integer('cookingLevel').default(1),
  
  // Experience points
  attackXp: integer('attackXp').default(0),
  strengthXp: integer('strengthXp').default(0),
  defenseXp: integer('defenseXp').default(0),
  constitutionXp: integer('constitutionXp').default(1154),
  rangedXp: integer('rangedXp').default(0),
  woodcuttingXp: integer('woodcuttingXp').default(0),
  fishingXp: integer('fishingXp').default(0),
  firemakingXp: integer('firemakingXp').default(0),
  cookingXp: integer('cookingXp').default(0),
  
  // Status
  health: integer('health').default(100),
  maxHealth: integer('maxHealth').default(100),
  coins: integer('coins').default(0),
  
  // Position
  positionX: real('positionX').default(0),
  positionY: real('positionY').default(10),
  positionZ: real('positionZ').default(0),
  
  lastLogin: bigint('lastLogin', { mode: 'number' }).default(0),
}, (table) => ({
  accountIdx: index('idx_characters_account').on(table.accountId),
}));

// Items table
export const items = pgTable('items', {
  id: integer('id').primaryKey(),
  name: text('name').notNull(),
  type: text('type').notNull(),
  description: text('description'),
  value: integer('value').default(0),
  weight: real('weight').default(0),
  stackable: integer('stackable').default(0),
  tradeable: integer('tradeable').default(1),
  
  // Level requirements
  attackLevel: integer('attackLevel'),
  strengthLevel: integer('strengthLevel'),
  defenseLevel: integer('defenseLevel'),
  rangedLevel: integer('rangedLevel'),
  
  // Bonuses
  attackBonus: integer('attackBonus').default(0),
  strengthBonus: integer('strengthBonus').default(0),
  defenseBonus: integer('defenseBonus').default(0),
  rangedBonus: integer('rangedBonus').default(0),
  
  heals: integer('heals'),
});

// Inventory table
export const inventory = pgTable('inventory', {
  id: serial('id').primaryKey(),
  playerId: text('playerId').notNull().references(() => characters.id, { onDelete: 'cascade' }),
  itemId: text('itemId').notNull(),
  quantity: integer('quantity').default(1),
  slotIndex: integer('slotIndex').default(-1),
  metadata: text('metadata'),
});

// Equipment table
export const equipment = pgTable('equipment', {
  id: serial('id').primaryKey(),
  playerId: text('playerId').notNull().references(() => characters.id, { onDelete: 'cascade' }),
  slotType: text('slotType').notNull(),
  itemId: text('itemId'),
  quantity: integer('quantity').default(1),
}, (table) => ({
  uniquePlayerSlot: unique().on(table.playerId, table.slotType),
}));

// World chunks table
export const worldChunks = pgTable('world_chunks', {
  chunkX: integer('chunkX').notNull(),
  chunkZ: integer('chunkZ').notNull(),
  data: text('data').notNull(),
  lastActive: bigint('lastActive', { mode: 'number' }).default(sql`(EXTRACT(EPOCH FROM NOW()) * 1000)::BIGINT`),
  playerCount: integer('playerCount').default(0),
  version: integer('version').default(1),
  needsReset: integer('needsReset').default(0),
}, (table) => ({
  pk: unique().on(table.chunkX, table.chunkZ),
}));

// Player sessions table
export const playerSessions = pgTable('player_sessions', {
  id: text('id').primaryKey(),
  playerId: text('playerId').notNull().references(() => characters.id, { onDelete: 'cascade' }),
  sessionStart: bigint('sessionStart', { mode: 'number' }).notNull(),
  sessionEnd: bigint('sessionEnd', { mode: 'number' }),
  playtimeMinutes: integer('playtimeMinutes').default(0),
  reason: text('reason'),
  lastActivity: bigint('lastActivity', { mode: 'number' }).default(0),
});

// Chunk activity table
export const chunkActivity = pgTable('chunk_activity', {
  id: serial('id').primaryKey(),
  chunkX: integer('chunkX').notNull(),
  chunkZ: integer('chunkZ').notNull(),
  playerId: text('playerId').notNull().references(() => characters.id, { onDelete: 'cascade' }),
  entryTime: bigint('entryTime', { mode: 'number' }).notNull(),
  exitTime: bigint('exitTime', { mode: 'number' }),
});

// Storage table for key-value pairs
export const storage = pgTable('storage', {
  key: text('key').primaryKey(),
  value: text('value').notNull(),
  updatedAt: bigint('updatedAt', { mode: 'number' }).default(sql`(EXTRACT(EPOCH FROM NOW()) * 1000)::BIGINT`),
});

// Relations
export const charactersRelations = relations(characters, ({ many }) => ({
  inventory: many(inventory),
  equipment: many(equipment),
  sessions: many(playerSessions),
  chunkActivities: many(chunkActivity),
}));

export const inventoryRelations = relations(inventory, ({ one }) => ({
  character: one(characters, {
    fields: [inventory.playerId],
    references: [characters.id],
  }),
}));

export const equipmentRelations = relations(equipment, ({ one }) => ({
  character: one(characters, {
    fields: [equipment.playerId],
    references: [characters.id],
  }),
}));

export const playerSessionsRelations = relations(playerSessions, ({ one }) => ({
  character: one(characters, {
    fields: [playerSessions.playerId],
    references: [characters.id],
  }),
}));

export const chunkActivityRelations = relations(chunkActivity, ({ one }) => ({
  character: one(characters, {
    fields: [chunkActivity.playerId],
    references: [characters.id],
  }),
}));

// SQL template tag import for default values
import { sql } from 'drizzle-orm';
