/**
 * Data Manager - Centralized Content Database
 *
 * Provides a single point of access to all externalized data including:
 * - Items and equipment
 * - NPCs (categorized as: mob, boss, neutral, quest)
 * - World areas and spawn points
 * - Treasure locations
 * - Banks and stores
 * - Starting items and equipment requirements
 *
 * This system validates data on load and provides type-safe access methods.
 *
 * NPC Categories:
 * - mob: Combat NPCs (goblins, bandits, guards)
 * - boss: Powerful special combat encounters
 * - neutral: Non-combat NPCs (shopkeepers, bank clerks)
 * - quest: Quest-related NPCs (quest givers, quest objectives)
 */

import {
  FishingManifestSchema,
  MiningManifestSchema,
  WoodcuttingManifestSchema,
} from "@hyperforge/manifest-schema";
import { gatheringResources } from "../gathering/index.js";
import { npcDefinitionsRegistry } from "../npc-definitions/index.js";
import { BANKS, GENERAL_STORES } from "./banks-stores";
import { ITEMS } from "./items";
import { ALL_NPCS } from "./npcs";
import {
  getDefaultItemAttackRange,
  getDefaultNpcAttackSpeedTicks,
  getDefaultNpcCombatRange,
  getDefaultNpcLeashRange,
  getDefaultNpcRespawnTicks,
  getTickDurationMs,
} from "./live/combat-live";
import { generateAllNotedItems } from "./NoteGenerator";
import {
  ALL_WORLD_AREAS,
  STARTER_TOWNS,
  getMobSpawnsInArea,
  getNPCsInArea,
} from "./world-areas";
import {
  BIOMES,
  WorldJsonSpatialIndex,
  type WorldJson,
  type WorldJsonResource,
  type WorldJsonMobSpawn,
  type WorldJsonMine,
  type WorldJsonTree,
  type DangerSourceManifest,
  type WildernessBoundaryManifest,
  type BrushOverlaysManifest,
} from "./world-structure";
import { loadSkillUnlocks, type SkillUnlocksManifest } from "./skill-unlocks";
import {
  TierDataProvider,
  loadTierRequirements,
  type TierRequirementsManifest,
  type TierableItem,
} from "./TierDataProvider";
import {
  processingDataProvider,
  type CookingManifest,
  type FiremakingManifest,
  type SmeltingManifest,
  type SmithingManifest,
  type CraftingManifest,
  type TanningManifest,
  type FletchingManifest,
  type RunecraftingManifest,
} from "./ProcessingDataProvider";
import {
  stationDataProvider,
  type StationsManifest,
  type ModelBoundsManifest,
} from "./StationDataProvider";
import { prayerDataProvider, type PrayersManifest } from "./PrayerDataProvider";
import { dialogueConditionBindingsProvider } from "./DialogueConditionBindingsProvider";
import { combatTuningProvider } from "./CombatTuningProvider";
import { combatTuningAgentBindingsProvider } from "./CombatTuningAgentBindingsProvider";
import { xpCurvesProvider } from "./XpCurvesProvider";
import { achievementsProvider } from "./AchievementsProvider";
import { timeWeatherProvider } from "./TimeWeatherProvider";
import { accessibilityProvider } from "./AccessibilityProvider";
import { analyticsEventsProvider } from "./AnalyticsEventsProvider";
import { renderProfilesProvider } from "./RenderProfilesProvider";
import {
  renderProfileRegistry,
  postProcessVolumeCompositor,
} from "../rendering";
import { damageTypeRegistry } from "../damage-types";
import { xpCurveRegistry } from "../progression";
import { achievementEvaluator } from "../achievements";
import { npcScheduleRegistry } from "../npc-schedule";
import { cameraProfileRegistry } from "../camera";
import { audioBusMixer } from "../audio";
import { interactionPromptRegistry } from "../interaction-prompts";
import { chatChannelRegistry } from "../chat";
import { musicStateMachineRegistry } from "../music";
import { timeWeatherDriver } from "../time-weather";
import { factionsRegistry } from "../factions";
import { mountRegistry } from "../mounts";
import { petRegistry } from "../pet-companion";
import { statusEffectRegistry } from "../status-effects";
import { enchantmentRegistry } from "../enchantments";
import { titleRegistry } from "../titles";
import { leaderboardEngine } from "../leaderboards";
import { mailPolicyRegistry } from "../mail";
import { featureFlagRegistry } from "../feature-flags";
import { skyboxAtmosphereRegistry } from "../skybox-atmosphere";
import { physicsConfigRegistry } from "../physics-config";
import { voiceChatRegistry } from "../voice-chat";
import { storeFrontRegistry } from "../store-front";
import { commerceRegistry } from "../commerce";
import { hapticsRegistry } from "../haptics";
import { crashReporterRegistry } from "../crash-reporter";
import { worldEventsRegistry } from "../world-events";
import { housingRegistry } from "../housing";
import { tooltipRegistry } from "../tooltips";
import { screenshotRegistry } from "../screenshot";
import { partyGuildRegistry } from "../party-guild";
import { economyTuningRegistry } from "../economy-tuning";
import { loadingScreensRegistry } from "../loading-screens";
import { particleGraphRegistry } from "../particle-graph";
import { auctionHouseRegistry } from "../auction-house";
import { transmogRegistry } from "../transmog";
import { groupFinderRegistry } from "../group-finder";
import { tutorialFlowsRegistry } from "../tutorial-flows";
import { talentTreeRegistry } from "../talent-trees";
import { friendsSocialRegistry } from "../friends-social";
import { itemSetRegistry } from "../item-sets";
import { seasonRegistry } from "../seasons";
import { loadoutPolicyRegistry } from "../loadouts";
import { tradingRegistry } from "../trading";
import { moderationRegistry } from "../moderation";
import { newsFeedRegistry } from "../news-feed";
import { licenseAgreementsRegistry } from "../license-agreements";
import { pushNotificationsRegistry } from "../push-notifications";
import { parentalControlsRegistry } from "../parental-controls";
import { fastTravelGraph } from "../fast-travel";
import { respawnPolicyResolver } from "../respawn";
import { accessibilitySettings } from "../accessibility";
import { replicationRegistry } from "../replication";
import { prefabRegistry } from "../prefab";
import { lightingBakeRegistry } from "../lighting-bake";
import { inputActionsRegistry } from "../input-actions";
import { deployTargetsRegistry } from "../deploy-targets";
import { projectSettingsRegistry } from "../project-settings";
import { qualityPresetsRegistry } from "../quality-presets";
import { navMeshRegistry } from "../nav-mesh";
import { lodSettingsRegistry } from "../lod-settings";
import { sfxRegistry } from "../sfx";
import { vfxRegistry } from "../vfx";
import { vegetationRegistry } from "../vegetation";
import { animationRegistry } from "../animations";
import { biomesRegistry } from "../biomes";
import { storesRegistry } from "../stores";
import { skillUnlocksRegistry } from "../skill-unlocks";
import { cinematicRegistry } from "../cinematic";
import { editorSnapRegistry } from "../editor-snap";
import { mainMenuRegistry } from "../main-menu";
import { creditsRegistry } from "../credits";
import { serverBrowserRegistry } from "../server-browser";
import { spellVisualsRegistry } from "../spell-visuals";
import { matchmakingRegistry } from "../matchmaking-tuning";
import { skillIconsRegistry } from "../skill-icons";
import { profilerOverlayRegistry } from "../profiler";
import { levelStreamingRegistry } from "../level-streaming";
import { ammunitionRegistry } from "../ammunition";
import { arenaLayoutRegistry } from "../arena-layout";
import { avatarsRegistry } from "../avatars";
import { bankingRegistry } from "../banking";
import { buildingsRegistry } from "../buildings";
import { toolsRegistry } from "../tools";
import { treeCatalogRegistry } from "../trees";
import { weaponStylesRegistry } from "../weapon-styles";
import { npcSizesRegistry } from "../npc-sizes";
import { onboardingGoalsRegistry } from "../onboarding-goals";
import { playerEmotesRegistry } from "../player-emotes";
import { interactionConfigRegistry } from "../interaction";
import { smithingRegistry } from "../smithing";
import { processingRegistry } from "../processing";
import { worldAreasRegistry } from "../world-areas";
import { duelRulesRegistry } from "../duel";
import { keyPromptGlyphRegistry } from "../key-prompts";
import { equipmentManifestRegistry } from "../equipment-manifest";
import { analyticsEventRouter } from "../analytics";
import { damageTypesProvider } from "./DamageTypesProvider";
import { statusEffectsProvider } from "./StatusEffectsProvider";
import { cameraProfilesProvider } from "./CameraProfilesProvider";
import { audioBusMixProvider } from "./AudioBusMixProvider";
import { postProcessVolumesProvider } from "./PostProcessVolumesProvider";
import { npcScheduleProvider } from "./NpcScheduleProvider";
import { chatChannelsProvider } from "./ChatChannelsProvider";
import { interactionPromptsProvider } from "./InteractionPromptsProvider";
import { musicStateMachineProvider } from "./MusicStateMachineProvider";
import { saveDataProvider } from "./SaveDataProvider";
import { factionsProvider } from "./FactionsProvider";
import { mountsProvider } from "./MountsProvider";
import { voiceChatProvider } from "./VoiceChatProvider";
import { parentalControlsProvider } from "./ParentalControlsProvider";
import { tutorialFlowsProvider } from "./TutorialFlowsProvider";
import { hapticsProvider } from "./HapticsProvider";
import { physicsConfigProvider } from "./PhysicsConfigProvider";
import { featureFlagsProvider } from "./FeatureFlagsProvider";
import { crashReporterProvider } from "./CrashReporterProvider";
import { pushNotificationsProvider } from "./PushNotificationsProvider";
import { licenseAgreementsProvider } from "./LicenseAgreementsProvider";
import { newsFeedProvider } from "./NewsFeedProvider";
import { moderationProvider } from "./ModerationProvider";
import { fastTravelProvider } from "./FastTravelProvider";
import { respawnProvider } from "./RespawnProvider";
import { talentTreesProvider } from "./TalentTreesProvider";
import { auctionHouseProvider } from "./AuctionHouseProvider";
import { transmogProvider } from "./TransmogProvider";
import { housingProvider } from "./HousingProvider";
import { groupFinderProvider } from "./GroupFinderProvider";
import { friendsSocialProvider } from "./FriendsSocialProvider";
import { loadoutsProvider } from "./LoadoutsProvider";
import { tradingProvider } from "./TradingProvider";
import { itemSetsProvider } from "./ItemSetsProvider";
import { leaderboardsProvider } from "./LeaderboardsProvider";
import { titlesProvider } from "./TitlesProvider";
import { worldEventsProvider } from "./WorldEventsProvider";
import { seasonsProvider } from "./SeasonsProvider";
import { petCompanionProvider } from "./PetCompanionProvider";
import { enchantmentsProvider } from "./EnchantmentsProvider";
import { mailProvider } from "./MailProvider";
import { tooltipsProvider } from "./TooltipsProvider";
import { keyPromptIconsProvider } from "./KeyPromptIconsProvider";
import { screenshotProvider } from "./ScreenshotProvider";
import { partyGuildProvider } from "./PartyGuildProvider";
import { economyTuningProvider } from "./EconomyTuningProvider";
import { loadingScreensProvider } from "./LoadingScreensProvider";
import { skyboxAtmosphereProvider } from "./SkyboxAtmosphereProvider";
import { particleGraphProvider } from "./ParticleGraphProvider";
import { cinematicProvider } from "./CinematicProvider";
import { editorSnapProvider } from "./EditorSnapProvider";
import { deployTargetsProvider } from "./DeployTargetsProvider";
import { inputActionsProvider } from "./InputActionsProvider";
import { profilerOverlayProvider } from "./ProfilerOverlayProvider";
import { replicationProvider } from "./ReplicationProvider";
import { prefabProvider } from "./PrefabProvider";
import { levelStreamingProvider } from "./LevelStreamingProvider";
import { lightingBakeProvider } from "./LightingBakeProvider";
import { projectSettingsProvider } from "./ProjectSettingsProvider";
import { aiBehaviorProvider } from "./AIBehaviorProvider";
import { animationsProvider } from "./AnimationsProvider";
import { qualityPresetsProvider } from "./QualityPresetsProvider";
import { navMeshProvider } from "./NavMeshProvider";
import { lodSettingsProvider } from "./LODSettingsProvider";
import { soundEffectsProvider } from "./SoundEffectsProvider";
import { vfxProvider } from "./VfxProvider";
import { vegetationProvider } from "./VegetationProvider";
import { mainMenuProvider } from "./MainMenuProvider";
import { creditsProvider } from "./CreditsProvider";
import { musicProvider } from "./MusicProvider";
import { duelProvider } from "./DuelProvider";
import { duelArenasProvider } from "./DuelArenasProvider";
import { biomesProvider } from "./BiomesProvider";
import { storesProvider } from "./StoresProvider";
import { ammunitionProvider } from "./AmmunitionProvider";
import { arenaLayoutProvider } from "./ArenaLayoutProvider";
import { avatarsProvider } from "./AvatarsProvider";
import { bankingProvider } from "./BankingProvider";
import { buildingsProvider } from "./BuildingsProvider";
import { toolsProvider } from "./ToolsProvider";
import { treesProvider } from "./TreesProvider";
import { weaponStylesProvider } from "./WeaponStylesProvider";
import { npcSizesProvider } from "./NPCSizesProvider";
import { onboardingGoalsProvider } from "./OnboardingGoalsProvider";
import { skillIconsProvider } from "./SkillIconsProvider";
import { playerEmotesProvider } from "./PlayerEmotesProvider";
import { skillUnlocksProvider } from "./SkillUnlocksProvider";
import { matchmakingTuningProvider } from "./MatchmakingTuningProvider";
import { spellVisualsProvider } from "./SpellVisualsProvider";
import { profilerProvider } from "./ProfilerProvider";
import { serverBrowserProvider } from "./ServerBrowserProvider";
import { storeFrontProvider } from "./StoreFrontProvider";
import { commerceProvider } from "./CommerceProvider";
import { interactionProvider } from "./InteractionProvider";
import { combatProvider } from "./CombatProvider";
import { equipmentProvider } from "./EquipmentProvider";
import { gameProvider } from "./GameProvider";
import { smithingProvider } from "./SmithingProvider";
import { worldStructureProvider } from "./WorldStructureProvider";
import { gatheringProvider } from "./GatheringProvider";
import { processingProvider } from "./ProcessingProvider";
import { woodcuttingProvider } from "./WoodcuttingProvider";
import { miningProvider } from "./MiningProvider";
import { fishingProvider } from "./FishingProvider";
import { combatSpellsProvider } from "./CombatSpellsProvider";
import { npcsProvider } from "./NpcsProvider";
import { questsProvider } from "./QuestsProvider";
import { worldAreasProvider } from "./WorldAreasProvider";
import { worldConfigProvider } from "./WorldConfigProvider";
import { lootTablesProvider } from "./LootTablesProvider";
import { mobLootTableMappingsProvider } from "./MobLootTableMappingsProvider";
import { dialogueProvider } from "./DialogueProvider";
import { npcDialogueBindingsProvider } from "./NpcDialogueBindingsProvider";
import { localizationProvider } from "./LocalizationProvider";
import { pluginRegistryProvider } from "./PluginRegistryProvider";

// Define constants from JSON data
const STARTING_ITEMS: Array<{ id: string }> = []; // Stub - data removed
const TREASURE_LOCATIONS: TreasureLocation[] = []; // Stub - data removed

// Core item category files required for startup-safe gameplay.
// If any of these are missing, DataManager falls back to legacy items.json.
const REQUIRED_ITEM_FILES = [
  "weapons",
  "tools",
  "resources",
  "food",
  "misc",
] as const;

// Optional categories: load when available, but do not fail startup if absent.
// Some CDN environments still serve only the core category set.
const OPTIONAL_ITEM_FILES = ["ammunition", "runes", "armor"] as const;

const ITEM_CATEGORY_FILES = [...REQUIRED_ITEM_FILES, ...OPTIONAL_ITEM_FILES];
const OPTIONAL_DATA_WARNINGS_ENABLED =
  process.env.DATA_OPTIONAL_MANIFEST_WARNINGS !== "false";
const getAllTreasureLocations = () => TREASURE_LOCATIONS;
const getTreasureLocationsByDifficulty = (_difficulty: number) =>
  TREASURE_LOCATIONS;

function warnOptionalData(message: string): void {
  if (!OPTIONAL_DATA_WARNINGS_ENABLED) return;
  console.warn(message);
}

/** Pre-computed road from World Studio staging manifest (roads.json) */
export interface PrecomputedRoad {
  id: string;
  path: Array<{ x: number; y: number; z: number }>;
  width: number;
  fromTownId: string;
  toTownId: string;
  isMainRoad: boolean;
}

function isObjectRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isBuildingsManifest(value: unknown): value is BuildingsManifest {
  if (!isObjectRecord(value)) return false;

  return (
    typeof value.version === "number" &&
    Array.isArray(value.towns) &&
    isObjectRecord(value.buildingTypes) &&
    isObjectRecord(value.sizeDefinitions)
  );
}

type BrowserDataWindow = Window & {
  __CDN_URL?: string;
  __ASSETS_URL?: string;
  /** When set, manifest fetches use this base URL instead of CDN + /manifests */
  __STAGING_MANIFESTS_URL?: string;
};

function getClientAssetsBaseUrl(): string {
  let cdnUrl =
    process.env.PUBLIC_CDN_URL || "http://localhost:5555/game-assets";

  if (typeof window !== "undefined") {
    const windowWithCdn = window as BrowserDataWindow;
    if (windowWithCdn.__ASSETS_URL) {
      cdnUrl = windowWithCdn.__ASSETS_URL;
    } else if (windowWithCdn.__CDN_URL) {
      cdnUrl = windowWithCdn.__CDN_URL;
    } else if (
      typeof import.meta !== "undefined" &&
      import.meta.env?.PUBLIC_CDN_URL
    ) {
      cdnUrl =
        import.meta.env.PUBLIC_CDN_URL || "http://localhost:5555/game-assets";
    }
  }

  if (
    typeof process !== "undefined" &&
    typeof process.env !== "undefined" &&
    process.env.PUBLIC_CDN_URL &&
    !cdnUrl.includes("localhost")
  ) {
    cdnUrl = process.env.PUBLIC_CDN_URL;
  }

  return cdnUrl;
}

/**
 * Check whether a staging URL is safe to fetch from.
 * Only https: and localhost origins are permitted.
 */
function isAllowedStagingUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    return parsed.protocol === "https:" || parsed.hostname === "localhost";
  } catch {
    return false;
  }
}

/**
 * Try to resolve a staging URL for the given production manifest URL.
 * Returns undefined if staging mode is not active or the URL doesn't match.
 */
function tryResolveStagingUrl(productionUrl: string): string | undefined {
  if (typeof window === "undefined") return undefined;
  const stagingBase = (window as BrowserDataWindow).__STAGING_MANIFESTS_URL;
  if (!stagingBase) return undefined;

  // Extract the filename after /manifests/ and prepend staging base
  const manifestsIndex = productionUrl.lastIndexOf("/manifests/");
  if (manifestsIndex === -1) return undefined;

  const filename = productionUrl.slice(manifestsIndex + "/manifests/".length);
  const stagingUrl = `${stagingBase}/${filename}`;

  // Only allow https: or localhost staging URLs to prevent SSRF
  if (!isAllowedStagingUrl(stagingUrl)) {
    console.warn(
      `[DataManager] Rejected staging URL with disallowed origin: ${stagingUrl}`,
    );
    return undefined;
  }

  return stagingUrl;
}

/** Staging diagnostic counters — tracks how many manifests came from staging vs production */
const stagingDiag = { staging: 0, production: 0 };

async function fetchRequiredJson<T>(url: string, label: string): Promise<T> {
  // In staging mode, try the staging URL first, fall back to production
  const stagingUrl = tryResolveStagingUrl(url);
  if (stagingUrl) {
    try {
      const stagingResponse = await fetch(stagingUrl);
      if (stagingResponse.ok) {
        const ct = stagingResponse.headers.get("content-type") || "";
        if (ct.includes("application/json")) {
          console.log(`[DataManager] Loaded ${label} from staging`);
          stagingDiag.staging++;
          return (await stagingResponse.json()) as T;
        }
        console.warn(
          `[DataManager] Staging ${label} returned non-JSON (${ct}), using production`,
        );
      } else {
        console.warn(
          `[DataManager] Staging ${label} not found (${stagingResponse.status}), using production`,
        );
      }
    } catch {
      // Staging unavailable, fall through to production
    }
    stagingDiag.production++;
  }

  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`${label} failed with HTTP ${response.status}`);
  }

  const contentType = response.headers.get("content-type") || "";
  if (!contentType.includes("application/json")) {
    throw new Error(
      `${label} returned unexpected content-type: ${contentType}`,
    );
  }

  return (await response.json()) as T;
}

async function fetchOptionalJson<T>(
  url: string,
  label: string,
): Promise<T | null> {
  // In staging mode, try the staging URL first, fall back to production
  const stagingUrl = tryResolveStagingUrl(url);
  if (stagingUrl) {
    try {
      const stagingResponse = await fetch(stagingUrl);
      if (stagingResponse.ok) {
        const ct = stagingResponse.headers.get("content-type") || "";
        if (ct.includes("application/json")) {
          console.log(`[DataManager] Loaded ${label} from staging`);
          stagingDiag.staging++;
          return (await stagingResponse.json()) as T;
        }
        console.warn(
          `[DataManager] Staging ${label} returned non-JSON (${ct}), using production`,
        );
      } else {
        console.warn(
          `[DataManager] Staging ${label} not found (${stagingResponse.status}), using production`,
        );
      }
    } catch {
      // Staging unavailable, fall through to production
    }
    stagingDiag.production++;
  }

  const response = await fetch(url);
  if (!response.ok) {
    return null;
  }

  const contentType = response.headers.get("content-type") || "";
  if (!contentType.includes("application/json")) {
    throw new Error(
      `${label} returned unexpected content-type: ${contentType}`,
    );
  }

  return (await response.json()) as T;
}

const NPC_MODEL_ARCHETYPES: Record<NPCModelArchetype, string> = {
  // Use GLB version (323KB) instead of VRM (8.7MB) to avoid base64 buffer parsing issues
  goblin: "asset://models/goblin/goblin_rigged.glb",
  // TEMP: Use non-optimized VRM to test humanoid.update issue
  human: "asset://avatars/avatar-male-01.vrm",
  thug: "asset://avatars/avatar-male-01.vrm",
  troll: "asset://avatars/avatar-male-01.vrm",
  imp: "asset://models/goblin/goblin_rigged.glb",
};

import type {
  Item,
  NPCData,
  NPCDataInput,
  NPCCategory,
  NPCModelArchetype,
  LevelRange,
  TreasureLocation,
  StoreData,
  BiomeData,
} from "../types/core/core";
import type { DataValidationResult } from "../types/core/validation-types";
import type { MobSpawnPoint, NPCLocation, WorldArea } from "./world-areas";
import { WeaponType, EquipmentSlotName, AttackType } from "../types/core/core";
import type {
  WorldConfigManifest,
  BuildingsManifest,
} from "../types/world/world-types";

/**
 * Gathering Tool Data - derived from items.json where item.tool is defined
 * Defines tool properties for gathering skills (woodcutting, mining, fishing)
 *
 * classic MMORPG Mechanics:
 * - Woodcutting: tier used for success rate lookup, roll frequency is fixed (4 ticks)
 * - Mining: rollTicks defines time between attempts, success is level-only
 * - Fishing: equipment doesn't affect speed or success
 */
export interface GatheringToolData {
  /** Item ID matching inventory items (e.g., "bronze_hatchet") */
  itemId: string;
  /** Gathering skill this tool is used for */
  skill: "woodcutting" | "mining" | "fishing";
  /** Metal tier for success rate lookup (e.g., "bronze", "dragon") */
  tier: string;
  /** Skill level required to use this tool (derived from tier or explicit) */
  levelRequired: number;
  /** For mining: ticks between roll attempts (tile-based-MMORPG-accurate) */
  rollTicks?: number;
  /**
   * For mining (dragon/crystal pickaxe): Chance for bonus speed roll.
   * classic MMORPG: Dragon has 1/6 (0.167), Crystal has 1/4 (0.25) chance for 2-tick roll.
   */
  bonusTickChance?: number;
  /**
   * For mining (dragon/crystal pickaxe): Tick count when bonus triggers.
   * classic MMORPG: Both use 2 ticks when bonus triggers (vs normal 3).
   */
  bonusRollTicks?: number;
  /** Priority for best tool selection (lower = better, 1 = best) */
  priority: number;
}

/**
 * Tool data embedded in items.json
 */
export interface ItemToolData {
  skill: "woodcutting" | "mining" | "fishing";
  priority: number;
  rollTicks?: number;
}

/**
 * External Resource Data - loaded from gathering/*.json manifests
 * Used by ResourceSystem for trees, ores, and fishing spots.
 */
export interface ExternalResourceData {
  id: string;
  name: string;
  type: string;
  examine?: string;
  modelPath: string | null;
  /** LOD1 model path for medium distance rendering */
  lod1ModelPath?: string | null;
  /** LOD2 model path for far distance rendering */
  lod2ModelPath?: string | null;
  depletedModelPath: string | null;
  /**
   * Procgen preset name for procedural tree generation.
   * Maps to @hyperforge/procgen presets (e.g., "blackOak", "weepingWillow").
   * If specified, runtime procedural generation will be used instead of GLB model.
   */
  procgenPreset?: string;
  /** Multiple GLB model paths for visual variation (hash-picked per instance) */
  modelVariants?: string[];
  scale: number;
  depletedScale: number;
  harvestSkill: string;
  toolRequired: string | null;
  /** Secondary consumable required (e.g., "fishing_bait", "feathers") */
  secondaryRequired?: string;
  levelRequired: number;
  baseCycleTicks: number;
  depleteChance: number;
  respawnTicks: number;
  harvestYield: Array<{
    itemId: string;
    itemName: string;
    quantity: number;
    chance: number;
    xpAmount: number;
    stackable: boolean;
    /** Level required to catch this specific fish (tile-based-MMORPG-accurate) */
    levelRequired?: number;
    /** classic MMORPG catch rate at level 1 (x/256) - for priority rolling */
    catchLow?: number;
    /** classic MMORPG catch rate at level 99 (x/256) - for priority rolling */
    catchHigh?: number;
  }>;
}

/**
 * Woodcutting manifest structure - gathering/woodcutting.json
 */
export interface WoodcuttingManifest {
  trees: ExternalResourceData[];
}

/**
 * Mining manifest structure - gathering/mining.json
 */
export interface MiningManifest {
  rocks: ExternalResourceData[];
}

/**
 * Fishing manifest structure - gathering/fishing.json
 */
export interface FishingManifest {
  spots: ExternalResourceData[];
}

/**
 * Centralized Data Manager
 */
export class DataManager {
  private static instance: DataManager;
  private isInitialized = false;
  private validationResult: DataValidationResult | null = null;
  private worldAssetsDir: string | null = null;
  private static worldConfig: WorldConfigManifest | null = null;
  private static buildingsManifest: BuildingsManifest | null = null;
  private static roadsManifest: PrecomputedRoad[] | null = null;
  private static worldJson: WorldJson | null = null;
  private static worldJsonIndex: WorldJsonSpatialIndex | null = null;
  private static dangerSources: DangerSourceManifest[] | null = null;
  private static wildernessBoundary: WildernessBoundaryManifest | null = null;
  private static brushOverlays: BrushOverlaysManifest | null = null;

  private constructor() {
    // Private constructor for singleton pattern
  }

  /**
   * Get the loaded world configuration manifest
   * Returns null if not yet loaded
   */
  public static getWorldConfig(): WorldConfigManifest | null {
    return DataManager.worldConfig;
  }

  /**
   * Set the world configuration (for testing or runtime updates)
   */
  public static setWorldConfig(config: WorldConfigManifest): void {
    DataManager.worldConfig = config;
  }

  /**
   * Get the loaded buildings manifest
   * Returns null if not yet loaded
   */
  public static getBuildingsManifest(): BuildingsManifest | null {
    return DataManager.buildingsManifest;
  }

  /**
   * Set the buildings manifest (for testing or runtime updates)
   */
  public static setBuildingsManifest(manifest: BuildingsManifest): void {
    DataManager.buildingsManifest = manifest;
  }

  /**
   * Get pre-computed road network (from World Studio staging)
   * Returns null if not available (game will generate roads procedurally)
   */
  public static getRoadsManifest(): PrecomputedRoad[] | null {
    return DataManager.roadsManifest;
  }

  /** Whether world.json was loaded (World Studio entity placements available) */
  public static hasWorldJson(): boolean {
    return DataManager.worldJsonIndex !== null;
  }

  /** Get the full world.json data */
  public static getWorldJson(): WorldJson | null {
    return DataManager.worldJson;
  }

  /**
   * Hot-reload world.json data and rebuild spatial index.
   * Used by the deploy route to update in-memory manifest data without
   * restarting the server.
   */
  public static reloadWorldJson(worldJsonData: WorldJson): void {
    DataManager.worldJson = worldJsonData;
    if (worldJsonData?.entities) {
      const tileSize =
        worldJsonData.metadata?.tileSize ??
        DataManager.worldConfig?.terrain?.tileSize ??
        100;
      DataManager.worldJsonIndex = new WorldJsonSpatialIndex(
        worldJsonData,
        tileSize,
      );
      const treeInfo = DataManager.worldJsonIndex.hasManifestTrees()
        ? `, ${worldJsonData.entities.trees?.length ?? 0} trees`
        : "";
      console.log(
        `[DataManager] Hot-reloaded world.json: ${worldJsonData.entities.resources.length} resources, ` +
          `${worldJsonData.entities.mobSpawns.length} mob spawns${treeInfo}`,
      );
    } else {
      DataManager.worldJson = null;
      DataManager.worldJsonIndex = null;
      console.log("[DataManager] Cleared world.json (no entity data)");
    }
  }

  /** Get World Studio resources placed in a specific terrain tile */
  public static getWorldJsonResourcesInTile(
    tileX: number,
    tileZ: number,
  ): WorldJsonResource[] {
    return DataManager.worldJsonIndex?.getResourcesInTile(tileX, tileZ) ?? [];
  }

  /** Get World Studio mob spawns placed in a specific terrain tile */
  public static getWorldJsonMobSpawnsInTile(
    tileX: number,
    tileZ: number,
  ): WorldJsonMobSpawn[] {
    return DataManager.worldJsonIndex?.getMobSpawnsInTile(tileX, tileZ) ?? [];
  }

  /** Get all mine areas from World Studio */
  public static getWorldJsonMines(): WorldJsonMine[] {
    return DataManager.worldJsonIndex?.getMines() ?? [];
  }

  /** Get pre-filtered manifest trees for a specific terrain tile */
  public static getWorldJsonTreesInTile(
    tileX: number,
    tileZ: number,
  ): WorldJsonTree[] {
    return DataManager.worldJsonIndex?.getTreesInTile(tileX, tileZ) ?? [];
  }

  /** True when world.json includes pre-filtered tree data from World Studio */
  public static hasManifestTrees(): boolean {
    return DataManager.worldJsonIndex?.hasManifestTrees() ?? false;
  }

  /** Get danger sources from World Studio (danger-sources.json) */
  public static getDangerSources(): DangerSourceManifest[] | null {
    return DataManager.dangerSources;
  }

  /** Get wilderness boundary from World Studio (wilderness-boundary.json) */
  public static getWildernessBoundary(): WildernessBoundaryManifest | null {
    return DataManager.wildernessBoundary;
  }

  /** Get brush overlays from World Studio (brush-overlays.json) */
  public static getBrushOverlays(): BrushOverlaysManifest | null {
    return DataManager.brushOverlays;
  }

  /**
   * Set/hot-reload brush overlays (terrain sculpt + biome paint strokes).
   * Called by deploy route on staging push for live reload.
   */
  public static setBrushOverlays(overlays: BrushOverlaysManifest | null): void {
    DataManager.brushOverlays = overlays;
    if (overlays) {
      console.log(
        `[DataManager] Loaded brush overlays: ${overlays.terrainSculpts?.length ?? 0} sculpts, ${overlays.biomePaints?.length ?? 0} biome paints`,
      );
    }
  }

  /**
   * Get the singleton instance
   */
  public static getInstance(): DataManager {
    if (!DataManager.instance) {
      DataManager.instance = new DataManager();
    }
    return DataManager.instance;
  }

