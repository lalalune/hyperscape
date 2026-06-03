/**
 * Bank Handler Integration Test Helpers
 *
 * Provides real handler dependencies (in-memory DB + systems)
 * without module-level mocks.
 */

import { newDb } from "pg-mem";
import { drizzle } from "drizzle-orm/node-postgres";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import type pg from "pg";
import { SessionType } from "@hyperforge/shared";
import * as schema from "../../../src/database/schema";
import type { Item } from "../../../../shared/src/types/game/item-types";
import { ITEMS } from "../../../../shared/src/data/items";

// ============================================================================
// Types
// ============================================================================

type PacketData =
  | string
  | number
  | boolean
  | null
  | { [key: string]: object | string | number | boolean | null | undefined }
  | Array<object>;

export interface TestSocket {
  id: string;
  send: (packet: string, data: PacketData) => void;
  sent: Array<{ packet: string; data: PacketData }>;
  player?: TestPlayer;
  data: {
    playerId?: string;
    visibleName?: string;
    session?: {
      type: SessionType;
      entityId: string;
    };
  };
}

export interface TestPlayer {
  id: string;
  visibleName: string;
  position: { x: number; y: number; z: number };
}

export interface TestEntity {
  id: string;
  position: { x: number; z: number };
  base?: { position: { x: number; z: number } };
}

export interface TestDatabase {
  db: NodePgDatabase<typeof schema>;
  pool: pg.Pool;
  cleanup: () => Promise<void>;
}

export interface TestWorld {
  entities: Map<string, TestEntity>;
  getSystem: (name: string) => object | null;
  emit: (event: string, data: PacketData) => void;
  emitted: Array<{ event: string; data: PacketData }>;
  interactionSessionManager?: {
    getSession: (playerId: string) => { targetEntityId: string } | undefined;
  };
  drizzleDb?: NodePgDatabase<typeof schema>;
  pgPool?: pg.Pool;
}

export interface TestContext {
  socket: TestSocket;
  playerId: string;
  world: TestWorld;
  db: { drizzle: NodePgDatabase<typeof schema>; pool: pg.Pool };
}

// ============================================================================
// In-Memory Database
// ============================================================================

