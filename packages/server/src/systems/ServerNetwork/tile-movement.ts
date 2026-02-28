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
  EventType,
  DeathState,
  AttackType,
  // Tile movement utilities
  TILES_PER_TICK_WALK,
  TILES_PER_TICK_RUN,
  worldToTile,
  worldToTileInto,
  tileToWorld,
  tileToWorldInto,
  tilesEqual,
  tilesWithinMeleeRange,
  tilesWithinRange,
  createTileMovementState,
  BFSPathfinder,
  // Combat pathfinding: LoS and valid tile generation
  hasLineOfSight,
  getValidRangedTiles,
  getValidMeleeTiles,
  // Collision system
  CollisionMask,
  BuildingCollisionService,
  type EntityID,
} from "@hyperscape/shared";
import type { TileCoord, TileMovementState } from "@hyperscape/shared";

// Security: Input validation and anti-cheat
import {
  MovementInputValidator,
  MovementViolationSeverity,
} from "./movement/MovementInputValidator";
import {
  MovementAntiCheat,
  type AntiCheatKickCallback,
} from "./movement/MovementAntiCheat";
import {
  getTileMovementRateLimiter,
  getPathfindRateLimiter,
} from "./services/SlidingWindowRateLimiter";

// Agility XP constants (batched to prevent visual spam)
const AGILITY_TILES_PER_XP_GRANT = 100; // Tiles needed before XP is granted
const AGILITY_XP_PER_GRANT = 50; // XP granted per threshold (effectively 1 XP per 2 tiles)

/**
 * Tile-based movement manager for RuneScape-style movement
 */
export class TileMovementManager {
  private playerStates: Map<string, TileMovementState> = new Map();
  private pathfinder: BFSPathfinder;

  /**
   * Agility XP tracking: tiles traveled per player (batched at 100 tiles = 50 XP)
   * Reset on death, cleared on disconnect
   */
  private tilesTraveledForXP: Map<string, number> = new Map();
  // Y-axis for stable yaw rotation calculation
  private _up = new THREE.Vector3(0, 1, 0);
  private _tempQuat = new THREE.Quaternion();

  /**
   * Arrival emotes: When a player arrives at destination, use this emote instead of "idle"
   * Used by gathering systems (fishing, mining, etc.) to set the action emote atomically
   * with the movement end packet, preventing race conditions on the client.
   */
  private arrivalEmotes: Map<string, string> = new Map();

  /**
   * OSRS-ACCURATE: Tick-start positions for all players
   * Captured at the VERY START of onTick(), BEFORE any movement processing.
   * Used by FollowManager to create the 1-tick delay effect.
   *
   * Key insight from OSRS: "The important part is to set the previousTile
   * at the start (or the end) of the tick not when they actually move"
   */
  private tickStartTiles: Map<string, TileCoord> = new Map();

  // Security: Input validation and anti-cheat monitoring
  private readonly inputValidator = new MovementInputValidator();
  private readonly antiCheat = new MovementAntiCheat();
  private readonly movementRateLimiter = getTileMovementRateLimiter();
  private readonly pathfindRateLimiter = getPathfindRateLimiter();

  // ============================================================================
  // PRE-ALLOCATED BUFFERS (Zero-allocation hot path support)
  // ============================================================================

  /** Reusable tile coordinate for previous position in onTick/processPlayerTick */
  private readonly _prevTile: TileCoord = { x: 0, z: 0 };

  /** Reusable tile coordinate for target position calculations */
  private readonly _targetTile: TileCoord = { x: 0, z: 0 };

  /** Reusable tile coordinate for entity position sync */
  private readonly _actualEntityTile: TileCoord = { x: 0, z: 0 };

  /** Pre-allocated buffer for network path transmission (avoids .map() allocation) */
  private readonly _networkPathBuffer: Array<{ x: number; z: number }> = [];

  /** Pre-allocated world position for tileToWorldInto (zero-allocation) */
  private readonly _worldPos: { x: number; y: number; z: number } = {
    x: 0,
    y: 0,
    z: 0,
  };

  /** Pre-allocated world position for previous tile rotation calc */
  private readonly _prevWorldPos: { x: number; y: number; z: number } = {
    x: 0,
    y: 0,
    z: 0,
  };

