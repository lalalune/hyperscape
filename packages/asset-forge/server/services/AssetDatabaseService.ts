/**
 * Asset Database Service
 * Syncs file-based assets with PostgreSQL database
 * 
 * Note: All methods handle database unavailability gracefully.
 * If database is not available, operations return null/void without throwing.
 */

import { getDb } from "../db/db";
import { assets, type Asset, type NewAsset } from "../db/schema";
import { eq } from "drizzle-orm";
import type { AssetMetadataType } from "../models";

export class AssetDatabaseService {
  /**
   * Create asset record from file metadata
   */
  async createAssetRecord(
    assetId: string,
    metadata: AssetMetadataType,
    ownerId: string,
    filePath: string,
  ): Promise<Asset | null> {
    const db = await getDb();
    if (!db) {
      // Silently skip - database not available
      return null;
    }
    
    try {
      const [asset] = await db
        .insert(assets)
        .values({
          name: metadata.name || assetId,
          description: metadata.description || "",
          type: metadata.type || "unknown",
          category: metadata.subtype,
          ownerId,
          filePath,
          prompt: metadata.detailedPrompt || metadata.description,
          modelUsed: "meshy-5",
          generationParams: {
            workflow: metadata.workflow,
            meshyTaskId: metadata.meshyTaskId,
            quality: (metadata as Record<string, unknown>).quality as
              | string
              | undefined,
          },
          tags: [],
          metadata: metadata as Record<string, unknown>,
          status: "completed",
          visibility: metadata.isPublic ? "public" : "private",
        })
        .returning();

      console.log(
        `[AssetDatabaseService] Created database record for asset: ${assetId}`,
      );
      return asset;
    } catch (error) {
      console.error(
        `[AssetDatabaseService] Failed to create asset record:`,
        error,
      );
      // Don't throw - return null to indicate failure without crashing
      return null;
    }
  }

  /**
   * Update asset record in database
   */
  async updateAssetRecord(
    assetId: string,
    updates: Partial<NewAsset>,
  ): Promise<Asset | null> {
    const db = await getDb();
    if (!db) {
      // Silently skip - database not available
      return null;
    }
    
    try {
      // Find asset by filePath pattern (contains assetId)
      const existingAssets = await db
        .select()
        .from(assets)
        .where(eq(assets.filePath, `${assetId}/${assetId}.glb`))
        .limit(1);

      if (existingAssets.length === 0) {
        console.warn(
          `[AssetDatabaseService] No database record found for asset: ${assetId}`,
        );
        return null;
      }

      const [updated] = await db
        .update(assets)
        .set({
          ...updates,
          updatedAt: new Date(),
        })
        .where(eq(assets.id, existingAssets[0].id))
        .returning();

      console.log(
        `[AssetDatabaseService] Updated database record for asset: ${assetId}`,
      );
      return updated;
    } catch (error) {
      console.error(
        `[AssetDatabaseService] Failed to update asset record:`,
        error,
      );
      return null;
    }
  }

  /**
   * Delete asset from database
   */
  async deleteAssetRecord(assetId: string): Promise<void> {
    const db = await getDb();
    if (!db) {
      // Silently skip - database not available
      return;
    }
    
    try {
      // Find and delete by filePath pattern
      await db
        .delete(assets)
        .where(eq(assets.filePath, `${assetId}/${assetId}.glb`));

      console.log(
        `[AssetDatabaseService] Deleted database record for asset: ${assetId}`,
      );
    } catch (error) {
      console.error(
        `[AssetDatabaseService] Failed to delete asset record:`,
        error,
      );
      // Don't throw - just log the error
    }
  }

  /**
   * Get asset with owner info
   */
  async getAssetWithOwner(assetId: string): Promise<Asset | null> {
    const db = await getDb();
    if (!db) {
      // Silently skip - database not available
      return null;
    }
    
    try {
      const result = await db
        .select()
        .from(assets)
        .where(eq(assets.filePath, `${assetId}/${assetId}.glb`))
        .limit(1);

      return result[0] || null;
    } catch (error) {
      console.error(`[AssetDatabaseService] Failed to get asset:`, error);
      return null;
    }
  }
}

// Export singleton instance
export const assetDatabaseService = new AssetDatabaseService();
