/**
 * AgentBehaviorBridge — Main-thread coordinator for worker-based agent AI.
 *
 * Replaces the old per-agent setInterval approach. Instead of running agent
 * decision logic on the main thread (which blocked the game tick event loop),
 * this bridge:
 *
 * 1. Collects game state snapshots for due agents
 * 2. Sends them to a worker thread for decision-making
 * 3. Receives action commands back and executes them on the main thread
 *
 * The game tick loop is NEVER blocked by agent AI decisions.
 */

import { Worker } from "node:worker_threads";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { EventType } from "@hyperforge/shared";
import { ITEMS } from "@hyperforge/shared";
import type { World } from "@hyperforge/shared";
import {
  ejectAgentFromCombatArena,
  recoverAgentFromDeathLoop,
} from "../agentRecovery.js";
import { errMsg } from "../../shared/errMsg.js";
import type {
  AgentTickInput,
  AgentTickOutput,
  SharedTickData,
  MainToWorkerMessage,
  WorkerToMainMessage,
  WorkerItemData,
} from "../worker/workerTypes.js";
import type {
  AgentInstance,
  EmbeddedBehaviorAction,
} from "./AgentBehaviorTicker.js";
import {
  AgentBehaviorTicker,
  EMBEDDED_BEHAVIOR_TICK_INTERVAL,
  AGENT_STAGGER_OFFSET_MS,
  CRITICAL_HIT_THRESHOLD,
  NEAR_DEATH_THRESHOLD,
  COMBAT_CHAT_COOLDOWN,
} from "./AgentBehaviorTicker.js";
import {
  isLlmBehaviorEnabled,
  pickBehaviorActionWithLlm,
} from "../llmBehaviorDecision.js";
import {
  recordAgentThought,
  findWorldMapMoveTarget,
  syncEmbeddedAgentDashboardForTick,
} from "../dashboardInterop.js";

/** How often the bridge checks which agents are due for a tick (ms) */
const BRIDGE_POLL_INTERVAL_MS = 1000;

/** Max agents to process per poll cycle to avoid blocking the event loop */
const MAX_AGENTS_PER_POLL = 5;

/** Yield to the event loop so the tick setTimeout can fire */
const yieldToEventLoop = (): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, 0));

/**
 * Per-agent scheduling state tracked on the main thread.
 */
interface AgentSchedule {
  nextTickAt: number;
  /** Prevents overlapping ticks for the same agent */
  tickInProgress: boolean;
  /** Timestamp of last arena ejection — cooldown prevents spam */
  lastEjectedAt: number;
}

export class AgentBehaviorBridge {
  private worker: Worker | null = null;
  private workerReady = false;
  private schedules = new Map<string, AgentSchedule>();
  private pollInterval: ReturnType<typeof setInterval> | null = null;
  private agentStartIndex = 0;

  /** Pending tick results callback — resolves when worker responds */
  private pendingResolve: ((results: AgentTickOutput[]) => void) | null = null;

  /** Anchor + resource + station caches (recomputed periodically, not every tick) */
  private spawnAnchorsCache: Array<{
    position: [number, number, number];
    name: string;
  }> = [];
  private worldResourcesCache: Array<{
    position: [number, number, number];
    name: string;
    resourceType: string;
    depleted: boolean;
  }> = [];
  private stationPositionsCache: Array<{
    position: [number, number, number];
    name: string;
    stationType: string;
  }> = [];
  private lastWorldScanTick = -1;
  /** Recompute world scan every N bridge polls (~5s) */
  private static readonly WORLD_SCAN_INTERVAL = 5;
  private worldScanCounter = 0;

  /** Optional reference to the ticker for running main-thread management tasks
   *  (shopping, inventory, equipment, quests, eating) inside the bridge poll. */
  private ticker: AgentBehaviorTicker | null = null;

  constructor(
    private readonly world: World,
    private readonly getAgent: (
      characterId: string,
    ) => AgentInstance | undefined,
    private readonly getAllAgentIds: () => string[],
  ) {}

  /** Attach the ticker so the bridge can run management functions each poll. */
  setTicker(ticker: AgentBehaviorTicker): void {
    this.ticker = ticker;
  }

  // ─── LIFECYCLE ──────────────────────────────────────────────────────────

  /**
   * Start the worker thread and begin polling for due agents.
   */
  async start(): Promise<void> {
    if (this.worker) return;

    // Spawn worker — resolve relative to this file's compiled output location.
    // esbuild bundles to build/ (dev) or dist/ (prod), with the worker as a
    // sibling file (agentBehaviorWorker.js) in the same directory.
    const thisFile = fileURLToPath(import.meta.url);
    const workerPath = path.join(
      path.dirname(thisFile),
      "agentBehaviorWorker.js",
    );
    this.worker = new Worker(workerPath);

    // Handle messages from worker
    this.worker.on("message", (msg: WorkerToMainMessage) => {
      this.handleWorkerMessage(msg);
    });

    this.worker.on("error", (err) => {
      console.error("[AgentBehaviorBridge] Worker error:", err);
      this.restartWorker();
    });

    this.worker.on("exit", (code) => {
      if (code !== 0) {
        console.warn(
          `[AgentBehaviorBridge] Worker exited with code ${code}, restarting`,
        );
        this.worker = null;
        this.workerReady = false;
        this.restartWorker();
      }
    });

    // Send item data to worker
    await this.initializeWorker();

    // Start polling for due agents
    this.pollInterval = setInterval(() => {
      void this.pollAndDispatch();
    }, BRIDGE_POLL_INTERVAL_MS);

    console.log("[AgentBehaviorBridge] Started with worker thread");
  }

