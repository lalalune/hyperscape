/**
 * AgentManager - Manages embedded ElizaOS agent runtimes
 *
 * This manager handles:
 * - Creating and initializing agent runtimes
 * - Starting and stopping agents
 * - Providing agent status and control
 * - Managing agent lifecycle
 *
 * Behavior loop, action selection, and command dispatch are delegated to:
 * - AgentBehaviorTicker (autonomous behavior, quest management, combat chat)
 * - AgentCommandDispatcher (routing string-based commands to service methods)
 *
 * Unlike external ElizaOS processes, these agents run directly in the
 * Hyperscape server process with direct world access.
 */

import {
  AgentRuntime,
  ChannelType,
  mergeCharacterDefaults,
  stringToUuid,
  type Plugin,
} from "@elizaos/core";
import { createJWT } from "../shared/utils.js";
import { errMsg } from "../shared/errMsg.js";
import { EventType } from "@hyperscape/shared";
import { EmbeddedHyperscapeService } from "./EmbeddedHyperscapeService.js";
import {
  ejectAgentFromCombatArena,
  recoverAgentFromDeathLoop,
} from "./agentRecovery.js";

/**
 * Dynamically import the Hyperscape plugin to avoid hard dependency in dev.
 * Returns null if AI plugins are disabled or the module fails to load.
 */
async function getHyperscapePlugin(): Promise<Plugin | null> {
  if (process.env.DISABLE_AI === "true" || process.env.ENABLE_AI === "false") {
    console.warn("[AgentManager] AI plugins disabled via env");
    return null;
  }

  try {
    const mod = await import("@hyperscape/plugin-hyperscape");
    return mod.hyperscapePlugin;
  } catch (err) {
    console.warn(
      "[AgentManager] Failed to load @hyperscape/plugin-hyperscape:",
      errMsg(err),
    );
    return null;
  }
}

/**
 * Dynamically import the SQL plugin required for ElizaOS database operations.
 * Returns the plugin or null if not available.
 */
async function getSqlPlugin(): Promise<Plugin | null> {
  try {
    const mod = await import("@elizaos/plugin-sql");
    const sqlPlugin = mod.plugin ?? mod.default;
    if (sqlPlugin) {
      console.log("[AgentManager] Loaded SQL plugin for database support");
      return sqlPlugin;
    }
    console.warn(
      "[AgentManager] SQL plugin module loaded but no plugin export found. Exports:",
      Object.keys(mod),
    );
    return null;
  } catch (err) {
    console.warn("[AgentManager] Failed to load SQL plugin:", errMsg(err));
    return null;
  }
}

/**
 * Dynamically import the appropriate model provider plugin based on available API keys.
 * Returns the plugin or null if no API key is configured.
 *
 * Note: We return Plugin type but dynamically imported plugins may have slightly different
 * type definitions due to nested node_modules. The runtime handles this correctly.
 */
async function getModelProviderPlugin(): Promise<Plugin | null> {
  // Check for OpenAI API key first (most common)
  if (process.env.OPENAI_API_KEY) {
    try {
      const mod = await import("@elizaos/plugin-openai");
      console.log("[AgentManager] Using OpenAI model provider");
      return mod.openaiPlugin;
    } catch (err) {
      console.warn("[AgentManager] Failed to load OpenAI plugin:", errMsg(err));
    }
  }

  // Check for Anthropic API key
  if (process.env.ANTHROPIC_API_KEY) {
    try {
      const mod = await import("@elizaos/plugin-anthropic");
      console.log("[AgentManager] Using Anthropic model provider");
      return mod.anthropicPlugin ?? mod.default;
    } catch (err) {
      console.warn(
        "[AgentManager] Failed to load Anthropic plugin:",
        errMsg(err),
      );
    }
  }

  // Check for OpenRouter API key
  if (process.env.OPENROUTER_API_KEY) {
    try {
      const mod = await import("@elizaos/plugin-openrouter");
      console.log("[AgentManager] Using OpenRouter model provider");
      return mod.openrouterPlugin ?? mod.default;
    } catch (err) {
      console.warn(
        "[AgentManager] Failed to load OpenRouter plugin:",
        errMsg(err),
      );
    }
  }

  // Fall back to Ollama for local development (no API key needed)
  try {
    const mod = await import("@elizaos/plugin-ollama");
    console.log("[AgentManager] Using Ollama model provider (local fallback)");
    return mod.ollamaPlugin;
  } catch (err) {
    console.warn("[AgentManager] Failed to load Ollama plugin:", errMsg(err));
  }

  console.warn(
    "[AgentManager] No model provider available! Set OPENAI_API_KEY, ANTHROPIC_API_KEY, or OPENROUTER_API_KEY",
  );
  return null;
}
import type { World } from "@hyperscape/shared";

