import {
  pgTable,
  text,
  timestamp,
  integer,
  real,
  bigint,
  index,
  unique,
  foreignKey,
  serial,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";

export const config = pgTable("config", {
  key: text().primaryKey().notNull(),
  value: text(),
});

export const entities = pgTable("entities", {
  id: text().primaryKey().notNull(),
  data: text().notNull(),
  createdAt: timestamp({ mode: "string" }).defaultNow(),
  updatedAt: timestamp({ mode: "string" }).defaultNow(),
});

export const items = pgTable("items", {
  id: integer().primaryKey().notNull(),
  name: text().notNull(),
  type: text().notNull(),
  description: text(),
  value: integer().default(0),
  weight: real().default(0),
  stackable: integer().default(0),
  tradeable: integer().default(1),
  attackLevel: integer(),
  strengthLevel: integer(),
  defenseLevel: integer(),
  rangedLevel: integer(),
  attackBonus: integer().default(0),
  strengthBonus: integer().default(0),
  defenseBonus: integer().default(0),
  rangedBonus: integer().default(0),
  heals: integer(),
});

export const storage = pgTable("storage", {
  key: text().primaryKey().notNull(),
  value: text().notNull(),
  // You can use { mode: "bigint" } if numbers are exceeding js number limitations
  updatedAt: bigint({ mode: "number" }).default(
    sql`((EXTRACT(epoch FROM now()) * (1000)`,
  ),
});

export const users = pgTable(
  "users",
  {
    id: text().primaryKey().notNull(),
    name: text().notNull(),
    roles: text().notNull(),
    createdAt: text().notNull(),
    avatar: text(),
    privyUserId: text(),
    farcasterFid: text(),
  },
  (table) => [
    index("idx_users_farcaster").using(
      "btree",
      table.farcasterFid.asc().nullsLast().op("text_ops"),
    ),
    index("idx_users_privy").using(
      "btree",
      table.privyUserId.asc().nullsLast().op("text_ops"),
    ),
    unique("users_privyUserId_unique").on(table.privyUserId),
  ],
);

export const worldChunks = pgTable(
  "world_chunks",
  {
    chunkX: integer().notNull(),
    chunkZ: integer().notNull(),
    data: text().notNull(),
    // You can use { mode: "bigint" } if numbers are exceeding js number limitations
    lastActive: bigint({ mode: "number" }).default(
      sql`((EXTRACT(epoch FROM now()) * (1000)`,
    ),
    playerCount: integer().default(0),
    version: integer().default(1),
    needsReset: integer().default(0),
  },
  (table) => [
    unique("world_chunks_chunkX_chunkZ_unique").on(table.chunkX, table.chunkZ),
  ],
);

export const characters = pgTable(
  "characters",
  {
    id: text().primaryKey().notNull(),
    accountId: text().notNull(),
    name: text().notNull(),
    // You can use { mode: "bigint" } if numbers are exceeding js number limitations
    createdAt: bigint({ mode: "number" }).default(
      sql`((EXTRACT(epoch FROM now()) * (1000)`,
    ),
    combatLevel: integer().default(1),
    attackLevel: integer().default(1),
    strengthLevel: integer().default(1),
    defenseLevel: integer().default(1),
    constitutionLevel: integer().default(10),
    rangedLevel: integer().default(1),
    woodcuttingLevel: integer().default(1),
    fishingLevel: integer().default(1),
    firemakingLevel: integer().default(1),
    cookingLevel: integer().default(1),
    attackXp: integer().default(0),
    strengthXp: integer().default(0),
    defenseXp: integer().default(0),
    constitutionXp: integer().default(1154),
    rangedXp: integer().default(0),
    woodcuttingXp: integer().default(0),
    fishingXp: integer().default(0),
    firemakingXp: integer().default(0),
    cookingXp: integer().default(0),
    health: integer().default(100),
    maxHealth: integer().default(100),
    coins: integer().default(0),
    positionX: real().default(0),
    positionY: real().default(10),
    positionZ: real().default(0),
    // You can use { mode: "bigint" } if numbers are exceeding js number limitations
    lastLogin: bigint({ mode: "number" }).default(0),
    avatar: text(),
    wallet: text(),
  },
  (table) => [
    index("idx_characters_account").using(
      "btree",
      table.accountId.asc().nullsLast().op("text_ops"),
    ),
    index("idx_characters_wallet").using(
      "btree",
      table.wallet.asc().nullsLast().op("text_ops"),
    ),
  ],
);

export const chunkActivity = pgTable(
  "chunk_activity",
  {
    id: serial().primaryKey().notNull(),
    chunkX: integer().notNull(),
    chunkZ: integer().notNull(),
    playerId: text().notNull(),
    // You can use { mode: "bigint" } if numbers are exceeding js number limitations
    entryTime: bigint({ mode: "number" }).notNull(),
    // You can use { mode: "bigint" } if numbers are exceeding js number limitations
    exitTime: bigint({ mode: "number" }),
  },
  (table) => [
    foreignKey({
      columns: [table.playerId],
      foreignColumns: [characters.id],
      name: "chunk_activity_playerId_characters_id_fk",
    }).onDelete("cascade"),
  ],
);

export const equipment = pgTable(
  "equipment",
  {
    id: serial().primaryKey().notNull(),
    playerId: text().notNull(),
    slotType: text().notNull(),
    itemId: text(),
    quantity: integer().default(1),
  },
  (table) => [
    foreignKey({
      columns: [table.playerId],
      foreignColumns: [characters.id],
      name: "equipment_playerId_characters_id_fk",
    }).onDelete("cascade"),
    unique("equipment_playerId_slotType_unique").on(
      table.playerId,
      table.slotType,
    ),
  ],
);

export const inventory = pgTable(
  "inventory",
  {
    id: serial().primaryKey().notNull(),
    playerId: text().notNull(),
    itemId: text().notNull(),
    quantity: integer().default(1),
    slotIndex: integer().default(sql`'-1'`),
    metadata: text(),
  },
  (table) => [
    foreignKey({
      columns: [table.playerId],
      foreignColumns: [characters.id],
      name: "inventory_playerId_characters_id_fk",
    }).onDelete("cascade"),
  ],
);

export const playerSessions = pgTable(
  "player_sessions",
  {
    id: text().primaryKey().notNull(),
    playerId: text().notNull(),
    // You can use { mode: "bigint" } if numbers are exceeding js number limitations
    sessionStart: bigint({ mode: "number" }).notNull(),
    // You can use { mode: "bigint" } if numbers are exceeding js number limitations
    sessionEnd: bigint({ mode: "number" }),
    playtimeMinutes: integer().default(0),
    reason: text(),
    // You can use { mode: "bigint" } if numbers are exceeding js number limitations
    lastActivity: bigint({ mode: "number" }).default(0),
  },
  (table) => [
    foreignKey({
      columns: [table.playerId],
      foreignColumns: [characters.id],
      name: "player_sessions_playerId_characters_id_fk",
    }).onDelete("cascade"),
  ],
);

export const npcKills = pgTable(
  "npc_kills",
  {
    id: serial().primaryKey().notNull(),
    playerId: text().notNull(),
    npcId: text().notNull(),
    killCount: integer().default(1).notNull(),
  },
  (table) => [
    index("idx_npc_kills_player").using(
      "btree",
      table.playerId.asc().nullsLast().op("text_ops"),
    ),
    foreignKey({
      columns: [table.playerId],
      foreignColumns: [characters.id],
      name: "npc_kills_playerId_characters_id_fk",
    }).onDelete("cascade"),
    unique("npc_kills_playerId_npcId_unique").on(table.playerId, table.npcId),
  ],
);

export const playerDeaths = pgTable(
  "player_deaths",
  {
    playerId: text().primaryKey().notNull(),
    gravestoneId: text(),
    groundItemIds: text(),
    position: text().notNull(),
    // You can use { mode: "bigint" } if numbers are exceeding js number limitations
    timestamp: bigint({ mode: "number" }).notNull(),
    zoneType: text().notNull(),
    itemCount: integer().default(0).notNull(),
    // You can use { mode: "bigint" } if numbers are exceeding js number limitations
    createdAt: bigint({ mode: "number" })
      .default(sql`((EXTRACT(epoch FROM now()) * (1000)`)
      .notNull(),
    // You can use { mode: "bigint" } if numbers are exceeding js number limitations
    updatedAt: bigint({ mode: "number" })
      .default(sql`((EXTRACT(epoch FROM now()) * (1000)`)
      .notNull(),
  },
  (table) => [
    index("idx_player_deaths_timestamp").using(
      "btree",
      table.timestamp.asc().nullsLast().op("int8_ops"),
    ),
    foreignKey({
      columns: [table.playerId],
      foreignColumns: [characters.id],
      name: "player_deaths_playerId_characters_id_fk",
    }).onDelete("cascade"),
  ],
);
