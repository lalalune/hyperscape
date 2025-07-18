import { System } from './System';
import { Entity } from '../entities/Entity';
import { PersistenceSystem } from './Persistence';

export interface ChunkCoordinate {
  x: number;
  z: number;
  key: string;
}

export interface WorldChunk {
  key: string;
  bounds: {
    minX: number;
    minZ: number;
    maxX: number;
    maxZ: number;
  };
  entities: Map<string, Entity>;
  isDirty: boolean;
  lastModified: number;
  playerCount: number;
}

export interface EntityChange {
  type: string;
  data: any;
  timestamp: number;
}

export class WorldStateManager extends System {
  private chunks: Map<string, WorldChunk> = new Map();
  private dirtyChunks: Set<string> = new Set();
  private chunkSize: number = 64; // 64x64 units per chunk
  private saveInterval: number = 5000; // Save every 5 seconds
  private lastSave: number = 0;
  private persistence: PersistenceSystem;

  constructor(world: any) {
    super(world);
    this.persistence = world.getSystem('persistence') as PersistenceSystem;
  }

  // Get chunk coordinate from world position
  private getChunkCoord(position: { x: number; z: number }): ChunkCoordinate {
    const x = Math.floor(position.x / this.chunkSize);
    const z = Math.floor(position.z / this.chunkSize);
    const key = `${x},${z}`;
    return { x, z, key };
  }

  // Get or create chunk
  getChunk(position: { x: number; z: number }): WorldChunk {
    const coord = this.getChunkCoord(position);

    if (!this.chunks.has(coord.key)) {
      const chunk: WorldChunk = {
        key: coord.key,
        bounds: {
          minX: coord.x * this.chunkSize,
          minZ: coord.z * this.chunkSize,
          maxX: (coord.x + 1) * this.chunkSize,
          maxZ: (coord.z + 1) * this.chunkSize
        },
        entities: new Map(),
        isDirty: false,
        lastModified: Date.now(),
        playerCount: 0
      };
      this.chunks.set(coord.key, chunk);
    }

    return this.chunks.get(coord.key)!;
  }

  // Register entity in chunk system
  registerEntity(entity: Entity) {
    const chunk = this.getChunk(entity.position);
    chunk.entities.set(entity.id, entity);

    // Add persistence metadata if not present
    if (!(entity as any).persistenceId) {
      (entity as any).persistenceId = entity.id;
      (entity as any).shouldPersist = true;
      (entity as any).isDirty = false;
    }
  }

  // Track entity movement between chunks
  updateEntityPosition(entity: Entity, oldPosition: { x: number; z: number }) {
    const oldChunk = this.getChunk(oldPosition);
    const newChunk = this.getChunk(entity.position);

    if (oldChunk.key !== newChunk.key) {
      oldChunk.entities.delete(entity.id);
      newChunk.entities.set(entity.id, entity);

      // Mark both chunks as dirty
      this.markChunkDirty(oldChunk);
      this.markChunkDirty(newChunk);
    }
  }

  // Mark entity as changed
  markEntityDirty(entity: Entity, changes?: EntityChange[]) {
    (entity as any).isDirty = true;
    (entity as any).lastModified = Date.now();

    const chunk = this.getChunk(entity.position);
    this.markChunkDirty(chunk);

    // Broadcast changes to nearby players
    if (changes) {
      this.broadcastEntityChanges(entity, changes);
    }
  }

  // Mark chunk as needing save
  private markChunkDirty(chunk: WorldChunk) {
    chunk.isDirty = true;
    chunk.lastModified = Date.now();
    this.dirtyChunks.add(chunk.key);
  }

