/**
 * Privy Login Helpers for Hyperia E2E Tests
 *
 * Hyperia auth flow:
 *   1. LoginScreen renders with "Enter" button
 *   2. Click "Enter" → Privy modal opens (wallet / email / google / farcaster)
 *   3. In Privy modal, "Continue with a wallet" → wallet list appears
 *   4. Click MetaMask (headless provider) → auto-approves eth_requestAccounts + personal_sign
 *   5. Privy authenticates → LoginScreen calls onAuthenticated()
 *   6. App transitions to UsernameSelection → CharacterSelect → Game
 *
 * For Solana:
 *   Same flow but select Phantom instead of MetaMask.
 *
 * These helpers interact with the actual Privy UI — no mocks.
 * The headless wallet providers handle the crypto operations.
 */

import type { Page } from "@playwright/test";
import type { HeadlessWeb3Wallet } from "./wallet-fixtures";

type FlowStage =
  | "initializing"
  | "login"
  | "username"
  | "character"
  | "game"
  | "unknown";

const LOGIN_ENTRY_SELECTORS =
  'button:text-is("Enter"), button:has-text("Enter"):not(:has-text("Enter World")), button:text-is("Sign In"), button:has-text("Sign In"), button:has-text("Sign in with Farcaster")';
const PRIVY_WALLET_ERROR_TEXT = "Could not log in with wallet";
const PRIVY_RETRY_SELECTORS =
  'button:has-text("Retry"), [role="button"]:has-text("Retry")';
const PRIVY_CLOSE_SELECTORS =
  'button[aria-label*="close" i], button:has-text("close modal"), button:has-text("Close")';

async function sleepSafely(page: Page, ms: number): Promise<boolean> {
  if (page.isClosed()) return false;
  try {
    await page.waitForTimeout(ms);
    return !page.isClosed();
  } catch {
    return false;
  }
}

async function isVisibleFast(
  page: Page,
  selector: string,
  timeoutMs: number = 300,
): Promise<boolean> {
  if (page.isClosed()) return false;
  return page
    .locator(selector)
    .first()
    .isVisible({ timeout: timeoutMs })
    .catch(() => false);
}

async function isPrivyWalletErrorVisible(
  page: Page,
  timeoutMs: number = 300,
): Promise<boolean> {
  if (page.isClosed()) return false;
  const textVisible = await page
    .locator(`text=${PRIVY_WALLET_ERROR_TEXT}`)
    .first()
    .isVisible({ timeout: timeoutMs })
    .catch(() => false);
  if (textVisible) return true;

  const retryVisible = await page
    .locator(PRIVY_RETRY_SELECTORS)
    .first()
    .isVisible({ timeout: timeoutMs })
    .catch(() => false);
  if (!retryVisible) return false;

  const dialogText = await page
    .locator('[role="dialog"]')
    .first()
    .textContent()
    .catch(() => "");
  return (dialogText || "")
    .toLowerCase()
    .includes("could not log in with wallet");
}

async function recoverPrivyWalletError(page: Page): Promise<boolean> {
  if (!(await isPrivyWalletErrorVisible(page, 400))) return false;

  console.log(
    "[connectEvmWalletViaPrivy] Privy wallet login failed; attempting recovery",
  );

  const retryButton = page.locator(PRIVY_RETRY_SELECTORS).first();
  if (await retryButton.isVisible({ timeout: 800 }).catch(() => false)) {
    await retryButton
      .click({ force: true })
      .catch(() => retryButton.click().catch(() => {}));
    await sleepSafely(page, 1000);
    return true;
  }

  const closeButton = page.locator(PRIVY_CLOSE_SELECTORS).first();
  if (await closeButton.isVisible({ timeout: 500 }).catch(() => false)) {
    await closeButton
      .click({ force: true })
      .catch(() => closeButton.click().catch(() => {}));
    await sleepSafely(page, 800);
    return true;
  }

  return false;
}

async function detectFlowStage(page: Page): Promise<FlowStage> {
  if (page.isClosed()) return "unknown";

  if (await isInGame(page)) return "game";

  const hasCharacterUI =
    (await isVisibleFast(page, 'button:has-text("Create New")')) ||
    (await isVisibleFast(page, 'button:has-text("Enter World")')) ||
    (await isVisibleFast(page, "text=No characters yet.")) ||
    (await isVisibleFast(page, 'button:has-text("Sign out")'));
  if (hasCharacterUI) return "character";

  const hasUsernameUI = await isVisibleFast(
    page,
    'input[placeholder*="username" i], input[name="username"], [data-testid="username-input"], button:has-text("Create Account")',
  );
  if (hasUsernameUI) return "username";

  const hasLoginUI = await isVisibleFast(page, LOGIN_ENTRY_SELECTORS, 1000);
  if (hasLoginUI) return "login";

  const hasInitializingUI =
    (await isVisibleFast(page, "text=Initializing...")) ||
    (await isVisibleFast(page, "text=Loading..."));
  if (hasInitializingUI) return "initializing";

  return "unknown";
}

async function waitForFlowStage(
  page: Page,
  stages: FlowStage | FlowStage[],
  timeoutMs: number,
): Promise<FlowStage | null> {
  const wanted = Array.isArray(stages) ? stages : [stages];
  const deadline = Date.now() + timeoutMs;

  while (Date.now() < deadline) {
    const stage = await detectFlowStage(page);
    if (wanted.includes(stage)) return stage;
    if (!(await sleepSafely(page, 400))) return null;
  }

  return null;
}

// =============================================================================
// AUTH STATE DETECTION
// =============================================================================

/**
 * Check if a wallet is connected (user is past the LoginScreen).
 * In Hyperia, the login screen has an "Enter" button.
 * If it's gone, the user is authenticated.
 */
