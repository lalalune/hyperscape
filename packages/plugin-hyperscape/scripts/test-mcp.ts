#!/usr/bin/env bun
/**
 * MCP Protocol E2E Test Script
 * 
 * Tests the MCP integration for Hyperscape:
 * 1. Initialize MCP server with game service
 * 2. List available tools
 * 3. List available resources
 * 4. Execute tools for game actions
 * 5. Read game state resources
 * 
 * Usage:
 *   bun run scripts/test-mcp.ts
 */

import { HyperscapeMCPServer } from "../src/mcp/server.js";
import type { HyperscapeService } from "../src/services/HyperscapeService.js";

// ============================================
// Mock Service for MCP Testing
// ============================================

function createMockService(): HyperscapeService {
  const mockPlayer = {
    id: "test-player-123",
    name: "TestAgent",
    position: [100, 0, 200] as [number, number, number],
    health: { current: 85, max: 100 },
    alive: true,
    skills: {
      attack: { level: 10, xp: 1500 },
      strength: { level: 8, xp: 1100 },
      defence: { level: 7, xp: 900 },
      hitpoints: { level: 12, xp: 2000 },
      woodcutting: { level: 15, xp: 3500 },
      fishing: { level: 5, xp: 400 },
      mining: { level: 20, xp: 6000 }
    },
    items: [
      { id: "bronze_sword", name: "Bronze Sword", quantity: 1, slot: 0 },
      { id: "cooked_fish", name: "Cooked Fish", quantity: 5, slot: 1 },
      { id: "oak_logs", name: "Oak Logs", quantity: 12, slot: 2 }
    ],
    coins: 1500,
    combatLevel: 15,
    equipment: {
      weapon: { id: "bronze_sword", name: "Bronze Sword" },
      head: null,
      body: { id: "leather_body", name: "Leather Body" },
      legs: { id: "leather_legs", name: "Leather Legs" }
    }
  };

  const mockEntities = [
    { id: "goblin-1", name: "Goblin", type: "mob", mobType: "goblin", position: [110, 0, 205] as [number, number, number], health: { current: 15, max: 15 }, level: 2 },
    { id: "goblin-2", name: "Goblin", type: "mob", mobType: "goblin", position: [95, 0, 190] as [number, number, number], health: { current: 8, max: 15 }, level: 2 },
    { id: "oak-tree-1", name: "Oak Tree", type: "resource", resourceType: "tree", position: [120, 0, 180] as [number, number, number] },
    { id: "fishing-spot-1", name: "Fishing Spot", type: "resource", resourceType: "fish", position: [80, 0, 220] as [number, number, number] },
    { id: "item-gold-1", name: "Gold Coins", type: "item", position: [105, 0, 195] as [number, number, number], quantity: 25 }
  ];

  const service = {
    isConnected: () => true,
    getPlayerEntity: () => mockPlayer,
    getNearbyEntities: () => mockEntities,
    getBehaviorManager: () => null,
    getGameState: () => ({
      connected: true,
      worldTime: Date.now(),
      playerCount: 15
    }),
    
    // Action execution methods
    executeMove: async (cmd: { target: [number, number, number]; runMode?: boolean }) => {
      const [x, _y, z] = cmd.target;
      console.log(`  [Mock] Moving to (${x}, ${z})`);
      mockPlayer.position = cmd.target;
    },
    executeAttack: async (cmd: { targetEntityId: string }) => {
      console.log(`  [Mock] Attacking ${cmd.targetEntityId}`);
    },
    executeGatherResource: async (cmd: { resourceEntityId: string; skill: string }) => {
      console.log(`  [Mock] Gathering ${cmd.skill} resource ${cmd.resourceEntityId}`);
    },
    executeUseItem: async (cmd: { itemId: string }) => {
      console.log(`  [Mock] Using item ${cmd.itemId}`);
    },
    executeEquipItem: async (cmd: { itemId: string; equipSlot: string }) => {
      console.log(`  [Mock] Equipping ${cmd.itemId} to ${cmd.equipSlot}`);
    },
    executeChatMessage: async (cmd: { message: string }) => {
      console.log(`  [Mock] Chat: "${cmd.message}"`);
    },
    executeDropItem: async (cmd: { itemId: string }) => {
      console.log(`  [Mock] Dropping item ${cmd.itemId}`);
    },
    executePickupItem: async (cmd: { entityId: string }) => {
      console.log(`  [Mock] Picking up ${cmd.entityId}`);
    },
    executeEmote: async (cmd: { emote: string }) => {
      console.log(`  [Mock] Emoting: ${cmd.emote}`);
    },
    executeInteractNpc: async (cmd: { npcId: string }) => {
      console.log(`  [Mock] Interacting with NPC ${cmd.npcId}`);
    },
    executeLootCorpse: async (cmd: { corpseId: string }) => {
      console.log(`  [Mock] Looting corpse ${cmd.corpseId}`);
    },
    executeRespawn: async () => {
      console.log(`  [Mock] Respawning`);
    },
    executeChangeAttackStyle: async (cmd: { style: string }) => {
      console.log(`  [Mock] Changing attack style to ${cmd.style}`);
    },
    executeBankAction: async (cmd: { action: string; itemId?: string; amount?: number }) => {
      console.log(`  [Mock] Bank ${cmd.action}: ${cmd.itemId} x${cmd.amount}`);
    }
  };

  return service as unknown as HyperscapeService;
}

