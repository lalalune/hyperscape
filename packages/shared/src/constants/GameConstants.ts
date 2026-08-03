/**
 * Game Constants
 *
 * Centralized location for all game constants to eliminate magic numbers
 * and ensure consistency across the system.
 */

// Import COMBAT_CONSTANTS from dedicated file
import { COMBAT_CONSTANTS } from "./CombatConstants";
// Re-export biome enum as the single source of truth
export {
  BiomeType,
  DEFAULT_BIOME,
  BIOME_LIST,
} from "../systems/shared/world/TerrainBiomeTypes";
// Import banking constants - single source of truth for MAX_BANK_SLOTS
import { BANKING_CONSTANTS } from "./BankingConstants";

// === INVENTORY AND ITEMS ===
export const INVENTORY_CONSTANTS = {
  MAX_INVENTORY_SLOTS: 28,
  MAX_BANK_SLOTS: BANKING_CONSTANTS.MAX_BANK_SLOTS, // Single source: BankingConstants.ts
  MAX_STACK_SIZE: 1000,
  DEFAULT_ITEM_VALUE: 1,
} as const;

// === PLAYER STATS AND HEALTH ===
export const PLAYER_CONSTANTS = {
  DEFAULT_HEALTH: 100,
  DEFAULT_MAX_HEALTH: 100,
  DEFAULT_STAMINA: 100,
  DEFAULT_MAX_STAMINA: 100,
  BASE_MOVEMENT_SPEED: 1.0,
  RUNNING_SPEED_MULTIPLIER: 1.5,
  HEALTH_REGEN_RATE: 1, // 1 HP per regen tick (classic fantasy MMORPG-style)
  // Note: Health regen cooldown/interval use COMBAT_CONSTANTS tick-based values
  STAMINA_REGEN_RATE: 2.0,
  STAMINA_DRAIN_RATE: 5.0,
} as const;

// === HOME TELEPORT ===
export const HOME_TELEPORT_CONSTANTS = {
  /** Cooldown in milliseconds (30 seconds) */
  COOLDOWN_MS: 30 * 1000,
  /** Cast time in milliseconds (10 seconds - can be interrupted by movement/combat) */
  CAST_TIME_MS: 10 * 1000,
  /** Cast time in ticks (for server-side processing, 10s = ~17 ticks at 600ms/tick) */
  CAST_TIME_TICKS: 17,
} as const;

// === EXPERIENCE AND LEVELING ===
export const XP_CONSTANTS = {
  BASE_XP_MULTIPLIER: 83,
  MAX_LEVEL: 99,
  XP_TABLE_LENGTH: 99,
  DEFAULT_XP_GAIN: {
    COMBAT: 10,
    WOODCUTTING: 25,
    FISHING: 20,
    FIREMAKING: 40,
    COOKING: 30,
  },
} as const;

// === WORLD AND SPATIAL PARTITIONING ===
export const WORLD_CONSTANTS = {
  /** Spatial partition chunk size for entity registry (meters). */
  CHUNK_SIZE: 64,
} as const;

// === TERRAIN CONSTANTS ===
/**
 * Centralized terrain constants for water, slopes, and walkability.
 * SINGLE SOURCE OF TRUTH - all systems must import from here.
 *
 * IMPORTANT: TerrainSystem.CONFIG uses these values but has its own internal
 * CONFIG object for backwards compatibility. When changing values here,
 * ensure TerrainSystem.CONFIG is also updated.
 */
