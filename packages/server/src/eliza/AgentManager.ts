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
 * - AgentBehaviorBridge (worker thread for autonomous behavior decisions)
 * - AgentCommandDispatcher (routing string-based commands to service methods)
 *
 * Unlike external ElizaOS processes, these agents run directly in the
 * Hyperia server process with direct world access.
 */

import {
  AgentRuntime,
  ModelType,
  ChannelType,
  mergeCharacterDefaults,
  stringToUuid,
  type Character,
  type Plugin,
  // @ts-ignore - exported at runtime but missing from .d.ts
  InMemoryDatabaseAdapter,
} from "@elizaos/core";
import { createJWT } from "../shared/utils.js";
import { errMsg } from "../shared/errMsg.js";
import { EventType } from "@hyperforge/shared";
import { EmbeddedHyperiaService } from "./EmbeddedHyperiaService.js";
import {
  recordAgentThought,
  tryResolveDashboardLlmAction,
  type ResolvedDashboardIntent,
} from "./dashboardInterop.js";
import { ServerNetwork } from "../systems/ServerNetwork/index.js";
import {
  ejectAgentFromCombatArena,
  recoverAgentFromDeathLoop,
} from "./agentRecovery.js";

/**
 * Dynamically import the Hyperia plugin to avoid hard dependency in dev.
 * Returns null if AI plugins are disabled or the module fails to load.
 */
