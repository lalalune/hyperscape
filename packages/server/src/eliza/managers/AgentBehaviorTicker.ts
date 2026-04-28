/**
 * AgentBehaviorTicker - Extracted behavior loop and action selection from AgentManager
 *
 * Handles:
 * - Autonomous behavior tick loop (8s interval)
 * - Quest management (auto-accept, track progress, complete)
 * - Shopping (buy tools/weapons)
 * - Inventory management (drop junk, bury bones)
 * - Equipment management (equip best gear)
 * - Eating (health recovery)
 * - Action selection (quest-driven or default combat/explore)
 * - Combat chat reactions
 */

import { getItem, EventType } from "@hyperscape/shared";
import type { AgentRuntime } from "@elizaos/core";
import type { World } from "@hyperscape/shared";
import {
  ejectAgentFromCombatArena,
  recoverAgentFromDeathLoop,
} from "../agentRecovery.js";
import { relocateStreamingAgentOutOfDuelHubIfOptedOut } from "../../streaming/streamingDuelEligibilityDb.js";
import {
  recordAgentThought,
  syncEmbeddedAgentDashboardForTick,
  ensureEmbeddedAgentCharacterVision,
  findWorldMapMoveTarget,
} from "../dashboardInterop.js";
import { errMsg } from "../../shared/errMsg.js";
import {
  isLlmBehaviorEnabled,
  pickBehaviorActionWithLlm,
} from "../llmBehaviorDecision.js";
import type {
  EmbeddedAgentConfig,
  AgentState,
  EmbeddedGameState,
  NearbyEntityData,
  AgentQuestProgress,
} from "../types.js";
import type { EmbeddedHyperscapeService } from "../EmbeddedHyperscapeService.js";

/**
 * Yield to the event loop so game ticks and I/O can process.
 * Used between heavy synchronous sub-tasks in agent behavior ticks.
 */
const yieldToEventLoop = (): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, 0));

/**
 * Active goal for an embedded agent (visible on dashboard)
 */
export interface AgentGoal {
  type:
    | "questing"
    | "combat"
    | "gathering"
    | "banking"
    | "cooking"
    | "smelting"
    | "smithing"
    | "exploring"
    | "idle";
  description: string;
  questId?: string;
  questName?: string;
  questStageType?: string;
  questStageTarget?: string;
  questStageCount?: number;
  questStartNpc?: string;
}

/**
 * Combat chat reaction types
 */
export type CombatChatReactionType =
  | "critical_hit_dealt"
  | "critical_hit_taken"
  | "near_death"
  | "victory_imminent";

/**
 * Pending chat reaction for an agent
 */
export interface PendingChatReaction {
  type: CombatChatReactionType;
  opponentName: string;
  timestamp: number;
}

/**
 * Internal agent instance tracking
 */
export interface AgentInstance {
  config: EmbeddedAgentConfig;
  service: EmbeddedHyperscapeService;
  chatRuntime: AgentRuntime | null;
  /** Fingerprint of secrets/model used to build chatRuntime; cleared when stale. */
  chatRuntimeConfigSig?: string;
  chatRuntimeInfo: {
    provider: string;
    model: string;
    source: string;
  } | null;
  chatRuntimeInitPromise: Promise<AgentRuntime | null> | null;
  state: AgentState;
  startedAt: number;
  lastActivity: number;
  error?: string;
  behaviorInterval: ReturnType<typeof setInterval> | null;
  behaviorStartTimeout: ReturnType<typeof setTimeout> | null;
  goal: AgentGoal | null;
  questsAccepted: Set<string>;
  currentTargetId: string | null;
  lastAteAt: number;
  dropCooldownUntil: number;
  lastGatherTargetId: string | null;
  lastGatherQueuedAt: number;
  lastGatherAttemptPosition: [number, number, number] | null;
  gatherBlacklistUntil: Map<string, number>;
  lastPickupTargetId: string | null;
  lastPickupAttemptAt: number;
  lastPickupAttemptPosition: [number, number, number] | null;
  pickupBlacklistUntil: Map<string, number>;
  /** Pending chat reaction from combat event (processed on next behavior tick) */
  pendingChatReaction: PendingChatReaction | null;
  /** Timestamp of last combat chat to prevent spam */
  lastCombatChatAt: number;
  /** Timestamp of last re-engage attack during an active fight */
  lastCombatReEngageAt: number;
  /** Whether offensive prayer has been activated for the current combat encounter */
  combatPrayerActive: boolean;
  /** Timestamp of last dashboard operator command — ticker defers to it for a grace period */
  operatorCommandAt: number;
  /** Persistent navigation target — agent re-issues move toward this each tick until arrival */
  navigationTarget: {
    position: [number, number, number];
    description: string;
    setAt: number;
  } | null;
  /** Tracks per-quest completion failures so the agent doesn't loop forever on unreachable NPCs */
  questCompleteFailures?: Map<string, number>;
  /** Navigation stuck detection — last known position */
  navStuckLastPos?: [number, number, number];
  /** Navigation stuck detection — last distance to target */
  navStuckLastDist?: number;
  /** Navigation stuck detection — consecutive ticks without progress */
  navStuckCount?: number;
  /** Recent LLM action descriptions for stuck-loop detection */
  recentLlmActions?: string[];
  /** LLM-generated multi-step plan — persists across ticks until completed or replaced */
  llmPlan?: {
    steps: string[];
    currentStep: number;
    createdAt: number;
    goal: string;
  };
  /** Recent action+result log for LLM context (what happened in recent ticks) */
  recentActionLog?: Array<{ tick: number; action: string; result: string }>;
  /** Monotonic tick counter for action log */
  tickCounter?: number;
  /** Persistent learnings the agent discovers through play (survives across ticks) */
  memories?: string[];
  /** Pre-fetched LLM decision from the previous tick (non-blocking pipeline) */
  pendingLlmResult?:
    | import("../llmBehaviorDecision.js").LlmBehaviorResult
    | null;
  /** Whether an LLM call is currently in-flight for this agent */
  llmCallInFlight?: boolean;
  /** LLM token cost tracker */
  llmCostTracker?: {
    totalCalls: number;
    totalTokensEstimate: number;
    callsSinceReset: number;
    lastResetAt: number;
  };
  /** Circular buffer tracking recent LLM call outcomes for circuit breaker */
  llmOutcomeBuffer?: Array<"ok" | "fail">;
  /** Timestamp when LLM circuit breaker tripped — scripted-only until cooldown expires */
  llmCircuitOpenUntil?: number;
}

export type EmbeddedBehaviorAction =
  | { type: "attack"; targetId: string }
  | { type: "gather"; targetId: string }
  | { type: "pickup"; targetId: string }
  | { type: "lootGravestone"; gravestoneId: string }
  | { type: "move"; target: [number, number, number]; runMode?: boolean }
  | { type: "questAccept"; questId: string }
  | { type: "questComplete"; questId: string }
  | { type: "firemake"; logsItemId: string }
  | { type: "navigateTo"; destination: string }
  | { type: "cook"; itemId: string }
  | { type: "smelt"; recipe: string }
  | { type: "smith"; recipe: string }
  | { type: "runecraft"; runeType: string }
  | { type: "craft"; recipeId: string; quantity?: number }
  | { type: "fletch"; recipeId: string; quantity?: number }
  | { type: "tan"; inputItemId: string; quantity?: number }
  | { type: "use"; itemId: string }
  | { type: "equip"; itemId: string }
  | { type: "bankDepositAll" }
  | { type: "homeTeleport" }
  | { type: "stop" }
  | { type: "idle" };

/** Autonomous behavior tick interval for embedded agents */
export const EMBEDDED_BEHAVIOR_TICK_INTERVAL = 8000;

/**
 * Stagger offset between agents to prevent all agents from ticking on the same
 * event loop turn. With 10 agents at 800ms stagger, they spread across 8 seconds
 * so at most ~1 agent resolves per event loop turn instead of all 10 at once.
 */
export const AGENT_STAGGER_OFFSET_MS = 800;

/** Agent autonomy is always enabled — agents always move and act autonomously. */
export const EMBEDDED_AGENT_AUTONOMY_ENABLED = true;

/** How long (ms) the behavior ticker defers to a dashboard operator command */
const OPERATOR_COMMAND_GRACE_MS = 30_000;

/** Combat chat reaction thresholds */
export const CRITICAL_HIT_THRESHOLD = 0.3; // 30% of max health
export const NEAR_DEATH_THRESHOLD = 0.2; // 20% of current health
export const COMBAT_CHAT_COOLDOWN = 15000; // 15 seconds between combat chats
const PICKUP_RANGE = 2.5;
const PICKUP_STUCK_REPEAT_WINDOW_MS = 20000;
const PICKUP_STUCK_MOVEMENT_THRESHOLD = 1.25;
const PICKUP_BLACKLIST_MS = 45000;
const GATHER_STUCK_REPEAT_WINDOW_MS = 20000;
const GATHER_STUCK_MOVEMENT_THRESHOLD = 1.25;
const GATHER_BLACKLIST_MS = 45000;

/**
 * Interface for the HyperscapeService methods used by the ticker.
 */
interface HyperscapeService {
  setAutonomousBehaviorEnabled?(enabled: boolean): void;
}

export function setAgentAutonomyIfSupported(
  service: HyperscapeService,
  enabled: boolean,
): boolean {
  if (typeof service.setAutonomousBehaviorEnabled !== "function") {
    return false;
  }
  service.setAutonomousBehaviorEnabled(enabled);
  return true;
}

