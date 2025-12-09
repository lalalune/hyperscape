/**
 * Networking Types
 *
 * Type definitions for network communication:
 * - Movement and input commands (Source Engine-inspired)
 * - State snapshots and prediction
 * - Network messages and connections
 * - Sockets and sessions
 * - Packet system
 */

import type { Vector3, Quaternion } from "three";
import type { EntityData, Entity } from "../../index";

// ============================================================================
// INPUT & MOVEMENT COMMANDS
// ============================================================================

/**
 * Input command sent from client to server
 * Follows Source Engine's usercmd structure
 */
export interface InputCommand {
  /** Monotonically increasing sequence number */
  sequence: number;

  /** Client timestamp when input was captured */
  timestamp: number;

  /** Server timestamp when received (set by server) */
  serverTimestamp?: number;

  /** Time since last input in seconds */
  deltaTime: number;

  /** Normalized movement direction in world space */
  moveVector: Vector3;

  /** Bit flags for buttons/actions */
  buttons: number;

  /** Camera/look direction */
  viewAngles: Quaternion;

  /** Checksum for validation (prevents tampering) */
  checksum?: number;
}

/**
 * Input button flags (bit field)
 */
export enum InputButtons {
  NONE = 0,
  FORWARD = 1 << 0,
  BACKWARD = 1 << 1,
  LEFT = 1 << 2,
  RIGHT = 1 << 3,
  JUMP = 1 << 4,
  CROUCH = 1 << 5,
  SPRINT = 1 << 6,
  USE = 1 << 7,
  ATTACK1 = 1 << 8,
  ATTACK2 = 1 << 9,
  RELOAD = 1 << 10,
  WALK = 1 << 11,
}

// ============================================================================
// PLAYER STATE & PREDICTION
// ============================================================================

/**
 * Movement states for animation and physics
 */
export enum MoveState {
  IDLE = 0,
  WALKING = 1,
  RUNNING = 2,
  SPRINTING = 3,
  JUMPING = 4,
  FALLING = 5,
  CROUCHING = 6,
  SLIDING = 7,
  CLIMBING = 8,
  SWIMMING = 9,
  FLYING = 10,
}

/**
 * Status effects that modify movement
 */
export interface StatusEffects {
  speedMultiplier: number;
  jumpMultiplier: number;
  gravityMultiplier: number;
  canMove: boolean;
  canJump: boolean;
  activeEffects: EffectType[];
}

/**
 * Types of effects that can be applied
 */
export enum EffectType {
  SPEED_BOOST = "speed_boost",
  SLOW = "slow",
  ROOT = "root",
  STUN = "stun",
  LEVITATE = "levitate",
  HASTE = "haste",
  SNARE = "snare",
  FREEZE = "freeze",
}

/**
 * Complete player state snapshot
 * Used for both prediction and networking
 */
export interface PlayerStateSnapshot {
  sequence: number;
  timestamp: number;
  position: Vector3;
  velocity: Vector3;
  acceleration: Vector3;
  rotation: Quaternion;
  moveState: MoveState;
  grounded: boolean;
  health: number;
  effects: StatusEffects;
  groundNormal?: Vector3;
  airTime?: number;
}

/**
 * Frame of prediction data
 * Stores input and resulting state for reconciliation
 */
export interface PredictionFrame {
  input: InputCommand;
  resultState: PlayerStateSnapshot;
  corrections: number;
  lastError?: number;
}

// ============================================================================
// NETWORK PACKETS & COMPRESSION
// ============================================================================

/**
 * Network packet types for movement
 */
export enum MovementPacketType {
  INPUT = "input",
  STATE_UPDATE = "state_update",
  DELTA_UPDATE = "delta_update",
  FULL_SNAPSHOT = "full_snapshot",
  INPUT_ACK = "input_ack",
  CORRECTION = "correction",
}

/**
 * Delta compressed state update
 */
export interface DeltaUpdate {
  baseSequence: number;
  targetSequence: number;
  changedFields: number;
  positionDelta?: [number, number, number];
  velocityDelta?: [number, number, number];
  rotation?: [number, number, number, number];
  moveState?: MoveState;
  effects?: StatusEffects;
}

/**
 * Server correction packet
 */
export interface ServerCorrection {
  sequence: number;
  correctState: PlayerStateSnapshot;
  reason: CorrectionReason;
}

/**
 * Reasons for server corrections
 */
export enum CorrectionReason {
  POSITION_ERROR = "position_error",
  VELOCITY_ERROR = "velocity_error",
  ILLEGAL_MOVE = "illegal_move",
  COLLISION = "collision",
  TELEPORT = "teleport",
  EFFECT_APPLIED = "effect_applied",
}

// ============================================================================
// NETWORK MESSAGES & CONNECTIONS
// ============================================================================

/**
 * Base message type
 */
export interface NetworkMessage<T = unknown> {
  type: string;
  data: T;
  timestamp: number;
  senderId?: string;
  reliable?: boolean;
}

/**
 * Specific message data types
 */
export interface EntityAddedData {
  data: EntityData;
}

export interface EntityRemovedData {
  entityId: string;
}

export interface EntityModifiedData {
  entityId: string;
  updates: Partial<EntityData>;
}

export interface EntitySnapshotData {
  id: string;
  position: Vector3;
  rotation: Quaternion;
  velocity?: Vector3;
}

export interface WorldSnapshotData {
  entities: EntitySnapshotData[];
  timestamp: number;
}