type Equipment = {
  helmet?: unknown;
  amulet?: unknown;
  gloves?: unknown;
  boots?: unknown;
  weapon?: unknown;
  shield?: unknown;
  body?: unknown;
  legs?: unknown;
  cape?: unknown;
  ring?: unknown;
  arrows?: unknown;
};

/**
 * Interface for the HyperscapeService methods used by AgentManager.
 * This mirrors the plugin-hyperscape HyperscapeService but avoids direct dependency.
 */
export interface HyperscapeService {
  /** Enable or disable autonomous behavior */
  setAutonomousBehaviorEnabled?(enabled: boolean): void;

  /** Get the current game state cache */
  getGameState(): {
    playerEntity: {
      id: string;
      position: [number, number, number] | { x: number; y?: number; z: number };
      health?: { current: number; max: number };
      items: Array<{
        id: string;
        itemId?: string;
        name?: string;
        item?: { name?: string };
      }>;
    } | null;
  };

  /** Get player entity */
  getPlayerEntity(): {
    items: Array<{
      id: string;
      itemId?: string;
      name?: string;
      item?: { name?: string };
    }>;
  } | null;

  /** Get nearby entities */
  getNearbyEntities(): Array<{
    id: string;
    harvestSkill?:
      | "woodcutting"
      | "fishing"
      | "mining"
      | "firemaking"
      | "cooking";
    resourceType?: string;
  }>;

  /** Execute movement command */
  executeMove(command: {
    target: [number, number, number];
    runMode?: boolean;
    cancel?: boolean;
  }): Promise<void>;

  /** Execute attack command */
  executeAttack(command: { targetEntityId: string }): Promise<void>;

  /** Execute gather resource command */
  executeGatherResource(command: {
    resourceEntityId: string;
    skill: "woodcutting" | "fishing" | "mining" | "firemaking" | "cooking";
  }): Promise<void>;

  /** Execute pickup item command */
  executePickupItem(itemId: string): Promise<void>;

  /** Execute drop item command */
  executeDropItem(
    itemId: string,
    quantity?: number,
    slot?: number,
  ): Promise<void>;

  /** Execute equip item command */
  executeEquipItem(command: {
    itemId: string;
    equipSlot: keyof Equipment;
  }): Promise<void>;

  /** Execute use item command */
  executeUseItem(command: { itemId: string; slot?: number }): Promise<void>;

  /** Execute chat message command */
  executeChatMessage(command: { message: string }): Promise<void>;
}
import type { DatabaseSystem } from "../systems/DatabaseSystem/index.js";
import type {
  EmbeddedAgentConfig,
  EmbeddedAgentInfo,
  AgentState,
} from "./types.js";
import {
  AgentBehaviorTicker,
  EMBEDDED_AGENT_AUTONOMY_ENABLED,
  setAgentAutonomyIfSupported,
  type AgentInstance,
} from "./managers/AgentBehaviorTicker.js";
import { AgentCommandDispatcher } from "./managers/AgentCommandDispatcher.js";

/**
 * AgentManager manages the lifecycle of embedded ElizaOS agents.
 *
 * Behavior loop and action selection are handled by AgentBehaviorTicker.
 * Command dispatch is handled by AgentCommandDispatcher.
 */
export class AgentManager {
  private world: World;
  private agents: Map<string, AgentInstance> = new Map();
  private isShuttingDown: boolean = false;
  readonly behaviorTicker: AgentBehaviorTicker;
  private readonly commandDispatcher: AgentCommandDispatcher;
  /** Stored event handler reference for cleanup during shutdown */
  private readonly combatDamageHandler: (data: unknown) => void;

  constructor(world: World) {
    this.world = world;
    this.behaviorTicker = new AgentBehaviorTicker(
      world,
      (id) => this.agents.get(id),
      () => Array.from(this.agents.keys()),
    );
    this.commandDispatcher = new AgentCommandDispatcher((id) =>
      this.agents.get(id),
    );

    // Subscribe to combat events for chat reactions (store ref for cleanup)
    this.combatDamageHandler = (data: unknown) => {
      this.behaviorTicker.handleCombatDamageDealt(data);
    };
    this.world.on(EventType.COMBAT_DAMAGE_DEALT, this.combatDamageHandler);

    console.log("[AgentManager] Initialized with combat chat reactions");
  }

