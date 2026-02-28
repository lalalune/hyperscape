/**
 * InterpolationEngine.ts - Entity Interpolation Subsystem
 *
 * Handles smooth interpolation of remote entity positions between server snapshots.
 * Extracted from ClientNetwork to isolate interpolation concerns.
 *
 * Key Features:
 * - Maintains circular buffer of position/rotation snapshots per entity
 * - Interpolates between snapshots for smooth 60 FPS rendering
 * - Extrapolates briefly when no new data arrives
 * - Skips entities controlled by TileInterpolator or in death state
 * - Pre-allocates all buffers to avoid GC pressure
 *
 * Architecture:
 * - Plain class (not a System subclass)
 * - Receives World reference for entity lookups
 * - ClientNetwork delegates all interpolation calls here
 */

import * as THREE from "../../../extras/three/three";
import type { World } from "../../../types";
import type { Entity } from "../../../entities/Entity";
import type { TileInterpolator } from "../TileInterpolator";

/**
 * Entity interpolation state for smooth remote entity movement
 */
export interface EntitySnapshot {
  position: Float32Array;
  rotation: Float32Array;
  timestamp: number;
}

/**
 * Tracks interpolation state for each remote entity
 */
export interface InterpolationState {
  entityId: string;
  snapshots: EntitySnapshot[];
  snapshotIndex: number;
  snapshotCount: number;
  currentPosition: THREE.Vector3;
  currentRotation: THREE.Quaternion;
  tempPosition: THREE.Vector3;
  tempRotation: THREE.Quaternion;
  /** Pre-allocated work quaternion for slerp interpolation (avoids allocation in hot path) */
  _slerpWorkQuat: THREE.Quaternion;
  lastUpdate: number;
}

/**
 * Interpolation engine for smooth remote entity movement.
 *
 * Maintains a circular buffer of server snapshots per entity and interpolates
 * between them to produce smooth visual positions at 60 FPS even though the
 * server sends updates at ~8 Hz.
 */
export class InterpolationEngine {
  /** Per-entity interpolation state (snapshot ring buffers + smoothed values) */
  readonly states: Map<string, InterpolationState> = new Map();

  /** Maximum snapshots kept per entity (circular buffer size) */
  private readonly maxSnapshots: number = 10;

  /** How far behind real-time to render (ms) - allows interpolation between snapshots */
  private readonly interpolationDelay: number = 100;

  /** Maximum time to extrapolate from the last snapshot (ms) */
  private readonly extrapolationLimit: number = 500;

  private readonly world: World;
  private readonly tileInterpolator: TileInterpolator;

  constructor(world: World, tileInterpolator: TileInterpolator) {
    this.world = world;
    this.tileInterpolator = tileInterpolator;
  }

  /**
   * Add a position/rotation snapshot for an entity from a server update.
   * Inserts into the circular buffer and advances the write index.
   */
  addSnapshot(
    entityId: string,
    changes: {
      p?: [number, number, number];
      q?: [number, number, number, number];
      v?: [number, number, number];
    },
  ): void {
    let state = this.states.get(entityId);
    if (!state) {
      state = this.createState(entityId);
      this.states.set(entityId, state);
    }

    const snapshot = state.snapshots[state.snapshotIndex];

    if (changes.p) {
      snapshot.position[0] = changes.p[0];
      snapshot.position[1] = changes.p[1];
      snapshot.position[2] = changes.p[2];
    }

    if (changes.q) {
      snapshot.rotation[0] = changes.q[0];
      snapshot.rotation[1] = changes.q[1];
      snapshot.rotation[2] = changes.q[2];
      snapshot.rotation[3] = changes.q[3];
    } else {
      snapshot.rotation[0] = state.currentRotation.x;
      snapshot.rotation[1] = state.currentRotation.y;
      snapshot.rotation[2] = state.currentRotation.z;
      snapshot.rotation[3] = state.currentRotation.w;
    }

    snapshot.timestamp = performance.now();
    state.snapshotIndex = (state.snapshotIndex + 1) % this.maxSnapshots;
    state.snapshotCount = Math.min(state.snapshotCount + 1, this.maxSnapshots);
    state.lastUpdate = performance.now();
  }

  /**
   * Create interpolation state with pre-allocated buffers
   */
  private createState(entityId: string): InterpolationState {
    const entity = this.world.entities.get(entityId);
    const position =
      entity && "position" in entity
        ? (entity.position as THREE.Vector3).clone()
        : new THREE.Vector3();

    const rotation = entity?.node?.quaternion
      ? entity.node.quaternion.clone()
      : new THREE.Quaternion();

    const snapshots: EntitySnapshot[] = [];
    for (let i = 0; i < this.maxSnapshots; i++) {
      snapshots.push({
        position: new Float32Array(3),
        rotation: new Float32Array(4),
        timestamp: 0,
      });
    }

    return {
      entityId,
      snapshots,
      snapshotIndex: 0,
      snapshotCount: 0,
      currentPosition: position,
      currentRotation: rotation,
      tempPosition: new THREE.Vector3(),
      tempRotation: new THREE.Quaternion(),
      _slerpWorkQuat: new THREE.Quaternion(),
      lastUpdate: performance.now(),
    };
  }

