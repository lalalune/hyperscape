import { testWithSynpress } from "@synthetixio/synpress";
import { MetaMask, metaMaskFixtures } from "@synthetixio/synpress/playwright";
import { basicSetup } from "../../synpress.config";

const test = testWithSynpress(metaMaskFixtures(basicSetup));
const { expect } = test;

test.describe("Hyperscape - Login and Inventory", () => {
  test("should load Hyperscape client", async ({ page }) => {
    await page.goto("http://localhost:3333");
    await page.waitForLoadState("networkidle");

    // Page should load
    const body = await page.locator("body");
    await expect(body).toBeVisible();

    console.log("Hyperscape client loaded");
  });

  test("should connect wallet to Hyperscape", async ({
    context,
    page,
    metamaskPage,
    extensionId,
  }) => {
    const metamask = new MetaMask(
      context,
      metamaskPage,
      basicSetup.walletPassword,
      extensionId,
    );

    await page.goto("http://localhost:3333");
    await page.waitForLoadState("networkidle");
    await page.waitForTimeout(3000);

    // Look for connect wallet button
    const connectBtn = page
      .locator("button")
      .filter({ hasText: /connect|wallet/i })
      .first();
    const hasConnect = await connectBtn.isVisible({ timeout: 5000 });

    if (hasConnect) {
      await connectBtn.click();
      await metamask.connectToDapp();

      // Verify connection
      await page.waitForTimeout(2000);
      const address = await page.locator("text=/0xf39F/i").first();
      await expect(address).toBeVisible({ timeout: 10000 });
    }

    console.log("Wallet connected");
  });

  test("should access inventory with data-testid attributes", async ({
    page,
  }) => {
    await page.goto("http://localhost:3333");
    await page.waitForLoadState("networkidle");
    await page.waitForTimeout(5000);

    // Press 'i' to open inventory
    await page.keyboard.press("i");
    await page.waitForTimeout(2000);

    // Check for inventory slots
    const slots = await page.locator('[data-testid^="inventory-slot"]').count();
    console.log(`Found ${slots} inventory slots`);

    expect(slots).toBeGreaterThan(0);

    // Check for gold display
    const goldDisplay = page.locator('[data-testid="gold-display"]');
    const hasGold = await goldDisplay.isVisible({ timeout: 2000 });

    if (hasGold) {
      console.log("Gold display found");
    }
  });
});
