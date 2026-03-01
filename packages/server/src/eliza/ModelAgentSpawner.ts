/**
 * ModelAgentSpawner - Spawns ElizaOS agents with different AI models
 *
 * Each agent uses a different AI model (OpenAI, Anthropic, Groq) and
 * competes in the game with a system prompt focused on mastering combat,
 * skills, and strategic dueling.
 *
 * Usage:
 * ```typescript
 * import { spawnModelAgents } from './ModelAgentSpawner';
 * await spawnModelAgents(world);
 * ```
 */

import {
  AgentRuntime,
  ModelType,
  type Plugin,
  type Character,
} from "@elizaos/core";
import fs from "fs";
import path from "path";
import { EventType, getDuelArenaConfig, type World } from "@hyperscape/shared";
import { createJWT } from "../shared/utils.js";
import { errMsg } from "../shared/errMsg.js";
import { hyperscapePlugin } from "@hyperscape/plugin-hyperscape";
import type { EmbeddedHyperscapeService } from "./EmbeddedHyperscapeService.js";
import {
  ejectAgentFromCombatArena,
  recoverAgentFromDeathLoop,
} from "./agentRecovery.js";
import { getAgentManager } from "./AgentManager.js";
import {
  loadModelPlugin,
  loadSqlPlugin,
  createAgentCharacter,
} from "./agentHelpers.js";

/**
 * Model provider configuration
 */
export interface ModelProviderConfig {
  /** Provider name (openai, anthropic, groq, xai) */
  provider: "openai" | "anthropic" | "groq" | "xai" | "openrouter";
  /** Specific model to use */
  model: string;
  /** Display name for the agent */
  displayName: string;
  /** Environment variable for API key */
  apiKeyEnv: string;
  /** Plugin module name */
  pluginModule: string;
  /** Plugin export name */
  pluginExport: string;
}

/**
 * AI model configurations for agents
 */
export const MODEL_AGENTS: ModelProviderConfig[] = [
  // OpenAI Models
  {
    provider: "openai",
    model: "gpt-4o",
    displayName: "GPT-4o",
    apiKeyEnv: "OPENAI_API_KEY",
    pluginModule: "@elizaos/plugin-openai",
    pluginExport: "openaiPlugin",
  },
  {
    provider: "openai",
    model: "gpt-4o-mini",
    displayName: "GPT-4o Mini",
    apiKeyEnv: "OPENAI_API_KEY",
    pluginModule: "@elizaos/plugin-openai",
    pluginExport: "openaiPlugin",
  },
  // Anthropic Models
  {
    provider: "anthropic",
    model: "claude-opus-4-5-20251101",
    displayName: "Claude Opus",
    apiKeyEnv: "ANTHROPIC_API_KEY",
    pluginModule: "@elizaos/plugin-anthropic",
    pluginExport: "anthropicPlugin",
  },
  {
    provider: "anthropic",
    model: "claude-sonnet-4-5-20250929",
    displayName: "Claude Sonnet",
    apiKeyEnv: "ANTHROPIC_API_KEY",
    pluginModule: "@elizaos/plugin-anthropic",
    pluginExport: "anthropicPlugin",
  },
  {
    provider: "anthropic",
    model: "claude-haiku-4-5-20251001",
    displayName: "Claude Haiku",
    apiKeyEnv: "ANTHROPIC_API_KEY",
    pluginModule: "@elizaos/plugin-anthropic",
    pluginExport: "anthropicPlugin",
  },
  // Groq Models
  {
    provider: "groq",
    model: "meta-llama/llama-4-scout-17b-16e-instruct",
    displayName: "Llama 4 Scout",
    apiKeyEnv: "GROQ_API_KEY",
    pluginModule: "@elizaos/plugin-groq",
    pluginExport: "groqPlugin",
  },
  {
    provider: "groq",
    model: "meta-llama/llama-4-maverick-17b-128e-instruct",
    displayName: "Llama 4 Maverick",
    apiKeyEnv: "GROQ_API_KEY",
    pluginModule: "@elizaos/plugin-groq",
    pluginExport: "groqPlugin",
  },
  {
    provider: "groq",
    model: "moonshotai/kimi-k2-instruct",
    displayName: "Kimi K2",
    apiKeyEnv: "GROQ_API_KEY",
    pluginModule: "@elizaos/plugin-groq",
    pluginExport: "groqPlugin",
  },
  {
    provider: "groq",
    model: "qwen/qwen3-32b",
    displayName: "Qwen 3 30B",
    apiKeyEnv: "GROQ_API_KEY",
    pluginModule: "@elizaos/plugin-groq",
    pluginExport: "groqPlugin",
  },
];

// System prompt, character creation, plugin loaders — all in agentHelpers.ts

/**
 * Model agents now use the hyperscapePlugin which connects via WebSocket.
 * Each agent gets a JWT for authentication and joins the game world as a
 * normal player, enabling the full ElizaOS LLM decision loop.
 */

/**
 * Running agent instance
 */
interface RunningAgent {
  config: ModelProviderConfig;
  runtime: AgentRuntime;
  characterId: string;
  accountId: string;
}

/**
 * Global registry of running model agents
 */
const runningAgents: Map<string, RunningAgent> = new Map();

function getModelAgentKey(config: { provider: string; model: string }): string {
  return `${config.provider}-${config.model}`;
}

