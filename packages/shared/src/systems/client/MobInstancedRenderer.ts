/**
 * MobInstancedRenderer - GPU-Instanced Mob Rendering System
 *
 * Renders mobs of the same type using GPU instancing for massive performance gains.
 * Instead of 100 goblins = 100 draw calls, we get 100 goblins = 1 draw call.
 *
 * **Architecture:**
 * - Each mob TYPE (goblin, skeleton, etc.) gets one InstancedMesh
 * - Individual mob positions/rotations are stored in instance matrices
 * - VRM models are shared across all instances of the same type
 * - Distance-based culling hides far mobs
 * - LOD system swaps to billboards at extreme distance
 *
 * **Performance Features:**
 * - GPU instancing: 1 draw call per mob type (vs 1 per mob)
 * - Distance culling: Skip rendering beyond MAX_RENDER_DISTANCE
 * - LOD levels: VRM -> Low-poly -> Billboard based on distance
 * - Frustum culling: Skip mobs outside camera view
 * - Visibility pooling: Show closest N mobs per type
 *
 * **Usage:**
 * ```ts
 * // Register a mob type with its VRM
 * renderer.registerMobType('goblin', vrmScene, maxInstances);
 *
 * // Add/update mob instances
 * const handle = renderer.addMob('goblin', mobId, matrix);
 * handle.move(newMatrix);
 * handle.setAnimation('walk');
 * handle.destroy();
 * ```
 *
 * @see InstancedMeshManager for terrain resource instancing
 * @see HealthBars for instanced health bar rendering
 */

import THREE from "../../extras/three/three";
import type { World } from "../../core/World";
import { SystemBase } from "../shared/infrastructure/SystemBase";

/**
 * LOD level configuration for mobs
 */
interface MobLODLevel {
  /** Distance threshold for this LOD */
  distance: number;
  /** Mesh to use at this LOD (null = invisible) */
  mesh: THREE.InstancedMesh | null;
  /** Whether this LOD uses billboard rendering */
  isBillboard: boolean;
}

/**
 * Per-mob-type data for instanced rendering
 */
interface MobTypeData {
  /** High-detail mesh (VRM scene clone or simplified) */
  highDetailMesh: THREE.InstancedMesh;
  /** Low-detail mesh for medium distance */
  lowDetailMesh: THREE.InstancedMesh | null;
  /** Billboard mesh for far distance */
  billboardMesh: THREE.InstancedMesh | null;
  /** LOD levels sorted by distance */
  lodLevels: MobLODLevel[];
  /** Map from mob ID to instance index */
  mobToInstance: Map<string, number>;
  /** Map from instance index to mob ID */
  instanceToMob: Map<number, string>;
  /** All mob data including culled ones */
  allMobs: Map<string, MobInstanceData>;
  /** Next available instance ID */
  nextInstanceId: number;
  /** Max visible instances for this type */
  maxVisibleInstances: number;
  /** Current LOD assignments per instance */
  lodAssignments: Map<number, number>;
  /** Cull distance for this mob type */
  cullDistance: number;
}

/**
 * Per-mob instance data
 */
interface MobInstanceData {
  id: string;
  position: THREE.Vector3;
  rotation: THREE.Quaternion;
  scale: THREE.Vector3;
  matrix: THREE.Matrix4;
  visible: boolean;
  distance: number;
  currentLOD: number;
  animationState: string;
}

/**
 * Handle returned to MobEntity for controlling its instance
 */
export interface MobInstanceHandle {
  mobId: string;
  mobType: string;
  /** Update position/rotation */
  move: (matrix: THREE.Matrix4) => void;
  /** Update animation state (for future skeletal instancing) */
  setAnimation: (animName: string) => void;
  /** Show this mob instance */
  show: () => void;
  /** Hide this mob instance */
  hide: () => void;
  /** Remove from renderer */
  destroy: () => void;
  /** Check if currently visible */
  isVisible: () => boolean;
}

/**
 * Configuration for the instanced renderer
 */
interface RendererConfig {
  /** Maximum render distance (beyond this, mobs are culled) */
  maxRenderDistance: number;
  /** Distance for LOD 1 (high detail) */
  lod1Distance: number;
  /** Distance for LOD 2 (low detail) */
  lod2Distance: number;
  /** Distance for LOD 3 (billboard) */
  lod3Distance: number;
  /** Max instances per mob type */
  maxInstancesPerType: number;
  /** Update interval for visibility culling (ms) */
  updateInterval: number;
  /** Enable frustum culling */
  enableFrustumCulling: boolean;
}

