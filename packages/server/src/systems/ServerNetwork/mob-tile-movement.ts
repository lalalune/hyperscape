/**
 * Mob Tile Movement Manager
 *
 * RuneScape-style tile-based movement system for mobs.
 * Mobs move discretely from tile to tile on server ticks (600ms).
 *
 * Key behaviors:
 * - Movement happens on ticks, not frames
 * - Mobs move 1-2 tiles per tick (based on mob speed)
 * - Uses greedy/direct pathfinding (chaseStep), NOT BFS
 * - Mobs walk directly toward target, getting stuck behind obstacles
 * - This enables "safespotting" gameplay (authentic OSRS behavior)
 * - Client interpolates visually between tile positions
 *
 * OSRS Reference:
 * - Mobs use "dumb" pathfinding - they don't navigate around obstacles
 * - This is why safespotting works in OSRS
 * - @see https://oldschool.runescape.wiki/w/Pathfinding
 */

import {
  THREE,
  TerrainSystem,
  World,
  TILES_PER_TICK_WALK,
  worldToTile,
  tileToWorld,
  tilesEqual,
  tilesWithinMeleeRange,
  chaseStep,
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
  /** Target entity ID (for CHASE state - uses dumb pathfinder every tick) */
  targetEntityId: string | null;
  /** Last known target position (to detect when target moved) */
  lastTargetTile: TileCoord | null;
  /** Movement speed in tiles per tick (default: 2 for walk) */
  tilesPerTick: number;
  /** Whether mob is currently chasing/moving to a destination */
  hasDestination: boolean;
  /** Whether mob is actively chasing a moving target (uses dumb pathfinder) */
  isChasing: boolean;
  /** Combat range in tiles (from manifest combatRange, default 1 for melee) */
  combatRange: number;
}

/**
 * Create initial mob tile state
 */
function createMobTileState(
  currentTile: TileCoord,
  tilesPerTick = TILES_PER_TICK_WALK,
  combatRange = 1,
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
    isChasing: false,
    combatRange,
  };
}

/**
 * Tile-based movement manager for mobs (RuneScape-style)
 *
 * IMPORTANT: Mobs use greedy/direct pathfinding (chaseStep), NOT BFS.
 * This is authentic OSRS behavior - mobs walk directly toward their target
 * and get stuck behind obstacles (enabling safespotting gameplay).
 */
