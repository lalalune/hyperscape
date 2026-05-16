/**
 * Game Constants — MANIFEST FAÇADE
 *
 * As of Phase A9 of PLAN_WORLD_STUDIO_AAA_COMPLETION.md, the raw tuning
 * values previously hardcoded here live in `game-constants.json`,
 * validated at module load time against `GameManifestSchema` from
 * `@hyperforge/manifest-schema`.
 *
 * This TS file preserves the exact legacy export shape
 * (`GAME_CONSTANTS`, `INVENTORY_CONSTANTS`, `PLAYER_CONSTANTS`, …,
 * `ITEM_IDS`, `ITEM_ID_TO_KEY`, `computeDistanceFade`, etc.) so the
 * existing 50+ consumer files don't have to change.
 *
 * Derived / computed values (WATER_CUTOFF, *_SQ pre-squared distances,
 * MOB_RESPAWN_TIME, ITEM_ID_TO_KEY map) are built at module load from
 * the parsed manifest — same values as before, same export shape.
 *
 * Non-manifest values that live elsewhere:
 *   - COMBAT_CONSTANTS — CombatConstants.ts (extracted in A1)
 *   - GATHERING_CONSTANTS — GatheringConstants.ts (extracted in A3)
 *   - BANKING_CONSTANTS.MAX_BANK_SLOTS — BankingConstants.ts (A7)
 *   - HEALTH_BAR_DIMENSIONS — HealthBarRenderer (single source of truth)
 *   - BiomeId / DEFAULT_BIOME / BIOME_LIST — TerrainBiomeTypes
 */

import { GameManifestSchema } from "@hyperforge/manifest-schema";

import { HEALTH_BAR_DIMENSIONS } from "../utils/rendering/HealthBarRenderer";
import { BANKING_CONSTANTS } from "./BankingConstants";
import { COMBAT_CONSTANTS } from "./CombatConstants";
import { GATHERING_CONSTANTS } from "./GatheringConstants";
import gameManifestJson from "./game-constants.json" with { type: "json" };

// Re-exports preserved for backwards compat
export {
  DEFAULT_BIOME,
  BIOME_LIST,
} from "../systems/shared/world/TerrainBiomeTypes";
export { GATHERING_CONSTANTS };

const manifest = GameManifestSchema.parse(gameManifestJson);

// === INVENTORY AND ITEMS ===
export const INVENTORY_CONSTANTS = Object.freeze({
  MAX_INVENTORY_SLOTS: manifest.inventory.maxInventorySlots,
  MAX_BANK_SLOTS: BANKING_CONSTANTS.MAX_BANK_SLOTS, // Single source: BankingConstants.ts
  MAX_STACK_SIZE: manifest.inventory.maxStackSize,
  DEFAULT_ITEM_VALUE: manifest.inventory.defaultItemValue,
});

// === PLAYER STATS AND HEALTH ===
export const PLAYER_CONSTANTS = Object.freeze({
  DEFAULT_HEALTH: manifest.player.defaultHealth,
  DEFAULT_MAX_HEALTH: manifest.player.defaultMaxHealth,
  DEFAULT_STAMINA: manifest.player.defaultStamina,
  DEFAULT_MAX_STAMINA: manifest.player.defaultMaxStamina,
  BASE_MOVEMENT_SPEED: manifest.player.baseMovementSpeed,
  RUNNING_SPEED_MULTIPLIER: manifest.player.runningSpeedMultiplier,
  HEALTH_REGEN_RATE: manifest.player.healthRegenRate,
  STAMINA_REGEN_RATE: manifest.player.staminaRegenRate,
  STAMINA_DRAIN_RATE: manifest.player.staminaDrainRate,
});

// === HOME TELEPORT ===
export const HOME_TELEPORT_CONSTANTS = Object.freeze({
  /** Cooldown in milliseconds (30 seconds) */
  COOLDOWN_MS: manifest.homeTeleport.cooldownMs,
  /** Cast time in milliseconds (10 seconds - can be interrupted by movement/combat) */
  CAST_TIME_MS: manifest.homeTeleport.castTimeMs,
  /** Cast time in ticks (for server-side processing, 10s = ~17 ticks at 600ms/tick) */
  CAST_TIME_TICKS: manifest.homeTeleport.castTimeTicks,
});

