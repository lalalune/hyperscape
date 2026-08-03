/**
 * AnimationLOD - Distance-Based Animation Update Throttling
 *
 * Reduces CPU/GPU load by throttling animation updates for distant entities.
 * classic MMORPG-style: Full animations up close, reduced/paused at distance.
 *
 * ## LOD Levels (from DISTANCE_CONSTANTS.ANIMATION_LOD)
 * - **Full**: <30m - Update every frame (60fps animation)
 * - **Half**: 30-60m - Update every other frame (30fps animation)
 * - **Quarter**: 60-80m - Update every 4th frame (15fps animation)
 * - **Frozen**: 80-100m - Completely frozen in idle pose (zero CPU work)
 * - **Culled**: >150m - Not rendered at all (uses entity-specific RENDER distance)
 *
 * ## Performance Impact
 * - Reduces animation mixer updates by 50-80% for typical scenes
 * - Reduces VRM avatar updates (expensive bone transforms)
 * - Reduces skeleton matrix updates
 * - Frozen state eliminates ALL skeleton CPU work for distant entities
 *
 * ## Usage
 * ```typescript
 * // In entity constructor - use preset for entity type
 * this.animLOD = new AnimationLOD(ANIMATION_LOD_PRESETS.MOB);
 *
 * // In clientUpdate
 * const lod = this.animLOD.update(playerDistance, deltaTime);
 * if (lod.shouldApplyRestPose) {
 *   // Freeze at current idle pose when entering frozen state
 *   // NOTE: Do NOT use skeleton.pose() - that resets to BIND pose (T-pose)
 *   // Instead, ensure idle animation is playing and call mixer.update(0)
 *   this.mixer.update(0); // Apply current animation frame
 * }
 * if (lod.shouldUpdate) {
 *   this.mixer.update(lod.effectiveDelta);
 * }
 * ```
 */

import { DISTANCE_CONSTANTS } from "../../constants/GameConstants";

/**
 * LOD configuration for animation updates
 */
export interface AnimationLODConfig {
  /** Distance for full animation (60fps) - default 30m */
  fullDistance: number;
  /** Distance for half-rate animation (30fps) - default 60m */
  halfDistance: number;
  /** Distance for quarter-rate animation (15fps) - default 100m */
  quarterDistance: number;
  /** Distance beyond which animations are frozen in idle pose - default 100m */
  freezeDistance: number;
  /** Distance beyond which entity should be culled - default 150m */
  cullDistance: number;
  /** @deprecated Use freezeDistance instead. Kept for backward compatibility */
  pauseDistance?: number;
}

/**
 * LOD update result
 */
export interface AnimationLODResult {
  /** Whether animation should be updated this frame */
  shouldUpdate: boolean;
  /** Effective delta time to use (may be accumulated for skipped frames) */
  effectiveDelta: number;
  /** Current LOD level (0=full, 1=half, 2=quarter, 3=frozen, 4=culled) */
  lodLevel: number;
  /** Squared distance (for additional optimizations) */
  distanceSq: number;
  /** Whether the skeleton should be frozen (skip ALL bone updates) */
  shouldFreeze: boolean;
  /** Whether to apply rest/idle pose (true only on transition INTO frozen state) */
  shouldApplyRestPose: boolean;
  /** Whether entity should be culled (not rendered at all) */
  shouldCull: boolean;
}

/** LOD level constants for clearer code */
export const LOD_LEVEL = {
  FULL: 0,
  HALF: 1,
  QUARTER: 2,
  FROZEN: 3,
  CULLED: 4,
} as const;

/**
 * Default LOD configuration - uses centralized DISTANCE_CONSTANTS
 * Animation LOD values are shared across entity types for consistent behavior.
 * The cull distance is entity-specific (use ANIMATION_LOD_PRESETS for defaults).
 */
export const DEFAULT_ANIMATION_LOD_CONFIG: AnimationLODConfig = {
  fullDistance: DISTANCE_CONSTANTS.ANIMATION_LOD.FULL, // 30m - Full 60fps animation
  halfDistance: DISTANCE_CONSTANTS.ANIMATION_LOD.HALF, // 60m - 30fps animation
  quarterDistance: DISTANCE_CONSTANTS.ANIMATION_LOD.QUARTER, // 80m - 15fps animation
  freezeDistance: DISTANCE_CONSTANTS.ANIMATION_LOD.FROZEN, // 100m - Frozen in idle pose
  cullDistance: DISTANCE_CONSTANTS.ANIMATION_LOD.CULLED, // 150m - Default cull distance
};

/**
 * Entity-specific LOD presets.
 * Animation LOD levels are shared, but cull distance matches entity render distance.
 * This ensures entities fade out at the same distance they stop animating.
 */
