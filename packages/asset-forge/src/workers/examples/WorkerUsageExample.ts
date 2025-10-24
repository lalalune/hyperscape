/**
 * Worker Usage Example
 * Demonstrates how to use Web Workers for mesh processing
 */

import {
  Bone, BoxGeometry, CylinderGeometry, Float32BufferAttribute, Mesh, MeshBasicMaterial, Skeleton, SkinnedMesh,
  SphereGeometry
} from 'three'
import { getWorkerManager, terminateWorkerManager } from '../WorkerManager'
import { getPerformanceTracker, getAllPerformanceStats } from '../WorkerServiceAdapter'
import { createLogger } from '../../utils/logger'

const logger = createLogger('WorkerUsageExample')

/**
 * Example 1: Mesh Fitting with Progress Reporting
 */
export async function exampleMeshFitting(): Promise<void> {
  logger.info('=== Example: Mesh Fitting ===')

  // Create test meshes
  const sourceMesh = new Mesh(
    new BoxGeometry(1, 1, 1, 10, 10, 10),
    new MeshBasicMaterial()
  )

  const targetMesh = new Mesh(
    new SphereGeometry(0.5, 32, 32),
    new MeshBasicMaterial()
  )

  // Get worker manager
  const workerManager = getWorkerManager()

  // Track performance
  const tracker = getPerformanceTracker('MeshFitting')
  const startTime = performance.now()

  try {
    // Fit mesh using worker
    const result = await workerManager.fitMeshToTarget(
      sourceMesh,
      targetMesh,
      {
        iterations: 10,
        stepSize: 0.5,
        targetOffset: 0.01,
        smoothingIterations: 3,
        smoothingFactor: 0.5,
      },
      (progress) => {
        logger.info(`Fitting progress: ${Math.round(progress * 100)}%`)
      }
    )

    const duration = performance.now() - startTime
    tracker.recordWorker(duration)

    // Apply results
    sourceMesh.geometry.attributes.position.array.set(result.positions)
    sourceMesh.geometry.attributes.position.needsUpdate = true

    logger.info('Mesh fitting completed:', {
      duration: `${duration.toFixed(0)}ms`,
      metadata: result.metadata,
    })
  } catch (error) {
    logger.error('Mesh fitting failed:', error)
  }
}

/**
 * Example 2: Armor Fitting with Skin Weight Transfer
 */
export async function exampleArmorFitting(): Promise<void> {
  logger.info('=== Example: Armor Fitting ===')

  // Create armor mesh
  const armorGeometry = new BoxGeometry(0.6, 0.8, 0.3, 20, 20, 20)
  const armorMesh = new Mesh(armorGeometry, new MeshBasicMaterial())

  // Create body mesh (skinned)
  const bodyGeometry = new CylinderGeometry(0.3, 0.3, 1.0, 32, 32)
  const bodyMaterial = new MeshBasicMaterial()

  // Create skeleton
  const bones: Bone[] = []
  const bone1 = new Bone()
  bone1.position.set(0, -0.5, 0)
  bones.push(bone1)

  const bone2 = new Bone()
  bone2.position.set(0, 0, 0)
  bone1.add(bone2)
  bones.push(bone2)

  const bone3 = new Bone()
  bone3.position.set(0, 0.5, 0)
  bone2.add(bone3)
  bones.push(bone3)

  const skeleton = new Skeleton(bones)
  const bodyMesh = new SkinnedMesh(bodyGeometry, bodyMaterial)
  bodyMesh.add(bones[0])
  bodyMesh.bind(skeleton)

  // Add skin indices and weights
  const vertexCount = bodyGeometry.attributes.position.count
  const skinIndices = new Float32Array(vertexCount * 4)
  const skinWeights = new Float32Array(vertexCount * 4)

  for (let i = 0; i < vertexCount; i++) {
    const y = bodyGeometry.attributes.position.getY(i)
    if (y < -0.25) {
      skinIndices[i * 4] = 0
      skinWeights[i * 4] = 1
    } else if (y > 0.25) {
      skinIndices[i * 4] = 2
      skinWeights[i * 4] = 1
    } else {
      skinIndices[i * 4] = 1
      skinWeights[i * 4] = 1
    }
  }

  bodyGeometry.setAttribute('skinIndex', new Float32BufferAttribute(skinIndices, 4))
  bodyGeometry.setAttribute('skinWeight', new Float32BufferAttribute(skinWeights, 4))

  // Get worker manager
  const workerManager = getWorkerManager()

  // Track performance
  const tracker = getPerformanceTracker('ArmorFitting')
  const startTime = performance.now()

  try {
    // Fit armor using worker
    const result = await workerManager.fitArmorToBody(
      armorMesh,
      bodyMesh,
      {
        iterations: 15,
        stepSize: 0.5,
        targetOffset: 0.02,
        preserveOpenings: true,
        armorType: 'chest',
      },
      (progress) => {
        logger.info(`Armor fitting progress: ${Math.round(progress * 100)}%`)
      }
    )

    const duration = performance.now() - startTime
    tracker.recordWorker(duration)

    // Apply results
    armorMesh.geometry.attributes.position.array.set(result.positions)
    armorMesh.geometry.attributes.position.needsUpdate = true

    if (result.skinIndices && result.skinWeights) {
      armorMesh.geometry.setAttribute(
        'skinIndex',
        new Float32BufferAttribute(result.skinIndices, 4)
      )
      armorMesh.geometry.setAttribute(
        'skinWeight',
        new Float32BufferAttribute(result.skinWeights, 4)
      )
      logger.info('Skin weights transferred successfully')
    }

    logger.info('Armor fitting completed:', {
      duration: `${duration.toFixed(0)}ms`,
      metadata: result.metadata,
    })
  } catch (error) {
    logger.error('Armor fitting failed:', error)
  }
}

