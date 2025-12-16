/**
 * Position Validator Module - Server-authoritative position validation
 *
 * Validates player positions against terrain to prevent cheating and correct
 * client-side prediction errors. Uses terrain system to ensure players stay
 * grounded and within valid world bounds.
 *
 * Security measures:
 * - Validate player Y positions against terrain height
 * - Detect speed hacking via cumulative movement tracking
 * - Detect teleportation attempts
 * - Correct positions that fall out of bounds
 * - Broadcast corrections to all clients
 *
 * Usage:
 * ```typescript
 * const validator = new PositionValidator(world, sockets, broadcast);
 * validator.update(deltaTime); // Call each frame
 * ```
 */

import type { World } from "@hyperscape/shared";
import { TerrainSystem } from "@hyperscape/shared";
import type { ServerSocket } from "../../shared/types";
import type { BroadcastManager } from "./broadcast";

// ============================================================================
// SPEED HACK DETECTION
// ============================================================================

/**
 * Tracks player movement history for speed hack detection
 */
interface MovementHistory {
  positions: Array<{ x: number; z: number; timestamp: number }>;
  cumulativeDistance: number;
  windowStartTime: number;
  violations: number;
  lastWarningTime: number;
}

/**
 * SpeedHackDetector - Detects speed manipulation cheats
 *
 * Tracks cumulative movement over time windows to detect:
 * - Speed hacking (moving faster than allowed)
 * - Teleportation (instant position changes)
 * - Accumulated small movements that bypass per-tick validation
 */
class SpeedHackDetector {
  private history = new Map<string, MovementHistory>();

  // Configuration
  private readonly WINDOW_MS = 5000; // 5 second tracking window
  private readonly MAX_SPEED_TILES_PER_SEC = 7; // Max run speed + tolerance
  private readonly TELEPORT_THRESHOLD = 10; // Tiles - instant movement detection
  private readonly TELEPORT_THRESHOLD_SQ = 100; // 10^2 - squared for fast comparison
  private readonly MAX_VIOLATIONS = 3; // Before kicking
  private readonly VIOLATION_DECAY_MS = 30000; // Reset violations after 30s clean

  /**
   * Record player position and check for violations
   * @returns true if position is valid, false if suspicious
   */
  checkPosition(
    playerId: string,
    x: number,
    z: number,
    timestamp: number,
  ): { valid: boolean; reason?: string; shouldKick?: boolean } {
    let history = this.history.get(playerId);

    // Initialize history for new player
    if (!history) {
      history = {
        positions: [],
        cumulativeDistance: 0,
        windowStartTime: timestamp,
        violations: 0,
        lastWarningTime: 0,
      };
      this.history.set(playerId, history);
    }

    // Check for teleportation (instant large movement)
    if (history.positions.length > 0) {
      const lastPos = history.positions[history.positions.length - 1];
      const dx = x - lastPos.x;
      const dz = z - lastPos.z;
      const instantDistanceSq = dx * dx + dz * dz;
      const timeDelta = timestamp - lastPos.timestamp;

      // Teleport detection: large movement in small time (use squared distance)
      if (instantDistanceSq > this.TELEPORT_THRESHOLD_SQ && timeDelta < 500) {
        history.violations++;
        // Only compute sqrt for the log message
        const instantDistance = Math.sqrt(instantDistanceSq);
        console.warn(
          `[SpeedHack] Teleport detected for ${playerId}: ${instantDistance.toFixed(1)} tiles in ${timeDelta}ms`,
        );
        return {
          valid: false,
          reason: "teleport_detected",
          shouldKick: history.violations >= this.MAX_VIOLATIONS,
        };
      }
    }

    // Add position to history
    history.positions.push({ x, z, timestamp });

    // Clean old positions outside window
    const windowStart = timestamp - this.WINDOW_MS;
    while (
      history.positions.length > 1 &&
      history.positions[0].timestamp < windowStart
    ) {
      history.positions.shift();
    }

    // Calculate cumulative distance in window
    let totalDistance = 0;
    for (let i = 1; i < history.positions.length; i++) {
      const prev = history.positions[i - 1];
      const curr = history.positions[i];
      const dx = curr.x - prev.x;
      const dz = curr.z - prev.z;
      totalDistance += Math.sqrt(dx * dx + dz * dz);
    }

    // Calculate time span in window
    const firstPos = history.positions[0];
    const lastPos = history.positions[history.positions.length - 1];
    const timeSpanSec = Math.max(0.1, (lastPos.timestamp - firstPos.timestamp) / 1000);

    // Calculate average speed
    const averageSpeed = totalDistance / timeSpanSec;
    const maxAllowedDistance = this.MAX_SPEED_TILES_PER_SEC * timeSpanSec * 1.2; // 20% tolerance

    // Check for speed violation
    if (totalDistance > maxAllowedDistance && history.positions.length > 3) {
      history.violations++;
      history.lastWarningTime = timestamp;

      console.warn(
        `[SpeedHack] Speed violation for ${playerId}: ${averageSpeed.toFixed(1)} tiles/sec (max: ${this.MAX_SPEED_TILES_PER_SEC}), violations: ${history.violations}`,
      );

      return {
        valid: false,
        reason: "speed_violation",
        shouldKick: history.violations >= this.MAX_VIOLATIONS,
      };
    }

    // Decay violations over time (player behaving normally)
    if (
      history.violations > 0 &&
      timestamp - history.lastWarningTime > this.VIOLATION_DECAY_MS
    ) {
      history.violations = Math.max(0, history.violations - 1);
    }

    return { valid: true };
  }

