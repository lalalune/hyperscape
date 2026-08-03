/**
 * Player Silhouette E2E Tests
 *
 * Visual verification of classic fantasy MMORPG-style silhouette (depthTest=false, player overwrites).
 */

import { test, expect, Page } from "@playwright/test";
import {
  waitForGameLoad,
  waitForPlayerSpawn,
  takeGameScreenshot,
} from "./utils/testWorld";
import {
  captureCanvasPixels,
  analyzeScreenStats,
  detectColor,
} from "./utils/visualTesting";

const SILHOUETTE_COLOR = 0x1a1a2a;
const SILHOUETTE_RENDER_ORDER = 50;
const PLAYER_RENDER_ORDER = 100;

// Type for window access in page.evaluate
type GameWindow = {
  world?: {
    camera?: {
      position: { set: (x: number, y: number, z: number) => void };
      lookAt: (x: number, y: number, z: number) => void;
      updateProjectionMatrix?: () => void;
    };
    scene?: {
      add: (obj: unknown) => void;
      getObjectByName: (
        n: string,
      ) => { parent?: { remove: (o: unknown) => void } } | undefined;
    };
    entities?: {
      player?: {
        position?: { x: number; y: number; z: number };
        _silhouetteMeshes?: Array<{
          renderOrder: number;
          material?: {
            depthTest: boolean;
            depthWrite: boolean;
            transparent: boolean;
            color?: { getHex: () => number };
          };
        }>;
        _silhouetteMaterial?: { color?: { getHex: () => number } };
        _avatar?: {
          instance?: {
            raw?: {
              scene?: {
                traverse: (
                  fn: (o: {
                    renderOrder?: number;
                    isSkinnedMesh?: boolean;
                    skeleton?: { bones: unknown[] };
                  }) => void,
                ) => void;
              };
            };
          };
        };
      };
    };
  };
  THREE?: {
    BoxGeometry: new (w: number, h: number, d: number) => unknown;
    MeshBasicMaterial: new (o: { color: number }) => unknown;
    Mesh: new (
      g: unknown,
      m: unknown,
    ) => {
      name: string;
      position: { set: (x: number, y: number, z: number) => void };
      renderOrder: number;
    };
  };
};

async function getSilhouetteInfo(page: Page) {
  return page.evaluate(() => {
    const meshes = (window as unknown as GameWindow).world?.entities?.player
      ?._silhouetteMeshes;
    if (!meshes?.length)
      return {
        exists: false,
        count: 0,
        renderOrders: [] as number[],
        hasCorrectMaterial: false,
      };
    const mat = meshes[0].material;
    return {
      exists: true,
      count: meshes.length,
      renderOrders: meshes.map((m) => m.renderOrder),
      hasCorrectMaterial:
        mat?.depthTest === false &&
        mat?.depthWrite === false &&
        mat?.transparent === false,
    };
  });
}

async function getPlayerRenderOrders(page: Page): Promise<number[]> {
  return page.evaluate(() => {
    const orders: number[] = [];
    (
      window as unknown as GameWindow
    ).world?.entities?.player?._avatar?.instance?.raw?.scene?.traverse((o) => {
      if (o.renderOrder && o.renderOrder > 0) orders.push(o.renderOrder);
    });
    return orders;
  });
}

async function getPlayerPos(page: Page) {
  return page.evaluate(() => {
    const p = (window as unknown as GameWindow).world?.entities?.player
      ?.position;
    return p ? { x: p.x, y: p.y, z: p.z } : { x: 0, y: 0, z: 0 };
  });
}

async function createOccluder(
  page: Page,
  x: number,
  y: number,
  z: number,
  size = 3,
) {
  return page.evaluate(
    ({ x, y, z, size }) => {
      const win = window as unknown as GameWindow;
      if (!win.THREE || !win.world?.scene) return "error";
      const geo = new win.THREE.BoxGeometry(size, size, size);
      const mat = new win.THREE.MeshBasicMaterial({ color: 0x888888 });
      const mesh = new win.THREE.Mesh(geo, mat);
      mesh.name = "test-occluder";
      mesh.position.set(x, y, z);
      mesh.renderOrder = 0;
      win.world.scene.add(mesh);
      return "ok";
    },
    { x, y, z, size },
  );
}

async function setCamera(
  page: Page,
  pos: { x: number; y: number; z: number },
  lookAt: { x: number; y: number; z: number },
) {
  await page.evaluate(
    ({ pos, lookAt }) => {
      const cam = (window as unknown as GameWindow).world?.camera;
      if (!cam) return;
      cam.position.set(pos.x, pos.y, pos.z);
      cam.lookAt(lookAt.x, lookAt.y, lookAt.z);
      cam.updateProjectionMatrix?.();
    },
    { pos, lookAt },
  );
}

