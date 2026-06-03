/**
 * @hyperforge/procgen/plant - Type Definitions
 *
 * Comprehensive type definitions for procedural plant generation.
 * Based on the Unity Procedural-Plant-and-Foliage-Generator.
 *
 * @packageDocumentation
 */

import type { BufferGeometry, Group } from "three";

// =============================================================================
// BASIC MATH TYPES
// =============================================================================

/**
 * 2D point representation
 */
export interface Point2D {
  x: number;
  y: number;
}

/**
 * 3D point representation
 */
export interface Point3D {
  x: number;
  y: number;
  z: number;
}

/**
 * Polar coordinate
 */
export interface Polar {
  radius: number;
  angle: number; // radians
}

/**
 * Axis flags for selective operations
 */
export enum Axis {
  None = 0,
  X = 1,
  Y = 2,
  Z = 4,
  XY = 3,
  XZ = 5,
  YZ = 6,
  XYZ = 7,
}

// =============================================================================
// CURVE TYPES
// =============================================================================

/**
 * Types of leaf curves
 */
export enum LeafCurveType {
  FullSide = "FullSide",
  LowerHalf = "LowerHalf",
  LobeOuter = "LobeOuter",
  LobeInner = "LobeInner",
  Scoop = "Scoop",
  Tip = "Tip",
  Vein = "Vein",
}

/**
 * Cubic Bezier curve in 2D
 */
export interface Curve2D {
  p0: Point2D; // Start point
  h0: Point2D; // Start handle
  h1: Point2D; // End handle
  p1: Point2D; // End point
}

/**
 * Cubic Bezier curve in 3D
 */
export interface Curve3D {
  p0: Point3D;
  h0: Point3D;
  h1: Point3D;
  p1: Point3D;
}

/**
 * Leaf-specific curve with metadata
 */
export interface LeafCurve extends Curve2D {
  curveType: LeafCurveType;
  lefty: boolean; // Is this a mirrored (left side) curve
  nextCurve: LeafCurve | null;
  prevCurve: LeafCurve | null;
}

// =============================================================================
// VEIN TYPES
// =============================================================================

/**
 * Types of leaf veins
 */
export enum LeafVeinType {
  Midrib = "Midrib",
  LobeRib = "LobeRib",
  MidToMargin = "MidToMargin",
  LobeToMargin = "LobeToMargin",
  MarginSpanning = "MarginSpanning",
  MidToSplit = "MidToSplit",
  LobeToSplit = "LobeToSplit",
  SplitEndPrimary = "SplitEndPrimary",
  SplitEndSecondary = "SplitEndSecondary",
}

/**
 * Individual vein data
 */
export interface LeafVein extends Curve3D {
  type: LeafVeinType;
  lefty: boolean;
  thickness: number;
  taper: number;
  taperRNG: number;
  startThickness: number;
  endThickness: number;
  pointAlongMargin: number;
  posAlongMidrib: number;
}

/**
 * Group of related veins
 */
export interface LeafVeinGroup {
  veins: LeafVein[];
  rightVeins: LeafVein[];
  leftVeins: LeafVein[];
}

/**
 * Vein calculation intermediate data
 */
export interface LeafVeinCalcs {
  origin: Point3D;
  tip: Point3D;
  apex: Point3D;
  apexPos: number;
}

/**
 * Parameters for building spanning veins
 */
export interface SpanningVeinParams {
  buffer: number;
  index: number;
  spacing: number;
  totalCount: number;
  mirror: boolean;
  mirrorRoot: boolean;
  bunching: number;
  reverseDirection: boolean;
  fromVein: LeafVein;
}

/**
 * Data for margin-spanning vein connections
 */
export interface SpannerData {
  marginPoint: Point3D;
  rootPoint: Point3D;
  thickness: number;
}

// =============================================================================
// DISTORTION TYPES
// =============================================================================

/**
 * Types of leaf distortions
 */
export enum LeafDistortionType {
  Curl = "Curl",
  Cup = "Cup",
  Wave = "Wave",
  Flop = "Flop",
}

/**
 * Configuration for a distortion curve
 */
