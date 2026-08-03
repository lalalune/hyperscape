/**
 * MobMovementManager - Manages tile movement, patrol, pathfinding, and occupancy for MobEntity.
 *
 * Extracted from MobEntity to separate movement/occupancy concerns from AI and combat logic.
 * Handles tile-based movement (rules-accurate), patrol point generation, wander targets,
 * occupancy registration/unregistration, spawn tile search, and distance calculations.
 *
 * **Pattern**: Plain class (not a System subclass).
 * Constructor takes a MobMovementContext interface that bridges back to the entity.
 */

import * as THREE from "../../extras/three/three";
import type { Position3D } from "../../types";
import type { MobEntityConfig } from "../../types/entities";
import { MobAIState } from "../../types/entities";
import type { World } from "../../core/World";
import {
  worldToTile,
  tileToWorld,
  TICK_DURATION_MS,
  tileChebyshevDistance,
  type TileCoord,
} from "../../systems/shared/movement/TileSystem";
import { CollisionMask } from "../../systems/shared/movement/CollisionFlags";
import type { EntityID } from "../../types/core/identifiers";
import { getNPCSize, getOccupiedTiles } from "../npc/LargeNPCSupport";
import { isTerrainSystem } from "../../utils/typeGuards";
import { COMBAT_CONSTANTS } from "../../constants/CombatConstants";
import { EventType } from "../../types/events";

/**
 * Context interface that MobMovementManager uses to interact with MobEntity.
 * Avoids needing direct access to private entity fields.
 */
export interface MobMovementContext {
  /** The world instance for accessing systems, collision, occupancy, etc. */
  world: World;
  /** Mob configuration (mutable - movement updates aiState, health, etc.) */
  config: MobEntityConfig;
  /** Entity ID */
  id: string;
  /** The entity's scene graph node (for reading/writing position) */
  node: THREE.Object3D;
  /** The entity's position vector (THREE.Vector3) */
  position: THREE.Vector3;
  /** Get the current position as Position3D */
  getPosition(): Position3D;
  /** Set the entity position */
  setPosition(x: number, y: number, z: number): void;
  /** Mark entity data as needing network sync */
  markNetworkDirty(): void;
  /** Set health value on the entity */
  setHealth(health: number): void;
  /** Set a property on the entity */
  setProperty(key: string, value: unknown): void;
}

export class MobMovementManager {
  // ─── Patrol state ───────────────────────────────────────────────
  private patrolPoints: Array<{ x: number; z: number }> = [];
  private currentPatrolIndex = 0;

  // ─── Wander / stuck detection state ─────────────────────────────
  private _wanderTarget: { x: number; z: number } | null = null;
  private _lastPosition: THREE.Vector3 = new THREE.Vector3();
  private _lastPositionValid = false;
  private _stuckTimer = 0;
  private readonly STUCK_TIMEOUT = 3000; // Give up after 3 seconds stuck

  // ─── Tile movement throttling ───────────────────────────────────
  /** Prevent emitting duplicate move requests - uses tick-based throttling */
  private _lastRequestedTargetTile: { x: number; z: number } | null = null;
  private _lastMoveRequestTick: number = -1;

  // ─── Pre-allocated buffers for zero-allocation hot path operations ──
  /** Reusable buffer for occupied tiles (max 5x5 = 25 tiles for large bosses) */
  private readonly _occupiedTilesBuffer: TileCoord[] = Array.from(
    { length: 25 },
    () => ({ x: 0, z: 0 }),
  );

  /** Pre-allocated tile for current position */
  private readonly _currentTile: TileCoord = { x: 0, z: 0 };

  /** Cached NPC size (avoid repeated lookups) */
  private _cachedNPCSize: { width: number; depth: number } | null = null;

  /** Track if occupancy is currently registered */
  private _occupancyRegistered = false;

  /** Reusable tile for spawn checking */
  private readonly _spawnCheckTile: TileCoord = { x: 0, z: 0 };

