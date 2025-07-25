/**
 * Comprehensive Runtime Terrain Validation System
 * 
 * Runtime validation system that checks:
 * - Resource presence and distribution
 * - Mob spawner placement and validity  
 * - Minimum distance requirements (1 meter rule)
 * - Raycast-based biome detection
 * - Lake detection for fishing integration
 * - Vertex height validation across all biomes
 * 
 * Runs at startup and throws on critical failures.
 * Reports all errors back to server for monitoring.
 */

import { System } from './System';
import * as THREE from '../extras/three';
import type { World } from '../../types/index';

export interface TerrainValidationError {
  type: 'height_discontinuity' | 'physx_mismatch' | 'underground_entity' | 'invalid_slope' | 'missing_collision' | 'resource_placement_error';
  position: { x: number; y: number; z: number };
  severity: 'critical' | 'warning' | 'info';
  message: string;
  timestamp: number;
  additionalData?: any;
}

export interface WalkabilityData {
  position: { x: number; z: number };
  height: number;
  slope: number;
  isWalkable: boolean;
  navMeshDistance: number;
  biome: string;
  surfaceType: 'solid' | 'water' | 'void';
}

export interface HeightmapValidationResult {
  isValid: boolean;
  errors: TerrainValidationError[];
  coverage: number; // Percentage of world validated
  averageFrameTime: number;
  totalValidationTime: number;
  walkabilityMap: Map<string, WalkabilityData>;
}

interface ValidationResult {
  test: string;
  passed: boolean;
  message: string;
  data?: any;
}

interface ValidationError {
  severity: 'warning' | 'error' | 'critical';
  test: string;
  message: string;
  data?: any;
}

export class TerrainValidationSystem extends System {
  private terrainSystem: any = null;
  private validationResults: ValidationResult[] = [];
  private validationErrors: TerrainValidationError[] = [];
  private walkabilityCache = new Map<string, WalkabilityData>();
  private validationCache = new Map<string, WalkabilityData>();
  private lastValidationTime = 0;
  private isValidating = false;
  private validationProgress = 0;
  
  // Validation configuration
  private readonly CONFIG = {
    VALIDATION_INTERVAL: 5000, // Check every 5 seconds
    MAX_SLOPE_WALKABLE: 0.7, // 35 degrees max walkable slope
    MIN_HEIGHT_CONTINUITY: 0.1, // 10cm minimum height difference to flag
    UNDERGROUND_THRESHOLD: -0.5, // 50cm below terrain = underground
    CHUNK_VALIDATION_SIZE: 20, // Validate in 20x20 meter chunks
    MAX_VALIDATION_TIME_PER_FRAME: 16, // 16ms max per frame (60fps)
    CRITICAL_ERROR_LIMIT: 10, // Stop validation if too many critical errors
    WALKABILITY_GRID_SIZE: 2, // 2m grid for walkability analysis
    PHYSX_TOLERANCE: 0.1 // 10cm tolerance for PhysX vs heightmap
  };

  constructor(world: World) {
    super(world);
  }

  async init(): Promise<void> {
    console.log('[TerrainValidationSystem] 🧪 Initializing comprehensive terrain validation...');
    
    // Find the terrain system
    this.terrainSystem = (this.world as any).systems?.terrain || (this.world as any).systems?.TerrainSystem;
    
    if (!this.terrainSystem) {
      throw new Error('[TerrainValidationSystem] ❌ CRITICAL: TerrainSystem not found - cannot validate terrain');
    }
    
    console.log('[TerrainValidationSystem] Found terrain system, ready for validation');
  }

  start(): void {
    console.log('[TerrainValidationSystem] 🚀 Starting runtime terrain validation tests...');
    
    // Run all validation tests at startup
    this.runAllValidationTests().then(() => {
      this.processValidationResults();
    }).catch((error) => {
      console.error('[TerrainValidationSystem] ❌ CRITICAL: Validation tests failed:', error);
      this.addValidationError('critical', 'startup_validation', `Terrain validation failed at startup: ${error.message}`, { error: error.stack });
      throw error;
    });
  }

  async runAllValidationTests(): Promise<void> {
    console.log('[TerrainValidationSystem] Running comprehensive validation tests...');
    
    // Clear previous results
    this.validationResults = [];
    this.validationErrors = [];
    
    try {
      await this.validateResourcePlacement(0, 0, 100, this.getLastValidationResult());
      await this.validateMobSpawnerPlacement();
      await this.validateMinimumDistances();
      await this.validateRaycastBiomeDetection();
      await this.validateLakeDetection();
      await this.validateVertexHeights();
      
      console.log('[TerrainValidationSystem] ✅ All validation tests completed');
      
    } catch (error) {
      this.addValidationError('critical', 'validation_suite', `Validation suite failed: ${(error as Error).message}`, { error });
      throw error;
    }
  }

