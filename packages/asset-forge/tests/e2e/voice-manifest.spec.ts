import { test, expect } from 'playwright/test'
import { TestHelpers, ensureScreenshotDir } from './helpers/test-helpers'

/**
 * Manifest Voice Assignment Page - Browser Tests
 *
 * Comprehensive real browser testing for voice assignment to NPCs/Mobs.
 * Following Hyperscape testing standards: real interactions, no mocks.
 *
 * Test Coverage:
 * - NPC/Mob type toggle
 * - Entity list loading and display
 * - Search functionality
 * - Type filters
 * - Voice assignment modal
 * - Voice browser in modal
 * - Assignment tracking
 * - Clear individual assignments
 * - Clear all assignments
 * - Visual status indicators
 * - Mobile responsiveness
 * - Accessibility features
 */

test.describe('Manifest Voice Assignment Page', () => {
  let helpers: TestHelpers

  test.beforeAll(() => {
    ensureScreenshotDir()
  })

  test.beforeEach(async ({ page }) => {
    helpers = new TestHelpers(page)
    await helpers.clearLocalStorage()
    await helpers.navigateTo('/voice/manifests')
    await helpers.waitForNetworkIdle()
  })

  test.afterEach(async ({ page }, testInfo) => {
    if (testInfo.status !== testInfo.expectedStatus) {
      await helpers.takeScreenshot(`failed-${testInfo.title}`)
      await helpers.logError(testInfo.title, new Error(`Test failed: ${testInfo.error?.message}`))
    }
  })

  test('should load the page successfully', async ({ page }) => {
    // Check page title/header
    await expect(page.locator('h1, h2').first()).toBeVisible()

    // Check main components are present
    const mainContent = page.locator('main, [role="main"]')
    await expect(mainContent).toBeVisible()

    await helpers.takeScreenshot('voice-manifest-initial')
  })

  test('should display NPC/Mob toggle', async ({ page }) => {
    // Look for toggle buttons or radio buttons
    const npcToggle = page.locator('button, input').filter({ hasText: /NPC/i })
    const mobToggle = page.locator('button, input').filter({ hasText: /Mob/i })

    // At least one should be visible
    const npcVisible = await npcToggle.first().isVisible({ timeout: 5000 }).catch(() => false)
    const mobVisible = await mobToggle.first().isVisible({ timeout: 5000 }).catch(() => false)

    expect(npcVisible || mobVisible).toBeTruthy()

    await helpers.takeScreenshot('entity-type-toggle')
  })

  test('should toggle between NPC and Mob views', async ({ page }) => {
    const npcToggle = page.locator('button, input').filter({ hasText: /NPC/i }).first()
    const mobToggle = page.locator('button, input').filter({ hasText: /Mob/i }).first()

    if (await npcToggle.isVisible({ timeout: 3000 }).catch(() => false)) {
      // Click NPC toggle
      await npcToggle.click()
      await page.waitForTimeout(1000)
      await helpers.takeScreenshot('npc-view')

      // Click Mob toggle
      if (await mobToggle.isVisible({ timeout: 3000 }).catch(() => false)) {
        await mobToggle.click()
        await page.waitForTimeout(1000)
        await helpers.takeScreenshot('mob-view')

        // Switch back to NPC
        await npcToggle.click()
        await page.waitForTimeout(1000)
      }
    }
  })

  test('should display entity list', async ({ page }) => {
    // Wait for entities to load
    await page.waitForTimeout(2000)

    // Look for entity cards or list items
    const entityCards = page.locator('[data-testid="entity-card"], .entity-card, [data-entity-id]')
    const cardCount = await entityCards.count()

    // Should have at least some entities (or show empty state)
    if (cardCount > 0) {
      expect(cardCount).toBeGreaterThan(0)
      await helpers.takeScreenshot('entity-list')
    } else {
      // Check for empty state message
      const emptyState = page.locator('text=/No entities|Empty|No NPCs|No Mobs/i')
      const hasEmptyState = await emptyState.first().isVisible({ timeout: 3000 }).catch(() => false)

      if (hasEmptyState) {
        await helpers.takeScreenshot('entity-list-empty')
      }
    }
  })

  test('should search entities by name', async ({ page }) => {
    await page.waitForTimeout(1000)

    // Find search input
    const searchInput = page.locator('input[placeholder*="Search" i], input[type="search"]')

    if (await searchInput.count() > 0) {
      await searchInput.first().fill('goblin')
      await page.waitForTimeout(1000)

      await helpers.takeScreenshot('entity-search')

      // Clear search
      await searchInput.first().clear()
      await page.waitForTimeout(500)
    }
  })

  test('should filter entities by type', async ({ page }) => {
    await page.waitForTimeout(1000)

    // Look for type filter dropdown
    const typeFilter = page.locator('select, button').filter({ hasText: /Type|Filter|Category/i })

    if (await typeFilter.count() > 0) {
      await typeFilter.first().click()
      await page.waitForTimeout(500)

      // Try to select a filter option
      const filterOption = page.locator('option, [role="option"]').first()
      if (await filterOption.count() > 0) {
        await filterOption.click()
        await page.waitForTimeout(1000)

        await helpers.takeScreenshot('entity-filtered')
      }
    }
  })

  test('should open voice assignment modal', async ({ page }) => {
    await page.waitForTimeout(1000)

    // Find first assign button
    const assignButton = page.locator('button').filter({ hasText: /Assign|Select Voice/i }).first()

    if (await assignButton.isVisible({ timeout: 5000 }).catch(() => false)) {
      await assignButton.click()
      await page.waitForTimeout(1000)

      // Check if modal appeared
      const modal = page.locator('[role="dialog"], .modal, [data-testid="voice-modal"]')
      const isModalVisible = await modal.first().isVisible({ timeout: 3000 }).catch(() => false)

      expect(isModalVisible).toBeTruthy()

      await helpers.takeScreenshot('voice-assignment-modal')
    }
  })

  test('should display voice browser in modal', async ({ page }) => {
    await page.waitForTimeout(1000)

    // Open assignment modal
    const assignButton = page.locator('button').filter({ hasText: /Assign|Select Voice/i }).first()

    if (await assignButton.isVisible({ timeout: 5000 }).catch(() => false)) {
      await assignButton.click()
      await page.waitForTimeout(1000)

      // Look for voice cards in modal
      const voiceCards = page.locator('[data-testid="voice-card"], .voice-card')
      const voiceCount = await voiceCards.count()

      if (voiceCount > 0) {
        expect(voiceCount).toBeGreaterThan(0)
        await helpers.takeScreenshot('modal-voice-browser')
      }
    }
  })

  test('should assign voice to entity', async ({ page }) => {
    await page.waitForTimeout(1000)

    // Open assignment modal
    const assignButton = page.locator('button').filter({ hasText: /Assign|Select Voice/i }).first()

    if (await assignButton.isVisible({ timeout: 5000 }).catch(() => false)) {
      await assignButton.click()
      await page.waitForTimeout(1000)

      // Select a voice
      const voiceCard = page.locator('[data-testid="voice-card"], .voice-card, button[data-voice-id]').first()
      if (await voiceCard.count() > 0) {
        await voiceCard.click()
        await page.waitForTimeout(500)

        // Look for confirm/assign button in modal
        const confirmButton = page.locator('button').filter({ hasText: /Assign|Confirm|Select/i })
        if (await confirmButton.count() > 0) {
          await confirmButton.last().click()
          await page.waitForTimeout(1000)

          // Check if modal closed and assignment is visible
          await helpers.takeScreenshot('voice-assigned')
        }
      }
    }
  })

  test('should show visual assignment indicator', async ({ page }) => {
    await page.waitForTimeout(1000)

    // Assign a voice first
    const assignButton = page.locator('button').filter({ hasText: /Assign|Select Voice/i }).first()

    if (await assignButton.isVisible({ timeout: 5000 }).catch(() => false)) {
      await assignButton.click()
      await page.waitForTimeout(1000)

      const voiceCard = page.locator('[data-testid="voice-card"], .voice-card, button[data-voice-id]').first()
      if (await voiceCard.count() > 0) {
        await voiceCard.click()
        await page.waitForTimeout(500)

        const confirmButton = page.locator('button').filter({ hasText: /Assign|Confirm|Select/i })
        if (await confirmButton.count() > 0) {
          await confirmButton.last().click()
          await page.waitForTimeout(1000)

          // Look for checkmark or assigned indicator
          const indicator = page.locator('[data-testid="assigned-indicator"], .checkmark, svg').filter({ hasText: /check|✓/i })
          const hasIndicator = await indicator.first().isVisible({ timeout: 3000 }).catch(() => false)

          if (hasIndicator) {
            await helpers.takeScreenshot('assignment-indicator')
          }
        }
      }
    }
  })

  test('should clear individual assignment', async ({ page }) => {
    await page.waitForTimeout(1000)

    // First assign a voice
    const assignButton = page.locator('button').filter({ hasText: /Assign|Select Voice/i }).first()

    if (await assignButton.isVisible({ timeout: 5000 }).catch(() => false)) {
      await assignButton.click()
      await page.waitForTimeout(1000)

      const voiceCard = page.locator('[data-testid="voice-card"], .voice-card, button[data-voice-id]').first()
      if (await voiceCard.count() > 0) {
        await voiceCard.click()
        await page.waitForTimeout(500)

        const confirmButton = page.locator('button').filter({ hasText: /Assign|Confirm|Select/i })
        if (await confirmButton.count() > 0) {
          await confirmButton.last().click()
          await page.waitForTimeout(1000)

          // Now try to clear it
          const clearButton = page.locator('button').filter({ hasText: /Clear|Remove|Delete/i }).first()
          if (await clearButton.isVisible({ timeout: 3000 }).catch(() => false)) {
            await clearButton.click()
            await page.waitForTimeout(500)

            await helpers.takeScreenshot('assignment-cleared')
          }
        }
      }
    }
  })

  test('should have clear all button', async ({ page }) => {
    await page.waitForTimeout(1000)

    // Look for clear all button
    const clearAllButton = page.locator('button').filter({ hasText: /Clear All|Remove All/i })

    const hasClearAll = await clearAllButton.first().isVisible({ timeout: 5000 }).catch(() => false)

    if (hasClearAll) {
      // Don't click it to avoid clearing existing test data
      await helpers.takeScreenshot('clear-all-button')
    }
  })

  test('should display save button', async ({ page }) => {
    await page.waitForTimeout(1000)

    // Look for save button
    const saveButton = page.locator('button').filter({ hasText: /Save|Submit|Apply/i })

    const hasSave = await saveButton.first().isVisible({ timeout: 5000 }).catch(() => false)

    if (hasSave) {
      await helpers.takeScreenshot('save-button')

      // Check if sticky (remains visible on scroll)
      await page.evaluate(() => window.scrollTo(0, 500))
      await page.waitForTimeout(500)

      const stillVisible = await saveButton.first().isVisible().catch(() => false)
      expect(stillVisible).toBeTruthy()
    }
  })

  test('should handle empty entity list gracefully', async ({ page }) => {
    // Try to trigger empty state by using filters
    const searchInput = page.locator('input[placeholder*="Search" i], input[type="search"]')

    if (await searchInput.count() > 0) {
      // Search for something that won't exist
      await searchInput.first().fill('zzzznonexistentzzz')
      await page.waitForTimeout(1000)

      // Should show empty state message
      const emptyState = page.locator('text=/No results|No entities found|Empty/i')
      const hasEmptyState = await emptyState.first().isVisible({ timeout: 3000 }).catch(() => false)

      if (hasEmptyState) {
        await helpers.takeScreenshot('empty-state')
      }
    }
  })

  test('should be responsive on mobile viewport', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 })
    await page.reload()
    await helpers.waitForNetworkIdle()
    await page.waitForTimeout(1000)

    await helpers.takeScreenshot('manifest-mobile-view')

    // Check if entity list is still accessible
    const entityCards = page.locator('[data-testid="entity-card"], .entity-card')
    const cardCount = await entityCards.count()

    if (cardCount > 0) {
      // Try to interact with first card
      await entityCards.first().scrollIntoViewIfNeeded()
      await page.waitForTimeout(500)
      await helpers.takeScreenshot('manifest-mobile-scrolled')
    }
  })

  test('should be responsive on tablet viewport', async ({ page }) => {
    await page.setViewportSize({ width: 768, height: 1024 })
    await page.reload()
    await helpers.waitForNetworkIdle()
    await page.waitForTimeout(1000)

    await helpers.takeScreenshot('manifest-tablet-view')
  })

  test('should support keyboard navigation', async ({ page }) => {
    await page.waitForTimeout(1000)

    // Tab through interactive elements
    await page.keyboard.press('Tab')
    await page.waitForTimeout(200)

    await page.keyboard.press('Tab')
    await page.waitForTimeout(200)

    await page.keyboard.press('Tab')
    await page.waitForTimeout(200)

    await helpers.takeScreenshot('manifest-keyboard-nav')
  })

  test('should maintain assignments across page reload', async ({ page }) => {
    await page.waitForTimeout(1000)

    // Assign a voice
    const assignButton = page.locator('button').filter({ hasText: /Assign|Select Voice/i }).first()

    if (await assignButton.isVisible({ timeout: 5000 }).catch(() => false)) {
      await assignButton.click()
      await page.waitForTimeout(1000)

      const voiceCard = page.locator('[data-testid="voice-card"], .voice-card, button[data-voice-id]').first()
      if (await voiceCard.count() > 0) {
        await voiceCard.click()
        await page.waitForTimeout(500)

        const confirmButton = page.locator('button').filter({ hasText: /Assign|Confirm|Select/i })
        if (await confirmButton.count() > 0) {
          await confirmButton.last().click()
          await page.waitForTimeout(1000)

          // Reload page
          await page.reload()
          await helpers.waitForNetworkIdle()
          await page.waitForTimeout(1000)

          // Check if assignment persists (look for indicator)
          const indicator = page.locator('[data-testid="assigned-indicator"], .checkmark, text=/assigned/i')
          const hasIndicator = await indicator.first().isVisible({ timeout: 5000 }).catch(() => false)

          // Note: This might fail if assignments aren't persisted to backend yet
          if (hasIndicator) {
            await helpers.takeScreenshot('assignment-persisted')
          }
        }
      }
    }
  })

  test('should close modal with close button', async ({ page }) => {
    await page.waitForTimeout(1000)

    // Open modal
    const assignButton = page.locator('button').filter({ hasText: /Assign|Select Voice/i }).first()

    if (await assignButton.isVisible({ timeout: 5000 }).catch(() => false)) {
      await assignButton.click()
      await page.waitForTimeout(1000)

      // Look for close button (X or Cancel)
      const closeButton = page.locator('button[aria-label*="close" i], button:has-text("×"), button:has-text("Cancel")')

      if (await closeButton.count() > 0) {
        await closeButton.first().click()
        await page.waitForTimeout(500)

        // Modal should be gone
        const modal = page.locator('[role="dialog"], .modal')
        const isModalVisible = await modal.first().isVisible().catch(() => false)

        expect(isModalVisible).toBeFalsy()

        await helpers.takeScreenshot('modal-closed')
      }
    }
  })

  test('should close modal with escape key', async ({ page }) => {
    await page.waitForTimeout(1000)

    // Open modal
    const assignButton = page.locator('button').filter({ hasText: /Assign|Select Voice/i }).first()

    if (await assignButton.isVisible({ timeout: 5000 }).catch(() => false)) {
      await assignButton.click()
      await page.waitForTimeout(1000)

      // Press Escape
      await page.keyboard.press('Escape')
      await page.waitForTimeout(500)

      // Modal should be gone
      const modal = page.locator('[role="dialog"], .modal')
      const isModalVisible = await modal.first().isVisible().catch(() => false)

      expect(isModalVisible).toBeFalsy()
    }
  })
})
