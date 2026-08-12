/**
 * QuestSystem - Quest Management System
 *
 * Manages player quest progression, tracking, and rewards.
 * Quests are defined in quests.json manifest and loaded at runtime.
 *
 * **Features:**
 * - Manifest-driven quest definitions
 * - Kill tracking for combat objectives
 * - Stage-based quest progression
 * - Item rewards on start/completion
 * - Quest points tracking
 * - Integration with DialogueSystem for quest-aware dialogue
 *
 * **Event Flow:**
 * 1. DialogueSystem effect "startQuest:quest_id" triggers quest start
 * 2. QuestSystem tracks progress (kills, etc.)
 * 3. When objective complete, status becomes "ready_to_complete"
 * 4. DialogueSystem effect "completeQuest:quest_id" triggers completion
 * 5. Rewards distributed, QUEST_COMPLETED event emitted
 *
 * **Runs on:** Server only (client receives state via network messages)
 */

import { EventType } from "../../../types/events";
import type { World } from "../../../types/index";
import { SystemBase } from "../infrastructure/SystemBase";
import type {
  QuestDefinition,
  QuestStatus,
  QuestDbStatus,
  QuestStage,
  StageProgress,
  QuestProgress,
  PlayerQuestState,
  QuestManifest,
} from "../../../types/game/quest-types";
import { validateQuestDefinition } from "../../../types/game/quest-types";
import type { NPCDiedPayload } from "../../../types/events/event-payloads";
import { validateKillToken } from "../../../utils/game/KillTokenUtils";
import type { IQuestSystem } from "../../../types/game/quest-interfaces";

type DurableGatheringProgressReceipt = {
  operationId: string;
  playerId: string;
  questId: string;
  questStartedAt: number;
  capturedStage: string;
  rewardItemId: string;
  rewardQuantity: number;
  createdAt: number;
};

type DurableGatheringProgressResult =
  | {
      status: "applied" | "replayed" | "stale";
      currentStage: string;
      stageProgress: StageProgress;
    }
  | { status: "retired" };

type DurableGatheringProgressRepository = {
  getPendingGatheringProgressReceipts: (
    playerId: string,
  ) => Promise<DurableGatheringProgressReceipt[]>;
  applyGatheringProgressReceipt: (request: {
    operationId: string;
    playerId: string;
    questId: string;
    questStartedAt: number;
    capturedStage: string;
    rewardItemId: string;
    rewardQuantity: number;
    expectedCurrentStage: string;
    expectedProgress: StageProgress;
    resultingStage: string;
    resultingProgress: StageProgress;
  }) => Promise<DurableGatheringProgressResult>;
  retireGatheringProgressReceipt: (
    receipt: DurableGatheringProgressReceipt,
  ) => Promise<"retired" | "already_resolved" | "still_active">;
  ignoreGatheringProgressReceipt: (
    receipt: DurableGatheringProgressReceipt,
  ) => Promise<"ignored" | "already_resolved">;
};

type DurableProcessingProgressReceipt = {
  operationId: string;
  playerId: string;
  questId: string;
  questStartedAt: number;
  capturedStage: string;
  targetId: string;
  quantity: number;
  createdAt: number;
};

type DurableProcessingProgressRepository = {
  getPendingProcessingProgressReceipts: (
    playerId: string,
  ) => Promise<DurableProcessingProgressReceipt[]>;
  applyProcessingProgressReceipt: (request: {
    operationId: string;
    playerId: string;
    questId: string;
    questStartedAt: number;
    capturedStage: string;
    targetId: string;
    quantity: number;
    expectedCurrentStage: string;
    expectedProgress: StageProgress;
    resultingStage: string;
    resultingProgress: StageProgress;
  }) => Promise<DurableGatheringProgressResult>;
  retireProcessingProgressReceipt: (
    receipt: DurableProcessingProgressReceipt,
  ) => Promise<"retired" | "already_resolved" | "still_active">;
  ignoreProcessingProgressReceipt: (
    receipt: DurableProcessingProgressReceipt,
  ) => Promise<"ignored" | "already_resolved">;
};

/**
 * QuestSystem - Handles quest progression and rewards
 *
 * Implements IQuestSystem interface which combines:
 * - IQuestQuery: Read-only quest information queries
 * - IQuestProgress: Active quest progress tracking
 * - IQuestActions: Quest state mutation actions
 */
export class QuestSystem extends SystemBase implements IQuestSystem {
  /** Quest definitions loaded from manifest */
  private questDefinitions: Map<string, QuestDefinition> = new Map();

  /** Player quest state (in-memory cache, synced with database) */
  private playerStates: Map<string, PlayerQuestState> = new Map();

  /** Flag to check if manifest is loaded */
  private manifestLoaded: boolean = false;

  // =========================================================================
  // PRE-ALLOCATED REUSABLES (Memory optimization - avoid GC in hot paths)
  // =========================================================================

  /** Pre-allocated empty array for getActiveQuests when player has no state */
  private readonly _emptyQuestArray: QuestProgress[] = [];

  /** Cache for getActiveQuests results - invalidated when quest state changes */
  private _activeQuestsCache: Map<string, QuestProgress[]> = new Map();

  /** Tracks which players have dirty (stale) active quest caches */
  private _activeQuestsDirty: Set<string> = new Set();

  /** Pre-allocated payload for QUEST_PROGRESSED events */
  private readonly _progressEventPayload = {
    playerId: "",
    questId: "",
    stage: "",
    progress: {} as StageProgress,
    description: "",
  };

  /** Pre-allocated payload for CHAT_MESSAGE events */
  private readonly _chatEventPayload = {
    playerId: "",
    message: "",
    type: "game" as const,
  };

  // =========================================================================
  // STAGE LOOKUP CACHES (O(1) lookups instead of O(n) find() calls)
  // =========================================================================

  /** Cache: questId -> stageId -> QuestStage */
  private _stageByIdCache: Map<string, Map<string, QuestStage>> = new Map();

  /** Cache: questId -> stageId -> index in stages array */
  private _stageIndexCache: Map<string, Map<string, number>> = new Map();

  /** Cache: questId -> itemId -> QuestStage (for gather stages) */
  private _gatherStageCache: Map<string, Map<string, QuestStage>> = new Map();

  /** Cache: questId -> target -> QuestStage (for interact stages) */
  private _interactStageCache: Map<string, Map<string, QuestStage>> = new Map();

  /** Per-quest persistence tails preserve event order and immutable snapshots. */
  private readonly questProgressSaveTails = new Map<string, Promise<void>>();

  /** Per-player drains serialize every durable non-combat progression edge. */
  private readonly questReceiptDrainTails = new Map<string, Promise<void>>();

