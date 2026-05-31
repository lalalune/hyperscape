/**
 * World persistence: serialization, import/export, validation, and generation utilities.
 */

import type {
  WorldData,
  WorldFoundation,
  WorldCreationConfig,
  TownLandmarkConfig,
  GeneratedBiome,
  GeneratedTown,
  GeneratedBuilding,
  GeneratedRoad,
  BiomeOverride,
  TownOverride,
  PlacedNPC,
  PlacedQuest,
  PlacedBoss,
  PlacedEvent,
  PlacedLore,
  DifficultyZone,
  CustomPlacement,
  WildernessZone,
  WorldPosition,
  GeneratedBossConfig,
  BossArchetype,
  BossAbility,
  PBRTexturePack,
  TexturePackAssignment,
} from "../types";

// Serialized format (JSON-safe, Maps converted to Records)
interface SerializedWorldData {
  id: string;
  name: string;
  description: string;
  version: number;
  createdAt: number;
  modifiedAt: number;
  foundationLocked: boolean;
  foundation: SerializedWorldFoundation;
  layers: SerializedWorldLayers;
}

interface SerializedWorldFoundation {
  version: number;
  createdAt: number;
  config: WorldCreationConfig;
  biomes: GeneratedBiome[];
  towns: GeneratedTown[];
  buildings: GeneratedBuilding[];
  roads: GeneratedRoad[];
}

interface SerializedWorldLayers {
  biomeOverrides: Record<string, BiomeOverride>;
  townOverrides: Record<string, TownOverride>;
  texturePacks: Record<string, PBRTexturePack>;
  textureAssignments: TexturePackAssignment[];
  npcs: PlacedNPC[];
  quests: PlacedQuest[];
  bosses: PlacedBoss[];
  events: PlacedEvent[];
  lore: PlacedLore[];
  difficultyZones: DifficultyZone[];
  customPlacements: CustomPlacement[];
}

export function serializeWorld(world: WorldData): SerializedWorldData {
  const layers = world.layers;

  return {
    id: world.id,
    name: world.name,
    description: world.description,
    version: world.version,
    createdAt: world.createdAt,
    modifiedAt: world.modifiedAt,
    foundationLocked: world.foundationLocked,
    foundation: {
      version: world.foundation.version,
      createdAt: world.foundation.createdAt,
      config: world.foundation.config,
      biomes: world.foundation.biomes,
      towns: world.foundation.towns,
      buildings: world.foundation.buildings,
      roads: world.foundation.roads,
    },
    layers: {
      biomeOverrides: Object.fromEntries(layers.biomeOverrides ?? new Map()),
      townOverrides: Object.fromEntries(layers.townOverrides ?? new Map()),
      texturePacks: Object.fromEntries(layers.texturePacks ?? new Map()),
      textureAssignments: layers.textureAssignments ?? [],
      npcs: layers.npcs ?? [],
      quests: layers.quests ?? [],
      bosses: layers.bosses ?? [],
      events: layers.events ?? [],
      lore: layers.lore ?? [],
      difficultyZones: layers.difficultyZones ?? [],
      customPlacements: layers.customPlacements ?? [],
    },
  };
}

export function deserializeWorld(data: SerializedWorldData): WorldData {
  return {
    id: data.id,
    name: data.name,
    description: data.description,
    version: data.version,
    createdAt: data.createdAt,
    modifiedAt: data.modifiedAt,
    foundationLocked: data.foundationLocked,
    foundation: {
      version: data.foundation.version,
      createdAt: data.foundation.createdAt,
      config: data.foundation.config,
      biomes: data.foundation.biomes,
      towns: data.foundation.towns,
      buildings: data.foundation.buildings,
      roads: data.foundation.roads,
      heightmapCache: new Map(),
    },
    layers: {
      biomeOverrides: new Map(Object.entries(data.layers.biomeOverrides || {})),
      townOverrides: new Map(Object.entries(data.layers.townOverrides || {})),
      texturePacks: new Map(Object.entries(data.layers.texturePacks || {})),
      textureAssignments: data.layers.textureAssignments || [],
      npcs: data.layers.npcs || [],
      quests: data.layers.quests || [],
      bosses: data.layers.bosses || [],
      events: data.layers.events || [],
      lore: data.layers.lore || [],
      difficultyZones: data.layers.difficultyZones || [],
      customPlacements: data.layers.customPlacements || [],
    },
  };
}

export function exportWorldToJSON(
  world: WorldData,
  prettyPrint = true,
): string {
  const serialized = serializeWorld(world);
  return JSON.stringify(serialized, null, prettyPrint ? 2 : 0);
}

/** @throws Error on invalid JSON or structure */
export function importWorldFromJSON(json: string): WorldData {
  const parsed: unknown = JSON.parse(json);

  if (!parsed || typeof parsed !== "object") {
    throw new Error("Invalid world data: expected object");
  }

  const data = parsed as Record<string, unknown>;
  if (typeof data.id !== "string" || typeof data.name !== "string") {
    throw new Error("Invalid world data: missing id or name");
  }

  const migrated = migrateWorldData(parsed as unknown as SerializedWorldData);
  if (!validateWorldData(migrated)) {
    throw new Error("Invalid world data after migration");
  }

  return deserializeWorld(migrated);
}

export function downloadWorldAsFile(world: WorldData): void {
  const json = exportWorldToJSON(world);
  const blob = new Blob([json], { type: "application/json" });
  const url = URL.createObjectURL(blob);

  const filename = `${world.name.toLowerCase().replace(/\s+/g, "-")}-${world.id.substring(0, 8)}.json`;

  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export async function importWorldFromFile(file: File): Promise<WorldData> {
  if (!file.name.endsWith(".json") && !file.name.endsWith(".world")) {
    throw new Error(
      `Invalid file type: expected .json or .world, got "${file.name}"`,
    );
  }

  const json = await file.text();
  return importWorldFromJSON(json);
}

/** Type guard for SerializedWorldData */
export function validateWorldData(data: unknown): data is SerializedWorldData {
  if (!data || typeof data !== "object") return false;
  const w = data as Partial<SerializedWorldData>;

  // Top-level
  if (typeof w.id !== "string" || typeof w.name !== "string") return false;
  if (typeof w.version !== "number" || typeof w.createdAt !== "number")
    return false;
  if (
    typeof w.modifiedAt !== "number" ||
    typeof w.foundationLocked !== "boolean"
  )
    return false;
  if (!w.foundation || typeof w.foundation !== "object") return false;
  if (!w.layers || typeof w.layers !== "object") return false;

  // Foundation
  const f = w.foundation as Partial<SerializedWorldFoundation>;
  if (typeof f.version !== "number" || typeof f.createdAt !== "number")
    return false;
  if (!f.config || typeof f.config !== "object") return false;
  if (!Array.isArray(f.biomes) || !Array.isArray(f.towns)) return false;
  if (!Array.isArray(f.buildings) || !Array.isArray(f.roads)) return false;

  // Layers
  const l = w.layers as Partial<SerializedWorldLayers>;
  const arrays = [
    l.npcs,
    l.quests,
    l.bosses,
    l.events,
    l.lore,
    l.difficultyZones,
    l.customPlacements,
  ];
  if (!arrays.every(Array.isArray)) return false;
  if (!l.biomeOverrides || typeof l.biomeOverrides !== "object") return false;
  if (!l.townOverrides || typeof l.townOverrides !== "object") return false;
  if (l.texturePacks && typeof l.texturePacks !== "object") return false;
  if (l.textureAssignments && !Array.isArray(l.textureAssignments))
    return false;

  return true;
}

/** Migrate old world data to current schema */
export function migrateWorldData(
  data: SerializedWorldData,
): SerializedWorldData {
  const migrated: SerializedWorldData = { ...data };
  const now = Date.now();

  migrated.description = data.description ?? "";
  migrated.version = data.version ?? 0;
  migrated.createdAt = data.createdAt ?? now;
  migrated.modifiedAt = data.modifiedAt ?? now;
  migrated.foundationLocked = data.foundationLocked ?? false;

  if (data.foundation) {
    migrated.foundation = {
      version: data.foundation.version ?? 1,
      createdAt: data.foundation.createdAt ?? now,
      config: data.foundation.config,
      biomes: data.foundation.biomes ?? [],
      towns: data.foundation.towns ?? [],
      buildings: data.foundation.buildings ?? [],
      roads: data.foundation.roads ?? [],
    };
  }

  migrated.layers = {
    biomeOverrides: data.layers?.biomeOverrides ?? {},
    townOverrides: data.layers?.townOverrides ?? {},
    texturePacks: data.layers?.texturePacks ?? {},
    textureAssignments: data.layers?.textureAssignments ?? [],
    npcs: data.layers?.npcs ?? [],
    quests: data.layers?.quests ?? [],
    bosses: data.layers?.bosses ?? [],
    events: data.layers?.events ?? [],
    lore: data.layers?.lore ?? [],
    difficultyZones: data.layers?.difficultyZones ?? [],
    customPlacements: data.layers?.customPlacements ?? [],
  };

  if (migrated.version < 1) migrated.version = 1;

  return migrated;
}

export function generateWorldId(): string {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).substring(2, 11);
  return `world-${timestamp}-${random}`;
}

export function generateWorldName(seed: number): string {
  const adjectives = [
    "Verdant",
    "Ancient",
    "Mystic",
    "Wild",
    "Eternal",
    "Hidden",
    "Lost",
    "Brave",
  ];
  const nouns = [
    "Realm",
    "Lands",
    "Kingdom",
    "Vale",
    "Shores",
    "Peaks",
    "Forest",
    "Wilds",
  ];

  const adjIndex = seed % adjectives.length;
  const nounIndex = Math.floor(seed / adjectives.length) % nouns.length;

  return `${adjectives[adjIndex]} ${nouns[nounIndex]}`;
}

export function createNewWorld(
  foundation: WorldFoundation,
  name?: string,
  description?: string,
): WorldData {
  const worldId = generateWorldId();
  const worldName = name || generateWorldName(foundation.config.seed);

  return {
    id: worldId,
    name: worldName,
    description:
      description || `Generated world with seed ${foundation.config.seed}`,
    version: 1,
    createdAt: Date.now(),
    modifiedAt: Date.now(),
    foundationLocked: true,
    foundation,
    layers: {
      biomeOverrides: new Map(),
      townOverrides: new Map(),
      texturePacks: new Map(),
      textureAssignments: [],
      npcs: [],
      quests: [],
      bosses: [],
      events: [],
      lore: [],
      difficultyZones: [],
      customPlacements: [],
    },
  };
}