  /**
   * Stop the bridge and terminate the worker.
   */
  stop(): void {
    if (this.pollInterval) {
      clearInterval(this.pollInterval);
      this.pollInterval = null;
    }

    if (this.worker) {
      this.sendToWorker({ type: "shutdown" });
      this.worker.terminate();
      this.worker = null;
      this.workerReady = false;
    }

    this.schedules.clear();
    console.log("[AgentBehaviorBridge] Stopped");
  }

  // ─── AGENT SCHEDULING ──────────────────────────────────────────────────

  /**
   * Register an agent for behavior ticks. Stagger offset is applied automatically.
   */
  startAgent(characterId: string): void {
    const staggerDelay = this.agentStartIndex * AGENT_STAGGER_OFFSET_MS;
    this.agentStartIndex++;

    this.schedules.set(characterId, {
      nextTickAt: Date.now() + 3000 + staggerDelay, // Initial delay + stagger
      tickInProgress: false,
      lastEjectedAt: 0,
    });
  }

  /**
   * Unregister an agent from behavior ticks.
   */
  stopAgent(characterId: string): void {
    this.schedules.delete(characterId);

    // Best-effort stop so paused/stopped agents don't keep pathing or attacking.
    const instance = this.getAgent(characterId);
    if (instance) {
      void instance.service.executeStop().catch(() => {});
    }
  }

  // ─── COMBAT DAMAGE HANDLER (main thread) ──────────────────────────────

  /**
   * Handle combat damage events to queue chat reactions.
   * Stays on main thread since it reads World entities directly.
   */
  handleCombatDamageDealt(data: unknown): void {
    const payload = data as {
      attackerId: string;
      targetId: string;
      damage: number;
    };
    const { attackerId, targetId, damage } = payload;
    const now = Date.now();

    // Check if attacker is an agent
    const attackerInstance = this.getAgent(attackerId);
    if (attackerInstance && attackerInstance.state === "running") {
      const targetEntity = this.world.entities.get(targetId);
      const targetData = targetEntity?.data as {
        maxHealth?: number;
        health?: number;
        name?: string;
      };

      if (
        targetData?.maxHealth &&
        damage >= targetData.maxHealth * CRITICAL_HIT_THRESHOLD
      ) {
        if (now - attackerInstance.lastCombatChatAt > COMBAT_CHAT_COOLDOWN) {
          attackerInstance.pendingChatReaction = {
            type: "critical_hit_dealt",
            opponentName: targetData.name || "opponent",
            timestamp: now,
          };
        }
      }

      if (targetData?.health && targetData?.maxHealth) {
        const remainingHealthPercent = targetData.health / targetData.maxHealth;
        if (remainingHealthPercent <= NEAR_DEATH_THRESHOLD && damage > 0) {
          if (now - attackerInstance.lastCombatChatAt > COMBAT_CHAT_COOLDOWN) {
            attackerInstance.pendingChatReaction = {
              type: "victory_imminent",
              opponentName: targetData.name || "opponent",
              timestamp: now,
            };
          }
        }
      }
    }

    // Check if target is an agent
    const targetInstance = this.getAgent(targetId);
    if (targetInstance && targetInstance.state === "running") {
      const attackerEntity = this.world.entities.get(attackerId);
      const attackerData = attackerEntity?.data as { name?: string };
      const opponentName = attackerData?.name || "opponent";

      const targetEntity = this.world.entities.get(targetId);
      const targetData = targetEntity?.data as {
        maxHealth?: number;
        health?: number;
      };

      if (
        targetData?.maxHealth &&
        damage >= targetData.maxHealth * CRITICAL_HIT_THRESHOLD
      ) {
        if (now - targetInstance.lastCombatChatAt > COMBAT_CHAT_COOLDOWN) {
          targetInstance.pendingChatReaction = {
            type: "critical_hit_taken",
            opponentName,
            timestamp: now,
          };
        }
      }

      if (targetData?.health && targetData?.maxHealth) {
        const remainingHealthPercent = targetData.health / targetData.maxHealth;
        if (remainingHealthPercent <= NEAR_DEATH_THRESHOLD) {
          if (now - targetInstance.lastCombatChatAt > COMBAT_CHAT_COOLDOWN) {
            targetInstance.pendingChatReaction = {
              type: "near_death",
              opponentName,
              timestamp: now,
            };
          }
        }
      }
    }
  }

  // ─── PRIVATE: WORKER COMMUNICATION ────────────────────────────────────

  private async initializeWorker(): Promise<void> {
    // Serialize ITEMS map for the worker
    const itemsData: Array<[string, WorkerItemData]> = [];
    for (const [id, item] of ITEMS.entries()) {
      const raw = item as unknown as Record<string, unknown>;
      itemsData.push([
        id,
        {
          id,
          name: (raw.name as string) || id,
          type: (raw.type as string) || "misc",
          equipSlot: raw.equipSlot as string | undefined,
          bonuses: raw.bonuses as Record<string, number> | undefined,
          healAmount: raw.healAmount as number | undefined,
          requirements: raw.requirements as Record<string, unknown> | undefined,
        },
      ]);
    }

    // Send init and wait for ready
    return new Promise<void>((resolve) => {
      const onReady = (msg: WorkerToMainMessage) => {
        if (msg.type === "ready") {
          this.worker?.off("message", onReady);
          this.workerReady = true;
          resolve();
        }
      };
      // Temporarily listen for ready
      this.worker!.on("message", onReady);
      this.sendToWorker({ type: "init", itemsData });

      // Timeout after 5s
      setTimeout(() => {
        if (!this.workerReady) {
          this.worker?.off("message", onReady);
          console.error(
            "[AgentBehaviorBridge] Worker did not send ready in 5s",
          );
          resolve(); // Don't block forever
        }
      }, 5000);
    });
  }

  private sendToWorker(msg: MainToWorkerMessage): void {
    if (this.worker) {
      this.worker.postMessage(msg);
    }
  }

