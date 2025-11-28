/**
 * Mob Tile Movement Manager
 *
 * RuneScape-style tile-based movement system for mobs.
 * Mobs move discretely from tile to tile on server ticks (600ms).
 *
 * Key behaviors:
 * - Movement happens on ticks, not frames
 * - Mobs move 1-2 tiles per tick (based on mob speed)
 * - Uses BFS pathfinding for paths
 * - Client interpolates visually between tile positions
 * - Integrates with AIStateMachine (WANDER, CHASE, RETURN states)
 *
 * OSRS Reference:
 * - Mobs move at fixed speeds based on type
 * - Paths recalculate when target moves
 * - Leash distance returns mob to spawn
 */

import {
  THREE,
  TerrainSystem,
  World,
  TILES_PER_TICK_WALK,
  worldToTile,
  tileToWorld,
  tilesEqual,
  tilesAdjacent,
  getBestAdjacentTile,
  BFSPathfinder,
} from "@hyperscape/shared";
import type {
  TileCoord,
  TileMovementState,
  Position3D,
} from "@hyperscape/shared";

/**
 * Extended movement state for mobs
 * Includes mob-specific fields like target entity tracking
 */
interface MobTileState extends TileMovementState {
  /** Target entity ID (for CHASE state - recalculates path when target moves) */
  targetEntityId: string | null;
  /** Last known target position (to detect when we need to repath) */
  lastTargetTile: TileCoord | null;
  /** Movement speed in tiles per tick (default: 2 for walk) */
  tilesPerTick: number;
  /** Whether mob is currently pathfinding to a destination */
  hasDestination: boolean;
}

/**
 * Create initial mob tile state
 */
function createMobTileState(
  currentTile: TileCoord,
  tilesPerTick = TILES_PER_TICK_WALK,
): MobTileState {
  return {
    currentTile: { ...currentTile },
    path: [],
    pathIndex: 0,
    isRunning: false,
    moveSeq: 0,
    targetEntityId: null,
    lastTargetTile: null,
    tilesPerTick,
    hasDestination: false,
  };
}

/**
 * Tile-based movement manager for mobs (RuneScape-style)
 */
export class MobTileMovementManager {
  private mobStates: Map<string, MobTileState> = new Map();
  private pathfinder: BFSPathfinder;
  // Y-axis for stable yaw rotation calculation
  private _up = new THREE.Vector3(0, 1, 0);
  private _tempQuat = new THREE.Quaternion();
  // Debug mode - set to true for verbose logging (disabled in production)
  private readonly DEBUG_MODE = false;

  constructor(
    private world: World,
    private sendFn: (
      name: string,
      data: unknown,
      ignoreSocketId?: string,
    ) => void,
  ) {
    this.pathfinder = new BFSPathfinder();
  }

  /**
   * Get terrain system
   */
  private getTerrain(): InstanceType<typeof TerrainSystem> | null {
    return this.world.getSystem("terrain") as InstanceType<
      typeof TerrainSystem
    > | null;
  }

  /**
   * Check if a tile is walkable
   * For MVP: All tiles are walkable (no obstacles)
   */
  private isTileWalkable(_tile: TileCoord): boolean {
    // MVP: All tiles are walkable
    // TODO: Add terrain slope checks and collision objects later
    return true;
  }

  /**
   * Get or create movement state for a mob
   */
  private getOrCreateState(
    mobId: string,
    currentPos?: Position3D,
  ): MobTileState {
    let state = this.mobStates.get(mobId);
    if (!state) {
      // Get current position and convert to tile
      const entity = this.world.entities.get(mobId);
      const pos = currentPos || entity?.position;
      const currentTile: TileCoord = pos
        ? worldToTile(pos.x, pos.z)
        : { x: 0, z: 0 };

      state = createMobTileState(currentTile);
      this.mobStates.set(mobId, state);
    }
    return state;
  }

