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

import * as SkeletonUtils from "three/examples/jsm/utils/SkeletonUtils.js";
import THREE, {
  uniform,
  sub,
  add,
  mul,
  max,
  Fn,
  MeshStandardNodeMaterial,
  float,
  smoothstep,
  positionWorld,
  viewportCoordinate,
  abs,
  mod,
  floor,
  step,
} from "../../extras/three/three";
import type { World } from "../../core/World";
import { modelCache } from "./ModelCache";
import type {
  MobAnimationState,
  MobInstancedHandle,
} from "../../types/rendering/nodes";
import {
  AnimationLOD,
  ANIMATION_LOD_PRESETS,
  type AnimationLODResult,
  LOD_LEVEL,
  distanceSquaredXZ,
  getCameraPosition,
} from "./AnimationLOD";
import { csmLevels } from "../../systems/shared/world/Environment";
import { ImpostorManager, BakePriority } from "../../systems/shared/rendering";
import {
  createTSLImpostorMaterial,
  isTSLImpostorMaterial,
  type ImpostorBakeResult,
  type TSLImpostorMaterial,
} from "@hyperforge/impostor";
import { isGPUComputeAvailable, getGlobalCullingManager } from "../compute";

// ============================================================================
// IMPOSTOR CONFIGURATION
// ============================================================================

/**
 * TEMPORARY: Disable all mob/character impostors.
 * When true, mobs use GPU dissolve fade instead of impostor billboards.
 * Set to false to re-enable impostor system.
 */
const DISABLE_IMPOSTORS = true;

// ============================================================================
// MOB DISSOLVE MATERIAL TYPES
// ============================================================================

/**
 * Uniforms for mob dissolve material - updated per-frame.
 */
type MobDissolveUniforms = {
  playerPos: { value: THREE.Vector3 };
};

/**
 * Material with dissolve uniforms attached.
 */
type MobDissolveMaterial = THREE.Material & {
  _dissolveUniforms?: MobDissolveUniforms;
};

// ============================================================================
// VAT (VERTEX ANIMATION TEXTURE) TYPES
// ============================================================================
// STATUS: INFRASTRUCTURE ONLY - NOT YET INTEGRATED
//
// The VAT system provides GPU-driven animation by baking vertex positions into
// textures. The loader and types are implemented, but vertex shader integration
// is not complete. Currently, all animation uses CPU-based skeletal animation.
//
// To enable VAT:
// 1. Run: node scripts/bake-mob-vat.mjs --input models/goblin.glb --output assets/vat/
// 2. Implement VAT vertex shader sampling in createDissolveMaterial()
// 3. Add per-instance animation state/time attributes
// 4. Call loadVATData() when loading mob models
// ============================================================================

/**
 * VAT metadata loaded from .vat.json files.
 * Describes the layout of animation data in the VAT texture.
 * @internal Infrastructure - not yet integrated with runtime
 */
type VATMetadata = {
  version: number;
  modelName: string;
  vertexCount: number;
  totalFrames: number;
  textureWidth: number;
  textureHeight: number;
  format: string; // "RGBA32F"
  animations: Array<{
    name: string;
    frames: number;
    startFrame: number;
    duration: number;
    loop: boolean;
  }>;
};

/**
 * Animation index constants for VAT.
 * Maps to row offsets in the VAT texture.
 * @internal Infrastructure - not yet integrated with runtime
 */
const VAT_ANIMATION_INDEX = {
  IDLE: 0,
  WALK: 1,
  ATTACK: 2,
  DEATH: 3,
} as const;

/**
 * Loaded VAT data for a model, ready for GPU use.
 * @internal Infrastructure - not yet integrated with runtime
 */
type VATData = {
  metadata: VATMetadata;
  texture: THREE.DataTexture;
  /** Pre-computed frame offsets for each animation (in texture rows) */
  animationOffsets: Map<
    string,
    { start: number; frames: number; duration: number; loop: boolean }
  >;
};

/**
 * InstanceData - Internal tracking for a single instanced mesh type
 */