export async function isWalletConnected(page: Page): Promise<boolean> {
  await sleepSafely(page, 600);

  const flowStage = await detectFlowStage(page);
  if (
    flowStage === "game" ||
    flowStage === "character" ||
    flowStage === "username"
  ) {
    return true;
  }
  if (flowStage === "login" || flowStage === "initializing") {
    return false;
  }

  // Check for the "Enter" button on the LoginScreen
  const enterButton = page.locator(LOGIN_ENTRY_SELECTORS).first();
  const enterVisible = await enterButton
    .isVisible({ timeout: 2000 })
    .catch(() => false);

  if (enterVisible) return false;

  // Also check for "Sign In" or login-related buttons
  const signInButton = page.locator('button:has-text("Sign In")').first();
  const signInVisible = await signInButton
    .isVisible({ timeout: 1000 })
    .catch(() => false);

  // Check if we are still loading (Privy init) - if so, we are NOT connected yet
  const loadingIndicator = page
    .locator("text=Loading..., [class*='loading'], [data-testid*='loading']")
    .first();
  const isLoading = await loadingIndicator
    .isVisible({ timeout: 500 })
    .catch(() => false);
  if (isLoading) return false;

  const hasPrivyToken = await page
    .evaluate(() => {
      try {
        return Boolean(
          localStorage.getItem("privy_auth_token") ||
          localStorage.getItem("privy_user_id"),
        );
      } catch {
        return false;
      }
    })
    .catch(() => false);

  // Avoid false positives while the app is booting and login UI hasn't rendered yet.
  if (!hasPrivyToken && !(await isInGame(page))) {
    return false;
  }

  return !signInVisible;
}

/**
 * Check if Privy SDK has initialized.
 * Useful for verifying the app is ready before attempting login.
 */
export async function isPrivyReady(page: Page): Promise<boolean> {
  return page.evaluate(() => {
    // Check for Privy initialization markers
    const win = window as unknown as Record<string, unknown>;

    // Privy stores state in various ways - check common indicators
    const hasPrivyRoot = document.querySelector("[id*='privy']") !== null;
    const hasPrivyIframe =
      document.querySelector("iframe[src*='privy']") !== null;

    return hasPrivyRoot || hasPrivyIframe;
  });
}

// =============================================================================
// EVM WALLET CONNECTION
// =============================================================================

/**
 * Connect EVM wallet via Privy in Hyperia.
 *
 * Flow: Click "Enter" → Privy modal → "Continue with a wallet" → MetaMask
 *
 * The headless-web3-provider is configured with AUTO_PERMIT_ALL, so it
 * auto-responds to eth_requestAccounts, personal_sign, etc.
 *
 * @param page - Playwright page
 * @param _wallet - HeadlessWeb3Wallet reference (auto-approves, but passed for type safety)
 */
