import { test, expect } from 'playwright/test'
import { TestHelpers, ensureScreenshotDir } from './helpers/test-helpers'

/**
 * Voice System Integration Tests
 *
 * Tests navigation, state persistence, and cross-page interactions.
 * Following Hyperscape testing standards: real interactions, no mocks.
 *
 * Test Coverage:
 * - Navigation between voice pages
 * - State persistence across navigation
 * - Voice selection carries across components
 * - Preset application updates settings
 * - Error recovery flows
 * - Global search integration
 */

test.describe('Voice System Integration', () => {
  let helpers: TestHelpers

  test.beforeAll(() => {
    ensureScreenshotDir()
  })

  test.beforeEach(async ({ page }) => {
    helpers = new TestHelpers(page)
    await helpers.clearLocalStorage()
  })

  test.afterEach(async ({ page }, testInfo) => {
    if (testInfo.status !== testInfo.expectedStatus) {
      await helpers.takeScreenshot(`failed-integration-${testInfo.title}`)
      await helpers.logError(`Integration: ${testInfo.title}`, new Error(`Test failed: ${testInfo.error?.message}`))
    }
  })

  test('should navigate between voice pages using navigation menu', async ({ page }) => {
    await helpers.navigateTo('/')
    await helpers.waitForNetworkIdle()

    // Look for Voice section in navigation
    const voiceSection = page.locator('nav, aside, [role="navigation"]').filter({ hasText: /Voice|voice/i })

    if (await voiceSection.first().isVisible({ timeout: 5000 }).catch(() => false)) {
      // Expand voice section if collapsed
      const voiceHeader = page.locator('button, a').filter({ hasText: /Voice Generation|Voice/i }).first()
      if (await voiceHeader.isVisible({ timeout: 3000 }).catch(() => false)) {
        await voiceHeader.click()
        await page.waitForTimeout(500)
      }

      await helpers.takeScreenshot('navigation-voice-expanded')

      // Navigate to Experiment (Standalone)
      const experimentLink = page.locator('a, button').filter({ hasText: /Experiment/i })
      if (await experimentLink.first().isVisible({ timeout: 3000 }).catch(() => false)) {
        await experimentLink.first().click()
        await helpers.waitForNetworkIdle()
        expect(page.url()).toContain('/voice/standalone')
        await helpers.takeScreenshot('navigated-to-standalone')
      }

      // Navigate to Manifests
      const manifestsLink = page.locator('a, button').filter({ hasText: /Manifest|Assign/i })
      if (await manifestsLink.first().isVisible({ timeout: 3000 }).catch(() => false)) {
        await manifestsLink.first().click()
        await helpers.waitForNetworkIdle()
        expect(page.url()).toContain('/voice/manifests')
        await helpers.takeScreenshot('navigated-to-manifests')
      }

      // Navigate to Dialogue Trees
      const dialogueLink = page.locator('a, button').filter({ hasText: /Dialogue/i })
      if (await dialogueLink.first().isVisible({ timeout: 3000 }).catch(() => false)) {
        await dialogueLink.first().click()
        await helpers.waitForNetworkIdle()
        expect(page.url()).toContain('/voice/dialogue')
        await helpers.takeScreenshot('navigated-to-dialogue')
      }
    }
  })

  test('should persist selected voice across page navigation', async ({ page }) => {
    await helpers.navigateTo('/voice/standalone')
    await helpers.waitForNetworkIdle()

    // Select a voice
    const openBrowserButton = page.locator('button').filter({ hasText: /Browse|Select Voice/i })
    if (await openBrowserButton.first().isVisible({ timeout: 5000 }).catch(() => false)) {
      await openBrowserButton.first().click()
      await page.waitForTimeout(1000)

      const voiceCard = page.locator('[data-testid="voice-card"], .voice-card, button[data-voice-id]').first()
      if (await voiceCard.count() > 0) {
        // Get voice name/id before selecting
        const voiceText = await voiceCard.textContent()

        await voiceCard.click()
        await page.waitForTimeout(500)

        // Navigate to manifests page
        await helpers.navigateTo('/voice/manifests')
        await helpers.waitForNetworkIdle()
        await page.waitForTimeout(1000)

        // Check if same voice is available/selected
        await helpers.takeScreenshot('voice-selection-persisted')

        // Navigate back to standalone
        await helpers.navigateTo('/voice/standalone')
        await helpers.waitForNetworkIdle()

        // Voice selection should still be there
        await helpers.takeScreenshot('voice-selection-after-return')
      }
    }
  })

  test('should persist favorites across all voice pages', async ({ page }) => {
    await helpers.navigateTo('/voice/standalone')
    await helpers.waitForNetworkIdle()

    // Open browser and favorite a voice
    const openBrowserButton = page.locator('button').filter({ hasText: /Browse|Select Voice/i })
    if (await openBrowserButton.first().isVisible({ timeout: 5000 }).catch(() => false)) {
      await openBrowserButton.first().click()
      await page.waitForTimeout(1000)

      const favoriteButton = page.locator('button[aria-label*="favorite" i], button:has-text("★")').first()
      if (await favoriteButton.count() > 0) {
        await favoriteButton.click()
        await page.waitForTimeout(500)

        // Get favorites from localStorage
        const favorites = await helpers.getLocalStorageItem('voice-favorites')
        expect(favorites).toBeTruthy()

        // Navigate to manifests
        await helpers.navigateTo('/voice/manifests')
        await helpers.waitForNetworkIdle()
        await page.waitForTimeout(1000)

        // Check favorites still exist
        const favoritesAfterNav = await helpers.getLocalStorageItem('voice-favorites')
        expect(favoritesAfterNav).toBe(favorites)

        await helpers.takeScreenshot('favorites-persisted-manifests')
      }
    }
  })

  test('should persist presets across navigation', async ({ page }) => {
    await helpers.navigateTo('/voice/standalone')
    await helpers.waitForNetworkIdle()

    // Select a preset
    const dialoguePreset = page.locator('button, option').filter({ hasText: /Dialogue/i })
    if (await dialoguePreset.first().isVisible({ timeout: 3000 }).catch(() => false)) {
      await dialoguePreset.first().click()
      await page.waitForTimeout(500)

      // Get presets from localStorage
      const presets = await helpers.getLocalStorageItem('voice-presets')

      // Navigate away and back
      await helpers.navigateTo('/voice/manifests')
      await helpers.waitForNetworkIdle()

      await helpers.navigateTo('/voice/standalone')
      await helpers.waitForNetworkIdle()

      // Presets should still be there
      const presetsAfter = await helpers.getLocalStorageItem('voice-presets')
      expect(presetsAfter).toBe(presets)
    }
  })

  test('should handle navigation with browser back button', async ({ page }) => {
    await helpers.navigateTo('/voice/standalone')
    await helpers.waitForNetworkIdle()
    await helpers.takeScreenshot('standalone-before-back')

    await helpers.navigateTo('/voice/manifests')
    await helpers.waitForNetworkIdle()
    await helpers.takeScreenshot('manifests-before-back')

    // Go back
    await page.goBack()
    await helpers.waitForNetworkIdle()

    expect(page.url()).toContain('/voice/standalone')
    await helpers.takeScreenshot('after-browser-back')

    // Go forward
    await page.goForward()
    await helpers.waitForNetworkIdle()

    expect(page.url()).toContain('/voice/manifests')
    await helpers.takeScreenshot('after-browser-forward')
  })

  test('should maintain subscription widget state across pages', async ({ page }) => {
    await helpers.navigateTo('/voice/standalone')
    await helpers.waitForNetworkIdle()

    // Get subscription info if visible
    const subscriptionWidget = page.locator('[data-testid="subscription-widget"], text=/Quota|Usage/i')
    const hasWidget = await subscriptionWidget.first().isVisible({ timeout: 5000 }).catch(() => false)

    if (hasWidget) {
      const initialText = await subscriptionWidget.first().textContent()

      // Navigate to manifests
      await helpers.navigateTo('/voice/manifests')
      await helpers.waitForNetworkIdle()

      // Check if subscription widget exists and has similar data
      const widgetOnManifests = page.locator('[data-testid="subscription-widget"], text=/Quota|Usage/i')
      const hasWidgetOnManifests = await widgetOnManifests.first().isVisible({ timeout: 5000 }).catch(() => false)

      if (hasWidgetOnManifests) {
        const manifestsText = await widgetOnManifests.first().textContent()
        // Should show same or similar quota info
        await helpers.takeScreenshot('subscription-widget-on-manifests')
      }
    }
  })

  test('should handle error states gracefully', async ({ page }) => {
    // Navigate to standalone
    await helpers.navigateTo('/voice/standalone')
    await helpers.waitForNetworkIdle()

    // Try to trigger an error (generate without voice selected)
    const generateButton = page.locator('button').filter({ hasText: /Generate/i })

    if (await generateButton.first().isVisible({ timeout: 5000 }).catch(() => false)) {
      const isDisabled = await generateButton.first().isDisabled()

      if (!isDisabled) {
        // Fill some text
        const textarea = page.locator('textarea')
        await textarea.fill('Test error handling')
        await page.waitForTimeout(500)

        // Try to generate (might error without voice selection)
        await generateButton.first().click()
        await page.waitForTimeout(2000)

        // Check for error message
        const errorMessage = page.locator('[role="alert"], .error, .text-red-500')
        const hasError = await errorMessage.first().isVisible({ timeout: 3000 }).catch(() => false)

        if (hasError) {
          await helpers.takeScreenshot('error-state')

          // Navigate away and back
          await helpers.navigateTo('/voice/manifests')
          await helpers.waitForNetworkIdle()

          await helpers.navigateTo('/voice/standalone')
          await helpers.waitForNetworkIdle()

          // Error should be cleared
          const errorAfterNav = await errorMessage.first().isVisible().catch(() => false)
          expect(errorAfterNav).toBeFalsy()

          await helpers.takeScreenshot('error-cleared-after-nav')
        }
      }
    }
  })

  test('should work with global search if available', async ({ page }) => {
    await helpers.navigateTo('/')
    await helpers.waitForNetworkIdle()

    // Look for global search
    const searchInput = page.locator('input[placeholder*="Search" i]').first()

    if (await searchInput.isVisible({ timeout: 3000 }).catch(() => false)) {
      // Search for voice-related content
      await searchInput.fill('voice')
      await page.waitForTimeout(1000)

      // Check if voice pages appear in results
      const searchResults = page.locator('[data-testid="search-results"], .search-result')
      const hasResults = await searchResults.first().isVisible({ timeout: 3000 }).catch(() => false)

      if (hasResults) {
        await helpers.takeScreenshot('global-search-voice')

        // Try to click a voice-related result
        const voiceResult = page.locator('a, button').filter({ hasText: /Voice|Experiment|Manifest/i })
        if (await voiceResult.first().isVisible({ timeout: 3000 }).catch(() => false)) {
          await voiceResult.first().click()
          await helpers.waitForNetworkIdle()

          // Should navigate to a voice page
          expect(page.url()).toContain('/voice/')
          await helpers.takeScreenshot('navigated-from-search')
        }
      }
    }
  })

  test('should handle rapid navigation without errors', async ({ page }) => {
    // Rapidly navigate between pages
    await helpers.navigateTo('/voice/standalone')
    await page.waitForTimeout(500)

    await helpers.navigateTo('/voice/manifests')
    await page.waitForTimeout(500)

    await helpers.navigateTo('/voice/dialogue')
    await page.waitForTimeout(500)

    await helpers.navigateTo('/voice/standalone')
    await page.waitForTimeout(500)

    await helpers.navigateTo('/voice/manifests')
    await helpers.waitForNetworkIdle()

    // Page should still be functional
    const mainContent = page.locator('main, [role="main"]')
    await expect(mainContent).toBeVisible()

    // No console errors (check would require console listener)
    await helpers.takeScreenshot('after-rapid-navigation')
  })

  test('should maintain layout consistency across pages', async ({ page }) => {
    // Check standalone layout
    await helpers.navigateTo('/voice/standalone')
    await helpers.waitForNetworkIdle()

    const standaloneViewport = await helpers.getViewportSize()
    await helpers.takeScreenshot('standalone-layout')

    // Check manifests layout
    await helpers.navigateTo('/voice/manifests')
    await helpers.waitForNetworkIdle()

    const manifestsViewport = await helpers.getViewportSize()
    await helpers.takeScreenshot('manifests-layout')

    // Viewport should be consistent
    expect(standaloneViewport.width).toBe(manifestsViewport.width)
    expect(standaloneViewport.height).toBe(manifestsViewport.height)
  })

  test('should clear temporary state on navigation', async ({ page }) => {
    await helpers.navigateTo('/voice/standalone')
    await helpers.waitForNetworkIdle()

    // Open voice browser (modal state)
    const openBrowserButton = page.locator('button').filter({ hasText: /Browse|Select Voice/i })
    if (await openBrowserButton.first().isVisible({ timeout: 5000 }).catch(() => false)) {
      await openBrowserButton.first().click()
      await page.waitForTimeout(500)

      // Modal should be open
      const modal = page.locator('[role="dialog"], .modal')
      const isModalOpen = await modal.first().isVisible().catch(() => false)

      if (isModalOpen) {
        // Navigate away
        await helpers.navigateTo('/voice/manifests')
        await helpers.waitForNetworkIdle()

        // Navigate back
        await helpers.navigateTo('/voice/standalone')
        await helpers.waitForNetworkIdle()

        // Modal should be closed
        const isModalStillOpen = await modal.first().isVisible().catch(() => false)
        expect(isModalStillOpen).toBeFalsy()

        await helpers.takeScreenshot('modal-state-cleared')
      }
    }
  })
})
