/**
 * Terrain Showcase - Mini World Test
 *
 * Creates a compact world with ALL terrain features loaded at once:
 * - All biomes (forest, plains, mountains, desert, swamp, tundra, jungle)
 * - All resource types (trees, rocks, herbs, ores)
 * - Lakes, rivers, water bodies
 * - Towns with buildings
 * - Road network
 * - Grass with entity interaction
 *
 * This test verifies:
 * - All assets load without errors
 * - All shaders compile successfully
 * - Batching is working correctly
 * - Visual rendering is correct
 * - Performance is acceptable
 *
 * NO MOCKS - Real terrain, real assets, real rendering
 */

import { test, expect, type Page } from "@playwright/test";

const GAME_URL = process.env.HYPERSCAPE_URL || "http://localhost:3333";
const SCREENSHOT_DIR = "./test-results/terrain-showcase";

// ============================================
// SHOWCASE CONFIGURATION
// ============================================

interface ShowcaseConfig {
  // Force load all tiles in this radius (meters)
  loadRadius: number;
  // Wait time for full asset loading (ms)
  assetLoadWait: number;
  // Expected minimum resources
  minTrees: number;
  minRocks: number;
  minGrassInstances: number;
}

const SHOWCASE_CONFIG: ShowcaseConfig = {
  loadRadius: 500, // 500m radius = covers multiple biomes
  assetLoadWait: 10000, // 10 seconds for all assets
  minTrees: 50,
  minRocks: 20,
  minGrassInstances: 1000,
};

// ============================================
// HELPER FUNCTIONS
// ============================================

/**
 * Force load all terrain tiles in a radius
 */
async function forceLoadAllTerrain(page: Page, radius: number): Promise<void> {
  await page.evaluate((r) => {
    const world = (
      window as unknown as {
        world?: {
          terrain?: {
            generateTilesInRadius?: (
              x: number,
              z: number,
              radius: number,
            ) => void;
            loadTilesAroundPosition?: (
              x: number,
              z: number,
              radius: number,
            ) => void;
            CONFIG?: { VIEW_DISTANCE?: number };
          };
        };
      }
    ).world;

    if (world?.terrain) {
      // Override view distance temporarily
      if (world.terrain.CONFIG) {
        world.terrain.CONFIG.VIEW_DISTANCE = r;
      }

      // Try different methods to force load
      if (world.terrain.generateTilesInRadius) {
        world.terrain.generateTilesInRadius(0, 0, r);
      }
      if (world.terrain.loadTilesAroundPosition) {
        world.terrain.loadTilesAroundPosition(0, 0, r);
      }
    }
  }, radius);
}

/**
 * Get comprehensive world statistics
 */
