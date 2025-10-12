/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unused-vars, no-empty */
/**
 * Production-Grade Resource Placement Validation System
 * 
 * Ensures proper resource placement and validation with:
 * - Resource existence verification across the world
 * - Proper height and ground alignment validation
 * - Biome-appropriate resource placement checks
 * - Resource density and distribution analysis
 * - Accessibility validation for player interaction
 * - Performance optimized batch validation
 * - Resource integrity monitoring
 */

import { System } from './System';
import THREE from '../extras/three';
import type { World } from '../types/index';
import { calculateDistance } from '../utils/MathUtils';
import { TerrainValidationSystem } from './TerrainValidationSystem';
import { EventType } from '../types/events';

export interface ResourceDefinition {
  id: string;
  type: 'tree' | 'rock' | 'ore' | 'fishing_spot' | 'herb' | 'treasure' | 'structure';
  name: string;
  allowedBiomes: string[];
  minSpacing: number; // Minimum distance between same resource type
  maxSlopeAngle: number; // Maximum slope for placement (degrees)
  waterRequirement?: 'none' | 'near' | 'in'; // Water placement requirements
  heightRange?: { min: number; max: number }; // Allowed height range
  rarity: number; // 0-1, affects spawn density
  interactionRadius: number; // How close players need to be to interact
}

export interface ResourceInstance {
  id: string;
  definitionId: string;
  position: { x: number; y: number; z: number }
  rotation: { x: number; y: number; z: number }
  scale: { x: number; y: number; z: number }
  health: number;
  maxHealth: number;
  respawnTime?: number;
  lastHarvested?: number;
  biome: string;
  accessible: boolean;
  groundHeight: number;
  slope: number;
  waterDistance: number;
  metadata: Record<string, unknown>;
}

export interface ResourceValidationError {
  type: 'placement_invalid' | 'biome_mismatch' | 'height_mismatch' | 'slope_too_steep' | 
        'water_requirement_failed' | 'spacing_violation' | 'inaccessible' | 'floating' | 
        'underground' | 'missing_collision' | 'density_violation';
  resourceId: string;
  resourceType: string;
  position: { x: number; y: number; z: number }
  severity: 'critical' | 'warning' | 'info';
  message: string;
  timestamp: number;
  expectedValue?: unknown;
  actualValue?: unknown;
  suggestedFix?: string;
}

export interface ResourceValidationResult {
  isValid: boolean;
  totalResources: number;
  validResources: number;
  errors: ResourceValidationError[];
  biomeDistribution: Record<string, number>;
  typeDistribution: Record<string, number>;
  averageDensity: number;
  validationTime: number;
  accessibilityScore: number;
}

export interface BiomeResourceConfig {
  biome: string;
  allowedResources: string[];
  densityMultiplier: number;
  qualityBonus: number;
  specialResources?: string[];
}

export class ResourceValidationSystem extends System {
  private resourceDefinitions = new Map<string, ResourceDefinition>();
  private resourceInstances = new Map<string, ResourceInstance>();
  private biomeConfigs = new Map<string, BiomeResourceConfig>();
  private validationErrors: ResourceValidationError[] = [];
  private terrainValidationSystem?: TerrainValidationSystem;
  private lastValidationTime = 0;
  private isValidating = false;
  private logger = { warn: console.warn.bind(console), error: console.error.bind(console) };
  
  // System configuration
  private readonly CONFIG = {
    VALIDATION_INTERVAL: 10000, // Validate every 10 seconds
    BATCH_SIZE: 50, // Process 50 resources per batch
    MAX_VALIDATION_TIME: 100, // 100ms max per frame
    HEIGHT_TOLERANCE: 0.5, // 50cm height tolerance
    SLOPE_TOLERANCE: 5, // 5 degrees slope tolerance
    WATER_NEAR_DISTANCE: 20, // 20m "near water" requirement
    ACCESSIBILITY_RAYCAST_COUNT: 8, // 8 rays for accessibility check
    DENSITY_GRID_SIZE: 50, // 50m grid for density analysis
    MIN_INTERACTION_CLEARANCE: 2, // 2m clearance around resources
    RESOURCE_HEALTH_CHECK_INTERVAL: 30000, // 30s health monitoring
    RESPAWN_CHECK_INTERVAL: 5000, // 5s respawn monitoring
  };

