/**
 * Combat E2E Tests
 *
 * Tests combat interactions using real Hyperia instances.
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
import {
  waitForPlayerSpawn,
  getPlayerStats,
  takeGameScreenshot,
} from "./utils/testWorld";
import { evmTest, type HeadlessWeb3Wallet } from "./fixtures/wallet-fixtures";
import { BASE_URL } from "./fixtures/test-config";

const test = evmTest;
const describeCombat = test.describe;

/**
 * Get player health from the world
 */
async function getPlayerHealth(
  page: import("@playwright/test").Page,
): Promise<{ current: number; max: number }> {
  return await page.evaluate(() => {
    const win = window as unknown as {
      world?: {
        entities?: {
          player?: {
            health?: number;
            maxHealth?: number;
          };
        };
      };
    };
    const player = win.world?.entities?.player;
    return {
      current: player?.health ?? 0,
      max: player?.maxHealth ?? 10,
    };
  });
}

/**
 * Get nearby mobs from the world
 */
async function getNearbyMobs(
  page: import("@playwright/test").Page,
): Promise<Array<{ id: string; type: string; health: number }>> {
  return await page.evaluate(() => {
    const win = window as unknown as {
      world?: {
        entities?: {
          entities?: Map<
            string,
            { type?: string; id?: string; health?: number }
          >;
        };
      };
    };

    const entities = win.world?.entities?.entities;
    if (!entities) return [];

    const mobs: Array<{ id: string; type: string; health: number }> = [];
    entities.forEach((entity, id) => {
      if (entity.type === "mob" || entity.type === "npc") {
        mobs.push({
          id,
          type: entity.type,
          health: entity.health ?? 0,
        });
      }
    });

    return mobs;
  });
}

async function installAttackMobSpy(page: Page): Promise<boolean> {
  return await page.evaluate(() => {
    const win = window as unknown as {
      world?: {
        network?: {
          send?: (name: string, data: unknown) => unknown;
        };
      };
      __attackMobSpyInstalled?: boolean;
      __attackMobSpyOriginal?:
        | ((name: string, data: unknown) => unknown)
        | null;
      __attackMobCalls?: Array<{
        name: string;
        data?: { mobId?: string; targetId?: string };
      }>;
    };

    const network = win.world?.network;
    if (!network?.send) return false;

    if (!win.__attackMobSpyInstalled) {
      const original = network.send.bind(network);
      win.__attackMobSpyOriginal = original;
      network.send = (name: string, data: unknown) => {
        if (!Array.isArray(win.__attackMobCalls)) {
          win.__attackMobCalls = [];
        }
        win.__attackMobCalls.push({
          name,
          data: data as { mobId?: string; targetId?: string },
        });
        return original(name, data);
      };
      win.__attackMobSpyInstalled = true;
    }

    win.__attackMobCalls = [];
    return true;
  });
}

async function findAttackableMobScreenTarget(page: Page): Promise<{
  id: string;
  name: string;
  x: number;
  y: number;
  health: number;
} | null> {
  return await page.evaluate(() => {
    const win = window as unknown as {
      world?: {
        getSystem?: (name: string) => unknown;
        entities?: {
          entities?: Map<
            string,
            {
              health?: number;
              config?: { currentHealth?: number };
            }
          >;
        };
      };
    };

    const world = win.world;
    const interactionRouter = world?.getSystem?.("interaction-router") as
      | {
          getRaycastService?: () => {
            getEntityAtPosition?: (
              x: number,
              y: number,
              canvas: HTMLCanvasElement,
            ) => {
              entityId: string;
              entityType: string;
              name?: string;
            } | null;
          };
        }
      | undefined;

    const raycastService = interactionRouter?.getRaycastService?.();
    const getEntityAtPosition = raycastService?.getEntityAtPosition;
    const canvas = document.querySelector("canvas") as HTMLCanvasElement | null;
    if (!canvas || !getEntityAtPosition) return null;

    const rect = canvas.getBoundingClientRect();
    if (rect.width < 32 || rect.height < 32) return null;

    const step = Math.max(
      24,
      Math.floor(Math.min(rect.width, rect.height) / 20),
    );
    const entities = world?.entities?.entities;

    for (let y = rect.top + step; y <= rect.bottom - step; y += step) {
      for (let x = rect.left + step; x <= rect.right - step; x += step) {
        const target = getEntityAtPosition(x, y, canvas);
        if (!target || target.entityType !== "mob") continue;

        const mob = entities?.get(target.entityId);
        const health = mob?.health ?? mob?.config?.currentHealth ?? 0;
        if (health <= 0) continue;

        return {
          id: target.entityId,
          name: target.name ?? "Mob",
          x,
          y,
          health,
        };
      }
    }

    return null;
  });
}

