/**
 * NPC Database
 * 
 * NPCs are loaded from world/assets/manifests/npcs.json by DataManager.
 * This file provides access to NPC data loaded at runtime.
 * 
 * To add new NPCs:
 * 1. Add entries to world/assets/manifests/npcs.json
 * 2. Generate 3D models in 3D Asset Forge (optional)
 * 3. Restart the server to reload manifests
 */

/**
 * NPC data is stored in globalThis.EXTERNAL_NPCS by DataManager
 * Access via getExternalNPC() from ExternalAssetUtils
 */

export interface NPCData {
  id: string;
  name: string;
  type: string;
  npcType: string;
  description: string;
  modelPath: string;
  iconPath?: string;
  services: string[];
  dialogueLines: string[];
}

/**
 * Get NPC by ID from loaded manifest
 */
export function getNPC(npcId: string): NPCData | null {
  const npcs = (globalThis as { EXTERNAL_NPCS?: Map<string, NPCData> }).EXTERNAL_NPCS;
  if (!npcs) return null;
  return npcs.get(npcId) || null;
}

/**
 * Get all NPCs
 */
export function getAllNPCs(): NPCData[] {
  const npcs = (globalThis as { EXTERNAL_NPCS?: Map<string, NPCData> }).EXTERNAL_NPCS;
  if (!npcs) return [];
  return Array.from(npcs.values());
}

/**
 * Get NPCs by type
 */
export function getNPCsByType(type: string): NPCData[] {
  return getAllNPCs().filter(npc => npc.type === type || npc.npcType === type);
}

/**
 * Get NPCs by service
 */
export function getNPCsByService(service: string): NPCData[] {
  return getAllNPCs().filter(npc => npc.services?.includes(service));
}
