import { EventEmitter } from 'events'
// Mock types until amongus app is available
type AmongUsPlayer = any
import { Vector3 } from '../types/math'
import { PlayerRole, GameState } from '../types/eliza-mock'

export interface SimulationConfig {
  tickRate: number
  maxDuration: number
  recordMetrics?: boolean
  seed?: number
}

export interface GameScenario {
  playerCount: number
  impostorCount?: number
  behaviors: {
    crewmate: string
    impostor: string
  }
  taskSettings?: {
    count: number
    duration: { min: number; max: number }
  }
  impostorSettings?: {
    killCooldown: number
  }
  meetingSettings?: {
    discussionTime: number
    votingTime: number
  }
  sabotageSettings?: {
    enabled: boolean
    types: string[]
    frequency: number
  }
  events?: Array<{
    type: string
    time: number
    [key: string]: any
  }>
  recordMetrics?: boolean
  maxDuration?: number
}

export interface SimulationResult {
  winner: 'crewmates' | 'impostors'
  winCondition: string
  duration: number
  completed: boolean
  survivingCrewmates: number
  initialImpostors: number
  metrics: SimulationMetrics
  events: SimulationEvent[]
  recording?: GameRecording
}

export interface SimulationMetrics {
  totalTicks: number
  avgTickDuration: number
  peakMemoryUsage: number
  totalNetworkMessages: number
  avgDecisionTime: number
  tasksCompleted: number
  totalKills: number
  meetingsCalled: number
  impostorsEjected: number
  avgKillsPerImpostor: number
  sabotagesTriggered: number
  sabotagesFixed: number
  afkPlayers: number
  totalEjections: number
  droppedFrames: number
  errorCount: number
}

export interface SimulationEvent {
  type: string
  timestamp: number
  playerId?: string
  [key: string]: any
}

export interface GameRecording {
  scenario: GameScenario
  events: SimulationEvent[]
  finalState: any
}

export interface SimulatedPlayer {
  id: string
  role: PlayerRole
  behavior: string
  position: Vector3
  alive: boolean
  suspicions: Map<string, number>
  memory: any[]

  decideAction(gameState: GameState): Promise<PlayerDecision>
  analyzeBehavior(events: any[]): Promise<Map<string, number>>
  selectTarget(gameState: GameState, victims: any[]): Promise<any>
}

export interface PlayerDecision {
  action: string
  target?: string
  position?: Vector3
  reason?: string
  priority?: string
  context?: string
  error?: string
}

export class PlayerSimulator extends EventEmitter {
  public id: string
  private world: any
  private config: SimulationConfig
  private rng: () => number
  private currentTick: number = 0
  private metrics: Partial<SimulationMetrics> = {}
  private events: SimulationEvent[] = []
  private players: Map<string, SimulatedPlayer> = new Map()
  private gameState: GameState

  constructor(world: any, config: SimulationConfig) {
    super()
    this.id = `simulator-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`
    this.world = world
    this.config = config
    this.rng = this.createRNG(config.seed || Date.now())
    this.gameState = { players: [], phase: 'waiting' }
  }

  async simulate(scenario: GameScenario): Promise<SimulationResult> {
    // Reset state
    this.reset()

    // Initialize game
    const startTime = Date.now()
    await this.initializeGame(scenario)

    // Run simulation
    while (
      !this.gameState.checkWinCondition().gameEnded &&
      this.currentTick * (1000 / this.config.tickRate) < this.config.maxDuration
    ) {
      const tickStart = Date.now()
      await this.simulateTick(scenario)
      const tickDuration = Date.now() - tickStart

      this.updateMetrics(tickDuration)
      this.currentTick++

      // Process scheduled events
      await this.processScheduledEvents(scenario.events || [])

      // Wait for next tick
      const targetDelay = 1000 / this.config.tickRate
      const actualDelay = Math.max(0, targetDelay - tickDuration)
      await new Promise(resolve => setTimeout(resolve, actualDelay))
    }

    const duration = Date.now() - startTime
    const winCondition = this.gameState.checkWinCondition()

    return {
      winner: winCondition.winner!,
      winCondition: winCondition.reason!,
      duration,
      completed: true,
      survivingCrewmates: this.countSurvivingCrewmates(),
      initialImpostors: scenario.impostorCount || 1,
      metrics: this.finalizeMetrics(),
      events: this.events,
      recording: this.createRecording(scenario),
    }
  }

