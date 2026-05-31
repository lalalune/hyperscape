/**
 * ManifestService
 * Service for reading and writing game manifest JSON files
 *
 * Handles all manifest operations including:
 * - Listing available manifests
 * - Reading manifest content
 * - Writing/updating manifest content
 * - Validating manifest schemas
 * - Creating backups before writes
 */

import fs from "fs";
import path from "path";

// Manifest metadata describing each manifest file
interface ManifestInfo {
  name: string;
  filename: string;
  description: string;
  category: ManifestCategory;
  editable: boolean;
  schema: ManifestSchemaType;
}

type ManifestCategory =
  | "world"
  | "entities"
  | "items"
  | "progression"
  | "audio"
  | "generated";

type ManifestSchemaType =
  | "biomes"
  | "buildings"
  | "model-bounds"
  | "music"
  | "npcs"
  | "prayers"
  | "world-areas"
  | "world-config"
  | "quests"
  | "skill-unlocks"
  | "stations"
  | "stores"
  | "tier-requirements"
  | "tools"
  | "vegetation"
  | "lod-settings";

// Define all manifest files and their metadata
const MANIFEST_DEFINITIONS: ManifestInfo[] = [
  {
    name: "biomes",
    filename: "biomes.json",
    description:
      "Biome definitions with vegetation layers, mobs, and difficulty settings",
    category: "world",
    editable: true,
    schema: "biomes",
  },
  {
    name: "buildings",
    filename: "buildings.json",
    description: "Town building definitions and placements",
    category: "world",
    editable: true,
    schema: "buildings",
  },
  {
    name: "model-bounds",
    filename: "model-bounds.json",
    description: "Auto-generated model bounding boxes (read-only)",
    category: "generated",
    editable: false,
    schema: "model-bounds",
  },
  {
    name: "music",
    filename: "music.json",
    description: "Music track definitions and categories",
    category: "audio",
    editable: true,
    schema: "music",
  },
  {
    name: "npcs",
    filename: "npcs.json",
    description: "NPC definitions including mobs, dialogue, drops, and stats",
    category: "entities",
    editable: true,
    schema: "npcs",
  },
  {
    name: "prayers",
    filename: "prayers.json",
    description: "Prayer ability definitions",
    category: "progression",
    editable: true,
    schema: "prayers",
  },
  {
    name: "world-areas",
    filename: "world-areas.json",
    description: "World area definitions with NPCs, resources, and stations",
    category: "world",
    editable: true,
    schema: "world-areas",
  },
  {
    name: "world-config",
    filename: "world-config.json",
    description: "World generation settings for terrain, towns, and roads",
    category: "world",
    editable: true,
    schema: "world-config",
  },
  {
    name: "quests",
    filename: "quests.json",
    description: "Quest definitions with stages and rewards",
    category: "progression",
    editable: true,
    schema: "quests",
  },
  {
    name: "skill-unlocks",
    filename: "skill-unlocks.json",
    description: "Skill level unlock definitions",
    category: "progression",
    editable: true,
    schema: "skill-unlocks",
  },
  {
    name: "stations",
    filename: "stations.json",
    description: "Crafting station definitions",
    category: "world",
    editable: true,
    schema: "stations",
  },
  {
    name: "stores",
    filename: "stores.json",
    description: "Store inventory definitions",
    category: "items",
    editable: true,
    schema: "stores",
  },
  {
    name: "tier-requirements",
    filename: "tier-requirements.json",
    description: "Equipment tier level requirements",
    category: "items",
    editable: true,
    schema: "tier-requirements",
  },
  {
    name: "tools",
    filename: "tools.json",
    description: "Tool item definitions",
    category: "items",
    editable: true,
    schema: "tools",
  },
  {
    name: "vegetation",
    filename: "vegetation.json",
    description: "Vegetation asset definitions with LOD settings",
    category: "world",
    editable: true,
    schema: "vegetation",
  },
  {
    name: "lod-settings",
    filename: "lod-settings.json",
    description:
      "LOD distance thresholds, dissolve settings, and vertex budgets",
    category: "world",
    editable: true,
    schema: "lod-settings",
  },
];

export interface ManifestListItem {
  name: string;
  filename: string;
  description: string;
  category: ManifestCategory;
  editable: boolean;
  lastModified: string;
  size: number;
}

export interface ManifestContent {
  name: string;
  filename: string;
  content: unknown;
  lastModified: string;
  size: number;
}

