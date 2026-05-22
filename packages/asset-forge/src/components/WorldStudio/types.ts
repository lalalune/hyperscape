/**
 * WorldStudio Types — Phase 3 spatial editing extensions
 *
 * These extend the WorldBuilder types with new placement entity types
 * and manifest-driven palette categories.
 */

import type { WorldPosition, PlacedNPC } from "../WorldBuilder/types";
import type { GeneratedTown as ProcgenTown } from "@hyperforge/procgen/building/town";

export type { PlacedNPC };

// ============== PLACEMENT ENTITY TYPES ==============

/** Player spawn point (initial, respawn, teleport arrival) */
export interface PlacedSpawnPoint {
  id: string;
  name: string;
  position: WorldPosition;
  rotation: number;
  spawnType: "initial" | "death-respawn" | "teleport-arrival";
  /** Max players that can spawn here simultaneously */
  capacity: number;
  /** Linked town or region ID */
  linkedAreaId?: string;
  properties: Record<string, unknown>;
}

/** Teleport destination node */
export interface PlacedTeleport {
  id: string;
  name: string;
  position: WorldPosition;
  /** Connected teleport node IDs (bidirectional network) */
  connections: string[];
  /** Requirements to use this teleport */
  requirements: {
    questId?: string;
    minLevel?: number;
    itemId?: string;
  };
  /** Gold cost to use */
  cost: number;
  properties: Record<string, unknown>;
}

/**
 * Entity provenance — how it was created.
 *
 * P0 of `PLAN_AGENT_STUDIO_PARITY.md`: agent-emitted placements
 * land in `extendedLayers` alongside designer + procgen entries,
 * tagged with `source: "agent"`. The outliner color-codes by
 * source so a user sees at a glance which entries came from the
 * AI vs. their own placements vs. procgen.
 *
 * `"hand-placed"` is kept for legacy compatibility; new code
 * should prefer `"designer"` for designer-placed entries
 * (matches the `PlacementCommonSchema.source` enum in
 * `manifest-schema/world-areas.ts`).
 */
export type EntitySource = "hand-placed" | "designer" | "procgen" | "agent";

/** Mob spawn zone */
export interface PlacedMobSpawn {
  id: string;
  /** References npcs.json mob ID */
  mobId: string;
  name: string;
  position: WorldPosition;
  /** Spawn radius from center */
  spawnRadius: number;
  /** Maximum simultaneous instances */
  maxCount: number;
  /** Respawn delay in game ticks */
  respawnTicks: number;
  /** How this entity was created */
  source?: EntitySource;
  /** Region that generated this entity (for procgen cleanup) */
  sourceRegionId?: string;
  properties: Record<string, unknown>;
}

/** Gathering resource node (mining, woodcutting, fishing) */
export interface PlacedResource {
  id: string;
  /** References gathering manifest ID (e.g., "ore_copper", "tree_oak") */
  resourceId: string;
  /** Resource category */
  resourceType: "mining" | "woodcutting" | "fishing" | "farming";
  name: string;
  position: WorldPosition;
  rotation: number;
  /** Model variant index (for resources with multiple models) */
  modelVariant: number;
  /** How this entity was created */
  source?: EntitySource;
  /** Region that generated this entity (for procgen cleanup) */
  sourceRegionId?: string;
  properties: Record<string, unknown>;
}

/** Station placement (anvil, furnace, bank, altar, etc.) */
export interface PlacedStation {
  id: string;
  /** References stations.json type */
  stationType: string;
  name: string;
  position: WorldPosition;
  rotation: number;
  /** For bank stations */
  bankId?: string;
  /** For runecrafting altars */
  runeType?: string;
  /** How this entity was created */
  source?: EntitySource;
  /** Region that generated this entity (for procgen cleanup) */
  sourceRegionId?: string;
  properties: Record<string, unknown>;
}

/** Dedicated mine area with clustered ore rocks */
export interface PlacedMine {
  id: string;
  name: string;
  position: WorldPosition;
  /** Base mine area radius (15-25m) */
  radius: number;
  /** Radial offset multipliers for organic shape (8 control points, 0.82-1.18 range) */
  radialOffsets: number[];
  /** Entry direction angle (radians) — rocks form a C on the opposite side */
  entryAngle: number;
  /** Biome at center */
  biome: string;
  /** Difficulty tier index */
  tierIndex: number;
  /** Ore rock breakdown */
  oreRocks: Array<{
    resourceId: string;
    count: number;
  }>;
  source: EntitySource;
  sourceRegionId?: string;
  properties: Record<string, unknown>;
}

/** Point of Interest placed in the world */
export interface PlacedPOI {
  id: string;
  name: string;
  category:
    | "dungeon"
    | "shrine"
    | "landmark"
    | "resource_area"
    | "ruin"
    | "camp"
    | "crossing"
    | "waystation"
    | "fishing_spot";
  position: WorldPosition;
  /** Importance weight (0-1) — higher = more road connectivity */
  importance: number;
  /** POI area radius in meters */
  radius: number;
  /** Linked road IDs */
  connectedRoads: string[];
  /** Entry point for visitors */
  entryPoint?: { x: number; z: number; angle: number };
  properties: Record<string, unknown>;
}

/** Water body definition */
export interface PlacedWaterBody {
  id: string;
  name: string;
  bodyType: "river" | "lake" | "pond";
  /** River waypoints (for rivers) */
  waypoints?: RiverWaypoint[];
  /** Polygon points (for lakes) */
  polygon?: Array<{ x: number; z: number }>;
  /** Water surface elevation */
  surfaceY?: number;
  /** Berm width for rivers */
  bermWidth?: number;
  /** Valley multiplier for rivers */
  valleyMultiplier?: number;
  properties: Record<string, unknown>;
}

/** River waypoint (matches RiverDefinition format) */
export interface RiverWaypoint {
  x: number;
  z: number;
  halfWidth: number;
  depth: number;
  surfaceY?: number;
}

// ============== AUDIO ZONE TYPES ==============

/** Music zone painted on the world map */
export interface MusicZone {
  id: string;
  name: string;
  /** Track ID from music.json */
  trackId: string;
  /** Combat music override track ID (when in combat within this zone) */
  combatTrackId?: string;
  /** Zone polygon (painted brush strokes converted to polygon) */
  polygon: Array<{ x: number; z: number }>;
  /** Priority (higher = takes precedence when zones overlap) */
  priority: number;
  /** Transition blend distance in meters */
  blendDistance: number;
}

/** Ambient sound zone */
export interface AmbientZone {
  id: string;
  name: string;
  /** Ambient type (used for layering) */
  ambientType:
    | "forest"
    | "cave"
    | "ocean"
    | "town"
    | "desert"
    | "mountain"
    | "swamp"
    | "custom";
  /** Sound asset paths (can layer multiple) */
  tracks: string[];
  /** Zone polygon */
  polygon: Array<{ x: number; z: number }>;
  /** Volume (0-1) */
  volume: number;
  /** Falloff distance at zone edges in meters */
  falloffDistance: number;
}