  /**
   * Load manifests from CDN (client) or filesystem (server)
   */
  private async loadManifestsFromCDN(): Promise<void> {
    // On server (Node.js or Bun), load from filesystem since HTTP server isn't up yet
    // Check for runtime-specific globals that don't exist in browsers
    const isServer =
      typeof process !== "undefined" &&
      process.versions !== undefined &&
      (process.versions.node !== undefined ||
        (process.versions as { bun?: string }).bun !== undefined);

    if (isServer) {
      // Phase B2 (final cut) of the AAA gap audit. The
      // `HYPERFORGE_DISABLE_ENGINE_DATA_LOAD=1` env flag tells
      // DataManager to skip its boot-time Hyperia load. The
      // `@hyperforge/hyperscape` plugin's `onEnable` populates the
      // same registries when (and only when) the project installs
      // the plugin — so blank projects ship with truly empty
      // worldAreas / npcDefinitions / biomes registries.
      //
      // Default behavior (flag unset) keeps the legacy boot-load
      // path so existing deployments continue working with no
      // change. Flip this on the prod server once every project
      // resolves through the typed `plugins` column.
      if (
        typeof process !== "undefined" &&
        process.env?.HYPERFORGE_DISABLE_ENGINE_DATA_LOAD === "1"
      ) {
        // eslint-disable-next-line no-console
        console.info(
          "[DataManager] HYPERFORGE_DISABLE_ENGINE_DATA_LOAD=1 — skipping engine-side Hyperia manifest load. Plugin onEnable owns registry population.",
        );
        return;
      }
      await this.loadManifestsFromFilesystem();
      return;
    }

    // Client: Load from CDN (localhost:5555/game-assets in dev, R2/S3 in prod)
    // Staging mode is handled transparently by fetchRequiredJson/fetchOptionalJson:
    // they check __STAGING_MANIFESTS_URL first, fall back to production on 404.
    const cdnUrl = getClientAssetsBaseUrl();
    const baseUrl = `${cdnUrl}/manifests`;

    if (
      typeof window !== "undefined" &&
      (window as BrowserDataWindow).__STAGING_MANIFESTS_URL
    ) {
      console.log(
        `[DataManager] STAGING MODE active — staging manifests from ${(window as BrowserDataWindow).__STAGING_MANIFESTS_URL}, production fallback: ${baseUrl}`,
      );
    }

    // In test/CI environments, CDN might not be available - make loading non-fatal
    const isTestEnv =
      typeof process !== "undefined" &&
      typeof process.env !== "undefined" &&
      process.env.NODE_ENV === "test";

    try {
      // ── PHASE 1: Load tier-requirements + items (sequential dependency) ──
      // tier-requirements must load first because normalizeItem() uses tier data
      try {
        const tierReqManifest =
          await fetchRequiredJson<TierRequirementsManifest>(
            `${baseUrl}/tier-requirements.json`,
            "tier-requirements.json",
          );
        loadTierRequirements(tierReqManifest);
      } catch {
        console.warn(
          "[DataManager] tier-requirements.json not found, tier-based requirements unavailable",
        );
      }

      // Load items - prefer category files, fall back to legacy single-file manifest.
      let loadedFromDirectory = false;
      try {
        // Fetch all known category files in parallel.
        const responses = await Promise.all(
          ITEM_CATEGORY_FILES.map((file) =>
            fetch(`${baseUrl}/items/${file}.json`),
          ),
        );

        const missingRequired = REQUIRED_ITEM_FILES.filter((_, index) => {
          const response = responses[index];
          return !response || !response.ok;
        });

        // Only require core categories; optional categories can be absent.
        if (missingRequired.length === 0) {
          const seenIds = new Set<string>();

          for (let i = 0; i < ITEM_CATEGORY_FILES.length; i++) {
            const response = responses[i];
            const category = ITEM_CATEGORY_FILES[i];
            if (!response?.ok) {
              console.warn(
                `[DataManager] items/${category}.json not found on CDN, continuing without it`,
              );
              continue;
            }

            const items = (await response.json()) as Item[];
            for (const item of items) {
              if (seenIds.has(item.id)) {
                throw new Error(
                  `[DataManager] Duplicate item ID "${item.id}" in items/${category}.json`,
                );
              }
              seenIds.add(item.id);
              const normalized = this.normalizeItem(item);
              (ITEMS as Map<string, Item>).set(normalized.id, normalized);
            }
          }
          console.log(
            `[DataManager] Loaded ${seenIds.size} items from items/ directory`,
          );
          loadedFromDirectory = true;
        } else {
          console.warn(
            `[DataManager] Missing required CDN item categories (${missingRequired.join(", ")}), falling back to items.json`,
          );
        }
      } catch {
        // Directory loading failed - will fall back below
      }

      if (!loadedFromDirectory) {
        // Fallback: Load from single items.json (backwards compatibility)
        const itemsRes = await fetch(`${baseUrl}/items.json`);
        if (!itemsRes.ok) {
          throw new Error(
            `[DataManager] Failed to load items.json from CDN: HTTP ${itemsRes.status}`,
          );
        }
        const list = (await itemsRes.json()) as Array<Item>;
        for (const it of list) {
          const normalized = this.normalizeItem(it);
          (ITEMS as Map<string, Item>).set(normalized.id, normalized);
        }
      }

      // Generate noted variants for all eligible items
      // This auto-creates "{itemId}_noted" variants for tradeable, non-stackable items
      const itemsWithNotes = generateAllNotedItems(ITEMS);
      // Clear and repopulate ITEMS map with noted variants included
      (ITEMS as Map<string, Item>).clear();
      for (const [id, item] of itemsWithNotes) {
        (ITEMS as Map<string, Item>).set(id, item);
      }

      // ── PHASE 2: Load ALL remaining manifests in parallel ──
      // None of these depend on each other (except model-bounds → stations,
      // handled within the stations loader). Fire them all at once.
      const loadStart = performance.now();

      await Promise.allSettled([
        // NPCs
        (async () => {
          const npcList = await fetchRequiredJson<Array<NPCDataInput>>(
            `${baseUrl}/npcs.json`,
            "npcs.json",
          );
          const normalizedList: NPCData[] = [];
          for (const npc of npcList) {
            const normalized = this.normalizeNPC(npc);
            (ALL_NPCS as Map<string, NPCData>).set(normalized.id, normalized);
            normalizedList.push(normalized);
          }
          // Populate the runtime npcDefinitionsRegistry so the
          // registry-prefer branch in `getNPCById` is hit at runtime.
          // Without this, the registry stays empty in production and
          // every getNPCById falls through to the legacy ALL_NPCS map
          // forever — defeating the PIE-hot-reload path. Cast bridges
          // the in-tree NPCData to the schema-derived NpcDefinition;
          // shapes are structurally compatible (NPCData narrows
          // sub-objects further but we only ever read the wider shape).
          npcDefinitionsRegistry.load(
            normalizedList as unknown as Parameters<
              typeof npcDefinitionsRegistry.load
            >[0],
          );
        })(),

        // World areas
        (async () => {
          const worldAreasData = await fetchRequiredJson<{
            starterTowns: Record<string, WorldArea>;
            level1Areas: Record<string, WorldArea>;
            level2Areas: Record<string, WorldArea>;
            level3Areas: Record<string, WorldArea>;
            specialAreas?: Record<string, WorldArea>;
          }>(`${baseUrl}/world-areas.json`, "world-areas.json");
          Object.assign(
            ALL_WORLD_AREAS,
            worldAreasData.starterTowns,
            worldAreasData.level1Areas,
            worldAreasData.level2Areas,
            worldAreasData.level3Areas,
            worldAreasData.specialAreas || {},
          );
          Object.assign(STARTER_TOWNS, worldAreasData.starterTowns);
        })(),

        // Biomes
        (async () => {
          const biomeList = await fetchRequiredJson<Array<BiomeData>>(
            `${baseUrl}/biomes.json`,
            "biomes.json",
          );
          for (const biome of biomeList) {
            BIOMES[biome.id] = biome;
            // Also index by terrain type so lookups like BIOMES["forest"] work
            // even when IDs are generated (e.g. "biome-0" from World Studio).
            // First biome of each terrain type wins (matches production behavior).
            if (biome.terrain && !BIOMES[biome.terrain]) {
              BIOMES[biome.terrain] = biome;
            }
          }
        })(),

        // World config
        (async () => {
          try {
            const worldConfigData =
              await fetchOptionalJson<WorldConfigManifest>(
                `${baseUrl}/world-config.json`,
                "world-config.json",
              );
            if (worldConfigData) {
              DataManager.worldConfig = worldConfigData;
            }
          } catch {
            warnOptionalData(
              "[DataManager] world-config.json not found, using default world generation parameters",
            );
          }
        })(),

        // Buildings
        (async () => {
          DataManager.buildingsManifest = null;
          try {
            const buildingsData = await fetchOptionalJson<unknown>(
              `${baseUrl}/buildings.json`,
              "buildings.json",
            );
            if (buildingsData) {
              if (!isBuildingsManifest(buildingsData)) {
                throw new Error("Invalid buildings manifest shape");
              }
              DataManager.buildingsManifest = buildingsData;
              console.log(
                `[DataManager] Loaded buildings manifest: ${buildingsData.towns?.length ?? 0} pre-defined towns`,
              );
            }
          } catch (error) {
            warnOptionalData(
              `[DataManager] buildings.json missing or invalid, skipping pre-defined towns (${error instanceof Error ? error.message : "unknown error"})`,
            );
          }
        })(),

        // Roads (pre-computed from World Studio — optional)
        (async () => {
          DataManager.roadsManifest = null;
          try {
            const roadsData = await fetchOptionalJson<PrecomputedRoad[]>(
              `${baseUrl}/roads.json`,
              "roads.json",
            );
            if (roadsData && Array.isArray(roadsData) && roadsData.length > 0) {
              DataManager.roadsManifest = roadsData;
              console.log(
                `[DataManager] Loaded pre-computed roads: ${roadsData.length} roads`,
              );
            }
          } catch {
            // roads.json is optional — game generates roads procedurally if absent
          }
        })(),

        // world.json — entity placements from World Studio (optional)
        (async () => {
          DataManager.worldJson = null;
          DataManager.worldJsonIndex = null;
          try {
            const worldJsonData = await fetchOptionalJson<WorldJson>(
              `${baseUrl}/world.json`,
              "world.json",
            );
            if (worldJsonData?.entities) {
              DataManager.worldJson = worldJsonData;
              const tileSize =
                worldJsonData.metadata?.tileSize ??
                DataManager.worldConfig?.terrain?.tileSize ??
                100;
              DataManager.worldJsonIndex = new WorldJsonSpatialIndex(
                worldJsonData,
                tileSize,
              );
              const treeInfo = worldJsonData.entities.trees?.length
                ? `, ${worldJsonData.entities.trees.length} trees`
                : "";
              console.log(
                `[DataManager] Loaded world.json: ${worldJsonData.entities.resources.length} resources, ${worldJsonData.entities.mobSpawns.length} mob spawns${treeInfo}`,
              );
            }
          } catch {
            // world.json is optional — game uses procgen fallback if absent
          }
        })(),

        // danger-sources.json — World Studio danger zones (optional)
        (async () => {
          DataManager.dangerSources = null;
          try {
            const dangerData = await fetchOptionalJson<{
              sources: DangerSourceManifest[];
            }>(`${baseUrl}/danger-sources.json`, "danger-sources.json");
            if (dangerData?.sources && dangerData.sources.length > 0) {
              DataManager.dangerSources = dangerData.sources;
              console.log(
                `[DataManager] Loaded danger sources: ${dangerData.sources.length} sources`,
              );
            }
          } catch {
            // danger-sources.json is optional
          }
        })(),

        // wilderness-boundary.json — World Studio wilderness boundary (optional)
        (async () => {
          DataManager.wildernessBoundary = null;
          try {
            const boundary =
              await fetchOptionalJson<WildernessBoundaryManifest>(
                `${baseUrl}/wilderness-boundary.json`,
                "wilderness-boundary.json",
              );
            if (boundary?.points && boundary.points.length > 0) {
              DataManager.wildernessBoundary = boundary;
              console.log(
                `[DataManager] Loaded wilderness boundary: ${boundary.points.length} points`,
              );
            }
          } catch {
            // wilderness-boundary.json is optional
          }
        })(),

        // brush-overlays.json — terrain sculpt + biome paint strokes (optional)
        (async () => {
          DataManager.brushOverlays = null;
          try {
            const overlays = await fetchOptionalJson<BrushOverlaysManifest>(
              `${baseUrl}/brush-overlays.json`,
              "brush-overlays.json",
            );
            if (overlays?.terrainSculpts || overlays?.biomePaints) {
              DataManager.brushOverlays = overlays;
              console.log(
                `[DataManager] Loaded brush overlays: ${overlays.terrainSculpts?.length ?? 0} sculpts, ${overlays.biomePaints?.length ?? 0} biome paints`,
              );
            }
          } catch {
            // brush-overlays.json is optional — terrain uses pure procgen if absent
          }
        })(),

        // Stores
        (async () => {
          const storeList = await fetchRequiredJson<Array<StoreData>>(
            `${baseUrl}/stores.json`,
            "stores.json",
          );
          for (const store of storeList) {
            GENERAL_STORES[store.id] = store;
          }
        })(),

        // Skill unlocks
        (async () => {
          try {
            const skillUnlocksManifest =
              await fetchRequiredJson<SkillUnlocksManifest>(
                `${baseUrl}/skill-unlocks.json`,
                "skill-unlocks.json",
              );
            loadSkillUnlocks(skillUnlocksManifest);
          } catch {
            console.warn(
              "[DataManager] skill-unlocks.json not available from CDN, skill guide will be empty",
            );
          }
        })(),

        // Gathering manifests (3 fetches, internally parallel)
        this.loadGatheringManifestsFromCDN(baseUrl),

        // Recipe manifests (8 fetches + prayers + model-bounds + stations, internally parallel)
        this.loadRecipeManifestsFromCDN(baseUrl),
      ]);

      console.log(
        `[DataManager] Phase 2 parallel load completed in ${(performance.now() - loadStart).toFixed(0)}ms`,
      );

      // Build EXTERNAL_TOOLS from items where item.tool is defined
      // This replaces the old tools.json loading
      this.buildToolsFromItems();

      // Staging diagnostic summary
      if (
        typeof window !== "undefined" &&
        (window as BrowserDataWindow).__STAGING_MANIFESTS_URL &&
        (stagingDiag.staging > 0 || stagingDiag.production > 0)
      ) {
        console.log(
          `[DataManager] Staging: ${stagingDiag.staging} manifests from staging, ${stagingDiag.production} from production fallback`,
        );
      }
    } catch (error) {
      // In test/CI environments, CDN might not be available - this is non-fatal
      if (isTestEnv) {
        console.warn(
          "[DataManager] ⚠️  CDN not available in test environment - skipping manifest loading",
        );
        console.warn(
          "[DataManager] This is expected in CI/test - game data will use defaults",
        );
      } else {
        // In production/development, CDN should be available - log error and re-throw
        console.error(
          "[DataManager] ❌ Failed to load manifests from CDN:",
          error,
        );
        throw error;
      }
    }
  }

  /**
   * Load manifests from filesystem (server-side only)
   * Uses packages/server/world/assets/manifests/ directory
   */
  private async loadManifestsFromFilesystem(): Promise<void> {
    const fsModuleId = "node:fs/promises";
    const pathModuleId = "node:path";
    const fs = (await import(
      /* @vite-ignore */ fsModuleId
    )) as typeof import("node:fs/promises");
    const path = (await import(
      /* @vite-ignore */ pathModuleId
    )) as typeof import("node:path");

    // Check if we're in a TEST environment where manifests might not exist
    // NOTE: CI=true is often set by CI/CD platforms AND production deployments (Railway)
    // Only skip manifest loading for actual test environments, not production CI/CD
    const isTestEnv =
      typeof process !== "undefined" &&
      typeof process.env !== "undefined" &&
      (process.env.NODE_ENV === "test" || process.env.VITEST === "true");

    // Find manifests directory - assets are in packages/server/world/assets/
    // Resolve across multiple likely working directories to survive script/merge changes.
    const cwd = process.cwd();
    const candidateManifestsDirs: string[] = [];
    const pushCandidate = (dir: string | undefined): void => {
      if (!dir) return;
      const resolved = path.resolve(dir);
      if (!candidateManifestsDirs.includes(resolved)) {
        candidateManifestsDirs.push(resolved);
      }
    };

    if (process.env.ASSETS_DIR) {
      pushCandidate(path.join(process.env.ASSETS_DIR, "manifests"));
    }

    // Resolve robustly via __dirname to support hoisting in monorepos/CI
    const parts = __dirname.split(path.sep);
    const packagesIndex = parts.lastIndexOf("packages");

    if (packagesIndex !== -1) {
      const rootDir = parts.slice(0, packagesIndex + 1).join(path.sep);
      pushCandidate(
        path.join(rootDir, "server", "world", "assets", "manifests"),
      );
    }

    // Common execution roots as fallbacks:
    pushCandidate(path.join(cwd, "world", "assets", "manifests"));
    pushCandidate(
      path.join(cwd, "packages", "server", "world", "assets", "manifests"),
    );
    pushCandidate(path.resolve(cwd, "..", "world", "assets", "manifests"));
    pushCandidate(
      path.resolve(cwd, "..", "..", "world", "assets", "manifests"),
    );

    let manifestsDir =
      candidateManifestsDirs[0] ||
      path.resolve(cwd, "packages", "server", "world", "assets", "manifests");

    let foundManifestsDir = false;
    for (const candidate of candidateManifestsDirs) {
      try {
        await fs.access(candidate);
        manifestsDir = candidate;
        foundManifestsDir = true;
        break;
      } catch {
        // Try next candidate
      }
    }

    if (!candidateManifestsDirs.includes(manifestsDir)) {
      candidateManifestsDirs.push(manifestsDir);
    }

    if (!foundManifestsDir) {
      console.warn(
        `[DataManager] Could not verify manifests path from cwd=${cwd}. ` +
          `Tried: ${candidateManifestsDirs.join(", ")}. ` +
          `Proceeding with ${manifestsDir}. Set ASSETS_DIR to override.`,
      );
    }

    console.log(
      `[DataManager] Loading manifests from filesystem: ${manifestsDir}`,
    );

    try {
      // Load tier requirements FIRST - needed for normalizeItem to derive requirements from tier
      const tierReqPath = path.join(manifestsDir, "tier-requirements.json");
      try {
        const tierReqData = await fs.readFile(tierReqPath, "utf-8");
        const tierReqManifest = JSON.parse(
          tierReqData,
        ) as TierRequirementsManifest;
        loadTierRequirements(tierReqManifest);
      } catch {
        console.warn(
          "[DataManager] tier-requirements.json not found, tier-based requirements unavailable",
        );
      }

      // Load items - try directory first, fall back to single file
      const itemsDir = path.join(manifestsDir, "items");
      let loadedFromDirectory = false;

      try {
        await fs.access(itemsDir);
        // Directory exists - try to load from it (validates all required files)
        loadedFromDirectory = await this.loadItemsFromDirectory(
          fs,
          path,
          itemsDir,
        );
      } catch {
        // Directory doesn't exist - will fall back below
      }

      if (!loadedFromDirectory) {
        // Fallback: Load from single items.json (backwards compatibility)
        const itemsPath = path.join(manifestsDir, "items.json");
        const itemsData = await fs.readFile(itemsPath, "utf-8");
        const list = JSON.parse(itemsData) as Array<Item>;
        for (const it of list) {
          const normalized = this.normalizeItem(it);
          (ITEMS as Map<string, Item>).set(normalized.id, normalized);
        }
      }

      // Generate noted variants
      const itemsWithNotes = generateAllNotedItems(ITEMS);
      (ITEMS as Map<string, Item>).clear();
      for (const [id, item] of itemsWithNotes) {
        (ITEMS as Map<string, Item>).set(id, item);
      }

      // Load NPCs
      const npcsPath = path.join(manifestsDir, "npcs.json");
      const npcsData = await fs.readFile(npcsPath, "utf-8");
      const npcList = JSON.parse(npcsData) as Array<NPCDataInput>;
      const normalizedNpcsList: NPCData[] = [];
      for (const npc of npcList) {
        const normalized = this.normalizeNPC(npc);
        (ALL_NPCS as Map<string, NPCData>).set(normalized.id, normalized);
        normalizedNpcsList.push(normalized);
      }
      // Mirror Phase-2 boot-load: keep npcDefinitionsRegistry in sync
      // with ALL_NPCS so the registry-prefer branch in `getNPCById`
      // returns data on this filesystem-load path too.
      npcDefinitionsRegistry.load(
        normalizedNpcsList as unknown as Parameters<
          typeof npcDefinitionsRegistry.load
        >[0],
      );

      // Load gathering resources from separate per-skill manifests
      // This matches the recipes/ pattern for organizational consistency
      await this.loadGatheringManifestsFromFilesystem(fs, path, manifestsDir);

      // Load world areas
      const worldAreasPath = path.join(manifestsDir, "world-areas.json");
      const worldAreasData = await fs.readFile(worldAreasPath, "utf-8");
      const worldAreas = JSON.parse(worldAreasData) as {
        starterTowns: Record<string, WorldArea>;
        level1Areas: Record<string, WorldArea>;
        level2Areas: Record<string, WorldArea>;
        level3Areas: Record<string, WorldArea>;
        specialAreas?: Record<string, WorldArea>;
      };
      // Merge all areas into ALL_WORLD_AREAS (including specialAreas like duel_arena)
      Object.assign(
        ALL_WORLD_AREAS,
        worldAreas.starterTowns,
        worldAreas.level1Areas,
        worldAreas.level2Areas,
        worldAreas.level3Areas,
        worldAreas.specialAreas || {},
      );
      Object.assign(STARTER_TOWNS, worldAreas.starterTowns);

      // Load biomes
      const biomesPath = path.join(manifestsDir, "biomes.json");
      const biomesData = await fs.readFile(biomesPath, "utf-8");
      const biomeList = JSON.parse(biomesData) as Array<BiomeData>;
      for (const biome of biomeList) {
        BIOMES[biome.id] = biome;
        // Also index by terrain type (see CDN loader for rationale)
        if (biome.terrain && !BIOMES[biome.terrain]) {
          BIOMES[biome.terrain] = biome;
        }
      }

      // Load world config manifest for terrain/town/road generation
      const worldConfigPath = path.join(manifestsDir, "world-config.json");
      try {
        const worldConfigData = await fs.readFile(worldConfigPath, "utf-8");
        const worldConfigManifest = JSON.parse(
          worldConfigData,
        ) as WorldConfigManifest;
        DataManager.worldConfig = worldConfigManifest;
      } catch {
        warnOptionalData(
          "[DataManager] world-config.json not found, using default world generation parameters",
        );
      }

      // Load buildings manifest for pre-defined towns
      const buildingsPath = path.join(manifestsDir, "buildings.json");
      DataManager.buildingsManifest = null;
      try {
        const buildingsData = await fs.readFile(buildingsPath, "utf-8");
        const buildingsManifest = JSON.parse(buildingsData) as unknown;
        if (!isBuildingsManifest(buildingsManifest)) {
          throw new Error("Invalid buildings manifest shape");
        }
        DataManager.buildingsManifest = buildingsManifest;
        console.log(
          `[DataManager] Loaded buildings manifest: ${buildingsManifest.towns?.length ?? 0} pre-defined towns`,
        );
      } catch (error) {
        warnOptionalData(
          `[DataManager] buildings.json missing or invalid, skipping pre-defined towns (${error instanceof Error ? error.message : "unknown error"})`,
        );
      }

      // Load world.json — entity placements from World Studio (optional)
      // Try production first, then fall back to staging directory
      DataManager.worldJson = null;
      DataManager.worldJsonIndex = null;
      try {
        const worldJsonPath = path.join(manifestsDir, "world.json");
        const worldJsonData = JSON.parse(
          await fs.readFile(worldJsonPath, "utf-8"),
        ) as WorldJson;
        if (worldJsonData?.entities) {
          DataManager.worldJson = worldJsonData;
          const tileSize =
            worldJsonData.metadata?.tileSize ??
            DataManager.worldConfig?.terrain?.tileSize ??
            100;
          DataManager.worldJsonIndex = new WorldJsonSpatialIndex(
            worldJsonData,
            tileSize,
          );
          const treeInfo = worldJsonData.entities.trees?.length
            ? `, ${worldJsonData.entities.trees.length} trees`
            : "";
          console.log(
            `[DataManager] Loaded world.json: ${worldJsonData.entities.resources.length} resources, ${worldJsonData.entities.mobSpawns.length} mob spawns${treeInfo}`,
          );
        }
      } catch {
        // Production world.json missing — try staging fallback
        try {
          const stagingWorldJsonDir = path.join(
            path.dirname(manifestsDir),
            "manifests-staging",
          );
          const stagingWorldJsonPath = path.join(
            stagingWorldJsonDir,
            "world.json",
          );
          const worldJsonData = JSON.parse(
            await fs.readFile(stagingWorldJsonPath, "utf-8"),
          ) as WorldJson;
          if (worldJsonData?.entities) {
            DataManager.worldJson = worldJsonData;
            const tileSize =
              worldJsonData.metadata?.tileSize ??
              DataManager.worldConfig?.terrain?.tileSize ??
              100;
            DataManager.worldJsonIndex = new WorldJsonSpatialIndex(
              worldJsonData,
              tileSize,
            );
            const treeCount = worldJsonData.entities.trees?.length ?? 0;
            const resCount = worldJsonData.entities.resources?.length ?? 0;
            console.log(
              `[DataManager] Loaded world.json from STAGING fallback: ${resCount} resources, ${treeCount} trees`,
            );
          }
        } catch {
          // Neither production nor staging world.json exists — procgen fallback (normal for fresh installs)
        }
      }

      // Load danger-sources.json (optional)
      DataManager.dangerSources = null;
      try {
        const dangerPath = path.join(manifestsDir, "danger-sources.json");
        const dangerData = JSON.parse(
          await fs.readFile(dangerPath, "utf-8"),
        ) as { sources: DangerSourceManifest[] };
        if (dangerData?.sources && dangerData.sources.length > 0) {
          DataManager.dangerSources = dangerData.sources;
        }
      } catch {
        // danger-sources.json is optional
      }

      // Load wilderness-boundary.json (optional)
      DataManager.wildernessBoundary = null;
      try {
        const wbPath = path.join(manifestsDir, "wilderness-boundary.json");
        const boundary = JSON.parse(
          await fs.readFile(wbPath, "utf-8"),
        ) as WildernessBoundaryManifest;
        if (boundary?.points && boundary.points.length > 0) {
          DataManager.wildernessBoundary = boundary;
        }
      } catch {
        // wilderness-boundary.json is optional
      }

      // Load brush-overlays.json (optional) — terrain sculpt + biome paint strokes
      DataManager.brushOverlays = null;
      try {
        const boPath = path.join(manifestsDir, "brush-overlays.json");
        const overlays = JSON.parse(
          await fs.readFile(boPath, "utf-8"),
        ) as BrushOverlaysManifest;
        if (overlays?.terrainSculpts || overlays?.biomePaints) {
          DataManager.brushOverlays = overlays;
          console.log(
            `[DataManager] Loaded brush overlays: ${overlays.terrainSculpts?.length ?? 0} sculpts, ${overlays.biomePaints?.length ?? 0} biome paints`,
          );
        }
      } catch {
        // brush-overlays.json is optional — terrain uses pure procgen if absent
      }

      // Load stores
      const storesPath = path.join(manifestsDir, "stores.json");
      const storesData = await fs.readFile(storesPath, "utf-8");
      const storeList = JSON.parse(storesData) as Array<StoreData>;
      for (const store of storeList) {
        (GENERAL_STORES as Record<string, StoreData>)[store.id] = store;
      }

      // Load skill unlocks
      const skillUnlocksPath = path.join(manifestsDir, "skill-unlocks.json");
      try {
        const skillUnlocksData = await fs.readFile(skillUnlocksPath, "utf-8");
        const skillUnlocksManifest = JSON.parse(
          skillUnlocksData,
        ) as SkillUnlocksManifest;
        loadSkillUnlocks(skillUnlocksManifest);
      } catch {
        console.warn(
          "[DataManager] skill-unlocks.json not found, skill unlocks will be empty until loaded",
        );
      }

      // Load recipe manifests for ProcessingDataProvider
      await this.loadRecipeManifestsFromFilesystem(fs, path, manifestsDir);

      // Build EXTERNAL_TOOLS from items where item.tool is defined
      // This replaces the old tools.json loading
      this.buildToolsFromItems();

      // Count tools for logging
      const toolCount =
        (globalThis as { EXTERNAL_TOOLS?: Map<string, GatheringToolData> })
          .EXTERNAL_TOOLS?.size ?? 0;

      console.log(
        `[DataManager] ✅ Loaded manifests from filesystem (${(ITEMS as Map<string, Item>).size} items, ${(ALL_NPCS as Map<string, NPCData>).size} NPCs, ${Object.keys(BIOMES).length} biomes, ${toolCount} tools)`,
      );
    } catch (error) {
      // In test/CI environments, manifests might not exist - this is non-fatal
      if (isTestEnv) {
        console.warn(
          "[DataManager] ⚠️  Manifests not available in test/CI environment - skipping manifest loading",
        );
        console.warn(
          "[DataManager] This is expected in CI/test - game data will use defaults",
        );
      } else {
        // In production/development, manifests should exist - log error and re-throw
        console.error(
          "[DataManager] ❌ Failed to load manifests from filesystem:",
          error,
        );
        throw error;
      }
    }
  }

  /**
   * Load external assets from CDN (works for both client and server)
   */
  private async loadExternalAssetsFromWorld(): Promise<void> {
    // Both client and server now load from CDN
    await this.loadManifestsFromCDN();
  }

  /**
   * Load items from items/ directory (multiple JSON files) - Filesystem version
   * Returns true if successful, false if should fall back to single file
   *
   * Validates core categories exist before loading. Optional categories are
   * loaded if present and skipped if absent.
   */
  private async loadItemsFromDirectory(
    fs: typeof import("fs/promises"),
    path: typeof import("path"),
    itemsDir: string,
  ): Promise<boolean> {
    // Validate core files exist before loading.
    for (const file of REQUIRED_ITEM_FILES) {
      const filePath = path.join(itemsDir, `${file}.json`);
      try {
        await fs.access(filePath);
      } catch {
        console.warn(
          `[DataManager] items/${file}.json not found, falling back to items.json`,
        );
        return false;
      }
    }

    // Core files exist - load all available categories.
    const seenIds = new Set<string>();

    for (const file of ITEM_CATEGORY_FILES) {
      const filePath = path.join(itemsDir, `${file}.json`);
      let data: string;
      try {
        data = await fs.readFile(filePath, "utf-8");
      } catch {
        if (
          REQUIRED_ITEM_FILES.includes(
            file as (typeof REQUIRED_ITEM_FILES)[number],
          )
        ) {
          throw new Error(
            `[DataManager] Required item file missing: items/${file}.json`,
          );
        }
        console.warn(
          `[DataManager] Optional items/${file}.json not found, continuing`,
        );
        continue;
      }
      const items = JSON.parse(data) as Array<Item>;

      for (const item of items) {
        // Duplicate ID check
        if (seenIds.has(item.id)) {
          throw new Error(
            `[DataManager] Duplicate item ID "${item.id}" found in items/${file}.json`,
          );
        }
        seenIds.add(item.id);

        const normalized = this.normalizeItem(item);
        (ITEMS as Map<string, Item>).set(normalized.id, normalized);
      }
    }

    console.log(
      `[DataManager] Loaded ${seenIds.size} items from items/ directory`,
    );
    return true;
  }

  private normalizeItem(item: Item): Item {
    // Ensure required fields have sane defaults and enums
    const safeWeaponType = item.weaponType ?? WeaponType.NONE;
    const equipSlot = item.equipSlot ?? null;
    const attackType = item.attackType ?? null;

    // Validate: weapons with equipSlot "weapon" should have equippedModelPath
    const equippedModelPath = item.equippedModelPath;
    if (equipSlot === "weapon" && equippedModelPath === undefined) {
      console.warn(
        `[DataManager] Weapon "${item.id}" missing equippedModelPath - will use convention fallback`,
      );
    }

    // Derive requirements from tier if not explicitly set
    // This implements the tier-based requirements system
    let requirements = item.requirements;
    if (!requirements && item.tier && TierDataProvider.isLoaded()) {
      const tierableItem: TierableItem = {
        id: item.id,
        type: item.type,
        tier: item.tier,
        equipSlot: equipSlot || undefined,
        attackType: attackType || undefined,
        tool: item.tool,
      };
      const derived = TierDataProvider.getRequirements(tierableItem);
      if (derived) {
        // Calculate level as max of all skill requirements
        const level = Math.max(
          1,
          ...Object.values(derived).filter(
            (v): v is number => typeof v === "number",
          ),
        );
        requirements = {
          level,
          skills: derived,
        };
      }
    }

    // Derive simple defense/attack from detailed bonuses for backward compatibility.
    // Armor items define per-style bonuses (defenseStab, defenseSlash, etc.) but the
    // existing DamageCalculator reads simple "defense". Use highest melee defence as the
    // simple value until per-style combat is wired up.
    const bonuses = item.bonuses as Record<string, number> | undefined;
    if (bonuses) {
      if (bonuses.defense === undefined) {
        const ds = bonuses.defenseStab ?? 0;
        const dl = bonuses.defenseSlash ?? 0;
        const dc = bonuses.defenseCrush ?? 0;
        if (ds !== 0 || dl !== 0 || dc !== 0) {
          bonuses.defense = Math.max(ds, dl, dc);
        }
      }
      if (bonuses.attack === undefined) {
        const as_ = bonuses.attackStab ?? 0;
        const al = bonuses.attackSlash ?? 0;
        const ac = bonuses.attackCrush ?? 0;
        if (as_ !== 0 || al !== 0 || ac !== 0) {
          bonuses.attack = Math.max(as_, al, ac);
        }
      }
    }

    // Apply defaults only for missing fields (use ?? to preserve falsy values like 0)
    const normalized: Item = {
      ...item,
      type: item.type,
      weaponType: safeWeaponType,
      equipSlot: equipSlot as EquipmentSlotName | null,
      attackType: attackType as AttackType | null,
      // Inventory properties with defaults
      quantity: item.quantity ?? 1,
      stackable: item.stackable ?? false,
      maxStackSize: item.maxStackSize ?? 1,
      value: item.value ?? 0,
      weight: item.weight ?? 0.1,
      // Equipment properties with defaults
      equipable: item.equipable ?? !!equipSlot,
      // Item properties with defaults
      description: item.description || item.name || "Item",
      examine: item.examine || item.description || item.name || "Item",
      // Optional properties
      healAmount: item.healAmount,
      attackSpeed: item.attackSpeed,
      // Melee weapons default to standard range, others use manifest value
      attackRange:
        item.attackRange ??
        (attackType === AttackType.MELEE
          ? getDefaultItemAttackRange()
          : undefined),
      equippedModelPath: item.equippedModelPath,
      bonuses: item.bonuses,
      requirements: requirements,
    };
    return normalized;
  }

  /**
   * Build EXTERNAL_TOOLS map from items where item.tool is defined
   * This replaces loading from tools.json
   */
  private buildToolsFromItems(): void {
    if (
      !(
        globalThis as {
          EXTERNAL_TOOLS?: Map<string, GatheringToolData>;
        }
      ).EXTERNAL_TOOLS
    ) {
      (
        globalThis as {
          EXTERNAL_TOOLS?: Map<string, GatheringToolData>;
        }
      ).EXTERNAL_TOOLS = new Map();
    }

    const toolsMap = (
      globalThis as unknown as {
        EXTERNAL_TOOLS: Map<string, GatheringToolData>;
      }
    ).EXTERNAL_TOOLS;

    // Clear existing tools
    toolsMap.clear();

    // Build tools from items
    for (const [itemId, item] of ITEMS) {
      if (item.tool) {
        // Determine level required from tier or explicit requirements
        let levelRequired = 1;
        if (item.requirements?.skills) {
          // Use the skill level from requirements that matches the tool skill
          const skillLevel = item.requirements.skills[item.tool.skill];
          if (skillLevel) {
            levelRequired = skillLevel;
          }
        } else if (item.tier && TierDataProvider.isLoaded()) {
          // Derive from tier
          const tierableItem: TierableItem = {
            id: item.id,
            type: item.type,
            tier: item.tier,
            tool: item.tool,
          };
          const derived = TierDataProvider.getRequirements(tierableItem);
          if (derived) {
            const skillLevel = derived[item.tool.skill as keyof typeof derived];
            if (skillLevel) {
              levelRequired = skillLevel;
            }
          }
        }

        const toolData: GatheringToolData = {
          itemId,
          skill: item.tool.skill,
          tier: item.tier || "unknown",
          levelRequired,
          rollTicks: item.tool.rollTicks,
          priority: item.tool.priority,
        };

        toolsMap.set(itemId, toolData);
      }
    }
  }