export interface ManifestWriteResult {
  success: boolean;
  name: string;
  filename: string;
  backupPath: string | null;
  timestamp: string;
}

export interface ValidationError {
  path: string;
  message: string;
  value: unknown;
}

export interface ManifestValidationResult {
  valid: boolean;
  errors: ValidationError[];
}

export class ManifestService {
  private manifestsDir: string;
  private backupsDir: string;

  constructor(projectRoot: string) {
    this.manifestsDir = path.join(projectRoot, "assets", "manifests");
    this.backupsDir = path.join(this.manifestsDir, ".backups");
  }

  /**
   * Get the path to a manifest file
   */
  private getManifestPath(filename: string): string {
    return path.join(this.manifestsDir, filename);
  }

  /**
   * Some deploy previews may not have every editable manifest checked in yet.
   * Keep world preview usable with the same defaults the UI already expects.
   */
  private getDefaultManifestContent(name: string): unknown | null {
    if (name !== "world-config") {
      return null;
    }

    return {
      version: 1,
      terrain: {
        seed: 12345,
        tileSize: 100,
        worldSize: 100,
        tileResolution: 64,
        maxHeight: 30,
        waterThreshold: 5.4,
        noise: {
          scale: 0.02,
          octaves: 4,
          persistence: 0.5,
          lacunarity: 2.0,
        },
        detailNoise: {
          scale: 0.08,
          octaves: 3,
          persistence: 0.4,
          lacunarity: 2.2,
        },
        erosion: {
          enabled: true,
          iterations: 3,
          strength: 0.3,
        },
        island: {
          enabled: true,
          falloffTiles: 8,
          coastlineNoise: {
            scale: 0.02,
            amount: 0.1,
          },
          ponds: {
            enabled: true,
            count: 5,
            sizeRange: [3, 8],
            depth: 0.15,
          },
        },
        shoreline: {
          slopeMultiplier: 2.5,
          colorBlendDistance: 3.0,
        },
      },
      biomes: {
        placementSeed: 54321,
        cellSize: 200,
        jitterAmount: 0.4,
        boundaryNoiseScale: 0.003,
        blendRadius: 50,
        heightCoupling: {
          enabled: true,
          mountainThreshold: 0.65,
          valleyThreshold: 0.25,
        },
        distribution: {
          plains: 0.25,
          forest: 0.25,
          valley: 0.15,
          mountains: 0.1,
          desert: 0.08,
          swamp: 0.07,
          tundra: 0.05,
          lakes: 0.05,
        },
      },
      towns: {
        seed: 67890,
        enabled: true,
        count: 25,
        worldSize: 10000,
        minTownSpacing: 800,
        waterThreshold: 5.4,
        landmarks: {
          fencesEnabled: true,
          fenceDensity: 0.7,
          fencePostHeight: 1.2,
          lamppostsInVillages: true,
          lamppostSpacing: 15,
          marketStallsEnabled: true,
          decorationsEnabled: true,
        },
        sizes: {
          town: {
            count: 2,
            safeZoneRadius: 80,
            buildingCount: [8, 12],
          },
          village: {
            count: 3,
            safeZoneRadius: 60,
            buildingCount: [4, 6],
          },
          hamlet: {
            count: 3,
            safeZoneRadius: 40,
            buildingCount: [2, 3],
          },
        },
        preferredBiomes: ["plains", "forest", "valley"],
        avoidBiomes: ["swamp", "tundra", "desert"],
      },
      roads: {
        enabled: true,
        width: 4,
        pathStepSize: 20,
        smoothingIterations: 2,
        extraConnectionsRatio: 0.25,
        pathfinding: {
          costSlopeMultiplier: 5.0,
          costWaterPenalty: 1000,
          heuristicWeight: 2.5,
        },
      },
    };
  }

  /**
   * List all available manifests with metadata
   */
  async listManifests(): Promise<ManifestListItem[]> {
    const results: ManifestListItem[] = [];

    for (const def of MANIFEST_DEFINITIONS) {
      const filePath = this.getManifestPath(def.filename);

      let lastModified = new Date().toISOString();
      let size = 0;

      const exists = await Bun.file(filePath).exists();
      if (exists) {
        const stat = await fs.promises.stat(filePath);
        lastModified = stat.mtime.toISOString();
        size = stat.size;
      }

      results.push({
        name: def.name,
        filename: def.filename,
        description: def.description,
        category: def.category,
        editable: def.editable,
        lastModified,
        size,
      });
    }

    return results;
  }

