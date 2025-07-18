import { System } from './System';
import { Entity } from '../entities/Entity';
import { drizzle } from 'drizzle-orm/bun-sqlite';
import { Database } from 'bun:sqlite';
import { eq, and } from 'drizzle-orm';
import { uuid } from '../utils';
import {
  entityStates,
  nodeStates,
  playerStates,
  type EntityState,
  type NodeState,
  type PlayerState as DbPlayerState
} from '../../server/db-persistence-schema';

export interface PlayerState {
  position: { x: number; y: number; z: number };
  rotation: { y: number };
  health: number;
}

export interface WorldStateData {
  entities: any[];
  metadata: Record<string, any>;
}

export interface QueryParams {
  where?: Record<string, any>;
  limit?: number;
  offset?: number;
}

export interface StorageOptions {
  ttl?: number;
  overwrite?: boolean;
}

export interface ResetOptions {
  scope: 'full' | 'players' | 'world' | 'scheduled';
  preserveData?: string[];
  notifications?: boolean;
}

export class PersistenceSystem extends System {
  private db: ReturnType<typeof drizzle>;
  private worldId: string;
  private saveTimers: Map<string, NodeJS.Timeout> = new Map();
  private batchQueue: Map<string, any> = new Map();
  private batchTimer?: NodeJS.Timeout;

  constructor(world: any) {
    super(world);
    this.worldId = world.id || 'default';

    // Initialize database
    const sqlite = new Database('world/persistence.db');
    this.db = drizzle(sqlite);

    // Create tables if they don't exist
    this.initializeTables();

    // Start auto-save timer
    this.startAutoSave();
  }

  private initializeTables() {
    // SQLite doesn't support CREATE TABLE IF NOT EXISTS with Drizzle,
    // so we'll handle this in migrations
    console.log('[Persistence] Database initialized');
  }

  private startAutoSave() {
    // Auto-save player states every 30 seconds
    setInterval(() => {
      this.saveAllPlayerStates();
    }, 30000);

    // Process batch queue every 5 seconds
    this.batchTimer = setInterval(() => {
      this.processBatchQueue();
    }, 5000);
  }

  // Player operations
  async savePlayerState(playerId: string, state: PlayerState): Promise<void> {
    try {
      const existing = await this.db
        .select()
        .from(playerStates)
        .where(
          and(
            eq(playerStates.playerId, playerId),
            eq(playerStates.worldId, this.worldId)
          )
        )
        .limit(1);

      const stateData = {
        playerId,
        worldId: this.worldId,
        positionX: state.position.x,
        positionY: state.position.y,
        positionZ: state.position.z,
        rotationY: state.rotation.y,
        health: state.health,
        lastUpdated: new Date().toISOString()
      };

      if (existing.length > 0) {
        await this.db
          .update(playerStates)
          .set(stateData)
          .where(
            and(
              eq(playerStates.playerId, playerId),
              eq(playerStates.worldId, this.worldId)
            )
          );
      } else {
        await this.db.insert(playerStates).values(stateData);
      }

      console.log(`[Persistence] Saved player state for ${playerId}`);
    } catch (error) {
      console.error('[Persistence] Failed to save player state:', error);
    }
  }

  async loadPlayerState(playerId: string): Promise<PlayerState | null> {
    try {
      const result = await this.db
        .select()
        .from(playerStates)
        .where(
          and(
            eq(playerStates.playerId, playerId),
            eq(playerStates.worldId, this.worldId)
          )
        )
        .limit(1);

      if (result.length === 0) {return null;}

      const state = result[0];
      return {
        position: {
          x: state.positionX || 0,
          y: state.positionY || 0,
          z: state.positionZ || 0
        },
        rotation: {
          y: state.rotationY || 0
        },
        health: state.health || 100
      };
    } catch (error) {
      console.error('[Persistence] Failed to load player state:', error);
      return null;
    }
  }

