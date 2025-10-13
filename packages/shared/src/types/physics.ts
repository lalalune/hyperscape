import type { default as PhysX } from '@hyperscape/physx-js-webidl';
import THREE from '../extras/three';
import type { System } from '../systems/System';
import type { Collider, Entity, HotReloadable } from './index';
import type { User } from './networking';

// Re-export the PhysX namespace for direct access
export type { default as PhysX } from '@hyperscape/physx-js-webidl';

// Re-export HotReloadable for entities
export type { HotReloadable };

// Helper type for the loaded PhysX module
export type PhysXModule = Awaited<ReturnType<typeof PhysX>>

// Core PhysX types - direct aliases to avoid duplication
export type PxVec3 = PhysX.PxVec3
export type PxQuat = PhysX.PxQuat  
export type PxTransform = PhysX.PxTransform

// Actor types
export type PxActor = PhysX.PxActor
export type PxRigidActor = PhysX.PxRigidActor
export type PxRigidBody = PhysX.PxRigidBody
export type PxRigidDynamic = PhysX.PxRigidDynamic
export type PxRigidStatic = PhysX.PxRigidStatic

// Core PhysX objects
export type PxPhysics = PhysX.PxPhysics
export type PxScene = PhysX.PxScene
export type PxFoundation = PhysX.PxFoundation
export type PxTolerancesScale = PhysX.PxTolerancesScale
export type PxCookingParams = PhysX.PxCookingParams
export type PxDefaultAllocator = PhysX.PxDefaultAllocator
export type PxDefaultErrorCallback = PhysX.PxDefaultErrorCallback

// Shape and material types
export type PxShape = PhysX.PxShape
export type PxMaterial = PhysX.PxMaterial
export type PxFilterData = PhysX.PxFilterData
export type PxQueryFilterData = PhysX.PxQueryFilterData

// Geometry types
export type PxGeometry = PhysX.PxGeometry
export type PxBoxGeometry = PhysX.PxBoxGeometry
export type PxSphereGeometry = PhysX.PxSphereGeometry
export type PxCapsuleGeometry = PhysX.PxCapsuleGeometry
export type PxPlaneGeometry = PhysX.PxPlaneGeometry
export type PxConvexMeshGeometry = PhysX.PxConvexMeshGeometry
export type PxTriangleMeshGeometry = PhysX.PxTriangleMeshGeometry
export type PxHeightFieldGeometry = PhysX.PxHeightFieldGeometry

// Controller types
export type PxController = PhysX.PxController
export type PxControllerManager = PhysX.PxControllerManager
export type PxControllerDesc = PhysX.PxControllerDesc
export type PxCapsuleControllerDesc = PhysX.PxCapsuleControllerDesc
export type PxBoxControllerDesc = PhysX.PxBoxControllerDesc
export type PxControllerFilters = PhysX.PxControllerFilters
export type PxControllerCollisionFlags = PhysX.PxControllerCollisionFlags
export type PxExtendedVec3 = PhysX.PxExtendedVec3
export type PxObstacleContext = PhysX.PxObstacleContext

// Hit result types
export type PxRaycastHit = PhysX.PxRaycastHit
export type PxSweepHit = PhysX.PxSweepHit
export type PxOverlapHit = PhysX.PxOverlapHit
export type PxRaycastResult = PhysX.PxRaycastResult
export type PxSweepResult = PhysX.PxSweepResult
export type PxOverlapResult = PhysX.PxOverlapResult

// Event callback types
export type PxSimulationEventCallback = PhysX.PxSimulationEventCallback
export type PxContactPair = PhysX.PxContactPair
export type PxContactPairHeader = PhysX.PxContactPairHeader
export type PxTriggerPair = PhysX.PxTriggerPair
export type PxContactPairPoint = PhysX.PxContactPairPoint

// Scene description types
export type PxSceneDesc = PhysX.PxSceneDesc
export type PxSceneFlags = PhysX.PxSceneFlags

