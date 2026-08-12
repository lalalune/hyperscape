import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const agentManagerSource = readFileSync(
  fileURLToPath(new URL("../AgentManager.ts", import.meta.url)),
  "utf8",
);
const behaviorBridgeSource = readFileSync(
  fileURLToPath(new URL("../managers/AgentBehaviorBridge.ts", import.meta.url)),
  "utf8",
);
const behaviorEngineSource = readFileSync(
  fileURLToPath(new URL("../worker/AgentBehaviorEngine.ts", import.meta.url)),
  "utf8",
);
const ordinaryShoppingSource = behaviorEngineSource.slice(
  behaviorEngineSource.indexOf("function manageShopping("),
  behaviorEngineSource.indexOf("function isNearbyObject("),
);
const questDependencySource = behaviorEngineSource.slice(
  behaviorEngineSource.indexOf("function getEligibleGatheringRequirements("),
  behaviorEngineSource.indexOf("function pickCookableRecipe("),
);
const workerTypesSource = readFileSync(
  fileURLToPath(new URL("../worker/workerTypes.ts", import.meta.url)),
  "utf8",
);
const behaviorTickerSource = readFileSync(
  fileURLToPath(new URL("../managers/AgentBehaviorTicker.ts", import.meta.url)),
  "utf8",
);
const ordinaryBankingSource = readFileSync(
  fileURLToPath(new URL("../ordinaryAgentBanking.ts", import.meta.url)),
  "utf8",
);
const ordinaryQuestProgressionSource = readFileSync(
  fileURLToPath(
    new URL("../ordinaryAgentQuestProgression.ts", import.meta.url),
  ),
  "utf8",
);
const embeddedServiceSource = readFileSync(
  fileURLToPath(new URL("../EmbeddedHyperiaService.ts", import.meta.url)),
  "utf8",
);
const storeHandlerSource = readFileSync(
  fileURLToPath(
    new URL("../../systems/ServerNetwork/handlers/store.ts", import.meta.url),
  ),
  "utf8",
);
const ordinaryPrayerSource = readFileSync(
  fileURLToPath(new URL("../ordinaryAgentPrayerTraining.ts", import.meta.url)),
  "utf8",
);
const ordinaryStoreSource = readFileSync(
  fileURLToPath(new URL("../ordinaryAgentStore.ts", import.meta.url)),
  "utf8",
);
const authoritativeBankingSource = readFileSync(
  fileURLToPath(new URL("../AuthoritativeAgentBanking.ts", import.meta.url)),
  "utf8",
);
const modelDecisionSource = readFileSync(
  fileURLToPath(new URL("../llmBehaviorDecision.ts", import.meta.url)),
  "utf8",
);