  /** Max spiral search radius for unoccupied spawn tile */
  private readonly MAX_SPAWN_SEARCH_RADIUS = 10;

  // ─── Pre-allocated temps for rotation during moveTowardsTarget ──
  private _terrainWarningLogged = false;
  private _targetQuat = new THREE.Quaternion();
  private _targetAxis = new THREE.Vector3(0, 1, 0);

  /** Track the mob's current spawn location (changes on respawn) */
  private _currentSpawnPoint: Position3D;

  constructor(
    private ctx: MobMovementContext,
    initialSpawnPoint: Position3D,
  ) {
    this._currentSpawnPoint = { ...initialSpawnPoint };
  }

  // ─── Public accessors ───────────────────────────────────────────

  /** Get the mob's current spawn point (changes on respawn) */
  getCurrentSpawnPoint(): Position3D {
    return this._currentSpawnPoint;
  }

  /** Update the spawn point (called on respawn) */
  setCurrentSpawnPoint(point: Position3D): void {
    this._currentSpawnPoint = { ...point };
  }

  /** Get the patrol points array */
  getPatrolPoints(): Array<{ x: number; z: number }> {
    return this.patrolPoints;
  }

  /** Get current patrol index */
  getCurrentPatrolIndex(): number {
    return this.currentPatrolIndex;
  }

  /** Get the wander target */
  getWanderTarget(): { x: number; z: number } | null {
    return this._wanderTarget;
  }

  /** Set the wander target */
  setWanderTarget(target: { x: number; z: number } | null): void {
    this._wanderTarget = target;
  }

  /** Get the last requested target tile (for throttling) */
  getLastRequestedTargetTile(): { x: number; z: number } | null {
    return this._lastRequestedTargetTile;
  }

  /** Get the last move request tick (for throttling) */
  getLastMoveRequestTick(): number {
    return this._lastMoveRequestTick;
  }

  /** Whether occupancy is currently registered */
  isOccupancyRegistered(): boolean {
    return this._occupancyRegistered;
  }

  /** Reset stuck detection state */
  resetStuckState(): void {
    this._stuckTimer = 0;
    this._lastPositionValid = false;
  }

  // ─── Spawn tile search ──────────────────────────────────────────

