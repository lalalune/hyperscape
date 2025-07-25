import { System } from '../../core/systems/System';

export interface RPGResource {
  id: string;
  type: 'tree' | 'fishing_spot' | 'ore'; // For future expansion
  position: { x: number; y: number; z: number };
  skillRequired: string;
  levelRequired: number;
  toolRequired: number; // Item ID of required tool
  respawnTime: number; // Milliseconds
  isAvailable: boolean;
  lastDepleted?: number;
}

export interface RPGResourceDrop {
  itemId: number;
  itemName: string;
  quantity: number;
  chance: number; // 0-1
  xpAmount: number;
  stackable: boolean;
}

/**
 * RPG Resource System
 * Manages resource gathering per GDD specifications:
 * 
 * Woodcutting:
 * - Click tree with hatchet equipped
 * - Success rates based on skill level
 * - Produces logs
 * 
 * Fishing:
 * - Click water edge with fishing rod equipped  
 * - Success rates based on skill level
 * - Produces raw fish
 * 
 * Resource respawning and depletion mechanics
 */
export class RPGResourceSystem extends System {
  private resources = new Map<string, RPGResource>();
  private activeGathering = new Map<string, { playerId: string; resourceId: string; startTime: number; skillCheck: number }>();
  private respawnTimers = new Map<string, NodeJS.Timeout>();

  // Resource drop tables per GDD
  private readonly RESOURCE_DROPS = new Map<string, RPGResourceDrop[]>([
    ['tree_normal', [
      {
        itemId: 200, // Logs
        itemName: 'Logs',
        quantity: 1,
        chance: 1.0, // Always get logs
        xpAmount: 25, // Woodcutting XP per log
        stackable: true
      }
    ]],
    ['fishing_spot_normal', [
      {
        itemId: 201, // Raw Fish
        itemName: 'Raw Fish',
        quantity: 1,
        chance: 1.0, // Always get fish (when successful)
        xpAmount: 10, // Fishing XP per fish
        stackable: true
      }
    ]]
  ]);

  constructor(world: any) {
    super(world);
  }

  async init(): Promise<void> {
    console.log('[RPGResourceSystem] Initializing resource gathering system...');
    
    // Listen for terrain system resource spawn events (new procedural system)
    this.world.on?.('rpg:resource:spawn_points:registered', this.registerTerrainResources.bind(this));
    
    // Listen for resource gathering events
    this.world.on?.('rpg:resource:start_gather', this.startGathering.bind(this));
    this.world.on?.('rpg:resource:stop_gather', this.stopGathering.bind(this));
    this.world.on?.('rpg:player:unregister', this.cleanupPlayerGathering.bind(this));
    
    // Listen for terrain tile updates to add/remove resources dynamically
    this.world.on?.('terrain:tile:generated', this.onTerrainTileGenerated.bind(this));
    this.world.on?.('terrain:tile:unloaded', this.onTerrainTileUnloaded.bind(this));
    
    console.log('[RPGResourceSystem] Resource system initialized - waiting for terrain system resource registration');
  }

  start(): void {
    console.log('[RPGResourceSystem] Resource system started');
    
    // Start update loop for gathering progress
    setInterval(() => {
      this.updateGathering();
    }, 1000); // Check every second
  }

  /**
   * Handle terrain system resource registration (new procedural system)
   */
  private registerTerrainResources(event: any): void {
    const { spawnPoints } = event;
    console.log(`[RPGResourceSystem] Registering ${spawnPoints.length} procedural terrain resources`);
    
    let registeredCount = 0;
    for (const spawnPoint of spawnPoints) {
      const resource = this.createResourceFromSpawnPoint(spawnPoint);
      if (resource) {
        this.resources.set(resource.id, resource);
        registeredCount++;
      }
    }
    
    console.log(`[RPGResourceSystem] Registered ${registeredCount} terrain-based resources (total: ${this.resources.size})`);
  }
  
  /**
   * Create RPG resource from terrain spawn point
   */
  private createResourceFromSpawnPoint(spawnPoint: any): RPGResource | null {
    const { position, type, subType } = spawnPoint;
    
    let skillRequired: string;
    let toolRequired: number;
    let respawnTime: number;
    let levelRequired: number = 1;
    
    switch (type) {
      case 'tree':
        skillRequired = 'woodcutting';
        toolRequired = 100; // Bronze Hatchet
        respawnTime = 60000; // 1 minute respawn
        break;
        
      case 'fishing_spot':
        skillRequired = 'fishing';
        toolRequired = 101; // Fishing Rod  
        respawnTime = 30000; // 30 second respawn
        break;
        
      case 'rock':
      case 'ore':
        // Future expansion for mining
        return null; // Skip for now
        
      default:
        console.warn(`[RPGResourceSystem] Unknown resource type: ${type}`);
        return null;
    }
    
    const resource: RPGResource = {
      id: `${type}_${position.x.toFixed(0)}_${position.z.toFixed(0)}`,
      type: type as any,
      position: {
        x: position.x,
        y: position.y,
        z: position.z
      },
      skillRequired,
      levelRequired,
      toolRequired,
      respawnTime,
      isAvailable: true
    };
    
    return resource;
  }
  
