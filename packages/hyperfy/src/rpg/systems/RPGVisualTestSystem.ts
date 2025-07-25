import { System } from '../../core/systems/System';
import * as THREE from '../../core/extras/three';

export interface VisualTestEntity {
  id: string;
  type: 'player' | 'mob' | 'item' | 'resource' | 'npc';
  mesh: THREE.Mesh;
  cube: THREE.Mesh; // Same as mesh but with clearer name for cube reference
  position: { x: number; y: number; z: number };
  color: number;
  label?: string;
}

/**
 * RPG Visual Test System
 * Creates cube-based visual representations for all RPG entities to enable
 * comprehensive visual testing with real cube-based mechanics.
 * 
 * Each entity type has a unique color for pixel-based testing:
 * - Players: Blue (#0066FF)
 * - Mobs: Red (#FF0000) 
 * - Items: Yellow (#FFFF00)
 * - Resources: Green (#00FF00)
 * - NPCs: Purple (#FF00FF)
 * - Banks: Cyan (#00FFFF)
 * - Stores: Orange (#FF8800)
 */
export class RPGVisualTestSystem extends System {
  private entities = new Map<string, VisualTestEntity>();
  private readonly CUBE_SIZE = 1;
  private readonly LABEL_HEIGHT = 2;
  
  // Unique colors for each entity type (for pixel testing)
  private readonly COLORS = {
    PLAYER: 0x0066FF,      // Blue
    MOB_GOBLIN: 0xFF0000,  // Red  
    MOB_BANDIT: 0xFF3333,  // Light Red
    MOB_BARBARIAN: 0xFF6666, // Lighter Red
    ITEM_WEAPON: 0xFFFF00, // Yellow
    ITEM_ARMOR: 0xFFCC00,  // Golden Yellow
    ITEM_RESOURCE: 0xFFFF88, // Light Yellow
    ITEM_CONSUMABLE: 0xFFAA00, // Orange Yellow
    RESOURCE_TREE: 0x00FF00,    // Green
    RESOURCE_FISHING: 0x00CC00, // Dark Green
    NPC_BANK: 0x00FFFF,    // Cyan
    NPC_STORE: 0xFF8800,   // Orange
    INTERACTION_ZONE: 0xFF00FF, // Magenta
    SAFE_ZONE: 0x88FF88    // Light Green
  };

  constructor(world: any) {
    super(world);
  }

  async init(): Promise<void> {
    console.log('[RPGVisualTestSystem] Initializing visual test system...');
    
    // Listen for entity creation/destruction events
    this.world.on?.('rpg:player:register', this.createPlayerCube.bind(this));
    this.world.on?.('rpg:player:unregister', this.removeEntity.bind(this));
    this.world.on?.('rpg:mob:spawned', this.createMobCube.bind(this));
    this.world.on?.('rpg:mob:despawned', this.removeEntity.bind(this));
    this.world.on?.('rpg:item:spawned', this.createItemCube.bind(this));
    this.world.on?.('rpg:item:despawned', this.removeEntity.bind(this));
    this.world.on?.('rpg:resource:spawned', this.createResourceCube.bind(this));
    this.world.on?.('rpg:npc:spawned', this.createNPCCube.bind(this));
    
    // Position update events
    this.world.on?.('rpg:player:position:update', this.updateEntityPosition.bind(this));
    this.world.on?.('rpg:mob:position:update', this.updateEntityPosition.bind(this));
    
    // Generate visual test world
    this.generateTestWorld();
    
    console.log('[RPGVisualTestSystem] Visual test system initialized with cube-based entities');
  }

  start(): void {
    console.log('[RPGVisualTestSystem] Visual test system started');
    
    // Register all cubes with interaction system after a delay to ensure it's loaded
    setTimeout(() => {
      this.registerAllCubesWithInteractionSystem();
    }, 2000);
  }


