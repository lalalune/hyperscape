/**
 * LerpVector3.ts - Linear Interpolation for Network Position Updates
 *
 * Smoothly interpolates between network position updates to hide network jitter.
 * Used by PlayerRemote to display smooth movement despite discrete network updates.
 *
 * How It Works:
 * - Server sends position updates at a fixed rate (e.g., 8Hz)
 * - Client receives discrete position snapshots
 * - LerpVector3 smoothly transitions between old and new positions
 * - Creates illusion of continuous movement
 *
 * Key Concepts:
 * - `previous`: Last confirmed position
 * - `current`: Newly received position (interpolation target)
 * - `value`: Current interpolated position (between previous and current)
 * - `time`: How much time has elapsed since receiving new position
 * - `rate`: Expected time between updates (e.g., 1/8 = 0.125 seconds for 8Hz)
 * - `alpha`: Interpolation factor (0 = previous, 1 = current)
 *
 * Snap Token:
 * - Detects teleportation (position jumps too far)
 * - When snapToken changes, immediately jumps to new position instead of interpolating
 * - Prevents interpolating across long distances (looks bad)
 *
 * Usage Example:
 * ```ts
 * const lerp = new LerpVector3(initialPosition, 1/8); // 8Hz updates
 *
 * // When network update arrives:
 * lerp.push(newPosition);
 *
 * // Every frame:
 * lerp.update(deltaTime);
 * mesh.position.copy(lerp.value); // Use interpolated value
 * ```
 *
 * Referenced by: PlayerRemote, network entity interpolation
 */

import THREE from "./three";

/**
 * Linear Interpolation Helper for Three.js Vector3
 *
 * Smoothly interpolates between discrete network position updates.
 */
export class LerpVector3 {
  /** Current interpolated position (use this for rendering) */
  value: THREE.Vector3;

  /** Expected time between network updates (e.g., 1/8 for 8Hz) */
  rate: number;

  /** Previous confirmed position (interpolation start) */
  previous: THREE.Vector3;

  /** Newly received position (interpolation target) */
  current: THREE.Vector3;

  /** Time elapsed since receiving current position */
  time: number;

  /** Token to detect teleportation/large position jumps */
  snapToken: unknown;

  /**
   * Create a new LerpVector3
   *
   * @param value - Initial position
   * @param rate - Expected time between updates (e.g., 1/8 for 8Hz network rate)
   */
  constructor(value: THREE.Vector3, rate: number) {
    this.value = new THREE.Vector3().copy(value);
    this.rate = rate;
    this.previous = new THREE.Vector3().copy(this.value);
    this.current = new THREE.Vector3().copy(this.value);
    this.time = 0;
    this.snapToken = null;
  }

  /**
   * Push New Network Position Update
   *
   * Called when a new position update arrives from the network.
   *
   * Snap Detection:
   * - If snapToken changes (teleport), immediately jump to new position
   * - If snapToken same (normal movement), interpolate from current to new
   *
   * @param value - New target position from network
   * @param snapToken - Teleport detection token (changes on teleport)
   */
  push(value: THREE.Vector3, snapToken: unknown = null) {
    if (this.snapToken !== snapToken) {
      // Snap! Token changed, this is a teleport
      this.snapToken = snapToken;
      this.previous.copy(value);
      this.current.copy(value);
      this.value.copy(value);
    } else {
      // Normal update: shift current to previous, set new current
      this.previous.copy(this.current);
      this.current.copy(value);
    }
    this.time = 0; // Reset interpolation timer
  }

  /**
   * Push New Position from Array
   *
   * Convenience method for network data in array format [x, y, z].
   *
   * @param value - Position as array [x, y, z]
   * @param snapToken - Teleport detection token
   */
  pushArray(value: number[], snapToken: unknown = null) {
    if (this.snapToken !== snapToken) {
      // Snap! This is a teleport
      this.snapToken = snapToken;
      this.previous.fromArray(value);
      this.current.fromArray(value);
      this.value.fromArray(value);
    } else {
      // Normal update
      this.previous.copy(this.current);
      this.current.fromArray(value);
    }
    this.time = 0;
  }

  /**
   * Update Interpolation
   *
   * Call this every frame to smoothly interpolate towards the current target.
   *
   * @param delta - Time since last update in seconds
   * @returns this (for method chaining)
   */
  update(delta: number) {
    this.time += delta;

    // Calculate interpolation factor (clamped to [0, 1])
    let alpha = this.time / this.rate;
    if (alpha > 1) alpha = 1;

    // Linear interpolation between previous and current
    this.value.lerpVectors(this.previous, this.current, alpha);

    return this;
  }

  /**
   * Snap to Current Position
   *
   * Immediately jumps to the current target position without interpolation.
   * Used when you want instant position updates (e.g., when anchored to another object).
   */
  snap() {
    this.previous.copy(this.current);
    this.value.copy(this.current);
    this.time = 0;
  }

  /**
   * Clear Interpolation State
   *
   * Resets interpolation to use current value as both previous and current.
   * Useful for pausing interpolation or resetting state.
   */
  clear() {
    this.previous.copy(this.value);
    this.current.copy(this.value);
    this.time = 0;
  }
}
