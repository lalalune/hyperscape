/**
 * index.ts - @hyperforge/shared Package Entry Point
 *
 * Public API surface for the HyperForge engine substrate.
 *
 * Package Purpose:
 * The HyperForge engine — built on three.js + PhysX, with
 * client-server architecture, authoritative physics, real-time
 * voice chat, and VRM avatar support. Engine-only; game-specific
 * systems (combat, skills, RPG mechanics) live in plugins like
 * @hyperforge/hyperscape (Hyperia is the flagship game built on
 * the engine, not the engine itself).
 *
 * R2.P12 of `PLAN_HYPERIA_DECOUPLING.md` — header rebranded
 * from "Hyperia 3D multiplayer game engine" to "HyperForge
 * engine substrate" to reflect the engine/game separation.
 *
 * Main Exports:
 *
 * 1. World Factories:
 *    - createClientWorld(): Creates browser client world
 *    - createServerWorld(): Creates Node.js server world
 *    - createViewerWorld(): Creates lightweight viewer world
 *    - createNodeClientWorld(): Creates headless Node.js client
 *
 * 2. Core Classes:
 *    - World: Central game world container and ECS coordinator
 *    - System: Base class for all game systems
 *    - Entity: Base entity class for game objects
 *    - PlayerLocal: Local player controller
 *    - PlayerRemote: Remote player representation
 *
 * 3. Systems:
 *    - Physics, Graphics, Audio, Input, Network, etc.
 *    - All client and server systems
 *
 * 4. Types:
 *    - Comprehensive TypeScript types for all APIs
 *    - Entity, Component, System interfaces
 *    - Network, Physics, and Event types
 *
 * 5. Utilities:
 *    - THREE.js helpers and extensions
 *    - PhysX integration utilities
 *    - Validation, logging, and math utilities
 *
 * 6. Nodes:
 *    - Scene graph node types (Mesh, Group, UI, Avatar, etc.)
 *
 * Architecture Notes:
 * - Client and server share most code but have environment-specific systems
 * - PhysX physics runs on both client (via WASM) and server (via Node.js bindings)
 * - Server is authoritative for all game state
 * - Event-driven architecture with type-safe EventBus
 * - Entity Component System (ECS) pattern for game objects
 *
 * Bundle Optimization:
 * This file avoids importing Node.js modules at top-level so client bundlers
 * (like Vite) don't pull server-only dependencies into browser bundles.
 * Server-specific imports are isolated to createServerWorld() and server systems.
 *
 * Used by: Client package, Server package, Plugin-Hyperia package
 */

// Export world factories from runtime/
export * from "./runtime";

// Export terrain shader for unified rendering (used by Asset Forge)
export {
  createTerrainMaterial,
  generateNoiseTexture,
  getNoiseTexture,
  sampleNoiseAtPosition,
  getGrassiness,
  calculateSlope,
  computeTerrainColorCPU,
  type TerrainMaterialOptions,
  type TerrainUniforms,
} from "./systems/shared/world/TerrainShader";

// Export lighting/sky/fog config for World Studio visual parity
export {
  DAY_CYCLE,
  SUN_LIGHT,
  SUN_SHADE,
  NIGHT,
  HEMISPHERE_LIGHT,
  AMBIENT_LIGHT,
  EXPOSURE,
  FOG_COLORS,
  applySunShade,
  applyCustomLighting,
} from "./systems/shared/world/LightingConfig";
export {
  fogRenderTarget,
  applySkyFog,
  FOG_NEAR,
  FOG_FAR,
} from "./systems/shared/world/FogConfig";
export {
  StandaloneSky,
  type StandaloneSkyOptions,
} from "./systems/shared/world/StandaloneSky";
export {
  StandaloneGrass,
  type StandaloneGrassOptions,
  type GrassTerrainSampler,
  type GrassTerrainSample,
} from "./systems/shared/world/StandaloneGrass";
// Waterfall — type re-exported for the hyperscape-plugin's
// WaterfallVisualsSystem (migrated out of `shared/systems/client/`).
export { type WaterfallDefinition } from "./systems/shared/world/WaterfallDefinition";
export {
  WATER,
  WAVES,
  type WaveParams,
  generateWaterNormalMap,
  generateWaterFlowMap,
  generateWaterFoamTexture,
  createWaterMaterial,
  type WaterMaterialUniforms,
  type WaterMaterialOptions,
} from "./systems/shared/world/WaterMaterialCore";
export {
  hourToDayPhase,
  computeDayIntensity,
  computeTransitionFade,
  computeIsDay,
  isGoldenHour,
  updateSunLight,
  updateAmbientLights,
  updateSceneFog,
  computeTargetExposure,
  computeSunPosition,
  updateSceneLighting,
  type SceneLightingRefs,
} from "./systems/shared/world/SceneLightingCore";

// Export core classes
export * from "./core";

// Export entity classes
export { Entity } from "./entities/Entity";
// PlayerEntity, PlayerLocal, PlayerRemote migrated to
// @hyperforge/hyperscape (2026-04-26).
// MobEntity migrated to @hyperforge/hyperscape (2026-04-26).
export type { EventCallback } from "./entities/Entity";

// Export all types from types/index.ts
export type {
  Anchors,
  Chat,
  ChatMessage,
  Component,
  // Entity Component System Types
  Entity as EntityInterface,
  Events,
  // UI and control types
  HotReloadable,
  Matrix4,
  // Network Types
  NetworkConnection,
  // Physics Types
  PhysicsOptions,
  // Player Types
  Player,
  PlayerInput,
  Quaternion,
  // Additional system interfaces
  Settings,
  Stage,
  // System Types
  System as SystemInterface,
  // Math Types
  Vector3,
  World as WorldInterface,
  // Core World Types
  WorldOptions,
  // Additional interfaces without corresponding classes
  ClientMonitor,
  ServerDB,
} from "./types/index";

// Export networking types from types/networking.ts
export type {
  ConnectionParams,
  NetworkWithSocket,
  NodeWebSocket,
  ServerStats,
  SpawnData,
  User,
  Socket as SocketInterface,
  SocketOptions,
  NetworkMetrics,
  MovementValidationResult,
  MovementConfig,
} from "./types/network/networking";

// Export Socket class
export { Socket } from "./platform/shared/Socket";

// Export database types for server use

// Export EventType enum
export { EventType } from "./types/events";

// Export PlayerMigration class
export { PlayerMigration } from "./types/core/core";

// Export enums (these are values, not types)
export {
  WeaponType,
  EquipmentSlotName,
  AttackType,
  ItemType,
} from "./types/core/core";

// Export DeathState enum for death/respawn system
export { DeathState } from "./types/entities/entities";

// Export death/loot types for shadow state and transaction tracking
export type {
  LootResult,
  LootFailureReason,
  PendingLootTransaction,
  DeathAuditEntry,
  DeathAuditAction,
  DeathItemData,
  DeathLock,
} from "./types/death";

// Export db helpers and type guards for server usage
export { dbHelpers, isDatabaseInstance } from "./types/network/database";

// Export role utilities
export {
  addRole,
  removeRole,
  hasRole,
  serializeRoles,
  hasModPermission,
  hasAdminPermission,
  isProtectedFromModAction,
  uuid,
} from "./utils/index";

// Export ID generation utilities (for transaction tracking, etc.)
export { generateTransactionId } from "./utils/IdGenerator";
export {
  deriveStreamingGuardrailReason,
  hasValidStreamingGuardrailAgentSnapshot,
  hasValidStreamingGuardrailArenaPositions,
  isActiveStreamingGuardrailPhase,
  requiresStreamingArenaPositions,
} from "./utils/rendering/streamingGuardrails";
export type {
  StreamingGuardrailAgentSnapshot,
  StreamingGuardrailArenaPositions,
  StreamingGuardrailPhase,
} from "./utils/rendering/streamingGuardrails";

// Export SeededRandom and game RNG utilities (tile-based-MMORPG-accurate deterministic RNG)
export {
  SeededRandom,
  initializeGameRng,
  getGameRng,
  getGameSeed,
  getGameRngState,
} from "./utils/SeededRandom";
export type { SeededRandomState } from "./utils/SeededRandom";

// Export branded type identifiers for compile-time type safety
export type {
  PlayerID,
  ItemID,
  MobID,
  EntityID,
  StoreID,
  BankID,
  ResourceID,
  NPCID,
  SessionID,
  QuestID,
  SkillID,
  ZoneID,
  ChunkID,
  SlotNumber,
} from "./types/core/identifiers";
export {
  isValidPlayerID,
  isValidMobID,
  isValidEntityID,
  isValidItemID,
  isValidStoreID,
  isValidBankID,
  isValidResourceID,
  isValidNPCID,
  isValidSessionID,
  isValidSlotNumber,
  isValidQuestID,
  isValidSkillID,
  isValidZoneID,
  isValidChunkID,
  createPlayerID,
  createMobID,
  createEntityID,
  createItemID,
  createStoreID,
  createBankID,
  createResourceID,
  createNPCID,
  createSessionID,
  createSlotNumber,
  createQuestID,
  createSkillID,
  createZoneID,
  createChunkID,
} from "./types/core/identifiers";

// Export prayer type guards and types
export {
  isValidPrayerId,
  isValidPrayerTogglePayload,
  isValidPrayerBonuses,
  getPlayerPrayerLevel,
  getPlayerPrayerBonus,
  getPlayerPrayerXp,
  MAX_PRAYER_ID_LENGTH,
  MAX_ACTIVE_PRAYERS,
  PRAYER_TOGGLE_COOLDOWN_MS,
  PRAYER_TOGGLE_RATE_LIMIT,
  PRAYER_ID_PATTERN,
} from "./types/game/prayer-types";
export type {
  PrayerCategory,
  PrayerBonuses,
  PrayerDefinition,
  PrayerManifest,
  PrayerState,
  PrayerTogglePayload,
  PrayerToggledEvent,
  PrayerStateSyncPayload,
  PlayerWithPrayerStats,
} from "./types/game/prayer-types";

// trade-types migrated to @hyperforge/hyperscape-plugin/types/trade-types
// 2026-04-27 (top-10 #8 cleanup). TRADE_CONSTANTS inlined into
// data/live/trading-live.ts as engine-side fallback values.

// social-types migrated to @hyperforge/hyperscape-plugin/types/social-types
// 2026-04-27 (top-10 #8 cleanup). SOCIAL_CONSTANTS inlined into
// data/live/social-live.ts as engine-side fallback values.

// Export duel arena types and utilities
export {
  DEFAULT_DUEL_RULES,
  validateRuleCombination,
  INVALID_RULE_COMBINATIONS,
  DEFAULT_EQUIPMENT_RESTRICTIONS,
  createDuelParticipant,
  DUEL_CHALLENGE_TIMEOUT_MS,
  DuelErrorCode,
  DuelEvents,
} from "./types/game/duel-types";
export type {
  DuelRules,
  EquipmentSlotRestriction,
  EquipmentRestrictions,
  StakedItem,
  DuelParticipant,
  DuelState,
  DuelSession,
  ArenaSpawnPoint,
  ArenaBounds,
  Arena,
  PendingDuelChallenge,
  DuelEventName,
} from "./types/game/duel-types";

// quest-types migrated to @hyperforge/hyperscape-plugin/types/quest-types
// 2026-04-27 (top-10 #8 cleanup). isValidQuestId is plugin-side now.

// Export item helpers used by server network snapshot
export {
  ITEMS,
  getItem,
  getBaseItem,
  getNotedItem,
  canBeNoted,
  isNotedItemId,
  getBaseItemId,
  getNotedItemId,
  NOTE_SUFFIX,
} from "./data/items";

// Export store helpers used by server store handler
export { getStoreById } from "./data/banks-stores";

// Export DataManager for server-side hot-reload (deploy routes)
export { DataManager } from "./data/DataManager";
export type {
  WorldJson,
  BrushOverlaysManifest,
  BrushOverlayVegetationPaint,
  BrushOverlayMaterialPaint,
} from "./data/world-structure";

// Export avatar options for character creation
export { AVATAR_OPTIONS } from "./data/avatars";

// Export skill data for UI displays
export {
  SKILL_ICONS,
  getSkillIcon,
  SKILL_DEFINITIONS,
  getSkillDefinition,
  getSkillsByCategory,
  type SkillDefinition,
  type SkillCategory,
} from "./data/skill-icons";