export interface FullWorldStateData {
  entities: Array<{
    id: string;
    data: EntityData;
  }>;
  timestamp: number;
}

/**
 * Type-safe message type map
 */
export interface NetworkMessageMap {
  entityAdded: NetworkMessage<EntityAddedData>;
  entityRemoved: NetworkMessage<EntityRemovedData>;
  entityModified: NetworkMessage<EntityModifiedData>;
  snapshot: NetworkMessage<WorldSnapshotData>;
  spawnModified: NetworkMessage<FullWorldStateData>;
}

/**
 * Type helper for message handlers
 */
export type MessageHandler<K extends keyof NetworkMessageMap> = (
  message: NetworkMessageMap[K],
) => void;

/**
 * Connection interface
 */
export interface NetworkConnection {
  id: string;
  latency: number;
  connected: boolean;

  send<K extends keyof NetworkMessageMap>(message: NetworkMessageMap[K]): void;
  send(message: NetworkMessage): void;
  disconnect(): void;
}

// ============================================================================
// SOCKETS & SESSIONS
// ============================================================================

/**
 * Connection and spawn data
 */
export interface ConnectionParams {
  authToken?: string;
  name?: string;
  avatar?: string;
}

export interface SpawnData {
  position: [number, number, number];
  quaternion: [number, number, number, number];
}

/**
 * Socket type for server
 */
export interface Socket {
  id: string;
  userId?: string;
  isAlive?: boolean;
  alive: boolean;
  closed: boolean;
  disconnected: boolean;
  send: <T>(name: string, data: T) => void;
  close: () => void;
  player?: Entity;
}

/**
 * Node WebSocket with additional methods
 */
export interface NodeWebSocket extends WebSocket {
  on(event: string, listener: Function): void;
  ping(): void;
  terminate(): void;
}

export interface NetworkWithSocket {
  enqueue(socket: Socket, method: string, data: unknown): void;
  onDisconnect(socket: Socket, code?: number | string): void;
}

export interface SocketOptions {
  id: string;
  ws: NodeWebSocket;
  network: NetworkWithSocket;
  player?: import("../../index").Entity;
}

// ============================================================================
// NETWORK METRICS & VALIDATION
// ============================================================================

/**
 * Network quality metrics
 */
export interface NetworkMetrics {
  rtt: number;
  packetLoss: number;
  jitter: number;
  bandwidth: number;
  pendingReliable: number;
  timeSinceLastPacket: number;
}

/**
 * Movement validation result
 */
export interface MovementValidationResult {
  valid: boolean;
  reason?: string;
  correctedState?: PlayerStateSnapshot;
  severity?: ViolationSeverity;
}

/**
 * Severity levels for movement violations
 */
export enum ViolationSeverity {
  MINOR = 0,
  MODERATE = 1,
  MAJOR = 2,
  CRITICAL = 3,
}

// ============================================================================
// CONFIGURATION
// ============================================================================

/**
 * Player movement configuration
 */
export interface MovementConfig {
  // Physics
  gravity: number;
  groundFriction: number;
  airFriction: number;
  maxGroundSpeed: number;
  maxRunSpeed: number;
  maxSprintSpeed: number;
  maxAirSpeed: number;
  groundAcceleration: number;
  airAcceleration: number;
  jumpHeight: number;
  stepHeight: number;
  slopeLimit: number;

  // Networking
  serverTickRate: number;
  clientTickRate: number;
  interpolationDelay: number;
  extrapolationLimit: number;
  positionErrorThreshold: number;
  rotationErrorThreshold: number;

  // Buffers
  inputBufferSize: number;
  stateBufferSize: number;
  snapshotRate: number;

  // Anti-cheat
  maxSpeedTolerance: number;
  teleportThreshold: number;
  positionHistorySize: number;
}

// ============================================================================
// MISC TYPES
// ============================================================================

/**
 * Server statistics
 */
export interface ServerStats {
  currentCPU: number;
  currentMemory: number;
  maxMemory: number;
}

/**
 * Database user interface
 */
export interface User {
  id: string;
  name: string;
  avatar: string | null;
  roles: string | string[];
  createdAt: string;
}

/**
 * Network entity interface for multiplayer
 */
export interface NetworkEntity {
  id?: string;
  position?: unknown;
  rotation?: unknown;
  velocity?: unknown;
  serialize?: () => Record<string, unknown>;
}

/**
 * Packet system interfaces
 */
export interface PacketInfo {
  id: number;
  name: string;
  method: string;
}

// ============================================================================
// TYPE GUARDS
// ============================================================================

/**
 * Type guards for runtime validation
 */
export function isInputCommand(obj: unknown): obj is InputCommand {
  return (
    typeof obj === "object" &&
    obj !== null &&
    "sequence" in obj &&
    typeof (obj as { sequence?: unknown }).sequence === "number" &&
    "timestamp" in obj &&
    typeof (obj as { timestamp?: unknown }).timestamp === "number"
  );
}

export function isPlayerStateSnapshot(
  obj: unknown,
): obj is PlayerStateSnapshot {
  return (
    typeof obj === "object" &&
    obj !== null &&
    "sequence" in obj &&
    "position" in obj &&
    "velocity" in obj
  );
}

export function isDeltaUpdate(obj: unknown): obj is DeltaUpdate {
  return (
    typeof obj === "object" &&
    obj !== null &&
    "baseSequence" in obj &&
    "targetSequence" in obj &&
    "changedFields" in obj
  );
}