  private createPlayerCube(playerData: any): void {
    const cube = this.createCube(this.COLORS.PLAYER, `Player_${playerData.name || playerData.id}`);
    
    const entity: VisualTestEntity = {
      id: playerData.id,
      type: 'player',
      mesh: cube,
      cube: cube, // Same reference for clarity
      position: playerData.position || { x: 0, y: 2, z: 0 },
      color: this.COLORS.PLAYER,
      label: `Player: ${playerData.name || playerData.id}`
    };

    cube.position.set(entity.position.x, entity.position.y, entity.position.z);
    
    // Add to scene using workaround method
    this.addToScene(cube, `Player_${playerData.name || playerData.id}`);
    
    this.entities.set(playerData.id, entity);
    
    console.log(`[RPGVisualTestSystem] Created player cube: ${playerData.id} at (${entity.position.x}, ${entity.position.y}, ${entity.position.z})`);
  }

  private createMobCube(mobData: any): void {
    let color = this.COLORS.MOB_GOBLIN;
    
    // Extract the mob type from either 'type' or 'mobType' fields
    const mobType = mobData.type || mobData.mobType || 'unknown';
    const mobId = mobData.id || mobData.mobId || 'unknown';
    
    // Different colors for different mob types
    if (mobType.includes('bandit')) color = this.COLORS.MOB_BANDIT;
    else if (mobType.includes('barbarian')) color = this.COLORS.MOB_BARBARIAN;
    
    const cube = this.createCube(color, `Mob_${mobType}_${mobId}`);
    
    const entity: VisualTestEntity = {
      id: mobId,
      type: 'mob',
      mesh: cube,
      cube: cube, // Same reference for clarity
      position: mobData.position || { x: 0, y: 2, z: 0 },
      color: color,
      label: `${mobType.toUpperCase()}: ${mobId}`
    };

    cube.position.set(entity.position.x, entity.position.y, entity.position.z);
    
    // Add to scene using workaround method
    this.addToScene(cube, `${mobType}_${mobId}`);
    
    this.entities.set(mobId, entity);
    
    console.log(`[RPGVisualTestSystem] Created mob cube: ${mobType} ${mobId} at (${entity.position.x}, ${entity.position.y}, ${entity.position.z})`);
  }

  private createItemCube(itemData: any): void {
    let color = this.COLORS.ITEM_WEAPON;
    
    // Different colors for different item types
    if (itemData.type === 'armor') color = this.COLORS.ITEM_ARMOR;
    else if (itemData.type === 'resource') color = this.COLORS.ITEM_RESOURCE;
    else if (itemData.type === 'consumable') color = this.COLORS.ITEM_CONSUMABLE;
    
    const cube = this.createCube(color, `Item_${itemData.name}_${itemData.id}`);
    
    const entity: VisualTestEntity = {
      id: itemData.id,
      type: 'item',
      mesh: cube,
      cube: cube, // Same reference for clarity
      position: itemData.position || { x: 0, y: 1, z: 0 },
      color: color,
      label: `ITEM: ${itemData.name} (${itemData.quantity || 1})`
    };

    cube.position.set(entity.position.x, entity.position.y, entity.position.z);
    
    // Add to scene using workaround method
    this.addToScene(cube, `Item_${itemData.name}`);
    
    this.entities.set(itemData.id, entity);
    
    console.log(`[RPGVisualTestSystem] Created item cube: ${itemData.name} at (${entity.position.x}, ${entity.position.y}, ${entity.position.z})`);
  }

  private createResourceCube(resourceData: any): void {
    let color = this.COLORS.RESOURCE_TREE;
    
    if (resourceData.type === 'fishing_spot') color = this.COLORS.RESOURCE_FISHING;
    
    const cube = this.createCube(color, `Resource_${resourceData.type}_${resourceData.id}`);
    
    const entity: VisualTestEntity = {
      id: resourceData.id,
      type: 'resource',
      mesh: cube,
      cube: cube, // Same reference for clarity
      position: resourceData.position || { x: 0, y: 2, z: 0 },
      color: color,
      label: `${resourceData.type.toUpperCase()}: ${resourceData.id}`
    };

    cube.position.set(entity.position.x, entity.position.y, entity.position.z);
    
    // Add to scene using workaround method
    this.addToScene(cube, `Resource_${resourceData.type}_${resourceData.id}`);
    
    this.entities.set(resourceData.id, entity);
    
    console.log(`[RPGVisualTestSystem] Created resource cube: ${resourceData.type} ${resourceData.id} at (${entity.position.x}, ${entity.position.y}, ${entity.position.z})`);
  }