  /**
   * Load recipe manifests from CDN
   */
  private async loadRecipeManifestsFromCDN(baseUrl: string): Promise<void> {
    // Fire ALL recipe + supplementary manifest fetches in parallel
    await Promise.allSettled([
      // Cooking
      (async () => {
        try {
          const cookingRes = await fetch(`${baseUrl}/recipes/cooking.json`);
          const cookingManifest = (await cookingRes.json()) as CookingManifest;
          processingDataProvider.loadCookingRecipes(cookingManifest);
        } catch {
          console.warn(
            "[DataManager] recipes/cooking.json not found, falling back to embedded item data",
          );
        }
      })(),

      // Firemaking
      (async () => {
        try {
          const firemakingRes = await fetch(
            `${baseUrl}/recipes/firemaking.json`,
          );
          const firemakingManifest =
            (await firemakingRes.json()) as FiremakingManifest;
          processingDataProvider.loadFiremakingRecipes(firemakingManifest);
        } catch {
          console.warn(
            "[DataManager] recipes/firemaking.json not found, falling back to embedded item data",
          );
        }
      })(),

      // Smelting
      (async () => {
        try {
          const smeltingRes = await fetch(`${baseUrl}/recipes/smelting.json`);
          const smeltingManifest =
            (await smeltingRes.json()) as SmeltingManifest;
          processingDataProvider.loadSmeltingRecipes(smeltingManifest);
        } catch {
          console.warn(
            "[DataManager] recipes/smelting.json not found, falling back to embedded item data",
          );
        }
      })(),

      // Smithing
      (async () => {
        try {
          const smithingRes = await fetch(`${baseUrl}/recipes/smithing.json`);
          const smithingManifest =
            (await smithingRes.json()) as SmithingManifest;
          processingDataProvider.loadSmithingRecipes(smithingManifest);
        } catch {
          warnOptionalData(
            "[DataManager] recipes/smithing.json not found, falling back to embedded item data",
          );
        }
      })(),

      // Crafting
      (async () => {
        try {
          const craftingRes = await fetch(`${baseUrl}/recipes/crafting.json`);
          const craftingManifest =
            (await craftingRes.json()) as CraftingManifest;
          processingDataProvider.loadCraftingRecipes(craftingManifest);
        } catch {
          warnOptionalData(
            "[DataManager] recipes/crafting.json not found, crafting will be unavailable",
          );
        }
      })(),

      // Tanning
      (async () => {
        try {
          const tanningRes = await fetch(`${baseUrl}/recipes/tanning.json`);
          const tanningManifest = (await tanningRes.json()) as TanningManifest;
          processingDataProvider.loadTanningRecipes(tanningManifest);
        } catch {
          warnOptionalData(
            "[DataManager] recipes/tanning.json not found, tanning will be unavailable",
          );
        }
      })(),

      // Fletching
      (async () => {
        try {
          const fletchingRes = await fetch(`${baseUrl}/recipes/fletching.json`);
          const fletchingManifest =
            (await fletchingRes.json()) as FletchingManifest;
          processingDataProvider.loadFletchingRecipes(fletchingManifest);
        } catch {
          warnOptionalData(
            "[DataManager] recipes/fletching.json not found, fletching will be unavailable",
          );
        }
      })(),

      // Runecrafting
      (async () => {
        try {
          const runecraftingRes = await fetch(
            `${baseUrl}/recipes/runecrafting.json`,
          );
          const runecraftingManifest =
            (await runecraftingRes.json()) as RunecraftingManifest;
          processingDataProvider.loadRunecraftingRecipes(runecraftingManifest);
        } catch {
          warnOptionalData(
            "[DataManager] recipes/runecrafting.json not found, runecrafting will be unavailable",
          );
        }
      })(),

      // Prayers
      (async () => {
        try {
          const prayersRes = await fetch(`${baseUrl}/prayers.json`);
          if (!prayersRes.ok) {
            throw new Error(
              `HTTP ${prayersRes.status}: ${prayersRes.statusText}`,
            );
          }
          const prayersManifest = (await prayersRes.json()) as PrayersManifest;
          prayerDataProvider.loadPrayers(prayersManifest);
          prayerDataProvider.rebuild();
        } catch (err) {
          console.warn(
            `[DataManager] prayers.json not found (${err instanceof Error ? err.message : String(err)}), prayer system will be unavailable`,
          );
        }
      })(),

      // Dialogue condition bindings (optional)
      (async () => {
        try {
          const res = await fetch(
            `${baseUrl}/dialogue-condition-bindings.json`,
          );
          if (!res.ok) {
            throw new Error(`HTTP ${res.status}: ${res.statusText}`);
          }
          const raw = (await res.json()) as unknown;
          dialogueConditionBindingsProvider.loadRaw(raw);
        } catch (err) {
          // Missing manifest is fine — servers that don't author
          // dialogue condition bindings stay on the safe empty
          // default (unknown predicate names → false).
          console.warn(
            `[DataManager] dialogue-condition-bindings.json not found or invalid (${err instanceof Error ? err.message : String(err)}), authored dialogue predicates will be unavailable`,
          );
        }
      })(),

      // Combat tuning manifest (optional). When absent or invalid,
      // DuelCombatAI falls back to its hardcoded per-role defaults.
      (async () => {
        try {
          const res = await fetch(`${baseUrl}/combat-tuning.json`);
          if (!res.ok) {
            throw new Error(`HTTP ${res.status}: ${res.statusText}`);
          }
          const raw = (await res.json()) as unknown;
          combatTuningProvider.loadRaw(raw);
        } catch (err) {
          console.warn(
            `[DataManager] combat-tuning.json not found or invalid (${err instanceof Error ? err.message : String(err)}), duel AI will use hardcoded defaults`,
          );
        }
      })(),

      // Per-agent combat-tuning profile bindings manifest (optional).
      // Maps `characterId → profileId | null`. Restored at boot by
      // StreamingDuelScheduler so per-agent overrides survive restart.
      (async () => {
        try {
          const res = await fetch(
            `${baseUrl}/combat-tuning-agent-bindings.json`,
          );
          if (!res.ok) {
            throw new Error(`HTTP ${res.status}: ${res.statusText}`);
          }
          const raw = (await res.json()) as unknown;
          combatTuningAgentBindingsProvider.loadRaw(raw);
        } catch (err) {
          console.warn(
            `[DataManager] combat-tuning-agent-bindings.json not found or invalid (${err instanceof Error ? err.message : String(err)}), per-agent tuning overrides will be unavailable`,
          );
        }
      })(),

      // XP curves manifest (optional). Consumed by the XpCurvesRegistry
      // to resolve level↔xp for every skill. When absent, consumers
      // fall back to their hardcoded XP tables.
      (async () => {
        try {
          const res = await fetch(`${baseUrl}/xp-curves.json`);
          if (!res.ok) {
            throw new Error(`HTTP ${res.status}: ${res.statusText}`);
          }
          const raw = (await res.json()) as unknown;
          const parsed = xpCurvesProvider.loadRaw(raw);
          // Seed the module-level runtime registry so skill/XP
          // consumers reading through `xpCurveRegistry` pick up
          // authored curves on cold boot (parity with PIE path).
          xpCurveRegistry.load(parsed);
        } catch (err) {
          console.warn(
            `[DataManager] xp-curves.json not found or invalid (${err instanceof Error ? err.message : String(err)}), level↔xp resolution will use hardcoded tables`,
          );
        }
      })(),

      // Achievements manifest (optional). Consumed by the
      // AchievementEvaluator when a world wires one up. Missing file
      // leaves the provider unloaded; consumers iterate an empty list.
      (async () => {
        try {
          const res = await fetch(`${baseUrl}/achievements.json`);
          if (!res.ok) {
            throw new Error(`HTTP ${res.status}: ${res.statusText}`);
          }
          const raw = (await res.json()) as unknown;
          const parsed = achievementsProvider.loadRaw(raw);
          // Seed the module-level achievement evaluator so
          // AwarderSystem consumers pick up authored achievements
          // on cold boot (parity with PIE path).
          achievementEvaluator.load(parsed);
        } catch (err) {
          console.warn(
            `[DataManager] achievements.json not found or invalid (${err instanceof Error ? err.message : String(err)}), achievements will be unavailable`,
          );
        }
      })(),

      // Time/weather manifest (optional). Feeds the TimeWeatherDriver
      // (day/night cycle + weather FSM). Missing/invalid file leaves
      // the provider unloaded; consumers must guard with isLoaded()
      // and supply their own hardcoded fallback since the schema
      // requires ≥2 keyframes and ≥1 weather state.
      (async () => {
        try {
          const res = await fetch(`${baseUrl}/time-weather.json`);
          if (!res.ok) {
            throw new Error(`HTTP ${res.status}: ${res.statusText}`);
          }
          const raw = (await res.json()) as unknown;
          const parsed = timeWeatherProvider.loadRaw(raw);
          // Seed runtime driver (parity with PIE hot-reload path).
          timeWeatherDriver.load(parsed);
        } catch (err) {
          console.warn(
            `[DataManager] time-weather.json not found or invalid (${err instanceof Error ? err.message : String(err)}), day/night + weather will use hardcoded fallback`,
          );
        }
      })(),

      // Accessibility manifest (optional). Every field has a schema
      // default so a missing file still yields a fully-defaulted
      // manifest via `accessibilityProvider.getManifest()` — safe
      // to call unconditionally.
      (async () => {
        try {
          const res = await fetch(`${baseUrl}/accessibility.json`);
          if (!res.ok) {
            throw new Error(`HTTP ${res.status}: ${res.statusText}`);
          }
          const raw = (await res.json()) as unknown;
          const parsed = accessibilityProvider.loadRaw(raw);
          // Seed runtime registry (parity with PIE hot-reload).
          accessibilitySettings.load(parsed);
        } catch (err) {
          console.warn(
            `[DataManager] accessibility.json not found or invalid (${err instanceof Error ? err.message : String(err)}), accessibility defaults will apply`,
          );
        }
      })(),

      // Analytics events manifest (optional). Consumed by the runtime
      // analytics bridge to validate emitted event payloads before
      // forwarding to sinks. Missing file leaves provider unloaded →
      // bridge accepts anything (dev-loose).
      (async () => {
        try {
          const res = await fetch(`${baseUrl}/analytics-events.json`);
          if (!res.ok) {
            throw new Error(`HTTP ${res.status}: ${res.statusText}`);
          }
          const raw = (await res.json()) as unknown;
          const parsed = analyticsEventsProvider.loadRaw(raw);
          // Seed runtime registry (parity with PIE hot-reload).
          analyticsEventRouter.load(parsed);
        } catch (err) {
          console.warn(
            `[DataManager] analytics-events.json not found or invalid (${err instanceof Error ? err.message : String(err)}), analytics bridge will skip schema validation`,
          );
        }
      })(),

      // Render profiles manifest (optional). Feeds RenderProfileRegistry
      // (already shipped) with tone mapping, bloom, fog, ambient,
      // environment map, color grading. Missing/invalid leaves the
      // provider unloaded — consumers must supply hardcoded defaults
      // (schema requires min 1 profile, no safe empty).
      (async () => {
        try {
          const res = await fetch(`${baseUrl}/render-profiles.json`);
          if (!res.ok) {
            throw new Error(`HTTP ${res.status}: ${res.statusText}`);
          }
          const raw = (await res.json()) as unknown;
          const parsed = renderProfilesProvider.loadRaw(raw);
          // Seed the module-level runtime registry so renderer
          // consumers that read through `renderProfileRegistry` pick
          // up authored profiles on cold boot (PIE hot-reload already
          // covers the live-dispatch path in PIEEditorSession).
          renderProfileRegistry.load(parsed);
        } catch (err) {
          console.warn(
            `[DataManager] render-profiles.json not found or invalid (${err instanceof Error ? err.message : String(err)}), render profiles will use hardcoded defaults`,
          );
        }
      })(),

      // Damage types manifest (optional). Consumed by DamageTypeRegistry
      // (already shipped) for resolving attack↔defense multipliers in
      // combat math. Missing/invalid leaves provider unloaded →
      // combat falls back to untyped (1x) damage.
      (async () => {
        try {
          const res = await fetch(`${baseUrl}/damage-types.json`);
          if (!res.ok) {
            throw new Error(`HTTP ${res.status}: ${res.statusText}`);
          }
          const raw = (await res.json()) as unknown;
          const parsed = damageTypesProvider.loadRaw(raw);
          // Seed the module-level damage-type registry so combat
          // math consumers reading through `damageTypeRegistry` pick
          // up authored resistances on cold boot (parity with PIE).
          damageTypeRegistry.load(parsed);
        } catch (err) {
          console.warn(
            `[DataManager] damage-types.json not found or invalid (${err instanceof Error ? err.message : String(err)}), combat will treat all damage as untyped`,
          );
        }
      })(),

      // Status effects manifest (optional). Consumed by
      // StatusEffectSystem (not yet wired) for buff/debuff stacks,
      // stat modifiers, and per-tick damage/heal. Missing/invalid
      // leaves provider unloaded → no authored effects.
      (async () => {
        try {
          const res = await fetch(`${baseUrl}/status-effects.json`);
          if (!res.ok) {
            throw new Error(`HTTP ${res.status}: ${res.statusText}`);
          }
          const raw = (await res.json()) as unknown;
          const parsed = statusEffectsProvider.loadRaw(raw);
          // Seed runtime registry (parity with PIE hot-reload).
          statusEffectRegistry.load(parsed);
        } catch (err) {
          console.warn(
            `[DataManager] status-effects.json not found or invalid (${err instanceof Error ? err.message : String(err)}), no authored buffs/debuffs will be available`,
          );
        }
      })(),

      // Camera profiles manifest (optional). Consumed by the Apr-20
      // CameraProfileRegistry runtime (first-/third-person/top-down/
      // orbit/free-fly rigs + FOV/lag/collision tuning). Missing or
      // invalid leaves the provider unloaded → no authored profiles.
      (async () => {
        try {
          const res = await fetch(`${baseUrl}/camera-profiles.json`);
          if (!res.ok) {
            throw new Error(`HTTP ${res.status}: ${res.statusText}`);
          }
          const raw = (await res.json()) as unknown;
          const parsed = cameraProfilesProvider.loadRaw(raw);
          // Seed runtime camera-profile registry (parity with PIE).
          cameraProfileRegistry.load(parsed);
        } catch (err) {
          console.warn(
            `[DataManager] camera-profiles.json not found or invalid (${err instanceof Error ? err.message : String(err)}), no authored camera rigs will be available`,
          );
        }
      })(),

      // Audio bus-mix manifest (optional). Consumed by the Apr-20
      // AudioBusMixer runtime — master/music/sfx/ui/ambient DAG with
      // per-bus volume/filters + duck rules. Missing/invalid leaves
      // the provider unloaded → no authored mixer graph.
      (async () => {
        try {
          const res = await fetch(`${baseUrl}/audio-bus-mix.json`);
          if (!res.ok) {
            throw new Error(`HTTP ${res.status}: ${res.statusText}`);
          }
          const raw = (await res.json()) as unknown;
          const parsed = audioBusMixProvider.loadRaw(raw);
          // Seed runtime mixer (parity with PIE hot-reload path).
          audioBusMixer.load(parsed);
        } catch (err) {
          console.warn(
            `[DataManager] audio-bus-mix.json not found or invalid (${err instanceof Error ? err.message : String(err)}), no authored mixer graph will be available`,
          );
        }
      })(),

      // Post-process volumes manifest (optional). Consumed by the
      // Apr-20 PostProcessVolumeCompositor — region-bounded overrides
      // on top of the active render profile. Missing/invalid leaves
      // the provider unloaded → compositor has no volumes to blend.
      (async () => {
        try {
          const res = await fetch(`${baseUrl}/post-process-volumes.json`);
          if (!res.ok) {
            throw new Error(`HTTP ${res.status}: ${res.statusText}`);
          }
          const raw = (await res.json()) as unknown;
          const parsed = postProcessVolumesProvider.loadRaw(raw);
          // Seed runtime compositor (parity with PIE hot-reload path).
          postProcessVolumeCompositor.load(parsed);
        } catch (err) {
          console.warn(
            `[DataManager] post-process-volumes.json not found or invalid (${err instanceof Error ? err.message : String(err)}), no authored volumes will be available`,
          );
        }
      })(),

      // NPC schedule manifest (optional). Consumed by the Apr-20
      // NPCScheduleDriver + NpcScheduleRegistry — authored time-of-day
      // activity slots per NPC (work/sleep/patrol/socialize). Missing
      // or invalid leaves the provider empty → NPCs fall back to
      // their built-in behavior logic.
      (async () => {
        try {
          const res = await fetch(`${baseUrl}/npc-schedule.json`);
          if (!res.ok) {
            throw new Error(`HTTP ${res.status}: ${res.statusText}`);
          }
          const raw = (await res.json()) as unknown;
          const parsed = npcScheduleProvider.loadRaw(raw);
          // Seed runtime schedule registry (parity with PIE).
          npcScheduleRegistry.load(parsed);
        } catch (err) {
          console.warn(
            `[DataManager] npc-schedule.json not found or invalid (${err instanceof Error ? err.message : String(err)}), no authored NPC schedules will be available`,
          );
        }
      })(),

      // Chat-channels manifest (optional). Consumed by the Apr-20
      // ChatRouter + ChatChannelRegistry — global/zone/party/guild/
      // whisper/system/custom channels with permission tiers, rate
      // limits, and filter-rule references. Missing/invalid leaves
      // the provider unloaded → ChatRouter uses built-in defaults.
      (async () => {
        try {
          const res = await fetch(`${baseUrl}/chat-channels.json`);
          if (!res.ok) {
            throw new Error(`HTTP ${res.status}: ${res.statusText}`);
          }
          const raw = (await res.json()) as unknown;
          const parsed = chatChannelsProvider.loadRaw(raw);
          // Seed runtime channel registry (parity with PIE path).
          chatChannelRegistry.load(parsed);
        } catch (err) {
          console.warn(
            `[DataManager] chat-channels.json not found or invalid (${err instanceof Error ? err.message : String(err)}), chat routing will use built-in defaults`,
          );
        }
      })(),

      // Mounts manifest (optional). Authored mount registry with
      // ground/water/flight locomotion, speeds, stamina, capacity,
      // summon rules. Runtime MountSystem is not yet shipped —
      // provider only persists authored data for future consumption.
      (async () => {
        try {
          const res = await fetch(`${baseUrl}/mounts.json`);
          if (!res.ok) {
            throw new Error(`HTTP ${res.status}: ${res.statusText}`);
          }
          const raw = (await res.json()) as unknown;
          const parsed = mountsProvider.loadRaw(raw);
          // Seed runtime registry (parity with PIE hot-reload).
          mountRegistry.load(parsed);
        } catch (err) {
          console.warn(
            `[DataManager] mounts.json not found or invalid (${err instanceof Error ? err.message : String(err)}), mount system will be disabled`,
          );
        }
      })(),

      // Voice-chat manifest (optional). Authored voice rooms,
      // transmission modes, codec tuning, mute defaults. Runtime
      // VoiceChatSystem (LiveKit) is not yet shipped — provider
      // only persists authored data for future consumption.
      (async () => {
        try {
          const res = await fetch(`${baseUrl}/voice-chat.json`);
          if (!res.ok) {
            throw new Error(`HTTP ${res.status}: ${res.statusText}`);
          }
          const raw = (await res.json()) as unknown;
          const parsed = voiceChatProvider.loadRaw(raw);
          // Seed runtime registry (parity with PIE hot-reload).
          voiceChatRegistry.load(parsed);
        } catch (err) {
          console.warn(
            `[DataManager] voice-chat.json not found or invalid (${err instanceof Error ? err.message : String(err)}), voice-chat will be disabled`,
          );
        }
      })(),

      // Parental-controls manifest (optional). Age-gated profiles
      // with playTime/spend/communication/content rules + guardian
      // workflow. Runtime ParentalControlsSystem is not yet shipped
      // — provider only persists authored data for future
      // consumption.
      (async () => {
        try {
          const res = await fetch(`${baseUrl}/parental-controls.json`);
          if (!res.ok) {
            throw new Error(`HTTP ${res.status}: ${res.statusText}`);
          }
          const raw = (await res.json()) as unknown;
          const parsed = parentalControlsProvider.loadRaw(raw);
          // Seed runtime registry (parity with PIE hot-reload).
          parentalControlsRegistry.load(parsed);
        } catch (err) {
          console.warn(
            `[DataManager] parental-controls.json not found or invalid (${err instanceof Error ? err.message : String(err)}), parental-controls will be disabled`,
          );
        }
      })(),

      // Tutorial-flows manifest (optional). Declarative onboarding
      // graphs with trigger-advanced steps. Runtime TutorialSystem
      // is not yet shipped — provider only persists authored data
      // for future consumption.
      (async () => {
        try {
          const res = await fetch(`${baseUrl}/tutorial-flows.json`);
          if (!res.ok) {
            throw new Error(`HTTP ${res.status}: ${res.statusText}`);
          }
          const raw = (await res.json()) as unknown;
          const parsed = tutorialFlowsProvider.loadRaw(raw);
          // Seed runtime registry (parity with PIE hot-reload).
          tutorialFlowsRegistry.load(parsed);
        } catch (err) {
          console.warn(
            `[DataManager] tutorial-flows.json not found or invalid (${err instanceof Error ? err.message : String(err)}), tutorial flows will be disabled`,
          );
        }
      })(),

      // Haptics manifest (optional). Controller rumble / touch /
      // VR haptic pattern registry. Runtime HapticsSystem is not
      // yet shipped — provider only persists authored data for
      // future consumption.
      (async () => {
        try {
          const res = await fetch(`${baseUrl}/haptics.json`);
          if (!res.ok) {
            throw new Error(`HTTP ${res.status}: ${res.statusText}`);
          }
          const raw = (await res.json()) as unknown;
          const parsed = hapticsProvider.loadRaw(raw);
          // Seed runtime registry (parity with PIE hot-reload).
          hapticsRegistry.load(parsed);
        } catch (err) {
          console.warn(
            `[DataManager] haptics.json not found or invalid (${err instanceof Error ? err.message : String(err)}), haptics will be disabled`,
          );
        }
      })(),

      // Physics-config manifest (optional). PhysX simulation
      // tuning + physics-material registry + collision-layer
      // matrix. Runtime PhysicsSystem already exists — provider
      // only persists authored *tuning* data for future
      // consumption; wiring the runtime consumer is a separate
      // slice. Missing/invalid leaves the provider unloaded.
      (async () => {
        try {
          const res = await fetch(`${baseUrl}/physics-config.json`);
          if (!res.ok) {
            throw new Error(`HTTP ${res.status}: ${res.statusText}`);
          }
          const raw = (await res.json()) as unknown;
          const parsed = physicsConfigProvider.loadRaw(raw);
          // Seed runtime registry (parity with PIE hot-reload).
          physicsConfigRegistry.load(parsed);
        } catch (err) {
          console.warn(
            `[DataManager] physics-config.json not found or invalid (${err instanceof Error ? err.message : String(err)}), physics config will be disabled`,
          );
        }
      })(),

      // Feature-flags manifest (optional). Authored targeting
      // rules + boolean/variant flag registry + mutex groups.
      // Runtime FeatureFlagRegistry (hash bucketing, admin
      // override, remote-config bridge) is not yet shipped —
      // provider only persists authored data for future
      // consumption. Missing/invalid leaves provider unloaded.
      (async () => {
        try {
          const res = await fetch(`${baseUrl}/feature-flags.json`);
          if (!res.ok) {
            throw new Error(`HTTP ${res.status}: ${res.statusText}`);
          }
          const raw = (await res.json()) as unknown;
          const parsed = featureFlagsProvider.loadRaw(raw);
          // Seed runtime registry (parity with PIE hot-reload).
          featureFlagRegistry.load(parsed);
        } catch (err) {
          console.warn(
            `[DataManager] feature-flags.json not found or invalid (${err instanceof Error ? err.message : String(err)}), feature flags will be disabled`,
          );
        }
      })(),

      // Crash-reporter manifest (optional). Sink registry with
      // endpointNameRefs (never real URLs — resolved via
      // deploy-targets), severity/sampling/retry rules,
      // symbolication, breadcrumbs, PII redaction, consent
      // gating. Runtime CrashReporterSystem not yet shipped —
      // provider only persists authored data. Missing/invalid
      // leaves provider unloaded.
      (async () => {
        try {
          const res = await fetch(`${baseUrl}/crash-reporter.json`);
          if (!res.ok) {
            throw new Error(`HTTP ${res.status}: ${res.statusText}`);
          }
          const raw = (await res.json()) as unknown;
          const parsed = crashReporterProvider.loadRaw(raw);
          // Seed runtime registry (parity with PIE hot-reload).
          crashReporterRegistry.load(parsed);
        } catch (err) {
          console.warn(
            `[DataManager] crash-reporter.json not found or invalid (${err instanceof Error ? err.message : String(err)}), crash reporter will be disabled`,
          );
        }
      })(),

      // Push-notifications manifest (optional). Delivery-channel
      // registry (APNs/FCM/WebPush/email/inApp) with
      // credentialsNameRefs (resolved via deploy-targets),
      // notification categories with fan-out, quiet hours,
      // consent gating. Runtime PushNotificationsSystem not yet
      // shipped — provider only persists authored data.
      (async () => {
        try {
          const res = await fetch(`${baseUrl}/push-notifications.json`);
          if (!res.ok) {
            throw new Error(`HTTP ${res.status}: ${res.statusText}`);
          }
          const raw = (await res.json()) as unknown;
          const parsed = pushNotificationsProvider.loadRaw(raw);
          // Seed runtime registry (parity with PIE hot-reload).
          pushNotificationsRegistry.load(parsed);
        } catch (err) {
          console.warn(
            `[DataManager] push-notifications.json not found or invalid (${err instanceof Error ? err.message : String(err)}), push notifications will be disabled`,
          );
        }
      })(),

      // License-agreements manifest (optional). 7-kind legal
      // doc registry (eula/termsOfService/privacyPolicy/coc/
      // ageConsent/dlcAddendum/custom), SemVer-versioned history,
      // per-version JurisdictionalVariant[] (global / ISO-3166),
      // acceptance gates, consent flow. Runtime LegalConsentSystem
      // not yet shipped — provider only persists authored data.
      (async () => {
        try {
          const res = await fetch(`${baseUrl}/license-agreements.json`);
          if (!res.ok) {
            throw new Error(`HTTP ${res.status}: ${res.statusText}`);
          }
          const raw = (await res.json()) as unknown;
          const parsed = licenseAgreementsProvider.loadRaw(raw);
          // Seed runtime registry (parity with PIE hot-reload).
          licenseAgreementsRegistry.load(parsed);
        } catch (err) {
          console.warn(
            `[DataManager] license-agreements.json not found or invalid (${err instanceof Error ? err.message : String(err)}), license agreements will be disabled`,
          );
        }
      })(),

      // News-feed manifest (optional). Authored announcement
      // registry with targeting + publish/expire windows. Runtime
      // NewsFeedSystem not yet shipped — provider only persists
      // authored data for future consumption.
      (async () => {
        try {
          const res = await fetch(`${baseUrl}/news-feed.json`);
          if (!res.ok) {
            throw new Error(`HTTP ${res.status}: ${res.statusText}`);
          }
          const raw = (await res.json()) as unknown;
          const parsed = newsFeedProvider.loadRaw(raw);
          // Seed runtime registry (parity with PIE hot-reload).
          newsFeedRegistry.load(parsed);
        } catch (err) {
          console.warn(
            `[DataManager] news-feed.json not found or invalid (${err instanceof Error ? err.message : String(err)}), news feed will be disabled`,
          );
        }
      })(),

      // Moderation manifest (optional). Authored report-category
      // registry + filter-rule list + per-category sanction
      // ladders + global rate/auto-mod/appeals/ban rule blocks.
      // Runtime ModerationSystem not yet shipped — provider only
      // persists authored data for future consumption.
      (async () => {
        try {
          const res = await fetch(`${baseUrl}/moderation.json`);
          if (!res.ok) {
            throw new Error(`HTTP ${res.status}: ${res.statusText}`);
          }
          const raw = (await res.json()) as unknown;
          const parsed = moderationProvider.loadRaw(raw);
          // Seed runtime registry (parity with PIE hot-reload).
          moderationRegistry.load(parsed);
        } catch (err) {
          console.warn(
            `[DataManager] moderation.json not found or invalid (${err instanceof Error ? err.message : String(err)}), moderation substrate will be disabled`,
          );
        }
      })(),

      // Fast-travel manifest (optional). Authored flight-master
      // graph — nodes + edges + global rules. Runtime
      // FastTravelSystem not yet shipped — provider only persists
      // authored data for future consumption.
      (async () => {
        try {
          const res = await fetch(`${baseUrl}/fast-travel.json`);
          if (!res.ok) {
            throw new Error(`HTTP ${res.status}: ${res.statusText}`);
          }
          const raw = (await res.json()) as unknown;
          const parsed = fastTravelProvider.loadRaw(raw);
          // Seed runtime registry (parity with PIE hot-reload).
          fastTravelGraph.load(parsed);
        } catch (err) {
          console.warn(
            `[DataManager] fast-travel.json not found or invalid (${err instanceof Error ? err.message : String(err)}), fast travel graph will be empty`,
          );
        }
      })(),

      // Respawn manifest (optional). Authored bind-point registry
      // + death-penalty / corpse-run / resurrection global rules.
      // Runtime RespawnSystem not yet shipped — provider only
      // persists authored data for future consumption.
      (async () => {
        try {
          const res = await fetch(`${baseUrl}/respawn.json`);
          if (!res.ok) {
            throw new Error(`HTTP ${res.status}: ${res.statusText}`);
          }
          const raw = (await res.json()) as unknown;
          const parsed = respawnProvider.loadRaw(raw);
          // Seed runtime registry (parity with PIE hot-reload).
          respawnPolicyResolver.load(parsed);
        } catch (err) {
          console.warn(
            `[DataManager] respawn.json not found or invalid (${err instanceof Error ? err.message : String(err)}), respawn system will be disabled`,
          );
        }
      })(),

      // Talent-trees manifest (optional). Authored branching
      // progression registry — 6-kind tree enum + 6-kind node
      // enum DAG with prereq, tier gating, keystone/abilityGrant
      // refinements, and respec rules. Runtime TalentTreeSystem
      // not yet shipped — provider only persists authored data
      // for future consumption.
      (async () => {
        try {
          const res = await fetch(`${baseUrl}/talent-trees.json`);
          if (!res.ok) {
            throw new Error(`HTTP ${res.status}: ${res.statusText}`);
          }
          const raw = (await res.json()) as unknown;
          const parsed = talentTreesProvider.loadRaw(raw);
          // Seed runtime registry (parity with PIE hot-reload).
          talentTreeRegistry.load(parsed);
        } catch (err) {
          console.warn(
            `[DataManager] talent-trees.json not found or invalid (${err instanceof Error ? err.message : String(err)}), talent trees will be disabled`,
          );
        }
      })(),

      // Auction-house manifest (optional). Single policy blob
      // governing listing models, bidding anti-snipe, fees,
      // cancellation, search, and anti-manipulation heuristics.
      // Runtime AuctionHouseSystem not yet shipped — provider
      // only persists authored data for future consumption.
      (async () => {
        try {
          const res = await fetch(`${baseUrl}/auction-house.json`);
          if (!res.ok) {
            throw new Error(`HTTP ${res.status}: ${res.statusText}`);
          }
          const raw = (await res.json()) as unknown;
          const parsed = auctionHouseProvider.loadRaw(raw);
          // Seed runtime registry (parity with PIE hot-reload).
          auctionHouseRegistry.load(parsed);
        } catch (err) {
          console.warn(
            `[DataManager] auction-house.json not found or invalid (${err instanceof Error ? err.message : String(err)}), auction house will be disabled`,
          );
        }
      })(),

      // Transmog manifest (optional). Global cosmetic-override
      // rules + per-source appearance registry with 10-slot enum,
      // 6-unlock-model, per-char/per-account scope, race/class/
      // faction restrictions, and outfit-save rules. Runtime
      // TransmogSystem not yet shipped — provider only persists
      // authored data for future consumption.
      (async () => {
        try {
          const res = await fetch(`${baseUrl}/transmog.json`);
          if (!res.ok) {
            throw new Error(`HTTP ${res.status}: ${res.statusText}`);
          }
          const raw = (await res.json()) as unknown;
          const parsed = transmogProvider.loadRaw(raw);
          // Seed runtime registry (parity with PIE hot-reload).
          transmogRegistry.load(parsed);
        } catch (err) {
          console.warn(
            `[DataManager] transmog.json not found or invalid (${err instanceof Error ? err.message : String(err)}), transmog will be disabled`,
          );
        }
      })(),

      // Housing manifest (optional). Plot-type registry (6-category
      // apartment/cottage/manor/estate/openWorld/guildHall) with
      // per-plot size/slots/visitorCap/cost + global customization/
      // permissions/upkeep/visitors rule blocks. Runtime HousingSystem
      // not yet shipped — provider only persists authored data for
      // future consumption.
      (async () => {
        try {
          const res = await fetch(`${baseUrl}/housing.json`);
          if (!res.ok) {
            throw new Error(`HTTP ${res.status}: ${res.statusText}`);
          }
          const raw = (await res.json()) as unknown;
          const parsed = housingProvider.loadRaw(raw);
          // Seed runtime registry (parity with PIE hot-reload).
          housingRegistry.load(parsed);
        } catch (err) {
          console.warn(
            `[DataManager] housing.json not found or invalid (${err instanceof Error ? err.message : String(err)}), housing will be disabled`,
          );
        }
      })(),

      // Group-finder manifest (optional). LFG / dungeon-finder content
      // registry (7-kind dungeon/raid/scenario/battleground/arena/
      // worldBoss/custom) with min/max group size, role requirements,
      // 4-policy queue (random/specific/ranked/casual), level/gear/
      // rating gates, and matchmaking/rewards blocks. Runtime
      // GroupFinderSystem not yet shipped — provider only persists
      // authored data for future consumption.
      (async () => {
        try {
          const res = await fetch(`${baseUrl}/group-finder.json`);
          if (!res.ok) {
            throw new Error(`HTTP ${res.status}: ${res.statusText}`);
          }
          const raw = (await res.json()) as unknown;
          const parsed = groupFinderProvider.loadRaw(raw);
          // Seed runtime registry (parity with PIE hot-reload).
          groupFinderRegistry.load(parsed);
        } catch (err) {
          console.warn(
            `[DataManager] group-finder.json not found or invalid (${err instanceof Error ? err.message : String(err)}), group finder will be disabled`,
          );
        }
      })(),

      // Friends-social manifest (optional). MMO social graph policy
      // blob with friends/ignore/recent/onlineStatus rule groups.
      // Refinements enforce friends.scope == ignore.scope and
      // defaultVisibility='invisible' requires allowPlayerOverride.
      // Runtime SocialSystem not yet shipped — provider only persists
      // authored data for future consumption.
      (async () => {
        try {
          const res = await fetch(`${baseUrl}/friends-social.json`);
          if (!res.ok) {
            throw new Error(`HTTP ${res.status}: ${res.statusText}`);
          }
          const raw = (await res.json()) as unknown;
          const parsed = friendsSocialProvider.loadRaw(raw);
          // Seed runtime registry (parity with PIE hot-reload).
          friendsSocialRegistry.load(parsed);
        } catch (err) {
          console.warn(
            `[DataManager] friends-social.json not found or invalid (${err instanceof Error ? err.message : String(err)}), friends social will be disabled`,
          );
        }
      })(),

      // Loadouts manifest (optional). WoW Equipment-Manager-style
      // saved-configuration policy blob with maxSlotsPerCharacter
      // (premium freeSlotCount split), slot/naming/swap/sharing
      // rule groups. Runtime LoadoutSystem not yet shipped —
      // provider only persists authored data for future consumption.
      (async () => {
        try {
          const res = await fetch(`${baseUrl}/loadouts.json`);
          if (!res.ok) {
            throw new Error(`HTTP ${res.status}: ${res.statusText}`);
          }
          const raw = (await res.json()) as unknown;
          const parsed = loadoutsProvider.loadRaw(raw);
          // Seed runtime registry (parity with PIE hot-reload).
          loadoutPolicyRegistry.load(parsed);
        } catch (err) {
          console.warn(
            `[DataManager] loadouts.json not found or invalid (${err instanceof Error ? err.message : String(err)}), loadouts will be disabled`,
          );
        }
      })(),

      // Trading manifest (optional). P2P trade policy blob with
      // session/items/currency/eligibility/rateLimit/antiRmt rule
      // groups. Refinement rejects confirmMode='none' +
      // sessionTimeoutSec=0 (unsafe freeze vector) and rateLimit
      // day<hour. Runtime TradeSystem not yet shipped — provider
      // only persists authored data for future consumption.
      (async () => {
        try {
          const res = await fetch(`${baseUrl}/trading.json`);
          if (!res.ok) {
            throw new Error(`HTTP ${res.status}: ${res.statusText}`);
          }
          const raw = (await res.json()) as unknown;
          const parsed = tradingProvider.loadRaw(raw);
          // Seed runtime registry (parity with PIE hot-reload).
          tradingRegistry.load(parsed);
        } catch (err) {
          console.warn(
            `[DataManager] trading.json not found or invalid (${err instanceof Error ? err.message : String(err)}), trading will be disabled`,
          );
        }
      })(),

      // Item-sets manifest (optional). Array-shape registry of
      // set-bonus definitions (6-category raid/dungeon/crafted/
      // world/pvp/legacy) with incremental stages (2pc/4pc/6pc),
      // 20-stat modifiers, triggered effects. Globally-unique
      // triggered-effect ids enforced. Runtime ItemSetSystem not
      // yet shipped — provider only persists authored data.
      (async () => {
        try {
          const res = await fetch(`${baseUrl}/item-sets.json`);
          if (!res.ok) {
            throw new Error(`HTTP ${res.status}: ${res.statusText}`);
          }
          const raw = (await res.json()) as unknown;
          const parsed = itemSetsProvider.loadRaw(raw);
          // Seed runtime registry (parity with PIE hot-reload).
          itemSetRegistry.load(parsed);
        } catch (err) {
          console.warn(
            `[DataManager] item-sets.json not found or invalid (${err instanceof Error ? err.message : String(err)}), item sets will be disabled`,
          );
        }
      })(),

      // Leaderboards manifest (optional). Array-shape registry
      // of competitive boards (10-metric, 5-scope, 5-cadence,
      // tie-break, rank|percent reward brackets with non-overlap
      // refinement). Runtime LeaderboardSystem not yet shipped.
      (async () => {
        try {
          const res = await fetch(`${baseUrl}/leaderboards.json`);
          if (!res.ok) {
            throw new Error(`HTTP ${res.status}: ${res.statusText}`);
          }
          const raw = (await res.json()) as unknown;
          const parsed = leaderboardsProvider.loadRaw(raw);
          // Seed runtime leaderboard engine (parity with PIE hot-reload).
          leaderboardEngine.load(parsed);
        } catch (err) {
          console.warn(
            `[DataManager] leaderboards.json not found or invalid (${err instanceof Error ? err.message : String(err)}), leaderboards will be disabled`,
          );
        }
      })(),

      // Titles manifest (optional). Array-shape registry of
      // honorifics with 7-kind unlock discriminated union, 6-
      // rarity, 3-display-mode, revocation rules. Runtime
      // TitleSystem not yet shipped.
      (async () => {
        try {
          const res = await fetch(`${baseUrl}/titles.json`);
          if (!res.ok) {
            throw new Error(`HTTP ${res.status}: ${res.statusText}`);
          }
          const raw = (await res.json()) as unknown;
          const parsed = titlesProvider.loadRaw(raw);
          // Seed runtime registry (parity with PIE hot-reload).
          titleRegistry.load(parsed);
        } catch (err) {
          console.warn(
            `[DataManager] titles.json not found or invalid (${err instanceof Error ? err.message : String(err)}), titles will be disabled`,
          );
        }
      })(),

      // World-events manifest (optional). Array-shape FATE/public-
      // event/world-boss registry with 7-category, 5-kind trigger,
      // linear phase chain with success/failure branches, tiered
      // participation rewards. Runtime WorldEventSystem not yet
      // shipped.
      (async () => {
        try {
          const res = await fetch(`${baseUrl}/world-events.json`);
          if (!res.ok) {
            throw new Error(`HTTP ${res.status}: ${res.statusText}`);
          }
          const raw = (await res.json()) as unknown;
          const parsed = worldEventsProvider.loadRaw(raw);
          // Seed runtime registry (parity with PIE hot-reload).
          worldEventsRegistry.load(parsed);
        } catch (err) {
          console.warn(
            `[DataManager] world-events.json not found or invalid (${err instanceof Error ? err.message : String(err)}), world events will be disabled`,
          );
        }
      })(),

      // Seasons manifest (optional). Array-shape Battle-Pass/
      // live-ops registry with free|premium|bonus tracks, tiered
      // rewards, weekly/daily challenges, strict-before startsAt
      // <endsAt, non-overlapping windows. Runtime SeasonSystem not
      // yet shipped.
      (async () => {
        try {
          const res = await fetch(`${baseUrl}/seasons.json`);
          if (!res.ok) {
            throw new Error(`HTTP ${res.status}: ${res.statusText}`);
          }
          const raw = (await res.json()) as unknown;
          const parsed = seasonsProvider.loadRaw(raw);
          // Seed runtime registry (parity with PIE hot-reload).
          seasonRegistry.load(parsed);
        } catch (err) {
          console.warn(
            `[DataManager] seasons.json not found or invalid (${err instanceof Error ? err.message : String(err)}), seasons will be disabled`,
          );
        }
      })(),

      // Pet-companion manifest (optional). Array-shape registry
      // of summonable entities with 3-category (combat/utility/
      // cosmetic), slot subsets, summon rules, progression opt-in.
      // Cosmetic pets forbidden from abilities/progression.
      // Runtime PetSystem not yet shipped.
      (async () => {
        try {
          const res = await fetch(`${baseUrl}/pet-companion.json`);
          if (!res.ok) {
            throw new Error(`HTTP ${res.status}: ${res.statusText}`);
          }
          const raw = (await res.json()) as unknown;
          const parsed = petCompanionProvider.loadRaw(raw);
          // Seed runtime registry (parity with PIE hot-reload).
          petRegistry.load(parsed);
        } catch (err) {
          console.warn(
            `[DataManager] pet-companion.json not found or invalid (${err instanceof Error ? err.message : String(err)}), pets will be disabled`,
          );
        }
      })(),

      // Enchantments manifest (optional). Array-shape registry
      // of authored item modifiers (permanent/socket-gem/rune-word/
      // temporary). Runtime EnchantmentSystem not yet shipped.
      (async () => {
        try {
          const res = await fetch(`${baseUrl}/enchantments.json`);
          if (!res.ok) {
            throw new Error(`HTTP ${res.status}: ${res.statusText}`);
          }
          const raw = (await res.json()) as unknown;
          const parsed = enchantmentsProvider.loadRaw(raw);
          // Seed runtime registry (parity with PIE hot-reload).
          enchantmentRegistry.load(parsed);
        } catch (err) {
          console.warn(
            `[DataManager] enchantments.json not found or invalid (${err instanceof Error ? err.message : String(err)}), enchantments will be disabled`,
          );
        }
      })(),

      // Mail manifest (optional). Single policy blob (UE5-
      // DefaultMail.ini style) for player/auction/system/guild/gm
      // mail. Runtime MailSystem not yet shipped.
      (async () => {
        try {
          const res = await fetch(`${baseUrl}/mail.json`);
          if (!res.ok) {
            throw new Error(`HTTP ${res.status}: ${res.statusText}`);
          }
          const raw = (await res.json()) as unknown;
          const parsed = mailProvider.loadRaw(raw);
          // Seed runtime registry (parity with PIE hot-reload).
          mailPolicyRegistry.load(parsed);
        } catch (err) {
          console.warn(
            `[DataManager] mail.json not found or invalid (${err instanceof Error ? err.message : String(err)}), mail will be disabled`,
          );
        }
      })(),

      // Tooltips manifest (optional). UI tooltip registry keyed by
      // localization keys. Runtime TooltipsSystem not yet shipped.
      (async () => {
        try {
          const res = await fetch(`${baseUrl}/tooltips.json`);
          if (!res.ok) {
            throw new Error(`HTTP ${res.status}: ${res.statusText}`);
          }
          const raw = (await res.json()) as unknown;
          const parsed = tooltipsProvider.loadRaw(raw);
          // Seed runtime registry (parity with PIE hot-reload).
          tooltipRegistry.load(parsed);
        } catch (err) {
          console.warn(
            `[DataManager] tooltips.json not found or invalid (${err instanceof Error ? err.message : String(err)}), tooltips will be disabled`,
          );
        }
      })(),

      // Key-prompt-icons manifest (optional). 7-device input-glyph
      // catalog for on-screen prompts. Runtime KeyPromptIconsSystem
      // not yet shipped.
      (async () => {
        try {
          const res = await fetch(`${baseUrl}/key-prompt-icons.json`);
          if (!res.ok) {
            throw new Error(`HTTP ${res.status}: ${res.statusText}`);
          }
          const raw = (await res.json()) as unknown;
          const parsed = keyPromptIconsProvider.loadRaw(raw);
          // Seed runtime registry (parity with PIE hot-reload).
          keyPromptGlyphRegistry.load(parsed);
        } catch (err) {
          console.warn(
            `[DataManager] key-prompt-icons.json not found or invalid (${err instanceof Error ? err.message : String(err)}), key prompts will be disabled`,
          );
        }
      })(),

      // Screenshot manifest (optional). Photo-mode capture policy
      // with share-target registry. Runtime ScreenshotSystem not
      // yet shipped.
      (async () => {
        try {
          const res = await fetch(`${baseUrl}/screenshot.json`);
          if (!res.ok) {
            throw new Error(`HTTP ${res.status}: ${res.statusText}`);
          }
          const raw = (await res.json()) as unknown;
          const parsed = screenshotProvider.loadRaw(raw);
          // Seed runtime registry (parity with PIE hot-reload).
          screenshotRegistry.load(parsed);
        } catch (err) {
          console.warn(
            `[DataManager] screenshot.json not found or invalid (${err instanceof Error ? err.message : String(err)}), screenshots will be disabled`,
          );
        }
      })(),

      // Party-guild manifest (optional). Authored loot/xp
      // policies + guild rank hierarchy. Runtime PartyManager/
      // GuildRegistry not yet shipped — provider only persists
      // authored data. Missing/invalid leaves the provider
      // unloaded (safe default).
      (async () => {
        try {
          const res = await fetch(`${baseUrl}/party-guild.json`);
          if (!res.ok) {
            throw new Error(`HTTP ${res.status}: ${res.statusText}`);
          }
          const raw = (await res.json()) as unknown;
          const parsed = partyGuildProvider.loadRaw(raw);
          // Seed runtime registry (parity with PIE hot-reload).
          partyGuildRegistry.load(parsed);
        } catch (err) {
          console.warn(
            `[DataManager] party-guild.json not found or invalid (${err instanceof Error ? err.message : String(err)}), party/guild will be disabled`,
          );
        }
      })(),

      // Economy-tuning manifest (optional). Authored currency
      // registry + vendor/market/cost-curve tuning. Runtime
      // VendorSystem/AuctionHouseSystem not yet shipped.
      (async () => {
        try {
          const res = await fetch(`${baseUrl}/economy-tuning.json`);
          if (!res.ok) {
            throw new Error(`HTTP ${res.status}: ${res.statusText}`);
          }
          const raw = (await res.json()) as unknown;
          const parsed = economyTuningProvider.loadRaw(raw);
          // Seed runtime registry (parity with PIE hot-reload).
          economyTuningRegistry.load(parsed);
        } catch (err) {
          console.warn(
            `[DataManager] economy-tuning.json not found or invalid (${err instanceof Error ? err.message : String(err)}), economy tuning will be disabled`,
          );
        }
      })(),

      // Loading-screens manifest (optional). Authored slate
      // registry with weighted selection, fade rules, tip/
      // progress-bar toggles. Runtime LoadingScreensSystem not
      // yet shipped.
      (async () => {
        try {
          const res = await fetch(`${baseUrl}/loading-screens.json`);
          if (!res.ok) {
            throw new Error(`HTTP ${res.status}: ${res.statusText}`);
          }
          const raw = (await res.json()) as unknown;
          const parsed = loadingScreensProvider.loadRaw(raw);
          // Seed runtime registry (parity with PIE hot-reload).
          loadingScreensRegistry.load(parsed);
        } catch (err) {
          console.warn(
            `[DataManager] loading-screens.json not found or invalid (${err instanceof Error ? err.message : String(err)}), loading screens will be disabled`,
          );
        }
      })(),

      // Skybox-atmosphere manifest (optional). Authored sun/moon
      // discs, star field, cloud layers, atmospheric scattering.
      // Runtime SkyboxSystem not yet shipped.
      (async () => {
        try {
          const res = await fetch(`${baseUrl}/skybox-atmosphere.json`);
          if (!res.ok) {
            throw new Error(`HTTP ${res.status}: ${res.statusText}`);
          }
          const raw = (await res.json()) as unknown;
          const parsed = skyboxAtmosphereProvider.loadRaw(raw);
          // Seed runtime registry (parity with PIE hot-reload).
          skyboxAtmosphereRegistry.load(parsed);
        } catch (err) {
          console.warn(
            `[DataManager] skybox-atmosphere.json not found or invalid (${err instanceof Error ? err.message : String(err)}), skybox will be disabled`,
          );
        }
      })(),

      // Particle-graph manifest (optional). Authored Niagara-style
      // particle systems with emitter, initializers, updaters,
      // renderer. Runtime ParticleSystem compiler not yet shipped.
      (async () => {
        try {
          const res = await fetch(`${baseUrl}/particle-graph.json`);
          if (!res.ok) {
            throw new Error(`HTTP ${res.status}: ${res.statusText}`);
          }
          const raw = (await res.json()) as unknown;
          const parsed = particleGraphProvider.loadRaw(raw);
          // Seed runtime registry (parity with PIE hot-reload).
          particleGraphRegistry.load(parsed);
        } catch (err) {
          console.warn(
            `[DataManager] particle-graph.json not found or invalid (${err instanceof Error ? err.message : String(err)}), particle graph will be disabled`,
          );
        }
      })(),

      // Cinematic manifest (optional). Authored timeline cinematics
      // with 5-kind track discriminated union (camera/entity-pose/
      // dialogue/audio/event). Runtime CinematicPlayer not shipped.
      (async () => {
        try {
          const res = await fetch(`${baseUrl}/cinematic.json`);
          if (!res.ok) {
            throw new Error(`HTTP ${res.status}: ${res.statusText}`);
          }
          const raw = (await res.json()) as unknown;
          const parsed = cinematicProvider.loadRaw(raw);
          // Seed runtime registry (parity with PIE hot-reload).
          cinematicRegistry.load(parsed);
        } catch (err) {
          console.warn(
            `[DataManager] cinematic.json not found or invalid (${err instanceof Error ? err.message : String(err)}), cinematics will be disabled`,
          );
        }
      })(),

      // Editor-snap manifest (optional). Grid/surface snap defaults
      // + gizmo settings. Consumed by the editor at boot to seed
      // authoring snap behavior.
      (async () => {
        try {
          const res = await fetch(`${baseUrl}/editor-snap.json`);
          if (!res.ok) {
            throw new Error(`HTTP ${res.status}: ${res.statusText}`);
          }
          const raw = (await res.json()) as unknown;
          const parsed = editorSnapProvider.loadRaw(raw);
          // Seed runtime registry (parity with PIE hot-reload).
          editorSnapRegistry.load(parsed);
        } catch (err) {
          console.warn(
            `[DataManager] editor-snap.json not found or invalid (${err instanceof Error ? err.message : String(err)}), editor snap defaults will be used`,
          );
        }
      })(),

      // Deploy-targets manifest (optional). Named endpoints
      // referenced by crash-reporter/push-notifications/screenshot.
      // Carries only secret *names*, never real values.
      (async () => {
        try {
          const res = await fetch(`${baseUrl}/deploy-targets.json`);
          if (!res.ok) {
            throw new Error(`HTTP ${res.status}: ${res.statusText}`);
          }
          const raw = (await res.json()) as unknown;
          const parsed = deployTargetsProvider.loadRaw(raw);
          // Seed runtime registry (parity with PIE hot-reload).
          deployTargetsRegistry.load(parsed);
        } catch (err) {
          console.warn(
            `[DataManager] deploy-targets.json not found or invalid (${err instanceof Error ? err.message : String(err)}), deploy targets will be empty`,
          );
        }
      })(),

      // Input-actions manifest (optional). Author-side default
      // bindings. Runtime overrides come from UserInputBindings.
      (async () => {
        try {
          const res = await fetch(`${baseUrl}/input-actions.json`);
          if (!res.ok) {
            throw new Error(`HTTP ${res.status}: ${res.statusText}`);
          }
          const raw = (await res.json()) as unknown;
          const parsed = inputActionsProvider.loadRaw(raw);
          // Seed runtime registry (parity with PIE hot-reload).
          inputActionsRegistry.load(parsed);
        } catch (err) {
          console.warn(
            `[DataManager] input-actions.json not found or invalid (${err instanceof Error ? err.message : String(err)}), input actions will be empty`,
          );
        }
      })(),

      // Profiler-overlay manifest (optional). Declarative metrics
      // with threshold-driven color bands. Runtime profiler HUD not
      // yet shipped.
      (async () => {
        try {
          const res = await fetch(`${baseUrl}/profiler.json`);
          if (!res.ok) {
            throw new Error(`HTTP ${res.status}: ${res.statusText}`);
          }
          const raw = (await res.json()) as unknown;
          const parsed = profilerOverlayProvider.loadRaw(raw);
          // Seed runtime registry (parity with PIE hot-reload).
          profilerOverlayRegistry.load(parsed);
        } catch (err) {
          console.warn(
            `[DataManager] profiler.json not found or invalid (${err instanceof Error ? err.message : String(err)}), profiler overlay will be disabled`,
          );
        }
      })(),

      // Replication manifest (optional). Declarative replicated
      // fields + events so plugins can participate in netcode
      // without touching ServerNetwork. Runtime delta-replicator
      // not yet shipped.
      (async () => {
        try {
          const res = await fetch(`${baseUrl}/replication.json`);
          if (!res.ok) {
            throw new Error(`HTTP ${res.status}: ${res.statusText}`);
          }
          const raw = (await res.json()) as unknown;
          const parsed = replicationProvider.loadRaw(raw);
          // Seed runtime registry (parity with PIE hot-reload).
          replicationRegistry.load(parsed);
        } catch (err) {
          console.warn(
            `[DataManager] replication.json not found or invalid (${err instanceof Error ? err.message : String(err)}), authored replication contract will be disabled`,
          );
        }
      })(),

      // Prefab manifest (optional). Reusable entity composition
      // with sparse overrides + nested prefab DAG. Runtime prefab
      // instantiator not yet shipped.
      (async () => {
        try {
          const res = await fetch(`${baseUrl}/prefab.json`);
          if (!res.ok) {
            throw new Error(`HTTP ${res.status}: ${res.statusText}`);
          }
          const raw = (await res.json()) as unknown;
          const parsed = prefabProvider.loadRaw(raw);
          // Seed runtime registry (parity with PIE hot-reload).
          prefabRegistry.load(parsed);
        } catch (err) {
          console.warn(
            `[DataManager] prefab.json not found or invalid (${err instanceof Error ? err.message : String(err)}), prefab library will be disabled`,
          );
        }
      })(),

      // Level-streaming manifest (optional). Sublevels with
      // always-loaded / proximity / on-demand / server-authoritative
      // policies and trigger volumes. Runtime sublevel streamer
      // not yet shipped.
      (async () => {
        try {
          const res = await fetch(`${baseUrl}/level-streaming.json`);
          if (!res.ok) {
            throw new Error(`HTTP ${res.status}: ${res.statusText}`);
          }
          const raw = (await res.json()) as unknown;
          const parsed = levelStreamingProvider.loadRaw(raw);
          // Seed runtime registry (parity with PIE hot-reload).
          levelStreamingRegistry.load(parsed);
        } catch (err) {
          console.warn(
            `[DataManager] level-streaming.json not found or invalid (${err instanceof Error ? err.message : String(err)}), sublevel streaming will be disabled`,
          );
        }
      })(),

      // Lighting-bake manifest (optional). Offline lightmap + GI
      // bake settings with per-sublevel overrides. Runtime offline
      // baker not yet shipped.
      (async () => {
        try {
          const res = await fetch(`${baseUrl}/lighting-bake.json`);
          if (!res.ok) {
            throw new Error(`HTTP ${res.status}: ${res.statusText}`);
          }
          const raw = (await res.json()) as unknown;
          const parsed = lightingBakeProvider.loadRaw(raw);
          // Seed runtime registry (parity with PIE hot-reload).
          lightingBakeRegistry.load(parsed);
        } catch (err) {
          console.warn(
            `[DataManager] lighting-bake.json not found or invalid (${err instanceof Error ? err.message : String(err)}), offline lighting bake settings will be disabled`,
          );
        }
      })(),

      // Project-settings manifest (optional). Top-level project
      // identity (projectName + gameModeId) + installed plugin
      // list. No baseline fixture because projectName +
      // gameModeId are required.
      (async () => {
        try {
          const res = await fetch(`${baseUrl}/project-settings.json`);
          if (!res.ok) {
            throw new Error(`HTTP ${res.status}: ${res.statusText}`);
          }
          const raw = (await res.json()) as unknown;
          const parsed = projectSettingsProvider.loadRaw(raw);
          // Seed runtime registry (parity with PIE hot-reload).
          projectSettingsRegistry.load(parsed);
        } catch (err) {
          console.warn(
            `[DataManager] project-settings.json not found or invalid (${err instanceof Error ? err.message : String(err)}), project-level identity will be disabled`,
          );
        }
      })(),

      // AI-behavior manifest (optional). Array of named behavior
      // trees that the BehaviorTreeInterpreter can bind to by id.
      // Runtime binding registry not yet shipped.
      (async () => {
        try {
          const res = await fetch(`${baseUrl}/ai-behavior.json`);
          if (!res.ok) {
            throw new Error(`HTTP ${res.status}: ${res.statusText}`);
          }
          const raw = (await res.json()) as unknown;
          aiBehaviorProvider.loadRaw(raw);
        } catch (err) {
          console.warn(
            `[DataManager] ai-behavior.json not found or invalid (${err instanceof Error ? err.message : String(err)}), authored behavior trees will be disabled`,
          );
        }
      })(),

      // Animations manifest (optional). Clips + action→clip
      // bindings consumed by the (forthcoming) AnimationSystem.
      (async () => {
        try {
          const res = await fetch(`${baseUrl}/animations.json`);
          if (!res.ok) {
            throw new Error(`HTTP ${res.status}: ${res.statusText}`);
          }
          const raw = (await res.json()) as unknown;
          const parsed = animationsProvider.loadRaw(raw);
          // Seed runtime registry (parity with PIE hot-reload).
          animationRegistry.load(parsed);
        } catch (err) {
          console.warn(
            `[DataManager] animations.json not found or invalid (${err instanceof Error ? err.message : String(err)}), authored animation bindings will be disabled`,
          );
        }
      })(),

      // Quality-presets manifest (optional). Array of ordered
      // tiers (low/medium/high/ultra). No baseline — min(1) means
      // empty is schema-invalid.
      (async () => {
        try {
          const res = await fetch(`${baseUrl}/quality-presets.json`);
          if (!res.ok) {
            throw new Error(`HTTP ${res.status}: ${res.statusText}`);
          }
          const raw = (await res.json()) as unknown;
          const parsed = qualityPresetsProvider.loadRaw(raw);
          // Seed runtime registry (parity with PIE hot-reload).
          qualityPresetsRegistry.load(parsed);
        } catch (err) {
          console.warn(
            `[DataManager] quality-presets.json not found or invalid (${err instanceof Error ? err.message : String(err)}), authored quality presets will be disabled`,
          );
        }
      })(),

      // Nav-mesh manifest (optional). Voxelizer + agent profiles
      // + modifier volumes + jump links. No baseline — agents
      // min(1) means empty is schema-invalid.
      (async () => {
        try {
          const res = await fetch(`${baseUrl}/nav-mesh.json`);
          if (!res.ok) {
            throw new Error(`HTTP ${res.status}: ${res.statusText}`);
          }
          const raw = (await res.json()) as unknown;
          const parsed = navMeshProvider.loadRaw(raw);
          // Seed runtime registry (parity with PIE hot-reload).
          navMeshRegistry.load(parsed);
        } catch (err) {
          console.warn(
            `[DataManager] nav-mesh.json not found or invalid (${err instanceof Error ? err.message : String(err)}), authored nav-mesh settings will be disabled`,
          );
        }
      })(),

      // LOD-settings manifest (optional). Versioned distance
      // thresholds + dissolve transition. No baseline — required
      // fields with no defaults.
      (async () => {
        try {
          const res = await fetch(`${baseUrl}/lod-settings.json`);
          if (!res.ok) {
            throw new Error(`HTTP ${res.status}: ${res.statusText}`);
          }
          const raw = (await res.json()) as unknown;
          const parsed = lodSettingsProvider.loadRaw(raw);
          // Seed runtime registry (parity with PIE hot-reload).
          lodSettingsRegistry.load(parsed);
        } catch (err) {
          console.warn(
            `[DataManager] lod-settings.json not found or invalid (${err instanceof Error ? err.message : String(err)}), authored LOD settings will be disabled`,
          );
        }
      })(),

      // SFX manifest (optional). Authored SoundEffect registry
      // consumed by the (forthcoming) AudioSystem / 2D+3D spatial
      // layer. Baseline `[]` means no authored sounds.
      (async () => {
        try {
          const res = await fetch(`${baseUrl}/sfx.json`);
          if (!res.ok) {
            throw new Error(`HTTP ${res.status}: ${res.statusText}`);
          }
          const raw = (await res.json()) as unknown;
          const parsed = soundEffectsProvider.loadRaw(raw);
          // Seed runtime registry (parity with PIE hot-reload).
          sfxRegistry.load(parsed);
        } catch (err) {
          console.warn(
            `[DataManager] sfx.json not found or invalid (${err instanceof Error ? err.message : String(err)}), authored sound effects will be disabled`,
          );
        }
      })(),

      // VFX manifest (optional). Authored VfxEffect registry
      // consumed by the (forthcoming) VFX spawner. Baseline `[]`
      // means no authored effects.
      (async () => {
        try {
          const res = await fetch(`${baseUrl}/vfx.json`);
          if (!res.ok) {
            throw new Error(`HTTP ${res.status}: ${res.statusText}`);
          }
          const raw = (await res.json()) as unknown;
          const parsed = vfxProvider.loadRaw(raw);
          // Seed runtime registry (parity with PIE hot-reload).
          vfxRegistry.load(parsed);
        } catch (err) {
          console.warn(
            `[DataManager] vfx.json not found or invalid (${err instanceof Error ? err.message : String(err)}), authored VFX will be disabled`,
          );
        }
      })(),

      // Vegetation manifest (optional). Versioned asset registry
      // feeding procgen vegetation layers + biome layer
      // definitions. No baseline — version + assets required.
      (async () => {
        try {
          const res = await fetch(`${baseUrl}/vegetation.json`);
          if (!res.ok) {
            throw new Error(`HTTP ${res.status}: ${res.statusText}`);
          }
          const raw = (await res.json()) as unknown;
          const parsed = vegetationProvider.loadRaw(raw);
          // Seed runtime registry (parity with PIE hot-reload).
          vegetationRegistry.load(parsed);
        } catch (err) {
          console.warn(
            `[DataManager] vegetation.json not found or invalid (${err instanceof Error ? err.message : String(err)}), authored vegetation registry will be disabled`,
          );
        }
      })(),

      // Main-menu manifest (optional). Pre-game menu tree with
      // 9-action-kind entries. Baseline `{"enabled": false}`.
      (async () => {
        try {
          const res = await fetch(`${baseUrl}/main-menu.json`);
          if (!res.ok) {
            throw new Error(`HTTP ${res.status}: ${res.statusText}`);
          }
          const raw = (await res.json()) as unknown;
          const parsed = mainMenuProvider.loadRaw(raw);
          // Seed runtime registry (parity with PIE hot-reload).
          mainMenuRegistry.load(parsed);
        } catch (err) {
          console.warn(
            `[DataManager] main-menu.json not found or invalid (${err instanceof Error ? err.message : String(err)}), main menu tree will be disabled`,
          );
        }
      })(),

      // Credits manifest (optional). Credit-roll structure with
      // 7-entry-kind discriminated union. Baseline
      // `{"enabled": false}`.
      (async () => {
        try {
          const res = await fetch(`${baseUrl}/credits.json`);
          if (!res.ok) {
            throw new Error(`HTTP ${res.status}: ${res.statusText}`);
          }
          const raw = (await res.json()) as unknown;
          const parsed = creditsProvider.loadRaw(raw);
          // Seed runtime registry (parity with PIE hot-reload).
          creditsRegistry.load(parsed);
        } catch (err) {
          console.warn(
            `[DataManager] credits.json not found or invalid (${err instanceof Error ? err.message : String(err)}), credits roll will be disabled`,
          );
        }
      })(),

      // Music manifest (optional). Flat array of MusicTrack entries.
      // Baseline `[]`.
      (async () => {
        try {
          const res = await fetch(`${baseUrl}/music.json`);
          if (!res.ok) {
            throw new Error(`HTTP ${res.status}: ${res.statusText}`);
          }
          const raw = (await res.json()) as unknown;
          musicProvider.loadRaw(raw);
        } catch (err) {
          console.warn(
            `[DataManager] music.json not found or invalid (${err instanceof Error ? err.message : String(err)}), authored music tracks will be disabled`,
          );
        }
      })(),

      // Duel manifest (optional). Challenge timeout + rule/slot
      // definitions + slot mapping. No baseline — $schema and record
      // fields are required without defaults.
      (async () => {
        try {
          const res = await fetch(`${baseUrl}/duel.json`);
          if (!res.ok) {
            throw new Error(`HTTP ${res.status}: ${res.statusText}`);
          }
          const raw = (await res.json()) as unknown;
          const parsed = duelProvider.loadRaw(raw);
          // Seed runtime registry (parity with PIE hot-reload).
          duelRulesRegistry.load(parsed);
        } catch (err) {
          console.warn(
            `[DataManager] duel.json not found or invalid (${err instanceof Error ? err.message : String(err)}), duel rules will be disabled`,
          );
        }
      })(),

      // Duel-arenas manifest (optional). Hand-placed arena grid +
      // lobby/hospital transit areas + visual constants. No baseline —
      // arenas.nonempty() and required fields.
      (async () => {
        try {
          const res = await fetch(`${baseUrl}/duel-arenas.json`);
          if (!res.ok) {
            throw new Error(`HTTP ${res.status}: ${res.statusText}`);
          }
          const raw = (await res.json()) as unknown;
          duelArenasProvider.loadRaw(raw);
        } catch (err) {
          console.warn(
            `[DataManager] duel-arenas.json not found or invalid (${err instanceof Error ? err.message : String(err)}), streaming duel arenas will be disabled`,
          );
        }
      })(),

      // Biomes manifest (optional). Flat array of biome entries with
      // color schemes + vegetation layers + mob pools. Baseline `[]`.
      (async () => {
        try {
          const res = await fetch(`${baseUrl}/biomes.json`);
          if (!res.ok) {
            throw new Error(`HTTP ${res.status}: ${res.statusText}`);
          }
          const raw = (await res.json()) as unknown;
          const parsed = biomesProvider.loadRaw(raw);
          // Seed runtime registry (parity with PIE hot-reload).
          biomesRegistry.load(parsed);
        } catch (err) {
          console.warn(
            `[DataManager] biomes.json not found or invalid (${err instanceof Error ? err.message : String(err)}), authored biomes will be disabled`,
          );
        }
      })(),

      // Stores manifest (optional). Flat array of Store entries (shop
      // inventories, buyback rules, item stock). Baseline `[]`.
      (async () => {
        try {
          const res = await fetch(`${baseUrl}/stores.json`);
          if (!res.ok) {
            throw new Error(`HTTP ${res.status}: ${res.statusText}`);
          }
          const raw = (await res.json()) as unknown;
          const parsed = storesProvider.loadRaw(raw);
          // Seed runtime registry (parity with PIE hot-reload).
          storesRegistry.load(parsed);
        } catch (err) {
          console.warn(
            `[DataManager] stores.json not found or invalid (${err instanceof Error ? err.message : String(err)}), authored stores will be disabled`,
          );
        }
      })(),

      // Ammunition manifest (optional). Authored bow tiers + arrow
      // stats consumed by the combat runtime. No baseline fixture —
      // schema requires $schema + bowTiers + arrows with no defaults.
      (async () => {
        try {
          const res = await fetch(`${baseUrl}/ammunition.json`);
          if (!res.ok) {
            throw new Error(`HTTP ${res.status}: ${res.statusText}`);
          }
          const raw = (await res.json()) as unknown;
          const parsed = ammunitionProvider.loadRaw(raw);
          // Seed runtime registry (parity with PIE hot-reload).
          ammunitionRegistry.load(parsed);
        } catch (err) {
          console.warn(
            `[DataManager] ammunition.json not found or invalid (${err instanceof Error ? err.message : String(err)}), authored ammunition will be disabled`,
          );
        }
      })(),

      // Arena layout manifest (optional). Authored arena grid + lobby
      // + hospital geometry consumed by the streaming duel scheduler.
      // No baseline fixture — schema requires full layout with no defaults.
      (async () => {
        try {
          const res = await fetch(`${baseUrl}/arena-layout.json`);
          if (!res.ok) {
            throw new Error(`HTTP ${res.status}: ${res.statusText}`);
          }
          const raw = (await res.json()) as unknown;
          const parsed = arenaLayoutProvider.loadRaw(raw);
          // Seed runtime registry (parity with PIE hot-reload).
          arenaLayoutRegistry.load(parsed);
        } catch (err) {
          console.warn(
            `[DataManager] arena-layout.json not found or invalid (${err instanceof Error ? err.message : String(err)}), authored arena layout will be disabled`,
          );
        }
      })(),

      // Avatars manifest (optional). Authored VRM avatar catalog with
      // 3-tier LOD URLs + distance thresholds. No baseline fixture —
      // schema requires avatars.min(1) + lodDistances.
      (async () => {
        try {
          const res = await fetch(`${baseUrl}/avatars.json`);
          if (!res.ok) {
            throw new Error(`HTTP ${res.status}: ${res.statusText}`);
          }
          const raw = (await res.json()) as unknown;
          const parsed = avatarsProvider.loadRaw(raw);
          // Seed runtime registry (parity with PIE hot-reload).
          avatarsRegistry.load(parsed);
        } catch (err) {
          console.warn(
            `[DataManager] avatars.json not found or invalid (${err instanceof Error ? err.message : String(err)}), authored avatars will be disabled`,
          );
        }
      })(),

      // Banking manifest (optional). Authored bank sizes + UI settings
      // + transaction limits + error/message catalogs consumed by the
      // banking system runtime. No baseline fixture.
      (async () => {
        try {
          const res = await fetch(`${baseUrl}/banking.json`);
          if (!res.ok) {
            throw new Error(`HTTP ${res.status}: ${res.statusText}`);
          }
          const raw = (await res.json()) as unknown;
          const parsed = bankingProvider.loadRaw(raw);
          // Seed runtime registry (parity with PIE hot-reload).
          bankingRegistry.load(parsed);
        } catch (err) {
          console.warn(
            `[DataManager] banking.json not found or invalid (${err instanceof Error ? err.message : String(err)}), authored banking settings will be disabled`,
          );
        }
      })(),

      // Buildings manifest (optional). Flat array of building entries
      // consumed by procgen town placement. Baseline `[]` acceptable.
      (async () => {
        try {
          const res = await fetch(`${baseUrl}/buildings.json`);
          if (!res.ok) {
            throw new Error(`HTTP ${res.status}: ${res.statusText}`);
          }
          const raw = (await res.json()) as unknown;
          const parsed = buildingsProvider.loadRaw(raw);
          // Seed runtime registry (parity with PIE hot-reload).
          buildingsRegistry.load(parsed);
        } catch (err) {
          console.warn(
            `[DataManager] buildings.json not found or invalid (${err instanceof Error ? err.message : String(err)}), authored buildings will be disabled`,
          );
        }
      })(),

      // Tools manifest (optional). Flat array of gathering-skill tool
      // entries (hatchets, pickaxes, fishing gear). Baseline `[]`.
      (async () => {
        try {
          const res = await fetch(`${baseUrl}/tools.json`);
          if (!res.ok) {
            throw new Error(`HTTP ${res.status}: ${res.statusText}`);
          }
          const raw = (await res.json()) as unknown;
          const parsed = toolsProvider.loadRaw(raw);
          // Seed runtime registry (parity with PIE hot-reload).
          toolsRegistry.load(parsed);
        } catch (err) {
          console.warn(
            `[DataManager] tools.json not found or invalid (${err instanceof Error ? err.message : String(err)}), authored tools will be disabled`,
          );
        }
      })(),

      // Trees manifest (optional). Tree-type catalog keyed by subtype.
      // Baseline `{$schema, trees: {}}` acceptable.
      (async () => {
        try {
          const res = await fetch(`${baseUrl}/trees.json`);
          if (!res.ok) {
            throw new Error(`HTTP ${res.status}: ${res.statusText}`);
          }
          const raw = (await res.json()) as unknown;
          const parsed = treesProvider.loadRaw(raw);
          // Seed runtime registry (parity with PIE hot-reload).
          treeCatalogRegistry.load(parsed);
        } catch (err) {
          console.warn(
            `[DataManager] trees.json not found or invalid (${err instanceof Error ? err.message : String(err)}), authored trees will be disabled`,
          );
        }
      })(),

      // Weapon-styles manifest (optional). tile-based-MMORPG-accurate combat style
      // table by weapon type. No baseline — record key is exhaustive enum.
      (async () => {
        try {
          const res = await fetch(`${baseUrl}/weapon-styles.json`);
          if (!res.ok) {
            throw new Error(`HTTP ${res.status}: ${res.statusText}`);
          }
          const raw = (await res.json()) as unknown;
          const parsed = weaponStylesProvider.loadRaw(raw);
          // Seed runtime registry (parity with PIE hot-reload).
          weaponStylesRegistry.load(parsed);
        } catch (err) {
          console.warn(
            `[DataManager] weapon-styles.json not found or invalid (${err instanceof Error ? err.message : String(err)}), authored weapon styles will be disabled`,
          );
        }
      })(),

      // NPC-sizes manifest (optional). NPC footprint dimensions keyed
      // by NPC id. Baseline `{$schema, sizes: {}}` acceptable.
      (async () => {
        try {
          const res = await fetch(`${baseUrl}/npc-sizes.json`);
          if (!res.ok) {
            throw new Error(`HTTP ${res.status}: ${res.statusText}`);
          }
          const raw = (await res.json()) as unknown;
          const parsed = npcSizesProvider.loadRaw(raw);
          // Seed runtime registry (parity with PIE hot-reload).
          npcSizesRegistry.load(parsed);
        } catch (err) {
          console.warn(
            `[DataManager] npc-sizes.json not found or invalid (${err instanceof Error ? err.message : String(err)}), authored NPC sizes will be disabled`,
          );
        }
      })(),

      // Onboarding-goals manifest (optional). New-player goal graph.
      // Baseline `{enabled: false}` acceptable.
      (async () => {
        try {
          const res = await fetch(`${baseUrl}/onboarding-goals.json`);
          if (!res.ok) {
            throw new Error(`HTTP ${res.status}: ${res.statusText}`);
          }
          const raw = (await res.json()) as unknown;
          const parsed = onboardingGoalsProvider.loadRaw(raw);
          // Seed runtime registry (parity with PIE hot-reload).
          onboardingGoalsRegistry.load(parsed);
        } catch (err) {
          console.warn(
            `[DataManager] onboarding-goals.json not found or invalid (${err instanceof Error ? err.message : String(err)}), onboarding tracker will be disabled`,
          );
        }
      })(),

      // Skill-icons manifest (optional). tile-based-MMORPG-style UI display
      // metadata per skill + emoji icon lookup table. Runtime falls
      // back to legacy hardcoded skill icons when absent.
      (async () => {
        try {
          const res = await fetch(`${baseUrl}/skill-icons.json`);
          if (!res.ok) {
            throw new Error(`HTTP ${res.status}: ${res.statusText}`);
          }
          const raw = (await res.json()) as unknown;
          const parsed = skillIconsProvider.loadRaw(raw);
          // Seed runtime registry (parity with PIE hot-reload).
          skillIconsRegistry.load(parsed);
        } catch (err) {
          console.warn(
            `[DataManager] skill-icons.json not found or invalid (${err instanceof Error ? err.message : String(err)}), authored skill icons will be disabled`,
          );
        }
      })(),

      // Player-emotes manifest (optional). Avatar animation asset URLs
      // keyed by emote name + essential pre-load list. Runtime falls
      // back to legacy hardcoded emotes when absent.
      (async () => {
        try {
          const res = await fetch(`${baseUrl}/player-emotes.json`);
          if (!res.ok) {
            throw new Error(`HTTP ${res.status}: ${res.statusText}`);
          }
          const raw = (await res.json()) as unknown;
          const parsed = playerEmotesProvider.loadRaw(raw);
          // Seed runtime registry (parity with PIE hot-reload).
          playerEmotesRegistry.load(parsed);
        } catch (err) {
          console.warn(
            `[DataManager] player-emotes.json not found or invalid (${err instanceof Error ? err.message : String(err)}), authored player emotes will be disabled`,
          );
        }
      })(),

      // Skill-unlocks manifest (optional). tile-based-MMORPG-style level-unlock
      // notifications per skill. Baseline `{skills: {}}` acceptable.
      (async () => {
        try {
          const res = await fetch(`${baseUrl}/skill-unlocks.json`);
          if (!res.ok) {
            throw new Error(`HTTP ${res.status}: ${res.statusText}`);
          }
          const raw = (await res.json()) as unknown;
          const parsed = skillUnlocksProvider.loadRaw(raw);
          // Seed runtime registry (parity with PIE hot-reload).
          skillUnlocksRegistry.load(parsed);
        } catch (err) {
          console.warn(
            `[DataManager] skill-unlocks.json not found or invalid (${err instanceof Error ? err.message : String(err)}), skill unlock notifications will be disabled`,
          );
        }
      })(),

      // Matchmaking-tuning manifest (optional). Automatic matchmaking
      // queue policy. Baseline `{enabled: false}` acceptable.
      (async () => {
        try {
          const res = await fetch(`${baseUrl}/matchmaking-tuning.json`);
          if (!res.ok) {
            throw new Error(`HTTP ${res.status}: ${res.statusText}`);
          }
          const raw = (await res.json()) as unknown;
          const parsed = matchmakingTuningProvider.loadRaw(raw);
          // Seed runtime registry (parity with PIE hot-reload).
          matchmakingRegistry.load(parsed);
        } catch (err) {
          console.warn(
            `[DataManager] matchmaking-tuning.json not found or invalid (${err instanceof Error ? err.message : String(err)}), matchmaking defaults will apply`,
          );
        }
      })(),

      // Spell-visuals manifest (optional). Projectile visual params
      // (color, size, glow, trail, pulse) per spell/arrow id. Runtime
      // falls back to legacy hardcoded projectile visuals when absent.
      (async () => {
        try {
          const res = await fetch(`${baseUrl}/spell-visuals.json`);
          if (!res.ok) {
            throw new Error(`HTTP ${res.status}: ${res.statusText}`);
          }
          const raw = (await res.json()) as unknown;
          const parsed = spellVisualsProvider.loadRaw(raw);
          // Seed runtime registry (parity with PIE hot-reload).
          spellVisualsRegistry.load(parsed);
        } catch (err) {
          console.warn(
            `[DataManager] spell-visuals.json not found or invalid (${err instanceof Error ? err.message : String(err)}), authored spell visuals will be disabled`,
          );
        }
      })(),

      // Profiler manifest (optional). On-screen performance HUD
      // groups + metrics. Baseline `{}` acceptable.
      (async () => {
        try {
          const res = await fetch(`${baseUrl}/profiler.json`);
          if (!res.ok) {
            throw new Error(`HTTP ${res.status}: ${res.statusText}`);
          }
          const raw = (await res.json()) as unknown;
          profilerProvider.loadRaw(raw);
        } catch (err) {
          console.warn(
            `[DataManager] profiler.json not found or invalid (${err instanceof Error ? err.message : String(err)}), profiler overlay will use defaults`,
          );
        }
      })(),

      // Server-browser manifest (optional). Manual server list
      // filters/columns/sort policy. Baseline `{}` acceptable.
      (async () => {
        try {
          const res = await fetch(`${baseUrl}/server-browser.json`);
          if (!res.ok) {
            throw new Error(`HTTP ${res.status}: ${res.statusText}`);
          }
          const raw = (await res.json()) as unknown;
          const parsed = serverBrowserProvider.loadRaw(raw);
          // Seed runtime registry (parity with PIE hot-reload).
          serverBrowserRegistry.load(parsed);
        } catch (err) {
          console.warn(
            `[DataManager] server-browser.json not found or invalid (${err instanceof Error ? err.message : String(err)}), server browser will use defaults`,
          );
        }
      })(),

      // Store-front manifest (optional). Premium bundle catalog +
      // shelves + discount rules. Baseline `{}` acceptable.
      (async () => {
        try {
          const res = await fetch(`${baseUrl}/store-front.json`);
          if (!res.ok) {
            throw new Error(`HTTP ${res.status}: ${res.statusText}`);
          }
          const raw = (await res.json()) as unknown;
          const parsed = storeFrontProvider.loadRaw(raw);
          // Seed runtime registry (parity with PIE hot-reload).
          storeFrontRegistry.load(parsed);
        } catch (err) {
          console.warn(
            `[DataManager] store-front.json not found or invalid (${err instanceof Error ? err.message : String(err)}), premium store will be closed`,
          );
        }
      })(),

      // Commerce manifest (optional). Global commerce constants.
      // No safe baseline — runtime falls back to legacy hardcoded
      // constants when absent.
      (async () => {
        try {
          const res = await fetch(`${baseUrl}/commerce.json`);
          if (!res.ok) {
            throw new Error(`HTTP ${res.status}: ${res.statusText}`);
          }
          const raw = (await res.json()) as unknown;
          const parsed = commerceProvider.loadRaw(raw);
          // Seed runtime registry (parity with PIE hot-reload).
          commerceRegistry.load(parsed);
        } catch (err) {
          console.warn(
            `[DataManager] commerce.json not found or invalid (${err instanceof Error ? err.message : String(err)}), commerce constants will use legacy defaults`,
          );
        }
      })(),

      // Interaction manifest (optional). Session/interaction tuning
      // constants. No safe baseline — runtime falls back to legacy
      // hardcoded constants when absent.
      (async () => {
        try {
          const res = await fetch(`${baseUrl}/interaction.json`);
          if (!res.ok) {
            throw new Error(`HTTP ${res.status}: ${res.statusText}`);
          }
          const raw = (await res.json()) as unknown;
          const parsed = interactionProvider.loadRaw(raw);
          // Seed runtime registry (parity with PIE hot-reload).
          interactionConfigRegistry.load(parsed);
        } catch (err) {
          console.warn(
            `[DataManager] interaction.json not found or invalid (${err instanceof Error ? err.message : String(err)}), interaction constants will use legacy defaults`,
          );
        }
      })(),

      // Combat manifest (optional). Authored ranges/ticks/food/hit-
      // delay/projectiles/rotation/aggro tables. Runtime falls back
      // to legacy hardcoded CombatConstants when absent.
      (async () => {
        try {
          const res = await fetch(`${baseUrl}/combat-constants.json`);
          if (!res.ok) {
            throw new Error(`HTTP ${res.status}: ${res.statusText}`);
          }
          const raw = (await res.json()) as unknown;
          combatProvider.loadRaw(raw);
        } catch (err) {
          console.warn(
            `[DataManager] combat-constants.json not found or invalid (${err instanceof Error ? err.message : String(err)}), combat constants will use legacy defaults`,
          );
        }
      })(),

      // Equipment manifest (optional). Authored slot + bank grid
      // layout + error messages. Runtime falls back to legacy
      // hardcoded EquipmentConstants when absent.
      (async () => {
        try {
          const res = await fetch(`${baseUrl}/equipment-constants.json`);
          if (!res.ok) {
            throw new Error(`HTTP ${res.status}: ${res.statusText}`);
          }
          const raw = (await res.json()) as unknown;
          const parsed = equipmentProvider.loadRaw(raw);
          // Seed runtime registry (parity with PIE hot-reload).
          equipmentManifestRegistry.load(parsed);
        } catch (err) {
          console.warn(
            `[DataManager] equipment-constants.json not found or invalid (${err instanceof Error ? err.message : String(err)}), equipment constants will use legacy defaults`,
          );
        }
      })(),

      // Game manifest (optional). Engine-wide constants —
      // inventory/player/home-teleport/xp/distance/ui/physics/camera/network.
      // Runtime falls back to legacy hardcoded GameConstants when absent.
      (async () => {
        try {
          const res = await fetch(`${baseUrl}/game-constants.json`);
          if (!res.ok) {
            throw new Error(`HTTP ${res.status}: ${res.statusText}`);
          }
          const raw = (await res.json()) as unknown;
          gameProvider.loadRaw(raw);
        } catch (err) {
          console.warn(
            `[DataManager] game-constants.json not found or invalid (${err instanceof Error ? err.message : String(err)}), game constants will use legacy defaults`,
          );
        }
      })(),

      // Smithing manifest (optional). Authored bar/recipe ticks +
      // anvil messages + validation limits. Runtime falls back to
      // legacy hardcoded SmithingConstants when absent.
      (async () => {
        try {
          const res = await fetch(`${baseUrl}/smithing-constants.json`);
          if (!res.ok) {
            throw new Error(`HTTP ${res.status}: ${res.statusText}`);
          }
          const raw = (await res.json()) as unknown;
          const parsed = smithingProvider.loadRaw(raw);
          // Seed runtime registry (parity with PIE hot-reload).
          smithingRegistry.load(parsed);
        } catch (err) {
          console.warn(
            `[DataManager] smithing-constants.json not found or invalid (${err instanceof Error ? err.message : String(err)}), smithing constants will use legacy defaults`,
          );
        }
      })(),

      // World-structure manifest (optional). High-level world
      // constants — grid size, water level, build height, safe zone.
      // Runtime falls back to legacy hardcoded WorldStructureConstants
      // when absent.
      (async () => {
        try {
          const res = await fetch(`${baseUrl}/world-structure.json`);
          if (!res.ok) {
            throw new Error(`HTTP ${res.status}: ${res.statusText}`);
          }
          const raw = (await res.json()) as unknown;
          worldStructureProvider.loadRaw(raw);
        } catch (err) {
          console.warn(
            `[DataManager] world-structure.json not found or invalid (${err instanceof Error ? err.message : String(err)}), world structure constants will use legacy defaults`,
          );
        }
      })(),

      // Gathering manifest (optional). Woodcutting/mining/fishing
      // skill mechanics, ranges, timing. Runtime falls back to legacy
      // hardcoded GatheringConstants when absent.
      (async () => {
        try {
          const res = await fetch(`${baseUrl}/gathering-constants.json`);
          if (!res.ok) {
            throw new Error(`HTTP ${res.status}: ${res.statusText}`);
          }
          const raw = (await res.json()) as unknown;
          gatheringProvider.loadRaw(raw);
        } catch (err) {
          console.warn(
            `[DataManager] gathering-constants.json not found or invalid (${err instanceof Error ? err.message : String(err)}), gathering constants will use legacy defaults`,
          );
        }
      })(),

      // Processing manifest (optional). Firemaking/cooking skill
      // mechanics, success rates, fire duration, fire-walk priority.
      // Runtime falls back to legacy hardcoded ProcessingConstants
      // when absent. Distinct from ProcessingDataProvider (recipes).
      (async () => {
        try {
          const res = await fetch(`${baseUrl}/processing-constants.json`);
          if (!res.ok) {
            throw new Error(`HTTP ${res.status}: ${res.statusText}`);
          }
          const raw = (await res.json()) as unknown;
          const parsed = processingProvider.loadRaw(raw);
          // Seed runtime registry (parity with PIE hot-reload).
          processingRegistry.load(parsed);
        } catch (err) {
          console.warn(
            `[DataManager] processing-constants.json not found or invalid (${err instanceof Error ? err.message : String(err)}), processing constants will use legacy defaults`,
          );
        }
      })(),

      // Woodcutting manifest (optional). Authored tree resource
      // definitions. Runtime gathering path still parses inline in
      // DataManager; provider gives boot-load anchor for future rewire.
      (async () => {
        try {
          const res = await fetch(`${baseUrl}/gathering/woodcutting.json`);
          if (!res.ok) {
            throw new Error(`HTTP ${res.status}: ${res.statusText}`);
          }
          const raw = (await res.json()) as unknown;
          woodcuttingProvider.loadRaw(raw);
        } catch (err) {
          console.warn(
            `[DataManager] gathering/woodcutting.json not found or invalid (${err instanceof Error ? err.message : String(err)}), woodcutting provider stays unloaded`,
          );
        }
      })(),

      // Mining manifest (optional). Authored rock resource
      // definitions. Runtime gathering path still parses inline in
      // DataManager; provider gives boot-load anchor for future rewire.
      (async () => {
        try {
          const res = await fetch(`${baseUrl}/gathering/mining.json`);
          if (!res.ok) {
            throw new Error(`HTTP ${res.status}: ${res.statusText}`);
          }
          const raw = (await res.json()) as unknown;
          miningProvider.loadRaw(raw);
        } catch (err) {
          console.warn(
            `[DataManager] gathering/mining.json not found or invalid (${err instanceof Error ? err.message : String(err)}), mining provider stays unloaded`,
          );
        }
      })(),

      // Fishing manifest (optional). Authored fishing spot
      // definitions. Runtime gathering path still parses inline in
      // DataManager; provider gives boot-load anchor for future rewire.
      (async () => {
        try {
          const res = await fetch(`${baseUrl}/gathering/fishing.json`);
          if (!res.ok) {
            throw new Error(`HTTP ${res.status}: ${res.statusText}`);
          }
          const raw = (await res.json()) as unknown;
          fishingProvider.loadRaw(raw);
        } catch (err) {
          console.warn(
            `[DataManager] gathering/fishing.json not found or invalid (${err instanceof Error ? err.message : String(err)}), fishing provider stays unloaded`,
          );
        }
      })(),

      // Combat-spells manifest (optional). Boot-load anchor for
      // hot reload; runtime still parses inline in combat-spells.ts.
      (async () => {
        try {
          const res = await fetch(`${baseUrl}/combat-spells.json`);
          if (!res.ok) {
            throw new Error(`HTTP ${res.status}: ${res.statusText}`);
          }
          const raw = (await res.json()) as unknown;
          combatSpellsProvider.loadRaw(raw);
        } catch (err) {
          console.warn(
            `[DataManager] combat-spells.json not found or invalid (${err instanceof Error ? err.message : String(err)}), combat-spells provider stays unloaded`,
          );
        }
      })(),

      // Npcs spawn-constants manifest (optional). Boot-load anchor
      // for hot reload of spawn rule constants.
      (async () => {
        try {
          const res = await fetch(`${baseUrl}/npcs-spawn-constants.json`);
          if (!res.ok) {
            throw new Error(`HTTP ${res.status}: ${res.statusText}`);
          }
          const raw = (await res.json()) as unknown;
          npcsProvider.loadRaw(raw);
        } catch (err) {
          console.warn(
            `[DataManager] npcs-spawn-constants.json not found or invalid (${err instanceof Error ? err.message : String(err)}), npcs provider stays unloaded`,
          );
        }
      })(),

      // Quests manifest (optional; safe baseline = empty record).
      (async () => {
        try {
          const res = await fetch(`${baseUrl}/quests.json`);
          if (!res.ok) {
            throw new Error(`HTTP ${res.status}: ${res.statusText}`);
          }
          const raw = (await res.json()) as unknown;
          questsProvider.loadRaw(raw);
        } catch (err) {
          console.warn(
            `[DataManager] quests.json not found or invalid (${err instanceof Error ? err.message : String(err)}), quests provider stays unloaded`,
          );
        }
      })(),

      // Plugin registry manifest (optional; safe baseline = {} → empty plugins).
      (async () => {
        try {
          const res = await fetch(`${baseUrl}/plugin-registry.json`);
          if (!res.ok) {
            throw new Error(`HTTP ${res.status}: ${res.statusText}`);
          }
          const raw = (await res.json()) as unknown;
          pluginRegistryProvider.loadRaw(raw);
        } catch (err) {
          console.warn(
            `[DataManager] plugin-registry.json not found or invalid (${err instanceof Error ? err.message : String(err)}), plugin registry provider stays unloaded`,
          );
        }
      })(),

      // World-areas manifest (optional; safe baseline = 5 empty records).
      (async () => {
        try {
          const res = await fetch(`${baseUrl}/world-areas.json`);
          if (!res.ok) {
            throw new Error(`HTTP ${res.status}: ${res.statusText}`);
          }
          const raw = (await res.json()) as unknown;
          const parsed = worldAreasProvider.loadRaw(raw);
          // Seed runtime registry (parity with PIE hot-reload).
          worldAreasRegistry.load(parsed);
        } catch (err) {
          console.warn(
            `[DataManager] world-areas.json not found or invalid (${err instanceof Error ? err.message : String(err)}), world-areas provider stays unloaded`,
          );
        }
      })(),

      // World-config manifest (optional). Complements the existing
      // `DataManager.setWorldConfig()` static setter.
      (async () => {
        try {
          const res = await fetch(`${baseUrl}/world-config.json`);
          if (!res.ok) {
            throw new Error(`HTTP ${res.status}: ${res.statusText}`);
          }
          const raw = (await res.json()) as unknown;
          worldConfigProvider.loadRaw(raw);
        } catch (err) {
          console.warn(
            `[DataManager] world-config.json not found or invalid (${err instanceof Error ? err.message : String(err)}), world-config provider stays unloaded`,
          );
        }
      })(),

      // Factions manifest (optional). Authored reputation graph
      // with tier bands + sparse pairwise relationships. Runtime
      // FactionSystem is not yet shipped — provider only persists
      // authored data for future consumption. Missing/invalid leaves
      // the provider unloaded.
      (async () => {
        try {
          const res = await fetch(`${baseUrl}/factions.json`);
          if (!res.ok) {
            throw new Error(`HTTP ${res.status}: ${res.statusText}`);
          }
          const raw = (await res.json()) as unknown;
          const parsed = factionsProvider.loadRaw(raw);
          // Seed runtime registry (parity with PIE hot-reload).
          factionsRegistry.load(parsed);
        } catch (err) {
          console.warn(
            `[DataManager] factions.json not found or invalid (${err instanceof Error ? err.message : String(err)}), faction system will be disabled`,
          );
        }
      })(),

      // Save-data manifest (optional). Consumed by the Apr-20
      // SaveDataMigrator + SaveDataRegistry — plugin-contributed
      // persisted state slices with versioned single-step migrations.
      // Missing/invalid leaves the provider unloaded → no authored
      // slices, only the engine's built-in persistence.
      (async () => {
        try {
          const res = await fetch(`${baseUrl}/save-data.json`);
          if (!res.ok) {
            throw new Error(`HTTP ${res.status}: ${res.statusText}`);
          }
          const raw = (await res.json()) as unknown;
          saveDataProvider.loadRaw(raw);
        } catch (err) {
          console.warn(
            `[DataManager] save-data.json not found or invalid (${err instanceof Error ? err.message : String(err)}), plugin save-data slices will be disabled`,
          );
        }
      })(),

      // Music-state-machine manifest (optional). Consumed by the
      // Apr-20 MusicStateController + MusicStateMachineRegistry —
      // dynamic music graphs (explore/combat/boss/victory) with
      // predicate-gated transitions + crossfades + stingers.
      // Missing/invalid leaves the provider unloaded → audio layer
      // has no state machines to drive.
      (async () => {
        try {
          const res = await fetch(`${baseUrl}/music-state-machine.json`);
          if (!res.ok) {
            throw new Error(`HTTP ${res.status}: ${res.statusText}`);
          }
          const raw = (await res.json()) as unknown;
          const parsed = musicStateMachineProvider.loadRaw(raw);
          // Seed runtime music-state registry (parity with PIE path).
          musicStateMachineRegistry.load(parsed);
        } catch (err) {
          console.warn(
            `[DataManager] music-state-machine.json not found or invalid (${err instanceof Error ? err.message : String(err)}), dynamic music state machines will be disabled`,
          );
        }
      })(),

      // Interaction-prompts manifest (optional). Consumed by the
      // Apr-20 InteractionPromptSelector + InteractionPromptRegistry
      // — "Press [E] to open chest", "Hold [F] to loot", etc.
      // Missing/invalid leaves the provider unloaded → HUD silently
      // skips the prompt layer.
      (async () => {
        try {
          const res = await fetch(`${baseUrl}/interaction-prompts.json`);
          if (!res.ok) {
            throw new Error(`HTTP ${res.status}: ${res.statusText}`);
          }
          const raw = (await res.json()) as unknown;
          const parsed = interactionPromptsProvider.loadRaw(raw);
          // Seed runtime prompt registry (parity with PIE path).
          interactionPromptRegistry.load(parsed);
        } catch (err) {
          console.warn(
            `[DataManager] interaction-prompts.json not found or invalid (${err instanceof Error ? err.message : String(err)}), interaction HUD prompts will be disabled`,
          );
        }
      })(),

      // Loot tables manifest (optional). When absent or invalid,
      // LootSystem falls back to the legacy LootTableService path for
      // every mob type (no authored rolls).
      (async () => {
        try {
          const res = await fetch(`${baseUrl}/loot-tables.json`);
          if (!res.ok) {
            throw new Error(`HTTP ${res.status}: ${res.statusText}`);
          }
          const raw = (await res.json()) as unknown;
          lootTablesProvider.loadRaw(raw);
        } catch (err) {
          console.warn(
            `[DataManager] loot-tables.json not found or invalid (${err instanceof Error ? err.message : String(err)}), LootSystem will use legacy drop tables`,
          );
        }
      })(),

      // Mob → loot-table mappings manifest (optional). Without this,
      // no `mobType` is bound to the authored roller and every death
      // falls through to the legacy service.
      (async () => {
        try {
          const res = await fetch(`${baseUrl}/mob-loot-table-mappings.json`);
          if (!res.ok) {
            throw new Error(`HTTP ${res.status}: ${res.statusText}`);
          }
          const raw = (await res.json()) as unknown;
          mobLootTableMappingsProvider.loadRaw(raw);
        } catch (err) {
          console.warn(
            `[DataManager] mob-loot-table-mappings.json not found or invalid (${err instanceof Error ? err.message : String(err)}), authored mob→table mappings will be unavailable`,
          );
        }
      })(),

      // Dialogue manifest (optional). When absent or invalid,
      // DialogueSystem falls back to the legacy `NPCDialogueTree` data
      // embedded in `npcs.json` for every NPC.
      (async () => {
        try {
          const res = await fetch(`${baseUrl}/dialogue.json`);
          if (!res.ok) {
            throw new Error(`HTTP ${res.status}: ${res.statusText}`);
          }
          const raw = (await res.json()) as unknown;
          dialogueProvider.loadRaw(raw);
        } catch (err) {
          console.warn(
            `[DataManager] dialogue.json not found or invalid (${err instanceof Error ? err.message : String(err)}), authored dialogue trees will be unavailable`,
          );
        }
      })(),

      // NPC → authored-dialogue-tree bindings manifest (optional).
      // Without this, no NPC is routed to an authored tree and every
      // interaction falls through to the legacy `npcs.json` tree.
      (async () => {
        try {
          const res = await fetch(`${baseUrl}/npc-dialogue-bindings.json`);
          if (!res.ok) {
            throw new Error(`HTTP ${res.status}: ${res.statusText}`);
          }
          const raw = (await res.json()) as unknown;
          npcDialogueBindingsProvider.loadRaw(raw);
        } catch (err) {
          console.warn(
            `[DataManager] npc-dialogue-bindings.json not found or invalid (${err instanceof Error ? err.message : String(err)}), authored NPC→tree bindings will be unavailable`,
          );
        }
      })(),

      // Localization bundle (optional). When absent or invalid,
      // DialogueSystem keeps no catalog and authored dialogue textKeys
      // echo raw instead of resolving to translated strings.
      (async () => {
        try {
          const res = await fetch(`${baseUrl}/localization.json`);
          if (!res.ok) {
            throw new Error(`HTTP ${res.status}: ${res.statusText}`);
          }
          const raw = (await res.json()) as unknown;
          localizationProvider.loadRaw(raw);
        } catch (err) {
          console.warn(
            `[DataManager] localization.json not found or invalid (${err instanceof Error ? err.message : String(err)}), authored textKeys will echo raw`,
          );
        }
      })(),

      // Model bounds → stations (sequential dependency: bounds must load before stations)
      (async () => {
        try {
          const boundsRes = await fetch(`${baseUrl}/model-bounds.json`);
          const boundsManifest =
            (await boundsRes.json()) as ModelBoundsManifest;
          stationDataProvider.loadModelBounds(boundsManifest);
        } catch {
          console.warn(
            "[DataManager] model-bounds.json not found, using default footprints",
          );
        }

        // Stations depends on model-bounds being loaded first
        try {
          const stationsRes = await fetch(`${baseUrl}/stations.json`);
          const stationsManifest =
            (await stationsRes.json()) as StationsManifest;
          stationDataProvider.loadStations(stationsManifest);
        } catch {
          console.warn(
            "[DataManager] stations.json not found, using default station data",
          );
        }
      })(),
    ]);

    // Rebuild ProcessingDataProvider to use the loaded manifests
    // This is necessary in case it was already lazy-initialized before manifests loaded
    processingDataProvider.rebuild();
  }

