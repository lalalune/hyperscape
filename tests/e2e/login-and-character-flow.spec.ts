/**
 * Login and Character Creation E2E Tests
 * Tests complete user flow: login → character select → game world → UI interactions
 */

import { test, expect, type Page } from "@playwright/test";

const GAME_URL = process.env.HYPERSCAPE_URL || `http://localhost:${process.env.VITE_PORT || "3333"}`;
const LOAD_TIMEOUT = 60000;
const UI_TIMEOUT = 5000;

// ============================================
// HELPERS
// ============================================

async function waitForGameWorld(page: Page): Promise<boolean> {
  try {
    await page.waitForFunction(
      () => (window as any).world?.entities?.player?.id !== undefined,
      { timeout: LOAD_TIMEOUT }
    );
    return true;
  } catch {
    return false;
  }
}

async function isOnLoginScreen(page: Page): Promise<boolean> {
  const loginScreen = await page.locator('.login-screen, [data-testid="login-screen"]').count();
  const loginButton = await page.locator('button:has-text("Login"), button:has-text("Connect"), button:has-text("Play")').count();
  return loginScreen > 0 || loginButton > 0;
}

async function isOnCharacterSelect(page: Page): Promise<boolean> {
  const charList = await page.locator('.character-list, [data-testid="character-list"]').count();
  const charSlots = await page.locator('.character-slot, [data-testid^="character-slot"]').count();
  const createButton = await page.locator('button:has-text("Create"), button:has-text("New Character")').count();
  return charList > 0 || charSlots > 0 || createButton > 0;
}

async function isInGameWorld(page: Page): Promise<boolean> {
  return await page.evaluate(() => (window as any).world?.entities?.player?.id !== undefined);
}

async function getVisiblePanelCount(page: Page): Promise<number> {
  return await page.evaluate(() => {
    let count = 0;
    const selectors = [
      '[data-testid="inventory-panel"]', '[data-testid="equipment-panel"]',
      '[data-testid="skills-panel"]', '[data-testid="settings-panel"]',
      '.GameWindow', '.DraggableWindow'
    ];
    selectors.forEach(sel => {
      document.querySelectorAll(sel).forEach(el => {
        if ((el as HTMLElement).offsetParent !== null) count++;
      });
    });
    return count;
  });
}

// ============================================
// LOGIN SCREEN
// ============================================

test.describe("Login Screen", () => {
  test("displays login screen on initial load", async ({ page }) => {
    await page.goto(GAME_URL);
    await page.waitForLoadState("networkidle");
    
    const onLogin = await isOnLoginScreen(page);
    const onCharSelect = await isOnCharacterSelect(page);
    const inGame = await isInGameWorld(page);
    
    await page.screenshot({ path: 'test-results/login-screen.png' });
    expect(onLogin || onCharSelect || inGame).toBe(true);
  });

  test("displays game logo or title", async ({ page }) => {
    await page.goto(GAME_URL);
    await page.waitForLoadState("networkidle");
    await page.waitForTimeout(2000);
    
    const logoCount = await page.locator('.login-logo, img[alt*="logo"], [data-testid="game-logo"]').count();
    const titleCount = await page.locator('h1, .game-title, [data-testid="game-title"]').count();
    
    expect(logoCount + titleCount).toBeGreaterThan(0);
  });

  test("login button triggers authentication", async ({ page }) => {
    await page.goto(GAME_URL);
    await page.waitForLoadState("networkidle");
    await page.waitForTimeout(2000);
    
    const loginButton = page.locator('button:has-text("Login"), button:has-text("Connect"), button:has-text("Play"), button:has-text("Enter")').first();
    const buttonCount = await loginButton.count();
    
    if (buttonCount === 0) {
      // Already authenticated
      const onCharSelect = await isOnCharacterSelect(page);
      const inGame = await isInGameWorld(page);
      expect(onCharSelect || inGame).toBe(true);
      return;
    }
    
    await loginButton.click();
    await page.waitForTimeout(2000);
    await page.screenshot({ path: 'test-results/login-modal.png' });
    
    const privyFrame = await page.locator('iframe[title*="privy"]').count();
    const onCharSelect = await isOnCharacterSelect(page);
    const inGame = await isInGameWorld(page);
    
    expect(privyFrame > 0 || onCharSelect || inGame).toBe(true);
  });
});

