/**
 * Tile Interpolator - RuneScape-Style Movement
 *
 * OSRS Movement Model (from research):
 * 1. Server calculates full BFS path
 * 2. Server sends FULL PATH to client in tileMovementStart
 * 3. Client walks through path at FIXED SPEED (doesn't wait for individual updates)
 * 4. Server sends position sync every 600ms tick
 * 5. Client uses server updates for verification/sync only
 *
 * Key Insight: The client PREDICTS movement by walking through the known path.
 * Server updates just confirm the prediction is correct.
 *
 * Movement Speeds (configurable via TileSystem constants):
 * - Walking: TILES_PER_TICK_WALK tiles per 600ms tick
 * - Running: TILES_PER_TICK_RUN tiles per 600ms tick
 *
 */

import * as THREE from "three";
import {
  TileCoord,
  TICK_DURATION_MS,
  TILES_PER_TICK_WALK,
  TILES_PER_TICK_RUN,
  tilesEqual,
  worldToTile,
  tileToWorld,
} from "../shared/movement/TileSystem";

// Movement speeds in tiles per second (derived from server tick rate)
// Server moves TILES_PER_TICK tiles per TICK_DURATION_MS
const WALK_SPEED = TILES_PER_TICK_WALK / (TICK_DURATION_MS / 1000); // tiles/sec
const RUN_SPEED = TILES_PER_TICK_RUN / (TICK_DURATION_MS / 1000); // tiles/sec

// How close we need to be to consider "at" a tile
const TILE_ARRIVAL_THRESHOLD = 0.02;

// Maximum distance from server position before we snap (teleport detection)
// Should be larger than max tiles moved per tick to avoid false snaps
const MAX_DESYNC_DISTANCE = Math.max(TILES_PER_TICK_RUN * 2, 8);

// Exponential smoothing time constant for catch-up multiplier blending
// Larger = slower/smoother transitions, smaller = faster/snappier
// Using exponential decay: alpha = 1 - exp(-deltaTime / TIME_CONSTANT)
const CATCHUP_SMOOTHING_RATE = 8.0; // ~125ms to reach 63% of target (1/8 second time constant)
// Maximum multiplier change per second to prevent jarring jumps during lag spikes
const CATCHUP_MAX_CHANGE_PER_SEC = 3.0; // Can change by at most 3.0 per second

// Rotation slerp speed - how fast character turns toward target direction
// Higher = faster rotation, lower = smoother/slower rotation
// 12.0 = ~90% of rotation completed in ~0.2 seconds (responsive but smooth)
const ROTATION_SLERP_SPEED = 12.0;

// Emotes that are controlled by TileInterpolator (movement-related)
// Other emotes like "chopping", "combat", "death" etc. should NOT be overridden
// TileInterpolator only resets to idle if current emote is a movement emote
const MOVEMENT_EMOTES = new Set<string | undefined | null>([
  "walk",
  "run",
  "idle",
  undefined,
  null,
  "",
]);

/**
 * Movement state for a single entity
 */
interface EntityMovementState {
  // ========== Path State ==========
  // Full path from server (all tiles to walk through)
  fullPath: TileCoord[];
  // Index of the tile we're currently moving TOWARD (0 = first destination tile)
  targetTileIndex: number;
  // The intended final destination tile (authoritative from server)
  // This ensures we always end at the clicked tile even if path calculation differs
  destinationTile: TileCoord | null;

  // ========== Visual State ==========
  // Current interpolated world position (what we render)
  visualPosition: THREE.Vector3;
  // Target world position (current target tile in world coords)
  targetWorldPos: THREE.Vector3;
  // Current visual rotation (what we render, smoothly interpolated via slerp)
  quaternion: THREE.Quaternion;
  // Target rotation (what we're rotating toward)
  targetQuaternion: THREE.Quaternion;

  // ========== Movement State ==========
  // Whether entity is running (affects speed)
  isRunning: boolean;
  // Whether entity is actively moving
  isMoving: boolean;
  // Current emote (walk/run/idle)
  emote: string;

  // ========== Sync State ==========
  // Last tile confirmed by server
  serverConfirmedTile: TileCoord;
  // Last tick number from server
  lastServerTick: number;
  // Catch-up multiplier for when client is behind server (current, smoothly lerped)
  // 1.0 = normal speed, >1.0 = catching up
  catchUpMultiplier: number;
  // Target catch-up multiplier (set by sync logic, current lerps toward this)
  // Smooth blending prevents jarring speed changes
  targetCatchUpMultiplier: number;
  // Movement sequence number - used to ignore stale packets from previous movements
  // Incremented on server each time a new path starts
  moveSeq: number;
}

/**
 * Client-side tile interpolator using OSRS's full-path prediction model
 *
 * The client receives the full path and walks through it at fixed speed.
 * Server updates are used for verification/sync only, not for driving movement.
 */
export class TileInterpolator {
  private entityStates: Map<string, EntityMovementState> = new Map();
  private debugMode = false;

  // Reusable vectors
  private _tempDir = new THREE.Vector3();
  private _tempQuat = new THREE.Quaternion();
  // Y-axis for yaw rotation
  private _up = new THREE.Vector3(0, 1, 0);