// Enum types
export type PxForceModeEnum = PhysX.PxForceModeEnum
export type PxRigidBodyFlagEnum = PhysX.PxRigidBodyFlagEnum
export type PxShapeFlagEnum = PhysX.PxShapeFlagEnum
export type PxActorFlagEnum = PhysX.PxActorFlagEnum
export type PxHitFlags = PhysX.PxHitFlags

// PhysX factory result interface
export interface PhysXInfo {
  version: number
  allocator: PxDefaultAllocator
  errorCb: PxDefaultErrorCallback
  foundation: PxFoundation
  physics: PxPhysics
  cooking?: unknown // Optional - not available in all PhysX builds
}

// Strong type assertions for PhysX components
export interface PhysXRigidBodyActor extends PxRigidDynamic {
  setGlobalPose(pose: PxTransform): void
  getGlobalPose(): PxTransform
}

export interface PhysXController extends PxController {
  getActor(): PxRigidDynamic
  setFootPosition(position: PxExtendedVec3): boolean
  move(
    disp: PxVec3,
    minDist: number,
    elapsedTime: number,
    filters: PxControllerFilters,
    obstacles?: PxObstacleContext
  ): PxControllerCollisionFlags
}

// Collision callback interfaces - strongly typed
// PhysX-native contact event for low-level callbacks
export interface PhysXContactEvent {
  bodyA: PxActor
  bodyB: PxActor
  shapeA: PxShape
  shapeB: PxShape
  contactPoints: PxContactPairPoint[]
  eventType: 'contact_found' | 'contact_lost' | 'contact_persist'
}

// PhysX-native trigger event for low-level callbacks
export interface PhysXTriggerEvent {
  triggerShape: PxShape
  otherShape: PxShape
  triggerActor: PxActor
  otherActor: PxActor
  eventType: 'trigger_enter' | 'trigger_exit'
}

// Additional collision callback types with Three.js integration
export interface ContactCallbackObject {
  bodyA: PxActor
  bodyB: PxActor
  shapeA: PxShape
  shapeB: PxShape
  contactPoints: Array<{
    position: THREE.Vector3
    normal: THREE.Vector3
    impulse: THREE.Vector3
    separation: number
  }>
  pairFlags: number
  eventType: string
}

export interface TriggerCallbackObject {
  triggerShape: PxShape
  otherShape: PxShape
  triggerActor: PxActor
  otherActor: PxActor
  eventType: string
}
// Geometry to PhysX mesh conversion interfaces
export interface GeometryPhysXMesh {
  release: () => void;
}

export interface GeometryCacheItem {
  id: string;
  pmesh: GeometryPhysXMesh;
  refs: number;
}

export interface PMeshHandle {
  pmesh: GeometryPhysXMesh;
  addRef: () => void;
  release: () => void;
}

// Client UI interfaces
export interface UIState {
  visible: boolean;
  locked: boolean;
  activePanel: string | null;
  panels: Set<string>;
  callbacks: Map<string, () => void>;
}

export interface ControlWithRelease {
  name: string;
  release?: () => void;
}

// ClientActions interfaces
export interface ActionHandler {
  node: THREE.Object3D;
  handler: (event: { point: THREE.Vector3; normal: THREE.Vector3 }) => void;
}

// Camera system interfaces
export interface PlayerTarget extends THREE.Object3D {
  matrixWorld: THREE.Matrix4;
}

export interface RendererWithDomElement {
  domElement: HTMLElement;
}

export interface UISystemWithCameraRegister extends System {
  registerCameraControls?: (element: HTMLElement) => void;
}

export interface ControlsWithEnabled extends System {
  enabled?: boolean;
}

// Wind system interfaces
export interface WindUniforms {
  time: { value: number };
  windDirection: { value: THREE.Vector3 };
  windStrength: { value: number };
  windFrequency: { value: number };
}