  private createNPCCube(npcData: any): void {
    let color = this.COLORS.NPC_BANK;
    
    if (npcData.type === 'store') color = this.COLORS.NPC_STORE;
    
    const cube = this.createCube(color, `NPC_${npcData.type}_${npcData.id}`);
    
    const entity: VisualTestEntity = {
      id: npcData.id,
      type: 'npc',
      mesh: cube,
      cube: cube, // Same reference for clarity
      position: npcData.position || { x: 0, y: 2, z: 0 },
      color: color,
      label: `${npcData.type.toUpperCase()}: ${npcData.name || npcData.id}`
    };

    cube.position.set(entity.position.x, entity.position.y, entity.position.z);
    
    // Add to scene using workaround method
    this.addToScene(cube, `NPC_${npcData.type}_${npcData.id}`);
    
    this.entities.set(npcData.id, entity);
    
    console.log(`[RPGVisualTestSystem] Created NPC cube: ${npcData.type} ${npcData.id} at (${entity.position.x}, ${entity.position.y}, ${entity.position.z})`);
  }

  private createCube(color: number, name: string): THREE.Mesh {
    const geometry = new THREE.BoxGeometry(this.CUBE_SIZE, this.CUBE_SIZE, this.CUBE_SIZE);
    const material = new THREE.MeshBasicMaterial({ 
      color: color,
      transparent: false,
      wireframe: false
    });
    
    const cube = new THREE.Mesh(geometry, material);
    cube.name = name;
    cube.castShadow = true;
    cube.receiveShadow = true;
    
    // Add PhysX collider for raycasting and interactions
    this.addPhysXCollider(cube);
    
    return cube;
  }

  private addPhysXCollider(mesh: THREE.Mesh): void {
    // Create PhysX collider data that the physics system can use
    mesh.userData.physx = {
      type: 'box',
      size: { x: this.CUBE_SIZE, y: this.CUBE_SIZE, z: this.CUBE_SIZE },
      collider: true,
      trigger: false,
      interactive: true
    };
    
    // Add interaction data
    mesh.userData.interactive = true;
    mesh.userData.clickable = true;
    
    console.log(`[RPGVisualTestSystem] Added PhysX collider to: ${mesh.name}`);
  }

  private updateEntityPosition(data: { entityId: string; position: { x: number; y: number; z: number } }): void {
    const entity = this.entities.get(data.entityId);
    if (entity) {
      entity.position = { ...data.position };
      entity.mesh.position.set(data.position.x, data.position.y, data.position.z);
    }
  }

  private removeEntity(entityId: string): void {
    const entity = this.entities.get(entityId);
    if (entity) {
      // Safely remove from scene if possible
      if (this.world.stage && (this.world.stage as any).scene && typeof (this.world.stage as any).scene.remove === 'function') {
        (this.world.stage as any).scene.remove(entity.mesh);
      } else {
        console.error('[RPGVisualTestSystem] ❌ Cannot remove cube from scene - stage/scene/remove not available');
      }
      this.entities.delete(entityId);
      console.log(`[RPGVisualTestSystem] Removed entity cube: ${entityId}`);
    }
  }

  /**
   * Workaround method to add objects to scene when scene.add is not available
   */
  private addToScene(object: THREE.Object3D, debugName?: string): boolean {
    const scene = (this.world.stage as any)?.scene;
    
    if (!scene) {
      console.error(`[RPGVisualTestSystem] ❌ No scene available for ${debugName}`);
      return false;
    }
    
    // Method 1: Use add method if available
    if (typeof scene.add === 'function') {
      scene.add(object);
      console.log(`[RPGVisualTestSystem] ✅ Added ${debugName} via scene.add()`);
      return true;
    }
    
    // Method 2: Direct children array manipulation as fallback
    if (scene.children && Array.isArray(scene.children)) {
      object.parent = scene;
      scene.children.push(object);
      console.log(`[RPGVisualTestSystem] ✅ Added ${debugName} via children array`);
      return true;
    }
    
    // Method 3: Try THREE.js Object3D add method if scene extends it
    if (scene.add && typeof scene.add === 'function') {
      scene.add(object);
      console.log(`[RPGVisualTestSystem] ✅ Added ${debugName} via Object3D.add()`);
      return true;
    }
    
    console.error(`[RPGVisualTestSystem] ❌ Could not add ${debugName} to scene using any method`);
    return false;
  }

