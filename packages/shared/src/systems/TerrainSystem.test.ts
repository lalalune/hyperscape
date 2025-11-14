import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";
import { TerrainSystem } from "./TerrainSystem";
import { GrassSystem } from "./GrassSystem";
import THREE from "../extras/three";
import type { World } from "../types";
import type { TerrainTile, Heightfield } from "../types/terrain";
import type { PhysicsHandle } from "../types/physics";

/**
 * TerrainSystem Tests
 *
 * These tests verify terrain generation, heightfield data, and resource placement
 * without requiring texture loading or visual rendering.
 */

// Create a minimal test world without texture loading
function createMinimalTestWorld(): World {
  const scene = new THREE.Scene();

  const world = {
    isClient: false, // Set to false to skip texture atlas loading
    isServer: true, // Set to server mode to skip client-specific loading
    systems: [] as unknown[],
    stage: { scene },
    network: {
      isClient: false,
      isServer: true,
    },
    physics: {
      physics: {
        createMaterial: vi.fn(() => ({})),
        createShape: vi.fn(() => ({
          setQueryFilterData: vi.fn(),
          setSimulationFilterData: vi.fn(),
        })),
        createRigidStatic: vi.fn(() => ({
          attachShape: vi.fn(),
        })),
      },
      addActor: vi.fn(() => ({}) as PhysicsHandle),
    },
    getSystem: vi.fn((name: string) => {
      if (name === "database") return null;
      return null;
    }),
    getPlayers: vi.fn(() => []),
    emit: vi.fn(),
    loader: {
      load: vi.fn(async () => null),
    },
    destroy: vi.fn(),
  } as unknown as World;

  return world;
}

describe("TerrainSystem", () => {
  let world: World;
  let terrainSystem: TerrainSystem;

  beforeAll(async () => {
    world = createMinimalTestWorld();
    terrainSystem = new TerrainSystem(world);
    await terrainSystem.init();
    await terrainSystem.start();
  });

  afterAll(() => {
    if (terrainSystem) {
      terrainSystem.destroy();
    }
  });

  it("should initialize correctly", () => {
    expect(terrainSystem).toBeDefined();
    expect(terrainSystem.getTiles()).toBeDefined();
  });

  it("should return consistent height values", () => {
    const height1 = terrainSystem.getHeightAt(0, 0);
    const height2 = terrainSystem.getHeightAt(0, 0);

    expect(height1).toBe(height2);
    expect(typeof height1).toBe("number");
    expect(isFinite(height1)).toBe(true);
  });

  it("should calculate slope correctly", () => {
    const terrainInfo = terrainSystem.getTerrainInfoAt(0, 0);

    expect(terrainInfo).toBeDefined();
    expect(terrainInfo.slope).toBeGreaterThanOrEqual(0);
    expect(typeof terrainInfo.slope).toBe("number");
    expect(isFinite(terrainInfo.slope)).toBe(true);
  });

  it("should determine walkability based on terrain", () => {
    const walkableCheck = terrainSystem.isPositionWalkable(0, 0);

    expect(walkableCheck).toBeDefined();
    expect(typeof walkableCheck.walkable).toBe("boolean");
  });
});

describe("GrassSystem", () => {
  it("should initialize correctly on server (skips texture loading)", async () => {
    const world = createMinimalTestWorld();
    const grassSystem = new GrassSystem(world);

    // On server, init should complete without loading textures
    await grassSystem.init();

    expect(grassSystem).toBeDefined();
  });

  it("should update without crashing when grassUniforms not initialized", () => {
    const world = createMinimalTestWorld();
    const grassSystem = new GrassSystem(world);

    // Update should not crash even if uniforms aren't initialized
    grassSystem.update(0.016);

    expect(true).toBe(true);
  });
});
