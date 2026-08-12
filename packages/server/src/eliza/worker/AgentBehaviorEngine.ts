/**
 * AgentBehaviorEngine — Pure decision logic for agent AI.
 *
 * Runs inside a worker thread. Takes serializable snapshots as input,
 * returns serializable decisions as output. NO World access, NO side effects.
 *
 * Extracted from AgentBehaviorTicker — same logic, but pure functions.
 */

import type {
  WorkerItemData,
  AgentTickInput,
  AgentTickOutput,
  WorkerProcessingRecipeSnapshot,
  WorkerStationData,
} from "./workerTypes.js";
import type {
  AgentGoal,
  PendingChatReaction,
  CombatChatReactionType,
  EmbeddedBehaviorAction,
} from "../managers/AgentBehaviorTicker.js";
import { isStartableAgentQuest } from "../types.js";
import type { NearbyEntityData, AgentQuestProgress } from "../types.js";
import {
  INVENTORY_CONSTANTS,
  INTERACTION_DISTANCE,
  SessionType,
  SMITHING_CONSTANTS,
} from "@hyperforge/shared";
import { isOrdinaryProcessingActionSuppressed } from "../ordinaryProcessingRetry.js";
import {
  findOrdinaryQuestEntrySkillTarget,
  getOrdinaryAgentQuestPriority,
  getProcessingActivitySkill,
  type OrdinaryQuestEntrySkillTarget,
} from "../ordinaryAgentQuestProgression.js";

/** Local item database — populated from main thread at init */
const ITEMS = new Map<string, WorkerItemData>();
const COOKING_RECIPES = new Map<
  string,
  { cookedItemId: string; levelRequired: number }
>();
const COOKING_INPUT_BY_OUTPUT = new Map<string, string>();
const SMELTING_RECIPES = new Map<
  string,
  {
    inputs: Array<{ itemId: string; quantity: number }>;
    levelRequired: number;
  }
>();
const SMITHING_RECIPES = new Map<
  string,
  { barItemId: string; barsRequired: number; levelRequired: number }
>();
const FIREMAKING_RECIPES = new Map<string, { levelRequired: number }>();
const CRAFTING_RECIPES = new Map<
  string,
  WorkerProcessingRecipeSnapshot["crafting"][number]
>();
const TANNING_RECIPES = new Map<
  string,
  WorkerProcessingRecipeSnapshot["tanning"][number]
>();
const TANNING_BY_OUTPUT = new Map<
  string,
  WorkerProcessingRecipeSnapshot["tanning"][number]
>();
const FLETCHING_RECIPES = new Map<
  string,
  WorkerProcessingRecipeSnapshot["fletching"][number]
>();
const RUNECRAFTING_RECIPES = new Map<
  string,
  WorkerProcessingRecipeSnapshot["runecrafting"][number]
>();
const RUNECRAFTING_BY_OUTPUT = new Map<
  string,
  WorkerProcessingRecipeSnapshot["runecrafting"][number]
>();
const GATHERING_BY_OUTPUT = new Map<
  string,
  WorkerProcessingRecipeSnapshot["gathering"]
>();
const GUARANTEED_MOB_TYPES_BY_DROP = new Map<string, string[]>();
const STORE_SUPPLIERS = new Map<
  string,
  Array<{
    storeId: string;
    price: number;
    category: string;
  }>
>();

function getItem(itemId: string): WorkerItemData | null {
  return ITEMS.get(itemId) || null;
}

/** Combat chat reaction thresholds */
const COMBAT_CHAT_COOLDOWN = 15000;

/**
 * Initialize the worker-side item database.
 */
export function initializeItems(
  itemsData: Array<[string, WorkerItemData]>,
  processingRecipes?: WorkerProcessingRecipeSnapshot,
): void {
  ITEMS.clear();
  COOKING_RECIPES.clear();
  COOKING_INPUT_BY_OUTPUT.clear();
  SMELTING_RECIPES.clear();
  SMITHING_RECIPES.clear();
  FIREMAKING_RECIPES.clear();
  CRAFTING_RECIPES.clear();
  TANNING_RECIPES.clear();
  TANNING_BY_OUTPUT.clear();
  FLETCHING_RECIPES.clear();
  RUNECRAFTING_RECIPES.clear();
  RUNECRAFTING_BY_OUTPUT.clear();
  GATHERING_BY_OUTPUT.clear();
  GUARANTEED_MOB_TYPES_BY_DROP.clear();
  STORE_SUPPLIERS.clear();
  for (const [id, item] of itemsData) {
    ITEMS.set(id, item);
    if (item.cooking) {
      COOKING_RECIPES.set(id, item.cooking);
      COOKING_INPUT_BY_OUTPUT.set(item.cooking.cookedItemId, id);
    }
    if (item.smelting) {
      SMELTING_RECIPES.set(id, item.smelting);
    }
    if (item.smithing) {
      SMITHING_RECIPES.set(id, item.smithing);
    }
  }
  for (const recipe of processingRecipes?.firemaking ?? []) {
    FIREMAKING_RECIPES.set(recipe.logItemId, {
      levelRequired: recipe.levelRequired,
    });
  }
  for (const recipe of processingRecipes?.crafting ?? []) {
    CRAFTING_RECIPES.set(recipe.outputItemId, recipe);
  }
  for (const recipe of processingRecipes?.tanning ?? []) {
    TANNING_RECIPES.set(recipe.inputItemId, recipe);
    TANNING_BY_OUTPUT.set(recipe.outputItemId, recipe);
  }
  for (const recipe of processingRecipes?.fletching ?? []) {
    FLETCHING_RECIPES.set(recipe.recipeId, recipe);
  }
  for (const recipe of processingRecipes?.runecrafting ?? []) {
    RUNECRAFTING_RECIPES.set(recipe.runeType, recipe);
    RUNECRAFTING_BY_OUTPUT.set(recipe.runeItemId, recipe);
  }
  for (const resource of processingRecipes?.gathering ?? []) {
    for (const itemId of resource.outputItemIds) {
      const requirements = GATHERING_BY_OUTPUT.get(itemId) ?? [];
      requirements.push(resource);
      requirements.sort(
        (a, b) =>
          a.levelRequired - b.levelRequired ||
          a.resourceId.localeCompare(b.resourceId),
      );
      GATHERING_BY_OUTPUT.set(itemId, requirements);
    }
  }
  for (const source of processingRecipes?.guaranteedMobDrops ?? []) {
    for (const itemId of source.itemIds) {
      const mobTypes = GUARANTEED_MOB_TYPES_BY_DROP.get(itemId) ?? [];
      mobTypes.push(source.mobType);
      mobTypes.sort((a, b) => a.localeCompare(b));
      GUARANTEED_MOB_TYPES_BY_DROP.set(itemId, mobTypes);
    }
  }
  for (const store of processingRecipes?.stores ?? []) {
    for (const item of store.items) {
      const suppliers = STORE_SUPPLIERS.get(item.itemId) ?? [];
      suppliers.push({
        storeId: store.storeId,
        price: item.price,
        category: item.category,
      });
      suppliers.sort(
        (a, b) => a.price - b.price || a.storeId.localeCompare(b.storeId),
      );
      STORE_SUPPLIERS.set(item.itemId, suppliers);
    }
  }
}

/**
 * Process a batch of agent ticks and return decisions.
 */
export function processAgentTicks(agents: AgentTickInput[]): AgentTickOutput[] {
  const results: AgentTickOutput[] = [];
  for (const input of agents) {
    results.push(processOneAgent(input));
  }
  return results;
}

// ─── PER-AGENT PROCESSING ─────────────────────────────────────────────────

function processOneAgent(input: AgentTickInput): AgentTickOutput {
  const state = { ...input.agentState };
  let chatMessage: string | undefined;

  // === COMBAT CHAT REACTIONS ===
  if (state.pendingChatReaction) {
    const reaction = state.pendingChatReaction;
    state.pendingChatReaction = null;
    chatMessage = getCombatChatResponse(reaction);
    state.lastCombatChatAt = Date.now();
  }

  // === QUEST MANAGEMENT ===
  manageQuests(input, state);

  // Every tick may emit exactly one typed action. Survival and equipment used
  // to be hidden pre-action mutations; making them the action routes them
  // through the same durable start/terminal truth boundary as all other work.
  const foodAction = pickFoodAction(input, state);
  if (foodAction) {
    return {
      characterId: input.characterId,
      behaviorEpoch: input.behaviorEpoch,
      action: foodAction,
      updatedState: {
        goal: state.goal,
        questsAccepted: state.questsAccepted,
        currentTargetId: state.currentTargetId,
        lastGatherTargetId: state.lastGatherTargetId,
        lastGatherQueuedAt: state.lastGatherQueuedAt,
        lastCombatChatAt: state.lastCombatChatAt,
      },
      chatMessage,
    };
  }

  const equipmentAction = pickEquipmentAction(input);
  if (equipmentAction) {
    return {
      characterId: input.characterId,
      behaviorEpoch: input.behaviorEpoch,
      action: equipmentAction,
      updatedState: {
        goal: state.goal,
        questsAccepted: state.questsAccepted,
        currentTargetId: state.currentTargetId,
        lastGatherTargetId: state.lastGatherTargetId,
        lastGatherQueuedAt: state.lastGatherQueuedAt,
        lastCombatChatAt: state.lastCombatChatAt,
      },
      chatMessage,
    };
  }

  const gravestoneRecoveryAction = pickGravestoneRecoveryAction(input);
  if (gravestoneRecoveryAction) {
    return {
      characterId: input.characterId,
      behaviorEpoch: input.behaviorEpoch,
      action: gravestoneRecoveryAction,
      updatedState: {
        goal: state.goal,
        questsAccepted: state.questsAccepted,
        currentTargetId: state.currentTargetId,
        lastGatherTargetId: state.lastGatherTargetId,
        lastGatherQueuedAt: state.lastGatherQueuedAt,
        lastCombatChatAt: state.lastCombatChatAt,
      },
      chatMessage,
    };
  }

  const survivalBankAction = pickSurvivalFoodBankAction(input, state);
  if (survivalBankAction) {
    return {
      characterId: input.characterId,
      behaviorEpoch: input.behaviorEpoch,
      action: survivalBankAction,
      updatedState: {
        goal: state.goal,
        questsAccepted: state.questsAccepted,
        currentTargetId: state.currentTargetId,
        lastGatherTargetId: state.lastGatherTargetId,
        lastGatherQueuedAt: state.lastGatherQueuedAt,
        lastCombatChatAt: state.lastCombatChatAt,
      },
      chatMessage,
    };
  }

  const survivalSelfSupplyAction = pickSurvivalFoodSelfSupplyAction(
    input,
    state,
  );
  if (survivalSelfSupplyAction) {
    return {
      characterId: input.characterId,
      behaviorEpoch: input.behaviorEpoch,
      action: survivalSelfSupplyAction,
      updatedState: {
        goal: state.goal,
        questsAccepted: state.questsAccepted,
        currentTargetId: state.currentTargetId,
        lastGatherTargetId: state.lastGatherTargetId,
        lastGatherQueuedAt: state.lastGatherQueuedAt,
        lastCombatChatAt: state.lastCombatChatAt,
      },
      chatMessage,
    };
  }

  // === SHOPPING ===
  const shoppingAction = manageShopping(input, state);

  // Provisioning is an explicit world action. The agent must walk to an
  // authoritative store before the main thread may attempt a transaction.
  if (shoppingAction) {
    return {
      characterId: input.characterId,
      behaviorEpoch: input.behaviorEpoch,
      action: shoppingAction,
      updatedState: {
        goal: state.goal,
        questsAccepted: state.questsAccepted,
        currentTargetId: state.currentTargetId,
        lastGatherTargetId: state.lastGatherTargetId,
        lastGatherQueuedAt: state.lastGatherQueuedAt,
        lastCombatChatAt: state.lastCombatChatAt,
      },
      chatMessage,
    };
  }

  // === PICK ACTION ===
  // Operator grace: dashboard command is active — don't override it with
  // autonomous action. Survival tasks above (eat, equip, shop) already ran.
  if (input.operatorGrace) {
    return {
      characterId: input.characterId,
      behaviorEpoch: input.behaviorEpoch,
      action: { type: "idle" },
      updatedState: {
        goal: state.goal,
        questsAccepted: state.questsAccepted,
        currentTargetId: state.currentTargetId,
        lastGatherTargetId: state.lastGatherTargetId,
        lastGatherQueuedAt: state.lastGatherQueuedAt,
        lastCombatChatAt: state.lastCombatChatAt,
      },
      chatMessage,
    };
  }
  const action = pickBehaviorAction(input, state);

  return {
    characterId: input.characterId,
    behaviorEpoch: input.behaviorEpoch,
    action,
    updatedState: {
      goal: state.goal,
      questsAccepted: state.questsAccepted,
      currentTargetId: state.currentTargetId,
      lastGatherTargetId: state.lastGatherTargetId,
      lastGatherQueuedAt: state.lastGatherQueuedAt,
      lastCombatChatAt: state.lastCombatChatAt,
    },
    chatMessage,
  };
}

// ─── MUTABLE AGENT STATE (worker-local) ──────────────────────────────────

interface AgentState {
  goal: AgentGoal | null;
  questsAccepted: string[];
  currentTargetId: string | null;
  lastAteAt: number;
  dropCooldownUntil: number;
  lastGatherTargetId: string | null;
  lastGatherQueuedAt: number;
  pendingChatReaction: PendingChatReaction | null;
  lastCombatChatAt: number;
}

function hasReadyFood(input: AgentTickInput): boolean {
  return input.inventoryItems.some(
    (entry) =>
      entry.quantity > 0 && Number(getItem(entry.itemId)?.healAmount ?? 0) > 0,
  );
}

function getCarriedReadyFoodHealing(input: AgentTickInput): number {
  return input.inventoryItems.reduce((total, entry) => {
    const healAmount = Number(getItem(entry.itemId)?.healAmount ?? 0);
    return entry.quantity > 0 && Number.isFinite(healAmount) && healAmount > 0
      ? total + healAmount * entry.quantity
      : total;
  }, 0);
}

function hasSurvivalFoodReserve(input: AgentTickInput): boolean {
  return (
    input.gameState.maxHealth > 0 &&
    getCarriedReadyFoodHealing(input) >= input.gameState.maxHealth
  );
}

function hasAuthoredSurvivalFoodCatalog(): boolean {
  for (const [itemId, suppliers] of STORE_SUPPLIERS) {
    if (
      Number(getItem(itemId)?.healAmount ?? 0) > 0 &&
      suppliers.some((supplier) => supplier.category === "cooked_food")
    ) {
      return true;
    }
  }
  return false;
}

function pickGravestoneRecoveryAction(
  input: AgentTickInput,
): EmbeddedBehaviorAction | null {
  if (input.gameState.inCombat || !input.gameState.position) return null;
  const gravestone = findOwnGravestone(input);
  if (!gravestone) return null;
  if (
    input.gameState.health < input.gameState.maxHealth &&
    !hasReadyFood(input)
  ) {
    return null;
  }
  const position = input.gameState.position;
  const distance = Math.hypot(
    position[0] - gravestone.position[0],
    position[2] - gravestone.position[2],
  );
  return distance > 4
    ? { type: "move", target: gravestone.position, runMode: true }
    : { type: "lootGravestone", gravestoneId: gravestone.id };
}

// ─── QUEST MANAGEMENT ────────────────────────────────────────────────────

