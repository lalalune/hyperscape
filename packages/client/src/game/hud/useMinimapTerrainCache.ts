import { useCallback, useEffect, useRef, type MutableRefObject } from "react";
import { TERRAIN_CONSTANTS, TerrainSystem } from "@hyperscape/shared";
import type { ClientWorld } from "../../types";

const TERRAIN_BASE_SAMPLE_SIZE = 96;
const TERRAIN_CLOSE_SAMPLE_SIZE = 128;
const TERRAIN_MAX_SAMPLE_SIZE = 192;
export const MINIMAP_TERRAIN_OVERSHOOT = 1.75;

interface BiomeDataLike {
  color?: number;
  colorScheme?: {
    primary?: string;
  };
}

interface CachedBiomeColor {
  r: number;
  g: number;
  b: number;
}

const MINIMAP_BIOME_OVERRIDES: Record<string, CachedBiomeColor> = {
  plains: { r: 92, g: 134, b: 86 },
  forest: { r: 56, g: 96, b: 70 },
  woodland: { r: 68, g: 108, b: 78 },
  swamp: { r: 74, g: 94, b: 72 },
  desert: { r: 166, g: 138, b: 92 },
  canyon: { r: 132, g: 94, b: 78 },
  mountains: { r: 104, g: 112, b: 124 },
  mountain: { r: 104, g: 112, b: 124 },
  rocky: { r: 112, g: 118, b: 126 },
  tundra: { r: 156, g: 170, b: 178 },
  snow: { r: 162, g: 176, b: 186 },
  frozen: { r: 152, g: 168, b: 180 },
  ice: { r: 144, g: 166, b: 184 },
  beach: { r: 170, g: 152, b: 110 },
};

interface EnsureTerrainCacheArgs {
  centerX: number;
  centerZ: number;
  currentExtent: number;
  upX: number;
  upZ: number;
  viewportPixels: number;
}

function sameTerrainRequest(
  left: EnsureTerrainCacheArgs | null,
  right: EnsureTerrainCacheArgs,
): boolean {
  if (!left) return false;

  return (
    left.centerX === right.centerX &&
    left.centerZ === right.centerZ &&
    left.currentExtent === right.currentExtent &&
    left.upX === right.upX &&
    left.upZ === right.upZ &&
    left.viewportPixels === right.viewportPixels
  );
}

const DEFAULT_BIOME_COLOR: CachedBiomeColor = {
  r: 86,
  g: 126,
  b: 86,
};
const BIOME_COLOR_CACHE_LIMIT = 128;
const biomeColorCache = new Map<string, CachedBiomeColor | null>();

function setBiomeColorCacheEntry(
  biomeId: string,
  color: CachedBiomeColor | null,
): void {
  if (biomeColorCache.has(biomeId)) {
    biomeColorCache.delete(biomeId);
  }
  biomeColorCache.set(biomeId, color);
  if (biomeColorCache.size > BIOME_COLOR_CACHE_LIMIT) {
    const oldestKey = biomeColorCache.keys().next().value;
    if (oldestKey) {
      biomeColorCache.delete(oldestKey);
    }
  }
}

export interface MinimapTerrainCacheRefs {
  terrainOffscreenRef: MutableRefObject<OffscreenCanvas | null>;
  terrainCacheCenterRef: MutableRefObject<{ x: number; z: number }>;
  terrainCacheExtentRef: MutableRefObject<number>;
  terrainCacheUpRef: MutableRefObject<{ x: number; z: number }>;
}

function clampColorChannel(value: number): number {
  return Math.max(0, Math.min(255, value | 0));
}

function parseHexColor(color: string): CachedBiomeColor | null {
  const trimmed = color.trim();
  const hex = trimmed.startsWith("#") ? trimmed.slice(1) : trimmed;
  if (hex.length !== 6) {
    return null;
  }

  const numeric = Number.parseInt(hex, 16);
  if (Number.isNaN(numeric)) {
    return null;
  }

  return {
    r: (numeric >> 16) & 0xff,
    g: (numeric >> 8) & 0xff,
    b: numeric & 0xff,
  };
}