async function getHyperiaPlugin(): Promise<Plugin | null> {
  if (process.env.DISABLE_AI === "true" || process.env.ENABLE_AI === "false") {
    console.warn("[AgentManager] AI plugins disabled via env");
    return null;
  }

  try {
    const mod = await import("@hyperforge/plugin-hyperia");
    return mod.hyperiaPlugin;
  } catch (err) {
    console.warn(
      "[AgentManager] Failed to load @hyperforge/plugin-hyperia:",
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
 * Dynamically import the Goals plugin (@elizaos/plugin-goals).
 * Adds long-term goal management: create, track, complete, and remind agents
 * of their objectives across planning cycles.
 * Returns null if unavailable (non-fatal — agent continues without goal tracking).
 */
async function getGoalsPlugin(): Promise<Plugin | null> {
  try {
    const mod = await import("@elizaos/plugin-goals");
    const plugin: Plugin = mod.GoalsPlugin ?? mod.default;
    if (plugin) {
      return plugin;
    }
    console.warn(
      "[AgentManager] @elizaos/plugin-goals loaded but export not found",
    );
    return null;
  } catch (err) {
    console.warn(
      "[AgentManager] @elizaos/plugin-goals unavailable (long-term goals disabled):",
      errMsg(err),
    );
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
type ResolvedChatModelProvider = {
  plugin: Plugin;
  provider: "elizacloud" | "openai" | "anthropic" | "openrouter" | "ollama";
  model: string;
  source: string;
  secrets: Record<string, string>;
};

export type DashboardLlmReplyResult =
  | {
      ok: true;
      text: string;
      provider: string;
      model: string;
      source: string;
    }
  | { ok: false; message: string; code: string };

type ModelProviderResolutionOpts = {
  /** Per-agent secrets from dashboard (merged with env; character wins when set). */
  characterSecrets?: Record<string, string | undefined> | null;
  /** Preferred model id from character settings (e.g. OpenRouter model slug). */
  characterModel?: string | null;
};

/** Reject masked dashboard placeholders and junk so we do not call providers with "***". */
function isUsableSecretValue(value: string): boolean {
  const v = value.trim();
  if (v.length < 8) {
    return false;
  }
  if (v.startsWith("***")) {
    return false;
  }
  const lower = v.toLowerCase();
  if (
    lower.includes("your-api-key") ||
    lower.includes("placeholder") ||
    lower === "redacted" ||
    lower === "sk-..." ||
    lower === "sk-or-..."
  ) {
    return false;
  }
  return true;
}

function pickApiKey(
  secrets: Record<string, string | undefined> | null | undefined,
  envKey: string,
): string {
  const fromChar = secrets?.[envKey];
  if (typeof fromChar === "string" && isUsableSecretValue(fromChar)) {
    return fromChar.trim();
  }
  const fromEnv = process.env[envKey];
  if (typeof fromEnv === "string" && isUsableSecretValue(fromEnv)) {
    return fromEnv.trim();
  }
  return "";
}

function resolveLargeModel(
  characterModel: string | null | undefined,
  envKey: string,
): string {
  if (typeof characterModel === "string" && characterModel.trim()) {
    return characterModel.trim();
  }
  const fromEnv = process.env[envKey];
  return typeof fromEnv === "string" && fromEnv.trim()
    ? fromEnv.trim()
    : "provider default";
}

/** When no character/env large model is set, plugins still need an explicit model for many providers. */
function concreteLargeModel(
  characterModel: string | null | undefined,
  largeEnvKey: string,
  alternateEnvKey: string,
  fallback: string,
): string {
  const resolved = resolveLargeModel(characterModel, largeEnvKey);
  if (resolved !== "provider default") {
    return resolved;
  }
  const alt = process.env[alternateEnvKey];
  if (typeof alt === "string" && alt.trim()) {
    return alt.trim();
  }
  return fallback;
}

/**
 * Choose LLM plugin from env and/or per-agent dashboard secrets.
 */
async function getModelProviderPlugin(
  opts?: ModelProviderResolutionOpts,
): Promise<ResolvedChatModelProvider | null> {
  const charSec = opts?.characterSecrets ?? undefined;
  const charModel = opts?.characterModel ?? null;

  const elizaKey = pickApiKey(charSec, "ELIZAOS_CLOUD_API_KEY");
  if (elizaKey) {
    try {
      const mod = await import("@elizaos/plugin-elizacloud");
      const plugin = mod.elizaOSCloudPlugin ?? mod.default;
      if (plugin) {
        const model = concreteLargeModel(
          charModel,
          "ELIZAOS_CLOUD_LARGE_MODEL",
          "ELIZAOS_CLOUD_MODEL",
          "gpt-4o-mini",
        );
        return {
          plugin,
          provider: "elizacloud",
          model,
          source: charSec?.ELIZAOS_CLOUD_API_KEY?.trim()
            ? "character ELIZAOS_CLOUD_API_KEY"
            : "ELIZAOS_CLOUD_API_KEY",
          secrets: {
            ELIZAOS_CLOUD_API_KEY: elizaKey,
            LARGE_MODEL: model,
            ELIZAOS_CLOUD_LARGE_MODEL: model,
          },
        };
      }
    } catch (err) {
      console.warn(
        "[AgentManager] Failed to load Eliza Cloud plugin:",
        errMsg(err),
      );
    }
  }

  // OpenRouter before OpenAI so dashboard / multi-key setups prefer OpenRouter when both exist.
  const openRouterKey = pickApiKey(charSec, "OPENROUTER_API_KEY");
  if (openRouterKey) {
    try {
      const mod = await import("@elizaos/plugin-openrouter");
      const plugin = mod.openrouterPlugin ?? mod.default;
      if (plugin) {
        const model = concreteLargeModel(
          charModel,
          "OPENROUTER_LARGE_MODEL",
          "OPENROUTER_MODEL",
          "openai/gpt-4o-mini",
        );
        return {
          plugin,
          provider: "openrouter",
          model,
          source: charSec?.OPENROUTER_API_KEY?.trim()
            ? "character OPENROUTER_API_KEY"
            : "OPENROUTER_API_KEY",
          secrets: {
            OPENROUTER_API_KEY: openRouterKey,
            LARGE_MODEL: model,
            OPENROUTER_LARGE_MODEL: model,
          },
        };
      }
    } catch (err) {
      console.warn(
        "[AgentManager] Failed to load OpenRouter plugin:",
        errMsg(err),
      );
    }
  }

  const anthropicKey = pickApiKey(charSec, "ANTHROPIC_API_KEY");
  if (anthropicKey) {
    try {
      const mod = await import("@elizaos/plugin-anthropic");
      const plugin = mod.anthropicPlugin ?? mod.default;
      if (plugin) {
        const model = concreteLargeModel(
          charModel,
          "ANTHROPIC_LARGE_MODEL",
          "ANTHROPIC_MODEL",
          "claude-3-5-haiku-20241022",
        );
        return {
          plugin,
          provider: "anthropic",
          model,
          source: charSec?.ANTHROPIC_API_KEY?.trim()
            ? "character ANTHROPIC_API_KEY"
            : "ANTHROPIC_API_KEY",
          secrets: {
            ANTHROPIC_API_KEY: anthropicKey,
            LARGE_MODEL: model,
            ANTHROPIC_LARGE_MODEL: model,
          },
        };
      }
    } catch (err) {
      console.warn(
        "[AgentManager] Failed to load Anthropic plugin:",
        errMsg(err),
      );
    }
  }

  const openAiKey = pickApiKey(charSec, "OPENAI_API_KEY");
  if (openAiKey) {
    try {
      const mod = await import("@elizaos/plugin-openai");
      const plugin = mod.openaiPlugin;
      if (plugin) {
        const model = concreteLargeModel(
          charModel,
          "OPENAI_LARGE_MODEL",
          "OPENAI_MODEL",
          "gpt-4o-mini",
        );
        return {
          plugin,
          provider: "openai",
          model,
          source: charSec?.OPENAI_API_KEY?.trim()
            ? "character OPENAI_API_KEY"
            : "OPENAI_API_KEY",
          secrets: {
            OPENAI_API_KEY: openAiKey,
            LARGE_MODEL: model,
            OPENAI_LARGE_MODEL: model,
          },
        };
      }
    } catch (err) {
      console.warn("[AgentManager] Failed to load OpenAI plugin:", errMsg(err));
    }
  }

  // Fall back to Ollama when no cloud keys (env or character)
  try {
    const mod = await import("@elizaos/plugin-ollama");
    const plugin = mod.ollamaPlugin;
    if (plugin) {
      const model =
        (typeof charModel === "string" && charModel.trim()
          ? charModel.trim()
          : "") ||
        process.env.OLLAMA_LARGE_MODEL?.trim() ||
        process.env.OLLAMA_MODEL?.trim() ||
        "provider default";
      return {
        plugin,
        provider: "ollama",
        model,
        source: "local Ollama",
        secrets: {
          ...(process.env.OLLAMA_BASE_URL
            ? {
                OLLAMA_BASE_URL: process.env.OLLAMA_BASE_URL,
              }
            : {}),
          ...(model === "provider default"
            ? {}
            : {
                LARGE_MODEL: model,
                OLLAMA_MODEL: model,
              }),
        },
      };
    }
  } catch (err) {
    console.warn("[AgentManager] Failed to load Ollama plugin:", errMsg(err));
  }

  console.warn(
    "[AgentManager] No model provider available! Set API keys in the agent dashboard (Settings) or in env: ELIZAOS_CLOUD_API_KEY, OPENAI_API_KEY, ANTHROPIC_API_KEY, OPENROUTER_API_KEY (or run Ollama locally).",
  );
  return null;
}

function extractMessageContentParts(content: unknown): string {
  if (typeof content === "string") {
    return content.trim();
  }
  if (!Array.isArray(content)) {
    return "";
  }
  const parts: string[] = [];
  for (const item of content) {
    if (typeof item === "string") {
      parts.push(item);
    } else if (item && typeof item === "object") {
      const p = item as Record<string, unknown>;
      if (typeof p.text === "string") {
        parts.push(p.text);
      } else if (typeof p.content === "string") {
        parts.push(p.content);
      }
    }
  }
  return parts.join("").trim();
}

function extractUseModelText(response: unknown): string {
  if (response === null || response === undefined) {
    return "";
  }
  if (typeof response === "string") {
    return response.trim();
  }
  if (typeof response === "number" || typeof response === "boolean") {
    return String(response).trim();
  }
  if (typeof response !== "object") {
    return "";
  }
  const o = response as Record<string, unknown>;
  for (const k of ["text", "content", "message", "response", "output"]) {
    const v = o[k];
    if (k === "content") {
      const merged = extractMessageContentParts(v);
      if (merged) {
        return merged;
      }
      continue;
    }
    if (typeof v === "string" && v.trim()) {
      return v.trim();
    }
  }
  const choices = o.choices;
  if (Array.isArray(choices) && choices.length > 0) {
    const c0 = choices[0];
    if (c0 && typeof c0 === "object") {
      const c = c0 as Record<string, unknown>;
      const msg = c.message;
      if (msg && typeof msg === "object") {
        const content = (msg as Record<string, unknown>).content;
        const fromParts = extractMessageContentParts(content);
        if (fromParts) {
          return fromParts;
        }
        if (typeof content === "string" && content.trim()) {
          return content.trim();
        }
      }
      const text = c.text;
      if (typeof text === "string" && text.trim()) {
        return text.trim();
      }
    }
  }
  return "";
}

async function normalizeDashboardUseModelResponse(
  response: unknown,
): Promise<string> {
  const direct = extractUseModelText(response);
  if (direct) {
    return direct;
  }
  if (
    typeof response === "object" &&
    response !== null &&
    "textStream" in response
  ) {
    const tr = response as { textStream?: AsyncIterable<unknown> };
    const stream = tr.textStream;
    if (stream && typeof stream[Symbol.asyncIterator] === "function") {
      let full = "";
      try {
        for await (const chunk of stream) {
          full += typeof chunk === "string" ? chunk : String(chunk);
        }
      } catch {
        return "";
      }
      return full.trim();
    }
  }
  if (typeof response === "object" && response !== null) {
    const t = (response as { text?: unknown }).text;
    if (typeof t === "string" && t.trim()) {
      return t.trim();
    }
  }
  return "";
}
import type { World } from "@hyperforge/shared";

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
 * Interface for the HyperiaService methods used by AgentManager.
 * This mirrors the plugin-hyperia HyperiaService but avoids direct dependency.
 */
export interface HyperiaService {
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
  AgentCharacterConfig,
  EmbeddedAgentInfo,
  AgentState,
} from "./types.js";
import { AgentBehaviorBridge } from "./managers/AgentBehaviorBridge.js";
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
 * Behavior loop and action selection are handled by AgentBehaviorBridge (worker thread).
 * Command dispatch is handled by AgentCommandDispatcher.
 */
export class AgentManager {
  private world: World;
  private agents: Map<string, AgentInstance> = new Map();
  private isShuttingDown: boolean = false;
  private readonly behaviorBridge: AgentBehaviorBridge;
  private readonly behaviorTicker: AgentBehaviorTicker;
  private readonly commandDispatcher: AgentCommandDispatcher;
  private readonly combatDamageListener: (data: unknown) => void;
  private worldListenerActive: boolean = false;
  private characterVisionRefreshTimers = new Map<
    string,
    ReturnType<typeof setInterval>
  >();

  constructor(world: World) {
    this.world = world;
    this.behaviorBridge = new AgentBehaviorBridge(
      world,
      (id) => this.agents.get(id),
      () => Array.from(this.agents.keys()),
    );
    this.behaviorTicker = new AgentBehaviorTicker(
      world,
      (id) => this.agents.get(id),
      () => Array.from(this.agents.keys()),
    );
    // Let the bridge run ticker management functions (shopping, inventory, etc.)
    this.behaviorBridge.setTicker(this.behaviorTicker);
    this.commandDispatcher = new AgentCommandDispatcher((id) =>
      this.agents.get(id),
    );

    this.combatDamageListener = (data: unknown) => {
      this.behaviorBridge.handleCombatDamageDealt(data);
    };

    // Start the worker thread bridge
    void this.behaviorBridge.start().catch((err) => {
      console.error(
        "[AgentManager] Failed to start behavior bridge:",
        errMsg(err),
      );
    });
    this.world.on(EventType.COMBAT_DAMAGE_DEALT, this.combatDamageListener);
    this.worldListenerActive = true;
  }

  private mergeCharacterConfigs(
    base?: AgentCharacterConfig | null,
    override?: AgentCharacterConfig | null,
  ): AgentCharacterConfig | undefined {
    if (!base && !override) {
      return undefined;
    }

    const mergedSettings = {
      ...(base?.settings || {}),
      ...(override?.settings || {}),
      secrets: {
        ...(base?.settings?.secrets || {}),
        ...(override?.settings?.secrets || {}),
      },
    };

    return {
      ...(base || {}),
      ...(override || {}),
      settings: mergedSettings,
    } as AgentCharacterConfig;
  }

  private async loadPersistedCharacterConfig(
    characterId: string,
  ): Promise<AgentCharacterConfig | undefined> {
    const databaseSystem = this.world.getSystem("database") as
      | {
          db?: {
            select: () => {
              from: (table: unknown) => {
                where: (
                  condition: unknown,
                ) => Promise<Array<{ key: string; value: string | null }>>;
              };
            };
          };
          getDb?: () => {
            select: () => {
              from: (table: unknown) => {
                where: (
                  condition: unknown,
                ) => Promise<Array<{ key: string; value: string | null }>>;
              };
            };
          } | null;
        }
      | undefined;
    const db = databaseSystem?.db ?? databaseSystem?.getDb?.() ?? null;
    if (!db) {
      return undefined;
    }

    try {
      const { config } = await import("../database/schema.js");
      const { eq } = await import("drizzle-orm");
      const rows = await db
        .select()
        .from(config)
        .where(eq(config.key, `agent:character-config:${characterId}`));
      const rawValue = rows[0]?.value;
      if (!rawValue) {
        return undefined;
      }

      const parsed = JSON.parse(rawValue) as AgentCharacterConfig;
      if (!parsed || typeof parsed !== "object") {
        return undefined;
      }
      return parsed;
    } catch (error) {
      console.warn(
        `[AgentManager] Failed to load persisted character config for ${characterId}:`,
        errMsg(error),
      );
      return undefined;
    }
  }

  private async persistCharacterConfig(
    characterId: string,
    characterConfig: AgentCharacterConfig,
  ): Promise<void> {
    const databaseSystem = this.world.getSystem("database") as
      | {
          db?: {
            insert: (table: unknown) => {
              values: (row: { key: string; value: string }) => {
                onConflictDoUpdate: (config: {
                  target: unknown;
                  set: { value: string };
                }) => Promise<unknown>;
              };
            };
          };
          getDb?: () => {
            insert: (table: unknown) => {
              values: (row: { key: string; value: string }) => {
                onConflictDoUpdate: (config: {
                  target: unknown;
                  set: { value: string };
                }) => Promise<unknown>;
              };
            };
          } | null;
        }
      | undefined;
    const db = databaseSystem?.db ?? databaseSystem?.getDb?.() ?? null;
    if (!db) {
      return;
    }

    try {
      const { config } = await import("../database/schema.js");
      const key = `agent:character-config:${characterId}`;
      const value = JSON.stringify(characterConfig);
      await db.insert(config).values({ key, value }).onConflictDoUpdate({
        target: config.key,
        set: { value },
      });
    } catch (error) {
      console.warn(
        `[AgentManager] Failed to persist character config for ${characterId}:`,
        errMsg(error),
      );
    }
  }

  /**
   * Dispose long-lived world listeners.
   * Used on shutdown and during manager replacement in dev/hot-reload flows.
   */
  dispose(): void {
    if (!this.worldListenerActive) return;
    this.world.off(EventType.COMBAT_DAMAGE_DEALT, this.combatDamageListener);
    this.worldListenerActive = false;
    this.behaviorBridge.stop();
    const visionIds = [...this.characterVisionRefreshTimers.keys()];
    for (const characterId of visionIds) {
      this.stopCharacterVisionRefresh(characterId);
    }
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

    const persistedCharacterConfig =
      await this.loadPersistedCharacterConfig(characterId);
    const mergedCharacterConfig = this.mergeCharacterConfigs(
      persistedCharacterConfig,
      config.characterConfig,
    );
    const resolvedName = mergedCharacterConfig?.name?.trim() || name;
    const resolvedConfig: EmbeddedAgentConfig = {
      ...config,
      name: resolvedName,
      characterConfig: mergedCharacterConfig,
    };

    // Create the embedded service
    const service = new EmbeddedHyperiaService(
      this.world,
      characterId,
      accountId,
      resolvedName,
    );

    // Track the agent
    const instance: AgentInstance = {
      config: resolvedConfig,
      service,
      chatRuntime: null,
      chatRuntimeInfo: null,
      chatRuntimeInitPromise: null,
      state: "initializing",
      startedAt: Date.now(),
      lastActivity: Date.now(),
      behaviorInterval: null,
      behaviorStartTimeout: null,
      goal: null,
      questsAccepted: new Set(),
      currentTargetId: null,
      lastAteAt: 0,
      dropCooldownUntil: 0,
      lastGatherTargetId: null,
      lastGatherQueuedAt: 0,
      lastGatherAttemptPosition: null,
      gatherBlacklistUntil: new Map(),
      lastPickupTargetId: null,
      lastPickupAttemptAt: 0,
      lastPickupAttemptPosition: null,
      pickupBlacklistUntil: new Map(),
      pendingChatReaction: null,
      lastCombatChatAt: 0,
      lastCombatReEngageAt: 0,
      combatPrayerActive: false,
      operatorCommandAt: 0,
      navigationTarget: null,
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
      return;
    }

    instance.state = "initializing";
    instance.lastActivity = Date.now();

    try {
      // Initialize the embedded service (spawns player entity)
      await instance.service.initialize();

      instance.state = "running";
      instance.lastActivity = Date.now();
      instance.error = undefined;

      // Worker-based behavior bridge (main) + embedded LLM planning / vision refresh (dashboard)
      this.behaviorBridge.startAgent(characterId);
      void this.tryStartEmbeddedLlmPlanning(characterId);
      this.startCharacterVisionRefresh(characterId);

      // Eagerly initialize the ElizaOS chat runtime so LLM-driven behavior
      // decisions are available from the very first tick (not just when the
      // dashboard is opened or the vision refresh first fires).
      void this.ensureChatRuntime(characterId).catch(() => {});

      // Hydrate historical thoughts from DB so they survive server restarts
      void import("./dashboardInterop.js")
        .then(({ hydrateThoughtsFromDb }) => hydrateThoughtsFromDb(characterId))
        .catch(() => {});
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
      return;
    }

    try {
      await this.tryStopEmbeddedLlmPlanning(characterId);
      this.behaviorBridge.stopAgent(characterId);
      await this.stopChatRuntime(characterId);

      await instance.service.stop();
      instance.state = "stopped";
      instance.lastActivity = Date.now();
    } catch (err) {
      instance.state = "error";
      instance.error = errMsg(err);
      throw err;
    }
  }

  /**
   * Run one immediate autonomous behavior tick for an agent.
   * Used by tests and diagnostics without waiting for the worker scheduler.
   */
  async executeBehaviorTick(characterId: string): Promise<void> {
    await this.behaviorTicker.executeBehaviorTick(characterId);
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
      return;
    }

    await this.tryStopEmbeddedLlmPlanning(characterId);
    // Stop autonomous behavior without removing the entity.
    this.behaviorBridge.stopAgent(characterId);
    instance.state = "paused";
    instance.lastActivity = Date.now();
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
      return;
    }

    instance.state = "running";
    instance.lastActivity = Date.now();
    this.behaviorBridge.startAgent(characterId);
    void this.tryStartEmbeddedLlmPlanning(characterId);
    this.startCharacterVisionRefresh(characterId);
  }

  /**
   * Remove an agent completely
   *
   * @param characterId - The agent's character ID
   */
  async removeAgent(characterId: string): Promise<void> {
    const instance = this.agents.get(characterId);
    if (!instance) {
      return;
    }

    // Stop first if running
    if (instance.state === "running" || instance.state === "paused") {
      await this.stopAgent(characterId);
    }

    await this.stopChatRuntime(characterId);

    // Remove from tracking
    this.agents.delete(characterId);
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
  getAgentService(characterId: string): EmbeddedHyperiaService | null {
    return this.agents.get(characterId)?.service || null;
  }

  getAgentCharacterConfig(characterId: string): AgentCharacterConfig | null {
    return this.agents.get(characterId)?.config.characterConfig || null;
  }

  async updateAgentCharacterConfig(
    characterId: string,
    nextCharacterConfig: AgentCharacterConfig,
  ): Promise<void> {
    const instance = this.agents.get(characterId);
    if (!instance) {
      throw new Error(`Agent ${characterId} not found`);
    }

    const nextName =
      nextCharacterConfig.name?.trim() ||
      instance.config.name ||
      instance.config.characterConfig?.name ||
      characterId;

    instance.config.characterConfig = nextCharacterConfig;
    instance.config.name = nextName;
    instance.lastActivity = Date.now();
    instance.service.setDisplayName(nextName);

    await this.stopChatRuntime(characterId);
    await this.persistCharacterConfig(characterId, nextCharacterConfig);
  }

  getChatRuntimeInfo(characterId: string): {
    provider: string;
    model: string;
    source: string;
  } | null {
    return this.agents.get(characterId)?.chatRuntimeInfo || null;
  }

  private buildChatCharacter(
    instance: AgentInstance,
    provider: ResolvedChatModelProvider,
  ): Character {
    const baseSystem =
      instance.config.characterConfig?.system ||
      `You are ${instance.config.name}, an embedded Hyperia agent. Respond as yourself, stay grounded in the current game world, and keep replies concise and useful.`;

    return {
      id: stringToUuid(`embedded-chat-${instance.config.characterId}`),
      name: instance.config.name,
      username:
        instance.config.characterConfig?.username ||
        `embedded-chat-${instance.config.characterId}`,
      system: `${baseSystem}\n\nYou are talking to your operator through the dashboard. Their instructions override your personal preferences and any long-term build flavor text. Answer in 1-3 concise sentences, avoid markdown, always finish your final sentence, and do not claim to have done actions you have not actually done.`,
      bio: instance.config.characterConfig?.bio || [
        `${instance.config.name} is an embedded Hyperia agent.`,
      ],
      lore: instance.config.characterConfig?.lore || [],
      topics: instance.config.characterConfig?.topics || [
        "Hyperia",
        "MMORPG",
        "agent control",
      ],
      adjectives: instance.config.characterConfig?.adjectives || [
        "concise",
        "grounded",
        "responsive",
      ],
      style: instance.config.characterConfig?.style || {
        all: ["Be concise", "Stay in-world when helpful"],
        chat: [
          "Answer the operator directly",
          "Mention concrete nearby context",
        ],
      },
      settings: {
        ...(instance.config.characterConfig?.settings || {}),
        ...(provider.model === "provider default"
          ? {}
          : {
              model: provider.model,
            }),
        secrets: {
          ...(instance.config.characterConfig?.settings?.secrets || {}),
          ...provider.secrets,
        },
      },
      plugins: [],
      // @ts-ignore - runtime supports modelProvider even if core type lags.
      modelProvider: provider.provider,
    } as unknown as Character;
  }

  private buildDashboardChatPrompt(
    instance: AgentInstance,
    userMessage: string,
  ): string {
    instance.service.invalidateNearbyEntityCache();
    const gameState = instance.service.getGameState();
    const nearbyChat = instance.service
      .getLocalChatMessages()
      .slice(0, 5)
      .map(
        (message) =>
          `${message.from} (${message.distance.toFixed(0)}m): ${message.text}`,
      );
    const nearbyLines = instance.service
      .getNearbyEntities()
      .slice(0, 16)
      .map(
        (entity) =>
          `id=${entity.id} name=${entity.name || entity.type} type=${entity.type} ${entity.distance.toFixed(0)}m`,
      );
    const inv = instance.service.getInventoryItems().slice(0, 24);
    const invLine = inv.length
      ? inv.map((i) => `${i.itemId}×${i.quantity}`).join(", ")
      : "empty";

    const mapAwareness = instance.service.formatMapAwarenessForLlm();

    return [
      `OPERATOR MESSAGE: ${userMessage}`,
      ``,
      `Priority: The operator's message overrides GOAL and LONG-TERM BUILD VISION when they conflict. If they tell you to fight, move, gather, or interact, you must output line-1 JSON that uses valid ids from NEARBY (or itemIds from INVENTORY) — including attacking a listed mob that is not your "favorite" type (e.g. bandits when you wished for goblins). Do not refuse or only complain in text; either act or use action "move" toward an area where the requested target exists.`,
      ``,
      `AGENT: ${instance.config.name}`,
      `STATE: ${instance.state}`,
      `GOAL: ${instance.goal?.description || "none"}`,
      (() => {
        const v = ServerNetwork.agentCharacterVision.get(
          instance.config.characterId,
        );
        if (!v) {
          return `LONG-TERM BUILD VISION: (not set yet — will seed from skills)`;
        }
        return `LONG-TERM BUILD VISION: ${v.narrative} | Pillars: ${v.pillars.join(", ")}`;
      })(),
      gameState
        ? `POSITION: ${
            gameState.position
              ? `[${gameState.position.map((value) => value.toFixed(1)).join(", ")}]`
              : "unknown"
          } | HP ${gameState.health}/${gameState.maxHealth} | ${
            gameState.inCombat ? "IN COMBAT" : "not in combat"
          }`
        : `POSITION: unavailable`,
      nearbyLines.length > 0
        ? `NEARBY (use exact id= as targetId in JSON when acting): ${nearbyLines.join(" | ")}`
        : `NEARBY: none`,
      `INVENTORY itemId×qty (use exact itemId for use/equip): ${invLine}`,
      `MAP / LOCATION:\n${mapAwareness}`,
      nearbyChat.length > 0
        ? `RECENT LOCAL CHAT: ${nearbyChat.join(" | ")}`
        : `RECENT LOCAL CHAT: none`,
      ``,
      `Output format (required):`,
      `Line 1: one JSON object only, no markdown fences. Fields:`,
      `  "action": one of none | stop | move | attack | gather | pickup | use | equip | npcInteract`,
      `  "targetId": NEARBY entity id (required for move, attack, gather, pickup, npcInteract except stop/none)`,
      `  "itemId": from INVENTORY (required for use, equip)`,
      `  "interaction": for npcInteract only — "talk" or "trade" (default talk)`,
      `Use action "none" when the operator is only chatting or you cannot pick a valid id.`,
      `Line 2+: short in-character reply to the operator (may be empty if line 1 already states what you did).`,
      `Plain-language orders from the operator are also matched server-side when possible; the JSON line should mirror the physical action you intend.`,
    ].join("\n");
  }

  private splitDashboardLlmResponse(
    raw: string,
    service: EmbeddedHyperiaService,
  ): {
    tailText: string;
    llmIntent: ResolvedDashboardIntent | null;
    hadJsonFirstLine: boolean;
    parsedActionNone: boolean;
  } {
    const trimmed = raw.trim();
    const nl = trimmed.indexOf("\n");
    const first = nl === -1 ? trimmed : trimmed.slice(0, nl).trim();
    const rest = nl === -1 ? "" : trimmed.slice(nl + 1);

    if (!first.startsWith("{")) {
      return {
        tailText: trimmed,
        llmIntent: null,
        hadJsonFirstLine: false,
        parsedActionNone: false,
      };
    }
    try {
      const parsed = JSON.parse(first) as Record<string, unknown>;
      const actionRaw = parsed.action;
      const actionStr =
        typeof actionRaw === "string" ? actionRaw.trim().toLowerCase() : "";
      if (actionStr === "none" || actionStr === "") {
        return {
          tailText: rest.trim(),
          llmIntent: null,
          hadJsonFirstLine: true,
          parsedActionNone: true,
        };
      }
      const llmIntent = tryResolveDashboardLlmAction(parsed, service);
      return {
        tailText: rest.trim(),
        llmIntent,
        hadJsonFirstLine: true,
        parsedActionNone: false,
      };
    } catch {
      return {
        tailText: trimmed,
        llmIntent: null,
        hadJsonFirstLine: false,
        parsedActionNone: false,
      };
    }
  }

  /**
   * Detect dashboard/env model resolution + per-agent secrets changes so we rebuild
   * AgentRuntime instead of reusing one created with old keys (e.g. Ollama vs OpenRouter).
   */
  private async computeChatRuntimeFingerprint(
    instance: AgentInstance,
  ): Promise<string> {
    const cc = instance.config.characterConfig;
    const resolved = await getModelProviderPlugin({
      characterSecrets: cc?.settings?.secrets,
      characterModel:
        typeof cc?.settings?.model === "string" ? cc.settings.model : null,
    });
    const secrets = cc?.settings?.secrets ?? {};
    const keys = Object.keys(secrets).sort();
    const normalized: Record<string, string> = {};
    for (const k of keys) {
      const v = secrets[k];
      if (typeof v === "string") {
        normalized[k] = v;
      }
    }
    return JSON.stringify({
      resolved: resolved
        ? `${resolved.provider}:${resolved.source}:${resolved.model}`
        : "none",
      secrets: normalized,
    });
  }

  private async ensureChatRuntime(
    characterId: string,
  ): Promise<AgentRuntime | null> {
    const instance = this.agents.get(characterId);
    if (!instance) {
      throw new Error(`Agent ${characterId} not found`);
    }

    const fingerprint = await this.computeChatRuntimeFingerprint(instance);
    if (instance.chatRuntime && instance.chatRuntimeConfigSig !== fingerprint) {
      await this.stopChatRuntime(characterId);
    }

    if (instance.chatRuntime) {
      return instance.chatRuntime;
    }

    if (instance.chatRuntimeInitPromise) {
      return instance.chatRuntimeInitPromise;
    }

    const initPromise = (async () => {
      const cc = instance.config.characterConfig;
      const provider = await getModelProviderPlugin({
        characterSecrets: cc?.settings?.secrets,
        characterModel:
          typeof cc?.settings?.model === "string" ? cc.settings.model : null,
      });
      if (!provider) {
        instance.chatRuntimeInfo = null;
        return null;
      }

      const adapter = new InMemoryDatabaseAdapter();
      // Eliza 2.0 alpha.76+ InMemoryDatabaseAdapter may omit `log`; only wrap when present.
      if (typeof adapter.log === "function") {
        const originalLog = adapter.log.bind(adapter);
        adapter.log = async (params: Parameters<typeof originalLog>[0]) => {
          await originalLog(params);
          const logs = (adapter as unknown as { logs?: unknown[] }).logs;
          if (logs && logs.length > 50) {
            logs.splice(0, logs.length - 50);
          }
        };
      }

      // Load the Goals plugin alongside the model provider plugin.
      // The Goals plugin adds GOAL_CREATE / GOAL_UPDATE / GOAL_COMPLETE actions
      // and a goals context provider that surfaces active objectives every cycle.
      // Loading is non-fatal — missing plugin just means no long-term goal tracking.
      const goalsPlugin = await getGoalsPlugin();
      const chatPlugins: Plugin[] = [provider.plugin];
      if (goalsPlugin) {
        chatPlugins.push(goalsPlugin);
      }

      const runtime = new AgentRuntime({
        character: this.buildChatCharacter(instance, provider),
        plugins: chatPlugins,
        adapter,
      });

      let timeoutId: ReturnType<typeof setTimeout> | null = null;
      try {
        await Promise.race([
          runtime.initialize(),
          new Promise<never>((_, reject) => {
            timeoutId = setTimeout(
              () =>
                reject(
                  new Error("Embedded chat runtime initialization timed out"),
                ),
              20000,
            );
          }),
        ]);
      } catch (error) {
        instance.chatRuntimeInfo = null;
        await runtime.stop().catch(() => {});
        throw error;
      } finally {
        if (timeoutId) {
          clearTimeout(timeoutId);
        }
      }

      instance.chatRuntime = runtime;
      instance.chatRuntimeConfigSig = fingerprint;
      instance.chatRuntimeInfo = {
        provider: provider.provider,
        model: provider.model,
        source: provider.source,
      };
      return runtime;
    })()
      .catch((error) => {
        console.error(
          `[AgentManager] Failed to initialize embedded chat runtime for ${characterId}:`,
          errMsg(error),
        );
        return null;
      })
      .finally(() => {
        if (instance.chatRuntimeInitPromise === initPromise) {
          instance.chatRuntimeInitPromise = null;
        }
      });

    instance.chatRuntimeInitPromise = initPromise;
    return initPromise;
  }

  /**
   * LLM JSON plan → executeMove / gather / … (see ModelAgentSpawner).
   * Dynamic import avoids circular deps with ModelAgentSpawner → AgentManager.
   * Set EMBEDDED_AGENT_LLM_PLANNING=false to disable (scripted ticker only).
   */
  private async tryStartEmbeddedLlmPlanning(
    characterId: string,
  ): Promise<void> {
    if (process.env.EMBEDDED_AGENT_LLM_PLANNING === "false") {
      return;
    }
    const instance = this.agents.get(characterId);
    if (!instance || instance.state !== "running") {
      return;
    }
    try {
      const runtime = await this.ensureChatRuntime(characterId);
      if (!runtime) {
        return;
      }
      const mod = await import("./ModelAgentSpawner.js");
      mod.startEmbeddedAgentLlmPlanningLoop(
        characterId,
        runtime,
        instance.service,
        instance.config.name,
      );
    } catch (error) {
      console.warn(
        `[AgentManager] Embedded LLM planning not started for ${characterId}: ${errMsg(error)}`,
      );
    }
  }

  private async tryStopEmbeddedLlmPlanning(characterId: string): Promise<void> {
    this.stopCharacterVisionRefresh(characterId);
    try {
      const mod = await import("./ModelAgentSpawner.js");
      mod.stopEmbeddedAgentLlmPlanningLoop(characterId);
    } catch {
      /* ignore */
    }
  }

  /**
   * Periodically rewrites agentCharacterVision via LLM unless the operator locked it (source=operator).
   * Disabled when EMBEDDED_AGENT_VISION_LLM=false. Interval: EMBEDDED_AGENT_VISION_REFRESH_MS (default 2m).
   */
  private startCharacterVisionRefresh(characterId: string): void {
    if (process.env.EMBEDDED_AGENT_VISION_LLM === "false") {
      this.stopCharacterVisionRefresh(characterId);
      return;
    }
    this.stopCharacterVisionRefresh(characterId);
    const intervalMs = Math.max(
      60_000,
      Number(process.env.EMBEDDED_AGENT_VISION_REFRESH_MS || 120_000) ||
        120_000,
    );
    const timer = setInterval(() => {
      void this.refreshEmbeddedAgentCharacterVision(characterId).catch(
        (err) => {
          console.warn(
            `[AgentManager] Character vision refresh failed for ${characterId}: ${err instanceof Error ? err.message : String(err)}`,
          );
        },
      );
    }, intervalMs);
    this.characterVisionRefreshTimers.set(characterId, timer);
  }

  private stopCharacterVisionRefresh(characterId: string): void {
    const t = this.characterVisionRefreshTimers.get(characterId);
    if (t) {
      clearInterval(t);
      this.characterVisionRefreshTimers.delete(characterId);
    }
  }

  private async refreshEmbeddedAgentCharacterVision(
    characterId: string,
  ): Promise<void> {
    if (process.env.EMBEDDED_AGENT_VISION_LLM === "false") {
      return;
    }
    const instance = this.agents.get(characterId);
    if (!instance || instance.state !== "running") {
      return;
    }
    const cur = ServerNetwork.agentCharacterVision.get(characterId);
    if (cur?.source === "operator") {
      return;
    }
    const runtime = await this.ensureChatRuntime(characterId);
    if (!runtime) {
      return;
    }
    const gameState = instance.service.getGameState();
    const skillsSummary = gameState?.skills
      ? Object.entries(gameState.skills)
          .sort((a, b) => b[1].level - a[1].level)
          .slice(0, 14)
          .map(([k, v]) => `${k}:${v.level}`)
          .join(", ")
      : "unknown";

    const mapAwareness = instance.service.formatMapAwarenessForLlm();

    const prompt = [
      `You are defining the CHARACTER BUILD IDENTITY for a player in an OSRS-style MMO.`,
      `This is NOT a vague ambition — it is a SPECIFIC, OPINIONATED build archetype that drives every decision.`,
      `Pick ONE clear identity and commit to it. Examples: "Melee tank", "Ranged pure", "Mage-prayer hybrid", "Skiller (woodcutting/fishing)", "Combat berserker".`,
      `The narrative should describe WHO this character IS as a player and what they prioritize. Be bold — no "balanced" or "well-rounded" hedging.`,
      `The pillars should be 2-4 concrete focus areas (specific skills or activities, NOT vague themes).`,
      ``,
      `Return JSON only: { "narrative": "2-4 sentences describing this character's identity and what they always prioritize", "pillars": ["Specific Skill/Activity 1", "Specific Skill/Activity 2", "Specific Skill/Activity 3"] }`,
      ``,
      `CHARACTER: ${instance.config.name}`,
      `SKILLS (id:level): ${skillsSummary}`,
      `MAP / LOCATION:`,
      mapAwareness,
      cur
        ? `CURRENT IDENTITY: ${cur.narrative} (Pillars: ${cur.pillars.join(", ")}) — evolve this if skills have changed, but stay consistent with the core identity unless there's a strong reason to pivot`
        : `CURRENT IDENTITY: none — choose a strong, specific build identity now`,
    ].join("\n");

    try {
      const response = await runtime.useModel(ModelType.TEXT_SMALL, {
        prompt,
        maxTokens: 360,
        temperature: 0.55,
      });
      const text = typeof response === "string" ? response : "";
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        return;
      }
      const parsed = JSON.parse(jsonMatch[0]) as {
        narrative?: string;
        pillars?: unknown;
      };
      const narrative = (parsed.narrative || "").trim();
      if (!narrative) {
        return;
      }
      const pillarsRaw = Array.isArray(parsed.pillars) ? parsed.pillars : [];
      const pillars = pillarsRaw
        .map((p) => String(p).trim())
        .filter(Boolean)
        .slice(0, 6);
      ServerNetwork.agentCharacterVision.set(characterId, {
        narrative,
        pillars: pillars.length > 0 ? pillars : ["Balanced progression"],
        updatedAt: Date.now(),
        source: "llm",
      });
    } catch {
      /* best-effort */
    }
  }

  private async stopChatRuntime(characterId: string): Promise<void> {
    const instance = this.agents.get(characterId);
    if (!instance?.chatRuntime) {
      if (instance) {
        instance.chatRuntimeInfo = null;
        instance.chatRuntimeConfigSig = undefined;
      }
      return;
    }

    const runtime = instance.chatRuntime;
    instance.chatRuntime = null;
    instance.chatRuntimeInfo = null;
    instance.chatRuntimeConfigSig = undefined;

    try {
      await Promise.race([
        runtime.stop(),
        new Promise((resolve) => setTimeout(resolve, 5000)),
      ]);
    } catch {
      // Best effort cleanup only.
    }
  }

  async generateDashboardChatReply(
    characterId: string,
    userMessage: string,
  ): Promise<DashboardLlmReplyResult> {
    const instance = this.agents.get(characterId);
    if (!instance) {
      return {
        ok: false,
        code: "NOT_FOUND",
        message:
          "Agent is not loaded on this server. Reopen the dashboard or start the agent again.",
      };
    }

    const runtime = await this.ensureChatRuntime(characterId);
    const runtimeInfo = instance.chatRuntimeInfo;
    if (!runtime || !runtimeInfo) {
      const cc = instance.config.characterConfig;
      const provider = await getModelProviderPlugin({
        characterSecrets: cc?.settings?.secrets,
        characterModel:
          typeof cc?.settings?.model === "string" ? cc.settings.model : null,
      });
      if (!provider) {
        return {
          ok: false,
          code: "NO_PROVIDER",
          message:
            "No usable LLM API key is configured. Add a key in Agent Settings or set OPENROUTER_API_KEY, OPENAI_API_KEY, ANTHROPIC_API_KEY, or ELIZAOS_CLOUD_API_KEY on the server (masked or placeholder values are ignored).",
        };
      }
      return {
        ok: false,
        code: "RUNTIME_INIT_FAILED",
        message:
          "The chat runtime failed to start. Check server logs for plugin or network errors.",
      };
    }

    const prompt = this.buildDashboardChatPrompt(instance, userMessage);
    const useOpts = {
      prompt,
      maxTokens: 520,
      temperature: 0.7,
      stream: false as const,
    };

    let lastResponse: unknown;
    try {
      lastResponse = await runtime.useModel(ModelType.TEXT_LARGE, useOpts);
      let text = await normalizeDashboardUseModelResponse(lastResponse);
      if (!text) {
        lastResponse = await runtime.useModel(ModelType.TEXT_SMALL, useOpts);
        text = await normalizeDashboardUseModelResponse(lastResponse);
      }
      if (!text) {
        if (
          lastResponse !== null &&
          lastResponse !== undefined &&
          lastResponse !== "" &&
          !(typeof lastResponse === "string" && !lastResponse.trim())
        ) {
          console.warn(
            `[AgentManager] useModel returned no extractable text (type=${typeof lastResponse})`,
          );
        }
        return {
          ok: false,
          code: "EMPTY_RESPONSE",
          message:
            "The model returned no text. Try another model, confirm your API key and quota, or check provider status (rate limits, content policy).",
        };
      }

      const { tailText, llmIntent, hadJsonFirstLine, parsedActionNone } =
        this.splitDashboardLlmResponse(text, instance.service);

      let finalText: string;
      if (hadJsonFirstLine) {
        if (tailText) {
          finalText = tailText;
        } else if (llmIntent) {
          finalText = llmIntent.text;
        } else if (parsedActionNone) {
          finalText = "Okay.";
        } else {
          finalText =
            "I couldn't map that to a valid action. Use ids from NEARBY or itemIds from INVENTORY on line 1, or try Quick Actions.";
        }
      } else {
        finalText = text.trim();
      }

      if (llmIntent) {
        try {
          await this.sendCommand(
            characterId,
            llmIntent.command,
            llmIntent.data,
          );
        } catch (cmdErr) {
          const cmdMsg =
            cmdErr instanceof Error ? cmdErr.message : String(cmdErr);
          console.warn(
            `[AgentManager] Dashboard LLM JSON action failed for ${characterId}:`,
            cmdErr,
          );
          if (!tailText.trim() && hadJsonFirstLine) {
            finalText = `Action failed: ${cmdMsg}`;
          }
        }
      }

      if (!finalText.trim()) {
        finalText = "Okay.";
      }

      recordAgentThought(characterId, {
        type: "thinking",
        content: `Operator message: ${userMessage}\nModel output: ${text}\nOperator-facing: ${finalText}${llmIntent ? `\nDispatched command: ${llmIntent.command}` : ""}`,
        decisionPath: "llm",
        providers: [
          runtimeInfo.model === "provider default"
            ? runtimeInfo.provider
            : `${runtimeInfo.provider}:${runtimeInfo.model}`,
        ],
      });

      return {
        ok: true,
        text: finalText,
        provider: runtimeInfo.provider,
        model: runtimeInfo.model,
        source: runtimeInfo.source,
      };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.warn(
        `[AgentManager] Dashboard chat useModel failed for ${characterId}:`,
        err,
      );
      return {
        ok: false,
        code: "LLM_ERROR",
        message: `LLM request failed: ${msg}`,
      };
    }
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

    const stopPromises: Promise<void>[] = [];

    for (const [characterId] of this.agents) {
      stopPromises.push(
        this.stopAgent(characterId)
          .then(() => this.stopChatRuntime(characterId))
          .catch((err) => {
            console.error(
              `[AgentManager] Error stopping agent ${characterId}:`,
              errMsg(err),
            );
          }),
      );
    }

    await Promise.all(stopPromises);

    this.dispose();
    this.agents.clear();
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
  if (globalAgentManager && globalAgentManager !== manager) {
    const staleManager = globalAgentManager;
    void staleManager.shutdown().catch((err) => {
      console.warn(
        "[AgentManager] Failed to shutdown previous manager during replacement:",
        errMsg(err),
      );
      staleManager.dispose();
    });
  }
  globalAgentManager = manager;
}
