/**
 * Tree Generator Viewer
 *
 * Interactive tool for visualizing and testing tree generation.
 */

import {
  createColoredCube,
  ImpostorBaker,
  OctahedralImpostor,
  OctahedronType,
  type ImpostorBakeResult,
  type ImpostorInstance,
} from "@hyperforge/impostor";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { GLTFExporter } from "three/examples/jsm/exporters/GLTFExporter.js";
import { ConvexGeometry } from "three/examples/jsm/geometries/ConvexGeometry.js";
import * as THREE_WEBGPU from "three/webgpu";
import { MeshBasicNodeMaterial } from "three/webgpu";
import {
  Fn,
  uv,
  uniform,
  float,
  vec2,
  vec3,
  add,
  sub,
  mul,
  abs,
  fract,
  sin,
  cos,
  max,
  smoothstep,
  floor,
  sqrt,
} from "three/tsl";
import {
  BUILDING_RECIPES,
  BuildingGenerator,
  TownGenerator,
  type BuildingStats,
  type GeneratedBuilding,
  type GeneratedTown,
  type TownSize,
} from "../src/building/index.js";
import {
  GrassGenerator,
  createGrassClumpGeometry,
  createSimpleGrassBladeGeometry,
  type GrassFieldResult,
} from "../src/grass/index.js";
import {
  computeQuickVertexAO,
  disposeTreeMesh,
  getPreset,
  TreeGenerator,
  TreeImpostor,
  LeafClusterGenerator,
  LeafClusterBaker,
  createClusterBillboardGeometry,
  type TreeMeshResult,
  type LeafClusterResult,
  type LeafCluster,
  type LeafData,
  type ClusterAtlas,
} from "../src/index.js";
import {
  generateFromPreset as generatePlantFromPreset,
  getPresetNames as getPlantPresetNames,
  RenderQualityEnum,
  type PlantGenerationResult,
  type PlantPresetName,
} from "../src/plant/index.js";
import {
  DEFAULT_PARAMS as ROCK_DEFAULT_PARAMS,
  ROCK_TYPE_PRESETS,
  RockGenerator,
  SHAPE_PRESETS,
  type BaseShapeType,
  type ColorModeType,
  type GeneratedRock,
  type PartialRockParams,
  type TexturePatternType,
  type UVMethodType,
} from "../src/rock/index.js";
import { NavigationVisualizer } from "../src/building/viewer/NavigationVisualizer.js";

// DOM elements
const canvasContainer = document.getElementById("canvas-container")!;
const loading = document.getElementById("loading")!;
const presetSelect = document.getElementById("preset") as HTMLSelectElement;
const seedInput = document.getElementById("seed") as HTMLInputElement;
const generateLeavesCheckbox = document.getElementById(
  "generateLeaves",
) as HTMLInputElement;
const generateBtn = document.getElementById("generateBtn") as HTMLButtonElement;
const randomSeedBtn = document.getElementById(
  "randomSeedBtn",
) as HTMLButtonElement;
const radialSegmentsInput = document.getElementById(
  "radialSegments",
) as HTMLInputElement;
const maxLeavesInput = document.getElementById("maxLeaves") as HTMLInputElement;
const maxBranchDepthInput = document.getElementById(
  "maxBranchDepth",
) as HTMLInputElement;
const wireframeCheckbox = document.getElementById(
  "wireframe",
) as HTMLInputElement;
const showBranchesCheckbox = document.getElementById(
  "showBranches",
) as HTMLInputElement;
const showLeavesCheckbox = document.getElementById(
  "showLeaves",
) as HTMLInputElement;
const useInstancedCheckbox = document.getElementById(
  "useInstanced",
) as HTMLInputElement;
const stemCountSpan = document.getElementById("stemCount")!;
const leafCountSpan = document.getElementById("leafCount")!;
const vertexCountSpan = document.getElementById("vertexCount")!;
const triangleCountSpan = document.getElementById("triangleCount")!;
const genTimeSpan = document.getElementById("genTime")!;
const generatorTitle = document.getElementById("generatorTitle")!;
const generatorTabButtons = Array.from(
  document.querySelectorAll<HTMLButtonElement>("[data-generator-tab]"),
);
const treeControls = document.getElementById("tree-controls")!;
const plantControls = document.getElementById("plant-controls")!;
const rockControls = document.getElementById("rock-controls")!;
const buildingControls = document.getElementById("building-controls")!;
const townControls = document.getElementById("town-controls")!;
const treeStatsPanel = document.getElementById("stats-tree")!;
const plantStatsPanel = document.getElementById("stats-plant")!;
const rockStatsPanel = document.getElementById("stats-rock")!;
const buildingStatsPanel = document.getElementById("stats-building")!;
const townStatsPanel = document.getElementById("stats-town")!;
const treeDisplayControls = document.getElementById("tree-display-controls")!;

// Leaf Cluster controls
const showClustersCheckbox = document.getElementById(
  "showClusters",
) as HTMLInputElement;
const showOctreeCellsCheckbox = document.getElementById(
  "showOctreeCells",
) as HTMLInputElement;
const enableViewCullingCheckbox = document.getElementById(
  "enableViewCulling",
) as HTMLInputElement;
const enableFrustumCullingCheckbox = document.getElementById(
  "enableFrustumCulling",
) as HTMLInputElement;
const clusterDensityInput = document.getElementById(
  "clusterDensity",
) as HTMLInputElement;
const clusterDensityValueSpan = document.getElementById("clusterDensityValue")!;
const cullThresholdInput = document.getElementById(
  "cullThreshold",
) as HTMLInputElement;
const cullThresholdValueSpan = document.getElementById("cullThresholdValue")!;
const clusterCountSpan = document.getElementById("clusterCount")!;
const visibleClustersSpan = document.getElementById("visibleClusters")!;
const frustumCulledSpan = document.getElementById("frustumCulled")!;
const viewCulledSpan = document.getElementById("viewCulled")!;
const densityCulledSpan = document.getElementById("densityCulled")!;

// Plant controls
const plantPresetSelect = document.getElementById(
  "plantPreset",
) as HTMLSelectElement;
const plantSeedInput = document.getElementById("plantSeed") as HTMLInputElement;
const plantQualitySelect = document.getElementById(
  "plantQuality",
) as HTMLSelectElement;
const generatePlantBtn = document.getElementById(
  "generatePlantBtn",
) as HTMLButtonElement;
const randomPlantSeedBtn = document.getElementById(
  "randomPlantSeedBtn",
) as HTMLButtonElement;
const plantLeafCountSpan = document.getElementById("plantLeafCount")!;
const plantVertexCountSpan = document.getElementById("plantVertexCount")!;
const plantTriangleCountSpan = document.getElementById("plantTriangleCount")!;
const plantGenTimeSpan = document.getElementById("plantGenTime")!;

// Rock controls
const rockPresetGroupSelect = document.getElementById(
  "rockPresetGroup",
) as HTMLSelectElement;
const rockPresetSelect = document.getElementById(
  "rockPreset",
) as HTMLSelectElement;
const rockSeedInput = document.getElementById("rockSeed") as HTMLInputElement;
const rockSubdivisionsInput = document.getElementById(
  "rockSubdivisions",
) as HTMLInputElement;
const rockBaseShapeSelect = document.getElementById(
  "rockBaseShape",
) as HTMLSelectElement;
const rockFlatShadingCheckbox = document.getElementById(
  "rockFlatShading",
) as HTMLInputElement;
const rockWireframeCheckbox = document.getElementById(
  "rockWireframe",
) as HTMLInputElement;
const generateRockBtn = document.getElementById(
  "generateRockBtn",
) as HTMLButtonElement;
const randomRockSeedBtn = document.getElementById(
  "randomRockSeedBtn",
) as HTMLButtonElement;
const rockVertexCountSpan = document.getElementById("rockVertexCount")!;
const rockTriangleCountSpan = document.getElementById("rockTriangleCount")!;
const rockGenTimeSpan = document.getElementById("rockGenTime")!;

// Rock advanced controls - Scale
const rockScaleXInput = document.getElementById(
  "rockScaleX",
) as HTMLInputElement;
const rockScaleYInput = document.getElementById(
  "rockScaleY",
) as HTMLInputElement;
const rockScaleZInput = document.getElementById(
  "rockScaleZ",
) as HTMLInputElement;

// Rock advanced controls - Noise
const rockNoiseScaleInput = document.getElementById(
  "rockNoiseScale",
) as HTMLInputElement;
const rockNoiseAmplitudeInput = document.getElementById(
  "rockNoiseAmplitude",
) as HTMLInputElement;
const rockNoiseOctavesInput = document.getElementById(
  "rockNoiseOctaves",
) as HTMLInputElement;
const rockNoiseLacunarityInput = document.getElementById(
  "rockNoiseLacunarity",
) as HTMLInputElement;
const rockNoisePersistenceInput = document.getElementById(
  "rockNoisePersistence",
) as HTMLInputElement;

// Rock advanced controls - Cracks
const rockCrackDepthInput = document.getElementById(
  "rockCrackDepth",
) as HTMLInputElement;
const rockCrackFrequencyInput = document.getElementById(
  "rockCrackFrequency",
) as HTMLInputElement;

// Rock advanced controls - Smoothing
const rockSmoothIterationsInput = document.getElementById(
  "rockSmoothIterations",
) as HTMLInputElement;
const rockSmoothStrengthInput = document.getElementById(
  "rockSmoothStrength",
) as HTMLInputElement;

// Rock advanced controls - Colors
const rockBaseColorInput = document.getElementById(
  "rockBaseColor",
) as HTMLInputElement;
const rockSecondaryColorInput = document.getElementById(
  "rockSecondaryColor",
) as HTMLInputElement;
const rockAccentColorInput = document.getElementById(
  "rockAccentColor",
) as HTMLInputElement;
const rockColorVariationInput = document.getElementById(
  "rockColorVariation",
) as HTMLInputElement;
const rockHeightBlendInput = document.getElementById(
  "rockHeightBlend",
) as HTMLInputElement;
const rockSlopeBlendInput = document.getElementById(
  "rockSlopeBlend",
) as HTMLInputElement;
const rockAOIntensityInput = document.getElementById(
  "rockAOIntensity",
) as HTMLInputElement;

// Rock advanced controls - Material
const rockRoughnessInput = document.getElementById(
  "rockRoughness",
) as HTMLInputElement;
const rockRoughnessVariationInput = document.getElementById(
  "rockRoughnessVariation",
) as HTMLInputElement;
const rockMetalnessInput = document.getElementById(
  "rockMetalness",
) as HTMLInputElement;

// Rock advanced controls - Procedural Texture
const rockColorModeSelect = document.getElementById(
  "rockColorMode",
) as HTMLSelectElement;
const rockTexturePatternSelect = document.getElementById(
  "rockTexturePattern",
) as HTMLSelectElement;
const rockTextureScaleInput = document.getElementById(
  "rockTextureScale",
) as HTMLInputElement;
const rockTextureDetailInput = document.getElementById(
  "rockTextureDetail",
) as HTMLInputElement;
const rockTextureContrastInput = document.getElementById(
  "rockTextureContrast",
) as HTMLInputElement;
const rockTextureBlendInput = document.getElementById(
  "rockTextureBlend",
) as HTMLInputElement;
const rockUVMethodSelect = document.getElementById(
  "rockUVMethod",
) as HTMLSelectElement;

// Building controls
const buildingTypeSelect = document.getElementById(
  "buildingType",
) as HTMLSelectElement;
const buildingSeedInput = document.getElementById(
  "buildingSeed",
) as HTMLInputElement;
const buildingIncludeRoofCheckbox = document.getElementById(
  "buildingIncludeRoof",
) as HTMLInputElement;
const buildingHideRoofsCheckbox = document.getElementById(
  "buildingHideRoofs",
) as HTMLInputElement;
const generateBuildingBtn = document.getElementById(
  "generateBuildingBtn",
) as HTMLButtonElement;
const randomBuildingSeedBtn = document.getElementById(
  "randomBuildingSeedBtn",
) as HTMLButtonElement;
const buildingRoomsSpan = document.getElementById("buildingRooms")!;
const buildingWallsSpan = document.getElementById("buildingWalls")!;
const buildingWindowsSpan = document.getElementById("buildingWindows")!;
const buildingRoofSpan = document.getElementById("buildingRoof")!;
const buildingPropsSpan = document.getElementById("buildingProps")!;
const buildingFootprintSpan = document.getElementById("buildingFootprint")!;

// Town controls
const townSizeSelect = document.getElementById(
  "townSizeSelect",
) as HTMLSelectElement;
const townSeedInput = document.getElementById("townSeed") as HTMLInputElement;
const townShowSafeZoneCheckbox = document.getElementById(
  "townShowSafeZone",
) as HTMLInputElement;
const townShowBuildings3dCheckbox = document.getElementById(
  "townShowBuildings3d",
) as HTMLInputElement;
const generateTownBtn = document.getElementById(
  "generateTownBtn",
) as HTMLButtonElement;
const randomTownSeedBtn = document.getElementById(
  "randomTownSeedBtn",
) as HTMLButtonElement;
const townNameSpan = document.getElementById("townName")!;
const townSizeSpan = document.getElementById("townSize")!;
const townBuildingsSpan = document.getElementById("townBuildings")!;
const townSafeZoneSpan = document.getElementById("townSafeZone")!;

// Grass controls
const grassControls = document.getElementById("grass-controls")!;
const grassStatsPanel = document.getElementById("stats-grass")!;
const grassBiomeSelect = document.getElementById(
  "grassBiome",
) as HTMLSelectElement;
const grassSeedInput = document.getElementById("grassSeed") as HTMLInputElement;
const grassDensityInput = document.getElementById(
  "grassDensity",
) as HTMLInputElement;
const grassPatchSizeInput = document.getElementById(
  "grassPatchSize",
) as HTMLInputElement;
const grassBladeHeightInput = document.getElementById(
  "grassBladeHeight",
) as HTMLInputElement;
const generateGrassBtn = document.getElementById(
  "generateGrassBtn",
) as HTMLButtonElement;
const randomGrassSeedBtn = document.getElementById(
  "randomGrassSeedBtn",
) as HTMLButtonElement;
const grassBladeCountSpan = document.getElementById("grassBladeCount")!;
const grassTileSizeSpan = document.getElementById("grassTileSize")!;
const grassGenTimeSpan = document.getElementById("grassGenTime")!;
const grassImpostorStatusSpan = document.getElementById("grassImpostorStatus")!;

// Grass impostor controls
const grassImpostorGridSizeInput = document.getElementById(
  "grassImpostorGridSize",
) as HTMLInputElement;
const grassImpostorAtlasSizeSelect = document.getElementById(
  "grassImpostorAtlasSize",
) as HTMLSelectElement;
const bakeGrassImpostorBtn = document.getElementById(
  "bakeGrassImpostorBtn",
) as HTMLButtonElement;
const showGrassImpostorCheckbox = document.getElementById(
  "showGrassImpostor",
) as HTMLInputElement;
const showGrassAtlasCheckbox = document.getElementById(
  "showGrassAtlas",
) as HTMLInputElement;
const hideGrassTileCheckbox = document.getElementById(
  "hideGrassTile",
) as HTMLInputElement;

// Grass field controls
const grassFieldSizeInput = document.getElementById(
  "grassFieldSize",
) as HTMLInputElement;
const grassFieldSpacingInput = document.getElementById(
  "grassFieldSpacing",
) as HTMLInputElement;
const showGrassFieldCheckbox = document.getElementById(
  "showGrassField",
) as HTMLInputElement;
const grassFieldTileCountSpan = document.getElementById("grassFieldTileCount")!;

// Grass LOD system controls
const grassLodDistanceInput = document.getElementById(
  "grassLodDistance",
) as HTMLInputElement;
const generateGrassLodFieldBtn = document.getElementById(
  "generateGrassLodFieldBtn",
) as HTMLButtonElement;
const showGrassLod0Checkbox = document.getElementById(
  "showGrassLod0",
) as HTMLInputElement;
const showGrassLod1Checkbox = document.getElementById(
  "showGrassLod1",
) as HTMLInputElement;
const grassLod0CountSpan = document.getElementById("grassLod0Count")!;
const grassLod1CountSpan = document.getElementById("grassLod1Count")!;

// Navigation controls
const navigationControls = document.getElementById("navigation-controls")!;
const navOptionsPanel = document.getElementById("nav-options")!;
const navShowNavigationCheckbox = document.getElementById(
  "navShowNavigation",
) as HTMLInputElement;
const navShowWalkableTilesCheckbox = document.getElementById(
  "navShowWalkableTiles",
) as HTMLInputElement;
const navShowDoorsCheckbox = document.getElementById(
  "navShowDoors",
) as HTMLInputElement;
const navShowStairsCheckbox = document.getElementById(
  "navShowStairs",
) as HTMLInputElement;
const navShowWallsCheckbox = document.getElementById(
  "navShowWalls",
) as HTMLInputElement;
const navShowEntryPointsCheckbox = document.getElementById(
  "navShowEntryPoints",
) as HTMLInputElement;
const navShowDemoPathsCheckbox = document.getElementById(
  "navShowDemoPaths",
) as HTMLInputElement;
const navClearPathBtn = document.getElementById(
  "navClearPath",
) as HTMLButtonElement;
const navFloorsSpan = document.getElementById("navFloors")!;
const navWalkableSpan = document.getElementById("navWalkable")!;
const navWallsSpan = document.getElementById("navWalls")!;
const navDoorsSpan = document.getElementById("navDoors")!;
const navStairsSpan = document.getElementById("navStairs")!;

// Performance stats DOM elements
const fpsSpan = document.getElementById("fps")!;
const drawCallsSpan = document.getElementById("drawCalls")!;
const materialsSpan = document.getElementById("materials")!;
const trisPerFrameSpan = document.getElementById("trisPerFrame")!;
const instancedModeSpan = document.getElementById("instancedMode")!;
const leafInstancesSpan = document.getElementById("leafInstances")!;

// Impostor DOM elements
const impostorGridSizeXInput = document.getElementById(
  "impostorGridSizeX",
) as HTMLInputElement;
const impostorGridSizeYInput = document.getElementById(
  "impostorGridSizeY",
) as HTMLInputElement;
const impostorAtlasSizeSelect = document.getElementById(
  "impostorAtlasSize",
) as HTMLSelectElement;
const impostorSourceSelect = document.getElementById(
  "impostorSource",
) as HTMLSelectElement;
const exportFlattenedGlbBtn = document.getElementById(
  "exportFlattenedGlbBtn",
) as HTMLButtonElement;
const bakeImpostorBtn = document.getElementById(
  "bakeImpostorBtn",
) as HTMLButtonElement;
const showImpostorCheckbox = document.getElementById(
  "showImpostor",
) as HTMLInputElement;
const showAtlasCheckbox = document.getElementById(
  "showAtlas",
) as HTMLInputElement;
const impostorAlphaThresholdInput = document.getElementById(
  "impostorAlphaThreshold",
) as HTMLInputElement;
const alphaThresholdValueSpan = document.getElementById(
  "alphaThresholdValue",
) as HTMLSpanElement;
const showNormalAtlasCheckbox = document.getElementById(
  "showNormalAtlas",
) as HTMLInputElement;
const hideTreeCheckbox = document.getElementById(
  "hideTree",
) as HTMLInputElement;
const impostorStatusSpan = document.getElementById("impostorStatus")!;
const showForestCheckbox = document.getElementById(
  "showForest",
) as HTMLInputElement;
const forestTreeCountSpan = document.getElementById("forestTreeCount");

// FPS tracking
let lastFrameTime = performance.now();
let frameCount = 0;
let fps = 0;
let fpsUpdateTime = 0;

// Three.js setup
let scene: THREE.Scene;
let camera: THREE.PerspectiveCamera;
let renderer: THREE_WEBGPU.WebGPURenderer;
let controls: OrbitControls;
let directionalLight: THREE.DirectionalLight;
let ambientLight: THREE.AmbientLight;
let currentTree: TreeMeshResult | null = null;
let generator: TreeGenerator | null = null;
let currentPlant: PlantGenerationResult | null = null;
let currentRock: GeneratedRock | null = null;
let currentBuilding: GeneratedBuilding | null = null;
let currentTown: GeneratedTown | null = null;
let rockGenerator: RockGenerator | null = null;
let buildingGenerator: BuildingGenerator | null = null;
let townGroup: THREE.Group | null = null;

