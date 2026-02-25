/**
 * DuelCombatAI - Tick-based PvP combat controller for embedded agents
 *
 * Takes over an agent's behavior during arena duels. Uses
 * EmbeddedHyperscapeService directly for game actions (executeAttack,
 * executeUse). Reads game state each tick and makes priority-based
 * combat decisions: heal, attack, or switch style.
 *
 * Lifecycle:
 *   ArenaService creates DuelCombatAI when a duel starts.
 *   DuelCombatAI.start() begins ticking at COMBAT_TICK_MS (600ms).
 *   ArenaService calls DuelCombatAI.stop() when the duel ends.
 */

import { TICK_DURATION_MS } from "@hyperscape/shared";
import type { EmbeddedHyperscapeService } from "../eliza/EmbeddedHyperscapeService";
import type { EmbeddedGameState } from "../eliza/types";
import { type AgentRuntime, ModelType } from "@elizaos/core";
import { errMsg } from "../shared/errMsg";

export interface DuelCombatConfig {
  healThresholdPct: number;
  aggressiveThresholdPct: number;
  defensiveThresholdPct: number;
  maxTicksWithoutAttack: number;
  useLlmTactics: boolean;
}

const DEFAULT_CONFIG: DuelCombatConfig = {
  healThresholdPct: 40,
  aggressiveThresholdPct: 70,
  defensiveThresholdPct: 30,
  maxTicksWithoutAttack: 5,
  useLlmTactics: false,
};

/** Health percentage thresholds that trigger trash talk events. */
const TRASH_TALK_THRESHOLDS = [90, 80, 70, 60, 50, 40, 30, 20, 10] as const;

/** Minimum milliseconds between trash talk LLM calls. */
const TRASH_TALK_COOLDOWN_MS = 4_000;

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
  prayer: "ultimate_strength",
  protectionPrayer: null,
  foodThreshold: 40,
  switchDefensiveAt: 30,
  reasoning: "Default balanced strategy",
};