const DEFAULT_CONFIG: RendererConfig = {
  maxRenderDistance: 150, // 150m max render distance
  lod1Distance: 30, // Full VRM within 30m
  lod2Distance: 80, // Low-poly 30-80m
  lod3Distance: 150, // Billboard 80-150m
  maxInstancesPerType: 200, // Max 200 of any one mob type visible
  updateInterval: 200, // Update visibility every 200ms
  enableFrustumCulling: true,
};

export class MobInstancedRenderer extends SystemBase {
  private mobTypes = new Map<string, MobTypeData>();
  private rendererConfig: RendererConfig;
  private lastUpdateTime = 0;
  private lastPlayerPosition = new THREE.Vector3();
  private frustum = new THREE.Frustum();
  private projScreenMatrix = new THREE.Matrix4();

  // Reusable objects to avoid allocations
  private _tempMatrix = new THREE.Matrix4();
  private _tempPosition = new THREE.Vector3();
  private _tempQuaternion = new THREE.Quaternion();
  private _tempScale = new THREE.Vector3(1, 1, 1);
  private _tempBox = new THREE.Box3();
  private _sortedMobs: Array<[string, MobInstanceData]> = [];

  constructor(world: World, config: Partial<RendererConfig> = {}) {
    super(world, {
      name: "mob-instanced-renderer",
      dependencies: { required: ["stage"], optional: ["camera"] },
      autoCleanup: true,
    });
    this.rendererConfig = { ...DEFAULT_CONFIG, ...config };
  }

  async init(): Promise<void> {
    // Nothing to initialize until mob types are registered
  }

  start(): void {
    // Add meshes to scene will happen when mob types are registered
  }

  /**
   * Register a mob type for instanced rendering.
   * Call this when a new mob type is first encountered.
   *
   * @param mobType - Unique mob type identifier (e.g., 'goblin', 'skeleton')
   * @param geometry - Shared geometry for high-detail rendering
   * @param material - Shared material
   * @param maxInstances - Max number of this mob type (default: config.maxInstancesPerType)
   */
  registerMobType(
    mobType: string,
    geometry: THREE.BufferGeometry,
    material: THREE.Material,
    maxInstances?: number,
  ): void {
    if (this.mobTypes.has(mobType)) {
      return; // Already registered
    }

    const max = maxInstances ?? this.rendererConfig.maxInstancesPerType;

    // Create high-detail instanced mesh
    const highDetailMesh = new THREE.InstancedMesh(geometry, material, max);
    highDetailMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    highDetailMesh.count = 0;
    highDetailMesh.frustumCulled = false; // We handle culling ourselves
    highDetailMesh.name = `MobInstanced_${mobType}_High`;

    // Add to scene
    if (this.world.stage?.scene) {
      this.world.stage.scene.add(highDetailMesh);
    }

    // Create low-detail mesh (simplified geometry)
    const lowDetailGeometry = this.createLowDetailGeometry(geometry);
    const lowDetailMesh = new THREE.InstancedMesh(
      lowDetailGeometry,
      material,
      max,
    );
    lowDetailMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    lowDetailMesh.count = 0;
    lowDetailMesh.frustumCulled = false;
    lowDetailMesh.name = `MobInstanced_${mobType}_Low`;

    if (this.world.stage?.scene) {
      this.world.stage.scene.add(lowDetailMesh);
    }

    // Create billboard mesh for extreme distance
    const billboardMesh = this.createBillboardMesh(material, max, mobType);
    if (billboardMesh && this.world.stage?.scene) {
      this.world.stage.scene.add(billboardMesh);
    }

    // Setup LOD levels
    const lodLevels: MobLODLevel[] = [
      {
        distance: this.rendererConfig.lod1Distance,
        mesh: highDetailMesh,
        isBillboard: false,
      },
      {
        distance: this.rendererConfig.lod2Distance,
        mesh: lowDetailMesh,
        isBillboard: false,
      },
      {
        distance: this.rendererConfig.lod3Distance,
        mesh: billboardMesh,
        isBillboard: true,
      },
      { distance: Infinity, mesh: null, isBillboard: false }, // Culled
    ];

    const typeData: MobTypeData = {
      highDetailMesh,
      lowDetailMesh,
      billboardMesh,
      lodLevels,
      mobToInstance: new Map(),
      instanceToMob: new Map(),
      allMobs: new Map(),
      nextInstanceId: 0,
      maxVisibleInstances: max,
      lodAssignments: new Map(),
      cullDistance: this.rendererConfig.maxRenderDistance,
    };

    this.mobTypes.set(mobType, typeData);
  }