export const ANIMATION_LOD_PRESETS = {
  /** Mob animation LOD - cull at 150m (matches MOB render distance) */
  MOB: {
    fullDistance: DISTANCE_CONSTANTS.ANIMATION_LOD.FULL,
    halfDistance: DISTANCE_CONSTANTS.ANIMATION_LOD.HALF,
    quarterDistance: DISTANCE_CONSTANTS.ANIMATION_LOD.QUARTER,
    freezeDistance: DISTANCE_CONSTANTS.ANIMATION_LOD.FROZEN,
    cullDistance: DISTANCE_CONSTANTS.RENDER.MOB,
  } as AnimationLODConfig,

  /** NPC animation LOD - cull at 120m (matches NPC render distance) */
  NPC: {
    fullDistance: DISTANCE_CONSTANTS.ANIMATION_LOD.FULL,
    halfDistance: DISTANCE_CONSTANTS.ANIMATION_LOD.HALF,
    quarterDistance: DISTANCE_CONSTANTS.ANIMATION_LOD.QUARTER,
    freezeDistance: DISTANCE_CONSTANTS.ANIMATION_LOD.FROZEN,
    cullDistance: DISTANCE_CONSTANTS.RENDER.NPC,
  } as AnimationLODConfig,

  /** Player animation LOD - cull at 200m (matches PLAYER render distance) */
  PLAYER: {
    fullDistance: DISTANCE_CONSTANTS.ANIMATION_LOD.FULL,
    halfDistance: DISTANCE_CONSTANTS.ANIMATION_LOD.HALF,
    quarterDistance: DISTANCE_CONSTANTS.ANIMATION_LOD.QUARTER,
    freezeDistance: DISTANCE_CONSTANTS.ANIMATION_LOD.FROZEN,
    cullDistance: DISTANCE_CONSTANTS.RENDER.PLAYER,
  } as AnimationLODConfig,
} as const;

/**
 * Default result for when camera position is unavailable.
 * Frozen constant - always update at full rate with no throttling.
 * Used to avoid allocating a new object each frame.
 */
export const ANIMATION_LOD_ALWAYS_UPDATE = Object.freeze({
  shouldUpdate: true,
  effectiveDelta: 0, // Caller should replace with actual delta
  lodLevel: LOD_LEVEL.FULL,
  distanceSq: 0,
  shouldFreeze: false,
  shouldApplyRestPose: false,
  shouldCull: false,
} as const) satisfies Readonly<Omit<AnimationLODResult, "effectiveDelta">> & {
  effectiveDelta: number;
};

/**
 * AnimationLOD - Manages distance-based animation update throttling
 */
export class AnimationLOD {
  private config: AnimationLODConfig;

  // LOD state
  private frameCounter: number = 0;
  private accumulatedDelta: number = 0;
  private lastLodLevel: number = 0;

  // Pre-computed squared distances for fast comparison (avoid sqrt)
  private fullDistanceSq: number;
  private halfDistanceSq: number;
  private quarterDistanceSq: number;
  private freezeDistanceSq: number;
  private cullDistanceSq: number;

  // Reusable result object to avoid allocations
  private readonly _result: AnimationLODResult = {
    shouldUpdate: true,
    effectiveDelta: 0,
    lodLevel: 0,
    distanceSq: 0,
    shouldFreeze: false,
    shouldApplyRestPose: false,
    shouldCull: false,
  };

  constructor(config: Partial<AnimationLODConfig> = {}) {
    // Backward compatibility: pauseDistance -> freezeDistance
    if (
      config.pauseDistance !== undefined &&
      config.freezeDistance === undefined
    ) {
      config.freezeDistance = config.pauseDistance;
    }
    this.config = { ...DEFAULT_ANIMATION_LOD_CONFIG, ...config };

    // Pre-compute squared distances
    this.fullDistanceSq = this.config.fullDistance ** 2;
    this.halfDistanceSq = this.config.halfDistance ** 2;
    this.quarterDistanceSq = this.config.quarterDistance ** 2;
    this.freezeDistanceSq = this.config.freezeDistance ** 2;
    this.cullDistanceSq = this.config.cullDistance ** 2;
  }

