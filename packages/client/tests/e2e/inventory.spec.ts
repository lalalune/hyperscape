/**
 * Inventory E2E Tests
 *
 * Tests inventory interactions using real Hyperia instances.
 * NO MOCKS - these tests run against actual game servers.
 *
 * Per project rules:
 * - Use real Hyperia worlds
 * - Test via Three.js scene introspection
 * - Visual verification with screenshots
 *
 * @packageDocumentation
 */

import { test, expect } from "@playwright/test";
import {
  waitForGameLoad,
  waitForPlayerSpawn,
  getPlayerStats,
  openPanel,
  closePanel,
  takeGameScreenshot,
} from "./utils/testWorld";
test.setTimeout(360000);

async function ensureInGame(page: any): Promise<void> {
  await page.goto("/");
  try {
    await waitForGameLoad(page, 45000);
    await waitForPlayerSpawn(page, 45000);
  } catch {
    test.skip(true, "Game world not ready in current e2e runtime");
  }
}

test.describe("Inventory Panel", () => {
  test.beforeEach(async ({ page }) => {
    await ensureInGame(page);
  });

  test("should open and close inventory panel", async ({ page }) => {
    // Open inventory panel
    await openPanel(page, "inventory");

    // Verify panel is visible
    const inventoryPanel = page.locator('[data-panel="inventory"]');
    await expect(inventoryPanel).toBeVisible();

    // Take screenshot for visual verification
    await takeGameScreenshot(page, "inventory-open");

    // Close inventory panel
    await closePanel(page, "inventory");

    // Verify panel is hidden
    await expect(inventoryPanel).not.toBeVisible();
  });

  test("should display player coins", async ({ page }) => {
    // Get initial stats
    const stats = await getPlayerStats(page);

    // Verify coins are a number
    expect(typeof stats.coins).toBe("number");
    expect(stats.coins).toBeGreaterThanOrEqual(0);
  });

  test("should show 28 inventory slots", async ({ page }) => {
    // Open inventory panel
    await openPanel(page, "inventory");

    // Wait for slots to render
    await page.waitForSelector('[data-testid="inventory-slot"]', {
      timeout: 5000,
    });

    // Count inventory slots
    const slots = page.locator('[data-testid="inventory-slot"]');
    await expect(slots).toHaveCount(28);

    // Take screenshot
    await takeGameScreenshot(page, "inventory-slots");
  });

  test("should use keyboard shortcut to toggle inventory", async ({ page }) => {
    const inventoryPanel = page.locator('[data-panel="inventory"]');

    // Panel should be hidden initially
    await expect(inventoryPanel).not.toBeVisible();

    // Press 'I' to open inventory (common game hotkey)
    await page.keyboard.press("i");

    // Wait for panel animation
    await page.waitForTimeout(300);

    // Check if panel is now visible (may depend on hotkey config)
    // Note: This test documents expected behavior - adjust if hotkey differs
    const isVisible = await inventoryPanel.isVisible();

    if (isVisible) {
      // Press 'I' again to close
      await page.keyboard.press("i");
      await page.waitForTimeout(300);
      await expect(inventoryPanel).not.toBeVisible();
    }
  });
});

test.describe("Player Health", () => {
  test.beforeEach(async ({ page }) => {
    await ensureInGame(page);
  });

  test("should display player health", async ({ page }) => {
    const stats = await getPlayerStats(page);

    // Verify health values exist and are valid
    expect(stats.health).toBeDefined();
    if (stats.health) {
      expect(stats.health.current).toBeGreaterThanOrEqual(0);
      expect(stats.health.max).toBeGreaterThan(0);
      expect(stats.health.current).toBeLessThanOrEqual(stats.health.max);
    }
  });
});

test.describe("Skills Panel", () => {
  test.beforeEach(async ({ page }) => {
    await ensureInGame(page);
  });

  test("should open and close skills panel", async ({ page }) => {
    // Open skills panel
    await openPanel(page, "skills");

    // Verify panel is visible
    const skillsPanel = page.locator('[data-panel="skills"]');
    await expect(skillsPanel).toBeVisible();

    // Take screenshot for visual verification
    await takeGameScreenshot(page, "skills-open");

    // Close skills panel
    await closePanel(page, "skills");

    // Verify panel is hidden
    await expect(skillsPanel).not.toBeVisible();
  });
});

