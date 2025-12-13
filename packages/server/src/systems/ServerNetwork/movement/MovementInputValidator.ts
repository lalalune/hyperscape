/**
 * Movement Input Validator
 *
 * Server-side validation for all movement-related packets.
 * Defense-in-depth: validates BEFORE any processing occurs.
 *
 * OWASP: Input validation at trust boundary - all client data
 * is treated as untrusted and validated before use.
 *
 * @see MOVEMENT_SYSTEM_HARDENING_PLAN.md for security rationale
 */

import type { TileCoord } from "@hyperscape/shared";

/**
 * Severity levels for movement violations
 * Matches ViolationSeverity enum from shared types
 */
export enum MovementViolationSeverity {
  /** Minor issues - typos, malformed optional fields */
  MINOR = 0,
  /** Moderate issues - wrong types, missing required fields */
  MODERATE = 1,
  /** Major issues - out of bounds, anti-teleport violations */
  MAJOR = 2,
  /** Critical issues - NaN/Infinity injection, potential exploits */
  CRITICAL = 3,
}

/**
 * World coordinate bounds
 * These should match your actual world size
 */
const WORLD_BOUNDS = {
  MIN_COORD: -10000,
  MAX_COORD: 10000,
} as const;

/**
 * Maximum tiles a player can request to move in a single request
 * Prevents teleport exploits by limiting how far a destination can be
 */
const MAX_TILE_DISTANCE_PER_REQUEST = 200;

/**
 * Validated move request payload
 * All fields are guaranteed to be valid after validation
 */
export interface ValidatedMovePayload {
  /** Target tile (validated, within bounds) */
  targetTile: TileCoord;
  /** Whether player is running */
  runMode: boolean;
  /** Whether this is a cancel request */
  cancel: boolean;
}

/**
 * Result of move request validation
 */
export interface MoveRequestValidation {
  /** Whether the request is valid */
  valid: boolean;
  /** Validated payload (only present if valid) */
  payload?: ValidatedMovePayload;
  /** Error message if invalid */
  error?: string;
  /** Severity of the violation (for anti-cheat logging) */
  severity?: MovementViolationSeverity;
}

/**
 * Movement Input Validator
 *
 * Validates all client-provided movement data before processing.
 * Rejects invalid inputs with appropriate severity levels for
 * anti-cheat monitoring.
 */
export class MovementInputValidator {
  /**
   * Validate a raw move request from the client
   *
   * @param data - Raw data from client (untrusted)
   * @param currentTile - Player's current tile position (server-authoritative)
   * @returns Validation result with payload or error
   */
  validateMoveRequest(
    data: unknown,
    currentTile: TileCoord,
  ): MoveRequestValidation {
    // Type check - must be non-null object
    if (data === null || typeof data !== "object") {
      return {
        valid: false,
        error: "Invalid payload type: expected object",
        severity: MovementViolationSeverity.MINOR,
      };
    }

    const payload = data as Record<string, unknown>;

    // Handle cancel request
    if (payload.cancel === true) {
      return {
        valid: true,
        payload: {
          targetTile: { ...currentTile },
          runMode: false,
          cancel: true,
        },
      };
    }

    // Validate target coordinates
    let targetTile: TileCoord;

    if (payload.targetTile !== undefined) {
      // Direct tile coordinate provided
      const result = this.validateTileCoord(payload.targetTile);
      if (!result.valid || !result.tile) {
        return {
          valid: false,
          error: result.error,
          severity: result.severity,
        };
      }
      targetTile = result.tile;
    } else if (payload.target !== undefined) {
      // World coordinates array [x, y, z] provided
      const result = this.validateWorldCoords(payload.target);
      if (!result.valid || !result.tile) {
        return {
          valid: false,
          error: result.error,
          severity: result.severity,
        };
      }
      targetTile = result.tile;
    } else {
      // No target - might be runMode toggle only
      if (typeof payload.runMode === "boolean") {
        return {
          valid: true,
          payload: {
            targetTile: { ...currentTile },
            runMode: payload.runMode,
            cancel: false,
          },
        };
      }
      return {
        valid: false,
        error: "No target specified and no runMode toggle",
        severity: MovementViolationSeverity.MINOR,
      };
    }

    // Anti-teleport check: validate distance from current position
    const distance = Math.max(
      Math.abs(targetTile.x - currentTile.x),
      Math.abs(targetTile.z - currentTile.z),
    );

    if (distance > MAX_TILE_DISTANCE_PER_REQUEST) {
      return {
        valid: false,
        error: `Target too far: ${distance} tiles exceeds max ${MAX_TILE_DISTANCE_PER_REQUEST}`,
        severity: MovementViolationSeverity.MAJOR,
      };
    }

    // Validate runMode
    const runMode =
      typeof payload.runMode === "boolean" ? payload.runMode : false;

    return {
      valid: true,
      payload: {
        targetTile,
        runMode,
        cancel: false,
      },
    };
  }