  async createSimulatedPlayer(config: {
    id: string
    role: PlayerRole
    behavior: string
  }): Promise<SimulatedPlayer> {
    const player: SimulatedPlayer = {
      id: config.id,
      role: config.role,
      behavior: config.behavior,
      position: { x: 25, y: 0, z: 25 },
      alive: true,
      suspicions: new Map(),
      memory: [],

      async decideAction(gameState: GameState): Promise<PlayerDecision> {
        // Behavior-based decision making
        switch (config.behavior) {
          case 'task-focused':
            return this.taskFocusedDecision(gameState)
          case 'aggressive':
            return this.aggressiveDecision(gameState)
          case 'observant':
            return this.observantDecision(gameState)
          case 'balanced':
            return this.balancedDecision(gameState)
          default:
            return { action: 'wander', priority: 'low' }
        }
      },

      async analyzeBehavior(events: any[]): Promise<Map<string, number>> {
        const suspicions = new Map<string, number>()

        for (const event of events) {
          const currentSuspicion = suspicions.get(event.playerId) || 0
          let increase = 0

          switch (event.action) {
            case 'near_vent':
              increase = 0.3
              break
            case 'following':
              increase = 0.2 * (event.duration / 10000)
              break
            case 'fake_task':
              increase = 0.4
              break
          }

          suspicions.set(
            event.playerId,
            Math.min(1, currentSuspicion + increase)
          )
        }

        return suspicions
      },

      async selectTarget(gameState: GameState, victims: any[]): Promise<any> {
        // Select best target based on isolation and distance
        const scoredTargets = victims.map(victim => ({
          ...victim,
          score:
            (victim.isolated ? 2 : 1) *
            (1 / (1 + this.distance(this.position, victim.position))),
        }))

        scoredTargets.sort((a, b) => b.score - a.score)

        return {
          targetId: scoredTargets[0].id,
          reason: scoredTargets[0].isolated
            ? 'Target is isolated'
            : 'Target is nearby',
        }
      },
    }

    // Bind methods to preserve context
    player.decideAction = player.decideAction.bind(this)
    player.analyzeBehavior = player.analyzeBehavior.bind(this)
    player.selectTarget = player.selectTarget.bind(this)

    return player
  }

  createMeetingSimulator() {
    return {
      async simulateDiscussion(
        participants: any[],
        context: any,
        duration: number
      ) {
        const messages: any[] = []
        const startTime = Date.now()

        // Generate initial reactions
        for (const participant of participants) {
          if (this.rng() > 0.3) {
            // 70% chance to speak initially
            messages.push({
              playerId: participant.id,
              text: this.generateReaction(participant, context),
              timestamp: Date.now(),
            })
          }
        }

        // Continue discussion
        while (Date.now() - startTime < duration) {
          const speaker =
            participants[Math.floor(this.rng() * participants.length)]

          if (this.shouldSpeak(speaker, messages)) {
            messages.push({
              playerId: speaker.id,
              text: this.generateStatement(speaker, messages, context),
              timestamp: Date.now(),
            })
          }

          await new Promise(resolve =>
            setTimeout(resolve, 1000 + this.rng() * 2000)
          )
        }

        return { messages }
      },
    }
  }

