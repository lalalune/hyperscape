/**
 * Quest System
 *
 * Server-side quest tracking system that:
 * - Loads quest definitions from quest-definitions.json
 * - Tracks active quests per player
 * - Listens to game events (kills, pickups, dialogue, gathering)
 * - Updates objective progress automatically
 * - Completes quests and grants rewards
 *
 * Event Listeners:
 * - EventType.ENTITY_DEATH → check kill objectives
 * - EventType.ITEM_PICKUP → check collection objectives
 * - EventType.NPC_DIALOGUE → check talk objectives
 * - EventType.RESOURCE_GATHERED → check gathering objectives
 */

import { SystemBase } from './SystemBase';
import type { World } from '../types';
import { EventType } from '../types/events';
import type {
  QuestDefinition,
  QuestProgress,
  QuestObjective,
  QuestObjectiveType,
  PlayerQuestState
} from '../types/quest';
import { promises as fs } from 'fs';
import path from 'path';

/**
 * Entity Death Event Data
 */
interface EntityDeathEvent {
  entityId: string;
  sourceId?: string;
  entityType?: string;
}

/**
 * Item Pickup Event Data
 */
interface ItemPickupEvent {
  playerId: string;
  itemId?: string;
  entityId: string;
}

/**
 * NPC Dialogue Event Data
 */
interface NPCDialogueEvent {
  playerId: string;
  npcId: string;
}

/**
 * Resource Gathered Event Data
 */
interface ResourceGatheredEvent {
  playerId: string;
  resourceId: string;
  resourceType: string;
  itemsReceived: Array<{ itemId: string; quantity: number }>;
}

/**
 * Quest System
 * Manages quest tracking, progress, and completion
 */
export class QuestSystem extends SystemBase {
  private questDefinitions: Map<string, QuestDefinition> = new Map();
  private playerQuests: Map<string, Map<string, QuestProgress>> = new Map(); // playerId -> questId -> progress

  constructor(world: World) {
    super(world, {
      name: 'quest',
      dependencies: {
        required: [],
        optional: ['inventory', 'combat']
      },
      autoCleanup: true
    });
  }

  /**
   * Initialize the quest system
   */
  async init(): Promise<void> {
    this.logger.info('Initializing Quest System...');

    // Load quest definitions
    await this.loadQuestDefinitions();

    // Setup event listeners
    this.setupEventListeners();

    this.logger.info(`Quest System initialized with ${this.questDefinitions.size} quests`);
  }

  /**
   * Load quest definitions from quest-definitions.json
   */
  private async loadQuestDefinitions(): Promise<void> {
    try {
      const questFilePath = path.join(__dirname, '../data/quest-definitions.json');
      const questFileContent = await fs.readFile(questFilePath, 'utf-8');
      const questData: { quests: Record<string, QuestDefinition> } = JSON.parse(questFileContent);

      // Load each quest into the map
      for (const [questId, questDef] of Object.entries(questData.quests)) {
        this.questDefinitions.set(questId, questDef);
        this.logger.info(`Loaded quest: ${questDef.name} (${questId})`);
      }
    } catch (error) {
      const errorObj = error instanceof Error ? error : new Error(String(error));
      this.logger.error('Failed to load quest definitions:', errorObj);
      throw errorObj;
    }
  }

  /**
   * Setup event listeners for quest tracking
   */
  private setupEventListeners(): void {
    // Listen for entity deaths (kill objectives)
    this.subscribe(EventType.ENTITY_DEATH, (data) => this.onEntityDeath(data as unknown as EntityDeathEvent));

    // Listen for item pickups (collection objectives)
    this.subscribe(EventType.ITEM_PICKUP, (data) => this.onItemPickup(data as unknown as ItemPickupEvent));

    // Listen for NPC dialogue (talk objectives)
    this.subscribe(EventType.NPC_DIALOGUE, (data) => this.onNPCDialogue(data as unknown as NPCDialogueEvent));

    // Listen for resource gathering (gathering objectives)
    this.subscribe(EventType.RESOURCE_GATHERED, (data) => this.onResourceGathered(data as unknown as ResourceGatheredEvent));

    // Listen for player registration (initialize quest tracking)
    this.subscribe(EventType.PLAYER_REGISTERED, (data) => {
      const playerId = (data as { playerId: string }).playerId;
      this.initializePlayerQuests(playerId);
    });

    // Listen for player cleanup
    this.subscribe(EventType.PLAYER_UNREGISTERED, (data) => {
      const playerId = (data as { playerId: string }).playerId;
      this.cleanupPlayerQuests(playerId);
    });
  }

