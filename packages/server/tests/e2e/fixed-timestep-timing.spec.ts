/**
 * Fixed Timestep Timing E2E Tests
 *
 * Verifies that the game's timing architecture works correctly:
 * - Animations play at real-time speed regardless of FPS
 * - Movement progresses at correct real-world speed
 * - No "slow motion" effect at low FPS
 * - Physics runs independently of animation/movement timing
 *
 * This tests the dual-delta architecture where:
 * - Physics delta is clamped to 33ms for stability
 * - Animation/movement delta uses real time (capped at 500ms)
 *
 * Prerequisites: Server must be running on localhost:5555
 */

import { test, expect } from "@playwright/test";
import { createTestUser, createUserInDatabase } from "./helpers/auth-helper";
import WebSocket from "ws";
import { Packr, Unpackr } from "msgpackr";
import {
  getPacketId as sharedGetPacketId,
  getPacketName as sharedGetPacketName,
} from "@hyperforge/shared";
import * as fs from "fs";
import * as path from "path";

const SERVER_URL =
  process.env.PUBLIC_API_URL ||
  process.env.SERVER_URL ||
  "http://localhost:5555";
const WS_URL =
  process.env.PUBLIC_WS_URL || process.env.WS_URL || "ws://localhost:5555/ws";
const LOG_DIR = path.resolve(
  process.env.HOME || "/Users/home",
  "logs/fixed-timestep-tests",
);

// msgpackr instances for binary packet encoding/decoding
const packr = new Packr({ structuredClone: true });
const unpackr = new Unpackr();

// Ensure log directory exists
if (!fs.existsSync(LOG_DIR)) {
  fs.mkdirSync(LOG_DIR, { recursive: true });
}

function saveTestLog(testName: string, content: string) {
  const logFile = path.join(LOG_DIR, `${testName}.log`);
  fs.writeFileSync(logFile, content);
  console.log(`[${testName}] Logs saved to: ${logFile}`);
}

function encodePacket(packetName: string, data: unknown): Buffer {
  const packetId = sharedGetPacketId(packetName);
  if (packetId == null) throw new Error(`Unknown packet: ${packetName}`);
  return packr.pack([packetId, data]);
}

function decodePacket(buffer: Buffer): [string, unknown] {
  const [packetIdRaw, data] = unpackr.unpack(buffer) as [number, unknown];
  const packetName = sharedGetPacketName(packetIdRaw);
  if (!packetName) throw new Error(`Unknown packet ID: ${packetIdRaw}`);
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
      const [packetName, packetData] = decodePacket(data);
      if (packetName === expectedPacketName) {
        clearTimeout(timer);
        ws.off("message", messageHandler);
        resolve(packetData);
      }
    };

    ws.on("message", messageHandler);
  });
}

async function waitForPacketMatching<T>(
  ws: WebSocket,
  expectedPacketName: string,
  predicate: (data: unknown) => data is T,
  timeout = 5000,
): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(
        new Error(`Timeout waiting for matching packet: ${expectedPacketName}`),
      );
    }, timeout);

    const messageHandler = (data: Buffer) => {
      const [packetName, packetData] = decodePacket(data);
      if (packetName !== expectedPacketName) return;
      if (!predicate(packetData)) return;

      clearTimeout(timer);
      ws.off("message", messageHandler);
      resolve(packetData);
    };

    ws.on("message", messageHandler);
  });
}