// Export skill unlocks for level-up notifications
export {
  SKILL_UNLOCKS,
  getUnlocksAtLevel,
  getUnlocksUpToLevel,
  getUnlocksForSkill,
  getAllSkillUnlocks,
  clearSkillUnlocksCache,
  loadSkillUnlocks,
  isSkillUnlocksLoaded,
  resetSkillUnlocks,
} from "./data/skill-unlocks";
export type {
  SkillUnlock,
  UnlockType,
  SkillUnlocksManifest,
} from "./data/skill-unlocks";

// Export prayer data provider for UI panels
export { prayerDataProvider } from "./data/PrayerDataProvider";

// Export authored-manifest providers (server bootstrap + editor flows)
export { combatTuningProvider } from "./data/CombatTuningProvider";
export { dialogueConditionBindingsProvider } from "./data/DialogueConditionBindingsProvider";
export { combatTuningAgentBindingsProvider } from "./data/CombatTuningAgentBindingsProvider";
export { xpCurvesProvider } from "./data/XpCurvesProvider";
export { achievementsProvider } from "./data/AchievementsProvider";
export { timeWeatherProvider } from "./data/TimeWeatherProvider";
export { accessibilityProvider } from "./data/AccessibilityProvider";
export { analyticsEventsProvider } from "./data/AnalyticsEventsProvider";
export { renderProfilesProvider } from "./data/RenderProfilesProvider";
export { damageTypesProvider } from "./data/DamageTypesProvider";
export { statusEffectsProvider } from "./data/StatusEffectsProvider";
export { cameraProfilesProvider } from "./data/CameraProfilesProvider";
export { audioBusMixProvider } from "./data/AudioBusMixProvider";
export { postProcessVolumesProvider } from "./data/PostProcessVolumesProvider";
export { npcScheduleProvider } from "./data/NpcScheduleProvider";
export { chatChannelsProvider } from "./data/ChatChannelsProvider";
export { interactionPromptsProvider } from "./data/InteractionPromptsProvider";
export { musicStateMachineProvider } from "./data/MusicStateMachineProvider";
export { saveDataProvider } from "./data/SaveDataProvider";
export { factionsProvider } from "./data/FactionsProvider";
export { mountsProvider } from "./data/MountsProvider";
export { voiceChatProvider } from "./data/VoiceChatProvider";
export { parentalControlsProvider } from "./data/ParentalControlsProvider";
export { tutorialFlowsProvider } from "./data/TutorialFlowsProvider";
export { hapticsProvider } from "./data/HapticsProvider";
export { physicsConfigProvider } from "./data/PhysicsConfigProvider";
export { featureFlagsProvider } from "./data/FeatureFlagsProvider";
export { crashReporterProvider } from "./data/CrashReporterProvider";
export { pushNotificationsProvider } from "./data/PushNotificationsProvider";
export { licenseAgreementsProvider } from "./data/LicenseAgreementsProvider";
export { newsFeedProvider } from "./data/NewsFeedProvider";
export { moderationProvider } from "./data/ModerationProvider";
export { fastTravelProvider } from "./data/FastTravelProvider";
export { respawnProvider } from "./data/RespawnProvider";
export { talentTreesProvider } from "./data/TalentTreesProvider";
export { auctionHouseProvider } from "./data/AuctionHouseProvider";
export { transmogProvider } from "./data/TransmogProvider";
export { housingProvider } from "./data/HousingProvider";
export { groupFinderProvider } from "./data/GroupFinderProvider";
export { friendsSocialProvider } from "./data/FriendsSocialProvider";
export { loadoutsProvider } from "./data/LoadoutsProvider";
export { tradingProvider } from "./data/TradingProvider";
export { itemSetsProvider } from "./data/ItemSetsProvider";
export { leaderboardsProvider } from "./data/LeaderboardsProvider";
export { titlesProvider } from "./data/TitlesProvider";
export { worldEventsProvider } from "./data/WorldEventsProvider";
export { seasonsProvider } from "./data/SeasonsProvider";
export { petCompanionProvider } from "./data/PetCompanionProvider";
export { enchantmentsProvider } from "./data/EnchantmentsProvider";
export { mailProvider } from "./data/MailProvider";
export { tooltipsProvider } from "./data/TooltipsProvider";
export { keyPromptIconsProvider } from "./data/KeyPromptIconsProvider";
export { screenshotProvider } from "./data/ScreenshotProvider";
export { partyGuildProvider } from "./data/PartyGuildProvider";
export { economyTuningProvider } from "./data/EconomyTuningProvider";
export { loadingScreensProvider } from "./data/LoadingScreensProvider";
export { skyboxAtmosphereProvider } from "./data/SkyboxAtmosphereProvider";
export { particleGraphProvider } from "./data/ParticleGraphProvider";
export { cinematicProvider } from "./data/CinematicProvider";
export { editorSnapProvider } from "./data/EditorSnapProvider";
export { deployTargetsProvider } from "./data/DeployTargetsProvider";
export { inputActionsProvider } from "./data/InputActionsProvider";
export { profilerOverlayProvider } from "./data/ProfilerOverlayProvider";
export { replicationProvider } from "./data/ReplicationProvider";
export { prefabProvider } from "./data/PrefabProvider";
export { levelStreamingProvider } from "./data/LevelStreamingProvider";
export { lightingBakeProvider } from "./data/LightingBakeProvider";
export { projectSettingsProvider } from "./data/ProjectSettingsProvider";
export { aiBehaviorProvider } from "./data/AIBehaviorProvider";
export { animationsProvider } from "./data/AnimationsProvider";
export { qualityPresetsProvider } from "./data/QualityPresetsProvider";
export { navMeshProvider } from "./data/NavMeshProvider";
export { lodSettingsProvider } from "./data/LODSettingsProvider";
export { soundEffectsProvider } from "./data/SoundEffectsProvider";
export { vfxProvider } from "./data/VfxProvider";
export { vegetationProvider } from "./data/VegetationProvider";
export { mainMenuProvider } from "./data/MainMenuProvider";
export { creditsProvider } from "./data/CreditsProvider";
export { musicProvider } from "./data/MusicProvider";
export { duelProvider } from "./data/DuelProvider";
export { duelArenasProvider } from "./data/DuelArenasProvider";
export { biomesProvider } from "./data/BiomesProvider";
export { storesProvider } from "./data/StoresProvider";
export { ammunitionProvider } from "./data/AmmunitionProvider";
export { arenaLayoutProvider } from "./data/ArenaLayoutProvider";
export { avatarsProvider } from "./data/AvatarsProvider";
export { bankingProvider } from "./data/BankingProvider";
export { buildingsProvider } from "./data/BuildingsProvider";
export { toolsProvider } from "./data/ToolsProvider";
export { treesProvider } from "./data/TreesProvider";
export { weaponStylesProvider } from "./data/WeaponStylesProvider";
export { npcSizesProvider } from "./data/NPCSizesProvider";
export { onboardingGoalsProvider } from "./data/OnboardingGoalsProvider";
export { skillIconsProvider } from "./data/SkillIconsProvider";
export { playerEmotesProvider } from "./data/PlayerEmotesProvider";
export { skillUnlocksProvider } from "./data/SkillUnlocksProvider";
export { matchmakingTuningProvider } from "./data/MatchmakingTuningProvider";
export { spellVisualsProvider } from "./data/SpellVisualsProvider";
export { profilerProvider } from "./data/ProfilerProvider";
export { serverBrowserProvider } from "./data/ServerBrowserProvider";
export { storeFrontProvider } from "./data/StoreFrontProvider";
export { commerceProvider } from "./data/CommerceProvider";
export { interactionProvider } from "./data/InteractionProvider";
export { combatProvider } from "./data/CombatProvider";
export { equipmentProvider } from "./data/EquipmentProvider";
export { gameProvider } from "./data/GameProvider";
export { smithingProvider } from "./data/SmithingProvider";
export { worldStructureProvider } from "./data/WorldStructureProvider";
export { gatheringProvider } from "./data/GatheringProvider";
export { processingProvider } from "./data/ProcessingProvider";
export { woodcuttingProvider } from "./data/WoodcuttingProvider";
export { miningProvider } from "./data/MiningProvider";
export { fishingProvider } from "./data/FishingProvider";
export { combatSpellsProvider } from "./data/CombatSpellsProvider";
export { npcsProvider } from "./data/NpcsProvider";
export { questsProvider } from "./data/QuestsProvider";
export { pluginRegistryProvider } from "./data/PluginRegistryProvider";
export { worldAreasProvider } from "./data/WorldAreasProvider";
export { worldConfigProvider } from "./data/WorldConfigProvider";
export { lootTablesProvider } from "./data/LootTablesProvider";
export { mobLootTableMappingsProvider } from "./data/MobLootTableMappingsProvider";
export { dialogueProvider } from "./data/DialogueProvider";
export { npcDialogueBindingsProvider } from "./data/NpcDialogueBindingsProvider";
export { localizationProvider } from "./data/LocalizationProvider";
export {
  attachEquipmentVisualToVRM,
  extractEquipmentAttachmentData,
  removeEquipmentVisual,
  resolveEquipmentVisualData,
  resolveEquipmentVisualUrls,
} from "./systems/client/EquipmentVisualHelpers";
export type {
  EquipmentAttachmentData,
  EquipmentVisualModelData,
  EquipmentVisualStore,
  EquipmentVisualUrlResolution,
} from "./systems/client/EquipmentVisualHelpers";

// Export spell service for magic combat
// SpellService migrated to @hyperforge/hyperscape (2026-04-26, Wave 6).

// Export combat spell manifest data (used by duel orchestrator for best-spell selection)
export { COMBAT_SPELLS, SPELL_ORDER } from "./data/combat-spells";
export type { SpellData } from "./data/combat-spells";

// Export elemental staff rune mappings (used by duel orchestrator for rune provisioning)
export { ELEMENTAL_STAVES } from "./data/runes";

// Export world area data for server use
export {
  ALL_WORLD_AREAS,
  STARTER_TOWNS,
  getRandomSpawnPoint,
} from "./data/world-areas";

// Export systems (organized by platform for tree-shaking)
export { Entities } from "./systems/shared";
export { Physics } from "./systems/shared";
export { Particles } from "./systems/shared";
export { LODs } from "./systems/shared";

// Atlased Impostor System - optimized impostor rendering for diverse forests
export {
  AtlasedImpostorManager,
  ATLASED_IMPOSTOR_CONFIG,
  AtlasedImpostorDebug,
  runAtlasedImpostorTests,
  visualTest as atlasedImpostorVisualTest,
  downloadAllSlots as atlasedImpostorDownloadSlots,
} from "./systems/shared/rendering";
export {
  AtlasedTreeImpostors,
  ATLASED_TREE_CONFIG,
} from "./systems/shared/world";

export { ClientInterface } from "./systems/client/ClientInterface"; // UI state, preferences, stats display
export { ClientLoader } from "./systems/client/ClientLoader";
// ServerNetwork removed from main exports - import directly from ./systems/server when needed on server side
export { Environment } from "./systems/shared";
export { ClientNetwork } from "./systems/client/ClientNetwork";
export type { InventorySnapshot } from "./systems/client/ClientNetwork";
export { ClientGraphics } from "./systems/client/ClientGraphics";
export { ClientRuntime } from "./systems/client/ClientRuntime"; // Client lifecycle and diagnostics
export { ClientAudio } from "./systems/client/ClientAudio";
export { ClientLiveKit } from "./systems/client/ClientLiveKit";
export { ClientInput } from "./systems/client/ClientInput";
export { ServerRuntime } from "./systems/server/ServerRuntime"; // Server lifecycle and monitoring
export { ClientActions } from "./systems/client/ClientActions";
export { EventBus } from "./systems/shared";
export { System as SystemClass } from "./systems/shared";
export { SystemBase } from "./systems/shared";
// Engine entity base classes used by world entities migrated to plugin.
export {
  InteractableEntity,
  type InteractableConfig,
} from "./entities/InteractableEntity";
export {
  CombatantEntity,
  type CombatantConfig,
} from "./entities/CombatantEntity";