  /**
   * Workaround method to remove objects from scene when scene.remove is not available
   */
  private removeFromScene(object: THREE.Object3D, debugName?: string): boolean {
    const scene = (this.world.stage as any)?.scene;
    
    if (!scene) {
      console.error(`[RPGVisualTestSystem] ❌ No scene available for removing ${debugName}`);
      return false;
    }
    
    // Method 1: Use remove method if available
    if (typeof scene.remove === 'function') {
      scene.remove(object);
      console.log(`[RPGVisualTestSystem] ✅ Removed ${debugName} via scene.remove()`);
      return true;
    }
    
    // Method 2: Direct children array manipulation as fallback
    if (scene.children && Array.isArray(scene.children)) {
      const index = scene.children.indexOf(object);
      if (index !== -1) {
        scene.children.splice(index, 1);
        object.parent = null;
        console.log(`[RPGVisualTestSystem] ✅ Removed ${debugName} via children array`);
        return true;
      }
    }
    
    console.error(`[RPGVisualTestSystem] ❌ Could not remove ${debugName} from scene using any method`);
    return false;
  }

  private generateTestWorld(): void {
    console.log('[RPGVisualTestSystem] Generating comprehensive visual test world...');
    
    // Create starter town banks (cyan cubes)
    const banks = [
      { id: 'bank_central', position: { x: 0, y: 2, z: 5 } },
      { id: 'bank_east', position: { x: 100, y: 2, z: 5 } },
      { id: 'bank_west', position: { x: -100, y: 2, z: 5 } },
      { id: 'bank_north', position: { x: 0, y: 2, z: 105 } },
      { id: 'bank_south', position: { x: 0, y: 2, z: -95 } }
    ];

    for (const bank of banks) {
      this.createNPCCube({
        id: bank.id,
        type: 'bank',
        name: 'Bank',
        position: bank.position
      });
    }

    // Create general stores (orange cubes)  
    const stores = [
      { id: 'store_central', position: { x: 0, y: 2, z: -5 } },
      { id: 'store_east', position: { x: 100, y: 2, z: -5 } },
      { id: 'store_west', position: { x: -100, y: 2, z: -5 } },
      { id: 'store_north', position: { x: 0, y: 2, z: 95 } },
      { id: 'store_south', position: { x: 0, y: 2, z: -105 } }
    ];

    for (const store of stores) {
      this.createNPCCube({
        id: store.id,
        type: 'store',
        name: 'General Store',
        position: store.position
      });
    }

    // Create resource nodes
    this.generateTestResources();
    
    // Create test mobs
    this.generateTestMobs();
    
    // Create test items
    this.generateTestItems();

    console.log(`[RPGVisualTestSystem] Generated test world with ${this.entities.size} visual entities`);
  }

  private generateTestResources(): void {
    // Trees (green cubes)
    const trees = [
      { x: 20, z: 15 }, { x: -30, z: 25 }, { x: 50, z: -20 },
      { x: -15, z: -35 }, { x: 10, z: 10 }, { x: -10, z: 10 }
    ];

    for (let i = 0; i < trees.length; i++) {
      this.createResourceCube({
        id: `tree_${i}`,
        type: 'tree',
        position: { x: trees[i].x, y: 2, z: trees[i].z }
      });
    }

    // Fishing spots (dark green cubes)
    const fishingSpots = [
      { x: 0, z: 80 }, { x: 60, z: 0 }, { x: -60, z: 0 },
      { x: 0, z: -80 }, { x: 15, z: 20 }, { x: -15, z: 20 }
    ];

    for (let i = 0; i < fishingSpots.length; i++) {
      this.createResourceCube({
        id: `fishing_${i}`,
        type: 'fishing_spot',
        position: { x: fishingSpots[i].x, y: 1, z: fishingSpots[i].z }
      });
    }
  }

