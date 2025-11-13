/**
 * index.ts - @hyperscape/shared Package Entry Point
 *
 * This is the main export file for the Hyperscape 3D multiplayer game engine.
 * It provides a comprehensive public API for building 3D multiplayer games and applications.
 *
 * Package Purpose:
 * Hyperscape is a full-featured 3D multiplayer game engine built on three.js and PhysX.
 * It provides client-server architecture with authoritative physics, real-time voice chat,
 * VRM avatar support, and a complete RPG game framework.
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
 * Used by: Client package, Server package, Plugin-Hyperscape package
 */

// Export world factories from runtime/
export * from "./runtime";

// Export core classes
export * from "./core";

// Export entity classes
export { PlayerLocal } from "./entities/player/PlayerLocal";
export { PlayerRemote } from "./entities/player/PlayerRemote";
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
export { WeaponType, EquipmentSlotName } from "./types/core/core";

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

// Export item helpers used by server network snapshot
export { getItem } from "./data/items";

// Export systems (organized by platform for tree-shaking)
export { Entities } from "./systems/shared";
export { Physics } from "./systems/shared";
export { Particles } from "./systems/shared";
export { LODs } from "./systems/shared";
export { ClientInterface } from "./systems/client/ClientInterface"; // UI state, preferences, stats display
export { ClientLoader } from "./systems/client/ClientLoader";
// ServerNetwork removed from main exports - import directly from ./systems/server when needed on server side
export { Environment } from "./systems/shared";
export { ClientNetwork } from "./systems/client/ClientNetwork";
export { ClientGraphics } from "./systems/client/ClientGraphics";
export { ClientRuntime } from "./systems/client/ClientRuntime"; // Client lifecycle and diagnostics
export { ClientAudio } from "./systems/client/ClientAudio";
export { ClientLiveKit } from "./systems/client/ClientLiveKit";
export { ClientInput } from "./systems/client/ClientInput"; // Keyboard, mouse, touch, XR input handling
export { ServerRuntime } from "./systems/server/ServerRuntime"; // Server lifecycle and monitoring
export { ClientActions } from "./systems/client/ClientActions";
export { XR } from "./systems/client/XR";
export { EventBus } from "./systems/shared";
export { System as SystemClass } from "./systems/shared";
export { SystemBase } from "./systems/shared";

// Export node client components
export { ServerLoader } from "./systems/server/ServerLoader";
export { NodeClient } from "./systems/client/NodeClient";
export { Node } from "./nodes/Node";
// Re-export commonly used node classes to satisfy API extractor
export { UI } from "./nodes/UI";
export { UIView } from "./nodes/UIView";
export { Nametag } from "./nodes/Nametag";
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

// Export renderer utilities
export {
  createRenderer,
  configureRenderer,
  configureShadowMaps,
  configureXR,
  isWebGPURenderer,
  isWebGLRenderer,
  getRendererBackend,
  detectRenderingCapabilities,
  type UniversalRenderer,
  type RendererOptions,
} from "./utils/rendering/RendererFactory";

export {
  createPostProcessing,
  setBloomEnabled,
  disposePostProcessing,
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
export { ControlPriorities } from "./systems/client/ControlPriorities";
export { downloadFile } from "./utils/downloadFile";
export { Curve } from "./extras/animation/Curve";
export { buttons, propToLabel } from "./extras/ui/buttons";
// GLTFLoader export disabled due to TypeScript declaration generation issues
// Users can import it directly: import { GLTFLoader } from './libs/gltfloader/GLTFLoader';
export { CSM } from "./libs/csm/CSM";
export type { CSMOptions } from "./libs/csm/CSM";

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
  AttackType,
  CombatStyle,
  ItemType,
  ItemRarity,
  CombatBonuses,
  EquipmentSlot,
} from "./types/core/core";
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
// Export server-side NodeStorage from storage.server
// Note: This import uses the build-time path (relative to build directory)
export { NodeStorage } from "./storage.server";
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
  NametagData,
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
export type { SystemLogger } from "./utils/Logger";

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
export type {
  BaseEntityProperties,
  EntityType,
  InteractionType,
} from "./types/entities";

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

// Export physics utilities
export { installThreeJSExtensions } from "./utils/physics/PhysicsUtils";

// Export spawn utilities
export { CircularSpawnArea } from "./utils/physics/CircularSpawnArea";

// Export terrain system
export { TerrainSystem } from "./systems/shared";
