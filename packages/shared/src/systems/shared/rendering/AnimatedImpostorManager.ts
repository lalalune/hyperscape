/**
 * AnimatedImpostorManager.ts - Animated Impostor Generation & Management
 *
 * Handles animated impostors (walk cycles) for mobs and NPCs:
 * - Runtime baking of walk cycle animations
 * - Global mob atlas management for 1-draw-call rendering
 * - Integration with existing HLOD system
 *
 * **Architecture:**
 * - AnimatedImpostorBaker: Bakes walk cycles into texture arrays
 * - GlobalMobAtlasManager: Merges all mob atlases for efficient rendering
 * - InstancedAnimatedImpostor: GPU-instanced crowd rendering
 *
 * **Usage:**
 * ```ts
 * const manager = AnimatedImpostorManager.getInstance(world);
 * await manager.registerMob(modelId, mesh, mixer, walkClip);
 * // Later: use GlobalMobAtlasManager for instanced rendering
 * ```
 *
 * @module AnimatedImpostorManager
 */

import THREE from "../../../extras/three/three";
import {
  AnimatedImpostorBaker,
  GlobalMobAtlasManager,
  InstancedAnimatedImpostor,
  type AnimatedBakeResult,
  type GlobalMobAtlas,
  type InstancedAnimatedImpostorConfig,
  type MobInstanceData,
  type WebGPUCompatibleRenderer,
} from "@hyperforge/impostor";
import type { World } from "../../../types";

// ============================================================================
// CONFIGURATION
// ============================================================================

/**
 * TEMPORARY: Disable all animated mob impostors.
 * When true, animated mobs use GPU dissolve fade instead of animated impostor billboards.
 * Set to false to re-enable animated impostor system.
 */
const DISABLE_IMPOSTORS = true;

/**
 * Animated impostor configuration
 *
 * Uses minimal asymmetric grid (6x3 = 18 views) for maximum performance:
 * - 6 horizontal views (enough for yaw rotation around horizon)
 * - 3 vertical views (eye-level, slight up, slight down)
 * - 18 views vs 144 (12x12) = 87% fewer sprites, much faster baking
 */
export const ANIMATED_IMPOSTOR_CONFIG = {
  /** Atlas size per frame */
  ATLAS_SIZE: 512,
  /** Horizontal sprites (columns) - views around horizon */
  SPRITES_X: 6,
  /** Vertical sprites (rows) - minimal elevation variation */
  SPRITES_Y: 3,
  /** @deprecated Use SPRITES_X - backwards compatibility */
  SPRITES_PER_SIDE: 6,
  /** Animation FPS (low for memory efficiency) */
  ANIMATION_FPS: 6,
  /** Use hemisphere mapping (ground-viewed mobs) */
  HEMISPHERE: true,
  /** Maximum instances for instanced renderer */
  MAX_INSTANCES: 1000,
  /** Minimum time between bakes (ms) */
  MIN_BAKE_INTERVAL: 200,
} as const;

/**
 * Bake request for animated impostor
 */
interface AnimatedBakeRequest {
  modelId: string;
  source: THREE.Object3D;
  mixer: THREE.AnimationMixer;
  clip: THREE.AnimationClip;
  resolve: (result: AnimatedBakeResult) => void;
  reject: (error: Error) => void;
  timestamp: number;
}

/**
 * AnimatedImpostorManager - Manages animated impostor baking and rendering
 */
export class AnimatedImpostorManager {
  private static instance: AnimatedImpostorManager | null = null;

  private world: World;
  private baker: AnimatedImpostorBaker | null = null;
  private renderer: WebGPUCompatibleRenderer | null = null;
  private atlasManager = GlobalMobAtlasManager.getInstance();

  /** Instanced renderer for all mob impostors */
  private instancedRenderer: InstancedAnimatedImpostor | null = null;

  /** Baking queue */
  private bakeQueue: AnimatedBakeRequest[] = [];
  private baking = false;
  private lastBakeTime = 0;

  /** Pending registrations - prevents duplicate bakes when multiple entities spawn concurrently */
  private pendingRegistrations = new Set<string>();

  /** Frame timing for animation updates */
  private frameCounter = 0;
  private lastFrameTime = 0;
  private frameInterval = 1000 / ANIMATED_IMPOSTOR_CONFIG.ANIMATION_FPS;

