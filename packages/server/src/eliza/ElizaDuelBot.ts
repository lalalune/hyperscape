/**
 * ElizaDuelBot - ElizaOS-powered duel bot
 *
 * Drop-in replacement for DuelBot that uses a real ElizaOS AgentRuntime
 * with hyperscapePlugin. Each bot uses a different AI model for TEXT_LARGE
 * decisions and a cheap small model for TEXT_SMALL.
 *
 * The HyperscapeService's AutonomousBehaviorManager handles the LLM decision
 * loop (movement, combat, prayer switching, etc.). The matchmaker just
 * initiates challenges between bots.
 */

import { AgentRuntime, type Plugin } from "@elizaos/core";
import { EventEmitter } from "events";
import fs from "fs";
import path from "path";
import { hyperscapePlugin } from "@hyperscape/plugin-hyperscape";
import { createJWT } from "../shared/utils.js";
import { errMsg } from "../shared/errMsg.js";
import type { ModelProviderConfig } from "./ModelAgentSpawner.js";
import {
  loadModelPlugin,
  loadSqlPlugin,
  createAgentCharacter,
  ensurePgliteDataDir,
} from "./agentHelpers.js";

// Re-export for convenience
export { MODEL_AGENTS } from "./ModelAgentSpawner.js";

/** Minimal interface for the HyperscapeService accessed through the runtime. */
interface HyperscapeServiceHandle {
  executeDuelChallenge?: (params: { targetPlayerId: string }) => Promise<void>;
  getPlayerEntity?: () => {
    position?: [number, number, number] | { x: number; y: number; z: number };
  } | null;
  startAutonomousBehavior?: () => void;
  onGameEvent?: (
    event: string,
    handler: (data: Record<string, unknown>) => void,
  ) => void;
}

/** Timeout for a single runtime.initialize() attempt (ms) */
const INIT_TIMEOUT_MS = 45_000;
/** Max retries for runtime initialization */
const MAX_INIT_RETRIES = 2;

export type ElizaDuelBotConfig = {
  /** WebSocket URL for the game server */
  wsUrl: string;
  /** Display name for this bot */
  name: string;
  /** Model provider configuration */
  modelConfig: ModelProviderConfig;
  /** Small model override for TEXT_SMALL (cheap/fast model) */
  smallModel?: string;
  /** Connection timeout in ms */
  connectTimeoutMs?: number;
  /** Account ID for JWT auth */
  accountId?: string;
};

export type ElizaDuelBotState =
  | "disconnected"
  | "connecting"
  | "idle"
  | "challenged"
  | "in_duel_rules"
  | "in_duel_stakes"
  | "in_duel_confirm"
  | "in_duel_countdown"
  | "in_duel_fighting"
  | "duel_finished";

export type ElizaDuelBotMetrics = {
  wins: number;
  losses: number;
  totalDuels: number;
  connectedAt: number;
  lastDuelAt: number;
  isConnected: boolean;
};

export class ElizaDuelBot extends EventEmitter {
  private config: Required<
    Pick<
      ElizaDuelBotConfig,
      "wsUrl" | "name" | "modelConfig" | "connectTimeoutMs" | "accountId"
    >
  > & { smallModel?: string };
  private runtime: AgentRuntime | null = null;
  private _connected = false;
  private _id: string | null = null;

  /** Retry timer for setupDuelEventListeners when service isn't ready */
  private setupRetryTimer: ReturnType<typeof setTimeout> | null = null;
  /** Whether duel event listeners have been registered (prevents duplicates) */
  private duelListenersRegistered = false;

  state: ElizaDuelBotState = "disconnected";
  currentDuelId: string | null = null;
  currentOpponentId: string | null = null;

  readonly metrics: ElizaDuelBotMetrics = {
    wins: 0,
    losses: 0,
    totalDuels: 0,
    connectedAt: 0,
    lastDuelAt: 0,
    isConnected: false,
  };

  constructor(config: ElizaDuelBotConfig) {
    super();
    this.config = {
      wsUrl: config.wsUrl,
      name: config.name,
      modelConfig: config.modelConfig,
      smallModel: config.smallModel,
      connectTimeoutMs: config.connectTimeoutMs || 30000,
      accountId: config.accountId || "eliza-duel-bots-account",
    };
  }

  get name(): string {
    return this.config.name;
  }

  get connected(): boolean {
    return this._connected;
  }

  getId(): string | null {
    return this._id;
  }

