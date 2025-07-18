import { System } from '../../core/systems/System'
import type { World } from '../../types'
import type { Vector3 } from '../types'
import { RPGEntity } from '../entities/RPGEntity'
import { NavigationSystem } from './NavigationSystem'
import { QuestSystem } from './QuestSystem'

export interface AgentAction {
  type: 'move' | 'interact' | 'pickup' | 'attack' | 'wait'
  target?: Vector3 | string // Position or entity ID
  duration?: number // For wait actions
  description: string
  completed: boolean
  callback?: () => void
  startTime?: number
  navigationStarted?: boolean
}

export interface AgentTask {
  id: string
  name: string
  actions: AgentAction[]
  currentAction: number
  completed: boolean
  callback?: () => void
}

/**
 * Automated agent player system for testing quests
 * Creates and controls an AI player that can perform quest actions
 */
export class AgentPlayerSystem extends System {
  private testModeTimeout?: NodeJS.Timeout
  private readonly TEST_MODE_DURATION = 60000 // 1 minute for testing

  private agent: RPGEntity | null = null
  private navigationSystem: NavigationSystem | null = null
  private questSystem: QuestSystem | null = null
  private currentTask: AgentTask | null = null
  private actionTimer: number = 0
  private updateInterval: NodeJS.Timeout | null = null

  // Quest locations (simple coordinates for testing)
  private readonly LOCATIONS = {
    SPAWN: { x: 0, y: 0, z: 0 },
    QUEST_NPC: { x: 0, y: 0, z: 5 },
    SWORD: { x: 0, y: 0, z: 0 },
    GOBLIN_AREA: { x: 5, y: 0, z: 5 },
  }

  constructor(world: World) {
    super(world)
  }

  override async init(_options: any): Promise<void> {
    console.log('[AgentPlayerSystem] Initializing...')

    // Get required systems
    this.navigationSystem = (this.world as any).getSystem?.('navigation')
    this.questSystem = (this.world as any).getSystem?.('quest')

    if (!this.navigationSystem) {
      console.warn('[AgentPlayerSystem] Navigation system not found')
    }
    if (!this.questSystem) {
      console.warn('[AgentPlayerSystem] Quest system not found')
    }

    // Create agent player after a delay to ensure other systems are ready
    // Set test mode timeout
    if (process.env.TEST_MODE === 'true') {
      this.testModeTimeout = setTimeout(() => {
        console.log('[AgentPlayerSystem] Test mode timeout reached, shutting down...')
        this.destroy()
        process.exit(0)
      }, this.TEST_MODE_DURATION)
    }
    
    setTimeout(() => {
      console.log('[AgentPlayerSystem] Creating agent player...')
      this.createAgentPlayer()
      console.log('[AgentPlayerSystem] Starting quest demo...')
      this.startQuestDemo()

      // Start continuous update loop
      setTimeout(() => {
        console.log('[AgentPlayerSystem] Starting continuous update loop...')
        this.startUpdateLoop()
      }, 1000)
    }, 3000)
  }

  /**
   * Start the continuous update loop for agent actions
   */
  private startUpdateLoop(): void {
    if (this.updateInterval) {
      clearInterval(this.updateInterval)
    }

    // Update every 100ms (10 FPS)
    this.updateInterval = setInterval(() => {
      this.fixedUpdate(100) // 100ms delta
    }, 100)

    console.log('[AgentPlayerSystem] Update loop started')
  }

