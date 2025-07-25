/**
 * RPG Biome Visualization System
 * Creates visual boundaries and labels for world areas for testing and debugging
 */

import * as THREE from '../../core/extras/three';
import { System } from '../../core/systems/System';
import { ALL_WORLD_AREAS, WorldArea } from '../data/world-areas';

export interface BiomeVisual {
  areaId: string;
  area: WorldArea;
  boundaryMesh: THREE.Object3D;
  labelMesh: THREE.Object3D;
  isVisible: boolean;
}

export class RPGBiomeVisualizationSystem extends System {
  private biomeVisuals: Map<string, BiomeVisual> = new Map();
  private isEnabled: boolean = false;
  
  constructor(world: any) {
    super(world);
    
    // Listen for visualization toggle events
    this.world.on?.('rpg:biome:toggle_visualization', this.toggleVisualization.bind(this));
    this.world.on?.('rpg:biome:show_area', this.showArea.bind(this));
    this.world.on?.('rpg:biome:hide_area', this.hideArea.bind(this));
    
    console.log('[RPGBiomeVisualizationSystem] Initialized biome visualization system');
    
    // Generate all biome visuals
    this.generateAllBiomeVisuals();
  }

  /**
   * Generate visual representations for all world areas
   */
  private generateAllBiomeVisuals(): void {
    for (const area of Object.values(ALL_WORLD_AREAS)) {
      this.generateBiomeVisual(area);
    }
    
    console.log(`[RPGBiomeVisualizationSystem] Generated visuals for ${this.biomeVisuals.size} biomes`);
  }

  /**
   * Generate visual representation for a single biome
   */
  private generateBiomeVisual(area: WorldArea): void {
    const boundaryMesh = this.createBoundaryMesh(area);
    const labelMesh = this.createLabelMesh(area);
    
    const biomeVisual: BiomeVisual = {
      areaId: area.id,
      area: area,
      boundaryMesh: boundaryMesh,
      labelMesh: labelMesh,
      isVisible: false
    };
    
    this.biomeVisuals.set(area.id, biomeVisual);
  }

  /**
   * Create boundary mesh for an area
   */
  private createBoundaryMesh(area: WorldArea): THREE.Object3D {
    const width = area.bounds.maxX - area.bounds.minX;
    const depth = area.bounds.maxZ - area.bounds.minZ;
    
    // Create wireframe boundary
    const geometry = new THREE.PlaneGeometry(width, depth);
    geometry.rotateX(-Math.PI / 2); // Make it horizontal
    
    // Choose color based on difficulty level and safe zone status
    let color: number;
    if (area.safeZone) {
      color = 0x00FF00; // Green for safe zones
    } else {
      switch (area.difficultyLevel) {
        case 1:
          color = 0xFFFF00; // Yellow for level 1
          break;
        case 2:
          color = 0xFF8800; // Orange for level 2
          break;
        case 3:
          color = 0xFF0000; // Red for level 3
          break;
        default:
          color = 0x888888; // Gray for unknown
      }
    }
    
    const material = new THREE.MeshBasicMaterial({
      color: color,
      transparent: true,
      opacity: 0.3,
      side: THREE.DoubleSide,
      wireframe: false
    });
    
    const boundary = new THREE.Mesh(geometry, material);
    
    // Position at center of area
    const centerX = (area.bounds.minX + area.bounds.maxX) / 2;
    const centerZ = (area.bounds.minZ + area.bounds.maxZ) / 2;
    boundary.position.set(centerX, 0.1, centerZ);
    
    // Add wireframe outline
    const wireframeGeometry = geometry.clone();
    const wireframeMaterial = new THREE.LineBasicMaterial({
      color: color,
      linewidth: 2,
      transparent: true,
      opacity: 0.8
    });
    
    const edges = new THREE.EdgesGeometry(wireframeGeometry);
    const wireframe = new THREE.LineSegments(edges, wireframeMaterial);
    boundary.add(wireframe);
    
    return boundary;
  }