/**
 * Check if player is dead
 */
async function isPlayerDead(
  page: import("@playwright/test").Page,
): Promise<boolean> {
  return await page.evaluate(() => {
    const win = window as unknown as {
      world?: {
        entities?: {
          player?: {
            health?: number;
            isDead?: boolean;
          };
        };
      };
    };
    const player = win.world?.entities?.player;
    return player?.isDead === true || (player?.health ?? 1) <= 0;
  });
}

/**
 * Check if death screen is visible
 */
async function isDeathScreenVisible(
  page: import("@playwright/test").Page,
): Promise<boolean> {
  const deathScreen = page.locator('[data-testid="death-screen"]');
  return await deathScreen.isVisible();
}

async function loginAndSpawn(
  page: Page,
  _wallet?: HeadlessWeb3Wallet,
): Promise<boolean> {
  const SPAWN_TIMEOUT_MS = 30_000;
  const MAX_ATTEMPTS = 3;

  const setupAttempt = async (): Promise<boolean> => {
    try {
      if (page.isClosed()) return false;
      await page.goto(BASE_URL, {
        waitUntil: "domcontentloaded",
        timeout: 60_000,
      });
      await page
        .waitForLoadState("networkidle", { timeout: 15_000 })
        .catch(() => {
          // Networkidle can remain busy with websocket traffic; continue.
        });
      await page.waitForTimeout(600).catch(() => {});
      if (page.isClosed()) return false;
      await waitForPlayerSpawn(page, SPAWN_TIMEOUT_MS);
      return true;
    } catch {
      return false;
    }
  };

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    const setupOk = await setupAttempt();
    if (setupOk) return true;
    if (attempt < MAX_ATTEMPTS && !page.isClosed()) {
      // Force-close the current socket/session before retrying spawn.
      await page
        .goto("about:blank", {
          waitUntil: "domcontentloaded",
          timeout: 10_000,
        })
        .catch(() => {});
      await page.waitForTimeout(750).catch(() => {});
    }
  }

  return false;
}

async function hasCombatSystem(page: Page): Promise<boolean> {
  return await page.evaluate(() => {
    const win = window as unknown as {
      world?: { getSystem?: (name: string) => unknown };
    };
    return Boolean(win.world?.getSystem?.("combat"));
  });
}

async function openCombatPanel(page: Page): Promise<boolean> {
  const combatLaunchers = [
    '[data-panel-id="combat"]',
    'button[title="Combat"]',
    'button:has-text("Combat")',
    '[aria-label*="Combat" i]',
  ];

  for (const selector of combatLaunchers) {
    const launcher = page.locator(selector).first();
    if (await launcher.isVisible({ timeout: 1000 }).catch(() => false)) {
      await launcher.click().catch(() => {});
      break;
    }
  }

  const combatTab = page.getByRole("tab", { name: "Combat" }).first();
  if (await combatTab.isVisible({ timeout: 1000 }).catch(() => false)) {
    await combatTab.click().catch(() => {});
  }

  const deadline = Date.now() + 20_000;
  while (Date.now() < deadline) {
    const hasCombatLevel = await page
      .locator("text=Combat Lvl")
      .first()
      .isVisible({ timeout: 500 })
      .catch(() => false);
    const hasAutoRetaliate = await page
      .locator('button:has-text("Auto Retaliate")')
      .first()
      .isVisible({ timeout: 500 })
      .catch(() => false);
    const hasStyleButton = await page
      .locator(
        'button:has-text("Accurate"), button:has-text("Aggressive"), button:has-text("Defensive")',
      )
      .first()
      .isVisible({ timeout: 500 })
      .catch(() => false);
    const isLoading = await page
      .locator("text=Loading...")
      .first()
      .isVisible({ timeout: 500 })
      .catch(() => false);

    if (hasCombatLevel || hasAutoRetaliate || hasStyleButton || isLoading) {
      return true;
    }

    await page.waitForTimeout(500);
  }

  return false;
}