function manageQuests(input: AgentTickInput, state: AgentState): void {
  const activeQuests = input.questState;
  const availableQuests = input.availableQuests;
  const resourceSystemAvailable = input.resourceSystemAvailable;

  if (activeQuests.length > 0) {
    const quest =
      activeQuests.find(
        (q) =>
          q.status === "ready_to_complete" ||
          q.stageType === "kill" ||
          q.stageType === "dialogue" ||
          (q.stageType === "gather" && resourceSystemAvailable),
      ) || activeQuests[0];

    if (
      quest.stageType === "gather" &&
      !resourceSystemAvailable &&
      quest.status !== "ready_to_complete"
    ) {
      state.goal = {
        type: "combat",
        description: "Train combat (gather resources unavailable)",
      };
      return;
    }

    state.goal = {
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
    return;
  }

  const questPriority = getOrdinaryAgentQuestPriority(resourceSystemAvailable);

  for (const questId of questPriority) {
    const quest = availableQuests.find(
      (q) => q.questId === questId && isStartableAgentQuest(q),
    );
    if (quest && !state.questsAccepted.includes(questId)) {
      state.goal = {
        type: "questing",
        description: `Accept quest: ${quest.name}`,
        questId: quest.questId,
        questName: quest.name,
        questStartNpc: quest.startNpc,
      };
      return;
    }
  }

  const trainingTarget = findOrdinaryQuestEntrySkillTarget({
    availableQuests,
    skills: input.gameState.skills,
    resourceSystemAvailable,
  });
  if (trainingTarget) {
    state.goal = {
      type: "provisioning",
      description: `Train ${trainingTarget.skill} from ${trainingTarget.currentLevel} to ${trainingTarget.targetLevel} for ${trainingTarget.questName}`,
      questId: trainingTarget.questId,
      questName: trainingTarget.questName,
    };
    return;
  }

  state.goal = {
    type: "combat",
    description: "Train combat (nearby hostile creatures)",
  };
}

// ─── SHOPPING ────────────────────────────────────────────────────────────

/**
 * Check the exact private bank for survival food before exposing the agent to
 * another progression cycle. A damaged foodless agent may withdraw only when
 * it is already inside the bank's authored interaction range; it never crosses
 * the world while relying solely on passive recovery.
 */
function pickSurvivalFoodBankAction(
  input: AgentTickInput,
  state: AgentState,
): EmbeddedBehaviorAction | null {
  if (input.gameState.inCombat || hasSurvivalFoodReserve(input)) return null;
  if (Date.now() < input.bankStageRetryAfter) return null;
  if (input.inventoryItems.length >= INVENTORY_CONSTANTS.MAX_INVENTORY_SLOTS) {
    return null;
  }
  const position = input.gameState.position;
  if (!position) return null;
  const bank = findNearestStation(input, position, "bank");
  if (!bank) return null;

  const inRange = isStationInInteractionRange(position, bank);
  const fullyRecovered =
    input.gameState.maxHealth > 0 &&
    input.gameState.health >= input.gameState.maxHealth;
  if (!inRange && !fullyRecovered) return null;

  state.goal = {
    type: "banking",
    description: inRange
      ? "Staging survival food from private bank"
      : "Walking to private bank for survival food",
    bankPurpose: "survival_food",
  };
  return inRange
    ? { type: "bankWithdraw", bankId: bank.entityId }
    : {
        type: "move",
        target: getStationApproachTarget(position, bank),
        runMode: true,
      };
}

/**
 * Recover an empty survival bank through an authored, non-combat food path.
 * The authorization bit proves the main process observed an exact empty-bank
 * result; every subsequent tool grant, resource, range, and recipe identity is
 * public manifest/live-world data. A missing link idles rather than falling
 * into a foodless combat-for-coins loop.
 */
function pickSurvivalFoodSelfSupplyAction(
  input: AgentTickInput,
  state: AgentState,
): EmbeddedBehaviorAction | null {
  if (
    !input.survivalFoodAcquisitionAuthorized ||
    input.gameState.inCombat ||
    hasSurvivalFoodReserve(input)
  ) {
    return null;
  }
  const position = input.gameState.position;
  if (!position) return { type: "idle" };
  if (input.gameState.health < input.gameState.maxHealth) {
    state.goal = {
      type: "provisioning",
      description: "Recovering before non-combat food provisioning",
    };
    return { type: "idle" };
  }

  const candidates = [...COOKING_RECIPES.entries()]
    .flatMap(([rawItemId, cooking]) => {
      const cookedHealAmount = Number(
        getItem(cooking.cookedItemId)?.healAmount ?? 0,
      );
      if (
        cooking.levelRequired > getSkillLevel(input, "cooking") ||
        !Number.isFinite(cookedHealAmount) ||
        cookedHealAmount <= 0
      ) {
        return [];
      }
      return getEligibleGatheringRequirements(input, rawItemId).map(
        (requirement) => ({
          rawItemId,
          cookedItemId: cooking.cookedItemId,
          cookedHealAmount,
          cookingLevelRequired: cooking.levelRequired,
          requirement,
          ownsTool: hasCompatibleGatheringTool(input, requirement),
        }),
      );
    })
    .sort(
      (left, right) =>
        Number(right.ownsTool) - Number(left.ownsTool) ||
        left.requirement.levelRequired - right.requirement.levelRequired ||
        left.cookingLevelRequired - right.cookingLevelRequired ||
        right.cookedHealAmount - left.cookedHealAmount ||
        left.rawItemId.localeCompare(right.rawItemId) ||
        left.requirement.resourceId.localeCompare(right.requirement.resourceId),
    );
  const candidate = candidates[0];
  if (!candidate) {
    state.goal = {
      type: "provisioning",
      description: "Waiting for an authored non-combat food source",
    };
    return { type: "idle" };
  }

  if (!candidate.ownsTool && candidate.requirement.toolRequired) {
    const toolQuest = input.availableQuests
      .filter(
        (quest) =>
          isStartableAgentQuest(quest) &&
          quest.onStartItems.some(
            (item) =>
              item.itemId === candidate.requirement.toolRequired &&
              item.quantity > 0,
          ),
      )
      .sort((left, right) => left.questId.localeCompare(right.questId))[0];
    if (!toolQuest) {
      state.goal = {
        type: "provisioning",
        description: `Waiting for authored ${candidate.requirement.toolRequired} recovery`,
      };
      return { type: "idle" };
    }
    state.goal = {
      type: "provisioning",
      description: `Acquire authored ${candidate.requirement.toolRequired} from ${toolQuest.name}`,
      questId: toolQuest.questId,
      questName: toolQuest.name,
    };
    return moveToNpcOrAccept(
      input,
      position,
      toolQuest.questId,
      toolQuest.startNpc,
    );
  }

  const carriedRawQuantity = getInventoryQuantity(
    input.inventoryItems,
    candidate.rawItemId,
  );
  const potentialReserve =
    getCarriedReadyFoodHealing(input) +
    carriedRawQuantity * candidate.cookedHealAmount;
  if (carriedRawQuantity > 0 && potentialReserve >= input.gameState.maxHealth) {
    state.goal = {
      type: "cooking",
      description: `Cook authored survival reserve ${candidate.rawItemId}`,
    };
    const cookAction = {
      type: "cook",
      itemId: candidate.rawItemId,
    } as const;
    if (
      isOrdinaryProcessingActionSuppressed(
        input.ordinaryProcessingRetrySuppressions,
        cookAction,
      )
    ) {
      return { type: "idle" };
    }
    if (isNearbyObject(input.gameState.nearbyEntities, "fire", 1)) {
      return cookAction;
    }
    const range = findNearestStation(input, position, "range");
    if (!range) return { type: "idle" };
    if (isStationInInteractionRange(position, range)) return cookAction;
    if (input.gameState.health < input.gameState.maxHealth) {
      return { type: "idle" };
    }
    return {
      type: "move",
      target: getStationApproachTarget(position, range),
      runMode: true,
    };
  }

  state.goal = {
    type: "gathering",
    description: `Gather authored survival food ${candidate.rawItemId}`,
  };
  if (input.inventoryItems.length >= INVENTORY_CONSTANTS.MAX_INVENTORY_SLOTS) {
    return { type: "idle" };
  }
  const nearby = input.gameState.nearbyEntities
    .filter(
      (entity) =>
        entity.type === "resource" &&
        entity.resourceId === candidate.requirement.resourceId,
    )
    .sort(
      (left, right) =>
        left.distance - right.distance || left.id.localeCompare(right.id),
    )[0];
  if (nearby) {
    if (nearby.distance >= 4) {
      return {
        type: "move",
        target: [nearby.position[0], position[1], nearby.position[2]],
        runMode: false,
      };
    }
    if (
      state.lastGatherTargetId === nearby.id &&
      Date.now() - state.lastGatherQueuedAt < 30_000
    ) {
      return { type: "idle" };
    }
    state.lastGatherTargetId = nearby.id;
    state.lastGatherQueuedAt = Date.now();
    return { type: "gather", targetId: nearby.id };
  }

  const distant = input.worldResources
    .filter(
      (resource) =>
        !resource.depleted &&
        resource.resourceId === candidate.requirement.resourceId,
    )
    .map((resource) => ({
      resource,
      distance: Math.hypot(
        position[0] - resource.position[0],
        position[2] - resource.position[2],
      ),
    }))
    .sort(
      (left, right) =>
        left.distance - right.distance ||
        left.resource.position[0] - right.resource.position[0] ||
        left.resource.position[2] - right.resource.position[2],
    )[0]?.resource;
  if (!distant) return { type: "idle" };
  if (
    state.lastGatherTargetId === distant.entityId &&
    Date.now() - state.lastGatherQueuedAt < 30_000
  ) {
    return { type: "idle" };
  }
  // The main-thread pending gather manager owns exact collision-aware routing
  // to land resources and water-edge fishing spots. Queue the stable runtime
  // identity instead of repeatedly walking at a non-walkable resource tile.
  state.lastGatherTargetId = distant.entityId;
  state.lastGatherQueuedAt = Date.now();
  return { type: "gather", targetId: distant.entityId };
}

function manageShopping(
  input: AgentTickInput,
  state: AgentState,
): EmbeddedBehaviorAction | null {
  const inventory = input.inventoryItems;
  const equipped = input.equippedItems;
  const goal = state.goal;

  // Read coins from game state entity data
  const gameState = input.gameState;
  if (!gameState?.position) return null;
  if (gameState.inCombat) return null;
  if (Date.now() < input.storeRetryAfter) return null;

  const hasItemInInventoryOrEquipped = (itemId: string): boolean => {
    const item = getItem(itemId);
    const equipSlot = item?.equipSlot;
    if (equipSlot) {
      const equippedItem = equipped[equipSlot];
      if (equippedItem === itemId) return true;
      if (equipSlot === "2h" && equipped.weapon === itemId) return true;
    } else if (equipped.weapon === itemId) {
      return true;
    }
    return inventory.some((i) => i.itemId === itemId);
  };

  const loadedStoreIds = new Set(
    input.storePositions.map((store) => store.storeId),
  );
  const findLoadedSupplier = (itemId: string): string | null =>
    (STORE_SUPPLIERS.get(itemId) ?? []).find((supplier) =>
      loadedStoreIds.has(supplier.storeId),
    )?.storeId ?? null;
  const meetsAuthoredSkillRequirements = (item: WorkerItemData): boolean => {
    const skills = item.requirements?.skills;
    if (!skills || typeof skills !== "object" || Array.isArray(skills)) {
      return true;
    }
    return Object.entries(skills).every(([skill, required]) => {
      const levelRequired = Number(required);
      if (!Number.isSafeInteger(levelRequired) || levelRequired < 1) {
        return false;
      }
      const normalizedSkill = skill === "defence" ? "defense" : skill;
      return getSkillLevel(input, normalizedSkill) >= levelRequired;
    });
  };
  const findCheapestLoadedCatalogItem = (
    predicate: (
      item: WorkerItemData,
      catalog: { price: number; category: string },
    ) => boolean,
  ): { storeId: string; itemId: string; price: number } | null => {
    const candidates: Array<{
      storeId: string;
      itemId: string;
      price: number;
    }> = [];
    for (const [itemId, suppliers] of STORE_SUPPLIERS) {
      const item = getItem(itemId);
      if (!item) continue;
      for (const supplier of suppliers) {
        if (
          !loadedStoreIds.has(supplier.storeId) ||
          !Number.isSafeInteger(supplier.price) ||
          supplier.price < 0 ||
          !predicate(item, supplier)
        ) {
          continue;
        }
        candidates.push({
          storeId: supplier.storeId,
          itemId,
          price: supplier.price,
        });
      }
    }
    candidates.sort(
      (a, b) =>
        a.price - b.price ||
        a.itemId.localeCompare(b.itemId) ||
        a.storeId.localeCompare(b.storeId),
    );
    return candidates[0] ?? null;
  };
  let need:
    | {
        storeId: string;
        itemId: string;
        quantity: number;
        reason: string;
        questId?: string;
        questName?: string;
      }
    | undefined;

  // Priority 1: Acquire a weapon if unarmed.
  if (
    !equipped.weapon &&
    !inventory.some((i) => {
      const item = getItem(i.itemId);
      return item?.equipSlot === "weapon" || item?.equipSlot === "2h";
    })
  ) {
    const basicWeapon = findCheapestLoadedCatalogItem(
      (item, catalog) =>
        catalog.category === "weapons" &&
        item.type === "weapon" &&
        (item.equipSlot === "weapon" || item.equipSlot === "2h") &&
        String(item.attackType ?? "").toLowerCase() === "melee" &&
        meetsAuthoredSkillRequirements(item),
    );
    if (basicWeapon) {
      need = {
        storeId: basicWeapon.storeId,
        itemId: basicWeapon.itemId,
        quantity: 1,
        reason: "Acquire a catalog-backed basic weapon",
      };
    }
  }

  // Priority 2: when no bank identity is loaded, acquire one full health bar
  // from the authored cooked-food catalog. An observed empty bank authorizes
  // the non-combat self-supply path above; a technical bank backoff must never
  // be mistaken for permission to reveal or mutate an alternate source.
  // Full-bar cost and inventory fit are derived only from manifest values.
  const hasLoadedBank = input.stationPositions.some(
    (station) => station.stationType === "bank",
  );
  const survivalStoreFallbackAuthorized =
    !hasSurvivalFoodReserve(input) &&
    gameState.maxHealth > 0 &&
    gameState.health >= gameState.maxHealth &&
    inventory.length < INVENTORY_CONSTANTS.MAX_INVENTORY_SLOTS &&
    !hasLoadedBank;
  if (!need && survivalStoreFallbackAuthorized) {
    const freeSlots =
      INVENTORY_CONSTANTS.MAX_INVENTORY_SLOTS - inventory.length;
    const candidates: Array<{
      storeId: string;
      itemId: string;
      quantity: number;
      healAmount: number;
      fullBarCost: number;
      fitsFullBar: boolean;
      coveredHealth: number;
    }> = [];
    for (const [itemId, suppliers] of STORE_SUPPLIERS) {
      const item = getItem(itemId);
      const healAmount = Number(item?.healAmount ?? 0);
      if (!item || !Number.isFinite(healAmount) || healAmount <= 0) continue;
      const missingReserve = Math.max(
        0,
        gameState.maxHealth - getCarriedReadyFoodHealing(input),
      );
      const fullBarQuantity = Math.ceil(missingReserve / healAmount);
      const capacity = item.stackable ? Number.MAX_SAFE_INTEGER : freeSlots;
      const quantity = Math.min(fullBarQuantity, capacity);
      if (quantity <= 0) continue;
      for (const supplier of suppliers) {
        if (
          supplier.category !== "cooked_food" ||
          !loadedStoreIds.has(supplier.storeId) ||
          !Number.isSafeInteger(supplier.price) ||
          supplier.price < 0
        ) {
          continue;
        }
        candidates.push({
          storeId: supplier.storeId,
          itemId,
          quantity,
          healAmount,
          fullBarCost: supplier.price * fullBarQuantity,
          fitsFullBar: quantity === fullBarQuantity,
          coveredHealth: healAmount * quantity,
        });
      }
    }
    candidates.sort(
      (left, right) =>
        Number(right.fitsFullBar) - Number(left.fitsFullBar) ||
        (left.fitsFullBar
          ? left.fullBarCost - right.fullBarCost ||
            left.quantity - right.quantity
          : right.coveredHealth - left.coveredHealth ||
            left.fullBarCost - right.fullBarCost) ||
        left.itemId.localeCompare(right.itemId) ||
        left.storeId.localeCompare(right.storeId),
    );
    const food = candidates[0];
    if (food) {
      need = {
        storeId: food.storeId,
        itemId: food.itemId,
        quantity: food.quantity,
        reason: "Acquire an authored survival-food reserve",
      };
    }
  }

  // Priority 3: satisfy the next exact dependency of the already-selected
  // quest. Gatherable materials remain gameplay work; the store is used only
  // for their authored tool or for a dependency with no eligible gather path.
  if (!need && goal?.type === "questing") {
    const stageTarget = goal.questStageTarget || "";
    const stageType = goal.questStageType || "";
    const dependency = getQuestDependencyNeed(input, stageType, stageTarget);
    if (dependency) {
      const gatheringRequirements = getEligibleGatheringRequirements(
        input,
        dependency.itemId,
      );
      if (dependency.role === "material" && gatheringRequirements.length > 0) {
        if (
          !gatheringRequirements.some((requirement) =>
            hasCompatibleGatheringTool(input, requirement),
          )
        ) {
          const candidates = gatheringRequirements
            .map((requirement) => {
              if (!requirement.toolRequired) return null;
              if (requirement.harvestSkill === "fishing") {
                const storeId = findLoadedSupplier(requirement.toolRequired);
                const supplier = (
                  STORE_SUPPLIERS.get(requirement.toolRequired) ?? []
                ).find((entry) => entry.storeId === storeId);
                return storeId && supplier
                  ? {
                      storeId,
                      itemId: requirement.toolRequired,
                      price: supplier.price,
                      skill: requirement.harvestSkill,
                    }
                  : null;
              }
              const tool = findCheapestLoadedCatalogItem(
                (item, catalog) =>
                  catalog.category === "tools" &&
                  item.tool?.skill === requirement.harvestSkill,
              );
              return tool ? { ...tool, skill: requirement.harvestSkill } : null;
            })
            .filter(
              (
                candidate,
              ): candidate is {
                storeId: string;
                itemId: string;
                price: number;
                skill: string;
              } => candidate !== null,
            )
            .sort(
              (a, b) =>
                a.price - b.price ||
                a.itemId.localeCompare(b.itemId) ||
                a.storeId.localeCompare(b.storeId),
            );
          const tool = candidates[0];
          if (tool) {
            need = {
              storeId: tool.storeId,
              itemId: tool.itemId,
              quantity: 1,
              reason: `Acquire an authored ${tool.skill} tool`,
            };
          }
        }
      } else if (!dependency.mustGather) {
        const storeId = findLoadedSupplier(dependency.itemId);
        if (storeId) {
          need = {
            storeId,
            itemId: dependency.itemId,
            quantity: dependency.quantity,
            reason: dependency.reason,
          };
        }
      }
    }
  }

  // Priority 4: after the main process has checked the private bank and found
  // no stageable path for this exact skill lock, acquire one manifest-derived
  // missing dependency. Guaranteed mob and exact gathering sources remain
  // gameplay work; the store supplies only their tool or a store-only leaf.
  if (!need && goal?.type === "provisioning" && goal.questId) {
    const dependency = getQuestEntryTrainingDependency(input);
    if (dependency && dependency.target.questId === goal.questId) {
      const gatheringRequirements = getEligibleGatheringRequirements(
        input,
        dependency.itemId,
      );
      if (dependency.role === "material" && gatheringRequirements.length > 0) {
        if (
          !gatheringRequirements.some((requirement) =>
            hasCompatibleGatheringTool(input, requirement),
          )
        ) {
          const tool = gatheringRequirements
            .map((requirement) => {
              if (!requirement.toolRequired) return null;
              if (requirement.harvestSkill === "fishing") {
                const storeId = findLoadedSupplier(requirement.toolRequired);
                const supplier = (
                  STORE_SUPPLIERS.get(requirement.toolRequired) ?? []
                ).find((entry) => entry.storeId === storeId);
                return storeId && supplier
                  ? {
                      storeId,
                      itemId: requirement.toolRequired,
                      price: supplier.price,
                    }
                  : null;
              }
              return findCheapestLoadedCatalogItem(
                (item, catalog) =>
                  catalog.category === "tools" &&
                  item.tool?.skill === requirement.harvestSkill,
              );
            })
            .filter(
              (
                candidate,
              ): candidate is {
                storeId: string;
                itemId: string;
                price: number;
              } => candidate !== null,
            )
            .sort(
              (a, b) =>
                a.price - b.price ||
                a.itemId.localeCompare(b.itemId) ||
                a.storeId.localeCompare(b.storeId),
            )[0];
          if (tool) {
            need = {
              storeId: tool.storeId,
              itemId: tool.itemId,
              quantity: 1,
              reason: `Acquire an authored gathering tool for ${dependency.target.questName}`,
              questId: dependency.target.questId,
              questName: dependency.target.questName,
            };
          }
        }
      } else if (
        dependency.role !== "material" ||
        (GUARANTEED_MOB_TYPES_BY_DROP.get(dependency.itemId) ?? []).length === 0
      ) {
        const storeId = findLoadedSupplier(dependency.itemId);
        if (storeId) {
          need = {
            storeId,
            itemId: dependency.itemId,
            quantity: dependency.quantity,
            reason: dependency.reason,
            questId: dependency.target.questId,
            questName: dependency.target.questName,
          };
        }
      }
    }
  }

  // A carried, executable Smithing recipe is not actually executable without
  // the authoritative loose-inventory hammer required by SmithingSystem.
  if (
    !need &&
    goal?.type !== "questing" &&
    !hasItemInInventoryOrEquipped(SMITHING_CONSTANTS.HAMMER_ITEM_ID) &&
    pickSmithableRecipe(input, 1, false)
  ) {
    const storeId = findLoadedSupplier(SMITHING_CONSTANTS.HAMMER_ITEM_ID);
    if (storeId) {
      need = {
        storeId,
        itemId: SMITHING_CONSTANTS.HAMMER_ITEM_ID,
        quantity: 1,
        reason: "Acquire the required Smithing tool",
      };
    }
  }

  if (!need) return null;

  const playerPosition = gameState.position;
  const matchingStores = input.storePositions.filter(
    (store) => store.storeId === need.storeId,
  );
  let closestStore: (typeof matchingStores)[number] | undefined;
  let closestDistance = Number.POSITIVE_INFINITY;
  for (const store of matchingStores) {
    const distance = Math.max(
      Math.abs(playerPosition[0] - store.position[0]),
      Math.abs(playerPosition[2] - store.position[2]),
    );
    if (distance < closestDistance) {
      closestStore = store;
      closestDistance = distance;
    }
  }

  // Missing exact runtime store identity is a content/load failure. Never
  // replace it with a guessed location or an inventory mutation.
  if (!closestStore) return null;

  state.goal = {
    type: "provisioning",
    description: `${need.reason} from ${closestStore.name}`,
    ...(need.questId
      ? { questId: need.questId, questName: need.questName }
      : {}),
  };

  const interactionDistance = INTERACTION_DISTANCE[SessionType.STORE];
  if (closestDistance <= interactionDistance) {
    return {
      type: "storeBuy",
      storeId: need.storeId,
      itemId: need.itemId,
      quantity: need.quantity,
    };
  }

  // Stop on a free adjacent tile rather than targeting the NPC's occupied tile.
  const approachOffset = Math.max(1, interactionDistance - 1);
  const approachTarget: [number, number, number] = [
    closestStore.position[0] +
      Math.sign(playerPosition[0] - closestStore.position[0]) * approachOffset,
    closestStore.position[1],
    closestStore.position[2] +
      Math.sign(playerPosition[2] - closestStore.position[2]) * approachOffset,
  ];
  return { type: "move", target: approachTarget, runMode: true };
}

// ─── CRAFTING & BANKING ─────────────────────────────────────────────────

function isNearbyObject(
  entities: NearbyEntityData[],
  keyword: string,
  maxDist: number,
): boolean {
  return entities.some(
    (e) =>
      e.type === "object" &&
      e.distance <= maxDist &&
      `${e.id} ${e.name}`.toLowerCase().includes(keyword),
  );
}

const QUEST_ENTRY_TRAINING_BATCH_SIZE = 5;

type QuestEntryTrainingRecipe = {
  activity: "crafting" | "fletching";
  stableId: string;
  outputItemId: string;
  levelRequired: number;
  inputs: Array<{ itemId: string; quantity: number }>;
  tools: string[];
  consumables: Array<{ itemId: string }>;
};

type QuestEntryTrainingDependency = {
  target: OrdinaryQuestEntrySkillTarget;
  recipe: QuestEntryTrainingRecipe;
  itemId: string;
  quantity: number;
  role: "material" | "tool" | "consumable";
  reason: string;
};

/**
 * Select a minimum-entry authored recipe for the exact locked skill. This is
 * a reliability baseline, not an economic preference: the lowest legal level
 * and stable manifest identity avoid silently switching to a costlier recipe.
 */
function getQuestEntryTrainingRecipe(
  input: AgentTickInput,
  target: OrdinaryQuestEntrySkillTarget,
): QuestEntryTrainingRecipe | null {
  if (target.skill === "crafting") {
    const recipe = [...CRAFTING_RECIPES.values()]
      .filter(
        (candidate) =>
          candidate.levelRequired <= getSkillLevel(input, "crafting"),
      )
      .sort(
        (a, b) =>
          a.levelRequired - b.levelRequired ||
          a.outputItemId.localeCompare(b.outputItemId),
      )[0];
    return recipe
      ? {
          activity: "crafting",
          stableId: recipe.outputItemId,
          outputItemId: recipe.outputItemId,
          levelRequired: recipe.levelRequired,
          inputs: recipe.inputs,
          tools: recipe.tools,
          consumables: recipe.consumables.map(({ itemId }) => ({ itemId })),
        }
      : null;
  }
  if (target.skill === "fletching") {
    const recipe = [...FLETCHING_RECIPES.values()]
      .filter(
        (candidate) =>
          candidate.levelRequired <= getSkillLevel(input, "fletching"),
      )
      .sort(
        (a, b) =>
          a.levelRequired - b.levelRequired ||
          a.recipeId.localeCompare(b.recipeId),
      )[0];
    return recipe
      ? {
          activity: "fletching",
          stableId: recipe.recipeId,
          outputItemId: recipe.outputItemId,
          levelRequired: recipe.levelRequired,
          inputs: recipe.inputs,
          tools: recipe.tools,
          consumables: [],
        }
      : null;
  }
  return null;
}

function getQuestEntryTrainingContext(input: AgentTickInput): {
  target: OrdinaryQuestEntrySkillTarget;
  recipe: QuestEntryTrainingRecipe;
} | null {
  const target = findOrdinaryQuestEntrySkillTarget({
    availableQuests: input.availableQuests,
    skills: input.gameState.skills,
    resourceSystemAvailable: input.resourceSystemAvailable,
  });
  if (!target) return null;
  const recipe = getQuestEntryTrainingRecipe(input, target);
  return recipe ? { target, recipe } : null;
}

function getAuthorizedQuestEntryTrainingContext(input: AgentTickInput): {
  target: OrdinaryQuestEntrySkillTarget;
  recipe: QuestEntryTrainingRecipe;
} | null {
  const context = getQuestEntryTrainingContext(input);
  return context &&
    input.questEntryAcquisitionQuestId === context.target.questId
    ? context
    : null;
}

function getQuestEntryTrainingDependency(
  input: AgentTickInput,
): QuestEntryTrainingDependency | null {
  const context = getAuthorizedQuestEntryTrainingContext(input);
  if (!context) return null;
  const { target, recipe } = context;
  const hasRemainingBatchInput = recipe.inputs.some(
    ({ itemId }) => getInventoryQuantity(input.inventoryItems, itemId) > 0,
  );
  const batchAlreadyStarted =
    getInventoryQuantity(input.inventoryItems, recipe.outputItemId) > 0 &&
    hasRemainingBatchInput;
  const actionCount = batchAlreadyStarted ? 1 : QUEST_ENTRY_TRAINING_BATCH_SIZE;

  for (const requiredInput of recipe.inputs) {
    const requiredQuantity = requiredInput.quantity * actionCount;
    const carriedQuantity = getInventoryQuantity(
      input.inventoryItems,
      requiredInput.itemId,
    );
    const missingQuantity = Math.max(0, requiredQuantity - carriedQuantity);
    if (missingQuantity <= 0) continue;

    const tanning = TANNING_BY_OUTPUT.get(requiredInput.itemId);
    if (tanning) {
      const precursorQuantity = getInventoryQuantity(
        input.inventoryItems,
        tanning.inputItemId,
      );
      if (precursorQuantity >= missingQuantity) return null;
      return {
        target,
        recipe,
        itemId: tanning.inputItemId,
        quantity: missingQuantity - precursorQuantity,
        role: "material",
        reason: `Acquire guaranteed authored ${tanning.inputItemId} for ${target.skill} training`,
      };
    }

    return {
      target,
      recipe,
      itemId: requiredInput.itemId,
      quantity: missingQuantity,
      role: "material",
      reason: `Acquire authored ${requiredInput.itemId} for ${target.skill} training`,
    };
  }

  const missingTool = recipe.tools.find(
    (itemId) => !hasOwnedItem(input, itemId),
  );
  if (missingTool) {
    return {
      target,
      recipe,
      itemId: missingTool,
      quantity: 1,
      role: "tool",
      reason: `Acquire authored ${missingTool} for ${target.skill} training`,
    };
  }

  const missingConsumable = recipe.consumables.find(
    ({ itemId }) => getInventoryQuantity(input.inventoryItems, itemId) <= 0,
  );
  return missingConsumable
    ? {
        target,
        recipe,
        itemId: missingConsumable.itemId,
        quantity: 1,
        role: "consumable",
        reason: `Acquire authored ${missingConsumable.itemId} for ${target.skill} training`,
      }
    : null;
}

type ReadyProcessingCandidate = {
  activity:
    | "cooking"
    | "smelting"
    | "smithing"
    | "crafting"
    | "fletching"
    | "firemaking"
    | "runecrafting"
    | "tanning";
  stableId: string;
  levelRequired: number;
  action: EmbeddedBehaviorAction;
  stationType: "range" | "furnace" | "anvil" | "runecrafting" | "tanner" | null;
  stationNameToken?: string;
  questEntryPriority?: number;
};

/**
 * Resolve every immediately executable authored processing recipe from the
 * public worker snapshot and the agent's own carried state. This is not a
 * custody planner: bank identities, quantities, coins, and private metadata
 * remain main-process-only. The stable ordering merely drains ready work and
 * does not assign an economic value to any output.
 */
function getReadyProcessingCandidates(
  input: AgentTickInput,
): ReadyProcessingCandidate[] {
  const trainingContext = getQuestEntryTrainingContext(input);
  const trainingTarget = trainingContext?.target;
  const trainingSkill = trainingTarget?.skill;
  const candidates: ReadyProcessingCandidate[] = [];
  const cooking = pickCookableRecipe(input);
  if (cooking) {
    candidates.push({
      activity: "cooking",
      stableId: cooking.rawItemId,
      levelRequired: cooking.levelRequired,
      action: { type: "cook", itemId: cooking.rawItemId },
      stationType: "range",
    });
  }

  const smelting = pickSmeltableRecipe(input);
  if (smelting) {
    candidates.push({
      activity: "smelting",
      stableId: smelting.barItemId,
      levelRequired: smelting.levelRequired,
      action: { type: "smelt", recipe: smelting.barItemId },
      stationType: "furnace",
    });
  }

  const smithing = pickSmithableRecipe(input);
  if (smithing) {
    candidates.push({
      activity: "smithing",
      stableId: smithing.outputItemId,
      levelRequired: smithing.levelRequired,
      action: { type: "smith", recipe: smithing.outputItemId },
      stationType: "anvil",
    });
  }

  for (const recipe of CRAFTING_RECIPES.values()) {
    if (
      recipe.levelRequired > getSkillLevel(input, "crafting") ||
      !hasAuthoredRecipeInputs(input, recipe) ||
      (recipe.station !== "none" && recipe.station !== "furnace")
    ) {
      continue;
    }
    const exactEntryRecipe =
      trainingContext?.recipe.activity === "crafting" &&
      trainingContext.recipe.stableId === recipe.outputItemId;
    if (
      exactEntryRecipe &&
      getInventoryQuantity(input.inventoryItems, recipe.outputItemId) <= 0 &&
      !recipe.inputs.every(
        ({ itemId, quantity }) =>
          getInventoryQuantity(input.inventoryItems, itemId) >=
          quantity * QUEST_ENTRY_TRAINING_BATCH_SIZE,
      )
    ) {
      continue;
    }
    candidates.push({
      activity: "crafting",
      stableId: recipe.outputItemId,
      levelRequired: recipe.levelRequired,
      action: {
        type: "craft",
        recipeId: recipe.outputItemId,
        quantity: 1,
      },
      stationType: recipe.station === "none" ? null : "furnace",
      questEntryPriority: exactEntryRecipe ? 1 : 0,
    });
  }

  for (const recipe of FLETCHING_RECIPES.values()) {
    if (
      recipe.levelRequired > getSkillLevel(input, "fletching") ||
      !hasAuthoredRecipeInputs(input, recipe)
    ) {
      continue;
    }
    const exactEntryRecipe =
      trainingContext?.recipe.activity === "fletching" &&
      trainingContext.recipe.stableId === recipe.recipeId;
    if (
      exactEntryRecipe &&
      getInventoryQuantity(input.inventoryItems, recipe.outputItemId) <= 0 &&
      !recipe.inputs.every(
        ({ itemId, quantity }) =>
          getInventoryQuantity(input.inventoryItems, itemId) >=
          quantity * QUEST_ENTRY_TRAINING_BATCH_SIZE,
      )
    ) {
      continue;
    }
    candidates.push({
      activity: "fletching",
      stableId: recipe.recipeId,
      levelRequired: recipe.levelRequired,
      action: { type: "fletch", recipeId: recipe.recipeId, quantity: 1 },
      stationType: null,
      questEntryPriority: exactEntryRecipe ? 1 : 0,
    });
  }

  const hasTinderbox =
    getInventoryQuantity(input.inventoryItems, "tinderbox") > 0;
  if (hasTinderbox) {
    for (const [logItemId, recipe] of FIREMAKING_RECIPES) {
      if (
        recipe.levelRequired > getSkillLevel(input, "firemaking") ||
        getInventoryQuantity(input.inventoryItems, logItemId) <= 0
      ) {
        continue;
      }
      candidates.push({
        activity: "firemaking",
        stableId: logItemId,
        levelRequired: recipe.levelRequired,
        action: { type: "firemake", logsItemId: logItemId },
        stationType: null,
      });
    }
  }

  for (const recipe of RUNECRAFTING_RECIPES.values()) {
    if (
      recipe.levelRequired > getSkillLevel(input, "runecrafting") ||
      !recipe.essenceItemIds.some(
        (itemId) => getInventoryQuantity(input.inventoryItems, itemId) > 0,
      )
    ) {
      continue;
    }
    candidates.push({
      activity: "runecrafting",
      stableId: recipe.runeType,
      levelRequired: recipe.levelRequired,
      action: { type: "runecraft", runeType: recipe.runeType },
      stationType: "runecrafting",
      stationNameToken: recipe.runeType,
    });
  }

  for (const recipe of TANNING_RECIPES.values()) {
    const precursorQuantity = getInventoryQuantity(
      input.inventoryItems,
      recipe.inputItemId,
    );
    if (precursorQuantity <= 0) {
      continue;
    }
    const entryInput = trainingContext?.recipe.inputs.find(
      ({ itemId }) => itemId === recipe.outputItemId,
    );
    const entryOutputQuantity = getInventoryQuantity(
      input.inventoryItems,
      recipe.outputItemId,
    );
    const desiredEntryQuantity =
      (entryInput?.quantity ?? 0) * QUEST_ENTRY_TRAINING_BATCH_SIZE;
    const isEntryPrerequisite = Boolean(entryInput);
    if (
      isEntryPrerequisite &&
      entryOutputQuantity === 0 &&
      precursorQuantity < desiredEntryQuantity
    ) {
      continue;
    }
    candidates.push({
      activity: "tanning",
      stableId: recipe.outputItemId,
      levelRequired: 0,
      action: {
        type: "tan",
        inputItemId: recipe.inputItemId,
        quantity: 1,
      },
      stationType: "tanner",
      questEntryPriority:
        isEntryPrerequisite &&
        entryOutputQuantity < desiredEntryQuantity &&
        precursorQuantity > 0
          ? 2
          : 0,
    });
  }

  return candidates.sort(
    (left, right) =>
      (right.questEntryPriority ?? 0) - (left.questEntryPriority ?? 0) ||
      (trainingSkill
        ? Number(getProcessingActivitySkill(right.activity) === trainingSkill) -
          Number(getProcessingActivitySkill(left.activity) === trainingSkill)
        : 0) ||
      right.levelRequired - left.levelRequired ||
      left.activity.localeCompare(right.activity) ||
      left.stableId.localeCompare(right.stableId),
  );
}

function pickReadyProcessingAction(
  input: AgentTickInput,
  state: AgentState,
): EmbeddedBehaviorAction | null {
  const position = input.gameState.position;
  const selected = getReadyProcessingCandidates(input).find(
    (candidate) =>
      !isOrdinaryProcessingActionSuppressed(
        input.ordinaryProcessingRetrySuppressions,
        candidate.action,
      ),
  );
  if (!position || !selected) return null;

  const goalType: AgentGoal["type"] =
    selected.activity === "cooking" ||
    selected.activity === "smelting" ||
    selected.activity === "smithing"
      ? selected.activity
      : "provisioning";
  const trainingTarget = findOrdinaryQuestEntrySkillTarget({
    availableQuests: input.availableQuests,
    skills: input.gameState.skills,
    resourceSystemAvailable: input.resourceSystemAvailable,
  });
  const advancesEntrySkill =
    trainingTarget &&
    getProcessingActivitySkill(selected.activity) === trainingTarget.skill;
  state.goal = {
    type: goalType,
    description: advancesEntrySkill
      ? `Training ${trainingTarget.skill} for ${trainingTarget.questName} with ${selected.stableId}`
      : `Processing authored ${selected.activity} recipe ${selected.stableId}`,
    ...(advancesEntrySkill
      ? {
          questId: trainingTarget.questId,
          questName: trainingTarget.questName,
        }
      : {}),
  };

  if (selected.activity === "cooking") {
    const nearFire = isNearbyObject(input.gameState.nearbyEntities, "fire", 1);
    if (nearFire) return selected.action;
  }
  if (!selected.stationType) return selected.action;

  const station = findNearestStation(
    input,
    position,
    selected.stationType,
    selected.stationNameToken,
  );
  if (!station) return null;
  if (isStationInInteractionRange(position, station)) return selected.action;
  return {
    type: "move",
    target: getStationApproachTarget(position, station),
    runMode: true,
  };
}

/**
 * If the agent's inventory is filling up and they're near a relevant station,
 * cook raw food, smelt ore, or deposit at a bank.
 */
function pickCraftOrBankAction(
  input: AgentTickInput,
  nearbyEntities: NearbyEntityData[],
): EmbeddedBehaviorAction | null {
  const inventory = input.inventoryItems;
  if (inventory.length < 15) return null; // plenty of space, skip
  const position = input.gameState.position;
  if (!position) return null;

  // --- Cook raw food if near a cooking range/fire ---
  const range = findNearestStation(input, position, "range");
  const nearRange =
    (range !== null && isStationInInteractionRange(position, range)) ||
    isNearbyObject(nearbyEntities, "fire", 1);
  if (nearRange) {
    const cooking = pickCookableRecipe(input);
    if (cooking) {
      const action = { type: "cook", itemId: cooking.rawItemId } as const;
      if (
        !isOrdinaryProcessingActionSuppressed(
          input.ordinaryProcessingRetrySuppressions,
          action,
        )
      ) {
        return action;
      }
    }
  }

  // --- Smelt ore if near a furnace ---
  const furnace = findNearestStation(input, position, "furnace");
  if (furnace && isStationInInteractionRange(position, furnace)) {
    const smelting = pickSmeltableRecipe(input);
    if (smelting) {
      const action = { type: "smelt", recipe: smelting.barItemId } as const;
      if (
        !isOrdinaryProcessingActionSuppressed(
          input.ordinaryProcessingRetrySuppressions,
          action,
        )
      ) {
        return action;
      }
    }
  }

  // --- Runecraft an exact legal authored recipe at its loaded altar ---
  const runecraftingLevel = getSkillLevel(input, "runecrafting");
  const runecrafting = [...RUNECRAFTING_RECIPES.values()]
    .filter(
      (recipe) =>
        recipe.levelRequired <= runecraftingLevel &&
        recipe.essenceItemIds.some(
          (itemId) => getInventoryQuantity(inventory, itemId) > 0,
        ) &&
        input.stationPositions.some(
          (station) =>
            station.stationType === "runecrafting" &&
            station.name.toLowerCase().includes(recipe.runeType) &&
            isStationInInteractionRange(position, station),
        ) &&
        !isOrdinaryProcessingActionSuppressed(
          input.ordinaryProcessingRetrySuppressions,
          { type: "runecraft", runeType: recipe.runeType },
        ),
    )
    .sort(
      (a, b) =>
        b.levelRequired - a.levelRequired ||
        a.runeType.localeCompare(b.runeType),
    )[0];
  if (runecrafting) {
    return { type: "runecraft", runeType: runecrafting.runeType };
  }

  // --- Bank deposit if near a bank and inventory is nearly full ---
  if (inventory.length >= 24) {
    const bank = findNearestStation(input, position, "bank");
    if (bank && isStationInInteractionRange(position, bank)) {
      return { type: "bankDepositAll", bankId: bank.entityId };
    }
  }

  return null;
}

/**
 * Request a private, server-derived processing batch while standing at a real
 * bank. The worker knows neither bank contents nor requested quantities; it
 * only decides that provisioning is timely from public carried state.
 */
function pickBankStageAction(
  input: AgentTickInput,
  state: AgentState,
): EmbeddedBehaviorAction | null {
  if (Date.now() < input.bankStageRetryAfter) return null;
  const position = input.gameState.position;
  if (!position || input.inventoryItems.length >= 15) return null;
  if (getReadyProcessingCandidates(input).length > 0) return null;
  const carriedRawFood = countInventoryItems(input.inventoryItems, (itemId) =>
    COOKING_RECIPES.has(itemId),
  );
  if (carriedRawFood >= 5) return null;
  if (pickSmeltableRecipe(input, 5) || pickSmithableRecipe(input, 5)) {
    return null;
  }

  const bank = findNearestStation(input, position, "bank");
  if (!bank) return null;
  const trainingTarget = findOrdinaryQuestEntrySkillTarget({
    availableQuests: input.availableQuests,
    skills: input.gameState.skills,
    resourceSystemAvailable: input.resourceSystemAvailable,
  });
  if (!isStationInInteractionRange(position, bank)) {
    if (!trainingTarget) return null;
    state.goal = {
      type: "banking",
      description: `Walking to bank to stage ${trainingTarget.skill} training for ${trainingTarget.questName}`,
      questId: trainingTarget.questId,
      questName: trainingTarget.questName,
    };
    return {
      type: "move",
      target: getStationApproachTarget(position, bank),
      runMode: true,
    };
  }
  state.goal = {
    type: "banking",
    description: trainingTarget
      ? `Staging ${trainingTarget.skill} training for ${trainingTarget.questName}`
      : "Staging an authored processing batch from bank",
    ...(trainingTarget
      ? {
          questId: trainingTarget.questId,
          questName: trainingTarget.questName,
        }
      : {}),
  };
  return { type: "bankWithdraw", bankId: bank.entityId };
}

/**
 * Execute one exact public-source recovery step after a private training-bank
 * miss. Only level-eligible gathering variants and guaranteed authored mob
 * drops are eligible; names, generic types, and probabilistic drops have no
 * acquisition authority.
 */
function pickQuestEntryAcquisitionAction(
  input: AgentTickInput,
  state: AgentState,
): EmbeddedBehaviorAction | null {
  const context = getAuthorizedQuestEntryTrainingContext(input);
  if (!context) return null;
  const position = input.gameState.position;
  if (!position) return { type: "idle" };
  if (input.inventoryItems.length >= 25) return null;

  const dependency = getQuestEntryTrainingDependency(input);
  if (!dependency) return { type: "idle" };
  state.goal = {
    type: "provisioning",
    description: dependency.reason,
    questId: dependency.target.questId,
    questName: dependency.target.questName,
  };

  const gatheringRequirements = getEligibleGatheringRequirements(
    input,
    dependency.itemId,
  ).filter((requirement) => hasCompatibleGatheringTool(input, requirement));
  if (gatheringRequirements.length > 0) {
    const nearbyResources = input.gameState.nearbyEntities
      .filter((entity) => entity.type === "resource" && entity.distance <= 45)
      .sort((a, b) => a.distance - b.distance || a.id.localeCompare(b.id));
    const resource = findResourceForQuest(
      input,
      nearbyResources,
      dependency.itemId,
    );
    if (resource) {
      const dx = position[0] - resource.position[0];
      const dz = position[2] - resource.position[2];
      if (Math.sqrt(dx * dx + dz * dz) < 4) {
        return { type: "gather", targetId: resource.id };
      }
      return {
        type: "move",
        target: [resource.position[0], position[1], resource.position[2]],
        runMode: false,
      };
    }
    return moveTowardResourceArea(input, position, dependency.itemId);
  }

  const guaranteedMobTypes = new Set(
    GUARANTEED_MOB_TYPES_BY_DROP.get(dependency.itemId) ?? [],
  );
  if (guaranteedMobTypes.size > 0) {
    if (
      input.gameState.health / Math.max(1, input.gameState.maxHealth) <=
      0.4
    ) {
      return { type: "idle" };
    }
    const nearbyMob = input.gameState.nearbyEntities
      .filter(
        (entity) =>
          entity.type === "mob" &&
          typeof entity.mobType === "string" &&
          guaranteedMobTypes.has(entity.mobType) &&
          (entity.health === undefined || entity.health > 0),
      )
      .sort((a, b) => a.distance - b.distance || a.id.localeCompare(b.id))[0];
    if (nearbyMob) {
      state.currentTargetId = nearbyMob.id;
      return { type: "attack", targetId: nearbyMob.id };
    }

    const distantMob = input.worldMobs
      .filter((mob) => guaranteedMobTypes.has(mob.mobType))
      .map((mob) => {
        const dx = position[0] - mob.position[0];
        const dz = position[2] - mob.position[2];
        return { mob, distance: Math.sqrt(dx * dx + dz * dz) };
      })
      .sort(
        (a, b) =>
          a.distance - b.distance ||
          a.mob.mobType.localeCompare(b.mob.mobType) ||
          a.mob.position[0] - b.mob.position[0] ||
          a.mob.position[2] - b.mob.position[2],
      )[0]?.mob;
    return distantMob
      ? {
          type: "move",
          target: [distantMob.position[0], position[1], distantMob.position[2]],
          runMode: true,
        }
      : { type: "idle" };
  }

  // Store-only leaves are handled before this function. Missing live store
  // identity is a content/load failure and must not degrade into random work.
  return { type: "idle" };
}

/**
 * Earn currency only after the main process reports a definite insufficient-
 * coin rejection. The worker receives one boolean fence and can use only an
 * exact live mob identity with a probability-one authored coin drop.
 */
function pickCoinRecoveryAction(
  input: AgentTickInput,
  state: AgentState,
): EmbeddedBehaviorAction | null {
  if (input.coinRecoveryAuthorized !== true) return null;
  const position = input.gameState.position;
  if (!position) return { type: "idle" };
  state.goal = {
    type: "provisioning",
    description: "Earn guaranteed coins for an authored purchase",
  };

  if (input.gameState.health / Math.max(1, input.gameState.maxHealth) <= 0.4) {
    return { type: "idle" };
  }

  const guaranteedCoinMobTypes = new Set(
    GUARANTEED_MOB_TYPES_BY_DROP.get("coins") ?? [],
  );
  if (guaranteedCoinMobTypes.size === 0) return { type: "idle" };

  const nearbyMob = input.gameState.nearbyEntities
    .filter(
      (entity) =>
        entity.type === "mob" &&
        typeof entity.mobType === "string" &&
        guaranteedCoinMobTypes.has(entity.mobType) &&
        (entity.health === undefined || entity.health > 0),
    )
    .sort((a, b) => a.distance - b.distance || a.id.localeCompare(b.id))[0];
  if (nearbyMob) {
    state.currentTargetId = nearbyMob.id;
    return { type: "attack", targetId: nearbyMob.id };
  }

  const distantMob = input.worldMobs
    .filter((mob) => guaranteedCoinMobTypes.has(mob.mobType))
    .map((mob) => {
      const dx = position[0] - mob.position[0];
      const dz = position[2] - mob.position[2];
      return { mob, distance: Math.sqrt(dx * dx + dz * dz) };
    })
    .sort(
      (a, b) =>
        a.distance - b.distance ||
        a.mob.mobType.localeCompare(b.mob.mobType) ||
        a.mob.position[0] - b.mob.position[0] ||
        a.mob.position[2] - b.mob.position[2],
    )[0]?.mob;
  return distantMob
    ? {
        type: "move",
        target: [distantMob.position[0], position[1], distantMob.position[2]],
        runMode: true,
      }
    : { type: "idle" };
}

// ─── EATING ──────────────────────────────────────────────────────────────

function pickFoodAction(
  input: AgentTickInput,
  state: AgentState,
): Extract<EmbeddedBehaviorAction, { type: "use" }> | null {
  const { health, maxHealth, inCombat } = input.gameState;
  if (maxHealth <= 0) return null;

  const healthPercent = health / maxHealth;
  const EAT_COOLDOWN_MS = inCombat ? 6000 : 12000;
  const criticalInCombat = inCombat && healthPercent <= 0.25;
  if (!criticalInCombat && Date.now() - state.lastAteAt < EAT_COOLDOWN_MS)
    return null;

  const missingHp = maxHealth - health;
  if (missingHp < 2) return null;

  const eatThreshold = inCombat ? 0.5 : 0.7;
  if (healthPercent >= eatThreshold) return null;

  const inventory = input.inventoryItems;
  if (inventory.length === 0) return null;

  let bestFood: { itemId: string; healAmount: number; slot: number } | null =
    null;

  for (const slot of inventory) {
    const itemData = getItem(slot.itemId);
    if (!itemData) continue;

    const healAmount = itemData.healAmount;
    if (!healAmount || healAmount <= 0) continue;

    if (!bestFood) {
      bestFood = { itemId: slot.itemId, healAmount, slot: slot.slot };
      continue;
    }

    const bestOverheal = Math.max(0, bestFood.healAmount - missingHp);
    const thisOverheal = Math.max(0, healAmount - missingHp);

    if (thisOverheal < bestOverheal) {
      bestFood = { itemId: slot.itemId, healAmount, slot: slot.slot };
    } else if (
      thisOverheal === bestOverheal &&
      healAmount > bestFood.healAmount
    ) {
      bestFood = { itemId: slot.itemId, healAmount, slot: slot.slot };
    }
  }

  return bestFood ? { type: "use", itemId: bestFood.itemId } : null;
}

// ─── EQUIPMENT MANAGEMENT ────────────────────────────────────────────────

function pickEquipmentAction(
  input: AgentTickInput,
): Extract<EmbeddedBehaviorAction, { type: "equip" }> | null {
  const inventory = input.inventoryItems;
  if (inventory.length === 0) return null;

  const equipped = input.equippedItems;

  // --- WEAPON ---
  const equippedWeaponId = equipped.weapon || null;
  let bestWeapon: { itemId: string; score: number } | null = null;

  for (const slot of inventory) {
    const itemData = getItem(slot.itemId);
    if (!itemData) continue;
    if (itemData.equipSlot !== "weapon" && itemData.equipSlot !== "2h")
      continue;

    const bonuses = itemData.bonuses;
    const score = (bonuses?.attack || 0) + (bonuses?.strength || 0);

    if (!bestWeapon || score > bestWeapon.score) {
      bestWeapon = { itemId: slot.itemId, score };
    }
  }

  let equippedWeaponScore = 0;
  if (equippedWeaponId) {
    const d = getItem(equippedWeaponId);
    if (d) {
      const b = d.bonuses;
      equippedWeaponScore = (b?.attack || 0) + (b?.strength || 0);
    }
  }

  if (
    bestWeapon &&
    bestWeapon.score > equippedWeaponScore &&
    bestWeapon.itemId !== equippedWeaponId
  ) {
    return { type: "equip", itemId: bestWeapon.itemId };
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

      const bonuses = itemData.bonuses;
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
          const b = d.bonuses;
          currentScore = (b?.defense || 0) + (b?.attack || 0);
        }
      }

      if (bestArmor.score > currentScore && bestArmor.itemId !== equippedId) {
        return { type: "equip", itemId: bestArmor.itemId };
      }
    }
  }
  return null;
}

