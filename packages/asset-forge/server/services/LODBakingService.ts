/**
 * LOD Baking Service
 * Service for generating Level of Detail (LOD) models for vegetation and resources
 *
 * Supports multiple LOD levels:
 * - LOD0: Original high-detail mesh
 * - LOD1: Medium distance mesh (~30% of LOD0)
 * - LOD2: Far distance mesh (~10% of LOD0)
 * - Imposter: Billboard/sprite for extreme distances
 *
 * Uses seam-aware decimation for high-quality results that preserve UV boundaries.
 * Supports both TypeScript-based decimation (in-process) and Blender-based decimation.
 */

import { spawn, type ChildProcess } from "child_process";
import fs from "fs";
import path from "path";
import { glob } from "glob";
import {
  GLBDecimationService,
  type GLBDecimationResult,
} from "./GLBDecimationService";
import type {
  LODLevel,
  LODBundle,
  LODVariant,
  AssetLODSettings,
  CategoryLODDefaults,
  LODBakeAssetResult,
  LODBakeJob,
  LODBakeJobStatus,
  BatchLODBakeRequest,
} from "../../src/types/LODBundle";
import {
  DEFAULT_CATEGORY_LOD_SETTINGS,
  getCategoryDefaults,
  getMergedLODSettings,
} from "../../src/types/LODBundle";

// Re-export types
export type {
  LODLevel,
  LODBundle,
  LODVariant,
  AssetLODSettings,
  CategoryLODDefaults,
  LODBakeAssetResult,
  LODBakeJob,
  LODBakeJobStatus,
};

// Dissolve/fade settings
interface DissolveSettings {
  closeRangeStart: number;
  closeRangeEnd: number;
  transitionDuration: number;
}

const DEFAULT_DISSOLVE_SETTINGS: DissolveSettings = {
  closeRangeStart: 5,
  closeRangeEnd: 10,
  transitionDuration: 0.3,
};

// Extended LODBakeJob with process handle (internal only)
interface InternalLODBakeJob extends LODBakeJob {
  process?: ChildProcess;
}

// Full LOD settings structure
export interface LODSettingsConfig {
  distanceThresholds: Record<
    string,
    {
      lod1?: number;
      lod2?: number;
      imposter: number;
      fadeOut: number;
    }
  >;
  dissolve: DissolveSettings;
  vertexBudgets: Record<
    string,
    {
      lod0: number;
      lod1: number;
      lod2: number;
    }
  >;
}

export class LODBakingService {
  private projectRoot: string;
  private scriptsDir: string;
  private assetsDir: string;
  private manifestsDir: string;
  private jobs: Map<string, InternalLODBakeJob> = new Map();
  private settingsPath: string;
  private cachedSettings: LODSettingsConfig | null = null;
  private lodBundlesPath: string;
  private cachedBundles: Map<string, LODBundle> = new Map();
  private glbDecimationService: GLBDecimationService;

  constructor(projectRoot: string) {
    this.projectRoot = projectRoot;
    this.scriptsDir = path.join(projectRoot, "scripts");
    this.assetsDir = path.join(projectRoot, "assets");
    this.manifestsDir = path.join(this.assetsDir, "manifests");
    this.settingsPath = path.join(this.manifestsDir, "lod-settings.json");
    this.lodBundlesPath = path.join(this.manifestsDir, "lod-bundles.json");
    this.glbDecimationService = new GLBDecimationService();
  }

  /**
   * Get LOD settings from the manifest file
   */
  async getSettings(): Promise<LODSettingsConfig> {
    // Check cache first
    if (this.cachedSettings) {
      return this.cachedSettings;
    }

    const settingsFile = Bun.file(this.settingsPath);

    if (await settingsFile.exists()) {
      const content = (await settingsFile.json()) as {
        distanceThresholds: LODSettingsConfig["distanceThresholds"];
        dissolve: DissolveSettings;
        vertexBudgets: LODSettingsConfig["vertexBudgets"];
      };

      this.cachedSettings = {
        distanceThresholds: content.distanceThresholds,
        dissolve: content.dissolve,
        vertexBudgets: content.vertexBudgets,
      };

      return this.cachedSettings;
    }

    // Return default settings from category defaults
    const distanceThresholds: LODSettingsConfig["distanceThresholds"] = {};
    const vertexBudgets: LODSettingsConfig["vertexBudgets"] = {};

    for (const [category, settings] of Object.entries(
      DEFAULT_CATEGORY_LOD_SETTINGS,
    )) {
      distanceThresholds[category] = {
        lod1: settings.lod1.enabled ? settings.lod1.distance : undefined,
        lod2: settings.lod2.enabled ? settings.lod2.distance : undefined,
        imposter: settings.imposter.activationDistance,
        fadeOut: settings.fadeOutDistance,
      };
      vertexBudgets[category] = {
        lod0: 10000, // Default max vertices for LOD0
        lod1: Math.max(settings.lod1.minVertices, 500),
        lod2: Math.max(settings.lod2.minVertices, 100),
      };
    }

    this.cachedSettings = {
      distanceThresholds,
      dissolve: DEFAULT_DISSOLVE_SETTINGS,
      vertexBudgets,
    };

    return this.cachedSettings;
  }

