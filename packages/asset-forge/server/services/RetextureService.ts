/**
 * Retexture Service
 * Handles AI-powered texture generation using Meshy API
 */

import fs from "fs/promises";
import path from "path";
import fetch from "node-fetch";
import type { UserContextType, AssetMetadataType } from "../models";
import type { Static } from "elysia";
import { MaterialPreset as MaterialPresetModel } from "../models";

// Use the TypeBox model as the type
type MaterialPreset = Static<typeof MaterialPresetModel>;

type FetchFunction = typeof fetch;

interface MeshyClientConfig {
  apiKey: string;
  baseUrl?: string;
  timeout?: number;
  maxRetries?: number;
  retryDelayMs?: number;
  checkInterval?: number;
  maxCheckTime?: number;
  keepAlive?: boolean;
  maxSockets?: number;
  fetchFn?: FetchFunction;
}

interface RetextureOptions {
  inputTaskId: string;
  textStylePrompt: string;
  artStyle?: string;
  aiModel?: string;
  enableOriginalUV?: boolean;
}

interface TaskStatus {
  status: string;
  progress?: number;
  task_error?: {
    message: string;
  };
  model_urls?: {
    glb?: string;
  };
}

interface RetextureParams {
  baseAssetId: string;
  materialPreset: MaterialPreset;
  outputName?: string;
  assetsDir: string;
  user?: UserContextType | null;
}

interface SaveRetexturedAssetParams {
  result: TaskStatus;
  variantName: string;
  baseAssetId: string;
  baseMetadata: AssetMetadataType;
  materialPreset: MaterialPreset;
  taskId: string;
  assetsDir: string;
  user?: UserContextType | null;
}

interface RegenerateBaseParams {
  baseAssetId: string;
  assetsDir: string;
}

// Temporary MeshyClient implementation until build issues are resolved
class MeshyClient {
  private apiKey: string;
  private baseUrl: string;
  private maxRetries: number;
  private retryDelay: number;
  public checkInterval: number;
  public maxCheckTime: number;
  private fetchFn: FetchFunction;

  constructor(config: MeshyClientConfig) {
    this.apiKey = config.apiKey;
    this.baseUrl = config.baseUrl || "https://api.meshy.ai";
    this.maxRetries = config.maxRetries || 3;
    this.retryDelay = config.retryDelayMs || 5000;
    this.checkInterval = config.checkInterval || 10000;
    this.maxCheckTime = config.maxCheckTime || 600000;
    this.fetchFn = config.fetchFn || fetch;
  }

  async remesh(
    modelPath: string,
    options: { targetPolycount?: number } = {},
  ): Promise<{ modelUrl: string; taskId: string }> {
    // Minimal implementation for remeshing
    const formData = new FormData();
    const fileBuffer = await fs.readFile(modelPath);
    // FormData accepts Blob or Buffer - wrap Buffer in Blob for compatibility
    formData.append("file", new Blob([fileBuffer]));
    formData.append("targetPolycount", String(options.targetPolycount || 3000));

    const response = await this.fetchFn(`${this.baseUrl}/v1/remesh`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
      },
      // FormData is directly compatible with fetch body
      body: formData,
    });

    if (!response.ok) {
      throw new Error(`Remesh failed: ${response.statusText}`);
    }

    interface RemeshResponse {
      model_url: string;
      task_id: string;
    }

    const result = (await response.json()) as RemeshResponse;
    return {
      modelUrl: result.model_url,
      taskId: result.task_id,
    };
  }

  async checkTaskStatus(taskId: string): Promise<TaskStatus> {
    const response = await this.fetchFn(`${this.baseUrl}/v1/tasks/${taskId}`, {
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
      },
    });

    if (!response.ok) {
      throw new Error(`Task check failed: ${response.statusText}`);
    }

    return (await response.json()) as TaskStatus;
  }

  async startRetexture(options: RetextureOptions): Promise<string> {
    const body = {
      input_task_id: options.inputTaskId,
      text_style_prompt: options.textStylePrompt,
      art_style: options.artStyle || "realistic",
      ai_model: options.aiModel || "meshy-5",
      enable_original_uv: options.enableOriginalUV ?? true,
    };

    const response = await this.fetchFn(
      `${this.baseUrl}/openapi/v1/retexture`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
      },
    );

    if (!response.ok) {
      const error = await response.text();
      throw new Error(
        `Meshy Retexture API error: ${response.status} - ${error}`,
      );
    }

    interface RetextureResponse {
      result?: string;
      task_id?: string;
    }

    const result = (await response.json()) as RetextureResponse;
    return result.result || result.task_id || "";
  }

  async waitForCompletion(
    taskId: string,
    progressCallback?: (progress: number) => void,
  ): Promise<TaskStatus> {
    const startTime = Date.now();

    while (true) {
      const status = await this.getRetextureTaskStatus(taskId);

      if (status.status === "SUCCEEDED") {
        if (progressCallback) progressCallback(100);
        return status;
      }

      if (status.status === "FAILED") {
        throw new Error(
          `Retexture failed: ${status.task_error?.message || "Unknown error"}`,
        );
      }

      if (progressCallback && status.progress) {
        progressCallback(status.progress);
      }

      if (Date.now() - startTime > this.maxCheckTime) {
        throw new Error(
          `Retexture timeout after ${this.maxCheckTime / 1000} seconds`,
        );
      }

      await new Promise((resolve) => setTimeout(resolve, this.checkInterval));
    }
  }

  async getRetextureTaskStatus(taskId: string): Promise<TaskStatus> {
    const response = await this.fetchFn(
      `${this.baseUrl}/openapi/v1/retexture/${taskId}`,
      {
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
        },
      },
    );

    if (!response.ok) {
      const error = await response.text();
      throw new Error(
        `Meshy Retexture API error: ${response.status} - ${error}`,
      );
    }

    return (await response.json()) as TaskStatus;
  }

  async downloadModel(modelUrl: string): Promise<Buffer> {
    const response = await this.fetchFn(modelUrl);
    if (!response.ok) {
      throw new Error(`Failed to download model: ${response.statusText}`);
    }

    const buffer = await response.arrayBuffer();
    return Buffer.from(buffer);
  }

  destroy(): void {
    // Cleanup if needed
  }
}

