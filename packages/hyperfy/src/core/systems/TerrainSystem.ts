import { System } from './System';
import * as THREE from '../extras/three';
import { geometryToPxMesh, PMeshHandle } from '../extras/geometryToPxMesh';
import { Layers } from '../extras/Layers';
import type { World } from '../../types';
import type { RPGWorldChunk } from '../../rpg/types/index';

/**
 * Unified Terrain System
 * 
 * Specifications:
 * - 100x100m tiles (100m x 100m each)
 * - 100x100 world grid = 10km x 10km total world
 * - Only load current tile + adjacent tiles (3x3 = 9 tiles max)
 * - Procedural heightmap generation with biomes
 * - PhysX collision support
 * - Resource placement and road generation
 */

interface TerrainTile {
    key: string;
    x: number;
    z: number;
    mesh: THREE.Mesh;
    collision?: any; // PhysX collision body
    biome: string;
    resources: ResourceNode[];
    roads: RoadSegment[];
    waterMeshes?: THREE.Mesh[]; // Visual water representation
    generated: boolean;
    heightData?: number[];
    lastActiveTime?: Date;
    playerCount: number;
    needsSave: boolean;
    chunkSeed?: number;
}

interface ResourceNode {
    id: string;
    type: 'tree' | 'rock' | 'ore' | 'herb' | 'fish' | 'gem' | 'rare_ore';
    position: THREE.Vector3;
    mesh?: THREE.Mesh;
}

interface RoadSegment {
    start: THREE.Vector2;
    end: THREE.Vector2;
    width: number;
    mesh?: THREE.Mesh;
}

interface BiomeData {
    name: string;
    color: number;
    heightRange: [number, number];
    resources: string[];
    terrainMultiplier: number;
    waterLevel: number;           // Height below which terrain is considered water
    maxSlope: number;            // Maximum walkable slope (0-1, where 1 = 45 degrees)
    mobTypes: string[];          // Mob types that spawn in this biome
    difficulty: number;          // Difficulty level (0=safe, 1=easy, 2=medium, 3=hard)
}

export class TerrainSystem extends System {
    private terrainTiles = new Map<string, TerrainTile>();
    private terrainContainer: THREE.Group | null = null;
    private isInitialized = false;
    private lastPlayerTile = { x: 0, z: 0 };
    private updateTimer = 0;
    private databaseSystem?: any; // RPGDatabaseSystem reference
    private chunkSaveInterval?: NodeJS.Timeout;
    private activeChunks = new Set<string>();
    
    // Enhanced chunk loading system
    private chunkLoadingStrategy: 'core_plus_ring' | 'spiral' = 'core_plus_ring';
    private coreChunkRange = 1; // 9 core chunks (3x3 grid)
    private ringChunkRange = 2; // Additional ring around core chunks
    private playerChunks = new Map<string, Set<string>>(); // player -> chunk keys
    private simulatedChunks = new Set<string>(); // chunks with active simulation
    private isGenerating = false; // Track if terrain generation is in progress
    private chunkPlayerCounts = new Map<string, number>(); // chunk -> player count
    
    // Serialization system
    private lastSerializationTime = 0;
    private serializationInterval = 15 * 60 * 1000; // 15 minutes in milliseconds
    private worldStateVersion = 1;
    private pendingSerializationData = new Map<string, any>();
    
    // Bounding box verification
    private worldBounds = {
        minX: -1000, maxX: 1000,
        minZ: -1000, maxZ: 1000,
        minY: -50, maxY: 100
    };
    private terrainBoundingBoxes = new Map<string, THREE.Box3>();
    
    // World Configuration - Your Specifications
    private readonly CONFIG = {
        // Core World Specs
        TILE_SIZE: 100,           // 100m x 100m tiles
        WORLD_SIZE: 100,          // 100x100 grid = 10km x 10km world
        TILE_RESOLUTION: 64,      // 64x64 vertices per tile for smooth terrain
        MAX_HEIGHT: 50,           // 50m max height variation
        
        // Chunking - Only adjacent tiles
        VIEW_DISTANCE: 1,         // Load only 1 tile in each direction (3x3 = 9 tiles)
        UPDATE_INTERVAL: 0.5,     // Check player movement every 0.5 seconds
        
        // Terrain Generation - Multi-octave noise
        NOISE_SCALE: 0.02,        // Primary terrain noise frequency
        NOISE_OCTAVES: 4,         // Number of noise octaves for detail
        NOISE_PERSISTENCE: 0.5,   // Amplitude reduction per octave
        NOISE_LACUNARITY: 2.0,    // Frequency increase per octave
        BIOME_SCALE: 0.003,       // Biome transition frequency (larger = bigger biomes)
        HEIGHT_AMPLIFIER: 1.0,    // Height scaling factor
        
        // Movement Constraints
        WATER_IMPASSABLE: true,   // Water blocks movement
        MAX_WALKABLE_SLOPE: 0.7,  // Maximum slope for movement (tan of angle)
        SLOPE_CHECK_DISTANCE: 1,  // Distance to check for slope calculation
        
        // Features
        ROAD_WIDTH: 4,            // 4m wide roads
        RESOURCE_DENSITY: 0.08,   // 8% chance per area for resources
        TREE_DENSITY: 0.15,       // 15% chance for trees in forest biomes
        TOWN_RADIUS: 25,          // Safe radius around towns
    };
    
    // GDD-Compliant Biomes - All 8 specified biomes from Game Design Document
    private readonly BIOMES: Record<string, BiomeData> = {
        // Core biomes from GDD
        'mistwood_valley': {
            name: 'Mistwood Valley',
            color: 0x3d5a47,
            heightRange: [0.1, 0.4],
            resources: ['tree', 'herb'],
            terrainMultiplier: 0.6,
            waterLevel: 2.0,
            maxSlope: 0.4,
            mobTypes: ['goblin', 'bandit'],
            difficulty: 1
        },
        'goblin_wastes': {
            name: 'Goblin Wastes',
            color: 0x8b7355,
            heightRange: [0.0, 0.3],
            resources: ['rock', 'ore'],
            terrainMultiplier: 0.4,
            waterLevel: 1.0,
            maxSlope: 0.6,
            mobTypes: ['goblin', 'hobgoblin'],
            difficulty: 1
        },
        'darkwood_forest': {
            name: 'Darkwood Forest',
            color: 0x1a2e1a,
            heightRange: [0.2, 0.7],
            resources: ['tree', 'herb', 'rare_ore'],
            terrainMultiplier: 0.9,
            waterLevel: 2.5,
            maxSlope: 0.5,
            mobTypes: ['dark_warrior', 'barbarian'],
            difficulty: 2
        },
        'northern_reaches': {
            name: 'Northern Reaches',
            color: 0x7a8fa8,
            heightRange: [0.6, 1.0],
            resources: ['rock', 'gem', 'rare_ore'],
            terrainMultiplier: 1.2,
            waterLevel: 0.5,
            maxSlope: 0.8,
            mobTypes: ['ice_warrior', 'black_knight'],
            difficulty: 3
        },
        'blasted_lands': {
            name: 'Blasted Lands',
            color: 0x5a4a3a,
            heightRange: [0.0, 0.4],
            resources: ['rare_ore'],
            terrainMultiplier: 0.3,
            waterLevel: 0.0,
            maxSlope: 0.7,
            mobTypes: ['dark_ranger', 'black_knight'],
            difficulty: 3
        },
        'lakes': {
            name: 'Lakes',
            color: 0x4a90e2,
            heightRange: [-0.2, 0.1],
            resources: ['fish'],
            terrainMultiplier: 0.1,
            waterLevel: 5.0,
            maxSlope: 0.2,
            mobTypes: [],
            difficulty: 0
        },
        'plains': {
            name: 'Plains',
            color: 0x6b8f47,
            heightRange: [0.0, 0.2],
            resources: ['tree', 'herb'],
            terrainMultiplier: 0.3,
            waterLevel: 1.5,
            maxSlope: 0.3,
            mobTypes: ['bandit', 'barbarian'],
            difficulty: 1
        },
        'starter_towns': {
            name: 'Starter Towns',
            color: 0x8fbc8f,
            heightRange: [0.1, 0.3],
            resources: ['tree'],
            terrainMultiplier: 0.2,
            waterLevel: 2.0,
            maxSlope: 0.2,
            mobTypes: [],
            difficulty: 0
        }
    };

    constructor(world: World) {
        super(world);
        console.log('[UnifiedTerrain] ====================================');
        console.log('[UnifiedTerrain] 🌍 Initializing Unified Terrain System');
        console.log('[UnifiedTerrain] World specs: 100x100m tiles, 10km x 10km world, 3x3 tile loading');
        console.log('[UnifiedTerrain] ====================================');
    }

