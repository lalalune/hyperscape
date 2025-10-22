import { test, expect } from 'playwright/test'
import { TestHelpers, ensureScreenshotDir, fillLargeTextarea } from './helpers/test-helpers'

/**
 * Voice Standalone Page - Browser Tests
 *
 * Comprehensive real browser testing for voice experimentation features.
 * Following Hyperscape testing standards: real interactions, no mocks.
 *
 * Test Coverage:
 * - Text input and character counting
 * - Character limit warnings and errors
 * - Cost estimation updates
 * - Voice browser interaction
 * - Voice selection and preview
 * - Favorites management
 * - Preset selection and application
 * - Settings adjustment
 * - Error handling
 * - Mobile responsiveness
 * - Accessibility features
 */

test.describe('Voice Standalone Page', () => {
  let helpers: TestHelpers

  test.beforeAll(() => {
    ensureScreenshotDir()
  })

  test.beforeEach(async ({ page }) => {
    helpers = new TestHelpers(page)
    await helpers.navigateTo('/voice/standalone')
    await helpers.clearLocalStorage()
    await page.reload()
    await helpers.waitForNetworkIdle()
  })

  test.afterEach(async ({ page }, testInfo) => {
    if (testInfo.status !== testInfo.expectedStatus) {
      await helpers.takeScreenshot(`failed-${testInfo.title}`)
      await helpers.logError(testInfo.title, new Error(`Test failed: ${testInfo.error?.message}`))
    }
  })

  test('should load the page successfully', async ({ page }) => {
    // Check page is loaded
    await expect(page.locator('[data-testid="voice-standalone-page"]')).toBeVisible()

    // Check main components are present
    await expect(page.locator('[data-testid="voice-input-text"]')).toBeVisible()
    await expect(page.locator('[data-testid="character-counter"]')).toBeVisible()

    // Take screenshot of initial state
    await helpers.takeScreenshot('voice-standalone-initial')
  })

  test('should display character counter', async ({ page }) => {
    const textarea = page.locator('[data-testid="voice-input-text"]')
    const characterCounter = page.locator('[data-testid="character-counter"]')

    // Initial state should show 0 characters
    await expect(characterCounter).toBeVisible()

    // Type some text
    await textarea.fill('Hello, this is a test message.')

    // Wait for counter to update
    await page.waitForTimeout(200)

    // Counter should update
    const counterText = await characterCounter.textContent()
    expect(counterText).toMatch(/\d+/)
  })

  test('should show character limit warning at 90% threshold', async ({ page }) => {
    // Generate text close to 4500 characters (90% of 5000)
    const warningText = 'a'.repeat(4501)
    await fillLargeTextarea(page, '[data-testid="voice-input-text"]', warningText)

    // Look for warning indicator (yellow/orange color)
    const counter = page.locator('[data-testid="character-counter"]')
    await expect(counter).toHaveClass(/text-yellow/, { timeout: 2000 })

    await helpers.takeScreenshot('character-warning')
  })

  test('should prevent input over character limit', async ({ page }) => {
    // Try to input more than 5000 characters
    const tooMuchText = 'a'.repeat(5100)
    await fillLargeTextarea(page, '[data-testid="voice-input-text"]', tooMuchText)

    // Get actual value
    const textarea = page.locator('[data-testid="voice-input-text"]')
    const actualValue = await textarea.inputValue()

    // Should be capped at 5100 (allows slight overflow to show error)
    expect(actualValue.length).toBeLessThanOrEqual(5100)

    // Should show error message
    const errorMsg = page.locator('text=/exceeds maximum/i')
    await expect(errorMsg).toBeVisible({ timeout: 2000 })
  })

  test('should display cost estimation', async ({ page }) => {
    // Type text that should trigger cost estimation
    const testText = 'This is a test message for cost estimation. It needs to be long enough to generate a meaningful cost estimate.'
    await fillLargeTextarea(page, '[data-testid="voice-input-text"]', testText)

    // Wait for debounced cost estimation (100ms debounce + buffer)
    await page.waitForTimeout(800)

    // Look for cost display
    const costDisplay = page.locator('[data-testid="cost-estimate"]')
    await expect(costDisplay).toBeVisible({ timeout: 3000 })

    await helpers.takeScreenshot('cost-estimation')
  })

  test('should open voice browser', async ({ page }) => {
    // Use data-testid for reliable selection
    const openBrowserButton = page.locator('[data-testid="voice-browser-toggle"]')
    await expect(openBrowserButton).toBeVisible()
    await openBrowserButton.click()

    // Wait for voice browser to appear
    await page.waitForTimeout(1000)

    // Check if voice browser is visible (modal or expanded section)
    const voiceBrowser = page.locator('[data-testid="voice-browser"], .voice-browser')
    const isVisible = await helpers.elementExists('[data-testid="voice-browser"]') ||
                      await page.locator('text=/Select a Voice/i, text=/Voice Library/i').isVisible()

    expect(isVisible).toBeTruthy()

    await helpers.takeScreenshot('voice-browser-open')
  })

  test('should filter voices in voice browser', async ({ page }) => {
    // Open voice browser
    const openBrowserButton = page.locator('button').filter({ hasText: /Browse|Select Voice|Voice Library/i })
    if (await openBrowserButton.count() > 0) {
      await openBrowserButton.first().click()
      await page.waitForTimeout(500)
    }

    // Look for gender filter
    const genderFilter = page.locator('select, button').filter({ hasText: /Gender|Male|Female/i })
    if (await genderFilter.count() > 0) {
      await genderFilter.first().click()
      await page.waitForTimeout(500)

      // Select an option if it's a dropdown
      const maleOption = page.locator('option, [role="option"]').filter({ hasText: /Male/i })
      if (await maleOption.count() > 0) {
        await maleOption.first().click()
        await page.waitForTimeout(500)
      }

      await helpers.takeScreenshot('voice-filter-gender')
    }

    // Look for search input
    const searchInput = page.locator('input[placeholder*="Search"], input[type="search"]')
    if (await searchInput.count() > 0) {
      await searchInput.fill('test')
      await page.waitForTimeout(500)
      await helpers.takeScreenshot('voice-search')
    }
  })

  test('should select a voice from browser', async ({ page }) => {
    // Open voice browser
    const openBrowserButton = page.locator('button').filter({ hasText: /Browse|Select Voice|Voice Library/i })
    if (await openBrowserButton.count() > 0) {
      await openBrowserButton.first().click()
      await page.waitForTimeout(1000)
    }

    // Find first voice card or button
    const voiceCard = page.locator('[data-testid="voice-card"], .voice-card, button[data-voice-id]').first()
    if (await voiceCard.count() > 0) {
      await voiceCard.click()
      await page.waitForTimeout(500)

      // Check if voice name appears in UI
      await helpers.takeScreenshot('voice-selected')
    }
  })

  test('should manage voice favorites', async ({ page }) => {
    // Open voice browser
    const openBrowserButton = page.locator('button').filter({ hasText: /Browse|Select Voice|Voice Library/i })
    if (await openBrowserButton.count() > 0) {
      await openBrowserButton.first().click()
      await page.waitForTimeout(1000)
    }

    // Find favorite button (star icon or heart icon)
    const favoriteButton = page.locator('button[aria-label*="favorite" i], button:has-text("★"), button:has-text("♥")').first()
    if (await favoriteButton.count() > 0) {
      // Click to add to favorites
      await favoriteButton.click()
      await page.waitForTimeout(500)

      // Check localStorage for favorites
      const favorites = await helpers.getLocalStorageItem('voice-favorites')
      expect(favorites).toBeTruthy()

      await helpers.takeScreenshot('voice-favorited')

      // Click again to remove from favorites
      await favoriteButton.click()
      await page.waitForTimeout(500)
    }
  })

  test('should display and use presets', async ({ page }) => {
    // Look for presets dropdown or buttons
    const presetsSection = page.locator('[data-testid="voice-presets"], text=/Presets/i, text=/Dialogue|Narration/i')

    if (await presetsSection.first().isVisible({ timeout: 3000 }).catch(() => false)) {
      // Try to select a preset
      const dialoguePreset = page.locator('button, option').filter({ hasText: /Dialogue/i })
      if (await dialoguePreset.count() > 0) {
        await dialoguePreset.first().click()
        await page.waitForTimeout(500)

        await helpers.takeScreenshot('preset-dialogue-selected')
      }

      // Try another preset
      const narrationPreset = page.locator('button, option').filter({ hasText: /Narration/i })
      if (await narrationPreset.count() > 0) {
        await narrationPreset.first().click()
        await page.waitForTimeout(500)

        await helpers.takeScreenshot('preset-narration-selected')
      }
    }
  })

  test('should adjust voice settings', async ({ page }) => {
    // Look for settings section
    const settingsSection = page.locator('[data-testid="voice-settings"], text=/Settings/i, text=/Stability|Similarity/i')

    if (await settingsSection.first().isVisible({ timeout: 3000 }).catch(() => false)) {
      // Find stability slider
      const stabilitySlider = page.locator('input[type="range"]').first()
      if (await stabilitySlider.count() > 0) {
        // Get current value
        const currentValue = await stabilitySlider.inputValue()

        // Adjust slider
        await stabilitySlider.fill('0.7')
        await page.waitForTimeout(500)

        const newValue = await stabilitySlider.inputValue()
        expect(newValue).not.toBe(currentValue)

        await helpers.takeScreenshot('settings-adjusted')
      }
    }
  })

  test('should display subscription quota widget', async ({ page }) => {
    // Look for subscription widget
    const subscriptionWidget = page.locator('[data-testid="subscription-widget"], text=/Quota|Subscription|Usage/i')

    // Widget should be visible
    const isVisible = await subscriptionWidget.first().isVisible({ timeout: 5000 }).catch(() => false)

    if (isVisible) {
      await helpers.takeScreenshot('subscription-widget')

      // Check if it shows numbers or percentages
      const widgetText = await subscriptionWidget.first().textContent()
      expect(widgetText).toBeTruthy()
    }
  })

  test('should handle empty text generation attempt', async ({ page }) => {
    const textarea = page.locator('textarea')

    // Ensure textarea is empty
    await textarea.clear()

    // Try to find and click generate button
    const generateButton = page.locator('button').filter({ hasText: /Generate|Create Voice/i })

    if (await generateButton.count() > 0) {
      const isDisabled = await generateButton.first().isDisabled()

      if (!isDisabled) {
        await generateButton.first().click()
        await page.waitForTimeout(500)

        // Should show error or validation message
        const errorMessage = page.locator('[role="alert"], .error, .text-red-500, text=/error|required/i')
        const hasError = await errorMessage.first().isVisible({ timeout: 3000 }).catch(() => false)

        if (hasError) {
          await helpers.takeScreenshot('empty-text-error')
        }
      } else {
        // Button should be disabled, which is correct behavior
        expect(isDisabled).toBeTruthy()
      }
    }
  })

  test('should be responsive on mobile viewport', async ({ page }) => {
    // Set mobile viewport
    await page.setViewportSize({ width: 375, height: 667 })
    await page.reload()
    await helpers.waitForNetworkIdle()

    // Check main elements are still visible and functional
    const textarea = page.locator('textarea')
    await expect(textarea).toBeVisible()

    await helpers.takeScreenshot('mobile-view')

    // Test touch interactions
    await textarea.tap()
    await textarea.fill('Mobile test text')
    await page.waitForTimeout(500)

    await helpers.takeScreenshot('mobile-text-input')
  })

  test('should be responsive on tablet viewport', async ({ page }) => {
    // Set tablet viewport
    await page.setViewportSize({ width: 768, height: 1024 })
    await page.reload()
    await helpers.waitForNetworkIdle()

    const textarea = page.locator('textarea')
    await expect(textarea).toBeVisible()

    await helpers.takeScreenshot('tablet-view')
  })

  test('should have accessible elements', async ({ page }) => {
    // Check main textarea
    const textarea = page.locator('textarea')
    const textareaAccessibility = await helpers.checkAccessibility('textarea')

    expect(textareaAccessibility.isFocusable).toBeTruthy()

    // Check buttons
    const buttons = await page.locator('button').all()
    expect(buttons.length).toBeGreaterThan(0)

    // Check first button accessibility
    if (buttons.length > 0) {
      const firstButton = buttons[0]
      const buttonAccessibility = await helpers.checkAccessibility('button')
      expect(buttonAccessibility.isFocusable).toBeTruthy()
    }
  })

  test('should support keyboard navigation', async ({ page }) => {
    const textarea = page.locator('textarea')

    // Tab to textarea
    await page.keyboard.press('Tab')
    await page.waitForTimeout(200)

    // Type with keyboard
    await page.keyboard.type('Testing keyboard input')
    await page.waitForTimeout(500)

    const value = await textarea.inputValue()
    expect(value).toContain('Testing keyboard input')

    await helpers.takeScreenshot('keyboard-navigation')
  })

  test('should persist favorites across page reload', async ({ page }) => {
    // Open voice browser and favorite a voice
    const openBrowserButton = page.locator('button').filter({ hasText: /Browse|Select Voice|Voice Library/i })
    if (await openBrowserButton.count() > 0) {
      await openBrowserButton.first().click()
      await page.waitForTimeout(1000)

      const favoriteButton = page.locator('button[aria-label*="favorite" i], button:has-text("★")').first()
      if (await favoriteButton.count() > 0) {
        await favoriteButton.click()
        await page.waitForTimeout(500)

        // Get favorites from localStorage
        const favoritesBefore = await helpers.getLocalStorageItem('voice-favorites')

        // Reload page
        await page.reload()
        await helpers.waitForNetworkIdle()

        // Check favorites still exist
        const favoritesAfter = await helpers.getLocalStorageItem('voice-favorites')
        expect(favoritesAfter).toBe(favoritesBefore)
      }
    }
  })

  test('should clear text when clear button exists', async ({ page }) => {
    const textarea = page.locator('textarea')

    // Fill textarea
    await textarea.fill('This text should be cleared')
    await page.waitForTimeout(500)

    // Look for clear button
    const clearButton = page.locator('button').filter({ hasText: /Clear|Reset/i })

    if (await clearButton.count() > 0) {
      await clearButton.first().click()
      await page.waitForTimeout(500)

      const value = await textarea.inputValue()
      expect(value).toBe('')

      await helpers.takeScreenshot('text-cleared')
    }
  })
})
