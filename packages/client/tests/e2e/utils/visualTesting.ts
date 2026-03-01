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
export interface PixelInfo {
  r: number;
  g: number;
  b: number;
  a: number;
}

/**
 * Position of a colored entity on screen
 */
export interface ScreenPosition {
  x: number;
  y: number;
}

/**
 * Get pixel information at a specific screen position
 * @param pixels - Captured pixel data from captureCanvasPixels
 * @param x - X coordinate
 * @param y - Y coordinate
 * @returns Pixel color information or null if out of bounds
 */
export function getPixelAt(
  pixels: { width: number; height: number; data: Uint8ClampedArray },
  x: number,
  y: number,
): PixelInfo | null {
  const { width, height, data } = pixels;

  // Round coordinates and check bounds
  const px = Math.floor(x);
  const py = Math.floor(y);

  if (px < 0 || px >= width || py < 0 || py >= height) {
    return null;
  }

  const i = (py * width + px) * 4;
  return {
    r: data[i],
    g: data[i + 1],
    b: data[i + 2],
    a: data[i + 3],
  };
}

/**
 * Check if a pixel matches a target color within tolerance
 */
export function pixelMatchesColor(
  pixel: PixelInfo,
  targetColor: number,
  tolerance: number = 30,
): boolean {
  const targetR = (targetColor >> 16) & 0xff;
  const targetG = (targetColor >> 8) & 0xff;
  const targetB = targetColor & 0xff;

  return (
    Math.abs(pixel.r - targetR) <= tolerance &&
    Math.abs(pixel.g - targetG) <= tolerance &&
    Math.abs(pixel.b - targetB) <= tolerance
  );
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
      // For WebGPU canvas, we use toDataURL and draw to a 2D canvas to read pixels
      // WebGPU doesn't support direct pixel reading like WebGL's readPixels
      const width = canvas.width;
      const height = canvas.height;

      // Create an offscreen canvas to draw the WebGPU canvas content
      const offscreen = document.createElement("canvas");
      offscreen.width = width;
      offscreen.height = height;
      const offCtx = offscreen.getContext("2d");
      if (!offCtx) return null;

      // Draw the WebGPU canvas to the 2D canvas
      offCtx.drawImage(canvas, 0, 0);
      const imageData = offCtx.getImageData(0, 0, width, height);

      return {
        width,
        height,
        data: Array.from(imageData.data),
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
  try {
    const pixels = await captureCanvasPixels(page);
    const stats = analyzeScreenStats(pixels);

    if (stats.isAllBlack) {
      console.error(
        "[Visual Test] Screen is all black - game may not be rendering",
      );
      return false;
    }

    if (stats.isAllWhite) {
      console.error(
        "[Visual Test] Screen is all white - something may be wrong",
      );
      return false;
    }

    if (stats.isAllOneColor) {
      console.error(
        `[Visual Test] Screen is ${stats.dominantColorPercentage.toFixed(1)}% one color - suspicious`,
      );
      return false;
    }

    return true;
  } catch {
    // Some renderers (including certain WebGPU contexts) disallow canvas readback.
    // Fallback: verify that canvas exists and frames are advancing.
    const framesAdvancing = await page.evaluate(async () => {
      const canvas = document.querySelector(
        "canvas",
      ) as HTMLCanvasElement | null;
      if (!canvas) return false;

      const win = window as unknown as {
        world?: { stage?: unknown; camera?: unknown };
      };
      if (!win.world?.stage || !win.world?.camera) return false;

      return await new Promise<boolean>((resolve) => {
        let frameCount = 0;
        const start = performance.now();
        const maxWaitMs = 1200;

        const tick = (now: number) => {
          frameCount += 1;
          if (frameCount >= 2) {
            resolve(true);
            return;
          }
          if (now - start >= maxWaitMs) {
            resolve(false);
            return;
          }
          requestAnimationFrame(tick);
        };

        requestAnimationFrame(tick);
      });
    });

    if (!framesAdvancing) {
      console.error(
        "[Visual Test] Canvas pixels unavailable and frame progression check failed",
      );
    }

    return framesAdvancing;
  }
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

// ============================================================================
// Visual Testing Assertions
// ============================================================================

/**
 * Visual test assertion results
 */
export interface VisualAssertionResult {
  passed: boolean;
  message: string;
  details?: Record<string, unknown>;
}

/**
 * Asserts that an entity with the given color is visible on screen
 */
export async function assertEntityVisible(
  page: Page,
  color: number,
  minPixelCount: number = 10,
): Promise<VisualAssertionResult> {
  const pixels = await captureCanvasPixels(page);
  const result = detectColor(pixels, color);

  if (!result.found || result.pixelCount < minPixelCount) {
    return {
      passed: false,
      message: `Entity with color ${color.toString(16)} not visible (found ${result.pixelCount} pixels, need ${minPixelCount})`,
      details: { pixelCount: result.pixelCount, color: color.toString(16) },
    };
  }

  return {
    passed: true,
    message: `Entity visible with ${result.pixelCount} pixels`,
    details: {
      pixelCount: result.pixelCount,
      position: result.averagePosition,
      boundingBox: result.boundingBox,
    },
  };
}

/**
 * Asserts that an entity is NOT visible on screen (e.g., after death/despawn)
 */
export async function assertEntityNotVisible(
  page: Page,
  color: number,
  maxPixelCount: number = 5,
): Promise<VisualAssertionResult> {
  const pixels = await captureCanvasPixels(page);
  const result = detectColor(pixels, color);

  if (result.pixelCount > maxPixelCount) {
    return {
      passed: false,
      message: `Entity with color ${color.toString(16)} still visible (found ${result.pixelCount} pixels)`,
      details: {
        pixelCount: result.pixelCount,
        position: result.averagePosition,
      },
    };
  }

  return {
    passed: true,
    message: `Entity not visible (${result.pixelCount} pixels found)`,
    details: { pixelCount: result.pixelCount },
  };
}

/**
 * Asserts that two entities are adjacent (within threshold distance)
 */
export async function assertEntitiesAdjacent(
  page: Page,
  color1: number,
  color2: number,
  threshold: number = 100,
): Promise<VisualAssertionResult> {
  const pixels = await captureCanvasPixels(page);
  const result1 = detectColor(pixels, color1);
  const result2 = detectColor(pixels, color2);

  if (!result1.found) {
    return {
      passed: false,
      message: `First entity (${color1.toString(16)}) not found`,
      details: { color1: color1.toString(16), found1: false },
    };
  }

  if (!result2.found) {
    return {
      passed: false,
      message: `Second entity (${color2.toString(16)}) not found`,
      details: { color2: color2.toString(16), found2: false },
    };
  }

  const pos1 = result1.averagePosition!;
  const pos2 = result2.averagePosition!;
  const distance = getScreenDistance(pos1, pos2);

  if (distance > threshold) {
    return {
      passed: false,
      message: `Entities are ${distance.toFixed(1)}px apart (threshold: ${threshold}px)`,
      details: { distance, pos1, pos2, threshold },
    };
  }

  return {
    passed: true,
    message: `Entities are adjacent (${distance.toFixed(1)}px apart)`,
    details: { distance, pos1, pos2 },
  };
}

/**
 * Asserts that the game screen has rendered properly
 */
export async function assertScreenRendered(
  page: Page,
): Promise<VisualAssertionResult> {
  const pixels = await captureCanvasPixels(page);
  const stats = analyzeScreenStats(pixels);

  if (stats.isAllBlack) {
    return {
      passed: false,
      message: "Screen is all black - game may not be rendering",
      details: { stats },
    };
  }

  if (stats.isAllWhite) {
    return {
      passed: false,
      message: "Screen is all white - something may be wrong",
      details: { stats },
    };
  }

  if (stats.isAllOneColor) {
    return {
      passed: false,
      message: `Screen is ${stats.dominantColorPercentage.toFixed(1)}% one color`,
      details: { stats },
    };
  }

  return {
    passed: true,
    message: `Screen rendered properly (${stats.uniqueColors} unique colors)`,
    details: { stats },
  };
}

// ============================================================================
// Test World Setup Helpers
// ============================================================================

/**
 * Test scenario configuration
 */
export interface TestScenarioConfig {
  /** Position to place the player */
  playerPosition?: { x: number; y: number; z: number };
  /** Mobs to spawn with positions */
  mobs?: Array<{
    type: string;
    position: { x: number; y: number; z: number };
    health?: number;
  }>;
  /** Items to spawn with positions */
  items?: Array<{
    itemId: string;
    position: { x: number; y: number; z: number };
    quantity?: number;
  }>;
  /** Whether to set up overhead camera */
  overheadCamera?: boolean;
  /** Height for overhead camera */
  cameraHeight?: number;
}

/**
 * Sets up a test scenario with entities and camera
 * This creates colored cube proxies for visual testing
 */
export async function setupTestScenario(
  page: Page,
  config: TestScenarioConfig,
): Promise<void> {
  // Set up overhead camera if requested
  if (config.overheadCamera) {
    await setupOverheadCamera(page, config.cameraHeight ?? 50);
  }

  // Move player if position specified
  if (config.playerPosition) {
    await page.evaluate((pos) => {
      const win = window as unknown as {
        world?: {
          entities?: {
            player?: {
              mesh?: {
                position: { x: number; y: number; z: number };
              };
            };
          };
        };
      };
      const playerMesh = win.world?.entities?.player?.mesh;
      if (playerMesh) {
        playerMesh.position.x = pos.x;
        playerMesh.position.y = pos.y;
        playerMesh.position.z = pos.z;
      }
    }, config.playerPosition);

    // Add player proxy cube
    await createProxyCubeAtPosition(
      page,
      "test-player",
      PROXY_COLORS.PLAYER,
      config.playerPosition,
    );
  }

  // Note: Mob and item spawning would require server-side API calls
  // For now, we add visual proxies for any existing entities
}

/**
 * Creates a colored proxy cube at a specific position
 */
export async function createProxyCubeAtPosition(
  page: Page,
  id: string,
  color: number,
  position: { x: number; y: number; z: number },
  size: number = 2,
): Promise<void> {
  await page.evaluate(
    ({ cubeId, col, pos, s }) => {
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
            position: { set: (x: number, y: number, z: number) => void };
          };
        };
        world?: {
          scene?: { add: (obj: unknown) => void };
        };
      };

      const THREE = win.THREE;
      const world = win.world;
      if (!THREE || !world?.scene) return;

      const geometry = new THREE.BoxGeometry(s, s, s);
      const material = new THREE.MeshBasicMaterial({ color: col });
      const cube = new THREE.Mesh(geometry, material);

      cube.name = `test-proxy-${cubeId}`;
      cube.userData.isTestProxy = true;
      cube.userData.proxyId = cubeId;
      cube.position.set(pos.x, pos.y, pos.z);

      world.scene.add(cube);
    },
    { cubeId: id, col: color, pos: position, s: size },
  );
}

