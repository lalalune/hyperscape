/**
 * Visual Testing Utilities for Hyperscape E2E Tests
 *
 * Per project rules: Tests use real Hyperscape instances with colored cube proxies
 * for visual verification. Each entity type has a specific color:
 * - Red (0xFF0000): Players
 * - Green (0x00FF00): Goblins/Mobs
 * - Blue (0x0000FF): Items
 * - Yellow (0xFFFF00): Trees/Resources
 * - Purple (0x800080): Banks/NPCs
 *
 * @packageDocumentation
 */

import type { Page } from "@playwright/test";

/**
 * Color constants for cube proxies (matching project testing rules)
 */
export const PROXY_COLORS = {
  PLAYER: 0xff0000, // Red
  MOB: 0x00ff00, // Green
  ITEM: 0x0000ff, // Blue
  RESOURCE: 0xffff00, // Yellow
  NPC: 0x800080, // Purple
  CORPSE: 0x8b0000, // Dark red
} as const;

/**
 * Color names for debugging output
 */
export const COLOR_NAMES: Record<number, string> = {
  [PROXY_COLORS.PLAYER]: "Player (Red)",
  [PROXY_COLORS.MOB]: "Mob (Green)",
  [PROXY_COLORS.ITEM]: "Item (Blue)",
  [PROXY_COLORS.RESOURCE]: "Resource (Yellow)",
  [PROXY_COLORS.NPC]: "NPC (Purple)",
  [PROXY_COLORS.CORPSE]: "Corpse (Dark Red)",
};

/**
 * Pixel color information extracted from screenshot
 */
interface PixelInfo {
  r: number;
  g: number;
  b: number;
  a: number;
}

/**
 * Position of a colored entity on screen
 */
interface ScreenPosition {
  x: number;
  y: number;
}

/**
 * Results from color detection analysis
 */
interface ColorDetectionResult {
  found: boolean;
  pixelCount: number;
  positions: ScreenPosition[];
  averagePosition: ScreenPosition | null;
  boundingBox: {
    minX: number;
    minY: number;
    maxX: number;
    maxY: number;
  } | null;
}

/**
 * Screen statistics for basic validation
 */
interface ScreenStats {
  dominantColor: { r: number; g: number; b: number };
  dominantColorPercentage: number;
  isAllOneColor: boolean;
  isAllBlack: boolean;
  isAllWhite: boolean;
  uniqueColors: number;
}

/**
 * Sets up an overhead camera rig for visual testing
 * This provides a consistent top-down view for pixel comparison
 */
export async function setupOverheadCamera(
  page: Page,
  height: number = 50,
): Promise<void> {
  await page.evaluate((h) => {
    const win = window as unknown as {
      world?: {
        camera?: {
          position: { set: (x: number, y: number, z: number) => void };
          lookAt: (x: number, y: number, z: number) => void;
          updateProjectionMatrix?: () => void;
        };
        entities?: {
          player?: {
            position?: { x: number; z: number };
          };
        };
      };
    };

    const world = win.world;
    if (!world?.camera) return;

    const playerPos = world.entities?.player?.position;
    const x = playerPos?.x ?? 0;
    const z = playerPos?.z ?? 0;

    // Position camera directly above, looking down
    world.camera.position.set(x, h, z);
    world.camera.lookAt(x, 0, z);
    world.camera.updateProjectionMatrix?.();
  }, height);
}

/**
 * Registers a colored cube proxy for an entity in the world
 * Used for visual testing to represent entities with known colors
 */