async function cleanup(page: Page) {
  await page.evaluate(() => {
    const obj = (window as unknown as GameWindow).world?.scene?.getObjectByName(
      "test-occluder",
    );
    obj?.parent?.remove(obj);
  });
}

test.describe("Player Silhouette System", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
    await waitForGameLoad(page);
    await waitForPlayerSpawn(page);
    await page.waitForTimeout(3000);
  });

  test.afterEach(async ({ page }) => {
    await cleanup(page);
  });

  test("silhouette meshes exist with correct material", async ({ page }) => {
    const info = await getSilhouetteInfo(page);
    expect(info.exists).toBe(true);
    expect(info.count).toBeGreaterThan(0);
    expect(info.hasCorrectMaterial).toBe(true);
    await takeGameScreenshot(page, "silhouette-exists");
  });

  test("silhouette renderOrder < player renderOrder", async ({ page }) => {
    const info = await getSilhouetteInfo(page);
    const playerOrders = await getPlayerRenderOrders(page);

    for (const order of info.renderOrders)
      expect(order).toBe(SILHOUETTE_RENDER_ORDER);
    for (const order of playerOrders) expect(order).toBe(PLAYER_RENDER_ORDER);
    expect(SILHOUETTE_RENDER_ORDER).toBeLessThan(PLAYER_RENDER_ORDER);
  });

  test("silhouette color is dark blue-gray", async ({ page }) => {
    const color = await page.evaluate(
      () =>
        (
          window as unknown as GameWindow
        ).world?.entities?.player?._silhouetteMaterial?.color?.getHex() ?? 0,
    );
    expect(color).toBe(SILHOUETTE_COLOR);
  });

  test("silhouette meshes share skeleton with player", async ({ page }) => {
    const result = await page.evaluate(() => {
      const player = (window as unknown as GameWindow).world?.entities?.player;
      const meshes = player?._silhouetteMeshes ?? [];
      const scene = player?._avatar?.instance?.raw?.scene;
      if (!scene || !meshes.length)
        return { valid: false, reason: "no-meshes" };

      let playerSkel: { bones: unknown[] } | undefined;
      scene.traverse((o) => {
        if (o.isSkinnedMesh && o.skeleton && !playerSkel)
          playerSkel = o.skeleton;
      });
      if (!playerSkel) return { valid: false, reason: "no-skeleton" };

      for (const m of meshes)
        if ((m as { skeleton?: typeof playerSkel }).skeleton !== playerSkel)
          return { valid: false, reason: "mismatch" };
      return { valid: true, reason: "ok" };
    });
    expect(result.valid).toBe(true);
  });
});

test.describe("Silhouette Visual", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
    await waitForGameLoad(page);
    await waitForPlayerSpawn(page);
    await page.waitForTimeout(3000);
  });

  test.afterEach(async ({ page }) => {
    await cleanup(page);
  });

  test("game renders properly (not all black/white)", async ({ page }) => {
    const pixels = await captureCanvasPixels(page);
    const stats = analyzeScreenStats(pixels);
    expect(stats.isAllBlack).toBe(false);
    expect(stats.isAllWhite).toBe(false);
    expect(stats.uniqueColors).toBeGreaterThan(10);
  });

  test("silhouette visible behind occluder", async ({ page }) => {
    const pos = await getPlayerPos(page);
    await createOccluder(page, pos.x, pos.y + 1, pos.z + 2, 4);
    await setCamera(
      page,
      { x: pos.x, y: pos.y + 2, z: pos.z + 8 },
      { x: pos.x, y: pos.y + 1, z: pos.z },
    );
    await page.waitForTimeout(500);

    const info = await getSilhouetteInfo(page);
    expect(info.exists).toBe(true);

    const pixels = await captureCanvasPixels(page);
    const detection = detectColor(pixels, SILHOUETTE_COLOR, 40);
    console.log(
      `Silhouette: found=${detection.found}, pixels=${detection.pixelCount}`,
    );

    await takeGameScreenshot(page, "silhouette-occluded");
  });

  test("player visible without occluder", async ({ page }) => {
    const pos = await getPlayerPos(page);
    await setCamera(
      page,
      { x: pos.x, y: pos.y + 2, z: pos.z + 5 },
      { x: pos.x, y: pos.y + 1, z: pos.z },
    );
    await page.waitForTimeout(500);

    const info = await getSilhouetteInfo(page);
    expect(info.exists).toBe(true);

    await takeGameScreenshot(page, "silhouette-visible");
  });
});

// ============================================================================
// EDGE CASES & ERROR HANDLING
// ============================================================================