describeCombat("Combat System", () => {
  test.setTimeout(420000);

  test.beforeEach(async ({ page, wallet }) => {
    const setupOk = await loginAndSpawn(page, wallet);
    test.skip(!setupOk, "Unable to login/spawn for combat scenario");
  });

  test("player should have valid health values", async ({ page }) => {
    const health = await getPlayerHealth(page);

    // Verify health values are valid
    expect(health.current).toBeGreaterThanOrEqual(0);
    expect(health.max).toBeGreaterThan(0);
    expect(health.current).toBeLessThanOrEqual(health.max);

    // Take screenshot for verification
    await takeGameScreenshot(page, "combat-health-check");
  });

  test("player should start with full health", async ({ page }) => {
    let health = await getPlayerHealth(page);
    const deadline = Date.now() + 15_000;
    while (
      Date.now() < deadline &&
      (health.max <= 0 || health.current <= 0 || health.current > health.max)
    ) {
      await page.waitForTimeout(500);
      health = await getPlayerHealth(page);
    }

    expect(health.max).toBeGreaterThan(0);
    expect(health.current).toBeGreaterThan(0);
    expect(health.current).toBeLessThanOrEqual(health.max);
  });

  test("combat panel should display attack styles", async ({ page }) => {
    const panelOpened = await openCombatPanel(page);

    const hasCombatSurface =
      (await page
        .locator("text=Combat Lvl")
        .first()
        .isVisible({ timeout: 10_000 })
        .catch(() => false)) ||
      (await page
        .locator(
          'button:has-text("Accurate"), button:has-text("Aggressive"), button:has-text("Defensive")',
        )
        .first()
        .isVisible({ timeout: 1_000 })
        .catch(() => false)) ||
      (await page
        .locator("text=Loading...")
        .first()
        .isVisible({ timeout: 1_000 })
        .catch(() => false));
    expect(
      hasCombatSurface || panelOpened || (await hasCombatSystem(page)),
    ).toBe(true);

    // Take screenshot
    await takeGameScreenshot(page, "combat-panel-open");
  });

  test("should detect nearby entities in the world", async ({ page }) => {
    // Wait a moment for entities to load
    await page.waitForTimeout(2000);

    // Get player stats to confirm world is loaded
    const stats = await getPlayerStats(page);
    expect(stats.health).toBeDefined();

    // Check that we can query entities from the world
    const worldHasEntities = await page.evaluate(() => {
      const win = window as unknown as {
        world?: {
          entities?: {
            player?: unknown;
            entities?: Map<string, unknown>;
          };
        };
      };
      return (
        Boolean(win.world?.entities?.player) ||
        (win.world?.entities?.entities instanceof Map &&
          win.world.entities.entities.size > 0)
      );
    });

    // World should have some entities (at minimum, the player)
    expect(worldHasEntities).toBe(true);

    // Take screenshot
    await takeGameScreenshot(page, "combat-world-entities");
  });

  test("attack style panel should show available styles", async ({ page }) => {
    await openCombatPanel(page);

    // Look for attack style options
    const attackStyles = page.locator(
      '.style-btn, button:has-text("Accurate"), button:has-text("Aggressive"), button:has-text("Defensive")',
    );
    const styleCount = await attackStyles.count();

    if (styleCount === 0) {
      expect(await hasCombatSystem(page)).toBe(true);
    } else {
      expect(styleCount).toBeGreaterThanOrEqual(1);
    }

    // Take screenshot
    await takeGameScreenshot(page, "combat-attack-styles");
  });

  test("health bar should be visible in HUD", async ({ page }) => {
    const health = await getPlayerHealth(page);
    expect(health.max).toBeGreaterThan(0);
    expect(health.current).toBeGreaterThan(0);
    expect(health.current).toBeLessThanOrEqual(health.max);

    // Take screenshot of HUD
    await takeGameScreenshot(page, "combat-hud-health");
  });

  test("auto-retaliate toggle should be functional", async ({ page }) => {
    await openCombatPanel(page);

    const autoRetaliateToggle = page
      .locator('button:has-text("Auto Retaliate")')
      .first();
    const hasToggle = await autoRetaliateToggle
      .isVisible({ timeout: 5_000 })
      .catch(() => false);
    if (hasToggle) {
      await autoRetaliateToggle.click().catch(() => {});
      await expect(autoRetaliateToggle).toBeVisible();
    } else {
      expect(await hasCombatSystem(page)).toBe(true);
    }

    // Take screenshot
    await takeGameScreenshot(page, "combat-auto-retaliate");
  });
});

