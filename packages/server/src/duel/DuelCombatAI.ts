/**
 * DuelCombatAI - Tick-based PvP combat controller for embedded agents
 *
 * Takes over an agent's behavior during arena duels. Uses
 * EmbeddedHyperscapeService directly for game actions (executeAttack,
 * executeUse). Reads game state each tick and makes priority-based
 * combat decisions: heal, attack, or switch style.
 *
 * Lifecycle:
 *   DuelOrchestrator creates DuelCombatAI when a duel starts.
 *   DuelCombatAI.start() begins ticking at COMBAT_TICK_MS (600ms).
 *   DuelOrchestrator calls DuelCombatAI.stop() when the duel ends.
 */

import { TICK_DURATION_MS } from "@hyperscape/shared";
import type { EmbeddedHyperscapeService } from "../eliza/EmbeddedHyperscapeService";
import type { EmbeddedGameState } from "../eliza/types";
import { type AgentRuntime, ModelType } from "@elizaos/core";
import { errMsg } from "../shared/errMsg";
import { duelLogDebug, duelLogInfo } from "../eliza/logging.js";

export interface DuelCombatConfig {
  healThresholdPct: number;
  aggressiveThresholdPct: number;
  defensiveThresholdPct: number;
  maxTicksWithoutAttack: number;
  useLlmTactics: boolean;
  combatRole: "melee" | "ranged" | "mage" | "prayer";
  /** When true (duel rule), skip all food use */
  noFood?: boolean;
  /** Clamp movement targets to arena floor (world XZ) */
  movementClampBounds?: {
    minX: number;
    maxX: number;
    minZ: number;
    maxZ: number;
  };
  /**
   * Initial strafe direction for this agent. Pass opposite signs (+1/-1) for the
   * two combatants so they orbit in opposite directions and don't converge on the
   * same standoff point.
   */
  initialStrafeSign?: 1 | -1;
}

const DEFAULT_CONFIG: DuelCombatConfig = {
  healThresholdPct: 40,
  aggressiveThresholdPct: 70,
  defensiveThresholdPct: 30,
  maxTicksWithoutAttack: 5,
  useLlmTactics: false,
  combatRole: "melee",
  noFood: false,
};

/** Health percentage thresholds that trigger trash talk events. */
const TRASH_TALK_THRESHOLDS = [90, 80, 70, 60, 50, 40, 30, 20, 10] as const;

/** Minimum milliseconds between trash talk LLM calls. */
const TRASH_TALK_COOLDOWN_MS = 4_000;

/** Hard timeout for a single trash talk LLM call — abandon after this. */
const TRASH_TALK_TIMEOUT_MS = 4_000;

/** Ambient trash talk fires randomly every 5-12 ticks. */
const AMBIENT_TAUNT_MIN_TICKS = 5;
const AMBIENT_TAUNT_MAX_TICKS = 12;

/** Scripted fallback taunts when no LLM runtime is available. */
const FALLBACK_TAUNTS_OWN_LOW = [
  "Not even close!",
  "I've had worse",
  "Is that all?",
  "Still standing",
  "Come on then!",
  "You call that damage?",
  "Barely a scratch",
  "Try harder",
];

const FALLBACK_TAUNTS_OPPONENT_LOW = [
  "GG soon",
  "You're done!",
  "Sit down",
  "One more hit...",
  "Almost there!",
  "Easy money",
  "Lights out",
  "Get rekt",
];

const FALLBACK_TAUNTS_AMBIENT = [
  "Let's go!",
  "Fight me!",
  "Too slow",
  "Bring it",
  "Nice try lol",
  "*yawns*",
  "Is this PvP?",
  "Warming up",
  "You're trash",
  "Catch these hands",
];

/** Opening taunts fired at the very start of a duel. */
const FALLBACK_TAUNTS_OPENING = [
  "You're going down",
  "Let's dance",
  "Ready to lose?",
  "This won't take long",
  "Easy fight",
  "Hope you said bye",
  "Prepare yourself",
  "No mercy",
];

type CombatPhase = "opening" | "trading" | "finishing" | "desperate";

/** Role-based offensive prayers that actually exist in the prayer manifest. */
const OFFENSIVE_PRAYER: Record<string, string> = {
  melee: "superhuman_strength",
  ranged: "hawk_eye",
  mage: "mystic_lore",
};
const DEFENSIVE_PRAYER = "rock_skin";

export interface CombatStrategy {
  approach: "aggressive" | "defensive" | "balanced" | "outlast";
  attackStyle: string;
  prayer: string | null;
  protectionPrayer: string | null;
  foodThreshold: number;
  switchDefensiveAt: number;
  reasoning: string;
}

const DEFAULT_STRATEGY: CombatStrategy = {
  approach: "balanced",
  attackStyle: "aggressive",
  prayer: "superhuman_strength",
  protectionPrayer: null,
  foodThreshold: 40,
  switchDefensiveAt: 30,
  reasoning: "Default balanced strategy",
};

const MIN_REPLAN_INTERVAL_MS = 4000;

/** Maximum time to wait for an LLM response before giving up */
const LLM_TIMEOUT_MS = 3000;

const FOOD_DATA: Record<string, number> = {
  shrimp: 3,
  bread: 5,
  meat: 3,
  trout: 7,
  salmon: 9,
  tuna: 10,
  lobster: 12,
  bass: 13,
  swordfish: 14,
  monkfish: 16,
  karambwan: 18,
  shark: 20,
  manta: 22,
  anglerfish: 22,
  pie: 6,
  cake: 12,
  stew: 11,
  potato: 14,
  cooked: 5,
  fish: 5,
};

const FOOD_KEYS = Object.keys(FOOD_DATA);
const FOOD_ENTRIES = Object.entries(FOOD_DATA);

const POTION_PATTERNS = [
  "potion",
  "brew",
  "restore",
  "prayer",
  "super",
  "ranging",
  "magic",
  "antifire",
  "antidote",
  "stamina",
];

export class DuelCombatAI {
  private service: EmbeddedHyperscapeService;
  private runtime: AgentRuntime | null;
  private opponentId: string;
  private config: DuelCombatConfig;

