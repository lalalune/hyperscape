import { spawn, ChildProcess } from 'child_process'
import { promises as fs } from 'fs'
import { join } from 'path'
import { chromium, Browser, Page } from 'playwright'
import * as net from 'net'

export interface TestEnvironmentConfig {
  hyperfyPort?: number
  generationPort?: number
  timeout?: number
  headless?: boolean
  enableWebGL?: boolean
  cleanupOnExit?: boolean
}

export interface ServerInfo {
  process: ChildProcess
  port: number
  ready: boolean
  url: string
}

export class EnhancedTestRunner {
  private servers: Map<string, ServerInfo> = new Map()
  private testPorts = new Map<string, number>()
  private browser: Browser | null = null
  private testOutputDir: string
  private config: Required<TestEnvironmentConfig>

  constructor(config: TestEnvironmentConfig = {}) {
    this.config = {
      hyperfyPort: config.hyperfyPort || 0, // 0 = find available
      generationPort: config.generationPort || 0,
      timeout: config.timeout || 60000,
      headless: config.headless ?? process.env.CI === 'true',
      enableWebGL: config.enableWebGL ?? true,
      cleanupOnExit: config.cleanupOnExit ?? true
    }
    
    this.testOutputDir = join(process.cwd(), 'test-results', 'enhanced')
    
    if (this.config.cleanupOnExit) {
      process.on('exit', () => this.cleanup())
      process.on('SIGINT', () => this.cleanup())
      process.on('SIGTERM', () => this.cleanup())
    }
  }

  async setupTestEnvironment(): Promise<void> {
    console.log('🚀 Setting up enhanced test environment...')
    
    // Ensure output directory exists
    await fs.mkdir(this.testOutputDir, { recursive: true })
    
    // Find available ports
    this.testPorts.set('hyperfy', await this.findAvailablePort(this.config.hyperfyPort || 3000))
    this.testPorts.set('generation', await this.findAvailablePort(this.config.generationPort || 8080))
    
    console.log(`📡 Allocated ports: Hyperfy=${this.testPorts.get('hyperfy')}, Generation=${this.testPorts.get('generation')}`)
    
    // Setup test database
    await this.setupTestDatabase()
    
    // Start required servers
    await this.startHyperfyServer()
    
    console.log('✅ Test environment ready')
  }

  private async findAvailablePort(preferredPort: number): Promise<number> {
    if (preferredPort === 0) {
      return this.findRandomAvailablePort()
    }
    
    const isAvailable = await this.isPortAvailable(preferredPort)
    if (isAvailable) {
      return preferredPort
    }
    
    // If preferred port is taken, find a random one
    return this.findRandomAvailablePort()
  }

  private async findRandomAvailablePort(): Promise<number> {
    return new Promise((resolve, reject) => {
      const server = net.createServer()
      server.unref()
      server.on('error', reject)
      server.listen(0, () => {
        const address = server.address()
        if (address && typeof address === 'object') {
          const port = address.port
          server.close(() => resolve(port))
        } else {
          reject(new Error('Could not determine port'))
        }
      })
    })
  }

  private async isPortAvailable(port: number): Promise<boolean> {
    return new Promise(resolve => {
      const server = net.createServer()
      server.unref()
      server.on('error', () => resolve(false))
      server.listen(port, () => {
        server.close(() => resolve(true))
      })
    })
  }

  private async setupTestDatabase(): Promise<void> {
    const dbPath = join(this.testOutputDir, 'test.db')
    
    // Remove existing test database
    try {
      await fs.unlink(dbPath)
    } catch (error) {
      // File doesn't exist, that's fine
    }
    
    // Create fresh test database
    // This would normally initialize the SQLite database
    console.log(`📁 Test database prepared at: ${dbPath}`)
  }

