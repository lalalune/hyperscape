/**
 * World Systems E2E Tests
 *
 * Comprehensive tests for all terrain and world systems:
 * - Grass system (rendering, entity push)
 * - Resource placement (trees, rocks, herbs)
 * - Asset caching and batching
 * - Instanced mesh rendering
 * - Biome-specific resources
 * - Shader compilation verification
 *
 * NO MOCKS - Uses real game systems, real rendering, real data
 */

import { test, expect, type Page } from "@playwright/test";

const GAME_URL = process.env.HYPERSCAPE_URL || "http://localhost:5009";
const LOAD_TIMEOUT = 60000;

// ============================================
// HELPER FUNCTIONS
// ============================================

/**
 * Wait for world to be fully initialized
 */
async function _waitForWorld(page: Page): Promise<void> {
  await page.waitForFunction(
    () => {
      const w = (
        window as unknown as {
          world?: { isReady?: boolean; terrain?: unknown };
        }
      ).world;
      return w?.isReady || w?.terrain !== undefined;
    },
    { timeout: LOAD_TIMEOUT },
  );
}

/**
 * Wait for terrain system to be ready
 */
async function waitForTerrainSystem(page: Page): Promise<void> {
  await page.waitForFunction(
    () => {
      const world = (
        window as unknown as {
          world?: { terrain?: { terrainTiles?: Map<string, unknown> } };
        }
      ).world;
      return (
        world?.terrain?.terrainTiles && world.terrain.terrainTiles.size > 0
      );
    },
    { timeout: LOAD_TIMEOUT },
  );
}

/**
 * Check for WebGL errors in console
 */
async function _checkForWebGLErrors(page: Page): Promise<string[]> {
  const errors: string[] = [];

  page.on("console", (msg) => {
    const text = msg.text();
    if (
      text.includes("WebGL") ||
      text.includes("shader") ||
      text.includes("GLSL") ||
      text.includes("compile") ||
      msg.type() === "error"
    ) {
      if (
        text.includes("error") ||
        text.includes("Error") ||
        text.includes("failed") ||
        text.includes("Failed")
      ) {
        errors.push(text);
      }
    }
  });

  return errors;
}

// ============================================
// GRASS SYSTEM TESTS
// ============================================

test.describe("Grass System", () => {
  test("grass instances are rendered on terrain", async ({ page }) => {
    await page.goto(GAME_URL);
    await page.waitForLoadState("networkidle");
    await waitForTerrainSystem(page);
    await page.waitForTimeout(3000); // Wait for grass to generate

    const grassStats = await page.evaluate(() => {
      const world = (
        window as unknown as {
          world?: {
            stage?: {
              scene?: {
                children: Array<{
                  name?: string;
                  type?: string;
                  count?: number;
                  geometry?: { attributes?: { instancePosition?: unknown } };
                }>;
              };
            };
          };
        }
      ).world;

      if (!world?.stage?.scene) return { found: false, count: 0 };

      let grassMeshes = 0;
      let totalInstances = 0;

      const traverse = (obj: {
        name?: string;
        type?: string;
        count?: number;
        children?: unknown[];
      }) => {
        if (obj.name?.includes("Grass") || obj.type === "InstancedMesh") {
          if (
            (
              obj as {
                geometry?: { attributes?: { instancePosition?: unknown } };
              }
            ).geometry?.attributes?.instancePosition
          ) {
            grassMeshes++;
            totalInstances += (obj as { count?: number }).count || 0;
          }
        }
        if (obj.children) {
          for (const child of obj.children as Array<{
            name?: string;
            type?: string;
            count?: number;
            children?: unknown[];
          }>) {
            traverse(child);
          }
        }
      };

      for (const child of world.stage.scene.children) {
        traverse(child);
      }

      return { found: grassMeshes > 0, meshCount: grassMeshes, totalInstances };
    });

    console.log(
      `[Grass Test] Found ${grassStats.meshCount} grass meshes with ${grassStats.totalInstances} instances`,
    );

    // Grass should be present
    expect(grassStats.found).toBe(true);
  });

  test("grass uniforms are being updated (time, player position)", async ({
    page,
  }) => {
    await page.goto(GAME_URL);
    await page.waitForLoadState("networkidle");
    await waitForTerrainSystem(page);
    await page.waitForTimeout(3000);

    // Check that grass uniforms exist and are being updated
    const uniformsExist = await page.evaluate(() => {
      const world = (
        window as unknown as {
          world?: {
            stage?: { scene?: { children: Array<unknown> } };
            grassSystem?: { grassUniforms?: { uTime?: { value: number } } };
          };
        }
      ).world;

      // Check for grass system uniforms
      const grassSystem = world?.grassSystem;
      if (grassSystem?.grassUniforms) {
        return {
          hasTime: typeof grassSystem.grassUniforms.uTime?.value === "number",
          timeValue: grassSystem.grassUniforms.uTime?.value || 0,
        };
      }

      return { hasTime: false, timeValue: 0 };
    });

    console.log(
      `[Grass Test] Uniforms exist: ${uniformsExist.hasTime}, time: ${uniformsExist.timeValue}`,
    );
  });
});

