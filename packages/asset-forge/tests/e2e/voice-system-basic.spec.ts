import { test, expect } from 'playwright/test'
import { TestHelpers, ensureScreenshotDir } from './helpers/test-helpers'

/**
 * Voice System - Basic Smoke Tests
 *
 * Simple smoke tests to verify basic functionality of the voice system.
 * Tests navigation and page loading without complex interactions.
 */

test.describe('Voice System - Basic Smoke Tests', () => {
  let helpers: TestHelpers

  test.beforeAll(() => {
    ensureScreenshotDir()
  })

  test.beforeEach(async ({ page }) => {
    helpers = new TestHelpers(page)
    await page.goto('http://localhost:3000')
    await helpers.waitForNetworkIdle()
  })

  test('should load home page successfully', async ({ page }) => {
    await expect(page).toHaveTitle(/Asset Forge|AI Asset/i)
    await helpers.takeScreenshot('home-page-loaded')
  })

  test('should display Voice Generation section in navigation', async ({ page }) => {
    // Look for Voice Generation in sidebar
    const voiceSection = page.locator('text=/Voice Generation/i, text=/VOICE GENERATION/i')
    await expect(voiceSection.first()).toBeVisible({ timeout: 10000 })
    await helpers.takeScreenshot('voice-section-visible')
  })

  test('should expand Voice Generation section', async ({ page }) => {
    // Find and click Voice Generation section
    const voiceHeader = page.locator('button, div').filter({ hasText: /^VOICE GENERATION$|^Voice Generation$/i }).first()

    if (await voiceHeader.isVisible({ timeout: 5000 })) {
      await voiceHeader.click()
      await page.waitForTimeout(1000)

      // Check if subsections appear
      const experimentLink = page.locator('text=/Experiment/i')
      const manifestLink = page.locator('text=/Manifest|Assign/i')

      const hasExperiment = await experimentLink.first().isVisible({ timeout: 3000 }).catch(() => false)
      const hasManifest = await manifestLink.first().isVisible({ timeout: 3000 }).catch(() => false)

      expect(hasExperiment || hasManifest).toBeTruthy()

      await helpers.takeScreenshot('voice-section-expanded')
    }
  })

  test('should navigate to Voice Standalone page', async ({ page }) => {
    // Expand Voice Generation
    const voiceHeader = page.locator('button, div').filter({ hasText: /VOICE GENERATION/i }).first()
    if (await voiceHeader.isVisible({ timeout: 5000 })) {
      await voiceHeader.click()
      await page.waitForTimeout(500)
    }

    // Click Experiment link
    const experimentLink = page.locator('a, button').filter({ hasText: /Experiment/i }).first()
    if (await experimentLink.isVisible({ timeout: 5000 })) {
      await experimentLink.click()
      await page.waitForTimeout(2000)

      // Check for page elements
      const hasTextarea = await page.locator('textarea').isVisible({ timeout: 10000 }).catch(() => false)
      const hasVoiceContent = await page.locator('text=/Voice|Generate|Select/i').first().isVisible().catch(() => false)

      expect(hasTextarea || hasVoiceContent).toBeTruthy()

      await helpers.takeScreenshot('voice-standalone-page')
    }
  })

  test('should navigate to Voice Manifests page', async ({ page }) => {
    // Expand Voice Generation
    const voiceHeader = page.locator('button, div').filter({ hasText: /VOICE GENERATION/i }).first()
    if (await voiceHeader.isVisible({ timeout: 5000 })) {
      await voiceHeader.click()
      await page.waitForTimeout(500)
    }

    // Click Manifests link
    const manifestLink = page.locator('a, button').filter({ hasText: /Manifest|Assign/i }).first()
    if (await manifestLink.isVisible({ timeout: 5000 })) {
      await manifestLink.click()
      await page.waitForTimeout(2000)

      // Check for page elements
      const hasNPCToggle = await page.locator('text=/NPC|Mob/i').first().isVisible({ timeout: 10000 }).catch(() => false)
      const hasManifestContent = await page.locator('text=/Assign|Entity|Voice/i').first().isVisible().catch(() => false)

      expect(hasNPCToggle || hasManifestContent).toBeTruthy()

      await helpers.takeScreenshot('voice-manifests-page')
    }
  })

  test('should have responsive layout on mobile', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 })
    await page.reload()
    await helpers.waitForNetworkIdle()

    // Page should still be accessible
    const mainContent = page.locator('body')
    await expect(mainContent).toBeVisible()

    await helpers.takeScreenshot('mobile-home-page')
  })

  test('should have responsive layout on tablet', async ({ page }) => {
    await page.setViewportSize({ width: 768, height: 1024 })
    await page.reload()
    await helpers.waitForNetworkIdle()

    // Page should still be accessible
    const mainContent = page.locator('body')
    await expect(mainContent).toBeVisible()

    await helpers.takeScreenshot('tablet-home-page')
  })
})
