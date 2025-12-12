/**
 * InstancedMeshManager.ts - Instanced Mesh Rendering Optimization
 *
 * Manages Three.js InstancedMesh for efficiently rendering many copies of the same geometry.
 * Used for rendering large quantities of resources (trees, rocks) with minimal draw calls.
 *
 * **How Instancing Works:**
 * - Single mesh + geometry can render thousands of instances
 * - Each instance has its own transform (position, rotation, scale)
 * - GPU processes all instances in one draw call (massive performance gain)
 * - Example: 1000 trees = 1 draw call instead of 1000
 *
 * **Features:**
 * - Dynamic visibility culling based on distance from player
 * - Automatic instance pooling (show closest N instances)
 * - Per-type management (separate pools for trees, rocks, etc.)
 * - Entity ID tracking for interaction systems
 *
 * **Performance:**
 * - Configurable max visible instances per type (default: 1000)
 * - Configurable cull distance (default: 200m)
 * - Update interval throttling (default: 500ms)
 * - Uses temporary matrices to avoid allocations
 *
 * **Usage:**
 * ```ts
 * const manager = new InstancedMeshManager(scene, world);
 *
 * // Register a mesh type
 * manager.registerMesh('tree', treeGeometry, treeMaterial, 500);
 *
 * // Add instances
 * const id = manager.addInstance('tree', 'tree_1', position);
 *
 * // Manager automatically handles visibility culling
 * ```
 *
 * **Referenced by:** TerrainSystem (for resource rendering)
 */

import THREE from "../../extras/three/three";
import type { World } from "../../core/World";

/**
 * LOD level configuration
 */
interface LODLevel {
  distance: number;
  mesh: THREE.InstancedMesh;
  maxInstances: number;
}

/**
 * InstanceData - Internal tracking for a single instanced mesh type
 */
interface InstanceData {
  /** The Three.js InstancedMesh being managed */
  mesh: THREE.InstancedMesh;
  /** LOD levels for this mesh type (optional) */
  lodLevels?: LODLevel[];
  /** Current LOD assignments */
  lodAssignments?: Map<number, number>; // instanceId -> lodLevel
  /** Map from instance ID to matrix array index */
  instanceMap: Map<number, number>;
  /** Reverse map from matrix index to instance ID */
  reverseInstanceMap: Map<number, number>;
  /** Map from matrix index to entity ID (for interactions) */
  entityIdMap: Map<number, string>;
  /** Next available instance ID */
  nextInstanceId: number;
  /** Maximum number of visible instances */
  maxVisibleInstances: number;
  /** Per-type cull distance override */
  cullDistance: number;
  /** Fade start distance (percentage of cull distance) */
  fadeStartRatio: number;
  /** All instances (both visible and culled) */
  allInstances: Map<
    number,
    {
      entityId: string;
      position: THREE.Vector3;
      rotation?: THREE.Euler;
      scale?: THREE.Vector3;
      matrix: THREE.Matrix4;
      baseScale: THREE.Vector3;
      visible: boolean;
      distance: number;
      fadeScale: number;
      currentLOD: number;
    }
  >;
}

/**
 * InstancedMeshManager - Efficient Rendering of Many Identical Objects
 *
 * Provides GPU-accelerated rendering of large quantities of identical geometry
 * with automatic visibility culling and pooling.
 */
export class InstancedMeshManager {
  private scene: THREE.Scene;
  private instancedMeshes = new Map<string, InstanceData>();
  private dummy = new THREE.Object3D();
  private world?: World;
  private lastPlayerPosition = new THREE.Vector3();
  private updateInterval = 500; // Update visibility every 500ms
  private lastUpdateTime = 0;
  private maxInstancesPerType = 1000; // Max visible instances per type
  private cullDistance = 200; // Maximum distance to render instances
  private _tempMatrix = new THREE.Matrix4();
  private _tempVec3 = new THREE.Vector3();
  private didInitialVisibility = false;
  // PERFORMANCE: Cached array for visibility sorting to avoid allocation per update
  private _instancesWithDistanceCache: Array<
    [
      number,
      {
        entityId: string;
        position: THREE.Vector3;
        rotation?: THREE.Euler;
        scale?: THREE.Vector3;
        matrix: THREE.Matrix4;
        visible: boolean;
        distance: number;
      },
    ]
  > = [];

