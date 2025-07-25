/**
 * RPG World Content System
 * Generates and manages the actual world content: biomes, NPCs, resources, and positioned entities
 */

import { System } from '../../core/systems/System';
import * as THREE from '../../core/extras/three';
import { 
  ALL_WORLD_AREAS, 
  WorldArea, 
  NPCLocation, 
  BiomeResource, 
  MobSpawnPoint,
  getAreaById,
  getAreaAtPosition,
  PLAYER_SPAWN_POINTS,
  getRandomSpawnPoint
} from '../data/world-areas';
import { ALL_MOBS, MobData } from '../data/mobs';
import { getItem } from '../data/items';

export interface NPCEntity {
  id: string;
  npc: NPCLocation;
  mesh: THREE.Object3D;
  area: WorldArea;
}

export interface ResourceEntity {
  id: string;
  resource: BiomeResource;
  mesh: THREE.Object3D;
  area: WorldArea;
  respawnTime: number;
  isActive: boolean;
}

export interface MobEntity {
  id: string;
  mobData: MobData;
  mesh: THREE.Object3D;
  area: WorldArea;
  spawnPoint: MobSpawnPoint;
  currentHealth: number;
  lastRespawn: number;
  isAlive: boolean;
  homePosition: THREE.Vector3;
}

export interface WorldChunk {
  id: string;
  bounds: { minX: number, maxX: number, minZ: number, maxZ: number };
  area: WorldArea;
  npcs: NPCEntity[];
  resources: ResourceEntity[];
  mobs: MobEntity[];
  terrainMesh?: THREE.Object3D;
  isLoaded: boolean;
}

export class RPGWorldContentSystem extends System {
  private chunks: Map<string, WorldChunk> = new Map();
  private loadedChunks: Set<string> = new Set();
  private playerTracker: Map<string, THREE.Vector3> = new Map();
  private updateInterval: number = 5000; // Update every 5 seconds
  private lastUpdate: number = 0;
  
  // World generation constants
  private readonly CHUNK_SIZE = 80; // Each area becomes a chunk
  private readonly LOAD_DISTANCE = 120; // Load chunks within this distance
  private readonly UNLOAD_DISTANCE = 200; // Unload chunks beyond this distance

  constructor(world: any) {
    super(world);
  }

  /**
   * Initialize the system
   */
  async init(): Promise<void> {
    console.log('[RPGWorldContentSystem] Initializing world content system...');
    
    // Only generate world content on server
    if (this.world?.isServer) {
      await this.initializeWorldContent();
    }
    
    console.log('[RPGWorldContentSystem] World content system initialized');
  }

  /**
   * Initialize all world content
   */
  private async initializeWorldContent(): Promise<void> {
    console.log('[RPGWorldContentSystem] Generating world content...');
    
    // Generate chunks for all world areas
    for (const area of Object.values(ALL_WORLD_AREAS)) {
      await this.generateAreaChunk(area);
    }
    
    // Load initial chunks around spawn points
    for (const spawnPoint of PLAYER_SPAWN_POINTS) {
      this.loadChunksAroundPosition(spawnPoint.x, spawnPoint.z, true);
    }
    
    console.log(`[RPGWorldContentSystem] Generated ${this.chunks.size} world chunks`);
  }

  /**
   * Generate a chunk for a world area
   */
  private async generateAreaChunk(area: WorldArea): Promise<void> {
    const chunkId = `chunk_${area.id}`;
    
    const chunk: WorldChunk = {
      id: chunkId,
      bounds: area.bounds,
      area: area,
      npcs: [],
      resources: [],
      mobs: [],
      isLoaded: false
    };

    // Generate terrain
    await this.generateTerrain(chunk);
    
    // Generate NPCs
    await this.generateNPCs(chunk);
    
    // Generate resources
    await this.generateResources(chunk);
    
    // Generate mob spawn points
    await this.generateMobSpawns(chunk);
    
    this.chunks.set(chunkId, chunk);
    console.log(`[RPGWorldContentSystem] Generated chunk for area: ${area.name}`);
  }

