/**
 * DatabaseSystem - Server-side database operations for persistent game state
 *
 * This system provides a comprehensive interface for all database operations in Hyperia.
 * It uses PostgreSQL with Drizzle ORM for type-safe queries and migrations.
 *
 * Architecture (Refactored):
 * - DatabaseSystem acts as a facade/coordinator
 * - Domain-specific operations delegated to repositories
 * - Each repository handles one area (players, inventory, equipment, etc.)
 * - Maintains backward compatibility with all existing methods
 *
 * Key responsibilities:
 * - Character management (create, load, save character data)
 * - Player persistence (stats, position, levels, XP)
 * - Inventory and equipment storage
 * - Session tracking (login/logout times, playtime)
 * - World chunk persistence (terrain modifications, entities)
 *
 * Usage:
 * ```typescript
 * const dbSystem = world.getSystem('database') as DatabaseSystem;
 * const player = await dbSystem.getPlayerAsync(playerId);
 * await dbSystem.savePlayerAsync(playerId, { health: 100 });
 * ```
 */

import { SystemBase } from "@hyperforge/shared";
import type { World } from "@hyperforge/shared";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import { eq, sql } from "drizzle-orm";
import type pg from "pg";
import * as schema from "../../database/schema";
import type {
  EquipmentRow,
  EquipmentSaveItem,
  InventoryRow,
  InventorySaveItem,
  ItemRow,
  PlayerRow,
  PlayerSessionRow,
  WorldChunkRow,
  ActivityLogEntry,
  ActivityLogRow,
  ActivityLogQueryOptions,
  TradeEntry,
  TradeRow,
  TradeQueryOptions,
} from "../../shared/types";
import {
  CharacterRepository,
  PlayerRepository,
  InventoryRepository,
  EquipmentRepository,
  SessionRepository,
  WorldChunkRepository,
  NPCKillRepository,
  DeathRepository,
  TemplateRepository,
  QuestRepository,
  ActivityLogRepository,
  BankRepository,
} from "../../database/repositories";
import type { DeathLockData } from "../../database/repositories/DeathRepository";

const IS_PLAYWRIGHT_TEST = process.env.PLAYWRIGHT_TEST === "true";
const isTruthyEnv = (value: string | undefined): boolean =>
  value != null && /^(1|true|yes|on)$/i.test(value.trim());
const DISABLE_WORLD_CHUNK_PERSISTENCE =
  IS_PLAYWRIGHT_TEST ||
  isTruthyEnv(process.env.DISABLE_WORLD_CHUNK_PERSISTENCE);
const DB_WRITE_ERRORS_NON_FATAL =
  IS_PLAYWRIGHT_TEST ||
  isTruthyEnv(process.env.DB_WRITE_ERRORS_NON_FATAL) ||
  isTruthyEnv(process.env.DUEL_DB_WRITE_BEST_EFFORT);

function isTransientDbConnectivityError(error: unknown): boolean {
  const message =
    error instanceof Error
      ? `${error.message}\n${error.stack ?? ""}`
      : String(error);

  return [
    "ECONNREFUSED",
    "ECONNRESET",
    "ETIMEDOUT",
    "ENOTFOUND",
    "Connection terminated",
    "connection timeout",
    "failed to connect",
    "Connection terminated unexpectedly",
  ].some((pattern) => message.includes(pattern));
}

/**
 * Transaction isolation levels for database operations
 *
 * - 'read committed' (default): Prevents dirty reads
 * - 'repeatable read': Prevents dirty reads and non-repeatable reads
 * - 'serializable': Prevents all concurrency anomalies (strictest)
 *
 * Use 'serializable' for critical financial/inventory operations where
 * race conditions could cause item duplication or loss.
 */
export type IsolationLevel =
  | "read committed"
  | "repeatable read"
  | "serializable";

/**
 * DatabaseSystem class
 *
 * Extends SystemBase to integrate with HyperForge's ECS architecture.
 * Acts as a facade that delegates to domain-specific repositories.
 */
export class DatabaseSystem extends SystemBase {
  /** Drizzle database instance for type-safe queries */
  private db: NodePgDatabase<typeof schema> | null = null;

  /** PostgreSQL connection pool for low-level operations if needed */
  private pool: pg.Pool | null = null;

  /**
   * Tracks all pending database operations to ensure graceful shutdown.
   * Operations are added when sync methods fire-and-forget async work.
   */
  private pendingOperations: Set<Promise<unknown>> = new Set();

  /** Flag to indicate the system is being destroyed - prevents new operations */
  private isDestroying: boolean = false;

  // Repository instances
  private characterRepository!: CharacterRepository;
  private playerRepository!: PlayerRepository;
  private inventoryRepository!: InventoryRepository;
  private equipmentRepository!: EquipmentRepository;
  private sessionRepository!: SessionRepository;
  private worldChunkRepository!: WorldChunkRepository;
  private npcKillRepository!: NPCKillRepository;
  private deathRepository!: DeathRepository;
  private templateRepository!: TemplateRepository;
  private questRepository!: QuestRepository;
  private activityLogRepository!: ActivityLogRepository;
  private bankRepository!: BankRepository;

  /**
   * Constructor
   *
   * Sets up the database system with no dependencies since it provides
   * foundational services to other systems.
   *
   * @param world - The game world instance this system belongs to
   */
  constructor(world: World) {
    super(world, {
      name: "database",
      dependencies: {
        required: [], // No dependencies - this is a foundational system
        optional: [],
      },
      autoCleanup: true, // Automatically clean up resources on destroy
    });
  }

  /**
   * Initialize the database system
   *
   * Retrieves the Drizzle database instance and PostgreSQL pool from the World object.
   * Instantiates all repositories with the database connections.
   *
   * @throws Error if database instances are not available on the world object
   */
  async init(): Promise<void> {
    // Cast world to access server-specific properties
    const serverWorld = this.world as {
      pgPool?: pg.Pool;
      drizzleDb?: NodePgDatabase<typeof schema>;
    };

    if (serverWorld.drizzleDb && serverWorld.pgPool) {
      this.db = serverWorld.drizzleDb;
      this.pool = serverWorld.pgPool;

      // Initialize all repositories
      this.characterRepository = new CharacterRepository(this.db, this.pool);
      this.playerRepository = new PlayerRepository(this.db, this.pool);
      this.inventoryRepository = new InventoryRepository(this.db, this.pool);
      this.equipmentRepository = new EquipmentRepository(this.db, this.pool);
      this.sessionRepository = new SessionRepository(this.db, this.pool);
      this.worldChunkRepository = new WorldChunkRepository(this.db, this.pool);
      this.npcKillRepository = new NPCKillRepository(this.db, this.pool);
      this.deathRepository = new DeathRepository(this.db, this.pool);
      this.templateRepository = new TemplateRepository(this.db, this.pool);
      this.questRepository = new QuestRepository(this.db, this.pool);
      this.activityLogRepository = new ActivityLogRepository(
        this.db,
        this.pool,
      );
      this.bankRepository = new BankRepository(this.db, this.pool);
    } else {
      throw new Error(
        "[DatabaseSystem] Drizzle database not provided on world object",
      );
    }
  }

  /**
   * Start the database system
   *
   * Currently a no-op since all initialization is done in init().
   * The database is ready to use immediately after initialization.
   */
  start(): void {}