function resolveModelAgentServerUrls(): { wsUrl: string; apiUrl: string } {
  const explicitServerUrl = process.env.HYPERSCAPE_SERVER_URL?.trim();
  const portFromEnv = process.env.PORT ? Number(process.env.PORT) : NaN;

  const wsUrl =
    explicitServerUrl && explicitServerUrl.length > 0
      ? explicitServerUrl
      : Number.isFinite(portFromEnv) && portFromEnv > 0
        ? `ws://127.0.0.1:${portFromEnv}/ws`
        : process.env.PUBLIC_WS_URL || "ws://127.0.0.1:5555/ws";

  const apiUrl =
    process.env.HYPERSCAPE_API_URL ||
    wsUrl
      .replace(/^wss:/, "https:")
      .replace(/^ws:/, "http:")
      .replace(/\/ws$/, "");

  return { wsUrl, apiUrl };
}

function collectErrorMessages(error: unknown): string[] {
  const messages: string[] = [];
  const visited = new Set<unknown>();
  const queue: unknown[] = [error];

  while (queue.length > 0) {
    const current = queue.shift();
    if (!current || visited.has(current)) continue;
    visited.add(current);

    if (current instanceof Error) {
      if (current.message) messages.push(current.message);
      if (current.stack) messages.push(current.stack);

      const cause = (current as Error & { cause?: unknown }).cause;
      if (cause) queue.push(cause);
      continue;
    }

    if (typeof current === "string") {
      messages.push(current);
      continue;
    }

    if (typeof current === "object") {
      const candidate = current as {
        message?: unknown;
        stack?: unknown;
        cause?: unknown;
      };
      if (typeof candidate.message === "string")
        messages.push(candidate.message);
      if (typeof candidate.stack === "string") messages.push(candidate.stack);
      if (candidate.cause) queue.push(candidate.cause);
    }
  }

  return messages;
}

function isRecoverableModelRuntimeInitError(error: unknown): boolean {
  const haystack = collectErrorMessages(error).join("\n").toLowerCase();
  if (!haystack) return false;

  const destructiveMigrationBlocked = haystack.includes(
    "destructive migration blocked",
  );
  const pgliteMigrationsSchemaError = haystack.includes(
    "create schema if not exists migrations",
  );
  const pgliteAbort =
    haystack.includes("pglite") &&
    haystack.includes("aborted(). build with -sassertions");

  return (
    destructiveMigrationBlocked || pgliteMigrationsSchemaError || pgliteAbort
  );
}

async function resetAgentPgliteDataDir(
  dataDir: string,
  displayName: string,
): Promise<void> {
  const normalized = path.resolve(dataDir);
  const root = path.parse(normalized).root;
  if (normalized === root) {
    throw new Error(
      `[ModelAgentSpawner] Refusing to reset unsafe PGLite path for ${displayName}: ${normalized}`,
    );
  }

  const stamp = new Date()
    .toISOString()
    .replace(/[-:]/g, "")
    .replace(/\..*$/, "")
    .replace("T", "-");
  const backupDir = `${normalized}.corrupt-${stamp}`;

  if (fs.existsSync(normalized)) {
    try {
      await fs.promises.rename(normalized, backupDir);
      console.warn(
        `[ModelAgentSpawner] Backed up ${displayName} PGLite dir to ${backupDir}`,
      );
    } catch (renameError) {
      console.warn(
        `[ModelAgentSpawner] Failed to back up PGLite dir for ${displayName}: ${errMsg(renameError)}. Deleting ${normalized} instead.`,
      );
      await fs.promises.rm(normalized, { recursive: true, force: true });
    }
  }

  await fs.promises.mkdir(normalized, { recursive: true });
}

/**
 * Spawn ElizaOS agents with different AI models
 *
 * @param world - The Hyperscape world instance
 * @param options - Configuration options
 * @returns Number of agents spawned
 */