  /** Statistics */
  private stats = {
    totalBaked: 0,
    totalInstances: 0,
  };

  private constructor(world: World) {
    this.world = world;
  }

  /**
   * Get or create the singleton instance
   */
  static getInstance(world: World): AnimatedImpostorManager {
    if (!AnimatedImpostorManager.instance) {
      AnimatedImpostorManager.instance = new AnimatedImpostorManager(world);
    }
    return AnimatedImpostorManager.instance;
  }

  /**
   * Initialize the baker
   * Must be called after renderer is available
   */
  initBaker(): boolean {
    if (this.baker) return true;

    // The renderer must be WebGPU - we need WebGPUCompatibleRenderer interface
    const graphics = this.world.graphics as
      | { renderer?: WebGPUCompatibleRenderer }
      | undefined;
    const renderer = graphics?.renderer;
    if (!renderer) {
      console.warn("[AnimatedImpostorManager] Cannot init baker: no renderer");
      return false;
    }

    this.renderer = renderer as WebGPUCompatibleRenderer;
    this.baker = new AnimatedImpostorBaker(this.renderer);
    console.log("[AnimatedImpostorManager] Baker initialized");
    return true;
  }

  /**
   * Auto-register an entity for animated impostors
   *
   * This is the main entry point for entities. It:
   * 1. Checks if the model type is already cached (shared across all instances)
   * 2. Bakes if not cached
   * 3. Returns immediately if already cached (no duplicate baking)
   *
   * The modelId should be based on the MODEL TYPE, not instance ID, e.g.:
   * - "mob_goblin" (all goblins share this)
   * - "npc_banker" (all bankers share this)
   * - "player_default" (all default player models share this)
   *
   * NOTE: When DISABLE_IMPOSTORS is true, this function returns false immediately.
   *
   * @param modelId - Model type identifier (NOT instance ID)
   * @param source - The animated mesh (used only if not cached)
   * @param mixer - AnimationMixer (used only if not cached)
   * @param walkClip - Walk cycle clip (used only if not cached)
   * @returns Promise resolving when registration is complete
   */
  async autoRegister(
    modelId: string,
    source: THREE.Object3D,
    mixer: THREE.AnimationMixer,
    walkClip: THREE.AnimationClip | null | undefined,
  ): Promise<boolean> {
    // Impostors disabled - using dissolve fade instead
    if (DISABLE_IMPOSTORS) return false;

    // Skip on server
    if (this.world.isServer) return false;

    // Already registered? Return immediately (cache hit)
    if (this.atlasManager.hasVariant(modelId)) {
      console.log(`[AnimatedImpostorManager] Cache hit: ${modelId}`);
      return true;
    }

    // RACE CONDITION FIX: If another call is already baking this model, wait for it
    if (this.pendingRegistrations.has(modelId)) {
      console.log(
        `[AnimatedImpostorManager] Waiting for pending registration: ${modelId}`,
      );
      // Wait for the existing bake to complete by polling
      return new Promise((resolve) => {
        const checkComplete = () => {
          if (this.atlasManager.hasVariant(modelId)) {
            resolve(true);
          } else if (!this.pendingRegistrations.has(modelId)) {
            // Bake failed
            resolve(false);
          } else {
            // Still pending, check again
            setTimeout(checkComplete, 100);
          }
        };
        checkComplete();
      });
    }

    // No walk clip? Can't bake animated impostor
    if (!walkClip) {
      console.warn(
        `[AnimatedImpostorManager] No walk clip for ${modelId}, skipping animated impostor`,
      );
      return false;
    }

    // Initialize baker if needed
    if (!this.initBaker()) {
      console.warn(`[AnimatedImpostorManager] Baker not ready for ${modelId}`);
      return false;
    }

    // Mark as pending to prevent concurrent bakes
    this.pendingRegistrations.add(modelId);

    try {
      // Queue for baking (will deduplicate if same model is requested multiple times)
      await this.registerMob(modelId, source, mixer, walkClip);

      // Rebuild the global atlas to include this new variant
      // (Creates instanced renderer on first rebuild, updates it on subsequent rebuilds)
      this.rebuildAtlas();

      return true;
    } catch (err) {
      console.warn(
        `[AnimatedImpostorManager] Failed to register ${modelId}:`,
        err,
      );
      return false;
    } finally {
      // Always clear pending state
      this.pendingRegistrations.delete(modelId);
    }
  }

