/**
 * Default Agents Module - Spawns AI bot entities on server startup
 *
 * Creates 10 default bot entities that will roam the world,
 * fight mobs, gather resources, and interact with players.
 * These bots demonstrate the game's AI capabilities and
 * make the world feel alive even without human players.
 *
 * Agent Types:
 * - Adventurers: Combat-focused, explore dangerous areas
 * - Gatherers: Focus on woodcutting, fishing, resource collection
 * - Explorers: Wander the world, discover new areas
 * - Guards: Stay near towns, help new players
 */

import type { World } from "@hyperscape/shared";
import { EventType } from "@hyperscape/shared";

/**
 * Default agent configuration
 */
interface DefaultAgent {
  name: string;
  personality: string;
  behavior: "adventurer" | "gatherer" | "explorer" | "guard";
  startingArea: "spawn" | "forest" | "plains" | "town";
  bio: string[];
}

/**
 * The 10 default agents that spawn on server startup
 */
const DEFAULT_AGENTS: DefaultAgent[] = [
  // Adventurers - Combat focused
  {
    name: "Sir Vance",
    personality: "brave and honorable knight seeking glory in battle",
    behavior: "adventurer",
    startingArea: "spawn",
    bio: [
      "A seasoned warrior from Brookhaven.",
      "I hunt goblins and protect the weak.",
      "My sword arm is always ready for battle.",
    ],
  },
  {
    name: "Raven Shadowblade",
    personality: "mysterious rogue who hunts monsters in the shadows",
    behavior: "adventurer",
    startingArea: "forest",
    bio: [
      "They call me Raven. I work in the shadows.",
      "Monsters fear my blades.",
      "I prefer to work alone, but I help those in need.",
    ],
  },
  {
    name: "Greta Ironside",
    personality: "tough barbarian warrior from the northern reaches",
    behavior: "adventurer",
    startingArea: "plains",
    bio: [
      "I am Greta, warrior of the frozen north.",
      "My ancestors were legendary fighters.",
      "I seek worthy foes to test my strength.",
    ],
  },

  // Gatherers - Resource focused
  {
    name: "Willow Greenleaf",
    personality: "gentle woodcutter who communes with trees",
    behavior: "gatherer",
    startingArea: "forest",
    bio: [
      "I am one with the forest.",
      "I harvest wood sustainably, thanking each tree.",
      "The forest provides for those who respect it.",
    ],
  },
  {
    name: "Captain Finn",
    personality: "grizzled fisherman who knows every lake and stream",
    behavior: "gatherer",
    startingArea: "plains",
    bio: [
      "Been fishing these waters for twenty years.",
      "I know where the best catches swim.",
      "Nothing like a quiet day by the water.",
    ],
  },
  {
    name: "Ember Ashwood",
    personality: "skilled forager who gathers supplies for travelers",
    behavior: "gatherer",
    startingArea: "forest",
    bio: [
      "I collect resources for the community.",
      "Wood for fires, fish for food.",
      "Every traveler needs supplies.",
    ],
  },

  // Explorers - Discovery focused
  {
    name: "Marco Wanderer",
    personality: "curious explorer mapping the unknown regions",
    behavior: "explorer",
    startingArea: "spawn",
    bio: [
      "I chart the unknown corners of this world.",
      "Every horizon calls to me.",
      "Adventure awaits those who seek it.",
    ],
  },
  {
    name: "Luna Starseeker",
    personality: "mystical traveler drawn to ancient ruins",
    behavior: "explorer",
    startingArea: "plains",
    bio: [
      "The old ruins whisper secrets to me.",
      "I seek knowledge of the ancient kingdoms.",
      "The Calamity left many mysteries unsolved.",
    ],
  },

  // Guards - Protection focused
  {
    name: "Sergeant Drake",
    personality: "dedicated town guard who protects new adventurers",
    behavior: "guard",
    startingArea: "spawn",
    bio: [
      "I protect the spawn area and its people.",
      "New adventurers need guidance.",
      "The roads are dangerous - stay alert.",
    ],
  },
  {
    name: "Mira Shieldbearer",
    personality: "friendly guard who welcomes travelers",
    behavior: "guard",
    startingArea: "town",
    bio: [
      "Welcome to Hyperscape, traveler.",
      "I keep the peace and help those in need.",
      "The world is harsh, but we stand together.",
    ],
  },
];