  /**
   * Create label mesh for an area
   */
  private createLabelMesh(area: WorldArea): THREE.Object3D {
    // Create a simple label using colored cubes to represent text
    // In a real implementation, you'd use a text rendering system
    
    const labelGroup = new THREE.Group();
    
    // Main label cube
    const labelGeometry = new THREE.BoxGeometry(2, 0.5, 0.5);
    const labelMaterial = new THREE.MeshBasicMaterial({
      color: 0xFFFFFF,
      transparent: true,
      opacity: 0.9
    });
    
    const labelCube = new THREE.Mesh(labelGeometry, labelMaterial);
    
    // Add PhysX collider for raycasting
    this.addPhysXCollider(labelCube, {
      width: 2, height: 0.5, depth: 0.5,
      entityId: `biome_label_${area.id}`,
      entityType: 'biome_label'
    });
    
    // Position label at center of area, elevated
    const centerX = (area.bounds.minX + area.bounds.maxX) / 2;
    const centerZ = (area.bounds.minZ + area.bounds.maxZ) / 2;
    labelCube.position.set(centerX, 3, centerZ);
    
    // Add difficulty level indicator cubes
    const difficultyColors = [0x00FF00, 0xFFFF00, 0xFF8800, 0xFF0000]; // Green, Yellow, Orange, Red
    const difficultyColor = area.safeZone ? 0x00FF00 : difficultyColors[area.difficultyLevel];
    
    for (let i = 0; i <= area.difficultyLevel && !area.safeZone; i++) {
      const indicatorGeometry = new THREE.BoxGeometry(0.2, 0.2, 0.2);
      const indicatorMaterial = new THREE.MeshBasicMaterial({ color: difficultyColor });
      const indicator = new THREE.Mesh(indicatorGeometry, indicatorMaterial);
      
      // Add PhysX collider for difficulty indicators
      this.addPhysXCollider(indicator, {
        width: 0.2, height: 0.2, depth: 0.2,
        entityId: `difficulty_indicator_${area.id}_${i}`,
        entityType: 'difficulty_indicator'
      });
      
      indicator.position.set(centerX - 1 + (i * 0.3), 4, centerZ);
      labelGroup.add(indicator);
    }
    
    // Add safe zone indicator
    if (area.safeZone) {
      const safeGeometry = new THREE.SphereGeometry(0.3, 8, 6);
      const safeMaterial = new THREE.MeshBasicMaterial({ 
        color: 0x00FF00,
        transparent: true,
        opacity: 0.7
      });
      const safeIndicator = new THREE.Mesh(safeGeometry, safeMaterial);
      
      // Add PhysX collider for safe zone indicator
      this.addPhysXCollider(safeIndicator, {
        width: 0.6, height: 0.6, depth: 0.6,
        entityId: `safe_zone_indicator_${area.id}`,
        entityType: 'safe_zone_indicator'
      });
      
      safeIndicator.position.set(centerX, 4.5, centerZ);
      labelGroup.add(safeIndicator);
    }
    
    labelGroup.add(labelCube);
    
    return labelGroup;
  }

  /**
   * Toggle visualization on/off
   */
  private toggleVisualization(): void {
    this.isEnabled = !this.isEnabled;
    
    for (const biomeVisual of this.biomeVisuals.values()) {
      if (this.isEnabled) {
        this.showBiomeVisual(biomeVisual);
      } else {
        this.hideBiomeVisual(biomeVisual);
      }
    }
    
    console.log(`[RPGBiomeVisualizationSystem] Visualization ${this.isEnabled ? 'enabled' : 'disabled'}`);
  }

  /**
   * Show a specific area
   */
  private showArea(data: { areaId: string }): void {
    const biomeVisual = this.biomeVisuals.get(data.areaId);
    if (biomeVisual) {
      this.showBiomeVisual(biomeVisual);
    }
  }

  /**
   * Hide a specific area
   */
  private hideArea(data: { areaId: string }): void {
    const biomeVisual = this.biomeVisuals.get(data.areaId);
    if (biomeVisual) {
      this.hideBiomeVisual(biomeVisual);
    }
  }

  /**
   * Show biome visual
   */
  private showBiomeVisual(biomeVisual: BiomeVisual): void {
    if (!biomeVisual.isVisible) {
      this.world.stage?.scene?.add(biomeVisual.boundaryMesh);
      this.world.stage?.scene?.add(biomeVisual.labelMesh);
      biomeVisual.isVisible = true;
    }
  }

