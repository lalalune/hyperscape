import { System } from '../../core/systems/System';

export interface StarterTown {
  id: string;
  name: string;
  position: { x: number; y: number; z: number };
  safeZoneRadius: number;
  hasBank: boolean;
  hasStore: boolean;
  isRespawnPoint: boolean;
}

/**
 * RPG World Generation System
 * Handles generation of world structures including:
 * - Starter towns with safe zones
 * - Banks and stores
 * - Decorative elements
 * - Zone boundaries
 * - Mob spawn points
 * - Resource spawn points
 */
export class RPGWorldGenerationSystem extends System {
  private starterTowns = new Map<string, StarterTown>();
  private worldStructures = new Map<string, any>();
  private mobSpawnPoints: Array<{ position: { x: number; y: number; z: number }; mobType: string; spawnRadius: number; difficulty: number }> = [];
  private resourceSpawnPoints: Array<{ position: { x: number; y: number; z: number }; type: string; subType: string }> = [];
  
  private readonly STARTER_TOWN_CONFIG: StarterTown[] = [
    {
      id: 'town_central',
      name: 'Brookhaven',
      position: { x: 0, y: 2, z: 0 },
      safeZoneRadius: 25,
      hasBank: true,
      hasStore: true,
      isRespawnPoint: true
    },
    {
      id: 'town_eastern',
      name: 'Eastport',
      position: { x: 100, y: 2, z: 0 },
      safeZoneRadius: 25,
      hasBank: true,
      hasStore: true,
      isRespawnPoint: true
    },
    {
      id: 'town_western',
      name: 'Westfall',
      position: { x: -100, y: 2, z: 0 },
      safeZoneRadius: 25,
      hasBank: true,
      hasStore: true,
      isRespawnPoint: true
    },
    {
      id: 'town_northern',
      name: 'Northridge',
      position: { x: 0, y: 2, z: 100 },
      safeZoneRadius: 25,
      hasBank: true,
      hasStore: true,
      isRespawnPoint: true
    },
    {
      id: 'town_southern',
      name: 'Southmere',
      position: { x: 0, y: 2, z: -100 },
      safeZoneRadius: 25,
      hasBank: true,
      hasStore: true,
      isRespawnPoint: true
    }
  ];

  constructor(world: any) {
    super(world);
  }

  async init(): Promise<void> {
    console.log('[RPGWorldGenerationSystem] Initializing world generation system...');
    
    // Listen for world generation events
    this.world.on?.('rpg:world:generate', this.generateWorld.bind(this));
    this.world.on?.('rpg:world:spawn_structure', this.spawnStructure.bind(this));
    
    // Generate starter towns on startup
    setTimeout(() => this.generateStarterTowns(), 1000);
    
    // Generate mob and resource spawn points
    setTimeout(() => {
      this.generateMobSpawnPoints();
      this.generateResourceSpawnPoints();
    }, 2000);
    
    console.log('[RPGWorldGenerationSystem] World generation system initialized');
  }

  start(): void {
    console.log('[RPGWorldGenerationSystem] World generation system started');
  }

  private generateWorld(): void {
    console.log('[RPGWorldGenerationSystem] Generating world structures...');
    
    // Generate all starter towns
    this.generateStarterTowns();
    
    // Generate other world features
    this.generateWorldFeatures();
    
    // Generate spawn points
    this.generateMobSpawnPoints();
    this.generateResourceSpawnPoints();
    
    console.log('[RPGWorldGenerationSystem] World generation complete');
  }

  private generateStarterTowns(): void {
    console.log('[RPGWorldGenerationSystem] Generating starter towns...');
    
    for (const townConfig of this.STARTER_TOWN_CONFIG) {
      this.generateStarterTown(townConfig);
    }
    
    console.log(`[RPGWorldGenerationSystem] Generated ${this.starterTowns.size} starter towns`);
  }

