/**
 * `MaterialPool` — GPU material cache with refcount tests.
 *
 * Eliminates per-entity material allocations for markers — all
 * abstract markers of the same type share a single GPU resource.
 * The acquire/release/refcount machinery is bug-prone (acquire-
 * after-dispose throws, release at 0 doesn't underflow, materials
 * stay in pool even at refcount 0 for reuse). Direct tests pin
 * the contract.
 */

import * as THREE from "three/webgpu";
import { describe, expect, it, vi } from "vitest";
import { MaterialPool } from "../MaterialPool";

describe("MaterialPool — basic acquire / release", () => {
  it("acquire creates a fresh material on first call", () => {
    const pool = new MaterialPool();
    const mat = pool.acquire("k1", { type: "basic", color: 0xff0000 });
    expect(mat).toBeDefined();
    expect(mat).toBeInstanceOf(THREE.Material);
    expect(pool.size).toBe(1);
    pool.dispose();
  });

  it("acquire returns SAME instance for the same key (singleton per key)", () => {
    const pool = new MaterialPool();
    const a = pool.acquire("k1", { type: "basic", color: 0xff0000 });
    const b = pool.acquire("k1", { type: "basic", color: 0xff0000 });
    expect(a).toBe(b); // same reference
    expect(pool.size).toBe(1);
    pool.dispose();
  });

  it("acquire creates separate materials for different keys", () => {
    const pool = new MaterialPool();
    const a = pool.acquire("k1", { type: "basic", color: 0xff0000 });
    const b = pool.acquire("k2", { type: "basic", color: 0x00ff00 });
    expect(a).not.toBe(b);
    expect(pool.size).toBe(2);
    pool.dispose();
  });

  it("release decrements refcount but keeps material in pool", () => {
    const pool = new MaterialPool();
    pool.acquire("k1", { type: "basic", color: 0xff0000 });
    pool.acquire("k1", { type: "basic", color: 0xff0000 }); // refcount=2
    pool.release("k1"); // refcount=1
    pool.release("k1"); // refcount=0
    // Material still in pool — only dispose() frees it.
    expect(pool.size).toBe(1);
    pool.dispose();
  });

  it("release at refcount 0 does NOT underflow", () => {
    const pool = new MaterialPool();
    pool.acquire("k1", { type: "basic", color: 0xff0000 });
    pool.release("k1"); // 0
    pool.release("k1"); // would be -1 — guard prevents underflow
    pool.release("k1"); // still 0
    // Subsequent acquire still works.
    const mat = pool.acquire("k1", { type: "basic", color: 0xff0000 });
    expect(mat).toBeDefined();
    pool.dispose();
  });

  it("release of unknown key is a no-op (does NOT throw)", () => {
    const pool = new MaterialPool();
    expect(() => pool.release("never-seen")).not.toThrow();
    pool.dispose();
  });
});

describe("MaterialPool — material types", () => {
  it("creates MeshStandardNodeMaterial for type='standard'", () => {
    const pool = new MaterialPool();
    const mat = pool.acquire("k", {
      type: "standard",
      color: 0xff0000,
      emissive: 0xffffff,
      emissiveIntensity: 0.5,
      roughness: 0.4,
      metalness: 0.6,
    });
    // Has the standard-material props.
    expect((mat as THREE.MeshStandardMaterial).roughness).toBe(0.4);
    expect((mat as THREE.MeshStandardMaterial).metalness).toBe(0.6);
    expect((mat as THREE.MeshStandardMaterial).emissiveIntensity).toBe(0.5);
    pool.dispose();
  });

  it("creates MeshBasicNodeMaterial for type='basic'", () => {
    const pool = new MaterialPool();
    const mat = pool.acquire("k", {
      type: "basic",
      color: 0xff0000,
      transparent: true,
      opacity: 0.5,
      side: THREE.DoubleSide,
    });
    expect(mat.transparent).toBe(true);
    expect(mat.opacity).toBe(0.5);
    expect(mat.side).toBe(THREE.DoubleSide);
    pool.dispose();
  });

  it("creates LineBasicNodeMaterial for type='lineBasic'", () => {
    const pool = new MaterialPool();
    const mat = pool.acquire("k", {
      type: "lineBasic",
      color: 0xffffff,
      transparent: true,
      opacity: 0.8,
    });
    expect(mat.opacity).toBe(0.8);
    pool.dispose();
  });

  it("respects depthWrite, transparent, opacity options", () => {
    const pool = new MaterialPool();
    const mat = pool.acquire("k", {
      type: "basic",
      color: 0,
      transparent: true,
      opacity: 0.25,
      depthWrite: false,
    });
    expect(mat.transparent).toBe(true);
    expect(mat.opacity).toBe(0.25);
    expect(mat.depthWrite).toBe(false);
    pool.dispose();
  });
});