  /**
   * Get LOD bundle for a specific asset
   */
  async getLODBundle(assetId: string): Promise<LODBundle | null> {
    // Check cache
    if (this.cachedBundles.has(assetId)) {
      return this.cachedBundles.get(assetId)!;
    }

    // Load from file
    const bundlesFile = Bun.file(this.lodBundlesPath);
    if (await bundlesFile.exists()) {
      const bundles = (await bundlesFile.json()) as Record<string, LODBundle>;
      if (bundles[assetId]) {
        this.cachedBundles.set(assetId, bundles[assetId]);
        return bundles[assetId];
      }
    }

    return null;
  }

  /**
   * Save LOD bundle for an asset
   */
  async saveLODBundle(bundle: LODBundle): Promise<void> {
    const bundlesFile = Bun.file(this.lodBundlesPath);
    let bundles: Record<string, LODBundle> = {};

    if (await bundlesFile.exists()) {
      bundles = (await bundlesFile.json()) as Record<string, LODBundle>;
    }

    bundles[bundle.assetId] = bundle;
    this.cachedBundles.set(bundle.assetId, bundle);

    await Bun.write(this.lodBundlesPath, JSON.stringify(bundles, null, 2));
  }

  /**
   * Get all LOD bundles
   */
  async getAllBundles(): Promise<LODBundle[]> {
    const bundlesFile = Bun.file(this.lodBundlesPath);
    if (await bundlesFile.exists()) {
      const bundles = (await bundlesFile.json()) as Record<string, LODBundle>;
      return Object.values(bundles);
    }
    return [];
  }

  private async extractGLBStats(
    filePath: string,
  ): Promise<{ vertices: number; faces: number }> {
    try {
      const buffer = Buffer.from(await Bun.file(filePath).arrayBuffer());

      const magic = buffer.readUInt32LE(0);
      if (magic !== 0x46546c67) return { vertices: 0, faces: 0 }; // Not GLB

      if (buffer.length < buffer.readUInt32LE(8))
        return { vertices: 0, faces: 0 }; // Truncated

      const jsonChunkLength = buffer.readUInt32LE(12);
      if (buffer.readUInt32LE(16) !== 0x4e4f534a)
        return { vertices: 0, faces: 0 }; // No JSON chunk

      const gltf = JSON.parse(
        buffer.slice(20, 20 + jsonChunkLength).toString("utf-8"),
      ) as {
        accessors?: Array<{ count: number }>;
        meshes?: Array<{
          primitives: Array<{
            attributes: { POSITION?: number };
            indices?: number;
          }>;
        }>;
      };

      let vertices = 0,
        faces = 0;

      if (gltf.meshes && gltf.accessors) {
        for (const mesh of gltf.meshes) {
          for (const prim of mesh.primitives) {
            if (prim.attributes.POSITION !== undefined) {
              vertices += gltf.accessors[prim.attributes.POSITION]?.count ?? 0;
            }
            if (prim.indices !== undefined) {
              faces += Math.floor(
                (gltf.accessors[prim.indices]?.count ?? 0) / 3,
              );
            } else if (prim.attributes.POSITION !== undefined) {
              faces += Math.floor(
                (gltf.accessors[prim.attributes.POSITION]?.count ?? 0) / 3,
              );
            }
          }
        }
      }

      return { vertices, faces };
    } catch {
      return { vertices: 0, faces: 0 };
    }
  }

