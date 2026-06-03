/**
 * @hyperforge/procgen
 *
 * Procedural generation toolkit for trees, plants, rocks, buildings, grass, and flowers.
 * Tree generation is based on the Weber & Penn algorithm.
 *
 * For impostor/LOD functionality, import from @hyperforge/impostor.
 *
 * @packageDocumentation
 */

// Types and LOD Presets
export * from "./types.js";
export { TREE_LOD_PRESETS } from "./types.js";

// Math utilities
export {
  SeededRandom,
  randInRange,
  declination,
  randomVector,
  rotatedVector,
  radians,
  degrees,
  toTrackQuat,
  vec3FromArray,
  lerpVec3,
  type BezierSplinePoint,
  calcPointOnBezier,
  calcTangentToBezier,
  createBezierPoint,
  evaluateBezierSpline,
  bezierArcLength,
  sampleBezierByArcLength,
  type HelixPoints,
  calcHelixPoints,
  calcHelixPitch,
  calcHelixRadius,
} from "./math/index.js";

// Core classes
export {
  Tree,
  Turtle,
  applyTropism,
  makeBranchPosTurtle,
  makeBranchDirTurtle,
  Stem,
  scaleBezierHandlesForFlare,
  createStemPoint,
  type StemPointWithRadius,
  Leaf,
  shapeRatio,
  pointInsideEnvelope,
  calcBranchLengthModifier,
} from "./core/index.js";

// Geometry
export {
  generateLeafGeometry,
  generateSeparateLeafGeometry,
  generateBranchGeometry,
  generateBranchGeometryByDepth,
  getLeafShape,
  getBlossomShape,
  ALL_LEAF_SHAPES,
  ALL_BLOSSOM_SHAPES,
  // Instanced rendering
  generateInstancedLeaves,
  generateInstancedLeavesAndBlossoms,
  createLeafCardGeometry,
  type InstancedLeafResult,
  type InstancedLeafOptions,
  type ProceduralLeafShape,
  // Vertex AO computation
  computeVertexAO,
  computeQuickVertexAO,
  enableVertexColorMaterials,
  type VertexAOOptions,
  // TSL (WebGPU) instanced leaf material - GLSL version removed
  createInstancedLeafMaterialTSL,
  type TSLInstancedLeafMaterial,
  type TSLInstancedLeafMaterialOptions,
  type TSLLeafShape,
  // Leaf cluster generation (basic spatial)
  LeafClusterGenerator,
  LeafClusterBaker,
  createClusterBillboardGeometry,
  createClusterTransforms,
  calculateClusterDensities,
  type LeafCluster,
  type LeafClusterResult,
  type LeafClusterOptions,
  type BakedCluster,
  type ClusterAtlas,
  type ClusterBakeOptions,
  // Branch-aware clustering (SpeedTree style)
  BranchClusterGenerator,
  type BranchLeafData,
  type BranchCluster,
  type BranchClusterResult,
  type BranchClusterOptions,
} from "./geometry/index.js";

// Parameters and presets
export {
  DEFAULT_PARAMS,
  createTreeParams,
  PRESETS,
  getPreset,
  getPresetNames,
  ACER,
  APPLE,
  BALSAM_FIR,
  BAMBOO,
  BLACK_OAK,
  BLACK_TUPELO,
  CAMBRIDGE_OAK,
  DOUGLAS_FIR,
  EUROPEAN_LARCH,
  FAN_PALM,
  HILL_CHERRY,
  LOMBARDY_POPLAR,
  PALM,
  QUAKING_ASPEN,
  SASSAFRAS,
  SILVER_BIRCH,
  SMALL_PINE,
  SPHERE_TREE,
  WEEPING_WILLOW,
} from "./params/index.js";

// Rendering
export {
  generateTreeMesh,
  createDefaultBranchMaterial,
  createDefaultLeafMaterial,
  createDefaultBlossomMaterial,
  disposeTreeMesh,
  type TreeMeshOptions,
  type TreeMeshResult,
  TreeGenerator,
  generateTree,
  generateTreeVariations,
  addTreeToScene,
  exportTreeToGLB,
  exportTreeToGLBFile,
  generateAndExportTree,
  type TreeGeneratorOptions,
  type GLBExportOptions,
  type GLBExportResult,
} from "./rendering/index.js";

// Export utilities
export { exportToGLB, exportToGLBFile } from "./export/index.js";

// Tree Impostor (tree-specific wrapper for @hyperforge/impostor)
// For core impostor functionality, import from @hyperforge/impostor directly
export {
  TreeImpostor,
  bakeTreeImpostor,
  type TreeImpostorOptions,
  type BakeMode,
} from "./impostor/index.js";

// Additional generators (namespaced to avoid export collisions)
export * as PlantGen from "./plant/index.js";
export * as RockGen from "./rock/index.js";
export * as BuildingGen from "./building/index.js";
export * as TerrainGen from "./terrain/index.js";
export * as VegetationGen from "./vegetation/index.js";
export * as GrassGen from "./grass/index.js";
export * as FlowerGen from "./flowers/index.js";
export * as ItemsGen from "./items/index.js";

// Standalone context for Asset Forge and viewers
export * as Standalone from "./standalone/index.js";
