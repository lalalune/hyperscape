import THREE from '../extras/three';
import { getSystem } from '../utils/SystemUtils';
import type { World } from '../types/index';
import { SystemBase } from './SystemBase';
import { groundToTerrain } from '../utils/EntityUtils';

import { EventType } from '../types/events';
import type { Player, InteractionSystem, Item, MobInstance, NPC, Resource } from '../types/core';
import { AttackType, EquipmentSlotName, ItemType, VisualTestEntity } from '../types/core';
import { MobType, ItemRarity } from '../types/entities';
import { MetricsCollector } from '../utils/MetricsCollector';

/**
 * Visual Test System
 * Creates cube-based visual representations for all entities to enable
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
export class VisualTestSystem extends SystemBase {
  private entities = new Map<string, VisualTestEntity>();
  private readonly CUBE_SIZE = 1;
  private readonly LABEL_HEIGHT = 2;
  private metricsCollector: MetricsCollector;
  
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

  constructor(world: World) {
    super(world, {
      name: 'visual-test',
      dependencies: {
        required: [],
        optional: ['player', 'mob', 'item', 'resource', 'npc']
      },
      autoCleanup: true
    });
    this.metricsCollector = MetricsCollector.getInstance();
  }

  async init(): Promise<void> {
    
    // Listen for entity creation/destruction events
    this.subscribe(EventType.PLAYER_REGISTERED, (data: Player) => this.createPlayerCube(data));
    this.subscribe(EventType.PLAYER_UNREGISTERED, (data: { id: string }) => this.removeEntity(data.id));
    this.subscribe(EventType.MOB_SPAWNED, (data: MobInstance) => this.createMobCube(data));
    this.subscribe(EventType.MOB_DESPAWNED, (data: { id: string }) => this.removeEntity(data.id));
    // Disabled automatic item cube creation - causes duplicate visual items in loot tests
    // this.world.on(EventType.ITEM_SPAWNED, this.createItemCube.bind(this));
    this.subscribe(EventType.ITEM_DESPAWNED, (data: { id: string }) => this.removeEntity(data.id));
    this.subscribe(EventType.RESOURCE_SPAWNED, (data: Resource) => this.createResourceCube(data));
    this.subscribe(EventType.NPC_SPAWNED, (data: NPC) => this.createNPCCube(data));
    
    // Position update events
    this.subscribe(EventType.PLAYER_POSITION_UPDATED, (data: { playerId: string; position: { x: number; y: number; z: number } }) => this.updateEntityPosition({ entityId: data.playerId, position: data.position }));
    this.subscribe(EventType.MOB_POSITION_UPDATED, (data: { mobId: string; position: { x: number; y: number; z: number } }) => this.updateEntityPosition({ entityId: data.mobId, position: data.position }));
    
    // Generate visual test world
    this.generateTestWorld();
    
  }

  start(): void {
    
    // Register all cubes with interaction system after a delay to ensure it's loaded
    setTimeout(() => {
      this.registerAllCubesWithInteractionSystem();
    }, 2000);
  }


  private createPlayerCube(playerData: Player): void {
    const cube = this.createCube(this.COLORS.PLAYER, `Player_${playerData.name || playerData.id}`);
    
    // Default position if not provided
    const position = playerData.position || { x: 0, y: 0, z: 0 };
    
    const entity: VisualTestEntity = {
      id: playerData.id,
      type: 'player',
      mesh: cube,
      cube: cube, // Same reference for clarity
      position: position,
      color: this.COLORS.PLAYER,
      label: `Player: ${playerData.name || playerData.id}`
    };

    cube.position.set(position.x, position.y, position.z);
    
    // Add to scene
    this.addToScene(cube);
    
    this.entities.set(playerData.id, entity);
    
  }

  private createMobCube(mobData: MobInstance): void {
    let color = this.COLORS.MOB_GOBLIN;
    
    // Extract the mob type and id
    const mobType = mobData.type || 'unknown';
    const mobId = mobData.id || 'unknown';
    
    // Different colors for different mob types
    if (mobType.includes('bandit')) color = this.COLORS.MOB_BANDIT;
    else if (mobType.includes('barbarian')) color = this.COLORS.MOB_BARBARIAN;
    
    const cube = this.createCube(color, `Mob_${mobType}_${mobId}`);
    
    // Ground position to terrain
    const position = mobData.position || { x: 0, y: 0, z: 0 };
    const groundedPosition = groundToTerrain(this.world, position, 1.0, Infinity);
    
    const entity: VisualTestEntity = {
      id: mobId,
      type: 'mob',
      mesh: cube,
      cube: cube, // Same reference for clarity
      position: groundedPosition,
      color: color,
      label: `${mobType.toUpperCase()}: ${mobId}`
    };

    cube.position.set(entity.position.x, entity.position.y, entity.position.z);
    
    // Add to scene
    this.addToScene(cube);
    
    this.entities.set(mobId, entity);
    
  }

  private createItemCube(itemData: Item): void {
    // Validate required fields
    if (!itemData) {
      console.warn('[VisualTestSystem] createItemCube called with null/undefined itemData');
      return;
    }
    
    const itemName = itemData.name || 'UnknownItem';
    const itemId = itemData.id || `item_${Date.now()}`;
    const itemType = itemData.type || ItemType.MISC;
    
    let color = this.COLORS.ITEM_WEAPON;
    
    // Different colors for different item types
    if (itemType === ItemType.ARMOR) color = this.COLORS.ITEM_ARMOR;
    else if (itemType === ItemType.RESOURCE) color = this.COLORS.ITEM_RESOURCE;
    else if (itemType === ItemType.CONSUMABLE) color = this.COLORS.ITEM_CONSUMABLE;
    
    const cube = this.createCube(color, `Item_${itemName}_${itemId}`);
    
    // Ground position to terrain
    const position = { x: 0, y: 0, z: 0 }; // Items don't have positions in their definition
    const groundedPosition = groundToTerrain(this.world, position, 0.5, Infinity);
    
    const entity: VisualTestEntity = {
      id: itemId,
      type: 'item',
      mesh: cube,
      cube: cube, // Same reference for clarity
      position: groundedPosition,
      color: color,
      label: `ITEM: ${itemName}`
    };

    cube.position.set(entity.position.x, entity.position.y, entity.position.z);
    
    // Add to scene
    this.addToScene(cube);
    
    this.entities.set(itemId, entity);
    
  }

  private createResourceCube(resourceData: Resource): void {
    let color = this.COLORS.RESOURCE_TREE;
    
    if (resourceData.type === 'fishing_spot') color = this.COLORS.RESOURCE_FISHING;
    
    const cube = this.createCube(color, `Resource_${resourceData.type}_${resourceData.id}`);
    
    // Ground position to terrain
    const position = resourceData.position || { x: 0, y: 0, z: 0 };
    const groundedPosition = groundToTerrain(this.world, position, 0.5, Infinity);
    
    const entity: VisualTestEntity = {
      id: resourceData.id,
      type: 'resource',
      mesh: cube,
      cube: cube, // Same reference for clarity
      position: groundedPosition,
      color: color,
      label: `${resourceData.type.toUpperCase()}: ${resourceData.id}`
    };

    cube.position.set(entity.position.x, entity.position.y, entity.position.z);
    
    // Add to scene
    this.addToScene(cube);
    
    this.entities.set(resourceData.id, entity);
    
  }

  private createNPCCube(npcData: NPC): void {
    let color = this.COLORS.NPC_BANK;
    
    if (npcData.type === 'store') color = this.COLORS.NPC_STORE;
    
    const cube = this.createCube(color, `NPC_${npcData.type}_${npcData.id}`);
    
    // Ground position to terrain
    const position = npcData.position || { x: 0, y: 0, z: 0 };
    const groundedPosition = groundToTerrain(this.world, position, 1.0, Infinity);
    
    const entity: VisualTestEntity = {
      id: npcData.id,
      type: 'npc',
      mesh: cube,
      cube: cube, // Same reference for clarity
      position: groundedPosition,
      color: color,
      label: `${npcData.type.toUpperCase()}: ${npcData.name || npcData.id}`
    };

    cube.position.set(entity.position.x, entity.position.y, entity.position.z);
    
    // Add to scene
    this.addToScene(cube);
    
    this.entities.set(npcData.id, entity);
    
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
    if (!entity) return;
    
    // Remove from scene
    this.world.stage.scene.remove(entity.mesh);
    this.entities.delete(entityId);
  }

  /**
   * Add objects to scene
   */
  private addToScene(object: THREE.Mesh): boolean {
    const scene = this.world.stage.scene as THREE.Scene;
    scene.add(object);
    return true;
  }

  private generateTestWorld(): void {
    
    // Create starter town banks (cyan cubes)
    // Y will be grounded to terrain by the cube creation
    const banks = [
      { id: 'bank_central', position: { x: 0, y: 0, z: 5 } },
      { id: 'bank_east', position: { x: 100, y: 0, z: 5 } },
      { id: 'bank_west', position: { x: -100, y: 0, z: 5 } },
      { id: 'bank_north', position: { x: 0, y: 0, z: 105 } },
      { id: 'bank_south', position: { x: 0, y: 0, z: -95 } }
    ];

    for (const bank of banks) {
      this.createNPCCube({
        id: bank.id,
        type: 'bank',
        name: 'Bank',
        position: bank.position,
        dialogue: ['Welcome to the bank!', 'How can I help you today?'],
        shopItems: [],
        questIds: []
      });
    }

    // Create general stores (orange cubes)
    // Y will be grounded to terrain by the cube creation
    const stores = [
      { id: 'store_central', position: { x: 0, y: 0, z: -5 } },
      { id: 'store_east', position: { x: 100, y: 0, z: -5 } },
      { id: 'store_west', position: { x: -100, y: 0, z: -5 } },
      { id: 'store_north', position: { x: 0, y: 0, z: 95 } },
      { id: 'store_south', position: { x: 0, y: 0, z: -105 } }
    ];

    for (const store of stores) {
      this.createNPCCube({
        id: store.id,
        type: 'store',
        name: 'General Store',
        position: store.position,
        dialogue: ['Welcome to my store!', 'Take a look at my wares.'],
        shopItems: ['bronze_sword', 'leather_body', 'raw_shrimps'],
        questIds: []
      });
    }

    // Create resource nodes
    this.generateTestResources();
    
    // Create test mobs
    this.generateTestMobs();
    
    // Create test items
    this.generateTestItems();

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
        name: 'Oak Tree',
        position: { x: trees[i].x, y: 0, z: trees[i].z }, // Y will be grounded to terrain
        skillRequired: 'woodcutting',
        levelRequired: 1,
        toolRequired: 'bronze_hatchet',
        respawnTime: 30000, // 30 seconds
        isAvailable: true,
        lastDepleted: 0,
        drops: [
          { itemId: 'logs', quantity: 1, chance: 1.0 }
        ]
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
        name: 'Fishing Spot',
        position: { x: fishingSpots[i].x, y: 0, z: fishingSpots[i].z }, // Y will be grounded to terrain
        skillRequired: 'fishing',
        levelRequired: 1,
        toolRequired: 'fishing_rod',
        respawnTime: 60000, // 60 seconds
        isAvailable: true,
        lastDepleted: 0,
        drops: [
          { itemId: 'raw_shrimps', quantity: 1, chance: 1.0 }
        ]
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
        type: MobType.GOBLIN,
        name: 'Goblin',
        description: 'A small green humanoid with crude weapons',
        difficultyLevel: 1,
        mobType: 'goblin',
        level: 2,
        health: 30,
        maxHealth: 30,
        position: { x: goblins[i].x, y: 0, z: goblins[i].z }, // Y will be grounded to terrain
        isAlive: true,
        isAggressive: true,
        aggroRange: 5,
        wanderRadius: 10,
        respawnTime: 60000,
        spawnLocation: { x: goblins[i].x, y: 0, z: goblins[i].z }, // Y will be grounded to terrain
        spawnBiomes: ['plains'],
        modelPath: '/models/mobs/goblin.glb',
        animationSet: {
          idle: 'idle',
          walk: 'walk',
          attack: 'attack',
          death: 'death'
        },
        xpReward: 20,
        stats: {
          level: 2,
          health: 30,
          attack: 5,
          strength: 5,
          defense: 3,
          constitution: 5,
          ranged: 1
        },
        behavior: {
          aggressive: true,
          aggroRange: 5,
          chaseRange: 10,
          returnToSpawn: true,
          ignoreLowLevelPlayers: false,
          levelThreshold: 10
        },
        drops: [],
        equipment: {
          weapon: null,
          armor: null
        },
        lootTable: 'goblin_drops',
        aiState: 'idle' as const,
        target: null,
        lastAI: Date.now(),
        homePosition: { x: goblins[i].x, y: 2, z: goblins[i].z }
      });
    }

    // Bandits (light red cubes)
    const bandits = [
      { x: 70, z: 70 }, { x: -80, z: 60 }
    ];

    for (let i = 0; i < bandits.length; i++) {
      this.createMobCube({
        id: `bandit_${i}`,
        type: MobType.BANDIT,
        name: 'Bandit',
        description: 'A dangerous outlaw armed with crude weapons',
        difficultyLevel: 2,
        mobType: 'bandit',
        level: 5,
        health: 50,
        maxHealth: 50,
        position: { x: bandits[i].x, y: 0, z: bandits[i].z }, // Y will be grounded to terrain
        isAlive: true,
        isAggressive: true,
        aggroRange: 7,
        wanderRadius: 15,
        respawnTime: 120000,
        spawnLocation: { x: bandits[i].x, y: 0, z: bandits[i].z }, // Y will be grounded to terrain
        spawnBiomes: ['plains'],
        modelPath: '/models/mobs/bandit.glb',
        animationSet: {
          idle: 'idle',
          walk: 'walk',
          attack: 'attack',
          death: 'death'
        },
        xpReward: 50,
        stats: {
          level: 5,
          health: 50,
          attack: 8,
          strength: 8,
          defense: 6,
          constitution: 8,
          ranged: 3
        },
        behavior: {
          aggressive: true,
          aggroRange: 7,
          chaseRange: 14,
          returnToSpawn: true,
          ignoreLowLevelPlayers: false,
          levelThreshold: 10
        },
        drops: [],
        equipment: {
          weapon: { id: 1, name: 'Bronze Sword', type: AttackType.MELEE },
          armor: { id: 2, name: 'Leather Vest' }
        },
        lootTable: 'bandit_drops',
        aiState: 'idle' as const,
        target: null,
        lastAI: Date.now(),
        homePosition: { x: bandits[i].x, y: 2, z: bandits[i].z }
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
        type: ItemType.WEAPON,
        quantity: 1,
        stackable: false,
        maxStackSize: 1,
        value: 100,
        weight: 2.0,
        equipSlot: EquipmentSlotName.WEAPON,
        weaponType: null,
        equipable: true,
        attackType: AttackType.MELEE,
        description: `A ${weapon.name.toLowerCase()}.`,
        examine: `This is a ${weapon.name.toLowerCase()}.`,
        tradeable: true,
        rarity: ItemRarity.COMMON,
        modelPath: '/assets/models/weapons/bronze_sword.glb',
        iconPath: '/assets/icons/weapons/bronze_sword.png',
        healAmount: 0,
        stats: {
          attack: 10,
          defense: 0,
          strength: 0
        },
        bonuses: {
          attack: 7,
          strength: 2
        },
        requirements: {
          level: 1,
          skills: { attack: 1 }
        }
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
        type: ItemType.ARMOR,
        quantity: 1,
        stackable: false,
        maxStackSize: 1,
        value: 50,
        weight: 1.5,
        equipSlot: armor.name.includes('Helmet') ? EquipmentSlotName.HELMET : EquipmentSlotName.BODY,
        weaponType: null,
        equipable: true,
        attackType: null,
        description: `A ${armor.name.toLowerCase()}.`,
        examine: `This is a ${armor.name.toLowerCase()}.`,
        tradeable: true,
        rarity: ItemRarity.COMMON,
        modelPath: '/assets/models/armor/leather_body.glb',
        iconPath: '/assets/icons/armor/leather_body.png',
        healAmount: 0,
        stats: {
          attack: 0,
          defense: 5,
          strength: 0
        },
        bonuses: {
          defense: 3
        },
        requirements: {
          level: 1,
          skills: { defense: 1 }
        }
      });
    }

    // Resource items (light yellow cubes)
    const resources = [
      { id: 'logs_1', name: 'Logs', x: -5, z: 5 },
      { id: 'raw_shrimps_1', name: 'Raw Shrimps', x: -15, z: 5 }
    ];

    for (const resource of resources) {
      this.createItemCube({
        id: resource.id,
        name: resource.name,
        type: ItemType.RESOURCE,
        quantity: 1,
        stackable: true,
        maxStackSize: 999,
        value: 5,
        weight: 0.1,
        equipSlot: null,
        weaponType: null,
        equipable: false,
        attackType: null,
        description: `A ${resource.name.toLowerCase()}.`,
        examine: `This is a ${resource.name.toLowerCase()}.`,
        tradeable: true,
        rarity: ItemRarity.COMMON,
        modelPath: '/assets/models/resources/logs.glb',
        iconPath: '/assets/icons/resources/logs.png',
        healAmount: 0,
        stats: {
          attack: 0,
          defense: 0,
          strength: 0
        },
        bonuses: {},
        requirements: {
          level: 1,
          skills: {}
        }
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
    return this.entities.get(entityId)?.position || null;
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

  destroy(): void {
    // Remove all cubes from scene
    for (const [_id, entity] of this.entities) {
      // Safely remove from scene if possible
          if (this.world.stage.scene && entity.mesh) {
      this.world.stage.scene.remove(entity.mesh);
      }
    }
    
    this.entities.clear();
  }

  /**
   * Register all existing cubes with the interaction system
   */
  private registerAllCubesWithInteractionSystem(): void {
    // Interaction system is client-only, skip registration on server
    if (this.world.isServer) {
      return;
    }
    
    // Get the interaction system using proper method
    const interactionSystem = getSystem<InteractionSystem>(this.world, 'interaction');
    if (!interactionSystem) {
      console.warn('[VisualTestSystem] Interaction system not found, cannot register cubes');
      return;
    }
    
    let _registeredCount = 0;
    
    // Register all entities with the interaction system
    for (const entity of this.entities.values()) {
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
          break;
      }
      _registeredCount++;
    }
    
  }

  /**
   * Register a mob cube with the interaction system
   */
  private registerMobWithInteractionSystem(interactionSystem: InteractionSystem, entity: VisualTestEntity): void {
    // Interface guarantees this method exists

    // Extract mob information from entity label and id
    const mobName = entity.label?.replace(/^[A-Z]+:\s*/, '') || entity.id;
    const level = this.extractLevelFromMobData(entity);
    const health = this.extractHealthFromMobData(entity);
    
    interactionSystem.registerMob(entity.mesh, {
      id: entity.id,
      name: mobName,
      level: level,
      health: health,
      maxHealth: health
    });
    
  }

  /**
   * Register an item cube with the interaction system
   */
  private registerItemWithInteractionSystem(interactionSystem: InteractionSystem, entity: VisualTestEntity): void {
    // Interface guarantees this method exists

    const itemName = entity.label?.replace(/^ITEM:\s*/, '').replace(/\s*\(\d+\)$/, '') || entity.id;
    
    interactionSystem.registerItem(entity.mesh, {
      id: entity.id,
      name: itemName,
      canPickup: true
    });
    
  }

  /**
   * Register a resource cube with the interaction system
   */
  private registerResourceWithInteractionSystem(interactionSystem: InteractionSystem, entity: VisualTestEntity): void {
    // Interface guarantees this method exists

    const resourceName = entity.label?.replace(/^[A-Z_]+:\s*/, '') || entity.id;
    let resourceType: 'tree' | 'rock' | 'fish' = 'tree';
    let requiredTool = 'bronze_hatchet'; // Default tool
    
    // Determine resource type from entity data
    if (entity.id.includes('tree') || entity.label?.includes('TREE')) {
      resourceType = 'tree';
      requiredTool = 'bronze_hatchet';
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
    
  }

  /**
   * Register an NPC cube with the interaction system
   */
  private registerNPCWithInteractionSystem(interactionSystem: InteractionSystem, entity: VisualTestEntity): void {
    // Interface guarantees this method exists

    const npcName = entity.label?.replace(/^[A-Z_]+:\s*/, '') || entity.id;
    const isShop = !!(entity.id.includes('store') || entity.label?.includes('STORE'));
    
    interactionSystem.registerNPC(entity.mesh, {
      id: entity.id,
      name: npcName,
      canTalk: true,
      isShop: isShop
    });
    
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
    const entityTypeArray = Array.from(this.entities.values()).map((e) => e.type);
    const _entityTypes = new Set(entityTypeArray);
    
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
    const typesCovered = expectedTypes.filter(type => entityTypeArray.includes(type)).length;
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

  getTestReport(): { entities: number; coverage: string; timestamp: number } {
    return {
      entities: this.entities.size,
      coverage: this.entities.size > 0 ? 'full' : 'none',
      timestamp: Date.now()
    };
  }

  // Required System lifecycle methods
  preTick(): void {}
  preFixedUpdate(): void {}
  fixedUpdate(_dt: number): void {}
  postFixedUpdate(): void {}
  preUpdate(): void {}
  update(_dt: number): void {}
  postUpdate(): void {}
  lateUpdate(): void {}
  postLateUpdate(): void {}
  commit(): void {}
  postTick(): void {}
}