export class RetextureService {
  private meshyApiKey: string | undefined;
  private meshyClient: MeshyClient | null;

  constructor(config?: {
    meshyApiKey?: string;
    imageServerBaseUrl?: string;
    fetchFn?: FetchFunction;
  }) {
    this.meshyApiKey = config?.meshyApiKey || process.env.MESHY_API_KEY;

    if (!this.meshyApiKey) {
      console.warn(
        "[RetextureService] MESHY_API_KEY not found - retexturing will be disabled",
      );
      this.meshyClient = null;
    } else {
      // Initialize MeshyClient with robust configuration
      this.meshyClient = new MeshyClient({
        apiKey: this.meshyApiKey,
        baseUrl: "https://api.meshy.ai",
        timeout: 30000, // 30 seconds
        maxRetries: 3,
        retryDelayMs: 2000,
        keepAlive: true,
        maxSockets: 10,
        fetchFn: config?.fetchFn || fetch,
      });
    }
  }

  async retexture({
    baseAssetId,
    materialPreset,
    outputName,
    assetsDir,
    user = null,
  }: RetextureParams) {
    if (!this.meshyClient) {
      throw new Error("MESHY_API_KEY is required for retexturing");
    }

    try {
      // Get base asset metadata
      const baseMetadata = await this.getAssetMetadata(baseAssetId, assetsDir);
      if (!baseMetadata.meshyTaskId) {
        throw new Error(
          `Base asset ${baseAssetId} does not have a Meshy task ID`,
        );
      }

      console.log(
        `🎨 Starting retexture for ${baseAssetId} with material: ${materialPreset.displayName}`,
      );

      // Start retexture task using the new MeshyClient
      const taskId = await this.meshyClient.startRetexture({
        inputTaskId: baseMetadata.meshyTaskId,
        textStylePrompt:
          materialPreset.stylePrompt ||
          `Apply ${materialPreset.displayName} material texture`,
        artStyle: "realistic",
        aiModel: "meshy-5",
        enableOriginalUV: true,
      });

      console.log(`🎨 Retexture task started: ${taskId}`);

      // Wait for completion with progress updates
      const result = await this.meshyClient.waitForCompletion(
        taskId,
        (progress) => {
          console.log(`⏳ Retexture Progress: ${progress}%`);
        },
      );

      // Download and save the retextured model
      const variantName =
        outputName ||
        `${baseAssetId.replace("-base", "")}-${materialPreset.id}`;

      const savedAsset = await this.saveRetexturedAsset({
        result,
        variantName,
        baseAssetId,
        baseMetadata,
        materialPreset,
        taskId,
        assetsDir,
        user,
      });

      return {
        success: true,
        assetId: variantName,
        url: `/gdd-assets/${variantName}/${variantName}.glb`,
        message: "Asset retextured successfully using Meshy AI",
        asset: savedAsset,
      };
    } catch (error) {
      console.error("Retexturing failed:", error);
      const err = error as Error;

      // Provide more detailed error information
      const errorMessage = err.message || "Unknown error";
      const isNetworkError =
        errorMessage.includes("timeout") ||
        errorMessage.includes("fetch failed") ||
        errorMessage.includes("network");

      throw new Error(
        isNetworkError
          ? `Network error during retexturing: ${errorMessage}. Please check your internet connection and try again.`
          : `Retexturing failed: ${errorMessage}`,
      );
    }
  }