  /**
   * Create or update LOD bundle for an asset
   */
  async createOrUpdateBundle(
    assetId: string,
    name: string,
    category: string,
    basePath: string,
    settings?: AssetLODSettings,
  ): Promise<LODBundle> {
    const existingBundle = await this.getLODBundle(assetId);
    const categoryDefaults = getCategoryDefaults(category);

    // Get file stats for base model
    const baseFilePath = path.isAbsolute(basePath)
      ? basePath
      : path.join(this.projectRoot, basePath);

    let baseStats = { vertices: 0, faces: 0, fileSize: 0 };
    if (await Bun.file(baseFilePath).exists()) {
      const stat = await fs.promises.stat(baseFilePath);
      baseStats.fileSize = stat.size;
      // Extract vertex/face counts from the GLB file
      const glbStats = await this.extractGLBStats(baseFilePath);
      baseStats.vertices = glbStats.vertices;
      baseStats.faces = glbStats.faces;
    }

    // Check which LOD files exist
    const variants: LODVariant[] = [];
    const missingLevels: LODLevel[] = [];

    // LOD0 (base)
    if (await Bun.file(baseFilePath).exists()) {
      variants.push({
        level: "lod0",
        modelPath: basePath,
        vertices: baseStats.vertices,
        faces: baseStats.faces,
        fileSize: baseStats.fileSize,
        distanceThreshold: 0,
        method: "original",
      });
    } else {
      missingLevels.push("lod0");
    }

    // LOD1
    const lod1Path = basePath.replace(/\.glb$/, "_lod1.glb");
    const lod1FilePath = path.isAbsolute(lod1Path)
      ? lod1Path
      : path.join(this.projectRoot, lod1Path);

    if (await Bun.file(lod1FilePath).exists()) {
      const stat = await fs.promises.stat(lod1FilePath);
      const lod1Stats = await this.extractGLBStats(lod1FilePath);
      variants.push({
        level: "lod1",
        modelPath: lod1Path,
        vertices: lod1Stats.vertices,
        faces: lod1Stats.faces,
        fileSize: stat.size,
        distanceThreshold: categoryDefaults.lod1.distance,
        targetPercent: categoryDefaults.lod1.targetPercent,
        method: "decimated",
      });
    } else if (categoryDefaults.lod1.enabled) {
      missingLevels.push("lod1");
    }

    // LOD2
    const lod2Path = basePath.replace(/\.glb$/, "_lod2.glb");
    const lod2FilePath = path.isAbsolute(lod2Path)
      ? lod2Path
      : path.join(this.projectRoot, lod2Path);

    if (await Bun.file(lod2FilePath).exists()) {
      const stat = await fs.promises.stat(lod2FilePath);
      const lod2Stats = await this.extractGLBStats(lod2FilePath);
      variants.push({
        level: "lod2",
        modelPath: lod2Path,
        vertices: lod2Stats.vertices,
        faces: lod2Stats.faces,
        fileSize: stat.size,
        distanceThreshold: categoryDefaults.lod2.distance,
        targetPercent: categoryDefaults.lod2.targetPercent,
        method: "decimated",
      });
    } else if (categoryDefaults.lod2.enabled) {
      missingLevels.push("lod2");
    }

    // Imposter
    const imposterPath = basePath.replace(/\.glb$/, "_imposter.png");
    const imposterFilePath = path.isAbsolute(imposterPath)
      ? imposterPath
      : path.join(this.projectRoot, imposterPath);

    if (await Bun.file(imposterFilePath).exists()) {
      const stat = await fs.promises.stat(imposterFilePath);
      variants.push({
        level: "imposter",
        modelPath: imposterPath,
        vertices: 4, // Billboard quad
        faces: 2,
        fileSize: stat.size,
        distanceThreshold: categoryDefaults.imposter.activationDistance,
        method: "imposter",
      });
    } else if (categoryDefaults.imposter.enabled) {
      missingLevels.push("imposter");
    }

    const bundle: LODBundle = {
      assetId,
      name,
      category,
      variants,
      settings: settings || existingBundle?.settings || {},
      metadata: {
        totalSize: variants.reduce((sum, v) => sum + v.fileSize, 0),
        isComplete: missingLevels.length === 0,
        missingLevels,
        lastUpdated: new Date().toISOString(),
      },
    };

    await this.saveLODBundle(bundle);
    return bundle;
  }

  /**
   * Clear cached settings (call when settings file is updated)
   */
  clearSettingsCache(): void {
    this.cachedSettings = null;
  }

  /**
   * Save LOD settings
   */
  async saveSettings(settings: LODSettingsConfig): Promise<void> {
    await Bun.write(this.settingsPath, JSON.stringify(settings, null, 2));
  }