  /**
   * Calculate Chebyshev distance between two tiles (max of dx, dz)
   */
  private tileDistance(tileA: TileCoord, tileB: TileCoord): number {
    const dx = Math.abs(tileA.x - tileB.x);
    const dz = Math.abs(tileA.z - tileB.z);
    return Math.max(dx, dz);
  }

  /**
   * Calculate rotation quaternion to face from one position to another
   * Uses atan2 for stable yaw calculation (avoids setFromUnitVectors instability)
   * Returns null if distance is too small to determine direction
   */
  private calculateFacingRotation(
    from: THREE.Vector3,
    to: THREE.Vector3,
  ): THREE.Quaternion | null {
    const dx = to.x - from.x;
    const dz = to.z - from.z;

    // Distance too small to determine direction - preserve existing rotation
    if (Math.abs(dx) + Math.abs(dz) < 0.01) {
      return null;
    }

    // Use atan2 for stable yaw calculation
    // VRM faces -Z after factory rotation. Rotating -Z by yaw θ around Y gives:
    // (-sin(θ), 0, -cos(θ)). To face direction (dx, dz), solve:
    // -sin(θ) = dx, -cos(θ) = dz → θ = atan2(-dx, -dz)
    const yaw = Math.atan2(-dx, -dz);

    // Create quaternion from Y-axis rotation (yaw only)
    this._tempQuat.setFromAxisAngle(this._up, yaw);
    return this._tempQuat;
  }

  /**
   * Called when server sends a movement path started
   * This is the PRIMARY way movement begins - client receives full path
   *
   * Server is AUTHORITATIVE - client follows server path exactly, no recalculation.
   * If client visual position differs from server's startTile, catch-up multiplier handles it.
   *
   * @param startTile Server's authoritative starting tile (where server knows entity IS)
   * @param destinationTile Final target tile for verification
   * @param moveSeq Movement sequence number for packet ordering
   * @param emote Optional emote bundled with movement (OSRS-style)
   */
  onMovementStart(
    entityId: string,
    path: TileCoord[],
    running: boolean,
    currentPosition?: THREE.Vector3,
    startTile?: TileCoord,
    destinationTile?: TileCoord,
    moveSeq?: number,
    emote?: string,
  ): void {
    if (this.debugMode) {
      console.log(
        `[TileInterpolator] onMovementStart: ${entityId}, startTile=${startTile ? `(${startTile.x},${startTile.z})` : "none"}, path=${path.length} tiles, running=${running}, dest=${destinationTile ? `(${destinationTile.x},${destinationTile.z})` : "none"}, moveSeq=${moveSeq}`,
      );
    }

    // Get existing state to check moveSeq
    const existingState = this.entityStates.get(entityId);

    // If we have moveSeq and existing state, validate sequence
    // Ignore stale start packets from previous movements
    if (
      moveSeq !== undefined &&
      existingState &&
      existingState.moveSeq > moveSeq
    ) {
      if (this.debugMode) {
        console.log(
          `[TileInterpolator] Ignoring stale onMovementStart: moveSeq ${moveSeq} < current ${existingState.moveSeq}`,
        );
      }
      return;
    }

    if (path.length === 0) {
      // No path - clear any existing state
      this.entityStates.delete(entityId);
      return;
    }

    // Get or create state
    let state = this.entityStates.get(entityId);

    // Starting visual position for interpolation
    // Prioritize current visual position for smooth path interruption
    const startPos =
      state?.visualPosition?.clone() ||
      currentPosition?.clone() ||
      new THREE.Vector3();

    // SERVER PATH IS AUTHORITATIVE - no client path calculation
    // Server sends complete path from its known position. Client follows exactly.
    // If client visual position differs from server's startTile, catch-up multiplier handles sync.
    const finalPath = path.map((t) => ({ ...t }));

    // Ensure destination is included (authoritative from server)
    if (destinationTile) {
      const lastTileInPath = finalPath[finalPath.length - 1];
      if (!lastTileInPath || !tilesEqual(lastTileInPath, destinationTile)) {
        finalPath.push({ ...destinationTile });
        if (this.debugMode) {
          console.log(
            `[TileInterpolator] Appended destination tile (${destinationTile.x},${destinationTile.z}) to path`,
          );
        }
      }
    }

    // If we ended up with no path, nothing to do
    if (finalPath.length === 0) {
      return;
    }

    // Calculate rotation to face DESTINATION (not first tile in path)
    // When spam clicking, server's path starts from its known position which may be
    // behind the client's visual position. Using first tile could cause facing backward.
    // Instead, face the destination - this matches OSRS behavior (face where you clicked).
    const firstTileWorld = tileToWorld(finalPath[0]);
    const rotationTargetTile =
      destinationTile || finalPath[finalPath.length - 1];
    const rotationTargetWorld = tileToWorld(rotationTargetTile);
    const initialRotation =
      this.calculateFacingRotation(
        startPos,
        new THREE.Vector3(
          rotationTargetWorld.x,
          startPos.y,
          rotationTargetWorld.z,
        ),
      ) ?? new THREE.Quaternion(); // Default to identity if too close

    // Use server's startTile for confirmed position tracking
    const serverConfirmed = startTile ?? worldToTile(startPos.x, startPos.z);

    if (state) {
      // Update existing state with new path
      state.fullPath = finalPath;
      state.targetTileIndex = 0;
      state.destinationTile = destinationTile ? { ...destinationTile } : null;
      state.visualPosition.copy(startPos);
      state.targetWorldPos.set(firstTileWorld.x, startPos.y, firstTileWorld.z);
      // DON'T snap quaternion - keep current visual rotation for smooth turn
      // Set target rotation - slerp will smoothly rotate toward it
      state.targetQuaternion.copy(initialRotation);
      state.isRunning = running;
      state.isMoving = true;
      state.emote = emote ?? (running ? "run" : "walk");
      state.serverConfirmedTile = { ...serverConfirmed };
      state.lastServerTick = 0;
      state.catchUpMultiplier = 1.0;
      state.targetCatchUpMultiplier = 1.0;
      state.moveSeq = moveSeq ?? state.moveSeq;
    } else {
      // Create new state - set both quaternion and target to initial (no slerp needed for first movement)
      state = {
        fullPath: finalPath,
        targetTileIndex: 0,
        destinationTile: destinationTile ? { ...destinationTile } : null,
        visualPosition: startPos.clone(),
        targetWorldPos: new THREE.Vector3(
          firstTileWorld.x,
          startPos.y,
          firstTileWorld.z,
        ),
        quaternion: initialRotation.clone(),
        targetQuaternion: initialRotation.clone(),
        isRunning: running,
        isMoving: true,
        emote: emote ?? (running ? "run" : "walk"),
        serverConfirmedTile: { ...serverConfirmed },
        lastServerTick: 0,
        catchUpMultiplier: 1.0,
        targetCatchUpMultiplier: 1.0,
        moveSeq: moveSeq ?? 0,
      };
      this.entityStates.set(entityId, state);
    }

    if (this.debugMode) {
      console.log(
        `[TileInterpolator] Path set: ${finalPath.map((t) => `(${t.x},${t.z})`).join(" -> ")}`,
      );
    }
  }