  /**
   * Update interpolation for all tracked remote entities.
   * Called once per frame from ClientNetwork.lateUpdate().
   */
  update(delta: number): void {
    const now = performance.now();
    const renderTime = now - this.interpolationDelay;

    for (const [entityId, state] of this.states) {
      // Skip local player - tile interpolation handles local player movement
      if (entityId === this.world.entities.player?.id) {
        this.states.delete(entityId);
        continue;
      }

      // Skip entities that have ANY tile interpolation state
      // Once an entity uses tile movement, ALL position updates should come from tile packets
      // Using hasState() instead of isInterpolating() prevents position conflicts when entity is stationary
      if (this.tileInterpolator.hasState(entityId)) {
        continue;
      }

      const entity = this.world.entities.get(entityId);
      if (!entity) {
        this.states.delete(entityId);
        continue;
      }

      // CRITICAL: Skip interpolation for entities controlled by TileInterpolator
      // TileInterpolator handles position and rotation for tile-based movement
      if (entity.data?.tileInterpolatorControlled === true) {
        continue; // Don't interpolate - TileInterpolator handles this entity
      }

      // CRITICAL: Skip interpolation for dead mobs to prevent death animation sliding
      // Dead mobs lock their position client-side for RuneScape-style stationary death
      // Access entity.data directly (avoid entity.serialize() which copies all fields)
      const entityData = entity.data as { aiState?: string } | null | undefined;
      if (entityData?.aiState === "dead") {
        continue; // Don't interpolate - let MobEntity maintain locked death position
      }

      this.interpolateEntityPosition(entity, state, renderTime, now, delta);
    }
  }

  /**
   * Interpolate entity position for smooth movement
   */
  private interpolateEntityPosition(
    entity: Entity,
    state: InterpolationState,
    renderTime: number,
    now: number,
    delta: number,
  ): void {
    if (state.snapshotCount < 2) {
      if (state.snapshotCount === 1) {
        const snapshot = state.snapshots[0];
        state.tempPosition.set(
          snapshot.position[0],
          snapshot.position[1],
          snapshot.position[2],
        );
        state.tempRotation.set(
          snapshot.rotation[0],
          snapshot.rotation[1],
          snapshot.rotation[2],
          snapshot.rotation[3],
        );
        this.applyInterpolated(
          entity,
          state.tempPosition,
          state.tempRotation,
          state,
          delta,
        );
      }
      return;
    }

    // Find two snapshots to interpolate between
    let older: EntitySnapshot | null = null;
    let newer: EntitySnapshot | null = null;

    for (let i = 0; i < state.snapshotCount - 1; i++) {
      const curr = state.snapshots[i];
      const next = state.snapshots[(i + 1) % this.maxSnapshots];

      if (curr.timestamp <= renderTime && next.timestamp >= renderTime) {
        older = curr;
        newer = next;
        break;
      }
    }

    if (older && newer) {
      const t =
        (renderTime - older.timestamp) / (newer.timestamp - older.timestamp);

      state.tempPosition.set(
        older.position[0] + (newer.position[0] - older.position[0]) * t,
        older.position[1] + (newer.position[1] - older.position[1]) * t,
        older.position[2] + (newer.position[2] - older.position[2]) * t,
      );

      // Proper slerp for quaternion interpolation (linear component lerp produces
      // non-uniform angular velocity and artifacts near 180° rotations)
      state._slerpWorkQuat.set(
        older.rotation[0],
        older.rotation[1],
        older.rotation[2],
        older.rotation[3],
      );
      state.tempRotation.set(
        newer.rotation[0],
        newer.rotation[1],
        newer.rotation[2],
        newer.rotation[3],
      );
      state._slerpWorkQuat.slerp(state.tempRotation, t);
      state.tempRotation.copy(state._slerpWorkQuat);

      this.applyInterpolated(
        entity,
        state.tempPosition,
        state.tempRotation,
        state,
        delta,
      );
    } else {
      // Use most recent snapshot
      const timeSinceUpdate = now - state.lastUpdate;
      if (timeSinceUpdate < this.extrapolationLimit) {
        const lastIndex =
          (state.snapshotIndex - 1 + this.maxSnapshots) % this.maxSnapshots;
        const last = state.snapshots[lastIndex];
        state.tempPosition.set(
          last.position[0],
          last.position[1],
          last.position[2],
        );
        state.tempRotation.set(
          last.rotation[0],
          last.rotation[1],
          last.rotation[2],
          last.rotation[3],
        );
        this.applyInterpolated(
          entity,
          state.tempPosition,
          state.tempRotation,
          state,
          delta,
        );
      }
    }
  }

  /**
   * Apply interpolated values to entity
   */
  private applyInterpolated(
    entity: Entity,
    position: THREE.Vector3,
    rotation: THREE.Quaternion,
    state: InterpolationState,
    delta: number,
  ): void {
    const smoothingRate = 5.0;
    const smoothingFactor = 1.0 - Math.exp(-smoothingRate * delta);

    state.currentPosition.lerp(position, smoothingFactor);
    state.currentRotation.slerp(rotation, smoothingFactor);

    if ("position" in entity) {
      const entityPos = entity.position as THREE.Vector3;
      entityPos.copy(state.currentPosition);
    }

    if (entity.node) {
      entity.node.position.copy(state.currentPosition);
      entity.node.quaternion.copy(state.currentRotation);
    }

    const player = entity as Entity & {
      base?: { position: THREE.Vector3; quaternion: THREE.Quaternion };
    };
    if (player.base) {
      player.base.position.copy(state.currentPosition);
      player.base.quaternion.copy(state.currentRotation);
    }
  }

  /**
   * Remove interpolation state for a specific entity.
   */
  removeEntity(entityId: string): void {
    this.states.delete(entityId);
  }

  /**
   * Check if an entity has interpolation state.
   */
  hasState(entityId: string): boolean {
    return this.states.has(entityId);
  }

  /**
   * Clear all interpolation state (e.g., on disconnect).
   */
  clear(): void {
    this.states.clear();
  }
}
