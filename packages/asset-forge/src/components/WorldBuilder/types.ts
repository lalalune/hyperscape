/**
 * World Builder Types
 *
 * Type definitions for the two-phase world authoring system:
 * 1. Creation Mode - Procedural world generation (destructive, foundational)
 * 2. Editing Mode - Layered content authoring (non-destructive)
 */

import type {
  BiomeConfig,
  IslandConfig,
  TerrainNoiseConfig,
  ShorelineConfig,
} from "@hyperforge/procgen/terrain";

// ============== WORLD BUILDER MODES ==============

export type WorldBuilderMode = "creation" | "editing";

export type SelectionMode =
  | "auto"
  | "biome"
  | "tile"
  | "town"
  | "building"
  | "npc";

export type CameraMode = "orbit" | "flythrough" | "player";

// ============== CREATION MODE TYPES ==============

/**
 * Configuration for town landmark generation
 */
export interface TownLandmarkConfig {
  /** Enable fences around building lots (villages and towns) */
  fencesEnabled: boolean;
  /** Density of fence posts (0-1, higher = more posts) */
  fenceDensity: number;
  /** Fence post height in meters */
  fencePostHeight: number;
  /** Enable lampposts in villages (always enabled for towns) */
  lamppostsInVillages: boolean;
  /** Spacing between lampposts in meters */
  lamppostSpacing: number;
  /** Enable market stalls in town plazas */
  marketStallsEnabled: boolean;
  /** Enable decorative elements (barrels, crates, planters) */
  decorationsEnabled: boolean;
}

// ============== VEGETATION TYPES ==============
// These types MUST match the game's BiomeTreeConfig and TreeSpawnConfig
// from @hyperforge/shared (TreeTypes.ts and world-types.ts).
// Kept as local definitions because @hyperforge/shared/world doesn't emit .d.ts files.

/**
 * Per-species spawn configuration.
 * Mirrors TreeSpawnConfig from @hyperforge/shared/constants/TreeTypes.ts
 */
export interface TreeSpawnConfigUI {
  /** Relative spawn weight (higher = more likely) */
  weight: number;
  /** Minimum terrain height for spawning */
  minHeight?: number;
  /** Maximum terrain height for spawning */
  maxHeight?: number;
  /** How strongly this tree prefers water-adjacent placement (0-1) */
  waterAffinity?: number;
  /** Horizontal search radius (meters) when looking for nearby water. Default 40. */
  waterSearchRadius?: number;
  /** Max horizontal distance from shore (meters) before rejection kicks in. Default 30. */
  waterMaxDistance?: number;
  /** Reject placement below this height above water threshold */
  avoidsWaterBelow?: number;
}

/**
 * Per-biome tree vegetation configuration.
 * Mirrors BiomeTreeConfig from @hyperforge/shared/types/world/world-types.ts
 */
export interface BiomeTreeVegetationConfig {
  /** Whether trees are enabled for this biome */
  enabled: boolean;
  /** Per-tree spawn weight + placement rules, keyed by tree ID (e.g. "tree_oak") */
  trees: Record<string, TreeSpawnConfigUI>;
  /** Trees per tile (base density) */
  density: number;
  /** Minimum spacing between trees in meters */
  minSpacing: number;
  /** Whether trees should cluster together */
  clustering: boolean;
  /** Whether snow-capable trees in this biome receive snow coverage */
  enableSnow?: boolean;
  /** Average number of trees per cluster (default: 4) */
  clusterSize?: number;
  /** Radius of each cluster in meters (default: clusterSize * minSpacing) */
  clusterRadius?: number;
  /** Minimum distance between cluster centers in meters (default: clusterRadius * 2) */
  clusterSpacing?: number;
  /** Scale variation range [min, max] multiplier (default: [0.8, 1.2]) */
  scaleVariation?: [number, number];
  /** Maximum terrain slope for tree placement (gradient magnitude, default: 1.5) */
  maxSlope?: number;
}

/**
 * Vegetation overrides per biome type
 */
export type VegetationConfig = Record<string, BiomeTreeVegetationConfig>;

/**
 * Configuration for town generation during world creation
 */
export interface TownGenerationConfig {
  /** Number of towns to generate */
  townCount: number;
  /** Minimum spacing between town centers in meters */
  minTownSpacing: number;
  /** Distribution of town sizes [hamlet, village, town] weights */
  sizeDistribution: {
    hamlet: number;
    village: number;
    town: number;
  };
  /** Minimum flatness score for town placement (0-1) */
  minFlatnessScore: number;
  /** Maximum slope for town placement */
  maxSlope: number;
  /** Preferred biomes for town placement (higher weight = more likely) */
  biomePreferences: Record<string, number>;
  /** Landmark generation configuration */
  landmarks: TownLandmarkConfig;
}

/**
 * Configuration for road generation during world creation
 */
export interface RoadGenerationConfig {
  /** Road width in meters */
  roadWidth: number;
  /** A* pathfinding step size */
  pathStepSize: number;
  /** Path smoothing iterations */
  smoothingIterations: number;
  /** Ratio of extra connections beyond MST */
  extraConnectionsRatio: number;
  /** Cost multiplier for slopes */
  costSlopeMultiplier: number;
  /** Cost penalty for crossing water */
  costWaterPenalty: number;
  /** A* heuristic weight */
  heuristicWeight: number;
}

/**
 * Full configuration for world creation
 * This becomes the "foundation" that is locked after creation
 */
export interface WorldCreationConfig {
  /** World seed for deterministic generation */
  seed: number;
  /** Preset ID if using a preset */
  preset: string | null;
  /** Use the game's exact terrain pipeline (computeBaseHeight) instead of procgen */
  useGamePipeline?: boolean;

  // Terrain configuration
  terrain: {
    /** Size of each terrain tile in meters */
    tileSize: number;
    /** World grid size in tiles (e.g., 100 = 100x100 tiles = 10km x 10km) */
    worldSize: number;
    /** Vertices per tile for mesh resolution */
    tileResolution: number;
    /** Maximum terrain height variation in meters */
    maxHeight: number;
    /** Height threshold below which water appears */
    waterThreshold: number;
  };

  /** Noise layer configuration */
  noise: TerrainNoiseConfig;