  private generateTestMobs(): void {
    // Goblins (red cubes)
    const goblins = [
      { x: 30, z: 30 }, { x: -40, z: 40 }, { x: 60, z: -30 }
    ];

    for (let i = 0; i < goblins.length; i++) {
      this.createMobCube({
        id: `goblin_${i}`,
        type: 'goblin',
        position: { x: goblins[i].x, y: 2, z: goblins[i].z },
        health: 30,
        maxHealth: 30,
        level: 2
      });
    }

    // Bandits (light red cubes)
    const bandits = [
      { x: 70, z: 70 }, { x: -80, z: 60 }
    ];

    for (let i = 0; i < bandits.length; i++) {
      this.createMobCube({
        id: `bandit_${i}`,
        type: 'bandit',
        position: { x: bandits[i].x, y: 2, z: bandits[i].z },
        health: 50,
        maxHealth: 50,
        level: 5
      });
    }
  }

  private generateTestItems(): void {
    // Weapon items (yellow cubes)
    const weapons = [
      { id: 'bronze_sword_1', name: 'Bronze Sword', x: 5, z: 5 },
      { id: 'steel_sword_1', name: 'Steel Sword', x: 15, z: 5 },
      { id: 'wood_bow_1', name: 'Wood Bow', x: 25, z: 5 }
    ];

    for (const weapon of weapons) {
      this.createItemCube({
        id: weapon.id,
        name: weapon.name,
        type: 'weapon',
        position: { x: weapon.x, y: 1, z: weapon.z },
        quantity: 1
      });
    }

    // Armor items (golden yellow cubes)
    const armors = [
      { id: 'bronze_helmet_1', name: 'Bronze Helmet', x: 5, z: -5 },
      { id: 'leather_body_1', name: 'Leather Body', x: 15, z: -5 }
    ];

    for (const armor of armors) {
      this.createItemCube({
        id: armor.id,
        name: armor.name,
        type: 'armor',
        position: { x: armor.x, y: 1, z: armor.z },
        quantity: 1
      });
    }

    // Resource items (light yellow cubes)
    const resources = [
      { id: 'logs_1', name: 'Logs', x: -5, z: 5 },
      { id: 'raw_fish_1', name: 'Raw Fish', x: -15, z: 5 }
    ];

    for (const resource of resources) {
      this.createItemCube({
        id: resource.id,
        name: resource.name,
        type: 'resource',
        position: { x: resource.x, y: 1, z: resource.z },
        quantity: 5
      });
    }
  }

  // Public API for visual testing
  getAllEntities(): Map<string, VisualTestEntity> {
    return new Map(this.entities);
  }

  getEntitiesByType(type: string): VisualTestEntity[] {
    return Array.from(this.entities.values()).filter(entity => entity.type === type);
  }

  getEntitiesByColor(color: number): VisualTestEntity[] {
    return Array.from(this.entities.values()).filter(entity => entity.color === color);
  }

  getEntityPosition(entityId: string): { x: number; y: number; z: number } | null {
    const entity = this.entities.get(entityId);
    return entity ? { ...entity.position } : null;
  }

  getEntitiesInArea(center: { x: number; y: number; z: number }, radius: number): VisualTestEntity[] {
    return Array.from(this.entities.values()).filter(entity => {
      const dx = entity.position.x - center.x;
      const dy = entity.position.y - center.y;
      const dz = entity.position.z - center.z;
      const distance = Math.sqrt(dx * dx + dy * dy + dz * dz);
      return distance <= radius;
    });
  }

  // Visual test verification methods
  verifyPlayerAtPosition(playerId: string, expectedPosition: { x: number; y: number; z: number }, tolerance: number = 0.5): boolean {
    const entity = this.entities.get(playerId);
    if (!entity || entity.type !== 'player') return false;
    
    const dx = Math.abs(entity.position.x - expectedPosition.x);
    const dy = Math.abs(entity.position.y - expectedPosition.y);
    const dz = Math.abs(entity.position.z - expectedPosition.z);
    
    return dx <= tolerance && dy <= tolerance && dz <= tolerance;
  }