  /**
   * Called when server sends a tile position update (every 600ms tick)
   * This is for SYNC/VERIFICATION only - not the primary movement driver
   *
   * @param moveSeq Movement sequence number for packet ordering
   */
  onTileUpdate(
    entityId: string,
    serverTile: TileCoord,
    worldPos: THREE.Vector3,
    emote: string,
    quaternion?: number[],
    entityCurrentPos?: THREE.Vector3,
    tickNumber?: number,
    moveSeq?: number,
  ): void {
    const state = this.entityStates.get(entityId);

    // Validate moveSeq if provided - ignore stale packets from previous movements
    if (moveSeq !== undefined && state && state.moveSeq > moveSeq) {
      if (this.debugMode) {
        console.log(
          `[TileInterpolator] Ignoring stale onTileUpdate: moveSeq ${moveSeq} < current ${state.moveSeq}`,
        );
      }
      return;
    }

    if (!state) {
      // No active path - this might be a sync update for a stationary entity
      // IMPORTANT: Use entity's current visual position if available, not server position
      // This prevents teleporting to wrong location when state is first created
      const currentPos = entityCurrentPos || worldPos;

      // Check if server position is very different from current position
      const currentTile = worldToTile(currentPos.x, currentPos.z);
      const dist = Math.max(
        Math.abs(currentTile.x - serverTile.x),
        Math.abs(currentTile.z - serverTile.z),
      );

      // If large discrepancy and we have entity position, trust entity over server
      const usePos =
        dist > MAX_DESYNC_DISTANCE && entityCurrentPos
          ? entityCurrentPos
          : worldPos;

      if (dist > MAX_DESYNC_DISTANCE && entityCurrentPos) {
        console.warn(
          `[TileInterpolator] Creating state: large discrepancy (${dist} tiles). Using entity pos (${currentTile.x},${currentTile.z}) not server (${serverTile.x},${serverTile.z})`,
        );
      }

      const initialQuat = quaternion
        ? new THREE.Quaternion(
            quaternion[0],
            quaternion[1],
            quaternion[2],
            quaternion[3],
          )
        : new THREE.Quaternion();
      const newState: EntityMovementState = {
        fullPath: [],
        targetTileIndex: 0,
        destinationTile: null,
        visualPosition: usePos.clone(),
        targetWorldPos: usePos.clone(),
        quaternion: initialQuat.clone(),
        targetQuaternion: initialQuat.clone(),
        isRunning: emote === "run",
        isMoving: false,
        emote: emote,
        serverConfirmedTile: { ...serverTile },
        lastServerTick: tickNumber ?? 0,
        catchUpMultiplier: 1.0,
        targetCatchUpMultiplier: 1.0,
        moveSeq: moveSeq ?? 0,
      };
      this.entityStates.set(entityId, newState);
      return;
    }

    // Ignore out-of-order packets
    if (tickNumber !== undefined && tickNumber <= state.lastServerTick) {
      if (this.debugMode) {
        console.log(
          `[TileInterpolator] Ignoring old tick ${tickNumber} <= ${state.lastServerTick}`,
        );
      }
      return;
    }

    if (tickNumber !== undefined) {
      state.lastServerTick = tickNumber;
    }

    // Update server confirmed position
    state.serverConfirmedTile = { ...serverTile };

    // Update emote/running state from server
    state.emote = emote;
    state.isRunning = emote === "run";

    // DON'T update rotation from server while actively moving
    // Client calculates rotation based on interpolated position for smooth visuals
    // Server rotation would cause brief twitches since it's calculated at discrete tile positions
    // Only accept server rotation when NOT moving (path empty or completed)
    if (quaternion && state.fullPath.length === 0) {
      state.quaternion.set(
        quaternion[0],
        quaternion[1],
        quaternion[2],
        quaternion[3],
      );
    }

    // Check if we have a path
    if (state.fullPath.length === 0) {
      // No path - sync to tile center (with server's Y for terrain height)
      const tileCenter = tileToWorld(serverTile);
      state.visualPosition.x = tileCenter.x;
      state.visualPosition.z = tileCenter.z;
      state.visualPosition.y = worldPos.y;
      state.targetWorldPos.copy(state.visualPosition);
      state.isMoving = false;
      return;
    }

    // Find where the server tile is in our path
    const serverTileInPath = state.fullPath.findIndex((t) =>
      tilesEqual(t, serverTile),
    );

    if (serverTileInPath >= 0) {
      // Server confirms a tile in our path - check if we're in sync
      const visualTile = worldToTile(
        state.visualPosition.x,
        state.visualPosition.z,
      );
      const visualTileInPath = state.fullPath.findIndex((t) =>
        tilesEqual(t, visualTile),
      );

      // How far ahead/behind are we?
      const tileDiff = serverTileInPath - visualTileInPath;

      if (this.debugMode && Math.abs(tileDiff) > 1) {
        console.log(
          `[TileInterpolator] Sync check: visual at path[${visualTileInPath}], server at path[${serverTileInPath}], diff=${tileDiff}`,
        );
      }

      // SMOOTH CATCH-UP: Instead of instant teleporting, use speed multiplier
      // This prevents visual "jumping" while still keeping client in sync
      if (tileDiff > 6) {
        // SEVERE LAG: More than 6 tiles behind - must teleport to avoid rubber-banding
        if (this.debugMode) {
          console.log(
            `[TileInterpolator] Severe lag (${tileDiff} tiles behind), jumping to server tile center`,
          );
        }
        // Jump to server tile center (not raw worldPos to avoid off-center positions)
        const serverTileCenter = tileToWorld(serverTile);
        state.visualPosition.x = serverTileCenter.x;
        state.visualPosition.z = serverTileCenter.z;
        state.visualPosition.y = worldPos.y; // Use server's terrain height
        state.targetTileIndex = Math.min(
          serverTileInPath + 1,
          state.fullPath.length,
        );
        // Instant reset after teleport - no need to blend
        state.catchUpMultiplier = 1.0;
        state.targetCatchUpMultiplier = 1.0;

        if (state.targetTileIndex < state.fullPath.length) {
          const nextTile = state.fullPath[state.targetTileIndex];
          const nextWorld = tileToWorld(nextTile);
          state.targetWorldPos.set(nextWorld.x, worldPos.y, nextWorld.z);
        }
      } else if (tileDiff > 2) {
        // MODERATE LAG: 3-6 tiles behind - use speed boost to catch up smoothly
        // Multiplier scales with how far behind we are (1.5x to 2.5x)
        // Set TARGET multiplier - actual will lerp toward it for smooth acceleration
        state.targetCatchUpMultiplier = 1.0 + (tileDiff - 2) * 0.4; // 3 behind = 1.4x, 6 behind = 2.6x
        if (this.debugMode) {
          console.log(
            `[TileInterpolator] Behind by ${tileDiff} tiles, target catch-up: ${state.targetCatchUpMultiplier.toFixed(2)}x`,
          );
        }
      } else {
        // IN SYNC, nearly caught up, or ahead (tileDiff <= 2): Smoothly return to normal speed
        state.targetCatchUpMultiplier = 1.0;
      }

      // Update Y position from server (terrain height)
      state.targetWorldPos.y = worldPos.y;
    } else {
      // Server tile not in our path - path might have changed
      // Check distance to see if it's a teleport or new path
      const currentTile = worldToTile(
        state.visualPosition.x,
        state.visualPosition.z,
      );
      const dist = this.tileDistance(currentTile, serverTile);

      // IMPORTANT: If we have an active path, trust it over server updates
      // This prevents teleporting back when server has stale position data
      // Only teleport if we're STATIONARY (no path) and server says we're far away
      const hasActivePath =
        state.fullPath.length > 0 &&
        state.targetTileIndex < state.fullPath.length;

      if (dist > MAX_DESYNC_DISTANCE && !hasActivePath) {
        // Large desync while stationary - snap to server position
        console.warn(
          `[TileInterpolator] Large desync (${dist} tiles) while stationary, snapping to server tile (${serverTile.x},${serverTile.z})`,
        );
        const serverTileCenter = tileToWorld(serverTile);
        state.visualPosition.x = serverTileCenter.x;
        state.visualPosition.z = serverTileCenter.z;
        state.visualPosition.y = worldPos.y; // Use server's terrain height
        state.targetWorldPos.copy(state.visualPosition);
        state.isMoving = false;
        // Instant reset after snap - no need to blend
        state.catchUpMultiplier = 1.0;
        state.targetCatchUpMultiplier = 1.0;
      } else if (dist > MAX_DESYNC_DISTANCE && hasActivePath) {
        // Large desync but we have an active path - trust our path, ignore server
        // This prevents glitching back to old positions when server has stale data
        console.warn(
          `[TileInterpolator] Ignoring large desync (${dist} tiles) - trusting active path. Server: (${serverTile.x},${serverTile.z}), Client: (${currentTile.x},${currentTile.z})`,
        );
      }
      // Otherwise ignore - we'll continue on our predicted path
    }
  }

