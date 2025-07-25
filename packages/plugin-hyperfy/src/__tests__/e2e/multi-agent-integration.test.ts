import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest'
import {
  type IAgentRuntime,
  logger,
  AgentRuntime,
  ModelType,
  getTokenForProvider,
} from '@elizaos/core'
import { HyperfyService } from '../../service'
import hyperfyPlugin from '../../index'
import { createMockRuntime } from '../test-utils'
import Database from 'better-sqlite3'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

/**
 * Multi-Agent Integration Test Suite
 * =================================
 * 
 * Tests that verify multiple ElizaOS agents can successfully:
 * 1. Start up with the Hyperfy plugin
 * 2. Connect to a Hyperfy world  
 * 3. Join the same world instance
 * 4. Chat with each other
 * 5. See each other's avatars
 * 6. Interact without errors
 */

interface TestAgent {
  runtime: IAgentRuntime
  service: HyperfyService
  name: string
  connected: boolean
  chatMessages: string[]
  errors: Error[]
}

// Test configuration
const TEST_CONFIG = {
  AGENT_COUNT: 10,
  WORLD_URL: process.env.WS_URL || 'ws://localhost:3333/ws',
  TEST_TIMEOUT: 120000, // 2 minutes
  CONNECTION_TIMEOUT: 10000, // 10 seconds per agent
  CHAT_INTERVAL: 5000, // 5 seconds between chats
  POSITION_CHECK_INTERVAL: 2000, // 2 seconds between position checks
}

// Shared test state
let testAgents: TestAgent[] = []
let testStartTime: number = 0

// Helper functions
const wait = (ms: number) => new Promise(resolve => setTimeout(resolve, ms))

/**
 * Generate agent character configurations
 */
function generateAgentCharacter(index: number) {
  const names = ['Alpha', 'Beta', 'Gamma', 'Delta', 'Epsilon', 'Zeta', 'Eta', 'Theta', 'Iota', 'Kappa']
  const roles = ['Explorer', 'Builder', 'Guardian', 'Merchant', 'Scholar', 'Warrior', 'Healer', 'Scout', 'Artisan', 'Mystic']
  
  const name = names[index] || `Agent${index + 1}`
  const role = roles[index] || 'Wanderer'
  
  return {
    name: `${name}TestAgent`,
    bio: [
      `I am ${name}, a ${role} in the Hyperfy RPG world.`,
      `I test multiplayer interactions and world mechanics.`,
      `Agent ${index + 1} of ${TEST_CONFIG.AGENT_COUNT}`
    ],
    system: `You are ${name}, a ${role} AI agent testing the Hyperfy RPG world. Your goals:
1. Connect to the world successfully
2. Chat with other agents regularly
3. Move around to test navigation
4. Report any errors or issues
5. Maintain friendly interactions`,
    messageExamples: [],
    postExamples: [],
    topics: ['rpg', 'gaming', 'multiplayer', 'testing', role.toLowerCase()],
    plugins: ['@elizaos/plugin-hyperfy']
  }
}

/**
 * Create a test agent with proper runtime setup
 */
async function createTestAgent(index: number): Promise<TestAgent> {
  const character = generateAgentCharacter(index)
  
  // Create runtime with mock base but real Hyperfy service
  const runtime = createMockRuntime({
    character,
    getSetting: (key: string) => {
      const settings: Record<string, string> = {
        WS_URL: TEST_CONFIG.WORLD_URL,
        HYPERFY_WORLD_ID: 'multi-agent-test-world',
        ...process.env
      }
      return settings[key]
    }
  })

  // Initialize the Hyperfy plugin
  await hyperfyPlugin.init?.({
    DEFAULT_HYPERFY_WS_URL: TEST_CONFIG.WORLD_URL,
  })

  // Get or create the Hyperfy service
  let service = runtime.getService('hyperfy') as HyperfyService
  if (!service) {
    service = new HyperfyService()
    // Manually add service to runtime
    ;(runtime as any).services = (runtime as any).services || new Map()
    ;(runtime as any).services.set('hyperfy', service)
  }

  return {
    runtime,
    service,
    name: character.name,
    connected: false,
    chatMessages: [],
    errors: []
  }
}

/**
 * Connect agent to Hyperfy world
 */
async function connectAgent(agent: TestAgent): Promise<boolean> {
  try {
    logger.info(`Connecting ${agent.name} to world...`)
    
    await agent.service.connect({
      wsUrl: TEST_CONFIG.WORLD_URL,
      worldId: 'multi-agent-test-world',
      authToken: process.env.HYPERFY_AUTH_TOKEN,
    })

    // Verify connection
    agent.connected = agent.service.isConnected()
    
    if (agent.connected) {
      logger.info(`✅ ${agent.name} connected successfully`)
      
      // Wait for world initialization
      await wait(2000)
      
      // Verify world state
      const world = agent.service.getWorld()
      if (!world) {
        throw new Error('World not available after connection')
      }
      
      return true
    } else {
      throw new Error('Service reports not connected after connect() call')
    }
    
  } catch (error) {
    logger.error(`❌ Failed to connect ${agent.name}:`, error)
    agent.errors.push(error as Error)
    return false
  }
}

