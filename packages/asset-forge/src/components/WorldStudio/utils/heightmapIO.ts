/**
 * heightmapIO — Export/import terrain as PNG heightmaps
 *
 * Export: Queries terrain at a regular grid and encodes as 16-bit PNG
 *         (high byte in R, low byte in G, biome index in B).
 *         Metadata (world size, max height) stored in PNG tEXt chunk isn't
 *         supported by the Canvas API, so we embed it in a sidecar JSON blob.
 *
 * Import: Reads a PNG, extracts height values, creates a custom
 *         TerrainQuerier that samples the imported heightmap via bilinear
 *         interpolation.
 */

import type { TerrainQueryResult } from "../../WorldBuilder/terrainHelpers";

// ============== TYPES ==============

export interface HeightmapMetadata {
  /** World size in tiles */
  worldSize: number;
  /** Tile size in world units */
  tileSize: number;
  /** Maximum terrain height */
  maxHeight: number;
  /** Water threshold */
  waterThreshold: number;
  /** Heightmap resolution (width = height) */
  resolution: number;
}

export interface HeightmapExportResult {
  /** PNG blob for download */
  blob: Blob;
  /** Metadata needed for re-import */
  metadata: HeightmapMetadata;
}

// ============== EXPORT ==============

/**
 * Export terrain as a 16-bit-precision PNG heightmap.
 *
 * Height is normalized to [0, 1] then encoded as:
 *   R = floor(h * 65535) >> 8   (high byte)
 *   G = floor(h * 65535) & 0xFF (low byte)
 *   B = 0
 *   A = 255
 *
 * This gives ~0.0015% height precision per texel (65536 levels).
 */
export async function exportHeightmap(
  querier: (worldX: number, worldZ: number) => TerrainQueryResult,
  worldSize: number,
  tileSize: number,
  maxHeight: number,
  waterThreshold: number,
  resolution: number = 2048,
): Promise<HeightmapExportResult> {
  const canvas = document.createElement("canvas");
  canvas.width = resolution;
  canvas.height = resolution;
  const ctx = canvas.getContext("2d")!;
  const imageData = ctx.createImageData(resolution, resolution);
  const data = imageData.data;

  const worldExtent = worldSize * tileSize;

  for (let py = 0; py < resolution; py++) {
    // Map pixel Y to world Z (top of image = Z=0)
    const worldZ = (py / (resolution - 1)) * worldExtent;
    for (let px = 0; px < resolution; px++) {
      const worldX = (px / (resolution - 1)) * worldExtent;
      const result = querier(worldX, worldZ);

      // Normalize height to [0, 1], clamped
      const normalized = Math.max(0, Math.min(1, result.height / maxHeight));
      const encoded = Math.round(normalized * 65535);

      const idx = (py * resolution + px) * 4;
      data[idx] = (encoded >> 8) & 0xff; // R = high byte
      data[idx + 1] = encoded & 0xff; // G = low byte
      data[idx + 2] = 0; // B = unused
      data[idx + 3] = 255; // A = opaque
    }
  }

  ctx.putImageData(imageData, 0, 0);

  const blob = await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((b) => {
      if (b) resolve(b);
      else reject(new Error("Failed to encode heightmap PNG"));
    }, "image/png");
  });

  return {
    blob,
    metadata: {
      worldSize,
      tileSize,
      maxHeight,
      waterThreshold,
      resolution,
    },
  };
}

/**
 * Trigger a browser download of the heightmap PNG + metadata JSON.
 */
export function downloadHeightmap(
  result: HeightmapExportResult,
  filename: string = "heightmap",
): void {
  // Download PNG
  const pngUrl = URL.createObjectURL(result.blob);
  const pngLink = document.createElement("a");
  pngLink.href = pngUrl;
  pngLink.download = `${filename}.png`;
  pngLink.click();
  URL.revokeObjectURL(pngUrl);

  // Download metadata JSON
  const metaBlob = new Blob([JSON.stringify(result.metadata, null, 2)], {
    type: "application/json",
  });
  const metaUrl = URL.createObjectURL(metaBlob);
  const metaLink = document.createElement("a");
  metaLink.href = metaUrl;
  metaLink.download = `${filename}.meta.json`;
  metaLink.click();
  URL.revokeObjectURL(metaUrl);
}

// ============== IMPORT ==============

/**
 * Load a PNG file and extract the 16-bit height data.
 * Returns a Float32Array of normalized [0, 1] heights in row-major order.
 */
export async function loadHeightmapFromFile(
  file: File,
): Promise<{ heights: Float32Array; width: number; height: number }> {
  const bitmap = await createImageBitmap(file);
  const canvas = document.createElement("canvas");
  canvas.width = bitmap.width;
  canvas.height = bitmap.height;
  const ctx = canvas.getContext("2d")!;
  ctx.drawImage(bitmap, 0, 0);
  bitmap.close();

  const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const data = imageData.data;
  const heights = new Float32Array(canvas.width * canvas.height);

  for (let i = 0; i < heights.length; i++) {
    const idx = i * 4;
    const highByte = data[idx]; // R
    const lowByte = data[idx + 1]; // G
    heights[i] = ((highByte << 8) | lowByte) / 65535;
  }

  return { heights, width: canvas.width, height: canvas.height };
}

/**
 * Load the metadata JSON sidecar file.
 */
export async function loadHeightmapMetadata(
  file: File,
): Promise<HeightmapMetadata> {
  const text = await file.text();
  return JSON.parse(text) as HeightmapMetadata;
}

/**
 * Create a TerrainQuerier backed by an imported heightmap.
 * Uses bilinear interpolation for smooth height sampling between texels.
 */
export function createHeightmapQuerier(
  heights: Float32Array,
  width: number,
  height: number,
  metadata: HeightmapMetadata,
): (worldX: number, worldZ: number) => TerrainQueryResult {
  const worldExtent = metadata.worldSize * metadata.tileSize;
  const { maxHeight } = metadata;

  return (worldX: number, worldZ: number): TerrainQueryResult => {
    // Map world coords to texel coords + clamp BEFORE computing
    // fx/fz so out-of-bounds queries return the nearest in-bounds
    // texel value instead of extrapolating with negative or
    // oversized weights. (Without this clamp, `q(-100, -100)`
    // returned a negative height — the integer indices clamped
    // but the fractional weights didn't.)
    const tx = Math.max(
      0,
      Math.min(width - 1, (worldX / worldExtent) * (width - 1)),
    );
    const tz = Math.max(
      0,
      Math.min(height - 1, (worldZ / worldExtent) * (height - 1)),
    );

    // Bilinear interpolation — indices already in-bounds because
    // tx/tz are pre-clamped above.
    const x0 = Math.floor(tx);
    const x1 = Math.min(width - 1, x0 + 1);
    const z0 = Math.floor(tz);
    const z1 = Math.min(height - 1, z0 + 1);

    const fx = tx - x0;
    const fz = tz - z0;

    const h00 = heights[z0 * width + x0];
    const h10 = heights[z0 * width + x1];
    const h01 = heights[z1 * width + x0];
    const h11 = heights[z1 * width + x1];

    const h =
      h00 * (1 - fx) * (1 - fz) +
      h10 * fx * (1 - fz) +
      h01 * (1 - fx) * fz +
      h11 * fx * fz;

    return {
      height: h * maxHeight,
      biome: "plains", // Imported heightmaps don't carry biome data
      biomeForestWeight: 0,
      biomeCanyonWeight: 0,
    };
  };
}