  // Broadcast entity changes to nearby players
  private broadcastEntityChanges(entity: Entity, changes: EntityChange[]) {
    const chunk = this.getChunk(entity.position);
    const nearbyChunks = this.getNearbyChunks(chunk.key);

    // Get all players in nearby chunks
    const players: Entity[] = [];
    for (const nearbyChunk of nearbyChunks) {
      for (const [id, ent] of nearbyChunk.entities) {
        if (ent.isPlayer) {
          players.push(ent);
        }
      }
    }

    // Send updates via network system
    const network = this.world.getSystem('network');
    if (network) {
      for (const player of players) {
        if (this.canSee(player, entity)) {
          (network as any).send('entityUpdate', {
            entityId: entity.id,
            changes,
            timestamp: Date.now()
          });
        }
      }
    }
  }

  // Get chunks around a given chunk
  private getNearbyChunks(chunkKey: string): WorldChunk[] {
    const [x, z] = chunkKey.split(',').map(Number);
    const nearby: WorldChunk[] = [];

    // Get 3x3 grid of chunks
    for (let dx = -1; dx <= 1; dx++) {
      for (let dz = -1; dz <= 1; dz++) {
        const key = `${x + dx},${z + dz}`;
        const chunk = this.chunks.get(key);
        if (chunk) {
          nearby.push(chunk);
        }
      }
    }

    return nearby;
  }

  // Simple visibility check
  private canSee(observer: Entity, target: Entity): boolean {
    const distance = Math.sqrt(
      Math.pow(observer.position.x - target.position.x, 2) +
      Math.pow(observer.position.z - target.position.z, 2)
    );
    return distance < 100; // 100 unit view distance
  }

  // Save all dirty chunks
  private async saveWorldState() {
    if (this.dirtyChunks.size === 0) {return;}

    console.log(`[WorldStateManager] Saving ${this.dirtyChunks.size} dirty chunks`);

    for (const chunkKey of this.dirtyChunks) {
      const chunk = this.chunks.get(chunkKey);
      if (!chunk) {continue;}

      // Collect all dirty entities in chunk
      const dirtyEntities: Entity[] = [];
      for (const [id, entity] of chunk.entities) {
        if ((entity as any).isDirty && (entity as any).shouldPersist) {
          dirtyEntities.push(entity);
        }
      }

      if (dirtyEntities.length > 0) {
        // Save entities through persistence system
        const storage = this.persistence.getStorage('world');
        await storage.set(`chunk_${chunkKey}`, {
          entities: dirtyEntities.map(e => e.serialize()),
          lastModified: chunk.lastModified
        });

        // Clear dirty flags
        for (const entity of dirtyEntities) {
          (entity as any).isDirty = false;
        }
      }

      chunk.isDirty = false;
    }

    this.dirtyChunks.clear();
    this.lastSave = Date.now();
  }

  // Load world state on startup
  async loadWorldState() {
    console.log('[WorldStateManager] Loading world state...');

    const storage = this.persistence.getStorage('world');

    // Load spawn area chunks first
    const spawnChunks = [
      '0,0', '0,1', '1,0', '1,1',
      '-1,0', '-1,1', '0,-1', '1,-1', '-1,-1'
    ];

    for (const chunkKey of spawnChunks) {
      const chunkData = await storage.get(`chunk_${chunkKey}`);
      if (chunkData) {
        await this.loadChunk(chunkKey, chunkData);
      }
    }

    console.log('[WorldStateManager] World state loaded');
  }

  // Load a single chunk
  private async loadChunk(chunkKey: string, chunkData: any) {
    const chunk = this.getChunk({
      x: parseInt(chunkKey.split(',')[0]) * this.chunkSize + 1,
      z: parseInt(chunkKey.split(',')[1]) * this.chunkSize + 1
    });

    // Deserialize entities
    for (const entityData of chunkData.entities) {
      const entity = await (this.world as any).entities.deserialize([entityData]);
      if (entity) {
        this.registerEntity(entity[0]);
      }
    }

    chunk.lastModified = chunkData.lastModified;
  }

  // Update loop
  tick(dt: number) {
    // Save world state periodically
    if (Date.now() - this.lastSave > this.saveInterval) {
      this.saveWorldState();
    }
  }

  // Cleanup
  cleanup() {
    // Save any remaining changes
    this.saveWorldState();
  }
}
