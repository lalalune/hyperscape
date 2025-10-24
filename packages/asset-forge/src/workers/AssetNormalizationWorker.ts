/**
 * Asset Normalization Worker
 * Performs asset normalization calculations off the main thread
 */

import type {
  WorkerRequest,
  WorkerResponse,
  AssetNormalizationData,
  AssetNormalizationResult,
} from './types'

// Vec3 utilities
class Vec3 {
  constructor(
    public x: number = 0,
    public y: number = 0,
    public z: number = 0
  ) {}

  set(x: number, y: number, z: number): Vec3 {
    this.x = x
    this.y = y
    this.z = z
    return this
  }

  copy(v: Vec3): Vec3 {
    this.x = v.x
    this.y = v.y
    this.z = v.z
    return this
  }

  add(v: Vec3): Vec3 {
    this.x += v.x
    this.y += v.y
    this.z += v.z
    return this
  }

  sub(v: Vec3): Vec3 {
    this.x -= v.x
    this.y -= v.y
    this.z -= v.z
    return this
  }

  multiplyScalar(s: number): Vec3 {
    this.x *= s
    this.y *= s
    this.z *= s
    return this
  }

  length(): number {
    return Math.sqrt(this.x * this.x + this.y * this.y + this.z * this.z)
  }

  negate(): Vec3 {
    this.x = -this.x
    this.y = -this.y
    this.z = -this.z
    return this
  }
}

// Box3 utilities
class Box3 {
  min: Vec3
  max: Vec3

  constructor() {
    this.min = new Vec3(Infinity, Infinity, Infinity)
    this.max = new Vec3(-Infinity, -Infinity, -Infinity)
  }

  setFromPoints(positions: Float32Array): Box3 {
    this.min.set(Infinity, Infinity, Infinity)
    this.max.set(-Infinity, -Infinity, -Infinity)

    for (let i = 0; i < positions.length; i += 3) {
      this.min.x = Math.min(this.min.x, positions[i])
      this.min.y = Math.min(this.min.y, positions[i + 1])
      this.min.z = Math.min(this.min.z, positions[i + 2])
      this.max.x = Math.max(this.max.x, positions[i])
      this.max.y = Math.max(this.max.y, positions[i + 1])
      this.max.z = Math.max(this.max.z, positions[i + 2])
    }

    return this
  }

  getCenter(): Vec3 {
    return new Vec3(
      (this.min.x + this.max.x) * 0.5,
      (this.min.y + this.max.y) * 0.5,
      (this.min.z + this.max.z) * 0.5
    )
  }

  getSize(): Vec3 {
    return new Vec3(
      this.max.x - this.min.x,
      this.max.y - this.min.y,
      this.max.z - this.min.z
    )
  }
}

/**
 * Apply translation to positions
 */
function translatePositions(positions: Float32Array, translation: Vec3): void {
  for (let i = 0; i < positions.length; i += 3) {
    positions[i] += translation.x
    positions[i + 1] += translation.y
    positions[i + 2] += translation.z
  }
}

/**
 * Apply scale to positions
 */
function scalePositions(positions: Float32Array, scale: number): void {
  for (let i = 0; i < positions.length; i += 3) {
    positions[i] *= scale
    positions[i + 1] *= scale
    positions[i + 2] *= scale
  }
}

/**
 * Normalize character asset
 */
