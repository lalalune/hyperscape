/**
 * DatabaseSystem - Server-side database operations for persistent game state
 * 
 * This system provides a comprehensive interface for all database operations in Hyperscape.
 * It uses PostgreSQL with Drizzle ORM for type-safe queries and migrations.
 * 
 * Key responsibilities:
 * - Character management (create, load, save character data)
 * - Player persistence (stats, position, levels, XP)
 * - Inventory and equipment storage
 * - Session tracking (login/logout times, playtime)
 * - World chunk persistence (terrain modifications, entities)
 * 
 * Architecture:
 * - Wraps Drizzle ORM with game-specific APIs
 * - Provides both async (preferred) and sync (legacy) methods
 * - Tracks pending operations for graceful shutdown
 * - Automatically attached to World via ServerNetwork initialization
 * 
 * Usage:
 * ```typescript
 * const dbSystem = world.getSystem('database') as DatabaseSystem;
 * const player = await dbSystem.getPlayerAsync(playerId);
 * await dbSystem.savePlayerAsync(playerId, { health: 100 });
 * ```
 */

import { SystemBase } from '@hyperscape/shared';
import type { World } from '@hyperscape/shared';
import { eq, and, sql } from 'drizzle-orm';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import type pg from 'pg';
import * as schema from './db/schema';
import type {
  EquipmentRow,
  EquipmentSaveItem,
  InventoryRow,
  InventorySaveItem,
  ItemRow,
  PlayerRow,
  PlayerSessionRow,
  WorldChunkRow
} from './types';

/**
 * DatabaseSystem class
 * 
 * Extends SystemBase to integrate with Hyperscape's ECS architecture.
 * The system is initialized with a Drizzle database instance and PostgreSQL pool
 * that are attached to the World object during server startup.
 */
export class DatabaseSystem extends SystemBase {
  /** Drizzle database instance for type-safe queries */
  private db: NodePgDatabase<typeof schema> | null = null;
  
  /** PostgreSQL connection pool for low-level operations if needed */
  private pool: pg.Pool | null = null;
  
  /** Blockchain gateway for hybrid sync (critical state to blockchain) */
  private blockchainGateway?: {
    isEnabled: () => boolean;
    registerPlayer: (name: string) => Promise<{ txHash: string; blockNumber: bigint } | null>;
    addItem: (address: string, itemId: number, qty: number, opts?: { batch?: boolean }) => Promise<{ txHash?: string; batched?: boolean }>;
    removeItem: (address: string, slot: number, qty: number) => Promise<{ txHash?: string }>;
    equipItem: (slot: number) => Promise<{ txHash: string }>;
    unequipItem: (slot: number) => Promise<{ txHash: string }>;
    recordMobKill: (mobId: string) => Promise<{ txHash: string }>;
    recordResourceGathered: (resourceId: string, type: 'tree' | 'fish') => Promise<{ txHash: string }>;
  };
  
  /** 
   * Tracks all pending database operations to ensure graceful shutdown.
   * Operations are added when sync methods fire-and-forget async work.
   */
  private pendingOperations: Set<Promise<unknown>> = new Set();
  
  /** Flag to indicate the system is being destroyed - prevents new operations */
  private isDestroying: boolean = false;
  
  // CRITICAL FIX: Track ongoing saves to prevent concurrent saves for same player
  private ongoingSaves = new Map<string, Promise<void>>();

  /**
   * Constructor
   * 
   * Sets up the database system with no dependencies since it provides
   * foundational services to other systems.
   * 
   * @param world - The game world instance this system belongs to
   */
  constructor(world: unknown) {
    super(world, {
      name: 'database',
      dependencies: {
        required: [],  // No dependencies - this is a foundational system
        optional: [],
      },
      autoCleanup: true,  // Automatically clean up resources on destroy
    });
  }

  /**
   * Initialize the database system
   * 
   * Retrieves the Drizzle database instance and PostgreSQL pool from the World object.
   * These are attached during server startup in index.ts after database initialization.
   * 
   * @throws Error if database instances are not available on the world object
   */
  async init(): Promise<void> {
    // Get BlockchainGateway for hybrid sync
    const gateway = this.world.getSystem?.('blockchain-gateway');
    if (gateway && typeof gateway === 'object' && 'isEnabled' in gateway) {
      this.blockchainGateway = gateway as typeof this.blockchainGateway;
      console.log('[DatabaseSystem] ✅ BlockchainGateway integrated - hybrid mode enabled');
      console.log('[DatabaseSystem] ℹ️  Critical state will sync to blockchain');
    } else {
      console.log('[DatabaseSystem] ℹ️  PostgreSQL-only mode (no blockchain)');
    }
    
    // Cast world to access server-specific properties
    const serverWorld = this.world as { pgPool?: pg.Pool; drizzleDb?: NodePgDatabase<typeof schema> };
    
    if (serverWorld.drizzleDb && serverWorld.pgPool) {
      this.db = serverWorld.drizzleDb;
      this.pool = serverWorld.pgPool;
    } else {
      throw new Error('[DatabaseSystem] Drizzle database not provided on world object');
    }

  }