    async init(): Promise<void> {
        console.log('[UnifiedTerrain] 🚀 Starting MMORPG terrain initialization...');
        
        // Get systems references
        this.databaseSystem = this.world.systems?.['rpg-database'];
        if (!this.databaseSystem) {
            console.log('[UnifiedTerrain] ⚠️ RPGDatabaseSystem not found - chunk persistence disabled');
        } else {
            console.log('[UnifiedTerrain] ✅ Connected to RPGDatabaseSystem for chunk persistence');
        }

        // Initialize chunk loading system
        this.initializeChunkLoadingSystem();
        
        // Initialize serialization system  
        this.initializeSerializationSystem();
        
        // Initialize bounding box verification
        this.initializeBoundingBoxSystem();

        // Environment detection (deferred until network system is available)
        const networkSystem = this.world.network;
        if (networkSystem?.isClient) {
            console.log('[UnifiedTerrain] 🖥️ CLIENT-SIDE: Initializing terrain rendering...');
        } else if (networkSystem?.isServer) {
            console.log('[UnifiedTerrain] 🖥️ SERVER-SIDE: Initializing terrain generation...');
        } else {
            console.log('[UnifiedTerrain] ⚠️ DEFERRED: Network system not initialized yet - will check in start() method');
        }
        
        console.log('[UnifiedTerrain] ✅ MMORPG terrain system initialized with:');
        console.log(`  - Chunk loading strategy: ${this.chunkLoadingStrategy}`);
        console.log(`  - Core chunk range: ${this.coreChunkRange} (${Math.pow(this.coreChunkRange * 2 + 1, 2)} chunks)`);
        console.log(`  - Ring chunk range: ${this.ringChunkRange}`);
        console.log(`  - Serialization interval: ${this.serializationInterval / 1000}s`);
        console.log(`  - World bounds: ${JSON.stringify(this.worldBounds)}`);
    }

    async start(): Promise<void> {
        console.log('[UnifiedTerrain] 🌟 Starting MMORPG terrain system...');
        
        // Final environment detection
        const isServer = this.world.network?.isServer || false;
        const isClient = this.world.network?.isClient || false;
        
        console.log('[UnifiedTerrain] 🖥️ Environment check:', {
            isServer,
            isClient,
            hasGraphics: !!this.world.graphics,
            hasStage: !!this.world.stage,
            hasScene: !!(this.world.stage as any)?.scene
        });

        if (isClient) {
            console.log('[UnifiedTerrain] 🖥️ CLIENT-SIDE: Setting up terrain rendering...');
            this.setupClientTerrain();
        } else if (isServer) {
            console.log('[UnifiedTerrain] 🖥️ SERVER-SIDE: Setting up terrain generation...');
            this.setupServerTerrain();
        } else {
            console.log('[UnifiedTerrain] ⚠️ UNKNOWN ENVIRONMENT: Neither server nor client detected');
        }
        
        // Start player-based terrain update loop
        setInterval(() => {
            this.updatePlayerBasedTerrain();
        }, 1000); // Update every second
        
        // Start serialization loop
        setInterval(() => {
            this.performPeriodicSerialization();
        }, 60000); // Check every minute
        
        // Start bounding box verification
        setInterval(() => {
            this.verifyTerrainBoundingBoxes();
        }, 30000); // Verify every 30 seconds
        
        console.log('[UnifiedTerrain] ✅ All MMORPG terrain systems started');
    }

    private setupClientTerrain(): void {
        console.log('[UnifiedTerrain] 🎨 Setting up client-side terrain rendering...');
        
        // Debug the stage object structure
        console.log('[UnifiedTerrain] 🔍 Debugging stage object:', {
            hasStage: !!this.world.stage,
            stageType: this.world.stage?.constructor?.name,
            hasScene: !!(this.world.stage as any)?.scene,
            sceneType: (this.world.stage as any)?.scene?.constructor?.name,
            hasSceneAdd: typeof (this.world.stage as any)?.scene?.add,
            stageKeys: this.world.stage ? Object.keys(this.world.stage) : 'no stage',
            sceneKeys: (this.world.stage as any)?.scene ? Object.keys((this.world.stage as any).scene) : 'no scene',
            sceneProto: (this.world.stage as any)?.scene ? Object.getPrototypeOf((this.world.stage as any).scene).constructor.name : 'no scene',
            isThreeScene: (this.world.stage as any)?.scene instanceof THREE.Scene
        });
        
        // Verify scene is available with better error detection
        const stage = this.world.stage as any;
        const scene = stage?.scene;
        
        if (!stage) {
            console.error('[UnifiedTerrain] ❌ Stage system not available');
            return;
        }
        
        if (!scene) {
            console.error('[UnifiedTerrain] ❌ Scene not available in stage system');
            console.error('[UnifiedTerrain] 🔍 Stage object properties:', Object.getOwnPropertyNames(stage));
            return;
        }
        
        if (typeof scene.add !== 'function') {
            console.error('[UnifiedTerrain] ❌ Scene.add is not a function');
            console.error('[UnifiedTerrain] 🔍 Scene object:', scene);
            console.error('[UnifiedTerrain] 🔍 Scene object properties:', Object.getOwnPropertyNames(scene));
            console.error('[UnifiedTerrain] 🔍 Scene prototype:', Object.getPrototypeOf(scene));
            return;
        }

        console.log('[UnifiedTerrain] ✅ Scene available and functional, creating terrain container...');
        
        // Create terrain container
        this.terrainContainer = new THREE.Group();
        this.terrainContainer.name = 'TerrainContainer';
        scene.add(this.terrainContainer);
        
        console.log('[UnifiedTerrain] ✅ Terrain container added to scene');

        // Debug camera setup
        if ((this.world as any).camera) {
            const camera = (this.world as any).camera;
            console.log('[UnifiedTerrain] 📷 Camera info:', {
                position: camera.position.toArray(),
                rotation: camera.rotation.toArray(),
                fov: camera.fov,
                near: camera.near,
                far: camera.far,
                aspect: camera.aspect
            });
            
            // Position camera for terrain viewing
            camera.position.set(0, 100, 200);
            camera.lookAt(0, 0, 0);
            camera.updateProjectionMatrix();
            console.log('[UnifiedTerrain] 🎯 Positioned camera for terrain viewing');
        }
        
        // Load initial tiles
        this.loadInitialTiles();
    }

    private setupServerTerrain(): void {
        console.log('[UnifiedTerrain] 🛠️ Setting up server-side terrain generation...');
        
        // Setup chunk save interval for persistence
        if (this.databaseSystem) {
            this.chunkSaveInterval = setInterval(() => {
                this.saveModifiedChunks();
            }, 30000); // Save every 30 seconds
            console.log('[UnifiedTerrain] 💾 Chunk auto-save enabled (30 second interval)');
        }
        
        // Pre-generate spawn area tiles
        this.loadInitialTiles();
        console.log('[UnifiedTerrain] ✅ Server terrain generation setup complete');
    }

    private loadInitialTiles(): void {
        const startTime = performance.now();
        let tilesGenerated = 0;
        
        console.log('[UnifiedTerrain] 🗺️ Loading initial 3x3 tile grid...');
        
        // Generate 3x3 grid around origin
        for (let dx = -1; dx <= 1; dx++) {
            for (let dz = -1; dz <= 1; dz++) {
                this.generateTile(dx, dz);
                tilesGenerated++;
            }
        }
        
        const endTime = performance.now();
        console.log(`[UnifiedTerrain] ⚡ Generated ${tilesGenerated} initial tiles in ${(endTime - startTime).toFixed(2)}ms`);
    }

    private generateTile(tileX: number, tileZ: number): TerrainTile {
        const key = `${tileX}_${tileZ}`;
        
        // Check if tile already exists
        if (this.terrainTiles.has(key)) {
            return this.terrainTiles.get(key)!;
        }

        console.log(`[UnifiedTerrain] 🏗️ Generating tile at (${tileX}, ${tileZ})...`);
        
        // Create geometry for this tile
        const geometry = this.createTileGeometry(tileX, tileZ);
        
        // Create material with vertex colors
        const material = new THREE.MeshBasicMaterial({ 
            vertexColors: true,
            wireframe: false
        });
        
        // Create mesh
        const mesh = new THREE.Mesh(geometry, material);
        mesh.position.set(
            tileX * this.CONFIG.TILE_SIZE,
            0,
            tileZ * this.CONFIG.TILE_SIZE
        );
        mesh.name = `Terrain_${key}`;
        
        // Add userData for click-to-move detection and other systems
        mesh.userData = {
            type: 'terrain',
            walkable: true,
            clickable: true,
            biome: this.getBiomeAt(tileX, tileZ),
            tileKey: key,
            tileX: tileX,
            tileZ: tileZ
        };
        
        // Add to scene if client-side
        if (this.terrainContainer) {
            this.terrainContainer.add(mesh);
            console.log(`[UnifiedTerrain] ✅ Added tile mesh to scene: ${key}`);
        }
        
        // Generate collision if server-side
        let collision: PMeshHandle | null = null;
        if (this.world.network?.isServer && this.world.physics) {
            try {
                collision = geometryToPxMesh(this.world, geometry, false);
                console.log(`[UnifiedTerrain] 🧊 Generated PhysX collision for tile: ${key}`);
            } catch (error) {
                console.warn(`[UnifiedTerrain] ⚠️ Failed to generate collision for tile ${key}:`, error);
            }
        }
        
        // Create tile object
        const tile: TerrainTile = {
            key,
            x: tileX,
            z: tileZ,
            mesh,
            collision,
            biome: this.getBiomeAt(tileX, tileZ),
            resources: [],
            roads: [],
            generated: true,
            lastActiveTime: new Date(),
            playerCount: 0,
            needsSave: true
        };
        
        // Generate resources for this tile
        this.generateTileResources(tile);
        
        // Generate visual features (roads, lakes)
        this.generateVisualFeatures(tile);
        
        // Store tile
        this.terrainTiles.set(key, tile);
        this.activeChunks.add(key);
        
        console.log(`[UnifiedTerrain] ✅ Tile generated: ${key} (biome: ${tile.biome})`);
        return tile;
    }