export function calculateWorldStats(world: WorldData): {
  totalTiles: number;
  totalBiomes: number;
  totalTowns: number;
  totalBuildings: number;
  totalRoads: number;
  totalNPCs: number;
  totalQuests: number;
  totalBosses: number;
  totalEvents: number;
  worldSizeKm: number;
  hasOverrides: boolean;
} {
  const config = world.foundation.config;
  const worldSizeMeters = config.terrain.worldSize * config.terrain.tileSize;

  return {
    totalTiles: config.terrain.worldSize * config.terrain.worldSize,
    totalBiomes: world.foundation.biomes.length,
    totalTowns: world.foundation.towns.length,
    totalBuildings: world.foundation.buildings.length,
    totalRoads: world.foundation.roads.length,
    totalNPCs: world.layers.npcs.length,
    totalQuests: world.layers.quests.length,
    totalBosses: world.layers.bosses.length,
    totalEvents: world.layers.events.length,
    worldSizeKm: worldSizeMeters / 1000,
    hasOverrides:
      world.layers.biomeOverrides.size > 0 ||
      world.layers.townOverrides.size > 0,
  };
}

// Game manifest types (matches TownSystem/DataManager expectations)
interface GameManifestTown {
  id: string;
  name: string;
  position: { x: number; y: number; z: number };
  size: "sm" | "md" | "lg";
  keep: boolean;
  safeZoneRadius: number;
  buildings: GameManifestBuilding[];
}

interface GameManifestBuilding {
  id: string;
  type: string;
  position: { x: number; y: number; z: number };
  rotation: number;
  size: { width: number; depth: number };
}

interface GameManifestBuildingType {
  label: string;
  widthRange: [number, number];
  depthRange: [number, number];
  floors: number;
  hasBasement: boolean;
  props?: string[];
}

interface GameManifestSizeDefinition {
  label: string;
  minBuildings: number;
  maxBuildings: number;
  radius: number;
  safeZoneRadius: number;
}

interface GameBuildingsManifest {
  version: number;
  towns: GameManifestTown[];
  buildingTypes: Record<string, GameManifestBuildingType>;
  sizeDefinitions: Record<"sm" | "md" | "lg", GameManifestSizeDefinition>;
}

interface GameWorldConfigManifest {
  terrain: {
    seed: number;
    worldSize: number;
    tileSize: number;
    tileResolution: number;
  };
  towns: {
    townCount: number;
    minTownSpacing: number;
    waterThreshold: number;
    landmarks: TownLandmarkConfig;
  };
}

export function exportToGameManifest(world: WorldData): {
  buildingsManifest: GameBuildingsManifest;
  worldConfig: GameWorldConfigManifest;
} {
  const config = world.foundation.config;

  // Map WorldBuilder town size to game manifest size
  const townSizeToManifestSize = (size: string): "sm" | "md" | "lg" => {
    switch (size) {
      case "hamlet":
        return "sm";
      case "village":
        return "md";
      case "town":
        return "lg";
      default:
        return "md";
    }
  };

  // Build town data with buildings
  const towns: GameManifestTown[] = world.foundation.towns.map((town) => {
    // Find buildings belonging to this town
    const townBuildings = world.foundation.buildings
      .filter((b) => b.townId === town.id)
      .map(
        (building): GameManifestBuilding => ({
          id: building.id,
          type: building.type,
          // Position relative to town center for manifest format
          position: {
            x: building.position.x - town.position.x,
            y: building.position.y - town.position.y,
            z: building.position.z - town.position.z,
          },
          rotation: building.rotation,
          size: {
            width: building.dimensions.width,
            depth: building.dimensions.depth,
          },
        }),
      );

    // Calculate safe zone radius based on town size
    const safeZoneRadius =
      town.size === "hamlet" ? 40 : town.size === "village" ? 60 : 80;

    return {
      id: town.id,
      name: town.name,
      position: {
        x: town.position.x,
        y: town.position.y,
        z: town.position.z,
      },
      size: townSizeToManifestSize(town.size),
      keep: true, // All exported towns should be kept
      safeZoneRadius,
      buildings: townBuildings,
    };
  });

  // Standard building type definitions
  const buildingTypes: Record<string, GameManifestBuildingType> = {
    bank: {
      label: "Bank",
      widthRange: [8, 8],
      depthRange: [6, 6],
      floors: 1,
      hasBasement: true,
      props: ["banker"],
    },
    store: {
      label: "General Store",
      widthRange: [7, 7],
      depthRange: [5, 5],
      floors: 1,
      hasBasement: false,
      props: ["shopkeeper"],
    },
    inn: {
      label: "Inn",
      widthRange: [10, 10],
      depthRange: [12, 12],
      floors: 2,
      hasBasement: false,
      props: ["innkeeper"],
    },
    smithy: {
      label: "Smithy",
      widthRange: [7, 7],
      depthRange: [7, 7],
      floors: 1,
      hasBasement: false,
      props: ["blacksmith", "anvil"],
    },
    house: {
      label: "House",
      widthRange: [6, 6],
      depthRange: [5, 5],
      floors: 1,
      hasBasement: false,
    },
    "simple-house": {
      label: "Simple House",
      widthRange: [6, 6],
      depthRange: [6, 6],
      floors: 1,
      hasBasement: false,
    },
    "long-house": {
      label: "Long House",
      widthRange: [5, 5],
      depthRange: [12, 12],
      floors: 1,
      hasBasement: false,
    },
    well: {
      label: "Well",
      widthRange: [3, 3],
      depthRange: [3, 3],
      floors: 0,
      hasBasement: false,
    },
    anvil: {
      label: "Anvil",
      widthRange: [2, 2],
      depthRange: [2, 2],
      floors: 0,
      hasBasement: false,
    },
  };

  // Size definitions matching game expectations
  const sizeDefinitions: Record<
    "sm" | "md" | "lg",
    GameManifestSizeDefinition
  > = {
    sm: {
      label: "Hamlet",
      minBuildings: 3,
      maxBuildings: 5,
      radius: 25,
      safeZoneRadius: 40,
    },
    md: {
      label: "Village",
      minBuildings: 6,
      maxBuildings: 10,
      radius: 40,
      safeZoneRadius: 60,
    },
    lg: {
      label: "Town",
      minBuildings: 11,
      maxBuildings: 16,
      radius: 60,
      safeZoneRadius: 80,
    },
  };

  const buildingsManifest: GameBuildingsManifest = {
    version: 1,
    towns,
    buildingTypes,
    sizeDefinitions,
  };

  const worldConfig: GameWorldConfigManifest = {
    terrain: {
      seed: config.seed,
      worldSize: config.terrain.worldSize * config.terrain.tileSize, // Convert to meters
      tileSize: config.terrain.tileSize,
      tileResolution: config.terrain.tileResolution,
    },
    towns: {
      townCount: config.towns.townCount,
      minTownSpacing: config.towns.minTownSpacing,
      waterThreshold: config.shoreline.waterLevelNormalized,
      landmarks: config.towns.landmarks,
    },
  };

  return { buildingsManifest, worldConfig };
}

/** Export validation error */
export interface ExportValidationError {
  field: string;
  message: string;
  severity: "error" | "warning";
}

/** Export validation result */
export interface ExportValidationResult {
  valid: boolean;
  errors: ExportValidationError[];
  warnings: ExportValidationError[];
  stats: {
    townCount: number;
    buildingCount: number;
    orphanedBuildings: number;
    emptyTowns: number;
    worldSizeMeters: number;
  };
}

export function validateGameExport(world: WorldData): ExportValidationResult {
  const errors: ExportValidationError[] = [];
  const warnings: ExportValidationError[] = [];

  const config = world.foundation.config;
  const towns = world.foundation.towns;
  const buildings = world.foundation.buildings;

  // Basic validation
  if (!world.id) {
    errors.push({ field: "id", message: "World has no ID", severity: "error" });
  }

  if (!world.name || world.name.trim() === "") {
    errors.push({
      field: "name",
      message: "World has no name",
      severity: "error",
    });
  }

  // Config validation
  if (config.terrain.worldSize < 10) {
    errors.push({
      field: "terrain.worldSize",
      message: "World size must be at least 10 tiles",
      severity: "error",
    });
  }

  if (config.terrain.worldSize > 1000) {
    warnings.push({
      field: "terrain.worldSize",
      message: "World size over 1000 tiles may cause performance issues",
      severity: "warning",
    });
  }

  if (config.seed === 0) {
    warnings.push({
      field: "seed",
      message: "Seed is 0, terrain may be uniform",
      severity: "warning",
    });
  }

  // Town validation
  if (towns.length === 0) {
    warnings.push({
      field: "towns",
      message: "World has no towns - players may have nowhere to spawn",
      severity: "warning",
    });
  }

  const townIds = new Set(towns.map((t) => t.id));
  const townNames = new Map<string, number>();

  for (const town of towns) {
    // Check for valid position
    if (
      isNaN(town.position.x) ||
      isNaN(town.position.y) ||
      isNaN(town.position.z)
    ) {
      errors.push({
        field: `town.${town.id}.position`,
        message: `Town "${town.name}" has invalid position`,
        severity: "error",
      });
    }

    // Check for duplicate names
    const nameCount = townNames.get(town.name) || 0;
    townNames.set(town.name, nameCount + 1);

    // Check for valid size
    if (!["hamlet", "village", "town"].includes(town.size)) {
      warnings.push({
        field: `town.${town.id}.size`,
        message: `Town "${town.name}" has unknown size "${town.size}"`,
        severity: "warning",
      });
    }

    // Check town spacing
    for (const otherTown of towns) {
      if (otherTown.id === town.id) continue;
      const dist = Math.sqrt(
        (town.position.x - otherTown.position.x) ** 2 +
          (town.position.z - otherTown.position.z) ** 2,
      );
      if (dist < 100) {
        warnings.push({
          field: `town.${town.id}.spacing`,
          message: `Towns "${town.name}" and "${otherTown.name}" are very close (${dist.toFixed(0)}m apart)`,
          severity: "warning",
        });
      }
    }
  }

  // Check for duplicate town names
  for (const [name, count] of townNames) {
    if (count > 1) {
      warnings.push({
        field: "towns.names",
        message: `Duplicate town name: "${name}" appears ${count} times`,
        severity: "warning",
      });
    }
  }

  // Building validation
  let orphanedBuildings = 0;
  const buildingsPerTown = new Map<string, number>();

  for (const building of buildings) {
    // Check for valid position
    if (
      isNaN(building.position.x) ||
      isNaN(building.position.y) ||
      isNaN(building.position.z)
    ) {
      errors.push({
        field: `building.${building.id}.position`,
        message: `Building "${building.name}" has invalid position`,
        severity: "error",
      });
    }

    // Check for valid dimensions
    if (building.dimensions.width <= 0 || building.dimensions.depth <= 0) {
      errors.push({
        field: `building.${building.id}.dimensions`,
        message: `Building "${building.name}" has invalid dimensions`,
        severity: "error",
      });
    }

    // Check for orphaned buildings
    if (!townIds.has(building.townId)) {
      orphanedBuildings++;
      warnings.push({
        field: `building.${building.id}.townId`,
        message: `Building "${building.name}" references non-existent town "${building.townId}"`,
        severity: "warning",
      });
    } else {
      const count = buildingsPerTown.get(building.townId) || 0;
      buildingsPerTown.set(building.townId, count + 1);
    }

    // Check for valid building type
    const validTypes = [
      "bank",
      "store",
      "inn",
      "smithy",
      "house",
      "simple-house",
      "long-house",
      "well",
      "anvil",
    ];
    if (!validTypes.includes(building.type)) {
      warnings.push({
        field: `building.${building.id}.type`,
        message: `Building "${building.name}" has custom type "${building.type}" - ensure it's defined in buildingTypes`,
        severity: "warning",
      });
    }
  }

  // Check for empty towns
  let emptyTowns = 0;
  for (const town of towns) {
    const buildingCount = buildingsPerTown.get(town.id) || 0;
    if (buildingCount === 0) {
      emptyTowns++;
      warnings.push({
        field: `town.${town.id}.buildings`,
        message: `Town "${town.name}" has no buildings`,
        severity: "warning",
      });
    }
  }

  // Check world bounds
  const worldSizeMeters = config.terrain.worldSize * config.terrain.tileSize;
  const halfWorld = worldSizeMeters / 2;

  for (const town of towns) {
    // Check if town is within world bounds (assuming centered origin)
    if (
      Math.abs(town.position.x) > halfWorld ||
      Math.abs(town.position.z) > halfWorld
    ) {
      warnings.push({
        field: `town.${town.id}.position`,
        message: `Town "${town.name}" may be outside world bounds`,
        severity: "warning",
      });
    }
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
    stats: {
      townCount: towns.length,
      buildingCount: buildings.length,
      orphanedBuildings,
      emptyTowns,
      worldSizeMeters,
    },
  };
}

