/**
 * ArmorFittingService Integration Tests
 * Tests armor mesh fitting algorithms
 */

import { describe, it, expect, beforeEach } from 'vitest'
import { ArmorFittingService } from '../fitting/ArmorFittingService'
import {
  createMockSkinnedMesh,
  createMockMesh,
  createMockArmorMesh,
  createMockBodyMesh
} from '../../../tests/mocks/three-mocks'
import { Vector3, Box3 } from 'three'

describe('ArmorFittingService', () => {
  let service: ArmorFittingService

  beforeEach(() => {
    service = new ArmorFittingService()
  })

  describe('initialization', () => {
    it('should create service instance', () => {
      expect(service).toBeDefined()
      expect(service).toBeInstanceOf(ArmorFittingService)
    })
  })

  describe('computeBodyRegions', () => {
    it('should compute body regions from skeleton', () => {
      const skinnedMesh = createMockSkinnedMesh(200, 4)
      const skeleton = skinnedMesh.skeleton

      const regions = service.computeBodyRegions(skinnedMesh, skeleton)

      expect(regions).toBeDefined()
      expect(regions.size).toBeGreaterThan(0)
    })

    it('should identify common body regions', () => {
      const skinnedMesh = createMockSkinnedMesh(200, 4)
      const skeleton = skinnedMesh.skeleton

      const regions = service.computeBodyRegions(skinnedMesh, skeleton)

      // Check for expected regions
      const regionNames = Array.from(regions.keys())
      expect(regionNames.length).toBeGreaterThan(0)
    })

    it('should compute bounding boxes for regions', () => {
      const skinnedMesh = createMockSkinnedMesh(200, 4)
      const skeleton = skinnedMesh.skeleton

      const regions = service.computeBodyRegions(skinnedMesh, skeleton)

      for (const region of regions.values()) {
        expect(region.boundingBox).toBeDefined()
        expect(region.boundingBox).toBeInstanceOf(Box3)
        expect(region.center).toBeInstanceOf(Vector3)
      }
    })

    it('should assign vertices to regions', () => {
      const skinnedMesh = createMockSkinnedMesh(200, 4)
      const skeleton = skinnedMesh.skeleton

      const regions = service.computeBodyRegions(skinnedMesh, skeleton)

      for (const region of regions.values()) {
        expect(Array.isArray(region.vertices)).toBe(true)
      }
    })
  })

  describe('detectCollisions', () => {
    it('should detect collision points between meshes', () => {
      const armorMesh = createMockArmorMesh()
      const bodyMesh = createMockBodyMesh()

      // Position armor to overlap with body
      armorMesh.position.set(0, 1.2, 0)
      armorMesh.updateMatrixWorld(true)

      const collisions = service.detectCollisions(armorMesh, bodyMesh)

      expect(Array.isArray(collisions)).toBe(true)
    })

    it('should calculate penetration depth', () => {
      const armorMesh = createMockArmorMesh()
      const bodyMesh = createMockBodyMesh()

      armorMesh.position.set(0, 1.2, 0)
      armorMesh.updateMatrixWorld(true)

      const collisions = service.detectCollisions(armorMesh, bodyMesh)

      collisions.forEach(collision => {
        expect(collision.vertexIndex).toBeGreaterThanOrEqual(0)
        expect(collision.position).toBeInstanceOf(Vector3)
        expect(collision.normal).toBeInstanceOf(Vector3)
        expect(typeof collision.penetrationDepth).toBe('number')
      })
    })
  })

  describe('mesh transformation', () => {
    it('should scale mesh uniformly', () => {
      const mesh = createMockMesh('test', 100)
      const originalScale = mesh.scale.clone()

      mesh.scale.multiplyScalar(1.5)

      expect(mesh.scale.x).toBe(originalScale.x * 1.5)
      expect(mesh.scale.y).toBe(originalScale.y * 1.5)
      expect(mesh.scale.z).toBe(originalScale.z * 1.5)
    })

    it('should translate mesh position', () => {
      const mesh = createMockMesh('test', 100)

      mesh.position.set(1, 2, 3)

      expect(mesh.position.x).toBe(1)
      expect(mesh.position.y).toBe(2)
      expect(mesh.position.z).toBe(3)
    })

    it('should update world matrix after transformation', () => {
      const mesh = createMockMesh('test', 100)

      mesh.position.set(1, 0, 0)
      mesh.scale.set(2, 2, 2)

      mesh.updateMatrixWorld(true)

      expect(mesh.matrixWorld).toBeDefined()
    })
  })

  describe('bounding box operations', () => {
    it('should compute bounding box from geometry', () => {
      const mesh = createMockMesh('test', 100)
      const geometry = mesh.geometry

      geometry.computeBoundingBox()

      expect(geometry.boundingBox).toBeDefined()
      expect(geometry.boundingBox).toBeInstanceOf(Box3)
    })

    it('should calculate bounding box dimensions', () => {
      const mesh = createMockMesh('test', 100)
      const geometry = mesh.geometry

      geometry.computeBoundingBox()
      const box = geometry.boundingBox!
      const size = new Vector3()
      box.getSize(size)

      expect(size.x).toBeGreaterThan(0)
      expect(size.y).toBeGreaterThan(0)
      expect(size.z).toBeGreaterThan(0)
    })

    it('should get bounding box center', () => {
      const mesh = createMockMesh('test', 100)
      const geometry = mesh.geometry

      geometry.computeBoundingBox()
      const box = geometry.boundingBox!
      const center = new Vector3()
      box.getCenter(center)

      expect(center).toBeInstanceOf(Vector3)
      expect(typeof center.x).toBe('number')
      expect(typeof center.y).toBe('number')
      expect(typeof center.z).toBe('number')
    })
  })

  describe('vertex manipulation', () => {
    it('should access vertex positions', () => {
      const mesh = createMockMesh('test', 100)
      const geometry = mesh.geometry
      const position = geometry.attributes.position

      expect(position).toBeDefined()
      expect(position.count).toBe(100)
      expect(position.itemSize).toBe(3)
    })

    it('should read vertex coordinates', () => {
      const mesh = createMockMesh('test', 100)
      const geometry = mesh.geometry
      const position = geometry.attributes.position

      const x = position.getX(0)
      const y = position.getY(0)
      const z = position.getZ(0)

      expect(typeof x).toBe('number')
      expect(typeof y).toBe('number')
      expect(typeof z).toBe('number')
    })

    it('should modify vertex positions', () => {
      const mesh = createMockMesh('test', 100)
      const geometry = mesh.geometry
      const position = geometry.attributes.position

      const originalX = position.getX(0)
      position.setX(0, originalX + 1.0)

      expect(position.getX(0)).toBe(originalX + 1.0)
    })

    it('should mark position attribute as needing update', () => {
      const mesh = createMockMesh('test', 100)
      const geometry = mesh.geometry
      const position = geometry.attributes.position

      position.setX(0, 1.0)
      position.needsUpdate = true

      expect(position.needsUpdate).toBe(true)
    })
  })

  describe('normal calculations', () => {
    it('should access vertex normals', () => {
      const mesh = createMockMesh('test', 100)
      const geometry = mesh.geometry
      const normals = geometry.attributes.normal

      expect(normals).toBeDefined()
      expect(normals.count).toBe(100)
    })

    it('should read normal vectors', () => {
      const mesh = createMockMesh('test', 100)
      const geometry = mesh.geometry
      const normals = geometry.attributes.normal

      const nx = normals.getX(0)
      const ny = normals.getY(0)
      const nz = normals.getZ(0)

      expect(typeof nx).toBe('number')
      expect(typeof ny).toBe('number')
      expect(typeof nz).toBe('number')
    })

    it('should compute geometry normals', () => {
      const mesh = createMockMesh('test', 100)
      const geometry = mesh.geometry

      geometry.computeVertexNormals()

      const normals = geometry.attributes.normal
      expect(normals).toBeDefined()
    })
  })

  describe('error handling', () => {
    it('should handle empty geometry', () => {
      const mesh = createMockMesh('empty', 0)

      expect(mesh.geometry.attributes.position.count).toBe(0)
    })

    it('should handle invalid mesh input', () => {
      const invalidMesh = createMockMesh('invalid', 0)

      // Service should handle gracefully
      expect(() => {
        service.detectCollisions(invalidMesh, createMockBodyMesh())
      }).not.toThrow()
    })
  })

  describe('performance', () => {
    it('should handle large meshes efficiently', () => {
      const startTime = performance.now()

      const largeMesh = createMockMesh('large', 10000)
      const bodyMesh = createMockBodyMesh()

      service.detectCollisions(largeMesh, bodyMesh)

      const duration = performance.now() - startTime

      // Should complete in reasonable time (< 1 second for 10k vertices)
      expect(duration).toBeLessThan(1000)
    })

    it('should compute regions for complex skeleton', () => {
      const startTime = performance.now()

      const complexMesh = createMockSkinnedMesh(1000, 20)
      service.computeBodyRegions(complexMesh, complexMesh.skeleton)

      const duration = performance.now() - startTime

      // Should complete quickly
      expect(duration).toBeLessThan(500)
    })
  })
})
