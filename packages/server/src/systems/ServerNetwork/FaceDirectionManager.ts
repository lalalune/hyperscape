/**
 * FaceDirectionManager - OSRS-Accurate Face Direction System
 *
 * Implements the OSRS face direction mask behavior:
 * 1. When player interacts with object/NPC, faceTarget is SET (not applied)
 * 2. At END of each tick, if player did NOT move, rotation is applied
 * 3. If player moved, rotation is skipped but faceTarget PERSISTS
 * 4. Player will face the target when they eventually stop moving
 *
 * This creates the authentic OSRS behavior where clicking a tree then
 * walking away will still cause you to face the tree once you stop.
 *
 * @see https://osrs-docs.com/docs/packets/outgoing/updating/masks/face-direction/
 */

import type { World } from "@hyperforge/shared";
import {
  quaternionPool,
  worldToTile,
  getCardinalFaceDirection,
  getCardinalFaceAngle,
  type TileCoord,
  type CardinalDirection,
} from "@hyperforge/shared";
import { DEBUG_FACE_DIRECTION } from "./debug";

/**
 * Entity interface for face direction operations
 */
interface FaceableEntity {
  id: string;
  position?: { x: number; y: number; z: number };
  faceTarget?: { x: number; z: number };
  // Cardinal-only face direction (for resources) - deterministic
  cardinalFaceDirection?: CardinalDirection;
  movedThisTick?: boolean;
  // Server-side rotation storage (plain object)
  rotation?: {
    x: number;
    y: number;
    z: number;
    w: number;
  };
  // Client-side transforms (THREE.js objects)
  base?: {
    quaternion?: {
      set(x: number, y: number, z: number, w: number): void;
    };
  };
  node?: {
    quaternion?: {
      set(x: number, y: number, z: number, w: number): void;
      copy(source: { x: number; y: number; z: number; w: number }): void;
    };
  };
  markNetworkDirty?: () => void;
}

/**
 * OSRS 8-direction constants
 * Players/NPCs can only face these 8 directions
 */
const DIRECTION_COUNT = 8;
const DIRECTION_STEP = (Math.PI * 2) / DIRECTION_COUNT; // 45 degrees = PI/4

/**
 * FaceDirectionManager handles OSRS-accurate deferred face direction
 */
export class FaceDirectionManager {
  private world: World;
  private sendFn: ((name: string, data: unknown) => void) | null = null;

  constructor(world: World) {
    this.world = world;
  }

  /**
   * Set the send function for broadcasting rotation changes.
   * This must be called before processFaceDirection can broadcast.
   */
  setSendFunction(sendFn: (name: string, data: unknown) => void): void {
    this.sendFn = sendFn;
  }

  /**
   * Set a face target for a player
   * Called when player interacts with objects, NPCs, resources, etc.
   *
   * OSRS: The target is stored but NOT applied until end of tick
   *
   * @param playerId - Player to set face target for
   * @param targetX - X coordinate to face
   * @param targetZ - Z coordinate to face
   */
  setFaceTarget(playerId: string, targetX: number, targetZ: number): void {
    const player = this.world.getPlayer?.(playerId) as FaceableEntity | null;
    if (!player) {
      console.warn(
        `[FaceDirection] setFaceTarget: Player ${playerId} not found!`,
      );
      return;
    }

    // Set the face target - will be processed at end of tick
    player.faceTarget = { x: targetX, z: targetZ };

    // Reset movedThisTick so if player is stationary, rotation applies this tick
    // This is important when gathering starts - the player has stopped moving
    player.movedThisTick = false;

    if (DEBUG_FACE_DIRECTION) {
      console.log(
        `[FaceDirection] 🎯 Set face target for ${playerId}: target=(${targetX.toFixed(1)}, ${targetZ.toFixed(1)}), ` +
          `player=(${player.position?.x.toFixed(1) ?? "?"}, ${player.position?.z.toFixed(1) ?? "?"}), ` +
          `movedThisTick=${player.movedThisTick}`,
      );
    }
  }

