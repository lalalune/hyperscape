/**
 * IdempotencyService Tests
 *
 * Tests the request deduplication system:
 * - Key generation with optimized serialization
 * - Duplicate detection within TTL window
 * - TTL-based expiration
 * - Edge cases and boundary conditions
 *
 * NO MOCKS - Tests actual IdempotencyService logic
 */

import { describe, it, expect, beforeEach, afterEach } from "bun:test";
import {
  IdempotencyService,
  getIdempotencyService,
  destroyIdempotencyService,
} from "../services/IdempotencyService";

describe("IdempotencyService", () => {
  let service: IdempotencyService;

  beforeEach(() => {
    // Short TTL for faster tests
    service = new IdempotencyService({ ttlMs: 100, cleanupInterval: 50 });
  });

  afterEach(() => {
    service.destroy();
  });

  describe("generateKey", () => {
    it("should generate consistent keys for same input", () => {
      const key1 = service.generateKey("player1", "pickup", { entityId: "item1" });
      const key2 = service.generateKey("player1", "pickup", { entityId: "item1" });
      
      expect(key1).toBe(key2);
    });

    it("should generate different keys for different players", () => {
      const key1 = service.generateKey("player1", "pickup", { entityId: "item1" });
      const key2 = service.generateKey("player2", "pickup", { entityId: "item1" });
      
      expect(key1).not.toBe(key2);
    });

    it("should generate different keys for different actions", () => {
      const key1 = service.generateKey("player1", "pickup", { entityId: "item1" });
      const key2 = service.generateKey("player1", "drop", { entityId: "item1" });
      
      expect(key1).not.toBe(key2);
    });

    it("should generate different keys for different data", () => {
      const key1 = service.generateKey("player1", "pickup", { entityId: "item1" });
      const key2 = service.generateKey("player1", "pickup", { entityId: "item2" });
      
      expect(key1).not.toBe(key2);
    });

    it("should handle null data", () => {
      const key = service.generateKey("player1", "action", null);
      expect(typeof key).toBe("string");
      expect(key.length).toBeGreaterThan(0);
    });

    it("should handle undefined data", () => {
      const key = service.generateKey("player1", "action", undefined);
      expect(typeof key).toBe("string");
    });

    it("should handle string data", () => {
      const key = service.generateKey("player1", "action", "simple-string");
      expect(typeof key).toBe("string");
    });

    it("should handle number data", () => {
      const key = service.generateKey("player1", "action", 42);
      expect(typeof key).toBe("string");
    });

    it("should handle boolean data", () => {
      const key1 = service.generateKey("player1", "action", true);
      const key2 = service.generateKey("player1", "action", false);
      
      expect(key1).not.toBe(key2);
    });

    it("should handle multi-property objects", () => {
      const key1 = service.generateKey("player1", "drop", { itemId: "sword", slot: 5 });
      const key2 = service.generateKey("player1", "drop", { itemId: "sword", slot: 6 });
      
      expect(key1).not.toBe(key2);
    });

    it("should handle object property order consistently", () => {
      // Keys should be sorted internally, so order shouldn't matter
      const key1 = service.generateKey("player1", "action", { a: 1, b: 2 });
      const key2 = service.generateKey("player1", "action", { b: 2, a: 1 });
      
      expect(key1).toBe(key2);
    });

    it("should handle nested objects", () => {
      const key = service.generateKey("player1", "action", {
        outer: { inner: "value" }
      });
      expect(typeof key).toBe("string");
    });

    it("should handle empty objects", () => {
      const key = service.generateKey("player1", "action", {});
      expect(typeof key).toBe("string");
    });

    it("should handle special characters in strings", () => {
      const key = service.generateKey("player1", "chat", {
        message: "Hello | World & <script>alert('xss')</script>"
      });
      expect(typeof key).toBe("string");
    });
  });

  describe("checkAndMark", () => {
    it("should return true for new requests", () => {
      const key = service.generateKey("player1", "pickup", { entityId: "item1" });
      expect(service.checkAndMark(key)).toBe(true);
    });

    it("should return false for duplicate requests within TTL", () => {
      const key = service.generateKey("player1", "pickup", { entityId: "item1" });
      
      expect(service.checkAndMark(key)).toBe(true);
      expect(service.checkAndMark(key)).toBe(false);
    });

    it("should return true after TTL expires", async () => {
      const key = service.generateKey("player1", "pickup", { entityId: "item1" });
      
      expect(service.checkAndMark(key)).toBe(true);
      
      // Wait for TTL to expire
      await new Promise(r => setTimeout(r, 150));
      
      expect(service.checkAndMark(key)).toBe(true);
    }, 500);

    it("should track multiple different requests", () => {
      const key1 = service.generateKey("player1", "pickup", { entityId: "item1" });
      const key2 = service.generateKey("player1", "pickup", { entityId: "item2" });
      const key3 = service.generateKey("player2", "pickup", { entityId: "item1" });
      
      expect(service.checkAndMark(key1)).toBe(true);
      expect(service.checkAndMark(key2)).toBe(true);
      expect(service.checkAndMark(key3)).toBe(true);
      
      // Duplicates
      expect(service.checkAndMark(key1)).toBe(false);
      expect(service.checkAndMark(key2)).toBe(false);
      expect(service.checkAndMark(key3)).toBe(false);
    });
  });

  describe("wasProcessed", () => {
    it("should return false for never-seen requests", () => {
      const key = service.generateKey("player1", "pickup", { entityId: "item1" });
      expect(service.wasProcessed(key)).toBe(false);
    });

    it("should return true for recently processed requests", () => {
      const key = service.generateKey("player1", "pickup", { entityId: "item1" });
      
      service.checkAndMark(key);
      
      expect(service.wasProcessed(key)).toBe(true);
    });

    it("should not mark the request", () => {
      const key = service.generateKey("player1", "pickup", { entityId: "item1" });
      
      // Check without marking
      service.wasProcessed(key);
      
      // First checkAndMark should still return true
      expect(service.checkAndMark(key)).toBe(true);
    });

    it("should return false after TTL expires", async () => {
      const key = service.generateKey("player1", "pickup", { entityId: "item1" });
      
      service.checkAndMark(key);
      
      // Wait for TTL to expire
      await new Promise(r => setTimeout(r, 150));
      
      expect(service.wasProcessed(key)).toBe(false);
    }, 500);
  });

  describe("size", () => {
    it("should return 0 initially", () => {
      expect(service.size).toBe(0);
    });

    it("should increase when requests are tracked", () => {
      service.checkAndMark(service.generateKey("p1", "a1", null));
      expect(service.size).toBe(1);
      
      service.checkAndMark(service.generateKey("p2", "a2", null));
      expect(service.size).toBe(2);
    });

    it("should not increase for duplicates", () => {
      const key = service.generateKey("p1", "a1", null);
      
      service.checkAndMark(key);
      service.checkAndMark(key);
      service.checkAndMark(key);
      
      expect(service.size).toBe(1);
    });
  });

  describe("clearPlayer", () => {
    it("should be callable without error", () => {
      service.checkAndMark(service.generateKey("player1", "action", null));
      
      // This is a no-op but should not throw
      expect(() => service.clearPlayer("player1")).not.toThrow();
    });
  });

  describe("destroy", () => {
    it("should stop cleanup timer", () => {
      service.destroy();
      
      // Should be safe to call destroy multiple times
      expect(() => service.destroy()).not.toThrow();
    });

    it("should clear all tracked requests", () => {
      service.checkAndMark(service.generateKey("p1", "a1", null));
      service.checkAndMark(service.generateKey("p2", "a2", null));
      
      service.destroy();
      
      expect(service.size).toBe(0);
    });
  });

  describe("automatic cleanup", () => {
    it("should remove expired entries during cleanup", async () => {
      service.checkAndMark(service.generateKey("p1", "a1", null));
      
      expect(service.size).toBe(1);
      
      // Wait for TTL to expire and cleanup to run
      await new Promise(r => setTimeout(r, 200));
      
      expect(service.size).toBe(0);
    }, 500);
  });
});