    private createTileGeometry(tileX: number, tileZ: number): THREE.PlaneGeometry {
        const geometry = new THREE.PlaneGeometry(
            this.CONFIG.TILE_SIZE, 
            this.CONFIG.TILE_SIZE, 
            this.CONFIG.TILE_RESOLUTION - 1, 
            this.CONFIG.TILE_RESOLUTION - 1
        );
        
        // Rotate to be horizontal
        geometry.rotateX(-Math.PI / 2);
        
        const positions = geometry.attributes.position;
        const colors = new Float32Array(positions.count * 3);
        const heightData: number[] = [];
        
        // Get biome color
        const biome = this.getBiomeAt(tileX, tileZ);
        const biomeData = this.BIOMES[biome];
        
        // Safety check for biomeData - use plains as fallback
        const safeBiomeData = biomeData || this.BIOMES['plains'] || {
            color: 0x6b8f47,
            name: 'Plains'
        };
        
        if (!biomeData) {
            console.error(`[TerrainSystem] Biome '${biome}' not found in BIOMES. Using default plains biome.`);
        }
        
        // Pre-calculate road data for this tile
        const roadColor = new THREE.Color(0x8B7355); // Brown road color
        const roadMap = this.calculateRoadVertexInfluence(tileX, tileZ);
        
        // Generate heightmap and vertex colors
        for (let i = 0; i < positions.count; i++) {
            const x = positions.getX(i) + (tileX * this.CONFIG.TILE_SIZE);
            const z = positions.getZ(i) + (tileZ * this.CONFIG.TILE_SIZE);
            
            // Generate height using noise
            const height = this.getHeightAt(x, z);
            positions.setY(i, height);
            heightData.push(height);
            
            // Start with biome color
            const color = new THREE.Color(safeBiomeData.color);
            
            // Add height-based variation
            const heightFactor = (height / this.CONFIG.MAX_HEIGHT) * 0.5 + 0.5;
            color.multiplyScalar(heightFactor);
            
            // Check for road influence at this vertex
            const localX = positions.getX(i);
            const localZ = positions.getZ(i);
            const roadInfluence = roadMap.get(`${localX.toFixed(1)},${localZ.toFixed(1)}`) || 0;
            
            if (roadInfluence > 0) {
                // Blend road color with terrain color
                color.lerp(roadColor, roadInfluence);
                
                // Flatten terrain slightly for roads
                const flattenedHeight = height * (1 - roadInfluence * 0.1);
                positions.setY(i, flattenedHeight);
                heightData[heightData.length - 1] = flattenedHeight;
            }
            
            colors[i * 3] = color.r;
            colors[i * 3 + 1] = color.g;
            colors[i * 3 + 2] = color.b;
        }
        
        geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
        geometry.computeVertexNormals();
        
        // Store height data for persistence
        this.storeHeightData(tileX, tileZ, heightData);
        
        return geometry;
    }

    private getHeightAt(worldX: number, worldZ: number): number {
        // Multi-octave noise for realistic terrain generation
        let height = 0;
        let amplitude = 1;
        let frequency = this.CONFIG.NOISE_SCALE;
        let maxHeight = 0;
        
        // Generate multiple octaves of noise
        for (let i = 0; i < this.CONFIG.NOISE_OCTAVES; i++) {
            const noiseValue = this.generateNoise(worldX * frequency, worldZ * frequency);
            height += noiseValue * amplitude;
            maxHeight += amplitude;
            
            amplitude *= this.CONFIG.NOISE_PERSISTENCE;
            frequency *= this.CONFIG.NOISE_LACUNARITY;
        }
        
        // Normalize height
        height = height / maxHeight;
        
        // Get biome data for this position
        const tileX = Math.floor(worldX / this.CONFIG.TILE_SIZE);
        const tileZ = Math.floor(worldZ / this.CONFIG.TILE_SIZE);
        const biome = this.getBiomeAt(tileX, tileZ);
        const biomeData = this.BIOMES[biome];
        
        // Safety check for biomeData before using it
        if (!biomeData) {
            console.error(`[TerrainSystem] Biome '${biome}' not found in BIOMES for height generation. Using default height.`);
            return height * this.CONFIG.MAX_HEIGHT * 0.3; // Default to plains-like height
        }
        
        // Apply biome-specific height modification
        height *= biomeData.terrainMultiplier;
        
        // Clamp height within biome range
        const biomeHeight = biomeData.heightRange[0] + 
                           (biomeData.heightRange[1] - biomeData.heightRange[0]) * (height * 0.5 + 0.5);
        
        return biomeHeight * this.CONFIG.MAX_HEIGHT * this.CONFIG.HEIGHT_AMPLIFIER;
    }
    
    private generateNoise(x: number, z: number): number {
        // Improved noise function with better distribution
        const sin1 = Math.sin(x * 2.1 + z * 1.7);
        const cos1 = Math.cos(x * 1.3 - z * 2.4);
        const sin2 = Math.sin(x * 3.7 - z * 4.1);
        const cos2 = Math.cos(x * 5.2 + z * 3.8);
        
        return (sin1 * cos1 + sin2 * cos2 * 0.5) * 0.5;
    }

    private getBiomeAt(tileX: number, tileZ: number): string {
        // GDD-compliant biome determination using Voronoi-like regions
        
        // Check if near starter towns first (safe zones)
        const starterTowns = [
            { x: 0, z: 0, name: 'Brookhaven' },
            { x: 10, z: 0, name: 'Eastport' },
            { x: -10, z: 0, name: 'Westfall' },
            { x: 0, z: 10, name: 'Northridge' },
            { x: 0, z: -10, name: 'Southmere' }
        ];
        
        for (const town of starterTowns) {
            const distance = Math.sqrt((tileX - town.x) ** 2 + (tileZ - town.z) ** 2);
            if (distance < 3) return 'starter_towns';
        }
        
        // Use noise-based biome generation for realistic distribution
        const biomeNoise = this.getBiomeNoise(tileX * this.CONFIG.BIOME_SCALE, tileZ * this.CONFIG.BIOME_SCALE);
        const distanceFromCenter = Math.sqrt(tileX * tileX + tileZ * tileZ);
        
        // Biome selection based on noise and distance (difficulty zones)
        if (biomeNoise < -0.4) {
            return 'lakes';
        } else if (distanceFromCenter < 8) {
            // Close to center - easier biomes
            return biomeNoise > 0.2 ? 'mistwood_valley' : 'plains';
        } else if (distanceFromCenter < 15) {
            // Medium distance - intermediate biomes
            if (biomeNoise > 0.3) return 'darkwood_forest';
            if (biomeNoise > -0.1) return 'goblin_wastes';
            return 'plains';
        } else {
            // Far from center - difficult biomes
            if (biomeNoise > 0.4) return 'northern_reaches';
            if (biomeNoise > 0.0) return 'darkwood_forest';
            return 'blasted_lands';
        }
    }
    
    private getBiomeNoise(x: number, z: number): number {
        // Simple noise function for biome determination
        return Math.sin(x * 2.1 + z * 1.7) * Math.cos(x * 1.3 - z * 2.4) * 0.5 +
               Math.sin(x * 4.2 + z * 3.8) * Math.cos(x * 2.7 - z * 4.1) * 0.3 +
               Math.sin(x * 8.1 - z * 6.2) * Math.cos(x * 5.9 + z * 7.3) * 0.2;
    }

    private generateTileResources(tile: TerrainTile): void {
        const biomeData = this.BIOMES[tile.biome];
        
        // Safety check for biomeData
        if (!biomeData) {
            console.error(`[TerrainSystem] Biome '${tile.biome}' not found in BIOMES for resource generation. Skipping resources.`);
            return;
        }
        
        // Enhanced resource generation based on biome type and terrain
        this.generateTreesForTile(tile, biomeData);
        this.generateOtherResourcesForTile(tile, biomeData);
        this.generateRoadsForTile(tile);
        
        console.log(`[UnifiedTerrain] 🌳 Generated ${tile.resources.length} resources and ${tile.roads.length} roads for tile ${tile.key} (${tile.biome})`);
    }
    
    private generateTreesForTile(tile: TerrainTile, biomeData: BiomeData): void {
        // Trees generation based on biome type
        if (!biomeData.resources.includes('tree')) return;
        
        let treeDensity = this.CONFIG.RESOURCE_DENSITY;
        
        // Adjust density based on biome
        switch (tile.biome) {
            case 'mistwood_valley':
            case 'darkwood_forest':
                treeDensity = this.CONFIG.TREE_DENSITY; // Higher density in forests
                break;
            case 'plains':
            case 'starter_towns':
                treeDensity = this.CONFIG.RESOURCE_DENSITY * 0.5; // Lower density in open areas
                break;
            case 'northern_reaches':
            case 'blasted_lands':
                treeDensity = this.CONFIG.RESOURCE_DENSITY * 0.2; // Very few trees in harsh areas
                break;
        }
        
        const treeCount = Math.floor((this.CONFIG.TILE_SIZE / 10) ** 2 * treeDensity);
        
        for (let i = 0; i < treeCount; i++) {
            const worldX = (tile.x * this.CONFIG.TILE_SIZE) + (Math.random() - 0.5) * this.CONFIG.TILE_SIZE;
            const worldZ = (tile.z * this.CONFIG.TILE_SIZE) + (Math.random() - 0.5) * this.CONFIG.TILE_SIZE;
            
            // Check if position is walkable (don't place trees in water or on steep slopes)
            const walkableCheck = this.isPositionWalkable(worldX, worldZ);
            if (!walkableCheck.walkable) continue;
            
            const height = this.getHeightAt(worldX, worldZ);
            const position = new THREE.Vector3(
                worldX - (tile.x * this.CONFIG.TILE_SIZE),
                height,
                worldZ - (tile.z * this.CONFIG.TILE_SIZE)
            );
            
            const tree: ResourceNode = {
                id: `${tile.key}_tree_${i}`,
                type: 'tree',
                position
            };
            
            tile.resources.push(tree);
        }
    }
    