// ============================================
// Test Functions
// ============================================

function log(emoji: string, message: string) {
  console.log(`${emoji} ${message}`);
}

function pass(message: string) {
  log("✅", message);
}

function fail(message: string) {
  log("❌", message);
}

function info(message: string) {
  log("ℹ️ ", message);
}

function testToolListing(mcpServer: HyperscapeMCPServer): boolean {
  info("Listing available MCP tools...");
  
  const tools = mcpServer.listTools();
  
  if (tools.length === 0) {
    fail("No tools available");
    return false;
  }
  
  pass(`${tools.length} MCP tools available`);
  
  // Check required tools - comprehensive list
  const requiredTools = [
    // Movement
    "hyperscape_move_to",
    "hyperscape_move_direction",
    // Combat
    "hyperscape_attack",
    "hyperscape_stop_combat",
    "hyperscape_change_attack_style",
    // Gathering
    "hyperscape_gather",
    "hyperscape_chop_tree",
    "hyperscape_fish",
    // Items
    "hyperscape_use_item",
    "hyperscape_equip_item",
    "hyperscape_drop_item",
    "hyperscape_pickup_item",
    "hyperscape_loot_corpse",
    // Banking
    "hyperscape_open_bank",
    "hyperscape_deposit",
    "hyperscape_withdraw",
    // Social
    "hyperscape_chat",
    "hyperscape_emote",
    "hyperscape_interact_npc",
    // Queries
    "hyperscape_get_status",
    "hyperscape_get_inventory",
    "hyperscape_get_nearby",
    "hyperscape_get_skills",
    "hyperscape_get_equipment",
    // World
    "hyperscape_look_around",
    "hyperscape_examine",
    "hyperscape_respawn",
    "hyperscape_set_goal"
  ];
  
  const toolNames = tools.map(t => t.name);
  const missingTools = requiredTools.filter(t => !toolNames.includes(t));
  
  if (missingTools.length > 0) {
    fail(`Missing required tools: ${missingTools.join(", ")}`);
    return false;
  }
  
  pass(`All ${requiredTools.length} required tools present`);
  
  // Display tool names
  for (const tool of tools.slice(0, 10)) {
    info(`  - ${tool.name}: ${tool.description.slice(0, 50)}...`);
  }
  if (tools.length > 10) {
    info(`  ... and ${tools.length - 10} more`);
  }
  
  return true;
}

