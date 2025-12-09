/**
 * getTextureBytesFromMaterial.ts - Material Texture Memory Analysis
 *
 * Calculates approximate memory usage of textures in a Three.js material.
 * Used for memory budgeting and asset loading progress tracking.
 *
 * Memory Calculation:
 * - Checks all texture slots in material (diffuse, normal, roughness, etc.)
 * - Calculates bytes as: width × height × 4 (RGBA)
 * - Deduplicates shared textures via UUID
 * - Handles HTMLImageElement, Canvas, and ImageData
 *
 * Texture Slots Checked:
 * - alphaMap, aoMap, bumpMap, displacementMap
 * - emissiveMap, envMap, lightMap, map (diffuse)
 * - metalnessMap, normalMap, roughnessMap
 *
 * Usage:
 * ```ts
 * const material = new THREE.MeshStandardMaterial({
 *   map: textureLoader.load('diffuse.jpg')
 * });
 * const bytes = getTextureBytesFromMaterial(material);
 * console.log(`Material uses ${bytes / 1024 / 1024} MB`);
 * ```
 *
 * Referenced by: VRM factory, asset statistics, memory monitoring
 */

import THREE from "./three";
import type { MaterialWithTextures } from "../../types/systems/physics";

/** All texture slots to check for memory usage */
const slots = [
  "alphaMap",
  "aoMap",
  "bumpMap",
  "displacementMap",
  "emissiveMap",
  "envMap",
  "lightMap",
  "map",
  "metalnessMap",
  "normalMap",
  "roughnessMap",
] as const;

/**
 * Calculate Approximate Texture Memory Usage
 *
 * Sums memory usage of all textures in a material.
 * Deduplicates shared textures to avoid double-counting.
 *
 * @param material - Three.js material to analyze (can be null)
 * @returns Approximate memory usage in bytes
 */
export function getTextureBytesFromMaterial(
  material: THREE.Material | null | undefined,
): number {
  let bytes = 0;
  if (material) {
    const checked = new Set<string>();
    const materialWithTextures = material as MaterialWithTextures;
    for (const slot of slots) {
      const texture = materialWithTextures[slot];
      if (texture && texture.image && !checked.has(texture.uuid)) {
        checked.add(texture.uuid);
        const image = texture.image as
          | HTMLImageElement
          | globalThis.ImageData
          | HTMLCanvasElement
          | { width: number; height: number };
        bytes += (image.width ?? 0) * (image.height ?? 0) * 4;
      }
    }
  }
  return bytes;
}