  /**
   * Hide biome visual
   */
  private hideBiomeVisual(biomeVisual: BiomeVisual): void {
    if (biomeVisual.isVisible) {
      this.world.stage?.scene?.remove(biomeVisual.boundaryMesh);
      this.world.stage?.scene?.remove(biomeVisual.labelMesh);
      biomeVisual.isVisible = false;
    }
  }

  /**
   * Update visualization (if needed for animations)
   */
  update(deltaTime: number): void {
    // Add any animation logic here if needed
    // For example, pulsing safe zone indicators or rotating labels
    
    if (!this.isEnabled) return;
    
    const time = Date.now() * 0.001;
    
    for (const biomeVisual of this.biomeVisuals.values()) {
      if (!biomeVisual.isVisible) continue;
      
      // Animate safe zone indicators with pulsing
      if (biomeVisual.area.safeZone && biomeVisual.labelMesh) {
        const pulseScale = 1 + Math.sin(time * 2) * 0.1;
        biomeVisual.labelMesh.scale.setScalar(pulseScale);
      }
      
      // Gentle rotation for labels
      if (biomeVisual.labelMesh) {
        biomeVisual.labelMesh.rotation.y = time * 0.2;
      }
    }
  }

  /**
   * Get visualization info for debugging
   */
  getVisualizationInfo(): any {
    return {
      isEnabled: this.isEnabled,
      totalBiomes: this.biomeVisuals.size,
      visibleBiomes: Array.from(this.biomeVisuals.values()).filter(b => b.isVisible).length,
      biomeList: Array.from(this.biomeVisuals.keys()),
      safeZones: Array.from(this.biomeVisuals.values())
        .filter(b => b.area.safeZone)
        .map(b => b.area.name),
      difficultyDistribution: this.getDifficultyDistribution()
    };
  }

  /**
   * Get difficulty distribution stats
   */
  private getDifficultyDistribution(): { [key: string]: number } {
    const distribution: { [key: string]: number } = {
      'safe_zones': 0,
      'level_1': 0,
      'level_2': 0,
      'level_3': 0
    };
    
    for (const biomeVisual of this.biomeVisuals.values()) {
      if (biomeVisual.area.safeZone) {
        distribution.safe_zones++;
      } else {
        distribution[`level_${biomeVisual.area.difficultyLevel}`]++;
      }
    }
    
    return distribution;
  }

  /**
   * Public API methods
   */
  public enable(): void {
    if (!this.isEnabled) {
      this.toggleVisualization();
    }
  }

  public disable(): void {
    if (this.isEnabled) {
      this.toggleVisualization();
    }
  }

  public showAreaBoundaries(areaId: string): void {
    this.showArea({ areaId });
  }

  public hideAreaBoundaries(areaId: string): void {
    this.hideArea({ areaId });
  }

  public getAllAreaIds(): string[] {
    return Array.from(this.biomeVisuals.keys());
  }

  public getAreaInfo(areaId: string): WorldArea | null {
    const biomeVisual = this.biomeVisuals.get(areaId);
    return biomeVisual ? biomeVisual.area : null;
  }

  /**
   * Add PhysX collider to a mesh for raycasting and interactions
   */
  private addPhysXCollider(mesh: THREE.Mesh, config: {
    width: number; height: number; depth: number;
    entityId: string; entityType: string;
  }): void {
    // Create PhysX collider data that the physics system can use
    mesh.userData.physx = {
      type: 'box',
      size: { x: config.width, y: config.height, z: config.depth },
      collider: true,
      trigger: false,
      interactive: true
    };
    
    // Add interaction data
    mesh.userData.interactive = true;
    mesh.userData.clickable = true;
    mesh.userData.entityId = config.entityId;
    mesh.userData.entityType = config.entityType;
    
    console.log(`[RPGBiomeVisualizationSystem] Added PhysX collider to: ${config.entityId}`);
  }

  // Required System lifecycle methods
  async init(): Promise<void> {
    console.log('[RPGBiomeVisualizationSystem] Biome visualization system initialized');
  }

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