export function downloadGameManifests(
  world: WorldData,
  namePrefix?: string,
): void {
  const { buildingsManifest, worldConfig } = exportToGameManifest(world);
  const prefix = namePrefix || world.name.toLowerCase().replace(/\s+/g, "-");

  // Download buildings.json
  const buildingsBlob = new Blob([JSON.stringify(buildingsManifest, null, 2)], {
    type: "application/json",
  });
  const buildingsUrl = URL.createObjectURL(buildingsBlob);
  const buildingsLink = document.createElement("a");
  buildingsLink.href = buildingsUrl;
  buildingsLink.download = `${prefix}-buildings.json`;
  buildingsLink.click();
  URL.revokeObjectURL(buildingsUrl);

  // Download world-config.json
  const configBlob = new Blob([JSON.stringify(worldConfig, null, 2)], {
    type: "application/json",
  });
  const configUrl = URL.createObjectURL(configBlob);
  const configLink = document.createElement("a");
  configLink.href = configUrl;
  configLink.download = `${prefix}-world-config.json`;
  configLink.click();
  URL.revokeObjectURL(configUrl);
}

export function copyGameManifestsToClipboard(world: WorldData): Promise<void> {
  const { buildingsManifest, worldConfig } = exportToGameManifest(world);

  const combined = {
    buildingsManifest,
    worldConfig,
    exportedAt: new Date().toISOString(),
    worldName: world.name,
    worldId: world.id,
  };

  return navigator.clipboard.writeText(JSON.stringify(combined, null, 2));
}

export interface FullGameManifest {
  version: number;
  worldId: string;
  worldName: string;
  exportedAt: number;

  // Core manifests
  buildings: GameBuildingsManifest;
  worldConfig: GameWorldConfigManifest;

  // Content manifests
  npcs: NPCManifest;
  mobs: MobManifest;
  bosses: BossManifest;
  quests: QuestManifest;

  // Zone manifests
  difficultyZones: DifficultyZoneManifest;
  wilderness: WildernessManifest;
  biomes: BiomeManifest;
}

interface NPCManifest {
  version: number;
  npcs: Array<{
    id: string;
    name: string;
    npcTypeId: string;
    position: WorldPosition;
    townId?: string;
    buildingId?: string;
    dialogId?: string;
    storeId?: string;
  }>;
}

interface MobManifest {
  version: number;
  spawnConfigs: Array<{
    biomeId: string;
    enabled: boolean;
    spawnRate: number;
    maxPerChunk: number;
    spawnTable: Array<{
      mobTypeId: string;
      weight: number;
      levelRange: [number, number];
      groupSize: [number, number];
    }>;
    bounds: {
      minX: number;
      maxX: number;
      minZ: number;
      maxZ: number;
    };
  }>;
}

interface BossManifest {
  version: number;
  bosses: Array<{
    id: string;
    name: string;
    templateId: string;
    position: WorldPosition;
    arenaBounds: {
      minX: number;
      maxX: number;
      minZ: number;
      maxZ: number;
    };
    respawnTime: number;
    requiredLevel: number;
    lootTableId: string;
    isGenerated: boolean;
    generatedConfig?: GeneratedBossConfig;
  }>;
}

interface QuestManifest {
  version: number;
  quests: Array<{
    id: string;
    name: string;
    templateId: string;
    questGiverNpcId: string;
    turnInNpcId: string;
    requiredLevel: number;
    locations: Array<{
      type: string;
      id?: string;
      position?: WorldPosition;
      description: string;
    }>;
  }>;
}

interface DifficultyZoneManifest {
  version: number;
  zones: Array<{
    id: string;
    name: string;
    difficultyLevel: number;
    isSafeZone: boolean;
    bounds: {
      minX: number;
      maxX: number;
      minZ: number;
      maxZ: number;
    };
    center?: WorldPosition;
    linkedTownId?: string;
    mobLevelRange: [number, number];
  }>;
}

interface WildernessManifest {
  version: number;
  enabled: boolean;
  zone?: WildernessZone;
}

interface BiomeManifest {
  version: number;
  biomes: Array<{
    id: string;
    type: string;
    center: WorldPosition;
    influenceRadius: number;
    tileCount: number;
    materialConfig?: {
      baseTextureId: string;
      secondaryTextureId?: string;
      blendMode: string;
      roughness: number;
      colorTint: string;
      uvScale: number;
    };
    heightConfig?: {
      minHeight: number;
      maxHeight: number;
      variance: number;
      smoothness: number;
    };
  }>;
}

export function exportFullGameManifest(world: WorldData): FullGameManifest {
  const { buildingsManifest, worldConfig } = exportToGameManifest(world);
  const mobSpawns = generateMobSpawns(world);

  // NPCs manifest
  const npcManifest: NPCManifest = {
    version: 1,
    npcs: world.layers.npcs.map((npc) => ({
      id: npc.id,
      name: npc.name,
      npcTypeId: npc.npcTypeId,
      position: npc.position,
      townId:
        npc.parentContext.type === "town"
          ? npc.parentContext.townId
          : undefined,
      buildingId:
        npc.parentContext.type === "building"
          ? npc.parentContext.buildingId
          : undefined,
      dialogId: npc.dialogId,
      storeId: npc.storeId,
    })),
  };

  // Mobs manifest (from spawn configs)
  const mobManifest: MobManifest = {
    version: 1,
    spawnConfigs: mobSpawns.spawns.map((spawn) => ({
      biomeId: spawn.biomeId,
      enabled: spawn.enabled,
      spawnRate: spawn.spawnRate,
      maxPerChunk: spawn.maxPerChunk,
      spawnTable: spawn.spawnTable,
      bounds: spawn.bounds,
    })),
  };

  // Bosses manifest
  const bossManifest: BossManifest = {
    version: 1,
    bosses: world.layers.bosses.map((boss) => ({
      id: boss.id,
      name: boss.name,
      templateId: boss.bossTemplateId,
      position: boss.position,
      arenaBounds: boss.arenaBounds,
      respawnTime: boss.respawnTime,
      requiredLevel: boss.requiredLevel,
      lootTableId: boss.lootTableId,
      isGenerated: boss.isGenerated,
      generatedConfig: boss.generatedConfig,
    })),
  };

  // Quests manifest
  const questManifest: QuestManifest = {
    version: 1,
    quests: world.layers.quests.map((quest) => ({
      id: quest.id,
      name: quest.name,
      templateId: quest.questTemplateId,
      questGiverNpcId: quest.questGiverNpcId,
      turnInNpcId: quest.turnInNpcId,
      requiredLevel: quest.requiredLevel,
      locations: quest.locations,
    })),
  };

  // Difficulty zones manifest
  const difficultyManifest: DifficultyZoneManifest = {
    version: 1,
    zones: world.layers.difficultyZones.map((zone) => ({
      id: zone.id,
      name: zone.name,
      difficultyLevel: zone.difficultyLevel,
      isSafeZone: zone.isSafeZone,
      bounds: zone.bounds,
      center: zone.center,
      linkedTownId: zone.linkedTownId,
      mobLevelRange: zone.mobLevelRange,
    })),
  };

  // Wilderness manifest
  const wildernessManifest: WildernessManifest = {
    version: 1,
    enabled: true,
    zone: {
      id: "wilderness-main",
      name: "The Wilderness",
      direction: "north",
      startBoundary: 0.3,
      multiCombat: true,
      baseLevelAtBoundary: 1,
      levelPerHundredMeters: 1,
    },
  };

  // Biomes manifest
  const biomeManifest: BiomeManifest = {
    version: 1,
    biomes: world.foundation.biomes.map((biome) => {
      const override = world.layers.biomeOverrides.get(biome.id);
      return {
        id: biome.id,
        type: override?.typeOverride || biome.type,
        center: biome.center,
        influenceRadius: biome.influenceRadius,
        tileCount: biome.tileKeys.length,
        materialConfig: override?.materialOverride
          ? {
              baseTextureId: override.materialOverride.baseTextureId,
              secondaryTextureId: override.materialOverride.secondaryTextureId,
              blendMode: override.materialOverride.blendMode,
              roughness: override.materialOverride.roughness,
              colorTint: override.materialOverride.colorTint,
              uvScale: override.materialOverride.uvScale,
            }
          : undefined,
        heightConfig: override?.heightOverride,
      };
    }),
  };

  return {
    version: 1,
    worldId: world.id,
    worldName: world.name,
    exportedAt: Date.now(),
    buildings: buildingsManifest,
    worldConfig,
    npcs: npcManifest,
    mobs: mobManifest,
    bosses: bossManifest,
    quests: questManifest,
    difficultyZones: difficultyManifest,
    wilderness: wildernessManifest,
    biomes: biomeManifest,
  };
}