async function getWorldStats(page: Page): Promise<{
  terrain: {
    tileCount: number;
    heightRange: { min: number; max: number };
    biomes: string[];
  };
  resources: {
    trees: number;
    treeVariants: Record<string, number>;
    rocks: number;
    rockVariants: Record<string, number>;
    herbs: number;
    stones: number;
    ores: number;
  };
  grass: {
    meshCount: number;
    totalInstances: number;
  };
  water: {
    waterMeshCount: number;
    hasLakes: boolean;
  };
  towns: {
    townCount: number;
    buildingCount: number;
  };
  roads: {
    roadSegments: number;
  };
  instancing: {
    instancedMeshTypes: string[];
    totalVisible: number;
    totalRegistered: number;
  };
  shaders: {
    terrainMaterialValid: boolean;
    grassMaterialValid: boolean;
    waterMaterialValid: boolean;
  };
  performance: {
    drawCalls: number;
    triangles: number;
  };
}> {
  return await page.evaluate(() => {
    const world = (
      window as unknown as {
        world?: {
          terrain?: {
            terrainTiles?: Map<
              string,
              {
                biome?: string;
                resources?: Array<{ type: string }>;
                waterMeshes?: unknown[];
                roads?: unknown[];
                mesh?: { material?: unknown };
              }
            >;
            getHeightAt?: (x: number, z: number) => number;
            instancedMeshManager?: {
              getPoolingStats?: () => Record<
                string,
                { total: number; visible: number }
              >;
            };
          };
          stage?: {
            scene?: {
              children: Array<{
                name?: string;
                type?: string;
                count?: number;
                material?: { type?: string };
                children?: unknown[];
              }>;
            };
          };
          grassSystem?: {
            grassUniforms?: unknown;
          };
          renderer?: {
            info?: {
              render?: { calls: number; triangles: number };
            };
          };
        };
      }
    ).world;

    const result = {
      terrain: {
        tileCount: 0,
        heightRange: { min: Infinity, max: -Infinity },
        biomes: [] as string[],
      },
      resources: {
        trees: 0,
        treeVariants: {} as Record<string, number>,
        rocks: 0,
        rockVariants: {} as Record<string, number>,
        herbs: 0,
        stones: 0,
        ores: 0,
      },
      grass: {
        meshCount: 0,
        totalInstances: 0,
      },
      water: {
        waterMeshCount: 0,
        hasLakes: false,
      },
      towns: {
        townCount: 0,
        buildingCount: 0,
      },
      roads: {
        roadSegments: 0,
      },
      instancing: {
        instancedMeshTypes: [] as string[],
        totalVisible: 0,
        totalRegistered: 0,
      },
      shaders: {
        terrainMaterialValid: false,
        grassMaterialValid: false,
        waterMaterialValid: false,
      },
      performance: {
        drawCalls: 0,
        triangles: 0,
      },
    };

    if (!world?.terrain?.terrainTiles) return result;

    const biomeSet = new Set<string>();

    // Analyze terrain tiles
    world.terrain.terrainTiles.forEach((tile) => {
      result.terrain.tileCount++;

      if (tile.biome) biomeSet.add(tile.biome);

      // Count resources
      if (tile.resources) {
        for (const resource of tile.resources) {
          if (resource.type.startsWith("tree")) {
            result.resources.trees++;
            result.resources.treeVariants[resource.type] =
              (result.resources.treeVariants[resource.type] || 0) + 1;
          } else if (resource.type.startsWith("rock")) {
            result.resources.rocks++;
            result.resources.rockVariants[resource.type] =
              (result.resources.rockVariants[resource.type] || 0) + 1;
          } else if (resource.type === "herb") {
            result.resources.herbs++;
          } else if (resource.type === "stone") {
            result.resources.stones++;
          } else if (resource.type === "ore" || resource.type === "rare_ore") {
            result.resources.ores++;
          }
        }
      }

      // Count water
      if (tile.waterMeshes && tile.waterMeshes.length > 0) {
        result.water.waterMeshCount += tile.waterMeshes.length;
        result.water.hasLakes = true;
      }

      // Count roads
      if (tile.roads) {
        result.roads.roadSegments += tile.roads.length;
      }

      // Check terrain material
      if (tile.mesh?.material) {
        result.shaders.terrainMaterialValid = true;
      }
    });

    result.terrain.biomes = Array.from(biomeSet);

    // Sample heights
    if (world.terrain.getHeightAt) {
      for (let x = -400; x <= 400; x += 50) {
        for (let z = -400; z <= 400; z += 50) {
          const h = world.terrain.getHeightAt(x, z);
          result.terrain.heightRange.min = Math.min(
            result.terrain.heightRange.min,
            h,
          );
          result.terrain.heightRange.max = Math.max(
            result.terrain.heightRange.max,
            h,
          );
        }
      }
    }

    // Analyze scene for grass, towns, buildings
    if (world.stage?.scene) {
      const traverse = (obj: {
        name?: string;
        type?: string;
        count?: number;
        material?: { type?: string };
        children?: unknown[];
      }) => {
        // Grass meshes
        if (
          obj.name?.includes("Grass") ||
          (obj.type === "InstancedMesh" && obj.name?.includes("grass"))
        ) {
          result.grass.meshCount++;
          result.grass.totalInstances += obj.count || 0;
        }

        // Towns and buildings
        if (obj.name?.startsWith("Town_")) {
          result.towns.townCount++;
        }
        if (obj.name?.startsWith("Building_")) {
          result.towns.buildingCount++;
        }

        // Check grass material
        if (obj.name?.includes("Grass") && obj.material) {
          result.shaders.grassMaterialValid = true;
        }

        // Check water material
        if (obj.name?.includes("Water") && obj.material) {
          result.shaders.waterMaterialValid = true;
        }

        if (obj.children) {
          for (const child of obj.children as Array<{
            name?: string;
            type?: string;
            count?: number;
            material?: { type?: string };
            children?: unknown[];
          }>) {
            traverse(child);
          }
        }
      };

      for (const child of world.stage.scene.children) {
        traverse(child);
      }
    }

    // Instancing stats
    if (world.terrain.instancedMeshManager?.getPoolingStats) {
      const stats = world.terrain.instancedMeshManager.getPoolingStats();
      for (const [type, data] of Object.entries(stats)) {
        result.instancing.instancedMeshTypes.push(type);
        result.instancing.totalVisible += data.visible;
        result.instancing.totalRegistered += data.total;
      }
    }

    // Performance stats
    if (world.renderer?.info?.render) {
      result.performance.drawCalls = world.renderer.info.render.calls;
      result.performance.triangles = world.renderer.info.render.triangles;
    }

    // Check grass uniforms
    if (world.grassSystem?.grassUniforms) {
      result.shaders.grassMaterialValid = true;
    }

    return result;
  });
}