  /** Biome generation configuration */
  biomes: BiomeConfig;

  /** Island mask configuration */
  island: IslandConfig;

  /** Shoreline configuration */
  shoreline: ShorelineConfig;

  /** Town generation configuration */
  towns: TownGenerationConfig;

  /** Road generation configuration */
  roads: RoadGenerationConfig;

  /** Per-biome vegetation (tree) configuration overrides */
  vegetation?: VegetationConfig;
}

// ============== GENERATED WORLD DATA ==============

/**
 * Position in world space
 */
export interface WorldPosition {
  x: number;
  y: number;
  z: number;
}

/**
 * A generated biome instance in the world
 */
export interface GeneratedBiome {
  /** Unique identifier */
  id: string;
  /** Biome type (e.g., "forest", "plains", "mountains") */
  type: string;
  /** Center position in world coordinates */
  center: WorldPosition;
  /** Influence radius in meters */
  influenceRadius: number;
  /** Tiles that are predominantly this biome */
  tileKeys: string[];
  /** Color for visualization */
  color: number;
}

/**
 * A generated town in the world
 */
export interface GeneratedTown {
  /** Unique identifier */
  id: string;
  /** Town name */
  name: string;
  /** Town size category */
  size: "hamlet" | "village" | "town";
  /** Center position in world coordinates */
  position: WorldPosition;
  /** Layout type */
  layoutType: "terminus" | "throughway" | "fork" | "crossroads";
  /** Building IDs in this town */
  buildingIds: string[];
  /** Road connection points */
  entryPoints: Array<{
    direction: string;
    position: WorldPosition;
    connectedRoadId: string | null;
  }>;
  /** Biome the town is located in */
  biomeId: string;
  /** Safe zone radius in meters (computed by town generator based on size) */
  safeZoneRadius?: number;
}

/**
 * A generated building in the world
 */
export interface GeneratedBuilding {
  /** Unique identifier */
  id: string;
  /** Building type */
  type: string;
  /** Building name */
  name: string;
  /** Position in world coordinates */
  position: WorldPosition;
  /** Rotation in radians */
  rotation: number;
  /** Parent town ID */
  townId: string;
  /** Grid dimensions */
  dimensions: {
    width: number;
    depth: number;
    floors: number;
  };
}

/**
 * A road segment in the world
 */
export interface GeneratedRoad {
  /** Unique identifier */
  id: string;
  /** Path points */
  path: WorldPosition[];
  /** Road width in meters */
  width: number;
  /** Connected town IDs */
  connectedTowns: [string, string];
  /** Whether this is a main road or secondary connection */
  isMainRoad: boolean;
}

/**
 * A user-authored road created in World Studio's path tool.
 * Merged with generated roads on deploy.
 */
export interface CustomRoad {
  /** Unique identifier */
  id: string;
  /** Display name */
  name: string;
  /** Path waypoints in world coordinates */
  path: WorldPosition[];
  /** Road width in meters */
  width: number;
}

/**
 * The procedurally generated world foundation
 * This data is immutable after world creation
 */
export interface WorldFoundation {
  /** Version for migration support */
  version: number;
  /** Creation timestamp */
  createdAt: number;
  /** The configuration used to generate this world */
  config: WorldCreationConfig;
  /** Generated biomes */
  biomes: GeneratedBiome[];
  /** Generated towns */
  towns: GeneratedTown[];
  /** Generated buildings */
  buildings: GeneratedBuilding[];
  /** Generated road network */
  roads: GeneratedRoad[];
  /** Heightmap data per tile (serialized) */
  heightmapCache: Map<string, Float32Array>;
}

// ============== EDITING MODE - LAYER TYPES ==============

/**
 * Override for a biome's properties (without changing position)
 */
export interface BiomeOverride {
  /** ID of the biome to override */
  biomeId: string;
  /** New biome type (e.g., swap forest to desert) */
  typeOverride?: string;
  /** Difficulty level override */
  difficultyOverride?: number;
  /** Vegetation configuration override */
  vegetationOverride?: BiomeVegetationConfig;
  /** Ambient sound override */
  ambientSoundOverride?: string;
  /** Color scheme override */
  colorSchemeOverride?: {
    primary: string;
    secondary: string;
    fog: string;
  };
  /** Terrain material override */
  materialOverride?: BiomeMaterialConfig;
  /** Height configuration override */
  heightOverride?: BiomeHeightConfig;
  /** Mob spawn configuration */
  mobSpawnConfig?: BiomeMobSpawnConfig;
}

/**
 * Material/texture configuration for a biome
 */
export interface BiomeMaterialConfig {
  /** Base texture ID */
  baseTextureId: string;
  /** Secondary texture ID (for blending) */
  secondaryTextureId?: string;
  /** Texture blend mode */
  blendMode: "height" | "slope" | "noise";
  /** Blend threshold */
  blendThreshold: number;
  /** Roughness value (0-1) */
  roughness: number;
  /** Color tint (hex) */
  colorTint: string;
  /** UV scale (texture repeat) */
  uvScale: number;
}

/**
 * Height configuration for a biome
 */
export interface BiomeHeightConfig {
  /** Minimum height in meters */
  minHeight: number;
  /** Maximum height in meters */
  maxHeight: number;
  /** Height variance (noise amplitude) */
  variance: number;
  /** Smoothness factor (0-1, higher = smoother) */
  smoothness: number;
}

/**
 * Mob spawn configuration for a biome
 */
export interface BiomeMobSpawnConfig {
  /** Whether mob spawning is enabled */
  enabled: boolean;
  /** Base spawn rate (spawns per 100m² per minute) */
  spawnRate: number;
  /** Maximum mobs per chunk */
  maxPerChunk: number;
  /** Spawn table entries */
  spawnTable: MobSpawnEntry[];
}

/**
 * Entry in a mob spawn table
 */
export interface MobSpawnEntry {
  /** Mob type ID */
  mobTypeId: string;
  /** Spawn weight (relative probability) */
  weight: number;
  /** Level range [min, max] */
  levelRange: [number, number];
  /** Group size range [min, max] */
  groupSize: [number, number];
  /** Required conditions */
  conditions?: MobSpawnCondition[];
}

/**
 * Condition for mob spawning
 */