function initializeBankSchema(db: ReturnType<typeof newDb>): void {
  // Column names must be quoted to preserve case (Drizzle uses camelCase)
  db.public.none(`
    CREATE TABLE characters (
      "id" text PRIMARY KEY,
      "accountId" text NOT NULL,
      "name" text NOT NULL,
      "alwaysSetPlaceholder" integer DEFAULT 0,
      "coins" integer DEFAULT 0,
      "questPoints" integer DEFAULT 0,
      "createdAt" bigint DEFAULT 0,
      "combatLevel" integer DEFAULT 1,
      "attackLevel" integer DEFAULT 1,
      "strengthLevel" integer DEFAULT 1,
      "defenseLevel" integer DEFAULT 1,
      "constitutionLevel" integer DEFAULT 1,
      "rangedLevel" integer DEFAULT 1,
      "magicLevel" integer DEFAULT 1,
      "prayerLevel" integer DEFAULT 1,
      "woodcuttingLevel" integer DEFAULT 1,
      "miningLevel" integer DEFAULT 1,
      "fishingLevel" integer DEFAULT 1,
      "firemakingLevel" integer DEFAULT 1,
      "cookingLevel" integer DEFAULT 1,
      "smithingLevel" integer DEFAULT 1,
      "agilityLevel" integer DEFAULT 1,
      "craftingLevel" integer DEFAULT 1,
      "fletchingLevel" integer DEFAULT 1,
      "runecraftingLevel" integer DEFAULT 1,
      "attackXp" integer DEFAULT 0,
      "strengthXp" integer DEFAULT 0,
      "defenseXp" integer DEFAULT 0,
      "constitutionXp" integer DEFAULT 0,
      "rangedXp" integer DEFAULT 0,
      "magicXp" integer DEFAULT 0,
      "prayerXp" integer DEFAULT 0,
      "woodcuttingXp" integer DEFAULT 0,
      "miningXp" integer DEFAULT 0,
      "fishingXp" integer DEFAULT 0,
      "firemakingXp" integer DEFAULT 0,
      "cookingXp" integer DEFAULT 0,
      "smithingXp" integer DEFAULT 0,
      "agilityXp" integer DEFAULT 0,
      "craftingXp" integer DEFAULT 0,
      "fletchingXp" integer DEFAULT 0,
      "runecraftingXp" integer DEFAULT 0,
      "prayerPoints" integer DEFAULT 10,
      "prayerMaxPoints" integer DEFAULT 10,
      "activePrayers" text DEFAULT '[]',
      "health" integer DEFAULT 10,
      "maxHealth" integer DEFAULT 10,
      "positionX" real DEFAULT 0,
      "positionY" real DEFAULT 0,
      "positionZ" real DEFAULT 0,
      "attackStyle" text DEFAULT 'accurate',
      "autoRetaliate" integer DEFAULT 1,
      "selectedSpell" text,
      "lastLogin" bigint DEFAULT 0,
      "avatar" text,
      "wallet" text,
      "isAgent" integer DEFAULT 0
    );

    CREATE TABLE inventory (
      "id" serial PRIMARY KEY,
      "playerId" text NOT NULL REFERENCES characters("id") ON DELETE CASCADE,
      "itemId" text NOT NULL,
      "quantity" integer DEFAULT 1,
      "slotIndex" integer DEFAULT -1,
      "metadata" text
    );

    CREATE TABLE bank_storage (
      "id" serial PRIMARY KEY,
      "playerId" text NOT NULL REFERENCES characters("id") ON DELETE CASCADE,
      "itemId" text NOT NULL,
      "quantity" integer NOT NULL DEFAULT 1,
      "slot" integer NOT NULL DEFAULT 0,
      "tabIndex" integer NOT NULL DEFAULT 0
    );

    CREATE TABLE bank_tabs (
      "id" serial PRIMARY KEY,
      "playerId" text NOT NULL REFERENCES characters("id") ON DELETE CASCADE,
      "tabIndex" integer NOT NULL,
      "iconItemId" text,
      "createdAt" bigint NOT NULL DEFAULT 0
    );

    CREATE TABLE bank_placeholders (
      "id" serial PRIMARY KEY,
      "playerId" text NOT NULL REFERENCES characters("id") ON DELETE CASCADE,
      "tabIndex" integer NOT NULL DEFAULT 0,
      "slot" integer NOT NULL,
      "itemId" text NOT NULL,
      "createdAt" bigint NOT NULL DEFAULT 0
    );
  `);
}

export function createTestDatabase(): TestDatabase {
  const mem = newDb({ autoCreateForeignKeyIndices: true });
  initializeBankSchema(mem);

  const adapter = mem.adapters.createPg();
  const pool = new adapter.Pool();

  // Workaround for pg-mem + Drizzle ORM compatibility issue
  // See: https://github.com/drizzle-team/drizzle-orm/issues/612
  const originalQuery = pool.query.bind(pool);
  pool.query = function (
    text: string | { text: string; values?: unknown[] },
    params?: unknown[],
  ) {
    // If it's a prepared statement object with types.getTypeParser, extract text only
    if (typeof text === "object" && text !== null) {
      const queryObj = text as {
        text?: string;
        values?: unknown[];
        types?: { getTypeParser?: unknown };
      };
      if (queryObj.text) {
        return originalQuery(queryObj.text, params || queryObj.values);
      }
    }
    return originalQuery(text as string, params);
  };

  const db = drizzle(pool, { schema });

  return {
    db,
    pool,
    cleanup: async () => {
      await pool.end();
    },
  };
}

export async function seedCharacter(
  db: NodePgDatabase<typeof schema>,
  playerId: string,
  alwaysSetPlaceholder = 0,
): Promise<void> {
  // Use raw SQL to insert minimal character data (avoids Drizzle schema mismatch with pg-mem)
  await db.execute(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    `INSERT INTO characters ("id", "accountId", "name", "alwaysSetPlaceholder", "coins")
     VALUES ('${playerId}', 'account-${playerId}', 'TestPlayer', ${alwaysSetPlaceholder}, 0)` as any,
  );
}

