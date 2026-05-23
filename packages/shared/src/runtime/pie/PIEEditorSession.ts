/**
 * PIEEditorSession — compat façade over real ServerNetwork + ClientNetwork.
 *
 * Presents the `PlayTestWorld`-shaped editor surface (entities map, tick,
 * start/stop, isRunning, gameMode, interactWith) but is internally backed
 * by:
 *
 *   - `PIEServerSession` — real server `World` + real `ServerNetwork`
 *     (the same code paths production runs).
 *   - `NodeClientWorld` + `ClientNetwork.attachPreconnectedSocket` — real
 *     client stack speaking the production packet protocol over an
 *     in-process `InMemorySocketPair`.
 *
 * This is Option A from `PLAN_SERVERNETWORK_MIGRATION.md` Step 9: a
 * disposable bridge that lets the editor swap out `PlayTestWorld`
 * without rewriting every consumer. When the editor is reworked to
 * consume the real ECS directly via `ClientNetwork` snapshots
 * (Option B), this file is deleted.
 *
 * ## Scope split
 *
 * This file lands in slices so each is independently reviewable:
 *
 *   - **Slice 1 (this commit)**: lifecycle + network wiring. `start()`
 *     boots both sessions and connects them; `stop()` tears everything
 *     down; `tick(dt)` forwards time to the server session. Entity map
 *     is the player only. Controllers + shims attach same as
 *     `PlayTestWorld`. No hand-placed entity spawning yet.
 *
 *   - **Slice 2**: entity spawning. `start()` takes the editor's
 *     `mobSpawns / npcs / resources / stations` arrays and spawns real
 *     entities on the server world via `world.entities.add()`. The
 *     façade's `entities` map mirrors them (read from server ECS
 *     directly since same-process; snapshot path comes later if
 *     needed for production parity).
 *
 *   - **Slice 3**: script graphs move to server-side `ScriptingSystem`.
 *     `ScriptingSystem.addGraph(entityId, graph, { trusted: true })`
 *     per entity. Debug sink subscribes to `scripting:*` events on
 *     the server event bus.
 *
 *   - **Slice 4**: `interactWith(id)` routes through a real packet
 *     (`entity:interact` or similar) so the server authoritatively
 *     decides what happens — same as production.
 *
 *   - **Slice 5**: repoint `usePIESession.ts` at this file; delete
 *     `createPlayTestWorld.ts` + `PIENetworkStub`.
 *
 * Until Slice 5, this file is unreferenced by the editor and exists
 * only as a testable scaffold.
 */

import { Object3D, type Camera, type Scene } from "three";
import { type WebGPURenderer } from "three/webgpu";

import type { World } from "../../core/World";
import { createNodeClientWorld } from "../createNodeClientWorld";
import { PIEServerSession } from "./PIEServerSession";
import {
  asClientWebSocket,
  type InMemoryClientSocket,
} from "../../platform/shared/InMemorySocketPair";
import type { ClientNetwork } from "../../systems/client/ClientNetwork";
import { InteractionRouter } from "../../systems/client/interaction/InteractionRouter";

import type { PlayerController } from "../../gameMode/controllers/PlayerController";
import type { CameraController } from "../../gameMode/cameras/CameraController";
import type { Pawn } from "../../gameMode/pawns/Pawn";
import type { GameMode, GameModeManifest } from "../../gameMode";
import {
  gameModeRegistry,
  registerHyperiaGameMode,
  HYPERIA_DEFAULT_MANIFEST,
} from "../../gameMode";
import { registerAlternateGameModes } from "../../gameMode/AlternateGameModes";
import { CLICK_TO_WALK_CONTROLLER_ID } from "../../gameMode/controllers/ClickToWalkPlayerController";
import {
  PIEInteractionRouterShim,
  PIEOrbitCameraShim,
  createPIEPawn,
} from "../pieShims";

import type { RuntimeScriptGraph } from "../../systems/shared/scripting/ScriptGraphInterpreter";
// ScriptingSystem migrated to @hyperforge/hyperscape (2026-04-25).
// PIE only calls `addGraph` on it — duck-type locally so we don't
// depend on the migrated class.
interface ScriptingSystem {
  addGraph(
    entityId: string,
    graph: RuntimeScriptGraph,
    options: { trusted: boolean },
  ): void;
}
import type { EntityData } from "../../types/core/base-types";
import { EventType } from "../../types/events/event-types";
import { uuid } from "../../utils/IdGenerator";
import type { PIEEntity } from "./PIEEntity";
import type { PIEDebugEntry, PIEDebugSink } from "../PIEScriptRunner";
import {
  prayerDataProvider,
  type PrayersManifest,
} from "../../data/PrayerDataProvider";
import {
  TierDataProvider,
  type TierRequirementsManifest,
} from "../../data/TierDataProvider";
import {
  ProcessingDataProvider,
  type CookingManifest,
  type FiremakingManifest,
  type SmeltingManifest,
  type SmithingManifest,
  type CraftingManifest,
  type TanningManifest,
  type FletchingManifest,
  type RunecraftingManifest,
} from "../../data/ProcessingDataProvider";
import { stationDataProvider } from "../../data/StationDataProvider";
import type {
  StationsManifest,
  ModelBoundsManifest,
} from "@hyperforge/manifest-schema";
import { dataManager } from "../../data/DataManager";
import { hotReloadRunes } from "../../data/runes";
import { hotReloadCombatSpells } from "../../data/combat-spells";
import { loadSkillUnlocks } from "../../data/skill-unlocks";
import { hotReloadNPCSizes } from "../../data/npc-sizes";
import { hotReloadAmmunition } from "../../data/ammunition";
import { hotReloadNpcSpawnConstants } from "../../data/npcs";
import { hotReloadStores } from "../../data/banks-stores";
import type { StoreData } from "../../types/core/core";
import { gatheringResources } from "../../gathering/index";
// LootSystem migrated to @hyperforge/hyperscape (2026-04-25). PIE
// only calls 2 setter methods on it (`setAuthoredLootTables` and
// `setMobLootTableMappings`) — duck-type locally so we don't depend
// on the migrated class.
interface LootSystem {
  setAuthoredLootTables(manifest: LootTablesManifest | null): void;
  setMobLootTableMappings(
    mappings: ReadonlyMap<string, string> | Record<string, string>,
  ): void;
}
// DialogueSystem migrated to @hyperforge/hyperscape (2026-04-25).
// PIE only calls 3 setter methods on it — duck-type locally.
// (DialogueManifest is already imported below from manifest-schema.)
import type { LocalizationCatalog as LocalizationCatalogType } from "../../localization/LocalizationCatalog";
interface DialogueSystem {
  setAuthoredDialogues(
    manifest: DialogueManifest | null,
    opts?: { preserveOpenSessionsByTreeId?: boolean },
  ): void;
  setAuthoredNpcDialogueBindings(bindings: Record<string, string> | null): void;
  setLocalizationCatalog(catalog: LocalizationCatalogType | null): void;
  // Condition-evaluator surface — needed because PIE passes the
  // dialogue system to `createManagedDialogueConditionInstall`,
  // which takes the WorldDialogueConditionEvaluators DialogueSystem
  // shape (register/unregister condition methods).
  registerConditionEvaluator(
    name: string,
    evaluator: (args: {
      readonly playerId: string;
      readonly npcId: string;
      readonly npcEntityId?: string;
    }) => boolean,
  ): void;
  unregisterConditionEvaluator(name: string): void;
}
import {
  createManagedDialogueConditionInstall,
  type ManagedDialogueConditionInstall,
} from "../../systems/shared/interaction/WorldDialogueConditionEvaluators";
import { dialogueConditionBindingsProvider } from "../../data/DialogueConditionBindingsProvider";
import { combatTuningProvider } from "../../data/CombatTuningProvider";
import { combatTuningAgentBindingsProvider } from "../../data/CombatTuningAgentBindingsProvider";
import { lootTablesProvider } from "../../data/LootTablesProvider";
import { mobLootTableMappingsProvider } from "../../data/MobLootTableMappingsProvider";
import { dialogueProvider } from "../../data/DialogueProvider";
import { npcDialogueBindingsProvider } from "../../data/NpcDialogueBindingsProvider";
import { localizationProvider } from "../../data/LocalizationProvider";
import { combatSpellsProvider } from "../../data/CombatSpellsProvider";
import { woodcuttingProvider } from "../../data/WoodcuttingProvider";
import { miningProvider } from "../../data/MiningProvider";
import { fishingProvider } from "../../data/FishingProvider";
import { npcsProvider } from "../../data/NpcsProvider";
import { questsProvider } from "../../data/QuestsProvider";
import { pluginRegistryProvider } from "../../data/PluginRegistryProvider";
import { damageTypesProvider } from "../../data/DamageTypesProvider";
import { damageTypeRegistry } from "../../damage-types";
import { worldAreasProvider } from "../../data/WorldAreasProvider";
import { worldAreasRegistry } from "../../world-areas";
import { npcScheduleProvider } from "../../data/NpcScheduleProvider";
import { npcScheduleRegistry } from "../../npc-schedule";
import { xpCurvesProvider } from "../../data/XpCurvesProvider";
import { xpCurveRegistry } from "../../progression";
import { renderProfilesProvider } from "../../data/RenderProfilesProvider";
import { renderProfileRegistry } from "../../rendering";
import { soundEffectsProvider } from "../../data/SoundEffectsProvider";
import { sfxRegistry } from "../../sfx";
import { vfxProvider } from "../../data/VfxProvider";
import { vfxRegistry } from "../../vfx";
import { animationsProvider } from "../../data/AnimationsProvider";
import { animationRegistry } from "../../animations";
import { cameraProfilesProvider } from "../../data/CameraProfilesProvider";
import { cameraProfileRegistry } from "../../camera";
import { audioBusMixProvider } from "../../data/AudioBusMixProvider";
import { audioBusMixer } from "../../audio";
import { interactionPromptsProvider } from "../../data/InteractionPromptsProvider";
import { interactionPromptRegistry } from "../../interaction-prompts";
import { chatChannelsProvider } from "../../data/ChatChannelsProvider";
import { chatChannelRegistry } from "../../chat";
import { musicStateMachineProvider } from "../../data/MusicStateMachineProvider";
import { musicStateMachineRegistry } from "../../music";
import { timeWeatherProvider } from "../../data/TimeWeatherProvider";
import { timeWeatherDriver } from "../../time-weather";
import { achievementsProvider } from "../../data/AchievementsProvider";
import { achievementEvaluator } from "../../achievements";
import { factionsProvider } from "../../data/FactionsProvider";
import { factionsRegistry } from "../../factions";
import { mountsProvider } from "../../data/MountsProvider";
import { mountRegistry } from "../../mounts";
import { petCompanionProvider } from "../../data/PetCompanionProvider";
import { petRegistry } from "../../pet-companion";
import { statusEffectsProvider } from "../../data/StatusEffectsProvider";
import { statusEffectRegistry } from "../../status-effects";
import { enchantmentsProvider } from "../../data/EnchantmentsProvider";
import { enchantmentRegistry } from "../../enchantments";
import { titlesProvider } from "../../data/TitlesProvider";
import { titleRegistry } from "../../titles";
import { leaderboardsProvider } from "../../data/LeaderboardsProvider";
import { leaderboardEngine } from "../../leaderboards";
import { mailProvider } from "../../data/MailProvider";
import { mailPolicyRegistry } from "../../mail";
import { seasonsProvider } from "../../data/SeasonsProvider";
import { seasonRegistry } from "../../seasons";
import { worldEventsProvider } from "../../data/WorldEventsProvider";
import { worldEventsRegistry } from "../../world-events";
import { skyboxAtmosphereProvider } from "../../data/SkyboxAtmosphereProvider";
import { skyboxAtmosphereRegistry } from "../../skybox-atmosphere";
import { particleGraphProvider } from "../../data/ParticleGraphProvider";
import { particleGraphRegistry } from "../../particle-graph";
import { voiceChatProvider } from "../../data/VoiceChatProvider";
import { voiceChatRegistry } from "../../voice-chat";
import { partyGuildProvider } from "../../data/PartyGuildProvider";
import { partyGuildRegistry } from "../../party-guild";
import { navMeshProvider } from "../../data/NavMeshProvider";
import { navMeshRegistry } from "../../nav-mesh";
import { lightingBakeProvider } from "../../data/LightingBakeProvider";
import { lightingBakeRegistry } from "../../lighting-bake";
import { levelStreamingProvider } from "../../data/LevelStreamingProvider";
import { levelStreamingRegistry } from "../../level-streaming";
import { prefabProvider } from "../../data/PrefabProvider";
import { prefabRegistry } from "../../prefab";
import { cinematicProvider } from "../../data/CinematicProvider";
import { cinematicRegistry } from "../../cinematic";
import { postProcessVolumesProvider } from "../../data/PostProcessVolumesProvider";
import { postProcessVolumeCompositor } from "../../rendering";
import { accessibilityProvider } from "../../data/AccessibilityProvider";
import { accessibilitySettings } from "../../accessibility";
import { featureFlagsProvider } from "../../data/FeatureFlagsProvider";
import { featureFlagRegistry } from "../../feature-flags";
import { physicsConfigProvider } from "../../data/PhysicsConfigProvider";
import { physicsConfigRegistry } from "../../physics-config";
import { respawnProvider } from "../../data/RespawnProvider";
import { respawnPolicyResolver } from "../../respawn";
import { talentTreesProvider } from "../../data/TalentTreesProvider";
import { talentTreeRegistry } from "../../talent-trees";
import { auctionHouseProvider } from "../../data/AuctionHouseProvider";
import { auctionHouseRegistry } from "../../auction-house";
import { crashReporterProvider } from "../../data/CrashReporterProvider";
import { crashReporterRegistry } from "../../crash-reporter";
import { pushNotificationsProvider } from "../../data/PushNotificationsProvider";
import { pushNotificationsRegistry } from "../../push-notifications";
import { licenseAgreementsProvider } from "../../data/LicenseAgreementsProvider";
import { licenseAgreementsRegistry } from "../../license-agreements";
import { moderationProvider } from "../../data/ModerationProvider";
import { moderationRegistry } from "../../moderation";
import { parentalControlsProvider } from "../../data/ParentalControlsProvider";
import { parentalControlsRegistry } from "../../parental-controls";
import { fastTravelProvider } from "../../data/FastTravelProvider";
import { fastTravelGraph } from "../../fast-travel";
import { friendsSocialProvider } from "../../data/FriendsSocialProvider";
import { friendsSocialRegistry } from "../../friends-social";
import { housingProvider } from "../../data/HousingProvider";
import { housingRegistry } from "../../housing";
import { loadoutsProvider } from "../../data/LoadoutsProvider";
import { loadoutPolicyRegistry } from "../../loadouts";
import { avatarsProvider } from "../../data/AvatarsProvider";
import { avatarsRegistry } from "../../avatars";
import { playerEmotesProvider } from "../../data/PlayerEmotesProvider";
import { playerEmotesRegistry } from "../../player-emotes";
import { spellVisualsProvider } from "../../data/SpellVisualsProvider";
import { spellVisualsRegistry } from "../../spell-visuals";
import { skillIconsProvider } from "../../data/SkillIconsProvider";
import { skillIconsRegistry } from "../../skill-icons";
import { commerceProvider } from "../../data/CommerceProvider";
import { commerceRegistry } from "../../commerce";
import { storeFrontProvider } from "../../data/StoreFrontProvider";
import { storeFrontRegistry } from "../../store-front";
import { onboardingGoalsProvider } from "../../data/OnboardingGoalsProvider";
import { onboardingGoalsRegistry } from "../../onboarding-goals";
import { creditsProvider } from "../../data/CreditsProvider";
import { creditsRegistry } from "../../credits";
import { mainMenuProvider } from "../../data/MainMenuProvider";
import { mainMenuRegistry } from "../../main-menu";
import { tooltipsProvider } from "../../data/TooltipsProvider";
import { tooltipRegistry } from "../../tooltips";
import { keyPromptIconsProvider } from "../../data/KeyPromptIconsProvider";
import { keyPromptGlyphRegistry } from "../../key-prompts";
import { loadingScreensProvider } from "../../data/LoadingScreensProvider";
import { loadingScreensRegistry } from "../../loading-screens";
import { hapticsProvider } from "../../data/HapticsProvider";
import { hapticsRegistry } from "../../haptics";
import { tutorialFlowsProvider } from "../../data/TutorialFlowsProvider";
import { tutorialFlowsRegistry } from "../../tutorial-flows";
import { inputActionsProvider } from "../../data/InputActionsProvider";
import { inputActionsRegistry } from "../../input-actions";
import { skillUnlocksProvider } from "../../data/SkillUnlocksProvider";
import { skillUnlocksRegistry } from "../../skill-unlocks";
import { weaponStylesProvider } from "../../data/WeaponStylesProvider";
import { weaponStylesRegistry } from "../../weapon-styles";
import { ammunitionProvider } from "../../data/AmmunitionProvider";
import { ammunitionRegistry } from "../../ammunition";
import { editorSnapProvider } from "../../data/EditorSnapProvider";
import { editorSnapRegistry } from "../../editor-snap";
import { projectSettingsProvider } from "../../data/ProjectSettingsProvider";
import { projectSettingsRegistry } from "../../project-settings";
import { qualityPresetsProvider } from "../../data/QualityPresetsProvider";
import { qualityPresetsRegistry } from "../../quality-presets";
import { deployTargetsProvider } from "../../data/DeployTargetsProvider";
import { deployTargetsRegistry } from "../../deploy-targets";
import { profilerOverlayProvider } from "../../data/ProfilerOverlayProvider";
import { profilerOverlayRegistry } from "../../profiler";
import { replicationProvider } from "../../data/ReplicationProvider";
import { replicationRegistry } from "../../replication";
import { smithingProvider } from "../../data/SmithingProvider";
import { smithingRegistry } from "../../smithing";
import { processingProvider } from "../../data/ProcessingProvider";
import { processingRegistry } from "../../processing";
import { bankingProvider } from "../../data/BankingProvider";
import { bankingRegistry } from "../../banking";
import { arenaLayoutProvider } from "../../data/ArenaLayoutProvider";
import { arenaLayoutRegistry } from "../../arena-layout";
import { lodSettingsProvider } from "../../data/LODSettingsProvider";
import { lodSettingsRegistry } from "../../lod-settings";
import { npcSizesProvider } from "../../data/NPCSizesProvider";
import { npcSizesRegistry } from "../../npc-sizes";
import { npcDefinitionsRegistry } from "../../npc-definitions";
import { duelProvider } from "../../data/DuelProvider";
import { duelRulesRegistry } from "../../duel";
import { storesProvider } from "../../data/StoresProvider";
import { storesRegistry } from "../../stores";
import { toolsProvider } from "../../data/ToolsProvider";
import { toolsRegistry } from "../../tools";
import { treesProvider } from "../../data/TreesProvider";
import { treeCatalogRegistry } from "../../trees";
import { biomesProvider } from "../../data/BiomesProvider";
import { biomesRegistry } from "../../biomes";
import { vegetationProvider } from "../../data/VegetationProvider";
import { vegetationRegistry } from "../../vegetation";
import { tradingProvider } from "../../data/TradingProvider";
import { tradingRegistry } from "../../trading";
import { itemSetsProvider } from "../../data/ItemSetsProvider";
import { itemSetRegistry } from "../../item-sets";
import { transmogProvider } from "../../data/TransmogProvider";
import { transmogRegistry } from "../../transmog";
import { economyTuningProvider } from "../../data/EconomyTuningProvider";
import { economyTuningRegistry } from "../../economy-tuning";
import { interactionProvider } from "../../data/InteractionProvider";
import { interactionConfigRegistry } from "../../interaction";
import { newsFeedProvider } from "../../data/NewsFeedProvider";
import { newsFeedRegistry } from "../../news-feed";
import { buildingsProvider } from "../../data/BuildingsProvider";
import { buildingsRegistry } from "../../buildings";
import { screenshotProvider } from "../../data/ScreenshotProvider";
import { screenshotRegistry } from "../../screenshot";
import { serverBrowserProvider } from "../../data/ServerBrowserProvider";
import { serverBrowserRegistry } from "../../server-browser";
import { equipmentProvider } from "../../data/EquipmentProvider";
import { equipmentManifestRegistry } from "../../equipment-manifest";
import { matchmakingTuningProvider } from "../../data/MatchmakingTuningProvider";
import { matchmakingRegistry } from "../../matchmaking-tuning";
import { aiBehaviorProvider } from "../../data/AIBehaviorProvider";
import { analyticsEventsProvider } from "../../data/AnalyticsEventsProvider";
import { analyticsEventRouter } from "../../analytics";
import { groupFinderProvider } from "../../data/GroupFinderProvider";
import { groupFinderRegistry } from "../../group-finder";
import { duelArenasProvider } from "../../data/DuelArenasProvider";
import { combatProvider } from "../../data/CombatProvider";
import { gameProvider } from "../../data/GameProvider";
import { gatheringProvider } from "../../data/GatheringProvider";
import { musicProvider } from "../../data/MusicProvider";
import { saveDataProvider } from "../../data/SaveDataProvider";
import { worldStructureProvider } from "../../data/WorldStructureProvider";
import { worldConfigProvider } from "../../data/WorldConfigProvider";
import { LocalizationCatalog } from "../../localization";
import type { Item } from "../../types/game/item-types";
import type {
  RunesManifest,
  CombatSpellsManifest,
  WoodcuttingManifest,
  MiningManifest,
  FishingManifest,
  SkillUnlocksManifest,
  NPCSizesManifest,
  NpcDefinitionsManifest,
  AmmunitionManifest,
  LootTablesManifest,
  DialogueManifest,
  DialogueConditionBindingsManifest,
  CombatTuningManifest,
  LocalizationBundle,
  LocalizationManifest,
  DamageTypesManifest,
  NpcsManifest,
  QuestsManifest,
  PluginRegistryManifest,
  WorldAreasManifest,
  WorldConfigManifest,
  NpcScheduleManifest,
  XpCurvesManifest,
  RenderProfileManifest,
  SoundEffectManifest,
  VfxManifest,
  AnimationManifest,
  CameraProfilesManifest,
  AudioBusMixManifest,
  InteractionPromptsManifest,
  ChatChannelsManifest,
  MusicStateMachineManifest,
  TimeWeatherManifest,
  AchievementsManifest,
  FactionsManifest,
  MountsManifest,
  PetCompanionManifest,
  StatusEffectsManifest,
  EnchantmentsManifest,
  TitlesManifest,
  LeaderboardsManifest,
  MailManifest,
  SeasonsManifest,
  WorldEventsManifest,
  SkyboxAtmosphereManifest,
  ParticleGraphManifest,
  VoiceChatManifest,
  PartyGuildManifest,
  NavMeshManifest,
  LightingBakeManifest,
  LevelStreamingManifest,
  PrefabManifest,
  CinematicManifest,
  PostProcessVolumeManifest,
  AccessibilityManifest,
  FeatureFlagsManifest,
  PhysicsConfigManifest,
  RespawnManifest,
  TalentTreesManifest,
  AuctionHouseManifest,
  CrashReporterManifest,
  PushNotificationsManifest,
  LicenseAgreementsManifest,
  ModerationManifest,
  ParentalControlsManifest,
  FastTravelManifest,
  FriendsSocialManifest,
  HousingManifest,
  LoadoutsManifest,
  AvatarsManifest,
  PlayerEmotesManifest,
  SpellVisualsManifest,
  SkillIconsManifest,
  CommerceManifest,
  StoreFrontManifest,
  OnboardingGoalsManifest,
  CreditsManifest,
  MainMenuManifest,
  TooltipsManifest,
  KeyPromptIconsManifest,
  LoadingScreensManifest,
  HapticsManifest,
  TutorialFlowsManifest,
  InputActionsManifest,
  WeaponStylesManifest,
  EditorSnapManifest,
  ProjectSettingsManifest,
  QualityPresetsManifest,
  DeployTargetsManifest,
  ProfilerOverlayManifest,
  ReplicationManifest,
  SmithingManifest as SchemaSmithingManifest,
  ProcessingManifest as SchemaProcessingManifest,
  BankingManifest as SchemaBankingManifest,
  ArenaLayoutManifest,
  LODSettingsManifest,
  DuelManifest,
  ToolsManifest,
  StoresManifest as SchemaStoresManifest,
  TreeManifest,
  BiomesManifest,
  VegetationManifest,
  TradingManifest,
  ItemSetsManifest,
  TransmogManifest,
  EconomyTuningManifest,
  InteractionManifest,
  NewsFeedManifest,
  BuildingsManifest,
  ScreenshotManifest,
  ServerBrowserManifest,
  EquipmentManifest,
  AIBehaviorManifest,
  MatchmakingTuningManifest,
  AnalyticsEventManifest,
  GroupFinderManifest,
  DuelArenasManifest,
  CombatManifest,
  GameManifest,
  GatheringManifest,
  MusicManifest,
  SaveDataManifest,
  WorldStructureManifest,
} from "@hyperforge/manifest-schema";