function numberToColor(value: number): CachedBiomeColor {
  return {
    r: (value >> 16) & 0xff,
    g: (value >> 8) & 0xff,
    b: value & 0xff,
  };
}

function getBiomeOverride(biomeId: string): CachedBiomeColor | null {
  const normalized = biomeId.toLowerCase();
  const direct = MINIMAP_BIOME_OVERRIDES[normalized];
  if (direct) return direct;

  for (const [key, color] of Object.entries(MINIMAP_BIOME_OVERRIDES)) {
    if (normalized.includes(key)) {
      return color;
    }
  }

  return null;
}

function blendColors(
  base: CachedBiomeColor,
  overlay: CachedBiomeColor,
  weight: number,
): CachedBiomeColor {
  const clampedWeight = Math.max(0, Math.min(1, weight));
  const inverse = 1 - clampedWeight;
  return {
    r: clampColorChannel(base.r * inverse + overlay.r * clampedWeight),
    g: clampColorChannel(base.g * inverse + overlay.g * clampedWeight),
    b: clampColorChannel(base.b * inverse + overlay.b * clampedWeight),
  };
}

function getBiomeBaseColor(
  terrainSystem: TerrainSystem,
  worldX: number,
  worldZ: number,
): CachedBiomeColor {
  const biomeId = terrainSystem.getBiomeAtPosition?.(worldX, worldZ);
  if (!biomeId) {
    return DEFAULT_BIOME_COLOR;
  }

  const cachedBiome = biomeColorCache.get(biomeId);
  if (cachedBiome !== undefined) {
    return cachedBiome ?? DEFAULT_BIOME_COLOR;
  }

  const biomeData = biomeId ? terrainSystem.getBiomeData?.(biomeId) : null;
  let biomeColor: CachedBiomeColor | null = null;

  if (biomeData?.colorScheme?.primary) {
    const parsed = parseHexColor(biomeData.colorScheme.primary);
    if (parsed) {
      biomeColor = parsed;
    }
  }

  if (typeof biomeData?.color === "number") {
    biomeColor = numberToColor(biomeData.color);
  }

  const overrideColor = getBiomeOverride(biomeId);
  if (overrideColor) {
    biomeColor = biomeColor
      ? blendColors(biomeColor, overrideColor, 0.72)
      : overrideColor;
  }

  if (!biomeColor) {
    biomeColor = DEFAULT_BIOME_COLOR;
  }

  setBiomeColorCacheEntry(biomeId, biomeColor);
  return biomeColor;
}