// === EXPERIENCE AND LEVELING ===
export const XP_CONSTANTS = Object.freeze({
  BASE_XP_MULTIPLIER: manifest.xp.baseXpMultiplier,
  MAX_LEVEL: manifest.xp.maxLevel,
  XP_TABLE_LENGTH: manifest.xp.xpTableLength,
  DEFAULT_XP_GAIN: Object.freeze({
    COMBAT: manifest.xp.defaultXpGain.combat,
    WOODCUTTING: manifest.xp.defaultXpGain.woodcutting,
    FISHING: manifest.xp.defaultXpGain.fishing,
    FIREMAKING: manifest.xp.defaultXpGain.firemaking,
    COOKING: manifest.xp.defaultXpGain.cooking,
  }),
});

// === WORLD AND SPATIAL PARTITIONING ===
export const WORLD_CONSTANTS = Object.freeze({
  /** Spatial partition chunk size for entity registry (meters). */
  CHUNK_SIZE: manifest.world.chunkSize,
});

// === TERRAIN CONSTANTS ===
/**
 * Centralized terrain constants for water, slopes, and walkability.
 * SINGLE SOURCE OF TRUTH - all systems must import from here.
 *
 * IMPORTANT: TerrainSystem.CONFIG uses these values but has its own internal
 * CONFIG object for backwards compatibility. When changing values here,
 * ensure TerrainSystem.CONFIG is also updated.
 */
export const TERRAIN_CONSTANTS = Object.freeze({
  WATER_THRESHOLD: manifest.terrain.waterThreshold,
  WATER_EDGE_BUFFER: manifest.terrain.waterEdgeBuffer,
  MIN_VISIBLE_WATER_DEPTH: manifest.terrain.minVisibleWaterDepth,
  MAX_WALKABLE_SLOPE: manifest.terrain.maxWalkableSlope,
  SLOPE_CHECK_DISTANCE: manifest.terrain.slopeCheckDistance,
  TILE_SIZE: manifest.terrain.tileSize,
  TERRAIN_TILE_SIZE: manifest.terrain.terrainTileSize,
  /**
   * Pre-computed water threshold + buffer for vegetation checks.
   * Vegetation should not spawn below this level.
   */
  WATER_CUTOFF:
    manifest.terrain.waterThreshold + manifest.terrain.waterEdgeBuffer,
});

// === DISTANCE AND CULLING ===
/** Distance constants for render culling, LOD, and server simulation (meters) */
const _RENDER = manifest.distance.render;
const _SIM = manifest.distance.simulation;
const _LOD = manifest.distance.animationLod;
export const DISTANCE_CONSTANTS = Object.freeze({
  /** Client render distances (includes fade zone before cutoff) */
  RENDER: Object.freeze({
    MOB: _RENDER.mob,
    MOB_FADE_START: _RENDER.mobFadeStart,
    NPC: _RENDER.npc,
    NPC_FADE_START: _RENDER.npcFadeStart,
    PLAYER: _RENDER.player,
    PLAYER_FADE_START: _RENDER.playerFadeStart,
    ITEM: _RENDER.item,
    ITEM_FADE_START: _RENDER.itemFadeStart,
    VEGETATION: _RENDER.vegetation,
    TERRAIN: _RENDER.terrain,
  }),

  /** Server simulation distances (dormant beyond these) */
  SIMULATION: Object.freeze({
    ENTITY_UPDATE: _SIM.entityUpdate,
    NETWORK_BROADCAST: _SIM.networkBroadcast,
    AI_ACTIVE: _SIM.aiActive,
    AI_DORMANT: _SIM.aiDormant,
    CHUNK_ACTIVE: _SIM.chunkActive,
    CHUNK_HYSTERESIS: _SIM.chunkHysteresis,
  }),

  /** Animation LOD tiers by distance */
  ANIMATION_LOD: Object.freeze({
    FULL: _LOD.full,
    HALF: _LOD.half,
    QUARTER: _LOD.quarter,
    FROZEN: _LOD.frozen,
    CULLED: _LOD.culled,
  }),

  /** Pre-computed squared distances for hot paths */
  RENDER_SQ: Object.freeze({
    MOB: _RENDER.mob * _RENDER.mob,
    MOB_FADE_START: _RENDER.mobFadeStart * _RENDER.mobFadeStart,
    NPC: _RENDER.npc * _RENDER.npc,
    NPC_FADE_START: _RENDER.npcFadeStart * _RENDER.npcFadeStart,
    PLAYER: _RENDER.player * _RENDER.player,
    PLAYER_FADE_START: _RENDER.playerFadeStart * _RENDER.playerFadeStart,
    ITEM: _RENDER.item * _RENDER.item,
    ITEM_FADE_START: _RENDER.itemFadeStart * _RENDER.itemFadeStart,
  }),

  SIMULATION_SQ: Object.freeze({
    ENTITY_UPDATE: _SIM.entityUpdate * _SIM.entityUpdate,
    NETWORK_BROADCAST: _SIM.networkBroadcast * _SIM.networkBroadcast,
    AI_ACTIVE: _SIM.aiActive * _SIM.aiActive,
    AI_DORMANT: _SIM.aiDormant * _SIM.aiDormant,
    CHUNK_ACTIVE: _SIM.chunkActive * _SIM.chunkActive,
  }),

  ANIMATION_LOD_SQ: Object.freeze({
    FULL: _LOD.full * _LOD.full,
    HALF: _LOD.half * _LOD.half,
    QUARTER: _LOD.quarter * _LOD.quarter,
    FROZEN: _LOD.frozen * _LOD.frozen,
    CULLED: _LOD.culled * _LOD.culled,
  }),
});