  /**
   * Get manifest info by name
   */
  getManifestInfo(name: string): ManifestInfo | null {
    return MANIFEST_DEFINITIONS.find((def) => def.name === name) || null;
  }

  /**
   * Read a manifest file content
   */
  async readManifest(name: string): Promise<ManifestContent> {
    const info = this.getManifestInfo(name);
    if (!info) {
      throw new Error(`Unknown manifest: ${name}`);
    }

    const filePath = this.getManifestPath(info.filename);
    const file = Bun.file(filePath);

    if (!(await file.exists())) {
      const defaultContent = this.getDefaultManifestContent(name);
      if (defaultContent !== null) {
        return {
          name: info.name,
          filename: info.filename,
          content: defaultContent,
          lastModified: new Date(0).toISOString(),
          size: JSON.stringify(defaultContent).length,
        };
      }

      throw new Error(`Manifest file not found: ${info.filename}`);
    }

    const stat = await fs.promises.stat(filePath);
    const content = await file.json();

    return {
      name: info.name,
      filename: info.filename,
      content,
      lastModified: stat.mtime.toISOString(),
      size: stat.size,
    };
  }

  /**
   * Create a backup of a manifest file before writing
   */
  private async createBackup(filename: string): Promise<string | null> {
    const sourcePath = this.getManifestPath(filename);
    const sourceFile = Bun.file(sourcePath);

    if (!(await sourceFile.exists())) {
      return null;
    }

    // Ensure backups directory exists
    await fs.promises.mkdir(this.backupsDir, { recursive: true });

    // Create backup filename with timestamp
    const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
    const backupFilename = `${filename}.${timestamp}.backup`;
    const backupPath = path.join(this.backupsDir, backupFilename);

    // Copy file to backup
    const content = await sourceFile.text();
    await Bun.write(backupPath, content);

    // Clean up old backups (keep last 10 per manifest)
    await this.cleanupOldBackups(filename);

    return backupPath;
  }

  /**
   * Remove old backups, keeping only the most recent ones
   */
  private async cleanupOldBackups(filename: string): Promise<void> {
    const maxBackups = 10;

    const backupsExist = await Bun.file(this.backupsDir).exists();
    if (!backupsExist) {
      return;
    }

    const entries = await fs.promises.readdir(this.backupsDir);
    const backupPattern = new RegExp(`^${filename}\\..*\\.backup$`);
    const matchingBackups = entries
      .filter((entry) => backupPattern.test(entry))
      .sort()
      .reverse();

    // Remove backups beyond the limit
    const toRemove = matchingBackups.slice(maxBackups);
    for (const backupFile of toRemove) {
      const backupPath = path.join(this.backupsDir, backupFile);
      await fs.promises.unlink(backupPath);
    }
  }

  /**
   * Validate manifest content against its schema
   */
  validateManifest(name: string, content: unknown): ManifestValidationResult {
    const info = this.getManifestInfo(name);
    if (!info) {
      return {
        valid: false,
        errors: [
          { path: "", message: `Unknown manifest: ${name}`, value: null },
        ],
      };
    }

    const errors: ValidationError[] = [];

    // Basic structure validation
    if (content === null || content === undefined) {
      errors.push({
        path: "",
        message: "Content cannot be null or undefined",
        value: content,
      });
      return { valid: false, errors };
    }

    // Schema-specific validation
    switch (info.schema) {
      case "biomes":
        this.validateBiomesSchema(content, errors);
        break;
      case "buildings":
        this.validateBuildingsSchema(content, errors);
        break;
      case "music":
        this.validateMusicSchema(content, errors);
        break;
      case "npcs":
        this.validateNpcsSchema(content, errors);
        break;
      case "prayers":
        this.validatePrayersSchema(content, errors);
        break;
      case "world-areas":
        this.validateWorldAreasSchema(content, errors);
        break;
      case "quests":
        this.validateQuestsSchema(content, errors);
        break;
      case "skill-unlocks":
        this.validateSkillUnlocksSchema(content, errors);
        break;
      case "stations":
        this.validateStationsSchema(content, errors);
        break;
      case "stores":
        this.validateStoresSchema(content, errors);
        break;
      case "tier-requirements":
        this.validateTierRequirementsSchema(content, errors);
        break;
      case "tools":
        this.validateToolsSchema(content, errors);
        break;
      case "vegetation":
        this.validateVegetationSchema(content, errors);
        break;
      case "lod-settings":
        this.validateLODSettingsSchema(content, errors);
        break;
      case "model-bounds":
        // Auto-generated, no validation needed
        break;
    }

    return { valid: errors.length === 0, errors };
  }

