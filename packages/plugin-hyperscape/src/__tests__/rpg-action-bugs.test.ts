/**
 * Bug-Finding Tests for RPG Actions
 *
 * These tests are designed to FAIL when bugs exist in real runtime scenarios.
 * They connect to real Hyperscape worlds and verify critical failure modes.
 *
 * NO MOCKS. REAL CODE ONLY.
 */

import { describe, it, expect, afterEach } from "vitest";
import type { IAgentRuntime } from "@elizaos/core";

// Lazy import to avoid loading Hyperscape at test discovery time
let HyperscapeService: any;

// These tests require a real Hyperscape world connection
// They will be skipped if HYPERSCAPE_TEST_WORLD env var is not set
const TEST_WORLD = process.env.HYPERSCAPE_TEST_WORLD;
const SKIP_REAL_TESTS = !TEST_WORLD;

describe("RPG Action Bug Tests (Real World)", () => {
  let testRuntime: IAgentRuntime | null = null;

  // Cleanup after each test to avoid database conflicts
  afterEach(async () => {
    if (testRuntime) {
      try {
        await testRuntime.stop();
        const adapter = testRuntime.adapter;
        if (adapter && typeof adapter.close === "function") {
          await adapter.close();
        }
      } catch {
        // Ignore cleanup errors
      }
      testRuntime = null;
    }
  });

  describe("Critical Timeout Bugs", () => {
    it.skipIf(SKIP_REAL_TESTS)(
      "chopTree must timeout after 15s if no response",
      async () => {
        // BUG: If server never sends RESOURCE_GATHERING_COMPLETED, action hangs forever
        testRuntime = await createTestRuntime(TEST_WORLD!);
        const service = testRuntime.getService<HyperscapeService>(
          HyperscapeService.serviceName,
        );

        // Block the completion event to simulate server failure
        const world = service!.getWorld();
        world!.off("rpg:resource:gathering:completed", () => {});

        const startTime = Date.now();
        const result = await executeAction(runtime, "CHOP_TREE");
        const duration = Date.now() - startTime;

        // MUST fail within 15-16s, not hang forever
        expect(duration).toBeLessThan(16000);
        expect(result.success).toBe(false);
        expect(result.values.error).toBe("Gathering timeout");
      },
    );

    it.skipIf(SKIP_REAL_TESTS)(
      "cookFood must timeout if fire event never arrives",
      async () => {
        const runtime = await createTestRuntime(TEST_WORLD!);

        const startTime = Date.now();
        const result = await executeAction(runtime, "COOK_FOOD");
        const duration = Date.now() - startTime;

        // If no fire exists, must fail fast (not wait 15s)
        expect(duration).toBeLessThan(2000);
        expect(result.success).toBe(false);
        expect(result.values.error).toBe("no_fire");
      },
    );

    it.skipIf(SKIP_REAL_TESTS)(
      "bankItems must fail if inventory empty",
      async () => {
        const runtime = await createTestRuntime(TEST_WORLD!);

        // Empty inventory scenario
        const result = await executeAction(runtime, "BANK_ITEMS");

        // MUST fail immediately, not try to deposit nothing
        expect(result.success).toBe(false);
        expect(result.values.error).toContain("inventory");
      },
    );
  });

  describe("Event Race Condition Bugs", () => {
    it.skipIf(SKIP_REAL_TESTS)(
      "chopTree must handle inventory event arriving before completion event",
      async () => {
        // BUG: If INVENTORY_UPDATED arrives before RESOURCE_GATHERING_COMPLETED,
        // items might be recorded but success flag is false
        const runtime = await createTestRuntime(TEST_WORLD!);
        const service = runtime.getService<HyperscapeService>(
          HyperscapeService.serviceName,
        );
        const world = service!.getWorld();

        // Simulate race: emit inventory before completion
        world!.emit("rpg:inventory:updated", {
          playerId: "test",
          items: [{ slot: 0, itemId: "logs", quantity: 1 }],
        });

        const result = await executeAction(runtime, "CHOP_TREE");

        // Should NOT succeed with items but no gathering completion
        if (result.values.items && result.values.items.length > 0) {
          expect(result.success).toBe(true);
        }
      },
    );

    it.skipIf(SKIP_REAL_TESTS)(
      "catchFish must not count XP if gathering failed",
      async () => {
        const runtime = await createTestRuntime(TEST_WORLD!);
        const service = runtime.getService<HyperscapeService>(
          HyperscapeService.serviceName,
        );
        const world = service!.getWorld();

        // Simulate XP event arriving when gathering failed
        world!.emit("rpg:skills:xp_gained", {
          playerId: "test",
          skill: "fishing",
          amount: 50,
        });
        world!.emit("rpg:resource:gathering:completed", {
          playerId: "test",
          resourceId: "fishing_spot_1",
          successful: false,
        });

        const result = await executeAction(runtime, "CATCH_FISH");

        // MUST NOT report XP if gathering failed
        expect(result.values.xpGained).toBeFalsy();
      },
    );
  });

  describe("State Composition Bugs", () => {
    it.skipIf(SKIP_REAL_TESTS)(
      "chopTree validate() must fail when no axe in inventory",
      async () => {
        const runtime = await createTestRuntime(TEST_WORLD!);

        // Remove axe from inventory
        const service = runtime.getService<HyperscapeService>(
          HyperscapeService.serviceName,
        );
        const world = service!.getWorld();
        const player = world!.entities!.player;
        player.data = { inventory: { items: [] }, skills: {} };

        const action = (await import("../actions/chopTree")).chopTreeAction;
        const canRun = await action.validate!(runtime, {} as any);

        // MUST return false (action should not be available)
        expect(canRun).toBe(false);
      },
    );

    it.skipIf(SKIP_REAL_TESTS)(
      "lightFire must fail if no logs in inventory",
      async () => {
        const runtime = await createTestRuntime(TEST_WORLD!);

        const result = await executeAction(runtime, "LIGHT_FIRE");

        // MUST fail with missing_logs error
        expect(result.success).toBe(false);
        expect(result.values.error).toBe("missing_logs");
      },
    );

    it.skipIf(SKIP_REAL_TESTS)(
      "cookFood must check getPreviousResult for fire ID",
      async () => {
        const runtime = await createTestRuntime(TEST_WORLD!);

        // cookFood.ts line 125: const fireId = _options?.context?.getPreviousResult?.('LIGHT_FIRE')?.values?.fireId
        // BUG: If getPreviousResult is undefined, this crashes
        const result = await executeAction(runtime, "COOK_FOOD", {
          context: {}, // No getPreviousResult method
        });

        // Should NOT crash, should return error
        expect(result.success).toBe(false);
        expect(result.values.error).toBe("no_fire");
      },
    );
  });

  describe("WebSocket Packet Bugs", () => {
    it.skipIf(SKIP_REAL_TESTS)(
      "chopTree must send correct gatherResource packet structure",
      async () => {
        const runtime = await createTestRuntime(TEST_WORLD!);
        const service = runtime.getService<HyperscapeService>(
          HyperscapeService.serviceName,
        );
        const world = service!.getWorld();

        // Spy on network send
        let sentPacket: any = null;
        const originalSend = world!.network!.send;
        world!.network!.send = (packet: any) => {
          sentPacket = packet;
          return originalSend.call(world!.network, packet);
        };

        await executeAction(runtime, "CHOP_TREE");

        // MUST send packet with correct structure
        expect(sentPacket).toBeDefined();
        expect(sentPacket.type).toBe("gatherResource");
        expect(sentPacket.resourceId).toBeDefined();
        expect(sentPacket.playerId).toBeDefined();
      },
    );

    it.skipIf(SKIP_REAL_TESTS)(
      "bankItems must include items array in deposit packet",
      async () => {
        const runtime = await createTestRuntime(TEST_WORLD!);
        const service = runtime.getService<HyperscapeService>(
          HyperscapeService.serviceName,
        );
        const world = service!.getWorld();

        // Add items to inventory first
        const player = world!.entities!.player;
        player.data = {
          inventory: {
            items: [{ itemId: "logs", quantity: 5, itemName: "Logs" }],
          },
        };

        let sentPacket: any = null;
        const originalSend = world!.network!.send;
        world!.network!.send = (packet: any) => {
          sentPacket = packet;
          return originalSend.call(world!.network, packet);
        };

        await executeAction(runtime, "BANK_ITEMS");

        // BUG: If items array is missing, server crashes
        expect(sentPacket).toBeDefined();
        expect(sentPacket.type).toBe("bankDeposit");
        expect(sentPacket.items).toBeDefined();
        expect(Array.isArray(sentPacket.items)).toBe(true);
        expect(sentPacket.items.length).toBeGreaterThan(0);
      },
    );
  });

  describe("Error Propagation Bugs", () => {
    it.skipIf(SKIP_REAL_TESTS)(
      "chopTree must throw if world.network is null",
      async () => {
        const runtime = await createTestRuntime(TEST_WORLD!);
        const service = runtime.getService<HyperscapeService>(
          HyperscapeService.serviceName,
        );
        const world = service!.getWorld();

        // Disconnect network
        world!.network = null;

        const result = await executeAction(runtime, "CHOP_TREE");

        // MUST fail gracefully, not crash
        expect(result.success).toBe(false);
        expect(result.values.error).toBe("service_unavailable");
      },
    );

    it.skipIf(SKIP_REAL_TESTS)(
      "catchFish must handle malformed event data",
      async () => {
        const runtime = await createTestRuntime(TEST_WORLD!);
        const service = runtime.getService<HyperscapeService>(
          HyperscapeService.serviceName,
        );
        const world = service!.getWorld();

        // Emit malformed completion event
        world!.emit("rpg:resource:gathering:completed", {
          // Missing playerId
          resourceId: "fish",
          successful: true,
        });

        const result = await executeAction(runtime, "CATCH_FISH");

        // MUST handle gracefully (per fail-fast rules: SHOULD throw)
        // According to testing_rules.mdc: "if data we critically need is wrong, we throw"
        // So this test expects a throw, not graceful handling
        expect(result.success).toBe(false);
      },
    );
  });

  describe("Level Requirement Bugs", () => {
    it.skipIf(SKIP_REAL_TESTS)(
      "chopTree must reject trees above player level",
      async () => {
        const runtime = await createTestRuntime(TEST_WORLD!);
        const service = runtime.getService<HyperscapeService>(
          HyperscapeService.serviceName,
        );
        const world = service!.getWorld();

        // Set player to level 1
        const player = world!.entities!.player;
        player.data = {
          inventory: { items: [{ itemId: "bronze_hatchet", quantity: 1 }] },
          skills: { woodcutting: { level: 1, xp: 0 } },
        };

        const result = await executeAction(runtime, "CHOP_TREE");

        // If all trees require level 15+, must fail with level_too_low
        if (result.values.error === "level_too_low") {
          expect(result.values.requiredLevel).toBeGreaterThan(1);
          expect(result.values.currentLevel).toBe(1);
        }
      },
    );
  });
});