/**
 * Helper to compute fade alpha based on distance.
 * Returns 1.0 at fadeStart, 0.0 at maxDistance, linear interpolation between.
 */
export function computeDistanceFade(
  distanceSq: number,
  fadeStartSq: number,
  maxDistanceSq: number,
): number {
  if (distanceSq <= fadeStartSq) return 1.0;
  if (distanceSq >= maxDistanceSq) return 0.0;
  const t = (distanceSq - fadeStartSq) / (maxDistanceSq - fadeStartSq);
  return 1.0 - t;
}

// === MOB SYSTEM ===
// Mob stats (HP, damage, etc.) are loaded from world/assets/manifests/mobs.json.
// Only system-level constants here, no mob-specific data.
export const MOB_CONSTANTS = Object.freeze({
  SPAWN_RADIUS: manifest.mob.spawnRadius,
  MAX_MOBS_PER_AREA: manifest.mob.maxMobsPerArea,
  /** Max concurrent bandit-type mobs world-wide (matches manifest npc ids, e.g. bandit). */
  MAX_BANDIT_MOBS_WORLD: manifest.mob.maxBanditMobsWorld,
  /** Mob ids counted toward {@link MAX_BANDIT_MOBS_WORLD}. */
  BANDIT_MOB_IDS_FOR_GLOBAL_CAP: Object.freeze([
    ...manifest.mob.banditMobIdsForGlobalCap,
  ]),
  // Derived from tick-based constant for consistency (25 ticks * 600ms = 15000ms)
  MOB_RESPAWN_TIME:
    COMBAT_CONSTANTS.DEFAULTS.NPC.RESPAWN_TICKS *
    COMBAT_CONSTANTS.TICK_DURATION_MS,
});

// === UI AND VISUAL ===
export const UI_CONSTANTS = Object.freeze({
  // Health bar dimensions — from HealthBarRenderer (single source of truth)
  HEALTH_BAR_WIDTH: HEALTH_BAR_DIMENSIONS.WIDTH,
  HEALTH_BAR_HEIGHT: HEALTH_BAR_DIMENSIONS.HEIGHT,
  HEALTH_BAR_BORDER: HEALTH_BAR_DIMENSIONS.BORDER_WIDTH,
  HEALTH_SPRITE_SCALE: HEALTH_BAR_DIMENSIONS.SPRITE_SCALE,
  // Manifest-driven UI constants
  NAME_TAG_WIDTH: manifest.ui.nameTagWidth,
  NAME_TAG_HEIGHT: manifest.ui.nameTagHeight,
  UI_SCALE: manifest.ui.uiScale,
  SPRITE_SCALE: manifest.ui.spriteScale,
  HUD_UPDATE_RATE: manifest.ui.hudUpdateRate,
  CHAT_MESSAGE_TIMEOUT: manifest.ui.chatMessageTimeout,
});

// === classic MMORPG-STYLE CONTEXT MENU COLORS ===
export const CONTEXT_MENU_COLORS = Object.freeze({
  /** Item name color in context menus (classic MMORPG orange) */
  ITEM: manifest.contextMenuColors.item,
  /** NPC name color in context menus (classic MMORPG yellow) */
  NPC: manifest.contextMenuColors.npc,
  /** Object name color in context menus (classic MMORPG cyan) */
  OBJECT: manifest.contextMenuColors.object,
  /** Player name color in context menus */
  PLAYER: manifest.contextMenuColors.player,
});

// === PHYSICS AND MOVEMENT ===
export const PHYSICS_CONSTANTS = Object.freeze({
  GRAVITY: manifest.physics.gravity,
  CHARACTER_CAPSULE_RADIUS: manifest.physics.characterCapsuleRadius,
  CHARACTER_CAPSULE_HEIGHT: manifest.physics.characterCapsuleHeight,
  ITEM_BOX_SIZE: manifest.physics.itemBoxSize,
  COLLISION_MARGIN: manifest.physics.collisionMargin,
  GROUND_CHECK_DISTANCE: manifest.physics.groundCheckDistance,
  STEP_HEIGHT: manifest.physics.stepHeight,
});