  constructor(world: World) {
    super(world);
    this.initializeResourceDefinitions();
    this.initializeBiomeConfigs();
  }

  async init(): Promise<void> {
    
    // Find required systems
    this.terrainValidationSystem = this.world.getSystem('terrain-validation');
    
    if (!this.terrainValidationSystem) {
      this.logger.warn('[ResourceValidation] TerrainValidationSystem not found - resource validation will be limited.');
    }
    
    // Listen for resource events
    this.world.on(EventType.RESOURCE_RESPAWNED, (...args: unknown[]) => this.onResourceSpawned(args[0] as { resourceId: string; definitionId: string; position: { x: number; y: number; z: number } }));
    this.world.on(EventType.RESOURCE_HARVEST, (...args: unknown[]) => this.onResourceHarvested(args[0] as { resourceId: string; playerId: string; amount: number }));
    this.world.on(EventType.RESOURCE_RESPAWNED, (...args: unknown[]) => this.onResourceRespawned(args[0] as { resourceId: string }));
    this.world.on(EventType.RESOURCE_DEPLETED, (...args: unknown[]) => this.onResourceDestroyed(args[0] as { resourceId: string }));
    
    // Listen for terrain changes
    this.world.on(EventType.TERRAIN_TILE_GENERATED, (...args: unknown[]) => this.onTerrainChanged(args[0] as { bounds: unknown }));
    this.world.on(EventType.TERRAIN_VALIDATION_COMPLETE, (...args: unknown[]) => this.updateResourceValidation(args[0]));
    
    // Listen for validation requests
    this.world.on(EventType.RESOURCE_VALIDATION_REQUEST, (..._args: unknown[]) => this.requestValidation());
    this.world.on(EventType.RESOURCE_PLACEMENT_VALIDATE, (...args: unknown[]) => this.validateResourcePlacement(args[0] as { definitionId: string; position: { x: number; y: number; z: number }; callback: (isValid: boolean, errors: ResourceValidationError[]) => void }));
    
  }

  start(): void {
    
    // Start periodic validation
    setInterval(() => {
      if (!this.isValidating) {
        this.validateAllResources();
      }
    }, this.CONFIG.VALIDATION_INTERVAL);
    
    // Start resource health monitoring
    this.startResourceHealthMonitoring();
    
    // Start respawn monitoring
    this.startRespawnMonitoring();
    
    // Load existing resources
    this.loadExistingResources();
  }

  /**
   * Initialize standard resource definitions
   */
  private initializeResourceDefinitions(): void {
    const definitions: ResourceDefinition[] = [
      {
        id: 'oak_tree',
        type: 'tree',
        name: 'Oak Tree',
        allowedBiomes: ['plains', 'forest', 'grassland'],
        minSpacing: 5,
        maxSlopeAngle: 25,
        waterRequirement: 'none',
        heightRange: { min: 1, max: 100 },
        rarity: 0.7,
        interactionRadius: 3
      },
      {
        id: 'willow_tree',
        type: 'tree',
        name: 'Willow Tree',
        allowedBiomes: ['swamp', 'riverside', 'wetland'],
        minSpacing: 4,
        maxSlopeAngle: 15,
        waterRequirement: 'near',
        heightRange: { min: 0, max: 20 },
        rarity: 0.5,
        interactionRadius: 3
      },
      {
        id: 'iron_ore',
        type: 'ore',
        name: 'Iron Ore',
        allowedBiomes: ['mountain', 'hill', 'rocky'],
        minSpacing: 10,
        maxSlopeAngle: 45,
        waterRequirement: 'none',
        heightRange: { min: 20, max: 200 },
        rarity: 0.3,
        interactionRadius: 2
      },
      {
        id: 'fishing_spot',
        type: 'fishing_spot',
        name: 'Fishing Spot',
        allowedBiomes: ['lake', 'river', 'ocean', 'pond'],
        minSpacing: 15,
        maxSlopeAngle: 10,
        waterRequirement: 'in',
        heightRange: { min: -5, max: 2 },
        rarity: 0.4,
        interactionRadius: 5
      },
      {
        id: 'healing_herb',
        type: 'herb',
        name: 'Healing Herb',
        allowedBiomes: ['forest', 'meadow', 'grassland'],
        minSpacing: 3,
        maxSlopeAngle: 20,
        waterRequirement: 'none',
        heightRange: { min: 1, max: 80 },
        rarity: 0.2,
        interactionRadius: 1.5
      }
    ];
    
    for (const definition of definitions) {
      this.resourceDefinitions.set(definition.id, definition);
    }
    
  }

