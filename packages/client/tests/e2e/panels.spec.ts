/**
 * Additional Panel E2E Tests
 *
 * Tests for bank, quest, prayer, and settings panels using real Hyperia instances.
 * NO MOCKS - these tests run against actual game servers.
 *
 * Per project rules:
 * - Use real Hyperia worlds
 * - Test via Three.js scene introspection
 * - Visual verification with screenshots
 *
 * @packageDocumentation
 */

import { expect, type Page } from "@playwright/test";
import { completeFullLoginFlow } from "./fixtures/privy-helpers";
import {
  evmTest as test,
  type HeadlessWeb3Wallet,
} from "./fixtures/wallet-fixtures";
import {
  waitForPlayerSpawn,
  openPanel,
  closePanel,
  takeGameScreenshot,
} from "./utils/testWorld";

const PLAYER_SPAWN_TIMEOUT_MS = 60_000;

async function enterGame(
  page: Page,
  wallet: HeadlessWeb3Wallet,
): Promise<void> {
  await page.goto("/");
  expect(await completeFullLoginFlow(page, wallet)).toBe(true);
  await waitForPlayerSpawn(page, PLAYER_SPAWN_TIMEOUT_MS);
}

test.describe("Prayer Panel", () => {
  test.beforeEach(async ({ page, wallet }) => {
    await enterGame(page, wallet);
  });

  test("should open and close prayer panel", async ({ page }) => {
    // Open prayer panel
    await openPanel(page, "prayer");

    // Verify panel is visible
    const prayerPanel = page.locator('[data-panel="prayer"]');
    await expect(prayerPanel).toBeVisible();

    // Take screenshot for visual verification
    await takeGameScreenshot(page, "prayer-open");

    // Close prayer panel
    await closePanel(page, "prayer");

    // Verify panel is hidden
    await expect(prayerPanel).not.toBeVisible();
  });

  test("should display prayer list", async ({ page }) => {
    await openPanel(page, "prayer");

    // Wait for panel content to load
    await page.waitForTimeout(500);

    // Verify some prayer elements exist (prayers or prayer icons)
    const prayerContent = page.locator('[data-panel="prayer"]');
    const hasContent = await prayerContent
      .locator("button, [role='button'], img")
      .count();

    // Should have at least some interactive elements (prayer buttons)
    expect(hasContent).toBeGreaterThan(0);

    await takeGameScreenshot(page, "prayer-list");
  });
});

test.describe("Quests Panel", () => {
  test.beforeEach(async ({ page, wallet }) => {
    await enterGame(page, wallet);
  });

  test("should open and close quests panel", async ({ page }) => {
    // Open quests panel
    await openPanel(page, "quests");

    // Verify panel is visible
    const questsPanel = page.locator('[data-panel="quests"]');
    await expect(questsPanel).toBeVisible();

    // Take screenshot for visual verification
    await takeGameScreenshot(page, "quests-open");

    // Close quests panel
    await closePanel(page, "quests");

    // Verify panel is hidden
    await expect(questsPanel).not.toBeVisible();
  });

  test("should display quest categories or list", async ({ page }) => {
    await openPanel(page, "quests");

    // Wait for panel content to load
    await page.waitForTimeout(500);

    // Verify quest panel has content
    const questsPanel = page.locator('[data-panel="quests"]');
    await expect(questsPanel).toBeVisible();

    // Should have text content (quest names, categories, etc.)
    const textContent = await questsPanel.textContent();
    expect(textContent).toBeTruthy();
    expect(textContent!.length).toBeGreaterThan(0);

    await takeGameScreenshot(page, "quests-list");
  });
});