function pickPrayerTrainingAction(
  input: AgentTickInput,
): Extract<EmbeddedBehaviorAction, { type: "bury" }> | null {
  const prayer = input.gameState.skills.prayer;
  const level = Number(prayer?.level ?? 1);
  const xp = Number(prayer?.xp ?? 0);
  if (
    !Number.isSafeInteger(level) ||
    level < 1 ||
    level > 99 ||
    !Number.isSafeInteger(xp) ||
    xp < 0 ||
    xp >= 200_000_000
  ) {
    return null;
  }
  const candidates = input.inventoryItems
    .filter(
      (entry) => Number.isSafeInteger(entry.quantity) && entry.quantity > 0,
    )
    .map((entry) => ({ entry, item: getItem(entry.itemId) }))
    .filter(
      (
        candidate,
      ): candidate is {
        entry: (typeof input.inventoryItems)[number];
        item: WorkerItemData;
      } =>
        Boolean(candidate.item) &&
        Number.isSafeInteger(candidate.item!.prayerXp) &&
        (candidate.item!.prayerXp ?? 0) > 0 &&
        Number.isSafeInteger(candidate.item!.buryLevelRequired ?? 1) &&
        (candidate.item!.buryLevelRequired ?? 1) <= level,
    )
    .sort(
      (left, right) =>
        (right.item.prayerXp ?? 0) - (left.item.prayerXp ?? 0) ||
        left.entry.slot - right.entry.slot ||
        left.entry.itemId.localeCompare(right.entry.itemId),
    );
  return candidates[0]
    ? { type: "bury", itemId: candidates[0].entry.itemId }
    : null;
}