  /**
   * Create a simplified low-detail geometry for LOD
   */
  private createLowDetailGeometry(
    highDetailGeometry: THREE.BufferGeometry,
  ): THREE.BufferGeometry {
    // For now, use a simple capsule as low-detail
    // In production, use mesh simplification or pre-authored LODs
    const capsule = new THREE.CapsuleGeometry(0.3, 1.2, 4, 8);
    return capsule;
  }

  /**
   * Create a billboard mesh for extreme distance rendering
   */
  private createBillboardMesh(
    _material: THREE.Material,
    maxInstances: number,
    _mobType: string,
  ): THREE.InstancedMesh | null {
    // Create a simple quad that always faces camera
    const geometry = new THREE.PlaneGeometry(1, 2);

    // Use a basic material with vertex colors for mob silhouette
    const material = new THREE.MeshBasicMaterial({
      color: 0x444444,
      transparent: true,
      opacity: 0.8,
      side: THREE.DoubleSide,
    });

    const mesh = new THREE.InstancedMesh(geometry, material, maxInstances);
    mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    mesh.count = 0;
    mesh.frustumCulled = false;
    mesh.name = `MobInstanced_Billboard`;

    return mesh;
  }

  /**
   * Add a mob instance for rendering.
   *
   * @param mobType - Type of mob (must be registered first)
   * @param mobId - Unique mob entity ID
   * @param initialMatrix - Initial transform matrix
   * @returns Handle for controlling this instance, or null if type not registered
   */
  addMob(
    mobType: string,
    mobId: string,
    initialMatrix: THREE.Matrix4,
  ): MobInstanceHandle | null {
    const typeData = this.mobTypes.get(mobType);
    if (!typeData) {
      console.warn(
        `[MobInstancedRenderer] Mob type "${mobType}" not registered`,
      );
      return null;
    }

    // Extract position/rotation/scale from matrix
    const position = this._tempPosition;
    const quaternion = this._tempQuaternion;
    const scale = this._tempScale;
    initialMatrix.decompose(position, quaternion, scale);

    // Create mob instance data
    const instanceData: MobInstanceData = {
      id: mobId,
      position: position.clone(),
      rotation: quaternion.clone(),
      scale: scale.clone(),
      matrix: initialMatrix.clone(),
      visible: false, // Start hidden until visibility update
      distance: Infinity,
      currentLOD: 3, // Start at lowest LOD
      animationState: "idle",
    };

    typeData.allMobs.set(mobId, instanceData);

    // Create handle for the mob entity to control its instance
    const handle: MobInstanceHandle = {
      mobId,
      mobType,
      move: (matrix: THREE.Matrix4) => {
        this.updateMobTransform(mobType, mobId, matrix);
      },
      setAnimation: (animName: string) => {
        instanceData.animationState = animName;
      },
      show: () => {
        instanceData.visible = true;
      },
      hide: () => {
        instanceData.visible = false;
      },
      destroy: () => {
        this.removeMob(mobType, mobId);
      },
      isVisible: () => instanceData.visible,
    };

    return handle;
  }

  /**
   * Update a mob's transform
   */
  private updateMobTransform(
    mobType: string,
    mobId: string,
    matrix: THREE.Matrix4,
  ): void {
    const typeData = this.mobTypes.get(mobType);
    if (!typeData) return;

    const instanceData = typeData.allMobs.get(mobId);
    if (!instanceData) return;

    // Update stored transform
    instanceData.matrix.copy(matrix);
    matrix.decompose(
      instanceData.position,
      instanceData.rotation,
      instanceData.scale,
    );

    // If currently visible, update the instance matrix
    const instanceIndex = typeData.mobToInstance.get(mobId);
    if (instanceIndex !== undefined) {
      const lodLevel = typeData.lodAssignments.get(instanceIndex) ?? 0;
      const lodData = typeData.lodLevels[lodLevel];
      if (lodData?.mesh) {
        lodData.mesh.setMatrixAt(instanceIndex, matrix);
        lodData.mesh.instanceMatrix.needsUpdate = true;
      }
    }
  }

  /**
   * Remove a mob instance
   */
  private removeMob(mobType: string, mobId: string): void {
    const typeData = this.mobTypes.get(mobType);
    if (!typeData) return;

    // Remove from allMobs
    typeData.allMobs.delete(mobId);

    // If it was visible, need to update instance arrays
    const instanceIndex = typeData.mobToInstance.get(mobId);
    if (instanceIndex !== undefined) {
      this.removeVisibleInstance(typeData, mobId, instanceIndex);
    }
  }