function normalizeCharacter(
  positions: Float32Array,
  normals: Float32Array | undefined,
  targetHeight: number = 1.83
): AssetNormalizationResult {
  // Get original bounds
  const originalBounds = new Box3().setFromPoints(positions)
  const originalSize = originalBounds.getSize()
  const originalHeight = originalSize.y

  // Calculate scale factor to reach target height
  const scaleFactor = originalHeight > 0 ? targetHeight / originalHeight : 1

  // Apply scale
  scalePositions(positions, scaleFactor)

  // Scale normals if present
  if (normals) {
    // Normals don't need scaling, just normalization
    for (let i = 0; i < normals.length; i += 3) {
      const nx = normals[i]
      const ny = normals[i + 1]
      const nz = normals[i + 2]
      const len = Math.sqrt(nx * nx + ny * ny + nz * nz)
      if (len > 0) {
        normals[i] /= len
        normals[i + 1] /= len
        normals[i + 2] /= len
      }
    }
  }

  // Get bounds after scaling
  const scaledBounds = new Box3().setFromPoints(positions)

  // Position feet at origin
  const translation = new Vec3(0, -scaledBounds.min.y, 0)
  translatePositions(positions, translation)

  // Get final bounds
  const normalizedBounds = new Box3().setFromPoints(positions)

  return {
    positions,
    normals,
    metadata: {
      originalBounds: {
        min: [originalBounds.min.x, originalBounds.min.y, originalBounds.min.z],
        max: [originalBounds.max.x, originalBounds.max.y, originalBounds.max.z],
      },
      normalizedBounds: {
        min: [normalizedBounds.min.x, normalizedBounds.min.y, normalizedBounds.min.z],
        max: [normalizedBounds.max.x, normalizedBounds.max.y, normalizedBounds.max.z],
      },
      transformsApplied: {
        translation: [translation.x, translation.y, translation.z],
        rotation: [0, 0, 0],
        scale: scaleFactor,
      },
      processingTime: 0, // Will be set by caller
    },
  }
}

/**
 * Normalize weapon asset
 */
function normalizeWeapon(
  positions: Float32Array,
  normals: Float32Array | undefined,
  gripPoint?: [number, number, number]
): AssetNormalizationResult {
  // Get original bounds
  const originalBounds = new Box3().setFromPoints(positions)
  const originalSize = originalBounds.getSize()
  const originalCenter = originalBounds.getCenter()

  // If no grip point provided, estimate it (bottom 20% of model)
  let grip: Vec3
  if (gripPoint) {
    grip = new Vec3(gripPoint[0], gripPoint[1], gripPoint[2])
  } else {
    grip = new Vec3(
      originalCenter.x,
      originalBounds.min.y + originalSize.y * 0.2,
      originalCenter.z
    )
  }

  // Move grip point to origin
  const translation = new Vec3().copy(grip).negate()
  translatePositions(positions, translation)

  // Get final bounds
  const normalizedBounds = new Box3().setFromPoints(positions)

  return {
    positions,
    normals,
    metadata: {
      originalBounds: {
        min: [originalBounds.min.x, originalBounds.min.y, originalBounds.min.z],
        max: [originalBounds.max.x, originalBounds.max.y, originalBounds.max.z],
      },
      normalizedBounds: {
        min: [normalizedBounds.min.x, normalizedBounds.min.y, normalizedBounds.min.z],
        max: [normalizedBounds.max.x, normalizedBounds.max.y, normalizedBounds.max.z],
      },
      transformsApplied: {
        translation: [translation.x, translation.y, translation.z],
        rotation: [0, 0, 0],
        scale: 1,
      },
      processingTime: 0,
    },
  }
}

/**
 * Normalize armor asset
 */
function normalizeArmor(
  positions: Float32Array,
  normals: Float32Array | undefined,
  armorType: string = 'chest'
): AssetNormalizationResult {
  // Get original bounds
  const originalBounds = new Box3().setFromPoints(positions)
  const originalCenter = originalBounds.getCenter()

  // Center based on armor type
  let translation: Vec3
  if (armorType === 'helmet') {
    // For helmets, attachment point is at neck (bottom center)
    translation = new Vec3(
      -originalCenter.x,
      -originalBounds.min.y,
      -originalCenter.z
    )
  } else {
    // For other armor, center completely
    translation = new Vec3().copy(originalCenter).negate()
  }

  translatePositions(positions, translation)

  // Get final bounds
  const normalizedBounds = new Box3().setFromPoints(positions)

  return {
    positions,
    normals,
    metadata: {
      originalBounds: {
        min: [originalBounds.min.x, originalBounds.min.y, originalBounds.min.z],
        max: [originalBounds.max.x, originalBounds.max.y, originalBounds.max.z],
      },
      normalizedBounds: {
        min: [normalizedBounds.min.x, normalizedBounds.min.y, normalizedBounds.min.z],
        max: [normalizedBounds.max.x, normalizedBounds.max.y, normalizedBounds.max.z],
      },
      transformsApplied: {
        translation: [translation.x, translation.y, translation.z],
        rotation: [0, 0, 0],
        scale: 1,
      },
      processingTime: 0,
    },
  }
}

/**
 * Normalize building asset
 */