// === CAMERA SYSTEM ===
export const CAMERA_CONSTANTS = Object.freeze({
  DEFAULT_CAM_HEIGHT: manifest.camera.defaultCamHeight,
  THIRD_PERSON_DISTANCE: manifest.camera.thirdPersonDistance,
  TOP_DOWN_DISTANCE: manifest.camera.topDownDistance,
  CAMERA_LERP_SPEED: manifest.camera.cameraLerpSpeed,
  MOUSE_SENSITIVITY: manifest.camera.mouseSensitivity,
  ZOOM_SPEED: manifest.camera.zoomSpeed,
  MIN_ZOOM: manifest.camera.minZoom,
  MAX_ZOOM: manifest.camera.maxZoom,
});

// === NETWORKING ===
export const NETWORK_CONSTANTS = Object.freeze({
  UPDATE_RATE: manifest.network.updateRate,
  INTERPOLATION_DELAY: manifest.network.interpolationDelay,
  MAX_PACKET_SIZE: manifest.network.maxPacketSize,
  POSITION_SYNC_THRESHOLD: manifest.network.positionSyncThreshold,
  ROTATION_SYNC_THRESHOLD: manifest.network.rotationSyncThreshold,
});

// === TESTING ===
export const TEST_CONSTANTS = Object.freeze({
  TEST_CUBE_SIZE: manifest.test.testCubeSize,
  TEST_TIMEOUT: manifest.test.testTimeout,
  VISUAL_TEST_COLORS: Object.freeze({
    PLAYER: manifest.test.visualTestColors.player,
    GOBLIN: manifest.test.visualTestColors.goblin,
    ITEM: manifest.test.visualTestColors.item,
    CORPSE: manifest.test.visualTestColors.corpse,
    BANK: manifest.test.visualTestColors.bank,
    STORE: manifest.test.visualTestColors.store,
    RESOURCE: manifest.test.visualTestColors.resource,
    TEST_CUBE: manifest.test.visualTestColors.testCube,
  }),
  SCREENSHOT_DELAY: manifest.test.screenshotDelay,
  MAX_TEST_DURATION: manifest.test.maxTestDuration,
});

// === ITEM TYPES AND IDS ===
/**
 * Legacy numeric id map. Built at module load from `manifest.itemIds` —
 * fails fast if any of the hardcoded keys below is missing from the JSON.
 * The canonical item data lives in items.json; this map is a
 * backwards-compat shim.
 */
const itemIdByKey: Record<string, number> = {};
for (const entry of manifest.itemIds) {
  itemIdByKey[entry.key] = entry.id;
}

function requireItemId(key: string): number {
  const id = itemIdByKey[key];
  if (id === undefined) {
    throw new Error(
      `GameConstants drift: manifest.itemIds missing required key "${key}"`,
    );
  }
  return id;
}

export const ITEM_IDS = Object.freeze({
  // Weapons
  BRONZE_SWORD: requireItemId("bronze_sword"),
  STEEL_SWORD: requireItemId("steel_sword"),
  MITHRIL_SWORD: requireItemId("mithril_sword"),
  WOOD_BOW: requireItemId("wood_bow"),
  OAK_BOW: requireItemId("oak_bow"),
  WILLOW_BOW: requireItemId("willow_bow"),

  // Shields
  BRONZE_SHIELD: requireItemId("bronze_shield"),
  STEEL_SHIELD: requireItemId("steel_shield"),
  MITHRIL_SHIELD: requireItemId("mithril_shield"),

  // Armor
  LEATHER_HELMET: requireItemId("leather_helmet"),
  LEATHER_BODY: requireItemId("leather_body"),
  LEATHER_LEGS: requireItemId("leather_legs"),
  BRONZE_HELMET: requireItemId("bronze_helmet"),
  BRONZE_BODY: requireItemId("bronze_body"),
  BRONZE_LEGS: requireItemId("bronze_legs"),

  // Tools
  BRONZE_HATCHET: requireItemId("bronze_hatchet"),
  FISHING_ROD: requireItemId("fishing_rod"),
  TINDERBOX: requireItemId("tinderbox"),

  // Resources
  LOGS: requireItemId("logs"),
  RAW_FISH: requireItemId("raw_fish"),
  COOKED_FISH: requireItemId("cooked_fish"),
  BURNT_FISH: requireItemId("burnt_fish"),
  ARROWS: requireItemId("arrows"),

  // Currency
  COINS: requireItemId("coins"),
});

