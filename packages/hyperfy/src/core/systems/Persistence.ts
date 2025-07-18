import { System } from './System';
import { Entity } from '../entities/Entity';
import { drizzle } from 'drizzle-orm/bun-sqlite';
import { Database } from 'bun:sqlite';
import { eq, and } from 'drizzle-orm';
import { uuid } from '../utils';
import {
  players,
  playerStates,
  playerWorldState,
  ugcAppStorage,
  worldState,
  playerSessions,
  entityStates,
  nodeStates,
  type Player,
  type PlayerState,
  type EntityState,
  type WorldState,
  type UgcAppStorage,
  type PlayerSession,
  type NodeState
} from '../../server/db-persistence-schema';

interface PersistedPlayerState {
  position: { x: number; y: number; z: number };
  rotation: { x: number; y: number; z: number; w: number };
  health?: number;
  [key: string]: any; // Allow any custom state
}

export interface WorldStateData {
  entities: any[];
  nodes: any[];
}

/**
 * Handles persistence for world state, entities, and players
 */
export class PersistenceSystem extends System {
  private db: ReturnType<typeof drizzle>;
  private sqliteDb: Database;
  private worldId: string;
  
  constructor(world: any) {
    super(world);
    this.worldId = world.id || 'default';
  }

  async init(options: any): Promise<void> {
    // Initialize SQLite database
    const dbPath = options.dbPath || './persistence.db';
    this.sqliteDb = new Database(dbPath);
    this.db = drizzle(this.sqliteDb);
    
    console.log('[Persistence] Initialized with database:', dbPath);
  }

  destroy(): void {
    if (this.sqliteDb) {
      this.sqliteDb.close();
    }
  }

  // Player state management
  async savePlayerState(playerId: string, state: PersistedPlayerState): Promise<void> {
    try {
      const playerData = {
        id: uuid(),
        playerId,
        worldId: this.worldId,
        username: playerId, // TODO: Get actual username
        position: JSON.stringify(state.position),
        rotation: JSON.stringify(state.rotation),
        state: state.health ? JSON.stringify({ health: state.health }) : null
      };

      // Check if player state exists
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

      if (existing.length > 0) {
        await this.db
          .update(playerStates)
          .set({
            position: playerData.position,
            rotation: playerData.rotation,
            state: playerData.state
          })
          .where(
            and(
              eq(playerStates.playerId, playerId),
              eq(playerStates.worldId, this.worldId)
            )
          );
      } else {
        await this.db.insert(playerStates).values(playerData);
      }

      console.log(`[Persistence] Saved player state for ${playerId}`);
    } catch (error) {
      console.error('[Persistence] Failed to save player state:', error);
    }
  }

