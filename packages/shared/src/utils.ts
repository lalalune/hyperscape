/**
 * Core Utility Functions
 *
 * This module provides fundamental utilities used throughout the Hyperscape framework:
 *
 * **UUID Generation** (`uuid`):
 * Generates collision-resistant short IDs (10 alphanumeric characters) for entities,
 * players, sessions, and more. Balanced between uniqueness probability and network
 * packet size without requiring client/server ID mapping.
 *
 * - Collision probability: ~1% chance after 129 million IDs or 148 years of use
 * - See: https://zelark.github.io/nano-id-cc/
 *
 * **Role Management**:
 * Functions for managing user/player roles (admin, builder, moderator, etc.):
 * - `hasRole()`: Check if user has any of the specified roles
 * - `addRole()`: Add a role if not already present
 * - `removeRole()`: Remove a role by name
 * - `serializeRoles()`: Convert role array to comma-separated string for database storage
 *
 * **Temporary Roles**:
 * Roles prefixed with `~` (e.g., `~admin`) are considered temporary and:
 * - Are recognized by `hasRole()` checks
 * - Are filtered out by `serializeRoles()` (not persisted to database)
 * - Used for session-specific permissions that shouldn't be saved
 *
 * **Math Utilities**:
 * - `clamp()`: Constrain a number within a range
 * - `num()`: Generate random number with optional decimal precision
 * - `calculateDistance()`: 3D Euclidean distance between two points
 *
 * **Referenced by**: All systems, entities, and utilities throughout shared package
 */

import { customAlphabet } from "nanoid";

const ALPHABET =
  "1234567890abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ";

/**
 * Generates a unique 10-character alphanumeric ID
 *
 * Uses nano-id with a custom alphabet for collision-resistant short IDs.
 * Safe for use as primary keys in databases and entity identifiers.
 *
 * @returns A 10-character unique ID (e.g., "a3B9xK7m2Q")
 *
 * @example
 * const playerId = uuid() // => "a3B9xK7m2Q"
 * const entityId = uuid() // => "7kP2mX9bH4"
 */
export const uuid = customAlphabet(ALPHABET, 10);

/**
 * Clamps a number within a specified range
 *
 * @param n - Number to clamp
 * @param low - Minimum value (inclusive)
 * @param high - Maximum value (inclusive)
 * @returns Clamped value between low and high
 *
 * @example
 * clamp(150, 0, 100) // => 100
 * clamp(-10, 0, 100) // => 0
 * clamp(50, 0, 100)  // => 50
 */
export function clamp(n: number, low: number, high: number): number {
  return Math.max(Math.min(n, high), low);
}

/**
 * Checks if a user has any of the specified roles
 *
 * Supports both permanent and temporary roles (prefixed with `~`).
 * Temporary roles are session-only and not persisted to the database.
 *
 * @param arr - Array of role strings (may be null/undefined for guests)
 * @param roles - Roles to check for (e.g., 'admin', 'builder', 'moderator')
 * @returns true if user has any of the specified roles
 *
 * @example
 * hasRole(['admin', 'builder'], 'admin') // => true
 * hasRole(['player'], 'admin') // => false
 * hasRole(['~admin'], 'admin') // => true (temporary admin role)
 * hasRole(null, 'admin') // => false (guest user)
 */
export function hasRole(
  arr: string[] | null | undefined,
  ...roles: string[]
): boolean {
  if (!arr) return false;
  // also includes temporary roles (prefixed with `~`)
  return roles.some(
    (role: string) => arr.includes(role) || arr.includes(`~${role}`),
  );
}

/**
 * Adds a role to a user's role array if not already present
 *
 * @param arr - Array of role strings to modify
 * @param role - Role to add (e.g., 'admin', 'builder')
 *
 * @example
 * const roles = ['player']
 * addRole(roles, 'admin')
 * // roles is now ['player', 'admin']
 */
export function addRole(arr: string[], role: string): void {
  if (!hasRole(arr, role)) {
    arr.push(role);
  }
}

/**
 * Removes a role from a user's role array
 *
 * @param arr - Array of role strings to modify
 * @param role - Role to remove (e.g., 'admin', 'builder')
 *
 * @example
 * const roles = ['player', 'admin']
 * removeRole(roles, 'admin')
 * // roles is now ['player']
 */
export function removeRole(arr: string[], role: string): void {
  const idx = arr.indexOf(role);
  if (idx !== -1) {
    arr.splice(idx, 1);
  }
}

/**
 * Serializes roles to a comma-separated string for database storage
 *
 * Filters out temporary roles (prefixed with `~`) since they should not be persisted.
 *
 * @param roles - Array of role strings
 * @returns Comma-separated string of permanent roles
 *
 * @example
 * serializeRoles(['admin', '~builder', 'player']) // => 'admin,player'
 * serializeRoles(['player']) // => 'player'
 */
export function serializeRoles(roles: string[]): string {
  // remove temporary (~) roles
  roles = roles.filter((role: string) => !role.startsWith("~"));
  // convert to string
  return roles.join(",");
}

/**
 * Generates a random number within a range with optional decimal precision
 *
 * @param min - Minimum value (inclusive)
 * @param max - Maximum value (inclusive)
 * @param dp - Decimal places (default: 0 for integers)
 * @returns Random number in range [min, max]
 *
 * @example
 * num(1, 10)       // => 7 (random integer between 1-10)
 * num(0, 1, 2)     // => 0.73 (random float with 2 decimal places)
 * num(100, 200, 1) // => 156.4 (random float with 1 decimal place)
 */
export function num(min: number, max: number, dp: number = 0): number {
  const value = Math.random() * (max - min) + min;
  return parseFloat(value.toFixed(dp));
}

/**
 * Calculates 3D Euclidean distance between two points
 *
 * Uses the distance formula: sqrt((x2-x1)² + (y2-y1)² + (z2-z1)²)
 *
 * @param pos1 - First position with x, y, z coordinates
 * @param pos2 - Second position with x, y, z coordinates
 * @returns Distance in world units
 *
 * @example
 * const playerPos = { x: 0, y: 0, z: 0 }
 * const enemyPos = { x: 3, y: 4, z: 0 }
 * const distance = calculateDistance(playerPos, enemyPos) // => 5.0
 */
export function calculateDistance(
  pos1: { x: number; y: number; z: number },
  pos2: { x: number; y: number; z: number },
): number {
  const dx = pos2.x - pos1.x;
  const dy = pos2.y - pos1.y;
  const dz = pos2.z - pos1.z;
  return Math.sqrt(dx * dx + dy * dy + dz * dz);
}
