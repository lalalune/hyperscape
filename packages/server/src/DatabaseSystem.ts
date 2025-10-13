import { SystemBase, type World } from '@hyperscape/shared';
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

export class DatabaseSystem extends SystemBase {
  private db: NodePgDatabase<typeof schema> | null = null;
  private pool: pg.Pool | null = null;
  private pendingOperations: Set<Promise<unknown>> = new Set();

  constructor(world: World) {
    super(world, {
      name: 'database',
      dependencies: {
        required: [],
        optional: [],
      },
      autoCleanup: true,
    });
  }

  async init(): Promise<void> {
    const serverWorld = this.world as { pgPool?: pg.Pool; drizzleDb?: NodePgDatabase<typeof schema> };
    
    if (serverWorld.drizzleDb && serverWorld.pgPool) {
      console.log('[DatabaseSystem] Using provided Drizzle database and pool');
      this.db = serverWorld.drizzleDb;
      this.pool = serverWorld.pgPool;
    } else {
      throw new Error('[DatabaseSystem] Drizzle database not provided on world object');
    }

    console.log('[DatabaseSystem] ✅ Database system initialized');
  }

  start(): void {
    console.log('[DatabaseSystem] Database system started');
  }

  /**
   * Wait for all pending database operations to complete
   * This should be called before closing the database pool
   */
  async waitForPendingOperations(): Promise<void> {
    if (this.pendingOperations.size === 0) {
      return;
    }
    
    console.log(`[DatabaseSystem] Waiting for ${this.pendingOperations.size} pending operations to complete...`);
    
    // Create a copy of the pending operations to avoid issues with modifications during iteration
    const operations = Array.from(this.pendingOperations);
    
    // Wait for all operations to complete
    await Promise.allSettled(operations);
    
    console.log('[DatabaseSystem] All pending operations completed');
  }

  // --- Characters API ---
  async getCharactersAsync(accountId: string): Promise<Array<{ id: string; name: string }>> {
    if (!this.db) throw new Error('Database not initialized');
    
    const results = await this.db
      .select({ id: schema.characters.id, name: schema.characters.name })
      .from(schema.characters)
      .where(eq(schema.characters.accountId, accountId));
    
    return results;
  }

  async createCharacter(accountId: string, id: string, name: string): Promise<boolean> {
    if (!this.db) throw new Error('Database not initialized');
    
    const now = Date.now();
    
    try {
      await this.db.insert(schema.characters).values({
        id,
        accountId,
        name,
        createdAt: now,
        lastLogin: now,
      });
      return true;
    } catch (error) {
      // Character already exists (unique constraint violation)
      if (error && typeof error === 'object' && 'code' in error && error.code === '23505') {
        return false;
      }
      throw error;
    }
  }