// TerrainSystem interface in system-interfaces.ts is the full system interface

export interface PhysicsSystemWithRaycast extends System {
  raycast?: (origin: THREE.Vector3, direction: THREE.Vector3, maxDistance: number, layers?: number) => unknown;
}

export interface GroundCheckResult {
  isGrounded: boolean;
  groundHeight: number;
  groundNormal?: THREE.Vector3;
  distance: number;
}

export interface GroundCheckEntity {
  position: THREE.Vector3;
  lastGroundCheck?: GroundCheckResult;
}

// Nametag system interfaces (runtime data)
export interface NametagData {
  text: string;
  subtext?: string;
  subtextColor?: string;
  position: THREE.Vector3;
  offset: number;
  visible: boolean;
  priority: number;
  element?: HTMLDivElement;
  lastUpdate?: number;
}

// Spatial index interfaces (ID-based variant)
export interface SpatialCellById {
  entities: Set<string>;
}

export interface SpatialQueryById {
  center: THREE.Vector3;
  radius: number;
  filter?: (entityId: string) => boolean;
}

// ClientTarget interfaces
export interface DOMRect {
  left: number;
  top: number;
  width: number;
  height: number;
}

export interface HTMLDivElement {
  style: CSSStyleDeclaration;
  getBoundingClientRect: () => DOMRect;
}

// Time system interfaces
export interface TimeConfig {
  dayDuration?: number; // Real seconds for a full day cycle
  startHour?: number; // Starting hour (0-23)
  timeScale?: number; // Time multiplier
}

// Server network interfaces
export interface NodeWebSocket extends WebSocket {
  isAlive?: boolean;
  userId?: string;
  terminate?: () => void;
}

export interface NetworkWithSocket {
  socket?: NodeWebSocket;
  close?: () => void;
}

export interface DatabaseInterface {
  users?: {
    get: (userId: string) => Promise<User | null>;
    set: (userId: string, data: User) => Promise<void>;
    delete: (userId: string) => Promise<void>;
  };
  worlds?: {
    get: (worldId: string) => Promise<unknown>;
    set: (worldId: string, data: unknown) => Promise<void>;
  };
}

// User moved to network-types.ts to avoid duplication

// NetworkEntity moved to network-types.ts to avoid duplication

// Terrain validation interfaces
export interface TerrainValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
  suggestions: string[];
}

// TerrainChunk moved to validation-types.ts to avoid duplication

// Curve manager interfaces
export interface CurveManagerOptions {
  divisions?: number;
  closed?: boolean;
  tension?: number;
}

// Camera interpolation interfaces (simple target for interpolation)
export interface SimpleCameraTarget {
  position: THREE.Vector3;
  quaternion: THREE.Quaternion;
  zoom: number;
}

export interface SimpleCamera {
  position: THREE.Vector3;
  quaternion: THREE.Quaternion;
  zoom: number;
}

// BufferedLerpQuaternion interfaces
export interface Sample {
  time: number;
  value: THREE.Quaternion;
}

// Layers interfaces
export interface Layer {
  group: number;
  mask: number;
}

export interface LayersType {
  camera?: Layer;
  player?: Layer;
  environment?: Layer;
  prop?: Layer;
  tool?: Layer;
  [key: string]: Layer | undefined;
}

// LooseOctree interfaces
export interface OctreeItem {
  sphere?: THREE.Sphere;
  geometry: THREE.BufferGeometry;
  material: THREE.Material | THREE.Material[];
  matrix: THREE.Matrix4;
  getEntity: () => unknown;
  node?: unknown;
  _node?: {
    canContain?: (item: OctreeItem) => boolean;
    checkCollapse?: () => void;
    remove?: (item: OctreeItem) => void;
  };
}

export interface RenderHelperItem {
  idx: number;
  matrix: THREE.Matrix4;
}

