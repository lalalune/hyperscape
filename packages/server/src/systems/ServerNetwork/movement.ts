/**
 * Movement Module
 *
 * Handles server-authoritative player movement:
 * - Click-to-move pathfinding
 * - Linear interpolation toward target
 * - Terrain grounding during movement
 * - Movement state broadcasting
 *
 * This module extracts movement logic from ServerNetwork
 * to improve maintainability and separation of concerns.
 */

import type { ServerSocket } from "../../shared/types";
import { THREE, TerrainSystem, World } from "@hyperscape/shared";

interface MoveTarget {
  target: THREE.Vector3;
  maxSpeed: number;
  lastUpdate: number;
}

/**
 * Movement state manager for server-authoritative movement
 *
 * Performance: Uses object pooling for Vector3 targets to reduce GC pressure.
 * When a player's movement is updated, we reuse their existing target vector
 * if possible, otherwise allocate from a pool. Also caches terrain system
 * reference to avoid repeated lookups.
 */
export class MovementManager {
  private moveTargets: Map<string, MoveTarget> = new Map();
  private _tempVec3 = new THREE.Vector3();
  private _tempVec3Fwd = new THREE.Vector3(0, 0, -1);
  private _tempQuat = new THREE.Quaternion();
  /** Pool of reusable Vector3 objects for movement targets */
  private _vector3Pool: THREE.Vector3[] = [];
  /** Maximum pool size to prevent unbounded growth */
  private static readonly MAX_POOL_SIZE = 50;
  /** Cached terrain system reference (lazy initialized) */
  private _terrainSystem: InstanceType<typeof TerrainSystem> | null = null;
  private _terrainSystemLookedUp = false;

  constructor(
    private world: World,
    private sendFn: (
      name: string,
      data: unknown,
      ignoreSocketId?: string,
    ) => void,
  ) {}

  /**
   * Get terrain system (cached after first lookup)
   */
  private getTerrain(): InstanceType<typeof TerrainSystem> | null {
    if (!this._terrainSystemLookedUp) {
      this._terrainSystem = this.world.getSystem("terrain") as InstanceType<
        typeof TerrainSystem
      > | null;
      this._terrainSystemLookedUp = true;
    }
    return this._terrainSystem;
  }

  /**
   * Get a Vector3 from the pool or create a new one
   */
  private acquireVector3(x: number, y: number, z: number): THREE.Vector3 {
    const vec = this._vector3Pool.pop();
    if (vec) {
      return vec.set(x, y, z);
    }
    return new THREE.Vector3(x, y, z);
  }

  /**
   * Return a Vector3 to the pool for reuse
   */
  private releaseVector3(vec: THREE.Vector3): void {
    if (this._vector3Pool.length < MovementManager.MAX_POOL_SIZE) {
      this._vector3Pool.push(vec);
    }
  }

  /**
   * Update all active movements (called every frame)
   */
  update(dt: number): void {
    const now = Date.now();
    const toDelete: string[] = [];

    this.moveTargets.forEach((info, playerId) => {
      const entity = this.world.entities.get(playerId);
      if (!entity || !entity.position) {
        toDelete.push(playerId);
        return;
      }

      const current = entity.position;
      const target = info.target;
      const dx = target.x - current.x;
      const dz = target.z - current.z;
      const distSquared = dx * dx + dz * dz;

      // Check if arrived (using squared distance to avoid sqrt when near target)
      // 0.3^2 = 0.09
      if (distSquared < 0.09) {
        // Arrived at target
        // Clamp final Y to terrain
        let finalY = target.y;
        const terrainFinal = this.getTerrain();
        if (terrainFinal) {
          const th = terrainFinal.getHeightAt(target.x, target.z);
          if (Number.isFinite(th)) finalY = (th as number) + 0.1;
        }
        entity.position.set(target.x, finalY, target.z);
        entity.data.position = [target.x, finalY, target.z];
        entity.data.velocity = [0, 0, 0];
        toDelete.push(playerId);

        // Broadcast final idle state
        this.sendFn("entityModified", {
          id: playerId,
          changes: {
            p: [target.x, finalY, target.z],
            v: [0, 0, 0],
            e: "idle",
          },
        });
        return;
      }

      // Compute actual distance now (only for entities still moving)
      const dist = Math.sqrt(distSquared);

      // Simple linear interpolation toward target
      const speed = info.maxSpeed;
      const moveDistance = Math.min(dist, speed * dt);

      // Calculate direction and new position
      const normalizedDx = dx / dist;
      const normalizedDz = dz / dist;
      const nx = current.x + normalizedDx * moveDistance;
      const nz = current.z + normalizedDz * moveDistance;

      // Clamp Y to terrain height (slightly above)
      let ny = target.y;
      const terrain = this.getTerrain();
      if (terrain) {
        const th = terrain.getHeightAt(nx, nz);
        if (Number.isFinite(th)) ny = (th as number) + 0.1;
      }

      // Update position
      entity.position.set(nx, ny, nz);
      entity.data.position = [nx, ny, nz];

      // Calculate velocity for animation
      const velocity = normalizedDx * speed;
      const velZ = normalizedDz * speed;
      entity.data.velocity = [velocity, 0, velZ];

      // Simple rotation toward movement direction
      if (entity.node) {
        // Use two separate temp vectors to avoid overwriting
        const dir = this._tempVec3.set(normalizedDx, 0, normalizedDz);
        this._tempVec3Fwd.set(0, 0, -1);
        this._tempQuat.setFromUnitVectors(this._tempVec3Fwd, dir);
        entity.node.quaternion.copy(this._tempQuat);
        entity.data.quaternion = [
          this._tempQuat.x,
          this._tempQuat.y,
          this._tempQuat.z,
          this._tempQuat.w,
        ];
      }

      // Broadcast update at ~30fps
      if (!info.lastUpdate || now - info.lastUpdate >= 33) {
        info.lastUpdate = now;

        const currentSpeed = Math.sqrt(velocity * velocity + velZ * velZ);
        const emote = currentSpeed > 4 ? "run" : "walk";

        this.sendFn("entityModified", {
          id: playerId,
          changes: {
            p: [nx, ny, nz],
            q: entity.data.quaternion,
            v: [velocity, 0, velZ],
            e: emote,
          },
        });
      }
    });

    // Release completed movement vectors back to pool
    for (const id of toDelete) {
      const entry = this.moveTargets.get(id);
      if (entry) {
        this.releaseVector3(entry.target);
        this.moveTargets.delete(id);
      }
    }
  }