  // Schema validation helpers

  private validateBiomesSchema(
    content: unknown,
    errors: ValidationError[],
  ): void {
    if (!Array.isArray(content)) {
      errors.push({
        path: "",
        message: "Biomes must be an array",
        value: content,
      });
      return;
    }

    for (let i = 0; i < content.length; i++) {
      const biome = content[i] as Record<string, unknown>;
      if (!biome.id || typeof biome.id !== "string") {
        errors.push({
          path: `[${i}].id`,
          message: "Biome must have a string id",
          value: biome.id,
        });
      }
      if (!biome.name || typeof biome.name !== "string") {
        errors.push({
          path: `[${i}].name`,
          message: "Biome must have a string name",
          value: biome.name,
        });
      }
      if (
        biome.difficultyLevel !== undefined &&
        typeof biome.difficultyLevel !== "number"
      ) {
        errors.push({
          path: `[${i}].difficultyLevel`,
          message: "difficultyLevel must be a number",
          value: biome.difficultyLevel,
        });
      }
    }
  }

  private validateBuildingsSchema(
    content: unknown,
    errors: ValidationError[],
  ): void {
    if (typeof content !== "object" || content === null) {
      errors.push({
        path: "",
        message: "Buildings must be an object",
        value: content,
      });
      return;
    }

    const buildings = content as Record<string, unknown>;
    if (
      buildings.version !== undefined &&
      typeof buildings.version !== "number"
    ) {
      errors.push({
        path: "version",
        message: "version must be a number",
        value: buildings.version,
      });
    }
  }

  private validateMusicSchema(
    content: unknown,
    errors: ValidationError[],
  ): void {
    if (!Array.isArray(content)) {
      errors.push({
        path: "",
        message: "Music must be an array",
        value: content,
      });
      return;
    }

    for (let i = 0; i < content.length; i++) {
      const track = content[i] as Record<string, unknown>;
      if (!track.id || typeof track.id !== "string") {
        errors.push({
          path: `[${i}].id`,
          message: "Track must have a string id",
          value: track.id,
        });
      }
      if (!track.name || typeof track.name !== "string") {
        errors.push({
          path: `[${i}].name`,
          message: "Track must have a string name",
          value: track.name,
        });
      }
      if (!track.path || typeof track.path !== "string") {
        errors.push({
          path: `[${i}].path`,
          message: "Track must have a string path",
          value: track.path,
        });
      }
    }
  }

  private validateNpcsSchema(
    content: unknown,
    errors: ValidationError[],
  ): void {
    if (!Array.isArray(content)) {
      errors.push({
        path: "",
        message: "NPCs must be an array",
        value: content,
      });
      return;
    }

    for (let i = 0; i < content.length; i++) {
      const npc = content[i] as Record<string, unknown>;
      if (!npc.id || typeof npc.id !== "string") {
        errors.push({
          path: `[${i}].id`,
          message: "NPC must have a string id",
          value: npc.id,
        });
      }
      if (!npc.name || typeof npc.name !== "string") {
        errors.push({
          path: `[${i}].name`,
          message: "NPC must have a string name",
          value: npc.name,
        });
      }
    }
  }

  private validatePrayersSchema(
    content: unknown,
    errors: ValidationError[],
  ): void {
    if (typeof content !== "object" || content === null) {
      errors.push({
        path: "",
        message: "Prayers must be an object",
        value: content,
      });
      return;
    }

    const prayers = content as Record<string, unknown>;
    if (!Array.isArray(prayers.prayers)) {
      errors.push({
        path: "prayers",
        message: "prayers.prayers must be an array",
        value: prayers.prayers,
      });
    }
  }

  private validateWorldAreasSchema(
    content: unknown,
    errors: ValidationError[],
  ): void {
    if (typeof content !== "object" || content === null) {
      errors.push({
        path: "",
        message: "World areas must be an object",
        value: content,
      });
      return;
    }

    const areas = content as Record<string, unknown>;
    if (areas.starterTowns && typeof areas.starterTowns !== "object") {
      errors.push({
        path: "starterTowns",
        message: "starterTowns must be an object",
        value: areas.starterTowns,
      });
    }
  }

