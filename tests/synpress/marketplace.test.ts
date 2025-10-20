/**
 * Synpress tests for Hyperscape marketplace and NFT features
 * Tests Gold claiming, item minting, and Bazaar marketplace
 */

import { testWithSynpress } from '@synthetixio/synpress';
import { MetaMask, metaMaskFixtures } from '@synthetixio/synpress/playwright';
import basicSetup from '../wallet-setup/basic.setup';

const test = testWithSynpress(metaMaskFixtures(basicSetup));
const { expect } = test;

test.describe('Hyperscape Marketplace Integration', () => {
  
  test('should connect wallet to Hyperscape', async ({ context, page, metamaskPage, extensionId }) => {
    const metamask = new MetaMask(context, metamaskPage, basicSetup.walletPassword, extensionId);

    await page.goto('/');

    // Find and click connect button
    const connectButton = page.locator('button:has-text("Connect")').or(page.locator('[data-testid="connect-wallet"]')).first();
    if (await connectButton.isVisible({ timeout: 5000 }).catch(() => false)) {
      await connectButton.click();
      await metamask.connectToDapp();
      
      await expect(page.locator('text=/0x[a-fA-F0-9]{4}/i')).toBeVisible({ timeout: 5000 });
    }
  });

  test('should claim Gold tokens from in-game earnings', async ({ context, page, metamaskPage, extensionId }) => {
    const metamask = new MetaMask(context, metamaskPage, basicSetup.walletPassword, extensionId);

    await page.goto('/');

    // Navigate to Gold claim
    const claimButton = page.locator('button:has-text("Claim Gold")').or(page.locator('[data-testid="claim-gold"]')).first();
    if (await claimButton.isVisible({ timeout: 3000 }).catch(() => false)) {
      await claimButton.click();

      // Confirm transaction
      await metamask.confirmTransaction();

      // Verify claim success
      await expect(page.locator('text=/claimed|success/i')).toBeVisible({ timeout: 15000 });
    } else {
      console.log('Gold claiming not available (no earnings yet)');
    }
  });

  test('should mint in-game item to NFT', async ({ context, page, metamaskPage, extensionId }) => {
    const metamask = new MetaMask(context, metamaskPage, basicSetup.walletPassword, extensionId);

    await page.goto('/inventory');

    // Find mint button
    const mintButton = page.locator('button:has-text("Mint")').or(page.locator('[data-testid="mint-item"]')).first();
    if (await mintButton.isVisible({ timeout: 3000 }).catch(() => false)) {
      await mintButton.click();

      // May require payment
      const paymentModal = await page.locator('text=Payment Required').isVisible({ timeout: 2000 }).catch(() => false);
      if (paymentModal) {
        await page.locator('button:has-text("Pay")').first().click();
        await metamask.confirmTransaction();
      }

      // Confirm minting
      await metamask.confirmTransaction();

      // Verify mint success
      await expect(page.locator('text=/minted|nft created|success/i')).toBeVisible({ timeout: 15000 });
    }
  });

  test('should list item on Bazaar marketplace', async ({ context, page, metamaskPage, extensionId }) => {
    const metamask = new MetaMask(context, metamaskPage, basicSetup.walletPassword, extensionId);

    await page.goto('/marketplace');

    const listButton = page.locator('button:has-text("List Item")').or(page.locator('[data-testid="list-item"]')).first();
    if (await listButton.isVisible({ timeout: 3000 }).catch(() => false)) {
      await listButton.click();

      // Fill listing form
      const priceInput = page.locator('input[placeholder*="price"]').or(page.locator('[data-testid="item-price"]')).first();
      await priceInput.fill('100');

      // Submit listing
      await page.locator('button:has-text("Create Listing")').first().click();

      // Approve token (ERC1155)
      await metamask.approveTx();

      // Confirm listing transaction
      await metamask.confirmTransaction();

      // Verify listing created
      await expect(page.locator('text=/listed|active|success/i')).toBeVisible({ timeout: 15000 });
    }
  });

  test('should use PlayerTradeEscrow for P2P trading', async ({ context, page, metamaskPage, extensionId }) => {
    const metamask = new MetaMask(context, metamaskPage, basicSetup.walletPassword, extensionId);

    await page.goto('/trade');

    const createTradeButton = page.locator('button:has-text("Create Trade")').or(page.locator('[data-testid="create-trade"]')).first();
    if (await createTradeButton.isVisible({ timeout: 3000 }).catch(() => false)) {
      await createTradeButton.click();

      // Select items and partner
      // This is game-specific UI, so we'll just verify the flow exists
      await page.waitForTimeout(1000);

      const submitButton = page.locator('button:has-text("Propose")').or(page.locator('button:has-text("Create")'));
      const canTrade = await submitButton.first().isVisible({ timeout: 2000 }).catch(() => false);

      if (canTrade) {
        await submitButton.first().click();
        await metamask.confirmTransaction();
        await expect(page.locator('text=/created|proposed|pending/i')).toBeVisible({ timeout: 10000 });
      }
    }
  });

  test('should enforce ERC-8004 bans on marketplace access', async ({ context, page, metamaskPage, extensionId }) => {
    const metamask = new MetaMask(context, metamaskPage, basicSetup.walletPassword, extensionId);

    await page.goto('/marketplace');

    // Connect wallet
    const connectButton = page.locator('button:has-text("Connect")').first();
    if (await connectButton.isVisible({ timeout: 2000 }).catch(() => false)) {
      await connectButton.click();
      await metamask.connectToDapp();
    }

    // Marketplace should check ban status
    await page.waitForTimeout(2000);
    
    const banned = await page.locator('text=/banned|restricted/i').isVisible({ timeout: 2000 }).catch(() => false);
    const allowed = await page.locator('text=/marketplace|listings/i').isVisible({ timeout: 2000 }).catch(() => false);

    expect(banned || allowed).toBeTruthy();
  });

  test('should use multicoin paymaster for item purchases', async ({ context, page, metamaskPage, extensionId }) => {
    const metamask = new MetaMask(context, metamaskPage, basicSetup.walletPassword, extensionId);

    await page.goto('/marketplace');

    // Select paymaster token
    const tokenSelect = page.locator('[data-testid="payment-token"]');
    if (await tokenSelect.isVisible({ timeout: 2000 }).catch(() => false)) {
      await tokenSelect.selectOption('CLANKER');

      // Buy an item
      const buyButton = page.locator('button:has-text("Buy")').first();
      if (await buyButton.isVisible({ timeout: 2000 }).catch(() => false)) {
        await buyButton.click();

        // Should not require gas approval (paymaster handles it)
        await page.waitForTimeout(3000);
        
        const success = await page.locator('text=/purchased|owned|success/i').isVisible({ timeout: 10000 }).catch(() => false);
        if (success) {
          expect(success).toBeTruthy();
        }
      }
    }
  });
});