// Deps for world entities (FireEntity, RangeEntity, HeadstoneEntity,
// ItemEntity, ResourceEntity) migrated to plugin in 2026-04-26 cut.
export { getFireInteractionRange } from "./data/live/processing-live";
// canPlayerLoot / LootPermissionService migrated to
// @hyperforge/hyperscape (2026-04-26).
export type { MeshUserData } from "./types/entities/entity-types";
export type {
  ResourceEntityConfig,
  BankEntityConfig,
  NPCEntityConfig,
  MobEntityConfig,
} from "./types/entities/entities";
export { MobAIState } from "./types/entities/entities";
export type { MobEntityData } from "./types/entities/npc-mob-types";
export { generateKillToken } from "./utils/game/KillTokenUtils";
export {
  getNpcRenderDistance,
  getMobRenderDistance,
} from "./data/live/distance-live";
export {
  AnimationLOD,
  getCameraPosition,
  ANIMATION_LOD_PRESETS,
} from "./utils/rendering/AnimationLOD";
export {
  DistanceFadeController,
  ENTITY_FADE_CONFIGS,
  FadeState,
} from "./utils/rendering/DistanceFade";
export { UIRenderer } from "./utils/rendering";
export { MobInstancedRenderer } from "./utils/rendering/InstancedMeshManager";
export type {
  MobAnimationState,
  MobInstancedHandle,
} from "./types/rendering/nodes";
export { getCameraSystem } from "./utils/SystemUtils";
export type {
  CameraSystem,
  PlayerEffect,
  VRMHooks,
} from "./types/systems/physics";
export { essentialEmotes } from "./data/playerEmotes";
export { getPlayerRenderDistance } from "./data/live/distance-live";
export { RAYCAST_PROXY } from "./systems/client/interaction/constants";

// Engine ECS — public API for registering entity types.
// Plugin (`@hyperforge/hyperscape`) calls this in onEnable for all
// game entity types (player, mob, npc, item, resource, headstone,
// bank, furnace, anvil, altar, range, runecrafting_altar).
export { registerEntityType } from "./systems/shared/entities/Entities";

// `NPCEntity` (and the world entities) migrated to
// @hyperforge/hyperscape (2026-04-26). PlayerEntity / PlayerLocal /
// PlayerRemote / MobEntity / ResourceEntity stay in shared for now
// (engine network code constructs them).

// CombatSystem migrated to @hyperforge/hyperscape (2026-04-26, Wave 6).
// Deps needed by the migrated cluster — most already exported
// elsewhere; add the gaps here.
export {
  calculateRetaliationDelay,
  calculateDamage,
  calculateHitChance,
} from "./utils/game/CombatCalculations";
export type {
  PrayerCombatBonuses,
  CombatStats,
} from "./utils/game/CombatCalculations";
export type { PooledTile } from "./utils/pools/TilePool";
export { EventStore, GameEventType } from "./systems/shared/EventStore";
export type {
  GameStateInfo,
  EntitySnapshot,
  CombatSnapshot,
} from "./systems/shared/EventStore";
export {
  RANGED_STYLE_BONUSES,
  MAGIC_STYLE_BONUSES,
} from "./constants/CombatConstants";
export type {
  RangedCombatStyle,
  MagicCombatStyle,
  MeleeAttackStyle,
} from "./constants/CombatConstants";
export {
  getCombatTimeoutTicks,
  getDefaultMagicRange,
  getHitDelayConfig,
  getSpellLaunchDelayMs,
  getArrowLaunchDelayMs,
  getDefaultNpcAttackSpeedTicks,
  getDefaultRangedRange,
  getDamageBaseConstant,
  getEffectiveLevelConstant,
  getDamageDivisor,
  getTickDurationMs,
} from "./data/live/combat-live";
export { RUNE_NAMES, VALID_RUNES } from "./data/runes";
export { runesRegistry } from "./runes/index";
export { ARROW_DATA, BOW_TIERS } from "./data/ammunition";
export type { ArrowData } from "./data/ammunition";
export {
  getAnimationConfig,
  getDefaultAttackSpeedTicks,
  getAfkDisableRetaliateTicks,
} from "./data/live/combat-live";
export { WEAPON_DEFAULT_ATTACK_STYLE } from "./constants/CombatConstants";
export { isAttackOnCooldownTicks } from "./utils/game/CombatCalculations";
// PlayerSystem migrated to @hyperforge/hyperscape (2026-04-26, Wave 5d).
// PrayerSystem migrated to @hyperforge/hyperscape (2026-04-25)
// `Player` type already exported from the shared types block above
// (line ~157) — no duplicate export needed here.
// LootSystem migrated to @hyperforge/hyperscape (2026-04-25).
// StoreSystem migrated to @hyperforge/hyperscape (2026-04-25)
// SkillsSystem migrated to @hyperforge/hyperscape (2026-04-26,
// Wave 5a). Deps needed by the migrated class.
export { StatsComponent } from "./components/StatsComponent";
export {
  getStatsComponent,
  requireStatsComponent,
} from "./utils/game/ComponentUtils";
export type { SkillMilestone, XPDrop } from "./types/systems/system-interfaces";
export {
  getCombatXpPerDamage,
  getControlledXpPerDamage,
  getHitpointsXpPerDamage,
} from "./data/live/combat-live";

// PlayerDeathSystem + helpers (DeathStateManager, SafeAreaDeathHandler,
// WildernessDeathHandler) migrated to @hyperforge/hyperscape
// (2026-04-26). Deps needed by the migrated cluster.
export {
  getDeathAnimationTicks,
  getDeathCooldownTicks,
  getDeathReconnectRespawnDelayTicks,
  getDeathStaleLockAgeTicks,
  getDefaultRespawnPosition,
  getDefaultRespawnTown,
  getGravestoneTicks,
} from "./data/live/combat-live";
export type { DeathLocationData } from "./types/core/core";
// `DeathLock` already exported earlier in this file.
export type { TransactionContext } from "./types/death";
// InventorySystem migrated to @hyperforge/hyperscape (2026-04-26, Wave 5c).
// In-shared consumers use the duck-typed surface (see CombatSystem,
// AttackContext, WorldDropConditionEvaluators, WorldDialogueConditionEvaluators).
export type { InventoryItemAddedPayload } from "./types/events";
export type { InventoryData } from "./types/systems/system-interfaces";
export type { PlayerInventory } from "./types/core/core";

// PlayerSystem + EatDelayManager + BuryDelayManager migrated to
// @hyperforge/hyperscape (2026-04-26, Wave 5d). Deps needed by the
// migrated cluster (most already exported elsewhere; add the gaps).
export type {
  AttackStyle,
  PlayerAttackStyleState,
  PlayerSpawnData,
} from "./types/core/core";
export type { CombatStyleExtended } from "./types/game/combat-types";
export type {
  HealthUpdateEvent,
  PlayerEnterEvent,
  PlayerLeaveEvent,
  PlayerLevelUpEvent,
} from "./types/events";
export { PlayerIdMapper } from "./utils/PlayerIdMapper";
export {
  getEatAttackDelayTicks,
  getEatDelayTicks,
  getLogoutPreventionTicks,
  getMaxHealAmount,
  getMovementSlerpSpeed,
} from "./data/live/combat-live";
export type { IEntityOccupancy } from "./systems/shared/movement/EntityOccupancyMap";
export { getEntityPosition } from "./utils/game/EntityPositionUtils";
export { resolveStarterTownArea } from "./world-areas";
export type {
  PlayerSystemLike,
  DatabaseSystemLike,
  EquipmentSystemLike,
  TerrainSystemLike,
  NetworkLike,
  TickSystemLike,
  PlayerEntityLike,
  DeathLocationDataWithHeadstone,
} from "./systems/shared/combat/DeathTypes";
export {
  sanitizeKilledBy,
  ITEMS_KEPT_ON_DEATH,
  GRAVESTONE_ID_PREFIX,
  splitItemsForSafeDeath,
  validatePosition as validateDeathPosition,
  isPositionInBounds,
} from "./systems/shared/combat/DeathUtils";
export type { HeadstoneEntityConfig } from "./types/entities";

// GroundItemSystem + ZoneDetectionSystem migrated to
// @hyperforge/hyperscape (2026-04-25). Deps needed by the migrated
// classes (most already exported elsewhere in this barrel; add any
// missing here).
export type {
  GroundItemOptions,
  GroundItemData,
  GroundItemPileData,
  GroundItemSystemDuck,
  ZoneDetectionSystemDuck,
} from "./types/death/death-types";
export { getZoneByPosition } from "./data/world-structure";
export type { ZoneData } from "./data/world-structure";
export type { WildernessBoundary } from "./types/world/world-types";
export { ZoneType } from "./types/death/death-types";
export type { ZoneProperties } from "./types/death/death-types";
export type { ItemEntityConfig } from "./types/entities";
export { msToTicks } from "./utils/game/CombatCalculations";
export { getUntradeableDespawnTicks } from "./data/live/combat-live";
// ResourceSystem migrated to @hyperforge/hyperscape (2026-04-25)
// QuestSystem migrated to @hyperforge/hyperscape (2026-04-25)

// xp-curves runtime registry — shared module-level singleton.
// Populated at boot by DataManager and live-mutated by PIEEditorSession.
// Client HUD and server SkillsSystem both resolve xp-to-level through
// this same instance so editor saves take effect everywhere without
// restart.
export {
  xpCurveRegistry,
  XPCurveRegistry,
  UnknownXpCurveError,
  InvalidXpLevelError,
  type XpToNextResult,
} from "./progression/index";

// skill-icons runtime registry — same shape as xpCurveRegistry.
// `getEffectiveSkillIcon(key)` is the registry-prefer-fallback helper
// HUD / level-up-popup consumers should use in preference to reading
// `SKILL_ICONS` directly, so PIE hot-reload of skill-icons.json
// propagates without a restart.
export {
  skillIconsRegistry,
  getEffectiveSkillIcon,
  SkillIconsRegistry,
  SkillIconsNotLoadedError,
  UnknownSkillDefinitionError,
} from "./skill-icons/index";

// combat-spells runtime registry — same shape as xpCurveRegistry.
// SpellService reads through this registry; React spellbook panel
// subscribes to `onReloaded` to invalidate memoized spell lists.
export {
  combatSpellsRegistry,
  CombatSpellsRegistry,
  CombatSpellsNotLoadedError,
  UnknownCombatSpellError,
  type CombatSpellTier,
  type CombatSpellsReloadListener,
} from "./combat-spells/index";
export {
  FOOTPRINT_SIZES,
  resolveFootprint,
} from "./types/game/resource-processing-types";
export type {
  ResourceFootprint,
  FootprintDimensions,
  FootprintSpec,
} from "./types/game/resource-processing-types";
// Resource + Fire migrated to @hyperforge/hyperscape-plugin/types/
// resource-game-types 2026-04-27 (top-10 #8, slice 30).

// Export client network utilities
export { PendingActionTracker } from "./systems/client/network/PendingActionTracker";

// Export node client components
export { ServerLoader } from "./systems/server/ServerLoader";
export { NodeClient } from "./systems/client/NodeClient";
export { Node } from "./nodes/Node";
// Re-export commonly used node classes to satisfy API extractor
export { UI } from "./nodes/UI";
export { UIView } from "./nodes/UIView";
export { UIText } from "./nodes/UIText";
export { Group } from "./nodes/Group";
export { Mesh } from "./nodes/Mesh";
export { Avatar } from "./nodes/Avatar";
export { storage } from "./platform/shared/storage";
export {
  loadPhysX,
  waitForPhysX,
  getPhysX,
  isPhysXReady,
} from "./physics/PhysXManager";

// Export renderer utilities (WebGPU only - no WebGL fallback)
export {
  createRenderer,
  configureRenderer,
  configureShadowMaps,
  type WebGPURenderer,
  type RendererOptions,
} from "./utils/rendering/RendererFactory";

export {
  createPostProcessing,
  type PostProcessingComposer,
} from "./utils/rendering/PostProcessingFactory";

// Material and mesh optimizations
export {
  optimizeMaterialForWebGPU,
  createOptimizedInstancedMesh,
  getWebGPUCapabilities,
  logWebGPUInfo,
} from "./utils/rendering/RendererFactory";

export {
  isNumber,
  isBoolean,
  isString,
  isObject,
  isArray,
  isValidColor,
  isValidUrl,
  validatePosition,
  calculateDistance,
  calculateDistance2D,
} from "./utils/ValidationUtils";

// Combat validation utilities
export {
  validateEntityId,
  validateUUID,
  validateAttackType,
  validateCombatRequest,
  validateAttackStyleRequest,
  sanitizeDisplayName,
  type CombatRequestValidation,
  type AttackStyleValidation,
} from "./utils/game/CombatValidation";

export { isTouch, cls, hashFile } from "./platform/client/utils-client";
export { ReactiveVector3 } from "./extras/animation/ReactiveVector3";
export { createEmoteFactory } from "./extras/three/createEmoteFactory";
export { createNode } from "./extras/three/createNode";
export { glbToNodes } from "./extras/three/glbToNodes";

