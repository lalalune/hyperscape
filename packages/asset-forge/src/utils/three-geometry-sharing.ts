/**
 * Three.js Geometry Sharing Utility
 *
 * Fixes critical memory leak where geometries/materials are unnecessarily cloned.
 *
 * PROBLEM:
 * - Each .clone() creates duplicate vertex buffers in GPU memory
 * - 100 assets with cloned geometries = 3-5GB (should be 2-3GB with sharing)
 * - 30-40% memory overhead from unnecessary cloning
 *
 * SOLUTION:
 * - Share geometries/materials across instances for read-only assets
 * - Only clone when modifications are needed (armor fitting, normalization)
 * - Track cloned resources for proper disposal
 */

import { BufferGeometry, Material, Mesh, Object3D } from 'three'

/**
 * Marks for tracking geometry/material ownership
 */
const CLONE_MARKER = Symbol('isClonedForModification')
const SHARED_MARKER = Symbol('isSharedGeometry')

interface CloneableResource {
  [CLONE_MARKER]?: boolean
  [SHARED_MARKER]?: boolean
}

type GeometryWithMarker = BufferGeometry & CloneableResource
type MaterialWithMarker = Material & CloneableResource

/**
 * Cache for shared geometries and materials
 * Key: unique identifier (URL, asset ID, etc.)
 */
const geometryCache = new Map<string, BufferGeometry>()
const materialCache = new Map<string, Material>()

/**
 * Weakly track cloned resources for disposal
 */
const clonedResources = new WeakSet<BufferGeometry | Material>()

/**
 * Share a geometry across multiple instances
 * Use this for read-only assets that won't be modified
 *
 * @param geometry - The geometry to cache/retrieve
 * @param cacheKey - Unique identifier for this geometry
 * @returns The shared geometry instance
 */
export function shareGeometry(geometry: BufferGeometry, cacheKey: string): BufferGeometry {
  const cached = geometryCache.get(cacheKey)

  if (cached) {
    console.log(`[GeometrySharing] Using cached geometry: ${cacheKey}`)
    return cached
  }

  // Mark as shared
  const markedGeometry = geometry as GeometryWithMarker
  markedGeometry[SHARED_MARKER] = true

  geometryCache.set(cacheKey, geometry)
  console.log(`[GeometrySharing] Cached new geometry: ${cacheKey}`)

  return geometry
}

/**
 * Share a material across multiple instances
 * Use this for read-only assets that won't be modified
 *
 * @param material - The material to cache/retrieve
 * @param cacheKey - Unique identifier for this material
 * @returns The shared material instance
 */
export function shareMaterial(material: Material, cacheKey: string): Material {
  const cached = materialCache.get(cacheKey)

  if (cached) {
    console.log(`[GeometrySharing] Using cached material: ${cacheKey}`)
    return cached
  }

  // Mark as shared
  const markedMaterial = material as MaterialWithMarker
  markedMaterial[SHARED_MARKER] = true

  materialCache.set(cacheKey, material)
  console.log(`[GeometrySharing] Cached new material: ${cacheKey}`)

  return material
}

/**
 * Clone a geometry for modification (armor fitting, normalization, etc.)
 * Marks the clone for proper disposal tracking
 *
 * @param geometry - The geometry to clone
 * @param reason - Why this is being cloned (for debugging)
 * @returns Cloned geometry marked for disposal
 */
export function cloneGeometryForModification(
  geometry: BufferGeometry,
  reason: string = 'modification'
): BufferGeometry {
  const cloned = geometry.clone()
  const markedClone = cloned as GeometryWithMarker

  // Mark as cloned
  markedClone[CLONE_MARKER] = true
  clonedResources.add(cloned)

  console.log(`[GeometrySharing] Cloned geometry for ${reason}`)

  return cloned
}

/**
 * Clone a material for modification
 * Marks the clone for proper disposal tracking
 *
 * @param material - The material to clone
 * @param reason - Why this is being cloned (for debugging)
 * @returns Cloned material marked for disposal
 */
export function cloneMaterialForModification(
  material: Material,
  reason: string = 'modification'
): Material {
  const cloned = material.clone()
  const markedClone = cloned as MaterialWithMarker

  // Mark as cloned
  markedClone[CLONE_MARKER] = true
  clonedResources.add(cloned)

  console.log(`[GeometrySharing] Cloned material for ${reason}`)

  return cloned
}

/**
 * Clone a mesh for modification (includes geometry and optionally material)
 *
 * @param mesh - The mesh to clone
 * @param cloneMaterial - Whether to also clone the material
 * @param reason - Why this is being cloned
 * @returns Cloned mesh with tracked resources
 */
export function cloneMeshForModification(
  mesh: Mesh,
  cloneMaterial: boolean = false,
  reason: string = 'modification'
): Mesh {
  const clonedGeometry = cloneGeometryForModification(mesh.geometry, reason)
  const clonedMaterialOrOriginal = cloneMaterial && mesh.material
    ? cloneMaterialForModification(mesh.material as Material, reason)
    : mesh.material

  const clonedMesh = new Mesh(clonedGeometry, clonedMaterialOrOriginal)

  // Copy transform
  clonedMesh.position.copy(mesh.position)
  clonedMesh.rotation.copy(mesh.rotation)
  clonedMesh.scale.copy(mesh.scale)
  clonedMesh.name = mesh.name

  return clonedMesh
}