    private generateOtherResourcesForTile(tile: TerrainTile, biomeData: BiomeData): void {
        // Generate other resources (ore, herbs, fishing spots, etc.)
        const otherResources = biomeData.resources.filter(r => r !== 'tree');
        
        for (const resourceType of otherResources) {
            let resourceCount = 0;
            
            // Determine count based on resource type and biome
            switch (resourceType) {
                case 'fish':
                    resourceCount = tile.biome === 'lakes' ? 3 : 0;
                    break;
                case 'ore':
                case 'rare_ore':
                    resourceCount = Math.random() < 0.3 ? 1 : 0;
                    break;
                case 'herb':
                    resourceCount = Math.floor(Math.random() * 3);
                    break;
                case 'rock':
                    resourceCount = Math.floor(Math.random() * 2);
                    break;
                case 'gem':
                    resourceCount = Math.random() < 0.1 ? 1 : 0; // Rare
                    break;
            }
            
            for (let i = 0; i < resourceCount; i++) {
                const worldX = (tile.x * this.CONFIG.TILE_SIZE) + (Math.random() - 0.5) * this.CONFIG.TILE_SIZE;
                const worldZ = (tile.z * this.CONFIG.TILE_SIZE) + (Math.random() - 0.5) * this.CONFIG.TILE_SIZE;
                
                // For fishing spots, place near water
                if (resourceType === 'fish') {
                    const height = this.getHeightAt(worldX, worldZ);
                    if (height >= biomeData.waterLevel) continue; // Only place fish in water
                }
                
                const height = this.getHeightAt(worldX, worldZ);
                const position = new THREE.Vector3(
                    worldX - (tile.x * this.CONFIG.TILE_SIZE),
                    height,
                    worldZ - (tile.z * this.CONFIG.TILE_SIZE)
                );
                
                const resource: ResourceNode = {
                    id: `${tile.key}_${resourceType}_${i}`,
                    type: resourceType as any,
                    position
                };
                
                tile.resources.push(resource);
            }
        }
    }
    
    private generateRoadsForTile(tile: TerrainTile): void {
        // Generate roads connecting to nearby starter towns
        const starterTowns = [
            { x: 0, z: 0 }, { x: 10, z: 0 }, { x: -10, z: 0 },
            { x: 0, z: 10 }, { x: 0, z: -10 }
        ];
        
        for (const town of starterTowns) {
            const distance = Math.sqrt((tile.x - town.x) ** 2 + (tile.z - town.z) ** 2);
            
            // Generate road segments for tiles within reasonable distance of towns
            if (distance < 8 && distance > 0.5) {
                const roadDirection = {
                    x: (town.x - tile.x) / distance,
                    z: (town.z - tile.z) / distance
                };
                
                const roadStart = new THREE.Vector2(
                    -roadDirection.x * this.CONFIG.TILE_SIZE * 0.5,
                    -roadDirection.z * this.CONFIG.TILE_SIZE * 0.5
                );
                
                const roadEnd = new THREE.Vector2(
                    roadDirection.x * this.CONFIG.TILE_SIZE * 0.5,
                    roadDirection.z * this.CONFIG.TILE_SIZE * 0.5
                );
                
                const road: RoadSegment = {
                    start: roadStart,
                    end: roadEnd,
                    width: this.CONFIG.ROAD_WIDTH
                };
                
                tile.roads.push(road);
                break; // Only one road per tile
            }
        }
    }
    
    /**
     * Calculate road influence for vertex coloring
     */
    private calculateRoadVertexInfluence(tileX: number, tileZ: number): Map<string, number> {
        const roadMap = new Map<string, number>();
        
        // Generate temporary tile to get road data
        const tempTile: TerrainTile = {
            key: `temp_${tileX}_${tileZ}`,
            x: tileX,
            z: tileZ,
            mesh: null as any,
            biome: this.getBiomeAt(tileX, tileZ),
            resources: [],
            roads: [],
            generated: false,
            playerCount: 0,
            needsSave: false
        };
        
        this.generateRoadsForTile(tempTile);
        
        // Calculate influence for each vertex position
        const resolution = this.CONFIG.TILE_RESOLUTION;
        const step = this.CONFIG.TILE_SIZE / (resolution - 1);
        
        for (let i = 0; i < resolution; i++) {
            for (let j = 0; j < resolution; j++) {
                const localX = (i - (resolution - 1) / 2) * step;
                const localZ = (j - (resolution - 1) / 2) * step;
                
                let maxInfluence = 0;
                
                // Check distance to each road segment
                for (const road of tempTile.roads) {
                    const distanceToRoad = this.distanceToLineSegment(
                        new THREE.Vector2(localX, localZ),
                        road.start,
                        road.end
                    );
                    
                    // Calculate influence based on distance (closer = more influence)
                    const halfWidth = road.width * 0.5;
                    if (distanceToRoad <= halfWidth) {
                        const influence = 1 - (distanceToRoad / halfWidth);
                        maxInfluence = Math.max(maxInfluence, influence);
                    }
                }
                
                if (maxInfluence > 0) {
                    roadMap.set(`${localX.toFixed(1)},${localZ.toFixed(1)}`, maxInfluence);
                }
            }
        }
        
        return roadMap;
    }
    
    /**
     * Calculate distance from point to line segment
     */
    private distanceToLineSegment(point: THREE.Vector2, lineStart: THREE.Vector2, lineEnd: THREE.Vector2): number {
        const lineLengthSquared = lineStart.distanceToSquared(lineEnd);
        
        if (lineLengthSquared === 0) {
            return point.distanceTo(lineStart);
        }
        
        const t = Math.max(0, Math.min(1, 
            point.clone().sub(lineStart).dot(lineEnd.clone().sub(lineStart)) / lineLengthSquared
        ));
        
        const projection = lineStart.clone().add(
            lineEnd.clone().sub(lineStart).multiplyScalar(t)
        );
        
        return point.distanceTo(projection);
    }
    
    /**
     * Store height data for persistence and collision generation
     */
    private storeHeightData(tileX: number, tileZ: number, heightData: number[]): void {
        const key = `${tileX}_${tileZ}`;
        const tile = this.terrainTiles.get(key);
        
        if (tile) {
            tile.heightData = heightData;
            tile.needsSave = true;
            
            console.log(`[TerrainSystem] Stored height data for tile ${key}: ${heightData.length} points`);
        }
    }

    private saveModifiedChunks(): void {
        if (!this.databaseSystem) return;
        
        const chunksToSave = Array.from(this.terrainTiles.values()).filter(tile => tile.needsSave);
        
        for (const tile of chunksToSave) {
            try {
                const chunkData: RPGWorldChunk = {
                    chunkX: tile.x,
                    chunkZ: tile.z,
                    biome: tile.biome,
                    heightData: tile.heightData || [],
                    resourceStates: {},
                    mobSpawnStates: {},
                    playerModifications: {},
                    chunkSeed: tile.chunkSeed || 0,
                    lastActiveTime: tile.lastActiveTime || new Date(),
                    playerCount: tile.playerCount,
                    needsReset: false,
                    createdAt: new Date(),
                    updatedAt: new Date()
                };
                
                this.databaseSystem.saveChunk(chunkData);
                tile.needsSave = false;
            } catch (error) {
                console.error(`[UnifiedTerrain] Failed to save chunk ${tile.key}:`, error);
            }
        }
        
        if (chunksToSave.length > 0) {
            console.log(`[UnifiedTerrain] 💾 Saved ${chunksToSave.length} modified chunks`);
        }
    }

    update(deltaTime: number): void {
        this.updateTimer += deltaTime;
        
        // Only check for tile updates periodically
        if (this.updateTimer >= this.CONFIG.UPDATE_INTERVAL) {
            this.updateTimer = 0;
            this.checkPlayerMovement();
        }
    }

    private checkPlayerMovement(): void {
        // Get player positions and update loaded tiles accordingly
        const players = this.world.entities?.getPlayers?.() || [];
        
        for (const player of players) {
            if (player.position) {
                const tileX = Math.floor(player.position.x / this.CONFIG.TILE_SIZE);
                const tileZ = Math.floor(player.position.z / this.CONFIG.TILE_SIZE);
                
                // Check if player moved to a new tile
                if (tileX !== this.lastPlayerTile.x || tileZ !== this.lastPlayerTile.z) {
                    this.updateTilesAroundPlayer(tileX, tileZ);
                    this.lastPlayerTile = { x: tileX, z: tileZ };
                }
            }
        }
    }