describe("singleton functions", () => {
  afterEach(() => {
    destroyIdempotencyService();
  });

  describe("getIdempotencyService", () => {
    it("should return an IdempotencyService instance", () => {
      const service = getIdempotencyService();
      expect(service).toBeInstanceOf(IdempotencyService);
    });

    it("should return the same instance on subsequent calls", () => {
      const service1 = getIdempotencyService();
      const service2 = getIdempotencyService();
      
      expect(service1).toBe(service2);
    });
  });

  describe("destroyIdempotencyService", () => {
    it("should allow creating new instance after destroy", () => {
      const service1 = getIdempotencyService();
      service1.checkAndMark(service1.generateKey("p1", "a1", null));
      
      destroyIdempotencyService();
      
      const service2 = getIdempotencyService();
      
      // New instance should not have the old request
      expect(service2.wasProcessed(service2.generateKey("p1", "a1", null))).toBe(false);
    });

    it("should be safe to call when no instance exists", () => {
      expect(() => destroyIdempotencyService()).not.toThrow();
    });
  });
});

describe("serializeData optimization", () => {
  let service: IdempotencyService;

  beforeEach(() => {
    service = new IdempotencyService({ ttlMs: 1000 });
  });

  afterEach(() => {
    service.destroy();
  });

  it("should handle typical pickup payload", () => {
    const key = service.generateKey("player-abc123", "pickup", {
      entityId: "item-def456"
    });
    
    expect(typeof key).toBe("string");
    expect(service.checkAndMark(key)).toBe(true);
    expect(service.checkAndMark(key)).toBe(false);
  });

  it("should handle typical drop payload", () => {
    const key = service.generateKey("player-abc123", "drop", {
      itemId: "bronze-sword",
      slot: 3
    });
    
    expect(typeof key).toBe("string");
    expect(service.checkAndMark(key)).toBe(true);
    expect(service.checkAndMark(key)).toBe(false);
  });

  it("should handle undefined values in objects", () => {
    const key1 = service.generateKey("p1", "action", { a: undefined });
    const key2 = service.generateKey("p1", "action", { b: undefined });
    
    // Different property names should produce different keys
    expect(key1).not.toBe(key2);
    
    // Same undefined value should produce same key
    const key3 = service.generateKey("p1", "action", { a: undefined });
    expect(key1).toBe(key3);
  });

  it("should handle null values in objects", () => {
    const key1 = service.generateKey("p1", "action", { a: null });
    const key2 = service.generateKey("p1", "action", { b: null });
    
    // Different property names should produce different keys
    expect(key1).not.toBe(key2);
    
    // Same null value should produce same key
    const key3 = service.generateKey("p1", "action", { a: null });
    expect(key1).toBe(key3);
  });

  it("should handle array values in objects", () => {
    const key = service.generateKey("p1", "action", {
      items: [1, 2, 3]
    });
    
    expect(typeof key).toBe("string");
    expect(service.checkAndMark(key)).toBe(true);
  });

  it("should generate unique keys for different numeric values", () => {
    const key1 = service.generateKey("p1", "action", { slot: 0 });
    const key2 = service.generateKey("p1", "action", { slot: 1 });
    const key3 = service.generateKey("p1", "action", { slot: -1 });
    
    expect(key1).not.toBe(key2);
    expect(key1).not.toBe(key3);
    expect(key2).not.toBe(key3);
  });
});

