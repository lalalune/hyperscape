/**
 * Position Validator Module - Server-authoritative position validation
 *
 * Validates player positions against terrain to prevent cheating and correct
 * client-side prediction errors. Uses terrain system to ensure players stay
 * grounded and within valid world bounds.
 *
 * Responsibilities:
 * - Validate player Y positions against terrain height
 * - Correct positions that fall out of bounds
 * - Broadcast corrections to all clients
 * - Adaptive validation frequency (aggressive at startup, slower after stabilization)
 *
 * Usage:
 * ```typescript
 * const validator = new PositionValidator(world, sockets, broadcast);
 * validator.update(deltaTime); // Call each frame
 * ```
 */

import type { World } from "@hyperscape/shared";
import { TerrainSystem } from "@hyperscape/shared";
import type { ServerSocket } from "../types";
import type { BroadcastManager } from "./broadcast";

/**
 * PositionValidator - Validates and corrects player positions
 *
 * Runs periodic validation checks to ensure player positions are valid
 * according to terrain height and world bounds.
 */
export class PositionValidator {
  /** Accumulated time since last validation (milliseconds) */
  private lastValidationTime = 0;

  /** Current validation interval in milliseconds */
  private validationInterval = 100;

  /** Accumulated system uptime (seconds) */
  private systemUptime = 0;

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
   * Validate all player positions against terrain
   *
   * Iterates through all connected players and corrects positions that
   * are significantly wrong (falling through terrain, flying too high, etc.)
   *
   * @private
   */
  private validateAllPositions(): void {
    const terrain = this.world.getSystem("terrain") as InstanceType<
      typeof TerrainSystem
    > | null;

    if (!terrain) return;

    for (const socket of this.sockets.values()) {
      if (!socket.player) continue;

      this.validatePlayerPosition(socket, terrain);
    }
  }

  /**
   * Validate a single player's position
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
}
