import { Terrain, TerrainType } from './Terrain';
import { prng } from '../extras/prng';
import type { World } from '../World';
import { Vector3 } from 'three';

// Biome definitions based on GDD
interface BiomeDefinition {
  id: string;
  name: string;
  heightRange: [number, number];
  heightAmplitude: number;
  noise: {
    frequency: number;
    amplitude: number;
    octaves: number;
  };
  terrainTypes: TerrainType[];
  primaryType: TerrainType;
  features: string[];
  spawnTables: {
    mobs: string[];
    resources: string[];
    density: number;
  };
}

const BIOME_DEFINITIONS: Record<string, BiomeDefinition> = {
  mistwood_valley: {
    id: 'mistwood_valley',
    name: 'Mistwood Valley',
    heightRange: [0, 0.3],
    heightAmplitude: 0.5,
    noise: { frequency: 0.02, amplitude: 8, octaves: 3 },
    terrainTypes: [TerrainType.GRASS, TerrainType.DIRT],
    primaryType: TerrainType.GRASS,
    features: ['trees', 'hills', 'starter_towns'],
    spawnTables: { mobs: ['goblin', 'bandit'], resources: ['trees', 'rocks'], density: 0.3 }
  },
  goblin_wastes: {
    id: 'goblin_wastes',
    name: 'Goblin Wastes',
    heightRange: [0.1, 0.4],
    heightAmplitude: 0.3,
    noise: { frequency: 0.03, amplitude: 6, octaves: 2 },
    terrainTypes: [TerrainType.DIRT, TerrainType.STONE],
    primaryType: TerrainType.DIRT,
    features: ['rocks', 'camps', 'badlands'],
    spawnTables: { mobs: ['goblin', 'hobgoblin'], resources: ['rocks', 'iron'], density: 0.4 }
  },
  darkwood_forest: {
    id: 'darkwood_forest',
    name: 'Darkwood Forest',
    heightRange: [0.2, 0.6],
    heightAmplitude: 0.4,
    noise: { frequency: 0.025, amplitude: 10, octaves: 4 },
    terrainTypes: [TerrainType.GRASS, TerrainType.DIRT],
    primaryType: TerrainType.GRASS,
    features: ['dense_trees', 'clearings', 'shadows'],
    spawnTables: { mobs: ['dark_warrior', 'bandit'], resources: ['trees', 'herbs'], density: 0.6 }
  },
  northern_reaches: {
    id: 'northern_reaches',
    name: 'Northern Reaches',
    heightRange: [0.6, 1.0],
    heightAmplitude: 0.8,
    noise: { frequency: 0.015, amplitude: 20, octaves: 3 },
    terrainTypes: [TerrainType.SNOW, TerrainType.ICE, TerrainType.STONE],
    primaryType: TerrainType.SNOW,
    features: ['mountains', 'ice', 'caves'],
    spawnTables: { mobs: ['ice_warrior', 'barbarian'], resources: ['ice', 'stone'], density: 0.2 }
  },
  great_lakes: {
    id: 'great_lakes',
    name: 'Great Lakes',
    heightRange: [-0.2, 0.2],
    heightAmplitude: 0.2,
    noise: { frequency: 0.01, amplitude: 4, octaves: 2 },
    terrainTypes: [TerrainType.WATER, TerrainType.SAND],
    primaryType: TerrainType.WATER,
    features: ['lakes', 'shores', 'fishing'],
    spawnTables: { mobs: ['guard', 'bandit'], resources: ['fish', 'sand'], density: 0.1 }
  },
  blasted_lands: {
    id: 'blasted_lands',
    name: 'Blasted Lands',
    heightRange: [0.1, 0.5],
    heightAmplitude: 0.6,
    noise: { frequency: 0.04, amplitude: 12, octaves: 3 },
    terrainTypes: [TerrainType.LAVA, TerrainType.STONE],
    primaryType: TerrainType.STONE,
    features: ['volcanic', 'ash', 'ruins'],
    spawnTables: { mobs: ['black_knight', 'dark_ranger'], resources: ['obsidian', 'sulfur'], density: 0.5 }
  },
  windswept_plains: {
    id: 'windswept_plains',
    name: 'Windswept Plains',
    heightRange: [0.0, 0.3],
    heightAmplitude: 0.2,
    noise: { frequency: 0.02, amplitude: 5, octaves: 2 },
    terrainTypes: [TerrainType.GRASS, TerrainType.DIRT],
    primaryType: TerrainType.GRASS,
    features: ['plains', 'wind', 'roads'],
    spawnTables: { mobs: ['guard', 'hobgoblin'], resources: ['grass', 'flowers'], density: 0.3 }
  },
  bramblewood_thicket: {
    id: 'bramblewood_thicket',
    name: 'Bramblewood Thicket',
    heightRange: [0.1, 0.4],
    heightAmplitude: 0.3,
    noise: { frequency: 0.03, amplitude: 7, octaves: 3 },
    terrainTypes: [TerrainType.GRASS, TerrainType.DIRT],
    primaryType: TerrainType.GRASS,
    features: ['thorns', 'dense_vegetation', 'maze'],
    spawnTables: { mobs: ['bandit', 'barbarian'], resources: ['thorns', 'berries'], density: 0.4 }
  }
};