  /**
   * Called when entity arrives at destination
   * IMPORTANT: Don't snap immediately - let interpolation finish naturally
   *
   * @param moveSeq Movement sequence number for packet ordering
   */
  onMovementEnd(
    entityId: string,
    tile: TileCoord,
    worldPos: THREE.Vector3,
    moveSeq?: number,
  ): void {
    if (this.debugMode) {
      console.log(
        `[TileInterpolator] onMovementEnd: ${entityId} at (${tile.x},${tile.z}), moveSeq=${moveSeq}`,
      );
    }

    const state = this.entityStates.get(entityId);
    if (!state) return;

    // Validate moveSeq - ignore stale end packets from previous movements
    if (moveSeq !== undefined && state.moveSeq > moveSeq) {
      if (this.debugMode) {
        console.log(
          `[TileInterpolator] Ignoring stale onMovementEnd: moveSeq ${moveSeq} < current ${state.moveSeq}`,
        );
      }
      return;
    }

    // Update server confirmed position
    state.serverConfirmedTile = { ...tile };
    state.destinationTile = { ...tile };

    // Update Y from server (terrain height)
    state.targetWorldPos.y = worldPos.y;
    state.visualPosition.y = worldPos.y;

    // Check if we're still walking toward destination
    const visualTile = worldToTile(
      state.visualPosition.x,
      state.visualPosition.z,
    );
    const distToDestination = this.tileDistance(visualTile, tile);

    if (distToDestination <= 0.1) {
      // Already at destination - snap to exact center and stop
      const tileCenter = tileToWorld(tile);
      state.visualPosition.x = tileCenter.x;
      state.visualPosition.z = tileCenter.z;
      state.targetWorldPos.x = tileCenter.x;
      state.targetWorldPos.z = tileCenter.z;
      state.fullPath = [];
      state.targetTileIndex = 0;
      state.isMoving = false;
      // Only track idle state if current emote is movement-related
      if (MOVEMENT_EMOTES.has(state.emote as string | undefined | null)) {
        state.emote = "idle";
      }
      state.catchUpMultiplier = 1.0;
      state.targetCatchUpMultiplier = 1.0;
    } else {
      // Not at destination yet - ensure we have a path to get there
      // Keep walking animation until we actually arrive

      // Check if destination is in our current path
      const destInPath = state.fullPath.findIndex((t) => tilesEqual(t, tile));

      if (destInPath >= 0 && destInPath >= state.targetTileIndex) {
        // Destination is ahead of us in path - trim to it
        state.fullPath = state.fullPath.slice(0, destInPath + 1);
      } else if (destInPath >= 0 && destInPath < state.targetTileIndex) {
        // We've already passed the destination in our path (edge case)
        // Server is authoritative - just path directly to destination
        // Catch-up multiplier handles smooth movement
        state.fullPath = [{ ...tile }];
        state.targetTileIndex = 0;
      } else if (state.fullPath.length > 0) {
        // Destination not in path - append it
        state.fullPath.push({ ...tile });
      } else {
        // No path at all - go directly to destination
        // Server is authoritative - no client path calculation
        state.fullPath = [{ ...tile }];
        state.targetTileIndex = 0;
      }

      // Ensure targetTileIndex is valid
      if (state.targetTileIndex >= state.fullPath.length) {
        state.targetTileIndex = Math.max(0, state.fullPath.length - 1);
      }

      // Keep moving and keep current animation (walk/run)
      state.isMoving = true;
      // Don't change emote - keep walking/running

      if (this.debugMode) {
        console.log(
          `[TileInterpolator] Still walking, ${distToDestination.toFixed(1)} tiles from destination, path length: ${state.fullPath.length}`,
        );
      }
    }
  }

