import { World } from '../types'
import { ProceduralTerrain } from '@hyperscape/hyperfy/src/core/systems/ProceduralTerrain'
import { SpawningSystem } from '../systems/SpawningSystem'
import { prng } from '@hyperscape/hyperfy/src/core/extras/prng'
import { Vector3 } from 'three'

// LLM-generated world design prompt
interface WorldDesignPrompt {
  theme: string;
  difficulty: 'easy' | 'medium' | 'hard';
  size: 'small' | 'medium' | 'large';
  biomes: string[];
  features: string[];
  lore: string;
}

interface GeneratedWorldConfig {
  seed: number;
  worldSize: number;
  biomeCount: number;
  biomes: string[];
  features: string[];
  towns: Array<{
    name: string;
    position: Vector3;
    type: 'starter' | 'trading' | 'military';
  }>;
  spawners: Array<{
    type: string;
    position: Vector3;
    entityDefinitions: any[];
  }>;
  resources: Array<{
    type: string;
    positions: Vector3[];
    density: number;
  }>;
}

export class ProceduralWorldGenerator {
  private world: World;
  private terrain: ProceduralTerrain | null = null;
  private spawningSystem: SpawningSystem | null = null;
  private rng: (min: number, max?: number, dp?: number) => number;

  constructor(world: World) {
    this.world = world;
    this.rng = prng(Date.now());
  }

  /**
   * Generate world design using LLM
   */
  async generateWorldDesign(prompt: WorldDesignPrompt): Promise<GeneratedWorldConfig> {
    console.log('[ProceduralWorldGenerator] Generating world design with LLM...');
    
    // In a real implementation, this would call an LLM API
    // For now, we'll use rule-based generation based on the prompt
    const seed = this.rng(1, 999999);
    const worldConfig = this.createWorldConfigFromPrompt(prompt, seed);
    
    console.log('[ProceduralWorldGenerator] Generated world design:', worldConfig);
    return worldConfig;
  }

  /**
   * Create world configuration from LLM prompt
   */
  private createWorldConfigFromPrompt(prompt: WorldDesignPrompt, seed: number): GeneratedWorldConfig {
    const sizeMap = { small: 200, medium: 500, large: 1000 };
    const biomeCountMap = { small: 4, medium: 6, large: 8 };
    
    const worldSize = sizeMap[prompt.size];
    const biomeCount = biomeCountMap[prompt.size];
    
    // Create configuration based on theme and difficulty
    const config: GeneratedWorldConfig = {
      seed,
      worldSize,
      biomeCount,
      biomes: this.selectBiomesForTheme(prompt.theme, biomeCount),
      features: prompt.features,
      towns: this.generateTownConfigs(prompt.difficulty, worldSize),
      spawners: this.generateSpawnerConfigs(prompt.difficulty, worldSize),
      resources: this.generateResourceConfigs(prompt.difficulty, worldSize)
    };

    return config;
  }

  /**
   * Select biomes based on theme
   */
  private selectBiomesForTheme(theme: string, count: number): string[] {
    const biomeThemes = {
      'fantasy': ['mistwood_valley', 'darkwood_forest', 'northern_reaches', 'great_lakes'],
      'apocalyptic': ['blasted_lands', 'goblin_wastes', 'bramblewood_thicket', 'windswept_plains'],
      'balanced': ['mistwood_valley', 'goblin_wastes', 'darkwood_forest', 'great_lakes', 'windswept_plains'],
      'challenging': ['blasted_lands', 'northern_reaches', 'darkwood_forest', 'bramblewood_thicket']
    };

    const themeBiomes = biomeThemes[theme] || biomeThemes['balanced'];
    const allBiomes = ['mistwood_valley', 'goblin_wastes', 'darkwood_forest', 'northern_reaches', 
                      'great_lakes', 'blasted_lands', 'windswept_plains', 'bramblewood_thicket'];
    
    // Start with theme biomes and fill with others
    const selected = [...themeBiomes];
    while (selected.length < count) {
      const remaining = allBiomes.filter(b => !selected.includes(b));
      if (remaining.length === 0) break;
      selected.push(remaining[this.rng(0, remaining.length - 1)]);
    }
    
    return selected.slice(0, count);
  }