// ─── ACTION SELECTION ────────────────────────────────────────────────────

function pickBehaviorAction(
  input: AgentTickInput,
  state: AgentState,
): EmbeddedBehaviorAction {
  const gameState = input.gameState;
  const healthPercent =
    gameState.maxHealth > 0 ? gameState.health / gameState.maxHealth : 1;
  const position = gameState.position!;

  const nearbyItems = gameState.nearbyEntities
    .filter((entity) => entity.type === "item" && entity.distance <= 15)
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
    .filter((entity) => entity.type === "resource" && entity.distance <= 45)
    .sort((a, b) => a.distance - b.distance);

  if (gameState.inCombat) {
    return { type: "idle" };
  }

  if (input.attackObservationRetryAfter > Date.now()) {
    state.currentTargetId = null;
    return { type: "idle" };
  }

  // A full-health respawn may need the exact gravestone to recover its food
  // tool or reserve. Resolve that owned custody before the foodless fence;
  // partial-health agents still wait unless they already carry food.
  const gravestoneRecovery = pickGravestoneRecoveryAction(input);
  if (gravestoneRecovery) return gravestoneRecovery;

  // With no carried food, passive regeneration is the only authoritative
  // recovery path available to an ordinary agent. A dispatched attack can
  // continue through several server combat ticks before the worker decides
  // again, so partial health always fences new progression. When production
  // content exposes an authored cooked-food catalog, full health also fails
  // closed until the bank/store maintenance stages above can observe their
  // exact runtime identities. The only exception is a main-thread
  // authorization to earn coins after a secure purchase was rejected.
  const hasCarriedFood = hasReadyFood(input);
  const needsPassiveRecoveryWithoutFood =
    !hasCarriedFood && gameState.health < gameState.maxHealth;
  const needsSurvivalProvisioning =
    !hasSurvivalFoodReserve(input) &&
    gameState.health >= gameState.maxHealth &&
    hasAuthoredSurvivalFoodCatalog() &&
    input.coinRecoveryAuthorized !== true;
  if (
    healthPercent <= 0.5 ||
    needsPassiveRecoveryWithoutFood ||
    needsSurvivalProvisioning
  ) {
    state.currentTargetId = null;
    return { type: "idle" };
  }

  // Convert carried prayer resources into persistent preparation progress
  // before ordinary loot/crafting can bank them away.
  const prayerTraining = pickPrayerTrainingAction(input);
  if (prayerTraining) return prayerTraining;

  // Drain a complete conserved processing batch before asking the private bank
  // for more material. Quest work keeps its dedicated target-aware planner.
  if (state.goal?.type !== "questing") {
    const readyProcessing = pickReadyProcessingAction(input, state);
    if (readyProcessing) return readyProcessing;
  }

  // Opportunistic loot pickup
  if (nearbyItems.length > 0 && Date.now() > state.dropCooldownUntil) {
    return { type: "pickup", targetId: nearbyItems[0].id };
  }

  const bankStageAction = pickBankStageAction(input, state);
  if (bankStageAction) return bankStageAction;

  const coinRecoveryAction = pickCoinRecoveryAction(input, state);
  if (coinRecoveryAction) return coinRecoveryAction;

  const entryAcquisitionAction = pickQuestEntryAcquisitionAction(input, state);
  if (entryAcquisitionAction) return entryAcquisitionAction;

  // === CRAFTING & BANKING (when inventory is filling up) ===
  const craftAction = pickCraftOrBankAction(input, gameState.nearbyEntities);
  if (craftAction) return craftAction;

  const goal = state.goal;

  // === QUEST-DRIVEN BEHAVIOR (with stall detection) ===
  if (goal?.type === "questing" && goal.questId) {
    const stalled = isQuestStalled(input, goal);
    if (!stalled) {
      const questAction = pickQuestAction(
        input,
        state,
        position,
        nearbyMobs,
        nearbyResources,
        healthPercent,
      );
      if (
        questAction &&
        !isOrdinaryProcessingActionSuppressed(
          input.ordinaryProcessingRetrySuppressions,
          questAction,
        )
      ) {
        return questAction;
      }
    }
    // Quest is stalled or pickQuestAction returned null — clear the questing goal
    // so the planner can set a new one (combat, gathering, etc.)
    state.goal = null;
  }

  // === DEFAULT: autonomous activity planner ===
  return pickCombatOrExplore(
    input,
    state,
    position,
    nearbyMobs,
    nearbyResources,
    healthPercent,
  );
}

