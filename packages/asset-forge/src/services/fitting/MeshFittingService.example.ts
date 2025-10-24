/**
 * Example: Buffer-Pooled MeshFittingService Integration
 *
 * This file demonstrates how to integrate buffer pooling into critical sections
 * of MeshFittingService.ts. Apply these patterns to the actual service file.
 */

import { BufferAttribute, BufferGeometry, Mesh, Vector3 } from 'three'
import { BufferPooledMeshFitting as Pool } from './BufferPooledMeshFitting'

/**
 * Example: fitToTarget() with buffer pooling
 *
 * This shows the main fitting loop adapted to use buffer pooling.
 * The key changes are:
 * 1. Buffers created outside iteration loop
 * 2. Buffers reused across iterations (cleared with .fill(0))
 * 3. Buffers released in finally block
 */
export function fitToTargetExample(
  sourceMesh: Mesh,
  _targetMesh: Mesh,
  parameters: {
    iterations: number
    stepSize: number
    smoothingRadius: number
    smoothingStrength: number
  }
): void {
  const geometry = sourceMesh.geometry as BufferGeometry
  const position = geometry.attributes.position as BufferAttribute
  const vertexCount = position.count

  // BEFORE: Created inside loop each iteration
  // const displacements = new Float32Array(vertexCount * 3)

  // AFTER: Create pooled buffers OUTSIDE loop for reuse
  const displacements = Pool.createDisplacementBuffer(vertexCount)
  const originalPositions = Pool.createPositionBuffer(vertexCount)
  const smoothedDisplacements = Pool.createDisplacementBuffer(vertexCount)

  // Copy source positions
  originalPositions.set(position.array)

  try {
    // Main fitting loop
    for (let iter = 0; iter < parameters.iterations; iter++) {
      console.log(`Iteration ${iter + 1}/${parameters.iterations}`)

      // BEFORE: New buffer created each iteration
      // const displacements = new Float32Array(vertexCount * 3)

      // AFTER: Reuse buffer - clear it first
      displacements.fill(0)

      // Calculate displacements for all vertices
      for (let i = 0; i < vertexCount; i++) {
        // @ts-expect-error - Example code showing buffer creation pattern
        const _vertex = new Vector3(
          position.getX(i),
          position.getY(i),
          position.getZ(i)
        )

        // ... raycast to find target point ...
        // const targetPoint = findTargetPoint(vertex, targetMesh)

        // Store displacement
        // displacements[i * 3] = targetPoint.x - vertex.x
        // displacements[i * 3 + 1] = targetPoint.y - vertex.y
        // displacements[i * 3 + 2] = targetPoint.z - vertex.z
      }

      // Smooth displacements
      if (parameters.smoothingStrength > 0) {
        // BEFORE: Creates new buffer
        // const smoothed = new Float32Array(displacements)

        // AFTER: Reuse pooled buffer
        smoothedDisplacements.fill(0)
        smoothedDisplacements.set(displacements)

        // ... smooth logic ...

        // Copy smoothed back to displacements
        displacements.set(smoothedDisplacements)
      }

      // Apply displacements
      for (let i = 0; i < vertexCount; i++) {
        position.setX(i, position.getX(i) + displacements[i * 3] * parameters.stepSize)
        position.setY(i, position.getY(i) + displacements[i * 3 + 1] * parameters.stepSize)
        position.setZ(i, position.getZ(i) + displacements[i * 3 + 2] * parameters.stepSize)
      }

      position.needsUpdate = true
    }
  } finally {
    // CRITICAL: Always release buffers in finally block
    Pool.releaseBuffers(displacements, originalPositions, smoothedDisplacements)

    // Log pool statistics
    Pool.getPoolStats()
  }
}

/**
 * Example: computeVertexNormals() with buffer pooling
 */
export function computeVertexNormalsExample(
  positions: Float32Array,
  vertexCount: number
): Float32Array {
  // BEFORE: Creates new buffer
  // const normals = new Float32Array(vertexCount * 3)

  // AFTER: Use pooled buffer
  const normals = Pool.createNormalBuffer(vertexCount)

  try {
    // Initialize to zero
    normals.fill(0)

    // Compute face normals and accumulate
    for (let i = 0; i < vertexCount; i += 3) {
      if (i + 2 >= vertexCount) break

      const v0 = new Vector3(positions[i * 3], positions[i * 3 + 1], positions[i * 3 + 2])
      const v1 = new Vector3(positions[(i + 1) * 3], positions[(i + 1) * 3 + 1], positions[(i + 1) * 3 + 2])
      const v2 = new Vector3(positions[(i + 2) * 3], positions[(i + 2) * 3 + 1], positions[(i + 2) * 3 + 2])

      const edge1 = v1.clone().sub(v0)
      const edge2 = v2.clone().sub(v0)
      const faceNormal = edge1.cross(edge2).normalize()

      // Add to vertex normals
      for (let j = 0; j < 3; j++) {
        const idx = i + j
        normals[idx * 3] += faceNormal.x
        normals[idx * 3 + 1] += faceNormal.y
        normals[idx * 3 + 2] += faceNormal.z
      }
    }

    // Normalize
    for (let i = 0; i < vertexCount; i++) {
      const nx = normals[i * 3]
      const ny = normals[i * 3 + 1]
      const nz = normals[i * 3 + 2]
      const length = Math.sqrt(nx * nx + ny * ny + nz * nz)

      if (length > 0) {
        normals[i * 3] /= length
        normals[i * 3 + 1] /= length
        normals[i * 3 + 2] /= length
      }
    }

    // IMPORTANT: Return the pooled buffer
    // Caller MUST release it when done
    return normals
  } catch (error) {
    // Release buffer on error
    Pool.releaseBuffer(normals)
    throw error
  }
}