  /**
   * Handle terrain tile generation - add resources from new tiles
   */
  private onTerrainTileGenerated(event: any): void {
    const { tileX, tileZ, resources } = event;
    
    console.log(`[RPGResourceSystem] Terrain tile (${tileX}, ${tileZ}) generated with ${resources?.length || 0} resources`);
    
    if (resources && resources.length > 0) {
      let addedCount = 0;
      for (const terrainResource of resources) {
        const resource = this.createResourceFromTerrainResource(terrainResource);
        if (resource) {
          this.resources.set(resource.id, resource);
          addedCount++;
        }
      }
      console.log(`[RPGResourceSystem] Added ${addedCount} resources from tile (${tileX}, ${tileZ})`);
    }
  }
  
  /**
   * Handle terrain tile unloading - remove resources from unloaded tiles
   */
  private onTerrainTileUnloaded(event: any): void {
    const { tileX, tileZ } = event;
    
    // Remove resources that belong to this tile
    let removedCount = 0;
    for (const [resourceId, resource] of this.resources) {
      // Check if resource belongs to this tile (based on position)
      const resourceTileX = Math.floor(resource.position.x / 100); // 100m tile size
      const resourceTileZ = Math.floor(resource.position.z / 100);
      
      if (resourceTileX === tileX && resourceTileZ === tileZ) {
        this.resources.delete(resourceId);
        
        // Clean up any active gathering on this resource
        if (this.activeGathering.has(resource.id)) {
          this.activeGathering.delete(resource.id);
        }
        
        // Clean up respawn timer
        if (this.respawnTimers.has(resource.id)) {
          clearTimeout(this.respawnTimers.get(resource.id)!);
          this.respawnTimers.delete(resource.id);
        }
        
        removedCount++;
      }
    }
    
    if (removedCount > 0) {
      console.log(`[RPGResourceSystem] Removed ${removedCount} resources from unloaded tile (${tileX}, ${tileZ})`);
    }
  }
  
  /**
   * Create RPG resource from terrain system resource
   */
  private createResourceFromTerrainResource(terrainResource: any): RPGResource | null {
    const { id, type, position } = terrainResource;
    
    let skillRequired: string;
    let toolRequired: number;
    let respawnTime: number;
    let levelRequired: number = 1;
    
    switch (type) {
      case 'tree':
        skillRequired = 'woodcutting';
        toolRequired = 100; // Bronze Hatchet
        respawnTime = 60000; // 1 minute respawn
        break;
        
      case 'fish':
        skillRequired = 'fishing';
        toolRequired = 101; // Fishing Rod  
        respawnTime = 30000; // 30 second respawn
        break;
        
      case 'rock':
      case 'ore':
        // Future expansion for mining
        return null; // Skip for now
        
      default:
        console.warn(`[RPGResourceSystem] Unknown terrain resource type: ${type}`);
        return null;
    }
    
    const resource: RPGResource = {
      id: id,
      type: type === 'fish' ? 'fishing_spot' : type as any,
      position: {
        x: position.x,
        y: position.y,
        z: position.z
      },
      skillRequired,
      levelRequired,
      toolRequired,
      respawnTime,
      isAvailable: true
    };
    
    return resource;
  }