  private generateStarterTown(config: StarterTown): void {
    console.log(`[RPGWorldGenerationSystem] Generating starter town: ${config.name} at ${JSON.stringify(config.position)}`);
    
    // Store town data
    this.starterTowns.set(config.id, config);
    
    // Register safe zone with combat system
    this.world.emit?.('rpg:safezone:register', {
      id: `safezone_${config.id}`,
      center: config.position,
      radius: config.safeZoneRadius
    });
    
    // Emit town generated event for other systems to use
    this.world.emit?.('rpg:town:generated', {
      townId: config.id,
      name: config.name,
      position: config.position,
      safeZoneRadius: config.safeZoneRadius,
      hasBank: config.hasBank,
      hasStore: config.hasStore,
      isRespawnPoint: config.isRespawnPoint
    });
    
    // Generate physical structures (visual indicators)
    this.generateTownStructures(config);
  }

  private generateTownStructures(town: StarterTown): void {
    // Town center marker - create visual app
    this.world.emit?.('rpg:app:create', {
      type: 'RPGTownCenterApp',
      config: {
        id: `town_center_${town.id}`,
        name: `${town.name} Town Center`,
        position: town.position,
        townId: town.id,
        townName: town.name,
        safeZoneRadius: town.safeZoneRadius,
        population: 0
      }
    });
    
    // Bank building - create visual app
    if (town.hasBank) {
      const bankPosition = {
        x: town.position.x - 8,
        y: town.position.y,
        z: town.position.z
      };
      
      this.world.emit?.('rpg:app:create', {
        type: 'RPGBankApp',
        config: {
          id: `bank_${town.id}`,
          name: `${town.name} Bank`,
          position: bankPosition,
          bankId: `bank_${town.id}`,
          townId: town.id,
          capacity: 1000
        }
      });
      
      // Register bank location with banking system
      this.world.emit?.('rpg:banking:register_location', {
        bankId: `bank_${town.id}`,
        position: bankPosition,
        townId: town.id
      });
    }
    
    // Store building - create visual app
    if (town.hasStore) {
      const storePosition = {
        x: town.position.x + 8,
        y: town.position.y,
        z: town.position.z
      };
      
      const shopkeeperNames = ['Alice', 'Bob', 'Charlie', 'Diana', 'Eve'];
      const shopkeeperName = shopkeeperNames[Object.keys(this.starterTowns).length % shopkeeperNames.length];
      
      this.world.emit?.('rpg:app:create', {
        type: 'RPGStoreApp',
        config: {
          id: `store_${town.id}`,
          name: `${town.name} General Store`,
          position: storePosition,
          storeId: `store_${town.id}`,
          townId: town.id,
          shopkeeperName: shopkeeperName,
          storeType: 'general'
        }
      });
      
      // Register store location with store system
      this.world.emit?.('rpg:store:register_location', {
        storeId: `store_${town.id}`,
        position: storePosition,
        townId: town.id,
        shopkeeperName: shopkeeperName
      });
    }
    
    // Town decorations
    this.generateTownDecorations(town);
  }

  private generateTownDecorations(town: StarterTown): void {
    // Add some decorative elements like wells, benches, etc.
    const decorations = [
      { type: 'well', offset: { x: 0, z: -6 } },
      { type: 'bench', offset: { x: -4, z: 2 } },
      { type: 'bench', offset: { x: 4, z: 2 } },
      { type: 'lamp_post', offset: { x: -6, z: -6 } },
      { type: 'lamp_post', offset: { x: 6, z: -6 } },
      { type: 'lamp_post', offset: { x: -6, z: 6 } },
      { type: 'lamp_post', offset: { x: 6, z: 6 } }
    ];
    
    for (const deco of decorations) {
      this.world.emit?.('rpg:world:spawn_structure', {
        type: deco.type,
        position: {
          x: town.position.x + deco.offset.x,
          y: town.position.y,
          z: town.position.z + deco.offset.z
        },
        data: {
          townId: town.id
        }
      });
    }
  }