export interface OctreeHelper {
  init: () => void;
  insert: (node: unknown) => void;
  remove: (node: unknown) => void;
  destroy: () => void;
}

export interface ExtendedIntersection extends THREE.Intersection {
  getEntity?: () => unknown;
  node?: unknown;
}

export interface ShaderModifier {
  vertexShader: string;
}

export interface LooseOctreeOptions {
  maxDepth?: number;
  maxItemsPerNode?: number;
  looseness?: number;
  bounds?: { min: THREE.Vector3; max: THREE.Vector3 };
}

export interface HelperItem {
  position: THREE.Vector3;
  radius: number;
}

// Player proxy interfaces
export interface PlayerEffect {
  anchorId?: string;
  emote?: string;
  snare?: number;
  freeze?: boolean;
  turn?: boolean;
  duration?: number;
  cancellable?: boolean;
}

export interface EffectOptions {
  anchor?: { anchorId: string };
  emote?: string;
  snare?: number;
  freeze?: boolean;
  turn?: boolean;
  duration?: number;
  cancellable?: boolean;
  onEnd?: () => void;
}

// Player touch interfaces
export interface PlayerTouch {
  id: number;
  x: number;
  y: number;
  pressure: number;
  position?: { x: number; y: number };
  delta?: { x: number; y: number };
}

export interface StickState {
  active: boolean;
  angle: number;
  distance: number;
}

export interface PlayerStickState {
  touch: PlayerTouch;
  center: { x: number; y: number };
}

export interface NodeDataFromGLB {
  type: string;
  name?: string;
  position?: [number, number, number];
  rotation?: [number, number, number];
  scale?: [number, number, number];
  [key: string]: unknown;
}

// Contact/Trigger events
// Engine-level simplified contact event used across systems
export interface ContactEvent {
  tag: string | null;
  playerId: string | null;
  contacts?: Array<{
    position: THREE.Vector3;
    normal: THREE.Vector3;
    impulse: THREE.Vector3;
  }>;
}

// Engine-level simplified trigger event used across systems
export interface TriggerEvent {
  tag: string | null;
  playerId: string | null;
}

// Physics handles
export interface InterpolationData {
  prev: { position: THREE.Vector3; quaternion: THREE.Quaternion };
  next: { position: THREE.Vector3; quaternion: THREE.Quaternion };
  curr: { position: THREE.Vector3; quaternion: THREE.Quaternion };
  skip?: boolean;
}

export interface BasePhysicsHandle {
  actor?: PxActor | PxRigidDynamic;
  tag?: string;
  playerId?: string;
  controller?: boolean;
  node?: unknown;
  onContactStart?: (event: ContactEvent) => void;
  onContactEnd?: (event: ContactEvent) => void;
  onTriggerEnter?: (event: TriggerEvent) => void;
  onTriggerLeave?: (event: TriggerEvent) => void;
  contactedHandles: Set<PhysicsHandle>;
  triggeredHandles: Set<PhysicsHandle>;
}

export interface InterpolatedPhysicsHandle extends BasePhysicsHandle {
  onInterpolate: (position: THREE.Vector3, quaternion: THREE.Quaternion) => void;
  interpolation: InterpolationData;
}

export interface NonInterpolatedPhysicsHandle extends BasePhysicsHandle {
  onInterpolate?: undefined;
  interpolation?: undefined;
}

export type PhysicsHandle = InterpolatedPhysicsHandle | NonInterpolatedPhysicsHandle;

// Raycast/Sweep hits
export interface PhysicsRaycastHit {
  handle?: PhysicsHandle;
  point: THREE.Vector3;
  normal: THREE.Vector3;
  distance: number;
  collider: Collider;
  entity?: Entity;
}

export interface PhysicsSweepHit {
  actor: PxActor | PxRigidDynamic;
  point: THREE.Vector3;
  normal: THREE.Vector3;
  distance: number;
  collider: Collider;
  entity?: Entity;
  handle?: unknown;
}