export async function spawnModelAgents(
  world: World,
  options: {
    /** Maximum number of agents to spawn */
    maxAgents?: number;
    /** Specific providers to spawn (if empty, spawns all available) */
    providers?: Array<"openai" | "anthropic" | "groq" | "xai" | "openrouter">;
  } = {},
): Promise<number> {
  const { maxAgents = 10, providers = [] } = options;

  // PERF: Yield control to the event loop so tick system setTimeout callbacks
  // can fire between heavy synchronous operations (PGlite init, plugin loading).
  const yieldToEventLoop = () =>
    new Promise<void>((resolve) => setTimeout(resolve, 0));

  console.log("[ModelAgentSpawner] Starting ElizaOS model agent spawning...");

  // Filter agents by provider if specified
  let agentsToSpawn = MODEL_AGENTS;
  if (providers.length > 0) {
    agentsToSpawn = agentsToSpawn.filter((a) => providers.includes(a.provider));
  }
  agentsToSpawn = agentsToSpawn.slice(0, maxAgents);

  // Load shared plugins
  const modelAgentSqlEnabled = !/^(0|false|no|off)$/i.test(
    process.env.MODEL_AGENT_SQL_ENABLED || "true",
  );
  const sqlPlugin = modelAgentSqlEnabled
    ? await loadSqlPlugin("ModelAgentSpawner")
    : null;
  if (!modelAgentSqlEnabled) {
    console.log(
      "[ModelAgentSpawner] MODEL_AGENT_SQL_ENABLED=false, skipping SQL plugin for model runtimes",
    );
  }
  // Trajectory logger and local embedding plugin are intentionally omitted:
  // both cause unbounded memory growth (WASM heap + in-memory log accumulation).

  // Get database system for character creation
  // @ts-ignore - Dynamic import to avoid circular dependency
  const databaseSystem = world.getSystem("database");
  const db = databaseSystem?.getDb?.();

  if (!db) {
    console.error("[ModelAgentSpawner] Database not available");
    return 0;
  }

  const { characters, users } = await import("../database/schema.js");
  const { eq } = await import("drizzle-orm");

  // Create shared account for model agents
  const accountId = "model-agents-account";
  const existingUsers = (await db
    .select()
    .from(users)
    .where(eq(users.id, accountId))) as Array<{ id: string }>;

  if (existingUsers.length === 0) {
    await db.insert(users).values({
      id: accountId,
      name: "AI Model Agents",
      roles: "agent",
      createdAt: new Date().toISOString(),
    });
    console.log("[ModelAgentSpawner] Created shared account for model agents");
  }

  let spawnedCount = 0;
  let consecutiveFailures = 0;
  const MAX_CONSECUTIVE_FAILURES = 3;
  const { wsUrl: hyperscapeServerUrl, apiUrl: hyperscapeApiUrl } =
    resolveModelAgentServerUrls();

  console.log(
    `[ModelAgentSpawner] Using HYPERSCAPE_SERVER_URL=${hyperscapeServerUrl} for model-agent runtimes`,
  );
  console.log(
    `[ModelAgentSpawner] Using HYPERSCAPE_API_URL=${hyperscapeApiUrl} for model-agent runtimes`,
  );

  for (const agentConfig of agentsToSpawn) {
    let spawnedThisIteration = false;

    // Check if API key is available
    if (!process.env[agentConfig.apiKeyEnv]) {
      console.log(
        `[ModelAgentSpawner] Skipping ${agentConfig.displayName} - no API key`,
      );
      continue;
    }

    // Check if already running
    const agentKey = getModelAgentKey(agentConfig);
    if (runningAgents.has(agentKey)) {
      console.log(
        `[ModelAgentSpawner] ${agentConfig.displayName} already running`,
      );
      continue;
    }

    let runtime: AgentRuntime | null = null;
    try {
      // Load model-specific plugin (shared helper)
      const modelPlugin = await loadModelPlugin(
        agentConfig,
        "ModelAgentSpawner",
      );
      if (!modelPlugin) {
        continue;
      }

      // Yield after heavy plugin loading to let tick callbacks fire
      await yieldToEventLoop();

      // Generate authentication token for this agent
      const authToken = await createJWT({ userId: accountId });

      // Create character using shared helper — includes PGLITE_DATA_DIR,
      // model routing secrets, and system prompt
      // Per-agent env: pass connection and migration settings via character
      // secrets instead of mutating global process.env.  The hyperscapePlugin
      // reads these through getRuntimeSettingString() which checks secrets
      // before falling back to process.env.
      const perAgentSecrets: Record<string, string> = {
        HYPERSCAPE_SERVER_URL: hyperscapeServerUrl,
        HYPERSCAPE_API_URL: hyperscapeApiUrl,
        HYPERSCAPE_AUTH_TOKEN: authToken,
        HYPERSCAPE_PRIVY_USER_ID: accountId,
        HYPERSCAPE_CHARACTER_ID: "", // will be patched below
      };
      if (sqlPlugin) {
        perAgentSecrets.ELIZA_ALLOW_DESTRUCTIVE_MIGRATIONS = "true";
      }

      const { character, characterId } = createAgentCharacter(agentConfig, {
        secrets: perAgentSecrets,
      });
      // Patch characterId into secrets now that we know it
      if (character.settings?.secrets) {
        (
          character.settings.secrets as Record<string, string>
        ).HYPERSCAPE_CHARACTER_ID = characterId;
      }

      // Ensure character exists in database
      const existingChars = (await db
        .select()
        .from(characters)
        .where(eq(characters.id, characterId))) as Array<{ id: string }>;

      if (existingChars.length === 0) {
        await db.insert(characters).values({
          id: characterId,
          accountId,
          name: agentConfig.displayName,
          isAgent: 1,
          createdAt: Date.now(),
        });
        console.log(
          `[ModelAgentSpawner] Created character: ${agentConfig.displayName}`,
        );
      }

      const embeddedAgentManager = getAgentManager();
      if (embeddedAgentManager?.hasAgent(characterId)) {
        console.log(
          `[ModelAgentSpawner] Skipping ${agentConfig.displayName} (${characterId}) - already managed by embedded AgentManager`,
        );
        continue;
      }

      // Build runtime plugin list. SQL is pre-registered before initialize()
      // so its adapter/migrations complete before other plugin services start.
      const runtimePlugins: Plugin[] = [modelPlugin, hyperscapePlugin];

      // Create ElizaOS AgentRuntime
      console.log(
        `[ModelAgentSpawner] Creating AgentRuntime for ${agentConfig.displayName}...`,
      );

      const createRuntimeInstance = (): AgentRuntime => {
        const runtimeInstance = new AgentRuntime({
          character,
          plugins: runtimePlugins,
          // token: process.env[agentConfig.apiKeyEnv],
          // databaseAdapter: undefined, // Will use in-memory or default
        });

        // Model agents only need TEXT_* generation; disabling TEXT_EMBEDDING
        // avoids bootstrap ActionFilter/embedding services generating heavy
        // startup embedding traffic and memory churn.
        const originalGetModel = runtimeInstance.getModel.bind(runtimeInstance);
        runtimeInstance.getModel = ((modelType: unknown) => {
          if (modelType === ModelType.TEXT_EMBEDDING) {
            return null;
          }
          return originalGetModel(
            modelType as Parameters<AgentRuntime["getModel"]>[0],
          );
        }) as AgentRuntime["getModel"];

        // Prevent ensureEmbeddingDimension from taking > 30s due to API timeouts/rate limits
        runtimeInstance.ensureEmbeddingDimension = async () => {
          try {
            // Give the API 5 seconds to reply
            await Promise.race([
              AgentRuntime.prototype.ensureEmbeddingDimension.call(
                runtimeInstance,
              ),
              new Promise((_, reject) =>
                setTimeout(
                  () =>
                    reject(new Error("Embedding dimension check timed out")),
                  5000,
                ),
              ),
            ]);
          } catch (err) {
            console.warn(
              `[ModelAgentSpawner] ensureEmbeddingDimension failed or timed out: ${errMsg(err)}. Using fallback 1536.`,
            );
            await runtimeInstance.adapter?.ensureEmbeddingDimension?.(1536);
          }
        };

        return runtimeInstance;
      };

      const MODEL_AGENT_INIT_TIMEOUT_MS = 45_000;

      const initializeRuntimeInstance = async (
        runtimeInstance: AgentRuntime,
      ): Promise<void> => {
        if (sqlPlugin) {
          await runtimeInstance.registerPlugin(sqlPlugin);
        }
        const initPromise = runtimeInstance.initialize();
        let timedOut = false;
        const timeoutPromise = new Promise<never>((_, reject) => {
          setTimeout(() => {
            timedOut = true;
            reject(
              new Error(
                `runtime.initialize() timed out after ${MODEL_AGENT_INIT_TIMEOUT_MS / 1000}s`,
              ),
            );
          }, MODEL_AGENT_INIT_TIMEOUT_MS);
        });
        try {
          await Promise.race([initPromise, timeoutPromise]);
        } catch (err) {
          if (timedOut) {
            // Swallow the dangling initPromise so it doesn't surface as
            // an unhandled rejection when it eventually settles.
            initPromise.catch(() => {});
            // Kick off stop() to tear down any partially-initialized
            // plugins / WASM heaps from the background initialize().
            runtimeInstance.stop().catch(() => {});
          }
          throw err;
        }
      };

      const pgliteDataDir =
        typeof character.settings?.secrets?.PGLITE_DATA_DIR === "string"
          ? character.settings.secrets.PGLITE_DATA_DIR
          : null;

      let runtimeInstance = createRuntimeInstance();
      runtime = runtimeInstance;

      try {
        // Initialize the runtime (required for plugins to start)
        await initializeRuntimeInstance(runtimeInstance);
      } catch (initializeError) {
        if (
          pgliteDataDir &&
          isRecoverableModelRuntimeInitError(initializeError)
        ) {
          console.warn(
            `[ModelAgentSpawner] Runtime init failed for ${agentConfig.displayName}: ${errMsg(initializeError)}. Resetting ${pgliteDataDir} and retrying once.`,
          );
          await Promise.race([
            runtimeInstance.stop().catch(() => undefined),
            new Promise((r) => setTimeout(r, 10_000)),
          ]);
          await resetAgentPgliteDataDir(pgliteDataDir, agentConfig.displayName);

          runtimeInstance = createRuntimeInstance();
          runtime = runtimeInstance;
          await initializeRuntimeInstance(runtimeInstance);
        } else {
          throw initializeError;
        }
      }

      // Yield after heavy runtime init to let tick callbacks fire
      await yieldToEventLoop();
      console.log(
        `[ModelAgentSpawner] AgentRuntime initialized for ${agentConfig.displayName}`,
      );

      // Store running agent
      runningAgents.set(agentKey, {
        config: agentConfig,
        runtime: runtimeInstance,
        characterId,
        accountId,
      });

      spawnedCount++;
      spawnedThisIteration = true;
      consecutiveFailures = 0;
      console.log(
        `[ModelAgentSpawner] ✅ Spawned: ${agentConfig.displayName} (${agentConfig.model})`,
      );
    } catch (error) {
      stopAgentBehaviorLoop(agentKey);
      agentPlans.delete(agentKey);
      if (runtime) {
        try {
          await Promise.race([
            runtime.stop(),
            new Promise((r) => setTimeout(r, 10_000)),
          ]);
        } catch (stopErr) {
          console.warn(
            `[ModelAgentSpawner] Failed to cleanup runtime for ${agentConfig.displayName}: ${errMsg(stopErr)}`,
          );
        }
        // Explicitly close DB adapter to free PGLite WASM heap
        try {
          const adapter = runtime.adapter as {
            close?: () => Promise<void>;
            db?: { close?: () => Promise<void> };
          } | null;
          await adapter?.close?.();
          await adapter?.db?.close?.();
        } catch {
          /* best-effort cleanup */
        }
        runtime = null;
      }
      console.error(
        `[ModelAgentSpawner] ❌ Failed to spawn ${agentConfig.displayName}:`,
        errMsg(error),
      );
      consecutiveFailures++;
      if (consecutiveFailures >= MAX_CONSECUTIVE_FAILURES) {
        console.error(
          `[ModelAgentSpawner] Circuit breaker: ${MAX_CONSECUTIVE_FAILURES} consecutive failures, aborting remaining spawns`,
        );
        break;
      }
    }

    // Stagger successful agent spawns to avoid concurrent PGLite/API contention
    // that causes ElizaOS service registration timeouts (30s limit)
    if (spawnedThisIteration) {
      const SPAWN_DELAY_MS = 5000;
      console.log(
        `[ModelAgentSpawner] Waiting ${SPAWN_DELAY_MS / 1000}s before next agent...`,
      );
      await new Promise((r) => setTimeout(r, SPAWN_DELAY_MS));
    }
  }

  console.log(
    `[ModelAgentSpawner] ✅ Spawned ${spawnedCount}/${agentsToSpawn.length} model agents`,
  );

  return spawnedCount;
}