/** Point-source SFX trigger */
export interface SFXTrigger {
  id: string;
  name: string;
  /** Sound asset path */
  soundPath: string;
  /** World position */
  position: WorldPosition;
  /** Audible radius in meters */
  radius: number;
  /** Playback volume (0-1) */
  volume: number;
  /** Whether the sound loops */
  looping: boolean;
  /** Description for AI generation */
  description?: string;
}

/** Audio layer data */
export interface AudioLayers {
  musicZones: MusicZone[];
  ambientZones: AmbientZone[];
  sfxTriggers: SFXTrigger[];
  /** Dynamic module audio entity types */
  [key: string]: unknown;
}

export const EMPTY_AUDIO_LAYERS: AudioLayers = {
  musicZones: [],
  ambientZones: [],
  sfxTriggers: [],
};

// ============== AI GENERATION TYPES ==============

/** AI generation job status */
export type AIGenerationStatus =
  | "idle"
  | "generating"
  | "reviewing"
  | "accepted"
  | "rejected";

/** AI-generated dialogue tree */
export interface GeneratedDialogue {
  npcId: string;
  status: AIGenerationStatus;
  nodes?: Array<{
    id: string;
    text: string;
    responses?: Array<{ text: string; nextNodeId?: string; effect?: string }>;
  }>;
  error?: string;
}

/** AI-generated voice clip */
export interface GeneratedVoiceClip {
  id: string;
  npcId: string;
  dialogueNodeId: string;
  text: string;
  audioUrl?: string;
  voiceId?: string;
  status: AIGenerationStatus;
}

/** AI-generated quest */
export interface GeneratedQuest {
  status: AIGenerationStatus;
  quest?: {
    name: string;
    description: string;
    difficulty: string;
    stages: Array<{
      type: string;
      description: string;
      npcId?: string;
      target?: string;
      count?: number;
    }>;
    rewards: {
      questPoints?: number;
      items?: Array<{ itemId: string; quantity: number }>;
      xp?: Record<string, number>;
    };
  };
  error?: string;
}

/** AI generation state */
export interface AIGenerationState {
  /** Current top-level generation status */
  status: "idle" | "generating" | "error";
  /** Entity currently being generated for */
  activeEntityId: string | null;
  /** Last error message */
  error: string | null;
  dialogues: GeneratedDialogue[];
  voiceClips: GeneratedVoiceClip[];
  quests: GeneratedQuest[];
}

export const EMPTY_AI_GENERATION_STATE: AIGenerationState = {
  status: "idle",
  activeEntityId: null,
  error: null,
  dialogues: [],
  voiceClips: [],
  quests: [],
};

// ============== REGION / ZONE TYPES ==============

/** A named world region defined by painted terrain tiles */
export interface PlacedRegion {
  id: string;
  name: string;
  description: string;
  /** Terrain tile keys ("tileX_tileZ" format) comprising this region */
  tileKeys: string[];
  /** Tags for filtering/searching (e.g., "starter", "forest", "mining-hub") */
  tags: string[];
  /** Override biome within this region (empty = inherit from terrain) */
  biomeOverride?: string;
  /** Music track ID for this region */
  musicTrack?: string;
  /** Ambient sound for this region */
  ambientSound?: string;
  /** Spawn rules — controls what mobs/resources procgen places in this region */
  spawnRules?: RegionSpawnRules;
  /** Auto-generated zone bounds (set by zone auto-gen, null for hand-painted) */
  autoGenBounds?: AutoGenBounds;
}

// ============== AUTO-GENERATION TYPES ==============

/** Contour-based zone bounds for auto-generated regions */
export interface AutoGenBounds {
  /** Difficulty scalar range that defines this zone [min, max) */
  difficultyRange: [number, number];
  /** Biome filter — null means any biome */
  biomeFilter: string | null;
  /** World-space bounding box */
  boundingBox: { minX: number; maxX: number; minZ: number; maxZ: number };
  /** Seed used for generation (for deterministic regeneration) */
  generationSeed: number;
  /** Timestamp when this zone was generated */
  generatedAt: number;
  /** Grid resolution used during generation (meters) */
  gridResolution: number;
  /** World-space cell positions (game coords) — for rendering the zone overlay */
  cellPositions: Array<{ x: number; z: number }>;
}

/** Configuration for a difficulty tier */
export interface DifficultyTierConfig {
  name: string;
  scalarRange: [number, number];
  levelRange: [number, number];
  resourceLevelRange: [number, number];
  namePrefix: string;
  color: string;
  mobDensityMultiplier: number;
  resourceDensityMultiplier: number;
  /** Minimum distance between resources and mob spawns (meters) */
  mobResourceBuffer: number;
}

/** Full configuration for the auto-generation pipeline */
export interface AutoGenConfig {
  /** Grid sampling resolution in meters (default: 10) */
  gridResolution: number;
  /** Minimum zone area in m² to keep (smaller zones merge) */
  minZoneArea: number;
  /** Maximum zone span in meters (larger zones split) */
  maxZoneSpan: number;
  /** Global seed for deterministic generation */
  seed: number;
  /** Difficulty tier definitions */
  tiers: DifficultyTierConfig[];
  /** Minimum spacing between mob spawns (meters) */
  mobSpacing: number;
  /** Minimum spacing between resource spawns (meters) */
  resourceSpacing: number;
}

/** A single auto-generated zone (preview, before commit) */
export interface AutoGenZone {
  id: string;
  name: string;
  tierIndex: number;
  biome: string;
  /** Centroid in world coordinates */
  centroid: { x: number; z: number };
  /** Bounding box in world coordinates */
  bounds: { minX: number; maxX: number; minZ: number; maxZ: number };
  /** Area in m² */
  area: number;
  /** Grid cells belonging to this zone */
  cellCount: number;
  /** Spawn table derived from manifests */
  spawnRules: RegionSpawnRules;
  /** Auto-gen bounds for contour membership */
  autoGenBounds: AutoGenBounds;
}

/** Result of the auto-generation pipeline */
export interface AutoGenResult {
  zones: AutoGenZone[];
  mobSpawns: PlacedMobSpawn[];
  resources: PlacedResource[];
  /** Auto-placed spawn points at town plazas */
  spawnPoints: PlacedSpawnPoint[];
  /** Auto-placed lodestone teleports at town plazas */
  teleports: PlacedTeleport[];
  /** Auto-generated road network between towns */
  roads: Array<{
    id: string;
    path: Array<{ x: number; y: number; z: number }>;
    width: number;
    connectedTowns: [string, string];
    isMainRoad: boolean;
  }>;
  /** Newly generated towns with full procgen data (buildings, roads, landmarks) */
  generatedTowns: ProcgenTown[];
  /** Dedicated mine areas with clustered ore rocks */
  mines: PlacedMine[];
  stats: AutoGenStats;
}

