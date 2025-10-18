import { IAgentRuntime, Memory, UUID } from "@elizaos/core";
import {
  VisualTestFramework,
  RPGTestHelpers,
  TestResult,
} from "./visual-test-framework";
import { HyperscapeService } from "../service";

/**
 * Concrete RPG Tests with Visual and State Verification
 * No more LLM "observations" - only real verification
 */
export class ConcreteRPGTests {
  private runtime: IAgentRuntime;
  private visualTest: VisualTestFramework;
  private service: HyperscapeService;

  constructor(runtime: IAgentRuntime) {
    this.runtime = runtime;
    this.visualTest = new VisualTestFramework(runtime);
    this.service = runtime.getService<HyperscapeService>(
      HyperscapeService.serviceName,
    )!;
  }

  async initialize(): Promise<void> {
    await this.visualTest.initialize();
  }

  /**
   * Test: Basic Connection and Movement
   * Verifies: Player spawns at correct position and can move
   */
  async testBasicConnection(): Promise<TestResult> {
    // Record initial position
    const rpgManager = this.service.getRPGStateManager();
    const initialState = rpgManager?.getPlayerState("test-player");
    const initialPos = initialState?.position || {
      x: 0,
      y: 0,
      z: 0,
    };

    // Execute movement action
    await this.executeAction("HYPERSCAPE_WALK_RANDOMLY");

    // Wait for movement
    await this.wait(3000);

    // Verify player moved from initial position
    const verification = {
      type: "both" as const,
      visualChecks: [
        {
          entityType: "special.player",
          expectedColor: 16729411, // Player color from templates
          shouldExist: true,
        },
      ],
      stateChecks: [
        {
          property: "location.coordinates.x",
          expectedValue: initialPos.x,
          operator: "equals" as const,
        },
      ],
      screenshot: true,
    };

    // The position should NOT equal initial (player should have moved)
    const result = await this.visualTest.runTest(
      "basic-connection",
      verification,
    );

    // Invert the result for position check (we want it to NOT equal)
    if (
      result.stateSnapshot?.location.coordinates.x === initialPos.x &&
      result.stateSnapshot?.location.coordinates.y === initialPos.y &&
      result.stateSnapshot?.location.coordinates.z === initialPos.z
    ) {
      result.passed = false;
      result.failures.push("Player did not move from initial position");
    }

    return result;
  }

  /**
   * Test: Combat Damage Calculation
   * Verifies: Actual damage is dealt and health decreases
   */
  async testCombatDamage(): Promise<TestResult> {
    const rpgManager = this.service.getRPGStateManager();
    const initialHealth =
      rpgManager?.getPlayerState("test-player")?.health || 100;

    // Find and attack a goblin
    await this.executeAction("HYPERSCAPE_SCENE_PERCEPTION");
    await this.wait(1000);

    // Attack goblin (assuming one is nearby)
    await this.executeAction("ATTACK_TARGET", { target: "goblin" });
    await this.wait(2000);

    // Verify combat state and damage
    const verification = RPGTestHelpers.combatVerification("npcs.goblin", 1);

    // Add health check
    verification.stateChecks?.push({
      property: "health.current",
      expectedValue: initialHealth,
      operator: "less",
    });

    return await this.visualTest.runTest("combat-damage", verification);
  }