interface BiomePoint {
  x: number;
  z: number;
  biome: BiomeDefinition;
  distance?: number;
}

interface TerrainConfig {
  seed: number;
  biomeCount: number;
  worldSize: number;
  chunkSize?: number;
  chunkResolution?: number;
  maxHeight?: number;
  waterLevel?: number;
}

export class ProceduralTerrain extends Terrain {
  private seed: number;
  private biomePoints: BiomePoint[] = [];
  private rng: (min: number, max?: number, dp?: number) => number;
  private biomeCount: number;
  private worldSize: number;
  private townLocations: Vector3[] = [];

  constructor(world: World, config: TerrainConfig) {
    super(world, {
      chunkSize: config.chunkSize || 100,
      chunkResolution: config.chunkResolution || 64,
      maxHeight: config.maxHeight || 50,
      waterLevel: config.waterLevel || 0
    });

    this.seed = config.seed;
    this.biomeCount = config.biomeCount;
    this.worldSize = config.worldSize;
    this.rng = prng(this.seed);
    
    this.generateBiomePoints();
    this.generateTownLocations();
  }

  async init(): Promise<void> {
    await super.init();
    console.log(`[ProceduralTerrain] Initialized with seed: ${this.seed}, biomes: ${this.biomeCount}`);
    console.log(`[ProceduralTerrain] Generated ${this.biomePoints.length} biome points`);
    console.log(`[ProceduralTerrain] Generated ${this.townLocations.length} town locations`);
  }

  // Generate biome center points using Voronoi diagram
  private generateBiomePoints(): void {
    const biomeTypes = Object.values(BIOME_DEFINITIONS);
    const halfWorld = this.worldSize / 2;
    
    for (let i = 0; i < this.biomeCount; i++) {
      const biome = biomeTypes[i % biomeTypes.length];
      const x = this.rng(-halfWorld, halfWorld);
      const z = this.rng(-halfWorld, halfWorld);
      
      this.biomePoints.push({ x, z, biome });
    }
  }

  // Generate town locations in suitable flat areas
  private generateTownLocations(): void {
    const townCount = Math.max(3, Math.floor(this.biomeCount / 2));
    const halfWorld = this.worldSize / 2;
    
    for (let i = 0; i < townCount; i++) {
      // Try to find flat areas suitable for towns
      let bestLocation: Vector3 | null = null;
      let bestFlatness = 0;
      
      for (let attempt = 0; attempt < 50; attempt++) {
        const x = this.rng(-halfWorld * 0.7, halfWorld * 0.7);
        const z = this.rng(-halfWorld * 0.7, halfWorld * 0.7);
        
        // Check if location is in a suitable biome (not water or lava)
        const biome = this.getBiomeAt(x, z);
        if (biome && (biome.primaryType === TerrainType.WATER || biome.primaryType === TerrainType.LAVA)) {
          continue;
        }
        
        // Check flatness in surrounding area
        const flatness = this.calculateFlatness(x, z, 10);
        if (flatness > bestFlatness) {
          bestFlatness = flatness;
          bestLocation = new Vector3(x, 0, z);
        }
      }
      
      if (bestLocation) {
        // Set town height to terrain height
        bestLocation.y = this.generateHeight(bestLocation.x, bestLocation.z);
        this.townLocations.push(bestLocation);
      }
    }
  }