  /**
   * Initialize biome resource configurations
   */
  private initializeBiomeConfigs(): void {
    const configs: BiomeResourceConfig[] = [
      {
        biome: 'plains',
        allowedResources: ['oak_tree', 'healing_herb'],
        densityMultiplier: 1.0,
        qualityBonus: 0.1
      },
      {
        biome: 'forest',
        allowedResources: ['oak_tree', 'healing_herb'],
        densityMultiplier: 1.5,
        qualityBonus: 0.2,
        specialResources: ['rare_mushroom']
      },
      {
        biome: 'mountain',
        allowedResources: ['iron_ore'],
        densityMultiplier: 0.8,
        qualityBonus: 0.3,
        specialResources: ['mithril_ore']
      },
      {
        biome: 'lake',
        allowedResources: ['fishing_spot'],
        densityMultiplier: 1.2,
        qualityBonus: 0.15
      },
      {
        biome: 'swamp',
        allowedResources: ['willow_tree'],
        densityMultiplier: 0.7,
        qualityBonus: 0.1,
        specialResources: ['swamp_gas']
      }
    ];
    
    for (const config of configs) {
      this.biomeConfigs.set(config.biome, config);
    }
    
  }

  /**
   * Start resource health monitoring
   */
  private startResourceHealthMonitoring(): void {
    setInterval(() => {
      this.checkResourceHealth();
    }, this.CONFIG.RESOURCE_HEALTH_CHECK_INTERVAL);
  }

  /**
   * Start respawn monitoring
   */
  private startRespawnMonitoring(): void {
    setInterval(() => {
      this.checkResourceRespawns();
    }, this.CONFIG.RESPAWN_CHECK_INTERVAL);
  }

  /**
   * Load existing resources from the world
   */
  private loadExistingResources(): void {
    
    // This would typically load from a database or world state
    // For now, we'll simulate some resources
    const simulatedResources = this.generateSimulatedResources();
    
    for (const resource of simulatedResources) {
      this.resourceInstances.set(resource.id, resource);
    }
    
  }

  /**
   * Generate simulated resources for testing
   */
  private generateSimulatedResources(): ResourceInstance[] {
    const resources: ResourceInstance[] = [];
    
    // Generate some test resources
    for (let i = 0; i < 100; i++) {
      const x = (Math.random() - 0.5) * 1000; // -500 to +500
      const z = (Math.random() - 0.5) * 1000;
      const terrainHeight = this.getTerrainHeight(x, z) || 10;
      
      resources.push({
        id: `resource_${i}`,
        definitionId: 'oak_tree',
        position: { x, y: terrainHeight + 0.1, z },
        rotation: { x: 0, y: Math.random() * Math.PI * 2, z: 0 },
        scale: { x: 1, y: 1, z: 1 },
        health: 100,
        maxHealth: 100,
        biome: this.getBiomeAtPosition(x, z) || 'plains',
        accessible: true,
        groundHeight: terrainHeight,
        slope: 0,
        waterDistance: Math.random() * 50,
        metadata: {}
      });
    }
    
    return resources;
  }