  /**
   * Update LOD state and determine if animation should update this frame
   *
   * @param distanceSq - Squared distance to camera/player (use squared to avoid sqrt)
   * @param deltaTime - Frame delta time in seconds
   * @returns LOD result with shouldUpdate flag, freeze state, and effective delta
   */
  update(distanceSq: number, deltaTime: number): AnimationLODResult {
    // Determine LOD level and update interval based on distance
    let lodLevel: number;
    let updateInterval: number;

    if (distanceSq <= this.fullDistanceSq) {
      lodLevel = LOD_LEVEL.FULL;
      updateInterval = 1;
    } else if (distanceSq <= this.halfDistanceSq) {
      lodLevel = LOD_LEVEL.HALF;
      updateInterval = 2;
    } else if (distanceSq <= this.quarterDistanceSq) {
      lodLevel = LOD_LEVEL.QUARTER;
      updateInterval = 4;
    } else if (distanceSq <= this.freezeDistanceSq) {
      lodLevel = LOD_LEVEL.FROZEN;
      updateInterval = 0;
    } else {
      lodLevel = LOD_LEVEL.CULLED;
      updateInterval = 0;
    }

    // Track transition into frozen state
    const justEnteredFreeze =
      lodLevel === LOD_LEVEL.FROZEN && this.lastLodLevel < LOD_LEVEL.FROZEN;

    // Accumulate time and frame count
    this.accumulatedDelta += deltaTime;
    this.frameCounter++;

    // Reset on LOD change to prevent time jumps
    if (lodLevel !== this.lastLodLevel) {
      this.accumulatedDelta = deltaTime;
      this.frameCounter = 0;
      this.lastLodLevel = lodLevel;
    }

    // Calculate update decision
    let shouldUpdate: boolean;
    let effectiveDelta: number;

    if (lodLevel >= LOD_LEVEL.FROZEN) {
      shouldUpdate = false;
      effectiveDelta = 0;
    } else if (lodLevel === LOD_LEVEL.FULL) {
      shouldUpdate = true;
      effectiveDelta = deltaTime;
      this.accumulatedDelta = 0;
    } else {
      shouldUpdate = this.frameCounter % updateInterval === 0;
      effectiveDelta = shouldUpdate ? this.accumulatedDelta : 0;
      if (shouldUpdate) this.accumulatedDelta = 0;
    }

    // Populate reusable result object
    this._result.shouldUpdate = shouldUpdate;
    this._result.effectiveDelta = effectiveDelta;
    this._result.lodLevel = lodLevel;
    this._result.distanceSq = distanceSq;
    this._result.shouldFreeze = lodLevel >= LOD_LEVEL.FROZEN;
    this._result.shouldApplyRestPose = justEnteredFreeze;
    this._result.shouldCull = lodLevel >= LOD_LEVEL.CULLED;

    return this._result;
  }

  /**
   * Update LOD using world position vectors
   * Convenience method that computes squared distance from positions
   *
   * @param entityX - Entity world X position
   * @param entityZ - Entity world Z position
   * @param cameraX - Camera/player world X position
   * @param cameraZ - Camera/player world Z position
   * @param deltaTime - Frame delta time in seconds
   * @returns LOD result
   */
  updateFromPosition(
    entityX: number,
    entityZ: number,
    cameraX: number,
    cameraZ: number,
    deltaTime: number,
  ): AnimationLODResult {
    // Use only XZ distance (ignore Y - entity could be at different elevation)
    const dx = entityX - cameraX;
    const dz = entityZ - cameraZ;
    const distanceSq = dx * dx + dz * dz;

    return this.update(distanceSq, deltaTime);
  }

  /**
   * Force reset LOD state
   * Call when entity teleports or spawns
   */
  reset(): void {
    this.frameCounter = 0;
    this.accumulatedDelta = 0;
    this.lastLodLevel = 0;
  }

  /**
   * Get current LOD level without updating
   */
  getCurrentLevel(): number {
    return this.lastLodLevel;
  }

  /**
   * Check if currently frozen (animation completely stopped, using rest pose)
   */
  isFrozen(): boolean {
    return this.lastLodLevel >= LOD_LEVEL.FROZEN;
  }

  /**
   * Check if currently paused (at max LOD level)
   * @deprecated Use isFrozen() instead
   */
  isPaused(): boolean {
    return this.lastLodLevel >= LOD_LEVEL.FROZEN;
  }

  /**
   * Check if should be culled (not rendered)
   */
  isCulled(): boolean {
    return this.lastLodLevel >= LOD_LEVEL.CULLED;
  }

  /**
   * Get the freeze distance squared (for external culling checks)
   */
  getFreezeDistanceSq(): number {
    return this.freezeDistanceSq;
  }

  /**
   * Get the cull distance squared (for external culling checks)
   */
  getCullDistanceSq(): number {
    return this.cullDistanceSq;
  }

  /**
   * Update configuration (recalculates squared distances)
   */
  setConfig(config: Partial<AnimationLODConfig>): void {
    // Backward compatibility: pauseDistance -> freezeDistance
    if (
      config.pauseDistance !== undefined &&
      config.freezeDistance === undefined
    ) {
      config.freezeDistance = config.pauseDistance;
    }
    Object.assign(this.config, config);
    this.fullDistanceSq = this.config.fullDistance ** 2;
    this.halfDistanceSq = this.config.halfDistance ** 2;
    this.quarterDistanceSq = this.config.quarterDistance ** 2;
    this.freezeDistanceSq = this.config.freezeDistance ** 2;
    this.cullDistanceSq = this.config.cullDistance ** 2;
  }
}

/**
 * Get camera position from world for LOD calculations
 * Utility function to avoid repeated code in entities
 *
 * @param world - World instance
 * @returns Camera position or null if not available
 */
export function getCameraPosition(world: {
  camera?: { position?: { x: number; y: number; z: number } };
}): { x: number; z: number } | null {
  if (!world.camera?.position) return null;
  return { x: world.camera.position.x, z: world.camera.position.z };
}

/**
 * Compute squared distance between two XZ positions
 * Optimized: Avoids sqrt for fast distance comparison
 *
 * @param ax - First position X
 * @param az - First position Z
 * @param bx - Second position X
 * @param bz - Second position Z
 * @returns Squared distance
 */
export function distanceSquaredXZ(
  ax: number,
  az: number,
  bx: number,
  bz: number,
): number {
  const dx = ax - bx;
  const dz = az - bz;
  return dx * dx + dz * dz;
}
