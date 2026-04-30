/**
 * @hyperforge/shared - CLIENT ONLY
 *
 * Client-safe exports that don't include any Node.js-specific code
 */

// IMPORTANT: DO NOT export createServerWorld or any server systems here
// This entry point is specifically for browser/client builds

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

// Export editor systems
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

// Export entity classes
export { Entity } from "./entities/Entity";
export type { EventCallback } from "./entities/Entity";
// MobEntity migrated to @hyperforge/hyperscape (2026-04-26).
// PlayerLocal, PlayerRemote migrated to
// @hyperforge/hyperscape (2026-04-26).

// Export System class from core systems
export { System } from "./systems/shared";

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
  PlayerStats,
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

// Export EventType enum
export { EventType } from "./types/events";

// Export PlayerMigration
export { PlayerMigration } from "./types/core/core";

// Export enums (these are values, not types)
export { WeaponType, EquipmentSlotName } from "./types/core/core";

// Weapon style configuration (tile-based-MMORPG-accurate style restrictions per weapon)
export {
  WEAPON_STYLE_CONFIG,
  getAvailableStyles,
  isStyleValidForWeapon,
  getDefaultStyleForWeapon,
} from "./constants/WeaponStyleConfig";

// Export db helpers and type guards for server usage
export { dbHelpers, isDatabaseInstance } from "./types/network/database";

// Export role utilities
export {
  addRole,
  removeRole,
  hasRole,
  serializeRoles,
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

// Export death/loot types for shadow state and transaction tracking
export type {
  LootResult,
  LootFailureReason,
  PendingLootTransaction,
} from "./types/death";

// Export tile utilities (used for tile-based-MMORPG-style tile-based distance checks).
// Mirrors the export block in `index.ts` so client-side consumers
// (asset-forge / World Studio / hyperscape-plugin) get the full
// surface — partial re-exports caused runtime "module does not provide
// X" errors in Vite dev because esbuild stripped missing values.
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
  // Cardinal-only resource interaction
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
  // Combat pathfinding
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

// Export item helpers used by server network snapshot
export { ITEMS, getItem } from "./data/items";

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

// Context menu colors (tile-based-MMORPG-accurate styling)
export { CONTEXT_MENU_COLORS } from "./constants/GameConstants";

// Live getters — provider-first reads of boot-captured context-menu colors.
// Prefer these over `CONTEXT_MENU_COLORS` so PIE manifest edits to
// `game.contextMenuColors` apply without a client reload.
export {
  getContextMenuItemColor,
  getContextMenuNpcColor,
  getContextMenuObjectColor,
  getContextMenuPlayerColor,
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
  getWorldChunkSize,
  getWaterThreshold,
  getWaterEdgeBuffer,
  getMinVisibleWaterDepth,
  getMaxWalkableSlope,
  getSlopeCheckDistance,
  getTileSize,
  getTerrainTileSize,
} from "./data/live/game-live";

export { getPickupRange } from "./data/live/combat-live";
export { getMaxTradeSlots } from "./data/live/trading-live";
export {
  getMaxBankSlots,
  getBankSlotsPerTab,
  getMaxBankTabs,
  getDefaultBankTabs,
  getDefaultBankSlots,
} from "./data/live/banking-live";
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

// Home teleport constants (cooldown, cast time)
export { HOME_TELEPORT_CONSTANTS } from "./constants/GameConstants";

// Inventory constants (slot counts, stack sizes)
export { INVENTORY_CONSTANTS } from "./constants/GameConstants";

// Player constants (health, stamina, speeds)
export { PLAYER_CONSTANTS } from "./constants/GameConstants";

// Terrain constants (water threshold, walkable slopes) — single source of truth
export { TERRAIN_CONSTANTS } from "./constants/GameConstants";

// Client input constants (click-to-move distance, drag threshold, raycast range)
export { INPUT } from "./systems/client/interaction/constants";

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
export type {
  PrayerDefinition,
  PrayerCategory,
} from "./data/PrayerDataProvider";

// Export spell service for magic spellbook UI
// SpellService migrated to @hyperforge/hyperscape (2026-04-26, Wave 6).

// Export CLIENT system classes only (NO SERVER SYSTEMS)
export { Entities } from "./systems/shared";
export { Physics } from "./systems/shared";
export { Particles } from "./systems/shared";
export { LODs } from "./systems/shared";
export { ClientInterface } from "./systems/client/ClientInterface"; // UI state, preferences, stats display
export { ClientLoader } from "./systems/client/ClientLoader";
export { Environment } from "./systems/shared";
export { ClientNetwork } from "./systems/client/ClientNetwork";
export { ClientGraphics } from "./systems/client/ClientGraphics";
export { ClientRuntime } from "./systems/client/ClientRuntime"; // Client lifecycle and diagnostics
export { ClientAudio } from "./systems/client/ClientAudio";
export { ClientLiveKit } from "./systems/client/ClientLiveKit";
export { ClientInput } from "./systems/client/ClientInput";
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
export { ClientActions } from "./systems/client/ClientActions";
export { DevStats } from "./systems/client/DevStats"; // FPS counter and dev performance telemetry
export { EventBus } from "./systems/shared";
export { System as SystemClass } from "./systems/shared";
export { SystemBase } from "./systems/shared";
export { PendingActionTracker } from "./systems/client/network/PendingActionTracker";

// Export node client components directly from their source modules (NOT ServerLoader, ServerRuntime, ServerLiveKit)
export { createNodeClientWorld } from "./runtime/createNodeClientWorld";
export { NodeClient } from "./systems/client/NodeClient";
// Environment system works in both browser and Node contexts
export { Node } from "./nodes/Node";
// Re-export commonly used node classes to satisfy API extractor
export { UI } from "./nodes/UI";
export { UIView } from "./nodes/UIView";
export { UIText } from "./nodes/UIText";
export { Group } from "./nodes/Group";
export { Mesh } from "./nodes/Mesh";
export { Avatar } from "./nodes/Avatar";
// Export client-only storage (no Node.js dependencies)
export { storage, LocalStorage } from "./platform/shared/storage";
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

export { isTouch, cls, hashFile } from "./platform/client/utils-client";
export { ReactiveVector3 } from "./extras/animation/ReactiveVector3";
export { createEmoteFactory } from "./extras/three/createEmoteFactory";
export { createNode } from "./extras/three/createNode";
export { glbToNodes } from "./extras/three/glbToNodes";
export { Emotes } from "./data/playerEmotes";
export { ALL_WORLD_AREAS, STARTER_TOWNS } from "./data/world-areas";
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
  type DuelRuleDefinition,
  type EquipmentSlotDefinition,
  type DuelEquipmentSlot,
} from "./data/duel-manifest";
export { ControlPriorities } from "./systems/client/ControlPriorities";
export { downloadFile } from "./utils/downloadFile";
export { Curve } from "./extras/animation/Curve";
export { buttons, propToLabel } from "./extras/ui/buttons";
// GLTFLoader export disabled due to TypeScript declaration generation issues
// Users can import it directly: import { GLTFLoader } from './libs/gltfloader/GLTFLoader';

