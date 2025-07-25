import { System } from '../../core/systems/System';
import * as THREE from '../../core/extras/three';

/**
 * DefaultWorldSystem - Dynamic Content Loading
 * 
 * This system loads all game content dynamically including:
 * - Mobs and creatures
 * - Towns and safe zones
 * - Items and loot
 * - Resource nodes (trees, fishing spots)
 * - Environmental elements
 * 
 * Replaces static app-proxy architecture with dynamic system-based loading
 */
export class DefaultWorldSystem extends System {
  private loadedEntities = new Map<string, any>();
  private world3D: any;
  
  constructor(world: any) {
    super(world);
  }

  async init(): Promise<void> {
    console.log('[DefaultWorldSystem] Initializing dynamic world content system...');
    
    // Get world 3D context - try multiple approaches
    this.world3D = this.world;
    
    console.log('[DefaultWorldSystem] World object available:', !!this.world3D);
    console.log('[DefaultWorldSystem] World.add method:', typeof this.world3D?.add);
    console.log('[DefaultWorldSystem] THREE.js available:', !!THREE);
    
    // Listen for world initialization
    this.world.on?.('rpg:world:initialize', this.initializeWorld.bind(this));
    this.world.on?.('rpg:world:load_region', this.loadRegion.bind(this));
    this.world.on?.('rpg:world:unload_region', this.unloadRegion.bind(this));
    
    console.log('[DefaultWorldSystem] Dynamic world system initialized');
  }

  start(): void {
    console.log('[DefaultWorldSystem] Starting dynamic world loading...');
    
    // Auto-initialize the starter world content
    this.initializeStarterWorld();
  }

  private initializeStarterWorld(): void {
    console.log('[DefaultWorldSystem] Loading starter world content...');
    
    // Load starter towns
    this.loadStarterTowns();
    
    // Load basic resource nodes
    this.loadResourceNodes();
    
    // Load initial terrain features
    this.loadTerrainFeatures();
    
    // Initialize mob spawning zones
    this.initializeMobSpawns();
    
    console.log('[DefaultWorldSystem] Starter world content loaded');
  }

  private loadStarterTowns(): void {
    const towns = [
      {
        id: 'starter_town_1',
        name: 'Mistwood Village',
        position: { x: 10, y: 0, z: 10 },
        radius: 15,
        type: 'safe_zone'
      },
      {
        id: 'starter_town_2', 
        name: 'Riverbank Settlement',
        position: { x: -20, y: 0, z: 30 },
        radius: 12,
        type: 'safe_zone'
      }
    ];

    for (const town of towns) {
      this.loadTown(town);
    }
  }

  private loadTown(townData: any): void {
    console.log(`[DefaultWorldSystem] Loading town: ${townData.name} at (${townData.position.x}, ${townData.position.z})`);
    
    if (!THREE) {
      console.warn('[DefaultWorldSystem] THREE.js not available, skipping visual town creation');
      return;
    }

    // Create town marker cube (blue for safe zones)
    const geometry = new THREE.BoxGeometry(2, 1, 2);
    const material = new THREE.MeshBasicMaterial({ color: 0x0066ff });
    const townCube = new THREE.Mesh(geometry, material);
    
    townCube.position.set(townData.position.x, townData.position.y + 0.5, townData.position.z);
    townCube.userData = {
      id: townData.id,
      type: 'town',
      name: townData.name
    };

    this.addToWorld(townCube, 'town');

    // Register safe zone
    this.world.emit?.('rpg:safezone:register', {
      id: townData.id,
      center: townData.position,
      radius: townData.radius
    });

    // Add bank and store
    this.loadBankAndStore(townData);

    this.loadedEntities.set(townData.id, townCube);
  }

