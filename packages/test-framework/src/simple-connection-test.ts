import { chromium, Browser, Page } from 'playwright'

export class SimpleConnectionTest {
  private browser: Browser | null = null
  private page: Page | null = null

  async initialize(): Promise<void> {
    console.log('[SimpleConnectionTest] Initializing browser...')
    
    this.browser = await chromium.launch({
      headless: false,
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    })
    
    this.page = await this.browser.newPage()
    await this.page.setViewportSize({ width: 1920, height: 1080 })
  }

  async testConnection(url: string = 'http://localhost:3000'): Promise<boolean> {
    if (!this.page) throw new Error('Page not initialized')

    try {
      console.log(`[SimpleConnectionTest] Testing connection to ${url}`)
      
      // Try to navigate to the URL
      const response = await this.page.goto(url, { 
        waitUntil: 'networkidle',
        timeout: 30000 
      })
      
      if (!response || response.status() !== 200) {
        console.log(`[SimpleConnectionTest] Failed to connect: HTTP ${response?.status()}`)
        return false
      }

      // Check if page loads
      await this.page.waitForTimeout(3000)
      
      // Take a screenshot to verify
      await this.page.screenshot({ 
        path: './test-results/connection-test.png',
        fullPage: true 
      })
      
      console.log('[SimpleConnectionTest] Connection successful!')
      return true
      
    } catch (error) {
      console.error('[SimpleConnectionTest] Connection failed:', error)
      return false
    }
  }

  async cleanup(): Promise<void> {
    if (this.page) {
      await this.page.close()
      this.page = null
    }
    
    if (this.browser) {
      await this.browser.close()
      this.browser = null
    }
  }
}

// Run simple connection test
export async function runSimpleConnectionTest(): Promise<void> {
  const test = new SimpleConnectionTest()
  
  try {
    await test.initialize()
    const connected = await test.testConnection()
    
    if (connected) {
      console.log('✅ Connection test PASSED')
    } else {
      console.log('❌ Connection test FAILED')
    }
  } finally {
    await test.cleanup()
  }
}