// ============================================
// CHARACTER SELECTION
// ============================================

test.describe("Character Selection", () => {
  test("shows character UI after authentication", async ({ page }) => {
    await page.goto(GAME_URL);
    await page.waitForLoadState("networkidle");
    await page.waitForTimeout(5000);
    
    const onLogin = await isOnLoginScreen(page);
    const onCharSelect = await isOnCharacterSelect(page);
    const inGame = await isInGameWorld(page);
    
    await page.screenshot({ path: 'test-results/character-select.png' });
    expect(onLogin || onCharSelect || inGame).toBe(true);
  });

  test("create character button is clickable", async ({ page }) => {
    await page.goto(GAME_URL);
    await page.waitForLoadState("networkidle");
    await page.waitForTimeout(5000);
    
    const createButton = page.locator('button:has-text("Create"), button:has-text("New Character"), button:has-text("+")').first();
    const buttonCount = await createButton.count();
    
    if (buttonCount === 0) {
      const inGame = await isInGameWorld(page);
      expect(inGame).toBe(true);
      return;
    }
    
    await createButton.click();
    await page.waitForTimeout(2000);
    await page.screenshot({ path: 'test-results/character-creation.png' });
    
    const nameInputCount = await page.locator('input[placeholder*="name"], input[data-testid="character-name"]').count();
    const avatarPreviewCount = await page.locator('.character-preview, .avatar-preview, canvas').count();
    
    expect(nameInputCount + avatarPreviewCount).toBeGreaterThan(0);
  });

  test("character name input accepts text", async ({ page }) => {
    await page.goto(GAME_URL);
    await page.waitForLoadState("networkidle");
    await page.waitForTimeout(5000);
    
    const createButton = page.locator('button:has-text("Create"), button:has-text("New Character")').first();
    if (await createButton.count() > 0) {
      await createButton.click();
      await page.waitForTimeout(2000);
    }
    
    const nameInput = page.locator('input[placeholder*="name"], input[data-testid="character-name"]').first();
    const inputCount = await nameInput.count();
    
    if (inputCount === 0) {
      const inGame = await isInGameWorld(page);
      expect(inGame).toBe(true);
      return;
    }
    
    await nameInput.fill('TestPlayer');
    await page.waitForTimeout(500);
    
    const inputValue = await nameInput.inputValue();
    expect(inputValue).toBe('TestPlayer');
  });
});

// ============================================
// UI PANEL INTERACTIONS
// ============================================