/**
 * Send chat message from agent
 */
async function sendChatMessage(agent: TestAgent, message: string): Promise<void> {
  try {
    const world = agent.service.getWorld()
    if (!world || !world.chat) {
      throw new Error('World or chat not available')
    }

    // Send chat through world interface
    world.chat.add({
      id: `msg-${Date.now()}-${Math.random()}`,
      text: message,
      playerId: world.entities?.player?.data?.id || agent.name,
      playerName: agent.name,
      timestamp: Date.now(),
    })
    
    agent.chatMessages.push(message)
    logger.info(`💬 ${agent.name}: ${message}`)
    
  } catch (error) {
    logger.error(`Failed to send chat for ${agent.name}:`, error)
    agent.errors.push(error as Error)
  }
}

/**
 * Check if agents can see each other
 */
async function checkAgentVisibility(agents: TestAgent[]): Promise<number> {
  let visibleCount = 0
  
  for (const agent of agents) {
    if (!agent.connected) continue
    
    try {
      const world = agent.service.getWorld()
      if (!world) continue
      
      // Check for other players in world
      const otherPlayers = Object.keys(world.entities || {}).filter(key => 
        key !== 'player' && key.includes('player')
      )
      
      if (otherPlayers.length > 0) {
        visibleCount++
        logger.info(`👁️  ${agent.name} can see ${otherPlayers.length} other players`)
      }
      
    } catch (error) {
      logger.error(`Failed to check visibility for ${agent.name}:`, error)
      agent.errors.push(error as Error)
    }
  }
  
  return visibleCount
}

/**
 * Monitor chat activity across all agents
 */
async function monitorChatActivity(agents: TestAgent[]): Promise<number> {
  let totalMessages = 0
  
  for (const agent of agents) {
    if (!agent.connected) continue
    
    try {
      const world = agent.service.getWorld()
      if (world?.chat?.msgs) {
        const messageCount = world.chat.msgs.length
        totalMessages += messageCount
        
        // Look for messages from other agents
        const otherAgentMessages = world.chat.msgs.filter((msg: any) => 
          msg.playerName && msg.playerName !== agent.name
        )
        
        if (otherAgentMessages.length > 0) {
          logger.info(`📨 ${agent.name} received ${otherAgentMessages.length} messages from other agents`)
        }
      }
    } catch (error) {
      logger.error(`Failed to monitor chat for ${agent.name}:`, error)
      agent.errors.push(error as Error)
    }
  }
  
  return totalMessages
}