export async function registerCubeProxy(
  page: Page,
  entityId: string,
  color: number,
  size: number = 1,
): Promise<void> {
  await page.evaluate(
    ({ id, col, s }) => {
      const win = window as unknown as {
        THREE?: {
          BoxGeometry: new (w: number, h: number, d: number) => unknown;
          MeshBasicMaterial: new (opts: { color: number }) => unknown;
          Mesh: new (
            geo: unknown,
            mat: unknown,
          ) => {
            name: string;
            userData: Record<string, unknown>;
          };
        };
        world?: {
          scene?: {
            add: (obj: unknown) => void;
          };
          getEntityById?: (id: string) => {
            mesh?: { position: { x: number; y: number; z: number } };
          } | null;
        };
      };

      const THREE = win.THREE;
      const world = win.world;
      if (!THREE || !world?.scene) return;

      const entity = world.getEntityById?.(id);
      if (!entity?.mesh) return;

      const geometry = new THREE.BoxGeometry(s, s, s);
      const material = new THREE.MeshBasicMaterial({ color: col });
      const cube = new THREE.Mesh(geometry, material);

      cube.name = `test-proxy-${id}`;
      cube.userData.isTestProxy = true;
      cube.userData.entityId = id;

      // Position at entity location
      const pos = entity.mesh.position;
      (cube as unknown as { position: typeof pos }).position = { ...pos };

      world.scene.add(cube);
    },
    { id: entityId, col: color, s: size },
  );
}

/**
 * Takes a screenshot of the game canvas and returns pixel data
 */
export async function captureCanvasPixels(
  page: Page,
): Promise<{ width: number; height: number; data: Uint8ClampedArray }> {
  const result = await page.evaluate(() => {
    const canvas = document.querySelector("canvas") as HTMLCanvasElement | null;
    if (!canvas) return null;

    const ctx = canvas.getContext("2d");
    if (!ctx) {
      // For WebGL canvas, we need to read from the GL context
      const gl = canvas.getContext("webgl2") || canvas.getContext("webgl");
      if (!gl) return null;

      const width = canvas.width;
      const height = canvas.height;
      const pixels = new Uint8Array(width * height * 4);
      gl.readPixels(0, 0, width, height, gl.RGBA, gl.UNSIGNED_BYTE, pixels);

      // WebGL pixels are bottom-to-top, flip them
      const flipped = new Uint8Array(width * height * 4);
      for (let y = 0; y < height; y++) {
        const srcRow = (height - y - 1) * width * 4;
        const dstRow = y * width * 4;
        for (let x = 0; x < width * 4; x++) {
          flipped[dstRow + x] = pixels[srcRow + x];
        }
      }

      return {
        width,
        height,
        data: Array.from(flipped),
      };
    }

    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    return {
      width: imageData.width,
      height: imageData.height,
      data: Array.from(imageData.data),
    };
  });

  if (!result) {
    throw new Error("Failed to capture canvas pixels");
  }

  return {
    width: result.width,
    height: result.height,
    data: new Uint8ClampedArray(result.data),
  };
}

/**
 * Detects pixels of a specific color in the captured image
 * Returns information about found pixels including positions and counts
 */
export function detectColor(
  pixels: { width: number; height: number; data: Uint8ClampedArray },
  targetColor: number,
  tolerance: number = 30,
): ColorDetectionResult {
  const { width, height, data } = pixels;

  const targetR = (targetColor >> 16) & 0xff;
  const targetG = (targetColor >> 8) & 0xff;
  const targetB = targetColor & 0xff;

  const positions: ScreenPosition[] = [];

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * 4;
      const r = data[i];
      const g = data[i + 1];
      const b = data[i + 2];

      // Check if color is within tolerance
      if (
        Math.abs(r - targetR) <= tolerance &&
        Math.abs(g - targetG) <= tolerance &&
        Math.abs(b - targetB) <= tolerance
      ) {
        positions.push({ x, y });
      }
    }
  }

  if (positions.length === 0) {
    return {
      found: false,
      pixelCount: 0,
      positions: [],
      averagePosition: null,
      boundingBox: null,
    };
  }

  // Calculate average position
  const avgX = positions.reduce((sum, p) => sum + p.x, 0) / positions.length;
  const avgY = positions.reduce((sum, p) => sum + p.y, 0) / positions.length;

  // Calculate bounding box
  const xs = positions.map((p) => p.x);
  const ys = positions.map((p) => p.y);

  return {
    found: true,
    pixelCount: positions.length,
    positions,
    averagePosition: { x: avgX, y: avgY },
    boundingBox: {
      minX: Math.min(...xs),
      minY: Math.min(...ys),
      maxX: Math.max(...xs),
      maxY: Math.max(...ys),
    },
  };
}