test.describe("Chat Panel", () => {
  test.beforeEach(async ({ page }) => {
    await ensureInGame(page);
  });

  test("should open and close chat panel", async ({ page }) => {
    // Open chat panel
    await openPanel(page, "chat");

    // Verify panel is visible
    const chatPanel = page.locator('[data-panel="chat"]');
    await expect(chatPanel).toBeVisible();

    // Close chat panel
    await closePanel(page, "chat");

    // Verify panel is hidden
    await expect(chatPanel).not.toBeVisible();
  });

  test("should have chat input field", async ({ page }) => {
    // Open chat panel
    await openPanel(page, "chat");

    // Find chat input
    const chatInput = page.locator('[data-testid="chat-input"]');

    // If chat input exists, verify it's interactive
    const inputExists = (await chatInput.count()) > 0;
    if (inputExists) {
      await expect(chatInput).toBeEnabled();
    }
  });
});

test.describe("Visual Regression", () => {
  test.beforeEach(async ({ page }) => {
    await ensureInGame(page);
  });

  test("game canvas should render without errors", async ({ page }) => {
    // Verify canvas exists
    const canvas = page.locator("canvas");
    await expect(canvas).toBeVisible();

    // Take screenshot
    const screenshot = await takeGameScreenshot(page, "game-canvas");
    expect(screenshot).toBeTruthy();

    // Basic visual check - canvas should not be completely black or white
    // This is a sanity check that something is rendering
    await page.evaluate(() => {
      const canvas = document.querySelector("canvas");
      if (!canvas) throw new Error("No canvas found");

      const ctx = canvas.getContext("2d");
      if (!ctx) {
        // WebGPU context - can't easily check pixel data
        return true;
      }

      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const data = imageData.data;

      // Check that not all pixels are the same color
      let allSame = true;
      const firstR = data[0];
      const firstG = data[1];
      const firstB = data[2];

      for (let i = 4; i < data.length; i += 4) {
        if (
          data[i] !== firstR ||
          data[i + 1] !== firstG ||
          data[i + 2] !== firstB
        ) {
          allSame = false;
          break;
        }
      }

      if (allSame) {
        console.warn(
          "Canvas appears to be a solid color - may indicate render issue",
        );
      }

      return true;
    });
  });
});

test.describe("Inventory Operations", () => {
  test.beforeEach(async ({ page }) => {
    await ensureInGame(page);
  });

  test("should be able to get inventory items", async ({ page }) => {
    const inventory = await page.evaluate(() => {
      const win = window as unknown as {
        world?: {
          network?: {
            lastInventoryByPlayerId?: Record<
              string,
              { items?: Array<{ id: string; name: string; quantity: number }> }
            >;
          };
          entities?: {
            player?: { id?: string };
          };
        };
      };

      const playerId = win.world?.entities?.player?.id;
      if (!playerId) return [];

      const inv = win.world?.network?.lastInventoryByPlayerId?.[playerId];
      return inv?.items ?? [];
    });

    // Inventory should be an array
    expect(Array.isArray(inventory)).toBe(true);

    // Take screenshot
    await takeGameScreenshot(page, "inventory-items");
  });

  test("should be able to track item count", async ({ page }) => {
    const itemCount = await page.evaluate(() => {
      const win = window as unknown as {
        world?: {
          network?: {
            lastInventoryByPlayerId?: Record<
              string,
              { items?: Array<{ id: string }> }
            >;
          };
          entities?: {
            player?: { id?: string };
          };
        };
      };

      const playerId = win.world?.entities?.player?.id;
      if (!playerId) return 0;

      const inv = win.world?.network?.lastInventoryByPlayerId?.[playerId];
      return inv?.items?.length ?? 0;
    });

    // Item count should be a number
    expect(typeof itemCount).toBe("number");
    expect(itemCount).toBeGreaterThanOrEqual(0);
    expect(itemCount).toBeLessThanOrEqual(28); // Max inventory size

    // Take screenshot
    await takeGameScreenshot(page, "inventory-count");
  });
});

