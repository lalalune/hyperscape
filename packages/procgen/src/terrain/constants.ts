/**
 * Procgen Terrain Constants — single source of truth for terrain defaults.
 *
 * These values define the procgen package's default terrain parameters.
 * All files in @hyperforge/procgen should reference these instead of
 * hardcoding magic numbers.
 *
 * NOTE: The game runtime in @hyperforge/shared has its own
 * TERRAIN_CONSTANTS.WATER_THRESHOLD (= 16) and MAX_HEIGHT (= 50).
 * The procgen defaults below use a different height scale (maxHeight=30).
 * When procgen is used inside the game, the game passes its own values
 * via config overrides — these are just standalone defaults.
 */

/** Default max terrain height in world units */
export const DEFAULT_MAX_HEIGHT = 30;

/** Default water threshold in world units (terrain below this is underwater) */
export const DEFAULT_WATER_THRESHOLD = 5.4;

/**
 * Water level in world-space Y for the game runtime.
 * Must match TERRAIN_CONSTANTS.WATER_THRESHOLD in @hyperforge/shared.
 * Used by systems that need the actual game water Y (e.g. DockGenerator).
 */
export const GAME_WATER_LEVEL = 16;