  /**
   * Initialize quest tracking for a player
   */
  private initializePlayerQuests(playerId: string): void {
    if (!this.playerQuests.has(playerId)) {
      this.playerQuests.set(playerId, new Map());
      this.logger.info(`Initialized quest tracking for player: ${playerId}`);
    }
  }

  /**
   * Cleanup quest tracking when player leaves
   */
  private cleanupPlayerQuests(playerId: string): void {
    this.playerQuests.delete(playerId);
    this.logger.info(`Cleaned up quest tracking for player: ${playerId}`);
  }

  /**
   * Start a quest for a player
   */
  public startQuest(playerId: string, questId: string): void {
    const questDef = this.questDefinitions.get(questId);
    if (!questDef) {
      this.logger.warn(`Quest not found: ${questId}`);
      return;
    }

    // Check if player can start this quest
    if (!this.canPlayerStartQuest(playerId, questId)) {
      this.logger.warn(`Player ${playerId} cannot start quest ${questId}`);
      return;
    }

    // Initialize quest progress
    const progress: QuestProgress = {
      questId,
      startTime: Date.now(),
      objectives: questDef.objectives.map(obj => ({ ...obj })) // Clone objectives
    };

    // Get or create player's quest map
    let playerQuestMap = this.playerQuests.get(playerId);
    if (!playerQuestMap) {
      playerQuestMap = new Map();
      this.playerQuests.set(playerId, playerQuestMap);
    }

    // Add quest to player's active quests
    playerQuestMap.set(questId, progress);

    // Emit quest started event
    this.emitTypedEvent(EventType.QUEST_STARTED, {
      playerId,
      questId,
      quest: questDef,
      progress
    });

    this.logger.info(`Player ${playerId} started quest: ${questDef.name}`);
  }

  /**
   * Check if player can start a quest
   */
  public canPlayerStartQuest(playerId: string, questId: string): boolean {
    const questDef = this.questDefinitions.get(questId);
    if (!questDef) {
      return false;
    }

    // Check if quest is already active
    const playerQuestMap = this.playerQuests.get(playerId);
    if (playerQuestMap?.has(questId)) {
      return false;
    }

    // TODO: Check player level requirement
    // TODO: Check if quest is already completed (if not repeatable)

    return true;
  }

  /**
   * Get active quests for a player
   */
  public getActiveQuests(playerId: string): QuestProgress[] {
    const playerQuestMap = this.playerQuests.get(playerId);
    if (!playerQuestMap) {
      return [];
    }

    return Array.from(playerQuestMap.values());
  }

  /**
   * Update a specific objective's progress
   */
  public updateObjective(playerId: string, questId: string, objectiveId: string, amount: number): void {
    const playerQuestMap = this.playerQuests.get(playerId);
    if (!playerQuestMap) {
      return;
    }

    const progress = playerQuestMap.get(questId);
    if (!progress) {
      return;
    }

    // Find the objective
    const objective = progress.objectives.find(obj => obj.id === objectiveId);
    if (!objective) {
      return;
    }

    // Update progress
    const previousProgress = objective.current;
    objective.current = Math.min(objective.current + amount, objective.required);

    // Check if objective is now complete
    const isComplete = objective.current >= objective.required;

    // Emit progress update
    this.emitTypedEvent(EventType.QUEST_PROGRESSED, {
      playerId,
      questId,
      objectiveId,
      previousProgress,
      currentProgress: objective.current,
      required: objective.required,
      isComplete
    });

    // Check if all objectives are complete
    if (this.areAllObjectivesComplete(progress)) {
      this.completeQuest(playerId, questId);
    }
  }

  /**
   * Check if all quest objectives are complete
   */
  private areAllObjectivesComplete(progress: QuestProgress): boolean {
    return progress.objectives.every(obj => obj.current >= obj.required);
  }

  /**
   * Complete a quest for a player
   */
  public completeQuest(playerId: string, questId: string): void {
    const playerQuestMap = this.playerQuests.get(playerId);
    if (!playerQuestMap) {
      return;
    }

    const progress = playerQuestMap.get(questId);
    if (!progress) {
      return;
    }

    const questDef = this.questDefinitions.get(questId);
    if (!questDef) {
      return;
    }

    // Grant rewards
    this.grantRewards(playerId, questDef);

    // Remove from active quests
    playerQuestMap.delete(questId);

    // Emit completion event
    this.emitTypedEvent(EventType.QUEST_COMPLETED, {
      playerId,
      questId,
      quest: questDef,
      completionTime: Date.now(),
      duration: Date.now() - progress.startTime
    });

    this.logger.info(`Player ${playerId} completed quest: ${questDef.name}`);
  }

