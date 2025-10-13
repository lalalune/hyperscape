/**
 * Layers.ts - Physics Layer Collision Matrix
 * 
 * Defines which physics layers can collide with each other.
 * Used by PhysX for filtering raycasts, sweeps, and collision queries.
 * 
 * Architecture:
 * - Each layer gets a unique bit (group): 1, 2, 4, 8, 16, ...
 * - Each layer has a collision mask (bitmask of layers it collides with)
 * - PhysX uses these for efficient collision filtering
 * 
 * Layers Defined:
 * - camera: Raycasting layer (hits environment only)
 * - player: Player collision layer (hits environment, props, optionally other players)
 * - environment: World geometry (terrain, buildings, walls)
 * - prop: Movable objects (crates, barrels, etc.)
 * - tool: Tool/weapon collision layer
 * - ground/terrain: Aliases for environment (used by different systems)
 * - obstacle/building: Specific environment types for raycasting
 * - ground_helper: Internal physics layer (never collides with anything)
 * 
 * Player-to-Player Collision:
 * - Controlled by PUBLIC_PLAYER_COLLISION environment variable
 * - If true: Players can collide with each other (PvP blocking)
 * - If false: Players ghost through each other (default for most MMOs)
 * 
 * Usage Example:
 * ```ts
 * import { Layers } from './extras/Layers';
 * 
 * // Set up collision filtering for a PhysX shape
 * const filterData = new PHYSX.PxFilterData(
 *   Layers.player.group,  // This object is in 'player' group
 *   Layers.player.mask,   // It can collide with these layers
 *   0, 0
 * );
 * shape.setQueryFilterData(filterData);
 * ```
 * 
 * Referenced by: Physics system, Node colliders, PlayerLocal, raycasting code
 */

import type { LayersType } from '../types/physics'

/** Current layer bit index (incremented for each new layer) */
let n = 0

/** Map of layer names to their group bits (e.g., 'player' → 4) */
const Groups: Record<string, number> = {}

/** Map of layer names to their collision masks (bitmask of collidable layers) */
const Masks: Record<string, number> = {}

/** Exported layer configuration (group + mask pairs for each layer) */
export const Layers: LayersType = {}

/**
 * Ensure a layer group exists.
 * Creates a new layer if it doesn't exist, assigning the next available bit.
 */
function ensure(group: string) {
  if (Groups[group] === undefined) {
    Groups[group] = 1 << n  // Assign next power of 2
    Masks[group] = 0        // Start with empty collision mask
    n++                     // Increment for next layer
  }
}

/**
 * Define which layers a group can collide with.
 * 
 * @param group - The layer to configure
 * @param hits - Array of layer names this group should collide with
 */
function add(group: string, hits: (string | null | undefined)[]) {
  ensure(group)
  for (const otherGroup of hits) {
    if (!otherGroup) continue
    ensure(otherGroup)
    // Add otherGroup's bit to this group's collision mask
    Masks[group] |= Groups[otherGroup]
  }
}

// ============================================================================
// LAYER COLLISION MATRIX CONFIGURATION
// ============================================================================

/** Check if player-to-player collision is enabled via environment variable */
const playerCollision = (process?.env.PUBLIC_PLAYER_COLLISION || ((globalThis as Record<string, unknown>).env as Record<string, unknown>)?.PUBLIC_PLAYER_COLLISION) === 'true'

// Camera raycasts (only hits environment for world clicks)
add('camera', ['environment'])

// Player collision (hits environment, props, and optionally other players)
add('player', ['environment', 'prop', playerCollision ? 'player' : null])

// Environment geometry (terrain, buildings, walls - collides with everything)
add('environment', ['camera', 'player', 'environment', 'prop', 'tool'])

// Movable props (crates, barrels - collide with environment and each other)
add('prop', ['environment', 'prop'])

// Tools/weapons (collide with environment and props for hit detection)
add('tool', ['environment', 'prop'])

// Ground and terrain layers (aliases for environment)
// Used by different systems but behave identically
add('ground', ['camera', 'player', 'environment', 'prop', 'tool'])
add('terrain', ['camera', 'player', 'environment', 'prop', 'tool'])

// Obstacle and building layers (for specific raycast filtering)
add('obstacle', ['player', 'environment'])
add('building', ['player', 'environment'])

// Internal helper layer (doesn't collide with anything)
// Used by Physics system for internal ground plane setup
add('ground_helper', [])

// ============================================================================
// BUILD FINAL LAYER EXPORT
// ============================================================================

// Convert Groups and Masks into final Layers export
for (const key in Groups) {
  Layers[key] = {
    group: Groups[key],  // This layer's bit
    mask: Masks[key],    // Bitmask of layers it collides with
  }
}