// Grass state
let currentGrass: GrassFieldResult | null = null;
let grassImpostor: OctahedralImpostor | null = null;
let grassImpostorInstance: ExtendedImpostorInstance | null = null;
let grassImpostorBakeResult: ImpostorBakeResult | null = null;
let grassAtlasPlane: THREE.Mesh | null = null;
let grassBakingSource: THREE.Group | null = null;
let grassFieldInstancedMesh: {
  mesh: THREE.InstancedMesh;
  material: {
    updateView: (faceIndices: number[], faceWeights: number[]) => void;
    dispose: () => void;
  };
  count: number;
  update: (camera: THREE.Camera) => void;
  dispose: () => void;
} | null = null;

// LOD system state - geometry near, impostor far
interface GrassLodTile {
  x: number;
  z: number;
  distanceFromCamera: number;
  variationIndex: number; // 0-7: which rotation/mirror variant
}

interface GrassLodSystem {
  // LOD0: Single InstancedMesh with transforms baked into matrices (1 draw call)
  lod0Mesh: THREE.InstancedMesh | null;
  lod0Geometry: THREE.BufferGeometry | null;
  lod0Material: THREE.Material | null;
  // LOD1: Impostor instances (1 draw call)
  lod1Mesh: {
    mesh: THREE.InstancedMesh;
    material: {
      updateView: (faceIndices: number[], faceWeights: number[]) => void;
      dispose: () => void;
    };
    count: number;
    update: (camera: THREE.Camera) => void;
    dispose: () => void;
  } | null;
  // Grid data
  tiles: GrassLodTile[];
  gridSize: number;
  spacing: number;
  lodDistance: number;
  tileSize: number;
  tileHeight: number;
  // Instance assignment
  lod0Visible: number;
  lod1Visible: number;
}

let grassLodSystem: GrassLodSystem | null = null;

type GeneratorMode = "tree" | "plant" | "rock" | "building" | "town" | "grass";
let currentMode: GeneratorMode = "tree";

// Navigation visualization
let navigationVisualizer: NavigationVisualizer | null = null;

// Impostor state
let treeImpostor: TreeImpostor | null = null;
// Extended type to include lighting methods
type ExtendedImpostorInstance = ImpostorInstance & {
  updateLighting?: (lighting: {
    lightDirection?: THREE.Vector3;
    lightColor?: THREE.Vector3;
    lightIntensity?: number;
    ambientColor?: THREE.Vector3;
    ambientIntensity?: number;
  }) => void;
};
let impostorInstance: ExtendedImpostorInstance | null = null;
let impostorLabel: THREE.Sprite | null = null;
let originalTreeLabel: THREE.Sprite | null = null;
let atlasPlane: THREE.Mesh | null = null;
let normalAtlasPlane: THREE.Mesh | null = null;
let debugImpostor: OctahedralImpostor | null = null;
let debugBaker: ImpostorBaker | null = null;

// Forest test state (1000 impostors) - INSTANCED for single draw call
let forestInstancedMesh: {
  mesh: THREE.InstancedMesh;
  material: THREE.ShaderMaterial;
  positions: THREE.Vector3[];
  scales: number[];
  setPosition: (index: number, position: THREE.Vector3) => void;
  update: (camera: THREE.Camera) => void;
  dispose: () => void;
} | null = null;
const FOREST_COUNT = 1000;
const FOREST_RADIUS = 150; // Spread radius in meters

// Legacy - keep for compatibility but not used in new instanced mode
let forestGroup: THREE.Group | null = null;
let forestInstances: ExtendedImpostorInstance[] = [];
let flattenedSource: THREE.Group | null = null;
let debugCube: THREE.Mesh | null = null;

// Leaf Cluster visualization state
interface ClusterData {
  center: THREE.Vector3;
  size: { width: number; height: number };
  density: number;
  leafCount: number;
  octreeCell: number; // 0-63 for 4x4x4 grid
}
let clusterMesh: THREE.InstancedMesh | null = null;
let octreeCellMesh: THREE.LineSegments | null = null;
let clusterData: ClusterData[] = [];
let clusterStats = {
  total: 0,
  visible: 0,
  frustumCulled: 0,
  viewCulled: 0,
  densityCulled: 0,
};

// LOD display state (LOD0, LOD1, LOD2 meshes shown alongside impostor)
interface LODDisplayMesh {
  group: THREE.Group;
  label: THREE.Sprite;
}
let lodDisplayMeshes: {
  lod0: LODDisplayMesh | null;
  lod1: LODDisplayMesh | null;
  lod2: LODDisplayMesh | null;
} = {
  lod0: null,
  lod1: null,
  lod2: null,
};

type ImpostorSourceMode = "tree" | "flattened" | "debugCube";

/**
 * Initialize the Three.js scene with WebGPU renderer.
 */
async function initScene(): Promise<void> {
  // Scene
  scene = new THREE.Scene();
  scene.background = new THREE.Color(0x1a1a2e);

  // Camera
  camera = new THREE.PerspectiveCamera(
    60,
    canvasContainer.clientWidth / canvasContainer.clientHeight,
    0.1,
    1000,
  );
  camera.position.set(15, 10, 15);

  // WebGPU Renderer
  renderer = new THREE_WEBGPU.WebGPURenderer({ antialias: true });
  renderer.setSize(canvasContainer.clientWidth, canvasContainer.clientHeight);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

  // Initialize WebGPU - this is async and required before rendering
  await renderer.init();

  canvasContainer.appendChild(renderer.domElement);

  // Controls
  controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  controls.dampingFactor = 0.05;
  controls.autoRotate = false;
  controls.target.set(0, 5, 0);

  // Lights
  ambientLight = new THREE.AmbientLight(0xffffff, 0.0);
  scene.add(ambientLight);

  directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
  directionalLight.position.set(20, 30, 20);
  directionalLight.castShadow = true;
  directionalLight.shadow.mapSize.width = 2048;
  directionalLight.shadow.mapSize.height = 2048;
  directionalLight.shadow.camera.near = 0.5;
  directionalLight.shadow.camera.far = 100;
  directionalLight.shadow.camera.left = -30;
  directionalLight.shadow.camera.right = 30;
  directionalLight.shadow.camera.top = 30;
  directionalLight.shadow.camera.bottom = -30;
  scene.add(directionalLight);

  const fillLight = new THREE.DirectionalLight(0x87ceeb, 0.3);
  fillLight.position.set(-10, 10, -10);
  scene.add(fillLight);

  // Ground plane
  const groundGeometry = new THREE.PlaneGeometry(50, 50);
  const groundMaterial = new THREE.MeshStandardMaterial({
    color: 0x3d5c3d,
    roughness: 0.9,
  });
  const ground = new THREE.Mesh(groundGeometry, groundMaterial);
  ground.rotation.x = -Math.PI / 2;
  ground.receiveShadow = true;
  scene.add(ground);

  // Grid helper
  const gridHelper = new THREE.GridHelper(50, 50, 0x444444, 0x333333);
  gridHelper.position.y = 0.01;
  scene.add(gridHelper);

  // Handle resize
  window.addEventListener("resize", onWindowResize);

  // Create navigation visualizer
  navigationVisualizer = new NavigationVisualizer(scene, camera);

  // Handle navigation click events (left click = point A, right click = point B)
  // Use click detection that distinguishes between clicks and drags (for OrbitControls compatibility)
  let mouseDownPos: { x: number; y: number; button: number } | null = null;
  const CLICK_THRESHOLD = 5; // pixels - if mouse moves more than this, it's a drag

  renderer.domElement.addEventListener("mousedown", (e: MouseEvent) => {
    if (!navigationVisualizer?.isEnabled()) return;
    if (currentMode !== "building" && currentMode !== "town") return;
    if (e.button !== 0 && e.button !== 2) return;

    mouseDownPos = { x: e.clientX, y: e.clientY, button: e.button };
  });

  renderer.domElement.addEventListener("mouseup", (e: MouseEvent) => {
    if (!mouseDownPos) return;
    if (!navigationVisualizer?.isEnabled()) return;
    if (currentMode !== "building" && currentMode !== "town") return;

    // Check if this was a click (not a drag)
    const dx = e.clientX - mouseDownPos.x;
    const dy = e.clientY - mouseDownPos.y;
    const distance = Math.sqrt(dx * dx + dy * dy);

    if (distance < CLICK_THRESHOLD && e.button === mouseDownPos.button) {
      navigationVisualizer.handleClick(e, renderer.domElement, e.button);
      updateNavigationStats();
    }

    mouseDownPos = null;
  });

  // Prevent context menu on right-click when navigation is enabled
  renderer.domElement.addEventListener("contextmenu", (e: MouseEvent) => {
    if (navigationVisualizer?.isEnabled()) {
      e.preventDefault();
    }
  });

  // Hide loading
  loading.style.display = "none";
}

/**
 * Handle window resize.
 */
function onWindowResize(): void {
  camera.aspect = canvasContainer.clientWidth / canvasContainer.clientHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(canvasContainer.clientWidth, canvasContainer.clientHeight);
}

function setVisible(element: HTMLElement, visible: boolean): void {
  element.style.display = visible ? "block" : "none";
}

function resetStats(): void {
  plantLeafCountSpan.textContent = "-";
  plantVertexCountSpan.textContent = "-";
  plantTriangleCountSpan.textContent = "-";
  plantGenTimeSpan.textContent = "-";

  rockVertexCountSpan.textContent = "-";
  rockTriangleCountSpan.textContent = "-";
  rockGenTimeSpan.textContent = "-";

  buildingRoomsSpan.textContent = "-";
  buildingWallsSpan.textContent = "-";
  buildingWindowsSpan.textContent = "-";
  buildingRoofSpan.textContent = "-";
  buildingPropsSpan.textContent = "-";
  buildingFootprintSpan.textContent = "-";

  townNameSpan.textContent = "-";
  townSizeSpan.textContent = "-";
  townBuildingsSpan.textContent = "-";
  townSafeZoneSpan.textContent = "-";

  grassBladeCountSpan.textContent = "-";
  grassTileSizeSpan.textContent = "-";
  grassGenTimeSpan.textContent = "-";
  grassImpostorStatusSpan.textContent = "Not baked";
}

function parseGeneratorMode(value: string | null): GeneratorMode | null {
  if (
    value === "tree" ||
    value === "plant" ||
    value === "rock" ||
    value === "building" ||
    value === "town" ||
    value === "grass"
  ) {
    return value;
  }
  return null;
}

function updateActiveTab(mode: GeneratorMode): void {
  for (const button of generatorTabButtons) {
    const value = parseGeneratorMode(button.getAttribute("data-mode"));
    const isActive = value === mode;
    button.classList.toggle("active", isActive);
  }
}

function setMode(mode: GeneratorMode): void {
  currentMode = mode;
  updateActiveTab(mode);

  const titleMap: Record<GeneratorMode, string> = {
    tree: "Tree Generator",
    plant: "Plant Generator",
    rock: "Rock Generator",
    building: "Building Generator",
    town: "Town Generator",
    grass: "Grass Generator",
  };
  generatorTitle.textContent = titleMap[mode];

  setVisible(treeControls, mode === "tree");
  setVisible(plantControls, mode === "plant");
  setVisible(rockControls, mode === "rock");
  setVisible(buildingControls, mode === "building");
  setVisible(townControls, mode === "town");
  setVisible(grassControls, mode === "grass");

  setVisible(treeStatsPanel, mode === "tree");
  setVisible(plantStatsPanel, mode === "plant");
  setVisible(rockStatsPanel, mode === "rock");
  setVisible(buildingStatsPanel, mode === "building");
  setVisible(townStatsPanel, mode === "town");
  setVisible(grassStatsPanel, mode === "grass");

  setVisible(treeDisplayControls, mode === "tree");

  // Show navigation controls for building/town modes
  const showNavigation = mode === "building" || mode === "town";
  setVisible(navigationControls, showNavigation);

  // Disable navigation when switching away from building/town
  if (!showNavigation && navigationVisualizer) {
    navigationVisualizer.setEnabled(false);
    navShowNavigationCheckbox.checked = false;
    setVisible(navOptionsPanel, false);
  }

  resetStats();
}

function disposeObject3D(object: THREE.Object3D): void {
  object.traverse((node) => {
    if (node instanceof THREE.Mesh) {
      node.geometry?.dispose();
      const material = node.material;
      if (Array.isArray(material)) {
        for (const mat of material) {
          mat.dispose();
        }
      } else {
        material.dispose();
      }
    }
  });
}

function disposeGroup(group: THREE.Group): void {
  group.traverse((node) => {
    if (node instanceof THREE.Mesh) {
      node.geometry?.dispose();
      const material = node.material;
      if (Array.isArray(material)) {
        for (const mat of material) {
          mat.dispose();
        }
      } else {
        material.dispose();
      }
    }
  });
  group.clear();
}

function fitCameraToObject(object: THREE.Object3D, padding = 1.2): void {
  const box = new THREE.Box3().setFromObject(object);
  const size = box.getSize(new THREE.Vector3());
  const center = box.getCenter(new THREE.Vector3());
  const maxDim = Math.max(size.x, size.y, size.z);
  const distance = Math.max(4, maxDim * padding);

  controls.target.copy(center);
  camera.position.set(
    center.x + distance,
    center.y + distance * 0.6,
    center.z + distance,
  );
  camera.updateProjectionMatrix();
}

function disposeFlattenedSource(): void {
  if (flattenedSource) {
    disposeObject3D(flattenedSource);
    flattenedSource = null;
  }
}

/**
 * Dispose LOD display meshes.
 */
function disposeLODDisplayMeshes(): void {
  // Hull meshes don't need tracking

  for (const key of ["lod0", "lod1", "lod2"] as const) {
    const lod = lodDisplayMeshes[key];
    if (lod) {
      scene.remove(lod.group);
      scene.remove(lod.label);
      disposeObject3D(lod.group);
      lod.label.material.dispose();
      lodDisplayMeshes[key] = null;
    }
  }
  // Dispose original tree label
  if (originalTreeLabel) {
    scene.remove(originalTreeLabel);
    originalTreeLabel.material.dispose();
    originalTreeLabel = null;
  }
}

/**
 * Create a text label sprite.
 */
function createTextLabel(
  text: string,
  color: string = "#ffffff",
): THREE.Sprite {
  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d")!;
  canvas.width = 256;
  canvas.height = 64;

  ctx.fillStyle = "rgba(0, 0, 0, 0.7)";
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  ctx.font = "bold 32px Arial";
  ctx.fillStyle = color;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(text, canvas.width / 2, canvas.height / 2);

  const texture = new THREE.CanvasTexture(canvas);
  const material = new THREE.SpriteMaterial({
    map: texture,
    transparent: true,
  });
  const sprite = new THREE.Sprite(material);
  sprite.scale.set(4, 1, 1);

  return sprite;
}

/**
 * Cap cluster count by keeping the largest billboards.
 */
function limitClusters(
  clusters: LeafCluster[],
  maxCount: number,
): LeafCluster[] {
  if (clusters.length <= maxCount) return clusters;
  return [...clusters]
    .sort((a, b) => b.width * b.height - a.width * a.height)
    .slice(0, maxCount);
}

// No longer using billboard cards - using hull meshes instead

/**
 * Create a procedural foliage cluster material using TSL.
 * Uses noise-based pattern to create a dense leafy appearance.
 */
function createLeafClusterMaterial(
  color: THREE.Color,
  opacity: number = 0.9,
): THREE.Material {
  const material = new MeshBasicNodeMaterial();
  material.side = THREE.DoubleSide;
  material.transparent = true;
  material.depthWrite = false;

  const uColor = uniform(color);
  const uOpacity = uniform(float(opacity));

  // Hash function for pseudo-random values
  const hash = Fn(([p]: [ReturnType<typeof vec2>]) => {
    const dot1 = add(mul(p.x, 127.1), mul(p.y, 311.7));
    return fract(mul(sin(dot1), 43758.5453));
  });

  // Value noise for organic variation
  const noise = Fn(([p]: [ReturnType<typeof vec2>]) => {
    const i = floor(p);
    const f = fract(p);
    const u = mul(mul(f, f), sub(3.0, mul(2.0, f)));

    const a = hash(i);
    const b = hash(add(i, vec2(1.0, 0.0)));
    const c = hash(add(i, vec2(0.0, 1.0)));
    const d = hash(add(i, vec2(1.0, 1.0)));

    const ab = add(a, mul(sub(b, a), u.x));
    const cd = add(c, mul(sub(d, c), u.x));
    return add(ab, mul(sub(cd, ab), u.y));
  });

  // Multi-octave FBM noise for foliage-like pattern
  const fbm = Fn(([p]: [ReturnType<typeof vec2>]) => {
    const n1 = noise(p);
    const n2 = mul(noise(mul(p, 2.0)), 0.5);
    const n3 = mul(noise(mul(p, 4.0)), 0.25);
    const n4 = mul(noise(mul(p, 8.0)), 0.125);
    return mul(add(add(add(n1, n2), n3), n4), 0.533); // Normalize to ~0-1
  });

  // Create DENSE foliage silhouette - fills most of card with irregular leafy edge
  const foliageSilhouette = Fn(() => {
    const uvCoord = uv();

    // Center coordinates (-0.5 to 0.5)
    const cx = sub(uvCoord.x, 0.5);
    const cy = sub(uvCoord.y, 0.5);

    // Distance from center (0 at center, 0.5 at corners of unit square)
    const dist = sqrt(add(mul(cx, cx), mul(cy, cy)));

    // Create irregular edge using multi-scale noise
    // Base "radius" is large - we want to fill most of the card
    const baseRadius = 0.42;

    // Add noise for organic, leafy edge
    const edgeNoise1 = fbm(mul(uvCoord, 4.0));
    const edgeNoise2 = mul(noise(mul(uvCoord, 12.0)), 0.3);

    // Combine noises for complex edge
    const edgeVariation = add(
      mul(sub(edgeNoise1, 0.5), 0.12),
      mul(sub(edgeNoise2, 0.5), 0.08),
    );

    // Final radius with variation
    const finalRadius = add(baseRadius, edgeVariation);

    // Soft edge transition (wider for softer look)
    const edgeMask = sub(
      1.0,
      smoothstep(sub(finalRadius, 0.03), finalRadius, dist),
    );

    // Add very subtle internal variation (NOT holes, just shading)
    const internalNoise = noise(mul(uvCoord, 20.0));
    const internalVariation = add(0.85, mul(internalNoise, 0.15));

    return mul(edgeMask, internalVariation);
  });

  // Color variation for depth and natural look
  const foliageColor = Fn(() => {
    const uvCoord = uv();

    // Multi-scale noise for color variation
    const colorNoise1 = noise(mul(uvCoord, 6.0));
    const colorNoise2 = noise(mul(uvCoord, 15.0));

    // Combine for organic variation
    const variation = add(
      mul(sub(colorNoise1, 0.5), 0.15),
      mul(sub(colorNoise2, 0.5), 0.08),
    );

    // Slight darkening toward center (depth illusion)
    const cx = sub(uvCoord.x, 0.5);
    const cy = sub(uvCoord.y, 0.5);
    const centerDist = sqrt(add(mul(cx, cx), mul(cy, cy)));
    const centerDarken = mul(sub(1.0, smoothstep(0.0, 0.35, centerDist)), 0.1);

    // Apply variation: vary green more than other channels
    const variedColor = add(
      uColor,
      vec3(
        sub(mul(variation, 0.4), centerDarken),
        sub(variation, mul(centerDarken, 0.5)),
        mul(variation, -0.3),
      ),
    );

    return variedColor;
  });

  const alpha = foliageSilhouette();

  material.colorNode = foliageColor();
  material.opacityNode = mul(alpha, uOpacity);

  return material;
}

/**
 * Create a material that draws projected leaves on a cross-section card.
 * Projects 3D leaf positions onto the card plane and draws leaves there.
 */
