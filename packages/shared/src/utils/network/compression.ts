/**
 * Network compression: Position (24 bytes → 8 bytes), Quaternion (32 bytes → 4 bytes).
 * Position precision: ~0.6mm XZ, ~4mm Y. Quaternion precision: ~0.14° error.
 */

export const WORLD_SIZE = 10000;
export const WORLD_HALF = WORLD_SIZE / 2;
export const HEIGHT_MIN = -50;
export const HEIGHT_RANGE = 256;

const XZ_SCALE = 0xffffff / WORLD_SIZE;
const Y_SCALE = 0xffff / HEIGHT_RANGE;

const COMPONENT_BITS = 10;
const COMPONENT_MAX = (1 << COMPONENT_BITS) - 1;
const COMPONENT_RANGE = Math.SQRT1_2;
export function packPosition(
  x: number,
  y: number,
  z: number,
): { buffer: ArrayBuffer; bytes: Uint8Array } {
  const buffer = new ArrayBuffer(8);
  const view = new DataView(buffer);

  const qx = Math.round(
    Math.max(0, Math.min(0xffffff, (x + WORLD_HALF) * XZ_SCALE)),
  );
  view.setUint8(0, qx & 0xff);
  view.setUint8(1, (qx >> 8) & 0xff);
  view.setUint8(2, (qx >> 16) & 0xff);

  const qz = Math.round(
    Math.max(0, Math.min(0xffffff, (z + WORLD_HALF) * XZ_SCALE)),
  );
  view.setUint8(3, qz & 0xff);
  view.setUint8(4, (qz >> 8) & 0xff);
  view.setUint8(5, (qz >> 16) & 0xff);

  const qy = Math.round(
    Math.max(0, Math.min(0xffff, (y - HEIGHT_MIN) * Y_SCALE)),
  );
  view.setUint16(6, qy, true);

  return { buffer, bytes: new Uint8Array(buffer) };
}

export function unpackPosition(buffer: ArrayBuffer): {
  x: number;
  y: number;
  z: number;
} {
  const view = new DataView(buffer);
  const qx =
    view.getUint8(0) | (view.getUint8(1) << 8) | (view.getUint8(2) << 16);
  const qz =
    view.getUint8(3) | (view.getUint8(4) << 8) | (view.getUint8(5) << 16);
  const qy = view.getUint16(6, true);

  return {
    x: qx / XZ_SCALE - WORLD_HALF,
    y: qy / Y_SCALE + HEIGHT_MIN,
    z: qz / XZ_SCALE - WORLD_HALF,
  };
}

export function packPositionInto(
  bytes: Uint8Array,
  offset: number,
  x: number,
  y: number,
  z: number,
): void {
  const qx = Math.round(
    Math.max(0, Math.min(0xffffff, (x + WORLD_HALF) * XZ_SCALE)),
  );
  bytes[offset] = qx & 0xff;
  bytes[offset + 1] = (qx >> 8) & 0xff;
  bytes[offset + 2] = (qx >> 16) & 0xff;

  const qz = Math.round(
    Math.max(0, Math.min(0xffffff, (z + WORLD_HALF) * XZ_SCALE)),
  );
  bytes[offset + 3] = qz & 0xff;
  bytes[offset + 4] = (qz >> 8) & 0xff;
  bytes[offset + 5] = (qz >> 16) & 0xff;

  const qy = Math.round(
    Math.max(0, Math.min(0xffff, (y - HEIGHT_MIN) * Y_SCALE)),
  );
  bytes[offset + 6] = qy & 0xff;
  bytes[offset + 7] = (qy >> 8) & 0xff;
}

export function unpackPositionFrom(
  bytes: Uint8Array,
  offset: number,
): { x: number; y: number; z: number } {
  const qx =
    bytes[offset] | (bytes[offset + 1] << 8) | (bytes[offset + 2] << 16);
  const qz =
    bytes[offset + 3] | (bytes[offset + 4] << 8) | (bytes[offset + 5] << 16);
  const qy = bytes[offset + 6] | (bytes[offset + 7] << 8);

  return {
    x: qx / XZ_SCALE - WORLD_HALF,
    y: qy / Y_SCALE + HEIGHT_MIN,
    z: qz / XZ_SCALE - WORLD_HALF,
  };
}
export function packQuaternion(
  x: number,
  y: number,
  z: number,
  w: number,
): number {
  const components = [x, y, z, w];

  let maxIdx = 0;
  let maxVal = Math.abs(components[0]);
  for (let i = 1; i < 4; i++) {
    const absVal = Math.abs(components[i]);
    if (absVal > maxVal) {
      maxVal = absVal;
      maxIdx = i;
    }
  }

  const sign = components[maxIdx] < 0 ? -1 : 1;

  const quantized: number[] = [];
  for (let i = 0; i < 4; i++) {
    if (i !== maxIdx) {
      const normalized = (components[i] * sign) / COMPONENT_RANGE;
      const q = Math.round((normalized + 1) * 0.5 * COMPONENT_MAX);
      quantized.push(Math.max(0, Math.min(COMPONENT_MAX, q)));
    }
  }

  return (
    (maxIdx & 0x3) |
    (quantized[0] << 2) |
    (quantized[1] << 12) |
    (quantized[2] << 22)
  );
}