const MIN_REPLAN_INTERVAL_MS = 8000;

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
    this.strategy = { ...DEFAULT_STRATEGY };

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

    console.log(`[DuelCombatAI] Started combat against ${this.opponentId}`);

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

    console.log(
      `[DuelCombatAI] Stopped after ${this.tickCount} ticks. ` +
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

    const state = this.service.getGameState();
    if (!state) return;
    if (!state.alive) {
      this.stop();
      return;
    }

    const healthPct =
      state.maxHealth > 0 ? (state.health / state.maxHealth) * 100 : 100;

    // Save previous values for trash talk threshold detection
    const prevHealthPct = this.lastHealthPct;
    const prevOpponentHealthPct = this.opponentLastHealthPct;

    const damageThisTick = this.lastHealthPct - healthPct;
    if (damageThisTick > 0) {
      this.totalDamageReceived += Math.round(
        (damageThisTick / 100) * state.maxHealth,
      );
    }
    this.lastHealthPct = healthPct;

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

    const phase = this.determineCombatPhase(healthPct, opponentData);

    // Check health milestones for trash talk (fire-and-forget, never blocks tick)
    // Pass previous health values since this.lastHealthPct is already updated
    this.checkHealthMilestones(
      healthPct,
      prevHealthPct,
      opponentData,
      prevOpponentHealthPct,
    );
    this.maybeAmbientTrashTalk(healthPct, opponentData);

    if (await this.tryHeal(state, healthPct, phase)) {
      this.healsUsed++;
      return;
    }

    if (await this.tryBuff(state, phase)) {
      return;
    }

    if (this.config.useLlmTactics && this.runtime) {
      // LLM path: fire-and-forget strategy replanning in background (never blocks tick),
      // then execute the latest strategy object every tick
      this.maybeReplanStrategyBackground(state, healthPct, opponentData, phase);
      await this.executeStrategy(healthPct, phase);
    } else {
      // Scripted path: phase-based prayer and style switching
      await this.tryPrayerSwitch(phase);
      await this.tryStyleSwitch(healthPct, phase);
    }

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
   */
  private async tryHeal(
    state: EmbeddedGameState,
    healthPct: number,
    phase: CombatPhase,
  ): Promise<boolean> {
    const baseThreshold = this.config.useLlmTactics
      ? this.strategy.foodThreshold
      : this.config.healThresholdPct;
    const threshold =
      phase === "desperate" ? baseThreshold + 15 : baseThreshold;

    if (healthPct >= threshold) return false;

    const food = this.findBestFood(state.inventory);
    if (!food) return false;

    try {
      await this.service.executeUse(food.itemId);
      return true;
    } catch (err) {
      console.debug(
        `[DuelCombatAI] Heal failed (${food.itemId}):`,
        errMsg(err),
      );
      return false;
    }
  }

  /**
   * Attempt to use a buff potion. Returns true if used.
   */
  private async tryBuff(
    state: EmbeddedGameState,
    phase: CombatPhase,
  ): Promise<boolean> {
    if (phase !== "opening" || this.tickCount > 2) return false;

    const potion = this.findPotion(state.inventory);
    if (!potion) return false;

    try {
      await this.service.executeUse(potion.itemId);
      return true;
    } catch (err) {
      console.debug(
        `[DuelCombatAI] Buff failed (${potion.itemId}):`,
        errMsg(err),
      );
      return false;
    }
  }

  /**
   * Check if conditions warrant replanning the combat strategy.
   * Fires planning in the background — NEVER blocks the tick loop.
   */
  private maybeReplanStrategyBackground(
    state: EmbeddedGameState,
    healthPct: number,
    opponentData: OpponentData | null,
    phase: CombatPhase,
  ): void {
    // Don't queue another LLM call while one is in flight
    if (this._llmPlanningInFlight) return;

    const now = Date.now();
    if (
      now - this.lastReplanTime < MIN_REPLAN_INTERVAL_MS &&
      this.strategyPlanned
    )
      return;

    const needsReplan =
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
        console.debug(
          `[DuelCombatAI] Background strategy planning failed:`,
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
      `Available prayers: ultimate_strength (+15% str), steel_skin (+15% def), rock_skin (+10% def)`,
      `Available styles: aggressive (max damage), defensive (less damage taken), controlled (balanced), accurate (hit more often)`,
      ``,
      `Respond with a JSON object:`,
      `{`,
      `  "approach": "aggressive" | "defensive" | "balanced" | "outlast",`,
      `  "attackStyle": "aggressive" | "defensive" | "controlled" | "accurate",`,
      `  "prayer": "ultimate_strength" | "steel_skin" | null,`,
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
        console.log(
          `[DuelCombatAI] Strategy planned: ${this.strategy.approach}, style=${this.strategy.attackStyle}, prayer=${this.strategy.prayer}, eat@${this.strategy.foodThreshold}%`,
        );
      }
    } catch (err) {
      console.debug(
        `[DuelCombatAI] Strategy planning failed, keeping current:`,
        errMsg(err),
      );
    }
  }

  /**
   * Execute the current strategy -- set prayer and style as directed.
   * Called every tick. Only changes state if it differs from current.
   */
  private async executeStrategy(
    healthPct: number,
    phase: CombatPhase,
  ): Promise<void> {
    // Override strategy for desperate situations
    if (phase === "desperate" || healthPct < this.strategy.switchDefensiveAt) {
      await this.activatePrayer(this.strategy.protectionPrayer || "steel_skin");
      await this.deactivatePrayer("ultimate_strength");
      if (this.currentStyle !== "defensive") {
        try {
          await this.service.executeChangeStyle("defensive");
          this.currentStyle = "defensive";
        } catch (err) {
          console.debug(`[DuelCombatAI] Style switch failed:`, errMsg(err));
        }
      }
      return;
    }

    // Apply strategy prayer
    if (this.strategy.prayer) {
      await this.activatePrayer(this.strategy.prayer);
    }

    // Apply strategy style
    const desiredStyle = this.strategy.attackStyle || "aggressive";
    if (desiredStyle !== this.currentStyle && this.tickCount % 5 === 0) {
      try {
        await this.service.executeChangeStyle(desiredStyle);
        this.currentStyle = desiredStyle;
      } catch (err) {
        console.debug(`[DuelCombatAI] Style switch failed:`, errMsg(err));
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

  private async tryPrayerSwitch(phase: CombatPhase): Promise<void> {
    if (this.tickCount % 3 !== 0) return;

    try {
      if (phase === "opening" || phase === "finishing") {
        await this.activatePrayer("ultimate_strength");
        await this.deactivatePrayer("steel_skin");
      } else if (phase === "desperate") {
        await this.activatePrayer("steel_skin");
        await this.deactivatePrayer("ultimate_strength");
      } else {
        await this.activatePrayer("ultimate_strength");
      }
    } catch (err) {
      console.debug(`[DuelCombatAI] Prayer switch failed:`, errMsg(err));
    }
  }

  private async tryStyleSwitch(
    healthPct: number,
    phase: CombatPhase,
  ): Promise<void> {
    if (this.tickCount % 5 !== 0) return;

    let desiredStyle: string;
    if (phase === "finishing") {
      desiredStyle = "aggressive";
    } else if (phase === "desperate") {
      desiredStyle = "defensive";
    } else if (healthPct > this.config.aggressiveThresholdPct) {
      desiredStyle = "aggressive";
    } else {
      desiredStyle = "controlled";
    }

    if (desiredStyle === this.currentStyle) return;

    try {
      await this.service.executeChangeStyle(desiredStyle);
      this.currentStyle = desiredStyle;
    } catch (err) {
      console.debug(`[DuelCombatAI] Style switch failed:`, errMsg(err));
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
    for (const threshold of TRASH_TALK_THRESHOLDS) {
      if (
        healthPct <= threshold &&
        prevHealthPct > threshold &&
        !this.firedOwnThresholds.has(threshold)
      ) {
        this.firedOwnThresholds.add(threshold);
        this.fireTrashTalk(
          "own_low",
          `Your health just dropped to ${Math.round(healthPct)}%! You're at ${threshold}% threshold.`,
          healthPct,
          opponentData,
        );
        return; // One per tick maximum
      }
    }

    // Check opponent health thresholds
    if (opponentData && opponentData.maxHealth > 0) {
      const oppPct = (opponentData.health / opponentData.maxHealth) * 100;
      for (const threshold of TRASH_TALK_THRESHOLDS) {
        if (
          oppPct <= threshold &&
          prevOpponentHealthPct > threshold &&
          !this.firedOpponentThresholds.has(threshold)
        ) {
          this.firedOpponentThresholds.add(threshold);
          this.fireTrashTalk(
            "opponent_low",
            `Your opponent${this.opponentName ? ` ${this.opponentName}` : ""}'s health just dropped to ${Math.round(oppPct)}%! They hit the ${threshold}% mark.`,
            healthPct,
            opponentData,
          );
          return;
        }
      }
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

    const sendChat = this.sendChat;

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
        sendChat(msg);
      } catch {
        // Swallow — chat failure must not break combat
      }
      return;
    }

    // LLM path — fire in background, using agent character for personality
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

    const llmPromise = this.runtime.useModel(ModelType.TEXT_SMALL, {
      prompt,
      maxTokens: 30,
      temperature: 0.9,
    });

    let timerId: ReturnType<typeof setTimeout>;
    const timeoutPromise = new Promise<never>((_, reject) => {
      timerId = setTimeout(
        () => reject(new Error("Trash talk LLM timeout")),
        LLM_TIMEOUT_MS,
      );
    });

    Promise.race([llmPromise, timeoutPromise])
      .then((response) => {
        clearTimeout(timerId!);
        const text = (typeof response === "string" ? response : "")
          .trim()
          .replace(/^["']|["']$/g, "");
        if (text && text.length <= 60) {
          try {
            sendChat(text);
          } catch {
            // Swallow
          }
        }
      })
      .catch(() => {
        clearTimeout(timerId!);
        // On failure, use a scripted fallback
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
          sendChat(msg);
        } catch {
          // Swallow
        }
      })
      .finally(() => {
        this._trashTalkInFlight = false;
      });
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
    const needsEngagement =
      !state.inCombat || state.currentTarget !== this.opponentId;

    if (needsEngagement) {
      try {
        await this.service.executeAttack(this.opponentId);
        this.attacksLanded++;
      } catch (err) {
        console.debug(`[DuelCombatAI] Attack failed:`, errMsg(err));
      }
    }
  }

  private getOpponentData(state: EmbeddedGameState): OpponentData | null {
    for (let i = 0; i < state.nearbyEntities.length; i++) {
      const e = state.nearbyEntities[i];
      if (e.id === this.opponentId) {
        return {
          health: e.health ?? 0,
          maxHealth: e.maxHealth ?? 0,
          distance: e.distance,
        };
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
}

type InventorySlot = EmbeddedGameState["inventory"][number];