    private updateTilesAroundPlayer(centerX: number, centerZ: number): void {
        const requiredTiles = new Set<string>();
        
        // Generate list of required tiles (3x3 around player)
        for (let dx = -this.CONFIG.VIEW_DISTANCE; dx <= this.CONFIG.VIEW_DISTANCE; dx++) {
            for (let dz = -this.CONFIG.VIEW_DISTANCE; dz <= this.CONFIG.VIEW_DISTANCE; dz++) {
                const tileX = centerX + dx;
                const tileZ = centerZ + dz;
                requiredTiles.add(`${tileX}_${tileZ}`);
            }
        }
        
        // Unload tiles that are no longer needed
        for (const [key, tile] of this.terrainTiles) {
            if (!requiredTiles.has(key)) {
                this.unloadTile(tile);
            }
        }
        
        // Load new tiles that are needed
        for (const key of requiredTiles) {
            if (!this.terrainTiles.has(key)) {
                const [tileX, tileZ] = key.split('_').map(Number);
                this.generateTile(tileX, tileZ);
            }
        }
    }

    private unloadTile(tile: TerrainTile): void {
        // Clean up road meshes
        for (const road of tile.roads) {
            if (road.mesh && road.mesh.parent) {
                road.mesh.parent.remove(road.mesh);
                road.mesh.geometry.dispose();
                if (road.mesh.material instanceof THREE.Material) {
                    road.mesh.material.dispose();
                }
                road.mesh = undefined;
            }
        }
        
        // Clean up water meshes
        if (tile.waterMeshes) {
            for (const waterMesh of tile.waterMeshes) {
                if (waterMesh.parent) {
                    waterMesh.parent.remove(waterMesh);
                    waterMesh.geometry.dispose();
                    if (waterMesh.material instanceof THREE.Material) {
                        waterMesh.material.dispose();
                    }
                }
            }
            tile.waterMeshes = [];
        }
        
        // Remove main tile mesh from scene
        if (this.terrainContainer && tile.mesh.parent) {
            this.terrainContainer.remove(tile.mesh);
            tile.mesh.geometry.dispose();
            if (tile.mesh.material instanceof THREE.Material) {
                tile.mesh.material.dispose();
            }
        }
        
        // Remove collision
        if (tile.collision && this.world.physics) {
            this.world.physics.removeCollider(tile.collision);
        }
        
        // Save if needed
        if (tile.needsSave && this.databaseSystem) {
            // Save tile data before unloading
            // This would be implemented when we have the database schema
        }
        
        // Remove from maps
        this.terrainTiles.delete(tile.key);
        this.activeChunks.delete(tile.key);
        
        console.log(`[UnifiedTerrain] 🗑️ Unloaded tile: ${tile.key}`);
    }

    // ===== TERRAIN MOVEMENT CONSTRAINTS (GDD Requirement) =====
    
    /**
     * Check if a position is walkable based on terrain constraints
     * Implements GDD rules: "Water bodies are impassable" and "Steep mountain slopes block movement"
     */
    isPositionWalkable(worldX: number, worldZ: number): { walkable: boolean; reason?: string } {
        const tileX = Math.floor(worldX / this.CONFIG.TILE_SIZE);
        const tileZ = Math.floor(worldZ / this.CONFIG.TILE_SIZE);
        const biome = this.getBiomeAt(tileX, tileZ);
        const biomeData = this.BIOMES[biome];
        
        // Safety check for biomeData
        if (!biomeData) {
            console.error(`[TerrainSystem] Biome '${biome}' not found in BIOMES for walkability check. Assuming walkable.`);
            return { walkable: true };
        }
        
        // Get height at position
        const height = this.getHeightAt(worldX, worldZ);
        
        // Check if underwater (water impassable rule)
        if (height < biomeData.waterLevel) {
            return { walkable: false, reason: 'Water bodies are impassable' };
        }
        
        // Check slope constraints
        const slope = this.calculateSlope(worldX, worldZ);
        if (slope > biomeData.maxSlope) {
            return { walkable: false, reason: 'Steep mountain slopes block movement' };
        }
        
        // Special case for lakes biome - always impassable
        if (biome === 'lakes') {
            return { walkable: false, reason: 'Lake water is impassable' };
        }
        
        return { walkable: true };
    }
    
    /**
     * Calculate slope at a given world position
     */
    private calculateSlope(worldX: number, worldZ: number): number {
        const checkDistance = this.CONFIG.SLOPE_CHECK_DISTANCE;
        const centerHeight = this.getHeightAt(worldX, worldZ);
        
        // Sample heights in 4 directions
        const northHeight = this.getHeightAt(worldX, worldZ + checkDistance);
        const southHeight = this.getHeightAt(worldX, worldZ - checkDistance);
        const eastHeight = this.getHeightAt(worldX + checkDistance, worldZ);
        const westHeight = this.getHeightAt(worldX - checkDistance, worldZ);
        
        // Calculate maximum slope in any direction
        const slopes = [
            Math.abs(northHeight - centerHeight) / checkDistance,
            Math.abs(southHeight - centerHeight) / checkDistance,
            Math.abs(eastHeight - centerHeight) / checkDistance,
            Math.abs(westHeight - centerHeight) / checkDistance
        ];
        
        return Math.max(...slopes);
    }
    
    /**
     * Find a walkable path between two points (basic pathfinding)
     */
    findWalkablePath(startX: number, startZ: number, endX: number, endZ: number): 
        { path: Array<{x: number, z: number}>; blocked: boolean } {
        
        // Simple line-of-sight check first
        const steps = 20;
        const dx = (endX - startX) / steps;
        const dz = (endZ - startZ) / steps;
        
        const path: Array<{x: number, z: number}> = [];
        
        for (let i = 0; i <= steps; i++) {
            const x = startX + dx * i;
            const z = startZ + dz * i;
            
            const walkableCheck = this.isPositionWalkable(x, z);
            if (!walkableCheck.walkable) {
                // Path is blocked, would need A* pathfinding for complex routing
                return { path: [], blocked: true };
            }
            
            path.push({ x, z });
        }
        
        return { path, blocked: false };
    }
    
    /**
     * Get terrain info at world position (for movement system integration)
     */
    getTerrainInfoAt(worldX: number, worldZ: number): {
        height: number;
        biome: string;
        walkable: boolean;
        slope: number;
        underwater: boolean;
    } {
        const height = this.getHeightAt(worldX, worldZ);
        const tileX = Math.floor(worldX / this.CONFIG.TILE_SIZE);
        const tileZ = Math.floor(worldZ / this.CONFIG.TILE_SIZE);
        const biome = this.getBiomeAt(tileX, tileZ);
        const biomeData = this.BIOMES[biome];
        
        // Safety check for biomeData
        if (!biomeData) {
            console.error(`[TerrainSystem] Biome '${biome}' not found in BIOMES for terrain info. Using defaults.`);
            return {
                height,
                biome: biome || 'unknown',
                walkable: true,
                slope: 0,
                underwater: false
            };
        }
        
        const slope = this.calculateSlope(worldX, worldZ);
        const walkableCheck = this.isPositionWalkable(worldX, worldZ);
        
        return {
            height,
            biome,
            walkable: walkableCheck.walkable,
            slope,
            underwater: height < biomeData.waterLevel
        };
    }
    
    // ===== TERRAIN-BASED MOB SPAWNING (GDD Integration) =====
    
    /**
     * Generate visual features (road meshes, lake meshes) for a tile
     */
    private generateVisualFeatures(tile: TerrainTile): void {
        // Generate road meshes
        this.generateRoadMeshes(tile);
        
        // Generate lake meshes for water bodies
        this.generateLakeMeshes(tile);
        
        console.log(`[UnifiedTerrain] 🛤️  Generated visual features for tile ${tile.key}: ${tile.roads.length} roads`);
    }
    
    /**
     * Generate visual road meshes for better visibility
     */
    private generateRoadMeshes(tile: TerrainTile): void {
        for (const road of tile.roads) {
            if (road.mesh) continue; // Already has mesh
            
            // Create road geometry
            const roadLength = road.start.distanceTo(road.end);
            const roadGeometry = new THREE.PlaneGeometry(road.width, roadLength);
            
            // Create road material (darker color for visibility)
            const roadMaterial = new THREE.MeshLambertMaterial({
                color: 0x4a4a4a, // Dark gray
                transparent: true,
                opacity: 0.8,
                side: THREE.DoubleSide
            });
            
            // Create road mesh
            const roadMesh = new THREE.Mesh(roadGeometry, roadMaterial);
            
            // Position road mesh
            const centerX = (road.start.x + road.end.x) / 2;
            const centerZ = (road.start.y + road.end.y) / 2; // Note: Vector2.y is Z coordinate
            const worldX = (tile.x * this.CONFIG.TILE_SIZE) + centerX;
            const worldZ = (tile.z * this.CONFIG.TILE_SIZE) + centerZ;
            const height = this.getHeightAt(worldX, worldZ);
            
            roadMesh.position.set(centerX, height + 0.01, centerZ); // Slightly above terrain
            
            // Rotate road to match direction
            const roadDirection = new THREE.Vector2().subVectors(road.end, road.start).normalize();
            const roadAngle = Math.atan2(roadDirection.y, roadDirection.x);
            roadMesh.rotation.y = roadAngle;
            roadMesh.rotation.x = -Math.PI / 2; // Lay flat
            
            // Add userData for interaction detection
            roadMesh.userData = {
                type: 'terrain',
                walkable: true,
                clickable: true,
                subType: 'road',
                tileKey: tile.key
            };
            
            // Add to terrain container
            if (tile.mesh) {
                tile.mesh.add(roadMesh);
            }
            
            // Store mesh reference
            road.mesh = roadMesh;
        }
    }
    
