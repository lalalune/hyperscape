/**
 * Octahedral Impostor Library
 *
 * A Three.js library for creating and rendering octahedral impostors.
 *
 * @example
 * ```typescript
 * import { OctahedralImpostor, OctahedronType } from '@hyperforge/impostor';
 *
 * // Create impostor system
 * const impostor = new OctahedralImpostor(renderer);
 *
 * // Bake a mesh
 * const result = impostor.bake(myMesh, {
 *   atlasWidth: 2048,
 *   atlasHeight: 2048,
 *   gridSizeX: 16,
 *   gridSizeY: 16,
 *   octType: OctahedronType.HEMI
 * });
 *
 * // Create runtime instance
 * const instance = impostor.createInstance(result);
 * scene.add(instance.mesh);
 *
 * // Update each frame
 * instance.update(camera);
 * ```
 *
 * @packageDocumentation
 */

// Re-export everything from the library
export * from "./lib";

// Also export utilities
export {
  createColoredCube,
  generateHSLGradientColors,
  centerGeometryToBoundingSphere,
  computeCombinedBoundingSphere,
  createTestTorusKnot,
  lerp,
  mapLinear,
} from "./lib/utils";