/**
 * Get all running model agents
 */
export function getRunningAgents(): Map<string, RunningAgent> {
  return new Map(runningAgents);
}

export function getAgentRuntimeByCharacterId(
  characterId: string,
): AgentRuntime | null {
  for (const agent of runningAgents.values()) {
    if (agent.characterId === characterId) return agent.runtime;
  }
  return null;
}

/**
 * Stop a specific model agent
 */
export async function stopModelAgent(
  provider: string,
  model: string,
): Promise<boolean> {
  const key = getModelAgentKey({ provider, model });
  const agent = runningAgents.get(key);

  if (!agent) {
    return false;
  }

  stopAgentBehaviorLoop(key);
  agentPlans.delete(key);

  let stopError: unknown = null;
  try {
    // Stop the runtime (this also stops HyperscapeService).
    // 10s timeout prevents indefinite hang if stop() blocks.
    await Promise.race([
      agent.runtime.stop(),
      new Promise((r) => setTimeout(r, 10_000)),
    ]);
  } catch (error) {
    stopError = error;
  } finally {
    // Explicitly close DB adapter to free PGLite WASM heap memory.
    // runtime.stop() should do this, but we ensure it as a safety net.
    try {
      const adapter = agent.runtime.adapter as {
        close?: () => Promise<void>;
        db?: { close?: () => Promise<void> };
      } | null;
      await adapter?.close?.();
      await adapter?.db?.close?.();
    } catch {
      /* best-effort cleanup */
    }
    runningAgents.delete(key);
  }

  if (stopError) {
    console.error(
      `[ModelAgentSpawner] Error stopping agent:`,
      errMsg(stopError),
    );
    return false;
  }

  console.log(`[ModelAgentSpawner] Stopped agent: ${agent.config.displayName}`);
  return true;
}