  /**
   * Update visual positions for all entities
   * This is the main movement driver - walks through path at fixed speed
   *
   * @param deltaTime - Time since last frame in seconds
   * @param getEntity - Function to get entity by ID
   * @param getTerrainHeight - Optional function to get terrain height at X/Z (for smooth Y)
   */
  update(
    deltaTime: number,
    getEntity: (id: string) =>
      | {
          position: THREE.Vector3;
          node?: THREE.Object3D;
          base?: THREE.Object3D;
          data: Record<string, unknown>;
          // modify() is needed to trigger PlayerLocal's emote handling (avatar animation)
          modify: (data: Record<string, unknown>) => void;
        }
      | undefined,
    getTerrainHeight?: (x: number, z: number) => number | null,
  ): void {
    for (const [entityId, state] of this.entityStates) {
      const entity = getEntity(entityId);
      if (!entity) continue;

      // No path or finished path - just ensure position is synced
      if (
        state.fullPath.length === 0 ||
        state.targetTileIndex >= state.fullPath.length
      ) {
        // Update Y from terrain if available
        if (getTerrainHeight) {
          const height = getTerrainHeight(
            state.visualPosition.x,
            state.visualPosition.z,
          );
          if (height !== null && Number.isFinite(height)) {
            state.visualPosition.y = height + 0.1; // Small offset above ground
          }
        }
        entity.position.copy(state.visualPosition);
        // Also sync to node.position if available (for PlayerRemote compatibility)
        if (entity.node && "position" in entity.node) {
          (entity.node as THREE.Object3D).position.copy(state.visualPosition);
        }
        // CRITICAL: Also sync base.position for PlayerRemote avatar positioning
        // PlayerRemote.update() uses base.matrixWorld for instance.move() which positions the avatar
        if (entity.base && "position" in entity.base) {
          (entity.base as THREE.Object3D).position.copy(state.visualPosition);
        }
        // Keep the flag set so PlayerRemote doesn't overwrite
        entity.data.tileInterpolatorControlled = true;
        // Set rotation: Use base for players, fall back to node for mobs
        if (state.quaternion) {
          if (entity.base) {
            // Players: VRM models have 180° rotation baked in, base.quaternion adds to that
            entity.base.quaternion.copy(state.quaternion);
          } else if (entity.node && "quaternion" in entity.node) {
            // Mobs/other entities: Set rotation directly on node
            (entity.node as THREE.Object3D).quaternion.copy(state.quaternion);
          }
        }
        // No path = not moving = idle animation
        state.isMoving = false;
        // Only reset to idle if current emote is a movement emote
        // Don't override special emotes like "chopping", "combat", "death" etc.
        const currentEmote = entity.data?.emote || entity.data?.e;
        if (MOVEMENT_EMOTES.has(currentEmote as string | undefined | null)) {
          state.emote = "idle";
          // Use modify() to trigger PlayerLocal's emote handling which updates avatar animation
          entity.modify({ e: "idle" });
        }
        entity.data.tileMovementActive = false; // Not moving - allow combat rotation
        continue;
      }

      // Smooth catch-up multiplier toward target (prevents jarring speed changes)
      // Uses exponential smoothing with rate limiting for consistent feel across frame rates
      if (state.catchUpMultiplier !== state.targetCatchUpMultiplier) {
        const diff = state.targetCatchUpMultiplier - state.catchUpMultiplier;

        // Exponential smoothing: alpha = 1 - e^(-dt * rate)
        // This is frame-rate independent - same behavior at 30fps or 144fps
        const alpha = 1 - Math.exp(-deltaTime * CATCHUP_SMOOTHING_RATE);
        let change = diff * alpha;

        // Rate limit: cap maximum change per frame to prevent jarring jumps during lag spikes
        const maxChange = CATCHUP_MAX_CHANGE_PER_SEC * deltaTime;
        if (Math.abs(change) > maxChange) {
          change = Math.sign(change) * maxChange;
        }

        state.catchUpMultiplier += change;

        // Snap when very close to avoid floating point drift
        if (Math.abs(diff) < 0.01) {
          state.catchUpMultiplier = state.targetCatchUpMultiplier;
        }
      }

      // Movement speed and total movement budget for this frame
      // Apply catch-up multiplier to move faster when behind server
      const baseSpeed = state.isRunning ? RUN_SPEED : WALK_SPEED;
      const speed = baseSpeed * state.catchUpMultiplier;
      let remainingMove = speed * deltaTime;

      // Process movement, potentially crossing multiple tiles in one frame
      // This prevents "stuttering" at high speeds or low frame rates
      while (
        remainingMove > 0 &&
        state.targetTileIndex < state.fullPath.length
      ) {
        // Get current target tile
        const targetTile = state.fullPath[state.targetTileIndex];
        const targetWorld = tileToWorld(targetTile);
        state.targetWorldPos.x = targetWorld.x;
        state.targetWorldPos.z = targetWorld.z;
        // Note: Y is updated from server updates (terrain height)

        // Skip tiles that are BEHIND the visual position (prevents backward movement)
        // This happens when server's path starts from a position behind the client's visual position
        // due to network latency during spam clicking
        if (
          state.destinationTile &&
          state.targetTileIndex < state.fullPath.length - 1
        ) {
          const destWorld = tileToWorld(state.destinationTile);
          const toTargetX = state.targetWorldPos.x - state.visualPosition.x;
          const toTargetZ = state.targetWorldPos.z - state.visualPosition.z;
          const toDestX = destWorld.x - state.visualPosition.x;
          const toDestZ = destWorld.z - state.visualPosition.z;

          // Dot product: if negative, target tile is behind us relative to destination
          const dot = toTargetX * toDestX + toTargetZ * toDestZ;
          const distToTarget = Math.sqrt(
            toTargetX * toTargetX + toTargetZ * toTargetZ,
          );

          // Skip if target is behind us AND not very close (avoid skipping near-destination tiles)
          if (dot < 0 && distToTarget > 0.5) {
            state.targetTileIndex++;
            continue; // Re-evaluate with next tile
          }
        }

        // Calculate distance to target
        const dx = state.targetWorldPos.x - state.visualPosition.x;
        const dz = state.targetWorldPos.z - state.visualPosition.z;
        const dist = Math.sqrt(dx * dx + dz * dz);

        if (dist <= TILE_ARRIVAL_THRESHOLD || remainingMove >= dist) {
          // Arrived at current target tile - snap to tile center and advance
          state.visualPosition.x = state.targetWorldPos.x;
          state.visualPosition.z = state.targetWorldPos.z;
          // Y will be set from terrain at end of loop

          // Subtract the distance we traveled from our movement budget
          remainingMove -= dist;
          state.targetTileIndex++;

          if (this.debugMode) {
            console.log(
              `[TileInterpolator] ${entityId} reached tile ${state.targetTileIndex - 1}/${state.fullPath.length}`,
            );
          }

          // Check if there's a next tile
          if (state.targetTileIndex < state.fullPath.length) {
            // Calculate rotation to face next tile (only update if distance is sufficient)
            const nextTile = state.fullPath[state.targetTileIndex];
            const nextWorld = tileToWorld(nextTile);
            const nextPos = new THREE.Vector3(
              nextWorld.x,
              state.visualPosition.y,
              nextWorld.z,
            );
            const nextRotation = this.calculateFacingRotation(
              state.visualPosition,
              nextPos,
            );
            if (nextRotation) {
              // Only update rotation if direction changed significantly (>~16°)
              // This prevents micro-pivots during nearly-straight movement
              // Quaternion dot product: |dot| > 0.99 means angle < ~16°
              const dot = Math.abs(state.targetQuaternion.dot(nextRotation));
              if (dot < 0.99) {
                state.targetQuaternion.copy(nextRotation);
              }
            }
            // Continue loop to use remaining movement toward next tile
          } else {
            // Finished path - snap to destination tile center
            // Use destinationTile (authoritative from server) if available, otherwise use last path tile
            const finalTile =
              state.destinationTile ||
              state.fullPath[state.fullPath.length - 1];
            const finalWorld = tileToWorld(finalTile);
            state.visualPosition.x = finalWorld.x;
            state.visualPosition.z = finalWorld.z;
            state.isMoving = false;
            // Only track idle state if current emote is movement-related
            // (actual emote change is handled in the empty path block above)
            if (MOVEMENT_EMOTES.has(state.emote as string | undefined | null)) {
              state.emote = "idle";
            }
            state.destinationTile = null; // Clear destination as we've arrived
            state.catchUpMultiplier = 1.0;
            state.targetCatchUpMultiplier = 1.0;
            remainingMove = 0; // Stop processing
          }
        } else {
          // Move toward target, consuming all remaining movement
          this._tempDir.set(dx, 0, dz).normalize();
          state.visualPosition.x += this._tempDir.x * remainingMove;
          state.visualPosition.z += this._tempDir.z * remainingMove;
          // Y will be set from terrain at end of loop

          // NOTE: Removed mid-tile rotation update (2.4 Only Rotate on Tile Transitions)
          // Rotation is only updated when reaching tile boundaries, not every frame.
          // This prevents micro-pivots from floating point variations during movement.
          // The initial rotation (set in onMovementStart) faces the destination,
          // and tile transition rotation (above) handles direction changes at turns.

          remainingMove = 0; // All movement consumed
        }
      }

      // Update Y from terrain for smooth ground following
      if (getTerrainHeight) {
        const height = getTerrainHeight(
          state.visualPosition.x,
          state.visualPosition.z,
        );
        if (height !== null && Number.isFinite(height)) {
          state.visualPosition.y = height + 0.1; // Small offset above ground
        }
      }

      // Smoothly interpolate rotation toward target using spherical lerp (slerp)
      // This prevents jarring direction snaps when player course-corrects
      // Uses exponential smoothing: alpha = 1 - e^(-dt * rate) for frame-rate independence
      //
      // IMPORTANT: Quaternions have double cover - q and -q represent the SAME rotation.
      // When dot product is negative, slerp takes the "long way" around (~360° rotation).
      // Fix: negate target quaternion when dot < 0 to ensure short path interpolation.
      if (state.quaternion.dot(state.targetQuaternion) < 0) {
        state.targetQuaternion.set(
          -state.targetQuaternion.x,
          -state.targetQuaternion.y,
          -state.targetQuaternion.z,
          -state.targetQuaternion.w,
        );
      }
      const rotationAlpha = 1 - Math.exp(-deltaTime * ROTATION_SLERP_SPEED);
      state.quaternion.slerp(state.targetQuaternion, rotationAlpha);

      // Apply visual state to entity
      entity.position.copy(state.visualPosition);
      // Also sync to node.position if available (for PlayerRemote compatibility)
      if (entity.node && "position" in entity.node) {
        (entity.node as THREE.Object3D).position.copy(state.visualPosition);
      }
      // CRITICAL: Also sync base.position for PlayerRemote avatar positioning
      // PlayerRemote.update() uses base.matrixWorld for instance.move() which positions the avatar
      if (entity.base && "position" in entity.base) {
        (entity.base as THREE.Object3D).position.copy(state.visualPosition);
      }
      // Mark entity as controlled by tile interpolator to prevent other systems from overwriting
      entity.data.tileInterpolatorControlled = true;
      // Expose isMoving so PlayerLocal/PlayerRemote can check for combat rotation
      // OSRS behavior: only face combat target when standing still, not while moving
      entity.data.tileMovementActive = state.isMoving;
      // Set rotation: Use base for players (VRM has 180° rotation baked in),
      // fall back to node for mobs/other entities that don't have base
      if (entity.base) {
        // Players: Set rotation on base (VRM models have 180° rotation baked in, base.quaternion adds to that)
        entity.base.quaternion.copy(state.quaternion);
      } else if (entity.node && "quaternion" in entity.node) {
        // Mobs/other entities: Set rotation directly on node
        (entity.node as THREE.Object3D).quaternion.copy(state.quaternion);
      }
      // Use modify() to trigger PlayerLocal's emote handling which updates avatar animation
      // For other entities (PlayerRemote, MobEntity), modify() just does Object.assign to data
      entity.modify({ e: state.emote });

      if (this.debugMode && Math.random() < 0.01) {
        console.log(
          `[TileInterpolator] ${entityId}: tile ${state.targetTileIndex}/${state.fullPath.length}`,
        );
      }
    }
  }