  /**
   * Load recipe manifests from filesystem (server-side)
   */
  private async loadRecipeManifestsFromFilesystem(
    fs: typeof import("fs/promises"),
    path: typeof import("path"),
    manifestsDir: string,
  ): Promise<void> {
    const recipesDir = path.join(manifestsDir, "recipes");

    // Load cooking recipes
    try {
      const cookingPath = path.join(recipesDir, "cooking.json");
      const cookingData = await fs.readFile(cookingPath, "utf-8");
      const cookingManifest = JSON.parse(cookingData) as CookingManifest;
      processingDataProvider.loadCookingRecipes(cookingManifest);
    } catch {
      console.warn(
        "[DataManager] recipes/cooking.json not found, falling back to embedded item data",
      );
    }

    // Load firemaking recipes
    try {
      const firemakingPath = path.join(recipesDir, "firemaking.json");
      const firemakingData = await fs.readFile(firemakingPath, "utf-8");
      const firemakingManifest = JSON.parse(
        firemakingData,
      ) as FiremakingManifest;
      processingDataProvider.loadFiremakingRecipes(firemakingManifest);
    } catch {
      console.warn(
        "[DataManager] recipes/firemaking.json not found, falling back to embedded item data",
      );
    }

    // Load smelting recipes
    try {
      const smeltingPath = path.join(recipesDir, "smelting.json");
      const smeltingData = await fs.readFile(smeltingPath, "utf-8");
      const smeltingManifest = JSON.parse(smeltingData) as SmeltingManifest;
      processingDataProvider.loadSmeltingRecipes(smeltingManifest);
    } catch {
      console.warn(
        "[DataManager] recipes/smelting.json not found, falling back to embedded item data",
      );
    }

    // Load smithing recipes
    try {
      const smithingPath = path.join(recipesDir, "smithing.json");
      const smithingData = await fs.readFile(smithingPath, "utf-8");
      const smithingManifest = JSON.parse(smithingData) as SmithingManifest;
      processingDataProvider.loadSmithingRecipes(smithingManifest);
    } catch {
      warnOptionalData(
        "[DataManager] recipes/smithing.json not found, falling back to embedded item data",
      );
    }

    // Load crafting recipes
    try {
      const craftingPath = path.join(recipesDir, "crafting.json");
      const craftingData = await fs.readFile(craftingPath, "utf-8");
      const craftingManifest = JSON.parse(craftingData) as CraftingManifest;
      processingDataProvider.loadCraftingRecipes(craftingManifest);
    } catch (e: unknown) {
      warnOptionalData(
        `[DataManager] recipes/crafting.json failed to load: ${e instanceof Error ? e.message : "unknown error"}`,
      );
    }

    // Load tanning recipes
    try {
      const tanningPath = path.join(recipesDir, "tanning.json");
      const tanningData = await fs.readFile(tanningPath, "utf-8");
      const tanningManifest = JSON.parse(tanningData) as TanningManifest;
      processingDataProvider.loadTanningRecipes(tanningManifest);
    } catch {
      warnOptionalData(
        "[DataManager] recipes/tanning.json not found, tanning will be unavailable",
      );
    }

    // Load fletching recipes
    try {
      const fletchingPath = path.join(recipesDir, "fletching.json");
      const fletchingData = await fs.readFile(fletchingPath, "utf-8");
      const fletchingManifest = JSON.parse(fletchingData) as FletchingManifest;
      processingDataProvider.loadFletchingRecipes(fletchingManifest);
    } catch {
      warnOptionalData(
        "[DataManager] recipes/fletching.json not found, fletching will be unavailable",
      );
    }

    // Load runecrafting recipes
    try {
      const runecraftingPath = path.join(recipesDir, "runecrafting.json");
      const runecraftingData = await fs.readFile(runecraftingPath, "utf-8");
      const runecraftingManifest = JSON.parse(
        runecraftingData,
      ) as RunecraftingManifest;
      processingDataProvider.loadRunecraftingRecipes(runecraftingManifest);
    } catch {
      warnOptionalData(
        "[DataManager] recipes/runecrafting.json not found, runecrafting will be unavailable",
      );
    }

    // Load prayer manifest
    try {
      const prayersPath = path.join(manifestsDir, "prayers.json");
      const prayersData = await fs.readFile(prayersPath, "utf-8");
      const prayersManifest = JSON.parse(prayersData) as PrayersManifest;
      prayerDataProvider.loadPrayers(prayersManifest);
      prayerDataProvider.rebuild();
    } catch (err) {
      console.warn(
        `[DataManager] prayers.json not found (${err instanceof Error ? err.message : String(err)}), prayer system will be unavailable`,
      );
    }

    // Load dialogue condition bindings manifest (optional — servers
    // without authored bindings stay on the safe empty default).
    try {
      const bindingsPath = path.join(
        manifestsDir,
        "dialogue-condition-bindings.json",
      );
      const bindingsData = await fs.readFile(bindingsPath, "utf-8");
      const raw = JSON.parse(bindingsData) as unknown;
      dialogueConditionBindingsProvider.loadRaw(raw);
    } catch (err) {
      console.warn(
        `[DataManager] dialogue-condition-bindings.json not found or invalid (${err instanceof Error ? err.message : String(err)}), authored dialogue predicates will be unavailable`,
      );
    }

    // Load combat tuning manifest (optional — DuelCombatAI falls back
    // to hardcoded per-role defaults when no manifest is present).
    try {
      const tuningPath = path.join(manifestsDir, "combat-tuning.json");
      const tuningData = await fs.readFile(tuningPath, "utf-8");
      const raw = JSON.parse(tuningData) as unknown;
      combatTuningProvider.loadRaw(raw);
    } catch (err) {
      console.warn(
        `[DataManager] combat-tuning.json not found or invalid (${err instanceof Error ? err.message : String(err)}), duel AI will use hardcoded defaults`,
      );
    }

    // Load per-agent combat-tuning bindings manifest (optional).
    // Restored by StreamingDuelScheduler on boot so editor-authored
    // overrides (character → profile) survive server restart.
    try {
      const bindingsPath = path.join(
        manifestsDir,
        "combat-tuning-agent-bindings.json",
      );
      const bindingsData = await fs.readFile(bindingsPath, "utf-8");
      const raw = JSON.parse(bindingsData) as unknown;
      combatTuningAgentBindingsProvider.loadRaw(raw);
    } catch (err) {
      console.warn(
        `[DataManager] combat-tuning-agent-bindings.json not found or invalid (${err instanceof Error ? err.message : String(err)}), per-agent tuning overrides will be unavailable`,
      );
    }

    // Load XP curves manifest (optional — consumers fall back to
    // hardcoded XP tables when absent).
    try {
      const curvesPath = path.join(manifestsDir, "xp-curves.json");
      const curvesData = await fs.readFile(curvesPath, "utf-8");
      const raw = JSON.parse(curvesData) as unknown;
      const parsed = xpCurvesProvider.loadRaw(raw);
      // Seed runtime registry (parity with PIE hot-reload).
      xpCurveRegistry.load(parsed);
    } catch (err) {
      console.warn(
        `[DataManager] xp-curves.json not found or invalid (${err instanceof Error ? err.message : String(err)}), level↔xp resolution will use hardcoded tables`,
      );
    }

    // Load achievements manifest (optional).
    try {
      const achievementsPath = path.join(manifestsDir, "achievements.json");
      const achievementsData = await fs.readFile(achievementsPath, "utf-8");
      const raw = JSON.parse(achievementsData) as unknown;
      const parsed = achievementsProvider.loadRaw(raw);
      // Seed runtime evaluator (parity with PIE hot-reload).
      achievementEvaluator.load(parsed);
    } catch (err) {
      console.warn(
        `[DataManager] achievements.json not found or invalid (${err instanceof Error ? err.message : String(err)}), achievements will be unavailable`,
      );
    }

    // Load time-weather manifest (optional — schema requires ≥2
    // keyframes and ≥1 weather state, so missing/invalid leaves
    // provider unloaded and consumers must supply their own fallback).
    try {
      const timeWeatherPath = path.join(manifestsDir, "time-weather.json");
      const timeWeatherData = await fs.readFile(timeWeatherPath, "utf-8");
      const raw = JSON.parse(timeWeatherData) as unknown;
      const parsed = timeWeatherProvider.loadRaw(raw);
      // Seed runtime driver (parity with PIE hot-reload path).
      timeWeatherDriver.load(parsed);
    } catch (err) {
      console.warn(
        `[DataManager] time-weather.json not found or invalid (${err instanceof Error ? err.message : String(err)}), day/night + weather will use hardcoded fallback`,
      );
    }

    // Load accessibility manifest (optional — every field has a
    // schema default so missing/invalid file still yields a fully-
    // defaulted manifest via `getManifest()`).
    try {
      const accessibilityPath = path.join(manifestsDir, "accessibility.json");
      const accessibilityData = await fs.readFile(accessibilityPath, "utf-8");
      const raw = JSON.parse(accessibilityData) as unknown;
      const parsed = accessibilityProvider.loadRaw(raw);
      // Seed runtime registry (parity with PIE hot-reload).
      accessibilitySettings.load(parsed);
    } catch (err) {
      console.warn(
        `[DataManager] accessibility.json not found or invalid (${err instanceof Error ? err.message : String(err)}), accessibility defaults will apply`,
      );
    }

    // Load analytics events manifest (optional — runtime bridge
    // skips schema validation when absent/invalid).
    try {
      const analyticsPath = path.join(manifestsDir, "analytics-events.json");
      const analyticsData = await fs.readFile(analyticsPath, "utf-8");
      const raw = JSON.parse(analyticsData) as unknown;
      const parsed = analyticsEventsProvider.loadRaw(raw);
      // Seed runtime registry (parity with PIE hot-reload).
      analyticsEventRouter.load(parsed);
    } catch (err) {
      console.warn(
        `[DataManager] analytics-events.json not found or invalid (${err instanceof Error ? err.message : String(err)}), analytics bridge will skip schema validation`,
      );
    }

    // Load render profiles manifest (optional — schema requires
    // min 1 profile, no safe empty).
    try {
      const renderProfilesPath = path.join(
        manifestsDir,
        "render-profiles.json",
      );
      const renderProfilesData = await fs.readFile(renderProfilesPath, "utf-8");
      const raw = JSON.parse(renderProfilesData) as unknown;
      const parsed = renderProfilesProvider.loadRaw(raw);
      // Seed the module-level runtime registry so renderer consumers
      // that read through `renderProfileRegistry` pick up authored
      // profiles on cold boot (parity with PIE hot-reload path).
      renderProfileRegistry.load(parsed);
    } catch (err) {
      console.warn(
        `[DataManager] render-profiles.json not found or invalid (${err instanceof Error ? err.message : String(err)}), render profiles will use hardcoded defaults`,
      );
    }

    // Load damage types manifest (optional — schema requires
    // types.min(1), no safe empty).
    try {
      const damageTypesPath = path.join(manifestsDir, "damage-types.json");
      const damageTypesData = await fs.readFile(damageTypesPath, "utf-8");
      const raw = JSON.parse(damageTypesData) as unknown;
      const parsed = damageTypesProvider.loadRaw(raw);
      // Seed runtime damage-type registry (parity with PIE hot-reload).
      damageTypeRegistry.load(parsed);
    } catch (err) {
      console.warn(
        `[DataManager] damage-types.json not found or invalid (${err instanceof Error ? err.message : String(err)}), combat will treat all damage as untyped`,
      );
    }

    // Load status effects manifest (optional — StatusEffectSystem
    // iterates empty list when absent).
    try {
      const statusEffectsPath = path.join(manifestsDir, "status-effects.json");
      const statusEffectsData = await fs.readFile(statusEffectsPath, "utf-8");
      const raw = JSON.parse(statusEffectsData) as unknown;
      const parsed = statusEffectsProvider.loadRaw(raw);
      // Seed runtime registry (parity with PIE hot-reload).
      statusEffectRegistry.load(parsed);
    } catch (err) {
      console.warn(
        `[DataManager] status-effects.json not found or invalid (${err instanceof Error ? err.message : String(err)}), no authored buffs/debuffs will be available`,
      );
    }

    // Load camera profiles manifest (optional — empty list is
    // schema-valid; provider returns [] until an author adds rigs).
    try {
      const cameraProfilesPath = path.join(
        manifestsDir,
        "camera-profiles.json",
      );
      const cameraProfilesData = await fs.readFile(cameraProfilesPath, "utf-8");
      const raw = JSON.parse(cameraProfilesData) as unknown;
      const parsed = cameraProfilesProvider.loadRaw(raw);
      // Seed runtime camera-profile registry (parity with PIE).
      cameraProfileRegistry.load(parsed);
    } catch (err) {
      console.warn(
        `[DataManager] camera-profiles.json not found or invalid (${err instanceof Error ? err.message : String(err)}), no authored camera rigs will be available`,
      );
    }

    // Load audio bus-mix manifest (optional — schema requires
    // buses.min(1), no safe empty; missing → unloaded).
    try {
      const audioBusMixPath = path.join(manifestsDir, "audio-bus-mix.json");
      const audioBusMixData = await fs.readFile(audioBusMixPath, "utf-8");
      const raw = JSON.parse(audioBusMixData) as unknown;
      const parsed = audioBusMixProvider.loadRaw(raw);
      // Seed runtime mixer (parity with PIE hot-reload path).
      audioBusMixer.load(parsed);
    } catch (err) {
      console.warn(
        `[DataManager] audio-bus-mix.json not found or invalid (${err instanceof Error ? err.message : String(err)}), no authored mixer graph will be available`,
      );
    }

    // Load post-process volumes manifest (optional — empty list is
    // schema-valid; provider returns [] until an author adds volumes).
    try {
      const ppvPath = path.join(manifestsDir, "post-process-volumes.json");
      const ppvData = await fs.readFile(ppvPath, "utf-8");
      const raw = JSON.parse(ppvData) as unknown;
      const parsed = postProcessVolumesProvider.loadRaw(raw);
      // Seed runtime compositor (parity with PIE hot-reload path).
      postProcessVolumeCompositor.load(parsed);
    } catch (err) {
      console.warn(
        `[DataManager] post-process-volumes.json not found or invalid (${err instanceof Error ? err.message : String(err)}), no authored volumes will be available`,
      );
    }

    // Load NPC schedule manifest (optional — empty list is
    // schema-valid; NPCs without an authored schedule fall back to
    // their built-in behavior logic).
    try {
      const npcSchedPath = path.join(manifestsDir, "npc-schedule.json");
      const npcSchedData = await fs.readFile(npcSchedPath, "utf-8");
      const raw = JSON.parse(npcSchedData) as unknown;
      const parsed = npcScheduleProvider.loadRaw(raw);
      // Seed runtime schedule registry (parity with PIE).
      npcScheduleRegistry.load(parsed);
    } catch (err) {
      console.warn(
        `[DataManager] npc-schedule.json not found or invalid (${err instanceof Error ? err.message : String(err)}), no authored NPC schedules will be available`,
      );
    }

    // Load chat-channels manifest (optional — schema requires
    // channels.min(1), no safe empty; missing → unloaded → ChatRouter
    // uses built-in defaults).
    try {
      const chatChannelsPath = path.join(manifestsDir, "chat-channels.json");
      const chatChannelsData = await fs.readFile(chatChannelsPath, "utf-8");
      const raw = JSON.parse(chatChannelsData) as unknown;
      const parsed = chatChannelsProvider.loadRaw(raw);
      // Seed runtime channel registry (parity with PIE path).
      chatChannelRegistry.load(parsed);
    } catch (err) {
      console.warn(
        `[DataManager] chat-channels.json not found or invalid (${err instanceof Error ? err.message : String(err)}), chat routing will use built-in defaults`,
      );
    }

    // Load mounts manifest (optional — no authored mounts when
    // absent, runtime has no mounts to resolve).
    try {
      const mountsPath = path.join(manifestsDir, "mounts.json");
      const mountsRaw = await fs.readFile(mountsPath, "utf-8");
      const raw = JSON.parse(mountsRaw) as unknown;
      const parsed = mountsProvider.loadRaw(raw);
      // Seed runtime registry (parity with PIE hot-reload).
      mountRegistry.load(parsed);
    } catch (err) {
      console.warn(
        `[DataManager] mounts.json not found or invalid (${err instanceof Error ? err.message : String(err)}), mount system will be disabled`,
      );
    }

    // Load voice-chat manifest (optional — pipeline disabled when
    // absent, runtime VoiceChatSystem has nothing to wire up).
    try {
      const voiceChatPath = path.join(manifestsDir, "voice-chat.json");
      const voiceChatRaw = await fs.readFile(voiceChatPath, "utf-8");
      const raw = JSON.parse(voiceChatRaw) as unknown;
      const parsed = voiceChatProvider.loadRaw(raw);
      // Seed runtime registry (parity with PIE hot-reload).
      voiceChatRegistry.load(parsed);
    } catch (err) {
      console.warn(
        `[DataManager] voice-chat.json not found or invalid (${err instanceof Error ? err.message : String(err)}), voice-chat will be disabled`,
      );
    }

    // Load parental-controls manifest (optional — no authored
    // age-gated profiles when absent, runtime has nothing to
    // enforce).
    try {
      const parentalPath = path.join(manifestsDir, "parental-controls.json");
      const parentalRaw = await fs.readFile(parentalPath, "utf-8");
      const raw = JSON.parse(parentalRaw) as unknown;
      const parsed = parentalControlsProvider.loadRaw(raw);
      // Seed runtime registry (parity with PIE hot-reload).
      parentalControlsRegistry.load(parsed);
    } catch (err) {
      console.warn(
        `[DataManager] parental-controls.json not found or invalid (${err instanceof Error ? err.message : String(err)}), parental-controls will be disabled`,
      );
    }

    // Load tutorial-flows manifest (optional — no authored
    // onboarding graphs when absent, runtime has nothing to run).
    try {
      const tutorialPath = path.join(manifestsDir, "tutorial-flows.json");
      const tutorialRaw = await fs.readFile(tutorialPath, "utf-8");
      const raw = JSON.parse(tutorialRaw) as unknown;
      const parsed = tutorialFlowsProvider.loadRaw(raw);
      // Seed runtime registry (parity with PIE hot-reload).
      tutorialFlowsRegistry.load(parsed);
    } catch (err) {
      console.warn(
        `[DataManager] tutorial-flows.json not found or invalid (${err instanceof Error ? err.message : String(err)}), tutorial flows will be disabled`,
      );
    }

    // Load haptics manifest (optional — no authored haptic
    // patterns when absent, runtime has nothing to dispatch).
    try {
      const hapticsPath = path.join(manifestsDir, "haptics.json");
      const hapticsRaw = await fs.readFile(hapticsPath, "utf-8");
      const raw = JSON.parse(hapticsRaw) as unknown;
      const parsed = hapticsProvider.loadRaw(raw);
      // Seed runtime registry (parity with PIE hot-reload).
      hapticsRegistry.load(parsed);
    } catch (err) {
      console.warn(
        `[DataManager] haptics.json not found or invalid (${err instanceof Error ? err.message : String(err)}), haptics will be disabled`,
      );
    }

    // Load physics-config manifest (optional — PhysX tuning + materials +
    // collision-layer matrix. Runtime PhysicsSystem reads provider for
    // authored tuning once wired; absence leaves provider unloaded).
    try {
      const physicsConfigPath = path.join(manifestsDir, "physics-config.json");
      const physicsConfigRaw = await fs.readFile(physicsConfigPath, "utf-8");
      const raw = JSON.parse(physicsConfigRaw) as unknown;
      const parsed = physicsConfigProvider.loadRaw(raw);
      // Seed runtime registry (parity with PIE hot-reload).
      physicsConfigRegistry.load(parsed);
    } catch (err) {
      console.warn(
        `[DataManager] physics-config.json not found or invalid (${err instanceof Error ? err.message : String(err)}), physics config will be disabled`,
      );
    }

    // Load feature-flags manifest (optional — rules + boolean/variant
    // flag registry + mutex groups. Runtime FeatureFlagRegistry reads
    // provider once wired; absence leaves provider unloaded).
    try {
      const featureFlagsPath = path.join(manifestsDir, "feature-flags.json");
      const featureFlagsRaw = await fs.readFile(featureFlagsPath, "utf-8");
      const raw = JSON.parse(featureFlagsRaw) as unknown;
      const parsed = featureFlagsProvider.loadRaw(raw);
      // Seed runtime registry (parity with PIE hot-reload).
      featureFlagRegistry.load(parsed);
    } catch (err) {
      console.warn(
        `[DataManager] feature-flags.json not found or invalid (${err instanceof Error ? err.message : String(err)}), feature flags will be disabled`,
      );
    }

    // Load crash-reporter manifest (optional — sink registry, PII
    // rules, symbolication, breadcrumb ring buffer. Runtime
    // CrashReporterSystem reads provider once wired; absence leaves
    // provider unloaded).
    try {
      const crashReporterPath = path.join(manifestsDir, "crash-reporter.json");
      const crashReporterRaw = await fs.readFile(crashReporterPath, "utf-8");
      const raw = JSON.parse(crashReporterRaw) as unknown;
      const parsed = crashReporterProvider.loadRaw(raw);
      // Seed runtime registry (parity with PIE hot-reload).
      crashReporterRegistry.load(parsed);
    } catch (err) {
      console.warn(
        `[DataManager] crash-reporter.json not found or invalid (${err instanceof Error ? err.message : String(err)}), crash reporter will be disabled`,
      );
    }

    // Load push-notifications manifest (optional — channels +
    // categories + quiet hours + consent. Runtime
    // PushNotificationsSystem reads provider once wired).
    try {
      const pushPath = path.join(manifestsDir, "push-notifications.json");
      const pushRaw = await fs.readFile(pushPath, "utf-8");
      const raw = JSON.parse(pushRaw) as unknown;
      const parsed = pushNotificationsProvider.loadRaw(raw);
      // Seed runtime registry (parity with PIE hot-reload).
      pushNotificationsRegistry.load(parsed);
    } catch (err) {
      console.warn(
        `[DataManager] push-notifications.json not found or invalid (${err instanceof Error ? err.message : String(err)}), push notifications will be disabled`,
      );
    }

    // Load license-agreements manifest (optional — legal doc
    // registry with SemVer-versioned histories + jurisdictional
    // variants. Runtime LegalConsentSystem reads provider once
    // wired).
    try {
      const licensePath = path.join(manifestsDir, "license-agreements.json");
      const licenseRaw = await fs.readFile(licensePath, "utf-8");
      const raw = JSON.parse(licenseRaw) as unknown;
      const parsed = licenseAgreementsProvider.loadRaw(raw);
      // Seed runtime registry (parity with PIE hot-reload).
      licenseAgreementsRegistry.load(parsed);
    } catch (err) {
      console.warn(
        `[DataManager] license-agreements.json not found or invalid (${err instanceof Error ? err.message : String(err)}), license agreements will be disabled`,
      );
    }

    // Load news-feed manifest (optional — no announcements when
    // absent, runtime feed is empty).
    try {
      const newsFeedPath = path.join(manifestsDir, "news-feed.json");
      const newsFeedRaw = await fs.readFile(newsFeedPath, "utf-8");
      const raw = JSON.parse(newsFeedRaw) as unknown;
      const parsed = newsFeedProvider.loadRaw(raw);
      // Seed runtime registry (parity with PIE hot-reload).
      newsFeedRegistry.load(parsed);
    } catch (err) {
      console.warn(
        `[DataManager] news-feed.json not found or invalid (${err instanceof Error ? err.message : String(err)}), news feed will be disabled`,
      );
    }

    // Load moderation manifest (optional — safe disabled default
    // keeps the substrate inert until categories + ladders are
    // authored).
    try {
      const moderationPath = path.join(manifestsDir, "moderation.json");
      const moderationRaw = await fs.readFile(moderationPath, "utf-8");
      const raw = JSON.parse(moderationRaw) as unknown;
      const parsed = moderationProvider.loadRaw(raw);
      // Seed runtime registry (parity with PIE hot-reload).
      moderationRegistry.load(parsed);
    } catch (err) {
      console.warn(
        `[DataManager] moderation.json not found or invalid (${err instanceof Error ? err.message : String(err)}), moderation substrate will be disabled`,
      );
    }

    // Load fast-travel manifest (optional — empty graph means
    // runtime has no authored flight paths to expose).
    try {
      const fastTravelPath = path.join(manifestsDir, "fast-travel.json");
      const fastTravelRaw = await fs.readFile(fastTravelPath, "utf-8");
      const raw = JSON.parse(fastTravelRaw) as unknown;
      const parsed = fastTravelProvider.loadRaw(raw);
      // Seed runtime registry (parity with PIE hot-reload).
      fastTravelGraph.load(parsed);
    } catch (err) {
      console.warn(
        `[DataManager] fast-travel.json not found or invalid (${err instanceof Error ? err.message : String(err)}), fast travel graph will be empty`,
      );
    }

    // Load respawn manifest (optional — safe disabled default
    // keeps death handling inert until bind points are authored).
    try {
      const respawnPath = path.join(manifestsDir, "respawn.json");
      const respawnRaw = await fs.readFile(respawnPath, "utf-8");
      const raw = JSON.parse(respawnRaw) as unknown;
      const parsed = respawnProvider.loadRaw(raw);
      // Seed runtime registry (parity with PIE hot-reload).
      respawnPolicyResolver.load(parsed);
    } catch (err) {
      console.warn(
        `[DataManager] respawn.json not found or invalid (${err instanceof Error ? err.message : String(err)}), respawn system will be disabled`,
      );
    }

    // Load talent-trees manifest (optional — safe disabled default
    // keeps the branching-progression pipeline inert until trees
    // are authored).
    try {
      const talentTreesPath = path.join(manifestsDir, "talent-trees.json");
      const talentTreesRaw = await fs.readFile(talentTreesPath, "utf-8");
      const raw = JSON.parse(talentTreesRaw) as unknown;
      const parsed = talentTreesProvider.loadRaw(raw);
      // Seed runtime registry (parity with PIE hot-reload).
      talentTreeRegistry.load(parsed);
    } catch (err) {
      console.warn(
        `[DataManager] talent-trees.json not found or invalid (${err instanceof Error ? err.message : String(err)}), talent trees will be disabled`,
      );
    }

    // Load auction-house manifest (optional — safe disabled default
    // keeps the AH pipeline inert until policy is authored).
    try {
      const auctionHousePath = path.join(manifestsDir, "auction-house.json");
      const auctionHouseRaw = await fs.readFile(auctionHousePath, "utf-8");
      const raw = JSON.parse(auctionHouseRaw) as unknown;
      const parsed = auctionHouseProvider.loadRaw(raw);
      // Seed runtime registry (parity with PIE hot-reload).
      auctionHouseRegistry.load(parsed);
    } catch (err) {
      console.warn(
        `[DataManager] auction-house.json not found or invalid (${err instanceof Error ? err.message : String(err)}), auction house will be disabled`,
      );
    }

    // Load transmog manifest (optional — empty-source baseline keeps
    // the pipeline inert until appearances are authored).
    try {
      const transmogPath = path.join(manifestsDir, "transmog.json");
      const transmogRaw = await fs.readFile(transmogPath, "utf-8");
      const raw = JSON.parse(transmogRaw) as unknown;
      const parsed = transmogProvider.loadRaw(raw);
      // Seed runtime registry (parity with PIE hot-reload).
      transmogRegistry.load(parsed);
    } catch (err) {
      console.warn(
        `[DataManager] transmog.json not found or invalid (${err instanceof Error ? err.message : String(err)}), transmog will be disabled`,
      );
    }

    // Load housing manifest (optional — safe disabled default keeps
    // the housing pipeline inert until plotTypes are authored).
    try {
      const housingPath = path.join(manifestsDir, "housing.json");
      const housingRaw = await fs.readFile(housingPath, "utf-8");
      const raw = JSON.parse(housingRaw) as unknown;
      const parsed = housingProvider.loadRaw(raw);
      // Seed runtime registry (parity with PIE hot-reload).
      housingRegistry.load(parsed);
    } catch (err) {
      console.warn(
        `[DataManager] housing.json not found or invalid (${err instanceof Error ? err.message : String(err)}), housing will be disabled`,
      );
    }

    // Load group-finder manifest (optional — disabled default keeps
    // matchmaking inert until content is authored).
    try {
      const groupFinderPath = path.join(manifestsDir, "group-finder.json");
      const groupFinderRaw = await fs.readFile(groupFinderPath, "utf-8");
      const raw = JSON.parse(groupFinderRaw) as unknown;
      const parsed = groupFinderProvider.loadRaw(raw);
      // Seed runtime registry (parity with PIE hot-reload).
      groupFinderRegistry.load(parsed);
    } catch (err) {
      console.warn(
        `[DataManager] group-finder.json not found or invalid (${err instanceof Error ? err.message : String(err)}), group finder will be disabled`,
      );
    }

    // Load friends-social manifest (optional — disabled default
    // keeps the social graph inert until authored).
    try {
      const friendsSocialPath = path.join(manifestsDir, "friends-social.json");
      const friendsSocialRaw = await fs.readFile(friendsSocialPath, "utf-8");
      const raw = JSON.parse(friendsSocialRaw) as unknown;
      const parsed = friendsSocialProvider.loadRaw(raw);
      // Seed runtime registry (parity with PIE hot-reload).
      friendsSocialRegistry.load(parsed);
    } catch (err) {
      console.warn(
        `[DataManager] friends-social.json not found or invalid (${err instanceof Error ? err.message : String(err)}), friends social will be disabled`,
      );
    }

    // Load loadouts manifest (optional — disabled default keeps
    // the equipment-manager feature inert until authored).
    try {
      const loadoutsPath = path.join(manifestsDir, "loadouts.json");
      const loadoutsRaw = await fs.readFile(loadoutsPath, "utf-8");
      const raw = JSON.parse(loadoutsRaw) as unknown;
      const parsed = loadoutsProvider.loadRaw(raw);
      // Seed runtime registry (parity with PIE hot-reload).
      loadoutPolicyRegistry.load(parsed);
    } catch (err) {
      console.warn(
        `[DataManager] loadouts.json not found or invalid (${err instanceof Error ? err.message : String(err)}), loadouts will be disabled`,
      );
    }

    // Load trading manifest (optional — disabled default keeps the
    // P2P trade pipeline inert until authored).
    try {
      const tradingPath = path.join(manifestsDir, "trading.json");
      const tradingRaw = await fs.readFile(tradingPath, "utf-8");
      const raw = JSON.parse(tradingRaw) as unknown;
      const parsed = tradingProvider.loadRaw(raw);
      // Seed runtime registry (parity with PIE hot-reload).
      tradingRegistry.load(parsed);
    } catch (err) {
      console.warn(
        `[DataManager] trading.json not found or invalid (${err instanceof Error ? err.message : String(err)}), trading will be disabled`,
      );
    }

    // Load item-sets manifest (optional — empty array default
    // keeps no set bonuses active until authored).
    try {
      const itemSetsPath = path.join(manifestsDir, "item-sets.json");
      const itemSetsRaw = await fs.readFile(itemSetsPath, "utf-8");
      const raw = JSON.parse(itemSetsRaw) as unknown;
      const parsed = itemSetsProvider.loadRaw(raw);
      // Seed runtime registry (parity with PIE hot-reload).
      itemSetRegistry.load(parsed);
    } catch (err) {
      console.warn(
        `[DataManager] item-sets.json not found or invalid (${err instanceof Error ? err.message : String(err)}), item sets will be disabled`,
      );
    }

    // Load leaderboards manifest (optional — empty array default
    // keeps no boards active until authored).
    try {
      const leaderboardsPath = path.join(manifestsDir, "leaderboards.json");
      const leaderboardsRaw = await fs.readFile(leaderboardsPath, "utf-8");
      const raw = JSON.parse(leaderboardsRaw) as unknown;
      const parsed = leaderboardsProvider.loadRaw(raw);
      // Seed runtime leaderboard engine (parity with PIE hot-reload).
      leaderboardEngine.load(parsed);
    } catch (err) {
      console.warn(
        `[DataManager] leaderboards.json not found or invalid (${err instanceof Error ? err.message : String(err)}), leaderboards will be disabled`,
      );
    }

    // Load titles manifest (optional — empty array default
    // keeps no titles active until authored).
    try {
      const titlesPath = path.join(manifestsDir, "titles.json");
      const titlesRaw = await fs.readFile(titlesPath, "utf-8");
      const raw = JSON.parse(titlesRaw) as unknown;
      const parsed = titlesProvider.loadRaw(raw);
      // Seed runtime registry (parity with PIE hot-reload).
      titleRegistry.load(parsed);
    } catch (err) {
      console.warn(
        `[DataManager] titles.json not found or invalid (${err instanceof Error ? err.message : String(err)}), titles will be disabled`,
      );
    }

    // Load world-events manifest (optional — empty array default
    // keeps no events active until authored).
    try {
      const worldEventsPath = path.join(manifestsDir, "world-events.json");
      const worldEventsRaw = await fs.readFile(worldEventsPath, "utf-8");
      const raw = JSON.parse(worldEventsRaw) as unknown;
      const parsed = worldEventsProvider.loadRaw(raw);
      // Seed runtime registry (parity with PIE hot-reload).
      worldEventsRegistry.load(parsed);
    } catch (err) {
      console.warn(
        `[DataManager] world-events.json not found or invalid (${err instanceof Error ? err.message : String(err)}), world events will be disabled`,
      );
    }

    // Load seasons manifest (optional — empty array default
    // keeps no seasons active until authored).
    try {
      const seasonsPath = path.join(manifestsDir, "seasons.json");
      const seasonsRaw = await fs.readFile(seasonsPath, "utf-8");
      const raw = JSON.parse(seasonsRaw) as unknown;
      const parsed = seasonsProvider.loadRaw(raw);
      // Seed runtime registry (parity with PIE hot-reload).
      seasonRegistry.load(parsed);
    } catch (err) {
      console.warn(
        `[DataManager] seasons.json not found or invalid (${err instanceof Error ? err.message : String(err)}), seasons will be disabled`,
      );
    }

    // Load pet-companion manifest (optional — empty array default
    // keeps no pets available until authored).
    try {
      const petCompanionPath = path.join(manifestsDir, "pet-companion.json");
      const petCompanionRaw = await fs.readFile(petCompanionPath, "utf-8");
      const raw = JSON.parse(petCompanionRaw) as unknown;
      const parsed = petCompanionProvider.loadRaw(raw);
      // Seed runtime registry (parity with PIE hot-reload).
      petRegistry.load(parsed);
    } catch (err) {
      console.warn(
        `[DataManager] pet-companion.json not found or invalid (${err instanceof Error ? err.message : String(err)}), pets will be disabled`,
      );
    }

    // Load enchantments manifest (optional — empty array default
    // keeps no enchantments available until authored).
    try {
      const enchantmentsPath = path.join(manifestsDir, "enchantments.json");
      const enchantmentsRaw = await fs.readFile(enchantmentsPath, "utf-8");
      const raw = JSON.parse(enchantmentsRaw) as unknown;
      const parsed = enchantmentsProvider.loadRaw(raw);
      // Seed runtime registry (parity with PIE hot-reload).
      enchantmentRegistry.load(parsed);
    } catch (err) {
      console.warn(
        `[DataManager] enchantments.json not found or invalid (${err instanceof Error ? err.message : String(err)}), enchantments will be disabled`,
      );
    }

    // Load mail manifest (optional — inert {enabled:false} baseline
    // keeps mail off until authored).
    try {
      const mailPath = path.join(manifestsDir, "mail.json");
      const mailRaw = await fs.readFile(mailPath, "utf-8");
      const raw = JSON.parse(mailRaw) as unknown;
      const parsed = mailProvider.loadRaw(raw);
      // Seed runtime registry (parity with PIE hot-reload).
      mailPolicyRegistry.load(parsed);
    } catch (err) {
      console.warn(
        `[DataManager] mail.json not found or invalid (${err instanceof Error ? err.message : String(err)}), mail will be disabled`,
      );
    }

    // Load tooltips manifest (optional — inert {enabled:false}
    // baseline keeps the tooltips system off until authored).
    try {
      const tooltipsPath = path.join(manifestsDir, "tooltips.json");
      const tooltipsRaw = await fs.readFile(tooltipsPath, "utf-8");
      const raw = JSON.parse(tooltipsRaw) as unknown;
      const parsed = tooltipsProvider.loadRaw(raw);
      // Seed runtime registry (parity with PIE hot-reload).
      tooltipRegistry.load(parsed);
    } catch (err) {
      console.warn(
        `[DataManager] tooltips.json not found or invalid (${err instanceof Error ? err.message : String(err)}), tooltips will be disabled`,
      );
    }

    // Load key-prompt-icons manifest (optional — inert {enabled:
    // false} baseline keeps the prompt catalog off until authored).
    try {
      const keyPromptIconsPath = path.join(
        manifestsDir,
        "key-prompt-icons.json",
      );
      const keyPromptIconsRaw = await fs.readFile(keyPromptIconsPath, "utf-8");
      const raw = JSON.parse(keyPromptIconsRaw) as unknown;
      const parsed = keyPromptIconsProvider.loadRaw(raw);
      // Seed runtime registry (parity with PIE hot-reload).
      keyPromptGlyphRegistry.load(parsed);
    } catch (err) {
      console.warn(
        `[DataManager] key-prompt-icons.json not found or invalid (${err instanceof Error ? err.message : String(err)}), key prompts will be disabled`,
      );
    }

    // Load screenshot manifest (optional — inert {enabled:false}
    // baseline keeps photo-mode off until authored).
    try {
      const screenshotPath = path.join(manifestsDir, "screenshot.json");
      const screenshotRaw = await fs.readFile(screenshotPath, "utf-8");
      const raw = JSON.parse(screenshotRaw) as unknown;
      const parsed = screenshotProvider.loadRaw(raw);
      // Seed runtime registry (parity with PIE hot-reload).
      screenshotRegistry.load(parsed);
    } catch (err) {
      console.warn(
        `[DataManager] screenshot.json not found or invalid (${err instanceof Error ? err.message : String(err)}), screenshots will be disabled`,
      );
    }

    // Load party-guild manifest (optional — no authored policies
    // when absent, party/guild systems use engine defaults).
    try {
      const partyGuildPath = path.join(manifestsDir, "party-guild.json");
      const partyGuildRaw = await fs.readFile(partyGuildPath, "utf-8");
      const raw = JSON.parse(partyGuildRaw) as unknown;
      const parsed = partyGuildProvider.loadRaw(raw);
      // Seed runtime registry (parity with PIE hot-reload).
      partyGuildRegistry.load(parsed);
    } catch (err) {
      console.warn(
        `[DataManager] party-guild.json not found or invalid (${err instanceof Error ? err.message : String(err)}), party/guild will be disabled`,
      );
    }

    // Load economy-tuning manifest (optional — no authored
    // currencies when absent, economy systems stay unconfigured).
    try {
      const economyTuningPath = path.join(manifestsDir, "economy-tuning.json");
      const economyTuningRaw = await fs.readFile(economyTuningPath, "utf-8");
      const raw = JSON.parse(economyTuningRaw) as unknown;
      const parsed = economyTuningProvider.loadRaw(raw);
      // Seed runtime registry (parity with PIE hot-reload).
      economyTuningRegistry.load(parsed);
    } catch (err) {
      console.warn(
        `[DataManager] economy-tuning.json not found or invalid (${err instanceof Error ? err.message : String(err)}), economy tuning will be disabled`,
      );
    }

    // Load loading-screens manifest (optional — inert
    // {enabled:false} baseline keeps pipeline off until authored).
    try {
      const loadingScreensPath = path.join(
        manifestsDir,
        "loading-screens.json",
      );
      const loadingScreensRaw = await fs.readFile(loadingScreensPath, "utf-8");
      const raw = JSON.parse(loadingScreensRaw) as unknown;
      const parsed = loadingScreensProvider.loadRaw(raw);
      // Seed runtime registry (parity with PIE hot-reload).
      loadingScreensRegistry.load(parsed);
    } catch (err) {
      console.warn(
        `[DataManager] loading-screens.json not found or invalid (${err instanceof Error ? err.message : String(err)}), loading screens will be disabled`,
      );
    }

    // Load skybox-atmosphere manifest (optional — no authored sky
    // configs when absent, runtime skybox stays unloaded).
    try {
      const skyboxPath = path.join(manifestsDir, "skybox-atmosphere.json");
      const skyboxRaw = await fs.readFile(skyboxPath, "utf-8");
      const raw = JSON.parse(skyboxRaw) as unknown;
      const parsed = skyboxAtmosphereProvider.loadRaw(raw);
      // Seed runtime registry (parity with PIE hot-reload).
      skyboxAtmosphereRegistry.load(parsed);
    } catch (err) {
      console.warn(
        `[DataManager] skybox-atmosphere.json not found or invalid (${err instanceof Error ? err.message : String(err)}), skybox will be disabled`,
      );
    }

    // Load particle-graph manifest (optional — empty [] baseline
    // keeps compiler inert until systems are authored).
    try {
      const particleGraphPath = path.join(manifestsDir, "particle-graph.json");
      const particleGraphRaw = await fs.readFile(particleGraphPath, "utf-8");
      const raw = JSON.parse(particleGraphRaw) as unknown;
      const parsed = particleGraphProvider.loadRaw(raw);
      // Seed runtime registry (parity with PIE hot-reload).
      particleGraphRegistry.load(parsed);
    } catch (err) {
      console.warn(
        `[DataManager] particle-graph.json not found or invalid (${err instanceof Error ? err.message : String(err)}), particle graph will be disabled`,
      );
    }

    // Load cinematic manifest (optional — empty [] baseline).
    try {
      const cinematicPath = path.join(manifestsDir, "cinematic.json");
      const cinematicRaw = await fs.readFile(cinematicPath, "utf-8");
      const raw = JSON.parse(cinematicRaw) as unknown;
      const parsed = cinematicProvider.loadRaw(raw);
      // Seed runtime registry (parity with PIE hot-reload).
      cinematicRegistry.load(parsed);
    } catch (err) {
      console.warn(
        `[DataManager] cinematic.json not found or invalid (${err instanceof Error ? err.message : String(err)}), cinematics will be disabled`,
      );
    }

    // Load editor-snap manifest (optional — {} baseline uses all defaults).
    try {
      const editorSnapPath = path.join(manifestsDir, "editor-snap.json");
      const editorSnapRaw = await fs.readFile(editorSnapPath, "utf-8");
      const raw = JSON.parse(editorSnapRaw) as unknown;
      const parsed = editorSnapProvider.loadRaw(raw);
      // Seed runtime registry (parity with PIE hot-reload).
      editorSnapRegistry.load(parsed);
    } catch (err) {
      console.warn(
        `[DataManager] editor-snap.json not found or invalid (${err instanceof Error ? err.message : String(err)}), editor snap defaults will be used`,
      );
    }

    // Load deploy-targets manifest (optional — empty [] baseline).
    try {
      const deployTargetsPath = path.join(manifestsDir, "deploy-targets.json");
      const deployTargetsRaw = await fs.readFile(deployTargetsPath, "utf-8");
      const raw = JSON.parse(deployTargetsRaw) as unknown;
      const parsed = deployTargetsProvider.loadRaw(raw);
      // Seed runtime registry (parity with PIE hot-reload).
      deployTargetsRegistry.load(parsed);
    } catch (err) {
      console.warn(
        `[DataManager] deploy-targets.json not found or invalid (${err instanceof Error ? err.message : String(err)}), deploy targets will be empty`,
      );
    }

    // Load input-actions manifest (optional — empty [] baseline).
    try {
      const inputActionsPath = path.join(manifestsDir, "input-actions.json");
      const inputActionsRaw = await fs.readFile(inputActionsPath, "utf-8");
      const raw = JSON.parse(inputActionsRaw) as unknown;
      const parsed = inputActionsProvider.loadRaw(raw);
      // Seed runtime registry (parity with PIE hot-reload).
      inputActionsRegistry.load(parsed);
    } catch (err) {
      console.warn(
        `[DataManager] input-actions.json not found or invalid (${err instanceof Error ? err.message : String(err)}), input actions will be empty`,
      );
    }

    // Load profiler-overlay manifest (optional — {} baseline is disabled).
    try {
      const profilerPath = path.join(manifestsDir, "profiler.json");
      const profilerRaw = await fs.readFile(profilerPath, "utf-8");
      const raw = JSON.parse(profilerRaw) as unknown;
      const parsed = profilerOverlayProvider.loadRaw(raw);
      // Seed runtime registry (parity with PIE hot-reload).
      profilerOverlayRegistry.load(parsed);
    } catch (err) {
      console.warn(
        `[DataManager] profiler.json not found or invalid (${err instanceof Error ? err.message : String(err)}), profiler overlay will be disabled`,
      );
    }

    // Load replication manifest (optional — {} baseline yields empty components/events).
    try {
      const replicationPath = path.join(manifestsDir, "replication.json");
      const replicationRaw = await fs.readFile(replicationPath, "utf-8");
      const raw = JSON.parse(replicationRaw) as unknown;
      const parsed = replicationProvider.loadRaw(raw);
      // Seed runtime registry (parity with PIE hot-reload).
      replicationRegistry.load(parsed);
    } catch (err) {
      console.warn(
        `[DataManager] replication.json not found or invalid (${err instanceof Error ? err.message : String(err)}), authored replication contract will be disabled`,
      );
    }

    // Load prefab manifest (optional — {} baseline yields empty prefabs/instances).
    try {
      const prefabPath = path.join(manifestsDir, "prefab.json");
      const prefabRaw = await fs.readFile(prefabPath, "utf-8");
      const raw = JSON.parse(prefabRaw) as unknown;
      const parsed = prefabProvider.loadRaw(raw);
      // Seed runtime registry (parity with PIE hot-reload).
      prefabRegistry.load(parsed);
    } catch (err) {
      console.warn(
        `[DataManager] prefab.json not found or invalid (${err instanceof Error ? err.message : String(err)}), prefab library will be disabled`,
      );
    }

    // Load level-streaming manifest (optional — [] baseline yields no sublevels).
    try {
      const levelStreamingPath = path.join(
        manifestsDir,
        "level-streaming.json",
      );
      const levelStreamingRaw = await fs.readFile(levelStreamingPath, "utf-8");
      const raw = JSON.parse(levelStreamingRaw) as unknown;
      const parsed = levelStreamingProvider.loadRaw(raw);
      // Seed runtime registry (parity with PIE hot-reload).
      levelStreamingRegistry.load(parsed);
    } catch (err) {
      console.warn(
        `[DataManager] level-streaming.json not found or invalid (${err instanceof Error ? err.message : String(err)}), sublevel streaming will be disabled`,
      );
    }

    // Load lighting-bake manifest (optional — {} baseline is a no-bake pass-through).
    try {
      const lightingBakePath = path.join(manifestsDir, "lighting-bake.json");
      const lightingBakeRaw = await fs.readFile(lightingBakePath, "utf-8");
      const raw = JSON.parse(lightingBakeRaw) as unknown;
      const parsed = lightingBakeProvider.loadRaw(raw);
      // Seed runtime registry (parity with PIE hot-reload).
      lightingBakeRegistry.load(parsed);
    } catch (err) {
      console.warn(
        `[DataManager] lighting-bake.json not found or invalid (${err instanceof Error ? err.message : String(err)}), offline lighting bake settings will be disabled`,
      );
    }

    // Load project-settings manifest (optional — no baseline fixture because
    // projectName + gameModeId are required fields).
    try {
      const projectSettingsPath = path.join(
        manifestsDir,
        "project-settings.json",
      );
      const projectSettingsRaw = await fs.readFile(
        projectSettingsPath,
        "utf-8",
      );
      const raw = JSON.parse(projectSettingsRaw) as unknown;
      const parsed = projectSettingsProvider.loadRaw(raw);
      // Seed runtime registry (parity with PIE hot-reload).
      projectSettingsRegistry.load(parsed);
    } catch (err) {
      console.warn(
        `[DataManager] project-settings.json not found or invalid (${err instanceof Error ? err.message : String(err)}), project-level identity will be disabled`,
      );
    }

    // Load ai-behavior manifest (optional — [] baseline yields no trees).
    try {
      const aiBehaviorPath = path.join(manifestsDir, "ai-behavior.json");
      const aiBehaviorRaw = await fs.readFile(aiBehaviorPath, "utf-8");
      const raw = JSON.parse(aiBehaviorRaw) as unknown;
      aiBehaviorProvider.loadRaw(raw);
    } catch (err) {
      console.warn(
        `[DataManager] ai-behavior.json not found or invalid (${err instanceof Error ? err.message : String(err)}), authored behavior trees will be disabled`,
      );
    }

    // Load animations manifest (optional — {} baseline yields empty clips/bindings).
    try {
      const animationsPath = path.join(manifestsDir, "animations.json");
      const animationsRaw = await fs.readFile(animationsPath, "utf-8");
      const raw = JSON.parse(animationsRaw) as unknown;
      const parsed = animationsProvider.loadRaw(raw);
      // Seed runtime registry (parity with PIE hot-reload).
      animationRegistry.load(parsed);
    } catch (err) {
      console.warn(
        `[DataManager] animations.json not found or invalid (${err instanceof Error ? err.message : String(err)}), authored animation bindings will be disabled`,
      );
    }

    // Load quality-presets manifest (optional — no baseline because min(1)).
    try {
      const qualityPresetsPath = path.join(
        manifestsDir,
        "quality-presets.json",
      );
      const qualityPresetsRaw = await fs.readFile(qualityPresetsPath, "utf-8");
      const raw = JSON.parse(qualityPresetsRaw) as unknown;
      const parsed = qualityPresetsProvider.loadRaw(raw);
      // Seed runtime registry (parity with PIE hot-reload).
      qualityPresetsRegistry.load(parsed);
    } catch (err) {
      console.warn(
        `[DataManager] quality-presets.json not found or invalid (${err instanceof Error ? err.message : String(err)}), authored quality presets will be disabled`,
      );
    }

    // Load nav-mesh manifest (optional — no baseline because agents.min(1)).
    try {
      const navMeshPath = path.join(manifestsDir, "nav-mesh.json");
      const navMeshRaw = await fs.readFile(navMeshPath, "utf-8");
      const raw = JSON.parse(navMeshRaw) as unknown;
      const parsed = navMeshProvider.loadRaw(raw);
      // Seed runtime registry (parity with PIE hot-reload).
      navMeshRegistry.load(parsed);
    } catch (err) {
      console.warn(
        `[DataManager] nav-mesh.json not found or invalid (${err instanceof Error ? err.message : String(err)}), authored nav-mesh settings will be disabled`,
      );
    }

    // Load lod-settings manifest (optional — no baseline because required
    // fields have no defaults).
    try {
      const lodSettingsPath = path.join(manifestsDir, "lod-settings.json");
      const lodSettingsRaw = await fs.readFile(lodSettingsPath, "utf-8");
      const raw = JSON.parse(lodSettingsRaw) as unknown;
      const parsed = lodSettingsProvider.loadRaw(raw);
      // Seed runtime registry (parity with PIE hot-reload).
      lodSettingsRegistry.load(parsed);
    } catch (err) {
      console.warn(
        `[DataManager] lod-settings.json not found or invalid (${err instanceof Error ? err.message : String(err)}), authored LOD settings will be disabled`,
      );
    }

    // Load sfx manifest (optional — [] baseline).
    try {
      const sfxPath = path.join(manifestsDir, "sfx.json");
      const sfxRaw = await fs.readFile(sfxPath, "utf-8");
      const raw = JSON.parse(sfxRaw) as unknown;
      const parsed = soundEffectsProvider.loadRaw(raw);
      // Seed runtime registry (parity with PIE hot-reload).
      sfxRegistry.load(parsed);
    } catch (err) {
      console.warn(
        `[DataManager] sfx.json not found or invalid (${err instanceof Error ? err.message : String(err)}), authored sound effects will be disabled`,
      );
    }

    // Load vfx manifest (optional — [] baseline).
    try {
      const vfxPath = path.join(manifestsDir, "vfx.json");
      const vfxRaw = await fs.readFile(vfxPath, "utf-8");
      const raw = JSON.parse(vfxRaw) as unknown;
      const parsed = vfxProvider.loadRaw(raw);
      // Seed runtime registry (parity with PIE hot-reload).
      vfxRegistry.load(parsed);
    } catch (err) {
      console.warn(
        `[DataManager] vfx.json not found or invalid (${err instanceof Error ? err.message : String(err)}), authored VFX will be disabled`,
      );
    }

    // Load vegetation manifest (optional — no baseline because version + assets required).
    try {
      const vegetationPath = path.join(manifestsDir, "vegetation.json");
      const vegetationRaw = await fs.readFile(vegetationPath, "utf-8");
      const raw = JSON.parse(vegetationRaw) as unknown;
      const parsed = vegetationProvider.loadRaw(raw);
      // Seed runtime registry (parity with PIE hot-reload).
      vegetationRegistry.load(parsed);
    } catch (err) {
      console.warn(
        `[DataManager] vegetation.json not found or invalid (${err instanceof Error ? err.message : String(err)}), authored vegetation registry will be disabled`,
      );
    }

    // Load main-menu manifest (optional — {"enabled":false} baseline).
    try {
      const mainMenuPath = path.join(manifestsDir, "main-menu.json");
      const mainMenuRaw = await fs.readFile(mainMenuPath, "utf-8");
      const raw = JSON.parse(mainMenuRaw) as unknown;
      const parsed = mainMenuProvider.loadRaw(raw);
      // Seed runtime registry (parity with PIE hot-reload).
      mainMenuRegistry.load(parsed);
    } catch (err) {
      console.warn(
        `[DataManager] main-menu.json not found or invalid (${err instanceof Error ? err.message : String(err)}), main menu tree will be disabled`,
      );
    }

    // Load credits manifest (optional — {"enabled":false} baseline).
    try {
      const creditsPath = path.join(manifestsDir, "credits.json");
      const creditsRaw = await fs.readFile(creditsPath, "utf-8");
      const raw = JSON.parse(creditsRaw) as unknown;
      const parsed = creditsProvider.loadRaw(raw);
      // Seed runtime registry (parity with PIE hot-reload).
      creditsRegistry.load(parsed);
    } catch (err) {
      console.warn(
        `[DataManager] credits.json not found or invalid (${err instanceof Error ? err.message : String(err)}), credits roll will be disabled`,
      );
    }

    // Load music manifest (optional — no authored tracks when absent).
    try {
      const musicPath = path.join(manifestsDir, "music.json");
      const musicRaw = await fs.readFile(musicPath, "utf-8");
      const raw = JSON.parse(musicRaw) as unknown;
      musicProvider.loadRaw(raw);
    } catch (err) {
      console.warn(
        `[DataManager] music.json not found or invalid (${err instanceof Error ? err.message : String(err)}), authored music tracks will be disabled`,
      );
    }

    // Load duel manifest (optional — no authored duel rules/slots
    // when absent).
    try {
      const duelPath = path.join(manifestsDir, "duel.json");
      const duelRaw = await fs.readFile(duelPath, "utf-8");
      const raw = JSON.parse(duelRaw) as unknown;
      const parsed = duelProvider.loadRaw(raw);
      // Seed runtime registry (parity with PIE hot-reload).
      duelRulesRegistry.load(parsed);
    } catch (err) {
      console.warn(
        `[DataManager] duel.json not found or invalid (${err instanceof Error ? err.message : String(err)}), duel rules will be disabled`,
      );
    }

    // Load duel-arenas manifest (optional — no authored arena grid
    // when absent).
    try {
      const duelArenasPath = path.join(manifestsDir, "duel-arenas.json");
      const duelArenasRaw = await fs.readFile(duelArenasPath, "utf-8");
      const raw = JSON.parse(duelArenasRaw) as unknown;
      duelArenasProvider.loadRaw(raw);
    } catch (err) {
      console.warn(
        `[DataManager] duel-arenas.json not found or invalid (${err instanceof Error ? err.message : String(err)}), streaming duel arenas will be disabled`,
      );
    }

    // Load biomes manifest (optional — procgen falls back to
    // engine defaults when absent).
    try {
      const biomesPath = path.join(manifestsDir, "biomes.json");
      const biomesRaw = await fs.readFile(biomesPath, "utf-8");
      const raw = JSON.parse(biomesRaw) as unknown;
      const parsed = biomesProvider.loadRaw(raw);
      // Seed runtime registry (parity with PIE hot-reload).
      biomesRegistry.load(parsed);
    } catch (err) {
      console.warn(
        `[DataManager] biomes.json not found or invalid (${err instanceof Error ? err.message : String(err)}), authored biomes will be disabled`,
      );
    }

    // Load stores manifest (optional — no authored shop
    // inventories when absent).
    try {
      const storesPath = path.join(manifestsDir, "stores.json");
      const storesRaw = await fs.readFile(storesPath, "utf-8");
      const raw = JSON.parse(storesRaw) as unknown;
      const parsed = storesProvider.loadRaw(raw);
      // Seed runtime registry (parity with PIE hot-reload).
      storesRegistry.load(parsed);
    } catch (err) {
      console.warn(
        `[DataManager] stores.json not found or invalid (${err instanceof Error ? err.message : String(err)}), authored stores will be disabled`,
      );
    }

    // Load ammunition manifest (optional — no authored bow/arrow
    // catalog when absent, ranged combat falls back to defaults).
    try {
      const ammunitionPath = path.join(manifestsDir, "ammunition.json");
      const ammunitionRaw = await fs.readFile(ammunitionPath, "utf-8");
      const raw = JSON.parse(ammunitionRaw) as unknown;
      const parsed = ammunitionProvider.loadRaw(raw);
      // Seed runtime registry (parity with PIE hot-reload).
      ammunitionRegistry.load(parsed);
    } catch (err) {
      console.warn(
        `[DataManager] ammunition.json not found or invalid (${err instanceof Error ? err.message : String(err)}), authored ammunition will be disabled`,
      );
    }

    // Load arena-layout manifest (optional — streaming duel
    // scheduler falls back to hardcoded layout when absent).
    try {
      const arenaLayoutPath = path.join(manifestsDir, "arena-layout.json");
      const arenaLayoutRaw = await fs.readFile(arenaLayoutPath, "utf-8");
      const raw = JSON.parse(arenaLayoutRaw) as unknown;
      const parsed = arenaLayoutProvider.loadRaw(raw);
      // Seed runtime registry (parity with PIE hot-reload).
      arenaLayoutRegistry.load(parsed);
    } catch (err) {
      console.warn(
        `[DataManager] arena-layout.json not found or invalid (${err instanceof Error ? err.message : String(err)}), authored arena layout will be disabled`,
      );
    }

    // Load avatars manifest (optional — character creation falls
    // back to default avatar list when absent).
    try {
      const avatarsPath = path.join(manifestsDir, "avatars.json");
      const avatarsRaw = await fs.readFile(avatarsPath, "utf-8");
      const raw = JSON.parse(avatarsRaw) as unknown;
      const parsed = avatarsProvider.loadRaw(raw);
      // Seed runtime registry (parity with PIE hot-reload).
      avatarsRegistry.load(parsed);
    } catch (err) {
      console.warn(
        `[DataManager] avatars.json not found or invalid (${err instanceof Error ? err.message : String(err)}), authored avatars will be disabled`,
      );
    }

    // Load banking manifest (optional — banking system falls back
    // to built-in sizes/messages when absent).
    try {
      const bankingPath = path.join(manifestsDir, "banking.json");
      const bankingRaw = await fs.readFile(bankingPath, "utf-8");
      const raw = JSON.parse(bankingRaw) as unknown;
      const parsed = bankingProvider.loadRaw(raw);
      // Seed runtime registry (parity with PIE hot-reload).
      bankingRegistry.load(parsed);
    } catch (err) {
      console.warn(
        `[DataManager] banking.json not found or invalid (${err instanceof Error ? err.message : String(err)}), authored banking settings will be disabled`,
      );
    }

    // Load buildings manifest (optional — procgen town placement
    // has no authored buildings to seed when absent).
    try {
      const buildingsPath = path.join(manifestsDir, "buildings.json");
      const buildingsRaw = await fs.readFile(buildingsPath, "utf-8");
      const raw = JSON.parse(buildingsRaw) as unknown;
      const parsed = buildingsProvider.loadRaw(raw);
      // Seed runtime registry (parity with PIE hot-reload).
      buildingsRegistry.load(parsed);
    } catch (err) {
      console.warn(
        `[DataManager] buildings.json not found or invalid (${err instanceof Error ? err.message : String(err)}), authored buildings will be disabled`,
      );
    }

    // Load tools manifest (optional — gathering systems fall back
    // to legacy hardcoded tool lookups when absent).
    try {
      const toolsPath = path.join(manifestsDir, "tools.json");
      const toolsRaw = await fs.readFile(toolsPath, "utf-8");
      const raw = JSON.parse(toolsRaw) as unknown;
      const parsed = toolsProvider.loadRaw(raw);
      // Seed runtime registry (parity with PIE hot-reload).
      toolsRegistry.load(parsed);
    } catch (err) {
      console.warn(
        `[DataManager] tools.json not found or invalid (${err instanceof Error ? err.message : String(err)}), authored tools will be disabled`,
      );
    }

    // Load trees manifest (optional — woodcutting falls back to
    // legacy TreeTypes when absent).
    try {
      const treesPath = path.join(manifestsDir, "trees.json");
      const treesRaw = await fs.readFile(treesPath, "utf-8");
      const raw = JSON.parse(treesRaw) as unknown;
      const parsed = treesProvider.loadRaw(raw);
      // Seed runtime registry (parity with PIE hot-reload).
      treeCatalogRegistry.load(parsed);
    } catch (err) {
      console.warn(
        `[DataManager] trees.json not found or invalid (${err instanceof Error ? err.message : String(err)}), authored trees will be disabled`,
      );
    }

    // Load weapon-styles manifest (optional — combat falls back
    // to legacy WeaponStyleConfig when absent).
    try {
      const weaponStylesPath = path.join(manifestsDir, "weapon-styles.json");
      const weaponStylesRaw = await fs.readFile(weaponStylesPath, "utf-8");
      const raw = JSON.parse(weaponStylesRaw) as unknown;
      const parsed = weaponStylesProvider.loadRaw(raw);
      // Seed runtime registry (parity with PIE hot-reload).
      weaponStylesRegistry.load(parsed);
    } catch (err) {
      console.warn(
        `[DataManager] weapon-styles.json not found or invalid (${err instanceof Error ? err.message : String(err)}), authored weapon styles will be disabled`,
      );
    }

    // Load npc-sizes manifest (optional — tile-grid collision falls
    // back to legacy hardcoded sizes when absent).
    try {
      const npcSizesPath = path.join(manifestsDir, "npc-sizes.json");
      const npcSizesRaw = await fs.readFile(npcSizesPath, "utf-8");
      const raw = JSON.parse(npcSizesRaw) as unknown;
      const parsed = npcSizesProvider.loadRaw(raw);
      // Seed runtime registry (parity with PIE hot-reload).
      npcSizesRegistry.load(parsed);
    } catch (err) {
      console.warn(
        `[DataManager] npc-sizes.json not found or invalid (${err instanceof Error ? err.message : String(err)}), authored NPC sizes will be disabled`,
      );
    }

    // Load onboarding-goals manifest (optional — onboarding tracker
    // has no goals to display when absent).
    try {
      const onboardingPath = path.join(manifestsDir, "onboarding-goals.json");
      const onboardingRaw = await fs.readFile(onboardingPath, "utf-8");
      const raw = JSON.parse(onboardingRaw) as unknown;
      const parsed = onboardingGoalsProvider.loadRaw(raw);
      // Seed runtime registry (parity with PIE hot-reload).
      onboardingGoalsRegistry.load(parsed);
    } catch (err) {
      console.warn(
        `[DataManager] onboarding-goals.json not found or invalid (${err instanceof Error ? err.message : String(err)}), onboarding tracker will be disabled`,
      );
    }

    // Load skill-icons manifest (optional — UI falls back to legacy
    // hardcoded skill icons when absent).
    try {
      const skillIconsPath = path.join(manifestsDir, "skill-icons.json");
      const skillIconsRaw = await fs.readFile(skillIconsPath, "utf-8");
      const raw = JSON.parse(skillIconsRaw) as unknown;
      const parsed = skillIconsProvider.loadRaw(raw);
      // Seed runtime registry (parity with PIE hot-reload).
      skillIconsRegistry.load(parsed);
    } catch (err) {
      console.warn(
        `[DataManager] skill-icons.json not found or invalid (${err instanceof Error ? err.message : String(err)}), authored skill icons will be disabled`,
      );
    }

    // Load player-emotes manifest (optional — avatar layer falls
    // back to legacy hardcoded emotes when absent).
    try {
      const emotesPath = path.join(manifestsDir, "player-emotes.json");
      const emotesRaw = await fs.readFile(emotesPath, "utf-8");
      const raw = JSON.parse(emotesRaw) as unknown;
      const parsed = playerEmotesProvider.loadRaw(raw);
      // Seed runtime registry (parity with PIE hot-reload).
      playerEmotesRegistry.load(parsed);
    } catch (err) {
      console.warn(
        `[DataManager] player-emotes.json not found or invalid (${err instanceof Error ? err.message : String(err)}), authored player emotes will be disabled`,
      );
    }

    // Load skill-unlocks manifest (optional — level-up popup has no
    // content-unlock hints when absent).
    try {
      const skillUnlocksPath = path.join(manifestsDir, "skill-unlocks.json");
      const skillUnlocksRaw = await fs.readFile(skillUnlocksPath, "utf-8");
      const raw = JSON.parse(skillUnlocksRaw) as unknown;
      const parsed = skillUnlocksProvider.loadRaw(raw);
      // Seed runtime registry (parity with PIE hot-reload).
      skillUnlocksRegistry.load(parsed);
    } catch (err) {
      console.warn(
        `[DataManager] skill-unlocks.json not found or invalid (${err instanceof Error ? err.message : String(err)}), skill unlock notifications will be disabled`,
      );
    }

    // Load matchmaking-tuning manifest (optional — runtime
    // matchmaking defaults apply when absent).
    try {
      const mmtPath = path.join(manifestsDir, "matchmaking-tuning.json");
      const mmtRaw = await fs.readFile(mmtPath, "utf-8");
      const raw = JSON.parse(mmtRaw) as unknown;
      const parsed = matchmakingTuningProvider.loadRaw(raw);
      // Seed runtime registry (parity with PIE hot-reload).
      matchmakingRegistry.load(parsed);
    } catch (err) {
      console.warn(
        `[DataManager] matchmaking-tuning.json not found or invalid (${err instanceof Error ? err.message : String(err)}), matchmaking defaults will apply`,
      );
    }

    // Load spell-visuals manifest (optional — projectile renderer
    // falls back to legacy hardcoded visuals when absent).
    try {
      const spellVisualsPath = path.join(manifestsDir, "spell-visuals.json");
      const spellVisualsRaw = await fs.readFile(spellVisualsPath, "utf-8");
      const raw = JSON.parse(spellVisualsRaw) as unknown;
      const parsed = spellVisualsProvider.loadRaw(raw);
      // Seed runtime registry (parity with PIE hot-reload).
      spellVisualsRegistry.load(parsed);
    } catch (err) {
      console.warn(
        `[DataManager] spell-visuals.json not found or invalid (${err instanceof Error ? err.message : String(err)}), authored spell visuals will be disabled`,
      );
    }

    // Load profiler manifest (optional — profiler overlay uses
    // built-in defaults when absent).
    try {
      const profilerPath = path.join(manifestsDir, "profiler.json");
      const profilerRaw = await fs.readFile(profilerPath, "utf-8");
      const raw = JSON.parse(profilerRaw) as unknown;
      profilerProvider.loadRaw(raw);
    } catch (err) {
      console.warn(
        `[DataManager] profiler.json not found or invalid (${err instanceof Error ? err.message : String(err)}), profiler overlay will use defaults`,
      );
    }

    // Load server-browser manifest (optional — server browser uses
    // built-in defaults when absent).
    try {
      const serverBrowserPath = path.join(manifestsDir, "server-browser.json");
      const serverBrowserRaw = await fs.readFile(serverBrowserPath, "utf-8");
      const raw = JSON.parse(serverBrowserRaw) as unknown;
      const parsed = serverBrowserProvider.loadRaw(raw);
      // Seed runtime registry (parity with PIE hot-reload).
      serverBrowserRegistry.load(parsed);
    } catch (err) {
      console.warn(
        `[DataManager] server-browser.json not found or invalid (${err instanceof Error ? err.message : String(err)}), server browser will use defaults`,
      );
    }

    // Load store-front manifest (optional — premium store stays
    // closed when absent).
    try {
      const storeFrontPath = path.join(manifestsDir, "store-front.json");
      const storeFrontRaw = await fs.readFile(storeFrontPath, "utf-8");
      const raw = JSON.parse(storeFrontRaw) as unknown;
      const parsed = storeFrontProvider.loadRaw(raw);
      // Seed runtime registry (parity with PIE hot-reload).
      storeFrontRegistry.load(parsed);
    } catch (err) {
      console.warn(
        `[DataManager] store-front.json not found or invalid (${err instanceof Error ? err.message : String(err)}), premium store will be closed`,
      );
    }

    // Load commerce manifest (optional — legacy hardcoded commerce
    // constants apply when absent).
    try {
      const commercePath = path.join(manifestsDir, "commerce.json");
      const commerceRaw = await fs.readFile(commercePath, "utf-8");
      const raw = JSON.parse(commerceRaw) as unknown;
      const parsed = commerceProvider.loadRaw(raw);
      // Seed runtime registry (parity with PIE hot-reload).
      commerceRegistry.load(parsed);
    } catch (err) {
      console.warn(
        `[DataManager] commerce.json not found or invalid (${err instanceof Error ? err.message : String(err)}), commerce constants will use legacy defaults`,
      );
    }

    // Load interaction manifest (optional — legacy hardcoded
    // interaction constants apply when absent).
    try {
      const interactionPath = path.join(manifestsDir, "interaction.json");
      const interactionRaw = await fs.readFile(interactionPath, "utf-8");
      const raw = JSON.parse(interactionRaw) as unknown;
      const parsed = interactionProvider.loadRaw(raw);
      // Seed runtime registry (parity with PIE hot-reload).
      interactionConfigRegistry.load(parsed);
    } catch (err) {
      console.warn(
        `[DataManager] interaction.json not found or invalid (${err instanceof Error ? err.message : String(err)}), interaction constants will use legacy defaults`,
      );
    }

    // Load combat manifest (optional — legacy hardcoded combat
    // constants apply when absent).
    try {
      const combatPath = path.join(manifestsDir, "combat-constants.json");
      const combatRaw = await fs.readFile(combatPath, "utf-8");
      const raw = JSON.parse(combatRaw) as unknown;
      combatProvider.loadRaw(raw);
    } catch (err) {
      console.warn(
        `[DataManager] combat-constants.json not found or invalid (${err instanceof Error ? err.message : String(err)}), combat constants will use legacy defaults`,
      );
    }

    // Load equipment manifest (optional — legacy hardcoded equipment
    // constants apply when absent).
    try {
      const equipmentPath = path.join(manifestsDir, "equipment-constants.json");
      const equipmentRaw = await fs.readFile(equipmentPath, "utf-8");
      const raw = JSON.parse(equipmentRaw) as unknown;
      const parsed = equipmentProvider.loadRaw(raw);
      // Seed runtime registry (parity with PIE hot-reload).
      equipmentManifestRegistry.load(parsed);
    } catch (err) {
      console.warn(
        `[DataManager] equipment-constants.json not found or invalid (${err instanceof Error ? err.message : String(err)}), equipment constants will use legacy defaults`,
      );
    }

    // Load game manifest (optional — legacy hardcoded game
    // constants apply when absent).
    try {
      const gamePath = path.join(manifestsDir, "game-constants.json");
      const gameRaw = await fs.readFile(gamePath, "utf-8");
      const raw = JSON.parse(gameRaw) as unknown;
      gameProvider.loadRaw(raw);
    } catch (err) {
      console.warn(
        `[DataManager] game-constants.json not found or invalid (${err instanceof Error ? err.message : String(err)}), game constants will use legacy defaults`,
      );
    }

    // Load smithing manifest (optional — legacy hardcoded smithing
    // constants apply when absent).
    try {
      const smithingPath = path.join(manifestsDir, "smithing-constants.json");
      const smithingRaw = await fs.readFile(smithingPath, "utf-8");
      const raw = JSON.parse(smithingRaw) as unknown;
      const parsed = smithingProvider.loadRaw(raw);
      // Seed runtime registry (parity with PIE hot-reload).
      smithingRegistry.load(parsed);
    } catch (err) {
      console.warn(
        `[DataManager] smithing-constants.json not found or invalid (${err instanceof Error ? err.message : String(err)}), smithing constants will use legacy defaults`,
      );
    }

    // Load world-structure manifest (optional — legacy hardcoded
    // world structure constants apply when absent).
    try {
      const wsPath = path.join(manifestsDir, "world-structure.json");
      const wsRaw = await fs.readFile(wsPath, "utf-8");
      const raw = JSON.parse(wsRaw) as unknown;
      worldStructureProvider.loadRaw(raw);
    } catch (err) {
      console.warn(
        `[DataManager] world-structure.json not found or invalid (${err instanceof Error ? err.message : String(err)}), world structure constants will use legacy defaults`,
      );
    }

    // Load gathering manifest (optional — legacy hardcoded
    // gathering constants apply when absent).
    try {
      const gatheringPath = path.join(manifestsDir, "gathering-constants.json");
      const gatheringRaw = await fs.readFile(gatheringPath, "utf-8");
      const raw = JSON.parse(gatheringRaw) as unknown;
      gatheringProvider.loadRaw(raw);
    } catch (err) {
      console.warn(
        `[DataManager] gathering-constants.json not found or invalid (${err instanceof Error ? err.message : String(err)}), gathering constants will use legacy defaults`,
      );
    }

    // Load processing manifest (optional — legacy hardcoded
    // processing constants apply when absent).
    try {
      const processingPath = path.join(
        manifestsDir,
        "processing-constants.json",
      );
      const processingRaw = await fs.readFile(processingPath, "utf-8");
      const raw = JSON.parse(processingRaw) as unknown;
      const parsed = processingProvider.loadRaw(raw);
      // Seed runtime registry (parity with PIE hot-reload).
      processingRegistry.load(parsed);
    } catch (err) {
      console.warn(
        `[DataManager] processing-constants.json not found or invalid (${err instanceof Error ? err.message : String(err)}), processing constants will use legacy defaults`,
      );
    }

    // Load woodcutting manifest (optional — runtime gathering path
    // still parses inline; provider persists authored data for rewire).
    try {
      const woodcuttingPath = path.join(
        manifestsDir,
        "gathering",
        "woodcutting.json",
      );
      const woodcuttingRaw = await fs.readFile(woodcuttingPath, "utf-8");
      const raw = JSON.parse(woodcuttingRaw) as unknown;
      woodcuttingProvider.loadRaw(raw);
    } catch (err) {
      console.warn(
        `[DataManager] gathering/woodcutting.json not found or invalid (${err instanceof Error ? err.message : String(err)}), woodcutting provider stays unloaded`,
      );
    }

    // Load mining manifest (optional).
    try {
      const miningPath = path.join(manifestsDir, "gathering", "mining.json");
      const miningRaw = await fs.readFile(miningPath, "utf-8");
      const raw = JSON.parse(miningRaw) as unknown;
      miningProvider.loadRaw(raw);
    } catch (err) {
      console.warn(
        `[DataManager] gathering/mining.json not found or invalid (${err instanceof Error ? err.message : String(err)}), mining provider stays unloaded`,
      );
    }

    // Load fishing manifest (optional).
    try {
      const fishingPath = path.join(manifestsDir, "gathering", "fishing.json");
      const fishingRaw = await fs.readFile(fishingPath, "utf-8");
      const raw = JSON.parse(fishingRaw) as unknown;
      fishingProvider.loadRaw(raw);
    } catch (err) {
      console.warn(
        `[DataManager] gathering/fishing.json not found or invalid (${err instanceof Error ? err.message : String(err)}), fishing provider stays unloaded`,
      );
    }

    // Load combat-spells manifest (optional).
    try {
      const combatSpellsPath = path.join(manifestsDir, "combat-spells.json");
      const combatSpellsRaw = await fs.readFile(combatSpellsPath, "utf-8");
      const raw = JSON.parse(combatSpellsRaw) as unknown;
      combatSpellsProvider.loadRaw(raw);
    } catch (err) {
      console.warn(
        `[DataManager] combat-spells.json not found or invalid (${err instanceof Error ? err.message : String(err)}), combat-spells provider stays unloaded`,
      );
    }

    // Load npcs spawn-constants manifest (optional).
    try {
      const npcsPath = path.join(manifestsDir, "npcs-spawn-constants.json");
      const npcsRaw = await fs.readFile(npcsPath, "utf-8");
      const raw = JSON.parse(npcsRaw) as unknown;
      npcsProvider.loadRaw(raw);
    } catch (err) {
      console.warn(
        `[DataManager] npcs-spawn-constants.json not found or invalid (${err instanceof Error ? err.message : String(err)}), npcs provider stays unloaded`,
      );
    }

    // Load quests manifest (optional).
    try {
      const questsPath = path.join(manifestsDir, "quests.json");
      const questsRaw = await fs.readFile(questsPath, "utf-8");
      const raw = JSON.parse(questsRaw) as unknown;
      questsProvider.loadRaw(raw);
    } catch (err) {
      console.warn(
        `[DataManager] quests.json not found or invalid (${err instanceof Error ? err.message : String(err)}), quests provider stays unloaded`,
      );
    }

    // Load plugin registry manifest (optional).
    try {
      const pluginRegistryPath = path.join(
        manifestsDir,
        "plugin-registry.json",
      );
      const pluginRegistryRaw = await fs.readFile(pluginRegistryPath, "utf-8");
      const raw = JSON.parse(pluginRegistryRaw) as unknown;
      pluginRegistryProvider.loadRaw(raw);
    } catch (err) {
      console.warn(
        `[DataManager] plugin-registry.json not found or invalid (${err instanceof Error ? err.message : String(err)}), plugin registry provider stays unloaded`,
      );
    }

    // Load world-areas manifest (optional).
    try {
      const worldAreasPath = path.join(manifestsDir, "world-areas.json");
      const worldAreasRaw = await fs.readFile(worldAreasPath, "utf-8");
      const raw = JSON.parse(worldAreasRaw) as unknown;
      const parsed = worldAreasProvider.loadRaw(raw);
      // Seed runtime registry (parity with PIE hot-reload).
      worldAreasRegistry.load(parsed);
    } catch (err) {
      console.warn(
        `[DataManager] world-areas.json not found or invalid (${err instanceof Error ? err.message : String(err)}), world-areas provider stays unloaded`,
      );
    }

    // Load world-config manifest (optional, singleton provider anchor —
    // legacy `setWorldConfig()` static setter remains authoritative).
    try {
      const worldConfigPath = path.join(manifestsDir, "world-config.json");
      const worldConfigRaw = await fs.readFile(worldConfigPath, "utf-8");
      const raw = JSON.parse(worldConfigRaw) as unknown;
      worldConfigProvider.loadRaw(raw);
    } catch (err) {
      console.warn(
        `[DataManager] world-config.json not found or invalid (${err instanceof Error ? err.message : String(err)}), world-config provider stays unloaded`,
      );
    }

    // Load factions manifest (optional — no authored reputation
    // graph when absent, runtime has no factions to resolve).
    try {
      const factionsPath = path.join(manifestsDir, "factions.json");
      const factionsRaw = await fs.readFile(factionsPath, "utf-8");
      const raw = JSON.parse(factionsRaw) as unknown;
      const parsed = factionsProvider.loadRaw(raw);
      // Seed runtime registry (parity with PIE hot-reload).
      factionsRegistry.load(parsed);
    } catch (err) {
      console.warn(
        `[DataManager] factions.json not found or invalid (${err instanceof Error ? err.message : String(err)}), faction system will be disabled`,
      );
    }

    // Load save-data manifest (optional — no authored slices when
    // absent, engine's built-in persistence continues unchanged).
    try {
      const saveDataPath = path.join(manifestsDir, "save-data.json");
      const saveDataRaw = await fs.readFile(saveDataPath, "utf-8");
      const raw = JSON.parse(saveDataRaw) as unknown;
      saveDataProvider.loadRaw(raw);
    } catch (err) {
      console.warn(
        `[DataManager] save-data.json not found or invalid (${err instanceof Error ? err.message : String(err)}), plugin save-data slices will be disabled`,
      );
    }

    // Load music-state-machine manifest (optional — audio layer
    // has no state machines to drive when absent).
    try {
      const musicFSMPath = path.join(manifestsDir, "music-state-machine.json");
      const musicFSMData = await fs.readFile(musicFSMPath, "utf-8");
      const raw = JSON.parse(musicFSMData) as unknown;
      const parsed = musicStateMachineProvider.loadRaw(raw);
      // Seed runtime music-state registry (parity with PIE path).
      musicStateMachineRegistry.load(parsed);
    } catch (err) {
      console.warn(
        `[DataManager] music-state-machine.json not found or invalid (${err instanceof Error ? err.message : String(err)}), dynamic music state machines will be disabled`,
      );
    }

    // Load interaction-prompts manifest (optional — HUD silently
    // skips the prompt layer when absent).
    try {
      const interactionPromptsPath = path.join(
        manifestsDir,
        "interaction-prompts.json",
      );
      const interactionPromptsData = await fs.readFile(
        interactionPromptsPath,
        "utf-8",
      );
      const raw = JSON.parse(interactionPromptsData) as unknown;
      const parsed = interactionPromptsProvider.loadRaw(raw);
      // Seed runtime prompt registry (parity with PIE path).
      interactionPromptRegistry.load(parsed);
    } catch (err) {
      console.warn(
        `[DataManager] interaction-prompts.json not found or invalid (${err instanceof Error ? err.message : String(err)}), interaction HUD prompts will be disabled`,
      );
    }

    // Load loot-tables manifest (optional — LootSystem falls back to
    // the legacy LootTableService path for every mob type when absent).
    try {
      const lootPath = path.join(manifestsDir, "loot-tables.json");
      const lootData = await fs.readFile(lootPath, "utf-8");
      const raw = JSON.parse(lootData) as unknown;
      lootTablesProvider.loadRaw(raw);
    } catch (err) {
      console.warn(
        `[DataManager] loot-tables.json not found or invalid (${err instanceof Error ? err.message : String(err)}), LootSystem will use legacy drop tables`,
      );
    }

    // Load mob→loot-table mappings manifest (optional — without it no
    // `mobType` is bound to the authored roller).
    try {
      const mappingsPath = path.join(
        manifestsDir,
        "mob-loot-table-mappings.json",
      );
      const mappingsData = await fs.readFile(mappingsPath, "utf-8");
      const raw = JSON.parse(mappingsData) as unknown;
      mobLootTableMappingsProvider.loadRaw(raw);
    } catch (err) {
      console.warn(
        `[DataManager] mob-loot-table-mappings.json not found or invalid (${err instanceof Error ? err.message : String(err)}), authored mob→table mappings will be unavailable`,
      );
    }

    // Load dialogue manifest (optional — without it DialogueSystem
    // falls back to the legacy `NPCDialogueTree` embedded in npcs.json).
    try {
      const dialoguePath = path.join(manifestsDir, "dialogue.json");
      const dialogueData = await fs.readFile(dialoguePath, "utf-8");
      const raw = JSON.parse(dialogueData) as unknown;
      dialogueProvider.loadRaw(raw);
    } catch (err) {
      console.warn(
        `[DataManager] dialogue.json not found or invalid (${err instanceof Error ? err.message : String(err)}), authored dialogue trees will be unavailable`,
      );
    }

    // Load NPC → authored-dialogue-tree bindings manifest (optional).
    try {
      const bindingsPath = path.join(
        manifestsDir,
        "npc-dialogue-bindings.json",
      );
      const bindingsData = await fs.readFile(bindingsPath, "utf-8");
      const raw = JSON.parse(bindingsData) as unknown;
      npcDialogueBindingsProvider.loadRaw(raw);
    } catch (err) {
      console.warn(
        `[DataManager] npc-dialogue-bindings.json not found or invalid (${err instanceof Error ? err.message : String(err)}), authored NPC→tree bindings will be unavailable`,
      );
    }

    // Load localization bundle (optional — without it DialogueSystem
    // echoes raw textKeys for authored dialogue lines).
    try {
      const locPath = path.join(manifestsDir, "localization.json");
      const locData = await fs.readFile(locPath, "utf-8");
      const raw = JSON.parse(locData) as unknown;
      localizationProvider.loadRaw(raw);
    } catch (err) {
      console.warn(
        `[DataManager] localization.json not found or invalid (${err instanceof Error ? err.message : String(err)}), authored textKeys will echo raw`,
      );
    }

    // Rebuild ProcessingDataProvider to use the loaded manifests
    // This is necessary in case it was already lazy-initialized before manifests loaded
    processingDataProvider.rebuild();

    // Load model bounds manifest (for automatic footprint calculation)
    // Must load BEFORE stations.json so footprints can be auto-calculated
    try {
      const boundsPath = path.join(manifestsDir, "model-bounds.json");
      const boundsData = await fs.readFile(boundsPath, "utf-8");
      const boundsManifest = JSON.parse(boundsData) as ModelBoundsManifest;
      stationDataProvider.loadModelBounds(boundsManifest);
    } catch {
      console.warn(
        "[DataManager] model-bounds.json not found, using default footprints",
      );
    }

    // Load stations manifest
    try {
      const stationsPath = path.join(manifestsDir, "stations.json");
      const stationsData = await fs.readFile(stationsPath, "utf-8");
      const stationsManifest = JSON.parse(stationsData) as StationsManifest;
      stationDataProvider.loadStations(stationsManifest);
    } catch {
      console.warn(
        "[DataManager] stations.json not found, using default station data",
      );
    }
  }