  /**
   * Wait for all pending database operations to complete
   *
   * This is critical for graceful shutdown to ensure no data loss.
   * Sync methods (like savePlayer) fire-and-forget async operations which
   * are tracked here. Before shutting down, we wait for all of them to complete.
   *
   * Called by server shutdown handler in index.ts.
   */
  async waitForPendingOperations(): Promise<void> {
    // Set flag to prevent new operations during shutdown
    this.isDestroying = true;

    // Mark all repositories as destroying
    this.characterRepository.markDestroying();
    this.playerRepository.markDestroying();
    this.inventoryRepository.markDestroying();
    this.equipmentRepository.markDestroying();
    this.sessionRepository.markDestroying();
    this.worldChunkRepository.markDestroying();
    this.npcKillRepository.markDestroying();
    this.deathRepository.markDestroying();
    this.templateRepository.markDestroying();
    this.questRepository.markDestroying();
    this.activityLogRepository.markDestroying();
    this.bankRepository.markDestroying();

    if (this.pendingOperations.size === 0) {
      return;
    }

    // Create a copy of the pending operations to avoid issues with modifications during iteration
    const operations = Array.from(this.pendingOperations);

    // Wait for all operations to complete
    await Promise.allSettled(operations);
  }

  /**
   * Helper method to track fire-and-forget async operations
   *
   * Used by sync wrapper methods to ensure operations complete before shutdown.
   * Prevents new operations during shutdown and handles errors gracefully.
   *
   * @param operation - The async operation to track
   * @private
   */
  /** Threshold for warning about pending operation buildup */
  private readonly PENDING_OPS_WARN_THRESHOLD = 50000;
  private lastPendingWarnTime = 0;

  /**
   * Debounce buffer for savePlayer calls.
   * Coalesces multiple field updates per player into a single DB write.
   * Flushed after a short delay (one microtask batch) so rapid XP drops,
   * skill updates, and position saves merge into one UPDATE per player.
   */
  private pendingSaveBuffer = new Map<string, Partial<PlayerRow>>();
  private saveFlushScheduled = false;

  /**
   * Debounce buffer for savePlayerInventory calls.
   * Keeps only the latest snapshot per player — later calls overwrite earlier ones.
   * Prevents concurrent UPSERTs on the same inventory rows (PostgreSQL deadlock).
   */
  private pendingInventoryBuffer = new Map<string, InventorySaveItem[]>();
  private inventoryFlushScheduled = false;

  /**
   * Write coalescing for inventory persistence.
   * When multiple savePlayerInventoryAsync calls arrive for the same player,
   * only the LATEST snapshot is written. At most 2 DB transactions run per
   * player: one active + one queued batch with the newest data.
   * Prevents both PostgreSQL deadlocks and connection pool starvation.
   */
  private inventoryWriteActive = new Map<string, Promise<void>>();
  private inventoryWriteQueued = new Map<
    string,
    {
      items: InventorySaveItem[];
      waiters: Array<{
        resolve: () => void;
        reject: (err: unknown) => void;
      }>;
    }
  >();

  private trackAsyncOperation<T>(operation: Promise<T>): void {
    if (this.isDestroying) return; // Skip during shutdown

    // Warn (but don't drop) if pending operations are accumulating
    if (this.pendingOperations.size >= this.PENDING_OPS_WARN_THRESHOLD) {
      const now = Date.now();
      if (now - this.lastPendingWarnTime > 5000) {
        console.warn(
          `[DatabaseSystem] ${this.pendingOperations.size} pending operations — possible DB slowdown`,
        );
        this.lastPendingWarnTime = now;
      }
    }

    const tracked = operation
      .catch((err) => {
        console.error("[DatabaseSystem] Error in tracked operation:", err);
      })
      .finally(() => {
        this.pendingOperations.delete(tracked);
      });

    this.pendingOperations.add(tracked);
  }

  // ============================================================================
  // TRANSACTION SUPPORT
  // ============================================================================

  /**
   * Execute a callback within a database transaction
   *
   * Provides all-or-nothing execution semantics:
   * - If callback completes successfully → automatic COMMIT
   * - If callback throws error → automatic ROLLBACK
   *
   * CRITICAL FOR SECURITY: Prevents partial database states that can lead to
   * item duplication or item loss (e.g., inventory cleared but gravestone not spawned).
   *
   * Added isolationLevel option for stricter transaction guarantees.
   * Use 'serializable' for death processing to prevent race conditions.
   *
   * @param callback - Async function that receives transaction context
   * @param options - Optional transaction configuration
   * @param options.isolationLevel - Transaction isolation level (default: 'read committed')
   * @returns The result of the callback
   *
   * @example
   * ```typescript
   * // Standard transaction
   * await dbSystem.executeInTransaction(async (tx) => {
   *   await tx.insert(table1).values({...});
   *   await tx.insert(table2).values({...});
   *   // If either fails, both are rolled back
   * });
   *
   * // Serializable transaction for critical operations
   * await dbSystem.executeInTransaction(async (tx) => {
   *   // Fully serialized - prevents all race conditions
   *   await tx.insert(inventory).values({...});
   * }, { isolationLevel: 'serializable' });
   * ```
   */
  async executeInTransaction<T>(
    callback: (tx: NodePgDatabase<typeof schema>) => Promise<T>,
    options?: { isolationLevel?: IsolationLevel },
  ): Promise<T> {
    if (!this.db) {
      throw new Error(
        "[DatabaseSystem] Database not initialized - cannot start transaction",
      );
    }

    // Use specified isolation level, or default to 'read committed'
    return this.db.transaction(callback, {
      isolationLevel: options?.isolationLevel ?? "read committed",
    });
  }

  // ============================================================================
  // CHARACTER MANAGEMENT
  // ============================================================================

  /**
   * Get all characters for an account
   * Delegates to CharacterRepository
   */
  async getCharactersAsync(accountId: string): Promise<
    Array<{
      id: string;
      name: string;
      avatar?: string | null;
      wallet?: string | null;
      isAgent?: boolean;
    }>
  > {
    return this.characterRepository.getCharactersAsync(accountId);
  }

  /**
   * Create a new character
   * Delegates to CharacterRepository
   */
  async createCharacter(
    accountId: string,
    id: string,
    name: string,
    avatar?: string,
    wallet?: string,
    isAgent?: boolean,
  ): Promise<boolean> {
    return this.characterRepository.createCharacter(
      accountId,
      id,
      name,
      avatar,
      wallet,
      isAgent,
    );
  }

  /**
   * Delete a character by ID
   * Delegates to CharacterRepository
   *
   * Used when users cancel agent creation or explicitly delete unwanted characters.
   *
   * @param characterId - The character ID to delete
   * @returns true if character was deleted, false if not found
   */
  async deleteCharacter(characterId: string): Promise<boolean> {
    return this.characterRepository.deleteCharacter(characterId);
  }

  /**
   * Update character's isAgent flag
   * Delegates to CharacterRepository
   *
   * Converts a character between agent and human types. Used when users
   * decide to convert an abandoned agent character to play themselves.
   *
   * @param characterId - The character ID to update
   * @param isAgent - New value for isAgent flag
   * @returns true if character was updated, false if not found
   */
  async updateCharacterIsAgent(
    characterId: string,
    isAgent: boolean,
  ): Promise<boolean> {
    return this.characterRepository.updateCharacterIsAgent(
      characterId,
      isAgent,
    );
  }

  /**
   * Get character skills
   * Delegates to CharacterRepository
   *
   * Retrieves skill levels and XP for a character. Used by the dashboard
   * to display agent skill progress in real-time.
   *
   * @param characterId - The character ID to fetch skills for
   * @returns Skills object with level and xp for each skill, or null if not found
   */
  async getCharacterSkills(characterId: string): Promise<{
    attack: { level: number; xp: number };
    strength: { level: number; xp: number };
    defense: { level: number; xp: number };
    constitution: { level: number; xp: number };
    ranged: { level: number; xp: number };
    prayer: { level: number; xp: number };
    woodcutting: { level: number; xp: number };
    mining: { level: number; xp: number };
    fishing: { level: number; xp: number };
    firemaking: { level: number; xp: number };
    cooking: { level: number; xp: number };
    smithing: { level: number; xp: number };
    agility: { level: number; xp: number };
    crafting: { level: number; xp: number };
  } | null> {
    return this.characterRepository.getCharacterSkills(characterId);
  }