// ---------------------------------------------------------------------------
// Public surface — must match `PlayTestWorldOptions` shape-for-shape so the
// editor migration is a type-level swap only.
// ---------------------------------------------------------------------------

/**
 * Disposable returned by a plugin-boot hook. Must expose `stop()` —
 * PIEEditorSession calls it during teardown. `PluginSession` from
 * `@hyperforge/gameplay-framework` satisfies this shape directly, so
 * callers typically return that unchanged.
 */
export interface PIEPluginSessionLike {
  stop(): Promise<void> | void;
}

/**
 * Hooks that let a host (asset-forge editor, tests, etc.) boot a
 * game-specific plugin set against the real server/client worlds PIE
 * owns. Shared stays plugin-package-agnostic — the host is responsible
 * for picking modules (hyperscape vs shooter-demo vs custom) and for
 * building a `PluginContextBase` for each plugin id.
 *
 * Semantics:
 *   - `bootServerPlugins(serverWorld)` runs right after the PIE server
 *     world has finished `start()` and before editor entities are
 *     seeded. Returned session's `stop()` fires before the server
 *     world tears down.
 *   - `bootClientPlugins(clientWorld)` runs after the client world has
 *     been constructed and the loopback socket attached. Returned
 *     session's `stop()` fires before the client `network.destroy()`
 *     during teardown.
 *
 * Both hooks are optional — if absent the session behaves exactly as
 * before (no plugin boot, no plugin teardown).
 */
export interface PIEPluginHooks {
  bootServerPlugins?: (
    serverWorld: World,
  ) => Promise<PIEPluginSessionLike> | PIEPluginSessionLike;
  bootClientPlugins?: (
    clientWorld: World,
  ) => Promise<PIEPluginSessionLike> | PIEPluginSessionLike;
}

export interface PIEEditorSessionOptions {
  mobSpawns?: Array<{
    id: string;
    mobId: string;
    name: string;
    position: { x: number; y: number; z: number };
    spawnRadius: number;
    maxCount: number;
    behaviorGraph?: RuntimeScriptGraph;
  }>;
  npcs?: Array<{
    id: string;
    type: string;
    name: string;
    position: { x: number; y: number; z: number };
    behaviorGraph?: RuntimeScriptGraph;
  }>;
  resources?: Array<{
    id: string;
    resourceId: string;
    resourceType: string;
    name: string;
    position: { x: number; y: number; z: number };
    behaviorGraph?: RuntimeScriptGraph;
  }>;
  stations?: Array<{
    id: string;
    type: string;
    position: { x: number; y: number; z: number };
    behaviorGraph?: RuntimeScriptGraph;
  }>;
  playerSpawn?: { x: number; y: number; z: number };
  debugSink?: PIEDebugSink;
  gameMode?: GameModeManifest;
  viewport?: HTMLElement;
  camera?: Camera;
  playerObject?: Object3D;
  /**
   * The editor's WebGPU renderer. When supplied, PIE mounts it onto
   * `_clientWorld.graphics` so the real `InteractionRouter`
   * (registered on the client world) can read
   * `world.graphics.renderer.domElement` to bind canvas events.
   * Without it, PIE falls back to `PIEInteractionRouterShim`.
   *
   * Part of B0.2 — bridge editor refs onto PIE's client world so
   * the production interaction stack runs unmodified.
   */
  renderer?: WebGPURenderer;
  /**
   * The editor's THREE scene. When supplied, PIE mounts it onto
   * `_clientWorld.stage.scene` so `RaycastService` (used by
   * `InteractionRouter`) can resolve raycasts against the editor's
   * scene graph. PIE markers are added to this scene's
   * `markerGroup`, so raycasts hit them naturally.
   */
  scene?: Scene;
  mode?: "play" | "simulate";
  /**
   * Plugin-boot hooks. The host (editor/tests) decides which plugin
   * set to load based on game selection; PIE just calls them at the
   * right points in start/stop. Absent = no plugin boot (legacy
   * behavior before Phase I PIE plugin integration).
   */
  plugins?: PIEPluginHooks;
}

// ---------------------------------------------------------------------------
// PIEEditorSession
// ---------------------------------------------------------------------------

/**
 * Compat façade. Public API mirrors `PlayTestWorld` exactly so swapping
 * `createPlayTestWorld()` → `new PIEEditorSession()` in the editor is a
 * one-line change.
 */
export class PIEEditorSession {
  /**
   * Entity map the editor iterates for marker creation + per-frame sync.
   * In Slice 1 contains only the player. Slice 2 populates mobs/NPCs/etc.
   * Slice 3+ keeps this in sync with server ECS.
   */
  readonly entities = new Map<string, PIEEntity>();

  /** Player entity — always present while running. */
  player: PIEEntity | null = null;

  /** Resolved GameMode. Null before start() / after stop(). */
  gameMode: GameMode | null = null;

  // --- internal state ----------------------------------------------------

  private _running = false;
  private _server: PIEServerSession | null = null;
  private _clientWorld: World | null = null;
  private _clientAdapter: InMemoryClientSocket | null = null;

  // Controllers + PIE shim surface (same pattern as PlayTestWorld).
  private _playerController: PlayerController | null = null;
  private _cameraController: CameraController | null = null;
  private _routerShim: PIEInteractionRouterShim | null = null;
  /**
   * Real `InteractionRouter` registered on `_clientWorld` when the
   * editor supplied renderer + scene + camera. Wins over the shim;
   * the shim only instantiates as a fallback for callers that don't
   * pass viewport refs (tests, headless harnesses).
   */
  private _interactionRouter: InteractionRouter | null = null;
  private _orbitShim: PIEOrbitCameraShim | null = null;
  private _pawn: Pawn | null = null;
  private _camera: Camera | null = null;

  // Scratch pawn Object3D for sessions that don't supply one (e.g. simulate
  // mode with no controller attach). Never rendered — controllers write to
  // its position but we ignore it.
  private static readonly _fallbackPawnObject = new Object3D();

  // Plugin sessions booted by host-supplied hooks during start(). Held
  // here so stop() can unwind them in the right order (client before
  // server, mirroring world teardown).
  private _serverPluginSession: PIEPluginSessionLike | null = null;
  private _clientPluginSession: PIEPluginSessionLike | null = null;

  // --- public getters ----------------------------------------------------

  get isRunning(): boolean {
    return this._running;
  }

  /**
   * Expose the internal server session for tests + advanced editor features
   * (e.g. direct server event subscription before Slice 4 routes everything
   * through packets).
   */
  get server(): PIEServerSession | null {
    return this._server;
  }

  /** Expose the client `ClientNetwork` instance — tests + debug only. */
  get clientNetwork(): ClientNetwork | null {
    if (!this._clientWorld) return null;
    return (this._clientWorld as unknown as { network: ClientNetwork }).network;
  }

  /**
   * Active player controller (only populated in play mode). Null in
   * simulate mode or after stop. Exposed for tests + editor introspection
   * — mirrors the field `PlayTestWorld` exposed before the PIE migration.
   */
  get playerController(): PlayerController | null {
    return this._playerController;
  }

  /** Active camera controller. Same nullability rules as `playerController`. */
  get cameraController(): CameraController | null {
    return this._cameraController;
  }

  /** Pawn wrapping the player marker while a play-mode session is running. */
  get pawn(): Pawn | null {
    return this._pawn;
  }