  /**
   * Grant quest rewards to player
   */
  private grantRewards(playerId: string, quest: QuestDefinition): void {
    const rewards = quest.rewards;

    // Grant XP rewards
    if (rewards.xp) {
      for (const [skill, xpAmount] of Object.entries(rewards.xp)) {
        this.emitTypedEvent(EventType.PLAYER_XP_GAINED, {
          playerId,
          skill,
          amount: xpAmount
        });
      }
    }

    // Grant coin rewards
    if (rewards.coins && rewards.coins > 0) {
      this.emitTypedEvent(EventType.INVENTORY_ADD_COINS, {
        playerId,
        amount: rewards.coins
      });
    }

    // Grant item rewards
    if (rewards.items && rewards.items.length > 0) {
      for (const itemReward of rewards.items) {
        this.emitTypedEvent(EventType.INVENTORY_ITEM_ADDED, {
          playerId,
          item: {
            id: `reward_${Date.now()}`,
            itemId: itemReward.itemId,
            quantity: itemReward.quantity,
            slot: -1,
            metadata: null
          }
        });
      }
    }

    // Grant faction reputation rewards
    if (rewards.factionReputation) {
      for (const [faction, reputation] of Object.entries(rewards.factionReputation)) {
        this.emitTypedEvent(EventType.FACTION_REPUTATION_CHANGED, {
          playerId,
          faction,
          amount: reputation
        });
      }
    }

    this.logger.info(`Granted rewards for quest ${quest.id} to player ${playerId}`);
  }

  /**
   * Handle entity death events (kill objectives)
   */
  private onEntityDeath(data: EntityDeathEvent): void {
    const { entityId, sourceId, entityType } = data;

    // Only process if we have a source player
    if (!sourceId) {
      return;
    }

    // Get player's active quests
    const playerQuestMap = this.playerQuests.get(sourceId);
    if (!playerQuestMap) {
      return;
    }

    // Check each active quest for kill objectives
    for (const [questId, progress] of playerQuestMap.entries()) {
      for (const objective of progress.objectives) {
        if (objective.type === 'kill_mob' && objective.current < objective.required) {
          // Check if this mob matches the objective target
          if (entityType === objective.target || entityId.includes(objective.target)) {
            this.updateObjective(sourceId, questId, objective.id, 1);
          }
        }
      }
    }
  }

  /**
   * Handle item pickup events (collection objectives)
   */
  private onItemPickup(data: ItemPickupEvent): void {
    const { playerId, itemId } = data;

    if (!itemId) {
      return;
    }

    // Get player's active quests
    const playerQuestMap = this.playerQuests.get(playerId);
    if (!playerQuestMap) {
      return;
    }

    // Check each active quest for collection objectives
    for (const [questId, progress] of playerQuestMap.entries()) {
      for (const objective of progress.objectives) {
        if (objective.type === 'collect_item' && objective.current < objective.required) {
          // Check if this item matches the objective target
          if (itemId === objective.target) {
            this.updateObjective(playerId, questId, objective.id, 1);
          }
        }
      }
    }
  }

  /**
   * Handle NPC dialogue events (talk objectives)
   */
  private onNPCDialogue(data: NPCDialogueEvent): void {
    const { playerId, npcId } = data;

    // Get player's active quests
    const playerQuestMap = this.playerQuests.get(playerId);
    if (!playerQuestMap) {
      return;
    }

    // Check each active quest for talk objectives
    for (const [questId, progress] of playerQuestMap.entries()) {
      for (const objective of progress.objectives) {
        if (objective.type === 'talk_to_npc' && objective.current < objective.required) {
          // Check if this NPC matches the objective target
          if (npcId === objective.target) {
            this.updateObjective(playerId, questId, objective.id, 1);
          }
        }
      }
    }
  }

  /**
   * Handle resource gathering events (gather objectives)
   */
  private onResourceGathered(data: ResourceGatheredEvent): void {
    const { playerId, resourceId, resourceType } = data;

    // Get player's active quests
    const playerQuestMap = this.playerQuests.get(playerId);
    if (!playerQuestMap) {
      return;
    }

    // Check each active quest for gathering objectives
    for (const [questId, progress] of playerQuestMap.entries()) {
      for (const objective of progress.objectives) {
        if (objective.type === 'gather_resource' && objective.current < objective.required) {
          // Check if this resource matches the objective target
          if (resourceId === objective.target || resourceType === objective.target) {
            this.updateObjective(playerId, questId, objective.id, 1);
          }
        }
      }
    }
  }

  /**
   * Get quest definition by ID
   */
  public getQuestDefinition(questId: string): QuestDefinition | null {
    return this.questDefinitions.get(questId) || null;
  }

  /**
   * Get all quest definitions
   */
  public getAllQuestDefinitions(): QuestDefinition[] {
    return Array.from(this.questDefinitions.values());
  }
}