export interface MobSpawnCondition {
  type: "time" | "weather" | "difficulty" | "playerCount";
  value: string | number;
  operator: "eq" | "gt" | "lt" | "gte" | "lte";
}

/**
 * Vegetation configuration for a biome
 */
export interface BiomeVegetationConfig {
  enabled: boolean;
  layers: VegetationLayer[];
}

/**
 * A single vegetation layer in a biome
 */
export interface VegetationLayer {
  category: string;
  density: number;
  assets: string[];
  minSpacing: number;
  clustering: boolean;
  clusterSize?: number;
  noiseScale: number;
  noiseThreshold: number;
  avoidWater: boolean;
  avoidSteepSlopes?: boolean;
  minHeight?: number;
  maxHeight?: number;
}

/**
 * Override for a town's properties
 */
export interface TownOverride {
  /** ID of the town to override */
  townId: string;
  /** Custom name override */
  nameOverride?: string;
  /** Override safe zone radius (meters). Default is derived from town size. */
  safeZoneRadiusOverride?: number;
  /** Building modifications */
  buildingModifications?: BuildingModification[];
  /** Custom properties */
  customProperties?: Record<string, unknown>;
}

/**
 * Modification to a building within a town
 */
export interface BuildingModification {
  /** ID of the building to modify */
  buildingId: string;
  /** Type override */
  typeOverride?: string;
  /** Custom name */
  nameOverride?: string;
  /** Whether the building is disabled/removed */
  disabled?: boolean;
  /** Position offset (delta from original) */
  positionOffset?: { x: number; z: number };
  /** Rotation override in radians */
  rotationOverride?: number;
}

/**
 * An NPC placed in the world
 */
export interface PlacedNPC {
  /** Unique identifier */
  id: string;
  /** NPC type/template ID */
  npcTypeId: string;
  /** Display name */
  name: string;
  /** Position in world coordinates */
  position: WorldPosition;
  /** Rotation facing direction */
  rotation: number;
  /** Parent context (town, building, or world) */
  parentContext:
    | { type: "town"; townId: string }
    | { type: "building"; buildingId: string }
    | { type: "world" };
  /** Optional store ID for merchant NPCs */
  storeId?: string;
  /** Optional dialog tree ID */
  dialogId?: string;
  /** Custom properties */
  properties: Record<string, unknown>;
}

/**
 * A quest definition
 */
export interface PlacedQuest {
  /** Unique identifier */
  id: string;
  /** Quest template ID */
  questTemplateId: string;
  /** Display name */
  name: string;
  /** Quest giver NPC ID */
  questGiverNpcId: string;
  /** Quest turn-in NPC ID (can be same as giver) */
  turnInNpcId: string;
  /** Involved locations */
  locations: Array<{
    type: "town" | "biome" | "building" | "coordinate";
    id?: string;
    position?: WorldPosition;
    description: string;
  }>;
  /** Required level */
  requiredLevel: number;
  /** Custom properties */
  properties: Record<string, unknown>;
}

/**
 * A boss spawn in the world
 */
export interface PlacedBoss {
  /** Unique identifier */
  id: string;
  /** Boss template ID (if using existing asset) */
  bossTemplateId: string;
  /** Display name */
  name: string;
  /** Spawn position */
  position: WorldPosition;
  /** Boss arena bounds */
  arenaBounds: {
    minX: number;
    maxX: number;
    minZ: number;
    maxZ: number;
  };
  /** Respawn time in seconds */
  respawnTime: number;
  /** Required level to engage */
  requiredLevel: number;
  /** Loot table ID */
  lootTableId: string;
  /** Whether this boss was procedurally generated */
  isGenerated: boolean;
  /** Procedural boss description (for generated bosses) */
  generatedConfig?: GeneratedBossConfig;
  /** Custom properties */
  properties: Record<string, unknown>;
}

/**
 * Configuration for a procedurally generated boss
 */
export interface GeneratedBossConfig {
  /** Boss archetype (determines abilities and appearance) */
  archetype: BossArchetype;
  /** Base model to use */
  baseModelId: string;
  /** Scale modifier */
  scale: number;
  /** Color tint */
  colorTint: string;
  /** Boss title prefix (e.g., "Ancient", "Corrupted") */
  titlePrefix: string;
  /** Combat level */
  combatLevel: number;
  /** Health multiplier */
  healthMultiplier: number;
  /** Damage multiplier */
  damageMultiplier: number;
  /** Special abilities */
  abilities: BossAbility[];
  /** Phase thresholds (health % to trigger new phases) */
  phases: number[];
  /** Lore/flavor text */
  loreText: string;
}

/**
 * Boss archetype defines base behavior
 */
export type BossArchetype =
  | "brute" // High HP, slow, heavy hits
  | "assassin" // Fast, high damage, low HP
  | "caster" // Ranged, AOE attacks
  | "summoner" // Spawns adds
  | "tank" // Very high defense, reflects damage
  | "berserker" // Gets stronger as HP drops
  | "dragon"; // Flight, breath attacks

/**
 * Boss special ability
 */
export interface BossAbility {
  id: string;
  name: string;
  cooldown: number;
  damage: number;
  radius: number;
  effects: string[];
}

/**
 * A special event definition
 */
export interface PlacedEvent {
  /** Unique identifier */
  id: string;
  /** Event type */
  eventType: string;
  /** Display name */
  name: string;
  /** Event trigger area */
  triggerArea:
    | { type: "radius"; center: WorldPosition; radius: number }
    | { type: "bounds"; minX: number; maxX: number; minZ: number; maxZ: number }
    | { type: "biome"; biomeId: string }
    | { type: "town"; townId: string };
  /** Trigger conditions */
  conditions: Record<string, unknown>;
  /** Custom properties */
  properties: Record<string, unknown>;
}

/**
 * A lore entry attached to a location
 */
export interface PlacedLore {
  /** Unique identifier */
  id: string;
  /** Lore category */
  category: string;
  /** Title */
  title: string;
  /** Content text */
  content: string;
  /** Associated location */
  location:
    | { type: "town"; townId: string }
    | { type: "building"; buildingId: string }
    | { type: "biome"; biomeId: string }
    | { type: "coordinate"; position: WorldPosition };
  /** Discovery method */
  discoveryMethod: "automatic" | "interact" | "quest" | "item";
  /** Custom properties */
  properties: Record<string, unknown>;
}