  private validateQuestsSchema(
    content: unknown,
    errors: ValidationError[],
  ): void {
    if (typeof content !== "object" || content === null) {
      errors.push({
        path: "",
        message: "Quests must be an object",
        value: content,
      });
      return;
    }

    const quests = content as Record<string, unknown>;
    for (const [questId, quest] of Object.entries(quests)) {
      const q = quest as Record<string, unknown>;
      if (!q.id || typeof q.id !== "string") {
        errors.push({
          path: `${questId}.id`,
          message: "Quest must have a string id",
          value: q.id,
        });
      }
      if (!q.name || typeof q.name !== "string") {
        errors.push({
          path: `${questId}.name`,
          message: "Quest must have a string name",
          value: q.name,
        });
      }
    }
  }

  private validateSkillUnlocksSchema(
    content: unknown,
    errors: ValidationError[],
  ): void {
    if (typeof content !== "object" || content === null) {
      errors.push({
        path: "",
        message: "Skill unlocks must be an object",
        value: content,
      });
      return;
    }

    const unlocks = content as Record<string, unknown>;
    if (!unlocks.skills || typeof unlocks.skills !== "object") {
      errors.push({
        path: "skills",
        message: "Must have a skills object",
        value: unlocks.skills,
      });
    }
  }

  private validateStationsSchema(
    content: unknown,
    errors: ValidationError[],
  ): void {
    if (typeof content !== "object" || content === null) {
      errors.push({
        path: "",
        message: "Stations must be an object",
        value: content,
      });
      return;
    }

    const stations = content as Record<string, unknown>;
    if (!Array.isArray(stations.stations)) {
      errors.push({
        path: "stations",
        message: "stations.stations must be an array",
        value: stations.stations,
      });
    }
  }

  private validateStoresSchema(
    content: unknown,
    errors: ValidationError[],
  ): void {
    if (!Array.isArray(content)) {
      errors.push({
        path: "",
        message: "Stores must be an array",
        value: content,
      });
      return;
    }

    for (let i = 0; i < content.length; i++) {
      const store = content[i] as Record<string, unknown>;
      if (!store.id || typeof store.id !== "string") {
        errors.push({
          path: `[${i}].id`,
          message: "Store must have a string id",
          value: store.id,
        });
      }
      if (!store.name || typeof store.name !== "string") {
        errors.push({
          path: `[${i}].name`,
          message: "Store must have a string name",
          value: store.name,
        });
      }
    }
  }

  private validateTierRequirementsSchema(
    content: unknown,
    errors: ValidationError[],
  ): void {
    if (typeof content !== "object" || content === null) {
      errors.push({
        path: "",
        message: "Tier requirements must be an object",
        value: content,
      });
      return;
    }

    const tiers = content as Record<string, unknown>;
    const requiredKeys = ["melee", "tools"];
    for (const key of requiredKeys) {
      if (!tiers[key] || typeof tiers[key] !== "object") {
        errors.push({
          path: key,
          message: `Missing or invalid ${key} tier requirements`,
          value: tiers[key],
        });
      }
    }
  }

  private validateToolsSchema(
    content: unknown,
    errors: ValidationError[],
  ): void {
    if (!Array.isArray(content)) {
      errors.push({
        path: "",
        message: "Tools must be an array",
        value: content,
      });
      return;
    }

    for (let i = 0; i < content.length; i++) {
      const tool = content[i] as Record<string, unknown>;
      if (!tool.itemId || typeof tool.itemId !== "string") {
        errors.push({
          path: `[${i}].itemId`,
          message: "Tool must have a string itemId",
          value: tool.itemId,
        });
      }
      if (!tool.skill || typeof tool.skill !== "string") {
        errors.push({
          path: `[${i}].skill`,
          message: "Tool must have a string skill",
          value: tool.skill,
        });
      }
    }
  }

  private validateVegetationSchema(
    content: unknown,
    errors: ValidationError[],
  ): void {
    if (typeof content !== "object" || content === null) {
      errors.push({
        path: "",
        message: "Vegetation must be an object",
        value: content,
      });
      return;
    }

    const veg = content as Record<string, unknown>;
    if (!Array.isArray(veg.assets)) {
      errors.push({
        path: "assets",
        message: "vegetation.assets must be an array",
        value: veg.assets,
      });
      return;
    }

    for (let i = 0; i < (veg.assets as unknown[]).length; i++) {
      const asset = (veg.assets as Record<string, unknown>[])[i];
      if (!asset.id || typeof asset.id !== "string") {
        errors.push({
          path: `assets[${i}].id`,
          message: "Asset must have a string id",
          value: asset.id,
        });
      }
      if (!asset.model || typeof asset.model !== "string") {
        errors.push({
          path: `assets[${i}].model`,
          message: "Asset must have a string model path",
          value: asset.model,
        });
      }
    }
  }

