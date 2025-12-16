/**
 * Shared Game Helpers
 * 
 * Common utility functions used by A2A, MCP, and providers
 * for game state processing and world description generation.
 */

import type { Entity, PlayerEntity, Skills } from "../types.js";

// ============================================
// Location & Area Helpers
// ============================================

export interface AreaInfo {
  name: string;
  description: string;
  safeZone?: boolean;
}

const AREAS: Record<string, AreaInfo & { check: (x: number, z: number) => boolean }> = {
  spawn: {
    name: "Brookhaven",
    description: "A peaceful starter town with cobblestone paths. Bank and general store nearby.",
    safeZone: true,
    check: (x, z) => Math.abs(x) < 100 && Math.abs(z) < 100
  },
  mistwood: {
    name: "Mistwood Valley",
    description: "A foggy forest with scattered oak trees. Goblin camps dot the landscape.",
    check: (x, z) => x < -100 && z < 200 && z > -200
  },
  goblinWastes: {
    name: "The Goblin Wastes",
    description: "Barren rocky terrain dominated by organized goblin tribes.",
    check: (x, z) => x > 100 && z < 200 && z > -200
  },
  darkwood: {
    name: "Darkwood Forest", 
    description: "Dense ancient forest. Dark warriors train in the shadows.",
    check: (x, z) => x > 50 && z > 200
  },
  lakes: {
    name: "The Great Lakes",
    description: "Interconnected lakes with fishing spots. Bandits control crossings.",
    check: (_x, z) => z < -200 && z > -400
  },
  northernReaches: {
    name: "Northern Reaches",
    description: "Frozen tundra where ancient frozen warriors stand guard.",
    check: (_x, z) => z < -400
  },
  blastedLands: {
    name: "The Blasted Lands",
    description: "Desolate wasteland corrupted by the ancient Calamity.",
    check: (_x, z) => z > 400
  }
};

export function determineArea(position: [number, number, number]): AreaInfo {
  const [x, , z] = position;
  
  for (const area of Object.values(AREAS)) {
    if (area.check(x, z)) {
      return { name: area.name, description: area.description, safeZone: area.safeZone };
    }
  }
  
  return { name: "The Wilderness", description: "Open terrain between major regions." };
}

// ============================================
// Distance & Direction Helpers
// ============================================

export function calculateDistance(
  pos1: [number, number, number], 
  pos2: [number, number, number]
): number {
  const dx = pos1[0] - pos2[0];
  const dz = pos1[2] - pos2[2];
  return Math.sqrt(dx * dx + dz * dz);
}

export function getDirection(
  from: [number, number, number], 
  to: [number, number, number]
): string {
  const dx = to[0] - from[0];
  const dz = to[2] - from[2];
  
  let direction = "";
  if (dz < -5) direction += "north";
  if (dz > 5) direction += "south";
  if (dx > 5) direction += "east";
  if (dx < -5) direction += "west";
  
  return direction || "nearby";
}

export function directionToOffset(
  direction: string, 
  distance: number
): { dx: number; dz: number } {
  let dx = 0, dz = 0;
  const dir = direction.toLowerCase();
  
  if (dir.includes("north")) dz -= distance;
  if (dir.includes("south")) dz += distance;
  if (dir.includes("east")) dx += distance;
  if (dir.includes("west")) dx -= distance;
  
  return { dx, dz };
}

// ============================================
// Combat & Skills Helpers
// ============================================

export function calculateCombatLevel(skills: Skills): number {
  const defense = skills.defense?.level ?? 1;
  const constitution = skills.constitution?.level ?? 10;
  const attack = skills.attack?.level ?? 1;
  const strength = skills.strength?.level ?? 1;
  const ranged = skills.ranged?.level ?? 1;
  
  const base = Math.floor(0.25 * (defense + constitution));
  const melee = Math.floor(0.325 * (attack + strength));
  const rangedBonus = Math.floor(0.325 * 1.5 * ranged);
  
  return base + Math.max(melee, rangedBonus);
}

export type ThreatLevel = "safe" | "low" | "medium" | "high" | "dangerous";

const THREAT_PATTERNS: Record<ThreatLevel, string[]> = {
  safe: ["goblin", "rat", "spider", "chicken"],
  low: [],
  medium: ["hobgoblin", "bandit", "wolf", "guard"],
  high: ["dark warrior", "barbarian", "skeleton"],
  dangerous: ["black knight", "ice warrior", "dark ranger"]
};