  constructor(world: World) {
    super(world, {
      name: "quest",
      dependencies: {
        optional: ["dialogue", "inventory", "skills"],
      },
      autoCleanup: true,
    });
  }

  async init(): Promise<void> {
    // Only run on server
    if (!this.world.isServer) {
      return;
    }

    // Load quest manifest
    await this.loadQuestManifest();

    // Subscribe to NPC deaths for kill quest tracking
    this.subscribe<NPCDiedPayload>(EventType.NPC_DIED, async (data) => {
      await this.handleNPCDied(data);
    });

    // Subscribe to player registration for loading quest state
    this.subscribe(
      EventType.PLAYER_REGISTERED,
      async (data: { playerId: string }) => {
        await this.loadPlayerQuestState(data.playerId);
      },
    );

    // Subscribe to player cleanup
    this.subscribe(EventType.PLAYER_CLEANUP, (data: { playerId: string }) => {
      this.playerStates.delete(data.playerId);
      this._activeQuestsCache.delete(data.playerId);
      this._activeQuestsDirty.delete(data.playerId);
      for (const key of this.questProgressSaveTails.keys()) {
        if (key.startsWith(`${data.playerId}\0`)) {
          this.questProgressSaveTails.delete(key);
        }
      }
      this.questReceiptDrainTails.delete(data.playerId);
    });

    // Subscribe to quest start acceptance (player clicked Accept on quest start screen)
    this.subscribe(
      EventType.QUEST_START_ACCEPTED,
      async (data: { playerId: string; questId: string }) => {
        await this.startQuest(data.playerId, data.questId);
      },
    );

    // === Gather/Interact Stage Tracking ===

    // Track only an atomically committed gathering reward. Generic inventory
    // additions include bank withdrawals, grants, and recovery and therefore
    // are not evidence that a gather objective was performed.
    this.subscribe(EventType.RESOURCE_GATHERING_COMPLETED, async (data) => {
      if (
        !data.successful ||
        !data.operationId?.startsWith("gathering-reward:") ||
        !data.rewardItemId ||
        !Number.isSafeInteger(data.rewardQuantity) ||
        (data.rewardQuantity ?? 0) <= 0
      ) {
        return;
      }
      await this.queueQuestReceiptDrain(data.playerId);
    });

    // Processing events are wake-up hints only. The committed database receipt
    // is the sole authority for firemaking, cooking, smelting, smithing,
    // runecrafting, crafting, fletching, and tanning quest progress.
    const queueProcessingDrain = async (data: { playerId: string }) => {
      await this.queueQuestReceiptDrain(data.playerId);
    };
    this.subscribe(EventType.FIRE_CREATED, queueProcessingDrain);
    this.subscribe(EventType.COOKING_COMPLETED, queueProcessingDrain);
    this.subscribe(EventType.SMELTING_SUCCESS, queueProcessingDrain);
    this.subscribe(EventType.SMITHING_COMPLETE, queueProcessingDrain);
    this.subscribe(EventType.RUNECRAFTING_COMPLETE, queueProcessingDrain);
    this.subscribe(EventType.CRAFTING_COMPLETE, queueProcessingDrain);
    this.subscribe(EventType.FLETCHING_COMPLETE, queueProcessingDrain);
    this.subscribe(EventType.TANNING_COMPLETE, queueProcessingDrain);

    this.logger.info(
      `QuestSystem initialized with ${this.questDefinitions.size} quests`,
    );
  }

  /**
   * Load quest definitions from manifest
   */
  private async loadQuestManifest(): Promise<void> {
    try {
      // Check if we're on the server (Node.js environment)
      const isServer =
        typeof process !== "undefined" &&
        process.versions !== undefined &&
        process.versions.node !== undefined;

      if (!isServer) {
        // Client-side - quests are server-only
        this.logger.warn("Quest manifest not available on client");
        this.manifestLoaded = true;
        return;
      }

      // Server-side: Load from filesystem
      const fsModuleId = "node:fs/promises";
      const pathModuleId = "node:path";
      const fs = (await import(
        /* @vite-ignore */ fsModuleId
      )) as typeof import("node:fs/promises");
      const path = (await import(
        /* @vite-ignore */ pathModuleId
      )) as typeof import("node:path");

      // Find manifests directory
      let manifestsDir: string;
      if (process.env.ASSETS_DIR) {
        manifestsDir = path.join(process.env.ASSETS_DIR, "manifests");
      } else {
        const cwd = process.cwd();
        const normalizedCwd = cwd.replace(/\\/g, "/");
        if (
          normalizedCwd.endsWith("/packages/server") ||
          normalizedCwd.includes("/packages/server/")
        ) {
          manifestsDir = path.join(cwd, "world", "assets", "manifests");
        } else if (normalizedCwd.includes("/packages/")) {
          const workspaceRoot = path.resolve(cwd, "../..");
          manifestsDir = path.join(
            workspaceRoot,
            "packages",
            "server",
            "world",
            "assets",
            "manifests",
          );
        } else {
          manifestsDir = path.join(
            cwd,
            "packages",
            "server",
            "world",
            "assets",
            "manifests",
          );
        }
      }

      const questsPath = path.join(manifestsDir, "quests.json");

      try {
        const questsData = await fs.readFile(questsPath, "utf-8");
        const questData = JSON.parse(questsData) as QuestManifest;

        let validCount = 0;
        let invalidCount = 0;

        for (const [questId, definition] of Object.entries(questData)) {
          // Validate quest definition
          const validation = validateQuestDefinition(questId, definition);

          if (!validation.valid) {
            invalidCount++;
            for (const error of validation.errors) {
              this.logger.warn(`Quest validation error: ${error}`);
            }
            continue; // Skip invalid quests
          }

          this.questDefinitions.set(questId, definition as QuestDefinition);
          this.buildStageCaches(questId, definition as QuestDefinition);
          validCount++;
        }

        this.manifestLoaded = true;

        if (invalidCount > 0) {
          this.logger.warn(
            `Loaded ${validCount} valid quests, skipped ${invalidCount} invalid quests from ${questsPath}`,
          );
        } else {
          this.logger.info(
            `Loaded ${validCount} quest definitions from ${questsPath}`,
          );
        }
      } catch {
        this.logger.warn(
          `Quest manifest not found at ${questsPath}, using empty quest list`,
        );
        this.manifestLoaded = true;
      }
    } catch (error) {
      this.logger.error(
        "Failed to load quest manifest",
        error instanceof Error ? error : undefined,
      );
      this.manifestLoaded = true; // Continue without quests
    }
  }

