/**
 * External Asset Utilities
 * Helper functions to access assets loaded from 3D Asset Forge manifests
 */

import { ALL_NPCS } from "../data/npcs";
import type { NPCData } from "../types/core/core";
import type {
  ExternalResourceData,
  GatheringToolData,
} from "../data/DataManager";

const OAK_TREE_VARIANTS = [
  "asset://models/trees/oak/oak_01.glb",
  "asset://models/trees/oak/oak_02.glb",
] as const;

const DEAD_TREE_VARIANTS = [
  "asset://models/trees/dead/dead_01.glb",
  "asset://models/trees/dead/dead_02.glb",
  "asset://models/trees/dead/dead_03.glb",
  "asset://models/trees/dead/dead_04.glb",
] as const;

const RESOURCE_FALLBACKS: Record<string, ExternalResourceData> = {
  tree_banana: {
    id: "tree_banana",
    name: "Banana Tree",
    type: "tree",
    examine: "A tropical banana tree with large, broad leaves.",
    modelPath: null,
    modelVariants: [
      "asset://models/trees/banana/banana_01.glb",
      "asset://models/trees/banana/banana_02.glb",
      "asset://models/trees/banana/banana_03.glb",
      "asset://models/trees/banana/banana_04.glb",
      "asset://models/trees/banana/banana_05.glb",
    ],
    depletedModelPath: "asset://models/trees/wood-tree-stump/wood-tree-stump.glb",
    scale: 1,
    depletedScale: 0.1,
    harvestSkill: "woodcutting",
    toolRequired: "bronze_hatchet",
    levelRequired: 1,
    baseCycleTicks: 4,
    depleteChance: 0.125,
    respawnTicks: 80,
    harvestYield: [
      {
        itemId: "logs",
        itemName: "Logs",
        quantity: 1,
        chance: 1,
        xpAmount: 25,
        stackable: true,
      },
    ],
  },
  tree_pineDead: {
    id: "tree_pineDead",
    name: "Dead Pine",
    type: "tree",
    examine: "A weathered pine, stripped bare by harsh tundra winds.",
    modelPath: null,
    modelVariants: [
      "asset://models/trees/pine_dead/pine_dead_01.glb",
      "asset://models/trees/pine_dead/pine_dead_02.glb",
      "asset://models/trees/pine_dead/pine_dead_03.glb",
    ],
    depletedModelPath: "asset://models/trees/wood-tree-stump/wood-tree-stump.glb",
    scale: 1,
    depletedScale: 0.1,
    harvestSkill: "woodcutting",
    toolRequired: "bronze_hatchet",
    levelRequired: 1,
    baseCycleTicks: 4,
    depleteChance: 0.125,
    respawnTicks: 80,
    harvestYield: [
      {
        itemId: "logs",
        itemName: "Logs",
        quantity: 1,
        chance: 1,
        xpAmount: 25,
        stackable: true,
      },
    ],
  },
  tree_eucalyptus: {
    id: "tree_eucalyptus",
    name: "Eucalyptus Tree",
    type: "tree",
    examine: "A tall eucalyptus with peeling bark and long leaves.",
    modelPath: null,
    modelVariants: [
      "asset://models/trees/eucalyptus/eucalyptus_01.glb",
      "asset://models/trees/eucalyptus/eucalyptus_02.glb",
      "asset://models/trees/eucalyptus/eucalyptus_03.glb",
      "asset://models/trees/eucalyptus/eucalyptus_04.glb",
      "asset://models/trees/eucalyptus/eucalyptus_05.glb",
    ],
    depletedModelPath: "asset://models/trees/wood-tree-stump/wood-tree-stump.glb",
    scale: 1,
    depletedScale: 0.1,
    harvestSkill: "woodcutting",
    toolRequired: "bronze_hatchet",
    levelRequired: 30,
    baseCycleTicks: 4,
    depleteChance: 0.125,
    respawnTicks: 80,
    harvestYield: [
      {
        itemId: "logs",
        itemName: "Logs",
        quantity: 1,
        chance: 1,
        xpAmount: 67.5,
        stackable: true,
      },
    ],
  },
  tree_general: {
    id: "tree_general",
    name: "Tree",
    type: "tree",
    examine: "A common tree. I can chop it down with a hatchet.",
    modelPath: null,
    modelVariants: [
      "asset://models/trees/general/general_01.glb",
      "asset://models/trees/general/general_02.glb",
      "asset://models/trees/general/general_03.glb",
      "asset://models/trees/general/general_04.glb",
      "asset://models/trees/general/general_05.glb",
      "asset://models/trees/general/general_06.glb",
    ],
    depletedModelPath: "asset://models/trees/wood-tree-stump/wood-tree-stump.glb",
    scale: 1,
    depletedScale: 0.1,
    harvestSkill: "woodcutting",
    toolRequired: "bronze_hatchet",
    levelRequired: 1,
    baseCycleTicks: 4,
    depleteChance: 0.125,
    respawnTicks: 80,
    harvestYield: [
      {
        itemId: "logs",
        itemName: "Logs",
        quantity: 1,
        chance: 1,
        xpAmount: 25,
        stackable: true,
      },
    ],
  },
  tree_magic: {
    id: "tree_magic",
    name: "Magic Tree",
    type: "tree",
    examine: "A tree infused with magical energy.",
    modelPath: null,
    modelVariants: [
      "asset://models/trees/magic/magic_01.glb",
      "asset://models/trees/magic/magic_02.glb",
    ],
    depletedModelPath: "asset://models/trees/wood-tree-stump/wood-tree-stump.glb",
    scale: 1,
    depletedScale: 0.1,
    harvestSkill: "woodcutting",
    toolRequired: "bronze_hatchet",
    levelRequired: 60,
    baseCycleTicks: 4,
    depleteChance: 0.125,
    respawnTicks: 80,
    harvestYield: [
      {
        itemId: "magic_logs",
        itemName: "Magic Logs",
        quantity: 1,
        chance: 1,
        xpAmount: 250,
        stackable: true,
      },
    ],
  },
  tree_mahogany: {
    id: "tree_mahogany",
    name: "Mahogany Tree",
    type: "tree",
    examine: "A mahogany tree with rich, reddish-brown timber.",
    modelPath: null,
    modelVariants: [
      "asset://models/trees/mahogany/mahogany_01.glb",
      "asset://models/trees/mahogany/mahogany_02.glb",
    ],
    depletedModelPath: "asset://models/trees/wood-tree-stump/wood-tree-stump.glb",
    scale: 1,
    depletedScale: 0.1,
    harvestSkill: "woodcutting",
    toolRequired: "bronze_hatchet",
    levelRequired: 50,
    baseCycleTicks: 4,
    depleteChance: 0.125,
    respawnTicks: 80,
    harvestYield: [
      {
        itemId: "mahogany_logs",
        itemName: "Mahogany Logs",
        quantity: 1,
        chance: 1,
        xpAmount: 125,
        stackable: true,
      },
    ],
  },
};

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
 * Get all NPCs loaded from manifests
 */