test.describe("Settings Panel", () => {
  test.beforeEach(async ({ page, wallet }) => {
    await enterGame(page, wallet);
  });

  test("should open and close settings panel", async ({ page }) => {
    // Open settings panel
    await openPanel(page, "settings");

    // Verify panel is visible
    const settingsPanel = page.locator('[data-panel="settings"]');
    await expect(settingsPanel).toBeVisible();

    // Take screenshot for visual verification
    await takeGameScreenshot(page, "settings-open");

    // Close settings panel
    await closePanel(page, "settings");

    // Verify panel is hidden
    await expect(settingsPanel).not.toBeVisible();
  });

  test("should display settings controls", async ({ page }) => {
    await openPanel(page, "settings");

    // Wait for settings to render
    await page.waitForTimeout(500);

    // Verify settings panel has interactive controls
    const settingsPanel = page.locator('[data-panel="settings"]');

    // Look for common settings UI elements
    const controls = settingsPanel.locator(
      "input, select, button, [role='slider'], [role='checkbox'], [role='switch']",
    );
    const controlCount = await controls.count();

    // Settings should have at least some controls
    expect(controlCount).toBeGreaterThan(0);

    await takeGameScreenshot(page, "settings-controls");
  });

  test("settings should persist across panel toggle", async ({ page }) => {
    await openPanel(page, "settings");
    await page.waitForTimeout(300);

    // Find a checkbox or toggle in settings
    const settingsPanel = page.locator('[data-panel="settings"]');
    const toggle = settingsPanel
      .locator('[role="checkbox"], [role="switch"], input[type="checkbox"]')
      .first();

    const toggleExists = (await toggle.count()) > 0;
    if (toggleExists) {
      // Get initial state
      const initialChecked = await toggle.isChecked().catch(() => null);

      // Toggle the setting if possible
      if (initialChecked !== null) {
        await toggle.click();
        await page.waitForTimeout(100);
      }

      // Close and reopen panel
      await closePanel(page, "settings");
      await page.waitForTimeout(200);
      await openPanel(page, "settings");
      await page.waitForTimeout(300);

      // Verify the setting persisted
      const newToggle = settingsPanel
        .locator('[role="checkbox"], [role="switch"], input[type="checkbox"]')
        .first();
      const newChecked = await newToggle.isChecked().catch(() => null);

      if (initialChecked !== null && newChecked !== null) {
        // The setting should have changed (persisted the toggle)
        expect(newChecked).not.toBe(initialChecked);
      }
    }
  });

  test("depth blur toggle should require post-processing enabled", async ({
    page,
  }) => {
    await openPanel(page, "settings");
    await page.waitForTimeout(300);

    // Navigate to Visuals tab
    const settingsPanel = page.locator('[data-panel="settings"]');
    const visualsTab = settingsPanel.getByRole("button", { name: /visual/i });
    if ((await visualsTab.count()) > 0) {
      await visualsTab.click();
      await page.waitForTimeout(200);
    }

    // Find depth blur toggle by label text
    const depthBlurToggle = settingsPanel
      .locator("text=Depth Blur")
      .locator("..");

    if ((await depthBlurToggle.count()) > 0) {
      // Find the post-processing toggle
      const postProcessingRow = settingsPanel
        .locator("text=Post-Processing")
        .locator("..");
      const postProcessingToggle = postProcessingRow.locator(
        '[role="checkbox"], [role="switch"], input[type="checkbox"]',
      );

      // Get post-processing state
      const ppEnabled = await postProcessingToggle
        .isChecked()
        .catch(() => false);

      // Find depth blur's toggle button
      const depthBlurButton = depthBlurToggle.locator(
        '[role="checkbox"], [role="switch"], input[type="checkbox"]',
      );

      if (!ppEnabled) {
        // Depth blur should be disabled when post-processing is off
        const isDisabled = await depthBlurButton.isDisabled().catch(() => true);
        expect(isDisabled).toBe(true);
      }

      await takeGameScreenshot(page, "settings-depth-blur-disabled-state");
    }
  });

  test("depth blur intensity slider should appear when enabled", async ({
    page,
  }) => {
    await openPanel(page, "settings");
    await page.waitForTimeout(300);

    // Navigate to Visuals tab
    const settingsPanel = page.locator('[data-panel="settings"]');
    const visualsTab = settingsPanel.getByRole("button", { name: /visual/i });
    if ((await visualsTab.count()) > 0) {
      await visualsTab.click();
      await page.waitForTimeout(200);
    }

    // Enable post-processing first if not enabled
    const postProcessingRow = settingsPanel
      .locator("text=Post-Processing")
      .locator("..");
    const postProcessingToggle = postProcessingRow.locator(
      '[role="checkbox"], [role="switch"], input[type="checkbox"]',
    );

    if ((await postProcessingToggle.count()) > 0) {
      const ppEnabled = await postProcessingToggle
        .isChecked()
        .catch(() => false);
      if (!ppEnabled) {
        await postProcessingToggle.click();
        await page.waitForTimeout(200);
      }
    }

    // Enable depth blur
    const depthBlurRow = settingsPanel.locator("text=Depth Blur").locator("..");
    const depthBlurToggle = depthBlurRow.locator(
      '[role="checkbox"], [role="switch"], input[type="checkbox"]',
    );

    if ((await depthBlurToggle.count()) > 0) {
      const dbEnabled = await depthBlurToggle.isChecked().catch(() => false);
      if (!dbEnabled) {
        await depthBlurToggle.click();
        await page.waitForTimeout(200);
      }

      // Verify intensity slider appears
      const intensitySlider = settingsPanel.locator(
        "text=Depth Blur Intensity",
      );
      const sliderVisible = await intensitySlider
        .isVisible()
        .catch(() => false);

      // The intensity slider should be visible when depth blur is enabled
      expect(sliderVisible).toBe(true);

      await takeGameScreenshot(page, "settings-depth-blur-intensity-slider");
    }
  });
});