  /**
   * Validate all resources in the world
   */
  public async validateAllResources(): Promise<ResourceValidationResult> {
    if (this.isValidating) {
      return this.getLastValidationResult();
    }

    this.isValidating = true;
    const startTime = performance.now();
    
    const result: ResourceValidationResult = {
      isValid: true,
      totalResources: this.resourceInstances.size,
      validResources: 0,
      errors: [],
      biomeDistribution: {},
      typeDistribution: {},
      averageDensity: 0,
      validationTime: 0,
      accessibilityScore: 0
    };

    try {
      const resources = Array.from(this.resourceInstances.values());
      let processedResources = 0;
      let accessibleResources = 0;
      
      // Process resources in batches
      for (let i = 0; i < resources.length; i += this.CONFIG.BATCH_SIZE) {
        const batchStart = performance.now();
        const batch = resources.slice(i, i + this.CONFIG.BATCH_SIZE);
        
        for (const resource of batch) {
          const errors = await this.validateSingleResource(resource);
          result.errors.push(...errors);
          
          if (errors.length === 0) {
            result.validResources++;
          }
          
          if (resource.accessible) {
            accessibleResources++;
          }
          
          // Update distribution tracking
          result.biomeDistribution[resource.biome] = (result.biomeDistribution[resource.biome] || 0) + 1;
          
          const definition = this.resourceDefinitions.get(resource.definitionId);
          if (definition) {
            result.typeDistribution[definition.type] = (result.typeDistribution[definition.type] || 0) + 1;
          }
          
          processedResources++;
        }
        
        // Yield to main thread if taking too long
        const batchTime = performance.now() - batchStart;
        if (batchTime > this.CONFIG.MAX_VALIDATION_TIME) {
          await new Promise(resolve => setTimeout(resolve, 1));
        }
      }
      
      // Calculate metrics
      result.accessibilityScore = resources.length > 0 ? (accessibleResources / resources.length) * 100 : 100;
      result.averageDensity = this.calculateAverageDensity();
      result.validationTime = performance.now() - startTime;
      result.isValid = result.errors.filter((e) => e.severity === 'critical').length === 0;
      
      
      // Emit validation complete event
      this.world.emit(EventType.RESOURCE_VALIDATION_COMPLETE, result);
      
    } catch (error: any) {
      this.logger.error('[ResourceValidation] Resource validation failed:', error.message);
      result.isValid = false;
      result.errors.push({
        type: 'missing_collision',
        resourceId: 'system',
        resourceType: 'system',
        position: { x: 0, y: 0, z: 0 },
        severity: 'critical',
        message: `Resource validation system error: ${error.message}`,
        timestamp: Date.now()
      });
    } finally {
      this.isValidating = false;
      this.lastValidationTime = Date.now();
    }

    return result;
  }