  /**
   * Generate terrain for an area
   */
  private async generateTerrain(chunk: WorldChunk): Promise<void> {
    const area = chunk.area;
    const width = area.bounds.maxX - area.bounds.minX;
    const depth = area.bounds.maxZ - area.bounds.minZ;
    
    // Create terrain geometry
    const geometry = new THREE.PlaneGeometry(width, depth, 32, 32);
    geometry.rotateX(-Math.PI / 2); // Make it horizontal
    
    // Choose material based on biome type
    let material: THREE.Material;
    
    switch (area.biomeType) {
      case 'starter_town':
        material = new THREE.MeshLambertMaterial({ 
          color: 0x90EE90, // Light green for towns
          transparent: true,
          opacity: 0.8
        });
        break;
      case 'misty_forest':
        material = new THREE.MeshLambertMaterial({ 
          color: 0x2F4F2F, // Dark green for misty forest
          transparent: true,
          opacity: 0.7
        });
        break;
      case 'wasteland':
        material = new THREE.MeshLambertMaterial({ 
          color: 0xD2B48C, // Tan for wasteland
          transparent: true,
          opacity: 0.6
        });
        break;
      case 'dark_forest':
        material = new THREE.MeshLambertMaterial({ 
          color: 0x1C1C1C, // Very dark for dark forest
          transparent: true,
          opacity: 0.5
        });
        break;
      case 'plains':
        material = new THREE.MeshLambertMaterial({ 
          color: 0x228B22, // Forest green for plains
          transparent: true,
          opacity: 0.7
        });
        break;
      case 'frozen_tundra':
        material = new THREE.MeshLambertMaterial({ 
          color: 0xF0F8FF, // Alice blue for frozen areas
          transparent: true,
          opacity: 0.8
        });
        break;
      case 'corrupted_wasteland':
        material = new THREE.MeshLambertMaterial({ 
          color: 0x8B0000, // Dark red for corrupted areas
          transparent: true,
          opacity: 0.6
        });
        break;
      case 'ruins':
        material = new THREE.MeshLambertMaterial({ 
          color: 0x696969, // Dim gray for ruins
          transparent: true,
          opacity: 0.7
        });
        break;
      default:
        material = new THREE.MeshLambertMaterial({ 
          color: 0x228B22, // Default green
          transparent: true,
          opacity: 0.7
        });
    }
    
    const terrain = new THREE.Mesh(geometry, material);
    
    // Position terrain at center of area
    const centerX = (area.bounds.minX + area.bounds.maxX) / 2;
    const centerZ = (area.bounds.minZ + area.bounds.maxZ) / 2;
    terrain.position.set(centerX, -0.1, centerZ); // Slightly below ground level
    
    chunk.terrainMesh = terrain;
  }

  /**
   * Generate NPCs for an area
   */
  private async generateNPCs(chunk: WorldChunk): Promise<void> {
    const area = chunk.area;
    
    for (const npcData of area.npcs) {
      const npcEntity = await this.createNPCEntity(npcData, area);
      if (npcEntity) {
        chunk.npcs.push(npcEntity);
      }
    }
  }

  /**
   * Create an NPC entity
   */
  private async createNPCEntity(npcData: NPCLocation, area: WorldArea): Promise<NPCEntity | null> {
    // Create NPC visual representation
    let geometry: THREE.BufferGeometry;
    let material: THREE.Material;
    
    // Different shapes for different NPC types
    switch (npcData.type) {
      case 'bank':
        geometry = new THREE.BoxGeometry(0.8, 1.8, 0.4);
        material = new THREE.MeshLambertMaterial({ 
          color: 0x4169E1, // Royal blue for bankers
          emissive: 0x000040
        });
        break;
      case 'general_store':
        geometry = new THREE.CylinderGeometry(0.4, 0.4, 1.8, 8);
        material = new THREE.MeshLambertMaterial({ 
          color: 0xDAA520, // Goldenrod for merchants
          emissive: 0x442200
        });
        break;
      default:
        geometry = new THREE.CapsuleGeometry(0.3, 1.2, 4, 8);
        material = new THREE.MeshLambertMaterial({ 
          color: 0x8B4513, // Saddle brown for generic NPCs
          emissive: 0x221100
        });
    }
    
    const mesh = new THREE.Mesh(geometry, material);
    mesh.position.set(npcData.position.x, npcData.position.y + 0.9, npcData.position.z);
    
    // Add name label above NPC
    this.addNPCLabel(mesh, npcData.name);
    
    return {
      id: `npc_${npcData.id}`,
      npc: npcData,
      mesh: mesh,
      area: area
    };
  }