  // ============================================================================
  // TEMPLATE MANAGEMENT
  // ============================================================================

  /**
   * Get all character templates
   * Delegates to TemplateRepository
   *
   * Retrieves all available character templates (archetypes) that players
   * can choose from when creating new characters.
   *
   * @returns Array of all character templates
   */
  async getTemplatesAsync(): Promise<
    Array<{
      id: number;
      name: string;
      description: string;
      emoji: string;
      templateUrl: string;
      templateConfig: string | null;
      createdAt: number;
    }>
  > {
    return this.templateRepository.getAllTemplates();
  }

  /**
   * Get template by ID
   * Delegates to TemplateRepository
   *
   * Retrieves a specific character template by its database ID.
   *
   * @param templateId - The template ID to fetch
   * @returns Template data or null if not found
   */
  async getTemplateByIdAsync(templateId: number): Promise<{
    id: number;
    name: string;
    description: string;
    emoji: string;
    templateUrl: string;
    templateConfig: string | null;
    createdAt: number;
  } | null> {
    return this.templateRepository.getTemplateById(templateId);
  }

  /**
   * Get template by name
   * Delegates to TemplateRepository
   *
   * Retrieves a character template by its name (e.g., "The Skiller").
   * Used for legacy filename-based lookups.
   *
   * @param templateName - The template name to search for
   * @returns Template data or null if not found
   */
  async getTemplateByNameAsync(templateName: string): Promise<{
    id: number;
    name: string;
    description: string;
    emoji: string;
    templateUrl: string;
    templateConfig: string | null;
    createdAt: number;
  } | null> {
    return this.templateRepository.getTemplateByName(templateName);
  }

  // ============================================================================
  // USER MANAGEMENT
  // ============================================================================

  /**
   * Update a user's wallet address
   * This assigns the user's main Privy embedded wallet (HD index 0) to their user record
   *
   * @param accountId - The user's Privy account ID
   * @param wallet - The wallet address to assign
   */
  async updateUserWallet(accountId: string, wallet: string): Promise<void> {
    if (!this.db) {
      throw new Error(
        "[DatabaseSystem] Database not initialized - cannot update user wallet",
      );
    }

    await this.db
      .update(schema.users)
      .set({ wallet })
      .where(eq(schema.users.id, accountId));
  }

  /**
   * Get the raw Drizzle database instance
   * This allows other systems to perform custom queries
   *
   * @returns The Drizzle database instance or null if not initialized
   */
  getDb(): NodePgDatabase<typeof schema> | null {
    return this.db;
  }

  // ============================================================================
  // PLAYER DATA PERSISTENCE
  // ============================================================================

  /**
   * Load player data from database
   * Delegates to PlayerRepository
   */
  async getPlayerAsync(playerId: string): Promise<PlayerRow | null> {
    return this.playerRepository.getPlayerAsync(playerId);
  }

  /**
   * Save player data to database
   * Delegates to PlayerRepository
   */
  async savePlayerAsync(
    playerId: string,
    data: Partial<PlayerRow>,
  ): Promise<void> {
    try {
      return await this.playerRepository.savePlayerAsync(playerId, data);
    } catch (error) {
      if (DB_WRITE_ERRORS_NON_FATAL && isTransientDbConnectivityError(error)) {
        console.warn(
          `[DatabaseSystem] savePlayerAsync(${playerId}) failed due to database connectivity; continuing in best-effort mode`,
          error,
        );
        return;
      }
      throw error;
    }
  }