  /**
   * Handle move request from client
   */
  handleMoveRequest(socket: ServerSocket, data: unknown): void {
    const playerEntity = socket.player;
    if (!playerEntity) {
      console.warn(
        `[MovementManager] ⚠️ moveRequest ignored - socket ${socket.id} has no player entity attached`,
      );
      return;
    }

    const payload = data as {
      target?: number[] | null;
      runMode?: boolean;
      cancel?: boolean;
    };

    // Handle cancellation
    if (payload?.cancel || payload?.target === null) {
      const entry = this.moveTargets.get(playerEntity.id);
      if (entry) {
        this.releaseVector3(entry.target);
        this.moveTargets.delete(playerEntity.id);
      }
      const curr = playerEntity.position;
      this.sendFn("entityModified", {
        id: playerEntity.id,
        changes: {
          p: [curr.x, curr.y, curr.z],
          v: [0, 0, 0],
          e: "idle",
        },
      });
      return;
    }

    const t = Array.isArray(payload?.target)
      ? (payload!.target as [number, number, number])
      : null;
    // If only runMode is provided, update current movement speed/emote without changing target
    if (!t) {
      if (payload?.runMode !== undefined) {
        const info = this.moveTargets.get(playerEntity.id);
        if (info) {
          info.maxSpeed = payload.runMode ? 8 : 4;
          // Update emote immediately
          this.sendFn("entityModified", {
            id: playerEntity.id,
            changes: { e: payload.runMode ? "run" : "walk" },
          });
        }
      }
      return;
    }

    const maxSpeed = payload?.runMode ? 8 : 4;

    // Check if player already has a movement entry - reuse its Vector3
    const existingEntry = this.moveTargets.get(playerEntity.id);
    let target: THREE.Vector3;
    if (existingEntry) {
      // Reuse existing vector
      target = existingEntry.target.set(t[0], t[1], t[2]);
      existingEntry.maxSpeed = maxSpeed;
      existingEntry.lastUpdate = 0;
    } else {
      // Acquire from pool or create new
      target = this.acquireVector3(t[0], t[1], t[2]);
      this.moveTargets.set(playerEntity.id, {
        target,
        maxSpeed,
        lastUpdate: 0,
      });
    }

    // Immediately rotate the player to face the new target and broadcast state
    const curr = playerEntity.position;
    const dx = target.x - curr.x;
    const dz = target.z - curr.z;
    if (Math.abs(dx) + Math.abs(dz) > 1e-4) {
      const dir = this._tempVec3.set(dx, 0, dz).normalize();
      this._tempVec3Fwd.set(0, 0, -1);
      this._tempQuat.setFromUnitVectors(this._tempVec3Fwd, dir);
      if (playerEntity.node) {
        playerEntity.node.quaternion.copy(this._tempQuat);
      }
      playerEntity.data.quaternion = [
        this._tempQuat.x,
        this._tempQuat.y,
        this._tempQuat.z,
        this._tempQuat.w,
      ];
    }
    this.sendFn("entityModified", {
      id: playerEntity.id,
      changes: {
        p: [curr.x, curr.y, curr.z],
        q: playerEntity.data.quaternion,
        v: [0, 0, 0],
        e: payload?.runMode ? "run" : "walk",
      },
    });
  }

  /**
   * Handle legacy input packet (routes to move request)
   */
  handleInput(socket: ServerSocket, data: unknown): void {
    const playerEntity = socket.player;
    if (!playerEntity) {
      return;
    }

    // The payload from a modern client is a 'moveRequest' style object.
    const payload = data as {
      type?: string;
      target?: number[];
      runMode?: boolean;
    };
    if (payload.type === "click" && Array.isArray(payload.target)) {
      this.handleMoveRequest(socket, {
        target: payload.target,
        runMode: payload.runMode,
      });
    }
  }

  /**
   * Cleanup movement state for a player
   */
  cleanup(playerId: string): void {
    const entry = this.moveTargets.get(playerId);
    if (entry) {
      this.releaseVector3(entry.target);
      this.moveTargets.delete(playerId);
    }
  }
}