  /**
   * Find Blender executable
   */
  private findBlender(): string {
    // Check environment variable first
    if (process.env.BLENDER_PATH) {
      return process.env.BLENDER_PATH;
    }

    // Check common locations
    const commonPaths = [
      "/Applications/Blender.app/Contents/MacOS/Blender",
      "/usr/local/bin/blender",
      "/usr/bin/blender",
      "blender", // Rely on PATH
    ];

    for (const blenderPath of commonPaths) {
      if (blenderPath === "blender") {
        // Will be found via PATH if available
        return blenderPath;
      }
      if (fs.existsSync(blenderPath)) {
        return blenderPath;
      }
    }

    return "blender"; // Default, will fail with clear error if not found
  }

  /**
   * Find assets matching patterns
   */
  async findAssets(
    assetPaths?: string[],
    categories?: string[],
  ): Promise<string[]> {
    if (assetPaths && assetPaths.length > 0) {
      // Use provided paths
      const absolutePaths: string[] = [];
      for (const p of assetPaths) {
        const fullPath = path.isAbsolute(p)
          ? p
          : path.join(this.projectRoot, p);
        if (await Bun.file(fullPath).exists()) {
          absolutePaths.push(fullPath);
        }
      }
      return absolutePaths;
    }

    // Find all GLB files in asset directories
    // Note: vegetation assets are in packages/server/world/assets/vegetation
    // Rocks are now procedurally generated via @hyperforge/procgen/rock
    const patterns = [
      "packages/server/world/assets/vegetation/**/*.glb",
      "assets/trees/**/*.glb",
      "assets/grass/**/*.glb",
    ];

    const allFiles: string[] = [];

    for (const pattern of patterns) {
      const files = await glob(pattern, {
        cwd: this.projectRoot,
        ignore: ["**/*_lod1.glb", "**/*_lod.glb"],
      });

      for (const file of files) {
        const fullPath = path.join(this.projectRoot, file);

        // Filter by category if specified
        if (categories && categories.length > 0) {
          const category = this.inferCategory(fullPath);
          if (!categories.includes(category)) {
            continue;
          }
        }

        allFiles.push(fullPath);
      }
    }

    return allFiles;
  }

  /**
   * Discover all available assets with their LOD status
   * Returns both assets with existing bundles AND assets that could have LODs generated
   */
  async discoverAssets(categories?: string[]): Promise<
    Array<{
      assetId: string;
      name: string;
      category: string;
      path: string;
      hasBundle: boolean;
      isComplete: boolean;
      missingLevels: string[];
      variants: Array<{ level: string; vertices: number; fileSize: number }>;
    }>
  > {
    // Find all assets on disk
    const assetPaths = await this.findAssets(undefined, categories);

    // Load all existing bundles
    const allBundles = await this.getAllBundles();
    const bundleMap = new Map(allBundles.map((b) => [b.assetId, b]));

    const results = [];

    for (const assetPath of assetPaths) {
      const assetId = path.basename(assetPath, ".glb");
      const category = this.inferCategory(assetPath);
      const name = assetId.replace(/_/g, " ");
      const relativePath = path.relative(this.projectRoot, assetPath);

      const existingBundle = bundleMap.get(assetId);

      if (existingBundle) {
        results.push({
          assetId,
          name: existingBundle.name,
          category: existingBundle.category,
          path: relativePath,
          hasBundle: true,
          isComplete: existingBundle.metadata.isComplete,
          missingLevels: existingBundle.metadata.missingLevels,
          variants: existingBundle.variants.map((v) => ({
            level: v.level,
            vertices: v.vertices,
            fileSize: v.fileSize,
          })),
        });
      } else {
        // Asset has no bundle yet - determine what LODs could be generated
        const categoryDefaults = getCategoryDefaults(category);
        const missingLevels: string[] = [];

        if (categoryDefaults.lod1.enabled) missingLevels.push("lod1");
        if (categoryDefaults.lod2.enabled) missingLevels.push("lod2");
        if (categoryDefaults.imposter.enabled) missingLevels.push("imposter");

        // Try to get original file stats
        let lod0Stats = { vertices: 0, fileSize: 0 };
        try {
          const stat = await fs.promises.stat(assetPath);
          const glbStats = await this.extractGLBStats(assetPath);
          lod0Stats = {
            vertices: glbStats.vertices,
            fileSize: stat.size,
          };
        } catch {
          // Ignore stats errors
        }

        results.push({
          assetId,
          name,
          category,
          path: relativePath,
          hasBundle: false,
          isComplete: false,
          missingLevels,
          variants: [
            {
              level: "lod0",
              vertices: lod0Stats.vertices,
              fileSize: lod0Stats.fileSize,
            },
          ],
        });
      }
    }

    return results;
  }