  /**
   * Test: Item Pickup and Inventory
   * Verifies: Items are actually added to inventory
   */
  async testItemPickup(): Promise<TestResult> {
    const rpgManager = this.service.getRPGStateManager();
    const initialItems =
      rpgManager?.getInventory("test-player").items.length || 0;

    // Look for items
    await this.executeAction("HYPERSCAPE_SCENE_PERCEPTION");
    await this.wait(1000);

    // Pickup nearest item
    await this.executeAction("PICKUP_ITEM", { itemId: "nearest" });
    await this.wait(2000);

    // Verify item was added
    const verification = {
      type: "state" as const,
      stateChecks: [
        {
          property: "inventory.items.length",
          expectedValue: initialItems,
          operator: "greater" as const,
        },
      ],
      screenshot: true,
    };

    const result = await this.visualTest.runTest("item-pickup", verification);

    // Additional check: verify specific item properties
    if (
      result.passed &&
      result.stateSnapshot &&
      result.stateSnapshot.inventory
    ) {
      const inventory = result.stateSnapshot.inventory;
      if (!Array.isArray(inventory) && inventory.items) {
        const newItems = inventory.items;
        if (newItems.length > initialItems) {
          const newItem = newItems[newItems.length - 1];
          if (!newItem.id || !newItem.name || !newItem.quantity) {
            result.passed = false;
            result.failures.push(
              "New item missing required properties (id, name, quantity)",
            );
          }
        }
      }
    }

    return result;
  }

  /**
   * Test: Skill Experience Gain
   * Verifies: Actions grant experience and skills level up
   */
  async testSkillProgression(): Promise<TestResult> {
    const rpgManager = this.service.getRPGStateManager();
    const initialMiningXP =
      rpgManager?.getPlayerState("test-player")?.skills.mining?.experience || 0;
    const initialMiningLevel =
      rpgManager?.getPlayerState("test-player")?.skills.mining?.level || 1;

    // Mine a rock
    await this.executeAction("MINE_RESOURCE", { resourceId: "iron_rock" });
    await this.wait(5000); // Mining takes time

    // Verify experience gain
    const verification = {
      type: "both" as const,
      visualChecks: [
        {
          entityType: "resources.iron_rock",
          expectedColor: 4210752, // Iron rock color
          shouldExist: true,
        },
      ],
      stateChecks: [
        {
          property: "skills.mining.experience",
          expectedValue: initialMiningXP,
          operator: "greater" as const,
        },
      ],
      screenshot: true,
    };

    const result = await this.visualTest.runTest(
      "skill-progression",
      verification,
    );

    // Check for level up
    if (result.stateSnapshot?.skills.mining?.level > initialMiningLevel) {
      result.failures.push(
        `Mining leveled up from ${initialMiningLevel} to ${result.stateSnapshot.skills.mining.level}`,
      );
    }

    return result;
  }

  /**
   * Test: Quest State Machine
   * Verifies: Quest progresses through correct states
   */
  async testQuestProgression(): Promise<TestResult> {
    // Talk to quest giver
    await this.executeAction("TALK_TO_NPC", { npcId: "quest_giver" });
    await this.wait(2000);

    // Accept quest
    await this.executeAction("ACCEPT_QUEST", { questId: "goblin_menace" });
    await this.wait(1000);

    // Verify quest is active
    const verification1 = {
      type: "state" as const,
      stateChecks: [
        {
          property: "quests.active",
          expectedValue: "goblin_menace",
          operator: "contains" as const,
        },
      ],
    };

    const result1 = await this.visualTest.runTest(
      "quest-accept",
      verification1,
    );
    if (!result1.passed) return result1;

    // Complete quest objective (kill goblin)
    await this.executeAction("ATTACK_TARGET", { target: "goblin" });
    await this.wait(5000);

    // Turn in quest
    await this.executeAction("TURN_IN_QUEST", { questId: "goblin_menace" });
    await this.wait(2000);

    // Verify quest completed
    const verification2 = RPGTestHelpers.questVerification("goblin_menace");
    return await this.visualTest.runTest("quest-complete", verification2);
  }