/**
 * A difficulty zone overlay
 */
export interface DifficultyZone {
  /** Unique identifier */
  id: string;
  /** Zone name */
  name: string;
  /** Difficulty level (0-4) */
  difficultyLevel: number;
  /** Zone type: rectangular bounds or Voronoi-based */
  zoneType: "bounds" | "voronoi";
  /** Zone bounds (for rectangular zones) */
  bounds: {
    minX: number;
    maxX: number;
    minZ: number;
    maxZ: number;
  };
  /** Voronoi center point (for voronoi zones) */
  center?: WorldPosition;
  /** Associated town ID (for safe zones) */
  linkedTownId?: string;
  /** Whether this is a safe zone (no PVP, no mobs) */
  isSafeZone: boolean;
  /** Mob level range */
  mobLevelRange: [number, number];
  /** Custom properties */
  properties: Record<string, unknown>;
}

/**
 * PVP Wilderness zone configuration
 */
export interface WildernessZone {
  /** Unique identifier */
  id: string;
  /** Zone name */
  name: string;
  /** Direction from center (canonical: north) */
  direction: "north" | "south" | "east" | "west";
  /** Start boundary (distance from world center) */
  startBoundary: number;
  /** Whether multi-combat is allowed */
  multiCombat: boolean;
  /** Wilderness level at boundary */
  baseLevelAtBoundary: number;
  /** Wilderness level increase per 100m */
  levelPerHundredMeters: number;
}

/**
 * A custom object placement
 */
export interface CustomPlacement {
  /** Unique identifier */
  id: string;
  /** Object type */
  objectType: string;
  /** Position in world coordinates */
  position: WorldPosition;
  /** Rotation */
  rotation: number;
  /** Scale */
  scale: number;
  /** Custom properties */
  properties: Record<string, unknown>;
}

/**
 * All authored layers that can be added to a world
 * These survive biome swaps and other non-destructive edits
 */
export interface WorldLayers {
  /** Biome property overrides */
  biomeOverrides: Map<string, BiomeOverride>;
  /** Town property overrides */
  townOverrides: Map<string, TownOverride>;
  /** Placed NPCs */
  npcs: PlacedNPC[];
  /** Placed quests */
  quests: PlacedQuest[];
  /** Placed bosses */
  bosses: PlacedBoss[];
  /** Special events */
  events: PlacedEvent[];
  /** Lore entries */
  lore: PlacedLore[];
  /** Difficulty zones */
  difficultyZones: DifficultyZone[];
  /** Custom object placements */
  customPlacements: CustomPlacement[];
  /** User-authored roads from path tool */
  customRoads: CustomRoad[];
}

// ============== COMPLETE WORLD DATA ==============

/**
 * Complete world data combining foundation and layers
 */
export interface WorldData {
  /** Unique world identifier */
  id: string;
  /** World name */
  name: string;
  /** World description */
  description: string;
  /** Version for migration support */
  version: number;
  /** Creation timestamp */
  createdAt: number;
  /** Last modified timestamp */
  modifiedAt: number;
  /** Whether the foundation is locked (creation complete) */
  foundationLocked: boolean;
  /** The procedural foundation (immutable after lock) */
  foundation: WorldFoundation;
  /** Authored content layers */
  layers: WorldLayers;
}

// ============== SELECTION TYPES ==============

/**
 * Selection in the world editor
 */
export interface Selection {
  /** Type of selected element */
  type:
    | "terrain"
    | "chunk"
    | "biome"
    | "tile"
    | "town"
    | "building"
    | "npc"
    | "quest"
    | "boss"
    | "event"
    | "lore"
    | "difficultyZone"
    | "customPlacement"
    | "wilderness"
    | "spawnPoint"
    | "teleport"
    | "mobSpawn"
    | "resource"
    | "station"
    | "road"
    | "customRoad"
    | "poi"
    | "waterBody"
    | "musicZone"
    | "ambientZone"
    | "sfxTrigger"
    // Vegetation instance selection (InstancedMesh per-instance)
    | "vegetation"
    // Game world manifest entity types (from GameWorldEntitySync)
    | "gameNpc"
    | "gameStation"
    | "gameResource"
    | "gameMobSpawn"
    // Region/zone entity
    | "region"
    // Danger source
    | "dangerSource"
    // Custom imported/generated assets
    | "customAsset";
  /** ID of selected element */
  id: string;
  /** Breadcrumb path to selection (for nested elements) */
  path: SelectionPathItem[];
  /** Additional data for tile inspector */
  tileData?: TileInspectorData;
  /** Entity metadata from 3D scene userData (for game world entities) */
  entityData?: Record<string, unknown>;
}

/**
 * Data for tile inspector panel
 */
export interface TileInspectorData {
  tileX: number;
  tileZ: number;
  chunkX: number;
  chunkZ: number;
  worldX: number;
  worldZ: number;
  height: number;
  biome: string;
  slope: number;
  walkable: boolean;
  inTown: boolean;
  townId?: string;
  inWilderness: boolean;
  difficultyLevel: number;
}

/**
 * Item in selection breadcrumb path
 */
export interface SelectionPathItem {
  type: string;
  id: string;
  name: string;
}

/**
 * Hover information for tooltips
 */
export interface HoverInfo {
  type: string;
  id: string;
  name: string;
  position: WorldPosition;
  additionalInfo?: Record<string, string | number>;
}

// ============== HIERARCHY TYPES ==============

/**
 * Node in the hierarchy tree
 */
