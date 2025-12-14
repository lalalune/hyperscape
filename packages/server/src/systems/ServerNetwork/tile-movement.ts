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
  tilesWithinMeleeRange,
  getBestMeleeTile,
  createTileMovementState,
  BFSPathfinder,
} from "@hyperscape/shared";
import type { TileCoord, TileMovementState } from "@hyperscape/shared";

// Security: Input validation and anti-cheat
import {
  MovementInputValidator,
  MovementViolationSeverity,
} from "./movement/MovementInputValidator";
import { MovementAntiCheat } from "./movement/MovementAntiCheat";
import {
  getTileMovementRateLimiter,
  getPathfindRateLimiter,
} from "./services/SlidingWindowRateLimiter";

/**
 * Tile-based movement manager for RuneScape-style movement
 */
export class TileMovementManager {
  private playerStates: Map<string, TileMovementState> = new Map();
  private pathfinder: BFSPathfinder;
  // Y-axis for stable yaw rotation calculation
  private _up = new THREE.Vector3(0, 1, 0);
  private _tempQuat = new THREE.Quaternion();

  // Security: Input validation and anti-cheat monitoring
  private readonly inputValidator = new MovementInputValidator();
  private readonly antiCheat = new MovementAntiCheat();
  private readonly movementRateLimiter = getTileMovementRateLimiter();
  private readonly pathfindRateLimiter = getPathfindRateLimiter();

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
   * Check if a tile is walkable based on terrain constraints
   * Uses TerrainSystem to check water level, slope, and biome rules
   */
  private isTileWalkable(tile: TileCoord): boolean {
    const terrain = this.getTerrain();
    if (!terrain) {
      // Fallback: walkable if no terrain system available
      return true;
    }

    // Convert tile to world coordinates (center of tile)
    const worldPos = tileToWorld(tile);

    // Use TerrainSystem's walkability check (water, slope, lakes biome)
    const result = terrain.isPositionWalkable(worldPos.x, worldPos.z);
    return result.walkable;
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
   *
   * Security: All input is validated before processing.
   * Rate limiting prevents spam attacks.
   * Anti-cheat monitors for suspicious patterns.
   */
  handleMoveRequest(socket: ServerSocket, data: unknown): void {
    const playerEntity = socket.player;
    if (!playerEntity) {
      return;
    }

    const playerId = playerEntity.id;

    // Rate limit: prevent spam attacks
    if (!this.movementRateLimiter.check(playerId)) {
      return; // Silently drop - rate limiting is expected during fast clicking
    }

    // Get current state for validation context
    const state = this.getOrCreateState(playerId);

    // Validate input using MovementInputValidator
    const validation = this.inputValidator.validateMoveRequest(
      data,
      state.currentTile,
    );

    if (!validation.valid) {
      // Log violation to anti-cheat system
      this.antiCheat.recordViolation(
        playerId,
        "invalid_move_request",
        validation.severity ?? MovementViolationSeverity.MINOR,
        validation.error ?? "Unknown validation error",
        state.currentTile,
      );
      return;
    }

    const payload = validation.payload!;

    // Handle cancellation
    if (payload.cancel) {
      state.path = [];
      state.pathIndex = 0;

      // Broadcast idle state
      const curr = playerEntity.position;
      this.sendFn("entityModified", {
        id: playerId,
        changes: {
          p: [curr.x, curr.y, curr.z],
          v: [0, 0, 0],
          e: "idle",
        },
      });
      return;
    }

    // Check if this is just a runMode toggle (target equals current tile)
    if (tilesEqual(payload.targetTile, state.currentTile)) {
      state.isRunning = payload.runMode;
      this.sendFn("entityModified", {
        id: playerId,
        changes: { e: payload.runMode ? "run" : "walk" },
      });
      return;
    }

    // Rate limit pathfinding separately (CPU-expensive operation)
    if (!this.pathfindRateLimiter.check(playerId)) {
      return; // Too many pathfind requests
    }

    // Calculate BFS path from current tile to target
    const path = this.pathfinder.findPath(
      state.currentTile,
      payload.targetTile,
      (tile) => this.isTileWalkable(tile),
    );

    // Store path and update state
    state.path = path;
    state.pathIndex = 0;
    state.isRunning = payload.runMode;
    // Increment movement sequence for packet ordering
    // Client uses this to ignore stale packets from previous movements
    state.moveSeq = (state.moveSeq || 0) + 1;

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
      // Server sends COMPLETE authoritative path - client follows exactly, no recalculation
      // startTile: where server knows player IS (client uses this, not its visual position)
      // path: tiles to walk through (server's BFS result)
      // destinationTile: final target (for verification)
      // moveSeq: packet ordering to ignore stale packets
      // emote: bundled animation (OSRS-style, no separate packet)
      this.sendFn("tileMovementStart", {
        id: playerId,
        startTile: { x: state.currentTile.x, z: state.currentTile.z },
        path: path.map((t) => ({ x: t.x, z: t.z })),
        running: state.isRunning,
        destinationTile: { x: payload.targetTile.x, z: payload.targetTile.z },
        moveSeq: state.moveSeq,
        emote: state.isRunning ? "run" : "walk",
      });
    } else {
      // No path found or already at destination
      console.warn(
        `[TileMovement] ⚠️ No path found from (${state.currentTile.x},${state.currentTile.z}) to (${payload.targetTile.x},${payload.targetTile.z})`,
      );
    }
  }