function pickQuestAction(
  input: AgentTickInput,
  state: AgentState,
  position: [number, number, number],
  nearbyMobs: NearbyEntityData[],
  nearbyResources: NearbyEntityData[],
  healthPercent: number,
): EmbeddedBehaviorAction | null {
  const goal = state.goal!;
  const activeQuest = input.questState.find((q) => q.questId === goal.questId);

  // Quest not yet accepted
  if (!activeQuest && !state.questsAccepted.includes(goal.questId!)) {
    return moveToNpcOrAccept(
      input,
      position,
      goal.questId!,
      goal.questStartNpc,
    );
  }

  // Ready to complete
  if (activeQuest?.status === "ready_to_complete") {
    return moveToNpcOrComplete(input, position, activeQuest);
  }

  // In progress
  if (activeQuest?.status === "in_progress") {
    const stageType = activeQuest.stageType;
    const stageTarget = activeQuest.stageTarget || "";

    // Shopping runs before quest execution. If its exact dependency is still
    // unresolved here, only a carried-tool-backed gathering path may proceed;
    // store-only materials and missing tools wait instead of hammering an
    // authoritative action that is guaranteed to reject.
    const unresolvedDependency = getQuestDependencyNeed(
      input,
      stageType ?? "",
      stageTarget,
    );
    if (unresolvedDependency) {
      const gatheringRequirements = getEligibleGatheringRequirements(
        input,
        unresolvedDependency.itemId,
      );
      const canGatherNow =
        unresolvedDependency.role === "material" &&
        gatheringRequirements.some((requirement) =>
          hasCompatibleGatheringTool(input, requirement),
        );
      if (!canGatherNow) return { type: "idle" };
    }

    if (stageType === "dialogue") {
      return moveToNpcOrComplete(input, position, activeQuest);
    }

    if (stageType === "kill") {
      const targetMob = findMobForQuest(input, nearbyMobs, stageTarget);
      if (targetMob && healthPercent > 0.4) {
        state.currentTargetId = targetMob.id;
        return { type: "attack", targetId: targetMob.id };
      }
      state.currentTargetId = null;
      return moveTowardSpawn(input, position);
    }

    if (stageType === "gather") {
      const resource = findResourceForQuest(
        input,
        nearbyResources,
        stageTarget,
      );
      if (resource) {
        const rdx = position[0] - resource.position[0];
        const rdz = position[2] - resource.position[2];
        const dist2d = Math.sqrt(rdx * rdx + rdz * rdz);

        if (dist2d < 4) {
          const GATHER_REQUEUE_COOLDOWN = 30000;
          if (
            state.lastGatherTargetId === resource.id &&
            Date.now() - state.lastGatherQueuedAt < GATHER_REQUEUE_COOLDOWN
          ) {
            return { type: "idle" };
          }
          state.lastGatherTargetId = resource.id;
          state.lastGatherQueuedAt = Date.now();
          return { type: "gather", targetId: resource.id };
        }

        return {
          type: "move",
          target: [resource.position[0], position[1], resource.position[2]],
          runMode: false,
        };
      }
      return moveTowardResourceArea(input, position, stageTarget);
    }

    if (stageType === "interact") {
      const runecraftingRecipe = RUNECRAFTING_BY_OUTPUT.get(stageTarget);
      if (
        runecraftingRecipe &&
        runecraftingRecipe.levelRequired <= getSkillLevel(input, "runecrafting")
      ) {
        const inventory = input.inventoryItems;
        const essenceItemId = runecraftingRecipe.essenceItemIds.find(
          (itemId) => getInventoryQuantity(inventory, itemId) > 0,
        );

        if (essenceItemId) {
          const runeType = runecraftingRecipe.runeType;
          // Bind navigation and execution to the same exact loaded altar. A
          // merely visible altar can still be outside its interaction range.
          const altar = findNearestStation(
            input,
            position,
            "runecrafting",
            runeType,
          );
          if (altar && isStationInInteractionRange(position, altar)) {
            return { type: "runecraft", runeType };
          }
          if (altar) {
            return {
              type: "move",
              target: getStationApproachTarget(position, altar),
              runMode: true,
            };
          }
        } else {
          const requiredEssence = runecraftingRecipe.essenceItemIds[0];
          if (!requiredEssence) return null;
          const essenceRock = findResourceForQuest(
            input,
            nearbyResources,
            requiredEssence,
          );
          if (essenceRock) {
            const rdx = position[0] - essenceRock.position[0];
            const rdz = position[2] - essenceRock.position[2];
            const dist2d = Math.sqrt(rdx * rdx + rdz * rdz);
            if (dist2d < 4) {
              return { type: "gather", targetId: essenceRock.id };
            }
            return {
              type: "move",
              target: [
                essenceRock.position[0],
                position[1],
                essenceRock.position[2],
              ],
              runMode: false,
            };
          }
          return moveTowardResourceArea(input, position, requiredEssence);
        }
      }

      if (stageTarget === "fire") {
        const inventory = input.inventoryItems;
        const hasTinderbox = inventory.some((i) => i.itemId === "tinderbox");
        const firemakingLevel = getSkillLevel(input, "firemaking");
        const logsItem = inventory
          .filter((item) => {
            const recipe = FIREMAKING_RECIPES.get(item.itemId);
            return (
              item.quantity > 0 &&
              recipe !== undefined &&
              recipe.levelRequired <= firemakingLevel
            );
          })
          .sort((a, b) => {
            const levelA = FIREMAKING_RECIPES.get(a.itemId)?.levelRequired ?? 0;
            const levelB = FIREMAKING_RECIPES.get(b.itemId)?.levelRequired ?? 0;
            return levelB - levelA || a.itemId.localeCompare(b.itemId);
          })[0];

        if (hasTinderbox && logsItem) {
          return { type: "firemake", logsItemId: logsItem.itemId };
        }

        const tree = findResourceForQuest(input, nearbyResources, "logs");
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
        return moveTowardResourceArea(input, position, "logs");
      }

      // Cooking quest stages (e.g. cook_shrimp → target "shrimp")
      // Find the raw item that cooks into the stage target
      const rawItemId = COOKING_INPUT_BY_OUTPUT.get(stageTarget);
      if (rawItemId) {
        const inventory = input.inventoryItems;
        const recipe = COOKING_RECIPES.get(rawItemId);
        const hasRawItem =
          Boolean(recipe) &&
          recipe!.levelRequired <= getSkillLevel(input, "cooking") &&
          getInventoryQuantity(inventory, rawItemId) > 0;

        if (hasRawItem) {
          // Always try cook first — the ticker handles firemake fallback.
          // executeCook checks ProcessingSystem for player-lit fires that
          // don't appear in nearbyEntities.
          return { type: "cook", itemId: rawItemId };
        } else {
          // Need to gather the raw item (e.g. fish for raw_shrimp)
          const fishingSpot = findResourceForQuest(
            input,
            nearbyResources,
            rawItemId,
          );
          if (fishingSpot) {
            const rdx = position[0] - fishingSpot.position[0];
            const rdz = position[2] - fishingSpot.position[2];
            const dist2d = Math.sqrt(rdx * rdx + rdz * rdz);
            if (dist2d < 4) {
              return { type: "gather", targetId: fishingSpot.id };
            }
            return {
              type: "move",
              target: [
                fishingSpot.position[0],
                position[1],
                fishingSpot.position[2],
              ],
              runMode: false,
            };
          }
          return moveTowardResourceArea(input, position, rawItemId);
        }
      }
    }

    // Smelting quest stages use the exact loaded recipe rather than an ore-name guess.
    const directSmeltingRecipe = SMELTING_RECIPES.get(stageTarget);
    const smeltingEntry = directSmeltingRecipe
      ? ([stageTarget, directSmeltingRecipe] as const)
      : [...SMELTING_RECIPES.entries()]
          .filter(([, recipe]) =>
            recipe.inputs.some(({ itemId }) => itemId === stageTarget),
          )
          .sort(
            ([barA, recipeA], [barB, recipeB]) =>
              recipeB.levelRequired - recipeA.levelRequired ||
              barA.localeCompare(barB),
          )[0];
    if (
      smeltingEntry &&
      smeltingEntry[1].levelRequired <= getSkillLevel(input, "smithing")
    ) {
      const [barItemId, recipe] = smeltingEntry;
      if (hasSmeltingInputs(input, recipe)) {
        const furnace = findNearestStation(input, position, "furnace");
        if (furnace && isStationInInteractionRange(position, furnace)) {
          return { type: "smelt", recipe: barItemId };
        }
        if (furnace) {
          return {
            type: "move",
            target: getStationApproachTarget(position, furnace),
            runMode: true,
          };
        }
      } else {
        for (const { itemId, quantity } of recipe.inputs) {
          if (getInventoryQuantity(input.inventoryItems, itemId) >= quantity) {
            continue;
          }
          const resource = findResourceForQuest(input, nearbyResources, itemId);
          if (resource) {
            const rdx = position[0] - resource.position[0];
            const rdz = position[2] - resource.position[2];
            if (Math.sqrt(rdx * rdx + rdz * rdz) < 4) {
              return { type: "gather", targetId: resource.id };
            }
            return {
              type: "move",
              target: [resource.position[0], position[1], resource.position[2]],
              runMode: false,
            };
          }
          return moveTowardResourceArea(input, position, itemId);
        }
      }
    }

    // Any authored Smithing output can drive a quest, across every metal tier.
    const smithingRecipe = SMITHING_RECIPES.get(stageTarget);
    if (
      smithingRecipe &&
      smithingRecipe.levelRequired <= getSkillLevel(input, "smithing")
    ) {
      const carriedBars = getInventoryQuantity(
        input.inventoryItems,
        smithingRecipe.barItemId,
      );
      if (carriedBars >= smithingRecipe.barsRequired) {
        const anvil = findNearestStation(input, position, "anvil");
        if (anvil && isStationInInteractionRange(position, anvil)) {
          return { type: "smith", recipe: stageTarget };
        }
        if (anvil) {
          return {
            type: "move",
            target: getStationApproachTarget(position, anvil),
            runMode: true,
          };
        }
      } else {
        const barRecipe = SMELTING_RECIPES.get(smithingRecipe.barItemId);
        if (
          barRecipe &&
          barRecipe.levelRequired <= getSkillLevel(input, "smithing")
        ) {
          if (hasSmeltingInputs(input, barRecipe)) {
            const furnace = findNearestStation(input, position, "furnace");
            if (furnace && isStationInInteractionRange(position, furnace)) {
              return { type: "smelt", recipe: smithingRecipe.barItemId };
            }
            if (furnace) {
              return {
                type: "move",
                target: getStationApproachTarget(position, furnace),
                runMode: true,
              };
            }
          }
          for (const { itemId, quantity } of barRecipe.inputs) {
            if (
              getInventoryQuantity(input.inventoryItems, itemId) >= quantity
            ) {
              continue;
            }
            const resource = findResourceForQuest(
              input,
              nearbyResources,
              itemId,
            );
            if (resource) {
              const rdx = position[0] - resource.position[0];
              const rdz = position[2] - resource.position[2];
              if (Math.sqrt(rdx * rdx + rdz * rdz) < 4) {
                return { type: "gather", targetId: resource.id };
              }
              return {
                type: "move",
                target: [
                  resource.position[0],
                  position[1],
                  resource.position[2],
                ],
                runMode: false,
              };
            }
            return moveTowardResourceArea(input, position, itemId);
          }
        }
      }
    }

    const craftingRecipe = CRAFTING_RECIPES.get(stageTarget);
    if (craftingRecipe) {
      const craftingLevel = getSkillLevel(input, "crafting");
      const exactLegal = craftingRecipe.levelRequired <= craftingLevel;
      const exactComplete = hasAuthoredRecipeInputs(input, craftingRecipe);
      let selectedCrafting =
        exactLegal && exactComplete ? craftingRecipe : null;
      if (!selectedCrafting && !exactLegal) {
        selectedCrafting = [...CRAFTING_RECIPES.values()]
          .filter(
            (recipe) =>
              recipe.category === craftingRecipe.category &&
              recipe.levelRequired <= craftingLevel &&
              hasAuthoredRecipeInputs(input, recipe),
          )
          .sort(
            (a, b) =>
              b.levelRequired - a.levelRequired ||
              a.outputItemId.localeCompare(b.outputItemId),
          )[0];
      }
      if (selectedCrafting) {
        if (selectedCrafting.station !== "none") {
          const station = findNearestStation(
            input,
            position,
            selectedCrafting.station,
          );
          if (!station) return null;
          if (!isStationInInteractionRange(position, station)) {
            return {
              type: "move",
              target: getStationApproachTarget(position, station),
              runMode: true,
            };
          }
        }
        return {
          type: "craft",
          recipeId: selectedCrafting.outputItemId,
          quantity: 1,
        };
      }

      for (const inputItem of craftingRecipe.inputs) {
        if (
          getInventoryQuantity(input.inventoryItems, inputItem.itemId) >=
          inputItem.quantity
        ) {
          continue;
        }
        const tanning = [...TANNING_RECIPES.values()].find(
          (recipe) => recipe.outputItemId === inputItem.itemId,
        );
        if (
          tanning &&
          getInventoryQuantity(input.inventoryItems, tanning.inputItemId) > 0
        ) {
          const tanner = findNearestStation(input, position, "tanner");
          if (!tanner) return null;
          if (!isStationInInteractionRange(position, tanner)) {
            return {
              type: "move",
              target: getStationApproachTarget(position, tanner),
              runMode: true,
            };
          }
          return {
            type: "tan",
            inputItemId: tanning.inputItemId,
            quantity: 1,
          };
        }
      }
      return { type: "idle" };
    }

    const fletchingRecipes = getFletchingRecipesForOutput(stageTarget);
    if (fletchingRecipes.length > 0) {
      const step = getFletchingQuestStep(input, stageTarget);
      if (step?.kind === "action") {
        return {
          type: "fletch",
          recipeId: step.recipe.recipeId,
          quantity: 1,
        };
      }
      if (step?.kind === "need" && step.need.role === "material") {
        const gatheringRequirements = getEligibleGatheringRequirements(
          input,
          step.need.itemId,
        );
        if (
          gatheringRequirements.some((requirement) =>
            hasCompatibleGatheringTool(input, requirement),
          )
        ) {
          const resource = findResourceForQuest(
            input,
            nearbyResources,
            step.need.itemId,
          );
          if (resource) {
            const rdx = position[0] - resource.position[0];
            const rdz = position[2] - resource.position[2];
            if (Math.sqrt(rdx * rdx + rdz * rdz) < 4) {
              return { type: "gather", targetId: resource.id };
            }
            return {
              type: "move",
              target: [resource.position[0], position[1], resource.position[2]],
              runMode: false,
            };
          }
          return moveTowardResourceArea(input, position, step.need.itemId);
        }
      }
      return { type: "idle" };
    }

    // Fallback: the interact stage wasn't handled by any specific handler.
    // Rather than returning null (which clears the quest goal), try to
    // navigate toward the quest's start NPC for dialogue.
    return moveToNpcOrComplete(input, position, activeQuest);
  }

  return null;
}

