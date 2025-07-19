import {
  IAgentRuntime,
  logger,
  UUID,
  createUniqueUuid,
} from '@elizaos/core'
import { HyperfyService } from '../service'
import { EventEmitter } from 'events'

export interface AgentInstance {
  id: UUID
  runtime: IAgentRuntime
  service: HyperfyService
  name: string
  position?: { x: number; y: number; z: number }
  status: 'connecting' | 'connected' | 'disconnected' | 'error'
  lastUpdate: number
}

export interface MultiAgentConfig {
  worldUrl: string
  maxAgents: number
  agentSpacing: number // Distance between agents when spawning
  enableAutonomy?: boolean
}

export class MultiAgentManager extends EventEmitter {
  private agents: Map<UUID, AgentInstance> = new Map()
  private worldUrl: string
  private maxAgents: number
  private agentSpacing: number
  private isRunning: boolean = false
  private updateInterval: NodeJS.Timeout | null = null

  constructor(config: MultiAgentConfig) {
    super()
    this.worldUrl = config.worldUrl
    this.maxAgents = config.maxAgents
    this.agentSpacing = config.agentSpacing
  }

  /**
   * Add an agent to the world
   */
  async addAgent(runtime: IAgentRuntime): Promise<AgentInstance> {
    if (this.agents.size >= this.maxAgents) {
      throw new Error(`Maximum number of agents (${this.maxAgents}) reached`)
    }

    const agentId = runtime.agentId
    const service = new HyperfyService(runtime)

    const agent: AgentInstance = {
      id: agentId,
      runtime,
      service,
      name: runtime.character.name,
      status: 'connecting',
      lastUpdate: Date.now(),
    }

    this.agents.set(agentId, agent)

    try {
      // Calculate spawn position based on number of agents
      const spawnIndex = this.agents.size - 1
      const spawnX = (spawnIndex % 5) * this.agentSpacing
      const spawnZ = Math.floor(spawnIndex / 5) * this.agentSpacing

      // Connect agent to world
      const worldId = createUniqueUuid(
        runtime,
        `${agentId}-multi-agent`
      ) as UUID
      await service.connect({
        wsUrl: this.worldUrl,
        worldId,
        authToken: undefined,
      })

      agent.status = 'connected'
      agent.position = { x: spawnX, y: 0, z: spawnZ }

      // Move agent to spawn position
      const world = service.getWorld()
      const controls = world?.controls as any
      if (controls?.goto) {
        controls.goto(spawnX, spawnZ)
      }

      logger.info(
        `Agent ${agent.name} connected to world at position (${spawnX}, 0, ${spawnZ})`
      )
      this.emit('agentConnected', agent)
    } catch (error) {
      agent.status = 'error'
      logger.error(`Failed to connect agent ${agent.name}:`, error)
      this.emit('agentError', agent, error)
      throw error
    }

    return agent
  }

  /**
   * Remove an agent from the world
   */
  async removeAgent(agentId: UUID): Promise<void> {
    const agent = this.agents.get(agentId)
    if (!agent) {
      throw new Error(`Agent ${agentId} not found`)
    }

    try {
      await agent.service.disconnect()
      agent.status = 'disconnected'
      this.agents.delete(agentId)
      logger.info(`Agent ${agent.name} disconnected from world`)
      this.emit('agentDisconnected', agent)
    } catch (error) {
      logger.error(`Error disconnecting agent ${agent.name}:`, error)
      throw error
    }
  }

  /**
   * Get all connected agents
   */
  getAgents(): AgentInstance[] {
    return Array.from(this.agents.values())
  }

  /**
   * Get a specific agent
   */
  getAgent(agentId: UUID): AgentInstance | undefined {
    return this.agents.get(agentId)
  }

  /**
   * Start the multi-agent manager
   */
  start(): void {
    if (this.isRunning) {
      logger.warn('Multi-agent manager already running')
      return
    }

    this.isRunning = true

    // Start update loop
    this.updateInterval = setInterval(() => {
      this.updateAgents()
    }, 1000) // Update every second

    logger.info('Multi-agent manager started')
    this.emit('started')
  }

  /**
   * Stop the multi-agent manager
   */
  async stop(): Promise<void> {
    if (!this.isRunning) {
      logger.warn('Multi-agent manager not running')
      return
    }

    this.isRunning = false

    // Stop update loop
    if (this.updateInterval) {
      clearInterval(this.updateInterval)
      this.updateInterval = null
    }

    // Disconnect all agents
    const disconnectPromises = Array.from(this.agents.values()).map(agent =>
      this.removeAgent(agent.id).catch(error =>
        logger.error(`Error disconnecting agent ${agent.name}:`, error)
      )
    )

    await Promise.all(disconnectPromises)

    logger.info('Multi-agent manager stopped')
    this.emit('stopped')
  }

  /**
   * Update agent positions and status
   */
  private updateAgents(): void {
    for (const agent of this.agents.values()) {
      try {
        const world = agent.service.getWorld()
        const player = world?.entities?.player

        if (player?.base?.position) {
          agent.position = {
            x: player.base.position.x,
            y: player.base.position.y,
            z: player.base.position.z,
          }
        }

        // Check connection status
        if (agent.service.isConnected()) {
          if (agent.status !== 'connected') {
            agent.status = 'connected'
            this.emit('agentReconnected', agent)
          }
        } else {
          if (agent.status === 'connected') {
            agent.status = 'disconnected'
            this.emit('agentDisconnected', agent)
          }
        }

        agent.lastUpdate = Date.now()
      } catch (error) {
        logger.error(`Error updating agent ${agent.name}:`, error)
      }
    }

    this.emit('agentsUpdated', this.getAgents())
  }

  /**
   * Enable inter-agent communication
   */
  enableInterAgentCommunication(): void {
    // Set up message routing between agents
    for (const agent of this.agents.values()) {
      const messageManager = agent.service.getMessageManager()

      // Override message handler to broadcast to other agents
      const originalHandler = messageManager.handleMessage.bind(messageManager)

      messageManager.handleMessage = async (message: any) => {
        // Process message normally
        await originalHandler(message)

        // Broadcast to other agents if it's from this agent
        if (message.fromId === agent.runtime.agentId) {
          this.broadcastMessage(agent.id, message)
        }
      }
    }
  }

  /**
   * Broadcast a message from one agent to others
   */
  private broadcastMessage(fromAgentId: UUID, message: any): void {
    for (const [agentId, agent] of this.agents) {
      if (agentId !== fromAgentId && agent.status === 'connected') {
        // Simulate receiving message from another agent
        const messageManager = agent.service.getMessageManager()
        const agentMessage = {
          ...message,
          fromId: fromAgentId,
          from: this.agents.get(fromAgentId)?.name || 'Unknown Agent',
          isFromAgent: true,
        }

        messageManager
          .handleMessage(agentMessage)
          .catch(error =>
            logger.error(
              `Error broadcasting message to agent ${agent.name}:`,
              error
            )
          )
      }
    }
  }

  /**
   * Get agent statistics
   */
  getStats() {
    const connected = Array.from(this.agents.values()).filter(
      a => a.status === 'connected'
    ).length
    const total = this.agents.size

    return {
      total,
      connected,
      disconnected: total - connected,
      agents: Array.from(this.agents.values()).map(agent => ({
        id: agent.id,
        name: agent.name,
        status: agent.status,
        position: agent.position,
        lastUpdate: agent.lastUpdate,
      })),
    }
  }
}
