/**
 * Location Resolver - Resolves place names to coordinates
 *
 * This utility allows natural language commands like "go to the furnace"
 * to be resolved to actual coordinates in the game world.
 */

import type { Entity } from "../types.js";

export interface ResolvedLocation {
  name: string;
  category: string;
  position: [number, number, number];
  distance?: number;
}

/**
 * Known location aliases - maps common names to entity names
 */
const LOCATION_ALIASES: Record<string, string[]> = {
  // Stations
  furnace: ["furnace", "smelter"],
  anvil: ["anvil", "smithing"],
  bank: ["bank", "banker", "bank booth", "bank clerk"],
  store: ["store", "shop", "shopkeeper", "general store"],
  range: ["range", "cooking range", "stove", "fire"],

  // Resources
  tree: ["tree", "trees", "forest", "woods", "oak", "willow", "maple", "yew"],
  "fishing spot": [
    "fishing spot",
    "fishing",
    "fish",
    "water",
    "pond",
    "lake",
    "river",
  ],
  ore: ["ore", "rock", "mining", "mine", "copper", "tin", "iron", "coal"],

  // Areas
  spawn: ["spawn", "start", "home", "origin"],
};

/**
 * Categorize an entity based on its name
 */
function categorizeEntity(entityName: string): string {
  const name = entityName.toLowerCase();

  if (name.includes("furnace") || name.includes("smelter")) return "station";
  if (name.includes("anvil")) return "station";
  if (name.includes("bank")) return "bank";
  if (name.includes("store") || name.includes("shop")) return "store";
  if (name.includes("range") || name.includes("stove")) return "station";
  if (name.includes("tree") || name.includes("oak") || name.includes("willow"))
    return "resource";
  if (name.includes("fish") || name.includes("spot")) return "resource";
  if (name.includes("ore") || name.includes("rock")) return "resource";
  if (name.includes("goblin") || name.includes("mob")) return "mob";
  if (name.includes("clerk") || name.includes("keeper")) return "npc";

  return "entity";
}

/**
 * Resolve a location query to coordinates
 *
 * @param query - The location query (e.g., "furnace", "fishing spot", "bank")
 * @param nearbyEntities - Array of nearby entities from the game
 * @param playerPosition - Current player position for distance calculation
 * @returns Resolved location or null if not found
 */
export function resolveLocation(
  query: string,
  nearbyEntities: Entity[],
  playerPosition?: [number, number, number],
): ResolvedLocation | null {
  const normalizedQuery = query.toLowerCase().trim();

  // Step 1: Try to match against known aliases
  let searchTerms: string[] = [normalizedQuery];

  for (const [canonical, aliases] of Object.entries(LOCATION_ALIASES)) {
    for (const alias of aliases) {
      if (
        normalizedQuery.includes(alias) ||
        alias.includes(normalizedQuery) ||
        normalizedQuery === canonical
      ) {
        // Add all aliases for this canonical name
        searchTerms = [...new Set([...searchTerms, canonical, ...aliases])];
        break;
      }
    }
  }

  // Step 2: Search nearby entities
  const matchingEntities: Array<{
    entity: Entity;
    distance: number;
    matchScore: number;
  }> = [];

  for (const entity of nearbyEntities) {
    const entityName = (entity.name || "").toLowerCase();

    // Calculate match score based on name only (Entity doesn't have type)
    let matchScore = 0;

    for (const term of searchTerms) {
      // Exact name match
      if (entityName === term) {
        matchScore = 100;
        break;
      }
      // Name contains term
      if (entityName.includes(term)) {
        matchScore = Math.max(matchScore, 80);
      }
      // Term contains entity name (partial match)
      if (term.includes(entityName) && entityName.length > 3) {
        matchScore = Math.max(matchScore, 60);
      }
    }

    if (matchScore > 0) {
      // Get entity position
      const pos = getEntityPosition(entity);
      if (pos) {
        const distance = playerPosition
          ? calculateDistance(playerPosition, pos)
          : 0;

        matchingEntities.push({
          entity,
          distance,
          matchScore,
        });
      }
    }
  }

  // Sort by match score (descending), then by distance (ascending)
  matchingEntities.sort((a, b) => {
    if (b.matchScore !== a.matchScore) {
      return b.matchScore - a.matchScore;
    }
    return a.distance - b.distance;
  });

  // Return the best match
  if (matchingEntities.length > 0) {
    const best = matchingEntities[0];
    const pos = getEntityPosition(best.entity)!;
    const entityName = best.entity.name || "Unknown";

    return {
      name: entityName,
      category: categorizeEntity(entityName),
      position: pos,
      distance: best.distance,
    };
  }

  return null;
}