  /**
   * Load player quest state from database
   */
  private async loadPlayerQuestState(playerId: string): Promise<void> {
    // Initialize player state
    const state: PlayerQuestState = {
      playerId,
      questPoints: 0,
      activeQuests: new Map(),
      completedQuests: new Set(),
    };

    // Load from database via DatabaseSystem if available
    try {
      const dbSystem = this.world.getSystem("database") as {
        getQuestRepository?: () => {
          getAllPlayerQuests: (playerId: string) => Promise<
            Array<{
              questId: string;
              status: QuestDbStatus;
              currentStage: string | null;
              stageProgress: StageProgress;
              startedAt: number | null;
              completedAt: number | null;
            }>
          >;
          getQuestPoints: (playerId: string) => Promise<number>;
        };
      };

      if (dbSystem?.getQuestRepository) {
        const repo = dbSystem.getQuestRepository();
        const questRows = await repo.getAllPlayerQuests(playerId);
        const questPoints = await repo.getQuestPoints(playerId);

        state.questPoints = questPoints;

        for (const row of questRows) {
          if (row.status === "completed") {
            state.completedQuests.add(row.questId);
          } else if (row.status === "in_progress") {
            state.activeQuests.set(row.questId, {
              playerId,
              questId: row.questId,
              status: this.computeQuestStatus(row.questId, row),
              currentStage: row.currentStage || "",
              stageProgress: row.stageProgress || {},
              startedAt: row.startedAt ?? undefined,
              completedAt: row.completedAt ?? undefined,
            });
          }
        }
      }
    } catch (error) {
      this.logger.error(
        `Failed to load quest state for ${playerId}`,
        error instanceof Error ? error : undefined,
      );
    }

    this.playerStates.set(playerId, state);
    await this.queueQuestReceiptDrain(playerId);
  }

  /**
   * Compute the full quest status including derived "ready_to_complete"
   */
  private computeQuestStatus(
    questId: string,
    row: {
      status: QuestDbStatus;
      currentStage: string | null;
      stageProgress: StageProgress;
    },
  ): QuestStatus {
    if (row.status !== "in_progress") {
      return row.status;
    }

    const definition = this.questDefinitions.get(questId);
    if (!definition || !row.currentStage) {
      return "in_progress";
    }

    // Check if current stage objective is complete
    const stage = definition.stages.find((s) => s.id === row.currentStage);
    if (!stage) {
      return "in_progress";
    }

    if (stage.type === "kill" && stage.count && stage.target) {
      const kills = row.stageProgress.kills || 0;
      if (kills >= stage.count) {
        return "ready_to_complete";
      }
    }

    if (stage.type === "gather" && stage.count && stage.target) {
      // Progress is tracked by item ID (e.g., copper_ore, tin_ore)
      const gathered = row.stageProgress[stage.target] || 0;
      if (gathered >= stage.count) {
        return "ready_to_complete";
      }
    }

    if (stage.type === "interact" && stage.count && stage.target) {
      // Progress is tracked by target ID (e.g., fire, bronze_bar)
      const interacted = row.stageProgress[stage.target] || 0;
      if (interacted >= stage.count) {
        return "ready_to_complete";
      }
    }

    return "in_progress";
  }

  /**
   * Get quest status for a player (used by DialogueSystem for quest overrides)
   */
  public getQuestStatus(playerId: string, questId: string): QuestStatus {
    const state = this.playerStates.get(playerId);
    if (!state) {
      return "not_started";
    }

    if (state.completedQuests.has(questId)) {
      return "completed";
    }

    const active = state.activeQuests.get(questId);
    if (active) {
      return active.status;
    }

    return "not_started";
  }

  /**
   * Return whether a quest can be started from the current authoritative state.
   * This read is intentionally fail-closed and is rechecked by startQuest().
   */
  public canStartQuest(playerId: string, questId: string): boolean {
    const state = this.playerStates.get(playerId);
    const definition = this.questDefinitions.get(questId);
    if (!state || !definition) {
      return false;
    }

    if (state.completedQuests.has(questId) || state.activeQuests.has(questId)) {
      return false;
    }

    return this.checkRequirements(playerId, definition);
  }

  /**
   * Get all active quests for a player
   * Uses cached array to avoid allocations - cache invalidated on quest state changes
   */
  public getActiveQuests(playerId: string): QuestProgress[] {
    const state = this.playerStates.get(playerId);
    if (!state) {
      return this._emptyQuestArray;
    }

    // Return cached array if still valid
    if (
      !this._activeQuestsDirty.has(playerId) &&
      this._activeQuestsCache.has(playerId)
    ) {
      return this._activeQuestsCache.get(playerId)!;
    }

    // Rebuild cache
    const quests = Array.from(state.activeQuests.values());
    this._activeQuestsCache.set(playerId, quests);
    this._activeQuestsDirty.delete(playerId);
    return quests;
  }

  /**
   * Mark a player's active quests cache as dirty (needs rebuild)
   * Call this whenever quest state changes for a player
   */
  private markActiveQuestsDirty(playerId: string): void {
    this._activeQuestsDirty.add(playerId);
  }

  /**
   * Build stage lookup caches for O(1) access in hot paths
   * Called once per quest when loading manifest
   */
  private buildStageCaches(questId: string, definition: QuestDefinition): void {
    const byId = new Map<string, QuestStage>();
    const byIndex = new Map<string, number>();
    const byGatherTarget = new Map<string, QuestStage>();
    const byInteractTarget = new Map<string, QuestStage>();

    definition.stages.forEach((stage, index) => {
      byId.set(stage.id, stage);
      byIndex.set(stage.id, index);

      if (stage.type === "gather" && stage.target) {
        byGatherTarget.set(stage.target, stage);
      }
      if (stage.type === "interact" && stage.target) {
        byInteractTarget.set(stage.target, stage);
      }
    });

    this._stageByIdCache.set(questId, byId);
    this._stageIndexCache.set(questId, byIndex);
    this._gatherStageCache.set(questId, byGatherTarget);
    this._interactStageCache.set(questId, byInteractTarget);
  }

  /**
   * Ensure stage caches are built for a quest definition
   */
  private ensureStageCaches(questId: string): void {
    if (this._stageByIdCache.has(questId)) {
      return;
    }

    const definition = this.questDefinitions.get(questId);
    if (!definition) {
      return;
    }

    this.buildStageCaches(questId, definition);
  }

  /**
   * Get stage by ID using cache (O(1) instead of O(n))
   */
  private getStageById(
    questId: string,
    stageId: string,
  ): QuestStage | undefined {
    this.ensureStageCaches(questId);
    return this._stageByIdCache.get(questId)?.get(stageId);
  }