  /**
   * Add floating name label to NPC
   */
  private addNPCLabel(mesh: THREE.Object3D, name: string): void {
    // Create a simple text representation using a small colored cube above the NPC
    const labelGeometry = new THREE.BoxGeometry(0.1, 0.1, 0.1);
    const labelMaterial = new THREE.MeshBasicMaterial({ 
      color: 0xFFFFFF,
      transparent: true,
      opacity: 0.9
    });
    
    const label = new THREE.Mesh(labelGeometry, labelMaterial);
    label.position.set(0, 1.2, 0);
    mesh.add(label);
  }

  /**
   * Generate resources for an area
   */
  private async generateResources(chunk: WorldChunk): Promise<void> {
    const area = chunk.area;
    
    for (const resourceData of area.resources) {
      const resourceEntity = await this.createResourceEntity(resourceData, area);
      if (resourceEntity) {
        chunk.resources.push(resourceEntity);
      }
    }
  }

  /**
   * Create a resource entity
   */
  private async createResourceEntity(resourceData: BiomeResource, area: WorldArea): Promise<ResourceEntity | null> {
    let geometry: THREE.BufferGeometry;
    let material: THREE.Material;
    
    // Different shapes for different resource types
    switch (resourceData.type) {
      case 'tree': {
        // Tree trunk and canopy
        const trunkGeometry = new THREE.CylinderGeometry(0.2, 0.3, 2.0, 8);
        const trunkMaterial = new THREE.MeshLambertMaterial({ color: 0x8B4513 }); // Brown trunk
        const trunk = new THREE.Mesh(trunkGeometry, trunkMaterial);
        trunk.position.y = 1.0;
        
        const canopyGeometry = new THREE.SphereGeometry(1.2, 8, 6);
        const canopyMaterial = new THREE.MeshLambertMaterial({ color: 0x228B22 }); // Green canopy
        const canopy = new THREE.Mesh(canopyGeometry, canopyMaterial);
        canopy.position.y = 2.5;
        
        const tree = new THREE.Group();
        tree.add(trunk);
        tree.add(canopy);
        tree.position.set(resourceData.position.x, resourceData.position.y, resourceData.position.z);
        
        return {
          id: `resource_${area.id}_${resourceData.type}_${Date.now()}`,
          resource: resourceData,
          mesh: tree,
          area: area,
          respawnTime: resourceData.respawnTime,
          isActive: true
        };
      }
        
      case 'fishing_spot': {
        // Water representation
        geometry = new THREE.CylinderGeometry(1.5, 1.5, 0.2, 12);
        material = new THREE.MeshLambertMaterial({ 
          color: 0x1E90FF, // Dodger blue for water
          transparent: true,
          opacity: 0.7
        });
        break;
      }
        
      case 'mine': {
        // Rock formation
        geometry = new THREE.DodecahedronGeometry(0.8);
        material = new THREE.MeshLambertMaterial({ color: 0x696969 }); // Dim gray for rocks
        break;
      }
        
      default: {
        geometry = new THREE.BoxGeometry(0.5, 0.5, 0.5);
        material = new THREE.MeshLambertMaterial({ color: 0x8B4513 });
      }
    }
    
    const mesh = new THREE.Mesh(geometry, material);
    mesh.position.set(resourceData.position.x, resourceData.position.y, resourceData.position.z);
    
    return {
      id: `resource_${area.id}_${resourceData.type}_${Date.now()}`,
      resource: resourceData,
      mesh: mesh,
      area: area,
      respawnTime: resourceData.respawnTime,
      isActive: true
    };
  }