/**
 * Stop all running model agents
 */
export async function stopAllModelAgents(): Promise<void> {
  console.log(
    `[ModelAgentSpawner] Stopping ${runningAgents.size} model agents...`,
  );

  const stopPromises: Promise<boolean>[] = [];

  for (const agent of runningAgents.values()) {
    stopPromises.push(
      stopModelAgent(agent.config.provider, agent.config.model),
    );
  }

  await Promise.all(stopPromises);

  console.log("[ModelAgentSpawner] All model agents stopped");
}

/**
 * Get available models that can be spawned (have API keys configured)
 */
export function getAvailableModels(): ModelProviderConfig[] {
  return MODEL_AGENTS.filter((config) => process.env[config.apiKeyEnv]);
}

// ============================================================================
// Autonomous Behavior Loop
// ============================================================================

/** Behavior tick interval in ms */
const BEHAVIOR_TICK_INTERVAL = 3000; // 3 seconds

/** Map of behavior loop intervals for cleanup */
const behaviorIntervals: Map<string, NodeJS.Timeout> = new Map();

/** Keep autonomous roaming near the duel lobby so spectators always see activity.
 * Expanded from 80/150 so agents can reach resources (trees, rocks, fishing spots)
 * that spawn outside the flat duel arena zone. */
const LOBBY_SOFT_RADIUS = 120;
const LOBBY_HARD_RADIUS = 200;

function distance2D(ax: number, az: number, bx: number, bz: number): number {
  const dx = ax - bx;
  const dz = az - bz;
  return Math.hypot(dx, dz);
}

function getGroundedY(
  world: World,
  x: number,
  z: number,
  fallbackY: number,
): number {
  const terrain = world.getSystem("terrain") as {
    getHeightAt?: (x: number, z: number) => number;
  } | null;
  const sampledY = terrain?.getHeightAt?.(x, z);
  return typeof sampledY === "number" && Number.isFinite(sampledY)
    ? sampledY
    : fallbackY;
}

function getSafeLobbyPosition(
  world: World,
  agentSeed: string,
): [number, number, number] {
  const lobby = getDuelArenaConfig().lobbySpawnPoint;

  let hash = 0;
  for (let i = 0; i < agentSeed.length; i++) {
    hash = (hash * 31 + agentSeed.charCodeAt(i)) >>> 0;
  }

  const angle = ((hash % 360) * Math.PI) / 180;
  const radius = 6 + (hash % 4);
  const x = lobby.x + Math.cos(angle) * radius;
  const z = lobby.z + Math.sin(angle) * radius;
  const y = getGroundedY(world, x, z, lobby.y);
  return [x, y, z];
}

function constrainTargetToLobby(
  world: World,
  target: [number, number, number],
): [number, number, number] {
  const lobby = getDuelArenaConfig().lobbySpawnPoint;
  const dist = distance2D(target[0], target[2], lobby.x, lobby.z);
  let x = target[0];
  let z = target[2];

  if (dist > LOBBY_SOFT_RADIUS && dist > 0) {
    const scale = LOBBY_SOFT_RADIUS / dist;
    x = lobby.x + (target[0] - lobby.x) * scale;
    z = lobby.z + (target[2] - lobby.z) * scale;
  }

  const y = getGroundedY(world, x, z, lobby.y);
  return [x, y, z];
}