export async function connectEvmWalletViaPrivy(
  page: Page,
  _wallet?: HeadlessWeb3Wallet,
  _attempt: number = 1,
): Promise<void> {
  const initialStage = await waitForFlowStage(
    page,
    ["login", "username", "character", "game"],
    60_000,
  );

  if (
    initialStage === "game" ||
    initialStage === "character" ||
    initialStage === "username"
  ) {
    console.log(
      `[connectEvmWalletViaPrivy] Already past login (${initialStage}), skipping`,
    );
    return;
  }

  // If already connected, nothing to do
  if (await isWalletConnected(page)) {
    console.log("[connectEvmWalletViaPrivy] Already connected, skipping");
    return;
  }

  const isPrivyWalletSurfaceVisible = async (): Promise<boolean> =>
    page
      .locator(
        'button:has-text("Continue with a wallet"), button:has-text("MetaMask"), button:has-text("Headless Web3 Provider"), button:has-text("Retry"), div[role="button"]:has-text("MetaMask"), div[role="button"]:has-text("Headless Web3 Provider"), [role="dialog"]',
      )
      .first()
      .isVisible({ timeout: 1000 })
      .catch(() => false);

  let modalAlreadyVisible = await isPrivyWalletSurfaceVisible();

  // Step 1: Click "Enter" on the Hyperia LoginScreen
  const enterButton = page.locator(LOGIN_ENTRY_SELECTORS).first();
  const enterVisible = await enterButton
    .isVisible({ timeout: 8000 })
    .catch(() => false);
  if (!enterVisible) {
    const hasEnterElement = (await enterButton.count().catch(() => 0)) > 0;
    if (!modalAlreadyVisible && hasEnterElement) {
      console.log(
        "[connectEvmWalletViaPrivy] Enter button exists but is not visible; forcing click",
      );
      await enterButton.click({ force: true }).catch(() => {});
      await sleepSafely(page, 1200);
      modalAlreadyVisible = await isPrivyWalletSurfaceVisible();
    }

    const currentStage = await detectFlowStage(page);
    if (
      currentStage === "character" ||
      currentStage === "username" ||
      currentStage === "game"
    ) {
      console.log(
        `[connectEvmWalletViaPrivy] Login screen already passed (${currentStage})`,
      );
      return;
    }
    if (!modalAlreadyVisible) {
      await sleepSafely(page, 1200);
      modalAlreadyVisible = await isPrivyWalletSurfaceVisible();
    }
    if (modalAlreadyVisible) {
      console.log(
        "[connectEvmWalletViaPrivy] Privy modal already visible without Enter button; continuing",
      );
    } else {
      console.log(
        "[connectEvmWalletViaPrivy] No Enter button found — may already be past login",
      );
      return;
    }
  }

  if (!modalAlreadyVisible) {
    console.log("[connectEvmWalletViaPrivy] Clicking Enter button...");
    try {
      await enterButton.click({ timeout: 3000 });
    } catch {
      // Occasionally a Privy portal overlay is already mounted and intercepts the click.
      await enterButton.click({ force: true, timeout: 3000 });
    }
    await page.waitForTimeout(2000);
  } else {
    console.log("[connectEvmWalletViaPrivy] Privy modal already visible");
  }

  // Step 2: Click "Continue with a wallet" in Privy modal
  const continueWithWalletSelectors = [
    'button:has-text("Continue with a wallet")',
    'button:has-text("Connect wallet")',
    'button:has-text("Wallet")',
    'div[role="button"]:has-text("Continue with a wallet")',
  ];

  let clickedContinue = false;
  for (const selector of continueWithWalletSelectors) {
    const btn = page.locator(selector).first();
    if (await btn.isVisible({ timeout: 3000 }).catch(() => false)) {
      console.log(
        `[connectEvmWalletViaPrivy] Clicking wallet option: ${selector}`,
      );
      await btn.click();
      clickedContinue = true;
      break;
    }
  }

  if (!clickedContinue) {
    console.log(
      "[connectEvmWalletViaPrivy] No 'Continue with wallet' button found — Privy may show wallets directly",
    );
  }

  await page.waitForTimeout(2000);

  // Step 3: Select wallet provider in Privy.
  // Prefer explicit headless wallet labels first, then MetaMask fallback.
  const walletSelectors = [
    'button:has-text("Headless Web3 Provider")',
    'div[role="button"]:has-text("Headless Web3 Provider")',
    'button:has-text("Headless Web3")',
    'div[role="button"]:has-text("Headless Web3")',
    'button:has-text("MetaMask")',
    'div[role="button"]:has-text("MetaMask")',
    '[data-testid*="metamask"]',
    'button:has-text("Browser Wallet")',
    'button:has-text("Injected")',
  ];

  let clickedWallet = false;
  let authCompleted = false;
  let walletErrorRecoveries = 0;
  for (let attempt = 0; attempt < 6 && !authCompleted; attempt++) {
    if (await recoverPrivyWalletError(page)) {
      walletErrorRecoveries++;
    }
    for (const selector of walletSelectors) {
      const option = page.locator(selector).first();
      if (!(await option.isVisible({ timeout: 1500 }).catch(() => false))) {
        continue;
      }

      console.log(`[connectEvmWalletViaPrivy] Clicking wallet: ${selector}`);
      await option.click({ force: true }).catch(() => option.click());
      clickedWallet = true;

      // If this wallet option doesn't complete auth, fall through to
      // try the next available provider in the modal.
      authCompleted = await waitForAuthCompletion(page, 25_000);
      if (authCompleted) break;

      if (await recoverPrivyWalletError(page)) {
        walletErrorRecoveries++;
        if (walletErrorRecoveries >= 6) {
          console.log(
            "[connectEvmWalletViaPrivy] Repeated Privy wallet login failures detected",
          );
        }
      }

      const stageAfterWalletClick = await detectFlowStage(page);
      if (
        stageAfterWalletClick === "login" ||
        stageAfterWalletClick === "initializing" ||
        stageAfterWalletClick === "unknown"
      ) {
        const continueAgain = page
          .locator(
            'button:has-text("Continue with a wallet"), button:has-text("Connect wallet"), button:has-text("Wallet"), div[role="button"]:has-text("Continue with a wallet")',
          )
          .first();
        if (
          await continueAgain.isVisible({ timeout: 1000 }).catch(() => false)
        ) {
          await continueAgain.click().catch(() => {});
          await sleepSafely(page, 800);
        }
      }
    }

    if (authCompleted) break;

    if (walletErrorRecoveries >= 6) {
      break;
    }

    if (await recoverPrivyWalletError(page)) {
      walletErrorRecoveries++;
    }

    // Recover from transient modal dismissals by reopening wallet picker.
    const enterAgain = page.locator(LOGIN_ENTRY_SELECTORS).first();
    if (await enterAgain.isVisible({ timeout: 500 }).catch(() => false)) {
      console.log(
        `[connectEvmWalletViaPrivy] Wallet list missing (attempt ${attempt + 1}), re-opening modal via Enter`,
      );
      await enterAgain.click({ force: true }).catch(() => {});
    }

    const continueAgain = page
      .locator(
        'button:has-text("Continue with a wallet"), button:has-text("Connect wallet"), button:has-text("Wallet"), div[role="button"]:has-text("Continue with a wallet")',
      )
      .first();
    if (await continueAgain.isVisible({ timeout: 1500 }).catch(() => false)) {
      await continueAgain.click().catch(() => {});
    }

    await sleepSafely(page, 1500);
  }

  if (!clickedWallet) {
    // Debug: log all visible buttons
    await page
      .screenshot({ path: "/tmp/hyperia-privy-wallet-debug.png" })
      .catch(() => {});
    const buttons = await page.locator("button, [role='button']").all();
    for (const btn of buttons.slice(0, 20)) {
      const text = (await btn.textContent().catch(() => ""))?.trim();
      if (text && text.length > 0 && text.length < 100) {
        console.log(`[connectEvmWalletViaPrivy] Visible button: "${text}"`);
      }
    }
    console.log(
      "[connectEvmWalletViaPrivy] No wallet option found in Privy modal",
    );
    if (_attempt < 2 && !page.isClosed()) {
      console.log(
        "[connectEvmWalletViaPrivy] Reloading and retrying wallet connection...",
      );
      await page.reload({ waitUntil: "domcontentloaded" }).catch(() => {});
      await sleepSafely(page, 1200);
      return connectEvmWalletViaPrivy(page, _wallet, _attempt + 1);
    }
    return;
  }

  if (authCompleted) {
    return;
  }

  console.log(
    "[connectEvmWalletViaPrivy] Wallet click did not complete auth, attempting one reload retry...",
  );
  if (_attempt < 2 && !page.isClosed()) {
    console.log(
      "[connectEvmWalletViaPrivy] Auth not completed after wallet click, reloading and retrying once...",
    );
    await page.reload({ waitUntil: "domcontentloaded" }).catch(() => {});
    await sleepSafely(page, 1200);
    await connectEvmWalletViaPrivy(page, _wallet, _attempt + 1);
  }
}

// =============================================================================
// SOLANA WALLET CONNECTION
// =============================================================================

/**
 * Connect Solana wallet (Phantom) via Privy in Hyperia.
 *
 * Flow: Click "Enter" → Privy modal → "Continue with a wallet" → Phantom
 *
 * The Phantom mock is already injected via addInitScript and auto-handles
 * connect() and signMessage() operations.
 *
 * @param page - Playwright page
 */
