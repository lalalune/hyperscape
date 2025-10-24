/**
 * Three.js Helpers
 *
 * Centralized utilities for common Three.js operations including
 * bounding boxes, positions, distances, and transformations.
 */

import { Vector3, Box3, Object3D, Bone, Mesh, BufferGeometry } from 'three'

/**
 * Get bounding box of a Three.js object.
 *
 * @param object - Three.js object to get bounds for
 * @returns Bounding box
 *
 * @example
 * ```typescript
 * const box = getBoundingBox(mesh)
 * console.log(box.min, box.max)
 * ```
 */
export function getBoundingBox(object: Object3D): Box3 {
  const box = new Box3()
  box.setFromObject(object)
  return box
}

/**
 * Get bounding box from geometry.
 *
 * @param geometry - BufferGeometry to get bounds for
 * @param forceCompute - Force recomputation of bounding box (default: true)
 * @returns Bounding box
 *
 * @example
 * ```typescript
 * const box = getBoundingBoxFromGeometry(mesh.geometry)
 * const size = new Vector3()
 * box.getSize(size)
 * ```
 */
export function getBoundingBoxFromGeometry(
  geometry: BufferGeometry,
  forceCompute: boolean = true
): Box3 {
  if (forceCompute || !geometry.boundingBox) {
    geometry.computeBoundingBox()
  }
  return geometry.boundingBox || new Box3()
}

/**
 * Get center point of a Three.js object.
 *
 * @param object - Three.js object to get center for
 * @returns Center point as Vector3
 *
 * @example
 * ```typescript
 * const center = getCenterPoint(mesh)
 * console.log(center.x, center.y, center.z)
 * ```
 */
export function getCenterPoint(object: Object3D): Vector3 {
  const box = getBoundingBox(object)
  const center = new Vector3()
  box.getCenter(center)
  return center
}

/**
 * Get size (dimensions) of a Three.js object.
 *
 * @param object - Three.js object to get size for
 * @returns Size as Vector3 (width, height, depth)
 *
 * @example
 * ```typescript
 * const size = getSize(mesh)
 * console.log(`Width: ${size.x}, Height: ${size.y}, Depth: ${size.z}`)
 * ```
 */
export function getSize(object: Object3D): Vector3 {
  const box = getBoundingBox(object)
  const size = new Vector3()
  box.getSize(size)
  return size
}

/**
 * Get world position of a Three.js object.
 *
 * @param object - Three.js object to get world position for
 * @returns World position as Vector3
 *
 * @example
 * ```typescript
 * const worldPos = getWorldPosition(mesh)
 * console.log(worldPos.x, worldPos.y, worldPos.z)
 * ```
 */
export function getWorldPosition(object: Object3D): Vector3 {
  const worldPos = new Vector3()
  object.getWorldPosition(worldPos)
  return worldPos
}

/**
 * Get world position of a bone.
 *
 * @param bone - Bone to get world position for
 * @returns World position as Vector3
 *
 * @example
 * ```typescript
 * const bonePos = getBoneWorldPosition(skeleton.bones[0])
 * ```
 */
export function getBoneWorldPosition(bone: Bone): Vector3 {
  return getWorldPosition(bone)
}

/**
 * Calculate distance between two Vector3 points.
 *
 * @param a - First point
 * @param b - Second point
 * @returns Distance between points
 *
 * @example
 * ```typescript
 * const dist = getDistance(posA, posB)
 * console.log(`Distance: ${dist}`)
 * ```
 */
export function getDistance(a: Vector3, b: Vector3): number {
  return a.distanceTo(b)
}

/**
 * Calculate distance between two objects.
 *
 * @param a - First object
 * @param b - Second object
 * @returns Distance between objects' world positions
 *
 * @example
 * ```typescript
 * const dist = getObjectDistance(meshA, meshB)
 * ```
 */
export function getObjectDistance(a: Object3D, b: Object3D): number {
  const posA = getWorldPosition(a)
  const posB = getWorldPosition(b)
  return getDistance(posA, posB)
}

/**
 * Calculate scale factor to fit object to target size.
 *
 * @param object - Object to calculate scale for
 * @param targetSize - Target size (largest dimension)
 * @returns Scale factor
 *
 * @example
 * ```typescript
 * const scale = calculateScaleToFit(mesh, 2.0)
 * mesh.scale.setScalar(scale)
 * ```
 */