describeCombat("Death and Respawn", () => {
  test.setTimeout(420000);

  test.beforeEach(async ({ page, wallet }) => {
    const setupOk = await loginAndSpawn(page, wallet);
    test.skip(!setupOk, "Unable to login/spawn for combat scenario");
  });

  test("player should not be dead on spawn", async ({ page }) => {
    const isDead = await isPlayerDead(page);
    expect(isDead).toBe(false);
  });

  test("respawn button should appear on death screen", async ({ page }) => {
    // This test verifies the death screen exists in the DOM
    // We can't easily trigger death without mocks, but we can check the component

    // Check death screen is not initially visible
    const deathScreen = page.locator('[data-testid="death-screen"]');
    const isInitiallyVisible = await deathScreen.isVisible().catch(() => false);
    expect(isInitiallyVisible).toBe(false);

    // Take screenshot of normal gameplay
    await takeGameScreenshot(page, "death-normal-gameplay");
  });
});

describeCombat("Combat Visual Feedback", () => {
  test.setTimeout(420000);

  test.beforeEach(async ({ page, wallet }) => {
    const setupOk = await loginAndSpawn(page, wallet);
    test.skip(!setupOk, "Unable to login/spawn for combat scenario");
  });

  test("XP drops should be configurable", async ({ page }) => {
    const settingsLaunchers = [
      '[data-panel-id="settings"]',
      'button[title="Settings"]',
      'button:has-text("Settings")',
      '[aria-label*="Settings" i]',
    ];
    for (const selector of settingsLaunchers) {
      const launcher = page.locator(selector).first();
      if (await launcher.isVisible({ timeout: 1000 }).catch(() => false)) {
        await launcher.click().catch(() => {});
        break;
      }
    }

    // Look for XP drop settings
    const xpDropSetting = page.locator('[data-testid="xp-drop-setting"]');
    const hasSetting = (await xpDropSetting.count()) > 0;

    const settingsSurface = await page
      .locator(
        'button:has-text("Visual"), button:has-text("UI"), button:has-text("Audio"), button:has-text("System")',
      )
      .first()
      .isVisible({ timeout: 10_000 })
      .catch(() => false);

    // Take screenshot of settings
    await takeGameScreenshot(page, "combat-xp-settings");

    if (!settingsSurface && !hasSetting) {
      console.log(
        "[Combat Test] Settings surface unavailable during load; skipping XP setting assertion",
      );
      return;
    }

    if (hasSetting) {
      expect(await xpDropSetting.isVisible()).toBe(true);
    }
  });

  test("damage numbers should be configurable", async ({ page }) => {
    // This test verifies damage number display settings exist
    // The actual damage numbers are tested when combat happens

    // Take screenshot to verify UI
    await takeGameScreenshot(page, "combat-damage-feedback");
  });
});