export async function connectSolanaWalletViaPrivy(page: Page): Promise<void> {
  if (await isWalletConnected(page)) {
    console.log("[connectSolanaWalletViaPrivy] Already connected, skipping");
    return;
  }

  // Step 1: Click "Enter" on the Hyperia LoginScreen
  const enterButton = page.locator(LOGIN_ENTRY_SELECTORS).first();
  if (!(await enterButton.isVisible({ timeout: 8000 }).catch(() => false))) {
    console.log(
      "[connectSolanaWalletViaPrivy] No Enter button found — may already be past login",
    );
    return;
  }

  console.log("[connectSolanaWalletViaPrivy] Clicking Enter button...");
  await enterButton.click();
  await page.waitForTimeout(2000);

  // Step 2: Click "Continue with a wallet"
  const continueBtn = page
    .locator('button:has-text("Continue with a wallet")')
    .first();
  if (await continueBtn.isVisible({ timeout: 6000 }).catch(() => false)) {
    await continueBtn.click();
    await page.waitForTimeout(2000);
  }

  // Step 3: Click Phantom — Privy shows detected Phantom wallet
  const phantomOptions = await page
    .locator(
      'button:has-text("Phantom"), div[role="button"]:has-text("Phantom")',
    )
    .all();

  if (phantomOptions.length >= 2) {
    // If multiple Phantom entries, the last one is usually the "Solana" variant
    await phantomOptions[phantomOptions.length - 1].click();
  } else if (phantomOptions.length === 1) {
    await phantomOptions[0].click();
  } else {
    console.log(
      "[connectSolanaWalletViaPrivy] No Phantom option found in Privy modal",
    );
    return;
  }

  await page.waitForTimeout(2000);

  // Dismiss any intermediate modals
  const gotIt = page.locator('button:has-text("Got it")').first();
  if (await gotIt.isVisible({ timeout: 2000 }).catch(() => false)) {
    await gotIt.click();
    await page.waitForTimeout(500);
  }

  await waitForAuthCompletion(page);
}

// =============================================================================
// AUTH COMPLETION & POST-LOGIN FLOW
// =============================================================================

/**
 * Wait for Privy auth to complete and the LoginScreen to transition away.
 * After wallet connect, Hyperia goes through:
 *   LoginScreen → UsernameSelection (if new user) → CharacterSelect → Game
 *
 * This helper waits until the "Enter" button is gone, indicating successful auth.
 */
export async function waitForAuthCompletion(
  page: Page,
  timeoutMs: number = 60_000,
): Promise<boolean> {
  const deadline = Date.now() + timeoutMs;

  while (Date.now() < deadline) {
    if (page.isClosed()) return false;

    if (await isPrivyWalletErrorVisible(page, 250)) {
      console.log(
        "[waitForAuthCompletion] Privy reported wallet login error; auth incomplete",
      );
      return false;
    }

    const stage = await detectFlowStage(page);
    if (stage === "username" || stage === "character" || stage === "game") {
      console.log(
        `[waitForAuthCompletion] Auth completed — advanced to ${stage} stage`,
      );
      return true;
    }

    // Check if "Enter" button is gone (login complete)
    const enterGone = !(await page
      .locator(LOGIN_ENTRY_SELECTORS)
      .first()
      .isVisible({ timeout: 500 })
      .catch(() => false));

    if (enterGone) {
      console.log("[waitForAuthCompletion] Auth completed — Enter button gone");
      return true;
    }

    // Dismiss any intermediate "Got it" or confirmation buttons
    const gotIt = page.locator('button:has-text("Got it")').first();
    if (await gotIt.isVisible({ timeout: 300 }).catch(() => false)) {
      await gotIt.click();
    }

    if (!(await sleepSafely(page, 500))) return false;
  }

  console.log(
    `[waitForAuthCompletion] Auth did not complete within ${timeoutMs}ms`,
  );
  return false;
}

/**
 * Wait for the username selection screen to appear (after first login).
 * Returns true if it appeared, false if we're past it already.
 */
export async function waitForUsernameScreen(
  page: Page,
  timeoutMs: number = 10_000,
): Promise<boolean> {
  const usernameInput = page
    .locator(
      'input[placeholder*="username" i], input[name="username"], [data-testid="username-input"]',
    )
    .first();

  return usernameInput.isVisible({ timeout: timeoutMs }).catch(() => false);
}

/**
 * Fill in a username if the username selection screen is shown.
 * Returns true if username was submitted, false if screen wasn't shown.
 */
export async function fillUsername(
  page: Page,
  username: string,
): Promise<boolean> {
  const usernameInput = page
    .locator(
      'input[placeholder*="username" i], input[name="username"], [data-testid="username-input"]',
    )
    .first();

  if (!(await usernameInput.isVisible({ timeout: 5000 }).catch(() => false))) {
    return false;
  }

  await usernameInput.fill(username);
  await page.waitForTimeout(500);

  // Submit the username
  const submitSelectors = [
    '[data-testid="submit-username"]',
    'button[type="submit"]',
    'button:has-text("Continue")',
    'button:has-text("Create")',
    'button:has-text("Play")',
    'button:has-text("Confirm")',
  ];

  for (const selector of submitSelectors) {
    const btn = page.locator(selector).first();
    if (await btn.isVisible({ timeout: 1000 }).catch(() => false)) {
      await btn.click();
      console.log(`[fillUsername] Submitted username via ${selector}`);
      return true;
    }
  }

  // Try pressing Enter as fallback
  await usernameInput.press("Enter");
  console.log("[fillUsername] Submitted username via Enter key");
  return true;
}

// =============================================================================
// CHARACTER SELECTION / CREATION HELPERS
// =============================================================================

/**
 * Wait for the CharacterSelectScreen to appear.
 * This screen shows after username is set (or after login for returning users).
 * Detects the character list, "Create New" button, or "Enter World" button.
 */
