/**
 * Optimized Broadcast Manager - Integrates AOI, throttling, and batching for MMORPG-scale.
 */

import type { ServerSocket } from "../../shared/types";
import { writePacket } from "@hyperscape/shared";
import { AOIManager, AOISubscriptionChanges } from "./AOIManager";
import {
  UpdateThrottler,
  UpdatePriority,
  distance2DSquared,
} from "./UpdateThrottler";
import { BatchUpdater } from "./BatchUpdater";

export interface OptimizedBroadcastConfig {
  cellSize?: number;
  viewDistance?: number;
  enableAOI?: boolean;
  enableThrottling?: boolean;
  enableBatching?: boolean;
}

export interface EntityUpdateData {
  position?: { x: number; y: number; z: number };
  quaternion?: { x: number; y: number; z: number; w: number };
  health?: { current: number; max: number };
  state?: number;
  priority?: UpdatePriority;
  force?: boolean;
}

interface PlayerOptimizationState {
  socketId: string;
  x: number;
  z: number;
  batcher: BatchUpdater;
}

export class OptimizedBroadcastManager {
  private sockets: Map<string, ServerSocket>;
  private aoi: AOIManager;
  private throttler: UpdateThrottler;
  private playerStates = new Map<string, PlayerOptimizationState>();
  private entityPositions = new Map<string, { x: number; z: number }>();
  private config: Required<OptimizedBroadcastConfig>;

  constructor(
    sockets: Map<string, ServerSocket>,
    config: OptimizedBroadcastConfig = {},
  ) {
    this.sockets = sockets;
    this.config = {
      cellSize: config.cellSize ?? 50,
      viewDistance: config.viewDistance ?? 2,
      enableAOI: config.enableAOI ?? true,
      enableThrottling: config.enableThrottling ?? true,
      enableBatching: config.enableBatching ?? true,
    };

    this.aoi = new AOIManager(this.config.cellSize, this.config.viewDistance);
    this.throttler = new UpdateThrottler();
  }

  registerPlayer(
    playerId: string,
    x: number,
    z: number,
    socketId: string,
  ): void {
    this.aoi.updatePlayerSubscriptions(playerId, x, z, socketId);
    this.playerStates.set(playerId, {
      socketId,
      x,
      z,
      batcher: new BatchUpdater(),
    });
  }

  updatePlayerPosition(
    playerId: string,
    x: number,
    z: number,
    socketId: string,
  ): AOISubscriptionChanges {
    const state = this.playerStates.get(playerId);
    if (state) {
      state.x = x;
      state.z = z;
    } else {
      this.registerPlayer(playerId, x, z, socketId);
    }

    return this.config.enableAOI
      ? this.aoi.updatePlayerSubscriptions(playerId, x, z, socketId)
      : { entered: [], exited: [] };
  }

  removePlayer(playerId: string): void {
    this.aoi.removePlayer(playerId);
    this.throttler.removePlayer(playerId);
    this.playerStates.delete(playerId);
  }

  updateEntityPosition(entityId: string, x: number, z: number): void {
    this.entityPositions.set(entityId, { x, z });
    if (this.config.enableAOI) {
      this.aoi.updateEntityPosition(entityId, x, z);
    }
  }

  removeEntity(entityId: string): void {
    this.aoi.removeEntity(entityId);
    this.throttler.removeEntity(entityId);
    this.entityPositions.delete(entityId);
  }

  queueEntityUpdate(entityId: string, data: EntityUpdateData): void {
    let entityPos = this.entityPositions.get(entityId);
    if (!entityPos && data.position) {
      entityPos = { x: data.position.x, z: data.position.z };
      this.entityPositions.set(entityId, entityPos);
    }

    const subscribers = this.config.enableAOI
      ? this.aoi.getSubscribersForEntity(entityId)
      : this.getAllPlayerSocketIds();

    const checkThrottle = this.config.enableThrottling && !data.force;
    const priority = data.priority ?? UpdatePriority.NORMAL;

    for (const socketId of subscribers) {
      const playerId = this.aoi.getPlayerForSocket(socketId);
      if (!playerId) continue;

      const playerState = this.playerStates.get(playerId);
      if (!playerState) continue;

      if (checkThrottle && entityPos) {
        const distSq = distance2DSquared(
          playerState.x,
          playerState.z,
          entityPos.x,
          entityPos.z,
        );
        if (
          !this.throttler.shouldUpdate(entityId, playerId, distSq, priority)
        ) {
          continue;
        }
      }

      if (this.config.enableBatching) {
        this.queueToBatcher(playerState.batcher, entityId, data);
      } else {
        const socket = this.sockets.get(socketId);
        if (socket) {
          socket.send("entityModified", { id: entityId, changes: data });
        }
      }
    }
  }