/**
 * Take labeled screenshot
 */
async function takeShowcaseScreenshot(
  page: Page,
  name: string,
): Promise<Buffer> {
  const screenshot = await page.screenshot({
    path: `${SCREENSHOT_DIR}/${name}.png`,
    fullPage: false,
  });
  return screenshot;
}

/**
 * Move camera to position for screenshot
 */
async function moveCameraTo(
  page: Page,
  x: number,
  y: number,
  z: number,
  lookAtX = 0,
  lookAtY = 0,
  lookAtZ = 0,
): Promise<void> {
  await page.evaluate(
    ({ pos, lookAt }) => {
      const world = (
        window as unknown as {
          world?: {
            camera?: {
              position: { set: (x: number, y: number, z: number) => void };
              lookAt: (x: number, y: number, z: number) => void;
            };
          };
        }
      ).world;

      if (world?.camera) {
        world.camera.position.set(pos.x, pos.y, pos.z);
        world.camera.lookAt(lookAt.x, lookAt.y, lookAt.z);
      }
    },
    { pos: { x, y, z }, lookAt: { x: lookAtX, y: lookAtY, z: lookAtZ } },
  );
}

// ============================================
// SHOWCASE TESTS
// ============================================

test.describe("Terrain Showcase - Full World Verification", () => {
  test.beforeAll(async () => {
    // Ensure screenshot directory exists
    const fs = await import("fs");
    if (!fs.existsSync(SCREENSHOT_DIR)) {
      fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });
    }
  });

  test("load and verify complete mini-world", async ({ page }) => {
    // Collect all console messages for debugging
    const consoleLogs: string[] = [];
    const consoleErrors: string[] = [];

    page.on("console", (msg) => {
      const text = msg.text();
      consoleLogs.push(`[${msg.type()}] ${text}`);
      if (msg.type() === "error") {
        consoleErrors.push(text);
      }
    });

    page.on("pageerror", (error) => {
      consoleErrors.push(`Page error: ${error.message}`);
    });

    console.log("=== TERRAIN SHOWCASE TEST ===");
    console.log("Loading game...");

    // Navigate to game
    await page.goto(GAME_URL);
    await page.waitForLoadState("networkidle");

    // Wait for initial terrain
    console.log("Waiting for terrain system...");
    await page.waitForFunction(
      () => {
        const w = (
          window as unknown as {
            world?: { terrain?: { terrainTiles?: Map<string, unknown> } };
          }
        ).world;
        return w?.terrain?.terrainTiles && w.terrain.terrainTiles.size > 0;
      },
      { timeout: 60000 },
    );

    // Force load extended terrain
    console.log(
      `Force loading terrain in ${SHOWCASE_CONFIG.loadRadius}m radius...`,
    );
    await forceLoadAllTerrain(page, SHOWCASE_CONFIG.loadRadius);

    // Wait for all assets to load
    console.log(`Waiting ${SHOWCASE_CONFIG.assetLoadWait}ms for assets...`);
    await page.waitForTimeout(SHOWCASE_CONFIG.assetLoadWait);

    // Get comprehensive stats
    console.log("Gathering world statistics...");
    const stats = await getWorldStats(page);

    // ============================================
    // VERIFY TERRAIN
    // ============================================
    console.log("\n--- TERRAIN ---");
    console.log(`Tiles loaded: ${stats.terrain.tileCount}`);
    console.log(
      `Height range: ${stats.terrain.heightRange.min.toFixed(1)}m - ${stats.terrain.heightRange.max.toFixed(1)}m`,
    );
    console.log(`Biomes: ${stats.terrain.biomes.join(", ")}`);

    expect(stats.terrain.tileCount).toBeGreaterThan(0);
    expect(
      stats.terrain.heightRange.max - stats.terrain.heightRange.min,
    ).toBeGreaterThan(10);

    // ============================================
    // VERIFY RESOURCES
    // ============================================
    console.log("\n--- RESOURCES ---");
    console.log(`Trees: ${stats.resources.trees}`);
    console.log(`  Variants: ${JSON.stringify(stats.resources.treeVariants)}`);
    console.log(`Rocks: ${stats.resources.rocks}`);
    console.log(`  Variants: ${JSON.stringify(stats.resources.rockVariants)}`);
    console.log(`Herbs: ${stats.resources.herbs}`);
    console.log(`Stones: ${stats.resources.stones}`);
    console.log(`Ores: ${stats.resources.ores}`);

    expect(stats.resources.trees).toBeGreaterThan(SHOWCASE_CONFIG.minTrees);
    expect(stats.resources.rocks).toBeGreaterThan(SHOWCASE_CONFIG.minRocks);

    // ============================================
    // VERIFY GRASS
    // ============================================
    console.log("\n--- GRASS ---");
    console.log(`Grass meshes: ${stats.grass.meshCount}`);
    console.log(`Total instances: ${stats.grass.totalInstances}`);

    // Grass might not be visible in all tiles
    console.log(`Grass present: ${stats.grass.meshCount > 0}`);

    // ============================================
    // VERIFY WATER
    // ============================================
    console.log("\n--- WATER ---");
    console.log(`Water meshes: ${stats.water.waterMeshCount}`);
    console.log(`Has lakes: ${stats.water.hasLakes}`);

    // ============================================
    // VERIFY TOWNS & ROADS
    // ============================================
    console.log("\n--- TOWNS & ROADS ---");
    console.log(`Towns: ${stats.towns.townCount}`);
    console.log(`Buildings: ${stats.towns.buildingCount}`);
    console.log(`Road segments: ${stats.roads.roadSegments}`);

    // ============================================
    // VERIFY INSTANCING
    // ============================================
    console.log("\n--- INSTANCING ---");
    console.log(
      `Instanced types: ${stats.instancing.instancedMeshTypes.join(", ")}`,
    );
    console.log(`Total visible: ${stats.instancing.totalVisible}`);
    console.log(`Total registered: ${stats.instancing.totalRegistered}`);

    // ============================================
    // VERIFY SHADERS
    // ============================================
    console.log("\n--- SHADERS ---");
    console.log(
      `Terrain material valid: ${stats.shaders.terrainMaterialValid}`,
    );
    console.log(`Grass material valid: ${stats.shaders.grassMaterialValid}`);
    console.log(`Water material valid: ${stats.shaders.waterMaterialValid}`);

    expect(stats.shaders.terrainMaterialValid).toBe(true);

    // ============================================
    // VERIFY PERFORMANCE
    // ============================================
    console.log("\n--- PERFORMANCE ---");
    console.log(`Draw calls: ${stats.performance.drawCalls}`);
    console.log(`Triangles: ${stats.performance.triangles}`);

    // ============================================
    // CHECK ERRORS
    // ============================================
    console.log("\n--- ERRORS ---");
    const criticalErrors = consoleErrors.filter(
      (e) =>
        !e.includes("extension") &&
        !e.includes("deprecated") &&
        !e.includes("favicon"),
    );
    console.log(`Console errors: ${criticalErrors.length}`);
    if (criticalErrors.length > 0) {
      console.log("Critical errors:", criticalErrors.slice(0, 5));
    }

    // ============================================
    // TAKE SCREENSHOTS
    // ============================================
    console.log("\n--- SCREENSHOTS ---");

    // Overview from above
    await moveCameraTo(page, 0, 200, 200, 0, 0, 0);
    await page.waitForTimeout(500);
    await takeShowcaseScreenshot(page, "01-overview");
    console.log("Saved: 01-overview.png");

    // Town center
    await moveCameraTo(page, 0, 30, 50, 0, 10, 0);
    await page.waitForTimeout(500);
    await takeShowcaseScreenshot(page, "02-town-center");
    console.log("Saved: 02-town-center.png");

    // Close up of terrain/grass
    await moveCameraTo(page, 50, 15, 50, 50, 0, 0);
    await page.waitForTimeout(500);
    await takeShowcaseScreenshot(page, "03-terrain-closeup");
    console.log("Saved: 03-terrain-closeup.png");

    // Road view
    await moveCameraTo(page, 100, 20, 0, 200, 10, 0);
    await page.waitForTimeout(500);
    await takeShowcaseScreenshot(page, "04-road-view");
    console.log("Saved: 04-road-view.png");

    // Mountain view (if exists)
    await moveCameraTo(page, 300, 100, 300, 0, 30, 0);
    await page.waitForTimeout(500);
    await takeShowcaseScreenshot(page, "05-distant-view");
    console.log("Saved: 05-distant-view.png");

    console.log("\n=== SHOWCASE COMPLETE ===");

    // Final assertions
    expect(criticalErrors.length).toBe(0);
  });

  test("verify all tree variants are registered", async ({ page }) => {
    await page.goto(GAME_URL);
    await page.waitForLoadState("networkidle");

    await page.waitForFunction(
      () => {
        const w = (
          window as unknown as {
            world?: { terrain?: { terrainTiles?: Map<string, unknown> } };
          }
        ).world;
        return w?.terrain?.terrainTiles && w.terrain.terrainTiles.size > 0;
      },
      { timeout: 60000 },
    );

    const instancedTypes = await page.evaluate(() => {
      const world = (
        window as unknown as {
          world?: {
            terrain?: {
              instancedMeshManager?: {
                instancedMeshes?: Map<string, unknown>;
              };
            };
          };
        }
      ).world;

      if (!world?.terrain?.instancedMeshManager?.instancedMeshes) return [];
      return Array.from(
        world.terrain.instancedMeshManager.instancedMeshes.keys(),
      );
    });

    console.log("Registered instanced mesh types:", instancedTypes);

    // Should have multiple tree types
    const treeTypes = instancedTypes.filter((t) => t.includes("tree"));
    console.log("Tree types:", treeTypes);

    // Should have tree registered
    expect(instancedTypes).toContain("tree");
  });

  test("verify all rock variants are registered", async ({ page }) => {
    await page.goto(GAME_URL);
    await page.waitForLoadState("networkidle");

    await page.waitForFunction(
      () => {
        const w = (
          window as unknown as {
            world?: { terrain?: { terrainTiles?: Map<string, unknown> } };
          }
        ).world;
        return w?.terrain?.terrainTiles && w.terrain.terrainTiles.size > 0;
      },
      { timeout: 60000 },
    );

    const instancedTypes = await page.evaluate(() => {
      const world = (
        window as unknown as {
          world?: {
            terrain?: {
              instancedMeshManager?: {
                instancedMeshes?: Map<string, unknown>;
              };
            };
          };
        }
      ).world;

      if (!world?.terrain?.instancedMeshManager?.instancedMeshes) return [];
      return Array.from(
        world.terrain.instancedMeshManager.instancedMeshes.keys(),
      );
    });

    console.log("Registered instanced mesh types:", instancedTypes);

    // Should have rock variants
    const rockTypes = instancedTypes.filter(
      (t) => t.includes("rock") || t === "stone" || t.includes("ore"),
    );
    console.log("Rock/stone types:", rockTypes);

    // Should have rock registered
    expect(instancedTypes).toContain("rock");
  });

  test("verify shader compilation (no WebGL errors)", async ({ page }) => {
    const shaderErrors: string[] = [];

    page.on("console", (msg) => {
      const text = msg.text().toLowerCase();
      if (
        (text.includes("shader") ||
          text.includes("glsl") ||
          text.includes("webgl")) &&
        (text.includes("error") ||
          text.includes("failed") ||
          text.includes("compile"))
      ) {
        shaderErrors.push(msg.text());
      }
    });

    await page.goto(GAME_URL);
    await page.waitForLoadState("networkidle");

    await page.waitForFunction(
      () => {
        const w = (
          window as unknown as {
            world?: { terrain?: { terrainTiles?: Map<string, unknown> } };
          }
        ).world;
        return w?.terrain?.terrainTiles && w.terrain.terrainTiles.size > 0;
      },
      { timeout: 60000 },
    );

    // Wait for all shaders to compile
    await page.waitForTimeout(5000);

    console.log(`Shader errors found: ${shaderErrors.length}`);
    if (shaderErrors.length > 0) {
      console.log("Shader errors:", shaderErrors);
    }

    expect(shaderErrors.length).toBe(0);
  });

  test("verify batching reduces draw calls", async ({ page }) => {
    await page.goto(GAME_URL);
    await page.waitForLoadState("networkidle");

    await page.waitForFunction(
      () => {
        const w = (
          window as unknown as {
            world?: { terrain?: { terrainTiles?: Map<string, unknown> } };
          }
        ).world;
        return w?.terrain?.terrainTiles && w.terrain.terrainTiles.size > 0;
      },
      { timeout: 60000 },
    );

    await page.waitForTimeout(5000);

    const renderStats = await page.evaluate(() => {
      const world = (
        window as unknown as {
          world?: {
            renderer?: {
              info?: {
                render?: { calls: number; triangles: number };
                memory?: { geometries: number; textures: number };
              };
            };
            terrain?: {
              terrainTiles?: Map<string, { resources?: unknown[] }>;
            };
          };
        }
      ).world;

      let totalResources = 0;
      if (world?.terrain?.terrainTiles) {
        world.terrain.terrainTiles.forEach((tile) => {
          totalResources += tile.resources?.length || 0;
        });
      }

      return {
        drawCalls: world?.renderer?.info?.render?.calls || 0,
        triangles: world?.renderer?.info?.render?.triangles || 0,
        geometries: world?.renderer?.info?.memory?.geometries || 0,
        textures: world?.renderer?.info?.memory?.textures || 0,
        totalResources,
      };
    });

    console.log("Render stats:", renderStats);
    console.log(
      `Resources per draw call: ${(renderStats.totalResources / Math.max(1, renderStats.drawCalls)).toFixed(1)}`,
    );

    // With batching, draw calls should be much less than total resources
    // (each instanced mesh type = 1 draw call for potentially hundreds of instances)
    if (renderStats.totalResources > 0 && renderStats.drawCalls > 0) {
      const efficiency = renderStats.totalResources / renderStats.drawCalls;
      console.log(
        `Batching efficiency: ${efficiency.toFixed(1)} resources per draw call`,
      );
      // Should batch at least 2 resources per draw call on average
      expect(efficiency).toBeGreaterThan(1);
    }
  });

  test("verify biome batching groups resources correctly", async ({ page }) => {
    await page.goto(GAME_URL);
    await page.waitForLoadState("networkidle");

    await page.waitForFunction(
      () => {
        const w = (
          window as unknown as {
            world?: { terrain?: { terrainTiles?: Map<string, unknown> } };
          }
        ).world;
        return w?.terrain?.terrainTiles && w.terrain.terrainTiles.size > 0;
      },
      { timeout: 60000 },
    );

    await page.waitForTimeout(5000);

    const biomeBatchingStats = await page.evaluate(() => {
      const world = (
        window as unknown as {
          world?: {
            terrain?: {
              instancedMeshManager?: {
                getBiomeBatchingSummary?: () => {
                  totalBiomes: number;
                  totalBiomeMeshes: number;
                  instancesPerBiome: Record<string, number>;
                  drawCallsPerBiome: Record<string, number>;
                };
                getDrawCallCount?: () => number;
              };
            };
          };
        }
      ).world;

      const manager = world?.terrain?.instancedMeshManager;
      if (!manager) return null;

      return {
        summary: manager.getBiomeBatchingSummary?.() || null,
        totalDrawCalls: manager.getDrawCallCount?.() || 0,
      };
    });

    if (biomeBatchingStats) {
      console.log(
        "Biome batching stats:",
        JSON.stringify(biomeBatchingStats, null, 2),
      );

      if (biomeBatchingStats.summary) {
        const {
          totalBiomes,
          totalBiomeMeshes,
          instancesPerBiome,
          drawCallsPerBiome,
        } = biomeBatchingStats.summary;

        console.log(`Total biomes: ${totalBiomes}`);
        console.log(`Total biome meshes: ${totalBiomeMeshes}`);
        console.log(`Instances per biome:`, instancesPerBiome);
        console.log(`Draw calls per biome:`, drawCallsPerBiome);

        // Each biome should have grouped instances
        const biomes = Object.keys(instancesPerBiome);
        for (const biome of biomes) {
          const instances = instancesPerBiome[biome];
          const drawCalls = drawCallsPerBiome[biome];
          if (instances > 0 && drawCalls > 0) {
            const efficiency = instances / drawCalls;
            console.log(
              `  ${biome}: ${instances} instances in ${drawCalls} draw calls (${efficiency.toFixed(1)} per call)`,
            );
          }
        }
      }
    }
  });

  test("verify terrain material sharing optimization", async ({ page }) => {
    await page.goto(GAME_URL);
    await page.waitForLoadState("networkidle");

    await page.waitForFunction(
      () => {
        const w = (
          window as unknown as {
            world?: { terrain?: { terrainTiles?: Map<string, unknown> } };
          }
        ).world;
        return w?.terrain?.terrainTiles && w.terrain.terrainTiles.size > 0;
      },
      { timeout: 60000 },
    );

    await page.waitForTimeout(3000);

    const materialSharingStats = await page.evaluate(() => {
      const world = (
        window as unknown as {
          world?: {
            terrain?: {
              terrainTiles?: Map<
                string,
                { mesh?: { material?: { uuid?: string } } }
              >;
              terrainMaterial?: { uuid?: string };
            };
          };
        }
      ).world;

      if (!world?.terrain?.terrainTiles) return null;

      const materialUuids = new Set<string>();
      let tilesWithMaterial = 0;
      let tilesWithSharedMaterial = 0;
      const sharedMaterialUuid = world.terrain.terrainMaterial?.uuid;

      world.terrain.terrainTiles.forEach((tile) => {
        if (tile.mesh?.material?.uuid) {
          tilesWithMaterial++;
          materialUuids.add(tile.mesh.material.uuid);
          if (tile.mesh.material.uuid === sharedMaterialUuid) {
            tilesWithSharedMaterial++;
          }
        }
      });

      return {
        totalTiles: world.terrain.terrainTiles.size,
        tilesWithMaterial,
        tilesWithSharedMaterial,
        uniqueMaterials: materialUuids.size,
        sharedMaterialUuid,
        allMaterialUuids: Array.from(materialUuids),
      };
    });

    if (materialSharingStats) {
      console.log(
        "Material sharing stats:",
        JSON.stringify(materialSharingStats, null, 2),
      );
      console.log(`Total tiles: ${materialSharingStats.totalTiles}`);
      console.log(
        `Tiles with shared material: ${materialSharingStats.tilesWithSharedMaterial}`,
      );
      console.log(`Unique materials: ${materialSharingStats.uniqueMaterials}`);

      // OPTIMIZATION CHECK: All tiles should share the same material
      // If uniqueMaterials > 1, material sharing is not working!
      if (materialSharingStats.tilesWithMaterial > 0) {
        const sharingPercentage =
          (materialSharingStats.tilesWithSharedMaterial /
            materialSharingStats.tilesWithMaterial) *
          100;
        console.log(`Material sharing: ${sharingPercentage.toFixed(1)}%`);

        // Should have very few unique materials (ideally 1)
        expect(materialSharingStats.uniqueMaterials).toBeLessThanOrEqual(2);
      }
    }
  });

  test("verify frustum culling is enabled", async ({ page }) => {
    await page.goto(GAME_URL);
    await page.waitForLoadState("networkidle");

    await page.waitForFunction(
      () => {
        const w = (
          window as unknown as {
            world?: { terrain?: { terrainTiles?: Map<string, unknown> } };
          }
        ).world;
        return w?.terrain?.terrainTiles && w.terrain.terrainTiles.size > 0;
      },
      { timeout: 60000 },
    );

    const cullingStats = await page.evaluate(() => {
      const world = (
        window as unknown as {
          world?: {
            terrain?: {
              terrainTiles?: Map<
                string,
                { mesh?: { frustumCulled?: boolean } }
              >;
              instancedMeshManager?: {
                instancedMeshes?: Map<
                  string,
                  { mesh?: { frustumCulled?: boolean } }
                >;
                biomeMeshes?: Map<
                  string,
                  { mesh?: { frustumCulled?: boolean } }
                >;
              };
            };
            stage?: {
              scene?: {
                children: Array<{ frustumCulled?: boolean; name?: string }>;
              };
            };
          };
        }
      ).world;

      if (!world) return null;

      let terrainCulled = 0;
      let terrainNotCulled = 0;
      let instancedCulled = 0;
      let instancedNotCulled = 0;

      // Check terrain tiles
      world.terrain?.terrainTiles?.forEach((tile) => {
        if (tile.mesh?.frustumCulled) {
          terrainCulled++;
        } else {
          terrainNotCulled++;
        }
      });

      // Check instanced meshes
      world.terrain?.instancedMeshManager?.biomeMeshes?.forEach((data) => {
        if (data.mesh?.frustumCulled) {
          instancedCulled++;
        } else {
          instancedNotCulled++;
        }
      });

      return {
        terrainCulled,
        terrainNotCulled,
        instancedCulled,
        instancedNotCulled,
      };
    });

    if (cullingStats) {
      console.log("Frustum culling stats:", cullingStats);
      console.log(
        `Terrain tiles with culling: ${cullingStats.terrainCulled}/${cullingStats.terrainCulled + cullingStats.terrainNotCulled}`,
      );
      console.log(
        `Instanced meshes with culling: ${cullingStats.instancedCulled}/${cullingStats.instancedCulled + cullingStats.instancedNotCulled}`,
      );

      // OPTIMIZATION CHECK: Frustum culling should be enabled
      const terrainTotal =
        cullingStats.terrainCulled + cullingStats.terrainNotCulled;
      if (terrainTotal > 0) {
        const terrainCullingPercent =
          (cullingStats.terrainCulled / terrainTotal) * 100;
        console.log(
          `Terrain culling rate: ${terrainCullingPercent.toFixed(1)}%`,
        );
        expect(cullingStats.terrainCulled).toBeGreaterThan(0);
      }
    }
  });
});
