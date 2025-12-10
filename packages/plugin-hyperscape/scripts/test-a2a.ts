#!/usr/bin/env bun
/**
 * A2A Protocol E2E Test Script
 * 
 * Tests the full A2A gameplay flow against a running Hyperscape server:
 * 1. Discover agent card
 * 2. Join game world
 * 3. Query world state
 * 4. Execute game actions
 * 5. Full gameplay loop
 * 
 * Usage:
 *   bun run scripts/test-a2a.ts
 *   HYPERSCAPE_A2A_URL=http://myserver:5555 bun run scripts/test-a2a.ts
 */

const A2A_SERVER_URL = process.env.HYPERSCAPE_A2A_URL || "http://localhost:5555";
const AGENT_ID = `test-agent-${Date.now()}`;

interface A2ASkill {
  id: string;
  name: string;
  description: string;
  tags: string[];
}

interface A2AAgentCard {
  protocolVersion: string;
  name: string;
  description: string;
  url: string;
  skills: A2ASkill[];
}

interface A2AResult {
  success: boolean;
  message: string;
  data?: Record<string, unknown>;
}

// ============================================
// A2A Client Functions
// ============================================

async function fetchAgentCard(): Promise<A2AAgentCard> {
  const response = await fetch(`${A2A_SERVER_URL}/.well-known/agent-card.json`);
  if (!response.ok) {
    throw new Error(`Failed to fetch agent card: ${response.status} ${response.statusText}`);
  }
  return response.json() as Promise<A2AAgentCard>;
}

let messageCounter = 0;
async function executeSkill(skillId: string, params: Record<string, unknown> = {}): Promise<A2AResult> {
  const messageId = `${AGENT_ID}-${Date.now()}-${++messageCounter}`;
  
  const response = await fetch(`${A2A_SERVER_URL}/a2a`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      jsonrpc: "2.0",
      method: "message/send",
      params: {
        message: {
          role: "user",
          parts: [{ kind: "data", data: { skillId, agentId: AGENT_ID, ...params } }],
          messageId,
          kind: "message"
        }
      },
      id: messageId
    })
  });

  if (!response.ok) {
    throw new Error(`A2A request failed: ${response.status} ${response.statusText}`);
  }

  const result = await response.json() as {
    result?: { parts?: Array<{ kind: string; text?: string; data?: Record<string, unknown> }> };
    error?: { message: string };
  };

  if (result.error) {
    return { success: false, message: result.error.message };
  }

  const textPart = result.result?.parts?.find(p => p.kind === "text");
  const dataPart = result.result?.parts?.find(p => p.kind === "data");

  return {
    success: true,
    message: textPart?.text ?? "Action completed",
    data: dataPart?.data
  };
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

async function testServerConnection(): Promise<boolean> {
  info(`Testing connection to ${A2A_SERVER_URL}...`);
  
  try {
    const response = await fetch(`${A2A_SERVER_URL}/.well-known/agent-card.json`, {
      signal: AbortSignal.timeout(5000)
    });
    
    if (response.ok) {
      pass("Server is reachable");
      return true;
    } else {
      fail(`Server returned ${response.status}`);
      return false;
    }
  } catch (error) {
    fail(`Cannot connect to server: ${error}`);
    console.log("\n💡 Make sure the Hyperscape server is running:");
    console.log("   cd packages/server && bun run dev\n");
    return false;
  }
}

async function testAgentCardDiscovery(): Promise<A2AAgentCard | null> {
  info("Testing agent card discovery...");
  
  try {
    const card = await fetchAgentCard();
    
    if (card.protocolVersion !== "0.3.0") {
      fail(`Unexpected protocol version: ${card.protocolVersion}`);
      return null;
    }
    
    if (!card.name || !card.skills || card.skills.length === 0) {
      fail("Agent card missing required fields");
      return null;
    }
    
    pass(`Agent card discovered: "${card.name}" with ${card.skills.length} skills`);
    return card;
  } catch (error) {
    fail(`Failed to discover agent card: ${error}`);
    return null;
  }
}