// Mapping from numeric IDs to string item keys, built from the manifest
export const ITEM_ID_TO_KEY: Record<number, string> = (() => {
  const map: Record<number, string> = {};
  for (const entry of manifest.itemIds) {
    map[entry.id] = entry.key;
  }
  return Object.freeze(map);
})();

// === MOB TYPES ===
// Mob types are loaded dynamically from world/assets/manifests/mobs.json.
// Use getAllMobs() from data/mobs.ts to get available mob types at runtime.
export const MOB_TYPES = Object.freeze({} as const);

// === BIOME TYPES ===
// Deprecated: import BiomeId from TerrainBiomeTypes and use string
// literals directly. Kept here as a literal frozen map for callers
// that still reference BIOME_TYPES.TUNDRA / FOREST / CANYON.
export const BIOME_TYPES = Object.freeze({
  TUNDRA: "tundra",
  FOREST: "forest",
  CANYON: "canyon",
} as const);

// === SKILL NAMES ===
// All skills matching the Skills interface in entity-types.ts
export const SKILLS = Object.freeze({
  // Combat skills
  ATTACK: manifest.skills.attack,
  STRENGTH: manifest.skills.strength,
  DEFENSE: manifest.skills.defense,
  CONSTITUTION: manifest.skills.constitution,
  RANGED: manifest.skills.ranged,
  MAGIC: manifest.skills.magic,
  PRAYER: manifest.skills.prayer,
  // Gathering skills
  WOODCUTTING: manifest.skills.woodcutting,
  MINING: manifest.skills.mining,
  FISHING: manifest.skills.fishing,
  // Production skills
  FIREMAKING: manifest.skills.firemaking,
  COOKING: manifest.skills.cooking,
  SMITHING: manifest.skills.smithing,
  AGILITY: manifest.skills.agility,
});

// === EQUIPMENT SLOTS ===
export const EQUIPMENT_SLOTS = Object.freeze({
  WEAPON: manifest.equipmentSlots.weapon,
  SHIELD: manifest.equipmentSlots.shield,
  HELMET: manifest.equipmentSlots.helmet,
  BODY: manifest.equipmentSlots.body,
  LEGS: manifest.equipmentSlots.legs,
  ARROWS: manifest.equipmentSlots.arrows,
});

// === ATTACK STYLES ===
export const ATTACK_STYLES = Object.freeze({
  AGGRESSIVE: manifest.attackStyles.aggressive, // +3 STR XP per damage
  CONTROLLED: manifest.attackStyles.controlled, // +1 ATK, +1 STR, +1 DEF XP per damage
  DEFENSIVE: manifest.attackStyles.defensive, // +3 DEF XP per damage
  ACCURATE: manifest.attackStyles.accurate, // +3 ATK XP per damage
});

// === WORLD AREAS (for content loading) ===
export const WORLD_AREAS = Object.freeze({
  CENTRAL_HAVEN: manifest.worldAreas.centralHaven,
  VARROCK: manifest.worldAreas.varrock,
  FALADOR: manifest.worldAreas.falador,
  WILDERNESS: manifest.worldAreas.wilderness,
  BARBARIAN_VILLAGE: manifest.worldAreas.barbarianVillage,
});

// === ERROR CODES ===
export const ERROR_CODES = Object.freeze({
  INVALID_PLAYER: manifest.errorCodes.invalidPlayer,
  INSUFFICIENT_ITEMS: manifest.errorCodes.insufficientItems,
  INVENTORY_FULL: manifest.errorCodes.inventoryFull,
  INVALID_ACTION: manifest.errorCodes.invalidAction,
  COMBAT_COOLDOWN: manifest.errorCodes.combatCooldown,
  OUT_OF_RANGE: manifest.errorCodes.outOfRange,
  INSUFFICIENT_LEVEL: manifest.errorCodes.insufficientLevel,
  SYSTEM_ERROR: manifest.errorCodes.systemError,
});

// === SUCCESS MESSAGES ===
export const SUCCESS_MESSAGES = Object.freeze({
  ITEM_PICKED_UP: manifest.successMessages.itemPickedUp,
  COMBAT_STARTED: manifest.successMessages.combatStarted,
  LEVEL_UP: manifest.successMessages.levelUp,
  QUEST_COMPLETED: manifest.successMessages.questCompleted,
  ITEM_EQUIPPED: manifest.successMessages.itemEquipped,
  BANK_DEPOSIT: manifest.successMessages.bankDeposit,
});

// Export all constants as a single object for easy importing
export const GAME_CONSTANTS = Object.freeze({
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
});