  /**
   * Infer asset category from file path
   */
  private inferCategory(filePath: string): string {
    const pathLower = filePath.toLowerCase();

    if (pathLower.includes("tree")) {
      if (pathLower.includes("fallen")) {
        return "fallen";
      }
      return "tree";
    }
    if (pathLower.includes("bush")) return "bush";
    if (pathLower.includes("rock")) return "rock";
    if (pathLower.includes("fern")) return "fern";
    if (pathLower.includes("flower")) return "flower";
    if (pathLower.includes("grass")) return "grass";
    if (pathLower.includes("mushroom")) return "mushroom";
    if (pathLower.includes("ivy")) return "ivy";

    return "default";
  }

  /**
   * Get category settings
   */
  getCategorySettings(category: string): CategoryLODDefaults {
    return getCategoryDefaults(category);
  }

  /**
   * Get merged LOD settings for an asset
   */
  async getAssetLODSettings(
    assetId: string,
    category: string,
  ): Promise<ReturnType<typeof getMergedLODSettings>> {
    const bundle = await this.getLODBundle(assetId);
    return getMergedLODSettings(category, bundle?.settings);
  }

  /**
   * Start a LOD baking job
   */
  async startBakeJob(
    assetPaths?: string[],
    categories?: string[],
    dryRun = false,
    levels: LODLevel[] = ["lod1"],
  ): Promise<LODBakeJob> {
    const jobId = crypto.randomUUID();
    const assets = await this.findAssets(assetPaths, categories);

    if (assets.length === 0) {
      const job: InternalLODBakeJob = {
        jobId,
        status: "failed",
        progress: 0,
        totalAssets: 0,
        processedAssets: 0,
        results: [],
        error: "No assets found to process",
        startedAt: new Date().toISOString(),
        completedAt: new Date().toISOString(),
      };
      this.jobs.set(jobId, job);
      return this.sanitizeJob(job);
    }

    // Calculate total operations (assets * levels)
    const totalOps = assets.length * levels.filter((l) => l !== "lod0").length;

    const job: InternalLODBakeJob = {
      jobId,
      status: "queued",
      progress: 0,
      totalAssets: totalOps,
      processedAssets: 0,
      results: [],
      startedAt: new Date().toISOString(),
    };

    this.jobs.set(jobId, job);

    // Start baking in background
    this.runBakeProcess(job, assets, dryRun, levels);

    return this.sanitizeJob(job);
  }

  /**
   * Start a batch LOD baking job with full options
   */
  async startBatchBakeJob(request: BatchLODBakeRequest): Promise<LODBakeJob> {
    const { assetIds, categories, levels, force, dryRun } = request;

    let assetPaths: string[] | undefined;

    if (assetIds && assetIds.length > 0) {
      // Convert asset IDs to paths
      assetPaths = assetIds.map((id) => {
        // Try to find the asset path - this would need to query the asset database
        // For now, assume a standard path pattern
        return `assets/vegetation/${id}/${id}.glb`;
      });
    }

    return this.startBakeJob(assetPaths, categories, dryRun ?? false, levels);
  }

  /**
   * Start a TypeScript-based LOD baking job (no external tools required)
   * Uses @hyperforge/decimation for in-process mesh simplification
   */
  async startTypeScriptBakeJob(
    assetPaths?: string[],
    categories?: string[],
    dryRun = false,
    levels: LODLevel[] = ["lod1"],
  ): Promise<LODBakeJob> {
    const jobId = crypto.randomUUID();
    const assets = await this.findAssets(assetPaths, categories);

    if (assets.length === 0) {
      const job: InternalLODBakeJob = {
        jobId,
        status: "failed",
        progress: 0,
        totalAssets: 0,
        processedAssets: 0,
        results: [],
        error: "No assets found to process",
        startedAt: new Date().toISOString(),
        completedAt: new Date().toISOString(),
      };
      this.jobs.set(jobId, job);
      return this.sanitizeJob(job);
    }

    // Calculate total operations
    const totalOps =
      assets.length *
      levels.filter((l) => l !== "lod0" && l !== "imposter").length;

    const job: InternalLODBakeJob = {
      jobId,
      status: "queued",
      progress: 0,
      totalAssets: totalOps,
      processedAssets: 0,
      results: [],
      startedAt: new Date().toISOString(),
    };

    this.jobs.set(jobId, job);

    // Start TypeScript-based baking in background
    this.runTypeScriptBakeProcess(job, assets, dryRun, levels);

    return this.sanitizeJob(job);
  }

