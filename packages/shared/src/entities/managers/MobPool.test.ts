/**
 * Unit tests for MobPool - Object pooling for mob entities
 */

import { describe, it, expect, beforeEach } from "bun:test";
import {
  ObjectPool,
  MobConfigPool,
  MatrixPool,
  Vector3Pool,
  MobPoolManager,
} from "./MobPool";
import type { MobEntityConfig } from "../../types/entities";
import { MobAIState } from "../../types/entities";

describe("ObjectPool", () => {
  let pool: ObjectPool<{ value: number }>;

  beforeEach(() => {
    pool = new ObjectPool(
      () => ({ value: 0 }),
      (obj) => {
        obj.value = 0;
      },
      5,
    );
  });

  it("should pre-allocate objects", () => {
    const stats = pool.getStats();
    expect(stats.total).toBe(5);
    expect(stats.available).toBe(5);
    expect(stats.inUse).toBe(0);
  });

  it("should acquire objects from pool", () => {
    const obj = pool.acquire();
    expect(obj).toBeDefined();
    expect(obj.value).toBe(0);

    const stats = pool.getStats();
    expect(stats.inUse).toBe(1);
    expect(stats.available).toBe(4);
  });

  it("should release objects back to pool", () => {
    const obj = pool.acquire();
    obj.value = 42;
    pool.release(obj);

    const stats = pool.getStats();
    expect(stats.inUse).toBe(0);
    expect(stats.available).toBe(5);

    // Verify object was reset
    const reacquired = pool.acquire();
    expect(reacquired.value).toBe(0);
  });

  it("should grow pool when exhausted", () => {
    // Acquire all pre-allocated
    for (let i = 0; i < 5; i++) {
      pool.acquire();
    }

    // Acquire one more - should grow
    const extra = pool.acquire();
    expect(extra).toBeDefined();

    const stats = pool.getStats();
    expect(stats.total).toBe(6);
    expect(stats.growthCount).toBe(1);
  });

  it("should track peak usage", () => {
    pool.acquire();
    pool.acquire();
    const obj3 = pool.acquire();

    expect(pool.getStats().peakUsage).toBe(3);

    pool.release(obj3);
    expect(pool.getStats().peakUsage).toBe(3); // Peak unchanged after release
  });
});

describe("MobConfigPool", () => {
  let pool: MobConfigPool;

  const createConfig = (type: string): MobEntityConfig => ({
    mobType: type,
    currentHealth: 100,
    maxHealth: 100,
    attackPower: 10,
    defense: 5,
    attackSpeed: 1000,
    combatLevel: 10,
    attackRange: 1,
    aggroRadius: 8,
    wanderRadius: 10,
    patrolRadius: 10,
    moveSpeed: 2,
    respawnTime: 60000,
    aiState: MobAIState.IDLE,
    targetPlayerId: null,
    spawnAreaCenter: { x: 0, y: 0, z: 0 },
  });

  beforeEach(() => {
    pool = new MobConfigPool();
  });

  it("should acquire new configs when pool empty", () => {
    const config = pool.acquire("goblin", createConfig("goblin"));
    expect(config).toBeDefined();
    expect(config.mobType).toBe("goblin");
  });

  it("should reuse configs when available", () => {
    const original = pool.acquire("goblin", createConfig("goblin"));
    original.currentHealth = 50;
    pool.release(original);

    const reused = pool.acquire("goblin", createConfig("goblin"));
    // Should be reset to new values
    expect(reused.currentHealth).toBe(100);
  });

  it("should track per-type pools", () => {
    const goblin = pool.acquire("goblin", createConfig("goblin"));
    pool.acquire("skeleton", createConfig("skeleton"));
    pool.release(goblin);

    const stats = pool.getStats();
    expect(stats.goblin).toBe(1);
    // Skeleton was created but not released, so its pool is empty (0 available)
    expect(stats.skeleton).toBe(0);
  });
});