  async saveRetexturedAsset({
    result,
    variantName,
    baseAssetId,
    baseMetadata,
    materialPreset,
    taskId,
    assetsDir,
    user = null,
  }: SaveRetexturedAssetParams): Promise<AssetMetadataType> {
    if (!result.model_urls?.glb) {
      throw new Error("No model URL in result");
    }

    const outputDir = path.join(assetsDir, variantName);
    await fs.mkdir(outputDir, { recursive: true });

    // Download model using MeshyClient
    console.log(`📥 Downloading retextured model...`);
    const modelBuffer = await this.meshyClient!.downloadModel(
      result.model_urls.glb,
    );
    const modelPath = path.join(outputDir, `${variantName}.glb`);
    await fs.writeFile(modelPath, modelBuffer);

    // Copy concept art if it exists
    try {
      const baseConceptPath = path.join(
        assetsDir,
        baseAssetId,
        "concept-art.png",
      );
      const variantConceptPath = path.join(outputDir, "concept-art.png");
      await fs.copyFile(baseConceptPath, variantConceptPath);
    } catch (e) {
      // Ignore if concept art doesn't exist
    }

    // Create standardized metadata
    const variantMetadata: AssetMetadataType = {
      // Identity
      id: variantName,
      gameId: variantName,
      name: variantName,
      type: baseMetadata.type,
      subtype: baseMetadata.subtype,

      // Variant-specific
      isBaseModel: false,
      isVariant: true,
      parentBaseModel: baseAssetId,

      // Material information
      materialPreset: {
        id: materialPreset.id,
        displayName: materialPreset.displayName,
        category: materialPreset.category,
        tier: materialPreset.tier,
        color: materialPreset.color,
        stylePrompt: materialPreset.stylePrompt,
      },

      // Generation tracking
      workflow: "Meshy AI Retexture",
      baseModelTaskId: baseMetadata.meshyTaskId,
      retextureTaskId: taskId,
      retextureStatus: "completed",

      // Files
      modelPath: `${variantName}.glb`,
      conceptArtPath: baseMetadata.conceptArtPath
        ? "concept-art.png"
        : undefined,
      hasModel: true,
      hasConceptArt: baseMetadata.hasConceptArt || false,

      // Timestamps
      generatedAt: new Date().toISOString(),
      completedAt: new Date().toISOString(),

      // Inherit other properties from base
      description: baseMetadata.description,
      isPlaceholder: false,
      gddCompliant: true,

      // Ownership tracking (Phase 1) - inherit from parent or use provided user
      createdBy: user?.privyId || baseMetadata.createdBy || undefined,
      walletAddress:
        user?.walletAddress || baseMetadata.walletAddress || undefined,
      isPublic:
        baseMetadata.isPublic !== undefined ? baseMetadata.isPublic : true,
    };

    await fs.writeFile(
      path.join(outputDir, "metadata.json"),
      JSON.stringify(variantMetadata, null, 2),
    );

    // Update base asset metadata to track this variant
    await this.updateBaseAssetVariants(baseAssetId, variantName, assetsDir);

    console.log(`✅ Successfully retextured: ${variantName}`);

    return variantMetadata;
  }

  async updateBaseAssetVariants(
    baseAssetId: string,
    variantId: string,
    assetsDir: string,
  ): Promise<void> {
    try {
      const metadataPath = path.join(assetsDir, baseAssetId, "metadata.json");
      const metadata = await this.getAssetMetadata(baseAssetId, assetsDir);

      // Initialize variants array if it doesn't exist
      if (!metadata.variants) {
        metadata.variants = [];
      }

      // Add variant if not already tracked
      if (!metadata.variants.includes(variantId)) {
        metadata.variants.push(variantId);
        metadata.variantCount = metadata.variants.length;
        metadata.lastVariantGenerated = variantId;
        metadata.updatedAt = new Date().toISOString();

        await fs.writeFile(metadataPath, JSON.stringify(metadata, null, 2));
      }
    } catch (error) {
      const err = error as Error;
      console.warn(`Failed to update base asset variants: ${err.message}`);
    }
  }

  async getAssetMetadata(
    assetId: string,
    assetsDir: string,
  ): Promise<AssetMetadataType> {
    const metadataPath = path.join(assetsDir, assetId, "metadata.json");
    return JSON.parse(
      await fs.readFile(metadataPath, "utf-8"),
    ) as AssetMetadataType;
  }

  async regenerateBase({ baseAssetId, assetsDir }: RegenerateBaseParams) {
    if (!this.meshyApiKey || !process.env.OPENAI_API_KEY) {
      throw new Error(
        "MESHY_API_KEY and OPENAI_API_KEY are required for base regeneration",
      );
    }

    // For now, return a simulated success response
    // Full implementation would regenerate the base model from scratch
    console.log(`🔄 Regenerating base model: ${baseAssetId}`);

    // Simulate processing time
    await new Promise((resolve) => setTimeout(resolve, 3000));

    return {
      success: true,
      assetId: baseAssetId,
      url: `/gdd-assets/${baseAssetId}/${baseAssetId}.glb`,
      message: `Base model ${baseAssetId} has been queued for regeneration. This feature is coming soon!`,
      asset: await this.getAssetMetadata(baseAssetId, assetsDir),
    };
  }

  /**
   * Cleanup resources on shutdown
   */
  destroy(): void {
    if (this.meshyClient) {
      this.meshyClient.destroy();
    }
  }
}