async function generateTerrainChunked(
  terrainSystem: TerrainSystem,
  centerX: number,
  centerZ: number,
  extent: number,
  upX: number,
  upZ: number,
  viewportPixels: number,
  isCancelled: () => boolean,
): Promise<OffscreenCanvas | null> {
  const viewportDrivenSize = Math.round(
    Math.max(
      TERRAIN_BASE_SAMPLE_SIZE,
      Math.min(TERRAIN_MAX_SAMPLE_SIZE, viewportPixels * 0.72),
    ),
  );
  const extentDrivenFloor =
    extent <= 140 ? TERRAIN_CLOSE_SAMPLE_SIZE : TERRAIN_BASE_SAMPLE_SIZE;
  const sampleSize = Math.max(extentDrivenFloor, viewportDrivenSize);
  const offscreen = new OffscreenCanvas(sampleSize, sampleSize);
  const context = offscreen.getContext("2d");
  if (!context) return null;

  const imageData = context.createImageData(sampleSize, sampleSize);
  const data = imageData.data;
  const rightX = -upZ;
  const rightZ = upX;
  const sampleStep = (extent * 2) / sampleSize;

  for (let sy = 0; sy < sampleSize; sy += 1) {
    if (isCancelled()) return null;

    for (let sx = 0; sx < sampleSize; sx += 1) {
      const px = (sx + 0.5) / sampleSize;
      const py = (sy + 0.5) / sampleSize;
      const ndcX = px * 2 - 1;
      const ndcY = py * 2 - 1;
      const worldX = centerX + ndcX * rightX * extent - ndcY * upX * extent;
      const worldZ = centerZ + ndcX * rightZ * extent - ndcY * upZ * extent;
      const height = terrainSystem.getHeightAt(worldX, worldZ);
      const eastHeight = terrainSystem.getHeightAt(worldX + sampleStep, worldZ);
      const northHeight = terrainSystem.getHeightAt(
        worldX,
        worldZ - sampleStep,
      );
      const slope =
        Math.min(
          1,
          Math.hypot(eastHeight - height, northHeight - height) /
            Math.max(1, sampleStep * 0.8),
        ) || 0;

      let r = 30;
      let g = 60;
      let b = 130;

      if (height > TERRAIN_CONSTANTS.WATER_THRESHOLD) {
        const biomeColor = getBiomeBaseColor(terrainSystem, worldX, worldZ);
        const lift =
          Math.min(
            30,
            ((height - TERRAIN_CONSTANTS.WATER_THRESHOLD) / 36) * 30,
          ) | 0;
        const slopeShade = Math.max(-18, Math.min(14, 8 - slope * 24)) | 0;
        const warmth = Math.max(-6, Math.min(10, (height - 18) * 0.18)) | 0;
        r = clampColorChannel(biomeColor.r + lift + slopeShade + warmth);
        g = clampColorChannel(biomeColor.g + lift + slopeShade);
        b = clampColorChannel(biomeColor.b + lift + slopeShade - (warmth >> 1));

        const luminance = r * 0.2126 + g * 0.7152 + b * 0.0722;
        if (luminance > 176) {
          const contrastDrop = Math.min(
            72,
            (luminance - 176) * 0.9 + slope * 34,
          );
          r = clampColorChannel(r - contrastDrop * 0.95);
          g = clampColorChannel(g - contrastDrop * 0.88);
          b = clampColorChannel(b - contrastDrop * 0.52 + 8);
        }
      } else {
        const waterDepth =
          Math.min(
            1,
            (TERRAIN_CONSTANTS.WATER_THRESHOLD - height) /
              Math.max(1, TERRAIN_CONSTANTS.WATER_THRESHOLD + 8),
          ) || 0;
        r = clampColorChannel(24 - waterDepth * 8);
        g = clampColorChannel(58 + waterDepth * 10);
        b = clampColorChannel(118 + waterDepth * 28);
      }

      const pixelIndex = (sy * sampleSize + sx) * 4;
      data[pixelIndex] = r;
      data[pixelIndex + 1] = g;
      data[pixelIndex + 2] = b;
      data[pixelIndex + 3] = 255;
    }

    if (sy % 16 === 15) {
      await new Promise<void>((resolve) => setTimeout(resolve, 0));
      if (isCancelled()) return null;
    }
  }

  context.putImageData(imageData, 0, 0);
  return offscreen;
}