  // ─── LIFECYCLE ──────────────────────────────────────────────────────

  /**
   * Create and optionally start an embedded agent
   *
   * @param config - Agent configuration
   * @returns The agent's character ID
   */
  async createAgent(config: EmbeddedAgentConfig): Promise<string> {
    const { characterId, accountId, name } = config;

    // Check if agent already exists
    if (this.agents.has(characterId)) {
      console.warn(
        `[AgentManager] Agent ${characterId} already exists, returning existing`,
      );
      return characterId;
    }

    console.log(`[AgentManager] Creating agent: ${name} (${characterId})`);

    // Create the embedded service
    const service = new EmbeddedHyperscapeService(
      this.world,
      characterId,
      accountId,
      name,
    );

    // Track the agent
    const instance: AgentInstance = {
      config,
      service,
      state: "initializing",
      startedAt: Date.now(),
      lastActivity: Date.now(),
      behaviorInterval: null,
      goal: null,
      questsAccepted: new Set(),
      currentTargetId: null,
      lastAteAt: 0,
      dropCooldownUntil: 0,
      lastGatherTargetId: null,
      lastGatherQueuedAt: 0,
      pendingChatReaction: null,
      lastCombatChatAt: 0,
    };

    this.agents.set(characterId, instance);

    // Auto-start if configured
    if (config.autoStart !== false) {
      try {
        await this.startAgent(characterId);
      } catch (err) {
        instance.state = "error";
        instance.error = errMsg(err);
        console.error(
          `[AgentManager] Failed to auto-start agent ${name}:`,
          instance.error,
        );
      }
    }

    return characterId;
  }

  /**
   * Start an agent (spawn player entity and begin autonomous behavior)
   *
   * @param characterId - The agent's character ID
   */
  async startAgent(characterId: string): Promise<void> {
    const instance = this.agents.get(characterId);
    if (!instance) {
      throw new Error(`Agent ${characterId} not found`);
    }

    if (instance.state === "running") {
      console.log(`[AgentManager] Agent ${characterId} is already running`);
      return;
    }

    console.log(
      `[AgentManager] Starting agent: ${instance.config.name} (${characterId})`,
    );

    instance.state = "initializing";
    instance.lastActivity = Date.now();

    try {
      // Initialize the embedded service (spawns player entity)
      await instance.service.initialize();

      instance.state = "running";
      instance.lastActivity = Date.now();
      instance.error = undefined;

      // Start autonomous behavior loop for embedded agents.
      if (EMBEDDED_AGENT_AUTONOMY_ENABLED) {
        this.behaviorTicker.startBehaviorLoop(characterId);
      } else {
        setAgentAutonomyIfSupported(
          instance.service as unknown as HyperscapeService,
          false,
        );
        console.log(
          `[AgentManager] Autonomous behavior disabled for ${instance.config.name} via EMBEDDED_AGENT_AUTONOMY_ENABLED=false`,
        );
      }

      console.log(
        `[AgentManager] Agent ${instance.config.name} is now running`,
      );
    } catch (err) {
      instance.state = "error";
      instance.error = errMsg(err);
      throw err;
    }
  }

  /**
   * Stop an agent (remove from world, stop autonomous behavior)
   *
   * @param characterId - The agent's character ID
   */
  async stopAgent(characterId: string): Promise<void> {
    const instance = this.agents.get(characterId);
    if (!instance) {
      throw new Error(`Agent ${characterId} not found`);
    }

    if (instance.state === "stopped") {
      console.log(`[AgentManager] Agent ${characterId} is already stopped`);
      return;
    }

    console.log(
      `[AgentManager] Stopping agent: ${instance.config.name} (${characterId})`,
    );

    try {
      // Stop autonomous behavior first.
      this.behaviorTicker.stopBehaviorLoop(characterId);

      await instance.service.stop();
      instance.state = "stopped";
      instance.lastActivity = Date.now();

      console.log(`[AgentManager] Agent ${instance.config.name} stopped`);
    } catch (err) {
      instance.state = "error";
      instance.error = errMsg(err);
      throw err;
    }
  }