export async function waitForCharacterSelect(
  page: Page,
  timeoutMs: number = 15_000,
): Promise<boolean> {
  const stage = await waitForFlowStage(page, ["character", "game"], timeoutMs);
  if (stage === "character") {
    console.log("[waitForCharacterSelect] Character select screen detected");
    return true;
  }
  if (stage === "game") {
    console.log(
      "[waitForCharacterSelect] Already in game (character selection already completed)",
    );
    return true;
  }

  const deadline = Date.now() + timeoutMs;

  while (Date.now() < deadline) {
    if (page.isClosed()) return false;

    // Check for character select indicators
    const hasCharacterUI =
      (await page
        .locator('button:has-text("Create New")')
        .first()
        .isVisible({ timeout: 500 })
        .catch(() => false)) ||
      (await page
        .locator('button:has-text("Enter World")')
        .first()
        .isVisible({ timeout: 500 })
        .catch(() => false)) ||
      (await page
        .locator("text=No characters yet.")
        .first()
        .isVisible({ timeout: 500 })
        .catch(() => false)) ||
      (await page
        .locator('button:has-text("Sign out")')
        .first()
        .isVisible({ timeout: 500 })
        .catch(() => false));

    if (hasCharacterUI) {
      console.log("[waitForCharacterSelect] Character select screen detected");
      return true;
    }

    if (!(await sleepSafely(page, 500))) return false;
  }

  console.log(
    `[waitForCharacterSelect] Character select did not appear within ${timeoutMs}ms`,
  );
  return false;
}

/**
 * Check if any existing characters are listed on the CharacterSelectScreen.
 * Returns the count of character buttons found.
 */
export async function getExistingCharacterCount(page: Page): Promise<number> {
  // Character buttons are inside the scrollable list. Each character has a
  // button with the character name (font-semibold text-xl class).
  // The "Create New" button also has text-xl but says "Create New", so exclude it.
  // Character entries have an arrow "›" next to them.
  const characterEntries = await page
    .locator('.space-y-3 button:not(:has-text("Create New"))')
    .all();

  // Filter out non-character buttons (the list should only contain character buttons)
  let count = 0;
  for (const entry of characterEntries) {
    const text = (await entry.textContent().catch(() => ""))?.trim() ?? "";
    // Character buttons contain the character name (not "Create New", "Cancel", etc.)
    if (
      text.length > 0 &&
      !text.includes("Create New") &&
      !text.includes("Cancel") &&
      !text.includes("Sign out")
    ) {
      count++;
    }
  }

  return count;
}

/**
 * Select the first existing character from the list.
 * Clicks the character button which transitions to the "confirm" view.
 */
export async function selectFirstCharacter(page: Page): Promise<boolean> {
  // If we're already on confirm view, selection is already complete.
  const confirmButton = page.locator('button:has-text("Enter World")').first();
  if (await confirmButton.isVisible({ timeout: 1000 }).catch(() => false)) {
    return true;
  }

  // Find character buttons in the scrollable list
  // Characters are buttons that contain a name span with text-xl font-semibold
  // They are NOT "Create New" or "Cancel"
  const characterButtons = page.locator(
    '.space-y-3 button:not(:has-text("Create New")):not(:has-text("Cancel")):not(:has-text("Sign out"))',
  );

  const count = await characterButtons.count();
  if (count === 0) {
    console.log("[selectFirstCharacter] No characters found in list");
    return false;
  }

  const firstChar = characterButtons.first();
  const charName = (await firstChar.textContent().catch(() => ""))?.trim();
  console.log(
    `[selectFirstCharacter] Selecting character: "${charName}" (1 of ${count})`,
  );
  for (let attempt = 0; attempt < 2; attempt++) {
    await firstChar.click();
    await page.waitForTimeout(1000);

    // Verify we transitioned to confirm view (Enter World button should appear)
    const hasConfirmView = await confirmButton
      .isVisible({ timeout: 5000 })
      .catch(() => false);

    if (hasConfirmView) {
      console.log("[selectFirstCharacter] Confirm view shown with Enter World");
      return true;
    }
  }

  return false;
}

/**
 * Create a new character on the CharacterSelectScreen.
 *
 * Flow:
 *   1. Click "Create New" to open the creation form
 *   2. Fill in character name
 *   3. Click "Create" to submit
 *   4. Wait for character to appear in the list or confirm view
 *
 * @param page - Playwright page
 * @param characterName - Name for the new character (3-20 chars)
 * @returns true if character was created and selected
 */
export async function createNewCharacter(
  page: Page,
  characterName: string,
): Promise<boolean> {
  // Step 1: Click "Create New" to open the creation form
  const createNewBtn = page.locator('button:has-text("Create New")').first();
  if (!(await createNewBtn.isVisible({ timeout: 5000 }).catch(() => false))) {
    console.log(
      "[createNewCharacter] Create New button not found - form may already be open",
    );
  } else {
    await createNewBtn.click();
    await page.waitForTimeout(1000);
  }

  // Step 2: Fill in character name
  // The input has a special dash character in the placeholder: "Name (3–20 chars)"
  const nameInput = page.locator('input[placeholder*="Name"]').first();

  if (!(await nameInput.isVisible({ timeout: 5000 }).catch(() => false))) {
    console.log("[createNewCharacter] Name input not found");
    return false;
  }

  await nameInput.clear();
  await nameInput.fill(characterName);
  await page.waitForTimeout(500);

  // Step 3: Click "Create" button (not "Create New" or "Create Account")
  // The Create button is a submit button inside the character creation form
  const createBtn = page
    .locator('button[type="submit"]:has-text("Create")')
    .first();

  if (!(await createBtn.isVisible({ timeout: 3000 }).catch(() => false))) {
    // Fallback: try any button that says exactly "Create"
    const fallbackBtn = page.locator('button:has-text("Create")').first();
    if (await fallbackBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
      const btnText =
        (await fallbackBtn.textContent().catch(() => ""))?.trim() ?? "";
      if (btnText === "Create" || btnText === "Creating...") {
        if (await fallbackBtn.isDisabled().catch(() => true)) {
          console.log("[createNewCharacter] Create button is disabled");
          return false;
        }
        await fallbackBtn.click({ timeout: 3000 }).catch(() => {});
      }
    } else {
      console.log("[createNewCharacter] Create button not found");
      return false;
    }
  } else {
    if (await createBtn.isDisabled().catch(() => true)) {
      // Name validation can occasionally reject stale values; try one unique retry.
      const retryName = `${characterName.slice(0, 15)}${Math.floor(
        Math.random() * 1000,
      )}`;
      await nameInput.clear().catch(() => {});
      await nameInput.fill(retryName).catch(() => {});
      await page.waitForTimeout(300);
      if (await createBtn.isDisabled().catch(() => true)) {
        console.log("[createNewCharacter] Create button is disabled");
        return false;
      }
    }

    await createBtn.click({ timeout: 3000 }).catch(() => {});
  }

  console.log(
    `[createNewCharacter] Submitted character creation: "${characterName}"`,
  );

  // Step 4: Wait for async creation to settle.
  // Character creation can take several seconds while wallet/account side effects complete.
  const deadline = Date.now() + 45_000;
  while (Date.now() < deadline) {
    // Confirm view means creation completed and character is selected.
    const enterWorldBtn = page
      .locator('button:has-text("Enter World")')
      .first();
    if (await enterWorldBtn.isVisible({ timeout: 500 }).catch(() => false)) {
      console.log(
        "[createNewCharacter] Character created - confirm view shown",
      );
      return true;
    }

    // Returned to list view means we can select the newly created character.
    const createNewVisible = await page
      .locator('button:has-text("Create New")')
      .first()
      .isVisible({ timeout: 500 })
      .catch(() => false);
    if (createNewVisible) {
      console.log(
        "[createNewCharacter] Character created - returned to list view",
      );
      return selectFirstCharacter(page);
    }

    // Surface explicit creation errors when present.
    const errorMsg = page.locator(".bg-red-900").first();
    if (await errorMsg.isVisible({ timeout: 200 }).catch(() => false)) {
      const errorText =
        (await errorMsg.textContent().catch(() => ""))?.trim() ?? "";
      console.log(`[createNewCharacter] Error: "${errorText}"`);
      return false;
    }

    await page.waitForTimeout(500);
  }

  // Last chance recovery: we may have returned to character list silently.
  const recoveredBySelection =
    (await selectFirstCharacter(page)) ||
    (await page
      .locator('button:has-text("Enter World")')
      .first()
      .isVisible({ timeout: 1500 })
      .catch(() => false));
  if (recoveredBySelection) {
    console.log(
      "[createNewCharacter] Character creation recovered after delayed confirmation",
    );
    return true;
  }

  console.log(
    "[createNewCharacter] Character creation timed out before UI confirmation",
  );
  return false;
}