  // UGC app storage
  async setAppData(appId: string, key: string, value: any, playerId?: string): Promise<void> {
    try {
      const existing = await this.db
        .select()
        .from(ugcAppStorage)
        .where(
          and(
            eq(ugcAppStorage.appId, appId),
            eq(ugcAppStorage.worldId, this.worldId),
            eq(ugcAppStorage.key, key),
            playerId ? eq(ugcAppStorage.playerId, playerId) : eq(ugcAppStorage.playerId, '')
          )
        )
        .limit(1);

      const data = {
        appId,
        worldId: this.worldId,
        key,
        value: JSON.stringify(value),
        playerId: playerId || null,
        updatedAt: new Date().toISOString()
      };

      if (existing.length > 0) {
        await this.db
          .update(ugcAppStorage)
          .set(data)
          .where(
            and(
              eq(ugcAppStorage.appId, appId),
              eq(ugcAppStorage.worldId, this.worldId),
              eq(ugcAppStorage.key, key),
              playerId ? eq(ugcAppStorage.playerId, playerId) : eq(ugcAppStorage.playerId, '')
            )
          );
      } else {
        await this.db.insert(ugcAppStorage).values({
          ...data,
          createdAt: new Date().toISOString()
        });
      }

      console.log(`[Persistence] Saved app data: ${appId}:${key}`);
    } catch (error) {
      console.error('[Persistence] Failed to save app data:', error);
    }
  }

  async getAppData(appId: string, key: string, playerId?: string): Promise<any> {
    try {
      const result = await this.db
        .select()
        .from(ugcAppStorage)
        .where(
          and(
            eq(ugcAppStorage.appId, appId),
            eq(ugcAppStorage.worldId, this.worldId),
            eq(ugcAppStorage.key, key),
            playerId ? eq(ugcAppStorage.playerId, playerId) : eq(ugcAppStorage.playerId, '')
          )
        )
        .limit(1);

      if (result.length === 0) {return null;}

      return JSON.parse(result[0].value || 'null');
    } catch (error) {
      console.error('[Persistence] Failed to get app data:', error);
      return null;
    }
  }

  // World state
  async saveWorldState(state: WorldStateData): Promise<void> {
    try {
      const existing = await this.db
        .select()
        .from(worldState)
        .where(eq(worldState.worldId, this.worldId))
        .limit(1);

      const data = {
        worldId: this.worldId,
        state: JSON.stringify(state),
        updatedAt: new Date().toISOString()
      };

      if (existing.length > 0) {
        await this.db
          .update(worldState)
          .set(data)
          .where(eq(worldState.worldId, this.worldId));
      } else {
        await this.db.insert(worldState).values({
          ...data,
          createdAt: new Date().toISOString()
        });
      }

      console.log('[Persistence] Saved world state');
    } catch (error) {
      console.error('[Persistence] Failed to save world state:', error);
    }
  }

  async loadWorldState(): Promise<WorldStateData | null> {
    try {
      const result = await this.db
        .select()
        .from(worldState)
        .where(eq(worldState.worldId, this.worldId))
        .limit(1);

      if (result.length === 0) {return null;}

      return JSON.parse(result[0].state || '{}');
    } catch (error) {
      console.error('[Persistence] Failed to load world state:', error);
      return null;
    }
  }

  // Session management
  async createSession(playerId: string): Promise<string> {
    const sessionId = uuid();

    try {
      await this.db.insert(playerSessions).values({
        id: sessionId,
        playerId,
        worldId: this.worldId,
        connectedAt: new Date().toISOString()
      });

      // Update last seen
      await this.db
        .update(players)
        .set({ lastSeen: new Date().toISOString() })
        .where(eq(players.id, playerId));

      return sessionId;
    } catch (error) {
      console.error('[Persistence] Failed to create session:', error);
      return sessionId;
    }
  }