export async function seedInventory(
  db: NodePgDatabase<typeof schema>,
  playerId: string,
  items: Array<{
    itemId: string;
    quantity: number;
    slotIndex: number;
  }>,
): Promise<void> {
  if (items.length === 0) return;
  await db.insert(schema.inventory).values(
    items.map((item) => ({
      playerId,
      itemId: item.itemId,
      quantity: item.quantity,
      slotIndex: item.slotIndex,
    })),
  );
}

export async function seedBankStorage(
  db: NodePgDatabase<typeof schema>,
  playerId: string,
  items: Array<{
    itemId: string;
    quantity: number;
    slot: number;
    tabIndex: number;
  }>,
): Promise<void> {
  if (items.length === 0) return;
  await db.insert(schema.bankStorage).values(
    items.map((item) => ({
      playerId,
      itemId: item.itemId,
      quantity: item.quantity,
      slot: item.slot,
      tabIndex: item.tabIndex,
    })),
  );
}

export async function seedBankTabs(
  db: NodePgDatabase<typeof schema>,
  playerId: string,
  tabs: Array<{ tabIndex: number; iconItemId?: string | null }>,
): Promise<void> {
  if (tabs.length === 0) return;
  await db.insert(schema.bankTabs).values(
    tabs.map((tab) => ({
      playerId,
      tabIndex: tab.tabIndex,
      iconItemId: tab.iconItemId ?? null,
      createdAt: Date.now(),
    })),
  );
}

export async function seedBankPlaceholders(
  db: NodePgDatabase<typeof schema>,
  playerId: string,
  placeholders: Array<{ tabIndex: number; slot: number; itemId: string }>,
): Promise<void> {
  if (placeholders.length === 0) return;
  await db.insert(schema.bankPlaceholders).values(
    placeholders.map((ph) => ({
      playerId,
      tabIndex: ph.tabIndex,
      slot: ph.slot,
      itemId: ph.itemId,
      createdAt: Date.now(),
    })),
  );
}

// ============================================================================
// World + Socket Factories
// ============================================================================

export function createTestSocket(
  overrides: Partial<TestSocket> = {},
): TestSocket {
  const sent: Array<{ packet: string; data: PacketData }> = [];
  return {
    id: "socket-test-123",
    sent,
    send: (packet: string, data: PacketData) => {
      sent.push({ packet, data });
    },
    data: {
      playerId: "player-test-123",
      visibleName: "TestPlayer",
      session: {
        type: SessionType.BANK,
        entityId: "bank-entity-1",
      },
    },
    ...overrides,
  };
}

export function createTestPlayer(
  overrides: Partial<TestPlayer> = {},
): TestPlayer {
  return {
    id: "player-test-123",
    visibleName: "TestPlayer",
    position: { x: 10, y: 0, z: 10 },
    ...overrides,
  };
}

export function createTestWorld(
  db: TestDatabase,
  systems: Record<string, object> = {},
  entities: Array<TestEntity> = [],
  playerId = "player-test-123",
  bankEntityId = "bank-entity-1",
): TestWorld {
  const entityMap = new Map<string, TestEntity>();
  for (const entity of entities) {
    entityMap.set(entity.id, entity);
  }

  if (!entityMap.has(bankEntityId)) {
    entityMap.set(bankEntityId, {
      id: bankEntityId,
      position: { x: 10, z: 10 },
      base: { position: { x: 10, z: 10 } },
    });
  }

  const emitted: Array<{ event: string; data: PacketData }> = [];
  return {
    entities: entityMap,
    getSystem: (name: string) => systems[name] ?? null,
    emitted,
    emit: (event: string, data: PacketData) => {
      emitted.push({ event, data });
    },
    interactionSessionManager: {
      getSession: (id: string) =>
        id === playerId ? { targetEntityId: bankEntityId } : undefined,
    },
    drizzleDb: db.db,
    pgPool: db.pool,
  };
}

export function createTestContext(
  world: TestWorld,
  socket: TestSocket,
  db: TestDatabase,
  playerId = "player-test-123",
): TestContext {
  return {
    socket,
    playerId,
    world,
    db: { drizzle: db.db, pool: db.pool },
  };
}