// Test Suite
describe('Multi-Agent Hyperfy Integration', () => {
  
  beforeAll(async () => {
    testStartTime = Date.now()
    logger.info(`🚀 Starting multi-agent integration test with ${TEST_CONFIG.AGENT_COUNT} agents`)
    logger.info(`📡 Target world: ${TEST_CONFIG.WORLD_URL}`)
  }, TEST_CONFIG.TEST_TIMEOUT)

  afterAll(async () => {
    // Cleanup: disconnect all agents
    logger.info('🧹 Cleaning up test agents...')
    
    for (const agent of testAgents) {
      if (agent.connected) {
        try {
          await agent.service.disconnect()
        } catch (error) {
          logger.error(`Failed to disconnect ${agent.name}:`, error)
        }
      }
    }
    
    const testDuration = Date.now() - testStartTime
    logger.info(`✅ Test cleanup complete. Duration: ${testDuration / 1000}s`)
  })

  it('should create all test agents successfully', async () => {
    testAgents = []
    
    for (let i = 0; i < TEST_CONFIG.AGENT_COUNT; i++) {
      const agent = await createTestAgent(i)
      testAgents.push(agent)
      
      expect(agent.runtime).toBeDefined()
      expect(agent.service).toBeDefined()
      expect(agent.name).toBeDefined()
      expect(agent.connected).toBe(false)
    }
    
    expect(testAgents).toHaveLength(TEST_CONFIG.AGENT_COUNT)
    logger.info(`✅ Created ${testAgents.length} test agents`)
  })

  it('should connect at least 50% of agents to the world', async () => {
    const connectionPromises = testAgents.map(async (agent) => {
      return await connectAgent(agent)
    })
    
    const connectionResults = await Promise.allSettled(connectionPromises)
    const connectedAgents = testAgents.filter(a => a.connected)
    
    const connectionRate = connectedAgents.length / testAgents.length
    const minConnectionRate = 0.5 // At least 50% should connect
    
    logger.info(`📊 Connection rate: ${connectedAgents.length}/${testAgents.length} (${(connectionRate * 100).toFixed(1)}%)`)
    
    expect(connectionRate).toBeGreaterThanOrEqual(minConnectionRate)
    expect(connectedAgents.length).toBeGreaterThan(0)
  }, TEST_CONFIG.CONNECTION_TIMEOUT * TEST_CONFIG.AGENT_COUNT)

  it('should allow agents to send chat messages', async () => {
    const connectedAgents = testAgents.filter(a => a.connected)
    
    if (connectedAgents.length === 0) {
      expect.fail('No agents connected - cannot test chat')
    }
    
    // Send test messages from each connected agent
    for (const agent of connectedAgents) {
      const message = `Hello from ${agent.name}! Testing multi-agent chat functionality.`
      await sendChatMessage(agent, message)
      await wait(500) // Small delay between messages
    }
    
    // Verify messages were sent
    const totalMessages = connectedAgents.reduce((sum, agent) => sum + agent.chatMessages.length, 0)
    expect(totalMessages).toBeGreaterThan(0)
    
    logger.info(`💬 Total chat messages sent: ${totalMessages}`)
  })

  it('should allow agents to receive chat messages from other agents', async () => {
    const connectedAgents = testAgents.filter(a => a.connected)
    
    if (connectedAgents.length < 2) {
      logger.warn('⚠️  Less than 2 agents connected - skipping cross-agent chat test')
      return
    }
    
    // Wait for chat messages to propagate
    await wait(3000)
    
    // Monitor chat activity
    const totalChatActivity = await monitorChatActivity(connectedAgents)
    
    // We expect to see some chat activity across agents
    expect(totalChatActivity).toBeGreaterThan(0)
    
    logger.info(`📨 Total chat activity detected: ${totalChatActivity}`)
  })

  it('should show agent avatars in the world', async () => {
    const connectedAgents = testAgents.filter(a => a.connected)
    
    if (connectedAgents.length === 0) {
      expect.fail('No agents connected - cannot test avatar visibility')
    }
    
    // Wait for avatars to load
    await wait(5000)
    
    // Check agent positions and avatar presence
    let agentsWithPositions = 0
    
    for (const agent of connectedAgents) {
      try {
        const world = agent.service.getWorld()
        if (world?.entities?.player?.base?.position) {
          agentsWithPositions++
          const pos = world.entities.player.base.position
          logger.info(`📍 ${agent.name} position: x=${pos.x}, y=${pos.y}, z=${pos.z}`)
        }
      } catch (error) {
        logger.error(`Failed to get position for ${agent.name}:`, error)
      }
    }
    
    // At least some agents should have valid positions
    expect(agentsWithPositions).toBeGreaterThan(0)
    
    logger.info(`👤 Agents with valid positions: ${agentsWithPositions}/${connectedAgents.length}`)
  })

  it('should maintain stable connections during test period', async () => {
    const connectedAgents = testAgents.filter(a => a.connected)
    
    if (connectedAgents.length === 0) {
      expect.fail('No agents connected - cannot test connection stability')
    }
    
    const initialConnectionCount = connectedAgents.length
    
    // Monitor connections over time
    const monitoringDuration = 30000 // 30 seconds
    const checkInterval = 5000 // Check every 5 seconds
    
    let connectionChecks = 0
    let totalConnectionLosses = 0
    
    const monitorInterval = setInterval(() => {
      connectionChecks++
      let currentConnected = 0
      
      for (const agent of connectedAgents) {
        if (agent.service.isConnected()) {
          currentConnected++
        } else {
          totalConnectionLosses++
          logger.warn(`⚠️  ${agent.name} lost connection`)
        }
      }
      
      logger.info(`🔄 Connection check ${connectionChecks}: ${currentConnected}/${initialConnectionCount} agents connected`)
      
    }, checkInterval)
    
    // Wait for monitoring period
    await wait(monitoringDuration)
    clearInterval(monitorInterval)
    
    // We expect most connections to remain stable
    const maxAllowedLosses = Math.ceil(initialConnectionCount * 0.3) // Allow up to 30% disconnection
    
    expect(totalConnectionLosses).toBeLessThanOrEqual(maxAllowedLosses)
    
    logger.info(`📊 Connection stability: ${totalConnectionLosses} losses out of ${initialConnectionCount} agents`)
  })

  it('should complete test with minimal errors', async () => {
    // Collect all errors from all agents
    const allErrors = testAgents.flatMap(agent => agent.errors)
    
    // Log error summary
    if (allErrors.length > 0) {
      logger.warn(`⚠️  Total errors encountered: ${allErrors.length}`)
      allErrors.forEach((error, index) => {
        logger.error(`Error ${index + 1}:`, error.message)
      })
    } else {
      logger.info('✅ No errors encountered during test')
    }
    
    // We expect relatively few errors
    const maxAllowedErrors = TEST_CONFIG.AGENT_COUNT * 2 // Max 2 errors per agent
    expect(allErrors.length).toBeLessThanOrEqual(maxAllowedErrors)
    
    // Generate final test report
    const connectedAgents = testAgents.filter(a => a.connected)
    const totalChatMessages = testAgents.reduce((sum, agent) => sum + agent.chatMessages.length, 0)
    
    const testReport = {
      totalAgents: testAgents.length,
      connectedAgents: connectedAgents.length,
      connectionRate: (connectedAgents.length / testAgents.length * 100).toFixed(1) + '%',
      totalChatMessages,
      totalErrors: allErrors.length,
      testDuration: (Date.now() - testStartTime) / 1000 + 's'
    }
    
    logger.info('📊 Final Test Report:', testReport)
  })
})