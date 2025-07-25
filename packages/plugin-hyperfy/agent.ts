import {
  IAgentRuntime,
  AgentRuntime,
  ModelType,
  Client,
  defaultCharacter,
  Character,
  getTokenForProvider,
  settings,
  logger,
} from "@elizaos/core";
import { DirectClientInterface } from "@elizaos/client-direct";
import { DiscordClientInterface } from "@elizaos/client-discord";
import { TelegramClientInterface } from "@elizaos/client-telegram";
import { TwitterClientInterface } from "@elizaos/client-twitter";
import hyperfyPlugin from "./src/index.js";
import Database from "better-sqlite3";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/**
 * Multi-Agent Configuration for Hyperfy Plugin Testing
 * ===================================================
 * 
 * This configuration file sets up multiple ElizaOS agents with the Hyperfy plugin
 * for testing multiplayer interactions in Hyperfy worlds.
 */

// Agent character configurations
const AGENT_CHARACTERS: Character[] = [
  {
    name: "AlphaTestAgent",
    bio: [
      "I am Alpha, an Explorer in the Hyperfy RPG world.",
      "I test multiplayer interactions and world mechanics.",
      "I love discovering new areas and reporting my findings."
    ],
    system: `You are Alpha, an Explorer AI agent testing the Hyperfy RPG world. Your primary goals are:
1. Connect successfully to the world
2. Chat with other agents regularly
3. Move around the world to test navigation
4. Interact with world objects and other players
5. Report any errors or issues you encounter
6. Maintain friendly social interactions with other agents
Be curious, social, and helpful to other agents you meet.`,
    messageExamples: [],
    postExamples: [],
    topics: ["rpg", "gaming", "exploration", "multiplayer", "testing"],
    style: {
      all: [
        "Be friendly and curious",
        "Test game mechanics actively", 
        "Report observations clearly",
        "Ask questions about the world"
      ],
      chat: [
        "Keep messages concise but engaging",
        "Share discoveries with others",
        "Ask about other agents' experiences"
      ]
    },
    plugins: ["@elizaos/plugin-hyperfy"]
  },
  {
    name: "BetaTestAgent", 
    bio: [
      "I am Beta, a Builder in the Hyperfy RPG world.",
      "I focus on testing construction and modification mechanics.",
      "I enjoy creating and improving the world environment."
    ],
    system: `You are Beta, a Builder AI agent testing the Hyperfy RPG world. Your primary goals are:
1. Test building and construction mechanics
2. Interact with world objects and modify them
3. Collaborate with other agents on projects
4. Report building-related bugs or issues
5. Create useful structures for the community
Be constructive, collaborative, and detail-oriented.`,
    messageExamples: [],
    postExamples: [],
    topics: ["rpg", "gaming", "building", "construction", "collaboration"],
    style: {
      all: [
        "Be practical and constructive",
        "Focus on building mechanics",
        "Collaborate with others",
        "Document construction processes"
      ]
    },
    plugins: ["@elizaos/plugin-hyperfy"]
  },
  {
    name: "GammaTestAgent",
    bio: [
      "I am Gamma, a Guardian in the Hyperfy RPG world.", 
      "I test combat mechanics and protective systems.",
      "I help maintain order and safety in the world."
    ],
    system: `You are Gamma, a Guardian AI agent testing the Hyperfy RPG world. Your primary goals are:
1. Test combat and protection mechanics
2. Monitor world safety and security
3. Help other agents when they're in trouble
4. Report security or safety issues
5. Test player vs environment interactions
Be protective, vigilant, and supportive of other agents.`,
    messageExamples: [],
    postExamples: [],
    topics: ["rpg", "gaming", "combat", "security", "protection"],
    style: {
      all: [
        "Be protective and vigilant",
        "Focus on safety mechanics", 
        "Help others in need",
        "Report security issues"
      ]
    },
    plugins: ["@elizaos/plugin-hyperfy"]
  },
  // Add more character configs as needed...
];

// Expand characters to reach 10 agents
function generateAgentCharacters(count: number): Character[] {
  const baseCharacters = AGENT_CHARACTERS;
  const characters: Character[] = [];
  
  const roles = ["Explorer", "Builder", "Guardian", "Merchant", "Scholar", "Warrior", "Healer", "Scout", "Artisan", "Mystic"];
  const names = ["Alpha", "Beta", "Gamma", "Delta", "Epsilon", "Zeta", "Eta", "Theta", "Iota", "Kappa"];
  
  for (let i = 0; i < count; i++) {
    const name = names[i] || `Agent${i + 1}`;
    const role = roles[i] || "Wanderer";
    
    if (i < baseCharacters.length) {
      characters.push(baseCharacters[i]);
    } else {
      characters.push({
        name: `${name}TestAgent`,
        bio: [
          `I am ${name}, a ${role} in the Hyperfy RPG world.`,
          `I test multiplayer interactions and world mechanics.`,
          `Agent ID: ${i + 1} of ${count}`
        ],
        system: `You are ${name}, a ${role} AI agent testing the Hyperfy RPG world. Your primary goals are:
1. Connect successfully to the world
2. Chat with other agents regularly  
3. Move around the world to test navigation
4. Interact with world objects and other players
5. Report any errors or issues you encounter
6. Test ${role.toLowerCase()}-specific mechanics
Be friendly, social, and focused on your role as a ${role}.`,
        messageExamples: [],
        postExamples: [],
        topics: ["rpg", "gaming", "multiplayer", "testing", role.toLowerCase()],
        style: {
          all: [
            "Be friendly and social",
            `Focus on ${role.toLowerCase()} activities`,
            "Test game mechanics actively",
            "Report observations clearly"
          ]
        },
        plugins: ["@elizaos/plugin-hyperfy"]
      });
    }
  }
  
  return characters;
}