  private startGathering(data: { playerId: string; resourceId: string; playerPosition: { x: number; y: number; z: number } }): void {
    const resource = this.resources.get(data.resourceId);
    if (!resource) {
      console.log(`[RPGResourceSystem] Resource ${data.resourceId} not found`);
      return;
    }

    // Check if resource is available
    if (!resource.isAvailable) {
      this.world.emit?.('rpg:ui:message', {
        playerId: data.playerId,
        message: `This ${resource.type.replace('_', ' ')} is depleted. Please wait for it to respawn.`,
        type: 'info'
      });
      return;
    }

    // Check if player is already gathering
    if (this.activeGathering.has(data.playerId)) {
      console.log(`[RPGResourceSystem] Player ${data.playerId} already gathering`);
      return;
    }

    // Check distance (must be within 2 meters)
    const distance = this.calculateDistance(data.playerPosition, resource.position);
    if (distance > 2) {
      this.world.emit?.('rpg:ui:message', {
        playerId: data.playerId,
        message: `You need to be closer to the ${resource.type.replace('_', ' ')}.`,
        type: 'error'
      });
      return;
    }

    // Check if player has required tool equipped
    this.world.emit?.('rpg:inventory:has_equipped', {
      playerId: data.playerId,
      itemId: resource.toolRequired,
      callback: (hasEquipped: boolean) => {
        if (!hasEquipped) {
          const toolName = resource.toolRequired === 100 ? 'hatchet' : 'fishing rod';
          this.world.emit?.('rpg:ui:message', {
            playerId: data.playerId,
            message: `You need a ${toolName} equipped to ${resource.skillRequired}.`,
            type: 'error'
          });
          return;
        }

        // Check player skill level
        this.world.emit?.('rpg:skills:get_level', {
          playerId: data.playerId,
          skill: resource.skillRequired,
          callback: (level: number) => {
            if (level < resource.levelRequired) {
              this.world.emit?.('rpg:ui:message', {
                playerId: data.playerId,
                message: `You need level ${resource.levelRequired} ${resource.skillRequired} to use this resource.`,
                type: 'error'
              });
              return;
            }

            // Start gathering process
            const skillCheck = Math.random() * 100; // Will determine success
            const gatheringSession = {
              playerId: data.playerId,
              resourceId: data.resourceId,
              startTime: Date.now(),
              skillCheck
            };

            this.activeGathering.set(data.playerId, gatheringSession);

            const actionName = resource.skillRequired === 'woodcutting' ? 'chopping' : 'fishing';
            console.log(`[RPGResourceSystem] Player ${data.playerId} started ${actionName} ${data.resourceId}`);
            
            // Send gathering started event
            this.world.emit?.('rpg:resource:gathering:started', {
              playerId: data.playerId,
              resourceId: data.resourceId,
              skill: resource.skillRequired,
              actionName
            });

            // Show gathering message
            this.world.emit?.('rpg:ui:message', {
              playerId: data.playerId, 
              message: `You start ${actionName}...`,
              type: 'info'
            });
          }
        });
      }
    });
  }

  private stopGathering(data: { playerId: string }): void {
    const session = this.activeGathering.get(data.playerId);
    if (session) {
      this.activeGathering.delete(data.playerId);
      console.log(`[RPGResourceSystem] Player ${data.playerId} stopped gathering ${session.resourceId}`);
      
      this.world.emit?.('rpg:resource:gathering:stopped', {
        playerId: data.playerId,
        resourceId: session.resourceId
      });
    }
  }

  private cleanupPlayerGathering(playerId: string): void {
    this.activeGathering.delete(playerId);
  }

  private updateGathering(): void {
    const now = Date.now();
    const completedSessions: string[] = [];

    for (const [playerId, session] of this.activeGathering.entries()) {
      const resource = this.resources.get(session.resourceId);
      if (!resource || !resource.isAvailable) {
        completedSessions.push(playerId);
        continue;
      }

      // Check if gathering time is complete (3-5 seconds based on skill)
      const gatheringTime = 5000 - (session.skillCheck * 20); // 3-5 seconds based on skill check
      if (now - session.startTime >= gatheringTime) {
        this.completeGathering(playerId, session);
        completedSessions.push(playerId);
      }
    }

    // Clean up completed sessions
    for (const playerId of completedSessions) {
      this.activeGathering.delete(playerId);
    }
  }