  private isRunning = false;
  private tickCount = 0;
  private lastHealthPct = 100;
  private opponentLastHealthPct = 100;
  private totalDamageDealt = 0;
  private totalDamageReceived = 0;
  private healsUsed = 0;
  private attacksLanded = 0;
  private activePrayers: Set<string> = new Set();
  private currentStyle: string = "accurate";
  private strategy: CombatStrategy = { ...DEFAULT_STRATEGY };
  private lastReplanTime = 0;
  private lastReplanHealthPct = 100;
  private strategyPlanned = false;
  private opponentCombatLevel = 0;
  private agentName = "";
  private opponentName = "";

  /** Tracks the last time food was used to simulate eating cooldown */
  private lastFoodUseTime = 0;

  /** Prevents overlapping ticks from piling up */
  private _tickInProgress = false;

  /** Whether a background LLM planning call is in flight */
  private _llmPlanningInFlight = false;

  // ── Trash talk state ──
  /** Callback to send a chat message above this agent's head. */
  private sendChat: ((text: string) => void) | null = null;
  /** Own-HP thresholds that have already fired. */
  private firedOwnThresholds: Set<number> = new Set();
  /** Opponent-HP thresholds that have already fired. */
  private firedOpponentThresholds: Set<number> = new Set();
  /** Timestamp of the last trash talk LLM call. */
  private lastTrashTalkTime = 0;
  /** Whether a background trash talk LLM call is in flight. */
  private _trashTalkInFlight = false;
  /** Next tick count when an ambient taunt is eligible. */
  private nextAmbientTauntTick = 0;
  /** Tick count of last executeAttack call (for periodic keep-alive re-engagement). */
  private _lastEngageTick = 0;
  /** How often (in ticks) to force re-engagement as a keep-alive. */
  private static readonly RE_ENGAGE_INTERVAL = 5;
  /** Reusable OpponentData object to avoid per-tick allocations */
  private _cachedOpponentData: OpponentData = {
    health: 0,
    maxHealth: 0,
    distance: 0,
    equippedWeapon: undefined,
    position: null,
  };

  /** Movement AI: last time a move action was issued */
  private lastMoveTime = 0;
  /** Lateral strafe direction (+1 / -1), flipped occasionally for variety */
  private strafeSign: 1 | -1 = 1;
  private strafeMoveCount = 0;
  /** Log once per fight when food is expected but inventory has none */
  private warnedNoFood = false;
  /** Movement AI cooldown (ms) — longer = more deliberate, less jittery */
  private static readonly MOVE_COOLDOWN_MS = 1800;
  /** Perpendicular offset magnitude (world units) when strafing during reposition */
  private static readonly STRAFE_STEP = 0.85;
  /**
   * Ideal engagement ranges (world-space meters, center-to-center).
   * Wider bands = agents settle into range and stay there instead of constantly
   * overshooting and correcting. Melee min prevents capsule overlap; melee max
   * gives a comfortable melee "ring" where both fighters look engaged.
   */
  private static readonly IDEAL_RANGE: Record<
    string,
    { min: number; max: number }
  > = {
    melee: { min: 1.5, max: 3.0 },
    ranged: { min: 5, max: 8 },
    mage: { min: 5, max: 8 },
  };

  /** Track last phase for change detection (#7) */
  private lastPhase: CombatPhase = "opening";

  constructor(
    service: EmbeddedHyperscapeService,
    opponentId: string,
    config?: Partial<DuelCombatConfig>,
    runtime?: AgentRuntime,
    sendChat?: (text: string) => void,
  ) {
    this.service = service;
    this.opponentId = opponentId;
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.runtime = runtime ?? null;
    this.sendChat = sendChat ?? null;
    if (config?.initialStrafeSign !== undefined) {
      this.strafeSign = config.initialStrafeSign;
    }
  }

  setContext(
    agentName: string,
    opponentCombatLevel: number,
    opponentName?: string,
  ): void {
    this.agentName = agentName;
    this.opponentCombatLevel = opponentCombatLevel;
    this.opponentName = opponentName || "";
  }

  start(): void {
    if (this.isRunning) return;
    this.isRunning = true;
    this.tickCount = 0;
    this.totalDamageDealt = 0;
    this.totalDamageReceived = 0;
    this.healsUsed = 0;
    this.attacksLanded = 0;
    this.strategyPlanned = false;
    this.lastReplanTime = 0;
    this.lastReplanHealthPct = 100;
    this.lastFoodUseTime = 0;
    this.lastMoveTime = 0;
    this.lastPhase = "opening";
    this.strafeSign =
      this.config.initialStrafeSign ?? (Math.random() < 0.5 ? 1 : -1);
    this.strafeMoveCount = 0;
    this.warnedNoFood = false;
    // Set default strategy prayer based on combat role
    this.strategy = {
      ...DEFAULT_STRATEGY,
      prayer: OFFENSIVE_PRAYER[this.config.combatRole] ?? "superhuman_strength",
    };

    // Reset trash talk state for new fight
    this.firedOwnThresholds.clear();
    this.firedOpponentThresholds.clear();
    this.lastTrashTalkTime = 0;
    this._trashTalkInFlight = false;
    this.nextAmbientTauntTick =
      AMBIENT_TAUNT_MIN_TICKS +
      Math.floor(
        Math.random() * (AMBIENT_TAUNT_MAX_TICKS - AMBIENT_TAUNT_MIN_TICKS),
      );

    duelLogInfo("DuelCombatAI", `Started combat against ${this.opponentId}`);

    // Fire an opening taunt immediately when the fight starts
    this.fireTrashTalk(
      "opening",
      `The duel has just begun! Taunt your opponent ${this.opponentName || ""} with an opening line.`,
      100,
      null,
    );
  }

  stop(): void {
    if (!this.isRunning) return;
    this.isRunning = false;

    duelLogInfo(
      "DuelCombatAI",
      `Stopped after ${this.tickCount} ticks. ` +
        `Attacks: ${this.attacksLanded}, Heals: ${this.healsUsed}, ` +
        `Dmg dealt: ${this.totalDamageDealt}, Dmg received: ${this.totalDamageReceived}`,
    );
  }