  /**
   * Register a mob for animated impostor rendering
   *
   * Bakes the walk cycle and adds to global atlas.
   * Call rebuild() after registering all initial mobs.
   *
   * @param modelId - Unique identifier for this mob type
   * @param source - The animated mesh
   * @param mixer - AnimationMixer controlling the mesh
   * @param walkClip - Walk cycle animation clip
   * @returns Promise resolving to AnimatedBakeResult
   */
  async registerMob(
    modelId: string,
    source: THREE.Object3D,
    mixer: THREE.AnimationMixer,
    walkClip: THREE.AnimationClip,
  ): Promise<AnimatedBakeResult> {
    // Check if already registered
    if (this.atlasManager.hasVariant(modelId)) {
      console.log(
        `[AnimatedImpostorManager] Mob ${modelId} already registered`,
      );
      return this.atlasManager.waitForVariant(modelId);
    }

    console.log(`[AnimatedImpostorManager] Queuing mob for bake: ${modelId}`);

    // Queue for baking
    return new Promise((resolve, reject) => {
      const request: AnimatedBakeRequest = {
        modelId,
        source,
        mixer,
        clip: walkClip,
        resolve,
        reject,
        timestamp: Date.now(),
      };
      this.bakeQueue.push(request);
      this.processBakeQueue();
    });
  }

  /**
   * Process the bake queue
   */
  private async processBakeQueue(): Promise<void> {
    if (this.baking) return;
    if (this.bakeQueue.length === 0) return;

    const now = Date.now();
    if (now - this.lastBakeTime < ANIMATED_IMPOSTOR_CONFIG.MIN_BAKE_INTERVAL) {
      setTimeout(
        () => this.processBakeQueue(),
        ANIMATED_IMPOSTOR_CONFIG.MIN_BAKE_INTERVAL,
      );
      return;
    }

    this.baking = true;

    const request = this.bakeQueue.shift();
    if (!request) {
      this.baking = false;
      return;
    }

    try {
      const result = await this.bakeMob(request);
      request.resolve(result);
    } catch (error) {
      request.reject(error instanceof Error ? error : new Error(String(error)));
    }

    this.lastBakeTime = Date.now();
    this.baking = false;

    // Continue processing
    if (this.bakeQueue.length > 0) {
      setTimeout(
        () => this.processBakeQueue(),
        ANIMATED_IMPOSTOR_CONFIG.MIN_BAKE_INTERVAL,
      );
    }
  }

  /**
   * Bake a single mob's walk cycle
   */
  private async bakeMob(
    request: AnimatedBakeRequest,
  ): Promise<AnimatedBakeResult> {
    if (!this.initBaker() || !this.baker) {
      throw new Error("AnimatedImpostorManager: Baker not initialized");
    }

    const { modelId, source, mixer, clip } = request;

    console.log(`[AnimatedImpostorManager] Baking ${modelId}...`);

    const result = await this.baker.bakeWalkCycle(
      source,
      mixer,
      clip,
      modelId,
      {
        atlasSize: ANIMATED_IMPOSTOR_CONFIG.ATLAS_SIZE,
        spritesX: ANIMATED_IMPOSTOR_CONFIG.SPRITES_X,
        spritesY: ANIMATED_IMPOSTOR_CONFIG.SPRITES_Y,
        animationFPS: ANIMATED_IMPOSTOR_CONFIG.ANIMATION_FPS,
        hemisphere: ANIMATED_IMPOSTOR_CONFIG.HEMISPHERE,
      },
    );

    // Register with global atlas manager
    this.atlasManager.registerVariant(result);
    this.stats.totalBaked++;

    console.log(
      `[AnimatedImpostorManager] Baked ${modelId}: ${result.frameCount} frames (${ANIMATED_IMPOSTOR_CONFIG.SPRITES_X}x${ANIMATED_IMPOSTOR_CONFIG.SPRITES_Y} views)`,
    );

    return result;
  }