/** Summary statistics from auto-generation */
export interface AutoGenStats {
  zonesGenerated: number;
  zoneMerged: number;
  totalMobs: number;
  totalResources: number;
  totalMines: number;
  totalArea: number;
  generationTimeMs: number;
  /** Detected land bounding box (excludes ocean) */
  landBounds?: { minX: number; maxX: number; minZ: number; maxZ: number };
  /** Per-tier breakdown */
  tierBreakdown: Array<{
    tierName: string;
    zoneCount: number;
    mobCount: number;
    resourceCount: number;
    area: number;
  }>;
}

// ============== ZONE TILE CONSTANTS ==============

/**
 * Zone tile size in meters. This is the resolution of the zone painting grid.
 * 1m matches game movement tiles for precise editing.
 * Brush sizes scale from 1m to 50m for both fine-tuning and bulk painting.
 */
export const ZONE_TILE_SIZE = 1;

// ============== TILE REGION HELPERS ==============

/** Encode tile coordinates to a tile key string */
export function tileKey(tileX: number, tileZ: number): string {
  return `${tileX}_${tileZ}`;
}

/** Decode a tile key string to tile coordinates */
export function parseTileKey(key: string): { x: number; z: number } {
  const [x, z] = key.split("_").map(Number);
  return { x, z };
}

/** Get bounding box of a tile set in world coordinates */
export function tileBoundsWorld(
  tileKeys: string[],
  tileSize: number,
): { minX: number; maxX: number; minZ: number; maxZ: number } {
  if (tileKeys.length === 0) {
    return { minX: 0, maxX: 0, minZ: 0, maxZ: 0 };
  }
  let minX = Infinity,
    maxX = -Infinity,
    minZ = Infinity,
    maxZ = -Infinity;
  for (const key of tileKeys) {
    const { x, z } = parseTileKey(key);
    const wx = x * tileSize;
    const wz = z * tileSize;
    if (wx < minX) minX = wx;
    if (wx + tileSize > maxX) maxX = wx + tileSize;
    if (wz < minZ) minZ = wz;
    if (wz + tileSize > maxZ) maxZ = wz + tileSize;
  }
  return { minX, maxX, minZ, maxZ };
}

/** Spawn rule overrides for a region (layered on top of biome defaults) */
export interface RegionSpawnRules {
  mobs?: {
    mode: "replace" | "extend";
    table: Array<{
      mobId: string;
      weight: number;
      minScalar?: number;
      maxScalar?: number;
    }>;
    densityMultiplier?: number;
  };
  resources?: {
    mode: "replace" | "extend";
    table: Array<{
      resourceId: string;
      weight: number;
      clusterSize?: number;
      clusterSpacing?: number;
      affinity?: "water" | "mountain" | "road" | "any";
    }>;
    densityMultiplier?: number;
  };
  stations?: Array<{
    stationType: string;
    count: number;
    placement: "near-road" | "center" | "near-water" | "random";
  }>;
}

// ============== DANGER SOURCE TYPES ==============

/** A placeable point that increases local difficulty beyond biome defaults */
export interface PlacedDangerSource {
  id: string;
  name: string;
  position: WorldPosition;
  /** Radius of influence in meters */
  radius: number;
  /** Intensity (0-3), adds to biome difficulty scalar */
  intensity: number;
  /** How quickly intensity falls off with distance (higher = sharper falloff) */
  falloffCurve: number;
  /** Optional description for tooltips */
  description?: string;
}

// ============== WILDERNESS BOUNDARY TYPES ==============

/** Draggable polyline marking where PvP begins */
export interface WildernessBoundary {
  /** Boundary waypoints forming an east-west polyline */
  points: Array<{ x: number; z: number }>;
  /** How many meters north of the line equals 1 wilderness level */
  levelScale: number;
  /** Maximum wilderness level */
  maxLevel: number;
}

// ============== CUSTOM ASSET TYPES (Phase 9.1) ==============

/** An imported/generated asset placed in the world */
export interface PlacedCustomAsset {
  id: string;
  name: string;
  /** HyperForge asset ID (maps to /api/assets/:id) */
  assetId: string;
  /** Display name from the asset database */
  assetName: string;
  /** Position in world */
  position: WorldPosition;
  /** Y-axis rotation in radians */
  rotation: number;
  /** Uniform scale */
  scale: number;
  /** Optional model file path override */
  modelPath?: string;
  /** How this entity was created */
  source?: EntitySource;
  /** Region that generated this entity (for procgen cleanup) */
  sourceRegionId?: string;
  /** Custom metadata for extension */
  properties: Record<string, unknown>;
}

// ============== PREFAB TYPES (Phase 9.2) ==============

/** A saved template of multiple entities with relative positions */
export interface Prefab {
  id: string;
  name: string;
  /** Description for Content Browser */
  description?: string;
  /** The entities in this prefab, stored with positions relative to the prefab origin */
  entries: PrefabEntry[];
  /** Timestamp of creation */
  createdAt: number;
}

/** Valid entity types that can be stored in a prefab */
export type PrefabEntityType =
  | "npc"
  | "spawnPoint"
  | "teleport"
  | "mobSpawn"
  | "resource"
  | "station"
  | "poi"
  | "waterBody"
  | "musicZone"
  | "ambientZone"
  | "sfxTrigger"
  | "region"
  | "dangerSource"
  | "customAsset";

/** A single entity within a prefab, with position relative to the prefab origin */
export interface PrefabEntry {
  /** Selection type */
  entityType: PrefabEntityType;
  /** Template/manifest ID */
  templateId: string;
  /** Display name */
  name: string;
  /** Offset from prefab origin */
  offset: WorldPosition;
  /** Y-axis rotation */
  rotation: number;
  /** Extra data needed to recreate (e.g., npcTypeId, stationType, resourceType) */
  data: Record<string, unknown>;
}

// ============== EXTENDED WORLD LAYERS ==============

/** Additional layers for Phase 3+ entity types */
export interface ExtendedWorldLayers {
  npcs: PlacedNPC[];
  spawnPoints: PlacedSpawnPoint[];
  teleports: PlacedTeleport[];
  mobSpawns: PlacedMobSpawn[];
  resources: PlacedResource[];
  stations: PlacedStation[];
  pois: PlacedPOI[];
  waterBodies: PlacedWaterBody[];
  regions: PlacedRegion[];
  dangerSources: PlacedDangerSource[];
  wildernessBoundary: WildernessBoundary | null;
  mines: PlacedMine[];
  /** Phase 9.1: Imported/generated custom assets */
  customAssets: PlacedCustomAsset[];
  /** Dynamic module entity types — arrays auto-initialized by entityReducer */
  [key: string]: unknown;
}