/**
 * Waits for the visual test to stabilize (rendering complete)
 */
export async function waitForRenderStable(
  page: Page,
  timeout: number = 2000,
): Promise<void> {
  // Wait for a short time to allow rendering to stabilize
  await page.waitForTimeout(100);

  // Take two screenshots and compare - if they're the same, rendering is stable
  const startTime = Date.now();
  let lastPixels = await captureCanvasPixels(page);

  while (Date.now() - startTime < timeout) {
    await page.waitForTimeout(100);
    const currentPixels = await captureCanvasPixels(page);

    // Simple comparison - check if pixel data is similar
    let diffCount = 0;
    const sampleSize = Math.min(1000, lastPixels.data.length / 4);
    const step = Math.floor(lastPixels.data.length / 4 / sampleSize);

    for (let i = 0; i < sampleSize; i++) {
      const idx = i * step * 4;
      if (
        Math.abs(lastPixels.data[idx] - currentPixels.data[idx]) > 5 ||
        Math.abs(lastPixels.data[idx + 1] - currentPixels.data[idx + 1]) > 5 ||
        Math.abs(lastPixels.data[idx + 2] - currentPixels.data[idx + 2]) > 5
      ) {
        diffCount++;
      }
    }

    // If less than 1% of sampled pixels changed, consider it stable
    if (diffCount / sampleSize < 0.01) {
      return;
    }

    lastPixels = currentPixels;
  }
}

/**
 * Captures a visual test report with screenshot and analysis
 */
export async function captureVisualReport(
  page: Page,
  testName: string,
): Promise<{
  screenshotPath: string;
  stats: ScreenStats;
  entityResults: Record<string, ColorDetectionResult>;
}> {
  const pixels = await captureCanvasPixels(page);
  const stats = analyzeScreenStats(pixels);

  // Detect all entity types
  const entityResults: Record<string, ColorDetectionResult> = {};
  for (const [name, color] of Object.entries(PROXY_COLORS)) {
    entityResults[name] = detectColor(pixels, color);
  }

  // Save screenshot
  const screenshotPath = await saveTestScreenshot(page, testName);

  return { screenshotPath, stats, entityResults };
}