  /**
   * Run TypeScript-based decimation process
   */
  private async runTypeScriptBakeProcess(
    job: InternalLODBakeJob,
    assets: string[],
    dryRun: boolean,
    levels: LODLevel[] = ["lod1"],
  ): Promise<void> {
    job.status = "running";

    console.log(
      `[LODBaking] Starting TypeScript job ${job.jobId} with ${assets.length} assets`,
    );

    const results: LODBakeAssetResult[] = [];

    for (const assetPath of assets) {
      const assetId = path.basename(assetPath, ".glb");
      const category = this.inferCategory(assetPath);
      const settings = getCategoryDefaults(category);

      for (const level of levels) {
        if (level === "lod0" || level === "imposter") continue;

        // Check if this level is enabled for this category
        if (level === "lod1" && !settings.lod1.enabled) continue;
        if (level === "lod2" && !settings.lod2.enabled) continue;

        job.currentAsset = assetId;
        job.currentLevel = level;

        const targetPercent =
          level === "lod1"
            ? settings.lod1.targetPercent
            : settings.lod2.targetPercent;

        const minVertices =
          level === "lod1"
            ? settings.lod1.minVertices
            : settings.lod2.minVertices;

        const suffix = level === "lod1" ? "_lod1" : "_lod2";
        const outputPath = assetPath.replace(/\.glb$/, `${suffix}.glb`);

        if (dryRun) {
          console.log(
            `[LODBaking] Would decimate: ${assetPath} -> ${outputPath} (${targetPercent}%)`,
          );
          results.push({
            assetId,
            level,
            success: true,
            input: path.relative(this.projectRoot, assetPath),
            output: path.relative(this.projectRoot, outputPath),
            originalVerts: 0,
            finalVerts: 0,
            reduction: 0,
          });
        } else {
          try {
            const result = await this.glbDecimationService.decimateGLBFile(
              assetPath,
              outputPath,
              {
                targetPercent,
                strictness: 2, // Seam-aware
                minVertices,
              },
            );

            if (result.success) {
              console.log(
                `[LODBaking] Decimated: ${assetId} ${level} (${result.originalVertices} -> ${result.finalVertices} verts, ${result.reductionPercent.toFixed(1)}%)`,
              );
              results.push({
                assetId,
                level,
                success: true,
                input: path.relative(this.projectRoot, assetPath),
                output: path.relative(this.projectRoot, outputPath),
                originalVerts: result.originalVertices,
                finalVerts: result.finalVertices,
                reduction: result.reductionPercent,
                duration: result.processingTime,
              });
            } else {
              console.error(
                `[LODBaking] Failed: ${assetId} ${level} - ${result.error}`,
              );
              results.push({
                assetId,
                level,
                success: false,
                input: path.relative(this.projectRoot, assetPath),
                originalVerts: 0,
                error: result.error,
              });
            }
          } catch (error) {
            const errorMsg =
              error instanceof Error ? error.message : String(error);
            console.error(
              `[LODBaking] Error: ${assetId} ${level} - ${errorMsg}`,
            );
            results.push({
              assetId,
              level,
              success: false,
              input: path.relative(this.projectRoot, assetPath),
              originalVerts: 0,
              error: errorMsg,
            });
          }
        }

        job.processedAssets++;
        job.progress = (job.processedAssets / job.totalAssets) * 100;
      }
    }

    job.results = results;
    job.status = "completed";
    job.progress = 100;
    job.completedAt = new Date().toISOString();
    job.currentAsset = undefined;
    job.currentLevel = undefined;

    console.log(`[LODBaking] TypeScript job ${job.jobId} completed`);

    // Update LOD bundles for processed assets
    if (!dryRun) {
      await this.updateLODBundles(assets);
      await this.updateManifests();
    }
  }

  /**
   * Decimate a single asset using TypeScript decimation
   */
  async decimateSingleAsset(
    assetPath: string,
    level: "lod1" | "lod2",
    options?: {
      targetPercent?: number;
      strictness?: 0 | 1 | 2;
      minVertices?: number;
    },
  ): Promise<GLBDecimationResult> {
    const category = this.inferCategory(assetPath);
    const settings = getCategoryDefaults(category);

    const targetPercent =
      options?.targetPercent ??
      (level === "lod1"
        ? settings.lod1.targetPercent
        : settings.lod2.targetPercent);
    const minVertices =
      options?.minVertices ??
      (level === "lod1"
        ? settings.lod1.minVertices
        : settings.lod2.minVertices);

    const suffix = level === "lod1" ? "_lod1" : "_lod2";
    const outputPath = assetPath.replace(/\.glb$/, `${suffix}.glb`);

    return this.glbDecimationService.decimateGLBFile(assetPath, outputPath, {
      targetPercent,
      strictness: options?.strictness ?? 2,
      minVertices,
    });
  }

