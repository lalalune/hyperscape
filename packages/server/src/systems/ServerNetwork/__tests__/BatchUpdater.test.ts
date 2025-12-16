/**
 * BatchUpdater Tests
 *
 * Tests the batch update system for efficient network broadcasts:
 * - Object pooling and reuse
 * - Update queuing and flushing
 * - Binary serialization
 * - Edge cases and boundary conditions
 *
 * NO MOCKS - Tests actual BatchUpdater logic
 */

import { describe, it, expect, beforeEach } from "bun:test";
import {
  BatchUpdater,
  UpdateFlags,
  parseBatchUpdate,
} from "../BatchUpdater";

describe("BatchUpdater", () => {
  let updater: BatchUpdater;

  beforeEach(() => {
    updater = new BatchUpdater();
  });

  describe("queuePositionUpdate", () => {
    it("should queue a position update", () => {
      updater.queuePositionUpdate("entity1", 10, 20, 30);
      expect(updater.getQueuedCount()).toBe(1);
      expect(updater.hasUpdates()).toBe(true);
    });

    it("should reuse position object on subsequent updates to same entity", () => {
      updater.queuePositionUpdate("entity1", 10, 20, 30);
      updater.queuePositionUpdate("entity1", 40, 50, 60);
      
      // Should still be 1 queued update (same entity)
      expect(updater.getQueuedCount()).toBe(1);
      
      // Flush and verify the latest values were used
      const buffer = updater.flush();
      expect(buffer).not.toBeNull();
      
      const parsed = parseBatchUpdate(buffer!);
      expect(parsed.length).toBe(1);
      // Positions are quantized, so use approximate comparison
      expect(parsed[0].position!.x).toBeCloseTo(40, 0);
      expect(parsed[0].position!.y).toBeCloseTo(50, 0);
      expect(parsed[0].position!.z).toBeCloseTo(60, 0);
    });

    it("should handle multiple entities", () => {
      updater.queuePositionUpdate("entity1", 1, 2, 3);
      updater.queuePositionUpdate("entity2", 4, 5, 6);
      updater.queuePositionUpdate("entity3", 7, 8, 9);
      
      expect(updater.getQueuedCount()).toBe(3);
    });

    it("should handle negative coordinates", () => {
      updater.queuePositionUpdate("entity1", -100, -50, -25);
      
      const buffer = updater.flush();
      const parsed = parseBatchUpdate(buffer!);
      
      // Position is quantized, so check approximate values
      expect(parsed[0].position!.x).toBeCloseTo(-100, 0);
      expect(parsed[0].position!.y).toBeCloseTo(-50, 0);
      expect(parsed[0].position!.z).toBeCloseTo(-25, 0);
    });

    it("should handle very large coordinates", () => {
      updater.queuePositionUpdate("entity1", 10000, 5000, 10000);
      
      const buffer = updater.flush();
      expect(buffer).not.toBeNull();
      
      const parsed = parseBatchUpdate(buffer!);
      expect(parsed.length).toBe(1);
    });

    it("should handle zero coordinates", () => {
      updater.queuePositionUpdate("entity1", 0, 0, 0);
      
      const buffer = updater.flush();
      const parsed = parseBatchUpdate(buffer!);
      
      expect(parsed[0].position!.x).toBeCloseTo(0, 1);
      expect(parsed[0].position!.y).toBeCloseTo(0, 1);
      expect(parsed[0].position!.z).toBeCloseTo(0, 1);
    });
  });

  describe("queueRotationUpdate", () => {
    it("should queue a rotation update", () => {
      updater.queueRotationUpdate("entity1", 0, 0.7071, 0, 0.7071);
      expect(updater.getQueuedCount()).toBe(1);
    });

    it("should reuse quaternion object on subsequent updates", () => {
      updater.queueRotationUpdate("entity1", 0, 0, 0, 1);
      updater.queueRotationUpdate("entity1", 0, 0.7071, 0, 0.7071);
      
      expect(updater.getQueuedCount()).toBe(1);
      
      const buffer = updater.flush();
      const parsed = parseBatchUpdate(buffer!);
      
      expect(parsed[0].quaternion!.y).toBeCloseTo(0.7071, 2);
    });

    it("should handle identity quaternion", () => {
      updater.queueRotationUpdate("entity1", 0, 0, 0, 1);
      
      const buffer = updater.flush();
      const parsed = parseBatchUpdate(buffer!);
      
      expect(parsed[0].quaternion!.w).toBeCloseTo(1, 2);
    });
  });

  describe("queueTransformUpdate", () => {
    it("should queue both position and rotation", () => {
      updater.queueTransformUpdate(
        "entity1",
        { x: 10, y: 20, z: 30 },
        { x: 0, y: 0, z: 0, w: 1 }
      );
      
      expect(updater.getQueuedCount()).toBe(1);
      
      const buffer = updater.flush();
      const parsed = parseBatchUpdate(buffer!);
      
      expect(parsed[0].flags & UpdateFlags.POSITION).toBeTruthy();
      expect(parsed[0].flags & UpdateFlags.ROTATION).toBeTruthy();
      expect(parsed[0].position).toBeDefined();
      expect(parsed[0].quaternion).toBeDefined();
    });

    it("should reuse existing transform objects", () => {
      updater.queueTransformUpdate(
        "entity1",
        { x: 1, y: 2, z: 3 },
        { x: 0, y: 0, z: 0, w: 1 }
      );
      updater.queueTransformUpdate(
        "entity1",
        { x: 10, y: 20, z: 30 },
        { x: 0, y: 0.7071, z: 0, w: 0.7071 }
      );
      
      expect(updater.getQueuedCount()).toBe(1);
    });
  });

  describe("queueHealthUpdate", () => {
    it("should queue a health update", () => {
      updater.queueHealthUpdate("entity1", 50, 100);
      expect(updater.getQueuedCount()).toBe(1);
    });

    it("should reuse health object on subsequent updates", () => {
      updater.queueHealthUpdate("entity1", 100, 100);
      updater.queueHealthUpdate("entity1", 50, 100);
      
      expect(updater.getQueuedCount()).toBe(1);
      
      const buffer = updater.flush();
      const parsed = parseBatchUpdate(buffer!);
      
      expect(parsed[0].health!.current).toBe(50);
      expect(parsed[0].health!.max).toBe(100);
    });

    it("should handle zero health", () => {
      updater.queueHealthUpdate("entity1", 0, 100);
      
      const buffer = updater.flush();
      const parsed = parseBatchUpdate(buffer!);
      
      expect(parsed[0].health!.current).toBe(0);
    });

    it("should handle very high health values", () => {
      updater.queueHealthUpdate("entity1", 65535, 65535);
      
      const buffer = updater.flush();
      const parsed = parseBatchUpdate(buffer!);
      
      expect(parsed[0].health!.current).toBe(65535);
      expect(parsed[0].health!.max).toBe(65535);
    });
  });

  describe("queueStateUpdate", () => {
    it("should queue a state update", () => {
      updater.queueStateUpdate("entity1", 5);
      expect(updater.getQueuedCount()).toBe(1);
    });

    it("should handle state values 0-255", () => {
      updater.queueStateUpdate("entity1", 0);
      let buffer = updater.flush();
      let parsed = parseBatchUpdate(buffer!);
      expect(parsed[0].state).toBe(0);

      updater.queueStateUpdate("entity2", 255);
      buffer = updater.flush();
      parsed = parseBatchUpdate(buffer!);
      expect(parsed[0].state).toBe(255);
    });

    it("should truncate state values over 255", () => {
      updater.queueStateUpdate("entity1", 256);
      
      const buffer = updater.flush();
      const parsed = parseBatchUpdate(buffer!);
      
      expect(parsed[0].state).toBe(0); // 256 & 0xff = 0
    });
  });

  describe("flush", () => {
    it("should return null when no updates queued", () => {
      expect(updater.flush()).toBeNull();
    });

    it("should clear updates after flush", () => {
      updater.queuePositionUpdate("entity1", 10, 20, 30);
      updater.flush();
      
      expect(updater.getQueuedCount()).toBe(0);
      expect(updater.hasUpdates()).toBe(false);
    });

    it("should return updates back to pool for reuse", () => {
      // Queue and flush several times
      for (let i = 0; i < 10; i++) {
        updater.queuePositionUpdate(`entity${i % 3}`, i, i, i);
        updater.flush();
      }
      
      // Should not throw and should work correctly
      updater.queuePositionUpdate("entityNew", 1, 2, 3);
      const buffer = updater.flush();
      expect(buffer).not.toBeNull();
    });

    it("should handle combined update types", () => {
      updater.queuePositionUpdate("entity1", 10, 20, 30);
      updater.queueRotationUpdate("entity1", 0, 0, 0, 1);
      updater.queueHealthUpdate("entity1", 50, 100);
      updater.queueStateUpdate("entity1", 3);
      
      expect(updater.getQueuedCount()).toBe(1);
      
      const buffer = updater.flush();
      const parsed = parseBatchUpdate(buffer!);
      
      expect(parsed.length).toBe(1);
      expect(parsed[0].position).toBeDefined();
      expect(parsed[0].quaternion).toBeDefined();
      expect(parsed[0].health).toBeDefined();
      expect(parsed[0].state).toBe(3);
    });
  });

  describe("clear", () => {
    it("should clear all queued updates", () => {
      updater.queuePositionUpdate("entity1", 10, 20, 30);
      updater.queuePositionUpdate("entity2", 40, 50, 60);
      
      updater.clear();
      
      expect(updater.getQueuedCount()).toBe(0);
      expect(updater.flush()).toBeNull();
    });

    it("should return updates to pool on clear", () => {
      updater.queuePositionUpdate("entity1", 10, 20, 30);
      updater.clear();
      
      // Queue again - should reuse pooled update
      updater.queuePositionUpdate("entity2", 40, 50, 60);
      expect(updater.getQueuedCount()).toBe(1);
    });
  });

  describe("getStats", () => {
    it("should return correct statistics", () => {
      let stats = updater.getStats();
      expect(stats.queuedUpdates).toBe(0);
      expect(stats.maxSeenUpdates).toBe(0);
      expect(stats.bufferSize).toBe(0);
      
      updater.queuePositionUpdate("entity1", 10, 20, 30);
      updater.queuePositionUpdate("entity2", 40, 50, 60);
      
      stats = updater.getStats();
      expect(stats.queuedUpdates).toBe(2);
      
      updater.flush();
      
      stats = updater.getStats();
      expect(stats.queuedUpdates).toBe(0);
      expect(stats.maxSeenUpdates).toBe(2);
      expect(stats.bufferSize).toBeGreaterThan(0);
    });
  });

  describe("object pooling behavior", () => {
    it("should pool update objects up to MAX_POOL_SIZE", () => {
      // Queue and flush 300 entities
      for (let i = 0; i < 300; i++) {
        updater.queuePositionUpdate(`entity${i}`, i, i, i);
      }
      updater.flush();
      
      // Queue again - first 256 should come from pool
      for (let i = 0; i < 300; i++) {
        updater.queuePositionUpdate(`entity${i}`, i * 2, i * 2, i * 2);
      }
      
      const buffer = updater.flush();
      expect(buffer).not.toBeNull();
      
      // Verify parsing works
      const parsed = parseBatchUpdate(buffer!);
      expect(parsed.length).toBe(256); // MAX_UPDATES_PER_BATCH
    });

    it("should reuse nested objects (position, quaternion, health)", () => {
      // First update creates objects
      updater.queuePositionUpdate("entity1", 1, 2, 3);
      updater.queueRotationUpdate("entity1", 0, 0, 0, 1);
      updater.queueHealthUpdate("entity1", 100, 100);
      updater.flush();
      
      // Second update should reuse objects
      updater.queuePositionUpdate("entity1", 10, 20, 30);
      updater.queueRotationUpdate("entity1", 0.5, 0.5, 0.5, 0.5);
      updater.queueHealthUpdate("entity1", 50, 100);
      
      const buffer = updater.flush();
      const parsed = parseBatchUpdate(buffer!);
      
      expect(parsed[0].position!.x).toBeCloseTo(10, 0);
      expect(parsed[0].health!.current).toBe(50);
    });
  });

  describe("parseBatchUpdate", () => {
    it("should correctly parse empty batch", () => {
      // Create a minimal valid buffer with 0 updates
      const buffer = new Uint8Array(2);
      new DataView(buffer.buffer).setUint16(0, 0, true);
      
      const parsed = parseBatchUpdate(buffer);
      expect(parsed.length).toBe(0);
    });

    it("should round-trip position updates", () => {
      updater.queuePositionUpdate("entity1", 100.5, 50.25, 75.75);
      
      const buffer = updater.flush()!;
      const parsed = parseBatchUpdate(buffer);
      
      expect(parsed.length).toBe(1);
      expect(parsed[0].flags & UpdateFlags.POSITION).toBeTruthy();
      // Positions are quantized, so check approximate values
      expect(parsed[0].position!.x).toBeCloseTo(100.5, 0);
      expect(parsed[0].position!.y).toBeCloseTo(50.25, 0);
      expect(parsed[0].position!.z).toBeCloseTo(75.75, 0);
    });

    it("should round-trip rotation updates", () => {
      // 90 degree rotation around Y axis
      const sin45 = Math.sin(Math.PI / 4);
      const cos45 = Math.cos(Math.PI / 4);
      
      updater.queueRotationUpdate("entity1", 0, sin45, 0, cos45);
      
      const buffer = updater.flush()!;
      const parsed = parseBatchUpdate(buffer);
      
      expect(parsed[0].quaternion!.y).toBeCloseTo(sin45, 2);
      expect(parsed[0].quaternion!.w).toBeCloseTo(cos45, 2);
    });

    it("should round-trip multiple update types", () => {
      updater.queuePositionUpdate("e1", 10, 20, 30);
      updater.queueHealthUpdate("e2", 75, 100);
      updater.queueStateUpdate("e3", 5);
      
      const buffer = updater.flush()!;
      const parsed = parseBatchUpdate(buffer);
      
      expect(parsed.length).toBe(3);
      
      // Verify each has correct flags
      const posUpdate = parsed.find(u => u.flags & UpdateFlags.POSITION);
      const healthUpdate = parsed.find(u => u.flags & UpdateFlags.HEALTH);
      const stateUpdate = parsed.find(u => u.flags & UpdateFlags.STATE);
      
      expect(posUpdate).toBeDefined();
      expect(healthUpdate).toBeDefined();
      expect(stateUpdate).toBeDefined();
    });
  });

  describe("performance", () => {
    it("should handle high throughput updates", () => {
      const startTime = performance.now();
      
      // Simulate 100 ticks with 50 entities each
      for (let tick = 0; tick < 100; tick++) {
        for (let entity = 0; entity < 50; entity++) {
          updater.queuePositionUpdate(`entity${entity}`, tick, entity, tick);
        }
        updater.flush();
      }
      
      const elapsed = performance.now() - startTime;
      
      // Should complete 5000 position updates + 100 flushes in < 100ms
      expect(elapsed).toBeLessThan(100);
    });

    it("should reuse buffer between flushes", () => {
      // First flush allocates buffer
      updater.queuePositionUpdate("entity1", 10, 20, 30);
      updater.flush();
      
      const stats1 = updater.getStats();
      const bufferSize1 = stats1.bufferSize;
      
      // Subsequent flush reuses buffer
      updater.queuePositionUpdate("entity2", 40, 50, 60);
      updater.flush();
      
      const stats2 = updater.getStats();
      
      // Buffer should be same size or larger (never shrinks)
      expect(stats2.bufferSize).toBeGreaterThanOrEqual(bufferSize1);
    });
  });
});