  /**
   * Save complete player state atomically (stats + inventory + equipment)
   *
   * Use this for critical save points where all data must be consistent:
   * - Player logout/disconnect
   * - Trading completion
   * - Death processing
   *
   * Wraps all operations in a single transaction with ROLLBACK on any failure.
   * Prevents partial saves that could lead to item loss or duplication.
   *
   * @param playerId - Player ID to save
   * @param data - Character stats to save (partial update)
   * @param inventory - Complete inventory state
   * @param equipment - Complete equipment state
   * @param options - Transaction options
   */
  async savePlayerCompleteAsync(
    playerId: string,
    data: Partial<PlayerRow>,
    inventory?: InventorySaveItem[],
    equipment?: EquipmentSaveItem[],
    options?: { isolationLevel?: IsolationLevel },
  ): Promise<void> {
    if (!this.db) {
      throw new Error("[DatabaseSystem] Database not initialized");
    }

    return this.db.transaction(
      async (tx) => {
        // Save character stats
        if (Object.keys(data).length > 0) {
          const updateData: Partial<
            Omit<typeof schema.characters.$inferInsert, "id" | "accountId">
          > = {};

          // Map all PlayerRow fields (same logic as PlayerRepository.savePlayerAsync)
          if (data.name && data.name.trim().length > 0)
            updateData.name = data.name;
          if (data.combatLevel !== undefined)
            updateData.combatLevel = data.combatLevel;
          if (data.attackLevel !== undefined)
            updateData.attackLevel = data.attackLevel;
          if (data.strengthLevel !== undefined)
            updateData.strengthLevel = data.strengthLevel;
          if (data.defenseLevel !== undefined)
            updateData.defenseLevel = data.defenseLevel;
          if (data.constitutionLevel !== undefined)
            updateData.constitutionLevel = data.constitutionLevel;
          if (data.rangedLevel !== undefined)
            updateData.rangedLevel = data.rangedLevel;
          if (data.magicLevel !== undefined)
            updateData.magicLevel = data.magicLevel;
          if (data.woodcuttingLevel !== undefined)
            updateData.woodcuttingLevel = data.woodcuttingLevel;
          if (data.miningLevel !== undefined)
            updateData.miningLevel = data.miningLevel;
          if (data.fishingLevel !== undefined)
            updateData.fishingLevel = data.fishingLevel;
          if (data.firemakingLevel !== undefined)
            updateData.firemakingLevel = data.firemakingLevel;
          if (data.cookingLevel !== undefined)
            updateData.cookingLevel = data.cookingLevel;
          if (data.smithingLevel !== undefined)
            updateData.smithingLevel = data.smithingLevel;
          if (data.agilityLevel !== undefined)
            updateData.agilityLevel = data.agilityLevel;
          if (data.craftingLevel !== undefined)
            updateData.craftingLevel = data.craftingLevel;
          if (data.fletchingLevel !== undefined)
            updateData.fletchingLevel = data.fletchingLevel;
          if (data.runecraftingLevel !== undefined)
            updateData.runecraftingLevel = data.runecraftingLevel;
          // XP fields
          if (data.attackXp !== undefined) updateData.attackXp = data.attackXp;
          if (data.strengthXp !== undefined)
            updateData.strengthXp = data.strengthXp;
          if (data.defenseXp !== undefined)
            updateData.defenseXp = data.defenseXp;
          if (data.constitutionXp !== undefined)
            updateData.constitutionXp = data.constitutionXp;
          if (data.rangedXp !== undefined) updateData.rangedXp = data.rangedXp;
          if (data.magicXp !== undefined) updateData.magicXp = data.magicXp;
          if (data.woodcuttingXp !== undefined)
            updateData.woodcuttingXp = data.woodcuttingXp;
          if (data.miningXp !== undefined) updateData.miningXp = data.miningXp;
          if (data.fishingXp !== undefined)
            updateData.fishingXp = data.fishingXp;
          if (data.firemakingXp !== undefined)
            updateData.firemakingXp = data.firemakingXp;
          if (data.cookingXp !== undefined)
            updateData.cookingXp = data.cookingXp;
          if (data.smithingXp !== undefined)
            updateData.smithingXp = data.smithingXp;
          if (data.agilityXp !== undefined)
            updateData.agilityXp = data.agilityXp;
          if (data.craftingXp !== undefined)
            updateData.craftingXp = data.craftingXp;
          if (data.fletchingXp !== undefined)
            updateData.fletchingXp = data.fletchingXp;
          if (data.runecraftingXp !== undefined)
            updateData.runecraftingXp = data.runecraftingXp;
          // Core fields
          if (data.health !== undefined) updateData.health = data.health;
          if (data.maxHealth !== undefined)
            updateData.maxHealth = data.maxHealth;
          if (data.coins !== undefined) updateData.coins = data.coins;
          if (data.positionX !== undefined)
            updateData.positionX = data.positionX;
          if (data.positionY !== undefined)
            updateData.positionY = data.positionY;
          if (data.positionZ !== undefined)
            updateData.positionZ = data.positionZ;
          // Combat preferences
          if (data.autoRetaliate !== undefined)
            updateData.autoRetaliate = data.autoRetaliate;
          if (data.attackStyle !== undefined)
            updateData.attackStyle = data.attackStyle;
          if (data.selectedSpell !== undefined)
            updateData.selectedSpell = data.selectedSpell;
          // Prayer
          if (data.prayerLevel !== undefined)
            updateData.prayerLevel = data.prayerLevel;
          if (data.prayerXp !== undefined) updateData.prayerXp = data.prayerXp;
          if (data.prayerPoints !== undefined)
            updateData.prayerPoints = data.prayerPoints;
          if (data.prayerMaxPoints !== undefined)
            updateData.prayerMaxPoints = data.prayerMaxPoints;
          if (data.activePrayers !== undefined)
            updateData.activePrayers = data.activePrayers;

          if (Object.keys(updateData).length > 0) {
            await tx
              .update(schema.characters)
              .set(updateData)
              .where(eq(schema.characters.id, playerId));
          }
        }

        // Save inventory if provided
        if (inventory) {
          const validItems = inventory.filter(
            (item) => (item.slotIndex ?? -1) >= 0,
          );
          const occupiedSlots = validItems.map((item) => item.slotIndex!);

          // Delete items not in occupied slots
          if (occupiedSlots.length > 0) {
            await tx.execute(
              sql`DELETE FROM inventory
                  WHERE "playerId" = ${playerId}
                  AND "slotIndex" >= 0
                  AND "slotIndex" NOT IN (${sql.join(
                    occupiedSlots.map((s) => sql`${s}`),
                    sql`, `,
                  )})`,
            );
          } else {
            await tx
              .delete(schema.inventory)
              .where(eq(schema.inventory.playerId, playerId));
          }

          // Persist current items with per-slot replacement.
          // Some local/dev databases can miss the partial unique index used by
          // ON CONFLICT, which would raise 42P10 and abort startup.
          for (const item of validItems) {
            const slotIndex = item.slotIndex!;
            const metadata = item.metadata
              ? JSON.stringify(item.metadata)
              : null;

            await tx.execute(
              sql`DELETE FROM inventory
                  WHERE "playerId" = ${playerId}
                  AND "slotIndex" = ${slotIndex}`,
            );
            await tx.execute(
              sql`INSERT INTO inventory ("playerId", "itemId", "quantity", "slotIndex", "metadata")
                  VALUES (${playerId}, ${item.itemId}, ${item.quantity}, ${slotIndex}, ${metadata})`,
            );
          }
        }

        // Save equipment if provided
        if (equipment) {
          const validEquipment = equipment.filter(
            (item) => item.slotType !== undefined,
          );
          const occupiedSlots = validEquipment.map((item) => item.slotType);

          // Delete equipment not in occupied slots
          if (occupiedSlots.length > 0) {
            await tx.execute(
              sql`DELETE FROM equipment
                  WHERE "playerId" = ${playerId}
                  AND "slot" NOT IN (${sql.join(
                    occupiedSlots.map((s) => sql`${s}`),
                    sql`, `,
                  )})`,
            );
          } else {
            await tx
              .delete(schema.equipment)
              .where(eq(schema.equipment.playerId, playerId));
          }

          // Upsert current equipment
          for (const item of validEquipment) {
            const slot = item.slotType;
            await tx.execute(
              sql`INSERT INTO equipment ("playerId", "slot", "itemId")
                  VALUES (${playerId}, ${slot}, ${item.itemId})
                  ON CONFLICT ("playerId", "slot")
                  DO UPDATE SET "itemId" = EXCLUDED."itemId"`,
            );
          }
        }
      },
      { isolationLevel: options?.isolationLevel ?? "read committed" },
    );
  }

  // ============================================================================
  // INVENTORY MANAGEMENT
  // ============================================================================

  /**
   * Load player inventory from database
   * Delegates to InventoryRepository
   */
  async getPlayerInventoryAsync(playerId: string): Promise<InventoryRow[]> {
    return this.inventoryRepository.getPlayerInventoryAsync(playerId);
  }

  /**
   * Save player inventory to database with write coalescing.
   * If a write is already active for this player, the latest items snapshot
   * is queued and all waiting callers resolve when that batch completes.
   * This collapses N concurrent calls into at most 2 DB transactions.
   */
  async savePlayerInventoryAsync(
    playerId: string,
    items: InventorySaveItem[],
  ): Promise<void> {
    // If a write is already running for this player, coalesce into the queued batch
    if (this.inventoryWriteActive.has(playerId)) {
      return new Promise<void>((resolve, reject) => {
        const queued = this.inventoryWriteQueued.get(playerId);
        if (queued) {
          // Replace items with the latest snapshot — only the newest matters
          queued.items = items;
          queued.waiters.push({ resolve, reject });
        } else {
          this.inventoryWriteQueued.set(playerId, {
            items,
            waiters: [{ resolve, reject }],
          });
        }
      });
    }

    // No active write — execute immediately
    await this.executeInventoryWrite(playerId, items);
  }

  /**
   * Execute a single inventory write and drain any queued batch afterward.
   */
  private async executeInventoryWrite(
    playerId: string,
    items: InventorySaveItem[],
  ): Promise<void> {
    const writePromise = this.inventoryRepository.savePlayerInventoryAsync(
      playerId,
      items,
    );
    this.inventoryWriteActive.set(playerId, writePromise);

    try {
      await writePromise;
    } catch (error) {
      if (DB_WRITE_ERRORS_NON_FATAL && isTransientDbConnectivityError(error)) {
        console.warn(
          `[DatabaseSystem] savePlayerInventoryAsync(${playerId}) failed due to database connectivity; continuing in best-effort mode`,
          error,
        );
      } else {
        throw error;
      }
    } finally {
      this.inventoryWriteActive.delete(playerId);

      // Drain the queued batch if any calls arrived while we were writing
      const queued = this.inventoryWriteQueued.get(playerId);
      if (queued) {
        this.inventoryWriteQueued.delete(playerId);
        try {
          await this.executeInventoryWrite(playerId, queued.items);
          for (const w of queued.waiters) w.resolve();
        } catch (err) {
          for (const w of queued.waiters) w.reject(err);
        }
      }
    }
  }

  // ============================================================================
  // EQUIPMENT MANAGEMENT
  // ============================================================================