  /**
   * Sanitize job for external use (remove process handle)
   */
  private sanitizeJob(job: InternalLODBakeJob): LODBakeJob {
    const { process, ...sanitized } = job;
    return sanitized;
  }

  /**
   * Run the Blender baking process
   */
  private async runBakeProcess(
    job: InternalLODBakeJob,
    assets: string[],
    dryRun: boolean,
    levels: LODLevel[] = ["lod1"],
  ): Promise<void> {
    job.status = "running";

    const blender = this.findBlender();
    const scriptPath = path.join(this.scriptsDir, "bake-lod.py");

    // Build input list file with LOD level info
    const inputListPath = path.join(
      this.assetsDir,
      `.lod-job-${job.jobId}.txt`,
    );

    // Create input list with level specifications
    const inputLines: string[] = [];
    for (const asset of assets) {
      for (const level of levels) {
        if (level === "lod0") continue; // Skip LOD0, it's the original
        if (level === "imposter") continue; // Imposters handled separately

        const category = this.inferCategory(asset);
        const settings = getCategoryDefaults(category);

        // Check if this level is enabled for this category
        if (level === "lod1" && !settings.lod1.enabled) continue;
        if (level === "lod2" && !settings.lod2.enabled) continue;

        const targetPercent =
          level === "lod1"
            ? settings.lod1.targetPercent
            : settings.lod2.targetPercent;

        // Format: path|level|targetPercent
        inputLines.push(`${asset}|${level}|${targetPercent}`);
      }
    }

    await Bun.write(inputListPath, inputLines.join("\n"));

    const args = [
      "--background",
      "--python",
      scriptPath,
      "--",
      "--input-list",
      inputListPath,
      "--multi-level", // Flag to indicate multi-level baking
    ];

    if (dryRun) {
      args.push("--dry-run");
    }

    console.log(
      `[LODBaking] Starting job ${job.jobId} with ${inputLines.length} operations`,
    );
    console.log(`[LODBaking] Command: ${blender} ${args.join(" ")}`);

    const bakeProcess = spawn(blender, args, {
      cwd: this.projectRoot,
      stdio: ["pipe", "pipe", "pipe"],
    });

    job.process = bakeProcess;

    let outputBuffer = "";

    bakeProcess.stdout?.on("data", (data: Buffer) => {
      const text = data.toString();
      outputBuffer += text;

      // Parse progress from output
      const progressMatch = text.match(
        /Processing:\s*(.+\.glb)\s*->\s*(lod\d+|imposter)/i,
      );
      if (progressMatch) {
        job.currentAsset = progressMatch[1];
        job.currentLevel = progressMatch[2] as LODLevel;
      }

      // Match both LOD1 and LOD2 creation
      const resultMatch = text.match(
        /Created:\s*(.+_lod\d+\.glb)\s*\((\d+)\s*verts,\s*([\d.]+)%\)/i,
      );
      if (resultMatch) {
        job.processedAssets++;
        job.progress = (job.processedAssets / job.totalAssets) * 100;
      }

      // Check for skipped assets
      const skipMatch = text.match(/Skipping\s+(.+\.glb).*?(lod\d+)?/i);
      if (skipMatch) {
        job.processedAssets++;
        job.progress = (job.processedAssets / job.totalAssets) * 100;
      }
    });

    bakeProcess.stderr?.on("data", (data: Buffer) => {
      const text = data.toString();
      console.error(`[LODBaking] Error: ${text}`);
    });

    bakeProcess.on("close", async (code: number | null) => {
      // Clean up input list file (non-critical, log but don't fail)
      await fs.promises.unlink(inputListPath).catch((err) => {
        console.warn(
          `[LODBaking] Failed to clean up temp file ${inputListPath}: ${err.message}`,
        );
      });

      if (code === 0) {
        job.status = "completed";
        job.progress = 100;
        console.log(`[LODBaking] Job ${job.jobId} completed successfully`);

        // Parse results from output
        job.results = this.parseResults(outputBuffer, assets, levels);

        // Update LOD bundles for processed assets
        await this.updateLODBundles(assets);

        // Update manifests with new LOD paths
        await this.updateManifests();
      } else {
        job.status = "failed";
        job.error = `Blender process exited with code ${code}`;
        console.error(`[LODBaking] Job ${job.jobId} failed: ${job.error}`);
      }

      job.completedAt = new Date().toISOString();
      job.process = undefined;
    });

    bakeProcess.on("error", (err: Error) => {
      job.status = "failed";
      job.error = err.message;
      job.completedAt = new Date().toISOString();
      job.process = undefined;
      console.error(`[LODBaking] Job ${job.jobId} error: ${err.message}`);
    });
  }

