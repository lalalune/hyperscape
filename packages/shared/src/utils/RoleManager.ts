/**
 * Role Management Utilities
 *
 * Functions for managing user/player roles (admin, builder, moderator, etc.)
 *
 * **Temporary Roles**:
 * Roles prefixed with `~` (e.g., `~admin`) are considered temporary and:
 * - Are recognized by `hasRole()` checks
 * - Are filtered out by `serializeRoles()` (not persisted to database)
 * - Used for session-specific permissions that shouldn't be saved
 */

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