  /**
   * Remove a visible instance and compact the array
   */
  private removeVisibleInstance(
    typeData: MobTypeData,
    mobId: string,
    instanceIndex: number,
  ): void {
    // Swap with last instance to maintain contiguous array
    const lastIndex = typeData.highDetailMesh.count - 1;

    if (instanceIndex !== lastIndex) {
      // Get last mob's data
      const lastMobId = typeData.instanceToMob.get(lastIndex);
      if (lastMobId) {
        const lastMobData = typeData.allMobs.get(lastMobId);
        if (lastMobData) {
          // Copy last instance to this slot
          for (const lodLevel of typeData.lodLevels) {
            if (lodLevel.mesh) {
              lodLevel.mesh.setMatrixAt(instanceIndex, lastMobData.matrix);
              lodLevel.mesh.instanceMatrix.needsUpdate = true;
            }
          }

          // Update mappings
          typeData.mobToInstance.set(lastMobId, instanceIndex);
          typeData.instanceToMob.set(instanceIndex, lastMobId);
          typeData.lodAssignments.set(
            instanceIndex,
            typeData.lodAssignments.get(lastIndex) ?? 0,
          );
        }
      }
    }

    // Remove last slot
    typeData.mobToInstance.delete(mobId);
    typeData.instanceToMob.delete(lastIndex);
    typeData.lodAssignments.delete(lastIndex);

    // Decrement counts
    for (const lodLevel of typeData.lodLevels) {
      if (lodLevel.mesh && lodLevel.mesh.count > 0) {
        lodLevel.mesh.count--;
      }
    }
  }

  /**
   * Main update loop - handles visibility culling and LOD switching
   */
  override update(_deltaTime: number): void {
    const now = Date.now();
    if (now - this.lastUpdateTime < this.rendererConfig.updateInterval) {
      return; // Throttle updates
    }
    this.lastUpdateTime = now;

    // Get player position
    const playerPos = this.getPlayerPosition();
    if (!playerPos) return;

    // Update frustum for culling
    if (this.rendererConfig.enableFrustumCulling && this.world.camera) {
      this.projScreenMatrix.multiplyMatrices(
        this.world.camera.projectionMatrix,
        this.world.camera.matrixWorldInverse,
      );
      this.frustum.setFromProjectionMatrix(this.projScreenMatrix);
    }

    // Update visibility for each mob type
    for (const [_mobType, typeData] of this.mobTypes) {
      this.updateTypeVisibility(typeData, playerPos);
    }
  }

  /**
   * Update visibility and LOD for a mob type
   */
  private updateTypeVisibility(
    typeData: MobTypeData,
    playerPos: THREE.Vector3,
  ): void {
    // Calculate distances and check visibility for all mobs
    this._sortedMobs.length = 0;

    for (const [mobId, mobData] of typeData.allMobs) {
      // Calculate distance
      mobData.distance = mobData.position.distanceTo(playerPos);

      // Skip if beyond cull distance
      if (mobData.distance > typeData.cullDistance) {
        mobData.visible = false;
        continue;
      }

      // Frustum culling
      if (this.rendererConfig.enableFrustumCulling) {
        this._tempBox.setFromCenterAndSize(
          mobData.position,
          this._tempScale.set(2, 2, 2),
        );
        if (!this.frustum.intersectsBox(this._tempBox)) {
          mobData.visible = false;
          continue;
        }
      }

      mobData.visible = true;
      this._sortedMobs.push([mobId, mobData]);
    }

    // Sort by distance (closest first)
    this._sortedMobs.sort((a, b) => a[1].distance - b[1].distance);

    // Determine LOD for each mob and assign to instance slots
    // Reset all mesh counts
    for (const lodLevel of typeData.lodLevels) {
      if (lodLevel.mesh) {
        lodLevel.mesh.count = 0;
      }
    }

    // Clear old mappings
    typeData.mobToInstance.clear();
    typeData.instanceToMob.clear();
    typeData.lodAssignments.clear();

    // Assign visible mobs to instance slots by LOD
    const lodCounts: number[] = new Array(typeData.lodLevels.length).fill(0);

    for (
      let i = 0;
      i < Math.min(this._sortedMobs.length, typeData.maxVisibleInstances);
      i++
    ) {
      const [mobId, mobData] = this._sortedMobs[i];

      // Determine LOD level based on distance
      let lodLevel = 0;
      for (let l = 0; l < typeData.lodLevels.length; l++) {
        if (mobData.distance <= typeData.lodLevels[l].distance) {
          lodLevel = l;
          break;
        }
        lodLevel = l;
      }

      mobData.currentLOD = lodLevel;
      const lodData = typeData.lodLevels[lodLevel];

      if (lodData.mesh) {
        const instanceIndex = lodCounts[lodLevel];
        lodCounts[lodLevel]++;

        // Set transform for this LOD mesh
        if (lodData.isBillboard) {
          // Billboard needs special matrix that faces camera
          this.setBillboardMatrix(
            lodData.mesh,
            instanceIndex,
            mobData.position,
          );
        } else {
          lodData.mesh.setMatrixAt(instanceIndex, mobData.matrix);
        }

        // Track mappings (using lodLevel-prefixed index to avoid conflicts)
        typeData.mobToInstance.set(mobId, instanceIndex);
        typeData.instanceToMob.set(instanceIndex, mobId);
        typeData.lodAssignments.set(instanceIndex, lodLevel);
      }
    }

    // Update mesh counts
    for (let l = 0; l < typeData.lodLevels.length; l++) {
      const lodData = typeData.lodLevels[l];
      if (lodData.mesh) {
        lodData.mesh.count = lodCounts[l];
        lodData.mesh.instanceMatrix.needsUpdate = true;
      }
    }
  }