// NOTE: CSM (WebGL) removed - use CSMShadowNode from three/addons/csm/CSMShadowNode.js for WebGPU

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

// Terrain shader — used by World Studio for game-accurate terrain rendering
export {
  createTerrainMaterial,
  generateNoiseTexture,
  getNoiseTexture,
  sampleNoiseAtPosition,
  getGrassiness,
  calculateSlope,
  applyAnimeShade,
  TERRAIN_SHADER_CONSTANTS,
  TERRAIN_SHADE,
  computeTerrainColorCPU,
  type TerrainMaterialOptions,
  type TerrainUniforms,
} from "./systems/shared/world/TerrainShader";
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
// Re-export specific core types referenced by entity declarations
export type {
  PlayerDeathData,
  Player as PlayerCore,
  PlayerHealth,
  PlayerStamina,
  PlayerPosition,
  Skills,
  PlayerEquipmentItems,
  PlayerCombatData,
  SystemConfig,
  SkillData,
  MovementComponent,
  InventoryItem,
  Item,
  Inventory,
  PlayerEquipment,
  CombatStyle,
  CombatBonuses,
  EquipmentSlot,
} from "./types/core/core";
// AttackType + ItemType are runtime enums (defined in
// types/game/item-types.ts). They need value exports — esbuild strips
// type-only exports from the .client build, so consumers like
// MobEntity.ts that do `import { AttackType }` at runtime hit a
// "module does not provide X" error otherwise.
// (WeaponType + EquipmentSlotName are already value-exported above.)
export { AttackType, ItemType } from "./types/core/core";
// ItemRarity is an enum — needs value export.
export { ItemRarity } from "./types/entities/entities";

// ItemSpawnerSystem stats type — re-exported for the client bundle.
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
// Re-export storage types (client-only)
export type { Storage } from "./platform/shared/storage";
// NodeStorage is only available from the main index (server-side)
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
export type { NetworkSystem } from "./types/systems/system-interfaces";
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
// Export HotReloadable from physics as well (needed by PlayerLocal)
export type { HotReloadable as HotReloadable_2 } from "./types/systems/physics";

// Export environment and stage types
export type {
  BaseEnvironment,
  EnvironmentModel,
  SkyHandle,
  SkyInfo,
  SkyNode,
} from "./types/index";
export { LooseOctree } from "./utils/physics/LooseOctree";
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
// InteractionType is an enum — needs value re-export for migrated systems.
export { InteractionType } from "./types/entities/entities";
// EntityType is an enum (value), not just a type — needs `export {}`
// for runtime use by migrated systems.
export { EntityType } from "./types/entities/entities";

