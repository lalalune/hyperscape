import { promises as fs } from 'fs'
import { join } from 'path'

export interface EnvironmentConfig {
  useRealAPIs?: boolean
  skipExternalTests?: boolean
  testDataPath?: string
  mockAPIResponses?: boolean
}

export class TestEnvironment {
  private static initialized = false
  private static config: Required<EnvironmentConfig>

  static setup(config: EnvironmentConfig = {}): void {
    if (this.initialized) return

    this.config = {
      useRealAPIs: config.useRealAPIs ?? this.hasRealAPIKeys(),
      skipExternalTests: config.skipExternalTests ?? !this.hasRealAPIKeys(),
      testDataPath: config.testDataPath ?? join(process.cwd(), 'test-data'),
      mockAPIResponses: config.mockAPIResponses ?? !this.hasRealAPIKeys()
    }

    // Set test-specific environment variables
    process.env.NODE_ENV = 'test'
    process.env.HYPERFY_TEST_MODE = 'true'
    
    // Handle API keys
    this.setupAPIKeys()
    
    // Setup test logging
    this.setupTestLogging()

    this.initialized = true
    console.log('🔧 Test environment initialized:', this.config)
  }

  private static hasRealAPIKeys(): boolean {
    return !!(
      process.env.OPENAI_API_KEY?.startsWith('sk-') &&
      process.env.MESHY_API_KEY
    )
  }

  private static setupAPIKeys(): void {
    // If no real API keys, set test keys to prevent crashes
    if (!process.env.OPENAI_API_KEY) {
      process.env.OPENAI_API_KEY = 'test-key-sk-disabled-for-testing'
      console.warn('⚠️ Using test OpenAI API key - generation tests will be skipped')
    }

    if (!process.env.MESHY_API_KEY) {
      process.env.MESHY_API_KEY = 'test-key-disabled-for-testing'
      console.warn('⚠️ Using test Meshy API key - 3D generation tests will be skipped')
    }

    // Set test-specific API configurations
    if (this.config.mockAPIResponses) {
      process.env.MOCK_OPENAI_RESPONSES = 'true'
      process.env.MOCK_MESHY_RESPONSES = 'true'
    }
  }

  private static setupTestLogging(): void {
    // Suppress noisy logs during testing
    process.env.SUPPRESS_NO_CONFIG_WARNING = 'true'
    
    // Configure test-specific logging levels
    if (process.env.CI) {
      process.env.LOG_LEVEL = 'error' // Only errors in CI
    } else {
      process.env.LOG_LEVEL = 'info' // More verbose locally
    }
  }

  static shouldSkipExternalTests(): boolean {
    return this.config.skipExternalTests
  }

  static shouldUseRealAPIs(): boolean {
    return this.config.useRealAPIs
  }

  static getTestDataPath(): string {
    return this.config.testDataPath
  }

  static async ensureTestDataExists(): Promise<void> {
    await fs.mkdir(this.config.testDataPath, { recursive: true })
    
    // Create mock API response files if needed
    if (this.config.mockAPIResponses) {
      await this.createMockAPIResponses()
    }
  }

  private static async createMockAPIResponses(): Promise<void> {
    const mockDir = join(this.config.testDataPath, 'mock-responses')
    await fs.mkdir(mockDir, { recursive: true })

    // Mock OpenAI image generation response
    const mockImageResponse = {
      data: [
        {
          url: 'https://example.com/mock-generated-image.png',
          revised_prompt: 'A test image for validation'
        }
      ]
    }

    await fs.writeFile(
      join(mockDir, 'openai-image-response.json'),
      JSON.stringify(mockImageResponse, null, 2)
    )

    // Mock Meshy 3D generation response
    const mockMeshyResponse = {
      id: 'mock-task-123',
      status: 'SUCCEEDED',
      model_url: 'https://example.com/mock-model.glb',
      progress: 100,
      task_error: null,
      created_at: Date.now(),
      finished_at: Date.now() + 30000
    }

    await fs.writeFile(
      join(mockDir, 'meshy-generation-response.json'),
      JSON.stringify(mockMeshyResponse, null, 2)
    )

    console.log('📁 Mock API responses created')
  }

  static createTestConfig(): Record<string, any> {
    return {
      // Hyperfy test configuration
      hyperfy: {
        port: 0, // Auto-assign
        headless: process.env.CI === 'true',
        enableWebGL: true,
        testMode: true
      },

      // Generation service test configuration
      generation: {
        useRealAPIs: this.config.useRealAPIs,
        mockResponses: this.config.mockAPIResponses,
        outputDir: join(this.config.testDataPath, 'generated-assets'),
        timeout: 30000
      },

      // Browser test configuration
      browser: {
        headless: process.env.CI === 'true',
        viewport: { width: 1920, height: 1080 },
        enableWebGL: true,
        timeout: 30000
      },

      // Test data configuration
      data: {
        path: this.config.testDataPath,
        cleanup: true,
        preserveScreenshots: true
      }
    }
  }

  static isCI(): boolean {
    return process.env.CI === 'true'
  }

  static isDevelopment(): boolean {
    return !this.isCI()
  }

  static getTimeout(operation: 'default' | 'server' | 'browser' | 'api' = 'default'): number {
    const timeouts = {
      default: 30000,
      server: 60000,
      browser: 45000,
      api: this.config.useRealAPIs ? 120000 : 5000 // Real APIs take longer
    }

    // Increase timeouts in CI
    if (this.isCI()) {
      return timeouts[operation] * 2
    }

    return timeouts[operation]
  }

  static async cleanup(): Promise<void> {
    // Clean up test data if configured to do so
    if (this.config && !process.env.PRESERVE_TEST_DATA) {
      try {
        const tempFiles = join(this.config.testDataPath, 'temp')
        await fs.rm(tempFiles, { recursive: true, force: true })
        console.log('🧹 Test data cleanup completed')
      } catch (error) {
        // Ignore cleanup errors
      }
    }
  }

  static logTestInfo(testName: string, info: Record<string, any>): void {
    if (!this.isCI()) {
      console.log(`[${testName}]`, JSON.stringify(info, null, 2))
    } else {
      console.log(`[${testName}]`, JSON.stringify(info))
    }
  }

  static createMockAPIService() {
    const config = TestEnvironment.config;
    return {
      async generateImage(prompt: string) {
        if (!config.mockAPIResponses) {
          throw new Error('Real API call attempted with mocking disabled')
        }

        // Return mock response
        return {
          imageUrl: 'https://example.com/mock-image.png',
          prompt,
          metadata: {
            model: 'mock-dall-e-3',
            resolution: '1024x1024',
            timestamp: new Date()
          }
        }
      },

      async generate3DModel(imageUrl: string) {
        if (!config.mockAPIResponses) {
          throw new Error('Real API call attempted with mocking disabled')
        }

        // Return mock response
        return {
          modelUrl: 'https://example.com/mock-model.glb',
          format: 'glb' as const,
          polycount: 2000,
          metadata: {
            meshyTaskId: 'mock-task-123',
            processingTime: 30000
          }
        }
      }
    }
  }
}