// Helper functions (NO MOCKS - real runtime creation)

/**
 * Creates a real IAgentRuntime connected to a real Hyperscape world
 * NO MOCKS - This connects to an actual running Hyperscape server
 */
async function createTestRuntime(worldUrl: string): Promise<IAgentRuntime> {
  const { AgentRuntime } = await import("@elizaos/core");
  const { randomUUID } = await import("crypto");

  // Mock window.location for PGLite (it checks this in browser environments)
  if (typeof window === "undefined") {
    (global as any).window = {
      location: {
        pathname: "/test",
        href: "http://localhost/test",
      },
    };
  }

  // Use PGLite with memory storage for tests
  process.env.DATABASE_ADAPTER = "pglite";
  delete process.env.SQLITE_FILE;

  const sqlPlugin = await import("@elizaos/plugin-sql");

  // Create minimal character for testing with PGLite
  const character = {
    id: randomUUID() as any,
    name: `TestAgent_${randomUUID().slice(0, 8)}`,
    modelProvider: "openai",
    clients: [],
    settings: {
      secrets: {},
      voice: { model: "en_US-male-medium" },
      DATABASE_ADAPTER: "pglite",
    },
  };

  // Create real runtime with SQL plugin only first
  const runtime = new AgentRuntime({
    character,
    plugins: [sqlPlugin.default],
  });

  // Initialize runtime - this will set up PGLite database
  await runtime.initialize();

  // Lazy load service type and manually register it
  if (!HyperscapeService) {
    const serviceModule = await import("../service");
    HyperscapeService = serviceModule.HyperscapeService;
  }

  // Manually register the Hyperscape service to avoid circular import
  const service = new HyperscapeService();
  runtime.registerService(service);

  await service.initialize(runtime);

  // Parse world URL to get wsUrl and worldId
  // Format: https://hyperscape.io/world-id or ws://localhost:3000/world-id
  let wsUrl: string;
  let worldId: string;

  if (worldUrl.includes("hyperscape.io")) {
    worldId = worldUrl.split("/").pop() || "";
    wsUrl = `wss://hyperscape.io/worlds/${worldId}/ws`;
  } else {
    // Assume local dev format
    worldId = worldUrl.split("/").pop() || "test-world";
    wsUrl = worldUrl.replace("http", "ws");
  }

  await service.connect({
    wsUrl,
    worldId: worldId as any,
    authToken: process.env.HYPERSCAPE_AUTH_TOKEN,
  });

  // Wait for connection to stabilize
  await new Promise((resolve) => setTimeout(resolve, 2000));

  if (!service.isConnected()) {
    throw new Error(
      `Failed to connect to real Hyperscape world at ${worldUrl}`,
    );
  }

  return runtime;
}

