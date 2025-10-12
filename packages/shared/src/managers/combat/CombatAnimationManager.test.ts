/**
 * Unit tests for CombatAnimationManager
 * Tests animation management, queueing, and combat animation triggers
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { CombatAnimationManager } from './CombatAnimationManager'
import type { World } from '../../World'
import type { Entity } from '../../entities/Entity'
import type { AttackType, CombatStyle } from '../../types'
import type { Component } from '../../components/Component'
import { EventType } from '../../types/events'

// Create a proper mock World that satisfies the interface
const createMockWorld = () => {
  const world = {
    emit: vi.fn(),
    on: vi.fn(),
    off: vi.fn(),
    events: {
      emit: vi.fn(),
      on: vi.fn(),
      off: vi.fn()
    },
    entities: new Map(),
    getSystem: vi.fn(),
    addSystem: vi.fn(),
    removeSystem: vi.fn()
  }
  return world as unknown as World
}

const mockWorld = createMockWorld()

// Create a mock Entity with proper component typing
const mockEntity = {
  data: {
    id: 'test-entity-1',
    type: 'test',
    position: [0, 0, 0],
    quaternion: [0, 0, 0, 1],
    scale: [1, 1, 1]
  },
  getComponent: vi.fn(),
  mesh: null
} as unknown as Entity

describe('CombatAnimationManager', () => {
  let animationManager: CombatAnimationManager

  beforeEach(() => {
    vi.clearAllMocks()
    animationManager = new CombatAnimationManager(mockWorld)
  })

  describe('constructor', () => {
    it('should initialize with empty animation tracking', () => {
      expect(animationManager).toBeDefined()
      expect(animationManager.isAnimating('any-entity')).toBe(false)
    })
  })

  describe('playAttackAnimation', () => {
    it('should play melee attack animation', () => {
      animationManager.playAttackAnimation(
        mockEntity,
        'melee' as AttackType,
        'aggressive' as CombatStyle
      )

      expect(mockWorld.emit).toHaveBeenCalledWith(
        EventType.ANIMATION_PLAY,
        expect.objectContaining({
          entityId: 'test-entity-1',
          animationName: 'melee_slash'
        })
      )
    })

    it('should play ranged attack animation', () => {
      animationManager.playAttackAnimation(
        mockEntity,
        'ranged' as AttackType,
        'accurate' as CombatStyle
      )

      expect(mockWorld.emit).toHaveBeenCalledWith(
        EventType.ANIMATION_PLAY,
        expect.objectContaining({
          entityId: 'test-entity-1',
          animationName: 'ranged_bow'
        })
      )
    })

    it('should play magic attack animation', () => {
      animationManager.playAttackAnimation(
        mockEntity,
        'magic' as AttackType,
        'accurate' as CombatStyle
      )

      expect(mockWorld.emit).toHaveBeenCalledWith(
        EventType.ANIMATION_PLAY,
        expect.objectContaining({
          entityId: 'test-entity-1',
          animationName: 'magic_cast'
        })
      )
    })

    it('should track animation state', () => {
      animationManager.playAttackAnimation(
        mockEntity,
        'melee' as AttackType,
        'aggressive' as CombatStyle
      )

      expect(animationManager.isAnimating('test-entity-1')).toBe(true)
    })
  })

  describe('playDefenseAnimation', () => {
    it('should play defense animation', () => {
      animationManager.playDefenseAnimation(mockEntity)

      expect(mockWorld.emit).toHaveBeenCalledWith(
        EventType.ANIMATION_PLAY,
        expect.objectContaining({
          entityId: 'test-entity-1',
          animationName: 'block'
        })
      )
    })

    it('should track defense animation', () => {
      animationManager.playDefenseAnimation(mockEntity)
      expect(animationManager.isAnimating('test-entity-1')).toBe(true)
    })
  })

  describe('playHitReaction', () => {
    it('should play hit reaction animation', () => {
      animationManager.playHitReaction(mockEntity)

      expect(mockWorld.emit).toHaveBeenCalledWith(
        EventType.ANIMATION_PLAY,
        expect.objectContaining({
          entityId: 'test-entity-1',
          animationName: 'hit_reaction'
        })
      )
    })

    it('should track hit reaction animation', () => {
      animationManager.playHitReaction(mockEntity)
      expect(animationManager.isAnimating('test-entity-1')).toBe(true)
    })
  })

  describe('playDeathAnimation', () => {
    it('should play death animation', () => {
      animationManager.playDeathAnimation(mockEntity)

      expect(mockWorld.emit).toHaveBeenCalledWith(
        EventType.ANIMATION_PLAY,
        expect.objectContaining({
          entityId: 'test-entity-1',
          animationName: 'death'
        })
      )
    })

    it('should track death animation', () => {
      animationManager.playDeathAnimation(mockEntity)
      expect(animationManager.isAnimating('test-entity-1')).toBe(true)
    })
  })

  describe('cancelAnimation', () => {
    it('should cancel active animation', () => {
      // Start an animation
      animationManager.playAttackAnimation(
        mockEntity,
        'melee' as AttackType,
        'aggressive' as CombatStyle
      )
      
      expect(animationManager.isAnimating('test-entity-1')).toBe(true)

      // Cancel it
      animationManager.cancelAnimation('test-entity-1')

      expect(animationManager.isAnimating('test-entity-1')).toBe(false)
      expect(mockWorld.emit).toHaveBeenCalledWith(
        EventType.ANIMATION_CANCEL,
        expect.objectContaining({
          entityId: 'test-entity-1'
        })
      )
    })

    it('should handle canceling non-existent animation gracefully', () => {
      expect(() => {
        animationManager.cancelAnimation('non-existent-entity')
      }).not.toThrow()
    })
  })

  describe('queueAnimation', () => {
    it('should queue animation for later execution', () => {
      animationManager.queueAnimation(
        'test-entity-1',
        'melee' as AttackType,
        'aggressive' as CombatStyle,
        15,
        'target-entity'
      )

      // The animation should be queued but not immediately played
      expect(mockWorld.emit).not.toHaveBeenCalled()
    })

    it('should process queued animations on update', () => {
      // Queue an animation
      animationManager.queueAnimation(
        'test-entity-1',
        'melee' as AttackType,
        'aggressive' as CombatStyle
      )

      // Process the queue
      animationManager.update(16.67) // ~60fps delta

      // Should have played the queued animation
      expect(mockWorld.emit).toHaveBeenCalledWith(
        EventType.ANIMATION_PLAY,
        expect.objectContaining({
          entityId: 'test-entity-1'
        })
      )
    })
  })

  describe('update', () => {
    it('should process animation timeouts', async () => {
      // Start an animation
      animationManager.playAttackAnimation(
        mockEntity,
        'melee' as AttackType,
        'aggressive' as CombatStyle
      )

      expect(animationManager.isAnimating('test-entity-1')).toBe(true)

      // Simulate passage of time (attack animations typically last ~600ms)
      await new Promise(resolve => setTimeout(resolve, 700))
      animationManager.update(700)

      // Animation should have completed
      expect(animationManager.isAnimating('test-entity-1')).toBe(false)
    })

    it('should process multiple animations', () => {
      const entity2 = { 
        ...mockEntity, 
        data: { 
          ...mockEntity.data, 
          id: 'test-entity-2' 
        } 
      } as unknown as Entity

      // Start animations for multiple entities
      animationManager.playAttackAnimation(
        mockEntity,
        'melee' as AttackType,
        'aggressive' as CombatStyle
      )
      
      animationManager.playAttackAnimation(
        entity2,
        'ranged' as AttackType,
        'accurate' as CombatStyle
      )

      expect(animationManager.isAnimating('test-entity-1')).toBe(true)
      expect(animationManager.isAnimating('test-entity-2')).toBe(true)

      // Update should handle both
      animationManager.update(16.67)

      // Both should still be animating (not enough time passed)
      expect(animationManager.isAnimating('test-entity-1')).toBe(true)
      expect(animationManager.isAnimating('test-entity-2')).toBe(true)
    })
  })

  describe('getCurrentAnimation', () => {
    it('should return null for non-animating entity', () => {
      const current = animationManager.getCurrentAnimation('test-entity-1')
      expect(current).toBeNull()
    })

    it('should return current animation name', () => {
      animationManager.playAttackAnimation(
        mockEntity,
        'melee' as AttackType,
        'aggressive' as CombatStyle
      )

      const current = animationManager.getCurrentAnimation('test-entity-1')
      expect(current).toBe('melee_slash')
    })
  })

  describe('animation determination', () => {
    beforeEach(() => {
      // Mock entity with equipment
      const mockGetComponent = vi.fn((componentType: string) => {
        if (componentType === 'inventory') {
          return {
            data: {
              equipment: {
                weapon: {
                  id: 'iron_sword',
                  weaponType: 'sword',
                  attackType: 'melee'
                }
              }
            }
          } as unknown as Component
        }
        return null
      })
      mockEntity.getComponent = mockGetComponent as <T extends Component = Component>(type: string) => T | null
    })

    it('should determine correct animation based on weapon type', () => {
      animationManager.playAttackAnimation(
        mockEntity,
        'melee' as AttackType,
        'slash' as CombatStyle
      )

      expect(mockWorld.emit).toHaveBeenCalledWith(
        EventType.ANIMATION_PLAY,
        expect.objectContaining({
          entityId: 'test-entity-1',
          animationName: 'melee_slash'
        })
      )
    })

    it('should use default animation for unarmed combat', () => {
      // Mock entity with no weapon
      const mockGetComponent = vi.fn(() => ({ data: { equipment: {} } }))
      const entityWithoutWeapon = {
        ...mockEntity,
        getComponent: mockGetComponent
      } as unknown as Entity

      animationManager.playAttackAnimation(
        entityWithoutWeapon,
        'melee' as AttackType,
        'aggressive' as CombatStyle
      )

      expect(mockWorld.emit).toHaveBeenCalledWith(
        EventType.ANIMATION_PLAY,
        expect.objectContaining({
          entityId: 'test-entity-1',
          animationName: 'melee_slash'
        })
      )
    })
  })

  describe('edge cases', () => {
    it('should handle entity with no inventory component', () => {
      const mockGetComponent = vi.fn(() => null)
      const entityWithoutInventory = {
        ...mockEntity,
        getComponent: mockGetComponent
      } as unknown as Entity

      expect(() => {
        animationManager.playAttackAnimation(
          entityWithoutInventory,
          'melee' as AttackType,
          'aggressive' as CombatStyle
        )
      }).not.toThrow()
    })

    it('should handle invalid attack types gracefully', () => {
      expect(() => {
        animationManager.playAttackAnimation(
          mockEntity,
          'invalid' as AttackType,
          'aggressive' as CombatStyle
        )
      }).not.toThrow()
    })

    it('should handle multiple animation requests for same entity', () => {
      // First animation
      animationManager.playAttackAnimation(
        mockEntity,
        'melee' as AttackType,
        'aggressive' as CombatStyle
      )

      // Second animation (should override first)
      animationManager.playDefenseAnimation(mockEntity)

      expect(animationManager.isAnimating('test-entity-1')).toBe(true)
      expect(animationManager.getCurrentAnimation('test-entity-1')).toBe('block')
    })

    it('should handle very long delta times', async () => {
      animationManager.playAttackAnimation(
        mockEntity,
        'melee' as AttackType,
        'aggressive' as CombatStyle
      )

      // Very long delta (multiple seconds)
      await new Promise(resolve => setTimeout(resolve, 5000))
      animationManager.update(5000)

      // Animation should have completed
      expect(animationManager.isAnimating('test-entity-1')).toBe(false)
    })

    it('should handle zero delta time', () => {
      animationManager.playAttackAnimation(
        mockEntity,
        'melee' as AttackType,
        'aggressive' as CombatStyle
      )

      expect(() => {
        animationManager.update(0)
      }).not.toThrow()

      // Animation should still be active
      expect(animationManager.isAnimating('test-entity-1')).toBe(true)
    })
  })
})