  /**
   * Load player equipment from database
   * Delegates to EquipmentRepository
   */
  async getPlayerEquipmentAsync(playerId: string): Promise<EquipmentRow[]> {
    return this.equipmentRepository.getPlayerEquipmentAsync(playerId);
  }

  /**
   * Save player equipment to database
   * Delegates to EquipmentRepository
   */
  async savePlayerEquipmentAsync(
    playerId: string,
    items: EquipmentSaveItem[],
  ): Promise<void> {
    try {
      return await this.equipmentRepository.savePlayerEquipmentAsync(
        playerId,
        items,
      );
    } catch (error) {
      if (DB_WRITE_ERRORS_NON_FATAL && isTransientDbConnectivityError(error)) {
        console.warn(
          `[DatabaseSystem] savePlayerEquipmentAsync(${playerId}) failed due to database connectivity; continuing in best-effort mode`,
          error,
        );
        return;
      }
      throw error;
    }
  }

  // ============================================================================
  // SESSION TRACKING
  // ============================================================================

  /**
   * Create a new player session
   * Delegates to SessionRepository
   */
  async createPlayerSessionAsync(
    sessionData: Omit<PlayerSessionRow, "id" | "sessionId">,
    sessionId?: string,
  ): Promise<string> {
    try {
      return await this.sessionRepository.createPlayerSessionAsync(
        sessionData,
        sessionId,
      );
    } catch (error) {
      if (DB_WRITE_ERRORS_NON_FATAL && isTransientDbConnectivityError(error)) {
        console.warn(
          `[DatabaseSystem] createPlayerSessionAsync(${sessionData.playerId}) failed due to database connectivity; continuing in best-effort mode`,
          error,
        );
        return (
          sessionId ||
          `session_${Date.now()}_${Math.random().toString(36).slice(2, 11)}`
        );
      }
      throw error;
    }
  }

  /**
   * Update an existing player session
   * Delegates to SessionRepository
   */
  async updatePlayerSessionAsync(
    sessionId: string,
    updates: Partial<PlayerSessionRow>,
  ): Promise<void> {
    try {
      return await this.sessionRepository.updatePlayerSessionAsync(
        sessionId,
        updates,
      );
    } catch (error) {
      if (DB_WRITE_ERRORS_NON_FATAL && isTransientDbConnectivityError(error)) {
        console.warn(
          `[DatabaseSystem] updatePlayerSessionAsync(${sessionId}) failed due to database connectivity; continuing in best-effort mode`,
          error,
        );
        return;
      }
      throw error;
    }
  }

  /**
   * Batch update lastActivity for multiple sessions in a single query
   *
   * Delegates to SessionRepository.batchUpdateLastActivityAsync
   * Uses a single SQL query instead of N separate queries.
   */
  async batchUpdateSessionLastActivityAsync(
    sessionIds: string[],
    timestamp: number,
  ): Promise<void> {
    try {
      return await this.sessionRepository.batchUpdateLastActivityAsync(
        sessionIds,
        timestamp,
      );
    } catch (error) {
      if (DB_WRITE_ERRORS_NON_FATAL && isTransientDbConnectivityError(error)) {
        console.warn(
          `[DatabaseSystem] batchUpdateSessionLastActivityAsync(${sessionIds.length}) failed due to database connectivity; continuing in best-effort mode`,
          error,
        );
        return;
      }
      throw error;
    }
  }

  /**
   * Get all active player sessions
   * Delegates to SessionRepository
   */
  async getActivePlayerSessionsAsync(): Promise<PlayerSessionRow[]> {
    try {
      return await this.sessionRepository.getActivePlayerSessionsAsync();
    } catch (error) {
      if (DB_WRITE_ERRORS_NON_FATAL && isTransientDbConnectivityError(error)) {
        console.warn(
          "[DatabaseSystem] getActivePlayerSessionsAsync failed due to database connectivity; continuing in best-effort mode",
          error,
        );
        return [];
      }
      throw error;
    }
  }

  /**
   * End a player session
   * Delegates to SessionRepository
   */
  async endPlayerSessionAsync(
    sessionId: string,
    reason?: string,
  ): Promise<void> {
    try {
      return await this.sessionRepository.endPlayerSessionAsync(
        sessionId,
        reason,
      );
    } catch (error) {
      if (DB_WRITE_ERRORS_NON_FATAL && isTransientDbConnectivityError(error)) {
        console.warn(
          `[DatabaseSystem] endPlayerSessionAsync(${sessionId}) failed due to database connectivity; continuing in best-effort mode`,
          error,
        );
        return;
      }
      throw error;
    }
  }

  // ============================================================================
  // WORLD CHUNK PERSISTENCE
  // ============================================================================

  /**
   * Load world chunk data from database
   * Delegates to WorldChunkRepository
   */
  async getWorldChunkAsync(
    chunkX: number,
    chunkZ: number,
  ): Promise<WorldChunkRow | null> {
    if (DISABLE_WORLD_CHUNK_PERSISTENCE) return null;
    return this.worldChunkRepository.getWorldChunkAsync(chunkX, chunkZ);
  }

  /**
   * Save world chunk data to database
   * Delegates to WorldChunkRepository
   */
  async saveWorldChunkAsync(chunkData: {
    chunkX: number;
    chunkZ: number;
    data: string;
  }): Promise<void> {
    if (DISABLE_WORLD_CHUNK_PERSISTENCE) return;
    return this.worldChunkRepository.saveWorldChunkAsync(chunkData);
  }

  /**
   * Get world items for a chunk
   * Delegates to WorldChunkRepository
   */
  async getWorldItemsAsync(
    _chunkX: number,
    _chunkZ: number,
  ): Promise<ItemRow[]> {
    if (DISABLE_WORLD_CHUNK_PERSISTENCE) return [];
    return this.worldChunkRepository.getWorldItemsAsync(_chunkX, _chunkZ);
  }

  /**
   * Save world items for a chunk
   * Delegates to WorldChunkRepository
   */
  async saveWorldItemsAsync(
    _chunkX: number,
    _chunkZ: number,
    _items: ItemRow[],
  ): Promise<void> {
    if (DISABLE_WORLD_CHUNK_PERSISTENCE) return;
    return this.worldChunkRepository.saveWorldItemsAsync(
      _chunkX,
      _chunkZ,
      _items,
    );
  }

  /**
   * Get inactive chunks
   * Delegates to WorldChunkRepository
   */
  async getInactiveChunksAsync(minutes: number): Promise<WorldChunkRow[]> {
    if (DISABLE_WORLD_CHUNK_PERSISTENCE) return [];
    return this.worldChunkRepository.getInactiveChunksAsync(minutes);
  }

  /**
   * Update chunk player count
   * Delegates to WorldChunkRepository
   */
  async updateChunkPlayerCountAsync(
    chunkX: number,
    chunkZ: number,
    playerCount: number,
  ): Promise<void> {
    if (DISABLE_WORLD_CHUNK_PERSISTENCE) return;
    return this.worldChunkRepository.updateChunkPlayerCountAsync(
      chunkX,
      chunkZ,
      playerCount,
    );
  }

  /**
   * Mark chunk for reset
   * Delegates to WorldChunkRepository
   */
  async markChunkForResetAsync(chunkX: number, chunkZ: number): Promise<void> {
    if (DISABLE_WORLD_CHUNK_PERSISTENCE) return;
    return this.worldChunkRepository.markChunkForResetAsync(chunkX, chunkZ);
  }

  /**
   * Reset chunk
   * Delegates to WorldChunkRepository
   */
  async resetChunkAsync(chunkX: number, chunkZ: number): Promise<void> {
    if (DISABLE_WORLD_CHUNK_PERSISTENCE) return;
    return this.worldChunkRepository.resetChunkAsync(chunkX, chunkZ);
  }

