/**
 * Database Schema for Admin Panel
 * 
 * Mirrors the server schema for type consistency.
 * This is a read-only view - write operations should go through the game server.
 */

import {
  pgTable,
  text,
  integer,
  bigint,
  real,
  timestamp,
  serial,
  unique,
  index,
} from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';

// Users Table
export const users = pgTable(
  'users',
  {
    id: text('id').primaryKey(),
    name: text('name').notNull(),
    roles: text('roles').notNull(),
    createdAt: text('createdAt').notNull(),
    avatar: text('avatar'),
    wallet: text('wallet'),
    privyUserId: text('privyUserId').unique(),
    farcasterFid: text('farcasterFid'),
  },
  (table) => ({
    privyIdx: index('idx_users_privy').on(table.privyUserId),
    farcasterIdx: index('idx_users_farcaster').on(table.farcasterFid),
  }),
);

// Characters Table
export const characters = pgTable(
  'characters',
  {
    id: text('id').primaryKey(),
    accountId: text('accountId').notNull(),
    name: text('name').notNull(),
    createdAt: bigint('createdAt', { mode: 'number' }),
    
    // Combat stats
    combatLevel: integer('combatLevel').default(3),
    attackLevel: integer('attackLevel').default(1),
    strengthLevel: integer('strengthLevel').default(1),
    defenseLevel: integer('defenseLevel').default(1),
    constitutionLevel: integer('constitutionLevel').default(10),
    rangedLevel: integer('rangedLevel').default(1),
    
    // Gathering skills
    miningLevel: integer('miningLevel').default(1),
    woodcuttingLevel: integer('woodcuttingLevel').default(1),
    fishingLevel: integer('fishingLevel').default(1),
    firemakingLevel: integer('firemakingLevel').default(1),
    cookingLevel: integer('cookingLevel').default(1),
    
    // XP
    attackXp: integer('attackXp').default(0),
    strengthXp: integer('strengthXp').default(0),
    defenseXp: integer('defenseXp').default(0),
    constitutionXp: integer('constitutionXp').default(1154),
    rangedXp: integer('rangedXp').default(0),
    miningXp: integer('miningXp').default(0),
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
    
    attackStyle: text('attackStyle').default('accurate'),
    lastLogin: bigint('lastLogin', { mode: 'number' }).default(0),
    avatar: text('avatar'),
    wallet: text('wallet'),
    isAgent: integer('isAgent').default(0).notNull(),
  },
  (table) => ({
    accountIdx: index('idx_characters_account').on(table.accountId),
    walletIdx: index('idx_characters_wallet').on(table.wallet),
    isAgentIdx: index('idx_characters_is_agent').on(table.isAgent),
  }),
);

// Inventory Table
export const inventory = pgTable('inventory', {
  id: serial('id').primaryKey(),
  playerId: text('playerId').notNull(),
  itemId: text('itemId').notNull(),
  quantity: integer('quantity').default(1),
  slotIndex: integer('slotIndex').default(-1),
  metadata: text('metadata'),
});

// Equipment Table
export const equipment = pgTable(
  'equipment',
  {
    id: serial('id').primaryKey(),
    playerId: text('playerId').notNull(),
    slotType: text('slotType').notNull(),
    itemId: text('itemId'),
    quantity: integer('quantity').default(1),
  },
  (table) => ({
    uniquePlayerSlot: unique().on(table.playerId, table.slotType),
  }),
);

// Bank Storage Table
export const bankStorage = pgTable(
  'bank_storage',
  {
    id: serial('id').primaryKey(),
    playerId: text('playerId').notNull(),
    itemId: text('itemId').notNull(),
    quantity: integer('quantity').default(1).notNull(),
    slot: integer('slot').default(0).notNull(),
  },
  (table) => ({
    uniquePlayerSlot: unique().on(table.playerId, table.slot),
    playerIdx: index('idx_bank_storage_player').on(table.playerId),
  }),
);

// Player Sessions Table
export const playerSessions = pgTable('player_sessions', {
  id: text('id').primaryKey(),
  playerId: text('playerId').notNull(),
  sessionStart: bigint('sessionStart', { mode: 'number' }).notNull(),
  sessionEnd: bigint('sessionEnd', { mode: 'number' }),
  playtimeMinutes: integer('playtimeMinutes').default(0),
  reason: text('reason'),
  lastActivity: bigint('lastActivity', { mode: 'number' }).default(0),
});

// NPC Kills Table
export const npcKills = pgTable(
  'npc_kills',
  {
    id: serial('id').primaryKey(),
    playerId: text('playerId').notNull(),
    npcId: text('npcId').notNull(),
    killCount: integer('killCount').default(1).notNull(),
  },
  (table) => ({
    uniquePlayerNpc: unique().on(table.playerId, table.npcId),
    playerIdx: index('idx_npc_kills_player').on(table.playerId),
  }),
);

// Relations
export const usersRelations = relations(users, ({ many }) => ({
  characters: many(characters),
}));

export const charactersRelations = relations(characters, ({ one, many }) => ({
  account: one(users, {
    fields: [characters.accountId],
    references: [users.id],
  }),
  inventory: many(inventory),
  equipment: many(equipment),
  bankStorage: many(bankStorage),
  sessions: many(playerSessions),
  npcKills: many(npcKills),
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

export const bankStorageRelations = relations(bankStorage, ({ one }) => ({
  character: one(characters, {
    fields: [bankStorage.playerId],
    references: [characters.id],
  }),
}));

export const playerSessionsRelations = relations(playerSessions, ({ one }) => ({
  character: one(characters, {
    fields: [playerSessions.playerId],
    references: [characters.id],
  }),
}));

export const npcKillsRelations = relations(npcKills, ({ one }) => ({
  character: one(characters, {
    fields: [npcKills.playerId],
    references: [characters.id],
  }),
}));
