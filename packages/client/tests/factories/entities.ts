/**
 * Test Data Factories - Entities
 *
 * Provides factory functions for creating test entities.
 * Per project rules: Use real data structures, no mocks.
 *
 * @packageDocumentation
 */

/**
 * Position in 3D space
 */
export interface Position {
  x: number;
  y: number;
  z: number;
}

/**
 * Base entity properties
 */
export interface TestEntity {
  id: string;
  type: string;
  name: string;
  position: Position;
  rotation?: { x: number; y: number; z: number };
}

/**
 * Player entity for tests
 */
export interface TestPlayer extends TestEntity {
  type: "player";
  health: number;
  maxHealth: number;
  level: number;
  combatLevel: number;
  isLocal: boolean;
  equipment: Record<string, string | null>;
  skills: Record<string, { level: number; xp: number }>;
}

/**
 * Mob entity for tests
 */
export interface TestMob extends TestEntity {
  type: "mob";
  mobType: string;
  health: number;
  maxHealth: number;
  level: number;
  aggressive: boolean;
  respawnTime: number;
}

/**
 * NPC entity for tests
 */
export interface TestNPC extends TestEntity {
  type: "npc";
  npcType: string;
  dialogue: string[];
  shop?: { items: string[] };
}

/**
 * Counter for generating unique IDs
 */
let entityCounter = 0;

/**
 * Generates a unique entity ID
 */
function generateEntityId(prefix: string): string {
  return `${prefix}_${Date.now()}_${++entityCounter}`;
}

/**
 * Creates a default position
 */
export function createPosition(
  x: number = 0,
  y: number = 0,
  z: number = 0,
): Position {
  return { x, y, z };
}

/**
 * Creates a random position within bounds
 */
export function createRandomPosition(bounds: {
  minX?: number;
  maxX?: number;
  minZ?: number;
  maxZ?: number;
}): Position {
  const { minX = -50, maxX = 50, minZ = -50, maxZ = 50 } = bounds;
  return {
    x: Math.random() * (maxX - minX) + minX,
    y: 0,
    z: Math.random() * (maxZ - minZ) + minZ,
  };
}

/**
 * Creates a test player entity
 */
export function createTestPlayer(
  overrides: Partial<TestPlayer> = {},
): TestPlayer {
  return {
    id: generateEntityId("player"),
    type: "player",
    name: "TestPlayer",
    position: createPosition(0, 0, 0),
    health: 100,
    maxHealth: 100,
    level: 1,
    combatLevel: 3,
    isLocal: false,
    equipment: {
      weapon: null,
      shield: null,
      head: null,
      chest: null,
      legs: null,
      feet: null,
    },
    skills: {
      attack: { level: 1, xp: 0 },
      strength: { level: 1, xp: 0 },
      defense: { level: 1, xp: 0 },
      hitpoints: { level: 10, xp: 1154 },
      ranged: { level: 1, xp: 0 },
      magic: { level: 1, xp: 0 },
      prayer: { level: 1, xp: 0 },
    },
    ...overrides,
  };
}

/**
 * Creates the local player (the player controlled by the user)
 */
export function createLocalPlayer(
  overrides: Partial<TestPlayer> = {},
): TestPlayer {
  return createTestPlayer({
    name: "LocalPlayer",
    isLocal: true,
    ...overrides,
  });
}

/**
 * Creates a test mob entity
 */
export function createTestMob(overrides: Partial<TestMob> = {}): TestMob {
  return {
    id: generateEntityId("mob"),
    type: "mob",
    name: "Test Mob",
    mobType: "goblin",
    position: createPosition(10, 0, 10),
    health: 20,
    maxHealth: 20,
    level: 2,
    aggressive: false,
    respawnTime: 30000,
    ...overrides,
  };
}

/**
 * Common mob types
 */
export const mobs = {
  goblin: (overrides: Partial<TestMob> = {}): TestMob =>
    createTestMob({
      name: "Goblin",
      mobType: "goblin",
      health: 20,
      maxHealth: 20,
      level: 2,
      aggressive: true,
      ...overrides,
    }),

  chicken: (overrides: Partial<TestMob> = {}): TestMob =>
    createTestMob({
      name: "Chicken",
      mobType: "chicken",
      health: 3,
      maxHealth: 3,
      level: 1,
      aggressive: false,
      ...overrides,
    }),

  cow: (overrides: Partial<TestMob> = {}): TestMob =>
    createTestMob({
      name: "Cow",
      mobType: "cow",
      health: 10,
      maxHealth: 10,
      level: 1,
      aggressive: false,
      ...overrides,
    }),

  guard: (overrides: Partial<TestMob> = {}): TestMob =>
    createTestMob({
      name: "Guard",
      mobType: "guard",
      health: 50,
      maxHealth: 50,
      level: 21,
      aggressive: false,
      ...overrides,
    }),

  dragon: (overrides: Partial<TestMob> = {}): TestMob =>
    createTestMob({
      name: "Dragon",
      mobType: "dragon",
      health: 300,
      maxHealth: 300,
      level: 100,
      aggressive: true,
      ...overrides,
    }),
};

/**
 * Creates a test NPC entity
 */
export function createTestNPC(overrides: Partial<TestNPC> = {}): TestNPC {
  return {
    id: generateEntityId("npc"),
    type: "npc",
    name: "Test NPC",
    npcType: "shopkeeper",
    position: createPosition(5, 0, 5),
    dialogue: ["Hello, adventurer!", "How can I help you?"],
    ...overrides,
  };
}

/**
 * Common NPC types
 */
export const npcs = {
  banker: (overrides: Partial<TestNPC> = {}): TestNPC =>
    createTestNPC({
      name: "Banker",
      npcType: "banker",
      dialogue: [
        "Welcome to the bank!",
        "Would you like to access your account?",
      ],
      ...overrides,
    }),

  shopkeeper: (overrides: Partial<TestNPC> = {}): TestNPC =>
    createTestNPC({
      name: "Shopkeeper",
      npcType: "shopkeeper",
      dialogue: ["Welcome to my shop!", "Take a look at my wares."],
      shop: { items: ["bronze_sword", "bronze_shield", "health_potion"] },
      ...overrides,
    }),

  questGiver: (overrides: Partial<TestNPC> = {}): TestNPC =>
    createTestNPC({
      name: "Quest Giver",
      npcType: "quest_giver",
      dialogue: ["Greetings, adventurer!", "I have a task for you..."],
      ...overrides,
    }),
};

/**
 * Creates a scene with multiple entities
 */
export function createTestScene(): {
  player: TestPlayer;
  mobs: TestMob[];
  npcs: TestNPC[];
} {
  return {
    player: createLocalPlayer({ position: createPosition(0, 0, 0) }),
    mobs: [
      mobs.goblin({ position: createPosition(10, 0, 0) }),
      mobs.goblin({ position: createPosition(15, 0, 5) }),
      mobs.chicken({ position: createPosition(-5, 0, 10) }),
      mobs.cow({ position: createPosition(-10, 0, -5) }),
    ],
    npcs: [
      npcs.banker({ position: createPosition(20, 0, 20) }),
      npcs.shopkeeper({ position: createPosition(25, 0, 15) }),
    ],
  };
}

/**
 * Creates combat scenario with player near aggressive mob
 */
export function createCombatScenario(): {
  player: TestPlayer;
  target: TestMob;
} {
  return {
    player: createLocalPlayer({
      position: createPosition(0, 0, 0),
      health: 100,
      maxHealth: 100,
    }),
    target: mobs.goblin({
      position: createPosition(2, 0, 0), // Close to player
    }),
  };
}
