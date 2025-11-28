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
 * @see https://secure.runescape.com/m=news/dev-blog---movement-in-runescape
 * @see https://osrs-docs.com/docs/variables/client-tick/
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
  // Current rotation
  quaternion: THREE.Quaternion;

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
  // Catch-up multiplier for when client is behind server
  // 1.0 = normal speed, >1.0 = catching up
  catchUpMultiplier: number;
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
   * Calculate intermediate tiles between two tiles using naive diagonal pathing
   * Used to fill in gaps when server's path starts ahead of client's visual position
   * Returns tiles from start (exclusive) to end (inclusive)
   */
  private calculateIntermediateTiles(
    start: TileCoord,
    end: TileCoord,
  ): TileCoord[] {
    const tiles: TileCoord[] = [];
    let current = { ...start };

    // Maximum iterations to prevent infinite loops
    const maxIterations = 100;
    let iterations = 0;

    while (!tilesEqual(current, end) && iterations < maxIterations) {
      iterations++;

      // Calculate direction to target
      const dx = Math.sign(end.x - current.x);
      const dz = Math.sign(end.z - current.z);

      // Move diagonally if needed, otherwise cardinally
      if (dx !== 0 && dz !== 0) {
        // Diagonal movement
        current = { x: current.x + dx, z: current.z + dz };
      } else if (dx !== 0) {
        // Horizontal movement
        current = { x: current.x + dx, z: current.z };
      } else if (dz !== 0) {
        // Vertical movement
        current = { x: current.x, z: current.z + dz };
      } else {
        // Already at destination
        break;
      }

      tiles.push({ ...current });
    }

    return tiles;
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
   */
  onMovementStart(
    entityId: string,
    path: TileCoord[],
    running: boolean,
    currentPosition?: THREE.Vector3,
    destinationTile?: TileCoord,
  ): void {
    if (this.debugMode) {
      console.log(
        `[TileInterpolator] onMovementStart: ${entityId}, path=${path.length} tiles, running=${running}, dest=${destinationTile ? `(${destinationTile.x},${destinationTile.z})` : "none"}`,
      );
    }

    if (path.length === 0) {
      // No path - clear any existing state
      this.entityStates.delete(entityId);
      return;
    }

    // Get or create state
    let state = this.entityStates.get(entityId);

    // Starting position (visual position or current position)
    const startPos =
      currentPosition?.clone() ||
      state?.visualPosition?.clone() ||
      new THREE.Vector3();
    const startTile = worldToTile(startPos.x, startPos.z);

    // Build the final path, handling server-client position desync
    // The server's path starts from ITS position, which might be ahead of the client's visual position
    // We need to prepend intermediate tiles so the client walks tile-by-tile, not directly to a far tile
    let finalPath: TileCoord[] = [];

    if (path.length > 0) {
      const firstServerTile = path[0];

      // Check if client's current tile is different from where server's path starts
      // If so, we need to calculate intermediate tiles from client position to first server tile
      if (!tilesEqual(startTile, firstServerTile)) {
        // Calculate intermediate tiles using naive diagonal pathing
        // This ensures smooth tile-by-tile movement from client's position to server's path
        const intermediateTiles = this.calculateIntermediateTiles(
          startTile,
          firstServerTile,
        );
        finalPath.push(...intermediateTiles);

        if (this.debugMode && intermediateTiles.length > 0) {
          console.log(
            `[TileInterpolator] Prepended ${intermediateTiles.length} intermediate tiles from (${startTile.x},${startTile.z}) to (${firstServerTile.x},${firstServerTile.z})`,
          );
        }
      }

      // Add server's path (but skip the first tile if we already added it via intermediate)
      const serverPathStart =
        finalPath.length > 0 &&
        tilesEqual(finalPath[finalPath.length - 1], firstServerTile)
          ? 1
          : 0;
      for (let i = serverPathStart; i < path.length; i++) {
        finalPath.push({ ...path[i] });
      }
    }

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

    // Calculate rotation to face first tile
    const firstTileWorld = tileToWorld(finalPath[0]);
    const initialRotation =
      this.calculateFacingRotation(
        startPos,
        new THREE.Vector3(firstTileWorld.x, startPos.y, firstTileWorld.z),
      ) ?? new THREE.Quaternion(); // Default to identity if too close

    if (state) {
      // Update existing state with new path
      state.fullPath = finalPath;
      state.targetTileIndex = 0;
      state.destinationTile = destinationTile ? { ...destinationTile } : null;
      state.visualPosition.copy(startPos);
      state.targetWorldPos.set(firstTileWorld.x, startPos.y, firstTileWorld.z);
      state.quaternion.copy(initialRotation);
      state.isRunning = running;
      state.isMoving = true;
      state.emote = running ? "run" : "walk";
      state.serverConfirmedTile = { ...startTile };
      state.lastServerTick = 0;
      state.catchUpMultiplier = 1.0;
    } else {
      // Create new state
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
        isRunning: running,
        isMoving: true,
        emote: running ? "run" : "walk",
        serverConfirmedTile: { ...startTile },
        lastServerTick: 0,
        catchUpMultiplier: 1.0,
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
   */
  onTileUpdate(
    entityId: string,
    serverTile: TileCoord,
    worldPos: THREE.Vector3,
    emote: string,
    quaternion?: number[],
    _entityCurrentPos?: THREE.Vector3,
    tickNumber?: number,
  ): void {
    const state = this.entityStates.get(entityId);

    if (!state) {
      // No active path - this might be a sync update for a stationary entity
      // Create a minimal state just holding position
      const newState: EntityMovementState = {
        fullPath: [],
        targetTileIndex: 0,
        destinationTile: null,
        visualPosition: worldPos.clone(),
        targetWorldPos: worldPos.clone(),
        quaternion: quaternion
          ? new THREE.Quaternion(
              quaternion[0],
              quaternion[1],
              quaternion[2],
              quaternion[3],
            )
          : new THREE.Quaternion(),
        isRunning: emote === "run",
        isMoving: false,
        emote: emote,
        serverConfirmedTile: { ...serverTile },
        lastServerTick: tickNumber ?? 0,
        catchUpMultiplier: 1.0,
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
        state.catchUpMultiplier = 1.0; // Reset after teleport

        if (state.targetTileIndex < state.fullPath.length) {
          const nextTile = state.fullPath[state.targetTileIndex];
          const nextWorld = tileToWorld(nextTile);
          state.targetWorldPos.set(nextWorld.x, worldPos.y, nextWorld.z);
        }
      } else if (tileDiff > 2) {
        // MODERATE LAG: 3-6 tiles behind - use speed boost to catch up smoothly
        // Multiplier scales with how far behind we are (1.5x to 2.5x)
        state.catchUpMultiplier = 1.0 + (tileDiff - 2) * 0.4; // 3 behind = 1.4x, 6 behind = 2.6x
        if (this.debugMode) {
          console.log(
            `[TileInterpolator] Behind by ${tileDiff} tiles, catch-up multiplier: ${state.catchUpMultiplier.toFixed(2)}x`,
          );
        }
      } else if (tileDiff <= 1) {
        // IN SYNC or ahead: Reset catch-up multiplier
        state.catchUpMultiplier = 1.0;
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

      if (dist > MAX_DESYNC_DISTANCE) {
        if (this.debugMode) {
          console.log(
            `[TileInterpolator] Large desync (${dist} tiles), snapping to server tile`,
          );
        }
        // Teleport/large desync - snap to server tile center
        const serverTileCenter = tileToWorld(serverTile);
        state.visualPosition.x = serverTileCenter.x;
        state.visualPosition.z = serverTileCenter.z;
        state.visualPosition.y = worldPos.y; // Use server's terrain height
        state.targetWorldPos.copy(state.visualPosition);
        state.fullPath = [];
        state.targetTileIndex = 0;
        state.isMoving = false;
        state.catchUpMultiplier = 1.0; // Reset catch-up speed after teleport
      }
      // Otherwise ignore - we'll continue on our predicted path
    }
  }

  /**
   * Called when entity arrives at destination
   * IMPORTANT: Don't snap immediately - let interpolation finish naturally
   */
  onMovementEnd(
    entityId: string,
    tile: TileCoord,
    worldPos: THREE.Vector3,
  ): void {
    if (this.debugMode) {
      console.log(
        `[TileInterpolator] onMovementEnd: ${entityId} at (${tile.x},${tile.z})`,
      );
    }

    const state = this.entityStates.get(entityId);
    if (!state) return;

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
      state.emote = "idle";
      state.catchUpMultiplier = 1.0;
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
        // Create a new path from current position to destination
        const currentTile = worldToTile(
          state.visualPosition.x,
          state.visualPosition.z,
        );
        const intermediateTiles = this.calculateIntermediateTiles(
          currentTile,
          tile,
        );
        state.fullPath =
          intermediateTiles.length > 0 ? intermediateTiles : [{ ...tile }];
        state.targetTileIndex = 0;
      } else if (state.fullPath.length > 0) {
        // Destination not in path - append it
        state.fullPath.push({ ...tile });
      } else {
        // No path at all - create one to destination
        const currentTile = worldToTile(
          state.visualPosition.x,
          state.visualPosition.z,
        );
        const intermediateTiles = this.calculateIntermediateTiles(
          currentTile,
          tile,
        );
        state.fullPath =
          intermediateTiles.length > 0 ? intermediateTiles : [{ ...tile }];
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
   */
  update(
    deltaTime: number,
    getEntity: (
      id: string,
    ) =>
      | {
          position: THREE.Vector3;
          node?: THREE.Object3D;
          base?: THREE.Object3D;
          data: Record<string, unknown>;
        }
      | undefined,
  ): void {
    for (const [entityId, state] of this.entityStates) {
      const entity = getEntity(entityId);
      if (!entity) continue;

      // No path or finished path - just ensure position is synced
      if (
        state.fullPath.length === 0 ||
        state.targetTileIndex >= state.fullPath.length
      ) {
        entity.position.copy(state.visualPosition);
        // Also sync to node.position if available (for PlayerRemote compatibility)
        if (entity.node && "position" in entity.node) {
          (entity.node as THREE.Object3D).position.copy(state.visualPosition);
        }
        // Keep the flag set so PlayerRemote doesn't overwrite
        entity.data.tileInterpolatorControlled = true;
        // Set rotation on base (consistent with combat code in PlayerLocal)
        // VRM models have 180° rotation baked in, base.quaternion adds to that
        if (state.quaternion && entity.base) {
          entity.base.quaternion.copy(state.quaternion);
        }
        // No path = not moving = idle animation
        state.isMoving = false;
        state.emote = "idle";
        entity.data.emote = "idle";
        continue;
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

        // Calculate distance to target
        const dx = state.targetWorldPos.x - state.visualPosition.x;
        const dz = state.targetWorldPos.z - state.visualPosition.z;
        const dist = Math.sqrt(dx * dx + dz * dz);

        if (dist <= TILE_ARRIVAL_THRESHOLD || remainingMove >= dist) {
          // Arrived at current target tile - snap to tile center and advance
          state.visualPosition.x = state.targetWorldPos.x;
          state.visualPosition.z = state.targetWorldPos.z;
          state.visualPosition.y = state.targetWorldPos.y;

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
              state.quaternion.copy(nextRotation);
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
            state.emote = "idle";
            state.destinationTile = null; // Clear destination as we've arrived
            state.catchUpMultiplier = 1.0; // Reset catch-up speed
            remainingMove = 0; // Stop processing
          }
        } else {
          // Move toward target, consuming all remaining movement
          this._tempDir.set(dx, 0, dz).normalize();
          state.visualPosition.x += this._tempDir.x * remainingMove;
          state.visualPosition.z += this._tempDir.z * remainingMove;

          // Interpolate Y toward target
          const dy = state.targetWorldPos.y - state.visualPosition.y;
          const yProgress = remainingMove / dist;
          state.visualPosition.y += dy * Math.min(1, yProgress);

          // Update rotation to face movement direction (only if distance is sufficient)
          // When very close to target, preserve existing rotation to avoid brief twitches
          const movementRotation = this.calculateFacingRotation(
            state.visualPosition,
            state.targetWorldPos,
          );
          if (movementRotation) {
            state.quaternion.copy(movementRotation);
          }

          remainingMove = 0; // All movement consumed
        }
      }

      // Apply visual state to entity
      entity.position.copy(state.visualPosition);
      // Also sync to node.position if available (for PlayerRemote compatibility)
      if (entity.node && "position" in entity.node) {
        (entity.node as THREE.Object3D).position.copy(state.visualPosition);
      }
      // Mark entity as controlled by tile interpolator to prevent other systems from overwriting
      entity.data.tileInterpolatorControlled = true;
      // Set rotation on base (consistent with combat code in PlayerLocal)
      // VRM models have 180° rotation baked in, base.quaternion adds to that
      if (entity.base) {
        entity.base.quaternion.copy(state.quaternion);
      }
      entity.data.emote = state.emote;

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