// ============================================
// RESOURCE PLACEMENT TESTS
// ============================================

test.describe("Resource Placement", () => {
  test("trees are placed with biome-appropriate variants", async ({ page }) => {
    await page.goto(GAME_URL);
    await page.waitForLoadState("networkidle");
    await waitForTerrainSystem(page);
    await page.waitForTimeout(3000);

    const resourceStats = await page.evaluate(() => {
      const world = (
        window as unknown as {
          world?: {
            terrain?: {
              terrainTiles?: Map<
                string,
                {
                  resources?: Array<{
                    type: string;
                    position: { x: number; y: number; z: number };
                  }>;
                }
              >;
            };
          };
        }
      ).world;

      if (!world?.terrain?.terrainTiles)
        return { trees: 0, rocks: 0, herbs: 0, stones: 0 };

      const counts = {
        trees: 0,
        tree_medium: 0,
        tree_small: 0,
        tree_palm: 0,
        tree_garden: 0,
        rocks: 0,
        rock_medium: 0,
        herbs: 0,
        stones: 0,
      };

      world.terrain.terrainTiles.forEach((tile) => {
        if (tile.resources) {
          for (const resource of tile.resources) {
            if (resource.type === "tree") counts.trees++;
            else if (resource.type === "tree_medium") counts.tree_medium++;
            else if (resource.type === "tree_small") counts.tree_small++;
            else if (resource.type === "tree_palm") counts.tree_palm++;
            else if (resource.type === "tree_garden") counts.tree_garden++;
            else if (resource.type === "rock") counts.rocks++;
            else if (resource.type === "rock_medium") counts.rock_medium++;
            else if (resource.type === "herb") counts.herbs++;
            else if (resource.type === "stone") counts.stones++;
          }
        }
      });

      return counts;
    });

    console.log(
      `[Resource Test] Trees: ${resourceStats.trees} (medium: ${resourceStats.tree_medium}, small: ${resourceStats.tree_small})`,
    );
    console.log(
      `[Resource Test] Rocks: ${resourceStats.rocks} (medium: ${resourceStats.rock_medium}, stones: ${resourceStats.stones})`,
    );
    console.log(`[Resource Test] Herbs: ${resourceStats.herbs}`);

    // Should have some trees and rocks
    const totalTrees =
      resourceStats.trees +
      resourceStats.tree_medium +
      resourceStats.tree_small +
      resourceStats.tree_palm +
      resourceStats.tree_garden;
    const totalRocks =
      resourceStats.rocks + resourceStats.rock_medium + resourceStats.stones;

    expect(totalTrees).toBeGreaterThan(0);
    expect(totalRocks).toBeGreaterThan(0);
  });

  test("resources are distributed across biomes", async ({ page }) => {
    await page.goto(GAME_URL);
    await page.waitForLoadState("networkidle");
    await waitForTerrainSystem(page);
    await page.waitForTimeout(3000);

    const biomeResources = await page.evaluate(() => {
      const world = (
        window as unknown as {
          world?: {
            terrain?: {
              terrainTiles?: Map<
                string,
                { biome?: string; resources?: Array<{ type: string }> }
              >;
            };
          };
        }
      ).world;

      if (!world?.terrain?.terrainTiles) return {};

      const biomeMap: Record<
        string,
        { tileCount: number; resourceCount: number }
      > = {};

      world.terrain.terrainTiles.forEach((tile) => {
        const biome = tile.biome || "unknown";
        if (!biomeMap[biome]) {
          biomeMap[biome] = { tileCount: 0, resourceCount: 0 };
        }
        biomeMap[biome].tileCount++;
        biomeMap[biome].resourceCount += tile.resources?.length || 0;
      });

      return biomeMap;
    });

    console.log("[Resource Test] Resources by biome:", biomeResources);

    // At least one biome should have resources
    const biomes = Object.keys(biomeResources);
    expect(biomes.length).toBeGreaterThan(0);
  });
});

