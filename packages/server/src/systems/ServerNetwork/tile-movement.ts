/**
 * Tile Movement Manager
 *
 * RuneScape-style tile-based movement system.
 * Players move discretely from tile to tile on server ticks (600ms).
 *
 * Key differences from the old continuous system:
 * - Movement happens on ticks, not frames
 * - Players move 1 tile (walk) or 2 tiles (run) per tick
 * - Uses BFS pathfinding for paths
 * - Client interpolates visually between tile positions
 */

import type { ServerSocket } from "../../shared/types";
import {
  THREE,
  TerrainSystem,
  World,
  // Tile movement utilities
  TILES_PER_TICK_WALK,
  TILES_PER_TICK_RUN,
  worldToTile,
  tileToWorld,
  tilesEqual,
  createTileMovementState,
  BFSPathfinder,
} from "@hyperscape/shared";
import type { TileCoord, TileMovementState } from "@hyperscape/shared";

/**
 * Tile-based movement manager for RuneScape-style movement
 */
export class TileMovementManager {
  private playerStates: Map<string, TileMovementState> = new Map();
  private pathfinder: BFSPathfinder;
  // Y-axis for stable yaw rotation calculation
  private _up = new THREE.Vector3(0, 1, 0);
  private _tempQuat = new THREE.Quaternion();

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
   * Get or create movement state for a player
   */
  private getOrCreateState(playerId: string): TileMovementState {
    let state = this.playerStates.get(playerId);
    if (!state) {
      // Get current position and convert to tile
      const entity = this.world.entities.get(playerId);
      const currentTile: TileCoord = entity?.position
        ? worldToTile(entity.position.x, entity.position.z)
        : { x: 0, z: 0 };

      state = createTileMovementState(currentTile);
      this.playerStates.set(playerId, state);
    }
    return state;
  }

  /**
   * Handle move request from client
   */
  handleMoveRequest(socket: ServerSocket, data: unknown): void {
    const playerEntity = socket.player;
    if (!playerEntity) {
      console.warn(
        `[TileMovement] ⚠️ moveRequest ignored - socket ${socket.id} has no player entity`,
      );
      return;
    }

    const payload = data as {
      target?: number[] | null;
      targetTile?: TileCoord;
      runMode?: boolean;
      cancel?: boolean;
    };

    const state = this.getOrCreateState(playerEntity.id);

    // Handle cancellation - but ignore if it's immediately followed by a move
    if (payload?.cancel && !payload?.target && !payload?.targetTile) {
      state.path = [];
      state.pathIndex = 0;
      console.log(`[TileMovement] Cancelled movement for ${playerEntity.id}`);

      // Broadcast idle state
      const curr = playerEntity.position;
      this.sendFn("entityModified", {
        id: playerEntity.id,
        changes: {
          p: [curr.x, curr.y, curr.z],
          v: [0, 0, 0],
          e: "idle",
        },
      });
      return;
    }

    // Only runMode change (no new target)
    if (!payload?.target && !payload?.targetTile) {
      if (payload?.runMode !== undefined) {
        state.isRunning = payload.runMode;
        this.sendFn("entityModified", {
          id: playerEntity.id,
          changes: { e: payload.runMode ? "run" : "walk" },
        });
      }
      return;
    }

    // Get target tile (from explicit tile or world coords)
    let targetTile: TileCoord;
    if (payload.targetTile) {
      targetTile = payload.targetTile;
    } else if (payload.target) {
      targetTile = worldToTile(payload.target[0], payload.target[2]);
    } else {
      return;
    }

    console.log(
      `[TileMovement] Move request: ${playerEntity.id} from tile (${state.currentTile.x},${state.currentTile.z}) to (${targetTile.x},${targetTile.z})`,
    );

    // Calculate BFS path from current tile to target
    const path = this.pathfinder.findPath(
      state.currentTile,
      targetTile,
      (tile) => this.isTileWalkable(tile),
    );

    console.log(`[TileMovement] Path found: ${path.length} tiles`);

    // Store path and update state
    state.path = path;
    state.pathIndex = 0;
    state.isRunning = payload?.runMode ?? false;

    // Immediately rotate player toward destination and send first tile update
    if (path.length > 0) {
      const nextTile = path[0];
      const nextWorld = tileToWorld(nextTile);
      const curr = playerEntity.position;
      const dx = nextWorld.x - curr.x;
      const dz = nextWorld.z - curr.z;

      // Calculate rotation to face movement direction using stable atan2 method
      if (Math.abs(dx) + Math.abs(dz) > 0.01) {
        // VRM faces -Z after factory rotation. Rotating -Z by yaw θ around Y gives:
        // (-sin(θ), 0, -cos(θ)). To face direction (dx, dz), solve:
        // -sin(θ) = dx, -cos(θ) = dz → θ = atan2(-dx, -dz)
        const yaw = Math.atan2(-dx, -dz);
        this._tempQuat.setFromAxisAngle(this._up, yaw);

        if (playerEntity.node) {
          playerEntity.node.quaternion.copy(this._tempQuat);
        }
        playerEntity.data.quaternion = [
          this._tempQuat.x,
          this._tempQuat.y,
          this._tempQuat.z,
          this._tempQuat.w,
        ];
      }

      // Broadcast movement started with path
      // Include destination tile explicitly so client knows where to end up
      // (path might be calculated from server position which can differ from client visual)
      this.sendFn("tileMovementStart", {
        id: playerEntity.id,
        path: path.map((t) => ({ x: t.x, z: t.z })),
        running: state.isRunning,
        destinationTile: { x: targetTile.x, z: targetTile.z },
      });

      // Send initial rotation and emote
      this.sendFn("entityModified", {
        id: playerEntity.id,
        changes: {
          q: playerEntity.data.quaternion,
          e: state.isRunning ? "run" : "walk",
        },
      });
    } else {
      console.log(`[TileMovement] No path found or already at destination`);
    }
  }