  /**
   * Create the automated agent player
   */
  private createAgentPlayer(): void {
    const agentId = `agent_player_${Date.now()}`

    // Create agent entity
    this.agent = new RPGEntity(this.world, 'player', {
      id: agentId,
      type: 'player',
      name: 'Agent Player',
      position: this.LOCATIONS.SPAWN,
      isAgent: true,
    })

    // Add player components
    this.agent.components.set('stats', {
      type: 'stats',
      hitpoints: { current: 100, max: 100, level: 10, xp: 1200 },
      attack: { level: 5, xp: 300 },
      strength: { level: 5, xp: 300 },
      defense: { level: 5, xp: 300 },
      combatLevel: 5,
      totalLevel: 20,
    } as any)

    this.agent.components.set('inventory', {
      type: 'inventory',
      items: new Map(),
      capacity: 28,
      gold: 0,
    } as any)

    this.agent.components.set('movement', {
      type: 'movement',
      position: this.LOCATIONS.SPAWN,
      moveSpeed: 3,
      isMoving: false,
      canMove: true,
    } as any)

    // Add to world
    if ((this.world as any).entities?.items) {
      ;(this.world as any).entities.items.set(agentId, this.agent)
    } else {
      ;(this.world as any).entities = new Map()
      ;(this.world as any).entities.set(agentId, this.agent)
    }

    // Create visual representation
    const visualSystem = (this.world as any).getSystem?.('visualRepresentation')
    if (visualSystem) {
      visualSystem.createVisual(this.agent, 'player')
    }

    console.log(`[AgentPlayerSystem] Created agent player at spawn ${JSON.stringify(this.LOCATIONS.SPAWN)}`)
  }

  /**
   * Start the quest demonstration
   */
  private startQuestDemo(): void {
    if (!this.agent) {
      console.error('[AgentPlayerSystem] No agent player created')
      return
    }

    console.log('[AgentPlayerSystem] Starting quest demonstration...')

    // Create quest completion task
    const questTask: AgentTask = {
      id: 'complete_goblin_quest',
      name: 'Complete Kill Goblin Quest',
      currentAction: 0,
      completed: false,
      actions: [
        {
          type: 'wait',
          duration: 2000,
          description: 'Wait for world to stabilize',
          completed: false,
        },
        {
          type: 'move',
          target: this.LOCATIONS.QUEST_NPC,
          description: 'Walk to Quest NPC',
          completed: false,
          callback: () => console.log('[Agent] Arrived at Quest NPC'),
        },
        {
          type: 'interact',
          target: 'quest_giver_1',
          description: 'Talk to Quest NPC and accept quest',
          completed: false,
          callback: () => console.log('[Agent] Accepted quest'),
        },
        {
          type: 'move',
          target: this.LOCATIONS.SWORD,
          description: 'Walk to sword location',
          completed: false,
          callback: () => console.log('[Agent] Arrived at sword'),
        },
        {
          type: 'pickup',
          target: 'sword',
          description: 'Pick up sword',
          completed: false,
          callback: () => console.log('[Agent] Picked up sword'),
        },
        {
          type: 'move',
          target: this.LOCATIONS.GOBLIN_AREA,
          description: 'Walk to goblin area',
          completed: false,
          callback: () => console.log('[Agent] Arrived at goblin area'),
        },
        {
          type: 'attack',
          target: 'goblin',
          description: 'Attack and kill goblin',
          completed: false,
          callback: () => console.log('[Agent] Killed goblin'),
        },
        {
          type: 'move',
          target: this.LOCATIONS.QUEST_NPC,
          description: 'Return to Quest NPC',
          completed: false,
          callback: () => console.log('[Agent] Returned to Quest NPC'),
        },
        {
          type: 'interact',
          target: 'quest_giver_1',
          description: 'Complete quest with NPC',
          completed: false,
          callback: () => console.log('[Agent] Completed quest!'),
        },
      ],
    }

    this.currentTask = questTask
    console.log('[AgentPlayerSystem] Quest task created with', questTask.actions.length, 'actions')
  }

  /**
   * Update agent behavior
   */
  override fixedUpdate(delta: number): void {
    if (!this.agent || !this.currentTask || this.currentTask.completed) {
      return
    }

    this.actionTimer += delta

    // Execute current action
    const currentAction = this.currentTask.actions[this.currentTask.currentAction]
    if (!currentAction) {
      return
    }

    if (currentAction.completed) {
      this.moveToNextAction()
      return
    }

    // Add periodic status logging
    if (this.actionTimer % 5000 < delta) {
      // Every 5 seconds
      console.log(
        `[AgentPlayerSystem] Current action: ${currentAction.description} (${this.currentTask.currentAction + 1}/${this.currentTask.actions.length})`
      )
    }

    this.executeAction(currentAction, delta)
  }

