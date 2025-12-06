/**
 * Interaction System Constants
 *
 * ALL magic numbers centralized here for:
 * 1. Easy tuning without searching codebase
 * 2. Consistent values across all handlers
 * 3. Clear documentation of what each value means
 *
 * These values were extracted from the legacy InteractionSystem.ts
 * where they were duplicated 6+ times across different handlers.
 */

/**
 * Interaction ranges in tiles (using Chebyshev/max-distance)
 *
 * OSRS uses tile-based ranges where diagonal counts as 1 tile.
 * Range 0 = must stand ON the tile (items)
 * Range 1 = adjacent tile (most interactions)
 */
export const INTERACTION_RANGE = {
  /** Must stand ON same tile (item pickup) */
  SAME_TILE: 0,
  /** Must be on adjacent tile (most interactions) */
  ADJACENT: 1,
  /** Standard melee range */
  MELEE: 1,
  /** Extended melee weapons (halberds) */
  HALBERD: 2,
  /** Default NPC interaction range */
  NPC: 1,
  /** Resource gathering range (trees, rocks, fishing spots) */
  RESOURCE: 1,
  /** Bank booth/chest interaction range */
  BANK: 1,
  /** Corpse/gravestone looting range */
  LOOT: 1,
  /**
   * Tolerance for detecting items on same tile (as fraction of TILE_SIZE).
   * Used when querying item piles - items within this distance of tile center
   * are considered "on" that tile.
   * Value: 0.6 = half tile width + small margin for visual offsets.
   */
  TILE_PILE_TOLERANCE: 0.6,
} as const;

/**
 * Timing constants in milliseconds
 */
export const TIMING = {
  /** Debounce between pickup requests for same item */
  PICKUP_DEBOUNCE_MS: 1000,
  /** Debounce between attack requests on same target */
  ATTACK_DEBOUNCE_MS: 600,
  /** Debounce between resource gather requests */
  RESOURCE_DEBOUNCE_MS: 1000,
  /** Mobile long-press duration to trigger context menu */
  LONG_PRESS_MS: 500,
  /** How long click indicator stays visible (RS3 style) */
  CLICK_INDICATOR_MS: 300,
  /** Max time to wait for player to reach target (auto-cancel) */
  ACTION_TIMEOUT_MS: 10000,
  /** Minimum delay even when already in range (prevents race conditions) */
  MIN_ACTION_DELAY_MS: 50,
} as const;

/**
 * Visual feedback constants
 */
export const VISUAL = {
  /** Target marker size as fraction of tile */
  TARGET_MARKER_SCALE: 0.9,
  /** Target marker opacity */
  TARGET_MARKER_OPACITY: 0.4,
  /** Click indicator base scale at reference distance */
  CLICK_INDICATOR_BASE_SCALE: 0.25,
  /** Click indicator minimum scale (close camera) */
  CLICK_INDICATOR_MIN_SCALE: 0.12,
  /** Click indicator maximum scale (far camera) */
  CLICK_INDICATOR_MAX_SCALE: 0.8,
  /** Reference distance for indicator scaling */
  CLICK_INDICATOR_REFERENCE_DISTANCE: 10,
  /** Target marker color (yellow/gold like RuneScape) */
  TARGET_MARKER_COLOR: 0xffff00,
  /** Yellow X color for ground clicks */
  CLICK_INDICATOR_GROUND_COLOR: "#ffff00",
  /** Red X color for entity interactions */
  CLICK_INDICATOR_ENTITY_COLOR: "#ff0000",
} as const;

/**
 * Input handling constants
 */
export const INPUT = {
  /** Pixels of drag before it's not considered a click */
  DRAG_THRESHOLD_PX: 5,
  /** Max tiles from player for click-to-move */
  MAX_CLICK_DISTANCE_TILES: 100,
  /** Max raycast distance for entity detection */
  MAX_RAYCAST_DISTANCE: 200,
} as const;

/**
 * Frame-based action queue constants
 */
export const ACTION_QUEUE = {
  /** Frames to wait before action times out (~10 seconds at 60fps) */
  DEFAULT_TIMEOUT_FRAMES: 600,
  /** How often to check distance (every N frames, 1 = every frame) */
  DISTANCE_CHECK_INTERVAL: 1,
  /** Frames between debounce cleanup (every 5 seconds at 60fps) */
  DEBOUNCE_CLEANUP_INTERVAL: 300,
  /** Time in ms before debounce entries are cleaned up */
  DEBOUNCE_EXPIRY_MS: 5000,
  /**
   * World-space tolerance for item pickup (range 0 actions).
   *
   * WHY THIS EXISTS:
   * The server-authoritative position from ENTITY_MODIFIED "idle" events
   * is tile-snapped (center of tile), but items may be slightly offset
   * within their tile. This tolerance allows pickup when the player
   * arrives at the same tile as the item, even with minor position differences.
   *
   * Value: 0.75 tiles = 75% of tile size, enough to cover tile center variations.
   * OSRS uses exact tile matching, but our items can be visually offset.
   */
  ITEM_PICKUP_TOLERANCE_TILES: 0.75,
} as const;