  /**
   * Generate mob spawn points for an area
   */
  private async generateMobSpawns(chunk: WorldChunk): Promise<void> {
    const area = chunk.area;
    
    for (const spawnData of area.mobSpawns) {
      const mobData = ALL_MOBS[spawnData.mobId];
      if (!mobData) {
        console.warn(`[RPGWorldContentSystem] Unknown mob ID: ${spawnData.mobId}`);
        continue;
      }
      
      // Create initial mobs for this spawn point
      for (let i = 0; i < spawnData.maxCount; i++) {
        const mobEntity = await this.createMobEntity(mobData, spawnData, area);
        if (mobEntity) {
          chunk.mobs.push(mobEntity);
        }
      }
    }
  }

  /**
   * Create a mob entity
   */
  private async createMobEntity(mobData: MobData, spawnPoint: MobSpawnPoint, area: WorldArea): Promise<MobEntity | null> {
    // Create mob visual representation based on difficulty level
    let color: number;
    let scale: number;
    
    switch (mobData.difficultyLevel) {
      case 1:
        color = 0x00FF00; // Green for level 1 mobs
        scale = 0.8;
        break;
      case 2:
        color = 0xFFFF00; // Yellow for level 2 mobs
        scale = 1.0;
        break;
      case 3:
        color = 0xFF0000; // Red for level 3 mobs
        scale = 1.2;
        break;
      default:
        color = 0x888888;
        scale = 1.0;
    }
    
    // Different shapes for different mob types
    let geometry: THREE.BufferGeometry;
    
    if (mobData.id.includes('goblin')) {
      geometry = new THREE.ConeGeometry(0.3, 1.5, 6); // Cone for goblins
    } else if (mobData.id.includes('knight') || mobData.id.includes('warrior')) {
      geometry = new THREE.BoxGeometry(0.6, 1.8, 0.3); // Box for armored enemies
    } else if (mobData.id.includes('ranger')) {
      geometry = new THREE.CylinderGeometry(0.2, 0.2, 1.8, 8); // Cylinder for rangers
    } else {
      geometry = new THREE.CapsuleGeometry(0.25, 1.2, 4, 8); // Capsule for humanoids
    }
    
    const material = new THREE.MeshLambertMaterial({ 
      color: color,
      emissive: color,
      emissiveIntensity: 0.1
    });
    
    const mesh = new THREE.Mesh(geometry, material);
    
    // Position randomly within spawn radius
    const angle = Math.random() * Math.PI * 2;
    const distance = Math.random() * spawnPoint.spawnRadius;
    const x = spawnPoint.position.x + Math.cos(angle) * distance;
    const z = spawnPoint.position.z + Math.sin(angle) * distance;
    
    mesh.position.set(x, spawnPoint.position.y + 0.9, z);
    mesh.scale.setScalar(scale);
    
    // Add PhysX collider for mob interaction
    this.addPhysXCollider(mesh, {
      entityId: `mob_${mobData.id}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      entityType: 'mob',
      mobType: mobData.id,
      size: this.getMobSize(mobData.id, scale)
    });
    
    return {
      id: `mob_${mobData.id}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      mobData: mobData,
      mesh: mesh,
      area: area,
      spawnPoint: spawnPoint,
      currentHealth: mobData.stats.health,
      lastRespawn: Date.now(),
      isAlive: true,
      homePosition: new THREE.Vector3(x, spawnPoint.position.y, z)
    };
  }

  /**
   * Load chunks around a position
   */
  public loadChunksAroundPosition(x: number, z: number, force: boolean = false): void {
    const chunksToLoad: string[] = [];
    
    for (const [chunkId, chunk] of this.chunks) {
      const chunkCenterX = (chunk.bounds.minX + chunk.bounds.maxX) / 2;
      const chunkCenterZ = (chunk.bounds.minZ + chunk.bounds.maxZ) / 2;
      
      const distance = Math.sqrt(
        Math.pow(x - chunkCenterX, 2) + Math.pow(z - chunkCenterZ, 2)
      );
      
      if (distance <= this.LOAD_DISTANCE || force) {
        if (!this.loadedChunks.has(chunkId)) {
          chunksToLoad.push(chunkId);
        }
      } else if (distance > this.UNLOAD_DISTANCE) {
        if (this.loadedChunks.has(chunkId)) {
          this.unloadChunk(chunkId);
        }
      }
    }
    
    // Load new chunks
    for (const chunkId of chunksToLoad) {
      this.loadChunk(chunkId);
    }
  }

  /**
   * Load a specific chunk
   */
  private loadChunk(chunkId: string): void {
    const chunk = this.chunks.get(chunkId);
    if (!chunk || chunk.isLoaded) return;
    
    // Add terrain to world
    if (chunk.terrainMesh) {
      this.world.stage?.scene?.add(chunk.terrainMesh);
    }
    
    // Add NPCs to world
    for (const npc of chunk.npcs) {
      this.world.stage?.scene?.add(npc.mesh);
    }
    
    // Add resources to world
    for (const resource of chunk.resources) {
      if (resource.isActive) {
        this.world.stage?.scene?.add(resource.mesh);
      }
    }
    
    // Add mobs to world
    for (const mob of chunk.mobs) {
      if (mob.isAlive) {
        this.world.stage?.scene?.add(mob.mesh);
      }
    }
    
    chunk.isLoaded = true;
    this.loadedChunks.add(chunkId);
    
    console.log(`[RPGWorldContentSystem] Loaded chunk: ${chunk.area.name}`);
  }

  /**
   * Unload a specific chunk
   */
  private unloadChunk(chunkId: string): void {
    const chunk = this.chunks.get(chunkId);
    if (!chunk || !chunk.isLoaded) return;
    
    // Remove terrain from world
    if (chunk.terrainMesh) {
      this.world.stage?.scene?.remove(chunk.terrainMesh);
    }
    
    // Remove NPCs from world
    for (const npc of chunk.npcs) {
      this.world.stage?.scene?.remove(npc.mesh);
    }
    
    // Remove resources from world
    for (const resource of chunk.resources) {
      this.world.stage?.scene?.remove(resource.mesh);
    }
    
    // Remove mobs from world
    for (const mob of chunk.mobs) {
      this.world.stage?.scene?.remove(mob.mesh);
    }
    
    chunk.isLoaded = false;
    this.loadedChunks.delete(chunkId);
    
    console.log(`[RPGWorldContentSystem] Unloaded chunk: ${chunk.area.name}`);
  }

  /**
   * Update system - manage chunk loading and mob behavior
   */
  update(deltaTime: number): void {
    const now = Date.now();
    
    if (now - this.lastUpdate < this.updateInterval) return;
    this.lastUpdate = now;
    
    if (!this.world?.isServer) return;
    
    // Track player positions and manage chunk loading
    this.updatePlayerTracking();
    
    // Update mob behaviors and respawning
    this.updateMobs(deltaTime);
    
    // Update resource respawning
    this.updateResources();
  }

  /**
   * Update player position tracking
   */
  private updatePlayerTracking(): void {
    const players = this.world.getPlayers?.() || [];
    
    for (const player of players) {
      if (!player.position) continue;
      
      const lastPosition = this.playerTracker.get(player.id);
      const currentPosition = new THREE.Vector3(player.position.x, player.position.y, player.position.z);
      
      // Check if player moved significantly
      if (!lastPosition || lastPosition.distanceTo(currentPosition) > 10) {
        this.playerTracker.set(player.id, currentPosition);
        this.loadChunksAroundPosition(currentPosition.x, currentPosition.z);
      }
    }
  }

  /**
   * Update mob entities
   */
  private updateMobs(deltaTime: number): void {
    for (const chunk of this.chunks.values()) {
      if (!chunk.isLoaded) continue;
      
      for (const mob of chunk.mobs) {
        // Handle mob respawning
        if (!mob.isAlive && Date.now() - mob.lastRespawn > mob.spawnPoint.respawnTime) {
          this.respawnMob(mob);
        }
        
        // Simple mob AI - random movement around home position
        if (mob.isAlive && mob.mesh) {
          this.updateMobMovement(mob, deltaTime);
        }
      }
    }
  }

  /**
   * Respawn a mob
   */
  private respawnMob(mob: MobEntity): void {
    mob.isAlive = true;
    mob.currentHealth = mob.mobData.stats.health;
    mob.lastRespawn = Date.now();
    
    // Reset position near home
    const angle = Math.random() * Math.PI * 2;
    const distance = Math.random() * mob.spawnPoint.spawnRadius * 0.5;
    mob.mesh.position.x = mob.homePosition.x + Math.cos(angle) * distance;
    mob.mesh.position.z = mob.homePosition.z + Math.sin(angle) * distance;
    
    if (this.chunks.get(`chunk_${mob.area.id}`)?.isLoaded) {
      this.world.stage?.scene?.add(mob.mesh);
    }
  }

  /**
   * Update mob movement
   */
  private updateMobMovement(mob: MobEntity, deltaTime: number): void {
    if (!mob.mesh) return;
    
    // Simple random movement around home position
    const time = Date.now() * 0.001;
    const wanderRadius = mob.spawnPoint.spawnRadius * 0.7;
    
    const targetX = mob.homePosition.x + Math.sin(time * 0.3 + mob.homePosition.x) * wanderRadius;
    const targetZ = mob.homePosition.z + Math.cos(time * 0.2 + mob.homePosition.z) * wanderRadius;
    
    // Lerp towards target position
    const lerpSpeed = 0.5 * deltaTime;
    mob.mesh.position.x += (targetX - mob.mesh.position.x) * lerpSpeed;
    mob.mesh.position.z += (targetZ - mob.mesh.position.z) * lerpSpeed;
    
    // Gentle bobbing animation
    mob.mesh.position.y = mob.homePosition.y + 0.9 + Math.sin(time * 2) * 0.05;
  }

  /**
   * Update resource entities
   */
  private updateResources(): void {
    for (const chunk of this.chunks.values()) {
      if (!chunk.isLoaded) continue;
      
      for (const resource of chunk.resources) {
        // Handle resource respawning if harvested
        if (!resource.isActive) {
          // Implement resource respawn logic here
          // For now, resources remain active
        }
      }
    }
  }

  /**
   * Get area at position
   */
  public getAreaAtPosition(x: number, z: number): WorldArea | null {
    return getAreaAtPosition(x, z);
  }

  /**
   * Get all NPCs in loaded chunks
   */
  public getLoadedNPCs(): NPCEntity[] {
    const npcs: NPCEntity[] = [];
    
    for (const chunkId of this.loadedChunks) {
      const chunk = this.chunks.get(chunkId);
      if (chunk) {
        npcs.push(...chunk.npcs);
      }
    }
    
    return npcs;
  }

  /**
   * Get all mobs in loaded chunks
   */
  public getLoadedMobs(): MobEntity[] {
    const mobs: MobEntity[] = [];
    
    for (const chunkId of this.loadedChunks) {
      const chunk = this.chunks.get(chunkId);
      if (chunk) {
        mobs.push(...chunk.mobs.filter(mob => mob.isAlive));
      }
    }
    
    return mobs;
  }

  /**
   * Spawn player at random spawn point
   */
  public spawnPlayer(playerId: string): THREE.Vector3 {
    const spawnPoint = getRandomSpawnPoint();
    console.log(`[RPGWorldContentSystem] Spawning player ${playerId} at`, spawnPoint);
    
    // Load chunks around spawn point
    this.loadChunksAroundPosition(spawnPoint.x, spawnPoint.z, true);
    
    return new THREE.Vector3(spawnPoint.x, spawnPoint.y, spawnPoint.z);
  }

  /**
   * Get system info for debugging
   */
  getSystemInfo(): any {
    return {
      totalChunks: this.chunks.size,
      loadedChunks: this.loadedChunks.size,
      totalNPCs: Array.from(this.chunks.values()).reduce((sum, chunk) => sum + chunk.npcs.length, 0),
      totalMobs: Array.from(this.chunks.values()).reduce((sum, chunk) => sum + chunk.mobs.length, 0),
      totalResources: Array.from(this.chunks.values()).reduce((sum, chunk) => sum + chunk.resources.length, 0),
      playerCount: this.playerTracker.size,
      loadedAreas: Array.from(this.loadedChunks).map(id => {
        const chunk = this.chunks.get(id);
        return chunk ? chunk.area.name : id;
      })
    };
  }

  /**
   * Add PhysX collider to a mesh for raycasting and interactions
   */
  private addPhysXCollider(mesh: THREE.Mesh | THREE.Object3D, config: {
    entityId: string;
    entityType: 'npc' | 'resource' | 'mob';
    npcType?: string;
    resourceType?: string;
    mobType?: string;
    size: { x: number; y: number; z: number };
  }): void {
    // Create PhysX collider data that the physics system can use
    mesh.userData.physx = {
      type: 'box',
      size: config.size,
      collider: true,
      trigger: false,
      interactive: true
    };
    
    // Add interaction data
    mesh.userData.interactive = true;
    mesh.userData.clickable = true;
    mesh.userData.entityId = config.entityId;
    mesh.userData.entityType = config.entityType;
    
    // Add type-specific data
    if (config.npcType) mesh.userData.npcType = config.npcType;
    if (config.resourceType) mesh.userData.resourceType = config.resourceType;
    if (config.mobType) mesh.userData.mobType = config.mobType;
    
    console.log(`[RPGWorldContentSystem] Added PhysX collider to: ${config.entityId}`);
  }

  /**
   * Get size for different resource types
   */
  private getResourceSize(resourceType: string): { x: number; y: number; z: number } {
    switch (resourceType) {
      case 'fishing_spot':
        return { x: 3.0, y: 0.4, z: 3.0 };
      case 'mine':
        return { x: 1.6, y: 1.6, z: 1.6 };
      default:
        return { x: 1.0, y: 1.0, z: 1.0 };
    }
  }

  /**
   * Get size for different mob types with scaling
   */
  private getMobSize(mobType: string, scale: number): { x: number; y: number; z: number } {
    let baseSize: { x: number; y: number; z: number };
    
    if (mobType.includes('goblin')) {
      baseSize = { x: 0.6, y: 1.5, z: 0.6 };
    } else if (mobType.includes('knight') || mobType.includes('warrior')) {
      baseSize = { x: 0.6, y: 1.8, z: 0.3 };
    } else if (mobType.includes('ranger')) {
      baseSize = { x: 0.4, y: 1.8, z: 0.4 };
    } else {
      baseSize = { x: 0.5, y: 1.2, z: 0.5 };
    }
    
    return {
      x: baseSize.x * scale,
      y: baseSize.y * scale,
      z: baseSize.z * scale
    };
  }

  // Required System lifecycle methods
  preTick(): void {}
  preFixedUpdate(): void {}
  fixedUpdate(dt: number): void {}
  postFixedUpdate(): void {}
  preUpdate(): void {}
  postUpdate(): void {}
  lateUpdate(): void {}
  postLateUpdate(): void {}
  commit(): void {}
  postTick(): void {}
  
  destroy(): void {
    this.chunks.clear();
    this.loadedChunks.clear();
    this.playerTracker.clear();
    console.log('[RPGWorldContentSystem] System destroyed');
  }
}