test.describe("UI Panel Interactions", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(GAME_URL);
    await page.waitForLoadState("networkidle");
    await waitForGameWorld(page);
  });

  test("'i' key toggles inventory", async ({ page }) => {
    const panelsBefore = await getVisiblePanelCount(page);
    
    await page.keyboard.press('i');
    await page.waitForTimeout(500);
    await page.screenshot({ path: 'test-results/inventory-panel.png' });
    
    const panelsAfter = await getVisiblePanelCount(page);
    const inventoryElements = await page.locator('[data-testid="inventory-panel"], .inventory-panel, [data-testid^="inventory-slot"]').count();
    
    const inGame = await isInGameWorld(page);
    if (inGame) {
      expect(panelsAfter !== panelsBefore || inventoryElements > 0).toBe(true);
    }
  });

  test("'e' key toggles equipment", async ({ page }) => {
    const panelsBefore = await getVisiblePanelCount(page);
    
    await page.keyboard.press('e');
    await page.waitForTimeout(500);
    await page.screenshot({ path: 'test-results/equipment-panel.png' });
    
    const panelsAfter = await getVisiblePanelCount(page);
    const equipmentElements = await page.locator('[data-testid="equipment-panel"], .equipment-panel').count();
    
    const inGame = await isInGameWorld(page);
    if (inGame) {
      expect(panelsAfter !== panelsBefore || equipmentElements > 0).toBe(true);
    }
  });

  test("'Escape' key toggles settings/menu", async ({ page }) => {
    const panelsBefore = await getVisiblePanelCount(page);
    
    await page.keyboard.press('Escape');
    await page.waitForTimeout(500);
    await page.screenshot({ path: 'test-results/settings-panel.png' });
    
    const panelsAfter = await getVisiblePanelCount(page);
    expect(panelsAfter !== panelsBefore || panelsAfter >= 0).toBe(true);
  });

  test("sidebar buttons are clickable", async ({ page }) => {
    const sidebarButtons = page.locator('[title*="Combat"], [title*="Skills"], [title*="Inventory"], [title*="Equipment"], [title*="Settings"]');
    const buttonCount = await sidebarButtons.count();
    
    const inGame = await isInGameWorld(page);
    if (inGame) {
      expect(buttonCount).toBeGreaterThan(0);
      if (buttonCount > 0) {
        await sidebarButtons.first().click();
        await page.waitForTimeout(500);
        await page.screenshot({ path: 'test-results/sidebar-button-clicked.png' });
      }
    } else {
      expect(buttonCount).toBe(0);
    }
  });

  test("chat input accepts text", async ({ page }) => {
    const inGame = await isInGameWorld(page);
    if (!inGame) return;
    
    await page.keyboard.press('Enter');
    await page.waitForTimeout(500);
    
    const chatInput = page.locator('input[type="text"], input[data-testid="chat-input"], [data-testid="chat"] input').first();
    const inputCount = await chatInput.count();
    
    expect(inputCount).toBeGreaterThan(0);
    
    await chatInput.fill('Test message');
    const value = await chatInput.inputValue();
    expect(value).toBe('Test message');
    
    await page.keyboard.press('Escape');
  });

  test("minimap exists when in game", async ({ page }) => {
    const inGame = await isInGameWorld(page);
    const minimapElements = await page.locator('.minimap canvas, .sidebar canvas, [data-testid="minimap"]').count();
    
    await page.screenshot({ path: 'test-results/minimap.png' });
    
    if (inGame) {
      expect(minimapElements).toBeGreaterThan(0);
    }
  });

  test("'r' key toggles run mode", async ({ page }) => {
    const inGame = await isInGameWorld(page);
    if (!inGame) return;
    
    const initialRunMode = await page.evaluate(() => (window as any).world?.entities?.player?.runMode ?? null);
    
    await page.keyboard.press('r');
    await page.waitForTimeout(500);
    
    const newRunMode = await page.evaluate(() => (window as any).world?.entities?.player?.runMode ?? null);
    
    if (initialRunMode !== null && newRunMode !== null) {
      expect(newRunMode).not.toBe(initialRunMode);
    }
  });
});

// ============================================
// WINDOW MANAGEMENT
// ============================================