// Export event payloads namespace
export * as Payloads from "./types/events";

// Export additional core types
export type { SkillsData } from "./types/systems/system-interfaces";
export type {
  HealthComponent,
  VisualComponent,
  EntityCombatComponent,
  PlayerCombatStyle,
} from "./types/entities";
export type { GroupType } from "./types/rendering/nodes";
export type { InventoryItemInfo } from "./types/events";
export type { MaterialProxy } from "./types/rendering/materials";

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
} from "./types/network/database";

// Export entity types
export type {
  PlayerEntity,
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
export { writePacket, readPacket } from "./platform/shared/packets";
export { Socket } from "./platform/shared/Socket";

// Export physics utilities
export { installThreeJSExtensions } from "./utils/physics/PhysicsUtils";

// Export spawn utilities
export { CircularSpawnArea } from "./utils/physics/CircularSpawnArea";

// Export terrain system
export { TerrainSystem } from "./systems/shared";

// Export pathfinding utilities (used by NavigationVisualizer and building navigation)
export { BFSPathfinder } from "./systems/shared/movement/BFSPathfinder";
export type { WalkabilityChecker } from "./systems/shared/movement/BFSPathfinder";

// Export building collision utilities
export {
  cellToWorldTile,
  rotateWallDirection,
  getOppositeDirection,
  toWallDirection,
  tileKey as buildingTileKey,
} from "./types/world/building-collision-types";
export type {
  WallDirection,
  WallSegment,
  StairTile,
  FloorCollisionData,
} from "./types/world/building-collision-types";

// xp-curves runtime registry — shared module-level singleton.
// Populated at boot by DataManager and live-mutated by PIEEditorSession.
// Client HUD (xp-orb) resolves xp-to-level through this same instance
// so editor saves take effect in the HUD without a restart.
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
// Populated at boot by DataManager + hot-mutated by PIEEditorSession.
// SpellService reads through this registry; React spellbook panel
// subscribes to `onReloaded` to invalidate its memoized spell list
// when authored spell edits land.
export {
  combatSpellsRegistry,
  CombatSpellsRegistry,
  CombatSpellsNotLoadedError,
  UnknownCombatSpellError,
  type CombatSpellTier,
  type CombatSpellsReloadListener,
} from "./combat-spells/index";

// ─────────────────────────────────────────────────────────────────────
// Plugin-migration exports — re-exported here for the CLIENT bundle
// (`framework.client.js`) so the migrated systems in
// `@hyperforge/hyperscape` resolve their imports at runtime in the
// browser. These mirror the additions made to `index.ts` (the
// server-side entry) during the 2026-04-24/25 session migrations.
// Each block names which migrated system needs which symbol.
// ─────────────────────────────────────────────────────────────────────

// HealthBars (client-only)
export type {
  ShaderNode,
  TSLNodeFloat,
  TSLNodeVec2,
  TSLNodeVec3,
  TSLNodeVec4,
} from "./extras/three/three";
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

// ZoneVisualsSystem (client-only)
export { Chat as ChatSystem } from "./systems/shared/presentation/Chat";
// ZoneDetectionSystem migrated to @hyperforge/hyperscape (2026-04-25).
export type { WorldArea } from "./types/world/world-types";
export { getEffectiveWorldAreas } from "./world-areas";

// EquipmentVisualSystem (client-only)
export { EQUIPMENT_SLOT_NAMES } from "./constants/EquipmentConstants";

// WaterfallVisualsSystem (client-only)
export type { WaterfallDefinition } from "./systems/shared/world/WaterfallDefinition";

// Identifier branded types + create helpers — needed by every
// migrated cross-cutting server-side system (CoinPouch, Prayer,
// Banking, Store, etc.) for id construction.
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

// CoinPouchSystem (cross-cutting server-side)
export { toPlayerID } from "./utils/IdentifierUtils";
export type { DatabaseSystem } from "./types/systems/system-interfaces";

// PrayerSystem (cross-cutting server-side)
export {
  clampPrayerLevel,
  clampPrayerPoints,
  isAltarPrayPayload,
  isPlayerCleanupPayload,
  isPlayerRegisteredPayload,
  isPrayerToggleEventPayload,
  isValidRestoreAmount,
  isValidPrayerId,
  MAX_ACTIVE_PRAYERS,
  PRAYER_TOGGLE_COOLDOWN_MS,
  PRAYER_TOGGLE_RATE_LIMIT,
  getPlayerPrayerLevel,
  getPlayerPrayerBonus,
} from "./types/game/prayer-types";
export type { PlayerJoinedPayload } from "./types/events/event-payloads";
export type {
  PrayerState,
  PrayerBonuses,
  PlayerWithPrayerStats,
} from "./types/game/prayer-types";
// Note: PrayerDefinition + PrayerCategory already re-exported above
// from ./data/PrayerDataProvider — same underlying type.

// Logger (value) — used by every migrated SystemBase subclass for
// structured console output.
export { Logger } from "./utils/Logger";

// BankingSystem (cross-cutting server-side)
export type { BankData } from "./types/game/inventory-types";

// StoreSystem (cross-cutting server-side)
export type { Store } from "./types/game/item-types";
export { GENERAL_STORES } from "./data/banks-stores";
export { storesRegistry } from "./stores";

// ─────────────────────────────────────────────────────────────────────
// Earlier-session migration deps that need client-bundle exports too
// (the classic MMORPG skill systems + visual systems migrated 2026-04-24 also
// import these symbols, but `index.client.ts` was never updated for
// them — the dev server crashes only surface as users actually hit
// each system at runtime).
// ─────────────────────────────────────────────────────────────────────

// `Skill` constants extracted from SkillsSystem when SkillsSystem
// migrated to @hyperforge/hyperscape (2026-04-26, Wave 5a).
// DeathState + ALL_WORLD_AREAS
// (AttackType already re-exported earlier in this file)
export { Skill } from "./data/skills/SkillConstants";
export { DeathState } from "./types/entities/entities";
// ALL_WORLD_AREAS + STARTER_TOWNS already re-exported above; just
// add the missing helper.
export { getRandomSpawnPoint } from "./data/world-areas";

// World systems consumed by migrated systems via `getSystem` (some
// already imported at the top of this file, re-listed here for clarity)
// BridgeSystem migrated to @hyperforge/hyperscape (2026-04-25)
export { BuildingCollisionService } from "./systems/shared/world/BuildingCollisionService";
// POISystem migrated to @hyperforge/hyperscape (2026-04-25)
// RoadNetworkSystem migrated to @hyperforge/hyperscape (2026-04-25)
// TownSystem migrated to @hyperforge/hyperscape (2026-04-25)

// Combat + Player system class refs — Hyperscape plugins like
// HealthRegenSystem do `getSystem<CombatSystem>("combat")`.
// (Not yet migrated; downstream plugin systems still reference them.)
// CombatSystem migrated to @hyperforge/hyperscape (2026-04-26, Wave 6).
// PlayerSystem migrated to @hyperforge/hyperscape (2026-04-26, Wave 5d).

// Spell-visual / arrow-visual config helpers — ProjectileRenderer.
export {
  getSpellVisual,
  getArrowVisual,
  type SpellVisualConfig,
  type ArrowVisualConfig,
} from "./data/spell-visuals";

// Collision flags + masks — used by visual systems for ray queries.
export {
  CollisionFlag,
  CollisionMask,
} from "./systems/shared/movement/CollisionFlags";

// Resource footprint constants + types.
export {
  FOOTPRINT_SIZES,
  resolveFootprint,
} from "./types/game/resource-processing-types";
export type {
  ResourceFootprint,
  FootprintDimensions,
  FootprintSpec,
} from "./types/game/resource-processing-types";

// Smithing helpers consumed by every classic MMORPG skill system migrated.
export {
  getItemQuantity,
  getSmithingLevelSafe,
  hasSkills,
  isLooseInventoryItem,
} from "./constants/SmithingConstants";
export { getHammerItemId } from "./data/live/smithing-live";

// Tile pathfinding helpers (`hasLineOfSight`, `getValidRangedTiles`,
// `getValidMeleeTiles`) — re-exported above as part of the unified
// TileSystem block.

// Processing data provider + recipe types.
export { processingDataProvider } from "./data/ProcessingDataProvider";
export type {
  CraftingRecipeData,
  FletchingRecipeData,
} from "./data/ProcessingDataProvider";

// EquipmentVisual helpers already re-exported earlier in this file
// (search for "EquipmentVisualHelpers"); EquipmentVisualSystem in
// the plugin imports them from `@hyperforge/shared` and resolves
// through that earlier re-export.

// HealthRegen live-getters consumed by HealthRegenSystem in plugin.
// (`getHealthRegenRate` is in game-live; the tick-interval helpers
// are in combat-live.)
export {
  getHealthRegenIntervalTicks,
  getHealthRegenCooldownTicks,
} from "./data/live/combat-live";

// `toTHREEVector3` already re-exported earlier in this file; HealthBars
// resolves through that.

// DialogueSystem (cross-cutting server-side) — re-exported here for
// the client bundle so the plugin's DialogueSystem can resolve its
// imports when registered on the client world. (Mirrors index.ts.)
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
// quest-types migrated to @hyperforge/hyperscape-plugin/types/quest-types
// 2026-04-27 (top-10 #8 cleanup). isValidQuestId is plugin-side now.

// StationSpawnerSystem deps — re-exported for the client bundle.
export { stationDataProvider } from "./data/StationDataProvider";

// MobNPCSpawnerSystem deps — re-exported for the client bundle.
export { ALL_NPCS } from "./data/npcs";
export type { WorldJsonMobSpawn } from "./data/world-structure";
export type {
  LevelRange,
  NPCData,
  MobSpawnStats,
} from "./types/entities/npc-mob-types";
export type { EntitySpawnedEvent } from "./types/systems/system-interfaces";
// (InteractionType already re-exported earlier in this file as a value)

// InventorySystem migrated to @hyperforge/hyperscape (2026-04-26, Wave 5c).
export type { PlayerInventory } from "./types/core/core";

// Entity classes — registered with the engine ECS via the public
// `registerEntityType()` API in plugin onEnable (decoupled
// 2026-04-26, post-Wave 6 cleanup).
// NPCEntity migrated to @hyperforge/hyperscape (2026-04-26).
// ItemEntity, HeadstoneEntity migrated to @hyperforge/hyperscape (2026-04-26).
// World entities migrated to @hyperforge/hyperscape (2026-04-26).

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
export { registerEntityType } from "./systems/shared/entities/Entities";

// GroundItemSystem + ZoneDetectionSystem deps — re-exported for the
// client bundle.
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

// MobNPCSystem deps — re-exported for the client bundle (Wave 3a).
export { EntityManager } from "./systems/shared/entities/EntityManager";
export { NPC_SPAWN_CONSTANTS } from "./data/npcs";
export type {
  MobInstance,
  MobSpawnConfig,
} from "./types/entities/npc-mob-types";

// NPCSystem deps — re-exported for the client bundle.
export type { NPCLocation } from "./data/world-areas";
export { worldAreasRegistry } from "./world-areas";
export { SHOP_ITEMS } from "./data/items";
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

// ProcessingSystem deps — re-exported for the client bundle.
export { ITEM_IDS } from "./constants/GameConstants";
// ProcessingAction migrated to @hyperforge/hyperscape-plugin/types/
// resource-game-types 2026-04-27 (top-10 #8, slice 30).
// getTargetValidator / TargetValidator migrated to
// @hyperforge/hyperscape (2026-04-26).
export { modelCache } from "./utils/rendering/ModelCache";
export { ParticleSystem } from "./systems/shared/presentation/ParticleSystem";
// (calculateDistance2D + GroundItemSystem are already in client barrel)

// AggroSystem deps — re-exported for the client bundle.
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

// BridgeSystem (cross-cutting) — re-exported here for the client
// bundle so the migrated plugin BridgeSystem resolves its imports
// when loaded on the client world. (Mirrors index.ts.)
export {
  ISLAND_BRIDGES,
  type BridgeDefinition,
} from "./systems/shared/world/BridgeDefinition";

// ProceduralGrassSystem deps — mirror to client bundle.
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

// TownSystem deps — mirror to client bundle.
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
export type { BuildingLayoutInput } from "./types/world/building-collision-types";
// cellToWorldTile already exported above (building collision utilities).
// `tileKey` from building-collision-types collides with the TileSystem
// `tileKey` exported in the unified block above. Aliased here so both
// remain reachable.
export { tileKey as buildingCollisionTileKey } from "./types/world/building-collision-types";
export type {
  FlatZone,
  FlatZoneTile,
  FlatZoneTileBounds,
} from "./types/world/terrain";
export {
  extractBuildingNPC,
  BUILDING_NPC_TYPES,
  type BuildingNPCSpawn,
} from "./utils/world/townPopulation";

// ResourceSystem deps — mirror to client bundle.
// ResourceEntity migrated to @hyperforge/hyperscape (2026-04-26).
export { disposeFishingSpotTextures } from "./entities/world/visuals/FishingSpotVisualStrategy";
// Visual strategy API used by ResourceEntity (now in plugin).
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

// ProceduralGrass deferred-import deps — mirror to client bundle.
export { getGrassExclusionManager } from "./systems/shared/world/GrassExclusionManager";
export { ProcgenTreeInstancer } from "./systems/shared/world/ProcgenTreeInstancer";
export { ProcgenRockInstancer } from "./systems/shared/world/ProcgenRockInstancer";

// NPCTickProcessor + SpatialAggroStrategy deps — mirror to client bundle.
export type {
  IAggroStrategy,
  IPathStrategy,
  ICombatStrategy,
  ProcessableNPC,
  NPCTarget,
} from "./types/systems/npc-strategies";
export { SpatialEntityRegistry } from "./systems/shared/entities/SpatialEntityRegistry";

// GrassSharedRegistry — mirror to client bundle.
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

// BuildingRenderingSystem (client + editor) — re-exported here
// for the client bundle so the migrated plugin
// BuildingRenderingSystem resolves its imports. (Mirrors index.ts.)
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

// VegetationSystem (client + editor) — re-exported here for the
// client bundle so the migrated plugin VegetationSystem resolves
// its imports. (Mirrors index.ts.)
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
// (`getGlobalCullingManager` already exported via utils/compute;
// only `isGPUComputeAvailable` added.)
export { isGPUComputeAvailable } from "./utils/compute";
export { resolveBiomeOrFallback } from "./biomes";

// ProceduralTownLandmarksSystem (editor-only) — re-exported here
// for the client bundle so the migrated plugin
// ProceduralTownLandmarks resolves its imports. (`applySkyFog`
// resolves via existing earlier export.)
export type { TownLandmarkType } from "./types/world/world-types";
export {
  clearLamppostLightTexture,
  setLamppostLightTextureData,
} from "./systems/shared/world/LamppostLightMask";

// ProceduralFlowerSystem (editor-only) — re-exported here for the
// client bundle so the migrated plugin ProceduralFlowerSystem
// resolves its imports. (Mirrors index.ts. `getNoiseTexture` /
// `generateNoiseTexture` resolve via existing exports earlier.)
export { tslUtils } from "./utils/TSLUtils";
export { VegetationSsboUtils } from "./systems/shared/world/VegetationSsboUtils";
export { windManager } from "./systems/shared/world/Wind";
// `getGrass*` helpers migrated to @hyperforge/hyperscape (2026-04-25)
// alongside ProceduralGrass. Plugin consumers import them from the
// sibling plugin file directly.

// RoadNetworkSystem (editor-only) — re-exported here for the
// client bundle so the migrated plugin RoadNetworkSystem resolves
// its imports. (Mirrors index.ts. `getGlobalTerrainComputeContext`
// and `GPURoadSegment` resolve via existing utils/compute block.)
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

// ScriptingSystem (cross-cutting server-side) — re-exported here
// for the client bundle so the migrated plugin ScriptingSystem
// resolves its imports. (Mirrors index.ts.)
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

// RangeSystem (scaffold) — re-exported here for the client
// bundle so the migrated plugin RangeSystem resolves its imports.
// (Mirrors index.ts.)
export { NPC_SIZES, type NPCSize } from "./data/npc-sizes";
export { npcSizesRegistry } from "./npc-sizes";

// TeleportSystem (scaffold) — re-exported here for the client
// bundle so the migrated plugin TeleportSystem resolves its
// imports. (Mirrors index.ts.)
export type {
  TeleportNode,
  TeleportNetworkConfig,
} from "./types/world/world-types";

// POISystem (cross-cutting) — re-exported here for the client
// bundle so the migrated plugin POISystem resolves its imports.
// (Mirrors index.ts.)
export type {
  PointOfInterest,
  POICategory,
  POIConfig,
} from "./types/world/world-types";
export { NoiseGenerator } from "./utils/NoiseGenerator";
export {
  BiomeType,
  DEFAULT_BIOME,
} from "./systems/shared/world/TerrainBiomeTypes";
export { dist2D } from "./utils/MathUtils";

// ProceduralDocks (cross-cutting) — re-exported here for the
// client bundle so the migrated plugin ProceduralDocks resolves
// its imports. (Mirrors index.ts.)
export {
  ISLAND_DOCKS,
  type DockDefinition,
} from "./systems/shared/world/DockDefinition";
export { getOppositeWallFlag } from "./systems/shared/movement/CollisionFlags";

// InventoryInteractionSystem (cross-cutting server-side) —
// re-exported here for the client bundle so the migrated plugin
// system resolves its imports when loaded on the client world.
// (Mirrors index.ts.)
export type { DragData, DropTarget } from "./types/game/inventory-types";
export type { ItemAction, ItemContextMenu } from "./types/game/item-types";
export { dataManager } from "./data/DataManager";
export { MESSAGE_TYPES } from "./systems/client/interaction/constants";

// LootSystem (cross-cutting server-side) — re-exported here for the
// client bundle so the migrated plugin LootSystem resolves its
// imports when the plugin is loaded on the client world. (Mirrors
// index.ts.)
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

// ItemTargetingSystem (migrated 2026-04-25) — re-exported here for
// the client bundle so the plugin's ItemTargetingSystem can resolve
// its protocol-type imports when the plugin is loaded on the
// client world. (Mirrors index.ts.)
export type { TargetType, SourceItem } from "./types/item-targeting";

// quest-types migrated to @hyperforge/hyperscape-plugin/types/quest-types
// 2026-04-27 (top-10 #8 cleanup). QuestDefinition, QuestStatus,
// QuestDbStatus, QuestStage, StageProgress, QuestProgress,
// PlayerQuestState, QuestManifest, validateQuestDefinition are now
// plugin-side.
export type { NPCDiedPayload } from "./types/events/event-payloads";
export { validateKillToken } from "./utils/game/KillTokenUtils";

// ---------------------------------------------------------------------------
// Client-entry parity sweep (2026-04-28)
//
// Symbols imported by hyperscape-plugin entities (MobEntity,
// AIStateMachine, WorldDropConditionEvaluators, etc.) that were only
// re-exported from the server entry (index.ts). Browser builds resolve
// `@hyperforge/shared` to framework.client.js; missing exports here
// surface as runtime "does not provide an export named ..." SyntaxErrors
// at module-eval time.
//
// Pre-emptively mirroring the WHOLE combat-live + typeGuards modules
// rather than per-symbol — every export below is browser-safe (pure
// data lookups, pure type guards). Stops the per-symbol whack-a-mole
// the prior fixes (SystemLogger, TileSystem, AttackType, ItemType) had
// to do one at a time.
// ---------------------------------------------------------------------------
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
  getAnimationConfig,
  getDefaultAttackSpeedTicks,
  getAfkDisableRetaliateTicks,
} from "./data/live/combat-live";
export {
  isTerrainSystem,
  isMobSystem,
  isEquipmentSystem,
  isMobLike,
  hasMobConfig,
  getMobRetaliates,
  getMobAttackType,
  hasServerEmote,
  hasHealth,
  isEntityDead,
  hasPendingAttacker,
  getPendingAttacker,
  clearPendingAttacker,
  isPlayerLike,
  hasNetworkDirty,
  hasAIDamageHandler,
  hasPlayerCombatManager,
  hasDeathStateManager,
  // isObject already exported from ValidationUtils above; both are
  // unknown→object guards. Skip the typeGuards re-export to avoid
  // a duplicate-export build error.
  hasMethod,
  hasProperty,
  isPlayerDamageHandler,
  isMobEntity,
} from "./utils/typeGuards";