  /**
   * Drive a single AI tick. Called externally by StreamingDuelScheduler's
   * combat loop to stay synchronized with the game tick instead of using
   * an independent setInterval.
   */
  async externalTick(): Promise<void> {
    if (!this.isRunning) return;
    // Prevent tick accumulation: skip if previous tick is still executing
    if (this._tickInProgress) return;
    this._tickInProgress = true;
    try {
      await this.tick();
    } finally {
      this._tickInProgress = false;
    }
  }

  getStats(): {
    tickCount: number;
    attacksLanded: number;
    healsUsed: number;
    totalDamageDealt: number;
    totalDamageReceived: number;
  } {
    return {
      tickCount: this.tickCount,
      attacksLanded: this.attacksLanded,
      healsUsed: this.healsUsed,
      totalDamageDealt: this.totalDamageDealt,
      totalDamageReceived: this.totalDamageReceived,
    };
  }

  private async tick(): Promise<void> {
    if (!this.isRunning) return;
    this.tickCount++;

    // 1. Get state, check alive
    const state = this.service.getGameState();
    if (!state) return;
    if (!state.alive) {
      this.stop();
      return;
    }

    // 2. Sync prayers from entity state (#2 prayer reconciliation)
    this.activePrayers.clear();
    if (state.activePrayers) {
      for (const p of state.activePrayers) this.activePrayers.add(p);
    }

    // 3. HP tracking, damage deltas
    const healthPct =
      state.maxHealth > 0 ? (state.health / state.maxHealth) * 100 : 100;

    const prevHealthPct = this.lastHealthPct;
    const prevOpponentHealthPct = this.opponentLastHealthPct;

    const damageThisTickPct = this.lastHealthPct - healthPct;
    if (damageThisTickPct > 0) {
      this.totalDamageReceived += Math.round(
        (damageThisTickPct / 100) * state.maxHealth,
      );
    }
    this.lastHealthPct = healthPct;

    // 4. Get opponent data (+ position for movement AI)
    const opponentData = this.getOpponentData(state);
    if (opponentData) {
      const oppHealthPct =
        opponentData.maxHealth && opponentData.maxHealth > 0
          ? (opponentData.health / opponentData.maxHealth) * 100
          : 100;
      const oppDamage = this.opponentLastHealthPct - oppHealthPct;
      if (oppDamage > 0 && opponentData.maxHealth) {
        this.totalDamageDealt += Math.round(
          (oppDamage / 100) * opponentData.maxHealth,
        );
      }
      this.opponentLastHealthPct = oppHealthPct;
    }

    // 5. Determine phase + detect phase change (#7)
    const phase = this.determineCombatPhase(healthPct, opponentData);
    const phaseChanged = phase !== this.lastPhase;
    this.lastPhase = phase;

    // 5b. Protection prayer — activate based on opponent's visible weapon type.
    // Fires every tick; activatePrayer no-ops if already active.
    if (opponentData) {
      this.maybeActivateProtectionPrayer(opponentData).catch(() => {});
    }

    // 6. Trash talk (fire-and-forget, never blocks tick)
    this.checkHealthMilestones(
      healthPct,
      prevHealthPct,
      opponentData,
      prevOpponentHealthPct,
    );
    this.maybeAmbientTrashTalk(healthPct, opponentData);

    // 7. tryHeal (context-aware #4, finishing adjustment #10, burst-reactive)
    if (
      await this.tryHeal(
        state,
        healthPct,
        phase,
        opponentData,
        damageThisTickPct,
      )
    ) {
      this.healsUsed++;
      return;
    }

    // 8. tryBuff (+ prayer activation at fight start #16)
    if (await this.tryBuff(state, phase)) {
      return;
    }

    // 9. Movement AI - kite/chase by role (#1, #5, #17)
    this.movementTick(state, opponentData, Date.now(), phase);

    // 10. Strategy/prayer/style (correct IDs, faster switching, faster replan)
    if (this.config.useLlmTactics && this.runtime) {
      this.maybeReplanStrategyBackground(
        state,
        healthPct,
        opponentData,
        phase,
        phaseChanged,
      );
      await this.executeStrategy(healthPct, phase, phaseChanged);
    } else {
      await this.tryPrayerSwitch(phase, phaseChanged);
      await this.tryStyleSwitch(healthPct, phase, phaseChanged);
    }

    // 11. tryAttack
    await this.tryAttack(state, phase);
  }

  private determineCombatPhase(
    healthPct: number,
    opponentData: OpponentData | null,
  ): CombatPhase {
    if (healthPct < this.config.defensiveThresholdPct) return "desperate";

    const oppHealthPct = opponentData
      ? opponentData.maxHealth && opponentData.maxHealth > 0
        ? (opponentData.health / opponentData.maxHealth) * 100
        : 100
      : 100;

    if (oppHealthPct < 25) return "finishing";
    if (this.tickCount < 5) return "opening";
    return "trading";
  }

  /**
   * Attempt to heal. Returns true if a heal action was taken.
   * Context-aware: skips healing when dominating (#4).
   * Finishing phase: lower threshold for aggression (#10).
   */
  private async tryHeal(
    state: EmbeddedGameState,
    healthPct: number,
    phase: CombatPhase,
    opponentData?: OpponentData | null,
    damageThisTickPct = 0,
  ): Promise<boolean> {
    if (this.config.noFood === true) return false;

    const baseThreshold = this.config.useLlmTactics
      ? this.strategy.foodThreshold
      : this.config.healThresholdPct;
    const burstEase =
      damageThisTickPct >= 12 ? 18 : damageThisTickPct >= 7 ? 10 : 0;
    let threshold =
      phase === "desperate"
        ? baseThreshold + 15
        : phase === "finishing"
          ? Math.max(15, baseThreshold - 10)
          : baseThreshold;
    threshold = Math.max(10, threshold - burstEase);

    // Prefer not to eat in melee unless desperate (buys a beat to reposition)
    if (phase !== "desperate" && opponentData && opponentData.distance < 2.2) {
      threshold = Math.min(95, threshold + 12);
    }

    if (healthPct >= threshold) return false;

    // Context-aware: skip healing when dominating opponent (#4)
    if (phase !== "desperate" && healthPct > 25 && opponentData) {
      const oppPct =
        opponentData.maxHealth > 0
          ? (opponentData.health / Math.max(1, opponentData.maxHealth)) * 100
          : 50;
      if (healthPct - oppPct >= 30) return false;
    }

    // 1800ms cooldown (3 ticks) to prevent spamming food
    const now = Date.now();
    if (now - this.lastFoodUseTime < 1800) return false;

    const food = this.findBestFood(state.inventory);
    if (!food) {
      if (!this.warnedNoFood && healthPct < 50 && phase !== "opening") {
        this.warnedNoFood = true;
        duelLogDebug(
          "DuelCombatAI",
          `No edible food in inventory at ${healthPct.toFixed(0)}% HP (agent=${this.agentName || this.opponentId})`,
        );
      }
      return false;
    }

    try {
      await this.service.executeUse(food.itemId);
      this.lastFoodUseTime = Date.now();
      return true;
    } catch (err) {
      duelLogDebug(
        "DuelCombatAI",
        `Heal failed (${food.itemId}):`,
        errMsg(err),
      );
      return false;
    }
  }

