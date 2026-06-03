/**
 * @hyperforge/procgen/plant
 *
 * Procedural plant and foliage generation for Three.js WebGPU
 *
 * @example
 * ```typescript
 * import { PlantGenerator, generateFromPreset } from '@hyperforge/procgen/plant';
 *
 * // Quick generation from preset
 * const result = generateFromPreset('monstera', 12345);
 * scene.add(result.group);
 *
 * // Full control with generator
 * const generator = new PlantGenerator({ seed: 12345 });
 * generator
 *   .loadPreset('philodendron')
 *   .setQuality('Maximum')
 *   .setParam('LeafCount', 8);
 *
 * const plant = generator.generate();
 * scene.add(plant.group);
 * ```
 *
 * @packageDocumentation
 */

// Main generator
export {
  PlantGenerator,
  generateFromPreset,
  generateRandom,
  createGenerator,
  PRESETS,
  getPreset,
  getPresetNames,
  createParamsFromPreset,
  createDefaultParams,
  // GLB export
  exportPlantToGLB,
  exportPlantToGLBFile,
  generateAndExportPlant,
  type PlantGLBExportOptions,
  type PlantGLBExportResult,
  // Stump generation
  generateStumpMesh,
  generateStumpFromParams,
  STUMP_HEIGHT,
  type StumpGenerationResult,
  // Math/geometry helpers (for testing)
  shapeScaleAtPercent,
  trunkShapeScaleAtPercent,
  createStemShape,
  lookRotation,
  rotatePointByQuat,
  evaluateBezierPoint,
  getBezierTangent,
} from "./PlantGenerator.js";

// Types
export type {
  Point2D,
  Point3D,
  Polar,
  Curve2D,
  Curve3D,
  LeafCurve,
  LeafCurveType,
  LeafVein,
  LeafVeinType,
  LeafVeinGroup,
  LeafVeinsData,
  MeshData,
  LeafParamDict,
  LeafParam,
  LeafShapeData,
  ArrangementData,
  LeafBundle,
  PlantTrunkData,
  LeafStemData,
  HSLColor,
  FloatRange,
  PlantPreset,
  PlantPresetName,
  PlantGenerationOptions,
  PlantGenerationResult,
  RenderQuality,
  QualitySettings,
  DistortionCurve,
  TextureVars,
} from "./types.js";

// Enums
export {
  LPK,
  LPType,
  LPCategory,
  LPImportance,
  LeafCurveType as LeafCurveTypeEnum,
  LeafVeinType as LeafVeinTypeEnum,
  LeafDistortionType,
  TextureType,
  Axis,
  RenderQuality as RenderQualityEnum,
} from "./types.js";

// Shape module
export {
  generateLeafShape,
  getShapeCurves,
  getShapeCurveCount,
  findShapeCurve,
} from "./shape/LeafShape.js";

export {
  createLeafCurve,
  copyLeafCurve,
  evaluateLeafCurve,
  mirrorLeafCurve,
  mirrorCurves,
} from "./shape/LeafCurve.js";

// Veins module
export {
  generateLeafVeins,
  getAllVeins,
  getVeinsByType,
  getMidrib,
  getTotalVeinLength,
} from "./veins/LeafVeins.js";

// Mesh module
export {
  triangulateLeaf,
  sampleCurvePoints,
  delaunayTriangulate,
  generateLeafUVs,
  calculateVertexNormals,
} from "./mesh/Triangulation.js";

export { extrudeLeafMesh, applyMidribGroove } from "./mesh/Extrusion.js";

// Distortion module
export {
  applyDistortions,
  generateDistortionInstances,
} from "./distortion/LeafDistortion.js";

// Texture module
export {
  generateAlbedoTexture,
  generateNormalTexture,
  generateHeightTexture,
  generateAllTextures,
} from "./texture/TextureGenerator.js";

// Assembly module
export {
  generateTrunk,
  generateStem,
  calculateArrangements,
  applyCollisionAvoidance,
  quaternionFromEuler,
} from "./assembly/Arrangement.js";

// Parameters module
export {
  getParamValue,
  getParamColorValue,
  setParamValue,
  setParamColorValue,
  copyParamValues,
  cloneParams,
} from "./params/LeafParamDefaults.js";

// Math utilities
export {
  SeededRandom,
  setGlobalSeed,
  getGlobalRandom,
  genTypedSeed,
} from "./math/Random.js";

export {
  evaluateCurve2D,
  evaluateCurve3D,
  createCurve2D,
  createCurve3D,
  subdivideCurve2D,
  subdivideCurve3D,
  getCurveLength2D,
  getCurveLength3D,
  findClosestPointOnCurve2D,
  findClosestPointOnCurve3D,
} from "./math/Bezier.js";

export {
  point2D,
  point3D,
  add2D,
  add3D,
  sub2D,
  sub3D,
  mul2D,
  mul3D,
  lerp2D,
  lerp3D,
  distance2D,
  distance3D,
  normalize2D,
  normalize3D,
  getExtents2D,
  getExtents3D,
  clamp,
  clamp01,
} from "./math/Vector.js";

export {
  polar,
  polarToCartesian,
  cartesianToPolar,
  radians,
  degrees,
  angleBetween,
  PI,
  PI2,
  HALF_PI,
} from "./math/Polar.js";

// Presets module
export { applyPreset } from "./presets/PlantPresets.js";

// Worker module
export { WorkerPool, createWorkerPool } from "./worker/WorkerPool.js";