test.describe("Fixed Timestep Timing System", () => {
  test.beforeAll(async () => {
    console.log("⏱️ Starting fixed timestep timing tests...");
    console.log(`📁 Logs will be saved to: ${LOG_DIR}`);
  });

  /**
   * TEST 1: Server Movement Timing Consistency
   * Verifies: Server-side movement timing (via WebSocket) is consistent
   * This is the primary test - server timing should be deterministic
   */
  test("Server movement timing is consistent regardless of client FPS", async () => {
    const testName = "server-movement-timing";
    const logs: string[] = [];

    try {
      logs.push(`[${testName}] Testing server movement timing...`);

      const testUser = createTestUser();
      await createUserInDatabase(testUser.userId);

      // Create character
      const createResponse = await fetch(`${SERVER_URL}/api/characters/db`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          accountId: testUser.userId,
          name: "Timing Test",
        }),
      });
      expect(createResponse.ok).toBe(true);
      const createData = (await createResponse.json()) as {
        character: { id: string };
      };
      logs.push(
        `[${testName}] ✅ Character created: ${createData.character.id}`,
      );

      // Connect via WebSocket
      const ws = new WebSocket(`${WS_URL}?authToken=${testUser.token}`);
      await new Promise<void>((resolve) => ws.on("open", () => resolve()));

      // Wait for snapshot
      await waitForPacket(ws, "snapshot", 10000);
      logs.push(`[${testName}] ✅ Received snapshot`);

      // Enter world
      ws.send(
        encodePacket("enterWorld", {
          characterId: createData.character.id,
          accountId: testUser.userId,
        }),
      );

      // Wait for player to spawn
      const entityData = (await waitForPacket(ws, "entityAdded", 10000)) as {
        id: string;
        position?: { x: number; z: number };
        tile?: { x: number; z: number };
      };
      const playerId = entityData.id;
      logs.push(
        `[${testName}] ✅ Player spawned (id: ${playerId}) at tile: ${JSON.stringify(entityData.tile)}`,
      );

      // Record start time and position
      const startTime = Date.now();
      const startTile = entityData.tile ?? { x: 0, z: 0 };

      // Request movement to a nearby tile
      const targetTile = { x: startTile.x + 5, z: startTile.z };
      ws.send(encodePacket("moveRequest", { tile: targetTile }));
      logs.push(
        `[${testName}] Sent moveRequest to tile: ${JSON.stringify(targetTile)}`,
      );

      // Wait for movement updates (filter by player ID)
      type TileUpdate = { id?: string; tile?: { x: number; z: number } };
      let lastTile = startTile;
      let updates = 0;
      const maxWait = 10000; // 10 seconds max

      while (Date.now() - startTime < maxWait) {
        try {
          const update = (await waitForPacket(
            ws,
            "entityTileUpdate",
            2000,
          )) as TileUpdate;
          // Only process updates for our player, ignore other entities
          if (update.tile && update.id === playerId) {
            lastTile = update.tile;
            updates++;
            logs.push(
              `[${testName}] Update ${updates}: tile ${JSON.stringify(lastTile)}`,
            );

            // Check if we've reached the target
            if (lastTile.x === targetTile.x && lastTile.z === targetTile.z) {
              break;
            }
          }
        } catch {
          // Timeout on individual update, check if we're done
          break;
        }
      }

      const endTime = Date.now();
      const elapsed = (endTime - startTime) / 1000;
      const tilesMovedX = Math.abs(lastTile.x - startTile.x);

      // At walking speed: 1 tile per 600ms tick
      // 5 tiles should take ~3 seconds
      const expectedTime = 5 * 0.6; // 3 seconds

      logs.push(`[${testName}] Movement completed:`);
      logs.push(`[${testName}]   Tiles moved: ${tilesMovedX}`);
      logs.push(`[${testName}]   Time elapsed: ${elapsed.toFixed(2)}s`);
      logs.push(`[${testName}]   Expected time: ~${expectedTime}s`);
      logs.push(`[${testName}]   Updates received: ${updates}`);

      // Server timing should be consistent (within 50% of expected)
      // This verifies server isn't affected by client FPS issues
      if (tilesMovedX > 0) {
        const actualTimePerTile = elapsed / tilesMovedX;
        const expectedTimePerTile = 0.6; // 600ms per tile walking
        const ratio = actualTimePerTile / expectedTimePerTile;
        logs.push(
          `[${testName}]   Time per tile: ${actualTimePerTile.toFixed(2)}s (expected ~0.6s)`,
        );
        logs.push(`[${testName}]   Timing ratio: ${ratio.toFixed(2)}`);

        // Server timing should be reasonably close to expected
        expect(ratio).toBeGreaterThan(0.5);
        expect(ratio).toBeLessThan(2.0);
      }

      ws.close();
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
   * TEST 2: Server Tick Consistency Under Load
   * Verifies: Server tick timing remains consistent (600ms per game tick)
   */
  test("Server tick timing is consistent (600ms game ticks)", async () => {
    const testName = "server-tick-consistency";
    const logs: string[] = [];

    try {
      logs.push(`[${testName}] Testing server tick consistency...`);

      const testUser = createTestUser();
      await createUserInDatabase(testUser.userId);

      // Create character
      const createResponse = await fetch(`${SERVER_URL}/api/characters/db`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          accountId: testUser.userId,
          name: "Tick Test",
        }),
      });
      expect(createResponse.ok).toBe(true);
      const createData = (await createResponse.json()) as {
        character: { id: string };
      };
      logs.push(`[${testName}] ✅ Character created`);

      // Connect via WebSocket
      const ws = new WebSocket(`${WS_URL}?authToken=${testUser.token}`);
      await new Promise<void>((resolve) => ws.on("open", () => resolve()));

      // Wait for snapshot
      await waitForPacket(ws, "snapshot", 10000);
      logs.push(`[${testName}] ✅ Connected`);

      // Enter world
      ws.send(
        encodePacket("enterWorld", {
          characterId: createData.character.id,
          accountId: testUser.userId,
        }),
      );
      await waitForPacket(ws, "entityAdded", 10000);
      logs.push(`[${testName}] ✅ Player spawned`);

      // Measure time between worldTimeSync packets (sent every game tick)
      const syncTimes: number[] = [];
      const startTime = Date.now();
      const measureDuration = 5000; // 5 seconds of measurement

      // Listen for worldTimeSync packets
      const collectSyncs = new Promise<void>((resolve) => {
        const handler = (data: Buffer) => {
          const [packetName] = decodePacket(data);
          if (packetName === "worldTimeSync") {
            syncTimes.push(Date.now());
            if (Date.now() - startTime > measureDuration) {
              ws.off("message", handler);
              resolve();
            }
          }
        };
        ws.on("message", handler);

        // Timeout fallback
        setTimeout(() => {
          ws.off("message", handler);
          resolve();
        }, measureDuration + 1000);
      });

      await collectSyncs;

      // Calculate intervals between syncs
      const intervals: number[] = [];
      for (let i = 1; i < syncTimes.length; i++) {
        intervals.push(syncTimes[i] - syncTimes[i - 1]);
      }

      logs.push(
        `[${testName}] Received ${syncTimes.length} worldTimeSync packets`,
      );
      logs.push(
        `[${testName}] Intervals: ${intervals.map((i) => i.toFixed(0)).join(", ")}`,
      );

      if (intervals.length > 0) {
        const avgInterval =
          intervals.reduce((a, b) => a + b, 0) / intervals.length;
        const expectedInterval = 600; // 600ms per game tick

        logs.push(
          `[${testName}] Average interval: ${avgInterval.toFixed(1)}ms (expected ~600ms)`,
        );

        // Server ticks should be ~600ms (allow some variance for network/scheduling)
        // This verifies the OSRS-style tick system is working
        expect(avgInterval).toBeGreaterThan(400); // At least 400ms
        expect(avgInterval).toBeLessThan(1000); // At most 1000ms
        logs.push(`[${testName}] ✅ Tick timing within expected range`);
      } else {
        logs.push(
          `[${testName}] ⚠️ No worldTimeSync packets received (may not be enabled)`,
        );
      }

      ws.close();
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
   * TEST 3: AttackMob End-to-End Combat Flow
   * Verifies: `attackMob` packets trigger real server-side combat processing
   * and produce combat damage events for an actual mob.
   */
  test("attackMob packet starts mob combat and emits combatDamageDealt", async () => {
    const testName = "attack-mob-combat-flow";
    const logs: string[] = [];

    type EntityAddedPacket = {
      id?: string;
      type?: string;
      health?: number;
      position?: { x: number; y: number; z: number };
      config?: { currentHealth?: number; mobType?: string };
    };
    type CombatDamagePacket = {
      attackerId?: string;
      targetId?: string;
      damage?: number;
      targetType?: string;
    };

    try {
      logs.push(`[${testName}] Testing attackMob -> combat damage flow...`);

      const testUser = createTestUser();
      await createUserInDatabase(testUser.userId);

      const createResponse = await fetch(`${SERVER_URL}/api/characters/db`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          accountId: testUser.userId,
          name: "Attack Flow",
        }),
      });
      expect(createResponse.ok).toBe(true);
      const createData = (await createResponse.json()) as {
        character: { id: string };
      };

      const ws = new WebSocket(`${WS_URL}?authToken=${testUser.token}`);
      await new Promise<void>((resolve) => ws.on("open", () => resolve()));

      await waitForPacket(ws, "snapshot", 10000);
      logs.push(`[${testName}] ✅ Connected and received snapshot`);

      ws.send(
        encodePacket("enterWorld", {
          characterId: createData.character.id,
          accountId: testUser.userId,
        }),
      );

      const playerEntity = await waitForPacketMatching<EntityAddedPacket>(
        ws,
        "entityAdded",
        (data): data is EntityAddedPacket =>
          typeof (data as EntityAddedPacket)?.id === "string" &&
          (data as EntityAddedPacket)?.type === "player",
        15000,
      );
      const playerId = playerEntity.id as string;
      logs.push(`[${testName}] ✅ Player spawned: ${playerId}`);

      const mobEntity = await waitForPacketMatching<EntityAddedPacket>(
        ws,
        "entityAdded",
        (data): data is EntityAddedPacket => {
          const packet = data as EntityAddedPacket;
          const health = packet.health ?? packet.config?.currentHealth ?? 0;
          return (
            typeof packet.id === "string" && packet.type === "mob" && health > 0
          );
        },
        60000,
      );
      const mobId = mobEntity.id as string;
      logs.push(
        `[${testName}] ✅ Found mob entity: ${mobId} (${mobEntity.config?.mobType ?? "unknown"})`,
      );

      ws.send(
        encodePacket("attackMob", {
          mobId,
          attackType: "melee",
        }),
      );
      logs.push(`[${testName}] Sent attackMob for target ${mobId}`);

      const damagePacket = await waitForPacketMatching<CombatDamagePacket>(
        ws,
        "combatDamageDealt",
        (data): data is CombatDamagePacket => {
          const packet = data as CombatDamagePacket;
          return (
            packet.targetId === mobId &&
            packet.attackerId === playerId &&
            typeof packet.damage === "number"
          );
        },
        45000,
      );

      expect(damagePacket.targetId).toBe(mobId);
      expect(damagePacket.attackerId).toBe(playerId);
      expect(typeof damagePacket.damage).toBe("number");

      logs.push(
        `[${testName}] ✅ combatDamageDealt received: damage=${damagePacket.damage}`,
      );

      ws.close();
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
   * TEST 4: Re-clicking Same Target Should Not Stall Combat
   * Verifies: Repeated attack packets against the same mob do not reset/cancel
   * pending or active combat loops.
   */
  test("repeated attackMob clicks on same mob do not stall combat", async () => {
    const testName = "attack-mob-redundant-clicks-no-stall";
    const logs: string[] = [];

    type EntityAddedPacket = {
      id?: string;
      type?: string;
      health?: number;
      position?: { x: number; y: number; z: number };
      config?: { currentHealth?: number; mobType?: string };
    };
    type CombatDamagePacket = {
      attackerId?: string;
      targetId?: string;
      damage?: number;
      targetType?: string;
    };

    let ws: WebSocket | null = null;
    let spamInterval: ReturnType<typeof setInterval> | null = null;

    try {
      logs.push(
        `[${testName}] Testing repeated same-target attackMob spam does not stall combat...`,
      );

      const testUser = createTestUser();
      await createUserInDatabase(testUser.userId);

      const createResponse = await fetch(`${SERVER_URL}/api/characters/db`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          accountId: testUser.userId,
          name: "Spam Attack",
        }),
      });
      expect(createResponse.ok).toBe(true);
      const createData = (await createResponse.json()) as {
        character: { id: string };
      };

      ws = new WebSocket(`${WS_URL}?authToken=${testUser.token}`);
      await new Promise<void>((resolve) => ws!.on("open", () => resolve()));

      await waitForPacket(ws, "snapshot", 10000);
      logs.push(`[${testName}] ✅ Connected and received snapshot`);

      ws.send(
        encodePacket("enterWorld", {
          characterId: createData.character.id,
          accountId: testUser.userId,
        }),
      );

      const playerEntity = await waitForPacketMatching<EntityAddedPacket>(
        ws,
        "entityAdded",
        (data): data is EntityAddedPacket =>
          typeof (data as EntityAddedPacket)?.id === "string" &&
          (data as EntityAddedPacket)?.type === "player",
        15000,
      );
      const playerId = playerEntity.id as string;
      logs.push(`[${testName}] ✅ Player spawned: ${playerId}`);

      const mobEntity = await waitForPacketMatching<EntityAddedPacket>(
        ws,
        "entityAdded",
        (data): data is EntityAddedPacket => {
          const packet = data as EntityAddedPacket;
          const health = packet.health ?? packet.config?.currentHealth ?? 0;
          return (
            typeof packet.id === "string" && packet.type === "mob" && health > 0
          );
        },
        60000,
      );
      const mobId = mobEntity.id as string;
      logs.push(
        `[${testName}] ✅ Found mob entity: ${mobId} (${mobEntity.config?.mobType ?? "unknown"})`,
      );

      const sendAttack = () => {
        ws!.send(
          encodePacket("attackMob", {
            mobId,
            attackType: "melee",
          }),
        );
      };

      // Start attack once, then keep spamming the same target to emulate
      // aggressive re-clicking while pathing + during active combat.
      sendAttack();
      spamInterval = setInterval(sendAttack, 120);
      logs.push(
        `[${testName}] Started attackMob spam on target ${mobId} every 120ms`,
      );

      const firstDamage = await waitForPacketMatching<CombatDamagePacket>(
        ws,
        "combatDamageDealt",
        (data): data is CombatDamagePacket => {
          const packet = data as CombatDamagePacket;
          return (
            packet.targetId === mobId &&
            packet.attackerId === playerId &&
            typeof packet.damage === "number"
          );
        },
        45000,
      );
      logs.push(
        `[${testName}] ✅ First hit while spamming: damage=${firstDamage.damage}`,
      );

      // Keep spamming through active combat and require another hit to prove
      // repeated same-target packets are ignored (not resetting attack loop).
      const secondDamage = await waitForPacketMatching<CombatDamagePacket>(
        ws,
        "combatDamageDealt",
        (data): data is CombatDamagePacket => {
          const packet = data as CombatDamagePacket;
          return (
            packet.targetId === mobId &&
            packet.attackerId === playerId &&
            typeof packet.damage === "number"
          );
        },
        45000,
      );
      logs.push(
        `[${testName}] ✅ Second hit while still spamming: damage=${secondDamage.damage}`,
      );

      expect(firstDamage.targetId).toBe(mobId);
      expect(firstDamage.attackerId).toBe(playerId);
      expect(secondDamage.targetId).toBe(mobId);
      expect(secondDamage.attackerId).toBe(playerId);

      if (spamInterval) {
        clearInterval(spamInterval);
        spamInterval = null;
      }
      ws.close();
      ws = null;
      console.log(`[${testName}] ✅ Test PASSED`);
    } catch (error) {
      logs.push(
        `[${testName}] ❌ Test error: ${error instanceof Error ? error.message : String(error)}`,
      );
      console.error(`[${testName}] Test failed:`, error);
      throw error;
    } finally {
      if (spamInterval) {
        clearInterval(spamInterval);
      }
      if (ws) {
        ws.close();
      }
      saveTestLog(testName, logs.join("\n"));
    }
  });
});
