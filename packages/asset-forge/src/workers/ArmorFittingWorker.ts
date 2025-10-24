/**
 * Armor Fitting Worker
 * Performs shrinkwrap armor fitting off the main thread
 */

import type {
  WorkerRequest,
  WorkerResponse,
  ArmorFittingData,
  ArmorFittingResult,
} from './types'

// Reuse Vec3 class from mesh fitting
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

  normalize(): Vec3 {
    const len = this.length()
    if (len > 0) {
      this.multiplyScalar(1 / len)
    }
    return this
  }

  applyMatrix4(m: number[]): Vec3 {
    const x = this.x
    const y = this.y
    const z = this.z
    const w = 1

    this.x = m[0] * x + m[4] * y + m[8] * z + m[12] * w
    this.y = m[1] * x + m[5] * y + m[9] * z + m[13] * w
    this.z = m[2] * x + m[6] * y + m[10] * z + m[14] * w

    return this
  }

  distanceTo(v: Vec3): number {
    const dx = this.x - v.x
    const dy = this.y - v.y
    const dz = this.z - v.z
    return Math.sqrt(dx * dx + dy * dy + dz * dz)
  }

  cross(v: Vec3): Vec3 {
    const x = this.y * v.z - this.z * v.y
    const y = this.z * v.x - this.x * v.z
    const z = this.x * v.y - this.y * v.x
    return new Vec3(x, y, z)
  }

  dot(v: Vec3): number {
    return this.x * v.x + this.y * v.y + this.z * v.z
  }
}

/**
 * Build skinned mesh vertices from base positions, skin indices, weights, and bone matrices
 */
function buildSkinnedVertices(
  basePositions: Float32Array,
  skinIndices: Float32Array,
  skinWeights: Float32Array,
  boneMatrices: number[][]
): Float32Array {
  const vertexCount = basePositions.length / 3
  const skinnedPositions = new Float32Array(vertexCount * 3)

  for (let i = 0; i < vertexCount; i++) {
    const baseVertex = new Vec3(
      basePositions[i * 3],
      basePositions[i * 3 + 1],
      basePositions[i * 3 + 2]
    )

    const skinnedVertex = new Vec3()

    // Apply skinning (up to 4 bone influences per vertex)
    for (let j = 0; j < 4; j++) {
      const boneIndex = Math.floor(skinIndices[i * 4 + j])
      const weight = skinWeights[i * 4 + j]

      if (weight > 0 && boneIndex < boneMatrices.length) {
        const boneMatrix = boneMatrices[boneIndex]
        const transformed = new Vec3().copy(baseVertex).applyMatrix4(boneMatrix)
        transformed.multiplyScalar(weight)
        skinnedVertex.add(transformed)
      }
    }

    skinnedPositions[i * 3] = skinnedVertex.x
    skinnedPositions[i * 3 + 1] = skinnedVertex.y
    skinnedPositions[i * 3 + 2] = skinnedVertex.z
  }

  return skinnedPositions
}

/**
 * Find closest point on body mesh to armor vertex
 */
function findClosestBodyPoint(
  armorVertex: Vec3,
  bodyPositions: Float32Array,
  bodyIndices: Uint32Array | undefined
): { point: Vec3; distance: number; normal: Vec3 } {
  let closestPoint = new Vec3()
  let closestDistance = Infinity
  let closestNormal = new Vec3(0, 1, 0)

  if (bodyIndices && bodyIndices.length > 0) {
    // Check triangles
    for (let i = 0; i < bodyIndices.length; i += 3) {
      const i0 = bodyIndices[i]
      const i1 = bodyIndices[i + 1]
      const i2 = bodyIndices[i + 2]

      const v0 = new Vec3(
        bodyPositions[i0 * 3],
        bodyPositions[i0 * 3 + 1],
        bodyPositions[i0 * 3 + 2]
      )

      const v1 = new Vec3(
        bodyPositions[i1 * 3],
        bodyPositions[i1 * 3 + 1],
        bodyPositions[i1 * 3 + 2]
      )

      const v2 = new Vec3(
        bodyPositions[i2 * 3],
        bodyPositions[i2 * 3 + 1],
        bodyPositions[i2 * 3 + 2]
      )

      // Find closest point on triangle
      const closest = closestPointOnTriangle(armorVertex, v0, v1, v2)
      const distance = armorVertex.distanceTo(closest)

      if (distance < closestDistance) {
        closestDistance = distance
        closestPoint = closest

        // Calculate triangle normal
        const edge1 = new Vec3().copy(v1).sub(v0)
        const edge2 = new Vec3().copy(v2).sub(v0)
        closestNormal = edge1.cross(edge2).normalize()
      }
    }
  } else {
    // Fallback: check all vertices
    const vertexCount = bodyPositions.length / 3
    for (let i = 0; i < vertexCount; i++) {
      const v = new Vec3(
        bodyPositions[i * 3],
        bodyPositions[i * 3 + 1],
        bodyPositions[i * 3 + 2]
      )

      const distance = armorVertex.distanceTo(v)
      if (distance < closestDistance) {
        closestDistance = distance
        closestPoint = v
      }
    }
  }

  return { point: closestPoint, distance: closestDistance, normal: closestNormal }
}