  /**
   * Pause an agent (keep entity but stop autonomous behavior)
   *
   * @param characterId - The agent's character ID
   */
  async pauseAgent(characterId: string): Promise<void> {
    const instance = this.agents.get(characterId);
    if (!instance) {
      throw new Error(`Agent ${characterId} not found`);
    }

    if (instance.state !== "running") {
      console.log(
        `[AgentManager] Agent ${characterId} is not running (state: ${instance.state})`,
      );
      return;
    }

    console.log(
      `[AgentManager] Pausing agent: ${instance.config.name} (${characterId})`,
    );

    // Stop autonomous behavior without removing the entity.
    this.behaviorTicker.stopBehaviorLoop(characterId);
    instance.state = "paused";
    instance.lastActivity = Date.now();

    console.log(`[AgentManager] Agent ${instance.config.name} paused`);
  }

  /**
   * Resume a paused agent
   *
   * @param characterId - The agent's character ID
   */
  async resumeAgent(characterId: string): Promise<void> {
    const instance = this.agents.get(characterId);
    if (!instance) {
      throw new Error(`Agent ${characterId} not found`);
    }

    if (instance.state !== "paused") {
      console.log(
        `[AgentManager] Agent ${characterId} is not paused (state: ${instance.state})`,
      );
      return;
    }

    console.log(
      `[AgentManager] Resuming agent: ${instance.config.name} (${characterId})`,
    );

    instance.state = "running";
    instance.lastActivity = Date.now();
    if (EMBEDDED_AGENT_AUTONOMY_ENABLED) {
      this.behaviorTicker.startBehaviorLoop(characterId);
    } else {
      setAgentAutonomyIfSupported(
        instance.service as unknown as HyperscapeService,
        false,
      );
    }

    console.log(`[AgentManager] Agent ${instance.config.name} resumed`);
  }

  /**
   * Remove an agent completely
   *
   * @param characterId - The agent's character ID
   */
  async removeAgent(characterId: string): Promise<void> {
    const instance = this.agents.get(characterId);
    if (!instance) {
      console.log(
        `[AgentManager] Agent ${characterId} not found, nothing to remove`,
      );
      return;
    }

    console.log(
      `[AgentManager] Removing agent: ${instance.config.name} (${characterId})`,
    );

    // Stop first if running
    if (instance.state === "running" || instance.state === "paused") {
      await this.stopAgent(characterId);
    }

    // Remove from tracking
    this.agents.delete(characterId);

    console.log(`[AgentManager] Agent ${instance.config.name} removed`);
  }

  // ─── QUERIES ────────────────────────────────────────────────────────

  /**
   * Get information about an agent
   *
   * @param characterId - The agent's character ID
   * @returns Agent information or null if not found
   */
  getAgentInfo(characterId: string): EmbeddedAgentInfo | null {
    const instance = this.agents.get(characterId);
    if (!instance) {
      return null;
    }

    const gameState = instance.service.getGameState();

    return {
      agentId: characterId,
      characterId,
      accountId: instance.config.accountId,
      name: instance.config.name,
      scriptedRole: instance.config.scriptedRole,
      state: instance.state,
      entityId: gameState?.playerId || null,
      position: gameState?.position ?? null,
      health: gameState?.health ?? null,
      maxHealth: gameState?.maxHealth ?? null,
      startedAt: instance.startedAt,
      lastActivity: instance.lastActivity,
      error: instance.error,
      goal: instance.goal,
    };
  }

  /**
   * Get information about all agents
   *
   * @returns Array of agent information
   */
  getAllAgents(): EmbeddedAgentInfo[] {
    const result: EmbeddedAgentInfo[] = [];
    for (const [characterId] of this.agents) {
      const info = this.getAgentInfo(characterId);
      if (info) {
        result.push(info);
      }
    }
    return result;
  }

  /**
   * Get agents by account ID
   *
   * @param accountId - The account ID to filter by
   * @returns Array of agent information for the account
   */
  getAgentsByAccount(accountId: string): EmbeddedAgentInfo[] {
    return this.getAllAgents().filter((agent) => agent.accountId === accountId);
  }

  /**
   * Check if an agent exists
   *
   * @param characterId - The agent's character ID
   * @returns True if the agent exists
   */
  hasAgent(characterId: string): boolean {
    return this.agents.has(characterId);
  }

  /**
   * Get the embedded service for an agent (for direct manipulation)
   *
   * @param characterId - The agent's character ID
   * @returns The embedded service or null
   */
  getAgentService(characterId: string): EmbeddedHyperscapeService | null {
    return this.agents.get(characterId)?.service || null;
  }