/**
 * Click "Enter World" to enter the game.
 * Must be on the confirm view (after selecting a character).
 * Waits for the GameClient to load.
 */
export async function clickEnterWorld(
  page: Page,
  timeoutMs: number = 30_000,
): Promise<boolean> {
  const enterWorldBtn = page.locator('button:has-text("Enter World")').first();

  if (!(await enterWorldBtn.isVisible({ timeout: 5000 }).catch(() => false))) {
    console.log("[clickEnterWorld] Enter World button not found");
    return false;
  }

  // Make sure button is enabled
  const isDisabled = await enterWorldBtn.isDisabled();
  if (isDisabled) {
    console.log("[clickEnterWorld] Enter World button is disabled — waiting");
    await page.waitForTimeout(3000);
    if (await enterWorldBtn.isDisabled()) {
      console.log("[clickEnterWorld] Enter World still disabled after wait");
      return false;
    }
  }

  console.log("[clickEnterWorld] Clicking Enter World...");
  await enterWorldBtn.click();

  // Wait for game canvas to appear (GameClient renders #game-canvas)
  return waitForGameClient(page, timeoutMs);
}

/**
 * Wait for the GameClient to render (indicates we're in the game).
 * Checks for #game-canvas and #main-content elements.
 */
export async function waitForGameClient(
  page: Page,
  timeoutMs: number = 30_000,
): Promise<boolean> {
  const deadline = Date.now() + timeoutMs;

  while (Date.now() < deadline) {
    if (page.isClosed()) return false;

    // Check for GameClient DOM elements
    const hasGameCanvas = await page
      .locator("#game-canvas, .App__viewport, [data-component='viewport']")
      .first()
      .isVisible({ timeout: 1000 })
      .catch(() => false);

    if (hasGameCanvas) {
      const gameplayReady = await page
        .evaluate(() => {
          const win = window as unknown as {
            __HYPERIA_LOADING__?: { ready?: boolean };
            world?: {
              entities?: {
                player?: { id?: string } | null;
              };
            };
          };
          const loading = win.__HYPERIA_LOADING__;
          if (loading && loading.ready === false) {
            return false;
          }
          const player = win.world?.entities?.player;
          return Boolean(loading?.ready === true || player?.id || player);
        })
        .catch(() => false);

      if (gameplayReady) {
        console.log(
          "[waitForGameClient] Game canvas detected — player is in game",
        );
        return true;
      }
    }

    // Check for "Entering..." text (transitioning)
    const entering = await page
      .locator("text=Entering...")
      .first()
      .isVisible({ timeout: 300 })
      .catch(() => false);
    if (entering) {
      console.log("[waitForGameClient] Entering world...");
    }

    if (!(await sleepSafely(page, 1000))) return false;
  }

  console.log(
    `[waitForGameClient] Game client did not appear within ${timeoutMs}ms`,
  );
  return false;
}

/**
 * Check if the player is currently in the game (GameClient is rendered).
 */
export async function isInGame(page: Page): Promise<boolean> {
  const hasGameCanvas = await page
    .locator("#game-canvas, .App__viewport, [data-component='viewport']")
    .first()
    .isVisible({ timeout: 2000 })
    .catch(() => false);

  if (!hasGameCanvas) {
    return false;
  }

  return page
    .evaluate(() => {
      const win = window as unknown as {
        __HYPERIA_LOADING__?: { ready?: boolean };
        world?: {
          entities?: {
            player?: { id?: string } | null;
          };
        };
      };
      const loading = win.__HYPERIA_LOADING__;
      if (loading && loading.ready === false) {
        return false;
      }
      const player = win.world?.entities?.player;
      return Boolean(loading?.ready === true || player?.id || player);
    })
    .catch(() => false);
}

// =============================================================================
// FULL FLOW HELPER: Login → Username → Character → Enter World
// =============================================================================