  /**
   * Internal validation result for tile coordinates
   */
  private validateTileCoord(
    tile: unknown,
  ): MoveRequestValidation & { tile?: TileCoord } {
    // Type check
    if (tile === null || typeof tile !== "object") {
      return {
        valid: false,
        error: "Invalid tile format: expected object",
        severity: MovementViolationSeverity.MODERATE,
      };
    }

    const t = tile as Record<string, unknown>;

    // Check x and z are numbers
    if (typeof t.x !== "number" || typeof t.z !== "number") {
      return {
        valid: false,
        error: "Tile coordinates must be numbers",
        severity: MovementViolationSeverity.MODERATE,
      };
    }

    // Check for NaN/Infinity (CRITICAL - potential exploit)
    if (!Number.isFinite(t.x) || !Number.isFinite(t.z)) {
      return {
        valid: false,
        error: "Invalid tile coordinates: NaN or Infinity detected",
        severity: MovementViolationSeverity.CRITICAL,
      };
    }

    // Floor to integers (graceful handling of floats)
    const x = Math.floor(t.x as number);
    const z = Math.floor(t.z as number);

    // Bounds check
    if (
      x < WORLD_BOUNDS.MIN_COORD ||
      x > WORLD_BOUNDS.MAX_COORD ||
      z < WORLD_BOUNDS.MIN_COORD ||
      z > WORLD_BOUNDS.MAX_COORD
    ) {
      return {
        valid: false,
        error: `Tile out of world bounds: (${x}, ${z})`,
        severity: MovementViolationSeverity.MAJOR,
      };
    }

    return { valid: true, tile: { x, z } };
  }

  /**
   * Internal validation result for world coordinates
   */
  private validateWorldCoords(
    coords: unknown,
  ): MoveRequestValidation & { tile?: TileCoord } {
    // Type check - must be array with at least 3 elements
    if (!Array.isArray(coords)) {
      return {
        valid: false,
        error: "Target must be an array",
        severity: MovementViolationSeverity.MODERATE,
      };
    }

    if (coords.length < 3) {
      return {
        valid: false,
        error: "Target array must have at least 3 elements [x, y, z]",
        severity: MovementViolationSeverity.MODERATE,
      };
    }

    const x = coords[0];
    const z = coords[2]; // Skip y, we only care about x/z for tiles

    // Check types
    if (typeof x !== "number" || typeof z !== "number") {
      return {
        valid: false,
        error: "Coordinates must be numbers",
        severity: MovementViolationSeverity.MODERATE,
      };
    }

    // Check for NaN/Infinity (CRITICAL - potential exploit)
    if (!Number.isFinite(x) || !Number.isFinite(z)) {
      return {
        valid: false,
        error: "Invalid coordinates: NaN or Infinity detected",
        severity: MovementViolationSeverity.CRITICAL,
      };
    }

    // Convert to tile coordinates
    const tileX = Math.floor(x);
    const tileZ = Math.floor(z);

    // Bounds check
    if (
      tileX < WORLD_BOUNDS.MIN_COORD ||
      tileX > WORLD_BOUNDS.MAX_COORD ||
      tileZ < WORLD_BOUNDS.MIN_COORD ||
      tileZ > WORLD_BOUNDS.MAX_COORD
    ) {
      return {
        valid: false,
        error: `Coordinates out of world bounds: (${tileX}, ${tileZ})`,
        severity: MovementViolationSeverity.MAJOR,
      };
    }

    return { valid: true, tile: { x: tileX, z: tileZ } };
  }
}
