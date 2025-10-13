import { SystemBase } from './SystemBase';
import { uuid } from '../utils';
import type { World } from '../types';
import { EventType } from '../types/events';
import { Resource, ResourceDrop } from '../types/core';
import {
  PlayerID,
  ResourceID,
} from '../types/identifiers';
import { calculateDistance } from '../utils/EntityUtils';
import {
  createPlayerID,
  createResourceID
} from '../utils/IdentifierUtils';
import type {
  TerrainResourceSpawnPoint,
} from '../types/terrain';

/**
 * Resource System
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
export class ResourceSystem extends SystemBase {
  private resources = new Map<ResourceID, Resource>();
  private activeGathering = new Map<PlayerID, { playerId: PlayerID; resourceId: ResourceID; startTime: number; skillCheck: number }>();
  private respawnTimers = new Map<ResourceID, NodeJS.Timeout>();
  private playerSkills = new Map<string, Record<string, { level: number; xp: number }>>();

  // Resource drop tables per GDD
  private readonly RESOURCE_DROPS = new Map<string, ResourceDrop[]>([
    ['tree_normal', [
      {
        itemId: 'logs', // Use canonical item id from items.ts
        itemName: 'Logs',
        quantity: 1,
        chance: 1.0, // Always get logs
        xpAmount: 25, // Woodcutting XP per log
        stackable: true
      }
    ]],
    ['herb_patch_normal', [
      {
        itemId: 'herbs', // Use string ID
        itemName: 'Herbs',
        quantity: 1,
        chance: 1.0, // Always get herbs
        xpAmount: 20, // Herbalism XP per herb
        stackable: true
      }
    ]],
    ['fishing_spot_normal', [
      {
        itemId: 'raw_shrimps', // Use string ID that matches items.ts
        itemName: 'Raw Shrimps',
        quantity: 1,
        chance: 1.0, // Always get fish (when successful)
        xpAmount: 10, // Fishing XP per fish
        stackable: true
      }
    ]]
  ]);

  constructor(world: World) {
    super(world, {
      name: 'resource',
      dependencies: {
        required: [], // Resource system can work independently
        optional: ['inventory', 'xp', 'skills', 'ui', 'terrain'] // Better with inventory, skills, and terrain systems
      },
      autoCleanup: true
    });
  }

  async init(): Promise<void> {
    
    // Set up type-safe event subscriptions for resource management
    this.subscribe<{ spawnPoints: TerrainResourceSpawnPoint[] }>(EventType.RESOURCE_SPAWN_POINTS_REGISTERED, (data) => this.registerTerrainResources(data));
    // Bridge gather click -> start gathering with player position
    this.subscribe<{ playerId: string; resourceId: string; playerPosition?: { x: number; y: number; z: number } }>(EventType.RESOURCE_GATHER, (data) => {
      // Use provided playerPosition or fallback to getting it from player entity
      const playerPosition = data.playerPosition || (() => {
        const player = this.world.getPlayer?.(data.playerId);
        return player && (player as { position?: { x: number; y: number; z: number } }).position
          ? (player as { position: { x: number; y: number; z: number } }).position
          : { x: 0, y: 0, z: 0 };
      })();
      console.log('[ResourceSystem] RESOURCE_GATHER received', data.playerId, data.resourceId, 'at position', playerPosition);
      this.startGathering({ playerId: data.playerId, resourceId: data.resourceId, playerPosition });
    });
    
    // Set up player gathering event subscriptions (RESOURCE_GATHER only to avoid loops)
    this.subscribe<{ playerId: string; resourceId: string }>(EventType.RESOURCE_GATHERING_STOPPED, (data) => this.stopGathering(data));
    this.subscribe<{ id: string }>(EventType.PLAYER_UNREGISTERED, (data) => this.cleanupPlayerGathering(data.id));
    
    // Terrain resources now flow through RESOURCE_SPAWN_POINTS_REGISTERED only
    this.subscribe<{ tileId: string }>('terrain:tile:unloaded', (data) => this.onTerrainTileUnloaded(data));

    // Listen to skills updates for reactive patterns
    this.subscribe<{ playerId: string; skills: Record<string, { level: number; xp: number }> }>(EventType.SKILLS_UPDATED, (data) => {
      this.playerSkills.set(data.playerId, data.skills);
    });
    
  }
  private sendChat(playerId: string, text: string): void {
    const chat = (this.world as unknown as { chat: { add: (msg: unknown, broadcast?: boolean) => void } }).chat;
    const msg = {
      id: uuid(),
      from: 'System',
      fromId: null,
      body: text,
      text,
      timestamp: Date.now(),
      createdAt: new Date().toISOString(),
    };
    chat.add(msg, true);
  }

  start(): void {
    console.log(`[ResourceSystem] ⚡ start() called on ${this.world.isServer ? 'SERVER' : 'CLIENT'}`);
    
    // Only run gathering update loop on server (server-authoritative)
    if (this.world.isServer) {
      console.log('[ResourceSystem] Starting gathering update interval (server-only)');
      const interval = this.createInterval(() => this.updateGathering(), 500); // Check every 500ms
      console.log('[ResourceSystem] Update interval created:', interval ? 'Success' : 'Failed');
      console.log('[ResourceSystem] Server will create resources on-demand when players gather from them');
    } else {
      console.log('[ResourceSystem] Client mode - update loop disabled (server handles gathering)');
    }
  }

  /**
   * Handle terrain system resource registration (new procedural system)
   */
  private registerTerrainResources(data: { spawnPoints: TerrainResourceSpawnPoint[] }): void {
    const { spawnPoints } = data;
    
    console.log(`[ResourceSystem] 📍 Registering ${spawnPoints.length} terrain resources on ${this.world.isServer ? 'SERVER' : 'CLIENT'}`);
    
    for (const spawnPoint of spawnPoints) {
      const resource = this.createResourceFromSpawnPoint(spawnPoint);
      if (resource) {
        this.resources.set(createResourceID(resource.id), resource);
        console.log(`[ResourceSystem] ✅ Registered resource: ${resource.id} (${resource.type}) at (${resource.position.x.toFixed(0)}, ${resource.position.z.toFixed(0)})`);
        // Emit spawn event so visual test or interaction layers can render cubes
        this.emitTypedEvent(EventType.RESOURCE_SPAWNED, resource);
        // Network broadcast via dedicated packet handled by ServerNetwork listener
      }
    }
    
    console.log(`[ResourceSystem] 📊 Total resources registered: ${this.resources.size}`);
  }
  
  /**
   * Create resource from terrain spawn point
   */
  private createResourceFromSpawnPoint(spawnPoint: TerrainResourceSpawnPoint): Resource | undefined {
    const { position, type, subType: _subType } = spawnPoint;
    
    let skillRequired: string;
    let toolRequired: string;
    let respawnTime: number;
    let levelRequired: number = 1;
    
    switch (type) {
      case 'tree':
        skillRequired = 'woodcutting';
        toolRequired = 'bronze_hatchet'; // Bronze Hatchet
        respawnTime = 10000; // 10s respawn for MVP
        break;
        
      case 'fish':
        skillRequired = 'fishing';
        toolRequired = 'fishing_rod'; // Fishing Rod  
        respawnTime = 30000; // 30 second respawn
        break;
        
      case 'rock':
      case 'ore':
      case 'gem':
      case 'rare_ore':
        skillRequired = 'mining';
        toolRequired = 'bronze_pickaxe'; // Bronze Pickaxe
        respawnTime = 120000; // 2 minute respawn
        levelRequired = 5;
        break;
        
      case 'herb':
        skillRequired = 'herbalism';
        toolRequired = ''; // No tool required for herbs
        respawnTime = 45000; // 45 second respawn
        levelRequired = 1;
        break;
        
      default:
        throw new Error(`Unknown resource type: ${type}`);
    }
    
    const resourceType: 'tree' | 'fishing_spot' | 'ore' | 'herb_patch' = 
      (type === 'rock' || type === 'ore' || type === 'gem' || type === 'rare_ore') ? 'ore' : 
      type === 'fish' ? 'fishing_spot' : 
      type === 'herb' ? 'herb_patch' :
      'tree';
      
    const resource: Resource = {
      id: `${type}_${position.x.toFixed(0)}_${position.z.toFixed(0)}`,
      type: resourceType,
      name: type === 'fish' ? 'Fishing Spot' : 
            type === 'tree' ? 'Tree' : 
            type === 'herb' ? 'Herb' : 'Rock',
      position: {
        x: position.x,
        y: position.y,
        z: position.z
      },
      skillRequired,
      levelRequired,
      toolRequired,
      respawnTime,
      isAvailable: true,
      lastDepleted: 0,
      drops: this.RESOURCE_DROPS.get(`${resourceType}_normal`) || []
    };
    
    return resource;
  }
  
  
  /**
   * Handle terrain tile unloading - remove resources from unloaded tiles
   */
  private onTerrainTileUnloaded(data: { tileId: string }): void {
    // Extract tileX and tileZ from tileId (format: "x,z")
    const [tileX, tileZ] = data.tileId.split(',').map(Number);
    
    // Remove resources that belong to this tile
    let _removedCount = 0;
    for (const [resourceId, resource] of this.resources) {
      // Check if resource belongs to this tile (based on position)
      const resourceTileX = Math.floor(resource.position.x / 100); // 100m tile size
      const resourceTileZ = Math.floor(resource.position.z / 100);
      
      if (resourceTileX === tileX && resourceTileZ === tileZ) {
        this.resources.delete(resourceId);
        
        // Clean up any active gathering on this resource
        // Note: activeGathering is keyed by PlayerID, not ResourceID
        // We need to find and remove any gathering sessions for this resource
        for (const [playerId, session] of this.activeGathering) {
          if (session.resourceId === resourceId) {
            this.activeGathering.delete(playerId);
          }
        }
        
        // Clean up respawn timer
        if (this.respawnTimers.has(resourceId)) {
          clearTimeout(this.respawnTimers.get(resourceId)!);
          this.respawnTimers.delete(resourceId);
        }
        
        _removedCount++;
      }
    }
    
    // Resources removed from unloaded tile
  }

  private startGathering(data: { playerId: string; resourceId: string; playerPosition: { x: number; y: number; z: number } }): void {
    // Only server should handle actual gathering logic
    if (!this.world.isServer) {
      console.log('[ResourceSystem] Client received startGathering - ignoring (server handles gathering)');
      return;
    }
    
    const playerId = createPlayerID(data.playerId);
    const resourceId = createResourceID(data.resourceId);
    
    console.log(`[ResourceSystem] 🌲 SERVER startGathering for player ${data.playerId} on resource ${data.resourceId}`);
    
    // Try to find the resource with multiple fallback strategies
    let resource = this.resources.get(resourceId);
    
    // Fallback 1: Try to derive ID by rounding position keys if a mismatch happens
    if (!resource) {
      for (const r of this.resources.values()) {
        const derived = `${r.type}_${Math.round(r.position.x)}_${Math.round(r.position.z)}`;
        if (derived === (data.resourceId || '')) { 
          resource = r; 
          console.log(`[ResourceSystem] Matched resource by derived ID: ${derived}`);
          break; 
        }
      }
    }

    // Fallback 2: Pick nearest available resource to the player's position
    if (!resource) {
      let nearest: Resource | null = null;
      let nearestDist = Infinity;
      for (const r of this.resources.values()) {
        if (!r.isAvailable) continue;
        const d = calculateDistance(data.playerPosition, r.position);
        if (d < nearestDist) {
          nearestDist = d;
          nearest = r;
        }
      }
      if (nearest && nearestDist < 15) {
        console.warn('[ResourceSystem] Fallback matched nearest resource', nearest.id, 'at', nearestDist.toFixed(2), 'm');
        resource = nearest;
      } else {
        console.warn('[ResourceSystem] Resource not found for id', data.resourceId, 'available ids:', Array.from(this.resources.keys()).slice(0, 10));
        this.sendChat(data.playerId, `Resource not found. Please try again.`);
        this.emitTypedEvent(EventType.UI_MESSAGE, {
          playerId: data.playerId,
          message: `Resource not found: ${data.resourceId}`,
          type: 'error'
        });
        return;
      }
    }

    // Check if resource is available
    if (!resource.isAvailable) {
      this.emitTypedEvent(EventType.UI_MESSAGE, {
        playerId: data.playerId,
        message: `This ${resource.type.replace('_', ' ')} is depleted. Please wait for it to respawn.`,
        type: 'info'
      });
      return;
    }

    // Check player skill level (reactive pattern)
    const cachedSkills = this.playerSkills.get(data.playerId);
    const skillLevel = cachedSkills?.[resource.skillRequired]?.level ?? 1;
    
    if (resource.levelRequired !== undefined && skillLevel < resource.levelRequired) {
      this.sendChat(data.playerId, `You need level ${resource.levelRequired} ${resource.skillRequired} to use this resource.`);
      this.emitTypedEvent(EventType.UI_MESSAGE, {
        playerId: data.playerId,
        message: `You need level ${resource.levelRequired} ${resource.skillRequired} to use this resource.`,
        type: 'error'
      });
      return;
    }

    // TODO: Add proper tool check via inventory system query (not callback)
    // For now, skip tool check to get gathering working
    // Tools will be checked later when we have proper inventory queries

    // If player is already gathering, replace session with the latest request
    if (this.activeGathering.has(playerId)) {
      this.activeGathering.delete(playerId);
    }

    // Start RS-like timed gathering session
    const actionName = resource.skillRequired === 'woodcutting' ? 'chopping' : 
                       (resource.skillRequired === 'fishing' ? 'fishing' : 'gathering');
    const resourceName = resource.name || resource.type.replace('_', ' ');
    const skillCheck = Math.floor(Math.random() * 100);
    const gatheringDuration = Math.max(3000, Math.min(5000, 5000 - (skillCheck * 20))); // 3-5 seconds
    
    console.log(`[ResourceSystem] ✅ Gathering started! Player ${data.playerId} ${actionName} ${resourceName} for ${gatheringDuration/1000}s (skill check: ${skillCheck})`);
    
    // Create timed session
    this.activeGathering.set(playerId, {
      playerId,
      resourceId: createResourceID(resource.id),
      startTime: Date.now(),
      skillCheck
    });

    // Emit gathering started event
    this.emitTypedEvent(EventType.RESOURCE_GATHERING_STARTED, {
      playerId: data.playerId,
      resourceId: resource.id,
      skill: resource.skillRequired
    });
    
    // Send feedback to player via chat and UI
    this.sendChat(data.playerId, `You start ${actionName}...`);
    this.emitTypedEvent(EventType.UI_MESSAGE, {
      playerId: data.playerId,
      message: `You start ${actionName} the ${resourceName.toLowerCase()}...`,
      type: 'info'
    });
    
    // Broadcast toast to client via network
    const network = this.world.network as { send?: (method: string, data: unknown, exclude?: string) => void } | undefined;
    if (network && network.send) {
      network.send('showToast', {
        playerId: data.playerId,
        message: `You start ${actionName} the ${resourceName.toLowerCase()}...`,
        type: 'info'
      });
    }
  }

  private stopGathering(data: { playerId: string }): void {
    const playerId = createPlayerID(data.playerId);
    const session = this.activeGathering.get(playerId);
    if (session) {
      this.activeGathering.delete(playerId);
      
      this.emitTypedEvent(EventType.RESOURCE_GATHERING_STOPPED, {
        playerId: data.playerId,
        resourceId: session.resourceId
      });
    }
  }

  private cleanupPlayerGathering(playerId: string): void {
    this.activeGathering.delete(createPlayerID(playerId));
  }

  private updateGathering(): void {
    const now = Date.now();
    const completedSessions: PlayerID[] = [];

    if (this.activeGathering.size > 0) {
      console.log(`[ResourceSystem] updateGathering: checking ${this.activeGathering.size} active gathering sessions`);
    }

    for (const [playerId, session] of this.activeGathering.entries()) {
      const resource = this.resources.get(session.resourceId);
      if (!resource?.isAvailable) {
        console.log(`[ResourceSystem] Resource ${session.resourceId} not available, completing gathering immediately`);
        // If resource became unavailable, complete the session immediately (client will see stump)
        this.completeGathering(playerId, session);
        completedSessions.push(playerId);
        continue;
      }

      // Check if gathering time is complete (3-5 seconds based on skill). Clamp to [3000, 5000]
      const raw = 5000 - (session.skillCheck * 20);
      const gatheringTime = Math.max(3000, Math.min(5000, raw));
      const elapsed = now - session.startTime;
      
      if (elapsed >= gatheringTime) {
        console.log(`[ResourceSystem] ⏰ Gathering time complete! Elapsed: ${elapsed}ms, Required: ${gatheringTime}ms`);
        this.completeGathering(playerId, session);
        completedSessions.push(playerId);
      } else if (Math.floor(elapsed / 1000) !== Math.floor((elapsed - 500) / 1000)) {
        // Log every second
        console.log(`[ResourceSystem] ⏳ Gathering in progress: ${Math.floor(elapsed / 1000)}s / ${Math.floor(gatheringTime / 1000)}s`);
      }
    }

    // Clean up completed sessions
    for (const playerId of completedSessions) {
      this.activeGathering.delete(playerId);
    }
  }

  private completeGathering(playerId: PlayerID, session: { playerId: PlayerID; resourceId: ResourceID; startTime: number; skillCheck: number }): void {
    const resource = this.resources.get(session.resourceId)!;

    console.log(`[ResourceSystem] completeGathering called for resource ${session.resourceId}`);

    // Proximity/cancel check - player must still be near the resource
    const p = this.world.getPlayer?.(playerId as unknown as string);
    const playerPos = p && (p as { position?: { x: number; y: number; z: number } }).position
      ? (p as { position: { x: number; y: number; z: number } }).position
      : null;
    if (!playerPos || calculateDistance(playerPos, resource.position) > 4.0) {
      console.log(`[ResourceSystem] Player moved too far away, canceling gathering`);
      this.emitTypedEvent(EventType.RESOURCE_GATHERING_STOPPED, {
        playerId: playerId as unknown as string,
        resourceId: session.resourceId
      });
      return;
    }

    // Calculate success based on skill level and random check (reactive pattern)
    const cachedSkills = this.playerSkills.get(playerId);
    const skillLevel = cachedSkills?.[resource.skillRequired]?.level ?? 1;
    
    // Success rate: base 60% + skill level * 2% (max ~85% at high levels)
    // For MVP, guarantee success for deterministic testing, but keep the logic for later
    const baseSuccessRate = 60;
    const skillBonus = skillLevel * 2;
    const successRate = Math.min(85, baseSuccessRate + skillBonus);
    const isSuccessful = true; // MVP: always succeed for testing
    // const isSuccessful = session.skillCheck <= successRate; // Future: enable skill-based success
    
    console.log(`[ResourceSystem] Gathering result: ${isSuccessful ? 'SUCCESS' : 'FAIL'} (roll: ${session.skillCheck}, needed: <=${successRate})`)

    if (isSuccessful) {
      // Determine drops
      const dropTableKey = `${resource.type}_normal`;
      console.log(`[ResourceSystem] Looking for drop table: ${dropTableKey}`);
      console.log(`[ResourceSystem] Available drop tables:`, Array.from(this.RESOURCE_DROPS.keys()));
      
      const dropTable = this.RESOURCE_DROPS.get(dropTableKey);
      if (dropTable) {
        console.log(`[ResourceSystem] Found drop table with ${dropTable.length} drops`);
        for (const drop of dropTable) {
          const dropRoll = Math.random();
          console.log(`[ResourceSystem] Drop chance roll: ${dropRoll} vs ${drop.chance}`);
          
          if (dropRoll <= drop.chance) {
            console.log(`[ResourceSystem] 🎁 Dropping item: ${drop.itemName} (${drop.itemId})`);
            
            // Add item to player inventory (emit with raw player id string for DB consistency)
            this.emitTypedEvent(EventType.INVENTORY_ITEM_ADDED, {
              playerId: (playerId as unknown as string),
              item: {
                id: `inv_${playerId}_${Date.now()}_${drop.itemId}`,
                itemId: drop.itemId,
                quantity: drop.quantity,
                slot: -1, // Let system find empty slot
                metadata: null
              }
            });
            
            console.log(`[ResourceSystem] ✅ INVENTORY_ITEM_ADDED event emitted for ${drop.itemId}`);

            // Award XP and check for level up (reactive pattern)
            this.emitTypedEvent(EventType.SKILLS_XP_GAINED, {
              playerId: playerId,
              skill: resource.skillRequired,
              amount: drop.xpAmount
            });

            // Skills system will listen to XP_GAINED and emit SKILLS_UPDATED reactively

            const actionName = resource.skillRequired === 'woodcutting' ? 'chop down the tree' : 
                               resource.skillRequired === 'fishing' ? 'catch a fish' : 'gather from the resource';
            const _resourceName = resource.name || resource.type.replace('_', ' ');
            
            console.log(`[ResourceSystem] ✅ SUCCESS! ${drop.itemName} x${drop.quantity} added to inventory, ${drop.xpAmount} XP gained`);

            // Send feedback to player via multiple channels
            this.sendChat((playerId as unknown as string), `You receive ${drop.quantity}x ${drop.itemName}.`);
            this.emitTypedEvent(EventType.UI_MESSAGE, {
              playerId: (playerId as unknown as string),
              message: `You receive ${drop.quantity}x ${drop.itemName}.`,
              type: 'success'
            });
            
            // Broadcast success message to client via network
            const network = this.world.network as { send?: (method: string, data: unknown, exclude?: string) => void } | undefined;
            if (network && network.send) {
              network.send('showToast', {
                playerId: playerId,
                message: `You successfully ${actionName}! +${drop.quantity} ${drop.itemName}`,
                type: 'success'
              });
            }

          }
        }
      }

      // Deplete resource temporarily
      resource.isAvailable = false;
      resource.lastDepleted = Date.now();

      console.log(`[ResourceSystem] 🌲→🪵 Resource depleted! Will respawn in ${resource.respawnTime/1000}s`);

      // Notify clients to swap to stump visual
      this.emitTypedEvent(EventType.RESOURCE_DEPLETED, {
        resourceId: session.resourceId,
        position: resource.position
      });
      this.sendChat((playerId as unknown as string), 'The tree is chopped down.');
      
      // Broadcast depletion to all clients for visual updates
      const network = this.world.network as { send?: (method: string, data: unknown) => void } | undefined;
      if (network && network.send) {
        network.send('resourceDepleted', {
          resourceId: session.resourceId,
          position: resource.position
        });
      }

      // Set respawn timer
      const respawnTimer = setTimeout(() => {
        resource.isAvailable = true;
        resource.lastDepleted = 0;
        
        console.log(`[ResourceSystem] 🌲 Resource respawned: ${session.resourceId}`);
        
        // Emit local event
        this.emitTypedEvent(EventType.RESOURCE_RESPAWNED, {
          resourceId: session.resourceId,
          position: resource.position
        });
        
        // Broadcast to all clients
        const network = this.world.network as { send?: (method: string, data: unknown) => void } | undefined;
        if (network && network.send) {
          network.send('resourceRespawned', {
            resourceId: session.resourceId,
            position: resource.position
          });
        }
      }, resource.respawnTime);

      this.respawnTimers.set(session.resourceId, respawnTimer);

    } else {
      // Failed attempt
      const actionName = resource.skillRequired === 'woodcutting' ? 'chop the tree' : 
                         resource.skillRequired === 'fishing' ? 'catch anything' : 'gather';
      
      console.log(`[ResourceSystem] ❌ FAILED! Skill check ${session.skillCheck} > ${successRate}`);
      
      this.sendChat((playerId as unknown as string), `You fail to ${actionName}.`);
      
      // Broadcast failure message to client
      const network = this.world.network as { send?: (method: string, data: unknown, exclude?: string) => void } | undefined;
      if (network && network.send) {
        network.send('showToast', {
          playerId: playerId,
          message: `You fail to ${actionName}.`,
          type: 'info'
        });
      }

    }

    // Emit gathering completed event
    this.emitTypedEvent(EventType.RESOURCE_GATHERING_COMPLETED, {
      playerId: playerId,
      resourceId: session.resourceId,
      successful: isSuccessful,
      skill: resource.skillRequired
    });
    
    // Broadcast completion to all clients for UI updates
    const network2 = this.world.network as { send?: (method: string, data: unknown, exclude?: string) => void } | undefined;
    if (network2 && network2.send) {
      network2.send('gatheringComplete', {
        playerId: playerId,
        resourceId: session.resourceId,
        successful: isSuccessful
      });
    }

    // Ensure immediate persistence after successful gather (durability before refresh)
    if (isSuccessful) {
      const db = this.world.getSystem('database') as unknown as { savePlayerInventory: (pid: string, items: Array<{ itemId: string; quantity: number; slotIndex: number; metadata: null }>) => void; savePlayer: (pid: string, data: { coins: number }) => void };
      const invSys = this.world.getSystem('inventory') as unknown as { getInventoryData: (pid: string) => { items: Array<{ slot: number; itemId: string; quantity: number }>; coins: number } };
      const pid = (playerId as unknown as string);
      const data = invSys.getInventoryData(pid);
      const rows = data.items.map(i => ({ itemId: i.itemId, quantity: i.quantity, slotIndex: i.slot, metadata: null as null }));
      db.savePlayerInventory(pid, rows);
      db.savePlayer(pid, { coins: data.coins });
    }
  }

  /**
   * Get all resources for testing/debugging
   */
  getAllResources(): Resource[] {
    return Array.from(this.resources.values());
  }

  /**
   * Get resources by type
   */
  getResourcesByType(type: string): Resource[] {
    return this.getAllResources().filter(resource => resource.type === type);
  }

  /**
   * Get resource by ID
   */
  getResource(resourceId: string): Resource | undefined {
    return this.resources.get(createResourceID(resourceId));
  }

  /**
   * Cleanup when system is destroyed
   */
  destroy(): void {
    // Clear all active gathering sessions
    this.activeGathering.clear();
    
    // Clear all respawn timers to prevent memory leaks
    for (const timer of this.respawnTimers.values()) {
      clearTimeout(timer);
    }
    this.respawnTimers.clear();
    
    // Clear all resource data
    this.resources.clear();
    
    // Call parent cleanup
    super.destroy();
  }
}