  createVotingSimulator() {
    return {
      async simulateVoting(voters: any[]) {
        const votes: any[] = []

        for (const voter of voters) {
          // Find most suspicious player
          let maxSuspicion = 0
          let voteTarget = null

          voter.suspicions.forEach((suspicion: number, playerId: string) => {
            if (suspicion > maxSuspicion) {
              maxSuspicion = suspicion
              voteTarget = playerId
            }
          })

          // Vote if suspicion is high enough
          if (maxSuspicion > 0.4) {
            votes.push({
              voter: voter.id,
              target: voteTarget,
              confidence: maxSuspicion,
            })
          } else {
            votes.push({
              voter: voter.id,
              target: null, // Skip
              confidence: 0,
            })
          }
        }

        return votes
      },
    }
  }

  async replay(
    recording: GameRecording,
    options?: { speed: number }
  ): Promise<SimulationResult> {
    const speed = options?.speed || 1
    this.reset()

    // Initialize from recording
    await this.initializeGame(recording.scenario)

    // Replay events
    const startTime = Date.now()
    for (const event of recording.events) {
      // Wait for event time (adjusted for speed)
      const waitTime = (event.timestamp - startTime) / speed
      await new Promise(resolve => setTimeout(resolve, Math.max(0, waitTime)))

      // Apply event
      await this.applyEvent(event)
    }

    const winCondition = this.gameState.checkWinCondition()

    return {
      winner: winCondition.winner!,
      winCondition: winCondition.reason!,
      duration: Date.now() - startTime,
      completed: true,
      survivingCrewmates: this.countSurvivingCrewmates(),
      initialImpostors: recording.scenario.impostorCount || 1,
      metrics: this.finalizeMetrics(),
      events: this.events,
      recording,
    }
  }

  // Private helper methods
  private async initializeGame(scenario: GameScenario): Promise<void> {
    // Spawn players
    for (let i = 0; i < scenario.playerCount; i++) {
      const playerId = `p${i}`
      this.gameState.addPlayer(playerId, { name: `Player ${i}` })
    }

    // Start game
    this.gameState.startGame()

    // Create simulated players
    const players = Array.from(this.gameState.players.values())
    for (const player of players) {
      const behavior =
        player.role === PlayerRole.IMPOSTOR
          ? scenario.behaviors.impostor
          : scenario.behaviors.crewmate

      const simPlayer = await this.createSimulatedPlayer({
        id: player.id,
        role: player.role!,
        behavior,
      })

      this.players.set(player.id, simPlayer)
    }
  }

  private async simulateTick(scenario: GameScenario): Promise<void> {
    // Update each player
    for (const [playerId, simPlayer] of this.players) {
      if (!simPlayer.alive) continue

      const decision = await simPlayer.decideAction(this.gameState)
      await this.executeDecision(playerId, decision)
    }

    // Check for meetings
    if (this.shouldCallMeeting()) {
      await this.simulateMeeting()
    }
  }

  private taskFocusedDecision(gameState: GameState): PlayerDecision {
    const uncompletedTasks = Array.from(gameState.tasks.values()).filter(
      task => !task.completedBy.has(this.id)
    )

    if (uncompletedTasks.length === 0) {
      return { action: 'wander', priority: 'low' }
    }

    const nearestTask = uncompletedTasks[0] // Simplified
    return {
      action: 'move_to_task',
      target: nearestTask.id,
      position: nearestTask.position,
      priority: 'tasks',
    }
  }

  private aggressiveDecision(gameState: GameState): PlayerDecision {
    // Implementation for aggressive impostor behavior
    return {
      action: 'hunt',
      priority: 'kill',
    }
  }

  private observantDecision(gameState: GameState): PlayerDecision {
    // Implementation for observant crewmate behavior
    return {
      action: 'observe',
      priority: 'information',
    }
  }

  private balancedDecision(gameState: GameState): PlayerDecision {
    // Implementation for balanced behavior
    return {
      action: 'balanced',
      priority: 'balanced',
    }
  }

  private distance(pos1: Vector3, pos2: Vector3): number {
    return Math.sqrt(
      (pos1.x - pos2.x) ** 2 + (pos1.y - pos2.y) ** 2 + (pos1.z - pos2.z) ** 2
    )
  }