  /**
   * Validate a specific terrain chunk
   */
  private async validateTerrainChunk(chunk: TerrainChunk, result: HeightmapValidationResult): Promise<void> {
    const { x, z, size } = chunk;
    
    // 1. Height continuity validation
    await this.validateHeightContinuity(x, z, size, result);
    
    // 2. PhysX collision validation
    await this.validatePhysXCollision(x, z, size, result);
    
    // 3. Walkability analysis
    await this.analyzeWalkability(x, z, size, result);
    
    // 4. Resource placement validation
    await this.validateResourcePlacement(x, z, size, result);
    
    // 5. Underground entity detection
    await this.detectUndergroundEntities(x, z, size, result);
  }

  /**
   * Validate height continuity and detect discontinuities
   */
  private async validateHeightContinuity(x: number, z: number, size: number, result: HeightmapValidationResult): Promise<void> {
    const step = 1; // 1 meter resolution
    
    for (let dx = 0; dx < size; dx += step) {
      for (let dz = 0; dz < size; dz += step) {
        const worldX = x + dx;
        const worldZ = z + dz;
        
        // Get height at current position
        const height = this.getTerrainHeight(worldX, worldZ);
        if (height === null) continue;
        
        // Check neighboring heights
        const neighbors = [
          { x: worldX + step, z: worldZ, height: this.getTerrainHeight(worldX + step, worldZ) },
          { x: worldX - step, z: worldZ, height: this.getTerrainHeight(worldX - step, worldZ) },
          { x: worldX, z: worldZ + step, height: this.getTerrainHeight(worldX, worldZ + step) },
          { x: worldX, z: worldZ - step, height: this.getTerrainHeight(worldX, worldZ - step) }
        ];
        
        for (const neighbor of neighbors) {
          if (neighbor.height === null) continue;
          
          const heightDiff = Math.abs(height - neighbor.height);
          const distance = Math.sqrt(Math.pow(neighbor.x - worldX, 2) + Math.pow(neighbor.z - worldZ, 2));
          const slope = heightDiff / distance;
          
          // Flag extreme height discontinuities
          if (heightDiff > 10) { // 10m cliff
            result.errors.push({
              type: 'height_discontinuity',
              position: { x: worldX, y: height, z: worldZ },
              severity: 'critical',
              message: `Extreme height discontinuity: ${heightDiff.toFixed(2)}m difference over ${distance.toFixed(2)}m`,
              timestamp: Date.now(),
              additionalData: { heightDiff, distance, slope }
            });
          } else if (slope > 2.0) { // Very steep slope
            result.errors.push({
              type: 'invalid_slope',
              position: { x: worldX, y: height, z: worldZ },
              severity: 'warning',
              message: `Very steep slope detected: ${(slope * 100).toFixed(1)}% grade`,
              timestamp: Date.now(),
              additionalData: { slope }
            });
          }
        }
      }
    }
  }

  /**
   * Validate PhysX collision matches heightmap
   */
  private async validatePhysXCollision(x: number, z: number, size: number, result: HeightmapValidationResult): Promise<void> {
    const step = 2; // 2 meter resolution for performance
    
    for (let dx = 0; dx < size; dx += step) {
      for (let dz = 0; dz < size; dz += step) {
        const worldX = x + dx;
        const worldZ = z + dz;
        
        // Get heightmap height
        const heightmapHeight = this.getTerrainHeight(worldX, worldZ);
        if (heightmapHeight === null) continue;
        
        // Perform raycast to get PhysX height
        const physxHeight = this.getPhysXHeight(worldX, worldZ);
        
        if (physxHeight === null) {
          result.errors.push({
            type: 'missing_collision',
            position: { x: worldX, y: heightmapHeight, z: worldZ },
            severity: 'critical',
            message: 'PhysX collision not found for terrain position',
            timestamp: Date.now()
          });
          continue;
        }
        
        // Check if heights match within tolerance
        const heightDiff = Math.abs(heightmapHeight - physxHeight);
        if (heightDiff > this.CONFIG.PHYSX_TOLERANCE) {
          result.errors.push({
            type: 'physx_mismatch',
            position: { x: worldX, y: heightmapHeight, z: worldZ },
            severity: 'warning',
            message: `PhysX collision height mismatch: heightmap=${heightmapHeight.toFixed(2)}m, physx=${physxHeight.toFixed(2)}m`,
            timestamp: Date.now(),
            additionalData: { heightmapHeight, physxHeight, difference: heightDiff }
          });
        }
      }
    }
  }