export function unpackQuaternion(packed: number): {
  x: number;
  y: number;
  z: number;
  w: number;
} {
  const maxIdx = packed & 0x3;
  const q0 = (packed >> 2) & 0x3ff;
  const q1 = (packed >> 12) & 0x3ff;
  const q2 = (packed >> 22) & 0x3ff;

  const components = [
    ((q0 / COMPONENT_MAX) * 2 - 1) * COMPONENT_RANGE,
    ((q1 / COMPONENT_MAX) * 2 - 1) * COMPONENT_RANGE,
    ((q2 / COMPONENT_MAX) * 2 - 1) * COMPONENT_RANGE,
  ];

  const sumSq = components[0] ** 2 + components[1] ** 2 + components[2] ** 2;
  const largest = Math.sqrt(Math.max(0, 1 - sumSq));

  const result = [0, 0, 0, 0];
  let smallIdx = 0;
  for (let i = 0; i < 4; i++) {
    if (i === maxIdx) {
      result[i] = largest;
    } else {
      result[i] = components[smallIdx++];
    }
  }

  return { x: result[0], y: result[1], z: result[2], w: result[3] };
}

export function packQuaternionInto(
  bytes: Uint8Array,
  offset: number,
  x: number,
  y: number,
  z: number,
  w: number,
): void {
  const packed = packQuaternion(x, y, z, w);
  bytes[offset] = packed & 0xff;
  bytes[offset + 1] = (packed >> 8) & 0xff;
  bytes[offset + 2] = (packed >> 16) & 0xff;
  bytes[offset + 3] = (packed >> 24) & 0xff;
}

export function unpackQuaternionFrom(
  bytes: Uint8Array,
  offset: number,
): { x: number; y: number; z: number; w: number } {
  const packed =
    bytes[offset] |
    (bytes[offset + 1] << 8) |
    (bytes[offset + 2] << 16) |
    (bytes[offset + 3] << 24);
  return unpackQuaternion(packed);
}

export const COMPRESSED_POSITION_SIZE = 8;
export const COMPRESSED_QUATERNION_SIZE = 4;
export const COMPRESSED_TRANSFORM_SIZE =
  COMPRESSED_POSITION_SIZE + COMPRESSED_QUATERNION_SIZE;

export interface CompressedTransform {
  positionBytes: Uint8Array;
  quaternionPacked: number;
}

export function packTransform(
  position: { x: number; y: number; z: number },
  quaternion: { x: number; y: number; z: number; w: number },
): CompressedTransform {
  const { bytes } = packPosition(position.x, position.y, position.z);
  const packed = packQuaternion(
    quaternion.x,
    quaternion.y,
    quaternion.z,
    quaternion.w,
  );
  return { positionBytes: bytes, quaternionPacked: packed };
}

export function unpackTransform(
  positionBuffer: ArrayBuffer,
  quaternionPacked: number,
): {
  position: { x: number; y: number; z: number };
  quaternion: { x: number; y: number; z: number; w: number };
} {
  return {
    position: unpackPosition(positionBuffer),
    quaternion: unpackQuaternion(quaternionPacked),
  };
}

interface TransformEntry {
  entityIdHash: number;
  position: { x: number; y: number; z: number };
  quaternion: { x: number; y: number; z: number; w: number };
}

const TRANSFORM_ENTRY_SIZE = 16;

export function packTransformBatch(transforms: TransformEntry[]): Uint8Array {
  const buffer = new Uint8Array(transforms.length * TRANSFORM_ENTRY_SIZE);
  const view = new DataView(buffer.buffer);

  for (let i = 0; i < transforms.length; i++) {
    const offset = i * TRANSFORM_ENTRY_SIZE;
    const t = transforms[i];
    view.setUint32(offset, t.entityIdHash, true);
    packPositionInto(
      buffer,
      offset + 4,
      t.position.x,
      t.position.y,
      t.position.z,
    );
    packQuaternionInto(
      buffer,
      offset + 12,
      t.quaternion.x,
      t.quaternion.y,
      t.quaternion.z,
      t.quaternion.w,
    );
  }

  return buffer;
}

export function unpackTransformBatch(buffer: Uint8Array): TransformEntry[] {
  const count = buffer.length / TRANSFORM_ENTRY_SIZE;
  const view = new DataView(
    buffer.buffer,
    buffer.byteOffset,
    buffer.byteLength,
  );
  const result: TransformEntry[] = [];

  for (let i = 0; i < count; i++) {
    const offset = i * TRANSFORM_ENTRY_SIZE;
    result.push({
      entityIdHash: view.getUint32(offset, true),
      position: unpackPositionFrom(buffer, offset + 4),
      quaternion: unpackQuaternionFrom(buffer, offset + 12),
    });
  }

  return result;
}

export function hashEntityId(entityId: string): number {
  let hash = 0;
  for (let i = 0; i < entityId.length; i++) {
    hash = (hash << 5) - hash + entityId.charCodeAt(i);
    hash = hash & hash;
  }
  return hash >>> 0;
}

// =====================================================================
// BATCH UPDATE PARSING (Client-side parsing of server batch updates)
// =====================================================================

export enum UpdateFlags {
  NONE = 0,
  POSITION = 1 << 0,
  ROTATION = 1 << 1,
  HEALTH = 1 << 2,
  STATE = 1 << 3,
  VELOCITY = 1 << 4,
}

export interface ParsedUpdate {
  entityIdHash: number;
  flags: UpdateFlags;
  position?: { x: number; y: number; z: number };
  quaternion?: { x: number; y: number; z: number; w: number };
  health?: { current: number; max: number };
  state?: number;
}

const BATCH_HEADER_SIZE = 2;
const ENTITY_HEADER_SIZE = 5;

/**
 * Parse a batch update from the server
 * Format: [count:u16] [updates...]
 * Each update: [entityIdHash:u32] [flags:u8] [position?:8B] [quaternion?:4B] [health?:4B] [state?:1B]
 */
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
    if (offset + ENTITY_HEADER_SIZE > buffer.length) break;

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