  private validateLODSettingsSchema(
    content: unknown,
    errors: ValidationError[],
  ): void {
    if (typeof content !== "object" || content === null) {
      errors.push({
        path: "",
        message: "LOD settings must be an object",
        value: content,
      });
      return;
    }

    const settings = content as Record<string, unknown>;

    if (
      !settings.distanceThresholds ||
      typeof settings.distanceThresholds !== "object"
    ) {
      errors.push({
        path: "distanceThresholds",
        message: "distanceThresholds must be an object",
        value: settings.distanceThresholds,
      });
    }

    if (!settings.dissolve || typeof settings.dissolve !== "object") {
      errors.push({
        path: "dissolve",
        message: "dissolve must be an object",
        value: settings.dissolve,
      });
    } else {
      const dissolve = settings.dissolve as Record<string, unknown>;
      if (typeof dissolve.closeRangeStart !== "number") {
        errors.push({
          path: "dissolve.closeRangeStart",
          message: "closeRangeStart must be a number",
          value: dissolve.closeRangeStart,
        });
      }
      if (typeof dissolve.closeRangeEnd !== "number") {
        errors.push({
          path: "dissolve.closeRangeEnd",
          message: "closeRangeEnd must be a number",
          value: dissolve.closeRangeEnd,
        });
      }
    }

    if (!settings.vertexBudgets || typeof settings.vertexBudgets !== "object") {
      errors.push({
        path: "vertexBudgets",
        message: "vertexBudgets must be an object",
        value: settings.vertexBudgets,
      });
    }
  }

  /**
   * Write manifest content with backup
   */
  async writeManifest(
    name: string,
    content: unknown,
  ): Promise<ManifestWriteResult> {
    const info = this.getManifestInfo(name);
    if (!info) {
      throw new Error(`Unknown manifest: ${name}`);
    }

    if (!info.editable) {
      throw new Error(`Manifest ${name} is not editable`);
    }

    // Validate content
    const validation = this.validateManifest(name, content);
    if (!validation.valid) {
      const errorMessages = validation.errors
        .map((e) => `${e.path}: ${e.message}`)
        .join("; ");
      throw new Error(`Validation failed: ${errorMessages}`);
    }

    const filePath = this.getManifestPath(info.filename);

    // Create backup before writing
    const backupPath = await this.createBackup(info.filename);

    // Write the new content
    const jsonContent = JSON.stringify(content, null, 2);
    await Bun.write(filePath, jsonContent);

    return {
      success: true,
      name: info.name,
      filename: info.filename,
      backupPath,
      timestamp: new Date().toISOString(),
    };
  }

  /**
   * Get list of backups for a manifest
   */
  async listBackups(name: string): Promise<string[]> {
    const info = this.getManifestInfo(name);
    if (!info) {
      throw new Error(`Unknown manifest: ${name}`);
    }

    const backupsExist = await Bun.file(this.backupsDir).exists();
    if (!backupsExist) {
      return [];
    }

    const entries = await fs.promises.readdir(this.backupsDir);
    const backupPattern = new RegExp(`^${info.filename}\\..*\\.backup$`);

    return entries
      .filter((entry) => backupPattern.test(entry))
      .sort()
      .reverse();
  }

  /**
   * Restore a manifest from a backup
   */
  async restoreFromBackup(
    name: string,
    backupFilename: string,
  ): Promise<ManifestWriteResult> {
    const info = this.getManifestInfo(name);
    if (!info) {
      throw new Error(`Unknown manifest: ${name}`);
    }

    if (!info.editable) {
      throw new Error(`Manifest ${name} is not editable`);
    }

    const backupPath = path.join(this.backupsDir, backupFilename);
    const backupFile = Bun.file(backupPath);

    if (!(await backupFile.exists())) {
      throw new Error(`Backup file not found: ${backupFilename}`);
    }

    // Read backup content
    const backupContent = await backupFile.text();

    // Create a new backup of current state
    const currentBackupPath = await this.createBackup(info.filename);

    // Write the restored content
    const filePath = this.getManifestPath(info.filename);
    await Bun.write(filePath, backupContent);

    return {
      success: true,
      name: info.name,
      filename: info.filename,
      backupPath: currentBackupPath,
      timestamp: new Date().toISOString(),
    };
  }
}