  private handleWorkerMessage(msg: WorkerToMainMessage): void {
    switch (msg.type) {
      case "ready":
        this.workerReady = true;
        break;

      case "tickResults":
        if (this.pendingResolve) {
          this.pendingResolve(msg.results);
          this.pendingResolve = null;
        }
        break;

      case "error":
        console.error(
          `[AgentBehaviorBridge] Worker error${msg.characterId ? ` (agent ${msg.characterId})` : ""}: ${msg.error}`,
        );
        // Release pending resolve on error
        if (this.pendingResolve) {
          this.pendingResolve([]);
          this.pendingResolve = null;
        }
        break;
    }
  }

  private async restartWorker(): Promise<void> {
    // Terminate existing worker if still alive
    if (this.worker) {
      try {
        await this.worker.terminate();
      } catch {
        // Already dead
      }
      this.worker = null;
    }
    this.workerReady = false;

    // Clear tickInProgress for all agents so they aren't permanently stuck
    // after the worker crash (same fix as timeout path).
    for (const schedule of this.schedules.values()) {
      schedule.tickInProgress = false;
    }

    // Reject any pending tick promise so sendTickAndWait doesn't hang
    if (this.pendingResolve) {
      this.pendingResolve([]);
      this.pendingResolve = null;
    }

    // Re-spawn after short delay
    setTimeout(() => {
      void this.start().catch((err) => {
        console.error(
          "[AgentBehaviorBridge] Failed to restart worker:",
          errMsg(err),
        );
      });
    }, 100);
  }

  // ─── PRIVATE: POLL AND DISPATCH ───────────────────────────────────────