    /**
     * Generate visual lake meshes for water bodies
     */
    private generateLakeMeshes(tile: TerrainTile): void {
        const biomeData = this.BIOMES[tile.biome];
        if (!biomeData) return;
        
        // Only generate lake meshes for water biomes or areas below water level
        if (tile.biome === 'lakes' || biomeData.waterLevel > 0) {
            // Sample the tile to find water areas
            const waterAreas = this.findWaterAreas(tile);
            
            for (const waterArea of waterAreas) {
                const waterGeometry = new THREE.PlaneGeometry(waterArea.width, waterArea.depth);
                
                // Create water material with transparency and animation
                const waterMaterial = new THREE.MeshLambertMaterial({
                    color: 0x1e6ba8, // Blue water color
                    transparent: true,
                    opacity: 0.7,
                    side: THREE.DoubleSide
                });
                
                const waterMesh = new THREE.Mesh(waterGeometry, waterMaterial);
                waterMesh.position.set(
                    waterArea.centerX,
                    biomeData.waterLevel + 0.01, // At water level
                    waterArea.centerZ
                );
                waterMesh.rotation.x = -Math.PI / 2; // Lay flat
                
                // Add userData for interaction detection (water is NOT walkable)
                waterMesh.userData = {
                    type: 'terrain',
                    walkable: false, // Water is impassable per GDD
                    clickable: true,
                    subType: 'water',
                    tileKey: tile.key,
                    biome: tile.biome
                };
                
                // Add to terrain container
                if (tile.mesh) {
                    tile.mesh.add(waterMesh);
                }
                
                // Store reference for potential updates
                if (!tile.waterMeshes) tile.waterMeshes = [];
                tile.waterMeshes.push(waterMesh);
            }
        }
    }
    
    /**
     * Find water areas within a tile that need visual representation
     */
    private findWaterAreas(tile: TerrainTile): Array<{centerX: number, centerZ: number, width: number, depth: number}> {
        const waterAreas: Array<{centerX: number, centerZ: number, width: number, depth: number}> = [];
        const biomeData = this.BIOMES[tile.biome];
        if (!biomeData) return waterAreas;
        
        // For lakes biome, create a large water area covering most of the tile
        if (tile.biome === 'lakes') {
            waterAreas.push({
                centerX: 0,
                centerZ: 0,
                width: this.CONFIG.TILE_SIZE * 0.8,
                depth: this.CONFIG.TILE_SIZE * 0.8
            });
        } else {
            // For other biomes, sample the heightmap to find areas below water level
            const sampleSize = 10; // Sample every 10 meters
            const samples: Array<{x: number, z: number, underwater: boolean}> = [];
            
            for (let x = -this.CONFIG.TILE_SIZE/2; x < this.CONFIG.TILE_SIZE/2; x += sampleSize) {
                for (let z = -this.CONFIG.TILE_SIZE/2; z < this.CONFIG.TILE_SIZE/2; z += sampleSize) {
                    const worldX = (tile.x * this.CONFIG.TILE_SIZE) + x;
                    const worldZ = (tile.z * this.CONFIG.TILE_SIZE) + z;
                    const height = this.getHeightAt(worldX, worldZ);
                    
                    samples.push({
                        x, z,
                        underwater: height < biomeData.waterLevel
                    });
                }
            }
            
            // Group contiguous underwater areas (simplified approach)
            const underwaterSamples = samples.filter(s => s.underwater);
            if (underwaterSamples.length > 0) {
                // Create one water area covering the underwater region
                const minX = Math.min(...underwaterSamples.map(s => s.x));
                const maxX = Math.max(...underwaterSamples.map(s => s.x));
                const minZ = Math.min(...underwaterSamples.map(s => s.z));
                const maxZ = Math.max(...underwaterSamples.map(s => s.z));
                
                waterAreas.push({
                    centerX: (minX + maxX) / 2,
                    centerZ: (minZ + maxZ) / 2,
                    width: maxX - minX + sampleSize,
                    depth: maxZ - minZ + sampleSize
                });
            }
        }
        
        return waterAreas;
    }
    
    /**
     * Get valid mob spawn positions in a tile based on biome and terrain constraints
     */
    getMobSpawnPositionsForTile(tileX: number, tileZ: number, maxSpawns: number = 10): Array<{
        position: { x: number; y: number; z: number };
        mobTypes: string[];
        biome: string;
        difficulty: number;
    }> {
        const biome = this.getBiomeAt(tileX, tileZ);
        const biomeData = this.BIOMES[biome];
        
        // Safety check for biomeData
        if (!biomeData) {
            console.error(`[TerrainSystem] Biome '${biome}' not found in BIOMES for mob spawning. No spawns generated.`);
            return [];
        }
        
        // Don't spawn mobs in safe zones
        if (biomeData.difficulty === 0 || biomeData.mobTypes.length === 0) {
            return [];
        }
        
        const spawnPositions: Array<{
            position: { x: number; y: number; z: number };
            mobTypes: string[];
            biome: string;
            difficulty: number;
        }> = [];
        
        // Try to find valid spawn positions
        let attempts = 0;
        const maxAttempts = maxSpawns * 3; // Allow some failures
        
        while (spawnPositions.length < maxSpawns && attempts < maxAttempts) {
            attempts++;
            
            // Random position within tile
            const worldX = (tileX * this.CONFIG.TILE_SIZE) + (Math.random() - 0.5) * this.CONFIG.TILE_SIZE * 0.8;
            const worldZ = (tileZ * this.CONFIG.TILE_SIZE) + (Math.random() - 0.5) * this.CONFIG.TILE_SIZE * 0.8;
            
            // Check if position is suitable for mob spawning
            const terrainInfo = this.getTerrainInfoAt(worldX, worldZ);
            
            if (!terrainInfo.walkable || terrainInfo.underwater) {
                continue; // Skip unwalkable positions
            }
            
            // Check distance from roads (don't spawn too close to roads)
            if (this.isPositionNearRoad(worldX, worldZ, 8)) {
                continue; // Skip positions near roads
            }
            
            // Check distance from starter towns
            if (this.isPositionNearStarterTown(worldX, worldZ, this.CONFIG.TOWN_RADIUS)) {
                continue; // Skip positions near safe towns
            }
            
            spawnPositions.push({
                position: {
                    x: worldX,
                    y: terrainInfo.height,
                    z: worldZ
                },
                mobTypes: [...biomeData.mobTypes],
                biome: biome,
                difficulty: biomeData.difficulty
            });
        }
        
        console.log(`[TerrainSystem] Generated ${spawnPositions.length} mob spawn positions for tile ${tileX},${tileZ} (${biome})`);
        return spawnPositions;
    }
    
    /**
     * Check if position is near a road
     */
    private isPositionNearRoad(worldX: number, worldZ: number, minDistance: number): boolean {
        const tileX = Math.floor(worldX / this.CONFIG.TILE_SIZE);
        const tileZ = Math.floor(worldZ / this.CONFIG.TILE_SIZE);
        
        // Check current tile and adjacent tiles for roads
        for (let dx = -1; dx <= 1; dx++) {
            for (let dz = -1; dz <= 1; dz++) {
                const checkTileX = tileX + dx;
                const checkTileZ = tileZ + dz;
                const tileKey = `${checkTileX}_${checkTileZ}`;
                const tile = this.terrainTiles.get(tileKey);
                
                if (tile && tile.roads.length > 0) {
                    for (const road of tile.roads) {
                        const localX = worldX - (checkTileX * this.CONFIG.TILE_SIZE);
                        const localZ = worldZ - (checkTileZ * this.CONFIG.TILE_SIZE);
                        
                        const distanceToRoad = this.distanceToLineSegment(
                            new THREE.Vector2(localX, localZ),
                            road.start,
                            road.end
                        );
                        
                        if (distanceToRoad < minDistance) {
                            return true;
                        }
                    }
                }
            }
        }
        
        return false;
    }
    
    /**
     * Check if position is near a starter town
     */
    private isPositionNearStarterTown(worldX: number, worldZ: number, minDistance: number): boolean {
        const starterTowns = [
            { x: 0, z: 0 }, { x: 10 * this.CONFIG.TILE_SIZE, z: 0 }, 
            { x: -10 * this.CONFIG.TILE_SIZE, z: 0 },
            { x: 0, z: 10 * this.CONFIG.TILE_SIZE }, 
            { x: 0, z: -10 * this.CONFIG.TILE_SIZE }
        ];
        
        for (const town of starterTowns) {
            const distance = Math.sqrt((worldX - town.x) ** 2 + (worldZ - town.z) ** 2);
            if (distance < minDistance) {
                return true;
            }
        }
        
        return false;
    }
    
    /**
     * Get all mob types available in a specific biome
     */
    getBiomeMobTypes(biome: string): string[] {
        const biomeData = this.BIOMES[biome];
        return biomeData ? [...biomeData.mobTypes] : [];
    }
    
    /**
     * Get biome difficulty level for mob spawning
     */
    getBiomeDifficulty(biome: string): number {
        const biomeData = this.BIOMES[biome];
        return biomeData ? biomeData.difficulty : 0;
    }
    