  /** Pre-allocated tile for tick-start capture */
  private readonly _tickStartTile: TileCoord = { x: 0, z: 0 };

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
   * Wire anti-cheat auto-kick callback.
   * Called by ServerNetwork after construction to provide socket-layer kick access.
   */
  setAntiCheatKickCallback(callback: AntiCheatKickCallback): void {
    this.antiCheat.setKickCallback(callback);
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
   * Get building collision service
   */
  private getBuildingCollision(): BuildingCollisionService | null {
    // Only attempt to get it if it exists (it's in shared but registered on server World too)
    return (
      (this.world.getSystem(
        "buildingCollision",
      ) as unknown as BuildingCollisionService) || null
    );
  }

  /**
   * Check if a tile is walkable based on collision and terrain constraints
   * Checks CollisionMatrix for static objects (trees, rocks, stations)
   * and TerrainSystem for water level, slope, and biome rules
   */
  private isTileWalkable(
    tile: TileCoord,
    floorIndex: number = 0,
    fromTile?: TileCoord,
    playerBuildingId?: string | null,
  ): boolean {
    const buildingService = this.getBuildingCollision();

    let isTargetInBuilding = false;

    // Check building collision first (if available)
    if (buildingService) {
      const buildingCheck = buildingService.checkBuildingMovement(
        fromTile ?? null,
        tile,
        floorIndex,
        playerBuildingId ?? null,
      );

      // BuildingCollisionService handles all building-related blocking
      if (!buildingCheck.buildingAllowsMovement) {
        return false;
      }

      isTargetInBuilding = buildingCheck.targetInBuildingFootprint;
    }

    // Directional block from collision matrix
    if (floorIndex === 0 && fromTile) {
      if (
        this.world.collision.isBlocked(fromTile.x, fromTile.z, tile.x, tile.z)
      ) {
        return false;
      }
    }

    // If on ground floor, check global collision matrix (trees, rocks, etc. AND furniture/anvils inside buildings)
    if (floorIndex === 0) {
      if (
        this.world.collision.hasFlags(tile.x, tile.z, CollisionMask.BLOCKS_WALK)
      ) {
        return false;
      }
    }

    // If target is inside a building footprint, skip terrain checks
    // (building floor is walkable and overrides terrain)
    if (isTargetInBuilding) {
      return true;
    }

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
   * Find the closest walkable tile to a target position using BFS.
   * Used for fishing where the target (fishing spot) is in water
   * and we need to find the nearest shore tile.
   *
   * @param targetPos - Target position in world coordinates
   * @param maxSearchRadius - Maximum tiles to search outward (default: 10)
   * @returns The closest walkable tile, or null if none found within radius
   */
  findClosestWalkableTile(
    targetPos: { x: number; z: number },
    maxSearchRadius: number = 10,
  ): TileCoord | null {
    const targetTile = worldToTile(targetPos.x, targetPos.z);

    // For general closest tile search, assume ground floor (index 0)
    // Determining floor for arbitrary target pos is complex without context
    const floorIndex = 0;

    // If target tile is already walkable, return it
    if (this.isTileWalkable(targetTile, floorIndex)) {
      return targetTile;
    }

    // BFS outward from target tile to find closest walkable tile
    // Search in expanding rings (distance 1, 2, 3, etc.)
    for (let radius = 1; radius <= maxSearchRadius; radius++) {
      // Check all tiles at this radius (ring around target)
      // Use a simple approach: check all tiles in a square, filter by distance
      const candidates: Array<{ tile: TileCoord; dist: number }> = [];

      for (let dx = -radius; dx <= radius; dx++) {
        for (let dz = -radius; dz <= radius; dz++) {
          // Only check tiles at exactly this radius (Chebyshev distance)
          const chebyshev = Math.max(Math.abs(dx), Math.abs(dz));
          if (chebyshev !== radius) continue;

          const tile: TileCoord = {
            x: targetTile.x + dx,
            z: targetTile.z + dz,
          };

          if (this.isTileWalkable(tile, floorIndex)) {
            // Use Euclidean distance for sorting (more accurate than Chebyshev)
            const euclidean = Math.sqrt(dx * dx + dz * dz);
            candidates.push({ tile, dist: euclidean });
          }
        }
      }

      // If we found walkable tiles at this radius, return the closest one
      if (candidates.length > 0) {
        candidates.sort((a, b) => a.dist - b.dist);
        return candidates[0].tile;
      }
    }

    // No walkable tile found within search radius
    return null;
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
      console.warn("[Movement] handleMoveRequest: no player entity on socket");
      return;
    }

    // Death lock: Dead players cannot move
    const deathState = playerEntity.data?.deathState;
    if (deathState === DeathState.DYING || deathState === DeathState.DEAD) {
      return; // Expected — dead players clicking doesn't need logging
    }

    const playerId = playerEntity.id;

    // Duel lock: Check if player can move (frozen during countdown, or noMovement rule)
    const duelSystem = this.world.getSystem("duel") as {
      canMove?: (playerId: string) => boolean;
    } | null;
    if (duelSystem?.canMove && !duelSystem.canMove(playerId)) {
      return; // Silently reject - player frozen in duel
    }

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

    // OSRS-ACCURACY: Emit click-to-move event for weak queue cancellation
    // This MUST happen before any early returns (same-tile, cancel, etc.)
    // ResourceSystem subscribes to this to cancel gathering when player clicks ground
    // In OSRS, ANY click cancels weak queue actions like gathering
    this.world.emit(EventType.MOVEMENT_CLICK_TO_MOVE, {
      playerId: playerId,
      targetPosition: {
        x: payload.targetTile.x,
        y: 0,
        z: payload.targetTile.z,
      },
    });

    // Handle cancellation
    if (payload.cancel) {
      state.path.length = 0; // Zero-allocation clear
      state.pathIndex = 0;

      // RS3-style: Clear movement flag so combat can resume
      playerEntity.data.tileMovementActive = false;

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

    // Determine current floor index for floor-aware pathfinding
    const buildingService = this.getBuildingCollision();
    const currentFloor = buildingService
      ? buildingService.getPlayerFloor(playerId as EntityID)
      : 0;

    const currentBuildingId = buildingService
      ? buildingService.getBuildingAt(state.currentTile.x, state.currentTile.z)
      : null;

    // Calculate BFS path from current tile to target
    const path = this.pathfinder.findPath(
      state.currentTile,
      payload.targetTile,
      (tile, fromTile) =>
        this.isTileWalkable(tile, currentFloor, fromTile, currentBuildingId),
    );

    // Store path and update state
    state.path = path;
    state.pathIndex = 0;
    state.isRunning = payload.runMode;
    // Increment movement sequence for packet ordering
    // Client uses this to ignore stale packets from previous movements
    state.moveSeq = (state.moveSeq || 0) + 1;

    // Track partial-path state per player so the path-continuation logic in onTick
    // can check without reading the shared BFSPathfinder flag (which may be overwritten
    // by another player's path before onTick runs).
    state.lastPathPartial = this.pathfinder.wasLastPathPartial();

    // Store original requested destination for seamless long-distance continuation.
    // Cleared when destination is reached or is definitively unreachable.
    state.requestedDestination = {
      x: payload.targetTile.x,
      z: payload.targetTile.z,
    };

    // Any new click cancels a precomputed segment that hasn't been consumed yet.
    // The stale tileMovementStart (isContinuation) will be rejected client-side via moveSeq.
    state.nextSegmentPrecomputed = false;

    // Set movement flag for tracking active tile movement
    if (path.length > 0) {
      playerEntity.data.tileMovementActive = true;

      // OSRS-accurate: Clicking ground cancels your attack
      // Player is walking away - they're no longer attacking their target
      // The mob continues chasing them, and auto-retaliate can trigger if hit
      this.world.emit(EventType.COMBAT_PLAYER_DISENGAGE, {
        playerId: playerId,
      });

      // Cancel any pending attack - player chose a different destination
      // This handles the case where player was walking to a mob but changed their mind
      this.world.emit(EventType.PENDING_ATTACK_CANCEL, {
        playerId: playerId,
      });
    }

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

      // Zero-allocation: copy path to pre-allocated network buffer
      this._networkPathBuffer.length = path.length;
      for (let i = 0; i < path.length; i++) {
        if (!this._networkPathBuffer[i]) {
          this._networkPathBuffer[i] = { x: 0, z: 0 };
        }
        this._networkPathBuffer[i].x = path[i].x;
        this._networkPathBuffer[i].z = path[i].z;
      }

      this.sendFn("tileMovementStart", {
        id: playerId,
        startTile: { x: state.currentTile.x, z: state.currentTile.z },
        path: this._networkPathBuffer,
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
    // OSRS-ACCURATE: Capture tick-start positions for ALL players FIRST
    // This happens BEFORE any movement, so FollowManager can see where
    // players were at the START of this tick (creating 1-tick delay effect)
    // Overwrite existing tile objects in-place to avoid per-tick allocations.
    // New players get a fresh object; removed players are cleaned up below.
    for (const [playerId, state] of this.playerStates) {
      const existing = this.tickStartTiles.get(playerId);
      if (existing) {
        existing.x = state.currentTile.x;
        existing.z = state.currentTile.z;
      } else {
        this.tickStartTiles.set(playerId, {
          x: state.currentTile.x,
          z: state.currentTile.z,
        });
      }
    }
    // Remove stale entries for players no longer tracked
    for (const id of this.tickStartTiles.keys()) {
      if (!this.playerStates.has(id)) {
        this.tickStartTiles.delete(id);
      }
    }

    // Initialize previousTile for newly spawned players only
    // Movement processing will update it to "last stepped off" tile
    for (const [_playerId, state] of this.playerStates) {
      if (state.previousTile === null) {
        state.previousTile = { x: state.currentTile.x, z: state.currentTile.z };
      }
    }

    // Decay anti-cheat scores every 100 ticks (~60 seconds)
    // This rewards good behavior over time
    if (tickNumber % 100 === 0) {
      this.antiCheat.decayScores();
    }

    const terrain = this.getTerrain();
    const buildingService = this.getBuildingCollision();

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

      // Store previous position for rotation calculation (zero allocation)
      this._prevTile.x = state.currentTile.x;
      this._prevTile.z = state.currentTile.z;

      // Move 1 tile (walk) or 2 tiles (run) per tick
      const tilesToMove = state.isRunning
        ? TILES_PER_TICK_RUN
        : TILES_PER_TICK_WALK;

      for (let i = 0; i < tilesToMove; i++) {
        if (state.pathIndex >= state.path.length) break;

        // OSRS-ACCURATE: Capture the tile we're stepping OFF of
        // This ensures previousTile is always 1 tile behind currentTile
        // Used by FollowManager for 1-tile trailing effect
        state.previousTile!.x = state.currentTile.x;
        state.previousTile!.z = state.currentTile.z;

        const nextTile = state.path[state.pathIndex];

        // Handle stair transitions if building service is available
        if (buildingService) {
          buildingService.handleStairTransition(
            playerId as EntityID,
            state.currentTile,
            nextTile,
          );
        }

        // Copy values instead of spread (zero allocation)
        state.currentTile.x = nextTile.x;
        state.currentTile.z = nextTile.z;
        state.pathIndex++;
      }

      // Track tiles moved for Agility XP (batched at 100 tiles = 50 XP)
      const tilesMoved =
        Math.abs(state.currentTile.x - this._prevTile.x) +
        Math.abs(state.currentTile.z - this._prevTile.z);
      if (tilesMoved > 0) {
        const currentTiles =
          (this.tilesTraveledForXP.get(playerId) || 0) + tilesMoved;
        if (currentTiles >= AGILITY_TILES_PER_XP_GRANT) {
          // Grant XP and preserve overflow
          const grantsEarned = Math.floor(
            currentTiles / AGILITY_TILES_PER_XP_GRANT,
          );
          const xpToGrant = grantsEarned * AGILITY_XP_PER_GRANT;
          this.tilesTraveledForXP.set(
            playerId,
            currentTiles % AGILITY_TILES_PER_XP_GRANT,
          );
          // Emit XP gain event (handled by SkillsSystem)
          this.world.emit(EventType.SKILLS_XP_GAINED, {
            playerId,
            skill: "agility",
            amount: xpToGrant,
          });
        } else {
          // Accumulate tiles silently
          this.tilesTraveledForXP.set(playerId, currentTiles);
        }
      }

      // Convert tile to world position (zero-allocation)
      tileToWorldInto(state.currentTile, this._worldPos);

      // determine Y elevation
      if (buildingService) {
        const currentFloor = buildingService.getPlayerFloor(
          playerId as EntityID,
        );
        const buildingId = buildingService.getBuildingAt(
          this._worldPos.x,
          this._worldPos.z,
        );

        let floorHeight: number | null = null;
        if (buildingId) {
          floorHeight = buildingService.getFloorHeight(
            buildingId,
            currentFloor,
          );
        }

        if (floorHeight !== null) {
          this._worldPos.y = floorHeight + 0.1;
        } else if (terrain) {
          const h = terrain.getHeightAt(this._worldPos.x, this._worldPos.z);
          if (h !== null && Number.isFinite(h)) {
            this._worldPos.y = h! + 0.1;
          } else {
            this._worldPos.y = 0.1;
          }
        } else {
          this._worldPos.y = 0.1;
        }
      } else if (terrain) {
        const height = terrain.getHeightAt(this._worldPos.x, this._worldPos.z);
        if (height !== null && Number.isFinite(height)) {
          this._worldPos.y = (height as number) + 0.1;
        }
      }

      // Update entity position on server
      entity.position.set(this._worldPos.x, this._worldPos.y, this._worldPos.z);
      entity.data.position = [
        this._worldPos.x,
        this._worldPos.y,
        this._worldPos.z,
      ];

      // OSRS-ACCURATE: Mark player as having moved this tick
      // Face direction system will skip rotation update if player moved
      // @see https://osrs-docs.com/docs/packets/outgoing/updating/masks/face-direction/
      const faceManager = (
        this.world as {
          faceDirectionManager?: { markPlayerMoved: (id: string) => void };
        }
      ).faceDirectionManager;
      faceManager?.markPlayerMoved(playerId);

      // Calculate rotation based on movement direction (zero-allocation)
      tileToWorldInto(this._prevTile, this._prevWorldPos);
      const dx = this._worldPos.x - this._prevWorldPos.x;
      const dz = this._worldPos.z - this._prevWorldPos.z;

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
        worldPos: [this._worldPos.x, this._worldPos.y, this._worldPos.z],
        quaternion: entity.data.quaternion,
        emote: state.isRunning ? "run" : "walk",
        tickNumber,
        moveSeq: state.moveSeq,
      });

      // Look-ahead: pre-compute the next path segment 1 tick before the current
      // one ends so the client can append it seamlessly (no idle gap between segments).
      // Fires when exactly 1 tick of path is left and there is more ground to cover.
      {
        const tilesPerTick = state.isRunning
          ? TILES_PER_TICK_RUN
          : TILES_PER_TICK_WALK;
        const tilesRemaining = state.path.length - state.pathIndex;
        if (
          tilesRemaining > 0 &&
          tilesRemaining <= tilesPerTick &&
          state.lastPathPartial &&
          state.requestedDestination &&
          !state.nextSegmentPrecomputed &&
          !tilesEqual(
            state.path[state.path.length - 1],
            state.requestedDestination,
          )
        ) {
          const pathEnd = state.path[state.path.length - 1];
          this._precomputeAndSendNextSegment(
            playerId,
            pathEnd,
            state.requestedDestination,
            state.isRunning,
            state,
          );
          state.nextSegmentPrecomputed = true;
        }
      }

      // Check if arrived at destination
      if (state.pathIndex >= state.path.length) {
        // Path continuation: if BFS hit its iteration limit before reaching the
        // requested destination, immediately re-pathfind from the new tile so
        // movement continues seamlessly without a stop frame.
        if (
          state.lastPathPartial &&
          state.requestedDestination &&
          !tilesEqual(state.currentTile, state.requestedDestination)
        ) {
          if (state.nextSegmentPrecomputed) {
            // Already sent the next segment early — just clear flags so the
            // client's appended path plays through without an extra BFS here.
            state.requestedDestination = null;
            state.lastPathPartial = false;
            state.nextSegmentPrecomputed = false;
          } else {
            const dest = state.requestedDestination;
            // Clear before re-pathfind so an unreachable tile cannot loop forever
            state.requestedDestination = null;
            state.lastPathPartial = false;
            this._continuePathToDestination(playerId, dest, state.isRunning);
            // If continuation found a new path, skip tileMovementEnd to keep animation continuous
            if (state.path.length > 0) {
              continue;
            }
          }
        } else {
          // Reached the true destination (or it became unreachable)
          state.requestedDestination = null;
          state.lastPathPartial = false;
          state.nextSegmentPrecomputed = false;
        }

        // Get any pending arrival emote (e.g., "fishing" for gathering actions)
        // This is bundled with tileMovementEnd to prevent race conditions
        const arrivalEmote = this.arrivalEmotes.get(playerId) || "idle";
        this.arrivalEmotes.delete(playerId);

        // Broadcast movement end with emote (atomic delivery)
        // Include moveSeq so client can ignore stale end packets
        // Note: Rotation is handled by FaceDirectionManager at end of tick
        this.sendFn("tileMovementEnd", {
          id: playerId,
          tile: state.currentTile,
          worldPos: [this._worldPos.x, this._worldPos.y, this._worldPos.z],
          moveSeq: state.moveSeq,
          emote: arrivalEmote,
        });

        // Clear path
        state.path.length = 0; // Zero-allocation clear
        state.pathIndex = 0;

        // RS3-style: Clear movement flag so combat can resume
        entity.data.tileMovementActive = false;

        // Broadcast entity state with arrival emote
        const entityModifiedChanges: Record<string, unknown> = {
          p: [this._worldPos.x, this._worldPos.y, this._worldPos.z],
          v: [0, 0, 0],
          e: arrivalEmote,
        };
        this.sendFn("entityModified", {
          id: playerId,
          changes: entityModifiedChanges,
        });
      }
    }
  }

  /**
   * Process movement for a specific player on this tick
   *
   * OSRS-ACCURATE: Called by GameTickProcessor during player phase
   * This processes just one player's movement instead of all players.
   *
   * Zero-allocation: Uses pre-allocated tile buffers.
   *
   * @param playerId - The player to process movement for
   * @param tickNumber - Current tick number
   */
  processPlayerTick(playerId: string, tickNumber: number): void {
    const state = this.playerStates.get(playerId);
    if (!state) return;

    // Skip if no path or at end
    if (state.path.length === 0 || state.pathIndex >= state.path.length) {
      return;
    }

    const entity = this.world.entities.get(playerId);
    if (!entity) {
      this.playerStates.delete(playerId);
      return;
    }

    const terrain = this.getTerrain();
    const buildingService = this.getBuildingCollision();

    // Store previous position for rotation calculation (zero allocation)
    this._prevTile.x = state.currentTile.x;
    this._prevTile.z = state.currentTile.z;

    // Move 1 tile (walk) or 2 tiles (run) per tick
    const tilesToMove = state.isRunning
      ? TILES_PER_TICK_RUN
      : TILES_PER_TICK_WALK;

    for (let i = 0; i < tilesToMove; i++) {
      if (state.pathIndex >= state.path.length) break;

      // OSRS-ACCURATE: Capture the tile we're stepping OFF of
      // This ensures previousTile is always 1 tile behind currentTile
      // Used by FollowManager for 1-tile trailing effect
      state.previousTile!.x = state.currentTile.x;
      state.previousTile!.z = state.currentTile.z;

      const nextTile = state.path[state.pathIndex];

      // Handle stair transitions if building service is available
      if (buildingService) {
        buildingService.handleStairTransition(
          playerId as EntityID,
          state.currentTile,
          nextTile,
        );
      }

      // Copy values instead of spread (zero allocation)
      state.currentTile.x = nextTile.x;
      state.currentTile.z = nextTile.z;
      state.pathIndex++;
    }

    // Convert tile to world position (zero-allocation)
    tileToWorldInto(state.currentTile, this._worldPos);

    // determine Y elevation
    if (buildingService) {
      const currentFloor = buildingService.getPlayerFloor(playerId as EntityID);
      const buildingId = buildingService.getBuildingAt(
        state.currentTile.x,
        state.currentTile.z,
      );

      let floorHeight: number | null = null;
      if (buildingId) {
        floorHeight = buildingService.getFloorHeight(buildingId, currentFloor);
      }

      if (floorHeight !== null) {
        this._worldPos.y = floorHeight + 0.1;
      } else if (terrain) {
        const h = terrain.getHeightAt(this._worldPos.x, this._worldPos.z);
        if (h !== null && Number.isFinite(h)) {
          this._worldPos.y = h! + 0.1;
        } else {
          this._worldPos.y = 0.1;
        }
      } else {
        this._worldPos.y = 0.1;
      }
    } else if (terrain) {
      const height = terrain.getHeightAt(this._worldPos.x, this._worldPos.z);
      if (height !== null && Number.isFinite(height)) {
        this._worldPos.y = (height as number) + 0.1;
      }
    }

    // Update entity position on server
    entity.position.set(this._worldPos.x, this._worldPos.y, this._worldPos.z);
    entity.data.position = [
      this._worldPos.x,
      this._worldPos.y,
      this._worldPos.z,
    ];

    // OSRS-ACCURATE: Mark player as having moved this tick
    // Face direction system will skip rotation update if player moved
    const faceManager = (
      this.world as {
        faceDirectionManager?: { markPlayerMoved: (id: string) => void };
      }
    ).faceDirectionManager;
    faceManager?.markPlayerMoved(playerId);

    // Calculate rotation based on movement direction (zero-allocation)
    tileToWorldInto(this._prevTile, this._prevWorldPos);
    const dx = this._worldPos.x - this._prevWorldPos.x;
    const dz = this._worldPos.z - this._prevWorldPos.z;

    if (Math.abs(dx) + Math.abs(dz) > 0.01) {
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
    this.sendFn("entityTileUpdate", {
      id: playerId,
      tile: state.currentTile,
      worldPos: [this._worldPos.x, this._worldPos.y, this._worldPos.z],
      quaternion: entity.data.quaternion,
      emote: state.isRunning ? "run" : "walk",
      tickNumber,
      moveSeq: state.moveSeq,
    });

    // Look-ahead: pre-compute the next path segment 1 tick before the current
    // one ends so the client can append it seamlessly (no idle gap between segments).
    {
      const tilesPerTick = state.isRunning
        ? TILES_PER_TICK_RUN
        : TILES_PER_TICK_WALK;
      const tilesRemaining = state.path.length - state.pathIndex;
      if (
        tilesRemaining > 0 &&
        tilesRemaining <= tilesPerTick &&
        state.lastPathPartial &&
        state.requestedDestination &&
        !state.nextSegmentPrecomputed &&
        !tilesEqual(
          state.path[state.path.length - 1],
          state.requestedDestination,
        )
      ) {
        const pathEnd = state.path[state.path.length - 1];
        this._precomputeAndSendNextSegment(
          playerId,
          pathEnd,
          state.requestedDestination,
          state.isRunning,
          state,
        );
        state.nextSegmentPrecomputed = true;
      }
    }

    // Check if arrived at destination
    if (state.pathIndex >= state.path.length) {
      // Path continuation: if BFS hit its iteration limit before reaching the
      // requested destination, immediately re-pathfind from the new tile so
      // movement continues seamlessly without a stop frame.
      if (
        state.lastPathPartial &&
        state.requestedDestination &&
        !tilesEqual(state.currentTile, state.requestedDestination)
      ) {
        if (state.nextSegmentPrecomputed) {
          // Already sent the next segment early — just clear flags.
          state.requestedDestination = null;
          state.lastPathPartial = false;
          state.nextSegmentPrecomputed = false;
        } else {
          const dest = state.requestedDestination;
          state.requestedDestination = null;
          state.lastPathPartial = false;
          this._continuePathToDestination(playerId, dest, state.isRunning);
          // If continuation found a new path, skip tileMovementEnd to keep animation continuous
          if (state.path.length > 0) return;
        }
      } else {
        state.requestedDestination = null;
        state.lastPathPartial = false;
        state.nextSegmentPrecomputed = false;
      }

      // Get any pending arrival emote (e.g., "fishing" for gathering actions)
      // This is bundled with tileMovementEnd to prevent race conditions
      const arrivalEmote = this.arrivalEmotes.get(playerId) || "idle";
      this.arrivalEmotes.delete(playerId);

      // Broadcast movement end with emote (atomic delivery)
      // Note: Rotation is handled by FaceDirectionManager at end of tick
      this.sendFn("tileMovementEnd", {
        id: playerId,
        tile: state.currentTile,
        worldPos: [this._worldPos.x, this._worldPos.y, this._worldPos.z],
        moveSeq: state.moveSeq,
        emote: arrivalEmote,
      });

      // Clear path
      state.path.length = 0; // Zero-allocation clear
      state.pathIndex = 0;

      // RS3-style: Clear movement flag so combat can resume
      entity.data.tileMovementActive = false;

      // Broadcast entity state with arrival emote
      const entityModifiedChanges: Record<string, unknown> = {
        p: [this._worldPos.x, this._worldPos.y, this._worldPos.z],
        v: [0, 0, 0],
        e: arrivalEmote,
      };
      this.sendFn("entityModified", {
        id: playerId,
        changes: entityModifiedChanges,
      });
    }
  }

  /**
   * Continue movement toward a destination after a partial BFS path ended.
   * Called server-side only — skips rate-limiting and input validation because
   * the original move request was already fully validated.
   *
   * If BFS returns an empty path the destination is definitively unreachable
   * and movement stops (no infinite loop).
   */
  private _continuePathToDestination(
    playerId: string,
    destination: TileCoord,
    isRunning: boolean,
  ): void {
    const state = this.playerStates.get(playerId);
    const entity = this.world.entities.get(playerId);
    if (!state || !entity) return;

    // Respect the same guards as handleMoveRequest — don't continue moving if
    // the player died or became frozen mid-path (e.g. duel countdown started)
    const deathState = entity.data?.deathState as DeathState | undefined;
    if (deathState === DeathState.DYING || deathState === DeathState.DEAD) {
      state.requestedDestination = null;
      state.lastPathPartial = false;
      return;
    }

    const duelSystem = this.world.getSystem("duel") as {
      canMove?: (playerId: string) => boolean;
    } | null;
    if (duelSystem?.canMove && !duelSystem.canMove(playerId)) {
      state.requestedDestination = null;
      state.lastPathPartial = false;
      return;
    }

    const buildingService = this.getBuildingCollision();
    const currentFloor = buildingService
      ? buildingService.getPlayerFloor(playerId as EntityID)
      : 0;
    const currentBuildingId = buildingService
      ? buildingService.getBuildingAt(state.currentTile.x, state.currentTile.z)
      : null;

    const path = this.pathfinder.findPath(
      state.currentTile,
      destination,
      (tile, fromTile) =>
        this.isTileWalkable(tile, currentFloor, fromTile, currentBuildingId),
    );

    // Empty path means destination is unreachable — stop here
    if (path.length === 0) return;

    state.path = path;
    state.pathIndex = 0;
    state.isRunning = isRunning;
    state.moveSeq = (state.moveSeq || 0) + 1;
    state.lastPathPartial = this.pathfinder.wasLastPathPartial();

    // If this segment is also partial, keep the destination so onTick
    // will trigger another continuation when this segment ends
    if (state.lastPathPartial) {
      state.requestedDestination = { x: destination.x, z: destination.z };
    }

    entity.data.tileMovementActive = true;

    // Build network path buffer (zero-allocation pattern)
    this._networkPathBuffer.length = path.length;
    for (let i = 0; i < path.length; i++) {
      if (!this._networkPathBuffer[i]) {
        this._networkPathBuffer[i] = { x: 0, z: 0 };
      }
      this._networkPathBuffer[i].x = path[i].x;
      this._networkPathBuffer[i].z = path[i].z;
    }

    this.sendFn("tileMovementStart", {
      id: playerId,
      startTile: { x: state.currentTile.x, z: state.currentTile.z },
      path: this._networkPathBuffer,
      running: isRunning,
      destinationTile: { x: destination.x, z: destination.z },
      moveSeq: state.moveSeq,
      emote: isRunning ? "run" : "walk",
    });
  }

  /**
   * Pre-compute the next path segment and send it to the client 1 tick before
   * the current segment ends, allowing seamless path-appending on the client
   * with no idle frame between segments.
   *
   * Unlike _continuePathToDestination this method does NOT overwrite state.path /
   * state.pathIndex — the player continues walking the current segment unchanged.
   * It does update state.moveSeq, state.lastPathPartial, and
   * state.requestedDestination so the server stays consistent when the current
   * segment does finish on the next tick.
   */
  private _precomputeAndSendNextSegment(
    playerId: string,
    fromTile: TileCoord,
    destination: TileCoord,
    isRunning: boolean,
    state: TileMovementState,
  ): void {
    const entity = this.world.entities.get(playerId);
    if (!entity) return;

    // Apply the same movement guards as handleMoveRequest
    const deathState = entity.data?.deathState as DeathState | undefined;
    if (deathState === DeathState.DYING || deathState === DeathState.DEAD) {
      state.requestedDestination = null;
      state.lastPathPartial = false;
      return;
    }

    const duelSystem = this.world.getSystem("duel") as {
      canMove?: (playerId: string) => boolean;
    } | null;
    if (duelSystem?.canMove && !duelSystem.canMove(playerId)) {
      state.requestedDestination = null;
      state.lastPathPartial = false;
      return;
    }

    const buildingService = this.getBuildingCollision();
    const currentFloor = buildingService
      ? buildingService.getPlayerFloor(playerId as EntityID)
      : 0;
    const currentBuildingId = buildingService
      ? buildingService.getBuildingAt(fromTile.x, fromTile.z)
      : null;

    // BFS from the last tile of the current path (the player hasn't stepped on
    // it yet — keeps the segment boundary invisible to the client)
    const path = this.pathfinder.findPath(
      fromTile,
      destination,
      (tile, prevTile) =>
        this.isTileWalkable(tile, currentFloor, prevTile, currentBuildingId),
    );

    if (path.length === 0) {
      // Destination is unreachable from the path-end tile; let normal end-of-path
      // handling deal with it when the current segment finishes.
      return;
    }

    // Advance moveSeq so the client can validate ordering (stale precomputed
    // packets sent before a re-click are rejected via the existing moveSeq check)
    state.moveSeq = (state.moveSeq || 0) + 1;
    state.lastPathPartial = this.pathfinder.wasLastPathPartial();

    if (state.lastPathPartial) {
      // Another continuation will be needed; keep the ultimate destination alive
      state.requestedDestination = { x: destination.x, z: destination.z };
    } else {
      state.requestedDestination = null;
    }

    // Build network path buffer (zero-allocation pattern)
    this._networkPathBuffer.length = path.length;
    for (let i = 0; i < path.length; i++) {
      if (!this._networkPathBuffer[i]) {
        this._networkPathBuffer[i] = { x: 0, z: 0 };
      }
      this._networkPathBuffer[i].x = path[i].x;
      this._networkPathBuffer[i].z = path[i].z;
    }

    this.sendFn("tileMovementStart", {
      id: playerId,
      startTile: { x: fromTile.x, z: fromTile.z },
      path: this._networkPathBuffer,
      running: isRunning,
      destinationTile: { x: destination.x, z: destination.z },
      moveSeq: state.moveSeq,
      emote: isRunning ? "run" : "walk",
      isContinuation: true,
    });
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
    this.arrivalEmotes.delete(playerId);
    this.tilesTraveledForXP.delete(playerId);
    this.antiCheat.cleanup(playerId);
    this.movementRateLimiter.reset(playerId);
    this.pathfindRateLimiter.reset(playerId);
  }

  /**
   * Reset agility XP progress for a player (called on death)
   * Tiles accumulated toward the next XP grant are lost as a death penalty
   */
  resetAgilityProgress(playerId: string): void {
    this.tilesTraveledForXP.set(playerId, 0);
  }

  /**
   * Set an emote to be used when the player arrives at their destination.
   * This emote is included in the tileMovementEnd packet, ensuring atomic delivery
   * with the arrival notification. Prevents race conditions where the client
   * sets "idle" before receiving a separate emote packet.
   *
   * @param playerId - The player ID
   * @param emote - The emote to use on arrival (e.g., "fishing", "chopping")
   */
  setArrivalEmote(playerId: string, emote: string): void {
    this.arrivalEmotes.set(playerId, emote);
  }

  /**
   * Clear any pending arrival emote for a player.
   * Called when gathering is cancelled or player moves to a different destination.
   */
  clearArrivalEmote(playerId: string): void {
    this.arrivalEmotes.delete(playerId);
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
      state.path.length = 0; // Zero-allocation clear
      state.pathIndex = 0;
      state.moveSeq = (state.moveSeq || 0) + 1; // Increment to invalidate stale client packets

      // Cancel any pending path continuation — the player has teleported/respawned
      // so the original destination is no longer valid
      state.requestedDestination = null;
      state.lastPathPartial = false;
      state.nextSegmentPrecomputed = false;

      // RS3-style: Clear movement flag so combat can resume
      const entity = this.world.entities.get(playerId);
      if (entity?.data) {
        entity.data.tileMovementActive = false;
      }

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
   * Get the previous tile for a player (where they were at START of tick)
   *
   * OSRS-ACCURATE: Used by FollowManager for follow mechanic.
   * Followers path to target's PREVIOUS tile, creating the
   * characteristic 1-tick trailing effect.
   *
   * Edge cases:
   * - If no previous tile (just spawned/teleported): use tile WEST of current
   * - This matches OSRS behavior per private server community research
   *
   * @see https://rune-server.org/threads/help-with-player-dancing-spinning-when-following-each-other.706121/
   */
  getPreviousTile(playerId: string): TileCoord {
    const state = this.playerStates.get(playerId);

    // Use captured previous tile if available
    if (state?.previousTile) {
      return state.previousTile;
    }

    // Fallback: If no previous tile (just spawned/teleported), use tile WEST of current
    // This matches OSRS behavior per private server research
    if (state) {
      return {
        x: state.currentTile.x - 1,
        z: state.currentTile.z,
      };
    }

    // No state at all - try to get from entity position
    const entity = this.world.entities.get(playerId);
    if (entity?.position) {
      const currentTile = worldToTile(entity.position.x, entity.position.z);
      return {
        x: currentTile.x - 1,
        z: currentTile.z,
      };
    }

    // Ultimate fallback (should never happen)
    return { x: 0, z: 0 };
  }

  /**
   * Get the tick-start tile for a player
   *
   * OSRS-ACCURATE: Returns where the player was at the VERY START of the
   * current tick, BEFORE any movement was processed. This is different from
   * previousTile (which is the last tile stepped off during movement).
   *
   * Used by FollowManager to create the authentic 1-tick delay effect:
   * - Tick N: Target is at tile A (tick-start), then moves to tile B
   * - Tick N: Follower sees target's tick-start position (A)
   * - Tick N+1: Follower moves toward A, while target is now at B
   *
   * This creates the characteristic "always one step behind" feel.
   */
  getTickStartTile(playerId: string): TileCoord | null {
    return this.tickStartTiles.get(playerId) ?? null;
  }

  /**
   * Stop a player's current movement immediately.
   * Clears their path and sends tileMovementEnd so the client's TileInterpolator
   * stops interpolating along the old path.
   * Used when starting actions like firemaking that require the player to stand still.
   */
  stopPlayer(playerId: string): void {
    const state = this.playerStates.get(playerId);
    if (!state || state.path.length === 0) return;

    state.path.length = 0;
    state.pathIndex = 0;
    state.moveSeq = (state.moveSeq || 0) + 1;

    const entity = this.world.entities.get(playerId);
    if (entity?.data) {
      entity.data.tileMovementActive = false;
    }

    // Send tileMovementEnd so the client's TileInterpolator stops
    const worldPos = tileToWorld(state.currentTile);
    if (entity?.position) {
      worldPos.y = entity.position.y;
    }

    this.sendFn("tileMovementEnd", {
      id: playerId,
      tile: state.currentTile,
      worldPos: [worldPos.x, worldPos.y, worldPos.z],
      moveSeq: state.moveSeq,
      emote: "idle",
    });
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
   * Check if a player has run mode enabled
   * Used by resource/combat handlers to determine movement speed
   */
  getIsRunning(playerId: string): boolean {
    const state = this.playerStates.get(playerId);
    return state?.isRunning ?? false;
  }

  /**
   * Server-initiated movement toward a target position
   * Used for combat follow when target moves out of range
   *
   * OSRS-style pathfinding (from wiki):
   * - When clicking on an NPC, the requested tiles are all tiles within attack range
   * - BFS finds the CLOSEST valid tile among those options
   * - For melee range 1: only cardinal tiles (N/S/E/W) are valid destinations
   * - For ranged/magic: Chebyshev distance to any tile within range
   * - Pathfinding recalculates every tick until target tile is found
   *
   * @param playerId - The player to move
   * @param targetPosition - Target position in world coordinates
   * @param running - Whether to run (default: true for combat following)
   * @param attackRange - Weapon's attack range (1 = standard melee, 2 = halberd, 10 = ranged/magic, 0 = non-combat)
   * @param attackType - Attack type (MELEE, RANGED, MAGIC) - affects positioning logic
   *
   * @see https://oldschool.runescape.wiki/w/Pathfinding
   */
  movePlayerToward(
    playerId: string,
    targetPosition: { x: number; y: number; z: number },
    running: boolean = true,
    attackRange: number = 0, // 0 = non-combat, 1+ = combat range
    attackType: AttackType = AttackType.MELEE,
  ): void {
    const entity = this.world.entities.get(playerId);
    if (!entity) {
      return;
    }

    // Death lock: Dead players cannot move
    const deathState = entity.data?.deathState;
    if (deathState === DeathState.DYING || deathState === DeathState.DEAD) {
      return;
    }

    const state = this.getOrCreateState(playerId);

    // CRITICAL: Sync state.currentTile with entity's actual position
    // The state might be stale if the player has been moving (zero allocation)
    worldToTileInto(
      entity.position.x,
      entity.position.z,
      this._actualEntityTile,
    );
    if (!tilesEqual(state.currentTile, this._actualEntityTile)) {
      state.currentTile.x = this._actualEntityTile.x;
      state.currentTile.z = this._actualEntityTile.z;
    }

    // Convert target to tile (zero allocation)
    worldToTileInto(targetPosition.x, targetPosition.z, this._targetTile);

    // Determine current floor index for floor-aware pathfinding
    const buildingService = this.getBuildingCollision();
    const currentFloor = buildingService
      ? buildingService.getPlayerFloor(playerId as EntityID)
      : 0;

    const currentBuildingId = buildingService
      ? buildingService.getBuildingAt(state.currentTile.x, state.currentTile.z)
      : null;
    let path: TileCoord[];

    if (attackRange > 0) {
      // COMBAT MOVEMENT: Multi-destination BFS to ANY valid combat tile

      // Check if already in valid position
      const alreadyInRange =
        attackType === AttackType.MELEE
          ? tilesWithinMeleeRange(
              state.currentTile,
              this._targetTile,
              attackRange,
            )
          : tilesWithinRange(state.currentTile, this._targetTile, attackRange);

      if (alreadyInRange) {
        // For ranged/magic: also verify LoS before considering "in position"
        if (
          attackType === AttackType.MELEE ||
          this.tileHasLineOfSight(state.currentTile, this._targetTile)
        ) {
          return; // Already in valid combat position
        }
      }

      // Generate ALL valid destination tiles
      let validTiles: TileCoord[];
      if (attackType === AttackType.RANGED || attackType === AttackType.MAGIC) {
        validTiles = getValidRangedTiles(
          this._targetTile,
          attackRange,
          (tile) =>
            this.isTileWalkable(
              tile,
              currentFloor,
              undefined,
              currentBuildingId,
            ),
          (x, z) =>
            this.world.collision.hasFlags(x, z, CollisionMask.BLOCKS_RANGED),
        );
      } else {
        validTiles = getValidMeleeTiles(this._targetTile, attackRange, (tile) =>
          this.isTileWalkable(tile, currentFloor, undefined, currentBuildingId),
        );
      }

      if (validTiles.length === 0) {
        return; // No valid combat position found
      }

      // Multi-destination BFS: finds shortest path to ANY valid tile
      path = this.pathfinder.findPathToAny(
        state.currentTile,
        validTiles,
        (tile: TileCoord, fromTile?: TileCoord) =>
          this.isTileWalkable(tile, currentFloor, fromTile, currentBuildingId),
      );
    } else {
      // NON-COMBAT MOVEMENT: Go directly to target tile
      if (tilesEqual(this._targetTile, state.currentTile)) {
        return; // Already at target
      }

      // Calculate BFS path to the target tile
      path = this.pathfinder.findPath(
        state.currentTile,
        this._targetTile,
        (tile, fromTile) =>
          this.isTileWalkable(tile, currentFloor, fromTile, currentBuildingId),
      );
    }

    if (path.length === 0) {
      return; // No path found
    }

    // If we're already following the same remaining path at the same speed,
    // keep the existing movement state to avoid moveSeq churn and visual jitter.
    const remainingPathLength = state.path.length - state.pathIndex;
    if (remainingPathLength === path.length && state.isRunning === running) {
      let samePath = true;
      for (let i = 0; i < path.length; i++) {
        const existingTile = state.path[state.pathIndex + i];
        const nextTile = path[i];
        if (
          !existingTile ||
          existingTile.x !== nextTile.x ||
          existingTile.z !== nextTile.z
        ) {
          samePath = false;
          break;
        }
      }
      if (samePath) {
        return;
      }
    }

    // Update state
    state.path = path;
    state.pathIndex = 0;
    state.isRunning = running;
    state.moveSeq = (state.moveSeq || 0) + 1;

    // RS3-style: Set movement flag to suppress combat while moving
    entity.data.tileMovementActive = true;

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

      if (
        (entity as { node?: { quaternion: { copy: (q: unknown) => void } } })
          .node
      ) {
        (
          entity as { node: { quaternion: { copy: (q: unknown) => void } } }
        ).node.quaternion.copy(this._tempQuat);
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

    // Zero-allocation: copy path to pre-allocated network buffer
    this._networkPathBuffer.length = path.length;
    for (let i = 0; i < path.length; i++) {
      if (!this._networkPathBuffer[i]) {
        this._networkPathBuffer[i] = { x: 0, z: 0 };
      }
      this._networkPathBuffer[i].x = path[i].x;
      this._networkPathBuffer[i].z = path[i].z;
    }

    this.sendFn("tileMovementStart", {
      id: playerId,
      startTile: { x: state.currentTile.x, z: state.currentTile.z },
      path: this._networkPathBuffer,
      running: state.isRunning,
      destinationTile: { x: actualDestination.x, z: actualDestination.z },
      moveSeq: state.moveSeq,
      emote: state.isRunning ? "run" : "walk",
    });
  }

  /**
   * Check line of sight between two tiles for ranged/magic combat.
   * Uses BLOCKS_RANGED collision mask (BLOCK_LOS | BLOCKED).
   */
  private tileHasLineOfSight(from: TileCoord, to: TileCoord): boolean {
    return hasLineOfSight(from, to, (x, z) =>
      this.world.collision.hasFlags(x, z, CollisionMask.BLOCKS_RANGED),
    );
  }
}