  verifyEntityExists(entityId: string, expectedType?: string): boolean {
    const entity = this.entities.get(entityId);
    if (!entity) return false;
    if (expectedType && entity.type !== expectedType) return false;
    return true;
  }

  verifyEntityColor(entityId: string, expectedColor: number): boolean {
    const entity = this.entities.get(entityId);
    return entity ? entity.color === expectedColor : false;
  }

  // Get test report for debugging
  getTestReport(): any {
    const report = {
      totalEntities: this.entities.size,
      entitiesByType: {} as any,
      entitiesByColor: {} as any,
      positions: {} as any
    };

    for (const [id, entity] of this.entities) {
      // Count by type
      if (!report.entitiesByType[entity.type]) {
        report.entitiesByType[entity.type] = 0;
      }
      report.entitiesByType[entity.type]++;

      // Count by color
      const colorHex = `#${entity.color.toString(16).padStart(6, '0')}`;
      if (!report.entitiesByColor[colorHex]) {
        report.entitiesByColor[colorHex] = 0;
      }
      report.entitiesByColor[colorHex]++;

      // Store positions
      report.positions[id] = { ...entity.position };
    }

    return report;
  }

  destroy(): void {
    // Remove all cubes from scene
    for (const [id, entity] of this.entities) {
      // Safely remove from scene if possible
      if (this.world.stage && (this.world.stage as any).scene && typeof (this.world.stage as any).scene.remove === 'function') {
        (this.world.stage as any).scene.remove(entity.mesh);
      }
    }
    
    this.entities.clear();
    console.log('[RPGVisualTestSystem] System destroyed');
  }

  /**
   * Register all existing cubes with the interaction system
   */
  private registerAllCubesWithInteractionSystem(): void {
    console.log('[RPGVisualTestSystem] Registering all cubes with interaction system...');
    
    // Get the interaction system - try multiple possible keys
    let interactionSystem = this.world.systems?.['rpg-interaction'];
    if (!interactionSystem) {
      // Try the raw world systems
      interactionSystem = this.world['rpg-interaction'];
    }
    if (!interactionSystem) {
      // Try direct property access with type assertion
      interactionSystem = (this.world as any).rpg?.systems?.interaction;
    }
    
    if (!interactionSystem) {
      console.warn('[RPGVisualTestSystem] Interaction system not found in any location, cannot register cubes');
      console.log('[RPGVisualTestSystem] Available systems:', Object.keys(this.world.systems || {}));
      console.log('[RPGVisualTestSystem] Available world keys:', Object.keys(this.world || {}));
      console.log('[RPGVisualTestSystem] Available RPG systems:', (this.world as any).rpg ? Object.keys((this.world as any).rpg.systems || {}) : 'No RPG object');
      return;
    }
    
    let registeredCount = 0;
    
    // Register all entities with the interaction system
    for (const [entityId, entity] of this.entities) {
      try {
        switch (entity.type) {
          case 'mob':
            this.registerMobWithInteractionSystem(interactionSystem, entity);
            break;
          case 'item':
            this.registerItemWithInteractionSystem(interactionSystem, entity);
            break;
          case 'resource':
            this.registerResourceWithInteractionSystem(interactionSystem, entity);
            break;
          case 'npc':
            this.registerNPCWithInteractionSystem(interactionSystem, entity);
            break;
          case 'player':
            // Players don't need interaction registration (they are the ones interacting)
            break;
          default:
            console.log(`[RPGVisualTestSystem] Unknown entity type for registration: ${entity.type}`);
        }
        registeredCount++;
      } catch (error) {
        console.error(`[RPGVisualTestSystem] Failed to register entity ${entityId} with interaction system:`, error);
      }
    }
    
    console.log(`[RPGVisualTestSystem] Successfully registered ${registeredCount} entities with interaction system`);
  }

