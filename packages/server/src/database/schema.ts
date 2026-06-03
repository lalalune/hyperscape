/**
 * Database Schema Definitions
 *
 * This module defines the complete database schema for Hyperia using Drizzle ORM.
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
 *   - Combat skills: attack, strength, defense, constitution (health), ranged, prayer
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
 * Database Schema - PostgreSQL table definitions for Hyperia
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
 * pnpm --filter @hyperforge/server db:generate
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
  uniqueIndex,
  index,
  jsonb,
  boolean,
} from "drizzle-orm/pg-core";
import { relations, sql } from "drizzle-orm";

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
 * - `wallet` - Main Privy embedded wallet address (HD index 0)
 */
export const users = pgTable(
  "users",
  {
    id: text("id").primaryKey(),
    name: text("name").notNull(),
    roles: text("roles").notNull(),
    createdAt: text("createdAt").notNull(),
    avatar: text("avatar"),
    wallet: text("wallet"),
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
 * Combat: attack, strength, defense, constitution (health), ranged, prayer
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
    combatLevel: integer("combatLevel").default(3),
    attackLevel: integer("attackLevel").default(1),
    strengthLevel: integer("strengthLevel").default(1),
    defenseLevel: integer("defenseLevel").default(1),
    constitutionLevel: integer("constitutionLevel").default(10),
    rangedLevel: integer("rangedLevel").default(1),
    magicLevel: integer("magicLevel").default(1),

    // Prayer skill
    prayerLevel: integer("prayerLevel").default(1),

    // Gathering skills
    woodcuttingLevel: integer("woodcuttingLevel").default(1),
    miningLevel: integer("miningLevel").default(1),
    fishingLevel: integer("fishingLevel").default(1),
    firemakingLevel: integer("firemakingLevel").default(1),
    cookingLevel: integer("cookingLevel").default(1),
    smithingLevel: integer("smithingLevel").default(1),
    agilityLevel: integer("agilityLevel").default(1),
    craftingLevel: integer("craftingLevel").default(1),
    fletchingLevel: integer("fletchingLevel").default(1),
    runecraftingLevel: integer("runecraftingLevel").default(1),

    // Experience points
    attackXp: integer("attackXp").default(0),
    strengthXp: integer("strengthXp").default(0),
    defenseXp: integer("defenseXp").default(0),
    constitutionXp: integer("constitutionXp").default(1154),
    rangedXp: integer("rangedXp").default(0),
    magicXp: integer("magicXp").default(0),
    prayerXp: integer("prayerXp").default(0),
    woodcuttingXp: integer("woodcuttingXp").default(0),
    miningXp: integer("miningXp").default(0),
    fishingXp: integer("fishingXp").default(0),
    firemakingXp: integer("firemakingXp").default(0),
    cookingXp: integer("cookingXp").default(0),
    smithingXp: integer("smithingXp").default(0),
    agilityXp: integer("agilityXp").default(0),
    craftingXp: integer("craftingXp").default(0),
    fletchingXp: integer("fletchingXp").default(0),
    runecraftingXp: integer("runecraftingXp").default(0),

    // Prayer points (current and max)
    prayerPoints: integer("prayerPoints").default(1),
    prayerMaxPoints: integer("prayerMaxPoints").default(1),

    /**
     * Active prayers stored as JSONB array of prayer ID strings.
     * Format: '["thick_skin", "burst_of_strength"]'
     * IDs must match valid entries in prayers.json manifest.
     * Empty array '[]' when no prayers are active.
     *
     * JSONB provides better performance for JSON operations and allows indexing.
     */
    activePrayers: jsonb("activePrayers").$type<string[]>().default([]),

    // Status
    health: integer("health").default(100),
    maxHealth: integer("maxHealth").default(100),
    coins: integer("coins").default(0),

    // Position
    positionX: real("positionX").default(0),
    positionY: real("positionY").default(10),
    positionZ: real("positionZ").default(0),

    // Combat preferences
    attackStyle: text("attackStyle").default("accurate"),
    autoRetaliate: integer("autoRetaliate").default(1).notNull(), // 1=ON (default), 0=OFF
    selectedSpell: text("selectedSpell"), // Autocast spell ID (null = no autocast)

    lastLogin: bigint("lastLogin", { mode: "number" }).default(0),

    // Avatar and wallet
    avatar: text("avatar"),
    wallet: text("wallet"),

    // Agent flag - true if this character is controlled by an AI agent (ElizaOS)
    isAgent: integer("isAgent").default(0).notNull(), // SQLite: 0=false, 1=true

    // Bank settings
    alwaysSetPlaceholder: integer("alwaysSetPlaceholder").default(0).notNull(), // SQLite: 0=false, 1=true

    // Quest progression
    questPoints: integer("questPoints").default(0).notNull(),
  },
  (table) => ({
    accountIdx: index("idx_characters_account").on(table.accountId),
    walletIdx: index("idx_characters_wallet").on(table.wallet),
    isAgentIdx: index("idx_characters_is_agent").on(table.isAgent),
  }),
);

/**
 * Agent Mappings Table - Tracks ElizaOS agent ownership
 *
 * Maps ElizaOS agent UUIDs to Hyperia users and characters.
 * This allows the dashboard to filter agents by user since ElizaOS doesn't expose this.
 *
 * Key columns:
 * - `agentId` - ElizaOS agent UUID (primary key)
 * - `accountId` - References users.id (CASCADE DELETE)
 * - `characterId` - References characters.id (CASCADE DELETE)
 * - `agentName` - Agent name (denormalized for performance)
 * - `createdAt` - When mapping was created
 * - `updatedAt` - Last sync timestamp
 *
 * Design notes:
 * - Created when user creates an AI agent through Character Editor
 * - Deleted automatically when user/character is deleted (CASCADE)
 * - Used by Dashboard to filter "My Agents" without relying on ElizaOS API
 */