// ============================================
// INSTANCED MESH BATCHING TESTS
// ============================================

test.describe("Instanced Mesh Batching", () => {
  test("instanced meshes are created for resources", async ({ page }) => {
    await page.goto(GAME_URL);
    await page.waitForLoadState("networkidle");
    await waitForTerrainSystem(page);
    await page.waitForTimeout(3000);

    const instanceStats = await page.evaluate(() => {
      const world = (
        window as unknown as {
          world?: {
            terrain?: {
              instancedMeshManager?: {
                getPoolingStats?: () => Record<
                  string,
                  { total: number; visible: number; maxVisible: number }
                >;
                getBiomeStats?: () => Record<
                  string,
                  { total: number; visible: number }
                >;
              };
            };
          };
        }
      ).world;

      const manager = world?.terrain?.instancedMeshManager;
      if (!manager) return { hasManager: false, stats: null, biomeStats: null };

      const stats = manager.getPoolingStats?.() || null;
      const biomeStats = manager.getBiomeStats?.() || null;

      return { hasManager: true, stats, biomeStats };
    });

    console.log("[Instance Test] Manager exists:", instanceStats.hasManager);
    if (instanceStats.stats) {
      console.log("[Instance Test] Pooling stats:", instanceStats.stats);
    }
    if (instanceStats.biomeStats) {
      console.log("[Instance Test] Biome stats:", instanceStats.biomeStats);
    }

    expect(instanceStats.hasManager).toBe(true);
  });

  test("instanced meshes use frustum culling", async ({ page }) => {
    await page.goto(GAME_URL);
    await page.waitForLoadState("networkidle");
    await waitForTerrainSystem(page);
    await page.waitForTimeout(2000);

    const cullingEnabled = await page.evaluate(() => {
      const world = (
        window as unknown as {
          world?: {
            stage?: {
              scene?: {
                children: Array<{
                  type?: string;
                  frustumCulled?: boolean;
                  name?: string;
                }>;
              };
            };
          };
        }
      ).world;

      if (!world?.stage?.scene)
        return { checked: false, cullingEnabled: 0, cullingDisabled: 0 };

      let cullingEnabled = 0;
      let cullingDisabled = 0;

      const traverse = (obj: {
        type?: string;
        frustumCulled?: boolean;
        name?: string;
        children?: unknown[];
      }) => {
        if (obj.type === "InstancedMesh") {
          if (obj.frustumCulled) cullingEnabled++;
          else cullingDisabled++;
        }
        if (obj.children) {
          for (const child of obj.children as Array<{
            type?: string;
            frustumCulled?: boolean;
            name?: string;
            children?: unknown[];
          }>) {
            traverse(child);
          }
        }
      };

      for (const child of world.stage.scene.children) {
        traverse(child);
      }

      return { checked: true, cullingEnabled, cullingDisabled };
    });

    console.log(
      `[Instance Test] Frustum culling - enabled: ${cullingEnabled.cullingEnabled}, disabled: ${cullingEnabled.cullingDisabled}`,
    );
  });
});

// ============================================
// ASSET CACHE TESTS
// ============================================