  /**
   * Get stage index using cache (O(1) instead of O(n))
   */
  private getStageIndex(questId: string, stageId: string): number {
    this.ensureStageCaches(questId);
    return this._stageIndexCache.get(questId)?.get(stageId) ?? -1;
  }

  /**
   * Get gather stage by item ID using cache (O(1) instead of O(n))
   */
  private getGatherStageByTarget(
    questId: string,
    itemId: string,
  ): QuestStage | undefined {
    this.ensureStageCaches(questId);
    return this._gatherStageCache.get(questId)?.get(itemId);
  }

  /**
   * Get interact stage by target using cache (O(1) instead of O(n))
   */
  private getInteractStageByTarget(
    questId: string,
    target: string,
  ): QuestStage | undefined {
    this.ensureStageCaches(questId);
    return this._interactStageCache.get(questId)?.get(target);
  }

  /**
   * Get quest definition by ID
   */
  public getQuestDefinition(questId: string): QuestDefinition | undefined {
    return this.questDefinitions.get(questId);
  }

  /**
   * Request to start a quest - shows confirmation screen to player
   *
   * Called when DialogueSystem processes a "startQuest:quest_id" effect
   * This emits QUEST_START_CONFIRM to show the quest accept screen
   */
  public requestQuestStart(playerId: string, questId: string): boolean {
    const state = this.playerStates.get(playerId);
    if (!state) {
      this.logger.warn(
        `Cannot request quest start: player ${playerId} not found`,
      );
      return false;
    }

    // Check if already started or completed
    if (state.completedQuests.has(questId)) {
      this.logger.info(`Quest ${questId} already completed for ${playerId}`);
      return false;
    }

    if (state.activeQuests.has(questId)) {
      this.logger.info(`Quest ${questId} already active for ${playerId}`);
      return false;
    }

    const definition = this.questDefinitions.get(questId);
    if (!definition) {
      this.logger.warn(`Quest definition not found: ${questId}`);
      return false;
    }

    // Check requirements
    if (!this.checkRequirements(playerId, definition)) {
      this.logger.info(
        `Player ${playerId} doesn't meet requirements for ${questId}`,
      );
      return false;
    }

    // Emit confirmation event to show quest start screen
    this.emitTypedEvent(EventType.QUEST_START_CONFIRM, {
      playerId,
      questId,
      questName: definition.name,
      description: definition.description,
      difficulty: definition.difficulty,
      requirements: {
        quests: definition.requirements?.quests || [],
        skills: definition.requirements?.skills || {},
        items: definition.requirements?.items || [],
      },
      rewards: {
        questPoints: definition.rewards.questPoints,
        items: definition.rewards.items || [],
        xp: definition.rewards.xp || {},
      },
    });

    this.logger.info(
      `Quest start confirmation shown for ${questId} to ${playerId}`,
    );
    return true;
  }

  /**
   * Start a quest for a player (actually starts the quest)
   *
   * Called when player accepts quest via QUEST_START_ACCEPTED event
   */
  public async startQuest(playerId: string, questId: string): Promise<boolean> {
    const state = this.playerStates.get(playerId);
    if (!state) {
      this.logger.warn(`Cannot start quest: player ${playerId} not found`);
      return false;
    }

    // Check if already started or completed
    if (state.completedQuests.has(questId)) {
      this.logger.info(`Quest ${questId} already completed for ${playerId}`);
      return false;
    }

    if (state.activeQuests.has(questId)) {
      this.logger.info(`Quest ${questId} already active for ${playerId}`);
      return false;
    }

    const definition = this.questDefinitions.get(questId);
    if (!definition) {
      this.logger.warn(`Quest definition not found: ${questId}`);
      return false;
    }

    // Check requirements
    if (!this.checkRequirements(playerId, definition)) {
      this.logger.info(
        `Player ${playerId} doesn't meet requirements for ${questId}`,
      );
      return false;
    }

    // Get the first non-dialogue stage (since the first dialogue stage is "talking to NPC")
    // The actual first stage is the kill stage in our case
    const firstKillStage = definition.stages.find((s) => s.type !== "dialogue");
    const initialStage =
      firstKillStage?.id || definition.stages[1]?.id || definition.stages[0].id;

    // Create quest progress
    const progress: QuestProgress = {
      playerId,
      questId,
      status: "in_progress",
      currentStage: initialStage,
      stageProgress: {},
      startedAt: Date.now(),
    };

    state.activeQuests.set(questId, progress);
    this.markActiveQuestsDirty(playerId);

    // Save to database (isNew=true since we just started the quest)
    await this.saveQuestProgress(
      playerId,
      questId,
      initialStage,
      {},
      true,
      progress.startedAt,
    );

    // Grant starting items
    if (definition.onStart?.items) {
      await this.grantItems(playerId, definition.onStart.items);
    }

    // Emit quest started event
    this.emitTypedEvent(EventType.QUEST_STARTED, {
      playerId,
      questId,
      questName: definition.name,
    });

    // Send chat message
    this.emitTypedEvent(EventType.CHAT_MESSAGE, {
      playerId,
      message: `You have started a new quest: ${definition.name}`,
      type: "game",
    });

    this.logger.info(`Player ${playerId} started quest: ${questId}`);
    return true;
  }

  /**
   * Complete a quest for a player
   *
   * Called when DialogueSystem processes a "completeQuest:quest_id" effect
   */
  public async completeQuest(
    playerId: string,
    questId: string,
  ): Promise<boolean> {
    const state = this.playerStates.get(playerId);
    if (!state) {
      return false;
    }

    const progress = state.activeQuests.get(questId);
    if (!progress) {
      this.logger.warn(`Quest ${questId} not active for ${playerId}`);
      return false;
    }

    // Verify quest is ready to complete
    if (progress.status !== "ready_to_complete") {
      this.logger.warn(
        `Quest ${questId} not ready to complete for ${playerId}`,
      );
      return false;
    }

    const definition = this.questDefinitions.get(questId);
    if (!definition) {
      return false;
    }

    // Move to completed
    state.activeQuests.delete(questId);
    state.completedQuests.add(questId);
    this.markActiveQuestsDirty(playerId);

    // Update in-memory quest points
    if (definition.rewards.questPoints > 0) {
      state.questPoints += definition.rewards.questPoints;
    }

    // Update database atomically (quest completion + quest points in transaction)
    await this.completeQuestWithPoints(
      playerId,
      questId,
      definition.rewards.questPoints,
    );

    // Grant reward items
    if (definition.rewards.items.length > 0) {
      this.logger.info(
        `[QuestSystem] Granting ${definition.rewards.items.length} reward items to ${playerId}`,
      );
      await this.grantItems(playerId, definition.rewards.items);
    }

    // Emit quest completed event (SkillsSystem will handle XP rewards)
    this.logger.info(
      `[QuestSystem] Emitting QUEST_COMPLETED for ${playerId}, quest ${questId}`,
    );
    this.emitTypedEvent(EventType.QUEST_COMPLETED, {
      playerId,
      questId,
      questName: definition.name,
      rewards: definition.rewards,
    });

    this.logger.info(`Player ${playerId} completed quest: ${questId}`);
    return true;
  }