  async connect(): Promise<void> {
    this.state = "connecting";
    const { modelConfig, wsUrl, name, accountId } = this.config;
    const tag = `ElizaDuelBot:${name}`;

    console.log(
      `[ElizaDuelBot] ${name} connecting (${modelConfig.displayName} / ${modelConfig.model})...`,
    );

    let lastError: Error | null = null;

    for (let attempt = 0; attempt <= MAX_INIT_RETRIES; attempt++) {
      try {
        if (attempt > 0) {
          console.log(
            `[ElizaDuelBot] ${name} retry ${attempt}/${MAX_INIT_RETRIES}...`,
          );
          // Recreate in-memory data directory assignment
          const agentId = `agent-${modelConfig.provider}-${modelConfig.model
            .replace(/[^a-z0-9]/gi, "-")
            .toLowerCase()}`;
          ensurePgliteDataDir(agentId);
          // Small delay before retry
          await new Promise((r) => setTimeout(r, 2000));
        }

        // Load model-specific plugin (shared helper)
        const modelPlugin = await loadModelPlugin(modelConfig, tag);
        if (!modelPlugin) {
          throw new Error(
            `Failed to load model plugin for ${modelConfig.displayName}`,
          );
        }

        // Generate JWT for authentication
        const authToken = await createJWT({ userId: accountId });

        // Create character using shared helper
        const { character, characterId } = createAgentCharacter(modelConfig, {
          idPrefix: "agent",
          name,
          smallModel: this.config.smallModel,
          secrets: {
            HYPERSCAPE_SERVER_URL: wsUrl,
            HYPERSCAPE_AUTH_TOKEN: authToken,
            HYPERSCAPE_PRIVY_USER_ID: accountId,
            HYPERSCAPE_CHARACTER_ID: "",
            HYPERSCAPE_AUTONOMY_MODE: "llm",
            HYPERSCAPE_AUTO_ACCEPT_DUELS: "true",
          },
        });
        if (character.settings?.secrets) {
          (
            character.settings.secrets as Record<string, string>
          ).HYPERSCAPE_CHARACTER_ID = characterId;
        }

        // Build plugins
        const plugins: Plugin[] = [modelPlugin, hyperscapePlugin];

        const sqlPlugin = await loadSqlPlugin(tag);
        if (sqlPlugin) plugins.push(sqlPlugin);

        // Create runtime
        this.runtime = new AgentRuntime({
          character,
          plugins,
        });

        // Initialize with timeout to prevent hanging
        const initPromise = this.runtime.initialize();
        let timedOut = false;
        const timeoutPromise = new Promise<never>((_, reject) => {
          setTimeout(() => {
            timedOut = true;
            reject(
              new Error(
                `runtime.initialize() timed out after ${INIT_TIMEOUT_MS / 1000}s`,
              ),
            );
          }, INIT_TIMEOUT_MS);
        });

        try {
          await Promise.race([initPromise, timeoutPromise]);
        } catch (err) {
          if (timedOut) {
            // Swallow the dangling initPromise so it doesn't surface as
            // an unhandled rejection when it eventually settles.
            initPromise.catch(() => {});
            // Kick off stop() to tear down background initialize() work.
            this.runtime?.stop().catch(() => {});
          }
          throw err;
        }

        this._id = characterId;
        this._connected = true;
        this.metrics.isConnected = true;
        this.metrics.connectedAt = Date.now();
        this.state = "idle";

        // Listen for duel events from HyperscapeService
        this.setupDuelEventListeners();

        console.log(
          `[ElizaDuelBot] ✅ ${name} connected (${modelConfig.displayName}, model: ${modelConfig.model}, id: ${characterId})`,
        );
        this.emit("connected", { name: this.config.name, id: this._id });
        return; // Success — exit retry loop
      } catch (err) {
        lastError = err instanceof Error ? err : new Error(String(err));
        console.error(
          `[ElizaDuelBot] ❌ ${name} init attempt ${attempt + 1} failed: ${lastError.message}`,
        );

        // Stop any partially-initialized runtime (10s timeout to avoid hanging)
        if (this.runtime) {
          try {
            await Promise.race([
              this.runtime.stop(),
              new Promise((r) => setTimeout(r, 10_000)),
            ]);
          } catch {
            /* ignore */
          }
          this.runtime = null;
        }
      }
    }

    // All retries exhausted
    this.state = "disconnected";
    this._connected = false;
    this.metrics.isConnected = false;
    console.error(
      `[ElizaDuelBot] ❌ ${name} failed to connect after ${MAX_INIT_RETRIES + 1} attempts`,
    );
    throw lastError || new Error(`${name} failed to connect`);
  }