function createProjectedLeafMaterial(
  leaves: LeafData[],
  cardAngle: number,
  boundsCenter: THREE.Vector3,
  boundsSize: THREE.Vector3,
  color: THREE.Color,
  opacity: number,
): THREE.Material {
  // Project leaves onto this card's plane (rotate by -angle to get local coords)
  const cosA = Math.cos(-cardAngle);
  const sinA = Math.sin(-cardAngle);

  // Calculate projected positions normalized to 0-1 UV space
  const projectedLeaves: { u: number; v: number }[] = [];

  for (const leaf of leaves) {
    // Convert to correct coords (Y/Z swap)
    const wx = leaf.position.x;
    const wy = leaf.position.z; // Height
    const wz = leaf.position.y;

    // Translate to center
    const lx = wx - boundsCenter.x;
    const ly = wy - boundsCenter.y;
    const lz = wz - boundsCenter.z;

    // Rotate around Y to align with card plane
    const rx = lx * cosA - lz * sinA;
    // const rz = lx * sinA + lz * cosA; // depth - used for culling

    // Normalize to UV (0-1)
    const cardWidth = Math.max(boundsSize.x, boundsSize.z) * 1.1;
    const cardHeight = boundsSize.y * 1.1;

    const u = rx / cardWidth + 0.5;
    const v = ly / cardHeight + 0.5;

    // Only include leaves that project onto the card
    if (u >= 0 && u <= 1 && v >= 0 && v <= 1) {
      projectedLeaves.push({ u, v });
    }
  }

  console.log(
    `[Projected Leaves] Card at ${((cardAngle * 180) / Math.PI).toFixed(0)}°: ${projectedLeaves.length} leaves projected`,
  );

  // Create a simple instanced points material wouldn't work well...
  // Instead, use a data texture to store leaf positions
  const texSize = 64; // 64x64 texture = 4096 potential leaf slots
  const data = new Uint8Array(texSize * texSize * 4);

  // Mark leaf positions in the texture (simple density map)
  for (const leaf of projectedLeaves) {
    const tx = Math.floor(leaf.u * texSize);
    const ty = Math.floor(leaf.v * texSize);
    const idx = (ty * texSize + tx) * 4;
    // Accumulate density
    data[idx] = Math.min(255, data[idx] + 80); // R
    data[idx + 1] = Math.min(255, data[idx + 1] + 100); // G
    data[idx + 2] = Math.min(255, data[idx + 2] + 60); // B
    data[idx + 3] = Math.min(255, data[idx + 3] + 100); // A
  }

  const leafDensityTex = new THREE.DataTexture(
    data,
    texSize,
    texSize,
    THREE.RGBAFormat,
  );
  leafDensityTex.needsUpdate = true;
  leafDensityTex.magFilter = THREE.LinearFilter;
  leafDensityTex.minFilter = THREE.LinearFilter;

  // Use the density texture as alpha
  const material = new THREE.MeshBasicMaterial({
    map: leafDensityTex,
    transparent: true,
    opacity: opacity,
    side: THREE.DoubleSide,
    depthWrite: false,
    alphaTest: 0.1,
  });

  return material;
}

/**
 * Create cross-section billboard cards for tree LOD.
 * Uses 2-3 intersecting vertical planes through the tree center.
 * Projects actual leaf positions onto each card.
 *
 * NOTE: The tree generator stores leaf positions with height in Z, not Y!
 */
function createCrossSectionCards(
  leaves: LeafData[],
  color: THREE.Color,
  opacity: number,
  numPlanes: number = 2, // 2 planes = X shape, 3 planes = * shape
): THREE.Group {
  const group = new THREE.Group();

  if (leaves.length === 0) return group;

  // Calculate bounds from leaf positions (with Y/Z swap)
  const leafBounds = new THREE.Box3();
  for (const leaf of leaves) {
    leafBounds.expandByPoint(
      new THREE.Vector3(
        leaf.position.x,
        leaf.position.z, // Height stored in Z
        leaf.position.y, // Horizontal stored in Y
      ),
    );
  }

  const boundsSize = new THREE.Vector3();
  leafBounds.getSize(boundsSize);
  const boundsCenter = new THREE.Vector3();
  leafBounds.getCenter(boundsCenter);

  console.log(`[Cross Cards] Creating ${numPlanes} cross-section planes`);
  console.log(
    `[Cross Cards] Bounds: size=(${boundsSize.x.toFixed(2)}, ${boundsSize.y.toFixed(2)}, ${boundsSize.z.toFixed(2)})`,
  );
  console.log(
    `[Cross Cards] Center: (${boundsCenter.x.toFixed(2)}, ${boundsCenter.y.toFixed(2)}, ${boundsCenter.z.toFixed(2)})`,
  );

  // Card dimensions - cover the full foliage area
  const cardWidth = Math.max(boundsSize.x, boundsSize.z) * 1.1;
  const cardHeight = boundsSize.y * 1.1;

  // Create intersecting planes at equal angles
  const angleStep = Math.PI / numPlanes;

  for (let i = 0; i < numPlanes; i++) {
    const angle = i * angleStep;

    // Create material with projected leaves for this angle
    const material = createProjectedLeafMaterial(
      leaves,
      angle,
      boundsCenter,
      boundsSize,
      color,
      opacity,
    );

    // Create vertical plane
    const geometry = new THREE.PlaneGeometry(cardWidth, cardHeight);
    const mesh = new THREE.Mesh(geometry, material);

    // Position at center of foliage
    mesh.position.copy(boundsCenter);

    // Rotate around Y axis to create cross pattern
    mesh.rotation.y = angle;

    group.add(mesh);
    console.log(
      `[Cross Cards] Plane ${i}: angle=${((angle * 180) / Math.PI).toFixed(0)}°`,
    );
  }

  return group;
}

/**
 * Create proper billboard cluster cards with TSL procedural foliage material.
 * Handles Y/Z coordinate swap (tree generator uses Z-up, Three.js uses Y-up).
 *
 * Creates 2-3 intersecting cards per cluster for better 3D coverage.
 */
function createClusterCardsFromClusters(
  clusters: LeafCluster[],
  color: THREE.Color,
  opacity: number,
  cardsPerCluster: number = 2,
): THREE.Group {
  const group = new THREE.Group();
  group.name = "ClusterCards";

  // Create procedural foliage material
  const material = createLeafClusterMaterial(color, opacity);

  // Debug: log cluster positions (now in Y-up format after leaf conversion)
  if (clusters.length > 0) {
    console.log("[ClusterCards] Sample cluster positions (Y-up):", {
      first: clusters[0].center.toArray().map((v: number) => v.toFixed(2)),
      last: clusters[clusters.length - 1].center
        .toArray()
        .map((v: number) => v.toFixed(2)),
      count: clusters.length,
    });
  }

  for (const cluster of clusters) {
    // Cluster centers are now in Y-up format (converted leaves were passed to generator)
    const centerX = cluster.center.x;
    const centerY = cluster.center.y;
    const centerZ = cluster.center.z;

    // Scale up cards by 20% for better overlap coverage
    const cardWidth = cluster.width * 1.2;
    const cardHeight = cluster.height * 1.2;

    // Create multiple intersecting planes for 3D effect
    for (let i = 0; i < cardsPerCluster; i++) {
      const angle = (i / cardsPerCluster) * Math.PI;

      const geometry = new THREE.PlaneGeometry(cardWidth, cardHeight);

      const mesh = new THREE.Mesh(geometry, material);
      mesh.position.set(centerX, centerY, centerZ);
      mesh.rotation.y = angle;

      group.add(mesh);
    }
  }

  console.log(
    `[ClusterCards] Created ${clusters.length * cardsPerCluster} cards from ${clusters.length} clusters`,
  );

  return group;
}

/**
 * Create simple vertical billboard cards at cluster positions (legacy).
 */
function createSimpleClusterCards(
  clusters: LeafCluster[],
  color: THREE.Color,
  opacity: number,
): THREE.Group {
  const group = new THREE.Group();
  const material = new THREE.MeshBasicMaterial({
    color,
    opacity,
    transparent: true,
    side: THREE.DoubleSide,
    depthWrite: false,
  });

  for (const cluster of clusters) {
    const geometry = new THREE.PlaneGeometry(cluster.width, cluster.height);
    const mesh = new THREE.Mesh(geometry, material);

    // Y/Z swap for coordinate system
    mesh.position.set(
      cluster.center.x,
      cluster.center.z, // Z becomes Y (height)
      -cluster.center.y, // Y becomes -Z
    );

    group.add(mesh);
  }

  return group;
}

/**
 * Create LOD display meshes to show alongside the impostor.
 * LOD0: Full tree (trunk + all branches + individual leaves)
 * LOD1: Trunk + primary branches + leaf cluster cards
 * LOD2: Trunk only + leaf cluster cards
 */
async function createLODDisplayMeshes(): Promise<void> {
  if (!currentTree || !generator) return;

  disposeLODDisplayMeshes();

  // Get tree bounding box for positioning
  const treeBox = new THREE.Box3().setFromObject(currentTree.group);
  const treeSize = treeBox.getSize(new THREE.Vector3());
  const treeCenter = treeBox.getCenter(new THREE.Vector3());

  // Spacing between LOD displays
  const spacing = Math.max(treeSize.x + 3, 5); // Minimum 5 units spacing

  // Get the current tree's seed for regenerating LODs consistently
  const treeData = generator.getLastTreeData();
  const seed = treeData?.seed ?? 12345;
  const params = generator.getParams();
  const leaves = treeData?.leaves ?? [];

  // Debug: Log tree structure
  console.log("[LOD Display] Tree structure:", {
    branchCount: currentTree.branches.length,
    hasLeaves: !!currentTree.leaves,
    hasBlossoms: !!currentTree.blossoms,
    leafCount: leaves.length,
    treeSize: {
      x: treeSize.x.toFixed(2),
      y: treeSize.y.toFixed(2),
      z: treeSize.z.toFixed(2),
    },
    seed,
  });

  // Add label for original tree at position 0
  originalTreeLabel = createTextLabel("Original", "#ffffff");
  originalTreeLabel.position.set(0, treeCenter.y + treeSize.y / 2 + 2, 0);
  scene.add(originalTreeLabel);

  // LOD0: Full tree clone (positioned at x = spacing to the right)
  const lod0Group = currentTree.group.clone();
  lod0Group.position.x = spacing;
  scene.add(lod0Group);

  const lod0Label = createTextLabel("LOD0", "#00ff00");
  lod0Label.position.set(spacing, treeCenter.y + treeSize.y / 2 + 2, 0);
  scene.add(lod0Label);

  lodDisplayMeshes.lod0 = { group: lod0Group, label: lod0Label };

  // Generate leaf clusters for LOD1
  let clusterResult: LeafClusterResult | null = null;

  // Convert leaves from generator format (Z=height) to Three.js Y-up format
  // This is needed because LeafClusterGenerator assumes Y=height
  const convertedLeaves = leaves.map((leaf) => ({
    ...leaf,
    position: new THREE.Vector3(
      leaf.position.x,
      leaf.position.z, // Z (height) -> Y
      leaf.position.y, // Y (depth) -> Z
    ),
    direction: new THREE.Vector3(
      leaf.direction.x,
      leaf.direction.z,
      leaf.direction.y,
    ),
  }));

  if (leaves.length > 0) {
    // DEBUG: Log actual leaf positions
    const leafBounds = new THREE.Box3();
    for (const leaf of leaves) {
      leafBounds.expandByPoint(leaf.position);
    }
    const convertedBounds = new THREE.Box3();
    for (const leaf of convertedLeaves) {
      convertedBounds.expandByPoint(leaf.position);
    }
    console.log("[LOD Display] LEAF DEBUG - COORDINATES:", {
      leafCount: leaves.length,
      rawBounds: {
        X: `${leafBounds.min.x.toFixed(2)} to ${leafBounds.max.x.toFixed(2)}`,
        Y: `${leafBounds.min.y.toFixed(2)} to ${leafBounds.max.y.toFixed(2)}`,
        Z: `${leafBounds.min.z.toFixed(2)} to ${leafBounds.max.z.toFixed(2)}`,
      },
      convertedBounds: {
        X: `${convertedBounds.min.x.toFixed(2)} to ${convertedBounds.max.x.toFixed(2)}`,
        Y: `${convertedBounds.min.y.toFixed(2)} to ${convertedBounds.max.y.toFixed(2)} (vertical)`,
        Z: `${convertedBounds.min.z.toFixed(2)} to ${convertedBounds.max.z.toFixed(2)}`,
      },
    });

    console.log("[LOD Display] Generating leaf clusters for LOD1...");
    const clusterGenerator = new LeafClusterGenerator({
      minLeavesPerCluster: 30,
      maxLeavesPerCluster: 150,
      minClusterSize: 2.0, // Larger minimum - cards need to overlap for coverage
      maxClusterSize: 5.0, // Larger max for better fill
      lodLevel: 1,
    });
    clusterResult = clusterGenerator.generateClusters(convertedLeaves, params);
    // More clusters for better coverage
    const maxClustersLod1 = Math.min(
      80,
      Math.max(30, Math.floor(leaves.length / 50)),
    );
    clusterResult.clusters = limitClusters(
      clusterResult.clusters,
      maxClustersLod1,
    );
    console.log(
      `[LOD Display] LOD1 clusters: ${clusterResult.clusters.length} (from ${leaves.length} leaves)`,
    );
  }

  // LOD1: Trunk + primary branches + leaf cluster cards
  const lod1Group = new THREE.Group();
  lod1Group.name = "LOD1";

  // Generate branches with reduced depth
  const lod1Generator = new TreeGenerator(params, {
    generation: { seed, generateLeaves: false }, // No individual leaves
    geometry: { maxBranchDepth: 1 },
  });
  const lod1BranchTree = lod1Generator.generate();

  // Add branches to LOD1
  for (const branch of lod1BranchTree.branches) {
    lod1Group.add(branch.clone());
  }

  // Add proper cluster billboard cards for LOD1
  if (clusterResult && clusterResult.clusters.length > 0) {
    const leafColor = params.leaves?.[0]?.color ?? new THREE.Color(0x3d7a3d);
    const clusterCards = createClusterCardsFromClusters(
      clusterResult.clusters,
      leafColor,
      0.9,
      3, // 3 intersecting cards per cluster for better coverage
    );
    clusterCards.name = "ClusterCards_LOD1";

    lod1Group.add(clusterCards);
    console.log(
      `[LOD Display] LOD1: Added ${clusterResult.clusters.length} cluster cards (${clusterResult.clusters.length * 3} total planes)`,
    );
  }

  lod1Group.position.x = spacing * 2;
  scene.add(lod1Group);

  const lod1Label = createTextLabel("LOD1", "#ffff00");
  lod1Label.position.set(spacing * 2, treeCenter.y + treeSize.y / 2 + 2, 0);
  scene.add(lod1Label);

  lodDisplayMeshes.lod1 = { group: lod1Group, label: lod1Label };

  // LOD2: Trunk only + leaf cluster cards (fewer, larger clusters)
  const lod2Group = new THREE.Group();
  lod2Group.name = "LOD2";

  // Generate trunk only
  const lod2Generator = new TreeGenerator(params, {
    generation: { seed, generateLeaves: false },
    geometry: { maxBranchDepth: 0 },
  });
  const lod2BranchTree = lod2Generator.generate();

  // Add trunk to LOD2
  for (const branch of lod2BranchTree.branches) {
    lod2Group.add(branch.clone());
  }

  // Add cluster cards for LOD2 (larger clusters for distant viewing)
  if (leaves.length > 0) {
    // Generate larger clusters for LOD2 - need good coverage
    const lod2ClusterGenerator = new LeafClusterGenerator({
      minLeavesPerCluster: 50,
      maxLeavesPerCluster: 250,
      minClusterSize: 2.5, // Larger for better distant coverage
      maxClusterSize: 7.0, // Big clusters for LOD2
      lodLevel: 2,
    });
    const lod2ClusterResult = lod2ClusterGenerator.generateClusters(
      convertedLeaves,
      params,
    );
    // Fewer but larger clusters for LOD2
    const maxClustersLod2 = Math.min(
      50,
      Math.max(15, Math.floor(leaves.length / 100)),
    );
    const lod2Clusters = limitClusters(
      lod2ClusterResult.clusters,
      maxClustersLod2,
    );

    const leafColor = params.leaves?.[0]?.color ?? new THREE.Color(0x3d7a3d);
    const clusterCards = createClusterCardsFromClusters(
      lod2Clusters,
      leafColor,
      0.9,
      3, // 3 intersecting cards per cluster for better coverage
    );
    clusterCards.name = "ClusterCards_LOD2";

    lod2Group.add(clusterCards);
    console.log(
      `[LOD Display] LOD2: Added ${lod2Clusters.length} cluster cards (${lod2Clusters.length * 3} total planes)`,
    );
  }

  lod2Group.position.x = spacing * 3;
  scene.add(lod2Group);

  const lod2Label = createTextLabel("LOD2", "#ff8800");
  lod2Label.position.set(spacing * 3, treeCenter.y + treeSize.y / 2 + 2, 0);
  scene.add(lod2Label);

  lodDisplayMeshes.lod2 = { group: lod2Group, label: lod2Label };

  console.log(
    `[LOD Display] Created LOD0 (full), LOD1 (branches + clusters), LOD2 (trunk + clusters)`,
  );
}

function disposeTreeAssets(): void {
  if (currentTree) {
    scene.remove(currentTree.group);
    disposeTreeMesh(currentTree);
    currentTree = null;
  }
  disposeFlattenedSource();

  // Dispose LOD display meshes
  disposeLODDisplayMeshes();

  // Dispose cluster visualization
  clusterData = [];
  if (clusterMesh) {
    scene.remove(clusterMesh);
    clusterMesh.geometry.dispose();
    (clusterMesh.material as THREE.Material).dispose();
    clusterMesh = null;
  }
  if (octreeCellMesh) {
    scene.remove(octreeCellMesh);
    octreeCellMesh.geometry.dispose();
    (octreeCellMesh.material as THREE.Material).dispose();
    octreeCellMesh = null;
  }

  if (impostorInstance) {
    scene.remove(impostorInstance.mesh);
    impostorInstance.dispose();
    impostorInstance = null;
  }
  if (impostorLabel) {
    scene.remove(impostorLabel);
    impostorLabel.material.dispose();
    impostorLabel = null;
  }
  if (treeImpostor) {
    treeImpostor.dispose();
    treeImpostor = null;
  }
  if (atlasPlane) {
    scene.remove(atlasPlane);
    atlasPlane.geometry.dispose();
    const material = atlasPlane.material as THREE.Material;
    material.dispose();
    atlasPlane = null;
  }
  if (normalAtlasPlane) {
    scene.remove(normalAtlasPlane);
    normalAtlasPlane.geometry.dispose();
    const material = normalAtlasPlane.material as THREE.Material;
    material.dispose();
    normalAtlasPlane = null;
  }
  if (debugCube && debugCube.parent) {
    debugCube.parent.remove(debugCube);
  }
}

function disposePlantAssets(): void {
  if (currentPlant) {
    scene.remove(currentPlant.group);
    currentPlant.dispose();
    currentPlant = null;
  }
}

function disposeRockAssets(): void {
  if (currentRock) {
    scene.remove(currentRock.mesh);
    currentRock.mesh.geometry.dispose();
    const material = currentRock.mesh.material;
    if (Array.isArray(material)) {
      for (const mat of material) {
        mat.dispose();
      }
    } else {
      material.dispose();
    }
    currentRock = null;
  }
}

function disposeBuildingAssets(): void {
  if (currentBuilding) {
    scene.remove(currentBuilding.mesh);
    disposeObject3D(currentBuilding.mesh);
    currentBuilding = null;
  }
}

function disposeTownAssets(): void {
  if (townGroup) {
    scene.remove(townGroup);
    disposeGroup(townGroup);
    townGroup = null;
  }
  currentTown = null;
}