/**
 * AgentBehaviorTicker manages the autonomous behavior loop and action selection
 * for embedded agents.
 */
export class AgentBehaviorTicker {
  /** Counter used to stagger agent start times so they don't all tick at once */
  private agentStartIndex = 0;

  constructor(
    private readonly world: World,
    private readonly getAgent: (
      characterId: string,
    ) => AgentInstance | undefined,
    private readonly getAllAgentIds: () => string[],
  ) {}

  // ─── BEHAVIOR LOOP ───────────────────────────────────────────────────

  /**
   * Start autonomous behavior loop for an embedded agent.
   * Uses an 8-second interval with a 3-second initial delay.
   */
  public startBehaviorLoop(characterId: string): void {
    const instance = this.getAgent(characterId);
    if (!instance || instance.state !== "running") {
      return;
    }

    // Replace any existing loop.
    this.stopBehaviorLoop(characterId);

    const runTick = async () => {
      const current = this.getAgent(characterId);
      if (!current || current.state !== "running") {
        return;
      }

      try {
        await this.executeBehaviorTick(characterId);
      } catch (err) {
        console.warn(
          `[AgentManager] Behavior tick failed for ${characterId}: ${errMsg(
            err,
          )}`,
        );
      } finally {
        tickInProgress = false;
      }
    };

    let tickInProgress = false;

    // Stagger each agent's interval start so they don't all fire on the same
    // event loop turn. Agent 0 starts at 3000ms, agent 1 at 3800ms, etc.
    const staggerDelay = this.agentStartIndex * AGENT_STAGGER_OFFSET_MS;
    this.agentStartIndex++;

    // Delay the first tick so PLAYER_REGISTERED has time to fire and
    // QuestSystem can load the player's quest state from the database.
    // Additional stagger offset prevents simultaneous first ticks.
    instance.behaviorStartTimeout = setTimeout(() => {
      const current = this.getAgent(characterId);
      if (!current || current.state !== "running") {
        return;
      }
      current.behaviorStartTimeout = null;
      if (!current.service.isAutonomousEnabled()) {
        return;
      }
      void runTick();

      // Start the recurring interval AFTER the first tick completes its stagger
      current.behaviorInterval = setInterval(() => {
        if (tickInProgress) return;
        tickInProgress = true;
        void runTick();
      }, EMBEDDED_BEHAVIOR_TICK_INTERVAL);
    }, 3000 + staggerDelay);
  }

  /**
   * Stop autonomous behavior loop for an embedded agent.
   */
  public stopBehaviorLoop(characterId: string): void {
    const instance = this.getAgent(characterId);
    if (!instance) {
      return;
    }

    if (instance.behaviorInterval) {
      clearInterval(instance.behaviorInterval);
      instance.behaviorInterval = null;
    }
    if (instance.behaviorStartTimeout) {
      clearTimeout(instance.behaviorStartTimeout);
      instance.behaviorStartTimeout = null;
    }

    // Best-effort stop so paused/stopped agents don't keep pathing or attacking.
    void instance.service.executeStop().catch(() => {});
  }

