/**
 * Game Constants
 *
 * Centralized location for all game constants to eliminate magic numbers
 * and ensure consistency across the system.
 */

// Import COMBAT_CONSTANTS from dedicated file
import { COMBAT_CONSTANTS } from "./CombatConstants";

// === INVENTORY AND ITEMS ===
export const INVENTORY_CONSTANTS = {
  MAX_INVENTORY_SLOTS: 28,
  MAX_BANK_SLOTS: 100,
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
  HEALTH_REGEN_RATE: 1.0,
  STAMINA_REGEN_RATE: 2.0,
  STAMINA_DRAIN_RATE: 5.0,
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

// === WORLD AND TERRAIN ===
export const WORLD_CONSTANTS = {
  CHUNK_SIZE: 64,
  WORLD_SIZE: 512,
  TERRAIN_HEIGHT_SCALE: 20,
  SEA_LEVEL: 0,
  BIOME_TRANSITION_SMOOTHNESS: 0.1,
  RESOURCE_SPAWN_DENSITY: 0.1,
} as const;

// === RESOURCE GATHERING ===
export const GATHERING_CONSTANTS = {
  WOODCUTTING_BASE_TIME: 3000, // 3 seconds
  FISHING_BASE_TIME: 4000, // 4 seconds
  GATHER_RANGE: 2.0,
  RESOURCE_RESPAWN_TIME: 60000, // 1 minute
  SUCCESS_RATE_BASE: 0.8,
  LEVEL_SUCCESS_BONUS: 0.01, // 1% per level
} as const;

// === MOB SYSTEM ===
// Mob stats (HP, damage, etc.) are loaded from world/assets/manifests/mobs.json
// Only system-level constants here, no mob-specific data
export const MOB_CONSTANTS = {
  SPAWN_RADIUS: 20,
  MAX_MOBS_PER_AREA: 10,
  MOB_RESPAWN_TIME: 30000, // 30 seconds
  AI_UPDATE_INTERVAL: 1000, // 1 second
  PATHFINDING_UPDATE_RATE: 500, // 0.5 seconds
} as const;

// === UI AND VISUAL ===
export const UI_CONSTANTS = {
  HEALTH_BAR_WIDTH: 50,
  HEALTH_BAR_HEIGHT: 5,
  NAME_TAG_WIDTH: 200,
  NAME_TAG_HEIGHT: 25,
  UI_SCALE: 0.1, // Canvas to world scale
  SPRITE_SCALE: 0.1,
  HEALTH_SPRITE_SCALE: 0.05,
  HUD_UPDATE_RATE: 100, // 10 FPS for UI updates
  CHAT_MESSAGE_TIMEOUT: 5000, // 5 seconds
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
  ARROWS: 43,

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
  [ITEM_IDS.ARROWS]: "arrows",

  // Currency
  [ITEM_IDS.COINS]: "coins",
} as const;

// === MOB TYPES ===
// Mob types are now loaded dynamically from world/assets/manifests/mobs.json
// Use getAllMobs() from data/mobs.ts to get available mob types at runtime
export const MOB_TYPES = {} as const;

// === BIOME TYPES ===
export const BIOME_TYPES = {
  PLAINS: "plains",
  FOREST: "forest",
  VALLEY: "valley",
  MOUNTAINS: "mountains",
  TUNDRA: "tundra",
  DESERT: "desert",
  LAKES: "lakes",
  SWAMP: "swamp",
} as const;

// === SKILL NAMES ===
export const SKILLS = {
  ATTACK: "attack",
  STRENGTH: "strength",
  DEFENSE: "defense",
  CONSTITUTION: "constitution",
  RANGE: "range",
  WOODCUTTING: "woodcutting",
  FISHING: "fishing",
  FIREMAKING: "firemaking",
  COOKING: "cooking",
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
  LUMBRIDGE: "lumbridge",
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
  XP: XP_CONSTANTS,
  WORLD: WORLD_CONSTANTS,
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
