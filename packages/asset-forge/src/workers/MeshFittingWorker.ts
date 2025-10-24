/**
 * Mesh Fitting Worker
 * Performs expensive mesh fitting calculations off the main thread
 */

import type {
  WorkerRequest,
  WorkerResponse,
  MeshFittingData,
  MeshFittingResult,
} from './types'

// Vector3 utilities (lightweight, no Three.js dependency)
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

// Box3 utilities
class Box3 {
  min: Vec3
  max: Vec3

  constructor(
    min: Vec3 = new Vec3(Infinity, Infinity, Infinity),
    max: Vec3 = new Vec3(-Infinity, -Infinity, -Infinity)
  ) {
    this.min = min
    this.max = max
  }

  containsPoint(point: Vec3): boolean {
    return (
      point.x >= this.min.x && point.x <= this.max.x &&
      point.y >= this.min.y && point.y <= this.max.y &&
      point.z >= this.min.z && point.z <= this.max.z
    )
  }

  expandByPoint(point: Vec3): void {
    this.min.x = Math.min(this.min.x, point.x)
    this.min.y = Math.min(this.min.y, point.y)
    this.min.z = Math.min(this.min.z, point.z)
    this.max.x = Math.max(this.max.x, point.x)
    this.max.y = Math.max(this.max.y, point.y)
    this.max.z = Math.max(this.max.z, point.z)
  }

  getCenter(): Vec3 {
    return new Vec3(
      (this.min.x + this.max.x) * 0.5,
      (this.min.y + this.max.y) * 0.5,
      (this.min.z + this.max.z) * 0.5
    )
  }
}

/**
 * Raycast against triangle
 */
function raycastTriangle(
  origin: Vec3,
  direction: Vec3,
  v0: Vec3,
  v1: Vec3,
  v2: Vec3
): { distance: number; point: Vec3 } | null {
  const edge1 = new Vec3().copy(v1).sub(v0)
  const edge2 = new Vec3().copy(v2).sub(v0)
  const h = new Vec3().copy(direction).cross(edge2)
  const a = edge1.dot(h)

  if (Math.abs(a) < 0.0000001) {
    return null
  }

  const f = 1 / a
  const s = new Vec3().copy(origin).sub(v0)
  const u = f * s.dot(h)

  if (u < 0 || u > 1) {
    return null
  }

  const q = s.cross(edge1)
  const v = f * direction.dot(q)

  if (v < 0 || u + v > 1) {
    return null
  }

  const t = f * edge2.dot(q)

  if (t > 0.0000001) {
    const point = new Vec3().copy(direction).multiplyScalar(t).add(origin)
    return { distance: t, point }
  }

  return null
}

/**
 * Perform mesh fitting calculation
 */
