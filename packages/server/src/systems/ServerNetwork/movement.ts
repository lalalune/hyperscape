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

import type { ServerSocket } from "../types";
import { THREE, TerrainSystem, World } from "@hyperscape/shared";
import type { Vector3 } from "three";

interface MoveTarget {
  target: Vector3;
  maxSpeed: number;
  lastUpdate: number;
}

/**
 * Movement state manager for server-authoritative movement
 */
export class MovementManager {
  private moveTargets: Map<string, MoveTarget> = new Map();
  private _tempVec3 = new THREE.Vector3();
  private _tempVec3Fwd = new THREE.Vector3(0, 0, -1);
  private _tempQuat = new THREE.Quaternion();

  constructor(
    private world: World,
    private sendFn: (
      name: string,
      data: unknown,
      ignoreSocketId?: string,
    ) => void,
  ) {}

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
      const dist = Math.sqrt(dx * dx + dz * dz);

      // Check if arrived
      if (dist < 0.3) {
        // Arrived at target
        // Clamp final Y to terrain
        let finalY = target.y;
        const terrainFinal = this.world.getSystem("terrain") as InstanceType<
          typeof TerrainSystem
        > | null;
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
      const terrain = this.world.getSystem("terrain") as InstanceType<
        typeof TerrainSystem
      > | null;
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

        const speed = Math.sqrt(velocity * velocity + velZ * velZ);
        const emote = speed > 4 ? "run" : "walk";

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

    toDelete.forEach((id) => this.moveTargets.delete(id));
  }

  /**
   * Handle move request from client
   */
  handleMoveRequest(socket: ServerSocket, data: unknown): void {
    const playerEntity = socket.player;
    if (!playerEntity) return;

    const payload = data as {
      target?: number[] | null;
      runMode?: boolean;
      cancel?: boolean;
    };

    // Handle cancellation
    if (payload?.cancel || payload?.target === null) {
      this.moveTargets.delete(playerEntity.id);
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

    // Simple target creation - no complex terrain anchoring
    const target = new THREE.Vector3(t[0], t[1], t[2]);
    const maxSpeed = payload?.runMode ? 8 : 4;

    // Replace existing target completely (allows direction changes)
    this.moveTargets.set(playerEntity.id, {
      target,
      maxSpeed,
      lastUpdate: 0,
    });

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
    this.moveTargets.delete(playerId);
  }
}