  async endSession(sessionId: string): Promise<void> {
    try {
      await this.db
        .update(playerSessions)
        .set({ disconnectedAt: new Date().toISOString() })
        .where(eq(playerSessions.id, sessionId));
    } catch (error) {
      console.error('[Persistence] Failed to end session:', error);
    }
  }

  // Player management
  async createOrUpdatePlayer(playerId: string, username: string): Promise<void> {
    try {
      const existing = await this.db
        .select()
        .from(players)
        .where(eq(players.id, playerId))
        .limit(1);

      if (existing.length > 0) {
        await this.db
          .update(players)
          .set({
            username,
            lastSeen: new Date().toISOString()
          })
          .where(eq(players.id, playerId));
      } else {
        await this.db.insert(players).values({
          id: playerId,
          username,
          createdAt: new Date().toISOString(),
          lastSeen: new Date().toISOString()
        });
      }
    } catch (error) {
      console.error('[Persistence] Failed to create/update player:', error);
    }
  }

  // Batch operations
  queueBatchOperation(operation: any) {
    const key = `${operation.type}:${operation.id}`;
    this.batchQueue.set(key, operation);
  }

  private async processBatchQueue() {
    if (this.batchQueue.size === 0) {return;}

    const operations = Array.from(this.batchQueue.values());
    this.batchQueue.clear();

    for (const op of operations) {
      try {
        switch (op.type) {
          case 'playerState':
            await this.savePlayerState(op.id, op.data);
            break;
          case 'appData':
            await this.setAppData(op.appId, op.key, op.value, op.playerId);
            break;
          // Add more batch operation types as needed
        }
      } catch (error) {
        console.error('[Persistence] Batch operation failed:', error);
      }
    }
  }

  // Helper methods for entities
  private async saveAllPlayerStates() {
    const world = this.world as any;
    const entities = world.getSystem('entities');
    if (!entities) {return;}

    // Use getAllPlayers() method from the Entities system
    const playerEntities = entities.getAllPlayers ? entities.getAllPlayers() : [];

    for (const player of playerEntities) {
      const p = player as any;
      if (p.id && p.position && p.health !== undefined) {
        this.queueBatchOperation({
          type: 'playerState',
          id: p.id,
          data: {
            position: p.position,
            rotation: { y: p.rotation?.y || 0 },
            health: p.health
          }
        });
      }
    }
  }

  // System lifecycle
  tick(dt: number) {
    // Handle any real-time persistence needs
  }

  cleanup() {
    // Clear timers
    this.saveTimers.forEach(timer => clearTimeout(timer));
    if (this.batchTimer) {clearInterval(this.batchTimer);}

    // Process remaining batch operations
    this.processBatchQueue();
  }

  // Public API for UGC apps
  getStorage(appId: string) {
    return {
      set: (key: string, value: any, options?: StorageOptions) =>
        this.setAppData(appId, key, value),
      get: (key: string) =>
        this.getAppData(appId, key),
      setPlayerData: (playerId: string, key: string, value: any) =>
        this.setAppData(appId, key, value, playerId),
      getPlayerData: (playerId: string, key: string) =>
        this.getAppData(appId, key, playerId)
    };
  }

  // =================
  // RPG PERSISTENCE
  // =================

  // Player skills
  async savePlayerSkills(playerId: string, skills: Array<{ type: string; level: number; experience: number }>): Promise<void> {
    try {
      await this.db.transaction(async (tx: any) => {
        // Delete existing skills
        await tx
          .delete(playerSkills)
          .where(
            and(
              eq(playerSkills.playerId, playerId),
              eq(playerSkills.worldId, this.worldId)
            )
          );

        // Insert new skills
        for (const skill of skills) {
          await tx.insert(playerSkills).values({
            playerId,
            worldId: this.worldId,
            skillType: skill.type,
            level: skill.level,
            experience: skill.experience,
            updatedAt: new Date().toISOString()
          });
        }
      });

      console.log(`[Persistence] Saved skills for player ${playerId}`);
    } catch (error) {
      console.error('[Persistence] Failed to save skills:', error);
    }
  }