export interface DistortionCurveConfig {
  affectAxes: Axis;
  maxFadeDist: number;
  useDistFade: boolean;
  reverseFade: boolean;
  skipOutsideLowerBound: boolean;
  type: LeafDistortionType;
}

/**
 * A distortion effect definition
 */
export interface DistortionCurve {
  influenceCurves: Curve3D[];
  distortionPoints: Point3D[];
  config: DistortionCurveConfig;
  shouldFade: boolean;
}

// =============================================================================
// MESH TYPES
// =============================================================================

/**
 * Raw mesh data before conversion to BufferGeometry
 */
export interface MeshData {
  vertices: Point3D[];
  triangles: number[];
  uvs: Point2D[];
  colors: number[]; // RGBA per vertex
  normals: Point3D[];
  orderedEdgeVerts: number[];
}

/**
 * Leaf factory output data
 */
export interface LeafFactoryData {
  leafShape: LeafShapeData;
  leafVeins: LeafVeinsData;
  distortionCurves: DistortionCurve[][];
  baseMesh: MeshData;
  leafMesh: MeshData;
  center: Point2D;
  min: Point2D;
  max: Point2D;
}

/**
 * Leaf shape data
 */
export interface LeafShapeData {
  curves: LeafCurve[];
}

/**
 * Leaf veins data
 */
export interface LeafVeinsData {
  veinGroups: LeafVeinGroup[];
  linearPoints: Point3D[];
  gravityPoints: Point3D[];
}

// =============================================================================
// TEXTURE TYPES
// =============================================================================

/**
 * Texture types that can be generated
 */
export enum TextureType {
  Albedo = "Albedo",
  Normal = "Normal",
  Height = "Height",
  VeinMask = "VeinMask",
  Clipping = "Clipping",
}

/**
 * Texture generation variables
 */
export interface TextureVars {
  imgSize: number;
  downsample: number;
  normalSupersample: number;
  shadowSize: number;
  lineSteps: number;
  veinLineSteps: number;
  shadowColor: HSLColor;
  radianceColor: HSLColor;
  leafPoints: Point2D[];
  rendVeins: RenderableVein[];
  puffies: Point2D[][];
}

/**
 * Vein prepared for texture rendering
 */
export interface RenderableVein {
  vein: LeafVein;
  basePoints: Point2D[];
  radiancePoints: Point2D[];
  shadowPoints: Point2D[];
  normalPoints: Point2D[];
  centerPoints: Point2D[];
}

// =============================================================================
// ARRANGEMENT TYPES
// =============================================================================

/**
 * Data for positioning a single leaf in the plant
 */
export interface ArrangementData {
  pos: Point3D;
  stemRotation: { x: number; y: number; z: number; w: number }; // Quaternion
  leafZAngle: number;
  scale: number;
  stemLengthAdd: number;
  stemLengthMult: number;
  stemFlopMult: number;
  stemFlopAdd: number;
  potScale: number;
}

/**
 * Leaf bundle - a single leaf with its stem
 */
export interface LeafBundle {
  leafMesh: BufferGeometry;
  stemMesh: BufferGeometry;
  leafStem: LeafStemData;
  arrangementData: ArrangementData;
  collisionAdjustment: Point3D;
  visible: boolean;
}

/**
 * Leaf stem bezier data
 */
export interface LeafStemData {
  curves: Curve3D[];
  length: number;
}

/**
 * Plant trunk data
 */
export interface PlantTrunkData {
  curves: Curve3D[];
  width: number;
}

// =============================================================================
// PARAMETER TYPES
// =============================================================================

/**
 * HSL color representation
 */
export interface HSLColor {
  h: number; // 0-1
  s: number; // 0-1
  l: number; // 0-1
}

/**
 * Range definition for a parameter
 */
export interface FloatRange {
  min: number;
  max: number;
  default: number;
}

/**
 * HSL range for color parameters
 */
export interface HSLRange {
  h: FloatRange;
  s: FloatRange;
  l: FloatRange;
}

/**
 * Parameter type categories
 */
export enum LPType {
  Leaf = "Leaf",
  Vein = "Vein",
  Texture = "Texture",
  Normal = "Normal",
  Material = "Material",
  Distort = "Distort",
  Stem = "Stem",
  Arrangement = "Arrangement",
}

/**
 * Parameter category for UI grouping
 */