export function downloadAllGameManifests(
  world: WorldData,
  namePrefix?: string,
): void {
  const manifest = exportFullGameManifest(world);
  const prefix = namePrefix || world.name.toLowerCase().replace(/\s+/g, "-");

  const downloadJson = (data: object, filename: string) => {
    const blob = new Blob([JSON.stringify(data, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    link.click();
    URL.revokeObjectURL(url);
  };

  // Download each manifest
  downloadJson(manifest.buildings, `${prefix}-buildings.json`);
  downloadJson(manifest.worldConfig, `${prefix}-world-config.json`);
  downloadJson(manifest.npcs, `${prefix}-npcs.json`);
  downloadJson(manifest.mobs, `${prefix}-mobs.json`);
  downloadJson(manifest.bosses, `${prefix}-bosses.json`);
  downloadJson(manifest.quests, `${prefix}-quests.json`);
  downloadJson(manifest.difficultyZones, `${prefix}-difficulty-zones.json`);
  downloadJson(manifest.wilderness, `${prefix}-wilderness.json`);
  downloadJson(manifest.biomes, `${prefix}-biomes.json`);

  // Also download complete manifest
  downloadJson(manifest, `${prefix}-full-manifest.json`);
}

const DB_NAME = "world-builder-db";
const DB_VERSION = 1;
const WORLD_STORE = "worlds";
const MANIFEST_STORE = "manifests";

/** Check if IndexedDB is available (fails in private browsing on some browsers) */
export function isIndexedDBAvailable(): boolean {
  try {
    return typeof indexedDB !== "undefined" && indexedDB !== null;
  } catch {
    return false;
  }
}

/** Check if localStorage is available and has space */
export function isLocalStorageAvailable(): boolean {
  try {
    const test = "__storage_test__";
    localStorage.setItem(test, test);
    localStorage.removeItem(test);
    return true;
  } catch {
    return false;
  }
}

function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (!isIndexedDBAvailable()) {
      reject(new Error("IndexedDB not available (private browsing mode?)"));
      return;
    }

    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onerror = () =>
      reject(
        new Error(`IndexedDB error: ${request.error?.message || "unknown"}`),
      );
    request.onsuccess = () => resolve(request.result);

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;

      // Create worlds store
      if (!db.objectStoreNames.contains(WORLD_STORE)) {
        const worldStore = db.createObjectStore(WORLD_STORE, { keyPath: "id" });
        worldStore.createIndex("name", "name", { unique: false });
        worldStore.createIndex("modifiedAt", "modifiedAt", { unique: false });
      }

      // Create manifests store
      if (!db.objectStoreNames.contains(MANIFEST_STORE)) {
        const manifestStore = db.createObjectStore(MANIFEST_STORE, {
          keyPath: "worldId",
        });
        manifestStore.createIndex("exportedAt", "exportedAt", {
          unique: false,
        });
      }
    };
  });
}

export async function saveWorldToIndexedDB(world: WorldData): Promise<void> {
  const db = await openDatabase();
  const serialized = serializeWorld(world);

  return new Promise((resolve, reject) => {
    const transaction = db.transaction([WORLD_STORE], "readwrite");
    const store = transaction.objectStore(WORLD_STORE);
    const request = store.put(serialized);

    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve();
  });
}

export async function loadWorldFromIndexedDB(
  worldId: string,
): Promise<WorldData | null> {
  const db = await openDatabase();

  return new Promise((resolve, reject) => {
    const transaction = db.transaction([WORLD_STORE], "readonly");
    const store = transaction.objectStore(WORLD_STORE);
    const request = store.get(worldId);

    request.onerror = () => reject(request.error);
    request.onsuccess = () => {
      if (request.result) {
        resolve(deserializeWorld(request.result));
      } else {
        resolve(null);
      }
    };
  });
}

export async function listWorldsInIndexedDB(): Promise<
  Array<{ id: string; name: string; modifiedAt: number }>
> {
  const db = await openDatabase();

  return new Promise((resolve, reject) => {
    const transaction = db.transaction([WORLD_STORE], "readonly");
    const store = transaction.objectStore(WORLD_STORE);
    const request = store.getAll();

    request.onerror = () => reject(request.error);
    request.onsuccess = () => {
      const worlds = request.result.map((w: SerializedWorldData) => ({
        id: w.id,
        name: w.name,
        modifiedAt: w.modifiedAt,
      }));
      resolve(worlds.sort((a, b) => b.modifiedAt - a.modifiedAt));
    };
  });
}

export async function deleteWorldFromIndexedDB(worldId: string): Promise<void> {
  const db = await openDatabase();

  return new Promise((resolve, reject) => {
    const transaction = db.transaction(
      [WORLD_STORE, MANIFEST_STORE],
      "readwrite",
    );

    // Delete from worlds store
    const worldStore = transaction.objectStore(WORLD_STORE);
    worldStore.delete(worldId);

    // Delete associated manifest
    const manifestStore = transaction.objectStore(MANIFEST_STORE);
    manifestStore.delete(worldId);

    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error);
  });
}

export async function saveManifestToIndexedDB(
  manifest: FullGameManifest,
): Promise<void> {
  const db = await openDatabase();

  return new Promise((resolve, reject) => {
    const transaction = db.transaction([MANIFEST_STORE], "readwrite");
    const store = transaction.objectStore(MANIFEST_STORE);
    const request = store.put(manifest);

    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve();
  });
}

export async function loadManifestFromIndexedDB(
  worldId: string,
): Promise<FullGameManifest | null> {
  const db = await openDatabase();

  return new Promise((resolve, reject) => {
    const transaction = db.transaction([MANIFEST_STORE], "readonly");
    const store = transaction.objectStore(MANIFEST_STORE);
    const request = store.get(worldId);

    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result || null);
  });
}

export async function exportAndCacheWorld(
  world: WorldData,
): Promise<FullGameManifest> {
  // Save world
  await saveWorldToIndexedDB(world);

  // Generate and save manifest
  const manifest = exportFullGameManifest(world);
  await saveManifestToIndexedDB(manifest);

  return manifest;
}

export function importManifestFromFile(): Promise<FullGameManifest> {
  return new Promise((resolve, reject) => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = ".json";

    input.onchange = async (event) => {
      const file = (event.target as HTMLInputElement).files?.[0];
      if (!file) {
        reject(new Error("No file selected"));
        return;
      }

      const text = await file.text();
      const manifest = JSON.parse(text) as FullGameManifest;

      // Validate manifest structure
      if (!manifest.version || !manifest.worldId) {
        reject(
          new Error("Invalid manifest format: missing version or worldId"),
        );
        return;
      }

      resolve(manifest);
    };

    input.click();
  });
}

export type MergeStrategy = "replace" | "merge" | "skip_existing";

export interface ManifestMergeOptions {
  npcs: MergeStrategy;
  bosses: MergeStrategy;
  quests: MergeStrategy;
  difficultyZones: MergeStrategy;
  biomeOverrides: MergeStrategy;
}

const DEFAULT_MERGE_OPTIONS: ManifestMergeOptions = {
  npcs: "merge",
  bosses: "merge",
  quests: "merge",
  difficultyZones: "replace",
  biomeOverrides: "merge",
};