describe("performance", () => {
  let service: IdempotencyService;

  beforeEach(() => {
    service = new IdempotencyService({ ttlMs: 5000, cleanupInterval: 10000 });
  });

  afterEach(() => {
    service.destroy();
  });

  it("should handle high throughput key generation", () => {
    const startTime = performance.now();
    
    // Generate 10000 keys
    for (let i = 0; i < 10000; i++) {
      service.generateKey(`player${i % 100}`, "pickup", {
        entityId: `item${i}`,
        slot: i % 28
      });
    }
    
    const elapsed = performance.now() - startTime;
    
    // Should complete 10000 key generations in < 100ms
    expect(elapsed).toBeLessThan(100);
  });

  it("should handle high throughput checkAndMark", () => {
    // Pre-generate keys
    const keys: string[] = [];
    for (let i = 0; i < 10000; i++) {
      keys.push(service.generateKey(`player${i}`, "action", { id: i }));
    }
    
    const startTime = performance.now();
    
    // Check and mark all keys
    for (const key of keys) {
      service.checkAndMark(key);
    }
    
    const elapsed = performance.now() - startTime;
    
    // Should complete 10000 check-and-marks in < 50ms
    expect(elapsed).toBeLessThan(50);
  });

  it("should handle mixed workload efficiently", () => {
    const startTime = performance.now();
    
    // Simulate realistic workload: 50% new requests, 50% duplicates
    for (let tick = 0; tick < 100; tick++) {
      for (let player = 0; player < 50; player++) {
        const key = service.generateKey(
          `player${player}`,
          "pickup",
          { entityId: `item${tick % 10}` } // 10% unique items
        );
        service.checkAndMark(key);
      }
    }
    
    const elapsed = performance.now() - startTime;
    
    // Should handle 5000 requests in < 50ms
    expect(elapsed).toBeLessThan(50);
  });
});