export function useMinimapTerrainCache(
  world: ClientWorld,
): MinimapTerrainCacheRefs & {
  invalidateTerrainCache: () => void;
  clearTerrainCache: () => void;
  ensureTerrainCache: (args: EnsureTerrainCacheArgs) => void;
} {
  const terrainOffscreenRef = useRef<OffscreenCanvas | null>(null);
  const terrainCacheCenterRef = useRef<{ x: number; z: number }>({
    x: Infinity,
    z: Infinity,
  });
  const terrainCacheExtentRef = useRef<number>(0);
  const terrainCacheUpRef = useRef<{ x: number; z: number }>({ x: 0, z: -1 });
  const terrainGenVersionRef = useRef(0);
  const terrainIsGeneratingRef = useRef(false);
  const pendingTerrainRequestRef = useRef<EnsureTerrainCacheArgs | null>(null);
  const isMountedRef = useRef(true);

  const invalidateTerrainCache = useCallback(() => {
    terrainOffscreenRef.current = null;
  }, []);

  const clearTerrainCache = useCallback(() => {
    terrainGenVersionRef.current += 1;
    terrainIsGeneratingRef.current = false;
    terrainOffscreenRef.current = null;
    terrainCacheCenterRef.current.x = Infinity;
    terrainCacheCenterRef.current.z = Infinity;
    terrainCacheExtentRef.current = 0;
    terrainCacheUpRef.current.x = 0;
    terrainCacheUpRef.current.z = -1;
    pendingTerrainRequestRef.current = null;
  }, []);

  const ensureTerrainCache = useCallback(
    ({
      centerX,
      centerZ,
      currentExtent,
      upX,
      upZ,
      viewportPixels,
    }: EnsureTerrainCacheArgs) => {
      const request = {
        centerX,
        centerZ,
        currentExtent,
        upX,
        upZ,
        viewportPixels,
      };
      pendingTerrainRequestRef.current = request;

      const cachedCenter = terrainCacheCenterRef.current;
      const deltaX = centerX - cachedCenter.x;
      const deltaZ = centerZ - cachedCenter.z;
      const moved = deltaX * deltaX + deltaZ * deltaZ > 64;
      const extentChanged = terrainCacheExtentRef.current !== currentExtent;
      const needsRegen = !terrainOffscreenRef.current || moved || extentChanged;

      if (!needsRegen) {
        if (sameTerrainRequest(pendingTerrainRequestRef.current, request)) {
          pendingTerrainRequestRef.current = null;
        }
        return;
      }

      const terrainSystem = world.getSystem<TerrainSystem>("terrain");
      if (!terrainSystem?.getHeightAt) {
        return;
      }

      if (terrainIsGeneratingRef.current) {
        return;
      }

      const version = ++terrainGenVersionRef.current;
      terrainIsGeneratingRef.current = true;
      const snapshotExtent = currentExtent * MINIMAP_TERRAIN_OVERSHOOT;

      void generateTerrainChunked(
        terrainSystem,
        centerX,
        centerZ,
        snapshotExtent,
        upX,
        upZ,
        viewportPixels,
        () => !isMountedRef.current || terrainGenVersionRef.current !== version,
      )
        .then((offscreen) => {
          if (!isMountedRef.current) {
            terrainIsGeneratingRef.current = false;
            return;
          }
          const wasCancelled = terrainGenVersionRef.current !== version;
          terrainIsGeneratingRef.current = false;
          if (!wasCancelled && offscreen) {
            terrainOffscreenRef.current = offscreen;
            terrainCacheCenterRef.current.x = centerX;
            terrainCacheCenterRef.current.z = centerZ;
            terrainCacheExtentRef.current = currentExtent;
            terrainCacheUpRef.current.x = upX;
            terrainCacheUpRef.current.z = upZ;
          }

          const pendingRequest = pendingTerrainRequestRef.current;
          if (
            pendingRequest &&
            (!offscreen ||
              pendingRequest.centerX !== centerX ||
              pendingRequest.centerZ !== centerZ ||
              pendingRequest.currentExtent !== currentExtent ||
              pendingRequest.upX !== upX ||
              pendingRequest.upZ !== upZ)
          ) {
            Promise.resolve().then(() => {
              ensureTerrainCache(pendingRequest);
            });
            return;
          }

          pendingTerrainRequestRef.current = null;
        })
        .catch((err: unknown) => {
          terrainIsGeneratingRef.current = false;
          console.warn("[Minimap] Terrain generation failed:", err);
        });
    },
    [world],
  );

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
      clearTerrainCache();
    };
  }, [clearTerrainCache]);

  return {
    terrainOffscreenRef,
    terrainCacheCenterRef,
    terrainCacheExtentRef,
    terrainCacheUpRef,
    invalidateTerrainCache,
    clearTerrainCache,
    ensureTerrainCache,
  };
}