/** Default empty extended layers */
export const EMPTY_EXTENDED_LAYERS: ExtendedWorldLayers = {
  npcs: [],
  spawnPoints: [],
  teleports: [],
  mobSpawns: [],
  resources: [],
  stations: [],
  pois: [],
  waterBodies: [],
  regions: [],
  dangerSources: [],
  wildernessBoundary: null,
  mines: [],
  customAssets: [],
};

// ============== ENTITY PALETTE TYPES ==============

/** Category in the entity palette.
 * Relaxed to `string` to support dynamic GameModule categories.
 * Hyperia categories retain their literal values for type safety in existing code. */
export type PaletteCategory = string;

/** Template item from a manifest */
export interface PaletteItem {
  id: string;
  name: string;
  category: PaletteCategory;
  /** Icon path or model path for preview */
  iconPath?: string;
  modelPath?: string;
  /** Description text */
  description?: string;
  /** Level requirement for display */
  levelRequired?: number;
  /** Original manifest data for reference */
  manifestData: Record<string, unknown>;
  /** Entity type schema ID for generic module placement */
  entityTypeId?: string;
}

// ============== PLACEMENT STATE ==============

/** Active placement in progress (ghost preview following cursor) */
export interface ActivePlacement {
  /** What palette category */
  category: PaletteCategory;
  /** Template item ID from manifest */
  templateId: string;
  /** Template name for display */
  templateName: string;
  /** Entity type schema ID for generic module placement (e.g., "spawnPoint") */
  entityTypeId?: string;
  /** Current ghost position (updates as mouse moves) */
  position: WorldPosition;
  /** Current rotation */
  rotation: number;
  /** Whether position has been confirmed */
  confirmed: boolean;
}

// ============== BRUSH TOOL TYPES ==============

/** Terrain brush mode */
export type TerrainBrushMode = "raise" | "lower" | "flatten" | "smooth";

/** Biome paint mode */
export type BiomePaintMode = "paint" | "erase";

/** Vegetation paint mode */
export type VegetationPaintMode = "add" | "remove";

/** Brush falloff curve */
export type BrushFalloff = "sharp" | "linear" | "smooth";

/** Active brush type */
export type BrushType =
  | "terrain"
  | "biome"
  | "vegetation"
  | "collision"
  | "material"
  | "foliage";

/** Brush settings for all brush types */
export interface BrushSettings {
  /** Active brush type */
  brushType: BrushType;
  /** Brush radius in meters */
  radius: number;
  /** Brush strength (0-1) */
  strength: number;
  /** Brush falloff curve */
  falloff: BrushFalloff;
  /** Terrain-specific: brush mode */
  terrainMode: TerrainBrushMode;
  /** Terrain-specific: flatten target height (set on first click) */
  flattenTarget: number | null;
  /** Biome-specific: target biome type */
  biomePaintTarget: string;
  /** Biome-specific: paint/erase mode */
  biomePaintMode: BiomePaintMode;
  /** Vegetation-specific: add/remove mode */
  vegetationPaintMode: VegetationPaintMode;
  /** Vegetation-specific: species filter (empty = all) */
  vegetationSpeciesFilter: string[];
  /** Collision-specific: block or unblock tiles */
  collisionMode: "block" | "unblock";
  /** Material-specific: target material layer */
  materialPaintTarget: import("@hyperforge/procgen/terrain").MaterialLayerId;
  /** Foliage-specific: add/remove mode */
  foliagePaintMode: VegetationPaintMode;
  /** Foliage-specific: type filter (empty = all) */
  foliageTypeFilter: string[];
}

export const DEFAULT_BRUSH_SETTINGS: BrushSettings = {
  brushType: "terrain",
  radius: 10,
  strength: 0.5,
  falloff: "smooth",
  terrainMode: "raise",
  flattenTarget: null,
  biomePaintTarget: "forest",
  biomePaintMode: "paint",
  vegetationPaintMode: "add",
  vegetationSpeciesFilter: [],
  collisionMode: "block",
  materialPaintTarget: "grass",
  foliagePaintMode: "add",
  foliageTypeFilter: [],
};

/** A single terrain sculpt stroke (non-destructive overlay on procgen) */
export interface TerrainSculptStroke {
  id: string;
  /** World position where stroke was applied */
  center: { x: number; z: number };
  /** Brush radius at time of application */
  radius: number;
  /** Brush strength */
  strength: number;
  /** Falloff curve */
  falloff: BrushFalloff;
  /** Mode applied */
  mode: TerrainBrushMode;
  /** For flatten: target height */
  flattenTarget?: number;
  /** Timestamp for ordering */
  timestamp: number;
}

/** A single biome paint stroke */
export interface BiomePaintStroke {
  id: string;
  center: { x: number; z: number };
  radius: number;
  strength: number;
  falloff: BrushFalloff;
  /** Target biome to paint */
  targetBiome: string;
  timestamp: number;
}

/** A single vegetation paint stroke */
export interface VegetationPaintStroke {
  id: string;
  center: { x: number; z: number };
  radius: number;
  strength: number;
  falloff: BrushFalloff;
  /** Add or remove */
  mode: VegetationPaintMode;
  /** Species filter at time of application (empty = all) */
  speciesFilter: string[];
  timestamp: number;
}

/** A single material paint stroke — sets material layer weight on terrain */
export interface MaterialPaintStroke {
  id: string;
  center: { x: number; z: number };
  radius: number;
  strength: number;
  falloff: BrushFalloff;
  /** Target material layer to paint */
  targetMaterial: import("@hyperforge/procgen/terrain").MaterialLayerId;
  timestamp: number;
}

/** A single foliage paint stroke — density override for ground cover */
export interface FoliagePaintStroke {
  id: string;
  center: { x: number; z: number };
  radius: number;
  strength: number;
  falloff: BrushFalloff;
  /** Add increases density, remove suppresses foliage */
  mode: VegetationPaintMode;
  /** Which foliage types affected (empty = all). "grass", "flower", "rock" */
  foliageTypes: string[];
  timestamp: number;
}

/** Tile collision override — marks a 1m tile as blocked or unblocked */
export interface TileCollisionOverride {
  /** Tile X coordinate (world X / tileSize, floored) */
  tileX: number;
  /** Tile Z coordinate (world Z / tileSize, floored) */
  tileZ: number;
  /** Whether this tile is blocked */
  blocked: boolean;
  /** Optional edge flags (wall on specific sides) */
  edges?: {
    north?: boolean;
    south?: boolean;
    east?: boolean;
    west?: boolean;
  };
}