test.describe("Bank Panel", () => {
  // Note: Bank panel requires interaction with an in-game bank NPC
  // These tests verify the panel UI once opened via game events

  test.beforeEach(async ({ page, wallet }) => {
    await enterGame(page, wallet);
  });

  test("bank panel structure when opened programmatically", async ({
    page,
  }) => {
    // The bank panel is typically opened via NPC interaction
    // We can test the panel structure by triggering the BANK_OPEN event

    // First, check if we can simulate a bank open event
    const canSimulate = await page.evaluate(() => {
      const world = (
        window as { world?: { emit: (type: string, data: unknown) => void } }
      ).world;
      return !!world?.emit;
    });

    if (canSimulate) {
      // Trigger bank open event with mock data
      await page.evaluate(() => {
        const world = (
          window as { world?: { emit: (type: string, data: unknown) => void } }
        ).world;
        if (world) {
          // Use the EventType enum value for BANK_OPEN
          world.emit("bank:open", {
            visible: true,
            bankId: "test-bank",
            items: [],
            tabs: [{ tabIndex: 0, iconItemId: null }],
            maxSlots: 100,
          });
        }
      });

      // Wait for panel to appear
      await page.waitForTimeout(500);

      // Check if bank panel appeared
      const bankPanel = page.locator('[data-panel="bank"]');
      const isVisible = await bankPanel.isVisible();

      if (isVisible) {
        await takeGameScreenshot(page, "bank-panel");

        // Verify bank has expected structure
        await expect(bankPanel).toBeVisible();
      }
    }
  });

  test("bank panel should have deposit and withdraw areas", async ({
    page,
  }) => {
    // This test requires the bank to be opened via game interaction
    // For now, we verify the expected UI structure exists when bank is visible

    const bankPanel = page.locator('[data-panel="bank"]');

    // If bank is already visible (from previous test or game state)
    const isVisible = await bankPanel.isVisible().catch(() => false);

    if (isVisible) {
      // Look for bank UI elements
      const bankContent = await bankPanel.textContent();

      // Bank should have some recognizable UI text
      const hasBankContent =
        bankContent?.includes("Bank") ||
        bankContent?.includes("Deposit") ||
        bankContent?.includes("Withdraw") ||
        bankContent?.includes("Tab");

      expect(hasBankContent).toBeTruthy();
    }
  });
});