  /**
   * Set a CARDINAL face direction for a player interacting with a resource.
   * Uses deterministic cardinal-only positioning for AAA quality.
   *
   * CARDINAL-ONLY: Player standing N of resource faces S, E faces W, etc.
   * This is deterministic and provides consistent, reliable face direction.
   *
   * @param playerId - Player to set face direction for
   * @param anchorTile - SW corner tile of the resource
   * @param footprintX - Width of the resource in tiles
   * @param footprintZ - Depth of the resource in tiles
   */
  setCardinalFaceTarget(
    playerId: string,
    anchorTile: TileCoord,
    footprintX: number,
    footprintZ: number,
  ): void {
    const player = this.world.getPlayer?.(playerId) as FaceableEntity | null;
    if (!player) {
      console.warn(
        `[FaceDirection] setCardinalFaceTarget: Player ${playerId} not found!`,
      );
      return;
    }

    if (!player.position) {
      console.warn(
        `[FaceDirection] setCardinalFaceTarget: Player ${playerId} has no position!`,
      );
      return;
    }

    // Get player's tile position
    const playerTile = worldToTile(player.position.x, player.position.z);

    // Determine cardinal direction based on player position relative to resource
    const direction = getCardinalFaceDirection(
      playerTile,
      anchorTile,
      footprintX,
      footprintZ,
    );

    if (DEBUG_FACE_DIRECTION) {
      console.log(
        `[FaceDirection] getCardinalFaceDirection result: direction=${direction || "null"}, ` +
          `playerTile=(${playerTile.x}, ${playerTile.z}), anchorTile=(${anchorTile.x}, ${anchorTile.z}), ` +
          `footprint=${footprintX}x${footprintZ}`,
      );
    }

    if (!direction) {
      // Player is not on a cardinal tile - fall back to target-based facing
      if (DEBUG_FACE_DIRECTION) {
        console.warn(
          `[FaceDirection] Player ${playerId} not on cardinal tile relative to resource at (${anchorTile.x}, ${anchorTile.z}). ` +
            `Player tile: (${playerTile.x}, ${playerTile.z}). Falling back to center-based facing.`,
        );
      }
      // Calculate resource center in world coordinates
      // For 1×1 at anchor (15,-10): center = (15.5, -9.5)
      // For 2×2 at anchor (15,-10): center = (16, -9)
      const centerX = (anchorTile.x + footprintX / 2) * 1.0; // TILE_SIZE = 1.0
      const centerZ = (anchorTile.z + footprintZ / 2) * 1.0;
      this.setFaceTarget(playerId, centerX, centerZ);
      return;
    }

    // Set cardinal direction - will be processed at end of tick
    player.cardinalFaceDirection = direction;
    player.faceTarget = undefined; // Clear any point-based target

    // Reset movedThisTick so rotation applies this tick
    player.movedThisTick = false;

    if (DEBUG_FACE_DIRECTION) {
      console.log(
        `[FaceDirection] 🧭 Set CARDINAL face direction for ${playerId}: ${direction} ` +
          `(player tile=${playerTile.x},${playerTile.z}, anchor=${anchorTile.x},${anchorTile.z}, ` +
          `footprint=${footprintX}x${footprintZ})`,
      );
    }
  }

  /**
   * Clear face target for a player
   * Called in rare cases where we explicitly want to cancel facing
   *
   * @param playerId - Player to clear face target for
   */
  clearFaceTarget(playerId: string): void {
    const player = this.world.getPlayer?.(playerId) as FaceableEntity | null;
    if (!player) return;

    player.faceTarget = undefined;
    player.cardinalFaceDirection = undefined;
  }

  /**
   * Mark a player as having moved this tick
   * Called by TileMovementManager when player moves
   *
   * OSRS: If entity moved, face direction is NOT applied this tick
   *
   * @param playerId - Player who moved
   */
  markPlayerMoved(playerId: string): void {
    const player = this.world.getPlayer?.(playerId) as FaceableEntity | null;
    if (!player) return;

    player.movedThisTick = true;
  }

  /**
   * Reset movement flags for all players
   * Called at START of each tick by GameTickProcessor
   */
  resetMovementFlags(): void {
    // Get all players from the entities system
    // Note: Players are stored in entities.players, not entities.items
    const entitiesSystem = this.world.entities as {
      players?: Map<string, unknown>;
    } | null;

    if (!entitiesSystem?.players) return;

    for (const [, player] of entitiesSystem.players) {
      const faceable = player as FaceableEntity;
      if (faceable.movedThisTick !== undefined) {
        faceable.movedThisTick = false;
      }
    }
  }