  /**
   * Handle NPC death for kill quest tracking
   */
  private async handleNPCDied(data: NPCDiedPayload): Promise<void> {
    const { killedBy, mobType, mobId, timestamp, killToken } = data;

    // Validate kill token to prevent spoofed events
    if (timestamp && killToken && mobId) {
      if (!validateKillToken(mobId, killedBy, timestamp, killToken)) {
        this.logger.warn(
          `Invalid kill token for ${killedBy} killing ${mobId} - possible spoof attempt`,
        );
        return;
      }
    }

    // Info-level logging for kill tracking visibility
    this.logger.info(`[Quest] Kill: player=${killedBy}, mobType=${mobType}`);

    const state = this.playerStates.get(killedBy);
    if (!state) {
      this.logger.warn(
        `[Quest] No player state for ${killedBy} - kills not tracked`,
      );
      return;
    }

    this.logger.info(
      `[Quest] Player ${killedBy}: ${state.activeQuests.size} active quests`,
    );

    // Check all active quests for kill objectives
    for (const [questId, progress] of state.activeQuests) {
      const definition = this.questDefinitions.get(questId);
      if (!definition) {
        continue;
      }

      // Use cached lookup (O(1) instead of O(n))
      const stage = this.getStageById(questId, progress.currentStage);
      if (!stage) {
        continue;
      }

      if (stage.type !== "kill") {
        continue;
      }

      // Check if this mob matches the target
      const targetType = stage.target;
      if (!targetType || mobType !== targetType) {
        continue;
      }

      // Increment kill count (direct mutation to avoid GC pressure)
      progress.stageProgress.kills = (progress.stageProgress.kills || 0) + 1;
      const kills = progress.stageProgress.kills;
      this.markActiveQuestsDirty(killedBy);

      // Log at info level only for milestones (first, halfway, complete)
      const requiredCount = stage.count || 1;
      const halfway = Math.floor(requiredCount / 2);
      if (kills === 1 || kills === halfway || kills >= requiredCount) {
        this.logger.info(`Quest ${questId}: ${kills}/${requiredCount} kills`);
      }

      // Check if objective complete
      if (stage.count && kills >= stage.count) {
        progress.status = "ready_to_complete";

        // Send chat message that objective is complete
        this.emitTypedEvent(EventType.CHAT_MESSAGE, {
          playerId: killedBy,
          message: `You've killed enough ${targetType}s. Return to ${definition.startNpc.replace(/_/g, " ")}.`,
          type: "game",
        });
      }

      // Save progress (isNew=false since this is an update)
      await this.queueQuestProgressSave(
        killedBy,
        questId,
        progress.currentStage,
        progress.stageProgress,
        false,
      );

      // Emit progress event (include stage details so clients don't need a round-trip)
      this.emitTypedEvent(EventType.QUEST_PROGRESSED, {
        playerId: killedBy,
        questId,
        stage: progress.currentStage,
        progress: progress.stageProgress,
        description: stage.description,
        stageType: stage.type,
        stageTarget: stage.target,
        stageCount: stage.count,
      });
    }
  }

  /**
   * Queue one authoritative scan so gathering and processing edges cannot race.
   * Gathering drains first because it commonly unlocks the following
   * processing stage; the processing scan also closes missed wake-up events.
   */
  private queueQuestReceiptDrain(playerId: string): Promise<void> {
    const previous =
      this.questReceiptDrainTails.get(playerId) ?? Promise.resolve();
    const drain = previous
      .catch(() => {})
      .then(async () => {
        await this.drainGatheringProgressReceipts(playerId);
        await this.drainProcessingProgressReceipts(playerId);
      });
    this.questReceiptDrainTails.set(playerId, drain);
    return drain.finally(() => {
      if (this.questReceiptDrainTails.get(playerId) === drain) {
        this.questReceiptDrainTails.delete(playerId);
      }
    });
  }

  /**
   * Recover and resolve the immutable quest contexts captured by gathering
   * custody. Absence of this production repository fails closed: event payloads
   * alone are never accepted as quest authority.
   */
  private async drainGatheringProgressReceipts(
    playerId: string,
  ): Promise<void> {
    if (!this.playerStates.has(playerId)) return;
    const dbSystem = this.world.getSystem("database") as {
      getQuestRepository?: () => Partial<DurableGatheringProgressRepository>;
    };
    const candidate = dbSystem?.getQuestRepository?.();
    if (
      !candidate?.getPendingGatheringProgressReceipts ||
      !candidate.applyGatheringProgressReceipt ||
      !candidate.retireGatheringProgressReceipt ||
      !candidate.ignoreGatheringProgressReceipt
    ) {
      return;
    }
    const repository = candidate as DurableGatheringProgressRepository;
    const receipts =
      await repository.getPendingGatheringProgressReceipts(playerId);
    for (const receipt of receipts) {
      if (
        receipt.playerId !== playerId ||
        !receipt.operationId.startsWith("gathering-reward:") ||
        !receipt.questId ||
        !Number.isSafeInteger(receipt.questStartedAt) ||
        receipt.questStartedAt < 0 ||
        !receipt.capturedStage ||
        !receipt.rewardItemId ||
        !Number.isSafeInteger(receipt.rewardQuantity) ||
        receipt.rewardQuantity <= 0 ||
        !Number.isSafeInteger(receipt.createdAt) ||
        receipt.createdAt < 0
      ) {
        throw new Error("quest_gathering_progress_receipt_invalid");
      }
      await this.applyGatheringProgressReceipt(repository, receipt);
    }
  }