function testResourceListing(mcpServer: HyperscapeMCPServer): boolean {
  info("Listing available MCP resources...");
  
  const resources = mcpServer.listResources();
  
  if (resources.length === 0) {
    fail("No resources available");
    return false;
  }
  
  pass(`${resources.length} MCP resources available`);
  
  // Check required resources
  const requiredUris = ["/status", "/inventory", "/skills", "/nearby", "/equipment"];
  
  const resourceUris = resources.map(r => r.uri);
  const missingResources = requiredUris.filter(uri => !resourceUris.some(r => r.includes(uri)));
  
  if (missingResources.length > 0) {
    fail(`Missing required resources: ${missingResources.join(", ")}`);
    return false;
  }
  
  pass(`All ${requiredUris.length} required resources present`);
  
  // Display resources
  for (const resource of resources) {
    info(`  - ${resource.uri}: ${resource.name}`);
  }
  
  return true;
}

function testPromptListing(mcpServer: HyperscapeMCPServer): boolean {
  info("Listing available MCP prompts...");
  
  const prompts = mcpServer.listPrompts();
  
  if (prompts.length === 0) {
    info("No prompts defined (optional)");
    return true;
  }
  
  pass(`${prompts.length} MCP prompts available`);
  
  for (const prompt of prompts) {
    info(`  - ${prompt.name}: ${prompt.description}`);
  }
  
  return true;
}

async function testToolExecution(mcpServer: HyperscapeMCPServer): Promise<boolean> {
  info("Testing tool execution...");
  
  // Test get_status tool
  info("  Testing hyperscape_get_status...");
  const statusResult = await mcpServer.callTool("hyperscape_get_status", {});
  
  if (!statusResult.content || statusResult.content.length === 0) {
    fail("No content returned from get_status");
    return false;
  }
  
  pass("hyperscape_get_status executed");
  const statusContent = statusResult.content[0];
  if (statusContent.type === "text") {
    info(`    ${statusContent.text?.slice(0, 100)}...`);
  }
  
  // Test get_nearby tool
  info("  Testing hyperscape_get_nearby...");
  const nearbyResult = await mcpServer.callTool("hyperscape_get_nearby", { range: 30 });
  
  if (!nearbyResult.content || nearbyResult.content.length === 0) {
    fail("No content returned from get_nearby");
    return false;
  }
  
  pass("hyperscape_get_nearby executed");
  
  // Test move_to tool
  info("  Testing hyperscape_move_to...");
  const moveResult = await mcpServer.callTool("hyperscape_move_to", { x: 50, y: 0, z: 50 });
  
  if (!moveResult.content || moveResult.content.length === 0) {
    fail("No content returned from move_to");
    return false;
  }
  
  pass("hyperscape_move_to executed");
  
  // Test look_around tool
  info("  Testing hyperscape_look_around...");
  const lookResult = await mcpServer.callTool("hyperscape_look_around", {});
  
  if (!lookResult.content || lookResult.content.length === 0) {
    fail("No content returned from look_around");
    return false;
  }
  
  pass("hyperscape_look_around executed");
  const lookContent = lookResult.content[0];
  if (lookContent.type === "text") {
    const lines = lookContent.text?.split("\n").slice(0, 5) ?? [];
    for (const line of lines) {
      info(`    ${line}`);
    }
  }
  
  // Test more tools for comprehensive coverage
  info("  Testing hyperscape_get_skills...");
  const skillsResult = await mcpServer.callTool("hyperscape_get_skills", {});
  if (!skillsResult.content || skillsResult.content.length === 0) {
    fail("No content returned from get_skills");
    return false;
  }
  pass("hyperscape_get_skills executed");
  
  info("  Testing hyperscape_get_equipment...");
  const equipResult = await mcpServer.callTool("hyperscape_get_equipment", {});
  if (!equipResult.content || equipResult.content.length === 0) {
    fail("No content returned from get_equipment");
    return false;
  }
  pass("hyperscape_get_equipment executed");
  
  info("  Testing hyperscape_get_inventory...");
  const invResult = await mcpServer.callTool("hyperscape_get_inventory", {});
  if (!invResult.content || invResult.content.length === 0) {
    fail("No content returned from get_inventory");
    return false;
  }
  pass("hyperscape_get_inventory executed");
  
  info("  Testing hyperscape_move_direction...");
  const dirResult = await mcpServer.callTool("hyperscape_move_direction", { direction: "north", distance: 5 });
  if (!dirResult.content || dirResult.content.length === 0) {
    fail("No content returned from move_direction");
    return false;
  }
  pass("hyperscape_move_direction executed");
  
  info("  Testing hyperscape_set_goal...");
  const goalResult = await mcpServer.callTool("hyperscape_set_goal", { goalType: "exploration" });
  if (!goalResult.content || goalResult.content.length === 0) {
    fail("No content returned from set_goal");
    return false;
  }
  pass("hyperscape_set_goal executed");
  
  info("  Testing hyperscape_emote...");
  const emoteResult = await mcpServer.callTool("hyperscape_emote", { emote: "wave" });
  if (!emoteResult.content || emoteResult.content.length === 0) {
    fail("No content returned from emote");
    return false;
  }
  pass("hyperscape_emote executed")
  
  return true;
}

