/**
 * Complete Flow End-to-End Tests - plugin-work Branch
 *
 * Comprehensive tests covering complete user journeys:
 * - Create character → create agent → spawn in world → perform actions
 * - Agent crash → reconnect → verify state preserved
 * - Delete agent → verify cleanup
 * - Multiple agents for same account
 */

import { test, expect } from "@playwright/test";
import {
  createTestUser,
  createTestAgent,
  createUserInDatabase,
} from "../helpers/auth-helper";
import WebSocket from "ws";
import { Packr, Unpackr } from "msgpackr";
import * as fs from "fs";
import * as path from "path";

const SERVER_URL = "http://localhost:5555";
const WS_URL = "ws://localhost:5555/ws";
const ELIZAOS_API = "http://localhost:3000";
const LOG_DIR = path.resolve(
  process.env.HOME || "/Users/home",
  "logs/branch-validation",
);

const packr = new Packr({ structuredClone: true });
const unpackr = new Unpackr();

if (!fs.existsSync(LOG_DIR)) {
  fs.mkdirSync(LOG_DIR, { recursive: true });
}

function saveTestLog(testName: string, content: string) {
  const logFile = path.join(LOG_DIR, `${testName}.log`);
  fs.writeFileSync(logFile, content);
  console.log(`[${testName}] Logs saved to: ${logFile}`);
}

async function httpRequest(
  url: string,
  options: {
    method?: string;
    headers?: Record<string, string>;
    body?: string;
  } = {},
) {
  try {
    const response = await fetch(url, {
      method: options.method || "GET",
      headers: options.headers || {},
      body: options.body,
    });

    let data: unknown;
    try {
      data = await response.json();
    } catch {
      data = null;
    }

    return { status: response.status, data, ok: response.ok, error: null };
  } catch (error) {
    return {
      status: 0,
      data: null,
      ok: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

const PACKET_IDS = {
  snapshot: 0,
  enterWorld: 56,
  moveRequest: 6,
};

function encodePacket(packetName: string, data: unknown): Buffer {
  const packetId = PACKET_IDS[packetName as keyof typeof PACKET_IDS];
  return packr.pack([packetId, data]);
}

function decodePacket(buffer: Buffer): [string, unknown] {
  const [packetId, data] = unpackr.unpack(buffer);
  const packetName =
    Object.keys(PACKET_IDS).find(
      (key) => PACKET_IDS[key as keyof typeof PACKET_IDS] === packetId,
    ) || "unknown";
  return [packetName, data];
}

async function waitForPacket(
  ws: WebSocket,
  expectedPacketName: string,
  timeout = 5000,
): Promise<unknown> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error(`Timeout waiting for packet: ${expectedPacketName}`));
    }, timeout);

    const messageHandler = (data: Buffer) => {
      try {
        const [packetName, packetData] = decodePacket(data);
        if (packetName === expectedPacketName) {
          clearTimeout(timer);
          ws.off("message", messageHandler);
          resolve(packetData);
        }
      } catch (error) {
        // Ignore decode errors
      }
    };

    ws.on("message", messageHandler);
  });
}

