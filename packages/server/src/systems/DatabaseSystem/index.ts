/**
 * DatabaseSystem - Server-side database operations for persistent game state
 *
 * This system provides a comprehensive interface for all database operations in Hyperscape.
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

import { SystemBase } from "@hyperscape/shared";
import type { World } from "@hyperscape/shared";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";
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
} from "../../database/repositories";

/**
 * DatabaseSystem class
 *
 * Extends SystemBase to integrate with Hyperscape's ECS architecture.
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
  private trackAsyncOperation<T>(operation: Promise<T>): void {
    if (this.isDestroying) return; // Skip during shutdown

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
   * @param callback - Async function that receives transaction context
   * @returns The result of the callback
   *
   * @example
   * ```typescript
   * await dbSystem.executeInTransaction(async (tx) => {
   *   await tx.insert(table1).values({...});
   *   await tx.insert(table2).values({...});
   *   // If either fails, both are rolled back
   * });
   * ```
   */
  async executeInTransaction<T>(
    callback: (tx: NodePgDatabase<typeof schema>) => Promise<T>,
  ): Promise<T> {
    if (!this.db) {
      throw new Error(
        "[DatabaseSystem] Database not initialized - cannot start transaction",
      );
    }

    return this.db.transaction(callback);
  }

  // ============================================================================
  // CHARACTER MANAGEMENT
  // ============================================================================

  /**
   * Get all characters for an account
   * Delegates to CharacterRepository
   */
  async getCharactersAsync(
    accountId: string,
  ): Promise<Array<{ id: string; name: string }>> {
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
  ): Promise<boolean> {
    return this.characterRepository.createCharacter(accountId, id, name);
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
    return this.playerRepository.savePlayerAsync(playerId, data);
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
   * Save player inventory to database
   * Delegates to InventoryRepository
   */
  async savePlayerInventoryAsync(
    playerId: string,
    items: InventorySaveItem[],
  ): Promise<void> {
    return this.inventoryRepository.savePlayerInventoryAsync(playerId, items);
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
    return this.equipmentRepository.savePlayerEquipmentAsync(playerId, items);
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
    return this.sessionRepository.createPlayerSessionAsync(
      sessionData,
      sessionId,
    );
  }

  /**
   * Update an existing player session
   * Delegates to SessionRepository
   */
  async updatePlayerSessionAsync(
    sessionId: string,
    updates: Partial<PlayerSessionRow>,
  ): Promise<void> {
    return this.sessionRepository.updatePlayerSessionAsync(sessionId, updates);
  }

  /**
   * Get all active player sessions
   * Delegates to SessionRepository
   */
  async getActivePlayerSessionsAsync(): Promise<PlayerSessionRow[]> {
    return this.sessionRepository.getActivePlayerSessionsAsync();
  }

  /**
   * End a player session
   * Delegates to SessionRepository
   */
  async endPlayerSessionAsync(
    sessionId: string,
    reason?: string,
  ): Promise<void> {
    return this.sessionRepository.endPlayerSessionAsync(sessionId, reason);
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
    return this.worldChunkRepository.markChunkForResetAsync(chunkX, chunkZ);
  }

  /**
   * Reset chunk
   * Delegates to WorldChunkRepository
   */
  async resetChunkAsync(chunkX: number, chunkZ: number): Promise<void> {
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
  // DEATH LOCK MANAGEMENT
  // ============================================================================

  /**
   * Save or update a death lock for a player
   * Delegates to DeathRepository
   *
   * CRITICAL FOR SECURITY: Prevents item duplication on server restart!
   *
   * @param data - Death lock data
   * @param tx - Optional transaction context for atomic operations
   */
  async saveDeathLockAsync(
    data: {
      playerId: string;
      gravestoneId: string | null;
      groundItemIds: string[];
      position: { x: number; y: number; z: number };
      timestamp: number;
      zoneType: string;
      itemCount: number;
    },
    tx?: NodePgDatabase<typeof schema>,
  ): Promise<void> {
    return this.deathRepository.saveDeathLockAsync(data, tx);
  }

  /**
   * Get active death lock for a player
   * Delegates to DeathRepository
   *
   * Returns null if no active death lock exists (player is alive).
   */
  async getDeathLockAsync(playerId: string): Promise<{
    playerId: string;
    gravestoneId: string | null;
    groundItemIds: string[];
    position: { x: number; y: number; z: number };
    timestamp: number;
    zoneType: string;
    itemCount: number;
  } | null> {
    return this.deathRepository.getDeathLockAsync(playerId);
  }

  /**
   * Delete a death lock for a player
   * Delegates to DeathRepository
   *
   * Called when player respawns or death is fully resolved.
   */
  async deleteDeathLockAsync(playerId: string): Promise<void> {
    return this.deathRepository.deleteDeathLockAsync(playerId);
  }

  /**
   * Get all active death locks
   * Delegates to DeathRepository
   *
   * Used for server restart recovery to restore gravestones/ground items.
   */
  async getAllActiveDeathsAsync(): Promise<
    Array<{
      playerId: string;
      gravestoneId: string | null;
      groundItemIds: string[];
      position: { x: number; y: number; z: number };
      timestamp: number;
      zoneType: string;
      itemCount: number;
    }>
  > {
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
    return this.deathRepository.updateGroundItemsAsync(playerId, groundItemIds);
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
   * Save player data (fire-and-forget)
   * Tracks the operation for graceful shutdown
   */
  savePlayer(playerId: string, data: Partial<PlayerRow>): void {
    this.trackAsyncOperation(this.savePlayerAsync(playerId, data));
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
   * Save player inventory (fire-and-forget)
   * Tracks the operation for graceful shutdown
   */
  savePlayerInventory(playerId: string, items: InventorySaveItem[]): void {
    this.trackAsyncOperation(this.savePlayerInventoryAsync(playerId, items));
  }

  /**
   * @deprecated Use getPlayerEquipmentAsync instead
   * @returns Empty array (use async method to get real data)
   */
  getPlayerEquipment(_playerId: string): EquipmentRow[] {
    console.warn(
      "[DatabaseSystem] getPlayerEquipment called synchronously - use getPlayerEquipmentAsync instead",
    );
    return [];
  }

  /**
   * Save player equipment (fire-and-forget)
   * Tracks the operation for graceful shutdown
   */
  savePlayerEquipment(playerId: string, items: EquipmentSaveItem[]): void {
    this.trackAsyncOperation(this.savePlayerEquipmentAsync(playerId, items));
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
    this.trackAsyncOperation(this.saveWorldItemsAsync(chunkX, chunkZ, items));
  }

  /**
   * @deprecated Use getInactiveChunksAsync instead
   * @returns Empty array (use async method to get real data)
   */
  getInactiveChunks(_minutes: number): WorldChunkRow[] {
    console.warn(
      "[DatabaseSystem] getInactiveChunks called synchronously - use getInactiveChunksAsync instead",
    );
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
    this.trackAsyncOperation(
      this.updateChunkPlayerCountAsync(chunkX, chunkZ, playerCount),
    );
  }

  /**
   * Mark chunk for reset (fire-and-forget)
   * Tracks the operation for graceful shutdown
   */
  markChunkForReset(chunkX: number, chunkZ: number): void {
    this.trackAsyncOperation(this.markChunkForResetAsync(chunkX, chunkZ));
  }

  /**
   * Reset chunk (fire-and-forget)
   * Tracks the operation for graceful shutdown
   */
  resetChunk(chunkX: number, chunkZ: number): void {
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

  /**
   * Clean up database system resources
   *
   * Nullifies references to database instances but does NOT close the connection pool.
   * The pool is managed externally by the server and closed during graceful shutdown.
   * Called automatically when the world is destroyed.
   */
  destroy(): void {
    // Pool is managed externally in index.ts, don't close it here
    this.db = null;
    this.pool = null;
  }
}