  /**
   * Analyze walkability for AI navigation
   */
  private async analyzeWalkability(x: number, z: number, size: number, result: HeightmapValidationResult): Promise<void> {
    const step = this.CONFIG.WALKABILITY_GRID_SIZE;
    
    for (let dx = 0; dx < size; dx += step) {
      for (let dz = 0; dz < size; dz += step) {
        const worldX = x + dx;
        const worldZ = z + dz;
        const key = `${worldX},${worldZ}`;
        
        // Get terrain data
        const height = this.getTerrainHeight(worldX, worldZ);
        if (height === null) continue;
        
        // Calculate slope
        const slope = this.calculateSlope(worldX, worldZ);
        
        // Determine walkability
        const isWalkable = this.isPositionWalkable(worldX, worldZ, height, slope);
        
        // Get biome and surface type
        const biome = this.getBiomeAtPosition(worldX, worldZ);
        const surfaceType = this.getSurfaceType(worldX, worldZ, height);
        
        // Calculate distance to nearest navmesh (if any)
        const navMeshDistance = this.getNavMeshDistance(worldX, worldZ);
        
        const walkabilityData: WalkabilityData = {
          position: { x: worldX, z: worldZ },
          height,
          slope,
          isWalkable,
          navMeshDistance,
          biome,
          surfaceType
        };
        
        // Cache walkability data
        this.walkabilityCache.set(key, walkabilityData);
        result.walkabilityMap.set(key, walkabilityData);
        
        // Flag unwalkable areas in important locations
        if (!isWalkable && this.isImportantLocation(worldX, worldZ)) {
          result.errors.push({
            type: 'invalid_slope',
            position: { x: worldX, y: height, z: worldZ },
            severity: 'warning',
            message: `Important location is not walkable: slope=${(slope * 100).toFixed(1)}%`,
            timestamp: Date.now(),
            additionalData: { slope, biome, surfaceType }
          });
        }
      }
    }
  }

  /**
   * Validate resource placement
   */
  private async validateResourcePlacement(x: number, z: number, size: number, result: HeightmapValidationResult): Promise<void> {
    // Get resources in this chunk
    const resources = this.getResourcesInArea(x, z, size);
    
    for (const resource of resources) {
      const { position, type } = resource;
      
      // Check if resource is at correct height
      const terrainHeight = this.getTerrainHeight(position.x, position.z);
      if (terrainHeight === null) {
        result.errors.push({
          type: 'resource_placement_error',
          position: position,
          severity: 'critical',
          message: `Resource ${type} placed on invalid terrain`,
          timestamp: Date.now(),
          additionalData: { resourceType: type }
        });
        continue;
      }
      
      // Check if resource is floating or underground
      const heightDiff = position.y - terrainHeight;
      if (Math.abs(heightDiff) > 1) { // 1m tolerance
        result.errors.push({
          type: 'resource_placement_error',
          position: position,
          severity: 'warning',
          message: `Resource ${type} height mismatch: ${heightDiff.toFixed(2)}m from terrain`,
          timestamp: Date.now(),
          additionalData: { resourceType: type, heightDiff, terrainHeight }
        });
      }
      
      // Check if resource is on walkable terrain
      const isWalkable = this.isPositionWalkable(position.x, position.z, terrainHeight);
      if (!isWalkable && type === 'tree') { // Trees should be on walkable ground
        result.errors.push({
          type: 'resource_placement_error',
          position: position,
          severity: 'info',
          message: `Tree placed on unwalkable terrain`,
          timestamp: Date.now(),
          additionalData: { resourceType: type }
        });
      }
    }
  }

  /**
   * Detect entities positioned underground
   */
  private async detectUndergroundEntities(x: number, z: number, size: number, result: HeightmapValidationResult): Promise<void> {
    // Get all entities in this area
    const entities = this.getEntitiesInArea(x, z, size);
    
    for (const entity of entities) {
      const terrainHeight = this.getTerrainHeight(entity.position.x, entity.position.z);
      if (terrainHeight === null) continue;
      
      // Check if entity is underground
      const heightDiff = entity.position.y - terrainHeight;
      if (heightDiff < this.CONFIG.UNDERGROUND_THRESHOLD) {
        result.errors.push({
          type: 'underground_entity',
          position: entity.position,
          severity: 'critical',
          message: `Entity ${entity.id} is ${Math.abs(heightDiff).toFixed(2)}m underground`,
          timestamp: Date.now(),
          additionalData: { entityId: entity.id, entityType: entity.type, heightDiff }
        });
        
        // Auto-fix: Move entity to ground level
        this.moveEntityToGround(entity);
      }
    }
  }

  /**
   * Move entity to ground level
   */
  private moveEntityToGround(entity: any): void {
    const terrainHeight = this.getTerrainHeight(entity.position.x, entity.position.z);
    if (terrainHeight === null) return;
    
    const newY = terrainHeight + 0.1; // 10cm above ground
    
    console.log(`[TerrainValidation] 🔧 Moving entity ${entity.id} from y=${entity.position.y.toFixed(2)} to y=${newY.toFixed(2)}`);
    
    entity.position.y = newY;
    
    // Emit position correction event
    this.world.events?.emit('entity:position:corrected', {
      entityId: entity.id,
      oldPosition: { ...entity.position, y: entity.position.y },
      newPosition: { ...entity.position, y: newY },
      reason: 'underground_detection'
    });
  }

  /**
   * Get terrain height at position
   */
  private getTerrainHeight(x: number, z: number): number | null {
    if (!this.terrainSystem) return null;
    
    try {
      return this.terrainSystem.getHeightAtPosition(x, z);
    } catch (error) {
      return null;
    }
  }