export function getExternalNPCs(): Map<string, NPCData> {
  return ALL_NPCS;
}

/**
 * Get NPC by ID
 */
export function getExternalNPC(id: string): NPCData | null {
  return ALL_NPCS.get(id) || null;
}

/**
 * Get all external resources loaded from manifests
 */
export function getExternalResources(): Map<string, ExternalResourceData> {
  const resourceRoot = globalThis as {
    EXTERNAL_RESOURCES?: Map<string, ExternalResourceData>;
  };
  if (!resourceRoot.EXTERNAL_RESOURCES) {
    resourceRoot.EXTERNAL_RESOURCES = new Map();
  }
  return resourceRoot.EXTERNAL_RESOURCES;
}

/**
 * Get external resource by ID
 */
export function getExternalResource(id: string): ExternalResourceData | null {
  const resources = getExternalResources();
  const existing = resources.get(id);
  if (existing) {
    return existing;
  }
  const fallback = RESOURCE_FALLBACKS[id];
  if (!fallback) {
    return null;
  }
  resources.set(id, fallback);
  return fallback;
}

/**
 * Get all external buildings loaded from manifests
 */
export function getExternalBuildings(): Map<string, ExternalBuilding> {
  const buildings = (
    globalThis as { EXTERNAL_BUILDINGS?: Map<string, ExternalBuilding> }
  ).EXTERNAL_BUILDINGS;
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
  const avatars = (
    globalThis as { EXTERNAL_AVATARS?: Map<string, ExternalAvatar> }
  ).EXTERNAL_AVATARS;
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
 * Get all external gathering tools loaded from manifests
 */
export function getExternalTools(): Map<string, GatheringToolData> {
  const tools = (
    globalThis as { EXTERNAL_TOOLS?: Map<string, GatheringToolData> }
  ).EXTERNAL_TOOLS;
  return tools || new Map();
}

/**
 * Get external tool by item ID
 */
export function getExternalTool(itemId: string): GatheringToolData | null {
  const tools = getExternalTools();
  return tools.get(itemId) || null;
}

/**
 * Get all tools for a specific skill, sorted by priority (best first)
 */
export function getExternalToolsForSkill(
  skill: "woodcutting" | "mining" | "fishing",
): GatheringToolData[] {
  const tools = getExternalTools();
  return Array.from(tools.values())
    .filter((t) => t.skill === skill)
    .sort((a, b) => a.priority - b.priority);
}

/**
 * Check if external assets are loaded
 */
export function hasExternalAssets(): boolean {
  return (
    getExternalNPCs().size > 0 ||
    getExternalResources().size > 0 ||
    getExternalBuildings().size > 0 ||
    getExternalAvatars().size > 0 ||
    getExternalTools().size > 0
  );
}

/**
 * Get summary of loaded external assets
 */
export function getExternalAssetsSummary(): {
  npcs: number;
  resources: number;
  buildings: number;
  avatars: number;
  tools: number;
  total: number;
} {
  return {
    npcs: getExternalNPCs().size,
    resources: getExternalResources().size,
    buildings: getExternalBuildings().size,
    avatars: getExternalAvatars().size,
    tools: getExternalTools().size,
    total:
      getExternalNPCs().size +
      getExternalResources().size +
      getExternalBuildings().size +
      getExternalAvatars().size +
      getExternalTools().size,
  };
}