  /**
   * Handle legacy input packet (routes to move request)
   */
  handleInput(socket: ServerSocket, data: unknown): void {
    const payload = data as {
      type?: string;
      target?: number[];
      runMode?: boolean;
    };

    if (payload.type === "click" && Array.isArray(payload.target)) {
      this.handleMoveRequest(socket, {
        target: payload.target,
        runMode: payload.runMode,
      });
    }
  }

  /**
   * Called every server tick (600ms) - advance all players along their paths
   */
  onTick(tickNumber: number): void {
    const terrain = this.getTerrain();

    for (const [playerId, state] of this.playerStates) {
      // Skip if no path or at end
      if (state.path.length === 0 || state.pathIndex >= state.path.length) {
        continue;
      }

      const entity = this.world.entities.get(playerId);
      if (!entity) {
        this.playerStates.delete(playerId);
        continue;
      }

      // Store previous position for rotation calculation
      const prevTile = { ...state.currentTile };

      // Move 1 tile (walk) or 2 tiles (run) per tick
      const tilesToMove = state.isRunning
        ? TILES_PER_TICK_RUN
        : TILES_PER_TICK_WALK;

      for (let i = 0; i < tilesToMove; i++) {
        if (state.pathIndex >= state.path.length) break;

        const nextTile = state.path[state.pathIndex];
        state.currentTile = { ...nextTile };
        state.pathIndex++;
      }

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
      entity.data.position = [worldPos.x, worldPos.y, worldPos.z];

      // Calculate rotation based on movement direction (from previous to current tile)
      const prevWorld = tileToWorld(prevTile);
      const dx = worldPos.x - prevWorld.x;
      const dz = worldPos.z - prevWorld.z;

      if (Math.abs(dx) + Math.abs(dz) > 0.01) {
        // VRM faces -Z after factory rotation. Rotating -Z by yaw θ around Y gives:
        // (-sin(θ), 0, -cos(θ)). To face direction (dx, dz), solve:
        // -sin(θ) = dx, -cos(θ) = dz → θ = atan2(-dx, -dz)
        const yaw = Math.atan2(-dx, -dz);
        this._tempQuat.setFromAxisAngle(this._up, yaw);

        if (entity.node) {
          entity.node.quaternion.copy(this._tempQuat);
        }
        entity.data.quaternion = [
          this._tempQuat.x,
          this._tempQuat.y,
          this._tempQuat.z,
          this._tempQuat.w,
        ];
      }

      console.log(
        `[TileMovement] Tick ${tickNumber}: ${playerId} moved to tile (${state.currentTile.x},${state.currentTile.z}) - ${state.pathIndex}/${state.path.length}`,
      );

      // Broadcast tile position update to clients
      this.sendFn("entityTileUpdate", {
        id: playerId,
        tile: state.currentTile,
        worldPos: [worldPos.x, worldPos.y, worldPos.z],
        quaternion: entity.data.quaternion,
        emote: state.isRunning ? "run" : "walk",
        tickNumber,
      });

      // Check if arrived at destination
      if (state.pathIndex >= state.path.length) {
        console.log(`[TileMovement] ${playerId} arrived at destination`);

        // Broadcast movement end
        this.sendFn("tileMovementEnd", {
          id: playerId,
          tile: state.currentTile,
          worldPos: [worldPos.x, worldPos.y, worldPos.z],
        });

        // Clear path
        state.path = [];
        state.pathIndex = 0;

        // Broadcast idle state
        this.sendFn("entityModified", {
          id: playerId,
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
   * Legacy frame-based update (for compatibility during transition)
   * This should be removed once tile movement is fully working
   */
  update(_dt: number): void {
    // No-op - movement is now tick-based
  }

  /**
   * Cleanup state for a player
   */
  cleanup(playerId: string): void {
    this.playerStates.delete(playerId);
  }

  /**
   * Get current tile for a player
   */
  getCurrentTile(playerId: string): TileCoord | null {
    const state = this.playerStates.get(playerId);
    return state ? state.currentTile : null;
  }

  /**
   * Check if a player is currently moving
   */
  isMoving(playerId: string): boolean {
    const state = this.playerStates.get(playerId);
    return state
      ? state.path.length > 0 && state.pathIndex < state.path.length
      : false;
  }
}