  private generateWorldFeatures(): void {
    // Generate roads between towns
    this.generateRoads();
    
    // Generate zone boundaries
    this.generateZoneBoundaries();
  }

  private generateRoads(): void {
    // Simple road generation between adjacent towns
    const townPairs = [
      ['town_central', 'town_eastern'],
      ['town_central', 'town_western'],
      ['town_central', 'town_northern'],
      ['town_central', 'town_southern'],
    ];
    
    for (const [townA, townB] of townPairs) {
      const startTown = this.starterTowns.get(townA);
      const endTown = this.starterTowns.get(townB);
      
      if (startTown && endTown) {
        this.world.emit?.('rpg:world:spawn_structure', {
          type: 'road',
          position: startTown.position,
          data: {
            start: startTown.position,
            end: endTown.position,
            width: 4
          }
        });
      }
    }
  }

  private generateZoneBoundaries(): void {
    // Visual indicators for different difficulty zones
    const zones = [
      { name: 'Beginner Zone', center: { x: 0, z: 0 }, radius: 150, level: '1-5' },
      { name: 'Intermediate Zone', center: { x: 200, z: 0 }, radius: 100, level: '5-10' },
      { name: 'Advanced Zone', center: { x: -200, z: 0 }, radius: 100, level: '10-15' }
    ];
    
    for (const zone of zones) {
      this.world.emit?.('rpg:world:spawn_structure', {
        type: 'zone_marker',
        position: { x: zone.center.x, y: 2, z: zone.center.z },
        data: zone
      });
    }
  }

  private generateMobSpawnPoints(): void {
    console.log('[RPGWorldGenerationSystem] Generating mob spawn points...');
    
    // Define mob spawn areas based on difficulty zones
    const spawnAreas = [
      // Level 1 areas - Goblins, Bandits, Barbarians
      { center: { x: 50, y: 2, z: 50 }, radius: 30, mobTypes: ['goblin', 'bandit', 'barbarian'], difficulty: 1 },
      { center: { x: -50, y: 2, z: 50 }, radius: 30, mobTypes: ['goblin', 'bandit'], difficulty: 1 },
      { center: { x: 50, y: 2, z: -50 }, radius: 30, mobTypes: ['barbarian', 'goblin'], difficulty: 1 },
      { center: { x: -50, y: 2, z: -50 }, radius: 30, mobTypes: ['bandit', 'barbarian'], difficulty: 1 },
      
      // Level 2 areas - Hobgoblins, Guards, Dark Warriors
      { center: { x: 150, y: 2, z: 150 }, radius: 40, mobTypes: ['hobgoblin', 'guard'], difficulty: 2 },
      { center: { x: -150, y: 2, z: 150 }, radius: 40, mobTypes: ['dark_warrior', 'hobgoblin'], difficulty: 2 },
      { center: { x: 150, y: 2, z: -150 }, radius: 40, mobTypes: ['guard', 'dark_warrior'], difficulty: 2 },
      
      // Level 3 areas - Black Knights, Ice Warriors, Dark Rangers
      { center: { x: 250, y: 2, z: 250 }, radius: 50, mobTypes: ['black_knight', 'ice_warrior'], difficulty: 3 },
      { center: { x: -250, y: 2, z: 250 }, radius: 50, mobTypes: ['dark_ranger', 'black_knight'], difficulty: 3 },
      { center: { x: 0, y: 2, z: 300 }, radius: 60, mobTypes: ['ice_warrior', 'dark_ranger'], difficulty: 3 }
    ];
    
    // Generate spawn points within each area
    for (const area of spawnAreas) {
      const pointsPerArea = 8; // Multiple spawn points per area
      
      for (let i = 0; i < pointsPerArea; i++) {
        const angle = (i / pointsPerArea) * Math.PI * 2;
        const distance = Math.random() * area.radius;
        const x = area.center.x + Math.cos(angle) * distance;
        const z = area.center.z + Math.sin(angle) * distance;
        
        const spawnPoint = {
          position: { x, y: area.center.y, z },
          mobType: area.mobTypes[Math.floor(Math.random() * area.mobTypes.length)],
          spawnRadius: 10,
          difficulty: area.difficulty
        };
        
        this.mobSpawnPoints.push(spawnPoint);
      }
    }
    
    console.log(`[RPGWorldGenerationSystem] Generated ${this.mobSpawnPoints.length} mob spawn points`);
    
    // Notify mob system about spawn points
    this.world.emit?.('rpg:mob:spawn_points:registered', {
      spawnPoints: this.mobSpawnPoints
    });
  }