  // ============================================================================
  // NPC KILL TRACKING
  // ============================================================================

  /**
   * Increment NPC kill count for a player
   * Delegates to NPCKillRepository
   */
  async incrementNPCKillAsync(playerId: string, npcId: string): Promise<void> {
    return this.npcKillRepository.incrementNPCKillAsync(playerId, npcId);
  }

  /**
   * Get all NPC kill statistics for a player
   * Delegates to NPCKillRepository
   */
  async getPlayerNPCKillsAsync(
    playerId: string,
  ): Promise<Array<{ npcId: string; killCount: number }>> {
    return this.npcKillRepository.getPlayerNPCKillsAsync(playerId);
  }

  /**
   * Get kill count for a specific NPC type
   * Delegates to NPCKillRepository
   */
  async getNPCKillCountAsync(playerId: string, npcId: string): Promise<number> {
    return this.npcKillRepository.getNPCKillCountAsync(playerId, npcId);
  }

  // ============================================================================
  // QUEST MANAGEMENT
  // ============================================================================

  /**
   * Get the quest repository for quest persistence operations
   *
   * Used by QuestSystem to persist quest progress, completion status,
   * and quest points to the database.
   *
   * @returns The QuestRepository instance
   */
  getQuestRepository(): QuestRepository {
    return this.questRepository;
  }

  // ============================================================================
  // ACTIVITY LOG MANAGEMENT (Admin Panel)
  // ============================================================================

  /**
   * Insert a single activity log entry
   * Delegates to ActivityLogRepository
   */
  async insertActivityAsync(entry: ActivityLogEntry): Promise<number> {
    return this.activityLogRepository.insertActivityAsync(entry);
  }

  /**
   * Insert multiple activity log entries in a batch
   * Delegates to ActivityLogRepository
   */
  async insertActivitiesBatchAsync(
    entries: ActivityLogEntry[],
  ): Promise<number> {
    return this.activityLogRepository.insertActivitiesBatchAsync(entries);
  }

  /**
   * Query activity logs with filtering
   * Delegates to ActivityLogRepository
   */
  async queryActivitiesAsync(
    options: ActivityLogQueryOptions,
  ): Promise<ActivityLogRow[]> {
    return this.activityLogRepository.queryActivitiesAsync(options);
  }

  /**
   * Get count of activity logs matching criteria
   * Delegates to ActivityLogRepository
   */
  async countActivitiesAsync(
    options: ActivityLogQueryOptions,
  ): Promise<number> {
    return this.activityLogRepository.countActivitiesAsync(options);
  }

  /**
   * Get distinct event types in the activity log
   * Delegates to ActivityLogRepository
   */
  async getActivityEventTypesAsync(): Promise<string[]> {
    return this.activityLogRepository.getEventTypesAsync();
  }

  /**
   * Insert a trade record
   * Delegates to ActivityLogRepository
   */
  async insertTradeAsync(entry: TradeEntry): Promise<number> {
    return this.activityLogRepository.insertTradeAsync(entry);
  }

  /**
   * Query trade history with filtering
   * Delegates to ActivityLogRepository
   */
  async queryTradesAsync(options: TradeQueryOptions): Promise<TradeRow[]> {
    return this.activityLogRepository.queryTradesAsync(options);
  }

  /**
   * Get count of trades matching criteria
   * Delegates to ActivityLogRepository
   */
  async countTradesAsync(options: TradeQueryOptions): Promise<number> {
    return this.activityLogRepository.countTradesAsync(options);
  }

  /**
   * Cleanup old activity logs (retention policy)
   * Delegates to ActivityLogRepository
   */
  async cleanupOldActivitiesAsync(daysOld: number = 90): Promise<number> {
    return this.activityLogRepository.cleanupOldActivitiesAsync(daysOld);
  }

  /**
   * Cleanup old trade records (retention policy)
   * Delegates to ActivityLogRepository
   */
  async cleanupOldTradesAsync(daysOld: number = 90): Promise<number> {
    return this.activityLogRepository.cleanupOldTradesAsync(daysOld);
  }

  /**
   * Get activity summary for a player
   * Delegates to ActivityLogRepository
   */
  async getPlayerActivitySummaryAsync(
    playerId: string,
  ): Promise<Record<string, number>> {
    return this.activityLogRepository.getPlayerActivitySummaryAsync(playerId);
  }

  /**
   * Get the ActivityLogRepository for direct access
   * Used by ActivityLoggerSystem for batch operations
   */
  getActivityLogRepository(): ActivityLogRepository {
    return this.activityLogRepository;
  }

  /**
   * Get the BankRepository for direct access
   * Used by admin routes for bank queries
   */
  getBankRepository(): BankRepository {
    return this.bankRepository;
  }

  // ============================================================================
  // DEATH LOCK MANAGEMENT
  // ============================================================================

  /**
   * Save or update a death lock for a player
   * Delegates to DeathRepository
   *
   * CRITICAL FOR SECURITY: Prevents item duplication on server restart!
   *
   * Now includes items array for crash recovery.
   *
   * @param data - Death lock data including items for recovery
   * @param tx - Optional transaction context for atomic operations
   */
  async saveDeathLockAsync(
    data: DeathLockData,
    tx?: NodePgDatabase<typeof schema>,
  ): Promise<void> {
    if (!this.deathRepository) {
      console.error("[DatabaseSystem] deathRepository not initialized");
      return;
    }
    return this.deathRepository.saveDeathLockAsync(data, tx);
  }

  /**
   * Get active death lock for a player
   * Delegates to DeathRepository
   *
   * Returns null if no active death lock exists (player is alive).
   * Now includes items, killedBy, recovered fields.
   */
  async getDeathLockAsync(playerId: string): Promise<DeathLockData | null> {
    if (!this.deathRepository) {
      console.error("[DatabaseSystem] deathRepository not initialized");
      return null;
    }
    return this.deathRepository.getDeathLockAsync(playerId);
  }

  /**
   * Delete a death lock for a player
   * Delegates to DeathRepository
   *
   * Called when player respawns or death is fully resolved.
   */
  async deleteDeathLockAsync(playerId: string): Promise<void> {
    if (!this.deathRepository) {
      console.error("[DatabaseSystem] deathRepository not initialized");
      return;
    }
    return this.deathRepository.deleteDeathLockAsync(playerId);
  }

  /**
   * Get all active death locks
   * Delegates to DeathRepository
   *
   * Used for server restart recovery to restore gravestones/ground items.
   * Now includes items, killedBy, recovered fields.
   */
  async getAllActiveDeathsAsync(): Promise<DeathLockData[]> {
    if (!this.deathRepository) {
      console.error("[DatabaseSystem] deathRepository not initialized");
      return [];
    }
    return this.deathRepository.getAllActiveDeathsAsync();
  }

  /**
   * Update ground item IDs when gravestone expires
   * Delegates to DeathRepository
   *
   * Called when gravestone transitions to ground items.
   */
  async updateGroundItemsAsync(
    playerId: string,
    groundItemIds: string[],
  ): Promise<void> {
    if (!this.deathRepository) {
      console.error("[DatabaseSystem] deathRepository not initialized");
      return;
    }
    return this.deathRepository.updateGroundItemsAsync(playerId, groundItemIds);
  }

  /**
   * Get all unrecovered deaths for crash recovery
   * Delegates to DeathRepository
   *
   * Called during server startup to find deaths that need their
   * gravestones/ground items recreated.
   *
   * @returns Array of death locks that need recovery
   */
  async getUnrecoveredDeathsAsync(): Promise<DeathLockData[]> {
    if (!this.deathRepository) {
      console.error(
        "[DatabaseSystem] deathRepository not initialized - ensure DatabaseSystem.init() was called",
      );
      return [];
    }
    return this.deathRepository.getUnrecoveredDeathsAsync();
  }