  /**
   * Request movement to a target position
   * Called by MobEntity when AI wants to move
   *
   * @param mobId - The mob's entity ID
   * @param targetPos - Target world position
   * @param targetEntityId - Optional entity ID being chased (for dynamic repathing)
   * @param tilesPerTick - Movement speed (default: walk speed)
   */
  requestMoveTo(
    mobId: string,
    targetPos: Position3D,
    targetEntityId: string | null = null,
    tilesPerTick: number = TILES_PER_TICK_WALK,
  ): void {
    const entity = this.world.entities.get(mobId);
    if (!entity) {
      if (this.DEBUG_MODE)
        console.log(
          `[MobTileMovement] requestMoveTo: Entity ${mobId} not found`,
        );
      return;
    }

    const state = this.getOrCreateState(mobId, entity.position);
    const targetTile = worldToTile(targetPos.x, targetPos.z);

    if (this.DEBUG_MODE)
      console.log(
        `[MobTileMovement] requestMoveTo: ${mobId} from tile (${state.currentTile.x},${state.currentTile.z}) to tile (${targetTile.x},${targetTile.z}), hasDestination=${state.hasDestination}, pathLen=${state.path.length}`,
      );

    // If already at destination, nothing to do
    if (tilesEqual(state.currentTile, targetTile)) {
      if (this.DEBUG_MODE)
        console.log(
          `[MobTileMovement] requestMoveTo: Already at destination tile`,
        );
      state.hasDestination = false;
      state.path = [];
      state.pathIndex = 0;
      return;
    }

    // Optimization: Skip re-pathing if we already have a valid path to the same target
    // This prevents expensive BFS calculations every frame
    if (state.hasDestination && state.path.length > 0) {
      const currentDestination = state.path[state.path.length - 1];
      if (tilesEqual(currentDestination, targetTile)) {
        // Already pathing to this tile, no need to recalculate
        if (this.DEBUG_MODE)
          console.log(
            `[MobTileMovement] requestMoveTo: Already pathing to this tile, skipping`,
          );
        return;
      }
    }

    // Calculate BFS path from current tile to target
    const path = this.pathfinder.findPath(
      state.currentTile,
      targetTile,
      (tile) => this.isTileWalkable(tile),
    );

    if (this.DEBUG_MODE)
      console.log(
        `[MobTileMovement] requestMoveTo: BFS path calculated, length=${path.length}`,
      );

    // Update state
    state.path = path;
    state.pathIndex = 0;
    state.targetEntityId = targetEntityId;
    state.lastTargetTile = targetEntityId ? { ...targetTile } : null;
    state.tilesPerTick = tilesPerTick;
    state.hasDestination = path.length > 0;
    state.moveSeq = (state.moveSeq || 0) + 1;

    if (path.length > 0) {
      // Immediately rotate mob toward first tile in path (same as player)
      const nextTile = path[0];
      const nextWorld = tileToWorld(nextTile);
      const curr = entity.position;
      const dx = nextWorld.x - curr.x;
      const dz = nextWorld.z - curr.z;

      // Calculate rotation to face movement direction
      if (Math.abs(dx) + Math.abs(dz) > 0.01) {
        // VRM faces -Z after factory rotation
        const yaw = Math.atan2(-dx, -dz);
        this._tempQuat.setFromAxisAngle(this._up, yaw);

        if (entity.node) {
          entity.node.quaternion.copy(this._tempQuat);
        }
        if (entity.data) {
          entity.data.quaternion = [
            this._tempQuat.x,
            this._tempQuat.y,
            this._tempQuat.z,
            this._tempQuat.w,
          ];
        }
      }

      // Broadcast movement started
      this.sendFn("tileMovementStart", {
        id: mobId,
        path: path.map((t) => ({ x: t.x, z: t.z })),
        running: state.isRunning,
        destinationTile: { x: targetTile.x, z: targetTile.z },
        moveSeq: state.moveSeq,
        isMob: true,
      });

      // Send initial rotation and emote (same as player)
      this.sendFn("entityModified", {
        id: mobId,
        changes: {
          q: entity.data?.quaternion,
          e: "walk",
        },
      });
    }
  }