// TSL node type aliases — re-exported for migrated visual systems
// (HealthBars + future TSL-shaded systems in @hyperforge/hyperscape).
export type {
  ShaderNode,
  TSLNodeFloat,
  TSLNodeVec2,
  TSLNodeVec3,
  TSLNodeVec4,
} from "./extras/three/three";

// HealthBar canvas renderer + dimension constants — used by the
// migrated HealthBars system in @hyperforge/hyperscape.
export {
  HEALTH_BAR_COLORS,
  HEALTH_BAR_DIMENSIONS,
  type HealthBarStyle,
  type HealthBarCanvasOptions,
  drawHealthBar,
  clearHealthBar,
  createHealthBarCanvas,
  updateHealthBarCanvas,
} from "./utils/rendering/HealthBarRenderer";

// Chat system class + zone-detection class + WorldArea types — used
// by the migrated ZoneVisualsSystem in @hyperforge/hyperscape.
export { Chat as ChatSystem } from "./systems/shared/presentation/Chat";
// ZoneDetectionSystem migrated to @hyperforge/hyperscape (2026-04-25).
// Use the duck-typed `ZoneDetectionSystemDuck` from death-types.
export type { WorldArea } from "./types/world/world-types";
export { getEffectiveWorldAreas } from "./world-areas";

// Equipment-slot ordering tuple — referenced by the migrated
// EquipmentVisualSystem in @hyperforge/hyperscape (and any other
// consumer that needs the canonical classic MMORPG slot iteration order).
export { EQUIPMENT_SLOT_NAMES } from "./constants/EquipmentConstants";

// Player-id coercion helper + DatabaseSystem interface — needed by
// the migrated CoinPouchSystem in @hyperforge/hyperscape.
export { toPlayerID } from "./utils/IdentifierUtils";
export type { DatabaseSystem } from "./types/systems/system-interfaces";

// Prayer-event-payload type guards + level/points clampers — needed
// by the migrated PrayerSystem in @hyperforge/hyperscape.
export {
  clampPrayerLevel,
  clampPrayerPoints,
  isAltarPrayPayload,
  isPlayerCleanupPayload,
  isPlayerRegisteredPayload,
  isPrayerToggleEventPayload,
  isValidRestoreAmount,
} from "./types/game/prayer-types";
export type { PlayerJoinedPayload } from "./types/events/event-payloads";

// BankData — needed by the migrated BankingSystem in
// @hyperforge/hyperscape.
export type { BankData } from "./types/game/inventory-types";

// Store catalog data + storesRegistry singleton — needed by the
// migrated StoreSystem in @hyperforge/hyperscape.
export type { Store } from "./types/game/item-types";
export { GENERAL_STORES } from "./data/banks-stores";
export { storesRegistry } from "./stores";

// DialogueSystem deps — needed by the migrated DialogueSystem in
// @hyperforge/hyperscape.
export { DialogueRegistry } from "./dialogue/DialogueRegistry";
export type {
  DialogueContext,
  DialoguePresentation,
} from "./dialogue/DialogueRunner";
export { LocalizationCatalog } from "./localization/LocalizationCatalog";
export { getNPCById } from "./data/npcs";
export type {
  NPCDialogueTree,
  NPCDialogueNode,
} from "./types/entities/npc-mob-types";

// StationSpawnerSystem deps — needed by the migrated
// StationSpawnerSystem in @hyperforge/hyperscape.
export { stationDataProvider } from "./data/StationDataProvider";

// MobNPCSpawnerSystem deps — needed by the migrated
// MobNPCSpawnerSystem in @hyperforge/hyperscape.
export { ALL_NPCS } from "./data/npcs";
export type { WorldJsonMobSpawn } from "./data/world-structure";
export type {
  LevelRange,
  NPCData,
  MobSpawnStats,
} from "./types/entities/npc-mob-types";
export type { EntitySpawnedEvent } from "./types/systems/system-interfaces";
export { InteractionType } from "./types/entities/entities";

// MobNPCSystem deps — needed by the migrated MobNPCSystem in
// @hyperforge/hyperscape (Wave 3a).
export { EntityManager } from "./systems/shared/entities/EntityManager";
export { NPC_SPAWN_CONSTANTS } from "./data/npcs";
export type {
  MobInstance,
  MobSpawnConfig,
} from "./types/entities/npc-mob-types";

// NPCSystem deps — needed by the migrated NPCSystem in
// @hyperforge/hyperscape.
export type { NPCLocation } from "./data/world-areas";
export { worldAreasRegistry } from "./world-areas";
export { SHOP_ITEMS } from "./data/items";
// World dialogue condition evaluators (used by plugin's
// DialogueSystem to install authored predicates at runtime).
export {
  buildDialoguePredicate,
  installWorldDialogueConditions,
  createManagedDialogueConditionInstall,
  type DialogueConditionArgs,
  type DialogueConditionBinding,
  type ManagedDialogueConditionInstall,
} from "./systems/shared/interaction/WorldDialogueConditionEvaluators";
export {
  getEntitiesSystem,
  getSystem,
  getSystem as getSystemUtil,
} from "./utils/SystemUtils";
export { clamp } from "./utils/MathUtils";
export { vector3ToPxVec3 } from "./utils/physics/PhysicsUtils";
export { ANIMATION_LOD_ALWAYS_UPDATE } from "./utils/rendering/AnimationLOD";
export { MeshStandardNodeMaterial } from "./extras/three/three";
export type {
  PlayerEntityData,
  PlayerEntityProperties,
} from "./types/entities/entities";
export type {
  EquipmentComponent,
  PrayerComponent,
} from "./types/entities/entity-types";
export type { Vector3Like, QuaternionLike } from "./types/systems/physics";
export type {
  BankTransaction,
  PlayerBankStorage,
  StoreTransaction,
  Town,
} from "./types/core/core";
export type { NPCSystemInfo } from "./types/systems/system-interfaces";
export { groundToTerrain } from "./utils/game/EntityUtils";

// ProcessingSystem deps — needed by the migrated ProcessingSystem
// in @hyperforge/hyperscape.
export { ITEM_IDS } from "./constants/GameConstants";
// ProcessingAction migrated to @hyperforge/hyperscape-plugin/types/
// resource-game-types 2026-04-27 (top-10 #8, slice 30).
// (calculateDistance2D already exported above)
// getTargetValidator / TargetValidator migrated to
// @hyperforge/hyperscape (2026-04-26).
export { modelCache } from "./utils/rendering/ModelCache";
export { ParticleSystem } from "./systems/shared/presentation/ParticleSystem";

// AggroSystem deps — needed by the migrated AggroSystem in
// @hyperforge/hyperscape.
export type {
  AggroTarget,
  MobAIStateData,
} from "./types/entities/npc-mob-types";
export {
  getDefaultNpcAggroRange,
  getDefaultNpcLeashRange,
} from "./data/live/combat-live";
export {
  calculateCombatLevel,
  normalizeCombatSkills,
  shouldMobIgnorePlayer,
} from "./utils/game/CombatLevelCalculator";

// BridgeSystem deps — needed by the migrated BridgeSystem in
// @hyperforge/hyperscape. Static bridge data drives procedural
// deck/fence geometry. (`BridgeStyle` is already re-exported via
// the procgen barrel block below — same string-union shape, kept
// authoritative there to avoid duplicate-identifier errors.)
export {
  ISLAND_BRIDGES,
  type BridgeDefinition,
} from "./systems/shared/world/BridgeDefinition";

// ProceduralGrassSystem deps — needed by the migrated
// ProceduralGrass in @hyperforge/hyperscape. RoadInfluenceMask
// helpers + grass material core + exclusion grid + character
// influence manager.
export {
  clearRoadInfluenceTexture,
  getRoadInfluenceTexture,
  getRoadInfluenceTextureState,
  getRoadInfluenceThreshold,
  setRoadInfluenceTextureData,
  setRoadInfluenceThreshold,
  type RoadInfluenceTextureState,
} from "./systems/shared/world/RoadInfluenceMask";
export {
  createGrassLod0Geometry,
  createGrassLod0Material,
  type GrassExclusionOptions,
} from "./systems/shared/world/GrassMaterialCore";
export {
  GrassExclusionGrid,
  getGrassExclusionGrid,
  disposeGrassExclusionGrid,
} from "./systems/shared/world/GrassExclusionGrid";
export {
  CharacterInfluenceManager,
  getCharacterInfluenceManager,
  disposeCharacterInfluenceManager,
} from "./systems/shared/world/CharacterInfluenceManager";

// TownSystem deps — needed by the migrated TownSystem in
// @hyperforge/hyperscape (Wave 2 of heavy-cluster plan). Most of
// these are types from world-types + building-collision-types
// that the migrated class threads through its public API.
export type {
  TownSize,
  TownBuildingType,
  ManifestTown,
  ManifestTownSize,
  TownEntryPoint,
  TownInternalRoad,
  TownPath,
  TownLandmark,
  TownPlaza,
} from "./types/world/world-types";
// BuildingLayoutInput, cellToWorldTile, tileKey already exported
// further down (building-collision-types section). BUILDING_NPC_TYPES,
// extractBuildingNPC, BuildingNPCSpawn already exported from
// world-generation utilities section. tileKey already exported from
// utils/compute (tile movement system).
export type {
  FlatZone,
  FlatZoneTile,
  FlatZoneTileBounds,
} from "./types/world/terrain";

// ResourceSystem deps — needed by the migrated ResourceSystem in
// @hyperforge/hyperscape (Wave 1 of heavy-cluster plan).
// ResourceEntity migrated to @hyperforge/hyperscape (2026-04-26).
export { disposeFishingSpotTextures } from "./entities/world/visuals/FishingSpotVisualStrategy";
// Visual strategy API used by ResourceEntity (now in plugin).
// Strategies stay in shared because createClientWorld + the GLB
// instancer warmup paths also use them.
export { createVisualStrategy } from "./entities/world/visuals/createVisualStrategy";
export type {
  ResourceVisualStrategy,
  ResourceVisualContext,
} from "./entities/world/visuals/ResourceVisualStrategy";
export type { TerrainResourceSpawnPoint } from "./types/world/terrain";
export { gatheringResources } from "./gathering/index";
export type { GatheringToolData } from "./data/DataManager";
export { findFishingSpotTiles, shuffleArray } from "./utils/ShoreUtils";
// ResourceDrop migrated to @hyperforge/hyperscape-plugin/types/
// resource-game-types 2026-04-27 (top-10 #8, slice 30).
export {
  getExternalTool,
  getExternalToolsForSkill,
} from "./utils/ExternalAssetUtils";
export {
  getDefaultInteractionRange,
  getDefaultSuccessRate,
  getFishingSpotMove,
  getFishingSuccessRates,
  getGatheringRange,
  getGatheringRateLimitMs,
  getGatheringSkillMechanics,
  getMaxResourceIdLength,
  getMinimumCycleTicks,
  getMiningSuccessRates,
  getPositionEpsilon,
  getProximitySearchRadius,
  getRateLimitCleanupIntervalMs,
  getStaleRateLimitMs,
  getTimerRegenPerTick,
  getTreeDespawnTicks,
  getValidResourceIdPattern,
  getWoodcuttingSuccessRates,
} from "./data/live/gathering-live";

// ProceduralGrass deferred-import deps — the migrated
// ProceduralGrass system dynamically imports these via
// `await import(...)`. Re-exported here so the plugin can resolve
// them via `@hyperforge/shared`.
export { getGrassExclusionManager } from "./systems/shared/world/GrassExclusionManager";
export { ProcgenTreeInstancer } from "./systems/shared/world/ProcgenTreeInstancer";
export { ProcgenRockInstancer } from "./systems/shared/world/ProcgenRockInstancer";

// NPCTickProcessor + SpatialAggroStrategy deps — needed by the
// migrated NPC tick utilities in @hyperforge/hyperscape.
export type {
  IAggroStrategy,
  IPathStrategy,
  ICombatStrategy,
  ProcessableNPC,
  NPCTarget,
} from "./types/systems/npc-strategies";
export { SpatialEntityRegistry } from "./systems/shared/entities/SpatialEntityRegistry";