  /**
   * Generate town configurations
   */
  private generateTownConfigs(difficulty: string, worldSize: number): Array<{name: string; position: Vector3; type: 'starter' | 'trading' | 'military'}> {
    const difficultyMap = { easy: 5, medium: 4, hard: 3 };
    const townCount = difficultyMap[difficulty];
    const halfWorld = worldSize / 2;
    
    const towns = [];
    const townNames = ['Brookhaven', 'Millharbor', 'Crosshill', 'Ironhold', 'Goldenvale', 'Redstone', 'Greenhill'];
    
    for (let i = 0; i < townCount; i++) {
      const angle = (i / townCount) * Math.PI * 2;
      const distance = halfWorld * 0.3 + this.rng(0, halfWorld * 0.2);
      const x = Math.cos(angle) * distance;
      const z = Math.sin(angle) * distance;
      
      towns.push({
        name: townNames[i] || `Town ${i + 1}`,
        position: new Vector3(x, 0, z),
        type: i === 0 ? 'starter' : (i % 3 === 0 ? 'trading' : 'military')
      });
    }
    
    return towns;
  }

  /**
   * Generate spawner configurations
   */
  private generateSpawnerConfigs(difficulty: string, worldSize: number): Array<{type: string; position: Vector3; entityDefinitions: any[]}> {
    const spawners = [];
    const halfWorld = worldSize / 2;
    const spawnerCount = Math.floor(worldSize / 50); // Scale with world size
    
    // Generate mob spawners
    for (let i = 0; i < spawnerCount; i++) {
      const x = this.rng(-halfWorld * 0.8, halfWorld * 0.8);
      const z = this.rng(-halfWorld * 0.8, halfWorld * 0.8);
      
      spawners.push({
        type: 'mob',
        position: new Vector3(x, 0, z),
        entityDefinitions: this.selectMobsForDifficulty(difficulty, x, z, halfWorld)
      });
    }
    
    // Generate resource spawners
    const resourceCount = Math.floor(worldSize / 30);
    for (let i = 0; i < resourceCount; i++) {
      const x = this.rng(-halfWorld * 0.9, halfWorld * 0.9);
      const z = this.rng(-halfWorld * 0.9, halfWorld * 0.9);
      
      spawners.push({
        type: 'resource',
        position: new Vector3(x, 0, z),
        entityDefinitions: this.selectResourcesForPosition(x, z, halfWorld)
      });
    }
    
    return spawners;
  }

  /**
   * Select mobs based on difficulty and position
   */
  private selectMobsForDifficulty(difficulty: string, x: number, z: number, halfWorld: number): any[] {
    const distanceFromCenter = Math.sqrt(x * x + z * z);
    const normalizedDistance = distanceFromCenter / halfWorld;
    
    // Difficulty increases with distance from center
    let mobLevel = 1;
    if (normalizedDistance > 0.7) {
      mobLevel = 3; // High level mobs
    } else if (normalizedDistance > 0.4) {
      mobLevel = 2; // Medium level mobs
    }
    
    const mobsByLevel = {
      1: [
        { entityType: 'npc', entityId: 1, weight: 70 }, // Goblin
        { entityType: 'npc', entityId: 3, weight: 30 }, // Cow
      ],
      2: [
        { entityType: 'npc', entityId: 2, weight: 50 }, // Guard
        { entityType: 'npc', entityId: 1, weight: 30 }, // Goblin
        { entityType: 'npc', entityId: 4, weight: 20 }, // Hobgoblin
      ],
      3: [
        { entityType: 'npc', entityId: 5, weight: 40 }, // Black Knight
        { entityType: 'npc', entityId: 6, weight: 30 }, // Ice Warrior
        { entityType: 'npc', entityId: 7, weight: 30 }, // Dark Ranger
      ]
    };
    
    return mobsByLevel[mobLevel] || mobsByLevel[1];
  }