/**
 * Find closest point on triangle to a point
 */
function closestPointOnTriangle(point: Vec3, v0: Vec3, v1: Vec3, v2: Vec3): Vec3 {
  const edge0 = new Vec3().copy(v1).sub(v0)
  const edge1 = new Vec3().copy(v2).sub(v0)
  const v0ToPoint = new Vec3().copy(point).sub(v0)

  const a = edge0.dot(edge0)
  const b = edge0.dot(edge1)
  const c = edge1.dot(edge1)
  const d = edge0.dot(v0ToPoint)
  const e = edge1.dot(v0ToPoint)

  const det = a * c - b * b
  let s = b * e - c * d
  let t = b * d - a * e

  if (s + t <= det) {
    if (s < 0) {
      if (t < 0) {
        // Region 4
        s = Math.max(0, Math.min(1, -d / a))
        t = 0
      } else {
        // Region 3
        s = 0
        t = Math.max(0, Math.min(1, e / c))
      }
    } else if (t < 0) {
      // Region 5
      s = Math.max(0, Math.min(1, d / a))
      t = 0
    } else {
      // Region 0
      const invDet = 1 / det
      s *= invDet
      t *= invDet
    }
  } else {
    if (s < 0) {
      // Region 2
      s = 0
      t = Math.max(0, Math.min(1, (e + b) / c))
    } else if (t < 0) {
      // Region 6
      s = Math.max(0, Math.min(1, (d + b) / a))
      t = 0
    } else {
      // Region 1
      const numer = c + e - b - d
      if (numer <= 0) {
        s = 0
      } else {
        const denom = a - 2 * b + c
        s = Math.max(0, Math.min(1, numer / denom))
      }
      t = 1 - s
    }
  }

  const result = new Vec3().copy(v0)
  result.add(new Vec3().copy(edge0).multiplyScalar(s))
  result.add(new Vec3().copy(edge1).multiplyScalar(t))

  return result
}

/**
 * Transfer skin weights from body to armor
 */
function transferSkinWeights(
  armorPositions: Float32Array,
  bodyPositions: Float32Array,
  bodySkinIndices: Float32Array,
  bodySkinWeights: Float32Array,
  armorMatrix: number[],
  bodyMatrix: number[]
): { skinIndices: Float32Array; skinWeights: Float32Array } {
  const vertexCount = armorPositions.length / 3
  const skinIndices = new Float32Array(vertexCount * 4)
  const skinWeights = new Float32Array(vertexCount * 4)

  for (let i = 0; i < vertexCount; i++) {
    const armorVertex = new Vec3(
      armorPositions[i * 3],
      armorPositions[i * 3 + 1],
      armorPositions[i * 3 + 2]
    ).applyMatrix4(armorMatrix)

    // Find closest body vertex
    let closestBodyIndex = 0
    let closestDistance = Infinity

    const bodyVertexCount = bodyPositions.length / 3
    for (let j = 0; j < bodyVertexCount; j++) {
      const bodyVertex = new Vec3(
        bodyPositions[j * 3],
        bodyPositions[j * 3 + 1],
        bodyPositions[j * 3 + 2]
      ).applyMatrix4(bodyMatrix)

      const distance = armorVertex.distanceTo(bodyVertex)
      if (distance < closestDistance) {
        closestDistance = distance
        closestBodyIndex = j
      }
    }

    // Copy skin weights from closest body vertex
    for (let j = 0; j < 4; j++) {
      skinIndices[i * 4 + j] = bodySkinIndices[closestBodyIndex * 4 + j]
      skinWeights[i * 4 + j] = bodySkinWeights[closestBodyIndex * 4 + j]
    }
  }

  return { skinIndices, skinWeights }
}

/**
 * Perform armor shrinkwrap fitting
 */