  /** External camera reference supplied by the editor during play mode. */
  get camera(): Camera | null {
    return this._camera;
  }

  /**
   * Scripts façade. Exposes `.on()` so tests + editor panels can subscribe
   * to action events (e.g. `dialogue:start`) emitted by `ScriptingSystem`
   * on the server world bus. Returns `null` before start / after stop to
   * match the old `PlayTestWorld.scripts` semantics.
   */
  get scripts(): {
    on(type: string, fn: (payload: unknown) => void): void;
    off(type: string, fn: (payload: unknown) => void): void;
  } | null {
    if (!this._server) return null;
    const world = this._server.world;
    return {
      on: (type, fn) => {
        world.on(type, fn);
      },
      off: (type, fn) => {
        world.off(type, fn);
      },
    };
  }

  // --- World-compat surface (consumed by controllers via `this as World`) ---

  /**
   * System registry for PIE-owned shims (e.g. `interaction-router`).
   * Controllers resolve via `getSystem(id)` which checks this map first
   * before falling back to the server ECS world's systems.
   */
  readonly systems = new Map<string, unknown>();

  /** Subscribe to events on the server world bus. */
  on(type: string, fn: (payload: unknown) => void): void {
    this._server?.world.on(type, fn);
  }

  /** Unsubscribe from events on the server world bus. */
  off(type: string, fn: (payload: unknown) => void): void {
    this._server?.world.off(type, fn);
  }

  /** Emit an event on the server world bus. */
  emit(type: string, payload: unknown): void {
    this._server?.world.emit(type, payload);
  }

  /**
   * Resolve a system by id. PIE-owned shims take precedence so controllers
   * see the editor viewport's router shim before the server ECS equivalents.
   */
  getSystem(id: string): unknown | null {
    const local = this.systems.get(id);
    if (local !== undefined) return local;
    const server = this._server?.world.getSystem(id) ?? null;
    return server ?? null;
  }

  // --- lifecycle ---------------------------------------------------------

  /**
   * Start a PIE session. Boots a real server world + ServerNetwork, a
   * NodeClientWorld, and wires them via an `InMemorySocketPair`.
   *
   * @param options Entity + gameMode config. See `PIEEditorSessionOptions`.
   */
  async start(options: PIEEditorSessionOptions = {}): Promise<void> {
    if (this._running) {
      console.warn("[PIEEditorSession] start() called while already running");
      return;
    }

    // 1. Boot the server side (real PIE world + ServerNetwork + bridges).
    //    RPG systems ON (slice 3): we need ScriptingSystem + Entities
    //    constructors + combat/movement for behavior graphs to run like
    //    production. Terrain and environment stay off — PIE previews
    //    don't need procgen/lighting, and leaving them off keeps test
    //    startup fast. Slice 5 may flip terrain on once the editor feeds
    //    its own tile data in.
    this._server = new PIEServerSession({
      skipRpgSystems: false,
      skipTerrain: true,
      skipEnvironment: true,
    });
    await this._server.start();

    // 1b. Boot server plugins (if the host supplied hooks) before any
    //     editor entities are seeded — plugins' onEnable register
    //     systems/entity types that later `server.world.entities.add`
    //     calls depend on.
    if (options.plugins?.bootServerPlugins) {
      try {
        this._serverPluginSession = await options.plugins.bootServerPlugins(
          this._server.world,
        );
      } catch (err) {
        console.error(
          "[PIEEditorSession] server plugin boot failed — continuing without plugins:",
          err,
        );
        this._serverPluginSession = null;
      }
    }

    // 2. Open a loopback connection. `characterId: "editor-host"` is the
    //    synthetic account id `PIELoopbackConnectionHandler` registers on
    //    `ServerNetwork.sockets` so the session is observable in tests.
    const { client } = await this._server.connect({
      characterId: "editor-host",
    });

    // 3. Boot a NodeClientWorld and attach the client end of the loopback.
    //    This is the real ClientNetwork — same packet protocol the live
    //    client speaks. No world.init() needed; attachPreconnectedSocket
    //    bypasses the wsUrl + auth handshake.
    this._clientWorld = createNodeClientWorld();

    // B0.2b — Mount editor refs onto _clientWorld so the real
    // InteractionRouter (and any other system that reads
    // `world.graphics`/`world.stage`/`world.camera`) can run against
    // PIE's loopback unmodified. NodeClientWorld is headless by
    // default; this assignment elevates it to a "browser-equivalent"
    // surface using the editor's actual viewport renderer + scene +
    // camera.
    //
    // Lossless when these options are absent — the existing
    // PIEInteractionRouterShim path still runs as today's fallback.
    // B0.2c will route through `world.entities`; B0.2d swaps the
    // shim for the real router.
    if (options.renderer) {
      const w = this._clientWorld as unknown as {
        graphics?: { renderer: { domElement: HTMLCanvasElement } };
      };
      w.graphics = {
        renderer: { domElement: options.renderer.domElement },
      };
    }
    if (options.scene) {
      const w = this._clientWorld as unknown as {
        stage?: { scene?: Scene };
      };
      w.stage = { scene: options.scene };
    }
    if (options.camera) {
      const w = this._clientWorld as unknown as { camera?: Camera };
      w.camera = options.camera;
    }

    const network = (this._clientWorld as unknown as { network: ClientNetwork })
      .network;
    this._clientAdapter = asClientWebSocket(client);
    network.attachPreconnectedSocket(
      this._clientAdapter as unknown as WebSocket,
      { lastWsUrl: "pie-editor-session://" },
    );

    // 3b. Boot client plugins (if the host supplied hooks) against the
    //     real NodeClientWorld. Same rationale as the server side — plugin
    //     onEnable must register before downstream wiring depends on it.
    if (options.plugins?.bootClientPlugins) {
      try {
        this._clientPluginSession = await options.plugins.bootClientPlugins(
          this._clientWorld,
        );
      } catch (err) {
        console.error(
          "[PIEEditorSession] client plugin boot failed — continuing without plugins:",
          err,
        );
        this._clientPluginSession = null;
      }
    }

    // 4. Resolve GameMode. Same logic PlayTestWorld uses so controllers
    //    resolve identically. `register` is idempotent on duplicate ids.
    registerHyperiaGameMode(gameModeRegistry);
    registerAlternateGameModes(gameModeRegistry);
    const manifest = options.gameMode ?? HYPERIA_DEFAULT_MANIFEST;

    // Controllers + shims still need a world-shaped object exposing
    // `camera`, `emit`, and `getSystem`. Slice 1 uses a thin compat
    // adapter (`this as unknown as World`) — the controllers touch
    // only the fields PlayTestWorld already exposed. Slice 4 swaps this
    // for `this._clientWorld` once the controllers learn to drive real
    // entities through `ClientNetwork`.
    // TODO(slice 4): replace with `this._clientWorld` when controllers
    // migrate to consuming client ECS.
    this.gameMode = gameModeRegistry.resolve(manifest, {
      world: this as unknown as World,
      runtime: "pie",
    });

    // 5. Seed the editor-visible entity map with the player, then mirror
    //    the editor's `mobSpawns / npcs / resources / stations` arrays as
    //    PIEEntity records. This is the façade surface that `usePIESession`
    //    consumes via `world.entities.values()`.
    //
    //    TODO(slice 3): once RPG systems are enabled on the PIE world,
    //    also call `this._server.world.entities.add(data, true)` per
    //    record so server ECS + ScriptingSystem see them. Slice 2 keeps
    //    the scaffold lean so tests boot without the full RPG stack.
    // Attach debug-sink listener BEFORE spawns so it catches
    // `scripting:graph_ready` and other addGraph-time events. Subscribed
    // on the server world event bus.
    if (options.debugSink) {
      this._attachDebugSink(options.debugSink);
    }

    const spawn = options.playerSpawn ?? { x: 0, y: 2, z: 0 };
    this.player = {
      id: "pie-player",
      type: "player",
      position: { ...spawn },
      rotation: 0,
      name: "Player",
    };
    this.entities.set(this.player.id, this.player);

    // Spawn the real server-side player entity so the hyperscape plugin's
    // PlayerSystem (PLAYER_JOINED listener), combat/skills/prayer
    // subscribers, and PhysX hot-set see a live player. Mirror
    // character-selection.ts:1011 — same fields, same `owner` = client
    // socket id so when the entity replicates over the loopback the
    // client's `Entities.add` dispatches `playerLocal` (not `playerRemote`).
    this._spawnRealPlayer(spawn);

    if (options.mobSpawns) {
      for (const ms of options.mobSpawns) {
        for (let i = 0; i < ms.maxCount; i++) {
          const angle = (i / Math.max(1, ms.maxCount)) * Math.PI * 2;
          const dist = ms.spawnRadius * 0.5;
          const pos = {
            x: ms.position.x + Math.cos(angle) * dist,
            y: ms.position.y,
            z: ms.position.z + Math.sin(angle) * dist,
          };
          const entity: PIEEntity = {
            id: `mob_${ms.id}_${i}`,
            type: "mob",
            position: pos,
            rotation: angle,
            name: ms.name,
            mobId: ms.mobId,
            patrolCenter: { x: ms.position.x, z: ms.position.z },
            patrolRadius: ms.spawnRadius,
            moveTarget: null,
            behaviorGraph: ms.behaviorGraph,
          };
          this.entities.set(entity.id, entity);
          this._spawnOnServer(
            {
              id: entity.id,
              type: "mob",
              name: ms.name,
              position: [pos.x, pos.y, pos.z],
              mobId: ms.mobId,
              patrolCenter: { x: ms.position.x, z: ms.position.z },
              patrolRadius: ms.spawnRadius,
            },
            ms.behaviorGraph,
          );
        }
      }
    }

    if (options.npcs) {
      for (const npc of options.npcs) {
        const entity: PIEEntity = {
          id: `npc_${npc.id}`,
          type: "npc",
          position: { ...npc.position },
          rotation: 0,
          name: npc.name,
          npcType: npc.type,
          behaviorGraph: npc.behaviorGraph,
        };
        this.entities.set(entity.id, entity);
        this._spawnOnServer(
          {
            id: entity.id,
            type: "npc",
            name: npc.name,
            position: [npc.position.x, npc.position.y, npc.position.z],
            npcType: npc.type,
          },
          npc.behaviorGraph,
        );
      }
    }

    if (options.resources) {
      for (const res of options.resources) {
        const entity: PIEEntity = {
          id: `resource_${res.id}`,
          type: "resource",
          position: { ...res.position },
          rotation: 0,
          name: res.name,
          resourceType: res.resourceType,
          behaviorGraph: res.behaviorGraph,
        };
        this.entities.set(entity.id, entity);
        this._spawnOnServer(
          {
            id: entity.id,
            type: "resource",
            name: res.name,
            position: [res.position.x, res.position.y, res.position.z],
            resourceType: res.resourceType,
          },
          res.behaviorGraph,
        );
      }
    }

    if (options.stations) {
      for (const station of options.stations) {
        const entity: PIEEntity = {
          id: `station_${station.id}`,
          type: "station",
          position: { ...station.position },
          rotation: 0,
          name: station.type,
          stationType: station.type,
          behaviorGraph: station.behaviorGraph,
        };
        this.entities.set(entity.id, entity);
        this._spawnOnServer(
          {
            id: entity.id,
            // Stations map 1:1 to the specific entity-type registry key
            // (bank / furnace / anvil / altar / range). Unknown types fall
            // back to the generic "entity" constructor so the record still
            // exists server-side even if we don't have a bespoke class.
            type: PIEEditorSession._stationServerType(station.type),
            name: station.type,
            position: [
              station.position.x,
              station.position.y,
              station.position.z,
            ],
            stationType: station.type,
          },
          station.behaviorGraph,
        );
      }
    }

    // 6. Attach controllers + shims when play mode has the editor handles.
    //    Same gates as PlayTestWorld so the migration is behavior-identical.
    const playMode = options.mode === "play";
    if (playMode && options.camera && options.playerObject) {
      this._camera = options.camera;
      const pawn = createPIEPawn(
        "pie-player",
        options.playerObject ?? PIEEditorSession._fallbackPawnObject,
      );
      this._pawn = pawn;

      // The orbit shim needs a bus that hears `CAMERA_SET_TARGET` emitted
      // by the `OrbitCameraController` on attach. Controllers emit via
      // `world.emit()` (which we delegate to the server world), so route
      // the shim's subscription to the same bus. Without this the shim
      // never learns which pawn to follow and the camera won't move.
      const serverWorld = this._server.world;
      const busLike = {
        on: (t: string, fn: (p: unknown) => void) => {
          serverWorld.on(t, fn);
        },
        off: (t: string, fn: (p: unknown) => void) => {
          serverWorld.off(t, fn);
        },
      };
      this._orbitShim = new PIEOrbitCameraShim(options.camera, busLike);

      if (
        options.viewport &&
        this.gameMode.id === CLICK_TO_WALK_CONTROLLER_ID
      ) {
        // B0.2d — When the editor supplied renderer + scene + camera,
        // we already mounted them onto `_clientWorld.graphics` /
        // `.stage.scene` / `.camera` (B0.2b). Register the real
        // production `InteractionRouter` against `_clientWorld` so PIE
        // exercises the same code path port 3333 does.
        //
        // PIE skips `_clientWorld.start()` (per the
        // `attachPreconnectedSocket` design — comment at line ~870)
        // so we explicitly call `interactionRouter.start()` to bind
        // canvas events. Plugin-registered systems are similarly
        // half-initialized in PIE today; that's a separate
        // architectural cleanup (path-a in B0.2c findings).
        //
        // Falls back to `PIEInteractionRouterShim` when refs are
        // absent (tests, headless callers) so existing test harnesses
        // keep working.
        const haveRealRouterRefs =
          options.renderer !== undefined &&
          options.scene !== undefined &&
          options.camera !== undefined &&
          this._clientWorld !== null;

        if (haveRealRouterRefs) {
          try {
            const router = (this._clientWorld as World).register(
              "interaction",
              InteractionRouter,
            ) as InteractionRouter;
            // Bind canvas events. start() reads
            // world.graphics.renderer.domElement so the editor's
            // renderer must be mounted (B0.2b) — we asserted that
            // above.
            router.start();
            this._interactionRouter = router;
            // Mirror the shim's registry slot so any legacy caller
            // resolving `interaction-router` gets *something*.
            this.systems.set(
              "interaction-router",
              router as unknown as PIEInteractionRouterShim,
            );
          } catch (err) {
            console.warn(
              "[PIEEditorSession] Real InteractionRouter failed to start; falling back to shim:",
              err,
            );
            this._interactionRouter = null;
          }
        }

        // Fallback: shim path when refs missing OR when real router
        // construction threw.
        if (!this._interactionRouter) {
          this._routerShim = new PIEInteractionRouterShim({
            viewport: options.viewport,
            camera: options.camera,
            bus: {
              emit: (_t: string, _p: unknown) => {
                // TODO(slice 4): route through `client.ws.send(writePacket(...))`
                // so click-to-walk issues a real movement request instead of
                // a local event. Slice 2 keeps it local so the scaffold works.
              },
            },
          });
          this._routerShim.setPawn(pawn);
          // Controllers resolve the router via `world.getSystem(...)` —
          // register under the same id the live `InteractionRouter`
          // system uses so the resolution chain is identical in play
          // mode.
          this.systems.set("interaction-router", this._routerShim);
        }
      }

      const ctx = {
        world: this as unknown as World,
        runtime: "pie" as const,
      };
      this._playerController = this.gameMode.createPlayerController(ctx);
      this._cameraController = this.gameMode.createCameraController(ctx);
      const input = this.gameMode.createInputContext(ctx);
      this._playerController.attach(pawn, input);
      this._cameraController.attach(pawn);
    }

    this._running = true;
  }