export function mergeManifestIntoWorld(
  world: WorldData,
  manifest: FullGameManifest,
  options: Partial<ManifestMergeOptions> = {},
): WorldData {
  const mergeOptions = { ...DEFAULT_MERGE_OPTIONS, ...options };
  const updatedWorld = { ...world };

  // Deep clone layers to avoid mutation
  updatedWorld.layers = {
    ...world.layers,
    npcs: [...world.layers.npcs],
    quests: [...world.layers.quests],
    bosses: [...world.layers.bosses],
    difficultyZones: [...world.layers.difficultyZones],
    biomeOverrides: new Map(world.layers.biomeOverrides),
    townOverrides: new Map(world.layers.townOverrides),
    events: [...world.layers.events],
    lore: [...world.layers.lore],
    customPlacements: [...world.layers.customPlacements],
  };

  // Merge NPCs
  if (manifest.npcs?.npcs) {
    const existingIds = new Set(updatedWorld.layers.npcs.map((n) => n.id));

    for (const npc of manifest.npcs.npcs) {
      const exists = existingIds.has(npc.id);

      if (!exists || mergeOptions.npcs === "replace") {
        // Add or replace
        if (exists) {
          updatedWorld.layers.npcs = updatedWorld.layers.npcs.filter(
            (n) => n.id !== npc.id,
          );
        }
        updatedWorld.layers.npcs.push({
          id: npc.id,
          name: npc.name,
          npcTypeId: npc.npcTypeId,
          position: npc.position,
          rotation: 0,
          parentContext: npc.townId
            ? { type: "town", townId: npc.townId }
            : npc.buildingId
              ? { type: "building", buildingId: npc.buildingId }
              : { type: "world" },
          dialogId: npc.dialogId,
          storeId: npc.storeId,
          properties: {},
        });
      } else if (mergeOptions.npcs === "merge") {
        // Update existing
        const idx = updatedWorld.layers.npcs.findIndex((n) => n.id === npc.id);
        if (idx >= 0) {
          updatedWorld.layers.npcs[idx] = {
            ...updatedWorld.layers.npcs[idx],
            name: npc.name,
            position: npc.position,
            dialogId: npc.dialogId,
            storeId: npc.storeId,
          };
        }
      }
      // skip_existing: do nothing
    }
  }

  // Merge Bosses
  if (manifest.bosses?.bosses) {
    const existingIds = new Set(updatedWorld.layers.bosses.map((b) => b.id));

    for (const boss of manifest.bosses.bosses) {
      const exists = existingIds.has(boss.id);

      if (!exists || mergeOptions.bosses === "replace") {
        if (exists) {
          updatedWorld.layers.bosses = updatedWorld.layers.bosses.filter(
            (b) => b.id !== boss.id,
          );
        }
        updatedWorld.layers.bosses.push({
          id: boss.id,
          name: boss.name,
          bossTemplateId: boss.templateId,
          position: boss.position,
          arenaBounds: boss.arenaBounds,
          respawnTime: boss.respawnTime,
          requiredLevel: boss.requiredLevel,
          lootTableId: boss.lootTableId,
          isGenerated: boss.isGenerated,
          generatedConfig: boss.generatedConfig,
          properties: {},
        });
      } else if (mergeOptions.bosses === "merge") {
        const idx = updatedWorld.layers.bosses.findIndex(
          (b) => b.id === boss.id,
        );
        if (idx >= 0) {
          updatedWorld.layers.bosses[idx] = {
            ...updatedWorld.layers.bosses[idx],
            name: boss.name,
            position: boss.position,
            requiredLevel: boss.requiredLevel,
          };
        }
      }
    }
  }

  // Merge Quests
  if (manifest.quests?.quests) {
    const existingIds = new Set(updatedWorld.layers.quests.map((q) => q.id));

    for (const quest of manifest.quests.quests) {
      const exists = existingIds.has(quest.id);

      if (!exists || mergeOptions.quests === "replace") {
        if (exists) {
          updatedWorld.layers.quests = updatedWorld.layers.quests.filter(
            (q) => q.id !== quest.id,
          );
        }
        updatedWorld.layers.quests.push({
          id: quest.id,
          name: quest.name,
          questTemplateId: quest.templateId,
          questGiverNpcId: quest.questGiverNpcId,
          turnInNpcId: quest.turnInNpcId,
          requiredLevel: quest.requiredLevel,
          locations: quest.locations.map((loc) => ({
            type: loc.type as "town" | "biome" | "building" | "coordinate",
            id: loc.id,
            position: loc.position,
            description: loc.description,
          })),
          properties: {},
        });
      } else if (mergeOptions.quests === "merge") {
        const idx = updatedWorld.layers.quests.findIndex(
          (q) => q.id === quest.id,
        );
        if (idx >= 0) {
          updatedWorld.layers.quests[idx] = {
            ...updatedWorld.layers.quests[idx],
            name: quest.name,
            requiredLevel: quest.requiredLevel,
          };
        }
      }
    }
  }

  // Merge Difficulty Zones
  if (manifest.difficultyZones?.zones) {
    if (mergeOptions.difficultyZones === "replace") {
      // Replace all zones
      updatedWorld.layers.difficultyZones = manifest.difficultyZones.zones.map(
        (zone) => ({
          id: zone.id,
          name: zone.name,
          difficultyLevel: zone.difficultyLevel,
          zoneType: zone.center ? "voronoi" : "bounds",
          bounds: zone.bounds,
          center: zone.center,
          linkedTownId: zone.linkedTownId,
          isSafeZone: zone.isSafeZone,
          mobLevelRange: zone.mobLevelRange,
          properties: {},
        }),
      );
    } else {
      const existingIds = new Set(
        updatedWorld.layers.difficultyZones.map((z) => z.id),
      );

      for (const zone of manifest.difficultyZones.zones) {
        const exists = existingIds.has(zone.id);

        if (!exists) {
          updatedWorld.layers.difficultyZones.push({
            id: zone.id,
            name: zone.name,
            difficultyLevel: zone.difficultyLevel,
            zoneType: zone.center ? "voronoi" : "bounds",
            bounds: zone.bounds,
            center: zone.center,
            linkedTownId: zone.linkedTownId,
            isSafeZone: zone.isSafeZone,
            mobLevelRange: zone.mobLevelRange,
            properties: {},
          });
        } else if (mergeOptions.difficultyZones === "merge") {
          const idx = updatedWorld.layers.difficultyZones.findIndex(
            (z) => z.id === zone.id,
          );
          if (idx >= 0) {
            updatedWorld.layers.difficultyZones[idx] = {
              ...updatedWorld.layers.difficultyZones[idx],
              name: zone.name,
              difficultyLevel: zone.difficultyLevel,
              mobLevelRange: zone.mobLevelRange,
            };
          }
        }
      }
    }
  }

  // Merge Biome overrides
  if (manifest.biomes?.biomes) {
    for (const biome of manifest.biomes.biomes) {
      const existingOverride = updatedWorld.layers.biomeOverrides.get(biome.id);

      if (!existingOverride || mergeOptions.biomeOverrides === "replace") {
        // Create or replace override
        const override: BiomeOverride = {
          biomeId: biome.id,
        };

        if (
          biome.type !==
          world.foundation.biomes.find((b) => b.id === biome.id)?.type
        ) {
          override.typeOverride = biome.type;
        }

        if (biome.materialConfig) {
          override.materialOverride = {
            baseTextureId: biome.materialConfig.baseTextureId,
            secondaryTextureId: biome.materialConfig.secondaryTextureId,
            blendMode: biome.materialConfig.blendMode as
              | "height"
              | "slope"
              | "noise",
            blendThreshold: 0.5,
            roughness: biome.materialConfig.roughness,
            colorTint: biome.materialConfig.colorTint,
            uvScale: biome.materialConfig.uvScale,
          };
        }

        if (biome.heightConfig) {
          override.heightOverride = biome.heightConfig;
        }

        updatedWorld.layers.biomeOverrides.set(biome.id, override);
      } else if (mergeOptions.biomeOverrides === "merge") {
        // Merge with existing override
        const merged = { ...existingOverride };

        if (biome.materialConfig) {
          merged.materialOverride = {
            ...merged.materialOverride,
            baseTextureId: biome.materialConfig.baseTextureId,
            roughness: biome.materialConfig.roughness,
            colorTint: biome.materialConfig.colorTint,
            uvScale: biome.materialConfig.uvScale,
            blendMode:
              (biome.materialConfig.blendMode as
                | "height"
                | "slope"
                | "noise") || "height",
            blendThreshold: merged.materialOverride?.blendThreshold ?? 0.5,
          };
        }

        if (biome.heightConfig) {
          merged.heightOverride = biome.heightConfig;
        }

        updatedWorld.layers.biomeOverrides.set(biome.id, merged);
      }
    }
  }

  // Update modified timestamp
  updatedWorld.modifiedAt = Date.now();

  return updatedWorld;
}

export async function importAndMergeFromIndexedDB(
  targetWorld: WorldData,
  sourceWorldId: string,
  options?: Partial<ManifestMergeOptions>,
): Promise<WorldData> {
  const manifest = await loadManifestFromIndexedDB(sourceWorldId);
  if (!manifest) {
    throw new Error(`No manifest found for world ${sourceWorldId}`);
  }

  return mergeManifestIntoWorld(targetWorld, manifest, options);
}

const AUTOSAVE_KEY = "worldbuilder_autosave";
const AUTOSAVE_LIST_KEY = "worldbuilder_autosave_list";
const MAX_AUTOSAVES = 10;

interface AutosaveMetadata {
  worldId: string;
  worldName: string;
  savedAt: number;
  storageKey: string;
}

export function getAutosaveList(): AutosaveMetadata[] {
  const listJson = localStorage.getItem(AUTOSAVE_LIST_KEY);
  if (!listJson) return [];

  const list = JSON.parse(listJson) as AutosaveMetadata[];
  return list.sort((a, b) => b.savedAt - a.savedAt);
}

export function autosaveWorld(world: WorldData): void {
  if (!isLocalStorageAvailable()) return; // Silently skip if unavailable

  const storageKey = `${AUTOSAVE_KEY}_${world.id}`;
  const serialized = serializeWorld(world);

  try {
    localStorage.setItem(storageKey, JSON.stringify(serialized));
  } catch {
    // localStorage full or unavailable - silently skip
    return;
  }

  // Update the autosave list
  const list = getAutosaveList();
  const existingIndex = list.findIndex((m) => m.worldId === world.id);

  const metadata: AutosaveMetadata = {
    worldId: world.id,
    worldName: world.name,
    savedAt: Date.now(),
    storageKey,
  };

  if (existingIndex >= 0) {
    list[existingIndex] = metadata;
  } else {
    list.unshift(metadata);
  }

  // Prune old autosaves if we exceed the limit
  while (list.length > MAX_AUTOSAVES) {
    const oldest = list.pop();
    if (oldest) {
      localStorage.removeItem(oldest.storageKey);
    }
  }

  localStorage.setItem(AUTOSAVE_LIST_KEY, JSON.stringify(list));
}

export function loadAutosave(worldId: string): WorldData | null {
  const storageKey = `${AUTOSAVE_KEY}_${worldId}`;
  const json = localStorage.getItem(storageKey);
  if (!json) return null;

  const serialized = JSON.parse(json) as SerializedWorldData;
  return deserializeWorld(serialized);
}

export function deleteAutosave(worldId: string): void {
  const storageKey = `${AUTOSAVE_KEY}_${worldId}`;
  localStorage.removeItem(storageKey);

  const list = getAutosaveList();
  const filtered = list.filter((m) => m.worldId !== worldId);
  localStorage.setItem(AUTOSAVE_LIST_KEY, JSON.stringify(filtered));
}

export function clearAllAutosaves(): void {
  const list = getAutosaveList();
  for (const metadata of list) {
    localStorage.removeItem(metadata.storageKey);
  }
  localStorage.removeItem(AUTOSAVE_LIST_KEY);
}

export function getMostRecentAutosave(): WorldData | null {
  const list = getAutosaveList();
  if (list.length === 0) return null;
  return loadAutosave(list[0].worldId);
}

/** Generate difficulty zones based on town positions (Voronoi-like) */
export function generateDifficultyZones(
  towns: GeneratedTown[],
  worldSize: number,
  tileSize: number,
  starterTownIds: string[] = [],
): DifficultyZone[] {
  const zones: DifficultyZone[] = [];
  const worldSizeMeters = worldSize * tileSize;
  const worldCenter = worldSizeMeters / 2;

  // Sort towns by distance from center (starter towns are usually near center)
  const sortedTowns = [...towns].sort((a, b) => {
    const distA = Math.sqrt(
      Math.pow(a.position.x - worldCenter, 2) +
        Math.pow(a.position.z - worldCenter, 2),
    );
    const distB = Math.sqrt(
      Math.pow(b.position.x - worldCenter, 2) +
        Math.pow(b.position.z - worldCenter, 2),
    );
    return distA - distB;
  });

  // If no starter towns specified, use the closest towns to center
  const starters =
    starterTownIds.length > 0
      ? starterTownIds
      : sortedTowns
          .slice(0, Math.max(1, Math.floor(towns.length * 0.1)))
          .map((t) => t.id);

  // Create safe zones around each town
  for (const town of towns) {
    const isStarter = starters.includes(town.id);
    const distFromCenter = Math.sqrt(
      Math.pow(town.position.x - worldCenter, 2) +
        Math.pow(town.position.z - worldCenter, 2),
    );
    const normalizedDist = distFromCenter / (worldSizeMeters / 2);

    // Base difficulty based on distance from center (0-4)
    const baseDifficulty = isStarter
      ? 0
      : Math.min(4, Math.floor(normalizedDist * 5));

    // Safe zone radius scales with town size
    const safeRadius =
      town.size === "town" ? 200 : town.size === "village" ? 150 : 100;

    // Create safe zone for the town
    zones.push({
      id: `safe-zone-${town.id}`,
      name: `${town.name} Safe Zone`,
      difficultyLevel: 0,
      zoneType: "voronoi",
      bounds: {
        minX: town.position.x - safeRadius,
        maxX: town.position.x + safeRadius,
        minZ: town.position.z - safeRadius,
        maxZ: town.position.z + safeRadius,
      },
      center: { x: town.position.x, y: 0, z: town.position.z },
      linkedTownId: town.id,
      isSafeZone: true,
      mobLevelRange: [0, 0],
      properties: { townSize: town.size, isStarter },
    });

    // Create surrounding danger zone (Voronoi cell)
    if (!isStarter) {
      const dangerRadius = safeRadius * 3;
      const mobMinLevel = Math.max(1, baseDifficulty * 10);
      const mobMaxLevel = Math.min(99, (baseDifficulty + 1) * 15);

      zones.push({
        id: `zone-${town.id}`,
        name: `${town.name} Region`,
        difficultyLevel: baseDifficulty,
        zoneType: "voronoi",
        bounds: {
          minX: town.position.x - dangerRadius,
          maxX: town.position.x + dangerRadius,
          minZ: town.position.z - dangerRadius,
          maxZ: town.position.z + dangerRadius,
        },
        center: { x: town.position.x, y: 0, z: town.position.z },
        linkedTownId: town.id,
        isSafeZone: false,
        mobLevelRange: [mobMinLevel, mobMaxLevel],
        properties: { baseDifficulty, normalizedDist },
      });
    }
  }

  // Create high-danger zones in areas far from towns
  const gridSize = 4;
  const cellSize = worldSizeMeters / gridSize;

  for (let gx = 0; gx < gridSize; gx++) {
    for (let gz = 0; gz < gridSize; gz++) {
      const cellCenterX = (gx + 0.5) * cellSize;
      const cellCenterZ = (gz + 0.5) * cellSize;

      // Find distance to nearest town
      let minDist = Infinity;
      for (const town of towns) {
        const dist = Math.sqrt(
          Math.pow(town.position.x - cellCenterX, 2) +
            Math.pow(town.position.z - cellCenterZ, 2),
        );
        minDist = Math.min(minDist, dist);
      }

      // If far from all towns (> 500m), create a high danger zone
      if (minDist > 500) {
        const distFromCenter = Math.sqrt(
          Math.pow(cellCenterX - worldCenter, 2) +
            Math.pow(cellCenterZ - worldCenter, 2),
        );
        const normalizedDist = distFromCenter / (worldSizeMeters / 2);
        const difficulty = Math.min(4, Math.floor(normalizedDist * 5) + 1);

        zones.push({
          id: `wild-zone-${gx}-${gz}`,
          name: `Wild Zone (${gx}, ${gz})`,
          difficultyLevel: difficulty,
          zoneType: "bounds",
          bounds: {
            minX: gx * cellSize,
            maxX: (gx + 1) * cellSize,
            minZ: gz * cellSize,
            maxZ: (gz + 1) * cellSize,
          },
          isSafeZone: false,
          mobLevelRange: [difficulty * 15, Math.min(99, (difficulty + 1) * 20)],
          properties: { isWilderness: true, distanceFromTowns: minDist },
        });
      }
    }
  }

  return zones;
}