async function testResourceReading(mcpServer: HyperscapeMCPServer): Promise<boolean> {
  info("Testing resource reading...");
  
  const resources = mcpServer.listResources();
  
  for (const resource of resources.slice(0, 5)) {
    try {
      info(`  Reading ${resource.uri}...`);
      const result = await mcpServer.readResource(resource.uri);
      
      if (!result.contents || result.contents.length === 0) {
        fail(`No content returned for ${resource.uri}`);
        return false;
      }
      
      const content = result.contents[0];
      if (content.text) {
        const preview = content.text.slice(0, 80).replace(/\n/g, " ");
        info(`    ${preview}...`);
      }
      
      pass(`Read ${resource.uri}`);
    } catch (error) {
      fail(`Failed to read ${resource.uri}: ${error}`);
      return false;
    }
  }
  
  return true;
}

// ============================================
// Main Test Runner
// ============================================

async function runTests() {
  console.log("\n" + "═".repeat(60));
  console.log("🔌 HYPERSCAPE MCP E2E TEST SUITE");
  console.log("═".repeat(60));
  console.log("Testing MCP server with mock game service");
  console.log("═".repeat(60) + "\n");

  let passed = 0;
  let failed = 0;

  // Create mock service and MCP server
  const mockService = createMockService();
  const mcpServer = new HyperscapeMCPServer(mockService, "test-session");

  // Test 1: Tool Listing
  console.log("\n🛠️ TEST 1: Tool Listing");
  console.log("-".repeat(40));
  if (testToolListing(mcpServer)) {
    passed++;
  } else {
    failed++;
  }

  // Test 2: Resource Listing
  console.log("\n📦 TEST 2: Resource Listing");
  console.log("-".repeat(40));
  if (testResourceListing(mcpServer)) {
    passed++;
  } else {
    failed++;
  }

  // Test 3: Prompt Listing
  console.log("\n💬 TEST 3: Prompt Listing");
  console.log("-".repeat(40));
  if (testPromptListing(mcpServer)) {
    passed++;
  } else {
    failed++;
  }

  // Test 4: Tool Execution
  console.log("\n⚡ TEST 4: Tool Execution");
  console.log("-".repeat(40));
  if (await testToolExecution(mcpServer)) {
    passed++;
  } else {
    failed++;
  }

  // Test 5: Resource Reading
  console.log("\n📖 TEST 5: Resource Reading");
  console.log("-".repeat(40));
  if (await testResourceReading(mcpServer)) {
    passed++;
  } else {
    failed++;
  }

  // Summary
  console.log("\n" + "═".repeat(60));
  console.log("📊 TEST RESULTS");
  console.log("═".repeat(60));
  console.log(`  ✅ Passed:  ${passed}`);
  console.log(`  ❌ Failed:  ${failed}`);
  console.log("═".repeat(60));

  if (failed === 0) {
    console.log("\n🎉 ALL MCP TESTS PASSED!\n");
    process.exit(0);
  } else {
    console.log("\n❌ SOME MCP TESTS FAILED\n");
    process.exit(1);
  }
}

// Run
runTests().catch(error => {
  console.error("\n💥 FATAL ERROR:", error);
  process.exit(1);
});