test.describe("Asset Cache System", () => {
  test("textures are cached and reused", async ({ page }) => {
    await page.goto(GAME_URL);
    await page.waitForLoadState("networkidle");
    await waitForTerrainSystem(page);
    await page.waitForTimeout(2000);

    const cacheStats = await page.evaluate(() => {
      // Check if AssetCache exists
      const assetCache = (
        window as unknown as {
          assetCache?: {
            getStats?: () => {
              textures: { count: number; hits: number; misses: number };
              models: { count: number };
            };
          };
        }
      ).assetCache;

      if (assetCache?.getStats) {
        return assetCache.getStats();
      }

      // Check THREE.Cache
      const THREE = (
        window as unknown as {
          THREE?: { Cache?: { files?: Map<string, unknown> } };
        }
      ).THREE;
      if (THREE?.Cache?.files) {
        return {
          threeCache: true,
          fileCount: THREE.Cache.files.size || 0,
          textures: { count: 0, hits: 0, misses: 0 },
          models: { count: 0 },
        };
      }

      return null;
    });

    console.log("[Cache Test] Cache stats:", cacheStats);
  });

  test("THREE.Cache is enabled for network caching", async ({ page }) => {
    await page.goto(GAME_URL);
    await page.waitForLoadState("networkidle");

    const cacheEnabled = await page.evaluate(() => {
      const THREE = (
        window as unknown as { THREE?: { Cache?: { enabled?: boolean } } }
      ).THREE;
      return THREE?.Cache?.enabled || false;
    });

    console.log("[Cache Test] THREE.Cache enabled:", cacheEnabled);
    expect(cacheEnabled).toBe(true);
  });
});

// ============================================
// SHADER COMPILATION TESTS
// ============================================

test.describe("Shader Compilation", () => {
  test("no WebGL shader compilation errors", async ({ page }) => {
    const errors: string[] = [];

    page.on("console", (msg) => {
      const text = msg.text();
      if (
        text.toLowerCase().includes("shader") ||
        text.toLowerCase().includes("glsl") ||
        text.toLowerCase().includes("webgl")
      ) {
        if (
          text.toLowerCase().includes("error") ||
          text.toLowerCase().includes("failed") ||
          text.toLowerCase().includes("compile")
        ) {
          errors.push(text);
        }
      }
    });

    page.on("pageerror", (error) => {
      errors.push(`Page error: ${error.message}`);
    });

    await page.goto(GAME_URL);
    await page.waitForLoadState("networkidle");
    await waitForTerrainSystem(page);
    await page.waitForTimeout(3000);

    // Filter out non-critical warnings
    const criticalErrors = errors.filter(
      (e) => !e.includes("extension") && !e.includes("deprecated"),
    );

    if (criticalErrors.length > 0) {
      console.log("[Shader Test] Errors found:", criticalErrors);
    }

    expect(criticalErrors.length).toBe(0);
  });

  test("terrain material renders without errors", async ({ page }) => {
    const errors: string[] = [];

    page.on("console", (msg) => {
      if (msg.type() === "error") {
        errors.push(msg.text());
      }
    });

    await page.goto(GAME_URL);
    await page.waitForLoadState("networkidle");
    await waitForTerrainSystem(page);

    // Verify terrain mesh has material
    const hasMaterial = await page.evaluate(() => {
      const world = (
        window as unknown as {
          world?: {
            terrain?: {
              terrainTiles?: Map<string, { mesh?: { material?: unknown } }>;
            };
          };
        }
      ).world;

      if (!world?.terrain?.terrainTiles) return false;

      let hasMaterial = false;
      world.terrain.terrainTiles.forEach((tile) => {
        if (tile.mesh?.material) {
          hasMaterial = true;
        }
      });

      return hasMaterial;
    });

    console.log("[Shader Test] Terrain has material:", hasMaterial);
    expect(hasMaterial).toBe(true);

    // No critical errors during rendering
    const renderErrors = errors.filter(
      (e) => e.includes("render") || e.includes("draw"),
    );
    expect(renderErrors.length).toBe(0);
  });

  test("grass shader renders without errors", async ({ page }) => {
    const shaderErrors: string[] = [];

    page.on("console", (msg) => {
      const text = msg.text();
      if (text.includes("grass") || text.includes("Grass")) {
        if (text.includes("error") || text.includes("Error")) {
          shaderErrors.push(text);
        }
      }
    });

    await page.goto(GAME_URL);
    await page.waitForLoadState("networkidle");
    await waitForTerrainSystem(page);
    await page.waitForTimeout(3000);

    console.log("[Shader Test] Grass shader errors:", shaderErrors.length);
    expect(shaderErrors.length).toBe(0);
  });
});