/**
 * Get all matching locations for a query (for listing options)
 */
export function findAllLocations(
  query: string,
  nearbyEntities: Entity[],
  playerPosition?: [number, number, number],
  limit: number = 5,
): ResolvedLocation[] {
  const normalizedQuery = query.toLowerCase().trim();

  // Get search terms from aliases
  let searchTerms: string[] = [normalizedQuery];

  for (const [canonical, aliases] of Object.entries(LOCATION_ALIASES)) {
    for (const alias of aliases) {
      if (normalizedQuery.includes(alias) || alias.includes(normalizedQuery)) {
        searchTerms = [...new Set([...searchTerms, canonical, ...aliases])];
        break;
      }
    }
  }

  const results: ResolvedLocation[] = [];

  for (const entity of nearbyEntities) {
    const entityName = (entity.name || "").toLowerCase();

    // Check if entity matches any search term
    const matches = searchTerms.some(
      (term) => entityName.includes(term) || term.includes(entityName),
    );

    if (matches) {
      const pos = getEntityPosition(entity);
      if (pos) {
        const distance = playerPosition
          ? calculateDistance(playerPosition, pos)
          : 0;
        const name = entity.name || "Unknown";

        results.push({
          name,
          category: categorizeEntity(name),
          position: pos,
          distance,
        });
      }
    }
  }

  // Sort by distance and limit results
  return results
    .sort((a, b) => (a.distance || 0) - (b.distance || 0))
    .slice(0, limit);
}

/**
 * Extract position from entity (handles different position formats)
 */
function getEntityPosition(entity: Entity): [number, number, number] | null {
  const pos = entity.position;

  if (!pos) return null;

  if (Array.isArray(pos) && pos.length >= 3) {
    return [pos[0], pos[1], pos[2]];
  }

  if (typeof pos === "object" && "x" in pos) {
    const p = pos as unknown as { x: number; y: number; z: number };
    return [p.x, p.y, p.z];
  }

  return null;
}

/**
 * Calculate 3D distance between two points
 */
function calculateDistance(
  pos1: [number, number, number],
  pos2: [number, number, number],
): number {
  const dx = pos2[0] - pos1[0];
  const dy = pos2[1] - pos1[1];
  const dz = pos2[2] - pos1[2];
  return Math.sqrt(dx * dx + dy * dy + dz * dz);
}

/**
 * Parse a location query from a user message
 * Extracts the location name from messages like "go to the furnace"
 */
export function parseLocationFromMessage(message: string): string | null {
  const normalizedMessage = message.toLowerCase().trim();

  // Patterns to extract location from command
  const patterns = [
    /(?:go to|move to|walk to|run to|navigate to|head to|travel to)\s+(?:the\s+)?(?:a\s+)?(.+)/i,
    /(?:take me to|bring me to)\s+(?:the\s+)?(?:a\s+)?(.+)/i,
    /(?:find|locate)\s+(?:the\s+)?(?:a\s+)?(.+)/i,
    /(?:where is|where's)\s+(?:the\s+)?(?:a\s+)?(.+)/i,
  ];

  for (const pattern of patterns) {
    const match = normalizedMessage.match(pattern);
    if (match && match[1]) {
      // Clean up the extracted location
      let location = match[1].trim();
      // Remove trailing punctuation
      location = location.replace(/[.!?]+$/, "");
      // Remove common filler words at the end
      location = location.replace(/\s+(please|now|quickly)$/i, "");
      return location;
    }
  }

  return null;
}