  // Calculate flatness of an area (higher = flatter)
  private calculateFlatness(centerX: number, centerZ: number, radius: number): number {
    const samples = 16;
    const heights: number[] = [];
    
    for (let i = 0; i < samples; i++) {
      const angle = (i / samples) * Math.PI * 2;
      const x = centerX + Math.cos(angle) * radius;
      const z = centerZ + Math.sin(angle) * radius;
      heights.push(this.generateHeight(x, z));
    }
    
    const minHeight = Math.min(...heights);
    const maxHeight = Math.max(...heights);
    const heightDifference = maxHeight - minHeight;
    
    return 1 / (1 + heightDifference);
  }

  // Override height generation with biome-based procedural generation
  protected generateHeight(x: number, z: number): number {
    const biome = this.getBiomeAt(x, z);
    if (!biome) return 0;
    
    // Generate base height using multi-octave noise
    let height = 0;
    let frequency = biome.noise.frequency;
    let amplitude = biome.noise.amplitude;
    
    for (let octave = 0; octave < biome.noise.octaves; octave++) {
      height += this.noise(x, z, frequency) * amplitude;
      frequency *= 2;
      amplitude *= 0.5;
    }
    
    // Apply biome height range
    const normalizedHeight = (height + biome.noise.amplitude) / (biome.noise.amplitude * 2);
    const biomeHeight = biome.heightRange[0] + 
      (biome.heightRange[1] - biome.heightRange[0]) * normalizedHeight;
    
    return biomeHeight * biome.heightAmplitude * this.maxHeight;
  }

  // Multi-octave noise function
  private noise(x: number, z: number, frequency: number): number {
    const intX = Math.floor(x * frequency);
    const intZ = Math.floor(z * frequency);
    const fracX = (x * frequency) - intX;
    const fracZ = (z * frequency) - intZ;
    
    // Use seeded hash for consistent results
    const hash = (intX * 73856093) ^ (intZ * 19349663);
    const localRng = prng(this.seed + Math.abs(hash));
    
    // Sample grid points
    const a = localRng(0, 1000) / 1000;
    const b = localRng(0, 1000) / 1000;
    const c = localRng(0, 1000) / 1000;
    const d = localRng(0, 1000) / 1000;
    
    // Bilinear interpolation
    const i1 = a * (1 - fracX) + b * fracX;
    const i2 = c * (1 - fracX) + d * fracX;
    
    return i1 * (1 - fracZ) + i2 * fracZ;
  }

  // Get biome at world position using Voronoi diagram
  getBiomeAt(x: number, z: number): BiomeDefinition | null {
    if (this.biomePoints.length === 0) return null;
    
    let closestBiome = this.biomePoints[0];
    let closestDistance = Infinity;
    
    for (const point of this.biomePoints) {
      const dx = x - point.x;
      const dz = z - point.z;
      const distance = Math.sqrt(dx * dx + dz * dz);
      
      if (distance < closestDistance) {
        closestDistance = distance;
        closestBiome = point;
      }
    }
    
    return closestBiome.biome;
  }

  // Override terrain type generation to use biome data
  protected getTerrainTypeValue(height: number): number {
    // This method gets called during chunk generation, but we need position context
    // We'll override this in the chunk generation process
    return 0;
  }

