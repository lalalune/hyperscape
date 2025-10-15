/**
 * External Asset Utilities
 * Helper functions to access assets loaded from 3D Asset Forge manifests
 */

interface ExternalNPC {
  id: string;
  name: string;
  description: string;
  type: string;
  modelPath: string;
  animations?: { idle?: string; talk?: string };
  services: string[];
}

interface ExternalResource {
  id: string;
  name: string;
  type: string;
  modelPath: string;
  iconPath?: string;
  harvestSkill: string;
  requiredLevel: number;
  harvestTime: number;
  respawnTime: number;
  yields: Array<{ itemId: string; quantity: number; chance: number }>;
}

interface ExternalBuilding {
  id: string;
  name: string;
  type: string;
  modelPath: string;
  iconPath?: string;
  description: string;
}

interface ExternalAvatar {
  id: string;
  name: string;
  description: string;
  type: string;
  isRigged: boolean;
  characterHeight: number;
  modelPath: string;
  animations?: { idle?: string; walk?: string; run?: string };
}

/**
 * Get all external NPCs loaded from manifests
 */
export function getExternalNPCs(): Map<string, ExternalNPC> {
  const npcs = (globalThis as { EXTERNAL_NPCS?: Map<string, ExternalNPC> }).EXTERNAL_NPCS;
  return npcs || new Map();
}

/**
 * Get external NPC by ID
 */
export function getExternalNPC(id: string): ExternalNPC | null {
  const npcs = getExternalNPCs();
  return npcs.get(id) || null;
}

/**
 * Get all external resources loaded from manifests
 */
export function getExternalResources(): Map<string, ExternalResource> {
  const resources = (globalThis as { EXTERNAL_RESOURCES?: Map<string, ExternalResource> }).EXTERNAL_RESOURCES;
  return resources || new Map();
}

/**
 * Get external resource by ID
 */
export function getExternalResource(id: string): ExternalResource | null {
  const resources = getExternalResources();
  return resources.get(id) || null;
}

/**
 * Get all external buildings loaded from manifests
 */
export function getExternalBuildings(): Map<string, ExternalBuilding> {
  const buildings = (globalThis as { EXTERNAL_BUILDINGS?: Map<string, ExternalBuilding> }).EXTERNAL_BUILDINGS;
  return buildings || new Map();
}

/**
 * Get external building by ID
 */
export function getExternalBuilding(id: string): ExternalBuilding | null {
  const buildings = getExternalBuildings();
  return buildings.get(id) || null;
}

/**
 * Get all external avatars loaded from manifests
 */
export function getExternalAvatars(): Map<string, ExternalAvatar> {
  const avatars = (globalThis as { EXTERNAL_AVATARS?: Map<string, ExternalAvatar> }).EXTERNAL_AVATARS;
  return avatars || new Map();
}

/**
 * Get external avatar by ID
 */
export function getExternalAvatar(id: string): ExternalAvatar | null {
  const avatars = getExternalAvatars();
  return avatars.get(id) || null;
}

/**
 * Check if external assets are loaded
 */
export function hasExternalAssets(): boolean {
  return getExternalNPCs().size > 0 || 
         getExternalResources().size > 0 || 
         getExternalBuildings().size > 0 ||
         getExternalAvatars().size > 0;
}

/**
 * Get summary of loaded external assets
 */
export function getExternalAssetsSummary(): {
  npcs: number;
  resources: number;
  buildings: number;
  avatars: number;
  total: number;
} {
  return {
    npcs: getExternalNPCs().size,
    resources: getExternalResources().size,
    buildings: getExternalBuildings().size,
    avatars: getExternalAvatars().size,
    total: getExternalNPCs().size + getExternalResources().size + getExternalBuildings().size + getExternalAvatars().size
  };
}