  /**
   * Select resources based on position
   */
  private selectResourcesForPosition(x: number, z: number, halfWorld: number): any[] {
    // Resources are more common near the center
    const distanceFromCenter = Math.sqrt(x * x + z * z);
    const normalizedDistance = distanceFromCenter / halfWorld;
    
    if (normalizedDistance < 0.3) {
      // Near center - basic resources
      return [
        { entityType: 'tree', weight: 60 },
        { entityType: 'rock', weight: 40 },
      ];
    } else if (normalizedDistance < 0.7) {
      // Middle distance - mixed resources
      return [
        { entityType: 'tree', weight: 40 },
        { entityType: 'oak_tree', weight: 30 },
        { entityType: 'iron_rock', weight: 30 },
      ];
    } else {
      // Far from center - rare resources
      return [
        { entityType: 'oak_tree', weight: 50 },
        { entityType: 'iron_rock', weight: 50 },
      ];
    }
  }

  /**
   * Generate resource configurations
   */
  private generateResourceConfigs(difficulty: string, worldSize: number): Array<{type: string; positions: Vector3[]; density: number}> {
    const resources = [];
    const halfWorld = worldSize / 2;
    
    // Generate tree clusters
    const treeClusterCount = Math.floor(worldSize / 80);
    for (let i = 0; i < treeClusterCount; i++) {
      const centerX = this.rng(-halfWorld * 0.8, halfWorld * 0.8);
      const centerZ = this.rng(-halfWorld * 0.8, halfWorld * 0.8);
      const positions = [];
      
      // Create cluster of trees
      const clusterSize = this.rng(5, 15);
      for (let j = 0; j < clusterSize; j++) {
        const angle = this.rng(0, Math.PI * 2);
        const distance = this.rng(0, 20);
        const x = centerX + Math.cos(angle) * distance;
        const z = centerZ + Math.sin(angle) * distance;
        positions.push(new Vector3(x, 0, z));
      }
      
      resources.push({
        type: 'trees',
        positions,
        density: 0.7
      });
    }
    
    return resources;
  }

  /**
   * Initialize the world with generated configuration
   */
  async initializeWorld(config: GeneratedWorldConfig): Promise<void> {
    console.log('[ProceduralWorldGenerator] Initializing world...');
    
    // Create and initialize terrain system
    this.terrain = new ProceduralTerrain(this.world, {
      seed: config.seed,
      biomeCount: config.biomeCount,
      worldSize: config.worldSize,
      chunkSize: 100,
      chunkResolution: 64,
      maxHeight: 50,
      waterLevel: 0
    });
    
    // Add terrain system to world
    await this.terrain.init();
    (this.world as any).terrain = this.terrain;
    
    // Get spawning system
    this.spawningSystem = (this.world as any).getSystem?.('spawning');
    
    if (this.spawningSystem) {
      // Create spawners based on terrain and biomes
      await this.createBiomeBasedSpawners(config);
      
      // Create town safe zones
      await this.createTownSafeZones(config.towns);
      
      // Create resource spawners
      await this.createResourceSpawners(config.resources);
    }
    
    console.log('[ProceduralWorldGenerator] World initialization complete');
  }

  /**
   * Create biome-based spawners
   */
  private async createBiomeBasedSpawners(config: GeneratedWorldConfig): Promise<void> {
    if (!this.terrain || !this.spawningSystem) return;
    
    const halfWorld = config.worldSize / 2;
    const spawnerCount = Math.floor(config.worldSize / 40);
    
    for (let i = 0; i < spawnerCount; i++) {
      const x = this.rng(-halfWorld * 0.9, halfWorld * 0.9);
      const z = this.rng(-halfWorld * 0.9, halfWorld * 0.9);
      
      // Get biome and terrain data
      const spawnData = this.terrain.getSpawnDataAt(x, z);
      if (!spawnData || !spawnData.walkable) continue;
      
      // Create spawner based on biome
      const spawnerConfig = this.createSpawnerForBiome(spawnData.biome, x, z, spawnData.height);
      if (spawnerConfig) {
        this.spawningSystem.registerSpawner(spawnerConfig);
      }
    }
  }

