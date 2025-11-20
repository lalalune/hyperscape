/**
 * Database Schema Definitions
 *
 * This module defines the complete database schema for Hyperscape using Drizzle ORM.
 * All tables, columns, indexes, and foreign key relationships are defined here.
 *
 * **Schema Overview**:
 *
 * **Core Tables**:
 * - `config`: System-wide key-value configuration store
 * - `storage`: World-specific key-value storage
 * - `users`: Account authentication and user profiles
 * - `entities`: Serialized world objects and props
 *
 * **Character System** (RuneScape-inspired):
 * - `characters`: Player characters with stats, levels, XP, and position
 *   - Combat skills: attack, strength, defense, constitution (health), ranged
 *   - Gathering skills: woodcutting, fishing, firemaking, cooking
 *   - Each skill has level and XP tracking
 * - `inventory`: Player item storage (28 slots with quantities and metadata)
 * - `equipment`: Worn/wielded items (weapon, armor, etc.) by slot type
 * - `items`: Item definitions (stats, bonuses, requirements)
 *
 * **Session Tracking**:
 * - `playerSessions`: Login/logout tracking, playtime, and activity monitoring
 * - `chunkActivity`: Tracks which chunks players are in for analytics
 *
 * **World Persistence**:
 * - `worldChunks`: Persistent modifications to terrain chunks (resources, buildings)
 * - Chunks use X,Z coordinates as compound primary key
 * - Includes player count and reset flags for dynamic world management
 *
 * **Indexing Strategy**:
 * - Privy/Farcaster user lookups: Indexed on privyUserId and farcasterFid
 * - Character queries: Indexed on accountId for fast character list lookups
 *
 * **Data Types**:
 * - Timestamps: bigint (Unix milliseconds) for precision and JavaScript compatibility
 * - Positions: real (float) for sub-block precision
 * - Skills: integer for levels and XP
 *
 * **Referenced by**: All database operations (DatabaseSystem, migrations, Drizzle client)
 */

/**
 * Database Schema - PostgreSQL table definitions for Hyperscape
 *
 * This file defines the entire database schema using Drizzle ORM's type-safe table builder.
 * All tables, columns, constraints, and relations are defined here.
 *
 * **Tables Overview**:
 * - `config` - Server configuration (spawn points, settings)
 * - `users` - Account authentication and roles
 * - `entities` - World entities (NPCs, items, buildings)
 * - `characters` - Player characters with stats, levels, and XP
 * - `items` - Item definitions (weapons, armor, resources)
 * - `inventory` - Player inventory items
 * - `equipment` - Equipped items by slot
 * - `worldChunks` - Persistent world modifications
 * - `playerSessions` - Login/logout tracking
 * - `chunkActivity` - Player movement through chunks
 * - `npcKills` - Player NPC kill statistics
 * - `storage` - Key-value storage for systems
 *
 * **Design Patterns**:
 * - Use bigint for timestamps (milliseconds since epoch)
 * - Use text for IDs (UUIDs as strings)
 * - Use serial for auto-incrementing PKs where appropriate
 * - Use foreign keys with cascade delete for data integrity
 *
 * **Migrations**:
 * Changes to this schema require new migrations. Run:
 * ```bash
 * pnpm --filter @hyperscape/server db:generate
 * ```
 *
 * **Referenced by**: client.ts (initialization), DatabaseSystem.ts (queries), drizzle-adapter.ts (legacy compat)
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
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";

/**
 * Config Table - Server configuration settings
 *
 * Stores key-value pairs for server config like spawn points, world settings, etc.
 * Used by ServerNetwork during initialization.
 */
export const config = pgTable("config", {
  key: text("key").primaryKey(),
  value: text("value"),
});

/**
 * Users Table - Account authentication and authorization
 *
 * Stores user accounts with authentication providers and roles.
 * Supports multiple auth methods (Privy, JWT, anonymous).
 *
 * Key columns:
 * - `id` - Unique user ID (often matches privyUserId for Privy users)
 * - `privyUserId` - Privy authentication ID (unique, indexed)
 * - `farcasterFid` - Farcaster Frame ID if linked (indexed)
 * - `roles` - Comma-separated roles (e.g., "admin,builder")
 */