  /**
   * Remove player from tracking
   */
  removePlayer(playerId: string): void {
    this.history.delete(playerId);
  }

  /**
   * Get player violation count
   */
  getViolationCount(playerId: string): number {
    return this.history.get(playerId)?.violations ?? 0;
  }

  /**
   * Clear all tracking data
   */
  clear(): void {
    this.history.clear();
  }
}

// Singleton speed hack detector
const speedHackDetector = new SpeedHackDetector();

/**
 * PositionValidator - Validates and corrects player positions
 *
 * Runs periodic validation checks to ensure player positions are valid
 * according to terrain height, world bounds, and movement speed limits.
 *
 * Security measures:
 * - Terrain height validation (prevents flying/clipping)
 * - Speed hack detection (tracks cumulative movement)
 * - Teleportation detection (instant large movements)
 * - Automatic position correction
 * - Kick players with repeated violations
 */
export class PositionValidator {
  /** Accumulated time since last validation (milliseconds) */
  private lastValidationTime = 0;

  /** Current validation interval in milliseconds */
  private validationInterval = 100;

  /** Accumulated system uptime (seconds) */
  private systemUptime = 0;

  /** Callback for kicking cheaters */
  private onKickPlayer?: (playerId: string, reason: string) => void;

  /** Cached terrain system reference */
  private _terrainSystem: InstanceType<typeof TerrainSystem> | null = null;
  private _terrainSystemLookedUp = false;

  /**
   * Create a PositionValidator
   *
   * @param world - Game world instance with terrain system
   * @param sockets - Map of active socket connections
   * @param broadcast - Broadcast manager for sending corrections
   */
  constructor(
    private world: World,
    private sockets: Map<string, ServerSocket>,
    private broadcast: BroadcastManager,
  ) {}

  /**
   * Get terrain system (cached after first lookup)
   */
  private getTerrain(): InstanceType<typeof TerrainSystem> | null {
    if (!this._terrainSystemLookedUp) {
      this._terrainSystem = this.world.getSystem("terrain") as InstanceType<
        typeof TerrainSystem
      > | null;
      this._terrainSystemLookedUp = true;
    }
    return this._terrainSystem;
  }

  /**
   * Set callback for kicking players
   * @param callback - Function to call when a player should be kicked
   */
  setKickCallback(callback: (playerId: string, reason: string) => void): void {
    this.onKickPlayer = callback;
  }

  /**
   * Update validation state and run checks if needed
   *
   * Call this every frame from ServerNetwork.update().
   * Validation frequency starts aggressive (100ms) and slows to 1000ms
   * after 10 seconds to reduce CPU usage once players are stable.
   *
   * @param dt - Delta time in seconds
   */
  update(dt: number): void {
    // Track uptime for validation interval adjustment
    this.systemUptime += dt;
    if (this.systemUptime > 10 && this.validationInterval < 1000) {
      this.validationInterval = 1000; // Slow down after 10 seconds
    }

    // Check if it's time to validate
    this.lastValidationTime += dt * 1000; // Convert to milliseconds
    if (this.lastValidationTime >= this.validationInterval) {
      this.validateAllPositions();
      this.lastValidationTime = 0;
    }
  }

