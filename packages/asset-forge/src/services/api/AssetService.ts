/**
 * Asset Service
 * Clean API interface for asset operations
 */

import { MaterialPreset, AssetMetadata } from "../../types";

import { apiFetch } from "@/utils/api";

export type { MaterialPreset };

export interface Asset {
  id: string;
  name: string;
  description: string;
  type: string;
  metadata: AssetMetadata;
  hasModel: boolean;
  modelFile?: string;
  generatedAt: string;
}

export interface RetextureRequest {
  baseAssetId: string;
  materialPreset: MaterialPreset;
  outputName?: string;
}

export interface RetextureResponse {
  success: boolean;
  assetId: string;
  message: string;
  asset?: Asset;
}

class AssetServiceClass {
  private baseUrl = "/api";

  async listAssets(): Promise<Asset[]> {
    const response = await apiFetch(`${this.baseUrl}/assets?t=${Date.now()}`, {
      headers: {
        "Cache-Control": "no-cache",
        Pragma: "no-cache",
      },
      timeoutMs: 15000,
    });
    if (!response.ok) {
      throw new Error("Failed to fetch assets");
    }
    return response.json();
  }

  async getMaterialPresets(): Promise<MaterialPreset[]> {
    const response = await apiFetch(`${this.baseUrl}/material-presets`, {
      timeoutMs: 10000,
    });
    if (!response.ok) {
      throw new Error("Failed to fetch material presets");
    }
    return response.json();
  }

  async retexture(request: RetextureRequest): Promise<RetextureResponse> {
    const response = await apiFetch(`${this.baseUrl}/retexture`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(request),
      timeoutMs: 30000,
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error?.message || "Retexturing failed");
    }

    return response.json();
  }

  getModelUrl(assetId: string): string {
    return `/assets/${assetId}/${assetId}.glb`;
  }

  /**
   * Get T-pose model URL for retargeting workflow
   * Tries to load t-pose.glb, falls back to regular model if not found
   */
  async getTPoseUrl(assetId: string): Promise<string> {
    // Try gdd-assets first (for any asset that might be in that folder)
    const gddTposeUrl = `/gdd-assets/${assetId}/t-pose.glb`;
    try {
      const response = await fetch(gddTposeUrl, { method: "HEAD" });
      if (response.ok) {
        console.log(`[AssetService] T-pose found in gdd-assets: ${assetId}`);
        return gddTposeUrl;
      }
    } catch (error) {
      // Silently continue to next check
    }

    // Try to load t-pose.glb from user assets via API
    const apiTposeUrl = `/api/assets/${assetId}/t-pose`;
    try {
      const response = await fetch(apiTposeUrl, { method: "HEAD" });
      if (response.ok) {
        console.log(`[AssetService] T-pose found via API for ${assetId}`);
        return apiTposeUrl;
      }
    } catch (error) {
      // Silently continue to fallback
    }

    console.log(
      `[AssetService] No T-pose found for ${assetId}, using regular model`,
    );
    // Fall back to regular model
    return this.getModelUrl(assetId);
  }

  getConceptArtUrl(assetId: string): string {
    return `/assets/${assetId}/concept-art.png`;
  }

  /**
   * Upload VRM file to server
   * Saves the converted VRM alongside the original asset
   */
  async uploadVRM(
    assetId: string,
    vrmData: ArrayBuffer,
    filename: string,
  ): Promise<{ success: boolean; url: string }> {
    const formData = new FormData();
    const blob = new Blob([vrmData], { type: "application/octet-stream" });
    formData.append("file", blob, filename);
    formData.append("assetId", assetId);

    const response = await apiFetch(`${this.baseUrl}/assets/upload-vrm`, {
      method: "POST",
      body: formData,
      timeoutMs: 30000,
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error?.message || "VRM upload failed");
    }

    return response.json();
  }

  /**
   * Get VRM model URL if it exists
   * Note: This returns a URL path, but doesn't guarantee the file exists
   * Calling code should handle 404 errors gracefully
   */
  getVRMUrl(assetId: string): string {
    // Try gdd-assets path first (for any assets stored there)
    // If not found, the calling code should fall back to API path
    return `/gdd-assets/${assetId}/${assetId}.vrm`;
  }

  /**
   * Get VRM model URL from API endpoint
   */
  getAPIVRMUrl(assetId: string): string {
    return `/assets/${assetId}/${assetId}.vrm`;
  }
}

export const AssetService = new AssetServiceClass();