function fitArmor(data: ArmorFittingData): ArmorFittingResult {
  const startTime = performance.now()

  const {
    armorPositions,
    bodyPositions,
    bodyIndices,
    bodySkinIndices,
    bodySkinWeights,
    boneMatrices,
    armorMatrix,
    bodyMatrix,
    parameters,
  } = data

  const vertexCount = armorPositions.length / 3

  // Create working copy of positions
  const positions = new Float32Array(armorPositions)

  // Build skinned body mesh if we have skin data
  let targetBodyPositions = bodyPositions
  if (bodySkinIndices && bodySkinWeights && boneMatrices.length > 0) {
    targetBodyPositions = buildSkinnedVertices(
      bodyPositions,
      bodySkinIndices,
      bodySkinWeights,
      boneMatrices
    )
  }

  // Iterative shrinkwrap
  for (let iter = 0; iter < parameters.iterations; iter++) {
    // Report progress
    if (iter % Math.max(1, Math.floor(parameters.iterations / 10)) === 0) {
      const progress = iter / parameters.iterations
      self.postMessage({
        id: (self as unknown as { currentTaskId: string }).currentTaskId,
        type: 'PROGRESS',
        progress,
      } satisfies WorkerResponse)
    }

    let totalMovement = 0

    // Process each armor vertex
    for (let i = 0; i < vertexCount; i++) {
      const armorVertex = new Vec3(
        positions[i * 3],
        positions[i * 3 + 1],
        positions[i * 3 + 2]
      ).applyMatrix4(armorMatrix)

      // Find closest point on body
      const closest = findClosestBodyPoint(armorVertex, targetBodyPositions, bodyIndices)

      // Calculate displacement toward body surface
      const direction = new Vec3().copy(closest.point).sub(armorVertex)
      const distance = direction.length()

      if (distance > parameters.targetOffset) {
        direction.normalize()

        // Move toward surface, maintaining offset
        const moveAmount = (distance - parameters.targetOffset) * parameters.stepSize
        const displacement = direction.multiplyScalar(moveAmount)

        // Add small outward push along normal to prevent intersections
        const normalPush = new Vec3().copy(closest.normal).multiplyScalar(parameters.targetOffset * 0.1)
        displacement.add(normalPush)

        // Transform back to local space
        const inverseMatrix = invertMatrix(armorMatrix)
        displacement.applyMatrix4(inverseMatrix)

        // Apply displacement
        positions[i * 3] += displacement.x
        positions[i * 3 + 1] += displacement.y
        positions[i * 3 + 2] += displacement.z

        totalMovement += displacement.length()
      }
    }

    // Early exit if converged
    if (totalMovement < 0.0001) {
      break
    }
  }

  // Transfer skin weights if available
  let skinIndices: Float32Array | undefined
  let skinWeights: Float32Array | undefined

  if (bodySkinIndices && bodySkinWeights) {
    const transferred = transferSkinWeights(
      positions,
      bodyPositions,
      bodySkinIndices,
      bodySkinWeights,
      armorMatrix,
      bodyMatrix
    )
    skinIndices = transferred.skinIndices
    skinWeights = transferred.skinWeights
  }

  const processingTime = performance.now() - startTime

  return {
    positions,
    skinIndices,
    skinWeights,
    metadata: {
      iterations: parameters.iterations,
      verticesProcessed: vertexCount,
      processingTime,
    },
  }
}

/**
 * Invert a 4x4 matrix (simplified)
 */
function invertMatrix(m: number[]): number[] {
  const result = [
    1, 0, 0, 0,
    0, 1, 0, 0,
    0, 0, 1, 0,
    0, 0, 0, 1,
  ]

  // Transpose rotation for inverse
  result[0] = m[0]
  result[1] = m[4]
  result[2] = m[8]
  result[4] = m[1]
  result[5] = m[5]
  result[6] = m[9]
  result[8] = m[2]
  result[9] = m[6]
  result[10] = m[10]

  // Inverse translation
  result[12] = -(m[12] * result[0] + m[13] * result[4] + m[14] * result[8])
  result[13] = -(m[12] * result[1] + m[13] * result[5] + m[14] * result[9])
  result[14] = -(m[12] * result[2] + m[13] * result[6] + m[14] * result[10])

  return result
}

// Worker message handler
self.onmessage = (event: MessageEvent<WorkerRequest<ArmorFittingData>>) => {
  const { id, type, data } = event.data

  // Store task ID for progress reporting
  ;(self as unknown as { currentTaskId: string }).currentTaskId = id

  try {
    if (type === 'SHRINKWRAP_ARMOR') {
      const result = fitArmor(data)
      self.postMessage({
        id,
        type: 'SUCCESS',
        data: result,
      } satisfies WorkerResponse<ArmorFittingResult>)
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