  /**
   * Load gathering manifests from CDN
   * Loads woodcutting, mining, and fishing data from gathering/*.json
   * and populates EXTERNAL_RESOURCES for ResourceSystem
   */
  private async loadGatheringManifestsFromCDN(baseUrl: string): Promise<void> {
    // Initialize EXTERNAL_RESOURCES map if needed
    if (
      !(
        globalThis as {
          EXTERNAL_RESOURCES?: Map<string, ExternalResourceData>;
        }
      ).EXTERNAL_RESOURCES
    ) {
      (
        globalThis as {
          EXTERNAL_RESOURCES?: Map<string, ExternalResourceData>;
        }
      ).EXTERNAL_RESOURCES = new Map();
    }

    const resourcesMap = (
      globalThis as unknown as {
        EXTERNAL_RESOURCES: Map<string, ExternalResourceData>;
      }
    ).EXTERNAL_RESOURCES;

    // Load all 3 gathering manifests in parallel
    await Promise.allSettled([
      // Woodcutting (trees)
      (async () => {
        try {
          const woodcuttingRes = await fetch(
            `${baseUrl}/gathering/woodcutting.json`,
          );
          const woodcuttingManifest = WoodcuttingManifestSchema.parse(
            await woodcuttingRes.json(),
          );
          gatheringResources.loadWoodcutting(woodcuttingManifest);
          for (const tree of woodcuttingManifest.trees) {
            resourcesMap.set(tree.id, tree);
          }
        } catch {
          console.warn(
            "[DataManager] gathering/woodcutting.json not found, trying legacy resources.json",
          );
        }
      })(),

      // Mining (rocks/ores)
      (async () => {
        try {
          const miningRes = await fetch(`${baseUrl}/gathering/mining.json`);
          const miningManifest = MiningManifestSchema.parse(
            await miningRes.json(),
          );
          gatheringResources.loadMining(miningManifest);
          for (const rock of miningManifest.rocks) {
            resourcesMap.set(rock.id, rock);
          }
        } catch {
          console.warn(
            "[DataManager] gathering/mining.json not found, trying legacy resources.json",
          );
        }
      })(),

      // Fishing (spots)
      (async () => {
        try {
          const fishingRes = await fetch(`${baseUrl}/gathering/fishing.json`);
          const fishingManifest = FishingManifestSchema.parse(
            await fishingRes.json(),
          );
          gatheringResources.loadFishing(fishingManifest);
          for (const spot of fishingManifest.spots) {
            resourcesMap.set(spot.id, spot);
          }
        } catch {
          console.warn(
            "[DataManager] gathering/fishing.json not found, trying legacy resources.json",
          );
        }
      })(),
    ]);

    // Fallback to legacy resources.json if no resources loaded
    if (resourcesMap.size === 0) {
      console.warn(
        "[DataManager] No gathering manifests found, falling back to resources.json",
      );
      try {
        // Legacy fallback - resources.json is in items/ folder
        const resourcesRes = await fetch(`${baseUrl}/items/resources.json`);
        const resourceList =
          (await resourcesRes.json()) as Array<ExternalResourceData>;
        for (const resource of resourceList) {
          resourcesMap.set(resource.id, resource);
        }
      } catch {
        console.error(
          "[DataManager] Failed to load resources - gathering skills will not work",
        );
      }
    }
  }