async function testRequiredSkills(card: A2AAgentCard): Promise<boolean> {
  info("Verifying required game skills...");
  
  // All skills the A2A server should support
  const requiredSkills = [
    // Core gameplay
    "join-game",
    "get-status",
    "move-to",
    "move-direction",
    // Combat
    "attack",
    "stop-attack",
    "change-attack-style",
    // Gathering
    "gather-resource",
    // Items
    "use-item",
    "equip-item",
    "unequip-item",
    "pickup-item",
    "drop-item",
    // Banking
    "open-bank",
    "deposit-item",
    "withdraw-item",
    // Shopping
    "buy-item",
    "sell-item",
    // Queries
    "get-inventory",
    "get-skills",
    "get-nearby-entities",
    // World awareness
    "look-around",
    "get-world-context",
    "examine",
    // NPC/Social
    "interact-npc",
    "emote",
    // Combat loot
    "loot-corpse",
    "eat-food",
    // Meta
    "respawn",
    "set-goal"
  ];
  
  const skillIds = new Set(card.skills.map(s => s.id));
  const missingSkills = requiredSkills.filter(s => !skillIds.has(s));
  
  if (missingSkills.length > 0) {
    fail(`Missing skills: ${missingSkills.join(", ")}`);
    info(`Server has ${card.skills.length} skills, we require ${requiredSkills.length}`);
    return false;
  }
  
  pass(`All ${requiredSkills.length} required skills present`);
  
  // Show all available skills
  info(`Server skills (${card.skills.length}):`);
  for (const skill of card.skills.slice(0, 10)) {
    info(`  • ${skill.id}: ${skill.name}`);
  }
  if (card.skills.length > 10) {
    info(`  ... and ${card.skills.length - 10} more`);
  }
  
  return true;
}

async function testJoinGame(): Promise<boolean> {
  info("Testing join-game skill...");
  
  const result = await executeSkill("join-game", { playerName: `TestAgent_${AGENT_ID.slice(-6)}` });
  
  if (!result.success) {
    fail(`Failed to join game: ${result.message}`);
    return false;
  }
  
  pass(`Joined game: ${result.message}`);
  return true;
}

async function testGetStatus(): Promise<boolean> {
  info("Testing get-status skill...");
  
  const result = await executeSkill("get-status");
  
  if (!result.success) {
    fail(`Failed to get status: ${result.message}`);
    return false;
  }
  
  pass(`Status retrieved: ${result.message}`);
  
  if (result.data) {
    const health = result.data.health as { current?: number; max?: number } | undefined;
    const position = result.data.position as { x?: number; z?: number } | undefined;
    
    if (health) {
      info(`  Health: ${health.current}/${health.max}`);
    }
    if (position) {
      info(`  Position: (${position.x?.toFixed(0)}, ${position.z?.toFixed(0)})`);
    }
  }
  
  return true;
}

async function testMovement(): Promise<boolean> {
  info("Testing move-to skill...");
  
  // Move to a random nearby position
  const x = Math.floor(Math.random() * 20) - 10;
  const z = Math.floor(Math.random() * 20) - 10;
  
  const result = await executeSkill("move-to", { x, y: 0, z });
  
  if (!result.success) {
    fail(`Failed to move: ${result.message}`);
    return false;
  }
  
  pass(`Movement initiated: ${result.message}`);
  return true;
}

async function testGetNearbyEntities(): Promise<boolean> {
  info("Testing get-nearby-entities skill...");
  
  const result = await executeSkill("get-nearby-entities", { range: 30 });
  
  if (!result.success) {
    fail(`Failed to get nearby entities: ${result.message}`);
    return false;
  }
  
  pass(`Nearby entities retrieved: ${result.message}`);
  
  if (result.data) {
    const mobs = (result.data.mobs ?? []) as unknown[];
    const resources = (result.data.resources ?? []) as unknown[];
    const items = (result.data.items ?? []) as unknown[];
    
    info(`  Mobs: ${mobs.length}, Resources: ${resources.length}, Items: ${items.length}`);
  }
  
  return true;
}

async function testLookAround(): Promise<boolean> {
  info("Testing look-around skill (world context)...");
  
  const result = await executeSkill("look-around", { range: 30 });
  
  if (!result.success) {
    fail(`Failed to look around: ${result.message}`);
    return false;
  }
  
  pass("World context generated");
  
  // Show first few lines of the description
  const lines = result.message.split("\n").slice(0, 5);
  for (const line of lines) {
    info(`  ${line}`);
  }
  
  return true;
}

async function testGetInventory(): Promise<boolean> {
  info("Testing get-inventory skill...");
  
  const result = await executeSkill("get-inventory");
  
  if (!result.success) {
    fail(`Failed to get inventory: ${result.message}`);
    return false;
  }
  
  pass(`Inventory retrieved: ${result.message}`);
  return true;
}

async function testGetSkills(): Promise<boolean> {
  info("Testing get-skills skill...");
  
  const result = await executeSkill("get-skills");
  
  if (!result.success) {
    fail(`Failed to get skills: ${result.message}`);
    return false;
  }
  
  pass(`Skills retrieved: ${result.message}`);
  
  if (result.data?.combatLevel) {
    info(`  Combat Level: ${result.data.combatLevel}`);
  }
  
  return true;
}

