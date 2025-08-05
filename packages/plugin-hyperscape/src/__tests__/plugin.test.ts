import {
  describe,
  expect,
  it,
  vi,
  beforeEach,
  afterEach,
  beforeAll,
  afterAll,
} from 'vitest'
import { hyperscapePlugin } from '../index'
import { HyperscapeService } from '../service'
import { ModelType, logger } from '@elizaos/core'
import { createMockRuntime } from './test-utils'
import dotenv from 'dotenv'

// Setup environment variables
dotenv.config()

// Need to spy on logger for documentation
beforeAll(() => {
  vi.spyOn(logger, 'info')
  vi.spyOn(logger, 'error')
  vi.spyOn(logger, 'warn')
  vi.spyOn(logger, 'debug')
})

afterAll(() => {
  vi.restoreAllMocks()
})

// Create a runtime for testing using the unified mock system
function createTestRuntime(): any {
  const services = new Map()

  // Create a service instance if needed
  const createService = (serviceType: string) => {
    if (serviceType === HyperscapeService.serviceName) {
      return new HyperscapeService({
        character: {
          name: 'Test Character',
          system: 'You are a helpful assistant for testing.',
        },
      } as any)
    }
    return null
  }

  const runtime = createMockRuntime({
    character: {
      name: 'Test Character',
      bio: ['A test character for unit testing'],
      system: 'You are a helpful assistant for testing.',
      plugins: [],
      settings: {},
    },
  })

  // Add additional methods to runtime
  ;(runtime as any).getSetting = (key: string) => null
  ;(runtime as any).db = {
    get: async (key: string) => null,
    set: async (key: string, value: any) => true,
    delete: async (key: string) => true,
    getKeys: async (pattern: string) => [],
  }
  ;(runtime as any).getService = ((serviceTypeOrClass: any) => {
    const serviceType =
      typeof serviceTypeOrClass === 'string'
        ? serviceTypeOrClass
        : serviceTypeOrClass.serviceName || serviceTypeOrClass.name

    // Log the service request for debugging
    logger.debug(`Requesting service: ${serviceType}`)

    // Get from cache or create new
    if (!services.has(serviceType)) {
      logger.debug(`Creating new service: ${serviceType}`)
      services.set(serviceType, createService(serviceType))
    }

    return services.get(serviceType)
  }) as any
  ;(runtime as any).registerService = async (serviceClass: any) => {
    logger.debug(
      `Registering service: ${serviceClass.serviceName || serviceClass.name}`
    )
    const instance = new serviceClass({} as any)
    services.set(serviceClass.serviceName || serviceClass.name, instance)
  }

  // Expose services for testing
  ;(runtime as any).testServices = services

  return runtime
}

describe('Plugin Configuration', () => {
  it('should have correct plugin metadata', () => {
    expect(hyperscapePlugin.name).toBe('hyperscape')
    expect(hyperscapePlugin.description).toBe(
      'Integrates ElizaOS agents with Hyperscape worlds'
    )
    expect(hyperscapePlugin.config).toBeDefined()
  })

  it('should include the DEFAULT_HYPERSCAPE_WS_URL in config', () => {
    expect(hyperscapePlugin.config).toHaveProperty('DEFAULT_HYPERSCAPE_WS_URL')
  })

  it('should initialize properly', async () => {
    const originalEnv = process.env.WS_URL

    try {
      process.env.WS_URL = 'wss://test.hyperscape.xyz/ws'

      // Initialize with config - using test runtime
      const runtime = createTestRuntime()

      if (hyperscapePlugin.init) {
        await hyperscapePlugin.init(
          { DEFAULT_HYPERSCAPE_WS_URL: 'wss://test.hyperscape.xyz/ws' },
          runtime as any
        )
        expect(true).toBe(true) // If we got here, init succeeded
      }
    } finally {
      process.env.WS_URL = originalEnv
    }
  })

  it('should have a valid config', () => {
    expect(hyperscapePlugin.config).toBeDefined()
    if (hyperscapePlugin.config) {
      // Check if the config has expected DEFAULT_HYPERSCAPE_WS_URL property
      expect(Object.keys(hyperscapePlugin.config)).toContain(
        'DEFAULT_HYPERSCAPE_WS_URL'
      )
    }
  })
})

describe('Plugin Actions', () => {
  it('should have actions defined', () => {
    expect(hyperscapePlugin.actions).toBeDefined()
    expect(Array.isArray(hyperscapePlugin.actions)).toBe(true)
    expect(hyperscapePlugin.actions?.length).toBeGreaterThan(0)
  })

  it('should have providers defined', () => {
    expect(hyperscapePlugin.providers).toBeDefined()
    expect(Array.isArray(hyperscapePlugin.providers)).toBe(true)
    expect(hyperscapePlugin.providers?.length).toBeGreaterThan(0)
  })

  it('should have services defined', () => {
    expect(hyperscapePlugin.services).toBeDefined()
    expect(Array.isArray(hyperscapePlugin.services)).toBe(true)
    expect(hyperscapePlugin.services?.length).toBeGreaterThan(0)
  })
})

describe('HyperscapeService', () => {
  it('should start the service', async () => {
    const runtime = createTestRuntime()
    const startResult = await HyperscapeService.start(runtime as any)

    expect(startResult).toBeDefined()
    expect(startResult.constructor.name).toBe('HyperscapeService')

    // Test real functionality - check stop method is available
    expect(typeof startResult.stop).toBe('function')
  })

  it('should stop the service', async () => {
    const runtime = createTestRuntime()

    // Register a real service first
    const service = new HyperscapeService(runtime as any)
    ;(runtime as any).testServices.set(HyperscapeService.serviceName, service)

    // Spy on the real service's stop method
    const stopSpy = vi.spyOn(service, 'stop')

    // Call the static stop method
    await HyperscapeService.stop(runtime as any)

    // Verify the service's stop method was called
    expect(stopSpy).toHaveBeenCalled()
  })

  it('should throw an error when stopping a non-existent service', async () => {
    const runtime = createTestRuntime()
    // Don't register a service, so getService will return null

    // We'll patch the getService function to ensure it returns null
    const originalGetService = runtime.getService
    runtime.getService = () => null

    await expect(HyperscapeService.stop(runtime as any)).rejects.toThrow(
      'Hyperscape service not found'
    )

    // Restore original getService function
    runtime.getService = originalGetService
  })
})