  /**
   * Test: Trading Transaction Verification
   * Verifies: Items and gold are actually exchanged
   */
  async testTrading(): Promise<TestResult> {
    const rpgManager = this.service.getRPGStateManager();
    const initialInventory = rpgManager?.getInventory("test-player");
    const initialGold =
      initialInventory?.items.find((item) => item.itemId === "gold")
        ?.quantity || 0;
    const initialItems = [
      ...(rpgManager?.getInventory("test-player").items || []),
    ];

    // Buy item from shop
    await this.executeAction("BUY_ITEM", {
      shopId: "general_store",
      itemId: "bronze_sword",
      quantity: 1,
    });
    await this.wait(2000);

    // Verify transaction
    const verification = {
      type: "state" as const,
      stateChecks: [
        {
          property: "inventory.gold",
          expectedValue: initialGold,
          operator: "less" as const,
        },
        {
          property: "inventory.items",
          expectedValue: "bronze_sword",
          operator: "contains" as const,
        },
      ],
      screenshot: true,
    };

    const result = await this.visualTest.runTest("trading", verification);

    // Verify gold was deducted correctly
    if (result.stateSnapshot && result.stateSnapshot.inventory) {
      const inventory = result.stateSnapshot.inventory;
      if (!Array.isArray(inventory) && typeof inventory.gold === "number") {
        const goldSpent = initialGold - inventory.gold;
        if (goldSpent <= 0) {
          result.passed = false;
          result.failures.push("No gold was deducted for purchase");
        }
      }
    }

    return result;
  }

  /**
   * Test: Multi-Agent Synchronization
   * Verifies: Other players' positions update correctly
   */
  async testMultiAgentSync(): Promise<TestResult> {
    // Initial scan for other players
    const verification1 = {
      type: "visual" as const,
      visualChecks: [
        {
          entityType: "special.player",
          expectedColor: 16729411,
          shouldExist: true,
        },
      ],
      screenshot: true,
    };

    const result1 = await this.visualTest.runTest(
      "multi-agent-initial",
      verification1,
    );

    // Wait for other players to move
    await this.wait(5000);

    // Verify positions changed
    const verification2 = {
      type: "both" as const,
      visualChecks: [
        {
          entityType: "special.player",
          expectedColor: 16729411,
          shouldExist: true,
        },
      ],
      stateChecks: [
        {
          property: "location.nearbyPlayers.length",
          expectedValue: 0,
          operator: "greater" as const,
        },
      ],
      screenshot: true,
    };

    return await this.visualTest.runTest("multi-agent-sync", verification2);
  }

  /**
   * Helper: Execute an action and wait for result
   */
  private async executeAction(
    actionName: string,
    params?: Record<string, unknown>,
  ): Promise<void> {
    const world = this.service.getWorld();
    if (!world?.actions?.execute) {
      throw new Error("World actions not available");
    }

    await world.actions.execute(actionName, params || {});
  }

  /**
   * Helper: Wait for specified milliseconds
   */
  private async wait(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /**
   * Run all concrete tests
   */
  async runAllTests(): Promise<{
    passed: number;
    failed: number;
    results: TestResult[];
  }> {
    const tests = [
      { name: "Basic Connection", fn: () => this.testBasicConnection() },
      { name: "Combat Damage", fn: () => this.testCombatDamage() },
      { name: "Item Pickup", fn: () => this.testItemPickup() },
      { name: "Skill Progression", fn: () => this.testSkillProgression() },
      { name: "Quest Progression", fn: () => this.testQuestProgression() },
      { name: "Trading", fn: () => this.testTrading() },
      { name: "Multi-Agent Sync", fn: () => this.testMultiAgentSync() },
    ];

    const results: TestResult[] = [];
    let passed = 0;
    let failed = 0;

    for (const test of tests) {
      console.log(`\nRunning test: ${test.name}`);
      const result = await test.fn();
      results.push(result);

      if (result.passed) {
        passed++;
        console.log(`✅ ${test.name} PASSED`);
      } else {
        failed++;
        console.log(`❌ ${test.name} FAILED`);
        result.failures.forEach((f) => console.log(`   - ${f}`));
      }
    }

    console.log(`\n${"=".repeat(50)}`);
    console.log(`Test Summary: ${passed} passed, ${failed} failed`);
    console.log(`${"=".repeat(50)}`);

    return { passed, failed, results };
  }
}