describe("MaterialPool — acquireMarker / releaseMarker convenience", () => {
  it("acquireMarker uses 'marker:' key prefix", () => {
    const pool = new MaterialPool();
    const a = pool.acquireMarker("npc", 0xff0000);
    const b = pool.acquireMarker("npc", 0xff0000); // same key
    expect(a).toBe(b);
    expect(pool.size).toBe(1);
    pool.dispose();
  });

  it("acquireMarker uses standard material with emissive preset", () => {
    const pool = new MaterialPool();
    const mat = pool.acquireMarker(
      "npc",
      0xff0000,
    ) as THREE.MeshStandardMaterial;
    expect(mat.emissiveIntensity).toBe(0.3);
    expect(mat.roughness).toBe(0.7);
    expect(mat.metalness).toBe(0.2);
    pool.dispose();
  });

  it("releaseMarker decrements the matching marker key", () => {
    const pool = new MaterialPool();
    pool.acquireMarker("npc", 0xff0000);
    pool.acquireMarker("npc", 0xff0000); // refcount=2
    pool.releaseMarker("npc"); // refcount=1
    pool.releaseMarker("npc"); // refcount=0
    expect(pool.size).toBe(1); // still in pool
    pool.dispose();
  });
});

describe("MaterialPool — dispose lifecycle", () => {
  it("dispose() clears the pool and frees all materials", () => {
    const pool = new MaterialPool();
    const m1 = pool.acquire("k1", { type: "basic", color: 0 });
    const m2 = pool.acquire("k2", { type: "basic", color: 0 });
    const spy1 = vi.spyOn(m1, "dispose");
    const spy2 = vi.spyOn(m2, "dispose");
    pool.dispose();
    expect(spy1).toHaveBeenCalledOnce();
    expect(spy2).toHaveBeenCalledOnce();
    expect(pool.size).toBe(0);
  });

  it("dispose() is idempotent — calling twice is safe", () => {
    const pool = new MaterialPool();
    pool.acquire("k", { type: "basic", color: 0 });
    pool.dispose();
    expect(() => pool.dispose()).not.toThrow();
  });

  it("acquire after dispose THROWS", () => {
    const pool = new MaterialPool();
    pool.dispose();
    expect(() => pool.acquire("k", { type: "basic", color: 0 })).toThrow(
      /dispose/,
    );
  });

  it("dispose swallows .dispose() errors (race-condition tolerance)", () => {
    const pool = new MaterialPool();
    const m = pool.acquire("k", { type: "basic", color: 0 });
    vi.spyOn(m, "dispose").mockImplementation(() => {
      throw new Error("WebGPU race");
    });
    expect(() => pool.dispose()).not.toThrow();
  });
});

describe("MaterialPool — size accessor", () => {
  it("size starts at 0", () => {
    const pool = new MaterialPool();
    expect(pool.size).toBe(0);
    pool.dispose();
  });

  it("size reflects unique-key count, not total acquires", () => {
    const pool = new MaterialPool();
    pool.acquire("a", { type: "basic", color: 0 });
    pool.acquire("a", { type: "basic", color: 0 }); // dup key
    pool.acquire("b", { type: "basic", color: 0 });
    expect(pool.size).toBe(2);
    pool.dispose();
  });
});