  /**
   * Called every BRIDGE_POLL_INTERVAL_MS. Finds agents that are due for a
   * behavior tick, collects their snapshots, sends to worker, and applies results.
   */
  private async pollAndDispatch(): Promise<void> {
    if (!this.workerReady || !this.worker) return;
    if (this.pendingResolve) return; // Previous batch still in-flight

    const pollStart = Date.now();
    const now = pollStart;
    const dueAgents: AgentTickInput[] = [];

    // Update world scan caches periodically
    this.worldScanCounter++;
    if (this.worldScanCounter >= AgentBehaviorBridge.WORLD_SCAN_INTERVAL) {
      this.worldScanCounter = 0;
      const t0 = Date.now();
      this.updateWorldScanCaches();
      const scanMs = Date.now() - t0;
      if (scanMs > 50) {
        console.warn(`[AgentBridge] updateWorldScanCaches took ${scanMs}ms`);
      }
    }

    // Collect other agent targets for mob spreading (cheap — just reads instance fields)
    const allAgentIds = this.getAllAgentIds();
    const otherAgentTargets: Array<{
      agentId: string;
      targetId: string | null;
    }> = [];
    for (const id of allAgentIds) {
      const inst = this.getAgent(id);
      if (inst) {
        otherAgentTargets.push({
          agentId: id,
          targetId: inst.currentTargetId,
        });
      }
    }

    const resourceSystemAvailable = !!this.world.getSystem("resource");

    // Compute NPC positions once per poll, shared across all agents in this batch
    let sharedNpcPositions: ReturnType<
      AgentInstance["service"]["getAllNPCPositions"]
    > | null = null;

    let agentsProcessed = 0;

    for (const [characterId, schedule] of this.schedules) {
      if (schedule.tickInProgress) continue;
      if (now < schedule.nextTickAt) continue;

      // Cap agents per poll cycle to avoid blocking the event loop
      if (agentsProcessed >= MAX_AGENTS_PER_POLL) break;

      const instance = this.getAgent(characterId);
      if (!instance || instance.state !== "running") continue;

      // Main-thread-only checks (need direct World access)
      if (
        recoverAgentFromDeathLoop(
          this.world,
          characterId,
          "AgentBehaviorBridge",
        )
      ) {
        instance.lastActivity = Date.now();
        schedule.nextTickAt = now + EMBEDDED_BEHAVIOR_TICK_INTERVAL;
        continue;
      }

      // Arena ejection is handled by the DuelSystem per game-tick.
      // Doing it here caused teleport spam — the agent would get ejected to
      // the nearby lobby, then the behavior engine would send it right back
      // into the arena on the next tick.

      const entity = this.world.entities.get(characterId);
      const inStreamingDuel =
        (entity?.data as { inStreamingDuel?: boolean } | undefined)
          ?.inStreamingDuel === true;
      if (inStreamingDuel) {
        schedule.nextTickAt = now + EMBEDDED_BEHAVIOR_TICK_INTERVAL;
        continue;
      }

      // Operator command grace — when the dashboard user just sent a command,
      // the worker should still run survival tasks (eating, equipment) but
      // skip autonomous action picking so it doesn't override the command.
      const inOperatorGrace =
        instance.operatorCommandAt > 0 &&
        now - instance.operatorCommandAt < 30_000;

      // Autonomy toggle — used by arena mode to suspend the behavior loop
      if (!instance.service.isAutonomousEnabled()) {
        schedule.nextTickAt = now + EMBEDDED_BEHAVIOR_TICK_INTERVAL;
        continue;
      }

      // Collect game state snapshot
      const gameState = instance.service.getGameState();
      if (!gameState || !gameState.position) {
        schedule.nextTickAt = now + EMBEDDED_BEHAVIOR_TICK_INTERVAL;
        continue;
      }

      // Run main-thread management tasks from the ticker (shopping, inventory,
      // equipment, quests, eating). These MUST run on the main thread because
      // they call service methods that emit world events.
      if (this.ticker) {
        await this.ticker.manageQuests(instance);
        this.ticker.manageInventory(instance);
        this.ticker.manageShopping(instance);
        this.ticker.manageEquipment(instance, gameState);
        if (this.ticker.assessAndEat(instance, gameState)) {
          // Ate food — skip this tick to let health update
          syncEmbeddedAgentDashboardForTick(
            characterId,
            instance.goal,
            instance.service.getQuestState(),
            instance.service.getAvailableQuests(),
            instance.startedAt,
            "idle",
            "Ate food to recover health.",
          );
          schedule.nextTickAt = now + EMBEDDED_BEHAVIOR_TICK_INTERVAL;
          continue;
        }
      }

      // Compute NPC positions once per poll batch (not per agent)
      if (!sharedNpcPositions) {
        sharedNpcPositions = instance.service.getAllNPCPositions();
      }

      // Per-agent data only — shared data is sent separately to avoid
      // structured clone duplicating large arrays N times
      const tickInput: AgentTickInput = {
        characterId,
        playerId: instance.service.getPlayerId(),
        name: instance.config.name,
        gameState,
        inventoryItems: instance.service.getInventoryItems(),
        equippedItems: instance.service.getEquippedItems(),
        questState: instance.service.getQuestState(),
        availableQuests: instance.service.getAvailableQuests(),
        operatorGrace: inOperatorGrace,
        // Placeholder empty arrays — worker fills from SharedTickData
        npcPositions: [],
        otherAgentTargets: [],
        resourceSystemAvailable,
        spawnAnchors: [],
        worldResources: [],
        agentState: {
          goal: instance.goal,
          questsAccepted: Array.from(instance.questsAccepted),
          currentTargetId: instance.currentTargetId,
          lastAteAt: instance.lastAteAt,
          dropCooldownUntil: instance.dropCooldownUntil,
          lastGatherTargetId: instance.lastGatherTargetId,
          lastGatherQueuedAt: instance.lastGatherQueuedAt,
          pendingChatReaction: instance.pendingChatReaction,
          lastCombatChatAt: instance.lastCombatChatAt,
        },
      };

      dueAgents.push(tickInput);
      schedule.tickInProgress = true;
      schedule.nextTickAt = now + EMBEDDED_BEHAVIOR_TICK_INTERVAL;
      agentsProcessed++;

      // Yield to event loop between agents so tick timer can fire
      if (agentsProcessed < MAX_AGENTS_PER_POLL) {
        await yieldToEventLoop();
      }
    }

    const snapshotMs = Date.now() - pollStart;
    if (dueAgents.length === 0) {
      if (snapshotMs > 50) {
        console.warn(`[AgentBridge] Poll (0 agents) took ${snapshotMs}ms`);
      }
      return;
    }

    if (snapshotMs > 50) {
      console.warn(
        `[AgentBridge] Snapshot collection for ${dueAgents.length} agents took ${snapshotMs}ms`,
      );
    }

    // Build shared data sent ONCE (not duplicated per agent in structured clone)
    const shared: SharedTickData = {
      npcPositions: sharedNpcPositions ?? [],
      spawnAnchors: this.spawnAnchorsCache,
      worldResources: this.worldResourcesCache,
      stationPositions: this.stationPositionsCache,
      otherAgentTargets,
      resourceSystemAvailable,
    };

    // Send to worker and wait for results
    const t0 = Date.now();
    const results = await this.sendTickAndWait(dueAgents, shared);
    const workerMs = Date.now() - t0;
    if (workerMs > 100) {
      console.warn(
        `[AgentBridge] Worker round-trip took ${workerMs}ms for ${dueAgents.length} agents`,
      );
    }

    // If worker timed out (empty results), clear tickInProgress for all
    // agents that were in this batch so they aren't permanently stuck.
    if (results.length === 0 && dueAgents.length > 0) {
      for (const agent of dueAgents) {
        const schedule = this.schedules.get(agent.characterId);
        if (schedule) schedule.tickInProgress = false;
      }
    }

    // Apply results on main thread — yield between each to avoid blocking
    const applyStart = Date.now();
    for (const result of results) {
      await this.applyTickResult(result);
      await yieldToEventLoop();
    }
    const applyMs = Date.now() - applyStart;

    const totalMs = Date.now() - pollStart;
    if (totalMs > 100) {
      console.warn(
        `[AgentBridge] Total poll: ${totalMs}ms (snapshot=${snapshotMs}ms, worker=${workerMs}ms, apply=${applyMs}ms, agents=${dueAgents.length})`,
      );
    }
  }

  private sendTickAndWait(
    agents: AgentTickInput[],
    shared: SharedTickData,
  ): Promise<AgentTickOutput[]> {
    return new Promise((resolve) => {
      this.pendingResolve = resolve;
      this.sendToWorker({ type: "tick", agents, shared });

      // Timeout after 5s — don't block agent scheduling forever
      setTimeout(() => {
        if (this.pendingResolve === resolve) {
          console.warn("[AgentBehaviorBridge] Worker tick timed out after 5s");
          this.pendingResolve = null;
          resolve([]);
        }
      }, 5000);
    });
  }