  private async applyGatheringProgressReceipt(
    repository: DurableGatheringProgressRepository,
    receipt: DurableGatheringProgressReceipt,
  ): Promise<void> {
    const state = this.playerStates.get(receipt.playerId);
    const progress = state?.activeQuests.get(receipt.questId);
    const definition = this.questDefinitions.get(receipt.questId);
    if (!state) return;
    if (!progress || progress.startedAt !== receipt.questStartedAt) {
      const retirement =
        await repository.retireGatheringProgressReceipt(receipt);
      if (retirement === "still_active") {
        throw new Error("quest_gathering_progress_memory_desynchronized");
      }
      return;
    }
    if (!definition) {
      throw new Error("quest_gathering_progress_definition_missing");
    }
    const relevantStage = this.getGatherStageByTarget(
      receipt.questId,
      receipt.rewardItemId,
    );
    if (!relevantStage) {
      await repository.ignoreGatheringProgressReceipt(receipt);
      return;
    }

    for (let attempt = 0; attempt < 4; attempt++) {
      const originalStage = progress.currentStage;
      const originalStatus = progress.status;
      const originalStageDefinition = this.getStageById(
        receipt.questId,
        originalStage,
      );
      const nextCount =
        (progress.stageProgress[receipt.rewardItemId] ?? 0) +
        receipt.rewardQuantity;
      if (!Number.isSafeInteger(nextCount) || nextCount <= 0) {
        throw new Error("quest_gathering_progress_state_invalid");
      }
      const candidate: QuestProgress = {
        ...progress,
        stageProgress: {
          ...progress.stageProgress,
          [receipt.rewardItemId]: nextCount,
        },
      };
      this.advanceThroughCompletedStages(
        receipt.playerId,
        receipt.questId,
        candidate,
        definition,
      );

      const result = await repository.applyGatheringProgressReceipt({
        ...receipt,
        expectedCurrentStage: originalStage,
        expectedProgress: { ...progress.stageProgress },
        resultingStage: candidate.currentStage,
        resultingProgress: candidate.stageProgress,
      });
      if (result.status === "retired") return;
      if (result.status === "stale") {
        progress.currentStage = result.currentStage;
        progress.stageProgress = { ...result.stageProgress };
        progress.status = this.computeQuestStatus(receipt.questId, {
          status: "in_progress",
          currentStage: result.currentStage,
          stageProgress: result.stageProgress,
        });
        continue;
      }

      progress.currentStage = result.currentStage;
      progress.stageProgress = { ...result.stageProgress };
      progress.status = this.computeQuestStatus(receipt.questId, {
        status: "in_progress",
        currentStage: result.currentStage,
        stageProgress: result.stageProgress,
      });
      this.markActiveQuestsDirty(receipt.playerId);

      const currentCount = progress.stageProgress[receipt.rewardItemId] ?? 0;
      const requiredCount = relevantStage.count || 1;
      const halfway = Math.floor(requiredCount / 2);
      if (
        currentCount === receipt.rewardQuantity ||
        currentCount === halfway ||
        currentCount >= requiredCount
      ) {
        this.logger.info(
          `Quest ${receipt.questId}: gathered ${currentCount}/${requiredCount} ${receipt.rewardItemId}`,
        );
      }
      if (
        progress.status === "ready_to_complete" &&
        originalStatus !== "ready_to_complete"
      ) {
        this.emitTypedEvent(EventType.CHAT_MESSAGE, {
          playerId: receipt.playerId,
          message: `Quest objective complete! Return to ${definition.startNpc.replace(/_/g, " ")}.`,
          type: "game",
        });
      } else if (progress.currentStage !== originalStage) {
        const nextStage = this.getStageById(
          receipt.questId,
          progress.currentStage,
        );
        if (nextStage) {
          this.emitTypedEvent(EventType.CHAT_MESSAGE, {
            playerId: receipt.playerId,
            message: `New objective: ${nextStage.description}`,
            type: "game",
          });
        }
      }

      const emitStage = originalStageDefinition || relevantStage;
      this.emitTypedEvent(EventType.QUEST_PROGRESSED, {
        playerId: receipt.playerId,
        questId: receipt.questId,
        stage: progress.currentStage,
        progress: progress.stageProgress,
        description: emitStage.description,
        stageType: emitStage.type,
        stageTarget: emitStage.target,
        stageCount: emitStage.count,
      });
      return;
    }
    throw new Error("quest_gathering_progress_stale_retry_exhausted");
  }

  /**
   * Recover immutable interact-stage edges captured in the same transaction as
   * their inventory, skill, coin, consumable, and world-effect custody.
   */
  private async drainProcessingProgressReceipts(
    playerId: string,
  ): Promise<void> {
    if (!this.playerStates.has(playerId)) return;
    const dbSystem = this.world.getSystem("database") as {
      getQuestRepository?: () => Partial<DurableProcessingProgressRepository>;
    };
    const candidate = dbSystem?.getQuestRepository?.();
    if (
      !candidate?.getPendingProcessingProgressReceipts ||
      !candidate.applyProcessingProgressReceipt ||
      !candidate.retireProcessingProgressReceipt ||
      !candidate.ignoreProcessingProgressReceipt
    ) {
      return;
    }
    const repository = candidate as DurableProcessingProgressRepository;
    const receipts =
      await repository.getPendingProcessingProgressReceipts(playerId);
    for (const receipt of receipts) {
      if (
        receipt.playerId !== playerId ||
        !receipt.operationId ||
        receipt.operationId.length > 256 ||
        !receipt.questId ||
        !Number.isSafeInteger(receipt.questStartedAt) ||
        receipt.questStartedAt < 0 ||
        !receipt.capturedStage ||
        !receipt.targetId ||
        !Number.isSafeInteger(receipt.quantity) ||
        receipt.quantity <= 0 ||
        !Number.isSafeInteger(receipt.createdAt) ||
        receipt.createdAt < 0
      ) {
        throw new Error("quest_processing_progress_receipt_invalid");
      }
      await this.applyProcessingProgressReceipt(repository, receipt);
    }
  }