export async function setupBankTestEnv(options?: {
  playerId?: string;
  alwaysSetPlaceholder?: number;
  systems?: Record<string, object>;
  bankEntityId?: string;
}): Promise<{
  db: TestDatabase;
  world: TestWorld;
  socket: TestSocket;
  playerId: string;
  cleanup: () => Promise<void>;
}> {
  ensureTestItems();
  const playerId = options?.playerId ?? "player-test-123";
  const db = createTestDatabase();
  await seedCharacter(db.db, playerId, options?.alwaysSetPlaceholder ?? 0);

  const inventorySystem = createTestInventorySystem();
  const systems = {
    inventory: inventorySystem,
    duel: { isPlayerInDuel: () => false },
    ...options?.systems,
  };

  const world = createTestWorld(
    db,
    systems,
    [],
    playerId,
    options?.bankEntityId ?? "bank-entity-1",
  );

  const socket = createTestSocket();
  socket.player = createTestPlayer({ id: playerId });

  return {
    db,
    world,
    socket,
    playerId,
    cleanup: db.cleanup,
  };
}

// ============================================================================
// Inventory + Equipment Systems
// ============================================================================

export interface TestInventorySystem {
  queueOperation: (
    playerId: string,
    operation: () => Promise<boolean>,
  ) => Promise<boolean>;
  lockForTransaction: (playerId: string) => boolean;
  unlockTransaction: (playerId: string) => void;
  persistInventoryImmediate: (playerId: string) => Promise<void>;
  reloadFromDatabase: (playerId: string) => Promise<void>;
}

export function createTestInventorySystem(): TestInventorySystem {
  return {
    queueOperation: async (_playerId, operation) => operation(),
    lockForTransaction: () => true,
    unlockTransaction: () => undefined,
    persistInventoryImmediate: async () => undefined,
    reloadFromDatabase: async () => undefined,
  };
}

export interface TestEquipmentSystem {
  getEquipmentSlotForItem: (itemId: string) => string | null;
  canPlayerEquipItem: (playerId: string, itemId: string) => boolean;
  equipItemDirect: (
    playerId: string,
    itemId: string,
  ) => Promise<{
    success: boolean;
    equippedSlot?: string;
    displacedItems?: Array<{ itemId: string; quantity: number }>;
    error?: string;
  }>;
  unequipItemDirect: (
    playerId: string,
    slot: string,
  ) => Promise<{
    success: boolean;
    itemId?: string;
    quantity?: number;
    error?: string;
  }>;
  getAllEquippedItems: (
    playerId: string,
  ) => Array<{ slot: string; itemId: string }>;
  getPlayerEquipment: (
    playerId: string,
  ) => Record<string, { itemId: string; quantity: number } | null>;
}

export function createTestEquipmentSystem(
  overrides: Partial<TestEquipmentSystem> = {},
): TestEquipmentSystem {
  return {
    getEquipmentSlotForItem: () => "weapon",
    canPlayerEquipItem: () => true,
    equipItemDirect: async () => ({
      success: true,
      equippedSlot: "weapon",
      displacedItems: [],
    }),
    unequipItemDirect: async () => ({
      success: true,
      itemId: "bronze_shortsword",
      quantity: 1,
    }),
    getAllEquippedItems: () => [],
    getPlayerEquipment: () => ({}),
    ...overrides,
  };
}

// ============================================================================
// Shared Items
// ============================================================================