export function assessThreat(mobName: string, playerCombatLevel: number): ThreatLevel {
  const nameLower = mobName.toLowerCase();
  
  for (const pattern of THREAT_PATTERNS.dangerous) {
    if (nameLower.includes(pattern)) {
      return playerCombatLevel >= 30 ? "high" : "dangerous";
    }
  }
  
  for (const pattern of THREAT_PATTERNS.high) {
    if (nameLower.includes(pattern)) {
      return playerCombatLevel >= 20 ? "medium" : "high";
    }
  }
  
  for (const pattern of THREAT_PATTERNS.medium) {
    if (nameLower.includes(pattern)) {
      return playerCombatLevel >= 10 ? "low" : "medium";
    }
  }
  
  for (const pattern of THREAT_PATTERNS.safe) {
    if (nameLower.includes(pattern)) {
      return "safe";
    }
  }
  
  return "low";
}

// ============================================
// Entity Categorization Helpers
// ============================================

export interface CategorizedEntities {
  mobs: Array<Entity & { distance: number; direction: string; threat?: ThreatLevel }>;
  resources: Array<Entity & { distance: number; direction: string }>;
  items: Array<Entity & { distance: number }>;
  players: Array<Entity & { distance: number }>;
}

export function categorizeEntities(
  entities: Entity[],
  playerPos: [number, number, number],
  playerId?: string,
  combatLevel?: number
): CategorizedEntities {
  const result: CategorizedEntities = {
    mobs: [],
    resources: [],
    items: [],
    players: []
  };
  
  for (const entity of entities) {
    if (playerId && entity.id === playerId) continue;
    
    const entityAny = entity as unknown as Record<string, unknown>;
    const dist = calculateDistance(playerPos, entity.position);
    const dir = getDirection(playerPos, entity.position);
    
    if ("mobType" in entity || entityAny.type === "mob" ||
        (entity.name && /goblin|bandit|warrior|knight|skeleton|wolf|spider|rat/i.test(entity.name))) {
      if (entityAny.alive !== false) {
        const threat = combatLevel ? assessThreat(entity.name || "unknown", combatLevel) : undefined;
        result.mobs.push({ ...entity, distance: dist, direction: dir, threat });
      }
    } else if ("resourceType" in entity ||
        (entity.name && /tree|rock|ore|fish/i.test(entity.name) && !entity.name.startsWith("item:"))) {
      result.resources.push({ ...entity, distance: dist, direction: dir });
    } else if (entity.name?.startsWith("item:")) {
      result.items.push({ ...entity, distance: dist });
    } else if ("playerId" in entity) {
      result.players.push({ ...entity, distance: dist });
    }
  }
  
  // Sort by distance
  result.mobs.sort((a, b) => a.distance - b.distance);
  result.resources.sort((a, b) => a.distance - b.distance);
  result.items.sort((a, b) => a.distance - b.distance);
  result.players.sort((a, b) => a.distance - b.distance);
  
  return result;
}

// ============================================
// Player Status Helpers
// ============================================

export interface PlayerStatus {
  id: string;
  name?: string;
  alive: boolean;
  health: { current: number; max: number; percent: number };
  stamina: { current: number; max: number; percent: number };
  position: [number, number, number];
  inCombat: boolean;
  combatTarget?: string | null;
  combatLevel: number;
  coins: number;
}

export function getPlayerStatus(player: PlayerEntity): PlayerStatus {
  const healthCurrent = player.health?.current ?? 100;
  const healthMax = player.health?.max ?? 100;
  const staminaCurrent = player.stamina?.current ?? 100;
  const staminaMax = player.stamina?.max ?? 100;
  
  return {
    id: player.id,
    name: player.playerName,
    alive: player.alive !== false,
    health: {
      current: healthCurrent,
      max: healthMax,
      percent: healthMax > 0 ? Math.round((healthCurrent / healthMax) * 100) : 100
    },
    stamina: {
      current: staminaCurrent,
      max: staminaMax,
      percent: staminaMax > 0 ? Math.round((staminaCurrent / staminaMax) * 100) : 100
    },
    position: player.position ?? [0, 0, 0],
    inCombat: player.inCombat ?? false,
    combatTarget: player.combatTarget,
    combatLevel: player.skills ? calculateCombatLevel(player.skills) : 3,
    coins: player.coins ?? 0
  };
}