// GrassSharedRegistry — mutable shader state owned by shared so
// the migrated ProceduralGrass + still-in-shared sibling modules
// share the same texture/uniform registry.
export {
  CHARACTER_TEXTURE_WIDTH,
  characterBendingTextureNode,
  gridExclusionTextureNode,
  setCharacterBendingTexture,
  setGridExclusionTexture,
  setUseGridExclusion,
  setUseMultiCharacterBending,
  uCharacterCount,
  uGridExclusionCenterX,
  uGridExclusionCenterZ,
  uGridExclusionWorldSize,
  useGridBasedExclusion,
  useMultiCharacterBending,
} from "./systems/shared/world/GrassSharedRegistry";

// BuildingRenderingSystem deps — needed by the migrated
// BuildingRenderingSystem in @hyperforge/hyperscape. TerrainShader
// vertex-light helpers + lamppost mask + impostor atlas + physics
// layer enum.
export {
  MAX_VERTEX_LIGHTS,
  type VertexLight,
} from "./systems/shared/world/TerrainShader";
export {
  getLamppostLightTextureState,
  isLamppostLightTextureReady,
} from "./systems/shared/world/LamppostLightMask";
export type { TownBuilding } from "./types/world/world-types";
export { Layers } from "./physics/Layers";
export {
  ImpostorManager,
  BakePriority,
  ImpostorBakeMode,
  DynamicBuildingImpostorAtlas,
  type AtlasBuildingData,
} from "./systems/shared/rendering";

// VegetationSystem deps — needed by the migrated VegetationSystem
// in @hyperforge/hyperscape. Vegetation rendering pulls a wide
// surface of types + utilities from shared (Loader, frustum
// quadtree, GPU materials, LOD config, vegetation worker,
// procgen tree cache, GPU compute).
export type {
  VegetationAsset,
  VegetationCategory,
  VegetationLayer,
  VegetationInstance,
  BiomeVegetationConfig,
} from "./types/world/world-types";
export { LoadPriority } from "./types/core/misc-types";
export { FrustumQuadtree } from "./utils/spatial/FrustumQuadtree";
export {
  generateVegetationPlacementsAsync,
  isVegetationWorkerAvailable,
  type VegetationLayerInput,
} from "./utils/workers/VegetationWorker";
export {
  createGPUVegetationMaterial,
  type GPUVegetationMaterial,
} from "./systems/shared/world/GPUMaterials";
export {
  getLODDistances,
  getLODDistancesScaled,
  applyLODSettings,
  type LODDistancesWithSq,
} from "./systems/shared/world/LODConfig";
export { csmLevels } from "./systems/shared/world/Environment";
export { updateTreeInstances } from "./systems/shared/world/ProcgenTreeCache";
// (`getGlobalCullingManager` already exported via the
// utils/compute block below; only `isGPUComputeAvailable` added.)
export { isGPUComputeAvailable } from "./utils/compute";
export { resolveBiomeOrFallback, biomesRegistry } from "./biomes";
export { npcDefinitionsRegistry } from "./npc-definitions";

// ProceduralTownLandmarksSystem deps — needed by the migrated
// ProceduralTownLandmarks in @hyperforge/hyperscape. TownSystem
// and getGlobalTerrainComputeContext stay in shared so the
// migrated class continues to consume them through the barrel.
// (`applySkyFog` is already exported earlier in this file.)
export type { TownLandmarkType } from "./types/world/world-types";
export {
  clearLamppostLightTexture,
  setLamppostLightTextureData,
} from "./systems/shared/world/LamppostLightMask";

// ProceduralFlowerSystem deps — needed by the migrated
// ProceduralFlowerSystem in @hyperforge/hyperscape. Vegetation /
// TSL helpers live in shared because ProceduralGrass + Vegetation
// systems still consume them directly. (`getNoiseTexture` /
// `generateNoiseTexture` already exported earlier in this file.)
export { tslUtils } from "./utils/TSLUtils";
export { VegetationSsboUtils } from "./systems/shared/world/VegetationSsboUtils";
export { windManager } from "./systems/shared/world/Wind";
// `getGrass*` helpers migrated to @hyperforge/hyperscape (2026-04-25)
// alongside ProceduralGrass. Plugin consumers (ProceduralFlowers)
// import them from the sibling plugin file directly.

// RoadNetworkSystem deps — needed by the migrated
// RoadNetworkSystem in @hyperforge/hyperscape. Procedural road
// generation reads procgen types + worker helpers + GPU compute
// context + road-influence height utilities.
// (`getGlobalTerrainComputeContext` and `GPURoadSegment` are
// already re-exported in the utils/compute block below; not
// duplicated here.)
export type {
  ProceduralRoad,
  ProceduralTown,
  RoadPathPoint,
  RoadTileSegment,
  RoadNetwork,
  RoadEndpointType,
  RoadBoundaryExit,
  TileEdge,
} from "./types/world/world-types";
export { smoothPathAsync, isProcgenWorkerAvailable } from "./utils/workers";
export { getRoadHeightAtPoint, ROAD_BLEND_WIDTH } from "./world/road-influence";

// ScriptingSystem deps — needed by the migrated ScriptingSystem in
// @hyperforge/hyperscape (and by its co-located unit test, which
// also lives in the plugin). Implementation classes
// (ScriptGraphInterpreter, ActionExecutor, ConditionRegistry,
// TriggerEvaluator) stay in shared because PIEScriptRunner +
// PIEEditorSession in `runtime/pie.ts` consume them at PIE-bundle
// time. The plugin's ScriptingSystem ties them into ECS lifecycle.
export {
  ScriptGraphInterpreter,
  type RuntimeScriptGraph,
  type RuntimeScriptNode,
  type RuntimeScriptEdge,
  type RuntimeScriptVariable,
  type RuntimePortDef,
  type ExecutionContext,
  type ScriptingWorldInterface,
  type ActionHandler,
  type ConditionEvaluator,
  type DelayedContinuation,
  type GraphRegistry,
} from "./systems/shared/scripting/ScriptGraphInterpreter";
export {
  TriggerEvaluator,
  DEFAULT_TRIGGER_MAPPINGS,
  type TriggerMapping,
} from "./systems/shared/scripting/TriggerEvaluator";
export { ActionExecutor } from "./systems/shared/scripting/ActionExecutor";
export { ConditionRegistry } from "./systems/shared/scripting/ConditionEvaluator";
export { validateNodeData } from "./systems/shared/scripting/NodeDataSchemas";

// RangeSystem deps — needed by the migrated RangeSystem in
// @hyperforge/hyperscape. NPC tile-occupancy data drives hunt /
// attack / max-range calculations.
export { NPC_SIZES, type NPCSize } from "./data/npc-sizes";
export { npcSizesRegistry } from "./npc-sizes";

// TeleportSystem deps — needed by the migrated TeleportSystem in
// @hyperforge/hyperscape. Schema types come from world-types.
export type {
  TeleportNode,
  TeleportNetworkConfig,
} from "./types/world/world-types";

// POISystem deps — needed by the migrated POISystem in
// @hyperforge/hyperscape. Configuration + biome / noise helpers
// used to procedurally place points of interest.
export type {
  PointOfInterest,
  POICategory,
  POIConfig,
} from "./types/world/world-types";
export { NoiseGenerator } from "./utils/NoiseGenerator";
export {
  type BiomeId,
  DEFAULT_BIOME,
} from "./systems/shared/world/TerrainBiomeTypes";
export { dist2D } from "./utils/MathUtils";

// ProceduralDocks deps — needed by the migrated ProceduralDocks in
// @hyperforge/hyperscape. Static dock data + dual-wall helper used
// to drive procedural deck collision + geometry.
export {
  ISLAND_DOCKS,
  type DockDefinition,
} from "./systems/shared/world/DockDefinition";
export { getOppositeWallFlag } from "./systems/shared/movement/CollisionFlags";

// InventoryInteractionSystem deps — needed by the migrated
// InventoryInteractionSystem in @hyperforge/hyperscape.
export type { DragData, DropTarget } from "./types/game/inventory-types";
export type { ItemAction, ItemContextMenu } from "./types/game/item-types";
export { dataManager } from "./data/DataManager";
export { MESSAGE_TYPES } from "./systems/client/interaction/constants";

// LootSystem deps — needed by the migrated LootSystem in
// @hyperforge/hyperscape (and by its co-located tests, which import
// the dispatcher helpers from the shared barrel).
export {
  defaultDropConditionEvaluator,
  type LootDropContext,
  type LootDropConditionEvaluator,
} from "./types/loot-drops";
export { LootTableRoller } from "./loot/LootTableRoller";
// LootTableService + DropConditionDispatcher + WorldDropConditionEvaluators
// migrated to @hyperforge/hyperscape (2026-04-26). Plugin-side
// LootTableService still consumes the `LootTable` type.
export type { LootTable } from "./types/game/inventory-types";
export {
  getGroundItemDespawnTicks,
  getLootProtectionTicks,
} from "./data/live/combat-live";
export { ticksToMs } from "./utils/game/CombatCalculations";

// ItemTargetingSystem deps — needed by the migrated
// ItemTargetingSystem in @hyperforge/hyperscape. Protocol types
// only; the system itself is exported by the plugin.
export type { TargetType, SourceItem } from "./types/item-targeting";

// quest-types migrated to @hyperforge/hyperscape-plugin/types/quest-types
// 2026-04-27 (top-10 #8 cleanup). QuestDefinition, QuestStatus,
// QuestDbStatus, QuestStage, StageProgress, QuestProgress,
// PlayerQuestState, QuestManifest, validateQuestDefinition are now
// plugin-side.
export type { NPCDiedPayload } from "./types/events/event-payloads";
export { validateKillToken } from "./utils/game/KillTokenUtils";
export { Emotes } from "./data/playerEmotes";
export {
  DUEL_RULE_DEFINITIONS,
  DUEL_RULE_LABELS,
  EQUIPMENT_SLOT_DEFINITIONS,
  EQUIPMENT_SLOT_LABELS,
  EQUIPMENT_SLOTS_ORDERED,
  VALID_DUEL_RULE_KEYS,
  DUEL_EQUIPMENT_SLOT_KEYS,
  isValidDuelRuleKey,
  isValidEquipmentSlot,
  getIncompatibleRules,
  areRulesCompatible,
  getDuelArenaConfig,
  isPositionInsideDuelArenaZone,
  isPositionInsideCombatArena,
  type DuelRuleDefinition,
  type EquipmentSlotDefinition,
  type DuelEquipmentSlot,
  type DuelArenaConfig,
} from "./data/duel-manifest";
export { ControlPriorities } from "./systems/client/ControlPriorities";
export { downloadFile } from "./utils/downloadFile";
export * from "./utils/typeGuards";

// Item type detection helpers (tile-based-MMORPG-accurate inventory actions)
export {
  isFood,
  isPotion,
  isBone,
  isWeapon,
  isShield,
  usesWield,
  usesWear,
  isNotedItem,
  getPrimaryAction,
  getPrimaryActionFromManifest,
  HANDLED_INVENTORY_ACTIONS,
} from "./utils/item-helpers";
export type { PrimaryActionType } from "./utils/item-helpers";

export { Curve } from "./extras/animation/Curve";
export { buttons, propToLabel } from "./extras/ui/buttons";
// GLTFLoader export disabled due to TypeScript declaration generation issues
// Users can import it directly: import { GLTFLoader } from './libs/gltfloader/GLTFLoader';

// NOTE: CSM (WebGL) removed - use CSMShadowNode from three/addons/csm/CSMShadowNode.js for WebGPU

// PhysX asset path helper function
export function getPhysXAssetPath(assetName: string): string {
  // In the browser, serve assets from CDN /web/ directory
  if (typeof window !== "undefined") {
    return `/web/${assetName}`;
  }
  // In Node.js, compute path relative to this module using URL without importing node:path
  try {
    const here = new URL(import.meta.url);
    const vendorUrl = new URL(`../vendor/${assetName}`, here);
    // pathname is fine for local filesystem access in Node
    return vendorUrl.pathname;
  } catch {
    return assetName;
  }
}

// Export THREE namespace as a default-only module export
export { default as THREE } from "./extras/three/three";

// Export Vector3 compatibility utilities for plugin use
export {
  toTHREEVector3,
  assignVector3,
  cloneVector3,
  createVector3,
  toVector3Object,
  isVector3Like,
} from "./extras/animation/vector3-compatibility";

// Export PhysX types
export type {
  PxVec3,
  PxTransform,
  PxQuat,
  PxSphereGeometry,
  PxCapsuleGeometry,
} from "./types/systems/physics";
export type {
  PxScene,
  PxFoundation,
  PxTolerancesScale,
  PxCookingParams,
  PxPhysics,
  PxMaterial,
  PxRaycastResult,
  PxSweepResult,
  PxOverlapResult,
  PxControllerManager,
  PxControllerFilters,
  PxActor,
  PxRigidDynamic,
  PxRigidStatic,
  PxRigidBody,
  PxShape,
  PxGeometry,
  PxDefaultAllocator,
  PxDefaultErrorCallback,
  PxQueryFilterData,
} from "./types/systems/physics";