  /**
   * Apply a single agent's tick result: execute side effects, then the main action.
   */
  private async applyTickResult(result: AgentTickOutput): Promise<void> {
    const instance = this.getAgent(result.characterId);
    if (!instance || instance.state !== "running") {
      const schedule = this.schedules.get(result.characterId);
      if (schedule) schedule.tickInProgress = false;
      return;
    }

    try {
      // Update agent state from worker decisions
      const s = result.updatedState;
      instance.goal = s.goal;
      instance.questsAccepted = new Set(s.questsAccepted);
      instance.currentTargetId = s.currentTargetId;
      instance.lastAteAt = s.lastAteAt;
      instance.dropCooldownUntil = s.dropCooldownUntil;
      instance.lastGatherTargetId = s.lastGatherTargetId;
      instance.lastGatherQueuedAt = s.lastGatherQueuedAt;
      instance.lastCombatChatAt = s.lastCombatChatAt;
      instance.pendingChatReaction = null; // Worker consumed it

      // Send combat chat if decided
      if (result.chatMessage) {
        try {
          await instance.service.sendChatMessage(result.chatMessage);
        } catch (err) {
          // Non-critical, don't fail the tick
        }
      }

      // Execute side effects (equip, drop, buy, eat)
      for (const effect of result.sideEffects) {
        try {
          switch (effect.type) {
            case "storeBuy":
              await instance.service.executeStoreBuy(
                effect.storeId,
                effect.itemId,
                effect.quantity,
              );
              break;
            case "drop":
              await instance.service.executeDrop(
                effect.itemId,
                effect.quantity,
              );
              break;
            case "use":
              await instance.service.executeUse(effect.itemId);
              break;
            case "equip":
              await instance.service.executeEquip(effect.itemId);
              break;
          }
        } catch (err) {
          // Individual side effect failure shouldn't stop the main action
        }
      }

      // ── Persistent navigation: if the agent has an active navigationTarget,
      // check if arrived, stuck, or timed out.
      const ARRIVAL_DIST_SQ = 64; // 8 tiles — close enough for long-distance nav
      const NAV_TIMEOUT_MS = 90_000; // 90s — enough for long walks, short enough to not loop forever
      const NAV_STUCK_THRESHOLD_SQ = 4; // 2 tiles — less than this movement = stuck
      const NAV_NOT_CLOSER_THRESHOLD = 3; // tiles — if not getting 3+ tiles closer per tick, count as no-progress
      const NAV_STUCK_TICKS_TO_CLEAR = 4; // clear after 4 ticks of no progress
      const now = Date.now();
      const nav = instance.navigationTarget;
      if (nav) {
        const gameState = instance.service.getGameState();
        const pos = gameState?.position;
        if (pos) {
          const dx = pos[0] - nav.position[0];
          const dz = pos[2] - nav.position[2];
          const distSq = dx * dx + dz * dz;
          const timedOut = now - nav.setAt > NAV_TIMEOUT_MS;

          // Stuck detection: track if agent is making progress toward target
          let navStuckCount = instance.navStuckCount || 0;
          const currentDist = Math.sqrt(distSq);
          if (instance.navStuckLastPos) {
            const movedDx = pos[0] - instance.navStuckLastPos[0];
            const movedDz = pos[2] - instance.navStuckLastPos[2];
            const movedDistSq = movedDx * movedDx + movedDz * movedDz;
            // Check both: agent not moving at all, OR agent moving but not getting closer
            const notMoving = movedDistSq < NAV_STUCK_THRESHOLD_SQ;
            const notCloser =
              instance.navStuckLastDist !== undefined &&
              instance.navStuckLastDist - currentDist <
                NAV_NOT_CLOSER_THRESHOLD;
            if (notMoving || notCloser) {
              navStuckCount++;
            } else {
              navStuckCount = 0;
            }
          }
          instance.navStuckLastPos = [pos[0], pos[1], pos[2]];
          instance.navStuckLastDist = currentDist;
          instance.navStuckCount = navStuckCount;

          const isStuck = navStuckCount >= NAV_STUCK_TICKS_TO_CLEAR;
          if (distSq < ARRIVAL_DIST_SQ || timedOut || isStuck) {
            instance.navigationTarget = null;
            instance.navStuckCount = 0;
          }
        }
      }

      // During operator grace period, skip LLM override.
      const inOperatorGrace =
        instance.operatorCommandAt > 0 &&
        now - instance.operatorCommandAt < 30_000;

      let action = result.action;

      // If navigating, check if there are nearby mobs to fight first.
      // Also respect the worker's scripted action if it chose to attack something.
      if (instance.navigationTarget) {
        const gs = instance.service.getGameState();
        const nearby = instance.service.getNearbyEntities?.() ?? [];
        const goal = instance.goal;
        let combatInterrupt = false;

        // If the worker's scripted action is already an attack, prefer that
        // over continuing navigation — the worker sees nearby mobs too.
        if (
          result.action.type === "attack" &&
          (result.action as { targetId: string }).targetId
        ) {
          const attackAction = result.action as {
            type: "attack";
            targetId: string;
          };
          action = attackAction;
          instance.currentTargetId = attackAction.targetId;
          combatInterrupt = true;
          recordAgentThought(result.characterId, {
            type: "thinking",
            content: `Worker chose to attack ${attackAction.targetId} — pausing navigation to ${instance.navigationTarget.description}`,
            decisionPath: "scripted",
          });
        }

        // Quest-mob combat interrupt
        if (
          !combatInterrupt &&
          goal?.type === "questing" &&
          goal.questStageType === "kill" &&
          goal.questStageTarget &&
          gs &&
          !gs.inCombat &&
          gs.maxHealth > 0 &&
          gs.health / gs.maxHealth > 0.4
        ) {
          const target = goal.questStageTarget.toLowerCase();
          const questMob = nearby.find(
            (e: {
              type: string;
              name?: string;
              mobType?: string;
              health?: number;
              distance: number;
            }) => {
              if (e.type !== "mob" || e.distance > 40) return false;
              if (e.health !== undefined && e.health <= 0) return false;
              const name = (e.name || "").toLowerCase();
              const mType = (e.mobType || "").toLowerCase();
              return (
                name.includes(target) ||
                mType.includes(target) ||
                target.includes(name) ||
                target.includes(mType)
              );
            },
          );
          if (questMob) {
            action = { type: "attack", targetId: questMob.id };
            instance.currentTargetId = questMob.id;
            combatInterrupt = true;
            recordAgentThought(result.characterId, {
              type: "thinking",
              content: `Spotted ${questMob.name} — attacking for quest instead of continuing to ${instance.navigationTarget.description}`,
              decisionPath: "scripted",
            });
          }
        }

        // Generic combat interrupt: if any mob is very close and agent is healthy enough, fight it
        if (
          !combatInterrupt &&
          gs &&
          !gs.inCombat &&
          gs.maxHealth > 0 &&
          gs.health / gs.maxHealth > 0.3
        ) {
          const closeMob = nearby.find(
            (e: { type: string; health?: number; distance: number }) => {
              if (e.type !== "mob" || e.distance > 20) return false;
              if (e.health !== undefined && e.health <= 0) return false;
              return true;
            },
          );
          if (closeMob) {
            action = { type: "attack", targetId: closeMob.id };
            instance.currentTargetId = closeMob.id;
            combatInterrupt = true;
            recordAgentThought(result.characterId, {
              type: "thinking",
              content: `Engaging nearby ${(closeMob as { name?: string }).name || "mob"} while en route to ${instance.navigationTarget.description}`,
              decisionPath: "scripted",
            });
          }
        }

        if (!combatInterrupt) {
          // Still navigating — re-issue move toward the target
          action = {
            type: "move",
            target: instance.navigationTarget.position,
            runMode: true,
          };
          recordAgentThought(result.characterId, {
            type: "thinking",
            content: `Navigating to ${instance.navigationTarget.description}`,
            decisionPath: "scripted",
          });
        }
      } else if (!inOperatorGrace && isLlmBehaviorEnabled(instance)) {
        // LLM-driven action selection — consume pre-fetched result from
        // the previous tick so we never block the game loop waiting on an
        // API call. The LLM call for the *next* tick is fired non-blocking
        // after apply completes (see below).
        const llmResult = instance.pendingLlmResult ?? null;
        instance.pendingLlmResult = undefined; // consumed
        if (llmResult) {
          action = llmResult.action;
          if (llmResult.goal) {
            instance.goal = llmResult.goal;
          }
          // Record chain-of-thought + action reasoning for dashboard
          const thoughtContent = llmResult.thinking
            ? `💭 ${llmResult.thinking}\n→ ${llmResult.reasoning}`
            : llmResult.reasoning;
          recordAgentThought(result.characterId, {
            type: "thinking",
            content: thoughtContent,
            decisionPath: "llm",
          });
        }
      }

      // Record a thought for all non-idle actions from any decision path.
      // Navigation and LLM paths record thoughts above; this handles the scripted
      // worker fallback path so the visualizer always shows what agents are doing.
      if (action.type !== "idle") {
        const actionSummary =
          action.type === "navigateTo"
            ? `Navigate to ${(action as { destination: string }).destination}`
            : action.type === "attack"
              ? `Attacking ${(action as { targetId: string }).targetId}`
              : action.type === "gather"
                ? `Gathering ${(action as { targetId: string }).targetId}`
                : action.type === "move"
                  ? `Moving to [${(action as { target: [number, number, number] }).target?.[0]?.toFixed(0)},${(action as { target: [number, number, number] }).target?.[2]?.toFixed(0)}]`
                  : action.type === "pickup"
                    ? `Picking up ${(action as { targetId: string }).targetId}`
                    : action.type === "questAccept"
                      ? `Accepting quest ${(action as { questId: string }).questId}`
                      : action.type === "questComplete"
                        ? `Completing quest ${(action as { questId: string }).questId}`
                        : action.type === "cook"
                          ? `Cooking ${(action as { itemId: string }).itemId}`
                          : action.type === "smelt"
                            ? `Smelting ${(action as { recipe: string }).recipe}`
                            : action.type === "smith"
                              ? `Smithing ${(action as { recipe: string }).recipe}`
                              : action.type === "bankDepositAll"
                                ? "Depositing all items at bank"
                                : action.type === "homeTeleport"
                                  ? "Teleporting home"
                                  : action.type;
        // Only record if no thought was already recorded by nav/LLM paths above
        if (!instance.navigationTarget) {
          recordAgentThought(result.characterId, {
            type: "thinking",
            content: actionSummary,
            decisionPath: "scripted",
          });
        }
      }

      // Reset questCompleteFailures when agent is doing non-complete quest work.
      // This prevents stale failure counts from blocking future completion attempts
      // after the underlying issue (e.g. missing materials) has been resolved.
      if (
        action.type !== "questComplete" &&
        action.type !== "idle" &&
        instance.questCompleteFailures?.size
      ) {
        instance.questCompleteFailures.clear();
      }

      switch (action.type) {
        case "attack":
          await instance.service.executeAttack(action.targetId);
          instance.lastActivity = Date.now();
          break;

        case "gather":
          await instance.service.executeGather(action.targetId);
          instance.lastActivity = Date.now();
          break;

        case "pickup":
          await instance.service.executePickup(action.targetId);
          instance.lastActivity = Date.now();
          break;

        case "lootGravestone":
          this.world.emit(EventType.CORPSE_LOOT_ALL_REQUEST, {
            corpseId: action.gravestoneId,
            playerId: instance.service.getPlayerId(),
          });
          instance.lastActivity = Date.now();
          break;

        case "move":
          await instance.service.executeMove(action.target, action.runMode);
          instance.lastActivity = Date.now();
          break;

        case "firemake":
          await instance.service.executeFiremake(action.logsItemId);
          instance.lastActivity = Date.now();
          break;

        case "questAccept": {
          const accepted = await instance.service.executeQuestAccept(
            action.questId,
          );
          if (accepted) {
            const postAcceptState = instance.service.getQuestState();
            const questStarted = postAcceptState.some(
              (q) => q.questId === action.questId,
            );
            if (questStarted) {
              instance.questsAccepted.add(action.questId);
            }
          }
          instance.lastActivity = Date.now();
          break;
        }

        case "questComplete": {
          // Track quest completion failures to avoid infinite loops.
          // After 3 failed attempts, mark quest as stuck so the LLM picks a
          // different action instead of retrying forever.
          if (!instance.questCompleteFailures) {
            instance.questCompleteFailures = new Map();
          }
          const failCount =
            instance.questCompleteFailures.get(action.questId) || 0;
          if (failCount >= 3) {
            // Too many failures — mark quest stuck so LLM knows to move on
            // Too many failures — skip and let agent try something else
            // Clear goal to let LLM pick something else
            instance.goal = null;
            instance.lastActivity = Date.now();
            break;
          }

          const completed = await instance.service.executeQuestComplete(
            action.questId,
          );
          if (completed) {
            instance.goal = null;
            instance.questCompleteFailures.delete(action.questId);
          } else {
            instance.questCompleteFailures.set(action.questId, failCount + 1);
            // Quest didn't complete — try to navigate to the turn-in NPC.
            const questState = instance.service.getQuestState();
            const quest = questState.find((q) => q.questId === action.questId);
            const npcName = quest?.startNpc;
            if (npcName && !instance.navigationTarget) {
              const gameState = instance.service.getGameState();
              const playerPos = gameState?.position ?? null;
              const coords = findWorldMapMoveTarget(
                npcName,
                instance.service,
                playerPos,
              );
              if (coords) {
                instance.navigationTarget = {
                  position: coords,
                  description: `${npcName} (turn in ${quest?.name || action.questId})`,
                  setAt: Date.now(),
                };
                await instance.service.executeMove(coords, true);
              }
            }
          }
          instance.lastActivity = Date.now();
          break;
        }

        case "navigateTo": {
          const gameState = instance.service.getGameState();
          const playerPos = gameState?.position ?? null;
          const coords = findWorldMapMoveTarget(
            action.destination,
            instance.service,
            playerPos,
          );
          if (coords) {
            // Do NOT set persistent navigationTarget for LLM-produced destinations.
            // The LLM may hallucinate location names or pick suboptimal destinations.
            // Each tick will re-evaluate and can choose to continue moving or do something else.
            await instance.service.executeMove(coords, true);
            instance.lastActivity = Date.now();
          } else {
            // LLM produced an unresolvable destination (often a display name
            // like "Maple Tree" instead of a map location). Fall back to the
            // scripted worker action so the agent doesn't freeze.
            const fallback = result.action;
            if (fallback.type !== "idle" && fallback.type !== "navigateTo") {
              await this.executeAction(instance, fallback);
              instance.lastActivity = Date.now();
            }
          }
          break;
        }

        case "use":
          await instance.service.executeUse(action.itemId);
          instance.lastActivity = Date.now();
          break;

        case "equip":
          await instance.service.executeEquip(action.itemId);
          instance.lastActivity = Date.now();
          break;

        case "cook": {
          const cooked = await instance.service.executeCook(action.itemId);
          if (!cooked) {
            // No fire/range nearby — light one if possible
            const fireLit = await instance.service.executeFiremake();
            if (!fireLit) {
              // No logs either — chop a nearby tree to get some
              const nearby = instance.service.getNearbyEntities();
              const tree = nearby.find(
                (e) =>
                  e.type === "resource" &&
                  (e.name || "").toLowerCase().includes("tree"),
              );
              if (tree) {
                await instance.service.executeGather(tree.id);
              }
            }
          }
          instance.lastActivity = Date.now();
          break;
        }

        case "smelt":
          await instance.service.executeSmelt(action.recipe);
          instance.lastActivity = Date.now();
          break;

        case "smith":
          await instance.service.executeSmith(action.recipe);
          instance.lastActivity = Date.now();
          break;

        case "runecraft":
          await instance.service.executeRunecraft(action.runeType);
          instance.lastActivity = Date.now();
          break;

        case "craft":
          await instance.service.executeCraft(
            action.recipeId,
            action.quantity ?? 1,
          );
          instance.lastActivity = Date.now();
          break;

        case "fletch":
          await instance.service.executeFletch(
            action.recipeId,
            action.quantity ?? 1,
          );
          instance.lastActivity = Date.now();
          break;

        case "tan":
          await instance.service.executeTan(
            action.inputItemId,
            action.quantity ?? 1,
          );
          instance.lastActivity = Date.now();
          break;

        case "bankDepositAll":
          await instance.service.executeBankDepositAll();
          instance.lastActivity = Date.now();
          break;

        case "homeTeleport":
          await instance.service.executeHomeTeleport();
          instance.lastActivity = Date.now();
          break;

        case "stop":
          instance.navigationTarget = null;
          await instance.service.executeStop();
          instance.lastActivity = Date.now();
          break;

        case "idle":
        default:
          break;
      }

      // Sync goal to ServerNetwork so the dashboard can display it
      syncEmbeddedAgentDashboardForTick(
        result.characterId,
        instance.goal,
        instance.service.getQuestState(),
        instance.service.getAvailableQuests(),
        instance.startedAt,
        action.type,
        null,
      );

      // ── NON-BLOCKING LLM PRE-FETCH ──────────────────────────────────
      // Fire the LLM call for the NEXT tick now. The result will be
      // consumed by applyTickResult on the next cycle (~8s from now).
      // This moves the 1-2s LLM latency completely off the critical path.
      if (
        !instance.llmCallInFlight &&
        !inOperatorGrace &&
        isLlmBehaviorEnabled(instance)
      ) {
        const freshState = instance.service.getGameState();
        if (freshState?.position) {
          instance.llmCallInFlight = true;
          pickBehaviorActionWithLlm(instance, freshState)
            .then((llmResult) => {
              instance.pendingLlmResult = llmResult;
            })
            .catch(() => {
              instance.pendingLlmResult = null;
            })
            .finally(() => {
              instance.llmCallInFlight = false;
            });
        }
      }
    } catch (err) {
      console.warn(
        `[AgentBehaviorBridge] Failed to apply tick result for ${result.characterId}: ${errMsg(err)}`,
      );
    } finally {
      const schedule = this.schedules.get(result.characterId);
      if (schedule) schedule.tickInProgress = false;
    }
  }