  /**
   * Find an unoccupied tile for spawning using spiral search
   *
   * classic MMORPG Mechanic: If spawn tile is occupied, search outward in expanding rings
   * until an unoccupied tile is found. Uses Chebyshev distance (8-connected).
   *
   * @param centerX - Center tile X coordinate
   * @param centerZ - Center tile Z coordinate
   * @returns Unoccupied tile coordinates, or null if none found within radius
   */
  findUnoccupiedSpawnTile(centerX: number, centerZ: number): TileCoord | null {
    // Cache NPC size on first call
    if (!this._cachedNPCSize) {
      this._cachedNPCSize = getNPCSize(this.ctx.config.mobType);
    }

    // Check center tile first
    this._spawnCheckTile.x = centerX;
    this._spawnCheckTile.z = centerZ;

    // For multi-tile NPCs, check all tiles they would occupy
    const tileCount = getOccupiedTiles(
      this._spawnCheckTile,
      this._cachedNPCSize,
      this._occupiedTilesBuffer,
    );

    // Check if center is unoccupied (check all tiles for multi-tile NPCs)
    // Must check BOTH entity occupancy AND static collision (resources, stations)
    let centerOccupied = false;
    for (let i = 0; i < tileCount; i++) {
      const tile = this._occupiedTilesBuffer[i];
      // Check for other entities
      if (this.ctx.world.entityOccupancy.isOccupied(tile)) {
        centerOccupied = true;
        break;
      }
      // Check for static collision (trees, rocks, furnaces, etc.)
      if (
        this.ctx.world.collision.hasFlags(
          tile.x,
          tile.z,
          CollisionMask.BLOCKS_WALK,
        )
      ) {
        centerOccupied = true;
        break;
      }
    }
    if (!centerOccupied) {
      return { x: centerX, z: centerZ };
    }

    // Spiral search outward in expanding rings (Chebyshev distance)
    // Ring order: distance 1 (8 tiles), distance 2 (16 tiles), etc.
    for (let dist = 1; dist <= this.MAX_SPAWN_SEARCH_RADIUS; dist++) {
      // Check all tiles at this Chebyshev distance
      for (let dx = -dist; dx <= dist; dx++) {
        for (let dz = -dist; dz <= dist; dz++) {
          // Only check tiles at exactly this distance (ring, not filled square)
          if (Math.max(Math.abs(dx), Math.abs(dz)) !== dist) continue;

          const checkX = centerX + dx;
          const checkZ = centerZ + dz;

          this._spawnCheckTile.x = checkX;
          this._spawnCheckTile.z = checkZ;

          // Get occupied tiles for this candidate position
          const candTileCount = getOccupiedTiles(
            this._spawnCheckTile,
            this._cachedNPCSize,
            this._occupiedTilesBuffer,
          );

          // Check if all tiles are unoccupied
          // Must check BOTH entity occupancy AND static collision (resources, stations)
          let isValid = true;
          for (let i = 0; i < candTileCount; i++) {
            const tile = this._occupiedTilesBuffer[i];
            // Check for other entities
            if (this.ctx.world.entityOccupancy.isOccupied(tile)) {
              isValid = false;
              break;
            }
            // Check for static collision (trees, rocks, furnaces, etc.)
            if (
              this.ctx.world.collision.hasFlags(
                tile.x,
                tile.z,
                CollisionMask.BLOCKS_WALK,
              )
            ) {
              isValid = false;
              break;
            }
          }

          if (isValid) {
            return { x: checkX, z: checkZ };
          }
        }
      }
    }

    // No unoccupied tile found within radius - shouldn't happen in normal gameplay
    console.warn(
      `[MobMovementManager] No unoccupied spawn tile found within ${this.MAX_SPAWN_SEARCH_RADIUS} tiles for ${this.ctx.config.name}`,
    );
    return null;
  }

  // ─── Occupancy registration ─────────────────────────────────────

  /**
   * Register this mob's tile occupancy in EntityOccupancyMap
   *
   * Called after spawn/respawn to set collision flags on tiles this mob occupies.
   * Uses pre-allocated buffers to avoid hot path allocations.
   *
   * classic MMORPG Mechanic: Flags set when entity spawns/moves TO a tile
   * If spawn tile is occupied, finds nearby unoccupied tile first.
   */
  registerOccupancy(): void {
    // Server-only: occupancy tracking is authoritative
    if (!this.ctx.world.isServer) return;

    // Cache NPC size on first call (avoids repeated lookups)
    if (!this._cachedNPCSize) {
      this._cachedNPCSize = getNPCSize(this.ctx.config.mobType);
    }

    // Get current world position and convert to tile
    const pos = this.ctx.getPosition();
    this._currentTile.x = Math.floor(pos.x);
    this._currentTile.z = Math.floor(pos.z);

    // Check if spawn tile is already occupied by another mob
    // If so, find an unoccupied tile nearby (rules-accurate: NPCs don't stack)
    const unoccupiedTile = this.findUnoccupiedSpawnTile(
      this._currentTile.x,
      this._currentTile.z,
    );

    if (
      unoccupiedTile &&
      (unoccupiedTile.x !== this._currentTile.x ||
        unoccupiedTile.z !== this._currentTile.z)
    ) {
      // Relocate mob to unoccupied tile
      const worldPos = tileToWorld(unoccupiedTile);
      this.ctx.position.x = worldPos.x;
      this.ctx.position.z = worldPos.z;
      // Update current tile to the new position
      this._currentTile.x = unoccupiedTile.x;
      this._currentTile.z = unoccupiedTile.z;
    }

    // Fill occupied tiles buffer (zero-allocation using pre-allocated buffer)
    const tileCount = getOccupiedTiles(
      this._currentTile,
      this._cachedNPCSize,
      this._occupiedTilesBuffer,
    );

    // Check if this mob should ignore collision (bosses, special NPCs)
    const ignoresCollision = this.ctx.config.ignoresEntityCollision === true;

    // Register with EntityOccupancyMap
    this.ctx.world.entityOccupancy.occupy(
      this.ctx.id as EntityID,
      this._occupiedTilesBuffer,
      tileCount,
      "mob",
      ignoresCollision,
    );

    this._occupancyRegistered = true;
  }