export function calculateScaleToFit(object: Object3D, targetSize: number): number {
  const size = getSize(object)
  const maxDimension = Math.max(size.x, size.y, size.z)
  return targetSize / maxDimension
}

/**
 * Calculate uniform scale to fit object within bounds.
 *
 * @param object - Object to calculate scale for
 * @param maxWidth - Maximum width
 * @param maxHeight - Maximum height
 * @param maxDepth - Maximum depth
 * @returns Scale factor
 *
 * @example
 * ```typescript
 * const scale = calculateScaleToFitBounds(mesh, 2, 3, 2)
 * mesh.scale.setScalar(scale)
 * ```
 */
export function calculateScaleToFitBounds(
  object: Object3D,
  maxWidth: number,
  maxHeight: number,
  maxDepth: number
): number {
  const size = getSize(object)
  const scaleX = maxWidth / size.x
  const scaleY = maxHeight / size.y
  const scaleZ = maxDepth / size.z
  return Math.min(scaleX, scaleY, scaleZ)
}

/**
 * Center object at origin.
 *
 * @param object - Object to center
 *
 * @example
 * ```typescript
 * centerAtOrigin(mesh)
 * ```
 */
export function centerAtOrigin(object: Object3D): void {
  const center = getCenterPoint(object)
  object.position.sub(center)
}

/**
 * Center geometry at origin.
 *
 * @param geometry - Geometry to center
 *
 * @example
 * ```typescript
 * centerGeometryAtOrigin(mesh.geometry)
 * ```
 */
export function centerGeometryAtOrigin(geometry: BufferGeometry): void {
  geometry.center()
}

/**
 * Check if two objects are approximately at the same position.
 *
 * @param a - First object
 * @param b - Second object
 * @param threshold - Distance threshold (default: 0.001)
 * @returns True if objects are within threshold distance
 *
 * @example
 * ```typescript
 * if (arePositionsEqual(meshA, meshB, 0.01)) {
 *   console.log('Objects are at same position')
 * }
 * ```
 */
export function arePositionsEqual(
  a: Object3D,
  b: Object3D,
  threshold: number = 0.001
): boolean {
  return getObjectDistance(a, b) < threshold
}

/**
 * Check if two Vector3 points are approximately equal.
 *
 * @param a - First point
 * @param b - Second point
 * @param threshold - Distance threshold (default: 0.001)
 * @returns True if points are within threshold distance
 *
 * @example
 * ```typescript
 * if (areVectorsEqual(posA, posB, 0.01)) {
 *   console.log('Positions are equal')
 * }
 * ```
 */
export function areVectorsEqual(
  a: Vector3,
  b: Vector3,
  threshold: number = 0.001
): boolean {
  return getDistance(a, b) < threshold
}

/**
 * Clamp object position within bounds.
 *
 * @param object - Object to clamp
 * @param minBounds - Minimum bounds
 * @param maxBounds - Maximum bounds
 *
 * @example
 * ```typescript
 * clampPosition(
 *   mesh,
 *   new Vector3(-10, 0, -10),
 *   new Vector3(10, 5, 10)
 * )
 * ```
 */
export function clampPosition(
  object: Object3D,
  minBounds: Vector3,
  maxBounds: Vector3
): void {
  object.position.clamp(minBounds, maxBounds)
}

/**
 * Get all meshes in object hierarchy.
 *
 * @param object - Root object to search
 * @returns Array of all meshes
 *
 * @example
 * ```typescript
 * const meshes = getAllMeshes(scene)
 * console.log(`Found ${meshes.length} meshes`)
 * ```
 */
export function getAllMeshes(object: Object3D): Mesh[] {
  const meshes: Mesh[] = []

  object.traverse((child) => {
    if (child instanceof Mesh) {
      meshes.push(child)
    }
  })

  return meshes
}

/**
 * Get all bones in object hierarchy.
 *
 * @param object - Root object to search
 * @returns Array of all bones
 *
 * @example
 * ```typescript
 * const bones = getAllBones(skinnedMesh)
 * console.log(`Found ${bones.length} bones`)
 * ```
 */
export function getAllBones(object: Object3D): Bone[] {
  const bones: Bone[] = []

  object.traverse((child) => {
    if (child instanceof Bone) {
      bones.push(child)
    }
  })

  return bones
}

/**
 * Find mesh by name in object hierarchy.
 *
 * @param object - Root object to search
 * @param name - Name to search for
 * @param caseSensitive - Whether search is case-sensitive (default: false)
 * @returns First matching mesh or undefined
 *
 * @example
 * ```typescript
 * const helmet = findMeshByName(scene, 'helmet')
 * ```
 */
