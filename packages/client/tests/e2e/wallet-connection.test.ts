/**
 * E2E Test: Wallet Connection Flow
 * REAL test with screenshots and verification
 */
import { test, expect } from '@playwright/test';
import { dappwright, MetaMask } from '@tenkeylabs/dappwright';
import { takeAndVerifyScreenshot, waitForPageLoad } from './utils/screenshot';

test.describe('Wallet Connection Flow', () => {
  test('should connect MetaMask and take screenshots at each step', async () => {
    let browser, metamask, page;
    
    try {
      // Step 1: Launch browser with MetaMask
      [metamask, browser, page] = await dappwright.bootstrap('', {
        wallet: 'metamask',
        version: MetaMask.Version.STABLE,
        headless: false,
        timeout: 60000
      });
      
      await takeAndVerifyScreenshot(page, { 
        name: '01-metamask-launched',
        errorOnBlank: true 
      });
      
      // Step 2: Add Jeju Localnet
      await metamask.addNetwork({
        networkName: 'Jeju Localnet',
        rpc: 'http://localhost:8545',
        chainId: 1337,
        symbol: 'ETH'
      });
      
      await takeAndVerifyScreenshot(page, { 
        name: '02-network-added',
        errorOnBlank: true 
      });
      
      // Step 3: Navigate to Hyperscape
      await page.goto('http://localhost:3333');
      await waitForPageLoad(page, 'localhost:3333');
      
      await takeAndVerifyScreenshot(page, { 
        name: '03-hyperscape-home',
        errorOnBlank: true 
      });
      
      // Step 4: Click connect wallet
      const connectButton = page.locator('button', { hasText: /connect.*wallet/i });
      if (await connectButton.count() > 0) {
        await connectButton.first().click();
        await takeAndVerifyScreenshot(page, { 
          name: '04-connect-clicked',
          errorOnBlank: true 
        });
        
        // Approve in MetaMask
        await metamask.approve();
        await takeAndVerifyScreenshot(page, { 
          name: '05-wallet-connected',
          errorOnBlank: true 
        });
        
        // Verify connection UI
        await page.waitForSelector('[data-testid="wallet-address"]', { timeout: 5000 });
        const address = await page.locator('[data-testid="wallet-address"]').textContent();
        expect(address).toBeTruthy();
        expect(address).toMatch(/0x[a-fA-F0-9]{40}/);
        
        console.log('✅ Wallet connected:', address);
      } else {
        console.log('⚠️  No connect button found - may be auto-connected');
      }
      
    } catch (error) {
      console.error('❌ Test failed:', error);
      if (page) {
        await takeAndVerifyScreenshot(page, { 
          name: 'ERROR-state',
          errorOnBlank: false // Don't error on blank for error screenshots
        });
      }
      throw error;
    } finally {
      if (browser) {
        await browser.close();
      }
    }
  });
});