function disposeGrassAssets(): void {
  // Dispose grass LOD system
  disposeGrassLodSystem();

  // Dispose grass field
  if (grassFieldInstancedMesh) {
    scene.remove(grassFieldInstancedMesh.mesh);
    grassFieldInstancedMesh.dispose();
    grassFieldInstancedMesh = null;
  }

  // Dispose grass impostor instance
  if (grassImpostorInstance) {
    scene.remove(grassImpostorInstance.mesh);
    grassImpostorInstance.dispose();
    grassImpostorInstance = null;
  }

  // Dispose grass atlas plane
  if (grassAtlasPlane) {
    scene.remove(grassAtlasPlane);
    grassAtlasPlane.geometry.dispose();
    (grassAtlasPlane.material as THREE.Material).dispose();
    grassAtlasPlane = null;
  }

  // Dispose grass baking source
  if (grassBakingSource) {
    grassBakingSource.traverse((node) => {
      if (node instanceof THREE.Mesh) {
        node.geometry.dispose();
        (node.material as THREE.Material).dispose();
      }
    });
    grassBakingSource = null;
  }

  // Dispose grass impostor baker
  if (grassImpostor) {
    grassImpostor.dispose();
    grassImpostor = null;
  }
  grassImpostorBakeResult = null;

  // Dispose grass tile
  if (currentGrass) {
    scene.remove(currentGrass.lod0Mesh);
    if (currentGrass.lod1Mesh) {
      scene.remove(currentGrass.lod1Mesh);
    }
    currentGrass.dispose();
    currentGrass = null;
  }
}

function disposeAllGenerated(): void {
  disposeTreeAssets();
  disposePlantAssets();
  disposeRockAssets();
  disposeBuildingAssets();
  disposeTownAssets();
  disposeGrassAssets();
}

function getDebugCube(): THREE.Mesh {
  if (!debugCube) {
    // Use the same colored cube as the impostor demo for identical behavior
    debugCube = createColoredCube(2);
  }
  return debugCube;
}

function getFlattenedSource(): THREE.Group | null {
  if (!currentTree) return null;
  if (!debugBaker) {
    debugBaker = new ImpostorBaker(renderer);
  }
  disposeFlattenedSource();
  flattenedSource = debugBaker.createBakingSource(currentTree.group);
  return flattenedSource;
}

function createImpostorInstanceFromBake(
  bakeResult: ImpostorBakeResult,
  scale = 1,
): ExtendedImpostorInstance {
  if (!debugImpostor) {
    debugImpostor = new OctahedralImpostor(renderer);
  }

  // createInstance now reads dimensions from bounding box, scale is just a multiplier
  // Use TSL (WebGPU) materials since we're using WebGPURenderer
  const instance = debugImpostor.createInstance(bakeResult, scale, {
    useTSL: true,
  });

  // Calculate Y offset so billboard sits on ground
  // The plane is now maxDimension × maxDimension (square)
  let heightOffset = 0;
  let planeSize = 1;
  if (bakeResult.boundingBox) {
    const boxSize = new THREE.Vector3();
    bakeResult.boundingBox.getSize(boxSize);
    const boxCenter = new THREE.Vector3();
    bakeResult.boundingBox.getCenter(boxCenter);
    const maxDimension = Math.max(boxSize.x, boxSize.y, boxSize.z);
    planeSize = maxDimension * scale;
    heightOffset = (boxCenter.y - boxSize.y / 2) * scale;
  } else {
    planeSize = bakeResult.boundingSphere.radius * 2 * scale;
    heightOffset =
      (bakeResult.boundingSphere.center.y - bakeResult.boundingSphere.radius) *
      scale;
  }

  instance.mesh.position.y = planeSize / 2 + heightOffset;
  return instance;
}

function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

function exportFlattenedGlb(): void {
  if (!currentTree) {
    alert("Generate a tree first!");
    return;
  }
  if (!debugImpostor) {
    debugImpostor = new OctahedralImpostor(renderer);
  }

  if (!debugBaker) {
    debugBaker = new ImpostorBaker(renderer);
  }
  const flattened = debugBaker.createBakingSource(currentTree.group);
  const exporter = new GLTFExporter();

  exporter.parse(
    flattened,
    (result: ArrayBuffer | object) => {
      if (result instanceof ArrayBuffer) {
        const blob = new Blob([result], { type: "model/gltf-binary" });
        downloadBlob(blob, "tree-flattened.glb");
      } else {
        const blob = new Blob([JSON.stringify(result)], {
          type: "application/json",
        });
        downloadBlob(blob, "tree-flattened.gltf");
      }
      disposeObject3D(flattened);
    },
    (error: ErrorEvent | Error) => {
      console.error("GLB export failed:", error);
      disposeObject3D(flattened);
    },
    { binary: true },
  );
}

/**
 * Generate a new tree.
 */
function generateTree(): void {
  const startTime = performance.now();

  // Get parameters from UI
  const presetName = presetSelect.value;
  const seed = parseInt(seedInput.value, 10) || 0;
  const generateLeaves = generateLeavesCheckbox.checked;
  const radialSegments = parseInt(radialSegmentsInput.value, 10) || 8;
  const maxLeaves = parseInt(maxLeavesInput.value, 10) || undefined;
  const maxBranchDepth = parseInt(maxBranchDepthInput.value, 10);
  const useInstanced = useInstancedCheckbox?.checked ?? true;

  // Remove previous tree and impostor state
  disposeTreeAssets();
  impostorStatusSpan.textContent = "Not baked";

  // Dispose previous generator
  if (generator) {
    generator.dispose();
  }

  // Create generator
  const treeGenerator = new TreeGenerator(getPreset(presetName), {
    generation: {
      seed,
      generateLeaves,
    },
    geometry: {
      radialSegments,
      branchCaps: true,
      vertexColors: false,
      maxLeaves: maxLeaves === 0 ? undefined : maxLeaves,
      maxBranchDepth: maxBranchDepth < 0 ? undefined : maxBranchDepth,
    },
    mesh: {
      useInstancedLeaves: useInstanced,
      maxLeafInstances: maxLeaves === 0 ? undefined : maxLeaves,
    },
  });
  generator = treeGenerator;

  // Generate tree
  currentTree = treeGenerator.generate();

  // Apply wireframe if enabled
  if (wireframeCheckbox.checked) {
    applyWireframe(true);
  }

  // Add to scene
  scene.add(currentTree.group);

  // Update visibility
  updateVisibility();

  // Update stats
  const treeData = generator.getLastTreeData()!;
  const endTime = performance.now();

  stemCountSpan.textContent = treeData.stems.length.toString();
  leafCountSpan.textContent = treeData.leaves.length.toString();
  vertexCountSpan.textContent = currentTree.vertexCount.toLocaleString();
  triangleCountSpan.textContent = currentTree.triangleCount.toLocaleString();
  genTimeSpan.textContent = `${(endTime - startTime).toFixed(1)}ms`;

  // Update performance stats
  instancedModeSpan.textContent = currentTree.instancedLeaves ? "Yes" : "No";
  leafInstancesSpan.textContent =
    currentTree.leafInstanceCount > 0
      ? currentTree.leafInstanceCount.toLocaleString()
      : "-";
  materialsSpan.textContent = currentTree.materialCount.toString();

  // Center camera on tree
  const box = new THREE.Box3().setFromObject(currentTree.group);
  const center = box.getCenter(new THREE.Vector3());
  const size = box.getSize(new THREE.Vector3());
  controls.target.copy(center);
  camera.position.set(
    center.x + size.x,
    center.y + size.y * 0.5,
    center.z + size.x,
  );
}

function getPlantQuality(): RenderQualityEnum {
  const key = plantQualitySelect.value as keyof typeof RenderQualityEnum;
  return RenderQualityEnum[key] ?? RenderQualityEnum.Medium;
}

function generatePlant(): void {
  disposePlantAssets();

  const presetName = plantPresetSelect.value as PlantPresetName;
  const seed = parseInt(plantSeedInput.value, 10) || 0;
  const quality = getPlantQuality();

  const result = generatePlantFromPreset(presetName, seed, {
    generateTextures: false,
    quality,
  });

  currentPlant = result;
  scene.add(result.group);

  plantLeafCountSpan.textContent = result.stats.leafCount.toLocaleString();
  plantVertexCountSpan.textContent = result.stats.vertexCount.toLocaleString();
  plantTriangleCountSpan.textContent =
    result.stats.triangleCount.toLocaleString();
  plantGenTimeSpan.textContent = `${result.stats.generationTimeMs.toFixed(1)}ms`;

  fitCameraToObject(result.group, 1.4);
}

function applyRockWireframe(mesh: THREE.Mesh, wireframe: boolean): void {
  const materials = Array.isArray(mesh.material)
    ? mesh.material
    : [mesh.material];
  for (const material of materials) {
    if (material instanceof THREE.MeshStandardMaterial) {
      material.wireframe = wireframe;
    }
  }
}

function updateRockPresetOptions(): void {
  const presets =
    rockPresetGroupSelect.value === "type"
      ? Object.keys(ROCK_TYPE_PRESETS)
      : Object.keys(SHAPE_PRESETS);
  rockPresetSelect.innerHTML = "";
  for (const preset of presets) {
    const option = document.createElement("option");
    option.value = preset;
    option.textContent = preset.charAt(0).toUpperCase() + preset.slice(1);
    rockPresetSelect.appendChild(option);
  }
  if (presets.length > 0) {
    rockPresetSelect.value = presets[0];
    // Sync UI with the first preset's values
    updateRockUIFromPreset(presets[0]);
  }
}

function getRockParamsFromUI(): PartialRockParams {
  return {
    baseShape: (rockBaseShapeSelect?.value || "icosahedron") as BaseShapeType,
    subdivisions: parseInt(rockSubdivisionsInput.value, 10) || 4,
    flatShading: rockFlatShadingCheckbox.checked,
    scale: {
      x: parseFloat(rockScaleXInput?.value || "1.0"),
      y: parseFloat(rockScaleYInput?.value || "1.0"),
      z: parseFloat(rockScaleZInput?.value || "1.0"),
    },
    noise: {
      scale: parseFloat(rockNoiseScaleInput?.value || "2.0"),
      amplitude: parseFloat(rockNoiseAmplitudeInput?.value || "0.3"),
      octaves: parseInt(rockNoiseOctavesInput?.value || "4", 10),
      lacunarity: parseFloat(rockNoiseLacunarityInput?.value || "2.0"),
      persistence: parseFloat(rockNoisePersistenceInput?.value || "0.5"),
    },
    cracks: {
      depth: parseFloat(rockCrackDepthInput?.value || "0.1"),
      frequency: parseFloat(rockCrackFrequencyInput?.value || "3.0"),
    },
    smooth: {
      iterations: parseInt(rockSmoothIterationsInput?.value || "0", 10),
      strength: parseFloat(rockSmoothStrengthInput?.value || "0.5"),
    },
    colors: {
      baseColor: rockBaseColorInput?.value || "#5a524a",
      secondaryColor: rockSecondaryColorInput?.value || "#7a7268",
      accentColor: rockAccentColorInput?.value || "#3a3530",
      variation: parseFloat(rockColorVariationInput?.value || "0.1"),
      heightBlend: parseFloat(rockHeightBlendInput?.value || "0.3"),
      slopeBlend: parseFloat(rockSlopeBlendInput?.value || "0.5"),
      aoIntensity: parseFloat(rockAOIntensityInput?.value || "0.3"),
    },
    material: {
      roughness: parseFloat(rockRoughnessInput?.value || "0.85"),
      roughnessVariation: parseFloat(
        rockRoughnessVariationInput?.value || "0.1",
      ),
      metalness: parseFloat(rockMetalnessInput?.value || "0.0"),
    },
    // Procedural texture settings
    colorMode: (rockColorModeSelect?.value || "vertex") as ColorModeType,
    textureBlend: parseFloat(rockTextureBlendInput?.value || "0.5"),
    texture: {
      pattern: (rockTexturePatternSelect?.value ||
        "noise") as TexturePatternType,
      scale: parseFloat(rockTextureScaleInput?.value || "4.0"),
      detail: parseInt(rockTextureDetailInput?.value || "4", 10),
      contrast: parseFloat(rockTextureContrastInput?.value || "1.0"),
    },
    uvMethod: (rockUVMethodSelect?.value || "box") as UVMethodType,
  };
}

function updateRockUIFromPreset(presetName: string): void {
  // Get the preset params from the rock presets
  const presets: Record<string, PartialRockParams> =
    rockPresetGroupSelect.value === "type" ? ROCK_TYPE_PRESETS : SHAPE_PRESETS;
  const preset = presets[presetName];
  if (!preset) return;

  // Merge preset with defaults to get complete values
  const defaults = ROCK_DEFAULT_PARAMS;

  // Update UI controls with preset values, falling back to defaults
  if (rockBaseShapeSelect) {
    rockBaseShapeSelect.value = preset.baseShape ?? defaults.baseShape;
  }
  if (rockSubdivisionsInput) {
    rockSubdivisionsInput.value = (
      preset.subdivisions ?? defaults.subdivisions
    ).toString();
  }
  if (rockFlatShadingCheckbox) {
    rockFlatShadingCheckbox.checked =
      preset.flatShading ?? defaults.flatShading;
  }

  // Scale
  const scale = { ...defaults.scale, ...preset.scale };
  if (rockScaleXInput) rockScaleXInput.value = scale.x.toString();
  if (rockScaleYInput) rockScaleYInput.value = scale.y.toString();
  if (rockScaleZInput) rockScaleZInput.value = scale.z.toString();

  // Noise
  const noise = { ...defaults.noise, ...preset.noise };
  if (rockNoiseScaleInput) rockNoiseScaleInput.value = noise.scale.toString();
  if (rockNoiseAmplitudeInput)
    rockNoiseAmplitudeInput.value = noise.amplitude.toString();
  if (rockNoiseOctavesInput)
    rockNoiseOctavesInput.value = noise.octaves.toString();
  if (rockNoiseLacunarityInput)
    rockNoiseLacunarityInput.value = noise.lacunarity.toString();
  if (rockNoisePersistenceInput)
    rockNoisePersistenceInput.value = noise.persistence.toString();

  // Cracks
  const cracks = { ...defaults.cracks, ...preset.cracks };
  if (rockCrackDepthInput) rockCrackDepthInput.value = cracks.depth.toString();
  if (rockCrackFrequencyInput)
    rockCrackFrequencyInput.value = cracks.frequency.toString();

  // Smooth
  const smooth = { ...defaults.smooth, ...preset.smooth };
  if (rockSmoothIterationsInput)
    rockSmoothIterationsInput.value = smooth.iterations.toString();
  if (rockSmoothStrengthInput)
    rockSmoothStrengthInput.value = smooth.strength.toString();

  // Colors
  const colors = { ...defaults.colors, ...preset.colors };
  if (rockBaseColorInput) rockBaseColorInput.value = colors.baseColor;
  if (rockSecondaryColorInput)
    rockSecondaryColorInput.value = colors.secondaryColor;
  if (rockAccentColorInput) rockAccentColorInput.value = colors.accentColor;
  if (rockColorVariationInput)
    rockColorVariationInput.value = colors.variation.toString();
  if (rockHeightBlendInput)
    rockHeightBlendInput.value = colors.heightBlend.toString();
  if (rockSlopeBlendInput)
    rockSlopeBlendInput.value = colors.slopeBlend.toString();
  if (rockAOIntensityInput)
    rockAOIntensityInput.value = colors.aoIntensity.toString();

  // Material
  const material = { ...defaults.material, ...preset.material };
  if (rockRoughnessInput)
    rockRoughnessInput.value = material.roughness.toString();
  if (rockRoughnessVariationInput)
    rockRoughnessVariationInput.value = material.roughnessVariation.toString();
  if (rockMetalnessInput)
    rockMetalnessInput.value = material.metalness.toString();

  // Procedural Texture
  if (rockColorModeSelect) {
    rockColorModeSelect.value = preset.colorMode ?? defaults.colorMode;
  }
  if (rockTextureBlendInput) {
    rockTextureBlendInput.value = (
      preset.textureBlend ?? defaults.textureBlend
    ).toString();
  }
  const texture = { ...defaults.texture, ...preset.texture };
  if (rockTexturePatternSelect)
    rockTexturePatternSelect.value = texture.pattern;
  if (rockTextureScaleInput)
    rockTextureScaleInput.value = texture.scale.toString();
  if (rockTextureDetailInput)
    rockTextureDetailInput.value = texture.detail.toString();
  if (rockTextureContrastInput)
    rockTextureContrastInput.value = texture.contrast.toString();
  if (rockUVMethodSelect) {
    rockUVMethodSelect.value = preset.uvMethod ?? defaults.uvMethod;
  }
}

function generateRock(): void {
  if (!rockGenerator) {
    rockGenerator = new RockGenerator();
  }
  disposeRockAssets();

  const presetName = rockPresetSelect.value;
  if (!presetName) return;

  const seed = rockSeedInput.value || "rock-001";
  const wireframe = rockWireframeCheckbox.checked;

  // Get all params from UI
  const uiParams = getRockParamsFromUI();

  const result = rockGenerator.generateFromPreset(presetName, {
    seed,
    params: uiParams,
  });

  if (!result) return;

  currentRock = result;
  applyRockWireframe(result.mesh, wireframe);
  scene.add(result.mesh);

  rockVertexCountSpan.textContent = result.stats.vertices.toLocaleString();
  rockTriangleCountSpan.textContent = result.stats.triangles.toLocaleString();
  rockGenTimeSpan.textContent = `${result.stats.generationTime.toFixed(1)}ms`;

  fitCameraToObject(result.mesh, 1.4);
}

function updateBuildingStats(stats: BuildingStats): void {
  buildingRoomsSpan.textContent = stats.rooms.toString();
  buildingWallsSpan.textContent = stats.wallSegments.toString();
  buildingWindowsSpan.textContent = stats.windows.toString();
  buildingRoofSpan.textContent = stats.roofPieces.toString();
  buildingPropsSpan.textContent = stats.props.toString();
  buildingFootprintSpan.textContent = stats.footprintCells.toString();
}

function updateNavigationStats(): void {
  if (!navigationVisualizer) return;

  const stats = navigationVisualizer.getStats();
  if (stats) {
    navFloorsSpan.textContent = stats.floors.toString();
    navWalkableSpan.textContent = stats.walkableTiles.toString();
    navWallsSpan.textContent = stats.walls.toString();
    navDoorsSpan.textContent = stats.doors.toString();
    navStairsSpan.textContent = stats.stairs.toString();
  } else {
    navFloorsSpan.textContent = "-";
    navWalkableSpan.textContent = "-";
    navWallsSpan.textContent = "-";
    navDoorsSpan.textContent = "-";
    navStairsSpan.textContent = "-";
  }
}

function updateNavigationOptions(): void {
  if (!navigationVisualizer) return;

  navigationVisualizer.setOptions({
    showWalkableTiles: navShowWalkableTilesCheckbox.checked,
    showDoors: navShowDoorsCheckbox.checked,
    showStairs: navShowStairsCheckbox.checked,
    showWalls: navShowWallsCheckbox.checked,
    showEntryPoints: navShowEntryPointsCheckbox.checked,
    showDemoPaths: navShowDemoPathsCheckbox.checked,
  });
}

/**
 * Update building roof visibility based on checkbox state.
 * Hides actual roofs and terrace roofs, but NOT ceiling tiles
 * (ceilings have a floor above them, roofs don't).
 */
function updateBuildingRoofVisibility(): void {
  if (!currentBuilding) return;

  const hideRoofs = buildingHideRoofsCheckbox.checked;
  const mesh = currentBuilding.mesh;

  // Find the roof child in the building group
  if (mesh instanceof THREE.Group) {
    const roofChild = mesh.getObjectByName("roof");
    if (roofChild) {
      roofChild.visible = !hideRoofs;
    }
  }
}

function generateBuilding(): void {
  if (!buildingGenerator) {
    buildingGenerator = new BuildingGenerator();
  }
  disposeBuildingAssets();

  const typeKey = buildingTypeSelect.value;
  const includeRoof = buildingIncludeRoofCheckbox.checked;
  const seed = buildingSeedInput.value || `${typeKey}-${Date.now()}`;

  const result = buildingGenerator.generate(typeKey, {
    seed,
    includeRoof,
  });

  if (!result) return;

  result.mesh.castShadow = true;
  result.mesh.receiveShadow = true;
  result.mesh.traverse((obj) => {
    if (obj instanceof THREE.Mesh) {
      obj.castShadow = true;
      obj.receiveShadow = true;
    }
  });

  scene.add(result.mesh);
  currentBuilding = result;
  updateBuildingStats(result.stats);
  updateBuildingRoofVisibility(); // Apply roof visibility based on checkbox
  fitCameraToObject(result.mesh, 1.5);

  // Update navigation visualizer with building layout
  if (navigationVisualizer) {
    navigationVisualizer.setBuilding(result.layout, { x: 0, y: 0, z: 0 }, 0);
    updateNavigationStats();
  }
}

