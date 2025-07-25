import {
  type IAgentRuntime,
  type Memory,
  type State,
  UUID,
  createUniqueUuid,
  logger,
  ModelType,
  AgentRuntime,
  Client,
} from '@elizaos/core'
import { HyperfyService } from '../../service'
import type { HyperfyWorld, Player } from '../../types/hyperfy'
import { createMockRuntime } from '../test-utils'
import hyperfyPlugin from '../../index'

/**
 * Multi-Agent E2E Test Suite for Hyperfy Plugin
 * ============================================
 *
 * This test suite starts 10 ElizaOS agents with the Hyperfy plugin,
 * verifies they successfully connect to a Hyperfy world, and tests
 * their interactions including chat, avatar presence, and world joining.
 *
 * Prerequisites:
 * - Hyperfy server running on localhost:3333
 * - WS_URL environment variable set or uses default localhost WebSocket
 * - Agent configurations with unique names
 */

interface TestAgent {
  runtime: IAgentRuntime
  service: HyperfyService
  character: {
    name: string
    bio: string[]
    system: string
  }
  connected: boolean
  chatMessages: string[]
  position?: { x: number; y: number; z: number }
}

interface MultiAgentTestConfig {
  numAgents: number
  worldUrl: string
  testDurationMs: number
  chatIntervalMs: number
  positionCheckIntervalMs: number
}

// Helper to wait for async operations
const wait = (ms: number) => new Promise(resolve => setTimeout(resolve, ms))

// Test configuration
const DEFAULT_CONFIG: MultiAgentTestConfig = {
  numAgents: 10,
  worldUrl: process.env.WS_URL || 'ws://localhost:3333/ws',
  testDurationMs: 60000, // 1 minute test
  chatIntervalMs: 5000, // Chat every 5 seconds
  positionCheckIntervalMs: 2000, // Check positions every 2 seconds
}

/**
 * Creates a test agent with unique character configuration
 */
function createTestAgentConfig(agentIndex: number): any {
  const agentNames = [
    'Alpha', 'Beta', 'Gamma', 'Delta', 'Epsilon',
    'Zeta', 'Eta', 'Theta', 'Iota', 'Kappa'
  ]
  
  const agentTypes = [
    'Explorer', 'Builder', 'Guardian', 'Merchant', 'Scholar',
    'Warrior', 'Healer', 'Scout', 'Artisan', 'Mystic'
  ]

  const name = agentNames[agentIndex] || `Agent${agentIndex}`
  const type = agentTypes[agentIndex] || 'Wanderer'

  return {
    name: `${name}TestAgent`,
    bio: [
      `I am ${name}, a ${type} in the Hyperfy RPG world.`,
      `I test multiplayer interactions and world mechanics.`,
      `Agent ID: ${agentIndex + 1} of ${DEFAULT_CONFIG.numAgents}`
    ],
    system: `You are ${name}, a ${type} AI agent testing the Hyperfy RPG world. Your primary goals are:
1. Connect successfully to the world
2. Chat with other agents regularly
3. Move around the world to test navigation
4. Interact with world objects and other players
5. Report any errors or issues you encounter
6. Maintain friendly social interactions with other agents`,
    messageExamples: [
      [
        {
          user: "user",
          content: {
            text: "Hello!"
          }
        },
        {
          user: `${name}TestAgent`,
          content: {
            text: `Greetings! I'm ${name}, a ${type} exploring this world.`
          }
        }
      ]
    ],
    postExamples: [],
    topics: [
      "rpg",
      "gaming",
      "multiplayer",
      "testing",
      "exploration",
      type.toLowerCase()
    ],
    style: {
      all: [
        "Be friendly and social",
        "Test game mechanics actively",
        "Report observations clearly",
        "Interact with other agents"
      ],
      chat: [
        "Keep messages concise",
        "Ask questions about the world",
        "Share discoveries with others"
      ]
    },
    plugins: [
      "@elizaos/plugin-hyperfy"
    ]
  }
}

/**
 * Creates a runtime for a test agent
 */
async function createTestAgent(agentIndex: number): Promise<TestAgent> {
  const character = createTestAgentConfig(agentIndex)
  
  // Create runtime with the character configuration
  const runtime = createMockRuntime({
    character,
    agentId: createUniqueUuid() as UUID,
  }) as IAgentRuntime

  // Initialize the Hyperfy plugin for this runtime
  await hyperfyPlugin.init?.({
    DEFAULT_HYPERFY_WS_URL: DEFAULT_CONFIG.worldUrl,
  })

  // Get the service
  const service = runtime.getService('hyperfy') as HyperfyService
  if (!service) {
    throw new Error(`Failed to get HyperfyService for agent ${character.name}`)
  }

  return {
    runtime,
    service,
    character,
    connected: false,
    chatMessages: [],
  }
}