  /**
   * Create spawner configuration for biome
   */
  private createSpawnerForBiome(biome: any, x: number, z: number, height: number): any {
    const entityDefinitions = biome.spawnTables.mobs.map(mobType => ({
      entityType: 'npc',
      entityId: this.getMobIdForType(mobType),
      weight: 100 / biome.spawnTables.mobs.length
    }));
    
    return {
      type: 'NPC',
      position: { x, y: height, z },
      entityDefinitions,
      maxEntities: Math.floor(biome.spawnTables.density * 5),
      respawnTime: 30000,
      activationRange: 50,
      spawnArea: {
        type: 'circle',
        radius: 15,
        avoidOverlap: true,
        minSpacing: 3,
        maxHeight: 2
      }
    };
  }

  /**
   * Get mob ID for mob type string
   */
  private getMobIdForType(mobType: string): number {
    const mobIds = {
      'goblin': 1,
      'guard': 2,
      'bandit': 3,
      'hobgoblin': 4,
      'black_knight': 5,
      'ice_warrior': 6,
      'dark_ranger': 7,
      'barbarian': 8,
      'dark_warrior': 9
    };
    
    return mobIds[mobType] || 1;
  }

  /**
   * Create town safe zones
   */
  private async createTownSafeZones(towns: Array<{name: string; position: Vector3; type: string}>): Promise<void> {
    if (!this.terrain) return;
    
    for (const town of towns) {
      // Flatten terrain around town
      this.flattenTerrainAroundPoint(town.position, 25);
      
      // Create safe zone (this would integrate with a SafeZone system)
      console.log(`[ProceduralWorldGenerator] Created safe zone for ${town.name} at ${town.position.x}, ${town.position.z}`);
    }
  }

  /**
   * Flatten terrain around a point (for towns)
   */
  private flattenTerrainAroundPoint(center: Vector3, radius: number): void {
    // This would modify the terrain chunks to flatten the area
    // For now, we'll just log the intention
    console.log(`[ProceduralWorldGenerator] Flattening terrain around ${center.x}, ${center.z} with radius ${radius}`);
  }

  /**
   * Create resource spawners
   */
  private async createResourceSpawners(resources: Array<{type: string; positions: Vector3[]; density: number}>): Promise<void> {
    if (!this.spawningSystem) return;
    
    for (const resource of resources) {
      for (const position of resource.positions) {
        if (!this.terrain) continue;
        
        // Adjust position height to terrain
        position.y = this.terrain.getHeightAt(position.x, position.z);
        
        // Create resource spawner
        const spawnerConfig = {
          type: 'RESOURCE',
          position: { x: position.x, y: position.y, z: position.z },
          entityDefinitions: [
            { entityType: 'tree', weight: 70 },
            { entityType: 'oak_tree', weight: 30 }
          ],
          maxEntities: 3,
          respawnTime: 60000,
          activationRange: 30,
          spawnArea: {
            type: 'circle',
            radius: 10,
            avoidOverlap: true,
            minSpacing: 5,
            maxHeight: 1
          }
        };
        
        this.spawningSystem.registerSpawner(spawnerConfig);
      }
    }
  }

  /**
   * Get terrain system
   */
  getTerrain(): ProceduralTerrain | null {
    return this.terrain;
  }

  /**
   * Get world statistics
   */
  getWorldStats(): any {
    if (!this.terrain) return null;
    
    return {
      config: this.terrain.getWorldConfig(),
      biomes: this.terrain.getBiomePoints(),
      towns: this.terrain.getTownLocations(),
      chunks: this.terrain.getDebugInfo()
    };
  }
}