// Re-export types referenced by API Extractor warnings
export type { PhysXInfo, PhysXModule } from "./types/systems/physics";
export type {
  InterpolatedPhysicsHandle,
  NonInterpolatedPhysicsHandle,
} from "./types/systems/physics";
// Re-export specific core types referenced by entity declarations.
// `Player` from this path is the *record* interface (alive/skills/
// combat/death) — used by PlayerSystem in @hyperforge/hyperscape.
// Exported as `PlayerCore` here since the plain `Player` export
// above resolves to the entity-class alias (back-compat).
export type {
  PlayerDeathData,
  Player as PlayerCore,
  PlayerHealth,
  PlayerStamina,
  PlayerPosition,
  PlayerStats,
  Skills,
  PlayerEquipmentItems,
  PlayerCombatData,
  SystemConfig,
  SkillData,
  MovementComponent,
  InventoryItem,
  InventorySlotItem,
  Item,
  Inventory,
  PlayerEquipment,
  CombatStyle,
  CombatBonuses,
  EquipmentSlot,
} from "./types/core/core";
// ItemRarity is an enum — needs value export.
export { ItemRarity } from "./types/entities/entities";

// ItemSpawnerSystem stats type — needed by the migrated
// ItemSpawnerSystem in @hyperforge/hyperscape.
export type { ItemSpawnerStats } from "./types/entities";
export type { Physics as PhysicsInterface } from "./types/index";
// Re-export UI-related types used by UIView/UIText/UI
export type {
  UIData,
  UIViewData,
  DisplayType,
  EdgeValue,
  FlexBasis,
  UIContext,
  UISceneItem,
  UIYogaNode,
} from "./types/rendering/nodes";
export type { NodeData, Position3D } from "./types/index";
// Re-export extras used by PlayerRemote and others
export { LerpVector3 } from "./extras/animation/LerpVector3";
export { LerpQuaternion } from "./extras/animation/LerpQuaternion";
// Re-export core utility types referenced by declarations
export type { RaycastHit, NetworkData } from "./types/index";
// Re-export entity configuration types
export type { EntityConfig, EntityInteractionData } from "./types/entities";
// Re-export GLB typing used by createEmoteFactory
export type { GLBData } from "./types/index";
// Re-export storage types
export type { Storage } from "./platform/shared/storage";
export { LocalStorage } from "./platform/shared/storage";
// Export server-side NodeStorage for Node/Bun runtimes
export { NodeStorage } from "./platform/server/storage.server";
// Export file-based Storage class (for server use)
// export { Storage as FileStorage } from './systems/Storage'; // Disabled: file doesn't exist

// Re-export nodes namespace for createNode typings
export * as Nodes from "./nodes";

// Export additional UI/node types used by various node declarations
export type {
  UITextData,
  TextAlign,
  FontWeight,
  UIImageData,
  UIPointerEvent,
  UIWheelEvent,
  RigidBodyData,
  MeshData,
  SkinnedMeshData,
  SkyData,
  ActionData,
  DistanceModelType,
  LODItem,
  LODNode,
  LODData,
  AvatarData,
  VRMAvatarFactory,
  AvatarHooks,
  VRMAvatarInstance,
  ControllerData,
  ColliderData,
  JointData,
  ParticlesData,
  PhysicsTriggerEvent,
  PhysicsContactEvent,
  JointLimits,
  JointDrive,
  PhysXActor,
  PhysXController,
  PhysXJoint,
  PxJointLimitCone,
  PxConstraintFlag,
  PxJointAngularLimitPair,
  PxRigidBodyFlag,
  PhysXMoveFlags,
  AudioData,
  ImageData,
} from "./types/rendering/nodes";

export type {
  ActorHandle,
  PxControllerCollisionFlags,
  PxRigidBodyFlagEnum,
} from "./types/systems/physics";
export type { PhysXShape, PhysXMesh } from "./systems/shared";

// Export Node internal types
export type { NodeProxy, NodeStats } from "./nodes/Node";

// Export LooseOctree internal types
export type {
  LooseOctreeNode,
  OctreeHelper,
  LooseOctreeOptions,
} from "./utils/physics/LooseOctree";

// Export additional system and event types
export type { SystemConstructor, SystemDependencies } from "./systems/shared";
export type {
  EventSubscription,
  SystemEvent,
  EventHandler,
} from "./systems/shared";
export type { EventMap } from "./types/events";
export type {
  AnyEvent,
  EventType as EventTypeEnum,
  EventPayloads,
} from "./types/events";
export type { LoaderResult } from "./types/index";
export type { ComponentDefinition, EntityData } from "./types/index";
export type { Entities as EntitiesInterface } from "./types/index";
export { SystemLogger } from "./utils/Logger";

// Export network/system interface types
export type {
  NetworkSystem,
  EquipmentSystem,
} from "./types/systems/system-interfaces";
export type { IEventsInterface } from "./systems/shared";

// Export Client Interface types
export type {
  ClientUIState,
  PrefsKey,
  PrefsValue,
  ClientPrefsData,
} from "./systems/client/ClientInterface";
export type { ChatListener } from "./systems/shared";
export type { UIProxy } from "./types/rendering/nodes";

// Export Panel utility
export { default as Panel } from "./libs/stats-gl/panel";

// Export ClientActions internal handler type
export type { ClientActionHandler } from "./systems/client/ClientActions";

// Export alternate HotReloadable and RaycastHit for nodes/UI references
// Export MinimalHotReloadable from physics (renamed to avoid conflict)
export type { MinimalHotReloadable } from "./types/systems/physics";

// Export environment and stage types
export type {
  BaseEnvironment,
  EnvironmentModel,
  SkyHandle,
  SkyInfo,
  SkyNode,
} from "./types/index";
export { LooseOctree } from "./utils/physics/LooseOctree";
export { quaternionPool } from "./utils/pools/QuaternionPool";
export type { PooledQuaternion } from "./utils/pools/QuaternionPool";
export { tilePool } from "./utils/pools/TilePool";
export { bfsPool } from "./systems/shared/movement/ObjectPools";
export type {
  MaterialWrapper,
  InsertOptions,
  StageHandle,
  MaterialOptions,
} from "./systems/shared";
export type {
  OctreeItem,
  ExtendedIntersection,
  RenderHelperItem,
  GeometryPhysXMesh,
} from "./types/systems/physics";
export type {
  ParticleEmitter,
  EmitterNode,
  ParticleMessage,
  ParticleMessageData,
} from "./types/rendering/particles";

// Export client audio types
export type { AudioGroupGains } from "./types/index";

// Export control types
export type {
  ControlBinding,
  ControlsBinding,
  ControlAction,
  TouchInfo,
  ControlEntry,
  ButtonEntry,
  MouseInput,
  ValueEntry,
  VectorEntry,
  ScreenEntry,
  PointerEntry,
  InputState,
} from "./types/index";

// Export entity and interaction types
export type { BaseEntityProperties } from "./types/entities";
// InteractionType already exported as a value above (enum re-export).
// EntityType is an enum (value), not just a type — needs `export {}`.
export { EntityType } from "./types/entities/entities";

// Export event payloads namespace
export * as Payloads from "./types/events";
// Export specific event payload types for convenience
export type {
  SkillsLevelUpEvent,
  EquipmentSyncData,
  InventorySyncData,
  FletchingInterfaceOpenPayload,
} from "./types/events";

// Export additional core types
export type { SkillsData } from "./types/systems/system-interfaces";
export type {
  HealthComponent,
  VisualComponent,
  EntityCombatComponent,
  PlayerCombatStyle,
} from "./types/entities";
export type { GroupType } from "./types/rendering/nodes";
export type {
  InventoryItemInfo,
  ActionBarSlotContent,
  ActionBarSlotUpdatePayload,
  ActionBarSlotSwapPayload,
} from "./types/events";

// Export database/event types
export type {
  InventoryCanAddEvent,
  InventoryRemoveCoinsEvent,
  InventoryCheckEvent,
  InventoryHasEquippedEvent,
  BankDepositEvent,
  BankWithdrawEvent,
  BankDepositSuccessEvent,
  UIMessageEvent,
  StoreOpenEvent,
  StoreCloseEvent,
  StoreBuyEvent,
  StoreSellEvent,
} from "./types/events";

// Export settings data
export type { SettingsData } from "./types/index";

// Export SystemDatabase and TypedKnexDatabase to fix API Extractor warnings
export type {
  SystemDatabase,
  TypedKnexDatabase,
  ConfigRow,
  UserRow,
  EntityRow,
  DatabaseRow,
  PlayerRow,
  ItemRow,
  InventoryRow,
  EquipmentRow,
  PlayerSessionRow,
  WorldChunkRow,
  InventorySaveItem,
  EquipmentSaveItem,
} from "./types/network/database";

// Export entity types (PlayerEntity class is exported above, so only export other types here)
export type {
  CharacterController,
  CharacterControllerOptions,
  NetworkPacket,
} from "./types/index";

// Export video and model types
export type {
  VideoFactory,
  LoadedModel,
  LoadedEmote,
  LoadedAvatar,
  SnapshotData,
  VideoSource,
  HSNode,
} from "./types/index";

// Export player touch/stick types used by PlayerLocal
export type { PlayerTouch, PlayerStickState } from "./types/systems/physics";
// Export additional physics handle types referenced in declarations
export type {
  PhysicsHandle,
  PhysicsRaycastHit,
  PhysicsOverlapHit,
  BasePhysicsHandle,
  InterpolationData,
  ContactEvent,
  TriggerEvent,
} from "./types/systems/physics";
export type { Collider, RigidBody, PhysicsMaterial } from "./types/index";
export type {
  InternalContactCallback,
  InternalTriggerCallback,
  ExtendedContactEvent,
  ExtendedTriggerEvent,
  OverlapHit,
} from "./systems/shared";
export {
  writePacket,
  readPacket,
  getPacketId,
  getPacketName,
  PACKET_NAMES,
} from "./platform/shared/packets";

// Export physics utilities
export { installThreeJSExtensions } from "./utils/physics/PhysicsUtils";

// Export spawn utilities
export { CircularSpawnArea } from "./utils/physics/CircularSpawnArea";

// Export terrain system
export { TerrainSystem } from "./systems/shared";
// BridgeSystem migrated to @hyperforge/hyperscape (2026-04-25)

// Spell + arrow visual configs — consumed by ProjectileRenderer
// in @hyperforge/hyperscape (migrated 2026-04-24).
export {
  getSpellVisual,
  getArrowVisual,
  type SpellVisualConfig,
  type ArrowVisualConfig,
} from "./data/spell-visuals";

// Export town, POI, and road systems
// TownSystem migrated to @hyperforge/hyperscape (2026-04-25)
// POISystem migrated to @hyperforge/hyperscape (2026-04-25)
// RoadNetworkSystem migrated to @hyperforge/hyperscape (2026-04-25)
export { BuildingCollisionService } from "./systems/shared/world/BuildingCollisionService";

// Building collision types (for navigation systems)
export type {
  WallDirection,
  WallSegment,
  StairTile,
  StepTile,
  FloorCollisionData,
  BuildingCollisionData,
  PlayerBuildingState,
  BuildingCollisionResult,
  BuildingLayoutInput,
  CellCoord,
} from "./types/world/building-collision-types";
export {
  cellToWorldTile,
  rotateWallDirection,
  getOppositeDirection,
  toWallDirection,
  tileKey as buildingTileKey,
} from "./types/world/building-collision-types";