export const users = pgTable(
  "users",
  {
    id: text("id").primaryKey(),
    name: text("name").notNull(),
    roles: text("roles").notNull(),
    createdAt: text("createdAt").notNull(),
    avatar: text("avatar"),
    privyUserId: text("privyUserId").unique(),
    farcasterFid: text("farcasterFid"),
  },
  (table) => ({
    privyIdx: index("idx_users_privy").on(table.privyUserId),
    farcasterIdx: index("idx_users_farcaster").on(table.farcasterFid),
  }),
);

/**
 * Entities Table - World objects and NPCs
 *
 * Stores persistent entities in the world (NPCs, items, buildings, etc.).
 * Data is serialized JSON containing position, type, and entity-specific properties.
 *
 * Note: Most entities are spawned dynamically and NOT stored here.
 * This table is for entities that need to persist across server restarts.
 */
export const entities = pgTable("entities", {
  id: text("id").primaryKey(),
  data: text("data").notNull(),
  createdAt: timestamp("createdAt", { withTimezone: false }).defaultNow(),
  updatedAt: timestamp("updatedAt", { withTimezone: false }).defaultNow(),
});

/**
 * Characters Table - Player character progression and state
 *
 * This is the core persistence table for all character data including:
 * - Combat stats (attack, strength, defense, constitution, ranged)
 * - Gathering skills (woodcutting, fishing, firemaking, cooking)
 * - Experience points (XP) for all skills
 * - Health, coins, and position
 * - Login tracking (createdAt, lastLogin)
 *
 * **Design**:
 * - Each user (account) can have multiple characters
 * - character.id is the primary key (UUID)
 * - accountId links to users.id
 * - All levels default to 1, constitution defaults to 10
 * - Constitution XP starts at 1154 (level 10)
 *
 * **Skills**:
 * Combat: attack, strength, defense, constitution (health), ranged
 * Gathering: woodcutting, fishing, firemaking, cooking
 *
 * **Foreign Keys**:
 * - inventory, equipment, sessions, chunkActivity all reference characters.id
 * - CASCADE DELETE ensures cleanup when character is deleted
 */
export const characters = pgTable(
  "characters",
  {
    id: text("id").primaryKey(),
    accountId: text("accountId").notNull(),
    name: text("name").notNull(),
    createdAt: bigint("createdAt", { mode: "number" }).default(
      sql`(EXTRACT(EPOCH FROM NOW()) * 1000)::BIGINT`,
    ),

    // Combat stats
    combatLevel: integer("combatLevel").default(1),
    attackLevel: integer("attackLevel").default(1),
    strengthLevel: integer("strengthLevel").default(1),
    defenseLevel: integer("defenseLevel").default(1),
    constitutionLevel: integer("constitutionLevel").default(10),
    rangedLevel: integer("rangedLevel").default(1),

    // Gathering skills
    woodcuttingLevel: integer("woodcuttingLevel").default(1),
    fishingLevel: integer("fishingLevel").default(1),
    firemakingLevel: integer("firemakingLevel").default(1),
    cookingLevel: integer("cookingLevel").default(1),

    // Experience points
    attackXp: integer("attackXp").default(0),
    strengthXp: integer("strengthXp").default(0),
    defenseXp: integer("defenseXp").default(0),
    constitutionXp: integer("constitutionXp").default(1154),
    rangedXp: integer("rangedXp").default(0),
    woodcuttingXp: integer("woodcuttingXp").default(0),
    fishingXp: integer("fishingXp").default(0),
    firemakingXp: integer("firemakingXp").default(0),
    cookingXp: integer("cookingXp").default(0),

    // Status
    health: integer("health").default(100),
    maxHealth: integer("maxHealth").default(100),
    coins: integer("coins").default(0),

    // Position
    positionX: real("positionX").default(0),
    positionY: real("positionY").default(10),
    positionZ: real("positionZ").default(0),

    lastLogin: bigint("lastLogin", { mode: "number" }).default(0),

    // Avatar and wallet
    avatar: text("avatar"),
    wallet: text("wallet"),

    // Agent flag - true if this character is controlled by an AI agent (ElizaOS)
    isAgent: integer("isAgent").default(0).notNull(), // SQLite: 0=false, 1=true
  },
  (table) => ({
    accountIdx: index("idx_characters_account").on(table.accountId),
    walletIdx: index("idx_characters_wallet").on(table.wallet),
    isAgentIdx: index("idx_characters_is_agent").on(table.isAgent),
  }),
);