    /**
     * Get all loaded tiles with their biome and mob spawn data
     */
    getLoadedTilesWithSpawnData(): Array<{
        tileX: number;
        tileZ: number;
        biome: string;
        difficulty: number;
        mobTypes: string[];
        spawnPositions: Array<{ x: number; y: number; z: number }>;
    }> {
        const tilesData: Array<{
            tileX: number;
            tileZ: number;
            biome: string;
            difficulty: number;
            mobTypes: string[];
            spawnPositions: Array<{ x: number; y: number; z: number }>;
        }> = [];
        
        for (const [key, tile] of this.terrainTiles.entries()) {
            const biomeData = this.BIOMES[tile.biome];
            
            // Safety check for biomeData
            if (!biomeData) {
                console.warn(`[TerrainSystem] Biome '${tile.biome}' not found in BIOMES for spawn data. Skipping tile ${key}.`);
                continue;
            }
            
            if (biomeData.difficulty > 0 && biomeData.mobTypes.length > 0) {
                const spawnPositions = this.getMobSpawnPositionsForTile(tile.x, tile.z, 5);
                
                tilesData.push({
                    tileX: tile.x,
                    tileZ: tile.z,
                    biome: tile.biome,
                    difficulty: biomeData.difficulty,
                    mobTypes: [...biomeData.mobTypes],
                    spawnPositions: spawnPositions.map(spawn => spawn.position)
                });
            }
        }
        
        return tilesData;
    }
    
    destroy(): void {
        console.log('[UnifiedTerrain] 🛑 Destroying MMORPG terrain system...');
        
        // Perform final serialization before shutdown
        console.log('[UnifiedTerrain] 💾 Performing final serialization before shutdown...');
        this.performImmediateSerialization();
        
        // Clear save interval
        if (this.chunkSaveInterval) {
            clearInterval(this.chunkSaveInterval);
        }
        
        // Save all modified chunks before shutdown
        this.saveModifiedChunks();
        
        // Unload all tiles
        for (const tile of this.terrainTiles.values()) {
            this.unloadTile(tile);
        }
        
        // Remove terrain container
        if (this.terrainContainer && this.terrainContainer.parent) {
            this.terrainContainer.parent.remove(this.terrainContainer);
        }
        
        // Clear tracking data
        this.playerChunks.clear();
        this.simulatedChunks.clear();
        this.chunkPlayerCounts.clear();
        this.terrainBoundingBoxes.clear();
        this.pendingSerializationData.clear();
        
        console.log('[UnifiedTerrain] ✅ MMORPG terrain system destroyed');
    }

    // Methods for chunk persistence (used by tests)
    markChunkActive(chunkX: number, chunkZ: number): void {
        const key = `${chunkX}_${chunkZ}`;
        console.log(`[TerrainSystem] 🟢 Marking chunk ${key} as active`);
        
        // Add to simulated chunks if not already there
        this.simulatedChunks.add(key);
        
        // Update chunk player count
        const currentCount = this.chunkPlayerCounts.get(key) || 0;
        this.chunkPlayerCounts.set(key, currentCount + 1);
        
        console.log(`[TerrainSystem] ✅ Chunk ${key} now has ${currentCount + 1} active references`);
    }

    markChunkInactive(chunkX: number, chunkZ: number): void {
        const key = `${chunkX}_${chunkZ}`;
        console.log(`[TerrainSystem] 🔴 Marking chunk ${key} as inactive`);
        
        // Decrease chunk player count
        const currentCount = this.chunkPlayerCounts.get(key) || 0;
        if (currentCount > 1) {
            this.chunkPlayerCounts.set(key, currentCount - 1);
            console.log(`[TerrainSystem] ⬇️ Chunk ${key} now has ${currentCount - 1} active references`);
        } else {
            // No more active references - remove from simulation
            this.chunkPlayerCounts.delete(key);
            this.simulatedChunks.delete(key);
            console.log(`[TerrainSystem] ❌ Chunk ${key} removed from simulation`);
        }
    }

    getActiveChunks(): Array<{x: number, z: number}> {
        // Return currently loaded terrain tiles as "active chunks"
        const activeChunks: Array<{x: number, z: number}> = [];
        for (const [key, tile] of this.terrainTiles.entries()) {
            // FIX: Use '_' separator, not ','
            const [x, z] = key.split('_').map(Number);
            activeChunks.push({ x, z });
        }
        return activeChunks;
    }

    async saveAllActiveChunks(): Promise<void> {
        console.log('[TerrainSystem] Saving all active chunks...');
        // In a real implementation, this would persist chunk data
        // For now, just save modified chunks
        await this.saveModifiedChunks();
    }

    // ===== TEST INTEGRATION METHODS (expected by test-unified-terrain.mjs) =====
    
    /**
     * Get comprehensive terrain statistics for testing
     */
    getTerrainStats(): any {
        const activeChunks = Array.from(this.terrainTiles.keys());
        return {
            tileSize: '100x100m',
            worldSize: '100x100',
            totalArea: '10km x 10km',
            maxLoadedTiles: 9,
            tilesLoaded: this.terrainTiles.size,
            currentlyLoaded: activeChunks,
            biomeCount: Object.keys(this.BIOMES).length,
            chunkSize: this.CONFIG.TILE_SIZE,
            worldBounds: {
                min: { x: 0, z: 0 },
                max: { x: this.CONFIG.WORLD_SIZE, z: this.CONFIG.WORLD_SIZE }
            },
            activeBiomes: Array.from(new Set(Array.from(this.terrainTiles.values()).map(t => t.biome))),
            totalRoads: Array.from(this.terrainTiles.values()).reduce((sum, t) => sum + t.roads.length, 0)
        };
    }

    /**
     * Get biome name at world position (wrapper for test compatibility)
     */
    getBiomeAtPosition(x: number, z: number): string {
        const tileX = Math.floor(x / this.CONFIG.TILE_SIZE);
        const tileZ = Math.floor(z / this.CONFIG.TILE_SIZE);
        const biome = this.getBiomeAt(tileX, tileZ);
        const biomeData = this.BIOMES[biome];
        return biomeData ? biomeData.name : 'unknown';
    }

    /**
     * Get height at world position (wrapper for test compatibility)
     */
    getHeightAtPosition(x: number, z: number): number {
        return this.getHeightAt(x, z);
    }
    
    // ===== MMORPG CHUNK LOADING AND SIMULATION SYSTEM =====
    
    /**
     * Initialize chunk loading system with 9 core + ring strategy
     */
    private initializeChunkLoadingSystem(): void {
        console.log('[TerrainSystem] 🔄 Initializing chunk loading system...');
        
        // Setup chunk loading strategy
        this.chunkLoadingStrategy = 'core_plus_ring';
        this.coreChunkRange = 1; // 3x3 grid = 9 core chunks
        this.ringChunkRange = 2; // Additional ring for preloading
        
        // Initialize tracking maps
        this.playerChunks.clear();
        this.simulatedChunks.clear();
        this.chunkPlayerCounts.clear();
        
        console.log('[TerrainSystem] ✅ Chunk loading system initialized');
        console.log(`  - Strategy: ${this.chunkLoadingStrategy}`);
        console.log(`  - Core chunks: ${Math.pow(this.coreChunkRange * 2 + 1, 2)}`);
        console.log(`  - Ring chunks: ${Math.pow(this.ringChunkRange * 2 + 1, 2) - Math.pow(this.coreChunkRange * 2 + 1, 2)}`);
    }
    
    /**
     * Initialize 15-minute serialization system
     */
    private initializeSerializationSystem(): void {
        console.log('[TerrainSystem] 💾 Initializing serialization system...');
        
        this.lastSerializationTime = Date.now();
        this.serializationInterval = 15 * 60 * 1000; // 15 minutes
        this.worldStateVersion = 1;
        this.pendingSerializationData.clear();
        
        console.log('[TerrainSystem] ✅ Serialization system initialized');
        console.log(`  - Interval: ${this.serializationInterval / 1000} seconds`);
        console.log(`  - World state version: ${this.worldStateVersion}`);
    }
    
    /**
     * Initialize bounding box verification system
     */
    private initializeBoundingBoxSystem(): void {
        console.log('[TerrainSystem] 📦 Initializing bounding box verification...');
        
        // Set world bounds based on 100x100 tile grid
        this.worldBounds = {
            minX: -50 * this.CONFIG.TILE_SIZE,
            maxX: 50 * this.CONFIG.TILE_SIZE,
            minZ: -50 * this.CONFIG.TILE_SIZE,
            maxZ: 50 * this.CONFIG.TILE_SIZE,
            minY: -50,
            maxY: 100
        };
        
        this.terrainBoundingBoxes.clear();
        
        console.log('[TerrainSystem] ✅ Bounding box system initialized');
        console.log(`  - World bounds: ${JSON.stringify(this.worldBounds)}`);
    }
    