  private generateResourceSpawnPoints(): void {
    console.log('[RPGWorldGenerationSystem] Generating resource spawn points...');
    
    // Generate tree spawn points
    for (let i = 0; i < 50; i++) {
      const x = (Math.random() - 0.5) * 400; // Spread across 400x400 world
      const z = (Math.random() - 0.5) * 400;
      
      this.resourceSpawnPoints.push({
        position: { x, y: 2, z },
        type: 'tree',
        subType: 'regular'
      });
    }
    
    // Generate fishing spot locations
    const fishingSpots = [
      { x: 25, y: 2, z: 25 }, { x: -25, y: 2, z: 25 }, { x: 25, y: 2, z: -25 },
      { x: 75, y: 2, z: 75 }, { x: -75, y: 2, z: -75 }, { x: 125, y: 2, z: 0 }
    ];
    
    for (const spot of fishingSpots) {
      this.resourceSpawnPoints.push({
        position: spot,
        type: 'fishing_spot',
        subType: 'lake'
      });
    }
    
    console.log(`[RPGWorldGenerationSystem] Generated ${this.resourceSpawnPoints.length} resource spawn points`);
    
    // Notify resource system about spawn points
    this.world.emit?.('rpg:resource:spawn_points:registered', {
      spawnPoints: this.resourceSpawnPoints
    });
  }

  private spawnStructure(data: any): void {
    // This would be handled by the actual world/entity system
    // For now, just log what would be spawned
    console.log(`[RPGWorldGenerationSystem] Spawning structure: ${data.type} at ${JSON.stringify(data.position)}`);
    
    // Store structure data
    const structureId = `${data.type}_${Date.now()}`;
    this.worldStructures.set(structureId, data);
  }

  // API methods for other systems
  getStarterTowns(): StarterTown[] {
    return Array.from(this.starterTowns.values());
  }

  getNearestStarterTown(position: { x: number; z: number }): StarterTown | null {
    let nearestTown: StarterTown | null = null;
    let minDistance = Infinity;
    
    for (const town of this.starterTowns.values()) {
      const distance = Math.sqrt(
        Math.pow(position.x - town.position.x, 2) +
        Math.pow(position.z - town.position.z, 2)
      );
      
      if (distance < minDistance) {
        minDistance = distance;
        nearestTown = town;
      }
    }
    
    return nearestTown;
  }

  isInSafeZone(position: { x: number; z: number }): boolean {
    for (const town of this.starterTowns.values()) {
      const distance = Math.sqrt(
        Math.pow(position.x - town.position.x, 2) +
        Math.pow(position.z - town.position.z, 2)
      );
      
      if (distance <= town.safeZoneRadius) {
        return true;
      }
    }
    
    return false;
  }

  getMobSpawnPoints(): Array<{ position: { x: number; y: number; z: number }; mobType: string; spawnRadius: number; difficulty: number }> {
    return [...this.mobSpawnPoints];
  }

  getResourceSpawnPoints(): Array<{ position: { x: number; y: number; z: number }; type: string; subType: string }> {
    return [...this.resourceSpawnPoints];
  }

  getWorldStructures(): Map<string, any> {
    return new Map(this.worldStructures);
  }

  destroy(): void {
    this.starterTowns.clear();
    this.worldStructures.clear();
    this.mobSpawnPoints = [];
    this.resourceSpawnPoints = [];
    console.log('[RPGWorldGenerationSystem] System destroyed');
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