/**
 * Items Table - Item definitions and stats
 *
 * Defines all items in the game with their properties and requirements.
 * This is a reference table - items in inventories reference these by ID.
 *
 * Key properties:
 * - Level requirements (attackLevel, strengthLevel, etc.)
 * - Combat bonuses (attackBonus, strengthBonus, etc.)
 * - Healing value (heals)
 * - Stackability and tradability
 *
 * Note: Currently not heavily used. Item data is mostly defined in shared/items.ts.
 * This table exists for future database-driven item definitions.
 */
export const items = pgTable("items", {
  id: integer("id").primaryKey(),
  name: text("name").notNull(),
  type: text("type").notNull(),
  description: text("description"),
  value: integer("value").default(0),
  weight: real("weight").default(0),
  stackable: integer("stackable").default(0),
  tradeable: integer("tradeable").default(1),

  // Level requirements
  attackLevel: integer("attackLevel"),
  strengthLevel: integer("strengthLevel"),
  defenseLevel: integer("defenseLevel"),
  rangedLevel: integer("rangedLevel"),

  // Bonuses
  attackBonus: integer("attackBonus").default(0),
  strengthBonus: integer("strengthBonus").default(0),
  defenseBonus: integer("defenseBonus").default(0),
  rangedBonus: integer("rangedBonus").default(0),

  heals: integer("heals"),
});

/**
 * Inventory Table - Player inventory items
 *
 * Stores items in a player's inventory (28 slots like RuneScape).
 * Each row represents one stack of items in one slot.
 *
 * Key columns:
 * - `playerId` - References characters.id (CASCADE DELETE)
 * - `itemId` - Item identifier (string, not FK to items table)
 * - `quantity` - Stack size (1+ for stackable items)
 * - `slotIndex` - Position in inventory (0-27, or -1 for unslotted)
 * - `metadata` - JSON string for item-specific data (enchantments, durability, etc.)
 *
 * Design notes:
 * - slotIndex can be -1 for items being moved
 * - No unique constraint on slotIndex (items can temporarily overlap during moves)
 * - CASCADE DELETE ensures cleanup when character is deleted
 */
export const inventory = pgTable("inventory", {
  id: serial("id").primaryKey(),
  playerId: text("playerId")
    .notNull()
    .references(() => characters.id, { onDelete: "cascade" }),
  itemId: text("itemId").notNull(),
  quantity: integer("quantity").default(1),
  slotIndex: integer("slotIndex").default(-1),
  metadata: text("metadata"),
});

/**
 * Equipment Table - Items worn/wielded by player
 *
 * Stores equipped items in specific slots (weapon, helmet, body, etc.).
 * Each slot can hold exactly one item.
 *
 * Key columns:
 * - `playerId` - References characters.id (CASCADE DELETE)
 * - `slotType` - Equipment slot ("weapon", "head", "body", "legs", "shield", etc.)
 * - `itemId` - Item equipped in this slot (null if empty)
 * - `quantity` - Usually 1 for equipment (some items like arrows may stack)
 *
 * Design notes:
 * - Unique constraint on (playerId, slotType) ensures one item per slot
 * - itemId can be null for empty slots
 * - CASCADE DELETE ensures cleanup when character is deleted
 */
export const equipment = pgTable(
  "equipment",
  {
    id: serial("id").primaryKey(),
    playerId: text("playerId")
      .notNull()
      .references(() => characters.id, { onDelete: "cascade" }),
    slotType: text("slotType").notNull(),
    itemId: text("itemId"),
    quantity: integer("quantity").default(1),
  },
  (table) => ({
    uniquePlayerSlot: unique().on(table.playerId, table.slotType),
  }),
);

/**
 * World Chunks Table - Persistent world state
 *
 * Stores modifications to world chunks (resources, buildings, terrain changes).
 * Each chunk is identified by X,Z coordinates.
 *
 * Key columns:
 * - `chunkX`, `chunkZ` - Chunk coordinates (composite key)
 * - `data` - Serialized chunk data (JSON string)
 * - `lastActive` - Timestamp of last player activity in chunk
 * - `playerCount` - Number of players currently in chunk
 * - `needsReset` - Flag to mark chunk for regeneration (1=true, 0=false)
 *
 * Design notes:
 * - Unique constraint on (chunkX, chunkZ)
 * - Chunks not in this table use default procedural generation
 * - lastActive used for garbage collection of old chunks
 */