export const TERRAIN_CONSTANTS = {
  /**
   * Water threshold in world Y units.
   * Terrain below this height is underwater and impassable.
   * Used by: TerrainSystem, VegetationSystem, DissolveMaterial, RoadNetworkSystem, ResourceSystem
   */
  WATER_THRESHOLD: 16,

  /**
   * Buffer distance above water where vegetation shouldn't spawn.
   * Prevents plants from appearing in the shoreline splash zone.
   */
  WATER_EDGE_BUFFER: 1.5,

  /**
   * Minimum depth below water surface for terrain to be considered
   * visibly submerged. Terrain within this depth of the surface looks
   * like wet beach, not water. Used by minimap and fishing spot placement
   * to align visual shoreline with the 3D water mesh appearance.
   */
  MIN_VISIBLE_WATER_DEPTH: 1.5,

  /**
   * Maximum slope for walkable terrain (tan of angle).
   * Slopes steeper than this block movement.
   * 2.5 ≈ 68 degree angle.
   */
  MAX_WALKABLE_SLOPE: 2.5,

  /**
   * Distance to sample for slope calculation (in meters).
   * Larger values average slope over a wider area, preventing
   * terraced cliffs and landscape features from blocking movement.
   */
  SLOPE_CHECK_DISTANCE: 4.0,

  /**
   * Tile size in meters (1 tile = 1 meter for movement grid).
   */
  TILE_SIZE: 1.0,

  /**
   * Terrain tile size in meters (100m x 100m per terrain chunk).
   */
  TERRAIN_TILE_SIZE: 100,

  /**
   * Pre-computed water threshold + buffer for vegetation checks.
   * Vegetation should not spawn below this level.
   */
  get WATER_CUTOFF(): number {
    return this.WATER_THRESHOLD + this.WATER_EDGE_BUFFER;
  },
} as const;

// === DISTANCE AND CULLING ===
/** Distance constants for render culling, LOD, and server simulation (meters) */
export const DISTANCE_CONSTANTS = {
  /** Client render distances (includes fade zone before cutoff) */
  RENDER: {
    MOB: 150,
    MOB_FADE_START: 130,
    NPC: 120,
    NPC_FADE_START: 100,
    PLAYER: 200,
    PLAYER_FADE_START: 180,
    ITEM: 100,
    ITEM_FADE_START: 80,
    VEGETATION: 300,
    TERRAIN: 400,
  },

  /** Server simulation distances (dormant beyond these) */
  SIMULATION: {
    ENTITY_UPDATE: 200,
    NETWORK_BROADCAST: 200,
    AI_ACTIVE: 100,
    AI_DORMANT: 200,
    CHUNK_ACTIVE: 256,
    CHUNK_HYSTERESIS: 5,
  },

  /** Animation LOD tiers by distance - values doubled to prevent skating at medium distances */
  ANIMATION_LOD: {
    FULL: 60, // 60fps - full animation up to 60m
    HALF: 120, // 30fps - half-rate animation 60-120m
    QUARTER: 160, // 15fps - quarter-rate animation 120-160m
    FROZEN: 200, // static pose - frozen 160-200m
    CULLED: 250, // not rendered - cull at 250m
  },

  /** Pre-computed squared distances for hot paths */
  RENDER_SQ: {
    MOB: 150 * 150,
    MOB_FADE_START: 130 * 130,
    NPC: 120 * 120,
    NPC_FADE_START: 100 * 100,
    PLAYER: 200 * 200,
    PLAYER_FADE_START: 180 * 180,
    ITEM: 100 * 100,
    ITEM_FADE_START: 80 * 80,
  },

  SIMULATION_SQ: {
    ENTITY_UPDATE: 200 * 200,
    NETWORK_BROADCAST: 200 * 200,
    AI_ACTIVE: 100 * 100,
    AI_DORMANT: 200 * 200,
    CHUNK_ACTIVE: 256 * 256,
  },

  ANIMATION_LOD_SQ: {
    FULL: 60 * 60,
    HALF: 120 * 120,
    QUARTER: 160 * 160,
    FROZEN: 200 * 200,
    CULLED: 250 * 250,
  },
} as const;

/**
 * Helper to compute fade alpha based on distance
 * Returns 1.0 at fadeStart, 0.0 at maxDistance, linear interpolation between
 */
export function computeDistanceFade(
  distanceSq: number,
  fadeStartSq: number,
  maxDistanceSq: number,
): number {
  if (distanceSq <= fadeStartSq) return 1.0;
  if (distanceSq >= maxDistanceSq) return 0.0;
  // Linear interpolation: 1.0 at fadeStart, 0.0 at maxDistance
  const t = (distanceSq - fadeStartSq) / (maxDistanceSq - fadeStartSq);
  return 1.0 - t;
}

// === RESOURCE GATHERING ===
// Re-export from dedicated file for backwards compatibility
// Also import for use in GAME_CONSTANTS object below
import { GATHERING_CONSTANTS } from "./GatheringConstants";
export { GATHERING_CONSTANTS };