function snapAgentToPosition(
  service: EmbeddedHyperscapeService,
  position: [number, number, number],
): boolean {
  const playerId = service.getPlayerId();
  if (!playerId) return false;

  const world = service.getWorld();
  const entity = world.entities.get(playerId);
  if (!entity) return false;

  const data = entity.data as {
    position?: unknown;
    rotation?: number;
    _teleport?: boolean;
  };
  data.position = position;
  data._teleport = true;

  world.emit("player:teleport", {
    playerId,
    position: { x: position[0], y: position[1], z: position[2] },
    rotation: Number.isFinite(data.rotation) ? data.rotation : 0,
  });

  world.emit(EventType.ENTITY_MODIFIED, {
    id: playerId,
    changes: {
      position,
      _teleport: true,
    },
  });

  return true;
}

/**
 * Start the autonomous behavior loop for an embedded agent
 *
 * This is a simplified behavior loop that uses EmbeddedHyperscapeService
 * directly for game actions, without going through the full ElizaOS
 * action/provider pipeline.
 */
function startAgentBehaviorLoop(
  runtime: AgentRuntime,
  service: EmbeddedHyperscapeService,
  config: ModelProviderConfig,
): void {
  const agentKey = getModelAgentKey(config);

  console.log(
    `[ModelAgentSpawner] Starting behavior loop for ${config.displayName}`,
  );

  // Clear any existing interval
  const existingInterval = behaviorIntervals.get(agentKey);
  if (existingInterval) {
    clearInterval(existingInterval);
  }

  // Start the behavior loop with execution lock to prevent overlapping ticks
  let tickInProgress = false;
  const interval = setInterval(async () => {
    if (tickInProgress) return;
    tickInProgress = true;
    try {
      await executeBehaviorTick(runtime, service, config);
    } catch (error) {
      console.error(
        `[ModelAgentSpawner] Behavior tick error for ${config.displayName}:`,
        errMsg(error),
      );
    } finally {
      tickInProgress = false;
    }
  }, BEHAVIOR_TICK_INTERVAL);

  behaviorIntervals.set(agentKey, interval);

  // Execute first tick immediately
  executeBehaviorTick(runtime, service, config).catch((err) => {
    console.error(
      `[ModelAgentSpawner] Initial behavior tick error for ${config.displayName}:`,
      errMsg(err),
    );
  });
}

/**
 * Stop the behavior loop for an agent
 */
function stopAgentBehaviorLoop(agentKey: string): void {
  const interval = behaviorIntervals.get(agentKey);
  if (interval) {
    clearInterval(interval);
    behaviorIntervals.delete(agentKey);
  }
}

/**
 * Execute a single behavior tick
 *
 * The agent observes its game state and decides what to do:
 * - Build a short LLM plan for productive actions
 * - Execute the next queued action
 * - Fall back to simple exploration when no plan is available
 */
// ============================================================================
// LLM Behavior Planning
// ============================================================================

interface PlannedAction {
  action: string;
  target?: string;
  position?: [number, number, number];
  reason: string;
}

interface AgentPlan {
  actions: PlannedAction[];
  goal: string;
  createdAt: number;
}

const agentPlans: Map<string, AgentPlan> = new Map();
const PLAN_STALE_MS = 30000;

async function getOrCreatePlan(
  runtime: AgentRuntime,
  service: EmbeddedHyperscapeService,
  config: ModelProviderConfig,
  gameState: ReturnType<EmbeddedHyperscapeService["getGameState"]> & object,
  world: ReturnType<EmbeddedHyperscapeService["getWorld"]>,
): Promise<AgentPlan | null> {
  const planKey = getModelAgentKey(config);
  const existing = agentPlans.get(planKey);
  if (
    existing &&
    existing.actions.length > 0 &&
    Date.now() - existing.createdAt < PLAN_STALE_MS
  ) {
    return existing;
  }

  try {
    const plan = await createBehaviorPlan(runtime, service, config, gameState);
    if (plan) {
      agentPlans.set(planKey, plan);
      return plan;
    }
  } catch (err) {
    console.debug(
      `[${config.displayName}] LLM plan failed, using fallback:`,
      errMsg(err),
    );
  }

  return null;
}

