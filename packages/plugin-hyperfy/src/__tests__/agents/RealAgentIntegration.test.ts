// This test file is commented out as it references non-existent modules
// TODO: Implement proper agent integration tests when the required modules are available

/*
import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { AgentRuntime, SqliteAdapter } from '@elizaos/core'
import { AmongUsAgent } from '../../agents/among-us-hyperfy-agent'
import { HyperfyWorld } from '../../worlds/among-us/AmongUsHyperfyWorld'
import { GameState, PlayerRole } from '../../apps/amongus/GameState'
import { characters } from '../../agents/characters'

describe('Real Agent Integration', () => {
  let world: HyperfyWorld
  let agents: AmongUsAgent[] = []
  let gameState: GameState

  beforeEach(async () => {
    // Create test world
    world = new HyperfyWorld({
      port: 9999,
      maxGames: 5,
      testMode: true,
    })

    await world.start()
    gameState = new GameState()
  })

  afterEach(async () => {
    // Cleanup all agents
    for (const agent of agents) {
      await agent.disconnect()
    }
    agents = []

    // Stop world
    await world.stop()
  })

  describe('Agent Connection', () => {
    it('should connect real AI agents to game world', async () => {
      // Create 5 real agents
      for (let i = 0; i < 5; i++) {
        const character = characters[i]

        const agent = new AmongUsAgent({
          id: `agent-${i}`,
          name: character.name,
          character: character,
          runtime: new AgentRuntime({
            adapter: new SqliteAdapter(':memory:'),
            character: character,
            modelProvider: 'local', // Use local model for tests
          }),
        })

        await agent.connect(world.url)
        agents.push(agent)
      }

      // Wait for agents to join game
      await new Promise(resolve => setTimeout(resolve, 1000))

      expect(world.connectedAgents.size).toBe(5)
      expect(world.activeGames.size).toBe(1)

      const game = Array.from(world.activeGames.values())[0]
      expect(game.players.size).toBe(5)
    })

    it('should handle agent disconnection gracefully', async () => {
      const agent = new AmongUsAgent({
        id: 'test-agent',
        name: 'Test Agent',
        character: characters[0],
        runtime: new AgentRuntime({
          adapter: new SqliteAdapter(':memory:'),
          character: characters[0],
        }),
      })

      await agent.connect(world.url)
      agents.push(agent)

      expect(world.connectedAgents.has('test-agent')).toBe(true)

      await agent.disconnect()

      expect(world.connectedAgents.has('test-agent')).toBe(false)
    })
  })

  describe('Agent Decision Making', () => {
    it('should make role-appropriate decisions as crewmate', async () => {
      const crewmateAgent = new AmongUsAgent({
        id: 'crewmate-1',
        name: 'Blue',
        character: characters.find(c => c.name === 'Blue')!,
        runtime: new AgentRuntime({
          adapter: new SqliteAdapter(':memory:'),
          character: characters.find(c => c.name === 'Blue')!,
        }),
      })

      await crewmateAgent.connect(world.url)
      await crewmateAgent.assignRole(PlayerRole.CREWMATE)
      agents.push(crewmateAgent)

      // Monitor decisions for 10 seconds
      const decisions: any[] = []
      crewmateAgent.on('decision', decision => {
        decisions.push(decision)
      })

      // Add some tasks to the game
      gameState.tasks.set('task-1', {
        id: 'task-1',
        name: 'Fix Wiring',
        position: { x: 10, y: 0, z: 10 },
        duration: 5000,
        completedBy: new Set(),
        inProgress: new Map(),
      })

      // Trigger decision making
      await crewmateAgent.makeDecision(gameState)

      // Should prioritize tasks
      const taskDecisions = decisions.filter(
        d => d.action === 'move_to_task' || d.action === 'start_task'
      )
      expect(taskDecisions.length).toBeGreaterThan(0)

      // Should not have kill decisions
      const killDecisions = decisions.filter(d => d.action === 'kill')
      expect(killDecisions.length).toBe(0)
    })

    it('should exhibit impostor behavior when assigned impostor role', async () => {
      const impostorAgent = new AmongUsAgent({
        id: 'impostor-1',
        name: 'Red',
        character: characters.find(c => c.name === 'Red')!,
        runtime: new AgentRuntime({
          adapter: new SqliteAdapter(':memory:'),
          character: characters.find(c => c.name === 'Red')!,
        }),
      })

      await impostorAgent.connect(world.url)
      await impostorAgent.assignRole(PlayerRole.IMPOSTOR)
      agents.push(impostorAgent)

      // Add some crewmates to the game
      gameState.addPlayer('crew-1', { name: 'Green' })
      gameState.addPlayer('crew-2', { name: 'Yellow' })
      gameState.players.get('crew-1')!.role = PlayerRole.CREWMATE
      gameState.players.get('crew-2')!.role = PlayerRole.CREWMATE

      // Put a crewmate in isolated position
      gameState.players.get('crew-1')!.position = { x: 50, y: 0, z: 50 }

      const decisions: any[] = []
      impostorAgent.on('decision', decision => {
        decisions.push(decision)
      })

      // Trigger decision making
      await impostorAgent.makeDecision(gameState)

      // Should consider kill opportunities
      const killConsiderations = decisions.filter(
        d => d.action === 'move_to_player' || d.action === 'kill'
      )
      expect(killConsiderations.length).toBeGreaterThan(0)

      // Should fake tasks
      const fakeTaskDecisions = decisions.filter(
        d => d.action === 'move_to_task' && d.reason?.includes('fake')
      )
      expect(fakeTaskDecisions.length).toBeGreaterThan(0)
    })
  })

  describe('Agent Communication', () => {
    it('should communicate during meetings', async () => {
      const agent = new AmongUsAgent({
        id: 'chat-agent',
        name: 'Pink',
        character: characters.find(c => c.name === 'Pink')!,
        runtime: new AgentRuntime({
          adapter: new SqliteAdapter(':memory:'),
          character: characters.find(c => c.name === 'Pink')!,
        }),
      })

      await agent.connect(world.url)
      agents.push(agent)

      // Start meeting
      gameState.phase = 'meeting'
      gameState.meetingType = 'emergency'

      const messages: string[] = []
      world.on('chat:message', msg => {
        if (msg.playerId === 'chat-agent') {
          messages.push(msg.text)
        }
      })

      // Trigger discussion
      await agent.participateInMeeting(gameState, {
        type: 'emergency',
        caller: 'player-2',
        context: 'Saw Red near body in electrical',
      })

      // Should generate contextual responses
      expect(messages.length).toBeGreaterThan(0)
      expect(
        messages.some(
          m =>
            m.toLowerCase().includes('electrical') ||
            m.toLowerCase().includes('red')
        )
      ).toBe(true)
    })

    it('should vote intelligently based on discussion', async () => {
      const agent = new AmongUsAgent({
        id: 'voting-agent',
        name: 'Blue',
        character: characters.find(c => c.name === 'Blue')!,
        runtime: new AgentRuntime({
          adapter: new SqliteAdapter(':memory:'),
          character: characters.find(c => c.name === 'Blue')!,
        }),
      })

      await agent.connect(world.url)
      await agent.assignRole(PlayerRole.CREWMATE)
      agents.push(agent)

      // Setup voting scenario
      const votingContext = {
        discussion: [
          { playerId: 'p1', text: 'I saw Red vent in electrical!' },
          { playerId: 'p2', text: 'Red was with me in admin' },
          { playerId: 'p3', text: 'I can confirm Red vented' },
        ],
        suspects: ['red-player', 'green-player'],
        alibis: new Map([['green-player', ['p2']]]),
      }

      const vote = await agent.decideVote(votingContext)

      // Should vote for the suspicious player (Red)
      expect(vote).toBe('red-player')
    })
  })

  describe('Agent Strategies', () => {
    it('should adapt strategy based on game state', async () => {
      const agent = new AmongUsAgent({
        id: 'strategic-agent',
        name: 'Orange',
        character: characters.find(c => c.name === 'Orange')!,
        runtime: new AgentRuntime({
          adapter: new SqliteAdapter(':memory:'),
          character: characters.find(c => c.name === 'Orange')!,
        }),
      })

      await agent.connect(world.url)
      await agent.assignRole(PlayerRole.CREWMATE)
      agents.push(agent)

      // Early game - should focus on tasks
      gameState.startTime = Date.now()
      const earlyDecision = await agent.makeDecision(gameState)
      expect(earlyDecision.priority).toBe('tasks')

      // Late game with few tasks left
      gameState.startTime = Date.now() - 300000 // 5 minutes ago
      gameState.tasks.forEach(task => {
        task.completedBy.add('other-player')
      })

      const lateDecision = await agent.makeDecision(gameState)
      expect(lateDecision.priority).toBe('survival')
    })

    it('should coordinate with other agents', async () => {
      // Create multiple agents
      const agents: AmongUsAgent[] = []
      for (let i = 0; i < 3; i++) {
        const agent = new AmongUsAgent({
          id: `coord-agent-${i}`,
          name: characters[i].name,
          character: characters[i],
          runtime: new AgentRuntime({
            adapter: new SqliteAdapter(':memory:'),
            character: characters[i],
          }),
        })

        await agent.connect(world.url)
        await agent.assignRole(PlayerRole.CREWMATE)
        agents.push(agent)
      }

      // Track coordination
      const taskAssignments = new Map<string, string>()

      agents.forEach(agent => {
        agent.on('task:claimed', data => {
          taskAssignments.set(data.agentId, data.taskId)
        })
      })

      // Have agents coordinate task selection
      await Promise.all(agents.map(a => a.coordinateTasks(gameState)))

      // Should not have duplicate task assignments
      const assignedTasks = Array.from(taskAssignments.values())
      const uniqueTasks = new Set(assignedTasks)
      expect(uniqueTasks.size).toBe(assignedTasks.length)
    })
  })

  describe('Performance Under Load', () => {
    it('should handle multiple concurrent games', async () => {
      const gamesCount = 3
      const agentsPerGame = 5

      // Create multiple games with agents
      for (let g = 0; g < gamesCount; g++) {
        for (let a = 0; a < agentsPerGame; a++) {
          const agent = new AmongUsAgent({
            id: `game${g}-agent${a}`,
            name: `Agent ${a}`,
            character: characters[a % characters.length],
            runtime: new AgentRuntime({
              adapter: new SqliteAdapter(':memory:'),
              character: characters[a % characters.length],
            }),
          })

          await agent.connect(world.url, `game-${g}`)
          agents.push(agent)
        }
      }

      // All games should be active
      expect(world.activeGames.size).toBe(gamesCount)

      // Each game should have correct player count
      world.activeGames.forEach(game => {
        expect(game.players.size).toBe(agentsPerGame)
      })

      // Test concurrent decision making
      const startTime = Date.now()
      await Promise.all(agents.map(agent => agent.makeDecision(gameState)))
      const duration = Date.now() - startTime

      // Should complete within reasonable time (< 100ms per agent)
      expect(duration).toBeLessThan(agents.length * 100)
    })

    it('should maintain performance with rapid state changes', async () => {
      const agent = new AmongUsAgent({
        id: 'perf-agent',
        name: 'Performance Tester',
        character: characters[0],
        runtime: new AgentRuntime({
          adapter: new SqliteAdapter(':memory:'),
          character: characters[0],
        }),
      })

      await agent.connect(world.url)
      agents.push(agent)

      const iterations = 100
      const decisions: any[] = []

      const startTime = Date.now()

      // Rapidly change game state and request decisions
      for (let i = 0; i < iterations; i++) {
        // Modify game state
        if (i % 10 === 0) {
          gameState.phase =
            gameState.phase === 'playing' ? 'meeting' : 'playing'
        }

        const decision = await agent.makeDecision(gameState)
        decisions.push(decision)
      }

      const duration = Date.now() - startTime

      // Should maintain consistent performance
      expect(duration).toBeLessThan(iterations * 50) // < 50ms per decision
      expect(decisions.length).toBe(iterations)

      // Decisions should be contextual
      const playingDecisions = decisions.filter((d, i) => i % 10 < 5)
      const meetingDecisions = decisions.filter((d, i) => i % 10 >= 5)

      expect(playingDecisions.some(d => d.context === 'playing')).toBe(true)
      expect(meetingDecisions.some(d => d.context === 'meeting')).toBe(true)
    })
  })

  describe('Error Handling', () => {
    it('should recover from connection failures', async () => {
      const agent = new AmongUsAgent({
        id: 'resilient-agent',
        name: 'Resilient',
        character: characters[0],
        runtime: new AgentRuntime({
          adapter: new SqliteAdapter(':memory:'),
          character: characters[0],
        }),
      })

      await agent.connect(world.url)
      agents.push(agent)

      // Simulate connection drop
      world.disconnectAgent('resilient-agent')

      // Agent should attempt reconnection
      await new Promise(resolve => setTimeout(resolve, 2000))

      expect(agent.isConnected).toBe(true)
      expect(world.connectedAgents.has('resilient-agent')).toBe(true)
    })

    it('should handle malformed game states', async () => {
      const agent = new AmongUsAgent({
        id: 'error-agent',
        name: 'Error Handler',
        character: characters[0],
        runtime: new AgentRuntime({
          adapter: new SqliteAdapter(':memory:'),
          character: characters[0],
        }),
      })

      await agent.connect(world.url)
      agents.push(agent)

      // Send malformed state
      const malformedState = {
        phase: 'invalid-phase',
        players: null,
        tasks: undefined,
      } as any

      // Should not crash
      const decision = await agent.makeDecision(malformedState)
      expect(decision).toBeDefined()
      expect(decision.error).toBeDefined()
    })
  })
}
*/