export const agentMappings = pgTable(
  "agent_mappings",
  {
    agentId: text("agent_id").primaryKey().notNull(),
    accountId: text("account_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    characterId: text("character_id")
      .notNull()
      .references(() => characters.id, { onDelete: "cascade" }),
    agentName: text("agent_name").notNull(),
    /** When false, agent is excluded from streaming duel cycles (summon + matchmaking). */
    streamingDuelEnabled: boolean("streaming_duel_enabled")
      .notNull()
      .default(true),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => ({
    accountIdx: index("idx_agent_mappings_account").on(table.accountId),
    characterIdx: index("idx_agent_mappings_character").on(table.characterId),
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
 * - slotIndex can be -1 for items being moved (unassigned)
 * - Partial unique constraint on (playerId, slotIndex) WHERE slotIndex >= 0
 * - CASCADE DELETE ensures cleanup when character is deleted
 */
export const inventory = pgTable(
  "inventory",
  {
    id: serial("id").primaryKey(),
    playerId: text("playerId")
      .notNull()
      .references(() => characters.id, { onDelete: "cascade" }),
    itemId: text("itemId").notNull(),
    quantity: integer("quantity").default(1),
    slotIndex: integer("slotIndex").default(-1),
    metadata: text("metadata"),
  },
  (table) => ({
    // Partial unique index: only one item per slot when slotIndex >= 0
    // slotIndex = -1 means "unassigned" and can have duplicates
    playerSlotUnique: uniqueIndex("inventory_player_slot_unique")
      .on(table.playerId, table.slotIndex)
      .where(sql`"slotIndex" >= 0`),
  }),
);

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
 * Bank Storage Table - Player bank item storage
 *
 * Stores items deposited in banks. All items stack in bank (MVP simplification).
 * Shared storage - same items accessible from any bank location.
 *
 * Key columns:
 * - `playerId` - References characters.id (CASCADE DELETE)
 * - `itemId` - Item identifier (matches inventory itemId format)
 * - `quantity` - Stack size (all items stack in bank)
 * - `slot` - Bank slot index (0-479, 480 max slots)
 * - `tabIndex` - Which tab the item belongs to (0 = main tab, 1-9 = custom tabs)
 *
 * Design notes:
 * - All items stack in bank for simplicity
 * - Unique constraint on (playerId, tabIndex, slot) ensures one item per slot per tab
 * - CASCADE DELETE ensures cleanup when character is deleted
 */
export const bankStorage = pgTable(
  "bank_storage",
  {
    id: serial("id").primaryKey(),
    playerId: text("playerId")
      .notNull()
      .references(() => characters.id, { onDelete: "cascade" }),
    itemId: text("itemId").notNull(),
    quantity: integer("quantity").default(1).notNull(),
    slot: integer("slot").default(0).notNull(),
    tabIndex: integer("tabIndex").default(0).notNull(),
  },
  (table) => ({
    uniquePlayerTabSlot: unique().on(
      table.playerId,
      table.tabIndex,
      table.slot,
    ),
    playerIdx: index("idx_bank_storage_player").on(table.playerId),
    playerTabIdx: index("idx_bank_storage_player_tab").on(
      table.playerId,
      table.tabIndex,
    ),
  }),
);

/**
 * Bank Tabs Table - Custom bank tab configuration
 *
 * Stores custom bank tabs created by players (OSRS-style).
 * Tab 0 (main tab) is implicit and not stored here.
 *
 * Key columns:
 * - `playerId` - References characters.id (CASCADE DELETE)
 * - `tabIndex` - Tab position (1-9, main tab 0 is implicit)
 * - `iconItemId` - Item ID used for tab icon (first item deposited)
 *
 * Design notes:
 * - Max 9 custom tabs per player (1-9)
 * - Unique constraint on (playerId, tabIndex)
 * - Tab icon defaults to first item in tab
 * - Empty tabs auto-delete (handled in application logic)
 */
export const bankTabs = pgTable(
  "bank_tabs",
  {
    id: serial("id").primaryKey(),
    playerId: text("playerId")
      .notNull()
      .references(() => characters.id, { onDelete: "cascade" }),
    tabIndex: integer("tabIndex").notNull(),
    iconItemId: text("iconItemId"),
    createdAt: bigint("createdAt", { mode: "number" })
      .notNull()
      .default(sql`(EXTRACT(EPOCH FROM NOW()) * 1000)::BIGINT`),
  },
  (table) => ({
    uniquePlayerTab: unique().on(table.playerId, table.tabIndex),
    playerIdx: index("idx_bank_tabs_player").on(table.playerId),
  }),
);

/**
 * Bank Placeholders Table - Reserved item slots (OSRS-style)
 *
 * Stores placeholders for items that have been withdrawn.
 * When a player withdraws all of an item with placeholders enabled,
 * a placeholder is created to reserve that slot for the item.
 *
 * Key columns:
 * - `playerId` - References characters.id (CASCADE DELETE)
 * - `tabIndex` - Which tab the placeholder is in (0-9)
 * - `slot` - Bank slot index where item was
 * - `itemId` - The item that was withdrawn
 *
 * Design notes:
 * - Created when withdrawing ALL of an item (with setting enabled)
 * - Deleted when depositing that item type (uses placeholder slot)
 * - Can be manually released by player
 * - Unique constraint on (playerId, tabIndex, slot)
 */
export const bankPlaceholders = pgTable(
  "bank_placeholders",
  {
    id: serial("id").primaryKey(),
    playerId: text("playerId")
      .notNull()
      .references(() => characters.id, { onDelete: "cascade" }),
    tabIndex: integer("tabIndex").default(0).notNull(),
    slot: integer("slot").notNull(),
    itemId: text("itemId").notNull(),
    createdAt: bigint("createdAt", { mode: "number" })
      .notNull()
      .default(sql`(EXTRACT(EPOCH FROM NOW()) * 1000)::BIGINT`),
  },
  (table) => ({
    uniquePlayerTabSlot: unique().on(
      table.playerId,
      table.tabIndex,
      table.slot,
    ),
    playerIdx: index("idx_bank_placeholders_player").on(table.playerId),
    playerItemIdx: index("idx_bank_placeholders_player_item").on(
      table.playerId,
      table.itemId,
    ),
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
 * Quest Progress Table - Player quest state tracking
 *
 * Tracks quest progress for each player. Each row represents a player's
 * progress on a specific quest.
 *
 * Key columns:
 * - `playerId` - References characters.id (CASCADE DELETE)
 * - `questId` - Quest identifier from quests.json manifest
 * - `status` - "not_started" | "in_progress" | "completed"
 * - `currentStage` - Current stage ID within the quest
 * - `stageProgress` - JSON object tracking stage-specific progress (e.g., {"kills": 7})
 * - `startedAt` - Unix timestamp when quest was started
 * - `completedAt` - Unix timestamp when quest was completed
 *
 * Note: "ready_to_complete" is a derived state computed by QuestSystem when
 * status is "in_progress" AND the current stage objective is met.
 */
export const questProgress = pgTable(
  "quest_progress",
  {
    id: serial("id").primaryKey(),
    playerId: text("playerId")
      .notNull()
      .references(() => characters.id, { onDelete: "cascade" }),
    questId: text("questId").notNull(),
    status: text("status").default("not_started").notNull(),
    currentStage: text("currentStage"),
    stageProgress: jsonb("stageProgress").default({}),
    startedAt: bigint("startedAt", { mode: "number" }),
    completedAt: bigint("completedAt", { mode: "number" }),
  },
  (table) => ({
    uniquePlayerQuest: unique().on(table.playerId, table.questId),
    playerIdx: index("idx_quest_progress_player").on(table.playerId),
    statusIdx: index("idx_quest_progress_status").on(
      table.playerId,
      table.status,
    ),
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
    // Crash recovery columns
    items: jsonb("items")
      .default(sql`'[]'::jsonb`)
      .notNull(), // Array of {itemId, quantity} for recovery
    killedBy: text("killedBy").default("unknown").notNull(), // What killed the player
    recovered: boolean("recovered").default(false).notNull(), // Whether death was processed during crash recovery
    createdAt: bigint("createdAt", { mode: "number" })
      .notNull()
      .default(sql`(EXTRACT(EPOCH FROM NOW()) * 1000)::BIGINT`),
    updatedAt: bigint("updatedAt", { mode: "number" })
      .notNull()
      .default(sql`(EXTRACT(EPOCH FROM NOW()) * 1000)::BIGINT`),
  },
  (table) => ({
    timestampIdx: index("idx_player_deaths_timestamp").on(table.timestamp),
    recoveredIdx: index("idx_player_deaths_recovered").on(table.recovered),
    recoveryLookupIdx: index("idx_player_deaths_recovery_lookup").on(
      table.recovered,
      table.timestamp,
    ),
  }),
);

/**
 * Character Templates Table - Pre-configured character archetypes
 *
 * Stores template configurations for character creation (Skiller, Ironman, etc.).
 * Players can choose from these templates when creating a new character.
 *
 * Key columns:
 * - `id` - Auto-incrementing primary key
 * - `name` - Template name (e.g., "The Skiller", "PvM Slayer")
 * - `description` - Template description shown in character select
 * - `emoji` - Icon emoji for the template
 * - `templateUrl` - URL to ElizaOS character config JSON (unique)
 * - `createdAt` - When template was created
 *
 * Design notes:
 * - Templates are seeded during initial setup
 * - templateUrl must be unique (constraint enforced)
 * - Used by CharacterSelectScreen to show available archetypes
 */
export const characterTemplates = pgTable(
  "character_templates",
  {
    id: serial("id").primaryKey(),
    name: text("name").notNull(),
    description: text("description").notNull(),
    emoji: text("emoji").notNull(),
    templateUrl: text("templateUrl").notNull(),
    // Full ElizaOS character configuration stored as JSON string
    // This contains the complete character template that gets merged with user-specific data
    templateConfig: text("templateConfig"),
    createdAt: bigint("createdAt", { mode: "number" })
      .notNull()
      .default(sql`(EXTRACT(EPOCH FROM NOW()) * 1000)::BIGINT`),
  },
  (table) => ({
    uniqueTemplateUrl: unique().on(table.templateUrl),
  }),
);

/**
 * Layout Presets Table - User interface layout presets
 *
 * Stores UI layout configurations for players (RS3-style NIS presets).
 * Each user can have up to 4 preset slots for different activities.
 *
 * Key columns:
 * - `userId` - References users.id (CASCADE DELETE)
 * - `slotIndex` - Preset slot (0-3)
 * - `name` - User-defined preset name
 * - `layoutData` - JSON string containing window positions, tabs, etc.
 * - `resolution` - JSON object with original resolution for scaling
 * - `shared` - Whether this preset is publicly shareable
 *
 * Design notes:
 * - Max 4 presets per user (slot 0-3)
 * - Unique constraint on (userId, slotIndex)
 * - CASCADE DELETE ensures cleanup when user is deleted
 * - layoutData stores serialized WindowState[] from the UI system
 */
export const layoutPresets = pgTable(
  "layout_presets",
  {
    id: serial("id").primaryKey(),
    userId: text("userId")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    slotIndex: integer("slotIndex").notNull(),
    name: text("name").notNull(),
    layoutData: text("layoutData").notNull(), // JSON: WindowState[]
    resolution: text("resolution"), // JSON: { width, height }
    shared: integer("shared").default(0).notNull(), // 0=private, 1=shared
    // Community sharing columns
    shareCode: text("shareCode").unique(), // Unique share code for loading
    description: text("description"), // Optional description
    category: text("category").default("custom"), // Preset category
    tags: text("tags").default("[]"), // JSON array of tags
    usageCount: integer("usageCount").default(0), // Times this preset was loaded
    rating: real("rating"), // Average rating (0-5)
    ratingCount: integer("ratingCount").default(0), // Number of ratings
    ratingSum: integer("ratingSum").default(0), // Sum of all ratings
    createdAt: bigint("createdAt", { mode: "number" })
      .notNull()
      .default(sql`(EXTRACT(EPOCH FROM NOW()) * 1000)::BIGINT`),
    updatedAt: bigint("updatedAt", { mode: "number" })
      .notNull()
      .default(sql`(EXTRACT(EPOCH FROM NOW()) * 1000)::BIGINT`),
  },
  (table) => ({
    uniqueUserSlot: unique().on(table.userId, table.slotIndex),
    userIdx: index("idx_layout_presets_user").on(table.userId),
    sharedIdx: index("idx_layout_presets_shared").on(table.shared),
    shareCodeIdx: index("idx_layout_presets_share_code").on(table.shareCode),
    communityIdx: index("idx_layout_presets_community").on(
      table.shared,
      table.usageCount,
      table.rating,
    ),
  }),
);

/**
 * Action Bar Storage Table - Persistent action bar configurations
 *
 * Stores action bar slot configurations for characters.
 * Each character can have multiple action bars (barId 0-3).
 *
 * Key columns:
 * - `playerId` - References characters.id (CASCADE DELETE)
 * - `barId` - Action bar index (0-3, with 0 being the main bar)
 * - `slotCount` - Number of visible slots (4-9)
 * - `slotsData` - JSON array of slot contents
 *
 * Design notes:
 * - slotsData stores ActionBarSlotContent[] as JSON
 * - Unique constraint on (playerId, barId)
 * - CASCADE DELETE ensures cleanup when character is deleted
 */
export const actionBarStorage = pgTable(
  "action_bar_storage",
  {
    id: serial("id").primaryKey(),
    playerId: text("playerId")
      .notNull()
      .references(() => characters.id, { onDelete: "cascade" }),
    barId: integer("barId").default(0).notNull(),
    slotCount: integer("slotCount").default(7).notNull(),
    slotsData: text("slotsData").notNull(), // JSON: ActionBarSlotContent[]
    updatedAt: bigint("updatedAt", { mode: "number" })
      .notNull()
      .default(sql`(EXTRACT(EPOCH FROM NOW()) * 1000)::BIGINT`),
  },
  (table) => ({
    uniquePlayerBar: unique().on(table.playerId, table.barId),
    playerIdx: index("idx_action_bar_storage_player").on(table.playerId),
  }),
);

/**
 * User Bans Table - Tracks banned users
 *
 * Stores ban records for users who have been banned by moderators or admins.
 * Supports both temporary and permanent bans.
 *
 * Key columns:
 * - `id` - Auto-incrementing primary key
 * - `bannedUserId` - References users.id (the banned user)
 * - `bannedByUserId` - References users.id (the mod/admin who banned them)
 * - `reason` - Optional reason for the ban
 * - `expiresAt` - When the ban expires (null for permanent bans)
 * - `createdAt` - When the ban was created
 * - `active` - Whether the ban is currently active (false = unbanned)
 *
 * Design notes:
 * - `active` flag allows soft-delete of bans (preserves history)
 * - expiresAt = null means permanent ban
 * - Ban checks should filter by active=true AND (expiresAt IS NULL OR expiresAt > NOW())
 * - Mods cannot ban other mods or admins (enforced in application logic)
 */
export const userBans = pgTable(
  "user_bans",
  {
    id: serial("id").primaryKey(),
    bannedUserId: text("bannedUserId")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    bannedByUserId: text("bannedByUserId")
      .notNull()
      .references(() => users.id, { onDelete: "set null" }),
    reason: text("reason"),
    expiresAt: bigint("expiresAt", { mode: "number" }), // null = permanent
    createdAt: bigint("createdAt", { mode: "number" })
      .notNull()
      .default(sql`(EXTRACT(EPOCH FROM NOW()) * 1000)::BIGINT`),
    active: integer("active").default(1).notNull(), // 1=active, 0=unbanned
  },
  (table) => ({
    bannedUserIdx: index("idx_user_bans_banned_user").on(table.bannedUserId),
    activeIdx: index("idx_user_bans_active").on(table.active),
    activeBannedIdx: index("idx_user_bans_active_banned").on(
      table.active,
      table.bannedUserId,
    ),
  }),
);

/**
 * Operations Log Table - Write-Ahead Logging for Persistence Operations
 *
 * Provides durability guarantees for critical operations (inventory, equipment, trades).
 * Operations are logged before execution - on crash recovery, incomplete operations
 * can be replayed to ensure no data loss.
 *
 * **Pattern**: Write-Ahead Log (WAL)
 * 1. Log operation intent with state
 * 2. Execute operation
 * 3. Mark operation complete
 * 4. On startup, replay any incomplete operations
 *
 * **Use Cases**:
 * - Trade completions
 * - Bank transactions
 * - Equipment changes
 * - Inventory modifications
 */
export const operationsLog = pgTable(
  "operations_log",
  {
    id: text("id").primaryKey(), // UUID
    playerId: text("playerId")
      .notNull()
      .references(() => characters.id, { onDelete: "cascade" }),
    operationType: text("operationType").notNull(), // 'trade', 'bank', 'equipment', 'inventory'
    operationState: jsonb("operationState").notNull(), // Full operation data for replay
    completed: boolean("completed").default(false),
    timestamp: bigint("timestamp", { mode: "number" }).notNull(),
    completedAt: bigint("completedAt", { mode: "number" }),
  },
  (table) => ({
    // Index for recovery queries - find incomplete operations for a player
    incompleteIdx: index("idx_operations_log_incomplete").on(
      table.playerId,
      table.completed,
    ),
    // Index for cleanup queries - find old completed operations
    timestampIdx: index("idx_operations_log_timestamp").on(table.timestamp),
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
  bankStorage: many(bankStorage),
  bankTabs: many(bankTabs),
  bankPlaceholders: many(bankPlaceholders),
  actionBars: many(actionBarStorage),
  sessions: many(playerSessions),
  chunkActivities: many(chunkActivity),
  npcKills: many(npcKills),
  deaths: many(playerDeaths),
  agentMappings: many(agentMappings),
  // Social system relations
  friendships: many(friendships, { relationName: "playerFriendships" }),
  friendOf: many(friendships, { relationName: "friendOf" }),
  sentFriendRequests: many(friendRequests, {
    relationName: "sentFriendRequests",
  }),
  receivedFriendRequests: many(friendRequests, {
    relationName: "receivedFriendRequests",
  }),
  ignoreList: many(ignoreList, { relationName: "playerIgnoreList" }),
  ignoredBy: many(ignoreList, { relationName: "ignoredBy" }),
}));

export const agentMappingsRelations = relations(agentMappings, ({ one }) => ({
  user: one(users, {
    fields: [agentMappings.accountId],
    references: [users.id],
  }),
  character: one(characters, {
    fields: [agentMappings.characterId],
    references: [characters.id],
  }),
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

export const bankTabsRelations = relations(bankTabs, ({ one }) => ({
  character: one(characters, {
    fields: [bankTabs.playerId],
    references: [characters.id],
  }),
}));

export const bankPlaceholdersRelations = relations(
  bankPlaceholders,
  ({ one }) => ({
    character: one(characters, {
      fields: [bankPlaceholders.playerId],
      references: [characters.id],
    }),
  }),
);

export const actionBarStorageRelations = relations(
  actionBarStorage,
  ({ one }) => ({
    character: one(characters, {
      fields: [actionBarStorage.playerId],
      references: [characters.id],
    }),
  }),
);

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

export const layoutPresetsRelations = relations(layoutPresets, ({ one }) => ({
  user: one(users, {
    fields: [layoutPresets.userId],
    references: [users.id],
  }),
}));

export const userBansRelations = relations(userBans, ({ one }) => ({
  bannedUser: one(users, {
    fields: [userBans.bannedUserId],
    references: [users.id],
  }),
  bannedByUser: one(users, {
    fields: [userBans.bannedByUserId],
    references: [users.id],
  }),
}));

export const usersRelations = relations(users, ({ many }) => ({
  layoutPresets: many(layoutPresets),
}));

// ============================================================================
// QUEST AUDIT TABLES
// ============================================================================

/**
 * Quest Audit Log Table - Tracks all quest state changes for security auditing
 *
 * Provides an immutable audit trail for quest actions to detect exploits.
 * Each row represents a single quest action (start, progress, complete).
 *
 * Key columns:
 * - `id` - Auto-incrementing primary key
 * - `playerId` - References characters.id (who performed the action)
 * - `questId` - Quest identifier from quests.json manifest
 * - `action` - Type of action ("started", "progressed", "completed")
 * - `questPointsAwarded` - Points awarded (for completed actions)
 * - `stageId` - Current stage at time of action
 * - `stageProgress` - Progress snapshot at time of action (JSON)
 * - `timestamp` - When the action occurred (Unix ms)
 * - `metadata` - Additional context (IP, session, etc.)
 *
 * Design notes:
 * - Immutable log - no updates or deletes in normal operation
 * - Used for security auditing and exploit detection
 * - Indexed for efficient queries by player and quest
 * - CASCADE DELETE ensures cleanup when character is deleted
 */
export const questAuditLog = pgTable(
  "quest_audit_log",
  {
    id: serial("id").primaryKey(),
    playerId: text("playerId")
      .notNull()
      .references(() => characters.id, { onDelete: "cascade" }),
    questId: text("questId").notNull(),
    action: text("action").notNull(), // "started", "progressed", "completed"
    questPointsAwarded: integer("questPointsAwarded").default(0),
    stageId: text("stageId"),
    stageProgress: jsonb("stageProgress").default({}),
    timestamp: bigint("timestamp", { mode: "number" }).notNull(),
    metadata: jsonb("metadata").default({}),
  },
  (table) => ({
    playerIdx: index("idx_quest_audit_log_player").on(table.playerId),
    questIdx: index("idx_quest_audit_log_quest").on(table.questId),
    playerQuestIdx: index("idx_quest_audit_log_player_quest").on(
      table.playerId,
      table.questId,
    ),
    timestampIdx: index("idx_quest_audit_log_timestamp").on(table.timestamp),
    actionIdx: index("idx_quest_audit_log_action").on(table.action),
  }),
);

/**
 * Quest Audit Log Relations
 */
export const questAuditLogRelations = relations(questAuditLog, ({ one }) => ({
  character: one(characters, {
    fields: [questAuditLog.playerId],
    references: [characters.id],
  }),
}));

// ============================================================================
// ADMIN PANEL TABLES
// ============================================================================

/**
 * Activity Log Table - Tracks all player actions for admin auditing
 *
 * Stores a comprehensive log of player activities including:
 * - Item pickup/drop
 * - Equipment changes
 * - NPC kills
 * - Bank transactions
 * - Store transactions
 * - Trading
 *
 * Key columns:
 * - `id` - Auto-incrementing primary key
 * - `playerId` - References characters.id (who performed the action)
 * - `eventType` - Type of event (e.g., "ITEM_PICKUP", "NPC_DIED")
 * - `action` - Human-readable action (e.g., "picked_up", "killed")
 * - `entityType` - Type of entity involved (e.g., "item", "npc", "player")
 * - `entityId` - ID of the entity involved
 * - `details` - JSON object with event-specific data
 * - `position` - JSON object {x, y, z} of where action occurred
 * - `timestamp` - When the action occurred (Unix ms)
 *
 * Design notes:
 * - 90-day retention policy (cleanup via maintenance job)
 * - Indexed for efficient queries by player, event type, and time range
 * - CASCADE DELETE ensures cleanup when character is deleted
 */
export const activityLog = pgTable(
  "activity_log",
  {
    id: serial("id").primaryKey(),
    playerId: text("playerId")
      .notNull()
      .references(() => characters.id, { onDelete: "cascade" }),
    eventType: text("eventType").notNull(),
    action: text("action").notNull(),
    entityType: text("entityType"),
    entityId: text("entityId"),
    details: jsonb("details")
      .default(sql`'{}'::jsonb`)
      .notNull(),
    position: jsonb("position"),
    timestamp: bigint("timestamp", { mode: "number" }).notNull(),
  },
  (table) => ({
    playerIdx: index("idx_activity_log_player").on(table.playerId),
    timestampIdx: index("idx_activity_log_timestamp").on(table.timestamp),
    playerTimestampIdx: index("idx_activity_log_player_timestamp").on(
      table.playerId,
      table.timestamp,
    ),
    eventTypeIdx: index("idx_activity_log_event_type").on(table.eventType),
    playerEventTypeIdx: index("idx_activity_log_player_event_type").on(
      table.playerId,
      table.eventType,
      table.timestamp,
    ),
  }),
);

/**
 * Trades Table - Records all completed trades between players
 *
 * Stores a history of all player-to-player trades including:
 * - Who initiated the trade
 * - Who received the trade
 * - What items were exchanged
 * - What coins were exchanged
 * - Trade status (completed, cancelled, declined)
 *
 * Key columns:
 * - `id` - Auto-incrementing primary key
 * - `initiatorId` - References characters.id (who started the trade)
 * - `receiverId` - References characters.id (who accepted the trade)
 * - `status` - Trade outcome ("completed", "cancelled", "declined")
 * - `initiatorItems` - JSON array of items given by initiator
 * - `receiverItems` - JSON array of items given by receiver
 * - `initiatorCoins` - Coins given by initiator
 * - `receiverCoins` - Coins given by receiver
 * - `timestamp` - When trade completed (Unix ms)
 *
 * Design notes:
 * - SET NULL on delete preserves trade history even if player is deleted
 * - 90-day retention policy (cleanup via maintenance job)
 * - Indexed for efficient queries by player and time range
 */
export const trades = pgTable(
  "trades",
  {
    id: serial("id").primaryKey(),
    initiatorId: text("initiatorId").references(() => characters.id, {
      onDelete: "set null",
    }),
    receiverId: text("receiverId").references(() => characters.id, {
      onDelete: "set null",
    }),
    status: text("status").notNull(), // "completed", "cancelled", "declined"
    initiatorItems: jsonb("initiatorItems")
      .default(sql`'[]'::jsonb`)
      .notNull(),
    receiverItems: jsonb("receiverItems")
      .default(sql`'[]'::jsonb`)
      .notNull(),
    initiatorCoins: integer("initiatorCoins").default(0).notNull(),
    receiverCoins: integer("receiverCoins").default(0).notNull(),
    timestamp: bigint("timestamp", { mode: "number" }).notNull(),
  },
  (table) => ({
    initiatorIdx: index("idx_trades_initiator").on(table.initiatorId),
    receiverIdx: index("idx_trades_receiver").on(table.receiverId),
    timestampIdx: index("idx_trades_timestamp").on(table.timestamp),
    initiatorTimestampIdx: index("idx_trades_initiator_timestamp").on(
      table.initiatorId,
      table.timestamp,
    ),
    receiverTimestampIdx: index("idx_trades_receiver_timestamp").on(
      table.receiverId,
      table.timestamp,
    ),
  }),
);

/**
 * Activity Log Relations
 */
export const activityLogRelations = relations(activityLog, ({ one }) => ({
  character: one(characters, {
    fields: [activityLog.playerId],
    references: [characters.id],
  }),
}));

/**
 * Trades Relations
 */
export const tradesRelations = relations(trades, ({ one }) => ({
  initiator: one(characters, {
    fields: [trades.initiatorId],
    references: [characters.id],
    relationName: "tradeInitiator",
  }),
  receiver: one(characters, {
    fields: [trades.receiverId],
    references: [characters.id],
    relationName: "tradeReceiver",
  }),
}));

/**
 * Update characters relations to include activity logs and trades
 */
export const charactersActivityRelations = relations(
  characters,
  ({ many }) => ({
    activityLogs: many(activityLog),
    initiatedTrades: many(trades, { relationName: "tradeInitiator" }),
    receivedTrades: many(trades, { relationName: "tradeReceiver" }),
  }),
);

// ============================================================================
// ANTI-CHEAT VIOLATIONS TABLE
// ============================================================================

/**
 * Anti-Cheat Violations Table - Persistent record of combat violations
 *
 * Stores violations detected by the CombatAntiCheat system for historical
 * analysis, admin review, and pattern detection across server restarts.
 *
 * Key columns:
 * - `playerId` - References characters.id (who committed the violation)
 * - `violationType` - Type of violation (e.g., "out_of_range_attack")
 * - `severity` - Severity level ("MINOR", "MODERATE", "MAJOR", "CRITICAL")
 * - `details` - Human-readable violation description
 * - `score` - Weighted score at time of violation
 * - `targetId` - Target entity ID (if applicable)
 * - `gameTick` - Game tick when violation occurred
 * - `actionTaken` - Action taken (e.g., "kick", "ban", or null)
 * - `timestamp` - When the violation occurred (Unix ms)
 *
 * Design notes:
 * - Flushed periodically from in-memory CombatAntiCheat buffer (every save cycle)
 * - Indexed for efficient admin queries by player, severity, and time range
 * - CASCADE DELETE ensures cleanup when character is deleted
 * - Used by /admin/anticheat/history endpoint for violation investigation
 */
export const antiCheatViolations = pgTable(
  "anti_cheat_violations",
  {
    id: serial("id").primaryKey(),
    playerId: text("playerId")
      .notNull()
      .references(() => characters.id, { onDelete: "cascade" }),
    violationType: text("violationType").notNull(),
    severity: text("severity").notNull(),
    details: text("details").notNull(),
    targetId: text("targetId"),
    gameTick: integer("gameTick"),
    score: integer("score").default(0).notNull(),
    actionTaken: text("actionTaken"),
    timestamp: bigint("timestamp", { mode: "number" }).notNull(),
  },
  (table) => ({
    playerIdx: index("idx_anti_cheat_violations_player").on(table.playerId),
    timestampIdx: index("idx_anti_cheat_violations_timestamp").on(
      table.timestamp,
    ),
    severityIdx: index("idx_anti_cheat_violations_severity").on(table.severity),
    playerTimestampIdx: index("idx_anti_cheat_violations_player_timestamp").on(
      table.playerId,
      table.timestamp,
    ),
  }),
);

/**
 * Anti-Cheat Violations Relations
 */
export const antiCheatViolationsRelations = relations(
  antiCheatViolations,
  ({ one }) => ({
    character: one(characters, {
      fields: [antiCheatViolations.playerId],
      references: [characters.id],
    }),
  }),
);

// ============================================================================
// DUEL SETTLEMENT TABLE
// ============================================================================

/**
 * Duel Settlements Table - Idempotency guard for duel stake transfers
 *
 * Ensures each duel's stake transfer executes exactly once, surviving server
 * restarts. The settlement row is inserted inside the same DB transaction as
 * the inventory mutations, so either both commit or neither does.
 *
 * Key columns:
 * - `duelId` - Unique duel identifier (primary key, prevents double-settlement)
 * - `winnerId` - Player who won the duel
 * - `loserId` - Player who lost the duel
 * - `settledAt` - When the settlement transaction committed (Unix ms)
 * - `stakesTransferred` - Number of item stacks transferred
 *
 * Design notes:
 * - Primary key on duelId is the idempotency guard — INSERT fails on duplicate
 * - 90-day retention policy (cleanup via maintenance job, same as trades)
 * - Indexed on winnerId/loserId for player history queries
 */
export const duelSettlements = pgTable(
  "duel_settlements",
  {
    duelId: text("duelId").primaryKey(),
    winnerId: text("winnerId")
      .notNull()
      .references(() => characters.id, { onDelete: "restrict" }),
    loserId: text("loserId")
      .notNull()
      .references(() => characters.id, { onDelete: "restrict" }),
    settledAt: bigint("settledAt", { mode: "number" }).notNull(),
    stakesTransferred: integer("stakesTransferred").default(0).notNull(),
  },
  (table) => ({
    winnerIdx: index("idx_duel_settlements_winner").on(table.winnerId),
    loserIdx: index("idx_duel_settlements_loser").on(table.loserId),
    settledAtIdx: index("idx_duel_settlements_settled_at").on(table.settledAt),
  }),
);

// ============================================================================
// COMBAT STATS + ONCHAIN OUTBOX TABLES
// ============================================================================

/**
 * Player Combat Stats - canonical per-player combat counters in PostgreSQL.
 *
 * Covers PvP kills, non-duel deaths (split into PvP vs PvE), and duel W/L.
 * Duel deaths are intentionally excluded from totalDeaths and death splits.
 */
export const playerCombatStats = pgTable(
  "player_combat_stats",
  {
    playerId: text("playerId")
      .primaryKey()
      .references(() => characters.id, { onDelete: "cascade" }),
    totalPlayerKills: integer("totalPlayerKills").notNull().default(0),
    totalDeaths: integer("totalDeaths").notNull().default(0),
    totalPvpDeaths: integer("totalPvpDeaths").notNull().default(0),
    totalPveDeaths: integer("totalPveDeaths").notNull().default(0),
    totalDuelWins: integer("totalDuelWins").notNull().default(0),
    totalDuelLosses: integer("totalDuelLosses").notNull().default(0),
    createdAt: bigint("createdAt", { mode: "number" })
      .notNull()
      .default(sql`(EXTRACT(EPOCH FROM NOW()) * 1000)::BIGINT`),
    updatedAt: bigint("updatedAt", { mode: "number" })
      .notNull()
      .default(sql`(EXTRACT(EPOCH FROM NOW()) * 1000)::BIGINT`),
  },
  (table) => ({
    updatedAtIdx: index("idx_player_combat_stats_updated_at").on(
      table.updatedAt,
    ),
    killsIdx: index("idx_player_combat_stats_kills").on(table.totalPlayerKills),
    deathsIdx: index("idx_player_combat_stats_deaths").on(table.totalDeaths),
    duelWinsIdx: index("idx_player_combat_stats_duel_wins").on(
      table.totalDuelWins,
    ),
  }),
);

/**
 * Combat Stat Events - durable idempotency keys for combat stat mutations.
 *
 * Protects against duplicate handling when the same world event is observed
 * multiple times (for example duplicate ENTITY_DEATH emissions in one tick).
 */
export const combatStatEvents = pgTable(
  "combat_stat_events",
  {
    eventKey: text("eventKey").primaryKey(),
    eventType: text("eventType").notNull(), // NON_DUEL_DEATH | DUEL_COMPLETED
    playerId: text("playerId")
      .notNull()
      .references(() => characters.id, { onDelete: "cascade" }),
    secondaryPlayerId: text("secondaryPlayerId").references(
      () => characters.id,
      {
        onDelete: "set null",
      },
    ),
    classification: text("classification"), // PVP | PVE
    duelId: text("duelId"),
    payload: jsonb("payload")
      .$type<Record<string, unknown>>()
      .notNull()
      .default(sql`'{}'::jsonb`),
    createdAt: bigint("createdAt", { mode: "number" })
      .notNull()
      .default(sql`(EXTRACT(EPOCH FROM NOW()) * 1000)::BIGINT`),
  },
  (table) => ({
    eventTypeIdx: index("idx_combat_stat_events_type").on(table.eventType),
    playerIdx: index("idx_combat_stat_events_player").on(table.playerId),
    secondaryIdx: index("idx_combat_stat_events_secondary").on(
      table.secondaryPlayerId,
    ),
    duelIdx: index("idx_combat_stat_events_duel").on(table.duelId),
    createdIdx: index("idx_combat_stat_events_created").on(table.createdAt),
  }),
);

/**
 * Onchain Outbox - strong transactional outbox for combat stat writes.
 *
 * Rows are produced in the same DB transaction as stat updates, then
 * asynchronously drained by the backend writer in MODE=web3.
 */
export const onchainOutbox = pgTable(
  "onchain_outbox",
  {
    id: serial("id").primaryKey(),
    stream: text("stream").notNull().default("combat_stats"),
    eventType: text("eventType").notNull(), // PLAYER_STATS_SNAPSHOT
    dedupeKey: text("dedupeKey").notNull(),
    payload: jsonb("payload").$type<Record<string, unknown>>().notNull(),
    status: text("status").notNull().default("pending"), // pending | processing | retry | sent | dead
    attemptCount: integer("attemptCount").notNull().default(0),
    nextAttemptAt: bigint("nextAttemptAt", { mode: "number" })
      .notNull()
      .default(sql`(EXTRACT(EPOCH FROM NOW()) * 1000)::BIGINT`),
    lockedBy: text("lockedBy"),
    lockedAt: bigint("lockedAt", { mode: "number" }),
    lastError: text("lastError"),
    sentAt: bigint("sentAt", { mode: "number" }),
    createdAt: bigint("createdAt", { mode: "number" })
      .notNull()
      .default(sql`(EXTRACT(EPOCH FROM NOW()) * 1000)::BIGINT`),
    updatedAt: bigint("updatedAt", { mode: "number" })
      .notNull()
      .default(sql`(EXTRACT(EPOCH FROM NOW()) * 1000)::BIGINT`),
  },
  (table) => ({
    dedupeIdx: uniqueIndex("uidx_onchain_outbox_dedupe").on(table.dedupeKey),
    statusNextIdx: index("idx_onchain_outbox_status_next_attempt").on(
      table.status,
      table.nextAttemptAt,
    ),
    lockedIdx: index("idx_onchain_outbox_locked_at").on(table.lockedAt),
    streamIdx: index("idx_onchain_outbox_stream").on(table.stream),
  }),
);

// ============================================================================
// STREAMED ARENA + SOLANA PREDICTION TABLES
// ============================================================================

/**
 * Arena Agent Whitelist - Agents eligible for streamed duel queue.
 *
 * Agents must be explicitly enabled to participate in autonomous arena rounds.
 * Cooldown and bracket hints are used by matchmaking.
 */
export const arenaAgentWhitelist = pgTable(
  "arena_agent_whitelist",
  {
    characterId: text("characterId")
      .primaryKey()
      .references(() => characters.id, { onDelete: "cascade" }),
    enabled: boolean("enabled").notNull().default(true),
    minPowerScore: integer("minPowerScore").notNull().default(0),
    maxPowerScore: integer("maxPowerScore").notNull().default(10_000),
    priority: integer("priority").notNull().default(0),
    cooldownUntil: bigint("cooldownUntil", { mode: "number" }),
    notes: text("notes"),
    updatedAt: bigint("updatedAt", { mode: "number" })
      .notNull()
      .default(sql`(EXTRACT(EPOCH FROM NOW()) * 1000)::BIGINT`),
  },
  (table) => ({
    enabledIdx: index("idx_arena_whitelist_enabled").on(table.enabled),
    cooldownIdx: index("idx_arena_whitelist_cooldown").on(table.cooldownUntil),
    priorityIdx: index("idx_arena_whitelist_priority").on(table.priority),
  }),
);

/**
 * Arena Rounds - canonical duel loop state and result record.
 */
export const arenaRounds = pgTable(
  "arena_rounds",
  {
    id: text("id").primaryKey(),
    phase: text("phase").notNull(),
    agentAId: text("agentAId")
      .notNull()
      .references(() => characters.id, { onDelete: "restrict" }),
    agentBId: text("agentBId")
      .notNull()
      .references(() => characters.id, { onDelete: "restrict" }),
    previewAgentAId: text("previewAgentAId").references(() => characters.id, {
      onDelete: "set null",
    }),
    previewAgentBId: text("previewAgentBId").references(() => characters.id, {
      onDelete: "set null",
    }),
    duelId: text("duelId"),
    scheduledAt: bigint("scheduledAt", { mode: "number" }).notNull(),
    bettingOpensAt: bigint("bettingOpensAt", { mode: "number" }).notNull(),
    bettingClosesAt: bigint("bettingClosesAt", { mode: "number" }).notNull(),
    duelStartsAt: bigint("duelStartsAt", { mode: "number" }),
    duelEndsAt: bigint("duelEndsAt", { mode: "number" }),
    winnerId: text("winnerId").references(() => characters.id, {
      onDelete: "set null",
    }),
    winReason: text("winReason"),
    damageA: integer("damageA").notNull().default(0),
    damageB: integer("damageB").notNull().default(0),
    metadataUri: text("metadataUri"),
    resultHash: text("resultHash"),
    createdAt: bigint("createdAt", { mode: "number" })
      .notNull()
      .default(sql`(EXTRACT(EPOCH FROM NOW()) * 1000)::BIGINT`),
    updatedAt: bigint("updatedAt", { mode: "number" })
      .notNull()
      .default(sql`(EXTRACT(EPOCH FROM NOW()) * 1000)::BIGINT`),
  },
  (table) => ({
    phaseIdx: index("idx_arena_rounds_phase").on(table.phase),
    phaseCreatedIdx: index("idx_arena_rounds_phase_created").on(
      table.phase,
      table.createdAt,
    ),
    scheduledIdx: index("idx_arena_rounds_scheduled").on(table.scheduledAt),
    duelIdIdx: index("idx_arena_rounds_duel_id").on(table.duelId),
    winnerIdx: index("idx_arena_rounds_winner").on(table.winnerId),
  }),
);

/**
 * Arena Round Events - append-only event timeline for observability and replay.
 */
export const arenaRoundEvents = pgTable(
  "arena_round_events",
  {
    id: serial("id").primaryKey(),
    roundId: text("roundId")
      .notNull()
      .references(() => arenaRounds.id, { onDelete: "cascade" }),
    eventType: text("eventType").notNull(),
    payload: jsonb("payload").$type<Record<string, unknown>>().notNull(),
    createdAt: bigint("createdAt", { mode: "number" })
      .notNull()
      .default(sql`(EXTRACT(EPOCH FROM NOW()) * 1000)::BIGINT`),
  },
  (table) => ({
    roundIdx: index("idx_arena_round_events_round").on(table.roundId),
    typeIdx: index("idx_arena_round_events_type").on(table.eventType),
    createdIdx: index("idx_arena_round_events_created").on(table.createdAt),
  }),
);

/**
 * Solana Markets - on-chain market metadata per arena round.
 */
export const solanaMarkets = pgTable(
  "solana_markets",
  {
    roundId: text("roundId")
      .primaryKey()
      .references(() => arenaRounds.id, { onDelete: "cascade" }),
    marketPda: text("marketPda").notNull(),
    oraclePda: text("oraclePda").notNull(),
    mint: text("mint").notNull(),
    vault: text("vault"),
    feeVault: text("feeVault"),
    closeSlot: bigint("closeSlot", { mode: "number" }),
    resolvedSlot: bigint("resolvedSlot", { mode: "number" }),
    status: text("status").notNull().default("PENDING"),
    winnerSide: text("winnerSide"),
    resultSignature: text("resultSignature"),
    createdAt: bigint("createdAt", { mode: "number" })
      .notNull()
      .default(sql`(EXTRACT(EPOCH FROM NOW()) * 1000)::BIGINT`),
    updatedAt: bigint("updatedAt", { mode: "number" })
      .notNull()
      .default(sql`(EXTRACT(EPOCH FROM NOW()) * 1000)::BIGINT`),
  },
  (table) => ({
    statusIdx: index("idx_solana_markets_status").on(table.status),
    marketIdx: uniqueIndex("uidx_solana_markets_market_pda").on(
      table.marketPda,
    ),
    oracleIdx: uniqueIndex("uidx_solana_markets_oracle_pda").on(
      table.oraclePda,
    ),
  }),
);

/**
 * Solana Bets - user intents + signed transaction metadata.
 *
 * One record per submitted bet transaction.
 */
export const solanaBets = pgTable(
  "solana_bets",
  {
    id: text("id").primaryKey(),
    roundId: text("roundId")
      .notNull()
      .references(() => arenaRounds.id, { onDelete: "cascade" }),
    bettorWallet: text("bettorWallet").notNull(),
    side: text("side").notNull(),
    sourceAsset: text("sourceAsset").notNull(), // GOLD|SOL|USDC
    sourceAmount: text("sourceAmount").notNull(),
    goldAmount: text("goldAmount").notNull(),
    quoteJson: jsonb("quoteJson").$type<Record<string, unknown>>(),
    txSignature: text("txSignature"),
    status: text("status").notNull().default("PENDING"),
    createdAt: bigint("createdAt", { mode: "number" })
      .notNull()
      .default(sql`(EXTRACT(EPOCH FROM NOW()) * 1000)::BIGINT`),
    updatedAt: bigint("updatedAt", { mode: "number" })
      .notNull()
      .default(sql`(EXTRACT(EPOCH FROM NOW()) * 1000)::BIGINT`),
  },
  (table) => ({
    roundIdx: index("idx_solana_bets_round").on(table.roundId),
    roundWalletIdx: index("idx_solana_bets_round_wallet").on(
      table.roundId,
      table.bettorWallet,
    ),
    walletIdx: index("idx_solana_bets_wallet").on(table.bettorWallet),
    statusIdx: index("idx_solana_bets_status").on(table.status),
    sigIdx: uniqueIndex("uidx_solana_bets_signature").on(table.txSignature),
  }),
);

/**
 * Solana payout jobs - keeper queue for claim_for retries.
 */
export const solanaPayoutJobs = pgTable(
  "solana_payout_jobs",
  {
    id: text("id").primaryKey(),
    roundId: text("roundId")
      .notNull()
      .references(() => arenaRounds.id, { onDelete: "cascade" }),
    bettorWallet: text("bettorWallet").notNull(),
    status: text("status").notNull().default("PENDING"),
    attempts: integer("attempts").notNull().default(0),
    lastError: text("lastError"),
    claimSignature: text("claimSignature"),
    nextAttemptAt: bigint("nextAttemptAt", { mode: "number" }),
    createdAt: bigint("createdAt", { mode: "number" })
      .notNull()
      .default(sql`(EXTRACT(EPOCH FROM NOW()) * 1000)::BIGINT`),
    updatedAt: bigint("updatedAt", { mode: "number" })
      .notNull()
      .default(sql`(EXTRACT(EPOCH FROM NOW()) * 1000)::BIGINT`),
  },
  (table) => ({
    roundIdx: index("idx_solana_payout_jobs_round").on(table.roundId),
    statusIdx: index("idx_solana_payout_jobs_status").on(table.status),
    nextAttemptIdx: index("idx_solana_payout_jobs_next_attempt").on(
      table.nextAttemptAt,
    ),
  }),
);

// ============================================================================
// SOCIAL/FRIEND SYSTEM TABLES
// ============================================================================

/**
 * Friendships Table - Player friend relationships
 *
 * Stores bidirectional friend relationships. When two players become friends,
 * TWO rows are created (one for each direction) to enable efficient lookups.
 *
 * Key columns:
 * - `playerId` - The player who owns this friend entry
 * - `friendId` - The friend's player ID
 * - `createdAt` - When the friendship was established
 * - `note` - Optional nickname/note for the friend
 *
 * Design notes:
 * - Bidirectional: A friendship between A and B creates rows (A, B) and (B, A)
 * - Unique constraint prevents duplicate friendships
 * - Indexed on both playerId and friendId for fast lookups
 * - CASCADE DELETE ensures cleanup when character is deleted
 * - Max 99 friends per player (enforced in application logic)
 */
export const friendships = pgTable(
  "friendships",
  {
    id: serial("id").primaryKey(),
    playerId: text("playerId")
      .notNull()
      .references(() => characters.id, { onDelete: "cascade" }),
    friendId: text("friendId")
      .notNull()
      .references(() => characters.id, { onDelete: "cascade" }),
    createdAt: bigint("createdAt", { mode: "number" })
      .notNull()
      .default(sql`(EXTRACT(EPOCH FROM NOW()) * 1000)::BIGINT`),
    note: text("note"), // Optional friend nickname
  },
  (table) => ({
    uniqueFriendship: unique().on(table.playerId, table.friendId),
    playerIdx: index("idx_friendships_player").on(table.playerId),
    friendIdx: index("idx_friendships_friend").on(table.friendId),
  }),
);

/**
 * Friend Requests Table - Pending friend requests
 *
 * Stores friend requests that have been sent but not yet accepted/declined.
 * Requests automatically expire after 7 days (handled in application logic).
 *
 * Key columns:
 * - `id` - Unique request UUID
 * - `fromPlayerId` - Player who sent the request
 * - `toPlayerId` - Player who received the request
 * - `createdAt` - When the request was sent
 *
 * Design notes:
 * - Only pending requests are stored; accepted/declined are deleted
 * - Unique constraint prevents duplicate requests
 * - Indexed for fast lookup by recipient (most common query)
 * - CASCADE DELETE ensures cleanup when character is deleted
 */
export const friendRequests = pgTable(
  "friend_requests",
  {
    id: text("id").primaryKey(), // UUID
    fromPlayerId: text("fromPlayerId")
      .notNull()
      .references(() => characters.id, { onDelete: "cascade" }),
    toPlayerId: text("toPlayerId")
      .notNull()
      .references(() => characters.id, { onDelete: "cascade" }),
    createdAt: bigint("createdAt", { mode: "number" }).notNull(),
  },
  (table) => ({
    uniqueRequest: unique().on(table.fromPlayerId, table.toPlayerId),
    toPlayerIdx: index("idx_friend_requests_to").on(table.toPlayerId),
    fromPlayerIdx: index("idx_friend_requests_from").on(table.fromPlayerId),
    createdAtIdx: index("idx_friend_requests_created").on(table.createdAt),
  }),
);

/**
 * Ignore List Table - Blocked players
 *
 * Stores players that a user has blocked/ignored.
 * Ignored players cannot send private messages or friend requests.
 *
 * Key columns:
 * - `playerId` - The player who is ignoring
 * - `ignoredPlayerId` - The player being ignored
 * - `createdAt` - When the ignore was added
 *
 * Design notes:
 * - Unidirectional: A ignoring B doesn't mean B ignores A
 * - Unique constraint prevents duplicate entries
 * - Indexed on playerId for fast ignore list lookups
 * - CASCADE DELETE ensures cleanup when character is deleted
 * - Max 99 ignored players per player (enforced in application logic)
 */
export const ignoreList = pgTable(
  "ignore_list",
  {
    id: serial("id").primaryKey(),
    playerId: text("playerId")
      .notNull()
      .references(() => characters.id, { onDelete: "cascade" }),
    ignoredPlayerId: text("ignoredPlayerId")
      .notNull()
      .references(() => characters.id, { onDelete: "cascade" }),
    createdAt: bigint("createdAt", { mode: "number" })
      .notNull()
      .default(sql`(EXTRACT(EPOCH FROM NOW()) * 1000)::BIGINT`),
  },
  (table) => ({
    uniqueIgnore: unique().on(table.playerId, table.ignoredPlayerId),
    playerIdx: index("idx_ignore_list_player").on(table.playerId),
  }),
);

/**
 * Friendships Relations
 */
export const friendshipsRelations = relations(friendships, ({ one }) => ({
  player: one(characters, {
    fields: [friendships.playerId],
    references: [characters.id],
    relationName: "playerFriendships",
  }),
  friend: one(characters, {
    fields: [friendships.friendId],
    references: [characters.id],
    relationName: "friendOf",
  }),
}));

/**
 * Friend Requests Relations
 */
export const friendRequestsRelations = relations(friendRequests, ({ one }) => ({
  fromPlayer: one(characters, {
    fields: [friendRequests.fromPlayerId],
    references: [characters.id],
    relationName: "sentFriendRequests",
  }),
  toPlayer: one(characters, {
    fields: [friendRequests.toPlayerId],
    references: [characters.id],
    relationName: "receivedFriendRequests",
  }),
}));

/**
 * Ignore List Relations
 */
export const ignoreListRelations = relations(ignoreList, ({ one }) => ({
  player: one(characters, {
    fields: [ignoreList.playerId],
    references: [characters.id],
    relationName: "playerIgnoreList",
  }),
  ignoredPlayer: one(characters, {
    fields: [ignoreList.ignoredPlayerId],
    references: [characters.id],
    relationName: "ignoredBy",
  }),
}));

// ============================================================================
// FAILED TRANSACTION RECOVERY TABLE
// ============================================================================

/**
 * Failed Transactions Table - Recovery queue for failed blockchain writes
 *
 * Persists failed MUD system calls for later recovery and dead-letter handling.
 * Used by BatchWriter to ensure no data is lost on transaction failures.
 *
 * Key columns:
 * - `dedupeKey` - Unique identifier for the call (prevents duplicates)
 * - `callData` - The encoded transaction data (hex)
 * - `description` - Human-readable description
 * - `status` - "pending" | "dead_letter"
 * - `attemptCount` - Number of retry attempts
 * - `lastError` - Most recent error message
 * - `queuedAt` - When the call was originally queued
 * - `failedAt` - When the call was marked as failed
 *
 * Design notes:
 * - Primary key on dedupeKey ensures idempotent persistence
 * - Dead letter transactions are kept for manual review/replay
 * - Pending transactions are loaded on startup for recovery
 */
export const failedTransactions = pgTable(
  "failed_transactions",
  {
    dedupeKey: text("dedupeKey").primaryKey(),
    callData: text("callData").notNull(),
    description: text("description").notNull(),
    status: text("status").notNull().default("pending"), // "pending" | "dead_letter"
    attemptCount: integer("attemptCount").notNull().default(0),
    lastError: text("lastError"),
    queuedAt: bigint("queuedAt", { mode: "number" }).notNull(),
    failedAt: bigint("failedAt", { mode: "number" })
      .notNull()
      .default(sql`(EXTRACT(EPOCH FROM NOW()) * 1000)::BIGINT`),
    createdAt: bigint("createdAt", { mode: "number" })
      .notNull()
      .default(sql`(EXTRACT(EPOCH FROM NOW()) * 1000)::BIGINT`),
  },
  (table) => ({
    statusIdx: index("idx_failed_transactions_status").on(table.status),
    failedAtIdx: index("idx_failed_transactions_failed_at").on(table.failedAt),
  }),
);

// ============================================================================
// AGENT DUEL STATS TABLE
// ============================================================================

/**
 * Agent Duel Stats - AI agent performance tracking for streaming mode
 *
 * Tracks performance metrics for AI agents in autonomous duel streaming.
 * This enables leaderboards, model comparison, and betting market insights.
 *
 * Key columns:
 * - `characterId` - References characters.id (agent character)
 * - `agentName` - Display name of the agent
 * - `provider` - AI provider (e.g., "openai", "anthropic")
 * - `model` - AI model identifier (e.g., "gpt-4", "claude-3-opus")
 * - `wins` - Total duel wins
 * - `losses` - Total duel losses
 * - `draws` - Total draws (timeouts, mutual kills)
 * - `totalDamageDealt` - Cumulative damage dealt across all duels
 * - `totalDamageTaken` - Cumulative damage taken across all duels
 * - `killStreak` - Best kill streak achieved
 * - `currentStreak` - Current consecutive win streak
 * - `lastDuelAt` - When agent last participated in a duel
 *
 * Design notes:
 * - Indexed on wins for leaderboard queries
 * - Win rate computed as wins / (wins + losses)
 * - Used by StreamingDuelScheduler for agent selection and stats display
 */
export const agentDuelStats = pgTable(
  "agent_duel_stats",
  {
    characterId: text("characterId")
      .primaryKey()
      .references(() => characters.id, { onDelete: "cascade" }),
    agentName: text("agentName").notNull(),
    provider: text("provider").notNull(),
    model: text("model").notNull(),
    wins: integer("wins").notNull().default(0),
    losses: integer("losses").notNull().default(0),
    draws: integer("draws").notNull().default(0),
    totalDamageDealt: integer("totalDamageDealt").notNull().default(0),
    totalDamageTaken: integer("totalDamageTaken").notNull().default(0),
    killStreak: integer("killStreak").notNull().default(0),
    currentStreak: integer("currentStreak").notNull().default(0),
    lastDuelAt: bigint("lastDuelAt", { mode: "number" }),
    createdAt: bigint("createdAt", { mode: "number" })
      .notNull()
      .default(sql`(EXTRACT(EPOCH FROM NOW()) * 1000)::BIGINT`),
    updatedAt: bigint("updatedAt", { mode: "number" })
      .notNull()
      .default(sql`(EXTRACT(EPOCH FROM NOW()) * 1000)::BIGINT`),
  },
  (table) => ({
    winsIdx: index("idx_agent_duel_stats_wins").on(table.wins),
    providerIdx: index("idx_agent_duel_stats_provider").on(table.provider),
    modelIdx: index("idx_agent_duel_stats_model").on(table.model),
    lastDuelIdx: index("idx_agent_duel_stats_last_duel").on(table.lastDuelAt),
  }),
);

/**
 * Agent Duel Stats Relations
 */
export const agentDuelStatsRelations = relations(agentDuelStats, ({ one }) => ({
  character: one(characters, {
    fields: [agentDuelStats.characterId],
    references: [characters.id],
  }),
}));

// ============================================================================
// ARENA POINTS SYSTEM
// ============================================================================

/**
 * Arena Points - tracks points earned per bet with GOLD multiplier snapshots.
 *
 * Points are awarded when a user places a bet.
 * - 0-999 GOLD                         -> 0×
 * - 1k-99,999 GOLD (wallet + staked)  -> 1×
 * - 100k-999,999 GOLD                 -> 2×
 * - 1M+ GOLD                          -> 3×
 * - 100k+ or 1M+ held >= 10 days      -> +1×
 */
export const arenaPoints = pgTable(
  "arena_points",
  {
    id: serial("id").primaryKey(),
    wallet: text("wallet").notNull(),
    roundId: text("roundId").references(() => arenaRounds.id, {
      onDelete: "cascade",
    }),
    betId: text("betId"),
    side: text("side"), // "A" or "B" - which side the bet was placed on
    basePoints: integer("basePoints").notNull().default(0),
    multiplier: integer("multiplier").notNull().default(0), // 0-4
    totalPoints: integer("totalPoints").notNull().default(0), // basePoints * multiplier
    goldBalance: text("goldBalance"), // snapshot at time of award
    goldHoldDays: integer("goldHoldDays").default(0),
    createdAt: bigint("createdAt", { mode: "number" })
      .notNull()
      .default(sql`(EXTRACT(EPOCH FROM NOW()) * 1000)::BIGINT`),
  },
  (table) => ({
    walletIdx: index("idx_arena_points_wallet").on(table.wallet),
    roundIdx: index("idx_arena_points_round").on(table.roundId),
    createdIdx: index("idx_arena_points_created").on(table.createdAt),
    betIdx: uniqueIndex("uidx_arena_points_bet").on(table.betId),
  }),
);

/**
 * Arena Staking Points - periodic points accrued from staked GOLD.
 *
 * Rewards are accrued in day-sized windows and recorded as immutable rows.
 * Staked GOLD counts toward both:
 * - multiplier tiers (combined with liquid wallet GOLD)
 * - daily staking points
 */
export const arenaStakingPoints = pgTable(
  "arena_staking_points",
  {
    id: serial("id").primaryKey(),
    wallet: text("wallet").notNull(),
    basePoints: integer("basePoints").notNull().default(0),
    multiplier: integer("multiplier").notNull().default(0),
    totalPoints: integer("totalPoints").notNull().default(0),
    daysAccrued: integer("daysAccrued").notNull().default(0),
    liquidGoldBalance: text("liquidGoldBalance").notNull().default("0"),
    stakedGoldBalance: text("stakedGoldBalance").notNull().default("0"),
    goldBalance: text("goldBalance").notNull().default("0"),
    goldHoldDays: integer("goldHoldDays").notNull().default(0),
    periodStartAt: bigint("periodStartAt", { mode: "number" }).notNull(),
    periodEndAt: bigint("periodEndAt", { mode: "number" }).notNull(),
    source: text("source").notNull().default("INDEXER"),
    createdAt: bigint("createdAt", { mode: "number" })
      .notNull()
      .default(sql`(EXTRACT(EPOCH FROM NOW()) * 1000)::BIGINT`),
  },
  (table) => ({
    walletIdx: index("idx_arena_staking_points_wallet").on(table.wallet),
    periodEndIdx: index("idx_arena_staking_points_period_end").on(
      table.periodEndAt,
    ),
    walletPeriodUnique: unique("uidx_arena_staking_points_wallet_period").on(
      table.wallet,
      table.periodStartAt,
      table.periodEndAt,
    ),
    createdIdx: index("idx_arena_staking_points_created").on(table.createdAt),
  }),
);

/**
 * Arena Invite Codes - maps inviter wallets to shareable invite codes.
 *
 * One wallet can own one invite code. Invite codes are used by bettors to
 * link themselves to an inviter for referral points + fee-share accounting.
 */
export const arenaInviteCodes = pgTable(
  "arena_invite_codes",
  {
    code: text("code").primaryKey(),
    inviterWallet: text("inviterWallet").notNull(),
    createdAt: bigint("createdAt", { mode: "number" })
      .notNull()
      .default(sql`(EXTRACT(EPOCH FROM NOW()) * 1000)::BIGINT`),
    updatedAt: bigint("updatedAt", { mode: "number" })
      .notNull()
      .default(sql`(EXTRACT(EPOCH FROM NOW()) * 1000)::BIGINT`),
  },
  (table) => ({
    inviterWalletIdx: uniqueIndex("uidx_arena_invite_codes_inviter_wallet").on(
      table.inviterWallet,
    ),
    createdIdx: index("idx_arena_invite_codes_created").on(table.createdAt),
  }),
);

/**
 * Arena Invited Wallets - immutable wallet→inviter mapping for fair sharing.
 *
 * Each invited wallet can be linked once. This ensures a wallet cannot switch
 * inviters later and keeps points/fee-sharing deterministic.
 */
export const arenaInvitedWallets = pgTable(
  "arena_invited_wallets",
  {
    id: serial("id").primaryKey(),
    inviteCode: text("inviteCode")
      .notNull()
      .references(() => arenaInviteCodes.code, { onDelete: "restrict" }),
    inviterWallet: text("inviterWallet").notNull(),
    invitedWallet: text("invitedWallet").notNull(),
    firstBetId: text("firstBetId"),
    createdAt: bigint("createdAt", { mode: "number" })
      .notNull()
      .default(sql`(EXTRACT(EPOCH FROM NOW()) * 1000)::BIGINT`),
    updatedAt: bigint("updatedAt", { mode: "number" })
      .notNull()
      .default(sql`(EXTRACT(EPOCH FROM NOW()) * 1000)::BIGINT`),
  },
  (table) => ({
    invitedWalletUnique: uniqueIndex(
      "uidx_arena_invited_wallets_invited_wallet",
    ).on(table.invitedWallet),
    inviteCodeIdx: index("idx_arena_invited_wallets_invite_code").on(
      table.inviteCode,
    ),
    inviterWalletIdx: index("idx_arena_invited_wallets_inviter_wallet").on(
      table.inviterWallet,
    ),
    createdIdx: index("idx_arena_invited_wallets_created").on(table.createdAt),
  }),
);

/**
 * Arena Referral Points - points credited to inviters for invited bettors.
 *
 * When an invited wallet earns points from a bet, the inviter receives
 * a fixed 1x referral credit (no holder multiplier) recorded here for
 * transparent auditing.
 */
export const arenaReferralPoints = pgTable(
  "arena_referral_points",
  {
    id: serial("id").primaryKey(),
    roundId: text("roundId").references(() => arenaRounds.id, {
      onDelete: "cascade",
    }),
    betId: text("betId"),
    inviteCode: text("inviteCode")
      .notNull()
      .references(() => arenaInviteCodes.code, { onDelete: "restrict" }),
    inviterWallet: text("inviterWallet").notNull(),
    invitedWallet: text("invitedWallet").notNull(),
    basePoints: integer("basePoints").notNull().default(0),
    multiplier: integer("multiplier").notNull().default(0),
    totalPoints: integer("totalPoints").notNull().default(0),
    createdAt: bigint("createdAt", { mode: "number" })
      .notNull()
      .default(sql`(EXTRACT(EPOCH FROM NOW()) * 1000)::BIGINT`),
  },
  (table) => ({
    inviterWalletIdx: index("idx_arena_referral_points_inviter_wallet").on(
      table.inviterWallet,
    ),
    invitedWalletIdx: index("idx_arena_referral_points_invited_wallet").on(
      table.invitedWallet,
    ),
    roundIdx: index("idx_arena_referral_points_round").on(table.roundId),
    betIdx: index("idx_arena_referral_points_bet").on(table.betId),
    createdIdx: index("idx_arena_referral_points_created").on(table.createdAt),
  }),
);

/**
 * Arena Fee Shares - per-bet referral + market-maker fee accounting.
 *
 * Tracks how each bet fee is split:
 * - fixed 1% fee-sharing pool per bet
 * - invited bettor: 0.1% to inviter, 0.9% to market maker
 * - no invite mapping: 1% to market maker
 *
 * Note: `treasuryFeeGold` is a legacy column name and now stores market-maker share.
 */
export const arenaFeeShares = pgTable(
  "arena_fee_shares",
  {
    id: serial("id").primaryKey(),
    roundId: text("roundId").references(() => arenaRounds.id, {
      onDelete: "cascade",
    }),
    betId: text("betId"),
    bettorWallet: text("bettorWallet").notNull(),
    inviterWallet: text("inviterWallet"),
    inviteCode: text("inviteCode").references(() => arenaInviteCodes.code, {
      onDelete: "set null",
    }),
    chain: text("chain").notNull().default("SOLANA"), // SOLANA|BSC|BASE
    feeBps: integer("feeBps").notNull().default(0),
    totalFeeGold: text("totalFeeGold").notNull().default("0"),
    inviterFeeGold: text("inviterFeeGold").notNull().default("0"),
    treasuryFeeGold: text("treasuryFeeGold").notNull().default("0"),
    createdAt: bigint("createdAt", { mode: "number" })
      .notNull()
      .default(sql`(EXTRACT(EPOCH FROM NOW()) * 1000)::BIGINT`),
  },
  (table) => ({
    roundIdx: index("idx_arena_fee_shares_round").on(table.roundId),
    betIdx: uniqueIndex("uidx_arena_fee_shares_bet").on(table.betId),
    bettorWalletIdx: index("idx_arena_fee_shares_bettor_wallet").on(
      table.bettorWallet,
    ),
    inviterWalletIdx: index("idx_arena_fee_shares_inviter_wallet").on(
      table.inviterWallet,
    ),
    chainIdx: index("idx_arena_fee_shares_chain").on(table.chain),
    inviteCodeIdx: index("idx_arena_fee_shares_invite_code").on(
      table.inviteCode,
    ),
    createdIdx: index("idx_arena_fee_shares_created").on(table.createdAt),
  }),
);

/**
 * Arena Wallet Links - immutable wallet-pair links for cross-chain identity.
 *
 * Supports EVM<->Solana linking so referral mapping and bonus points can be
 * applied consistently across linked wallets.
 */
export const arenaWalletLinks = pgTable(
  "arena_wallet_links",
  {
    id: serial("id").primaryKey(),
    walletA: text("walletA").notNull(),
    walletAPlatform: text("walletAPlatform").notNull(), // SOLANA|BSC|BASE
    walletB: text("walletB").notNull(),
    walletBPlatform: text("walletBPlatform").notNull(), // SOLANA|BSC|BASE
    pairKey: text("pairKey").notNull(),
    createdAt: bigint("createdAt", { mode: "number" })
      .notNull()
      .default(sql`(EXTRACT(EPOCH FROM NOW()) * 1000)::BIGINT`),
    updatedAt: bigint("updatedAt", { mode: "number" })
      .notNull()
      .default(sql`(EXTRACT(EPOCH FROM NOW()) * 1000)::BIGINT`),
  },
  (table) => ({
    pairKeyUnique: uniqueIndex("uidx_arena_wallet_links_pair_key").on(
      table.pairKey,
    ),
    walletAIdx: index("idx_arena_wallet_links_wallet_a").on(table.walletA),
    walletBIdx: index("idx_arena_wallet_links_wallet_b").on(table.walletB),
    walletAPlatformIdx: index("idx_arena_wallet_links_wallet_a_platform").on(
      table.walletAPlatform,
    ),
    walletBPlatformIdx: index("idx_arena_wallet_links_wallet_b_platform").on(
      table.walletBPlatform,
    ),
    createdIdx: index("idx_arena_wallet_links_created").on(table.createdAt),
  }),
);

// ============================================================================
// ARENA POINT LEDGER (append-only source of truth)
// ============================================================================

/**
 * Arena Point Ledger - immutable append-only record of every point mutation.
 *
 * Event types:
 *   BET_PLACED, BET_WON, REFERRAL_BET, REFERRAL_WIN,
 *   SIGNUP_REFERRER, SIGNUP_REFEREE, STAKING_ACCRUAL,
 *   WALLET_LINK_BONUS, CLAWBACK, VOID
 *
 * Status: CONFIRMED (default), PENDING (awaiting activation), VOIDED
 */
export const arenaPointLedger = pgTable(
  "arena_point_ledger",
  {
    id: serial("id").primaryKey(),
    wallet: text("wallet").notNull(),
    eventType: text("eventType").notNull(),
    status: text("status").notNull().default("CONFIRMED"),
    basePoints: integer("basePoints").notNull(),
    multiplier: integer("multiplier").notNull().default(1),
    totalPoints: integer("totalPoints").notNull(),
    referenceType: text("referenceType"),
    referenceId: text("referenceId"),
    relatedWallet: text("relatedWallet"),
    idempotencyKey: text("idempotencyKey"),
    metadata: jsonb("metadata").default({}),
    createdAt: bigint("createdAt", { mode: "number" })
      .notNull()
      .default(sql`(EXTRACT(EPOCH FROM NOW()) * 1000)::BIGINT`),
    confirmedAt: bigint("confirmedAt", { mode: "number" }),
  },
  (table) => ({
    walletIdx: index("idx_arena_point_ledger_wallet").on(table.wallet),
    walletEventIdx: index("idx_arena_point_ledger_wallet_event").on(
      table.wallet,
      table.eventType,
    ),
    createdIdx: index("idx_arena_point_ledger_created").on(table.createdAt),
    statusIdx: index("idx_arena_point_ledger_pending").on(table.status),
    refIdx: index("idx_arena_point_ledger_ref").on(
      table.referenceType,
      table.referenceId,
    ),
    idempotencyIdx: uniqueIndex("uidx_arena_point_ledger_idempotency").on(
      table.idempotencyKey,
    ),
  }),
);

/**
 * Arena Point Accounts - cached wallet balances derived from the ledger.
 *
 * Fast reads for leaderboard and wallet queries. Updated atomically
 * alongside ledger inserts within a single transaction.
 */
export const arenaPointAccounts = pgTable("arena_point_accounts", {
  wallet: text("wallet").primaryKey(),
  totalPoints: bigint("totalPoints", { mode: "number" }).notNull().default(0),
  betPoints: bigint("betPoints", { mode: "number" }).notNull().default(0),
  winPoints: bigint("winPoints", { mode: "number" }).notNull().default(0),
  referralPoints: bigint("referralPoints", { mode: "number" })
    .notNull()
    .default(0),
  stakingPoints: bigint("stakingPoints", { mode: "number" })
    .notNull()
    .default(0),
  bonusPoints: bigint("bonusPoints", { mode: "number" }).notNull().default(0),
  pendingPoints: bigint("pendingPoints", { mode: "number" })
    .notNull()
    .default(0),
  referredBy: text("referredBy"),
  referralCount: integer("referralCount").notNull().default(0),
  version: integer("version").notNull().default(0),
  updatedAt: bigint("updatedAt", { mode: "number" })
    .notNull()
    .default(sql`(EXTRACT(EPOCH FROM NOW()) * 1000)::BIGINT`),
});

/**
 * Arena Failed Awards - retry queue for point mutations that failed.
 *
 * Processed by the tick loop every 30 seconds with exponential backoff.
 * After max_attempts, the entry is left for manual review.
 */
export const arenaFailedAwards = pgTable(
  "arena_failed_awards",
  {
    id: serial("id").primaryKey(),
    eventType: text("eventType").notNull(),
    payload: jsonb("payload").notNull(),
    errorMessage: text("errorMessage"),
    attempts: integer("attempts").notNull().default(0),
    maxAttempts: integer("maxAttempts").notNull().default(5),
    nextAttemptAt: bigint("nextAttemptAt", { mode: "number" }).notNull(),
    createdAt: bigint("createdAt", { mode: "number" })
      .notNull()
      .default(sql`(EXTRACT(EPOCH FROM NOW()) * 1000)::BIGINT`),
    resolvedAt: bigint("resolvedAt", { mode: "number" }),
  },
  (table) => ({
    nextAttemptIdx: index("idx_arena_failed_awards_next").on(
      table.nextAttemptAt,
    ),
  }),
);

/**
 * Streaming Duel History - Persisted log of every streaming duel outcome.
 *
 * Written fire-and-forget by MatchmakingManager after each cycle resolves.
 * Used for analytics, replay feeds, and leaderboard verification.
 */
export const streamingDuelHistory = pgTable(
  "streaming_duel_history",
  {
    id: serial("id").primaryKey(),
    cycleId: text("cycleId").notNull(),
    duelId: text("duelId"),
    finishedAt: bigint("finishedAt", { mode: "number" }).notNull(),
    winnerId: text("winnerId").notNull(),
    winnerName: text("winnerName").notNull(),
    loserId: text("loserId").notNull(),
    loserName: text("loserName").notNull(),
    winReason: text("winReason").notNull(),
    damageWinner: integer("damageWinner").notNull().default(0),
    damageLoser: integer("damageLoser").notNull().default(0),
  },
  (table) => ({
    finishedAtIdx: index("idx_streaming_duel_history_finished").on(
      table.finishedAt,
    ),
    winnerIdx: index("idx_streaming_duel_history_winner").on(table.winnerId),
    loserIdx: index("idx_streaming_duel_history_loser").on(table.loserId),
  }),
);

/**
 * Agent Thoughts Table - Persistent agent decision log
 *
 * Stores every LLM/scripted decision an agent makes so that thought history
 * survives server restarts. The in-memory `ServerNetwork.agentThoughts` map
 * serves as a hot cache; this table is the durable backing store.
 */
export const agentThoughts = pgTable(
  "agent_thoughts",
  {
    id: serial("id").primaryKey(),
    characterId: text("character_id").notNull(),
    type: text("type").notNull(), // "thinking" | "action" | "observation"
    content: text("content").notNull(),
    decisionPath: text("decision_path"), // "llm" | "scripted" | null
    timestamp: bigint("timestamp", { mode: "number" }).notNull(),
  },
  (table) => ({
    characterTimestampIdx: index("idx_agent_thoughts_char_ts").on(
      table.characterId,
      table.timestamp,
    ),
  }),
);