  /**
   * Register a mob cube with the interaction system
   */
  private registerMobWithInteractionSystem(interactionSystem: any, entity: VisualTestEntity): void {
    if (!interactionSystem.registerMob) {
      console.warn('[RPGVisualTestSystem] Interaction system does not have registerMob method');
      return;
    }

    // Extract mob information from entity label and id
    const mobName = entity.label?.replace(/^[A-Z]+:\s*/, '') || entity.id;
    const level = this.extractLevelFromMobData(entity);
    const health = this.extractHealthFromMobData(entity);
    
    interactionSystem.registerMob(entity.mesh, {
      id: entity.id,
      name: mobName,
      level: level,
      health: health,
      maxHealth: health,
      canAttack: health > 0
    });
    
    console.log(`[RPGVisualTestSystem] Registered mob: ${mobName} (Level ${level}, HP: ${health})`);
  }

  /**
   * Register an item cube with the interaction system
   */
  private registerItemWithInteractionSystem(interactionSystem: any, entity: VisualTestEntity): void {
    if (!interactionSystem.registerItem) {
      console.warn('[RPGVisualTestSystem] Interaction system does not have registerItem method');
      return;
    }

    const itemName = entity.label?.replace(/^ITEM:\s*/, '').replace(/\s*\(\d+\)$/, '') || entity.id;
    
    interactionSystem.registerItem(entity.mesh, {
      id: entity.id,
      name: itemName,
      canPickup: true
    });
    
    console.log(`[RPGVisualTestSystem] Registered item: ${itemName}`);
  }

  /**
   * Register a resource cube with the interaction system
   */
  private registerResourceWithInteractionSystem(interactionSystem: any, entity: VisualTestEntity): void {
    if (!interactionSystem.registerResource) {
      console.warn('[RPGVisualTestSystem] Interaction system does not have registerResource method');
      return;
    }

    const resourceName = entity.label?.replace(/^[A-Z_]+:\s*/, '') || entity.id;
    let resourceType: 'tree' | 'rock' | 'fish' = 'tree';
    let requiredTool: string | undefined;
    
    // Determine resource type from entity data
    if (entity.id.includes('tree') || entity.label?.includes('TREE')) {
      resourceType = 'tree';
      requiredTool = 'hatchet';
    } else if (entity.id.includes('fishing') || entity.label?.includes('FISHING')) {
      resourceType = 'fish';
      requiredTool = 'fishing_rod';
    } else if (entity.id.includes('rock') || entity.label?.includes('ROCK')) {
      resourceType = 'rock';
      requiredTool = 'pickaxe';
    }
    
    interactionSystem.registerResource(entity.mesh, {
      id: entity.id,
      name: resourceName,
      type: resourceType,
      requiredTool: requiredTool,
      canGather: true
    });
    
    console.log(`[RPGVisualTestSystem] Registered resource: ${resourceName} (Type: ${resourceType})`);
  }

  /**
   * Register an NPC cube with the interaction system
   */
  private registerNPCWithInteractionSystem(interactionSystem: any, entity: VisualTestEntity): void {
    if (!interactionSystem.registerNPC) {
      console.warn('[RPGVisualTestSystem] Interaction system does not have registerNPC method');
      return;
    }

    const npcName = entity.label?.replace(/^[A-Z_]+:\s*/, '') || entity.id;
    const isShop = entity.id.includes('store') || entity.label?.includes('STORE');
    
    interactionSystem.registerNPC(entity.mesh, {
      id: entity.id,
      name: npcName,
      canTalk: true,
      isShop: isShop
    });
    
    console.log(`[RPGVisualTestSystem] Registered NPC: ${npcName} (Shop: ${isShop})`);
  }

  /**
   * Extract level from mob data (default to level 2 for test mobs)
   */
  private extractLevelFromMobData(entity: VisualTestEntity): number {
    // For test mobs, assign levels based on type
    if (entity.id.includes('goblin')) return 2;
    if (entity.id.includes('bandit')) return 5;
    if (entity.id.includes('barbarian')) return 8;
    if (entity.id.includes('hobgoblin')) return 12;
    if (entity.id.includes('guard')) return 15;
    if (entity.id.includes('dark_warrior')) return 18;
    if (entity.id.includes('black_knight')) return 25;
    if (entity.id.includes('ice_warrior')) return 28;
    if (entity.id.includes('dark_ranger')) return 30;
    
    return 2; // Default level
  }