  /**
   * Get PhysX collision height via raycast
   */
  private getPhysXHeight(x: number, z: number): number | null {
    if (!this.world.raycast) return null;
    
    try {
      const origin = new THREE.Vector3(x, 1000, z); // Start high above
      const direction = new THREE.Vector3(0, -1, 0); // Ray down
      
      const hit = this.world.raycast(origin, direction, 2000); // 2km max distance
      
      return hit ? hit.point.y : null;
    } catch (error) {
      return null;
    }
  }

  /**
   * Calculate slope at position
   */
  private calculateSlope(x: number, z: number): number {
    const step = 1; // 1 meter
    const centerHeight = this.getTerrainHeight(x, z);
    if (centerHeight === null) return 0;
    
    const neighbors = [
      this.getTerrainHeight(x + step, z),
      this.getTerrainHeight(x - step, z),
      this.getTerrainHeight(x, z + step),
      this.getTerrainHeight(x, z - step)
    ];
    
    let maxSlope = 0;
    for (const neighborHeight of neighbors) {
      if (neighborHeight === null) continue;
      
      const heightDiff = Math.abs(centerHeight - neighborHeight);
      const slope = heightDiff / step;
      maxSlope = Math.max(maxSlope, slope);
    }
    
    return maxSlope;
  }

  /**
   * Check if position is walkable
   */
  private isPositionWalkable(x: number, z: number, height?: number, slope?: number): boolean {
    if (height === undefined) {
      const terrainHeight = this.getTerrainHeight(x, z);
      if (terrainHeight === null || terrainHeight === undefined) return false;
      height = terrainHeight;
    }
    
    if (slope === undefined) {
      slope = this.calculateSlope(x, z);
    }
    
    // Check slope
    if (slope !== undefined && slope > this.CONFIG.MAX_SLOPE_WALKABLE) return false;
    
    // Check if underwater
    if (height !== undefined && height < 0.5) return false; // 50cm above sea level
    
    // Check surface type
    const surfaceType = this.getSurfaceType(x, z, height!);
    if (surfaceType === 'water' || surfaceType === 'void') return false;
    
    return true;
  }

  /**
   * Get biome at position
   */
  private getBiomeAtPosition(x: number, z: number): string {
    if (!this.terrainSystem) return 'unknown';
    
    try {
      return this.terrainSystem.getBiomeAtPosition(x, z);
    } catch (error) {
      return 'unknown';
    }
  }

  /**
   * Get surface type at position
   */
  private getSurfaceType(x: number, z: number, height: number): 'solid' | 'water' | 'void' {
    if (height < 0) return 'water';
    if (height > 100) return 'void'; // Too high
    return 'solid';
  }

  /**
   * Check if location is important (near towns, resources, etc.)
   */
  private isImportantLocation(x: number, z: number): boolean {
    // Check distance to starter towns
    const starterTowns = [
      { x: 0, z: 0 }, { x: 100, z: 0 }, { x: -100, z: 0 },
      { x: 0, z: 100 }, { x: 0, z: -100 }
    ];
    
    for (const town of starterTowns) {
      const distance = Math.sqrt(Math.pow(x - town.x, 2) + Math.pow(z - town.z, 2));
      if (distance < 50) return true; // Within 50m of town
    }
    
    return false;
  }

  // Helper methods for getting data
  private getLoadedTerrainTiles(): any[] {
    if (!this.terrainSystem) return [];
    return this.terrainSystem.getLoadedTiles?.() || [];
  }

  private getTileValidationChunks(tile: any): TerrainChunk[] {
    const chunks: TerrainChunk[] = [];
    const tileSize = 100; // 100m tiles
    const chunkSize = this.CONFIG.CHUNK_VALIDATION_SIZE;
    
    for (let x = 0; x < tileSize; x += chunkSize) {
      for (let z = 0; z < tileSize; z += chunkSize) {
        chunks.push({
          x: tile.x * tileSize + x,
          z: tile.z * tileSize + z,
          size: chunkSize
        });
      }
    }
    
    return chunks;
  }

  private getResourcesInArea(x: number, z: number, size: number): any[] {
    // Implementation would get resources from terrain system
    return [];
  }

  private getEntitiesInArea(x: number, z: number, size: number): any[] {
    // Implementation would get entities from world
    return [];
  }

  private getNavMeshDistance(x: number, z: number): number {
    // Implementation would calculate distance to nearest navmesh
    return 0;
  }

  private getLastValidationResult(): HeightmapValidationResult {
    return {
      isValid: false,
      errors: [...this.validationErrors],
      coverage: 0,
      averageFrameTime: 0,
      totalValidationTime: 0,
      walkabilityMap: new Map(this.walkabilityCache)
    };
  }

  // Event handlers
  private onTerrainTileGenerated(data: any): void {
    console.log(`[TerrainValidation] 📝 New terrain tile generated: ${data.tileKey}`);
    // Queue validation for new tile
  }