/**
 * Area spawn coordinates (with randomness applied)
 */
function getSpawnPosition(area: string): [number, number, number] {
  const basePositions: Record<string, [number, number, number]> = {
    spawn: [0, 0, 0],
    forest: [50, 0, 50],
    plains: [-30, 0, 60],
    town: [20, 0, -20],
  };

  const base = basePositions[area] || basePositions.spawn;

  // Add randomness to avoid stacking
  const offsetX = (Math.random() - 0.5) * 30;
  const offsetZ = (Math.random() - 0.5) * 30;

  return [base[0] + offsetX, base[1], base[2] + offsetZ];
}

/**
 * Behavior movement patterns
 */
const BEHAVIOR_PATTERNS: Record<string, { range: number; interval: [number, number] }> = {
  adventurer: { range: 40, interval: [10000, 30000] }, // Larger range, faster movement
  gatherer: { range: 20, interval: [15000, 45000] }, // Medium range, slower movement
  explorer: { range: 60, interval: [20000, 60000] }, // Largest range, varied timing
  guard: { range: 15, interval: [30000, 60000] }, // Small range (patrol), slow timing
};

// Track spawned bots
const spawnedBots: Map<string, { name: string; behavior: string; intervalId?: ReturnType<typeof setInterval> }> = new Map();

/**
 * Create a bot entity in the game world
 */
function createBotEntity(
  world: World,
  agent: DefaultAgent,
): string {
  const botId = `bot-${agent.name.toLowerCase().replace(/\s+/g, "-")}-${Date.now()}`;
  const position = getSpawnPosition(agent.startingArea);

  console.log(`[DefaultAgents] Creating bot: ${agent.name} (${agent.behavior}) at [${position[0].toFixed(0)}, ${position[2].toFixed(0)}]`);

  // Create bot entity data (similar to player but marked as bot)
  const botData = {
    id: botId,
    type: "bot",
    name: agent.name,
    position,
    quaternion: [0, 0, 0, 1] as [number, number, number, number],
    
    // Bot appearance (player-like)
    playerName: agent.name,
    isBot: true,
    isAgent: true,
    
    // Stats
    health: { current: 100, max: 100 },
    stamina: { current: 100, max: 100 },
    alive: true,
    inCombat: false,
    
    // Combat level derived from skills
    skills: {
      attack: { level: 5 + Math.floor(Math.random() * 10), xp: 0 },
      strength: { level: 5 + Math.floor(Math.random() * 10), xp: 0 },
      defense: { level: 5 + Math.floor(Math.random() * 10), xp: 0 },
      constitution: { level: 10 + Math.floor(Math.random() * 10), xp: 0 },
      range: { level: 1 + Math.floor(Math.random() * 5), xp: 0 },
      woodcutting: { level: 5 + Math.floor(Math.random() * 15), xp: 0 },
      fishing: { level: 5 + Math.floor(Math.random() * 15), xp: 0 },
      firemaking: { level: 1 + Math.floor(Math.random() * 10), xp: 0 },
      cooking: { level: 1 + Math.floor(Math.random() * 10), xp: 0 },
    },
    
    // Basic equipment
    items: [
      { id: "bronze_sword", name: "Bronze Sword", quantity: 1, slot: 0 },
    ],
    equipment: {
      weapon: { id: "bronze_sword", name: "Bronze Sword" },
    },
    coins: 50 + Math.floor(Math.random() * 100),
    
    // Bot metadata
    behavior: agent.behavior,
    personality: agent.personality,
    bio: agent.bio,
    startingArea: agent.startingArea,
  };

  // Add to world entities
  const entities = world.entities as {
    add?: (data: unknown, broadcast?: boolean) => void;
  };

  if (entities.add) {
    entities.add(botData, true);
    console.log(`[DefaultAgents] ✅ Created bot: ${agent.name}`);
    return botId;
  } else {
    console.error(`[DefaultAgents] ❌ Could not create bot: ${agent.name} - entities.add not available`);
    return "";
  }
}

/**
 * Start bot behavior loop
 */