  private loadBankAndStore(townData: any): void {
    // Create bank building (green cube)
    if (THREE) {
      const bankGeometry = new THREE.BoxGeometry(1.5, 1.5, 1.5);
      const bankMaterial = new THREE.MeshBasicMaterial({ color: 0x00ff00 });
      const bankCube = new THREE.Mesh(bankGeometry, bankMaterial);
      
      bankCube.position.set(townData.position.x + 3, townData.position.y + 0.75, townData.position.z);
      bankCube.userData = {
        id: `${townData.id}_bank`,
        type: 'bank',
        interactable: true
      };

      this.addToWorld(bankCube, 'bank');

      // Create general store (yellow cube)
      const storeGeometry = new THREE.BoxGeometry(1.5, 1.5, 1.5);
      const storeMaterial = new THREE.MeshBasicMaterial({ color: 0xffff00 });
      const storeCube = new THREE.Mesh(storeGeometry, storeMaterial);
      
      storeCube.position.set(townData.position.x - 3, townData.position.y + 0.75, townData.position.z);
      storeCube.userData = {
        id: `${townData.id}_store`,
        type: 'general_store',
        interactable: true
      };

      this.addToWorld(storeCube, 'store');

      this.loadedEntities.set(`${townData.id}_bank`, bankCube);
      this.loadedEntities.set(`${townData.id}_store`, storeCube);
    }

    // Emit banking and store registration events
    this.world.emit?.('rpg:bank:register', {
      id: `${townData.id}_bank`,
      townId: townData.id,
      position: { x: townData.position.x + 3, y: townData.position.y, z: townData.position.z }
    });

    this.world.emit?.('rpg:store:register', {
      id: `${townData.id}_store`,
      townId: townData.id,
      position: { x: townData.position.x - 3, y: townData.position.y, z: townData.position.z },
      items: ['hatchet', 'fishing_rod', 'tinderbox', 'arrows']
    });
  }

  private loadResourceNodes(): void {
    const resourceNodes = [
      // Trees for woodcutting
      { type: 'tree', position: { x: 5, y: 0, z: 15 }, resourceType: 'logs' },
      { type: 'tree', position: { x: 8, y: 0, z: 18 }, resourceType: 'logs' },
      { type: 'tree', position: { x: -5, y: 0, z: 25 }, resourceType: 'logs' },
      
      // Fishing spots
      { type: 'fishing_spot', position: { x: 0, y: 0, z: 0 }, resourceType: 'raw_fish' },
      { type: 'fishing_spot', position: { x: -15, y: 0, z: 20 }, resourceType: 'raw_fish' }
    ];

    for (const node of resourceNodes) {
      this.loadResourceNode(node);
    }
  }

  private loadResourceNode(nodeData: any): void {
    console.log(`[DefaultWorldSystem] Loading ${nodeData.type} at (${nodeData.position.x}, ${nodeData.position.z})`);
    
    if (!THREE) return;

    let geometry, material, color;
    
    if (nodeData.type === 'tree') {
      geometry = new THREE.CylinderGeometry(0.3, 0.5, 2, 8);
      material = new THREE.MeshBasicMaterial({ color: 0x8B4513 }); // Brown
    } else if (nodeData.type === 'fishing_spot') {
      geometry = new THREE.SphereGeometry(0.5, 8, 6);
      material = new THREE.MeshBasicMaterial({ color: 0x0088ff }); // Water blue
    }

    const resourceMesh = new THREE.Mesh(geometry, material);
    resourceMesh.position.set(nodeData.position.x, nodeData.position.y + 1, nodeData.position.z);
    resourceMesh.userData = {
      id: `resource_${nodeData.type}_${Date.now()}`,
      type: nodeData.type,
      resourceType: nodeData.resourceType,
      interactable: true
    };

    this.addToWorld(resourceMesh, nodeData.type);

    // Register resource node
    this.world.emit?.('rpg:resource:register', {
      id: resourceMesh.userData.id,
      type: nodeData.type,
      resourceType: nodeData.resourceType,
      position: nodeData.position,
      harvestable: true
    });

    this.loadedEntities.set(resourceMesh.userData.id, resourceMesh);
  }

  private loadTerrainFeatures(): void {
    console.log('[DefaultWorldSystem] Loading terrain features...');
    
    // Create basic ground plane
    if (THREE) {
      const groundGeometry = new THREE.PlaneGeometry(100, 100);
      const groundMaterial = new THREE.MeshBasicMaterial({ 
        color: 0x228B22, // Forest green
        side: THREE.DoubleSide 
      });
      const ground = new THREE.Mesh(groundGeometry, groundMaterial);
      
      ground.rotation.x = -Math.PI / 2; // Rotate to be horizontal
      ground.position.y = -0.1; // Slightly below ground level
      ground.userData = {
        id: 'terrain_ground',
        type: 'terrain'
      };

      this.addToWorld(ground, 'terrain');

      this.loadedEntities.set('terrain_ground', ground);
    }
  }