    /**
     * Player-based terrain update with 9 core + ring strategy
     */
    private updatePlayerBasedTerrain(): void {
        if (this.isGenerating) return;
        
        // Get all players
        const players = this.world.getPlayers?.() || [];
        
        // Clear previous player chunk tracking
        this.playerChunks.clear();
        this.chunkPlayerCounts.clear();
        
        // Track which tiles are needed based on 9 core + ring strategy
        const neededTiles = new Set<string>();
        const simulationTiles = new Set<string>();
        
        for (const player of players) {
            const playerPos = player.position;
            if (!playerPos) continue;
            
            const playerId = (player as any).playerId || (player as any).id || 'unknown';
            
            // Calculate tile position
            const tileX = Math.floor(playerPos.x / this.CONFIG.TILE_SIZE);
            const tileZ = Math.floor(playerPos.z / this.CONFIG.TILE_SIZE);
            
            // 9 core chunks (3x3 grid) - these get full simulation
            const coreChunks = new Set<string>();
            for (let dx = -this.coreChunkRange; dx <= this.coreChunkRange; dx++) {
                for (let dz = -this.coreChunkRange; dz <= this.coreChunkRange; dz++) {
                    const tx = tileX + dx;
                    const tz = tileZ + dz;
                    const key = `${tx}_${tz}`;
                    coreChunks.add(key);
                    neededTiles.add(key);
                    simulationTiles.add(key);
                }
            }
            
            // Ring chunks around core - these are loaded but not simulated
            for (let dx = -this.ringChunkRange; dx <= this.ringChunkRange; dx++) {
                for (let dz = -this.ringChunkRange; dz <= this.ringChunkRange; dz++) {
                    // Skip core chunks
                    if (Math.abs(dx) <= this.coreChunkRange && Math.abs(dz) <= this.coreChunkRange) {
                        continue;
                    }
                    
                    const tx = tileX + dx;
                    const tz = tileZ + dz;
                    const key = `${tx}_${tz}`;
                    neededTiles.add(key);
                }
            }
            
            // Track player chunks for shared world simulation
            this.playerChunks.set(playerId, coreChunks);
            
            // Count players per chunk for shared simulation
            for (const chunkKey of coreChunks) {
                const currentCount = this.chunkPlayerCounts.get(chunkKey) || 0;
                this.chunkPlayerCounts.set(chunkKey, currentCount + 1);
            }
        }
        
        // Update simulated chunks - only chunks with players get simulation
        this.simulatedChunks.clear();
        for (const chunkKey of simulationTiles) {
            if (this.chunkPlayerCounts.get(chunkKey)! > 0) {
                this.simulatedChunks.add(chunkKey);
            }
        }
        
        // Generate missing tiles
        for (const tileKey of neededTiles) {
            if (!this.terrainTiles.has(tileKey)) {
                const [x, z] = tileKey.split('_').map(Number);
                this.generateTile(x, z);
            }
        }
        
        // Remove tiles that are no longer needed
        for (const [tileKey, tile] of this.terrainTiles) {
            if (!neededTiles.has(tileKey)) {
                this.unloadTile(tile);
            }
        }
        
        // Log simulation status every 10 updates
        if (Math.random() < 0.1) {
            const totalPlayers = players.length;
            const simulatedChunkCount = this.simulatedChunks.size;
            const loadedChunkCount = this.terrainTiles.size;
            
            console.log(`[TerrainSystem] 🌍 Player-based update: ${totalPlayers} players, ${simulatedChunkCount} simulated chunks, ${loadedChunkCount} total chunks`);
            
            // Log shared world status
            const sharedChunks = Array.from(this.chunkPlayerCounts.entries())
                .filter(([_, count]) => count > 1)
                .map(([key, count]) => `${key}(${count})`)
                .join(', ');
            
            if (sharedChunks) {
                console.log(`[TerrainSystem] 🤝 Shared chunks: ${sharedChunks}`);
            }
        }
    }
    
    /**
     * Perform periodic serialization every 15 minutes
     */
    private performPeriodicSerialization(): void {
        const now = Date.now();
        
        if (now - this.lastSerializationTime >= this.serializationInterval) {
            console.log('[TerrainSystem] 💾 Performing periodic 15-minute serialization...');
            this.performImmediateSerialization();
            this.lastSerializationTime = now;
        }
    }
    
    /**
     * Perform immediate serialization of all world state
     */
    private performImmediateSerialization(): void {
        const startTime = Date.now();
        let serializedChunks = 0;
        
        try {
            // Serialize all active chunks
            for (const [key, tile] of this.terrainTiles) {
                const serializationData = {
                    key: key,
                    tileX: tile.x,
                    tileZ: tile.z,
                    biome: tile.biome,
                    heightData: tile.heightData,
                    resourceStates: tile.resources.map(r => ({
                        id: r.id,
                        type: r.type,
                        position: r.position.toArray()
                    })),
                    roadData: tile.roads.map(r => ({
                        start: r.start.toArray(),
                        end: r.end.toArray(),
                        width: r.width
                    })),
                    playerCount: this.chunkPlayerCounts.get(key) || 0,
                    lastActiveTime: tile.lastActiveTime,
                    isSimulated: this.simulatedChunks.has(key),
                    worldStateVersion: this.worldStateVersion,
                    timestamp: Date.now()
                };
                
                // Store for database persistence
                this.pendingSerializationData.set(key, serializationData);
                
                // If database system is available, save immediately
                if (this.databaseSystem && this.databaseSystem.saveChunk) {
                    try {
                        const chunkData: RPGWorldChunk = {
                            chunkX: tile.x,
                            chunkZ: tile.z,
                            biome: tile.biome,
                            heightData: tile.heightData || [],
                            resourceStates: {},
                            mobSpawnStates: {},
                            playerModifications: {},
                            chunkSeed: tile.chunkSeed || 0,
                            lastActiveTime: tile.lastActiveTime || new Date(),
                            playerCount: serializationData.playerCount,
                            needsReset: false,
                            createdAt: new Date(),
                            updatedAt: new Date()
                        };
                        
                        this.databaseSystem.saveChunk(chunkData);
                        serializedChunks++;
                    } catch (error) {
                        console.error(`[TerrainSystem] ❌ Failed to serialize chunk ${key}:`, error);
                    }
                }
            }
            
            // Increment world state version
            this.worldStateVersion++;
            
            const elapsed = Date.now() - startTime;
            console.log(`[TerrainSystem] ✅ Serialization completed: ${serializedChunks} chunks in ${elapsed}ms`);
            console.log(`[TerrainSystem] 📈 World state version: ${this.worldStateVersion}`);
            
        } catch (error) {
            console.error('[TerrainSystem] ❌ Serialization failed:', error);
        }
    }
    
    /**
     * Verify terrain bounding boxes for size validation
     */
    private verifyTerrainBoundingBoxes(): void {
        let validBoxes = 0;
        let invalidBoxes = 0;
        const oversizedTiles: string[] = [];
        
        for (const [key, tile] of this.terrainTiles) {
            // Calculate bounding box for this tile
            const box = new THREE.Box3();
            
            if (tile.mesh && tile.mesh.geometry) {
                box.setFromObject(tile.mesh);
                
                // Verify tile is within expected size bounds
                const size = box.getSize(new THREE.Vector3());
                const expectedSize = this.CONFIG.TILE_SIZE;
                
                if (size.x > expectedSize * 1.1 || size.z > expectedSize * 1.1) {
                    invalidBoxes++;
                    oversizedTiles.push(key);
                    console.warn(`[TerrainSystem] ⚠️ Oversized tile ${key}: ${size.x.toFixed(1)}x${size.z.toFixed(1)}m (expected: ${expectedSize}x${expectedSize}m)`);
                } else {
                    validBoxes++;
                }
                
                // Store bounding box for future reference
                this.terrainBoundingBoxes.set(key, box.clone());
                
                // Verify tile is within world bounds
                if (box.min.x < this.worldBounds.minX || box.max.x > this.worldBounds.maxX ||
                    box.min.z < this.worldBounds.minZ || box.max.z > this.worldBounds.maxZ) {
                    console.warn(`[TerrainSystem] ⚠️ Tile ${key} exceeds world bounds`);
                }
            }
        }
        
        // Log verification results periodically
        if (Math.random() < 0.1) {
            console.log(`[TerrainSystem] 📦 Bounding box verification: ${validBoxes} valid, ${invalidBoxes} invalid`);
            
            if (oversizedTiles.length > 0) {
                console.warn(`[TerrainSystem] ⚠️ Oversized tiles: ${oversizedTiles.join(', ')}`);
            }
        }
    }
    
    /**
     * Get chunk simulation status for debugging
     */
    getChunkSimulationStatus(): {
        totalChunks: number;
        simulatedChunks: number;
        playerChunks: Map<string, Set<string>>;
        chunkPlayerCounts: Map<string, number>;
        lastSerializationTime: number;
        nextSerializationIn: number;
        worldStateVersion: number;
    } {
        return {
            totalChunks: this.terrainTiles.size,
            simulatedChunks: this.simulatedChunks.size,
            playerChunks: new Map(this.playerChunks),
            chunkPlayerCounts: new Map(this.chunkPlayerCounts),
            lastSerializationTime: this.lastSerializationTime,
            nextSerializationIn: this.serializationInterval - (Date.now() - this.lastSerializationTime),
            worldStateVersion: this.worldStateVersion
        };
    }
    
    /**
     * Check if a chunk is being simulated
     */
    isChunkSimulated(chunkX: number, chunkZ: number): boolean {
        const key = `${chunkX}_${chunkZ}`;
        return this.simulatedChunks.has(key);
    }
    
    /**
     * Get players in a specific chunk
     */
    getPlayersInChunk(chunkX: number, chunkZ: number): string[] {
        const key = `${chunkX}_${chunkZ}`;
        const playersInChunk: string[] = [];
        
        for (const [playerId, chunks] of this.playerChunks) {
            if (chunks.has(key)) {
                playersInChunk.push(playerId);
            }
        }
        
        return playersInChunk;
    }
    
    /**
     * Force immediate serialization (for testing/admin commands)
     */
    forceSerialization(): void {
        console.log('[TerrainSystem] 🔧 Forced serialization requested...');
        this.performImmediateSerialization();
    }
}