/** All brush stroke overlays (non-destructive) */
export interface BrushOverlays {
  terrainSculpts: TerrainSculptStroke[];
  biomePaints: BiomePaintStroke[];
  vegetationPaints: VegetationPaintStroke[];
  materialPaints: MaterialPaintStroke[];
  foliagePaints: FoliagePaintStroke[];
  tileCollisions: TileCollisionOverride[];
}

export const EMPTY_BRUSH_OVERLAYS: BrushOverlays = {
  terrainSculpts: [],
  biomePaints: [],
  vegetationPaints: [],
  materialPaints: [],
  foliagePaints: [],
  tileCollisions: [],
};

// ============== MANIFEST DATA TYPES ==============

/** NPC manifest entry (from npcs.json) */
export interface ManifestNPC {
  id: string;
  name: string;
  description: string;
  category: "mob" | "boss" | "neutral" | "quest";
  levelRange: [number, number];
  appearance: {
    modelPath: string;
    iconPath?: string;
    scale?: number;
  };
  services?: {
    enabled: boolean;
    types: string[];
  };
  /** Building type this NPC belongs to (e.g., "smithy", "bank", "inn") */
  buildingRole?: string;
  /** Store ID this NPC manages (e.g., "sword_store", "general_store") */
  storeId?: string;
  /** Placement rules for contextual positioning */
  placementRules?: NPCPlacementRules;
  /** Full raw data for detailed editing */
  _raw?: Record<string, unknown>;
}

/** Placement rules for contextual NPC positioning */
export interface NPCPlacementRules {
  /** Preferred biome for placement */
  biomePreference?: string;
  /** Placement strategy */
  placement?:
    | "town_interior"
    | "town_edge"
    | "biome_edge"
    | "near_water"
    | "road_side";
  /** Maximum distance from nearest town */
  maxDistFromTown?: number;
  /** Minimum distance from nearest town */
  minDistFromTown?: number;
}

/** Station manifest entry (from stations.json) */
export interface ManifestStation {
  type: string;
  name: string;
  model: string;
  examine: string;
}

/** Mining resource manifest entry */
export interface ManifestMiningRock {
  id: string;
  name: string;
  type: string;
  modelPath: string;
  levelRequired: number;
  examine: string;
  /** Full raw manifest row — preserved so the editor can round-trip into the gathering hot-reload path without re-synthesizing lossy fields (harvestYield, toolRequired, cycle ticks, etc.). */
  _raw?: Record<string, unknown>;
}

/** Woodcutting resource manifest entry */
export interface ManifestTree {
  id: string;
  name: string;
  type: string;
  modelVariants: string[];
  levelRequired: number;
  examine: string;
  /** Full raw manifest row — see `ManifestMiningRock._raw`. */
  _raw?: Record<string, unknown>;
}

/** Fishing spot manifest entry */
export interface ManifestFishingSpot {
  id: string;
  name: string;
  type: string;
  toolRequired: string;
  levelRequired: number;
  examine: string;
  /** Full raw manifest row — see `ManifestMiningRock._raw`. */
  _raw?: Record<string, unknown>;
}

// ============== ITEM MANIFEST TYPES ==============

/** Generic item entry (from items/*.json) */
export interface ManifestItem {
  id: string;
  name: string;
  type:
    | "weapon"
    | "armor"
    | "resource"
    | "tool"
    | "ammunition"
    | "food"
    | "misc"
    | "rune";
  tier?: string;
  value: number;
  weight?: number;
  equipSlot?: string;
  description?: string;
  examine?: string;
  tradeable?: boolean;
  stackable?: boolean;
  rarity?: string;
  modelPath?: string;
  iconPath?: string;
  levelRequired?: number;
  bonuses?: Record<string, number>;
}

// ============== QUEST MANIFEST TYPES ==============

/** Quest stage */
export interface ManifestQuestStage {
  id: string;
  type: string;
  description: string;
  npcId?: string;
  target?: string;
  count?: number;
  location?: string;
}

/** Quest entry (from quests.json) */
export interface ManifestQuest {
  id: string;
  name: string;
  description: string;
  difficulty: string;
  questPoints: number;
  replayable?: boolean;
  startNpc?: string;
  requirements?: {
    quests?: string[];
    skills?: Record<string, number>;
    items?: string[];
  };
  stages: ManifestQuestStage[];
  rewards?: {
    questPoints?: number;
    items?: Array<{ itemId: string; quantity: number }>;
    xp?: Record<string, number>;
  };
  /** Placement rules for the quest's start NPC */
  placementRules?: NPCPlacementRules;
}

// ============== STORE MANIFEST TYPES ==============

/** Store item entry */
export interface ManifestStoreItem {
  id: string;
  itemId: string;
  name: string;
  price: number;
  stockQuantity: number;
  restockTime?: number;
  description?: string;
  category?: string;
}

/** Store entry (from stores.json) */
export interface ManifestStore {
  id: string;
  name: string;
  buyback?: boolean;
  buybackRate?: number;
  description?: string;
  items: ManifestStoreItem[];
}

// ============== COMBAT MANIFEST TYPES ==============

/** Combat spell entry */
export interface ManifestCombatSpell {
  id: string;
  name: string;
  level: number;
  baseMaxHit: number;
  baseXp: number;
  element: string;
  attackSpeed?: number;
  runes: Array<{ runeId: string; quantity: number }>;
  tier: string;
}

/** Prayer entry */
export interface ManifestPrayer {
  id: string;
  name: string;
  description: string;
  icon?: string;
  level: number;
  category: string;
  drainEffect: number;
  bonuses: Record<string, number>;
  conflicts: string[];
}

/** Rune entry */
export interface ManifestRune {
  id: string;
  name: string;
  element: string | null;
  stackable: boolean;
}

/**
 * Elemental staff → infinite-rune mapping entry. Parallel list to
 * `ManifestRune[]`; sourced from `runes.json`'s `elementalStaves` array
 * and needed by `hotReloadRunes` to rebuild the full `RunesManifest`
 * (Phase B3.1e).
 */
export interface ManifestElementalStaff {
  staffId: string;
  providesInfinite: string[];
}

/** Ammunition entry */
export interface ManifestAmmunition {
  id: string;
  name: string;
  rangedStrength: number;
  requiredRangedLevel: number;
  requiredBowTier?: number;
}

// ============== RECIPE MANIFEST TYPES ==============

/** Generic recipe entry */
export interface ManifestRecipe {
  id: string;
  skill: string;
  /** Output item ID. Undefined for XP-only skills like firemaking. */
  output?: string;
  inputs: Array<{ itemId: string; quantity: number }>;
  level: number;
  xp: number;
  ticks?: number;
  category?: string;
  /** Raw recipe data for skill-specific fields */
  _raw?: Record<string, unknown>;
}

// ============== PROGRESSION MANIFEST TYPES ==============