  /**
   * Handle legacy input packet (routes to move request)
   *
   * Security: Basic type validation before routing to validated handler.
   */
  handleInput(socket: ServerSocket, data: unknown): void {
    // Type guard: must be non-null object
    if (data === null || typeof data !== "object") {
      return;
    }

    const payload = data as Record<string, unknown>;

    // Route click events to validated move request handler
    if (payload.type === "click" && Array.isArray(payload.target)) {
      this.handleMoveRequest(socket, {
        target: payload.target,
        runMode: typeof payload.runMode === "boolean" ? payload.runMode : false,
      });
    }
  }

  /**
   * Called every server tick (600ms) - advance all players along their paths
   */
  onTick(tickNumber: number): void {
    // Decay anti-cheat scores every 100 ticks (~60 seconds)
    // This rewards good behavior over time
    if (tickNumber % 100 === 0) {
      this.antiCheat.decayScores();
    }

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

      // Broadcast tile position update to clients
      // Include moveSeq so client can ignore stale packets from previous movements
      this.sendFn("entityTileUpdate", {
        id: playerId,
        tile: state.currentTile,
        worldPos: [worldPos.x, worldPos.y, worldPos.z],
        quaternion: entity.data.quaternion,
        emote: state.isRunning ? "run" : "walk",
        tickNumber,
        moveSeq: state.moveSeq,
      });

      // Check if arrived at destination
      if (state.pathIndex >= state.path.length) {
        // Broadcast movement end
        // Include moveSeq so client can ignore stale end packets
        this.sendFn("tileMovementEnd", {
          id: playerId,
          tile: state.currentTile,
          worldPos: [worldPos.x, worldPos.y, worldPos.z],
          moveSeq: state.moveSeq,
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
    this.antiCheat.cleanup(playerId);
    this.movementRateLimiter.reset(playerId);
    this.pathfindRateLimiter.reset(playerId);
  }

  /**
   * Sync player position after respawn or teleport
   *
   * CRITICAL: When a player respawns at spawn point, the TileMovementManager's
   * internal state still has their old tile position. This method resets the
   * internal state to match the actual world position, preventing path calculation
   * from the wrong starting tile.
   */
  syncPlayerPosition(
    playerId: string,
    position: { x: number; y: number; z: number },
  ): void {
    const newTile = worldToTile(position.x, position.z);

    // Get existing state or create new one
    let state = this.playerStates.get(playerId);

    if (state) {
      // Clear any pending movement and update tile
      state.currentTile = newTile;
      state.path = [];
      state.pathIndex = 0;
      state.moveSeq = (state.moveSeq || 0) + 1; // Increment to invalidate stale client packets
      console.log(
        `[TileMovement] Synced ${playerId} position to tile (${newTile.x},${newTile.z}) after respawn/teleport`,
      );
    } else {
      // Create fresh state at new position
      state = createTileMovementState(newTile);
      this.playerStates.set(playerId, state);
      console.log(
        `[TileMovement] Created new state for ${playerId} at tile (${newTile.x},${newTile.z})`,
      );
    }
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

  /**
   * Server-initiated movement toward a target position
   * Used for combat follow when target moves out of range
   *
   * OSRS-style pathfinding (from wiki):
   * - When clicking on an NPC, the requested tiles are all tiles within melee range
   * - BFS finds the CLOSEST valid tile among those options
   * - For range 1 melee: only cardinal tiles (N/S/E/W) are valid destinations
   * - Pathfinding recalculates every tick until target tile is found
   *
   * @param playerId - The player to move
   * @param targetPosition - Target position in world coordinates
   * @param running - Whether to run (default: true for combat following)
   * @param meleeRange - Weapon's melee range (1 = standard, 2 = halberd, 0 = non-combat)
   *
   * @see https://oldschool.runescape.wiki/w/Pathfinding
   */
  movePlayerToward(
    playerId: string,
    targetPosition: { x: number; y: number; z: number },
    running: boolean = true,
    meleeRange: number = 0, // 0 = non-combat, 1+ = melee combat range
  ): void {
    const entity = this.world.entities.get(playerId);
    if (!entity) {
      return;
    }

    const state = this.getOrCreateState(playerId);

    // CRITICAL: Sync state.currentTile with entity's actual position
    // The state might be stale if the player has been moving
    const actualEntityTile = worldToTile(entity.position.x, entity.position.z);
    if (!tilesEqual(state.currentTile, actualEntityTile)) {
      state.currentTile = actualEntityTile;
    }

    // Convert target to tile
    const targetTile = worldToTile(targetPosition.x, targetPosition.z);

    // Determine destination tile based on combat or non-combat movement
    let destinationTile: TileCoord;

    if (meleeRange > 0) {
      // COMBAT MOVEMENT: Use OSRS-accurate melee positioning
      // Check if already in valid melee range (cardinal-only for range 1)
      if (tilesWithinMeleeRange(state.currentTile, targetTile, meleeRange)) {
        return; // Already in position, no movement needed
      }

      // Find best melee tile (cardinal-only for range 1, diagonal allowed for range 2+)
      const meleeTile = getBestMeleeTile(
        targetTile,
        state.currentTile,
        meleeRange,
        (tile) => this.isTileWalkable(tile),
      );

      if (!meleeTile) {
        return; // No valid melee position found
      }

      destinationTile = meleeTile;
    } else {
      // NON-COMBAT MOVEMENT: Go directly to target tile
      if (tilesEqual(targetTile, state.currentTile)) {
        return; // Already at target
      }
      destinationTile = targetTile;
    }

    // Calculate BFS path to the destination tile (NOT to target, then truncate!)
    const path = this.pathfinder.findPath(
      state.currentTile,
      destinationTile,
      (tile) => this.isTileWalkable(tile),
    );

    if (path.length === 0) {
      return; // No path found
    }

    // Update state
    state.path = path;
    state.pathIndex = 0;
    state.isRunning = running;
    state.moveSeq = (state.moveSeq || 0) + 1;

    // Broadcast movement start
    const nextTile = path[0];
    const nextWorld = tileToWorld(nextTile);
    const curr = entity.position;
    const dx = nextWorld.x - curr.x;
    const dz = nextWorld.z - curr.z;

    // Calculate rotation to face movement direction
    if (Math.abs(dx) + Math.abs(dz) > 0.01) {
      const yaw = Math.atan2(-dx, -dz);
      this._tempQuat.setFromAxisAngle(this._up, yaw);

      if ((entity as { node?: THREE.Object3D }).node) {
        (entity as { node: THREE.Object3D }).node.quaternion.copy(
          this._tempQuat,
        );
      }
      (entity as { data: { quaternion?: number[] } }).data.quaternion = [
        this._tempQuat.x,
        this._tempQuat.y,
        this._tempQuat.z,
        this._tempQuat.w,
      ];
    }

    // Send movement start packet
    const actualDestination = path[path.length - 1];
    this.sendFn("tileMovementStart", {
      id: playerId,
      startTile: { x: state.currentTile.x, z: state.currentTile.z },
      path: path.map((t) => ({ x: t.x, z: t.z })),
      running: state.isRunning,
      destinationTile: { x: actualDestination.x, z: actualDestination.z },
      moveSeq: state.moveSeq,
      emote: state.isRunning ? "run" : "walk",
    });
  }
}