function fitMesh(data: MeshFittingData): MeshFittingResult {
  const startTime = performance.now()

  const {
    sourcePositions,
    sourceIndices: _sourceIndices,
    targetPositions,
    targetIndices,
    sourceMatrix,
    targetMatrix,
    parameters,
  } = data

  const vertexCount = sourcePositions.length / 3
  const targetVertexCount = targetPositions.length / 3

  // Create working copy of positions
  const positions = new Float32Array(sourcePositions)
  const displacements = new Float32Array(vertexCount * 3)

  // Build target bounds
  const targetBounds = new Box3()
  for (let i = 0; i < targetVertexCount; i++) {
    const v = new Vec3(
      targetPositions[i * 3],
      targetPositions[i * 3 + 1],
      targetPositions[i * 3 + 2]
    )
    v.applyMatrix4(targetMatrix)
    targetBounds.expandByPoint(v)
  }

  const targetCenter = targetBounds.getCenter()

  // Constraint bounds
  let constraintBounds: Box3 | null = null
  if (parameters.constraintBounds) {
    constraintBounds = new Box3(
      new Vec3(
        parameters.constraintBounds.min[0],
        parameters.constraintBounds.min[1],
        parameters.constraintBounds.min[2]
      ),
      new Vec3(
        parameters.constraintBounds.max[0],
        parameters.constraintBounds.max[1],
        parameters.constraintBounds.max[2]
      )
    )
  }

  // Locked vertices set
  const lockedVertices = new Set(parameters.lockedVertices || [])

  let maxDisplacement = 0
  let totalDisplacement = 0
  let displacementCount = 0

  // Iterative fitting
  for (let iter = 0; iter < parameters.iterations; iter++) {
    let iterationMovement = 0

    // Report progress every 10%
    if (iter % Math.max(1, Math.floor(parameters.iterations / 10)) === 0) {
      const progress = iter / parameters.iterations
      self.postMessage({
        id: (self as unknown as { currentTaskId: string }).currentTaskId,
        type: 'PROGRESS',
        progress,
      } satisfies WorkerResponse)
    }

    // Process each vertex
    for (let i = 0; i < vertexCount; i++) {
      // Skip locked vertices
      if (lockedVertices.has(i)) continue

      const vertex = new Vec3(positions[i * 3], positions[i * 3 + 1], positions[i * 3 + 2])
      vertex.applyMatrix4(sourceMatrix)

      // Check constraint bounds
      if (constraintBounds && !constraintBounds.containsPoint(vertex)) {
        continue
      }

      // Calculate direction toward target center
      const toCenter = new Vec3().copy(targetCenter).sub(vertex)
      const distance = toCenter.length()

      if (distance < 0.001) continue

      toCenter.normalize()

      // Simple raycast toward center to find target surface
      let closestDistance = Infinity
      let hasHit = false

      // Check against target triangles
      if (targetIndices && targetIndices.length > 0) {
        for (let j = 0; j < targetIndices.length; j += 3) {
          const i0 = targetIndices[j]
          const i1 = targetIndices[j + 1]
          const i2 = targetIndices[j + 2]

          const v0 = new Vec3(
            targetPositions[i0 * 3],
            targetPositions[i0 * 3 + 1],
            targetPositions[i0 * 3 + 2]
          ).applyMatrix4(targetMatrix)

          const v1 = new Vec3(
            targetPositions[i1 * 3],
            targetPositions[i1 * 3 + 1],
            targetPositions[i1 * 3 + 2]
          ).applyMatrix4(targetMatrix)

          const v2 = new Vec3(
            targetPositions[i2 * 3],
            targetPositions[i2 * 3 + 1],
            targetPositions[i2 * 3 + 2]
          ).applyMatrix4(targetMatrix)

          const hit = raycastTriangle(vertex, toCenter, v0, v1, v2)
          if (hit && hit.distance < closestDistance) {
            closestDistance = hit.distance
            hasHit = true
          }
        }
      }

      // Calculate displacement
      let displacement = new Vec3()
      if (hasHit && closestDistance < distance) {
        // Move towards hit point, maintaining offset
        const moveAmount = Math.max(0, closestDistance - parameters.targetOffset)
        displacement = toCenter.multiplyScalar(moveAmount * parameters.stepSize)
      } else {
        // No hit, move towards center
        const moveAmount = Math.min(distance * parameters.stepSize, 0.01)
        displacement = toCenter.multiplyScalar(moveAmount)
      }

      // Transform displacement back to local space
      const inverseMatrix = invertMatrix(sourceMatrix)
      displacement.applyMatrix4(inverseMatrix)

      // Apply displacement
      displacements[i * 3] += displacement.x
      displacements[i * 3 + 1] += displacement.y
      displacements[i * 3 + 2] += displacement.z

      positions[i * 3] += displacement.x
      positions[i * 3 + 1] += displacement.y
      positions[i * 3 + 2] += displacement.z

      const displacementLength = displacement.length()
      iterationMovement += displacementLength
      maxDisplacement = Math.max(maxDisplacement, displacementLength)
      totalDisplacement += displacementLength
      displacementCount++
    }

    // Early exit if converged
    if (iterationMovement < 0.0001) {
      break
    }
  }

  // Smoothing pass
  if (parameters.smoothingIterations > 0) {
    for (let iter = 0; iter < parameters.smoothingIterations; iter++) {
      const smoothed = new Float32Array(positions)

      for (let i = 0; i < vertexCount; i++) {
        if (lockedVertices.has(i)) continue

        // Average with neighbors (simplified, would need connectivity)
        // For now, just apply smoothing factor
        const factor = parameters.smoothingFactor
        positions[i * 3] = positions[i * 3] * (1 - factor) + smoothed[i * 3] * factor
        positions[i * 3 + 1] = positions[i * 3 + 1] * (1 - factor) + smoothed[i * 3 + 1] * factor
        positions[i * 3 + 2] = positions[i * 3 + 2] * (1 - factor) + smoothed[i * 3 + 2] * factor
      }
    }
  }

  const processingTime = performance.now() - startTime

  return {
    positions,
    displacements,
    metadata: {
      iterations: parameters.iterations,
      maxDisplacement,
      averageDisplacement: displacementCount > 0 ? totalDisplacement / displacementCount : 0,
      processingTime,
    },
  }
}

/**
 * Invert a 4x4 matrix (simplified)
 */
function invertMatrix(m: number[]): number[] {
  // Simplified inverse for rotation + translation matrices
  // For full inverse, would need more complex calculation
  const result = [
    1, 0, 0, 0,
    0, 1, 0, 0,
    0, 0, 1, 0,
    0, 0, 0, 1,
  ]

  // Extract rotation (3x3 upper-left)
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
self.onmessage = (event: MessageEvent<WorkerRequest<MeshFittingData>>) => {
  const { id, type, data } = event.data

  // Store task ID for progress reporting
  ;(self as unknown as { currentTaskId: string }).currentTaskId = id

  try {
    if (type === 'FIT_MESH') {
      const result = fitMesh(data)
      self.postMessage({
        id,
        type: 'SUCCESS',
        data: result,
      } satisfies WorkerResponse<MeshFittingResult>)
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