  /**
   * Advance simulation by `dt` seconds. The editor calls this from rAF.
   *
   * Forwards to `PIEServerSession.tick()` which drives the server world's
   * tick loop. The client side ticks itself via `NodeClient`'s internal
   * `setImmediate` loop (30 Hz) — the editor doesn't drive that.
   */
  tick(dt: number): void {
    if (!this._running || !this._server) return;

    // Drive play-mode controllers before the server tick so click-to-walk
    // input flushes into movement this frame (matches the old
    // PlayTestWorld ordering). Controllers are null in simulate mode.
    this._playerController?.tick(dt);
    this._cameraController?.tick(dt);
    // Router shim owns pawn translation in click-to-walk (pawn walks
    // toward the last click); orbit shim lerps the editor camera toward
    // the pawn. Both need their own tick — controllers only feed them.
    this._routerShim?.tick(dt);
    this._orbitShim?.tick(dt);

    // PIEServerSession.tick takes an absolute ms timestamp (World.tick
    // converts to per-frame delta internally). Translate the editor's
    // seconds-delta back to an absolute timestamp. performance.now() is
    // available on node via the global polyfill.
    const timeMs =
      typeof performance !== "undefined"
        ? performance.now()
        : Date.now() + dt * 1000;
    this._server.tick(timeMs);
    this._tickCount += 1;

    // Mirror server-side entity positions into the façade `entities` map
    // so the editor's marker sync (`usePIESession` rAF loop) picks up
    // AI/script-driven movement. Same-process ECS read — direct and
    // cheap. Production parity (via `ClientNetwork` snapshot packets)
    // is Option B's concern; the façade doesn't need it.
    const worldEntities = this._server.world.entities.items;
    for (const [id, pieEntity] of this.entities) {
      if (id === "pie-player") continue;
      const serverEntity = worldEntities.get(id);
      if (!serverEntity) continue;
      const pos = serverEntity.position;
      if (!pos) continue;
      pieEntity.position.x = pos.x;
      pieEntity.position.y = pos.y;
      pieEntity.position.z = pos.z;
    }
  }

  /**
   * Fire `entity:interacted` for the given entity. Called from the editor
   * viewport when the user clicks a marker.
   *
   * Production path: client sends `entityInteract` packet → server handler
   * runs permission/range checks → emits `entity:interacted` on the world
   * bus → `ScriptingSystem.trigger/onInteract` fires. The `entityInteract`
   * handler currently lives in `packages/server`; until it migrates to
   * shared (tracked by PLAN_SERVERNETWORK_MIGRATION.md), we emit the bus
   * event directly on the PIE server world. Same observable effect for
   * scripts; the packet-hop test will light up when the handler lands.
   */
  interactWith(entityId: string): void {
    if (!this._running || !this._server) return;
    const world = this._server.world;
    world.emit("entity:interacted", {
      entityId,
      playerId: "pie-player",
      position: this.player?.position,
    });
  }

  /**
   * B0.3 — Snapshot of live player state for the manifest HUD.
   *
   * Builds a `DataContext`-shaped record (matching the namespace
   * convention of `buildPlayerDataContext` in
   * `packages/client/src/ui-framework/dataContext.ts`) so widgets
   * with bindings like `$player.hp` resolve to the running PIE
   * server's player record.
   *
   * Returns an empty `{}` when the session isn't running or the
   * player isn't yet spawned — `resolveWidgetProps` then falls back
   * to each widget's static props (the same behavior the production
   * client uses pre-spawn).
   *
   * Polled on each PIEHudOverlay render. The cost is bounded by
   * `world.entities.get(id)` being O(1) and the namespace build
   * being a few field copies; cheaper than the equivalent React
   * subscription chain would be at this scale.
   */
  getDataContext(): Record<string, unknown> {
    if (!this._running || !this._server || !this.player) return {};
    const player = this._server.world.entities?.get?.(
      this.player.id,
    ) as unknown as
      | {
          health?: { current?: number; max?: number };
          stats?: {
            health?: { current?: number; max?: number };
            prayer?: { current?: number; max?: number };
            combatLevel?: number;
          };
          position?: { x?: number; y?: number; z?: number };
          inCombat?: boolean;
        }
      | undefined;
    if (!player) return {};

    const hp =
      player.health?.current ?? player.stats?.health?.current ?? undefined;
    const maxHp = player.health?.max ?? player.stats?.health?.max ?? undefined;
    const prayer = player.stats?.prayer?.current;
    const maxPrayer = player.stats?.prayer?.max;

    return {
      player: {
        hp,
        maxHp,
        prayer,
        maxPrayer,
        combatLevel: player.stats?.combatLevel,
        inCombat: player.inCombat,
      },
    };
  }

  /** Teardown. Symmetric to `start()`. Safe to call multiple times. */
  async stop(): Promise<void> {
    if (!this._running) return;
    this._running = false;

    // Detach controllers + shims (idempotent; matches PlayTestWorld).
    this._playerController?.detach();
    this._cameraController?.detach();
    this._routerShim?.dispose();
    this._orbitShim?.dispose();
    // Real InteractionRouter (when active) — destroy unbinds canvas
    // events and tears down the visual feedback / highlight services.
    if (this._interactionRouter) {
      try {
        this._interactionRouter.destroy();
      } catch (err) {
        console.warn(
          "[PIEEditorSession] InteractionRouter.destroy threw:",
          err,
        );
      }
      this._interactionRouter = null;
    }
    this._playerController = null;
    this._cameraController = null;
    this._routerShim = null;
    this._orbitShim = null;
    this._pawn = null;
    this._camera = null;
    this.systems.clear();

    // Stop client plugin session before the client world tears down so
    // plugin disposers can still reach the world bus / registry.
    if (this._clientPluginSession) {
      try {
        await this._clientPluginSession.stop();
      } catch (err) {
        console.warn("[PIEEditorSession] client plugin stop threw:", err);
      }
      this._clientPluginSession = null;
    }

    // Tear down the client world first so its close propagates cleanly
    // through the loopback to the server's SocketManager.handleDisconnect.
    if (this._clientWorld) {
      const network = (
        this._clientWorld as unknown as {
          network: ClientNetwork;
        }
      ).network;
      network.destroy();
      this._clientWorld = null;
    }
    this._clientAdapter = null;

    // Stop server plugin session before the server world tears down —
    // same reasoning as client side. Stopping after `server.stop()`
    // would mean plugin disposers run against a dead world.
    if (this._serverPluginSession) {
      try {
        await this._serverPluginSession.stop();
      } catch (err) {
        console.warn("[PIEEditorSession] server plugin stop threw:", err);
      }
      this._serverPluginSession = null;
    }

    // Now stop the server session.
    if (this._server) {
      await this._server.stop();
      this._server = null;
    }

    this.entities.clear();
    this.player = null;
    this.gameMode = null;

    // Debug-sink listener tears down with the server world, but the
    // detach function is held here so tests that stop/restart don't leak.
    if (this._debugSinkDetach) {
      this._debugSinkDetach();
      this._debugSinkDetach = null;
    }
    this._tickCount = 0;
  }

  // ---- manifest hot-reload ---------------------------------------------

