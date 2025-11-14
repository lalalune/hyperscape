/**
 * Multiplayer Visibility Test - Synpress Version
 *
 * Tests that players can see each other in the game world.
 * NO MOCKS - Uses real game systems, real network, real rendering.
 *
 * This test will CRASH HARD if players don't see each other!
 */

import { testWithSynpress } from "@synthetixio/synpress";
import { MetaMask, metaMaskFixtures } from "@synthetixio/synpress/playwright";
import { basicSetup } from "../../synpress.config";

const test = testWithSynpress(metaMaskFixtures(basicSetup));
const { expect } = test;

test.describe("Hyperscape - Multiplayer Visibility", () => {
  test("TWO PLAYERS MUST SEE EACH OTHER OR TEST CRASHES", async ({
    context,
    page,
  }) => {
    console.log("=== MULTIPLAYER VISIBILITY TEST STARTING ===");

    // Setup Player 1
    console.log("[Player 1] Navigating to game...");
    await page.goto("http://localhost:3333");
    await page.waitForLoadState("networkidle");

    console.log("[Player 1] Waiting for world to be ready...");
    await page.waitForFunction(
      () => {
        return (window as any).world?.entities?.player !== undefined;
      },
      { timeout: 30000 },
    );

    const player1Id = await page.evaluate(() => {
      const player = (window as any).world?.entities?.player;
      return player?.id || null;
    });

    console.log(`[Player 1] Spawned with ID: ${player1Id}`);
    expect(player1Id).toBeTruthy();

    // Player 1 should see themselves
    let p1InitialCount = await page.evaluate(() => {
      const world = (window as any).world;
      if (!world?.entities?.getAllPlayers) return 0;
      return world.entities.getAllPlayers().length;
    });

    console.log(`[Player 1] Initially sees ${p1InitialCount} player(s)`);
    expect(p1InitialCount).toBeGreaterThanOrEqual(1);

    // Setup Player 2 in new context
    console.log("[Player 2] Opening second browser context...");
    const player2Context = await context.browser()!.newContext();
    const player2Page = await player2Context.newPage();

    player2Page.on("console", (msg) => {
      const text = msg.text();
      if (text.includes("[ERROR]") || text.includes("[DEBUG]")) {
        console.log("[Player 2 Console]:", text);
      }
    });

    console.log("[Player 2] Navigating to game...");
    await player2Page.goto("http://localhost:3333");
    await player2Page.waitForLoadState("networkidle");

    console.log("[Player 2] Waiting for world to be ready...");
    await player2Page.waitForFunction(
      () => {
        return (window as any).world?.entities?.player !== undefined;
      },
      { timeout: 30000 },
    );

    const player2Id = await player2Page.evaluate(() => {
      const player = (window as any).world?.entities?.player;
      return player?.id || null;
    });

    console.log(`[Player 2] Spawned with ID: ${player2Id}`);
    expect(player2Id).toBeTruthy();
    expect(player2Id).not.toBe(player1Id);

    // Wait for entity synchronization
    console.log("Waiting for entity sync...");
    await page.waitForTimeout(3000);
    await player2Page.waitForTimeout(3000);

    // === CRITICAL TEST: Players MUST see each other ===
    console.log("=== CHECKING PLAYER VISIBILITY (WILL CRASH IF FAILED) ===");

    const p1Count = await page.evaluate(() => {
      const world = (window as any).world;
      if (!world?.entities?.getAllPlayers) return 0;
      return world.entities.getAllPlayers().length;
    });

    const p2Count = await player2Page.evaluate(() => {
      const world = (window as any).world;
      if (!world?.entities?.getAllPlayers) return 0;
      return world.entities.getAllPlayers().length;
    });

    console.log(`\n===== RESULTS =====`);
    console.log(`Player 1 sees: ${p1Count} player(s)`);
    console.log(`Player 2 sees: ${p2Count} player(s)`);
    console.log(`Expected: 2 players visible to each`);
    console.log(`===================\n`);

    // Get detailed entity information
    const p1Entities = await page.evaluate(() => {
      const world = (window as any).world;
      const entities: any[] = [];

      if (world?.entities) {
        const entityManager = world.getSystem("entity-manager");
        if (entityManager?.getAllEntities) {
          for (const [id, entity] of entityManager.getAllEntities()) {
            if (entity.type === "player" && entity.node?.position) {
              entities.push({
                id,
                position: [
                  entity.node.position.x,
                  entity.node.position.y,
                  entity.node.position.z,
                ],
              });
            }
          }
        }
      }
      return entities;
    });

    const p2Entities = await player2Page.evaluate(() => {
      const world = (window as any).world;
      const entities: any[] = [];

      if (world?.entities) {
        const entityManager = world.getSystem("entity-manager");
        if (entityManager?.getAllEntities) {
          for (const [id, entity] of entityManager.getAllEntities()) {
            if (entity.type === "player" && entity.node?.position) {
              entities.push({
                id,
                position: [
                  entity.node.position.x,
                  entity.node.position.y,
                  entity.node.position.z,
                ],
              });
            }
          }
        }
      }
      return entities;
    });

    console.log("Player 1 sees entities:", p1Entities);
    console.log("Player 2 sees entities:", p2Entities);

    // Take screenshots for debugging
    await page.screenshot({ path: "test-results/player1-view.png" });
    await player2Page.screenshot({ path: "test-results/player2-view.png" });
    console.log("Screenshots saved to test-results/");

    // === ASSERTIONS THAT WILL CRASH IF FAILED ===

    // Player 1 MUST see 2 players
    if (p1Count !== 2) {
      console.error(`\n🔥🔥🔥 CRITICAL FAILURE 🔥🔥🔥`);
      console.error(`Player 1 only sees ${p1Count} player(s), expected 2!`);
      console.error(`This means multiplayer visibility is BROKEN!`);
      console.error(`Check screenshots in test-results/`);
      throw new Error(
        `MULTIPLAYER BROKEN: Player 1 sees ${p1Count} players instead of 2`,
      );
    }

    // Player 2 MUST see 2 players
    if (p2Count !== 2) {
      console.error(`\n🔥🔥🔥 CRITICAL FAILURE 🔥🔥🔥`);
      console.error(`Player 2 only sees ${p2Count} player(s), expected 2!`);
      console.error(`This means multiplayer visibility is BROKEN!`);
      console.error(`Check screenshots in test-results/`);
      throw new Error(
        `MULTIPLAYER BROKEN: Player 2 sees ${p2Count} players instead of 2`,
      );
    }

    expect(p1Count).toBe(2);
    expect(p2Count).toBe(2);

    // Verify entity IDs are correct
    const p1SeeIds = p1Entities.map((e) => e.id);
    const p2SeeIds = p2Entities.map((e) => e.id);

    if (!p1SeeIds.includes(player2Id!)) {
      throw new Error(
        `Player 1 doesn't see Player 2's entity! Saw IDs: ${p1SeeIds.join(", ")}`,
      );
    }

    if (!p2SeeIds.includes(player1Id!)) {
      throw new Error(
        `Player 2 doesn't see Player 1's entity! Saw IDs: ${p2SeeIds.join(", ")}`,
      );
    }

    expect(p1SeeIds).toContain(player1Id);
    expect(p1SeeIds).toContain(player2Id);
    expect(p2SeeIds).toContain(player1Id);
    expect(p2SeeIds).toContain(player2Id);

    console.log(
      "\n✅✅✅ MULTIPLAYER WORKS! Both players see each other! ✅✅✅\n",
    );

    // Cleanup
    await player2Context.close();
  });
});