  private completeGathering(playerId: string, session: { playerId: string; resourceId: string; startTime: number; skillCheck: number }): void {
    const resource = this.resources.get(session.resourceId);
    if (!resource) return;

    // Calculate success based on skill level and random check
    this.world.emit?.('rpg:skills:get_level', {
      playerId: playerId,
      skill: resource.skillRequired,
      callback: (skillLevel: number) => {
        // Success rate: base 60% + skill level * 2% (max ~85% at high levels)
        const baseSuccessRate = 60;
        const skillBonus = skillLevel * 2;
        const successRate = Math.min(85, baseSuccessRate + skillBonus);
        const isSuccessful = session.skillCheck <= successRate;

        if (isSuccessful) {
          // Determine drops
          const dropTable = this.RESOURCE_DROPS.get(`${resource.type}_normal`);
          if (dropTable) {
            for (const drop of dropTable) {
              if (Math.random() <= drop.chance) {
                // Add item to player inventory
                this.world.emit?.('rpg:inventory:add', {
                  playerId: playerId,
                  item: {
                    id: drop.itemId,
                    name: drop.itemName,
                    quantity: drop.quantity,
                    stackable: drop.stackable
                  }
                });

                // Award XP
                this.world.emit?.('rpg:xp:gain', {
                  playerId: playerId,
                  skill: resource.skillRequired,
                  amount: drop.xpAmount
                });

                const actionName = resource.skillRequired === 'woodcutting' ? 'chop down the tree' : 'catch a fish';
                this.world.emit?.('rpg:ui:message', {
                  playerId: playerId,
                  message: `You successfully ${actionName} and receive ${drop.quantity}x ${drop.itemName}!`,
                  type: 'success'
                });

                console.log(`[RPGResourceSystem] Player ${playerId} successfully gathered ${drop.quantity}x ${drop.itemName} from ${session.resourceId}`);
              }
            }
          }

          // Deplete resource temporarily
          resource.isAvailable = false;
          resource.lastDepleted = Date.now();

          // Set respawn timer
          const respawnTimer = setTimeout(() => {
            resource.isAvailable = true;
            delete resource.lastDepleted;
            console.log(`[RPGResourceSystem] Resource ${session.resourceId} respawned`);
            
            // Notify nearby players
            this.world.emit?.('rpg:resource:respawned', {
              resourceId: session.resourceId,
              position: resource.position
            });
          }, resource.respawnTime);

          this.respawnTimers.set(session.resourceId, respawnTimer);

        } else {
          // Failed attempt
          const actionName = resource.skillRequired === 'woodcutting' ? 'cut the tree' : 'catch anything';
          this.world.emit?.('rpg:ui:message', {
            playerId: playerId,
            message: `You fail to ${actionName}.`,
            type: 'info'
          });

          console.log(`[RPGResourceSystem] Player ${playerId} failed to gather from ${session.resourceId}`);
        }

        // Emit gathering completed event
        this.world.emit?.('rpg:resource:gathering:completed', {
          playerId: playerId,
          resourceId: session.resourceId,
          successful: isSuccessful,
          skill: resource.skillRequired
        });
      }
    });
  }

  private calculateDistance(pos1: { x: number; y: number; z: number }, pos2: { x: number; y: number; z: number }): number {
    const dx = pos1.x - pos2.x;
    const dy = pos1.y - pos2.y;
    const dz = pos1.z - pos2.z;
    return Math.sqrt(dx * dx + dy * dy + dz * dz);
  }

  // Public API for apps
  getResource(resourceId: string): RPGResource | undefined {
    return this.resources.get(resourceId);
  }

  getAllResources(): RPGResource[] {
    return Array.from(this.resources.values());
  }

  getResourcesByType(type: 'tree' | 'fishing_spot' | 'ore'): RPGResource[] {
    return Array.from(this.resources.values()).filter(resource => resource.type === type);
  }

  getResourcesInArea(center: { x: number; y: number; z: number }, radius: number): RPGResource[] {
    return Array.from(this.resources.values()).filter(resource => {
      const distance = this.calculateDistance(center, resource.position);
      return distance <= radius;
    });
  }

  isPlayerGathering(playerId: string): boolean {
    return this.activeGathering.has(playerId);
  }

  getPlayerGatheringInfo(playerId: string): { resourceId: string; skill: string; progress: number } | null {
    const session = this.activeGathering.get(playerId);
    if (!session) return null;

    const resource = this.resources.get(session.resourceId);
    if (!resource) return null;

    const elapsed = Date.now() - session.startTime;
    const gatheringTime = 5000 - (session.skillCheck * 20);
    const progress = Math.min(1, elapsed / gatheringTime);

    return {
      resourceId: session.resourceId,
      skill: resource.skillRequired,
      progress
    };
  }

  // Get resource drops for UI display
  getResourceDrops(resourceType: string): RPGResourceDrop[] {
    return this.RESOURCE_DROPS.get(`${resourceType}_normal`) || [];
  }

  // For world generation - get resource positions
  getResourcePositions(): Array<{ id: string; type: string; position: { x: number; y: number; z: number } }> {
    return Array.from(this.resources.values()).map(resource => ({
      id: resource.id,
      type: resource.type,
      position: resource.position
    }));
  }

  destroy(): void {
    // Clear all respawn timers
    this.respawnTimers.forEach(timer => clearTimeout(timer));
    this.respawnTimers.clear();
    
    // Clear data
    this.resources.clear();
    this.activeGathering.clear();
    
    console.log('[RPGResourceSystem] System destroyed');
  }

  // Required System lifecycle methods
  preTick(): void {}
  preFixedUpdate(): void {}
  fixedUpdate(dt: number): void {}
  postFixedUpdate(): void {}
  preUpdate(): void {}
  update(dt: number): void {
    this.updateGathering();
  }
  postUpdate(): void {}
  lateUpdate(): void {}
  postLateUpdate(): void {}
  commit(): void {}
  postTick(): void {}
}