export interface PhysicsOverlapHit {
  actor: PxActor | PxRigidDynamic;
  handle: PhysicsHandle | null;
  proxy?: {
    get tag(): string | null;
    get playerId(): string | null;
  };
}

// Collision validation and ground clamping shared types
export interface CollisionError {
  type: 'missing_collision' | 'height_mismatch' | 'invalid_geometry' | 'underground_entity' | 'floating_entity';
  position: { x: number; y: number; z: number }
  severity: 'critical' | 'warning' | 'info';
  message: string;
  timestamp: number;
  expectedHeight?: number;
  actualHeight?: number;
  heightDifference?: number;
  entityId?: string;
}

export interface CollisionValidationResult {
  isValid: boolean;
  errors: CollisionError[];
  totalChecks: number;
  successfulChecks: number;
  averageHeight: number;
  maxHeightDifference: number;
  validationTime: number;
}

export interface GroundClampingOptions {
  raycastDistance?: number;
  verticalOffset?: number;
  layerMask?: number;
  allowUnderground?: boolean;
  snapToSurface?: boolean;
  smoothing?: boolean;
  smoothingFactor?: number;
}

export interface EntityGroundState {
  entityId: string;
  position: { x: number; y: number; z: number }
  groundHeight: number;
  isOnGround: boolean;
  isUnderground: boolean;
  isFloating: boolean;
  lastGroundContact: number;
  verticalVelocity: number;
  groundNormal: { x: number; y: number; z: number }
  surfaceType: string;
}

// Actor handle
export interface ActorHandle {
  move: (matrix: THREE.Matrix4) => void;
  snap: (pose: PxTransform) => void;
  destroy: () => void;
}

// Contact/Trigger info
export interface ContactInfo {
  handle0: PhysicsHandle;
  handle1: PhysicsHandle;
  positions: THREE.Vector3[];
  normals: THREE.Vector3[];
  impulses: number[];
}

export interface TriggerInfo {
  handle0: PhysicsHandle;
  handle1: PhysicsHandle;
}

// Utility interfaces for polymorphic THREE.js objects
export interface Vector3Like {
  x: number;
  y: number;
  z: number;
  copy?(v: THREE.Vector3): void;
}

export interface QuaternionLike {
  x: number;
  y: number;
  z: number;
  w: number;
  copy?(q: THREE.Quaternion): void;
}

// System capability interfaces (minimal hot reload support)
export interface MinimalHotReloadable {
  hotReload?(): void;
}

export interface CameraSystem {
  target?: unknown;
  setTarget(player: unknown): void;
  removeTarget(player: unknown): void;
  resetCamera(): void;
  getCamera(): THREE.PerspectiveCamera;
  update(delta: number): void;
}

// XRSystem interface in system-interfaces.ts is the full system interface
export interface XRSessionState {
  session?: unknown;
  camera?: THREE.Camera;
}

// VRM factory interfaces
export interface VRMHooks {
  scene: THREE.Scene;
  octree?: {
    insert: (item: unknown) => void;
    move?: (item: unknown) => void;
    remove?: (item: unknown) => void;
  };
  camera?: unknown;
  loader?: unknown;
}

// Global THREE.js interface
export interface GlobalWithTHREE {
  THREE?: typeof THREE;
  __THREE_DEVTOOLS__?: unknown;
}

// Material extensions for texture access
export interface MaterialWithTextures extends THREE.Material {
  alphaMap?: THREE.Texture;
  aoMap?: THREE.Texture;
  bumpMap?: THREE.Texture;
  displacementMap?: THREE.Texture;
  emissiveMap?: THREE.Texture;
  envMap?: THREE.Texture;
  lightMap?: THREE.Texture;
  map?: THREE.Texture;
  metalnessMap?: THREE.Texture;
  normalMap?: THREE.Texture;
  roughnessMap?: THREE.Texture;
}