// === MOB SYSTEM ===
// Mob stats (HP, damage, etc.) are loaded from world/assets/manifests/mobs.json
// Only system-level constants here, no mob-specific data
export const MOB_CONSTANTS = {
  SPAWN_RADIUS: 20,
  MAX_MOBS_PER_AREA: 10,
  /** Max concurrent bandit-type mobs world-wide (matches manifest npc ids, e.g. bandit). */
  MAX_BANDIT_MOBS_WORLD: 100,
  /** Mob ids counted toward {@link MAX_BANDIT_MOBS_WORLD} (extend if you add variants). */
  BANDIT_MOB_IDS_FOR_GLOBAL_CAP: ["bandit", "desert_bandit"] as const,
  // Derived from tick-based constant for consistency (25 ticks * 600ms = 15000ms)
  MOB_RESPAWN_TIME:
    COMBAT_CONSTANTS.DEFAULTS.NPC.RESPAWN_TICKS *
    COMBAT_CONSTANTS.TICK_DURATION_MS,
  // Note: AI update interval is TICK_DURATION_MS (600ms) - see AggroSystem.ts
} as const;

// Import health bar dimensions from single source of truth
import { HEALTH_BAR_DIMENSIONS } from "../utils/rendering/HealthBarRenderer";

// === UI AND VISUAL ===
export const UI_CONSTANTS = {
  // Health bar dimensions - from HealthBarRenderer (single source of truth)
  HEALTH_BAR_WIDTH: HEALTH_BAR_DIMENSIONS.WIDTH,
  HEALTH_BAR_HEIGHT: HEALTH_BAR_DIMENSIONS.HEIGHT,
  HEALTH_BAR_BORDER: HEALTH_BAR_DIMENSIONS.BORDER_WIDTH,
  HEALTH_SPRITE_SCALE: HEALTH_BAR_DIMENSIONS.SPRITE_SCALE,
  // Other UI constants
  NAME_TAG_WIDTH: 200,
  NAME_TAG_HEIGHT: 25,
  UI_SCALE: 0.1, // Canvas to world scale
  SPRITE_SCALE: 0.1,
  HUD_UPDATE_RATE: 100, // 10 FPS for UI updates
  CHAT_MESSAGE_TIMEOUT: 5000, // 5 seconds
} as const;

// === classic MMORPG-STYLE CONTEXT MENU COLORS ===
export const CONTEXT_MENU_COLORS = {
  /** Item name color in context menus (classic MMORPG orange) */
  ITEM: "#ff9040",
  /** NPC name color in context menus (classic MMORPG yellow) */
  NPC: "#ffff00",
  /** Object name color in context menus (classic MMORPG cyan) */
  OBJECT: "#00ffff",
  /** Player name color in context menus */
  PLAYER: "#ffffff",
} as const;

// === PHYSICS AND MOVEMENT ===
export const PHYSICS_CONSTANTS = {
  GRAVITY: -9.81,
  CHARACTER_CAPSULE_RADIUS: 0.4,
  CHARACTER_CAPSULE_HEIGHT: 1.2,
  ITEM_BOX_SIZE: 0.3,
  COLLISION_MARGIN: 0.04,
  GROUND_CHECK_DISTANCE: 0.1,
  STEP_HEIGHT: 0.25,
} as const;

// === CAMERA SYSTEM ===
export const CAMERA_CONSTANTS = {
  DEFAULT_CAM_HEIGHT: 1.6,
  THIRD_PERSON_DISTANCE: 5.0,
  TOP_DOWN_DISTANCE: 10.0,
  CAMERA_LERP_SPEED: 0.1,
  MOUSE_SENSITIVITY: 0.002,
  ZOOM_SPEED: 0.1,
  MIN_ZOOM: 2.0,
  MAX_ZOOM: 20.0,
} as const;

// === NETWORKING ===
export const NETWORK_CONSTANTS = {
  UPDATE_RATE: 20, // 20 Hz
  INTERPOLATION_DELAY: 100, // milliseconds
  MAX_PACKET_SIZE: 1024,
  POSITION_SYNC_THRESHOLD: 0.1,
  ROTATION_SYNC_THRESHOLD: 0.1,
} as const;