export class MobTileMovementManager {
  private mobStates: Map<string, MobTileState> = new Map();
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
  ) {}

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
   * IMPORTANT: Mobs use greedy/direct pathfinding (chaseStep), NOT BFS.
   * This is authentic OSRS behavior - mobs walk directly toward their target
   * and get stuck behind obstacles (enabling safespotting gameplay).
   *
   * @param mobId - The mob's entity ID
   * @param targetPos - Target world position
   * @param targetEntityId - Optional entity ID being chased (for dynamic repathing)
   * @param tilesPerTick - Movement speed (default: walk speed)
   * @param combatRange - Combat range in tiles (default: 1 for melee)
   */
  requestMoveTo(
    mobId: string,
    targetPos: Position3D,
    targetEntityId: string | null = null,
    tilesPerTick: number = TILES_PER_TICK_WALK,
    combatRange: number = 1,
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
        `[MobTileMovement] requestMoveTo: ${mobId} from tile (${state.currentTile.x},${state.currentTile.z}) to tile (${targetTile.x},${targetTile.z})`,
      );

    // Store combat range for this mob
    state.combatRange = combatRange;

    // If already at destination, nothing to do (but still update chase state)
    if (tilesEqual(state.currentTile, targetTile)) {
      if (this.DEBUG_MODE)
        console.log(`[MobTileMovement] requestMoveTo: Already at destination`);
      // Still update chase state so combat system knows who we're targeting
      state.targetEntityId = targetEntityId;
      state.isChasing = !!targetEntityId;
      state.hasDestination = false;
      state.path = [];
      state.pathIndex = 0;
      return;
    }

    // If chasing an entity and already within combat range - stop moving
    // (Only for combat - when returning to spawn, we want the exact tile)
    // OSRS-accurate: Range 1 = cardinal only (N/S/E/W), range 2+ = diagonal allowed
    if (
      targetEntityId !== null &&
      tilesWithinMeleeRange(state.currentTile, targetTile, combatRange)
    ) {
      if (this.DEBUG_MODE)
        console.log(
          `[MobTileMovement] requestMoveTo: Already in combat range (${combatRange}) of target entity`,
        );
      // Update chase state so combat system knows who we're targeting
      state.targetEntityId = targetEntityId;
      state.isChasing = true;
      state.hasDestination = false;
      state.path = [];
      state.pathIndex = 0;
      return;
    }

    // If already chasing this same entity, let onTick handle continued movement
    if (
      state.isChasing &&
      state.targetEntityId === targetEntityId &&
      targetEntityId !== null
    ) {
      if (this.DEBUG_MODE)
        console.log(
          `[MobTileMovement] requestMoveTo: Already chasing ${targetEntityId}, onTick handles`,
        );
      state.tilesPerTick = tilesPerTick;
      return;
    }

    // Set up chase state - onTick will use chaseStep for actual movement
    state.targetEntityId = targetEntityId;
    state.lastTargetTile = { ...targetTile };
    state.tilesPerTick = tilesPerTick;
    state.isChasing = !!targetEntityId;
    state.hasDestination = true;
    state.moveSeq = (state.moveSeq || 0) + 1;

    // Calculate initial chase path using chaseStep (NOT BFS!)
    const chasePath: TileCoord[] = [];
    let currentPos = { ...state.currentTile };

    for (let step = 0; step < tilesPerTick; step++) {
      const nextTile = chaseStep(currentPos, targetTile, (tile) =>
        this.isTileWalkable(tile),
      );

      if (!nextTile) break; // Blocked

      chasePath.push(nextTile);
      currentPos = nextTile;

      // Stop if we'll be in combat range after this step (OSRS melee rules)
      if (tilesWithinMeleeRange(nextTile, targetTile, combatRange)) break;
    }

    if (chasePath.length === 0) {
      // Completely blocked from the start
      if (this.DEBUG_MODE)
        console.log(`[MobTileMovement] requestMoveTo: Blocked, can't move`);
      state.hasDestination = false;
      return;
    }

    state.path = chasePath;
    state.pathIndex = 0;

    if (this.DEBUG_MODE)
      console.log(
        `[MobTileMovement] requestMoveTo: Chase path ${chasePath.length} steps`,
      );

    // Rotate mob toward first tile
    const nextTile = chasePath[0];
    const nextWorld = tileToWorld(nextTile);
    const curr = entity.position;
    const dx = nextWorld.x - curr.x;
    const dz = nextWorld.z - curr.z;

    if (Math.abs(dx) + Math.abs(dz) > 0.01) {
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
    // Server sends COMPLETE authoritative path - client follows exactly, no recalculation
    // startTile: where server knows mob IS
    // OSRS-style: Bundle emote with movement packet to prevent animation mismatch
    this.sendFn("tileMovementStart", {
      id: mobId,
      startTile: { x: state.currentTile.x, z: state.currentTile.z },
      path: chasePath.map((t) => ({ x: t.x, z: t.z })),
      running: state.isRunning,
      destinationTile: { x: targetTile.x, z: targetTile.z },
      moveSeq: state.moveSeq,
      isMob: true,
      emote: state.isRunning ? "run" : "walk",
      tilesPerTick: state.tilesPerTick, // Mob-specific speed for client interpolation
    });
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
    state.isChasing = false;

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

      // OSRS-STYLE DUMB PATHFINDER FOR CHASE MODE
      // Instead of expensive BFS repathing every tick, NPCs use a simple algorithm:
      // 1. Try diagonal step toward target
      // 2. Try cardinal steps (prioritize axis with greater distance)
      // 3. If all blocked = NPC is "stuck" (safespotting!)
      //
      // This is O(1) per step, so no throttling is needed.
      // @see https://oldschool.runescape.wiki/w/Pathfinding
      if (state.isChasing && state.targetEntityId) {
        // CRITICAL: Players are NOT in world.entities - they're accessed via world.getPlayer()
        // Mobs are in world.entities, but when chasing we're always targeting players
        const targetPlayer = this.world.getPlayer?.(state.targetEntityId);
        const targetEntity =
          targetPlayer || this.world.entities.get(state.targetEntityId);
        if (targetEntity) {
          const currentTargetTile = worldToTile(
            targetEntity.position.x,
            targetEntity.position.z,
          );

          // OSRS COMBAT POSITIONING: Check if we're already in combat range
          // If so, we're in attack range - no need to move closer!
          // OSRS-accurate: Range 1 = cardinal only (N/S/E/W), range 2+ = diagonal allowed
          const combatRange = state.combatRange || 1;
          if (
            tilesWithinMeleeRange(
              state.currentTile,
              currentTargetTile,
              combatRange,
            )
          ) {
            // Already in combat range - stop moving and clear path
            if (state.path.length > 0 || state.hasDestination) {
              if (this.DEBUG_MODE)
                console.log(
                  `[MobTileMovement] Already in combat range (${combatRange}) of target at (${currentTargetTile.x},${currentTargetTile.z}), stopping`,
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
            continue; // Skip movement processing - we're in attack range
          }

          // NOT in combat range - use chase pathfinder to calculate steps toward target
          // Calculate up to tilesPerTick steps (O(1) per step, unlike BFS which is O(tiles²))
          const chasePath: TileCoord[] = [];
          let currentPos = { ...state.currentTile };

          for (let step = 0; step < state.tilesPerTick; step++) {
            // Check if this step would put us in combat range
            const nextTile = chaseStep(currentPos, currentTargetTile, (tile) =>
              this.isTileWalkable(tile),
            );

            if (!nextTile) {
              // Blocked - stop here (safespotting!)
              break;
            }

            chasePath.push(nextTile);
            currentPos = nextTile;

            // Stop early if we'll be in combat range after this step (OSRS melee rules)
            if (
              tilesWithinMeleeRange(nextTile, currentTargetTile, combatRange)
            ) {
              break;
            }
          }

          if (chasePath.length > 0) {
            state.path = chasePath;
            state.pathIndex = 0;
            state.hasDestination = true;
            state.lastTargetTile = { ...currentTargetTile };

            // CRITICAL: Increment moveSeq and send tileMovementStart with new path
            // Without this, the client only receives entityTileUpdate (sync packets)
            // and has no path to interpolate through, causing teleporting
            state.moveSeq = (state.moveSeq || 0) + 1;
            this.sendFn("tileMovementStart", {
              id: mobId,
              startTile: { x: state.currentTile.x, z: state.currentTile.z },
              path: chasePath.map((t) => ({ x: t.x, z: t.z })),
              running: state.isRunning,
              destinationTile: {
                x: chasePath[chasePath.length - 1].x,
                z: chasePath[chasePath.length - 1].z,
              },
              moveSeq: state.moveSeq,
              isMob: true,
              emote: state.isRunning ? "run" : "walk",
              tilesPerTick: state.tilesPerTick, // Mob-specific speed for client interpolation
            });

            if (this.DEBUG_MODE)
              console.log(
                `[MobTileMovement] Chase: ${chasePath.length} steps toward target (${currentTargetTile.x},${currentTargetTile.z})`,
              );
          } else {
            // All directions blocked - NPC is stuck (safespotted!)
            // This is intentional behavior - NPCs don't search around obstacles
            if (this.DEBUG_MODE)
              console.log(
                `[MobTileMovement] NPC stuck (safespotted?) - all paths to target blocked`,
              );
            state.path = [];
            state.pathIndex = 0;
            state.hasDestination = false;
            continue; // Skip movement - we're blocked
          }
        } else {
          // Target entity no longer exists - stop chasing
          state.isChasing = false;
          state.targetEntityId = null;
          state.lastTargetTile = null;
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
        // CRITICAL: Players are NOT in world.entities - they're accessed via world.getPlayer()
        const targetPlayer = this.world.getPlayer?.(state.targetEntityId);
        const targetEntity =
          targetPlayer || this.world.entities.get(state.targetEntityId);
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

        // ONLY broadcast idle state if NOT chasing a target
        // When chasing (in combat), the AI state machine and CombatSystem
        // control the animation - they will set combat/idle appropriately.
        // Sending "idle" here would override the combat animation!
        if (!state.isChasing) {
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