  /**
   * Cancel current movement for a mob
   */
  cancelMovement(mobId: string): void {
    const state = this.mobStates.get(mobId);
    if (!state) return;

    state.path = [];
    state.pathIndex = 0;
    state.targetEntityId = null;
    state.lastTargetTile = null;
    state.hasDestination = false;

    // Broadcast idle state
    const entity = this.world.entities.get(mobId);
    if (entity) {
      this.sendFn("entityModified", {
        id: mobId,
        changes: {
          p: [entity.position.x, entity.position.y, entity.position.z],
          v: [0, 0, 0],
          e: "idle",
        },
      });
    }
  }

  /**
   * Called every server tick (600ms) - advance all mobs along their paths
   */
  onTick(tickNumber: number): void {
    const terrain = this.getTerrain();

    if (this.DEBUG_MODE && this.mobStates.size > 0) {
      console.log(
        `[MobTileMovement] onTick #${tickNumber}: Processing ${this.mobStates.size} mobs`,
      );
    }

    for (const [mobId, state] of this.mobStates) {
      const entity = this.world.entities.get(mobId);
      if (!entity) {
        // Mob no longer exists, clean up
        if (this.DEBUG_MODE)
          console.log(
            `[MobTileMovement] onTick: Mob ${mobId} no longer exists, cleaning up`,
          );
        this.mobStates.delete(mobId);
        continue;
      }

      if (this.DEBUG_MODE)
        console.log(
          `[MobTileMovement] onTick: Mob ${mobId} - hasDestination=${state.hasDestination}, pathLen=${state.path.length}, pathIndex=${state.pathIndex}`,
        );

      // Check if we're chasing a moving target and need to repath
      // OSRS-STYLE: Path to an ADJACENT tile, not the exact target tile
      // This prevents mobs from standing inside players during combat
      if (state.targetEntityId && state.hasDestination) {
        const targetEntity = this.world.entities.get(state.targetEntityId);
        if (targetEntity) {
          const currentTargetTile = worldToTile(
            targetEntity.position.x,
            targetEntity.position.z,
          );

          // OSRS COMBAT POSITIONING: Check if we're already adjacent to target
          // If so, we're in melee range - no need to move closer!
          if (tilesAdjacent(state.currentTile, currentTargetTile)) {
            // Already in combat range - stop moving and clear path
            // The mob should stay on this adjacent tile and attack
            if (state.path.length > 0) {
              if (this.DEBUG_MODE)
                console.log(
                  `[MobTileMovement] Already adjacent to target at (${currentTargetTile.x},${currentTargetTile.z}), stopping`,
                );
              state.path = [];
              state.pathIndex = 0;
              state.hasDestination = false;

              // Broadcast that we've stopped
              this.sendFn("tileMovementEnd", {
                id: mobId,
                tile: state.currentTile,
                worldPos: [
                  entity.position.x,
                  entity.position.y,
                  entity.position.z,
                ],
                moveSeq: state.moveSeq,
                isMob: true,
              });
            }
            continue; // Skip movement processing for this mob
          }

          // If target moved to a different tile, recalculate path
          if (
            !state.lastTargetTile ||
            !tilesEqual(state.lastTargetTile, currentTargetTile)
          ) {
            // OSRS-STYLE: Path to the best ADJACENT tile, not the exact target tile
            // This ensures mob stops next to player, not on top of them
            const adjacentTile = getBestAdjacentTile(
              currentTargetTile,
              state.currentTile,
              false, // Allow diagonal adjacency
              (tile) => this.isTileWalkable(tile),
            );

            if (adjacentTile) {
              // Path to adjacent tile (not target's exact tile)
              const newPath = this.pathfinder.findPath(
                state.currentTile,
                adjacentTile,
                (tile) => this.isTileWalkable(tile),
              );

              if (newPath.length > 0) {
                if (this.DEBUG_MODE)
                  console.log(
                    `[MobTileMovement] Repathing to adjacent tile (${adjacentTile.x},${adjacentTile.z}) near target (${currentTargetTile.x},${currentTargetTile.z})`,
                  );
                state.path = newPath;
                state.pathIndex = 0;
                state.lastTargetTile = { ...currentTargetTile };
                state.moveSeq++;
              }
            } else {
              // No walkable adjacent tile found - try pathing directly as fallback
              // This handles edge cases like all adjacent tiles being blocked
              if (this.DEBUG_MODE)
                console.warn(
                  `[MobTileMovement] No walkable adjacent tile to target, attempting direct path`,
                );
              const newPath = this.pathfinder.findPath(
                state.currentTile,
                currentTargetTile,
                (tile) => this.isTileWalkable(tile),
              );

              if (newPath.length > 0) {
                state.path = newPath;
                state.pathIndex = 0;
                state.lastTargetTile = { ...currentTargetTile };
                state.moveSeq++;
              }
            }
          }
        }
      }

      // Skip if no path or at end
      if (state.path.length === 0 || state.pathIndex >= state.path.length) {
        if (state.hasDestination) {
          // Just finished moving
          state.hasDestination = false;
          this.sendFn("tileMovementEnd", {
            id: mobId,
            tile: state.currentTile,
            worldPos: [entity.position.x, entity.position.y, entity.position.z],
            moveSeq: state.moveSeq,
            isMob: true,
          });
        }
        continue;
      }

      // Store previous position for rotation calculation
      const prevTile = { ...state.currentTile };

      // Move tiles per tick (mob speed)
      const tilesToMove = state.tilesPerTick;

      // Get target tile if chasing (for collision prevention)
      let targetOccupiedTile: TileCoord | null = null;
      if (state.targetEntityId) {
        const targetEntity = this.world.entities.get(state.targetEntityId);
        if (targetEntity) {
          targetOccupiedTile = worldToTile(
            targetEntity.position.x,
            targetEntity.position.z,
          );
        }
      }

      for (let i = 0; i < tilesToMove; i++) {
        if (state.pathIndex >= state.path.length) break;

        const nextTile = state.path[state.pathIndex];

        // OSRS-STYLE COLLISION: Never step onto the tile occupied by our target
        // This is defense-in-depth - the path should already avoid this,
        // but we double-check here in case target moved after path calculation
        if (targetOccupiedTile && tilesEqual(nextTile, targetOccupiedTile)) {
          if (this.DEBUG_MODE)
            console.log(
              `[MobTileMovement] Refusing to step onto target's tile (${nextTile.x},${nextTile.z}), stopping`,
            );
          // Stop at current tile - we're adjacent and in combat range
          state.path = [];
          state.pathIndex = 0;
          state.hasDestination = false;
          break;
        }

        state.currentTile = { ...nextTile };
        state.pathIndex++;
      }

      if (this.DEBUG_MODE)
        console.log(
          `[MobTileMovement] onTick: Mob ${mobId} moved from tile (${prevTile.x},${prevTile.z}) to (${state.currentTile.x},${state.currentTile.z}), pathIndex=${state.pathIndex}/${state.path.length}`,
        );

      // Convert tile to world position
      const worldPos = tileToWorld(state.currentTile);

      // Get terrain height
      if (terrain) {
        const height = terrain.getHeightAt(worldPos.x, worldPos.z);
        if (height !== null && Number.isFinite(height)) {
          worldPos.y = (height as number) + 0.1;
        }
      }

      // Update entity position on server
      entity.position.set(worldPos.x, worldPos.y, worldPos.z);
      if (entity.data) {
        entity.data.position = [worldPos.x, worldPos.y, worldPos.z];
      }

      // Calculate rotation based on movement direction
      const prevWorld = tileToWorld(prevTile);
      const dx = worldPos.x - prevWorld.x;
      const dz = worldPos.z - prevWorld.z;

      if (Math.abs(dx) + Math.abs(dz) > 0.01) {
        // VRM faces -Z after factory rotation
        const yaw = Math.atan2(-dx, -dz);
        this._tempQuat.setFromAxisAngle(this._up, yaw);

        if (entity.node) {
          entity.node.quaternion.copy(this._tempQuat);
        }
        if (entity.data) {
          entity.data.quaternion = [
            this._tempQuat.x,
            this._tempQuat.y,
            this._tempQuat.z,
            this._tempQuat.w,
          ];
        }
      }

      // Broadcast tile position update to clients
      // This packet drives client-side TileInterpolator for smooth movement
      this.sendFn("entityTileUpdate", {
        id: mobId,
        tile: state.currentTile,
        worldPos: [worldPos.x, worldPos.y, worldPos.z],
        quaternion: entity.data?.quaternion,
        emote: "walk",
        tickNumber,
        moveSeq: state.moveSeq,
        isMob: true,
      });

      // NOTE: Do NOT call markNetworkDirty() here!
      // The tile movement packets (entityTileUpdate) already handle position sync.
      // Calling markNetworkDirty() would trigger the regular entity network sync,
      // causing duplicate position updates that conflict with tile interpolation.

      // Check if arrived at destination
      if (state.pathIndex >= state.path.length) {
        state.hasDestination = false;

        // Broadcast movement end
        this.sendFn("tileMovementEnd", {
          id: mobId,
          tile: state.currentTile,
          worldPos: [worldPos.x, worldPos.y, worldPos.z],
          moveSeq: state.moveSeq,
          isMob: true,
        });

        // Clear path
        state.path = [];
        state.pathIndex = 0;

        // Broadcast idle state
        this.sendFn("entityModified", {
          id: mobId,
          changes: {
            p: [worldPos.x, worldPos.y, worldPos.z],
            v: [0, 0, 0],
            e: "idle",
          },
        });
      }
    }
  }