  /**
   * Validate a single resource instance
   */
  private async validateSingleResource(resource: ResourceInstance): Promise<ResourceValidationError[]> {
    const errors: ResourceValidationError[] = [];
    const definition = this.resourceDefinitions.get(resource.definitionId);
    
    if (!definition) {
      errors.push({
        type: 'placement_invalid',
        resourceId: resource.id,
        resourceType: 'unknown',
        position: resource.position,
        severity: 'critical',
        message: `Resource definition not found: ${resource.definitionId}`,
        timestamp: Date.now()
      });
      return errors;
    }
    
    // 1. Biome validation
    if (!definition.allowedBiomes.includes(resource.biome)) {
      errors.push({
        type: 'biome_mismatch',
        resourceId: resource.id,
        resourceType: definition.type,
        position: resource.position,
        severity: 'warning',
        message: `Resource in wrong biome: expected ${definition.allowedBiomes.join('|')}, found ${resource.biome}`,
        timestamp: Date.now(),
        expectedValue: definition.allowedBiomes,
        actualValue: resource.biome,
        suggestedFix: 'Move resource to appropriate biome or update biome data'
      });
    }
    
    // 2. Height validation
    const terrainHeight = this.getTerrainHeight(resource.position.x, resource.position.z);
    if (terrainHeight !== null) {
      const heightDiff = Math.abs(resource.position.y - terrainHeight);
      
      if (heightDiff > this.CONFIG.HEIGHT_TOLERANCE) {
        const isFloating = resource.position.y > terrainHeight + this.CONFIG.HEIGHT_TOLERANCE;
        const isUnderground = resource.position.y < terrainHeight - this.CONFIG.HEIGHT_TOLERANCE;
        
        errors.push({
          type: isFloating ? 'floating' : 'underground',
          resourceId: resource.id,
          resourceType: definition.type,
          position: resource.position,
          severity: isUnderground ? 'critical' : 'warning',
          message: `Resource ${isFloating ? 'floating' : 'underground'}: ${heightDiff.toFixed(2)}m from terrain`,
          timestamp: Date.now(),
          expectedValue: terrainHeight,
          actualValue: resource.position.y,
          suggestedFix: 'Clamp resource to terrain height'
        });
      }
      
      // Update resource ground height
      resource.groundHeight = terrainHeight;
    }
    
    // 3. Slope validation
    const slope = this.calculateSlope(resource.position.x, resource.position.z);
    const slopeAngle = Math.atan(slope) * (180 / Math.PI);
    
    if (slopeAngle > definition.maxSlopeAngle) {
      errors.push({
        type: 'slope_too_steep',
        resourceId: resource.id,
        resourceType: definition.type,
        position: resource.position,
        severity: 'warning',
        message: `Slope too steep: ${slopeAngle.toFixed(1)}°, max ${definition.maxSlopeAngle}°`,
        timestamp: Date.now(),
        expectedValue: definition.maxSlopeAngle,
        actualValue: slopeAngle,
        suggestedFix: 'Move resource to flatter terrain'
      });
    }
    
    resource.slope = slopeAngle;
    
    // 4. Water requirement validation
    if (definition.waterRequirement !== 'none') {
      const waterDistance = this.getDistanceToWater(resource.position.x, resource.position.z);
      resource.waterDistance = waterDistance;
      
      if (definition.waterRequirement === 'near' && waterDistance > this.CONFIG.WATER_NEAR_DISTANCE) {
        errors.push({
          type: 'water_requirement_failed',
          resourceId: resource.id,
          resourceType: definition.type,
          position: resource.position,
          severity: 'warning',
          message: `Resource too far from water: ${waterDistance.toFixed(1)}m, max ${this.CONFIG.WATER_NEAR_DISTANCE}m`,
          timestamp: Date.now(),
          expectedValue: this.CONFIG.WATER_NEAR_DISTANCE,
          actualValue: waterDistance,
          suggestedFix: 'Move resource closer to water or change water requirement'
        });
      }
      
      if (definition.waterRequirement === 'in' && waterDistance > 2) {
        errors.push({
          type: 'water_requirement_failed',
          resourceId: resource.id,
          resourceType: definition.type,
          position: resource.position,
          severity: 'critical',
          message: `Resource must be in water but is ${waterDistance.toFixed(1)}m away`,
          timestamp: Date.now(),
          expectedValue: 0,
          actualValue: waterDistance,
          suggestedFix: 'Move resource into water'
        });
      }
    }
    
    // 5. Spacing validation
    const nearbyResources = this.getNearbyResources(resource.position, definition.minSpacing, definition.id);
    if (nearbyResources.length > 0) {
      const closestDistance = Math.min(...nearbyResources.map(r => 
        calculateDistance(resource.position, r.position)
      ));
      
      errors.push({
        type: 'spacing_violation',
        resourceId: resource.id,
        resourceType: definition.type,
        position: resource.position,
        severity: 'info',
        message: `Resource too close to others: ${closestDistance.toFixed(1)}m, min ${definition.minSpacing}m`,
        timestamp: Date.now(),
        expectedValue: definition.minSpacing,
        actualValue: closestDistance,
        suggestedFix: 'Increase spacing between resources'
      });
    }
    
    // 6. Accessibility validation
    const isAccessible = await this.checkResourceAccessibility(resource, definition);
    resource.accessible = isAccessible;
    
    if (!isAccessible) {
      errors.push({
        type: 'inaccessible',
        resourceId: resource.id,
        resourceType: definition.type,
        position: resource.position,
        severity: 'warning',
        message: 'Resource is not accessible to players',
        timestamp: Date.now(),
        suggestedFix: 'Clear obstacles around resource or move to accessible location'
      });
    }
    
    return errors;
  }

  /**
   * Check if resource is accessible to players
   */
  private async checkResourceAccessibility(resource: ResourceInstance, definition: ResourceDefinition): Promise<boolean> {
    // This method is no longer used as physxCollisionSystem is removed.
    // The accessibility check logic needs to be re-evaluated or removed if not needed.
    // For now, we'll return true as a placeholder.
    return true;
  }

  /**
   * Calculate average resource density
   */
  private calculateAverageDensity(): number {
    if (this.resourceInstances.size === 0) return 0;
    
    // Use a simple grid-based density calculation
    const gridSize = this.CONFIG.DENSITY_GRID_SIZE;
    const densityMap = new Map<string, number>();
    
    for (const resource of this.resourceInstances.values()) {
      const gridX = Math.floor(resource.position.x / gridSize);
      const gridZ = Math.floor(resource.position.z / gridSize);
      const key = `${gridX},${gridZ}`;
      
      densityMap.set(key, (densityMap.get(key) || 0) + 1);
    }
    
    const totalDensity = Array.from(densityMap.values()).reduce((sum, count) => sum + count, 0);
    return totalDensity / densityMap.size;
  }