function startBotBehavior(
  world: World,
  botId: string,
  agent: DefaultAgent,
): void {
  const pattern = BEHAVIOR_PATTERNS[agent.behavior] || BEHAVIOR_PATTERNS.explorer;

  const behaviorTick = () => {
    // Get bot entity
    const entities = world.entities as {
      get?: (id: string) => unknown;
      items?: Map<string, unknown>;
    };

    const botEntity = entities.get?.(botId) || entities.items?.get(botId);

    if (!botEntity) {
      // Bot no longer exists, clean up
      const bot = spawnedBots.get(botId);
      if (bot?.intervalId) {
        clearInterval(bot.intervalId);
      }
      spawnedBots.delete(botId);
      return;
    }

    const entity = botEntity as {
      position?: [number, number, number];
      alive?: boolean;
      inCombat?: boolean;
    };

    // Only move if alive and not in combat
    if (entity.alive !== false && !entity.inCombat) {
      const currentPos = entity.position || [0, 0, 0];

      // Calculate new position within behavior range
      const angle = Math.random() * Math.PI * 2;
      const distance = Math.random() * pattern.range;

      const newX = currentPos[0] + Math.cos(angle) * distance;
      const newZ = currentPos[2] + Math.sin(angle) * distance;

      // Emit movement request for this bot
      world.emit(EventType.MOB_TILE_MOVE_REQUEST, {
        mobId: botId,
        targetPos: { x: newX, y: currentPos[1], z: newZ },
        tilesPerTick: 2,
      });
    }
  };

  // Calculate random interval within behavior pattern
  const getNextInterval = () => {
    const [min, max] = pattern.interval;
    return min + Math.random() * (max - min);
  };

  // Start behavior loop with variable timing
  const runBehavior = () => {
    behaviorTick();
    const nextInterval = getNextInterval();
    const intervalId = setTimeout(runBehavior, nextInterval);
    
    // Store interval for cleanup
    const bot = spawnedBots.get(botId);
    if (bot) {
      bot.intervalId = intervalId as unknown as ReturnType<typeof setInterval>;
    }
  };

  // Initial delay before first movement
  setTimeout(runBehavior, 3000 + Math.random() * 5000);

  console.log(`[DefaultAgents] Started ${agent.behavior} behavior for ${agent.name}`);
}

/**
 * Spawn all default agents on server startup
 *
 * @param world - The game world instance
 * @returns Promise resolving when all agents are spawned
 */
export async function spawnDefaultAgents(world: World): Promise<void> {
  console.log("[DefaultAgents] ═══════════════════════════════════════");
  console.log("[DefaultAgents] Spawning default AI agents...");
  console.log("[DefaultAgents] ═══════════════════════════════════════");

  let spawned = 0;

  for (const agent of DEFAULT_AGENTS) {
    try {
      const botId = createBotEntity(world, agent);

      if (botId) {
        spawnedBots.set(botId, { name: agent.name, behavior: agent.behavior });
        startBotBehavior(world, botId, agent);
        spawned++;
      }
    } catch (error) {
      console.error(`[DefaultAgents] Failed to spawn ${agent.name}:`, error);
    }
  }

  console.log("[DefaultAgents] ═══════════════════════════════════════");
  console.log(`[DefaultAgents] ✅ Spawned ${spawned}/${DEFAULT_AGENTS.length} default bots`);

  // List spawned bots
  spawnedBots.forEach((bot, _id) => {
    console.log(`[DefaultAgents]   - ${bot.name} (${bot.behavior})`);
  });

  console.log("[DefaultAgents] ═══════════════════════════════════════");
}

/**
 * Get the number of default agents
 */
export function getDefaultAgentCount(): number {
  return DEFAULT_AGENTS.length;
}

/**
 * Get list of spawned bot IDs
 */
export function getSpawnedAgents(): Map<string, { name: string; behavior: string }> {
  return spawnedBots;
}

/**
 * Stop all bot behaviors (for shutdown)
 */
export function stopAllBots(): void {
  spawnedBots.forEach((bot, _id) => {
    if (bot.intervalId) {
      clearInterval(bot.intervalId);
    }
  });
  spawnedBots.clear();
  console.log("[DefaultAgents] All bots stopped");
}