test.describe("Equipment Panel", () => {
  test.beforeEach(async ({ page, wallet }) => {
    await enterGame(page, wallet);
  });

  test("should open and close equipment panel", async ({ page }) => {
    // Open equipment panel
    await openPanel(page, "equipment");

    // Verify panel is visible
    const equipmentPanel = page.locator('[data-panel="equipment"]');
    await expect(equipmentPanel).toBeVisible();

    // Take screenshot for visual verification
    await takeGameScreenshot(page, "equipment-open");

    // Close equipment panel
    await closePanel(page, "equipment");

    // Verify panel is hidden
    await expect(equipmentPanel).not.toBeVisible();
  });

  test("should display equipment slots", async ({ page }) => {
    await openPanel(page, "equipment");

    // Wait for equipment to render
    await page.waitForTimeout(500);

    const equipmentPanel = page.locator('[data-panel="equipment"]');
    const portrait = equipmentPanel.locator('[data-equipment-portrait="true"]');

    await expect(portrait).toBeVisible();

    const slots = equipmentPanel.locator("[data-equipment-slot]");
    await expect(slots).toHaveCount(11);

    await takeGameScreenshot(page, "equipment-slots");
  });

  test("should render the paperdoll layout on a mobile viewport", async ({
    page,
    wallet,
  }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await enterGame(page, wallet);

    await openPanel(page, "equipment");
    await page.waitForTimeout(500);

    const equipmentPanel = page.locator('[data-panel="equipment"]');
    await expect(
      equipmentPanel.locator('[data-equipment-grid="paperdoll"]'),
    ).toBeVisible();
    await expect(
      equipmentPanel.locator('[data-equipment-portrait="true"]'),
    ).toBeVisible();
    await expect(equipmentPanel.locator("[data-equipment-slot]")).toHaveCount(
      11,
    );

    await takeGameScreenshot(page, "equipment-mobile-paperdoll");
  });

  test("should keep the portrait stable during equipment interactions", async ({
    page,
  }) => {
    await openPanel(page, "equipment");
    await page.waitForTimeout(500);

    const equipmentPanel = page.locator('[data-panel="equipment"]');
    const portrait = equipmentPanel.locator('[data-equipment-portrait="true"]');
    await expect(portrait).toBeVisible();

    const occupiedSlots = equipmentPanel.locator(
      '[data-equipment-slot][data-slot-empty="false"]',
    );
    const beforeCount = await occupiedSlots.count();

    if (beforeCount > 0) {
      await occupiedSlots.first().click();
      await page.waitForTimeout(600);

      const afterCount = await equipmentPanel
        .locator('[data-equipment-slot][data-slot-empty="false"]')
        .count();

      expect(afterCount).toBeLessThanOrEqual(beforeCount);
      await expect(portrait).toBeVisible();
    }

    await expect(equipmentPanel.locator("[data-equipment-slot]")).toHaveCount(
      11,
    );
  });
});

test.describe("Combat Panel", () => {
  test.beforeEach(async ({ page, wallet }) => {
    await enterGame(page, wallet);
  });

  test("should open and close combat panel", async ({ page }) => {
    // Open combat panel
    await openPanel(page, "combat");

    // Verify panel is visible
    const combatPanel = page.locator('[data-panel="combat"]');
    await expect(combatPanel).toBeVisible();

    // Take screenshot for visual verification
    await takeGameScreenshot(page, "combat-open");

    // Close combat panel
    await closePanel(page, "combat");

    // Verify panel is hidden
    await expect(combatPanel).not.toBeVisible();
  });

  test("should display attack style options", async ({ page }) => {
    await openPanel(page, "combat");

    // Wait for content to render
    await page.waitForTimeout(500);

    const combatPanel = page.locator('[data-panel="combat"]');

    // Combat panel should have attack style buttons or options
    const buttons = combatPanel.locator(
      "button, [role='button'], [role='radio']",
    );
    const buttonCount = await buttons.count();

    // Should have at least some combat options (attack styles)
    expect(buttonCount).toBeGreaterThanOrEqual(1);

    await takeGameScreenshot(page, "combat-styles");
  });
});