/**
 * Calculates the distance between two screen positions
 */
export function getScreenDistance(
  pos1: ScreenPosition,
  pos2: ScreenPosition,
): number {
  const dx = pos2.x - pos1.x;
  const dy = pos2.y - pos1.y;
  return Math.sqrt(dx * dx + dy * dy);
}

/**
 * Checks if two entities are adjacent (within a threshold distance)
 */
export function areAdjacent(
  pos1: ScreenPosition | null,
  pos2: ScreenPosition | null,
  threshold: number = 50,
): boolean {
  if (!pos1 || !pos2) return false;
  return getScreenDistance(pos1, pos2) <= threshold;
}

/**
 * Analyzes the screen for basic sanity checks
 * Detects all-black, all-white, or predominantly single-color screens
 */
export function analyzeScreenStats(pixels: {
  width: number;
  height: number;
  data: Uint8ClampedArray;
}): ScreenStats {
  const { width, height, data } = pixels;
  const totalPixels = width * height;

  const colorCounts = new Map<string, number>();
  let blackCount = 0;
  let whiteCount = 0;

  for (let i = 0; i < data.length; i += 4) {
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];

    const key = `${r},${g},${b}`;
    colorCounts.set(key, (colorCounts.get(key) || 0) + 1);

    if (r < 10 && g < 10 && b < 10) blackCount++;
    if (r > 245 && g > 245 && b > 245) whiteCount++;
  }

  // Find dominant color
  let maxCount = 0;
  let dominantKey = "0,0,0";
  for (const [key, count] of colorCounts) {
    if (count > maxCount) {
      maxCount = count;
      dominantKey = key;
    }
  }

  const [r, g, b] = dominantKey.split(",").map(Number);
  const dominantPercentage = (maxCount / totalPixels) * 100;

  return {
    dominantColor: { r, g, b },
    dominantColorPercentage: dominantPercentage,
    isAllOneColor: dominantPercentage > 95,
    isAllBlack: (blackCount / totalPixels) * 100 > 95,
    isAllWhite: (whiteCount / totalPixels) * 100 > 95,
    uniqueColors: colorCounts.size,
  };
}

/**
 * Verifies that the game rendered properly (not all black/white)
 */
export async function verifyGameRendered(page: Page): Promise<boolean> {
  const pixels = await captureCanvasPixels(page);
  const stats = analyzeScreenStats(pixels);

  if (stats.isAllBlack) {
    console.error(
      "[Visual Test] Screen is all black - game may not be rendering",
    );
    return false;
  }

  if (stats.isAllWhite) {
    console.error("[Visual Test] Screen is all white - something may be wrong");
    return false;
  }

  if (stats.isAllOneColor) {
    console.error(
      `[Visual Test] Screen is ${stats.dominantColorPercentage.toFixed(1)}% one color - suspicious`,
    );
    return false;
  }

  return true;
}

/**
 * Takes a named screenshot and saves it to the screenshots directory
 */
export async function saveTestScreenshot(
  page: Page,
  name: string,
): Promise<string> {
  const path = `screenshots/test-${name}-${Date.now()}.png`;
  const canvas = await page.$("canvas");
  if (canvas) {
    await canvas.screenshot({ path });
  } else {
    await page.screenshot({ path });
  }
  return path;
}

/**
 * Cleans up all test proxy cubes from the scene
 */
export async function cleanupTestProxies(page: Page): Promise<void> {
  await page.evaluate(() => {
    const win = window as unknown as {
      world?: {
        scene?: {
          children: Array<{
            userData?: { isTestProxy?: boolean };
            parent?: { remove: (obj: unknown) => void };
          }>;
        };
      };
    };

    const scene = win.world?.scene;
    if (!scene) return;

    const toRemove = scene.children.filter((c) => c.userData?.isTestProxy);
    toRemove.forEach((obj) => {
      obj.parent?.remove(obj);
    });
  });
}