// Mirror SeededRandom RNG utilities — pure browser-safe deterministic
// PRNG, no fs/server deps. MobEntity uses `getGameRng()` for tile spawn
// jitter and AI decision RNG.
export {
  SeededRandom,
  initializeGameRng,
  getGameRng,
  getGameSeed,
  getGameRngState,
} from "./utils/SeededRandom";
export type { SeededRandomState } from "./utils/SeededRandom";

// ---------------------------------------------------------------------------
// Comprehensive sweep (2026-04-28) — every browser-safe value export
// from index.ts that hyperscape-plugin imports as a value at runtime.
// Generated by walking every plugin import block and diffing against
// the prior client surface (98 symbols across 25 modules).
//
// Server-only modules (./systems/server/network/*, ./infrastructure/
// session-store, ./data/DataManager) are intentionally skipped — they
// pull in fs / db / net deps that don't belong in a browser bundle.
// Plugin code that imports those should resolve them via the .server
// or main entry, not the .client one.
// ---------------------------------------------------------------------------
export { StatsComponent } from "./components/StatsComponent";
// `dataManager` (the singleton) is already exported above; only the
// class itself was missing.
export { DataManager } from "./data/DataManager";
// In-memory session store — pure JS Map wrapper, browser-safe.
// DuelSessionManager + matchmaking systems instantiate it.
export { InMemorySessionStore } from "./infrastructure/session-store";
export type { SessionStore } from "./infrastructure/session-store";

