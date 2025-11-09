/**
 * Asset Normalization Conventions
 * Defines the standard conventions for all normalized assets
 */

import { CREATURE_SIZE_CATEGORIES, getCreatureCategory } from "../constants";

export interface AssetConvention {
  scale: string;
  origin: string;
  orientation: string;
  primaryAxis?: string;
  additionalRules?: string[];
}

export interface NormalizationResult {
  success: boolean;
  normalized: boolean;
  conventions: AssetConvention;
  transformsApplied: {
    translation?: { x: number; y: number; z: number };
    rotation?: { x: number; y: number; z: number };
    scale?: number;
  };
  validation: {
    originCorrect: boolean;
    orientationCorrect: boolean;
    scaleCorrect: boolean;
    errors: string[];
  };
}

export const ASSET_CONVENTIONS: Record<string, AssetConvention> = {
  // Characters
  character: {
    scale: "1 unit = 1 meter (exact height baked)",
    origin: "Feet at (0,0,0)",
    orientation: "Facing +Z, T-pose with arms along X axis",
    primaryAxis: "Height along Y axis",
    additionalRules: [
      "No transform nodes above mesh",
      "Skeleton root at character root",
      "All bones in bind pose",
    ],
  },

  // Weapons
  weapon: {
    scale: "Real-world size (1 unit = 1 meter)",
    origin: "Primary grip point at (0,0,0)",
    orientation: "Blade/tip pointing +Y (up)",
    primaryAxis: "Length along Y axis",
    additionalRules: [
      "Handle at bottom (-Y)",
      "Blade/head at top (+Y)",
      "Flat side facing +Z",
    ],
  },

  sword: {
    scale: "Real-world size (~1.2m total length)",
    origin: "Grip center at (0,0,0)",
    orientation: "Blade pointing +Y, edge facing ±X",
    primaryAxis: "Blade along Y axis",
  },

  axe: {
    scale: "Real-world size (~0.8m total length)",
    origin: "Grip point at (0,0,0)",
    orientation: "Axe head pointing +Y, blade facing +Z",
    primaryAxis: "Handle along Y axis",
  },

  bow: {
    scale: "Real-world size (~1.5m height)",
    origin: "Grip center at (0,0,0)",
    orientation: "Tips pointing ±Y, string plane on X",
    primaryAxis: "Height along Y axis",
  },

  staff: {
    scale: "Real-world size (~2m length)",
    origin: "Center grip at (0,0,0)",
    orientation: "Length along Y axis",
    primaryAxis: "Length along Y axis",
  },

  shield: {
    scale: "Real-world size (~1m diameter)",
    origin: "Handle center at (0,0,0)",
    orientation: "Face pointing +Z, top pointing +Y",
    primaryAxis: "Height along Y axis",
  },

  // Armor
  armor: {
    scale: "Sized for 1.83m humanoid",
    origin: "Attachment point at (0,0,0)",
    orientation: "Worn orientation, facing +Z",
    additionalRules: ["No deformation in rest pose", "Symmetrical on X axis"],
  },

  helmet: {
    scale: "Sized for standard head",
    origin: "Neck attachment at (0,0,0)",
    orientation: "Facing +Z, top pointing +Y",
    primaryAxis: "Height along Y axis",
  },

  chest: {
    scale: "Sized for 1.83m torso",
    origin: "Spine attachment at (0,0,0)",
    orientation: "Front facing +Z",
    primaryAxis: "Height along Y axis",
  },

  // Buildings
  building: {
    scale: "1 unit = 1 meter",
    origin: "Center of ground floor at (0,0,0)",
    orientation: "Main entrance facing +Z",
    primaryAxis: "Height along Y axis",
    additionalRules: [
      "Ground plane at Y=0",
      "Doors separate objects",
      "Interior accessible",
    ],
  },

  // Items
  item: {
    scale: "Real-world size",
    origin: "Center of mass at (0,0,0)",
    orientation: "Natural resting position",
    primaryAxis: "Largest dimension",
  },
};

export function getConvention(
  assetType: string,
  subtype?: string,
): AssetConvention {
  // Try specific subtype first
  if (subtype && ASSET_CONVENTIONS[subtype]) {
    return ASSET_CONVENTIONS[subtype];
  }

  // Fall back to general type
  if (ASSET_CONVENTIONS[assetType]) {
    return ASSET_CONVENTIONS[assetType];
  }

  // Default convention
  return {
    scale: "1 unit = 1 meter",
    origin: "Center at (0,0,0)",
    orientation: "Natural orientation",
  };
}

// Re-export for backwards compatibility
export { CREATURE_SIZE_CATEGORIES, getCreatureCategory };