  /**
   * Push manifest edits from the editor into this running PIE session
   * without a Stop → Play cycle.
   *
   * B3.1 supports `prayers` and `tierRequirements` — both are pure
   * data-lookup kinds with no scene entities to despawn/respawn. Future
   * kinds (recipes, items, combat spells, runes, NPCs, stations, mob
   * spawns) will be layered in as providers gain re-subscribe support.
   *
   * No-ops when the session is not running. Throws if any provided
   * manifest fails schema validation; the previous manifest state is
   * retained in that case.
   */
  updateManifests(partial: {
    prayers?: PrayersManifest;
    tierRequirements?: TierRequirementsManifest;
    recipes?: {
      cooking?: CookingManifest;
      firemaking?: FiremakingManifest;
      smelting?: SmeltingManifest;
      smithing?: SmithingManifest;
      crafting?: CraftingManifest;
      tanning?: TanningManifest;
      fletching?: FletchingManifest;
      runecrafting?: RunecraftingManifest;
    };
    items?: Array<{
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

      // Combat-stat fields — optional partial for combat-balance
      // hot-reload. `DataManager.hotReloadItemsMetadata` preserves
      // the existing field when a key is omitted, so editors that
      // only touch metadata never have to pass combat data.
      weaponType?: Item["weaponType"];
      attackType?: Item["attackType"];
      attackSpeed?: number;
      attackRange?: number;
      is2h?: boolean;
      equipSlot?: Item["equipSlot"];
      equipable?: boolean;
      bonuses?: Item["bonuses"];
      requirements?: Item["requirements"];

      // Consumable / prayer fields.
      healAmount?: number;
      prayerXp?: number;
      buryLevelRequired?: number;
    }>;
    runes?: RunesManifest;
    spells?: CombatSpellsManifest;
    woodcutting?: WoodcuttingManifest;
    mining?: MiningManifest;
    fishing?: FishingManifest;
    skillUnlocks?: SkillUnlocksManifest;
    npcSizes?: NPCSizesManifest;
    npcDefinitions?: NpcDefinitionsManifest;
    ammunition?: AmmunitionManifest;
    stores?: StoreData[];
    lootTables?: LootTablesManifest;
    mobLootTableMappings?: Record<string, string>;
    dialogue?: DialogueManifest;
    npcDialogueBindings?: Record<string, string>;
    /**
     * Authored `DialogueConditionBindingsManifest`. On hot-reload,
     * previously-installed authored bindings are unregistered and the
     * new list is installed atomically. Passing `null` clears every
     * authored binding without installing a replacement (plugin-
     * registered predicates survive). Passing `undefined` leaves the
     * current authored bindings untouched.
     */
    dialogueConditionBindings?: DialogueConditionBindingsManifest | null;
    combatTuning?: CombatTuningManifest | null;
    combatTuningAgentBindings?: Record<string, string | null>;
    // Localization payload — accepts either a full bundle (base +
    // locales[]) or a flat array of per-locale manifests. Passing
    // `null` detaches the catalog so authored textKeys echo raw
    // again. Applied to the live `DialogueSystem`; authored dialogue
    // lines resolve through this catalog on the next emit.
    localization?: LocalizationBundle | LocalizationManifest[] | null;
    // Boot-load-only persistence tees. No live-dispatch seam yet —
    // the legacy runtime systems still read through their own
    // data providers. These fields exist so editor edits survive
    // a server restart: the next SystemLoader cold boot will pick
    // up the manifest the editor last pushed.
    npcs?: NpcsManifest;
    quests?: QuestsManifest;
    pluginRegistry?: PluginRegistryManifest;
    worldAreas?: WorldAreasManifest;
    worldConfig?: WorldConfigManifest;
    damageTypes?: DamageTypesManifest;
    npcSchedule?: NpcScheduleManifest;
    xpCurves?: XpCurvesManifest;
    renderProfiles?: RenderProfileManifest;
    sfx?: SoundEffectManifest;
    vfx?: VfxManifest;
    animations?: AnimationManifest;
    cameraProfiles?: CameraProfilesManifest;
    audioBusMix?: AudioBusMixManifest;
    interactionPrompts?: InteractionPromptsManifest;
    chatChannels?: ChatChannelsManifest;
    musicStateMachine?: MusicStateMachineManifest;
    timeWeather?: TimeWeatherManifest;
    achievements?: AchievementsManifest;
    factions?: FactionsManifest;
    mounts?: MountsManifest;
    petCompanion?: PetCompanionManifest;
    statusEffects?: StatusEffectsManifest;
    enchantments?: EnchantmentsManifest;
    titles?: TitlesManifest;
    leaderboards?: LeaderboardsManifest;
    mail?: MailManifest;
    seasons?: SeasonsManifest;
    worldEvents?: WorldEventsManifest;
    skyboxAtmosphere?: SkyboxAtmosphereManifest;
    particleGraph?: ParticleGraphManifest;
    voiceChat?: VoiceChatManifest;
    partyGuild?: PartyGuildManifest;
    navMesh?: NavMeshManifest;
    lightingBake?: LightingBakeManifest;
    levelStreaming?: LevelStreamingManifest;
    prefab?: PrefabManifest;
    cinematic?: CinematicManifest;
    postProcessVolumes?: PostProcessVolumeManifest;
    accessibility?: AccessibilityManifest;
    featureFlags?: FeatureFlagsManifest;
    physicsConfig?: PhysicsConfigManifest;
    respawn?: RespawnManifest;
    talentTrees?: TalentTreesManifest;
    auctionHouse?: AuctionHouseManifest;
    crashReporter?: CrashReporterManifest;
    pushNotifications?: PushNotificationsManifest;
    licenseAgreements?: LicenseAgreementsManifest;
    moderation?: ModerationManifest;
    parentalControls?: ParentalControlsManifest;
    fastTravel?: FastTravelManifest;
    friendsSocial?: FriendsSocialManifest;
    housing?: HousingManifest;
    loadouts?: LoadoutsManifest;
    avatars?: AvatarsManifest;
    playerEmotes?: PlayerEmotesManifest;
    spellVisuals?: SpellVisualsManifest;
    skillIcons?: SkillIconsManifest;
    commerce?: CommerceManifest;
    storeFront?: StoreFrontManifest;
    onboardingGoals?: OnboardingGoalsManifest;
    credits?: CreditsManifest;
    mainMenu?: MainMenuManifest;
    tooltips?: TooltipsManifest;
    keyPromptIcons?: KeyPromptIconsManifest;
    loadingScreens?: LoadingScreensManifest;
    haptics?: HapticsManifest;
    tutorialFlows?: TutorialFlowsManifest;
    inputActions?: InputActionsManifest;
    weaponStyles?: WeaponStylesManifest;
    editorSnap?: EditorSnapManifest;
    projectSettings?: ProjectSettingsManifest;
    qualityPresets?: QualityPresetsManifest;
    deployTargets?: DeployTargetsManifest;
    profilerOverlay?: ProfilerOverlayManifest;
    replication?: ReplicationManifest;
    smithing?: SchemaSmithingManifest;
    processing?: SchemaProcessingManifest;
    banking?: SchemaBankingManifest;
    arenaLayout?: ArenaLayoutManifest;
    lodSettings?: LODSettingsManifest;
    duel?: DuelManifest;
    tools?: ToolsManifest;
    trees?: TreeManifest;
    biomes?: BiomesManifest;
    vegetation?: VegetationManifest;
    trading?: TradingManifest;
    itemSets?: ItemSetsManifest;
    transmog?: TransmogManifest;
    economyTuning?: EconomyTuningManifest;
    interaction?: InteractionManifest;
    newsFeed?: NewsFeedManifest;
    buildings?: BuildingsManifest;
    screenshot?: ScreenshotManifest;
    serverBrowser?: ServerBrowserManifest;
    equipment?: EquipmentManifest;
    aiBehavior?: AIBehaviorManifest;
    matchmakingTuning?: MatchmakingTuningManifest;
    analyticsEvents?: AnalyticsEventManifest;
    groupFinder?: GroupFinderManifest;
    duelArenas?: DuelArenasManifest;
    combat?: CombatManifest;
    game?: GameManifest;
    gathering?: GatheringManifest;
    music?: MusicManifest;
    saveData?: SaveDataManifest;
    worldStructure?: WorldStructureManifest;
    stations?: StationsManifest;
    modelBounds?: ModelBoundsManifest;
  }): void {
    if (!this._running) return;
    if (partial.prayers) {
      prayerDataProvider.hotReload(partial.prayers);
    }
    if (partial.tierRequirements) {
      TierDataProvider.hotReload(partial.tierRequirements);
    }
    if (partial.recipes) {
      ProcessingDataProvider.getInstance().hotReload(partial.recipes);
    }
    if (partial.items) {
      dataManager.hotReloadItemsMetadata(partial.items);
    }
    if (partial.runes) {
      hotReloadRunes(partial.runes);
    }
    if (partial.spells) {
      hotReloadCombatSpells(partial.spells);
      // Persistence tee — restart-read through provider boot-load.
      combatSpellsProvider.hotReload(partial.spells);
    }
    if (partial.woodcutting) {
      // `loadWoodcuttingFromJson` Zod-validates so a malformed editor
      // edit throws cleanly instead of corrupting the live registry.
      gatheringResources.loadWoodcuttingFromJson(partial.woodcutting);
      woodcuttingProvider.hotReload(partial.woodcutting);
    }
    if (partial.mining) {
      gatheringResources.loadMiningFromJson(partial.mining);
      miningProvider.hotReload(partial.mining);
    }
    if (partial.skillUnlocks) {
      // `loadSkillUnlocks` safe-parses internally, clears the live
      // `loadedUnlocks` map, and re-populates it. Downstream callers go
      // through `getUnlocksForSkill(skill)` which reads through to the
      // mutated map so the hot-reload takes effect on the next query.
      loadSkillUnlocks(partial.skillUnlocks);
    }
    if (partial.npcDefinitions) {
      // Live-dispatch: refresh the module-level `npcDefinitionsRegistry`
      // so the registry-prefer branch in `getNPCById` honors authored
      // edits on the next call. Consumers (CombatSystem,
      // MobNPCSpawnerSystem, LootTableService, DialogueSystem, …)
      // pick up the new NPC catalog without a Stop → Play cycle.
      //
      // No persistence tee yet — when an NpcDefinitionsProvider lands
      // alongside the schema, append `npcDefinitionsProvider.hotReload`
      // here. Until then, edits are runtime-only and forgotten on
      // server restart (intentional — saves the editor user surprise
      // about a not-yet-persistent edit path).
      //
      // ALL_NPCS map is intentionally NOT cleared — it's the
      // boot-load fallback for when the registry is unloaded
      // (isolated unit tests, server boot before DataManager).
      // The registry-prefer-fallback contract handles the
      // staleness gracefully: registry wins when loaded.
      npcDefinitionsRegistry.load(partial.npcDefinitions);
    }
    if (partial.npcSizes) {
      // `hotReloadNPCSizes` Zod-validates then clears+rebuilds the
      // mutable `NPC_SIZES` record in-place — `RangeSystem`,
      // `LargeNPCSupport`, and any combat caller reading via
      // `NPC_SIZES[mobType]` picks up the new footprint on the next
      // lookup without re-importing the module.
      hotReloadNPCSizes(partial.npcSizes);
      // Live-dispatch: refresh the module-level `npcSizesRegistry` so
      // new tile-grid collision consumers built on the schema-derived
      // registry pick up authored NPC footprint edits this tick.
      // Persistence tee: `npcSizesProvider.hotReload` for cold boot.
      npcSizesRegistry.load(partial.npcSizes);
      npcSizesProvider.hotReload(partial.npcSizes);
    }
    if (partial.fishing) {
      gatheringResources.loadFishingFromJson(partial.fishing);
      fishingProvider.hotReload(partial.fishing);
    }
    if (partial.ammunition) {
      // `hotReloadAmmunition` Zod-validates then clears+rebuilds the
      // mutable `BOW_TIERS` / `ARROW_DATA` records in-place —
      // `AmmunitionService` reads via `ARROW_DATA[id]` /
      // `BOW_TIERS[id]` at lookup time so editor edits to bow tiers
      // or arrow strength take effect on the next ranged attack.
      hotReloadAmmunition(partial.ammunition);
    }
    if (partial.stores) {
      // `hotReloadStores` clears + re-populates the mutable
      // `GENERAL_STORES` record in-place. `ShopSystem` and the client
      // shop HUD both read through `getStoreById` / `GENERAL_STORES[id]`
      // at lookup time so pricing / stock / buyback edits take effect
      // the next time a player opens the shop.
      hotReloadStores(partial.stores);
      // Live-dispatch: refresh the module-level `storesRegistry` so
      // new shop UI consumers built on the schema-derived registry
      // pick up catalog edits this tick.
      // Persistence tee: `storesProvider.hotReload` for cold boot.
      storesRegistry.load(partial.stores as unknown as SchemaStoresManifest);
      storesProvider.hotReload(
        partial.stores as unknown as SchemaStoresManifest,
      );
    }
    if (partial.lootTables !== undefined || partial.mobLootTableMappings) {
      // `LootSystem.setAuthoredLootTables` swaps the inner
      // `LootTableRoller`'s table map in-place; `handleMobDeath`
      // prefers the authored roller when a mapping exists for the
      // dead mob's `mobType`, otherwise falls through to the legacy
      // `LootTableService` path.
      const lootSystem =
        (this._server?.world.getSystem("loot") as LootSystem | undefined) ??
        null;
      if (lootSystem) {
        if (partial.lootTables !== undefined) {
          lootSystem.setAuthoredLootTables(partial.lootTables);
        }
        if (partial.mobLootTableMappings) {
          lootSystem.setMobLootTableMappings(partial.mobLootTableMappings);
        }
      }
      // Persistence tee — write through to the providers so a
      // subsequent SystemLoader init (server restart, new world)
      // starts from the same authored manifest the editor is viewing.
      // Live dispatch above still reaches the running LootSystem.
      if (partial.lootTables !== undefined) {
        lootTablesProvider.hotReload(partial.lootTables);
      }
      if (partial.mobLootTableMappings) {
        mobLootTableMappingsProvider.hotReload(partial.mobLootTableMappings);
      }
    }
    if (partial.combatTuning !== undefined) {
      // `StreamingDuelScheduler` (server-only singleton — not a world
      // system) subscribes to this event on `init()` and forwards the
      // payload to `DuelOrchestrator.setAuthoredCombatTuning`. Shared
      // can't reach the scheduler directly, so the world event bus
      // is the decoupled seam.
      // Wrap in an object — World.emit coerces null → {} via `?? {}`
      // when the payload itself is nullish, which would silently drop
      // the "unload authored tuning" signal.
      this._server?.world.emit("combat:tuning:updated", {
        manifest: partial.combatTuning,
      });
      // Persistence tee — write through to the provider so a
      // subsequent SystemLoader/StreamingDuelScheduler init (server
      // restart, new world) starts from the same authored manifest
      // the editor is viewing. Live dispatch above still reaches the
      // running orchestrator; this path only feeds the boot-time seam.
      combatTuningProvider.hotReload(partial.combatTuning);
    }
    if (partial.combatTuningAgentBindings) {
      for (const [characterId, profileId] of Object.entries(
        partial.combatTuningAgentBindings,
      )) {
        this._server?.world.emit("combat:tuning:binding", {
          characterId,
          profileId,
        });
      }
      // Persistence tee: merge the live edits into the authored
      // bindings manifest so the next cold boot restores the same
      // overrides. `null` payload values stay in the manifest as
      // explicit-clear markers (the boot seam honors them).
      const current = combatTuningAgentBindingsProvider.getBindings();
      combatTuningAgentBindingsProvider.hotReload({
        ...current,
        ...partial.combatTuningAgentBindings,
      });
    }
    if (partial.dialogueConditionBindings !== undefined) {
      // Authored name → predicate bindings for DialogueSystem's
      // free-form `showIf`/`condition` registry. See
      // `WorldDialogueConditionEvaluators.ts` for the bridge to live
      // QuestSystem / InventorySystem / SkillsSystem reads.
      const dialogueSystem = this._server?.world.getSystem(
        "dialogue",
      ) as unknown as DialogueSystem | null;
      if (dialogueSystem && this._server) {
        const managed =
          this._managedDialogueConditions ??
          createManagedDialogueConditionInstall(
            dialogueSystem,
            this._server.world,
          );
        this._managedDialogueConditions = managed;
        if (partial.dialogueConditionBindings === null) {
          managed.clear();
        } else {
          managed.replace(partial.dialogueConditionBindings.bindings);
        }
        // Tee into the shared provider so a later SystemLoader run
        // (e.g. after a server restart) picks up the same authored
        // list the editor is looking at. Live dispatch still goes
        // through `managed` on this running world — the provider
        // write is only a persistence path for new worlds.
        dialogueConditionBindingsProvider.hotReload(
          partial.dialogueConditionBindings,
        );
      }
    }
    if (partial.dialogue !== undefined || partial.npcDialogueBindings) {
      // `DialogueSystem.setAuthoredDialogues` delegates to an inner
      // `DialogueRegistry` which validates each tree up front and
      // replaces the authored tree table atomically. Legacy
      // `NPCDialogueTree` data loaded from `npcs.json` is untouched;
      // authored trees coexist and are resolved by id via the
      // NPC → authored-tree-id binding table set below.
      const dialogueSystem = this._server?.world.getSystem(
        "dialogue",
      ) as unknown as DialogueSystem | null;
      if (dialogueSystem) {
        if (partial.dialogue !== undefined) {
          dialogueSystem.setAuthoredDialogues(partial.dialogue);
        }
        if (partial.npcDialogueBindings) {
          dialogueSystem.setAuthoredNpcDialogueBindings(
            partial.npcDialogueBindings,
          );
        }
      }
      // Persistence tee — write through to the providers so a
      // subsequent SystemLoader init (server restart, new world)
      // starts from the same authored manifests the editor is viewing.
      // Live dispatch above still reaches the running DialogueSystem.
      if (partial.dialogue !== undefined) {
        dialogueProvider.hotReload(partial.dialogue);
      }
      if (partial.npcDialogueBindings) {
        npcDialogueBindingsProvider.hotReload(partial.npcDialogueBindings);
      }
    }
    if (partial.localization !== undefined) {
      // Build (or tear down) the localization catalog and attach it to
      // `DialogueSystem`. Authored dialogue textKeys resolve through
      // the catalog on the next emit; when `null`, the catalog is
      // detached and dialogue text reverts to raw textKey echo.
      const dialogueSystem = this._server?.world.getSystem(
        "dialogue",
      ) as unknown as DialogueSystem | null;
      if (dialogueSystem) {
        if (partial.localization === null) {
          dialogueSystem.setLocalizationCatalog(null);
        } else {
          const catalog = new LocalizationCatalog(partial.localization);
          dialogueSystem.setLocalizationCatalog(catalog);
        }
      }
      // Persistence tee — write through to the provider so a
      // subsequent SystemLoader init starts from the same bundle the
      // editor is viewing. Only full `LocalizationBundle` shapes
      // persist (flat `LocalizationManifest[]` has no declared `base`
      // locale so it can't round-trip; the PIE flat-array path stays
      // a live-only convenience).
      if (partial.localization === null) {
        localizationProvider.hotReload(null);
      } else if (!Array.isArray(partial.localization)) {
        localizationProvider.hotReload(partial.localization);
      }
    }
    // Mixed-tier persistence tees. `npcs` + `quests` + `worldAreas` are
    // live-dispatch + tee (editor edits hit the running world AND persist).
    // `worldConfig` remains boot-load-only — `DataManager.setWorldConfig`
    // is typed against a legacy `WorldConfigManifest` that is structurally
    // incompatible with the schema-derived one (see the `worldConfig`
    // branch below).
    if (partial.npcs) {
      // `hotReloadNpcSpawnConstants` Zod-validates then rewrites the
      // mutable `NPC_SPAWN_CONSTANTS` record in-place. MobNPCSystem
      // reads via property lookup at spawn time, so the new
      // respawn/zone-cap/aggro values take effect on the next spawn
      // tick without needing a Stop → Play cycle.
      hotReloadNpcSpawnConstants(partial.npcs);
      npcsProvider.hotReload(partial.npcs);
    }
    if (partial.quests) {
      // Live-dispatch seam: `QuestSystem.setAuthoredQuests` clears
      // the `questDefinitions` map + stage caches and repopulates
      // from the manifest. Player quest progress is preserved;
      // stale cached active-quest lists are invalidated so the
      // next `getActiveQuests` query reflects the new definitions.
      // QuestSystem migrated to @hyperforge/hyperscape (2026-04-25);
      // PIE only needs to call its `setAuthoredQuests` setter.
      const questSystem =
        (this._server?.world.getSystem("quest") as unknown as
          | { setAuthoredQuests(manifest: Record<string, unknown>): void }
          | undefined) ?? null;
      questSystem?.setAuthoredQuests(partial.quests);
      questsProvider.hotReload(partial.quests);
    }
    if (partial.pluginRegistry) {
      // Persistence tee — plugin lifecycle is managed on world boot
      // by PluginHost/PluginCatalog construction, so there is no
      // live-dispatch seam for enable/disable mid-session yet. The
      // next cold boot re-reads the manifest through the provider.
      pluginRegistryProvider.hotReload(partial.pluginRegistry);
    }
    if (partial.worldAreas) {
      // Live-dispatch: refresh the module-level `worldAreasRegistry`
      // singleton in-place. `load()` clears the internal `_byId`
      // index and re-populates from the manifest — any future gameplay
      // consumer (town-spawning, zone AI) reads through `.get(id)` /
      // `.areaAt(x, z)` on this same instance and picks up edits on
      // the next lookup. Loud error path: `load()` throws on id
      // collision across categories, so malformed editor state
      // surfaces immediately instead of silently corrupting the
      // runtime view.
      worldAreasRegistry.load(partial.worldAreas);
      worldAreasProvider.hotReload(partial.worldAreas);
    }
    if (partial.worldConfig) {
      // Boot-load-only tee. `DataManager.setWorldConfig` is typed
      // against the legacy `WorldConfigManifest` in
      // `types/world/world-types.ts` (requires `version` + `seed`)
      // which is structurally incompatible with the schema-derived
      // `WorldConfigManifest` from `@hyperforge/manifest-schema`.
      // Live-dispatch requires reconciling the two types — follow-up.
      worldConfigProvider.hotReload(partial.worldConfig);
    }
    if (partial.damageTypes) {
      // Live-dispatch: refresh the module-level `damageTypeRegistry`
      // singleton in-place. `load()` clears the internal `_types` map
      // and resistance matrix and re-populates from the manifest. No
      // combat system consumes this registry yet — the wire is ahead
      // of the first consumer so PIE edits are already flowing when
      // CombatSystem (or a damage-handler strategy) starts resolving
      // typed multipliers through `damageTypeRegistry.resolveMultiplier`
      // / `applyDamage`.
      damageTypeRegistry.load(partial.damageTypes);
      damageTypesProvider.hotReload(partial.damageTypes);
    }
    if (partial.npcSchedule) {
      // Live-dispatch: refresh the module-level `npcScheduleRegistry`
      // so any NPC AI consumer that reads through it (once
      // `AgentBehaviorTicker` / goal-stack migration lands) picks up
      // the new schedule catalog on next tick.
      // Persistence tee: `npcScheduleProvider.hotReload` so cold boot
      // restart picks up the same authored edits.
      npcScheduleRegistry.load(partial.npcSchedule);
      npcScheduleProvider.hotReload(partial.npcSchedule);
    }
    if (partial.xpCurves) {
      // Live-dispatch: refresh the module-level `xpCurveRegistry`
      // so any progression consumer that reads through it picks up
      // the new curve definitions on next xp-to-level resolution.
      // Persistence tee: `xpCurvesProvider.hotReload` so cold boot
      // restart picks up the same authored edits.
      xpCurveRegistry.load(partial.xpCurves);
      xpCurvesProvider.hotReload(partial.xpCurves);
    }
    if (partial.renderProfiles) {
      // Live-dispatch: refresh the module-level `renderProfileRegistry`
      // so any renderer consumer that reads through it picks up the
      // new look on next frame.
      // Persistence tee: `renderProfilesProvider.hotReload` so cold
      // boot restart picks up the same authored edits.
      renderProfileRegistry.load(partial.renderProfiles);
      renderProfilesProvider.hotReload(partial.renderProfiles);
    }
    if (partial.sfx) {
      // Live-dispatch: refresh the module-level `sfxRegistry` so the
      // audio system picks up the new sfx definitions on next play.
      // Persistence tee: `soundEffectsProvider.hotReload` so cold boot
      // restart picks up the same authored edits.
      sfxRegistry.load(partial.sfx);
      soundEffectsProvider.hotReload(partial.sfx);
    }
    if (partial.vfx) {
      // Live-dispatch: refresh the module-level `vfxRegistry` so the
      // vfx spawner picks up the new effect definitions on next spawn.
      // Persistence tee: `vfxProvider.hotReload` so cold boot restart
      // picks up the same authored edits.
      vfxRegistry.load(partial.vfx);
      vfxProvider.hotReload(partial.vfx);
    }
    if (partial.animations) {
      // Live-dispatch: refresh the module-level `animationRegistry` so
      // AnimationSystem picks up new clip and binding definitions on
      // next rig resolve.
      // Persistence tee: `animationsProvider.hotReload` so cold boot
      // restart picks up the same authored edits.
      animationRegistry.load(partial.animations);
      animationsProvider.hotReload(partial.animations);
    }
    if (partial.cameraProfiles) {
      // Live-dispatch: refresh the module-level `cameraProfileRegistry`
      // so the camera component picks up the new rig tuning on next
      // profile resolve.
      // Persistence tee: `cameraProfilesProvider.hotReload` so cold
      // boot restart picks up the same authored edits.
      cameraProfileRegistry.load(partial.cameraProfiles);
      cameraProfilesProvider.hotReload(partial.cameraProfiles);
    }
    if (partial.audioBusMix) {
      // Live-dispatch: refresh the module-level `audioBusMixer` so the
      // audio transport applies the new bus graph + duck rules on next
      // `computeGains()` tick. `load()` also re-initializes duck
      // envelopes so any previous attenuation state is dropped.
      // Persistence tee: `audioBusMixProvider.hotReload` so cold boot
      // restart picks up the same authored edits.
      audioBusMixer.load(partial.audioBusMix);
      audioBusMixProvider.hotReload(partial.audioBusMix);
    }
    if (partial.interactionPrompts) {
      // Live-dispatch: refresh the module-level
      // `interactionPromptRegistry` so the HUD controller picks up the
      // new prompt definitions on next `select()` / `tick()` call.
      // Persistence tee: `interactionPromptsProvider.hotReload` so cold
      // boot restart picks up the same authored edits.
      interactionPromptRegistry.load(partial.interactionPrompts);
      interactionPromptsProvider.hotReload(partial.interactionPrompts);
    }
    if (partial.chatChannels) {
      // Live-dispatch: refresh the module-level `chatChannelRegistry`
      // so per-session `ChatRouter` instances read the new channel +
      // filter-rule catalog on next `send()`.
      // Persistence tee: `chatChannelsProvider.hotReload` so cold boot
      // restart picks up the same authored edits.
      chatChannelRegistry.load(partial.chatChannels);
      chatChannelsProvider.hotReload(partial.chatChannels);
    }
    if (partial.musicStateMachine) {
      // Live-dispatch: refresh the module-level
      // `musicStateMachineRegistry` so music drivers spin up from the
      // new FSM catalog on next controller creation.
      // Persistence tee: `musicStateMachineProvider.hotReload` so cold
      // boot restart picks up the same authored edits.
      musicStateMachineRegistry.load(partial.musicStateMachine);
      musicStateMachineProvider.hotReload(partial.musicStateMachine);
    }
    if (partial.timeWeather) {
      // Live-dispatch: refresh the module-level `timeWeatherDriver` so
      // the sky/weather runtime reads the new day/night keyframes +
      // weather FSM on next update(). `load()` re-seeds the driver's
      // current state + clears cooldowns so PIE edits don't carry
      // stale transition state across reloads.
      // Persistence tee: `timeWeatherProvider.hotReload` so cold boot
      // restart picks up the same authored edits.
      timeWeatherDriver.load(partial.timeWeather);
      timeWeatherProvider.hotReload(partial.timeWeather);
    }
    if (partial.achievements) {
      // Live-dispatch: refresh the module-level `achievementEvaluator`
      // so the awarder system reads the new achievement catalog +
      // event/stat reverse maps on next evaluate() call. Per-player
      // progress is caller-owned and unaffected.
      // Persistence tee: `achievementsProvider.hotReload` so cold boot
      // restart picks up the same authored edits.
      achievementEvaluator.load(partial.achievements);
      achievementsProvider.hotReload(partial.achievements);
    }
    if (partial.factions) {
      // Live-dispatch: refresh the module-level `factionsRegistry` so
      // the reputation runtime reads the new faction catalog +
      // relationship graph + tier bands on next lookup. Per-character
      // standings are unaffected.
      // Persistence tee: `factionsProvider.hotReload` so cold boot
      // restart picks up the same authored edits.
      factionsRegistry.load(partial.factions);
      factionsProvider.hotReload(partial.factions);
    }
    if (partial.mounts) {
      // Live-dispatch: refresh the module-level `mountRegistry` so
      // the mount/travel runtime reads the new mount catalog on next
      // summon. Per-summon stamina state lives in summon contexts and
      // is unaffected.
      // Persistence tee: `mountsProvider.hotReload` so cold boot
      // restart picks up the same authored edits.
      mountRegistry.load(partial.mounts);
      mountsProvider.hotReload(partial.mounts);
    }
    if (partial.petCompanion) {
      // Live-dispatch: refresh the module-level `petRegistry` so the
      // pet system reads the new pet catalog on next summon. Per-pet
      // summon contexts live per-character and are unaffected.
      // Persistence tee: `petCompanionProvider.hotReload` so cold boot
      // restart picks up the same authored edits.
      petRegistry.load(partial.petCompanion);
      petCompanionProvider.hotReload(partial.petCompanion);
    }
    if (partial.statusEffects) {
      // Live-dispatch: refresh the module-level `statusEffectRegistry`
      // so the effect system reads the new catalog + tag reverse map
      // on next apply/cleanse. Per-target effect instances are
      // unaffected.
      // Persistence tee: `statusEffectsProvider.hotReload` so cold boot
      // restart picks up the same authored edits.
      statusEffectRegistry.load(partial.statusEffects);
      statusEffectsProvider.hotReload(partial.statusEffects);
    }
    if (partial.enchantments) {
      // Live-dispatch: refresh the module-level `enchantmentRegistry`
      // so the enchantment system reads the new catalog on next
      // apply. Per-item applied enchantments are unaffected.
      // Persistence tee: `enchantmentsProvider.hotReload` so cold boot
      // restart picks up the same authored edits.
      enchantmentRegistry.load(partial.enchantments);
      enchantmentsProvider.hotReload(partial.enchantments);
    }
    if (partial.titles) {
      // Live-dispatch: refresh the module-level `titleRegistry` so
      // unlock evaluation + nameplate formatting read the new catalog
      // on next query. Per-player owned/active title sets are
      // caller-owned and unaffected.
      // Persistence tee: `titlesProvider.hotReload` so cold boot
      // restart picks up the same authored edits.
      titleRegistry.load(partial.titles);
      titlesProvider.hotReload(partial.titles);
    }
    if (partial.leaderboards) {
      // Live-dispatch: refresh the module-level `leaderboardEngine`
      // so eligibility + ranking read the new catalog on next
      // submission / query. Submitted scores are owned by
      // LeaderboardSystem and unaffected.
      // Persistence tee: `leaderboardsProvider.hotReload` so cold
      // boot restart picks up the same authored edits.
      leaderboardEngine.load(partial.leaderboards);
      leaderboardsProvider.hotReload(partial.leaderboards);
    }
    if (partial.mail) {
      // Live-dispatch: swap the module-level `mailPolicyRegistry`'s
      // single policy so postage / CoD / retention / rate-limit
      // checks read the new policy on next query. Per-player inbox
      // state is owned by MailSystem and unaffected.
      // Persistence tee: `mailProvider.hotReload` so cold boot
      // restart picks up the same authored edits.
      mailPolicyRegistry.load(partial.mail);
      mailProvider.hotReload(partial.mail);
    }
    if (partial.seasons) {
      // Live-dispatch: refresh the module-level `seasonRegistry` so
      // tier progression reads the new catalog on next query. Per-
      // player battle pass progress is owned by SeasonSystem and
      // unaffected.
      // Persistence tee: `seasonsProvider.hotReload` for cold boot.
      seasonRegistry.load(partial.seasons);
      seasonsProvider.hotReload(partial.seasons);
    }
    if (partial.worldEvents) {
      // Live-dispatch: refresh the module-level `worldEventsRegistry`
      // so FATE/public-event eligibility + phase lookup read the new
      // catalog on next query. Active event state is owned by
      // WorldEventSystem and unaffected.
      // Persistence tee: `worldEventsProvider.hotReload` for cold boot.
      worldEventsRegistry.load(partial.worldEvents);
      worldEventsProvider.hotReload(partial.worldEvents);
    }
    if (partial.skyboxAtmosphere) {
      // Live-dispatch: refresh the module-level
      // `skyboxAtmosphereRegistry` so SkyboxSystem reads the new
      // catalog + active-skybox selector on next render frame.
      // Persistence tee: `skyboxAtmosphereProvider.hotReload` for
      // cold boot.
      skyboxAtmosphereRegistry.load(partial.skyboxAtmosphere);
      skyboxAtmosphereProvider.hotReload(partial.skyboxAtmosphere);
    }
    if (partial.particleGraph) {
      // Live-dispatch: refresh the module-level
      // `particleGraphRegistry` so the VFX spawner reads the new
      // particle-system catalog on next spawn request. Spawned
      // instances are owned by the VFX runtime and unaffected.
      // Persistence tee: `particleGraphProvider.hotReload` for
      // cold boot.
      particleGraphRegistry.load(partial.particleGraph);
      particleGraphProvider.hotReload(partial.particleGraph);
    }
    if (partial.voiceChat) {
      // Live-dispatch: refresh the module-level `voiceChatRegistry`
      // so join-eligibility + falloff + auto-mute rules read the
      // new policy on next query. Active LiveKit sessions are
      // owned by VoiceChatSystem and unaffected.
      // Persistence tee: `voiceChatProvider.hotReload` for cold boot.
      voiceChatRegistry.load(partial.voiceChat);
      voiceChatProvider.hotReload(partial.voiceChat);
    }
    if (partial.partyGuild) {
      // Live-dispatch: refresh the module-level `partyGuildRegistry`
      // so party loot/xp + guild rank/perk rules read the new policy
      // on next query. Active parties/guilds are owned by
      // PartyManager + GuildRegistry runtime and unaffected.
      // Persistence tee: `partyGuildProvider.hotReload` for cold boot.
      partyGuildRegistry.load(partial.partyGuild);
      partyGuildProvider.hotReload(partial.partyGuild);
    }
    if (partial.navMesh) {
      // Live-dispatch: refresh the module-level `navMeshRegistry` so
      // voxelizer/agent/modifier lookups read the new policy on next
      // query. Any baked nav data is owned by the runtime pathfinder
      // and unaffected — the next bake will use the new settings.
      // Persistence tee: `navMeshProvider.hotReload` for cold boot.
      navMeshRegistry.load(partial.navMesh);
      navMeshProvider.hotReload(partial.navMesh);
    }
    if (partial.lightingBake) {
      // Live-dispatch: refresh the module-level `lightingBakeRegistry`
      // so per-sublevel overrides + lightprobe-volume rules read the
      // new policy on next query. The baked lightmap/probe data itself
      // is owned by the offline baker + runtime renderer and unaffected.
      // Persistence tee: `lightingBakeProvider.hotReload` for cold boot.
      lightingBakeRegistry.load(partial.lightingBake);
      lightingBakeProvider.hotReload(partial.lightingBake);
    }
    if (partial.prefab) {
      // Live-dispatch: refresh the module-level `prefabRegistry` so
      // downstream entity-spawn systems see authored edits immediately.
      // Persistence tee: `prefabProvider.hotReload` for cold boot.
      prefabRegistry.load(partial.prefab);
      prefabProvider.hotReload(partial.prefab);
    }
    if (partial.cinematic) {
      // Live-dispatch: refresh the module-level `cinematicRegistry` so
      // the sequencer resolves authored tracks immediately.
      // Persistence tee: `cinematicProvider.hotReload` for cold boot.
      cinematicRegistry.load(partial.cinematic);
      cinematicProvider.hotReload(partial.cinematic);
    }
    if (partial.postProcessVolumes) {
      // Live-dispatch: refresh the module-level
      // `postProcessVolumeCompositor` so the renderer composes the
      // authored volume set immediately.
      // Persistence tee: `postProcessVolumesProvider.hotReload` for cold boot.
      postProcessVolumeCompositor.load(partial.postProcessVolumes);
      postProcessVolumesProvider.hotReload(partial.postProcessVolumes);
    }
    if (partial.accessibility) {
      // Live-dispatch: refresh the module-level `accessibilitySettings`
      // so HUD/input-assistance/motion-sensitivity systems see the
      // authored policy immediately.
      // Persistence tee: `accessibilityProvider.hotReload` for cold boot.
      accessibilitySettings.load(partial.accessibility);
      accessibilityProvider.hotReload(partial.accessibility);
    }
    if (partial.featureFlags) {
      // Live-dispatch: refresh the module-level `featureFlagRegistry`
      // so gameplay gating + remote-config bridges evaluate against the
      // authored flag graph immediately.
      // Persistence tee: `featureFlagsProvider.hotReload` for cold boot.
      featureFlagRegistry.load(partial.featureFlags);
      featureFlagsProvider.hotReload(partial.featureFlags);
    }
    if (partial.physicsConfig) {
      // Live-dispatch: refresh the module-level `physicsConfigRegistry`
      // so the physics world re-indexes materials/layers/tuning on the
      // next rebuild.
      // Persistence tee: `physicsConfigProvider.hotReload` for cold boot.
      physicsConfigRegistry.load(partial.physicsConfig);
      physicsConfigProvider.hotReload(partial.physicsConfig);
    }
    if (partial.respawn) {
      // Live-dispatch: refresh the module-level `respawnPolicyResolver`
      // so CharacterService/RespawnSystem consume authored bind-point +
      // death-penalty + corpse-run + resurrection policy immediately.
      // Persistence tee: `respawnProvider.hotReload` for cold boot.
      respawnPolicyResolver.load(partial.respawn);
      respawnProvider.hotReload(partial.respawn);
    }
    if (partial.talentTrees) {
      // Live-dispatch: refresh the module-level `talentTreeRegistry`
      // so TalentTreeSystem re-indexes tree/node/prereq-graph for live
      // allocation queries immediately.
      // Persistence tee: `talentTreesProvider.hotReload` for cold boot.
      talentTreeRegistry.load(partial.talentTrees);
      talentTreesProvider.hotReload(partial.talentTrees);
    }
    if (partial.auctionHouse) {
      // Live-dispatch: refresh the module-level `auctionHouseRegistry`
      // so AuctionHouseSystem consumes authored listing/bidding/fee/
      // anti-manipulation policy immediately.
      // Persistence tee: `auctionHouseProvider.hotReload` for cold boot.
      auctionHouseRegistry.load(partial.auctionHouse);
      auctionHouseProvider.hotReload(partial.auctionHouse);
    }
    if (partial.crashReporter) {
      // Live-dispatch: refresh the module-level `crashReporterRegistry`
      // so CrashReporterSystem picks up sink/redaction/symbolication
      // policy on the next crash-flush cycle.
      // Persistence tee: `crashReporterProvider.hotReload` for cold boot.
      crashReporterRegistry.load(partial.crashReporter);
      crashReporterProvider.hotReload(partial.crashReporter);
    }
    if (partial.pushNotifications) {
      // Live-dispatch: refresh the module-level `pushNotificationsRegistry`
      // so PushNotificationsSystem re-indexes channels/categories +
      // quiet-hours on the next scheduler tick.
      // Persistence tee: `pushNotificationsProvider.hotReload` for cold boot.
      pushNotificationsRegistry.load(partial.pushNotifications);
      pushNotificationsProvider.hotReload(partial.pushNotifications);
    }
    if (partial.licenseAgreements) {
      // Live-dispatch: refresh the module-level `licenseAgreementsRegistry`
      // so LegalConsentSystem re-gates acceptance flows against the
      // authored document set immediately.
      // Persistence tee: `licenseAgreementsProvider.hotReload` for cold boot.
      licenseAgreementsRegistry.load(partial.licenseAgreements);
      licenseAgreementsProvider.hotReload(partial.licenseAgreements);
    }
    if (partial.moderation) {
      // Live-dispatch: refresh the module-level `moderationRegistry`
      // so live ModerationSystem consumers see new authored policy.
      // Persistence tee: `moderationProvider.hotReload` for cold boot.
      moderationRegistry.load(partial.moderation);
      moderationProvider.hotReload(partial.moderation);
    }
    if (partial.parentalControls) {
      // Live-dispatch: refresh the module-level `parentalControlsRegistry`
      // so live ParentalControlsSystem consumers see new authored policy.
      // Persistence tee: `parentalControlsProvider.hotReload` for cold boot.
      parentalControlsRegistry.load(partial.parentalControls);
      parentalControlsProvider.hotReload(partial.parentalControls);
    }
    if (partial.fastTravel) {
      // Live-dispatch: refresh the module-level `fastTravelGraph` singleton
      // so live FastTravelSystem consumers see new authored nodes/edges.
      // Persistence tee: `fastTravelProvider.hotReload` for cold boot.
      fastTravelGraph.load(partial.fastTravel);
      fastTravelProvider.hotReload(partial.fastTravel);
    }
    if (partial.friendsSocial) {
      // Live-dispatch: refresh the module-level `friendsSocialRegistry`
      // so live SocialSystem consumers see new authored policy.
      // Persistence tee: `friendsSocialProvider.hotReload` for cold boot.
      friendsSocialRegistry.load(partial.friendsSocial);
      friendsSocialProvider.hotReload(partial.friendsSocial);
    }
    if (partial.housing) {
      // Live-dispatch: refresh the module-level `housingRegistry`
      // so live HousingSystem consumers see new authored plot policy.
      // Persistence tee: `housingProvider.hotReload` for cold boot.
      housingRegistry.load(partial.housing);
      housingProvider.hotReload(partial.housing);
    }
    if (partial.loadouts) {
      // Live-dispatch: refresh the module-level `loadoutPolicyRegistry`
      // so live LoadoutSystem consumers see new authored swap/save rules.
      // Persistence tee: `loadoutsProvider.hotReload` for cold boot.
      loadoutPolicyRegistry.load(partial.loadouts);
      loadoutsProvider.hotReload(partial.loadouts);
    }
    if (partial.avatars) {
      // Live-dispatch: refresh the module-level `avatarsRegistry` so
      // avatar-loading code picks up new LOD URLs / new avatar ids on
      // the next `.get(id)` / `.resolveForDistance(id, d)` lookup.
      // Persistence tee: `avatarsProvider.hotReload` for cold boot.
      avatarsRegistry.load(partial.avatars);
      avatarsProvider.hotReload(partial.avatars);
    }
    if (partial.playerEmotes) {
      // Live-dispatch: refresh the module-level `playerEmotesRegistry`
      // so EmoteSystem / player-animation runtime see authored
      // animation / cooldown edits on the next emote trigger.
      // Persistence tee: `playerEmotesProvider.hotReload` for cold boot.
      playerEmotesRegistry.load(partial.playerEmotes);
      playerEmotesProvider.hotReload(partial.playerEmotes);
    }
    if (partial.spellVisuals) {
      // Live-dispatch: refresh the module-level `spellVisualsRegistry`
      // so CombatSystem / VFX pipeline pick up new authored spell VFX
      // on the next cast.
      // Persistence tee: `spellVisualsProvider.hotReload` for cold boot.
      spellVisualsRegistry.load(partial.spellVisuals);
      spellVisualsProvider.hotReload(partial.spellVisuals);
    }
    if (partial.skillIcons) {
      // Live-dispatch: refresh `skillIconsRegistry` so HUD / skill
      // panel picks up authored icon/label edits on the next lookup.
      // Persistence tee: `skillIconsProvider.hotReload` for cold boot.
      skillIconsRegistry.load(partial.skillIcons);
      skillIconsProvider.hotReload(partial.skillIcons);
    }
    if (partial.commerce) {
      // Live-dispatch: refresh `commerceRegistry` so vendor UI / shop
      // resolvers pick up authored buyback / starter-store edits.
      // Persistence tee: `commerceProvider.hotReload` for cold boot.
      commerceRegistry.load(partial.commerce);
      commerceProvider.hotReload(partial.commerce);
    }
    if (partial.storeFront) {
      // Live-dispatch: refresh `storeFrontRegistry` so checkout UI /
      // catalog pick up authored bundle / tier / shelf / discount
      // edits on the next lookup.
      // Persistence tee: `storeFrontProvider.hotReload` for cold boot.
      storeFrontRegistry.load(partial.storeFront);
      storeFrontProvider.hotReload(partial.storeFront);
    }
    if (partial.onboardingGoals) {
      // Live-dispatch: refresh `onboardingGoalsRegistry` so new-player
      // HUD / tutorial advisor see authored goal-graph edits on the
      // next lookup.
      // Persistence tee: `onboardingGoalsProvider.hotReload` for cold boot.
      onboardingGoalsRegistry.load(partial.onboardingGoals);
      onboardingGoalsProvider.hotReload(partial.onboardingGoals);
    }
    if (partial.credits) {
      // Live-dispatch: refresh `creditsRegistry` so the end-game /
      // main-menu credits screen picks up authored section / entry
      // edits on the next render.
      // Persistence tee: `creditsProvider.hotReload` for cold boot.
      creditsRegistry.load(partial.credits);
      creditsProvider.hotReload(partial.credits);
    }
    if (partial.mainMenu) {
      // Live-dispatch: refresh `mainMenuRegistry` so pre-game / pause
      // menu picks up authored menu-tree edits on the next render.
      // Persistence tee: `mainMenuProvider.hotReload` for cold boot.
      mainMenuRegistry.load(partial.mainMenu);
      mainMenuProvider.hotReload(partial.mainMenu);
    }
    if (partial.tooltips) {
      // Live-dispatch: refresh `tooltipRegistry` so the HUD tooltip
      // layer picks up authored entry + trigger/placement/delay edits
      // on the next hover or focus.
      // Persistence tee: `tooltipsProvider.hotReload` for cold boot.
      tooltipRegistry.load(partial.tooltips);
      tooltipsProvider.hotReload(partial.tooltips);
    }
    if (partial.keyPromptIcons) {
      // Live-dispatch: refresh `keyPromptGlyphRegistry` so button-
      // prompt HUD picks up authored device-family + per-glyph edits
      // on the next lookup.
      // Persistence tee: `keyPromptIconsProvider.hotReload` for cold boot.
      keyPromptGlyphRegistry.load(partial.keyPromptIcons);
      keyPromptIconsProvider.hotReload(partial.keyPromptIcons);
    }
    if (partial.loadingScreens) {
      // Live-dispatch: refresh `loadingScreensRegistry` so the loading-
      // screen UI picks up authored slate + fade-rule edits on the next
      // zone transition.
      // Persistence tee: `loadingScreensProvider.hotReload` for cold boot.
      loadingScreensRegistry.load(partial.loadingScreens);
      loadingScreensProvider.hotReload(partial.loadingScreens);
    }
    if (partial.haptics) {
      // Live-dispatch: refresh `hapticsRegistry` so the input pipeline
      // picks up authored controller/mobile rumble pattern edits on the
      // next trigger.
      // Persistence tee: `hapticsProvider.hotReload` for cold boot.
      hapticsRegistry.load(partial.haptics);
      hapticsProvider.hotReload(partial.haptics);
    }
    if (partial.tutorialFlows) {
      // Live-dispatch: refresh `tutorialFlowsRegistry` so the tutorial
      // runner picks up authored flow / step / trigger edits on the
      // next flow-start check.
      // Persistence tee: `tutorialFlowsProvider.hotReload` for cold boot.
      tutorialFlowsRegistry.load(partial.tutorialFlows);
      tutorialFlowsProvider.hotReload(partial.tutorialFlows);
    }
    if (partial.inputActions) {
      // Live-dispatch: refresh `inputActionsRegistry` so the input
      // pipeline / rebinding UI picks up authored author-side default-
      // binding edits on the next rebind-panel open or binding resolve.
      // Persistence tee: `inputActionsProvider.hotReload` for cold boot.
      inputActionsRegistry.load(partial.inputActions);
      inputActionsProvider.hotReload(partial.inputActions);
    }
    if (partial.skillUnlocks) {
      // Live-dispatch: refresh `skillUnlocksRegistry` so the level-up
      // popup pipeline picks up authored skill-milestone edits on the
      // next skill-up fanout.
      // Persistence tee: `skillUnlocksProvider.hotReload` for cold boot.
      skillUnlocksRegistry.load(partial.skillUnlocks);
      skillUnlocksProvider.hotReload(partial.skillUnlocks);
    }
    if (partial.weaponStyles) {
      // Live-dispatch: refresh `weaponStylesRegistry` so combat picks
      // up authored weapon→style whitelist edits on the next style-
      // pick prompt.
      // Persistence tee: `weaponStylesProvider.hotReload` for cold boot.
      weaponStylesRegistry.load(partial.weaponStyles);
      weaponStylesProvider.hotReload(partial.weaponStyles);
    }
    if (partial.ammunition) {
      // Live-dispatch: refresh `ammunitionRegistry` so ranged combat
      // picks up authored bow/arrow tier + compatibility edits on the
      // next shot-gate resolution.
      // Persistence tee: `ammunitionProvider.hotReload` for cold boot.
      ammunitionRegistry.load(partial.ammunition);
      ammunitionProvider.hotReload(partial.ammunition);
    }
    if (partial.editorSnap) {
      // Live-dispatch: refresh `editorSnapRegistry` so the editor
      // transform pipeline picks up authored grid/surface/gizmo snap
      // edits on the next gizmo drag.
      // Persistence tee: `editorSnapProvider.hotReload` for cold boot.
      editorSnapRegistry.load(partial.editorSnap);
      editorSnapProvider.hotReload(partial.editorSnap);
    }
    if (partial.projectSettings) {
      // Live-dispatch: refresh `projectSettingsRegistry` so the
      // runtime picks up authored project-level config edits
      // (game mode, seed, locale, default scheme, plugins) on the
      // next read.
      // Persistence tee: `projectSettingsProvider.hotReload` for cold boot.
      projectSettingsRegistry.load(partial.projectSettings);
      projectSettingsProvider.hotReload(partial.projectSettings);
    }
    if (partial.qualityPresets) {
      // Live-dispatch: refresh `qualityPresetsRegistry` so the
      // renderer picks up authored quality-tier edits on the next
      // preset switch.
      // Persistence tee: `qualityPresetsProvider.hotReload` for cold boot.
      qualityPresetsRegistry.load(partial.qualityPresets);
      qualityPresetsProvider.hotReload(partial.qualityPresets);
    }
    if (partial.deployTargets) {
      // Live-dispatch: refresh `deployTargetsRegistry` so the editor
      // Deploy panel picks up authored deploy-target edits on the
      // next open. Values are secret-name refs only — no real secrets.
      // Persistence tee: `deployTargetsProvider.hotReload` for cold boot.
      deployTargetsRegistry.load(partial.deployTargets);
      deployTargetsProvider.hotReload(partial.deployTargets);
    }
    if (partial.profilerOverlay) {
      // Live-dispatch: refresh `profilerOverlayRegistry` so the
      // profiler HUD picks up authored metric + threshold-band edits
      // on the next render tick.
      // Persistence tee: `profilerOverlayProvider.hotReload` for cold boot.
      profilerOverlayRegistry.load(partial.profilerOverlay);
      profilerOverlayProvider.hotReload(partial.profilerOverlay);
    }
    if (partial.smithing) {
      // Live-dispatch: refresh the module-level `smithingRegistry` so
      // authored smithing tuning (hammer/coal ids, smelting ticks,
      // per-bar tier ladders) is visible to SmithingSystem this tick.
      // Persistence tee: `smithingProvider.hotReload` for cold boot.
      smithingRegistry.load(partial.smithing);
      smithingProvider.hotReload(partial.smithing);
    }
    if (partial.processing) {
      // Live-dispatch: refresh the module-level `processingRegistry`
      // so authored firemaking/cooking mechanics tuning is visible to
      // the runtime ProcessingSystem this tick.
      // Persistence tee: `processingProvider.hotReload` for cold boot.
      processingRegistry.load(partial.processing);
      processingProvider.hotReload(partial.processing);
    }
    if (partial.banking) {
      // Live-dispatch: refresh the module-level `bankingRegistry` so
      // authored bank sizes + UI layout + equipment bundles are
      // visible to the BankingSystem this tick.
      // Persistence tee: `bankingProvider.hotReload` for cold boot.
      bankingRegistry.load(partial.banking);
      bankingProvider.hotReload(partial.banking);
    }
    if (partial.arenaLayout) {
      // Live-dispatch: refresh the module-level `arenaLayoutRegistry`
      // so duel placement/zoning reads authored arena grid + lobby +
      // hospital geometry on the next authority resolve.
      // Persistence tee: `arenaLayoutProvider.hotReload` for cold boot.
      arenaLayoutRegistry.load(partial.arenaLayout);
      arenaLayoutProvider.hotReload(partial.arenaLayout);
    }
    if (partial.lodSettings) {
      // Live-dispatch: refresh the module-level `lodSettingsRegistry`
      // so the renderer LOD compositor picks up distance-threshold
      // and dissolve-rule edits on the next authority resolve.
      // Persistence tee: `lodSettingsProvider.hotReload` for cold boot.
      lodSettingsRegistry.load(partial.lodSettings);
      lodSettingsProvider.hotReload(partial.lodSettings);
    }
    if (partial.duel) {
      // Live-dispatch: refresh the module-level `duelRulesRegistry`
      // so the duel request/accept flow picks up authored rule toggles
      // + challenge timeout + slot ordering on the next challenge.
      // Persistence tee: `duelProvider.hotReload` for cold boot.
      duelRulesRegistry.load(partial.duel);
      duelProvider.hotReload(partial.duel);
    }
    if (partial.tools) {
      // Live-dispatch: refresh the module-level `toolsRegistry` so
      // gathering systems (woodcutting, mining, fishing) pick up
      // authored tool catalog edits (level reqs, priority, bonuses)
      // on the next best-tool resolve.
      // Persistence tee: `toolsProvider.hotReload` for cold boot.
      toolsRegistry.load(partial.tools);
      toolsProvider.hotReload(partial.tools);
    }
    if (partial.trees) {
      // Live-dispatch: refresh the module-level `treeCatalogRegistry`
      // so gathering systems (woodcutting) pick up authored tree
      // catalog edits (level reqs + logs + XP + respawn) on the next
      // resource resolve.
      // Persistence tee: `treesProvider.hotReload` for cold boot.
      treeCatalogRegistry.load(partial.trees);
      treesProvider.hotReload(partial.trees);
    }
    if (partial.biomes) {
      // Live-dispatch: refresh the module-level `biomesRegistry` so
      // procgen/terrain classification (difficulty + height + tags)
      // picks up authored biome edits on the next terrain query.
      // Persistence tee: `biomesProvider.hotReload` for cold boot.
      biomesRegistry.load(partial.biomes);
      biomesProvider.hotReload(partial.biomes);
    }
    if (partial.vegetation) {
      // Live-dispatch: refresh the module-level `vegetationRegistry`
      // so procgen/vegetation population picks up authored asset
      // refs + density + placement edits on the next spawn.
      // Persistence tee: `vegetationProvider.hotReload` for cold boot.
      vegetationRegistry.load(partial.vegetation);
      vegetationProvider.hotReload(partial.vegetation);
    }
    if (partial.trading) {
      // Live-dispatch: refresh `tradingRegistry` so the trade flow
      // (session/items/currency/eligibility/rateLimit/antiRmt) picks up
      // authored policy edits on the next trade-request evaluation.
      // Persistence tee: `tradingProvider.hotReload` for cold boot.
      tradingRegistry.load(partial.trading);
      tradingProvider.hotReload(partial.trading);
    }
    if (partial.itemSets) {
      // Live-dispatch: refresh `itemSetRegistry` so the equipment/
      // combat loop picks up authored set-bonus tier ladders +
      // triggered effects on the next equip resolve.
      // Persistence tee: `itemSetsProvider.hotReload` for cold boot.
      itemSetRegistry.load(partial.itemSets);
      itemSetsProvider.hotReload(partial.itemSets);
    }
    if (partial.transmog) {
      // Live-dispatch: refresh `transmogRegistry` so the equipment
      // render layer picks up authored appearance sources + unlock
      // policy on the next appearance resolve.
      // Persistence tee: `transmogProvider.hotReload` for cold boot.
      transmogRegistry.load(partial.transmog);
      transmogProvider.hotReload(partial.transmog);
    }
    if (partial.economyTuning) {
      // Live-dispatch: refresh `economyTuningRegistry` so VendorSystem /
      // AuctionHouseSystem / RepairSystem resolve authored currency
      // catalog + vendor markups + market fees + cost curves on the
      // next economy event.
      // Persistence tee: `economyTuningProvider.hotReload` for cold boot.
      economyTuningRegistry.load(partial.economyTuning);
      economyTuningProvider.hotReload(partial.economyTuning);
    }
    if (partial.interaction) {
      // Live-dispatch: refresh `interactionConfigRegistry` so server-
      // side session types + interaction distances + transaction
      // rate limits + input-limit validators pick up authored values
      // on the next interaction event.
      // Persistence tee: `interactionProvider.hotReload` for cold boot.
      interactionConfigRegistry.load(partial.interaction);
      interactionProvider.hotReload(partial.interaction);
    }
    if (partial.newsFeed) {
      // Live-dispatch: refresh `newsFeedRegistry` so the NewsFeedSystem
      // resolves authored entries + categories + targeting + priority
      // ordering on the next visible-feed resolve.
      // Persistence tee: `newsFeedProvider.hotReload` for cold boot.
      newsFeedRegistry.load(partial.newsFeed);
      newsFeedProvider.hotReload(partial.newsFeed);
    }
    if (partial.buildings) {
      // Live-dispatch: refresh `buildingsRegistry` so world-gen /
      // settlement scatter resolve authored building catalog on next
      // generation pass.
      // Persistence tee: `buildingsProvider.hotReload` for cold boot.
      buildingsRegistry.load(partial.buildings);
      buildingsProvider.hotReload(partial.buildings);
    }
    if (partial.screenshot) {
      // Live-dispatch: refresh `screenshotRegistry` so photo-mode +
      // share-target catalog + watermark rules take effect on the
      // next capture.
      // Persistence tee: `screenshotProvider.hotReload` for cold boot.
      screenshotRegistry.load(partial.screenshot);
      screenshotProvider.hotReload(partial.screenshot);
    }
    if (partial.serverBrowser) {
      // Live-dispatch: refresh `serverBrowserRegistry` so Server
      // Browser UI picks up authored filter facets, columns, ping
      // buckets, and list rules on the next render.
      // Persistence tee: `serverBrowserProvider.hotReload` for cold boot.
      serverBrowserRegistry.load(partial.serverBrowser);
      serverBrowserProvider.hotReload(partial.serverBrowser);
    }
    if (partial.replication) {
      // Live-dispatch: refresh `replicationRegistry` so the netcode
      // delta-replicator picks up authored field/event edits on the
      // next authority resolve.
      // Persistence tee: `replicationProvider.hotReload` for cold boot.
      replicationRegistry.load(partial.replication);
      replicationProvider.hotReload(partial.replication);
    }
    if (partial.levelStreaming) {
      // Live-dispatch: refresh the module-level `levelStreamingRegistry`
      // so sublevel policies + trigger volumes + dependency graph are
      // read on next streamer tick. Currently-loaded sublevels are
      // owned by the runtime streamer and remain loaded until policy
      // dictates otherwise.
      // Persistence tee: `levelStreamingProvider.hotReload` for cold boot.
      levelStreamingRegistry.load(partial.levelStreaming);
      levelStreamingProvider.hotReload(partial.levelStreaming);
    }
    if (partial.equipment) {
      // Live-dispatch: refresh `equipmentManifestRegistry` so
      // inventory/equip/bank UIs resolve the new slot set, bank grid
      // layout, and user-facing error messages on the next render.
      // Persistence tee: `equipmentProvider.hotReload` for cold boot.
      equipmentManifestRegistry.load(partial.equipment);
      equipmentProvider.hotReload(partial.equipment);
    }
    if (partial.matchmakingTuning) {
      // Live-dispatch: refresh `matchmakingRegistry` so authored
      // queue definitions / widening schedules / party constraints /
      // backfill rules take effect on the next eligibility check.
      // Player queue state is owned by the matchmaker and unaffected.
      // Persistence tee: `matchmakingTuningProvider.hotReload` for cold boot.
      matchmakingRegistry.load(partial.matchmakingTuning);
      matchmakingTuningProvider.hotReload(partial.matchmakingTuning);
    }
    if (partial.aiBehavior !== undefined) {
      // Persistence tee only — no live-dispatch registry exists for
      // behavior trees today (the `BehaviorTreeInterpreter` is a
      // stateless walker; runtime agents hold their own tree refs
      // via `AgentBehaviorTicker`). Edits survive server restart
      // and the next SystemLoader cold boot will pick them up.
      aiBehaviorProvider.hotReload(partial.aiBehavior);
    }
    if (partial.analyticsEvents) {
      // Live-dispatch: refresh `analyticsEventRouter` so authored
      // event-schema edits (name/props/samplingRate) flow to the
      // next validate() call. Persistence tee:
      // `analyticsEventsProvider.hotReload` for cold boot.
      analyticsEventRouter.load(partial.analyticsEvents);
      analyticsEventsProvider.hotReload(partial.analyticsEvents);
    }
    if (partial.groupFinder) {
      // Live-dispatch: refresh `groupFinderRegistry` so authored
      // LFG/dungeon-finder edits (content list + matchmaking +
      // rewards) flow to the next queue eligibility check.
      // Persistence tee: `groupFinderProvider.hotReload` for cold boot.
      groupFinderRegistry.load(partial.groupFinder);
      groupFinderProvider.hotReload(partial.groupFinder);
    }
    if (partial.duelArenas) {
      // Persistence tee only — no live-dispatch registry exists for
      // duel-arenas today (the runtime `DuelRulesRegistry` handles a
      // separate `DuelManifest`). Edits survive server restart and
      // the next SystemLoader cold boot will pick them up.
      duelArenasProvider.hotReload(partial.duelArenas);
    }
    if (partial.combat) {
      // Persistence tee only — `combat-constants.json` is consumed
      // by CombatSystem at cold boot via DataManager; no live-dispatch
      // registry exists for the combat tuning constants today.
      combatProvider.hotReload(partial.combat);
    }
    if (partial.game) {
      // Persistence tee only — `game-constants.json` is consumed at
      // cold boot via DataManager; no live-dispatch registry exists
      // for general game tuning constants today.
      gameProvider.hotReload(partial.game);
    }
    if (partial.gathering) {
      // Persistence tee only — `gathering-constants.json` is consumed
      // at cold boot via DataManager; no live-dispatch registry exists
      // for gathering tuning constants today.
      gatheringProvider.hotReload(partial.gathering);
    }
    if (partial.music) {
      // Persistence tee only — `music.json` is the track catalog
      // (distinct from `musicStateMachine`, which is wired above).
      // Runtime audio selection reads from DataManager at boot; no
      // live-dispatch registry exists for the bare track catalog today.
      musicProvider.hotReload(partial.music);
    }
    if (partial.saveData) {
      // Persistence tee only — `save-data.json` describes persisted
      // slice schemas (fields + migrations). Runtime `SaveDataRegistry`
      // instances are spun up per-world from this manifest at boot;
      // no module-level live-dispatch registry exists today.
      saveDataProvider.hotReload(partial.saveData);
    }
    if (partial.worldStructure) {
      // Persistence tee only — `world-structure.json` describes global
      // grid/terrain sizing constants. Consumed at cold boot via
      // DataManager → WORLD_STRUCTURE_CONSTANTS; no live-dispatch
      // registry exists today.
      worldStructureProvider.hotReload(partial.worldStructure);
    }
    if (partial.stations) {
      // Live-dispatch — StationDataProvider singleton rebuilds its
      // station catalog in-place so world-building queries pick up the
      // new manifest without a cold boot.
      stationDataProvider.loadStations(partial.stations);
    }
    if (partial.modelBounds) {
      // Live-dispatch — StationDataProvider refreshes per-asset model
      // bounds and recomputes station footprints from the updated
      // geometry.
      stationDataProvider.loadModelBounds(partial.modelBounds);
    }
  }