describe("MatrixPool", () => {
  let pool: MatrixPool;

  beforeEach(() => {
    pool = new MatrixPool(10);
  });

  it("should pre-allocate matrices", () => {
    const stats = pool.getStats();
    expect(stats.available).toBe(10);
    expect(stats.inUse).toBe(0);
  });

  it("should acquire matrices from pool", () => {
    const matrix = pool.acquire();
    expect(matrix).toBeDefined();

    const stats = pool.getStats();
    expect(stats.inUse).toBe(1);
    expect(stats.available).toBe(9);
  });

  it("should release and reset matrices", () => {
    const matrix = pool.acquire();
    // Modify the matrix
    matrix.elements[0] = 99;

    pool.release(matrix);

    // Re-acquire - should be identity matrix
    const reacquired = pool.acquire();
    expect(reacquired.elements[0]).toBe(1); // Identity matrix has 1 on diagonal
  });

  it("should create new matrices when pool exhausted", () => {
    // Acquire all
    for (let i = 0; i < 10; i++) {
      pool.acquire();
    }

    // Acquire one more
    const extra = pool.acquire();
    expect(extra).toBeDefined();

    const stats = pool.getStats();
    expect(stats.inUse).toBe(11);
  });
});

describe("Vector3Pool", () => {
  let pool: Vector3Pool;

  beforeEach(() => {
    pool = new Vector3Pool(20);
  });

  it("should pre-allocate vectors", () => {
    const stats = pool.getStats();
    expect(stats.available).toBe(20);
    expect(stats.inUse).toBe(0);
  });

  it("should acquire vectors from pool", () => {
    const vec = pool.acquire();
    expect(vec).toBeDefined();
    expect(vec.x).toBe(0);
    expect(vec.y).toBe(0);
    expect(vec.z).toBe(0);
  });

  it("should release and reset vectors", () => {
    const vec = pool.acquire();
    vec.set(10, 20, 30);

    pool.release(vec);

    const reacquired = pool.acquire();
    expect(reacquired.x).toBe(0);
    expect(reacquired.y).toBe(0);
    expect(reacquired.z).toBe(0);
  });
});

describe("MobPoolManager", () => {
  it("should provide matrix pooling", () => {
    // Create a minimal mock world
    const mockWorld = {} as Parameters<typeof MobPoolManager>[0];
    const manager = new MobPoolManager(mockWorld);

    const matrix = manager.acquireMatrix();
    expect(matrix).toBeDefined();

    const stats = manager.getStats();
    expect(stats.matrices.inUse).toBe(1);

    manager.releaseMatrix(matrix);
    expect(manager.getStats().matrices.inUse).toBe(0);
  });

  it("should provide vector pooling", () => {
    const mockWorld = {} as Parameters<typeof MobPoolManager>[0];
    const manager = new MobPoolManager(mockWorld);

    const vec = manager.acquireVector();
    expect(vec).toBeDefined();

    manager.releaseVector(vec);
    expect(manager.getStats().vectors.inUse).toBe(0);
  });

  it("should provide config pooling", () => {
    const mockWorld = {} as Parameters<typeof MobPoolManager>[0];
    const manager = new MobPoolManager(mockWorld);

    const config = manager.acquireConfig("goblin", {
      mobType: "goblin",
      currentHealth: 100,
      maxHealth: 100,
      attackPower: 10,
      defense: 5,
      attackSpeed: 1000,
      combatLevel: 10,
      attackRange: 1,
      aggroRadius: 8,
      wanderRadius: 10,
      patrolRadius: 10,
      moveSpeed: 2,
      respawnTime: 60000,
      aiState: MobAIState.IDLE,
      targetPlayerId: null,
      spawnAreaCenter: { x: 0, y: 0, z: 0 },
    });

    expect(config.mobType).toBe("goblin");

    manager.releaseConfig(config);
    expect(manager.getStats().configs.goblin).toBe(1);
  });
});