async function createBehaviorPlan(
  runtime: AgentRuntime,
  service: EmbeddedHyperscapeService,
  config: ModelProviderConfig,
  gameState: ReturnType<EmbeddedHyperscapeService["getGameState"]> & object,
): Promise<AgentPlan | null> {
  const { health, maxHealth, nearbyEntities, inCombat, inventory } = gameState;
  const healthPct = ((health / maxHealth) * 100).toFixed(0);

  const mobs = nearbyEntities.filter((e) => e.type === "mob").slice(0, 5);
  const resources = nearbyEntities
    .filter((e) => e.type === "resource")
    .slice(0, 5);
  const items = nearbyEntities.filter((e) => e.type === "item").slice(0, 5);
  const npcs = nearbyEntities.filter((e) => e.type === "npc").slice(0, 3);

  const foodCount = inventory.filter((i) =>
    [
      "shark",
      "lobster",
      "swordfish",
      "trout",
      "salmon",
      "shrimp",
      "bread",
      "meat",
      "cooked",
      "fish",
    ].some((f) => i.itemId.toLowerCase().includes(f)),
  ).length;

  const prompt = [
    `You are ${config.displayName}, an OSRS-style RPG agent between arena duels.`,
    `Plan your next 3-5 actions to prepare for the next duel.`,
    ``,
    `STATE: HP ${healthPct}%, ${inventory.length}/28 inventory, ${foodCount} food, ${inCombat ? "IN COMBAT" : "idle"}`,
    `NEARBY: ${mobs.length} mobs, ${resources.length} resources, ${items.length} ground items, ${npcs.length} NPCs`,
    mobs.length > 0
      ? `MOBS: ${mobs.map((m) => `${m.name || m.type}(${m.distance.toFixed(0)}m)`).join(", ")}`
      : "",
    resources.length > 0
      ? `RESOURCES: ${resources.map((r) => `${r.name || r.type}(${r.distance.toFixed(0)}m)`).join(", ")}`
      : "",
    items.length > 0
      ? `ITEMS: ${items.map((i) => `${i.name || i.type}(${i.distance.toFixed(0)}m)`).join(", ")}`
      : "",
    ``,
    `PRIORITIES: Get food for duels > train combat > gather resources > explore`,
    `AVAILABLE ACTIONS: MOVE, ATTACK, GATHER, PICKUP, USE, EQUIP, DROP, COOK, SMELT, SMITH, FIREMAKE, BANK_DEPOSIT, BANK_WITHDRAW, BANK_DEPOSIT_ALL, STORE_BUY, STORE_SELL, TALK, QUEST_ACCEPT, QUEST_COMPLETE, UNEQUIP, TRADE, FOLLOW, PRAY, CHANGE_STYLE, HOME_TELEPORT, EXPLORE, IDLE`,
    ``,
    `Respond as JSON: { "goal": "brief goal", "actions": [{"action": "ACTION", "target": "id or description", "reason": "why"}] }`,
  ]
    .filter(Boolean)
    .join("\n");

  const response = await runtime.useModel(ModelType.TEXT_SMALL, {
    prompt,
    maxTokens: 300,
    temperature: 0.5,
  });

  const text = typeof response === "string" ? response : "";
  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) return null;

  const parsed = JSON.parse(jsonMatch[0]) as {
    goal?: string;
    actions?: Array<{ action?: string; target?: string; reason?: string }>;
  };

  if (!parsed.actions || !Array.isArray(parsed.actions)) return null;

  return {
    goal: parsed.goal || "prepare for duel",
    actions: parsed.actions
      .filter((a) => a.action)
      .map((a) => ({
        action: (a.action || "IDLE").toUpperCase(),
        target: a.target,
        reason: a.reason || "",
      })),
    createdAt: Date.now(),
  };
}

async function executeQueuedAction(
  service: EmbeddedHyperscapeService,
  action: PlannedAction,
  gameState: ReturnType<EmbeddedHyperscapeService["getGameState"]> & object,
  world: ReturnType<EmbeddedHyperscapeService["getWorld"]>,
): Promise<void> {
  const { nearbyEntities } = gameState;

  switch (action.action) {
    case "ATTACK": {
      const mob = nearbyEntities.find(
        (e) =>
          e.type === "mob" &&
          e.distance < 50 &&
          (!action.target ||
            e.id === action.target ||
            (e.name || "")
              .toLowerCase()
              .includes((action.target || "").toLowerCase())),
      );
      if (mob) {
        if (mob.distance > 3) {
          await service.executeMove(mob.position, true);
        } else {
          await service.executeAttack(mob.id);
        }
      }
      break;
    }

    case "GATHER": {
      const resource = nearbyEntities.find(
        (e) =>
          e.type === "resource" &&
          e.distance < 40 &&
          (!action.target ||
            (e.name || "")
              .toLowerCase()
              .includes((action.target || "").toLowerCase())),
      );
      if (resource) {
        if (resource.distance > 3) {
          await service.executeMove(resource.position, false);
        } else {
          await service.executeGather(resource.id);
        }
      }
      break;
    }

    case "PICKUP": {
      const item = nearbyEntities.find(
        (e) =>
          e.type === "item" &&
          e.distance < 30 &&
          (!action.target ||
            (e.name || "")
              .toLowerCase()
              .includes((action.target || "").toLowerCase())),
      );
      if (item) {
        if (item.distance > 2.5) {
          await service.executeMove(item.position, true);
        } else {
          await service.executePickup(item.id);
        }
      }
      break;
    }

    case "USE": {
      const useItem = gameState.inventory.find(
        (i) =>
          action.target &&
          i.itemId.toLowerCase().includes(action.target.toLowerCase()),
      );
      if (useItem) {
        await service.executeUse(useItem.itemId);
      }
      break;
    }

    case "EQUIP": {
      const equipItem = gameState.inventory.find(
        (i) =>
          action.target &&
          i.itemId.toLowerCase().includes(action.target.toLowerCase()),
      );
      if (equipItem) {
        await service.executeEquip(equipItem.itemId);
      }
      break;
    }

    case "MOVE":
    case "EXPLORE": {
      if (action.position) {
        const target = constrainTargetToLobby(world, action.position);
        await service.executeMove(target, false);
      } else if (gameState.position) {
        const exploreX = gameState.position[0] + (Math.random() - 0.5) * 50;
        const exploreZ = gameState.position[2] + (Math.random() - 0.5) * 50;
        const target = constrainTargetToLobby(world, [
          exploreX,
          gameState.position[1],
          exploreZ,
        ]);
        await service.executeMove(target, false);
      }
      break;
    }

    case "COOK":
      if (action.target) await service.executeCook(action.target);
      break;

    case "SMELT":
      if (action.target) await service.executeSmelt(action.target);
      break;

    case "SMITH":
      if (action.target) await service.executeSmith(action.target);
      break;

    case "FIREMAKE":
      await service.executeFiremake();
      break;

    case "BANK_DEPOSIT":
      if (action.target) await service.executeBankDeposit(action.target, 1);
      break;

    case "BANK_WITHDRAW":
      if (action.target) await service.executeBankWithdraw(action.target, 1);
      break;

    case "BANK_DEPOSIT_ALL":
      await service.executeBankDepositAll();
      break;

    case "STORE_BUY":
      if (action.target) {
        const [storeId, itemId] = action.target.split(":");
        if (storeId && itemId)
          await service.executeStoreBuy(storeId, itemId, 1);
      }
      break;

    case "STORE_SELL":
      if (action.target) {
        const [storeId, itemId] = action.target.split(":");
        if (storeId && itemId)
          await service.executeStoreSell(storeId, itemId, 1);
      }
      break;

    case "NPC_INTERACT":
    case "TALK":
      if (action.target)
        await service.executeNpcInteract(action.target, "talk");
      break;

    case "QUEST_ACCEPT":
      if (action.target) await service.executeQuestAccept(action.target);
      break;

    case "QUEST_COMPLETE":
      if (action.target) await service.executeQuestComplete(action.target);
      break;

    case "UNEQUIP":
      if (action.target) await service.executeUnequip(action.target);
      break;

    case "TRADE":
      if (action.target) await service.executeTradeRequest(action.target);
      break;

    case "FOLLOW":
      if (action.target) await service.executeFollow(action.target);
      break;

    case "PRAY":
    case "PRAYER":
      if (action.target) await service.executePrayerToggle(action.target);
      break;

    case "PRAYER_OFF":
      await service.executePrayerDeactivateAll();
      break;

    case "CHANGE_STYLE":
      if (action.target) await service.executeChangeStyle(action.target);
      break;

    case "HOME_TELEPORT":
      await service.executeHomeTeleport();
      break;

    case "RESPAWN":
      await service.executeRespawn();
      break;

    case "DROP":
      if (action.target) await service.executeDrop(action.target, 1);
      break;

    case "CHAT":
      if (action.target) await service.executeChat(action.target);
      break;

    case "IDLE":
    default:
      break;
  }
}