  // Override chunk generation to use biome-based terrain types
  protected generateChunk(chunkX: number, chunkZ: number): any {
    const resolution = this.chunkResolution;
    const size = resolution * resolution;
    const heightMap = new Float32Array(size);
    const typeMap = new Uint8Array(size);
    
    for (let z = 0; z < resolution; z++) {
      for (let x = 0; x < resolution; x++) {
        const index = z * resolution + x;
        const worldX = chunkX * this.chunkSize + (x / resolution) * this.chunkSize;
        const worldZ = chunkZ * this.chunkSize + (z / resolution) * this.chunkSize;
        
        // Generate height using biome-based generation
        const height = this.generateHeight(worldX, worldZ);
        heightMap[index] = height;
        
        // Get terrain type based on biome and height
        const biome = this.getBiomeAt(worldX, worldZ);
        if (biome) {
          typeMap[index] = this.getBiomeTerrainType(biome, height);
        } else {
          typeMap[index] = 0; // Default to grass
        }
      }
    }
    
    const chunk = {
      x: chunkX,
      z: chunkZ,
      heightMap,
      typeMap,
      resolution,
      size: this.chunkSize,
      mesh: null,
      rigidBody: null
    };
    
    const key = `${chunkX},${chunkZ}`;
    this.chunks.set(key, chunk);
    
    // Generate visual mesh and physics
    this.generateChunkMesh(chunk);
    this.generateChunkPhysics(chunk);
    
    return chunk;
  }

  // Generate THREE.js mesh for chunk
  private generateChunkMesh(chunk: any): void {
    // Import THREE.js dynamically since it may not be available in all environments
    if (typeof THREE === 'undefined') {
      console.warn('[ProceduralTerrain] THREE.js not available, skipping mesh generation');
      return;
    }

    const geometry = new THREE.PlaneGeometry(
      this.chunkSize,
      this.chunkSize,
      chunk.resolution - 1,
      chunk.resolution - 1
    );

    const vertices = geometry.attributes.position.array;
    const colors = new Float32Array(vertices.length);

    // Apply heightmap to vertices and set biome-based colors
    for (let i = 0; i < vertices.length; i += 3) {
      const localX = vertices[i];
      const localZ = vertices[i + 1];
      
      // Convert local coordinates to heightmap indices
      const x = Math.floor((localX + this.chunkSize/2) / this.chunkSize * chunk.resolution);
      const z = Math.floor((localZ + this.chunkSize/2) / this.chunkSize * chunk.resolution);
      const index = Math.max(0, Math.min(chunk.resolution * chunk.resolution - 1, z * chunk.resolution + x));
      
      // Set height from heightmap
      vertices[i + 2] = chunk.heightMap[index];
      
      // Set biome-based color
      const terrainType = chunk.typeMap[index];
      const color = this.getTerrainColor(terrainType);
      colors[i] = color.r;
      colors[i + 1] = color.g;
      colors[i + 2] = color.b;
    }

    geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    geometry.rotateX(-Math.PI / 2); // Make terrain horizontal
    geometry.computeVertexNormals();

    const material = new THREE.MeshStandardMaterial({
      vertexColors: true,
      side: THREE.DoubleSide,
      wireframe: false
    });

    chunk.mesh = new THREE.Mesh(geometry, material);
    chunk.mesh.position.set(
      chunk.x * this.chunkSize,
      0,
      chunk.z * this.chunkSize
    );
    chunk.mesh.receiveShadow = true;
    chunk.mesh.castShadow = false;

    // Add mesh to world scene (will be handled by world loading system)
    // The mesh is stored in chunk.mesh for the world to access
    console.log(`[ProceduralTerrain] Generated mesh for chunk (${chunk.x}, ${chunk.z})`);
    
    // TODO: Integrate with Hyperfy's scene management
    // if (this.world && this.world.scene) {
    //   this.world.scene.add(chunk.mesh);
    // }
  }