/** Skill unlock milestone */
export interface ManifestSkillUnlock {
  skill: string;
  level: number;
  description: string;
  type?: string;
}

/** Tier requirement entry */
export interface ManifestTierRequirement {
  tier: string;
  category: string;
  requirements: Record<string, number>;
}

// ============== ARENA MANIFEST TYPES ==============

/** Duel arena entry */
export interface ManifestDuelArena {
  arenaId: number;
  center: { x: number; z: number };
  size: number;
  spawnPoints: Array<{ x: number; y: number; z: number }>;
  trapdoorPositions?: Array<{ x: number; z: number }>;
}

// ============== LOD SETTINGS TYPES ==============

/** LOD settings */
export interface ManifestLODSettings {
  version?: number;
  distanceThresholds: Record<
    string,
    { lod1: number; imposter: number; fadeOut: number }
  >;
  dissolve?: {
    closeRangeStart: number;
    closeRangeEnd: number;
    transitionDuration: number;
  };
  vertexBudgets?: Record<string, number>;
}

// ============== MANIFEST REGISTRY ==============

/** Category grouping for manifest browser */
export type ManifestCategory =
  | "world"
  | "entities"
  | "items"
  | "combat"
  | "progression"
  | "recipes"
  | "gathering"
  | "audio"
  | "config";

/** Manifest file metadata for the browser */
export interface ManifestFileInfo {
  name: string;
  displayName: string;
  filename: string;
  category: ManifestCategory;
  description: string;
  editable: boolean;
  entryCount?: number;
}

/** All manifest files organized for the browser */
export const MANIFEST_REGISTRY: ManifestFileInfo[] = [
  // World
  {
    name: "biomes",
    displayName: "Biomes",
    filename: "biomes.json",
    category: "world",
    description: "Biome definitions with vegetation, mobs, difficulty",
    editable: true,
  },
  {
    name: "world-areas",
    displayName: "World Areas",
    filename: "world-areas.json",
    category: "world",
    description: "World area definitions with NPCs, resources, stations",
    editable: true,
  },
  {
    name: "vegetation",
    displayName: "Vegetation",
    filename: "vegetation.json",
    category: "world",
    description:
      "Vegetation asset definitions (mostly empty — real data in biomes)",
    editable: true,
  },
  {
    name: "buildings",
    displayName: "Buildings",
    filename: "buildings.json",
    category: "world",
    description: "Town building definitions (placeholder)",
    editable: true,
  },
  {
    name: "regions",
    displayName: "Regions",
    filename: "regions.json",
    category: "world",
    description: "Named regions with polygonal boundaries, spawn rules",
    editable: false,
  },
  {
    name: "danger-sources",
    displayName: "Danger Sources",
    filename: "danger-sources.json",
    category: "world",
    description: "Localized difficulty hotspots that increase danger",
    editable: false,
  },
  {
    name: "wilderness-boundary",
    displayName: "Wilderness Boundary",
    filename: "wilderness-boundary.json",
    category: "world",
    description: "PvP wilderness boundary polyline",
    editable: false,
  },
  {
    name: "brush-overlays",
    displayName: "Brush Overlays",
    filename: "brush-overlays.json",
    category: "world",
    description:
      "Terrain sculpt strokes and biome paint strokes from the brush tool",
    editable: false,
  },
  // Entities
  {
    name: "npcs",
    displayName: "NPCs",
    filename: "npcs.json",
    category: "entities",
    description: "NPC/mob definitions: stats, drops, dialogue, appearance",
    editable: true,
  },
  {
    name: "stations",
    displayName: "Stations",
    filename: "stations.json",
    category: "entities",
    description: "Crafting stations: anvil, furnace, altar, etc.",
    editable: true,
  },
  {
    name: "stores",
    displayName: "Stores",
    filename: "stores.json",
    category: "entities",
    description: "Shop inventories with prices and stock",
    editable: true,
  },
  // Items
  {
    name: "items/weapons",
    displayName: "Weapons",
    filename: "items/weapons.json",
    category: "items",
    description: "Weapon items: swords, bows, staves, etc.",
    editable: true,
  },
  {
    name: "items/armor",
    displayName: "Armor",
    filename: "items/armor.json",
    category: "items",
    description: "Armor items: helmets, bodies, legs, shields",
    editable: true,
  },
  {
    name: "items/resources",
    displayName: "Resources",
    filename: "items/resources.json",
    category: "items",
    description: "Resource items: ores, logs, fish, gems",
    editable: true,
  },
  {
    name: "items/tools",
    displayName: "Tools",
    filename: "items/tools.json",
    category: "items",
    description: "Tool items: pickaxes, hatchets, fishing rods",
    editable: true,
  },
  {
    name: "items/ammunition",
    displayName: "Ammunition",
    filename: "items/ammunition.json",
    category: "items",
    description: "Arrow items for ranged combat",
    editable: true,
  },
  {
    name: "items/food",
    displayName: "Food",
    filename: "items/food.json",
    category: "items",
    description: "Food items: cooked fish, breads, pies",
    editable: true,
  },
  {
    name: "items/misc",
    displayName: "Misc Items",
    filename: "items/misc.json",
    category: "items",
    description: "Miscellaneous items: quest items, bones, keys",
    editable: true,
  },
  {
    name: "items/runes",
    displayName: "Rune Items",
    filename: "items/runes.json",
    category: "items",
    description: "Rune items for magic spells",
    editable: true,
  },
  // Combat
  {
    name: "combat-spells",
    displayName: "Combat Spells",
    filename: "combat-spells.json",
    category: "combat",
    description: "Magic spells: strike, bolt, blast tiers",
    editable: true,
  },
  {
    name: "prayers",
    displayName: "Prayers",
    filename: "prayers.json",
    category: "combat",
    description: "Prayer abilities with drain rates and bonuses",
    editable: true,
  },
  {
    name: "runes",
    displayName: "Runes",
    filename: "runes.json",
    category: "combat",
    description: "Rune types and elemental staff mappings",
    editable: true,
  },
  {
    name: "ammunition",
    displayName: "Ammunition Config",
    filename: "ammunition.json",
    category: "combat",
    description: "Arrow types with ranged strength bonuses",
    editable: true,
  },
  {
    name: "duel-arenas",
    displayName: "Duel Arenas",
    filename: "duel-arenas.json",
    category: "combat",
    description: "PvP arena layouts with spawn positions",
    editable: true,
  },
  // Progression
  {
    name: "skill-unlocks",
    displayName: "Skill Unlocks",
    filename: "skill-unlocks.json",
    category: "progression",
    description: "Level milestones and unlock descriptions per skill",
    editable: true,
  },
  {
    name: "tier-requirements",
    displayName: "Tier Requirements",
    filename: "tier-requirements.json",
    category: "progression",
    description: "Equipment tier level gates: melee, tools, ranged, magic",
    editable: true,
  },
  {
    name: "tools",
    displayName: "Tool Priority",
    filename: "tools.json",
    category: "progression",
    description: "Tool priority ordering and bonus tick mechanics",
    editable: true,
  },
  {
    name: "quests",
    displayName: "Quests",
    filename: "quests.json",
    category: "progression",
    description: "Quest definitions with stages, objectives, rewards",
    editable: true,
  },
  // Recipes
  {
    name: "recipes/smithing",
    displayName: "Smithing Recipes",
    filename: "recipes/smithing.json",
    category: "recipes",
    description: "Bar → weapon/armor recipes by tier",
    editable: true,
  },
  {
    name: "recipes/fletching",
    displayName: "Fletching Recipes",
    filename: "recipes/fletching.json",
    category: "recipes",
    description: "Arrow and bow crafting recipes",
    editable: true,
  },
  {
    name: "recipes/crafting",
    displayName: "Crafting Recipes",
    filename: "recipes/crafting.json",
    category: "recipes",
    description: "Leather, jewelry, gem cutting recipes",
    editable: true,
  },
  {
    name: "recipes/cooking",
    displayName: "Cooking Recipes",
    filename: "recipes/cooking.json",
    category: "recipes",
    description: "Raw → cooked food with burn levels",
    editable: true,
  },
  {
    name: "recipes/smelting",
    displayName: "Smelting Recipes",
    filename: "recipes/smelting.json",
    category: "recipes",
    description: "Ore + coal → bar recipes",
    editable: true,
  },
  {
    name: "recipes/runecrafting",
    displayName: "Runecrafting Recipes",
    filename: "recipes/runecrafting.json",
    category: "recipes",
    description: "Essence → rune recipes",
    editable: true,
  },
  {
    name: "recipes/firemaking",
    displayName: "Firemaking Recipes",
    filename: "recipes/firemaking.json",
    category: "recipes",
    description: "Log → fire XP recipes",
    editable: true,
  },
  {
    name: "recipes/tanning",
    displayName: "Tanning Recipes",
    filename: "recipes/tanning.json",
    category: "recipes",
    description: "Hide → leather with gold cost",
    editable: true,
  },
  // Gathering
  {
    name: "gathering/mining",
    displayName: "Mining Rocks",
    filename: "gathering/mining.json",
    category: "gathering",
    description: "Mining rock types with yield and respawn",
    editable: true,
  },
  {
    name: "gathering/woodcutting",
    displayName: "Woodcutting Trees",
    filename: "gathering/woodcutting.json",
    category: "gathering",
    description: "Tree types with model variants and hatchet gates",
    editable: true,
  },
  {
    name: "gathering/fishing",
    displayName: "Fishing Spots",
    filename: "gathering/fishing.json",
    category: "gathering",
    description: "Fishing spot types with catch tables",
    editable: true,
  },
  // Audio
  {
    name: "music",
    displayName: "Music",
    filename: "music.json",
    category: "audio",
    description: "Music tracks: intro, normal, combat categories",
    editable: true,
  },
  // Config
  {
    name: "lod-settings",
    displayName: "LOD Settings",
    filename: "lod-settings.json",
    category: "config",
    description: "LOD distance thresholds and dissolve parameters",
    editable: true,
  },
  {
    name: "model-bounds",
    displayName: "Model Bounds",
    filename: "model-bounds.json",
    category: "config",
    description: "Auto-generated model bounding boxes (read-only)",
    editable: false,
  },
];