  /**
   * Mark a death as recovered after crash recovery processing
   * Delegates to DeathRepository
   *
   * Called after successfully recreating gravestones/ground items.
   *
   * @param playerId - The player ID whose death was recovered
   */
  async markDeathRecoveredAsync(playerId: string): Promise<void> {
    if (!this.deathRepository) {
      console.error("[DatabaseSystem] deathRepository not initialized");
      return;
    }
    return this.deathRepository.markDeathRecoveredAsync(playerId);
  }

  /**
   * Atomically acquire a death lock (check-and-create)
   * Delegates to DeathRepository
   *
   * Prevents race conditions where a player could die multiple times.
   * Uses INSERT ... ON CONFLICT DO NOTHING for atomic semantics.
   *
   * @param data - Death lock data to create
   * @param tx - Optional transaction context
   * @returns true if death lock was created, false if player already has one
   */
  async acquireDeathLockAsync(
    data: DeathLockData,
    tx?: NodePgDatabase<typeof schema>,
  ): Promise<boolean> {
    if (!this.deathRepository) {
      console.error("[DatabaseSystem] deathRepository not initialized");
      return false;
    }
    return this.deathRepository.acquireDeathLockAsync(data, tx);
  }

  // ============================================================================
  // SYNCHRONOUS WRAPPER METHODS (LEGACY)
  // ============================================================================
  // These methods provide synchronous interfaces for backward compatibility.
  // They fire-and-forget async operations and track them for graceful shutdown.
  //
  // WARNING: These will eventually be removed. Use async methods instead.
  // The sync methods log warnings and don't return results from the database.

  /**
   * @deprecated Use getCharactersAsync instead
   * @returns Empty array (use async method to get real data)
   */
  getCharacters(_accountId: string): Array<{ id: string; name: string }> {
    console.warn(
      "[DatabaseSystem] getCharacters called synchronously - use getCharactersAsync instead",
    );
    return [];
  }

  /**
   * @deprecated Use getPlayerAsync instead
   * @returns null (use async method to get real data)
   */
  getPlayer(_playerId: string): PlayerRow | null {
    console.warn(
      "[DatabaseSystem] getPlayer called synchronously - use getPlayerAsync instead",
    );
    return null;
  }

  /**
   * Save player data (debounced fire-and-forget)
   *
   * Buffers field updates per player and flushes after a short delay.
   * Rapid calls (e.g., multiple XP drops in the same tick) merge into
   * a single DB write per player instead of N separate UPDATEs.
   */
  savePlayer(playerId: string, data: Partial<PlayerRow>): void {
    const existing = this.pendingSaveBuffer.get(playerId);
    if (existing) {
      Object.assign(existing, data);
    } else {
      this.pendingSaveBuffer.set(playerId, { ...data });
    }

    if (!this.saveFlushScheduled) {
      this.saveFlushScheduled = true;
      // Use setTimeout(0) to batch all sync calls within the current tick
      setTimeout(() => this.flushSaveBuffer(), 0);
    }
  }

  /**
   * Flush the debounce buffer — one batched DB transaction for all players.
   */
  private flushSaveBuffer(): void {
    this.saveFlushScheduled = false;
    const buffer = this.pendingSaveBuffer;
    this.pendingSaveBuffer = new Map();

    if (buffer.size === 0) return;

    // Single transaction for all player saves (1 connection instead of N)
    this.trackAsyncOperation(
      this.playerRepository.batchSavePlayersAsync(buffer),
    );
  }

  /**
   * Batch save multiple players in a single transaction
   * Delegates to PlayerRepository.batchSavePlayersAsync
   */
  async batchSavePlayersAsync(
    players: Map<string, Partial<PlayerRow>>,
  ): Promise<void> {
    return this.playerRepository.batchSavePlayersAsync(players);
  }

  /**
   * @deprecated Use getPlayerInventoryAsync instead
   * @returns Empty array (use async method to get real data)
   */
  getPlayerInventory(_playerId: string): InventoryRow[] {
    console.warn(
      "[DatabaseSystem] getPlayerInventory called synchronously - use getPlayerInventoryAsync instead",
    );
    return [];
  }

  /**
   * Save player inventory (debounced fire-and-forget)
   *
   * Keeps only the latest inventory snapshot per player. Rapid saves
   * (mine ore → smelt → smith) merge into one DB write, preventing
   * concurrent UPSERTs that deadlock on the same rows.
   */
  savePlayerInventory(playerId: string, items: InventorySaveItem[]): void {
    this.pendingInventoryBuffer.set(playerId, items);

    if (!this.inventoryFlushScheduled) {
      this.inventoryFlushScheduled = true;
      setTimeout(() => this.flushInventoryBuffer(), 0);
    }
  }

  /**
   * Flush the inventory debounce buffer — one DB write per player.
   */
  private flushInventoryBuffer(): void {
    this.inventoryFlushScheduled = false;
    const buffer = this.pendingInventoryBuffer;
    this.pendingInventoryBuffer = new Map();

    for (const [playerId, items] of buffer) {
      this.trackAsyncOperation(this.savePlayerInventoryAsync(playerId, items));
    }
  }

  /**
   * Create player session (fire-and-forget)
   * Returns a session ID synchronously, tracks the operation for graceful shutdown
   */
  createPlayerSession(
    sessionData: Omit<PlayerSessionRow, "id" | "sessionId">,
  ): string {
    const sessionId = `session_${Date.now()}_${Math.random().toString(36).slice(2, 11)}`;
    this.trackAsyncOperation(
      this.createPlayerSessionAsync(sessionData, sessionId),
    );
    return sessionId;
  }

  /**
   * Update player session (fire-and-forget)
   * Tracks the operation for graceful shutdown
   */
  updatePlayerSession(
    sessionId: string,
    updates: Partial<PlayerSessionRow>,
  ): void {
    this.trackAsyncOperation(this.updatePlayerSessionAsync(sessionId, updates));
  }

  /**
   * @deprecated Use getActivePlayerSessionsAsync instead
   * @returns Empty array (use async method to get real data)
   */
  getActivePlayerSessions(): PlayerSessionRow[] {
    console.warn(
      "[DatabaseSystem] getActivePlayerSessions called synchronously - use getActivePlayerSessionsAsync instead",
    );
    return [];
  }

  /**
   * End player session (fire-and-forget)
   * Tracks the operation for graceful shutdown
   */
  endPlayerSession(sessionId: string, reason?: string): void {
    this.trackAsyncOperation(this.endPlayerSessionAsync(sessionId, reason));
  }

  /**
   * Save world chunk (fire-and-forget)
   * Tracks the operation for graceful shutdown
   */
  saveWorldChunk(chunkData: {
    chunkX: number;
    chunkZ: number;
    data: string;
  }): void {
    if (IS_PLAYWRIGHT_TEST) return;
    this.trackAsyncOperation(this.saveWorldChunkAsync(chunkData));
  }

  /**
   * @deprecated Use getWorldItemsAsync instead
   * @returns Empty array (use async method to get real data)
   */
  getWorldItems(_chunkX: number, _chunkZ: number): ItemRow[] {
    console.warn(
      "[DatabaseSystem] getWorldItems called synchronously - use getWorldItemsAsync instead",
    );
    return [];
  }

  /**
   * Save world items (fire-and-forget)
   * Tracks the operation for graceful shutdown
   */
  saveWorldItems(chunkX: number, chunkZ: number, items: ItemRow[]): void {
    if (IS_PLAYWRIGHT_TEST) return;
    this.trackAsyncOperation(this.saveWorldItemsAsync(chunkX, chunkZ, items));
  }