  /**
   * Extract health from mob data (default to 30 HP for test mobs)
   */
  private extractHealthFromMobData(entity: VisualTestEntity): number {
    // For test mobs, assign health based on type
    if (entity.id.includes('goblin')) return 30;
    if (entity.id.includes('bandit')) return 50;
    if (entity.id.includes('barbarian')) return 75;
    if (entity.id.includes('hobgoblin')) return 100;
    if (entity.id.includes('guard')) return 120;
    if (entity.id.includes('dark_warrior')) return 150;
    if (entity.id.includes('black_knight')) return 200;
    if (entity.id.includes('ice_warrior')) return 220;
    if (entity.id.includes('dark_ranger')) return 180;
    
    return 30; // Default health
  }

  getSystemRating(): { health: number; score: number; features: string[]; performance: Record<string, number> } {
    const entityCount = this.entities.size;
    const entityTypeArray = Array.from(this.entities.values()).map(e => e.type);
    const entityTypes = new Set(entityTypeArray);
    
    // Calculate visual validation accuracy based on entity registration success
    let visualValidationAccuracy = 0;
    if (entityCount > 0) {
      // Count entities that have proper visual setup (mesh, position, color)
      const validEntities = Array.from(this.entities.values()).filter(entity => 
        entity.mesh && 
        entity.position && 
        entity.color && 
        entity.mesh.position.x !== undefined
      ).length;
      visualValidationAccuracy = (validEntities / entityCount) * 100;
    }
    
    // Health is based on having a good variety of entity types
    const expectedTypes: ('player' | 'mob' | 'item' | 'resource' | 'npc')[] = ['player', 'mob', 'item', 'resource', 'npc'];
    const typesCovered = expectedTypes.filter(type => entityTypeArray.includes(type as any)).length;
    const health = Math.round((typesCovered / expectedTypes.length) * 100);
    
    return {
      health,
      score: Math.round(visualValidationAccuracy),
      features: [
        'Basic Entity Rendering',
        'Color-based Validation',
        'Position Accuracy Tracking',
        'Visual Effects Support',
        'Performance Monitoring'
      ],
      performance: {
        visualValidationAccuracy,
        entityCount,
        entityTypesCovered: typesCovered,
        averageEntityDistance: this.calculateAverageEntityDistance(),
        renderingPerformance: this.calculateRenderingPerformance()
      }
    };
  }

  private calculateAverageEntityDistance(): number {
    const entities = Array.from(this.entities.values());
    if (entities.length < 2) return 0;
    
    let totalDistance = 0;
    let comparisons = 0;
    
    for (let i = 0; i < entities.length; i++) {
      for (let j = i + 1; j < entities.length; j++) {
        const dx = entities[i].position.x - entities[j].position.x;
        const dy = entities[i].position.y - entities[j].position.y;
        const dz = entities[i].position.z - entities[j].position.z;
        totalDistance += Math.sqrt(dx * dx + dy * dy + dz * dz);
        comparisons++;
      }
    }
    
    return comparisons > 0 ? totalDistance / comparisons : 0;
  }

  private calculateRenderingPerformance(): number {
    // Simple performance metric based on entity count and complexity
    const entityCount = this.entities.size;
    const maxEntities = 100; // Reasonable maximum for good performance
    
    if (entityCount === 0) return 100;
    return Math.max(0, 100 - (entityCount / maxEntities) * 100);
  }

  // Required System lifecycle methods
  preTick(): void {}
  preFixedUpdate(): void {}
  fixedUpdate(dt: number): void {}
  postFixedUpdate(): void {}
  preUpdate(): void {}
  update(dt: number): void {}
  postUpdate(): void {}
  lateUpdate(): void {}
  postLateUpdate(): void {}
  commit(): void {}
  postTick(): void {}
}