  private async applyProcessingProgressReceipt(
    repository: DurableProcessingProgressRepository,
    receipt: DurableProcessingProgressReceipt,
  ): Promise<void> {
    const state = this.playerStates.get(receipt.playerId);
    const progress = state?.activeQuests.get(receipt.questId);
    const definition = this.questDefinitions.get(receipt.questId);
    if (!state) return;
    if (!progress || progress.startedAt !== receipt.questStartedAt) {
      const retirement =
        await repository.retireProcessingProgressReceipt(receipt);
      if (retirement === "still_active") {
        throw new Error("quest_processing_progress_memory_desynchronized");
      }
      return;
    }
    if (!definition) {
      throw new Error("quest_processing_progress_definition_missing");
    }
    const relevantStage = this.getInteractStageByTarget(
      receipt.questId,
      receipt.targetId,
    );
    if (!relevantStage) {
      await repository.ignoreProcessingProgressReceipt(receipt);
      return;
    }

    for (let attempt = 0; attempt < 4; attempt++) {
      const originalStage = progress.currentStage;
      const originalStatus = progress.status;
      const originalStageDefinition = this.getStageById(
        receipt.questId,
        originalStage,
      );
      const nextCount =
        (progress.stageProgress[receipt.targetId] ?? 0) + receipt.quantity;
      if (!Number.isSafeInteger(nextCount) || nextCount <= 0) {
        throw new Error("quest_processing_progress_state_invalid");
      }
      const candidate: QuestProgress = {
        ...progress,
        stageProgress: {
          ...progress.stageProgress,
          [receipt.targetId]: nextCount,
        },
      };
      this.advanceThroughCompletedStages(
        receipt.playerId,
        receipt.questId,
        candidate,
        definition,
      );

      const result = await repository.applyProcessingProgressReceipt({
        ...receipt,
        expectedCurrentStage: originalStage,
        expectedProgress: { ...progress.stageProgress },
        resultingStage: candidate.currentStage,
        resultingProgress: candidate.stageProgress,
      });
      if (result.status === "retired") return;
      if (result.status === "stale") {
        progress.currentStage = result.currentStage;
        progress.stageProgress = { ...result.stageProgress };
        progress.status = this.computeQuestStatus(receipt.questId, {
          status: "in_progress",
          currentStage: result.currentStage,
          stageProgress: result.stageProgress,
        });
        continue;
      }

      progress.currentStage = result.currentStage;
      progress.stageProgress = { ...result.stageProgress };
      progress.status = this.computeQuestStatus(receipt.questId, {
        status: "in_progress",
        currentStage: result.currentStage,
        stageProgress: result.stageProgress,
      });
      this.markActiveQuestsDirty(receipt.playerId);

      const currentCount = progress.stageProgress[receipt.targetId] ?? 0;
      const requiredCount = relevantStage.count || 1;
      const halfway = Math.floor(requiredCount / 2);
      if (
        currentCount === receipt.quantity ||
        currentCount === halfway ||
        currentCount >= requiredCount
      ) {
        this.logger.info(
          `Quest ${receipt.questId}: processed ${currentCount}/${requiredCount} ${receipt.targetId}`,
        );
      }
      if (
        progress.status === "ready_to_complete" &&
        originalStatus !== "ready_to_complete"
      ) {
        this.emitTypedEvent(EventType.CHAT_MESSAGE, {
          playerId: receipt.playerId,
          message: `Quest objective complete! Return to ${definition.startNpc.replace(/_/g, " ")}.`,
          type: "game",
        });
      } else if (progress.currentStage !== originalStage) {
        const nextStage = this.getStageById(
          receipt.questId,
          progress.currentStage,
        );
        if (nextStage) {
          this.emitTypedEvent(EventType.CHAT_MESSAGE, {
            playerId: receipt.playerId,
            message: `New objective: ${nextStage.description}`,
            type: "game",
          });
        }
      }

      const emitStage = originalStageDefinition || relevantStage;
      this.emitTypedEvent(EventType.QUEST_PROGRESSED, {
        playerId: receipt.playerId,
        questId: receipt.questId,
        stage: progress.currentStage,
        progress: progress.stageProgress,
        description: emitStage.description,
        stageType: emitStage.type,
        stageTarget: emitStage.target,
        stageCount: emitStage.count,
      });
      return;
    }
    throw new Error("quest_processing_progress_stale_retry_exhausted");
  }

  /**
   * Serialize saves for one quest and capture an immutable progress snapshot.
   * Without this queue, a slower earlier database write can overwrite a newer
   * stage/count, and passing the live mutable object can change the payload
   * underneath an in-flight repository call.
   */
  private queueQuestProgressSave(
    playerId: string,
    questId: string,
    stage: string,
    progress: StageProgress,
    isNew: boolean,
  ): Promise<void> {
    const key = `${playerId}\0${questId}`;
    const snapshot = { ...progress };
    const previous = this.questProgressSaveTails.get(key) ?? Promise.resolve();
    const save = previous
      .catch(() => {})
      .then(() =>
        this.saveQuestProgress(playerId, questId, stage, snapshot, isNew),
      );
    this.questProgressSaveTails.set(key, save);
    return save.finally(() => {
      if (this.questProgressSaveTails.get(key) === save) {
        this.questProgressSaveTails.delete(key);
      }
    });
  }

  /**
   * Advance across every objective already satisfied by source-authentic
   * progress. This preserves flexible preparation order without requiring an
   * agent to repeat a valid action merely because an earlier receipt drained
   * later.
   */
  private advanceThroughCompletedStages(
    playerId: string,
    questId: string,
    progress: QuestProgress,
    definition: QuestDefinition,
  ): void {
    for (let step = 0; step <= definition.stages.length; step++) {
      if (progress.status === "ready_to_complete") return;
      const stage = this.getStageById(questId, progress.currentStage);
      if (!stage?.target || !stage.count) return;
      const completed =
        stage.type === "kill"
          ? (progress.stageProgress.kills ?? 0) >= stage.count
          : stage.type === "gather" || stage.type === "interact"
            ? (progress.stageProgress[stage.target] ?? 0) >= stage.count
            : false;
      if (!completed) return;

      const previousStage = progress.currentStage;
      this.advanceToNextStage(playerId, questId, progress, definition, false);
      if (progress.currentStage === previousStage) return;
    }
    throw new Error("quest_progress_stage_advance_cycle");
  }

  /**
   * Advance quest to next stage, or mark ready_to_complete if at final objective
   */
  private advanceToNextStage(
    playerId: string,
    questId: string,
    progress: QuestProgress,
    definition: QuestDefinition,
    emitMessages: boolean = true,
  ): void {
    // Use cached index lookup (O(1) instead of O(n))
    const currentIndex = this.getStageIndex(questId, progress.currentStage);

    // Find next stage
    let nextStage = definition.stages[currentIndex + 1];

    // Skip dialogue stages to find next objective
    while (nextStage && nextStage.type === "dialogue") {
      // Use cached index lookup (O(1) instead of O(n))
      const nextStageIndex = this.getStageIndex(questId, nextStage.id);
      const afterDialogue = definition.stages[nextStageIndex + 1];
      if (!afterDialogue || afterDialogue.type === "dialogue") {
        // This is the final "return to NPC" dialogue - quest is ready to complete
        progress.status = "ready_to_complete";
        if (emitMessages) {
          this.emitTypedEvent(EventType.CHAT_MESSAGE, {
            playerId,
            message: `Quest objective complete! Return to ${definition.startNpc.replace(/_/g, " ")}.`,
            type: "game",
          });
        }
        return;
      }
      nextStage = afterDialogue;
    }

    if (
      nextStage &&
      (nextStage.type === "gather" ||
        nextStage.type === "interact" ||
        nextStage.type === "kill")
    ) {
      // Move to next objective stage
      progress.currentStage = nextStage.id;
      // Don't reset stageProgress - keep tracked item counts for flexible completion order

      // Check if this stage is already complete (player pre-gathered items)
      if (
        (nextStage.type === "gather" || nextStage.type === "interact") &&
        nextStage.target &&
        nextStage.count
      ) {
        const existingProgress = progress.stageProgress[nextStage.target] || 0;
        if (existingProgress >= nextStage.count) {
          // This stage is already complete, advance again
          this.advanceToNextStage(
            playerId,
            questId,
            progress,
            definition,
            emitMessages,
          );
          return;
        }
      }

      if (emitMessages) {
        this.emitTypedEvent(EventType.CHAT_MESSAGE, {
          playerId,
          message: `New objective: ${nextStage.description}`,
          type: "game",
        });
      }
    } else {
      // No more objective stages - ready to complete
      progress.status = "ready_to_complete";
      if (emitMessages) {
        this.emitTypedEvent(EventType.CHAT_MESSAGE, {
          playerId,
          message: `Quest objective complete! Return to ${definition.startNpc.replace(/_/g, " ")}.`,
          type: "game",
        });
      }
    }
  }