// === TESTING ===
export const TEST_CONSTANTS = {
  TEST_CUBE_SIZE: 1.0,
  TEST_TIMEOUT: 30000, // 30 seconds
  VISUAL_TEST_COLORS: {
    PLAYER: 0x0000ff, // Blue
    GOBLIN: 0x00ff00, // Green
    ITEM: 0xffff00, // Yellow
    CORPSE: 0xff0000, // Red
    BANK: 0xff00ff, // Magenta
    STORE: 0x00ffff, // Cyan
    RESOURCE: 0x008000, // Dark Green
    TEST_CUBE: 0xff4500, // Orange Red
  },
  SCREENSHOT_DELAY: 1000, // 1 second between screenshots
  MAX_TEST_DURATION: 300000, // 5 minutes
} as const;

// === ITEM TYPES AND IDS ===
export const ITEM_IDS = {
  // Weapons
  BRONZE_SWORD: 1,
  STEEL_SWORD: 2,
  MITHRIL_SWORD: 3,
  WOOD_BOW: 4,
  OAK_BOW: 5,
  WILLOW_BOW: 6,

  // Shields
  BRONZE_SHIELD: 10,
  STEEL_SHIELD: 11,
  MITHRIL_SHIELD: 12,

  // Armor
  LEATHER_HELMET: 20,
  LEATHER_BODY: 21,
  LEATHER_LEGS: 22,
  BRONZE_HELMET: 23,
  BRONZE_BODY: 24,
  BRONZE_LEGS: 25,

  // Tools
  BRONZE_HATCHET: 30,
  FISHING_ROD: 31,
  TINDERBOX: 32,

  // Resources
  LOGS: 40,
  RAW_FISH: 41,
  COOKED_FISH: 42,
  BURNT_FISH: 43,
  ARROWS: 44,

  // Currency
  COINS: 100,
} as const;

// Mapping from numeric IDs to string item keys
export const ITEM_ID_TO_KEY: Record<number, string> = {
  // Weapons
  [ITEM_IDS.BRONZE_SWORD]: "bronze_sword",
  [ITEM_IDS.STEEL_SWORD]: "steel_sword",
  [ITEM_IDS.MITHRIL_SWORD]: "mithril_sword",
  [ITEM_IDS.WOOD_BOW]: "wood_bow",
  [ITEM_IDS.OAK_BOW]: "oak_bow",
  [ITEM_IDS.WILLOW_BOW]: "willow_bow",

  // Shields
  [ITEM_IDS.BRONZE_SHIELD]: "bronze_shield",
  [ITEM_IDS.STEEL_SHIELD]: "steel_shield",
  [ITEM_IDS.MITHRIL_SHIELD]: "mithril_shield",

  // Armor
  [ITEM_IDS.LEATHER_HELMET]: "leather_helmet",
  [ITEM_IDS.LEATHER_BODY]: "leather_body",
  [ITEM_IDS.LEATHER_LEGS]: "leather_legs",
  [ITEM_IDS.BRONZE_HELMET]: "bronze_helmet",
  [ITEM_IDS.BRONZE_BODY]: "bronze_body",
  [ITEM_IDS.BRONZE_LEGS]: "bronze_legs",

  // Tools
  [ITEM_IDS.BRONZE_HATCHET]: "bronze_hatchet",
  [ITEM_IDS.FISHING_ROD]: "fishing_rod",
  [ITEM_IDS.TINDERBOX]: "tinderbox",

  // Resources
  [ITEM_IDS.LOGS]: "logs",
  [ITEM_IDS.RAW_FISH]: "raw_fish",
  [ITEM_IDS.COOKED_FISH]: "cooked_fish",
  [ITEM_IDS.BURNT_FISH]: "burnt_fish",
  [ITEM_IDS.ARROWS]: "arrows",

  // Currency
  [ITEM_IDS.COINS]: "coins",
} as const;

// === MOB TYPES ===
// Mob types are now loaded dynamically from world/assets/manifests/mobs.json
// Use getAllMobs() from data/mobs.ts to get available mob types at runtime
export const MOB_TYPES = {} as const;