  private async startHyperfyServer(): Promise<void> {
    const port = this.testPorts.get('hyperfy')!
    console.log(`🌍 Starting Hyperfy server on port ${port}...`)
    
    const hyperfyPath = join(process.cwd(), '..', 'hyperfy')
    
    return new Promise((resolve, reject) => {
      const serverProcess = spawn('npm', ['start', '--', '--headless', `--port=${port}`], {
        cwd: hyperfyPath,
        env: { 
          ...process.env,
          NODE_ENV: 'test',
          HYPERFY_TEST_MODE: 'true',
          PORT: port.toString()
        },
        stdio: ['pipe', 'pipe', 'pipe']
      })

      let serverOutput = ''
      let serverReady = false
      
      serverProcess.stdout?.on('data', (data) => {
        const output = data.toString()
        serverOutput += output
        
        console.log('[Hyperfy]', output.trim())
        
        if (output.includes('running on port') || output.includes(`localhost:${port}`)) {
          console.log('✅ Hyperfy server ready')
          serverReady = true
          
          this.servers.set('hyperfy', {
            process: serverProcess,
            port,
            ready: true,
            url: `http://localhost:${port}`
          })
          
          // Give server a moment to fully initialize
          setTimeout(resolve, 2000)
        }
        
        if (output.includes('EADDRINUSE')) {
          reject(new Error(`Port ${port} is already in use`))
        }
      })

      serverProcess.stderr?.on('data', (data) => {
        const output = data.toString()
        
        // Filter out common warnings
        if (!output.includes('npm warn') && !output.includes('GLTFLoader')) {
          console.log('[Hyperfy Error]', output.trim())
        }
        
        if (output.includes('EADDRINUSE')) {
          reject(new Error(`Port ${port} is already in use`))
        }
      })

      serverProcess.on('close', (code) => {
        if (!serverReady && code !== 0) {
          reject(new Error(`Hyperfy server exited with code ${code}`))
        }
      })

      serverProcess.on('error', (error) => {
        reject(new Error(`Failed to start Hyperfy server: ${error.message}`))
      })

      // Timeout if server doesn't start
      setTimeout(() => {
        if (!serverReady) {
          serverProcess.kill()
          reject(new Error('Hyperfy server startup timeout'))
        }
      }, this.config.timeout)
    })
  }

  async setupEnhancedBrowser(): Promise<Page> {
    console.log('🌐 Setting up enhanced browser with WebGL support...')
    
    const browserArgs = [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-web-security',
      '--allow-running-insecure-content',
      '--ignore-gpu-blacklist'
    ]
    
    if (this.config.enableWebGL) {
      browserArgs.push(
        '--use-gl=swiftshader', // Software WebGL renderer
        '--enable-webgl',
        '--enable-accelerated-2d-canvas'
      )
    }
    
    this.browser = await chromium.launch({
      headless: this.config.headless,
      args: browserArgs
    })
    
    const context = await this.browser.newContext({
      viewport: { width: 1920, height: 1080 },
      ignoreHTTPSErrors: true
    })
    
    const page = await context.newPage()
    
    // Setup console logging
    page.on('console', msg => {
      const text = msg.text()
      if (text.includes('Error') || text.includes('error')) {
        console.log(`[Browser Error] ${text}`)
      } else if (text.includes('RPG') || text.includes('🎮')) {
        console.log(`[Browser Game] ${text}`)
      }
    })
    
    // Setup error logging
    page.on('pageerror', err => {
      console.log(`[Browser Page Error] ${err.message}`)
    })
    
    if (this.config.enableWebGL) {
      // Verify WebGL is available
      try {
        await page.waitForFunction(() => {
          const canvas = document.createElement('canvas')
          const gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl')
          return !!gl
        }, { timeout: 10000 })
        
        console.log('✅ WebGL support verified')
      } catch (error) {
        console.warn('⚠️ WebGL verification failed, tests may not work properly')
      }
    }
    
    return page
  }

  getServerUrl(serverName: string): string {
    const server = this.servers.get(serverName)
    if (!server) {
      throw new Error(`Server '${serverName}' not found`)
    }
    return server.url
  }

  getHyperfyUrl(): string {
    return this.getServerUrl('hyperfy')
  }

  async waitForServerReady(serverName: string, timeout: number = 30000): Promise<void> {
    const server = this.servers.get(serverName)
    if (!server) {
      throw new Error(`Server '${serverName}' not found`)
    }
    
    const startTime = Date.now()
    
    while (!server.ready && Date.now() - startTime < timeout) {
      await new Promise(resolve => setTimeout(resolve, 100))
    }
    
    if (!server.ready) {
      throw new Error(`Server '${serverName}' did not become ready within ${timeout}ms`)
    }
  }

  async takeEnhancedScreenshot(page: Page, testName: string): Promise<string> {
    const timestamp = Date.now()
    const screenshotPath = join(this.testOutputDir, `${testName}-${timestamp}.png`)
    
    await page.screenshot({ 
      path: screenshotPath,
      fullPage: true 
    })
    
    console.log(`📸 Screenshot saved: ${screenshotPath}`)
    return screenshotPath
  }

  async cleanup(): Promise<void> {
    console.log('🧹 Cleaning up test environment...')
    
    // Close browser
    if (this.browser) {
      await this.browser.close()
      this.browser = null
    }
    
    // Stop all servers
    for (const [name, server] of this.servers) {
      console.log(`🛑 Stopping ${name} server...`)
      server.process.kill('SIGTERM')
      
      // Give process time to exit gracefully
      await new Promise(resolve => {
        server.process.on('exit', resolve)
        setTimeout(() => {
          server.process.kill('SIGKILL')
          resolve(undefined)
        }, 5000)
      })
    }
    
    this.servers.clear()
    
    console.log('✅ Cleanup completed')
  }
}