  /**
   * Create a new InstancedMeshManager
   *
   * @param scene - Three.js scene to add instanced meshes to
   * @param world - Optional world reference for player position tracking
   */
  constructor(scene: THREE.Scene, world?: World) {
    this.scene = scene;
    this.world = world;
  }

  /**
   * Register a mesh type for instanced rendering.
   *
   * @param type - Unique identifier for this mesh type (e.g., 'oak_tree', 'iron_ore')
   * @param geometry - Shared geometry for all instances
   * @param material - Shared material for all instances
   * @param count - Optional max visible instances (default: maxInstancesPerType)
   * @param typeCullDistance - Optional per-type cull distance (default: global cullDistance)
   */
  registerMesh(
    type: string,
    geometry: THREE.BufferGeometry,
    material: THREE.Material,
    count?: number,
    typeCullDistance?: number,
  ): void {
    if (this.instancedMeshes.has(type)) {
      console.warn(
        `[InstancedMeshManager] Mesh type "${type}" is already registered.`,
      );
      return;
    }

    // Use the provided count or default to maxInstancesPerType
    const visibleCount = Math.min(
      count || this.maxInstancesPerType,
      this.maxInstancesPerType,
    );
    const mesh = new THREE.InstancedMesh(geometry, material, visibleCount);
    mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    mesh.count = 0; // Start with no visible instances
    // Disable frustum culling since InstancedMesh bounding volumes ignore per-instance transforms
    mesh.frustumCulled = false;
    this.scene.add(mesh);

    this.instancedMeshes.set(type, {
      mesh,
      lodLevels: undefined,
      lodAssignments: undefined,
      instanceMap: new Map(),
      reverseInstanceMap: new Map(),
      entityIdMap: new Map(),
      nextInstanceId: 0,
      maxVisibleInstances: visibleCount,
      cullDistance: typeCullDistance ?? this.cullDistance,
      fadeStartRatio: 0.8, // Start fading at 80% of cull distance
      allInstances: new Map(),
    });
  }

  /**
   * Register LOD levels for a mesh type.
   * Allows automatic switching between detail levels based on distance.
   *
   * @param type - Mesh type (must be registered first)
   * @param lodConfigs - Array of LOD configurations, sorted by distance
   */
  registerLODLevels(
    type: string,
    lodConfigs: Array<{
      distance: number;
      geometry: THREE.BufferGeometry;
      material: THREE.Material;
      maxInstances?: number;
    }>,
  ): void {
    const data = this.instancedMeshes.get(type);
    if (!data) return;

    // Sort by distance
    const sorted = [...lodConfigs].sort((a, b) => a.distance - b.distance);

    data.lodLevels = sorted.map((config) => {
      const lodMesh = new THREE.InstancedMesh(
        config.geometry,
        config.material,
        config.maxInstances || this.maxInstancesPerType,
      );
      lodMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
      lodMesh.count = 0;
      lodMesh.frustumCulled = false;
      this.scene.add(lodMesh);

      return {
        distance: config.distance,
        mesh: lodMesh,
        maxInstances: config.maxInstances || this.maxInstancesPerType,
      };
    });

    data.lodAssignments = new Map();
  }

  /**
   * Get the appropriate LOD level for a distance
   */
  private getLODLevelForDistance(
    lodLevels: LODLevel[],
    distance: number,
  ): number {
    for (let i = lodLevels.length - 1; i >= 0; i--) {
      if (distance >= lodLevels[i].distance) {
        return i;
      }
    }
    return 0; // Default to highest detail
  }