  disconnect(): void {
    this.state = "disconnected";
    this._connected = false;
    this.metrics.isConnected = false;

    // Cancel pending setupDuelEventListeners retry
    if (this.setupRetryTimer) {
      clearTimeout(this.setupRetryTimer);
      this.setupRetryTimer = null;
    }
    this.duelListenersRegistered = false;

    if (this.runtime) {
      Promise.race([
        this.runtime.stop(),
        new Promise((r) => setTimeout(r, 10_000)),
      ]).catch((err) => {
        console.warn(
          `[ElizaDuelBot] Error stopping runtime for ${this.config.name}:`,
          errMsg(err),
        );
      });
      this.runtime = null;
    }

    this.emit("disconnected", { name: this.config.name });
  }

  /**
   * Challenge another player to a duel.
   * Uses HyperscapeService.executeDuelChallenge() via the runtime.
   */
  challengePlayer(targetId: string): void {
    if (this.state !== "idle") {
      console.log(
        `[ElizaDuelBot] ${this.config.name} cannot challenge: state=${this.state}`,
      );
      return;
    }

    if (!this.runtime) {
      console.warn(`[ElizaDuelBot] ${this.config.name} has no runtime`);
      return;
    }

    this.state = "challenged";
    console.log(`[ElizaDuelBot] ${this.config.name} challenging ${targetId}`);

    // Access HyperscapeService through runtime
    const service = this.runtime.getService(
      "hyperscapeService",
    ) as HyperscapeServiceHandle | null;
    if (service?.executeDuelChallenge) {
      service
        .executeDuelChallenge({ targetPlayerId: targetId })
        .catch((err: Error) => {
          console.warn(
            `[ElizaDuelBot] ${this.config.name} challenge failed:`,
            err.message,
          );
          this.state = "idle";
        });
    } else {
      console.warn(
        `[ElizaDuelBot] ${this.config.name} - HyperscapeService not available yet`,
      );
      this.state = "idle";
    }
  }

  getPosition(): { x: number; y: number; z: number } | null {
    if (!this.runtime) return null;
    const service = this.runtime.getService(
      "hyperscapeService",
    ) as HyperscapeServiceHandle | null;
    const playerEntity = service?.getPlayerEntity?.();
    if (!playerEntity) return null;
    const pos = playerEntity.position;
    if (!pos) return null;
    if (Array.isArray(pos)) {
      return { x: pos[0], y: pos[1], z: pos[2] };
    }
    return pos;
  }

  private setupDuelEventListeners(): void {
    if (!this.runtime) return;

    // Guard against duplicate listener registration across reconnects
    if (this.duelListenersRegistered) return;

    const service = this.runtime.getService(
      "hyperscapeService",
    ) as HyperscapeServiceHandle | null;
    if (!service) {
      // Service may not be ready yet — retry after a short delay.
      // Track the timer so disconnect() can cancel it.
      if (this.setupRetryTimer) {
        clearTimeout(this.setupRetryTimer);
      }
      this.setupRetryTimer = setTimeout(() => {
        this.setupRetryTimer = null;
        this.setupDuelEventListeners();
      }, 2000);
      return;
    }

    this.duelListenersRegistered = true;

    // Listen for duel state changes via the service's event system
    if (service.startAutonomousBehavior) {
      service.startAutonomousBehavior();
    }
    if (service.onGameEvent) {
      service.onGameEvent(
        "DUEL_FIGHT_START",
        (data: Record<string, unknown>) => {
          if (this.state === "disconnected") return;
          this.state = "in_duel_fighting";
          this.currentDuelId = (data?.duelId as string) || null;
          this.currentOpponentId = (data?.opponentId as string) || null;
          this.metrics.lastDuelAt = Date.now();
          this.emit("duelStarted", {
            botName: this.config.name,
            duelId: this.currentDuelId,
          });
        },
      );

      service.onGameEvent("DUEL_COMPLETED", (data: Record<string, unknown>) => {
        if (this.state === "disconnected") return;
        const won = data?.winnerId === this._id;
        if (won) {
          this.metrics.wins++;
        } else {
          this.metrics.losses++;
        }
        this.metrics.totalDuels++;
        this.state = "idle";

        this.emit("duelEnded", {
          botName: this.config.name,
          duelId: this.currentDuelId,
          won,
          winnerId: (data?.winnerId as string) || "",
          loserId: (data?.loserId as string) || "",
        });

        this.currentDuelId = null;
        this.currentOpponentId = null;
      });
    }
  }
}