export interface HierarchyNode {
  /** Unique node ID */
  id: string;
  /** Display label */
  label: string;
  /** Node type for icon selection */
  type:
    | "world"
    | "terrain"
    | "chunks"
    | "chunk"
    | "biomes"
    | "biome"
    | "tiles"
    | "tile"
    | "towns"
    | "town"
    | "building"
    | "roads"
    | "road"
    | "layers"
    | "npcs"
    | "npc"
    | "quests"
    | "quest"
    | "bosses"
    | "boss"
    | "events"
    | "event"
    | "lore"
    | "loreEntries"
    | "difficultyZones"
    | "difficultyZone"
    | "wilderness"
    | "mobSpawns"
    | "mobSpawn"
    | "customPlacements"
    | "customPlacement"
    | "spawnPoints"
    | "spawnPoint"
    | "teleports"
    | "teleport"
    | "resources"
    | "resource"
    | "stations"
    | "station"
    | "pois"
    | "poi"
    | "waterBodies"
    | "waterBody"
    | "water"
    | "audio"
    | "musicZones"
    | "musicZone"
    | "ambientZones"
    | "ambientZone"
    | "sfxTriggers"
    | "sfxTrigger"
    | "gameEntities"
    | "gameCharacters"
    | "gameCreatures"
    | "gameNpcs"
    | "gameNpc"
    | "gameQuestNpcs"
    | "gameShopkeepers"
    | "gameServiceNpcs"
    | "gameMobs"
    | "gameBosses"
    | "gameStations"
    | "gameStation"
    | "gameCraftingStations"
    | "gameServiceStations"
    | "gameOtherStations"
    | "gameResources"
    | "gameResource"
    | "gameMining"
    | "gameWoodcutting"
    | "gameOtherResources"
    | "gameMobSpawns"
    | "gameMobSpawn"
    | "gameFishing"
    | "gameAreas"
    | "regions"
    | "region"
    | "dangerSources"
    | "dangerSource"
    | "wildernessBoundary"
    | "mines"
    | "mine"
    | "customAssets"
    | "customAsset"
    | "folder";
  /** Child nodes */
  children: HierarchyNode[];
  /** Associated data ID for selection */
  dataId?: string;
  /** Badge count (e.g., number of children) */
  badge?: number;
  /** Whether this node is expandable */
  expandable: boolean;
  /** Additional metadata */
  metadata?: Record<string, unknown>;
}

// ============== VIEWPORT OVERLAY TYPES ==============

/**
 * Configuration for viewport overlays
 */
export interface ViewportOverlays {
  /** Show biome region colors */
  biomes: boolean;
  /** Show town boundaries */
  towns: boolean;
  /** Show road paths */
  roads: boolean;
  /** Show NPC markers */
  npcs: boolean;
  /** Show boss markers */
  bosses: boolean;
  /** Show difficulty zones */
  difficultyZones: boolean;
}

// ============== STATE TYPES ==============

/**
 * State for Creation Mode
 */
export interface CreationModeState {
  /** Current configuration being edited */
  config: WorldCreationConfig;
  /** Selected preset ID */
  selectedPreset: string | null;
  /** Whether a preview has been generated */
  hasPreview: boolean;
  /** Preview generation in progress */
  isGenerating: boolean;
  /** Last generation error */
  generationError: string | null;
  /** Preview statistics */
  previewStats: {
    tiles: number;
    biomes: number;
    towns: number;
    roads: number;
    generationTime: number;
  } | null;
}

/**
 * State for Editing Mode
 */
export interface EditingModeState {
  /** Currently loaded world data */
  world: WorldData | null;
  /** Current selection */
  selection: Selection | null;
  /** Hovered element info */
  hoveredElement: HoverInfo | null;
  /** Selection mode */
  selectionMode: SelectionMode;
  /** Expanded hierarchy nodes */
  expandedNodes: Set<string>;
  /** Pending unsaved changes */
  hasUnsavedChanges: boolean;
  /** Last save error */
  saveError: string | null;
}

/**
 * Complete World Builder State
 */
/** History entry for undo/redo */
export interface HistoryEntry {
  /** Timestamp when this state was captured */
  timestamp: number;
  /** Description of the action that led to this state */
  description: string;
  /** The editing state snapshot */
  editingState: EditingModeState;
}

export interface WorldBuilderState {
  /** Current mode */
  mode: WorldBuilderMode;

  /** Creation mode state */
  creation: CreationModeState;

  /** Editing mode state */
  editing: EditingModeState;

  /** Viewport settings */
  viewport: {
    cameraMode: CameraMode;
    cameraHeight: number;
    moveSpeed: number;
    overlays: ViewportOverlays;
  };

  /** Undo/Redo history */
  history: {
    /** Past states (for undo) */
    past: HistoryEntry[];
    /** Future states (for redo) */
    future: HistoryEntry[];
    /** Maximum history size */
    maxSize: number;
  };
}

// ============== ACTION TYPES ==============

/**
 * Actions for the World Builder
 */