export function generateWilderness(
  worldSize: number,
  tileSize: number,
  direction: "north" | "south" | "east" | "west" = "north",
  startBoundaryPercent: number = 0.3,
): WildernessZone {
  return {
    id: "wilderness-main",
    name: "The Wilderness",
    direction,
    startBoundary: startBoundaryPercent,
    multiCombat: true,
    baseLevelAtBoundary: 1,
    levelPerHundredMeters: 1,
  };
}

export function isInWilderness(
  position: WorldPosition,
  wilderness: WildernessZone,
  worldSize: number,
  tileSize: number,
): boolean {
  const worldSizeMeters = worldSize * tileSize;
  // startBoundary is the percentage from the "origin" side where wilderness starts
  // e.g., startBoundary=0.7 means wilderness starts at 70% and extends to 100%
  const threshold = worldSizeMeters * wilderness.startBoundary;

  // In our coordinate system:
  // - Z increases going north (positive Z = north)
  // - X increases going east (positive X = east)
  switch (wilderness.direction) {
    case "north":
      // Wilderness is the northern portion (high Z values)
      return position.z > threshold;
    case "south":
      // Wilderness is the southern portion (low Z values)
      return position.z < worldSizeMeters - threshold;
    case "east":
      // Wilderness is the eastern portion (high X values)
      return position.x > threshold;
    case "west":
      // Wilderness is the western portion (low X values)
      return position.x < worldSizeMeters - threshold;
  }
}

export function getWildernessLevel(
  position: WorldPosition,
  wilderness: WildernessZone,
  worldSize: number,
  tileSize: number,
): number {
  if (!isInWilderness(position, wilderness, worldSize, tileSize)) {
    return 0;
  }

  const worldSizeMeters = worldSize * tileSize;
  const threshold = worldSizeMeters * wilderness.startBoundary;

  // Calculate distance into the wilderness from the boundary
  // Deeper into wilderness = higher level
  let distanceIntoBoundary: number;
  switch (wilderness.direction) {
    case "north":
      // North wilderness: z > threshold, deeper = higher z
      distanceIntoBoundary = position.z - threshold;
      break;
    case "south":
      // South wilderness: z < (worldSizeMeters - threshold), deeper = lower z
      distanceIntoBoundary = worldSizeMeters - threshold - position.z;
      break;
    case "east":
      // East wilderness: x > threshold, deeper = higher x
      distanceIntoBoundary = position.x - threshold;
      break;
    case "west":
      // West wilderness: x < (worldSizeMeters - threshold), deeper = lower x
      distanceIntoBoundary = worldSizeMeters - threshold - position.x;
      break;
  }

  return Math.max(
    1,
    Math.floor(
      wilderness.baseLevelAtBoundary +
        (distanceIntoBoundary / 100) * wilderness.levelPerHundredMeters,
    ),
  );
}

const DEFAULT_BIOME_MOB_TABLES: Record<string, MobSpawnEntry[]> = {
  plains: [
    { mobTypeId: "rabbit", weight: 30, levelRange: [1, 3], groupSize: [1, 3] },
    { mobTypeId: "wolf", weight: 20, levelRange: [3, 8], groupSize: [2, 4] },
    { mobTypeId: "goblin", weight: 40, levelRange: [1, 10], groupSize: [1, 4] },
    { mobTypeId: "bandit", weight: 10, levelRange: [5, 15], groupSize: [2, 5] },
  ],
  forest: [
    { mobTypeId: "wolf", weight: 25, levelRange: [5, 12], groupSize: [2, 5] },
    { mobTypeId: "spider", weight: 30, levelRange: [8, 18], groupSize: [1, 3] },
    { mobTypeId: "bear", weight: 15, levelRange: [10, 20], groupSize: [1, 2] },
    {
      mobTypeId: "treant",
      weight: 10,
      levelRange: [15, 25],
      groupSize: [1, 1],
    },
    { mobTypeId: "goblin", weight: 20, levelRange: [5, 15], groupSize: [2, 6] },
  ],
  mountains: [
    { mobTypeId: "goat", weight: 20, levelRange: [1, 5], groupSize: [2, 4] },
    { mobTypeId: "troll", weight: 25, levelRange: [20, 35], groupSize: [1, 2] },
    {
      mobTypeId: "rock_elemental",
      weight: 15,
      levelRange: [25, 40],
      groupSize: [1, 1],
    },
    { mobTypeId: "giant", weight: 10, levelRange: [30, 50], groupSize: [1, 1] },
    { mobTypeId: "orc", weight: 30, levelRange: [15, 30], groupSize: [2, 4] },
  ],
  desert: [
    {
      mobTypeId: "scorpion",
      weight: 30,
      levelRange: [5, 15],
      groupSize: [1, 3],
    },
    {
      mobTypeId: "sand_worm",
      weight: 15,
      levelRange: [20, 35],
      groupSize: [1, 1],
    },
    { mobTypeId: "mummy", weight: 20, levelRange: [15, 30], groupSize: [1, 3] },
    { mobTypeId: "snake", weight: 25, levelRange: [3, 12], groupSize: [1, 2] },
    {
      mobTypeId: "desert_bandit",
      weight: 10,
      levelRange: [10, 25],
      groupSize: [3, 6],
    },
  ],
  swamp: [
    {
      mobTypeId: "crocodile",
      weight: 25,
      levelRange: [8, 18],
      groupSize: [1, 2],
    },
    {
      mobTypeId: "bog_creature",
      weight: 20,
      levelRange: [12, 25],
      groupSize: [1, 2],
    },
    {
      mobTypeId: "poisonous_frog",
      weight: 20,
      levelRange: [5, 12],
      groupSize: [2, 4],
    },
    { mobTypeId: "witch", weight: 15, levelRange: [20, 35], groupSize: [1, 1] },
    {
      mobTypeId: "zombie",
      weight: 20,
      levelRange: [10, 20],
      groupSize: [2, 5],
    },
  ],
  tundra: [
    {
      mobTypeId: "ice_wolf",
      weight: 30,
      levelRange: [10, 20],
      groupSize: [3, 5],
    },
    {
      mobTypeId: "frost_giant",
      weight: 15,
      levelRange: [30, 50],
      groupSize: [1, 1],
    },
    {
      mobTypeId: "ice_elemental",
      weight: 15,
      levelRange: [25, 40],
      groupSize: [1, 1],
    },
    { mobTypeId: "yeti", weight: 20, levelRange: [20, 35], groupSize: [1, 2] },
    {
      mobTypeId: "snow_hare",
      weight: 20,
      levelRange: [1, 5],
      groupSize: [2, 4],
    },
  ],
  lakes: [
    { mobTypeId: "fish", weight: 40, levelRange: [1, 5], groupSize: [3, 6] },
    {
      mobTypeId: "water_elemental",
      weight: 15,
      levelRange: [20, 35],
      groupSize: [1, 1],
    },
    { mobTypeId: "naga", weight: 25, levelRange: [15, 30], groupSize: [1, 3] },
    {
      mobTypeId: "giant_crab",
      weight: 20,
      levelRange: [10, 20],
      groupSize: [1, 2],
    },
  ],
  valley: [
    { mobTypeId: "deer", weight: 25, levelRange: [1, 5], groupSize: [2, 4] },
    { mobTypeId: "wolf", weight: 20, levelRange: [5, 12], groupSize: [2, 4] },
    { mobTypeId: "goblin", weight: 30, levelRange: [3, 12], groupSize: [2, 5] },
    { mobTypeId: "orc", weight: 15, levelRange: [10, 20], groupSize: [2, 4] },
    { mobTypeId: "bandit", weight: 10, levelRange: [8, 18], groupSize: [3, 5] },
  ],
};

interface MobSpawnEntry {
  mobTypeId: string;
  weight: number;
  levelRange: [number, number];
  groupSize: [number, number];
}