// Export tile movement system (tile-based-MMORPG-style)
export {
  // Constants
  TILE_SIZE,
  TICK_DURATION_MS,
  TILES_PER_TICK_WALK,
  TILES_PER_TICK_RUN,
  MAX_PATH_LENGTH,
  PATHFIND_RADIUS,
  TILE_DIRECTIONS,
  // Utility functions
  worldToTile,
  worldToTileInto,
  tileToWorld,
  tileToWorldInto,
  snapToTileCenter,
  tileManhattanDistance,
  tileChebyshevDistance,
  tilesEqual,
  tilesAdjacent,
  tilesWithinRange,
  tilesWithinMeleeRange,
  tilesCardinallyAdjacent,
  getBestAdjacentTile,
  getBestCombatRangeTile,
  getBestMeleeTile,
  getBestUnoccupiedMeleeTile,
  getBestStepOutTile,
  getAdjacentTiles,
  getResourceAdjacentTiles,
  findBestResourceInteractionTile,
  isAdjacentToResource,
  // Cardinal-only resource interaction (AAA quality)
  getCardinalAdjacentTiles,
  findBestCardinalInteractionTile,
  isCardinallyAdjacentToResource,
  getCardinalFaceDirection,
  getCardinalFaceAngle,
  CARDINAL_FACE_ANGLES,
  isDiagonal,
  tileKey,
  parseTileKey,
  clampTile,
  createTileMovementState,
  // Combat pathfinding: LoS and valid tile generation
  hasLineOfSight,
  getValidRangedTiles,
  getValidMeleeTiles,
} from "./systems/shared/movement/TileSystem";
export type {
  TileCoord,
  TileMovementState,
  TileFlags,
  CardinalDirection,
} from "./systems/shared/movement/TileSystem";
export { BFSPathfinder } from "./systems/shared/movement/BFSPathfinder";
export {
  chaseStep,
  getChasePathfinder,
  ChasePathfinder,
} from "./systems/shared/movement/ChasePathfinding";
export type { WalkabilityChecker } from "./systems/shared/movement/BFSPathfinder";
export {
  getCachedTimestamp,
  updateCachedTimestamp,
} from "./systems/shared/movement/ObjectPools";
export {
  CollisionFlag,
  CollisionMask,
} from "./systems/shared/movement/CollisionFlags";
export {
  CollisionMatrix,
  ZONE_SIZE,
} from "./systems/shared/movement/CollisionMatrix";
export type { ICollisionMatrix } from "./systems/shared/movement/CollisionMatrix";

// ============================================================================
// Interaction System (Store, Bank, Dialogue)
// Single source of truth for session management, validation, and distance
// ============================================================================

// Constants
export {
  SessionType,
  INTERACTION_DISTANCE,
  TRANSACTION_RATE_LIMIT_MS,
  SESSION_CONFIG,
  INPUT_LIMITS,
} from "./constants/interaction";

// Client input constants (click distances, drag thresholds, raycast ranges)
export { INPUT } from "./systems/client/interaction/constants";

// Combat constants (tick-based timing, ranges, etc.)
export { COMBAT_CONSTANTS } from "./constants/CombatConstants";

// Home teleport constants (cooldown, cast time)
export { HOME_TELEPORT_CONSTANTS } from "./constants/GameConstants";

// Distance constants for render culling, LOD, and server simulation
export { DISTANCE_CONSTANTS } from "./constants/GameConstants";

// Terrain constants (water threshold, walkable slopes, etc.)
// Single source of truth for terrain-related values used across all systems
export { TERRAIN_CONSTANTS } from "./constants/GameConstants";

// Inventory constants (slot counts, stack sizes)
export { INVENTORY_CONSTANTS } from "./constants/GameConstants";

// Smithing/inventory item helpers — used by gameplay plugins that
// migrated out of shared/ (e.g. TanningSystem, SmithingSystem,
// RunecraftingSystem in @hyperforge/hyperscape).
export {
  getItemQuantity,
  getSmithingLevelSafe,
  hasSkills,
  isLooseInventoryItem,
} from "./constants/SmithingConstants";

// Smithing live-getters — provider-first reads of boot-captured
// smithing constants. Consumed by SmithingSystem in
// @hyperforge/hyperscape.
export { getHammerItemId } from "./data/live/smithing-live";

// Logger singleton — used by gameplay plugins migrated out of
// shared/ (CraftingSystem, FletchingSystem, etc.).
export { Logger } from "./utils/Logger";
export { AuditLogger } from "./systems/server/network/services/AuditLogger";
// Network-services Logger (different shape: `static warn(category,
// msg, ctx?)` vs the singleton `Logger.warn(msg, ctx?)` from
// `utils/Logger`). Exported under `NetworkLogger` so the
// migrated DuelSystem keeps its existing 3-arg call style without
// shadowing the singleton.
export { Logger as NetworkLogger } from "./systems/server/network/services/Logger";
// RateLimitService — interval-based rate limiter used by the
// network handlers (trade, duel) migrated to @hyperforge/hyperscape.
export {
  RateLimitService,
  IntervalRateLimiter,
} from "./systems/server/network/services/IntervalRateLimiter";
// DuelSystem + TradingSystem duck-type interfaces both migrated to
// @hyperforge/hyperscape-plugin 2026-04-27 (top-10 #8 cleanup).
// Concrete classes + their duck-type contracts now live with the
// implementation. Shared no longer carries either.
// ServerSocket type — needed by migrated ScriptQueue (the queued
// player/NPC action types reference ServerSocket).
export type { ServerSocket } from "./systems/server/network/server-types";
// Debug flag for face-direction logging — read by the migrated
// FaceDirectionManager (Phase D7, 2026-04-26).
export { DEBUG_FACE_DIRECTION } from "./systems/server/network/debug";
// Movement substrate — engine-level anti-cheat + input validation
// + rate limiting used by the migrated TileMovementManager
// (Phase E1, 2026-04-26).
export {
  MovementAntiCheat,
  type AntiCheatKickCallback,
} from "./systems/server/network/movement/MovementAntiCheat";
export {
  MovementInputValidator,
  MovementViolationSeverity,
} from "./systems/server/network/movement/MovementInputValidator";
export {
  getTileMovementRateLimiter,
  getPathfindRateLimiter,
  getChatRateLimiter,
  getFollowRateLimiter,
  getPrayerRateLimiter,
  getQuestListRateLimiter,
  getQuestDetailRateLimiter,
  getQuestAcceptRateLimiter,
  getQuestAbandonRateLimiter,
  getQuestCompleteRateLimiter,
  getCombatRateLimiter,
} from "./systems/server/network/services/SlidingWindowRateLimiter";
// Network handler interfaces — needed by Phase F3 migrated handlers
// (player, prayer, quest, etc.) that look up systems at the world level.
export type {
  IDatabaseSystem,
  IFollowManager,
  IFriendRepository,
  IAgentManager,
  IAgentRuntimeLookup,
} from "./systems/server/network/interfaces";
// Public-URL helpers — needed by character-selection (Phase G-1).
export {
  getDefaultElizaOsApiUrl,
  getDefaultPublicWsUrl,
} from "./systems/server/network/services/PublicUrls";
// Social-live getters — needed by friends handler (F3 batch-8).
export {
  getMaxFriends,
  getMaxIgnore,
  getPrivateMessageMaxLength,
} from "./data/live/social-live";
// Handler-utility substrate — needed by migrated network handlers
// (Phase F3, 2026-04-26).
export {
  validateRequestTimestamp,
  isValidNpcId,
  isValidResponseIndex,
} from "./systems/server/network/services/InputValidation";
export {
  getPlayerId,
  sendToSocket,
  sendErrorToast,
  sendSuccessToast,
  getSessionManager,
  hasActiveInterfaceSession,
  // `getEntityPosition` already re-exported earlier from
  // `utils/game/EntityPositionUtils`. Skip re-exporting from
  // `handlers/common/helpers` to avoid duplicate-export collision.
  type SessionInfo,
  type EntityPosition,
} from "./systems/server/network/handlers/common/helpers";
// Substrate interfaces — needed by plugin-side game managers
// (PendingTrade/Duel/Attack/Cook/Gather, Follow) that resolve
// `world.tileMovement` etc. at construction time.
export type { ITileMovementService } from "./systems/server/network/substrate/tile-movement-service";
export type { ISpatialIndex } from "./systems/server/network/substrate/spatial-index";
export type { IBroadcastService } from "./systems/server/network/substrate/broadcast-service";
export type { IRegionSubscriptionService } from "./systems/server/network/substrate/region-subscription-service";
export type {
  IConnectionRegistry,
  PacketHandler,
} from "./systems/server/network/substrate/connection-registry";
export type {
  ProcessingHandlerContext,
  ProcessingPendingGatherManager,
  ProcessingPendingCookManager,
  ProcessingTileMovementManager,
} from "./systems/server/network/substrate/processing-handler-context";
export type {
  IHomeTeleportManager,
  HomeTeleportFactory,
} from "./systems/server/network/substrate/home-teleport-service";
export type { IFriendsService } from "./systems/server/network/substrate/friends-service";
export type { ICombatAttackService } from "./systems/server/network/substrate/combat-attack-service";
export type { IPlayerSpawnService } from "./systems/server/network/substrate/player-spawn-service";
// Processing handler packet payloads — needed by the migrated
// processing handlers in @hyperforge/hyperscape.
export type {
  ResourceInteractPayload,
  CookingSourceInteractPayload,
  FiremakingRequestPayload,
  CookingRequestPayload,
  SmeltingSourceInteractPayload,
  SmithingSourceInteractPayload,
  ProcessingSmeltingPayload,
  ProcessingSmithingPayload,
  CraftingSourceInteractPayload,
  ProcessingRecipePayload,
  FletchingSourceInteractPayload,
  ProcessingTanningPayload,
  RunecraftingAltarPayload,
} from "./systems/server/network/types";
export {
  InMemorySessionStore,
  type SessionStore,
} from "./infrastructure/session-store";

// Skill enum — referenced by gameplay plugins to identify which
// skill grants XP for a given action. Re-exported from SkillsSystem.
// `Skill` constants extracted from SkillsSystem when SkillsSystem
// migrated to @hyperforge/hyperscape (2026-04-26, Wave 5a).
export { Skill } from "./data/skills/SkillConstants";

// Processing recipe data types — typed shapes returned by
// processingDataProvider.get*Recipe() methods. Consumed by
// CraftingSystem + FletchingSystem in @hyperforge/hyperscape.
export type {
  CraftingRecipeData,
  FletchingRecipeData,
} from "./data/ProcessingDataProvider";

// Processing data provider — manifest-driven processing recipes
// (smithing, smelting, tanning, fletching, runecrafting, cooking, ...).
// Consumed by gameplay plugins migrated out of shared/.
export { processingDataProvider } from "./data/ProcessingDataProvider";

// Live getters — provider-first reads of boot-captured GAME_CONSTANTS fields.
// Prefer these over the frozen `*_CONSTANTS` re-exports above when a consumer
// needs to see PIE-hotreloaded authored data.
export {
  getDefaultHealth,
  getDefaultMaxHealth,
  getHealthRegenRate,
  getHomeTeleportCooldownMs,
  getHomeTeleportCastTimeMs,
  getHomeTeleportCastTimeTicks,
  getMaxInventorySlots,
  getMaxBanditMobsWorld,
  getBanditMobIdsForGlobalCap,
  isBanditMobForGlobalCap,
  getWaterThreshold,
  getWaterEdgeBuffer,
  getMinVisibleWaterDepth,
  getMaxWalkableSlope,
  getSlopeCheckDistance,
  getTileSize,
  getTerrainTileSize,
  getWorldChunkSize,
  getContextMenuItemColor,
  getContextMenuNpcColor,
  getContextMenuObjectColor,
  getContextMenuPlayerColor,
} from "./data/live/game-live";

// Live getters — provider-first reads of boot-captured COMBAT_CONSTANTS fields.
export {
  getHealthRegenCooldownTicks,
  getHealthRegenIntervalTicks,
  getPickupRange,
} from "./data/live/combat-live";

// Live getters — provider-first reads of boot-captured TRADE_CONSTANTS fields.
export {
  getActivityTimeoutMs,
  getMaxTradeSlots,
  getRequestCooldownMs,
  getRequestTimeoutMs,
} from "./data/live/trading-live";

// Live getters — provider-first reads of boot-captured BANKING_CONSTANTS fields.
export {
  getMaxBankSlots,
  getBankSlotsPerTab,
  getMaxBankTabs,
  getDefaultBankTabs,
  getDefaultBankSlots,
} from "./data/live/banking-live";

// Live getters — provider-first reads of boot-captured INPUT_LIMITS fields.
export {
  getMaxItemIdLength,
  getMaxStoreIdLength,
  getMaxQuantity,
  getMaxInventorySlotsInputLimit,
  getMaxRequestAgeMs,
  getMaxClockSkewMs,
  getInteractionDistanceFor,
  getTransactionRateLimitMs,
  getSessionValidationIntervalTicks,
  getSessionGracePeriodTicks,
  getSessionMaxSessionTicks,
} from "./data/live/interaction-live";

