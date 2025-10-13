/**
 * Movement configuration constants
 * Based on industry standards from Source Engine, Unreal, and Quake
 */

import type { MovementConfig as IMovementConfig } from '../types/networking';

/**
 * Default movement configuration
 * Tuned for responsive MMORPG-style movement
 */
export const MovementConfig: IMovementConfig = {
  // ============================================
  // Physics Configuration
  // ============================================
  
  /** Gravity acceleration (m/s²) - Earth standard */
  gravity: -9.81,
  
  /** Friction when on ground (higher = stops faster) */
  groundFriction: 6.0,
  
  /** Friction when in air (lower = more air control) */
  airFriction: 0.3,
  
  /** Maximum walking speed (m/s) */
  maxGroundSpeed: 5.0,
  
  /** Maximum running speed (m/s) */
  maxRunSpeed: 8.0,
  
  /** Maximum sprinting speed (m/s) */
  maxSprintSpeed: 12.0,
  
  /** Maximum speed while airborne (m/s) */
  maxAirSpeed: 7.0,
  
  /** Acceleration on ground (m/s²) */
  groundAcceleration: 10.0,
  
  /** Acceleration in air (m/s²) - lower for less air control */
  airAcceleration: 2.0,
  
  /** Jump height in meters */
  jumpHeight: 2.0,
  
  /** Maximum step height player can walk up (m) */
  stepHeight: 0.3,
  
  /** Maximum slope angle player can walk up (degrees) */
  slopeLimit: 45,
  
  // ============================================
  // Networking Configuration
  // ============================================
  
  /** Server simulation rate (Hz) - Industry standard 60Hz */
  serverTickRate: 60,
  
  /** Client simulation rate (Hz) - Match server for consistency */
  clientTickRate: 60,
  
  /** Interpolation delay (ms) - Buffer for smooth remote players */
  interpolationDelay: 100,
  
  /** Maximum extrapolation time (ms) - Prevent wild predictions */
  extrapolationLimit: 250,
  
  /** Position error before correction (meters) */
  positionErrorThreshold: 0.1,
  
  /** Rotation error before correction (degrees) */
  rotationErrorThreshold: 5,
  
  // ============================================
  // Buffer Sizes
  // ============================================
  
  /** Number of inputs to buffer (2 seconds at 60Hz) */
  inputBufferSize: 120,
  
  /** Number of states to keep for reconciliation (1 second) */
  stateBufferSize: 60,
  
  /** Rate of full snapshots (Hz) - Balance accuracy vs bandwidth */
  snapshotRate: 20,
  
  // ============================================
  // Anti-Cheat Configuration
  // ============================================
  
  /** Maximum speed tolerance (multiplier) - 10% leeway */
  maxSpeedTolerance: 1.1,
  
  /** Distance that triggers teleport detection (meters) */
  teleportThreshold: 5.0,
  
  /** Number of position history frames to track */
  positionHistorySize: 30,
};

/**
 * Development configuration with relaxed limits
 */
export const DevMovementConfig: IMovementConfig = {
  ...MovementConfig,
  maxSpeedTolerance: 2.0,        // Very lenient for testing
  teleportThreshold: 50.0,       // Allow debug teleports
  positionErrorThreshold: 1.0,   // Less strict corrections
};

/**
 * Competitive configuration with strict validation
 */
export const CompetitiveMovementConfig: IMovementConfig = {
  ...MovementConfig,
  serverTickRate: 128,            // High tick rate like CS:GO
  clientTickRate: 128,
  maxSpeedTolerance: 1.01,        // Very strict (1% tolerance)
  teleportThreshold: 2.0,         // Strict teleport detection
  positionErrorThreshold: 0.05,   // Very precise
  interpolationDelay: 50,         // Lower delay for competitive
};

/**
 * High latency configuration for poor connections
 */
export const HighLatencyMovementConfig: IMovementConfig = {
  ...MovementConfig,
  interpolationDelay: 200,        // More buffer for smoothness
  extrapolationLimit: 500,        // Allow more prediction
  positionErrorThreshold: 0.5,    // More lenient corrections
  inputBufferSize: 240,           // Larger buffer for packet loss
};

/**
 * Get configuration based on environment
 */
export function getMovementConfig(): IMovementConfig {
  const env = process.env.NODE_ENV;
  const mode = process.env.GAME_MODE;
  
  if (env === 'development') {
    return DevMovementConfig;
  }
  
  if (mode === 'competitive') {
    return CompetitiveMovementConfig;
  }
  
  // Check network quality and adapt
  if (typeof window !== 'undefined' && 'connection' in navigator) {
    const connection = (navigator as { connection?: { rtt?: number } }).connection;
    if (connection && connection.rtt && connection.rtt > 200) {
      return HighLatencyMovementConfig;
    }
  }
  
  return MovementConfig;
}

/**
 * Calculate derived physics values
 */
export class MovementPhysics {
  /**
   * Calculate jump velocity from desired height
   */
  static getJumpVelocity(height: number, gravity: number): number {
    return Math.sqrt(2 * Math.abs(gravity) * height);
  }
  
  /**
   * Calculate time to reach peak of jump
   */
  static getJumpTime(height: number, gravity: number): number {
    const velocity = this.getJumpVelocity(height, gravity);
    return velocity / Math.abs(gravity);
  }
  
  /**
   * Calculate stopping distance
   */
  static getStoppingDistance(speed: number, friction: number): number {
    return (speed * speed) / (2 * friction);
  }
  
  /**
   * Calculate time to reach max speed
   */
  static getAccelerationTime(targetSpeed: number, acceleration: number): number {
    return targetSpeed / acceleration;
  }
  
  /**
   * Apply friction to velocity
   */
  static applyFriction(velocity: number, friction: number, deltaTime: number): number {
    const drop = velocity * friction * deltaTime;
    return Math.max(0, velocity - drop);
  }
  
  /**
   * Accelerate in a direction
   */
  static accelerate(
    currentVelocity: number,
    wishSpeed: number,
    acceleration: number,
    deltaTime: number
  ): number {
    const addSpeed = wishSpeed - currentVelocity;
    if (addSpeed <= 0) return currentVelocity;
    
    let accelSpeed = acceleration * deltaTime * wishSpeed;
    if (accelSpeed > addSpeed) {
      accelSpeed = addSpeed;
    }
    
    return currentVelocity + accelSpeed;
  }
}

/**
 * Network timing utilities
 */
export class NetworkTiming {
  /**
   * Get interpolation time for rendering entities
   */
  static getInterpolationTime(
    serverTime: number,
    interpolationDelay: number
  ): number {
    return serverTime - interpolationDelay;
  }
  
  /**
   * Calculate server time from client time and offset
   */
  static getServerTime(
    clientTime: number,
    serverTimeOffset: number
  ): number {
    return clientTime + serverTimeOffset;
  }
  
  /**
   * Get tick interval in milliseconds
   */
  static getTickInterval(tickRate: number): number {
    return 1000 / tickRate;
  }
  
  /**
   * Quantize time to nearest tick
   */
  static quantizeToTick(time: number, tickRate: number): number {
    const interval = this.getTickInterval(tickRate);
    return Math.floor(time / interval) * interval;
  }
}

// Export singleton config
export const activeConfig = getMovementConfig();