  /**
   * Check if an entity has an active interpolation state
   */
  hasState(entityId: string): boolean {
    return this.entityStates.has(entityId);
  }

  /**
   * Check if an entity is currently moving
   */
  isInterpolating(entityId: string): boolean {
    const state = this.entityStates.get(entityId);
    return state ? state.isMoving : false;
  }

  /**
   * Get current visual position for an entity
   */
  getVisualPosition(entityId: string): THREE.Vector3 | null {
    const state = this.entityStates.get(entityId);
    return state ? state.visualPosition.clone() : null;
  }

  /**
   * Remove interpolation state for an entity
   */
  removeEntity(entityId: string): void {
    this.entityStates.delete(entityId);
  }

  /**
   * Sync entity position after teleport/respawn
   *
   * Resets the entity's movement state to a new position, clearing any pending
   * path and setting the visual position to the new location. Used when a player
   * respawns or is teleported to prevent stale movement state.
   *
   * @param entityId - Entity to sync
   * @param position - New world position
   */
  syncPosition(
    entityId: string,
    position: { x: number; y: number; z: number },
  ): void {
    const newTile = worldToTile(position.x, position.z);
    const worldPos = tileToWorld(newTile);

    // Get existing state or create minimal new state
    let state = this.entityStates.get(entityId);
    if (state) {
      // Reset existing state to new position
      state.fullPath = [];
      state.targetTileIndex = 0;
      state.destinationTile = null;
      state.visualPosition.set(worldPos.x, position.y, worldPos.z);
      state.targetWorldPos.set(worldPos.x, position.y, worldPos.z);
      state.serverConfirmedTile = { ...newTile };
      state.isMoving = false;
      // Only track idle state if current emote is movement-related
      if (MOVEMENT_EMOTES.has(state.emote as string | undefined | null)) {
        state.emote = "idle";
      }
      state.catchUpMultiplier = 1.0;
      state.targetCatchUpMultiplier = 1.0;
      state.moveSeq++;
      console.log(
        `[TileInterpolator] Synced ${entityId} to tile (${newTile.x},${newTile.z})`,
      );
    } else {
      // No existing state - create fresh state at new position
      state = {
        fullPath: [],
        targetTileIndex: 0,
        destinationTile: null,
        visualPosition: new THREE.Vector3(worldPos.x, position.y, worldPos.z),
        targetWorldPos: new THREE.Vector3(worldPos.x, position.y, worldPos.z),
        quaternion: new THREE.Quaternion(),
        targetQuaternion: new THREE.Quaternion(),
        isRunning: false,
        isMoving: false,
        emote: "idle",
        serverConfirmedTile: { ...newTile },
        lastServerTick: 0,
        catchUpMultiplier: 1.0,
        targetCatchUpMultiplier: 1.0,
        moveSeq: 0,
      };
      this.entityStates.set(entityId, state);
      console.log(
        `[TileInterpolator] Created fresh state for ${entityId} at tile (${newTile.x},${newTile.z})`,
      );
    }
  }

  /**
   * Clear all interpolation states
   */
  clear(): void {
    this.entityStates.clear();
  }

  /**
   * Enable or disable debug logging
   */
  setDebugMode(enabled: boolean): void {
    this.debugMode = enabled;
  }
}
