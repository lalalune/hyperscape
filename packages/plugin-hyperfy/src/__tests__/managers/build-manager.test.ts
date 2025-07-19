import { describe, it, expect, vi, beforeEach } from 'vitest'
import { BuildManager } from '../../managers/build-manager'
import { createMockRuntime } from '../test-utils'

describe('BuildManager', () => {
  let mockRuntime: any
  let buildManager: BuildManager
  let mockWorld: any

  beforeEach(() => {
    vi.restoreAllMocks()

    // Create mock world with entities
    mockWorld = {
      entities: {
        items: new Map([
          [
            'entity-1',
            {
              data: { id: 'entity-1', name: 'Block' },
              base: {
                position: {
                  x: 0,
                  y: 0,
                  z: 0,
                  toArray: vi.fn().mockReturnValue([0, 0, 0]),
                },
                quaternion: {
                  x: 0,
                  y: 0,
                  z: 0,
                  w: 1,
                  toArray: vi.fn().mockReturnValue([0, 0, 0, 1]),
                },
              },
              blueprint: { name: 'block' },
            },
          ],
          [
            'entity-2',
            {
              data: { id: 'entity-2', name: 'Sphere' },
              base: {
                position: {
                  x: 5,
                  y: 0,
                  z: 5,
                  toArray: vi.fn().mockReturnValue([5, 0, 5]),
                },
                quaternion: {
                  x: 0,
                  y: 0,
                  z: 0,
                  w: 1,
                  toArray: vi.fn().mockReturnValue([0, 0, 0, 1]),
                },
              },
              blueprint: { name: 'sphere' },
            },
          ],
        ]),
        player: {
          data: { id: 'player-id', name: 'TestAgent' },
          base: {
            position: {
              x: 10,
              y: 0,
              z: 10,
              toArray: vi.fn().mockReturnValue([10, 0, 10]),
            },
          },
        },
      },
      network: {
        send: vi.fn(),
      },
    }

    mockRuntime = createMockRuntime()

    // Mock the service to return the world
    mockRuntime.getService = vi.fn().mockReturnValue({
      getWorld: vi.fn().mockReturnValue(mockWorld),
      isConnected: vi.fn().mockReturnValue(true),
    })

    buildManager = new BuildManager(mockRuntime)
  })

  describe('duplicate', () => {
    it('should duplicate an entity', async () => {
      // Mock world methods
      mockWorld.blueprints = { add: vi.fn() }
      mockWorld.entities.add = vi.fn()
      mockWorld.controls = { goto: vi.fn() }

      // Set up entity to be duplicatable
      const entity = mockWorld.entities.items.get('entity-1')
      entity.isApp = true
      entity.blueprint = { name: 'block', unique: false }
      entity.data.blueprint = 'blueprint-1'
      entity.root = {
        position: {
          x: 0,
          y: 0,
          z: 0,
          toArray: vi.fn().mockReturnValue([0, 0, 0]),
        },
        quaternion: {
          x: 0,
          y: 0,
          z: 0,
          w: 1,
          toArray: vi.fn().mockReturnValue([0, 0, 0, 1]),
        },
        scale: { x: 1, y: 1, z: 1, toArray: vi.fn().mockReturnValue([1, 1, 1]) },
      }

      await buildManager.duplicate('entity-1')

      expect(mockWorld.entities.add).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'app',
          blueprint: expect.any(String),
        }),
        true
      )
    })

    it('should handle missing entity', async () => {
      // Just call the method and ensure it doesn't throw
      await buildManager.duplicate('non-existent')
      // If we get here, the test passes
      expect(true).toBe(true)
    })

    it('should duplicate unique blueprints', async () => {
      mockWorld.blueprints = { add: vi.fn() }
      mockWorld.entities.add = vi.fn()
      mockWorld.controls = { goto: vi.fn() }

      // Make entity have unique blueprint
      mockWorld.entities.items.get('entity-1').isApp = true
      mockWorld.entities.items.get('entity-1').blueprint.unique = true

      await buildManager.duplicate('entity-1')

      expect(mockWorld.blueprints.add).toHaveBeenCalled()
    })
  })

  describe('translate', () => {
    it('should translate an entity', async () => {
      mockWorld.controls = { goto: vi.fn() }
      const entity = mockWorld.entities.items.get('entity-1')
      entity.root = {
        position: {
          fromArray: vi.fn(),
          toArray: vi.fn().mockReturnValue([5, 0, 0]),
        },
        quaternion: {
          ...entity.base.quaternion,
          toArray: vi.fn().mockReturnValue([0, 0, 0, 1]),
        },
        scale: {
          toArray: vi.fn().mockReturnValue([1, 1, 1]),
        },
      }

      await buildManager.translate('entity-1', [5, 0, 0])

      expect(entity.root.position.fromArray).toHaveBeenCalledWith([5, 0, 0])
      expect(mockWorld.controls.goto).toHaveBeenCalled()
    })

    it('should handle missing entity gracefully', async () => {
      // Just call the method and ensure it doesn't throw
      await buildManager.translate('non-existent', [0, 0, 0])
      expect(true).toBe(true)
    })
  })

  describe('importEntity', () => {
    it('should handle import entity method', async () => {
      // Test that the method exists and can be called
      await buildManager.importEntity(
        'https://example.com/model.glb',
        [0, 0],
        'Test Model'
      )
      expect(true).toBe(true)
    })
  })

  describe('delete', () => {
    it('should delete an entity', async () => {
      const entity = mockWorld.entities.items.get('entity-1')
      entity.isApp = true
      entity.data.pinned = false
      entity.destroy = vi.fn()
      mockWorld.controls = { goto: vi.fn() }

      await buildManager.delete('entity-1')

      expect(entity.destroy).toHaveBeenCalledWith(true)
    })

    it('should not delete pinned entities', async () => {
      const entity = mockWorld.entities.items.get('entity-1')
      entity.isApp = true
      entity.data.pinned = true
      entity.destroy = vi.fn()

      await buildManager.delete('entity-1')

      expect(entity.destroy).not.toHaveBeenCalled()
    })
  })

  describe('rotate', () => {
    it('should rotate an entity', async () => {
      mockWorld.controls = { goto: vi.fn() }
      const entity = mockWorld.entities.items.get('entity-1')
      entity.root = {
        position: {
          ...entity.base.position,
          toArray: vi.fn().mockReturnValue([0, 0, 0]),
        },
        quaternion: {
          fromArray: vi.fn(),
          toArray: vi.fn().mockReturnValue([0, 0.707, 0, 0.707]),
        },
        scale: {
          toArray: vi.fn().mockReturnValue([1, 1, 1]),
        },
      }

      await buildManager.rotate('entity-1', [0, 0.707, 0, 0.707])

      expect(entity.root.quaternion.fromArray).toHaveBeenCalledWith([
        0, 0.707, 0, 0.707,
      ])
    })
  })

  describe('scale', () => {
    it('should scale an entity', async () => {
      mockWorld.controls = { goto: vi.fn() }
      const entity = mockWorld.entities.items.get('entity-1')
      entity.root = {
        position: {
          ...entity.base.position,
          toArray: vi.fn().mockReturnValue([0, 0, 0]),
        },
        quaternion: {
          toArray: vi.fn().mockReturnValue([0, 0, 0, 1]),
        },
        scale: {
          fromArray: vi.fn(),
          toArray: vi.fn().mockReturnValue([2, 2, 2]),
        },
      }

      await buildManager.scale('entity-1', [2, 2, 2])

      expect(entity.root.scale.fromArray).toHaveBeenCalledWith([2, 2, 2])
    })
  })
})