  /**
   * Execute a specific action
   */
  private executeAction(action: AgentAction, delta: number): void {
    switch (action.type) {
      case 'wait':
        this.executeWaitAction(action, delta)
        break
      case 'move':
        this.executeMoveAction(action)
        break
      case 'interact':
        this.executeInteractAction(action)
        break
      case 'pickup':
        this.executePickupAction(action)
        break
      case 'attack':
        this.executeAttackAction(action)
        break
    }
  }

  /**
   * Execute wait action
   */
  private executeWaitAction(action: AgentAction, delta: number): void {
    if (!action.duration) {
      action.completed = true
      return
    }

    action.duration -= delta
    if (action.duration <= 0) {
      action.completed = true
      console.log(`[Agent] ${action.description} - completed`)
      if (action.callback) {
        action.callback()
      }
    }
  }

  /**
   * Execute move action
   */
  private executeMoveAction(action: AgentAction): void {
    if (!this.navigationSystem || !this.agent) {
      console.error('[Agent] No navigation system or agent available')
      action.completed = true
      return
    }

    // Check if already navigating - validate agent ID first
    const agentId = this.agent.id || this.agent.data?.id
    if (!agentId) {
      console.error('[Agent] Cannot check navigation - agent ID is undefined')
      action.completed = true
      return
    }

    // Add timeout to prevent infinite loops
    if (!action.startTime) {
      action.startTime = Date.now()
    }

    const elapsedTime = Date.now() - action.startTime
    if (elapsedTime > 30000) { // 30 second timeout
      console.warn(`[Agent] Navigation timeout for action: ${action.description}`)
      action.completed = true
      if (action.callback) {
        action.callback()
      }
      return
    }

    // Check if we're close enough to the target (within 1 unit)
    const target = action.target as Vector3
    const agentPos = this.agent.position || (this.agent.components.get('movement') as any)?.position
    if (agentPos) {
      const distance = Math.sqrt(
        Math.pow(agentPos.x - target.x, 2) + 
        Math.pow(agentPos.z - target.z, 2)
      )
      
      if (distance < 1) {
        console.log(`[Agent] Reached destination for: ${action.description}`)
        action.completed = true
        if (action.callback) {
          action.callback()
        }
        return
      }
    }

    // Check if navigation system reports we're navigating
    const isNavigating = this.navigationSystem.isNavigating(agentId)
    
    // Start navigation if not started or if navigation stopped
    if (!action.navigationStarted || !isNavigating) {
      console.log(`[Agent] ${action.description} - starting/restarting navigation to [${target.x}, ${target.y}, ${target.z}]`)
      
      action.navigationStarted = true
      
      // Try to navigate
      try {
        this.navigationSystem.navigateTo({
          _entityId: agentId,
          destination: target,
          speed: 3,
          callback: () => {
            console.log(`[Agent] Navigation callback triggered for: ${action.description}`)
            action.completed = true
            if (action.callback) {
              action.callback()
            }
          }
        })
      } catch (error) {
        console.error(`[Agent] Failed to start navigation for: ${action.description}`, error)
        action.completed = true
        if (action.callback) {
          action.callback()
        }
      }
    }
  }

  /**
   * Execute interact action
   */
  private executeInteractAction(action: AgentAction): void {
    console.log(`[Agent] ${action.description} - simulating interaction`)

    // Simulate quest interaction
    if (this.questSystem && this.agent && action.target === 'quest_giver_1') {
      const agentId = this.agent.id || this.agent.data?.id

      if (agentId) {
        // Try to start a quest
        const availableQuests = this.questSystem.getAvailableQuests(agentId)
        const cookQuest = availableQuests.find(q => q.id === 'cooks_assistant')

        if (cookQuest) {
          console.log('[Agent] Starting quest: cooks_assistant')
          this.questSystem.startQuest(agentId, 'cooks_assistant')
        } else {
          console.log('[Agent] No available quests from this NPC')
        }
      }
    }

    action.completed = true
    if (action.callback) {
      action.callback()
    }
  }