  /**
   * @deprecated Use getInactiveChunksAsync instead
   * @returns Empty array (use async method to get real data)
   */
  getInactiveChunks(_minutes: number): WorldChunkRow[] {
    return [];
  }

  /**
   * Update chunk player count (fire-and-forget)
   * Tracks the operation for graceful shutdown
   */
  updateChunkPlayerCount(
    chunkX: number,
    chunkZ: number,
    playerCount: number,
  ): void {
    if (IS_PLAYWRIGHT_TEST) return;
    this.trackAsyncOperation(
      this.updateChunkPlayerCountAsync(chunkX, chunkZ, playerCount),
    );
  }

  /**
   * Mark chunk for reset (fire-and-forget)
   * Tracks the operation for graceful shutdown
   */
  markChunkForReset(chunkX: number, chunkZ: number): void {
    if (IS_PLAYWRIGHT_TEST) return;
    this.trackAsyncOperation(this.markChunkForResetAsync(chunkX, chunkZ));
  }

  /**
   * Reset chunk (fire-and-forget)
   * Tracks the operation for graceful shutdown
   */
  resetChunk(chunkX: number, chunkZ: number): void {
    if (IS_PLAYWRIGHT_TEST) return;
    this.trackAsyncOperation(this.resetChunkAsync(chunkX, chunkZ));
  }

  /**
   * @deprecated Use getWorldChunkAsync instead
   * @returns null (use async method to get real data)
   */
  getWorldChunk(_x: number, _z: number): WorldChunkRow | null {
    console.warn(
      "[DatabaseSystem] getWorldChunk called synchronously - use getWorldChunkAsync instead",
    );
    return null;
  }

  /**
   * Increment NPC kill (fire-and-forget)
   * Tracks the operation for graceful shutdown
   */
  incrementNPCKill(playerId: string, npcId: string): void {
    this.trackAsyncOperation(this.incrementNPCKillAsync(playerId, npcId));
  }

  // ============================================================================
  // MAINTENANCE METHODS
  // ============================================================================

  /**
   * Clean up old sessions asynchronously
   *
   * Deletes sessions older than the specified number of days.
   * Used for maintenance to keep the database clean.
   *
   * @param daysOld - Delete sessions older than this many days
   * @returns Number of sessions deleted
   */
  async cleanupOldSessionsAsync(daysOld: number): Promise<number> {
    return this.sessionRepository.cleanupOldSessionsAsync(daysOld);
  }

  /**
   * Clean up old sessions (synchronous wrapper)
   *
   * @param daysOld - Delete sessions older than this many days
   * @returns 0 (actual count available via async method)
   */
  cleanupOldSessions(daysOld: number): number {
    this.trackAsyncOperation(this.cleanupOldSessionsAsync(daysOld));
    return 0; // Sync version can't return actual count
  }

  /**
   * Clean up old chunk activity records asynchronously
   *
   * Deletes chunk activity records older than the specified number of days.
   * Used for maintenance to keep the database clean.
   *
   * @param daysOld - Delete records older than this many days
   * @returns Number of records deleted
   */
  async cleanupOldChunkActivityAsync(daysOld: number): Promise<number> {
    return this.worldChunkRepository.cleanupOldChunkActivityAsync(daysOld);
  }

  /**
   * Clean up old chunk activity records (synchronous wrapper)
   *
   * @param daysOld - Delete records older than this many days
   * @returns 0 (actual count available via async method)
   */
  cleanupOldChunkActivity(daysOld: number): number {
    this.trackAsyncOperation(this.cleanupOldChunkActivityAsync(daysOld));
    return 0; // Sync version can't return actual count
  }

  /**
   * Get database statistics asynchronously
   *
   * Returns counts of various database entities for monitoring.
   *
   * @returns Database statistics
   */
  async getDatabaseStatsAsync(): Promise<{
    playerCount: number;
    activeSessionCount: number;
    chunkCount: number;
    activeChunkCount: number;
    totalActivityRecords: number;
  }> {
    try {
      const [
        playerCount,
        activeSessionCount,
        chunkCount,
        activeChunkCount,
        totalActivityRecords,
      ] = await Promise.all([
        this.playerRepository.getPlayerCountAsync(),
        this.sessionRepository.getActiveSessionCountAsync(),
        this.worldChunkRepository.getChunkCountAsync(),
        this.worldChunkRepository.getActiveChunkCountAsync(),
        this.worldChunkRepository.getTotalActivityRecordsAsync(),
      ]);

      return {
        playerCount,
        activeSessionCount,
        chunkCount,
        activeChunkCount,
        totalActivityRecords,
      };
    } catch (err) {
      this.logger.error(
        "Failed to fetch database stats",
        err instanceof Error ? err : new Error(String(err)),
      );
      throw err;
    }
  }

  /**
   * Get database statistics (synchronous wrapper)
   *
   * @returns Default statistics (use async method for real data)
   */
  getDatabaseStats(): {
    playerCount: number;
    activeSessionCount: number;
    chunkCount: number;
    activeChunkCount: number;
    totalActivityRecords: number;
  } {
    // Sync version can't return actual data, return defaults
    return {
      playerCount: 0,
      activeSessionCount: 0,
      chunkCount: 0,
      activeChunkCount: 0,
      totalActivityRecords: 0,
    };
  }

  /**
   * Check database connection health
   *
   * Performs a lightweight health check by executing a simple query.
   * Returns connection status information useful for monitoring.
   *
   * @returns Health check result with status and pool info
   */
  async checkHealthAsync(): Promise<{
    healthy: boolean;
    latencyMs: number;
    poolInfo?: {
      totalCount: number;
      idleCount: number;
      waitingCount: number;
    };
    error?: string;
  }> {
    if (!this.db || !this.pool) {
      return {
        healthy: false,
        latencyMs: 0,
        error: "Database not initialized",
      };
    }

    const startTime = performance.now();

    try {
      // Simple query to verify connection (SELECT 1)
      await this.pool.query("SELECT 1");

      const latencyMs = Math.round(performance.now() - startTime);

      return {
        healthy: true,
        latencyMs,
        poolInfo: {
          totalCount: this.pool.totalCount,
          idleCount: this.pool.idleCount,
          waitingCount: this.pool.waitingCount,
        },
      };
    } catch (error) {
      const latencyMs = Math.round(performance.now() - startTime);
      const errorMessage =
        error instanceof Error ? error.message : String(error);

      console.error("[DatabaseSystem] Health check failed:", errorMessage);

      return {
        healthy: false,
        latencyMs,
        error: errorMessage,
      };
    }
  }

  /**
   * Get the PostgreSQL connection pool
   *
   * Provides access to the underlying pool for monitoring or direct operations.
   *
   * @returns The pg.Pool instance or null if not initialized
   */
  getPool(): pg.Pool | null {
    return this.pool;
  }

  /**
   * Clean up database system resources
   *
   * Nullifies references to database instances but does NOT close the connection pool.
   * The pool is managed externally by the server and closed during graceful shutdown.
   * Called automatically when the world is destroyed.
   */
  destroy(): void {
    this.inventoryWriteActive.clear();
    // Reject any orphaned waiters so their promises don't hang forever
    for (const [, queued] of this.inventoryWriteQueued) {
      for (const w of queued.waiters) {
        w.reject(new Error("DatabaseSystem destroyed"));
      }
    }
    this.inventoryWriteQueued.clear();
    // Pool is managed externally in index.ts, don't close it here
    this.db = null;
    this.pool = null;
  }
}
