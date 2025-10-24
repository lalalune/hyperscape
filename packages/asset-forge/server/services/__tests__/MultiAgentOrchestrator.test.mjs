/**
 * MultiAgentOrchestrator Integration Tests
 * Tests multi-agent collaboration and orchestration
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { MultiAgentOrchestrator } from '../MultiAgentOrchestrator.mjs'

describe('MultiAgentOrchestrator', () => {
  let orchestrator

  beforeEach(() => {
    orchestrator = new MultiAgentOrchestrator({
      maxRounds: 5,
      temperature: 0.8,
      enableCrossValidation: true
    })
  })

  afterEach(() => {
    if (orchestrator && orchestrator.cleanupInterval) {
      clearInterval(orchestrator.cleanupInterval)
    }
  })

  describe('registerAgent', () => {
    it('should register an agent with configuration', () => {
      const agentConfig = {
        id: 'lorekeeper',
        name: 'The Lorekeeper',
        role: 'world-building',
        systemPrompt: 'You are a master of game lore and world-building.',
        persona: {
          expertise: ['lore', 'history', 'world-building'],
          style: 'detailed and immersive'
        }
      }

      orchestrator.registerAgent(agentConfig)

      expect(orchestrator.agents.has('lorekeeper')).toBe(true)
      expect(orchestrator.agents.get('lorekeeper')).toMatchObject({
        id: 'lorekeeper',
        name: 'The Lorekeeper',
        role: 'world-building',
        messageCount: 0
      })
    })

    it('should allow multiple agent registrations', () => {
      const agents = [
        { id: 'agent1', name: 'Agent 1', role: 'role1', systemPrompt: 'prompt1', persona: {} },
        { id: 'agent2', name: 'Agent 2', role: 'role2', systemPrompt: 'prompt2', persona: {} },
        { id: 'agent3', name: 'Agent 3', role: 'role3', systemPrompt: 'prompt3', persona: {} }
      ]

      agents.forEach(agent => orchestrator.registerAgent(agent))

      expect(orchestrator.agents.size).toBe(3)
    })
  })

  describe('routeToAgent', () => {
    beforeEach(() => {
      orchestrator.registerAgent({
        id: 'lorekeeper',
        name: 'Lorekeeper',
        role: 'world-building',
        systemPrompt: 'Expert in lore',
        persona: { expertise: ['lore', 'history'] }
      })

      orchestrator.registerAgent({
        id: 'questmaster',
        name: 'Quest Master',
        role: 'quest-design',
        systemPrompt: 'Expert in quests',
        persona: { expertise: ['quests', 'objectives'] }
      })
    })

    it('should route to available agent', async () => {
      const context = 'Create a quest about finding a lost artifact'
      const agent = await orchestrator.routeToAgent(context)

      expect(agent).toBeDefined()
      expect(['lorekeeper', 'questmaster']).toContain(agent.id)
    })

    it('should exclude specified agents', async () => {
      const context = 'Design a quest'
      const agent = await orchestrator.routeToAgent(context, ['lorekeeper'])

      expect(agent.id).toBe('questmaster')
    })

    it('should throw error when no agents available', async () => {
      const emptyOrchestrator = new MultiAgentOrchestrator()

      await expect(
        emptyOrchestrator.routeToAgent('test')
      ).rejects.toThrow(/No available agents/)

      if (emptyOrchestrator.cleanupInterval) {
        clearInterval(emptyOrchestrator.cleanupInterval)
      }
    })

    it('should return single agent immediately', async () => {
      const single = new MultiAgentOrchestrator()
      single.registerAgent({
        id: 'solo',
        name: 'Solo Agent',
        role: 'solo',
        systemPrompt: 'test',
        persona: {}
      })

      const agent = await single.routeToAgent('test')

      expect(agent.id).toBe('solo')

      if (single.cleanupInterval) {
        clearInterval(single.cleanupInterval)
      }
    })
  })

  describe('scoreAgentRelevance', () => {
    it('should score agent relevance to context', () => {
      const agent = {
        id: 'lorekeeper',
        role: 'world-building',
        persona: {
          expertise: ['lore', 'history', 'world-building']
        }
      }

      const context = 'Create lore about ancient kingdoms'
      const score = orchestrator.scoreAgentRelevance(agent, context)

      expect(score).toBeGreaterThan(0)
    })

    it('should give higher scores for better matches', () => {
      const lorekeeper = {
        id: 'lorekeeper',
        role: 'lore',
        persona: { expertise: ['lore'] }
      }

      const questmaster = {
        id: 'questmaster',
        role: 'quest',
        persona: { expertise: ['quest'] }
      }

      const loreContext = 'Write lore about ancient civilizations'

      const loreScore = orchestrator.scoreAgentRelevance(lorekeeper, loreContext)
      const questScore = orchestrator.scoreAgentRelevance(questmaster, loreContext)

      expect(loreScore).toBeGreaterThan(questScore)
    })
  })

  describe('shared memory', () => {
    it('should initialize with empty shared memory', () => {
      expect(orchestrator.sharedMemory).toMatchObject({
        conversationHistory: [],
        worldState: {},
        relationships: expect.any(Map),
        generatedContent: []
      })
    })

    it('should allow updating shared memory', () => {
      orchestrator.sharedMemory.worldState.location = 'Ancient Ruins'
      orchestrator.sharedMemory.conversationHistory.push({
        agent: 'lorekeeper',
        message: 'The ruins hold ancient secrets...'
      })

      expect(orchestrator.sharedMemory.worldState.location).toBe('Ancient Ruins')
      expect(orchestrator.sharedMemory.conversationHistory).toHaveLength(1)
    })

    it('should support relationship tracking', () => {
      orchestrator.sharedMemory.relationships.set('npc1-npc2', {
        type: 'rivalry',
        strength: 0.8,
        history: ['competed in tournament']
      })

      const relationship = orchestrator.sharedMemory.relationships.get('npc1-npc2')

      expect(relationship).toMatchObject({
        type: 'rivalry',
        strength: 0.8
      })
    })
  })

  describe('memory leak protection', () => {
    it('should enforce max history size', () => {
      const maxSize = orchestrator.config.maxHistorySize

      // Add more than max
      for (let i = 0; i < maxSize + 10; i++) {
        orchestrator.sharedMemory.conversationHistory.push({
          agent: 'test',
          message: `Message ${i}`
        })
      }

      orchestrator.performMemoryCleanup()

      expect(orchestrator.sharedMemory.conversationHistory.length).toBeLessThanOrEqual(maxSize)
    })

    it('should enforce max generated content size', () => {
      const maxSize = orchestrator.config.maxGeneratedContentSize

      for (let i = 0; i < maxSize + 10; i++) {
        orchestrator.sharedMemory.generatedContent.push({
          type: 'quest',
          content: `Quest ${i}`
        })
      }

      orchestrator.performMemoryCleanup()

      expect(orchestrator.sharedMemory.generatedContent.length).toBeLessThanOrEqual(maxSize)
    })

    it('should perform periodic cleanup', () => {
      // Cleanup is performed on interval
      expect(orchestrator.cleanupInterval).toBeDefined()
      expect(orchestrator.CLEANUP_INTERVAL_MS).toBe(60 * 60 * 1000)
    })
  })

  describe('configuration', () => {
    it('should use default configuration', () => {
      const defaultOrch = new MultiAgentOrchestrator()

      expect(defaultOrch.config).toMatchObject({
        maxRounds: 10,
        temperature: 0.8,
        enableCrossValidation: true
      })

      if (defaultOrch.cleanupInterval) {
        clearInterval(defaultOrch.cleanupInterval)
      }
    })

    it('should accept custom configuration', () => {
      const customOrch = new MultiAgentOrchestrator({
        maxRounds: 20,
        temperature: 0.9,
        enableCrossValidation: false,
        maxHistorySize: 200
      })

      expect(customOrch.config).toMatchObject({
        maxRounds: 20,
        temperature: 0.9,
        enableCrossValidation: false,
        maxHistorySize: 200
      })

      if (customOrch.cleanupInterval) {
        clearInterval(customOrch.cleanupInterval)
      }
    })
  })
})