interface InstanceData {
  /** The Three.js InstancedMesh being managed */
  mesh: THREE.InstancedMesh;
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
  /** All instances (both visible and culled) */
  allInstances: Map<
    number,
    {
      entityId: string;
      position: THREE.Vector3;
      rotation?: THREE.Euler;
      scale?: THREE.Vector3;
      matrix: THREE.Matrix4;
      visible: boolean;
      distance: number;
      distanceSq?: number; // Squared distance for faster sorting
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
  private maxInstancesPerType = 200; // Max visible instances per type (Reduced for WebGL 16KB UBO limits)
  private cullDistance = 200; // Maximum distance to render instances
  private _tempMatrix = new THREE.Matrix4();
  private _tempVec3 = new THREE.Vector3();
  private didInitialVisibility = false;
  // OPTIMIZATION: Pre-allocated array for visibility sorting (avoids allocation per update)
  private _visibilitySortArray: Array<
    [
      string,
      {
        position: THREE.Vector3;
        matrix: THREE.Matrix4;
        distance: number;
        distanceSq?: number;
        visible: boolean;
        entityId: string;
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
   */
  registerMesh(
    type: string,
    geometry: THREE.BufferGeometry,
    material: THREE.Material,
    count?: number,
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
      instanceMap: new Map(),
      reverseInstanceMap: new Map(),
      entityIdMap: new Map(),
      nextInstanceId: 0,
      maxVisibleInstances: visibleCount,
      allInstances: new Map(),
    });
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

    // Store the instance data (always store, even if not immediately visible)
    data.allInstances.set(instanceId, {
      entityId,
      position: position.clone(),
      rotation: rotation?.clone(),
      scale: scale?.clone(),
      matrix: this.dummy.matrix.clone(),
      visible: false,
      distance: Infinity,
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
  private updateInstanceVisibility(type: string): void {
    const data = this.instancedMeshes.get(type);
    if (!data || data.allInstances.size === 0) return;

    const playerPos = this.getPlayerPosition();
    if (!playerPos) return;

    // OPTIMIZATION: Use squared distance to avoid sqrt (faster)
    // Calculate squared distances for all instances and filter by squared cull distance
    const cullDistanceSq = this.cullDistance * this.cullDistance;
    const instancesWithDistance: Array<
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
          distanceSq?: number; // Squared distance for sorting (optional in storage)
        },
      ]
    > = [];
    for (const [id, instance] of data.allInstances) {
      // Use squared distance (no sqrt needed)
      const dx = instance.position.x - playerPos.x;
      const dy = instance.position.y - playerPos.y;
      const dz = instance.position.z - playerPos.z;
      const distSq = dx * dx + dy * dy + dz * dz;

      // Only consider instances within the squared cull distance
      if (distSq <= cullDistanceSq) {
        // Store squared distance for sorting (faster than computing actual distance)
        instance.distanceSq = distSq;
        // Store actual distance for compatibility (only compute sqrt for visible instances)
        instance.distance = Math.sqrt(distSq);
        instancesWithDistance.push([id, instance]);
      }
    }

    // Sort by squared distance (equivalent to sorting by distance, but faster)
    // Use nullish coalescing since distanceSq is always set in the loop above
    instancesWithDistance.sort(
      (a, b) => (a[1].distanceSq ?? 0) - (b[1].distanceSq ?? 0),
    );

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

      // Set the matrix for this visible instance
      data.mesh.setMatrixAt(visibleCount, instance.matrix);

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

    const playerPos = this.getPlayerPosition();
    if (!playerPos) {
      // Player not loaded yet - skip visibility update silently
      return;
    }

    // Force one full update the first time we have a player position
    if (!this.didInitialVisibility) {
      this.didInitialVisibility = true;
      for (const type of this.instancedMeshes.keys()) {
        this.updateInstanceVisibility(type);
      }
      return;
    }

    // OPTIMIZATION: Use squared distance check (avoid sqrt)
    // Only update if player has moved significantly or forced
    const dx = playerPos.x - this.lastPlayerPosition.x;
    const dy = playerPos.y - this.lastPlayerPosition.y;
    const dz = playerPos.z - this.lastPlayerPosition.z;
    const moveDistSq = dx * dx + dy * dy + dz * dz;
    const moveThresholdSq = 10 * 10; // 10m threshold squared

    if (force || moveDistSq > moveThresholdSq) {
      this.lastPlayerPosition.copy(playerPos);

      // Update visibility for all types
      for (const type of this.instancedMeshes.keys()) {
        this.updateInstanceVisibility(type);
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
    }
    if (config.updateInterval !== undefined) {
      this.updateInterval = config.updateInterval;
    }

    // Force an immediate update after config change
    this.lastUpdateTime = 0;
    this.updateAllInstanceVisibility();
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
      data.mesh.dispose();
    }
    this.instancedMeshes.clear();
  }
}

// === Instanced Skinned Mesh (shared skeleton across instances) ===
class InstancedSkinnedMesh extends THREE.InstancedMesh {
  isSkinnedMesh = true;
  readonly isInstancedSkinnedMesh = true;
  skeleton: THREE.Skeleton;
  bindMatrix: THREE.Matrix4;
  bindMatrixInverse: THREE.Matrix4;
  bindMode: THREE.BindMode;

  constructor(
    geometry: THREE.BufferGeometry,
    material: THREE.Material | THREE.Material[],
    count: number,
    skeleton: THREE.Skeleton,
    bindMatrix: THREE.Matrix4,
    bindMode: THREE.BindMode,
  ) {
    super(geometry, material, count);
    this.skeleton = skeleton;
    this.bindMatrix = new THREE.Matrix4();
    this.bindMatrixInverse = new THREE.Matrix4();
    this.bindMode = bindMode;
    this.bind(this.skeleton, bindMatrix);
  }

  bind(skeleton: THREE.Skeleton, bindMatrix?: THREE.Matrix4): void {
    this.skeleton = skeleton;
    if (bindMatrix) {
      this.bindMatrix.copy(bindMatrix);
    } else {
      this.bindMatrix.copy(this.matrixWorld);
    }
    this.bindMatrixInverse.copy(this.bindMatrix).invert();
  }

  override updateMatrixWorld(force?: boolean): void {
    super.updateMatrixWorld(force ?? false);
    if (this.bindMode === THREE.AttachedBindMode) {
      this.bindMatrixInverse.copy(this.matrixWorld).invert();
    }
  }

  // Skeletons are updated once per group in MobInstancedRenderer.update().
}

type MobAnimationClips = {
  idle?: THREE.AnimationClip;
  walk?: THREE.AnimationClip;
};

/**
 * Rest pose data for freezing animation at distance.
 * Stores bone matrices from idle animation frame 0 for consistent frozen appearance.
 */
type RestPoseData = {
  /** Bone local matrices at rest pose (indexed by bone index) */
  boneMatrices: THREE.Matrix4[];
  /** Has rest pose been applied since entering frozen state? */
  applied: boolean;
};

type MobInstancedGroup = {
  key: string;
  state: MobAnimationState;
  variant: number;
  clip?: THREE.AnimationClip;
  mixer?: THREE.AnimationMixer;
  action?: THREE.AnimationAction;
  animationLOD: AnimationLOD;
  lodDistanceSq: number;
  lodLastUpdate: number;
  sourceScene: THREE.Object3D;
  skinnedMeshes: THREE.SkinnedMesh[];
  skeletons: THREE.Skeleton[];
  instancedMeshes: InstancedSkinnedMesh[];
  instances: Array<{ handle: MobInstancedHandle }>;
  instanceMap: Map<string, number>;
  capacity: number;
  dirty: boolean;
  /** Rest pose data for frozen animation state */
  restPose: RestPoseData;
  /** Whether this group is currently frozen (no animation updates) */
  isFrozen: boolean;
  /** Merged geometry (if multiple skinned meshes were merged) */
  mergedGeometry?: THREE.BufferGeometry;
  /** VRM humanoid for bone propagation (cloned per group) */
  vrmHumanoid?: VRMHumanoidLike;
};

/**
 * Imposter material type - supports both GLSL (WebGL) and TSL (WebGPU) materials.
 */
type ImposterMaterialType = THREE.ShaderMaterial | TSLImpostorMaterial;

/**
 * Imposter render data for a model.
 * Created once per model type and shared across all groups.
 * Uses OctahedralImpostor from @hyperforge/impostor for quality multi-view rendering.
 */
type MobImposterModel = {
  /** Pre-rendered imposter texture (from bake result) */
  texture: THREE.Texture;
  /** Billboard geometry (plane) */
  geometry: THREE.PlaneGeometry;
  /** Billboard material (GLSL or TSL impostor material from @hyperforge/impostor) */
  material: ImposterMaterialType;
  /** Instanced mesh for all imposters of this model */
  mesh: THREE.InstancedMesh;
  /** Instance index map (handle ID -> index) */
  instanceMap: Map<string, number>;
  /** Reverse map (index -> handle ID) for O(1) swap operations */
  reverseMap: Map<number, string>;
  /** Current count of active imposters */
  count: number;
  /** Capacity of the instanced mesh */
  capacity: number;
  /** Width of the mob (world units) */
  width: number;
  /** Height of the mob (world units) */
  height: number;
  /** ImpostorManager bake result for octahedral rendering */
  bakeResult: ImpostorBakeResult;
  /** Grid size X for octahedral sampling */
  gridSizeX: number;
  /** Grid size Y for octahedral sampling */
  gridSizeY: number;
};

/** VRM humanoid interface for bone propagation */
type VRMHumanoidLike = {
  update?: (delta: number) => void;
  clone?: () => VRMHumanoidLike;
  _rawHumanBones?: {
    humanBones?: Record<string, { node?: THREE.Object3D }>;
  };
  _normalizedHumanBones?: {
    humanBones?: Record<string, { node?: THREE.Object3D }>;
  };
};

type MobInstancedModel = {
  modelPath: string;
  templateScene: THREE.Object3D;
  clips: MobAnimationClips;
  supportsInstancing: boolean;
  groups: Map<string, MobInstancedGroup>;
  /** Imposter data for billboard rendering at distance */
  imposter: MobImposterModel | null;
  /** Bounding box dimensions for imposter sizing */
  boundingBox: THREE.Box3;
  /** VRM humanoid for bone propagation (normalized -> raw) */
  vrmHumanoid?: VRMHumanoidLike;
};

type MobInstanceRegistration = {
  id: string;
  modelPath: string;
  scale: { x: number; y: number; z: number };
  position: THREE.Vector3;
  quaternion: THREE.Quaternion;
  initialState: MobAnimationState;
};

// Scale for GLB models - VRM auto-normalizes to 1.6m, GLB uses manifest scale directly
// Set to 1 since models should be exported at correct scale
const MOB_MODEL_SCALE = 1;
const DEFAULT_MOB_VARIANTS = 3; // animation phase buckets per state

// Note: Imposter distances are now dynamic, initialized from shadow quality
// See MobInstancedRenderer._imposterDistance* variables

const mobInstancedRenderers = new WeakMap<World, MobInstancedRenderer>();

/**
 * MobInstancedRenderer - GPU instancing for animated skinned mobs.
 *
 * Uses a shared skeleton per animation group (idle/walk) to render many mobs in
 * a single draw call while keeping animation smooth and GPU-efficient.
 *
 * ## Optimization Tiers:
 * 1. **Full Animation** (0-30m): 60fps skeleton updates
 * 2. **Half-rate** (30-60m): 30fps skeleton updates
 * 3. **Quarter-rate** (60-80m): 15fps skeleton updates
 * 4. **Frozen** (80-100m): Static idle pose, zero CPU animation work
 * 5. **Imposter** (100-150m): 2D billboard, no 3D mesh
 * 6. **Culled** (150m+): Not rendered
 *
 * ## Mesh Merging:
 * Models with multiple SkinnedMeshes sharing the same skeleton are merged
 * into a single geometry, reducing draw calls from N to 1 per group.
 */
export class MobInstancedRenderer {
  private world: World;
  private models = new Map<string, MobInstancedModel>();
  private totalInstances = 0;
  private handles = new Map<string, MobInstancedHandle>();
  private readonly variantCount: number;
  private readonly _tempMatrix = new THREE.Matrix4();
  private readonly _tempScale = new THREE.Vector3();
  private readonly _tempPos = new THREE.Vector3();
  private readonly _tempQuat = new THREE.Quaternion();
  private readonly _tempEuler = new THREE.Euler();
  private readonly _tempVec3 = new THREE.Vector3();
  private readonly _tempBox = new THREE.Box3();
  private readonly _sharedMaterialCache = new Map<string, THREE.Material>();

  // Frustum culling - skip mobs outside camera view
  private readonly _frustum = new THREE.Frustum();
  private readonly _projScreenMatrix = new THREE.Matrix4();
  private readonly _lastCameraMatrix = new THREE.Matrix4();
  private readonly _boundingSphere = new THREE.Sphere();
  // Bounding radius for mob frustum tests (accounts for typical mob size + animation range)
  private readonly _mobBoundingRadius = 2.5; // meters

  // Dynamic distances - initialized from shadow quality settings (like vegetation)
  // These match vegetation system for consistent visual culling
  private _distancesInitialized = false;
  private _cullDistance = 200; // Will be set from shadow maxFar
  private _cullDistanceSq = 200 * 200;
  private _uncullDistance = 190; // 95% of cull distance (hysteresis)
  private _uncullDistanceSq = 190 * 190;
  private _fadeStartDistance = 180; // 90% of cull distance
  private _fadeStartDistanceSq = 180 * 180;
  private _imposterDistance = 60; // Switch to imposter before frozen state
  private _imposterDistanceSq = 60 * 60;
  private _imposterUncullDistance = 55; // Hysteresis for imposter transition
  private _imposterUncullDistanceSq = 55 * 55;

  // Culling timing
  private readonly _cullIntervalMs = 100; // More frequent for smoother transitions
  private readonly _cullMoveThresholdSq = 4 * 4; // 4m movement triggers update
  private _lastCullTime = 0;
  private _lastCullCameraPos = new THREE.Vector3();
  private _hasCullCamera = false;
  private _cullDirty = false;

  private readonly _lodDistanceIntervalMs = 200;
  private _lastLODTime = 0;
  private _lastLODCameraPos = new THREE.Vector3();
  private _hasLODCamera = false;
  private _lodDirty = false;

  // Track which handles are currently using imposters vs 3D
  private readonly imposterHandles = new Set<string>();

  // GPU compute culling (optional enhancement)
  private _gpuCullingEnabled = false;
  private _gpuCullingInitialized = false;

  // Track all dissolve materials for uniform updates
  private readonly _dissolveMaterials: MobDissolveMaterial[] = [];
  private readonly _dissolvePlayerPos = new THREE.Vector3();

  // Pre-allocated Vector3s for imposter view data (avoid per-frame allocation)
  private readonly _imposterFaceIndices = new THREE.Vector3();
  private readonly _imposterFaceWeights = new THREE.Vector3(1, 0, 0);

  // VAT (Vertex Animation Texture) cache
  private readonly _vatCache = new Map<string, VATData | null>();
  private readonly _vatLoadingPromises = new Map<
    string,
    Promise<VATData | null>
  >();

  // Impostor baking promises (to avoid duplicate bakes)
  private readonly _impostorBakingPromises = new Map<
    string,
    Promise<ImpostorBakeResult | null>
  >();

  // ============================================
  // FRAME BUDGET MANAGEMENT - Prevent main thread blocking
  // ============================================

  /** Max handles to process per frame during culling */
  private readonly _maxCullHandlesPerFrame = 50;
  /** Max imposter transitions per frame */
  private readonly _maxImposterTransitionsPerFrame = 10;
  /** Max billboard updates per frame */
  private readonly _maxBillboardUpdatesPerFrame = 30;
  /** Max skeleton updates per frame */
  private readonly _maxSkeletonUpdatesPerFrame = 20;

  /** Iterator for incremental culling */
  private _cullIterator: IterableIterator<[string, MobInstancedHandle]> | null =
    null;
  /** Track if full culling pass is needed */
  private _fullCullNeeded = true;

  /** Skeleton update queue for spreading work across frames */
  private _pendingSkeletonUpdates: Array<{
    group: MobInstancedGroup;
    delta: number;
  }> = [];
  /** Index into skeleton update queue */
  private _skeletonUpdateIndex = 0;

  private constructor(world: World, variants = DEFAULT_MOB_VARIANTS) {
    this.world = world;
    this.variantCount = Math.max(1, variants);
    // Note: imposter renderer is lazy-initialized on first use
    // Note: distances are lazy-initialized from shadow quality on first update
  }

  /**
   * Initialize distance thresholds from world preferences.
   * Syncs with shadow quality settings so mobs dissolve at same distance as vegetation.
   *
   * DISTANCE HIERARCHY (must match VegetationSystem):
   * 1. FADE_START - dissolve begins (90% of shadow maxFar)
   * 2. FADE_END - fully dissolved (equals shadow maxFar)
   * 3. CULL - hidden beyond fade end
   *
   * Distance zones (from close to far):
   * - 0-50m: Full 3D with animation LOD tiers
   * - 50-80m: Imposter billboard (before dissolve starts)
   * - FADE_START to FADE_END: Dissolve transition zone
   * - Beyond FADE_END: Fully culled
   */
  private initializeDistances(): void {
    if (this._distancesInitialized) return;

    // Sync with shadow quality like VegetationSystem does
    // This ensures mobs dissolve at the same distance as vegetation
    const shadowsLevel = (this.world.prefs?.shadows as string) || "med";
    const csmConfig =
      csmLevels[shadowsLevel as keyof typeof csmLevels] || csmLevels.med;
    const shadowMaxFar = csmConfig.maxFar;

    // Match vegetation exactly: fade ends at shadow cutoff
    const fadeEnd = shadowMaxFar;
    const fadeStart = shadowMaxFar * 0.9;

    // Cull/render distances - match vegetation for consistent visual boundary
    this._cullDistance = fadeEnd;
    this._cullDistanceSq = fadeEnd * fadeEnd;
    this._fadeStartDistance = fadeStart;
    this._fadeStartDistanceSq = fadeStart * fadeStart;
    this._uncullDistance = fadeStart; // Uncull at fade start for hysteresis
    this._uncullDistanceSq = this._uncullDistance * this._uncullDistance;

    // Imposter distances - switch to billboard well before dissolve zone
    // This gives smooth transition: 3D -> imposter -> dissolve -> cull
    // Keep imposters at fixed distance since they're performance optimization
    this._imposterDistance = Math.min(50, fadeStart * 0.3); // 30% of fade start, max 50m
    this._imposterDistanceSq = this._imposterDistance * this._imposterDistance;
    this._imposterUncullDistance = this._imposterDistance - 5; // 5m hysteresis
    this._imposterUncullDistanceSq =
      this._imposterUncullDistance * this._imposterUncullDistance;

    this._distancesInitialized = true;
    console.log(
      `[MobInstancedRenderer] Synced with shadows "${shadowsLevel}": fade ${fadeStart.toFixed(0)}-${fadeEnd.toFixed(0)}m, imposterAt=${this._imposterDistance.toFixed(0)}m`,
    );

    // Initialize GPU culling if available
    this.initializeGPUCulling();
  }

  /**
   * Initialize GPU compute culling if available.
   * Falls back to CPU frustum culling if not available.
   */
  private initializeGPUCulling(): void {
    if (this._gpuCullingInitialized) return;
    this._gpuCullingInitialized = true;

    if (!isGPUComputeAvailable()) {
      this._gpuCullingEnabled = false;
      return;
    }

    const cullingManager = getGlobalCullingManager();
    if (!cullingManager?.isAvailable()) {
      this._gpuCullingEnabled = false;
      return;
    }

    this._gpuCullingEnabled = true;
    console.log("[MobInstancedRenderer] GPU compute culling enabled");
  }

  static get(world: World): MobInstancedRenderer {
    const existing = mobInstancedRenderers.get(world);
    if (existing) {
      return existing;
    }
    const renderer = new MobInstancedRenderer(world);
    mobInstancedRenderers.set(world, renderer);
    return renderer;
  }

  // NOTE: Old imposter rendering system removed.
  // All impostor baking is now handled by ImpostorManager using @hyperforge/impostor.

  async registerMob(
    registration: MobInstanceRegistration,
  ): Promise<MobInstancedHandle | null> {
    if (this.world.isServer || !this.world.stage?.scene) {
      return null;
    }

    const model = await this.getOrLoadModel(registration.modelPath);
    if (!model || !model.supportsInstancing) {
      return null;
    }

    const variant = this.getVariantForId(registration.id);
    const group = this.getOrCreateGroup(
      model,
      registration.initialState,
      variant,
    );

    // VRM avatars are auto-normalized to ~1.6m, GLB models use native scale
    // Models should be exported at correct scale - no runtime normalization
    const isVRM = registration.modelPath.toLowerCase().endsWith(".vrm");
    const scaleMultiplier = isVRM ? 1 : MOB_MODEL_SCALE;

    const handle: MobInstancedHandle = {
      id: registration.id,
      modelKey: model.modelPath,
      state: registration.initialState,
      variant,
      index: -1,
      hidden: false,
      scale: new THREE.Vector3(
        registration.scale.x * scaleMultiplier,
        registration.scale.y * scaleMultiplier,
        registration.scale.z * scaleMultiplier,
      ),
      position: registration.position.clone(),
      quaternion: registration.quaternion.clone(),
      matrix: new THREE.Matrix4(),
    };

    this.addInstanceToGroup(
      group,
      handle,
      registration.position,
      registration.quaternion,
      true,
    );

    this.handles.set(handle.id, handle);

    if (this.handles.size === 1) {
      this.world.setHot(this, true);
    }

    return handle;
  }

  // Lerp factor for smooth position interpolation (0-1, higher = faster catch-up)
  // This smooths out network jitter and provides silky movement
  private readonly _lerpFactor = 0.25;
  private readonly _lerpThreshold = 0.001; // Below this distance, snap directly
  private readonly _lerpMaxDistance = 10; // Above this distance, snap directly (teleport)

  updateTransform(
    handle: MobInstancedHandle,
    position: THREE.Vector3,
    quaternion: THREE.Quaternion,
  ): void {
    const pos = handle.position;
    const quat = handle.quaternion;

    // Check if position actually changed
    const dx = position.x - pos.x;
    const dy = position.y - pos.y;
    const dz = position.z - pos.z;
    const distSq = dx * dx + dy * dy + dz * dz;

    // Check if quaternion changed
    const quatChanged =
      quat.x !== quaternion.x ||
      quat.y !== quaternion.y ||
      quat.z !== quaternion.z ||
      quat.w !== quaternion.w;

    // Early exit if nothing changed
    if (distSq < this._lerpThreshold * this._lerpThreshold && !quatChanged) {
      return;
    }

    // SMOOTH LERP: Interpolate position for silky movement
    // - Below threshold: snap directly (avoids jitter at rest)
    // - Above max distance: snap directly (teleport)
    // - In between: lerp smoothly
    if (
      distSq > this._lerpThreshold * this._lerpThreshold &&
      distSq < this._lerpMaxDistance * this._lerpMaxDistance
    ) {
      // Smooth lerp to target position
      pos.x += dx * this._lerpFactor;
      pos.y += dy * this._lerpFactor;
      pos.z += dz * this._lerpFactor;
    } else {
      // Snap directly (too small or too large distance)
      pos.copy(position);
    }

    // Slerp quaternion for smooth rotation
    if (quatChanged) {
      quat.slerp(quaternion, this._lerpFactor);
    }

    this.composeInstanceMatrix(handle, pos, quat);
    this._cullDirty = true;
    this._lodDirty = true;
    if (handle.hidden) return;

    // Update depends on whether using 3D mesh or imposter
    if (this.imposterHandles.has(handle.id)) {
      // Imposter transform is updated in updateImposterBillboards (faces camera)
      // Position is already stored in handle.position
      return;
    }

    const group = this.getGroupForHandle(handle);
    if (!group) return;
    this.updateInstanceMatrix(group, handle.index, handle.matrix);
  }

  updateState(
    handle: MobInstancedHandle,
    state: MobAnimationState,
    position: THREE.Vector3,
    quaternion: THREE.Quaternion,
  ): void {
    if (handle.state === state) return;
    const model = this.models.get(handle.modelKey);
    if (!model) return;

    // If using imposter, just update the state for when it returns to 3D
    if (this.imposterHandles.has(handle.id)) {
      handle.state = state;
      handle.position.copy(position);
      handle.quaternion.copy(quaternion);
      return;
    }

    const oldGroup = this.getGroupForHandle(handle);
    if (!oldGroup) return;

    const newGroup = this.getOrCreateGroup(model, state, handle.variant);
    if (oldGroup === newGroup) {
      handle.state = state;
      return;
    }

    handle.position.copy(position);
    handle.quaternion.copy(quaternion);
    this.composeInstanceMatrix(handle, position, quaternion);
    this._cullDirty = true;
    this._lodDirty = true;
    this.removeInstanceFromGroup(oldGroup, handle, false);
    handle.state = state;
    this.addInstanceToGroup(newGroup, handle, position, quaternion, false);
  }

  setVisible(handle: MobInstancedHandle, visible: boolean): void {
    if (handle.hidden === !visible) return;
    const model = this.models.get(handle.modelKey);
    if (!model) return;

    if (!visible) {
      // Hide from both 3D and imposter
      const isImposter = this.imposterHandles.has(handle.id);
      if (isImposter) {
        if (model.imposter) {
          this.removeFromImposter(model.imposter, handle);
        }
        this.imposterHandles.delete(handle.id);
      } else {
        const group = this.getGroupForHandle(handle);
        if (group) {
          this.removeInstanceFromGroup(group, handle, true);
        }
      }
      handle.hidden = true;
      this.cleanupIfEmpty();
      this._lodDirty = true;
    } else {
      handle.hidden = false;
      // Re-add to appropriate renderer (3D or imposter based on distance)
      const cameraPos = getCameraPosition(this.world);
      let useImposter = false;
      if (cameraPos) {
        const distSq = distanceSquaredXZ(
          handle.position.x,
          handle.position.z,
          cameraPos.x,
          cameraPos.z,
        );
        useImposter = distSq >= this._imposterDistanceSq;
      }

      if (useImposter && model.imposter) {
        this.addToImposter(model.imposter, handle);
        this.imposterHandles.add(handle.id);
      } else {
        const group = this.getOrCreateGroup(
          model,
          handle.state,
          handle.variant,
        );
        this.addInstanceToGroup(
          group,
          handle,
          handle.position,
          handle.quaternion,
          true,
        );
      }
      this._lodDirty = true;
    }
  }

  remove(handle: MobInstancedHandle): void {
    const model = this.models.get(handle.modelKey);

    // Remove from imposter if present
    if (this.imposterHandles.has(handle.id)) {
      if (model?.imposter) {
        this.removeFromImposter(model.imposter, handle);
      }
      this.imposterHandles.delete(handle.id);
    } else {
      // Remove from 3D group
      const group = this.getGroupForHandle(handle);
      if (group) {
        this.removeInstanceFromGroup(group, handle, true);
      }
    }

    handle.hidden = true;
    this.handles.delete(handle.id);
    this.cleanupIfEmpty();
  }

  update(delta: number): void {
    if (this.handles.size === 0) return;
    const cameraPos = getCameraPosition(this.world);
    const now = Date.now();

    // Update dissolve shader uniforms with current player position
    if (cameraPos) {
      this._dissolvePlayerPos.set(cameraPos.x, 0, cameraPos.z);
      for (const mat of this._dissolveMaterials) {
        if (mat._dissolveUniforms) {
          mat._dissolveUniforms.playerPos.value.copy(this._dissolvePlayerPos);
        }
      }
    }

    // Update culling (handles distance culling, frustum culling, and imposter transitions)
    // Frustum change detection is handled inside updateCulling via checkFrustumNeedsUpdate
    if (cameraPos) {
      this.updateCulling(cameraPos.x, cameraPos.z, now);
      this.updateImposterTransitions(cameraPos.x, cameraPos.z);
    }

    const refreshDistances = cameraPos
      ? this.shouldRefreshLOD(cameraPos.x, cameraPos.z, now)
      : false;

    // Track skeleton and billboard update budgets this frame
    let skeletonUpdatesThisFrame = 0;
    let billboardUpdatesThisFrame = 0;

    for (const model of this.models.values()) {
      // Update imposter billboards to face camera (with per-frame limit)
      if (model.imposter && model.imposter.count > 0 && cameraPos) {
        if (billboardUpdatesThisFrame < this._maxBillboardUpdatesPerFrame) {
          // Only update a portion of billboards per frame
          const updatesToProcess = Math.min(
            model.imposter.count,
            this._maxBillboardUpdatesPerFrame - billboardUpdatesThisFrame,
          );
          this.updateImposterBillboardsPartial(
            model.imposter,
            cameraPos,
            updatesToProcess,
          );
          billboardUpdatesThisFrame += updatesToProcess;
        }
      }

      for (const group of model.groups.values()) {
        if (group.instances.length === 0) continue;

        const lod = this.updateGroupLOD(
          group,
          cameraPos,
          now,
          delta,
          refreshDistances,
        );

        // Handle freeze state transitions
        if (lod.shouldFreeze && !group.isFrozen) {
          // Entering frozen state - apply rest pose
          this.applyRestPose(group);
          group.isFrozen = true;
        } else if (!lod.shouldFreeze && group.isFrozen) {
          // Exiting frozen state - resume animation
          group.isFrozen = false;
          group.restPose.applied = false;
        }

        // Only update animation if not frozen
        if (lod.shouldUpdate && !group.isFrozen) {
          if (group.mixer) {
            group.mixer.update(lod.effectiveDelta);
          }

          // CRITICAL: Propagate VRM normalized bone transforms to raw bones
          // Without this, animations on normalized bones never reach the visible skeleton
          if (group.vrmHumanoid?.update) {
            group.vrmHumanoid.update(lod.effectiveDelta);
          }

          // Update skeletons with per-frame budget
          if (
            group.skeletons.length > 0 &&
            skeletonUpdatesThisFrame < this._maxSkeletonUpdatesPerFrame
          ) {
            for (const skeleton of group.skeletons) {
              if (skeletonUpdatesThisFrame >= this._maxSkeletonUpdatesPerFrame)
                break;
              const bones = skeleton.bones;
              for (let i = 0; i < bones.length; i += 1) {
                const bone = bones[i];
                if (bone) {
                  bone.updateMatrixWorld();
                }
              }
              skeleton.update();
              skeletonUpdatesThisFrame++;
            }
          }
        }

        // Mark instance matrices for GPU upload
        if (group.dirty) {
          for (const mesh of group.instancedMeshes) {
            mesh.instanceMatrix.needsUpdate = true;
          }
          group.dirty = false;
        }
      }
    }
  }

  /**
   * Apply rest pose to a group's skeletons.
   * Called once when entering frozen state to set a consistent idle pose.
   */
  private applyRestPose(group: MobInstancedGroup): void {
    if (group.restPose.applied) return;

    for (const skeleton of group.skeletons) {
      const bones = skeleton.bones;
      const restMatrices = group.restPose.boneMatrices;

      // Apply cached rest pose matrices to bones
      for (let i = 0; i < bones.length && i < restMatrices.length; i += 1) {
        const bone = bones[i];
        const restMatrix = restMatrices[i];
        if (bone && restMatrix) {
          bone.matrix.copy(restMatrix);
          bone.matrix.decompose(bone.position, bone.quaternion, bone.scale);
          bone.updateMatrixWorld(true);
        }
      }
      skeleton.update();
    }

    group.restPose.applied = true;
  }

  /**
   * Update imposter billboard orientations to face camera.
   * Updates octahedral view cell based on camera direction using @hyperforge/impostor material.
   */
  private updateImposterBillboards(
    imposter: MobImposterModel,
    cameraPos: { x: number; z: number },
  ): void {
    if (imposter.count === 0) return;
    this.updateImposterBillboardsPartial(imposter, cameraPos, imposter.count);
  }

  /**
   * Update a limited number of imposter billboards per call.
   * Used for frame budget management to prevent main thread blocking.
   */
  private updateImposterBillboardsPartial(
    imposter: MobImposterModel,
    cameraPos: { x: number; z: number },
    maxUpdates: number,
  ): void {
    if (imposter.count === 0) return;

    // Update octahedral view cell for the material (cheap operation)
    this.updateOctahedralViewCell(imposter, cameraPos);

    // Update each imposter to face camera (Y-axis billboard rotation only)
    let updated = 0;
    for (const [handleId, index] of imposter.instanceMap) {
      if (updated >= maxUpdates) break;

      const handle = this.handles.get(handleId);
      if (!handle) continue;

      // Calculate angle to camera (Y-axis only for vertical billboard)
      const dx = cameraPos.x - handle.position.x;
      const dz = cameraPos.z - handle.position.z;
      const angle = Math.atan2(dx, dz);

      // Compose billboard transform
      this._tempQuat.setFromAxisAngle(this._tempVec3.set(0, 1, 0), angle);
      this._tempScale.set(imposter.width, imposter.height, 1);

      // Position at mob center, offset Y by half height to ground billboard
      this._tempPos.copy(handle.position);
      this._tempPos.y += imposter.height * 0.5;

      this._tempMatrix.compose(this._tempPos, this._tempQuat, this._tempScale);
      imposter.mesh.setMatrixAt(index, this._tempMatrix);
      updated++;
    }

    imposter.mesh.instanceMatrix.needsUpdate = true;
  }

  /**
   * Update octahedral imposter view cell based on camera direction.
   * Uses hemisphere mapping to select appropriate atlas cell and updates material via updateImpostorMaterial.
   * @internal
   */
  private updateOctahedralViewCell(
    imposter: MobImposterModel,
    cameraPos: { x: number; z: number },
  ): void {
    const { gridSizeX, gridSizeY } = imposter;

    // Get a representative position (first visible imposter)
    let representativePos: THREE.Vector3 | null = null;
    for (const handleId of imposter.instanceMap.keys()) {
      const handle = this.handles.get(handleId);
      if (handle) {
        representativePos = handle.position;
        break;
      }
    }
    if (!representativePos) return;

    // Calculate view direction from imposter to camera
    const dx = cameraPos.x - representativePos.x;
    const dz = cameraPos.z - representativePos.z;
    const len = Math.sqrt(dx * dx + dz * dz);
    if (len < 0.001) return;

    // Normalize view direction (XZ plane only for ground mobs)
    const vx = dx / len;
    const vz = dz / len;

    // Convert view direction to octahedral cell coordinates
    // For HEMI mapping, we map from XZ plane direction to grid cell
    // Map from [-1,1] to [0, gridSize-1]
    const col = Math.floor(((vx + 1) / 2) * (gridSizeX - 1));
    const row = Math.floor(((vz + 1) / 2) * (gridSizeY - 1));

    // Clamp to valid range
    const clampedCol = Math.max(0, Math.min(gridSizeX - 1, col));
    const clampedRow = Math.max(0, Math.min(gridSizeY - 1, row));

    // Calculate flat index for the dominant cell
    const flatIndex = clampedRow * gridSizeX + clampedCol;

    // For instanced rendering, use single-cell rendering (all weight on one face)
    // This is a simplified approach - full octahedral blending would need per-instance raycasting
    // OPTIMIZATION: Reuse pre-allocated Vector3s to avoid per-frame allocation
    this._imposterFaceIndices.set(flatIndex, flatIndex, flatIndex);
    // Note: _imposterFaceWeights is always (1, 0, 0), no need to update

    // Update TSL material view (WebGPU only)
    if (isTSLImpostorMaterial(imposter.material)) {
      imposter.material.updateView(
        this._imposterFaceIndices,
        this._imposterFaceWeights,
      );
    }
  }

  /**
   * Transition mobs between 3D rendering and imposters based on distance.
   * Limited per-frame to prevent main thread blocking with many mobs.
   */
  private updateImposterTransitions(cameraX: number, cameraZ: number): void {
    const toImposter: MobInstancedHandle[] = [];
    const to3D: MobInstancedHandle[] = [];

    for (const handle of this.handles.values()) {
      if (handle.hidden) continue;

      const distSq = distanceSquaredXZ(
        handle.position.x,
        handle.position.z,
        cameraX,
        cameraZ,
      );

      const isImposter = this.imposterHandles.has(handle.id);

      if (isImposter) {
        // Currently imposter - check if should switch to 3D
        if (distSq <= this._imposterUncullDistanceSq) {
          to3D.push(handle);
        }
      } else {
        // Currently 3D - check if should switch to imposter
        if (distSq >= this._imposterDistanceSq) {
          toImposter.push(handle);
        }
      }
    }

    // Execute transitions with per-frame limit to prevent blocking
    // Prioritize 3D->imposter (reduces rendering load)
    const maxTransitions = this._maxImposterTransitionsPerFrame;
    let transitions = 0;

    for (const handle of toImposter) {
      if (transitions >= maxTransitions) break;
      this.switchToImposter(handle);
      transitions++;
    }

    // Remaining budget for imposter->3D transitions
    for (const handle of to3D) {
      if (transitions >= maxTransitions) break;
      this.switchTo3D(handle);
      transitions++;
    }
  }

  /**
   * Switch a mob from 3D mesh to imposter billboard.
   */
  private switchToImposter(handle: MobInstancedHandle): void {
    const model = this.models.get(handle.modelKey);
    if (!model) return;

    // Lazy create imposter if it wasn't created during model load
    // (e.g., renderer wasn't available at that time)
    if (!model.imposter && model.templateScene) {
      model.imposter = this.createModelImposter(model, model.templateScene);
    }
    if (!model.imposter) return;

    // Hide from 3D group
    const group = this.getGroupForHandle(handle);
    if (group) {
      this.removeInstanceFromGroup(group, handle, false);
    }

    // Add to imposter mesh
    this.addToImposter(model.imposter, handle);
    this.imposterHandles.add(handle.id);
  }

  /**
   * Switch a mob from imposter billboard back to 3D mesh.
   *
   * CRITICAL: Add to 3D mesh FIRST, then remove from imposter.
   * This prevents any empty frame where the mob is not visible in either.
   */
  private switchTo3D(handle: MobInstancedHandle): void {
    const model = this.models.get(handle.modelKey);
    if (!model || !model.imposter) return;

    // Add back to 3D group FIRST (before removing from imposter)
    // This ensures the mob is always visible during the transition
    const group = this.getOrCreateGroup(model, handle.state, handle.variant);
    this.addInstanceToGroup(
      group,
      handle,
      handle.position,
      handle.quaternion,
      false,
    );

    // NOW remove from imposter mesh (after 3D is visible)
    this.removeFromImposter(model.imposter, handle);
    this.imposterHandles.delete(handle.id);
  }

  /**
   * Add a handle to the imposter mesh.
   */
  private addToImposter(
    imposter: MobImposterModel,
    handle: MobInstancedHandle,
  ): void {
    if (imposter.count >= imposter.capacity) {
      this.growImposterCapacity(imposter);
    }

    const index = imposter.count;
    imposter.instanceMap.set(handle.id, index);
    imposter.reverseMap.set(index, handle.id);
    imposter.count++;
    imposter.mesh.count = imposter.count;

    this._tempMatrix.compose(
      handle.position,
      this._tempQuat.identity(),
      this._tempScale.set(imposter.width, imposter.height, 1),
    );
    imposter.mesh.setMatrixAt(index, this._tempMatrix);
    imposter.mesh.instanceMatrix.needsUpdate = true;
  }

  /**
   * Remove a handle from the imposter mesh.
   */
  private removeFromImposter(
    imposter: MobImposterModel,
    handle: MobInstancedHandle,
  ): void {
    const index = imposter.instanceMap.get(handle.id);
    if (index === undefined) return;

    const lastIndex = imposter.count - 1;
    if (index !== lastIndex) {
      // Swap with last instance
      imposter.mesh.getMatrixAt(lastIndex, this._tempMatrix);
      imposter.mesh.setMatrixAt(index, this._tempMatrix);

      // Update mappings for swapped item (O(1) with reverse map)
      const lastHandleId = imposter.reverseMap.get(lastIndex);
      if (lastHandleId) {
        imposter.instanceMap.set(lastHandleId, index);
        imposter.reverseMap.set(index, lastHandleId);
      }
    }

    imposter.instanceMap.delete(handle.id);
    imposter.reverseMap.delete(lastIndex);
    imposter.count--;
    imposter.mesh.count = imposter.count;
    imposter.mesh.instanceMatrix.needsUpdate = true;
  }

  /**
   * Grow imposter mesh capacity.
   */
  private growImposterCapacity(imposter: MobImposterModel): void {
    const newCapacity = imposter.capacity * 2;
    const newMesh = new THREE.InstancedMesh(
      imposter.geometry,
      imposter.material,
      newCapacity,
    );
    newMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    newMesh.frustumCulled = false;
    newMesh.layers.set(1);

    // Copy existing matrices
    for (let i = 0; i < imposter.count; i++) {
      imposter.mesh.getMatrixAt(i, this._tempMatrix);
      newMesh.setMatrixAt(i, this._tempMatrix);
    }
    newMesh.count = imposter.count;

    // Replace in scene
    if (imposter.mesh.parent) {
      imposter.mesh.parent.add(newMesh);
      imposter.mesh.parent.remove(imposter.mesh);
    }
    imposter.mesh.dispose();
    imposter.mesh = newMesh;
    imposter.capacity = newCapacity;
  }

  fixedUpdate(_delta: number): void {}
  lateUpdate(_delta: number): void {}
  postLateUpdate(_delta: number): void {}

  /**
   * Get statistics about the instanced renderer for debugging/monitoring.
   */
  getStats(): {
    totalHandles: number;
    activeHandles: number;
    imposterHandles: number;
    totalInstances: number;
    modelCount: number;
    groupCount: number;
    instancedMeshCount: number;
    totalSkeletons: number;
    frozenGroups: number;
  } {
    let groupCount = 0;
    let instancedMeshCount = 0;
    let totalSkeletons = 0;
    let frozenGroups = 0;

    for (const model of this.models.values()) {
      for (const group of model.groups.values()) {
        groupCount++;
        instancedMeshCount += group.instancedMeshes.length;
        totalSkeletons += group.skeletons.length;
        if (group.isFrozen) frozenGroups++;
      }
    }

    let activeHandles = 0;
    for (const handle of this.handles.values()) {
      if (!handle.hidden) activeHandles++;
    }

    return {
      totalHandles: this.handles.size,
      activeHandles,
      imposterHandles: this.imposterHandles.size,
      totalInstances: this.totalInstances,
      modelCount: this.models.size,
      groupCount,
      instancedMeshCount,
      totalSkeletons,
      frozenGroups,
    };
  }

  private cleanupIfEmpty(): void {
    if (this.handles.size === 0) {
      this.world.setHot(this, false);
    }
  }

  /**
   * Dispose all resources used by this renderer.
   * Call when the world is being destroyed.
   */
  dispose(): void {
    // Dispose all models
    for (const model of this.models.values()) {
      // Dispose imposter
      if (model.imposter) {
        if (model.imposter.mesh.parent) {
          model.imposter.mesh.parent.remove(model.imposter.mesh);
        }
        model.imposter.mesh.dispose();
        model.imposter.geometry.dispose();
        model.imposter.material.dispose();
        // Note: bakeResult resources are managed by ImpostorManager's cache
        // Don't dispose texture directly as it may be shared via caching
      }

      // Dispose groups
      for (const group of model.groups.values()) {
        // Dispose instanced meshes
        for (const mesh of group.instancedMeshes) {
          if (mesh.parent) {
            mesh.parent.remove(mesh);
          }
          mesh.dispose();
        }
        // Dispose merged geometry if present
        if (group.mergedGeometry) {
          group.mergedGeometry.dispose();
        }
      }
    }

    this.models.clear();
    this.handles.clear();
    this.imposterHandles.clear();
    this._sharedMaterialCache.clear();

    // Clear dissolve materials (they're disposed with the meshes above)
    this._dissolveMaterials.length = 0;

    // Dispose VAT textures
    for (const vat of this._vatCache.values()) {
      if (vat) {
        vat.texture.dispose();
      }
    }
    this._vatCache.clear();
    this._vatLoadingPromises.clear();

    this.world.setHot(this, false);
  }

  private updateCulling(cameraX: number, cameraZ: number, now: number): void {
    // Initialize distances on first call (needs world.prefs)
    this.initializeDistances();

    // Check if frustum needs update (camera rotated)
    const frustumChanged = this.checkFrustumNeedsUpdate();

    // Determine if we need to start a new culling pass
    const shouldStartNewPass =
      frustumChanged ||
      now - this._lastCullTime >= this._cullIntervalMs ||
      this._cullDirty ||
      !this._hasCullCamera;

    // Check if camera moved significantly
    if (!shouldStartNewPass && this._hasCullCamera) {
      const dx = cameraX - this._lastCullCameraPos.x;
      const dz = cameraZ - this._lastCullCameraPos.z;
      if (dx * dx + dz * dz >= this._cullMoveThresholdSq) {
        this._fullCullNeeded = true;
      }
    }

    // Start new culling pass if needed
    if (shouldStartNewPass || this._fullCullNeeded) {
      this._lastCullTime = now;
      this._lastCullCameraPos.set(cameraX, 0, cameraZ);
      this._hasCullCamera = true;
      this._cullDirty = false;
      this._fullCullNeeded = false;

      // Reset iterator to start fresh pass
      this._cullIterator = this.handles.entries();

      // Update frustum planes from camera
      this.updateFrustum();
    }

    // If no iterator, nothing to process
    if (!this._cullIterator) return;

    // Process a limited number of handles per frame to avoid blocking
    let processed = 0;
    while (processed < this._maxCullHandlesPerFrame) {
      const result = this._cullIterator.next();
      if (result.done) {
        // Finished this pass
        this._cullIterator = null;
        break;
      }

      const [, handle] = result.value;
      processed++;

      const distSq = distanceSquaredXZ(
        handle.position.x,
        handle.position.z,
        cameraX,
        cameraZ,
      );

      // Distance culling (primary) - always cull beyond max distance
      if (distSq >= this._cullDistanceSq) {
        if (!handle.hidden) {
          this.setVisible(handle, false);
        }
        continue;
      }

      // Frustum culling (secondary) - use bounding sphere for accurate test
      this._boundingSphere.center.set(
        handle.position.x,
        handle.position.y + 1.2,
        handle.position.z,
      );
      this._boundingSphere.radius = this._mobBoundingRadius;

      const inFrustum = this._frustum.intersectsSphere(this._boundingSphere);

      if (handle.hidden) {
        // Hidden mob - check if should become visible
        if (distSq <= this._uncullDistanceSq && inFrustum) {
          this.setVisible(handle, true);
        }
      } else {
        // Visible mob - cull if completely outside frustum
        this._boundingSphere.radius = this._mobBoundingRadius * 1.5;
        const inExpandedFrustum = this._frustum.intersectsSphere(
          this._boundingSphere,
        );
        if (!inExpandedFrustum) {
          this.setVisible(handle, false);
        }
      }
    }
  }

  /**
   * Check if the camera's view matrix has changed (position or rotation).
   * Returns true if frustum needs to be recalculated.
   */
  private checkFrustumNeedsUpdate(): boolean {
    const camera = this.world.camera as THREE.PerspectiveCamera | undefined;
    if (!camera) return false;

    // CRITICAL: Use updateWorldMatrix(true, false) to ensure parent matrices are updated first
    // updateMatrixWorld() alone does NOT update parent matrices, which can cause stale frustum
    camera.updateWorldMatrix(true, false);

    // Compare current camera matrix to last known matrix
    if (!this._lastCameraMatrix.equals(camera.matrixWorld)) {
      this._lastCameraMatrix.copy(camera.matrixWorld);
      return true;
    }
    return false;
  }

  /**
   * Update the frustum planes from the current camera.
   */
  private updateFrustum(): void {
    const camera = this.world.camera as THREE.PerspectiveCamera | undefined;
    if (!camera) return;

    // CRITICAL: Compute matrixWorldInverse from matrixWorld
    // updateMatrixWorld() does NOT update matrixWorldInverse - that's only done by renderer
    camera.matrixWorldInverse.copy(camera.matrixWorld).invert();

    // Build projection-view matrix and extract frustum planes
    this._projScreenMatrix.multiplyMatrices(
      camera.projectionMatrix,
      camera.matrixWorldInverse,
    );
    this._frustum.setFromProjectionMatrix(this._projScreenMatrix);

    // Update GPU compute frustum when available
    if (this._gpuCullingEnabled && isGPUComputeAvailable()) {
      const cullingManager = getGlobalCullingManager();
      cullingManager?.updateFrustum(camera);
    }
  }

  private shouldRefreshLOD(
    cameraX: number,
    cameraZ: number,
    now: number,
  ): boolean {
    // Force refresh if dirty or first camera position
    if (this._lodDirty || !this._hasLODCamera) {
      this._lodDirty = false;
      this._hasLODCamera = true;
      this._lastLODTime = now;
      this._lastLODCameraPos.set(cameraX, 0, cameraZ);
      return true;
    }

    // Check if camera moved or time elapsed
    const dx = cameraX - this._lastLODCameraPos.x;
    const dz = cameraZ - this._lastLODCameraPos.z;
    const shouldRefresh =
      dx * dx + dz * dz > this._cullMoveThresholdSq ||
      now - this._lastLODTime >= this._lodDistanceIntervalMs;

    if (shouldRefresh) {
      this._lastLODTime = now;
      this._lastLODCameraPos.set(cameraX, 0, cameraZ);
    }
    return shouldRefresh;
  }

  private updateGroupLOD(
    group: MobInstancedGroup,
    cameraPos: { x: number; z: number } | null,
    now: number,
    delta: number,
    refreshDistances: boolean,
  ): AnimationLODResult {
    // Fallback when no camera - update at full rate
    if (!cameraPos) {
      return {
        shouldUpdate: true,
        effectiveDelta: delta,
        lodLevel: LOD_LEVEL.FULL,
        distanceSq: 0,
        shouldFreeze: false,
        shouldApplyRestPose: false,
        shouldCull: false,
      };
    }

    // Refresh distance to nearest instance in group
    if (
      refreshDistances ||
      now - group.lodLastUpdate >= this._lodDistanceIntervalMs
    ) {
      let minDistSq = Number.POSITIVE_INFINITY;
      for (const { handle } of group.instances) {
        const distSq = distanceSquaredXZ(
          handle.position.x,
          handle.position.z,
          cameraPos.x,
          cameraPos.z,
        );
        if (distSq < minDistSq) minDistSq = distSq;
      }
      group.lodDistanceSq = Number.isFinite(minDistSq) ? minDistSq : 0;
      group.lodLastUpdate = now;
    }

    return group.animationLOD.update(group.lodDistanceSq, delta);
  }

  private composeInstanceMatrix(
    handle: MobInstancedHandle,
    position: THREE.Vector3,
    quaternion: THREE.Quaternion,
  ): void {
    handle.matrix.compose(position, quaternion, handle.scale);
  }

  private updateInstanceMatrix(
    group: MobInstancedGroup,
    index: number,
    matrix: THREE.Matrix4,
  ): void {
    for (const mesh of group.instancedMeshes) {
      mesh.setMatrixAt(index, matrix);
    }
    group.dirty = true;
  }

  private addInstanceToGroup(
    group: MobInstancedGroup,
    handle: MobInstancedHandle,
    position: THREE.Vector3,
    quaternion: THREE.Quaternion,
    adjustTotal: boolean,
  ): void {
    this.ensureCapacity(group, group.instances.length + 1);
    const index = group.instances.length;
    handle.index = index;
    handle.state = group.state;
    handle.variant = group.variant;
    this.composeInstanceMatrix(handle, position, quaternion);
    group.instances.push({ handle });
    group.instanceMap.set(handle.id, index);
    this.updateInstanceMatrix(group, index, handle.matrix);
    for (const mesh of group.instancedMeshes) {
      mesh.count = group.instances.length;
    }
    group.dirty = true;
    if (adjustTotal) {
      this.totalInstances += 1;
    }
  }

  private removeInstanceFromGroup(
    group: MobInstancedGroup,
    handle: MobInstancedHandle,
    adjustTotal: boolean,
  ): void {
    const index = group.instanceMap.get(handle.id);
    if (index === undefined) return;
    const lastIndex = group.instances.length - 1;
    if (index !== lastIndex) {
      const lastEntry = group.instances[lastIndex];
      group.instances[index] = lastEntry;
      group.instanceMap.set(lastEntry.handle.id, index);
      lastEntry.handle.index = index;
      this.updateInstanceMatrix(group, index, lastEntry.handle.matrix);
    }
    group.instances.pop();
    group.instanceMap.delete(handle.id);
    for (const mesh of group.instancedMeshes) {
      mesh.count = group.instances.length;
    }
    group.dirty = true;
    if (adjustTotal) {
      this.totalInstances = Math.max(0, this.totalInstances - 1);
    }
  }

  private getGroupForHandle(
    handle: MobInstancedHandle,
  ): MobInstancedGroup | null {
    const model = this.models.get(handle.modelKey);
    if (!model) return null;
    const key = this.getGroupKey(handle.state, handle.variant);
    return model.groups.get(key) ?? null;
  }

  private getVariantForId(id: string): number {
    let hash = 0;
    for (let i = 0; i < id.length; i += 1) {
      hash = (hash * 31 + id.charCodeAt(i)) | 0;
    }
    return Math.abs(hash) % this.variantCount;
  }

  private getGroupKey(state: MobAnimationState, variant: number): string {
    return `${state}:${variant}`;
  }

  private ensureCapacity(group: MobInstancedGroup, size: number): void {
    if (size <= group.capacity) return;
    const newCapacity = Math.max(group.capacity * 2, size + 10);
    const newMeshes: InstancedSkinnedMesh[] = [];

    for (const mesh of group.instancedMeshes) {
      const resized = new InstancedSkinnedMesh(
        mesh.geometry,
        mesh.material,
        newCapacity,
        mesh.skeleton,
        mesh.bindMatrix,
        mesh.bindMode,
      );
      resized.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
      resized.castShadow = mesh.castShadow;
      resized.receiveShadow = mesh.receiveShadow;
      resized.frustumCulled = false;
      resized.layers.mask = mesh.layers.mask;
      resized.count = mesh.count;

      // Copy existing instance matrices
      for (let i = 0; i < mesh.count; i++) {
        mesh.getMatrixAt(i, this._tempMatrix);
        resized.setMatrixAt(i, this._tempMatrix);
      }

      // Swap in scene
      if (mesh.parent) {
        mesh.parent.add(resized);
        mesh.parent.remove(mesh);
      }
      mesh.dispose();
      newMeshes.push(resized);
    }

    group.instancedMeshes = newMeshes;
    group.capacity = newCapacity;
    group.dirty = true;
  }

  private createInstancedSkinnedMesh(
    geometry: THREE.BufferGeometry,
    material: THREE.Material | THREE.Material[],
    skeleton: THREE.Skeleton,
    bindMatrix: THREE.Matrix4,
    bindMode: THREE.BindMode,
    castShadow: boolean,
    receiveShadow: boolean,
    initialCapacity = 10,
  ): InstancedSkinnedMesh {
    const instanced = new InstancedSkinnedMesh(
      geometry,
      material,
      initialCapacity,
      skeleton,
      bindMatrix,
      bindMode,
    );
    instanced.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    instanced.count = 0;
    instanced.castShadow = castShadow;
    instanced.receiveShadow = receiveShadow;
    instanced.frustumCulled = false;
    instanced.layers.set(1);
    this.world.stage.scene.add(instanced);
    return instanced;
  }

  // Cache for VRM bone name mappings (VRM standard name -> actual bone node name)
  private vrmBoneNameMaps = new Map<string, Map<string, string>>();

  private async getOrLoadModel(
    modelPath: string,
  ): Promise<MobInstancedModel | null> {
    const cached = this.models.get(modelPath);
    if (cached) {
      return cached.supportsInstancing ? cached : null;
    }

    const isVRM = modelPath.toLowerCase().endsWith(".vrm");
    let scene: THREE.Object3D;
    let animations: THREE.AnimationClip[];
    let vrmBoneNameMap: Map<string, string> | undefined;
    let vrmHumanoid: VRMHumanoidLike | undefined;

    if (isVRM && this.world.loader) {
      // For VRM files, load via avatar loader to get proper VRM processing with normalized bones
      try {
        type LoadedAvatarType = {
          factory?: {
            create: (
              matrix: THREE.Matrix4,
              hooks?: unknown,
            ) => {
              raw?: {
                scene?: THREE.Object3D;
                humanoid?: VRMHumanoidLike;
                userData?: { vrm?: { humanoid?: VRMHumanoidLike } };
              };
              humanoid?: {
                getNormalizedBoneNode?: (
                  boneName: string,
                ) => THREE.Object3D | null;
                update?: (delta: number) => void;
                clone?: () => VRMHumanoidLike;
                _rawHumanBones?: unknown;
                _normalizedHumanBones?: unknown;
              };
            };
          };
        };

        const avatarResult = (await this.world.loader.load(
          "avatar",
          modelPath,
        )) as LoadedAvatarType;

        if (!avatarResult?.factory?.create) {
          throw new Error("Avatar loader returned invalid factory");
        }

        // Create a VRM instance to extract the scene and bone mapping
        // IMPORTANT: Don't pass a scene - we don't want the VRM added to the world scene yet
        // We'll extract its raw scene and use it as a template for cloning
        const vrmInstance = avatarResult.factory.create(new THREE.Matrix4(), {
          scene: undefined, // Don't add to any scene
          camera: this.world.camera,
          loader: this.world.loader,
          templateMode: true, // Suppress "no scene" error - we're extracting template data only
        });

        if (!vrmInstance?.raw?.scene) {
          throw new Error("VRM instance has no scene");
        }

        scene = vrmInstance.raw.scene;
        animations = []; // VRM doesn't have embedded animations, we load emotes separately

        // Store VRM humanoid for bone propagation (normalized -> raw)
        // This is CRITICAL for VRM animations to work - without humanoid.update(),
        // normalized bone transforms never propagate to the visible raw bones
        // The humanoid is stored in userData.vrm (from cloneGLB) with remapped bone references
        const clonedVRM = vrmInstance.raw?.userData?.vrm;
        if (clonedVRM?.humanoid?.update) {
          vrmHumanoid = clonedVRM.humanoid as VRMHumanoidLike;
          console.log(
            `[MobInstancedRenderer] ✅ Got VRM humanoid for bone propagation: ${modelPath}`,
          );
        } else {
          console.warn(
            `[MobInstancedRenderer] ⚠️ No VRM humanoid.update() available - animations may not work correctly: ${modelPath}`,
          );
        }

        // Build bone name mapping from VRM humanoid
        if (vrmInstance.humanoid?.getNormalizedBoneNode) {
          vrmBoneNameMap = new Map<string, string>();
          const vrmBoneNames = [
            "hips",
            "spine",
            "chest",
            "upperChest",
            "neck",
            "head",
            "leftShoulder",
            "leftUpperArm",
            "leftLowerArm",
            "leftHand",
            "rightShoulder",
            "rightUpperArm",
            "rightLowerArm",
            "rightHand",
            "leftUpperLeg",
            "leftLowerLeg",
            "leftFoot",
            "leftToes",
            "rightUpperLeg",
            "rightLowerLeg",
            "rightFoot",
            "rightToes",
          ];
          for (const boneName of vrmBoneNames) {
            const node = vrmInstance.humanoid.getNormalizedBoneNode(
              boneName as Parameters<
                typeof vrmInstance.humanoid.getNormalizedBoneNode
              >[0],
            );
            if (node?.name) {
              vrmBoneNameMap.set(boneName, node.name);
            }
          }
          this.vrmBoneNameMaps.set(modelPath, vrmBoneNameMap);
        }

        console.log(
          `[MobInstancedRenderer] ✅ Loaded VRM with normalized bones: ${modelPath}`,
        );
      } catch (err) {
        console.warn(
          `[MobInstancedRenderer] VRM avatar loader failed, falling back to GLTF: ${modelPath}`,
          err,
        );
        // Fallback to regular GLTF loading
        const result = await modelCache.loadModel(modelPath, this.world);
        scene = result.scene;
        animations = result.animations;
      }
    } else {
      // Non-VRM or no loader available - use regular GLTF loading
      const result = await modelCache.loadModel(modelPath, this.world);
      scene = result.scene;
      animations = result.animations;
    }

    const skinnedMeshes: THREE.SkinnedMesh[] = [];
    const nonSkinnedMeshes: THREE.Mesh[] = [];

    scene.traverse((child) => {
      if (child instanceof THREE.SkinnedMesh) {
        skinnedMeshes.push(child);
        return;
      }
      if (child instanceof THREE.Mesh) {
        nonSkinnedMeshes.push(child);
      }
    });

    // Validate skeletons - filter out undefined bones (can happen with WebGPU)
    for (const mesh of skinnedMeshes) {
      if (mesh.skeleton) {
        const validBones = mesh.skeleton.bones.filter(
          (bone): bone is THREE.Bone => bone !== undefined && bone !== null,
        );
        if (validBones.length !== mesh.skeleton.bones.length) {
          console.warn(
            `[MobInstancedRenderer] Cleaned ${mesh.skeleton.bones.length - validBones.length} undefined bones from skeleton in ${modelPath}`,
          );
          mesh.skeleton.bones = validBones;
        }
      }
    }

    const supportsInstancing =
      skinnedMeshes.length > 0 && nonSkinnedMeshes.length === 0;

    const clips = await this.resolveAnimationClips(
      modelPath,
      animations,
      scene,
    );

    // Calculate bounding box for imposter sizing
    const boundingBox = new THREE.Box3();
    scene.traverse((child) => {
      if (child instanceof THREE.Mesh) {
        child.geometry.computeBoundingBox();
        const meshBox = child.geometry.boundingBox;
        if (meshBox) {
          meshBox.applyMatrix4(child.matrixWorld);
          boundingBox.union(meshBox);
        }
      }
    });

    // Ensure we have valid bounds
    if (boundingBox.isEmpty()) {
      boundingBox.setFromCenterAndSize(
        new THREE.Vector3(0, 0.5, 0),
        new THREE.Vector3(1, 1, 1),
      );
    }

    const model: MobInstancedModel = {
      modelPath,
      templateScene: scene,
      clips,
      supportsInstancing,
      groups: new Map(),
      imposter: null,
      boundingBox,
      vrmHumanoid,
    };

    // Create imposter for this model (only if we can render)
    if (supportsInstancing && this.world.stage?.scene) {
      model.imposter = this.createModelImposter(model, scene);
    }

    this.models.set(modelPath, model);

    if (!supportsInstancing) {
      console.warn(
        `[MobInstancedRenderer] Model not instancing-ready (non-skinned meshes detected): ${modelPath}`,
      );
    }

    return supportsInstancing ? model : null;
  }

  /**
   * Create imposter (billboard) data for a model.
   * Uses ImpostorManager for runtime octahedral baking with caching.
   * Returns null initially - the model.imposter is set asynchronously when baking completes.
   *
   * NOTE: When DISABLE_IMPOSTORS is true, this function returns null immediately.
   */
  private createModelImposter(
    model: MobInstancedModel,
    scene: THREE.Object3D,
  ): MobImposterModel | null {
    if (DISABLE_IMPOSTORS) return null; // Impostors disabled - using dissolve fade instead

    // Calculate dimensions from bounding box
    // VRM avatars are auto-normalized to ~1.6m, GLB models use native scale
    const isVRM = model.modelPath.toLowerCase().endsWith(".vrm");
    const size = new THREE.Vector3();
    model.boundingBox.getSize(size);
    const scaleMultiplier = isVRM ? 1 : MOB_MODEL_SCALE;

    const width = Math.max(size.x, size.z) * scaleMultiplier;
    const height = size.y * scaleMultiplier;

    // Extract model ID from path for caching
    const pathParts = model.modelPath.split("/");
    const filename = pathParts[pathParts.length - 1];
    const modelId = `mob_instanced_${filename.replace(/\.(vrm|glb|gltf)$/i, "")}`;

    // Check if already baking
    const existingPromise = this._impostorBakingPromises.get(modelId);
    if (existingPromise) {
      return null; // Already in progress
    }

    // Start async baking using ImpostorManager
    const bakePromise = this.bakeModelImpostor(
      model,
      scene,
      modelId,
      width,
      height,
    );
    this._impostorBakingPromises.set(modelId, bakePromise);

    bakePromise
      .then((bakeResult) => {
        this._impostorBakingPromises.delete(modelId);
        if (bakeResult) {
          model.imposter = this.createImpostorFromBakeResult(
            bakeResult,
            width,
            height,
            isVRM,
          );
        }
      })
      .catch((err) => {
        console.warn(
          `[MobInstancedRenderer] Failed to bake impostor for ${modelId}:`,
          err,
        );
        this._impostorBakingPromises.delete(modelId);
      });

    return null; // Imposter created asynchronously
  }

  /**
   * Bake impostor using ImpostorManager.
   * @internal
   */
  private async bakeModelImpostor(
    model: MobInstancedModel,
    scene: THREE.Object3D,
    modelId: string,
    _width: number,
    _height: number,
  ): Promise<ImpostorBakeResult | null> {
    const manager = ImpostorManager.getInstance(this.world);

    if (!manager.initBaker()) {
      console.warn(`[MobInstancedRenderer] Cannot init impostor baker`);
      return null;
    }

    // Validate skeletons before cloning - filter out undefined bones (can happen with WebGPU)
    scene.traverse((child) => {
      if (child instanceof THREE.SkinnedMesh && child.skeleton) {
        const validBones = child.skeleton.bones.filter(
          (bone): bone is THREE.Bone => bone !== undefined && bone !== null,
        );
        if (validBones.length !== child.skeleton.bones.length) {
          child.skeleton.bones = validBones;
        }
      }
    });

    // Clone scene to prepare for baking (set idle pose)
    const bakeScene = SkeletonUtils.clone(scene);

    // Apply idle animation to get correct pose for baking
    const skinnedMeshes: THREE.SkinnedMesh[] = [];
    bakeScene.traverse((child) => {
      if (child instanceof THREE.SkinnedMesh) {
        skinnedMeshes.push(child);
      }
    });

    // Validate cloned skeletons - filter out undefined bones (can happen with WebGPU)
    for (const mesh of skinnedMeshes) {
      if (mesh.skeleton) {
        const validBones = mesh.skeleton.bones.filter(
          (bone): bone is THREE.Bone => bone !== undefined && bone !== null,
        );
        if (validBones.length !== mesh.skeleton.bones.length) {
          mesh.skeleton.bones = validBones;
        }
      }
    }

    if (model.clips.idle && skinnedMeshes.length > 0) {
      const mixer = new THREE.AnimationMixer(skinnedMeshes[0]);
      const action = mixer.clipAction(model.clips.idle);
      action.play();
      action.time = 0;
      mixer.update(0);
    }

    bakeScene.updateMatrixWorld(true);

    // Use ImpostorManager for baking with caching
    const bakeResult = await manager.getOrCreate(modelId, bakeScene, {
      atlasSize: 512,
      hemisphere: true, // Mobs are typically viewed from above
      priority: BakePriority.NORMAL,
      category: "mob",
    });

    console.log(`[MobInstancedRenderer] Baked impostor for ${modelId}:`, {
      gridSizeX: bakeResult.gridSizeX,
      gridSizeY: bakeResult.gridSizeY,
      atlasSize:
        (
          bakeResult.atlasTexture?.image as
            | { width?: number; height?: number }
            | undefined
        )?.width ?? "no image",
    });

    return bakeResult;
  }

  /**
   * Create MobImposterModel from ImpostorManager bake result.
   * @internal
   */
  private createImpostorFromBakeResult(
    bakeResult: ImpostorBakeResult,
    width: number,
    height: number,
    isVRM: boolean,
  ): MobImposterModel {
    const { atlasTexture, gridSizeX, gridSizeY, boundingSphere } = bakeResult;

    // VRM avatars are auto-normalized to ~1.6m
    // GLB: use passed width/height (already normalized) or fallback scale for boundingSphere
    const scaleMultiplier = isVRM ? 1 : MOB_MODEL_SCALE;

    // Use bounding sphere for sizing if available (pre-scaled width/height preferred)
    const finalWidth = boundingSphere
      ? boundingSphere.radius * 2 * scaleMultiplier
      : width;
    const finalHeight = boundingSphere
      ? boundingSphere.radius * 2 * scaleMultiplier
      : height;

    // Create TSL material for WebGPU (no WebGL fallback)
    const material: ImposterMaterialType = createTSLImpostorMaterial({
      atlasTexture,
      gridSizeX,
      gridSizeY,
      transparent: true,
      depthWrite: true,
    });
    this.world.setupMaterial(material);

    // Create billboard geometry and instanced mesh
    const geometry = new THREE.PlaneGeometry(1, 1);
    const initialCapacity = 50;
    const mesh = new THREE.InstancedMesh(geometry, material, initialCapacity);
    mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    mesh.frustumCulled = false;
    mesh.count = 0;
    mesh.layers.set(1);
    this.world.stage.scene.add(mesh);

    return {
      texture: atlasTexture,
      geometry,
      material,
      mesh,
      instanceMap: new Map(),
      reverseMap: new Map(),
      count: 0,
      capacity: initialCapacity,
      width: finalWidth,
      height: finalHeight,
      bakeResult,
      gridSizeX,
      gridSizeY,
    };
  }

  // NOTE: Simple billboard and CDN-based octahedral impostor methods removed.
  // All impostor baking is now handled by ImpostorManager using @hyperforge/impostor.

  /**
   * Convert VRM standard bone name to normalized bone node name.
   * VRM library creates normalized bones with "Normalized_" prefix and PascalCase.
   * @param vrmBoneName - VRM standard name (e.g., "hips", "leftUpperArm")
   * @returns Normalized bone node name (e.g., "Normalized_Hips", "Normalized_LeftUpperArm")
   */
  private toNormalizedBoneName(vrmBoneName: string): string {
    if (!vrmBoneName) return vrmBoneName;
    // Capitalize first letter and prepend "Normalized_"
    return `Normalized_${vrmBoneName.charAt(0).toUpperCase()}${vrmBoneName.slice(1)}`;
  }

  private async resolveAnimationClips(
    modelPath: string,
    animations: THREE.AnimationClip[],
    scene?: THREE.Object3D,
  ): Promise<MobAnimationClips> {
    const clips: MobAnimationClips = {};

    // Search embedded animations first
    for (const clip of animations) {
      const name = clip.name.toLowerCase();
      if (!clips.idle && name.includes("idle")) clips.idle = clip;
      if (!clips.walk && (name.includes("walk") || name.includes("run")))
        clips.walk = clip;
    }

    // Return early if found
    if (clips.idle || clips.walk) {
      clips.idle ??= clips.walk;
      return clips;
    }

    // For VRM avatars, load emote animations with proper retargeting
    // VRM avatars use the shared emote system with Mixamo→VRM bone name mapping
    const isVRM = modelPath.toLowerCase().endsWith(".vrm");
    if (isVRM && this.world.loader) {
      // Get cached bone name mapping for this VRM (built during getOrLoadModel)
      const boneNameMap = this.vrmBoneNameMaps.get(modelPath);

      // Check if scene has normalized bones (VRM was loaded with VRM loader)
      const hasNormalizedBones =
        scene && !!scene.getObjectByName("Normalized_Hips");

      // Load emote GLB files using the emote loader for proper retargeting
      const emoteFiles = [
        { name: "idle", path: "asset://emotes/emote-idle.glb" },
        { name: "walk", path: "asset://emotes/emote-walk.glb" },
      ];

      type EmoteLoaderResult = {
        toClip: (options?: {
          rootToHips?: number;
          version?: string;
          getBoneName?: (name: string) => string | undefined;
        }) => THREE.AnimationClip;
      };

      for (const { name, path } of emoteFiles) {
        try {
          // Use emote loader which creates retargetable animation factory
          const emoteFactory = (await this.world.loader.load(
            "emote",
            path,
          )) as EmoteLoaderResult;

          if (emoteFactory?.toClip) {
            // Create getBoneName function based on available bone mapping
            let getBoneName:
              | ((vrmBoneName: string) => string | undefined)
              | undefined;

            if (boneNameMap && boneNameMap.size > 0) {
              // Use cached bone name mapping from VRM humanoid
              getBoneName = (vrmBoneName: string) =>
                boneNameMap.get(vrmBoneName);
            } else if (hasNormalizedBones) {
              // Fallback to normalized bone naming convention
              getBoneName = (vrmBoneName: string) =>
                this.toNormalizedBoneName(vrmBoneName);
            }

            // Create retargeted clip with VRM bone names
            const clip = emoteFactory.toClip({
              rootToHips: 1.0, // Standard VRM height ratio
              version: "1", // VRM 1.0 format
              getBoneName,
            });

            if (name === "idle") {
              clips.idle ??= clip;
              console.log(
                `[MobInstancedRenderer] ✅ Loaded idle emote for ${modelPath}`,
              );
            }
            if (name === "walk") {
              clips.walk ??= clip;
              console.log(
                `[MobInstancedRenderer] ✅ Loaded walk emote for ${modelPath}`,
              );
            }
          }
        } catch (err) {
          // Emote files should always exist - log error if not found
          console.warn(
            `[MobInstancedRenderer] ❌ Failed to load emote ${path}:`,
            err,
          );
        }
      }
      clips.idle ??= clips.walk;
      if (!clips.idle && !clips.walk) {
        console.error(
          `[MobInstancedRenderer] ❌ No animations loaded for VRM ${modelPath}! Characters will be in T-pose.`,
        );
      }
      return clips;
    }

    // Try loading external animation files (optional - 404 is expected if not present)
    const modelDir = modelPath.substring(0, modelPath.lastIndexOf("/"));
    for (const file of ["walking.glb", "running.glb"]) {
      try {
        const result = await modelCache.loadModel(
          `${modelDir}/animations/${file}`,
          this.world,
        );
        const clip = result.animations?.[0];
        if (clip) {
          clips.walk ??= clip;
          clips.idle ??= clip;
        }
      } catch (err) {
        // Only log non-404 errors (actual problems vs expected missing files)
        const errMsg = err instanceof Error ? err.message : String(err);
        if (
          !errMsg.includes("404") &&
          !errMsg.includes("not found") &&
          !errMsg.includes("Failed to fetch")
        ) {
          console.warn(
            `[MobInstancedRenderer] Failed to load animation ${file}: ${errMsg}`,
          );
        }
      }
    }

    // Fallback to first available animation
    clips.idle ??= animations[0];
    return clips;
  }

  // ============================================================================
  // VAT (VERTEX ANIMATION TEXTURE) LOADING
  // Infrastructure for GPU-driven animation. Currently loads VAT files when
  // present; full vertex shader integration pending. Use with bake-mob-vat.mjs.
  // ============================================================================

  /**
   * Load VAT data for a model (cached, deduped).
   * Returns null if VAT files don't exist (falls back to skeletal animation).
   * @internal Reserved for future VAT shader integration
   */
  private async loadVATData(modelPath: string): Promise<VATData | null> {
    // Check cache first
    const cached = this._vatCache.get(modelPath);
    if (cached !== undefined) {
      return cached;
    }

    // Check if already loading
    const loading = this._vatLoadingPromises.get(modelPath);
    if (loading) {
      return loading;
    }

    // Start loading
    const loadPromise = this.loadVATDataInternal(modelPath);
    this._vatLoadingPromises.set(modelPath, loadPromise);

    const result = await loadPromise;
    this._vatCache.set(modelPath, result);
    this._vatLoadingPromises.delete(modelPath);

    return result;
  }

  /** @internal */
  private async loadVATDataInternal(
    modelPath: string,
  ): Promise<VATData | null> {
    const basePath = modelPath.replace(/\.(vrm|glb|gltf)$/i, "");
    const metadataUrl = this.world.resolveURL(`${basePath}.vat.json`);
    const textureUrl = this.world.resolveURL(`${basePath}.vat.bin`);

    // Load metadata (404 = no VAT, which is expected for most models)
    let metadataResponse: Response;
    try {
      metadataResponse = await fetch(metadataUrl);
    } catch {
      return null; // Network error - no VAT available
    }
    if (!metadataResponse.ok) return null;

    const metadata: VATMetadata = await metadataResponse.json();

    // Load texture (required if metadata exists)
    let textureResponse: Response;
    try {
      textureResponse = await fetch(textureUrl);
    } catch {
      console.warn(
        `[MobInstancedRenderer] VAT texture fetch failed: ${basePath}`,
      );
      return null;
    }
    if (!textureResponse.ok) {
      console.warn(`[MobInstancedRenderer] VAT texture missing: ${basePath}`);
      return null;
    }

    const textureData = new Float32Array(await textureResponse.arrayBuffer());

    // Create GPU texture
    const texture = new THREE.DataTexture(
      textureData,
      metadata.textureWidth,
      metadata.textureHeight,
      THREE.RGBAFormat,
      THREE.FloatType,
    );
    texture.minFilter = THREE.NearestFilter;
    texture.magFilter = THREE.NearestFilter;
    texture.wrapS = THREE.ClampToEdgeWrapping;
    texture.wrapT = THREE.ClampToEdgeWrapping;
    texture.needsUpdate = true;

    // Build animation lookup
    const animationOffsets = new Map<
      string,
      { start: number; frames: number; duration: number; loop: boolean }
    >();
    for (const anim of metadata.animations) {
      animationOffsets.set(anim.name, {
        start: anim.startFrame,
        frames: anim.frames,
        duration: anim.duration,
        loop: anim.loop,
      });
    }

    console.log(
      `[MobInstancedRenderer] VAT loaded: ${modelPath} ` +
        `(${metadata.vertexCount}v, ${metadata.totalFrames}f, ${metadata.animations.length} anims)`,
    );

    return { metadata, texture, animationOffsets };
  }

  /** @internal Map mob state to VAT animation row offset */
  private getVATAnimationIndex(state: MobAnimationState): number {
    return state === "walk"
      ? VAT_ANIMATION_INDEX.WALK
      : VAT_ANIMATION_INDEX.IDLE;
  }

  /** @internal Dispose VAT texture for a specific model */
  private disposeVATData(modelPath: string): void {
    const vat = this._vatCache.get(modelPath);
    if (vat) {
      vat.texture.dispose();
      this._vatCache.delete(modelPath);
    }
  }

  // NOTE: CDN-based octahedral imposter loading has been removed.
  // All impostor baking is now handled by ImpostorManager using @hyperforge/impostor.

  private getOrCreateGroup(
    model: MobInstancedModel,
    state: MobAnimationState,
    variant: number,
  ): MobInstancedGroup {
    const key = this.getGroupKey(state, variant);
    const existing = model.groups.get(key);
    if (existing) {
      return existing;
    }

    const sourceScene = SkeletonUtils.clone(model.templateScene);
    sourceScene.updateMatrixWorld(true);

    // Clone and remap humanoid for this group's scene
    // Each group needs its own humanoid that references its own cloned bones
    let groupHumanoid: VRMHumanoidLike | undefined;
    if (model.vrmHumanoid?.clone) {
      groupHumanoid = model.vrmHumanoid.clone();
      // Remap humanoid bone references to cloned scene
      this.remapHumanoidBones(groupHumanoid, sourceScene);
    }

    const skinnedMeshes: THREE.SkinnedMesh[] = [];
    sourceScene.traverse((child) => {
      if (child instanceof THREE.SkinnedMesh) {
        skinnedMeshes.push(child);
      }
    });

    // Validate cloned skeletons - filter out undefined bones (can happen with WebGPU)
    for (const mesh of skinnedMeshes) {
      if (mesh.skeleton) {
        const validBones = mesh.skeleton.bones.filter(
          (bone): bone is THREE.Bone => bone !== undefined && bone !== null,
        );
        if (validBones.length !== mesh.skeleton.bones.length) {
          mesh.skeleton.bones = validBones;
        }
      }
    }

    const clip = state === "walk" ? model.clips.walk : model.clips.idle;
    let mixer: THREE.AnimationMixer | undefined;
    let action: THREE.AnimationAction | undefined;

    if (clip && skinnedMeshes.length > 0) {
      mixer = new THREE.AnimationMixer(skinnedMeshes[0]);
      action = mixer.clipAction(clip);
      action.enabled = true;
      action.setEffectiveWeight(1.0);
      action.setLoop(THREE.LoopRepeat, Infinity);
      action.play();
      const offset =
        clip.duration > 0 ? (variant / this.variantCount) * clip.duration : 0;
      action.time = offset;
      mixer.update(0);

      // CRITICAL: Propagate VRM normalized bone transforms to raw bones
      // This is where A-pose handling happens - without this, animations don't reach visible skeleton
      if (groupHumanoid?.update) {
        groupHumanoid.update(0);
      }

      // CRITICAL: Update skeleton immediately to apply animation pose
      // Without this, the skinned mesh stays in T-pose until the update loop runs
      for (const mesh of skinnedMeshes) {
        if (mesh.skeleton) {
          for (const bone of mesh.skeleton.bones) {
            if (bone) bone.updateMatrixWorld(true);
          }
          mesh.skeleton.update();
        }
      }
    } else if (skinnedMeshes.length > 0) {
      // No animation clip available - this is a PROBLEM for skinned meshes
      // skeleton.pose() does NOT help - it resets TO bind pose (usually T-pose)
      // Log error so developers know to add animations
      console.error(
        `[MobInstancedRenderer] ❌ No animation clip for ${model.modelPath} state=${state}. ` +
          `Instanced mobs will show T-pose! Add animations to fix.`,
      );
      // We can't hide individual instances easily, so we proceed but log the error
      // The bones will be in their default loaded state (which might be T-pose)
    }

    const skeletons: THREE.Skeleton[] = [];
    const skeletonSet = new Set<THREE.Skeleton>();

    for (const skinnedMesh of skinnedMeshes) {
      skinnedMesh.bindMode = THREE.DetachedBindMode;
      skinnedMesh.updateMatrixWorld(true);
      skinnedMesh.bindMatrix.copy(skinnedMesh.matrixWorld);
      skinnedMesh.bindMatrixInverse.copy(skinnedMesh.bindMatrix).invert();
      if (!skeletonSet.has(skinnedMesh.skeleton)) {
        skeletonSet.add(skinnedMesh.skeleton);
        skeletons.push(skinnedMesh.skeleton);
      }
    }

    // Capture rest pose from idle animation frame 0 for frozen state
    // Must use sourceScene (the cloned scene that owns these skeletons)
    const idleClip = model.clips.idle;
    const restPose = this.captureRestPose(idleClip, sourceScene, skeletons);

    // Merge multiple skinned meshes into one if they share skeleton
    const mergeResult = this.mergeSkinnedMeshes(skinnedMeshes);

    let instancedMeshes: InstancedSkinnedMesh[];
    let mergedGeometry: THREE.BufferGeometry | undefined;

    if (mergeResult) {
      // Merged geometry - single draw call
      const instanced = this.createInstancedSkinnedMesh(
        mergeResult.geometry,
        this.cloneSkinnedMaterial(mergeResult.material),
        mergeResult.skeleton,
        mergeResult.bindMatrix,
        THREE.DetachedBindMode,
        skinnedMeshes[0]?.castShadow ?? false,
        skinnedMeshes[0]?.receiveShadow ?? false,
      );
      instancedMeshes = [instanced];
      mergedGeometry = mergeResult.geometry;
    } else {
      // Separate mesh per SkinnedMesh
      instancedMeshes = skinnedMeshes.map((sm) =>
        this.createInstancedSkinnedMesh(
          sm.geometry,
          this.cloneSkinnedMaterial(sm.material),
          sm.skeleton,
          sm.bindMatrix,
          sm.bindMode,
          sm.castShadow,
          sm.receiveShadow,
        ),
      );
    }

    const group: MobInstancedGroup = {
      key,
      state,
      variant,
      clip,
      mixer,
      action,
      animationLOD: new AnimationLOD(ANIMATION_LOD_PRESETS.MOB),
      lodDistanceSq: 0,
      lodLastUpdate: 0,
      sourceScene,
      skinnedMeshes,
      skeletons,
      instancedMeshes,
      instances: [],
      instanceMap: new Map(),
      capacity: 10,
      dirty: false,
      restPose,
      isFrozen: false,
      mergedGeometry,
      vrmHumanoid: groupHumanoid,
    };

    model.groups.set(key, group);
    return group;
  }

  /**
   * Capture rest pose (idle frame 0) for use in frozen state.
   * Uses the provided skeleton directly (from the cloned sourceScene) to ensure consistency.
   */
  private captureRestPose(
    idleClip: THREE.AnimationClip | undefined,
    sourceScene: THREE.Object3D,
    skeletons: THREE.Skeleton[],
  ): RestPoseData {
    if (skeletons.length === 0) {
      return { boneMatrices: [], applied: false };
    }

    const skeleton = skeletons[0];

    // Sample idle animation at frame 0 on the actual sourceScene that owns these skeletons
    if (idleClip) {
      const tempMixer = new THREE.AnimationMixer(sourceScene);
      const action = tempMixer.clipAction(idleClip);
      action.enabled = true;
      action.setEffectiveWeight(1.0);
      action.time = 0;
      action.play();
      tempMixer.update(0);

      // Force skeleton update after animation sampling
      for (const bone of skeleton.bones) {
        bone.updateMatrixWorld(true);
      }

      tempMixer.stopAllAction();
    }

    // Capture bone local matrices (these are now from the animated skeleton)
    // Guard against undefined bones or matrices
    const boneMatrices = skeleton.bones
      .filter((bone) => bone && bone.matrix)
      .map((bone) => bone.matrix.clone());

    return {
      boneMatrices,
      applied: false,
    };
  }

  /**
   * Remap VRM humanoid bone references to a cloned scene.
   * After SkeletonUtils.clone(), the humanoid still references original bones.
   * This updates the references to point to the cloned bones.
   */
  private remapHumanoidBones(
    humanoid: VRMHumanoidLike,
    clonedScene: THREE.Object3D,
  ): void {
    // Build map of cloned bones by name
    const clonedBonesByName = new Map<string, THREE.Bone>();
    const clonedObjectsByName = new Map<string, THREE.Object3D>();

    clonedScene.traverse((obj) => {
      if (obj instanceof THREE.Bone) {
        clonedBonesByName.set(obj.name, obj);
      }
      if (obj.name) {
        clonedObjectsByName.set(obj.name, obj);
      }
    });

    // Remap raw bones
    const rawRig = humanoid._rawHumanBones;
    if (rawRig?.humanBones) {
      const newHumanBones: Record<string, { node?: THREE.Object3D }> = {};
      for (const [boneName, boneData] of Object.entries(rawRig.humanBones)) {
        const typedBoneData = boneData as { node?: THREE.Object3D };
        if (typedBoneData?.node) {
          const clonedBone = clonedBonesByName.get(typedBoneData.node.name);
          if (clonedBone) {
            newHumanBones[boneName] = { ...typedBoneData, node: clonedBone };
          } else {
            newHumanBones[boneName] = { ...typedBoneData };
          }
        }
      }
      rawRig.humanBones = newHumanBones;
    }

    // Remap normalized bones
    const normRig = humanoid._normalizedHumanBones;
    if (normRig?.humanBones) {
      const newHumanBones: Record<string, { node?: THREE.Object3D }> = {};
      for (const [boneName, boneData] of Object.entries(normRig.humanBones)) {
        const typedBoneData = boneData as { node?: THREE.Object3D };
        if (typedBoneData?.node) {
          const clonedObj = clonedObjectsByName.get(typedBoneData.node.name);
          if (clonedObj) {
            newHumanBones[boneName] = { ...typedBoneData, node: clonedObj };
          } else {
            newHumanBones[boneName] = { ...typedBoneData };
          }
        }
      }
      normRig.humanBones = newHumanBones;
    }
  }

  /**
   * Merge multiple SkinnedMeshes that share the same skeleton into one geometry.
   * Returns null if merging is not possible (different skeletons, etc.)
   */
  private mergeSkinnedMeshes(meshes: THREE.SkinnedMesh[]): {
    geometry: THREE.BufferGeometry;
    material: THREE.Material;
    skeleton: THREE.Skeleton;
    bindMatrix: THREE.Matrix4;
  } | null {
    if (meshes.length <= 1) return null;

    // Verify all meshes share the same skeleton
    const skeleton = meshes[0].skeleton;
    for (let i = 1; i < meshes.length; i++) {
      if (meshes[i].skeleton !== skeleton) {
        // Different skeletons - cannot merge
        return null;
      }
    }

    // Verify all use vertex colors only (for material merging)
    const allVertexColor = meshes.every((mesh) => {
      const mat = mesh.material;
      if (Array.isArray(mat)) return false;
      return this.isVertexColorOnlyMaterial(mat);
    });
    if (!allVertexColor) return null;

    // Collect geometry data from all meshes
    const allPositions: number[] = [];
    const allNormals: number[] = [];
    const allColors: number[] = [];
    const allSkinIndices: number[] = [];
    const allSkinWeights: number[] = [];
    const allIndices: number[] = [];
    let indexOffset = 0;

    for (const mesh of meshes) {
      const geo = mesh.geometry;
      const positions = geo.getAttribute("position");
      const normals = geo.getAttribute("normal");
      const colors = geo.getAttribute("color");
      const skinIndex = geo.getAttribute("skinIndex");
      const skinWeight = geo.getAttribute("skinWeight");
      const indices = geo.getIndex();

      if (!positions || !skinIndex || !skinWeight) {
        // Missing required attributes
        return null;
      }

      const vertexCount = positions.count;

      // Append positions
      for (let i = 0; i < vertexCount; i++) {
        allPositions.push(
          positions.getX(i),
          positions.getY(i),
          positions.getZ(i),
        );
      }

      // Append normals (or generate default)
      if (normals) {
        for (let i = 0; i < vertexCount; i++) {
          allNormals.push(normals.getX(i), normals.getY(i), normals.getZ(i));
        }
      } else {
        for (let i = 0; i < vertexCount; i++) {
          allNormals.push(0, 1, 0);
        }
      }

      // Append colors (or generate default white)
      if (colors) {
        for (let i = 0; i < vertexCount; i++) {
          allColors.push(colors.getX(i), colors.getY(i), colors.getZ(i));
        }
      } else {
        for (let i = 0; i < vertexCount; i++) {
          allColors.push(1, 1, 1);
        }
      }

      // Append skin indices (Uint16 for bone indices)
      for (let i = 0; i < vertexCount; i++) {
        allSkinIndices.push(
          skinIndex.getX(i),
          skinIndex.getY(i),
          skinIndex.getZ(i),
          skinIndex.getW(i),
        );
      }

      // Append skin weights
      for (let i = 0; i < vertexCount; i++) {
        allSkinWeights.push(
          skinWeight.getX(i),
          skinWeight.getY(i),
          skinWeight.getZ(i),
          skinWeight.getW(i),
        );
      }

      // Append indices with offset
      if (indices) {
        for (let i = 0; i < indices.count; i++) {
          allIndices.push(indices.getX(i) + indexOffset);
        }
      } else {
        // Non-indexed geometry - generate indices
        for (let i = 0; i < vertexCount; i++) {
          allIndices.push(i + indexOffset);
        }
      }

      indexOffset += vertexCount;
    }

    // Create merged geometry
    const mergedGeometry = new THREE.BufferGeometry();
    mergedGeometry.setAttribute(
      "position",
      new THREE.Float32BufferAttribute(allPositions, 3),
    );
    mergedGeometry.setAttribute(
      "normal",
      new THREE.Float32BufferAttribute(allNormals, 3),
    );
    mergedGeometry.setAttribute(
      "color",
      new THREE.Float32BufferAttribute(allColors, 3),
    );
    mergedGeometry.setAttribute(
      "skinIndex",
      new THREE.Uint16BufferAttribute(allSkinIndices, 4),
    );
    mergedGeometry.setAttribute(
      "skinWeight",
      new THREE.Float32BufferAttribute(allSkinWeights, 4),
    );
    mergedGeometry.setIndex(allIndices);

    // Compute bounding geometry
    mergedGeometry.computeBoundingBox();
    mergedGeometry.computeBoundingSphere();

    // Use first mesh's material as base (all are vertex color only)
    const baseMaterial = meshes[0].material as THREE.Material;

    return {
      geometry: mergedGeometry,
      material: baseMaterial,
      skeleton,
      bindMatrix: meshes[0].bindMatrix.clone(),
    };
  }

  private cloneSkinnedMaterial(
    material: THREE.Material | THREE.Material[],
  ): THREE.Material | THREE.Material[] {
    if (Array.isArray(material)) {
      return material.map(
        (mat) => this.cloneSkinnedMaterial(mat) as THREE.Material,
      );
    }
    if (this.isVertexColorOnlyMaterial(material)) {
      const key = this.getVertexColorMaterialKey(material);
      const cached = this._sharedMaterialCache.get(key);
      if (cached) {
        return cached;
      }
      const shared = this.createDissolveMaterial(material);
      shared.vertexColors = true;
      this._sharedMaterialCache.set(key, shared);
      return shared;
    }
    return this.createDissolveMaterial(material);
  }

  /**
   * Create a dissolve-enabled material using TSL.
   * Clones the source material's visual properties onto a NodeMaterial
   * with GPU-driven dithered dissolve based on distance from player.
   * Supports both near and far camera dissolve.
   */
  private createDissolveMaterial(source: THREE.Material): MobDissolveMaterial {
    // Create TSL node material
    const material = new MeshStandardNodeMaterial();

    // Check if source is a PBR-like material (MeshStandardMaterial, MeshPhysicalMaterial, or MeshStandardNodeMaterial)
    const isPBRMaterial =
      source instanceof THREE.MeshStandardMaterial ||
      source instanceof THREE.MeshPhysicalMaterial ||
      (source as MeshStandardNodeMaterial).isMeshStandardNodeMaterial === true;

    // Copy properties from source material
    if (isPBRMaterial) {
      const pbrSource = source as
        | THREE.MeshStandardMaterial
        | MeshStandardNodeMaterial;
      material.color.copy(pbrSource.color);
      material.roughness = pbrSource.roughness;
      material.metalness = pbrSource.metalness;
      material.emissive.copy(pbrSource.emissive);
      material.emissiveIntensity = pbrSource.emissiveIntensity;
      material.vertexColors = pbrSource.vertexColors;
      material.side = pbrSource.side;
      material.transparent = false; // Cutout rendering
      material.depthWrite = true;
      material.opacity = 1.0;

      // Copy textures if present
      if (pbrSource.map) material.map = pbrSource.map;
      if (pbrSource.normalMap) material.normalMap = pbrSource.normalMap;
      if (pbrSource.emissiveMap) material.emissiveMap = pbrSource.emissiveMap;
      if (pbrSource.roughnessMap)
        material.roughnessMap = pbrSource.roughnessMap;
      if (pbrSource.metalnessMap)
        material.metalnessMap = pbrSource.metalnessMap;
      if ((pbrSource as THREE.MeshStandardMaterial).aoMap)
        material.aoMap = (pbrSource as THREE.MeshStandardMaterial).aoMap;
    } else {
      // Fallback for non-standard materials (e.g., VRM)
      material.color.set(0x888888);
      material.roughness = 0.8;
      material.metalness = 0.0;
    }

    // Create dissolve uniforms
    const uPlayerPos = uniform(new THREE.Vector3(0, 0, 0));

    // Use dynamic fade distances from instance
    const fadeStartSq = mul(
      float(this._fadeStartDistance),
      float(this._fadeStartDistance),
    );
    const fadeEndSq = mul(float(this._cullDistance), float(this._cullDistance));

    // Near fade distances (dissolve when camera too close)
    const nearFadeStart = float(1); // Start dissolving at 1m
    const nearFadeEnd = float(3); // Fully visible at 3m
    const nearFadeStartSq = mul(nearFadeStart, nearFadeStart);
    const nearFadeEndSq = mul(nearFadeEnd, nearFadeEnd);

    // ========== ALPHA TEST (DITHERED DISSOLVE) ==========
    material.alphaTestNode = Fn(() => {
      // World position after skinning transformation
      const worldPos = positionWorld;

      // Distance calculation from world position to player (horizontal only, squared)
      const toPlayer = sub(worldPos, uPlayerPos);
      const distSq = add(
        mul(toPlayer.x, toPlayer.x),
        mul(toPlayer.z, toPlayer.z),
      );

      // FAR fade: 0.0 when close (keep), 1.0 when far (discard)
      const farFade = smoothstep(fadeStartSq, fadeEndSq, distSq);

      // NEAR fade: 0.0 when outside near zone (keep), 1.0 when too close (discard)
      const nearFade = sub(
        float(1.0),
        smoothstep(nearFadeStartSq, nearFadeEndSq, distSq),
      );

      // Combined distance fade (max of near and far fade)
      const distanceFade = max(farFade, nearFade);

      // SCREEN-SPACE 4x4 BAYER DITHERING (RuneScape 3 style)
      // 4x4 Bayer matrix: [ 0, 8, 2,10; 12, 4,14, 6; 3,11, 1, 9; 15, 7,13, 5]/16
      const ix = mod(floor(viewportCoordinate.x), float(4.0));
      const iy = mod(floor(viewportCoordinate.y), float(4.0));

      const bit0_x = mod(ix, float(2.0));
      const bit1_x = floor(mul(ix, float(0.5)));
      const bit0_y = mod(iy, float(2.0));
      const bit1_y = floor(mul(iy, float(0.5)));
      const xor0 = abs(sub(bit0_x, bit0_y));
      const xor1 = abs(sub(bit1_x, bit1_y));

      const bayerInt = add(
        add(
          add(mul(xor0, float(8.0)), mul(bit0_y, float(4.0))),
          mul(xor1, float(2.0)),
        ),
        bit1_y,
      );
      const ditherValue = mul(bayerInt, float(0.0625));

      // RS3-style: discard when fade >= dither
      // step returns 0 or 1, multiply by 2 so threshold > 1.0 causes discard
      // Only apply when there's actual fade (prevents holes when distanceFade=0)
      const hasAnyFade = step(float(0.001), distanceFade);
      const threshold = mul(
        mul(step(ditherValue, distanceFade), hasAnyFade),
        float(2.0),
      );

      return threshold;
    })();

    // Material settings for cutout rendering
    material.alphaTest = 0.5; // Fallback
    material.forceSinglePass = true;

    // Attach dissolve uniforms for per-frame updates
    const dissolveMat = material as MobDissolveMaterial;
    dissolveMat._dissolveUniforms = { playerPos: uPlayerPos };
    this._dissolveMaterials.push(dissolveMat);

    this.world.setupMaterial(material);
    material.needsUpdate = true;

    return dissolveMat;
  }

  private isVertexColorOnlyMaterial(
    material: THREE.Material,
  ): material is
    | THREE.MeshStandardMaterial
    | THREE.MeshPhysicalMaterial
    | MeshStandardNodeMaterial {
    // Check if it's a PBR-like material (standard, physical, or node)
    const isPBRMaterial =
      material instanceof THREE.MeshStandardMaterial ||
      material instanceof THREE.MeshPhysicalMaterial ||
      (material as MeshStandardNodeMaterial).isMeshStandardNodeMaterial ===
        true;

    if (!isPBRMaterial) {
      return false;
    }

    // Cast to access PBR material properties
    const standard = material as
      | THREE.MeshStandardMaterial
      | MeshStandardNodeMaterial;
    const hasMaps = Boolean(
      standard.map ||
      standard.normalMap ||
      standard.emissiveMap ||
      standard.roughnessMap ||
      standard.metalnessMap ||
      (standard as THREE.MeshStandardMaterial).alphaMap ||
      (standard as THREE.MeshStandardMaterial).aoMap ||
      (standard as THREE.MeshStandardMaterial).lightMap,
    );
    return standard.vertexColors === true && !hasMaps;
  }

  private getVertexColorMaterialKey(
    material:
      | THREE.MeshStandardMaterial
      | THREE.MeshPhysicalMaterial
      | MeshStandardNodeMaterial,
  ): string {
    const color = material.color.getHex();
    const emissive = material.emissive.getHex();
    return [
      "vc",
      material.type,
      String(material.side),
      String(material.transparent),
      String(material.opacity),
      String(material.alphaTest),
      String(material.depthWrite),
      String(material.depthTest),
      String(material.roughness),
      String(material.metalness),
      String(material.emissiveIntensity),
      String(color),
      String(emissive),
      String(material.fog === true),
    ].join("|");
  }
}