  /**
   * Rebuild the global mob atlas after registering mobs
   *
   * Call this after registering all initial mob types.
   * Returns the merged atlas for instanced rendering.
   */
  rebuildAtlas(): GlobalMobAtlas | null {
    const atlas = this.atlasManager.rebuild();

    if (atlas && !this.instancedRenderer) {
      this.createInstancedRenderer(atlas);
    } else if (atlas && this.instancedRenderer) {
      // Remove old renderer from scene before disposing
      const scene = this.world.stage?.scene;
      if (scene && this.instancedRenderer.parent === scene) {
        scene.remove(this.instancedRenderer);
      }
      this.instancedRenderer.dispose();
      // Create new renderer with updated atlas
      this.createInstancedRenderer(atlas);
    }

    return atlas;
  }

  /**
   * Create the instanced renderer and add to scene
   */
  private createInstancedRenderer(atlas: GlobalMobAtlas): void {
    const config: InstancedAnimatedImpostorConfig = {
      maxInstances: ANIMATED_IMPOSTOR_CONFIG.MAX_INSTANCES,
      atlas,
      scale: 1.0,
      alphaClamp: 0.05,
    };

    this.instancedRenderer = new InstancedAnimatedImpostor(config);
    this.instancedRenderer.visible = true;

    // Add to scene automatically
    const scene = this.world.stage?.scene;
    if (scene) {
      scene.add(this.instancedRenderer);
      console.log(
        `[AnimatedImpostorManager] Created instanced renderer and added to scene: ${ANIMATED_IMPOSTOR_CONFIG.MAX_INSTANCES} max instances`,
      );
    } else {
      console.warn(
        "[AnimatedImpostorManager] No scene available - instanced renderer not added",
      );
    }
  }

  /**
   * Get the instanced renderer mesh (add to scene)
   */
  getInstancedRenderer(): InstancedAnimatedImpostor | null {
    return this.instancedRenderer;
  }

  /**
   * Add a mob instance
   *
   * @param entityId - Unique entity identifier
   * @param modelId - Mob type identifier
   * @param data - Instance data (position, yaw, etc.)
   * @returns Instance index or -1 if failed
   */
  addInstance(
    entityId: string,
    modelId: string,
    data: Omit<MobInstanceData, "variantIndex">,
  ): number {
    if (!this.instancedRenderer) {
      console.warn("[AnimatedImpostorManager] Instanced renderer not ready");
      return -1;
    }

    const variantIndex = this.atlasManager.getVariantIndex(modelId);
    if (variantIndex === -1) {
      console.warn(`[AnimatedImpostorManager] Unknown variant: ${modelId}`);
      return -1;
    }

    const fullData: MobInstanceData = {
      ...data,
      variantIndex,
    };

    const index = this.instancedRenderer.addInstance(entityId, fullData);
    if (index !== -1) {
      this.stats.totalInstances++;
    }
    return index;
  }

  /**
   * Update a mob instance
   */
  updateInstance(
    entityId: string,
    data: Partial<Omit<MobInstanceData, "variantIndex">>,
  ): boolean {
    if (!this.instancedRenderer) return false;
    return this.instancedRenderer.updateInstance(entityId, data) !== -1;
  }

  /**
   * Remove a mob instance
   */
  removeInstance(entityId: string): boolean {
    if (!this.instancedRenderer) return false;

    const removed = this.instancedRenderer.removeInstance(entityId);
    if (removed) {
      this.stats.totalInstances--;
    }
    return removed;
  }

  /**
   * Check if entity has an instance
   */
  hasInstance(entityId: string): boolean {
    return this.instancedRenderer?.hasInstance(entityId) ?? false;
  }

  /**
   * Update animation frame (call every render frame)
   *
   * @param now - Current timestamp in milliseconds (performance.now())
   */
  update(now: number): void {
    if (!this.instancedRenderer) return;

    // Update frame at target FPS
    if (now - this.lastFrameTime >= this.frameInterval) {
      this.lastFrameTime = now;
      this.frameCounter++;
      this.instancedRenderer.setFrame(this.frameCounter);
    }
  }

  /**
   * Get current animation frame
   */
  getFrame(): number {
    return this.frameCounter;
  }