  /**
   * Process face direction for all players
   * Called at END of tick by GameTickProcessor, AFTER all movement
   *
   * OSRS behavior:
   * - Only applies rotation if player has faceTarget AND did NOT move
   * - faceTarget persists even if not applied (player will face when they stop)
   * - Rotation snapped to 8 directions (N, NE, E, SE, S, SW, W, NW)
   * - CARDINAL direction takes priority (deterministic for resources)
   *
   * @param playerIds - List of player IDs to process (in PID order)
   */
  processFaceDirection(playerIds: readonly string[]): void {
    for (const playerId of playerIds) {
      const player = this.world.getPlayer?.(playerId) as FaceableEntity | null;
      if (!player) {
        continue;
      }

      // Debug: Log state at start of processing
      if (
        DEBUG_FACE_DIRECTION &&
        (player.cardinalFaceDirection || player.faceTarget)
      ) {
        console.log(
          `[FaceDirection] Processing ${playerId}: cardinalFaceDirection=${player.cardinalFaceDirection || "none"}, ` +
            `faceTarget=${player.faceTarget ? `(${player.faceTarget.x.toFixed(1)}, ${player.faceTarget.z.toFixed(1)})` : "none"}, ` +
            `movedThisTick=${player.movedThisTick}`,
        );
      }

      // OSRS: Skip if player moved this tick (but keep targets for later)
      if (player.movedThisTick) {
        if (DEBUG_FACE_DIRECTION) {
          if (player.cardinalFaceDirection) {
            console.log(
              `[FaceDirection] Skipping ${playerId}: movedThisTick=true, cardinalFaceDirection=${player.cardinalFaceDirection} persists`,
            );
          } else if (player.faceTarget) {
            console.log(
              `[FaceDirection] Skipping ${playerId}: movedThisTick=true, faceTarget=(${player.faceTarget.x.toFixed(1)}, ${player.faceTarget.z.toFixed(1)}) persists`,
            );
          }
        }
        continue;
      }

      // PRIORITY 1: Cardinal direction (deterministic for resources)
      if (player.cardinalFaceDirection) {
        const angle = getCardinalFaceAngle(player.cardinalFaceDirection);
        if (DEBUG_FACE_DIRECTION) {
          console.log(
            `[FaceDirection] 🧭 Applying CARDINAL rotation for ${playerId}: ` +
              `direction=${player.cardinalFaceDirection}, angle=${((angle * 180) / Math.PI).toFixed(1)}° (${angle.toFixed(4)} rad)`,
          );
        }

        this.applyRotation(player, angle);

        if (DEBUG_FACE_DIRECTION) {
          console.log(
            `[FaceDirection] ✅ CARDINAL rotation applied for ${playerId}`,
          );
        }

        // Clear cardinal direction after applying
        player.cardinalFaceDirection = undefined;
        continue;
      }

      // PRIORITY 2: Point-based face target (legacy, for non-resource interactions)
      if (!player.faceTarget) {
        continue;
      }

      // Skip if player has no position
      if (!player.position) {
        if (DEBUG_FACE_DIRECTION) {
          console.log(`[FaceDirection] Skipping ${playerId}: no position`);
        }
        continue;
      }

      // Calculate direction to target
      const dx = player.faceTarget.x - player.position.x;
      const dz = player.faceTarget.z - player.position.z;

      // Skip if already at target (avoid divide by zero / weird angles)
      if (Math.abs(dx) < 0.01 && Math.abs(dz) < 0.01) {
        if (DEBUG_FACE_DIRECTION) {
          console.log(
            `[FaceDirection] Skipping ${playerId}: already at target`,
          );
        }
        player.faceTarget = undefined;
        continue;
      }

      // Calculate raw angle
      const rawAngle = Math.atan2(dx, dz);

      // OSRS: Snap to nearest 45 degrees (8 directions)
      const snappedAngle =
        Math.round(rawAngle / DIRECTION_STEP) * DIRECTION_STEP;

      // VRM 1.0+ models have 180 degree base rotation
      const finalAngle = snappedAngle + Math.PI;

      // Apply rotation using pooled quaternion
      this.applyRotation(player, finalAngle);

      // Convert angle to compass direction for logging
      const directions = ["S", "SW", "W", "NW", "N", "NE", "E", "SE"];
      const dirIndex = Math.round(
        ((snappedAngle + Math.PI) / (Math.PI / 4)) % 8,
      );
      const compassDir = directions[dirIndex] || "?";

      if (DEBUG_FACE_DIRECTION) {
        console.log(
          `[FaceDirection] ✅ Applied rotation for ${playerId}: ` +
            `angle=${((snappedAngle * 180) / Math.PI).toFixed(0)}° (${compassDir}), ` +
            `target=(${player.faceTarget.x.toFixed(1)}, ${player.faceTarget.z.toFixed(1)}), ` +
            `player=(${player.position.x.toFixed(1)}, ${player.position.z.toFixed(1)}), ` +
            `dx=${dx.toFixed(1)}, dz=${dz.toFixed(1)}`,
        );
      }

      // OSRS: Clear face target after successfully applying
      player.faceTarget = undefined;
    }
  }