  /**
   * Add a new instance to render.
   *
   * @param type - Mesh type (must be registered first)
   * @param entityId - Entity ID for interaction tracking
   * @param position - World position
   * @param rotation - Optional rotation
   * @param scale - Optional scale
   * @returns Instance ID or null if type not registered
   */
  addInstance(
    type: string,
    entityId: string,
    position: THREE.Vector3,
    rotation?: THREE.Euler,
    scale?: THREE.Vector3,
  ): number | null {
    const data = this.instancedMeshes.get(type);
    if (!data) {
      console.error(
        `[InstancedMeshManager] No mesh registered for type "${type}".`,
      );
      return null;
    }

    const instanceId = data.nextInstanceId++;

    // Create the transformation matrix
    this.dummy.position.copy(position);
    if (rotation) this.dummy.rotation.copy(rotation);
    else this.dummy.rotation.set(0, 0, 0);
    if (scale) this.dummy.scale.copy(scale);
    else this.dummy.scale.set(1, 1, 1);
    this.dummy.updateMatrix();

    // Store the instance data using primitive values to reduce GC pressure
    const baseScale = scale
      ? new THREE.Vector3(scale.x, scale.y, scale.z)
      : new THREE.Vector3(1, 1, 1);

    data.allInstances.set(instanceId, {
      entityId,
      position: new THREE.Vector3(position.x, position.y, position.z),
      rotation: rotation
        ? new THREE.Euler(rotation.x, rotation.y, rotation.z, rotation.order)
        : undefined,
      scale: scale ? new THREE.Vector3(scale.x, scale.y, scale.z) : undefined,
      matrix: this.dummy.matrix.clone(),
      baseScale,
      visible: false,
      distance: Infinity,
      fadeScale: 1.0,
      currentLOD: 0,
    });

    return instanceId;
  }

  /**
   * Remove an instance from rendering.
   *
   * @param type - Mesh type
   * @param instanceId - Instance ID returned from addInstance()
   */
  removeInstance(type: string, instanceId: number): void {
    const data = this.instancedMeshes.get(type);
    if (!data) return;

    // Remove from all instances
    data.allInstances.delete(instanceId);

    // If this instance was visible, we need to update visibility
    const indexToRemove = data.instanceMap.get(instanceId);
    if (indexToRemove !== undefined) {
      const lastIndex = data.mesh.count - 1;

      if (indexToRemove !== lastIndex) {
        // Swap with the last element
        const lastMatrix = this._tempMatrix;
        data.mesh.getMatrixAt(lastIndex, lastMatrix);
        data.mesh.setMatrixAt(indexToRemove, lastMatrix);

        // Update the mapping for the swapped instance
        const lastInstanceId = data.reverseInstanceMap.get(lastIndex);
        if (lastInstanceId !== undefined) {
          data.instanceMap.set(lastInstanceId, indexToRemove);
          data.reverseInstanceMap.set(indexToRemove, lastInstanceId);
        }

        const lastEntityId = data.entityIdMap.get(lastIndex);
        if (lastEntityId) {
          data.entityIdMap.set(indexToRemove, lastEntityId);
        }
      }

      data.mesh.count--;
      data.mesh.instanceMatrix.needsUpdate = true;
      data.instanceMap.delete(instanceId);
      data.reverseInstanceMap.delete(lastIndex);
      data.entityIdMap.delete(lastIndex);

      // Update visibility to potentially show another instance
      this.updateInstanceVisibility(type);
    }
  }

  /**
   * Get entity ID for an instance.
   *
   * @param type - Mesh type
   * @param instanceIndex - Matrix array index (not instance ID)
   * @returns Entity ID or undefined
   */
  getEntityId(type: string, instanceIndex: number): string | undefined {
    const data = this.instancedMeshes.get(type);
    return data ? data.entityIdMap.get(instanceIndex) : undefined;
  }

  /**
   * Get all registered instanced meshes.
   * @returns Array of InstancedMesh objects
   */
  getMeshes(): THREE.InstancedMesh[] {
    return Array.from(this.instancedMeshes.values()).map((data) => data.mesh);
  }