  /**
   * Check if a mob is currently moving
   */
  isMoving(mobId: string): boolean {
    const state = this.mobStates.get(mobId);
    return state ? state.hasDestination : false;
  }

  /**
   * Get current tile for a mob
   */
  getCurrentTile(mobId: string): TileCoord | null {
    const state = this.mobStates.get(mobId);
    return state ? state.currentTile : null;
  }

  /**
   * Get distance to destination in tiles
   */
  getDistanceToDestination(mobId: string): number {
    const state = this.mobStates.get(mobId);
    if (!state || !state.hasDestination) return 0;
    return Math.max(0, state.path.length - state.pathIndex);
  }

  /**
   * Initialize mob at a specific tile (for spawning)
   */
  initializeMob(
    mobId: string,
    position: Position3D,
    tilesPerTick: number = TILES_PER_TICK_WALK,
  ): void {
    const currentTile = worldToTile(position.x, position.z);
    const state = createMobTileState(currentTile, tilesPerTick);
    this.mobStates.set(mobId, state);
  }

  /**
   * Cleanup state for a mob (on death/despawn)
   */
  cleanup(mobId: string): void {
    this.mobStates.delete(mobId);
  }

  /**
   * Get stats for debugging/monitoring
   */
  getStats(): {
    totalMobs: number;
    mobsMoving: number;
    totalPathTiles: number;
  } {
    let mobsMoving = 0;
    let totalPathTiles = 0;

    for (const state of this.mobStates.values()) {
      if (state.hasDestination) mobsMoving++;
      totalPathTiles += Math.max(0, state.path.length - state.pathIndex);
    }

    return {
      totalMobs: this.mobStates.size,
      mobsMoving,
      totalPathTiles,
    };
  }
}