  /**
   * Remove this mob's tile occupancy from EntityOccupancyMap
   *
   * Called when mob dies or despawns to clear collision flags.
   *
   * classic MMORPG Mechanic: Flags removed when entity despawns/dies
   */
  unregisterOccupancy(): void {
    // Server-only: occupancy tracking is authoritative
    if (!this.ctx.world.isServer) return;

    if (!this._occupancyRegistered) return;

    this.ctx.world.entityOccupancy.vacate(this.ctx.id as EntityID);
    this._occupancyRegistered = false;
  }

  /**
   * Update this mob's tile occupancy after movement
   *
   * Called after successful movement to update collision flags.
   * Uses atomic move() to avoid race conditions.
   *
   * classic MMORPG Mechanic: Flags removed from old tiles, added to new tiles (in order)
   * Called by MobTileMovementManager after successful movement.
   */
  updateOccupancy(): void {
    // Server-only: occupancy tracking is authoritative
    if (!this.ctx.world.isServer) return;

    if (!this._occupancyRegistered) {
      // If not registered, register instead of update
      this.registerOccupancy();
      return;
    }

    // Cache NPC size on first call
    if (!this._cachedNPCSize) {
      this._cachedNPCSize = getNPCSize(this.ctx.config.mobType);
    }

    // Get current world position and convert to tile
    const pos = this.ctx.getPosition();
    this._currentTile.x = Math.floor(pos.x);
    this._currentTile.z = Math.floor(pos.z);

    // Fill occupied tiles buffer
    const tileCount = getOccupiedTiles(
      this._currentTile,
      this._cachedNPCSize,
      this._occupiedTilesBuffer,
    );

    // Atomic move (removes old, adds new)
    this.ctx.world.entityOccupancy.move(
      this.ctx.id as EntityID,
      this._occupiedTilesBuffer,
      tileCount,
    );
  }

  // ─── Patrol point generation ────────────────────────────────────

  /**
   * Generate patrol points around the current spawn point
   * Creates 4 evenly-spaced points in a circle
   */
  generatePatrolPoints(): void {
    // Use CURRENT spawn point (changes on respawn), not fixed config.spawnPoint
    const spawnPos = this._currentSpawnPoint;
    const patrolRadius = 5; // 5 meter patrol radius

    for (let i = 0; i < 4; i++) {
      const angle = (i / 4) * Math.PI * 2;
      const x = spawnPos.x + Math.cos(angle) * patrolRadius;
      const z = spawnPos.z + Math.sin(angle) * patrolRadius;
      this.patrolPoints.push({ x, z });
    }
  }

  /**
   * Clear and regenerate patrol points (called on respawn)
   */
  regeneratePatrolPoints(): void {
    this.patrolPoints = [];
    this.generatePatrolPoints();
  }

  // ─── Wander target generation ───────────────────────────────────

  /**
   * Generate a random wander target within wander radius (rules-accurate)
   *
   * classic MMORPG generates wander targets relative to SPAWN, not current position.
   * This ensures NPCs naturally drift back toward spawn over time,
   * even after being leashed far from their spawn point.
   *
   * Uses CURRENT spawn point (changes on respawn), not fixed config.spawnPoint
   */
  generateWanderTarget(): Position3D {
    const spawn = this._currentSpawnPoint;
    const radius = this.ctx.config.wanderRadius;

    // rules-accurate: Random tile within [-radius, +radius] of spawn
    // This creates a square wander area centered on spawn
    const range = 2 * radius + 1;
    const offsetX = Math.floor(Math.random() * range) - radius;
    const offsetZ = Math.floor(Math.random() * range) - radius;

    return {
      x: spawn.x + offsetX,
      y: this.ctx.getPosition().y,
      z: spawn.z + offsetZ,
    };
  }