  // ---- server-spawn helpers --------------------------------------------

  /**
   * Server-side id of the live player entity. `null` until
   * `_spawnRealPlayer` succeeds. Used by tests + future callers that
   * need to reference the player by id without going through the
   * synthetic PIEEntity placeholder.
   */
  private _realPlayerId: string | null = null;

  /** The real server-side player entity id (null until spawned). */
  get realPlayerId(): string | null {
    return this._realPlayerId;
  }

  /**
   * Spawn the real server-side player entity that the hyperscape plugin's
   * PlayerSystem + combat/skills/prayer subscribers register against.
   *
   * Mirrors `character-selection.ts:1011` — same `type: "player"`, same
   * field set, `owner` = the loopback client socket id. When the server
   * broadcasts `entityAdded` over the loopback, ClientNetwork's
   * `Entities.add` sees `data.owner === network.id` and dispatches the
   * `playerLocal` constructor. Without this, PIE has only the synthetic
   * `pie-player` PIEEntity placeholder — no PhysX capsule, no hot-set,
   * no input wiring, no stat hydration.
   *
   * Best-effort: if the server-side player class isn't registered (no
   * hyperscape plugin), or the constructor throws (missing dep), we
   * log + continue. The PIE marker still exists so the viewport keeps
   * rendering.
   */
  private _spawnRealPlayer(spawn: { x: number; y: number; z: number }): void {
    if (!this._server) return;
    // The owner field must equal the server-issued socket id for this
    // loopback connection — when the entity replicates over the
    // loopback, ClientNetwork's `Entities.add` checks
    // `data.owner === network.id` to decide between `playerLocal` and
    // `playerRemote`. In PIE there is exactly one loopback connection,
    // so the first (and only) socket in `network.sockets` is the
    // editor's. The id is generated inside
    // `PIELoopbackConnectionHandler.handleConnection`, so we read it
    // back from the registry rather than guessing.
    const sockets = this._server.network.sockets;
    const owner = sockets.keys().next().value;
    if (!owner) {
      console.warn(
        "[PIEEditorSession] _spawnRealPlayer: no loopback socket registered yet; skipping",
      );
      return;
    }
    const world = this._server.world;
    const entityId = uuid();
    const playerData: EntityData = {
      id: entityId,
      type: "player",
      position: [spawn.x, spawn.y, spawn.z],
      quaternion: [0, 0, 0, 1],
      owner,
      userId: "pie-editor-host",
      name: "Editor",
      health: 100,
      maxHealth: 100,
      avatar: "asset://avatars/avatar-male-01.vrm",
      sessionAvatar: undefined,
      roles: [],
      skills: {},
      autoRetaliate: true,
      // Immune to aggro until PIE finishes booting; flipped to false
      // once the editor's "ready" signal lands (follow-up).
      isLoading: true,
    } as unknown as EntityData;

    let spawnedPlayer: unknown = null;
    try {
      spawnedPlayer = world.entities.add(playerData, true);
    } catch (err) {
      console.warn(
        `[PIEEditorSession] _spawnRealPlayer: world.entities.add failed:`,
        err,
      );
      return;
    }
    if (!spawnedPlayer) {
      // Most likely cause: "player" entity type not registered (the
      // hyperscape plugin's `registerHyperiaEntityTypes` didn't run).
      // The editor's session continues with just the PIE marker;
      // future work can register a generic Player class for
      // non-Hyperia plugins.
      console.warn(
        "[PIEEditorSession] _spawnRealPlayer: entities.add returned null (player type not registered?)",
      );
      return;
    }

    // Mirror character-selection.ts:1044 — set `isLoading` on data
    // AFTER construction because the entity constructor doesn't
    // reliably copy every property into `entity.data`.
    const dataHolder = spawnedPlayer as { data?: Record<string, unknown> };
    if (dataHolder.data) {
      dataHolder.data.isLoading = true;
    }
    this._realPlayerId = entityId;

    // Fire PLAYER_JOINED so PlayerSystem.onPlayerEnter (and combat /
    // skills / prayer subscribers) register against this entity. We
    // pass `equipment` + `inventory` as undefined — those systems fall
    // back to DB query if absent, which in PIE's no-DB world means
    // empty defaults. Same shape as character-selection.ts:1173.
    try {
      world.emit(EventType.PLAYER_JOINED, {
        playerId: entityId,
        userId: "pie-editor-host",
        player: spawnedPlayer,
        equipment: undefined,
        inventory: undefined,
        isLoadTestBot: false,
        isAgent: false,
      });
    } catch (err) {
      console.warn(
        `[PIEEditorSession] _spawnRealPlayer: PLAYER_JOINED emit threw:`,
        err,
      );
    }
  }