  /**
   * Attempt to use a buff potion and activate offensive prayer. Returns true if used.
   * (#16) Activates role-appropriate offensive prayer at fight start.
   */
  private async tryBuff(
    state: EmbeddedGameState,
    phase: CombatPhase,
  ): Promise<boolean> {
    if (phase !== "opening" || this.tickCount > 2) return false;

    // Activate offensive prayer at fight start (#16)
    const offPrayer = OFFENSIVE_PRAYER[this.config.combatRole];
    if (offPrayer) {
      await this.activatePrayer(offPrayer);
    }

    const potion = this.findPotion(state.inventory);
    if (!potion) return false;

    try {
      await this.service.executeUse(potion.itemId);
      return true;
    } catch (err) {
      duelLogDebug(
        "DuelCombatAI",
        `Buff failed (${potion.itemId}):`,
        errMsg(err),
      );
      return false;
    }
  }

  /**
   * Check if conditions warrant replanning the combat strategy.
   * Fires planning in the background — NEVER blocks the tick loop.
   * (#8) Faster replanning: 4s interval, force replan on phase transitions.
   */
  private maybeReplanStrategyBackground(
    state: EmbeddedGameState,
    healthPct: number,
    opponentData: OpponentData | null,
    phase: CombatPhase,
    forceReplan = false,
  ): void {
    // Don't queue another LLM call while one is in flight
    if (this._llmPlanningInFlight) return;

    const now = Date.now();
    if (
      !forceReplan &&
      now - this.lastReplanTime < MIN_REPLAN_INTERVAL_MS &&
      this.strategyPlanned
    )
      return;

    const needsReplan =
      forceReplan ||
      !this.strategyPlanned ||
      Math.abs(healthPct - this.lastReplanHealthPct) > 20 ||
      (opponentData &&
        opponentData.maxHealth > 0 &&
        (opponentData.health / opponentData.maxHealth) * 100 < 25 &&
        this.strategy.approach !== "aggressive") ||
      (phase === "desperate" &&
        this.strategy.approach !== "defensive" &&
        this.strategy.approach !== "outlast");

    if (!needsReplan) return;

    // Fire in background — tick continues immediately
    this._llmPlanningInFlight = true;
    this.planStrategy(state, healthPct, opponentData)
      .then(() => {
        this.lastReplanTime = Date.now();
        this.lastReplanHealthPct = healthPct;
        this.strategyPlanned = true;
      })
      .catch((err) => {
        duelLogDebug(
          "DuelCombatAI",
          "Background strategy planning failed:",
          err instanceof Error ? err.message : String(err),
        );
      })
      .finally(() => {
        this._llmPlanningInFlight = false;
      });
  }