  /**
   * Apply Y-axis rotation to player entity
   * Uses quaternion pool to avoid allocations
   */
  private applyRotation(player: FaceableEntity, angle: number): void {
    const tempQuat = quaternionPool.acquire();
    quaternionPool.setYRotation(tempQuat, angle);

    // Capture quaternion values before releasing to pool
    const qx = tempQuat.x;
    const qy = tempQuat.y;
    const qz = tempQuat.z;
    const qw = tempQuat.w;

    if (DEBUG_FACE_DIRECTION) {
      console.log(
        `[FaceDirection] applyRotation: angle=${((angle * 180) / Math.PI).toFixed(1)}°, ` +
          `quat=(${qx.toFixed(4)}, ${qy.toFixed(4)}, ${qz.toFixed(4)}, ${qw.toFixed(4)})`,
      );
    }

    let appliedTo = "";

    try {
      // Primary method: Set rotation directly on node.quaternion (Entity.rotation getter)
      // This is the canonical way to set rotation that triggers network sync
      if (player.node?.quaternion) {
        player.node.quaternion.set(qx, qy, qz, qw);
        appliedTo += "node.quaternion ";
      }

      // Fallback: Set server-side rotation object if node doesn't exist
      if (player.rotation && !player.node) {
        player.rotation.x = qx;
        player.rotation.y = qy;
        player.rotation.z = qz;
        player.rotation.w = qw;
        appliedTo += "rotation ";
      }

      // Set base quaternion if present (VRM models)
      if (player.base?.quaternion) {
        player.base.quaternion.set(qx, qy, qz, qw);
        appliedTo += "base.quaternion ";
      }

      if (!appliedTo) {
        // Always warn about missing rotation target (this is a bug)
        console.warn(
          `[FaceDirection] WARNING: No rotation target found for ${player.id}! ` +
            `node=${!!player.node}, node.quaternion=${!!player.node?.quaternion}, ` +
            `rotation=${!!player.rotation}, base=${!!player.base}`,
        );
      } else if (DEBUG_FACE_DIRECTION) {
        console.log(`[FaceDirection] Applied rotation to: ${appliedTo.trim()}`);
      }
    } finally {
      quaternionPool.release(tempQuat);
    }

    // CRITICAL: Mark for network broadcast so clients see the rotation change
    if (player.markNetworkDirty) {
      player.markNetworkDirty();
      if (DEBUG_FACE_DIRECTION) {
        console.log(`[FaceDirection] Marked ${player.id} as network dirty`);
      }
    } else {
      // Always warn about missing markNetworkDirty (this is a bug)
      console.warn(
        `[FaceDirection] WARNING: Player ${player.id} has no markNetworkDirty method!`,
      );
    }

    // CRITICAL: Send explicit entityModified packet with quaternion
    // The markNetworkDirty mechanism doesn't immediately broadcast rotation changes
    // We need to send an explicit packet for the client to see the rotation
    if (this.sendFn) {
      this.sendFn("entityModified", {
        id: player.id,
        changes: {
          q: [qx, qy, qz, qw],
        },
      });
      if (DEBUG_FACE_DIRECTION) {
        console.log(
          `[FaceDirection] 📡 Broadcast rotation for ${player.id}: q=[${qx.toFixed(4)}, ${qy.toFixed(4)}, ${qz.toFixed(4)}, ${qw.toFixed(4)}]`,
        );
      }
    } else {
      console.warn(
        `[FaceDirection] WARNING: No sendFn available, rotation not broadcast for ${player.id}!`,
      );
    }
  }
}
