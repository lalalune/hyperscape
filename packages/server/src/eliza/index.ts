/**
 * Embedded Eliza Agent Module
 *
 * This module provides embedded ElizaOS agent support for the Hyperia server.
 * Agents run directly in the server process with direct world access, eliminating
 * the need for external ElizaOS processes and WebSocket connections.
 *
 * Usage:
 * ```typescript
 * import { initializeAgents, getAgentManager } from './eliza';
 *
 * // During server startup
 * await initializeAgents(world, config);
 *
 * // Later, to manage agents
 * const manager = getAgentManager();
 * await manager.createAgent({ ... });
 * ```
 */

export { EmbeddedHyperiaService } from "./EmbeddedHyperiaService.js";
export {
  AgentManager,
  getAgentManager,
  setAgentManager,
} from "./AgentManager.js";
export type { HyperiaService } from "./AgentManager.js";
export type {
  EmbeddedAgentConfig,
  EmbeddedAgentInfo,
  AgentState,
  AgentCharacterConfig,
  EmbeddedGameState,
  NearbyEntityData,
  IEmbeddedHyperiaService,
} from "./types.js";

export {
  spawnModelAgents,
  getRunningAgents,
  getAgentRuntimeByCharacterId,
  stopModelAgent,
  stopAllModelAgents,
  getAvailableModels,
  MODEL_AGENTS,
} from "./ModelAgentSpawner.js";
export type { ModelProviderConfig } from "./ModelAgentSpawner.js";

// ElizaOS-powered duel bots (LLM agents for matchmaker)
export { ElizaDuelBot } from "./ElizaDuelBot.js";
export type {
  ElizaDuelBotConfig,
  ElizaDuelBotMetrics,
} from "./ElizaDuelBot.js";
export { ElizaDuelMatchmaker } from "./ElizaDuelMatchmaker.js";
export type {
  ElizaDuelMatchmakerConfig,
  MatchResult,
} from "./ElizaDuelMatchmaker.js";

// Shared agent helpers (plugin loading, character creation, model routing)
export {
  loadModelPlugin as loadAgentModelPlugin,
  loadSqlPlugin as loadAgentSqlPlugin,
  createAgentCharacter as createAgentCharacterConfig,
  buildModelSecrets,
  /** @deprecated PGLite replaced by InMemoryDatabaseAdapter */
  ensurePgliteDataDir,
  DEFAULT_SMALL_MODELS,
  MODEL_SETTING_KEYS,
  COMPETITIVE_SYSTEM_PROMPT,
} from "./agentHelpers.js";

import type { World } from "@hyperforge/shared";
import { AgentManager, setAgentManager } from "./AgentManager.js";
import { spawnModelAgents, getAvailableModels } from "./ModelAgentSpawner.js";

/**
 * Server configuration type (partial, for what we need)
 */
interface ServerConfig {
  autoStartAgents?: boolean;
  /** Spawn ElizaOS agents with different AI models (default: false in dev, true in production) */
  spawnModelAgents?: boolean;
  /** Maximum number of model agents to spawn */
  maxModelAgents?: number;
  /** Specific providers to spawn (openai, anthropic, groq, xai, elizacloud) */
  modelProviders?: Array<
    "openai" | "anthropic" | "groq" | "xai" | "openrouter" | "elizacloud"
  >;
}

/**
 * Initialize the embedded agent system
 *
 * This should be called during server startup after the world is created.
 *
 * @param world - The Hyperia world instance
 * @param config - Server configuration
 * @returns The initialized AgentManager
 */
export async function initializeAgents(
  world: World,
  config?: ServerConfig,
): Promise<AgentManager> {
  // Create the agent manager
  const manager = new AgentManager(world);

  // Set as global instance
  setAgentManager(manager);

  // Load agents from database if auto-start is enabled
  const autoStart = config?.autoStartAgents !== false;
  if (autoStart) {
    await manager.loadAgentsFromDatabase();
  }

  // Spawn ElizaOS agents with different AI models.
  // Default is conservative in development to avoid runaway RSS from
  // heavyweight model runtime initialization.
  const spawnEnvValue = process.env.SPAWN_MODEL_AGENTS;
  const spawnRequestedByEnv =
    spawnEnvValue == null || spawnEnvValue === ""
      ? null
      : spawnEnvValue !== "false";
  const streamingDuelEnabled = process.env.STREAMING_DUEL_ENABLED === "true";
  const defaultSpawnModelAgents =
    process.env.NODE_ENV === "production" || streamingDuelEnabled;
  const spawnRequested =
    config?.spawnModelAgents ?? spawnRequestedByEnv ?? defaultSpawnModelAgents;
  // Model agents (spawned via spawnModelAgents) are a separate system from
  // embedded agents (loaded from database via AgentManager). Previously,
  // stale isAgent=1 records from prior runs would set embeddedAgentCount > 0,
  // silently blocking model agent spawning. Model agents manage their own
  // deduplication via runningAgents Map, so this gate is unnecessary.
  const shouldSpawnAgents = spawnRequested;

  if (shouldSpawnAgents) {
    const availableModels = getAvailableModels();
    if (availableModels.length > 0) {
      const maxAgents =
        config?.maxModelAgents ??
        parseInt(process.env.MAX_MODEL_AGENTS || "25", 10);

      await spawnModelAgents(world, {
        maxAgents,
        providers: config?.modelProviders,
      });
    }
  }

  return manager;
}
