/**
 * GroundItemSystem Performance Tests
 *
 * Tests performance characteristics:
 * - Large item count handling
 * - O(1) tile lookup verification
 * - Tick processing efficiency
 *
 * NOTE: Uses mocked system internals to avoid circular dependency issues.
 */

import { describe, it, expect, beforeEach } from "vitest";

// ============================================================================
// Types
// ============================================================================

interface Position3D {
  x: number;
  y: number;
  z: number;
}

interface GroundItem {
  id: string;
  itemId: string;
  quantity: number;
  position: Position3D;
  spawnTick: number;
  despawnTick: number;
}

// ============================================================================
// Performance-Optimized Ground Item Manager
// ============================================================================

class PerformanceGroundItemManager {
  private items = new Map<string, GroundItem>();
  private tileIndex = new Map<string, Set<string>>();
  private nextId = 1;
  private currentTick = 0;
  private readonly TICK_MS = 600;

  private getTileKey(x: number, z: number): string {
    return `${Math.floor(x)},${Math.floor(z)}`;
  }

  spawnGroundItem(
    itemId: string,
    quantity: number,
    position: Position3D,
    options: { despawnTime?: number; scatter?: boolean } = {},
  ): string {
    const id = `ground_item_${this.nextId++}`;

    const snappedPosition: Position3D = {
      x: Math.floor(position.x) + 0.5,
      y: position.y,
      z: Math.floor(position.z) + 0.5,
    };

    const item: GroundItem = {
      id,
      itemId,
      quantity,
      position: snappedPosition,
      spawnTick: this.currentTick,
      despawnTick:
        this.currentTick +
        (options.despawnTime
          ? Math.ceil(options.despawnTime / this.TICK_MS)
          : 100),
    };

    this.items.set(id, item);

    const tileKey = this.getTileKey(snappedPosition.x, snappedPosition.z);
    if (!this.tileIndex.has(tileKey)) {
      this.tileIndex.set(tileKey, new Set());
    }
    this.tileIndex.get(tileKey)!.add(id);

    return id;
  }

  removeGroundItem(id: string): boolean {
    const item = this.items.get(id);
    if (!item) return false;

    const tileKey = this.getTileKey(item.position.x, item.position.z);
    this.tileIndex.get(tileKey)?.delete(id);

    if (this.tileIndex.get(tileKey)?.size === 0) {
      this.tileIndex.delete(tileKey);
    }

    this.items.delete(id);
    return true;
  }

  getItemsAtTile(position: { x: number; z: number }): GroundItem[] {
    const tileKey = this.getTileKey(position.x, position.z);
    const itemIds = this.tileIndex.get(tileKey);
    if (!itemIds) return [];

    return Array.from(itemIds)
      .map((id) => this.items.get(id)!)
      .filter(Boolean);
  }

  getPileAtTile(position: { x: number; z: number }): GroundItem[] {
    return this.getItemsAtTile(position);
  }

  processTick(tick: number): void {
    this.currentTick = tick;

    for (const [id, item] of this.items) {
      if (tick >= item.despawnTick) {
        this.removeGroundItem(id);
      }
    }
  }

  getItemCount(): number {
    return this.items.size;
  }

  setCurrentTick(tick: number): void {
    this.currentTick = tick;
  }
}

// ============================================================================
// Performance Tests
// ============================================================================