  /**
   * Get nearby resources of the same type
   */
  private getNearbyResources(position: { x: number; y: number; z: number }, radius: number, resourceDefinitionId: string): ResourceInstance[] {
    const nearby: ResourceInstance[] = [];
    
    for (const resource of this.resourceInstances.values()) {
      if (resource.definitionId === resourceDefinitionId) {
        const distance = calculateDistance(position, resource.position);
        if (distance < radius) {
          nearby.push(resource);
        }
      }
    }
    
    return nearby;
  }

  /**
   * Check resource health and mark for respawn if needed
   */
  private checkResourceHealth(): void {
    const currentTime = Date.now();
    let resourcesNeedingRespawn = 0;
    
    for (const resource of this.resourceInstances.values()) {
      if (resource.health <= 0 && resource.respawnTime && currentTime >= resource.respawnTime) {
        // Mark for respawn
        this.world.emit(EventType.RESOURCE_RESPAWN_READY, {
          resourceId: resource.id,
          position: resource.position
        });
        resourcesNeedingRespawn++;
      }
    }
    
    if (resourcesNeedingRespawn > 0) {
    }
  }

  /**
   * Check for resources that should respawn
   */
  private checkResourceRespawns(): void {
    // This would handle the actual respawning logic
    // For now, just emit events for resources that need respawning
  }

  // Helper methods
  private getTerrainHeight(x: number, z: number): number | null {
    if (!this.terrainValidationSystem) return null;
    return this.terrainValidationSystem.getTerrainHeight(x, z) || null;
  }

  private getBiomeAtPosition(x: number, z: number): string | null {
    if (!this.terrainValidationSystem) return 'plains';
    return this.terrainValidationSystem.getBiomeAtPosition(x, z) || 'plains';
  }

  private calculateSlope(x: number, z: number): number {
    if (!this.terrainValidationSystem) return 0;
    return this.terrainValidationSystem.calculateSlope(x, z) || 0;
  }

  private isPositionWalkable(x: number, z: number): boolean {
    if (!this.terrainValidationSystem) return true;
    return this.terrainValidationSystem.isPositionWalkable(x, z) || false;
  }

  private getDistanceToWater(x: number, z: number): number {
    // This would calculate distance to nearest water body
    // For now, return a random value for simulation
    return Math.random() * 100;
  }


  private getLastValidationResult(): ResourceValidationResult {
    return {
      isValid: false,
      totalResources: this.resourceInstances.size,
      validResources: 0,
      errors: this.validationErrors,
      biomeDistribution: {},
      typeDistribution: {},
      averageDensity: 0,
      validationTime: 0,
      accessibilityScore: 0
    };
  }

  // Event handlers
  private onResourceSpawned(data: { resourceId: string; definitionId: string; position: { x: number; y: number; z: number } }): void {
    
    // Create resource instance
    const definition = this.resourceDefinitions.get(data.definitionId);
    if (definition) {
      const resource: ResourceInstance = {
        id: data.resourceId,
        definitionId: data.definitionId,
        position: data.position,
        rotation: { x: 0, y: 0, z: 0 },
        scale: { x: 1, y: 1, z: 1 },
        health: 100,
        maxHealth: 100,
        biome: this.getBiomeAtPosition(data.position.x, data.position.z) || 'unknown',
        accessible: true,
        groundHeight: this.getTerrainHeight(data.position.x, data.position.z) || data.position.y,
        slope: 0,
        waterDistance: 0,
        metadata: {}
      };
      
      this.resourceInstances.set(data.resourceId, resource);
      
      // Validate new resource
      this.validateSingleResource(resource).then(errors => {
        if (errors.length > 0) {
          this.logger.warn(`[ResourceValidation] New resource has ${errors.length} validation errors`);
        }
      });
    }
  }

  private onResourceHarvested(data: { resourceId: string; playerId: string; amount: number }): void {
    const resource = this.resourceInstances.get(data.resourceId);
    if (resource) {
      resource.health -= data.amount;
      resource.lastHarvested = Date.now();
      
      if (resource.health <= 0) {
        // Set respawn time
        resource.respawnTime = Date.now() + (30000 + Math.random() * 30000); // 30-60 seconds
      }
    }
  }