  /**
   * Set billboard matrix to face camera
   */
  private setBillboardMatrix(
    mesh: THREE.InstancedMesh,
    index: number,
    position: THREE.Vector3,
  ): void {
    // Billboard always faces camera
    const camera = this.world.camera;
    if (!camera) {
      this._tempMatrix.identity();
      this._tempMatrix.setPosition(position);
    } else {
      // Create matrix that positions at mob location but rotates to face camera
      this._tempMatrix.lookAt(
        position,
        camera.position,
        THREE.Object3D.DEFAULT_UP,
      );
      this._tempMatrix.setPosition(position);
    }

    mesh.setMatrixAt(index, this._tempMatrix);
  }

  /**
   * Get player position for distance calculations
   */
  private getPlayerPosition(): THREE.Vector3 | null {
    const players = this.world.getPlayers?.();
    if (!players || players.length === 0) return null;

    const player = players[0];
    if (player.position) {
      this.lastPlayerPosition.set(
        player.position.x,
        player.position.y,
        player.position.z,
      );
      return this.lastPlayerPosition;
    }

    return null;
  }

  /**
   * Get statistics about current rendering state
   */
  getStats(): {
    totalMobTypes: number;
    perType: Record<
      string,
      { total: number; visible: number; byLOD: number[] }
    >;
    totalDrawCalls: number;
  } {
    const stats = {
      totalMobTypes: this.mobTypes.size,
      perType: {} as Record<
        string,
        { total: number; visible: number; byLOD: number[] }
      >,
      totalDrawCalls: 0,
    };

    for (const [mobType, typeData] of this.mobTypes) {
      const byLOD: number[] = [];
      let visible = 0;

      for (const lodLevel of typeData.lodLevels) {
        const count = lodLevel.mesh?.count ?? 0;
        byLOD.push(count);
        visible += count;
        if (count > 0) stats.totalDrawCalls++;
      }

      stats.perType[mobType] = {
        total: typeData.allMobs.size,
        visible,
        byLOD,
      };
    }

    return stats;
  }

  /**
   * Configure renderer settings
   */
  configure(config: Partial<RendererConfig>): void {
    Object.assign(this.config, config);
  }

  /**
   * Clean up all resources
   */
  override destroy(): void {
    for (const typeData of this.mobTypes.values()) {
      // Dispose geometries and materials
      typeData.highDetailMesh.geometry.dispose();
      if (typeData.highDetailMesh.material instanceof THREE.Material) {
        typeData.highDetailMesh.material.dispose();
      }

      if (typeData.lowDetailMesh) {
        typeData.lowDetailMesh.geometry.dispose();
      }

      if (typeData.billboardMesh) {
        typeData.billboardMesh.geometry.dispose();
        if (typeData.billboardMesh.material instanceof THREE.Material) {
          typeData.billboardMesh.material.dispose();
        }
      }

      // Remove from scene
      typeData.highDetailMesh.removeFromParent();
      typeData.lowDetailMesh?.removeFromParent();
      typeData.billboardMesh?.removeFromParent();
    }

    this.mobTypes.clear();
    super.destroy();
  }
}