/**
 * Complete the full login-to-game flow.
 *
 * Handles all states:
 *   1. Wallet connect via Privy (LoginScreen)
 *   2. Username creation if first-time user (UsernameSelectionScreen)
 *   3. Character selection or creation (CharacterSelectScreen)
 *   4. Enter World (confirm view → GameClient)
 *
 * @param page - Playwright page
 * @param wallet - HeadlessWeb3Wallet (optional, for EVM auto-approve)
 * @param options - Configuration for the flow
 * @returns true if successfully entered the game
 */
export async function completeFullLoginFlow(
  page: Page,
  wallet?: HeadlessWeb3Wallet,
  options: {
    username?: string;
    characterName?: string;
    maxAttempts?: number;
    /** If true, skip entering the world (stop at character select) */
    skipEnterWorld?: boolean;
    /** Internal retry counter for transient startup races */
    __attempt?: number;
  } = {},
): Promise<boolean> {
  const attempt = options.__attempt ?? 1;
  const maxAttempts = options.maxAttempts ?? 4;
  const username = options.username ?? `e2e_${Date.now().toString().slice(-8)}`;
  const characterName =
    options.characterName ?? `TestChar_${Date.now().toString().slice(-6)}`;

  let stage =
    (await waitForFlowStage(
      page,
      ["login", "username", "character", "game"],
      60_000,
    )) ?? (await detectFlowStage(page));

  if (stage === "game") {
    console.log("[fullFlow] Already in game, skipping auth/character flow");
    return true;
  }

  // Step 1: Connect wallet via Privy
  console.log("[fullFlow] Step 1: Connecting wallet via Privy...");
  if (stage === "login" || stage === "initializing" || stage === "unknown") {
    await connectEvmWalletViaPrivy(page, wallet);
    stage =
      (await waitForFlowStage(
        page,
        ["username", "character", "game"],
        60_000,
      )) ?? (await detectFlowStage(page));

    // Privy modal can occasionally close without completing auth under load.
    // Retry wallet connect once more before moving on to later-stage waits.
    if (stage === "login" || stage === "initializing" || stage === "unknown") {
      console.log(
        "[fullFlow] Auth still incomplete after wallet connect, retrying wallet connection...",
      );
      await connectEvmWalletViaPrivy(page, wallet);
      stage =
        (await waitForFlowStage(
          page,
          ["username", "character", "game"],
          45_000,
        )) ?? (await detectFlowStage(page));
    }
  }

  if (stage === "game") {
    console.log("[fullFlow] Already in game after auth step");
    return true;
  }

  if (stage === "login" || stage === "initializing" || stage === "unknown") {
    // In test-mode auth bypass, app can go directly to game without login UI.
    const loginEntryVisible = await page
      .locator(LOGIN_ENTRY_SELECTORS)
      .first()
      .isVisible({ timeout: 1200 })
      .catch(() => false);
    if (!loginEntryVisible) {
      const reachedStage = await waitForFlowStage(
        page,
        ["game", "character", "username"],
        45_000,
      );
      if (reachedStage === "game") {
        console.log("[fullFlow] Entered game via direct test-mode flow");
        return true;
      }
      if (reachedStage === "character" || reachedStage === "username") {
        stage = reachedStage;
      }
    }
  }

  if (stage === "login" || stage === "initializing" || stage === "unknown") {
    if (attempt < maxAttempts) {
      console.log(
        "[fullFlow] Auth stage unresolved after wallet attempts; reloading and retrying flow...",
      );
      if (page.isClosed()) return false;
      await page.reload({ waitUntil: "domcontentloaded" }).catch(() => {});
      if (page.isClosed()) return false;
      await sleepSafely(page, 1500);
      return completeFullLoginFlow(page, wallet, {
        ...options,
        __attempt: attempt + 1,
      });
    }
    console.log("[fullFlow] Auth stage unresolved after wallet attempts");
    return false;
  }

  // Step 2: Handle username selection (first-time users)
  console.log("[fullFlow] Step 2: Checking for username selection...");
  const needsUsername =
    stage === "username" || (await waitForUsernameScreen(page, 20_000));
  if (needsUsername) {
    console.log(`[fullFlow] New user — creating username: ${username}`);
    const submitted = await fillUsername(page, username);
    if (!submitted) {
      console.log("[fullFlow] Failed to submit username");
      return false;
    }
    stage =
      (await waitForFlowStage(page, ["character", "game"], 45_000)) ??
      (await detectFlowStage(page));
  } else {
    console.log("[fullFlow] Existing user — skipping username selection");
    stage = await detectFlowStage(page);
  }

  // Step 3: Handle character selection
  console.log("[fullFlow] Step 3: Handling character selection...");
  if (stage === "game") {
    console.log("[fullFlow] Already in game — skipping character select");
    return true;
  }

  let charScreenReady = stage === "character";
  if (!charScreenReady) {
    charScreenReady = await waitForCharacterSelect(page, 45_000);
  }
  if (!charScreenReady) {
    // Username UI can appear with delayed hydration after wallet auth.
    const delayedUsername = await waitForUsernameScreen(page, 12_000);
    if (delayedUsername) {
      console.log("[fullFlow] Delayed username screen detected");
      const submitted = await fillUsername(page, username);
      if (!submitted) {
        console.log("[fullFlow] Failed to submit delayed username");
        return false;
      }
      const delayedStage =
        (await waitForFlowStage(page, ["character", "game"], 30_000)) ??
        (await detectFlowStage(page));
      if (delayedStage === "game") {
        console.log("[fullFlow] Entered game after delayed username");
        return true;
      }
      charScreenReady = delayedStage === "character";
    }
  }

  if (!charScreenReady) {
    // Check if we're already in game (Privy disabled mode, or fast transition)
    if (await isInGame(page)) {
      console.log("[fullFlow] Already in game — skipping character select");
      return true;
    }
    if (await waitForGameClient(page, 30_000)) {
      console.log(
        "[fullFlow] In game after delayed load — skipping character select",
      );
      return true;
    }
    if (attempt < maxAttempts) {
      console.log(
        "[fullFlow] Character select not found, reloading and retrying flow...",
      );
      if (page.isClosed()) return false;
      await page.reload({ waitUntil: "domcontentloaded" }).catch(() => {});
      if (page.isClosed()) return false;
      await sleepSafely(page, 2000);
      return completeFullLoginFlow(page, wallet, {
        ...options,
        __attempt: attempt + 1,
      });
    }
    console.log("[fullFlow] Character select screen not found");
    return false;
  }

  // Prefer reusing an existing character when available.
  const existingCount = await getExistingCharacterCount(page);
  console.log(`[fullFlow] Found ${existingCount} existing character(s)`);

  let selectedExisting = await selectFirstCharacter(page);
  if (!selectedExisting) {
    await sleepSafely(page, 1500);
    selectedExisting = await selectFirstCharacter(page);
  }

  if (selectedExisting) {
    console.log("[fullFlow] Selected existing character");
  } else {
    // Create a new character when none can be selected.
    console.log(
      `[fullFlow] No characters found — creating: "${characterName}"`,
    );
    const created = await createNewCharacter(page, characterName);
    if (!created) {
      if (attempt < maxAttempts) {
        console.log(
          "[fullFlow] Character creation failed, reloading and retrying flow...",
        );
        if (page.isClosed()) return false;
        await page.reload({ waitUntil: "domcontentloaded" }).catch(() => {});
        if (page.isClosed()) return false;
        await sleepSafely(page, 1500);
        return completeFullLoginFlow(page, wallet, {
          ...options,
          __attempt: attempt + 1,
        });
      }
      console.log("[fullFlow] Failed to create character");
      return false;
    }
  }

  // Step 4: Enter the world
  if (options.skipEnterWorld) {
    console.log("[fullFlow] Skipping Enter World (as requested)");
    return true;
  }

  console.log("[fullFlow] Step 4: Entering world...");
  let enteredGame = await clickEnterWorld(page, 60_000);

  // If Enter World click timed out but GameClient is already present, treat as success.
  if (!enteredGame && (await waitForGameClient(page, 15_000))) {
    enteredGame = true;
  }

  // Retry once if we're still on the confirm view.
  if (!enteredGame) {
    const enterWorldVisible = await page
      .locator('button:has-text("Enter World")')
      .first()
      .isVisible({ timeout: 3_000 })
      .catch(() => false);

    if (enterWorldVisible) {
      console.log("[fullFlow] Enter World retry...");
      enteredGame = await clickEnterWorld(page, 45_000);
    }
  }

  if (!enteredGame && (await waitForGameClient(page, 15_000))) {
    enteredGame = true;
  }

  if (!enteredGame && attempt < maxAttempts) {
    const hasDynamicImportError = await page
      .locator("text=Failed to fetch dynamically imported module")
      .first()
      .isVisible({ timeout: 500 })
      .catch(() => false);

    if (hasDynamicImportError) {
      console.log(
        "[fullFlow] Dynamic module load failed while entering game, reloading and retrying flow...",
      );
    } else {
      console.log(
        "[fullFlow] Enter world flow stalled, reloading and retrying flow...",
      );
    }

    if (page.isClosed()) return false;
    await page.reload({ waitUntil: "domcontentloaded" }).catch(() => {});
    if (page.isClosed()) return false;
    await sleepSafely(page, 1500);
    return completeFullLoginFlow(page, wallet, {
      ...options,
      __attempt: attempt + 1,
    });
  }

  if (enteredGame) {
    console.log("[fullFlow] Successfully entered the game!");
  } else {
    console.log("[fullFlow] Failed to enter the game");
  }

  return enteredGame;
}