  /**
   * Execute pickup action
   */
  private executePickupAction(action: AgentAction): void {
    console.log(`[Agent] ${action.description} - looking for item`)

    // Find nearest sword item
    const entities = (this.world as any).entities?.items || new Map()
    let swordEntity = null

    for (const [_id, entity] of entities) {
      if (entity.data?.type === 'item' && entity.data?.itemType === 'sword') {
        swordEntity = entity
        break
      }
    }

    if (swordEntity) {
      console.log('[Agent] Found sword, picking up')
      // Simulate pickup by adding to inventory
      const inventory = this.agent?.getComponent('inventory') as any
      if (inventory) {
        inventory.items.set('sword', { itemId: 1001, name: 'Bronze Sword', quantity: 1 })
        console.log('[Agent] Added sword to inventory')
      }

      // Remove from world (simulate pickup)
      entities.delete((swordEntity as any).id || (swordEntity as any).data?.id)
      console.log('[Agent] Removed sword from world')
    } else {
      console.log('[Agent] No sword found nearby')
    }

    action.completed = true
    if (action.callback) {
      action.callback()
    }
  }

  /**
   * Execute attack action
   */
  private executeAttackAction(action: AgentAction): void {
    console.log(`[Agent] ${action.description} - looking for goblin`)

    // Find nearest goblin
    const entities = (this.world as any).entities?.items || new Map()
    let goblinEntity = null

    for (const [_id, entity] of entities) {
      const npcComponent = entity.getComponent?.('npc')
      if (npcComponent && (npcComponent.npcId === 1 || npcComponent.name?.toLowerCase().includes('goblin'))) {
        goblinEntity = entity as any
        break
      }
    }

    if (goblinEntity) {
      console.log('[Agent] Found goblin, attacking!')

      // Simulate combat and goblin death
      setTimeout(() => {
        // Remove goblin from world
        entities.delete((goblinEntity as any).id || (goblinEntity as any).data?.id)
        console.log('[Agent] Goblin defeated!')

        // Add loot to inventory
        const inventory = this.agent?.getComponent('inventory') as any
        if (inventory) {
          inventory.gold = (inventory.gold || 0) + 25
          console.log('[Agent] Gained 25 gold from goblin')
        }

        action.completed = true
        if (action.callback) {
          action.callback()
        }
      }, 2000) // 2 second combat
    } else {
      console.log('[Agent] No goblin found, retrying...')
      // Don't mark as completed, will retry
    }
  }

  /**
   * Move to next action in task
   */
  private moveToNextAction(): void {
    if (!this.currentTask) {
      return
    }

    this.currentTask.currentAction++

    if (this.currentTask.currentAction >= this.currentTask.actions.length) {
      this.currentTask.completed = true
      console.log(`[AgentPlayerSystem] Task "${this.currentTask.name}" completed!`)

      if (this.currentTask.callback) {
        this.currentTask.callback()
      }
    } else {
      const nextAction = this.currentTask.actions[this.currentTask.currentAction]
      console.log(`[AgentPlayerSystem] Starting next action: ${nextAction.description}`)
    }
  }

  /**
   * Get current task status
   */
  getTaskStatus(): { task: string; action: string; progress: string } | null {
    if (!this.currentTask) {
      return null
    }

    const currentAction = this.currentTask.actions[this.currentTask.currentAction]
    const progress = `${this.currentTask.currentAction + 1}/${this.currentTask.actions.length}`

    return {
      task: this.currentTask.name,
      action: currentAction?.description || 'None',
      progress,
    }
  }

  override destroy(): void {
    // Clear test mode timeout
    if (this.testModeTimeout) {
      clearTimeout(this.testModeTimeout)
      this.testModeTimeout = undefined
    }

    // Stop update loop
    if (this.updateInterval) {
      clearInterval(this.updateInterval)
      this.updateInterval = null
    }

    // Clean up agent
    if (this.agent) {
      const agentId = this.agent.id || this.agent.data?.id
      const entities = (this.world as any).entities?.items
      if (entities) {
        entities.delete(agentId)
      }
    }

    super.destroy()
  }
}