  private getAllPlayerSocketIds(): Set<string> {
    const ids = new Set<string>();
    for (const socket of this.sockets.values()) {
      if (socket.player) {
        ids.add(socket.id);
      }
    }
    return ids;
  }

  private queueToBatcher(
    batcher: BatchUpdater,
    entityId: string,
    data: EntityUpdateData,
  ): void {
    if (data.position && data.quaternion) {
      batcher.queueTransformUpdate(entityId, data.position, data.quaternion);
    } else {
      if (data.position) {
        batcher.queuePositionUpdate(
          entityId,
          data.position.x,
          data.position.y,
          data.position.z,
        );
      }
      if (data.quaternion) {
        batcher.queueRotationUpdate(
          entityId,
          data.quaternion.x,
          data.quaternion.y,
          data.quaternion.z,
          data.quaternion.w,
        );
      }
    }
    if (data.health) {
      batcher.queueHealthUpdate(entityId, data.health.current, data.health.max);
    }
    if (data.state !== undefined) {
      batcher.queueStateUpdate(entityId, data.state);
    }
  }

  flushUpdates(currentTick: number): void {
    this.throttler.setCurrentTick(currentTick);

    if (!this.config.enableBatching) return;

    for (const playerState of this.playerStates.values()) {
      const batch = playerState.batcher.flush();
      if (!batch) continue;

      const socket = this.sockets.get(playerState.socketId);
      if (socket) {
        socket.send("compressedUpdate", batch);
      }
    }
  }

  broadcastToEntitySubscribers<T>(
    entityId: string,
    name: string,
    data: T,
    ignoreSocketId?: string,
  ): number {
    const subscribers = this.config.enableAOI
      ? this.aoi.getSubscribersForEntity(entityId)
      : this.sockets.keys();

    const packet = writePacket(name, data);
    let sentCount = 0;

    for (const socketId of subscribers) {
      if (socketId === ignoreSocketId) continue;
      const socket = this.sockets.get(socketId);
      if (socket) {
        socket.sendPacket(packet);
        sentCount++;
      }
    }

    return sentCount;
  }

  broadcastToAll<T>(name: string, data: T, ignoreSocketId?: string): number {
    const packet = writePacket(name, data);
    let sentCount = 0;

    for (const socket of this.sockets.values()) {
      if (socket.id === ignoreSocketId) continue;
      socket.sendPacket(packet);
      sentCount++;
    }

    return sentCount;
  }

  sendToSocket<T>(socketId: string, name: string, data: T): boolean {
    const socket = this.sockets.get(socketId);
    if (!socket) return false;
    socket.send(name, data);
    return true;
  }

  getVisibleEntities(playerId: string): Set<string> {
    return this.aoi.getVisibleEntities(playerId);
  }

  getEntitiesInCells(cellKeys: string[]): Set<string> {
    return this.aoi.getEntitiesInCells(cellKeys);
  }

  getStats(): {
    aoi: ReturnType<AOIManager["getDebugInfo"]>;
    throttler: ReturnType<UpdateThrottler["getStats"]>;
    players: number;
    entities: number;
    config: Required<OptimizedBroadcastConfig>;
  } {
    return {
      aoi: this.aoi.getDebugInfo(),
      throttler: this.throttler.getStats(),
      players: this.playerStates.size,
      entities: this.entityPositions.size,
      config: this.config,
    };
  }

  clear(): void {
    this.aoi.clear();
    this.throttler.clear();
    this.playerStates.clear();
    this.entityPositions.clear();
  }
}