  /**
   * Execute one autonomous behavior tick.
   *
   * Quest-aware: agents auto-accept quests, track objectives, and complete them.
   */
  public async executeBehaviorTick(characterId: string): Promise<void> {
    const instance = this.getAgent(characterId);
    if (!instance || instance.state !== "running") {
      return;
    }

    const entity = this.world.entities.get(characterId);

    if (recoverAgentFromDeathLoop(this.world, characterId, "AgentManager")) {
      instance.lastActivity = Date.now();
      return;
    }

    if (ejectAgentFromCombatArena(this.world, characterId, "AgentManager")) {
      instance.lastActivity = Date.now();
      return;
    }

    if (
      await relocateStreamingAgentOutOfDuelHubIfOptedOut(
        this.world,
        characterId,
      )
    ) {
      instance.lastActivity = Date.now();
      return;
    }

    const inStreamingDuel =
      (entity?.data as { inStreamingDuel?: boolean } | undefined)
        ?.inStreamingDuel === true;

    if (inStreamingDuel) {
      return;
    }

    // Hard gate: if the service has disabled autonomous behavior (e.g. while
    // a DuelCombatAI is running), skip the entire tick so the agent doesn't
    // try to wander, quest, or fight something other than its assigned opponent.
    if (!instance.service.isAutonomousEnabled()) {
      return;
    }

    const gameState = instance.service.getGameState();
    if (!gameState || !gameState.position) {
      return;
    }

    ensureEmbeddedAgentCharacterVision(characterId, gameState.skills);

    // === COMBAT CHAT REACTIONS (non-blocking) ===
    if (instance.pendingChatReaction) {
      const reaction = instance.pendingChatReaction;
      instance.pendingChatReaction = null;

      try {
        const message = this.getCombatChatResponse(reaction);
        await instance.service.sendChatMessage(message);
        instance.lastCombatChatAt = Date.now();
      } catch (err) {
        console.warn(
          `[AgentManager] ${instance.config.name} failed to send combat chat: ${errMsg(err)}`,
        );
      }
    }

    // === QUEST MANAGEMENT ===
    await this.manageQuests(instance);

    // Yield to event loop between heavy synchronous sub-tasks so game ticks
    // can fire instead of being starved by back-to-back agent CPU work.
    await yieldToEventLoop();

    // === INVENTORY MANAGEMENT ===
    this.manageInventory(instance);

    // === SHOPPING: buy missing tools/weapons ===
    this.manageShopping(instance);

    // === EQUIPMENT MANAGEMENT ===
    this.manageEquipment(instance, gameState);

    await yieldToEventLoop();

    // === SURVIVAL: EAT FOOD IF NEEDED ===
    if (this.assessAndEat(instance, gameState)) {
      syncEmbeddedAgentDashboardForTick(
        instance.config.characterId,
        instance.goal,
        instance.service.getQuestState(),
        instance.service.getAvailableQuests(),
        instance.startedAt,
        "idle",
        "Ate food to recover health.",
      );
      return; // Ate food this tick — skip action to let health update
    }

    // === OPERATOR COMMAND GRACE ===
    // When the dashboard user just sent a command, don't override it with
    // autonomous action selection for OPERATOR_COMMAND_GRACE_MS.  Survival
    // tasks (eating, equipment, quests) above still run, but we skip the
    // autonomous "what should I do?" decision so the agent follows through
    // on the operator's instruction.
    if (
      instance.operatorCommandAt > 0 &&
      Date.now() - instance.operatorCommandAt < OPERATOR_COMMAND_GRACE_MS
    ) {
      syncEmbeddedAgentDashboardForTick(
        instance.config.characterId,
        instance.goal,
        instance.service.getQuestState(),
        instance.service.getAvailableQuests(),
        instance.startedAt,
        "idle",
        "Following operator command.",
      );
      return;
    }

    // === PICK ACTION ===
    let action: EmbeddedBehaviorAction;
    let decisionPath: "llm" | "scripted" = "scripted";
    let llmReasoning: string | null = null;

    if (isLlmBehaviorEnabled(instance)) {
      const llmResult = await pickBehaviorActionWithLlm(instance, gameState);
      if (llmResult) {
        action = llmResult.action;
        decisionPath = "llm";
        llmReasoning = llmResult.reasoning;
        if (llmResult.goal) {
          instance.goal = llmResult.goal;
        }
        // Record chain-of-thought as a separate thought for dashboard visibility
        if (llmResult.thinking) {
          recordAgentThought(instance.config.characterId, {
            type: "thinking",
            content: llmResult.thinking,
            decisionPath: "llm",
          });
        }
      } else {
        action = this.pickBehaviorAction(instance, gameState);
      }
    } else {
      action = this.pickBehaviorAction(instance, gameState);
    }

    const actionThought =
      llmReasoning || this.describeBehaviorAction(instance, action);
    if (actionThought) {
      recordAgentThought(instance.config.characterId, {
        type: "action",
        content: actionThought,
        decisionPath,
      });
    }

    // Reset questCompleteFailures when agent is doing non-complete quest work.
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
        // Activate offensive prayer proactively on the same tick as the attack.
        if (!instance.combatPrayerActive) {
          const prayer = this.getOffensivePrayerForAgent(instance);
          if (prayer) {
            void instance.service.executePrayer(prayer).catch(() => {});
            instance.combatPrayerActive = true;
          }
        }
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
          // Verify quest actually started by checking quest state after a moment
          // (QUEST_START_ACCEPTED is handled synchronously by QuestSystem)
          const postAcceptState = instance.service.getQuestState();
          const questStarted = postAcceptState.some(
            (q) => q.questId === action.questId,
          );
          if (questStarted) {
            instance.questsAccepted.add(action.questId);
          } else {
            console.warn(
              `[AgentManager] ${instance.config.name} quest accept sent but not started yet: ${action.questId} (will retry)`,
            );
          }
        }
        instance.lastActivity = Date.now();
        break;
      }

      case "questComplete": {
        if (!instance.questCompleteFailures) {
          instance.questCompleteFailures = new Map();
        }
        const qcFailCount =
          instance.questCompleteFailures.get(action.questId) || 0;
        if (qcFailCount >= 3) {
          // Too many failures — skip and let agent try something else
          instance.goal = null;
          instance.lastActivity = Date.now();
          break;
        }
        const qcCompleted = await instance.service.executeQuestComplete(
          action.questId,
        );
        if (qcCompleted) {
          instance.goal = null;
          instance.questCompleteFailures.delete(action.questId);
        } else {
          instance.questCompleteFailures.set(action.questId, qcFailCount + 1);
          // Navigate to the turn-in NPC on failure
          const qcState = instance.service.getQuestState();
          const qcQuest = qcState.find((q) => q.questId === action.questId);
          const qcNpc = qcQuest?.startNpc;
          if (qcNpc) {
            const qcGameState = instance.service.getGameState();
            const qcPos = qcGameState?.position ?? null;
            const qcCoords = findWorldMapMoveTarget(
              qcNpc,
              instance.service,
              qcPos,
            );
            if (qcCoords) {
              await instance.service.executeMove(qcCoords, true);
            }
          }
        }
        instance.lastActivity = Date.now();
        break;
      }

      case "navigateTo": {
        const navGameState = instance.service.getGameState();
        const navPlayerPos = navGameState?.position ?? null;
        const navCoords = findWorldMapMoveTarget(
          action.destination,
          instance.service,
          navPlayerPos,
        );
        if (navCoords) {
          await instance.service.executeMove(navCoords, true);
          instance.lastActivity = Date.now();
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
          const fireLit = await instance.service.executeFiremake();
          if (!fireLit) {
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
        await instance.service.executeStop();
        instance.lastActivity = Date.now();
        break;

      case "idle":
      default:
        break;
    }

    syncEmbeddedAgentDashboardForTick(
      instance.config.characterId,
      instance.goal,
      instance.service.getQuestState(),
      instance.service.getAvailableQuests(),
      instance.startedAt,
      action.type,
      actionThought,
    );
  }

  private describeBehaviorAction(
    instance: AgentInstance,
    action: EmbeddedBehaviorAction,
  ): string | null {
    const nearbyById = new Map(
      instance.service
        .getNearbyEntities()
        .map((entity) => [entity.id, entity] as const),
    );

    switch (action.type) {
      case "attack": {
        const target = nearbyById.get(action.targetId);
        return `Engaging ${target?.name || target?.mobType || "a nearby enemy"}.`;
      }
      case "gather": {
        const target = nearbyById.get(action.targetId);
        return `Gathering from ${target?.name || target?.resourceType || "a nearby resource"}.`;
      }
      case "pickup": {
        const target = nearbyById.get(action.targetId);
        return `Picking up ${target?.name || target?.itemId || "a nearby item"}.`;
      }
      case "lootGravestone":
        return "Looting a nearby gravestone.";
      case "move":
        return `Moving to [${action.target.map((value) => value.toFixed(1)).join(", ")}].`;
      case "questAccept":
        return `Accepting quest ${action.questId}.`;
      case "questComplete":
        return `Completing quest ${action.questId}.`;
      case "firemake":
        return "Starting a fire with the carried logs.";
      case "cook":
        return `Cooking ${action.itemId}.`;
      case "smelt":
        return `Smelting ${action.recipe}.`;
      case "smith":
        return `Smithing ${action.recipe}.`;
      case "craft":
        return `Crafting ${action.recipeId}.`;
      case "fletch":
        return `Fletching ${action.recipeId}.`;
      case "tan":
        return `Tanning ${action.inputItemId}.`;
      case "runecraft":
        return `Runecrafting ${action.runeType} runes.`;
      case "use":
        return `Using item ${action.itemId}.`;
      case "equip":
        return `Equipping ${action.itemId}.`;
      case "navigateTo":
        return `Navigating to ${action.destination}.`;
      case "bankDepositAll":
        return "Depositing all items at bank.";
      case "homeTeleport":
        return "Teleporting home.";
      case "stop":
        return "Stopping current movement and combat.";
      case "idle":
      default:
        return null;
    }
  }

  // ─── BEHAVIOR MANAGEMENT ─────────────────────────────────────────────

  /**
   * Manage quest state for an agent: auto-accept, track progress, update goals.
   * Only accepts quests the agent can actually execute (kill quests first).
   */
  public async manageQuests(instance: AgentInstance): Promise<void> {
    // When LLM behavior is active, the LLM sets the goal each tick based on
    // its character build identity.  Still auto-accept/complete quests below,
    // but don't overwrite the LLM-driven goal with scripted quest goals.
    const llmDrivesGoals = isLlmBehaviorEnabled(instance);

    const activeQuests = instance.service.getQuestState();
    const availableQuests = instance.service.getAvailableQuests();

    const resourceSystemAvailable = !!this.world.getSystem("resource");

    // If there's an active quest, set the goal to work on it
    if (activeQuests.length > 0) {
      // Prefer a quest the agent can actually complete right now
      const quest =
        activeQuests.find(
          (q) =>
            q.status === "ready_to_complete" ||
            q.stageType === "kill" ||
            q.stageType === "dialogue" ||
            (q.stageType === "gather" && resourceSystemAvailable),
        ) || activeQuests[0];

      // If the only active quest is a gather quest and resources don't exist,
      // fall through to combat so agents don't wander endlessly.
      if (
        quest.stageType === "gather" &&
        !resourceSystemAvailable &&
        quest.status !== "ready_to_complete"
      ) {
        if (!llmDrivesGoals) {
          instance.goal = {
            type: "combat",
            description: "Train combat (gather resources unavailable)",
          };
        }
        return;
      }

      if (!llmDrivesGoals) {
        instance.goal = {
          type: "questing",
          description:
            quest.status === "ready_to_complete"
              ? `Turn in: ${quest.name}`
              : `${quest.stageDescription || quest.name}`,
          questId: quest.questId,
          questName: quest.name,
          questStageType: quest.stageType,
          questStageTarget: quest.stageTarget,
          questStageCount: quest.stageCount,
          questStartNpc: quest.startNpc,
        };
      }
      return;
    }

    // No active quest — accept the next available one.
    // Kill quests first (reliable), then gather quests only if resources exist.
    const questPriority = [
      "goblin_slayer",
      ...(resourceSystemAvailable
        ? ["lumberjacks_first_lesson", "fresh_catch", "torvins_tools"]
        : []),
    ];

    for (const questId of questPriority) {
      const quest = availableQuests.find(
        (q) => q.questId === questId && q.status === "not_started",
      );
      if (quest && !instance.questsAccepted.has(questId)) {
        if (!llmDrivesGoals) {
          instance.goal = {
            type: "questing",
            description: `Accept quest: ${quest.name}`,
            questId: quest.questId,
            questName: quest.name,
            questStartNpc: quest.startNpc,
          };
        }
        return;
      }
    }

    // All quests done or accepted — combat training
    if (!llmDrivesGoals) {
      instance.goal = {
        type: "combat",
        description: "Train combat (nearby hostile creatures)",
      };
    }
  }

  /**
   * Buy tools and weapons the agent needs but doesn't have.
   * Agents bypass coin payment via executeStoreBuy. One purchase per tick.
   */
  public manageShopping(instance: AgentInstance): void {
    const inventory = instance.service.getInventoryItems();
    const equipped = instance.service.getEquippedItems();
    const goal = instance.goal;

    const hasItemInInventoryOrEquipped = (itemId: string): boolean => {
      const item = getItem(itemId);
      const equipSlot = item?.equipSlot;
      if (equipSlot) {
        const equippedItem = equipped[equipSlot];
        if (equippedItem === itemId) return true;
        // Two-handed weapons are represented by weapon slot in equipment state.
        if (equipSlot === "2h" && equipped.weapon === itemId) return true;
      } else if (equipped.weapon === itemId) {
        // Fallback for weapon-like items where metadata may be missing.
        return true;
      }
      return inventory.some((i) => i.itemId === itemId);
    };

    const hasAnyOfType = (keyword: string): boolean => {
      const equippedWeapon = equipped.weapon || "";
      if (equippedWeapon.includes(keyword)) return true;
      return inventory.some((i) => i.itemId.includes(keyword));
    };

    // Priority 1: Buy a weapon if unarmed
    if (
      !equipped.weapon &&
      !inventory.some((i) => {
        const item = getItem(i.itemId);
        return item?.equipSlot === "weapon" || item?.equipSlot === "2h";
      })
    ) {
      instance.service.executeStoreBuy("sword_store", "bronze_shortsword", 1);
      return;
    }

    // Priority 2: Buy tools needed for current quest
    if (goal?.type === "questing") {
      const stageTarget = goal.questStageTarget || "";
      const stageType = goal.questStageType || "";

      // Need hatchet for woodcutting quests or any quest that needs logs
      if (
        (stageType === "gather" && stageTarget.includes("log")) ||
        goal.questId === "lumberjacks_first_lesson" ||
        goal.questId === "fletchers_introduction"
      ) {
        if (!hasAnyOfType("hatchet")) {
          instance.service.executeStoreBuy(
            "general_store",
            "bronze_hatchet",
            1,
          );
          return;
        }
      }

      // Need pickaxe for mining quests
      if (
        (stageType === "gather" &&
          (stageTarget.includes("ore") || stageTarget.includes("essence"))) ||
        goal.questId === "torvins_tools" ||
        goal.questId === "rune_mysteries"
      ) {
        if (!hasAnyOfType("pickaxe")) {
          instance.service.executeStoreBuy(
            "general_store",
            "bronze_pickaxe",
            1,
          );
          return;
        }
      }

      // Need fishing equipment for fishing quests (net for shrimp/anchovies; rods for higher fish)
      if (
        (stageType === "gather" &&
          (stageTarget.includes("shrimp") ||
            stageTarget.includes("anchovy") ||
            stageTarget.includes("raw_shrimp"))) ||
        goal.questId === "fresh_catch"
      ) {
        const hasNet = hasItemInInventoryOrEquipped("small_fishing_net");
        const hasOtherFishingTool =
          hasAnyOfType("fishing_rod") ||
          hasAnyOfType("fly_fishing") ||
          hasAnyOfType("harpoon") ||
          hasAnyOfType("lobster_pot");
        if (!hasNet && !hasOtherFishingTool) {
          instance.service.executeStoreBuy(
            "fishing_store",
            "small_fishing_net",
            1,
          );
          return;
        }
      }

      // Need tinderbox for firemaking quests
      if (stageType === "interact" && stageTarget.includes("fire")) {
        if (!hasItemInInventoryOrEquipped("tinderbox")) {
          instance.service.executeStoreBuy("general_store", "tinderbox", 1);
          return;
        }
      }

      // Need feathers for headless_arrow stage (fletchers_introduction)
      if (
        goal.questId === "fletchers_introduction" &&
        stageTarget === "headless_arrow"
      ) {
        if (!inventory.some((i) => i.itemId === "feathers")) {
          instance.service.executeStoreBuy("general_store", "feathers", 15);
          return;
        }
      }
    }
  }

  /**
   * Keep inventory tidy: drop low-value junk to make room for useful items.
   * Agents get inventories clogged with sharks from duels and bones from kills.
   * Runs once per tick. Drops one item per tick to avoid spam.
   *
   * Priority to keep: weapons > armor > tools > food (max 5) > everything else
   * Priority to drop: bones, excess food beyond 5, other junk
   */
  public manageInventory(instance: AgentInstance): void {
    const inventory = instance.service.getInventoryItems();
    if (inventory.length < 20) return; // Keep 8+ free slots for quest loot and gear
    if (Date.now() < instance.dropCooldownUntil) return;

    // Count food items
    let foodCount = 0;
    const dropCandidates: Array<{
      itemId: string;
      slot: number;
      priority: number;
    }> = [];

    for (const slot of inventory) {
      const itemData = getItem(slot.itemId);
      const healAmount = itemData
        ? ((itemData as unknown as Record<string, unknown>).healAmount as
            | number
            | undefined)
        : undefined;
      const isFood = healAmount && healAmount > 0;
      const isWeapon =
        itemData?.equipSlot === "weapon" || itemData?.equipSlot === "2h";
      const isArmor = itemData?.equipSlot && !isWeapon;
      const isTool = itemData?.type === "tool";

      if (isFood) {
        foodCount++;
        if (foodCount > 5) {
          dropCandidates.push({
            itemId: slot.itemId,
            slot: slot.slot,
            priority: 2,
          });
        }
        continue;
      }

      // Never drop weapons, armor, tools, or quest-critical items
      const questTools = [
        "tinderbox",
        "bronze_hatchet",
        "hatchet",
        "bronze_pickaxe",
        "pickaxe",
        "fishing_rod",
        "small_fishing_net",
        "net",
        "logs",
        "oak_logs",
      ];
      if (isWeapon || isArmor || isTool || questTools.includes(slot.itemId))
        continue;

      // Bones — bury for prayer XP instead of dropping
      if (slot.itemId === "bones" || slot.itemId.endsWith("_bones")) {
        instance.service.executeUse(slot.itemId);
        return; // One action per tick
      }

      // Other non-essential items
      dropCandidates.push({
        itemId: slot.itemId,
        slot: slot.slot,
        priority: 1,
      });
    }

    if (dropCandidates.length === 0) return;

    // Sort by priority (lowest first = drop first)
    dropCandidates.sort((a, b) => a.priority - b.priority);

    // Drop up to 3 items when very full, 1 otherwise
    const dropCount =
      inventory.length >= 27 ? Math.min(3, dropCandidates.length) : 1;
    for (let i = 0; i < dropCount; i++) {
      const toDrop = dropCandidates[i];
      instance.service.executeDrop(toDrop.itemId, 1);
    }

    // Set cooldown so agent doesn't immediately pick up what it dropped
    instance.dropCooldownUntil = Date.now() + 25000; // 25 seconds (~3 ticks)
  }

  /**
   * Assess health situation and eat food if needed.
   * Returns true if food was eaten this tick (caller should skip other actions).
   *
   * Decision logic is contextual:
   * - In combat: eat when health drops below 50% (urgent)
   * - Out of combat: eat when health below 70% (proactive recovery)
   * - Don't waste high-value food on small damage (pick lowest heal that covers the gap)
   * - Don't eat at full health
   */
  public assessAndEat(
    instance: AgentInstance,
    gameState: EmbeddedGameState,
  ): boolean {
    const { health, maxHealth, inCombat } = gameState;
    if (maxHealth <= 0) return false;

    const healthPercent = health / maxHealth;
    // Cooldown is shorter in combat and can be bypassed at critical HP.
    const EAT_COOLDOWN_MS = inCombat ? 6000 : 12000;
    const criticalInCombat = inCombat && healthPercent <= 0.25;
    if (!criticalInCombat && Date.now() - instance.lastAteAt < EAT_COOLDOWN_MS)
      return false;

    const missingHp = maxHealth - health;

    if (missingHp < 2) return false;

    // Decide threshold based on situation
    const eatThreshold = inCombat ? 0.5 : 0.7;
    if (healthPercent >= eatThreshold) return false;

    // Find food in inventory
    const inventory = instance.service.getInventoryItems();
    if (inventory.length === 0) return false;

    // Score each food item: prefer the smallest heal that covers the gap
    // (don't waste a shark healing 20hp when we only need 3hp)
    let bestFood: { itemId: string; healAmount: number; slot: number } | null =
      null;

    for (const slot of inventory) {
      const itemData = getItem(slot.itemId);
      if (!itemData) continue;

      const healAmount = (itemData as unknown as Record<string, unknown>)
        .healAmount as number | undefined;
      if (!healAmount || healAmount <= 0) continue;

      if (!bestFood) {
        bestFood = { itemId: slot.itemId, healAmount, slot: slot.slot };
        continue;
      }

      // Prefer food that covers the gap without over-healing too much
      const bestOverheal = Math.max(0, bestFood.healAmount - missingHp);
      const thisOverheal = Math.max(0, healAmount - missingHp);

      if (thisOverheal < bestOverheal) {
        bestFood = { itemId: slot.itemId, healAmount, slot: slot.slot };
      } else if (
        thisOverheal === bestOverheal &&
        healAmount > bestFood.healAmount
      ) {
        // Same efficiency — pick the bigger heal
        bestFood = { itemId: slot.itemId, healAmount, slot: slot.slot };
      }
    }

    if (!bestFood) return false;

    instance.service.executeUse(bestFood.itemId);
    instance.lastAteAt = Date.now();
    return true;
  }

  /**
   * Inspect inventory and equip the best gear available.
   * Runs every tick — handles: server restarts, new loot pickups,
   * quest reward items, and any other inventory changes.
   *
   * Reads directly from InventorySystem and EquipmentSystem
   * (entity data.inventory is unreliable — often empty).
   */
  public manageEquipment(
    instance: AgentInstance,
    _gameState: EmbeddedGameState,
  ): void {
    // Read real inventory from InventorySystem (not entity data)
    const inventory = instance.service.getInventoryItems();
    if (inventory.length === 0) return;

    // Read real equipment from EquipmentSystem
    const equipped = instance.service.getEquippedItems();

    // --- WEAPON ---
    const equippedWeaponId = equipped.weapon || null;
    let bestWeapon: { itemId: string; score: number } | null = null;

    for (const slot of inventory) {
      const itemData = getItem(slot.itemId);
      if (!itemData) continue;
      if (itemData.equipSlot !== "weapon" && itemData.equipSlot !== "2h")
        continue;

      const bonuses = itemData.bonuses as Record<string, number> | undefined;
      const score = (bonuses?.attack || 0) + (bonuses?.strength || 0);

      if (!bestWeapon || score > bestWeapon.score) {
        bestWeapon = { itemId: slot.itemId, score };
      }
    }

    let equippedWeaponScore = 0;
    if (equippedWeaponId) {
      const d = getItem(equippedWeaponId);
      if (d) {
        const b = d.bonuses as Record<string, number> | undefined;
        equippedWeaponScore = (b?.attack || 0) + (b?.strength || 0);
      }
    }

    if (
      bestWeapon &&
      bestWeapon.score > equippedWeaponScore &&
      bestWeapon.itemId !== equippedWeaponId
    ) {
      instance.service.executeEquip(bestWeapon.itemId);
      return; // one equip per tick
    }

    // --- ARMOR SLOTS ---
    const armorSlots = [
      "helmet",
      "body",
      "legs",
      "shield",
      "boots",
      "gloves",
      "cape",
    ] as const;

    for (const slotName of armorSlots) {
      const equippedId = equipped[slotName] || null;

      let bestArmor: { itemId: string; score: number } | null = null;

      for (const slot of inventory) {
        const itemData = getItem(slot.itemId);
        if (!itemData) continue;
        if (itemData.equipSlot !== slotName) continue;

        const bonuses = itemData.bonuses as Record<string, number> | undefined;
        const score = (bonuses?.defense || 0) + (bonuses?.attack || 0);

        if (!bestArmor || score > bestArmor.score) {
          bestArmor = { itemId: slot.itemId, score };
        }
      }

      if (bestArmor) {
        let currentScore = 0;
        if (equippedId) {
          const d = getItem(equippedId);
          if (d) {
            const b = d.bonuses as Record<string, number> | undefined;
            currentScore = (b?.defense || 0) + (b?.attack || 0);
          }
        }

        if (bestArmor.score > currentScore && bestArmor.itemId !== equippedId) {
          instance.service.executeEquip(bestArmor.itemId);
          return; // one equip per tick
        }
      }
    }
  }

  /**
   * Whether the agent can attempt to gather this resource (has the usual tool).
   * Without this check, ticks threw — `canGatherNearbyResource` was referenced but missing.
   */
  private canGatherNearbyResource(
    instance: AgentInstance,
    entity: NearbyEntityData,
  ): boolean {
    const inventory = instance.service.getInventoryItems();
    const equipped = instance.service.getEquippedItems();
    const weapon = equipped.weapon || "";

    const hasKeyword = (keyword: string): boolean =>
      weapon.includes(keyword) ||
      inventory.some((slot) => slot.itemId.includes(keyword));

    const hasExactOrEquipped = (itemId: string): boolean => {
      const meta = getItem(itemId);
      const slotName = meta?.equipSlot;
      if (slotName) {
        const on = equipped[slotName as keyof typeof equipped];
        if (on === itemId) return true;
        if (slotName === "2h" && equipped.weapon === itemId) return true;
      }
      if (equipped.weapon === itemId) return true;
      return inventory.some((s) => s.itemId === itemId);
    };

    const hay =
      `${entity.name} ${entity.resourceType || ""} ${entity.id} ${entity.resourceId || ""}`.toLowerCase();

    const looksLikeTree =
      hay.includes("tree") ||
      hay.includes("oak") ||
      hay.includes("willow") ||
      hay.includes("maple") ||
      hay.includes("yew");
    if (looksLikeTree) {
      return hasKeyword("hatchet");
    }

    const looksLikeOre =
      hay.includes("ore") ||
      hay.includes("rock") ||
      hay.includes("essence") ||
      entity.resourceType === "ore";
    if (looksLikeOre) {
      return hasKeyword("pickaxe");
    }

    // Fishing: must NOT use a generic "spot" match — that let non-fishing resources
    // through with `return true` and caused gather spam without tools.
    const isFishingResource =
      hay.includes("fishing_spot") ||
      hay.includes("fishing spot") ||
      entity.resourceType === "fishing_spot" ||
      entity.resourceType === "fish" ||
      (hay.includes("fish") && hay.includes("spot"));
    if (isFishingResource) {
      return (
        hasExactOrEquipped("small_fishing_net") ||
        hasKeyword("fishing_rod") ||
        hasKeyword("fly_fishing") ||
        hasKeyword("harpoon") ||
        hasKeyword("lobster_pot") ||
        inventory.some((s) =>
          /small_fishing_net|fishing_rod|fly_fishing|harpoon|lobster_pot|fishing_net|_net$/.test(
            s.itemId,
          ),
        )
      );
    }

    // Other resources (e.g. custom) — let the world reject if invalid.
    return true;
  }

  // ─── ACTION SELECTION ─────────────────────────────────────────────────

  /**
   * Decide the next behavior action for an agent.
   * Quest-aware: routes actions based on active quest objectives.
   * Key principle: ALWAYS do something productive. Never just wander aimlessly.
   */
  public pickBehaviorAction(
    instance: AgentInstance,
    gameState: EmbeddedGameState,
  ): EmbeddedBehaviorAction {
    const healthPercent =
      gameState.maxHealth > 0 ? gameState.health / gameState.maxHealth : 1;
    const position = gameState.position!;
    const now = Date.now();

    for (const [resourceId, ignoreUntil] of instance.gatherBlacklistUntil) {
      if (ignoreUntil <= now) {
        instance.gatherBlacklistUntil.delete(resourceId);
      }
    }

    for (const [itemId, ignoreUntil] of instance.pickupBlacklistUntil) {
      if (ignoreUntil <= now) {
        instance.pickupBlacklistUntil.delete(itemId);
      }
    }

    const nearbyItems = gameState.nearbyEntities
      .filter((entity) => entity.type === "item" && entity.distance <= 15)
      .filter((entity) => {
        const ignoreUntil = instance.pickupBlacklistUntil.get(entity.id) || 0;
        return ignoreUntil <= now;
      })
      .sort((a, b) => a.distance - b.distance);

    const nearbyMobs = gameState.nearbyEntities
      .filter(
        (entity) =>
          entity.type === "mob" &&
          entity.distance <= 40 &&
          (entity.health === undefined || entity.health > 0),
      )
      .sort((a, b) => a.distance - b.distance);

    const nearbyResources = gameState.nearbyEntities
      .filter(
        (entity) =>
          entity.type === "resource" &&
          entity.distance <= 45 &&
          this.canGatherNearbyResource(instance, entity),
      )
      .filter((entity) => {
        const ignoreUntil = instance.gatherBlacklistUntil.get(entity.id) || 0;
        return ignoreUntil <= now;
      })
      .sort((a, b) => a.distance - b.distance);

    // Already fighting — let the combat system handle auto-attacks, but
    // periodically re-engage so combat doesn't silently drop and also
    // activate the offensive prayer on the first tick of each fight.
    if (gameState.inCombat) {
      // If operator just issued a command, don't re-engage — let the agent disengage.
      if (now - instance.operatorCommandAt < OPERATOR_COMMAND_GRACE_MS) {
        return { type: "idle" };
      }

      // If a quest needs a station and we have materials, disengage from
      // random mob combat so the agent can walk to the station instead.
      const questStationEscape = this.tryQuestStationNavigation(
        instance,
        position,
      );
      if (questStationEscape) {
        // Stop current combat so the agent can walk away
        void instance.service.executeStop().catch(() => {});
        return questStationEscape;
      }

      // Activate offensive prayer once per combat encounter if not already up.
      if (
        !instance.combatPrayerActive &&
        gameState.activePrayers !== undefined
      ) {
        const offensivePrayer = this.getOffensivePrayerForAgent(instance);
        if (
          offensivePrayer &&
          !gameState.activePrayers.includes(offensivePrayer)
        ) {
          void instance.service.executePrayer(offensivePrayer).catch(() => {});
          instance.combatPrayerActive = true;
        } else if (
          offensivePrayer &&
          gameState.activePrayers.includes(offensivePrayer)
        ) {
          instance.combatPrayerActive = true;
        }
      }

      // Re-engage tracked target every ~16s (2 behavior ticks) to prevent
      // silent combat drop (e.g. target moved, server-side disengage).
      const RE_ENGAGE_INTERVAL_MS = 16000;
      const targetId = instance.currentTargetId ?? gameState.currentTarget;
      if (
        targetId &&
        now - instance.lastCombatReEngageAt >= RE_ENGAGE_INTERVAL_MS
      ) {
        // Find the target in nearby entities to confirm it's still alive/close
        const target = gameState.nearbyEntities.find(
          (e) => e.id === targetId && (e.health === undefined || e.health > 0),
        );
        if (target && target.distance <= 40) {
          instance.lastCombatReEngageAt = now;
          return { type: "attack", targetId };
        }
      }

      return { type: "idle" };
    }

    // Left combat — reset trackers. Deactivate prayers to save prayer points.
    if (instance.combatPrayerActive) {
      void instance.service.executePrayerDeactivateAll().catch(() => {});
    }
    instance.combatPrayerActive = false;
    instance.lastCombatReEngageAt = 0;

    // Gravestone recovery: if agent's own gravestone is nearby, walk to it and loot
    const gravestone = this.findOwnGravestone(instance, gameState);
    if (gravestone) {
      const dx = position[0] - gravestone.position[0];
      const dz = position[2] - gravestone.position[2];
      const dist = Math.sqrt(dx * dx + dz * dz);
      if (dist > 4) {
        return { type: "move", target: gravestone.position, runMode: true };
      }
      // Close enough — loot all items from gravestone
      return { type: "lootGravestone", gravestoneId: gravestone.id };
    }

    // Opportunistic loot pickup (skip if we just dropped something to avoid loop).
    if (nearbyItems.length > 0 && now > instance.dropCooldownUntil) {
      const pickupTarget = nearbyItems[0];
      if (pickupTarget.distance > PICKUP_RANGE) {
        return {
          type: "move",
          target: [
            pickupTarget.position[0],
            position[1],
            pickupTarget.position[2],
          ],
          runMode: false,
        };
      }

      const attemptedSamePickupRecently =
        instance.lastPickupTargetId === pickupTarget.id &&
        now - instance.lastPickupAttemptAt < PICKUP_STUCK_REPEAT_WINDOW_MS &&
        instance.lastPickupAttemptPosition !== null;
      const movedSinceLastPickupAttempt = attemptedSamePickupRecently
        ? Math.hypot(
            position[0] - instance.lastPickupAttemptPosition![0],
            position[2] - instance.lastPickupAttemptPosition![2],
          )
        : Number.POSITIVE_INFINITY;

      if (
        attemptedSamePickupRecently &&
        movedSinceLastPickupAttempt < PICKUP_STUCK_MOVEMENT_THRESHOLD
      ) {
        instance.pickupBlacklistUntil.set(
          pickupTarget.id,
          now + PICKUP_BLACKLIST_MS,
        );
        instance.lastPickupTargetId = null;
        instance.lastPickupAttemptAt = 0;
        instance.lastPickupAttemptPosition = null;
        recordAgentThought(instance.config.characterId, {
          type: "evaluation",
          content: `Skipping ${pickupTarget.name || pickupTarget.itemId || "nearby loot"} for ${Math.round(PICKUP_BLACKLIST_MS / 1000)}s because I appear stuck against terrain while trying to pick it up.`,
          decisionPath: "scripted",
        });
      } else {
        instance.lastPickupTargetId = pickupTarget.id;
        instance.lastPickupAttemptAt = now;
        instance.lastPickupAttemptPosition = [...position];
        return { type: "pickup", targetId: pickupTarget.id };
      }
    }

    const goal = instance.goal;

    // === QUEST-DRIVEN BEHAVIOR ===
    if (goal?.type === "questing" && goal.questId) {
      const questAction = this.pickQuestAction(
        instance,
        position,
        nearbyMobs,
        nearbyResources,
        healthPercent,
      );
      if (questAction) return questAction;
    }

    // === QUEST-STATION NAVIGATION (scripted) ===
    // If an active quest needs a processing station and agent has materials,
    // navigate there instead of defaulting to combat.
    const questStationNav = this.tryQuestStationNavigation(instance, position);
    if (questStationNav) return questStationNav;

    // === DEFAULT: fight anything nearby, or return to spawn ===
    return this.pickCombatOrExplore(
      instance,
      position,
      nearbyMobs,
      nearbyResources,
      healthPercent,
    );
  }

  /**
   * Check if an active quest needs a station (range/furnace/anvil/altar)
   * and the agent has the materials. Returns navigateTo action or null.
   */
  public tryQuestStationNavigation(
    instance: AgentInstance,
    position: [number, number, number],
  ): EmbeddedBehaviorAction | null {
    const quests = instance.service.getQuestState();
    const inv = instance.service.getInventoryItems();
    const nearby = instance.service.getNearbyEntities();

    // Check if already near a station — don't navigate away
    const nearStation = (keyword: string) =>
      nearby.some((e) =>
        (e.name || e.type || "").toLowerCase().includes(keyword),
      );

    // Don't interrupt if agent is actively gathering and no quest needs a station.
    // If a quest stage requires station interaction (cook/craft/smelt/smith),
    // allow navigation even when near resources.
    const nearResources = nearby.some(
      (e) =>
        e.type === "resource" && e.distance !== undefined && e.distance <= 30,
    );
    const goalType = instance.goal?.type || "";
    const isActivelyGathering =
      nearResources && (goalType === "gathering" || goalType === "questing");
    if (isActivelyGathering) {
      const hasStationQuest = quests.some((q) => {
        if (q.status !== "in_progress") return false;
        const desc = (q.stageDescription || "").toLowerCase();
        return (
          desc.includes("cook") ||
          desc.includes("craft") ||
          desc.includes("rune") ||
          desc.includes("smelt") ||
          desc.includes("smith")
        );
      });
      if (!hasStationQuest) return null;
    }

    for (const q of quests) {
      if (q.status !== "in_progress") continue;
      const desc = (q.stageDescription || "").toLowerCase();

      // Cook quest — need raw food + not near range
      if (desc.includes("cook")) {
        const hasRaw = inv.some((i) => i.itemId.startsWith("raw_"));
        if (
          hasRaw &&
          !nearStation("range") &&
          !nearStation("fire") &&
          !nearStation("cooking")
        ) {
          const coords = findWorldMapMoveTarget(
            "range",
            instance.service,
            position,
          );
          if (coords) {
            recordAgentThought(instance.config.characterId, {
              type: "action",
              content: `Navigate to range`,
              decisionPath: "scripted",
            });
            return { type: "navigateTo", destination: "range" };
          }
        }
      }

      // Smelt quest — need ore + not near furnace
      if (desc.includes("smelt")) {
        const hasOre = inv.some((i) => i.itemId.includes("_ore"));
        if (hasOre && !nearStation("furnace")) {
          recordAgentThought(instance.config.characterId, {
            type: "action",
            content: `Navigate to furnace`,
            decisionPath: "scripted",
          });
          return { type: "navigateTo", destination: "furnace" };
        }
      }

      // Craft runes quest — need essence + not near altar
      if (desc.includes("rune") || desc.includes("craft")) {
        const hasEssence = inv.some((i) => i.itemId.includes("essence"));
        if (hasEssence && !nearStation("altar")) {
          recordAgentThought(instance.config.characterId, {
            type: "action",
            content: `Navigate to altar`,
            decisionPath: "scripted",
          });
          return { type: "navigateTo", destination: "altar" };
        }
      }

      // Smith quest — need bars + not near anvil
      if (desc.includes("smith")) {
        const hasBars = inv.some((i) => i.itemId.includes("_bar"));
        if (hasBars && !nearStation("anvil")) {
          recordAgentThought(instance.config.characterId, {
            type: "action",
            content: `Navigate to anvil`,
            decisionPath: "scripted",
          });
          return { type: "navigateTo", destination: "anvil" };
        }
      }
    }
    return null;
  }

  /**
   * Pick the best action for the agent's current quest objective.
   * Returns null if quest state doesn't dictate a specific action
   * (caller should fall through to default combat).
   */
  public pickQuestAction(
    instance: AgentInstance,
    position: [number, number, number],
    nearbyMobs: NearbyEntityData[],
    nearbyResources: NearbyEntityData[],
    healthPercent: number,
  ): EmbeddedBehaviorAction | null {
    const goal = instance.goal!;
    const activeQuests = instance.service.getQuestState();
    const activeQuest = activeQuests.find((q) => q.questId === goal.questId);

    // Quest not yet accepted — walk to NPC, then accept
    if (!activeQuest && !instance.questsAccepted.has(goal.questId!)) {
      return this.moveToNpcOrAccept(
        instance,
        position,
        goal.questId!,
        goal.questStartNpc,
      );
    }

    // Quest is ready to complete — walk to NPC, then turn in
    if (activeQuest?.status === "ready_to_complete") {
      return this.moveToNpcOrComplete(instance, position, activeQuest);
    }

    // Quest in progress — route by stage type
    if (activeQuest?.status === "in_progress") {
      const stageType = activeQuest.stageType;
      const stageTarget = activeQuest.stageTarget || "";

      // Dialogue stages (e.g., "return to NPC") — walk to NPC and complete
      if (stageType === "dialogue") {
        return this.moveToNpcOrComplete(instance, position, activeQuest);
      }

      if (stageType === "kill") {
        const characterId = instance.service.getPlayerId() || "";
        const targetMob = this.findMobForQuest(
          characterId,
          nearbyMobs,
          stageTarget,
        );
        if (targetMob && healthPercent > 0.4) {
          if (instance.currentTargetId !== targetMob.id) {
            instance.combatPrayerActive = false;
            instance.lastCombatReEngageAt = 0;
          }
          instance.currentTargetId = targetMob.id;
          return { type: "attack", targetId: targetMob.id };
        }
        instance.currentTargetId = null;
        return this.moveTowardSpawn(instance, position);
      }

      if (stageType === "gather") {
        const resource = this.findResourceForQuest(
          nearbyResources,
          stageTarget,
        );
        if (resource) {
          const rdx = position[0] - resource.position[0];
          const rdz = position[2] - resource.position[2];
          const dist2d = Math.sqrt(rdx * rdx + rdz * rdz);

          if (dist2d < 4) {
            // Close enough — queue gather via PendingGatherManager.
            // Cooldown prevents re-queuing the same resource (which cancels the walk).
            const GATHER_REQUEUE_COOLDOWN = 30000;
            if (
              instance.lastGatherTargetId === resource.id &&
              Date.now() - instance.lastGatherQueuedAt < GATHER_REQUEUE_COOLDOWN
            ) {
              return { type: "idle" };
            }
            instance.lastGatherTargetId = resource.id;
            instance.lastGatherQueuedAt = Date.now();
            return { type: "gather", targetId: resource.id };
          }

          // Too far — move toward the resource
          return {
            type: "move",
            target: [resource.position[0], position[1], resource.position[2]],
            runMode: false,
          };
        }
        // No resources nearby — navigate toward known tree areas
        return this.moveTowardResourceArea(instance, position, stageTarget);
      }

      if (stageType === "interact") {
        // Interact stages: firemaking, cooking, smelting, etc.
        // Determine action based on target keyword
        if (stageTarget === "fire") {
          // Firemaking: need tinderbox + logs in inventory
          const inventory = instance.service.getInventoryItems();
          const hasTinderbox = inventory.some((i) => i.itemId === "tinderbox");
          const logTypes = [
            "logs",
            "oak_logs",
            "willow_logs",
            "teak_logs",
            "maple_logs",
          ];
          const logsItem = inventory.find((i) => logTypes.includes(i.itemId));

          if (hasTinderbox && logsItem) {
            return { type: "firemake", logsItemId: logsItem.itemId };
          }

          // No logs — need to gather some first. Find a nearby tree.
          const tree = this.findResourceForQuest(nearbyResources, "logs");
          if (tree) {
            const rdx = position[0] - tree.position[0];
            const rdz = position[2] - tree.position[2];
            const dist2d = Math.sqrt(rdx * rdx + rdz * rdz);
            if (dist2d < 4) {
              return { type: "gather", targetId: tree.id };
            }
            return {
              type: "move",
              target: [tree.position[0], position[1], tree.position[2]],
              runMode: false,
            };
          }
          // No trees nearby — move toward known tree areas
          return this.moveTowardResourceArea(instance, position, "logs");
        }

        // Other interact types (cooking, smelting) — fall through to combat for now
      }
    }

    return null;
  }

  /**
   * Find a mob for this agent's kill quest. Spreads agents across different
   * mobs so they don't all pile on the same one (only the killing blow
   * gets quest credit).
   */
  public findMobForQuest(
    agentId: string,
    nearbyMobs: NearbyEntityData[],
    stageTarget: string,
  ): NearbyEntityData | undefined {
    if (nearbyMobs.length === 0) return undefined;

    const target = stageTarget.toLowerCase();

    // Filter to mobs matching the quest target
    const matchingMobs = nearbyMobs.filter((m) => {
      const name = (m.name || "").toLowerCase();
      const mType = (m.mobType || "").toLowerCase();
      return (
        name.includes(target) ||
        mType.includes(target) ||
        target.includes(name) ||
        target.includes(mType)
      );
    });
    const candidates = matchingMobs.length > 0 ? matchingMobs : nearbyMobs;

    // Collect mob IDs already targeted by other agents
    const takenTargets = new Set<string>();
    for (const id of this.getAllAgentIds()) {
      if (id !== agentId) {
        const inst = this.getAgent(id);
        if (inst?.currentTargetId) {
          takenTargets.add(inst.currentTargetId);
        }
      }
    }

    // Prefer a mob nobody else is targeting
    const untargeted = candidates.find((m) => !takenTargets.has(m.id));
    if (untargeted) return untargeted;

    // All mobs are taken — pick the one with fewest agents on it
    const targetCounts = new Map<string, number>();
    for (const id of this.getAllAgentIds()) {
      if (id !== agentId) {
        const inst = this.getAgent(id);
        if (inst?.currentTargetId) {
          targetCounts.set(
            inst.currentTargetId,
            (targetCounts.get(inst.currentTargetId) || 0) + 1,
          );
        }
      }
    }
    candidates.sort(
      (a, b) => (targetCounts.get(a.id) || 0) - (targetCounts.get(b.id) || 0),
    );

    return candidates[0];
  }

  public findResourceForQuest(
    nearbyResources: NearbyEntityData[],
    stageTarget: string,
  ): NearbyEntityData | undefined {
    const keywords = this.getResourceKeywords(stageTarget);
    const matches = nearbyResources.filter((r) => {
      const haystack = `${(r.name || "").toLowerCase()} ${(r.resourceType || "").toLowerCase()} ${(r.resourceId || "").toLowerCase()}`;
      return keywords.some((kw) => haystack.includes(kw));
    });
    if (matches.length === 0) return undefined;

    // Prefer basic resources (level 1) — e.g. "Tree" over "Oak Tree" / "Maple Tree"
    // Basic resources have shorter names and lower IDs (tree_normal vs tree_oak)
    const basic = matches.find((r) => {
      const name = (r.name || "").toLowerCase();
      return (
        name === "tree" ||
        name === "rock" ||
        name === "fishing spot" ||
        (r.resourceId || "").includes("normal")
      );
    });
    if (basic) {
      return basic;
    }

    return [...matches].sort((a, b) => {
      const aLevel = this.getRequiredWoodcuttingLevel(a);
      const bLevel = this.getRequiredWoodcuttingLevel(b);
      if (aLevel !== bLevel) {
        return aLevel - bLevel;
      }
      return a.distance - b.distance;
    })[0];
  }

  public moveToNpcOrAccept(
    instance: AgentInstance,
    position: [number, number, number],
    questId: string,
    questStartNpc?: string,
  ): EmbeddedBehaviorAction {
    if (questStartNpc) {
      const npcPositions = instance.service.getAllNPCPositions();
      const npc = npcPositions.find(
        (n) =>
          n.npcId === questStartNpc ||
          n.name
            .toLowerCase()
            .includes(questStartNpc.replace(/_/g, " ").toLowerCase()),
      );
      if (npc) {
        const dx = position[0] - npc.position[0];
        const dz = position[2] - npc.position[2];
        if (Math.sqrt(dx * dx + dz * dz) > 6) {
          return { type: "move", target: npc.position, runMode: false };
        }
      }
    }
    return { type: "questAccept", questId };
  }

  public moveToNpcOrComplete(
    instance: AgentInstance,
    position: [number, number, number],
    activeQuest: AgentQuestProgress,
  ): EmbeddedBehaviorAction {
    const npcPositions = instance.service.getAllNPCPositions();
    const startNpc = activeQuest.startNpc;
    const npc = npcPositions.find(
      (n) =>
        n.npcId === startNpc ||
        n.name
          .toLowerCase()
          .includes(startNpc.replace(/_/g, " ").toLowerCase()),
    );
    if (npc) {
      const dx = position[0] - npc.position[0];
      const dz = position[2] - npc.position[2];
      if (Math.sqrt(dx * dx + dz * dz) > 6) {
        return { type: "move", target: npc.position, runMode: false };
      }
    }
    return { type: "questComplete", questId: activeQuest.questId };
  }

  /**
   * Navigate toward an area where the target resource might be found.
   */
  public moveTowardResourceArea(
    instance: AgentInstance,
    position: [number, number, number],
    stageTarget: string,
  ): EmbeddedBehaviorAction {
    const keywords = this.getResourceKeywords(stageTarget);
    const woodcuttingLevel =
      instance.service.getGameState()?.skills.woodcutting?.level ?? 1;
    const world = instance.service.getWorld();
    let bestPos: [number, number, number] | null = null;
    let bestDist = Infinity;
    let bestRequiredLevel = Infinity;

    for (const [, entity] of world.entities.items.entries()) {
      const data = (entity as { data?: Record<string, unknown> }).data;
      if (!data || data.depleted === true) continue;

      const haystack =
        `${String(data.name || "").toLowerCase()} ${String(data.resourceType || "").toLowerCase()} ${String(data.type || "").toLowerCase()}`.trim();
      if (!keywords.some((kw) => haystack.includes(kw))) continue;

      const looksLikeTree =
        haystack.includes("tree") ||
        haystack.includes("oak") ||
        haystack.includes("willow") ||
        haystack.includes("maple") ||
        haystack.includes("yew") ||
        haystack.includes("magic") ||
        haystack.includes("teak");
      const requiredLevel = this.getRequiredWoodcuttingLevelFromData(data);
      if (looksLikeTree && requiredLevel > woodcuttingLevel) {
        continue;
      }

      const entityPos = this.getWorldEntityPosition(
        entity as { position?: unknown; data?: Record<string, unknown> },
      );
      if (!entityPos) continue;

      const dx = position[0] - entityPos[0];
      const dz = position[2] - entityPos[2];
      const dist = Math.sqrt(dx * dx + dz * dz);
      if (
        requiredLevel < bestRequiredLevel ||
        (requiredLevel === bestRequiredLevel && dist < bestDist)
      ) {
        bestRequiredLevel = requiredLevel;
        bestDist = dist;
        bestPos = entityPos;
      }
    }

    if (bestPos) {
      return {
        type: "move",
        target: [bestPos[0], position[1], bestPos[2]],
        runMode: false,
      };
    }

    return this.moveTowardSpawn(instance, position);
  }

  /**
   * Determine the offensive prayer for an agent based on their equipped weapon type.
   * Falls back to superhuman_strength (melee) if role can't be inferred.
   */
  private getOffensivePrayerForAgent(instance: AgentInstance): string | null {
    const equipped = instance.service.getEquippedItems();
    const weapon = (equipped.weapon || "").toLowerCase();
    if (
      weapon.includes("staff") ||
      weapon.includes("wand") ||
      weapon.includes("orb")
    ) {
      return "mystic_lore";
    }
    if (
      weapon.includes("bow") ||
      weapon.includes("crossbow") ||
      weapon.includes("dart") ||
      weapon.includes("knife") ||
      weapon.includes("javelin") ||
      weapon.includes("ballista")
    ) {
      return "hawk_eye";
    }
    return "superhuman_strength";
  }

  /**
   * Default behavior: fight nearby mobs, or head back to spawn.
   */
  public pickCombatOrExplore(
    instance: AgentInstance,
    position: [number, number, number],
    nearbyMobs: NearbyEntityData[],
    nearbyResources: NearbyEntityData[],
    healthPercent: number,
  ): EmbeddedBehaviorAction {
    // Skip combat when an active quest needs a processing station and we
    // have the materials — walk past mobs instead of getting distracted.
    const questNav = this.tryQuestStationNavigation(instance, position);
    if (questNav) return questNav;

    if (nearbyMobs.length > 0 && healthPercent > 0.5) {
      const agentId = instance.service.getPlayerId() || "";
      const target = this.findMobForQuest(agentId, nearbyMobs, "goblin");
      const chosenTarget = target ?? nearbyMobs[0];
      if (chosenTarget) {
        // Switching target — reset prayer tracker so it activates on the new fight.
        if (instance.currentTargetId !== chosenTarget.id) {
          instance.combatPrayerActive = false;
          instance.lastCombatReEngageAt = 0;
        }
        instance.currentTargetId = chosenTarget.id;
        return { type: "attack", targetId: chosenTarget.id };
      }
    }
    if (nearbyResources.length > 0) {
      const target = nearbyResources[0];
      if (this.isActivelyGatheringResource(instance, target.id)) {
        return { type: "idle" };
      }

      const attemptedSameGatherRecently =
        instance.lastGatherTargetId === target.id &&
        Date.now() - instance.lastGatherQueuedAt <
          GATHER_STUCK_REPEAT_WINDOW_MS &&
        instance.lastGatherAttemptPosition !== null;
      const movedSinceLastGatherAttempt = attemptedSameGatherRecently
        ? Math.hypot(
            position[0] - instance.lastGatherAttemptPosition![0],
            position[2] - instance.lastGatherAttemptPosition![2],
          )
        : Number.POSITIVE_INFINITY;

      if (
        attemptedSameGatherRecently &&
        movedSinceLastGatherAttempt < GATHER_STUCK_MOVEMENT_THRESHOLD
      ) {
        instance.gatherBlacklistUntil.set(
          target.id,
          Date.now() + GATHER_BLACKLIST_MS,
        );
        instance.lastGatherTargetId = null;
        instance.lastGatherQueuedAt = 0;
        instance.lastGatherAttemptPosition = null;
        recordAgentThought(instance.config.characterId, {
          type: "evaluation",
          content: `Skipping ${target.name || target.resourceType || "a nearby resource"} for ${Math.round(GATHER_BLACKLIST_MS / 1000)}s because repeated gather attempts appear stuck.`,
          decisionPath: "scripted",
        });
        return this.moveTowardSpawn(instance, position);
      }

      instance.lastGatherTargetId = target.id;
      instance.lastGatherQueuedAt = Date.now();
      instance.lastGatherAttemptPosition = [...position];
      return { type: "gather", targetId: target.id };
    }
    return this.moveTowardSpawn(instance, position);
  }

  // ─── WORLD HELPERS ────────────────────────────────────────────────────

  /**
   * Find a gravestone belonging to this agent that's nearby.
   * Returns the gravestone entity data if found, null otherwise.
   */
  public findOwnGravestone(
    instance: AgentInstance,
    gameState: EmbeddedGameState,
  ): { id: string; position: [number, number, number] } | null {
    const playerId = instance.service.getPlayerId();
    if (!playerId) return null;

    // Scan nearby entities for gravestones (type "object" with name containing the player ID)
    for (const entity of gameState.nearbyEntities) {
      if (entity.type !== "object") continue;
      const name = (entity.name || "").toLowerCase();
      const id = entity.id || "";

      // Gravestone IDs are formatted as "gravestone_<playerId>_<timestamp>"
      if (id.includes("gravestone") && id.includes(playerId)) {
        return { id: entity.id, position: entity.position };
      }
      if (name.includes("gravestone") && name.includes(playerId)) {
        return { id: entity.id, position: entity.position };
      }
    }

    return null;
  }

  /**
   * Move the agent toward a dynamically discovered hub area (goblins/chest/bank).
   */
  public moveTowardSpawn(
    instance: AgentInstance,
    position: [number, number, number],
  ): EmbeddedBehaviorAction {
    const [px, , pz] = position;
    const world = instance.service.getWorld();
    let anchor: [number, number, number] | null = null;
    let anchorDist = Infinity;

    for (const [, entity] of world.entities.items.entries()) {
      const data = (entity as { data?: Record<string, unknown> }).data;
      if (!data) continue;
      const name = String(data.name || "").toLowerCase();
      const isAnchor =
        name.includes("starter chest") ||
        name.includes("goblin") ||
        name.includes("bank") ||
        name.includes("spawn") ||
        name.includes("start");
      if (!isAnchor) continue;

      const entityPos = this.getWorldEntityPosition(
        entity as { position?: unknown; data?: Record<string, unknown> },
      );
      if (!entityPos) continue;

      const dx = entityPos[0] - px;
      const dz = entityPos[2] - pz;
      const dist = Math.sqrt(dx * dx + dz * dz);
      if (dist < anchorDist) {
        anchorDist = dist;
        anchor = entityPos;
      }
    }

    if (anchor && anchorDist > 25) {
      const angle =
        Math.atan2(anchor[2] - pz, anchor[0] - px) +
        (Math.random() - 0.5) * 0.4;
      const step = Math.min(20, Math.max(10, anchorDist * 0.4));
      return {
        type: "move",
        target: [
          px + Math.cos(angle) * step,
          position[1],
          pz + Math.sin(angle) * step,
        ] as [number, number, number],
        runMode: false,
      };
    }

    if (anchor) {
      return {
        type: "move",
        target: this.getRandomNearbyTarget(
          [anchor[0], position[1], anchor[2]],
          8,
          18,
        ),
        runMode: false,
      };
    }

    return {
      type: "move",
      target: this.getRandomNearbyTarget(position, 8, 18),
      runMode: false,
    };
  }

  public getWorldEntityPosition(entity: {
    position?: unknown;
    data?: Record<string, unknown>;
  }): [number, number, number] | null {
    const directPos = entity.position;
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

    const dataPos = entity.data?.position;
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

  private getRequiredWoodcuttingLevel(entity: NearbyEntityData): number {
    return this.getRequiredWoodcuttingLevelFromText(
      `${entity.name || ""} ${entity.resourceType || ""} ${entity.resourceId || ""}`,
    );
  }

  private getRequiredWoodcuttingLevelFromData(
    data: Record<string, unknown>,
  ): number {
    return this.getRequiredWoodcuttingLevelFromText(
      `${String(data.name || "")} ${String(data.resourceType || "")} ${String(data.type || "")}`,
    );
  }

  private getRequiredWoodcuttingLevelFromText(text: string): number {
    const normalized = text.toLowerCase();
    if (normalized.includes("magic")) return 75;
    if (normalized.includes("yew")) return 60;
    if (normalized.includes("maple")) return 45;
    if (normalized.includes("teak")) return 35;
    if (normalized.includes("willow")) return 30;
    if (normalized.includes("oak")) return 15;
    return 1;
  }

  private isActivelyGatheringResource(
    instance: AgentInstance,
    resourceId: string,
  ): boolean {
    return (
      instance.lastGatherTargetId === resourceId &&
      Date.now() - instance.lastGatherQueuedAt < 30_000
    );
  }

  /**
   * Map quest gather targets to resource keywords that match world entities.
   * Quest targets use item IDs (e.g., "logs", "raw_shrimp", "copper_ore")
   * but world resources use different names (e.g., "tree", "fishing_spot", "rock").
   */
  public getResourceKeywords(stageTarget: string): string[] {
    const target = stageTarget.toLowerCase();
    const keywords = [target];

    if (target.includes("log") || target.includes("wood")) {
      keywords.push("tree", "oak", "willow", "maple", "yew");
    }
    if (
      target.includes("shrimp") ||
      target.includes("fish") ||
      target.includes("trout") ||
      target.includes("salmon")
    ) {
      keywords.push("fishing", "spot", "fishing_spot");
    }
    if (
      target.includes("ore") ||
      target.includes("copper") ||
      target.includes("tin") ||
      target.includes("iron") ||
      target.includes("coal")
    ) {
      keywords.push("rock", "ore", "mining");
    }
    if (target.includes("essence")) {
      keywords.push("essence", "rune", "altar");
    }

    return keywords;
  }

  /**
   * Choose a random nearby movement target.
   */
  public getRandomNearbyTarget(
    origin: [number, number, number],
    minDistance: number,
    maxDistance: number,
  ): [number, number, number] {
    const angle = Math.random() * Math.PI * 2;
    const distance = minDistance + Math.random() * (maxDistance - minDistance);
    const x = origin[0] + Math.cos(angle) * distance;
    const z = origin[2] + Math.sin(angle) * distance;

    // Keep current Y to avoid abrupt vertical jumps.
    return [x, origin[1], z];
  }

  // ─── COMBAT CHAT ──────────────────────────────────────────────────────

  /**
   * Handle combat damage events to queue chat reactions for agents.
   * Should be called from the AgentManager's EventType.COMBAT_DAMAGE_DEALT listener.
   */
  public handleCombatDamageDealt(data: unknown): void {
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
      // Check if this was a critical hit dealt
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
        // Agent dealt a critical hit
        if (now - attackerInstance.lastCombatChatAt > COMBAT_CHAT_COOLDOWN) {
          attackerInstance.pendingChatReaction = {
            type: "critical_hit_dealt",
            opponentName: targetData.name || "opponent",
            timestamp: now,
          };
        }
      }

      // Check if target is near death (victory imminent)
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

      // Check if this was a critical hit taken
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

      // Check if agent is near death
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

  /**
   * Get a scripted chat response for a combat reaction
   */
  public getCombatChatResponse(reaction: PendingChatReaction): string {
    const responses: Record<CombatChatReactionType, string[]> = {
      critical_hit_dealt: [
        "That's gonna leave a mark!",
        "Feel the power!",
        "You're going down!",
        "How'd you like that one?",
        "Boom! Direct hit!",
      ],
      critical_hit_taken: [
        "Ouch! Lucky shot!",
        "Is that all you got?",
        "This isn't over!",
        "You'll pay for that!",
        "Okay, now I'm mad!",
      ],
      near_death: [
        "I'm not done yet!",
        "Come on, one more hit...",
        "Getting dangerous...",
        "This is intense!",
        "Need to focus...",
      ],
      victory_imminent: [
        "Time to finish this!",
        "Any last words?",
        "GG!",
        "Victory is mine!",
        "Almost there!",
      ],
    };

    const options = responses[reaction.type];
    return options[Math.floor(Math.random() * options.length)];
  }
}