  /**
   * Update which instances are visible based on distance from player.
   * Shows the closest N instances up to maxVisibleInstances.
   */
  private updateInstanceVisibility(
    type: string,
    playerPos?: THREE.Vector3,
  ): void {
    const data = this.instancedMeshes.get(type);
    if (!data || data.allInstances.size === 0) return;

    // Use provided position or get player position
    if (!playerPos) {
      playerPos = this.getPlayerPosition() || undefined;
      if (!playerPos) {
        // Use temp vector at origin as fallback (avoid allocation)
        playerPos = this._tempVec3.set(0, 0, 0);
      }
    }

    // Calculate distances and fade values for all instances
    // PERFORMANCE: Reuse cached array to avoid allocation per update
    const typeCullDistance = data.cullDistance;
    const fadeStartDist = typeCullDistance * data.fadeStartRatio;
    this._instancesWithDistanceCache.length = 0;

    for (const [id, instance] of data.allInstances) {
      instance.distance = instance.position.distanceTo(playerPos);

      // Only consider instances within the per-type cull distance
      if (instance.distance <= typeCullDistance) {
        // Calculate fade scale based on distance
        if (instance.distance > fadeStartDist) {
          // Fade out from fadeStartDist to cullDistance
          const fadeProgress =
            (instance.distance - fadeStartDist) /
            (typeCullDistance - fadeStartDist);
          instance.fadeScale = 1.0 - fadeProgress; // 1 -> 0
        } else {
          instance.fadeScale = 1.0;
        }

        this._instancesWithDistanceCache.push([id, instance]);
      }
    }
    const instancesWithDistance = this._instancesWithDistanceCache;

    // Sort by distance
    instancesWithDistance.sort((a, b) => a[1].distance - b[1].distance);

    // Clear current mappings
    data.instanceMap.clear();
    data.reverseInstanceMap.clear();
    data.entityIdMap.clear();

    // Update visible instances (take the nearest ones up to maxVisibleInstances)
    let visibleCount = 0;
    for (
      let i = 0;
      i < instancesWithDistance.length &&
      visibleCount < data.maxVisibleInstances;
      i++
    ) {
      const [instanceId, instance] = instancesWithDistance[i];

      // Apply fade scale to the matrix
      if (instance.fadeScale < 1.0) {
        // Rebuild matrix with faded scale
        this.dummy.position.copy(instance.position);
        if (instance.rotation) this.dummy.rotation.copy(instance.rotation);
        else this.dummy.rotation.set(0, 0, 0);

        // Apply fade to scale
        const fadedScale = instance.fadeScale;
        this.dummy.scale.set(
          instance.baseScale.x * fadedScale,
          instance.baseScale.y * fadedScale,
          instance.baseScale.z * fadedScale,
        );
        this.dummy.updateMatrix();
        data.mesh.setMatrixAt(visibleCount, this.dummy.matrix);
      } else {
        // Use cached matrix for full-scale instances
        data.mesh.setMatrixAt(visibleCount, instance.matrix);
      }

      // Update mappings
      data.instanceMap.set(instanceId, visibleCount);
      data.reverseInstanceMap.set(visibleCount, instanceId);
      data.entityIdMap.set(visibleCount, instance.entityId);

      instance.visible = true;
      visibleCount++;
    }

    // Mark remaining instances as not visible
    for (let i = visibleCount; i < instancesWithDistance.length; i++) {
      instancesWithDistance[i][1].visible = false;
    }

    // Update mesh count and mark for update
    data.mesh.count = visibleCount;
    data.mesh.instanceMatrix.needsUpdate = true;
  }