export enum LPCategory {
  LeafShape = "LeafShape",
  Veins = "Veins",
  Color = "Color",
  Texture = "Texture",
  Distortion = "Distortion",
  Arrangement = "Arrangement",
}

/**
 * Randomization curve type
 */
export enum LPRandomValCurve {
  CenterBell = "CenterBell",
  CenterBellLRSplit = "CenterBellLRSplit",
}

/**
 * Randomization center bias
 */
export enum LPRandomValCenterBias {
  Default = "Default",
  Squeeze1 = "Squeeze1",
  Squeeze2 = "Squeeze2",
  Squeeze3 = "Squeeze3",
  Spread1 = "Spread1",
  Spread2 = "Spread2",
  Spread3 = "Spread3",
}

/**
 * Parameter importance for randomization
 */
export enum LPImportance {
  Disable = "Disable",
  Low = "Low",
  Medium = "Medium",
  High = "High",
}

/**
 * A single leaf parameter
 */
export interface LeafParam {
  key: LPK;
  value: number;
  colorValue?: HSLColor;
  hasColorValue: boolean;
  enabled: boolean;
  range: FloatRange;
  hslRange?: HSLRange;
  group: string;
  type: LPType;
  category: LPCategory;
  randomCurve: LPRandomValCurve;
  randomBias: LPRandomValCenterBias;
  importance: LPImportance;
  visible: boolean;
}

/**
 * Dictionary of all leaf parameters
 */
export type LeafParamDict = Record<LPK, LeafParam>;

// =============================================================================
// PARAMETER KEYS (LPK)
// =============================================================================

/**
 * All parameter keys for plant generation
 */
export enum LPK {
  // Gen 0 - Basic Shape
  Pudge = "Pudge",
  Sheer = "Sheer",
  Length = "Length",
  Width = "Width",
  TipAngle = "TipAngle",
  TipAmplitude = "TipAmplitude",

  // Gen 1 - Heart Shape
  Heart = "Heart",
  SinusSheer = "SinusSheer",
  SinusHeight = "SinusHeight",
  WaistAmp = "WaistAmp",
  WaistAmpOffset = "WaistAmpOffset",

  // Gen 2 - Lobes
  Lobes = "Lobes",
  LobeTilt = "LobeTilt",
  LobeAmplitude = "LobeAmplitude",
  LobeAmpOffset = "LobeAmpOffset",

  // Gen 3 - Scoop
  ScoopDepth = "ScoopDepth",
  ScoopHeight = "ScoopHeight",

  // Veins
  VeinDensity = "VeinDensity",
  VeinBunching = "VeinBunching",
  VeinLobeBunching = "VeinLobeBunching",
  VeinOriginRand = "VeinOriginRand",
  GravVeinUpperBias = "GravVeinUpperBias",
  GravVeinLowerBias = "GravVeinLowerBias",
  VeinEndOffset = "VeinEndOffset",
  VeinEndLerp = "VeinEndLerp",
  VeinDistFromMargin = "VeinDistFromMargin",
  MidribDistFromMargin = "MidribDistFromMargin",
  SpannerLerp = "SpannerLerp",
  SpannerSqueeze = "SpannerSqueeze",
  MidribThickness = "MidribThickness",
  SecondaryThickness = "SecondaryThickness",
  SpannerThickness = "SpannerThickness",
  MidribTaper = "MidribTaper",
  SecondaryTaper = "SecondaryTaper",
  SpannerTaper = "SpannerTaper",
  TaperRNG = "TaperRNG",
  VeinSplit = "VeinSplit",
  VeinSplitDepth = "VeinSplitDepth",
  VeinSplitAmp = "VeinSplitAmp",
  VeinSplitAmpOffset = "VeinSplitAmpOffset",