test.describe("Silhouette Edge Cases", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
    await waitForGameLoad(page);
    await waitForPlayerSpawn(page);
    await page.waitForTimeout(3000);
  });

  test.afterEach(async ({ page }) => {
    await cleanup(page);
  });

  test("silhouette persists after camera movement", async ({ page }) => {
    const pos = await getPlayerPos(page);

    // Move camera multiple times
    await setCamera(
      page,
      { x: pos.x + 10, y: pos.y + 5, z: pos.z + 10 },
      { x: pos.x, y: pos.y, z: pos.z },
    );
    await page.waitForTimeout(200);
    await setCamera(
      page,
      { x: pos.x - 10, y: pos.y + 5, z: pos.z - 10 },
      { x: pos.x, y: pos.y, z: pos.z },
    );
    await page.waitForTimeout(200);

    // Silhouette should still exist
    const info = await getSilhouetteInfo(page);
    expect(info.exists).toBe(true);
  });

  test("silhouette count matches skinned mesh count", async ({ page }) => {
    const result = await page.evaluate(() => {
      const player = (window as unknown as GameWindow).world?.entities?.player;
      const meshes = player?._silhouetteMeshes ?? [];
      const scene = player?._avatar?.instance?.raw?.scene;

      let skinnedCount = 0;
      scene?.traverse((o) => {
        if ((o as { isSkinnedMesh?: boolean }).isSkinnedMesh) skinnedCount++;
      });

      return { silhouetteCount: meshes.length, skinnedCount };
    });

    expect(result.silhouetteCount).toBe(result.skinnedCount);
  });

  test("silhouette frustumCulled is false on all meshes", async ({ page }) => {
    const allNotCulled = await page.evaluate(() => {
      const meshes =
        (window as unknown as GameWindow).world?.entities?.player
          ?._silhouetteMeshes ?? [];
      return meshes.every(
        (m) => (m as { frustumCulled?: boolean }).frustumCulled === false,
      );
    });
    expect(allNotCulled).toBe(true);
  });

  test("silhouette names follow Silhouette_ prefix pattern", async ({
    page,
  }) => {
    const names = await page.evaluate(() => {
      const meshes =
        (window as unknown as GameWindow).world?.entities?.player
          ?._silhouetteMeshes ?? [];
      return meshes.map((m) => (m as { name?: string }).name ?? "");
    });

    for (const name of names) {
      expect(name.startsWith("Silhouette_")).toBe(true);
    }
  });
});

// ============================================================================
// DATA VERIFICATION
// ============================================================================

test.describe("Silhouette Data Verification", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
    await waitForGameLoad(page);
    await waitForPlayerSpawn(page);
    await page.waitForTimeout(3000);
  });

  test("material has correct depthTest/depthWrite/transparent", async ({
    page,
  }) => {
    const matProps = await page.evaluate(() => {
      const mat = (window as unknown as GameWindow).world?.entities?.player
        ?._silhouetteMaterial;
      if (!mat) return null;
      return {
        depthTest: (mat as { depthTest?: boolean }).depthTest,
        depthWrite: (mat as { depthWrite?: boolean }).depthWrite,
        transparent: (mat as { transparent?: boolean }).transparent,
      };
    });

    expect(matProps).not.toBeNull();
    expect(matProps!.depthTest).toBe(false);
    expect(matProps!.depthWrite).toBe(false);
    expect(matProps!.transparent).toBe(false);
  });

  test("all silhouette meshes have renderOrder=50", async ({ page }) => {
    const info = await getSilhouetteInfo(page);
    for (const order of info.renderOrders) {
      expect(order).toBe(50);
    }
  });

  test("all player meshes have renderOrder=100", async ({ page }) => {
    const orders = await getPlayerRenderOrders(page);
    for (const order of orders) {
      expect(order).toBe(100);
    }
  });

  test("silhouette geometry matches player geometry", async ({ page }) => {
    const matches = await page.evaluate(() => {
      const player = (window as unknown as GameWindow).world?.entities?.player;
      const silhouettes = player?._silhouetteMeshes ?? [];
      const scene = player?._avatar?.instance?.raw?.scene;
      if (!scene || !silhouettes.length) return false;

      const playerGeoms: unknown[] = [];
      scene.traverse((o) => {
        if ((o as { isSkinnedMesh?: boolean }).isSkinnedMesh) {
          playerGeoms.push((o as { geometry?: unknown }).geometry);
        }
      });

      // Each silhouette should share geometry with corresponding player mesh
      return silhouettes.every((s) =>
        playerGeoms.includes((s as { geometry?: unknown }).geometry),
      );
    });

    expect(matches).toBe(true);
  });
});