/** All loaded manifest data */
export interface ManifestData {
  npcs: ManifestNPC[];
  stations: ManifestStation[];
  miningRocks: ManifestMiningRock[];
  trees: ManifestTree[];
  fishingSpots: ManifestFishingSpot[];
  /** Extended manifest data for Phase 6 */
  items: ManifestItem[];
  quests: ManifestQuest[];
  stores: ManifestStore[];
  combatSpells: ManifestCombatSpell[];
  prayers: ManifestPrayer[];
  runes: ManifestRune[];
  elementalStaves: ManifestElementalStaff[];
  ammunition: ManifestAmmunition[];
  /**
   * Bow tier requirements keyed by bow id. Not currently edited
   * through the UI but preserved at load time so the ammunition
   * hot-reload path can round-trip without losing the top-level
   * `bowTiers` block that the runtime schema requires.
   */
  ammunitionBowTiers: Record<string, number>;
  recipes: ManifestRecipe[];
  skillUnlocks: ManifestSkillUnlock[];
  tierRequirements: ManifestTierRequirement[];
  duelArenas: ManifestDuelArena[];
  lodSettings: ManifestLODSettings | null;
  /** Raw manifest content by name (for JSON editing) */
  rawManifests: Record<string, unknown>;
  loaded: boolean;
  loading: boolean;
  error: string | null;
}

// ============== DEPLOYMENT TYPES (Phase 8) ==============

/** Deployment target environment */
export type DeployTarget = "staging" | "production";

/** A single diff entry for one manifest file */
export interface ManifestDiffEntry {
  /** Manifest filename (e.g. "npcs.json") */
  filename: string;
  /** Category for grouping in diff view */
  category: ManifestCategory;
  /** Change type */
  changeType: "added" | "modified" | "removed" | "unchanged";
  /** Number of entries added */
  entriesAdded: number;
  /** Number of entries modified */
  entriesModified: number;
  /** Number of entries removed */
  entriesRemoved: number;
  /** Human-readable summary (e.g. "3 NPCs added, 2 dialogue trees updated") */
  summary: string;
}

/** Diff between current world project and deployed state */
export interface DeploymentDiff {
  /** Per-manifest diffs */
  manifests: ManifestDiffEntry[];
  /** Asset changes (new/modified audio, models) */
  assetChanges: Array<{
    path: string;
    changeType: "added" | "modified" | "removed";
  }>;
  /** Total counts */
  totalAdded: number;
  totalModified: number;
  totalRemoved: number;
}

/** Deployment record (stored in deployment history) */
export interface DeploymentRecord {
  id: string;
  /** Target environment */
  target: DeployTarget;
  /** Deployer user ID */
  deployedBy: string;
  /** Approver user ID (for production) */
  approvedBy?: string;
  /** Timestamp */
  deployedAt: string;
  /** Version/hash of the world project at time of deploy */
  worldVersion: string;
  /** Deployment diff */
  diff: DeploymentDiff;
  /** Status */
  status: "pending" | "deploying" | "success" | "failed" | "rolled-back";
  /** Error message if failed */
  error?: string;
  /** Number of manifest files pushed */
  manifestCount?: number;
}

