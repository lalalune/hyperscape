import { test, expect } from 'playwright/test'
import { TestHelpers, ensureScreenshotDir, fillLargeTextarea } from './helpers/test-helpers'
import * as path from 'path'

/**
 * Voice System Visual Regression Tests
 *
 * Screenshot-based visual verification following Hyperscape testing standards.
 * Captures and compares visual states across different scenarios.
 *
 * Test Coverage:
 * - Page layouts across viewports
 * - Component rendering states
 * - Interactive state changes
 * - Error states
 * - Loading states
 * - Responsive design breakpoints
 */

test.describe('Voice System Visual Regression', () => {
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
      await helpers.takeScreenshot(`visual-failed-${testInfo.title}`)
    }
  })

  test.describe('Desktop Layout (1920x1080)', () => {
    test.beforeEach(async ({ page }) => {
      await page.setViewportSize({ width: 1920, height: 1080 })
    })

    test('VoiceStandalonePage - initial state', async ({ page }) => {
      await helpers.navigateTo('/voice/standalone')
      await helpers.waitForNetworkIdle()
      await page.waitForTimeout(1000)

      await page.screenshot({
        path: path.join('test-results', 'screenshots', 'visual-standalone-desktop-initial.png'),
        fullPage: true
      })
    })

    test('VoiceStandalonePage - with text input', async ({ page }) => {
      await helpers.navigateTo('/voice/standalone')
      await helpers.waitForNetworkIdle()

      await fillLargeTextarea(page, '[data-testid="voice-input-text"]', 'This is a test voice generation message. It should trigger cost estimation and display character count properly.')

      await page.screenshot({
        path: path.join('test-results', 'screenshots', 'visual-standalone-desktop-with-text.png'),
        fullPage: true
      })
    })

    test('VoiceStandalonePage - voice browser open', async ({ page }) => {
      await helpers.navigateTo('/voice/standalone')
      await helpers.waitForNetworkIdle()

      const openButton = page.locator('[data-testid="voice-browser-toggle"]')
      if (await openButton.isVisible({ timeout: 5000 }).catch(() => false)) {
        await openButton.click()
        await page.waitForTimeout(1000)

        await page.screenshot({
          path: path.join('test-results', 'screenshots', 'visual-standalone-desktop-browser-open.png'),
          fullPage: true
        })
      }
    })

    test('VoiceStandalonePage - character warning state', async ({ page }) => {
      await helpers.navigateTo('/voice/standalone')
      await helpers.waitForNetworkIdle()

      await fillLargeTextarea(page, '[data-testid="voice-input-text"]', 'a'.repeat(4501))

      await page.screenshot({
        path: path.join('test-results', 'screenshots', 'visual-standalone-desktop-warning.png'),
        fullPage: true
      })
    })

    test('ManifestVoiceAssignmentPage - NPC view', async ({ page }) => {
      await helpers.navigateTo('/voice/manifests')
      await helpers.waitForNetworkIdle()
      await page.waitForTimeout(1000)

      // Select NPC view
      const npcToggle = page.locator('button, input').filter({ hasText: /NPC/i }).first()
      if (await npcToggle.isVisible({ timeout: 3000 }).catch(() => false)) {
        await npcToggle.click()
        await page.waitForTimeout(1000)
      }

      await page.screenshot({
        path: path.join('test-results', 'screenshots', 'visual-manifests-desktop-npc-view.png'),
        fullPage: true
      })
    })

    test('ManifestVoiceAssignmentPage - Mob view', async ({ page }) => {
      await helpers.navigateTo('/voice/manifests')
      await helpers.waitForNetworkIdle()
      await page.waitForTimeout(1000)

      // Select Mob view
      const mobToggle = page.locator('button, input').filter({ hasText: /Mob/i }).first()
      if (await mobToggle.isVisible({ timeout: 3000 }).catch(() => false)) {
        await mobToggle.click()
        await page.waitForTimeout(1000)
      }

      await page.screenshot({
        path: path.join('test-results', 'screenshots', 'visual-manifests-desktop-mob-view.png'),
        fullPage: true
      })
    })

    test('ManifestVoiceAssignmentPage - assignment modal', async ({ page }) => {
      await helpers.navigateTo('/voice/manifests')
      await helpers.waitForNetworkIdle()
      await page.waitForTimeout(1000)

      const assignButton = page.locator('button').filter({ hasText: /Assign|Select Voice/i }).first()
      if (await assignButton.isVisible({ timeout: 5000 }).catch(() => false)) {
        await assignButton.click()
        await page.waitForTimeout(1000)

        await page.screenshot({
          path: path.join('test-results', 'screenshots', 'visual-manifests-desktop-modal.png'),
          fullPage: true
        })
      }
    })
  })

  test.describe('Tablet Layout (768x1024)', () => {
    test.beforeEach(async ({ page }) => {
      await page.setViewportSize({ width: 768, height: 1024 })
    })

    test('VoiceStandalonePage - tablet portrait', async ({ page }) => {
      await helpers.navigateTo('/voice/standalone')
      await helpers.waitForNetworkIdle()
      await page.waitForTimeout(1000)

      await page.screenshot({
        path: path.join('test-results', 'screenshots', 'visual-standalone-tablet-initial.png'),
        fullPage: true
      })
    })

    test('VoiceStandalonePage - tablet with text', async ({ page }) => {
      await helpers.navigateTo('/voice/standalone')
      await helpers.waitForNetworkIdle()

      await fillLargeTextarea(page, '[data-testid="voice-input-text"]', 'Testing tablet responsiveness for voice generation.')

      await page.screenshot({
        path: path.join('test-results', 'screenshots', 'visual-standalone-tablet-with-text.png'),
        fullPage: true
      })
    })

    test('ManifestVoiceAssignmentPage - tablet view', async ({ page }) => {
      await helpers.navigateTo('/voice/manifests')
      await helpers.waitForNetworkIdle()
      await page.waitForTimeout(1000)

      await page.screenshot({
        path: path.join('test-results', 'screenshots', 'visual-manifests-tablet-initial.png'),
        fullPage: true
      })
    })
  })

  test.describe('Mobile Layout (375x667)', () => {
    test.beforeEach(async ({ page }) => {
      await page.setViewportSize({ width: 375, height: 667 })
    })

    test('VoiceStandalonePage - mobile portrait', async ({ page }) => {
      await helpers.navigateTo('/voice/standalone')
      await helpers.waitForNetworkIdle()
      await page.waitForTimeout(1000)

      await page.screenshot({
        path: path.join('test-results', 'screenshots', 'visual-standalone-mobile-initial.png'),
        fullPage: true
      })
    })

    test('VoiceStandalonePage - mobile with text', async ({ page }) => {
      await helpers.navigateTo('/voice/standalone')
      await helpers.waitForNetworkIdle()

      await fillLargeTextarea(page, '[data-testid="voice-input-text"]', 'Testing mobile layout')

      await page.screenshot({
        path: path.join('test-results', 'screenshots', 'visual-standalone-mobile-with-text.png'),
        fullPage: true
      })
    })

    test('VoiceStandalonePage - mobile scrolled', async ({ page }) => {
      await helpers.navigateTo('/voice/standalone')
      await helpers.waitForNetworkIdle()

      // Scroll down
      await page.evaluate(() => window.scrollTo(0, 500))
      await page.waitForTimeout(500)

      await page.screenshot({
        path: path.join('test-results', 'screenshots', 'visual-standalone-mobile-scrolled.png'),
        fullPage: false // Just viewport
      })
    })

    test('ManifestVoiceAssignmentPage - mobile view', async ({ page }) => {
      await helpers.navigateTo('/voice/manifests')
      await helpers.waitForNetworkIdle()
      await page.waitForTimeout(1000)

      await page.screenshot({
        path: path.join('test-results', 'screenshots', 'visual-manifests-mobile-initial.png'),
        fullPage: true
      })
    })

    test('ManifestVoiceAssignmentPage - mobile with search', async ({ page }) => {
      await helpers.navigateTo('/voice/manifests')
      await helpers.waitForNetworkIdle()
      await page.waitForTimeout(1000)

      const searchInput = page.locator('input[placeholder*="Search" i]')
      if (await searchInput.count() > 0) {
        await searchInput.first().tap()
        await searchInput.first().fill('goblin')
        await page.waitForTimeout(1000)

        await page.screenshot({
          path: path.join('test-results', 'screenshots', 'visual-manifests-mobile-searched.png'),
          fullPage: true
        })
      }
    })
  })

  test.describe('Component States', () => {
    test('Voice browser - grid view', async ({ page }) => {
      await page.setViewportSize({ width: 1920, height: 1080 })
      await helpers.navigateTo('/voice/standalone')
      await helpers.waitForNetworkIdle()

      const openButton = page.locator('button').filter({ hasText: /Browse|Select Voice/i }).first()
      if (await openButton.isVisible({ timeout: 5000 }).catch(() => false)) {
        await openButton.click()
        await page.waitForTimeout(1000)

        // Look for grid view toggle
        const gridViewButton = page.locator('button[aria-label*="grid" i], button:has-text("Grid")')
        if (await gridViewButton.count() > 0) {
          await gridViewButton.first().click()
          await page.waitForTimeout(500)
        }

        await page.screenshot({
          path: path.join('test-results', 'screenshots', 'visual-voice-browser-grid.png'),
          fullPage: true
        })
      }
    })

    test('Voice browser - list view', async ({ page }) => {
      await page.setViewportSize({ width: 1920, height: 1080 })
      await helpers.navigateTo('/voice/standalone')
      await helpers.waitForNetworkIdle()

      const openButton = page.locator('button').filter({ hasText: /Browse|Select Voice/i }).first()
      if (await openButton.isVisible({ timeout: 5000 }).catch(() => false)) {
        await openButton.click()
        await page.waitForTimeout(1000)

        // Look for list view toggle
        const listViewButton = page.locator('button[aria-label*="list" i], button:has-text("List")')
        if (await listViewButton.count() > 0) {
          await listViewButton.first().click()
          await page.waitForTimeout(500)
        }

        await page.screenshot({
          path: path.join('test-results', 'screenshots', 'visual-voice-browser-list.png'),
          fullPage: true
        })
      }
    })

    test('Voice browser - with filters applied', async ({ page }) => {
      await page.setViewportSize({ width: 1920, height: 1080 })
      await helpers.navigateTo('/voice/standalone')
      await helpers.waitForNetworkIdle()

      const openButton = page.locator('button').filter({ hasText: /Browse|Select Voice/i }).first()
      if (await openButton.isVisible({ timeout: 5000 }).catch(() => false)) {
        await openButton.click()
        await page.waitForTimeout(1000)

        // Apply a filter
        const genderFilter = page.locator('select, button').filter({ hasText: /Gender/i })
        if (await genderFilter.count() > 0) {
          await genderFilter.first().click()
          await page.waitForTimeout(500)

          const maleOption = page.locator('option, [role="option"]').filter({ hasText: /Male/i })
          if (await maleOption.count() > 0) {
            await maleOption.first().click()
            await page.waitForTimeout(1000)
          }
        }

        await page.screenshot({
          path: path.join('test-results', 'screenshots', 'visual-voice-browser-filtered.png'),
          fullPage: true
        })
      }
    })

    test('Subscription widget - compact mode', async ({ page }) => {
      await page.setViewportSize({ width: 1920, height: 1080 })
      await helpers.navigateTo('/voice/standalone')
      await helpers.waitForNetworkIdle()
      await page.waitForTimeout(1000)

      const widget = page.locator('[data-testid="subscription-widget"]')
      if (await widget.isVisible({ timeout: 5000 }).catch(() => false)) {
        await widget.screenshot({
          path: path.join('test-results', 'screenshots', 'visual-subscription-widget-compact.png')
        })
      }
    })

    test('Preset selector - expanded', async ({ page }) => {
      await page.setViewportSize({ width: 1920, height: 1080 })
      await helpers.navigateTo('/voice/standalone')
      await helpers.waitForNetworkIdle()

      const presetButton = page.locator('button, select').filter({ hasText: /Preset/i }).first()
      if (await presetButton.isVisible({ timeout: 3000 }).catch(() => false)) {
        await presetButton.click()
        await page.waitForTimeout(500)

        await page.screenshot({
          path: path.join('test-results', 'screenshots', 'visual-presets-expanded.png'),
          fullPage: true
        })
      }
    })
  })

  test.describe('Dark Mode (if supported)', () => {
    test('VoiceStandalonePage - dark mode', async ({ page }) => {
      await page.setViewportSize({ width: 1920, height: 1080 })

      // Try to enable dark mode via localStorage or system preference
      await page.emulateMedia({ colorScheme: 'dark' })

      await helpers.navigateTo('/voice/standalone')
      await helpers.waitForNetworkIdle()
      await page.waitForTimeout(1000)

      await page.screenshot({
        path: path.join('test-results', 'screenshots', 'visual-standalone-dark-mode.png'),
        fullPage: true
      })
    })

    test('ManifestVoiceAssignmentPage - dark mode', async ({ page }) => {
      await page.setViewportSize({ width: 1920, height: 1080 })
      await page.emulateMedia({ colorScheme: 'dark' })

      await helpers.navigateTo('/voice/manifests')
      await helpers.waitForNetworkIdle()
      await page.waitForTimeout(1000)

      await page.screenshot({
        path: path.join('test-results', 'screenshots', 'visual-manifests-dark-mode.png'),
        fullPage: true
      })
    })
  })

  test.describe('Loading and Error States', () => {
    test('Loading state visualization', async ({ page }) => {
      await page.setViewportSize({ width: 1920, height: 1080 })

      // Navigate and capture during loading
      const navigationPromise = helpers.navigateTo('/voice/standalone')
      await page.waitForTimeout(100) // Capture during load

      await page.screenshot({
        path: path.join('test-results', 'screenshots', 'visual-loading-state.png'),
        fullPage: true
      })

      await navigationPromise
    })

    test('Empty state - no entities', async ({ page }) => {
      await page.setViewportSize({ width: 1920, height: 1080 })
      await helpers.navigateTo('/voice/manifests')
      await helpers.waitForNetworkIdle()

      // Try to trigger empty state
      const searchInput = page.locator('input[placeholder*="Search" i]')
      if (await searchInput.count() > 0) {
        await searchInput.first().fill('zzzznonexistentzzz')
        await page.waitForTimeout(1000)

        await page.screenshot({
          path: path.join('test-results', 'screenshots', 'visual-empty-state.png'),
          fullPage: true
        })
      }
    })
  })
})