  private createRNG(seed: number): () => number {
    // Simple seeded RNG
    let s = seed
    return () => {
      s = (s * 1103515245 + 12345) % 2147483648
      return s / 2147483648
    }
  }

  private reset(): void {
    this.currentTick = 0
    this.metrics = {}
    this.events = []
    this.players.clear()
    this.gameState = { players: [], phase: 'waiting' }
  }

  private updateMetrics(tickDuration: number): void {
    if (!this.config.recordMetrics) return

    this.metrics.totalTicks = (this.metrics.totalTicks || 0) + 1
    this.metrics.avgTickDuration =
      ((this.metrics.avgTickDuration || 0) * this.currentTick + tickDuration) /
      (this.currentTick + 1)
  }

  private finalizeMetrics(): SimulationMetrics {
    return {
      totalTicks: this.metrics.totalTicks || 0,
      avgTickDuration: this.metrics.avgTickDuration || 0,
      peakMemoryUsage: process.memoryUsage().heapUsed,
      totalNetworkMessages: this.world.broadcasts.length,
      avgDecisionTime: 50, // Placeholder
      tasksCompleted: this.countCompletedTasks(),
      totalKills: this.events.filter(e => e.type === 'kill').length,
      meetingsCalled: this.events.filter(e => e.type === 'meeting_start')
        .length,
      impostorsEjected: this.events.filter(
        e => e.type === 'ejection' && e.wasImpostor
      ).length,
      avgKillsPerImpostor: 0, // Calculate from events
      sabotagesTriggered: this.events.filter(e => e.type === 'sabotage').length,
      sabotagesFixed: this.events.filter(e => e.type === 'sabotage_fixed')
        .length,
      afkPlayers: 0, // Track from events
      totalEjections: this.events.filter(e => e.type === 'ejection').length,
      droppedFrames: 0,
      errorCount: 0,
    }
  }

  private countSurvivingCrewmates(): number {
    return Array.from(this.gameState.players.values()).filter(
      p => p.alive && p.role === PlayerRole.CREWMATE
    ).length
  }

  private countCompletedTasks(): number {
    let count = 0
    this.gameState.tasks.forEach(task => {
      count += task.completedBy.size
    })
    return count
  }

  private createRecording(scenario: GameScenario): GameRecording {
    return {
      scenario,
      events: this.events,
      finalState: this.gameState.serialize(),
    }
  }

  private async processScheduledEvents(events: any[]): Promise<void> {
    const currentTime = this.currentTick * (1000 / this.config.tickRate)

    for (const event of events) {
      if (Math.abs(event.time - currentTime) < 1000 / this.config.tickRate) {
        await this.applyEvent(event)
      }
    }
  }

  private async applyEvent(event: any): Promise<void> {
    this.events.push({
      ...event,
      timestamp: Date.now(),
    })

    // Apply event to game state
    switch (event.type) {
      case 'player_afk':
        // Mark players as AFK
        break
      case 'synchronized_kill':
        // Process synchronized kills
        break
      // ... other event types
    }
  }

  private async executeDecision(
    playerId: string,
    decision: PlayerDecision
  ): Promise<void> {
    // Execute the player's decision
    switch (decision.action) {
      case 'move_to_task':
        // Move player towards task
        break
      case 'start_task':
        // Start task interaction
        break
      case 'kill':
        // Attempt kill
        break
      // ... other actions
    }
  }

  private shouldCallMeeting(): boolean {
    // Check if meeting should be called
    return false // Simplified
  }

  private async simulateMeeting(): Promise<void> {
    // Simulate meeting discussion and voting
  }

  private generateReaction(participant: any, context: any): string {
    // Generate contextual reaction based on personality
    return `Reaction from ${participant.id}`
  }

  private generateStatement(
    speaker: any,
    previousMessages: any[],
    context: any
  ): string {
    // Generate contextual statement
    return `Statement from ${speaker.id}`
  }

  private shouldSpeak(speaker: any, messages: any[]): boolean {
    // Determine if player should speak
    return this.rng() > 0.7 // 30% chance
  }
}