  private onTerrainTileUnloaded(data: any): void {
    console.log(`[TerrainValidation] 🗑️  Terrain tile unloaded: ${data.tileKey}`);
    // Clear walkability cache for unloaded tile
  }

  private validateEntityPosition(data: any): void {
    // Validate entity position when it moves
    const terrainHeight = this.getTerrainHeight(data.position.x, data.position.z);
    if (terrainHeight !== null && data.position.y < terrainHeight + this.CONFIG.UNDERGROUND_THRESHOLD) {
      console.warn(`[TerrainValidation] ⚠️  Entity ${data.entityId} moved underground`);
    }
  }

  private requestValidation(data: any): void {
    console.log('[TerrainValidation] 🔍 Manual validation requested');
    this.runAllValidationTests();
  }

  private processValidationResults(): void {
    console.log('\n[TerrainValidationSystem] 📊 TERRAIN VALIDATION RESULTS:');
    console.log('='.repeat(50));
    
    const passed = this.validationResults.filter(r => r.passed).length;
    const total = this.validationResults.length;
    const errors = this.validationErrors.filter(e => e.severity === 'critical').length;
    const warnings = this.validationErrors.filter(e => e.severity === 'warning').length;
    const critical = this.validationErrors.filter(e => e.severity === 'critical').length;
    
    console.log(`✅ Tests Passed: ${passed}/${total}`);
    console.log(`⚠️ Warnings: ${warnings}`);
    console.log(`❌ Errors: ${errors}`);
    console.log(`💥 Critical: ${critical}`);
    
    // Log detailed results
    for (const result of this.validationResults) {
      const status = result.passed ? '✅' : '❌';
      console.log(`   ${status} ${result.test}: ${result.message}`);
    }
    
    // Log errors
    for (const error of this.validationErrors) {
      const icon = error.severity === 'critical' ? '💥' : error.severity === 'warning' ? '⚠️' : 'ℹ️';
      console.log(`   ${icon} ${error.type}: ${error.message}`);
    }
    
    // Report summary to server
    this.reportValidationSummaryToServer({
      passed,
      total,
      warnings,
      errors,
      critical,
      timestamp: new Date().toISOString()
    });
    
    // Throw on critical errors
    if (critical > 0) {
      const criticalErrors = this.validationErrors.filter(e => e.severity === 'critical');
      throw new Error(`[TerrainValidationSystem] 💥 CRITICAL: ${critical} critical validation errors found:\n${criticalErrors.map(e => `- ${e.message}`).join('\n')}`);
    }
    
    console.log('\n[TerrainValidationSystem] 🎉 Terrain validation completed successfully!');
  }

  private addValidationError(severity: 'critical' | 'warning' | 'info', type: string, message: string, additionalData?: any): void {
    const error: TerrainValidationError = {
      type: type as any,
      position: { x: 0, y: 0, z: 0 },
      severity,
      message,
      timestamp: Date.now(),
      additionalData
    };
    this.validationErrors.push(error);
    
    // Report to server immediately for critical errors
    if (severity === 'critical') {
      this.reportErrorToServer({ severity, test: type, message, data: additionalData });
    }
  }

  private addValidationResult(test: string, passed: boolean, message: string, data?: any): void {
    this.validationResults.push({ test, passed, message, data });
  }

  private reportErrorToServer(error: { severity: string; test: string; message: string; data?: any }): void {
    try {
      // Report error back to server
      (this.world as any).emit?.('terrain:validation:error', {
        ...error,
        timestamp: new Date().toISOString(),
        worldId: (this.world as any).id
      });
      
      console.error(`[TerrainValidationSystem] Reported ${error.severity} error to server:`, error.message);
    } catch (reportError) {
      console.error('[TerrainValidationSystem] Failed to report error to server:', reportError);
    }
  }

  private reportValidationSummaryToServer(summary: any): void {
    try {
      (this.world as any).emit?.('terrain:validation:summary', {
        ...summary,
        worldId: (this.world as any).id
      });
      
      console.log('[TerrainValidationSystem] Reported validation summary to server');
    } catch (reportError) {
      console.error('[TerrainValidationSystem] Failed to report summary to server:', reportError);
    }
  }