  private initializeMobSpawns(): void {
    // Define mob spawn zones
    const mobSpawns = [
      {
        type: 'goblin',
        level: 1,
        positions: [
          { x: 20, y: 0, z: 5 },
          { x: 25, y: 0, z: 8 },
          { x: 18, y: 0, z: 12 }
        ]
      },
      {
        type: 'bandit',
        level: 1,
        positions: [
          { x: -10, y: 0, z: 40 },
          { x: -15, y: 0, z: 45 }
        ]
      }
    ];

    // Emit mob spawn zone registration
    for (const spawn of mobSpawns) {
      this.world.emit?.('rpg:mob:spawn_zone:register', {
        type: spawn.type,
        level: spawn.level,
        positions: spawn.positions
      });
    }

    console.log('[DefaultWorldSystem] Mob spawn zones initialized');
  }

  private initializeWorld(data: any): void {
    console.log('[DefaultWorldSystem] World initialization requested');
    this.initializeStarterWorld();
  }

  private loadRegion(data: { x: number; z: number; size: number }): void {
    console.log(`[DefaultWorldSystem] Loading region at (${data.x}, ${data.z})`);
    // Dynamic region loading logic would go here
  }

  private unloadRegion(data: { x: number; z: number }): void {
    console.log(`[DefaultWorldSystem] Unloading region at (${data.x}, ${data.z})`);
    // Dynamic region unloading logic would go here
  }

  // Helper method to add objects to the world
  private addToWorld(object: any, type: string): void {
    console.log(`[DefaultWorldSystem] Adding ${type} object to world...`);
    
    // Use the correct Hyperfy method: world.stage.scene.add()
    if (this.world3D && this.world3D.stage && this.world3D.stage.scene) {
      try {
        this.world3D.stage.scene.add(object);
        console.log(`[DefaultWorldSystem] ✅ Successfully added ${type} to world scene via world.stage.scene.add`);
        return;
      } catch (error) {
        console.error(`[DefaultWorldSystem] ❌ Error adding ${type} to world scene:`, error);
      }
    }

    // Fallback: try world.add if stage.scene not available
    if (this.world3D && typeof this.world3D.stage.scene.add === 'function') {
      try {
        this.world3D.stage.scene.add(object);
        console.log(`[DefaultWorldSystem] ✅ Successfully added ${type} to world via world.add`);
        return;
      } catch (error) {
        console.error(`[DefaultWorldSystem] ❌ Error adding ${type} to world via world.add:`, error);
      }
    }

    console.warn(`[DefaultWorldSystem] ⚠️ No suitable method found to add ${type} to world`);
    console.log(`[DefaultWorldSystem] World object structure:`, {
      hasWorld: !!this.world3D,
      hasStage: !!(this.world3D && this.world3D.stage),
      hasScene: !!(this.world3D && this.world3D.stage && this.world3D.stage.scene),
      sceneType: this.world3D?.stage?.scene?.type || 'N/A'
    });
  }

  // Public API
  getLoadedEntities(): Map<string, any> {
    return this.loadedEntities;
  }

  isEntityLoaded(entityId: string): boolean {
    return this.loadedEntities.has(entityId);
  }

  unloadEntity(entityId: string): boolean {
    const entity = this.loadedEntities.get(entityId);
    if (entity) {
      // Remove from 3D world
      if (this.world3D && this.world3D.remove) {
        this.world3D.remove(entity);
      }
      
      this.loadedEntities.delete(entityId);
      console.log(`[DefaultWorldSystem] Unloaded entity: ${entityId}`);
      return true;
    }
    return false;
  }

  update(dt: number): void {
    // Update any dynamic content as needed
  }

  destroy(): void {
    // Clean up all loaded entities
    for (const [id, entity] of this.loadedEntities) {
      if (this.world3D && this.world3D.remove) {
        this.world3D.remove(entity);
      }
    }
    this.loadedEntities.clear();
    console.log('[DefaultWorldSystem] System destroyed');
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
}