  /**
   * Check if player meets quest requirements
   */
  private checkRequirements(
    playerId: string,
    definition: QuestDefinition,
  ): boolean {
    const state = this.playerStates.get(playerId);
    if (!state) return false;

    // Check prerequisite quests
    for (const prereqQuestId of definition.requirements.quests) {
      if (!state.completedQuests.has(prereqQuestId)) {
        return false;
      }
    }

    // Check skill requirements
    const skills = definition.requirements.skills;
    for (const [skillName, requiredLevel] of Object.entries(skills)) {
      const playerLevel = this.world.getSkillLevel?.(playerId, skillName) ?? 1;
      if (playerLevel < requiredLevel) {
        return false;
      }
    }

    // Check item requirements - player must have all required items
    const items = definition.requirements.items;
    for (const itemId of items) {
      const hasItem = this.world.hasItem?.(playerId, itemId, 1) ?? false;
      if (!hasItem) {
        return false;
      }
    }

    return true;
  }

  /**
   * Grant items to player (via InventorySystem)
   */
  private async grantItems(
    playerId: string,
    items: Array<{ itemId: string; quantity: number }>,
  ): Promise<void> {
    for (const { itemId, quantity } of items) {
      this.emitTypedEvent(EventType.INVENTORY_ITEM_ADDED, {
        playerId,
        item: {
          itemId,
          quantity,
          slot: -1, // Let inventory system find a slot
        },
      });
    }
  }

  /**
   * Save quest progress to database
   * @param isNew - true if this is a new quest being started, false if updating existing progress
   */
  private async saveQuestProgress(
    playerId: string,
    questId: string,
    stage: string,
    progress: StageProgress,
    isNew: boolean,
    startedAt?: number,
  ): Promise<void> {
    try {
      const dbSystem = this.world.getSystem("database") as {
        getQuestRepository?: () => {
          startQuest: (
            playerId: string,
            questId: string,
            initialStage: string,
            startedAt?: number,
          ) => Promise<void>;
          updateProgress: (
            playerId: string,
            questId: string,
            stage: string,
            progress: StageProgress,
          ) => Promise<void>;
        };
      };

      if (dbSystem?.getQuestRepository) {
        const repo = dbSystem.getQuestRepository();

        if (isNew) {
          await repo.startQuest(playerId, questId, stage, startedAt);
        } else {
          await repo.updateProgress(playerId, questId, stage, progress);
        }
      }
    } catch (error) {
      this.logger.error(
        `Failed to save quest progress for ${playerId}`,
        error instanceof Error ? error : undefined,
      );
    }
  }

  /**
   * Complete quest and award points atomically in database
   * Uses a transaction to ensure consistency
   */
  private async completeQuestWithPoints(
    playerId: string,
    questId: string,
    questPoints: number,
  ): Promise<void> {
    try {
      const dbSystem = this.world.getSystem("database") as {
        getQuestRepository?: () => {
          completeQuestWithPoints: (
            playerId: string,
            questId: string,
            questPoints: number,
          ) => Promise<void>;
        };
      };

      if (dbSystem?.getQuestRepository) {
        await dbSystem
          .getQuestRepository()
          .completeQuestWithPoints(playerId, questId, questPoints);
      }
    } catch (error) {
      this.logger.error(
        `Failed to complete quest ${questId} for ${playerId}`,
        error instanceof Error ? error : undefined,
      );
    }
  }

  /**
   * Abandon an active quest for a player
   *
   * Removes the quest from active quests and deletes progress from database
   */
  public async abandonQuest(
    playerId: string,
    questId: string,
  ): Promise<boolean> {
    const state = this.playerStates.get(playerId);
    if (!state) {
      this.logger.warn(`Cannot abandon quest: player ${playerId} not found`);
      return false;
    }

    const progress = state.activeQuests.get(questId);
    if (!progress) {
      this.logger.warn(`Quest ${questId} not active for ${playerId}`);
      return false;
    }

    const definition = this.questDefinitions.get(questId);
    const questName = definition?.name || questId;

    // Remove from active quests
    state.activeQuests.delete(questId);
    this.markActiveQuestsDirty(playerId);

    // Delete from database
    try {
      const dbSystem = this.world.getSystem("database") as {
        getQuestRepository?: () => {
          abandonQuest: (playerId: string, questId: string) => Promise<void>;
        };
      };

      if (dbSystem?.getQuestRepository) {
        await dbSystem.getQuestRepository().abandonQuest(playerId, questId);
      }
    } catch (error) {
      this.logger.error(
        `Failed to delete quest ${questId} from database for ${playerId}`,
        error instanceof Error ? error : undefined,
      );
    }

    // Send chat message
    this.emitTypedEvent(EventType.CHAT_MESSAGE, {
      playerId,
      message: `You have abandoned the quest: ${questName}`,
      type: "game",
    });

    // Emit quest abandoned event
    this.emitTypedEvent(EventType.QUEST_ABANDONED, {
      playerId,
      questId,
      questName,
    });

    this.logger.info(`Player ${playerId} abandoned quest: ${questId}`);
    return true;
  }

  /**
   * Get player's quest points
   */
  public getQuestPoints(playerId: string): number {
    return this.playerStates.get(playerId)?.questPoints || 0;
  }

  /**
   * Check if player has completed a quest
   */
  public hasCompletedQuest(playerId: string, questId: string): boolean {
    return (
      this.playerStates.get(playerId)?.completedQuests.has(questId) || false
    );
  }

  /**
   * Get all quest definitions (for quest journal)
   */
  public getAllQuestDefinitions(): QuestDefinition[] {
    return Array.from(this.questDefinitions.values());
  }
}