  /**
   * Load gathering manifests from filesystem (server-side)
   * Loads woodcutting, mining, and fishing data from gathering/*.json
   * and populates EXTERNAL_RESOURCES for ResourceSystem
   */
  private async loadGatheringManifestsFromFilesystem(
    fs: typeof import("fs/promises"),
    path: typeof import("path"),
    manifestsDir: string,
  ): Promise<void> {
    // Initialize EXTERNAL_RESOURCES map if needed
    if (
      !(
        globalThis as {
          EXTERNAL_RESOURCES?: Map<string, ExternalResourceData>;
        }
      ).EXTERNAL_RESOURCES
    ) {
      (
        globalThis as {
          EXTERNAL_RESOURCES?: Map<string, ExternalResourceData>;
        }
      ).EXTERNAL_RESOURCES = new Map();
    }

    const resourcesMap = (
      globalThis as unknown as {
        EXTERNAL_RESOURCES: Map<string, ExternalResourceData>;
      }
    ).EXTERNAL_RESOURCES;

    const gatheringDir = path.join(manifestsDir, "gathering");

    // Local manifests directory (in main codebase, takes priority over git repo)
    const localManifestsDir = path.join(
      manifestsDir,
      "..",
      "..",
      "..",
      "manifests",
      "gathering",
    );

    // Load woodcutting (trees) — check local manifest first, then fall back to git repo
    try {
      let woodcuttingData: string | null = null;
      let source = "";

      // Try local manifest first (packages/server/manifests/gathering/woodcutting.json)
      try {
        const localPath = path.join(localManifestsDir, "woodcutting.json");
        woodcuttingData = await fs.readFile(localPath, "utf-8");
        source = localPath;
      } catch {
        // Local not found, fall back to git repo manifest
        const repoPath = path.join(gatheringDir, "woodcutting.json");
        woodcuttingData = await fs.readFile(repoPath, "utf-8");
        source = repoPath;
      }

      const woodcuttingManifest = WoodcuttingManifestSchema.parse(
        JSON.parse(woodcuttingData),
      );
      gatheringResources.loadWoodcutting(woodcuttingManifest);
      for (const tree of woodcuttingManifest.trees) {
        resourcesMap.set(tree.id, tree);
      }
      console.log(
        `[DataManager] ✅ Loaded woodcutting manifest (${woodcuttingManifest.trees.length} trees) from: ${source}`,
      );
    } catch {
      console.warn(
        "[DataManager] gathering/woodcutting.json not found, trying legacy resources.json",
      );
    }

    // Load mining (rocks/ores)
    try {
      const miningPath = path.join(gatheringDir, "mining.json");
      const miningData = await fs.readFile(miningPath, "utf-8");
      const miningManifest = MiningManifestSchema.parse(JSON.parse(miningData));
      gatheringResources.loadMining(miningManifest);
      for (const rock of miningManifest.rocks) {
        resourcesMap.set(rock.id, rock);
      }
    } catch {
      console.warn(
        "[DataManager] gathering/mining.json not found, trying legacy resources.json",
      );
    }

    // Load fishing (spots)
    try {
      const fishingPath = path.join(gatheringDir, "fishing.json");
      const fishingData = await fs.readFile(fishingPath, "utf-8");
      const fishingManifest = FishingManifestSchema.parse(
        JSON.parse(fishingData),
      );
      gatheringResources.loadFishing(fishingManifest);
      for (const spot of fishingManifest.spots) {
        resourcesMap.set(spot.id, spot);
      }
    } catch {
      console.warn(
        "[DataManager] gathering/fishing.json not found, trying legacy resources.json",
      );
    }

    // Fallback to legacy resources.json if no resources loaded
    if (resourcesMap.size === 0) {
      console.warn(
        "[DataManager] No gathering manifests found, falling back to resources.json",
      );
      try {
        const resourcesPath = path.join(manifestsDir, "resources.json");
        const resourcesData = await fs.readFile(resourcesPath, "utf-8");
        const resourceList = JSON.parse(
          resourcesData,
        ) as Array<ExternalResourceData>;
        for (const resource of resourceList) {
          resourcesMap.set(resource.id, resource);
        }
      } catch {
        console.error(
          "[DataManager] Failed to load resources - gathering skills will not work",
        );
      }
    }
  }