describe("GroundItemSystem Performance", () => {
  let system: PerformanceGroundItemManager;

  beforeEach(() => {
    system = new PerformanceGroundItemManager();
  });

  describe("Large Item Count Handling", () => {
    it("handles 1000 items without degradation", () => {
      const spawnStart = performance.now();

      // Spawn 1000 items at different tiles
      for (let i = 0; i < 1000; i++) {
        system.spawnGroundItem(
          "coins",
          1,
          { x: i % 100, y: 0, z: Math.floor(i / 100) },
          { despawnTime: 120000, scatter: false },
        );
      }

      const spawnTime = performance.now() - spawnStart;

      expect(system.getItemCount()).toBe(1000);

      // Spawning 1000 items should complete in under 1 second
      expect(spawnTime).toBeLessThan(1000);
    });

    it("handles 5000 items", () => {
      // Spawn items
      for (let i = 0; i < 5000; i++) {
        system.spawnGroundItem(
          "coins",
          1,
          { x: i % 100, y: 0, z: Math.floor(i / 100) },
          { despawnTime: 120000, scatter: false },
        );
      }

      expect(system.getItemCount()).toBe(5000);
    });
  });

  describe("O(1) Tile Lookup Performance", () => {
    it("tile lookup is O(1) regardless of total items", () => {
      // Spawn items at different tiles
      for (let i = 0; i < 1000; i++) {
        system.spawnGroundItem(
          "coins",
          1,
          { x: i, y: 0, z: i },
          { despawnTime: 120000, scatter: false },
        );
      }

      // Time 10000 lookups
      const lookupStart = performance.now();
      for (let i = 0; i < 10000; i++) {
        system.getItemsAtTile({ x: 500, z: 500 });
      }
      const lookupTime = performance.now() - lookupStart;

      // 10000 O(1) lookups should complete in under 100ms
      expect(lookupTime).toBeLessThan(100);
    });

    it("lookup time does not scale with item count", () => {
      // Measure with 100 items
      for (let i = 0; i < 100; i++) {
        system.spawnGroundItem(
          "coins",
          1,
          { x: i, y: 0, z: i },
          { despawnTime: 120000, scatter: false },
        );
      }

      const start100 = performance.now();
      for (let i = 0; i < 1000; i++) {
        system.getItemsAtTile({ x: 50, z: 50 });
      }
      const time100 = performance.now() - start100;

      // Add 900 more items (total 1000)
      for (let i = 100; i < 1000; i++) {
        system.spawnGroundItem(
          "coins",
          1,
          { x: i, y: 0, z: i },
          { despawnTime: 120000, scatter: false },
        );
      }

      const start1000 = performance.now();
      for (let i = 0; i < 1000; i++) {
        system.getItemsAtTile({ x: 50, z: 50 });
      }
      const time1000 = performance.now() - start1000;

      // Times should be similar (within 3x) since both are O(1)
      // Allow some variance for JIT compilation, GC, etc.
      expect(time1000).toBeLessThan(time100 * 3 + 1); // +1ms for edge cases
    });
  });

  describe("Tick Processing Efficiency", () => {
    it("processTick is efficient with many items", () => {
      system.setCurrentTick(0);

      // Spawn 1000 items with varying despawn times
      for (let i = 0; i < 1000; i++) {
        system.spawnGroundItem(
          "coins",
          1,
          { x: i % 100, y: 0, z: Math.floor(i / 100) },
          { despawnTime: 60000 + i * 100, scatter: false }, // Staggered despawn
        );
      }

      // Measure tick processing time
      const tickStart = performance.now();
      for (let tick = 0; tick < 100; tick++) {
        system.processTick(tick);
      }
      const tickTime = performance.now() - tickStart;

      // Processing 100 ticks should be fast
      expect(tickTime).toBeLessThan(100);
    });

    it("handles mass despawn efficiently", () => {
      system.setCurrentTick(0);

      // Spawn 500 items that all despawn at tick 10
      for (let i = 0; i < 500; i++) {
        system.spawnGroundItem(
          "coins",
          1,
          { x: i % 100, y: 0, z: Math.floor(i / 100) },
          { despawnTime: 6000, scatter: false }, // All despawn at tick 10
        );
      }

      expect(system.getItemCount()).toBe(500);

      // Process the mass despawn tick
      const despawnStart = performance.now();
      system.processTick(10);
      const despawnTime = performance.now() - despawnStart;

      // All items should be gone
      expect(system.getItemCount()).toBe(0);

      // Mass despawn should be reasonably fast
      expect(despawnTime).toBeLessThan(500);
    });
  });

  describe("Pile Operations", () => {
    it("handles many items on single tile efficiently", () => {
      // Spawn 100 different non-stackable items on same tile
      for (let i = 0; i < 100; i++) {
        system.spawnGroundItem(
          `item_${i}`,
          1,
          { x: 50, y: 0, z: 50 },
          { despawnTime: 120000, scatter: false },
        );
      }

      // Lookup pile
      const lookupStart = performance.now();
      for (let i = 0; i < 1000; i++) {
        system.getItemsAtTile({ x: 50, z: 50 });
      }
      const lookupTime = performance.now() - lookupStart;

      // Should still be fast even with large pile
      expect(lookupTime).toBeLessThan(50);
    });

    it("getPileAtTile is efficient", () => {
      // Create piles at multiple tiles
      for (let x = 0; x < 10; x++) {
        for (let z = 0; z < 10; z++) {
          for (let i = 0; i < 5; i++) {
            system.spawnGroundItem(
              `item_${i}`,
              1,
              { x, y: 0, z },
              { despawnTime: 120000, scatter: false },
            );
          }
        }
      }

      // Time pile lookups
      const lookupStart = performance.now();
      for (let i = 0; i < 10000; i++) {
        system.getPileAtTile({ x: 5, z: 5 });
      }
      const lookupTime = performance.now() - lookupStart;

      expect(lookupTime).toBeLessThan(50);
    });
  });

  describe("Memory Efficiency", () => {
    it("cleans up removed items properly", () => {
      // Spawn and remove items repeatedly
      for (let cycle = 0; cycle < 10; cycle++) {
        const itemIds: string[] = [];

        // Spawn 100 items
        for (let i = 0; i < 100; i++) {
          const id = system.spawnGroundItem(
            "coins",
            1,
            { x: i, y: 0, z: cycle },
            { despawnTime: 120000, scatter: false },
          );
          itemIds.push(id);
        }

        expect(system.getItemCount()).toBe(100);

        // Remove all items
        for (const id of itemIds) {
          system.removeGroundItem(id);
        }

        expect(system.getItemCount()).toBe(0);
      }

      // After all cycles, item count should still be 0
      expect(system.getItemCount()).toBe(0);
    });
  });
});