  /**
   * Execute a single behavior action on behalf of an agent. Used by the main
   * switch and by the navigateTo fallback path so all action types are handled.
   */
  private async executeAction(
    instance: AgentInstance,
    action: EmbeddedBehaviorAction,
  ): Promise<void> {
    switch (action.type) {
      case "attack":
        await instance.service.executeAttack(action.targetId);
        break;
      case "gather":
        await instance.service.executeGather(action.targetId);
        break;
      case "pickup":
        await instance.service.executePickup(action.targetId);
        break;
      case "lootGravestone":
        this.world.emit(EventType.CORPSE_LOOT_ALL_REQUEST, {
          corpseId: action.gravestoneId,
          playerId: instance.service.getPlayerId(),
        });
        break;
      case "move":
        await instance.service.executeMove(action.target, action.runMode);
        break;
      case "firemake":
        await instance.service.executeFiremake(action.logsItemId);
        break;
      case "questAccept":
        await instance.service.executeQuestAccept(action.questId);
        break;
      case "questComplete":
        await instance.service.executeQuestComplete(action.questId);
        break;
      case "use":
        await instance.service.executeUse(action.itemId);
        break;
      case "equip":
        await instance.service.executeEquip(action.itemId);
        break;
      case "cook":
        await instance.service.executeCook(action.itemId);
        break;
      case "smelt":
        await instance.service.executeSmelt(action.recipe);
        break;
      case "smith":
        await instance.service.executeSmith(action.recipe);
        break;
      case "runecraft":
        await instance.service.executeRunecraft(action.runeType);
        break;
      case "craft":
        await instance.service.executeCraft(
          action.recipeId,
          action.quantity ?? 1,
        );
        break;
      case "fletch":
        await instance.service.executeFletch(
          action.recipeId,
          action.quantity ?? 1,
        );
        break;
      case "tan":
        await instance.service.executeTan(
          action.inputItemId,
          action.quantity ?? 1,
        );
        break;
      case "bankDepositAll":
        await instance.service.executeBankDepositAll();
        break;
      case "homeTeleport":
        await instance.service.executeHomeTeleport();
        break;
      case "stop":
        await instance.service.executeStop();
        break;
      default:
        break;
    }
  }

