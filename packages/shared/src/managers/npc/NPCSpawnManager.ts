
import type { World } from '../../types';
import { ALL_WORLD_AREAS } from '../../data/world-areas';
import {
  Position3D,
  RespawnTask,
  SpawnPoint
} from '../../types';
import type { NPCSystem } from '../../systems/NPCSystem';
import { TerrainSystem } from '../../systems/TerrainSystem';

export class NPCSpawnManager {
  private world: World;
  private npcSystem: NPCSystem;
  private spawnPoints: Map<string, SpawnPoint> = new Map();
  private respawnQueue: RespawnTask[] = [];
  
  constructor(world: World, npcSystem: NPCSystem, options?: { skipDefaults?: boolean }) {
    this.world = world;
    this.npcSystem = npcSystem;
    if (!options?.skipDefaults) {
      this.registerDefaultSpawnPoints();
    }
  }
  
  /**
   * Update spawn points and respawn queue
   */
  update(_delta: number): void {
    const now = Date.now();
    
    // Process respawn queue
    const tasksToProcess = this.respawnQueue.filter(task => now >= task.scheduledTime);
    for (const task of tasksToProcess) {
      this.processRespawn(task);
    }
    
    // Remove processed tasks
    this.respawnQueue = this.respawnQueue.filter(task => now < task.scheduledTime);
    
    // Check spawn points
    for (const [_id, spawnPoint] of this.spawnPoints) {
      if (!spawnPoint.active) continue;
      
      // Check if we need to spawn more NPCs
      if (spawnPoint.currentCount < spawnPoint.maxCount) {
        // Check if enough time has passed
        if (now - spawnPoint.lastSpawnTime >= spawnPoint.respawnTime) {
          this.spawnAtPoint(spawnPoint);
        }
      }
    }
  }
  
  /**
   * Register a spawn point
   */
  registerSpawnPoint(config: {
    id: string;
    position: Position3D;
    npcId: number;
    maxCount?: number;
    respawnTime?: number;
    radius?: number;
  }): void {
    const spawnPoint: SpawnPoint = {
      id: config.id,
      position: config.position,
      npcId: config.npcId,
      maxCount: config.maxCount || 1,
      respawnTime: config.respawnTime || 60000, // 1 minute default
      radius: config.radius || 5,
      active: true,
      currentCount: 0,
      lastSpawnTime: 0
    };
    
    this.spawnPoints.set(config.id, spawnPoint);
    
    // Initial spawn
    for (let i = 0; i < spawnPoint.maxCount; i++) {
      this.spawnAtPoint(spawnPoint);
    }
  }
  
  /**
   * Schedule a respawn
   */
  scheduleRespawn(spawnerId: string, npcId: number, respawnTime: number): void {
    const task: RespawnTask = {
      spawnerId,
      npcId,
      respawnTime,
      scheduledTime: Date.now() + respawnTime
    };
    
    this.respawnQueue.push(task);
    
    // Update spawn point count
    const spawnPoint = this.spawnPoints.get(spawnerId);
    if (spawnPoint) {
      spawnPoint.currentCount = Math.max(0, spawnPoint.currentCount - 1);
    }
  }
  
  /**
   * Activate/deactivate spawn point
   */
  setSpawnPointActive(spawnerId: string, active: boolean): void {
    const spawnPoint = this.spawnPoints.get(spawnerId);
    if (spawnPoint) {
      spawnPoint.active = active;
    }
  }
  
  /**
   * Get all spawn points
   */
  getSpawnPoints(): SpawnPoint[] {
    return Array.from(this.spawnPoints.values());
  }
  
  /**
   * Spawn NPC at spawn point
   */
  private spawnAtPoint(spawnPoint: SpawnPoint): void {
    // Calculate random position within radius
    const angle = Math.random() * Math.PI * 2;
    const distance = Math.random() * spawnPoint.radius;
    
    const px = spawnPoint.position.x + Math.cos(angle) * distance
    const pz = spawnPoint.position.z + Math.sin(angle) * distance
    let py = spawnPoint.position.y
    try {
      const terrain = this.world.getSystem<TerrainSystem>('terrain')
      if (terrain) {
        const th = terrain.getHeightAt(px, pz)
        if (Number.isFinite(th)) py = (th as number) + 0.1
      }
    } catch (_e) {}
    const position: Position3D = { x: px, y: py, z: pz };
    
    // Get NPC type for spawning
    const npcType = this.getNPCTypeFromId(spawnPoint.npcId);
    
    // Use NPCSystem to spawn the NPC
    const spawnedNPC = this.npcSystem.spawnNPC({
      npcId: spawnPoint.npcId.toString(),
      name: `${npcType}_${spawnPoint.id}`,
      type: npcType,
      position,
      services: this.getServicesForNPCType(npcType),
      modelPath: this.getModelPathForNPCType(npcType)
    });
    
    // Track the spawn if successful
    if (spawnedNPC) {
      spawnPoint.currentCount++;
      spawnPoint.lastSpawnTime = Date.now();
      
      // Emit world event for test integration and systems listening for spawns
      this.world.emit('mob:spawned', {
        spawnerId: spawnPoint.id,
        npcId: spawnedNPC.id,
        position
      });
    }
  }
  