function generateTown(): void {
  if (!buildingGenerator) {
    buildingGenerator = new BuildingGenerator();
  }
  disposeTownAssets();

  const seed = parseInt(townSeedInput.value, 10) || 0;
  const size = townSizeSelect.value as TownSize;
  const showSafeZone = townShowSafeZoneCheckbox.checked;
  const showBuildings3d = townShowBuildings3dCheckbox.checked;

  const townGenerator = new TownGenerator({
    seed,
    terrain: {
      getHeightAt: () => 0,
      getBiomeAt: () => "plains",
    },
  });

  const town = townGenerator.generateSingleTown(0, 0, size);
  currentTown = town;

  const group = new THREE.Group();
  townGroup = group;
  scene.add(group);

  if (showSafeZone) {
    const ring = new THREE.RingGeometry(
      town.safeZoneRadius - 0.5,
      town.safeZoneRadius + 0.5,
      64,
    );
    const ringMat = new THREE.MeshBasicMaterial({
      color: 0x00ff00,
      transparent: true,
      opacity: 0.3,
      side: THREE.DoubleSide,
    });
    const ringMesh = new THREE.Mesh(ring, ringMat);
    ringMesh.rotation.x = -Math.PI / 2;
    ringMesh.position.y = 0.02;
    group.add(ringMesh);
  }

  // Draw ground plane for context
  const groundSize = town.safeZoneRadius * 2.2;
  const groundGeo = new THREE.PlaneGeometry(groundSize, groundSize);
  const groundMat = new THREE.MeshStandardMaterial({
    color: 0x4a7c4e, // Grass green
    roughness: 0.95,
  });
  const groundMesh = new THREE.Mesh(groundGeo, groundMat);
  groundMesh.rotation.x = -Math.PI / 2;
  groundMesh.position.y = 0.01;
  groundMesh.receiveShadow = true;
  group.add(groundMesh);

  // Draw central plaza
  if (town.plaza) {
    const plazaRadius = town.plaza.radius;
    const plazaGeo =
      town.plaza.shape === "square"
        ? new THREE.PlaneGeometry(plazaRadius * 2, plazaRadius * 2)
        : new THREE.CircleGeometry(
            plazaRadius,
            town.plaza.shape === "octagon" ? 8 : 32,
          );
    const plazaColor =
      town.plaza.material === "cobblestone"
        ? 0x8a7a6a
        : town.plaza.material === "dirt"
          ? 0x7a6a5a
          : 0x5a7a5a;
    const plazaMat = new THREE.MeshStandardMaterial({
      color: plazaColor,
      roughness: 0.85,
    });
    const plazaMesh = new THREE.Mesh(plazaGeo, plazaMat);
    plazaMesh.rotation.x = -Math.PI / 2;
    plazaMesh.position.set(
      town.plaza.position.x - town.position.x,
      0.025,
      town.plaza.position.z - town.position.z,
    );
    plazaMesh.receiveShadow = true;
    group.add(plazaMesh);
  }

  // Draw internal roads
  if (town.internalRoads && town.internalRoads.length > 0) {
    const roadWidth = 5;
    for (const road of town.internalRoads) {
      const startX = road.start.x - town.position.x;
      const startZ = road.start.z - town.position.z;
      const endX = road.end.x - town.position.x;
      const endZ = road.end.z - town.position.z;

      const dx = endX - startX;
      const dz = endZ - startZ;
      const length = Math.sqrt(dx * dx + dz * dz);
      const angle = Math.atan2(dz, dx);

      // Road surface
      const roadGeo = new THREE.PlaneGeometry(length + 2, roadWidth);
      const roadMat = new THREE.MeshStandardMaterial({
        color: road.isMain ? 0x6b5344 : 0x7a6252,
        roughness: 0.85,
      });
      const roadMesh = new THREE.Mesh(roadGeo, roadMat);
      roadMesh.rotation.x = -Math.PI / 2;
      roadMesh.rotation.z = -angle;
      roadMesh.position.set((startX + endX) / 2, 0.02, (startZ + endZ) / 2);
      roadMesh.receiveShadow = true;
      group.add(roadMesh);
    }
  }

  // Draw paths (walkways to building entrances)
  if (town.paths && town.paths.length > 0) {
    for (const path of town.paths) {
      const startX = path.start.x - town.position.x;
      const startZ = path.start.z - town.position.z;
      const endX = path.end.x - town.position.x;
      const endZ = path.end.z - town.position.z;

      const dx = endX - startX;
      const dz = endZ - startZ;
      const length = Math.sqrt(dx * dx + dz * dz);
      const angle = Math.atan2(dz, dx);

      if (length > 0.5) {
        const pathGeo = new THREE.PlaneGeometry(length, path.width);
        const pathMat = new THREE.MeshStandardMaterial({
          color: 0x9a8a7a, // Light stone/gravel
          roughness: 0.9,
        });
        const pathMesh = new THREE.Mesh(pathGeo, pathMat);
        pathMesh.rotation.x = -Math.PI / 2;
        pathMesh.rotation.z = -angle;
        pathMesh.position.set((startX + endX) / 2, 0.022, (startZ + endZ) / 2);
        pathMesh.receiveShadow = true;
        group.add(pathMesh);
      }
    }
  }

  // Draw landmarks
  if (town.landmarks && town.landmarks.length > 0) {
    for (const landmark of town.landmarks) {
      const lx = landmark.position.x - town.position.x;
      const lz = landmark.position.z - town.position.z;

      // Color based on landmark type
      let color = 0x888888;
      let height = landmark.size.height;

      switch (landmark.type) {
        case "well":
          color = 0x5a5a6a;
          break; // Gray stone
        case "fountain":
          color = 0x4a7aaa;
          break; // Blue-gray
        case "market_stall":
          color = 0xaa7a4a;
          break; // Brown wood
        case "signpost":
          color = 0x8a6a4a;
          break; // Wood brown
        case "bench":
          color = 0x7a5a3a;
          break; // Dark wood
        case "barrel":
          color = 0x6a5a4a;
          break; // Barrel brown
        case "crate":
          color = 0x8a7a5a;
          break; // Crate tan
        case "lamppost":
          color = 0x3a3a3a;
          break; // Dark iron
        case "planter":
          color = 0x5a8a5a;
          break; // Green
        case "tree":
          color = 0x3a6a3a;
          height = 4;
          break; // Tree green
        case "fence_post":
          color = 0x6a5030;
          break; // Rustic wood brown
        case "fence_gate":
          color = 0x7a6040;
          break; // Lighter wood for gate
      }

      const landmarkGeo = new THREE.BoxGeometry(
        landmark.size.width,
        height,
        landmark.size.depth,
      );
      const landmarkMat = new THREE.MeshStandardMaterial({
        color,
        roughness: 0.7,
      });
      const landmarkMesh = new THREE.Mesh(landmarkGeo, landmarkMat);
      landmarkMesh.position.set(lx, height / 2, lz);
      landmarkMesh.rotation.y = landmark.rotation;
      landmarkMesh.castShadow = true;
      landmarkMesh.receiveShadow = true;
      group.add(landmarkMesh);
    }
  }

  // Draw entry point markers (road signs)
  if (town.entryPoints) {
    for (const entry of town.entryPoints) {
      const markerGeo = new THREE.CircleGeometry(1.5, 16);
      const markerMat = new THREE.MeshBasicMaterial({
        color: 0xdd8833,
        side: THREE.DoubleSide,
      });
      const marker = new THREE.Mesh(markerGeo, markerMat);
      marker.rotation.x = -Math.PI / 2;
      marker.position.set(
        entry.position.x - town.position.x,
        0.03,
        entry.position.z - town.position.z,
      );
      group.add(marker);
    }
  }

  // Draw building entrances (doors) as small colored circles
  for (const building of town.buildings) {
    if (building.entrance) {
      const doorGeo = new THREE.CircleGeometry(0.6, 8);
      const doorMat = new THREE.MeshBasicMaterial({
        color: 0xffaa00, // Orange for visibility
        side: THREE.DoubleSide,
      });
      const doorMesh = new THREE.Mesh(doorGeo, doorMat);
      doorMesh.rotation.x = -Math.PI / 2;
      doorMesh.position.set(
        building.entrance.x - town.position.x,
        0.05,
        building.entrance.z - town.position.z,
      );
      group.add(doorMesh);
    }
  }

  for (const building of town.buildings) {
    if (showBuildings3d && BUILDING_RECIPES[building.type]) {
      const buildingSeed = `${seed}_${building.id}`;
      const result = buildingGenerator.generate(building.type, {
        seed: buildingSeed,
        includeRoof: true,
      });

      if (result) {
        result.mesh.position.set(
          building.position.x - town.position.x,
          0,
          building.position.z - town.position.z,
        );
        result.mesh.rotation.y = building.rotation;
        result.mesh.castShadow = true;
        result.mesh.receiveShadow = true;
        result.mesh.traverse((obj) => {
          if (obj instanceof THREE.Mesh) {
            obj.castShadow = true;
            obj.receiveShadow = true;
          }
        });
        group.add(result.mesh);
      }
    } else {
      const buildingGeo = new THREE.BoxGeometry(
        building.size.width,
        4,
        building.size.depth,
      );
      const buildingMat = new THREE.MeshStandardMaterial({
        color: 0x888888,
        roughness: 0.8,
      });
      const buildingMesh = new THREE.Mesh(buildingGeo, buildingMat);
      buildingMesh.position.set(
        building.position.x - town.position.x,
        2,
        building.position.z - town.position.z,
      );
      buildingMesh.rotation.y = building.rotation;
      buildingMesh.castShadow = true;
      buildingMesh.receiveShadow = true;
      group.add(buildingMesh);
    }
  }

  townNameSpan.textContent = town.name;
  const layoutDesc =
    town.layoutType === "crossroads"
      ? "crossroads"
      : town.layoutType === "throughway"
        ? "main street"
        : town.layoutType === "terminus"
          ? "dead end"
          : (town.layoutType ?? "unknown");
  townSizeSpan.textContent = `${town.size} (${layoutDesc})`;
  const pathCount = town.paths?.length ?? 0;
  const landmarkCount = town.landmarks?.length ?? 0;
  townBuildingsSpan.textContent = `${town.buildings.length} buildings, ${pathCount} paths, ${landmarkCount} landmarks`;
  townSafeZoneSpan.textContent = `${town.safeZoneRadius}m (${town.internalRoads?.length ?? 0} roads)`;

  // Center camera on the town - target the center explicitly
  const townCenter = new THREE.Vector3(0, 0, 0);
  const townRadius = town.safeZoneRadius;
  const cameraDistance = townRadius * 2.5;

  controls.target.copy(townCenter);
  camera.position.set(
    cameraDistance * 0.7,
    cameraDistance * 0.5,
    cameraDistance * 0.7,
  );
  camera.updateProjectionMatrix();
  controls.update();

  // Update navigation visualizer with town data
  // For town mode, select first building by default to show navigation
  if (navigationVisualizer && buildingGenerator && town.buildings.length > 0) {
    navigationVisualizer.setTown(town, buildingGenerator);
    // Select first building to show its navigation
    navigationVisualizer.selectBuilding(0);
    updateNavigationStats();
  }
}

/**
 * Generate a grass tile.
 */
// Game-accurate grass config (matches ProceduralGrass.ts exactly)
const GAME_GRASS_CONFIG = {
  BLADE_WIDTH: 0.04,
  BLADE_HEIGHT: 0.5,
  SEGMENTS: 4,
  TIP_TAPER: 0.1,
  // Colors from ProceduralGrass.ts that match TerrainShader.ts
  BASE_COLOR: { r: 0.26, g: 0.48, b: 0.12 },
  TIP_COLOR: { r: 0.29, g: 0.53, b: 0.14 },
  DARK_COLOR: { r: 0.22, g: 0.42, b: 0.1 },
};

function generateGrass(): void {
  disposeGrassAssets();

  const startTime = performance.now();

  const seed = parseInt(grassSeedInput.value, 10) || Date.now();
  const density = parseFloat(grassDensityInput.value) || 8;
  const patchSize = parseFloat(grassPatchSizeInput.value) || 4;
  const bladeHeight = parseFloat(grassBladeHeightInput.value) || 0.5;

  // Generate grass field using game-accurate config
  // Override colors to match ProceduralGrass.ts exactly
  currentGrass = GrassGenerator.generateField({
    config: {
      density,
      patchSize,
      blade: {
        height: bladeHeight,
        width: GAME_GRASS_CONFIG.BLADE_WIDTH,
        segments: GAME_GRASS_CONFIG.SEGMENTS,
        tipTaper: GAME_GRASS_CONFIG.TIP_TAPER,
      },
      color: {
        baseColor: GAME_GRASS_CONFIG.BASE_COLOR,
        tipColor: GAME_GRASS_CONFIG.TIP_COLOR,
        darkColor: GAME_GRASS_CONFIG.DARK_COLOR,
        dryColorMix: 0.15,
        aoStrength: 0.5,
      },
      wind: {
        strength: 0.6,
        speed: 0.5,
        gustSpeed: 0.4,
        flutterIntensity: 0.15,
        direction: { x: 1, z: 0.3 },
      },
    },
    seed,
    includeLOD1: false,
  });

  // Add to scene - position at ground level
  currentGrass.lod0Mesh.position.set(0, 0, 0);
  scene.add(currentGrass.lod0Mesh);

  const genTime = performance.now() - startTime;

  // Update stats
  grassBladeCountSpan.textContent = currentGrass.lod0Count.toLocaleString();
  grassTileSizeSpan.textContent = `${patchSize}m × ${patchSize}m`;
  grassGenTimeSpan.textContent = `${genTime.toFixed(0)}ms`;
  grassImpostorStatusSpan.textContent = "Not baked";

  // Fit camera to grass tile
  controls.target.set(0, bladeHeight / 2, 0);
  camera.position.set(patchSize * 2, patchSize, patchSize * 2);
}

/**
 * Create a static baking source from the grass instanced mesh.
 *
 * The grass uses SpriteNodeMaterial with shader-based positioning, so we need
 * to create actual geometry with the positions baked in for the impostor baker.
 *
 * Uses complex clump geometry (multiple blades per clump) for near-field quality.
 */