  private normalizeNPC(npc: NPCDataInput): NPCData {
    // Ensure required fields have sane defaults
    const archetypeModel = npc.modelArchetype
      ? NPC_MODEL_ARCHETYPES[npc.modelArchetype]
      : undefined;
    const fallbackModel =
      npc.category === "neutral" || npc.category === "quest"
        ? NPC_MODEL_ARCHETYPES.human
        : NPC_MODEL_ARCHETYPES.goblin;

    // NOTE: VRM files are preferred for rigged characters because:
    // 1. VRM factory auto-normalizes to 1.6m height
    // 2. VRM handles skeleton binding correctly
    // 3. GLB rigged models break when scaled (skeleton/animation issues)
    // If VRM has buffer parsing issues, fix the VRM file (optimize/compress) rather than substituting GLB
    // Handle levelRange - can be array [min, max] or object { min, max } in JSON
    let levelRange: LevelRange | undefined;
    if (npc.levelRange) {
      if (Array.isArray(npc.levelRange)) {
        // Convert array format [min, max] to object format
        const [min, max] = npc.levelRange as unknown as [number, number];
        levelRange = { min, max };
      } else {
        levelRange = npc.levelRange;
      }
    }

    const defaults: Partial<NPCData> = {
      faction: npc.faction || "unknown",
      spawnCategory:
        npc.spawnCategory ?? (npc.category === "boss" ? "world" : undefined),
      modelArchetype: npc.modelArchetype,
      levelRange,
      stats: {
        level: npc.stats?.level ?? 1,
        health: npc.stats?.health ?? 10, // classic MMORPG: hitpoints = max HP directly
        attack: npc.stats?.attack ?? 1,
        strength: npc.stats?.strength ?? 1,
        defense: npc.stats?.defense ?? 1,
        defenseBonus: npc.stats?.defenseBonus ?? 0,
        ranged: npc.stats?.ranged ?? 1,
        magic: npc.stats?.magic ?? 1,
      },
      combat: {
        attackable: npc.combat?.attackable ?? true,
        aggressive: npc.combat?.aggressive ?? false,
        retaliates: npc.combat?.retaliates ?? true,
        aggroRange: npc.combat?.aggroRange ?? 0, // 0 = non-aggressive by default
        combatRange: npc.combat?.combatRange ?? getDefaultNpcCombatRange(),
        leashRange: npc.combat?.leashRange ?? getDefaultNpcLeashRange(),
        attackSpeedTicks:
          npc.combat?.attackSpeedTicks ?? getDefaultNpcAttackSpeedTicks(),
        respawnTime:
          (npc.combat?.respawnTicks ?? getDefaultNpcRespawnTicks()) *
          getTickDurationMs(), // Convert ticks to ms
        xpReward: npc.combat?.xpReward ?? 0,
        poisonous: npc.combat?.poisonous ?? false,
        immuneToPoison: npc.combat?.immuneToPoison ?? false,
        attackType: npc.combat?.attackType ?? "melee",
        spellId: npc.combat?.spellId,
        arrowId: npc.combat?.arrowId,
      },
      movement: {
        type: npc.movement?.type ?? "stationary",
        speed: npc.movement?.speed ?? 1,
        wanderRadius: npc.movement?.wanderRadius ?? 0,
        roaming: npc.movement?.roaming ?? false,
      },
      drops: {
        defaultDrop: npc.drops?.defaultDrop ?? {
          enabled: false,
          itemId: "",
          quantity: 0,
        },
        always: npc.drops?.always ?? [],
        common: npc.drops?.common ?? [],
        uncommon: npc.drops?.uncommon ?? [],
        rare: npc.drops?.rare ?? [],
        veryRare: npc.drops?.veryRare ?? [],
        rareDropTable: npc.drops?.rareDropTable ?? false,
        rareDropTableChance: npc.drops?.rareDropTableChance,
      },
      services: {
        enabled: npc.services?.enabled ?? false,
        types: npc.services?.types ?? [],
        shopInventory: npc.services?.shopInventory,
        questIds: npc.services?.questIds,
      },
      behavior: {
        enabled: npc.behavior?.enabled ?? false,
        config: npc.behavior?.config,
      },
      appearance: {
        modelPath: npc.appearance?.modelPath ?? archetypeModel ?? fallbackModel,
        iconPath: npc.appearance?.iconPath,
        scale: npc.appearance?.scale ?? 1.0,
        tint: npc.appearance?.tint,
        heldWeaponModel: npc.appearance?.heldWeaponModel,
      },
      position: npc.position || { x: 0, y: 0, z: 0 },
    };
    return {
      ...npc,
      ...defaults,
    } as NPCData;
  }