  // Generate PhysX collision for chunk
  private generateChunkPhysics(chunk: any): void {
    // This would integrate with Hyperfy's physics system
    // For now, we'll store the physics data for later integration
    try {
      if (this.world && chunk.mesh) {
        const rigidBodyConfig = {
          type: 'static',
          position: {
            x: chunk.x * this.chunkSize,
            y: 0,
            z: chunk.z * this.chunkSize
          },
          geometry: chunk.mesh.geometry
        };

        // Store physics config for integration with Hyperfy's physics system
        chunk.physicsConfig = rigidBodyConfig;
        console.log(`[ProceduralTerrain] Prepared physics config for chunk (${chunk.x}, ${chunk.z})`);
        
        // TODO: Integrate with Hyperfy's physics system
        // chunk.rigidBody = this.world.physics.createRigidBody(rigidBodyConfig);
      }
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      console.warn('[ProceduralTerrain] Physics generation failed:', errorMessage);
    }
  }

  // Get terrain color based on terrain type
  private getTerrainColor(terrainType: number): { r: number; g: number; b: number } {
    const colors = {
      0: { r: 0.3, g: 0.6, b: 0.3 }, // Grass - green
      1: { r: 0.5, g: 0.4, b: 0.2 }, // Dirt - brown
      2: { r: 0.6, g: 0.6, b: 0.6 }, // Stone - gray
      3: { r: 0.2, g: 0.4, b: 0.8 }, // Water - blue
      4: { r: 0.9, g: 0.8, b: 0.4 }, // Sand - yellow
      5: { r: 0.9, g: 0.9, b: 0.9 }, // Snow - white
      6: { r: 0.7, g: 0.9, b: 0.9 }, // Ice - light blue
      7: { r: 0.8, g: 0.2, b: 0.0 }  // Lava - red
    };
    return colors[terrainType] || colors[0];
  }

  // Get terrain type value based on biome and height
  private getBiomeTerrainType(biome: BiomeDefinition, height: number): number {
    // Map terrain types to numeric values
    const typeMap = new Map([
      [TerrainType.GRASS, 0],
      [TerrainType.DIRT, 1],
      [TerrainType.STONE, 2],
      [TerrainType.WATER, 3],
      [TerrainType.SAND, 4],
      [TerrainType.SNOW, 5],
      [TerrainType.ICE, 6],
      [TerrainType.LAVA, 7]
    ]);
    
    // For water and lava biomes, use primary type regardless of height
    if (biome.primaryType === TerrainType.WATER || biome.primaryType === TerrainType.LAVA) {
      return typeMap.get(biome.primaryType) || 0;
    }
    
    // For other biomes, vary based on height
    if (height < this.waterLevel) {
      return typeMap.get(TerrainType.WATER) || 3;
    } else if (height < this.waterLevel + 2) {
      return typeMap.get(TerrainType.SAND) || 4;
    } else if (height > this.maxHeight * 0.8) {
      return typeMap.get(TerrainType.SNOW) || 5;
    } else if (height > this.maxHeight * 0.6) {
      return typeMap.get(TerrainType.STONE) || 2;
    } else {
      return typeMap.get(biome.primaryType) || 0;
    }
  }

  // Get spawn data for a position (for integration with spawning system)
  getSpawnDataAt(x: number, z: number): { biome: BiomeDefinition; height: number; walkable: boolean } | null {
    const biome = this.getBiomeAt(x, z);
    if (!biome) return null;
    
    const height = this.getHeightAt(x, z);
    const walkable = this.isWalkable(x, z);
    
    return { biome, height, walkable };
  }

  // Get town locations for world initialization
  getTownLocations(): Vector3[] {
    return this.townLocations;
  }

  // Get biome points for debugging/visualization
  getBiomePoints(): BiomePoint[] {
    return this.biomePoints;
  }

  // Get world generation configuration
  getWorldConfig(): TerrainConfig {
    return {
      seed: this.seed,
      biomeCount: this.biomeCount,
      worldSize: this.worldSize,
      chunkSize: this.chunkSize,
      chunkResolution: this.chunkResolution,
      maxHeight: this.maxHeight,
      waterLevel: this.waterLevel
    };
  }
}