function findMobForQuest(
  input: AgentTickInput,
  nearbyMobs: NearbyEntityData[],
  stageTarget: string,
): NearbyEntityData | undefined {
  if (nearbyMobs.length === 0) return undefined;

  const target = stageTarget.toLowerCase();

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
  for (const other of input.otherAgentTargets) {
    if (other.targetId) {
      takenTargets.add(other.targetId);
    }
  }

  const untargeted = candidates.find((m) => !takenTargets.has(m.id));
  if (untargeted) return untargeted;

  // All mobs taken — pick least contested
  const targetCounts = new Map<string, number>();
  for (const other of input.otherAgentTargets) {
    if (other.targetId) {
      targetCounts.set(
        other.targetId,
        (targetCounts.get(other.targetId) || 0) + 1,
      );
    }
  }
  candidates.sort(
    (a, b) => (targetCounts.get(a.id) || 0) - (targetCounts.get(b.id) || 0),
  );

  return candidates[0];
}

function findResourceForQuest(
  input: AgentTickInput,
  nearbyResources: NearbyEntityData[],
  itemId: string,
): NearbyEntityData | undefined {
  const eligibleResourceIds = new Set(
    getEligibleGatheringRequirements(input, itemId).map(
      (requirement) => requirement.resourceId,
    ),
  );
  if (eligibleResourceIds.size === 0) return undefined;

  return nearbyResources
    .filter(
      (resource) =>
        typeof resource.resourceId === "string" &&
        eligibleResourceIds.has(resource.resourceId),
    )
    .sort((a, b) => a.distance - b.distance || a.id.localeCompare(b.id))[0];
}