// ---------------------------------------------------------------------------
// Server-network services that are actually browser-safe
//
// These live under `systems/server/network/*` for organizational reasons
// (the server runs them) but every one of these modules contains pure
// runtime/utility logic — no fs, no http, no fastify/express. Audited
// against `from "node:|fs|express|fastify"` and confirmed clean.
//
// The original sweep skipped them by path-pattern; that was wrong.
// Anything pulling in real server-only deps (none of these) would be
// caught at build time by tree-shake elimination of node:* imports.
// ---------------------------------------------------------------------------
export { AuditLogger } from "./systems/server/network/services/AuditLogger";
export {
  IntervalRateLimiter,
  RateLimitService,
} from "./systems/server/network/services/IntervalRateLimiter";
export {
  Logger as NetworkLogger,
  LogLevel,
} from "./systems/server/network/services/Logger";
export {
  isProductionRuntime,
  getDefaultPublicWsUrl,
  getDefaultElizaOsApiUrl,
  getDefaultPublicAppUrl,
} from "./systems/server/network/services/PublicUrls";
export {
  isValidItemId,
  isValidStoreId,
  isValidQuantity,
  wouldOverflow,
  isValidInventorySlot,
  isValidBankSlot,
  isValidBankMoveMode,
  isValidBankTabIndex,
  isValidCustomBankTabIndex,
  isValidNpcId,
  isValidResponseIndex,
  validateRequestTimestamp,
  isValidSlotIndex,
} from "./systems/server/network/services/InputValidation";
export {
  createRateLimiter,
  getPickupRateLimiter,
  getMoveRateLimiter,
  getDropRateLimiter,
  getEquipRateLimiter,
  getConsumeRateLimiter,
  getTileMovementRateLimiter,
  getPathfindRateLimiter,
  getCombatRateLimiter,
  getFollowRateLimiter,
  getCoinPouchRateLimiter,
  getPrayerRateLimiter,
  getQuestListRateLimiter,
  getQuestDetailRateLimiter,
  getQuestAcceptRateLimiter,
  getQuestAbandonRateLimiter,
  getQuestCompleteRateLimiter,
  getGlobalSocketRateLimiter,
  getChatRateLimiter,
  getUnknownMessageRateLimiter,
  destroyAllRateLimiters,
} from "./systems/server/network/services/SlidingWindowRateLimiter";
export {
  MovementInputValidator,
  MovementViolationSeverity,
} from "./systems/server/network/movement/MovementInputValidator";
export { MovementAntiCheat } from "./systems/server/network/movement/MovementAntiCheat";
export {
  DEBUG_FACE_DIRECTION,
  DEBUG_PENDING_GATHER,
} from "./systems/server/network/debug";
export {
  getPlayerId,
  sendToSocket,
  sendErrorToast,
  sendSuccessToast,
  getSessionManager,
  hasActiveInterfaceSession,
} from "./systems/server/network/handlers/common/helpers";
export {
  MAGIC_STYLE_BONUSES,
  RANGED_STYLE_BONUSES,
  WEAPON_DEFAULT_ATTACK_STYLE,
} from "./constants/CombatConstants";
export { lootTablesProvider } from "./data/LootTablesProvider";
export { mobLootTableMappingsProvider } from "./data/MobLootTableMappingsProvider";
export { ARROW_DATA, BOW_TIERS } from "./data/ammunition";
export { COMBAT_SPELLS, SPELL_ORDER } from "./data/combat-spells";
export {
  getDuelArenaConfig,
  isPositionInsideCombatArena,
  isPositionInsideDuelArenaZone,
} from "./data/duel-manifest";
export { isNotedItemId } from "./data/items";
export {
  getCombatXpPerDamage,
  getControlledXpPerDamage,
  getDeathAnimationTicks,
  getDeathCooldownTicks,
  getDeathReconnectRespawnDelayTicks,
  getDeathStaleLockAgeTicks,
  getDefaultRespawnPosition,
  getDefaultRespawnTown,
  getEatAttackDelayTicks,
  getEatDelayTicks,
  getGravestoneTicks,
  getHitpointsXpPerDamage,
  getLogoutPreventionTicks,
  getMaxHealAmount,
  getMovementSlerpSpeed,
} from "./data/live/combat-live";
export { getGatheringRange } from "./data/live/gathering-live";
export {
  getMaxFriends,
  getMaxIgnore,
  getPrivateMessageMaxLength,
} from "./data/live/social-live";
export {
  getActivityTimeoutMs,
  getRequestCooldownMs,
  getRequestTimeoutMs,
} from "./data/live/trading-live";
export { ELEMENTAL_STAVES, RUNE_NAMES, VALID_RUNES } from "./data/runes";
export { runesRegistry } from "./runes/index";
export { GameEventType, EventStore } from "./systems/shared/EventStore";
export type {
  GameEvent,
  EntitySnapshot,
  CombatSnapshot,
  GameSnapshot,
  GameStateInfo,
  EventStoreConfig,
} from "./systems/shared/EventStore";
export {
  GRAVESTONE_ID_PREFIX,
  ITEMS_KEPT_ON_DEATH,
  isPositionInBounds,
  sanitizeKilledBy,
  splitItemsForSafeDeath,
  // DeathUtils.validatePosition collides with ValidationUtils.validatePosition
  // (already exported earlier in this file). index.ts aliases this one
  // as `validateDeathPosition` — mirror that contract here.
  validatePosition as validateDeathPosition,
} from "./systems/shared/combat/DeathUtils";
export {
  chaseStep,
  getChasePathfinder,
} from "./systems/shared/movement/ChasePathfinding";
export { getCachedTimestamp } from "./systems/shared/movement/ObjectPools";
export {
  DEFAULT_DUEL_RULES,
  DEFAULT_EQUIPMENT_RESTRICTIONS,
  DUEL_CHALLENGE_TIMEOUT_MS,
  DuelErrorCode,
  validateRuleCombination,
} from "./types/game/duel-types";
export { isValidPrayerTogglePayload } from "./types/game/prayer-types";
export { PlayerIdMapper } from "./utils/PlayerIdMapper";
export {
  getGlobalCullingManager,
  getGlobalTerrainComputeContext,
  isNetworkingComputeAvailable,
  NetworkingComputeContext,
} from "./utils/compute";
export {
  calculateDamage,
  calculateHitChance,
  calculateRetaliationDelay,
  isAttackOnCooldownTicks,
} from "./utils/game/CombatCalculations";
export {
  getStatsComponent,
  requireStatsComponent,
} from "./utils/game/ComponentUtils";
export { getEntityPosition } from "./utils/game/EntityPositionUtils";
export {
  calculateTileDistance,
  createProjectile,
} from "./utils/game/HitDelayCalculator";
export { quaternionPool } from "./utils/pools/QuaternionPool";
export { tilePool } from "./utils/pools/TilePool";
export { resolveStarterTownArea } from "./world-areas";