  /**
   * Validate all player positions against terrain and speed limits
   *
   * Iterates through all connected players and corrects positions that
   * are significantly wrong (falling through terrain, flying too high, etc.)
   *
   * @private
   */
  private validateAllPositions(): void {
    const terrain = this.getTerrain();
    if (!terrain) return;

    const now = Date.now();

    for (const socket of this.sockets.values()) {
      if (!socket.player) continue;

      // Validate terrain position
      this.validatePlayerPosition(socket, terrain);

      // SECURITY: Check for speed hacking
      this.validatePlayerSpeed(socket, now);
    }
  }

  /**
   * Validate player movement speed (anti-cheat)
   *
   * @param socket - Player socket to validate
   * @param timestamp - Current timestamp
   * @private
   */
  private validatePlayerSpeed(socket: ServerSocket, timestamp: number): void {
    const player = socket.player!;

    const result = speedHackDetector.checkPosition(
      player.id,
      player.position.x,
      player.position.z,
      timestamp,
    );

    if (!result.valid) {
      if (result.shouldKick) {
        console.error(
          `[PositionValidator] KICKING player ${player.id} for speed hacking (${result.reason})`,
        );

        // Kick the player
        if (this.onKickPlayer) {
          this.onKickPlayer(player.id, `Kicked for ${result.reason}`);
        } else {
          // Fallback: close the socket directly
          socket.close?.();
        }

        // Clean up tracking
        speedHackDetector.removePlayer(player.id);
      } else {
        // Warning only - don't correct position for minor violations
        // The player will naturally slow down or the accumulation will catch up
      }
    }
  }

  /**
   * Validate a single player's position against terrain
   *
   * Checks the player's Y position against terrain height and corrects
   * if out of bounds or significantly different from expected.
   *
   * @param socket - Player socket to validate
   * @param terrain - Terrain system for height queries
   * @private
   */
  private validatePlayerPosition(
    socket: ServerSocket,
    terrain: InstanceType<typeof TerrainSystem>,
  ): void {
    const player = socket.player!;
    const currentY = player.position.y;
    const terrainHeight = terrain.getHeightAt(
      player.position.x,
      player.position.z,
    );

    // Emergency correction for invalid positions
    if (!Number.isFinite(currentY) || currentY < -5 || currentY > 200) {
      this.correctPosition(player, terrainHeight, "emergency");
      return;
    }

    // Gradual correction for drift
    if (Number.isFinite(terrainHeight)) {
      const expectedY = terrainHeight + 0.1;
      const errorMargin = Math.abs(currentY - expectedY);

      if (errorMargin > 10) {
        this.correctPosition(player, terrainHeight, "drift");
      }
    }
  }

  /**
   * Correct player position and broadcast the change
   *
   * Updates the player's position locally and broadcasts the correction
   * to all clients to keep everyone synchronized.
   *
   * @param player - Player entity to correct
   * @param terrainHeight - Terrain height at player's XZ position
   * @param reason - Reason for correction (for logging/debugging)
   * @private
   */
  private correctPosition(
    player: ServerSocket["player"],
    terrainHeight: number,
    reason: "emergency" | "drift",
  ): void {
    if (!player) return;

    const correctedY = Number.isFinite(terrainHeight)
      ? terrainHeight + 0.1
      : 10;

    // Update player position
    player.position.y = correctedY;
    if (player.data) {
      player.data.position = [player.position.x, correctedY, player.position.z];
    }

    // Broadcast correction to all clients
    this.broadcast.sendToAll("entityModified", {
      id: player.id,
      changes: { p: [player.position.x, correctedY, player.position.z] },
    });

    // Log for debugging if needed
    if (reason === "emergency") {
      console.log(
        `[PositionValidator] Emergency correction for player ${player.id}: Y=${correctedY}`,
      );
    }
  }

  /**
   * Clean up when player disconnects
   * @param playerId - ID of disconnecting player
   */
  onPlayerDisconnect(playerId: string): void {
    speedHackDetector.removePlayer(playerId);
  }

  /**
   * Clear all tracking data
   */
  clear(): void {
    speedHackDetector.clear();
  }
}