  // ─── Movement ───────────────────────────────────────────────────

  /**
   * Move towards a target position (continuous, non-tile-based)
   * Used for legacy movement code path (server-side smooth movement)
   */
  moveTowardsTarget(targetPos: Position3D, deltaTime: number): void {
    const currentPos = this.ctx.getPosition();
    const direction = {
      x: targetPos.x - currentPos.x,
      y: 0,
      z: targetPos.z - currentPos.z,
    };

    const length = Math.sqrt(
      direction.x * direction.x + direction.z * direction.z,
    );
    if (length > 0) {
      direction.x /= length;
      direction.z /= length;

      const moveDistance = this.ctx.config.moveSpeed * deltaTime;
      const newPos = {
        x: currentPos.x + direction.x * moveDistance,
        y: currentPos.y,
        z: currentPos.z + direction.z * moveDistance,
      };

      // Snap to terrain height (only if terrain system is ready)
      const terrain = this.ctx.world.getSystem("terrain");
      if (terrain && "getHeightAt" in terrain) {
        try {
          // CRITICAL: Must call method on terrain object to preserve 'this' context
          const terrainHeight = (
            terrain as { getHeightAt: (x: number, z: number) => number }
          ).getHeightAt(newPos.x, newPos.z);
          if (Number.isFinite(terrainHeight)) {
            newPos.y = terrainHeight;
          } else if (!this._terrainWarningLogged) {
            console.warn(
              `[MobMovementManager] Server terrain height not finite at (${newPos.x.toFixed(1)}, ${newPos.z.toFixed(1)})`,
            );
            this._terrainWarningLogged = true;
          }
        } catch (err) {
          if (!this._terrainWarningLogged) {
            console.warn(
              `[MobMovementManager] Server terrain getHeightAt failed:`,
              err,
            );
            this._terrainWarningLogged = true;
          }
        }
      } else if (!this._terrainWarningLogged) {
        console.warn(`[MobMovementManager] Server has no terrain system`);
        this._terrainWarningLogged = true;
      }

      // Calculate rotation to face movement direction using pre-allocated temps
      // VRM 1.0+ models are rotated 180 deg by the factory (see createVRMFactory.ts:264)
      // so we need to add PI to compensate and face the correct direction
      const angle = Math.atan2(direction.x, direction.z) + Math.PI;
      this._targetQuat.setFromAxisAngle(this._targetAxis, angle);

      // Smoothly rotate towards target direction (frame-rate independent exponential decay)
      const rotationAlpha =
        1 -
        Math.exp(-deltaTime * COMBAT_CONSTANTS.ROTATION.MOVEMENT_SLERP_SPEED);
      this.ctx.node.quaternion.slerp(this._targetQuat, rotationAlpha);

      // Stuck detection: Only check when actively moving (classic fantasy MMORPG-style: give up if stuck)
      // This prevents false positives during IDLE and ATTACK states
      const isMovingState =
        this.ctx.config.aiState === MobAIState.WANDER ||
        this.ctx.config.aiState === MobAIState.CHASE ||
        this.ctx.config.aiState === MobAIState.RETURN;

      if (isMovingState) {
        if (this._lastPositionValid) {
          const moved = this.ctx.position.distanceTo(this._lastPosition);
          if (moved < 0.01) {
            // Barely moved - increment stuck timer
            this._stuckTimer += deltaTime;
            if (this._stuckTimer > this.STUCK_TIMEOUT) {
              // Stuck for too long - give up and return home (production safety)
              console.warn(
                `[MobMovementManager] ${this.ctx.config.mobType} stuck for ${(this.STUCK_TIMEOUT / 1000).toFixed(1)}s at (${currentPos.x.toFixed(1)}, ${currentPos.z.toFixed(1)}), returning to spawn`,
              );
              this.ctx.config.aiState = MobAIState.RETURN;
              this.ctx.config.targetPlayerId = null;
              this._wanderTarget = null;
              this._stuckTimer = 0;
              this._lastPositionValid = false;
              this.ctx.markNetworkDirty();
              return;
            }
          } else {
            // Moving normally - reset stuck timer
            this._stuckTimer = 0;
          }
        }
        this._lastPosition.copy(this.ctx.position);
        this._lastPositionValid = true;
      }

      // Update position (will be synced to clients via network)
      this.ctx.setPosition(newPos.x, newPos.y, newPos.z);
      this.ctx.markNetworkDirty();
    }
  }