export type WorldBuilderAction =
  // Mode actions
  | { type: "SET_MODE"; mode: WorldBuilderMode }

  // Creation actions
  | { type: "SET_PRESET"; presetId: string | null }
  | { type: "UPDATE_CREATION_CONFIG"; config: Partial<WorldCreationConfig> }
  | {
      type: "UPDATE_TERRAIN_CONFIG";
      config: Partial<WorldCreationConfig["terrain"]>;
    }
  | { type: "UPDATE_NOISE_CONFIG"; config: Partial<TerrainNoiseConfig> }
  | { type: "UPDATE_BIOME_CONFIG"; config: Partial<BiomeConfig> }
  | { type: "UPDATE_ISLAND_CONFIG"; config: Partial<IslandConfig> }
  | { type: "UPDATE_TOWN_CONFIG"; config: Partial<TownGenerationConfig> }
  | { type: "UPDATE_ROAD_CONFIG"; config: Partial<RoadGenerationConfig> }
  | { type: "SET_SEED"; seed: number }
  | { type: "RANDOMIZE_SEED" }
  | { type: "GENERATE_PREVIEW_START" }
  | {
      type: "GENERATE_PREVIEW_SUCCESS";
      stats: CreationModeState["previewStats"];
    }
  | { type: "GENERATE_PREVIEW_ERROR"; error: string }
  | { type: "APPLY_AND_LOCK"; world: WorldData }

  // Editing actions
  | { type: "LOAD_WORLD"; world: WorldData }
  | { type: "UNLOAD_WORLD" }
  | { type: "SET_SELECTION"; selection: Selection | null }
  | { type: "SET_HOVERED"; info: HoverInfo | null }
  | { type: "SET_SELECTION_MODE"; mode: SelectionMode }
  | { type: "TOGGLE_NODE_EXPANDED"; nodeId: string }
  | { type: "EXPAND_NODE"; nodeId: string }
  | { type: "COLLAPSE_NODE"; nodeId: string }

  // Layer editing actions
  | { type: "ADD_BIOME_OVERRIDE"; override: BiomeOverride }
  | {
      type: "UPDATE_BIOME_OVERRIDE";
      biomeId: string;
      override: Partial<BiomeOverride>;
    }
  | { type: "REMOVE_BIOME_OVERRIDE"; biomeId: string }
  | { type: "ADD_TOWN_OVERRIDE"; override: TownOverride }
  | {
      type: "UPDATE_TOWN_OVERRIDE";
      townId: string;
      override: Partial<TownOverride>;
    }
  | { type: "REMOVE_TOWN_OVERRIDE"; townId: string }
  | { type: "ADD_NPC"; npc: PlacedNPC }
  | { type: "UPDATE_NPC"; npcId: string; updates: Partial<PlacedNPC> }
  | { type: "REMOVE_NPC"; npcId: string }
  | { type: "ADD_QUEST"; quest: PlacedQuest }
  | { type: "UPDATE_QUEST"; questId: string; updates: Partial<PlacedQuest> }
  | { type: "REMOVE_QUEST"; questId: string }
  | { type: "ADD_BOSS"; boss: PlacedBoss }
  | { type: "UPDATE_BOSS"; bossId: string; updates: Partial<PlacedBoss> }
  | { type: "REMOVE_BOSS"; bossId: string }
  | { type: "ADD_EVENT"; event: PlacedEvent }
  | { type: "UPDATE_EVENT"; eventId: string; updates: Partial<PlacedEvent> }
  | { type: "REMOVE_EVENT"; eventId: string }
  | { type: "ADD_LORE"; lore: PlacedLore }
  | { type: "UPDATE_LORE"; loreId: string; updates: Partial<PlacedLore> }
  | { type: "REMOVE_LORE"; loreId: string }
  | { type: "ADD_DIFFICULTY_ZONE"; zone: DifficultyZone }
  | {
      type: "UPDATE_DIFFICULTY_ZONE";
      zoneId: string;
      updates: Partial<DifficultyZone>;
    }
  | { type: "REMOVE_DIFFICULTY_ZONE"; zoneId: string }
  | { type: "ADD_CUSTOM_PLACEMENT"; placement: CustomPlacement }
  | {
      type: "UPDATE_CUSTOM_PLACEMENT";
      placementId: string;
      updates: Partial<CustomPlacement>;
    }
  | { type: "REMOVE_CUSTOM_PLACEMENT"; placementId: string }
  | { type: "MARK_SAVED" }
  | { type: "SET_SAVE_ERROR"; error: string | null }

  // Viewport actions
  | { type: "SET_CAMERA_MODE"; mode: CameraMode }
  | { type: "SET_CAMERA_HEIGHT"; height: number }
  | { type: "SET_MOVE_SPEED"; speed: number }
  | { type: "TOGGLE_OVERLAY"; overlay: keyof ViewportOverlays }
  | { type: "SET_OVERLAYS"; overlays: Partial<ViewportOverlays> }

  // History actions (undo/redo)
  | { type: "UNDO" }
  | { type: "REDO" }
  | { type: "CLEAR_HISTORY" };

// ============== DEFAULT VALUES ==============

/**
 * Default town landmark configuration
 */
export const DEFAULT_LANDMARK_CONFIG: TownLandmarkConfig = {
  fencesEnabled: true,
  fenceDensity: 0.7,
  fencePostHeight: 1.2,
  lamppostsInVillages: true,
  lamppostSpacing: 15,
  marketStallsEnabled: true,
  decorationsEnabled: true,
};

/**
 * Default town generation configuration
 */
export const DEFAULT_TOWN_CONFIG: TownGenerationConfig = {
  townCount: 5,
  minTownSpacing: 800,
  sizeDistribution: {
    hamlet: 0.4,
    village: 0.4,
    town: 0.2,
  },
  minFlatnessScore: 0.7,
  maxSlope: 0.15,
  biomePreferences: {
    plains: 1.0,
    forest: 0.8,
    valley: 0.9,
    desert: 0.5,
    tundra: 0.3,
    swamp: 0.2,
    mountains: 0.1,
    lakes: 0.0,
  },
  landmarks: DEFAULT_LANDMARK_CONFIG,
};

/**
 * Default road generation configuration
 * Road width of 6m provides good visibility on terrain while still being realistic
 */
export const DEFAULT_ROAD_CONFIG: RoadGenerationConfig = {
  roadWidth: 6,
  pathStepSize: 10,
  smoothingIterations: 3,
  extraConnectionsRatio: 0.3,
  costSlopeMultiplier: 2.0,
  costWaterPenalty: 100,
  heuristicWeight: 1.2,
};

/**
 * Default noise configuration
 */
export const DEFAULT_NOISE_CONFIG: TerrainNoiseConfig = {
  continent: {
    scale: 0.0008,
    weight: 0.4,
    octaves: 5,
    persistence: 0.7,
    lacunarity: 2.0,
  },
  ridge: {
    scale: 0.003,
    weight: 0.1,
  },
  hill: {
    scale: 0.012,
    weight: 0.12,
    octaves: 4,
    persistence: 0.5,
    lacunarity: 2.0,
  },
  erosion: {
    scale: 0.005,
    weight: 0.08,
    octaves: 3,
  },
  detail: {
    scale: 0.04,
    weight: 0.03,
    octaves: 2,
    persistence: 0.3,
    lacunarity: 2.5,
  },
};

/**
 * Default biome configuration
 */
export const DEFAULT_BIOME_CONFIG: BiomeConfig = {
  gridSize: 3,
  jitter: 0.35,
  minInfluence: 2000,
  maxInfluence: 3500,
  gaussianCoeff: 0.15,
  boundaryNoiseScale: 0.003,
  boundaryNoiseAmount: 0.15,
};

/**
 * Default island configuration. Mirrors procgen's
 * `DEFAULT_ISLAND_CONFIG`; values stay in sync between this
 * studio-side default and `procgen/src/terrain/IslandMask.ts`.
 *
 * Edge noise tuned for visible per-seed coastline variation —
 * see the comment on the procgen counterpart.
 */
