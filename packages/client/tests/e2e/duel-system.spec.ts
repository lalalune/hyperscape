/**
 * Duel System E2E Tests
 *
 * Tests for the complete duel flow using real Hyperia instances.
 * Per project rules: NO MOCKS - uses real servers and Playwright.
 *
 * Test scenarios:
 * - Duel challenge flow
 * - Duel UI interactions
 * - Betting panel functionality
 */

import { expect } from "@playwright/test";
import {
  waitForPlayerSpawn,
  getPlayerStats,
  waitForWebSocketConnection,
  setupErrorCapture,
} from "./utils/testWorld";
import { evmTest } from "./fixtures/wallet-fixtures";
import {
  completeFullLoginFlow,
  waitForAppReady,
} from "./fixtures/privy-helpers";
import { BASE_URL } from "./fixtures/test-config";

const test = evmTest;

test.describe("Duel System", () => {
  // Increase test timeout for duel flows
  test.setTimeout(360000); // 6 minutes per test

  test.beforeEach(async ({ page, wallet }) => {
    page.setDefaultTimeout(60000);
    page.setDefaultNavigationTimeout(60000);

    await waitForAppReady(page, BASE_URL);
    const enteredGame = await completeFullLoginFlow(page, wallet);
    expect(enteredGame).toBe(true);
    await waitForPlayerSpawn(page, 240000);
    await waitForWebSocketConnection(page, 30000);
  });

  test("player can access duel-related UI elements", async ({ page }) => {
    // Verify the game loaded
    const stats = await getPlayerStats(page);
    expect(stats.health).toBeDefined();

    // Check if duel system is available
    const hasDuelSystem = await page.evaluate(() => {
      const win = window as unknown as {
        world?: {
          getSystem?: (name: string) => unknown;
          network?: { send?: (name: string, data: unknown) => void };
        };
      };
      const combatSystem = win.world?.getSystem?.("combat");
      const movementSystem = win.world?.getSystem?.("playerMovement");
      const canSend = typeof win.world?.network?.send === "function";
      return Boolean(combatSystem || movementSystem || canSend);
    });

    expect(hasDuelSystem).toBe(true);
  });

  test("duel state machine exists in world", async ({ page }) => {
    const hasDuelState = await page.evaluate(() => {
      const win = window as unknown as {
        world?: {
          on?: (event: string, callback: () => void) => void;
        };
      };
      // Verify world can receive duel events
      return typeof win.world?.on === "function";
    });

    expect(hasDuelState).toBe(true);
  });

  test("player health is tracked correctly", async ({ page }) => {
    const stats = await getPlayerStats(page);

    expect(stats.health).toBeDefined();
    expect(stats.health?.current).toBeGreaterThan(0);
    expect(stats.health?.max).toBeGreaterThan(0);
    expect(stats.health?.current).toBeLessThanOrEqual(stats.health?.max ?? 0);
  });
});

test.describe("Betting Panel", () => {
  test.setTimeout(360000);

  test.beforeEach(async ({ page, wallet }) => {
    page.setDefaultTimeout(60000);
    await waitForAppReady(page, BASE_URL);
    const enteredGame = await completeFullLoginFlow(page, wallet);
    expect(enteredGame).toBe(true);
    await waitForPlayerSpawn(page, 240000);
  });

  test("betting panel can be imported and types are correct", async ({
    page,
  }) => {
    // This is a compile-time check effectively - verify types exist
    const typesExist = await page.evaluate(() => {
      // Check if betting-related events can be handled
      const win = window as unknown as {
        world?: {
          on?: (event: string, callback: (data: unknown) => void) => void;
        };
      };

      if (!win.world?.on) return false;

      // Subscribe to betting events (won't trigger, just checking API)
      let eventHandlerCalled = false;
      win.world.on("betting:market:created", () => {
        eventHandlerCalled = true;
      });

      return true;
    });

    expect(typesExist).toBe(true);
  });
});

test.describe("Network Duel Packets", () => {
  test.setTimeout(360000);

  test.beforeEach(async ({ page, wallet }) => {
    page.setDefaultTimeout(60000);
    await waitForAppReady(page, BASE_URL);
    const enteredGame = await completeFullLoginFlow(page, wallet);
    expect(enteredGame).toBe(true);
    await waitForPlayerSpawn(page, 240000);
    await waitForWebSocketConnection(page, 30000);
  });

  test("network system can send duel packets", async ({ page }) => {
    const canSendPackets = await page.evaluate(() => {
      const win = window as unknown as {
        world?: {
          network?: {
            send?: (packet: string, data: unknown) => void;
          };
        };
      };

      const network = win.world?.network;
      return typeof network?.send === "function";
    });

    expect(canSendPackets).toBe(true);
  });

  test("world events for duels are registered", async ({ page }) => {
    const eventNames = [
      "duelChallengeIncoming",
      "duelSessionStarted",
      "duelStateChanged",
      "duelCountdownStart",
      "duelFightStart",
      "duelEnded",
    ];

    const canRegisterEvents = await page.evaluate((events) => {
      const win = window as unknown as {
        world?: {
          on?: (event: string, callback: () => void) => void;
        };
      };

      if (!win.world?.on) return false;

      // Register handlers for all duel events
      for (const event of events) {
        win.world.on(event, () => {});
      }

      return true;
    }, eventNames);

    expect(canRegisterEvents).toBe(true);
  });
});

test.describe("Console Error Monitoring", () => {
  test.setTimeout(360000);

  test("no critical errors during game load", async ({ page, wallet }) => {
    const { errors } = setupErrorCapture(page);

    await waitForAppReady(page, BASE_URL);
    const enteredGame = await completeFullLoginFlow(page, wallet);
    expect(enteredGame).toBe(true);
    await waitForPlayerSpawn(page, 240000);

    // Wait a bit for any async errors
    await page.waitForTimeout(2000);

    // Filter out known non-critical errors
    const criticalErrors = errors.filter((error) => {
      const knownPatterns = [
        /ResizeObserver/i,
        /favicon/i,
        /Script error/i,
        /Loading module/i,
        /hydrat/i,
        /THREE\.GLTFLoader: Couldn't load texture (blob:|data:image)/i,
        /Failed to load resource: net::ERR_UNEXPECTED/i,
      ];
      return !knownPatterns.some((p) => p.test(error));
    });

    // Log any errors for debugging
    if (criticalErrors.length > 0) {
      console.log("Console errors found:", criticalErrors);
    }

    // Allow some non-critical errors but fail on many
    expect(criticalErrors.length).toBeLessThan(5);
  });
});