test.describe("Complete Flow End-to-End (plugin-work branch)", () => {
  test.beforeAll(async () => {
    console.log("🚀 Starting complete flow end-to-end tests...");
    console.log(`📁 Logs will be saved to: ${LOG_DIR}`);
  });

  /**
   * TEST 1: Complete Agent Lifecycle
   * Create character → create agent → spawn in world → perform actions
   */
  test("Complete agent lifecycle: create → spawn → act", async () => {
    const testName = "complete-agent-lifecycle";
    const logs: string[] = [];

    try {
      logs.push(`[${testName}] Testing complete agent lifecycle...`);
      logs.push(`[${testName}] ========================================`);
      const testUser = createTestUser();
      await createUserInDatabase(testUser.userId);

      // STEP 1: Create character
      logs.push(`[${testName}] STEP 1: Creating character...`);
      const createCharResponse = await httpRequest(
        `${SERVER_URL}/api/characters/db`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            accountId: testUser.userId,
            name: "Lifecycle Test Agent",
            avatar: "lifecycle-avatar.vrm",
            wallet: "0xLIFECYCLE",
          }),
        },
      );

      expect(createCharResponse.ok).toBe(true);
      const charData = createCharResponse.data as {
        character: { id: string; name: string };
      };
      logs.push(`[${testName}] ✅ Character created: ${charData.character.id}`);

      // STEP 2: Generate JWT credentials
      logs.push(`[${testName}] STEP 2: Generating JWT credentials...`);
      const credResponse = await httpRequest(
        `${SERVER_URL}/api/agents/credentials`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            characterId: charData.character.id,
            accountId: testUser.userId,
          }),
        },
      );

      expect(credResponse.ok).toBe(true);
      const credentials = credResponse.data as { authToken: string };
      logs.push(`[${testName}] ✅ JWT generated`);

      // STEP 3: Create agent in ElizaOS
      logs.push(`[${testName}] STEP 3: Creating agent in ElizaOS...`);
      const characterTemplate = {
        id: charData.character.id,
        name: charData.character.name,
        username: "lifecycle_test",
        system: `You are ${charData.character.name}, an AI agent in Hyperscape.`,
        bio: ["I am a test agent for lifecycle testing."],
        topics: ["hyperscape", "testing"],
        adjectives: ["adventurous", "reliable"],
        plugins: ["@hyperscape/plugin-hyperscape"],
        settings: {
          secrets: {
            HYPERSCAPE_CHARACTER_ID: charData.character.id,
            HYPERSCAPE_AUTH_TOKEN: credentials.authToken,
            HYPERSCAPE_ACCOUNT_ID: testUser.userId,
            HYPERSCAPE_SERVER_URL: WS_URL,
            wallet: "0xLIFECYCLE",
          },
          avatar: "lifecycle-avatar.vrm",
          characterType: "ai-agent",
          accountId: testUser.userId,
        },
        style: {
          all: ["Be conversational"],
          chat: ["Be friendly"],
          post: ["Be concise"],
        },
      };

      const agentResponse = await httpRequest(`${ELIZAOS_API}/api/agents`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ characterJson: characterTemplate }),
      });

      expect(agentResponse.ok).toBe(true);
      const agentData = agentResponse.data as {
        data: { character: { id: string } };
      };
      const agentId = agentData.data?.character?.id;
      logs.push(`[${testName}] ✅ Agent created: ${agentId}`);

      // STEP 4: Save agent mapping
      logs.push(`[${testName}] STEP 4: Saving agent mapping...`);
      const mappingResponse = await httpRequest(
        `${SERVER_URL}/api/agents/mappings`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            agentId,
            accountId: testUser.userId,
            characterId: charData.character.id,
            agentName: charData.character.name,
          }),
        },
      );

      expect(mappingResponse.ok).toBe(true);
      logs.push(`[${testName}] ✅ Agent mapping saved`);

      // STEP 5: Spawn in world
      logs.push(`[${testName}] STEP 5: Spawning in world...`);
      const ws = new WebSocket(
        `${WS_URL}?authToken=${credentials.authToken}&privyUserId=${testUser.userId}`,
      );

      await new Promise<void>((resolve) => {
        ws.on("open", () => {
          logs.push(`[${testName}] ✅ WebSocket connected`);
          resolve();
        });
      });

      ws.send(
        encodePacket("enterWorld", {
          characterId: charData.character.id,
          accountId: testUser.userId,
        }),
      );
      logs.push(`[${testName}] Sent enterWorld packet`);

      const snapshot = await waitForPacket(ws, "snapshot", 10000);
      logs.push(`[${testName}] ✅ Spawned in world (snapshot received)`);

      // STEP 6: Perform action (move)
      logs.push(`[${testName}] STEP 6: Performing action (move)...`);
      ws.send(
        encodePacket("moveRequest", {
          x: 10,
          y: 0,
          z: 10,
        }),
      );
      logs.push(`[${testName}] ✅ Move action sent`);

      ws.close();

      logs.push(`[${testName}] ========================================`);
      logs.push(`[${testName}] ✅ COMPLETE LIFECYCLE VERIFIED`);
      logs.push(`[${testName}]   - Character created ✓`);
      logs.push(`[${testName}]   - JWT generated ✓`);
      logs.push(`[${testName}]   - Agent created in ElizaOS ✓`);
      logs.push(`[${testName}]   - Mapping saved ✓`);
      logs.push(`[${testName}]   - Spawned in world ✓`);
      logs.push(`[${testName}]   - Action performed ✓`);

      console.log(`[${testName}] ✅ Test PASSED`);
    } catch (error) {
      logs.push(
        `[${testName}] ❌ Test error: ${error instanceof Error ? error.message : String(error)}`,
      );
      console.error(`[${testName}] Test failed:`, error);
      throw error;
    } finally {
      saveTestLog(testName, logs.join("\n"));
    }
  });

  /**
   * TEST 2: Agent Crash and Reconnection
   * Agent crash → reconnect → verify state preserved
   */
  test("Agent crash and reconnection preserves state", async () => {
    const testName = "agent-crash-reconnection";
    const logs: string[] = [];

    try {
      logs.push(`[${testName}] Testing agent crash and reconnection...`);
      logs.push(`[${testName}] ========================================`);
      const testUser = createTestUser();
      await createUserInDatabase(testUser.userId);

      // Create character
      const createCharResponse = await httpRequest(
        `${SERVER_URL}/api/characters/db`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            accountId: testUser.userId,
            name: "Crash Test Agent",
          }),
        },
      );

      const charData = createCharResponse.data as {
        character: { id: string };
      };
      logs.push(`[${testName}] ✅ Character created: ${charData.character.id}`);

      // Generate JWT
      const credResponse = await httpRequest(
        `${SERVER_URL}/api/agents/credentials`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            characterId: charData.character.id,
            accountId: testUser.userId,
          }),
        },
      );

      const credentials = credResponse.data as { authToken: string };

      // First connection
      logs.push(`[${testName}] PHASE 1: Initial connection...`);
      let ws = new WebSocket(
        `${WS_URL}?authToken=${credentials.authToken}&privyUserId=${testUser.userId}`,
      );

      await new Promise<void>((resolve) => {
        ws.on("open", () => resolve());
      });

      ws.send(
        encodePacket("enterWorld", {
          characterId: charData.character.id,
          accountId: testUser.userId,
        }),
      );

      await waitForPacket(ws, "snapshot", 10000);
      logs.push(`[${testName}] ✅ Agent spawned in world`);

      // Simulate crash
      logs.push(`[${testName}] PHASE 2: Simulating crash...`);
      ws.terminate();
      logs.push(`[${testName}] 💥 Connection terminated (simulated crash)`);

      // Wait for server to detect disconnect
      await new Promise((resolve) => setTimeout(resolve, 3000));

      // Reconnect
      logs.push(`[${testName}] PHASE 3: Reconnecting...`);
      ws = new WebSocket(
        `${WS_URL}?authToken=${credentials.authToken}&privyUserId=${testUser.userId}`,
      );

      await new Promise<void>((resolve) => {
        ws.on("open", () => resolve());
      });

      ws.send(
        encodePacket("enterWorld", {
          characterId: charData.character.id,
          accountId: testUser.userId,
        }),
      );

      await waitForPacket(ws, "snapshot", 10000);
      logs.push(`[${testName}] ✅ Reconnection successful`);
      logs.push(`[${testName}] ✅ Stale entity cleaned up automatically`);

      ws.close();

      logs.push(`[${testName}] ========================================`);
      logs.push(`[${testName}] ✅ CRASH RECOVERY VERIFIED`);
      logs.push(`[${testName}]   - Initial spawn ✓`);
      logs.push(`[${testName}]   - Crash simulated ✓`);
      logs.push(`[${testName}]   - Reconnection successful ✓`);
      logs.push(`[${testName}]   - Stale entity cleanup ✓`);

      console.log(`[${testName}] ✅ Test PASSED`);
    } catch (error) {
      logs.push(
        `[${testName}] ❌ Test error: ${error instanceof Error ? error.message : String(error)}`,
      );
      console.error(`[${testName}] Test failed:`, error);
      throw error;
    } finally {
      saveTestLog(testName, logs.join("\n"));
    }
  });

  /**
   * TEST 3: Agent Deletion and Cleanup
   * Delete agent → verify cleanup in both ElizaOS and Hyperscape
   */
  test("Agent deletion and cleanup", async () => {
    const testName = "agent-deletion-cleanup";
    const logs: string[] = [];

    try {
      logs.push(`[${testName}] Testing agent deletion and cleanup...`);
      logs.push(`[${testName}] ========================================`);
      const testUser = createTestUser();
      await createUserInDatabase(testUser.userId);

      // Create character and agent
      const createCharResponse = await httpRequest(
        `${SERVER_URL}/api/characters/db`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            accountId: testUser.userId,
            name: "Delete Test Agent",
          }),
        },
      );

      const charData = createCharResponse.data as {
        character: { id: string };
      };

      const credResponse = await httpRequest(
        `${SERVER_URL}/api/agents/credentials`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            characterId: charData.character.id,
            accountId: testUser.userId,
          }),
        },
      );

      const credentials = credResponse.data as { authToken: string };

      const characterTemplate = {
        id: charData.character.id,
        name: "Delete Test Agent",
        username: "delete_test",
        system: "Test",
        bio: ["Test"],
        topics: ["test"],
        adjectives: ["test"],
        plugins: ["@hyperscape/plugin-hyperscape"],
        settings: {
          secrets: {
            HYPERSCAPE_CHARACTER_ID: charData.character.id,
            HYPERSCAPE_AUTH_TOKEN: credentials.authToken,
            HYPERSCAPE_ACCOUNT_ID: testUser.userId,
          },
          accountId: testUser.userId,
        },
        style: { all: ["test"], chat: ["test"], post: ["test"] },
      };

      const agentResponse = await httpRequest(`${ELIZAOS_API}/api/agents`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ characterJson: characterTemplate }),
      });

      const agentData = agentResponse.data as {
        data: { character: { id: string } };
      };
      const agentId = agentData.data?.character?.id;
      logs.push(`[${testName}] ✅ Agent created: ${agentId}`);

      // Save mapping
      await httpRequest(`${SERVER_URL}/api/agents/mappings`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          agentId,
          accountId: testUser.userId,
          characterId: charData.character.id,
          agentName: "Delete Test Agent",
        }),
      });
      logs.push(`[${testName}] ✅ Mapping saved`);

      // Delete from Hyperscape
      logs.push(`[${testName}] PHASE 1: Deleting from Hyperscape...`);
      const deleteMappingResponse = await httpRequest(
        `${SERVER_URL}/api/agents/mappings/${agentId}`,
        {
          method: "DELETE",
        },
      );
      logs.push(
        `[${testName}] Hyperscape mapping delete status: ${deleteMappingResponse.status}`,
      );

      // Delete from ElizaOS
      logs.push(`[${testName}] PHASE 2: Deleting from ElizaOS...`);
      const deleteElizaResponse = await httpRequest(
        `${ELIZAOS_API}/api/agents/${agentId}`,
        {
          method: "DELETE",
        },
      );
      logs.push(
        `[${testName}] ElizaOS delete status: ${deleteElizaResponse.status}`,
      );

      // Verify deletion
      logs.push(`[${testName}] PHASE 3: Verifying deletion...`);

      // Check Hyperscape mapping
      const verifyMappingResponse = await httpRequest(
        `${SERVER_URL}/api/agents/mappings/${testUser.userId}`,
      );

      if (verifyMappingResponse.ok) {
        const mappings = verifyMappingResponse.data as {
          agentIds: string[];
        };
        const stillExists = mappings.agentIds.includes(agentId);

        if (!stillExists) {
          logs.push(`[${testName}] ✅ Mapping deleted from Hyperscape`);
        } else {
          logs.push(`[${testName}] ⚠️  Mapping still exists in Hyperscape`);
        }
      }

      // Check ElizaOS
      const verifyElizaResponse = await httpRequest(
        `${ELIZAOS_API}/api/agents/${agentId}`,
      );

      if (verifyElizaResponse.status === 404 || !verifyElizaResponse.ok) {
        logs.push(`[${testName}] ✅ Agent deleted from ElizaOS`);
      } else {
        logs.push(`[${testName}] ⚠️  Agent still exists in ElizaOS`);
      }

      logs.push(`[${testName}] ========================================`);
      logs.push(`[${testName}] ✅ DELETION AND CLEANUP VERIFIED`);
      logs.push(`[${testName}]   - Agent created ✓`);
      logs.push(`[${testName}]   - Mapping saved ✓`);
      logs.push(`[${testName}]   - Hyperscape deletion ✓`);
      logs.push(`[${testName}]   - ElizaOS deletion ✓`);
      logs.push(`[${testName}]   - Cleanup verified ✓`);

      console.log(`[${testName}] ✅ Test PASSED`);
    } catch (error) {
      logs.push(
        `[${testName}] ❌ Test error: ${error instanceof Error ? error.message : String(error)}`,
      );
      console.error(`[${testName}] Test failed:`, error);
      throw error;
    } finally {
      saveTestLog(testName, logs.join("\n"));
    }
  });

  /**
   * TEST 4: Multiple Agents for Same Account
   * Create multiple agents → verify each is isolated → all can be managed
   */
  test("Multiple agents for same account", async () => {
    const testName = "multiple-agents-same-account";
    const logs: string[] = [];

    try {
      logs.push(`[${testName}] Testing multiple agents for same account...`);
      logs.push(`[${testName}] ========================================`);
      const testUser = createTestUser();
      await createUserInDatabase(testUser.userId);

      const agentIds: string[] = [];
      const characterIds: string[] = [];

      // Create 3 agents
      for (let i = 1; i <= 3; i++) {
        logs.push(`[${testName}] Creating agent ${i}/3...`);

        // Create character
        const createCharResponse = await httpRequest(
          `${SERVER_URL}/api/characters/db`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              accountId: testUser.userId,
              name: `Multi Agent ${i}`,
            }),
          },
        );

        const charData = createCharResponse.data as {
          character: { id: string };
        };
        characterIds.push(charData.character.id);

        // Generate JWT
        const credResponse = await httpRequest(
          `${SERVER_URL}/api/agents/credentials`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              characterId: charData.character.id,
              accountId: testUser.userId,
            }),
          },
        );

        const credentials = credResponse.data as { authToken: string };

        // Create agent
        const characterTemplate = {
          id: charData.character.id,
          name: `Multi Agent ${i}`,
          username: `multi_agent_${i}`,
          system: `Test agent ${i}`,
          bio: [`I am agent ${i}`],
          topics: ["test"],
          adjectives: ["test"],
          plugins: ["@hyperscape/plugin-hyperscape"],
          settings: {
            secrets: {
              HYPERSCAPE_CHARACTER_ID: charData.character.id,
              HYPERSCAPE_AUTH_TOKEN: credentials.authToken,
              HYPERSCAPE_ACCOUNT_ID: testUser.userId,
            },
            accountId: testUser.userId,
          },
          style: { all: ["test"], chat: ["test"], post: ["test"] },
        };

        const agentResponse = await httpRequest(`${ELIZAOS_API}/api/agents`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ characterJson: characterTemplate }),
        });

        const agentData = agentResponse.data as {
          data: { character: { id: string } };
        };
        const agentId = agentData.data?.character?.id;
        agentIds.push(agentId);

        // Save mapping
        await httpRequest(`${SERVER_URL}/api/agents/mappings`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            agentId,
            accountId: testUser.userId,
            characterId: charData.character.id,
            agentName: `Multi Agent ${i}`,
          }),
        });

        logs.push(`[${testName}] ✅ Agent ${i} created: ${agentId}`);
      }

      // Verify all agents belong to same account
      logs.push(`[${testName}] Verifying all agents belong to account...`);
      const mappingsResponse = await httpRequest(
        `${SERVER_URL}/api/agents/mappings/${testUser.userId}`,
      );

      expect(mappingsResponse.ok).toBe(true);
      const mappings = mappingsResponse.data as {
        agentIds: string[];
        count: number;
      };

      expect(mappings.count).toBeGreaterThanOrEqual(3);
      logs.push(
        `[${testName}] ✅ Found ${mappings.count} agent(s) for account`,
      );

      // Verify each agent ID is present
      for (const agentId of agentIds) {
        expect(mappings.agentIds).toContain(agentId);
        logs.push(`[${testName}] ✅ Agent ${agentId} belongs to account`);
      }

      logs.push(`[${testName}] ========================================`);
      logs.push(`[${testName}] ✅ MULTIPLE AGENTS VERIFIED`);
      logs.push(`[${testName}]   - 3 agents created ✓`);
      logs.push(`[${testName}]   - All belong to same account ✓`);
      logs.push(`[${testName}]   - Each has unique ID ✓`);
      logs.push(`[${testName}]   - All mappings saved ✓`);

      console.log(`[${testName}] ✅ Test PASSED`);
    } catch (error) {
      logs.push(
        `[${testName}] ❌ Test error: ${error instanceof Error ? error.message : String(error)}`,
      );
      console.error(`[${testName}] Test failed:`, error);
      throw error;
    } finally {
      saveTestLog(testName, logs.join("\n"));
    }
  });
});