  // Texture
  TexBaseColor = "TexBaseColor",
  TexShadowStrength = "TexShadowStrength",
  TexMaskingStrength = "TexMaskingStrength",
  TexVeinColor = "TexVeinColor",
  TexVeinOpacity = "TexVeinOpacity",
  TexVeinSecondaryOpacity = "TexVeinSecondaryOpacity",
  TexVeinDepth = "TexVeinDepth",
  TexVeinBlur = "TexVeinBlur",
  TexRadianceHue = "TexRadianceHue",
  TexRadianceLitPower = "TexRadianceLitPower",
  TexRadianceInversion = "TexRadianceInversion",
  TexRadiance = "TexRadiance",
  TexRadianceMargin = "TexRadianceMargin",
  TexRadianceDensity = "TexRadianceDensity",
  TexRadianceWidthMult = "TexRadianceWidthMult",
  TexMarginColor = "TexMarginColor",
  TexMarginProminance = "TexMarginProminance",
  TexMarginAlpha = "TexMarginAlpha",

  // Normals
  NormalMidribWidth = "NormalMidribWidth",
  NormalMidribDepth = "NormalMidribDepth",
  NormalSecondaryWidth = "NormalSecondaryWidth",
  NormalSecondaryDepth = "NormalSecondaryDepth",
  NormalVeinSmooth = "NormalVeinSmooth",
  NormalPuffySmooth = "NormalPuffySmooth",
  NormalPuffyPlateauClamp = "NormalPuffyPlateauClamp",
  NormalPuffyStrength = "NormalPuffyStrength",

  // Material
  MaterialShininess = "MaterialShininess",
  MaterialMetallicness = "MaterialMetallicness",
  MaterialAOStrength = "MaterialAOStrength",
  MaterialRimPower = "MaterialRimPower",
  MaterialMicrotexAmp = "MaterialMicrotexAmp",
  MaterialRimColor = "MaterialRimColor",
  AbaxialDarkening = "AbaxialDarkening",
  AbaxialPurpleTint = "AbaxialPurpleTint",
  AbaxialHue = "AbaxialHue",
  VertBumpsPower = "VertBumpsPower",
  VertBumpsScale = "VertBumpsScale",
  VertBumpsStretch = "VertBumpsStretch",
  VertBumpsPower2 = "VertBumpsPower2",
  VertBumpsScale2 = "VertBumpsScale2",
  VertBumpsStretch2 = "VertBumpsStretch2",
  RadialBumpsPower = "RadialBumpsPower",
  RadialBumpsScale = "RadialBumpsScale",
  RadialBumpsLenScale = "RadialBumpsLenScale",
  RadialBumpsWidth = "RadialBumpsWidth",
  MaterialHeightAmp = "MaterialHeightAmp",
  TrunkBrowning = "TrunkBrowning",
  TrunkLightness = "TrunkLightness",

  // Distortion
  DistortionEnabled = "DistortionEnabled",
  DistortCurl = "DistortCurl",
  DistortCurlPoint = "DistortCurlPoint",
  DistortCup = "DistortCup",
  DistortCupClamp = "DistortCupClamp",
  DistortFlop = "DistortFlop",
  DistortFlopStart = "DistortFlopStart",
  DistortWaveAmp = "DistortWaveAmp",
  DistortWavePeriod = "DistortWavePeriod",
  DistortWaveDepth = "DistortWaveDepth",
  DistortWaveDivergance = "DistortWaveDivergance",
  DistortWaveDivergancePeriod = "DistortWaveDivergancePeriod",
  ExtrudeEnabled = "ExtrudeEnabled",
  ExtrudeEdgeDepth = "ExtrudeEdgeDepth",
  ExtrudeSuccThicc = "ExtrudeSuccThicc",

  // Stem
  StemLength = "StemLength",
  StemWidth = "StemWidth",
  StemFlop = "StemFlop",
  StemNeck = "StemNeck",
  StemAttachmentAngle = "StemAttachmentAngle",
  StemBaseColor = "StemBaseColor",
  StemTopColorHue = "StemTopColorHue",
  StemTopColorLit = "StemTopColorLit",
  StemTopColorSat = "StemTopColorSat",
  StemColorBias = "StemColorBias",
  StemShine = "StemShine",
  StemBaseTexType = "StemBaseTexType",
  StemTopTexType = "StemTopTexType",