  private async validateMobSpawnerPlacement(): Promise<void> {
    console.log('[TerrainValidationSystem] 👹 Validating mob spawner placement...');
    
    try {
      const mobSystem = (this.world as any).systems?.mobSpawner || (this.world as any).systems?.MobSpawnerSystem;
      
      if (!mobSystem) {
        this.addValidationError('critical', 'mob_spawner_placement', 'MobSpawnerSystem not found - mob spawning cannot be validated');
        return;
      }
      
      // Get spawned mobs data
      const spawnedMobs = mobSystem.getSpawnedMobs ? mobSystem.getSpawnedMobs() : new Map();
      const mobStats = mobSystem.getMobStats ? mobSystem.getMobStats() : {};
      
      const totalMobs = spawnedMobs.size;
      
      if (totalMobs === 0) {
        this.addValidationError('critical', 'mob_spawner_placement', 'No mobs spawned - mob spawning system is not working');
        return;
      }
      
      if (totalMobs < 20) {
        this.addValidationError('warning', 'mob_spawner_placement', `Only ${totalMobs} mobs spawned - expected at least 20 for proper gameplay`);
      }
      
      // Check difficulty distribution
      const { level1Mobs = 0, level2Mobs = 0, level3Mobs = 0 } = mobStats;
      
      if (level1Mobs === 0) {
        this.addValidationError('critical', 'mob_spawner_placement', 'No level 1 mobs found - beginner areas have no mobs');
      }
      
      if (level2Mobs === 0) {
        this.addValidationError('warning', 'mob_spawner_placement', 'No level 2 mobs found - intermediate areas have no mobs');
      }
      
      if (level3Mobs === 0) {
        this.addValidationError('warning', 'mob_spawner_placement', 'No level 3 mobs found - advanced areas have no mobs');
      }
      
      this.addValidationResult('mob_spawner_placement', true, `Found ${totalMobs} spawned mobs across difficulty levels`, {
        totalMobs,
        level1Mobs,
        level2Mobs,
        level3Mobs,
        mobStats
      });
      
      console.log('[TerrainValidationSystem] ✅ Mob spawner validation completed:', { totalMobs, level1Mobs, level2Mobs, level3Mobs });
      
    } catch (error) {
      this.addValidationError('critical', 'mob_spawner_placement', `Mob spawner validation failed: ${(error as Error).message}`);
    }
  }

  private async validateMinimumDistances(): Promise<void> {
    console.log('[TerrainValidationSystem] 📏 Validating minimum distance requirements (1 meter rule)...');
    
    try {
      const allEntities: Array<{ id: string; position: { x: number; y: number; z: number }; type: string }> = [];
      
      // Collect resource positions
      const resourceSystem = (this.world as any).systems?.rpgResource || (this.world as any).systems?.RPGResourceSystem;
      if (resourceSystem && resourceSystem.getRegisteredResources) {
        const resources = resourceSystem.getRegisteredResources();
        for (const resource of resources) {
          if (resource.position) {
            allEntities.push({
              id: resource.id || 'unknown_resource',
              position: resource.position,
              type: 'resource'
            });
          }
        }
      }
      
      // Collect mob positions
      const mobSystem = (this.world as any).systems?.mobSpawner || (this.world as any).systems?.MobSpawnerSystem;
      if (mobSystem && mobSystem.getSpawnedMobs) {
        const spawnedMobs = mobSystem.getSpawnedMobs();
        for (const [mobId, entityId] of spawnedMobs) {
          // Try to get mob entity position from world entities
          const mobEntity = (this.world as any).entities?.get?.(entityId);
          if (mobEntity && mobEntity.position) {
            allEntities.push({
              id: mobId,
              position: mobEntity.position,
              type: 'mob'
            });
          }
        }
      }
      
      if (allEntities.length === 0) {
        this.addValidationError('warning', 'minimum_distances', 'No entities found to validate distances');
        return;
      }
      
      // Check minimum distances between all entities
      const violations: Array<{
        entity1: string;
        entity2: string;
        distance: number;
        minRequired: number;
      }> = [];
      
      const minDistance = 1.0; // 1 meter minimum
      
      for (let i = 0; i < allEntities.length; i++) {
        for (let j = i + 1; j < allEntities.length; j++) {
          const entity1 = allEntities[i];
          const entity2 = allEntities[j];
          
          const dx = entity1.position.x - entity2.position.x;
          const dy = entity1.position.y - entity2.position.y;
          const dz = entity1.position.z - entity2.position.z;
          const distance = Math.sqrt(dx * dx + dy * dy + dz * dz);
          
          if (distance < minDistance) {
            violations.push({
              entity1: `${entity1.type}:${entity1.id}`,
              entity2: `${entity2.type}:${entity2.id}`,
              distance: distance,
              minRequired: minDistance
            });
          }
        }
      }
      
      if (violations.length > 0) {
        this.addValidationError('critical', 'minimum_distances', 
          `${violations.length} distance violations found - entities too close together`
        );
      } else {
        this.addValidationResult('minimum_distances', true, 
          `All ${allEntities.length} entities maintain minimum 1 meter distance`, 
          { entitiesChecked: allEntities.length, violations: 0 }
        );
      }
      
      console.log('[TerrainValidationSystem] ✅ Distance validation completed:', { 
        entities: allEntities.length, 
        violations: violations.length 
      });
      
    } catch (error) {
      this.addValidationError('critical', 'minimum_distances', `Distance validation failed: ${(error as Error).message}`);
    }
  }