  // ─── PRIVATE: WORLD SCAN CACHES ───────────────────────────────────────

  /**
   * Pre-compute spawn anchors and world resources so the worker doesn't
   * need to iterate all world entities.
   */
  private updateWorldScanCaches(): void {
    const anchors: typeof this.spawnAnchorsCache = [];
    const resources: typeof this.worldResourcesCache = [];
    const stations: typeof this.stationPositionsCache = [];

    const STATION_KEYWORDS = [
      "bank",
      "furnace",
      "anvil",
      "range",
      "runecrafting",
      "altar",
      "cooking",
      "tanner",
    ];

    for (const [, entity] of this.world.entities.items.entries()) {
      const data = (entity as { data?: Record<string, unknown> }).data;
      if (!data) continue;

      const name = String(data.name || "").toLowerCase();
      const entityType = String(data.type || "").toLowerCase();
      const resourceType = String(data.resourceType || "").toLowerCase();

      // Collect spawn anchors
      const isAnchor =
        name.includes("starter chest") ||
        name.includes("goblin") ||
        name.includes("bank") ||
        name.includes("spawn") ||
        name.includes("start");

      if (isAnchor) {
        const pos = this.getEntityPosition(entity);
        if (pos) {
          anchors.push({ position: pos, name });
        }
      }

      // Collect resources
      if (entityType === "resource" || resourceType) {
        const pos = this.getEntityPosition(entity);
        if (pos) {
          resources.push({
            position: pos,
            name,
            resourceType,
            depleted: data.depleted === true,
          });
        }
      }

      // Collect stations (bank, furnace, anvil, cooking range, altar)
      const stationMatch = STATION_KEYWORDS.find(
        (kw) => name.includes(kw) || entityType.includes(kw),
      );
      if (stationMatch && entityType !== "resource") {
        const pos = this.getEntityPosition(entity);
        if (pos) {
          // Include entity ID in name for specific station matching (e.g. "air_altar_spawn")
          const entityId = String(data.id || "").toLowerCase();
          const stationName = name ? `${name} ${entityId}` : entityId;
          stations.push({
            position: pos,
            name: stationName,
            stationType: stationMatch,
          });
        }
      }
    }

    this.spawnAnchorsCache = anchors;
    this.worldResourcesCache = resources;
    this.stationPositionsCache = stations;
  }

  private getEntityPosition(entity: unknown): [number, number, number] | null {
    const e = entity as {
      position?: unknown;
      data?: Record<string, unknown>;
    };

    const directPos = e.position;
    if (Array.isArray(directPos) && directPos.length >= 3) {
      return [directPos[0], directPos[1], directPos[2]];
    }
    if (
      directPos &&
      typeof directPos === "object" &&
      "x" in directPos &&
      "z" in directPos
    ) {
      const p = directPos as { x: number; y?: number; z: number };
      return [p.x, p.y ?? 0, p.z];
    }

    const dataPos = e.data?.position;
    if (Array.isArray(dataPos) && dataPos.length >= 3) {
      return [dataPos[0] as number, dataPos[1] as number, dataPos[2] as number];
    }
    if (
      dataPos &&
      typeof dataPos === "object" &&
      "x" in dataPos &&
      "z" in dataPos
    ) {
      const p = dataPos as { x: number; y?: number; z: number };
      return [p.x, p.y ?? 0, p.z];
    }
    return null;
  }
}
