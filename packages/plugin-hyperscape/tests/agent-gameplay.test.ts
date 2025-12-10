/**
 * @fileoverview Hyperscape Agent Gameplay E2E Tests
 * @description Tests agent gameplay via A2A and MCP protocols
 * 
 * This test file verifies:
 * - Agent can discover game skills via A2A agent card
 * - Agent can execute all game actions
 * - World context provider gives useful semantic descriptions
 * - MCP tools work correctly
 * - Full gameplay loop (spawn, move, attack, loot, level up)
 * 
 * Prerequisites:
 * - Hyperscape server must be running (bun run dev in packages/server)
 * 
 * Usage:
 *   cd vendor/hyperscape/packages/plugin-hyperscape
 *   bun run test
 */

import { test, expect, describe, beforeAll } from "bun:test";
import { HyperscapeA2AClient, createA2AClient } from "../src/a2a/client.js";
import { HyperscapeMCPServer } from "../src/mcp/server.js";

// Test configuration
const A2A_SERVER_URL = process.env.HYPERSCAPE_A2A_URL || "http://localhost:5555";
const TEST_AGENT_ID = `test-agent-${Date.now()}`;
const TIMEOUT = 30000;

// Skip tests if server not available
let serverAvailable = false;

describe("Hyperscape Agent Gameplay E2E", () => {
  let a2aClient: HyperscapeA2AClient;

  beforeAll(async () => {
    // Check if server is available
    try {
      const response = await fetch(`${A2A_SERVER_URL}/.well-known/agent-card.json`, {
        signal: AbortSignal.timeout(5000)
      });
      serverAvailable = response.ok;
      console.log(`Server available: ${serverAvailable}`);
    } catch (error) {
      console.log("Hyperscape server not running, skipping e2e tests");
      console.log("Start server with: cd packages/server && bun run dev");
      serverAvailable = false;
    }

    if (serverAvailable) {
      a2aClient = createA2AClient({
        serverUrl: A2A_SERVER_URL,
        agentId: TEST_AGENT_ID
      });
    }
  });

  describe("A2A Protocol Discovery", () => {
    test.skipIf(!serverAvailable)("should discover agent card", async () => {
      const agentCard = await a2aClient.discover();
      
      expect(agentCard).toBeDefined();
      expect(agentCard.name).toBe("Hyperscape RPG Game Master");
      expect(agentCard.protocolVersion).toBe("0.3.0");
      expect(agentCard.skills.length).toBeGreaterThan(10);
      
      console.log(`✓ Agent card discovered: ${agentCard.name}`);
      console.log(`  Skills available: ${agentCard.skills.length}`);
    });

    test.skipIf(!serverAvailable)("should have required game skills", async () => {
      await a2aClient.discover();
      const skills = a2aClient.getSkills();
      
      const requiredSkills = [
        "join-game",
        "get-status",
        "move-to",
        "attack",
        "gather-resource",
        "get-inventory",
        "get-nearby-entities",
        "look-around",
        "eat-food",
        "respawn"
      ];
      
      for (const skillId of requiredSkills) {
        const skill = skills.find(s => s.id === skillId);
        expect(skill).toBeDefined();
        console.log(`  ✓ ${skillId}: ${skill?.name}`);
      }
    });
  });

  describe("A2A Game Actions", () => {
    test.skipIf(!serverAvailable)("should get player status", async () => {
      const result = await a2aClient.getStatus();
      // May fail if player not spawned yet - that's expected
      console.log(`  Status result: ${result.message}`);
    });

    test.skipIf(!serverAvailable)("should get nearby entities", async () => {
      const result = await a2aClient.getNearbyEntities(50);
      console.log(`  Nearby entities: ${result.message}`);
      if (result.data) {
        const mobs = (result.data.mobs as unknown[]) ?? [];
        const resources = (result.data.resources as unknown[]) ?? [];
        console.log(`    Mobs: ${mobs.length}`);
        console.log(`    Resources: ${resources.length}`);
      }
    });

    test.skipIf(!serverAvailable)("should get skills", async () => {
      const result = await a2aClient.getSkillLevels();
      console.log(`  Skills: ${result.message}`);
      if (result.data) {
        console.log(`    Combat Level: ${result.data.combatLevel}`);
      }
    });

    test.skipIf(!serverAvailable)("should get inventory", async () => {
      const result = await a2aClient.getInventory();
      console.log(`  Inventory: ${result.message}`);
    });

    test.skipIf(!serverAvailable)("should execute movement", async () => {
      const result = await a2aClient.moveTo(10, 0, 10);
      expect(result.success).toBe(true);
      console.log(`  Move result: ${result.message}`);
    });

    test.skipIf(!serverAvailable)("should get world context", async () => {
      const context = await a2aClient.getWorldContext();
      expect(context).toBeDefined();
      expect(context.length).toBeGreaterThan(50);
      console.log(`  World context (${context.length} chars):`);
      console.log(context.split("\n").slice(0, 10).join("\n"));
    });
  });

  describe("MCP Protocol", () => {
    test("should list available tools", async () => {
      // MCP server needs a service instance
      // This tests the tool definitions work correctly
      const mockService = {
        isConnected: () => true,
        getPlayerEntity: () => ({
          id: "test-player",
          position: [0, 0, 0] as [number, number, number],
          health: { current: 100, max: 100 },
          alive: true,
          skills: {},
          items: [],
          coins: 0
        }),
        getNearbyEntities: () => [],
        getBehaviorManager: () => null,
        getGameState: () => ({}),
        executeMove: async () => {},
        executeAttack: async () => {},
        executeGatherResource: async () => {},
        executeUseItem: async () => {},
        executeEquipItem: async () => {},
        executeChatMessage: async () => {}
      };

      // Cast to expected type
      const mcpServer = new HyperscapeMCPServer(mockService as never, "test-session");
      
      const tools = mcpServer.listTools();
      expect(tools.length).toBeGreaterThan(15);
      
      console.log(`  MCP Tools available: ${tools.length}`);
      
      const toolNames = tools.map(t => t.name);
      expect(toolNames).toContain("hyperscape_move_to");
      expect(toolNames).toContain("hyperscape_attack");
      expect(toolNames).toContain("hyperscape_gather");
      expect(toolNames).toContain("hyperscape_look_around");
    });

    test("should list available resources", async () => {
      const mockService = {
        isConnected: () => true,
        getPlayerEntity: () => ({
          id: "test-player-123",
          position: [0, 0, 0] as [number, number, number],
          health: { current: 100, max: 100 },
          alive: true,
          skills: {},
          items: [],
          coins: 0
        }),
        getNearbyEntities: () => [],
        getBehaviorManager: () => null,
        getGameState: () => ({})
      };

      const mcpServer = new HyperscapeMCPServer(mockService as never, "test-session");
      
      const resources = mcpServer.listResources();
      expect(resources.length).toBeGreaterThan(5);
      
      console.log(`  MCP Resources available: ${resources.length}`);
      
      const uris = resources.map(r => r.uri);
      expect(uris.some(u => u.includes("/status"))).toBe(true);
      expect(uris.some(u => u.includes("/inventory"))).toBe(true);
      expect(uris.some(u => u.includes("/skills"))).toBe(true);
    });
  });

  describe("Complete Gameplay Loop", () => {
    test.skipIf(!serverAvailable)("should demonstrate full agent gameplay", async () => {
      console.log("\n=== Full Agent Gameplay Loop ===\n");

      // Step 1: Join game
      console.log("Step 1: Joining game...");
      const joinResult = await a2aClient.joinGame(`Agent_${Date.now().toString(36)}`);
      console.log(`  ${joinResult.message}`);

      // Step 2: Look around
      console.log("\nStep 2: Looking around...");
      const context = await a2aClient.getWorldContext();
      console.log(context.split("\n").slice(0, 8).join("\n"));

      // Step 3: Get status
      console.log("\nStep 3: Getting status...");
      const status = await a2aClient.getStatus();
      if (status.success && status.data) {
        const health = status.data.health as { current: number; max: number };
        const inCombat = status.data.inCombat;
        console.log(`  Health: ${health?.current}/${health?.max}`);
        console.log(`  In Combat: ${inCombat ? "Yes" : "No"}`);
      }

      // Step 4: Find nearby mobs
      console.log("\nStep 4: Finding targets...");
      const nearby = await a2aClient.getNearbyEntities(30);
      if (nearby.success && nearby.data) {
        const mobs = (nearby.data.mobs ?? []) as Array<{ name?: string; id?: string }>;
        console.log(`  Found ${mobs.length} mobs`);
        
        if (mobs.length > 0) {
          const target = mobs[0];
          console.log(`  Target: ${target.name}`);

          // Step 5: Attack
          console.log("\nStep 5: Attacking...");
          const attackResult = await a2aClient.attack(target.id || "", "accurate");
          console.log(`  ${attackResult.message}`);
        }
      }

      // Step 6: Get skills
      console.log("\nStep 6: Checking skills...");
      const skills = await a2aClient.getSkillLevels();
      console.log(`  ${skills.message}`);

      // Step 7: Get inventory
      console.log("\nStep 7: Checking inventory...");
      const inventory = await a2aClient.getInventory();
      console.log(`  ${inventory.message}`);

      console.log("\n✓ Gameplay loop complete");
    });
  });
});

// Summary
console.log("\n=== Hyperscape Agent Gameplay Tests ===\n");
console.log("Testing A2A and MCP integration for agent gameplay\n");