  // Player data methods
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
    } as unknown as PlayerRow;
  }

  async savePlayerAsync(playerId: string, data: Partial<PlayerRow>): Promise<void> {
    if (!this.db) throw new Error('Database not initialized');
    
    type CharacterInsert = typeof schema.characters.$inferInsert;
    type CharacterUpdate = Partial<Omit<CharacterInsert, 'id' | 'accountId'>>;
    
    // Build the insert data with required fields
    const insertData: CharacterInsert = {
      id: playerId,
      accountId: playerId,
      name: data.name || `Player_${playerId.substring(0, 8)}`, // Always provide name for INSERT
      createdAt: Date.now(),
      lastLogin: Date.now(),
    };

    // Build the update data (ONLY fields that were actually provided in data param)
    const updateData: CharacterUpdate = {};

    // Map PlayerRow fields to schema fields - only add to insertData and updateData if provided
    if (data.name !== undefined) {
      updateData.name = data.name;
    }
    if (data.combatLevel !== undefined) {
      insertData.combatLevel = data.combatLevel;
      updateData.combatLevel = data.combatLevel;
    }
    if (data.attackLevel !== undefined) {
      insertData.attackLevel = data.attackLevel;
      updateData.attackLevel = data.attackLevel;
    }
    if (data.strengthLevel !== undefined) {
      insertData.strengthLevel = data.strengthLevel;
      updateData.strengthLevel = data.strengthLevel;
    }
    if (data.defenseLevel !== undefined) {
      insertData.defenseLevel = data.defenseLevel;
      updateData.defenseLevel = data.defenseLevel;
    }
    if (data.constitutionLevel !== undefined) {
      insertData.constitutionLevel = data.constitutionLevel;
      updateData.constitutionLevel = data.constitutionLevel;
    }
    if (data.rangedLevel !== undefined) {
      insertData.rangedLevel = data.rangedLevel;
      updateData.rangedLevel = data.rangedLevel;
    }
    if (data.health !== undefined) {
      insertData.health = data.health;
      updateData.health = data.health;
    }
    if (data.maxHealth !== undefined) {
      insertData.maxHealth = data.maxHealth;
      updateData.maxHealth = data.maxHealth;
    }
    if (data.coins !== undefined) {
      insertData.coins = data.coins;
      updateData.coins = data.coins;
    }
    if (data.positionX !== undefined) {
      insertData.positionX = data.positionX;
      updateData.positionX = data.positionX;
    }
    if (data.positionY !== undefined) {
      insertData.positionY = data.positionY;
      updateData.positionY = data.positionY;
    }
    if (data.positionZ !== undefined) {
      insertData.positionZ = data.positionZ;
      updateData.positionZ = data.positionZ;
    }

    // If no update data provided, skip the update clause
    if (Object.keys(updateData).length === 0) {
      // Just insert with DO NOTHING on conflict
      await this.db
        .insert(schema.characters)
        .values(insertData)
        .onConflictDoNothing();
    } else {
      // Insert and update on conflict
      await this.db
        .insert(schema.characters)
        .values(insertData)
        .onConflictDoUpdate({
          target: schema.characters.id,
          set: updateData,
        });
    }
  }

  // Inventory methods
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
    if (!this.db) throw new Error('Database not initialized');
    
    // Delete existing inventory
    await this.db.delete(schema.inventory).where(eq(schema.inventory.playerId, playerId));
    
    // Insert new items
    if (items.length > 0) {
      await this.db.insert(schema.inventory).values(
        items.map(item => ({
          playerId,
          itemId: item.itemId,
          quantity: item.quantity,
          slotIndex: item.slotIndex ?? -1,
          metadata: item.metadata ? JSON.stringify(item.metadata) : null,
        }))
      );
    }
  }

  // Equipment methods
  async getPlayerEquipmentAsync(playerId: string): Promise<EquipmentRow[]> {
    if (!this.db) throw new Error('Database not initialized');
    
    const results = await this.db
      .select()
      .from(schema.equipment)
      .where(eq(schema.equipment.playerId, playerId));
    
    return results as EquipmentRow[];
  }

  async savePlayerEquipmentAsync(playerId: string, items: EquipmentSaveItem[]): Promise<void> {
    if (!this.db) throw new Error('Database not initialized');
    
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

  // Session tracking methods
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
    if (!this.db) throw new Error('Database not initialized');
    
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

  // World chunk methods
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
    if (!this.db) throw new Error('Database not initialized');
    
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
    if (!this.db) throw new Error('Database not initialized');
    
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

  // Sync wrappers for backward compatibility (will log warnings)
  getCharacters(_accountId: string): Array<{ id: string; name: string }> {
    console.warn('[DatabaseSystem] getCharacters called synchronously - use getCharactersAsync instead');
    return [];
  }

  getPlayer(_playerId: string): PlayerRow | null {
    console.warn('[DatabaseSystem] getPlayer called synchronously - use getPlayerAsync instead');
    return null;
  }

  savePlayer(playerId: string, data: Partial<PlayerRow>): void {
    const operation = this.savePlayerAsync(playerId, data)
      .catch(err => {
        console.error('[DatabaseSystem] Error in savePlayer:', err);
      })
      .finally(() => {
        this.pendingOperations.delete(operation);
      });
    this.pendingOperations.add(operation);
  }

  getPlayerInventory(_playerId: string): InventoryRow[] {
    console.warn('[DatabaseSystem] getPlayerInventory called synchronously - use getPlayerInventoryAsync instead');
    return [];
  }

  savePlayerInventory(playerId: string, items: InventorySaveItem[]): void {
    const operation = this.savePlayerInventoryAsync(playerId, items)
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

  destroy(): void {
    // Pool is managed externally, don't close it here
    this.db = null;
    this.pool = null;
  }
}