  async loadPlayerSkills(playerId: string): Promise<Array<{ type: string; level: number; experience: number }>> {
    try {
      const skills = await this.db
        .select()
        .from(playerSkills)
        .where(
          and(
            eq(playerSkills.playerId, playerId),
            eq(playerSkills.worldId, this.worldId)
          )
        );

      return skills.map((s: PlayerSkills) => ({
        type: s.skillType,
        level: s.level || 1,
        experience: s.experience || 0
      }));
    } catch (error) {
      console.error('[Persistence] Failed to load skills:', error);
      return [];
    }
  }

  // Player inventory
  async savePlayerInventory(playerId: string, inventory: Array<{ slot: number; itemId: number; quantity: number; metadata?: any }>): Promise<void> {
    try {
      await this.db.transaction(async (tx: any) => {
        // Delete existing inventory
        await tx
          .delete(playerInventory)
          .where(
            and(
              eq(playerInventory.playerId, playerId),
              eq(playerInventory.worldId, this.worldId)
            )
          );

        // Insert new inventory
        for (const item of inventory) {
          if (item.itemId && item.quantity > 0) {
            await tx.insert(playerInventory).values({
              playerId,
              worldId: this.worldId,
              slot: item.slot,
              itemId: item.itemId,
              quantity: item.quantity,
              metadata: item.metadata ? JSON.stringify(item.metadata) : null
            });
          }
        }
      });

      console.log(`[Persistence] Saved inventory for player ${playerId}`);
    } catch (error) {
      console.error('[Persistence] Failed to save inventory:', error);
    }
  }

  async loadPlayerInventory(playerId: string): Promise<Array<{ slot: number; itemId: number; quantity: number; metadata?: any }>> {
    try {
      const items = await this.db
        .select()
        .from(playerInventory)
        .where(
          and(
            eq(playerInventory.playerId, playerId),
            eq(playerInventory.worldId, this.worldId)
          )
        );

      return items.map((i: PlayerInventory) => ({
        slot: i.slot,
        itemId: i.itemId,
        quantity: i.quantity || 1,
        metadata: i.metadata ? JSON.parse(i.metadata) : undefined
      }));
    } catch (error) {
      console.error('[Persistence] Failed to load inventory:', error);
      return [];
    }
  }

  // Player equipment
  async savePlayerEquipment(playerId: string, equipment: Array<{ slot: string; itemId: number; metadata?: any }>): Promise<void> {
    try {
      await this.db.transaction(async (tx: any) => {
        // Delete existing equipment
        await tx
          .delete(playerEquipment)
          .where(
            and(
              eq(playerEquipment.playerId, playerId),
              eq(playerEquipment.worldId, this.worldId)
            )
          );

        // Insert new equipment
        for (const item of equipment) {
          if (item.itemId) {
            await tx.insert(playerEquipment).values({
              playerId,
              worldId: this.worldId,
              slot: item.slot,
              itemId: item.itemId,
              metadata: item.metadata ? JSON.stringify(item.metadata) : null
            });
          }
        }
      });

      console.log(`[Persistence] Saved equipment for player ${playerId}`);
    } catch (error) {
      console.error('[Persistence] Failed to save equipment:', error);
    }
  }

  async loadPlayerEquipment(playerId: string): Promise<Array<{ slot: string; itemId: number; metadata?: any }>> {
    try {
      const items = await this.db
        .select()
        .from(playerEquipment)
        .where(
          and(
            eq(playerEquipment.playerId, playerId),
            eq(playerEquipment.worldId, this.worldId)
          )
        );

      return items.map((i: PlayerEquipment) => ({
        slot: i.slot,
        itemId: i.itemId,
        metadata: i.metadata ? JSON.parse(i.metadata) : undefined
      }));
    } catch (error) {
      console.error('[Persistence] Failed to load equipment:', error);
      return [];
    }
  }