/**
 * Check if a geometry/material is marked as cloned
 *
 * @param resource - The resource to check
 * @returns True if this was cloned for modification
 */
export function isClonedResource(resource: BufferGeometry | Material): boolean {
  const marked = resource as CloneableResource
  return marked[CLONE_MARKER] === true
}

/**
 * Check if a geometry/material is marked as shared
 *
 * @param resource - The resource to check
 * @returns True if this is a shared resource
 */
export function isSharedResource(resource: BufferGeometry | Material): boolean {
  const marked = resource as CloneableResource
  return marked[SHARED_MARKER] === true
}

/**
 * Dispose cloned resources in an Object3D hierarchy
 * Only disposes resources marked as cloned, preserves shared resources
 *
 * @param object - The object to dispose
 */
export function disposeClonedResources(object: Object3D): void {
  let disposedGeometries = 0
  let disposedMaterials = 0
  let sharedGeometriesSkipped = 0
  let sharedMaterialsSkipped = 0

  object.traverse((child) => {
    if (child instanceof Mesh) {
      // Dispose geometry if it's cloned
      if (child.geometry) {
        if (isClonedResource(child.geometry)) {
          child.geometry.dispose()
          disposedGeometries++
        } else if (isSharedResource(child.geometry)) {
          sharedGeometriesSkipped++
        }
      }

      // Dispose material if it's cloned
      if (child.material) {
        const materials = Array.isArray(child.material) ? child.material : [child.material]

        materials.forEach(mat => {
          if (isClonedResource(mat)) {
            mat.dispose()
            disposedMaterials++
          } else if (isSharedResource(mat)) {
            sharedMaterialsSkipped++
          }
        })
      }
    }
  })

  if (disposedGeometries > 0 || disposedMaterials > 0) {
    console.log(
      `[GeometrySharing] Disposed ${disposedGeometries} geometries, ${disposedMaterials} materials ` +
      `(skipped ${sharedGeometriesSkipped} shared geometries, ${sharedMaterialsSkipped} shared materials)`
    )
  }
}

/**
 * Clear the geometry/material cache
 * Use when unloading assets or clearing the scene
 *
 * @param disposeResources - Whether to dispose cached resources (default: false)
 */
export function clearCache(disposeResources: boolean = false): void {
  if (disposeResources) {
    geometryCache.forEach(geometry => geometry.dispose())
    materialCache.forEach(material => material.dispose())
  }

  const geometryCount = geometryCache.size
  const materialCount = materialCache.size

  geometryCache.clear()
  materialCache.clear()

  console.log(
    `[GeometrySharing] Cleared cache: ${geometryCount} geometries, ${materialCount} materials ` +
    `(disposed: ${disposeResources})`
  )
}

/**
 * Get cache statistics
 *
 * @returns Statistics about cached resources
 */
export function getCacheStats(): {
  cachedGeometries: number
  cachedMaterials: number
  estimatedMemorySavings: string
} {
  const cachedGeometries = geometryCache.size
  const cachedMaterials = materialCache.size

  // Rough estimate: each geometry clone saves ~1-5MB
  const avgGeometrySize = 2.5 // MB
  const estimatedSavingsMB = cachedGeometries * avgGeometrySize

  return {
    cachedGeometries,
    cachedMaterials,
    estimatedMemorySavings: `~${estimatedSavingsMB.toFixed(1)}MB`
  }
}

/**
 * Apply geometry sharing to a loaded model
 * Replaces geometries/materials with cached versions if available
 *
 * @param object - The loaded object
 * @param baseCacheKey - Base key for caching (e.g., modelUrl)
 * @returns Number of resources shared
 */
export function applyGeometrySharing(object: Object3D, baseCacheKey: string): {
  sharedGeometries: number
  sharedMaterials: number
} {
  let sharedGeometries = 0
  let sharedMaterials = 0
  let meshIndex = 0

  object.traverse((child) => {
    if (child instanceof Mesh) {
      // Share geometry
      if (child.geometry) {
        const geometryKey = `${baseCacheKey}_geom_${meshIndex}`
        const shared = shareGeometry(child.geometry, geometryKey)

        if (shared !== child.geometry) {
          // Dispose the original if it's not already shared
          if (!isSharedResource(child.geometry)) {
            child.geometry.dispose()
          }
          child.geometry = shared
          sharedGeometries++
        }
      }

      // Share materials
      if (child.material) {
        const materials = Array.isArray(child.material) ? child.material : [child.material]

        materials.forEach((mat, matIndex) => {
          const materialKey = `${baseCacheKey}_mat_${meshIndex}_${matIndex}`
          const shared = shareMaterial(mat, materialKey)

          if (shared !== mat) {
            // Dispose the original if it's not already shared
            if (!isSharedResource(mat)) {
              mat.dispose()
            }

            if (Array.isArray(child.material)) {
              child.material[matIndex] = shared
            } else {
              child.material = shared
            }

            sharedMaterials++
          }
        })
      }

      meshIndex++
    }
  })

  console.log(
    `[GeometrySharing] Applied sharing to ${baseCacheKey}: ` +
    `${sharedGeometries} geometries, ${sharedMaterials} materials`
  )

  return { sharedGeometries, sharedMaterials }
}