  /**
   * Update visibility for all mesh types.
   * Call this periodically (not every frame) to maintain performance.
   */
  updateAllInstanceVisibility(force = false): void {
    const now = Date.now();
    if (!force && now - this.lastUpdateTime < this.updateInterval) {
      return; // Don't update too frequently
    }
    this.lastUpdateTime = now;

    let playerPos = this.getPlayerPosition();

    // If no player exists yet, use origin (0, 0, 0) as default position
    // This ensures instances near spawn are visible even before player spawns
    if (!playerPos) {
      // Player not loaded yet - use origin for visibility update
      playerPos = this._tempVec3.set(0, 0, 0);
    }

    // Force one full update the first time we have a player position
    if (!this.didInitialVisibility) {
      this.didInitialVisibility = true;
      for (const type of this.instancedMeshes.keys()) {
        this.updateInstanceVisibility(type, playerPos);
      }
      return;
    }

    // Only update if player has moved significantly or forced
    if (force || playerPos.distanceTo(this.lastPlayerPosition) > 10) {
      this.lastPlayerPosition.copy(playerPos);

      // Update visibility for all types
      for (const type of this.instancedMeshes.keys()) {
        this.updateInstanceVisibility(type, playerPos);
      }
    }
  }

  /**
   * Get current player position from the world
   */
  private getPlayerPosition(): THREE.Vector3 | null {
    if (!this.world) return null;

    const players = this.world.getPlayers();
    if (!players || players.length === 0) return null;

    const player = players[0]; // Use first player
    if (player.node?.position) {
      return this._tempVec3.set(
        player.node.position.x,
        player.node.position.y,
        player.node.position.z,
      );
    }

    return null;
  }

  /**
   * Set world reference for player position tracking.
   * @param world - World instance
   */
  setWorld(world: World): void {
    this.world = world;
  }

  /**
   * Configure pooling and culling parameters.
   *
   * @param config - Configuration object
   * @param config.maxInstancesPerType - Max visible instances per mesh type
   * @param config.cullDistance - Distance beyond which instances are hidden
   * @param config.updateInterval - Milliseconds between visibility updates
   */
  setPoolingConfig(config: {
    maxInstancesPerType?: number;
    cullDistance?: number;
    updateInterval?: number;
  }): void {
    if (config.maxInstancesPerType !== undefined) {
      this.maxInstancesPerType = config.maxInstancesPerType;
    }
    if (config.cullDistance !== undefined) {
      this.cullDistance = config.cullDistance;
      // Update per-type cull distances for types that haven't been customized
      for (const data of this.instancedMeshes.values()) {
        if (data.cullDistance === this.cullDistance) {
          data.cullDistance = config.cullDistance;
        }
      }
    }
    if (config.updateInterval !== undefined) {
      this.updateInterval = config.updateInterval;
    }

    // Force an immediate update after config change
    this.lastUpdateTime = 0;
    this.updateAllInstanceVisibility();
  }

  /**
   * Set cull distance for a specific mesh type.
   *
   * @param type - Mesh type
   * @param distance - Cull distance in world units
   */
  setTypeCullDistance(type: string, distance: number): void {
    const data = this.instancedMeshes.get(type);
    if (data) {
      data.cullDistance = distance;
      this.updateInstanceVisibility(type);
    }
  }

  /**
   * Get statistics for all mesh types.
   *
   * @returns Object mapping mesh type to { total, visible, maxVisible }
   */
  getPoolingStats(): {
    [type: string]: { total: number; visible: number; maxVisible: number };
  } {
    const stats: {
      [type: string]: { total: number; visible: number; maxVisible: number };
    } = {};

    for (const [type, data] of this.instancedMeshes) {
      stats[type] = {
        total: data.allInstances.size,
        visible: data.mesh.count,
        maxVisible: data.maxVisibleInstances,
      };
    }

    return stats;
  }

  /**
   * Clean up all resources.
   * Disposes geometries, materials, and removes meshes from scene.
   */
  dispose(): void {
    for (const data of this.instancedMeshes.values()) {
      this.scene.remove(data.mesh);
      data.mesh.geometry.dispose();
      if (data.mesh.material instanceof THREE.Material) {
        data.mesh.material.dispose();
      } else if (Array.isArray(data.mesh.material)) {
        for (const mat of data.mesh.material) {
          mat.dispose();
        }
      }
      data.mesh.dispose();
    }
    this.instancedMeshes.clear();
    this._instancesWithDistanceCache.length = 0;
  }
}