  /**
   * Update LOD bundles for processed assets
   */
  private async updateLODBundles(assets: string[]): Promise<void> {
    for (const asset of assets) {
      const assetId = path.basename(asset, ".glb");
      const category = this.inferCategory(asset);
      const name = assetId.replace(/_/g, " ");

      await this.createOrUpdateBundle(assetId, name, category, asset);
    }
  }

  /**
   * Parse baking results from Blender output
   */
  private parseResults(
    output: string,
    assets: string[],
    levels: LODLevel[] = ["lod1"],
  ): LODBakeAssetResult[] {
    const results: LODBakeAssetResult[] = [];

    for (const asset of assets) {
      const filename = path.basename(asset);
      const assetId = path.basename(asset, ".glb");

      for (const level of levels) {
        if (level === "lod0") continue;
        if (level === "imposter") continue;

        const suffix = level === "lod1" ? "_lod1" : "_lod2";

        // Look for result in output
        const resultPattern = new RegExp(
          `${filename.replace(/\./g, "\\.")}.*?${level}.*?(\\d+)\\s*→\\s*(\\d+)\\s*verts`,
          "i",
        );
        const match = output.match(resultPattern);

        if (match) {
          const originalVerts = parseInt(match[1], 10);
          const finalVerts = parseInt(match[2], 10);
          const outputPath = asset.replace(/\.glb$/, `${suffix}.glb`);
          const reduction =
            originalVerts > 0
              ? (((originalVerts - finalVerts) / originalVerts) * 100).toFixed(
                  1,
                )
              : 0;

          results.push({
            assetId,
            level,
            success: true,
            input: path.relative(this.projectRoot, asset),
            output: path.relative(this.projectRoot, outputPath),
            originalVerts,
            finalVerts,
            reduction: parseFloat(String(reduction)),
          });
        } else {
          // Check if skipped
          const skipPattern = new RegExp(
            `Skipping\\s+${filename.replace(/\./g, "\\.")}.*?${level}`,
            "i",
          );
          if (skipPattern.test(output)) {
            results.push({
              assetId,
              level,
              success: false,
              input: path.relative(this.projectRoot, asset),
              originalVerts: 0,
              error: `Skipped (too small or ${level} not needed)`,
            });
          }
        }
      }
    }

    return results;
  }

  /**
   * Update manifests with LOD1 paths
   */
  private async updateManifests(): Promise<void> {
    // Run the manifest update script
    const updateScript = path.join(this.scriptsDir, "update-lod-manifests.mjs");

    if (!(await Bun.file(updateScript).exists())) {
      console.warn(
        "[LODBaking] update-lod-manifests.mjs not found, skipping manifest update",
      );
      return;
    }

    const process = spawn("node", [updateScript], {
      cwd: this.projectRoot,
      stdio: "pipe",
    });

    process.on("close", (code: number | null) => {
      if (code === 0) {
        console.log("[LODBaking] Manifests updated successfully");
      } else {
        console.error(`[LODBaking] Manifest update failed with code ${code}`);
      }
    });
  }

  /**
   * Get job status
   */
  getJob(jobId: string): LODBakeJob | null {
    const job = this.jobs.get(jobId);
    return job ? this.sanitizeJob(job) : null;
  }

  /**
   * Cancel a running job
   */
  cancelJob(jobId: string): boolean {
    const job = this.jobs.get(jobId);
    if (!job || job.status !== "running" || !job.process) {
      return false;
    }

    job.process.kill("SIGTERM");
    job.status = "cancelled";
    job.error = "Job cancelled by user";
    job.completedAt = new Date().toISOString();
    job.process = undefined;

    return true;
  }

  /**
   * List all jobs
   */
  listJobs(): LODBakeJob[] {
    return Array.from(this.jobs.values()).map((job) => this.sanitizeJob(job));
  }

  /**
   * Clean up old completed jobs
   */
  cleanupOldJobs(maxAge: number = 3600000): void {
    const now = Date.now();
    for (const [jobId, job] of this.jobs.entries()) {
      if (
        (job.status === "completed" || job.status === "failed") &&
        job.completedAt
      ) {
        const completedTime = new Date(job.completedAt).getTime();
        if (now - completedTime > maxAge) {
          this.jobs.delete(jobId);
        }
      }
    }
  }
}