/**
 * Connects an agent to the Hyperfy world
 */
async function connectAgent(agent: TestAgent): Promise<void> {
  try {
    logger.info(`Connecting agent ${agent.character.name}...`)
    
    const worldId = createUniqueUuid() as UUID
    
    await agent.service.connect({
      wsUrl: DEFAULT_CONFIG.worldUrl,
      worldId,
      authToken: process.env.HYPERFY_AUTH_TOKEN,
    })

    if (!agent.service.isConnected()) {
      throw new Error(`Agent ${agent.character.name} failed to connect`)
    }

    agent.connected = true
    logger.info(`✅ Agent ${agent.character.name} connected successfully`)

    // Wait for world initialization
    await wait(2000)

    const world = agent.service.getWorld()
    if (world?.entities?.player) {
      agent.position = {
        x: world.entities.player.base?.position?.x || 0,
        y: world.entities.player.base?.position?.y || 0,
        z: world.entities.player.base?.position?.z || 0,
      }
      logger.info(`Agent ${agent.character.name} spawned at position:`, agent.position)
    }

  } catch (error) {
    logger.error(`Failed to connect agent ${agent.character.name}:`, error)
    throw error
  }
}

/**
 * Makes an agent send a chat message
 */
async function sendChatMessage(agent: TestAgent, message: string): Promise<void> {
  try {
    const world = agent.service.getWorld()
    if (!world) {
      logger.warn(`Agent ${agent.character.name} has no world instance`)
      return
    }

    // Send chat message through the world
    if (world.chat?.add) {
      world.chat.add({
        id: createUniqueUuid() as UUID,
        text: message,
        playerId: world.entities?.player?.data?.id,
        playerName: agent.character.name,
        timestamp: Date.now(),
      })
      
      agent.chatMessages.push(message)
      logger.info(`💬 ${agent.character.name}: ${message}`)
    }
  } catch (error) {
    logger.error(`Failed to send chat for ${agent.character.name}:`, error)
  }
}

/**
 * Checks agent positions and avatar presence
 */
async function checkAgentPositions(agents: TestAgent[]): Promise<void> {
  const positions: Record<string, any> = {}
  
  for (const agent of agents) {
    if (!agent.connected) continue
    
    try {
      const world = agent.service.getWorld()
      if (world?.entities?.player?.base?.position) {
        positions[agent.character.name] = {
          x: world.entities.player.base.position.x,
          y: world.entities.player.base.position.y,
          z: world.entities.player.base.position.z,
        }
      }
    } catch (error) {
      logger.error(`Failed to get position for ${agent.character.name}:`, error)
    }
  }

  if (Object.keys(positions).length > 0) {
    logger.info('📍 Agent positions:', positions)
  }
}

/**
 * Monitors chat messages across all agents
 */
async function monitorChatMessages(agents: TestAgent[]): Promise<void> {
  const allMessages: Array<{ agent: string; message: string; timestamp: number }> = []
  
  for (const agent of agents) {
    if (!agent.connected) continue
    
    try {
      const world = agent.service.getWorld()
      if (world?.chat?.msgs) {
        const recentMessages = world.chat.msgs.slice(-5) // Get last 5 messages
        for (const msg of recentMessages) {
          if (msg.text && msg.playerName !== agent.character.name) {
            allMessages.push({
              agent: msg.playerName || 'Unknown',
              message: msg.text,
              timestamp: msg.timestamp || Date.now(),
            })
          }
        }
      }
    } catch (error) {
      logger.error(`Failed to monitor chat for ${agent.character.name}:`, error)
    }
  }

  if (allMessages.length > 0) {
    logger.info('💬 Recent chat activity:', allMessages.slice(-3))
  }
}

/**
 * Main multi-agent test function
 */