/**
 * Example 3: Asset Normalization
 */
export async function exampleAssetNormalization(): Promise<void> {
  logger.info('=== Example: Asset Normalization ===')

  // Create character geometry
  const characterGeometry = new CylinderGeometry(0.3, 0.3, 2.0, 32, 32)

  // Offset it away from origin
  characterGeometry.translate(0.5, 1.5, 0.3)

  // Get worker manager
  const workerManager = getWorkerManager()

  // Track performance
  const tracker = getPerformanceTracker('AssetNormalization')
  const startTime = performance.now()

  try {
    // Normalize using worker
    const result = await workerManager.normalizeAsset(
      characterGeometry,
      'character',
      undefined,
      { targetHeight: 1.83 },
      (progress) => {
        logger.info(`Normalization progress: ${Math.round(progress * 100)}%`)
      }
    )

    const duration = performance.now() - startTime
    tracker.recordWorker(duration)

    // Apply results
    characterGeometry.attributes.position.array.set(result.positions)
    characterGeometry.attributes.position.needsUpdate = true

    if (result.normals) {
      characterGeometry.attributes.normal.array.set(result.normals)
      characterGeometry.attributes.normal.needsUpdate = true
    }

    logger.info('Asset normalization completed:', {
      duration: `${duration.toFixed(0)}ms`,
      metadata: result.metadata,
    })
  } catch (error) {
    logger.error('Asset normalization failed:', error)
  }
}

/**
 * Example 4: Parallel Processing
 */
export async function exampleParallelProcessing(): Promise<void> {
  logger.info('=== Example: Parallel Processing ===')

  const workerManager = getWorkerManager()

  // Create multiple assets
  const assets = [
    { type: 'character', geometry: new CylinderGeometry(0.3, 0.3, 2.0, 16, 16) },
    { type: 'weapon', geometry: new BoxGeometry(0.1, 1.0, 0.1, 4, 20, 4) },
    { type: 'armor', geometry: new BoxGeometry(0.6, 0.8, 0.3, 10, 10, 10) },
    { type: 'building', geometry: new BoxGeometry(5, 8, 5, 20, 20, 20) },
  ]

  const startTime = performance.now()

  try {
    // Process all assets in parallel
    const results = await Promise.all(
      assets.map(async (asset, index) => {
        logger.info(`Starting normalization of asset ${index + 1}`)
        const result = await workerManager.normalizeAsset(
          asset.geometry,
          asset.type,
          undefined,
          {},
          (progress) => {
            logger.info(`Asset ${index + 1} progress: ${Math.round(progress * 100)}%`)
          }
        )
        logger.info(`Asset ${index + 1} completed in ${result.metadata.processingTime.toFixed(0)}ms`)
        return result
      })
    )

    const totalDuration = performance.now() - startTime

    logger.info('Parallel processing completed:', {
      totalDuration: `${totalDuration.toFixed(0)}ms`,
      assetsProcessed: results.length,
      averageTime: `${(totalDuration / results.length).toFixed(0)}ms`,
    })
  } catch (error) {
    logger.error('Parallel processing failed:', error)
  }
}

/**
 * Example 5: Performance Comparison
 */
export async function examplePerformanceComparison(): Promise<void> {
  logger.info('=== Example: Performance Comparison ===')

  // Run examples to generate performance data
  await exampleMeshFitting()
  await exampleArmorFitting()
  await exampleAssetNormalization()

  // Get performance statistics
  const stats = getAllPerformanceStats()

  logger.info('Performance Statistics:', stats)

  // Get worker pool statistics
  const workerManager = getWorkerManager()
  const workerStats = workerManager.getStats()

  logger.info('Worker Pool Statistics:', workerStats)
}

/**
 * Example 6: Error Handling and Fallback
 */
export async function exampleErrorHandling(): Promise<void> {
  logger.info('=== Example: Error Handling ===')

  // Create worker manager with workers disabled to test fallback
  const workerManager = getWorkerManager(false)

  const geometry = new BoxGeometry(1, 1, 1)

  try {
    await workerManager.normalizeAsset(geometry, 'character')
  } catch (error) {
    logger.info('Expected error (workers disabled):', error)
    logger.info('In production, this would fall back to main thread processing')
  }
}

/**
 * Run all examples
 */
export async function runAllExamples(): Promise<void> {
  logger.info('===================================')
  logger.info('Web Workers Usage Examples')
  logger.info('===================================')

  try {
    await exampleMeshFitting()
    await exampleArmorFitting()
    await exampleAssetNormalization()
    await exampleParallelProcessing()
    await examplePerformanceComparison()
    await exampleErrorHandling()

    logger.info('===================================')
    logger.info('All examples completed successfully')
    logger.info('===================================')
  } catch (error) {
    logger.error('Examples failed:', error)
  } finally {
    // Clean up
    terminateWorkerManager()
  }
}

// Export for testing
export const examples = {
  meshFitting: exampleMeshFitting,
  armorFitting: exampleArmorFitting,
  assetNormalization: exampleAssetNormalization,
  parallelProcessing: exampleParallelProcessing,
  performanceComparison: examplePerformanceComparison,
  errorHandling: exampleErrorHandling,
  runAll: runAllExamples,
}