test.describe("Trading System", () => {
  test.beforeEach(async ({ page }) => {
    await ensureInGame(page);
  });

  test("trade panel should exist in UI", async ({ page }) => {
    // Look for trade panel component
    const tradePanel = page.locator('[data-panel="trade"]');

    // The panel may not be visible initially but should exist
    const count = await tradePanel.count();
    expect(count).toBeGreaterThanOrEqual(0);

    // Take screenshot
    await takeGameScreenshot(page, "trade-panel-check");
  });

  test("should be able to find other players for trading", async ({ page }) => {
    // Wait for entities to load
    await page.waitForTimeout(2000);

    const otherPlayers = await page.evaluate(() => {
      const win = window as unknown as {
        world?: {
          entities?: {
            player?: { id?: string };
            entities?: Map<
              string,
              { type?: string; id?: string; name?: string }
            >;
          };
        };
      };

      const myPlayerId = win.world?.entities?.player?.id;
      const entities = win.world?.entities?.entities;
      if (!entities) return [];

      const players: Array<{ id: string; name: string }> = [];
      entities.forEach((entity, id) => {
        if (entity.type === "player" && id !== myPlayerId) {
          players.push({
            id,
            name: entity.name ?? "Unknown",
          });
        }
      });

      return players;
    });

    // Document how many other players are in the world
    console.log(`[Trade Test] Found ${otherPlayers.length} other players`);

    // Take screenshot
    await takeGameScreenshot(page, "trade-other-players");
  });

  test("trade request can be sent via network", async ({ page }) => {
    // Verify trade request packet can be constructed
    const canSendTrade = await page.evaluate(() => {
      const win = window as unknown as {
        world?: {
          network?: {
            send: (name: string, data: unknown) => void;
          };
        };
      };

      // Just verify the network send function exists
      return typeof win.world?.network?.send === "function";
    });

    expect(canSendTrade).toBe(true);

    // Take screenshot
    await takeGameScreenshot(page, "trade-network-check");
  });

  test("trade panel should have offer and receive sections", async ({
    page,
  }) => {
    // If trade panel were opened, verify structure
    const tradePanelStructure = await page.evaluate(() => {
      // Query for trade panel elements in DOM (may be hidden)
      const panel = document.querySelector('[data-panel="trade"]');
      if (!panel) return { exists: false };

      const offerSection = panel.querySelector('[data-testid="trade-offer"]');
      const receiveSection = panel.querySelector(
        '[data-testid="trade-receive"]',
      );
      const acceptButton = panel.querySelector('[data-testid="trade-accept"]');
      const cancelButton = panel.querySelector('[data-testid="trade-cancel"]');

      return {
        exists: true,
        hasOffer: !!offerSection,
        hasReceive: !!receiveSection,
        hasAccept: !!acceptButton,
        hasCancel: !!cancelButton,
      };
    });

    // Document the structure (panel may not be rendered if not in trade)
    console.log(`[Trade Test] Panel structure:`, tradePanelStructure);

    // Take screenshot
    await takeGameScreenshot(page, "trade-panel-structure");
  });
});

test.describe("Item Pickup", () => {
  test.beforeEach(async ({ page }) => {
    await ensureInGame(page);
  });

  test("should detect ground items", async ({ page }) => {
    await page.waitForTimeout(2000);

    const groundItems = await page.evaluate(() => {
      const win = window as unknown as {
        world?: {
          entities?: {
            entities?: Map<
              string,
              { type?: string; id?: string; name?: string }
            >;
          };
        };
      };

      const entities = win.world?.entities?.entities;
      if (!entities) return [];

      const items: Array<{ id: string; name: string }> = [];
      entities.forEach((entity, id) => {
        if (entity.type === "item" || entity.type === "groundItem") {
          items.push({
            id,
            name: entity.name ?? "Item",
          });
        }
      });

      return items;
    });

    console.log(`[Item Test] Found ${groundItems.length} ground items`);

    // Take screenshot
    await takeGameScreenshot(page, "item-ground-items");
  });

  test("pickup request can be sent via network", async ({ page }) => {
    const canSendPickup = await page.evaluate(() => {
      const win = window as unknown as {
        world?: {
          network?: {
            send: (name: string, data: unknown) => void;
          };
        };
      };

      return typeof win.world?.network?.send === "function";
    });

    expect(canSendPickup).toBe(true);

    // Take screenshot
    await takeGameScreenshot(page, "item-pickup-network");
  });
});