export function ensureTestItems(): void {
  const items: Item[] = [
    {
      id: "logs",
      name: "Logs",
      type: "resource",
      description: "A pile of logs.",
      examine: "Some logs.",
      tradeable: true,
      rarity: "common",
      modelPath: null,
      iconPath: "asset://icons/logs.png",
      noteable: true,
      notedItemId: "logs_noted",
    },
    {
      id: "logs_noted",
      name: "Logs (noted)",
      type: "resource",
      description: "A bank note for logs.",
      examine: "A note for logs.",
      tradeable: true,
      rarity: "common",
      modelPath: null,
      iconPath: "asset://icons/logs.png",
      stackable: true,
      maxStackSize: 10000,
      isNoted: true,
      baseItemId: "logs",
    },
    {
      id: "coins",
      name: "Coins",
      type: "currency",
      description: "Shiny coins.",
      examine: "Some coins.",
      tradeable: true,
      rarity: "common",
      modelPath: null,
      iconPath: "asset://icons/coins.png",
      stackable: true,
      maxStackSize: 1000000000,
    },
    {
      id: "bronze_sword",
      name: "Bronze Sword",
      type: "weapon",
      description: "A bronze sword.",
      examine: "A bronze sword.",
      tradeable: true,
      rarity: "common",
      modelPath: null,
      iconPath: "asset://icons/bronze-sword.png",
      equipSlot: "weapon",
    },
    {
      id: "rune_sword",
      name: "Rune Sword",
      type: "weapon",
      description: "A rune sword.",
      examine: "A rune sword.",
      tradeable: true,
      rarity: "rare",
      modelPath: null,
      iconPath: "asset://icons/rune-sword.png",
      equipSlot: "weapon",
    },
    {
      id: "bronze_helm",
      name: "Bronze Helm",
      type: "armor",
      description: "A bronze helm.",
      examine: "A bronze helm.",
      tradeable: true,
      rarity: "common",
      modelPath: null,
      iconPath: "asset://icons/bronze-helm.png",
      equipSlot: "helmet",
    },
    {
      id: "bronze_platebody",
      name: "Bronze Platebody",
      type: "armor",
      description: "A bronze platebody.",
      examine: "A bronze platebody.",
      tradeable: true,
      rarity: "common",
      modelPath: null,
      iconPath: "asset://icons/bronze-platebody.png",
      equipSlot: "body",
    },
    {
      id: "wooden_shield",
      name: "Wooden Shield",
      type: "armor",
      description: "A wooden shield.",
      examine: "A wooden shield.",
      tradeable: true,
      rarity: "common",
      modelPath: null,
      iconPath: "asset://icons/wooden-shield.png",
      equipSlot: "shield",
    },
  ];

  for (const item of items) {
    if (!ITEMS.has(item.id)) {
      ITEMS.set(item.id, item);
    }
  }
}

// ============================================================================
// Assertion Helpers
// ============================================================================

export function expectErrorToast(socket: TestSocket, message?: string): void {
  const toastCall = socket.sent.find((call) => {
    if (call.packet !== "showToast") return false;
    if (!call.data || typeof call.data !== "object") return false;
    return (
      "type" in call.data && (call.data as { type?: string }).type === "error"
    );
  });

  if (!toastCall) {
    throw new Error(
      `Expected error toast to be sent, but none found. Calls: ${JSON.stringify(socket.sent)}`,
    );
  }

  const data = toastCall.data as { message?: string; type?: string };
  if (message && data.message !== message) {
    throw new Error(
      `Expected error toast with message "${message}", got "${data.message}"`,
    );
  }
}

export function expectSuccessToast(socket: TestSocket, message?: string): void {
  const toastCall = socket.sent.find((call) => {
    if (call.packet !== "showToast") return false;
    if (!call.data || typeof call.data !== "object") return false;
    return (
      "type" in call.data && (call.data as { type?: string }).type === "success"
    );
  });

  if (!toastCall) {
    throw new Error(
      `Expected success toast to be sent, but none found. Calls: ${JSON.stringify(socket.sent)}`,
    );
  }

  const data = toastCall.data as { message?: string; type?: string };
  if (message && data.message !== message) {
    throw new Error(
      `Expected success toast with message "${message}", got "${data.message}"`,
    );
  }
}

export function expectBankStateUpdate(socket: TestSocket): void {
  const bankCall = socket.sent.find((call) => call.packet === "bankState");

  if (!bankCall) {
    throw new Error(
      `Expected bank state update, but none found. Calls: ${JSON.stringify(socket.sent)}`,
    );
  }
}

export function expectNoSend(socket: TestSocket): void {
  if (socket.sent.length > 0) {
    throw new Error(
      `Expected no socket sends, but got: ${JSON.stringify(socket.sent)}`,
    );
  }
}