  // Player bank
  async savePlayerBank(playerId: string, bank: Array<{ itemId: number; quantity: number }>): Promise<void> {
    try {
      await this.db.transaction(async (tx: any) => {
        // Delete existing bank items
        await tx
          .delete(playerBank)
          .where(
            and(
              eq(playerBank.playerId, playerId),
              eq(playerBank.worldId, this.worldId)
            )
          );

        // Insert new bank items
        for (const item of bank) {
          if (item.quantity > 0) {
            await tx.insert(playerBank).values({
              playerId,
              worldId: this.worldId,
              itemId: item.itemId,
              quantity: item.quantity
            });
          }
        }
      });

      console.log(`[Persistence] Saved bank for player ${playerId}`);
    } catch (error) {
      console.error('[Persistence] Failed to save bank:', error);
    }
  }

  async loadPlayerBank(playerId: string): Promise<Array<{ itemId: number; quantity: number }>> {
    try {
      const items = await this.db
        .select()
        .from(playerBank)
        .where(
          and(
            eq(playerBank.playerId, playerId),
            eq(playerBank.worldId, this.worldId)
          )
        );

      return items.map((i: PlayerBank) => ({
        itemId: i.itemId,
        quantity: i.quantity || 0
      }));
    } catch (error) {
      console.error('[Persistence] Failed to load bank:', error);
      return [];
    }
  }

  // Player quests
  async savePlayerQuests(playerId: string, quests: Array<{ questId: string; status: string; progress?: any; startedAt?: string; completedAt?: string }>): Promise<void> {
    try {
      await this.db.transaction(async (tx: any) => {
        for (const quest of quests) {
          await tx
            .insert(playerQuests)
            .values({
              playerId,
              worldId: this.worldId,
              questId: quest.questId,
              status: quest.status,
              progress: quest.progress ? JSON.stringify(quest.progress) : null,
              startedAt: quest.startedAt,
              completedAt: quest.completedAt
            })
            .onConflictDoUpdate({
              target: [playerQuests.playerId, playerQuests.worldId, playerQuests.questId],
              set: {
                status: quest.status,
                progress: quest.progress ? JSON.stringify(quest.progress) : null,
                completedAt: quest.completedAt
              }
            });
        }
      });

      console.log(`[Persistence] Saved quests for player ${playerId}`);
    } catch (error) {
      console.error('[Persistence] Failed to save quests:', error);
    }
  }

  async loadPlayerQuests(playerId: string): Promise<Array<{ questId: string; status: string; progress?: any; startedAt?: string; completedAt?: string }>> {
    try {
      const quests = await this.db
        .select()
        .from(playerQuests)
        .where(
          and(
            eq(playerQuests.playerId, playerId),
            eq(playerQuests.worldId, this.worldId)
          )
        );

      return quests.map((q: PlayerQuest) => ({
        questId: q.questId,
        status: q.status || 'not_started',
        progress: q.progress ? JSON.parse(q.progress) : undefined,
        startedAt: q.startedAt || undefined,
        completedAt: q.completedAt || undefined
      }));
    } catch (error) {
      console.error('[Persistence] Failed to load quests:', error);
      return [];
    }
  }

  // World entities
  async saveWorldEntity(entity: { entityId: string; entityType: string; position: { x: number; y: number; z: number }; data?: any; respawnAt?: string }): Promise<void> {
    try {
      await this.db
        .insert(worldEntities)
        .values({
          entityId: entity.entityId,
          worldId: this.worldId,
          entityType: entity.entityType,
          positionX: entity.position.x,
          positionY: entity.position.y,
          positionZ: entity.position.z,
          data: entity.data ? JSON.stringify(entity.data) : null,
          respawnAt: entity.respawnAt,
          updatedAt: new Date().toISOString()
        })
        .onConflictDoUpdate({
          target: worldEntities.entityId,
          set: {
            positionX: entity.position.x,
            positionY: entity.position.y,
            positionZ: entity.position.z,
            data: entity.data ? JSON.stringify(entity.data) : null,
            respawnAt: entity.respawnAt,
            updatedAt: new Date().toISOString()
          }
        });

      console.log(`[Persistence] Saved entity ${entity.entityId}`);
    } catch (error) {
      console.error('[Persistence] Failed to save entity:', error);
    }
  }