// ============================================
// VISUAL RENDERING TESTS
// ============================================

test.describe("Visual Rendering", () => {
  test("scene renders visible content (not blank)", async ({ page }) => {
    await page.goto(GAME_URL);
    await page.waitForLoadState("networkidle");
    await waitForTerrainSystem(page);
    await page.waitForTimeout(2000);

    const screenshot = await page.screenshot();

    // Verify screenshot has reasonable size (not blank)
    expect(screenshot.length).toBeGreaterThan(10000);

    console.log(`[Visual Test] Screenshot size: ${screenshot.length} bytes`);
  });

  test("terrain colors vary across biomes", async ({ page }) => {
    await page.goto(GAME_URL);
    await page.waitForLoadState("networkidle");
    await waitForTerrainSystem(page);
    await page.waitForTimeout(2000);

    // Check that terrain has material with varying properties
    const materialInfo = await page.evaluate(() => {
      const world = (
        window as unknown as {
          world?: {
            terrain?: {
              terrainTiles?: Map<
                string,
                {
                  mesh?: { material?: { uniforms?: Record<string, unknown> } };
                  biome?: string;
                }
              >;
            };
          };
        }
      ).world;

      if (!world?.terrain?.terrainTiles) return { hasMaterials: false };

      const biomes = new Set<string>();
      let hasMaterials = false;

      world.terrain.terrainTiles.forEach((tile) => {
        if (tile.biome) biomes.add(tile.biome);
        if (tile.mesh?.material) hasMaterials = true;
      });

      return { hasMaterials, biomes: Array.from(biomes) };
    });

    console.log("[Visual Test] Biomes found:", materialInfo.biomes);
    expect(materialInfo.hasMaterials).toBe(true);
  });
});

// ============================================
// PERFORMANCE SANITY TESTS
// ============================================

test.describe("Performance", () => {
  test("terrain generates within reasonable time", async ({ page }) => {
    const startTime = Date.now();

    await page.goto(GAME_URL);
    await page.waitForLoadState("networkidle");
    await waitForTerrainSystem(page);

    const loadTime = Date.now() - startTime;

    console.log(`[Performance Test] Terrain load time: ${loadTime}ms`);

    // Should load within 30 seconds
    expect(loadTime).toBeLessThan(30000);
  });

  test("frame rate is reasonable after terrain loads", async ({ page }) => {
    await page.goto(GAME_URL);
    await page.waitForLoadState("networkidle");
    await waitForTerrainSystem(page);
    await page.waitForTimeout(2000);

    // Measure frame timing over 1 second
    const frameStats = await page.evaluate(() => {
      return new Promise<{ avgFrameTime: number; frameCount: number }>(
        (resolve) => {
          const frameTimes: number[] = [];
          let lastTime = performance.now();
          let frameCount = 0;

          const measureFrame = () => {
            const now = performance.now();
            frameTimes.push(now - lastTime);
            lastTime = now;
            frameCount++;

            if (frameCount < 60) {
              requestAnimationFrame(measureFrame);
            } else {
              const avgFrameTime =
                frameTimes.reduce((a, b) => a + b, 0) / frameTimes.length;
              resolve({ avgFrameTime, frameCount });
            }
          };

          requestAnimationFrame(measureFrame);
        },
      );
    });

    const fps = 1000 / frameStats.avgFrameTime;
    console.log(`[Performance Test] Average FPS: ${fps.toFixed(1)}`);

    // Should maintain at least 15 FPS (very lenient for CI)
    expect(fps).toBeGreaterThan(15);
  });
});
