import { Page, expect } from 'playwright/test'
import * as fs from 'fs'
import * as path from 'path'

/**
 * Test Helper Functions
 *
 * Real testing utilities without mocks or spies.
 * Following Hyperscape testing standards.
 */

export class TestHelpers {
  constructor(public page: Page) {}

  /**
   * Navigate to a specific route and wait for it to load
   */
  async navigateTo(route: string): Promise<void> {
    await this.page.goto(route)
    await this.page.waitForLoadState('networkidle')
    await this.page.waitForTimeout(500) // Allow React to settle
  }

  /**
   * Take a screenshot with a descriptive name
   */
  async takeScreenshot(name: string): Promise<void> {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-')
    const filename = `${name}-${timestamp}.png`
    await this.page.screenshot({
      path: path.join('test-results', 'screenshots', filename),
      fullPage: true
    })
  }

  /**
   * Wait for an element to be visible with custom timeout
   */
  async waitForElement(selector: string, timeout: number = 10000): Promise<void> {
    await this.page.waitForSelector(selector, {
      state: 'visible',
      timeout
    })
  }

  /**
   * Wait for text to appear on the page
   */
  async waitForText(text: string, timeout: number = 10000): Promise<void> {
    await this.page.waitForSelector(`text=${text}`, {
      timeout
    })
  }

  /**
   * Check if element exists without throwing
   */
  async elementExists(selector: string): Promise<boolean> {
    const element = await this.page.$(selector)
    return element !== null
  }

  /**
   * Get text content of an element
   */
  async getTextContent(selector: string): Promise<string | null> {
    const element = await this.page.$(selector)
    return element ? await element.textContent() : null
  }

  /**
   * Clear localStorage
   */
  async clearLocalStorage(): Promise<void> {
    try {
      await this.page.evaluate(() => {
        localStorage.clear()
      })
    } catch (error) {
      // localStorage not available yet, that's okay
      console.log('[TestHelper] localStorage not available, skipping clear')
    }
  }

  /**
   * Get localStorage item
   */
  async getLocalStorageItem(key: string): Promise<string | null> {
    return await this.page.evaluate((k) => {
      return localStorage.getItem(k)
    }, key)
  }

  /**
   * Set localStorage item
   */
  async setLocalStorageItem(key: string, value: string): Promise<void> {
    await this.page.evaluate(({ k, v }) => {
      localStorage.setItem(k, v)
    }, { k: key, v: value })
  }

  /**
   * Log error to file
   */
  async logError(testName: string, error: Error): Promise<void> {
    const logDir = path.join(process.cwd(), 'logs')
    if (!fs.existsSync(logDir)) {
      fs.mkdirSync(logDir, { recursive: true })
    }

    const timestamp = new Date().toISOString()
    const logFile = path.join(logDir, `test-errors-${new Date().toISOString().split('T')[0]}.log`)

    const logEntry = `
[${timestamp}] ${testName}
Error: ${error.message}
Stack: ${error.stack}
---
`
    fs.appendFileSync(logFile, logEntry)
  }

  /**
   * Wait for network to be idle
   */
  async waitForNetworkIdle(timeout: number = 5000): Promise<void> {
    await this.page.waitForLoadState('networkidle', { timeout })
  }

  /**
   * Check if audio element is playing
   */
  async isAudioPlaying(selector: string): Promise<boolean> {
    return await this.page.evaluate((sel) => {
      const audio = document.querySelector(sel) as HTMLAudioElement
      return audio && !audio.paused && !audio.ended
    }, selector)
  }

  /**
   * Wait for audio to finish playing
   */
  async waitForAudioEnd(selector: string, timeout: number = 30000): Promise<void> {
    await this.page.waitForFunction(
      (sel) => {
        const audio = document.querySelector(sel) as HTMLAudioElement
        return audio && audio.ended
      },
      selector,
      { timeout }
    )
  }

  /**
   * Check accessibility with basic ARIA validation
   */
  async checkAccessibility(selector: string): Promise<{
    hasAriaLabel: boolean
    hasRole: boolean
    isFocusable: boolean
  }> {
    return await this.page.evaluate((sel) => {
      const element = document.querySelector(sel)
      if (!element) return { hasAriaLabel: false, hasRole: false, isFocusable: false }

      return {
        hasAriaLabel: element.hasAttribute('aria-label') || element.hasAttribute('aria-labelledby'),
        hasRole: element.hasAttribute('role'),
        isFocusable: element.hasAttribute('tabindex') ||
                     ['BUTTON', 'A', 'INPUT', 'SELECT', 'TEXTAREA'].includes(element.tagName)
      }
    }, selector)
  }

  /**
   * Get viewport dimensions
   */
  async getViewportSize(): Promise<{ width: number; height: number }> {
    return await this.page.evaluate(() => {
      return {
        width: window.innerWidth,
        height: window.innerHeight
      }
    })
  }

  /**
   * Scroll to element
   */
  async scrollToElement(selector: string): Promise<void> {
    await this.page.evaluate((sel) => {
      const element = document.querySelector(sel)
      if (element) {
        element.scrollIntoView({ behavior: 'smooth', block: 'center' })
      }
    }, selector)
  }

  /**
   * Check if element is in viewport
   */
  async isElementInViewport(selector: string): Promise<boolean> {
    return await this.page.evaluate((sel) => {
      const element = document.querySelector(sel)
      if (!element) return false

      const rect = element.getBoundingClientRect()
      return (
        rect.top >= 0 &&
        rect.left >= 0 &&
        rect.bottom <= window.innerHeight &&
        rect.right <= window.innerWidth
      )
    }, selector)
  }
}

/**
 * Create screenshots directory if it doesn't exist
 */
export function ensureScreenshotDir(): void {
  const dir = path.join(process.cwd(), 'test-results', 'screenshots')
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true })
  }
}

/**
 * Compare two numbers with tolerance
 */
export function compareWithTolerance(
  actual: number,
  expected: number,
  tolerance: number = 0.01
): boolean {
  return Math.abs(actual - expected) <= tolerance
}

/**
 * Retry an async function with exponential backoff
 */
export async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  maxRetries: number = 3,
  initialDelay: number = 1000
): Promise<T> {
  let lastError: Error | undefined

  for (let i = 0; i < maxRetries; i++) {
    try {
      return await fn()
    } catch (error) {
      lastError = error as Error
      if (i < maxRetries - 1) {
        const delay = initialDelay * Math.pow(2, i)
        await new Promise(resolve => setTimeout(resolve, delay))
      }
    }
  }

  throw lastError
}

/**
 * Fill textarea with large text efficiently
 * Avoids performance issues with character-by-character typing
 */
export async function fillLargeTextarea(page: Page, selector: string, text: string): Promise<void> {
  await page.evaluate(
    ({ sel, txt }) => {
      const element = document.querySelector(sel) as HTMLTextAreaElement
      if (element) {
        element.value = txt
        // Dispatch input and change events to trigger React
        element.dispatchEvent(new Event('input', { bubbles: true }))
        element.dispatchEvent(new Event('change', { bubbles: true }))
      }
    },
    { sel: selector, txt: text }
  )
  // Allow time for debounced updates to settle
  await page.waitForTimeout(500)
}