async function createGrassBakingSource(
  grassField: GrassFieldResult,
): Promise<THREE.Group> {
  const group = new THREE.Group();
  const mesh = grassField.lod0Mesh;
  const geometry = mesh.geometry;
  const config = grassField.config;

  // Get instance attributes
  const instancePosition = geometry.getAttribute(
    "instancePosition",
  ) as THREE.InstancedBufferAttribute;
  const instanceVariation = geometry.getAttribute(
    "instanceVariation",
  ) as THREE.InstancedBufferAttribute;

  if (!instancePosition || !instanceVariation) {
    console.error("Grass mesh missing instance attributes");
    return group;
  }

  const instanceCount = grassField.lod0Count;
  const bladeHeight = config.blade.height;
  const bladeWidth = config.blade.width;
  const baseColor = new THREE.Color(
    config.color.baseColor.r,
    config.color.baseColor.g,
    config.color.baseColor.b,
  );
  const tipColor = new THREE.Color(
    config.color.tipColor.r,
    config.color.tipColor.g,
    config.color.tipColor.b,
  );

  // Create complex clump geometry for near-field quality
  // Each instance will use a multi-blade clump instead of a single blade
  const clumpGeometry = createGrassClumpGeometry(config.blade, {
    bladeCount: 5, // 5 blades per clump for nice density
    segments: 4, // 4 segments for smooth curvature
    curvature: 0.25, // Moderate curvature
    spread: 0.02, // Tight spread within clump
    heightVariation: 0.3, // 30% height variation
    widthVariation: 0.2, // 20% width variation
  });

  const clumpPositions = clumpGeometry.getAttribute(
    "position",
  ) as THREE.BufferAttribute;
  const clumpNormals = clumpGeometry.getAttribute(
    "normal",
  ) as THREE.BufferAttribute;
  const clumpUvs = clumpGeometry.getAttribute("uv") as THREE.BufferAttribute;
  const clumpIndex = clumpGeometry.getIndex();

  const clumpVertexCount = clumpPositions.count;
  const clumpIndexCount = clumpIndex ? clumpIndex.count : 0;

  // Merge all instances into one big geometry for efficient baking
  const mergedPositions = new Float32Array(
    instanceCount * clumpVertexCount * 3,
  );
  const mergedNormals = new Float32Array(instanceCount * clumpVertexCount * 3);
  const mergedColors = new Float32Array(instanceCount * clumpVertexCount * 3);
  const mergedIndices: number[] = [];

  for (let i = 0; i < instanceCount; i++) {
    // Read instance data
    const worldX = instancePosition.getX(i);
    const worldY = instancePosition.getY(i);
    const worldZ = instancePosition.getZ(i);
    const heightScale = instancePosition.getW(i);

    const rotation = instanceVariation.getX(i);
    const widthScale = instanceVariation.getY(i);

    // Per-instance random for additional width variation (matches shader)
    const positionNoise = ((i * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff;
    const finalWidthScale = widthScale * (positionNoise + 0.5);

    // Create rotation matrix for Y-axis rotation
    const cosR = Math.cos(rotation);
    const sinR = Math.sin(rotation);

    const vertexOffset = i * clumpVertexCount;

    for (let v = 0; v < clumpVertexCount; v++) {
      // Get clump vertex position (already has spread and curvature baked in)
      const bx = clumpPositions.getX(v);
      const by = clumpPositions.getY(v);
      const bz = clumpPositions.getZ(v);

      // Scale blade dimensions
      const scaledX = bx * bladeWidth * finalWidthScale;
      const scaledY = by * bladeHeight * heightScale;
      const scaledZ = bz * bladeWidth * finalWidthScale;

      // Rotate around Y axis
      const rotX = scaledX * cosR - scaledZ * sinR;
      const rotZ = scaledX * sinR + scaledZ * cosR;

      // Translate to world position
      const finalX = rotX + worldX;
      const finalY = scaledY + worldY;
      const finalZ = rotZ + worldZ;

      const idx = (vertexOffset + v) * 3;
      mergedPositions[idx + 0] = finalX;
      mergedPositions[idx + 1] = finalY;
      mergedPositions[idx + 2] = finalZ;

      // Transform normal
      const nx = clumpNormals.getX(v);
      const ny = clumpNormals.getY(v);
      const nz = clumpNormals.getZ(v);
      const rotNx = nx * cosR - nz * sinR;
      const rotNz = nx * sinR + nz * cosR;
      mergedNormals[idx + 0] = rotNx;
      mergedNormals[idx + 1] = ny;
      mergedNormals[idx + 2] = rotNz;

      // Compute vertex color (gradient from base to tip)
      // Use UV.y for height since clump geometry has proper UVs
      const t = clumpUvs ? clumpUvs.getY(v) : by;
      const gradientColor = baseColor.clone().lerp(tipColor, t * 0.6);
      // Ambient occlusion at base
      const ao = Math.max(0.65, 0.65 + t * 0.35);
      mergedColors[idx + 0] = gradientColor.r * ao;
      mergedColors[idx + 1] = gradientColor.g * ao;
      mergedColors[idx + 2] = gradientColor.b * ao;
    }

    // Add indices with offset
    if (clumpIndex) {
      for (let j = 0; j < clumpIndexCount; j++) {
        mergedIndices.push(clumpIndex.getX(j) + vertexOffset);
      }
    }
  }

  // Clean up clump geometry
  clumpGeometry.dispose();

  // Create merged geometry
  const mergedGeometry = new THREE.BufferGeometry();
  mergedGeometry.setAttribute(
    "position",
    new THREE.BufferAttribute(mergedPositions, 3),
  );
  mergedGeometry.setAttribute(
    "normal",
    new THREE.BufferAttribute(mergedNormals, 3),
  );
  mergedGeometry.setAttribute(
    "color",
    new THREE.BufferAttribute(mergedColors, 3),
  );
  if (mergedIndices.length > 0) {
    mergedGeometry.setIndex(mergedIndices);
  }
  mergedGeometry.computeBoundingSphere();
  mergedGeometry.computeBoundingBox();

  // Create material with vertex colors using MeshBasicNodeMaterial for WebGPU compatibility
  const { MeshBasicNodeMaterial } = await import("three/webgpu");
  const { vertexColor } = await import("three/tsl");

  const material = new MeshBasicNodeMaterial();
  material.colorNode = vertexColor("color"); // Read from vertex color attribute
  material.side = THREE.DoubleSide;

  const bakedMesh = new THREE.Mesh(mergedGeometry, material);
  group.add(bakedMesh);

  console.log(
    `[GrassBaking] Created baking source with clump geometry: ${instanceCount} clumps (5 blades each), ${mergedPositions.length / 3} vertices`,
  );

  return group;
}

/**
 * Dispose the grass baking source.
 */
function disposeGrassBakingSource(): void {
  if (grassBakingSource) {
    grassBakingSource.traverse((node) => {
      if (node instanceof THREE.Mesh) {
        node.geometry.dispose();
        (node.material as THREE.Material).dispose();
      }
    });
    grassBakingSource = null;
  }
}

/**
 * Bake grass tile into an octahedral impostor.
 */
async function bakeGrassImpostor(): Promise<void> {
  if (!currentGrass) {
    alert("Generate a grass tile first!");
    return;
  }

  const gridSize = parseInt(grassImpostorGridSizeInput.value, 10) || 8;
  const atlasSize = parseInt(grassImpostorAtlasSizeSelect.value, 10) || 512;

  grassImpostorStatusSpan.textContent = `Baking ${gridSize}×${gridSize}...`;

  const startTime = performance.now();

  // Clean up previous impostor
  if (grassImpostorInstance) {
    scene.remove(grassImpostorInstance.mesh);
    grassImpostorInstance.dispose();
    grassImpostorInstance = null;
  }
  if (grassAtlasPlane) {
    scene.remove(grassAtlasPlane);
    grassAtlasPlane.geometry.dispose();
    (grassAtlasPlane.material as THREE.Material).dispose();
    grassAtlasPlane = null;
  }
  if (grassFieldInstancedMesh) {
    scene.remove(grassFieldInstancedMesh.mesh);
    grassFieldInstancedMesh.dispose();
    grassFieldInstancedMesh = null;
    showGrassFieldCheckbox.checked = false;
  }
  disposeGrassBakingSource();

  // Create impostor baker if needed
  if (!grassImpostor) {
    grassImpostor = new OctahedralImpostor(renderer);
  }

  // Create static baking source from the grass instances
  // This converts the shader-based SpriteNodeMaterial grass to actual geometry
  grassBakingSource = await createGrassBakingSource(currentGrass);

  try {
    // Bake the grass tile - use HEMI octahedron since grass is on the ground
    grassImpostorBakeResult = await grassImpostor.bakeWithNormals(
      grassBakingSource,
      {
        atlasWidth: atlasSize,
        atlasHeight: atlasSize,
        gridSizeX: gridSize,
        gridSizeY: gridSize,
        octType: OctahedronType.HEMI,
        backgroundColor: 0x000000,
        backgroundAlpha: 0,
      },
    );
  } catch (e) {
    console.error("Grass impostor baking failed:", e);
    grassImpostorStatusSpan.textContent = "FAILED";
    disposeGrassBakingSource();
    return;
  }

  const bakeTime = performance.now() - startTime;

  // Create impostor instance
  grassImpostorInstance = grassImpostor.createInstance(
    grassImpostorBakeResult,
    1.0,
    { useTSL: true },
  );
  grassImpostorInstance.mesh.position.set(
    currentGrass.config.patchSize * 1.5,
    currentGrass.config.blade.height / 2,
    0,
  );
  grassImpostorInstance.mesh.visible = showGrassImpostorCheckbox.checked;
  scene.add(grassImpostorInstance.mesh);

  // Create atlas preview plane
  const atlasTexture = grassImpostorBakeResult.atlasTexture;
  if (atlasTexture) {
    const previewSize = currentGrass.config.patchSize;
    const atlasGeo = new THREE.PlaneGeometry(previewSize, previewSize);
    const atlasMat = new THREE.MeshBasicMaterial({
      map: atlasTexture,
      side: THREE.DoubleSide,
      transparent: true,
    });
    grassAtlasPlane = new THREE.Mesh(atlasGeo, atlasMat);
    grassAtlasPlane.position.set(
      -currentGrass.config.patchSize * 1.5,
      previewSize / 2 + 1,
      0,
    );
    grassAtlasPlane.visible = showGrassAtlasCheckbox.checked;
    scene.add(grassAtlasPlane);
  }

  grassImpostorStatusSpan.textContent = `${bakeTime.toFixed(0)}ms (${gridSize}×${gridSize} @ ${atlasSize}px)`;
}

/**
 * Generate a field of grass impostors.
 */
function generateGrassField(): void {
  // Clean up existing field
  if (grassFieldInstancedMesh) {
    scene.remove(grassFieldInstancedMesh.mesh);
    grassFieldInstancedMesh.dispose();
    grassFieldInstancedMesh = null;
  }

  if (!grassImpostorBakeResult || !grassImpostor) {
    alert("Bake a grass impostor first!");
    showGrassFieldCheckbox.checked = false;
    return;
  }

  const gridSize = parseInt(grassFieldSizeInput.value, 10) || 20;
  const spacing = parseFloat(grassFieldSpacingInput.value) || 4;

  console.log(
    `[Grass Field] Generating ${gridSize}×${gridSize} grass tile impostors...`,
  );
  const startTime = performance.now();

  // Total instances in grid
  const totalInstances = gridSize * gridSize;

  // Get tile dimensions from current grass config
  const tileSize = currentGrass?.config.patchSize ?? 4;
  const tileHeight = currentGrass?.config.blade.height ?? 0.5;

  // Create instanced mesh using the impostor baker
  // Pass grass green tint to color the white/grayscale impostor
  const grassGreen = new THREE.Color(
    GAME_GRASS_CONFIG.BASE_COLOR.r,
    GAME_GRASS_CONFIG.BASE_COLOR.g,
    GAME_GRASS_CONFIG.BASE_COLOR.b,
  );
  const instanced = grassImpostor.createInstancedMesh(
    grassImpostorBakeResult,
    totalInstances,
    tileSize * 1.1, // Slight overlap to hide seams
    { colorTint: grassGreen },
  );

  // Position instances in a grid centered at origin
  const halfGrid = ((gridSize - 1) * spacing) / 2;
  const matrix = new THREE.Matrix4();
  const position = new THREE.Vector3();
  const quaternion = new THREE.Quaternion();
  const scale = new THREE.Vector3(1, 1, 1);

  // Rotation increments: 0°, 90°, 180°, 270°
  const rotationAngles = [0, Math.PI * 0.5, Math.PI, Math.PI * 1.5];

  let instanceIndex = 0;
  for (let z = 0; z < gridSize; z++) {
    for (let x = 0; x < gridSize; x++) {
      const px = x * spacing - halfGrid;
      const pz = z * spacing - halfGrid;
      const py = tileHeight / 2; // Center impostor at blade height / 2

      // Add variance: random 90° rotation increments
      const rotationIndex = Math.floor(Math.random() * 4);
      const randomRotationY = rotationAngles[rotationIndex];

      // Random X-axis flip for additional variance
      const flipX = Math.random() > 0.5 ? -1 : 1;

      // Slight scale variation
      const randomScale = 0.95 + Math.random() * 0.1;

      position.set(px, py, pz);
      quaternion.setFromEuler(new THREE.Euler(0, randomRotationY, 0));
      scale.set(flipX * randomScale, randomScale, randomScale);

      matrix.compose(position, quaternion, scale);
      instanced.mesh.setMatrixAt(instanceIndex, matrix);
      instanceIndex++;
    }
  }

  instanced.mesh.instanceMatrix.needsUpdate = true;
  instanced.mesh.frustumCulled = false;

  grassFieldInstancedMesh = instanced;
  scene.add(grassFieldInstancedMesh.mesh);

  const genTime = (performance.now() - startTime).toFixed(0);
  console.log(
    `[Grass Field] Generated ${totalInstances} instanced impostors in ${genTime}ms (SINGLE DRAW CALL)`,
  );

  // Update UI
  grassFieldTileCountSpan.textContent = `${totalInstances} (instanced)`;

  // Adjust camera to see the field
  const fieldRadius = halfGrid * 1.5;
  controls.target.set(0, 0, 0);
  camera.position.set(fieldRadius, fieldRadius * 0.5, fieldRadius);
}

// ============================================================================
// GRASS LOD SYSTEM - Geometry near, Impostor far
// ============================================================================

/**
 * Dispose the grass LOD system.
 */
function disposeGrassLodSystem(): void {
  if (!grassLodSystem) return;

  // Dispose LOD0 mesh (single instanced mesh)
  if (grassLodSystem.lod0Mesh) {
    scene.remove(grassLodSystem.lod0Mesh);
    grassLodSystem.lod0Mesh.geometry.dispose();
    if (grassLodSystem.lod0Mesh.material instanceof THREE.Material) {
      grassLodSystem.lod0Mesh.material.dispose();
    }
    grassLodSystem.lod0Mesh = null;
  }

  if (grassLodSystem.lod0Geometry) {
    grassLodSystem.lod0Geometry.dispose();
  }
  if (grassLodSystem.lod0Material) {
    grassLodSystem.lod0Material.dispose();
  }

  // Dispose LOD1 mesh
  if (grassLodSystem.lod1Mesh) {
    scene.remove(grassLodSystem.lod1Mesh.mesh);
    grassLodSystem.lod1Mesh.dispose();
  }

  grassLodSystem = null;
  grassLod0CountSpan.textContent = "0";
  grassLod1CountSpan.textContent = "0";
}

/**
 * Create the grass LOD system with geometry for near and impostors for far.
 */
async function generateGrassLodField(): Promise<void> {
  // Dispose existing
  disposeGrassLodSystem();

  if (
    !grassBakingSource ||
    !grassImpostorBakeResult ||
    !grassImpostor ||
    !currentGrass
  ) {
    alert("Generate grass tile and bake impostor first!");
    return;
  }

  const startTime = performance.now();

  const gridSize = parseInt(grassFieldSizeInput.value, 10) || 20;
  const spacing = parseFloat(grassFieldSpacingInput.value) || 4;
  const lodDistance = parseFloat(grassLodDistanceInput.value) || 30;
  const tileSize = currentGrass.config.patchSize;
  const tileHeight = currentGrass.config.blade.height;

  console.log(
    `[Grass LOD] Creating ${gridSize}×${gridSize} field with LOD transition at ${lodDistance}m`,
  );

  const totalTiles = gridSize * gridSize;
  const halfGrid = ((gridSize - 1) * spacing) / 2;

  // Initialize LOD system
  grassLodSystem = {
    lod0Mesh: null,
    lod0Geometry: null,
    lod0Material: null,
    lod1Mesh: null,
    tiles: [],
    gridSize,
    spacing,
    lodDistance,
    tileSize,
    tileHeight,
    lod0Visible: 0,
    lod1Visible: 0,
  };

  // Simple hash function for deterministic randomness
  const hash = (x: number, z: number): number => {
    let h = x * 374761393 + z * 668265263;
    h = (h ^ (h >> 13)) * 1274126177;
    return h ^ (h >> 16);
  };

  // Build tile grid with random variations (deterministic based on position hash)
  for (let z = 0; z < gridSize; z++) {
    for (let x = 0; x < gridSize; x++) {
      const px = x * spacing - halfGrid;
      const pz = z * spacing - halfGrid;

      // Use position-based hash for truly random-looking but deterministic variation
      // variationIndex 0-7: lower 2 bits = rotation (0-3), bit 2 = mirror
      const h = hash(x, z);
      const variationIndex = (h >>> 0) % 8; // Ensure positive

      grassLodSystem.tiles.push({
        x: px,
        z: pz,
        distanceFromCamera: 0,
        variationIndex,
      });
    }
  }

  // ========== LOD0: Single InstancedMesh (1 draw call!) ==========
  // Clone the baking source geometry
  const sourceGeometry = (
    grassBakingSource.children[0] as THREE.Mesh
  ).geometry.clone();
  grassLodSystem.lod0Geometry = sourceGeometry;

  // Create material for LOD0 using vertex colors
  const { MeshBasicNodeMaterial } = await import("three/webgpu");
  const { vertexColor } = await import("three/tsl");

  const lod0Material = new MeshBasicNodeMaterial();
  lod0Material.colorNode = vertexColor("color");
  lod0Material.side = THREE.DoubleSide;
  grassLodSystem.lod0Material = lod0Material;

  // Create single InstancedMesh for ALL LOD0 tiles
  // Rotation/mirror is baked into each instance's matrix = 1 draw call!
  const lod0InstancedMesh = new THREE.InstancedMesh(
    sourceGeometry,
    lod0Material,
    totalTiles,
  );
  lod0InstancedMesh.frustumCulled = false;
  lod0InstancedMesh.count = 0; // Start with 0 visible
  lod0InstancedMesh.name = "GrassLOD0_Instanced";

  grassLodSystem.lod0Mesh = lod0InstancedMesh;
  scene.add(lod0InstancedMesh);

  // ========== LOD1: Impostor instances ==========
  // Pass grass green tint to color the white/grayscale impostor
  const grassGreenTint = new THREE.Color(
    GAME_GRASS_CONFIG.BASE_COLOR.r,
    GAME_GRASS_CONFIG.BASE_COLOR.g,
    GAME_GRASS_CONFIG.BASE_COLOR.b,
  );
  const lod1Instanced = grassImpostor.createInstancedMesh(
    grassImpostorBakeResult,
    totalTiles,
    tileSize * 1.1,
    { colorTint: grassGreenTint },
  );
  lod1Instanced.mesh.frustumCulled = false;
  lod1Instanced.mesh.count = 0; // Start with 0 visible
  lod1Instanced.mesh.name = "GrassLOD1_Impostor";

  grassLodSystem.lod1Mesh = lod1Instanced;
  scene.add(lod1Instanced.mesh);

  // Initial LOD update
  updateGrassLodSystem();

  const genTime = (performance.now() - startTime).toFixed(0);
  console.log(`[Grass LOD] System created in ${genTime}ms`);

  // Adjust camera
  const fieldRadius = halfGrid * 1.5;
  controls.target.set(0, 0, 0);
  camera.position.set(fieldRadius, fieldRadius * 0.5, fieldRadius);
}

/**
 * Update the grass LOD system based on camera position.
 * Assigns tiles to LOD0 (geometry) or LOD1 (impostor) based on distance.
 */
function updateGrassLodSystem(): void {
  if (!grassLodSystem || !grassLodSystem.lod0Mesh) return;

  const lodDistanceSq = grassLodSystem.lodDistance * grassLodSystem.lodDistance;
  const cameraX = camera.position.x;
  const cameraZ = camera.position.z;

  // Track instance counts
  let lod0Count = 0;
  let lod1Count = 0;

  // Rotation lookup: 0°, 90°, 180°, 270°
  const rotations = [0, Math.PI * 0.5, Math.PI, Math.PI * 1.5];

  // Matrices for positioning
  const matrix = new THREE.Matrix4();
  const position = new THREE.Vector3();
  const quaternion = new THREE.Quaternion();
  const scale = new THREE.Vector3(1, 1, 1);

  // Assign each tile to a LOD
  for (let i = 0; i < grassLodSystem.tiles.length; i++) {
    const tile = grassLodSystem.tiles[i];

    // Calculate distance from camera (XZ plane)
    const dx = tile.x - cameraX;
    const dz = tile.z - cameraZ;
    const distSq = dx * dx + dz * dz;
    tile.distanceFromCamera = Math.sqrt(distSq);

    // Determine position (Y at ground level, geometry has height baked in)
    position.set(tile.x, 0, tile.z);

    if (distSq < lodDistanceSq && showGrassLod0Checkbox.checked) {
      // LOD0: Use geometry - bake rotation/mirror into instance matrix
      // variationIndex 0-7: lower 2 bits = rotation (0-3), bit 2 = mirror
      const rotationIndex = tile.variationIndex & 3;
      const mirrorX = tile.variationIndex & 4 ? -1 : 1;

      // Slight scale variation per tile
      const randomScale =
        0.97 + (((i * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff) * 0.06;

      quaternion.setFromEuler(new THREE.Euler(0, rotations[rotationIndex], 0));
      scale.set(mirrorX * randomScale, randomScale, randomScale);

      matrix.compose(position, quaternion, scale);
      grassLodSystem.lod0Mesh.setMatrixAt(lod0Count, matrix);
      lod0Count++;
    } else if (showGrassLod1Checkbox.checked && grassLodSystem.lod1Mesh) {
      // LOD1: Use impostor
      const py = grassLodSystem.tileHeight / 2;
      position.set(tile.x, py, tile.z);

      // Use same variation as LOD0 for consistency
      const rotationIndex = tile.variationIndex & 3;
      const mirrorX = tile.variationIndex & 4 ? -1 : 1;
      const randomScale =
        0.95 + (((i * 48271 + 65537) & 0x7fffffff) / 0x7fffffff) * 0.1;

      quaternion.setFromEuler(new THREE.Euler(0, rotations[rotationIndex], 0));
      scale.set(mirrorX * randomScale, randomScale, randomScale);

      matrix.compose(position, quaternion, scale);
      grassLodSystem.lod1Mesh.mesh.setMatrixAt(lod1Count, matrix);
      lod1Count++;
    }
  }

  // Update instance counts
  grassLodSystem.lod0Mesh.count = lod0Count;
  grassLodSystem.lod0Mesh.instanceMatrix.needsUpdate = true;

  if (grassLodSystem.lod1Mesh) {
    grassLodSystem.lod1Mesh.mesh.count = lod1Count;
    grassLodSystem.lod1Mesh.mesh.instanceMatrix.needsUpdate = true;
    // Update impostor view direction and billboard orientation
    // Note: billboarding is required for impostors - they must face the camera
    // The view-dependent atlas lookup provides the 3D appearance
    grassLodSystem.lod1Mesh.update(camera, false);
  }

  grassLodSystem.lod0Visible = lod0Count;
  grassLodSystem.lod1Visible = lod1Count;

  // Update UI
  grassLod0CountSpan.textContent = `${lod0Count}`;
  grassLod1CountSpan.textContent = `${lod1Count}`;
}

/**
 * Toggle grass field visibility.
 */
function toggleGrassField(): void {
  if (showGrassFieldCheckbox.checked) {
    if (!grassFieldInstancedMesh) {
      generateGrassField();
    } else {
      grassFieldInstancedMesh.mesh.visible = true;
    }
  } else {
    if (grassFieldInstancedMesh) {
      grassFieldInstancedMesh.mesh.visible = false;
    }
  }
}

/**
 * Update grass impostor visibility.
 */
function updateGrassImpostorVisibility(): void {
  if (grassImpostorInstance) {
    grassImpostorInstance.mesh.visible = showGrassImpostorCheckbox.checked;
  }
  if (grassAtlasPlane) {
    grassAtlasPlane.visible = showGrassAtlasCheckbox.checked;
  }
}

/**
 * Update grass tile visibility.
 */
function updateGrassTileVisibility(): void {
  if (currentGrass) {
    currentGrass.lod0Mesh.visible = !hideGrassTileCheckbox.checked;
  }
}

function generateCurrent(): void {
  switch (currentMode) {
    case "tree":
      generateTree();
      break;
    case "plant":
      generatePlant();
      break;
    case "rock":
      generateRock();
      break;
    case "building":
      generateBuilding();
      break;
    case "town":
      generateTown();
      break;
    case "grass":
      generateGrass();
      break;
  }
}

function formatLabel(value: string): string {
  return value
    .replace(/([A-Z])/g, " $1")
    .replace(/[-_]+/g, " ")
    .replace(/\s+/g, " ")
    .replace(/^./, (s) => s.toUpperCase())
    .trim();
}

function populatePlantPresets(): void {
  const presets = getPlantPresetNames();
  plantPresetSelect.innerHTML = "";
  for (const preset of presets) {
    const option = document.createElement("option");
    option.value = preset;
    option.textContent = formatLabel(preset);
    plantPresetSelect.appendChild(option);
  }
  if (presets.length > 0) {
    plantPresetSelect.value = presets[0];
  }
}

function populateBuildingTypes(): void {
  const types = Object.keys(BUILDING_RECIPES);
  buildingTypeSelect.innerHTML = "";
  for (const type of types) {
    const option = document.createElement("option");
    option.value = type;
    option.textContent = BUILDING_RECIPES[type]?.label ?? formatLabel(type);
    buildingTypeSelect.appendChild(option);
  }
  if (types.length > 0) {
    buildingTypeSelect.value = types[0];
  }
}

/**
 * Apply/remove wireframe to all meshes.
 */
function applyWireframe(enable: boolean): void {
  if (!currentTree) return;

  currentTree.group.traverse((child) => {
    if (child instanceof THREE.Mesh) {
      const material = child.material as THREE.MeshStandardMaterial;
      material.wireframe = enable;
    }
  });
}

/**
 * Update visibility of branches and leaves.
 */
function updateVisibility(): void {
  if (!currentTree) return;

  for (const branch of currentTree.branches) {
    branch.visible = showBranchesCheckbox.checked;
  }

  if (currentTree.leaves) {
    currentTree.leaves.visible = showLeavesCheckbox.checked;
  }

  if (currentTree.blossoms) {
    currentTree.blossoms.visible = showLeavesCheckbox.checked;
  }
}

/**
 * Animation loop.
 */
function animate(): void {
  requestAnimationFrame(animate);

  const now = performance.now();
  frameCount++;

  // Update FPS every 500ms
  if (now - fpsUpdateTime >= 500) {
    fps = Math.round((frameCount * 1000) / (now - fpsUpdateTime));
    frameCount = 0;
    fpsUpdateTime = now;

    // Update FPS display
    if (fpsSpan) {
      fpsSpan.textContent = fps.toString();
    }
  }

  lastFrameTime = now;

  controls.update();

  // Lighting for impostors - use actual scene lights
  const lightingParams = {
    lightDirection: directionalLight.position.clone().normalize(),
    lightColor: new THREE.Vector3(
      directionalLight.color.r,
      directionalLight.color.g,
      directionalLight.color.b,
    ),
    lightIntensity: directionalLight.intensity,
    ambientColor: new THREE.Vector3(
      ambientLight.color.r,
      ambientLight.color.g,
      ambientLight.color.b,
    ),
    ambientIntensity: ambientLight.intensity,
  };

  // Update single impostor to face camera and use correct atlas cell
  if (impostorInstance) {
    impostorInstance.update(camera);

    // Sync lighting with scene lights - MUST match scene lighting exactly
    if (impostorInstance.updateLighting) {
      impostorInstance.updateLighting(lightingParams);
    }
  }

  // Update instanced forest (SINGLE DRAW CALL for 1000 trees)
  if (forestInstancedMesh?.mesh.visible) {
    // Update billboard orientation and atlas view selection
    forestInstancedMesh.update(camera);

    // Update lighting uniforms on the shared material
    if (forestInstancedMesh.material.uniforms.lightDirection) {
      forestInstancedMesh.material.uniforms.lightDirection.value.copy(
        lightingParams.lightDirection,
      );
      forestInstancedMesh.material.uniforms.lightColor.value.copy(
        lightingParams.lightColor,
      );
      forestInstancedMesh.material.uniforms.lightIntensity.value =
        lightingParams.lightIntensity;
      forestInstancedMesh.material.uniforms.ambientColor.value.copy(
        lightingParams.ambientColor,
      );
      forestInstancedMesh.material.uniforms.ambientIntensity.value =
        lightingParams.ambientIntensity;
    }
  }

  // Update cluster billboards to face camera and refresh culling
  if (clusterMesh && showClustersCheckbox?.checked) {
    // Update cluster visualization when camera moves
    updateClusterVisualization();
  }

  // Hull meshes don't need per-frame updates

  // Update grass wind animation
  if (currentGrass) {
    const deltaTime = (now - lastFrameTime) / 1000;
    currentGrass.update(deltaTime > 0 ? deltaTime : 0.016);
  }

  // Update grass impostor to face camera
  if (grassImpostorInstance?.mesh.visible) {
    grassImpostorInstance.update(camera);
    if (grassImpostorInstance.updateLighting) {
      grassImpostorInstance.updateLighting(lightingParams);
    }
  }

  // Update grass field instanced impostors
  if (grassFieldInstancedMesh?.mesh.visible) {
    grassFieldInstancedMesh.update(camera);
  }

  // Update grass LOD system (assigns tiles to geometry or impostor based on distance)
  if (grassLodSystem) {
    updateGrassLodSystem();
  }

  // Reset render info before rendering to get per-frame stats
  renderer.info.reset();

  renderer.render(scene, camera);

  // Update draw calls and triangles per frame
  if (drawCallsSpan) {
    drawCallsSpan.textContent = renderer.info.render.calls.toString();
  }
  if (trisPerFrameSpan) {
    trisPerFrameSpan.textContent =
      renderer.info.render.triangles.toLocaleString();
  }
}

/**
 * Bake tree impostor atlas.
 */
async function bakeImpostor(): Promise<void> {
  if (!currentTree) {
    alert("Generate a tree first!");
    return;
  }

  // Get settings - separate X and Y grid sizes (defaults match demo: 31x31 @ 2048)
  const gridSizeX = parseInt(impostorGridSizeXInput.value, 10) || 31;
  const gridSizeY = parseInt(impostorGridSizeYInput.value, 10) || 31;
  const atlasSize = parseInt(impostorAtlasSizeSelect.value, 10) || 2048;
  const sourceMode = impostorSourceSelect.value as ImpostorSourceMode;

  const bakeSource =
    sourceMode === "tree"
      ? currentTree.group
      : sourceMode === "debugCube"
        ? getDebugCube()
        : getFlattenedSource();

  if (!bakeSource) {
    alert("No impostor source available.");
    return;
  }

  // Show baking status
  impostorStatusSpan.textContent = `Baking ${gridSizeX}x${gridSizeY}...`;

  const startTime = performance.now();

  // Clean up previous impostor and forest
  clearForest(); // Clear forest when re-baking (uses old atlas)
  showForestCheckbox.checked = false;

  if (impostorInstance) {
    scene.remove(impostorInstance.mesh);
    impostorInstance.dispose();
    impostorInstance = null;
  }
  if (treeImpostor) {
    treeImpostor.dispose();
    treeImpostor = null;
  }
  if (atlasPlane) {
    scene.remove(atlasPlane);
    atlasPlane = null;
  }
  if (normalAtlasPlane) {
    scene.remove(normalAtlasPlane);
    normalAtlasPlane = null;
  }

  // Check if lighting is enabled (checkbox in HTML)
  const enableLighting =
    (document.getElementById("impostorLighting") as HTMLInputElement)
      ?.checked ?? true;
  const enableVertexAO =
    (document.getElementById("impostorVertexAO") as HTMLInputElement)
      ?.checked ?? true;

  // Compute vertex AO if enabled (adds shading to the baked albedo)
  if (enableVertexAO && sourceMode === "tree" && currentTree) {
    impostorStatusSpan.textContent = `Computing AO...`;
    // Use quick AO for performance (height + normal based heuristic)
    // For full raycast AO, use: computeVertexAO(currentTree.group, { samples: 32 });
    computeQuickVertexAO(currentTree.group, { minAO: 0.4, falloff: 0.6 });
  }

  let bakeResult: ImpostorBakeResult | null = null;
  if (sourceMode === "tree") {
    // Create and bake impostor from live tree (TreeImpostor path)
    // Use TSL (WebGPU) materials since we're using WebGPURenderer
    treeImpostor = new TreeImpostor({
      gridSizeX,
      gridSizeY,
      atlasSize,
      alphaTest: 1,
      enableLighting, // Bake with normals for dynamic lighting
      useTSL: true, // WebGPU: Use TSL materials
    });

    try {
      await treeImpostor.bake(currentTree, renderer);
      bakeResult = treeImpostor.getBakeResult();
    } catch (e) {
      console.error("Baking failed:", e);
      impostorStatusSpan.textContent = "FAILED";
      return;
    }
  } else {
    // Bake impostor from debug/flattened source
    if (!debugImpostor) {
      debugImpostor = new OctahedralImpostor(renderer);
    }
    try {
      // Use bakeWithNormals if lighting is enabled, otherwise regular bake
      if (enableLighting) {
        bakeResult = await debugImpostor.bakeWithNormals(bakeSource, {
          atlasWidth: atlasSize,
          atlasHeight: atlasSize,
          gridSizeX,
          gridSizeY,
          octType: OctahedronType.HEMI,
          backgroundColor: 0x000000,
          backgroundAlpha: 0,
        });
      } else {
        bakeResult = await debugImpostor.bake(bakeSource, {
          atlasWidth: atlasSize,
          atlasHeight: atlasSize,
          gridSizeX,
          gridSizeY,
          octType: OctahedronType.HEMI,
          backgroundColor: 0x000000,
          backgroundAlpha: 0,
        });
      }
    } catch (e) {
      console.error("Baking failed:", e);
      impostorStatusSpan.textContent = "FAILED";
      return;
    }
  }

  const bakeTime = performance.now() - startTime;

  // Create impostor instance (positioned to the side for comparison)
  if (!bakeResult) {
    impostorStatusSpan.textContent = "FAILED";
    return;
  }
  impostorInstance =
    sourceMode === "tree" && treeImpostor
      ? treeImpostor.createInstance()
      : createImpostorInstanceFromBake(bakeResult);

  // Position impostor after the LOD displays (LOD0, LOD1, LOD2 are at spacing*1,2,3)
  let impostorX = 15;
  if (sourceMode === "tree" && currentTree) {
    const treeBox = new THREE.Box3().setFromObject(currentTree.group);
    const treeSize = treeBox.getSize(new THREE.Vector3());
    const spacing = Math.max(treeSize.x + 3, 5);
    impostorX = spacing * 4; // After LOD0, LOD1, LOD2
  }
  impostorInstance.mesh.position.x = impostorX;

  // Auto-show impostor after baking
  showImpostorCheckbox.checked = true;
  impostorInstance.mesh.visible = true;

  scene.add(impostorInstance.mesh);

  // Add impostor label
  if (sourceMode === "tree" && currentTree) {
    const treeBox = new THREE.Box3().setFromObject(currentTree.group);
    const treeSize = treeBox.getSize(new THREE.Vector3());
    const treeCenter = treeBox.getCenter(new THREE.Vector3());

    impostorLabel = createTextLabel("Impostor", "#ff00ff");
    impostorLabel.position.set(impostorX, treeCenter.y + treeSize.y / 2 + 2, 0);
    scene.add(impostorLabel);
  }

  // Create atlas preview planes
  const atlasTexture =
    sourceMode === "tree" && treeImpostor
      ? treeImpostor.getAtlasTexture()
      : bakeResult.atlasTexture;
  if (atlasTexture) {
    const atlasGeo = new THREE.PlaneGeometry(10, 10);
    const atlasMat = new THREE.MeshBasicMaterial({
      map: atlasTexture,
      side: THREE.DoubleSide,
      transparent: true,
    });
    atlasPlane = new THREE.Mesh(atlasGeo, atlasMat);
    atlasPlane.position.set(-15, 8, 0);
    atlasPlane.visible = showAtlasCheckbox.checked;
    scene.add(atlasPlane);
  }

  // Create normal atlas preview plane (if normals were baked)
  const normalAtlasTexture = bakeResult.normalAtlasTexture;
  if (normalAtlasTexture) {
    const normalGeo = new THREE.PlaneGeometry(10, 10);
    const normalMat = new THREE.MeshBasicMaterial({
      map: normalAtlasTexture,
      side: THREE.DoubleSide,
    });
    normalAtlasPlane = new THREE.Mesh(normalGeo, normalMat);
    normalAtlasPlane.position.set(-15, -5, 0); // Below color atlas
    normalAtlasPlane.visible = showNormalAtlasCheckbox.checked;
    scene.add(normalAtlasPlane);
  }

  // Create LOD display meshes (LOD0, LOD1, LOD2 shown to the left of the tree)
  if (sourceMode === "tree") {
    await createLODDisplayMeshes();
  }

  // Get dimensions for status display
  const hasLighting = bakeResult.normalAtlasTexture != null;
  let dimensionsInfo = "";
  if (sourceMode === "tree" && treeImpostor) {
    const dims = treeImpostor.getTreeDimensions();
    dimensionsInfo = ` | ${dims.width.toFixed(1)}×${dims.height.toFixed(1)}m`;
  }
  const lightingStatus = hasLighting ? " | lit" : " | unlit";
  impostorStatusSpan.textContent = `${bakeTime.toFixed(0)}ms (${gridSizeX}×${gridSizeY} @ ${atlasSize}px${dimensionsInfo}${lightingStatus})`;
}

/**
 * Update impostor visibility.
 */
function updateImpostorVisibility(): void {
  if (impostorInstance) {
    impostorInstance.mesh.visible = showImpostorCheckbox.checked;
  }
  if (atlasPlane) {
    atlasPlane.visible = showAtlasCheckbox.checked;
  }
  if (normalAtlasPlane) {
    normalAtlasPlane.visible = showNormalAtlasCheckbox.checked;
  }
}

/**
 * Update tree visibility (to compare with impostor).
 */
function updateTreeVisibility(): void {
  if (currentTree) {
    const visible = !hideTreeCheckbox.checked;
    currentTree.group.visible = visible;
  }
}

/**
 * Generate forest of 1000 impostors for performance testing.
 * Uses INSTANCED RENDERING for a single draw call.
 */
function generateForest(): void {
  // Clean up existing forest
  clearForest();

  if (!treeImpostor || !treeImpostor.getBakeResult()) {
    alert("Bake an impostor first before generating forest!");
    showForestCheckbox.checked = false;
    return;
  }

  const bakeResult = treeImpostor.getBakeResult();
  if (!bakeResult) return;

  console.log(
    `[Forest] Generating ${FOREST_COUNT} INSTANCED tree impostors...`,
  );
  const startTime = performance.now();

  // Get tree dimensions for proper sizing
  const dims = treeImpostor.getTreeDimensions();
  const baseSize = Math.max(dims.width, dims.height);
  const heightOffset = treeImpostor.getHeightOffset?.() ?? baseSize / 2;

  // Create instanced mesh - SINGLE DRAW CALL for all trees
  const instanced = treeImpostor.createInstancedMesh(FOREST_COUNT, 1.0);

  // Store per-instance data
  const positions: THREE.Vector3[] = [];
  const scales: number[] = [];
  const matrix = new THREE.Matrix4();
  const position = new THREE.Vector3();
  const quaternion = new THREE.Quaternion();
  const scaleVec = new THREE.Vector3();

  // Generate random positions and scales
  for (let i = 0; i < FOREST_COUNT; i++) {
    // Random position using polar coordinates for even distribution
    const angle = Math.random() * Math.PI * 2;
    const radius = Math.sqrt(Math.random()) * FOREST_RADIUS;
    const x = Math.cos(angle) * radius;
    const z = Math.sin(angle) * radius;

    // Random scale variation (80% to 120%)
    const scale = 0.8 + Math.random() * 0.4;

    // Y position: scale * (baseSize/2) + heightOffset to sit on ground
    const y = (scale * baseSize) / 2 + heightOffset * scale;

    position.set(x, y, z);
    positions.push(position.clone());
    scales.push(scale);

    // Set instance matrix with scale
    scaleVec.set(scale, scale, scale);
    matrix.compose(position, quaternion, scaleVec);
    instanced.mesh.setMatrixAt(i, matrix);
  }

  instanced.mesh.instanceMatrix.needsUpdate = true;
  instanced.mesh.frustumCulled = false; // For large forests, disable frustum culling per-instance

  // Extend instanced object with our position/scale data
  forestInstancedMesh = {
    ...instanced,
    positions,
    scales,
  };

  scene.add(forestInstancedMesh.mesh);

  const genTime = (performance.now() - startTime).toFixed(0);
  console.log(
    `[Forest] Generated ${FOREST_COUNT} instanced impostors in ${genTime}ms (SINGLE DRAW CALL)`,
  );

  // Update UI
  if (forestTreeCountSpan) {
    forestTreeCountSpan.textContent = `${FOREST_COUNT} (instanced)`;
  }
}

/**
 * Clear the forest.
 */
function clearForest(): void {
  // Clean up instanced mesh (new method)
  if (forestInstancedMesh) {
    scene.remove(forestInstancedMesh.mesh);
    forestInstancedMesh.dispose();
    forestInstancedMesh = null;
  }

  // Clean up legacy group-based forest
  if (forestGroup) {
    scene.remove(forestGroup);
    for (const instance of forestInstances) {
      instance.dispose();
    }
    forestGroup = null;
    forestInstances = [];
  }

  if (forestTreeCountSpan) {
    forestTreeCountSpan.textContent = "0";
  }
}

/**
 * Toggle forest visibility.
 */
function toggleForest(): void {
  if (showForestCheckbox.checked) {
    if (!forestInstancedMesh) {
      generateForest();
    } else {
      forestInstancedMesh.mesh.visible = true;
    }
  } else {
    if (forestInstancedMesh) {
      forestInstancedMesh.mesh.visible = false;
    }
  }
}

/**
 * Set up event listeners.
 */
function setupEventListeners(): void {
  generateBtn.addEventListener("click", generateTree);

  randomSeedBtn.addEventListener("click", () => {
    seedInput.value = Math.floor(Math.random() * 999999).toString();
    generateTree();
  });

  presetSelect.addEventListener("change", generateTree);

  wireframeCheckbox.addEventListener("change", () => {
    applyWireframe(wireframeCheckbox.checked);
  });

  showBranchesCheckbox.addEventListener("change", updateVisibility);
  showLeavesCheckbox.addEventListener("change", updateVisibility);

  // Instanced rendering toggle
  if (useInstancedCheckbox) {
    useInstancedCheckbox.addEventListener("change", generateTree);
  }

  // Generate on Enter key
  seedInput.addEventListener("keypress", (e) => {
    if (e.key === "Enter") {
      generateTree();
    }
  });

  radialSegmentsInput.addEventListener("keypress", (e) => {
    if (e.key === "Enter") {
      generateTree();
    }
  });

  maxLeavesInput.addEventListener("keypress", (e) => {
    if (e.key === "Enter") {
      generateTree();
    }
  });

  maxBranchDepthInput.addEventListener("keypress", (e) => {
    if (e.key === "Enter") {
      generateTree();
    }
  });

  // Impostor controls
  bakeImpostorBtn.addEventListener("click", bakeImpostor);
  exportFlattenedGlbBtn.addEventListener("click", exportFlattenedGlb);
  showImpostorCheckbox.addEventListener("change", updateImpostorVisibility);
  showAtlasCheckbox.addEventListener("change", updateImpostorVisibility);
  showNormalAtlasCheckbox.addEventListener("change", updateImpostorVisibility);
  hideTreeCheckbox.addEventListener("change", updateTreeVisibility);

  // Alpha threshold slider
  impostorAlphaThresholdInput.addEventListener("input", () => {
    const value = parseFloat(impostorAlphaThresholdInput.value);
    alphaThresholdValueSpan.textContent = value.toFixed(2);
    setImpostorAlphaThreshold(value);
  });
  showForestCheckbox.addEventListener("change", toggleForest);

  // Generator mode tabs
  for (const button of generatorTabButtons) {
    button.addEventListener("click", () => {
      const mode = parseGeneratorMode(button.getAttribute("data-mode"));
      if (!mode || mode === currentMode) return;
      disposeAllGenerated();
      setMode(mode);
      generateCurrent();
    });
  }

  // Plant controls
  generatePlantBtn.addEventListener("click", generatePlant);
  randomPlantSeedBtn.addEventListener("click", () => {
    plantSeedInput.value = Math.floor(Math.random() * 999999).toString();
    generatePlant();
  });
  plantPresetSelect.addEventListener("change", () => {
    if (currentMode === "plant") {
      generatePlant();
    }
  });
  plantQualitySelect.addEventListener("change", () => {
    if (currentMode === "plant") {
      generatePlant();
    }
  });
  plantSeedInput.addEventListener("keypress", (e) => {
    if (e.key === "Enter") {
      generatePlant();
    }
  });

  // Rock controls
  rockPresetGroupSelect.addEventListener("change", () => {
    updateRockPresetOptions();
    if (currentMode === "rock") {
      updateRockUIFromPreset(rockPresetSelect.value);
      generateRock();
    }
  });
  rockPresetSelect.addEventListener("change", () => {
    if (currentMode === "rock") {
      updateRockUIFromPreset(rockPresetSelect.value);
      generateRock();
    }
  });
  rockFlatShadingCheckbox.addEventListener("change", () => {
    if (currentMode === "rock") {
      generateRock();
    }
  });
  rockSubdivisionsInput.addEventListener("keypress", (e) => {
    if (e.key === "Enter") {
      generateRock();
    }
  });
  rockWireframeCheckbox.addEventListener("change", () => {
    if (currentRock) {
      applyRockWireframe(currentRock.mesh, rockWireframeCheckbox.checked);
    }
  });
  generateRockBtn.addEventListener("click", generateRock);
  randomRockSeedBtn.addEventListener("click", () => {
    rockSeedInput.value = `rock-${Math.floor(Math.random() * 10000)}`;
    generateRock();
  });

  // Rock advanced controls - regenerate on change
  const rockAdvancedInputs = [
    rockBaseShapeSelect,
    rockScaleXInput,
    rockScaleYInput,
    rockScaleZInput,
    rockNoiseScaleInput,
    rockNoiseAmplitudeInput,
    rockNoiseOctavesInput,
    rockNoiseLacunarityInput,
    rockNoisePersistenceInput,
    rockCrackDepthInput,
    rockCrackFrequencyInput,
    rockSmoothIterationsInput,
    rockSmoothStrengthInput,
    rockBaseColorInput,
    rockSecondaryColorInput,
    rockAccentColorInput,
    rockColorVariationInput,
    rockHeightBlendInput,
    rockSlopeBlendInput,
    rockAOIntensityInput,
    rockRoughnessInput,
    rockRoughnessVariationInput,
    rockMetalnessInput,
    // Procedural texture controls
    rockColorModeSelect,
    rockTexturePatternSelect,
    rockTextureScaleInput,
    rockTextureDetailInput,
    rockTextureContrastInput,
    rockTextureBlendInput,
    rockUVMethodSelect,
  ];

  for (const input of rockAdvancedInputs) {
    if (input) {
      input.addEventListener("change", () => {
        if (currentMode === "rock") {
          generateRock();
        }
      });
      // Also listen for Enter key on number/text inputs
      if (input.type === "number" || input.type === "text") {
        input.addEventListener("keypress", (e) => {
          if (e.key === "Enter" && currentMode === "rock") {
            generateRock();
          }
        });
      }
    }
  }

  // Building controls
  generateBuildingBtn.addEventListener("click", generateBuilding);
  randomBuildingSeedBtn.addEventListener("click", () => {
    const typeKey = buildingTypeSelect.value || "building";
    buildingSeedInput.value = `${typeKey}-${Math.floor(Math.random() * 10000)}`;
    generateBuilding();
  });
  buildingTypeSelect.addEventListener("change", () => {
    if (currentMode === "building") {
      generateBuilding();
    }
  });
  buildingIncludeRoofCheckbox.addEventListener("change", () => {
    if (currentMode === "building") {
      generateBuilding();
    }
  });
  buildingHideRoofsCheckbox.addEventListener(
    "change",
    updateBuildingRoofVisibility,
  );
  buildingSeedInput.addEventListener("keypress", (e) => {
    if (e.key === "Enter") {
      generateBuilding();
    }
  });

  // Town controls
  generateTownBtn.addEventListener("click", generateTown);
  randomTownSeedBtn.addEventListener("click", () => {
    townSeedInput.value = Math.floor(Math.random() * 999999).toString();
    generateTown();
  });
  townSizeSelect.addEventListener("change", () => {
    if (currentMode === "town") {
      generateTown();
    }
  });
  townShowSafeZoneCheckbox.addEventListener("change", () => {
    if (currentMode === "town") {
      generateTown();
    }
  });
  townShowBuildings3dCheckbox.addEventListener("change", () => {
    if (currentMode === "town") {
      generateTown();
    }
  });
  townSeedInput.addEventListener("keypress", (e) => {
    if (e.key === "Enter") {
      generateTown();
    }
  });

  // Grass controls
  generateGrassBtn.addEventListener("click", generateGrass);
  randomGrassSeedBtn.addEventListener("click", () => {
    grassSeedInput.value = Math.floor(Math.random() * 999999).toString();
    generateGrass();
  });
  grassBiomeSelect.addEventListener("change", () => {
    if (currentMode === "grass") {
      generateGrass();
    }
  });
  grassSeedInput.addEventListener("keypress", (e) => {
    if (e.key === "Enter") {
      generateGrass();
    }
  });
  grassDensityInput.addEventListener("keypress", (e) => {
    if (e.key === "Enter") {
      generateGrass();
    }
  });
  grassPatchSizeInput.addEventListener("keypress", (e) => {
    if (e.key === "Enter") {
      generateGrass();
    }
  });
  grassBladeHeightInput.addEventListener("keypress", (e) => {
    if (e.key === "Enter") {
      generateGrass();
    }
  });

  // Grass impostor controls
  bakeGrassImpostorBtn.addEventListener("click", bakeGrassImpostor);
  showGrassImpostorCheckbox.addEventListener(
    "change",
    updateGrassImpostorVisibility,
  );
  showGrassAtlasCheckbox.addEventListener(
    "change",
    updateGrassImpostorVisibility,
  );
  hideGrassTileCheckbox.addEventListener("change", updateGrassTileVisibility);

  // Grass field controls
  showGrassFieldCheckbox.addEventListener("change", toggleGrassField);
  grassFieldSizeInput.addEventListener("keypress", (e) => {
    if (e.key === "Enter" && showGrassFieldCheckbox.checked) {
      generateGrassField();
    }
  });
  grassFieldSpacingInput.addEventListener("keypress", (e) => {
    if (e.key === "Enter" && showGrassFieldCheckbox.checked) {
      generateGrassField();
    }
  });

  // Grass LOD system controls
  generateGrassLodFieldBtn.addEventListener("click", () => {
    generateGrassLodField();
  });
  showGrassLod0Checkbox.addEventListener("change", () => {
    updateGrassLodSystem();
  });
  showGrassLod1Checkbox.addEventListener("change", () => {
    updateGrassLodSystem();
  });
  grassLodDistanceInput.addEventListener("input", () => {
    if (grassLodSystem) {
      grassLodSystem.lodDistance =
        parseFloat(grassLodDistanceInput.value) || 30;
      updateGrassLodSystem();
    }
  });

  // Navigation controls
  navShowNavigationCheckbox.addEventListener("change", () => {
    const enabled = navShowNavigationCheckbox.checked;
    setVisible(navOptionsPanel, enabled);
    if (navigationVisualizer) {
      navigationVisualizer.setEnabled(enabled);
      if (enabled) {
        updateNavigationStats();
      }
    }
  });

  navShowWalkableTilesCheckbox.addEventListener(
    "change",
    updateNavigationOptions,
  );
  navShowDoorsCheckbox.addEventListener("change", updateNavigationOptions);
  navShowStairsCheckbox.addEventListener("change", updateNavigationOptions);
  navShowWallsCheckbox.addEventListener("change", updateNavigationOptions);
  navShowEntryPointsCheckbox.addEventListener(
    "change",
    updateNavigationOptions,
  );
  navShowDemoPathsCheckbox.addEventListener("change", updateNavigationOptions);

  navClearPathBtn.addEventListener("click", () => {
    if (navigationVisualizer) {
      navigationVisualizer.clearUserPath();
    }
  });

  // Leaf Cluster controls
  showClustersCheckbox?.addEventListener("change", updateClusterVisualization);
  showOctreeCellsCheckbox?.addEventListener(
    "change",
    updateClusterVisualization,
  );
  enableViewCullingCheckbox?.addEventListener(
    "change",
    updateClusterVisualization,
  );
  enableFrustumCullingCheckbox?.addEventListener(
    "change",
    updateClusterVisualization,
  );

  clusterDensityInput?.addEventListener("input", () => {
    const value = parseInt(clusterDensityInput.value, 10);
    clusterDensityValueSpan.textContent = `${value}%`;
    updateClusterVisualization();
  });

  cullThresholdInput?.addEventListener("input", () => {
    const value = parseInt(cullThresholdInput.value, 10) / 100;
    cullThresholdValueSpan.textContent = value.toFixed(2);
    updateClusterVisualization();
  });
}

// ============================================================================
// LEAF CLUSTER VISUALIZATION
// ============================================================================

/**
 * Generate cluster data from tree leaves using octree-based spatial clustering.
 */
function generateClusterData(tree: TreeMeshResult): ClusterData[] {
  const treeData = generator?.getLastTreeData();
  if (!treeData || treeData.leaves.length === 0) return [];

  const leaves = treeData.leaves;
  const positions: THREE.Vector3[] = leaves.map((l) => l.position.clone());

  // Calculate bounds
  const bounds = new THREE.Box3();
  for (const pos of positions) {
    bounds.expandByPoint(pos);
  }

  // Target cluster count based on leaf count
  const targetClusters = Math.max(
    20,
    Math.min(100, Math.ceil(leaves.length / 25)),
  );

  // Calculate octree cell size
  const size = new THREE.Vector3();
  bounds.getSize(size);
  const avgDim = (size.x + size.y + size.z) / 3;
  const cellSize = avgDim / Math.cbrt(targetClusters);

  // Build spatial hash map
  const cellMap = new Map<string, number[]>();
  const cellKey = (pos: THREE.Vector3) => {
    const x = Math.floor((pos.x - bounds.min.x) / cellSize);
    const y = Math.floor((pos.y - bounds.min.y) / cellSize);
    const z = Math.floor((pos.z - bounds.min.z) / cellSize);
    return `${x},${y},${z}`;
  };

  for (let i = 0; i < positions.length; i++) {
    const key = cellKey(positions[i]);
    if (!cellMap.has(key)) cellMap.set(key, []);
    cellMap.get(key)!.push(i);
  }

  // Extract clusters from cells
  const clusters: ClusterData[] = [];
  const minLeavesPerCluster = 3;

  for (const [, indices] of cellMap) {
    if (indices.length < minLeavesPerCluster) continue;

    // Calculate center
    const center = new THREE.Vector3();
    for (const idx of indices) center.add(positions[idx]);
    center.divideScalar(indices.length);

    // Calculate bounds for this cluster
    const clusterBounds = new THREE.Box3();
    for (const idx of indices) clusterBounds.expandByPoint(positions[idx]);

    const clusterSize = new THREE.Vector3();
    clusterBounds.getSize(clusterSize);

    // Calculate octree cell ID (4x4x4 = 64 cells)
    const nx = size.x > 0 ? (center.x - bounds.min.x) / size.x : 0.5;
    const ny = size.y > 0 ? (center.y - bounds.min.y) / size.y : 0.5;
    const nz = size.z > 0 ? (center.z - bounds.min.z) / size.z : 0.5;
    const cx = Math.min(3, Math.floor(nx * 4));
    const cy = Math.min(3, Math.floor(ny * 4));
    const cz = Math.min(3, Math.floor(nz * 4));
    const octreeCell = cx + cy * 4 + cz * 16;

    // Calculate density
    const volume = Math.max(
      0.001,
      clusterSize.x * clusterSize.y * clusterSize.z,
    );
    const density = indices.length / volume;

    clusters.push({
      center,
      size: {
        width: Math.max(0.5, Math.max(clusterSize.x, clusterSize.z) * 1.3),
        height: Math.max(0.5, clusterSize.y * 1.3),
      },
      density,
      leafCount: indices.length,
      octreeCell,
    });
  }

  return clusters;
}

/**
 * Create instanced mesh for cluster visualization.
 */
function createClusterMesh(clusters: ClusterData[]): THREE.InstancedMesh {
  // Create billboard quad geometry
  const geometry = new THREE.PlaneGeometry(1, 1);
  geometry.translate(0, 0.5, 0); // Anchor at bottom

  // Create material with color based on octree cell
  const material = new THREE.MeshBasicMaterial({
    color: 0x00ff00,
    transparent: true,
    opacity: 0.6,
    side: THREE.DoubleSide,
    depthWrite: false,
  });

  const mesh = new THREE.InstancedMesh(geometry, material, clusters.length);
  mesh.frustumCulled = false;

  // Set up instance transforms and colors
  const dummy = new THREE.Object3D();
  const colors = new Float32Array(clusters.length * 3);

  for (let i = 0; i < clusters.length; i++) {
    const cluster = clusters[i];

    dummy.position.copy(cluster.center);
    dummy.position.y -= cluster.size.height * 0.5;
    dummy.scale.set(cluster.size.width, cluster.size.height, 1);
    dummy.updateMatrix();
    mesh.setMatrixAt(i, dummy.matrix);

    // Color based on octree cell (rainbow gradient)
    const hue = cluster.octreeCell / 64;
    const color = new THREE.Color().setHSL(hue, 0.8, 0.5);
    colors[i * 3] = color.r;
    colors[i * 3 + 1] = color.g;
    colors[i * 3 + 2] = color.b;
  }

  mesh.instanceMatrix.needsUpdate = true;

  // Add instance colors
  const colorAttr = new THREE.InstancedBufferAttribute(colors, 3);
  mesh.geometry.setAttribute("instanceColor", colorAttr);
  mesh.instanceColor = colorAttr;

  return mesh;
}

/**
 * Create octree cell wireframe visualization.
 */
function createOctreeCellMesh(bounds: THREE.Box3): THREE.LineSegments {
  const size = new THREE.Vector3();
  bounds.getSize(size);

  const cellSize = new THREE.Vector3(size.x / 4, size.y / 4, size.z / 4);
  const vertices: number[] = [];

  // Create 4x4x4 grid lines
  for (let x = 0; x <= 4; x++) {
    for (let y = 0; y <= 4; y++) {
      for (let z = 0; z <= 4; z++) {
        const px = bounds.min.x + x * cellSize.x;
        const py = bounds.min.y + y * cellSize.y;
        const pz = bounds.min.z + z * cellSize.z;

        // X lines
        if (x < 4) {
          vertices.push(px, py, pz, px + cellSize.x, py, pz);
        }
        // Y lines
        if (y < 4) {
          vertices.push(px, py, pz, px, py + cellSize.y, pz);
        }
        // Z lines
        if (z < 4) {
          vertices.push(px, py, pz, px, py, pz + cellSize.z);
        }
      }
    }
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute(
    "position",
    new THREE.Float32BufferAttribute(vertices, 3),
  );

  const material = new THREE.LineBasicMaterial({
    color: 0xffff00,
    transparent: true,
    opacity: 0.3,
  });

  return new THREE.LineSegments(geometry, material);
}

/**
 * Update cluster visualization based on current settings.
 */
function updateClusterVisualization(): void {
  // Remove existing visualizations
  if (clusterMesh) {
    scene.remove(clusterMesh);
    clusterMesh.geometry.dispose();
    (clusterMesh.material as THREE.Material).dispose();
    clusterMesh = null;
  }
  if (octreeCellMesh) {
    scene.remove(octreeCellMesh);
    octreeCellMesh.geometry.dispose();
    (octreeCellMesh.material as THREE.Material).dispose();
    octreeCellMesh = null;
  }

  // Reset stats
  clusterStats = {
    total: 0,
    visible: 0,
    frustumCulled: 0,
    viewCulled: 0,
    densityCulled: 0,
  };

  if (!currentTree || !showClustersCheckbox?.checked) {
    updateClusterStats();
    return;
  }

  // Generate clusters if needed
  if (clusterData.length === 0) {
    clusterData = generateClusterData(currentTree);
  }

  if (clusterData.length === 0) {
    updateClusterStats();
    return;
  }

  // Get settings
  const density =
    (clusterDensityInput?.value
      ? parseInt(clusterDensityInput.value, 10)
      : 100) / 100;
  const cullThreshold =
    (cullThresholdInput?.value ? parseInt(cullThresholdInput.value, 10) : -30) /
    100;
  const enableViewCull = enableViewCullingCheckbox?.checked ?? true;
  const enableFrustumCull = enableFrustumCullingCheckbox?.checked ?? true;

  // Filter clusters based on culling
  const visibleClusters: ClusterData[] = [];
  const cameraPos = camera.position;
  const treeCenter = new THREE.Vector3(0, 0, 0); // Assume tree at origin

  for (let i = 0; i < clusterData.length; i++) {
    const cluster = clusterData[i];
    clusterStats.total++;

    // Density culling (deterministic based on index)
    const densityHash = ((i * 12345 + 67890) % 1000) / 1000;
    if (densityHash > density) {
      clusterStats.densityCulled++;
      continue;
    }

    // Frustum culling (simplified - check if in front of camera)
    if (enableFrustumCull) {
      const toCluster = cluster.center.clone().sub(cameraPos);
      const cameraDir = new THREE.Vector3(0, 0, -1).applyQuaternion(
        camera.quaternion,
      );
      if (toCluster.dot(cameraDir) < 0) {
        clusterStats.frustumCulled++;
        continue;
      }
    }

    // View-dependent culling
    if (enableViewCull) {
      const viewDir = new THREE.Vector2(
        treeCenter.x - cameraPos.x,
        treeCenter.z - cameraPos.z,
      ).normalize();

      // Extract cell position from octree ID
      const cellX = cluster.octreeCell % 4;
      const cellZ = Math.floor(cluster.octreeCell / 16);
      const normalizedX = (cellX - 1.5) / 1.5;
      const normalizedZ = (cellZ - 1.5) / 1.5;

      const facingDot = normalizedX * viewDir.x + normalizedZ * viewDir.y;

      if (facingDot < cullThreshold) {
        clusterStats.viewCulled++;
        continue;
      }
    }

    visibleClusters.push(cluster);
    clusterStats.visible++;
  }

  // Create visualization for visible clusters
  if (visibleClusters.length > 0) {
    clusterMesh = createClusterMesh(visibleClusters);
    scene.add(clusterMesh);
  }

  // Show octree cells if enabled
  if (showOctreeCellsCheckbox?.checked && clusterData.length > 0) {
    // Calculate bounds from clusters
    const bounds = new THREE.Box3();
    for (const cluster of clusterData) {
      bounds.expandByPoint(cluster.center);
    }
    bounds.expandByScalar(1); // Add padding

    octreeCellMesh = createOctreeCellMesh(bounds);
    scene.add(octreeCellMesh);
  }

  updateClusterStats();
}

/**
 * Update cluster statistics display.
 */
function updateClusterStats(): void {
  if (clusterCountSpan)
    clusterCountSpan.textContent = clusterStats.total.toString();
  if (visibleClustersSpan)
    visibleClustersSpan.textContent = clusterStats.visible.toString();
  if (frustumCulledSpan)
    frustumCulledSpan.textContent = clusterStats.frustumCulled.toString();
  if (viewCulledSpan)
    viewCulledSpan.textContent = clusterStats.viewCulled.toString();
  if (densityCulledSpan)
    densityCulledSpan.textContent = clusterStats.densityCulled.toString();
}

/**
 * Initialize the application.
 */
async function init(): Promise<void> {
  await initScene();
  populatePlantPresets();
  updateRockPresetOptions();
  populateBuildingTypes();
  setupEventListeners();
  const activeTab = document.querySelector<HTMLButtonElement>(
    "[data-generator-tab].active",
  );
  const initialMode =
    parseGeneratorMode(activeTab?.getAttribute("data-mode") ?? null) ?? "tree";
  setMode(initialMode);
  generateCurrent();

  // Auto-bake impostor on init for tree mode
  if (initialMode === "tree") {
    // Use requestAnimationFrame to ensure tree is fully generated first
    requestAnimationFrame(() => {
      bakeImpostor();
      // Frame camera to show atlas, tree, and impostor together
      frameCameraForImpostorView();
    });
  }

  animate();
}

/**
 * Frame camera to show atlas (-15,8,0), tree (0,0,0), and impostor (15,y,0) together.
 */
function frameCameraForImpostorView(): void {
  // Position camera to see all three elements:
  // Atlas at x=-15, tree at x=0, impostor at x=15
  // Camera positioned to frame all three with some padding
  camera.position.set(0, 15, 40);
  controls.target.set(0, 7, 0);
  controls.update();
}

// Start
init();