describe("embedded autonomy source policy", () => {
  it("keeps one authoritative worker-bridge scheduler", () => {
    expect(
      agentManagerSource.match(
        /this\.behaviorBridge\.startAgent\(characterId\);/g,
      ),
    ).toHaveLength(2);
    expect(agentManagerSource).not.toMatch(
      /startEmbeddedAgentLlmPlanningLoop|stopEmbeddedAgentLlmPlanningLoop|EMBEDDED_AGENT_LLM_PLANNING/,
    );
  });

  it("prefetches model decisions off the action path and fences stale output", () => {
    expect(behaviorBridgeSource).toContain(
      "pickBehaviorActionWithLlm(instance, freshState)",
    );
    expect(behaviorBridgeSource).toContain(
      "const llmResult = instance.pendingLlmResult ?? null",
    );
    expect(behaviorBridgeSource).toContain(
      "instance.behaviorEpoch === behaviorEpoch",
    );
    expect(behaviorBridgeSource).toContain(
      "result.behaviorEpoch !== instance.behaviorEpoch",
    );
  });

  it("forbids hidden worker mutations before the one typed action", () => {
    expect(workerTypesSource).not.toMatch(/AgentSideEffect|sideEffects/);
    expect(behaviorEngineSource).not.toMatch(/AgentSideEffect|sideEffects/);
    expect(behaviorBridgeSource).not.toMatch(/result\.sideEffects/);
    expect(behaviorEngineSource).toContain(
      "Every tick may emit exactly one typed action",
    );
    expect(behaviorTickerSource).toContain("const maintenanceAction =");
    expect(behaviorTickerSource).not.toMatch(
      /manageInventory|instance\.service\.executeDrop/,
    );
  });

  it("keeps ordinary banking exact, surplus-only, and causally retryable", () => {
    expect(behaviorTickerSource).toContain(
      '{ type: "bankDepositAll"; bankId: string }',
    );
    expect(behaviorTickerSource).toContain(
      '{ type: "bankWithdraw"; bankId: string }',
    );
    expect(behaviorEngineSource).toContain(
      '{ type: "bankDepositAll", bankId: bank.entityId }',
    );
    expect(behaviorEngineSource).toContain(
      '{ type: "bankWithdraw", bankId: bank.entityId }',
    );
    expect(modelDecisionSource).toContain("model text never does");
    expect(ordinaryBankingSource).toContain(
      "getOrdinaryBankOperationId(attempt.attemptId)",
    );
    expect(ordinaryBankingSource).toContain(
      "getOrdinaryBankStageOperationId(attempt.attemptId)",
    );
    expect(ordinaryBankingSource).toContain(
      "model never sees or supplies bank item identities or counts",
    );
    expect(ordinaryBankingSource).toContain(
      'lastReceipt.commitState !== "unknown"',
    );
    expect(authoritativeBankingSource).toContain(
      "Only a new custody mutation reaches this branch",
    );
    expect(authoritativeBankingSource).not.toContain(
      'DELETE FROM inventory WHERE "playerId" = $1',
    );
  });

  it("keeps ordinary processing choices on the loaded recipe manifests", () => {
    expect(behaviorBridgeSource).toContain(
      "ProcessingDataProvider.getInstance()",
    );
    expect(behaviorBridgeSource).toContain(
      "smelting.inputs?.map((input) => ({ ...input }))",
    );
    expect(behaviorEngineSource).toContain("COOKING_RECIPES");
    expect(behaviorEngineSource).toContain("SMELTING_RECIPES");
    expect(behaviorEngineSource).toContain("SMITHING_RECIPES");
    expect(behaviorEngineSource).toContain("FIREMAKING_RECIPES");
    expect(behaviorEngineSource).toContain("CRAFTING_RECIPES");
    expect(behaviorEngineSource).toContain("FLETCHING_RECIPES");
    expect(behaviorEngineSource).toContain("RUNECRAFTING_RECIPES");
    expect(behaviorEngineSource).not.toMatch(
      /COOKABLE_ITEMS|SMELTABLE_ORES|CRAFTABLE_ITEMS|FLETCHABLE_ITEMS|bronze_dagger|airAltar|logTypes/,
    );
  });

  it("keeps private processing custody state out of the worker protocol", () => {
    expect(ordinaryBankingSource).toContain("getPrivateCoinBalance");
    for (const workerFacingSource of [
      behaviorBridgeSource,
      behaviorEngineSource,
      workerTypesSource,
    ]) {
      expect(workerFacingSource).not.toMatch(
        /coinBalance|processingConsumableUses/,
      );
    }
  });

  it("derives ordinary basic and gathering provisioning from loaded catalogs", () => {
    expect(ordinaryShoppingSource).toContain(
      "getEligibleGatheringRequirements",
    );
    expect(questDependencySource).toContain("GATHERING_BY_OUTPUT");
    expect(questDependencySource).toContain("getFletchingQuestStep");
    expect(ordinaryShoppingSource).toContain("findCheapestLoadedCatalogItem");
    expect(ordinaryShoppingSource).not.toMatch(
      /bronze_shortsword|bronze_hatchet|bronze_pickaxe|small_fishing_net|sword_store|general_store|fishing_store/,
    );
  });

  it("keeps skill-only quest entry training shared, manifest-derived, and bank-private", () => {
    expect(ordinaryQuestProgressionSource).toContain(
      "findOrdinaryQuestEntrySkillTarget",
    );
    expect(ordinaryQuestProgressionSource).toContain(
      "quest.requirements.quests.length > 0",
    );
    expect(ordinaryQuestProgressionSource).toContain(
      "quest.requirements.items.length > 0",
    );
    expect(behaviorEngineSource).toContain("findOrdinaryQuestEntrySkillTarget");
    expect(behaviorTickerSource).toContain("findOrdinaryQuestEntrySkillTarget");
    expect(ordinaryBankingSource).toContain(
      "findOrdinaryQuestEntrySkillTarget",
    );
    expect(ordinaryBankingSource).toContain("requestedTrainingQuestId");
    expect(behaviorBridgeSource).toContain('action.type === "bankWithdraw"');
    expect(behaviorBridgeSource).toContain('instance.goal?.type === "banking"');
    expect(ordinaryBankingSource).toContain(
      'result.reason === "nothing_to_stage"',
    );
    expect(behaviorEngineSource).toContain("GUARANTEED_MOB_TYPES_BY_DROP");
    expect(behaviorEngineSource).toContain(
      "guaranteedMobTypes.has(entity.mobType)",
    );
    expect(workerTypesSource).toContain("questEntryAcquisitionQuestId");
    expect(workerTypesSource).toContain("coinRecoveryAuthorized");
    expect(behaviorEngineSource).toContain(
      'GUARANTEED_MOB_TYPES_BY_DROP.get("coins")',
    );
    expect(behaviorEngineSource).toContain("entity.mobType");
    expect(behaviorBridgeSource).toContain(
      "hasOrdinaryCoinRecoveryAuthorization",
    );
    expect(behaviorBridgeSource).not.toContain("coinBalance:");
    expect(workerTypesSource).not.toMatch(/bankItems|bankQuantities/);
  });

  it("routes embedded store sales through exact secure session authority", () => {
    expect(embeddedServiceSource).toContain("handleStoreSell");
    expect(embeddedServiceSource).toContain("executeSecureStoreTransaction");
    expect(embeddedServiceSource).not.toContain(
      "this.world.emit(EventType.STORE_SELL",
    );
    expect(storeHandlerSource).toContain(
      "storeSession?.targetStoreId !== data.storeId",
    );
    expect(storeHandlerSource).toContain(
      'sendErrorToast(socket, "You can\'t sell items during a duel.")',
    );
  });

  it("binds autonomous purchases to immutable attempts and restart receipts", () => {
    expect(behaviorBridgeSource).toContain("executeOrdinaryStoreBuy(");
    expect(behaviorTickerSource).toContain("executeOrdinaryStoreBuy(");
    expect(ordinaryStoreSource).toContain(
      "getOrdinaryStoreBuyOperationId(attempt.attemptId)",
    );
    expect(ordinaryStoreSource).toContain("resolveOrdinaryStoreRecovery");
    expect(storeHandlerSource).toContain("agentStoreOperations");
    expect(embeddedServiceSource).toContain('status: "unknown"');
  });

  it("keeps prayer-resource training typed, attempt-bound, and receipt-recoverable", () => {
    expect(behaviorTickerSource).toContain('{ type: "bury"; itemId: string }');
    expect(behaviorEngineSource).toContain(
      'return candidates[0]\n    ? { type: "bury"',
    );
    expect(ordinaryPrayerSource).toContain(
      "attempt?.attemptId ?? randomUUID()",
    );
    expect(ordinaryPrayerSource).toContain("resolveOrdinaryBoneBurialRecovery");
    expect(ordinaryPrayerSource).toContain(
      "lastReceipt?.ok && lastReceipt.liveStateApplied",
    );
  });
});
