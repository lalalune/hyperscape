import { describe, it, expect, beforeEach } from 'vitest'
import { GameState, GamePhase, PlayerRole } from '../../apps/amongus/GameState'

describe('GameState', () => {
  let gameState: GameState

  beforeEach(() => {
    gameState = new GameState()
  })

  describe('Initialization', () => {
    it('should initialize with correct default values', () => {
      expect(gameState.phase).toBe(GamePhase.LOBBY)
      expect(gameState.players.size).toBe(0)
      expect(gameState.minPlayers).toBe(5)
      expect(gameState.maxPlayers).toBe(8)
      expect(gameState.tasks.size).toBe(0)
      expect(gameState.bodies.size).toBe(0)
    })

    it('should generate unique game ID', () => {
      const game1 = new GameState()
      const game2 = new GameState()
      expect(game1.id).not.toBe(game2.id)
    })
  })

  describe('Player Management', () => {
    it('should add players correctly', () => {
      const playerId = 'player1'
      const playerData = {
        name: 'Test Player',
        isAgent: false,
      }

      gameState.addPlayer(playerId, playerData)

      expect(gameState.players.size).toBe(1)
      expect(gameState.players.get(playerId)).toMatchObject({
        id: playerId,
        name: playerData.name,
        alive: true,
        role: null,
      })
    })

    it('should reject players when game is full', () => {
      // Add 8 players (max)
      for (let i = 0; i < 8; i++) {
        gameState.addPlayer(`player${i}`, { name: `Player ${i}` })
      }

      expect(() => {
        gameState.addPlayer('player9', { name: 'Player 9' })
      }).toThrow('Game is full')
    })

    it('should remove players correctly', () => {
      gameState.addPlayer('player1', { name: 'Player 1' })
      gameState.addPlayer('player2', { name: 'Player 2' })

      gameState.removePlayer('player1')

      expect(gameState.players.size).toBe(1)
      expect(gameState.players.has('player1')).toBe(false)
      expect(gameState.players.has('player2')).toBe(true)
    })
  })

  describe('Game Start Conditions', () => {
    it('should not start with fewer than minimum players', () => {
      // Add 4 players (less than minimum)
      for (let i = 0; i < 4; i++) {
        gameState.addPlayer(`player${i}`, { name: `Player ${i}` })
      }

      expect(() => {
        gameState.startGame()
      }).toThrow('Not enough players')
    })

    it('should start game with valid player count', () => {
      // Add 5 players (minimum)
      for (let i = 0; i < 5; i++) {
        gameState.addPlayer(`player${i}`, { name: `Player ${i}` })
      }

      gameState.startGame()

      expect(gameState.phase).toBe(GamePhase.PLAYING)
    })

    it('should not start if already in progress', () => {
      // Add players and start game
      for (let i = 0; i < 5; i++) {
        gameState.addPlayer(`player${i}`, { name: `Player ${i}` })
      }
      gameState.startGame()

      expect(() => {
        gameState.startGame()
      }).toThrow('Game already in progress')
    })
  })

  describe('Role Assignment', () => {
    it('should assign 1 impostor for 5-6 players', () => {
      for (let i = 0; i < 5; i++) {
        gameState.addPlayer(`player${i}`, { name: `Player ${i}` })
      }

      gameState.startGame()

      const impostors = Array.from(gameState.players.values()).filter(
        p => p.role === PlayerRole.IMPOSTOR
      )
      expect(impostors.length).toBe(1)
    })

    it('should assign 2 impostors for 7-8 players', () => {
      for (let i = 0; i < 7; i++) {
        gameState.addPlayer(`player${i}`, { name: `Player ${i}` })
      }

      gameState.startGame()

      const impostors = Array.from(gameState.players.values()).filter(
        p => p.role === PlayerRole.IMPOSTOR
      )
      expect(impostors.length).toBe(2)
    })

    it('should assign remaining players as crewmates', () => {
      for (let i = 0; i < 5; i++) {
        gameState.addPlayer(`player${i}`, { name: `Player ${i}` })
      }

      gameState.startGame()

      const crewmates = Array.from(gameState.players.values()).filter(
        p => p.role === PlayerRole.CREWMATE
      )
      expect(crewmates.length).toBe(4) // 5 total - 1 impostor
    })
  })

  describe('Phase Transitions', () => {
    beforeEach(() => {
      // Setup game with 5 players
      for (let i = 0; i < 5; i++) {
        gameState.addPlayer(`player${i}`, { name: `Player ${i}` })
      }
      gameState.startGame()
    })

    it('should transition to meeting phase', () => {
      gameState.startMeeting('emergency', 'player0')

      expect(gameState.phase).toBe(GamePhase.MEETING)
      expect(gameState.meetingType).toBe('emergency')
      expect(gameState.meetingCaller).toBe('player0')
    })

    it('should transition from meeting to voting', () => {
      gameState.startMeeting('emergency', 'player0')
      gameState.startVoting()

      expect(gameState.phase).toBe(GamePhase.VOTING)
    })

    it('should return to playing after voting', () => {
      gameState.startMeeting('emergency', 'player0')
      gameState.startVoting()
      gameState.endVoting()

      expect(gameState.phase).toBe(GamePhase.PLAYING)
    })
  })

  describe('Kill Mechanics', () => {
    beforeEach(() => {
      for (let i = 0; i < 5; i++) {
        gameState.addPlayer(`player${i}`, { name: `Player ${i}` })
      }
      gameState.startGame()

      // Manually set roles for testing
      const players = Array.from(gameState.players.values())
      players[0].role = PlayerRole.IMPOSTOR
      players[1].role = PlayerRole.CREWMATE
    })

    it('should allow impostor to kill crewmate', () => {
      const impostor = gameState.players.get('player0')!
      const victim = gameState.players.get('player1')!

      const result = gameState.attemptKill('player0', 'player1')

      expect(result).toBe(true)
      expect(victim.alive).toBe(false)
      expect(gameState.bodies.size).toBe(1)
    })

    it('should not allow crewmate to kill', () => {
      const result = gameState.attemptKill('player1', 'player2')

      expect(result).toBe(false)
      expect(gameState.players.get('player2')!.alive).toBe(true)
    })

    it('should enforce kill cooldown', () => {
      gameState.attemptKill('player0', 'player1')

      const result = gameState.attemptKill('player0', 'player2')

      expect(result).toBe(false)
      expect(gameState.players.get('player2')!.alive).toBe(true)
    })

    it('should not allow killing dead players', () => {
      gameState.attemptKill('player0', 'player1')

      // Try to kill already dead player
      const result = gameState.attemptKill('player0', 'player1')

      expect(result).toBe(false)
    })
  })

  describe('Win Conditions', () => {
    beforeEach(() => {
      for (let i = 0; i < 5; i++) {
        gameState.addPlayer(`player${i}`, { name: `Player ${i}` })
      }
      gameState.startGame()
    })

    it('should detect impostor win when equal numbers', () => {
      const players = Array.from(gameState.players.values())
      // Set up 1 impostor, kill 3 crewmates
      players[0].role = PlayerRole.IMPOSTOR
      players[1].alive = false
      players[2].alive = false
      players[3].alive = false

      const result = gameState.checkWinCondition()

      expect(result).toEqual({
        gameEnded: true,
        winner: 'impostors',
        reason: 'Impostors equal crewmates',
      })
    })

    it('should detect crewmate win when no impostors', () => {
      const players = Array.from(gameState.players.values())
      // All crewmates, impostor eliminated
      players.forEach(p => (p.role = PlayerRole.CREWMATE))
      players[0].role = PlayerRole.IMPOSTOR
      players[0].alive = false

      const result = gameState.checkWinCondition()

      expect(result).toEqual({
        gameEnded: true,
        winner: 'crewmates',
        reason: 'All impostors eliminated',
      })
    })

    it('should detect crewmate task win', () => {
      const players = Array.from(gameState.players.values())
      players[0].role = PlayerRole.IMPOSTOR

      // Complete all tasks
      gameState.tasks.forEach(task => {
        players.slice(1).forEach(p => {
          if (p.role === PlayerRole.CREWMATE) {
            task.completedBy.add(p.id)
          }
        })
      })

      const result = gameState.checkWinCondition()

      expect(result).toEqual({
        gameEnded: true,
        winner: 'crewmates',
        reason: 'All tasks completed',
      })
    })

    it('should not end game when neither condition met', () => {
      const result = gameState.checkWinCondition()

      expect(result).toEqual({
        gameEnded: false,
        winner: null,
        reason: null,
      })
    })
  })

  describe('Meeting Cooldowns', () => {
    beforeEach(() => {
      for (let i = 0; i < 5; i++) {
        gameState.addPlayer(`player${i}`, { name: `Player ${i}` })
      }
      gameState.startGame()
    })

    it('should enforce emergency meeting cooldown', () => {
      gameState.startMeeting('emergency', 'player0')
      gameState.endMeeting()

      expect(() => {
        gameState.startMeeting('emergency', 'player1')
      }).toThrow('Emergency meeting on cooldown')
    })

    it('should allow body report during cooldown', () => {
      gameState.startMeeting('emergency', 'player0')
      gameState.endMeeting()

      // Should not throw
      expect(() => {
        gameState.startMeeting('body_report', 'player1', 'body1')
      }).not.toThrow()
    })
  })

  describe('Voting System', () => {
    beforeEach(() => {
      for (let i = 0; i < 5; i++) {
        gameState.addPlayer(`player${i}`, { name: `Player ${i}` })
      }
      gameState.startGame()
      gameState.startMeeting('emergency', 'player0')
      gameState.startVoting()
    })

    it('should record votes correctly', () => {
      gameState.castVote('player0', 'player1')
      gameState.castVote('player2', 'player1')
      gameState.castVote('player3', null) // skip

      expect(gameState.votes.get('player0')).toBe('player1')
      expect(gameState.votes.get('player2')).toBe('player1')
      expect(gameState.votes.get('player3')).toBe(null)
    })

    it('should not allow dead players to vote', () => {
      const player = gameState.players.get('player1')!
      player.alive = false

      expect(() => {
        gameState.castVote('player1', 'player0')
      }).toThrow('Dead players cannot vote')
    })

    it('should not allow voting for dead players', () => {
      const player = gameState.players.get('player1')!
      player.alive = false

      expect(() => {
        gameState.castVote('player0', 'player1')
      }).toThrow('Cannot vote for dead players')
    })

    it('should calculate vote results correctly', () => {
      // 3 vote for player1, 1 skip, 1 abstain
      gameState.castVote('player0', 'player1')
      gameState.castVote('player2', 'player1')
      gameState.castVote('player3', 'player1')
      gameState.castVote('player4', null)

      const result = gameState.processVotes()

      expect(result.ejectedPlayer).toBe('player1')
      expect(result.voteCount).toBe(3)
      expect(result.skipCount).toBe(1)
      expect(result.majority).toBe(true)
    })

    it('should handle tie votes', () => {
      gameState.castVote('player0', 'player1')
      gameState.castVote('player1', 'player0')
      gameState.castVote('player2', null)
      gameState.castVote('player3', null)

      const result = gameState.processVotes()

      expect(result.ejectedPlayer).toBe(null)
      expect(result.tie).toBe(true)
    })
  })

  describe('State Serialization', () => {
    it('should serialize state for persistence', () => {
      for (let i = 0; i < 5; i++) {
        gameState.addPlayer(`player${i}`, { name: `Player ${i}` })
      }
      gameState.startGame()

      const serialized = gameState.serialize()

      expect(serialized).toHaveProperty('id')
      expect(serialized).toHaveProperty('phase')
      expect(serialized).toHaveProperty('players')
      expect(serialized).toHaveProperty('startTime')
      expect(serialized.players).toHaveLength(5)
    })

    it('should deserialize state correctly', () => {
      const data = {
        id: 'test-game',
        phase: GamePhase.PLAYING,
        players: [
          {
            id: 'p1',
            name: 'Player 1',
            role: PlayerRole.IMPOSTOR,
            alive: true,
          },
          {
            id: 'p2',
            name: 'Player 2',
            role: PlayerRole.CREWMATE,
            alive: false,
          },
        ],
        startTime: Date.now() - 60000,
      }

      const restored = GameState.deserialize(data)

      expect(restored.id).toBe(data.id)
      expect(restored.phase).toBe(data.phase)
      expect(restored.players.size).toBe(2)
      expect(restored.players.get('p1')?.role).toBe(PlayerRole.IMPOSTOR)
      expect(restored.players.get('p2')?.alive).toBe(false)
    })
  })
})