  // ─── COMMAND DISPATCH ───────────────────────────────────────────────

  /**
   * Send a command to an agent
   *
   * @param characterId - The agent's character ID
   * @param command - The command type
   * @param data - Command data
   */
  async sendCommand(
    characterId: string,
    command: string,
    data: unknown,
  ): Promise<void> {
    return this.commandDispatcher.dispatch(characterId, command, data);
  }

  // ─── DATABASE ───────────────────────────────────────────────────────

  /**
   * Load agents from database that are marked as AI agents
   * and auto-start them
   */
  async loadAgentsFromDatabase(): Promise<void> {
    console.log("[AgentManager] Loading agents from database...");

    const databaseSystem = this.world.getSystem("database") as
      | {
          db: {
            select: () => {
              from: (table: unknown) => {
                where: (condition: unknown) => Promise<
                  Array<{
                    id: string;
                    accountId: string;
                    name: string;
                    isAgent: boolean;
                  }>
                >;
              };
            };
          };
        }
      | undefined;

    if (!databaseSystem?.db) {
      console.warn(
        "[AgentManager] Database not available, skipping agent load",
      );
      return;
    }

    try {
      // Query characters marked as agents
      const { characters } = await import("../database/schema.js");
      const { eq } = await import("drizzle-orm");
      const defaultAutoStartMax =
        process.env.NODE_ENV === "production" ? Number.MAX_SAFE_INTEGER : 2;
      const parsedAutoStartMax = Number.parseInt(
        process.env.AUTO_START_AGENTS_MAX || "",
        10,
      );
      const autoStartMax =
        Number.isFinite(parsedAutoStartMax) && parsedAutoStartMax >= 0
          ? parsedAutoStartMax
          : defaultAutoStartMax;

      // isAgent is stored as integer (1 = true, 0 = false) in database
      const agentCharacters = await databaseSystem.db
        .select()
        .from(characters)
        .where(eq(characters.isAgent, 1));

      console.log(
        `[AgentManager] Found ${agentCharacters.length} agent character(s) in database`,
      );

      const shouldLimit = autoStartMax < agentCharacters.length;
      const charactersToLoad = shouldLimit
        ? agentCharacters.slice(0, autoStartMax)
        : agentCharacters;

      if (shouldLimit) {
        console.warn(
          `[AgentManager] Auto-start cap active (${charactersToLoad.length}/${agentCharacters.length}). Set AUTO_START_AGENTS_MAX to override.`,
        );
      }

      // Create agents for each
      for (const char of charactersToLoad) {
        try {
          await this.createAgent({
            characterId: char.id,
            accountId: char.accountId,
            name: char.name,
            autoStart: true,
          });
        } catch (err) {
          console.error(
            `[AgentManager] Failed to create agent for ${char.name}:`,
            errMsg(err),
          );
        }
      }

      console.log(
        `[AgentManager] Loaded ${this.agents.size} agent(s)${
          shouldLimit ? ` (capped from ${agentCharacters.length})` : ""
        }`,
      );
    } catch (err) {
      console.error(
        "[AgentManager] Error loading agents from database:",
        errMsg(err),
      );
    }
  }

  // ─── SHUTDOWN ───────────────────────────────────────────────────────

  /**
   * Gracefully shut down all agents
   */
  async shutdown(): Promise<void> {
    if (this.isShuttingDown) {
      return;
    }

    this.isShuttingDown = true;
    console.log(`[AgentManager] Shutting down ${this.agents.size} agent(s)...`);

    // Remove event listeners to prevent memory leaks
    this.world.off(EventType.COMBAT_DAMAGE_DEALT, this.combatDamageHandler);

    const stopPromises: Promise<void>[] = [];

    for (const [characterId] of this.agents) {
      stopPromises.push(
        this.stopAgent(characterId).catch((err) => {
          console.error(
            `[AgentManager] Error stopping agent ${characterId}:`,
            errMsg(err),
          );
        }),
      );
    }

    await Promise.all(stopPromises);

    this.agents.clear();
    console.log("[AgentManager] All agents shut down");
  }
}

/**
 * Global agent manager instance (set during server startup)
 */
let globalAgentManager: AgentManager | null = null;

/**
 * Get the global agent manager instance
 */
export function getAgentManager(): AgentManager | null {
  return globalAgentManager;
}

/**
 * Set the global agent manager instance (called during startup)
 */
export function setAgentManager(manager: AgentManager): void {
  globalAgentManager = manager;
}