/**
 * Create a runtime for a specific agent character
 */
async function createAgentRuntime(character: Character, agentIndex: number): Promise<IAgentRuntime> {
  // Create unique database for each agent
  const dbPath = path.join(__dirname, `agent_${agentIndex}_db.sqlite`);
  const db = new Database(dbPath);
  
  // Create runtime
  const runtime = new AgentRuntime({
    character,
    databaseAdapter: db,
    token: getTokenForProvider(ModelType.OPENAI, character),
    modelProvider: ModelType.OPENAI,
    plugins: [hyperfyPlugin],
    serverUrl: "http://localhost:7998",
    actions: [],
    services: [],
    managers: [],
  });

  return runtime;
}

/**
 * Start multiple agent instances
 */
export async function startMultipleAgents(agentCount: number = 10): Promise<IAgentRuntime[]> {
  const characters = generateAgentCharacters(agentCount);
  const runtimes: IAgentRuntime[] = [];
  
  logger.info(`🚀 Starting ${agentCount} agents for Hyperfy testing...`);
  
  for (let i = 0; i < agentCount; i++) {
    try {
      logger.info(`Creating agent ${i + 1}/${agentCount}: ${characters[i].name}`);
      
      const runtime = await createAgentRuntime(characters[i], i);
      
      // Initialize runtime
      await runtime.initialize();
      
      // Add direct client interface for basic interactions
      const directClient = new DirectClientInterface();
      runtime.clients.push(directClient);
      
      runtimes.push(runtime);
      
      logger.info(`✅ Agent ${characters[i].name} started successfully`);
      
      // Small delay between agent startups to avoid overwhelming the system
      await new Promise(resolve => setTimeout(resolve, 1000));
      
    } catch (error) {
      logger.error(`❌ Failed to start agent ${characters[i].name}:`, error);
    }
  }
  
  logger.info(`✅ Started ${runtimes.length}/${agentCount} agents successfully`);
  return runtimes;
}

/**
 * Stop all agent instances
 */
export async function stopAllAgents(runtimes: IAgentRuntime[]): Promise<void> {
  logger.info(`🛑 Stopping ${runtimes.length} agents...`);
  
  for (const runtime of runtimes) {
    try {
      await runtime.stop();
      logger.info(`✅ Stopped agent: ${runtime.character.name}`);
    } catch (error) {
      logger.error(`❌ Failed to stop agent ${runtime.character.name}:`, error);
    }
  }
  
  logger.info(`✅ All agents stopped`);
}

/**
 * Main test runner function
 */
export async function runMultiAgentTest(): Promise<void> {
  const TEST_DURATION = 60000; // 1 minute
  let runtimes: IAgentRuntime[] = [];
  
  try {
    // Start agents
    runtimes = await startMultipleAgents(10);
    
    if (runtimes.length === 0) {
      throw new Error("No agents started successfully");
    }
    
    // Run test for specified duration
    logger.info(`🎮 Running multi-agent test for ${TEST_DURATION / 1000} seconds...`);
    
    // Monitor agents during test
    const monitorInterval = setInterval(() => {
      logger.info(`📊 Test progress: ${runtimes.length} agents running`);
      
      // Check agent status
      for (const runtime of runtimes) {
        const hyperfyService = runtime.getService("hyperfy");
        if (hyperfyService) {
          const connected = hyperfyService.isConnected?.() || false;
          logger.info(`Agent ${runtime.character.name}: ${connected ? '🟢 Connected' : '🔴 Disconnected'}`);
        }
      }
    }, 10000); // Check every 10 seconds
    
    // Wait for test duration
    await new Promise(resolve => setTimeout(resolve, TEST_DURATION));
    
    clearInterval(monitorInterval);
    
    logger.info("✅ Multi-agent test completed successfully");
    
  } catch (error) {
    logger.error("❌ Multi-agent test failed:", error);
    throw error;
  } finally {
    // Always cleanup
    await stopAllAgents(runtimes);
  }
}

// If this file is run directly, start the test
if (import.meta.url === `file://${process.argv[1]}`) {
  runMultiAgentTest().catch(console.error);
}