/**
 * Example: smoothDisplacements() with buffer pooling
 */
export function smoothDisplacementsExample(
  displacements: Float32Array,
  originalPositions: Float32Array,
  vertexCount: number,
  radius: number,
  strength: number
): void {
  // BEFORE: Creates copy
  // const originalDisplacements = new Float32Array(displacements)

  // AFTER: Use pooled buffer for copy
  const originalDisplacements = Pool.copyFloat32Array(displacements)

  try {
    // Smooth each vertex
    for (let i = 0; i < vertexCount; i++) {
      const posX = originalPositions[i * 3]
      const posY = originalPositions[i * 3 + 1]
      const posZ = originalPositions[i * 3 + 2]

      let sumX = 0
      let sumY = 0
      let sumZ = 0
      let sumWeight = 0

      // Find nearby vertices within radius
      for (let j = 0; j < vertexCount; j++) {
        const otherX = originalPositions[j * 3]
        const otherY = originalPositions[j * 3 + 1]
        const otherZ = originalPositions[j * 3 + 2]

        const dx = otherX - posX
        const dy = otherY - posY
        const dz = otherZ - posZ
        const distSq = dx * dx + dy * dy + dz * dz

        if (distSq < radius * radius) {
          const dist = Math.sqrt(distSq)
          const weight = Math.exp(-dist * dist / (2 * radius * radius))

          sumX += originalDisplacements[j * 3] * weight
          sumY += originalDisplacements[j * 3 + 1] * weight
          sumZ += originalDisplacements[j * 3 + 2] * weight
          sumWeight += weight
        }
      }

      // Apply smoothed displacement
      if (sumWeight > 0) {
        const avgX = sumX / sumWeight
        const avgY = sumY / sumWeight
        const avgZ = sumZ / sumWeight

        displacements[i * 3] = originalDisplacements[i * 3] * (1 - strength) + avgX * strength
        displacements[i * 3 + 1] = originalDisplacements[i * 3 + 1] * (1 - strength) + avgY * strength
        displacements[i * 3 + 2] = originalDisplacements[i * 3 + 2] * (1 - strength) + avgZ * strength
      }
    }
  } finally {
    // Release the copy
    Pool.releaseBuffer(originalDisplacements)
  }
}

/**
 * Example: Using withBuffers for automatic cleanup
 */
export async function processVerticesWithAutoCleanup(
  _mesh: Mesh,
  vertexCount: number
): Promise<void> {
  await Pool.withBuffers(async (pool) => {
    // All buffers created here are automatically released when function completes
    // @ts-expect-error - Example code showing automatic cleanup pattern
    const _positions = pool.createPositionBuffer(vertexCount)
    // @ts-expect-error - Example code showing automatic cleanup pattern
    const _displacements = pool.createDisplacementBuffer(vertexCount)
    // @ts-expect-error - Example code showing automatic cleanup pattern
    const _normals = pool.createNormalBuffer(vertexCount)

    // ... process vertices ...

    // No need to manually release - happens automatically
  })
}

/**
 * Example: Skin weight buffers
 */
export function createSkinnedMeshExample(
  geometry: BufferGeometry,
  vertexCount: number
): void {
  // BEFORE: Creates two new buffers
  // const skinIndices = new Float32Array(vertexCount * 4)
  // const skinWeights = new Float32Array(vertexCount * 4)

  // AFTER: Use pooled skin weight buffers
  const { indices: skinIndices, weights: skinWeights } =
    Pool.createSkinWeightBuffers(vertexCount)

  try {
    // Initialize skin weights
    for (let i = 0; i < vertexCount; i++) {
      skinIndices[i * 4] = 0
      skinIndices[i * 4 + 1] = 0
      skinIndices[i * 4 + 2] = 0
      skinIndices[i * 4 + 3] = 0

      skinWeights[i * 4] = 1
      skinWeights[i * 4 + 1] = 0
      skinWeights[i * 4 + 2] = 0
      skinWeights[i * 4 + 3] = 0
    }

    // Create attributes (these copy the data, so we can release our buffers)
    geometry.setAttribute('skinIndex', new BufferAttribute(skinIndices, 4))
    geometry.setAttribute('skinWeight', new BufferAttribute(skinWeights, 4))

    // Buffers are released in finally block
  } finally {
    Pool.releaseBuffers(skinIndices, skinWeights)
  }
}

/**
 * Example: Performance monitoring
 */
export function performanceMonitoringExample(): void {
  // Reset pool statistics before operation
  Pool.resetPoolStats()

  const startTime = performance.now()

  // ... perform operations using pooled buffers ...

  const endTime = performance.now()

  console.log(`Operation completed in ${(endTime - startTime).toFixed(2)}ms`)

  // Log detailed pool statistics
  Pool.getPoolStats()
}