export function generateMobSpawns(world: WorldData): MobSpawnManifest {
  const { foundation, layers } = world;
  const spawns: MobSpawnConfig[] = [];

  // Generate spawns for each biome
  for (const biome of foundation.biomes) {
    // Check for biome override with custom mob config
    const override = layers.biomeOverrides.get(biome.id);
    const biomeType = override?.typeOverride || biome.type;

    // Get default spawn table for this biome type
    const defaultTable =
      DEFAULT_BIOME_MOB_TABLES[biomeType] || DEFAULT_BIOME_MOB_TABLES.plains;

    // If there's a custom mob config, use that; otherwise scale defaults by difficulty
    const customMobConfig = override?.mobSpawnConfig;
    const difficulty = override?.difficultyOverride ?? 0;

    // Calculate level modifier based on difficulty (0-4 maps to 0-40 level boost)
    const levelModifier = difficulty * 10;

    // Generate spawn configuration
    const spawnConfig: MobSpawnConfig = {
      biomeId: biome.id,
      biomeType,
      enabled: customMobConfig?.enabled ?? true,
      spawnRate: customMobConfig?.spawnRate ?? 0.3 + difficulty * 0.1,
      maxPerChunk: customMobConfig?.maxPerChunk ?? 2 + difficulty,
      spawnTable:
        customMobConfig?.spawnTable?.map((entry) => ({
          ...entry,
          levelRange: [
            Math.min(99, entry.levelRange[0] + levelModifier),
            Math.min(99, entry.levelRange[1] + levelModifier),
          ] as [number, number],
        })) ??
        defaultTable.map((entry) => ({
          ...entry,
          levelRange: [
            Math.min(99, entry.levelRange[0] + levelModifier),
            Math.min(99, entry.levelRange[1] + levelModifier),
          ] as [number, number],
        })),
      bounds: {
        minX: biome.center.x - biome.influenceRadius,
        maxX: biome.center.x + biome.influenceRadius,
        minZ: biome.center.z - biome.influenceRadius,
        maxZ: biome.center.z + biome.influenceRadius,
      },
    };

    spawns.push(spawnConfig);
  }

  // Also add spawns for difficulty zones (boost levels in high-difficulty areas)
  for (const zone of layers.difficultyZones) {
    if (!zone.isSafeZone) {
      const zoneSpawn: MobSpawnConfig = {
        biomeId: `zone_${zone.id}`,
        biomeType: "difficulty_zone",
        enabled: true,
        spawnRate: 0.3 + zone.difficultyLevel * 0.15,
        maxPerChunk: 2 + zone.difficultyLevel,
        spawnTable: [
          {
            mobTypeId: "generic_hostile",
            weight: 100,
            levelRange: zone.mobLevelRange,
            groupSize: [1, 3],
          },
        ],
        bounds: zone.bounds,
        zoneOverride: true,
      };
      spawns.push(zoneSpawn);
    }
  }

  return {
    version: 1,
    worldId: world.id,
    generatedAt: Date.now(),
    spawns,
  };
}

interface MobSpawnConfig {
  biomeId: string;
  biomeType: string;
  enabled: boolean;
  spawnRate: number;
  maxPerChunk: number;
  spawnTable: MobSpawnEntry[];
  bounds: {
    minX: number;
    maxX: number;
    minZ: number;
    maxZ: number;
  };
  zoneOverride?: boolean;
}

interface MobSpawnManifest {
  version: number;
  worldId: string;
  generatedAt: number;
  spawns: MobSpawnConfig[];
}

const BOSS_TEMPLATES: Record<string, BossTemplate[]> = {
  plains: [
    {
      name: "Chieftain",
      archetype: "brute",
      baseModel: "orc_large",
      baseLevel: 15,
    },
    {
      name: "Alpha Wolf",
      archetype: "berserker",
      baseModel: "wolf_large",
      baseLevel: 12,
    },
    {
      name: "Bandit King",
      archetype: "assassin",
      baseModel: "human_bandit",
      baseLevel: 18,
    },
  ],
  forest: [
    {
      name: "Ancient Treant",
      archetype: "tank",
      baseModel: "treant",
      baseLevel: 25,
    },
    {
      name: "Spider Queen",
      archetype: "summoner",
      baseModel: "spider_queen",
      baseLevel: 22,
    },
    {
      name: "Forest Witch",
      archetype: "caster",
      baseModel: "witch",
      baseLevel: 28,
    },
  ],
  mountains: [
    {
      name: "Mountain Giant",
      archetype: "brute",
      baseModel: "giant",
      baseLevel: 40,
    },
    {
      name: "Stone Colossus",
      archetype: "tank",
      baseModel: "golem",
      baseLevel: 45,
    },
    { name: "Dragon", archetype: "dragon", baseModel: "dragon", baseLevel: 60 },
  ],
  desert: [
    {
      name: "Scorpion Emperor",
      archetype: "berserker",
      baseModel: "scorpion_giant",
      baseLevel: 30,
    },
    {
      name: "Mummy Lord",
      archetype: "summoner",
      baseModel: "mummy_lord",
      baseLevel: 35,
    },
    {
      name: "Sand Wyrm",
      archetype: "brute",
      baseModel: "sand_worm",
      baseLevel: 38,
    },
  ],
  swamp: [
    {
      name: "Swamp Hydra",
      archetype: "tank",
      baseModel: "hydra",
      baseLevel: 32,
    },
    { name: "Hag Coven", archetype: "caster", baseModel: "hag", baseLevel: 28 },
    {
      name: "Zombie Colossus",
      archetype: "brute",
      baseModel: "zombie_giant",
      baseLevel: 25,
    },
  ],
  tundra: [
    {
      name: "Frost Giant King",
      archetype: "brute",
      baseModel: "frost_giant",
      baseLevel: 50,
    },
    {
      name: "Ice Dragon",
      archetype: "dragon",
      baseModel: "ice_dragon",
      baseLevel: 65,
    },
    {
      name: "Yeti Alpha",
      archetype: "berserker",
      baseModel: "yeti_alpha",
      baseLevel: 40,
    },
  ],
  lakes: [
    { name: "Kraken", archetype: "tank", baseModel: "kraken", baseLevel: 55 },
    {
      name: "Naga Queen",
      archetype: "caster",
      baseModel: "naga_queen",
      baseLevel: 35,
    },
    {
      name: "Sea Serpent",
      archetype: "dragon",
      baseModel: "sea_serpent",
      baseLevel: 45,
    },
  ],
};

interface BossTemplate {
  name: string;
  archetype: BossArchetype;
  baseModel: string;
  baseLevel: number;
}

const TITLE_PREFIXES = [
  ["Young", "Minor", "Lesser"], // Difficulty 0-1
  ["", "Fierce", "Savage"], // Difficulty 2
  ["Elder", "Ancient", "Dire"], // Difficulty 3
  ["Legendary", "Mythic", "Nightmare"], // Difficulty 4
];

function seededRandom(seed: number): () => number {
  let state = seed;
  return () => {
    state = (state * 1103515245 + 12345) & 0x7fffffff;
    return state / 0x7fffffff;
  };
}

export function generateBosses(
  world: WorldData,
  bossCount: number = 10,
  seed?: number,
): PlacedBoss[] {
  const { foundation, layers } = world;
  const random = seededRandom(seed ?? Date.now());
  const bosses: PlacedBoss[] = [];

  // Get difficulty zones sorted by difficulty level (for potential future use)
  const _zones = [...layers.difficultyZones].filter((z) => !z.isSafeZone);

  // Calculate how many bosses per difficulty tier
  const bossesPerTier = Math.ceil(bossCount / 4);
  const tierCounts = [
    Math.max(1, Math.floor(bossesPerTier * 0.5)), // Easy: fewer bosses
    bossesPerTier,
    bossesPerTier,
    Math.max(1, Math.floor(bossesPerTier * 1.5)), // Hard: more bosses
  ];

  // Find biomes at different difficulty levels
  const biomesByDifficulty = new Map<number, typeof foundation.biomes>();
  for (const biome of foundation.biomes) {
    const override = layers.biomeOverrides.get(biome.id);
    const difficulty = override?.difficultyOverride ?? Math.floor(random() * 3);
    if (!biomesByDifficulty.has(difficulty)) {
      biomesByDifficulty.set(difficulty, []);
    }
    biomesByDifficulty.get(difficulty)!.push(biome);
  }

  // Generate bosses
  for (let tier = 0; tier <= 3; tier++) {
    const count = tierCounts[tier] || 1;
    const biomesAtTier = biomesByDifficulty.get(tier) || foundation.biomes;

    for (let i = 0; i < count && bosses.length < bossCount; i++) {
      // Pick a random biome at this tier
      const biome = biomesAtTier[Math.floor(random() * biomesAtTier.length)];
      const biomeType = biome?.type || "plains";

      // Get available templates for this biome
      const templates = BOSS_TEMPLATES[biomeType] || BOSS_TEMPLATES.plains;
      const template = templates[Math.floor(random() * templates.length)];

      // Generate position within biome
      const radius = biome?.influenceRadius || 500;
      const centerX = biome?.center.x || 0;
      const centerZ = biome?.center.z || 0;
      const angle = random() * Math.PI * 2;
      const dist = random() * radius * 0.8;
      const posX = centerX + Math.cos(angle) * dist;
      const posZ = centerZ + Math.sin(angle) * dist;

      // Calculate boss level based on tier and template
      const levelBoost = tier * 15;
      const combatLevel =
        template.baseLevel + levelBoost + Math.floor(random() * 10 - 5);

      // Generate title prefix
      const prefixTier = Math.min(3, tier);
      const prefixes = TITLE_PREFIXES[prefixTier];
      const prefix = prefixes[Math.floor(random() * prefixes.length)];
      const fullName = prefix ? `${prefix} ${template.name}` : template.name;

      // Generate abilities based on archetype
      const abilities = generateBossAbilities(
        template.archetype,
        combatLevel,
        random,
      );

      // Generate deterministic ID using seeded random
      const idSuffix = Math.floor(random() * 0xffffffff).toString(36);
      const idIndex = bosses.length;

      // Create boss
      const boss: PlacedBoss = {
        id: `boss_${idIndex}_${idSuffix}`,
        bossTemplateId: `${biomeType}_${template.archetype}_boss`,
        name: fullName,
        position: { x: posX, y: 0, z: posZ },
        arenaBounds: {
          minX: posX - 50,
          maxX: posX + 50,
          minZ: posZ - 50,
          maxZ: posZ + 50,
        },
        respawnTime: 3600 + tier * 1800, // 1-3 hours based on tier
        requiredLevel: Math.max(1, combatLevel - 10),
        lootTableId: `loot_boss_tier${tier}_${biomeType}`,
        isGenerated: true,
        generatedConfig: {
          archetype: template.archetype,
          baseModelId: template.baseModel,
          scale: 1.5 + tier * 0.3 + random() * 0.5,
          colorTint: generateBossColor(template.archetype, random),
          titlePrefix: prefix,
          combatLevel,
          healthMultiplier: 1 + tier * 0.5,
          damageMultiplier: 1 + tier * 0.3,
          abilities,
          phases: tier >= 2 ? [75, 50, 25] : tier >= 1 ? [50] : [],
          loreText: generateBossLore(
            fullName,
            biomeType,
            template.archetype,
            random,
          ),
        },
        properties: {
          biomeId: biome?.id,
          tier,
        },
      };

      bosses.push(boss);
    }
  }

  return bosses;
}