  /**
   * Ask the LLM for a full combat strategy. Called at fight start
   * and when significant conditions change.
   */
  private async planStrategy(
    state: EmbeddedGameState,
    healthPct: number,
    opponentData: OpponentData | null,
  ): Promise<void> {
    if (!this.runtime) return;

    const oppHpPct =
      opponentData && opponentData.maxHealth > 0
        ? ((opponentData.health / opponentData.maxHealth) * 100).toFixed(0)
        : "unknown";

    const foodCount = state.inventory.filter((i) => {
      const n = (i.itemId || "").toLowerCase();
      return FOOD_KEYS.some((k) => n.includes(k));
    }).length;

    const prompt = [
      `You are ${this.agentName || "an agent"} in a PvP duel arena. Plan your combat strategy.`,
      ``,
      `YOUR STATE: HP ${healthPct.toFixed(0)}%, ${foodCount} food, tick ${this.tickCount}`,
      `OPPONENT: HP ${oppHpPct}%, combat level ${this.opponentCombatLevel || "unknown"}`,
      `DAMAGE SO FAR: dealt ${this.totalDamageDealt}, received ${this.totalDamageReceived}`,
      ``,
      `Available prayers: superhuman_strength (+10% str), rock_skin (+10% def), hawk_eye (+10% ranged), mystic_lore (+10% magic)`,
      `Available styles: aggressive (max damage), defensive (less damage taken), controlled (balanced), accurate (hit more often)`,
      ``,
      `Respond with a JSON object:`,
      `{`,
      `  "approach": "aggressive" | "defensive" | "balanced" | "outlast",`,
      `  "attackStyle": "aggressive" | "defensive" | "controlled" | "accurate",`,
      `  "prayer": "superhuman_strength" | "rock_skin" | "hawk_eye" | "mystic_lore" | null,`,
      `  "foodThreshold": 20-60 (HP% to eat at, lower = riskier),`,
      `  "switchDefensiveAt": 20-40 (HP% to go defensive),`,
      `  "reasoning": "brief explanation"`,
      `}`,
    ].join("\n");

    try {
      // Race LLM call against a timeout to prevent indefinite blocking
      const llmPromise = this.runtime.useModel(ModelType.TEXT_SMALL, {
        prompt,
        maxTokens: 200,
        temperature: 0.4,
      });
      let timerId: ReturnType<typeof setTimeout>;
      const timeoutPromise = new Promise<never>((_, reject) => {
        timerId = setTimeout(
          () => reject(new Error("LLM strategy timeout")),
          LLM_TIMEOUT_MS,
        );
      });
      let response: Awaited<typeof llmPromise>;
      try {
        response = await Promise.race([llmPromise, timeoutPromise]);
      } finally {
        clearTimeout(timerId!);
      }

      const text = typeof response === "string" ? response : "";
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]) as Partial<CombatStrategy>;
        this.strategy = {
          approach: parsed.approach || this.strategy.approach,
          attackStyle: parsed.attackStyle || this.strategy.attackStyle,
          prayer:
            parsed.prayer !== undefined ? parsed.prayer : this.strategy.prayer,
          protectionPrayer: parsed.protectionPrayer || null,
          foodThreshold:
            typeof parsed.foodThreshold === "number"
              ? Math.max(15, Math.min(65, parsed.foodThreshold))
              : this.strategy.foodThreshold,
          switchDefensiveAt:
            typeof parsed.switchDefensiveAt === "number"
              ? Math.max(15, Math.min(45, parsed.switchDefensiveAt))
              : this.strategy.switchDefensiveAt,
          reasoning: parsed.reasoning || "",
        };
        duelLogDebug(
          "DuelCombatAI",
          `Strategy planned: ${this.strategy.approach}, style=${this.strategy.attackStyle}, prayer=${this.strategy.prayer}, eat@${this.strategy.foodThreshold}%`,
        );
      }
    } catch (err) {
      duelLogDebug(
        "DuelCombatAI",
        "Strategy planning failed, keeping current:",
        errMsg(err),
      );
    }
  }

  /**
   * Execute the current strategy -- set prayer and style as directed.
   * Called every tick. Only changes state if it differs from current.
   * (#3) All roles switch to defensive when desperate (not just melee).
   * (#7) Faster switching on phase change.
   */
  private async executeStrategy(
    healthPct: number,
    phase: CombatPhase,
    phaseChanged = false,
  ): Promise<void> {
    const offPrayer =
      OFFENSIVE_PRAYER[this.config.combatRole] ?? "superhuman_strength";

    // Override strategy for desperate situations — all roles (#3)
    if (phase === "desperate" || healthPct < this.strategy.switchDefensiveAt) {
      await this.activatePrayer(
        this.strategy.protectionPrayer || DEFENSIVE_PRAYER,
      );
      await this.deactivatePrayer(offPrayer);
      if (
        this.currentStyle !== "defensive" &&
        this.config.combatRole !== "mage"
      ) {
        try {
          await this.service.executeChangeStyle("defensive");
          this.currentStyle = "defensive";
        } catch (err) {
          duelLogDebug("DuelCombatAI", "Style switch failed:", errMsg(err));
        }
      }
      return;
    }

    // Apply strategy prayer (all roles benefit from prayers)
    if (this.strategy.prayer) {
      await this.activatePrayer(this.strategy.prayer);
    }

    // Mage agents skip style switching — magic auto-casts via selectedSpell
    if (this.config.combatRole === "mage") return;

    // Apply strategy style — faster switching (#7): modulo 2, immediate on phase change
    const desiredStyle =
      this.config.combatRole === "ranged"
        ? "rapid"
        : this.strategy.attackStyle || "aggressive";
    if (
      desiredStyle !== this.currentStyle &&
      (phaseChanged || this.tickCount % 2 === 0)
    ) {
      try {
        await this.service.executeChangeStyle(desiredStyle);
        this.currentStyle = desiredStyle;
      } catch (err) {
        duelLogDebug("DuelCombatAI", "Style switch failed:", errMsg(err));
      }
    }
  }

  /**
   * Toggle combat prayers based on phase.
   * Opening: activate offensive prayer. Desperate: switch to defensive.
   */
  private async activatePrayer(prayerId: string): Promise<void> {
    if (this.activePrayers.has(prayerId)) return;
    const success = await this.service.executePrayerToggle(prayerId);
    if (success) this.activePrayers.add(prayerId);
  }

  private async deactivatePrayer(prayerId: string): Promise<void> {
    if (!this.activePrayers.has(prayerId)) return;
    const success = await this.service.executePrayerToggle(prayerId);
    if (success) this.activePrayers.delete(prayerId);
  }

  /**
   * Detect the likely attack type of an opponent from their equipped weapon ID.
   * Used to decide which protection prayer to activate.
   */
  private detectOpponentAttackType(
    weapon: string | undefined,
  ): "melee" | "ranged" | "magic" | null {
    if (!weapon) return null;
    const w = weapon.toLowerCase();
    if (
      w.includes("staff") ||
      w.includes("wand") ||
      w.includes("battlestaff") ||
      w.includes("mystic")
    )
      return "magic";
    if (
      w.includes("bow") ||
      w.includes("crossbow") ||
      w.includes("ballista") ||
      w.includes("blowpipe")
    )
      return "ranged";
    return "melee";
  }

  /**
   * Activate the appropriate protection prayer based on what the opponent is wielding.
   * Only activates — never deactivates — so it stacks with offensive prayers.
   * Runs every tick but `activatePrayer` no-ops if the prayer is already active.
   */
  private async maybeActivateProtectionPrayer(
    opponentData: OpponentData,
  ): Promise<void> {
    const attackType = this.detectOpponentAttackType(
      opponentData.equippedWeapon,
    );
    if (!attackType) return;
    const prayerMap: Record<string, string> = {
      melee: "protect_from_melee",
      ranged: "protect_from_missiles",
      magic: "protect_from_magic",
    };
    const protPrayer = prayerMap[attackType];
    if (protPrayer) {
      await this.activatePrayer(protPrayer);
    }
  }

  private async tryPrayerSwitch(
    phase: CombatPhase,
    phaseChanged = false,
  ): Promise<void> {
    // Faster switching (#7): every 2 ticks, immediate on phase change
    if (!phaseChanged && this.tickCount % 2 !== 0) return;

    const offPrayer =
      OFFENSIVE_PRAYER[this.config.combatRole] ?? "superhuman_strength";

    try {
      if (phase === "opening" || phase === "finishing") {
        await this.activatePrayer(offPrayer);
        await this.deactivatePrayer(DEFENSIVE_PRAYER);
      } else if (phase === "desperate") {
        await this.activatePrayer(DEFENSIVE_PRAYER);
        await this.deactivatePrayer(offPrayer);
      } else {
        await this.activatePrayer(offPrayer);
      }
    } catch (err) {
      duelLogDebug("DuelCombatAI", "Prayer switch failed:", errMsg(err));
    }
  }

  private async tryStyleSwitch(
    healthPct: number,
    phase: CombatPhase,
    phaseChanged = false,
  ): Promise<void> {
    // Mage agents don't switch styles — magic auto-casts via selectedSpell
    if (this.config.combatRole === "mage") return;

    // Faster switching (#7): every 2 ticks, immediate on phase change
    if (!phaseChanged && this.tickCount % 2 !== 0) return;

    let desiredStyle: string;
    if (this.config.combatRole === "ranged") {
      // Ranged agents use "rapid" for faster attack speed (-1 tick)
      desiredStyle = "rapid";
    } else {
      // Melee: phase-based with accurate mid-range (#15)
      if (phase === "finishing") {
        desiredStyle = "aggressive";
      } else if (phase === "desperate") {
        desiredStyle = "defensive";
      } else if (healthPct > this.config.aggressiveThresholdPct) {
        desiredStyle = "aggressive";
      } else if (healthPct > 50) {
        desiredStyle = "accurate";
      } else {
        desiredStyle = "controlled";
      }
    }

    if (desiredStyle === this.currentStyle) return;

    try {
      await this.service.executeChangeStyle(desiredStyle);
      this.currentStyle = desiredStyle;
    } catch (err) {
      duelLogDebug("DuelCombatAI", "Style switch failed:", errMsg(err));
    }
  }

  // ============================================================================
  // Trash Talk System
  // ============================================================================

  /**
   * Check if own or opponent health has crossed a milestone threshold.
   * Fires a background LLM trash talk call (or scripted fallback) when triggered.
   *
   * @param healthPct - Current own health percentage
   * @param prevHealthPct - Previous tick's own health percentage
   * @param opponentData - Current opponent data
   * @param prevOpponentHealthPct - Previous tick's opponent health percentage
   */
  private checkHealthMilestones(
    healthPct: number,
    prevHealthPct: number,
    opponentData: OpponentData | null,
    prevOpponentHealthPct: number,
  ): void {
    if (!this.sendChat) return;

    const now = Date.now();
    if (now - this.lastTrashTalkTime < TRASH_TALK_COOLDOWN_MS) return;
    if (this._trashTalkInFlight) return;

    // Check own health thresholds (descending)
    let lowestCrossedOwn = -1;
    for (const threshold of TRASH_TALK_THRESHOLDS) {
      if (healthPct <= threshold && !this.firedOwnThresholds.has(threshold)) {
        lowestCrossedOwn = threshold;
      }
    }

    if (lowestCrossedOwn !== -1) {
      // Mark all crossed thresholds as fired
      for (const threshold of TRASH_TALK_THRESHOLDS) {
        if (healthPct <= threshold) {
          this.firedOwnThresholds.add(threshold);
        }
      }
      this.fireTrashTalk(
        "own_low",
        `Your health just dropped to ${Math.round(healthPct)}%! You're at ${lowestCrossedOwn}% threshold.`,
        healthPct,
        opponentData,
      );
      return; // Do not check opponent thresholds in the same tick
    }

    // Check opponent health thresholds
    let lowestCrossedOpp = -1;
    let oppPct = -1;
    if (opponentData && opponentData.maxHealth > 0) {
      oppPct = (opponentData.health / opponentData.maxHealth) * 100;
      for (const threshold of TRASH_TALK_THRESHOLDS) {
        if (
          oppPct <= threshold &&
          !this.firedOpponentThresholds.has(threshold)
        ) {
          lowestCrossedOpp = threshold;
        }
      }
    }

    if (lowestCrossedOpp !== -1) {
      // Mark all crossed thresholds as fired
      for (const threshold of TRASH_TALK_THRESHOLDS) {
        if (oppPct <= threshold) {
          this.firedOpponentThresholds.add(threshold);
        }
      }
      this.fireTrashTalk(
        "opponent_low",
        `Your opponent${this.opponentName ? ` ${this.opponentName}` : ""}'s health just dropped to ${Math.round(oppPct)}%! They hit the ${lowestCrossedOpp}% mark.`,
        healthPct,
        opponentData,
      );
    }
  }

  /**
   * Periodically fire an ambient taunt with no specific health trigger.
   */
  private maybeAmbientTrashTalk(
    healthPct: number,
    opponentData: OpponentData | null,
  ): void {
    if (!this.sendChat) return;
    if (this.tickCount < this.nextAmbientTauntTick) return;
    if (this._trashTalkInFlight) return;

    const now = Date.now();
    if (now - this.lastTrashTalkTime < TRASH_TALK_COOLDOWN_MS) return;

    // Schedule next ambient taunt
    this.nextAmbientTauntTick =
      this.tickCount +
      AMBIENT_TAUNT_MIN_TICKS +
      Math.floor(
        Math.random() * (AMBIENT_TAUNT_MAX_TICKS - AMBIENT_TAUNT_MIN_TICKS),
      );

    this.fireTrashTalk(
      "ambient",
      "It's an ongoing duel — taunt your opponent!",
      healthPct,
      opponentData,
    );
  }

  /**
   * Fire a trash talk message. Uses LLM if available, scripted fallback otherwise.
   * Always background / fire-and-forget — never blocks tick.
   */
  private fireTrashTalk(
    kind: "own_low" | "opponent_low" | "ambient" | "opening",
    situation: string,
    healthPct: number,
    opponentData: OpponentData | null,
  ): void {
    if (!this.sendChat) return;

    const sendChatAction = this.sendChat;

    // Scripted path (no runtime / LLM)
    if (!this.runtime) {
      const pool =
        kind === "own_low"
          ? FALLBACK_TAUNTS_OWN_LOW
          : kind === "opponent_low"
            ? FALLBACK_TAUNTS_OPPONENT_LOW
            : kind === "opening"
              ? FALLBACK_TAUNTS_OPENING
              : FALLBACK_TAUNTS_AMBIENT;
      const msg = pool[Math.floor(Math.random() * pool.length)];
      this.lastTrashTalkTime = Date.now();
      try {
        sendChatAction(msg);
      } catch {
        // Swallow — chat failure must not break combat
      }
      return;
    }

    // LLM path — fire in background, using agent character for personality.
    // Dedup guard: skip if a call is already in-flight.
    if (this._trashTalkInFlight) return;

    const oppPctStr =
      opponentData && opponentData.maxHealth > 0
        ? `${((opponentData.health / opponentData.maxHealth) * 100).toFixed(0)}%`
        : "unknown";

    // Pull character bio/personality from the Eliza agent runtime
    const character = (
      this.runtime as unknown as {
        character?: { bio?: string | string[]; style?: { all?: string[] } };
      }
    ).character;
    const bioText = character?.bio
      ? Array.isArray(character.bio)
        ? character.bio.slice(0, 3).join(" ")
        : String(character.bio).slice(0, 200)
      : "";
    const styleHints = character?.style?.all?.slice(0, 3).join(", ") || "";

    const prompt = [
      `You are ${this.agentName || "a warrior"} in a PvP duel${this.opponentName ? ` against ${this.opponentName}` : ""}.`,
      bioText ? `Your personality: ${bioText}` : "",
      styleHints ? `Your communication style: ${styleHints}` : "",
      `Your HP: ${healthPct.toFixed(0)}%. Opponent HP: ${oppPctStr}.`,
      `Situation: ${situation}`,
      ``,
      `Generate a SHORT trash talk message (under 40 characters) for the overhead chat bubble.`,
      `Stay in character. Be creative, funny, competitive. No quotes. Just the message.`,
    ]
      .filter(Boolean)
      .join("\n");

    this._trashTalkInFlight = true;
    this.lastTrashTalkTime = Date.now();

    // Fire-and-forget — intentionally NOT awaited so the combat tick is never blocked.
    void (async () => {
      let timerId: ReturnType<typeof setTimeout> | undefined;
      try {
        const llmPromise = this.runtime!.useModel(ModelType.TEXT_SMALL, {
          prompt,
          maxTokens: 30,
          temperature: 0.9,
        });

        const timeoutPromise = new Promise<never>((_, reject) => {
          timerId = setTimeout(
            () => reject(new Error("Trash talk LLM timeout")),
            TRASH_TALK_TIMEOUT_MS,
          );
        });

        const response = await Promise.race([llmPromise, timeoutPromise]);

        const text = (typeof response === "string" ? response : "")
          .trim()
          .replace(/^["']|["']$/g, "");
        if (text && text.length <= 60) {
          try {
            sendChatAction(text);
          } catch {
            // Swallow — chat failure must not break combat
          }
        }
      } catch (err) {
        // On failure / timeout, use a scripted fallback
        const pool =
          kind === "own_low"
            ? FALLBACK_TAUNTS_OWN_LOW
            : kind === "opponent_low"
              ? FALLBACK_TAUNTS_OPPONENT_LOW
              : kind === "opening"
                ? FALLBACK_TAUNTS_OPENING
                : FALLBACK_TAUNTS_AMBIENT;
        const msg = pool[Math.floor(Math.random() * pool.length)];
        try {
          sendChatAction(msg);
        } catch {
          // Swallow
        }
      } finally {
        if (timerId !== undefined) clearTimeout(timerId);
        this._trashTalkInFlight = false;
      }
    })();
  }

  /**
   * Movement AI: position agent at ideal range for their combat role (#1, #5, #17).
   * Melee: hold a standoff ring (min–max); back up when too close, not only chase when far.
   * Ranged/mage: kite when too close, walk in when too far.
   * Finishing phase: always run to press the advantage regardless of distance.
   */
  private movementTick(
    state: EmbeddedGameState,
    opponentData: OpponentData | null,
    now: number,
    phase: CombatPhase = "trading",
  ): void {
    if (now - this.lastMoveTime < DuelCombatAI.MOVE_COOLDOWN_MS) return;
    if (!opponentData) return;

    const distance = opponentData.distance;
    const idealRange =
      DuelCombatAI.IDEAL_RANGE[this.config.combatRole] ??
      DuelCombatAI.IDEAL_RANGE.melee;

    // Check if we need to reposition
    const tooClose = distance < idealRange.min;
    const tooFar = distance > idealRange.max;
    if (!tooClose && !tooFar) return;

    // Need own position and opponent position to compute direction
    const ownPos = state.position;
    const oppPos = opponentData.position;
    if (!ownPos || !oppPos) return;

    const dx = oppPos[0] - ownPos[0];
    const dz = oppPos[2] - ownPos[2];
    const dist = Math.sqrt(dx * dx + dz * dz);

    let targetX: number;
    let targetZ: number;
    let run = false;

    // Stacked or overlapping — push apart using relative geometry so the two agents
    // always diverge. Each agent pushes in the direction from opponent to self (opposite
    // vectors for the two combatants), so they can never target the same world position.
    // A perpendicular offset (strafeSign) breaks the tie when they are perfectly co-located.
    if (dist < 1.5) {
      // Push apart gently — enough to unstick without sending agents flying
      const push = 2.2;
      if (dist > 0.05) {
        const awayX = -dx / dist;
        const awayZ = -dz / dist;
        const perpX = -awayZ * this.strafeSign;
        const perpZ = awayX * this.strafeSign;
        targetX = ownPos[0] + awayX * push + perpX * 1.0;
        targetZ = ownPos[2] + awayZ * push + perpZ * 1.0;
      } else {
        targetX = ownPos[0] + push * this.strafeSign;
        targetZ = ownPos[2] + push * 0.5 * -this.strafeSign;
      }
      run = true;
    } else {
      const nx = dx / dist;
      const nz = dz / dist;

      if (this.config.combatRole === "melee") {
        // Same standoff point whether we're inside or outside the band: on the ring at min distance from opponent.
        const standoff = idealRange.min;
        targetX = oppPos[0] - nx * standoff;
        targetZ = oppPos[2] - nz * standoff;
        // In finishing phase, always sprint — press the advantage and don't let
        // a low-HP opponent create distance.
        run = tooFar || phase === "finishing";
      } else if (tooClose) {
        const targetDist = idealRange.max;
        targetX = oppPos[0] - nx * targetDist;
        targetZ = oppPos[2] - nz * targetDist;
        run = true;
      } else {
        const targetDist = idealRange.min;
        targetX = oppPos[0] - nx * targetDist;
        targetZ = oppPos[2] - nz * targetDist;
        run = true;
      }

      // Lateral strafe using a world-space diagonal that is ALWAYS opposite for the
      // two combatants. The line-of-sight perpendicular (-nz, nx) * strafeSign is
      // mathematically identical for both agents (opposite nx/nz cancels opposite
      // strafeSign), so both used to orbit the same direction. Instead we use a
      // fixed world-space diagonal so strafeSign=+1 → (+X,-Z) and
      // strafeSign=-1 → (-X,+Z): always diverging regardless of orientation.
      const strafeScale =
        dist < idealRange.max
          ? Math.max(0.35, Math.min(1, dist / idealRange.max))
          : 1;
      const strafeAmt = DuelCombatAI.STRAFE_STEP * strafeScale * 0.7;
      targetX += this.strafeSign * strafeAmt;
      targetZ -= this.strafeSign * strafeAmt;
    }

    const b = this.config.movementClampBounds;
    if (b) {
      // 2.5-unit pad keeps targets well clear of the wall. Agents running at full
      // speed can overshoot a tight target, so this margin prevents them from
      // reaching the boundary even with physics overshoot.
      const pad = 2.5;
      const preClampX = targetX;
      const preClampZ = targetZ;
      targetX = Math.min(b.maxX - pad, Math.max(b.minX + pad, targetX));
      targetZ = Math.min(b.maxZ - pad, Math.max(b.minZ + pad, targetZ));

      // Wall-aware strafe: if clamping moved the target more than ~0.5 units the
      // agent is strafing into a wall. Flip direction immediately so they circle
      // away from the boundary instead of pressing against it every move tick.
      const wallPush = Math.sqrt(
        (targetX - preClampX) ** 2 + (targetZ - preClampZ) ** 2,
      );
      if (wallPush > 0.5) {
        this.strafeSign = (this.strafeSign * -1) as 1 | -1;
        this.strafeMoveCount = 0; // reset counter so the next natural flip is delayed
      }
    }

    try {
      void this.service
        .executeMove([targetX, ownPos[1], targetZ], run)
        .catch((err) =>
          duelLogDebug("DuelCombatAI", "Move failed:", errMsg(err)),
        );
      this.lastMoveTime = now;
      this.strafeMoveCount++;
      // Flip orbit direction every 5 moves — creates longer, more readable arcs
      // instead of the rapid zig-zag from flipping every 3.
      if (this.strafeMoveCount % 5 === 0) {
        this.strafeSign = (this.strafeSign * -1) as 1 | -1;
      }
    } catch (err) {
      duelLogDebug("DuelCombatAI", "Move failed:", errMsg(err));
    }
  }

  private async tryAttack(
    state: EmbeddedGameState,
    _phase: CombatPhase,
  ): Promise<void> {
    // The combat system's auto-attack loop (processPlayerCombatTick →
    // processAutoAttackOnTick) drives the actual attack cadence once combat is
    // established.  The AI only needs to (re-)engage when combat has dropped
    // or the target has changed — calling executeAttack on every cooldown cycle
    // creates a redundant second driver that competes for the same cooldown slot,
    // silently dropping attacks (especially for slow weapons like 2h swords).
    //
    // However, entity data flags (inCombat, combatTarget) can be stale — they
    // are set by DuelOrchestrator.setAgentCombatTarget() even when the
    // CombatSystem's internal state has timed out or was never created.
    // To prevent agents from standing idle, we also periodically force
    // re-engagement as a keep-alive (every RE_ENGAGE_INTERVAL ticks ≈ 3s).
    const needsEngagement =
      !state.inCombat || state.currentTarget !== this.opponentId;

    const ticksSinceLastEngage = this.tickCount - this._lastEngageTick;
    const needsKeepAlive =
      !needsEngagement &&
      ticksSinceLastEngage >= DuelCombatAI.RE_ENGAGE_INTERVAL;

    if (needsEngagement || needsKeepAlive) {
      try {
        await this.service.executeAttack(this.opponentId);
        this._lastEngageTick = this.tickCount;
        if (needsEngagement) this.attacksLanded++;
      } catch (err) {
        duelLogDebug("DuelCombatAI", "Attack failed:", errMsg(err));
      }
    }
  }

  private getOpponentData(state: EmbeddedGameState): OpponentData | null {
    for (let i = 0; i < state.nearbyEntities.length; i++) {
      const e = state.nearbyEntities[i];
      if (e.id === this.opponentId) {
        // Reuse cached object to avoid per-tick allocation
        this._cachedOpponentData.health = e.health ?? 0;
        this._cachedOpponentData.maxHealth = e.maxHealth ?? 0;
        this._cachedOpponentData.distance = e.distance;
        this._cachedOpponentData.position =
          (e as { position?: [number, number, number] }).position ?? null;
        this._cachedOpponentData.equippedWeapon = e.equippedWeapon;
        return this._cachedOpponentData;
      }
    }
    return null;
  }

  private findBestFood(
    inventory: EmbeddedGameState["inventory"],
  ): InventorySlot | null {
    let bestFood: InventorySlot | null = null;
    let bestHeal = -1;

    for (let i = 0; i < inventory.length; i++) {
      const item = inventory[i];
      if (!item.itemId) continue;

      const lowerName = item.itemId.toLowerCase();
      let itemHeal = -1;

      for (let j = 0; j < FOOD_ENTRIES.length; j++) {
        const [key, val] = FOOD_ENTRIES[j];
        if (lowerName.includes(key)) {
          if (val > itemHeal) {
            itemHeal = val;
          }
        }
      }

      if (itemHeal > bestHeal) {
        bestHeal = itemHeal;
        bestFood = item;
      }
    }

    return bestFood;
  }

  private findPotion(
    inventory: EmbeddedGameState["inventory"],
  ): InventorySlot | null {
    for (let i = 0; i < inventory.length; i++) {
      const item = inventory[i];
      if (!item.itemId) continue;

      const lowerName = item.itemId.toLowerCase();
      for (let j = 0; j < POTION_PATTERNS.length; j++) {
        if (lowerName.includes(POTION_PATTERNS[j])) {
          return item;
        }
      }
    }
    return null;
  }
}

interface OpponentData {
  health: number;
  maxHealth: number;
  distance: number;
  position: [number, number, number] | null;
  equippedWeapon: string | undefined;
}

type InventorySlot = EmbeddedGameState["inventory"][number];