/** Deployment pipeline state */
export interface DeploymentState {
  /** Current staging deployment status */
  stagingStatus:
    | "idle"
    | "compiling"
    | "pushing"
    | "reloading"
    | "success"
    | "error";
  /** Current production deployment status */
  productionStatus:
    | "idle"
    | "pending-approval"
    | "deploying"
    | "success"
    | "error";
  /** Computed diff (staging vs production) */
  currentDiff: DeploymentDiff | null;
  /** Is diff computation in progress */
  isComputingDiff: boolean;
  /** Deployment history */
  history: DeploymentRecord[];
  /** Last error */
  error: string | null;
  /** Pending production promotion (awaiting approval) */
  pendingPromotion: {
    id: string;
    requestedBy: string;
    requestedAt: string;
    diff: DeploymentDiff;
  } | null;
}

export const EMPTY_DEPLOYMENT_STATE: DeploymentState = {
  stagingStatus: "idle",
  productionStatus: "idle",
  currentDiff: null,
  isComputingDiff: false,
  history: [],
  error: null,
  pendingPromotion: null,
};

export const EMPTY_MANIFEST_DATA: ManifestData = {
  npcs: [],
  stations: [],
  miningRocks: [],
  trees: [],
  fishingSpots: [],
  items: [],
  quests: [],
  stores: [],
  combatSpells: [],
  prayers: [],
  runes: [],
  elementalStaves: [],
  ammunition: [],
  ammunitionBowTiers: {},
  recipes: [],
  skillUnlocks: [],
  tierRequirements: [],
  duelArenas: [],
  lodSettings: null,
  rawManifests: {},
  loaded: false,
  loading: false,
  error: null,
};

// ============== MANIFEST OVERRIDE TYPES ==============

/** Sparse delta — only set fields override base manifest */
export interface NPCManifestOverride {
  entityId: string;
  identity?: {
    name?: string;
    description?: string;
    category?: string;
    faction?: string;
    levelRange?: [number, number];
  };
  stats?: {
    level?: number;
    health?: number;
    attack?: number;
    strength?: number;
    defense?: number;
    defenseBonus?: number;
    ranged?: number;
    magic?: number;
  };
  combat?: {
    attackable?: boolean;
    aggressive?: boolean;
    retaliates?: boolean;
    aggroRange?: number;
    combatRange?: number;
    leashRange?: number;
    attackSpeedTicks?: number;
    respawnTicks?: number;
  };
  movement?: { type?: string; speed?: number; wanderRadius?: number };
  appearance?: { modelPath?: string; scale?: number };
  drops?: {
    [tier: string]: Array<{
      itemId: string;
      quantity?: number;
      minQuantity?: number;
      maxQuantity?: number;
      chance?: number;
    }>;
  };
  dialogue?: {
    entryNodeId: string;
    questOverrides?: Record<
      string,
      { in_progress?: string; ready_to_complete?: string; completed?: string }
    >;
    nodes: Array<{
      id: string;
      text: string;
      responses?: Array<{
        text: string;
        nextNodeId?: string;
        condition?: string;
        effect?: string;
      }>;
      effect?: string;
    }>;
  };
  /** Visual script graph for entity behavior triggers */
  behaviorGraph?: import("../../scripting/types").ScriptGraph;
}

export interface StationManifestOverride {
  entityId: string;
  name?: string;
  examine?: string;
  modelScale?: number;
  modelYOffset?: number;
  flattenGround?: boolean;
  flattenPadding?: number;
  flattenBlendRadius?: number;
  /** Visual script graph for entity behavior triggers */
  behaviorGraph?: import("../../scripting/types").ScriptGraph;
}

export interface ResourceManifestOverride {
  entityId: string;
  resourceType: "mining" | "woodcutting" | "fishing";
  identity?: { name?: string; examine?: string };
  gathering?: {
    levelRequired?: number;
    baseCycleTicks?: number;
    depleteChance?: number;
    respawnTicks?: number;
    toolRequired?: string;
  };
  model?: { scale?: number };
  /** Visual script graph for entity behavior triggers */
  behaviorGraph?: import("../../scripting/types").ScriptGraph;
}

export interface MobSpawnManifestOverride {
  entityId: string;
  spawnRadius?: number;
  maxCount?: number;
  /** Visual script graph for entity behavior triggers */
  behaviorGraph?: import("../../scripting/types").ScriptGraph;
}

export interface StoreManifestOverride {
  entityId: string;
  name?: string;
  description?: string;
  buyback?: boolean;
  buybackRate?: number;
  itemOverrides?: Record<string, { price?: number; stockQuantity?: number }>;
  /** Added items not in the base manifest */
  addedItems?: Array<{
    itemId: string;
    name: string;
    price: number;
    stockQuantity: number;
  }>;
  /** Visual script graph for entity behavior triggers */
  behaviorGraph?: import("../../scripting/types").ScriptGraph;
}

export interface ManifestOverrides {
  npcOverrides: Map<string, NPCManifestOverride>;
  stationOverrides: Map<string, StationManifestOverride>;
  resourceOverrides: Map<string, ResourceManifestOverride>;
  mobSpawnOverrides: Map<string, MobSpawnManifestOverride>;
  storeOverrides: Map<string, StoreManifestOverride>;
}

export interface SerializedManifestOverrides {
  npcOverrides: Record<string, NPCManifestOverride>;
  stationOverrides: Record<string, StationManifestOverride>;
  resourceOverrides: Record<string, ResourceManifestOverride>;
  mobSpawnOverrides: Record<string, MobSpawnManifestOverride>;
  storeOverrides: Record<string, StoreManifestOverride>;
}

export const EMPTY_MANIFEST_OVERRIDES: ManifestOverrides = {
  npcOverrides: new Map(),
  stationOverrides: new Map(),
  resourceOverrides: new Map(),
  mobSpawnOverrides: new Map(),
  storeOverrides: new Map(),
};

export function serializeManifestOverrides(
  o: ManifestOverrides,
): SerializedManifestOverrides {
  return {
    npcOverrides: Object.fromEntries(o.npcOverrides),
    stationOverrides: Object.fromEntries(o.stationOverrides),
    resourceOverrides: Object.fromEntries(o.resourceOverrides),
    mobSpawnOverrides: Object.fromEntries(o.mobSpawnOverrides),
    storeOverrides: Object.fromEntries(o.storeOverrides),
  };
}

export function deserializeManifestOverrides(
  d: SerializedManifestOverrides,
): ManifestOverrides {
  return {
    npcOverrides: new Map(Object.entries(d.npcOverrides ?? {})),
    stationOverrides: new Map(Object.entries(d.stationOverrides ?? {})),
    resourceOverrides: new Map(Object.entries(d.resourceOverrides ?? {})),
    mobSpawnOverrides: new Map(Object.entries(d.mobSpawnOverrides ?? {})),
    storeOverrides: new Map(Object.entries(d.storeOverrides ?? {})),
  };
}
