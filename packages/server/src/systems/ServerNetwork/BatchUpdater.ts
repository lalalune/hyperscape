/**
 * Batch Update System - Reduces WebSocket frames from N to 1 per tick per player.
 */

import {
  packPositionInto,
  packQuaternionInto,
  hashEntityId,
  COMPRESSED_POSITION_SIZE,
  COMPRESSED_QUATERNION_SIZE,
  unpackPositionFrom,
  unpackQuaternionFrom,
} from "@hyperscape/shared";

export enum UpdateFlags {
  NONE = 0,
  POSITION = 1 << 0,
  ROTATION = 1 << 1,
  HEALTH = 1 << 2,
  STATE = 1 << 3,
  VELOCITY = 1 << 4,
}

interface QueuedUpdate {
  entityIdHash: number;
  flags: UpdateFlags;
  position?: { x: number; y: number; z: number };
  quaternion?: { x: number; y: number; z: number; w: number };
  health?: { current: number; max: number };
  state?: number;
}

const MAX_UPDATES_PER_BATCH = 256;
const BATCH_HEADER_SIZE = 2;
const ENTITY_HEADER_SIZE = 5;

export class BatchUpdater {
  private updates = new Map<string, QueuedUpdate>();
  private buffer: Uint8Array | null = null;
  private maxSeenUpdates = 0;

  private getOrCreateUpdate(entityId: string): QueuedUpdate {
    let update = this.updates.get(entityId);
    if (!update) {
      update = {
        entityIdHash: hashEntityId(entityId),
        flags: UpdateFlags.NONE,
      };
      this.updates.set(entityId, update);
    }
    return update;
  }

  queuePositionUpdate(entityId: string, x: number, y: number, z: number): void {
    const update = this.getOrCreateUpdate(entityId);
    update.flags |= UpdateFlags.POSITION;
    update.position = { x, y, z };
  }

  queueRotationUpdate(
    entityId: string,
    x: number,
    y: number,
    z: number,
    w: number,
  ): void {
    const update = this.getOrCreateUpdate(entityId);
    update.flags |= UpdateFlags.ROTATION;
    update.quaternion = { x, y, z, w };
  }

  queueTransformUpdate(
    entityId: string,
    position: { x: number; y: number; z: number },
    quaternion: { x: number; y: number; z: number; w: number },
  ): void {
    const update = this.getOrCreateUpdate(entityId);
    update.flags |= UpdateFlags.POSITION | UpdateFlags.ROTATION;
    update.position = position;
    update.quaternion = quaternion;
  }

  queueHealthUpdate(entityId: string, current: number, max: number): void {
    const update = this.getOrCreateUpdate(entityId);
    update.flags |= UpdateFlags.HEALTH;
    update.health = { current, max };
  }

  queueStateUpdate(entityId: string, state: number): void {
    const update = this.getOrCreateUpdate(entityId);
    update.flags |= UpdateFlags.STATE;
    update.state = state;
  }

  private calculateUpdateSize(flags: UpdateFlags): number {
    let size = ENTITY_HEADER_SIZE;
    if (flags & UpdateFlags.POSITION) size += COMPRESSED_POSITION_SIZE;
    if (flags & UpdateFlags.ROTATION) size += COMPRESSED_QUATERNION_SIZE;
    if (flags & UpdateFlags.HEALTH) size += 4;
    if (flags & UpdateFlags.STATE) size += 1;
    return size;
  }

  flush(): Uint8Array | null {
    const count = Math.min(this.updates.size, MAX_UPDATES_PER_BATCH);
    if (count === 0) return null;

    this.maxSeenUpdates = Math.max(this.maxSeenUpdates, count);

    let requiredSize = BATCH_HEADER_SIZE;
    for (const update of this.updates.values()) {
      requiredSize += this.calculateUpdateSize(update.flags);
    }

    if (!this.buffer || this.buffer.length < requiredSize) {
      this.buffer = new Uint8Array(requiredSize + 256);
    }

    const buffer = this.buffer;
    const view = new DataView(buffer.buffer);

    view.setUint16(0, count, true);
    let offset = BATCH_HEADER_SIZE;

    let written = 0;
    for (const update of this.updates.values()) {
      if (written >= MAX_UPDATES_PER_BATCH) break;

      view.setUint32(offset, update.entityIdHash, true);
      offset += 4;

      buffer[offset++] = update.flags;

      if (update.flags & UpdateFlags.POSITION) {
        const pos = update.position!;
        packPositionInto(buffer, offset, pos.x, pos.y, pos.z);
        offset += COMPRESSED_POSITION_SIZE;
      }

      if (update.flags & UpdateFlags.ROTATION) {
        const quat = update.quaternion!;
        packQuaternionInto(buffer, offset, quat.x, quat.y, quat.z, quat.w);
        offset += COMPRESSED_QUATERNION_SIZE;
      }

      if (update.flags & UpdateFlags.HEALTH) {
        const health = update.health!;
        view.setUint16(offset, Math.round(health.current), true);
        view.setUint16(offset + 2, Math.round(health.max), true);
        offset += 4;
      }

      if (update.flags & UpdateFlags.STATE) {
        buffer[offset++] = update.state! & 0xff;
      }

      written++;
    }

    this.updates.clear();
    return buffer.subarray(0, offset);
  }

  getQueuedCount(): number {
    return this.updates.size;
  }

  hasUpdates(): boolean {
    return this.updates.size > 0;
  }

  clear(): void {
    this.updates.clear();
  }

  getStats(): {
    queuedUpdates: number;
    maxSeenUpdates: number;
    bufferSize: number;
  } {
    return {
      queuedUpdates: this.updates.size,
      maxSeenUpdates: this.maxSeenUpdates,
      bufferSize: this.buffer?.length || 0,
    };
  }
}

interface ParsedUpdate {
  entityIdHash: number;
  flags: UpdateFlags;
  position?: { x: number; y: number; z: number };
  quaternion?: { x: number; y: number; z: number; w: number };
  health?: { current: number; max: number };
  state?: number;
}

export function parseBatchUpdate(buffer: Uint8Array): ParsedUpdate[] {
  const view = new DataView(
    buffer.buffer,
    buffer.byteOffset,
    buffer.byteLength,
  );
  const count = view.getUint16(0, true);
  const results: ParsedUpdate[] = [];

  let offset = BATCH_HEADER_SIZE;

  for (let i = 0; i < count; i++) {
    const entityIdHash = view.getUint32(offset, true);
    offset += 4;

    const flags = buffer[offset++] as UpdateFlags;
    const update: ParsedUpdate = { entityIdHash, flags };

    if (flags & UpdateFlags.POSITION) {
      update.position = unpackPositionFrom(buffer, offset);
      offset += COMPRESSED_POSITION_SIZE;
    }

    if (flags & UpdateFlags.ROTATION) {
      update.quaternion = unpackQuaternionFrom(buffer, offset);
      offset += COMPRESSED_QUATERNION_SIZE;
    }

    if (flags & UpdateFlags.HEALTH) {
      update.health = {
        current: view.getUint16(offset, true),
        max: view.getUint16(offset + 2, true),
      };
      offset += 4;
    }

    if (flags & UpdateFlags.STATE) {
      update.state = buffer[offset++];
    }

    results.push(update);
  }

  return results;
}