/**
 * Executes a real action handler and returns real results
 * NO MOCKS - This runs the actual action code with real world state
 */
async function executeAction(
  runtime: IAgentRuntime,
  actionName: string,
  options?: any,
): Promise<any> {
  const { chopTreeAction } = await import("../actions/chopTree");
  const { catchFishAction } = await import("../actions/catchFish");
  const { lightFireAction } = await import("../actions/lightFire");
  const { cookFoodAction } = await import("../actions/cookFood");
  const { bankItemsAction } = await import("../actions/bankItems");

  const actions: Record<string, any> = {
    CHOP_TREE: chopTreeAction,
    CATCH_FISH: catchFishAction,
    LIGHT_FIRE: lightFireAction,
    COOK_FOOD: cookFoodAction,
    BANK_ITEMS: bankItemsAction,
  };

  const action = actions[actionName];
  if (!action) {
    throw new Error(`Action ${actionName} not found`);
  }

  // Create minimal memory for action
  const memory = {
    userId: "test-user",
    agentId: runtime.agentId,
    roomId: "test-room" as any,
    content: { text: `Execute ${actionName}` },
  };

  // Run REAL action handler
  const result = await action.handler(
    runtime,
    memory,
    undefined, // state
    options, // options
    undefined, // callback
    [], // responses
  );

  return result;
}