export const worldChunks = pgTable(
  "world_chunks",
  {
    chunkX: integer("chunkX").notNull(),
    chunkZ: integer("chunkZ").notNull(),
    data: text("data").notNull(),
    lastActive: bigint("lastActive", { mode: "number" }).default(
      sql`(EXTRACT(EPOCH FROM NOW()) * 1000)::BIGINT`,
    ),
    playerCount: integer("playerCount").default(0),
    version: integer("version").default(1),
    needsReset: integer("needsReset").default(0),
  },
  (table) => ({
    pk: unique().on(table.chunkX, table.chunkZ),
  }),
);

/**
 * Player Sessions Table - Login/logout tracking and analytics
 *
 * Tracks when players join and leave the server for analytics and idle detection.
 * One row per gaming session.
 *
 * Key columns:
 * - `id` - Session ID (primary key)
 * - `playerId` - References characters.id (CASCADE DELETE)
 * - `sessionStart` - Login timestamp (milliseconds)
 * - `sessionEnd` - Logout timestamp (null while active)
 * - `playtimeMinutes` - Total session duration
 * - `lastActivity` - Last action timestamp (for idle detection)
 * - `reason` - Disconnect reason ("normal", "timeout", "kick", etc.)
 *
 * Design notes:
 * - sessionEnd is null for active sessions
 * - Used for analytics, playtime tracking, and idle player detection
 * - CASCADE DELETE ensures cleanup when character is deleted
 */
export const playerSessions = pgTable("player_sessions", {
  id: text("id").primaryKey(),
  playerId: text("playerId")
    .notNull()
    .references(() => characters.id, { onDelete: "cascade" }),
  sessionStart: bigint("sessionStart", { mode: "number" }).notNull(),
  sessionEnd: bigint("sessionEnd", { mode: "number" }),
  playtimeMinutes: integer("playtimeMinutes").default(0),
  reason: text("reason"),
  lastActivity: bigint("lastActivity", { mode: "number" }).default(0),
});

/**
 * Chunk Activity Table - Player movement tracking
 *
 * Records when players enter and exit chunks for analytics and chunk management.
 * Used to determine which chunks are active and should remain loaded.
 *
 * Key columns:
 * - `chunkX`, `chunkZ` - Chunk coordinates
 * - `playerId` - References characters.id (CASCADE DELETE)
 * - `entryTime` - When player entered chunk (milliseconds)
 * - `exitTime` - When player left chunk (null while in chunk)
 *
 * Design notes:
 * - exitTime is null while player is still in the chunk
 * - Used for chunk loading/unloading decisions
 * - CASCADE DELETE ensures cleanup when character is deleted
 */
export const chunkActivity = pgTable("chunk_activity", {
  id: serial("id").primaryKey(),
  chunkX: integer("chunkX").notNull(),
  chunkZ: integer("chunkZ").notNull(),
  playerId: text("playerId")
    .notNull()
    .references(() => characters.id, { onDelete: "cascade" }),
  entryTime: bigint("entryTime", { mode: "number" }).notNull(),
  exitTime: bigint("exitTime", { mode: "number" }),
});

/**
 * Storage Table - Generic key-value persistence
 *
 * Provides simple key-value storage for systems that need to persist state.
 * Used by the Storage system for miscellaneous data that doesn't fit other tables.
 *
 * Key columns:
 * - `key` - Unique identifier (primary key)
 * - `value` - Arbitrary data (JSON string)
 * - `updatedAt` - Last modification timestamp
 *
 * Usage examples:
 * - System preferences
 * - Feature flags
 * - Temporary state that doesn't warrant its own table
 */
export const storage = pgTable("storage", {
  key: text("key").primaryKey(),
  value: text("value").notNull(),
  updatedAt: bigint("updatedAt", { mode: "number" }).default(
    sql`(EXTRACT(EPOCH FROM NOW()) * 1000)::BIGINT`,
  ),
});

/**
 * NPC Kills Table - Player kill statistics
 *
 * Tracks how many times each player has killed each NPC type.
 * Used for achievements, quests, and player statistics.
 *
 * Key columns:
 * - `id` - Auto-incrementing primary key
 * - `playerId` - References characters.id (CASCADE DELETE)
 * - `npcId` - The NPC type identifier (e.g., "goblin", "dragon")
 * - `killCount` - Number of times this player has killed this NPC type
 *
 * Design notes:
 * - Unique constraint on (playerId, npcId) ensures one row per player per NPC type
 * - killCount increments each time the player kills that NPC type
 * - CASCADE DELETE ensures cleanup when character is deleted
 * - Indexed on playerId for fast lookups of player kill stats
 */