function moveToNpcOrAccept(
  input: AgentTickInput,
  position: [number, number, number],
  questId: string,
  questStartNpc?: string,
): EmbeddedBehaviorAction {
  if (questStartNpc) {
    const npc = input.npcPositions.find(
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

function moveToNpcOrComplete(
  input: AgentTickInput,
  position: [number, number, number],
  activeQuest: AgentQuestProgress,
): EmbeddedBehaviorAction {
  const startNpc = activeQuest.startNpc;
  const npc = input.npcPositions.find(
    (n) =>
      n.npcId === startNpc ||
      n.name.toLowerCase().includes(startNpc.replace(/_/g, " ").toLowerCase()),
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
 * Navigate toward a resource area. Uses pre-computed world resources
 * from the main thread instead of iterating all world entities.
 */
function moveTowardResourceArea(
  input: AgentTickInput,
  position: [number, number, number],
  itemId: string,
): EmbeddedBehaviorAction {
  const eligibleResourceIds = new Set(
    getEligibleGatheringRequirements(input, itemId).map(
      (requirement) => requirement.resourceId,
    ),
  );
  if (eligibleResourceIds.size === 0) return { type: "idle" };

  let bestPos: [number, number, number] | null = null;
  let bestDist = Infinity;

  for (const resource of input.worldResources) {
    if (resource.depleted) continue;
    if (!eligibleResourceIds.has(resource.resourceId)) continue;

    const dx = position[0] - resource.position[0];
    const dz = position[2] - resource.position[2];
    const dist = Math.sqrt(dx * dx + dz * dz);
    if (dist < bestDist) {
      bestDist = dist;
      bestPos = resource.position;
    }
  }

  if (bestPos) {
    return {
      type: "move",
      target: [bestPos[0], position[1], bestPos[2]],
      runMode: false,
    };
  }

  return { type: "idle" };
}

// ─── QUEST STALL DETECTION ───────────────────────────────────────────────
//
// If the agent hasn't made progress on a quest stage for QUEST_STALL_TICKS,
// temporarily shelve the quest and let the autonomous planner run instead.
// After QUEST_STALL_COOLDOWN_MS, the quest becomes eligible again.

/** Tracks per-agent quest progress for stall detection */
const questStallTracker = new Map<
  string,
  {
    questId: string;
    /** Snapshot of quest progress to detect changes */
    stageKey: string;
    /** Number of ticks with no progress */
    stallTicks: number;
    /** When the quest was shelved (0 = not shelved) */
    shelvedUntil: number;
  }
>();

/** Ticks with no quest progress before shelving (~96s at 8s ticks).
 *  Set high because multi-step quests (fish → cook) need many ticks for
 *  intermediate steps that don't change quest progress directly. */
const QUEST_STALL_TICKS = 12;
/** How long to shelve a stalled quest before retrying (1 min) */
const QUEST_STALL_COOLDOWN_MS = 60_000;

/**
 * Build a key representing current quest progress state.
 * If this key doesn't change between ticks, the quest is stalling.
 * Includes inventory counts for quest-related items so intermediate
 * steps (fishing for raw_shrimp to cook later) count as progress.
 */
function buildQuestStageKey(input: AgentTickInput, questId: string): string {
  const quest = input.questState.find((q) => q.questId === questId);
  if (!quest) return `not_active:${questId}`;
  const progressStr = JSON.stringify(quest.stageProgress);

  // Include inventory counts for relevant items to detect intermediate progress.
  // e.g. for cook_shrimp quest, picking up raw_shrimp counts as progress.
  let inventoryKey = "";
  if (quest.stageType === "interact" && quest.stageTarget) {
    const target = quest.stageTarget;
    const rawItemId = COOKING_INPUT_BY_OUTPUT.get(target);
    if (rawItemId) {
      const rawCount = input.inventoryItems
        .filter((i) => i.itemId === rawItemId)
        .reduce((sum, i) => sum + i.quantity, 0);
      inventoryKey = `:inv_${rawItemId}=${rawCount}`;
    }
    const runecraftingRecipe = RUNECRAFTING_BY_OUTPUT.get(target);
    if (runecraftingRecipe) {
      const essenceCount = runecraftingRecipe.essenceItemIds.reduce(
        (sum, itemId) =>
          sum + getInventoryQuantity(input.inventoryItems, itemId),
        0,
      );
      inventoryKey = `:inv_runecrafting_essence=${essenceCount}`;
    }
  }

  // Include rounded position so movement (walking to mine, to altar, etc.) counts as progress
  const pos = input.gameState.position;
  const posKey = pos
    ? `:pos=${Math.round(pos[0] / 5)},${Math.round(pos[2] / 5)}`
    : "";

  return `${quest.status}:${quest.stageType}:${quest.stageTarget}:${progressStr}${inventoryKey}${posKey}`;
}

/**
 * Returns true if the quest is stalled and should be temporarily shelved.
 */
function isQuestStalled(input: AgentTickInput, goal: AgentGoal): boolean {
  const agentId = input.characterId;
  const questId = goal.questId!;

  let tracker = questStallTracker.get(agentId);

  // Quest changed — reset tracker
  if (!tracker || tracker.questId !== questId) {
    tracker = { questId, stageKey: "", stallTicks: 0, shelvedUntil: 0 };
    questStallTracker.set(agentId, tracker);
  }

  // If currently shelved, check if cooldown expired
  if (tracker.shelvedUntil > 0) {
    if (Date.now() < tracker.shelvedUntil) {
      return true; // Still shelved
    }
    // Cooldown expired — retry the quest
    tracker.shelvedUntil = 0;
    tracker.stallTicks = 0;
  }

  const currentKey = buildQuestStageKey(input, questId);

  if (currentKey === tracker.stageKey) {
    // No progress since last tick
    tracker.stallTicks++;
  } else {
    // Progress! Reset stall counter
    tracker.stageKey = currentKey;
    tracker.stallTicks = 0;
  }

  if (tracker.stallTicks >= QUEST_STALL_TICKS) {
    // Shelve this quest temporarily
    tracker.shelvedUntil = Date.now() + QUEST_STALL_COOLDOWN_MS;
    tracker.stallTicks = 0;
    return true;
  }

  return false;
}

// ─── AUTONOMOUS ACTIVITY PLANNER ─────────────────────────────────────────
//
// When no quest is active, rotate between meaningful activities:
// combat → gather → process (cook/smelt) → bank → explore → repeat
//
// The planner checks inventory contents, nearby entities, and known station
// locations to decide the most productive next step.

/** Per-agent activity rotation state (keyed by characterId) */
const activityRotation = new Map<
  string,
  {
    lastActivity: string;
    lastActivityAt: number;
    /** How many consecutive ticks doing the same goal type */
    sameGoalTicks: number;
  }
>();

/** Maximum ticks before forcing a goal rotation (~40s at 8s ticks) */
const MAX_SAME_GOAL_TICKS = 5;

function findNearestStation(
  input: AgentTickInput,
  position: [number, number, number],
  stationType: string,
  nameToken?: string,
): WorkerStationData | null {
  let bestStation: WorkerStationData | null = null;
  let bestDist = Infinity;
  for (const station of input.stationPositions) {
    if (station.stationType !== stationType) continue;
    if (
      nameToken &&
      !station.name.toLowerCase().includes(nameToken.toLowerCase())
    ) {
      continue;
    }
    const dist = getStationDistance(position, station);
    if (dist < bestDist) {
      bestDist = dist;
      bestStation = station;
    }
  }
  return bestStation;
}

function getStationDistance(
  position: [number, number, number],
  station: WorkerStationData,
): number {
  // Interaction authority is tile-based. Runtime station manifests commonly
  // use integer anchors while moving actors stand at tile centers, so raw
  // world-coordinate distance would incorrectly turn a cardinally adjacent
  // actor into a 1.5-tile miss.
  return Math.max(
    Math.abs(Math.floor(position[0]) - Math.floor(station.position[0])),
    Math.abs(Math.floor(position[2]) - Math.floor(station.position[2])),
  );
}

function isStationInInteractionRange(
  position: [number, number, number],
  station: WorkerStationData,
): boolean {
  return getStationDistance(position, station) <= station.interactionRange;
}

/**
 * Stations occupy their authored tile. Moving at that blocked center can
 * leave pathfinding on a diagonal tile that strict processing authority will
 * reject, so travel targets the nearest cardinal tile center instead.
 */
function getStationApproachTarget(
  position: [number, number, number],
  station: WorkerStationData,
): [number, number, number] {
  const tileX = Math.floor(station.position[0]);
  const tileZ = Math.floor(station.position[2]);
  const candidates: Array<[number, number, number]> = [
    [tileX - 0.5, position[1], tileZ + 0.5],
    [tileX + 1.5, position[1], tileZ + 0.5],
    [tileX + 0.5, position[1], tileZ - 0.5],
    [tileX + 0.5, position[1], tileZ + 1.5],
  ];
  return candidates.sort(
    (left, right) =>
      Math.hypot(position[0] - left[0], position[2] - left[2]) -
        Math.hypot(position[0] - right[0], position[2] - right[2]) ||
      left[0] - right[0] ||
      left[2] - right[2],
  )[0];
}

function countInventoryItems(
  inventory: Array<{ itemId: string; quantity: number }>,
  predicate: (itemId: string) => boolean,
): number {
  return inventory
    .filter((i) => predicate(i.itemId))
    .reduce((sum, i) => sum + i.quantity, 0);
}

function getInventoryQuantity(
  inventory: Array<{ itemId: string; quantity: number }>,
  itemId: string,
): number {
  return inventory
    .filter((item) => item.itemId === itemId)
    .reduce((sum, item) => sum + item.quantity, 0);
}

function getSkillLevel(input: AgentTickInput, skill: string): number {
  const level = Number(input.gameState.skills[skill]?.level ?? 1);
  return Number.isSafeInteger(level) && level >= 1 ? level : 1;
}

function hasOwnedItem(input: AgentTickInput, itemId: string): boolean {
  return (
    getInventoryQuantity(input.inventoryItems, itemId) > 0 ||
    Object.values(input.equippedItems).includes(itemId)
  );
}

function hasAuthoredRecipeInputs(
  input: AgentTickInput,
  recipe: {
    inputs: Array<{ itemId: string; quantity: number }>;
    tools?: string[];
    consumables?: Array<{ itemId: string }>;
  },
): boolean {
  return (
    recipe.inputs.every(
      ({ itemId, quantity }) =>
        getInventoryQuantity(input.inventoryItems, itemId) >= quantity,
    ) &&
    (recipe.tools ?? []).every((itemId) => hasOwnedItem(input, itemId)) &&
    (recipe.consumables ?? []).every(
      ({ itemId }) => getInventoryQuantity(input.inventoryItems, itemId) > 0,
    )
  );
}

function getFletchingRecipesForOutput(
  outputItemId: string,
): WorkerProcessingRecipeSnapshot["fletching"] {
  return [...FLETCHING_RECIPES.values()]
    .filter((recipe) => recipe.outputItemId === outputItemId)
    .sort(
      (a, b) =>
        b.levelRequired - a.levelRequired ||
        a.recipeId.localeCompare(b.recipeId),
    );
}

type QuestDependencyNeed = {
  itemId: string;
  quantity: number;
  role: "material" | "tool" | "consumable";
  reason: string;
  /** Direct gather stages cannot be satisfied by purchasing their target. */
  mustGather?: boolean;
};

type FletchingQuestStep =
  | {
      kind: "action";
      recipe: WorkerProcessingRecipeSnapshot["fletching"][number];
    }
  | { kind: "need"; need: QuestDependencyNeed };

function getEligibleGatheringRequirements(
  input: AgentTickInput,
  itemId: string,
): WorkerProcessingRecipeSnapshot["gathering"] {
  return (GATHERING_BY_OUTPUT.get(itemId) ?? [])
    .filter(
      (requirement) =>
        getSkillLevel(input, requirement.harvestSkill) >=
        requirement.levelRequired,
    )
    .sort(
      (a, b) =>
        a.levelRequired - b.levelRequired ||
        a.resourceId.localeCompare(b.resourceId),
    );
}

function hasCompatibleGatheringTool(
  input: AgentTickInput,
  requirement: WorkerProcessingRecipeSnapshot["gathering"][number],
): boolean {
  if (!requirement.toolRequired) return true;
  if (requirement.harvestSkill === "fishing") {
    return hasOwnedItem(input, requirement.toolRequired);
  }
  return [
    ...input.inventoryItems.map((item) => item.itemId),
    ...Object.values(input.equippedItems),
  ].some(
    (itemId) =>
      typeof itemId === "string" &&
      getItem(itemId)?.tool?.skill === requirement.harvestSkill,
  );
}

/**
 * Resolve one deterministic Fletching step from the selected quest output.
 * The recursion follows authored recipes only and stops at either the deepest
 * executable recipe or one exact missing leaf dependency. It never assigns a
 * value to alternative outputs or inspects private bank/coin state.
 */
function getFletchingQuestStep(
  input: AgentTickInput,
  outputItemId: string,
  requiredOutputQuantity = 1,
  root = true,
  visited = new Set<string>(),
): FletchingQuestStep | null {
  if (visited.has(outputItemId)) return null;
  const nextVisited = new Set(visited);
  nextVisited.add(outputItemId);
  const level = getSkillLevel(input, "fletching");
  const legalRecipes = getFletchingRecipesForOutput(outputItemId).filter(
    (recipe) => recipe.levelRequired <= level,
  );
  const completeRecipe = legalRecipes.find((recipe) =>
    hasAuthoredRecipeInputs(input, recipe),
  );
  if (completeRecipe) return { kind: "action", recipe: completeRecipe };

  const recipe = legalRecipes[0];
  if (!recipe) {
    return root
      ? null
      : {
          kind: "need",
          need: {
            itemId: outputItemId,
            quantity: requiredOutputQuantity,
            role: "material",
            reason: "Acquire an authored Fletching material",
          },
        };
  }

  for (const requiredInput of recipe.inputs) {
    const missingQuantity = Math.max(
      0,
      requiredInput.quantity -
        getInventoryQuantity(input.inventoryItems, requiredInput.itemId),
    );
    if (missingQuantity <= 0) continue;
    const upstream = getFletchingQuestStep(
      input,
      requiredInput.itemId,
      missingQuantity,
      false,
      nextVisited,
    );
    if (upstream) return upstream;
    return {
      kind: "need",
      need: {
        itemId: requiredInput.itemId,
        quantity: missingQuantity,
        role: "material",
        reason: "Acquire an authored Fletching material",
      },
    };
  }

  const missingTool = recipe.tools.find(
    (itemId) => !hasOwnedItem(input, itemId),
  );
  return missingTool
    ? {
        kind: "need",
        need: {
          itemId: missingTool,
          quantity: 1,
          role: "tool",
          reason: "Acquire an authored Fletching tool",
        },
      }
    : null;
}

/** Return the next public-inventory dependency for an active quest stage. */
function getQuestDependencyNeed(
  input: AgentTickInput,
  stageType: string,
  stageTarget: string,
): QuestDependencyNeed | null {
  if (!stageTarget) return null;
  if (stageType === "gather") {
    return {
      itemId: stageTarget,
      quantity: 1,
      role: "material",
      reason: "Acquire the authored quest gathering tool",
      mustGather: true,
    };
  }
  if (stageType !== "interact") return null;

  if (stageTarget === "fire") {
    if (!hasOwnedItem(input, "tinderbox")) {
      return {
        itemId: "tinderbox",
        quantity: 1,
        role: "tool",
        reason: "Acquire the required Firemaking tool",
      };
    }
    const level = getSkillLevel(input, "firemaking");
    const hasLogs = [...FIREMAKING_RECIPES].some(
      ([itemId, recipe]) =>
        recipe.levelRequired <= level &&
        getInventoryQuantity(input.inventoryItems, itemId) > 0,
    );
    if (hasLogs) return null;
    const logItemId = [...FIREMAKING_RECIPES]
      .filter(([, recipe]) => recipe.levelRequired <= level)
      .sort(
        ([itemA, recipeA], [itemB, recipeB]) =>
          recipeA.levelRequired - recipeB.levelRequired ||
          itemA.localeCompare(itemB),
      )[0]?.[0];
    return logItemId
      ? {
          itemId: logItemId,
          quantity: 1,
          role: "material",
          reason: "Acquire authored Firemaking fuel",
        }
      : null;
  }

  const runecrafting = RUNECRAFTING_BY_OUTPUT.get(stageTarget);
  if (
    runecrafting &&
    runecrafting.levelRequired <= getSkillLevel(input, "runecrafting") &&
    !runecrafting.essenceItemIds.some(
      (itemId) => getInventoryQuantity(input.inventoryItems, itemId) > 0,
    )
  ) {
    const itemId = runecrafting.essenceItemIds[0];
    return itemId
      ? {
          itemId,
          quantity: 1,
          role: "material",
          reason: "Acquire authored Runecrafting essence",
        }
      : null;
  }

  const rawItemId = COOKING_INPUT_BY_OUTPUT.get(stageTarget);
  const cookingRecipe = rawItemId ? COOKING_RECIPES.get(rawItemId) : null;
  if (
    rawItemId &&
    cookingRecipe &&
    cookingRecipe.levelRequired <= getSkillLevel(input, "cooking") &&
    getInventoryQuantity(input.inventoryItems, rawItemId) <= 0
  ) {
    return {
      itemId: rawItemId,
      quantity: 1,
      role: "material",
      reason: "Acquire authored Cooking input",
    };
  }

  const smeltingRecipe = SMELTING_RECIPES.get(stageTarget);
  if (
    smeltingRecipe &&
    smeltingRecipe.levelRequired <= getSkillLevel(input, "smithing")
  ) {
    const missingInput = smeltingRecipe.inputs.find(
      ({ itemId, quantity }) =>
        getInventoryQuantity(input.inventoryItems, itemId) < quantity,
    );
    if (missingInput) {
      return {
        itemId: missingInput.itemId,
        quantity:
          missingInput.quantity -
          getInventoryQuantity(input.inventoryItems, missingInput.itemId),
        role: "material",
        reason: "Acquire authored Smelting input",
      };
    }
  }

  const smithingRecipe = SMITHING_RECIPES.get(stageTarget);
  if (
    smithingRecipe &&
    smithingRecipe.levelRequired <= getSkillLevel(input, "smithing")
  ) {
    const missingBars = Math.max(
      0,
      smithingRecipe.barsRequired -
        getInventoryQuantity(input.inventoryItems, smithingRecipe.barItemId),
    );
    if (missingBars > 0) {
      const barRecipe = SMELTING_RECIPES.get(smithingRecipe.barItemId);
      if (
        barRecipe &&
        barRecipe.levelRequired <= getSkillLevel(input, "smithing")
      ) {
        const missingOre = barRecipe.inputs.find(
          ({ itemId, quantity }) =>
            getInventoryQuantity(input.inventoryItems, itemId) < quantity,
        );
        if (missingOre) {
          return {
            itemId: missingOre.itemId,
            quantity:
              missingOre.quantity -
              getInventoryQuantity(input.inventoryItems, missingOre.itemId),
            role: "material",
            reason: "Acquire authored Smithing input",
          };
        }
        return null;
      }
      return {
        itemId: smithingRecipe.barItemId,
        quantity: missingBars,
        role: "material",
        reason: "Acquire authored Smithing bars",
      };
    }
    if (!hasOwnedItem(input, SMITHING_CONSTANTS.HAMMER_ITEM_ID)) {
      return {
        itemId: SMITHING_CONSTANTS.HAMMER_ITEM_ID,
        quantity: 1,
        role: "tool",
        reason: "Acquire the required Smithing tool",
      };
    }
    return null;
  }

  const craftingRecipe = CRAFTING_RECIPES.get(stageTarget);
  if (
    craftingRecipe &&
    craftingRecipe.levelRequired <= getSkillLevel(input, "crafting")
  ) {
    for (const inputItem of craftingRecipe.inputs) {
      const missingQuantity = Math.max(
        0,
        inputItem.quantity -
          getInventoryQuantity(input.inventoryItems, inputItem.itemId),
      );
      if (missingQuantity <= 0) continue;
      const tanning = TANNING_BY_OUTPUT.get(inputItem.itemId);
      if (
        tanning &&
        getInventoryQuantity(input.inventoryItems, tanning.inputItemId) > 0
      ) {
        return null;
      }
      return {
        itemId: inputItem.itemId,
        quantity: missingQuantity,
        role: "material",
        reason: "Acquire authored Crafting material",
      };
    }
    const missingTool = craftingRecipe.tools.find(
      (itemId) => !hasOwnedItem(input, itemId),
    );
    if (missingTool) {
      return {
        itemId: missingTool,
        quantity: 1,
        role: "tool",
        reason: "Acquire authored Crafting tool",
      };
    }
    const missingConsumable = craftingRecipe.consumables.find(
      ({ itemId }) => getInventoryQuantity(input.inventoryItems, itemId) <= 0,
    );
    return missingConsumable
      ? {
          itemId: missingConsumable.itemId,
          quantity: 1,
          role: "consumable",
          reason: "Acquire authored Crafting consumable",
        }
      : null;
  }

  const fletchingStep = getFletchingQuestStep(input, stageTarget);
  return fletchingStep?.kind === "need" ? fletchingStep.need : null;
}

function pickCookableRecipe(
  input: AgentTickInput,
  batchSize = 1,
): { rawItemId: string; cookedItemId: string; levelRequired: number } | null {
  const level = getSkillLevel(input, "cooking");
  return (
    [...COOKING_RECIPES.entries()]
      .filter(
        ([rawItemId, recipe]) =>
          recipe.levelRequired <= level &&
          getInventoryQuantity(input.inventoryItems, rawItemId) >= batchSize,
      )
      .map(([rawItemId, recipe]) => ({ rawItemId, ...recipe }))
      .sort(
        (a, b) =>
          b.levelRequired - a.levelRequired ||
          a.rawItemId.localeCompare(b.rawItemId),
      )[0] ?? null
  );
}

function hasSmeltingInputs(
  input: AgentTickInput,
  recipe: { inputs: Array<{ itemId: string; quantity: number }> },
  batchSize = 1,
): boolean {
  return recipe.inputs.every(
    ({ itemId, quantity }) =>
      getInventoryQuantity(input.inventoryItems, itemId) >=
      quantity * batchSize,
  );
}

function pickSmeltableRecipe(
  input: AgentTickInput,
  batchSize = 1,
): {
  barItemId: string;
  inputs: Array<{ itemId: string; quantity: number }>;
  levelRequired: number;
} | null {
  const level = getSkillLevel(input, "smithing");
  return (
    [...SMELTING_RECIPES.entries()]
      .filter(
        ([, recipe]) =>
          recipe.levelRequired <= level &&
          hasSmeltingInputs(input, recipe, batchSize),
      )
      .map(([barItemId, recipe]) => ({ barItemId, ...recipe }))
      .sort(
        (a, b) =>
          b.levelRequired - a.levelRequired ||
          a.barItemId.localeCompare(b.barItemId),
      )[0] ?? null
  );
}

function pickSmithableRecipe(
  input: AgentTickInput,
  batchSize = 1,
  requireHammer = true,
): {
  outputItemId: string;
  barItemId: string;
  barsRequired: number;
  levelRequired: number;
} | null {
  if (
    requireHammer &&
    !hasOwnedItem(input, SMITHING_CONSTANTS.HAMMER_ITEM_ID)
  ) {
    return null;
  }
  const level = getSkillLevel(input, "smithing");
  return (
    [...SMITHING_RECIPES.entries()]
      .filter(
        ([, recipe]) =>
          recipe.levelRequired <= level &&
          getInventoryQuantity(input.inventoryItems, recipe.barItemId) >=
            recipe.barsRequired * batchSize,
      )
      .map(([outputItemId, recipe]) => ({ outputItemId, ...recipe }))
      .sort(
        (a, b) =>
          b.levelRequired - a.levelRequired ||
          a.outputItemId.localeCompare(b.outputItemId),
      )[0] ?? null
  );
}

function pickCombatOrExplore(
  input: AgentTickInput,
  state: AgentState,
  position: [number, number, number],
  nearbyMobs: NearbyEntityData[],
  nearbyResources: NearbyEntityData[],
  healthPercent: number,
): EmbeddedBehaviorAction {
  const inventory = input.inventoryItems;
  const invCount = inventory.length;

  // Track rotation state
  let rotation = activityRotation.get(input.characterId);
  if (!rotation) {
    rotation = { lastActivity: "", lastActivityAt: 0, sameGoalTicks: 0 };
    activityRotation.set(input.characterId, rotation);
  }

  const currentGoalType = state.goal?.type || "idle";
  if (currentGoalType === rotation.lastActivity) {
    rotation.sameGoalTicks++;
  } else {
    rotation.lastActivity = currentGoalType;
    rotation.sameGoalTicks = 0;
    rotation.lastActivityAt = Date.now();
  }

  const stale = rotation.sameGoalTicks >= MAX_SAME_GOAL_TICKS;

  // --- CHECK INVENTORY CONTENTS ---
  const cookingBatch = pickCookableRecipe(input, 5);
  const smeltingBatch = pickSmeltableRecipe(input, 5);
  const smithingBatch = pickSmithableRecipe(input, 5);
  const inventoryFull = invCount >= 25;

  // === PRIORITY 1: BANK when inventory is nearly full and near a bank ===
  if (inventoryFull) {
    const bank = findNearestStation(input, position, "bank");
    if (bank) {
      if (isStationInInteractionRange(position, bank)) {
        state.goal = {
          type: "banking",
          description: "Depositing items at bank",
        };
        return { type: "bankDepositAll", bankId: bank.entityId };
      }
      state.goal = {
        type: "banking",
        description: "Walking to bank to deposit",
      };
      return {
        type: "move",
        target: getStationApproachTarget(position, bank),
        runMode: true,
      };
    }
  }

  // === PRIORITY 2: COOK raw food if we have 5+ and a range exists ===
  if (
    cookingBatch &&
    !stale &&
    !isOrdinaryProcessingActionSuppressed(
      input.ordinaryProcessingRetrySuppressions,
      { type: "cook", itemId: cookingBatch.rawItemId },
    )
  ) {
    const range = findNearestStation(input, position, "range");
    if (range) {
      if (isStationInInteractionRange(position, range)) {
        state.goal = {
          type: "cooking",
          description: `Cooking ${cookingBatch.rawItemId}`,
        };
        return { type: "cook", itemId: cookingBatch.rawItemId };
      }
      state.goal = { type: "cooking", description: "Walking to cooking range" };
      return {
        type: "move",
        target: getStationApproachTarget(position, range),
        runMode: true,
      };
    }
  }

  // === PRIORITY 3: SMELT ore if we have 5+ and a furnace exists ===
  if (
    smeltingBatch &&
    !stale &&
    !isOrdinaryProcessingActionSuppressed(
      input.ordinaryProcessingRetrySuppressions,
      { type: "smelt", recipe: smeltingBatch.barItemId },
    )
  ) {
    const furnace = findNearestStation(input, position, "furnace");
    if (furnace) {
      if (isStationInInteractionRange(position, furnace)) {
        state.goal = {
          type: "smelting",
          description: `Smelting ${smeltingBatch.barItemId}`,
        };
        return { type: "smelt", recipe: smeltingBatch.barItemId };
      }
      state.goal = { type: "smelting", description: "Walking to furnace" };
      return {
        type: "move",
        target: getStationApproachTarget(position, furnace),
        runMode: true,
      };
    }
  }

  // === PRIORITY 4: SMITH bars if we have 5+ and an anvil exists ===
  if (
    smithingBatch &&
    !stale &&
    !isOrdinaryProcessingActionSuppressed(
      input.ordinaryProcessingRetrySuppressions,
      { type: "smith", recipe: smithingBatch.outputItemId },
    )
  ) {
    const anvil = findNearestStation(input, position, "anvil");
    if (anvil) {
      if (isStationInInteractionRange(position, anvil)) {
        state.goal = {
          type: "smithing",
          description: `Smithing ${smithingBatch.outputItemId}`,
        };
        return { type: "smith", recipe: smithingBatch.outputItemId };
      }
      state.goal = { type: "smithing", description: "Walking to anvil" };
      return {
        type: "move",
        target: getStationApproachTarget(position, anvil),
        runMode: true,
      };
    }
  }

  // === PRIORITY 5: COMBAT (default if mobs nearby and healthy) ===
  if (
    nearbyMobs.length > 0 &&
    healthPercent > 0.5 &&
    (!stale || currentGoalType !== "combat")
  ) {
    const target = findMobForQuest(input, nearbyMobs, "");
    if (target) {
      state.goal = {
        type: "combat",
        description: `Fighting ${target.name || "mobs"}`,
      };
      state.currentTargetId = target.id;
      return { type: "attack", targetId: target.id };
    }
    state.goal = { type: "combat", description: "Fighting nearby mobs" };
    return { type: "attack", targetId: nearbyMobs[0].id };
  }

  // === PRIORITY 6: GATHER nearby resources ===
  if (
    nearbyResources.length > 0 &&
    !inventoryFull &&
    (!stale || currentGoalType !== "gathering")
  ) {
    const resource = nearbyResources[0];
    state.goal = {
      type: "gathering",
      description: `Gathering ${resource.name || "resources"}`,
    };
    return { type: "gather", targetId: resource.id };
  }

  // === PRIORITY 7: EXPLORE — move toward different activity areas ===
  // If stale or nothing nearby, pick a random activity area to explore
  const explorationTargets = [
    ...input.worldResources
      .filter((r) => !r.depleted)
      .map((r) => ({
        pos: r.position,
        name: r.name,
        type: "gathering" as const,
      })),
    ...input.spawnAnchors.map((a) => ({
      pos: a.position,
      name: a.name,
      type: "combat" as const,
    })),
  ];

  if (explorationTargets.length > 0) {
    // Pick a target that's not too close (>30m) to encourage exploration
    const farTargets = explorationTargets.filter((t) => {
      const dx = position[0] - t.pos[0];
      const dz = position[2] - t.pos[2];
      return Math.sqrt(dx * dx + dz * dz) > 30;
    });
    const targets = farTargets.length > 0 ? farTargets : explorationTargets;
    const pick = targets[Math.floor(Math.random() * targets.length)];
    state.goal = {
      type: "exploring",
      description: `Exploring toward ${pick.name}`,
    };
    return {
      type: "move",
      target: [pick.pos[0], position[1], pick.pos[2]],
      runMode: true,
    };
  }

  return moveTowardSpawn(input, position);
}

// ─── WORLD HELPERS ───────────────────────────────────────────────────────

function findOwnGravestone(
  input: AgentTickInput,
): { id: string; position: [number, number, number] } | null {
  const playerId = input.playerId;
  if (!playerId) return null;

  for (const entity of input.gameState.nearbyEntities) {
    if (entity.type !== "object") continue;
    const name = (entity.name || "").toLowerCase();
    const id = entity.id || "";
    if (
      (id.includes("gravestone") && id.includes(playerId)) ||
      (name.includes("gravestone") && name.includes(playerId))
    ) {
      return { id: entity.id, position: entity.position };
    }
  }

  return null;
}

/**
 * Move toward spawn using pre-computed anchor positions from main thread.
 */
function moveTowardSpawn(
  input: AgentTickInput,
  position: [number, number, number],
): EmbeddedBehaviorAction {
  const [px, , pz] = position;
  let anchor: [number, number, number] | null = null;
  let anchorDist = Infinity;

  for (const a of input.spawnAnchors) {
    const dx = a.position[0] - px;
    const dz = a.position[2] - pz;
    const dist = Math.sqrt(dx * dx + dz * dz);
    if (dist < anchorDist) {
      anchorDist = dist;
      anchor = a.position;
    }
  }

  if (anchor && anchorDist > 25) {
    const angle =
      Math.atan2(anchor[2] - pz, anchor[0] - px) + (Math.random() - 0.5) * 0.4;
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
      target: getRandomNearbyTarget([anchor[0], position[1], anchor[2]], 8, 18),
      runMode: false,
    };
  }

  return {
    type: "move",
    target: getRandomNearbyTarget(position, 8, 18),
    runMode: false,
  };
}

function getRandomNearbyTarget(
  origin: [number, number, number],
  minDistance: number,
  maxDistance: number,
): [number, number, number] {
  const angle = Math.random() * Math.PI * 2;
  const distance = minDistance + Math.random() * (maxDistance - minDistance);
  const x = origin[0] + Math.cos(angle) * distance;
  const z = origin[2] + Math.sin(angle) * distance;
  return [x, origin[1], z];
}

// ─── COMBAT CHAT ─────────────────────────────────────────────────────────

function getCombatChatResponse(reaction: PendingChatReaction): string {
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