export const DEFAULT_ISLAND_CONFIG: IslandConfig = {
  enabled: true,
  maxWorldSizeTiles: 1000,
  falloffTiles: 4,
  edgeNoiseScale: 0.005,
  edgeNoiseStrength: 0.12,
};

/**
 * Default shoreline configuration
 */
export const DEFAULT_SHORELINE_CONFIG: ShorelineConfig = {
  waterLevelNormalized: 0.32, // 16/50 = waterThreshold/maxHeight
  threshold: 0.25,
  colorStrength: 0.6,
  minSlope: 0.06,
  slopeSampleDistance: 2.0,
  landBand: 3.0,
  landMaxMultiplier: 1.6,
  underwaterBand: 3.0,
  underwaterDepthMultiplier: 1.8,
};

/**
 * Default per-biome vegetation configs — exact mirrors of the FOREST/CANYON/TUNDRA_TREE_CONFIG
 * constants in TerrainBiomeTypes.ts.
 *
 * Tree IDs use the "tree_xxx" format matching the TreeId enum in @hyperforge/shared.
 * If you change these defaults, update TerrainBiomeTypes.ts too (or vice versa).
 * The game's getTreeConfigForBiome() is the runtime authority; these defaults are only
 * used in the editor's creation-mode UI before the user overrides them.
 */
export const DEFAULT_VEGETATION_CONFIG: VegetationConfig = {
  forest: {
    enabled: true,
    trees: {
      tree_general: { weight: 50, maxHeight: 60 },
      tree_eucalyptus: { weight: 10, maxHeight: 60 },
      tree_oak: { weight: 30, maxHeight: 60 },
      tree_mahogany: { weight: 20, maxHeight: 60 },
      tree_pine: { weight: 50, minHeight: 60 },
      tree_bamboo: { weight: 20, minHeight: 50 },
      tree_palm: {
        weight: 25,
        waterAffinity: 0.8,
        waterSearchRadius: 100,
        waterMaxDistance: 80,
      },
      tree_banana: {
        weight: 25,
        waterAffinity: 0.8,
        waterSearchRadius: 100,
        waterMaxDistance: 80,
      },
    },
    density: 50,
    minSpacing: 5,
    clustering: true,
    clusterSize: 40,
    clusterRadius: 120,
    clusterSpacing: 80,
    scaleVariation: [1.0, 1.2],
    maxSlope: 1.5,
  },
  canyon: {
    enabled: true,
    trees: {
      tree_palm: {
        weight: 25,
        waterAffinity: 0.8,
        waterSearchRadius: 100,
        waterMaxDistance: 80,
      },
      tree_banana: {
        weight: 25,
        waterAffinity: 0.8,
        waterSearchRadius: 100,
        waterMaxDistance: 80,
      },
      tree_maple: { weight: 20, maxHeight: 60 },
      tree_magic: { weight: 5, maxHeight: 60 },
      tree_dead: { weight: 25 },
    },
    density: 10,
    minSpacing: 12,
    clustering: false,
    scaleVariation: [1.0, 1.2],
    maxSlope: 0.1,
  },
  tundra: {
    enabled: true,
    enableSnow: true,
    trees: {
      tree_pine: { weight: 50, minHeight: 35 },
      tree_pineDead: { weight: 30, minHeight: 38 },
      tree_dead: { weight: 20, minHeight: 38 },
    },
    density: 25,
    minSpacing: 5,
    clustering: true,
    clusterSize: 30,
    clusterRadius: 120,
    clusterSpacing: 100,
    scaleVariation: [1.0, 1.2],
    maxSlope: 1.5,
  },
};

/**
 * Hyperia-flavored world creation configuration.
 *
 * Renamed from `DEFAULT_CREATION_CONFIG` per
 * `PLAN_HYPERIA_DECOUPLING.md` R1.P1: the prior name was
 * misleading — it was Hyperia's terrain config (large-island
 * preset, Hyperia tree species, Hyperia-style towns), not a
 * neutral default. Use this only when the project explicitly
 * targets Hyperia (template === "hyperia" or
 * `plugins.includes("@hyperforge/hyperscape")`). For
 * AI-composed worlds, use `MINIMAL_CREATION_CONFIG`. For
 * truly empty worlds, use `BLANK_CREATION_CONFIG`.
 *
 * Note: worldSize and tileResolution are kept modest for preview performance.
 * For final world generation, these can be increased before "Apply & Lock".
 * Memory usage ≈ worldSize² × tileResolution² × 36 bytes per vertex
 */
export const HYPERIA_CREATION_CONFIG: WorldCreationConfig = {
  seed: 0,
  preset: "large-island",
  useGamePipeline: true,
  terrain: {
    tileSize: 100,
    worldSize: 100, // 100x100 tiles = 10km x 10km (match game world; LOD keeps perf)
    tileResolution: 32, // 32 vertices per tile side (preview quality)
    maxHeight: 50, // match game MAX_HEIGHT (TerrainHeightParams.ts)
    waterThreshold: 16, // match game TERRAIN_CONSTANTS.WATER_THRESHOLD (GameConstants.ts)
  },
  noise: DEFAULT_NOISE_CONFIG,
  biomes: DEFAULT_BIOME_CONFIG,
  island: DEFAULT_ISLAND_CONFIG,
  shoreline: DEFAULT_SHORELINE_CONFIG,
  towns: DEFAULT_TOWN_CONFIG,
  roads: DEFAULT_ROAD_CONFIG,
  vegetation: DEFAULT_VEGETATION_CONFIG,
};

/**
 * Minimal world creation configuration — the **AI default**.
 *
 * Sits between `BLANK_CREATION_CONFIG` (no biomes, no
 * vegetation, no towns) and `HYPERIA_CREATION_CONFIG` (full
 * Hyperia preset). Produces a heightmap + biome distribution +
 * basic procgen vegetation, but commits to **none of Hyperia's
 * specifics**:
 *
 *   - no `large-island` preset — let the agent's terrain knobs
 *     drive the shape
 *   - `useGamePipeline: false` — engine-only generation, the
 *     plugin pipeline opts in by overlaying its own knobs
 *   - vegetation enabled, but tree species are EMPTY per biome
 *     so we don't assume `tree_oak` / `tree_pine` / `tree_palm`
 *     etc. exist in the project's gathering manifests
 *   - `townCount: 0` — no Hyperia hamlet/village/town presets
 *     spawn; the agent places towns explicitly via
 *     `PROPOSE_TOWN` (R4.P8 vocabulary)
 *
 * Round-3 work (`HYPERIA_DECOUPLING.P3`) will make biomes
 * plugin-contributable. Until then, MINIMAL still produces
 * tundra/forest/canyon biomes because `BiomeType` is hardcoded
 * at the engine level — but tree species, town styles, and the
 * island preset stop being forced.
 */