export const npcKills = pgTable(
  "npc_kills",
  {
    id: serial("id").primaryKey(),
    playerId: text("playerId")
      .notNull()
      .references(() => characters.id, { onDelete: "cascade" }),
    npcId: text("npcId").notNull(),
    killCount: integer("killCount").default(1).notNull(),
  },
  (table) => ({
    uniquePlayerNpc: unique().on(table.playerId, table.npcId),
    playerIdx: index("idx_npc_kills_player").on(table.playerId),
  }),
);

/**
 * Player Deaths Table - Active death lock tracking
 *
 * Stores death locks for players who have died and need to retrieve their items.
 * CRITICAL: This table prevents item duplication exploits on server restart.
 *
 * Key columns:
 * - `playerId` - References characters.id (CASCADE DELETE)
 * - `gravestoneId` - ID of gravestone entity (nullable if wilderness death)
 * - `groundItemIds` - JSON array of ground item entity IDs
 * - `position` - JSON object {x, y, z} of death location
 * - `timestamp` - When player died (Unix milliseconds)
 * - `zoneType` - "safe_area" | "wilderness" | "pvp_zone"
 * - `itemCount` - Number of items dropped (for cleanup validation)
 *
 * **Security**: Server restart loads these records to restore death state.
 * Without this table, server restart = item duplication exploit.
 *
 * **Lifecycle**: Row created on death, deleted when player respawns or loots all items.
 */
export const playerDeaths = pgTable(
  "player_deaths",
  {
    playerId: text("playerId")
      .primaryKey()
      .references(() => characters.id, { onDelete: "cascade" }),
    gravestoneId: text("gravestoneId"),
    groundItemIds: text("groundItemIds"), // JSON array: ["item1", "item2", ...]
    position: text("position").notNull(), // JSON: {"x": 0, "y": 0, "z": 0}
    timestamp: bigint("timestamp", { mode: "number" }).notNull(),
    zoneType: text("zoneType").notNull(), // "safe_area" | "wilderness" | "pvp_zone"
    itemCount: integer("itemCount").default(0).notNull(),
    createdAt: bigint("createdAt", { mode: "number" })
      .notNull()
      .default(sql`(EXTRACT(EPOCH FROM NOW()) * 1000)::BIGINT`),
    updatedAt: bigint("updatedAt", { mode: "number" })
      .notNull()
      .default(sql`(EXTRACT(EPOCH FROM NOW()) * 1000)::BIGINT`),
  },
  (table) => ({
    timestampIdx: index("idx_player_deaths_timestamp").on(table.timestamp),
  }),
);

/**
 * ============================================================================
 * TABLE RELATIONS
 * ============================================================================
 *
 * Drizzle relations define how tables are connected for type-safe joins.
 * These don't create database constraints - they're TypeScript-only for queries.
 *
 * Relationship structure:
 * - characters → inventory (one-to-many)
 * - characters → equipment (one-to-many)
 * - characters → sessions (one-to-many)
 * - characters → chunkActivities (one-to-many)
 *
 * All child tables (inventory, equipment, etc.) have many-to-one back to characters.
 */

export const charactersRelations = relations(characters, ({ many }) => ({
  inventory: many(inventory),
  equipment: many(equipment),
  sessions: many(playerSessions),
  chunkActivities: many(chunkActivity),
  npcKills: many(npcKills),
  deaths: many(playerDeaths),
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

export const npcKillsRelations = relations(npcKills, ({ one }) => ({
  character: one(characters, {
    fields: [npcKills.playerId],
    references: [characters.id],
  }),
}));

export const playerDeathsRelations = relations(playerDeaths, ({ one }) => ({
  character: one(characters, {
    fields: [playerDeaths.playerId],
    references: [characters.id],
  }),
}));

/**
 * SQL template tag for raw SQL expressions
 *
 * Used in default values for timestamps to execute PostgreSQL functions.
 * Example: default(sql`(EXTRACT(EPOCH FROM NOW()) * 1000)::BIGINT`)
 * This converts PostgreSQL's NOW() to milliseconds since epoch.
 */
import { sql } from "drizzle-orm";