  /**
   * Emit a tile movement request (rules-accurate tick-based movement)
   * Called by AI state machine's moveTowards callback.
   * Server's MobTileMovementManager will handle the actual movement on ticks.
   *
   * @param target - Target position to move towards
   */
  emitTileMoveRequest(target: Position3D): void {
    const currentPos = this.ctx.getPosition();
    const currentTile = worldToTile(currentPos.x, currentPos.z);
    const targetTile = worldToTile(target.x, target.z);

    // CRITICAL: Skip if already at target tile (defense-in-depth)
    if (currentTile.x === targetTile.x && currentTile.z === targetTile.z) {
      return; // Already at destination tile - nothing to do
    }

    // TICK-BASED THROTTLING: Only emit one move request per tick per target
    const currentTick = this.ctx.world.currentTick;
    const targetTileChanged =
      !this._lastRequestedTargetTile ||
      this._lastRequestedTargetTile.x !== targetTile.x ||
      this._lastRequestedTargetTile.z !== targetTile.z;

    if (!targetTileChanged && currentTick === this._lastMoveRequestTick) {
      return; // Same tick, same target - already requested this movement
    }

    // Update tracking
    this._lastRequestedTargetTile = { x: targetTile.x, z: targetTile.z };
    this._lastMoveRequestTick = currentTick;

    this.ctx.world.emit(EventType.MOB_NPC_MOVE_REQUEST, {
      mobId: this.ctx.id,
      targetPos: target,
      // If chasing a player, include targetEntityId for dynamic repathing
      targetEntityId: this.ctx.config.targetPlayerId || undefined,
      tilesPerTick: Math.max(
        1,
        Math.round((this.ctx.config.moveSpeed * TICK_DURATION_MS) / 1000),
      ),
    });
  }

  // ─── Distance calculations ──────────────────────────────────────

  /**
   * Calculate 2D horizontal distance (XZ plane only, ignoring Y)
   * @deprecated Use getSpawnDistanceTiles() for leash/spawn checks - classic MMORPG uses Chebyshev distance
   */
  getDistance2D(point: Position3D): number {
    const pos = this.ctx.getPosition();
    const dx = pos.x - point.x;
    const dz = pos.z - point.z;
    return Math.sqrt(dx * dx + dz * dz);
  }

  /**
   * Calculate tile-based Chebyshev distance from spawn point (rules-accurate)
   *
   * classic MMORPG uses Chebyshev distance (max of dx, dz) for tile-based checks.
   * This is critical for diagonal positions:
   * - Euclidean: (6,6) from (0,0) = 8.49 tiles (WRONG)
   * - Chebyshev: (6,6) from (0,0) = 6 tiles (CORRECT)
   */
  getSpawnDistanceTiles(): number {
    const pos = this.ctx.getPosition();
    const spawn = this._currentSpawnPoint;
    const currentTile = worldToTile(pos.x, pos.z);
    const spawnTile = worldToTile(spawn.x, spawn.z);
    return tileChebyshevDistance(currentTile, spawnTile);
  }

  /**
   * Get the mob's leash range (max tiles from spawn during chase)
   * rules-accurate default: 7 tiles max range from spawn
   */
  getLeashRange(): number {
    return (
      this.ctx.config.leashRange ?? COMBAT_CONSTANTS.DEFAULTS.NPC.LEASH_RANGE
    );
  }
}