export const MINIMAL_CREATION_CONFIG: WorldCreationConfig = {
  seed: 0,
  preset: null,
  useGamePipeline: false,
  terrain: {
    tileSize: 100,
    worldSize: 100,
    tileResolution: 32,
    maxHeight: 50,
    waterThreshold: 16,
  },
  noise: DEFAULT_NOISE_CONFIG,
  biomes: DEFAULT_BIOME_CONFIG,
  island: DEFAULT_ISLAND_CONFIG,
  shoreline: DEFAULT_SHORELINE_CONFIG,
  // No Hyperia town presets. townCount: 0 means procgen
  // produces no settlements — the agent places towns via
  // PROPOSE_TOWN if/when that action lands in R4.P8.
  towns: { ...DEFAULT_TOWN_CONFIG, townCount: 0 },
  // Roads only generate between towns; with townCount: 0 this is
  // dead config but kept for type compatibility.
  roads: DEFAULT_ROAD_CONFIG,
  // Vegetation enabled per biome with EMPTY species maps. The
  // procgen pipeline runs its biome-coloring + grass passes but
  // places no Hyperia-specific trees. A plugin contributing
  // vegetation profiles (R3.P3) supplies its own species.
  vegetation: Object.fromEntries(
    Object.entries(DEFAULT_VEGETATION_CONFIG).map(([biomeName, biomeCfg]) => [
      biomeName,
      { ...biomeCfg, enabled: true, trees: {} },
    ]),
  ) as VegetationConfig,
};

/**
 * Blank-template creation config — terrain only.
 *
 * Phase B0'.B / B0'.E follow-up. Produces just the heightmap +
 * biome colors + island shape. ZERO towns, ZERO roads, ZERO
 * vegetation. The agent fills the world from there:
 *
 *   - PROPOSE_TERRAIN_CONFIG (B0'.H) — agent reshapes the terrain
 *   - PROPOSE_PLUGIN_SET (B0'.I) — agent declares game systems
 *   - PROPOSE_NPC_PLACEMENT (B1.2 / B0'.G) — agent places NPCs
 *   - PROPOSE_UI_PACK — agent designs the HUD
 *
 * Why disable vegetation: `DEFAULT_VEGETATION_CONFIG` declares
 * Hyperia-specific tree species (`tree_oak`, `tree_pine`,
 * `tree_palm`, etc.). A blank template should not assume those
 * species exist in the project's gathering manifests — that's an
 * assumption only the Hyperia template can make.
 *
 * Why disable towns: `DEFAULT_TOWN_CONFIG` generates Hyperia-style
 * settlements (hamlet/village/town). A blank project shouldn't
 * pre-populate human settlement structures.
 */
export const BLANK_CREATION_CONFIG: WorldCreationConfig = {
  seed: 0,
  preset: null,
  useGamePipeline: false,
  terrain: {
    tileSize: 100,
    worldSize: 100,
    tileResolution: 32,
    maxHeight: 50,
    waterThreshold: 16,
  },
  noise: DEFAULT_NOISE_CONFIG,
  biomes: DEFAULT_BIOME_CONFIG,
  island: DEFAULT_ISLAND_CONFIG,
  shoreline: DEFAULT_SHORELINE_CONFIG,
  // Zero towns — sub-config retained for type compatibility but
  // the count knob ensures procgen produces nothing.
  towns: { ...DEFAULT_TOWN_CONFIG, townCount: 0 },
  // Roads only generate between towns; with townCount: 0 this is
  // dead config but kept for type compatibility.
  roads: DEFAULT_ROAD_CONFIG,
  // Vegetation: every biome's `enabled` flipped off so no trees
  // / bushes / grass clumps spawn. The schema requires the full
  // biome map, so we override flags rather than omit entries.
  vegetation: Object.fromEntries(
    Object.entries(DEFAULT_VEGETATION_CONFIG).map(([biomeName, biomeCfg]) => [
      biomeName,
      { ...biomeCfg, enabled: false },
    ]),
  ) as VegetationConfig,
};

/**
 * Default viewport overlays
 */
export const DEFAULT_VIEWPORT_OVERLAYS: ViewportOverlays = {
  biomes: true,
  towns: true,
  roads: true,
  npcs: false,
  bosses: false,
  difficultyZones: false,
};

// ============== LAYER DEPENDENCY TYPES ==============

/**
 * World generation layers in dependency order
 * Lower layers must be generated before higher layers.
 * Regenerating a layer invalidates all dependent (higher) layers.
 */
export type WorldLayer =
  | "terrain" // Layer 0: Base terrain heightmap
  | "biomes" // Layer 1: Biome placement
  | "towns" // Layer 2: Town positions (depends on biomes for suitability)
  | "buildings" // Layer 3: Buildings in towns
  | "roads" // Layer 4: Roads between towns
  | "difficulty" // Layer 5: Difficulty zones (depends on biomes, towns)
  | "wilderness" // Layer 6: PVP wilderness zone
  | "mobSpawns" // Layer 7: Mob spawn configuration
  | "npcs" // Layer 8: NPC placements
  | "bosses" // Layer 9: Boss placements
  | "quests" // Layer 10: Quest definitions
  | "events" // Layer 11: Events
  | "lore"; // Layer 12: Lore entries

/**
 * Validation result for world data
 */
export interface WorldValidationResult {
  valid: boolean;
  errors: WorldValidationError[];
  warnings: WorldValidationWarning[];
}

export interface WorldValidationError {
  layer: WorldLayer;
  itemId: string;
  message: string;
  severity: "error";
}

export interface WorldValidationWarning {
  layer: WorldLayer;
  itemId: string;
  message: string;
  severity: "warning";
}