  async loadPlayerState(playerId: string): Promise<PersistedPlayerState | null> {
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

      if (result.length === 0) return null;

      const state = result[0];
      const position = JSON.parse(state.position);
      const rotation = JSON.parse(state.rotation);
      const customState = state.state ? JSON.parse(state.state) : {};

      return {
        position,
        rotation,
        customState
      };
    } catch (error) {
      console.error('[Persistence] Failed to load player state:', error);
      return null;
    }
  }

  // Entity state management
  async saveEntity(entity: Entity): Promise<void> {
    try {
      const serialized = entity.serialize();
      const entityData = {
        id: uuid(),
        entityId: entity.id,
        worldId: this.worldId,
        playerId: entity.isPlayer ? entity.id : null,
        position: JSON.stringify(entity.position),
        rotation: JSON.stringify(entity.rotation),
        components: JSON.stringify(Array.from(entity.components.entries())),
        metadata: JSON.stringify({
          type: entity.type,
          name: entity.name,
          data: serialized
        })
      };

      // Check if entity exists
      const existing = await this.db
        .select()
        .from(entityStates)
        .where(
          and(
            eq(entityStates.entityId, entity.id),
            eq(entityStates.worldId, this.worldId)
          )
        )
        .limit(1);

      if (existing.length > 0) {
        await this.db
          .update(entityStates)
          .set({
            position: entityData.position,
            rotation: entityData.rotation,
            components: entityData.components,
            metadata: entityData.metadata
          })
          .where(
            and(
              eq(entityStates.entityId, entity.id),
              eq(entityStates.worldId, this.worldId)
            )
          );
      } else {
        await this.db.insert(entityStates).values(entityData);
      }
    } catch (error) {
      console.error('[Persistence] Failed to save entity:', error);
    }
  }

  async loadEntities(): Promise<EntityState[]> {
    try {
      const result = await this.db
        .select()
        .from(entityStates)
        .where(eq(entityStates.worldId, this.worldId));

      return result;
    } catch (error) {
      console.error('[Persistence] Failed to load entities:', error);
      return [];
    }
  }

  // Node state management
  async saveNode(node: any): Promise<void> {
    try {
      const nodeData = {
        id: uuid(),
        nodeId: node.id || uuid(),
        worldId: this.worldId,
        parentId: node.parent?.id || null,
        position: JSON.stringify(node.position || { x: 0, y: 0, z: 0 }),
        rotation: JSON.stringify(node.rotation || { x: 0, y: 0, z: 0 }),
        scale: JSON.stringify(node.scale || { x: 1, y: 1, z: 1 }),
        properties: JSON.stringify(node.properties || {}),
        metadata: JSON.stringify({
          type: node.type || 'unknown',
          name: node.name
        })
      };

      // Check if node exists
      const existing = await this.db
        .select()
        .from(nodeStates)
        .where(
          and(
            eq(nodeStates.nodeId, nodeData.nodeId),
            eq(nodeStates.worldId, this.worldId)
          )
        )
        .limit(1);

      if (existing.length > 0) {
        await this.db
          .update(nodeStates)
          .set({
            parentId: nodeData.parentId,
            position: nodeData.position,
            rotation: nodeData.rotation,
            scale: nodeData.scale,
            properties: nodeData.properties,
            metadata: nodeData.metadata
          })
          .where(
            and(
              eq(nodeStates.nodeId, nodeData.nodeId),
              eq(nodeStates.worldId, this.worldId)
            )
          );
      } else {
        await this.db.insert(nodeStates).values(nodeData);
      }
    } catch (error) {
      console.error('[Persistence] Failed to save node:', error);
    }
  }

  async loadNodes(): Promise<NodeState[]> {
    try {
      const result = await this.db
        .select()
        .from(nodeStates)
        .where(eq(nodeStates.worldId, this.worldId));

      return result;
    } catch (error) {
      console.error('[Persistence] Failed to load nodes:', error);
      return [];
    }
  }

  // World state management
  async saveWorldState(data: WorldStateData): Promise<void> {
    try {
      // Save all entities
      for (const entity of data.entities) {
        await this.saveEntity(entity);
      }

      // Save all nodes
      for (const node of data.nodes) {
        await this.saveNode(node);
      }

      console.log('[Persistence] Saved world state');
    } catch (error) {
      console.error('[Persistence] Failed to save world state:', error);
    }
  }

  async loadWorldState(): Promise<WorldStateData> {
    try {
      const entities = await this.loadEntities();
      const nodes = await this.loadNodes();

      return {
        entities: entities as any[],
        nodes: nodes as any[]
      };
    } catch (error) {
      console.error('[Persistence] Failed to load world state:', error);
      return {
        entities: [],
        nodes: []
      };
    }
  }

  // Public API for UGC apps
  getStorage(appId: string) {
    return {
      set: async (key: string, value: any) => {
        // Store as metadata in a node
        const nodeId = `storage_${appId}_${key}`;
        await this.saveNode({
          id: nodeId,
          type: 'storage',
          name: key,
          properties: { appId, key, value }
        });
      },
      get: async (key: string) => {
        // Retrieve from nodes
        const nodes = await this.loadNodes();
        const storageNode = nodes.find(n => {
          try {
            const props = JSON.parse(n.properties);
            return props.appId === appId && props.key === key;
          } catch {
            return false;
          }
        });
        
        if (storageNode) {
          const props = JSON.parse(storageNode.properties);
          return props.value;
        }
        return null;
      }
    };
  }
}