  // Arrangement
  LeafCount = "LeafCount",
  LeafScale = "LeafScale",
  ScaleMin = "ScaleMin",
  ScaleRand = "ScaleRand",
  LeafSkewMax = "LeafSkewMax",
  PhysicsAmplification = "PhysicsAmplification",
  RotationalSymmetry = "RotationalSymmetry",
  RotationClustering = "RotationClustering",
  RotationRand = "RotationRand",
  NodeDistance = "NodeDistance",
  NodeInitialY = "NodeInitialY",
  StemLengthIncrease = "StemLengthIncrease",
  StemLengthRand = "StemLengthRand",
  StemFlopLower = "StemFlopLower",
  StemFlopRand = "StemFlopRand",
  TrunkWidth = "TrunkWidth",
  TrunkLean = "TrunkLean",
  TrunkWobble = "TrunkWobble",
  PotScale = "PotScale",
}

// =============================================================================
// RENDER QUALITY
// =============================================================================

/**
 * Render quality levels
 */
export enum RenderQuality {
  Current = "Current",
  Custom = "Custom",
  Minimum = "Minimum", // LOD2 - lowest detail
  Medium = "Medium", // LOD1 - medium detail
  Maximum = "Maximum", // LOD0 - full detail
}

/**
 * Quality-specific settings
 */
export interface QualitySettings {
  subdivSteps: number;
  renderLineSteps: number;
  textureDownsample: number;
  meshDensity: number;
}

// =============================================================================
// GENERATION OPTIONS
// =============================================================================

/**
 * Options for plant generation
 */
export interface PlantGenerationOptions {
  /** Random seed for reproducible results */
  seed: number;
  /** Render quality level */
  quality: RenderQuality;
  /** Number of distortion instances for variation */
  distortionInstances: number;
  /** Whether to generate textures */
  generateTextures: boolean;
  /** Texture size (default 1024) */
  textureSize: number;
}

/**
 * Result of plant generation
 */
export interface PlantGenerationResult {
  /** Three.js group containing the plant */
  group: Group;
  /** Individual leaf bundles */
  leafBundles: LeafBundle[];
  /** Trunk mesh */
  trunkMesh: BufferGeometry;
  /** Generated textures */
  textures: {
    albedo: ImageData | null;
    normal: ImageData | null;
    height: ImageData | null;
  };
  /** Generation statistics */
  stats: {
    vertexCount: number;
    triangleCount: number;
    leafCount: number;
    generationTimeMs: number;
  };
  /** Dispose all resources */
  dispose: () => void;
}

// =============================================================================
// PRESET TYPES
// =============================================================================

/**
 * Plant preset identifier
 */
export type PlantPresetName =
  | "gloriosum"
  | "monstera"
  | "pothos"
  | "philodendron"
  | "alocasia"
  | "calathea"
  | "anthurium"
  | "aglaonema"
  | "dieffenbachia"
  | "spathiphyllum"
  | "syngonium"
  | "caladium"
  | "colocasia"
  | "xanthosoma"
  | "arum"
  | "calla"
  | "zamioculcas"
  | "maranta"
  | "stromanthe"
  | "ctenanthe"
  | "ficus"
  | "schefflera"
  | "fatsia"
  | "polyscias"
  | "aralia"
  | "hosta"
  | "heuchera"
  | "brunnera"
  | "pulmonaria"
  | "bergenia";

/**
 * Plant preset with all parameters
 */
export interface PlantPreset {
  name: PlantPresetName;
  displayName: string;
  params: Partial<Record<LPK, number | HSLColor>>;
}

// =============================================================================
// WORKER MESSAGE TYPES
// =============================================================================

/**
 * Message to worker for mesh generation
 */
export interface WorkerMeshRequest {
  type: "generateMesh";
  id: string;
  params: LeafParamDict;
  quality: RenderQuality;
  seed: number;
}

/**
 * Message to worker for distortion
 */
export interface WorkerDistortRequest {
  type: "distort";
  id: string;
  vertices: Float32Array;
  distortionCurves: DistortionCurve[];
  leafWidth: number;
  cupClamp: number;
}

/**
 * Message to worker for texture generation
 */
export interface WorkerTextureRequest {
  type: "generateTexture";
  id: string;
  textureType: TextureType;
  vars: TextureVars;
  params: LeafParamDict;
}

/**
 * Worker response message
 */
export interface WorkerResponse {
  type: "result" | "error";
  id: string;
  data?: MeshData | Float32Array | ImageData;
  error?: string;
}