async function executeBehaviorTick(
  runtime: AgentRuntime,
  service: EmbeddedHyperscapeService,
  config: ModelProviderConfig,
): Promise<void> {
  const playerId = service.getPlayerId();
  if (!playerId) {
    return;
  }

  const world = service.getWorld();

  // Recover model agents from stale dead states outside active duel ownership.
  if (
    recoverAgentFromDeathLoop(
      world,
      playerId,
      `ModelAgentSpawner:${config.displayName}`,
    )
  ) {
    return;
  }

  if (
    ejectAgentFromCombatArena(
      world,
      playerId,
      `ModelAgentSpawner:${config.displayName}`,
    )
  ) {
    return;
  }

  // Duel scheduler owns combat behavior during streaming duels.
  const playerEntity = world.entities.get(playerId);
  const inStreamingDuel =
    (playerEntity as { data?: { inStreamingDuel?: boolean } } | undefined)?.data
      ?.inStreamingDuel === true;
  if (inStreamingDuel) {
    return;
  }

  // Get current game state
  const gameState = service.getGameState();
  if (!gameState) {
    // Agent not spawned yet
    return;
  }

  const lobby = getDuelArenaConfig().lobbySpawnPoint;
  if (gameState.position) {
    const [px, py, pz] = gameState.position;
    const distFromLobby = distance2D(px, pz, lobby.x, lobby.z);
    const groundedY = getGroundedY(world, px, pz, lobby.y);
    const invalidY = !Number.isFinite(py) || py < -20 || py > 300;
    const tooFarFromLobby = distFromLobby > LOBBY_HARD_RADIUS;
    const offTerrain =
      Number.isFinite(groundedY) && Math.abs(py - groundedY) > 3;

    if (invalidY || tooFarFromLobby || offTerrain) {
      const safePos: [number, number, number] =
        invalidY || tooFarFromLobby
          ? getSafeLobbyPosition(world, playerId ?? config.displayName)
          : [px, groundedY, pz];
      if (snapAgentToPosition(service, safePos)) {
        return;
      }
    }
  }

  const { inCombat } = gameState;

  // LLM-driven action planning
  const plan = await getOrCreatePlan(
    runtime,
    service,
    config,
    gameState,
    world,
  );

  if (!plan || plan.actions.length === 0) {
    // Fallback: simple exploration
    if (!inCombat && gameState.position) {
      const exploreX = gameState.position[0] + (Math.random() - 0.5) * 60;
      const exploreZ = gameState.position[2] + (Math.random() - 0.5) * 60;
      const target = constrainTargetToLobby(world, [
        exploreX,
        gameState.position[1],
        exploreZ,
      ]);
      await service.executeMove(target, false);
    }
    return;
  }

  // Pop next action from queue
  const nextAction = plan.actions.shift()!;

  try {
    await executeQueuedAction(service, nextAction, gameState, world);
  } catch (err) {
    console.debug(
      `[${config.displayName}] Plan action ${nextAction.action} failed:`,
      errMsg(err),
    );
  }

  // If plan is exhausted, clear it so next tick re-plans
  if (plan.actions.length === 0) {
    agentPlans.delete(getModelAgentKey(config));
  }
}
