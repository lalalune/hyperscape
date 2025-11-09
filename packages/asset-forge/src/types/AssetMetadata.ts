/**
 * Standardized Asset Metadata Types
 * Defines the structure for all asset metadata stored in gdd-assets/{id}/metadata.json
 */

import type { ExtendedAssetMetadata, RiggingMetadata } from "./RiggingMetadata";

export type AssetType =
  | "weapon"
  | "armor"
  | "tool"
  | "resource"
  | "ammunition"
  | "character"
  | "misc";

export interface MaterialPresetInfo {
  id: string;
  displayName: string;
  category: string;
  tier: number;
  color: string;
  stylePrompt?: string;
}

/**
 * Base Asset Metadata
 * For original base models that can be retextured
 */
export interface BaseAssetMetadata extends RiggingMetadata {
  // Identity
  id: string;
  gameId: string;
  name: string;
  description: string;
  type: AssetType;
  subtype: string;

  // Base Model Specific
  isBaseModel: true;
  isVariant?: false;
  meshyTaskId: string; // REQUIRED for retexturing
  generationMethod:
    | "gpt-image-meshy"
    | "direct-meshy"
    | "manual"
    | "placeholder";

  // Variant Tracking
  variants: string[]; // IDs of all generated variants
  variantCount: number;
  lastVariantGenerated?: string;

  // Files
  modelPath: string;
  conceptArtPath?: string;
  hasModel: boolean;
  hasConceptArt: boolean;

  // Generation Details
  workflow?: string;
  gddCompliant: boolean;
  isPlaceholder: boolean;

  // Normalization
  normalized?: boolean;
  normalizationDate?: string;
  dimensions?: {
    width: number;
    height: number;
    depth: number;
  };

  // Timestamps
  createdAt: string;
  updatedAt: string;
  generatedAt?: string;
  completedAt?: string;

  // Additional properties used in UI
  tier?: string;
  format?: string;
  gripDetected?: boolean; // For weapons
  requiresAnimationStrip?: boolean;
}

/**
 * Variant Asset Metadata
 * For retextured variants of base models
 */
export interface VariantAssetMetadata extends RiggingMetadata {
  // Identity
  id: string;
  gameId: string;
  name: string;
  description: string;
  type: AssetType;
  subtype: string;

  // Variant Specific
  isBaseModel: false;
  isVariant: true;
  parentBaseModel: string; // ID of the base model

  // Material Information
  materialPreset: MaterialPresetInfo;
  baseMaterial?: string; // Optional for backwards compatibility with older variant format

  // Generation Info
  retextureTaskId: string;
  retextureMethod: "meshy-retexture" | "manual-texture" | "ai-generated";
  retextureStatus: "pending" | "processing" | "completed" | "failed";
  retextureError?: string;

  // Base Model Reference
  baseModelTaskId: string; // Meshy task ID of the parent

  // Files
  modelPath: string;
  conceptArtPath?: string;
  hasModel: boolean;
  hasConceptArt: boolean;

  // Generation Details
  workflow: string;
  gddCompliant: boolean;
  isPlaceholder: boolean;

  // Normalization
  normalized?: boolean;
  normalizationDate?: string;
  dimensions?: {
    width: number;
    height: number;
    depth: number;
  };

  // Timestamps
  generatedAt: string;
  completedAt?: string;
  createdAt?: string;
  updatedAt?: string;

  // Additional properties used in UI
  tier?: string;
  format?: string;
  gripDetected?: boolean; // For weapons
  requiresAnimationStrip?: boolean;
}

/**
 * Combined type for any asset metadata
 */
export type AssetMetadata = BaseAssetMetadata | VariantAssetMetadata;

/**
 * Type for assets with animation metadata
 */
export type AssetWithAnimations = {
  id: string;
  name: string;
  description: string;
  type: string;
  metadata: ExtendedAssetMetadata;
  hasModel: boolean;
  modelFile?: string;
  generatedAt: string;
};

/**
 * Type guard to check if asset metadata has animations
 */
export function hasAnimations(asset: {
  id: string;
  name: string;
  description: string;
  type: string;
  metadata: AssetMetadata | ExtendedAssetMetadata;
  hasModel: boolean;
  modelFile?: string;
  generatedAt: string;
}): asset is AssetWithAnimations {
  return "animations" in asset.metadata;
}

/**
 * Type guards
 */
export function isBaseAsset(
  metadata: AssetMetadata,
): metadata is BaseAssetMetadata {
  return metadata.isBaseModel === true;
}

export function isVariantAsset(
  metadata: AssetMetadata,
): metadata is VariantAssetMetadata {
  return metadata.isVariant === true;
}

/**
 * Validation helpers
 */
export function validateBaseAsset(
  metadata: unknown,
): metadata is BaseAssetMetadata {
  return (
    metadata !== null &&
    typeof metadata === "object" &&
    "isBaseModel" in metadata &&
    metadata.isBaseModel === true &&
    "meshyTaskId" in metadata &&
    typeof metadata.meshyTaskId === "string" &&
    metadata.meshyTaskId.length > 0 &&
    "variants" in metadata &&
    Array.isArray(metadata.variants)
  );
}

export function canRetexture(metadata: AssetMetadata): boolean {
  return (
    isBaseAsset(metadata) && !!metadata.meshyTaskId && !metadata.isPlaceholder
  );
}