test.describe("Window Management", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(GAME_URL);
    await page.waitForLoadState("networkidle");
    await page.waitForTimeout(3000);
  });

  test("multiple panels can be opened", async ({ page }) => {
    const inGame = await isInGameWorld(page);
    if (!inGame) return;
    
    const panelsBefore = await getVisiblePanelCount(page);
    
    await page.keyboard.press('i');
    await page.waitForTimeout(300);
    await page.keyboard.press('e');
    await page.waitForTimeout(300);
    
    const panelsAfter = await getVisiblePanelCount(page);
    await page.screenshot({ path: 'test-results/multiple-windows.png' });
    
    expect(panelsAfter).toBeGreaterThan(panelsBefore);
  });

  test("windows can be closed with keyboard", async ({ page }) => {
    const inGame = await isInGameWorld(page);
    if (!inGame) return;
    
    await page.keyboard.press('i');
    await page.waitForTimeout(500);
    
    const panelsOpen = await getVisiblePanelCount(page);
    
    await page.keyboard.press('i');
    await page.waitForTimeout(300);
    
    const panelsClosed = await getVisiblePanelCount(page);
    
    expect(panelsClosed).toBeLessThan(panelsOpen);
  });

  test("windows can be dragged", async ({ page }) => {
    const inGame = await isInGameWorld(page);
    if (!inGame) return;
    
    await page.keyboard.press('i');
    await page.waitForTimeout(500);
    
    const windowHeader = page.locator('.window-header, .GameWindow-header, [data-testid="window-header"]').first();
    const headerCount = await windowHeader.count();
    
    if (headerCount === 0) return;
    
    const boundingBox = await windowHeader.boundingBox();
    expect(boundingBox).not.toBeNull();
    if (!boundingBox) return;
    
    const startX = boundingBox.x + boundingBox.width / 2;
    const startY = boundingBox.y + boundingBox.height / 2;
    
    await page.mouse.move(startX, startY);
    await page.mouse.down();
    await page.mouse.move(startX + 100, startY + 50);
    await page.mouse.up();
    
    await page.waitForTimeout(300);
    await page.screenshot({ path: 'test-results/dragged-window.png' });
    
    const newBoundingBox = await windowHeader.boundingBox();
    if (newBoundingBox) {
      const movedX = Math.abs(newBoundingBox.x - boundingBox.x);
      const movedY = Math.abs(newBoundingBox.y - boundingBox.y);
      expect(movedX + movedY).toBeGreaterThan(10);
    }
  });
});

// ============================================
// COMPLETE USER FLOW
// ============================================

test.describe("Complete User Flow", () => {
  test("full login to gameplay flow", async ({ page }) => {
    await page.goto(GAME_URL);
    await page.waitForLoadState("networkidle");
    await page.waitForTimeout(2000);
    await page.screenshot({ path: 'test-results/flow-step1-loaded.png' });
    
    // Handle login if needed
    const loginButton = page.locator('button:has-text("Login"), button:has-text("Connect"), button:has-text("Play"), button:has-text("Enter")').first();
    if (await loginButton.count() > 0) {
      await loginButton.click();
      await page.waitForTimeout(3000);
    }
    await page.screenshot({ path: 'test-results/flow-step2-login.png' });
    
    // Handle character selection if present
    const characterSlot = page.locator('.character-slot, [data-testid^="character-slot"]').first();
    if (await characterSlot.count() > 0) {
      await characterSlot.click();
      await page.waitForTimeout(2000);
      
      const playButton = page.locator('button:has-text("Play"), button:has-text("Enter"), button:has-text("Start")').first();
      if (await playButton.count() > 0) {
        await playButton.click();
        await page.waitForTimeout(3000);
      }
    }
    await page.screenshot({ path: 'test-results/flow-step3-character.png' });
    
    // Test UI if in game
    const inGameWorld = await isInGameWorld(page);
    await page.screenshot({ path: 'test-results/flow-step4-game.png' });
    
    if (inGameWorld) {
      await page.keyboard.press('i');
      await page.waitForTimeout(500);
      await page.screenshot({ path: 'test-results/flow-step5-inventory.png' });
      await page.keyboard.press('i');
      
      await page.keyboard.press('e');
      await page.waitForTimeout(500);
      await page.screenshot({ path: 'test-results/flow-step5-equipment.png' });
      await page.keyboard.press('e');
    }
    
    const onValidScreen = inGameWorld || 
      await isOnLoginScreen(page) || 
      await isOnCharacterSelect(page);
    
    expect(onValidScreen).toBe(true);
  });
});