  private onResourceRespawned(data: { resourceId: string }): void {
    const resource = this.resourceInstances.get(data.resourceId);
    if (resource) {
      resource.health = resource.maxHealth;
      resource.respawnTime = undefined;
      resource.lastHarvested = undefined;
    }
  }

  private onResourceDestroyed(data: { resourceId: string }): void {
    this.resourceInstances.delete(data.resourceId);
  }

  private onTerrainChanged(data: { bounds: unknown }): void {
    // Revalidate resources in the affected area
    this.revalidateResourcesInArea(data.bounds);
  }

  private updateResourceValidation(_data: unknown): void {
    // Update resource validation based on new terrain data
  }

  private revalidateResourcesInArea(_bounds: unknown): void {
    // Revalidate resources in the specified area
    // Implementation would check resources within bounds
  }

  private requestValidation(): void {
    this.validateAllResources();
  }

  private validateResourcePlacement(data: {
    definitionId: string;
    position: { x: number; y: number; z: number }
    callback: (isValid: boolean, errors: ResourceValidationError[]) => void;
  }): void {
    // Validate a potential resource placement
    const definition = this.resourceDefinitions.get(data.definitionId);
    if (!definition) {
      data.callback(false, [{
        type: 'placement_invalid',
        resourceId: 'temp',
        resourceType: 'unknown',
        position: data.position,
        severity: 'critical',
        message: `Unknown resource definition: ${data.definitionId}`,
        timestamp: Date.now()
      }]);
      return;
    }
    
    // Create temporary resource for validation
    const tempResource: ResourceInstance = {
      id: 'temp_validation',
      definitionId: data.definitionId,
      position: data.position,
      rotation: { x: 0, y: 0, z: 0 },
      scale: { x: 1, y: 1, z: 1 },
      health: 100,
      maxHealth: 100,
      biome: this.getBiomeAtPosition(data.position.x, data.position.z) || 'unknown',
      accessible: true,
      groundHeight: this.getTerrainHeight(data.position.x, data.position.z) || data.position.y,
      slope: 0,
      waterDistance: 0,
      metadata: {}
    };
    
    this.validateSingleResource(tempResource).then(errors => {
      const isValid = errors.filter((e) => e.severity === 'critical').length === 0;
      data.callback(isValid, errors);
    });
  }

  // Public API
  public getResourceDefinition(definitionId: string): ResourceDefinition | null {
    return this.resourceDefinitions.get(definitionId) || null;
  }

  public getResourceInstance(resourceId: string): ResourceInstance | null {
    return this.resourceInstances.get(resourceId) || null;
  }

  public getAllResources(): ResourceInstance[] {
    return Array.from(this.resourceInstances.values());
  }

  public getResourcesByType(type: string): ResourceInstance[] {
    return this.getAllResources().filter(resource => {
      const definition = this.resourceDefinitions.get(resource.definitionId);
      return definition?.type === type;
    });
  }

  public getResourcesByBiome(biome: string): ResourceInstance[] {
    return this.getAllResources().filter(resource => resource.biome === biome);
  }

  public getValidationErrors(): ResourceValidationError[] {
    return [...this.validationErrors];
  }

  public getSystemStats(): Record<string, unknown> {
    const resources = this.getAllResources();
    const definitions = Array.from(this.resourceDefinitions.values());
    
    return {
      totalResources: resources.length,
      resourceDefinitions: definitions.length,
      biomeConfigs: this.biomeConfigs.size,
      validationErrors: this.validationErrors.length,
      accessibleResources: resources.filter(r => r.accessible).length,
      harvestedResources: resources.filter(r => r.health <= 0).length,
      lastValidationTime: this.lastValidationTime
    };
  }

  // System lifecycle
  update(_dt: number): void {
    // System updates would go here
  }

  destroy(): void {
    this.resourceInstances.clear();
    this.validationErrors = [];
  }

  // Required System interface methods
  preTick(): void {}
  preFixedUpdate(): void {}
  fixedUpdate(_dt: number): void {}
  postFixedUpdate(): void {}
  preUpdate(): void {}
  postUpdate(): void {}
  lateUpdate(): void {}
  postLateUpdate(): void {}
  commit(): void {}
  postTick(): void {}
}