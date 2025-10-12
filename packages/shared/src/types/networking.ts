/**
 * Core networking types for multiplayer movement system
 * Following industry standards from Source Engine and Unreal
 */

import type { Vector3, Quaternion } from 'three';

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
 * Complete player state snapshot
 * Used for both prediction and networking
 */
export interface PlayerStateSnapshot {
  /** Sequence number this state corresponds to */
  sequence: number;
  
  /** Server timestamp for this state */
  timestamp: number;
  
  /** World position */
  position: Vector3;
  
  /** Current velocity */
  velocity: Vector3;
  
  /** Current acceleration */
  acceleration: Vector3;
  
  /** Player rotation */
  rotation: Quaternion;
  
  /** Current movement state */
  moveState: MoveState;
  
  /** Whether player is on ground */
  grounded: boolean;
  
  /** Current health */
  health: number;
  
  /** Active effects that modify movement */
  effects: StatusEffects;
  
  /** Last ground normal for slope handling */
  groundNormal?: Vector3;
  
  /** Time since last grounded */
  airTime?: number;
}

/**
 * Frame of prediction data
 * Stores input and resulting state for reconciliation
 */
export interface PredictionFrame {
  /** Input that created this prediction */
  input: InputCommand;
  
  /** Resulting state from input */
  resultState: PlayerStateSnapshot;
  
  /** Number of times this frame was corrected */
  corrections: number;
  
  /** Error magnitude when corrected */
  lastError?: number;
}

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
  FLYING = 10
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
  WALK = 1 << 11
}

/**
 * Status effects that modify movement
 */
export interface StatusEffects {
  /** Movement speed multiplier (1.0 = normal) */
  speedMultiplier: number;
  
  /** Jump height multiplier */
  jumpMultiplier: number;
  
  /** Gravity multiplier */
  gravityMultiplier: number;
  
  /** Whether player can move */
  canMove: boolean;
  
  /** Whether player can jump */
  canJump: boolean;
  
  /** Active buffs/debuffs */
  activeEffects: EffectType[];
}

/**
 * Types of effects that can be applied
 */
export enum EffectType {
  SPEED_BOOST = 'speed_boost',
  SLOW = 'slow',
  ROOT = 'root',
  STUN = 'stun',
  LEVITATE = 'levitate',
  HASTE = 'haste',
  SNARE = 'snare',
  FREEZE = 'freeze'
}

/**
 * Network packet types for movement
 */
export enum MovementPacketType {
  INPUT = 'input',
  STATE_UPDATE = 'state_update',
  DELTA_UPDATE = 'delta_update',
  FULL_SNAPSHOT = 'full_snapshot',
  INPUT_ACK = 'input_ack',
  CORRECTION = 'correction'
}

/**
 * Delta compressed state update
 */
export interface DeltaUpdate {
  /** Base sequence this delta is from */
  baseSequence: number;
  
  /** Target sequence */
  targetSequence: number;
  
  /** Bit field of changed properties */
  changedFields: number;
  
  /** Compressed position delta (if changed) */
  positionDelta?: [number, number, number];
  
  /** Compressed velocity delta (if changed) */
  velocityDelta?: [number, number, number];
  
  /** New rotation (if changed) */
  rotation?: [number, number, number, number];
  
  /** New move state (if changed) */
  moveState?: MoveState;
  
  /** New effects (if changed) */
  effects?: StatusEffects;
}

/**
 * Server correction packet
 */
export interface ServerCorrection {
  /** Client sequence being corrected */
  sequence: number;
  
  /** Correct state at that sequence */
  correctState: PlayerStateSnapshot;
  
  /** Reason for correction */
  reason: CorrectionReason;
}

/**
 * Reasons for server corrections
 */
export enum CorrectionReason {
  POSITION_ERROR = 'position_error',
  VELOCITY_ERROR = 'velocity_error',
  ILLEGAL_MOVE = 'illegal_move',
  COLLISION = 'collision',
  TELEPORT = 'teleport',
  EFFECT_APPLIED = 'effect_applied'
}

/**
 * Network quality metrics
 */
export interface NetworkMetrics {
  /** Round-trip time in milliseconds */
  rtt: number;
  
  /** Packet loss percentage (0-1) */
  packetLoss: number;
  
  /** Jitter in milliseconds */
  jitter: number;
  
  /** Bandwidth usage in bytes/second */
  bandwidth: number;
  
  /** Number of pending reliable packets */
  pendingReliable: number;
  
  /** Time since last received packet */
  timeSinceLastPacket: number;
}

/**
 * Movement validation result
 */
export interface ValidationResult {
  /** Whether movement is valid */
  valid: boolean;
  
  /** Reason if invalid */
  reason?: string;
  
  /** Corrected state if invalid */
  correctedState?: PlayerStateSnapshot;
  
  /** Severity of violation */
  severity?: ViolationSeverity;
}

/**
 * Severity levels for movement violations
 */
export enum ViolationSeverity {
  MINOR = 0,    // Small discrepancy, auto-correct
  MODERATE = 1, // Significant issue, log and correct
  MAJOR = 2,    // Serious violation, warn player
  CRITICAL = 3  // Definite cheat, kick player
}

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

/**
 * Type guards
 */
export function isInputCommand(obj: unknown): obj is InputCommand {
  return typeof obj === 'object' && obj !== null &&
    'sequence' in obj && typeof (obj as { sequence?: unknown }).sequence === 'number' &&
    'timestamp' in obj && typeof (obj as { timestamp?: unknown }).timestamp === 'number';
}

export function isPlayerStateSnapshot(obj: unknown): obj is PlayerStateSnapshot {
  return typeof obj === 'object' && obj !== null &&
    'sequence' in obj && 'position' in obj && 'velocity' in obj;
}

export function isDeltaUpdate(obj: unknown): obj is DeltaUpdate {
  return typeof obj === 'object' && obj !== null &&
    'baseSequence' in obj && 'targetSequence' in obj &&
    'changedFields' in obj;
}