  /**
   * Check if a mob type is registered
   */
  isMobRegistered(modelId: string): boolean {
    return this.atlasManager.hasVariant(modelId);
  }

  /**
   * Get registered mob types
   */
  getRegisteredMobs(): string[] {
    return this.atlasManager.getRegisteredModels();
  }

  /**
   * Get statistics
   */
  getStats(): typeof this.stats & {
    queueLength: number;
    variantCount: number;
    activeInstances: number;
  } {
    return {
      ...this.stats,
      queueLength: this.bakeQueue.length,
      variantCount: this.atlasManager.getVariantCount(),
      activeInstances: this.instancedRenderer?.activeInstanceCount ?? 0,
    };
  }

  /**
   * Dispose of all resources
   */
  dispose(): void {
    // Remove instanced renderer from scene
    if (this.instancedRenderer) {
      const scene = this.world.stage?.scene;
      if (scene && this.instancedRenderer.parent === scene) {
        scene.remove(this.instancedRenderer);
      }
      this.instancedRenderer.dispose();
      this.instancedRenderer = null;
    }
    this.baker?.dispose();
    this.baker = null;
    this.atlasManager.dispose();
    this.bakeQueue = [];
    AnimatedImpostorManager.instance = null;
    console.log("[AnimatedImpostorManager] Disposed");
  }

  /**
   * Reset singleton (for testing)
   */
  static reset(): void {
    if (AnimatedImpostorManager.instance) {
      AnimatedImpostorManager.instance.dispose();
    }
    GlobalMobAtlasManager.reset();
  }
}

export default AnimatedImpostorManager;

// ============================================================================
// ENTITY INTEGRATION HELPERS
// ============================================================================

/**
 * Helper type for animated HLOD state on entities
 */
export interface AnimatedHLODState {
  /** Model ID for this mob type */
  modelId: string;
  /** Whether mob is currently showing as impostor */
  isImpostor: boolean;
  /** Whether registration with manager is pending */
  pending: boolean;
  /** Current LOD level */
  currentLOD: number; // 0 = full mesh, 1 = lod1, 2 = impostor, 3 = culled
  /** Cached bounding radius for impostor scale (computed once) */
  boundingRadius?: number;
  /** Per-entity LOD distances (overrides defaults) */
  lodDistances?: AnimatedLodDistances;
}

/**
 * LOD distances for animated impostor entities
 */
export const ANIMATED_LOD_DISTANCES = {
  /** Distance to switch from full mesh to animated impostor */
  IMPOSTOR_DISTANCE: 70,
  /** Distance to cull (stop rendering) */
  CULL_DISTANCE: 150,
  /** Hysteresis margin to prevent flickering */
  HYSTERESIS: 5,
} as const;

export type AnimatedLodDistances = {
  impostorDistance: number;
  cullDistance: number;
  hysteresis: number;
};

export const DEFAULT_ANIMATED_LOD_DISTANCES: AnimatedLodDistances = {
  impostorDistance: ANIMATED_LOD_DISTANCES.IMPOSTOR_DISTANCE,
  cullDistance: ANIMATED_LOD_DISTANCES.CULL_DISTANCE,
  hysteresis: ANIMATED_LOD_DISTANCES.HYSTERESIS,
};

/**
 * Helper function for entity animated HLOD integration
 *
 * Call this in your entity's spawn/setup to register the mob for animated impostors.
 *
 * @example
 * ```typescript
 * // In MobEntity.setupVRM() or similar:
 * await initEntityAnimatedHLOD(
 *   this.world,
 *   `mob_${this.config.mobType}`,
 *   this.mesh,
 *   this.mixer,
 *   walkClip
 * );
 * ```
 */
export async function initEntityAnimatedHLOD(
  world: World,
  modelId: string,
  source: THREE.Object3D,
  mixer: THREE.AnimationMixer,
  walkClip: THREE.AnimationClip,
): Promise<AnimatedBakeResult | null> {
  if (world.isServer) return null;

  const manager = AnimatedImpostorManager.getInstance(world);

  if (!manager.initBaker()) {
    console.warn(`[AnimatedHLOD] Cannot init for ${modelId}: baker not ready`);
    return null;
  }

  try {
    const result = await manager.registerMob(modelId, source, mixer, walkClip);
    console.log(`[AnimatedHLOD] Registered ${modelId}`);
    return result;
  } catch (err) {
    console.warn(`[AnimatedHLOD] Failed to register ${modelId}:`, err);
    return null;
  }
}