function normalizeBuilding(
  positions: Float32Array,
  normals: Float32Array | undefined
): AssetNormalizationResult {
  // Get original bounds
  const originalBounds = new Box3().setFromPoints(positions)
  const originalCenter = originalBounds.getCenter()

  // Position with ground at Y=0 and center on X/Z
  const translation = new Vec3(
    -originalCenter.x,
    -originalBounds.min.y,
    -originalCenter.z
  )

  translatePositions(positions, translation)

  // Get final bounds
  const normalizedBounds = new Box3().setFromPoints(positions)

  return {
    positions,
    normals,
    metadata: {
      originalBounds: {
        min: [originalBounds.min.x, originalBounds.min.y, originalBounds.min.z],
        max: [originalBounds.max.x, originalBounds.max.y, originalBounds.max.z],
      },
      normalizedBounds: {
        min: [normalizedBounds.min.x, normalizedBounds.min.y, normalizedBounds.min.z],
        max: [normalizedBounds.max.x, normalizedBounds.max.y, normalizedBounds.max.z],
      },
      transformsApplied: {
        translation: [translation.x, translation.y, translation.z],
        rotation: [0, 0, 0],
        scale: 1,
      },
      processingTime: 0,
    },
  }
}

/**
 * Normalize generic item - center at origin
 */
function normalizeItem(
  positions: Float32Array,
  normals: Float32Array | undefined
): AssetNormalizationResult {
  // Get original bounds
  const originalBounds = new Box3().setFromPoints(positions)
  const originalCenter = originalBounds.getCenter()

  // Center at origin
  const translation = new Vec3().copy(originalCenter).negate()
  translatePositions(positions, translation)

  // Get final bounds
  const normalizedBounds = new Box3().setFromPoints(positions)

  return {
    positions,
    normals,
    metadata: {
      originalBounds: {
        min: [originalBounds.min.x, originalBounds.min.y, originalBounds.min.z],
        max: [originalBounds.max.x, originalBounds.max.y, originalBounds.max.z],
      },
      normalizedBounds: {
        min: [normalizedBounds.min.x, normalizedBounds.min.y, normalizedBounds.min.z],
        max: [normalizedBounds.max.x, normalizedBounds.max.y, normalizedBounds.max.z],
      },
      transformsApplied: {
        translation: [translation.x, translation.y, translation.z],
        rotation: [0, 0, 0],
        scale: 1,
      },
      processingTime: 0,
    },
  }
}

/**
 * Perform asset normalization
 */
function normalizeAsset(data: AssetNormalizationData): AssetNormalizationResult {
  const startTime = performance.now()

  // Clone positions to avoid modifying original
  const positions = new Float32Array(data.positions)
  const normals = data.normals ? new Float32Array(data.normals) : undefined

  let result: AssetNormalizationResult

  // Route to appropriate normalizer
  if (data.assetType === 'character') {
    result = normalizeCharacter(positions, normals, data.parameters.targetHeight)
  } else if (data.assetType === 'weapon') {
    result = normalizeWeapon(positions, normals, data.parameters.gripPoint)
  } else if (data.assetType === 'armor') {
    result = normalizeArmor(positions, normals, data.subtype)
  } else if (data.assetType === 'building') {
    result = normalizeBuilding(positions, normals)
  } else {
    result = normalizeItem(positions, normals)
  }

  // Set processing time
  result.metadata.processingTime = performance.now() - startTime

  return result
}

// Worker message handler
self.onmessage = (event: MessageEvent<WorkerRequest<AssetNormalizationData>>) => {
  const { id, type, data } = event.data

  // Store task ID for progress reporting
  ;(self as unknown as { currentTaskId: string }).currentTaskId = id

  try {
    if (type === 'NORMALIZE_ASSET') {
      const result = normalizeAsset(data)
      self.postMessage({
        id,
        type: 'SUCCESS',
        data: result,
      } satisfies WorkerResponse<AssetNormalizationResult>)
    } else {
      throw new Error(`Unknown message type: ${type}`)
    }
  } catch (error) {
    self.postMessage({
      id,
      type: 'ERROR',
      error: error instanceof Error ? error.message : String(error),
    } satisfies WorkerResponse)
  }
}

// Export empty object for TypeScript module compatibility
export {}