  /**
   * Initialize the data manager and validate all data
   */
  public async initialize(): Promise<DataValidationResult> {
    if (this.isInitialized) {
      return this.validationResult!;
    }

    // Load externally generated assets (Forge) before validation
    await this.loadExternalAssetsFromWorld();

    this.validationResult = await this.validateAllData();
    this.isInitialized = true;

    const skipValidation =
      typeof process !== "undefined" &&
      typeof process.env !== "undefined" &&
      process.env.SKIP_VALIDATION === "true";

    if (!this.validationResult.isValid && !skipValidation) {
      throw new Error(
        `[DataManager] ❌ Data validation failed: ${this.validationResult.errors.join(", ")}`,
      );
    }

    return this.validationResult;
  }

  /**
   * Validate all externalized data
   */
  private async validateAllData(): Promise<DataValidationResult> {
    const errors: string[] = [];
    const warnings: string[] = [];

    // Check if we're in a TEST environment where manifests might not exist
    // NOTE: CI=true is often set by CI/CD platforms AND production deployments (Railway)
    // Only skip validation for actual test environments, not production CI/CD
    const isTestEnv =
      typeof process !== "undefined" &&
      typeof process.env !== "undefined" &&
      (process.env.NODE_ENV === "test" || process.env.VITEST === "true");

    // Validate items (warning only - manifests might be loading)
    const itemCount = ITEMS.size;
    if (itemCount === 0) {
      warnings.push("No items loaded from manifests yet");
    }

    // Validate NPCs (warning only - manifests might be loading)
    const npcCount = ALL_NPCS.size;
    if (npcCount === 0) {
      warnings.push("No NPCs loaded from manifests yet");
    }

    // Validate world areas (warning in test/CI, error in production)
    const areaCount = Object.keys(ALL_WORLD_AREAS).length;
    if (areaCount === 0) {
      if (isTestEnv) {
        warnings.push(
          "No world areas found - expected in CI/test without manifests",
        );
      } else {
        errors.push("No world areas found in ALL_WORLD_AREAS");
      }
    }

    // Validate treasure locations
    const treasureCount = Object.keys(TREASURE_LOCATIONS).length;
    if (treasureCount === 0) {
      warnings.push("No treasure locations found in TREASURE_LOCATIONS");
    }

    // Validate equipSlot values match valid EquipmentSlotName or "2h"
    if (itemCount > 0) {
      const validSlots = new Set<string>([
        ...Object.values(EquipmentSlotName),
        "2h",
      ]);
      for (const [itemId, item] of ITEMS) {
        if (item.equipSlot && !validSlots.has(item.equipSlot)) {
          errors.push(
            `Item "${itemId}" has invalid equipSlot "${item.equipSlot}" (valid: ${[...validSlots].join(", ")})`,
          );
        }
      }
    }

    // Validate cross-references (only if we have data)
    if (itemCount > 0 && npcCount > 0) {
      this.validateCrossReferences(errors, warnings);
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
      itemCount,
      npcCount,
      areaCount,
      treasureCount,
    };
  }

  /**
   * Validate cross-references between data sets
   */
  private validateCrossReferences(errors: string[], _warnings: string[]): void {
    // Check that mob spawn points reference valid mobs
    for (const [areaId, area] of Object.entries(ALL_WORLD_AREAS)) {
      if (area.mobSpawns) {
        for (const mobSpawn of area.mobSpawns) {
          if (!ALL_NPCS.has(mobSpawn.mobId)) {
            errors.push(
              `Area ${areaId} references unknown NPC: ${mobSpawn.mobId}`,
            );
          }
        }
      }
    }

    // Validate NPC level ranges
    for (const npc of ALL_NPCS.values()) {
      const range = npc.levelRange;
      if (range) {
        const min = range.min;
        const max = range.max;
        if (!Number.isFinite(min) || !Number.isFinite(max)) {
          errors.push(`NPC ${npc.id} has non-finite levelRange values`);
          continue;
        }
        if (min < 1) {
          errors.push(`NPC ${npc.id} levelRange.min must be >= 1`);
        }
        if (max < min) {
          errors.push(`NPC ${npc.id} levelRange.max must be >= min`);
        }
        if (max > 1000) {
          errors.push(`NPC ${npc.id} levelRange.max must be <= 1000`);
        }
        if (npc.stats.level < min || npc.stats.level > max) {
          errors.push(
            `NPC ${npc.id} stats.level must be within levelRange (${min}-${max})`,
          );
        }
      } else if (npc.category === "mob" || npc.category === "boss") {
        errors.push(`NPC ${npc.id} is missing levelRange`);
      }
    }

    // Validate biome mob definitions
    for (const biome of Object.values(BIOMES)) {
      const mobTypes = biome.mobTypes || [];
      const mobs = biome.mobs || [];
      const mobTypeSet = new Set(mobTypes);
      const mobsSet = new Set(mobs);

      if (mobTypes.length !== mobs.length) {
        errors.push(`Biome ${biome.id} has mismatched mobs vs mobTypes length`);
      }

      for (const mobId of mobTypes) {
        if (!mobsSet.has(mobId)) {
          errors.push(
            `Biome ${biome.id} mobTypes includes ${mobId} missing from mobs`,
          );
        }
        if (!ALL_NPCS.has(mobId)) {
          errors.push(
            `Biome ${biome.id} mobTypes references unknown NPC: ${mobId}`,
          );
        }
      }

      for (const mobId of mobs) {
        if (!mobTypeSet.has(mobId)) {
          errors.push(
            `Biome ${biome.id} mobs includes ${mobId} missing from mobTypes`,
          );
        }
      }
    }

    // Check that starter items reference valid items
    for (const startingItem of STARTING_ITEMS) {
      if (!ITEMS.has(startingItem.id)) {
        errors.push(
          `Starting item references unknown item: ${startingItem.id}`,
        );
      }
    }
  }

  /**
   * Get validation result
   */
  public getValidationResult(): DataValidationResult | null {
    return this.validationResult;
  }

  // =============================================================================
  // ITEM DATA ACCESS METHODS
  // =============================================================================

  /**
   * Get all items
   */
  public getAllItems(): Map<string, Item> {
    return ITEMS;
  }

  /**
   * Get item by ID
   */
  public getItem(itemId: string): Item | null {
    return ITEMS.get(itemId) || null;
  }

  /**
   * Get items by type
   */
  public getItemsByType(itemType: string): Item[] {
    return Array.from(ITEMS.values()).filter((item) => item.type === itemType);
  }

  /**
   * Hot-reload item metadata from the editor's PIE session (Phase B3).
   *
   * Partial-merge pattern: the editor's `ManifestItem` surface is lossy
   * (no combat stats, no cooking/tool sub-objects, no equipment bonuses
   * beyond the summary `bonuses` map). To avoid desyncing equipped gear
   * mid-session, we only overlay the **metadata fields** the editor is
   * allowed to edit: `name`, `value`, `weight`, `description`, `examine`,
   * `tradeable`, `stackable`, `rarity`, `modelPath`, `iconPath`. Everything
   * else on the live `Item` (combat stats, requirements, cooking data,
   * tool data, noted variants) is preserved.
   *
   * Rows whose `id` is not already in `ITEMS` are skipped — adding brand-
   * new items requires a full PIE restart because the engine `Item` shape
   * cannot be fully reconstructed from `ManifestItem` alone.
   */
  public hotReloadItemsMetadata(
    editorItems: Array<{
      id: string;
      name: string;
      value: number;
      weight?: number;
      description?: string;
      examine?: string;
      tradeable?: boolean;
      stackable?: boolean;
      rarity?: string;
      modelPath?: string;
      iconPath?: string;

      // Combat-stat fields — optional, omitted fields preserve the
      // existing item's combat profile. Editors that don't care
      // about combat data can leave these unset without corrupting
      // legacy values.
      weaponType?: Item["weaponType"];
      attackType?: Item["attackType"];
      attackSpeed?: number;
      attackRange?: number;
      is2h?: boolean;
      equipSlot?: Item["equipSlot"];
      equipable?: boolean;
      bonuses?: Item["bonuses"];
      requirements?: Item["requirements"];

      // Consumable/prayer fields — same semantics: undefined = leave
      // as-is, non-undefined = overwrite.
      healAmount?: number;
      prayerXp?: number;
      buryLevelRequired?: number;
    }>,
  ): void {
    for (const m of editorItems) {
      const existing = ITEMS.get(m.id);
      if (!existing) continue;
      const merged: Item = {
        ...existing,
        name: m.name,
        value: m.value,
        weight: m.weight ?? existing.weight,
        description: m.description ?? existing.description,
        examine: m.examine ?? existing.examine,
        tradeable: m.tradeable ?? existing.tradeable,
        stackable: m.stackable ?? existing.stackable,
        rarity: (m.rarity as Item["rarity"]) ?? existing.rarity,
        modelPath: m.modelPath ?? existing.modelPath,
        iconPath: m.iconPath ?? existing.iconPath,
        weaponType:
          m.weaponType !== undefined ? m.weaponType : existing.weaponType,
        attackType:
          m.attackType !== undefined ? m.attackType : existing.attackType,
        attackSpeed: m.attackSpeed ?? existing.attackSpeed,
        attackRange: m.attackRange ?? existing.attackRange,
        is2h: m.is2h ?? existing.is2h,
        equipSlot: m.equipSlot !== undefined ? m.equipSlot : existing.equipSlot,
        equipable: m.equipable ?? existing.equipable,
        bonuses: m.bonuses ?? existing.bonuses,
        requirements: m.requirements ?? existing.requirements,
        healAmount: m.healAmount ?? existing.healAmount,
        prayerXp: m.prayerXp ?? existing.prayerXp,
        buryLevelRequired: m.buryLevelRequired ?? existing.buryLevelRequired,
      };
      ITEMS.set(m.id, merged);
    }
  }

  // =============================================================================
  // NPC DATA ACCESS METHODS
  // =============================================================================

  /**
   * Get all NPCs
   */
  public getAllNPCs(): Map<string, NPCData> {
    return ALL_NPCS;
  }

  /**
   * Get NPC by ID
   */
  public getNPC(npcId: string): NPCData | null {
    return ALL_NPCS.get(npcId) || null;
  }

  /**
   * Get NPCs by category
   */
  public getNPCsByCategory(category: NPCCategory): NPCData[] {
    return Array.from(ALL_NPCS.values()).filter(
      (npc) => npc.category === category,
    );
  }

  // =============================================================================
  // WORLD AREA DATA ACCESS METHODS
  // =============================================================================

  /**
   * Get all world areas
   */
  public getAllWorldAreas(): Record<string, WorldArea> {
    return ALL_WORLD_AREAS;
  }

  /**
   * Get starter towns
   */
  public getStarterTowns(): Record<string, WorldArea> {
    return STARTER_TOWNS;
  }

  /**
   * Get world area by ID
   */
  public getWorldArea(areaId: string): WorldArea | null {
    return ALL_WORLD_AREAS[areaId] || null;
  }

  /**
   * Get mob spawns in area
   */
  public getMobSpawnsInArea(areaId: string): MobSpawnPoint[] {
    return getMobSpawnsInArea(areaId);
  }

  /**
   * Get NPCs in area
   */
  public getNPCsInArea(areaId: string): NPCLocation[] {
    return getNPCsInArea(areaId);
  }

  // =============================================================================
  // TREASURE DATA ACCESS METHODS
  // =============================================================================

  /**
   * Get all treasure locations
   */
  public getAllTreasureLocations(): TreasureLocation[] {
    return getAllTreasureLocations();
  }

  /**
   * Get treasure locations by difficulty
   */
  public getTreasureLocationsByDifficulty(
    difficulty: 1 | 2 | 3,
  ): TreasureLocation[] {
    return getTreasureLocationsByDifficulty(difficulty);
  }

  /**
   * Get treasure location by ID
   */
  public getTreasureLocation(locationId: string): TreasureLocation | null {
    return (
      TREASURE_LOCATIONS.find(
        (loc) => (loc as TreasureLocation & { id?: string }).id === locationId,
      ) || null
    );
  }

  // =============================================================================
  // STORE AND BANK DATA ACCESS METHODS
  // =============================================================================

  /**
   * Get all general stores
   */
  public getGeneralStores() {
    return GENERAL_STORES;
  }

  /**
   * Get all banks
   */
  public getBanks() {
    return BANKS;
  }

  // =============================================================================
  // STARTING DATA ACCESS METHODS
  // =============================================================================

  /**
   * Get starting items
   */
  public getStartingItems() {
    return STARTING_ITEMS;
  }

  // =============================================================================
  // UTILITY METHODS
  // =============================================================================

  /**
   * Check if data manager is initialized
   */
  public isReady(): boolean {
    return this.isInitialized;
  }

  /**
   * Get data summary for debugging
   */
  public getDataSummary() {
    if (!this.isInitialized) {
      return "DataManager not initialized";
    }

    return {
      items: ITEMS.size,
      npcs: ALL_NPCS.size,
      worldAreas: Object.keys(ALL_WORLD_AREAS).length,
      treasureLocations: TREASURE_LOCATIONS.length,
      stores: Object.keys(GENERAL_STORES).length,
      banks: Object.keys(BANKS).length,
      startingItems: STARTING_ITEMS.length,
      isValid: this.validationResult?.isValid || false,
    };
  }
}

// Export singleton instance
export const dataManager = DataManager.getInstance();