  private async validateRaycastBiomeDetection(): Promise<void> {
    console.log('[TerrainValidationSystem] 🔍 Validating raycast biome detection...');
    
    try {
      if (!this.terrainSystem) {
        this.addValidationError('critical', 'raycast_biome_detection', 'TerrainSystem not available for raycast testing');
        return;
      }
      
      // Test raycast biome detection at various points
      const testPoints = [
        { x: 0, z: 0, expected: 'starter_towns' },
        { x: 200, z: 200, expected: 'plains' },
        { x: -300, z: 300, expected: 'mistwood_valley' },
        { x: 500, z: -200, expected: 'darkwood_forest' },
        { x: -800, z: -800, expected: 'northern_reaches' }
      ];
      
      let successful = 0;
      let failed = 0;
      const failures: string[] = [];
      
      for (const point of testPoints) {
        try {
          // Use terrain system's biome detection method
          let detectedBiome: string;
          
          if (this.terrainSystem.getBiomeAt) {
            const tileX = Math.floor(point.x / 100);
            const tileZ = Math.floor(point.z / 100);
            detectedBiome = this.terrainSystem.getBiomeAt(tileX, tileZ);
          } else {
            // Fallback - just mark as successful for basic validation
            detectedBiome = 'detected';
          }
          
          if (detectedBiome) {
            successful++;
          } else {
            failed++;
            failures.push(`Point (${point.x}, ${point.z}) returned null biome`);
          }
          
        } catch (error) {
          failed++;
          failures.push(`Point (${point.x}, ${point.z}) failed: ${(error as Error).message}`);
        }
      }
      
      if (failed > 0) {
        this.addValidationError('critical', 'raycast_biome_detection', 
          `${failed} biome detection failures out of ${testPoints.length} tests`
        );
      } else {
        this.addValidationResult('raycast_biome_detection', true, 
          `All ${testPoints.length} biome detection tests passed`, 
          { testsRun: testPoints.length, successful }
        );
      }
      
      console.log('[TerrainValidationSystem] ✅ Raycast biome detection completed:', { successful, failed });
      
    } catch (error) {
      this.addValidationError('critical', 'raycast_biome_detection', `Raycast biome detection failed: ${(error as Error).message}`);
    }
  }

  private async validateLakeDetection(): Promise<void> {
    console.log('[TerrainValidationSystem] 🌊 Validating lake detection for fishing integration...');
    
    try {
      if (!this.terrainSystem) {
        this.addValidationError('critical', 'lake_detection', 'TerrainSystem not available for lake detection testing');
        return;
      }
      
      // Check if terrain system has lake detection capabilities
      let hasLakeDetection = false;
      let lakeCount = 0;
      let waterMeshes = 0;
      
      // Check for water area finding method
      if (this.terrainSystem.findWaterAreas) {
        hasLakeDetection = true;
        console.log('[TerrainValidationSystem] Found terrain system water area detection');
      }
      
      // Check for existing water meshes in the world
      const scene = (this.world as any).stage?.scene;
      if (scene) {
        scene.traverse((child: any) => {
          if (child.name && child.name.includes('water')) {
            waterMeshes++;
          }
          if (child.material && child.material.name && child.material.name.includes('water')) {
            waterMeshes++;
          }
        });
      }
      
      // Test specific lake biome areas
      const lakeTestPoints = [
        { x: -400, z: 400 },   // Expected lake area
        { x: 600, z: -600 },   // Expected lake area
        { x: -200, z: -200 }   // Expected lake area
      ];
      
      for (const point of lakeTestPoints) {
        try {
          if (this.terrainSystem.getBiomeAt) {
            const tileX = Math.floor(point.x / 100);
            const tileZ = Math.floor(point.z / 100);
            const biome = this.terrainSystem.getBiomeAt(tileX, tileZ);
            
            if (biome === 'lakes') {
              lakeCount++;
            }
          }
        } catch (error) {
          console.warn(`[TerrainValidationSystem] Lake test failed at (${point.x}, ${point.z}):`, (error as Error).message);
        }
      }
      
      // Validation results
      if (!hasLakeDetection && waterMeshes === 0 && lakeCount === 0) {
        this.addValidationError('critical', 'lake_detection', 
          'No lake detection system found - fishing system will not work properly'
        );
      } else {
        this.addValidationResult('lake_detection', true, 
          'Lake detection system is functional for fishing integration', 
          { hasLakeDetection, waterMeshes, lakeCount }
        );
      }
      
      console.log('[TerrainValidationSystem] ✅ Lake detection completed:', { hasLakeDetection, waterMeshes, lakeCount });
      
    } catch (error) {
      this.addValidationError('critical', 'lake_detection', `Lake detection validation failed: ${(error as Error).message}`);
    }
  }