function generateBossAbilities(
  archetype: BossArchetype,
  level: number,
  _random: () => number, // Reserved for future ability variation
): BossAbility[] {
  const baseDamage = level * 2;

  const archetypeAbilities: Record<BossArchetype, BossAbility[]> = {
    brute: [
      {
        id: "ground_slam",
        name: "Ground Slam",
        cooldown: 8,
        damage: baseDamage * 1.5,
        radius: 10,
        effects: ["stun"],
      },
      {
        id: "heavy_strike",
        name: "Heavy Strike",
        cooldown: 4,
        damage: baseDamage * 2,
        radius: 0,
        effects: ["knockback"],
      },
    ],
    assassin: [
      {
        id: "shadow_step",
        name: "Shadow Step",
        cooldown: 6,
        damage: baseDamage * 1.2,
        radius: 0,
        effects: ["teleport", "bleed"],
      },
      {
        id: "backstab",
        name: "Backstab",
        cooldown: 10,
        damage: baseDamage * 3,
        radius: 0,
        effects: ["crit"],
      },
    ],
    caster: [
      {
        id: "fireball",
        name: "Fireball",
        cooldown: 4,
        damage: baseDamage * 1.3,
        radius: 8,
        effects: ["burn"],
      },
      {
        id: "chain_lightning",
        name: "Chain Lightning",
        cooldown: 8,
        damage: baseDamage,
        radius: 15,
        effects: ["chain"],
      },
      {
        id: "frost_nova",
        name: "Frost Nova",
        cooldown: 12,
        damage: baseDamage * 0.8,
        radius: 12,
        effects: ["slow", "freeze"],
      },
    ],
    summoner: [
      {
        id: "summon_minions",
        name: "Summon Minions",
        cooldown: 20,
        damage: 0,
        radius: 0,
        effects: ["summon_3"],
      },
      {
        id: "empower_minions",
        name: "Empower Minions",
        cooldown: 15,
        damage: 0,
        radius: 30,
        effects: ["buff_minions"],
      },
    ],
    tank: [
      {
        id: "reflect_shield",
        name: "Reflect Shield",
        cooldown: 15,
        damage: 0,
        radius: 0,
        effects: ["reflect_50"],
      },
      {
        id: "taunt",
        name: "Taunt",
        cooldown: 8,
        damage: 0,
        radius: 20,
        effects: ["taunt", "defense_up"],
      },
    ],
    berserker: [
      {
        id: "frenzy",
        name: "Frenzy",
        cooldown: 20,
        damage: 0,
        radius: 0,
        effects: ["attack_speed_up", "damage_up"],
      },
      {
        id: "rage_slam",
        name: "Rage Slam",
        cooldown: 6,
        damage: baseDamage * 1.8,
        radius: 8,
        effects: ["knockback"],
      },
    ],
    dragon: [
      {
        id: "fire_breath",
        name: "Fire Breath",
        cooldown: 10,
        damage: baseDamage * 1.5,
        radius: 15,
        effects: ["burn", "cone"],
      },
      {
        id: "tail_sweep",
        name: "Tail Sweep",
        cooldown: 6,
        damage: baseDamage * 1.2,
        radius: 12,
        effects: ["knockback", "arc"],
      },
      {
        id: "fly_attack",
        name: "Dive Attack",
        cooldown: 15,
        damage: baseDamage * 2,
        radius: 8,
        effects: ["fly", "stun"],
      },
    ],
  };

  return archetypeAbilities[archetype] || archetypeAbilities.brute;
}

function generateBossColor(
  archetype: BossArchetype,
  random: () => number,
): string {
  const colors: Record<BossArchetype, string[]> = {
    brute: ["#8B4513", "#654321", "#A0522D"],
    assassin: ["#4A0080", "#2E0854", "#6B238E"],
    caster: ["#0066CC", "#4169E1", "#1E90FF"],
    summoner: ["#228B22", "#006400", "#32CD32"],
    tank: ["#708090", "#778899", "#696969"],
    berserker: ["#8B0000", "#B22222", "#DC143C"],
    dragon: ["#FF4500", "#FF6347", "#FFD700"],
  };

  const palette = colors[archetype];
  return palette[Math.floor(random() * palette.length)];
}

function generateBossLore(
  name: string,
  biome: string,
  archetype: BossArchetype,
  random: () => number,
): string {
  const loreParts: Record<BossArchetype, string[]> = {
    brute: [
      `${name} has terrorized the ${biome} for generations, crushing all who oppose.`,
      `Legends speak of ${name}'s unstoppable rage that shakes the very earth.`,
    ],
    assassin: [
      `${name} strikes from the shadows, leaving no survivors.`,
      `Few have seen ${name} and lived to tell the tale.`,
    ],
    caster: [
      `${name} commands ancient magics that twist reality itself.`,
      `The arcane power of ${name} corrupts the land around their domain.`,
    ],
    summoner: [
      `${name} raises armies of the dead to serve their dark purpose.`,
      `Wherever ${name} goes, a horde of minions follows.`,
    ],
    tank: [
      `${name}'s scales are said to be impenetrable by mortal weapons.`,
      `Many have broken their blades against ${name}'s iron hide.`,
    ],
    berserker: [
      `${name} grows stronger with every wound, feeding on pain and fury.`,
      `The blood-rage of ${name} knows no bounds once unleashed.`,
    ],
    dragon: [
      `${name} descended from the peaks to claim this land as their dominion.`,
      `The fires of ${name} have reduced entire kingdoms to ash.`,
    ],
  };

  const parts = loreParts[archetype];
  return parts[Math.floor(random() * parts.length)];
}

interface ValidationError {
  layer: string;
  itemId: string;
  message: string;
  severity: "error" | "warning";
}

interface ValidationResult {
  valid: boolean;
  errors: ValidationError[];
  warnings: ValidationError[];
}

export function validateWorldReferences(world: WorldData): ValidationResult {
  const errors: ValidationError[] = [];
  const warnings: ValidationError[] = [];

  const { foundation, layers } = world;

  // Build lookup sets
  const biomeIds = new Set(foundation.biomes.map((b) => b.id));
  const townIds = new Set(foundation.towns.map((t) => t.id));
  const buildingIds = new Set(foundation.buildings.map((b) => b.id));
  const npcIds = new Set(layers.npcs.map((n) => n.id));
  const _bossIds = new Set(layers.bosses.map((b) => b.id)); // Reserved for future boss validation

  // Validate buildings reference valid towns
  for (const building of foundation.buildings) {
    if (!townIds.has(building.townId)) {
      errors.push({
        layer: "buildings",
        itemId: building.id,
        message: `Building "${building.name}" references non-existent town "${building.townId}"`,
        severity: "error",
      });
    }
  }

  // Validate roads reference valid towns
  for (const road of foundation.roads) {
    const [from, to] = road.connectedTowns;
    if (!townIds.has(from)) {
      errors.push({
        layer: "roads",
        itemId: road.id,
        message: `Road references non-existent town "${from}"`,
        severity: "error",
      });
    }
    if (!townIds.has(to)) {
      errors.push({
        layer: "roads",
        itemId: road.id,
        message: `Road references non-existent town "${to}"`,
        severity: "error",
      });
    }
  }

  // Validate NPCs in towns reference valid towns/buildings
  for (const npc of layers.npcs) {
    if (npc.parentContext.type === "town" && npc.parentContext.townId) {
      if (!townIds.has(npc.parentContext.townId)) {
        errors.push({
          layer: "npcs",
          itemId: npc.id,
          message: `NPC "${npc.name}" references non-existent town "${npc.parentContext.townId}"`,
          severity: "error",
        });
      }
    }
    if (npc.parentContext.type === "building" && npc.parentContext.buildingId) {
      if (!buildingIds.has(npc.parentContext.buildingId)) {
        errors.push({
          layer: "npcs",
          itemId: npc.id,
          message: `NPC "${npc.name}" references non-existent building "${npc.parentContext.buildingId}"`,
          severity: "error",
        });
      }
    }
  }

  // Validate quests reference valid NPCs, towns
  for (const quest of layers.quests) {
    // Check quest giver NPC
    if (quest.questGiverNpcId && !npcIds.has(quest.questGiverNpcId)) {
      errors.push({
        layer: "quests",
        itemId: quest.id,
        message: `Quest "${quest.name}" references non-existent quest giver NPC "${quest.questGiverNpcId}"`,
        severity: "error",
      });
    }

    // Check turn-in NPC
    if (quest.turnInNpcId && !npcIds.has(quest.turnInNpcId)) {
      errors.push({
        layer: "quests",
        itemId: quest.id,
        message: `Quest "${quest.name}" references non-existent turn-in NPC "${quest.turnInNpcId}"`,
        severity: "error",
      });
    }

    // Check locations
    for (const location of quest.locations) {
      if (
        location.type === "town" &&
        location.id &&
        !townIds.has(location.id)
      ) {
        errors.push({
          layer: "quests",
          itemId: quest.id,
          message: `Quest "${quest.name}" references non-existent town "${location.id}"`,
          severity: "error",
        });
      }
      if (
        location.type === "building" &&
        location.id &&
        !buildingIds.has(location.id)
      ) {
        errors.push({
          layer: "quests",
          itemId: quest.id,
          message: `Quest "${quest.name}" references non-existent building "${location.id}"`,
          severity: "error",
        });
      }
    }
  }

  // Validate difficulty zones have reasonable bounds
  for (const zone of layers.difficultyZones) {
    if (
      zone.bounds.minX >= zone.bounds.maxX ||
      zone.bounds.minZ >= zone.bounds.maxZ
    ) {
      warnings.push({
        layer: "difficultyZones",
        itemId: zone.id,
        message: `Difficulty zone "${zone.name}" has invalid bounds (min >= max)`,
        severity: "warning",
      });
    }
  }

  // Check for orphaned biome overrides
  for (const [biomeId] of layers.biomeOverrides) {
    if (!biomeIds.has(biomeId)) {
      warnings.push({
        layer: "biomeOverrides",
        itemId: biomeId,
        message: `Biome override references non-existent biome "${biomeId}"`,
        severity: "warning",
      });
    }
  }

  // Check for orphaned town overrides
  for (const [townId] of layers.townOverrides) {
    if (!townIds.has(townId)) {
      warnings.push({
        layer: "townOverrides",
        itemId: townId,
        message: `Town override references non-existent town "${townId}"`,
        severity: "warning",
      });
    }
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
  };
}

export default {
  serializeWorld,
  deserializeWorld,
  exportWorldToJSON,
  importWorldFromJSON,
  downloadWorldAsFile,
  importWorldFromFile,
  validateWorldData,
  validateWorldReferences,
  migrateWorldData,
  generateWorldId,
  generateWorldName,
  createNewWorld,
  calculateWorldStats,
  exportToGameManifest,
  validateGameExport,
  downloadGameManifests,
  copyGameManifestsToClipboard,
  // Autosave
  getAutosaveList,
  autosaveWorld,
  loadAutosave,
  deleteAutosave,
  clearAllAutosaves,
  getMostRecentAutosave,
  // Difficulty zones
  generateDifficultyZones,
  generateWilderness,
  isInWilderness,
  getWildernessLevel,
  // Mob spawns
  generateMobSpawns,
  // Boss generation
  generateBosses,
  // Full export
  exportFullGameManifest,
  downloadAllGameManifests,
  // IndexedDB storage
  saveWorldToIndexedDB,
  loadWorldFromIndexedDB,
  listWorldsInIndexedDB,
  deleteWorldFromIndexedDB,
  saveManifestToIndexedDB,
  loadManifestFromIndexedDB,
  exportAndCacheWorld,
  // Import & merge
  importManifestFromFile,
  mergeManifestIntoWorld,
  importAndMergeFromIndexedDB,
};
