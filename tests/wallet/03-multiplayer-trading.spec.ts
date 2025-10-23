import { testWithSynpress } from '@synthetixio/synpress'
import { MetaMask, metaMaskFixtures } from '@synthetixio/synpress/playwright'
import basicSetup from '../../test/wallet-setup/basic.setup'

const test = testWithSynpress(metaMaskFixtures(basicSetup))
const { expect } = test

test.describe('Hyperscape - Multi-Player Trading', () => {
  test('should initiate trade between two players using debug', async ({ context, page, metamaskPage, extensionId }) => {
    // This test requires two browser contexts
    // For now, test the debug trade button appears
    
    await page.goto('http://localhost:3333?debug=true')
    await page.waitForLoadState('networkidle')
    await page.waitForTimeout(5000)
    
    // Open debug panel
    await page.keyboard.press('F9')
    await page.waitForTimeout(500)
    
    // Verify trade button exists
    const tradeButton = page.locator('[data-testid="debug-initiate-trade"]')
    await expect(tradeButton).toBeVisible({ timeout: 5000 })
    
    console.log('Debug trade button available for multi-player testing')
  })
})