export function findMeshByName(
  object: Object3D,
  name: string,
  caseSensitive: boolean = false
): Mesh | undefined {
  const searchName = caseSensitive ? name : name.toLowerCase()

  let result: Mesh | undefined = undefined

  object.traverse((child) => {
    if (result) return // Already found

    if (child instanceof Mesh) {
      const childName = caseSensitive ? child.name : child.name.toLowerCase()
      if (childName.includes(searchName)) {
        result = child
      }
    }
  })

  return result
}

/**
 * Find bone by name in object hierarchy.
 *
 * @param object - Root object to search
 * @param name - Name to search for
 * @param caseSensitive - Whether search is case-sensitive (default: false)
 * @returns First matching bone or undefined
 *
 * @example
 * ```typescript
 * const headBone = findBoneByName(skeleton, 'head')
 * ```
 */
export function findBoneByName(
  object: Object3D,
  name: string,
  caseSensitive: boolean = false
): Bone | undefined {
  const searchName = caseSensitive ? name : name.toLowerCase()

  let result: Bone | undefined = undefined

  object.traverse((child) => {
    if (result) return // Already found

    if (child instanceof Bone) {
      const childName = caseSensitive ? child.name : child.name.toLowerCase()
      if (childName.includes(searchName)) {
        result = child
      }
    }
  })

  return result
}

/**
 * Count total vertices in object hierarchy.
 *
 * @param object - Root object to count
 * @returns Total vertex count
 *
 * @example
 * ```typescript
 * const vertexCount = countVertices(scene)
 * console.log(`Total vertices: ${vertexCount}`)
 * ```
 */
export function countVertices(object: Object3D): number {
  let count = 0

  object.traverse((child) => {
    if (child instanceof Mesh && child.geometry) {
      const positions = child.geometry.attributes.position
      if (positions) {
        count += positions.count
      }
    }
  })

  return count
}

/**
 * Count total faces (triangles) in object hierarchy.
 *
 * @param object - Root object to count
 * @returns Total face count
 *
 * @example
 * ```typescript
 * const faceCount = countFaces(scene)
 * console.log(`Total faces: ${faceCount}`)
 * ```
 */
export function countFaces(object: Object3D): number {
  let count = 0

  object.traverse((child) => {
    if (child instanceof Mesh && child.geometry) {
      const index = child.geometry.index
      if (index) {
        count += index.count / 3
      } else {
        const positions = child.geometry.attributes.position
        if (positions) {
          count += positions.count / 3
        }
      }
    }
  })

  return count
}

/**
 * Dispose of Three.js object and its resources.
 *
 * @param object - Object to dispose
 *
 * @example
 * ```typescript
 * disposeObject(mesh)
 * ```
 */
export function disposeObject(object: Object3D): void {
  object.traverse((child) => {
    if (child instanceof Mesh) {
      if (child.geometry) {
        child.geometry.dispose()
      }

      if (child.material) {
        if (Array.isArray(child.material)) {
          child.material.forEach(material => material.dispose())
        } else {
          child.material.dispose()
        }
      }
    }
  })
}

/**
 * Clone object with geometry and materials.
 *
 * @param object - Object to clone
 * @returns Cloned object
 *
 * @example
 * ```typescript
 * const clone = cloneObject(mesh)
 * ```
 */
export function cloneObject(object: Object3D): Object3D {
  return object.clone(true)
}

/**
 * Set object visibility recursively.
 *
 * @param object - Object to set visibility for
 * @param visible - Visibility state
 *
 * @example
 * ```typescript
 * setVisibility(mesh, false)
 * ```
 */
export function setVisibility(object: Object3D, visible: boolean): void {
  object.traverse((child) => {
    child.visible = visible
  })
}

/**
 * Get model info (vertices, faces, meshes).
 *
 * @param object - Object to get info for
 * @returns Model info object
 *
 * @example
 * ```typescript
 * const info = getModelInfo(scene)
 * console.log(`Meshes: ${info.meshes}, Vertices: ${info.vertices}, Faces: ${info.faces}`)
 * ```
 */
export function getModelInfo(object: Object3D): {
  meshes: number
  vertices: number
  faces: number
  bones: number
} {
  return {
    meshes: getAllMeshes(object).length,
    vertices: countVertices(object),
    faces: countFaces(object),
    bones: getAllBones(object).length
  }
}