// =============================================================================
// DISCONNECT / LOGOUT
// =============================================================================

/**
 * Disconnect wallet / log out of Hyperia.
 * Looks for logout/disconnect buttons in various UI locations.
 */
export async function disconnectWallet(page: Page): Promise<void> {
  // Try clicking settings/menu first
  const menuSelectors = [
    '[data-testid="settings-button"]',
    '[data-testid="user-menu"]',
    'button:has-text("Settings")',
    'button:has-text("Account")',
    // Hyperia may have a gear icon or similar
    '[data-panel-id="settings"]',
  ];

  for (const selector of menuSelectors) {
    const menu = page.locator(selector).first();
    if (await menu.isVisible({ timeout: 1000 }).catch(() => false)) {
      await menu.click();
      await page.waitForTimeout(500);
      break;
    }
  }

  // Find and click disconnect/logout
  const logoutSelectors = [
    'button:has-text("Disconnect")',
    'button:has-text("Sign Out")',
    'button:has-text("Log Out")',
    'button:has-text("Logout")',
    '[data-testid="logout-button"]',
  ];

  for (const selector of logoutSelectors) {
    const btn = page.locator(selector).first();
    if (await btn.isVisible({ timeout: 2000 }).catch(() => false)) {
      await btn.click();
      await page.waitForTimeout(1000);
      console.log(`[disconnectWallet] Logged out via ${selector}`);
      return;
    }
  }

  // Fallback: use Privy's global logout function
  await page
    .evaluate(() => {
      const win = window as typeof window & { privyLogout?: () => void };
      if (typeof win.privyLogout === "function") {
        win.privyLogout();
      }
    })
    .catch(() => {});
  await page.waitForTimeout(1000);

  console.log("[disconnectWallet] Used privy global logout fallback");
}

// =============================================================================
// PAGE NAVIGATION HELPERS
// =============================================================================

/**
 * Navigate to the Hyperia app and wait for initial load.
 */
export async function waitForAppReady(page: Page, url: string): Promise<void> {
  let lastError: unknown;
  for (let attempt = 0; attempt < 12; attempt++) {
    try {
      await page.goto(url, { waitUntil: "domcontentloaded", timeout: 60_000 });
      lastError = null;
      break;
    } catch (error) {
      lastError = error;
      const message = error instanceof Error ? error.message : String(error);
      if (!message.includes("ERR_CONNECTION_REFUSED")) {
        throw error;
      }
      await sleepSafely(page, 2_000);
    }
  }

  if (lastError) {
    throw lastError;
  }

  await page
    .waitForLoadState("networkidle", { timeout: 15000 })
    .catch(() => {});
  // Wait for a concrete app surface (login/username/character/game)
  await waitForFlowStage(
    page,
    ["login", "username", "character", "game"],
    60_000,
  ).catch(() => {});
  // Small settle for React hydration.
  await sleepSafely(page, 1000);
}