// ============================================
// Scene Description Generation
// ============================================

export interface SceneDescriptionOptions {
  maxMobs?: number;
  maxResources?: number;
  maxItems?: number;
  maxPlayers?: number;
  includeStatus?: boolean;
  includeSuggestions?: boolean;
}

export function generateSceneDescription(
  player: PlayerEntity,
  entities: Entity[],
  options: SceneDescriptionOptions = {}
): string {
  const {
    maxMobs = 5,
    maxResources = 4,
    maxItems = 4,
    maxPlayers = 3,
    includeStatus = true,
    includeSuggestions = true
  } = options;
  
  const lines: string[] = [];
  const playerPos = player.position ?? [0, 0, 0];
  const status = getPlayerStatus(player);
  
  // Location header
  const area = determineArea(playerPos);
  lines.push(`=== ${area.name} ===`);
  lines.push(area.description);
  if (area.safeZone) {
    lines.push("✅ SAFE ZONE");
  }
  lines.push("");
  
  // Categorize and describe entities
  const categorized = categorizeEntities(entities, playerPos, player.id, status.combatLevel);
  
  // Threats first (most important)
  if (categorized.mobs.length > 0) {
    const threats = categorized.mobs.filter(m => m.threat === "dangerous" || m.threat === "high");
    const safe = categorized.mobs.filter(m => m.threat === "safe" || m.threat === "low" || !m.threat);
    
    if (threats.length > 0) {
      lines.push("⚠️ THREATS:");
      for (const mob of threats.slice(0, 3)) {
        lines.push(`  • ${mob.name} [${(mob.threat || "unknown").toUpperCase()}] - ${Math.round(mob.distance)}m ${mob.direction}`);
      }
    }
    
    if (safe.length > 0) {
      lines.push("CREATURES:");
      for (const mob of safe.slice(0, maxMobs - threats.length)) {
        lines.push(`  • ${mob.name} - ${Math.round(mob.distance)}m ${mob.direction}`);
      }
    }
    lines.push("");
  }
  
  if (categorized.resources.length > 0) {
    lines.push("RESOURCES:");
    for (const res of categorized.resources.slice(0, maxResources)) {
      lines.push(`  • ${res.name} - ${Math.round(res.distance)}m ${res.direction}`);
    }
    lines.push("");
  }
  
  if (categorized.items.length > 0) {
    lines.push("GROUND ITEMS:");
    for (const item of categorized.items.slice(0, maxItems)) {
      const itemName = item.name?.replace("item:", "") || "Unknown";
      lines.push(`  • ${itemName} - ${Math.round(item.distance)}m`);
    }
    lines.push("");
  }
  
  if (categorized.players.length > 0) {
    lines.push("OTHER PLAYERS:");
    for (const p of categorized.players.slice(0, maxPlayers)) {
      lines.push(`  • ${p.name} - ${Math.round(p.distance)}m`);
    }
    lines.push("");
  }
  
  // Player status
  if (includeStatus) {
    lines.push(`Health: ${status.health.percent}% | Stamina: ${status.stamina.percent}%`);
    if (status.inCombat) {
      lines.push("⚔️ IN COMBAT");
    }
    lines.push("");
  }
  
  // Contextual suggestions
  if (includeSuggestions) {
    lines.push("💡 SUGGESTIONS:");
    if (status.health.percent < 30 && categorized.mobs.length > 0) {
      lines.push("  • Low health - flee or eat food");
    } else if (categorized.mobs.length > 0 && !status.inCombat) {
      lines.push(`  • ${categorized.mobs.length} creature(s) nearby for combat`);
    } else if (categorized.resources.length > 0) {
      lines.push(`  • ${categorized.resources.length} resource(s) to gather`);
    } else if (categorized.items.length > 0) {
      lines.push(`  • ${categorized.items.length} item(s) to pick up`);
    } else if (!area.safeZone) {
      lines.push("  • Area clear - explore or return to town");
    } else {
      lines.push("  • In town - bank, shop, or venture out");
    }
  }
  
  return lines.join("\n");
}