  /**
   * Start the database system
   * 
   * Currently a no-op since all initialization is done in init().
   * The database is ready to use immediately after initialization.
   */
  start(): void {
  }

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
    
    if (this.pendingOperations.size === 0) {
      return;
    }
    
    
    // Create a copy of the pending operations to avoid issues with modifications during iteration
    const operations = Array.from(this.pendingOperations);
    
    // Wait for all operations to complete
    await Promise.allSettled(operations);
    
  }

  // ============================================================================
  // CHARACTER MANAGEMENT
  // ============================================================================
  // Characters represent individual player avatars in the game.
  // Each account (user) can have multiple characters.
  // Used by the character selection system before spawning into the world.

  /**
   * Get all characters for an account
   * 
   * Retrieves a list of all characters (avatars) owned by a specific account.
   * Used to populate the character selection screen.
   * 
   * @param accountId - The account/user ID to fetch characters for
   * @returns Array of characters with id and name
   */
  async getCharactersAsync(accountId: string): Promise<Array<{ id: string; name: string }>> {
    if (!this.db) throw new Error('Database not initialized');
    
    console.log('[DatabaseSystem] 📋 Loading characters for accountId:', accountId);
    
    const results = await this.db
      .select({ id: schema.characters.id, name: schema.characters.name })
      .from(schema.characters)
      .where(eq(schema.characters.accountId, accountId));
    
    console.log('[DatabaseSystem] 📋 Found', results.length, 'characters:', results);
    
    return results;
  }

  /**
   * Create a new character
   * 
   * Creates a new character (avatar) for an account with default starting stats.
   * Characters start at level 1 in all skills with initial health and position.
   * 
   * @param accountId - The account that owns this character
   * @param id - Unique character ID (usually a UUID)
   * @param name - Display name for the character (validated by caller)
   * @returns true if created successfully, false if character ID already exists
   */
  async createCharacter(accountId: string, id: string, name: string): Promise<boolean> {
    if (!this.db) throw new Error('Database not initialized');
    
    const now = Date.now();
    
    console.log('[DatabaseSystem] 🎭 Creating character:', {
      id,
      accountId,
      name,
      timestamp: now
    });
    
    try {
      await this.db.insert(schema.characters).values({
        id,
        accountId,
        name,
        createdAt: now,
        lastLogin: now,
      });
      
      console.log('[DatabaseSystem] ✅ Character created successfully in DB');
      
      // Verify it was saved
      const verify = await this.db
        .select()
        .from(schema.characters)
        .where(eq(schema.characters.id, id))
        .limit(1);
      
      console.log('[DatabaseSystem] 🔍 Verification query result:', verify);
      
      return true;
    } catch (error) {
      console.error('[DatabaseSystem] ❌ Error creating character:', error);
      // Character already exists (PostgreSQL unique constraint violation code)
      if (error && typeof error === 'object' && 'code' in error && error.code === '23505') {
        console.log('[DatabaseSystem] Character already exists (duplicate key)');
        return false;
      }
      throw error;
    }
  }

  // ============================================================================
  // PLAYER DATA PERSISTENCE
  // ============================================================================
  // Player data includes stats, levels, XP, health, coins, and position.
  // This is the core persistence for character progression.

  /**
   * Load player data from database
   * 
   * Retrieves all persistent data for a player including stats, levels, position,
   * and currency. Returns null if the player doesn't exist in the database yet.
   * 
   * @param playerId - The character/player ID to load
   * @returns Player data or null if not found
   */
  async getPlayerAsync(playerId: string): Promise<PlayerRow | null> {
    if (!this.db) throw new Error('Database not initialized');
    
    const results = await this.db
      .select()
      .from(schema.characters)
      .where(eq(schema.characters.id, playerId))
      .limit(1);
    
    if (results.length === 0) return null;
    
    const row = results[0];
    return {
      ...row,
      playerId: row.id,
      createdAt: row.createdAt || Date.now(),
      lastLogin: row.lastLogin || Date.now(),
    } as PlayerRow;
  }

  /**
   * Save player data to database
   * 
   * Updates existing player data ONLY. Does NOT create new characters.
   * Characters must be created explicitly via createCharacter().
   * Only the fields provided in the data parameter are updated; others remain unchanged.
   * This allows for partial updates (e.g., just updating health without touching XP).
   * 
   * @param playerId - The character/player ID to save
   * @param data - Partial player data to save (only provided fields are updated)
   */
  async savePlayerAsync(playerId: string, data: Partial<PlayerRow>): Promise<void> {
    if (!this.db || this.isDestroying) {
      // Gracefully skip during shutdown
      return;
    }
    
    type CharacterUpdate = Partial<Omit<typeof schema.characters.$inferInsert, 'id' | 'accountId'>>;
    
    // Build the update data (ONLY fields that were actually provided in data param)
    const updateData: CharacterUpdate = {};

    // Map PlayerRow fields to schema fields
    // NOTE: Don't overwrite character name once it's set - names come from createCharacter()
    // Only update name if explicitly provided and non-empty
    if (data.name && data.name.trim().length > 0) {
      updateData.name = data.name;
    }
    if (data.combatLevel !== undefined) {
      updateData.combatLevel = data.combatLevel;
    }
    if (data.attackLevel !== undefined) {
      updateData.attackLevel = data.attackLevel;
    }
    if (data.strengthLevel !== undefined) {
      updateData.strengthLevel = data.strengthLevel;
    }
    if (data.defenseLevel !== undefined) {
      updateData.defenseLevel = data.defenseLevel;
    }
    if (data.constitutionLevel !== undefined) {
      updateData.constitutionLevel = data.constitutionLevel;
    }
    if (data.rangedLevel !== undefined) {
      updateData.rangedLevel = data.rangedLevel;
    }
    if (data.woodcuttingLevel !== undefined) {
      updateData.woodcuttingLevel = data.woodcuttingLevel;
    }
    if (data.fishingLevel !== undefined) {
      updateData.fishingLevel = data.fishingLevel;
    }
    if (data.firemakingLevel !== undefined) {
      updateData.firemakingLevel = data.firemakingLevel;
    }
    if (data.cookingLevel !== undefined) {
      updateData.cookingLevel = data.cookingLevel;
    }
    // XP fields
    if (data.attackXp !== undefined) {
      updateData.attackXp = data.attackXp;
    }
    if (data.strengthXp !== undefined) {
      updateData.strengthXp = data.strengthXp;
    }
    if (data.defenseXp !== undefined) {
      updateData.defenseXp = data.defenseXp;
    }
    if (data.constitutionXp !== undefined) {
      updateData.constitutionXp = data.constitutionXp;
    }
    if (data.rangedXp !== undefined) {
      updateData.rangedXp = data.rangedXp;
    }
    if (data.woodcuttingXp !== undefined) {
      updateData.woodcuttingXp = data.woodcuttingXp;
    }
    if (data.fishingXp !== undefined) {
      updateData.fishingXp = data.fishingXp;
    }
    if (data.firemakingXp !== undefined) {
      updateData.firemakingXp = data.firemakingXp;
    }
    if (data.cookingXp !== undefined) {
      updateData.cookingXp = data.cookingXp;
    }
    if (data.health !== undefined) {
      updateData.health = data.health;
    }
    if (data.maxHealth !== undefined) {
      updateData.maxHealth = data.maxHealth;
    }
    if (data.coins !== undefined) {
      updateData.coins = data.coins;
    }
    if (data.positionX !== undefined) {
      updateData.positionX = data.positionX;
    }
    if (data.positionY !== undefined) {
      updateData.positionY = data.positionY;
    }
    if (data.positionZ !== undefined) {
      updateData.positionZ = data.positionZ;
    }

    // If no update data provided, skip silently (character doesn't need updating)
    if (Object.keys(updateData).length === 0) {
      return;
    }

    // UPDATE ONLY - does NOT create characters
    // Characters must be explicitly created via createCharacter() first
    try {
      await this.db
        .update(schema.characters)
        .set(updateData)
        .where(eq(schema.characters.id, playerId));
    } catch (err) {
      console.error('[DatabaseSystem] UPDATE FAILED:', err);
      throw err;
    }
  }

  // ============================================================================
  // INVENTORY MANAGEMENT
  // ============================================================================
  // Player inventory stores items in 28 slots (like RuneScape classic).
  // Each item has an ID, quantity, slot index, and optional metadata.

  /**
   * Load player inventory from database
   * 
   * Retrieves all items in a player's inventory, ordered by slot index.
   * Metadata is automatically parsed from JSON string to object.
   * 
   * @param playerId - The player ID to fetch inventory for
   * @returns Array of inventory items
   */
  async getPlayerInventoryAsync(playerId: string): Promise<InventoryRow[]> {
    if (!this.db) throw new Error('Database not initialized');
    
    const results = await this.db
      .select()
      .from(schema.inventory)
      .where(eq(schema.inventory.playerId, playerId))
      .orderBy(schema.inventory.slotIndex);
    
    return results.map(row => ({
      ...row,
      metadata: row.metadata ? JSON.parse(row.metadata) : null,
    })) as InventoryRow[];
  }

  async savePlayerInventoryAsync(playerId: string, items: InventorySaveItem[]): Promise<void> {
    if (!this.db || this.isDestroying) {
      // Gracefully skip during shutdown
      return;
    }
    
    // Perform atomic replace using a transaction to avoid data loss on hot reload/crash
    await this.db.transaction(async (tx) => {
      // Delete existing inventory
      await tx.delete(schema.inventory).where(eq(schema.inventory.playerId, playerId));
      // Insert new items
      if (items.length > 0) {
        await tx.insert(schema.inventory).values(
          items.map(item => ({
            playerId,
            itemId: item.itemId,
            quantity: item.quantity,
            slotIndex: item.slotIndex ?? -1,
            metadata: item.metadata ? JSON.stringify(item.metadata) : null,
          }))
        );
      }
    });
  }

  // ============================================================================
  // EQUIPMENT MANAGEMENT
  // ============================================================================
  // Equipment represents items worn/wielded by the player (weapons, armor, etc.).
  // Each slot type (e.g., "weapon", "helmet") can hold one item.

  /**
   * Load player equipment from database
   * 
   * Retrieves all equipped items for a player across all equipment slots.
   * Returns empty array if player has no equipped items.
   * 
   * @param playerId - The player ID to fetch equipment for
   * @returns Array of equipped items by slot
   */
  async getPlayerEquipmentAsync(playerId: string): Promise<EquipmentRow[]> {
    if (!this.db) throw new Error('Database not initialized');
    
    const results = await this.db
      .select()
      .from(schema.equipment)
      .where(eq(schema.equipment.playerId, playerId));
    
    return results as EquipmentRow[];
  }

  async savePlayerEquipmentAsync(playerId: string, items: EquipmentSaveItem[]): Promise<void> {
    if (!this.db || this.isDestroying) {
      // Gracefully skip during shutdown
      return;
    }
    
    // Delete existing equipment
    await this.db.delete(schema.equipment).where(eq(schema.equipment.playerId, playerId));
    
    // Insert new equipment
    if (items.length > 0) {
      await this.db.insert(schema.equipment).values(
        items.map(item => ({
          playerId,
          slotType: item.slotType,
          itemId: item.itemId || null,
          quantity: item.quantity ?? 1,
        }))
      );
    }
  }

  // ============================================================================
  // SESSION TRACKING
  // ============================================================================
  // Sessions track when players log in/out and their total playtime.
  // Used for analytics, idle timeout detection, and player activity monitoring.

  /**
   * Create a new player session
   * 
   * Records when a player logs in. Session remains active (sessionEnd=null) until
   * they disconnect. Used for tracking playtime and detecting idle players.
   * 
   * @param sessionData - Session information (playerId, start time, etc.)
   * @param sessionId - Optional session ID (generated if not provided)
   * @returns The session ID for tracking this session
   */
  async createPlayerSessionAsync(sessionData: Omit<PlayerSessionRow, 'id' | 'sessionId'>, sessionId?: string): Promise<string> {
    if (!this.db) throw new Error('Database not initialized');
    
    const id = sessionId || `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    await this.db.insert(schema.playerSessions).values({
      id,
      playerId: sessionData.playerId,
      sessionStart: sessionData.sessionStart,
      sessionEnd: sessionData.sessionEnd ?? null,
      playtimeMinutes: sessionData.playtimeMinutes ?? 0,
      reason: sessionData.reason ?? null,
      lastActivity: sessionData.lastActivity ?? Date.now(),
    });
    
    return id;
  }

  async updatePlayerSessionAsync(sessionId: string, updates: Partial<PlayerSessionRow>): Promise<void> {
    if (!this.db || this.isDestroying) {
      // Gracefully skip during shutdown
      return;
    }
    
    type SessionUpdate = Partial<typeof schema.playerSessions.$inferInsert>;
    const updateData: SessionUpdate = {};
    if (updates.sessionEnd !== undefined) updateData.sessionEnd = updates.sessionEnd;
    if (updates.playtimeMinutes !== undefined) updateData.playtimeMinutes = updates.playtimeMinutes;
    if (updates.reason !== undefined) updateData.reason = updates.reason;
    if (updates.lastActivity !== undefined) updateData.lastActivity = updates.lastActivity;
    
    await this.db
      .update(schema.playerSessions)
      .set(updateData)
      .where(eq(schema.playerSessions.id, sessionId));
  }

  async getActivePlayerSessionsAsync(): Promise<PlayerSessionRow[]> {
    if (!this.db) throw new Error('Database not initialized');
    
    const results = await this.db
      .select()
      .from(schema.playerSessions)
      .where(sql`${schema.playerSessions.sessionEnd} IS NULL`);
    
    return results.map(row => ({
      ...row,
      id: row.id,
      sessionId: row.id,
      sessionEnd: row.sessionEnd ?? null,
      reason: row.reason ?? null,
    })) as PlayerSessionRow[];
  }

  async endPlayerSessionAsync(sessionId: string, reason?: string): Promise<void> {
    if (!this.db) throw new Error('Database not initialized');
    
    await this.db
      .update(schema.playerSessions)
      .set({
        sessionEnd: Date.now(),
        reason: reason || 'normal',
      })
      .where(eq(schema.playerSessions.id, sessionId));
  }

  // ============================================================================
  // WORLD CHUNK PERSISTENCE
  // ============================================================================
  // World chunks store persistent modifications to the terrain and entities.
  // Each chunk is identified by its X,Z coordinates and contains serialized data.

  /**
   * Load world chunk data from database
   * 
   * Retrieves persistent modifications for a specific chunk (resources, buildings, etc.).
   * Returns null if chunk has no persistent data (meaning it uses default generation).
   * 
   * @param chunkX - Chunk X coordinate
   * @param chunkZ - Chunk Z coordinate
   * @returns Chunk data or null if not found
   */
  async getWorldChunkAsync(chunkX: number, chunkZ: number): Promise<WorldChunkRow | null> {
    if (!this.db) throw new Error('Database not initialized');
    
    const results = await this.db
      .select()
      .from(schema.worldChunks)
      .where(and(
        eq(schema.worldChunks.chunkX, chunkX),
        eq(schema.worldChunks.chunkZ, chunkZ)
      ))
      .limit(1);
    
    if (results.length === 0) return null;
    
    return results[0] as WorldChunkRow;
  }

  async saveWorldChunkAsync(chunkData: { chunkX: number; chunkZ: number; data: string }): Promise<void> {
    if (!this.db || this.isDestroying) {
      // Gracefully skip during shutdown
      return;
    }
    
    await this.db
      .insert(schema.worldChunks)
      .values({
        chunkX: chunkData.chunkX,
        chunkZ: chunkData.chunkZ,
        data: chunkData.data,
        lastActive: Date.now(),
      })
      .onConflictDoUpdate({
        target: [schema.worldChunks.chunkX, schema.worldChunks.chunkZ],
        set: {
          data: chunkData.data,
          lastActive: Date.now(),
        },
      });
  }

  async getWorldItemsAsync(_chunkX: number, _chunkZ: number): Promise<ItemRow[]> {
    console.warn('[DatabaseSystem] getWorldItemsAsync not yet implemented');
    return [];
  }

  async saveWorldItemsAsync(_chunkX: number, _chunkZ: number, _items: ItemRow[]): Promise<void> {
    console.warn('[DatabaseSystem] saveWorldItemsAsync not yet implemented');
  }

  async getInactiveChunksAsync(minutes: number): Promise<WorldChunkRow[]> {
    if (!this.db) throw new Error('Database not initialized');
    
    const cutoffTime = Date.now() - (minutes * 60 * 1000);
    
    const results = await this.db
      .select()
      .from(schema.worldChunks)
      .where(sql`${schema.worldChunks.lastActive} < ${cutoffTime}`);
    
    return results as WorldChunkRow[];
  }

  async updateChunkPlayerCountAsync(chunkX: number, chunkZ: number, playerCount: number): Promise<void> {
    if (!this.db || this.isDestroying) {
      // Gracefully skip during shutdown
      return;
    }
    
    await this.db
      .update(schema.worldChunks)
      .set({ playerCount })
      .where(and(
        eq(schema.worldChunks.chunkX, chunkX),
        eq(schema.worldChunks.chunkZ, chunkZ)
      ));
  }

  async markChunkForResetAsync(chunkX: number, chunkZ: number): Promise<void> {
    if (!this.db) throw new Error('Database not initialized');
    
    await this.db
      .update(schema.worldChunks)
      .set({ needsReset: 1 })
      .where(and(
        eq(schema.worldChunks.chunkX, chunkX),
        eq(schema.worldChunks.chunkZ, chunkZ)
      ));
  }

  async resetChunkAsync(chunkX: number, chunkZ: number): Promise<void> {
    if (!this.db) throw new Error('Database not initialized');
    
    // Delete the chunk to allow it to regenerate
    await this.db
      .delete(schema.worldChunks)
      .where(and(
        eq(schema.worldChunks.chunkX, chunkX),
        eq(schema.worldChunks.chunkZ, chunkZ)
      ));
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
    console.warn('[DatabaseSystem] getCharacters called synchronously - use getCharactersAsync instead');
    return [];
  }

  getPlayer(_playerId: string): PlayerRow | null {
    console.warn('[DatabaseSystem] getPlayer called synchronously - use getPlayerAsync instead');
    return null;
  }

  savePlayer(playerId: string, data: Partial<PlayerRow>): void {
    // CRITICAL FIX: Prevent concurrent saves for the same player
    const existingSave = this.ongoingSaves.get(playerId);
    if (existingSave) {
      // Queue this save to run after the current one completes
      existingSave.finally(() => {
        this.savePlayer(playerId, data);
      });
      return;
    }

    const operation = this.savePlayerAsync(playerId, data)
      // HYBRID: Also sync critical state to blockchain if available
      .then(async () => {
        if (this.blockchainGateway?.isEnabled() && data.name) {
          // Player registration on blockchain (once per character)
          try {
            const txResult = await this.blockchainGateway.registerPlayer(data.name);
            if (txResult) {
              console.log(`[DatabaseSystem] ✅ Player synced to blockchain: ${txResult.txHash}`);
            }
          } catch (error) {
            console.log('[DatabaseSystem] ℹ️  Player already registered on-chain');
          }
        }
      })
      .catch(err => {
        console.error('[DatabaseSystem] Error in savePlayer:', err);
      })
      .finally(() => {
        this.pendingOperations.delete(operation);
        this.ongoingSaves.delete(playerId);
      });
    
    this.pendingOperations.add(operation);
    this.ongoingSaves.set(playerId, operation);
  }

  getPlayerInventory(_playerId: string): InventoryRow[] {
    console.warn('[DatabaseSystem] getPlayerInventory called synchronously - use getPlayerInventoryAsync instead');
    return [];
  }

  savePlayerInventory(playerId: string, items: InventorySaveItem[]): void {
    const operation = this.savePlayerInventoryAsync(playerId, items)
      // HYBRID: Sync inventory to blockchain (batched for gas optimization)
      .then(async () => {
        if (this.blockchainGateway?.isEnabled() && playerId.startsWith('0x')) {
          // Sync each new item to blockchain (batched automatically by BlockchainGateway)
          for (const item of items) {
            if (item.itemId && item.quantity) {
              // Map string itemId to numeric ID for contracts
              const itemIdNum = this.mapItemIdToNumber(item.itemId);
              if (itemIdNum) {
                this.blockchainGateway.addItem(
                  playerId as `0x${string}`,
                  itemIdNum,
                  item.quantity,
                  { batch: true }  // Enable batching
                ).catch(() => {}); // Non-blocking
              }
            }
          }
        }
      })
      .catch(err => {
        console.error('[DatabaseSystem] Error in savePlayerInventory:', err);
      })
      .finally(() => {
        this.pendingOperations.delete(operation);
      });
    this.pendingOperations.add(operation);
  }

  getPlayerEquipment(_playerId: string): EquipmentRow[] {
    console.warn('[DatabaseSystem] getPlayerEquipment called synchronously - use getPlayerEquipmentAsync instead');
    return [];
  }

  savePlayerEquipment(playerId: string, items: EquipmentSaveItem[]): void {
    const operation = this.savePlayerEquipmentAsync(playerId, items)
      .catch(err => {
        console.error('[DatabaseSystem] Error in savePlayerEquipment:', err);
      })
      .finally(() => {
        this.pendingOperations.delete(operation);
      });
    this.pendingOperations.add(operation);
  }

  createPlayerSession(sessionData: Omit<PlayerSessionRow, 'id' | 'sessionId'>): string {
    const sessionId = `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const operation = this.createPlayerSessionAsync(sessionData, sessionId)
      .catch(err => {
        console.error('[DatabaseSystem] Error in createPlayerSession:', err);
      })
      .finally(() => {
        this.pendingOperations.delete(operation);
      });
    this.pendingOperations.add(operation);
    return sessionId;
  }

  updatePlayerSession(sessionId: string, updates: Partial<PlayerSessionRow>): void {
    const operation = this.updatePlayerSessionAsync(sessionId, updates)
      .catch(err => {
        console.error('[DatabaseSystem] Error in updatePlayerSession:', err);
      })
      .finally(() => {
        this.pendingOperations.delete(operation);
      });
    this.pendingOperations.add(operation);
  }

  getActivePlayerSessions(): PlayerSessionRow[] {
    console.warn('[DatabaseSystem] getActivePlayerSessions called synchronously - use getActivePlayerSessionsAsync instead');
    return [];
  }

  endPlayerSession(sessionId: string, reason?: string): void {
    const operation = this.endPlayerSessionAsync(sessionId, reason)
      .catch(err => {
        console.error('[DatabaseSystem] Error in endPlayerSession:', err);
      })
      .finally(() => {
        this.pendingOperations.delete(operation);
      });
    this.pendingOperations.add(operation);
  }

  saveWorldChunk(chunkData: { chunkX: number; chunkZ: number; data: string }): void {
    const operation = this.saveWorldChunkAsync(chunkData)
      .catch(err => {
        console.error('[DatabaseSystem] Error in saveWorldChunk:', err);
      })
      .finally(() => {
        this.pendingOperations.delete(operation);
      });
    this.pendingOperations.add(operation);
  }

  getWorldItems(_chunkX: number, _chunkZ: number): ItemRow[] {
    console.warn('[DatabaseSystem] getWorldItems called synchronously - use getWorldItemsAsync instead');
    return [];
  }

  saveWorldItems(chunkX: number, chunkZ: number, items: ItemRow[]): void {
    const operation = this.saveWorldItemsAsync(chunkX, chunkZ, items)
      .catch(err => {
        console.error('[DatabaseSystem] Error in saveWorldItems:', err);
      })
      .finally(() => {
        this.pendingOperations.delete(operation);
      });
    this.pendingOperations.add(operation);
  }

  getInactiveChunks(_minutes: number): WorldChunkRow[] {
    console.warn('[DatabaseSystem] getInactiveChunks called synchronously - use getInactiveChunksAsync instead');
    return [];
  }

  updateChunkPlayerCount(chunkX: number, chunkZ: number, playerCount: number): void {
    const operation = this.updateChunkPlayerCountAsync(chunkX, chunkZ, playerCount)
      .catch(err => {
        console.error('[DatabaseSystem] Error in updateChunkPlayerCount:', err);
      })
      .finally(() => {
        this.pendingOperations.delete(operation);
      });
    this.pendingOperations.add(operation);
  }

  markChunkForReset(chunkX: number, chunkZ: number): void {
    const operation = this.markChunkForResetAsync(chunkX, chunkZ)
      .catch(err => {
        console.error('[DatabaseSystem] Error in markChunkForReset:', err);
      })
      .finally(() => {
        this.pendingOperations.delete(operation);
      });
    this.pendingOperations.add(operation);
  }

  resetChunk(chunkX: number, chunkZ: number): void {
    const operation = this.resetChunkAsync(chunkX, chunkZ)
      .catch(err => {
        console.error('[DatabaseSystem] Error in resetChunk:', err);
      })
      .finally(() => {
        this.pendingOperations.delete(operation);
      });
    this.pendingOperations.add(operation);
  }

  getWorldChunk(_x: number, _z: number): WorldChunkRow | null {
    console.warn('[DatabaseSystem] getWorldChunk called synchronously - use getWorldChunkAsync instead');
    return null;
  }

  // ============================================================================
  // MAINTENANCE METHODS
  // ============================================================================
  // Methods for cleaning up old data and getting database statistics

  /**
   * Clean up old player sessions from the database
   * 
   * @param daysOld - Delete sessions older than this many days
   * @returns Number of sessions deleted
   */
  async cleanupOldSessionsAsync(daysOld: number): Promise<number> {
    if (!this.db) throw new Error('Database not initialized');
    
    const cutoffTime = Date.now() - (daysOld * 24 * 60 * 60 * 1000);
    
    const result = await this.db
      .delete(schema.playerSessions)
      .where(sql`${schema.playerSessions.sessionEnd} IS NOT NULL AND ${schema.playerSessions.sessionEnd} < ${cutoffTime}`);
    
    return result.rowCount || 0;
  }

  cleanupOldSessions(daysOld: number): number {
    console.warn('[DatabaseSystem] cleanupOldSessions called synchronously - use cleanupOldSessionsAsync instead');
    const operation = this.cleanupOldSessionsAsync(daysOld)
      .catch(err => {
        console.error('[DatabaseSystem] Error in cleanupOldSessions:', err);
      })
      .finally(() => {
        this.pendingOperations.delete(operation);
      });
    this.pendingOperations.add(operation);
    return 0; // Can't return real count from async operation
  }

  /**
   * Clean up old chunk activity records
   * 
   * @param daysOld - Delete activity records older than this many days
   * @returns Number of records deleted
   */
  async cleanupOldChunkActivityAsync(daysOld: number): Promise<number> {
    if (!this.db) throw new Error('Database not initialized');
    
    const cutoffTime = Date.now() - (daysOld * 24 * 60 * 60 * 1000);
    
    const result = await this.db
      .delete(schema.worldChunks)
      .where(sql`${schema.worldChunks.lastActive} < ${cutoffTime} AND ${schema.worldChunks.playerCount} = 0`);
    
    return result.rowCount || 0;
  }

  cleanupOldChunkActivity(daysOld: number): number {
    console.warn('[DatabaseSystem] cleanupOldChunkActivity called synchronously - use cleanupOldChunkActivityAsync instead');
    const operation = this.cleanupOldChunkActivityAsync(daysOld)
      .catch(err => {
        console.error('[DatabaseSystem] Error in cleanupOldChunkActivity:', err);
      })
      .finally(() => {
        this.pendingOperations.delete(operation);
      });
    this.pendingOperations.add(operation);
    return 0; // Can't return real count from async operation
  }

  /**
   * Get database statistics
   * 
   * @returns Object containing various database counts
   */
  async getDatabaseStatsAsync(): Promise<{
    playerCount: number;
    activeSessionCount: number;
    chunkCount: number;
    activeChunkCount: number;
    totalActivityRecords: number;
  }> {
    if (!this.db) throw new Error('Database not initialized');
    
    const [playerCountResult] = await this.db
      .select({ count: sql<number>`count(*)` })
      .from(schema.characters);
    
    const [activeSessionResult] = await this.db
      .select({ count: sql<number>`count(*)` })
      .from(schema.playerSessions)
      .where(sql`${schema.playerSessions.sessionEnd} IS NULL`);
    
    const [chunkCountResult] = await this.db
      .select({ count: sql<number>`count(*)` })
      .from(schema.worldChunks);
    
    const [activeChunkResult] = await this.db
      .select({ count: sql<number>`count(*)` })
      .from(schema.worldChunks)
      .where(sql`${schema.worldChunks.playerCount} > 0`);
    
    return {
      playerCount: Number(playerCountResult.count),
      activeSessionCount: Number(activeSessionResult.count),
      chunkCount: Number(chunkCountResult.count),
      activeChunkCount: Number(activeChunkResult.count),
      totalActivityRecords: Number(chunkCountResult.count),
    };
  }

  getDatabaseStats(): {
    playerCount: number;
    activeSessionCount: number;
    chunkCount: number;
    activeChunkCount: number;
    totalActivityRecords: number;
  } {
    console.warn('[DatabaseSystem] getDatabaseStats called synchronously - use getDatabaseStatsAsync instead');
    return {
      playerCount: 0,
      activeSessionCount: 0,
      chunkCount: 0,
      activeChunkCount: 0,
      totalActivityRecords: 0,
    };
  }

  // Helper method for blockchain integration
  private mapItemIdToNumber(itemId: string): number | null {
    // Map string item IDs to numeric IDs for blockchain contracts
    // This is a simple implementation - could be extended with a lookup table
    const itemMap: Record<string, number> = {
      'bronze_sword': 1,
      'steel_sword': 2,
      'mithril_sword': 3,
      'bronze_bow': 10,
      'oak_bow': 11,
      'willow_bow': 12,
      'arrows': 20,
      'logs': 30,
      'raw_fish': 40,
      'cooked_fish': 41,
      // Add more mappings as needed
    };
    return itemMap[itemId] || null;
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