  /** Station type → server entity-type registry key. */
  private static _stationServerType(type: string): string {
    switch (type) {
      case "bank":
      case "furnace":
      case "anvil":
      case "altar":
      case "range":
        return type;
      default:
        return "entity";
    }
  }

  /**
   * Spawn an entity on the server world and attach its behavior graph.
   *
   * Both steps are best-effort: if the entity constructor throws (missing
   * system dep, bad data, etc.) we log a warning and continue — the
   * editor-visible `this.entities` record is already in place so the
   * viewport still shows the marker. `addGraph` is only called when the
   * server entity registered successfully.
   */
  private _spawnOnServer(
    data: EntityData,
    graph: RuntimeScriptGraph | undefined,
  ): void {
    if (!this._server) return;
    const world = this._server.world;
    let serverEntity: unknown = null;
    try {
      serverEntity = world.entities.add(data, true);
    } catch (err) {
      console.warn(
        `[PIEEditorSession] server.entities.add(${data.id}, type=${data.type}) failed:`,
        err,
      );
      return;
    }
    if (!serverEntity || !graph) return;
    try {
      const scripting = world.getSystem("scripting") as
        | ScriptingSystem
        | undefined;
      if (!scripting) return;
      scripting.addGraph(data.id, graph, { trusted: true });
    } catch (err) {
      console.warn(
        `[PIEEditorSession] scripting.addGraph(${data.id}) failed:`,
        err,
      );
    }
  }

