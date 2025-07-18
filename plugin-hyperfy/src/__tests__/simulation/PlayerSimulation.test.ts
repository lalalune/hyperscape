import { describe, it, expect, beforeEach } from 'vitest';
import { PlayerSimulator, SimulationConfig, GameScenario } from '../../testing/PlayerSimulator';
import { MockWorld } from '../helpers/MockWorld';
import { GameState, PlayerRole } from '../../apps/amongus/GameState';

describe('Player Simulation Tests', () => {
  let simulator: PlayerSimulator;
  let world: MockWorld;

  beforeEach(() => {
    world = new MockWorld();
    simulator = new PlayerSimulator(world, {
      tickRate: 20, // 20 ticks per second for faster testing
      maxDuration: 600000, // 10 minutes max
      recordMetrics: true,
      seed: 12345 // Deterministic randomness
    });
  });

  describe('Basic Game Scenarios', () => {
    it('should complete game with crewmate task win', async () => {
      const scenario: GameScenario = {
        playerCount: 5,
        behaviors: {
          crewmate: 'task-focused',
          impostor: 'passive'
        },
        taskSettings: {
          count: 3,
          duration: { min: 5000, max: 10000 }
        }
      };

      const result = await simulator.simulate(scenario);

      expect(result.winner).toBe('crewmates');
      expect(result.winCondition).toBe('tasks_completed');
      expect(result.duration).toBeLessThan(180000); // Under 3 minutes
      expect(result.metrics.tasksCompleted).toBeGreaterThan(0);
    });

    it('should handle impostor win by elimination', async () => {
      const scenario: GameScenario = {
        playerCount: 5,
        behaviors: {
          crewmate: 'wandering',
          impostor: 'aggressive'
        },
        impostorSettings: {
          killCooldown: 10000 // Shorter cooldown for testing
        }
      };

      const result = await simulator.simulate(scenario);

      expect(result.winner).toBe('impostors');
      expect(result.winCondition).toBe('elimination');
      expect(result.survivingCrewmates).toBeLessThanOrEqual(1);
      expect(result.metrics.totalKills).toBeGreaterThan(0);
    });

    it('should handle voting out impostor', async () => {
      const scenario: GameScenario = {
        playerCount: 5,
        behaviors: {
          crewmate: 'observant',
          impostor: 'careless'
        },
        meetingSettings: {
          discussionTime: 15000,
          votingTime: 20000
        }
      };

      const result = await simulator.simulate(scenario);

      expect(result.metrics.meetingsCalled).toBeGreaterThan(0);
      expect(result.metrics.impostorsEjected).toBeGreaterThan(0);
      
      if (result.winner === 'crewmates') {
        expect(result.winCondition).toBe('impostors_ejected');
      }
    });
  });

  describe('Complex Scenarios', () => {
    it('should handle multi-impostor games', async () => {
      const scenario: GameScenario = {
        playerCount: 8,
        impostorCount: 2,
        behaviors: {
          crewmate: 'balanced',
          impostor: 'coordinated'
        }
      };

      const result = await simulator.simulate(scenario);

      expect(result.initialImpostors).toBe(2);
      expect(result.completed).toBe(true);
      
      // Coordinated impostors should be more effective
      if (result.winner === 'impostors') {
        expect(result.metrics.avgKillsPerImpostor).toBeGreaterThan(1);
      }
    });

    it('should simulate sabotage scenarios', async () => {
      const scenario: GameScenario = {
        playerCount: 6,
        behaviors: {
          crewmate: 'reactive',
          impostor: 'saboteur'
        },
        sabotageSettings: {
          enabled: true,
          types: ['lights', 'oxygen', 'reactor'],
          frequency: 30000 // Every 30 seconds
        }
      };

      const result = await simulator.simulate(scenario);

      expect(result.metrics.sabotagesTriggered).toBeGreaterThan(0);
      expect(result.metrics.sabotagesFixed).toBeGreaterThan(0);
      
      // Some sabotages should create kill opportunities
      const sabotageKills = result.events.filter(e => 
        e.type === 'kill' && 
        e.timestamp - result.events.find(s => s.type === 'sabotage')!.timestamp < 10000
      );
      expect(sabotageKills.length).toBeGreaterThan(0);
    });

    it('should handle AFK players', async () => {
      const scenario: GameScenario = {
        playerCount: 6,
        behaviors: {
          crewmate: 'balanced',
          impostor: 'balanced'
        },
        events: [
          { 
            type: 'player_afk', 
            time: 30000, 
            players: ['p2', 'p4'],
            duration: 60000 
          }
        ]
      };

      const result = await simulator.simulate(scenario);

      expect(result.metrics.afkPlayers).toBe(2);
      
      // AFK players should not complete tasks or vote
      const afkTasks = result.events.filter(e => 
        e.type === 'task_complete' && ['p2', 'p4'].includes(e.playerId)
      );
      expect(afkTasks.length).toBe(0);
    });
  });

  describe('Player Behaviors', () => {
    it('should simulate task-focused crewmates', async () => {
      const player = await simulator.createSimulatedPlayer({
        id: 'task-player',
        role: PlayerRole.CREWMATE,
        behavior: 'task-focused'
      });

      const gameState = new GameState();
      gameState.phase = 'playing';
      
      // Add tasks
      for (let i = 0; i < 5; i++) {
        gameState.tasks.set(`task-${i}`, {
          id: `task-${i}`,
          name: `Task ${i}`,
          position: { x: i * 10, y: 0, z: i * 10 },
          duration: 5000,
          completedBy: new Set(),
          inProgress: new Map()
        });
      }

      // Simulate 10 decisions
      const decisions = [];
      for (let i = 0; i < 10; i++) {
        const decision = await player.decideAction(gameState);
        decisions.push(decision);
      }

      // Should mostly choose task-related actions
      const taskActions = decisions.filter(d => 
        d.action === 'move_to_task' || d.action === 'start_task'
      );
      expect(taskActions.length).toBeGreaterThan(7);
    });

    it('should simulate suspicious behavior detection', async () => {
      const observer = await simulator.createSimulatedPlayer({
        id: 'observer',
        role: PlayerRole.CREWMATE,
        behavior: 'observant'
      });

      const gameState = new GameState();
      
      // Simulate suspicious behavior
      const suspiciousEvents = [
        { playerId: 'p1', action: 'near_vent', timestamp: Date.now() },
        { playerId: 'p1', action: 'following', target: 'observer', duration: 15000 },
        { playerId: 'p2', action: 'fake_task', location: 'electrical' }
      ];

      const suspicions = await observer.analyzeBehavior(suspiciousEvents);

      expect(suspicions.get('p1')).toBeGreaterThan(0.7);
      expect(suspicions.get('p2')).toBeGreaterThan(0.5);
    });

    it('should simulate impostor hunting behavior', async () => {
      const impostor = await simulator.createSimulatedPlayer({
        id: 'impostor',
        role: PlayerRole.IMPOSTOR,
        behavior: 'aggressive'
      });

      const gameState = new GameState();
      gameState.phase = 'playing';
      
      // Add potential victims
      const victims = [
        { id: 'v1', position: { x: 10, y: 0, z: 10 }, isolated: true },
        { id: 'v2', position: { x: 20, y: 0, z: 20 }, isolated: false },
        { id: 'v3', position: { x: 50, y: 0, z: 50 }, isolated: true }
      ];

      victims.forEach(v => {
        gameState.players.set(v.id, {
          id: v.id,
          name: `Victim ${v.id}`,
          role: PlayerRole.CREWMATE,
          alive: true,
          position: v.position
        });
      });

      const decision = await impostor.selectTarget(gameState, victims);

      // Should prefer isolated victims
      expect(['v1', 'v3'].includes(decision.targetId)).toBe(true);
      expect(decision.reason).toContain('isolated');
    });
  });

  describe('Meeting Dynamics', () => {
    it('should simulate realistic discussions', async () => {
      const meetingSimulator = simulator.createMeetingSimulator();
      
      const participants = [
        { id: 'p1', role: PlayerRole.CREWMATE, personality: 'analytical' },
        { id: 'p2', role: PlayerRole.IMPOSTOR, personality: 'deceptive' },
        { id: 'p3', role: PlayerRole.CREWMATE, personality: 'emotional' },
        { id: 'p4', role: PlayerRole.CREWMATE, personality: 'quiet' },
        { id: 'p5', role: PlayerRole.IMPOSTOR, personality: 'manipulative' }
      ];

      const context = {
        type: 'body_report',
        reporter: 'p1',
        victim: 'p6',
        location: 'electrical'
      };

      const discussion = await meetingSimulator.simulateDiscussion(
        participants, 
        context,
        30000 // 30 second discussion
      );

      // Should generate realistic conversation flow
      expect(discussion.messages.length).toBeGreaterThan(10);
      
      // Analytical player should ask questions
      const analyticalMessages = discussion.messages.filter(m => m.playerId === 'p1');
      expect(analyticalMessages.some(m => m.text.includes('?'))).toBe(true);
      
      // Impostor should deflect
      const impostorMessages = discussion.messages.filter(m => m.playerId === 'p2');
      expect(impostorMessages.some(m => 
        m.text.toLowerCase().includes('saw') || 
        m.text.toLowerCase().includes('with')
      )).toBe(true);
    });

    it('should simulate voting patterns', async () => {
      const votingSimulator = simulator.createVotingSimulator();
      
      const voters = [
        { id: 'p1', role: PlayerRole.CREWMATE, suspicions: new Map([['p2', 0.8]]) },
        { id: 'p2', role: PlayerRole.IMPOSTOR, suspicions: new Map([['p3', 0.6]]) },
        { id: 'p3', role: PlayerRole.CREWMATE, suspicions: new Map([['p2', 0.7]]) },
        { id: 'p4', role: PlayerRole.CREWMATE, suspicions: new Map([['p2', 0.5]]) }
      ];

      const votes = await votingSimulator.simulateVoting(voters);

      // Majority should vote for most suspicious player
      const voteCount = new Map<string, number>();
      votes.forEach(vote => {
        if (vote.target) {
          voteCount.set(vote.target, (voteCount.get(vote.target) || 0) + 1);
        }
      });

      const mostVoted = Array.from(voteCount.entries())
        .sort((a, b) => b[1] - a[1])[0];
      
      expect(mostVoted[0]).toBe('p2'); // The impostor
      expect(mostVoted[1]).toBeGreaterThanOrEqual(2);
    });
  });

  describe('Performance Metrics', () => {
    it('should track detailed performance metrics', async () => {
      const scenario: GameScenario = {
        playerCount: 6,
        behaviors: {
          crewmate: 'balanced',
          impostor: 'balanced'
        },
        recordMetrics: true
      };

      const result = await simulator.simulate(scenario);

      // Verify all metrics are tracked
      expect(result.metrics).toHaveProperty('totalTicks');
      expect(result.metrics).toHaveProperty('avgTickDuration');
      expect(result.metrics).toHaveProperty('peakMemoryUsage');
      expect(result.metrics).toHaveProperty('totalNetworkMessages');
      expect(result.metrics).toHaveProperty('avgDecisionTime');
      
      // Performance benchmarks
      expect(result.metrics.avgTickDuration).toBeLessThan(50); // ms
      expect(result.metrics.avgDecisionTime).toBeLessThan(100); // ms
    });

    it('should handle stress test scenarios', async () => {
      const stressScenario: GameScenario = {
        playerCount: 8,
        behaviors: {
          crewmate: 'chaotic', // Random actions
          impostor: 'aggressive'
        },
        events: [
          { type: 'rapid_meetings', time: 0, count: 10, interval: 30000 },
          { type: 'mass_movement', time: 0, frequency: 1000 }
        ],
        maxDuration: 120000 // 2 minutes of chaos
      };

      const result = await simulator.simulate(stressScenario);

      expect(result.completed).toBe(true);
      expect(result.metrics.droppedFrames).toBe(0);
      expect(result.metrics.errorCount).toBe(0);
    });
  });

  describe('Edge Cases', () => {
    it('should handle minimum player count', async () => {
      const scenario: GameScenario = {
        playerCount: 5, // Minimum
        behaviors: {
          crewmate: 'balanced',
          impostor: 'balanced'
        }
      };

      const result = await simulator.simulate(scenario);
      expect(result.completed).toBe(true);
    });

    it('should handle all players being ejected', async () => {
      const scenario: GameScenario = {
        playerCount: 5,
        behaviors: {
          crewmate: 'paranoid', // Vote everyone
          impostor: 'obvious'
        }
      };

      const result = await simulator.simulate(scenario);
      
      // Game should end when too few players remain
      expect(result.completed).toBe(true);
      if (result.metrics.totalEjections >= 3) {
        expect(result.winner).toBeDefined();
      }
    });

    it('should handle simultaneous kills', async () => {
      const scenario: GameScenario = {
        playerCount: 8,
        impostorCount: 2,
        events: [
          { 
            type: 'synchronized_kill',
            time: 30000,
            impostors: ['imp1', 'imp2'],
            victims: ['crew1', 'crew2']
          }
        ]
      };

      const result = await simulator.simulate(scenario);
      
      // Both kills should be processed
      const simultaneousKills = result.events.filter(e => 
        e.type === 'kill' && 
        Math.abs(e.timestamp - 30000) < 100
      );
      expect(simultaneousKills.length).toBe(2);
    });
  });

  describe('Replay System', () => {
    it('should record and replay games', async () => {
      const scenario: GameScenario = {
        playerCount: 5,
        behaviors: {
          crewmate: 'balanced',
          impostor: 'balanced'
        }
      };

      const originalResult = await simulator.simulate(scenario);
      const recording = originalResult.recording;

      // Replay the game
      const replayResult = await simulator.replay(recording);

      // Key events should match
      expect(replayResult.winner).toBe(originalResult.winner);
      expect(replayResult.duration).toBeCloseTo(originalResult.duration, -2);
      expect(replayResult.events.length).toBe(originalResult.events.length);
    });

    it('should allow fast-forward replay', async () => {
      const scenario: GameScenario = {
        playerCount: 5,
        behaviors: {
          crewmate: 'balanced',
          impostor: 'balanced'
        }
      };

      const result = await simulator.simulate(scenario);
      const recording = result.recording;

      const startTime = Date.now();
      const fastReplay = await simulator.replay(recording, { speed: 10 });
      const replayDuration = Date.now() - startTime;

      // Should be roughly 10x faster
      expect(replayDuration).toBeLessThan(result.duration / 8);
      expect(fastReplay.winner).toBe(result.winner);
    });
  });
}); 