// === BIOME TYPES ===
// Deprecated: use BiomeType enum (re-exported above) instead.
// Kept for backward compat; maps to the same string values.
import { BiomeType as _BT } from "../systems/shared/world/TerrainBiomeTypes";
export const BIOME_TYPES = {
  TUNDRA: _BT.Tundra,
  FOREST: _BT.Forest,
  CANYON: _BT.Canyon,
} as const;

// === SKILL NAMES ===
// All skills matching the Skills interface in entity-types.ts
export const SKILLS = {
  // Combat skills
  ATTACK: "attack",
  STRENGTH: "strength",
  DEFENSE: "defense",
  CONSTITUTION: "constitution",
  RANGED: "ranged",
  MAGIC: "magic",
  PRAYER: "prayer",
  // Gathering skills
  WOODCUTTING: "woodcutting",
  MINING: "mining",
  FISHING: "fishing",
  // Production skills
  FIREMAKING: "firemaking",
  COOKING: "cooking",
  SMITHING: "smithing",
  AGILITY: "agility",
} as const;

// === EQUIPMENT SLOTS ===
export const EQUIPMENT_SLOTS = {
  WEAPON: "weapon",
  SHIELD: "shield",
  HELMET: "helmet",
  BODY: "body",
  LEGS: "legs",
  ARROWS: "arrows",
} as const;

// === ATTACK STYLES ===
export const ATTACK_STYLES = {
  AGGRESSIVE: "aggressive", // +3 STR XP per damage
  CONTROLLED: "controlled", // +1 ATK, +1 STR, +1 DEF XP per damage
  DEFENSIVE: "defensive", // +3 DEF XP per damage
  ACCURATE: "accurate", // +3 ATK XP per damage
} as const;

// === WORLD AREAS (for content loading) ===
export const WORLD_AREAS = {
  CENTRAL_HAVEN: "central_haven",
  VARROCK: "varrock",
  FALADOR: "falador",
  WILDERNESS: "wilderness",
  BARBARIAN_VILLAGE: "barbarian_village",
} as const;

// === ERROR CODES ===
export const ERROR_CODES = {
  INVALID_PLAYER: "INVALID_PLAYER",
  INSUFFICIENT_ITEMS: "INSUFFICIENT_ITEMS",
  INVENTORY_FULL: "INVENTORY_FULL",
  INVALID_ACTION: "INVALID_ACTION",
  COMBAT_COOLDOWN: "COMBAT_COOLDOWN",
  OUT_OF_RANGE: "OUT_OF_RANGE",
  INSUFFICIENT_LEVEL: "INSUFFICIENT_LEVEL",
  SYSTEM_ERROR: "SYSTEM_ERROR",
} as const;

// === SUCCESS MESSAGES ===
export const SUCCESS_MESSAGES = {
  ITEM_PICKED_UP: "Item picked up successfully",
  COMBAT_STARTED: "Combat initiated",
  LEVEL_UP: "Congratulations! You have gained a level",
  QUEST_COMPLETED: "Quest completed",
  ITEM_EQUIPPED: "Item equipped",
  BANK_DEPOSIT: "Item deposited to bank",
} as const;

// Export all constants as a single object for easy importing
export const GAME_CONSTANTS = {
  INVENTORY: INVENTORY_CONSTANTS,
  PLAYER: PLAYER_CONSTANTS,
  COMBAT: COMBAT_CONSTANTS,
  HOME_TELEPORT: HOME_TELEPORT_CONSTANTS,
  XP: XP_CONSTANTS,
  WORLD: WORLD_CONSTANTS,
  TERRAIN: TERRAIN_CONSTANTS,
  DISTANCE: DISTANCE_CONSTANTS,
  GATHERING: GATHERING_CONSTANTS,
  MOB: MOB_CONSTANTS,
  UI: UI_CONSTANTS,
  PHYSICS: PHYSICS_CONSTANTS,
  CAMERA: CAMERA_CONSTANTS,
  NETWORK: NETWORK_CONSTANTS,
  TEST: TEST_CONSTANTS,
  ITEM_IDS,
  MOB_TYPES,
  BIOME_TYPES,
  SKILLS,
  EQUIPMENT_SLOTS,
  ATTACK_STYLES,
  WORLD_AREAS,
  ERROR_CODES,
  SUCCESS_MESSAGES,
} as const;