  // ---- debug sink -------------------------------------------------------

  private _debugSinkDetach: (() => void) | null = null;

  /**
   * Lazily-created managed install for authored
   * `DialogueConditionBindingsManifest` entries. Created on first
   * hot-reload that carries a `dialogueConditionBindings` payload;
   * replaced on each subsequent reload. Survives for the life of the
   * session (destroyed when the server world is torn down on stop).
   */
  private _managedDialogueConditions: ManagedDialogueConditionInstall | null =
    null;
  private _tickCount = 0;

  /**
   * Forward `scripting:*` events from the server world event bus to
   * `sink` as PIEDebugEntry records. Mirrors the telemetry the old
   * `PIEScriptRunner.log()` emitted so the editor's Script Inspector
   * works without caring which runtime produced the events.
   */
  private _attachDebugSink(sink: PIEDebugSink): void {
    if (!this._server) return;
    const world = this._server.world;
    const emit = (
      level: PIEDebugEntry["level"],
      source: string,
      payload: Record<string, unknown>,
    ) => {
      const entry: PIEDebugEntry = {
        ts: Date.now(),
        tick: this._tickCount,
        level,
        source,
        entityId: (payload.entityId as string | undefined) ?? undefined,
        message: (payload.message as string | undefined) ?? source,
        data: payload,
      };
      try {
        sink(entry);
      } catch {
        // Sink errors must not break the server loop.
      }
    };

    const onReady = (p: unknown) =>
      emit(
        "info",
        "scripting/graph_ready",
        (p ?? {}) as Record<string, unknown>,
      );
    const onTrigger = (p: unknown) =>
      emit(
        "trigger",
        "scripting/trigger",
        (p ?? {}) as Record<string, unknown>,
      );
    const onAction = (p: unknown) =>
      emit("action", "scripting/action", (p ?? {}) as Record<string, unknown>);
    const onError = (p: unknown) =>
      emit("error", "scripting/error", (p ?? {}) as Record<string, unknown>);
    const onRateLimited = (p: unknown) =>
      emit(
        "error",
        "scripting/rate_limited",
        (p ?? {}) as Record<string, unknown>,
      );

    world.on("scripting:graph_ready", onReady);
    world.on("scripting:trigger", onTrigger);
    world.on("scripting:action", onAction);
    world.on("scripting:error", onError);
    world.on("scripting:rate_limited", onRateLimited);

    this._debugSinkDetach = () => {
      world.off("scripting:graph_ready", onReady);
      world.off("scripting:trigger", onTrigger);
      world.off("scripting:action", onAction);
      world.off("scripting:error", onError);
      world.off("scripting:rate_limited", onRateLimited);
    };
  }
}