  /**
   * Process respawn task
   */
  private processRespawn(task: RespawnTask): void {
    const spawnPoint = this.spawnPoints.get(task.spawnerId);
    if (!spawnPoint || !spawnPoint.active) return;
    
    // Spawn the NPC
    this.spawnAtPoint(spawnPoint);
  }
  
  /**
   * Register spawn points from externalized world areas data
   */
  private registerDefaultSpawnPoints(): void {
    // Load NPC spawn points from externalized world areas data
    for (const [areaId, area] of Object.entries(ALL_WORLD_AREAS)) {
      if (area.npcs && area.npcs.length > 0) {
        for (const npc of area.npcs) {
          this.registerSpawnPoint({
            id: `${areaId}_${npc.id}`,
            position: { x: npc.position.x, y: npc.position.y, z: npc.position.z },
            npcId: this.getNPCIdFromType(npc.type), // Convert NPC type to numeric ID
            maxCount: 1, // Most NPCs are unique
            respawnTime: this.getRespawnTimeForNPC(npc.type),
            radius: 0 // NPCs typically don't wander
          });
        }
      }
    }
    
        // Mirror log to console for test expectations
    console.log(`[NPCSpawnManager] Loaded ${this.spawnPoints.size} NPC spawn points from externalized data`);
  }

  /**
   * Convert NPC type to numeric ID (temporary mapping)
   */
  private getNPCIdFromType(npcType: string): number {
    const typeToId: Record<string, number> = {
      'bank': 100,
      'general_store': 101,
      'weapon_store': 102,
      'armor_store': 103,
      'quest_giver': 200,
      'guard': 2,
      'goblin': 1
    };
    return typeToId[npcType] || 999; // Default ID for unknown types
  }

  /**
   * Get respawn time based on NPC type
   */
  private getRespawnTimeForNPC(npcType: string): number {
    const respawnTimes: Record<string, number> = {
      'bank': 0, // Banks don't respawn
      'general_store': 0, // Stores don't respawn
      'weapon_store': 0,
      'armor_store': 0,
      'quest_giver': 0, // Quest givers don't respawn
      'guard': 60000, // Guards respawn in 1 minute
      'goblin': 30000 // Goblins respawn in 30 seconds
    };
    return respawnTimes[npcType] || 300000; // Default 5 minutes
  }

  /**
   * Get NPC type from numeric ID (reverse mapping)
   */
  private getNPCTypeFromId(npcId: number): string {
    const idToType: Record<number, string> = {
      100: 'bank',
      101: 'general_store',
      102: 'weapon_store',
      103: 'armor_store',
      200: 'quest_giver',
      2: 'guard',
      1: 'goblin'
    };
    return idToType[npcId] || 'unknown';
  }

  /**
   * Get services for NPC type
   */
  private getServicesForNPCType(npcType: string): string[] {
    const services: Record<string, string[]> = {
      'bank': ['deposit', 'withdraw'],
      'general_store': ['buy', 'sell'],
      'weapon_store': ['buy', 'sell'],
      'armor_store': ['buy', 'sell'],
      'quest_giver': ['quest'],
      'guard': [],
      'goblin': []
    };
    return services[npcType] || [];
  }

  /**
   * Get model path for NPC type
   */
  private getModelPathForNPCType(npcType: string): string {
    const models: Record<string, string> = {
      'bank': 'asset://models/npcs/banker.glb',
      'general_store': 'asset://models/npcs/merchant.glb',
      'weapon_store': 'asset://models/npcs/blacksmith.glb',
      'armor_store': 'asset://models/npcs/armorer.glb',
      'quest_giver': 'asset://models/npcs/villager.glb',
      'guard': 'asset://models/npcs/guard.glb',
      'goblin': 'asset://models/mobs/goblin.glb'
    };
    return models[npcType] || 'asset://models/npcs/default.glb';
  }
}