  async loadWorldEntities(): Promise<Array<{ entityId: string; entityType: string; position: { x: number; y: number; z: number }; data?: any; respawnAt?: string }>> {
    try {
      const entities = await this.db
        .select()
        .from(worldEntities)
        .where(eq(worldEntities.worldId, this.worldId));

      return entities.map((e: WorldEntity) => ({
        entityId: e.entityId,
        entityType: e.entityType,
        position: {
          x: e.positionX || 0,
          y: e.positionY || 0,
          z: e.positionZ || 0
        },
        data: e.data ? JSON.parse(e.data) : undefined,
        respawnAt: e.respawnAt || undefined
      }));
    } catch (error) {
      console.error('[Persistence] Failed to load entities:', error);
      return [];
    }
  }

  // Ground items
  async saveGroundItem(item: { itemType: number; position: { x: number; y: number; z: number }; quantity: number; ownerId?: string; expiresAt?: string }): Promise<string> {
    const itemId = uuid();

    try {
      await this.db.insert(worldItems).values({
        itemId,
        worldId: this.worldId,
        itemType: item.itemType,
        positionX: item.position.x,
        positionY: item.position.y,
        positionZ: item.position.z,
        quantity: item.quantity,
        ownerId: item.ownerId,
        expiresAt: item.expiresAt
      });

      console.log(`[Persistence] Saved ground item ${itemId}`);
      return itemId;
    } catch (error) {
      console.error('[Persistence] Failed to save ground item:', error);
      return itemId;
    }
  }

  async loadGroundItems(): Promise<Array<{ itemId?: string; itemType: number; position: { x: number; y: number; z: number }; quantity: number; ownerId?: string; expiresAt?: string }>> {
    try {
      const items = await this.db
        .select()
        .from(worldItems)
        .where(eq(worldItems.worldId, this.worldId));

      return items.map((i: WorldItem) => ({
        itemId: i.itemId,
        itemType: i.itemType,
        position: {
          x: i.positionX || 0,
          y: i.positionY || 0,
          z: i.positionZ || 0
        },
        quantity: i.quantity || 1,
        ownerId: i.ownerId || undefined,
        expiresAt: i.expiresAt || undefined
      }));
    } catch (error) {
      console.error('[Persistence] Failed to load ground items:', error);
      return [];
    }
  }

  // Market data
  async saveGrandExchangeOffer(offer: { playerId: string; itemId: number; offerType: 'buy' | 'sell'; quantity: number; pricePerItem: number }): Promise<string> {
    const offerId = uuid();

    try {
      await this.db.insert(grandExchangeOffers).values({
        offerId,
        playerId: offer.playerId,
        worldId: this.worldId,
        itemId: offer.itemId,
        offerType: offer.offerType,
        quantity: offer.quantity,
        pricePerItem: offer.pricePerItem,
        quantityFilled: 0,
        status: 'active'
      });

      console.log(`[Persistence] Saved GE offer ${offerId}`);
      return offerId;
    } catch (error) {
      console.error('[Persistence] Failed to save GE offer:', error);
      return offerId;
    }
  }

  async loadActiveOffers(): Promise<GrandExchangeOffer[]> {
    try {
      const offers = await this.db
        .select()
        .from(grandExchangeOffers)
        .where(
          and(
            eq(grandExchangeOffers.worldId, this.worldId),
            eq(grandExchangeOffers.status, 'active')
          )
        );

      return offers;
    } catch (error) {
      console.error('[Persistence] Failed to load offers:', error);
      return [];
    }
  }
}