async function testCombatFlow(): Promise<boolean> {
  info("Testing combat flow...");
  
  // Get nearby entities to find a target
  const nearbyResult = await executeSkill("get-nearby-entities", { range: 30 });
  
  if (!nearbyResult.success || !nearbyResult.data) {
    info("  No entities data available, skipping combat test");
    return true;
  }
  
  const mobs = (nearbyResult.data.mobs ?? []) as Array<{ id?: string; name?: string }>;
  
  if (mobs.length === 0) {
    info("  No mobs nearby, skipping combat test");
    return true;
  }
  
  const target = mobs[0];
  info(`  Found target: ${target.name}`);
  
  // Attack
  const attackResult = await executeSkill("attack", { targetId: target.id });
  if (!attackResult.success) {
    fail(`Failed to attack: ${attackResult.message}`);
    return false;
  }
  
  pass(`Attack initiated: ${attackResult.message}`);
  
  // Wait a moment
  await new Promise(resolve => setTimeout(resolve, 1000));
  
  // Stop attack
  const stopResult = await executeSkill("stop-attack");
  if (!stopResult.success) {
    fail(`Failed to stop attack: ${stopResult.message}`);
    return false;
  }
  
  pass("Combat disengaged");
  return true;
}

// ============================================
// Main Test Runner
// ============================================

async function runTests() {
  console.log("\n" + "═".repeat(60));
  console.log("🎮 HYPERSCAPE A2A E2E TEST SUITE");
  console.log("═".repeat(60));
  console.log(`Server: ${A2A_SERVER_URL}`);
  console.log(`Agent ID: ${AGENT_ID}`);
  console.log("═".repeat(60) + "\n");

  let passed = 0;
  let failed = 0;
  let skipped = 0;

  // Test 1: Server Connection
  console.log("\n📡 TEST 1: Server Connection");
  console.log("-".repeat(40));
  const serverOk = await testServerConnection();
  if (!serverOk) {
    console.log("\n❌ TESTS ABORTED: Server not available\n");
    process.exit(1);
  }
  passed++;

  // Test 2: Agent Card Discovery
  console.log("\n📋 TEST 2: Agent Card Discovery");
  console.log("-".repeat(40));
  const agentCard = await testAgentCardDiscovery();
  if (!agentCard) {
    failed++;
  } else {
    passed++;
  }

  // Test 3: Required Skills
  if (agentCard) {
    console.log("\n🎯 TEST 3: Required Skills Verification");
    console.log("-".repeat(40));
    if (await testRequiredSkills(agentCard)) {
      passed++;
    } else {
      failed++;
    }
  } else {
    skipped++;
  }

  // Test 4: Join Game
  console.log("\n🚪 TEST 4: Join Game");
  console.log("-".repeat(40));
  if (await testJoinGame()) {
    passed++;
  } else {
    failed++;
  }

  // Test 5: Get Status
  console.log("\n❤️ TEST 5: Get Player Status");
  console.log("-".repeat(40));
  if (await testGetStatus()) {
    passed++;
  } else {
    failed++;
  }

  // Test 6: Movement
  console.log("\n🏃 TEST 6: Movement");
  console.log("-".repeat(40));
  if (await testMovement()) {
    passed++;
  } else {
    failed++;
  }

  // Test 7: Get Nearby Entities
  console.log("\n👁️ TEST 7: Get Nearby Entities");
  console.log("-".repeat(40));
  if (await testGetNearbyEntities()) {
    passed++;
  } else {
    failed++;
  }

  // Test 8: Look Around (World Context)
  console.log("\n🌍 TEST 8: World Context");
  console.log("-".repeat(40));
  if (await testLookAround()) {
    passed++;
  } else {
    failed++;
  }

  // Test 9: Get Inventory
  console.log("\n🎒 TEST 9: Get Inventory");
  console.log("-".repeat(40));
  if (await testGetInventory()) {
    passed++;
  } else {
    failed++;
  }

  // Test 10: Get Skills
  console.log("\n📊 TEST 10: Get Skills");
  console.log("-".repeat(40));
  if (await testGetSkills()) {
    passed++;
  } else {
    failed++;
  }

  // Test 11: Combat Flow
  console.log("\n⚔️ TEST 11: Combat Flow");
  console.log("-".repeat(40));
  if (await testCombatFlow()) {
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
  console.log(`  ⏭️ Skipped: ${skipped}`);
  console.log("═".repeat(60));

  if (failed === 0) {
    console.log("\n🎉 ALL TESTS PASSED!\n");
    process.exit(0);
  } else {
    console.log("\n❌ SOME TESTS FAILED\n");
    process.exit(1);
  }
}

// Run
runTests().catch(error => {
  console.error("\n💥 FATAL ERROR:", error);
  process.exit(1);
});