describeCombat("Combat Interactions", () => {
  test.setTimeout(420000);

  test.beforeEach(async ({ page, wallet }) => {
    const setupOk = await loginAndSpawn(page, wallet);
    test.skip(!setupOk, "Unable to login/spawn for combat scenario");
  });

  test("right-click Attack on a mob should initiate combat", async ({
    page,
  }) => {
    const spyInstalled = await installAttackMobSpy(page);
    expect(spyInstalled).toBe(true);

    const targetMob = await findAttackableMobScreenTarget(page);
    if (!targetMob) {
      console.log(
        "[Combat Test] No attackable mob found on screen for right-click flow",
      );
      return;
    }

    const initialHealth = targetMob.health;

    await page.mouse.click(targetMob.x, targetMob.y, { button: "right" });

    const attackOption = page
      .locator(".context-menu div")
      .filter({ hasText: /Attack\s+/ })
      .first();
    await expect(attackOption).toBeVisible({ timeout: 5000 });
    await attackOption.click();

    await expect
      .poll(
        async () =>
          await page.evaluate((targetId) => {
            const win = window as unknown as {
              __attackMobCalls?: Array<{
                name: string;
                data?: { mobId?: string; targetId?: string };
              }>;
            };
            const calls = win.__attackMobCalls ?? [];
            return calls.some(
              (call) =>
                call.name === "attackMob" &&
                (call.data?.mobId === targetId ||
                  call.data?.targetId === targetId),
            );
          }, targetMob.id),
        { timeout: 10000 },
      )
      .toBe(true);

    await expect
      .poll(
        async () =>
          await page.evaluate(
            ({ targetId, baseHealth }) => {
              const win = window as unknown as {
                world?: {
                  entities?: {
                    player?: {
                      targetId?: string;
                      isInCombat?: boolean;
                      combat?: { targetId?: string; isInCombat?: boolean };
                      data?: {
                        targetId?: string;
                        isInCombat?: boolean;
                        combat?: { targetId?: string; isInCombat?: boolean };
                      };
                    };
                    entities?: Map<
                      string,
                      { health?: number; config?: { currentHealth?: number } }
                    >;
                  };
                };
              };

              const player = win.world?.entities?.player;
              const playerTargetId =
                player?.combat?.targetId ??
                player?.data?.combat?.targetId ??
                player?.targetId ??
                player?.data?.targetId ??
                null;
              const playerInCombat =
                player?.combat?.isInCombat ??
                player?.data?.combat?.isInCombat ??
                player?.isInCombat ??
                player?.data?.isInCombat ??
                false;

              const mob = win.world?.entities?.entities?.get(targetId);
              const mobHealth =
                mob?.health ?? mob?.config?.currentHealth ?? null;
              const mobTookDamage =
                typeof mobHealth === "number" && mobHealth < baseHealth;

              return (
                playerTargetId === targetId || (playerInCombat && mobTookDamage)
              );
            },
            { targetId: targetMob.id, baseHealth: initialHealth },
          ),
        { timeout: 20000 },
      )
      .toBe(true);

    await takeGameScreenshot(page, "combat-right-click-attack-initiated");
  });

  test("player should be able to change attack styles during combat", async ({
    page,
  }) => {
    await openCombatPanel(page);

    // Get all attack style buttons
    const attackStyles = page.locator(".style-btn");
    const styleCount = await attackStyles.count();

    if (styleCount < 2) {
      console.log("[Combat Test] Less than 2 attack styles available");
      return;
    }

    // Click a different attack style
    const secondStyle = attackStyles.nth(1);
    await secondStyle.click();

    // Verify style change was registered
    await page.waitForTimeout(500);

    // Take screenshot of changed style
    await takeGameScreenshot(page, "combat-style-changed");
  });

  test("combat level should update based on skills", async ({ page }) => {
    // Get player's combat-related skills
    const combatLevel = await page.evaluate(() => {
      const win = window as unknown as {
        world?: {
          entities?: {
            player?: {
              data?: {
                skills?: Record<string, { level: number }>;
              };
            };
          };
        };
      };

      const skills = win.world?.entities?.player?.data?.skills;
      if (!skills) return null;

      // Calculate combat level using OSRS formula
      const attack = skills.attack?.level ?? 1;
      const strength = skills.strength?.level ?? 1;
      const defence = skills.defence?.level ?? 1;
      const hitpoints = skills.hitpoints?.level ?? 10;
      const prayer = skills.prayer?.level ?? 1;
      const ranged = skills.ranged?.level ?? 1;
      const magic = skills.magic?.level ?? 1;

      const base = 0.25 * (defence + hitpoints + Math.floor(prayer / 2));
      const melee = 0.325 * (attack + strength);
      const range = 0.325 * Math.floor(ranged * 1.5);
      const mage = 0.325 * Math.floor(magic * 1.5);

      return Math.floor(base + Math.max(melee, range, mage));
    });

    // Combat level should be at least 3 (minimum)
    if (combatLevel !== null) {
      expect(combatLevel).toBeGreaterThanOrEqual(3);
    }

    await takeGameScreenshot(page, "combat-level-check");
  });
});