/**
 * Helper to add/update/remove animated impostor instance
 *
 * Call this in entity update loop based on camera distance.
 *
 * @example
 * ```typescript
 * // In MobEntity.clientUpdate():
 * updateEntityAnimatedHLOD(
 *   this.world,
 *   this.id,
 *   `mob_${this.config.mobType}`,
 *   this.node.position,
 *   this.node.rotation.y,
 *   cameraDistance,
 *   this.animatedHLODState
 * );
 * ```
 */
export function updateEntityAnimatedHLOD(
  world: World,
  entityId: string,
  modelId: string,
  position: THREE.Vector3,
  yaw: number,
  cameraDistance: number,
  state: AnimatedHLODState,
  mesh?: THREE.Object3D | null,
): void {
  if (world.isServer) return;

  const manager = AnimatedImpostorManager.getInstance(world);

  // Determine target LOD
  const distances = state.lodDistances ?? DEFAULT_ANIMATED_LOD_DISTANCES;
  let targetLOD: number;

  if (cameraDistance > distances.cullDistance) {
    targetLOD = 3; // Culled
  } else if (cameraDistance > distances.impostorDistance) {
    targetLOD = 2; // Impostor
  } else {
    targetLOD = 0; // Full mesh (skip LOD1 for animated mobs)
  }

  // Apply hysteresis
  if (state.currentLOD !== targetLOD) {
    const margin = distances.hysteresis;

    // Only transition if outside hysteresis zone
    if (targetLOD > state.currentLOD) {
      // Going to lower detail - use base distance
    } else {
      // Going to higher detail - require more distance change
      if (state.currentLOD === 2 && targetLOD === 0) {
        if (cameraDistance > distances.impostorDistance - margin) {
          return; // Stay at impostor
        }
      }
      if (state.currentLOD === 3 && targetLOD === 2) {
        if (cameraDistance > distances.cullDistance - margin) {
          return; // Stay culled
        }
      }
    }
  }

  // Handle LOD transition
  if (targetLOD !== state.currentLOD) {
    const wasImpostor = state.currentLOD === 2;
    const willBeImpostor = targetLOD === 2;

    if (willBeImpostor && !wasImpostor) {
      // Transition TO impostor - add instance
      const boundingRadius = mesh
        ? new THREE.Box3()
            .setFromObject(mesh)
            .getBoundingSphere(new THREE.Sphere()).radius
        : 1.0;

      manager.addInstance(entityId, modelId, {
        position,
        yaw,
        animationOffset: Math.random() * 6, // Random phase for desync
        scale: boundingRadius * 2, // Billboard size
        visible: true,
      });

      // Hide full mesh
      if (mesh) mesh.visible = false;
      state.isImpostor = true;
    } else if (wasImpostor && !willBeImpostor) {
      // Transition FROM impostor - remove instance
      manager.removeInstance(entityId);

      // Show full mesh
      if (mesh) mesh.visible = targetLOD !== 3;
      state.isImpostor = false;
    } else if (targetLOD === 3 && state.currentLOD !== 3) {
      // Transition to culled
      if (wasImpostor) {
        manager.removeInstance(entityId);
        state.isImpostor = false;
      }
      if (mesh) mesh.visible = false;
    } else if (state.currentLOD === 3 && targetLOD !== 3) {
      // Transition from culled
      if (mesh) mesh.visible = targetLOD !== 2;
    }

    state.currentLOD = targetLOD;
  }

  // Update instance position/yaw if showing as impostor
  if (state.isImpostor) {
    manager.updateInstance(entityId, {
      position,
      yaw,
    });
  }
}

/**
 * Clean up animated HLOD when entity is destroyed
 */
export function cleanupEntityAnimatedHLOD(
  world: World,
  entityId: string,
  state: AnimatedHLODState,
): void {
  if (world.isServer) return;

  if (state.isImpostor) {
    const manager = AnimatedImpostorManager.getInstance(world);
    manager.removeInstance(entityId);
  }
}