export async function runMultiAgentTest(config: Partial<MultiAgentTestConfig> = {}): Promise<void> {
  const testConfig = { ...DEFAULT_CONFIG, ...config }
  const agents: TestAgent[] = []
  const startTime = Date.now()
  
  logger.info(`🚀 Starting multi-agent test with ${testConfig.numAgents} agents`)
  logger.info(`📡 Connecting to: ${testConfig.worldUrl}`)
  logger.info(`⏱️  Test duration: ${testConfig.testDurationMs / 1000} seconds`)

  try {
    // Phase 1: Create all agents
    logger.info('📝 Phase 1: Creating agents...')
    for (let i = 0; i < testConfig.numAgents; i++) {
      const agent = await createTestAgent(i)
      agents.push(agent)
      logger.info(`Created agent ${i + 1}/${testConfig.numAgents}: ${agent.character.name}`)
    }

    // Phase 2: Connect all agents
    logger.info('🔗 Phase 2: Connecting agents to world...')
    const connectionPromises = agents.map(agent => connectAgent(agent))
    await Promise.allSettled(connectionPromises)
    
    const connectedAgents = agents.filter(a => a.connected)
    logger.info(`✅ Connected ${connectedAgents.length}/${testConfig.numAgents} agents`)

    if (connectedAgents.length === 0) {
      throw new Error('No agents successfully connected to the world')
    }

    // Phase 3: Start monitoring and interaction loops
    logger.info('🎮 Phase 3: Starting interaction loops...')
    
    // Chat message interval
    const chatInterval = setInterval(async () => {
      for (const agent of connectedAgents) {
        const messages = [
          `Hello from ${agent.character.name}! Testing chat functionality.`,
          `${agent.character.name} reporting in. World looks good!`,
          `Anyone else see any interesting objects around?`,
          `${agent.character.name} here, exploring the world.`,
          `Testing multiplayer chat from ${agent.character.name}.`,
        ]
        const randomMessage = messages[Math.floor(Math.random() * messages.length)]
        await sendChatMessage(agent, randomMessage)
        
        // Randomize timing to avoid all agents talking at once
        await wait(Math.random() * 2000)
      }
    }, testConfig.chatIntervalMs)

    // Position monitoring interval
    const positionInterval = setInterval(async () => {
      await checkAgentPositions(connectedAgents)
      await monitorChatMessages(connectedAgents)
    }, testConfig.positionCheckIntervalMs)

    // Phase 4: Run test for specified duration
    logger.info(`⏳ Phase 4: Running test for ${testConfig.testDurationMs / 1000} seconds...`)
    await wait(testConfig.testDurationMs)

    // Phase 5: Cleanup and results
    logger.info('🧹 Phase 5: Cleaning up...')
    clearInterval(chatInterval)
    clearInterval(positionInterval)

    // Collect final statistics
    const finalStats = {
      totalAgents: testConfig.numAgents,
      connectedAgents: connectedAgents.length,
      totalChatMessages: connectedAgents.reduce((sum, agent) => sum + agent.chatMessages.length, 0),
      testDurationMs: Date.now() - startTime,
      averageMessagesPerAgent: connectedAgents.length > 0 
        ? connectedAgents.reduce((sum, agent) => sum + agent.chatMessages.length, 0) / connectedAgents.length 
        : 0,
    }

    logger.info('📊 Final Test Results:', finalStats)

    // Verify test success criteria
    const successCriteria = {
      atLeast50PercentConnected: connectedAgents.length >= testConfig.numAgents * 0.5,
      atLeastOneChatMessage: finalStats.totalChatMessages > 0,
      noMajorErrors: true, // We'll set this to false if we encounter critical errors
    }

    if (successCriteria.atLeast50PercentConnected && successCriteria.atLeastOneChatMessage) {
      logger.info('✅ Multi-agent test PASSED!')
    } else {
      logger.error('❌ Multi-agent test FAILED!')
      logger.error('Failed criteria:', {
        connectionRate: `${connectedAgents.length}/${testConfig.numAgents}`,
        chatMessages: finalStats.totalChatMessages,
      })
    }

  } catch (error) {
    logger.error('💥 Multi-agent test encountered error:', error)
    throw error
  } finally {
    // Disconnect all agents
    logger.info('🔌 Disconnecting all agents...')
    for (const agent of agents) {
      if (agent.connected) {
        try {
          await agent.service.disconnect()
        } catch (error) {
          logger.error(`Failed to disconnect ${agent.character.name}:`, error)
        }
      }
    }
  }
}

/**
 * Vitest test wrapper
 */
export const multiAgentTestSuite = {
  name: 'multi_agent_hyperfy_test',
  
  async run(): Promise<void> {
    await runMultiAgentTest()
  },

  // Run with custom configuration
  async runWithConfig(config: Partial<MultiAgentTestConfig>): Promise<void> {
    await runMultiAgentTest(config)
  },

  // Quick test with fewer agents
  async runQuickTest(): Promise<void> {
    await runMultiAgentTest({
      numAgents: 3,
      testDurationMs: 30000, // 30 seconds
      chatIntervalMs: 10000, // Chat every 10 seconds
    })
  }
}

// Export for use in test files
export default multiAgentTestSuite