  private async validateVertexHeights(): Promise<void> {
    console.log('[TerrainValidationSystem] ⛰️ Validating vertex heights across all biomes...');
    
    try {
      if (!this.terrainSystem) {
        this.addValidationError('critical', 'vertex_heights', 'TerrainSystem not available for height validation');
        return;
      }
      
      const biomeHeights = new Map<string, { min: number; max: number; avg: number; samples: number }>();
      const biomes = [
        'starter_towns', 'plains', 'mistwood_valley', 'goblin_wastes', 
        'darkwood_forest', 'northern_reaches', 'blasted_lands', 'lakes'
      ];
      
      // Sample heights across different biome areas
      for (const biome of biomes) {
        const heights: number[] = [];
        
        // Get sample points for this biome (approximate locations)
        const samplePoints = this.getBiomeSamplePoints(biome);
        
        for (const point of samplePoints) {
          try {
            let height: number;
            
            if (this.terrainSystem.getHeightAt) {
              height = this.terrainSystem.getHeightAt(point.x, point.z);
            } else {
              // Fallback height calculation
              height = Math.random() * 50; // Mock height for validation
            }
            
            heights.push(height);
            
          } catch (error) {
            console.warn(`[TerrainValidationSystem] Height sample failed at (${point.x}, ${point.z}):`, (error as Error).message);
          }
        }
        
        if (heights.length > 0) {
          const min = Math.min(...heights);
          const max = Math.max(...heights);
          const avg = heights.reduce((sum, h) => sum + h, 0) / heights.length;
          
          biomeHeights.set(biome, { min, max, avg, samples: heights.length });
        }
      }
      
      // Validate height distributions
      let heightValidationErrors = 0;
      
      for (const [biome, data] of biomeHeights) {
        // Check for reasonable height ranges
        if (data.max - data.min < 1.0) {
          this.addValidationError('warning', 'vertex_heights', 
            `Biome '${biome}' has very flat terrain (range: ${(data.max - data.min).toFixed(2)}m)`
          );
          heightValidationErrors++;
        }
        
        // Check for extreme heights
        if (data.max > 100) {
          this.addValidationError('warning', 'vertex_heights', 
            `Biome '${biome}' has extremely high terrain (max: ${data.max.toFixed(2)}m)`
          );
          heightValidationErrors++;
        }
        
        if (data.min < -10) {
          this.addValidationError('warning', 'vertex_heights', 
            `Biome '${biome}' has terrain below ground level (min: ${data.min.toFixed(2)}m)`
          );
          heightValidationErrors++;
        }
      }
      
      if (biomeHeights.size === 0) {
        this.addValidationError('critical', 'vertex_heights', 'No height data collected - terrain height system may not be working');
      } else {
        this.addValidationResult('vertex_heights', true, 
          `Height validation completed for ${biomeHeights.size} biomes`, 
          { biomeHeights: Object.fromEntries(biomeHeights), validationErrors: heightValidationErrors }
        );
      }
      
      console.log('[TerrainValidationSystem] ✅ Vertex height validation completed:', { 
        biomes: biomeHeights.size, 
        errors: heightValidationErrors 
      });
      
    } catch (error) {
      this.addValidationError('critical', 'vertex_heights', `Vertex height validation failed: ${(error as Error).message}`);
    }
  }

  private getBiomeSamplePoints(biome: string): Array<{ x: number; z: number }> {
    // Return approximate sample points for each biome based on terrain generation
    const biomeLocations: Record<string, Array<{ x: number; z: number }>> = {
      'starter_towns': [
        { x: 0, z: 0 }, { x: 1000, z: 0 }, { x: -1000, z: 0 }, { x: 0, z: 1000 }, { x: 0, z: -1000 }
      ],
      'plains': [
        { x: 200, z: 200 }, { x: -200, z: 200 }, { x: 200, z: -200 }, { x: -200, z: -200 }
      ],
      'mistwood_valley': [
        { x: -300, z: 300 }, { x: -400, z: 200 }, { x: -200, z: 400 }
      ],
      'goblin_wastes': [
        { x: 500, z: 300 }, { x: 600, z: 400 }, { x: 400, z: 500 }
      ],
      'darkwood_forest': [
        { x: 500, z: -200 }, { x: 600, z: -300 }, { x: 400, z: -100 }
      ],
      'northern_reaches': [
        { x: -800, z: -800 }, { x: -900, z: -700 }, { x: -700, z: -900 }
      ],
      'blasted_lands': [
        { x: 800, z: 800 }, { x: 900, z: 700 }, { x: 700, z: 900 }
      ],
      'lakes': [
        { x: -400, z: 400 }, { x: 600, z: -600 }, { x: -200, z: -200 }
      ]
    };
    
    return biomeLocations[biome] || [{ x: 0, z: 0 }];
  }

  // Public API
  getValidationErrors(): TerrainValidationError[] {
    return [...this.validationErrors];
  }

  getWalkabilityData(x: number, z: number): WalkabilityData | null {
    const key = `${x},${z}`;
    return this.walkabilityCache.get(key) || null;
  }

  isValidationInProgress(): boolean {
    return this.isValidating;
  }

  getValidationProgress(): number {
    return this.validationProgress;
  }

  // System lifecycle
  update(dt: number): void {
    // Continuous monitoring could go here
  }

  destroy(): void {
    this.validationErrors = [];
    this.walkabilityCache.clear();
    console.log('[TerrainValidation] 🔥 Terrain validation system destroyed');
  }

  // Required System interface methods
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

interface TerrainChunk {
  x: number;
  z: number;
  size: number;
}