// Player constants (health, stamina, speeds)
export { PLAYER_CONSTANTS } from "./constants/GameConstants";

// Gathering constants (tick-based timing, ranges, etc.)
export { GATHERING_CONSTANTS } from "./constants/GatheringConstants";

// Context menu colors (tile-based-MMORPG-accurate styling)
export { CONTEXT_MENU_COLORS } from "./constants/GameConstants";

// Weapon style configuration (tile-based-MMORPG-accurate style restrictions per weapon)
export {
  WEAPON_STYLE_CONFIG,
  getAvailableStyles,
  isStyleValidForWeapon,
  getDefaultStyleForWeapon,
} from "./constants/WeaponStyleConfig";

// Hit delay calculator (tile-based-MMORPG-accurate projectile delays)
export {
  calculateHitDelay,
  calculateMeleeHitDelay,
  calculateRangedHitDelay,
  calculateMagicHitDelay,
  calculateTileDistance,
  calculateEuclideanDistance,
  createProjectile,
  shouldProjectileHit,
  getProjectileProgress,
  getHitDelayExamples,
} from "./utils/game/HitDelayCalculator";
export type {
  HitDelayAttackType,
  ProjectileData,
  HitDelayResult,
} from "./utils/game/HitDelayCalculator";

// Distance utilities (tile-based-MMORPG-style Chebyshev)
export {
  chebyshevDistance,
  isWithinDistance,
  type Position2D,
} from "./utils/distance";

// Types and interfaces
export type {
  InteractionSession,
  ISessionReader,
  ISessionWriter,
  ISessionManager,
  ITransactionValidator,
  IRateLimiter,
  ValidationResult,
  SessionCloseReason,
} from "./types/interaction";

// Context menu styled label type (for combat level colors)
export type { LabelSegment } from "./systems/client/interaction/types";

// Bank equipment type guards, types, and constants
export {
  isValidPlayerEquipmentData,
  isValidPlayerEquipmentStructure,
  MVP_EQUIPMENT_SLOTS,
} from "./types/bank-equipment";
export { VALID_EQUIPMENT_SLOT_KEYS } from "./constants/BankEquipmentConstants";
export type {
  PlayerEquipmentData,
  EquipmentSlotItem,
  BankEquipmentError,
  BankRightPanelMode,
  WithdrawTarget,
  BankWithdrawToEquipmentRequest,
  BankWithdrawToEquipmentResponse,
  BankDepositEquipmentRequest,
  BankDepositEquipmentResponse,
} from "./types/bank-equipment";

// Load testing utilities
export { LoadTestBot, BotPoolManager } from "./testing";
export type {
  LoadTestBehavior,
  LoadTestBotConfig,
  LoadTestBotMetrics,
  BotPoolConfig,
  AggregatedMetrics,
} from "./testing";

// ============================================================================
// Worker utilities for off-main-thread processing
// ============================================================================

// Frame budget manager for reducing main thread jank
export {
  FrameBudgetManager,
  getFrameBudget,
  WorkPriority,
  budgeted,
} from "./utils/FrameBudgetManager";
export type { FrameTimingStats } from "./utils/FrameBudgetManager";

// Physics Worker - Offloads PhysX simulation to web worker
export {
  isPhysicsWorkerAvailable,
  initPhysicsWorker,
  isPhysicsWorkerReady,
  simulateInWorker,
  addActorToWorker,
  removeActorFromWorker,
  setWorkerActorTransform,
  setWorkerActorVelocity,
  destroyPhysicsWorker,
  type PhysicsActorType,
  type SerializedShape,
  type SerializedActor,
  type ActorTransform,
  type ActorVelocity,
  type SerializedContactEvent,
  type SerializedTriggerEvent,
  type PhysicsWorkerInput,
  type PhysicsWorkerOutput,
} from "./utils/workers/PhysicsWorker";

// Minimap Worker - 2D Canvas minimap rendering in web worker
export {
  MinimapWorkerManager,
  isMinimapWorkerSupported,
  createMinimapWorkerWithCanvas,
  createMinimapWorker,
  type MinimapTile,
  type MinimapEntity,
  type MinimapCamera,
  type MinimapConfig,
  type MinimapWorkerInput,
  type MinimapWorkerOutput,
} from "./utils/workers/MinimapWorker";

// WebGPU is REQUIRED - there is no WebGL fallback

// GPU Compute - WebGPU compute shader infrastructure
export {
  // Core compute context
  RuntimeComputeContext,
  isWebGPUAvailable,
  isWebGPURenderer,
  getGlobalComputeContext,
  initializeGlobalComputeContext,
  // Terrain compute (road influence, vertex colors, instance matrices)
  TerrainComputeContext,
  getGlobalTerrainComputeContext,
  initializeGlobalTerrainComputeContext,
  isTerrainComputeAvailable,
  // Networking compute (interest management, spatial queries, aggro)
  NetworkingComputeContext,
  getGlobalNetworkingComputeContext,
  isNetworkingComputeAvailable,
  // GPU culling
  GPUCullingManager,
  shouldUseGPUCulling,
  matricesToFloat32Array,
  getGlobalCullingManager,
  // Shader exports
  TERRAIN_SHADERS,
  ROAD_INFLUENCE_SHADER,
  TERRAIN_VERTEX_COLOR_SHADER,
  INSTANCE_MATRIX_SHADER,
  BATCH_DISTANCE_SHADER,
  NETWORKING_SHADERS,
} from "./utils/compute";
export type {
  ComputePipelineConfig,
  ComputeBufferConfig,
  DispatchConfig,
  GPURoadSegment,
  GPUBiomeData,
  GPUInstanceTRS,
  TerrainComputeConfig,
  GPUEntityInterest,
  GPUPlayerPosition,
  GPUSpatialQuery,
  GPUSpatialCandidate,
  GPUMobData,
  GPUAggroResult,
  GPUAABB,
  GPUOverlapPair,
  GPUSoundSource,
  GPUListener,
  GPUSpawnCandidate,
  GPUOccupiedPosition,
  GPUSpawnResult,
  GPULootDrop,
  GPULootPlayer,
  GPULootResult,
  NetworkingComputeConfig,
  CullingGroupConfig,
  CullingGroup,
  FrustumData,
} from "./utils/compute";

// World generation utilities (pure logic, no ECS dependency)
export {
  type BuildingNPCSpawn,
  type BuildingInfo,
  BUILDING_NPC_TYPES,
  extractBuildingNPC,
  extractTownNPCs,
  type RoadTerrainQuerier,
  type RoadEndpoint,
  type GraphEdge,
  type RoadGenConfig,
  type GeneratedRoad,
  DEFAULT_ROAD_CONFIG,
  buildEdges,
  buildMST,
  selectExtraEdges,
  findPath,
  generateDirectPath,
  smoothPath as smoothRoadPath,
  generateRoads,
  type POITerrainQuerier,
  type POITownRef,
  type POIGenConfig,
  CATEGORY_PROPERTIES as POI_CATEGORY_PROPERTIES,
  DEFAULT_POI_COUNTS,
  generatePOIs,
  generatePOIName,
  findWaterEdge,
  calculatePOIEntryPoint,
  type DockTerrainQuerier,
  type DockTownRef,
  type DockGenConfig,
  type DockCandidate,
  type PlacedDock,
  DEFAULT_DOCK_CONFIG,
  scoreShorelinePosition,
  generateDocks,
  type StoreBuilding,
  type StoreNPCEntry,
  type StoreAssignment,
  type TownSizeCategory,
  BUILDING_STORE_MAP,
  TOWN_SIZE_STORES,
  assignStores,
  buildStoreMap,
  type QuestTerrainQuerier,
  type PlacementRules,
  type PlacementTownRef,
  type QuestNPCToPlace,
  type PlacedQuestNPC,
  placeQuestNPCs,
  extractQuestNPCsToPlace,
  // Phase 9: POI structures
  type POIStructureTemplate,
  type PlacedPOIStructure,
  type PlacedStructureObject,
  type StructurePOIRef,
  type StructureTerrainQuerier,
  DEFAULT_POI_TEMPLATES,
  generatePOIStructures,
  // Phase 9: Patrol routes
  type PatrolTerrainQuerier,
  type PatrolTownRef,
  type PatrolRoadRef,
  type PatrolWaypoint,
  type PatrolRoute,
  type PatrolGenConfig,
  DEFAULT_PATROL_CONFIG,
  generatePatrolRoutes,
  // Phase 9: Bridge generation
  type BridgeTerrainQuerier,
  type BridgeRoadRef,
  type BridgeStyle,
  type DetectedCrossing,
  type GeneratedBridge,
  type BridgeGenConfig,
  DEFAULT_BRIDGE_CONFIG,
  generateBridges,
  isRoadPointOverWater,
  // Phase 9: Road decorations
  type DecorationTerrainQuerier,
  type DecorationRoadRef,
  type DecorationTownRef,
  type PlacedRoadDecoration,
  type RoadDecorationConfig,
  DEFAULT_DECORATION_CONFIG,
  generateRoadDecorations,
  // Phase 9: Wilderness landmarks
  type LandmarkTerrainQuerier,
  type DifficultyQuerier,
  type LandmarkTownRef,
  type LandmarkRoadRef,
  type TierBoundaryDef,
  type BoundaryMarkerType,
  type PlacedWildernessLandmark,
  type WildernessLandmarkConfig,
  DEFAULT_WILDERNESS_CONFIG,
  generateWildernessLandmarks,
  // Phase 9: Vegetation zone response
  type VegetationModifier,
  type VegetationZoneRef,
  type VegetationPOIRef,
  type VegetationZoneConfig,
  type MiningResourceRef,
  DEFAULT_VEG_ZONE_CONFIG,
  generateVegetationModifiers,
  queryVegetationDensity,
  getTierVegetationMultiplier,
} from "./utils/world";

// ServerNetwork migrated modules — character selection & world entry
// (PLAN_SERVERNETWORK_MIGRATION.md Step 5e).
// Character selection migrated to @hyperforge/hyperscape (Phase G-1,
// 2026-04-26). Plugin onEnable installs `world.playerSpawnService`
// (substrate `IPlayerSpawnService`) so ServerNetwork's enter-world
// dispatcher can resolve the spawn flow without a back-import.

export {
  BehaviorTreeInterpreter,
  type BehaviorContext,
  type InterpreterOptions,
  type NodeStatus,
  CombatTuningRegistry,
  UnknownCombatTuningProfileError,
  profileToResolvedTuning,
  type CombatPhase,
  type ResolvedCombatTuning,
  type CombatTuningManifest,
  type CombatTuningProfile,
  type CombatRole,
  type EngagementRange,
} from "./ai/index.js";

// ---------------------------------------------------------------------------
// ServerNetwork — exposed as part of the engine substrate (Step 9 of
// PLAN_SERVERNETWORK_MIGRATION). Server source must import this via
// the package barrel, NOT via relative `../../../shared/src/...`.
// Reaching in directly defeats esbuild's `external: ['@hyperforge/shared']`
// rule, which causes Entities.ts (and transitively the EntityTypes
// Map) to get bundled inline into the server. The plugin's
// `registerEntityType()` writes go to one Map; the server's
// `getEntityType()` reads from another. Symptom:
// "EntityClass is not a constructor" at world.entities.add() in
// handleEnterWorld.
// ---------------------------------------------------------------------------
export { ServerNetwork } from "./systems/server/network/index.js";

// ---------------------------------------------------------------------------
// Editor + viewer entry points (previously only in index.client.ts).
// Now that framework.client.js builds from index.ts, these need to be
// reachable from the canonical entry too. World Studio + asset-forge
// import them at runtime; the runtime client and node clients use
// createClientWorld + createNodeClientWorld.
// ---------------------------------------------------------------------------
export { createClientWorld } from "./runtime/createClientWorld";
export { createViewerWorld } from "./runtime/createViewerWorld";
export {
  createEditorWorld,
  initEditorWorld,
  EditorWorld,
  editorDataManager,
} from "./runtime/createEditorWorld";
export type { EditorWorldOptions } from "./runtime/createEditorWorld";
export { World } from "./core/World";
export {
  EditorCameraSystem,
  EditorSelectionSystem,
  EditorGizmoSystem,
} from "./systems/editor";
export type {
  EditorCameraMode,
  EditorCameraConfig,
  CameraBookmark,
  Selectable,
  SelectionChangeEvent,
  EditorSelectionConfig,
  TransformMode,
  TransformSpace,
  TransformEvent,
  EditorGizmoConfig,
} from "./systems/editor";
