/**
 * QuaternionPool - Object pool for quaternions
 *
 * Eliminates allocations in hot paths like combat rotation.
 * Uses a simple pooling pattern with automatic growth.
 *
 * Performance characteristics:
 * - O(1) acquire/release operations
 * - Zero allocations after warmup (unless pool exhausted)
 * - Automatic pool growth when exhausted
 *
 * Usage:
 *   const quat = quaternionPool.acquire();
 *   quaternionPool.setYRotation(quat, angle);
 *   // ... use quat ...
 *   quaternionPool.release(quat);
 */

export interface PooledQuaternion {
  x: number;
  y: number;
  z: number;
  w: number;
  /** Internal pool index - do not modify */
  _poolIndex: number;
}

/**
 * Object pool for quaternions used in combat rotation.
 * Thread-safe within single tick (no async between acquire/release).
 */
class QuaternionPoolImpl {
  private pool: PooledQuaternion[] = [];
  private available: number[] = [];
  private readonly INITIAL_SIZE = 32;
  private readonly GROW_SIZE = 16;

  constructor() {
    this.grow(this.INITIAL_SIZE);
  }

  /**
   * Grow the pool by adding more quaternions
   */
  private grow(count: number): void {
    const startIndex = this.pool.length;
    for (let i = 0; i < count; i++) {
      const index = startIndex + i;
      this.pool.push({
        x: 0,
        y: 0,
        z: 0,
        w: 1, // Identity quaternion
        _poolIndex: index,
      });
      this.available.push(index);
    }
  }

  /**
   * Acquire a quaternion from the pool.
   * Returns a reset quaternion (identity: 0, 0, 0, 1).
   *
   * IMPORTANT: Must call release() when done to return to pool.
   */
  acquire(): PooledQuaternion {
    if (this.available.length === 0) {
      this.grow(this.GROW_SIZE);
    }
    const index = this.available.pop()!;
    return this.pool[index];
  }

  /**
   * Release a quaternion back to the pool.
   * Resets quaternion to identity before returning.
   */
  release(quat: PooledQuaternion): void {
    // Reset to identity
    quat.x = 0;
    quat.y = 0;
    quat.z = 0;
    quat.w = 1;
    this.available.push(quat._poolIndex);
  }

  /**
   * Set quaternion to Y-axis rotation (most common in combat).
   * Optimized helper that avoids trig function calls when possible.
   */
  setYRotation(quat: PooledQuaternion, angle: number): void {
    const halfAngle = angle / 2;
    quat.x = 0;
    quat.y = Math.sin(halfAngle);
    quat.z = 0;
    quat.w = Math.cos(halfAngle);
  }

  /**
   * Set quaternion from euler angles (radians).
   */
  setFromEuler(quat: PooledQuaternion, x: number, y: number, z: number): void {
    const c1 = Math.cos(x / 2);
    const c2 = Math.cos(y / 2);
    const c3 = Math.cos(z / 2);
    const s1 = Math.sin(x / 2);
    const s2 = Math.sin(y / 2);
    const s3 = Math.sin(z / 2);

    quat.x = s1 * c2 * c3 + c1 * s2 * s3;
    quat.y = c1 * s2 * c3 - s1 * c2 * s3;
    quat.z = c1 * c2 * s3 + s1 * s2 * c3;
    quat.w = c1 * c2 * c3 - s1 * s2 * s3;
  }

  /**
   * Copy values from another quaternion-like object.
   */
  copy(
    target: PooledQuaternion,
    source: { x: number; y: number; z: number; w: number },
  ): void {
    target.x = source.x;
    target.y = source.y;
    target.z = source.z;
    target.w = source.w;
  }

  /**
   * Get pool statistics (for monitoring/debugging).
   */
  getStats(): { total: number; available: number; inUse: number } {
    return {
      total: this.pool.length,
      available: this.available.length,
      inUse: this.pool.length - this.available.length,
    };
  }

  /**
   * Reset pool to initial state.
   * Use with caution - invalidates all acquired quaternions.
   */
  reset(): void {
    this.pool = [];
    this.available = [];
    this.grow(this.INITIAL_SIZE);
  }
}

/**
 * Global quaternion pool instance.
 * Use this singleton for all combat rotation operations.
 */
export const quaternionPool = new QuaternionPoolImpl();
